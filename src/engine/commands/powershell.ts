// Windows PowerShell 5.1, the interpreter: a line typed at "PS C:\…>" is
// parsed (../powershell-parse.ts) then run statement by statement; a
// pipeline passes OBJECTS from one command to the next; what reaches the
// end is formatted by Out-Default. Variables live in the session ($x,
// $env:NAME, $_ in a script block, $Error, $LASTEXITCODE, $?); commands are
// cmdlets (found by name or alias, case-insensitive), the native programs
// of windows-natives.ts (hostname, ipconfig, icacls, net, sc.exe…), or a
// script (.\backup.ps1). A cmdlet's parameters bind by name, by
// unambiguous prefix, by position, with type conversion (a SecureString
// parameter refuses a plain string, as in 5.1); -WhatIf, -Confirm and
// -ErrorAction apply to every cmdlet that changes something. A question
// (Read-Host, a confirmation) waits for the next line, then the statement
// runs again with the answer. The cmdlets live in windows-*.ts by family;
// the pipeline's own (Where-Object, ForEach-Object, Select-Object…) here.
// Get-Help (help, man) shows the game's manual in PowerShell's layout; on
// Linux, man Get-ChildItem shows the same page.
// Sources (Microsoft Learn, PowerShell 5.1, https://learn.microsoft.com/powershell/module/?view=powershell-5.1):
// Microsoft.PowerShell.Core (Where-Object, ForEach-Object, Get-Help,
// Get-Command), Microsoft.PowerShell.Utility (Sort-Object, Select-Object,
// Group-Object, Measure-Object, Format-Table, Format-List, Out-String,
// Write-Output, Write-Host, Get-Member, Get-Date, Read-Host, New-Object,
// Select-String, Get-Alias), about_Automatic_Variables,
// about_Environment_Variables, about_CommonParameters, about_Aliases,
// about_Scripts, about_Execution_Policies (RemoteSigned on Windows Server).
// Differences (docs/SCENARIOS.md): see the "Windows engine" rows.

import type { Shell } from '../shell';
import type { Command } from './index';
import { manualParts } from './manual';
import { CMD_BANNER, currentShell, POWERSHELL_BANNER, resolveWindows, toWindows, windows, type WinShell } from '../windows';
import {
  MethodError, PSDate, PSHashtable, PSScriptBlock, PSSecureString, PSType, arr, compare, errorRecord, isObject, list, outDefault, property, propertyColumns, show, str, table, text, values, wildcard,
  type Cmdlet, type ErrorSpec, type Failure, type Param, type PSObject, type Run, type View,
} from '../powershell';
import { parse, ParseError, type Arg, type Element, type Expr, type FnDef, type Pipeline, type Statement } from '../powershell-parse';
import { scripting } from '../windows-tasks';
import { ENV_HOOK, FILE_CMDLETS, FILE_VIEWS, RENDER, outFile } from './windows-files';
import { SHELL_HOOKS } from './windows-shells';
import { ACL_CMDLETS, ACL_TYPES, ACL_VIEWS } from './windows-acl';
import { ACCOUNT_CMDLETS, ACCOUNT_VIEWS } from './windows-accounts';
import { SERVICE_CMDLETS, SERVICE_VIEWS } from './windows-services';
import { EVENT_CMDLETS, EVENT_VIEWS } from './windows-events';
import { TASK_CMDLETS, TASK_VIEWS } from './windows-tasks';
import { SYSTEM_CMDLETS, SYSTEM_VIEWS } from './windows-system';
import { FIREWALL_CMDLETS, FIREWALL_VIEWS } from './windows-firewall';
import { AD_CMDLETS, AD_VIEWS } from './windows-ad';
import { GPO_CMDLETS, GPO_VIEWS } from './windows-gpo';
import { NATIVES, nativeNamed } from './windows-natives';
import { formatValue, formatDate, parseDate, longDateTime } from './windows-format';

export type { Cmdlet };

const UTIL = 'Microsoft.PowerShell.Utility';
const CORE = 'Microsoft.PowerShell.Core';

// ——— Control flow ———

class Exit {
  constructor(public code: number) {}
}
/**
 * break, continue, return: they unwind to their loop (or switch, or
 * function), carrying what the statements they leave already wrote.
 */
class Flow {
  items: unknown[] = [];
}
class Break extends Flow {}
class Continue extends Flow {}
class Return extends Flow {
  constructor(items: unknown[]) {
    super();
    this.items = items;
  }
}
/**
 * A terminating error. `fatal`: script-terminating (throw, -ErrorAction Stop,
 * $ErrorActionPreference = 'Stop'), which ends the whole line or script
 * unless a try/catch takes it; otherwise statement-terminating (a binding
 * error, a cmdlet's own terminating error): the next statement runs.
 */
class Terminate {
  constructor(
    public record: string,
    public fatal = false,
  ) {}
}
/** A question: the statement waits for the next line, then runs again with the answer. */
class Suspend {
  constructor(
    public prompt: string,
    public lines: string[],
    public secret: boolean,
  ) {}
}

interface Ctx {
  game: Shell;
  // The source (a line, or a script's text) and the script's path.
  source: string;
  file?: string;
  // The screen, in order.
  out: string[];
  // The answers to this statement's questions.
  answers: string[];
  asked: number;
  // $_ and foreach variables.
  frames: Map<string, unknown>[];
  errors: string[];
  commands: string[][];
  script: boolean;
  // Errors of the current pipeline sent elsewhere (2>$null, 2>&1).
  mute: number;
  merged: unknown[] | null;
  ok: boolean;
  // A script's own scope: its variables ($ErrorActionPreference included); `isolated` for a new
  // powershell.exe (a scheduled task), which doesn't see the session's variables.
  scope?: { vars: Record<string, { name: string; value: unknown }>; isolated: boolean; functions?: Record<string, FnDef> };
  // The scopes of the functions being run, innermost last (their parameters and variables).
  locals?: Map<string, { name: string; value: unknown }>[];
  // Loop iterations and function calls on this line (a guard against endless loops).
  budget?: { steps: number; depth: number };
}

/** The loops' guard: past this many iterations on one line, the game stops it. */
const MAX_STEPS = 10_000;
/** Nested function calls (Windows PowerShell stops at its call depth; the game lower). */
const MAX_DEPTH = 100;

// ——— Variables ———

const vars = (game: Shell): Record<string, { name: string; value: unknown }> => (game.state.psVars ??= {});
const errorList = (game: Shell): unknown[] => (game.state.psErrors ??= []);

/** The environment ($env:NAME): the machine's, then the computed ones. */
export function environment(game: Shell): Record<string, string> {
  const w = windows(game);
  const user = game.who === 'SYSTEM' ? `${w.computer}$` : game.who;
  const profile = game.who === 'SYSTEM' ? 'C:\\Windows\\system32\\config\\systemprofile' : `C:\\Users\\${game.who}`;
  return {
    ALLUSERSPROFILE: 'C:\\ProgramData',
    APPDATA: `${profile}\\AppData\\Roaming`,
    COMPUTERNAME: w.computer,
    ComSpec: 'C:\\Windows\\system32\\cmd.exe',
    HOMEDRIVE: 'C:',
    HOMEPATH: profile.slice(2),
    LOCALAPPDATA: `${profile}\\AppData\\Local`,
    NUMBER_OF_PROCESSORS: '2',
    OS: 'Windows_NT',
    Path: 'C:\\Windows\\system32;C:\\Windows;C:\\Windows\\System32\\Wbem;C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\;C:\\Windows\\System32\\OpenSSH\\',
    PATHEXT: '.COM;.EXE;.BAT;.CMD;.VBS;.VBE;.JS;.JSE;.WSF;.WSH;.MSC;.CPL',
    PROCESSOR_ARCHITECTURE: 'AMD64',
    ProgramData: 'C:\\ProgramData',
    ProgramFiles: 'C:\\Program Files',
    'ProgramFiles(x86)': 'C:\\Program Files (x86)',
    PSModulePath: `${profile}\\Documents\\WindowsPowerShell\\Modules;C:\\Program Files\\WindowsPowerShell\\Modules;C:\\Windows\\system32\\WindowsPowerShell\\v1.0\\Modules`,
    PUBLIC: 'C:\\Users\\Public',
    SystemDrive: 'C:',
    SystemRoot: 'C:\\Windows',
    TEMP: `${profile}\\AppData\\Local\\Temp`,
    TMP: `${profile}\\AppData\\Local\\Temp`,
    USERDOMAIN: w.computer,
    USERNAME: user,
    USERPROFILE: profile,
    windir: 'C:\\Windows',
    ...(w.env ?? {}),
  };
}

const envGet = (game: Shell, name: string) => {
  const env = environment(game);
  const k = Object.keys(env).find((x) => x.toLowerCase() === name.toLowerCase());
  return k === undefined ? null : env[k];
};

const VERSION_TABLE = () =>
  new PSHashtable([
    ['PSVersion', '5.1.20348.2700'],
    ['PSEdition', 'Desktop'],
    ['PSCompatibleVersions', ['1.0', '2.0', '3.0', '4.0', '5.0', '5.1.20348.2700']],
    ['BuildVersion', '10.0.20348.2700'],
    ['CLRVersion', '4.0.30319.42000'],
    ['WSManStackVersion', '3.0'],
    ['PSRemotingProtocolVersion', '2.3'],
    ['SerializationVersion', '1.1.0.1'],
  ]);

function getVar(ctx: Ctx, name: string): unknown {
  let low = name.toLowerCase();
  const g = ctx.game;
  if (low.startsWith('env:')) return envGet(g, name.slice(4));
  // $global:x, $script:x, $local:x (about_Scopes).
  const scoped = /^(global|script|local):(.+)$/.exec(low);
  if (scoped?.[1] === 'global') return vars(g)[scoped[2]]?.value ?? getVar({ ...ctx, frames: [], locals: [], scope: undefined }, scoped[2]);
  if (scoped?.[1] === 'script') return (ctx.scope?.vars[scoped[2]] ?? vars(g)[scoped[2]])?.value ?? null;
  if (scoped) low = scoped[2];
  for (let i = ctx.frames.length - 1; i >= 0; i--) if (ctx.frames[i].has(low)) return ctx.frames[i].get(low);
  if (low === 'psitem') return getVar(ctx, '_');
  for (let i = (ctx.locals?.length ?? 0) - 1; i >= 0; i--) {
    const v = ctx.locals![i].get(low);
    if (v) return v.value;
  }
  const local = ctx.scope?.vars[low];
  if (local) return local.value;
  const global = ctx.scope?.isolated ? undefined : vars(g)[low];
  switch (low) {
    case 'true':
      return true;
    case 'false':
      return false;
    case 'null':
      return null;
    case 'home':
      return `C:\\Users\\${g.who}`;
    case 'pwd':
      return { type: 'PathInfo', props: { Path: windows(g).location ?? toWindows(g.cwd) }, text: windows(g).location ?? toWindows(g.cwd) } satisfies PSObject;
    case 'error':
      return [...errorList(g)];
    case '?':
      return g.state.psSuccess ?? true;
    case 'psversiontable':
      return VERSION_TABLE();
    case 'pshome':
      return 'C:\\Windows\\System32\\WindowsPowerShell\\v1.0';
    case 'erroractionpreference':
      return global?.value ?? 'Continue';
    case 'confirmpreference':
      return global?.value ?? 'High';
    case 'host':
      return { type: 'InternalHost', props: { Name: 'ConsoleHost', Version: '5.1.20348.2700' }, text: 'System.Management.Automation.Internal.Host.InternalHost' } satisfies PSObject;
  }
  return global?.value ?? null;
}

function setVar(ctx: Ctx, name: string, value: unknown): void {
  const low = name.toLowerCase();
  if (low.startsWith('env:')) {
    const w = windows(ctx.game);
    const key = name.slice(4);
    w.env ??= {};
    const existing = Object.keys(environment(ctx.game)).find((k) => k.toLowerCase() === key.toLowerCase()) ?? key;
    if (value === null || value === '') delete w.env[existing];
    else w.env[existing] = text(value);
    return;
  }
  const scoped = /^(global|script|local):(.+)$/.exec(low);
  if (scoped?.[1] === 'global') {
    vars(ctx.game)[scoped[2]] = { name: name.slice(7), value };
    return;
  }
  if (scoped?.[1] === 'script') {
    (ctx.scope?.vars ?? vars(ctx.game))[scoped[2]] = { name: name.slice(7), value };
    return;
  }
  if (scoped) return setVar(ctx, name.slice(6), value);
  for (let i = ctx.frames.length - 1; i >= 0; i--)
    if (ctx.frames[i].has(low)) {
      ctx.frames[i].set(low, value);
      return;
    }
  if (['true', 'false', 'null'].includes(low)) throw new Terminate(record(ctx, '', { message: `Cannot overwrite variable ${name} because it is read-only or constant.`, pos: 0, length: 1, category: 'WriteError', target: `${name}:String`, cmdlet: '', exception: 'SessionStateUnauthorizedAccessException', id: 'VariableNotWritable' }));
  // Inside a function, an assignment creates (or changes) the function's own variable.
  if (ctx.locals?.length) ctx.locals.at(-1)!.set(low, { name, value });
  else if (ctx.scope) ctx.scope.vars[low] = { name, value };
  else vars(ctx.game)[low] = { name, value };
}

// ——— Values ———

/** A value's items in a pipeline (an array is enumerated; a hashtable is not). */
const enumerate = (v: unknown): unknown[] => (v === null || v === undefined ? [] : Array.isArray(v) ? v : [v]);
/** A pipeline's output as one value: nothing → $null, one → it, several → an array. */
const collect = (items: unknown[]): unknown => (items.length === 0 ? null : items.length === 1 ? items[0] : items);

export function truthy(v: unknown): boolean {
  if (v === null || v === undefined || v === false || v === 0 || v === '') return false;
  if (Array.isArray(v)) return v.length === 0 ? false : v.length === 1 ? truthy(v[0]) : true;
  return true;
}

/** The .NET type of a value (GetType(), errors). */
export function typeName(v: unknown): string {
  if (v === null || v === undefined) return 'null';
  if (typeof v === 'string') return 'System.String';
  if (typeof v === 'boolean') return 'System.Boolean';
  if (typeof v === 'number') return Number.isInteger(v) ? (Math.abs(v) > 2147483647 ? 'System.Int64' : 'System.Int32') : 'System.Double';
  if (Array.isArray(v)) return 'System.Object[]';
  if (v instanceof PSHashtable) return 'System.Collections.Hashtable';
  if (v instanceof PSDate) return 'System.DateTime';
  if (v instanceof PSScriptBlock) return 'System.Management.Automation.ScriptBlock';
  if (v instanceof PSSecureString) return 'System.Security.SecureString';
  if (v instanceof PSType) return 'System.RuntimeType';
  if (isObject(v)) return v.fullType ?? (v.type === 'PSCustomObject' || v.type.startsWith('Selected.') ? 'System.Management.Automation.PSCustomObject' : v.type);
  return 'System.Object';
}

const TYPE_ALIASES: Record<string, string> = {
  int: 'System.Int32', int32: 'System.Int32', long: 'System.Int64', int64: 'System.Int64', uint32: 'System.UInt32', byte: 'System.Byte', double: 'System.Double', float: 'System.Single', single: 'System.Single', decimal: 'System.Decimal',
  string: 'System.String', bool: 'System.Boolean', boolean: 'System.Boolean', datetime: 'System.DateTime', array: 'System.Array', 'object[]': 'System.Object[]', object: 'System.Object', hashtable: 'System.Collections.Hashtable',
  pscustomobject: 'System.Management.Automation.PSCustomObject', psobject: 'System.Management.Automation.PSObject', scriptblock: 'System.Management.Automation.ScriptBlock', securestring: 'System.Security.SecureString',
  math: 'System.Math', environment: 'System.Environment', 'string[]': 'System.String[]', 'int[]': 'System.Int32[]', timespan: 'System.TimeSpan', regex: 'System.Text.RegularExpressions.Regex',
};
const typeFull = (name: string): string | null => {
  const low = name.toLowerCase().replace(/^system\./, '');
  return TYPE_ALIASES[low] ?? (Object.values(TYPE_ALIASES).find((v) => v.toLowerCase() === name.toLowerCase()) ?? null);
};

/** A conversion error (Cannot convert value "x" to type "System.Int32"…). */
const conversion = (v: unknown, to: string): Failure => ({
  message: `Cannot convert value "${text(v)}" to type "${to}". Error: "Input string was not in a correct format."`,
  category: 'InvalidArgument',
  target: ':',
  exception: 'RuntimeException',
  id: 'InvalidCastFromStringToInteger',
});

