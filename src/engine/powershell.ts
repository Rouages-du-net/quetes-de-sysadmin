// Windows PowerShell 5.1's runtime, the part shared by the interpreter
// (commands/powershell.ts, with the parser in powershell-parse.ts) and the
// cmdlets (commands/windows-*.ts): the values that go through a pipeline
// (OBJECTS, not text: PSObject with a type and ordered properties, dates,
// hashtables, script blocks, secure strings), how a cmdlet is declared
// (parameters, positions, -WhatIf support) and what it receives (Run), and
// the formatting at the end of a line (Out-Default: a table, or a list for
// objects with five properties or more, or the type's own view). Errors
// keep PowerShell 5.1's layout: the message, "At line:1 char:N", the line
// underlined, CategoryInfo and FullyQualifiedErrorId.
// Sources (Microsoft Learn, PowerShell 5.1): about_Pipelines,
// about_Parameters, about_Command_Syntax, about_Format.ps1xml,
// about_Comparison_Operators, about_Numeric_Literals (KB, MB, GB, TB),
// about_CommonParameters (-WhatIf, -Confirm, -ErrorAction),
// about_Preference_Variables ($ConfirmPreference: High),
// https://learn.microsoft.com/powershell/scripting/learn/ps101/04-pipelines
// Simplifications (docs/SCENARIOS.md): tables sized to their content (no
// truncation to the window), no Unicode box tables.

import type { Shell } from './shell';
import type { Statement } from './powershell-parse';
import { longDate } from './windows';

/** A date property: shown like en-US Windows (11/20/2029 7:41:12 AM). */
export class PSDate {
  constructor(public ms: number) {}
  toString() {
    return longDate(this.ms);
  }
}

/** An object in the pipeline: its type (for its view) and its properties, in order. */
export interface PSObject {
  type: string;
  props: Record<string, unknown>;
  // What a view groups the objects by (a file's directory, an event's provider).
  group?: string;
  // The .NET type's full name (System.IO.FileInfo), for GetType(), -is and Get-Member.
  fullType?: string;
  // Its methods (lower-case names), called as $x.Name(args).
  methods?: Record<string, (args: unknown[]) => unknown>;
  // What it shows in a cell or a string ("$x"), when not its type's name.
  text?: string;
  // What the engine keeps with it, not shown (an ACL's entries, a rule's ACE).
  data?: unknown;
}
export type Item = string | number | PSObject;

/** A hashtable (@{ }): keys compared without case, in the order they were written. */
export class PSHashtable {
  map = new Map<string, { key: string; value: unknown }>();
  constructor(entries: [string, unknown][] = []) {
    for (const [k, v] of entries) this.set(k, v);
  }
  set(key: string, value: unknown) {
    const old = this.map.get(key.toLowerCase());
    this.map.set(key.toLowerCase(), { key: old?.key ?? key, value });
  }
  get(key: string): unknown {
    return this.map.get(String(key).toLowerCase())?.value;
  }
  has(key: string) {
    return this.map.has(String(key).toLowerCase());
  }
  keys() {
    return [...this.map.values()].map((e) => e.key);
  }
  entries(): [string, unknown][] {
    return [...this.map.values()].map((e) => [e.key, e.value]);
  }
}

/** A script block ({ $_.Length -gt 1GB }): its statements and its text. */
export class PSScriptBlock {
  constructor(
    public body: Statement[],
    public text: string,
  ) {}
  toString() {
    return this.text;
  }
}

/** A SecureString (Read-Host -AsSecureString, ConvertTo-SecureString): it never shows its text. */
export class PSSecureString {
  constructor(public plain: string) {}
  toString() {
    return 'System.Security.SecureString';
  }
}

/** An error a method of an object throws (MethodInvocationException). */
export class MethodError {
  constructor(
    public message: string,
    public id = 'ArgumentException',
  ) {}
}

/** A type literal ([int], [math]): its name as typed. */
export class PSType {
  constructor(public name: string) {}
  toString() {
    return this.name;
  }
}

/** A cmdlet's parameter. */
export interface Param {
  name: string;
  switch?: boolean;
  aliases?: string[];
  // An array parameter (String[]): a single value becomes a list.
  list?: boolean;
  // The .NET type, named by "Missing an argument" (System.String[] for a list, System.String otherwise).
  type?: string;
}

/** A non-terminating error's parts (the position comes from the command). */
export type Failure = Pick<ErrorSpec, 'message' | 'category' | 'target' | 'exception' | 'id'>;

