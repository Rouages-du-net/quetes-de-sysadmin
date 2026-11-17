// The PowerShell session a Windows Server's OpenSSH opens (DefaultShell set
// to Windows PowerShell 5.1), on the model of ../windows.ts and
// ../powershell.ts: a handful of READ-ONLY cmdlets, enough to look at a
// file server from the inside, with their aliases (ls, dir, cat, cd, pwd,
// sort, select, where…), their parameters and their errors. Get-Help (help,
// man) shows the game's manual in PowerShell's layout; on Linux, man
// Get-ChildItem shows the same page.
// Sources (Microsoft Learn, PowerShell 5.1, https://learn.microsoft.com/powershell/module/):
// Get-ChildItem, Get-Content, Set-Location, Get-Location, Get-Service,
// Get-PSDrive, Get-EventLog (Microsoft.PowerShell.Management);
// Get-WinEvent (Microsoft.PowerShell.Diagnostics); Sort-Object,
// Select-Object, Format-Table, Format-List, Measure-Object, Write-Output,
// Get-Alias (Microsoft.PowerShell.Utility); Where-Object, Get-Help,
// Get-Command (Microsoft.PowerShell.Core); Get-Volume (Storage);
// Get-SmbShare (SmbShare); about_Aliases.
// Differences (docs/SCENARIOS.md): the cmdlets that change something
// (Remove-Item, Restart-Service…) answer with a note of the game; a filter
// script block holds one comparison on $_; no variables, no expressions.

import type { Shell } from '../shell';
import type { Directory, Node } from '../world';
import type { Command } from './index';
import { manualParts } from './manual';
import { hidden, resolveWindows, shortDate, toWindows, volumeUsed, windows, type WinEvent } from '../windows';
import {
  PSDate, compare, errorRecord, isObject, list, literal, operate, outDefault, property, propertyColumns, show, storageSize, table, tokenize, wildcard,
  type ErrorSpec, type Item, type PSObject, type Token, type View,
} from '../powershell';

interface Param {
  name: string;
  switch?: boolean;
  aliases?: string[];
  // Comma-separated values (Name,Length).
  list?: boolean;
  // The type named by "Missing an argument" (System.String[] by default).
  type?: string;
}
interface Run {
  game: Shell;
  p: Record<string, string | string[] | boolean>;
  input: Item[] | null;
  // A non-terminating error (the pipeline goes on).
  fail: (e: Pick<ErrorSpec, 'message' | 'category' | 'target' | 'exception' | 'id'>) => void;
}
interface Cmdlet {
  name: string;
  module: string;
  version: string;
  kind?: 'Cmdlet' | 'Function';
  params: Param[];
  positional?: string[];
  // A parameter that takes every remaining positional value (Write-Output).
  rest?: string;
  // Writes nothing to the system: none of the game's cmdlets does.
  run: (r: Run) => Item[] | null;
}

// Common parameters (about_CommonParameters), accepted by every cmdlet.
const COMMON: Param[] = [{ name: 'ErrorAction', aliases: ['ea'], type: 'System.Management.Automation.ActionPreference' }, { name: 'Verbose', switch: true, aliases: ['vb'] }];

const str = (v: unknown) => (Array.isArray(v) ? v.join(',') : v === undefined || v === true ? '' : String(v));
const arr = (v: unknown): string[] => (v === undefined || v === true ? [] : Array.isArray(v) ? v : String(v).split(','));

// ——— Files ———

const DAY = 86_400_000;

function fileItem(game: Shell, path: string, n: Node): PSObject {
  const name = path.split('/').at(-1)!;
  const parent = path.replace(/\/[^/]+$/, '') || '/';
  const dir = n.type === 'directory';
  const mtime = (n as { mtime?: number }).mtime ?? windows(game).clock - 9 * DAY;
  const h = hidden(name);
  const mode = dir ? `d--${h ? 'hs' : '--'}-` : `-a${h ? '-h' : '--'}--`;
  const win = toWindows(path);
  return {
    type: 'FileSystemInfo',
    group: toWindows(parent),
    props: {
      Mode: mode,
      LastWriteTime: new PSDate(mtime),
      ...(dir ? {} : { Length: game.size(n) }),
      Name: name,
      FullName: win,
      Extension: dir || !name.includes('.') ? '' : name.slice(name.lastIndexOf('.')),
      ...(dir ? { Parent: toWindows(parent).split('\\').filter(Boolean).at(-1) ?? '' } : { DirectoryName: toWindows(parent) }),
      PSIsContainer: dir,
    },
  };
}

const notFound = (r: Run, cmdlet: string, win: string) =>
  r.fail({ message: `Cannot find path '${win}' because it does not exist.`, category: 'ObjectNotFound', target: `${win}:String`, exception: 'ItemNotFoundException', id: `PathNotFound,Microsoft.PowerShell.Commands.${cmdlet}Command` });

const sortedChildren = (d: Directory) =>
  Object.entries(d.children).sort(([a, x], [b, y]) => (x.type === y.type ? a.toLowerCase().localeCompare(b.toLowerCase()) : x.type === 'directory' ? -1 : 1));