function toNumber(v: unknown): number | null {
  if (typeof v === 'number') return v;
  if (typeof v === 'boolean') return v ? 1 : 0;
  if (v === null || v === undefined) return 0;
  if (v instanceof PSDate) return null;
  const t = text(v).trim();
  if (/^-?0x[0-9a-f]+$/i.test(t)) return parseInt(t, 16);
  const m = /^(-?[\d.]+(?:e[+-]?\d+)?)(kb|mb|gb|tb)?$/i.exec(t);
  if (!m || Number.isNaN(Number(m[1]))) return null;
  return Number(m[1]) * ({ kb: 1024, mb: 1024 ** 2, gb: 1024 ** 3, tb: 1024 ** 4 } as Record<string, number>)[m[2]?.toLowerCase() ?? ''] || Number(m[1]);
}

/** Rounding to an integer as .NET does it (to even). */
const toEven = (n: number) => {
  const r = Math.round(n);
  return Math.abs(n % 1) === 0.5 && r % 2 !== 0 ? r - 1 : r;
};

/** A cast ([int]"5", [datetime]"2029-11-20"), or an error. */
function convert(ctx: Ctx, v: unknown, type: string, pos: number): unknown {
  const full = typeFull(type);
  if (!full) throw new Terminate(record(ctx, '', { message: `Unable to find type [${type}].`, pos, length: type.length + 2, category: 'InvalidOperation', target: `${type}:TypeName`, cmdlet: '', exception: 'RuntimeException', id: 'TypeNotFound' }));
  const fail = (): never => {
    const f = conversion(v, full);
    throw new Terminate(record(ctx, '', { ...f, pos, length: type.length + 2, cmdlet: '' }));
  };
  switch (full) {
    case 'System.Int32':
    case 'System.Int64':
    case 'System.UInt32':
    case 'System.Byte': {
      const n = toNumber(v);
      return n === null ? fail() : toEven(n);
    }
    case 'System.Double':
    case 'System.Single':
    case 'System.Decimal': {
      const n = toNumber(v);
      return n === null ? fail() : n;
    }
    case 'System.String':
      return v === null ? '' : text(v);
    case 'System.Boolean':
      return truthy(v);
    case 'System.DateTime': {
      if (v instanceof PSDate) return v;
      const ms = parseDate(text(v), DATES.today);
      return ms === null ? fail() : new PSDate(ms);
    }
    case 'System.Array':
    case 'System.Object[]':
      return enumerate(v);
    case 'System.String[]':
      return enumerate(v).map(text);
    case 'System.Int32[]':
      return enumerate(v).map((x) => toEven(toNumber(x) ?? 0));
    case 'System.Management.Automation.PSCustomObject':
      if (v instanceof PSHashtable) return { type: 'PSCustomObject', props: Object.fromEntries(v.entries()) } satisfies PSObject;
      return v;
    case 'System.Collections.Hashtable':
      if (v instanceof PSHashtable) return v;
      return fail();
    case 'System.Management.Automation.ScriptBlock':
      return v instanceof PSScriptBlock ? v : fail();
    case 'System.Security.SecureString':
      return v instanceof PSSecureString ? v : fail();
  }
  return v;
}

/** -is / -as: does the value have this type? */
function isType(v: unknown, type: string): boolean {
  const full = typeFull(type) ?? type;
  const actual = typeName(v);
  if (full === 'System.Object') return v !== null;
  if (full === 'System.Array' || full === 'System.Object[]') return Array.isArray(v);
  return actual.toLowerCase() === full.toLowerCase();
}

// ——— Operators ———

const BASE_OPS = new Set(['eq', 'ne', 'gt', 'ge', 'lt', 'le', 'like', 'notlike', 'match', 'notmatch', 'contains', 'notcontains', 'in', 'notin', 'replace', 'split', 'join', 'is', 'isnot']);

function compareOp(op: string, a: unknown, b: unknown): unknown {
  // -c… is case-sensitive, -i… (and the plain form) is not.
  let base = op;
  let sensitive = false;
  if (!BASE_OPS.has(op) && op.startsWith('c') && BASE_OPS.has(op.slice(1))) {
    base = op.slice(1);
    sensitive = true;
  } else if (!BASE_OPS.has(op) && op.startsWith('i') && BASE_OPS.has(op.slice(1))) base = op.slice(1);
  const cmp = (x: unknown, y: unknown) => (sensitive && typeof x === 'string' ? (String(x) === String(y) ? 0 : String(x) < String(y) ? -1 : 1) : compare(x, typeof x === 'number' && typeof y === 'string' ? (toNumber(y) ?? y) : y));
  const scalar = (x: unknown): boolean => {
    switch (base) {
      case 'eq':
        return cmp(x, b) === 0;
      case 'ne':
        return cmp(x, b) !== 0;
      case 'gt':
        return x !== null && x !== undefined && cmp(x, b) > 0;
      case 'ge':
        return x !== null && x !== undefined && cmp(x, b) >= 0;
      case 'lt':
        return cmp(x, b) < 0;
      case 'le':
        return cmp(x, b) <= 0;
      case 'like':
        return (sensitive ? new RegExp(wildcard(text(b)).source) : wildcard(text(b))).test(text(x));
      case 'notlike':
        return !(sensitive ? new RegExp(wildcard(text(b)).source) : wildcard(text(b))).test(text(x));
      case 'match':
        return new RegExp(text(b), sensitive ? '' : 'i').test(text(x));
      case 'notmatch':
        return !new RegExp(text(b), sensitive ? '' : 'i').test(text(x));
    }
    return false;
  };
  switch (base) {
    case 'contains':
      return enumerate(a).some((x) => compare(x, b) === 0);
    case 'notcontains':
      return !enumerate(a).some((x) => compare(x, b) === 0);
    case 'in':
      return enumerate(b).some((x) => compare(a, x) === 0);
    case 'notin':
      return !enumerate(b).some((x) => compare(a, x) === 0);
    case 'replace': {
      const [pattern, by] = Array.isArray(b) ? [text(b[0]), text(b[1] ?? '')] : [text(b), ''];
      const re = new RegExp(pattern, sensitive ? 'g' : 'gi');
      const one = (x: unknown) => text(x).replace(re, by.replace(/\$(\d)/g, '$$$1'));
      return Array.isArray(a) ? a.map(one) : one(a);
    }
    case 'split':
      return enumerate(a).flatMap((x) => text(x).split(new RegExp(text(b), sensitive ? '' : 'i')));
    case 'join':
      return enumerate(a).map(text).join(text(b));
    case 'is':
      return isType(a, b instanceof PSType ? b.name : text(b));
    case 'isnot':
      return !isType(a, b instanceof PSType ? b.name : text(b));
  }
  if (Array.isArray(a)) return a.filter((x) => scalar(x));
  if (base === 'match' || base === 'notmatch') {
    const m = new RegExp(text(b), sensitive ? '' : 'i').exec(text(a));
    if (m) lastMatches = new PSHashtable(m.map((g, i) => [String(i), g]));
  }
  return scalar(a);
}
let lastMatches: PSHashtable | null = null;

function arithmetic(ctx: Ctx, op: string, a: unknown, b: unknown, pos: number): unknown {
  if (op === '+') {
    if (Array.isArray(a)) return [...a, ...enumerate(b)];
    if (typeof a === 'string') return a + text(b);
    if (a instanceof PSHashtable && b instanceof PSHashtable) return new PSHashtable([...a.entries(), ...b.entries()]);
    if (a instanceof PSDate && isObject(b) && b.type === 'TimeSpan') return new PSDate(a.ms + (b.props.TotalMilliseconds as number));
  }
  if (op === '-' && a instanceof PSDate && b instanceof PSDate) return timeSpan(a.ms - b.ms);
  if (op === '-' && a instanceof PSDate && isObject(b) && b.type === 'TimeSpan') return new PSDate(a.ms - (b.props.TotalMilliseconds as number));
  if (op === '*' && typeof a === 'string') return a.repeat(Math.max(0, toNumber(b) ?? 0));
  if (op === '*' && Array.isArray(a)) return Array.from({ length: Math.max(0, toNumber(b) ?? 0) }, () => a).flat();
  const x = toNumber(a);
  const y = toNumber(b);
  if (x === null || y === null) {
    const bad = x === null ? a : b;
    throw new Terminate(record(ctx, '', { message: `Cannot convert value "${text(bad)}" to type "System.Int32". Error: "Input string was not in a correct format."`, pos, length: 1, category: 'InvalidArgument', target: ':', cmdlet: '', exception: 'RuntimeException', id: 'InvalidCastFromStringToInteger' }));
  }
  if (op === '/' && y === 0) throw new Terminate(record(ctx, '', { message: 'Attempted to divide by zero.', pos, length: 1, category: 'NotSpecified', target: ':', cmdlet: '', exception: 'RuntimeException', id: 'RuntimeException' }));
  switch (op) {
    case '+':
      return x + y;
    case '-':
      return x - y;
    case '*':
      return x * y;
    case '/':
      return x / y;
    case '%':
      return x % y;
  }
  return null;
}

/** A TimeSpan ((Get-Date) - $date). */
export function timeSpan(ms: number): PSObject {
  const abs = Math.abs(ms);
  const sign = ms < 0 ? -1 : 1;
  const days = Math.floor(abs / 86_400_000);
  const rest = abs % 86_400_000;
  return {
    type: 'TimeSpan',
    fullType: 'System.TimeSpan',
    props: {
      Days: sign * days,
      Hours: sign * Math.floor(rest / 3_600_000),
      Minutes: sign * Math.floor((rest % 3_600_000) / 60_000),
      Seconds: sign * Math.floor((rest % 60_000) / 1000),
      Milliseconds: sign * (rest % 1000),
      Ticks: ms * 10_000,
      TotalDays: ms / 86_400_000,
      TotalHours: ms / 3_600_000,
      TotalMinutes: ms / 60_000,
      TotalSeconds: ms / 1000,
      TotalMilliseconds: ms,
    },
    text: `${ms < 0 ? '-' : ''}${days ? `${days}.` : ''}${[Math.floor(rest / 3_600_000), Math.floor((rest % 3_600_000) / 60_000), Math.floor((rest % 60_000) / 1000)].map((n) => String(n).padStart(2, '0')).join(':')}`,
  };
}

// ——— Members and methods ———

function getMember(ctx: Ctx, obj: unknown, name: string): unknown {
  if (obj instanceof PSType) return staticMember(ctx, obj.name, name, null, 0);
  if (Array.isArray(obj) && !/^(count|length|rank)$/i.test(name)) {
    // Member enumeration: (Get-Service).Name
    const vals = obj.map((x) => getMember(ctx, x, name)).filter((x) => x !== null && x !== undefined);
    return vals.length ? vals.flat() : null;
  }
  if (Array.isArray(obj)) return obj.length;
  if (obj instanceof PSHashtable) {
    if (obj.has(name)) return obj.get(name);
    if (/^count$/i.test(name)) return obj.map.size;
    if (/^keys$/i.test(name)) return obj.keys();
    if (/^values$/i.test(name)) return obj.entries().map(([, v]) => v);
    return null;
  }
  if (obj instanceof PSSecureString) return /^length$/i.test(name) ? obj.plain.length : null;
  const v = property(obj, name);
  return v === undefined ? null : v;
}

function setMember(obj: unknown, name: string, value: unknown): boolean {
  if (obj instanceof PSHashtable) {
    obj.set(name, value);
    return true;
  }
  if (isObject(obj)) {
    const key = Object.keys(obj.props).find((k) => k.toLowerCase() === name.toLowerCase());
    if (key === undefined) return false;
    obj.props[key] = value;
    return true;
  }
  return false;
}

const methodMissing = (ctx: Ctx, obj: unknown, name: string, pos: number): never => {
  throw new Terminate(record(ctx, '', { message: `Method invocation failed because [${typeName(obj)}] does not contain a method named '${name}'.`, pos, length: name.length, category: 'InvalidOperation', target: ':', cmdlet: '', exception: 'RuntimeException', id: 'MethodNotFound' }));
};

function callMethod(ctx: Ctx, obj: unknown, name: string, args: unknown[], pos: number): unknown {
  const low = name.toLowerCase();
  if (obj === null || obj === undefined)
    throw new Terminate(record(ctx, '', { message: 'You cannot call a method on a null-valued expression.', pos, length: name.length, category: 'InvalidOperation', target: ':', cmdlet: '', exception: 'RuntimeException', id: 'InvokeMethodOnNull' }));
  if (obj instanceof PSType) return staticMember(ctx, obj.name, name, args, pos);
  if (low === 'gettype')
    return { type: 'RuntimeType', props: { IsPublic: true, IsSerial: true, Name: typeName(obj).split('.').at(-1), BaseType: Array.isArray(obj) ? 'System.Array' : 'System.Object' }, text: typeName(obj) } satisfies PSObject;
  if (low === 'tostring') {
    if (obj instanceof PSDate && args.length) return formatDate(obj.ms, text(args[0]));
    if (typeof obj === 'number' && args.length) return formatValue(obj, text(args[0]));
    return text(obj);
  }
  if (low === 'equals') return compare(obj, args[0]) === 0;
  if (typeof obj === 'string') {
    const a = args.map(text);
    switch (low) {
      case 'toupper':
        return obj.toUpperCase();
      case 'tolower':
        return obj.toLowerCase();
      case 'trim':
        return a.length ? obj.replace(new RegExp(`^[${a[0].replace(/[\]\\^-]/g, '\\$&')}]+|[${a[0].replace(/[\]\\^-]/g, '\\$&')}]+$`, 'g'), '') : obj.trim();
      case 'trimstart':
        return obj.trimStart();
      case 'trimend':
        return a.length ? obj.replace(new RegExp(`[${a[0].replace(/[\]\\^-]/g, '\\$&')}]+$`), '') : obj.trimEnd();
      case 'split':
        return obj.split(new RegExp(`[${(a[0] ?? ' ').replace(/[\]\\^-]/g, '\\$&')}]`));
      case 'replace':
        return obj.split(a[0]).join(a[1] ?? '');
      case 'contains':
        return obj.includes(a[0]);
      case 'startswith':
        return obj.startsWith(a[0]);
      case 'endswith':
        return obj.endsWith(a[0]);
      case 'substring':
        return args.length > 1 ? obj.substr(toNumber(args[0]) ?? 0, toNumber(args[1]) ?? 0) : obj.slice(toNumber(args[0]) ?? 0);
      case 'indexof':
        return obj.indexOf(a[0]);
      case 'padleft':
        return obj.padStart(toNumber(args[0]) ?? 0, a[1] ?? ' ');
      case 'padright':
        return obj.padEnd(toNumber(args[0]) ?? 0, a[1] ?? ' ');
    }
    return methodMissing(ctx, obj, name, pos);
  }
  if (obj instanceof PSDate) {
    const n = toNumber(args[0]) ?? 0;
    const add: Record<string, number> = { adddays: 86_400_000, addhours: 3_600_000, addminutes: 60_000, addseconds: 1000, addmilliseconds: 1 };
    if (add[low]) return new PSDate(obj.ms + n * add[low]);
    if (low === 'addmonths' || low === 'addyears') {
      const d = new Date(obj.ms);
      if (low === 'addmonths') d.setUTCMonth(d.getUTCMonth() + n);
      else d.setUTCFullYear(d.getUTCFullYear() + n);
      return new PSDate(d.getTime());
    }
    if (low === 'subtract' && args[0] instanceof PSDate) return timeSpan(obj.ms - args[0].ms);
    return methodMissing(ctx, obj, name, pos);
  }
  if (obj instanceof PSHashtable) {
    switch (low) {
      case 'containskey':
        return obj.has(text(args[0]));
      case 'add':
        if (obj.has(text(args[0]))) throw new Terminate(record(ctx, '', { message: `Exception calling "Add" with "2" argument(s): "Item has already been added. Key in dictionary: '${text(args[0])}'  Key being added: '${text(args[0])}'"`, pos, length: name.length, category: 'NotSpecified', target: ':', cmdlet: '', exception: 'MethodInvocationException', id: 'ArgumentException' }));
        obj.set(text(args[0]), args[1]);
        return null;
      case 'remove':
        obj.map.delete(text(args[0]).toLowerCase());
        return null;
    }
    return methodMissing(ctx, obj, name, pos);
  }
  if (Array.isArray(obj)) {
    if (low === 'contains') return obj.some((x) => compare(x, args[0]) === 0);
    if (low === 'indexof') return obj.findIndex((x) => compare(x, args[0]) === 0);
    return methodMissing(ctx, obj, name, pos);
  }
  if (isObject(obj) && obj.methods?.[low]) {
    try {
      return obj.methods[low](args);
    } catch (e) {
      if (e instanceof MethodError) throw new Terminate(record(ctx, '', { message: `Exception calling "${name}" with "${args.length}" argument(s): "${e.message}"`, pos, length: name.length, category: 'NotSpecified', target: ':', cmdlet: '', exception: 'MethodInvocationException', id: e.id }));
      throw e;
    }
  }
  return methodMissing(ctx, obj, name, pos);
}