/** What a cmdlet receives. */
export interface Run {
  game: Shell;
  // The bound parameters (switches: true/false).
  p: Record<string, unknown>;
  // What came through the pipe (null for the first command).
  input: unknown[] | null;
  // A non-terminating error (the pipeline goes on).
  fail: (e: Failure) => void;
  // A terminating error (the statement stops).
  stop: (e: Failure) => never;
  // A line written to the screen at once (Write-Host, "What if:", WARNING:).
  host: (line: string) => void;
  // -WhatIf: says what would happen and returns false; otherwise true (or asks, for -Confirm,
  // and by default for a high-impact change unless -Force).
  should: (action: string, target: string, high?: boolean) => boolean;
  // A question to the user ([Y] Yes [N] No…): true for yes.
  confirm: (caption: string, message: string) => boolean;
  // Read-Host: the line typed (the prompt is asked first).
  read: (prompt: string, secret: boolean) => string;
  // Runs a script block with $_ (Where-Object, ForEach-Object, calculated properties).
  invoke: (block: PSScriptBlock, item?: unknown) => unknown[];
}

/** A native program (hostname.exe, icacls.exe…): its output, its errors, its exit code; a shell it starts. */
export interface NativeResult {
  out: string;
  err?: string;
  code: number;
  shell?: 'cmd' | 'powershell';
}
export interface Native {
  // Its name (icacls.exe); found with or without .exe.
  name: string;
  // Its manual page (man icacls), when it has one of its own.
  page?: string;
  run: (game: Shell, args: string[], input: string[] | null) => NativeResult;
}

export interface Cmdlet {
  name: string;
  module: string;
  version: string;
  kind?: 'Cmdlet' | 'Function';
  params: Param[];
  positional?: string[];
  // A parameter that takes every remaining positional value (Write-Output).
  rest?: string;
  // It changes something: -WhatIf and -Confirm apply; refused on a read-only machine (story 30).
  writes?: boolean;
  run: (r: Run) => unknown[] | null;
}

// ——— Helpers for cmdlets ———

/** A parameter's value as text (an array joined by commas, a switch as ''). */
export const str = (v: unknown): string => (Array.isArray(v) ? v.map((x) => text(x)).join(',') : v === undefined || v === null || v === true ? '' : text(v));
/** A parameter's values (a list parameter, or one value). */
export const arr = (v: unknown): string[] => (v === undefined || v === null || v === true ? [] : Array.isArray(v) ? v.flat(Infinity).map((x) => text(x)) : [text(v)]);
/** A parameter's values, kept as they are (objects included). */
export const values = (v: unknown): unknown[] => (v === undefined || v === null ? [] : Array.isArray(v) ? v.flat(Infinity) : [v]);

/** A value as a string (PowerShell's conversion: $true → True, an array joined by spaces). */
export function text(v: unknown): string {
  if (v === null || v === undefined) return '';
  if (typeof v === 'boolean') return v ? 'True' : 'False';
  if (typeof v === 'number') return Number.isInteger(v) ? String(v) : String(Number(v.toPrecision(15)));
  if (Array.isArray(v)) return v.map(text).join(' ');
  if (v instanceof PSHashtable) return 'System.Collections.Hashtable';
  if (isObject(v)) return v.text ?? (v.type.startsWith('Selected.') || v.type === 'PSCustomObject' ? `@{${Object.entries(v.props).map(([k, x]) => `${k}=${text(x)}`).join('; ')}}` : (v.fullType ?? v.type));
  return String(v);
}

/** The objects of the input or of a parameter, whose given property names them (Name, FullName…). */
export function targets(r: Run, param: string, prop: string): string[] {
  if (r.p[param] !== undefined) return arr(r.p[param]);
  return (r.input ?? []).map((x) => (isObject(x) ? text(property(x, prop) ?? '') : text(x))).filter(Boolean);
}



export const isObject = (x: unknown): x is PSObject => typeof x === 'object' && x !== null && 'props' in x && 'type' in x && !(x instanceof PSHashtable);

// ——— The line: tokens ———

export interface Token {
  text: string;
  pos: number;
  kind: 'word' | 'string' | 'block' | 'param' | 'pipe' | 'semi';
}