function getChildItem(r: Run): Item[] {
  const { game, p } = r;
  const out: Item[] = [];
  const paths = arr(p.Path).length ? arr(p.Path) : ['.'];
  const filter = p.Filter ? wildcard(str(p.Filter)) : null;
  const force = !!p.Force;
  const depth = p.Depth !== undefined ? Number(p.Depth) : p.Recurse ? Infinity : 0;
  for (const typed of paths) {
    // A wildcard in the last part: D:\Shares\* .
    const wild = /[*?]/.test(typed.split(/[\\/]/).at(-1) ?? '');
    const where = resolveWindows(game, wild ? typed.replace(/[\\/]?[^\\/]*$/, '') || '.' : typed);
    const node = where.exists ? game.find(where.path) : null;
    if (!node) {
      notFound(r, 'GetChildItem', toWindows(where.path));
      continue;
    }
    if (node.type === 'file') {
      out.push(fileItem(game, where.path, node));
      continue;
    }
    const pattern = wild ? wildcard(typed.split(/[\\/]/).at(-1)!) : null;
    const walk = (path: string, d: Directory, level: number, rel: string) => {
      const kids = sortedChildren(d).filter(([n]) => force || !hidden(n));
      for (const [n, c] of kids) {
        if ((pattern && level === 0 && !pattern.test(n)) || (filter && !filter.test(n))) continue;
        if ((p.File && c.type !== 'file') || (p.Directory && c.type !== 'directory')) continue;
        out.push(p.Name ? `${rel}${n}` : fileItem(game, `${path}/${n}`, c));
      }
      if (level >= depth) return;
      for (const [n, c] of kids) if (c.type === 'directory' && (!pattern || level > 0 || pattern.test(n))) walk(`${path}/${n}`, c, level + 1, `${rel}${n}\\`);
    };
    walk(where.path === '/' ? '' : where.path, node, 0, '');
  }
  return out;
}

function getContent(r: Run): Item[] {
  const { game, p } = r;
  const out: Item[] = [];
  for (const typed of arr(p.Path)) {
    const where = resolveWindows(game, typed);
    const n = where.exists ? game.find(where.path) : null;
    const win = toWindows(where.path);
    if (!n) {
      notFound(r, 'GetContent', win);
      continue;
    }
    if (n.type === 'directory') {
      r.fail({ message: `Access to the path '${win}' is denied.`, category: 'PermissionDenied', target: `${win}:String`, exception: 'UnauthorizedAccessException', id: 'GetContentReaderUnauthorizedAccessError,Microsoft.PowerShell.Commands.GetContentCommand' });
      continue;
    }
    let lines = (game.read(where.path) ?? '').replace(/\r\n/g, '\n').split('\n');
    if (p.TotalCount !== undefined) lines = lines.slice(0, Number(p.TotalCount));
    if (p.Tail !== undefined) lines = lines.slice(-Number(p.Tail));
    out.push(...lines);
  }
  return out;
}

function setLocation(r: Run): Item[] {
  const { game, p } = r;
  const typed = str(p.Path) || '~';
  const where = resolveWindows(game, typed);
  const n = where.exists ? game.find(where.path) : null;
  if (n?.type !== 'directory') {
    notFound(r, 'SetLocation', toWindows(where.path));
    return [];
  }
  game.old = game.cwd;
  game.cwd = where.path;
  return [];
}

// ——— Services, drives, volumes, events, shares ———

function getService(r: Run): Item[] {
  const { game, p } = r;
  const all = [...windows(game).services].sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()));
  const item = (s: (typeof all)[number]): PSObject => ({ type: 'ServiceController', props: { Status: s.status, Name: s.name, DisplayName: s.display, StartType: s.start, ServiceName: s.name } });
  const names = arr(p.Name);
  const displays = arr(p.DisplayName);
  if (!names.length && !displays.length) return all.map(item);
  const out: Item[] = [];
  for (const n of names) {
    const found = all.filter((s) => wildcard(n).test(s.name) || wildcard(n).test(s.display));
    if (!found.length && !/[*?]/.test(n))
      r.fail({ message: `Cannot find any service with service name '${n}'.`, category: 'ObjectNotFound', target: `${n}:String`, exception: 'ServiceCommandException', id: 'NoServiceFoundForGivenName,Microsoft.PowerShell.Commands.GetServiceCommand' });
    out.push(...found.map(item));
  }
  for (const n of displays) {
    const found = all.filter((s) => wildcard(n).test(s.display));
    if (!found.length && !/[*?]/.test(n))
      r.fail({ message: `Cannot find any service with display name '${n}'.`, category: 'ObjectNotFound', target: `${n}:String`, exception: 'ServiceCommandException', id: 'NoServiceFoundForGivenDisplayName,Microsoft.PowerShell.Commands.GetServiceCommand' });
    out.push(...found.map(item));
  }
  return out;
}

const GB = 1024 ** 3;

function getPSDrive(r: Run): Item[] {
  const { game, p } = r;
  const w = windows(game);
  const here = game.cwd.split('/').filter(Boolean);
  const fs = w.volumes.map((v): PSObject => {
    const used = volumeUsed(game, v.letter);
    return {
      type: 'PSDriveInfo',
      props: { Name: v.letter, Used: used, Free: v.size - used, Provider: 'FileSystem', Root: `${v.letter}:\\`, CurrentLocation: here[0] === v.letter ? here.slice(1).join('\\') : '' },
    };
  });
  const other = (name: string, provider: string, root = ''): PSObject => ({ type: 'PSDriveInfo', props: { Name: name, Used: null, Free: null, Provider: provider, Root: root, CurrentLocation: '' } });
  const all = [other('Alias', 'Alias'), ...fs, other('Cert', 'Certificate', '\\'), other('Env', 'Environment'), other('Function', 'Function'), other('HKCU', 'Registry', 'HKEY_CURRENT_USER'), other('HKLM', 'Registry', 'HKEY_LOCAL_MACHINE'), other('Variable', 'Variable'), other('WSMan', 'WSMan')].sort(
    (a, b) => String(a.props.Name).localeCompare(String(b.props.Name)),
  );
  const names = arr(p.Name);
  if (!names.length) return all;
  const out: Item[] = [];
  for (const n of names) {
    const found = all.filter((d) => wildcard(n.replace(/:$/, '')).test(String(d.props.Name)));
    if (!found.length)
      r.fail({ message: `Cannot find drive. A drive with the name '${n}' does not exist.`, category: 'ObjectNotFound', target: `${n}:String`, exception: 'DriveNotFoundException', id: 'GetLocationNoMatchingDrive,Microsoft.PowerShell.Commands.GetPSDriveCommand' });
    out.push(...found);
  }
  return out;
}