function staticMember(ctx: Ctx, type: string, name: string, args: unknown[] | null, pos: number): unknown {
  const full = typeFull(type) ?? type;
  const low = name.toLowerCase();
  const n = (i: number) => toNumber(args?.[i]) ?? 0;
  if (full === 'System.Math') {
    switch (low) {
      case 'round': {
        const d = args && args.length > 1 ? n(1) : 0;
        const f = 10 ** d;
        return toEven(n(0) * f) / f;
      }
      case 'floor':
        return Math.floor(n(0));
      case 'ceiling':
        return Math.ceil(n(0));
      case 'abs':
        return Math.abs(n(0));
      case 'max':
        return Math.max(n(0), n(1));
      case 'min':
        return Math.min(n(0), n(1));
      case 'pow':
        return n(0) ** n(1);
      case 'sqrt':
        return Math.sqrt(n(0));
      case 'pi':
        return Math.PI;
    }
  }
  if (full === 'System.DateTime') {
    const clock = windows(ctx.game).clock;
    if (low === 'now') return new PSDate(clock);
    if (low === 'today') return new PSDate(Math.floor(clock / 86_400_000) * 86_400_000);
    if (low === 'parse') {
      const ms = parseDate(text(args?.[0]));
      if (ms !== null) return new PSDate(ms);
    }
  }
  if (full === 'System.String') {
    if (low === 'isnullorempty') return args?.[0] === null || args?.[0] === undefined || text(args[0]) === '';
    if (low === 'isnullorwhitespace') return text(args?.[0] ?? '').trim() === '';
    if (low === 'join') return enumerate(args?.slice(1).length === 1 ? args[1] : args?.slice(1)).map(text).join(text(args?.[0]));
    if (low === 'empty') return '';
  }
  if (full === 'System.Environment') {
    if (low === 'machinename') return windows(ctx.game).computer;
    if (low === 'username') return ctx.game.who;
    if (low === 'newline') return '\r\n';
    if (low === 'osversion') return 'Microsoft Windows NT 10.0.20348.0';
  }
  if (full === 'System.Int32' && low === 'maxvalue') return 2147483647;
  if (args === null) return null;
  throw new Terminate(record(ctx, '', { message: `Method invocation failed because [${full}] does not contain a method named '${name}'.`, pos, length: name.length, category: 'InvalidOperation', target: ':', cmdlet: '', exception: 'RuntimeException', id: 'MethodNotFound' }));
}

// ——— Evaluation ———

function evalExpr(ctx: Ctx, e: Expr): unknown {
  switch (e.k) {
    case 'num':
      return e.v;
    case 'str':
      return e.v;
    case 'xstr':
      return e.parts.map((p) => (typeof p === 'string' ? p : text(evalExpr(ctx, p)))).join('');
    case 'var':
      if (e.name.toLowerCase() === 'matches') return lastMatches;
      return getVar(ctx, e.name);
    case 'arr':
      return e.items.map((x) => evalExpr(ctx, x));
    case 'sub': {
      const items = e.body.flatMap((s) => runStatement(ctx, s));
      return e.array ? items : collect(items);
    }
    case 'paren':
      return collect(runStatement(ctx, e.body));
    case 'hash': {
      const h = new PSHashtable();
      for (const { key, value } of e.entries) h.set(text(evalExpr(ctx, key)), collect(runStatement(ctx, value)));
      return h;
    }
    case 'block':
      return new PSScriptBlock(e.body, e.text);
    case 'member': {
      const obj = evalExpr(ctx, e.obj);
      const name = text(evalExpr(ctx, e.name));
      if (e.isStatic) return staticMember(ctx, (obj as PSType).name ?? text(obj), name, null, 0);
      return getMember(ctx, obj, name);
    }
    case 'call': {
      const obj = evalExpr(ctx, e.obj);
      const args = e.args.map((a) => evalExpr(ctx, a));
      if (e.isStatic) return staticMember(ctx, obj instanceof PSType ? obj.name : text(obj), e.name, args, 0);
      return callMethod(ctx, obj, e.name, args, 0);
    }
    case 'index': {
      const obj = evalExpr(ctx, e.obj);
      const idx = evalExpr(ctx, e.index);
      if (obj instanceof PSHashtable) return obj.get(text(idx)) ?? null;
      if (obj === null || obj === undefined) throw new Terminate(record(ctx, '', { message: 'Cannot index into a null array.', pos: 0, length: 1, category: 'InvalidOperation', target: ':', cmdlet: '', exception: 'RuntimeException', id: 'NullArray' }));
      const list = typeof obj === 'string' ? [...obj] : enumerate(obj);
      const one = (i: unknown) => {
        const n = toNumber(i) ?? 0;
        return list[n < 0 ? list.length + n : n] ?? null;
      };
      return Array.isArray(idx) ? idx.map(one) : one(idx);
    }
    case 'type':
      return new PSType(e.name);
    case 'cast':
      return convert(ctx, evalExpr(ctx, e.e), e.type, 0);
    case 'unary': {
      const v = evalExpr(ctx, e.e);
      if (e.op === 'not') return !truthy(v);
      if (e.op === 'join') return enumerate(v).map(text).join('');
      if (e.op === 'split') return text(v).trim().split(/\s+/);
      const n = toNumber(v);
      return n === null ? arithmetic(ctx, '-', 0, v, 0) : -n;
    }
    case 'range': {
      const a = toNumber(evalExpr(ctx, e.from)) ?? 0;
      const b = toNumber(evalExpr(ctx, e.to)) ?? 0;
      const out: number[] = [];
      for (let i = a; a <= b ? i <= b : i >= b; a <= b ? i++ : i--) out.push(i);
      return out;
    }
    case 'bin': {
      if (e.op === 'and') return truthy(evalExpr(ctx, e.l)) && truthy(evalExpr(ctx, e.r));
      if (e.op === 'or') return truthy(evalExpr(ctx, e.l)) || truthy(evalExpr(ctx, e.r));
      const l = evalExpr(ctx, e.l);
      const r = evalExpr(ctx, e.r);
      if (e.op === 'xor') return truthy(l) !== truthy(r);
      if (['+', '-', '*', '/', '%'].includes(e.op)) return arithmetic(ctx, e.op, l, r, e.pos);
      if (e.op === 'f') return formatString(text(l), enumerate(r));
      if (e.op === 'band') return (toNumber(l) ?? 0) & (toNumber(r) ?? 0);
      if (e.op === 'bor') return (toNumber(l) ?? 0) | (toNumber(r) ?? 0);
      if (e.op === 'bxor') return (toNumber(l) ?? 0) ^ (toNumber(r) ?? 0);
      if (e.op === 'as') {
        try {
          return convert(ctx, l, r instanceof PSType ? r.name : text(r), e.pos);
        } catch {
          return null;
        }
      }
      return compareOp(e.op, l, r);
    }
  }
}

/** The -f operator: "{0} {1:N2} {2,-10}" -f a, b, c. */
export function formatString(format: string, args: unknown[]): string {
  return format.replace(/\{\{|\}\}|\{(\d+)(?:,(-?\d+))?(?::([^}]*))?\}/g, (m, i, width, spec) => {
    if (m === '{{') return '{';
    if (m === '}}') return '}';
    const v = args[Number(i)];
    let s = spec ? (v instanceof PSDate ? formatDate(v.ms, spec) : formatValue(v, spec)) : text(v);
    if (width) s = Number(width) < 0 ? s.padEnd(-Number(width)) : s.padStart(Number(width));
    return s;
  });
}

// ——— Statements ———

function runStatement(ctx: Ctx, st: Statement): unknown[] {
  switch (st.k) {
    case 'pipe':
      return runPipeline(ctx, st.p);
    case 'assign': {
      let value = collect(runStatement(ctx, st.value));
      const t = st.target;
      const current = () => evalExpr(ctx, t);
      if (st.op === '+=') value = arithmetic(ctx, '+', current() ?? (Array.isArray(value) ? [] : typeof value === 'string' ? '' : 0), value, st.pos);
      if (st.op === '-=') value = arithmetic(ctx, '-', current(), value, st.pos);
      if (st.op === '*=') value = arithmetic(ctx, '*', current(), value, st.pos);
      if (st.op === '/=') value = arithmetic(ctx, '/', current(), value, st.pos);
      if (t.k === 'var') setVar(ctx, t.name, value);
      else if (t.k === 'member') {
        const obj = evalExpr(ctx, t.obj);
        if (!setMember(obj, text(evalExpr(ctx, t.name)), value))
          throw new Terminate(record(ctx, '', { message: `The property '${text(evalExpr(ctx, t.name))}' cannot be found on this object. Verify that the property exists and can be set.`, pos: st.pos, length: 1, category: 'InvalidOperation', target: ':', cmdlet: '', exception: 'RuntimeException', id: 'PropertyAssignmentException' }));
      } else if (t.k === 'index') {
        const obj = evalExpr(ctx, t.obj);
        const idx = evalExpr(ctx, t.index);
        if (obj instanceof PSHashtable) obj.set(text(idx), value);
        else if (Array.isArray(obj)) obj[toNumber(idx) ?? 0] = value;
      }
      return [];
    }
    case 'if': {
      for (const c of st.clauses) if (truthy(collect(runStatement(ctx, c.cond)))) return runBody(ctx, c.body);
      return st.otherwise ? runBody(ctx, st.otherwise) : [];
    }
    case 'foreach': {
      const out: unknown[] = [];
      const frame = new Map<string, unknown>();
      ctx.frames.push(frame);
      try {
        for (const item of enumerate(collect(runStatement(ctx, st.source)))) {
          frame.set(st.name.toLowerCase(), item);
          if (iteration(ctx, st.body, out)) break;
        }
      } finally {
        ctx.frames.pop();
      }
      // The loop variable stays set after the loop, as in PowerShell.
      if (frame.has(st.name.toLowerCase())) setVar(ctx, st.name, frame.get(st.name.toLowerCase()));
      return out;
    }
    case 'while': {
      const out: unknown[] = [];
      while (truthy(collect(runStatement(ctx, st.cond)))) if (iteration(ctx, st.body, out)) break;
      return out;
    }
    case 'do': {
      const out: unknown[] = [];
      for (;;) {
        if (iteration(ctx, st.body, out)) break;
        const c = truthy(collect(runStatement(ctx, st.cond)));
        if (st.until ? c : !c) break;
      }
      return out;
    }
    case 'for': {
      const out: unknown[] = [];
      if (st.init) runStatement(ctx, st.init);
      while (!st.cond || truthy(collect(runStatement(ctx, st.cond)))) {
        if (iteration(ctx, st.body, out)) break;
        if (st.step) runStatement(ctx, st.step);
      }
      return out;
    }
    case 'switch':
      return runSwitch(ctx, st);
    case 'break':
      throw new Break();
    case 'continue':
      throw new Continue();
    case 'return':
      throw new Return(st.e ? enumerate(evalExpr(ctx, st.e)) : []);
    case 'function':
      defineFunction(ctx, st.def);
      return [];
    case 'exit': {
      const v = st.e ? evalExpr(ctx, st.e) : 0;
      throw new Exit(toNumber(v) ?? 0);
    }
    case 'throw': {
      const v = st.e ? evalExpr(ctx, st.e) : 'ScriptHalted';
      const message = text(v);
      throw new Terminate(record(ctx, '', { message, pos: st.pos, length: 5, category: 'OperationStopped', target: `${message}:String`, cmdlet: '', exception: 'RuntimeException', id: message }, true), true);
    }
    case 'try':
      return runTry(ctx, st);
  }
}

/** Statements in order, their output together; a break, continue or return carries what came before it. */
function runBody(ctx: Ctx, body: Statement[]): unknown[] {
  const out: unknown[] = [];
  try {
    for (const s of body) out.push(...runStatement(ctx, s));
  } catch (e) {
    if (e instanceof Flow) e.items.unshift(...out);
    throw e;
  }
  return out;
}

/** The guard against endless loops (a line that never ends would freeze the page). */
function tick(ctx: Ctx): void {
  const b = (ctx.budget ??= { steps: 0, depth: 0 });
  if (++b.steps > MAX_STEPS) throw new Terminate(ctx.game.t('powershell-loop-limit', { count: String(MAX_STEPS) }), true);
}

/** A loop's body once: true when a break ends the loop (continue goes on). */
function iteration(ctx: Ctx, body: Statement[], out: unknown[]): boolean {
  tick(ctx);
  try {
    out.push(...runBody(ctx, body));
  } catch (e) {
    if (e instanceof Break || e instanceof Continue) {
      out.push(...e.items);
      return e instanceof Break;
    }
    if (e instanceof Flow) e.items.unshift(...out);
    throw e;
  }
  return false;
}

/**
 * switch (about_Switch): each value of the subject (an array is taken item
 * by item) against each clause in order, $_ the value; every clause that
 * matches runs (not only the first); default only when none did; break
 * leaves the switch, continue goes to the next value. A value pattern is
 * compared like -eq (-like with -Wildcard, -match with -Regex, which sets
 * $Matches); a script block pattern is a condition.
 */
function runSwitch(ctx: Ctx, st: Extract<Statement, { k: 'switch' }>): unknown[] {
  const subject = runStatement(ctx, st.subject);
  const out: unknown[] = [];
  const frame = new Map<string, unknown>();
  ctx.frames.push(frame);
  try {
    for (const v of subject.length ? subject : [null]) {
      frame.set('_', v);
      let matched = false;
      const run = (body: Statement[]): 'break' | 'continue' | null => {
        try {
          out.push(...runBody(ctx, body));
        } catch (e) {
          if (e instanceof Break || e instanceof Continue) {
            out.push(...e.items);
            return e instanceof Break ? 'break' : 'continue';
          }
          if (e instanceof Flow) e.items.unshift(...out);
          throw e;
        }
        return null;
      };
      let flow: 'break' | 'continue' | null = null;
      for (const c of st.clauses) {
        if (c.pattern === null) continue;
        let hit: boolean;
        if (c.pattern.k === 'block') hit = truthy(collect(runBody(ctx, c.pattern.body)));
        else {
          const pv = evalExpr(ctx, c.pattern);
          if (st.regex) {
            const m = new RegExp(text(pv), st.sensitive ? '' : 'i').exec(text(v));
            hit = !!m;
            if (m) lastMatches = new PSHashtable(m.map((g, i) => [String(i), g]));
          } else if (st.wildcard) hit = (st.sensitive ? new RegExp(wildcard(text(pv)).source) : wildcard(text(pv))).test(text(v));
          else hit = truthy(compareOp(st.sensitive ? 'ceq' : 'eq', v, pv));
        }
        if (!hit) continue;
        matched = true;
        flow = run(c.body);
        if (flow) break;
      }
      if (!matched && !flow) {
        const d = st.clauses.find((c) => c.pattern === null);
        if (d) flow = run(d.body);
      }
      if (flow === 'break') break;
    }
  } finally {
    ctx.frames.pop();
  }
  return out;
}

/**
 * try/catch/finally (about_Try_Catch_Finally): a terminating error in the
 * try block runs the first catch whose type matches (or a catch without
 * type), with the error record in $_; a non-terminating error isn't caught
 * (hence -ErrorAction Stop); finally always runs.
 */
function runTry(ctx: Ctx, st: Extract<Statement, { k: 'try' }>): unknown[] {
  const out: unknown[] = [];
  const all = (body: Statement[]) => {
    for (const s of body) out.push(...runStatement(ctx, s));
  };
  try {
    all(st.body);
  } catch (e) {
    if (e instanceof Suspend) throw e;
    if (e instanceof Flow) {
      e.items.unshift(...out);
      if (st.final) all(st.final);
      throw e;
    }
    if (!(e instanceof Terminate) || !e.record) {
      if (st.final) all(st.final);
      throw e;
    }
    const rec = errorRecordObject(e.record);
    const exception = String((rec.props.Exception as PSObject).fullType ?? '').replace(/^System\./, '').toLowerCase();
    const matches = (type: string) => {
      const low = type.toLowerCase().replace(/^system\./, '');
      return ['exception', 'systemexception', 'management.automation.runtimeexception', 'management.automation.actionpreferencestopexception'].includes(low) || low === exception || low.split('.').at(-1) === exception.split('.').at(-1);
    };
    const handler = st.catches.find((c) => !c.types.length || c.types.some(matches));
    if (!handler) {
      if (st.final) all(st.final);
      throw e;
    }
    errorList(ctx.game).unshift(rec.text);
    const frame = new Map<string, unknown>([['_', rec]]);
    ctx.frames.push(frame);
    try {
      all(handler.body);
    } catch (inner) {
      if (st.final && !(inner instanceof Suspend)) all(st.final);
      throw inner;
    } finally {
      ctx.frames.pop();
    }
    if (st.final) all(st.final);
    return out;
  }
  if (st.final) all(st.final);
  return out;
}