/** Splits a line like PowerShell's tokenizer, as far as the game needs. */
export function tokenize(line: string): Token[] | { error: string; pos: number } {
  const out: Token[] = [];
  let i = 0;
  while (i < line.length) {
    const c = line[i];
    if (/\s/.test(c)) {
      i++;
      continue;
    }
    const start = i;
    if (c === '|') {
      out.push({ text: '|', pos: i++, kind: 'pipe' });
      continue;
    }
    if (c === ';') {
      out.push({ text: ';', pos: i++, kind: 'semi' });
      continue;
    }
    if (c === '{') {
      let depth = 0;
      for (; i < line.length; i++) {
        if (line[i] === '{') depth++;
        else if (line[i] === '}' && --depth === 0) break;
      }
      if (i >= line.length) return { error: "Missing closing '}' in statement block or type definition.", pos: start };
      out.push({ text: line.slice(start, ++i), pos: start, kind: 'block' });
      continue;
    }
    if (c === "'" || c === '"') {
      const end = line.indexOf(c, i + 1);
      if (end < 0) return { error: `The string is missing the terminator: ${c}.`, pos: start };
      let text = line.slice(i + 1, end);
      i = end + 1;
      // 'a','b': a list.
      while (line[i] === ',') {
        const m = /^,\s*(?:'([^']*)'|"([^"]*)"|([^\s|;,]+))/.exec(line.slice(i));
        if (!m) break;
        text += ',' + (m[1] ?? m[2] ?? m[3]);
        i += m[0].length;
      }
      out.push({ text, pos: start, kind: 'string' });
      continue;
    }
    while (i < line.length && !/[\s|;]/.test(line[i])) {
      if (line[i] === "'" || line[i] === '"') {
        const end = line.indexOf(line[i], i + 1);
        i = end < 0 ? line.length : end + 1;
      } else i++;
    }
    const text = line.slice(start, i);
    // -Name, -Name:value, -? (but not -1, nor a lone -).
    const kind = /^-[A-Za-z?]/.test(text) ? 'param' : 'word';
    out.push({ text: kind === 'word' ? text.replace(/'([^']*)'|"([^"]*)"/g, '$1$2') : text, pos: start, kind });
  }
  return out;
}

// ——— Values ———

const SUFFIX: Record<string, number> = { kb: 1024, mb: 1024 ** 2, gb: 1024 ** 3, tb: 1024 ** 4, pb: 1024 ** 5 };

/** A literal: 12, 1.5GB, 'text', $true, $null. */
export function literal(text: string): unknown {
  const t = text.trim();
  const q = /^'([^']*)'$|^"([^"]*)"$/.exec(t);
  if (q) return q[1] ?? q[2];
  if (/^\$true$/i.test(t)) return true;
  if (/^\$false$/i.test(t)) return false;
  if (/^\$null$/i.test(t)) return null;
  const n = /^(-?\d+(?:\.\d+)?)(kb|mb|gb|tb|pb)?$/i.exec(t);
  if (n) return Number(n[1]) * (n[2] ? SUFFIX[n[2].toLowerCase()] : 1);
  return t;
}

/** A property, its name compared without case. */
export function property(o: unknown, name: string): unknown {
  if (o instanceof PSHashtable) return o.has(name) ? o.get(name) : name.toLowerCase() === 'count' ? o.map.size : undefined;
  if (o instanceof PSDate) return dateProperty(o, name);
  if (Array.isArray(o)) return /^(count|length)$/i.test(name) ? o.length : undefined;
  if (!isObject(o)) return name.toLowerCase() === 'length' && typeof o === 'string' ? o.length : undefined;
  const key = Object.keys(o.props).find((k) => k.toLowerCase() === name.toLowerCase());
  return key === undefined ? undefined : o.props[key];
}

const comparable = (x: unknown) => (x instanceof PSDate ? x.ms : x);

/** Compares two values like PowerShell: numbers as numbers, text without case. */
export function compare(a: unknown, b: unknown): number {
  const x = comparable(a);
  const y = comparable(b);
  if (x === undefined || x === null) return y === undefined || y === null ? 0 : -1;
  if (y === undefined || y === null) return 1;
  if (typeof x === 'number') {
    const n = Number(y);
    return Number.isNaN(n) ? String(x).localeCompare(String(y)) : x - n;
  }
  return String(x).toLowerCase().localeCompare(String(y).toLowerCase());
}

/** A wildcard (*, ?, [a-z]) as a regular expression, without case. */
export const wildcard = (pattern: string) =>
  new RegExp(`^${pattern.replace(/[.+^${}()|\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\?/g, '.')}$`, 'i');