function getVolume(r: Run): Item[] {
  const { game, p } = r;
  const w = windows(game);
  const all = [...w.volumes].reverse().map(
    (v): PSObject => ({
      type: 'MSFT_Volume',
      props: { DriveLetter: v.letter, FriendlyName: v.label, FileSystemType: 'NTFS', DriveType: 'Fixed', HealthStatus: 'Healthy', OperationalStatus: 'OK', SizeRemaining: v.size - volumeUsed(game, v.letter), Size: v.size },
    }),
  );
  const letters = arr(p.DriveLetter);
  if (!letters.length) return all;
  const out: Item[] = [];
  for (const l of letters) {
    const found = all.filter((v) => String(v.props.DriveLetter).toLowerCase() === l.replace(/:$/, '').toLowerCase());
    if (!found.length)
      r.fail({ message: `No MSFT_Volume objects found with property 'DriveLetter' equal to '${l}'.  Verify the value of the property and retry.`, category: 'ObjectNotFound', target: `${l}:Char`, exception: 'CimJobException', id: 'CmdletizationQuery_NotFound_DriveLetter,Get-Volume' });
    out.push(...found);
  }
  return out;
}

const LOGS: Record<string, (game: Shell) => WinEvent[]> = {
  system: (game) => windows(game).events,
  application: () => [],
};

function logOf(r: Run, cmdlet: string): WinEvent[] | null {
  const name = str(r.p.LogName) || 'System';
  const log = LOGS[name.toLowerCase()];
  if (!log) {
    r.fail(
      cmdlet === 'Get-WinEvent'
        ? { message: `There is not an event log on the localhost computer that matches "${name}".`, category: 'ObjectNotFound', target: `${name}:String`, exception: 'Exception', id: 'NoMatchingLogsFound,Microsoft.PowerShell.Commands.GetWinEventCommand' }
        : { message: `The event log '${name}' on computer '.' does not exist.`, category: 'NotSpecified', target: ':', exception: 'InvalidOperationException', id: 'System.InvalidOperationException,Microsoft.PowerShell.Commands.GetEventLogCommand' },
    );
    return null;
  }
  return [...log(r.game)].reverse();
}