/** An error record as an object ($_ in a catch block): its message, exception and ids. */
function errorRecordObject(rec: string): PSObject {
  const lines = rec.split('\n');
  const message = lines[0].replace(/^[^:'"]+ : /, '');
  const category = (lines.find((l) => l.includes('+ CategoryInfo')) ?? '').replace(/^.*?: /, '');
  const exception = /\], (\w+)\s*$/.exec(category)?.[1] ?? 'RuntimeException';
  const id = (lines.find((l) => l.includes('+ FullyQualifiedErrorId')) ?? '').replace(/^.*?: /, '').trim();
  const ns = /^(RuntimeException|ActionPreferenceStopException|ParameterBindingException|CommandNotFoundException|ItemNotFoundException)$/.test(exception) ? 'System.Management.Automation' : exception === 'IOException' || exception === 'DirectoryNotFoundException' ? 'System.IO' : 'System';
  return {
    type: 'ErrorRecord',
    fullType: 'System.Management.Automation.ErrorRecord',
    text: message,
    props: {
      Exception: { type: 'Exception', fullType: `${ns}.${exception}`, text: `${ns}.${exception}: ${message}`, props: { Message: message } },
      CategoryInfo: category,
      FullyQualifiedErrorId: id,
      TargetObject: '',
    },
  };
}

function runBlock(ctx: Ctx, block: PSScriptBlock, item?: unknown): unknown[] {
  const frame = new Map<string, unknown>([['_', item]]);
  ctx.frames.push(frame);
  try {
    return runBody(ctx, block.body);
  } catch (e) {
    // return leaves the script block (in ForEach-Object: the next item).
    if (e instanceof Return) return e.items;
    throw e;
  } finally {
    ctx.frames.pop();
  }
}

/** An error record in 5.1's layout, at the position of `pos` in the source. */
function record(ctx: Ctx, invocation: string, e: ErrorSpec, thrown = false): string {
  const before = ctx.source.slice(0, e.pos);
  const lineNo = before.split('\n').length;
  const lineStart = before.lastIndexOf('\n') + 1;
  const lineText = ctx.source.split('\n')[lineNo - 1] ?? '';
  const col = e.pos - lineStart;
  const where = ctx.file ? `At ${ctx.file}:${lineNo} char:${col + 1}` : `At line:${lineNo} char:${col + 1}`;
  const body = errorRecord(invocation || 'x', lineText, { ...e, pos: col });
  const lines = body.split('\n');
  lines[1] = where;
  // A thrown error and an expression's error have no "name : " before the message.
  if (!invocation || thrown) lines[0] = e.message;
  return lines.join('\n');
}

function emitError(ctx: Ctx, rec: string): void {
  ctx.ok = false;
  errorList(ctx.game).unshift(rec.split('\n')[0].replace(/^[^:]+ : /, ''));
  if (ctx.merged) {
    ctx.merged.push(rec.split('\n')[0]);
    return;
  }
  if (ctx.mute) return;
  ctx.out.push(rec);
  ctx.errors.push(rec);
}

// ——— Functions (about_Functions) ———

/** The session's functions (defined at the prompt, dot-sourced or imported). */
const sessionFunctions = (game: Shell): Record<string, FnDef> => (game.state.psFunctions ??= {});

/** A function by name: the script's own first, then the session's (a task's powershell.exe has only its own). */
function findFunction(ctx: Ctx, name: string): FnDef | undefined {
  const low = name.toLowerCase();
  return ctx.scope?.functions?.[low] ?? (ctx.scope?.isolated ? undefined : sessionFunctions(ctx.game)[low]);
}

/** function Name { … }: defined in the current scope (a script's own, otherwise the session). */
function defineFunction(ctx: Ctx, def: FnDef): void {
  if (ctx.scope) (ctx.scope.functions ??= {})[def.name.toLowerCase()] = def;
  else sessionFunctions(ctx.game)[def.name.toLowerCase()] = def;
}

/** A function's parameters as a cmdlet's (binding by name, prefix, position; its syntax). */
function functionCmdlet(def: FnDef): Cmdlet {
  const params: Param[] = def.params.map((p) => ({ name: p.name, switch: /^switch$/i.test(p.type ?? ''), aliases: p.aliases, type: 'System.Object' }));
  const explicit = def.params.some((p) => p.position !== undefined);
  const positional = (explicit ? def.params.filter((p) => p.position !== undefined).sort((a, b) => a.position! - b.position!) : def.params.filter((p) => !/^switch$/i.test(p.type ?? ''))).map((p) => p.name);
  return { name: def.name, module: '', version: '', kind: 'Function', params, positional, run: () => [] };
}

/** A parameter's type as Get-Help writes it ([string] → string, [int[]] → int[]). */
const typeLabel = (t?: string) => (t ? t.replace(/^system\./i, '').toLowerCase().replace(/^int32/, 'int') : 'Object');

/** A function's syntax line (Get-Help, Get-Command -Syntax). */
export function functionSyntax(def: FnDef): string {
  const c = functionCmdlet(def);
  const parts = def.params.map((p) => {
    if (/^switch$/i.test(p.type ?? '')) return `[-${p.name}]`;
    const name = c.positional!.includes(p.name) ? `[-${p.name}]` : `-${p.name}`;
    const one = `${name} <${typeLabel(p.type)}>`;
    return p.mandatory ? one : `[${one}]`;
  });
  return [def.name, ...parts, ...(def.advanced ? ['[<CommonParameters>]'] : [])].join(' ');
}

/**
 * Calls a function: binds its parameters (by name, unambiguous prefix,
 * position; a simple function's extra values go to $args, an advanced one's
 * are errors), asks for a mandatory one that is missing, converts to the
 * declared types, checks [ValidateSet()], then runs begin, process (once
 * per item of the pipeline, $_ and the ValueFromPipeline parameter set),
 * end, in a scope of its own; return ends it.
 */
function callFunction(ctx: Ctx, def: FnDef, el: Element, evaluated: Evaluated[], input: unknown[] | null, name: string): unknown[] {
  const budget = (ctx.budget ??= { steps: 0, depth: 0 });
  if (budget.depth >= MAX_DEPTH) throw new Terminate(record(ctx, '', { message: 'The script failed due to call depth overflow.', pos: el.pos, length: name.length, category: 'InvalidOperation', target: '0:Int32', cmdlet: '', exception: 'ParentContainsErrorRecordException', id: 'CallDepthOverflow' }), true);
  const c = functionCmdlet(def);
  let bound: Record<string, unknown>;
  const rest: unknown[] = [];
  if (def.advanced) {
    const b = bind(c, evaluated, (a) => ({ pos: a.pos, length: a.text.length }) as ErrorSpec);
    if ('error' in b) throw new Terminate(record(ctx, name, b.error));
    bound = b.p;
  } else {
    // A simple function: its declared parameters by name or position; everything else in $args.
    bound = {};
    const positional: unknown[] = [];
    for (let i = 0; i < evaluated.length; i++) {
      const { arg, value } = evaluated[i];
      if (arg.param === undefined) {
        positional.push(value);
        continue;
      }
      const low = arg.param.toLowerCase();
      const matches = c.params.filter((x) => x.name.toLowerCase() === low || x.aliases?.some((a) => a.toLowerCase() === low));
      const found = matches.length ? matches : c.params.filter((x) => x.name.toLowerCase().startsWith(low));
      if (found.length !== 1) {
        rest.push(arg.text);
        if (arg.colon) rest.push(value);
        continue;
      }
      if (found[0].switch) bound[found[0].name] = arg.colon ? truthy(value) : true;
      else if (arg.colon) bound[found[0].name] = value;
      else if (evaluated[i + 1] && evaluated[i + 1].arg.param === undefined) bound[found[0].name] = evaluated[++i].value;
      else throw new Terminate(record(ctx, name, { message: `Missing an argument for parameter '${found[0].name}'. Specify a parameter of type 'System.Object' and try again.`, pos: arg.pos, length: arg.text.length, category: 'InvalidArgument', target: ':', cmdlet: name, exception: 'ParameterBindingException', id: `MissingArgument,${name}` }));
    }
    for (const p of c.positional ?? []) if (bound[p] === undefined && positional.length) bound[p] = positional.shift();
    rest.push(...positional);
  }
  const local = new Map<string, { name: string; value: unknown }>();
  const saved = { frames: ctx.frames, locals: ctx.locals };
  ctx.frames = [];
  ctx.locals = [...(ctx.locals ?? []), local];
  budget.depth++;
  try {
    const boundTable = new PSHashtable();
    const assign = (p: (typeof def.params)[number], v: unknown, at: number) => {
      let value = v;
      if (/^switch$/i.test(p.type ?? '')) value = truthy(v);
      else if (p.type && typeFull(p.type)) value = convert(ctx, v, p.type, at);
      if (p.validateSet && !p.validateSet.some((x) => x.toLowerCase() === text(value).toLowerCase()))
        throw new Terminate(record(ctx, name, { message: `Cannot validate argument on parameter '${p.name}'. The argument "${text(value)}" does not belong to the set "${p.validateSet.join(',')}" specified by the ValidateSet attribute. Supply an argument that is in the set and then try the command again.`, pos: at, length: name.length, category: 'InvalidData', target: ':', cmdlet: name, exception: 'ParameterBindingValidationException', id: `ParameterArgumentValidationError,${name}` }));
      local.set(p.name.toLowerCase(), { name: p.name, value });
      boundTable.set(p.name, value);
    };
    for (const p of def.params) {
      if (bound[p.name] !== undefined) assign(p, bound[p.name], el.pos);
      else if (p.fromPipeline && input?.length) continue;
      else if (p.mandatory) {
        const answer = ask(ctx, `${p.name}: `, [`cmdlet ${def.name} at command pipeline position 1`, 'Supply values for the following parameters:'], false, '');
        if (answer === '')
          throw new Terminate(record(ctx, name, { message: `Cannot bind argument to parameter '${p.name}' because it is an empty string.`, pos: el.pos, length: name.length, category: 'InvalidData', target: ':', cmdlet: name, exception: 'ParameterBindingValidationException', id: `ParameterArgumentValidationErrorEmptyStringNotAllowed,${name}` }));
        assign(p, answer, el.pos);
      } else local.set(p.name.toLowerCase(), { name: p.name, value: p.default ? evalExpr(ctx, p.default) : /^switch$/i.test(p.type ?? '') ? false : null });
    }
    local.set('args', { name: 'args', value: rest });
    local.set('input', { name: 'input', value: input ?? [] });
    local.set('psboundparameters', { name: 'PSBoundParameters', value: boundTable });
    const out: unknown[] = [];
    try {
      if (def.begin) out.push(...runBody(ctx, def.begin));
      const fromPipe = def.params.find((p) => p.fromPipeline);
      const byName = def.params.filter((p) => p.byPropertyName && bound[p.name] === undefined);
      const each = (item: unknown) => {
        if (fromPipe && bound[fromPipe.name] === undefined) assign(fromPipe, item, el.pos);
        for (const p of byName) {
          const v = property(item, p.name);
          if (v !== undefined) assign(p, v, el.pos);
        }
      };
      if (def.process) {
        const items = input ?? [null];
        for (const item of items) {
          if (input) each(item);
          ctx.frames = [new Map([['_', item]])];
          try {
            out.push(...runBody(ctx, def.process));
          } catch (e) {
            // return in process: on to the next item.
            if (!(e instanceof Return)) throw e;
            out.push(...e.items);
          }
        }
        ctx.frames = [];
      } else if (input?.length) each(input.at(-1));
      out.push(...runBody(ctx, def.end));
    } catch (e) {
      if (e instanceof Return) return [...out, ...e.items];
      if (e instanceof Flow) e.items.unshift(...out);
      throw e;
    }
    return out;
  } finally {
    budget.depth--;
    ctx.frames = saved.frames;
    ctx.locals = saved.locals;
  }
}

// ——— Commands ———

/** Every cmdlet of the game, by family. */
export const CMDLETS: Cmdlet[] = [];

/** The aliases of Windows PowerShell 5.1 (Get-Alias), for the game's cmdlets. */
export const ALIASES: Record<string, string> = {
  ls: 'Get-ChildItem', dir: 'Get-ChildItem', gci: 'Get-ChildItem',
  cat: 'Get-Content', type: 'Get-Content', gc: 'Get-Content',
  cd: 'Set-Location', chdir: 'Set-Location', sl: 'Set-Location',
  pwd: 'Get-Location', gl: 'Get-Location', pushd: 'Push-Location', popd: 'Pop-Location',
  gi: 'Get-Item', gp: 'Get-ItemProperty', sp: 'Set-ItemProperty', rp: 'Remove-ItemProperty', gpv: 'Get-ItemPropertyValue',
  gsv: 'Get-Service', sasv: 'Start-Service', spsv: 'Stop-Service', gdr: 'Get-PSDrive', gps: 'Get-Process', ps: 'Get-Process',
  sort: 'Sort-Object', select: 'Select-Object', where: 'Where-Object', '?': 'Where-Object', foreach: 'ForEach-Object', '%': 'ForEach-Object',
  group: 'Group-Object', ft: 'Format-Table', fl: 'Format-List', measure: 'Measure-Object', gm: 'Get-Member', sls: 'Select-String',
  echo: 'Write-Output', write: 'Write-Output', cls: 'Clear-Host', clear: 'Clear-Host',
  help: 'Get-Help', man: 'Get-Help', gcm: 'Get-Command', gal: 'Get-Alias',
  rm: 'Remove-Item', del: 'Remove-Item', erase: 'Remove-Item', rd: 'Remove-Item', rmdir: 'Remove-Item', ri: 'Remove-Item',
  mv: 'Move-Item', move: 'Move-Item', mi: 'Move-Item', cp: 'Copy-Item', copy: 'Copy-Item', cpi: 'Copy-Item', ni: 'New-Item', md: 'mkdir', ren: 'Rename-Item', rni: 'Rename-Item',
  sc: 'Set-Content', ac: 'Add-Content', gcim: 'Get-CimInstance', gwmi: 'Get-WmiObject', kill: 'Stop-Process', spps: 'Stop-Process',
  sleep: 'Start-Sleep', h: 'Get-History', history: 'Get-History', gv: 'Get-Variable', iex: 'Invoke-Expression',
};

/** A cmdlet by its name or one of its aliases, without case. */
export function cmdletNamed(name: string): Cmdlet | undefined {
  const low = name.toLowerCase();
  const target = Object.entries(ALIASES).find(([a]) => a === low)?.[1] ?? name;
  return CMDLETS.find((c) => c.name.toLowerCase() === target.toLowerCase());
}

/** The cmdlets this machine has (its modules; story 30's read-only machine hides the writers). */
export const visibleCmdlets = (game: Shell) => CMDLETS.filter((c) => !(windows(game).readOnly && c.writes) && (!c.available || c.available(game)));

const COMMON: Param[] = [
  { name: 'ErrorAction', aliases: ['ea'], type: 'System.Management.Automation.ActionPreference' },
  { name: 'WarningAction', aliases: ['wa'], type: 'System.Management.Automation.ActionPreference' },
  { name: 'Verbose', switch: true, aliases: ['vb'] },
  { name: 'Debug', switch: true, aliases: ['db'] },
  { name: 'ErrorVariable', aliases: ['ev'], type: 'System.String' },
  { name: 'OutVariable', aliases: ['ov'], type: 'System.String' },
];
const SHOULD: Param[] = [
  { name: 'WhatIf', switch: true, aliases: ['wi'] },
  { name: 'Confirm', switch: true, aliases: ['cf'] },
];

/** A cmdlet's parameters, the common ones included. */
export const allParams = (c: Cmdlet): Param[] => [...c.params, ...COMMON, ...(c.writes ? SHOULD : [])];

const fqid = (c: Cmdlet, id: string) => `${id},${c.kind === 'Function' ? c.name : `Microsoft.PowerShell.Commands.${c.name.replace('-', '')}Command`}`;

interface Evaluated {
  arg: Arg;
  value?: unknown;
}

/** Converts a bound value to its parameter's type; a Failure if it can't. */
function bindValue(c: Cmdlet, def: Param, v: unknown): { v: unknown } | { f: Failure } {
  const r = bindRaw(c, def, v);
  return r instanceof Fail ? { f: r.f } : { v: r };
}
class Fail {
  constructor(public f: Failure) {}
}
function bindRaw(c: Cmdlet, def: Param, v: unknown): unknown {
  const type = def.type ?? (def.list ? 'System.String[]' : 'System.String');
  const failure = (message: string) => new Fail({ message, category: 'InvalidArgument', target: ':', exception: 'ParameterBindingException', id: fqid(c, 'CannotConvertArgumentNoMessage') });
  const cannot = () => failure(`Cannot bind parameter '${def.name}'. Cannot convert the "${text(v)}" value of type "${typeName(v)}" to type "${type}".`);
  if (/SecureString$/.test(type)) return v instanceof PSSecureString ? v : cannot();
  if (/ScriptBlock$/.test(type)) return v instanceof PSScriptBlock ? v : cannot();
  if (/Hashtable(\[\])?$/.test(type)) return v instanceof PSHashtable || (Array.isArray(v) && v.every((x) => x instanceof PSHashtable)) ? v : cannot();
  if (/\.(Int32|Int64|UInt32|Double)$/.test(type)) {
    const n = toNumber(Array.isArray(v) ? v[0] : v);
    if (n === null) return failure(`Cannot bind parameter '${def.name}'. Cannot convert value "${text(v)}" to type "${type}". Error: "Input string was not in a correct format."`);
    return n;
  }
  if (/DateTime$/.test(type)) {
    if (v instanceof PSDate) return v;
    const ms = parseDate(text(v), DATES.today);
    return ms === null ? failure(`Cannot bind parameter '${def.name}'. Cannot convert value "${text(v)}" to type "System.DateTime". Error: "String was not recognized as a valid DateTime."`) : new PSDate(ms);
  }
  if (def.list || type.endsWith('[]')) return enumerate(v).flat();
  if (type === 'System.String') return Array.isArray(v) ? v.map(text).join(' ') : text(v);
  return v;
}

function bind(c: Cmdlet, args: Evaluated[], pos: (a: Arg) => ErrorSpec): { p: Record<string, unknown> } | { error: ErrorSpec } {
  const r = bindInner(c, args, pos);
  return Object.getPrototypeOf(r) === BIND_ERROR ? { error: { ...(r as ErrorSpec) } } : { p: r as Record<string, unknown> };
}
const BIND_ERROR = {};
function bindInner(c: Cmdlet, args: Evaluated[], pos: (a: Arg) => ErrorSpec): Record<string, unknown> | ErrorSpec {
  const params = allParams(c);
  const p: Record<string, unknown> = {};
  const positional: Evaluated[] = [];
  const asError = (e: ErrorSpec): ErrorSpec => Object.assign(Object.create(BIND_ERROR), e);
  const bindingError = (message: string, a: Arg, id: string): ErrorSpec => asError({ ...pos(a), message, category: 'InvalidArgument', target: ':', cmdlet: c.name, exception: 'ParameterBindingException', id: fqid(c, id) });
  const set = (def: Param, v: unknown, a: Arg): ErrorSpec | null => {
    const bound = bindValue(c, def, v);
    if ('f' in bound) return asError({ ...pos(a), ...bound.f, cmdlet: c.name });
    p[def.name] = bound.v;
    return null;
  };
  for (let i = 0; i < args.length; i++) {
    const { arg, value } = args[i];
    if (arg.param === undefined) {
      positional.push(args[i]);
      continue;
    }
    const low = arg.param.toLowerCase();
    const exact = params.find((x) => x.name.toLowerCase() === low || x.aliases?.some((a) => a.toLowerCase() === low));
    const matches = exact ? [exact] : params.filter((x) => x.name.toLowerCase().startsWith(low));
    if (!matches.length) return bindingError(`A parameter cannot be found that matches parameter name '${arg.param}'.`, arg, 'NamedParameterNotFound');
    if (matches.length > 1) return bindingError(`Parameter cannot be processed because the parameter name '${arg.param}' is ambiguous. Possible matches include: ${matches.map((m) => `-${m.name}`).join(' ')}.`, arg, 'AmbiguousParameter');
    const def = matches[0];
    if (def.switch) {
      p[def.name] = arg.colon ? truthy(value) : true;
      continue;
    }
    if (arg.colon) {
      const e = set(def, value, arg);
      if (e) return e;
      continue;
    }
    const next = args[i + 1];
    if (!next || next.arg.param !== undefined)
      return bindingError(`Missing an argument for parameter '${def.name}'. Specify a parameter of type '${def.type ?? (def.list ? 'System.String[]' : 'System.String')}' and try again.`, arg, 'MissingArgument');
    i++;
    const e = set(def, next.value, arg);
    if (e) return e;
  }
  // Where-Object { … }: the script block is the first positional value (otherwise the property, then the value).
  if (c.name === 'Where-Object' && positional[0]?.value instanceof PSScriptBlock && p.FilterScript === undefined) p.FilterScript = positional.shift()!.value;
  if (c.rest) {
    if (positional.length) p[c.rest] = [...values(p[c.rest]), ...positional.flatMap((x) => enumerate(x.value))];
    return p;
  }
  for (const name of c.positional ?? []) {
    if (p[name] !== undefined) continue;
    const x = positional.shift();
    if (!x) break;
    const e = set(params.find((d) => d.name === name)!, x.value, x.arg);
    if (e) return e;
  }
  if (positional.length) return bindingError(`A positional parameter cannot be found that accepts argument '${text(positional[0].value)}'.`, positional[0].arg, 'PositionalParameterNotFound');
  return p;
}

const notRecognised = (name: string, pos: number): ErrorSpec => ({
  message: `The term '${name}' is not recognized as the name of a cmdlet, function, script file, or operable program. Check the spelling of the name, or if a path was included, verify that the path is correct and try again.`,
  pos,
  length: name.length,
  category: 'ObjectNotFound',
  target: `${name}:String`,
  cmdlet: '',
  exception: 'CommandNotFoundException',
  id: 'CommandNotFoundException',
});

const CONFIRM_CHOICES = '[Y] Yes  [A] Yes to All  [N] No  [L] No to All  [S] Suspend  [?] Help (default is "Y"):';

/** A question: the answer given for this statement, or a Suspend that asks it. */
function ask(ctx: Ctx, prompt: string, lines: string[], secret: boolean, script: string): string {
  if (ctx.asked < ctx.answers.length) return ctx.answers[ctx.asked++];
  if (ctx.script) return script;
  throw new Suspend(prompt, lines, secret);
}

/** The machine's day, for a time alone bound to a DateTime parameter (-At 3am). */
const DATES = { today: 0 };

function runCommand(ctx: Ctx, el: Element, input: unknown[] | null): unknown[] {
  const game = ctx.game;
  const w = windows(game);
  DATES.today = w.clock;
  let name = el.name ?? '';
  if (el.call) {
    const target = evalExpr(ctx, el.call);
    if (target instanceof PSScriptBlock) return runBlock(ctx, target, input?.[0]);
    name = text(target);
    // . .\lib.ps1: the script runs in this scope (its functions and variables stay).
    if (el.dot && /\.ps1$/i.test(name)) {
      const where = resolveWindows(game, name);
      const node = where.exists ? game.find(where.path) : null;
      if (node?.type === 'file') return runScriptFile(ctx, game.read(where.path) ?? '', toWindows(where.path), true);
    }
  }
  const evaluated: Evaluated[] = el.args.map((arg) => ({ arg, value: arg.value ? evalExpr(ctx, arg.value) : undefined }));
  ctx.commands.push([name, ...el.args.map((a) => a.text)]);
  const span = { pos: el.pos, length: el.end - el.pos };
  // A function (it comes before a cmdlet of the same name).
  const own = !ALIASES[name.toLowerCase()] ? findFunction(ctx, name) : undefined;
  if (own) return callFunction(ctx, own, el, evaluated, input, name);
  // cd.. and cd\ : the functions PowerShell defines for old habits.
  const fn = /^cd(\.\.|\\)$/i.exec(name);
  const found = fn ? cmdletNamed('Set-Location') : cmdletNamed(name);
  // A module's cmdlets exist only where the module is installed (ActiveDirectory on a domain controller…).
  const c = found && (!found.available || found.available(game)) ? found : undefined;
  if (!c) {
    if (/^mkdir$|^md$/i.test(name)) return runCommand(ctx, { ...el, name: 'New-Item', args: [{ param: 'ItemType', text: '-ItemType', pos: el.pos }, { value: { k: 'str', v: 'Directory' }, text: 'Directory', pos: el.pos }, ...el.args] }, input);
    const native = nativeNamed(name);
    if (native) {
      const args = evaluated.map((x) => (x.arg.param !== undefined ? x.arg.text : enumerate(x.value).map(text).join(','))).filter((x) => x !== '');
      const r = native.run(game, args, input?.map(text) ?? null);
      vars(game).lastexitcode = { name: 'LASTEXITCODE', value: r.code };
      if (r.code !== 0) ctx.ok = false;
      if (r.err) ctx.out.push(r.err);
      if (r.shell) {
        (w.shells ??= ['powershell']).push(r.shell);
        if (r.out) ctx.out.push(r.out);
        return [];
      }
      return r.out ? r.out.replace(/\n$/, '').split('\n') : [];
    }
    // A script: .\backup.ps1 (local scripts run: RemoteSigned).
    if (/\.ps1$/i.test(name)) {
      const where = resolveWindows(game, name);
      const node = where.exists ? game.find(where.path) : null;
      if (node?.type === 'file' && /[\\/]/.test(name)) return runScriptFile(ctx, game.read(where.path) ?? '', toWindows(where.path));
      if (node?.type === 'file') {
        const rec = record(ctx, name, { ...notRecognised(name, el.pos) });
        ctx.out.push(rec, '', `Suggestion [3,General]: The command ${name} was not found, but does exist in the current location. Windows PowerShell does not load commands from the current location by default. If you trust this command, instead type: ".\\${name}". See "get-help about_Command_Precedence" for more details.`);
        ctx.errors.push(rec);
        ctx.ok = false;
        return [];
      }
    }
    throw new Terminate(record(ctx, name, notRecognised(name, el.pos)));
  }
  // Story 30: a machine you only look at.
  if (c.writes && w.readOnly) {
    ctx.out.push(game.t('powershell-read-only', { command: c.name }));
    ctx.errors.push(c.name);
    game.state.psWriters = ((game.state.psWriters as number | undefined) ?? 0) + 1;
    game.status = 1;
    ctx.ok = false;
    throw new Terminate('');
  }
  if (el.args.some((a) => a.param === '?')) return helpPage(game, c, 'short').split('\n');
  const bound = bind(c, fn ? [{ arg: { text: fn[1], pos: el.pos + 2 }, value: fn[1] === '..' ? '..' : '\\' }] : evaluated, (a) => ({ pos: a.pos, length: a.text.length }) as ErrorSpec);
  if ('error' in bound) throw new Terminate(record(ctx, name, bound.error));
  const p = bound.p;
  const pref = text(p.ErrorAction ?? getVar(ctx, 'ErrorActionPreference')).toLowerCase();
  let yesToAll = false;
  let noToAll = false;
  const confirm = (caption: string, message: string): boolean => {
    if (yesToAll) return true;
    if (noToAll) return false;
    const answer = ask(ctx, CONFIRM_CHOICES, [caption, message], false, 'N').trim().toUpperCase();
    if (answer === 'A') yesToAll = true;
    if (answer === 'L') noToAll = true;
    return answer === '' || answer === 'Y' || answer === 'A';
  };
  // -ErrorVariable NAME (or +NAME to add to it): the command's errors, also kept in that variable.
  const ev = p.ErrorVariable !== undefined ? text(p.ErrorVariable) : null;
  const caught: unknown[] = ev?.startsWith('+') ? enumerate(getVar(ctx, ev.slice(1))) : [];
  if (ev) setVar(ctx, ev.replace(/^\+/, ''), caught);
  const r: Run = {
    game,
    p,
    input,
    fail: (e) => {
      game.state.psFailures = ((game.state.psFailures as number | undefined) ?? 0) + 1;
      if (ev) caught.push(errorRecordObject(record(ctx, name, { ...e, ...span, cmdlet: c.name })));
      if (pref === 'stop') throw new Terminate(record(ctx, name, { ...e, ...span, cmdlet: c.name }), true);
      if (pref === 'silentlycontinue' || pref === 'ignore') {
        ctx.ok = false;
        if (pref === 'silentlycontinue') errorList(game).unshift(e.message);
        return;
      }
      emitError(ctx, record(ctx, name, { ...e, ...span, cmdlet: c.name }));
    },
    stop: (e) => {
      throw new Terminate(record(ctx, name, { ...e, ...span, cmdlet: c.name }));
    },
    host: (line) => ctx.out.push(line),
    should: (action, target, high = false) => {
      if (p.WhatIf) {
        ctx.out.push(`What if: Performing the operation "${action}" on target "${target}".`);
        return false;
      }
      if (p.Confirm === true || (high && p.Confirm !== false && !p.Force)) return confirm('Confirm', `Are you sure you want to perform this action?\nPerforming the operation "${action}" on target "${target}".`);
      return true;
    },
    confirm,
    read: (prompt, secret) => ask(ctx, prompt, [], secret, ''),
    invoke: (block, item) => runBlock(ctx, block, item),
    variable: (n) => getVar(ctx, n),
    source: (code, file) => runScriptFile({ ...ctx, scope: undefined, locals: [] }, code, file, true),
  } as Run;
  const result = c.run(r);
  if (result === null) {
    ctx.out.push('\u001bclear');
    return [];
  }
  return result;
}

function runPipeline(ctx: Ctx, p: Pipeline): unknown[] {
  const errRedirect = p.redirects.find((r) => r.stream === '2' || r.stream === '*');
  const muted = !!errRedirect && !errRedirect.merge && errRedirect.file?.k === 'var' && errRedirect.file.name.toLowerCase() === 'null';
  const merge = p.redirects.some((r) => r.merge);
  if (muted) ctx.mute++;
  const mergedBefore = ctx.merged;
  if (merge) ctx.merged = [];
  let items: unknown[] = [];
  try {
    for (const [k, el] of p.elements.entries()) {
      if (el.expr) items = enumerate(evalExpr(ctx, el.expr));
      else items = runCommand(ctx, el, k === 0 ? null : items);
    }
  } finally {
    if (muted) ctx.mute--;
  }
  if (merge) {
    items = [...(ctx.merged ?? []), ...items];
    ctx.merged = mergedBefore;
  }
  const out = p.redirects.find((r) => r.stream === '1' && r.file);
  if (out?.file) {
    const target = evalExpr(ctx, out.file);
    if (out.file.k === 'var' && out.file.name.toLowerCase() === 'null') return [];
    const failure = outFile(ctx.game, text(target), render(items), out.append);
    if (failure) emitError(ctx, record(ctx, 'out-file', { ...failure, pos: p.pos, length: p.end - p.pos, cmdlet: 'Out-File' }));
    return [];
  }
  return items;
}

/** A script's text run in this session (.\backup.ps1): its output, and its exit code through exit. */
function runScriptFile(ctx: Ctx, source: string, file: string, dot = false): unknown[] {
  const statements = parse(source.replace(/\r\n/g, '\n'));
  // The script's own scope: it reads the session's variables, its assignments stay its own
  // (dot-sourced: the caller's scope, so its functions and variables stay).
  const inner: Ctx = { ...ctx, source: source.replace(/\r\n/g, '\n'), file, frames: [...ctx.frames], scope: dot ? ctx.scope : { vars: {}, isolated: false } };
  if (statements instanceof ParseError) {
    ctx.out.push(parseErrorText(inner, statements));
    ctx.ok = false;
    return [];
  }
  const out: unknown[] = [];
  for (const st of statements) {
    try {
      inner.ok = true;
      out.push(...runStatement(inner, st));
      ctx.game.state.psSuccess = inner.ok;
      if (!inner.ok) ctx.ok = false;
    } catch (e) {
      // exit N ends the script (not the session): $LASTEXITCODE is N.
      if (e instanceof Exit) {
        vars(ctx.game).lastexitcode = { name: 'LASTEXITCODE', value: e.code };
        ctx.ok = e.code === 0;
        return out;
      }
      // return (or a stray break) ends the script.
      if (e instanceof Flow) return [...out, ...e.items];
      // A script-terminating error stops the script and goes on to its caller.
      if (e instanceof Terminate && !e.fatal) {
        if (e.record) emitError(inner, e.record);
        continue;
      }
      throw e;
    }
  }
  return out;
}

// ——— Out-Default ———

const VIEWS: Record<string, View> = {};

/** What a pipeline's items look like on the screen (Out-Default). */
export function render(items: unknown[]): string {
  // A date alone shows its long form (Get-Date).
  const out: string[] = [];
  let run: unknown[] = [];
  const flush = () => {
    if (run.length) out.push(outDefault(run, VIEWS));
    run = [];
  };
  for (const x of items) {
    if (x instanceof PSDate) {
      flush();
      out.push(`\n${longDateTime(x.ms)}\n`);
    } else if (x instanceof PSScriptBlock) {
      flush();
      out.push(x.text);
    } else run.push(x);
  }
  flush();
  return out.join('\n');
}

// ——— The pipeline's own cmdlets ———

function whereObject(r: Run): unknown[] {
  const items = r.input ?? [];
  if (r.p.FilterScript instanceof PSScriptBlock) return items.filter((x) => truthy(collect(r.invoke(r.p.FilterScript as PSScriptBlock, x))));
  const prop = str(r.p.Property);
  const op = ['EQ', 'NE', 'GT', 'GE', 'LT', 'LE', 'Like', 'NotLike', 'Match', 'NotMatch', 'Contains', 'NotContains', 'In', 'NotIn', 'CEQ', 'CNE', 'CLike', 'CMatch'].find((o) => r.p[o]);
  // Where-Object Name: the objects whose property is set.
  if (!op) return items.filter((x) => truthy(property(x, prop)));
  return items.filter((x) => truthy(compareOp(op.toLowerCase(), property(x, prop) ?? null, r.p.Value)));
}

function forEachObject(r: Run): unknown[] {
  const items = r.input ?? [];
  const blocks = values(r.p.Process).filter((b): b is PSScriptBlock => b instanceof PSScriptBlock);
  if (r.p.MemberName !== undefined) return items.flatMap((x) => enumerate(property(x, str(r.p.MemberName)) ?? null));
  const out: unknown[] = [];
  if (r.p.Begin instanceof PSScriptBlock) out.push(...r.invoke(r.p.Begin));
  for (const x of items) for (const b of blocks) out.push(...r.invoke(b, x));
  if (r.p.End instanceof PSScriptBlock) out.push(...r.invoke(r.p.End));
  return out;
}

/** A property of Select-Object or Sort-Object: a name, or a calculated one (@{Name=…; Expression={…}}). */
function propertyOf(r: Run, x: unknown, spec: unknown): unknown {
  if (spec instanceof PSHashtable) {
    const e = spec.get('Expression') ?? spec.get('E');
    if (e instanceof PSScriptBlock) return collect(r.invoke(e, x));
    return property(x, text(e));
  }
  if (spec instanceof PSScriptBlock) return collect(r.invoke(spec, x));
  return property(x, text(spec));
}
const specName = (spec: unknown) => (spec instanceof PSHashtable ? text(spec.get('Name') ?? spec.get('N') ?? spec.get('Label') ?? spec.get('L') ?? '') : spec instanceof PSScriptBlock ? spec.text.trim() : text(spec));

function sortObject(r: Run): unknown[] {
  const items = [...(r.input ?? [])];
  const props = values(r.p.Property);
  const sign = r.p.Descending ? -1 : 1;
  const key = (x: unknown) => (props.length ? props.map((p) => propertyOf(r, x, p)) : [isObject(x) ? (x.props.Name ?? x.props.FullName ?? text(x)) : x]);
  const sorted = items
    .map((x, i) => ({ x, i, k: key(x) }))
    .sort((a, b) => {
      for (let j = 0; j < a.k.length; j++) {
        const c = compare(a.k[j], b.k[j]);
        if (c) return sign * c;
      }
      return a.i - b.i;
    })
    .map((e) => e.x);
  if (!r.p.Unique) return sorted;
  return sorted.filter((x, i) => i === 0 || compare(key(x)[0], key(sorted[i - 1])[0]) !== 0);
}

function selectObject(r: Run): unknown[] {
  let items = [...(r.input ?? [])];
  if (r.p.Unique) items = items.filter((x, i) => items.findIndex((y) => compare(x, y) === 0 && text(x) === text(y)) === i);
  if (r.p.Skip !== undefined) items = items.slice(Number(r.p.Skip));
  if (r.p.First !== undefined) items = items.slice(0, Number(r.p.First));
  if (r.p.Last !== undefined) items = items.slice(-Number(r.p.Last));
  if (r.p.Index !== undefined) items = values(r.p.Index).map((i) => items[Number(i)]).filter((x) => x !== undefined);
  const expand = str(r.p.ExpandProperty);
  if (expand) {
    const out: unknown[] = [];
    for (const x of items) {
      const v = property(x, expand);
      if (v === undefined) {
        r.fail({ message: `Property "${expand}" cannot be found.`, category: 'InvalidArgument', target: `${text(x)}:PSObject`, exception: 'PSArgumentException', id: 'ExpandPropertyNotFound,Microsoft.PowerShell.Commands.SelectObjectCommand' });
        continue;
      }
      out.push(...enumerate(v));
    }
    return out;
  }
  const props = values(r.p.Property);
  if (!props.length) return items;
  return items.map((x) => {
    const specs = props.flatMap((s) => (text(s) === '*' && isObject(x) ? Object.keys(x.props) : props.some((q) => q === s) ? [s] : [])) as unknown[];
    const all = props.includes('*') && isObject(x) ? [...Object.keys(x.props), ...props.filter((s) => s !== '*')] : specs;
    const canonical = (n: string) => (isObject(x) ? (Object.keys(x.props).find((k) => k.toLowerCase() === n.toLowerCase()) ?? n) : n);
    const out: Record<string, unknown> = {};
    for (const s of all) {
      const label = s instanceof PSHashtable ? specName(s) : canonical(text(s));
      // A wildcard in a name: every property that matches.
      if (!(s instanceof PSHashtable) && /[*?]/.test(text(s)) && isObject(x)) {
        for (const k of Object.keys(x.props).filter((k) => wildcard(text(s)).test(k))) out[k] = x.props[k];
        continue;
      }
      const v = propertyOf(r, x, s);
      out[label] = v === undefined ? null : v;
    }
    return { type: `Selected.${isObject(x) ? x.type : typeName(x)}`, props: out, fullType: 'System.Management.Automation.PSCustomObject' } satisfies PSObject;
  });
}

function groupObject(r: Run): unknown[] {
  const items = r.input ?? [];
  const props = values(r.p.Property);
  const groups = new Map<string, { name: string; items: unknown[] }>();
  for (const x of items) {
    const key = props.length ? props.map((p) => text(propertyOf(r, x, p))).join(', ') : text(x);
    const g = groups.get(key.toLowerCase()) ?? { name: key, items: [] };
    g.items.push(x);
    groups.set(key.toLowerCase(), g);
  }
  const all = [...groups.values()];
  if (r.p.NoElement) return all.map((g) => ({ type: 'GroupInfoNoElement', props: { Count: g.items.length, Name: g.name } }));
  return all.map((g) => ({ type: 'GroupInfo', props: { Count: g.items.length, Name: g.name, Group: g.items }, fullType: 'Microsoft.PowerShell.Commands.GroupInfo' }));
}

function measureObject(r: Run): unknown[] {
  const items = r.input ?? [];
  const prop = values(r.p.Property)[0];
  const raw = prop !== undefined ? items.map((x) => propertyOf(r, x, prop)) : items;
  const nums = raw.map((v) => toNumber(v)).filter((v): v is number => v !== null && raw.length > 0);
  if (r.p.Line || r.p.Word || r.p.Character) {
    const lines = items.map(text);
    return [{ type: 'TextMeasureInfo', props: { Lines: r.p.Line ? lines.length : null, Words: r.p.Word ? lines.join(' ').split(/\s+/).filter(Boolean).length : null, Characters: r.p.Character ? lines.join('').length : null, Property: null } }];
  }
  const pick = (on: boolean, f: () => number) => (on && nums.length ? f() : null);
  return [
    {
      type: 'GenericMeasureInfo',
      props: {
        Count: prop !== undefined ? raw.filter((v) => v !== null && v !== undefined).length : items.length,
        Average: pick(!!r.p.Average, () => nums.reduce((a, b) => a + b, 0) / nums.length),
        Sum: pick(!!r.p.Sum, () => nums.reduce((a, b) => a + b, 0)),
        Maximum: pick(!!r.p.Maximum, () => Math.max(...nums)),
        Minimum: pick(!!r.p.Minimum, () => Math.min(...nums)),
        Property: prop === undefined ? null : specName(prop),
      },
    },
  ];
}

/** Format-Table and Format-List: their text, which nothing else can read. */
function formatted(r: Run, how: 'table' | 'list'): unknown[] {
  const items = (r.input ?? []).filter(isObject) as PSObject[];
  const specs = values(r.p.Property);
  if (!items.length) return (r.input ?? []).map((x) => (x instanceof PSHashtable ? render([x]) : show(x)));
  const view = VIEWS[items[0].type];
  const star = specs.some((s) => text(s) === '*');
  const out: string[] = [];
  // Group by type: each type has its own view.
  if (how === 'list') {
    if (!specs.length && view?.listProps) out.push(...list(items, view.listProps, view.listValues));
    else if (!specs.length || star) out.push(...list(items, undefined, view?.listValues));
    else {
      const rows = items.map((x) => ({ type: x.type, props: Object.fromEntries(specs.map((s) => [specName(s) === text(s) && isObject(x) ? (Object.keys(x.props).find((k) => k.toLowerCase() === text(s).toLowerCase()) ?? text(s)) : specName(s), propertyOf(r, x, s) ?? null])) }));
      out.push(...list(rows));
    }
    return [...out, '', ''];
  }
  if (!specs.length && view && !view.list) {
    return [render(items)];
  }
  const names = !specs.length || star ? Object.keys(items[0].props) : specs.map(specName);
  const rows = items.map((x) => ({ type: x.type, props: Object.fromEntries((!specs.length || star ? names : specs).map((s, i) => [names[i], propertyOf(r, x, s) ?? null])) }));
  const canonical = names.map((n) => Object.keys(items[0].props).find((k) => k.toLowerCase() === n.toLowerCase()) ?? n);
  const cols = propertyColumns(canonical).map((c, i) => ({ ...c, value: (o: PSObject) => o.props[names[i]] }));
  return ['', ...table(rows, cols), '', ''];
}

function selectString(r: Run): unknown[] {
  const patterns = arr(r.p.Pattern);
  const re = patterns.map((p) => (r.p.SimpleMatch ? new RegExp(p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), r.p.CaseSensitive ? '' : 'i') : new RegExp(p, r.p.CaseSensitive ? '' : 'i')));
  const hit = (line: string) => (r.p.NotMatch ? !re.some((x) => x.test(line)) : re.some((x) => x.test(line)));
  const out: unknown[] = [];
  const match = (line: string, n: number, file: string | null): PSObject => ({
    type: 'MatchInfo',
    fullType: 'Microsoft.PowerShell.Commands.MatchInfo',
    props: { IgnoreCase: !r.p.CaseSensitive, LineNumber: n, Line: line, Filename: file ? file.split('\\').at(-1) : 'InputStream', Path: file ?? 'InputStream', Pattern: patterns[0] },
    text: file ? `${file}:${n}:${line}` : line,
  });
  if (r.p.Path !== undefined) {
    for (const typed of arr(r.p.Path)) {
      const where = resolveWindows(r.game, typed);
      const n = where.exists ? r.game.find(where.path) : null;
      if (!n || n.type !== 'file') {
        r.fail({ message: `Cannot find path '${toWindows(where.path)}' because it does not exist.`, category: 'ObjectNotFound', target: `${toWindows(where.path)}:String`, exception: 'ItemNotFoundException', id: 'PathNotFound,Microsoft.PowerShell.Commands.SelectStringCommand' });
        continue;
      }
      (r.game.read(where.path) ?? '').replace(/\r\n/g, '\n').split('\n').forEach((l, i) => hit(l) && out.push(match(l, i + 1, toWindows(where.path))));
    }
    return out;
  }
  (r.input ?? []).forEach((x, i) => hit(text(x)) && out.push(match(text(x), i + 1, null)));
  return out;
}