/** The comparison operators of Where-Object (-eq, -gt, -like…). */
export function operate(op: string, a: unknown, b: unknown): boolean | null {
  switch (op.toLowerCase()) {
    case 'eq':
      return compare(a, b) === 0;
    case 'ne':
      return compare(a, b) !== 0;
    case 'gt':
      return a !== null && a !== undefined && compare(a, b) > 0;
    case 'ge':
      return a !== null && a !== undefined && compare(a, b) >= 0;
    case 'lt':
      return compare(a, b) < 0;
    case 'le':
      return compare(a, b) <= 0;
    case 'like':
      return wildcard(String(b)).test(String(a ?? ''));
    case 'notlike':
      return !wildcard(String(b)).test(String(a ?? ''));
    case 'match':
      return new RegExp(String(b), 'i').test(String(a ?? ''));
    case 'notmatch':
      return !new RegExp(String(b), 'i').test(String(a ?? ''));
  }
  return null;
}

/** A value as a table or a list shows it. */
export function show(v: unknown): string {
  if (v === null || v === undefined) return '';
  if (Array.isArray(v)) return `{${v.map(show).join(', ')}}`;
  return text(v);
}

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/** A DateTime's properties. */
export function dateProperty(d: PSDate, name: string): unknown {
  const x = new Date(d.ms);
  switch (name.toLowerCase()) {
    case 'year':
      return x.getUTCFullYear();
    case 'month':
      return x.getUTCMonth() + 1;
    case 'day':
      return x.getUTCDate();
    case 'hour':
      return x.getUTCHours();
    case 'minute':
      return x.getUTCMinutes();
    case 'second':
      return x.getUTCSeconds();
    case 'dayofweek':
      return DAYS[x.getUTCDay()];
    case 'dayofyear':
      return Math.floor((d.ms - Date.UTC(x.getUTCFullYear(), 0, 1)) / 86_400_000) + 1;
    case 'date':
      return new PSDate(Date.UTC(x.getUTCFullYear(), x.getUTCMonth(), x.getUTCDate()));
    case 'ticks':
      return (d.ms + 62_135_596_800_000) * 10_000;
  }
  return undefined;
}

/** A size as Get-Volume shows it: 500 GB, 11.38 MB. */
export function storageSize(n: number): string {
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let v = n;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return `${Number(v.toFixed(2))} ${units[i]}`;
}

// ——— Formatting (Out-Default) ———

export interface Column {
  label: string;
  value: (o: PSObject) => unknown;
  right?: boolean;
  // A value on several lines shows them all (the registry's Property column).
  wrap?: boolean;
  // The column's least width (the registry's Name: 30).
  width?: number;
}
export interface View {
  columns: Column[];
  // The header of each group ("    Directory: D:\Shares\plans").
  group?: (o: PSObject) => string;
  // Shown as a list by default.
  list?: boolean;
  // Shown as its text (MatchInfo: its line), between blank lines.
  asText?: boolean;
  // The properties Format-List shows without -Property (the type's list view), and how.
  listProps?: string[] | ((o: PSObject) => string[]);
  listValues?: Record<string, (o: PSObject) => unknown>;
}

/** A table: the header, its dashes, the rows; numbers on the right, the last column not padded. */
export function table(rows: PSObject[], columns: Column[]): string[] {
  // A value on several lines shows its first one, then "..." (like a cell too narrow).
  const cell = (v: unknown) => {
    const t = Array.isArray(v) && v.length && typeof v[0] === 'string' && v.some((x) => String(x).includes(' ')) ? `${v[0]}...` : show(v);
    return t.includes('\n') ? `${t.split('\n')[0]}...` : t;
  };
  const cells = rows.map((r) => columns.map((c) => (c.wrap ? show(c.value(r)) : cell(c.value(r)))));
  const widths = columns.map((c, i) => Math.max(c.width ?? 0, c.label.length, ...cells.map((r) => Math.max(...r[i].split('\n').map((l) => l.length)))));
  const right = columns.map((c) => c.right ?? rows.some((r) => typeof c.value(r) === 'number'));
  const line = (vals: string[]) =>
    vals
      .map((v, i) => (right[i] ? v.padStart(widths[i]) : i === vals.length - 1 ? v : v.padEnd(widths[i])))
      .join(' ')
      .trimEnd();
  // A wrapped cell: its next lines under it, the other columns blank.
  const rowLines = (vals: string[]) => {
    const parts = vals.map((v) => v.split('\n'));
    const height = Math.max(...parts.map((p) => p.length));
    return Array.from({ length: height }, (_, k) => line(parts.map((p) => p[k] ?? '')));
  };
  return [line(columns.map((c) => c.label)), line(columns.map((c) => '-'.repeat(c.label.length))), ...cells.flatMap(rowLines)];
}

