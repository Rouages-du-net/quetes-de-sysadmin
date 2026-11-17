// Windows PowerShell 5.1, the small part a Linux admin meets when ssh lands
// on a Windows Server: a command line split into a pipeline of cmdlets
// that pass OBJECTS (not text) to each other, parameters named with a dash
// (a prefix is enough, case doesn't matter), positional values, and the
// formatting at the end (Out-Default: a table, or a list for objects with
// five properties or more). Errors keep PowerShell 5.1's layout: the
// message, "At line:1 char:N", the line underlined, CategoryInfo and
// FullyQualifiedErrorId. The cmdlets themselves are in commands/powershell.ts.
// Sources (Microsoft Learn, PowerShell 5.1): about_Pipelines,
// about_Parameters, about_Command_Syntax, about_Format.ps1xml,
// about_Comparison_Operators, about_Numeric_Literals (KB, MB, GB, TB),
// https://learn.microsoft.com/powershell/scripting/learn/ps101/04-pipelines
// Simplifications (docs/SCENARIOS.md): no variables but $_ in a filter, no
// expressions, no calculated properties, tables sized to their content.

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
}
export type Item = string | number | PSObject;

export const isObject = (x: unknown): x is PSObject => typeof x === 'object' && x !== null && 'props' in x && 'type' in x;

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
export function property(o: Item, name: string): unknown {
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
  if (typeof v === 'boolean') return v ? 'True' : 'False';
  if (Array.isArray(v)) return `{${v.map(show).join(', ')}}`;
  if (typeof v === 'number') return Number.isInteger(v) ? String(v) : String(Number(v.toFixed(7)));
  return String(v);
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
}
export interface View {
  columns: Column[];
  // The header of each group ("    Directory: D:\Shares\plans").
  group?: (o: PSObject) => string;
  list?: boolean;
}

/** A table: the header, its dashes, the rows; numbers on the right, the last column not padded. */
export function table(rows: PSObject[], columns: Column[]): string[] {
  const cells = rows.map((r) => columns.map((c) => show(c.value(r))));
  const widths = columns.map((c, i) => Math.max(c.label.length, ...cells.map((r) => r[i].length)));
  const right = columns.map((c) => c.right ?? rows.some((r) => typeof c.value(r) === 'number'));
  const line = (vals: string[]) =>
    vals
      .map((v, i) => (right[i] ? v.padStart(widths[i]) : i === vals.length - 1 ? v : v.padEnd(widths[i])))
      .join(' ')
      .trimEnd();
  return [line(columns.map((c) => c.label)), line(columns.map((c) => '-'.repeat(c.label.length))), ...cells.map(line)];
}

/** A list: one "Name : value" line per property, objects separated by a blank line. */
export function list(rows: PSObject[], names?: string[]): string[] {
  const out: string[] = [];
  for (const r of rows) {
    const keys = names ?? Object.keys(r.props);
    const w = Math.max(...keys.map((k) => k.length));
    out.push('', ...keys.map((k) => `${k.padEnd(w)} : ${show(property(r, k))}`.trimEnd()));
  }
  return out;
}

/** A plain table of the properties (Select-Object's objects, Format-Table -Property). */
export const propertyColumns = (names: string[]): Column[] =>
  names.map((n) => ({ label: n, value: (o: PSObject) => property(o, n) }));

/** Out-Default: what the pipeline's last items look like on the screen. */
export function outDefault(items: Item[], views: Record<string, View>): string {
  const out: string[] = [];
  let i = 0;
  while (i < items.length) {
    const x = items[i];
    if (!isObject(x)) {
      out.push(show(x));
      i++;
      continue;
    }
    // The run of objects of the same type (and group) is one table.
    let j = i;
    while (j < items.length && isObject(items[j]) && (items[j] as PSObject).type === x.type) j++;
    const run = items.slice(i, j) as PSObject[];
    const view = views[x.type];
    if (view?.list || (!view && Object.keys(x.props).length >= 5)) out.push(...list(run), '');
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