function getMemberCmdlet(r: Run): unknown[] {
  const seen = new Set<string>();
  const out: unknown[] = [];
  for (const x of r.input ?? []) {
    const t = typeName(x);
    if (seen.has(t)) continue;
    seen.add(t);
    const members: PSObject[] = [];
    const prop = (name: string, v: unknown) => members.push({ type: 'MemberDefinition', group: t, props: { Name: name, MemberType: 'Property', Definition: `${typeName(v).replace(/^System\./, '').replace('Int32', 'int').replace('String', 'string').replace('Boolean', 'bool')} ${name} {get;}` } });
    if (isObject(x)) {
      for (const m of Object.keys(x.methods ?? {})) members.push({ type: 'MemberDefinition', group: t, props: { Name: m.replace(/^./, (c) => c.toUpperCase()), MemberType: 'Method', Definition: `${m}()` } });
      for (const [k, v] of Object.entries(x.props)) prop(k, v);
    } else if (typeof x === 'string') {
      for (const m of ['Contains', 'EndsWith', 'IndexOf', 'PadLeft', 'Replace', 'Split', 'StartsWith', 'Substring', 'ToLower', 'ToUpper', 'Trim']) members.push({ type: 'MemberDefinition', group: t, props: { Name: m, MemberType: 'Method', Definition: `${m}(...)` } });
      prop('Length', 0);
    }
    const filter = arr(r.p.Name);
    const kinds = arr(r.p.MemberType).map((k) => k.toLowerCase());
    out.push(...members.filter((m) => (!filter.length || filter.some((f) => wildcard(f).test(String(m.props.Name)))) && (!kinds.length || kinds.includes(String(m.props.MemberType).toLowerCase()))));
  }
  return out;
}