/** A list: one "Name : value" line per property (a value's next lines aligned under it), objects separated by a blank line. */
export function list(rows: PSObject[], names?: string[] | ((o: PSObject) => string[]), values?: Record<string, (o: PSObject) => unknown>): string[] {
  const out: string[] = [];
  for (const r of rows) {
    const keys = typeof names === 'function' ? names(r) : (names ?? Object.keys(r.props));
    const w = Math.max(...keys.map((k) => k.length));
    out.push('');
    for (const k of keys) {
      const own = values?.[k];
      const v = own ? own(r) : property(r, k);
      const lines = Array.isArray(v) && own ? v.map(show) : show(v).split('\n');
      const head = `${k.padEnd(w)} : `;
      out.push(`${head}${lines[0] ?? ''}`.trimEnd(), ...lines.slice(1).map((l) => `${' '.repeat(head.length)}${l}`.trimEnd()));
    }
  }
  return out;
}

/** A plain table of the properties (Select-Object's objects, Format-Table -Property). */
export const propertyColumns = (names: string[]): Column[] =>
  names.map((n) => ({ label: n, value: (o: PSObject) => property(o, n) }));

/** Out-Default: what the pipeline's last items look like on the screen. */
export function outDefault(items: unknown[], views: Record<string, View>): string {
  const out: string[] = [];
  let i = 0;
  while (i < items.length) {
    const x = items[i];
    if (x instanceof PSHashtable) {
      // A hashtable: its Name and Value table (several in a row make one table).
      let j = i;
      const rows: PSObject[] = [];
      while (j < items.length && items[j] instanceof PSHashtable) {
        for (const [k, v] of (items[j] as PSHashtable).entries()) rows.push({ type: 'DictionaryEntry', props: { Name: k, Value: v } });
        j++;
      }
      const w = Math.max(30, ...rows.map((r) => String(r.props.Name).length));
      out.push('', `${'Name'.padEnd(w)} Value`, `${'----'.padEnd(w)} -----`, ...rows.map((r) => `${String(r.props.Name).padEnd(w)} ${show(r.props.Value)}`.trimEnd()), '');
      i = j;
      continue;
    }
    if (!isObject(x)) {
      if (x !== null && x !== undefined) out.push(show(x));
      i++;
      continue;
    }
    // The run of objects of the same type (and group) is one table.
    let j = i;
    while (j < items.length && isObject(items[j]) && (items[j] as PSObject).type === x.type) j++;
    const run = items.slice(i, j) as PSObject[];
    const view = views[x.type];
    if (view?.asText) out.push('', ...run.map((o) => text(o)), '');
    else if (view?.list || (!view && Object.keys(x.props).length >= 5)) out.push(...list(run, view?.listProps, view?.listValues), '');
    else if (!view) out.push('', ...table(run, propertyColumns(Object.keys(x.props))), '');
    else {
      let k = 0;
      while (k < run.length) {
        const g = view.group?.(run[k]);
        let m = k;
        while (m < run.length && view.group?.(run[m]) === g) m++;
        if (g !== undefined) out.push('', g, '');
        out.push(...(g === undefined ? [''] : []), ...table(run.slice(k, m), view.columns), '');
        k = m;
      }
    }
    i = j;
  }
  return out.join('\n').replace(/\n{3,}/g, '\n\n');
}

// ——— Errors, in PowerShell 5.1's layout ———

export interface ErrorSpec {
  // The message after "name : ".
  message: string;
  // Where the error points (char N) and how much is underlined.
  pos: number;
  length: number;
  category: string;
  target: string;
  // The cmdlet in the brackets ([Get-ChildItem]), '' for a command not found.
  cmdlet: string;
  exception: string;
  id: string;
}

export function errorRecord(invocation: string, line: string, e: ErrorSpec): string {
  return [
    `${invocation} : ${e.message}`,
    `At line:1 char:${e.pos + 1}`,
    `+ ${line}`,
    `+ ${' '.repeat(e.pos)}${'~'.repeat(Math.max(1, e.length))}`,
    `    + CategoryInfo          : ${e.category}: (${e.target}) [${e.cmdlet}], ${e.exception}`,
    `    + FullyQualifiedErrorId : ${e.id}`,
    ' ',
  ].join('\n');
}