function getWinEvent(r: Run): Item[] {
  const events = logOf(r, 'Get-WinEvent');
  if (!events) return [];
  if (!events.length) {
    r.fail({ message: 'No events were found that match the specified selection criteria.', category: 'ObjectNotFound', target: ':', exception: 'Exception', id: 'NoMatchingEventsFound,Microsoft.PowerShell.Commands.GetWinEventCommand' });
    return [];
  }
  const max = r.p.MaxEvents !== undefined ? Number(r.p.MaxEvents) : Infinity;
  return events.slice(0, max).map((e) => ({
    type: 'EventLogRecord',
    group: `   ProviderName: ${e.provider}`,
    props: { TimeCreated: new PSDate(e.time), Id: e.id, LevelDisplayName: e.level, Message: e.message, ProviderName: e.provider, LogName: 'System' },
  }));
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function getEventLog(r: Run): Item[] {
  const events = logOf(r, 'Get-EventLog');
  if (!events) return [];
  const total = events.length;
  let rows = events.map((e, i) => ({ e, index: 48_000 + total - i }));
  if (r.p.EntryType) rows = rows.filter(({ e }) => arr(r.p.EntryType).some((t) => t.toLowerCase() === e.level.toLowerCase()));
  if (r.p.Source) rows = rows.filter(({ e }) => arr(r.p.Source).some((s) => wildcard(s).test(e.provider)));
  if (r.p.Newest !== undefined) rows = rows.slice(0, Number(r.p.Newest));
  return rows.map(({ e, index }) => {
    const d = new Date(e.time);
    const time = `${MONTHS[d.getUTCMonth()]} ${String(d.getUTCDate()).padStart(2, '0')} ${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`;
    return { type: 'EventLogEntry', props: { Index: index, Time: time, EntryType: e.level, Source: e.provider, InstanceID: e.id, Message: e.message } };
  });
}

function getSmbShare(r: Run): Item[] {
  const all = windows(r.game).shares.map((s): PSObject => ({ type: 'MSFT_SmbShare', props: { Name: s.name, ScopeName: '*', Path: s.path, Description: s.description } }));
  const names = arr(r.p.Name);
  if (!names.length) return all;
  const out: Item[] = [];
  for (const n of names) {
    const found = all.filter((s) => wildcard(n).test(String(s.props.Name)));
    if (!found.length)
      r.fail({ message: `No MSFT_SMBShare objects found with property 'Name' equal to '${n}'.  Verify the value of the property and retry.`, category: 'ObjectNotFound', target: `${n}:String`, exception: 'CimJobException', id: 'CmdletizationQuery_NotFound_Name,Get-SmbShare' });
    out.push(...found);
  }
  return out;
}

// ——— The pipeline's own cmdlets ———

function whereObject(r: Run): Item[] {
  const items = r.input ?? [];
  const block = str(r.p.FilterScript);
  let prop: string;
  let op: string;
  let value: unknown;
  if (block) {
    const m = /^\{\s*\$(?:_|PSItem)\.([\w]+)\s+-(\w+)\s+(.+?)\s*\}$/i.exec(block);
    if (!m) {
      r.fail({ message: r.game.t('powershell-filter-simple'), category: 'NotImplemented', target: ':', exception: 'NotSupportedException', id: 'FilterNotSimulated' });
      return [];
    }
    [, prop, op] = m;
    value = literal(m[3]);
  } else {
    prop = str(r.p.Property);
    op = ['EQ', 'NE', 'GT', 'GE', 'LT', 'LE', 'Like', 'NotLike', 'Match', 'NotMatch'].find((o) => r.p[o]) ?? '';
    value = r.p.Value === undefined ? undefined : literal(str(r.p.Value));
    // Where-Object Name: the objects whose property is set.
    if (!op) return items.filter((x) => !!property(x, prop));
  }
  return items.filter((x) => operate(op, property(x, prop), value) === true);
}

function sortObject(r: Run): Item[] {
  const items = [...(r.input ?? [])];
  const props = arr(r.p.Property);
  const sign = r.p.Descending ? -1 : 1;
  const key = (x: Item) => (props.length ? props.map((p) => property(x, p)) : [isObject(x) ? (x.props.Name ?? x.props.FullName) : x]);
  // Stable, like Sort-Object.
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

function selectObject(r: Run): Item[] {
  let items = [...(r.input ?? [])];
  if (r.p.Skip !== undefined) items = items.slice(Number(r.p.Skip));
  if (r.p.First !== undefined) items = items.slice(0, Number(r.p.First));
  if (r.p.Last !== undefined) items = items.slice(-Number(r.p.Last));
  const expand = str(r.p.ExpandProperty);
  if (expand) return items.map((x) => property(x, expand)).filter((v) => v !== undefined && v !== null).map((v) => (typeof v === 'number' ? v : show(v)));
  const props = arr(r.p.Property);
  if (!props.length) return items;
  return items.map((x) => {
    const names = props.includes('*') && isObject(x) ? Object.keys(x.props) : props;
    const canonical = (n: string) => (isObject(x) ? (Object.keys(x.props).find((k) => k.toLowerCase() === n.toLowerCase()) ?? n) : n);
    return { type: `Selected.${isObject(x) ? x.type : 'String'}`, props: Object.fromEntries(names.map((n) => [canonical(n), property(x, n) ?? null])) };
  });
}

/** Format-Table and Format-List: their text, which nothing else can read. */
function formatted(r: Run, how: 'table' | 'list'): Item[] {
  const items = (r.input ?? []).filter(isObject);
  const props = arr(r.p.Property);
  if (!items.length) return (r.input ?? []).map((x) => show(x));
  const names = !props.length || props.includes('*') ? Object.keys(items[0].props) : props;
  const lines = how === 'list' ? list(items, props.length && !props.includes('*') ? props : undefined) : ['', ...table(items, propertyColumns(names))];
  return [...lines, ''];
}

function measureObject(r: Run): Item[] {
  const items = r.input ?? [];
  const prop = str(r.p.Property);
  const values = prop ? items.map((x) => property(x, prop)).filter((v) => typeof v === 'number') as number[] : [];
  const pick = (on: boolean, f: () => number) => (on && values.length ? f() : null);
  return [
    {
      type: 'GenericMeasureInfo',
      props: {
        Count: prop ? values.length : items.length,
        Average: pick(!!r.p.Average, () => values.reduce((a, b) => a + b, 0) / values.length),
        Sum: pick(!!r.p.Sum, () => values.reduce((a, b) => a + b, 0)),
        Maximum: pick(!!r.p.Maximum, () => Math.max(...values)),
        Minimum: pick(!!r.p.Minimum, () => Math.min(...values)),
        Property: prop || null,
      },
    },
  ];
}

// ——— Help, commands, aliases ———

const ALIASES: Record<string, string> = {
  ls: 'Get-ChildItem', dir: 'Get-ChildItem', gci: 'Get-ChildItem',
  cat: 'Get-Content', type: 'Get-Content', gc: 'Get-Content',
  cd: 'Set-Location', chdir: 'Set-Location', sl: 'Set-Location',
  pwd: 'Get-Location', gl: 'Get-Location',
  gsv: 'Get-Service', gdr: 'Get-PSDrive',
  sort: 'Sort-Object', select: 'Select-Object', where: 'Where-Object', '?': 'Where-Object',
  ft: 'Format-Table', fl: 'Format-List', measure: 'Measure-Object',
  echo: 'Write-Output', write: 'Write-Output', cls: 'Clear-Host', clear: 'Clear-Host',
  help: 'Get-Help', man: 'Get-Help', gcm: 'Get-Command', gal: 'Get-Alias',
  rm: 'Remove-Item', del: 'Remove-Item', erase: 'Remove-Item', rd: 'Remove-Item', rmdir: 'Remove-Item', ri: 'Remove-Item',
  mv: 'Move-Item', move: 'Move-Item', mi: 'Move-Item', cp: 'Copy-Item', copy: 'Copy-Item', cpi: 'Copy-Item', ni: 'New-Item',
  kill: 'Stop-Process', spps: 'Stop-Process',
};

// The cmdlets that change something: not in the game (it only reads), named so the player gets a clear note.
const WRITERS = [
  'Remove-Item', 'Move-Item', 'Copy-Item', 'New-Item', 'Rename-Item', 'Set-Content', 'Add-Content', 'Clear-Content', 'Out-File', 'Set-Item',
  'Restart-Service', 'Stop-Service', 'Start-Service', 'Set-Service', 'Stop-Process', 'Restart-Computer', 'Stop-Computer', 'Clear-EventLog',
  'New-SmbShare', 'Remove-SmbShare', 'Set-SmbShare', 'Format-Volume', 'Resize-Partition', 'Clear-RecycleBin', 'Set-ExecutionPolicy',
];

const url = (c: Cmdlet) =>
  c.module === 'Storage' || c.module === 'SmbShare'
    ? `https://learn.microsoft.com/powershell/module/${c.module.toLowerCase()}/${c.name.toLowerCase()}`
    : `https://learn.microsoft.com/powershell/module/${c.module.toLowerCase()}/${c.name.toLowerCase()}?view=powershell-5.1`;

const indentPs = (text: string, n = 4) => text.split('\n').map((l) => (l ? ' '.repeat(n) + l : l)).join('\n');

/** Get-Help NAME: the game's manual page, in PowerShell's layout. */
function helpPage(game: Shell, c: Cmdlet, mode: 'short' | 'examples' | 'full'): string {
  const t = game.t;
  const parts = manualParts(c.name, t);
  const first = parts.description.split(/(?<=\.)\s|\n/)[0];
  const capital = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
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
  out.push(t('powershell-help-related'), indentPs(`Online Version: ${url(c)}`), ...(parts.see.map((s) => indentPs(s))), '', t('powershell-help-remarks'), indentPs(t('powershell-help-remarks-text', { name: c.name })));
  return out.join('\n');
}

function getHelp(r: Run): Item[] {
  const name = str(r.p.Name);
  if (!name) return r.game.t('powershell-help-intro').split('\n');
  const c = cmdletNamed(name);
  if (!c) {
    r.fail({
      message: `Get-Help could not find ${name} in a help file in this session. To download updated help topics type: "Update-Help". To get help online, search for the help topic in the TechNet library at https:/go.microsoft.com/fwlink/?LinkID=107116.`,
      category: 'ResourceUnavailable', target: ':', exception: 'HelpNotFoundException', id: 'HelpNotFound,Microsoft.PowerShell.Commands.GetHelpCommand',
    });
    return [];
  }
  return helpPage(r.game, c, r.p.Examples ? 'examples' : r.p.Full || r.p.Detailed ? 'full' : 'short').split('\n');
}

function getCommand(r: Run): Item[] {
  const names = arr(r.p.Name);
  const commandItem = (c: Cmdlet): PSObject => ({ type: 'CommandInfo', props: { CommandType: c.kind ?? 'Cmdlet', Name: c.name, Version: c.version, Source: c.module } });
  const aliasItem = (a: string): PSObject => ({ type: 'CommandInfo', props: { CommandType: 'Alias', Name: `${a} -> ${ALIASES[a]}`, Version: '', Source: '' } });
  let all = CMDLETS.filter((c) => (!r.p.Verb || wildcard(str(r.p.Verb)).test(c.name.split('-')[0])) && (!r.p.Noun || wildcard(str(r.p.Noun)).test(c.name.split('-')[1] ?? '')));
  if (!names.length) return [...all].sort((a, b) => a.name.localeCompare(b.name)).map(commandItem);
  const out: Item[] = [];
  for (const n of names) {
    const aliases = Object.keys(ALIASES).filter((a) => wildcard(n).test(a) && !WRITERS.includes(ALIASES[a]));
    all = CMDLETS.filter((c) => wildcard(n).test(c.name));
    if (!aliases.length && !all.length && !/[*?]/.test(n))
      r.fail({
        message: `The term '${n}' is not recognized as the name of a cmdlet, function, script file, or operable program. Check the spelling of the name, or if a path was included, verify that the path is correct and try again.`,
        category: 'ObjectNotFound', target: `${n}:String`, exception: 'CommandNotFoundException', id: 'CommandNotFoundException,Microsoft.PowerShell.Commands.GetCommandCommand',
      });
    out.push(...aliases.map(aliasItem), ...[...all].sort((a, b) => a.name.localeCompare(b.name)).map(commandItem));
  }
  return out;
}

function getAlias(r: Run): Item[] {
  const names = arr(r.p.Name);
  const definition = arr(r.p.Definition);
  const keys = Object.keys(ALIASES)
    .filter((a) => !WRITERS.includes(ALIASES[a]))
    .filter((a) => (!names.length || names.some((n) => wildcard(n).test(a))) && (!definition.length || definition.some((d) => wildcard(d).test(ALIASES[a]))))
    .sort();
  if (!keys.length && names.length && !names.some((n) => /[*?]/.test(n)))
    r.fail({ message: `This command cannot find a matching alias because an alias with the name '${names[0]}' does not exist.`, category: 'ObjectNotFound', target: `${names[0]}:String`, exception: 'ItemNotFoundException', id: 'ItemNotFoundException,Microsoft.PowerShell.Commands.GetAliasCommand' });
  return keys.map((a) => ({ type: 'CommandInfo', props: { CommandType: 'Alias', Name: `${a} -> ${ALIASES[a]}`, Version: '', Source: '' } }));
}

// ——— The cmdlets ———

const MGMT = 'Microsoft.PowerShell.Management';
const UTIL = 'Microsoft.PowerShell.Utility';
const CORE = 'Microsoft.PowerShell.Core';

export const CMDLETS: Cmdlet[] = [
  {
    name: 'Get-ChildItem', module: MGMT, version: '3.1.0.0', positional: ['Path', 'Filter'],
    params: [{ name: 'Path', list: true }, { name: 'Filter', type: 'System.String' }, { name: 'Recurse', switch: true, aliases: ['s'] }, { name: 'Depth', type: 'System.UInt32' }, { name: 'Force', switch: true }, { name: 'Name', switch: true }, { name: 'File', switch: true }, { name: 'Directory', switch: true, aliases: ['ad'] }],
    run: getChildItem,
  },
  {
    name: 'Get-Content', module: MGMT, version: '3.1.0.0', positional: ['Path'],
    params: [{ name: 'Path', list: true }, { name: 'TotalCount', aliases: ['First', 'Head'], type: 'System.Int64' }, { name: 'Tail', aliases: ['Last'], type: 'System.Int32' }, { name: 'Encoding', type: 'Microsoft.PowerShell.Commands.FileSystemCmdletProviderEncoding' }],
    run: getContent,
  },
  { name: 'Set-Location', module: MGMT, version: '3.1.0.0', positional: ['Path'], params: [{ name: 'Path', type: 'System.String' }], run: setLocation },
  {
    name: 'Get-Location', module: MGMT, version: '3.1.0.0', params: [],
    run: ({ game }) => [{ type: 'PathInfo', props: { Path: toWindows(game.cwd) } }],
  },
  { name: 'Get-Service', module: MGMT, version: '3.1.0.0', positional: ['Name'], params: [{ name: 'Name', list: true, aliases: ['ServiceName'] }, { name: 'DisplayName', list: true }], run: getService },
  { name: 'Get-PSDrive', module: MGMT, version: '3.1.0.0', positional: ['Name'], params: [{ name: 'Name', list: true }, { name: 'PSProvider', list: true }], run: getPSDrive },
  { name: 'Get-Volume', module: 'Storage', version: '2.0.0.0', kind: 'Function', positional: ['DriveLetter'], params: [{ name: 'DriveLetter', list: true, type: 'System.Char[]' }], run: getVolume },
  {
    name: 'Get-WinEvent', module: 'Microsoft.PowerShell.Diagnostics', version: '3.0.0.0', positional: ['LogName'],
    params: [{ name: 'LogName', list: true }, { name: 'MaxEvents', type: 'System.Int64' }],
    run: getWinEvent,
  },
  {
    name: 'Get-EventLog', module: MGMT, version: '3.1.0.0', positional: ['LogName'],
    params: [{ name: 'LogName', aliases: ['LN'], type: 'System.String' }, { name: 'Newest', type: 'System.Int32' }, { name: 'EntryType', list: true }, { name: 'Source', list: true }],
    run: getEventLog,
  },
  { name: 'Get-SmbShare', module: 'SmbShare', version: '2.0.0.0', kind: 'Function', positional: ['Name'], params: [{ name: 'Name', list: true }], run: getSmbShare },
  {
    name: 'Where-Object', module: CORE, version: '3.0.0.0', positional: ['Property', 'Value'],
    params: [{ name: 'FilterScript', type: 'System.Management.Automation.ScriptBlock' }, { name: 'Property', type: 'System.String' }, { name: 'Value', type: 'System.Object' }, ...['EQ', 'NE', 'GT', 'GE', 'LT', 'LE', 'Like', 'NotLike', 'Match', 'NotMatch'].map((n) => ({ name: n, switch: true }))],
    run: whereObject,
  },
  { name: 'Sort-Object', module: UTIL, version: '3.1.0.0', positional: ['Property'], params: [{ name: 'Property', list: true, type: 'System.Object[]' }, { name: 'Descending', switch: true }, { name: 'Unique', switch: true }], run: sortObject },
  {
    name: 'Select-Object', module: UTIL, version: '3.1.0.0', positional: ['Property'],
    params: [{ name: 'Property', list: true, type: 'System.Object[]' }, { name: 'First', type: 'System.Int32' }, { name: 'Last', type: 'System.Int32' }, { name: 'Skip', type: 'System.Int32' }, { name: 'ExpandProperty', type: 'System.String' }],
    run: selectObject,
  },
  { name: 'Format-Table', module: UTIL, version: '3.1.0.0', positional: ['Property'], params: [{ name: 'Property', list: true, type: 'System.Object[]' }, { name: 'AutoSize', switch: true }, { name: 'Wrap', switch: true }], run: (r) => formatted(r, 'table') },
  { name: 'Format-List', module: UTIL, version: '3.1.0.0', positional: ['Property'], params: [{ name: 'Property', list: true, type: 'System.Object[]' }], run: (r) => formatted(r, 'list') },
  {
    name: 'Measure-Object', module: UTIL, version: '3.1.0.0', positional: ['Property'],
    params: [{ name: 'Property', type: 'System.String[]' }, { name: 'Sum', switch: true }, { name: 'Average', switch: true }, { name: 'Maximum', switch: true }, { name: 'Minimum', switch: true }],
    run: measureObject,
  },
  { name: 'Write-Output', module: UTIL, version: '3.1.0.0', rest: 'InputObject', params: [{ name: 'InputObject', list: true, type: 'System.Management.Automation.PSObject[]' }], run: ({ p }) => arr(p.InputObject).map((v) => { const x = literal(v); return typeof x === 'number' ? x : String(x); }) },
  { name: 'Clear-Host', module: CORE, version: '', kind: 'Function', params: [], run: () => null },
  { name: 'Get-Help', module: CORE, version: '3.0.0.0', positional: ['Name'], params: [{ name: 'Name', type: 'System.String' }, { name: 'Examples', switch: true }, { name: 'Detailed', switch: true }, { name: 'Full', switch: true }], run: getHelp },
  { name: 'Get-Command', module: CORE, version: '3.0.0.0', positional: ['Name'], params: [{ name: 'Name', list: true }, { name: 'Verb', list: true }, { name: 'Noun', list: true }], run: getCommand },
  { name: 'Get-Alias', module: UTIL, version: '3.1.0.0', positional: ['Name'], params: [{ name: 'Name', list: true }, { name: 'Definition', list: true }], run: getAlias },
];

/** A cmdlet by its name or one of its aliases, without case. */
export function cmdletNamed(name: string): Cmdlet | undefined {
  const low = name.toLowerCase();
  const target = Object.entries(ALIASES).find(([a]) => a === low)?.[1] ?? name;
  return CMDLETS.find((c) => c.name.toLowerCase() === target.toLowerCase());
}

// ——— Views (as PowerShell's format files show these types) ———

const VIEWS: Record<string, View> = {
  FileSystemInfo: {
    group: (o) => `    Directory: ${o.group}`,
    columns: [
      { label: 'Mode', value: (o) => o.props.Mode },
      { label: 'LastWriteTime', value: (o) => shortDate((o.props.LastWriteTime as PSDate).ms), right: true },
      { label: 'Length', value: (o) => o.props.Length ?? null, right: true },
      { label: 'Name', value: (o) => o.props.Name },
    ],
  },
  ServiceController: { columns: ['Status', 'Name', 'DisplayName'].map((n) => ({ label: n, value: (o: PSObject) => o.props[n] })) },
  PSDriveInfo: {
    columns: [
      { label: 'Name', value: (o) => o.props.Name },
      { label: 'Used (GB)', value: (o) => (o.props.Used === null ? '' : ((o.props.Used as number) / GB).toFixed(2)), right: true },
      { label: 'Free (GB)', value: (o) => (o.props.Free === null ? '' : ((o.props.Free as number) / GB).toFixed(2)), right: true },
      { label: 'Provider', value: (o) => o.props.Provider },
      { label: 'Root', value: (o) => o.props.Root },
      { label: 'CurrentLocation', value: (o) => o.props.CurrentLocation, right: true },
    ],
  },
  MSFT_Volume: {
    columns: [
      ...['DriveLetter', 'FriendlyName', 'FileSystemType', 'DriveType', 'HealthStatus', 'OperationalStatus'].map((n) => ({ label: n, value: (o: PSObject) => o.props[n] })),
      { label: 'SizeRemaining', value: (o) => storageSize(o.props.SizeRemaining as number), right: true },
      { label: 'Size', value: (o) => storageSize(o.props.Size as number), right: true },
    ],
  },
  EventLogRecord: {
    group: (o) => o.group!,
    columns: [
      { label: 'TimeCreated', value: (o) => String(o.props.TimeCreated) },
      { label: 'Id', value: (o) => o.props.Id },
      { label: 'LevelDisplayName', value: (o) => o.props.LevelDisplayName },
      { label: 'Message', value: (o) => o.props.Message },
    ],
  },
  EventLogEntry: { columns: ['Index', 'Time', 'EntryType', 'Source', 'InstanceID', 'Message'].map((n) => ({ label: n, value: (o: PSObject) => o.props[n] })) },
  MSFT_SmbShare: { columns: ['Name', 'ScopeName', 'Path', 'Description'].map((n) => ({ label: n, value: (o: PSObject) => o.props[n] })) },
  CommandInfo: { columns: ['CommandType', 'Name', 'Version', 'Source'].map((n) => ({ label: n, value: (o: PSObject) => o.props[n] })) },
  PathInfo: { columns: [{ label: 'Path', value: (o) => o.props.Path }] },
  GenericMeasureInfo: { columns: [], list: true },
};

// ——— Binding the parameters ———

interface Bound {
  p: Record<string, string | string[] | boolean>;
}

function bind(c: Cmdlet, invocation: string, args: Token[]): Bound | ErrorSpec {
  const params = [...c.params, ...COMMON];
  const p: Bound['p'] = {};
  const positional: Token[] = [];
  const fqid = (id: string) => `${id},${c.kind === 'Function' ? c.name : `Microsoft.PowerShell.Commands.${c.name.replace('-', '')}Command`}`;
  const bindingError = (message: string, t: Token, id: string): ErrorSpec => ({ message, pos: t.pos, length: t.text.length, category: 'InvalidArgument', target: ':', cmdlet: c.name, exception: 'ParameterBindingException', id: fqid(id) });
  const value = (def: Param, t: Token) => (def.list && t.kind !== 'block' ? t.text.split(',').map((x) => x.trim()).filter(Boolean) : t.text);
  for (let i = 0; i < args.length; i++) {
    const t = args[i];
    if (t.kind !== 'param') {
      positional.push(t);
      continue;
    }
    const [raw, inline] = t.text.slice(1).split(/:(.*)/s);
    const low = raw.toLowerCase();
    const exact = params.find((x) => x.name.toLowerCase() === low || x.aliases?.some((a) => a.toLowerCase() === low));
    const matches = exact ? [exact] : params.filter((x) => x.name.toLowerCase().startsWith(low));
    if (!matches.length) return bindingError(`A parameter cannot be found that matches parameter name '${raw}'.`, t, 'NamedParameterNotFound');
    if (matches.length > 1) return bindingError(`Parameter cannot be processed because the parameter name '${raw}' is ambiguous. Possible matches include: ${matches.map((m) => `-${m.name}`).join(' ')}.`, t, 'AmbiguousParameter');
    const def = matches[0];
    if (def.switch) {
      p[def.name] = inline === undefined ? true : !/^\$false$/i.test(inline);
      continue;
    }
    const next = inline !== undefined && inline !== '' ? { ...t, text: inline, kind: 'word' as const } : args[i + 1];
    if (!next || next.kind === 'param')
      return bindingError(`Missing an argument for parameter '${def.name}'. Specify a parameter of type '${def.type ?? 'System.String[]'}' and try again.`, t, 'MissingArgument');
    if (inline === undefined || inline === '') i++;
    p[def.name] = value(def, next);
  }
  // Where-Object { … }: the script block is its first positional value.
  if (c.name === 'Where-Object' && positional[0]?.kind === 'block' && p.FilterScript === undefined) p.FilterScript = positional.shift()!.text;
  if (c.rest) {
    if (positional.length) p[c.rest] = [...arr(p[c.rest]), ...positional.flatMap((t) => (t.kind === 'string' ? [t.text] : t.text.split(',')))];
    return { p };
  }
  for (const name of c.positional ?? []) {
    if (p[name] !== undefined) continue;
    const t = positional.shift();
    if (!t) break;
    p[name] = value(params.find((x) => x.name === name)!, t);
  }
  if (positional.length) return bindingError(`A positional parameter cannot be found that accepts argument '${positional[0].text}'.`, positional[0], 'PositionalParameterNotFound');
  return { p };
}

// ——— A line typed at the PS prompt ———

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

/** hostname.exe and whoami.exe, the two programs of the game's Windows. */
function native(game: Shell, name: string, args: Token[]): string | null {
  const w = windows(game);
  const bare = name.toLowerCase().replace(/\.exe$/, '');
  if (bare === 'hostname') return args.length ? 'sethostname: Use the Network Control Panel Applet to set hostname.\nhostname -s is not supported.' : w.computer;
  if (bare === 'whoami') {
    if (args.length) return `ERROR: Invalid argument/option - '${args[0].text}'.\nType "WHOAMI /?" for usage.`;
    return `${w.computer.toLowerCase()}\\${game.player}`;
  }
  return null;
}

/** One line at the "PS C:\Users\you>" prompt: its output (errors included), or null for Clear-Host. */
export function runPowerShell(game: Shell, line: string): string | null {
  game.recoverErrors();
  game.status = null;
  const text = line.trim();
  if (!text) return '';
  game.typedCommands++;
  game.commandLine = text;
  const errors: string[] = [];
  const outputs: string[] = [];
  const commands: string[][] = [];
  let clear = false;
  const finish = () => {
    for (const e of errors) game.error(e);
    const output = [...errors, ...outputs].join('\n').replace(/\n+$/, '');
    game.last = { line: text, commands, output, errors: [...errors], redirection: null };
    return clear ? null : output;
  };
  const tokens = tokenize(line);
  if ('error' in tokens) {
    errors.push(
      [`At line:1 char:${tokens.pos + 1}`, `+ ${line}`, `+ ${' '.repeat(tokens.pos)}~`, tokens.error, '    + CategoryInfo          : ParserError: (:) [], ParentContainsErrorRecordException', '    + FullyQualifiedErrorId : TerminatorExpectedAtEndOfString', ' '].join('\n'),
    );
    return finish();
  }
  // Statements (;), each a pipeline (|).
  const statements: Token[][] = [[]];
  for (const t of tokens) (t.kind === 'semi' ? statements.push([]) : statements.at(-1)!.push(t));
  for (const statement of statements.filter((s) => s.length)) {
    const segments: Token[][] = [[]];
    for (const t of statement) (t.kind === 'pipe' ? segments.push([]) : segments.at(-1)!.push(t));
    if (segments.some((s) => !s.length)) {
      const at = statement.find((t, i) => t.kind === 'pipe' && (i === statement.length - 1 || statement[i + 1].kind === 'pipe'))?.pos ?? 0;
      errors.push([`At line:1 char:${at + 2}`, `+ ${line}`, `+ ${' '.repeat(at + 1)}~`, 'An empty pipe element is not allowed.', '    + CategoryInfo          : ParserError: (:) [], ParentContainsErrorRecordException', '    + FullyQualifiedErrorId : EmptyPipeElement', ' '].join('\n'));
      continue;
    }
    let items: Item[] | null = null;
    let stopped = false;
    for (const [k, seg] of segments.entries()) {
      const [head, ...args] = seg;
      const name = head.text;
      commands.push([name, ...args.map((a) => a.text)]);
      if (/^exit$/i.test(name)) {
        game.output = true;
        return finish();
      }
      // cd.. and cd\ : the functions PowerShell defines for old habits.
      const fn = /^cd(\.\.|\\)$/i.exec(name);
      const c = fn ? cmdletNamed('Set-Location') : cmdletNamed(name);
      const end = seg.at(-1)!;
      const span = { pos: head.pos, length: end.pos + end.text.length - head.pos };
      if (!c) {
        const own = k === 0 ? native(game, name, args) : null;
        if (own !== null) {
          items = own.split('\n');
          continue;
        }
        const writer = WRITERS.find((w) => w.toLowerCase() === (ALIASES[name.toLowerCase()] ?? name).toLowerCase());
        if (writer) {
          errors.push(game.t('powershell-read-only', { command: writer }));
          game.state.psWriters = ((game.state.psWriters as number | undefined) ?? 0) + 1;
          game.status = 1;
          stopped = true;
          break;
        }
        errors.push(errorRecord(name, line, notRecognised(name, head.pos)));
        stopped = true;
        break;
      }
      if (args.some((a) => a.text === '-?')) {
        items = helpPage(game, c, 'short').split('\n');
        continue;
      }
      const bound = bind(c, name, fn ? [{ text: fn[1] === '..' ? '..' : '\\', pos: head.pos + 2, kind: 'word' }] : args);
      if ('message' in bound) {
        errors.push(errorRecord(name, line, bound));
        stopped = true;
        break;
      }
      const silent = /^(silentlycontinue|ignore)$/i.test(str(bound.p.ErrorAction));
      const result = c.run({
        game,
        p: bound.p,
        input: k === 0 ? null : items,
        fail: (e) => {
          if (!silent) errors.push(errorRecord(name, line, { ...e, ...span, cmdlet: c.name }));
        },
      });
      if (result === null) {
        clear = true;
        items = [];
        continue;
      }
      items = result;
    }
    if (!stopped && items?.length) outputs.push(outDefault(items, VIEWS));
  }
  if (errors.length) game.status = 1;
  return finish();
}

// ——— The manual: each cmdlet has its page (man Get-ChildItem on Linux, Get-Help in PowerShell) ———

const onLinux = ({ game }: { game: Shell }) => {
  game.status = 127;
  return game.error(game.t('command-missing', { command: game.commandLine.split(/\s+/)[0] }));
};

export const POWERSHELL: Record<string, Command> = Object.fromEntries(CMDLETS.map((c) => [c.name, { cmdlet: true, ownOptions: true, launch: onLinux } as Command]));