function getDate(r: Run): unknown[] {
  const base = r.p.Date instanceof PSDate ? r.p.Date.ms : windows(r.game).clock;
  if (r.p.Format !== undefined) return [formatDate(base, str(r.p.Format))];
  return [new PSDate(base)];
}

function newObject(r: Run): unknown[] {
  const type = str(r.p.TypeName);
  const args = values(r.p.ArgumentList);
  const make = NEW_OBJECT[type.toLowerCase().replace(/^system\./, '')];
  if (/^(psobject|pscustomobject|management\.automation\.psobject)$/i.test(type.replace(/^system\./i, ''))) {
    const props = r.p.Property instanceof PSHashtable ? Object.fromEntries(r.p.Property.entries()) : {};
    return [{ type: 'PSCustomObject', props }];
  }
  if (!make)
    r.stop({ message: `Cannot find type [${type}]: verify that the assembly containing this type is loaded.`, category: 'InvalidType', target: ':', exception: 'PSArgumentException', id: 'TypeNotFound,Microsoft.PowerShell.Commands.NewObjectCommand' });
  const made = make!(r, args);
  return made === null ? [] : [made];
}

/** The types New-Object knows (the families add theirs: FileSystemAccessRule…). */
export const NEW_OBJECT: Record<string, (r: Run, args: unknown[]) => unknown> = {
  'collections.arraylist': () => [],
  'collections.hashtable': () => new PSHashtable(),
  datetime: (_r, a) => new PSDate(Date.UTC(Number(a[0] ?? 1), Number(a[1] ?? 1) - 1, Number(a[2] ?? 1), Number(a[3] ?? 0), Number(a[4] ?? 0), Number(a[5] ?? 0))),
};

function readHost(r: Run): unknown[] {
  const prompt = r.p.Prompt !== undefined ? `${str(r.p.Prompt)}: ` : '';
  const answer = r.read(prompt, !!r.p.AsSecureString);
  return [r.p.AsSecureString ? new PSSecureString(answer) : answer];
}

// ——— Help, commands, aliases ———

const url = (c: Cmdlet) =>
  ['Storage', 'SmbShare', 'ScheduledTasks', 'NetTCPIP', 'NetConnection', 'CimCmdlets', 'NetSecurity', 'ActiveDirectory', 'GroupPolicy'].includes(c.module)
    ? `https://learn.microsoft.com/powershell/module/${c.module.toLowerCase()}/${c.name.toLowerCase()}`
    : `https://learn.microsoft.com/powershell/module/${c.module.toLowerCase()}/${c.name.toLowerCase()}?view=powershell-5.1`;

const indentPs = (t: string, n = 4) => t.split('\n').map((l) => (l ? ' '.repeat(n) + l : l)).join('\n');

/** Get-Help NAME: the game's manual page, in PowerShell's layout. */
export function helpPage(game: Shell, c: Cmdlet, mode: 'short' | 'examples' | 'full', parameter?: string): string {
  const t = game.t;
  const parts = manualParts(c.name, t);
  const first = parts.description.split(/(?<=\.)\s|\n/)[0];
  const capital = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
  if (parameter !== undefined) {
    const found = parts.options.filter(([o]) => wildcard(parameter).test(o));
    return found.map(([o, d]) => `\n-${o}${(() => {
      const def = c.params.find((x) => x.name === o);
      return def && !def.switch ? ` <${(def.type ?? (def.list ? 'System.String[]' : 'System.String')).replace(/^System\./, '').replace(/^.*\./, '')}>` : def?.switch ? ' [<SwitchParameter>]' : '';
    })()}\n${indentPs(capital(d))}\n`).join('\n');
  }
  const out: string[] = ['', t('powershell-help-name'), indentPs(c.name), '', t('powershell-help-synopsis'), indentPs(capital(first)), ''];
  if (mode === 'examples') {
    parts.examples.forEach(([cmd, d], i) => out.push(indentPs(`-------------------------- ${t('powershell-help-example', { number: String(i + 1) })} --------------------------`), '', indentPs(`PS C:\\>${cmd}`), '', indentPs(capital(d)), ''));
    return out.join('\n');
  }
  out.push('', t('powershell-help-syntax'), indentPs(parts.synopsis || c.name), '', '', t('powershell-help-description'), indentPs(capital(parts.description)), '', '');
  if (mode === 'full') {
    if (parts.options.length) out.push(t('powershell-help-parameters'), ...parts.options.map(([o, d]) => `${indentPs(`-${o}`)}\n${indentPs(capital(d), 8)}\n`), '');
    if (parts.examples.length) out.push(...parts.examples.map(([cmd, d], i) => `${indentPs(`-------------------------- ${t('powershell-help-example', { number: String(i + 1) })} --------------------------`)}\n\n${indentPs(`PS C:\\>${cmd}`)}\n\n${indentPs(capital(d))}\n`));
  }
  out.push(t('powershell-help-related'), indentPs(`Online Version: ${url(c)}`), ...parts.see.map((s) => indentPs(s)), '', t('powershell-help-remarks'), indentPs(t('powershell-help-remarks-text', { name: c.name })));
  return out.join('\n');
}

/** Get-Help of a function of the session: its syntax, and its comment-based help if it has one. */
function functionHelp(game: Shell, def: FnDef): string[] {
  const t = game.t;
  const out = ['', t('powershell-help-name'), indentPs(def.name), ''];
  if (def.synopsis) out.push(t('powershell-help-synopsis'), indentPs(def.synopsis), '');
  out.push('', t('powershell-help-syntax'), indentPs(functionSyntax(def)), '', '');
  if (def.description) out.push(t('powershell-help-description'), indentPs(def.description), '', '');
  out.push(t('powershell-help-aliases'), indentPs(t('powershell-help-none')), '', '', t('powershell-help-remarks'), indentPs(def.synopsis ? t('powershell-help-remarks-text', { name: def.name }) : t('powershell-help-none')), '');
  return out;
}

function getHelp(r: Run): unknown[] {
  const name = str(r.p.Name);
  if (!name) return r.game.t('powershell-help-intro').split('\n');
  const own = sessionFunctions(r.game)[name.toLowerCase()];
  if (own) return functionHelp(r.game, own);
  const found = cmdletNamed(name);
  const c = found && (!found.available || found.available(r.game)) ? found : undefined;
  const native = c ? null : nativeNamed(name);
  if (!c && native) return [r.game.t('powershell-help-native', { name: native.name })];
  if (!c) {
    r.fail({
      message: `Get-Help could not find ${name} in a help file in this session. To download updated help topics type: "Update-Help". To get help online, search for the help topic in the TechNet library at https:/go.microsoft.com/fwlink/?LinkID=107116.`,
      category: 'ResourceUnavailable', target: ':', exception: 'HelpNotFoundException', id: 'HelpNotFound,Microsoft.PowerShell.Commands.GetHelpCommand',
    });
    return [];
  }
  if (r.p.Parameter !== undefined) return helpPage(r.game, c, 'full', str(r.p.Parameter)).split('\n');
  return helpPage(r.game, c, r.p.Examples ? 'examples' : r.p.Full || r.p.Detailed ? 'full' : 'short').split('\n');
}

function getCommand(r: Run): unknown[] {
  const names = arr(r.p.Name);
  const commandItem = (c: Cmdlet): PSObject => ({ type: 'CommandInfo', props: { CommandType: c.kind ?? 'Cmdlet', Name: c.name, Version: c.version, Source: c.module } });
  const aliasItem = (a: string): PSObject => ({ type: 'CommandInfo', props: { CommandType: 'Alias', Name: `${a} -> ${ALIASES[a]}`, Version: '', Source: '' } });
  const appItem = (n: string): PSObject => ({ type: 'CommandInfo', props: { CommandType: 'Application', Name: n, Version: '10.0.20348.1', Source: `C:\\Windows\\system32\\${n}` } });
  const visible = visibleCmdlets(r.game);
  const functions = Object.values(sessionFunctions(r.game)).map((def): PSObject => ({ type: 'CommandInfo', props: { CommandType: 'Function', Name: def.name, Version: '', Source: '', Definition: def.text } }));
  let all = visible.filter((c) => (!r.p.Verb || arr(r.p.Verb).some((v) => wildcard(v).test(c.name.split('-')[0]))) && (!r.p.Noun || arr(r.p.Noun).some((n) => wildcard(n).test(c.name.split('-').slice(1).join('-')))) && (!r.p.Module || arr(r.p.Module).some((m) => wildcard(m).test(c.module))));
  const ownFunctions = (match: (n: string) => boolean) => (r.p.Module ? [] : functions.filter((f) => match(String(f.props.Name))));
  const byName = (a: PSObject, b: PSObject) => String(a.props.Name).localeCompare(String(b.props.Name));
  if (!names.length) return [...all.map(commandItem), ...ownFunctions((n) => (!r.p.Verb || arr(r.p.Verb).some((v) => wildcard(v).test(n.split('-')[0]))) && (!r.p.Noun || arr(r.p.Noun).some((x) => wildcard(x).test(n.split('-').slice(1).join('-')))))].sort(byName);
  const out: unknown[] = [];
  for (const n of names) {
    const aliases = Object.keys(ALIASES).filter((a) => wildcard(n).test(a) && cmdletNamed(a) && visible.includes(cmdletNamed(a)!));
    all = visible.filter((c) => wildcard(n).test(c.name));
    const mine = ownFunctions((x) => wildcard(n).test(x));
    const apps = NATIVES.filter((x) => wildcard(n).test(x.name) || wildcard(n).test(x.name.replace(/\.exe$/, ''))).map((x) => x.name);
    if (!aliases.length && !all.length && !apps.length && !mine.length && !/[*?]/.test(n))
      r.fail({
        message: `The term '${n}' is not recognized as the name of a cmdlet, function, script file, or operable program. Check the spelling of the name, or if a path was included, verify that the path is correct and try again.`,
        category: 'ObjectNotFound', target: `${n}:String`, exception: 'CommandNotFoundException', id: 'CommandNotFoundException,Microsoft.PowerShell.Commands.GetCommandCommand',
      });
    out.push(...aliases.map(aliasItem), ...[...all.map(commandItem), ...mine].sort(byName), ...apps.map(appItem));
  }
  return out;
}

function getAlias(r: Run): unknown[] {
  const names = arr(r.p.Name);
  const definition = arr(r.p.Definition);
  const visible = (a: string) => {
    const c = cmdletNamed(a);
    return !!c && visibleCmdlets(r.game).includes(c);
  };
  const keys = Object.keys(ALIASES)
    .filter(visible)
    .filter((a) => (!names.length || names.some((n) => wildcard(n).test(a))) && (!definition.length || definition.some((d) => wildcard(d).test(ALIASES[a]))))
    .sort();
  if (!keys.length && names.length && !names.some((n) => /[*?]/.test(n)))
    r.fail({ message: `This command cannot find a matching alias because an alias with the name '${names[0]}' does not exist.`, category: 'ObjectNotFound', target: `${names[0]}:String`, exception: 'ItemNotFoundException', id: 'ItemNotFoundException,Microsoft.PowerShell.Commands.GetAliasCommand' });
  return keys.map((a) => ({ type: 'CommandInfo', props: { CommandType: 'Alias', Name: `${a} -> ${ALIASES[a]}`, Version: '', Source: '' } }));
}

function getVariable(r: Run): unknown[] {
  const names = arr(r.p.Name);
  const all = Object.values(vars(r.game)).filter((v) => !names.length || names.some((n) => wildcard(n).test(v.name)));
  if (r.p.ValueOnly) return all.map((v) => v.value);
  return all.sort((a, b) => a.name.localeCompare(b.name)).map((v) => ({ type: 'PSVariable', props: { Name: v.name, Value: v.value } }));
}

/** The modules of the machine: those of its cmdlets (ActiveDirectory only where it is installed). */
function modules(game: Shell): string[] {
  return [...new Set(visibleCmdlets(game).map((c) => c.module))].sort((a, b) => a.localeCompare(b));
}

/**
 * Import-Module NAME: a module of the machine (already available: 5.1
 * loads modules on first use) or a .psm1/.ps1 file, whose functions join
 * the session (about_Modules).
 */
function importModule(r: Run): unknown[] {
  for (const name of arr(r.p.Name)) {
    if (/\.ps(m?)1$/i.test(name)) {
      const where = resolveWindows(r.game, name);
      const node = where.exists ? r.game.find(where.path) : null;
      if (node?.type === 'file') {
        r.source(r.game.read(where.path) ?? '', toWindows(where.path));
        continue;
      }
    } else if (modules(r.game).some((m) => m.toLowerCase() === name.toLowerCase())) continue;
    r.fail({ message: `The specified module '${name}' was not loaded because no valid module file was found in any module directory.`, category: 'ResourceUnavailable', target: `${name}:String`, exception: 'FileNotFoundException', id: 'Modules_ModuleNotFound,Microsoft.PowerShell.Commands.ImportModuleCommand' });
  }
  return [];
}

function getModule(r: Run): unknown[] {
  const names = arr(r.p.Name);
  const all = modules(r.game).filter((m) => !names.length || names.some((n) => wildcard(n).test(m)));
  const kinds = (m: string) => visibleCmdlets(r.game).filter((c) => c.module === m);
  return all.map((m) => ({ type: 'PSModuleInfo', props: { ModuleType: m.startsWith('Microsoft.PowerShell') ? 'Manifest' : 'Script', Version: kinds(m)[0]?.version || '1.0.0.0', Name: m, ExportedCommands: `{${kinds(m).map((c) => c.name).slice(0, 4).join(', ')}${kinds(m).length > 4 ? '...' : ''}}` } }));
}

const PIPE_CMDLETS: Cmdlet[] = [
  {
    name: 'Where-Object', module: CORE, version: '3.0.0.0', positional: ['Property', 'Value'],
    params: [
      { name: 'FilterScript', type: 'System.Management.Automation.ScriptBlock' }, { name: 'Property', type: 'System.String' }, { name: 'Value', type: 'System.Object' }, { name: 'InputObject', type: 'System.Management.Automation.PSObject' },
      ...['EQ', 'NE', 'GT', 'GE', 'LT', 'LE', 'Like', 'NotLike', 'Match', 'NotMatch', 'Contains', 'NotContains', 'In', 'NotIn', 'CEQ', 'CNE', 'CLike', 'CMatch'].map((n) => ({ name: n, switch: true })),
    ],
    run: whereObject,
  },
  {
    name: 'ForEach-Object', module: CORE, version: '3.0.0.0', rest: 'Process',
    params: [{ name: 'Process', type: 'System.Management.Automation.ScriptBlock[]', list: true }, { name: 'Begin', type: 'System.Management.Automation.ScriptBlock' }, { name: 'End', type: 'System.Management.Automation.ScriptBlock' }, { name: 'MemberName', type: 'System.String' }, { name: 'InputObject', type: 'System.Management.Automation.PSObject' }],
    run: forEachObject,
  },
  { name: 'Sort-Object', module: UTIL, version: '3.1.0.0', positional: ['Property'], params: [{ name: 'Property', list: true, type: 'System.Object[]' }, { name: 'Descending', switch: true }, { name: 'Unique', switch: true }, { name: 'InputObject', type: 'System.Management.Automation.PSObject' }], run: sortObject },
  {
    name: 'Select-Object', module: UTIL, version: '3.1.0.0', positional: ['Property'],
    params: [{ name: 'Property', list: true, type: 'System.Object[]' }, { name: 'First', type: 'System.Int32' }, { name: 'Last', type: 'System.Int32' }, { name: 'Skip', type: 'System.Int32' }, { name: 'Index', list: true, type: 'System.Int32[]' }, { name: 'ExpandProperty', type: 'System.String' }, { name: 'Unique', switch: true }, { name: 'InputObject', type: 'System.Management.Automation.PSObject' }],
    run: selectObject,
  },
  { name: 'Group-Object', module: UTIL, version: '3.1.0.0', positional: ['Property'], params: [{ name: 'Property', list: true, type: 'System.Object[]' }, { name: 'NoElement', switch: true }, { name: 'InputObject', type: 'System.Management.Automation.PSObject' }], run: groupObject },
  {
    name: 'Measure-Object', module: UTIL, version: '3.1.0.0', positional: ['Property'],
    params: [{ name: 'Property', list: true, type: 'System.String[]' }, { name: 'Sum', switch: true }, { name: 'Average', switch: true }, { name: 'Maximum', switch: true }, { name: 'Minimum', switch: true }, { name: 'Line', switch: true }, { name: 'Word', switch: true }, { name: 'Character', switch: true }, { name: 'InputObject', type: 'System.Management.Automation.PSObject' }],
    run: measureObject,
  },
  { name: 'Format-Table', module: UTIL, version: '3.1.0.0', positional: ['Property'], params: [{ name: 'Property', list: true, type: 'System.Object[]' }, { name: 'AutoSize', switch: true }, { name: 'Wrap', switch: true }, { name: 'HideTableHeaders', switch: true }], run: (r) => formatted(r, 'table') },
  { name: 'Format-List', module: UTIL, version: '3.1.0.0', positional: ['Property'], params: [{ name: 'Property', list: true, type: 'System.Object[]' }], run: (r) => formatted(r, 'list') },
  { name: 'Out-String', module: UTIL, version: '3.1.0.0', params: [{ name: 'Stream', switch: true }, { name: 'Width', type: 'System.Int32' }], run: (r) => (r.p.Stream ? render(r.input ?? []).split('\n') : [`${render(r.input ?? [])}\n`]) },
  { name: 'Out-Null', module: CORE, version: '3.0.0.0', params: [{ name: 'InputObject', type: 'System.Management.Automation.PSObject' }], run: () => [] },
  { name: 'Out-Host', module: CORE, version: '3.0.0.0', params: [{ name: 'Paging', switch: true }], run: (r) => [render(r.input ?? [])] },
  { name: 'Write-Output', module: UTIL, version: '3.1.0.0', rest: 'InputObject', params: [{ name: 'InputObject', list: true, type: 'System.Management.Automation.PSObject[]' }, { name: 'NoEnumerate', switch: true }], run: ({ p }) => values(p.InputObject) },
  {
    name: 'Write-Host', module: UTIL, version: '3.1.0.0', rest: 'Object',
    params: [{ name: 'Object', list: true, type: 'System.Object' }, { name: 'NoNewline', switch: true }, { name: 'Separator', type: 'System.Object' }, { name: 'ForegroundColor', type: 'System.ConsoleColor' }, { name: 'BackgroundColor', type: 'System.ConsoleColor' }],
    run: (r) => {
      r.host(values(r.p.Object).map(text).join(r.p.Separator !== undefined ? text(r.p.Separator) : ' '));
      return [];
    },
  },
  {
    name: 'Write-Warning', module: UTIL, version: '3.1.0.0', positional: ['Message'], params: [{ name: 'Message', type: 'System.String' }],
    run: (r) => {
      r.host(`WARNING: ${str(r.p.Message)}`);
      return [];
    },
  },
  {
    name: 'Write-Error', module: UTIL, version: '3.1.0.0', positional: ['Message'], params: [{ name: 'Message', type: 'System.String' }],
    run: (r) => {
      r.fail({ message: str(r.p.Message), category: 'NotSpecified', target: ':', exception: 'WriteErrorException', id: 'Microsoft.PowerShell.Commands.WriteErrorException' });
      return [];
    },
  },
  { name: 'Clear-Host', module: CORE, version: '', kind: 'Function', params: [], run: () => null },
  { name: 'Get-Help', module: CORE, version: '3.0.0.0', positional: ['Name'], params: [{ name: 'Name', type: 'System.String' }, { name: 'Examples', switch: true }, { name: 'Detailed', switch: true }, { name: 'Full', switch: true }, { name: 'Parameter', type: 'System.String' }, { name: 'Online', switch: true }], run: getHelp },
  { name: 'Get-Command', module: CORE, version: '3.0.0.0', positional: ['Name'], params: [{ name: 'Name', list: true }, { name: 'Verb', list: true }, { name: 'Noun', list: true }, { name: 'Module', list: true }, { name: 'CommandType', list: true }], run: getCommand },
  { name: 'Get-Alias', module: UTIL, version: '3.1.0.0', positional: ['Name'], params: [{ name: 'Name', list: true }, { name: 'Definition', list: true }], run: getAlias },
  { name: 'Get-Member', module: UTIL, version: '3.1.0.0', positional: ['Name'], params: [{ name: 'Name', list: true }, { name: 'MemberType', list: true }, { name: 'InputObject', type: 'System.Management.Automation.PSObject' }], run: getMemberCmdlet },
  { name: 'Get-Date', module: UTIL, version: '3.1.0.0', positional: ['Date'], params: [{ name: 'Date', type: 'System.DateTime' }, { name: 'Format', type: 'System.String' }], run: getDate },
  { name: 'Read-Host', module: UTIL, version: '3.1.0.0', positional: ['Prompt'], params: [{ name: 'Prompt', type: 'System.Object' }, { name: 'AsSecureString', switch: true }], run: readHost },
  { name: 'New-Object', module: UTIL, version: '3.1.0.0', positional: ['TypeName', 'ArgumentList'], params: [{ name: 'TypeName', type: 'System.String' }, { name: 'ArgumentList', list: true, type: 'System.Object[]' }, { name: 'Property', type: 'System.Collections.IDictionary' }], run: newObject },
  {
    name: 'Select-String', module: UTIL, version: '3.1.0.0', positional: ['Pattern', 'Path'],
    params: [{ name: 'Pattern', list: true }, { name: 'Path', list: true }, { name: 'SimpleMatch', switch: true }, { name: 'CaseSensitive', switch: true }, { name: 'NotMatch', switch: true }, { name: 'InputObject', type: 'System.Management.Automation.PSObject' }],
    run: selectString,
  },
  { name: 'Get-Variable', module: UTIL, version: '3.1.0.0', positional: ['Name'], params: [{ name: 'Name', list: true }, { name: 'ValueOnly', switch: true }], run: getVariable },
  {
    name: 'Import-Module', module: CORE, version: '3.0.0.0', positional: ['Name'], params: [{ name: 'Name', list: true }, { name: 'Force', switch: true }, { name: 'PassThru', switch: true }],
    run: importModule,
  },
  { name: 'Get-Module', module: CORE, version: '3.0.0.0', positional: ['Name'], params: [{ name: 'Name', list: true }, { name: 'ListAvailable', switch: true }], run: getModule },
  { name: 'Start-Sleep', module: UTIL, version: '3.1.0.0', positional: ['Seconds'], params: [{ name: 'Seconds', type: 'System.Double' }, { name: 'Milliseconds', type: 'System.Int32' }], run: () => [] },
  {
    name: 'Get-History', module: CORE, version: '3.0.0.0', positional: ['Id'], params: [{ name: 'Id', list: true, type: 'System.Int64[]' }, { name: 'Count', type: 'System.Int32' }],
    run: (r) => r.game.history.slice(r.p.Count !== undefined ? -Number(r.p.Count) : 0).map((l, i, all) => ({ type: 'HistoryInfo', props: { Id: r.game.history.length - all.length + i + 1, CommandLine: l } })),
  },
];

CMDLETS.push(...PIPE_CMDLETS, ...FILE_CMDLETS, ...ACL_CMDLETS, ...ACCOUNT_CMDLETS, ...SERVICE_CMDLETS, ...EVENT_CMDLETS, ...TASK_CMDLETS, ...SYSTEM_CMDLETS, ...FIREWALL_CMDLETS, ...AD_CMDLETS, ...GPO_CMDLETS);

Object.assign(VIEWS, FILE_VIEWS, ACL_VIEWS, ACCOUNT_VIEWS, SERVICE_VIEWS, EVENT_VIEWS, TASK_VIEWS, SYSTEM_VIEWS, FIREWALL_VIEWS, AD_VIEWS, GPO_VIEWS, {
  CommandInfo: { columns: ['CommandType', 'Name', 'Version', 'Source'].map((n) => ({ label: n, value: (o: PSObject) => o.props[n] })) },
  PathInfo: { columns: [{ label: 'Path', value: (o: PSObject) => o.props.Path }] },
  GenericMeasureInfo: { columns: [], list: true },
  TextMeasureInfo: { columns: ['Lines', 'Words', 'Characters', 'Property'].map((n) => ({ label: n, value: (o: PSObject) => o.props[n], right: n !== 'Property' })) },
  GroupInfo: { columns: [{ label: 'Count', value: (o: PSObject) => o.props.Count, right: true }, { label: 'Name', value: (o: PSObject) => o.props.Name }, { label: 'Group', value: (o: PSObject) => `{${(o.props.Group as unknown[]).map(text).join(', ')}}` }] },
  GroupInfoNoElement: { columns: [{ label: 'Count', value: (o: PSObject) => o.props.Count, right: true }, { label: 'Name', value: (o: PSObject) => o.props.Name }] },
  MemberDefinition: { group: (o: PSObject) => `   TypeName: ${o.group}`, columns: ['Name', 'MemberType', 'Definition'].map((n) => ({ label: n, value: (o: PSObject) => o.props[n] })) },
  ErrorRecord: { columns: [], asText: true },
  RuntimeType: { columns: ['IsPublic', 'IsSerial', 'Name', 'BaseType'].map((n) => ({ label: n, value: (o: PSObject) => o.props[n] })) },
  MatchInfo: { columns: [], asText: true },
  TimeSpan: { columns: [], list: true },
  PSVariable: { columns: ['Name', 'Value'].map((n) => ({ label: n, value: (o: PSObject) => o.props[n] })) },
  PSModuleInfo: { columns: ['ModuleType', 'Version', 'Name', 'ExportedCommands'].map((n) => ({ label: n, value: (o: PSObject) => o.props[n] })) },
  HistoryInfo: { columns: [{ label: 'Id', value: (o: PSObject) => o.props.Id, right: true }, { label: 'CommandLine', value: (o: PSObject) => o.props.CommandLine }] },
} satisfies Record<string, View>);

// ——— A line typed at the PS prompt ———

function parseErrorText(ctx: Ctx, e: ParseError): string {
  const before = ctx.source.slice(0, e.pos);
  const lineNo = before.split('\n').length;
  const col = e.pos - (before.lastIndexOf('\n') + 1);
  const lineText = ctx.source.split('\n')[lineNo - 1] ?? '';
  return [
    ctx.file ? `At ${ctx.file}:${lineNo} char:${col + 1}` : `At line:${lineNo} char:${col + 1}`,
    `+ ${lineText}`,
    `+ ${' '.repeat(col)}~`,
    e.message,
    '    + CategoryInfo          : ParserError: (:) [], ParentContainsErrorRecordException',
    `    + FullyQualifiedErrorId : ${e.id}`,
    ' ',
  ].join('\n');
}


/** Runs statements from `from`, with the answers to the current one; a question asks and continues on the next line. */
function runFrom(game: Shell, line: string, statements: Statement[], from: number, answers: string[], before: string[]): string | null {
  const ctx: Ctx = { game, source: line, out: [...before], answers, asked: 0, frames: [], errors: [], commands: [], script: false, mute: 0, merged: null, ok: true };
  let clear = false;
  const finish = () => {
    for (const e of ctx.errors) if (e) game.error(e);
    const shown = ctx.out.filter((x) => x !== '\u001bclear');
    clear = ctx.out.includes('\u001bclear');
    const output = shown.join('\n').replace(/\n+$/, '');
    ctx.ok &&= !failed;
    game.last = { line: line.trim(), commands: [...(game.last.line === line.trim() ? game.last.commands : []), ...ctx.commands], output, errors: [...ctx.errors], redirection: null };
    if (!ctx.ok && game.status === null) game.status = 1;
    return clear ? null : output;
  };
  let failed = false;
  for (let i = from; i < statements.length; i++) {
    const outBefore = ctx.out.length;
    failed ||= !ctx.ok;
    ctx.ok = true;
    try {
      const items = runStatement(ctx, statements[i]);
      if (items.length) ctx.out.push(render(items));
      game.state.psSuccess = ctx.ok;
    } catch (e) {
      if (e instanceof Suspend) {
        // Ask, then run this statement again in full with the answer, and go on.
        ctx.out.length = outBefore;
        ctx.out.push(...e.lines);
        const partial = finish();
        const given = ctx.answers.slice(0, ctx.asked);
        game.ask(e.prompt, (answer) => runFrom(game, line, statements, i, [...given, answer], []) ?? '', e.secret);
        return partial ?? '';
      }
      if (e instanceof Exit) {
        vars(game).lastexitcode = { name: 'LASTEXITCODE', value: e.code };
        const w = windows(game);
        w.shells = (w.shells ?? ['powershell']).slice(0, -1);
        if (!w.shells.length) game.output = true;
        return finish();
      }
      if (e instanceof Terminate) {
        if (e.record) emitError(ctx, e.record);
        else ctx.ok = false;
        // throw, -ErrorAction Stop: the rest of the line doesn't run.
        if (e.fatal) break;
        continue;
      }
      // return at the prompt: its value, and the rest of the line doesn't run (a stray break or continue too).
      if (e instanceof Flow) {
        if (e.items.length) ctx.out.push(render(e.items));
        break;
      }
      throw e;
    }
    ctx.answers = [];
    ctx.asked = 0;
  }
  return finish();
}

/** One line at the "PS C:\Users\you>" prompt: its output (errors included), or null for Clear-Host. */
export function runPowerShell(game: Shell, line: string): string | null {
  game.recoverErrors();
  game.status = null;
  const source = line.replace(/\r/g, '');
  if (!source.trim()) return '';
  game.typedCommands++;
  game.commandLine = source.trim();
  game.last = { line: '', commands: [], output: '', errors: [], redirection: null };
  const statements = parse(source);
  if (statements instanceof ParseError) {
    const ctx = { source } as Ctx;
    const text = parseErrorText(ctx, statements);
    game.error(text);
    game.status = 1;
    game.last = { line: source.trim(), commands: [], output: text, errors: [text], redirection: null };
    return text;
  }
  return runFrom(game, source, statements, 0, [], []);
}

/** A script run by a scheduled task (powershell.exe -File): its exit code. */
export function runScript(game: Shell, source: string, path: string): number {
  // A new powershell.exe: its own variables ($ErrorActionPreference is Continue), not the session's.
  const ctx: Ctx = { game, source: source.replace(/\r\n/g, '\n'), file: toWindows(path), out: [], answers: [], asked: 0, frames: [], errors: [], commands: [], script: true, mute: 0, merged: null, ok: true, scope: { vars: {}, isolated: true } };
  const statements = parse(ctx.source);
  if (statements instanceof ParseError) return 1;
  const errorsBefore = errorList(game).length;
  const failuresBefore = (game.state.psFailures as number | undefined) ?? 0;
  const code = ((): number => {
    for (const st of statements) {
      try {
        ctx.ok = true;
        runStatement(ctx, st);
        game.state.psSuccess = ctx.ok;
      } catch (e) {
        if (e instanceof Exit) return e.code;
        // throw, -ErrorAction Stop: the script stops, powershell.exe -File exits with 1.
        if (e instanceof Terminate && e.fatal) {
          ctx.errors.push(e.record);
          return 1;
        }
        if (e instanceof Terminate) {
          if (e.record) ctx.errors.push(e.record);
          continue;
        }
        if (e instanceof Suspend) continue;
        if (e instanceof Flow) return 0;
        throw e;
      }
    }
    return 0;
  })();
  // The errors of that other process don't go to the session's $Error. What the runs were is
  // kept (a story reads whether a script's failures showed in its exit code).
  errorList(game).splice(0, errorList(game).length - errorsBefore);
  const runs = (game.state.psScriptRuns ??= []) as ScriptRun[];
  runs.push({ file: toWindows(path), code, failures: ((game.state.psFailures as number | undefined) ?? 0) - failuresBefore, errors: ctx.errors.map((x) => x.split('\n')[0]), at: windows(game).clock, who: game.who });
  return code;
}

/** A script run by powershell.exe -File: its exit code, how many errors it met, the errors left unhandled. */
export interface ScriptRun {
  file: string;
  code: number;
  failures: number;
  errors: string[];
  at: number;
  who: string;
}
scripting.run = (game, source, path) => runScript(game, source, path);
SHELL_HOOKS.script = (game, source, file) => runScript(game, source, file);
SHELL_HOOKS.powershell = (game, line) => {
  const w = windows(game);
  const shells = w.shells;
  w.shells = [...(shells ?? []), 'powershell'];
  try {
    return runPowerShell(game, line) ?? '';
  } finally {
    w.shells = shells;
  }
};
ENV_HOOK.get = environment;
RENDER.fn = render;
Object.assign(NEW_OBJECT, ACL_TYPES);

// ——— cmd.exe and the shells ———

export { CMD_BANNER, POWERSHELL_BANNER, currentShell };
export type { WinShell };

// ——— Completion (Tab) ———

/** What Tab completes at the PS prompt: a command name, a parameter, or a path. */
export function psCandidates(game: Shell, line: string): { before: string; names: string[] } {
  const m = /^(.*?)(\S*)$/.exec(line)!;
  const before = m[1];
  const word = m[2];
  const head = /(?:^|[|;]\s*)(\S*)$/.exec(line);
  const atCommand = !!head && head[1] === word && !/\s$/.test(line.slice(0, line.length - word.length).replace(/[|;]\s*$/, '')) ? true : /(^|[|;]\s*)$/.test(before);
  if (atCommand) {
    const low = word.toLowerCase();
    const visible = visibleCmdlets(game).map((c) => c.name);
    const names = [...visible, ...Object.values(sessionFunctions(game)).map((f) => f.name), ...NATIVES.map((x) => x.name)].filter((n) => n.toLowerCase().startsWith(low)).sort((a, b) => a.localeCompare(b));
    return { before, names };
  }
  if (word.startsWith('-')) {
    const cmd = /(?:^|[|;]\s*)(\S+)[^|;]*$/.exec(before)?.[1] ?? '';
    const c = cmdletNamed(cmd);
    if (!c) return { before, names: [] };
    const low = word.slice(1).toLowerCase();
    return { before, names: allParams(c).map((x) => `-${x.name}`).filter((n) => n.slice(1).toLowerCase().startsWith(low)) };
  }
  // A path: the directory part, then the names in it.
  const cut = Math.max(word.lastIndexOf('\\'), word.lastIndexOf('/'));
  const dirTyped = cut >= 0 ? word.slice(0, cut + 1) : '';
  const start = word.slice(cut + 1).toLowerCase();
  const dir = resolveWindows(game, dirTyped || '.');
  const node = dir.exists ? game.find(dir.path) : null;
  if (node?.type !== 'directory') return { before, names: [] };
  const names = Object.keys(node.children)
    .filter((n) => n.toLowerCase().startsWith(start))
    .sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()))
    .map((n) => `${dirTyped}${n}${node.children[n].type === 'directory' ? '\\' : ''}`);
  return { before, names };
}

/** Tab at the PS prompt: like PowerShell, the first match (with .\ for a relative path); the common part when several. */
export function psComplete(game: Shell, line: string): string {
  const { before, names } = psCandidates(game, line);
  if (!names.length) return line;
  if (names.length === 1) return `${before}${names[0]}${names[0].endsWith('\\') ? '' : ' '}`;
  let common = names[0];
  for (const n of names) while (!n.toLowerCase().startsWith(common.toLowerCase())) common = common.slice(0, -1);
  return common.length > line.length - before.length ? `${before}${common}` : line;
}

// ——— The manual: each cmdlet has its page (man Get-ChildItem on Linux, Get-Help in PowerShell) ———

const onLinux = ({ game }: { game: Shell }) => {
  game.status = 127;
  return game.error(game.t('command-missing', { command: game.commandLine.split(/\s+/)[0] }));
};

export const POWERSHELL: Record<string, Command> = Object.fromEntries([
  ...CMDLETS.map((c) => [c.name, { cmdlet: true, ownOptions: true, launch: onLinux } as Command]),
  ...NATIVES.filter((n) => n.page).map((n) => [n.page!, { winexe: true, ownOptions: true, launch: onLinux } as Command]),
]);
