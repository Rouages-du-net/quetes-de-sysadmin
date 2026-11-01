// sudo's policy: /etc/sudoers and the files it includes, read like
// sudoers(5) (https://www.sudo.ws/docs/man/sudoers.man/):
//   - "@includedir /etc/sudoers.d" (or the old form #includedir) reads
//     each file of the directory, in order, EXCEPT those whose name contains
//     a dot or ends with ~ (a "till.conf" is ignored);
//   - a rule: "who machines = (accounts) [NOPASSWD:] commands"; who: an
//     account, %group or ALL; a command: ALL, or a full path (without
//     arguments: all arguments are allowed; with some: only those; * as a
//     wildcard);
//   - Defaults lines and aliases (Cmnd_Alias…) are accepted; command
//     aliases are expanded.
// Differences: no user or host aliases, no Runas_Alias, no "!" (negation),
// no digest; the machine is always ALL.

import type { Shell } from './shell';
import { wildcard } from './tools';

export const SUDOERS = '/etc/sudoers';

export interface Rule {
  who: string[];
  as: string[];
  asText: string;
  withoutPassword: boolean;
  commands: string[];
  // Where it is written (for sudo -l).
  file: string;
}

export interface SudoersError {
  file: string;
  line: number;
  column: number;
  // A text key (sudoers-error-…), translated by the caller.
  key: string;
  text: string;
  length: number;
}

// The files an @includedir reads: with no dot nor trailing ~, sorted.
export function includedFiles(game: Shell, directory: string): string[] {
  const d = game.find(directory);
  if (d?.type !== 'directory') return [];
  return Object.keys(d.children)
    .filter((n) => !n.includes('.') && !n.endsWith('~') && d.children[n].type === 'file')
    .sort()
    .map((n) => `${directory}/${n}`);
}

/** Parses a sudoers text: the rules, and the first syntax error. */
export function parse(text: string, file: string): { rules: Rule[]; included: string[]; defaults: string[]; error: SudoersError | null } {
  const rules: Rule[] = [];
  const defaults: string[] = [];
  const included: string[] = [];
  const alias: Record<string, string[]> = {};
  const lines = text.split('\n');
  for (const [i, rawValue] of lines.entries()) {
    const inclusion = /^\s*[@#]include(dir)?\s+(\S+)/.exec(rawValue);
    if (inclusion) {
      included.push((inclusion[1] ? 'dir:' : '') + inclusion[2]);
      continue;
    }
    const line = rawValue.replace(/#.*/, '').trimEnd();
    if (!line.trim()) continue;
    const error = (key: string, chunk: string): SudoersError => {
      const column = Math.max(1, rawValue.indexOf(chunk) + 1);
      return { file, line: i + 1, column, key, text: rawValue, length: Math.max(1, chunk.length) };
    };
    const d = /^\s*Defaults\s+(.+)$/.exec(line);
    if (d) {
      defaults.push(d[1].trim());
      continue;
    }
    const a = /^\s*(Cmnd_Alias|User_Alias|Host_Alias|Runas_Alias)\s+([A-Z][A-Z0-9_]*)\s*=\s*(.+)$/.exec(line);
    if (a) {
      if (a[1] === 'Cmnd_Alias') alias[a[2]] = a[3].split(',').map((c) => c.trim());
      continue;
    }
    const r = /^\s*([^\s=,]+(?:\s*,\s*[^\s=,]+)*)\s+([^\s=]+)\s*=\s*(?:\(([^)]*)\)\s*)?((?:[A-Z_]+:\s*)*)(.*)$/.exec(line);
    if (!r) return { rules, included, defaults, error: error('sudoers-error-syntax', line.trim().split(/\s+/).at(-1) ?? line) };
    const commands = r[5]
      .split(',')
      .map((c) => c.trim())
      .flatMap((c) => alias[c] ?? [c]);
    if (!commands.length || commands.some((c) => !c))
      return { rules, included, defaults, error: error('sudoers-error-syntax', r[5] || line.trim()) };
    const relative = commands.find((c) => c !== 'ALL' && !c.startsWith('/'));
    if (relative) return { rules, included, defaults, error: error('sudoers-error-path', relative.split(/\s+/)[0]) };
    rules.push({
      who: r[1].split(',').map((q) => q.trim()),
      as: (r[3] ?? 'root').split(',').map((c) => c.trim().split(':')[0] || 'root'),
      // As sudo -l displays it: "ALL : ALL".
      asText: (r[3] ?? 'root').replace(/\s*:\s*/, ' : '),
      withoutPassword: /NOPASSWD:/.test(r[4]),
      commands,
      file,
    });
  }
  return { rules, included, defaults, error: null };
}

/** The whole policy: /etc/sudoers and its includes; the first error found. */
export function read(game: Shell): { rules: Rule[]; defaults: string[]; files: string[]; error: SudoersError | null } {
  const rules: Rule[] = [];
  const defaults: string[] = [];
  const seen = new Set<string>();
  const readFile = (file: string): SudoersError | null => {
    if (seen.has(file)) return null;
    seen.add(file);
    const text = game.read(file);
    if (text === null) return null;
    const r = parse(text, file);
    rules.push(...r.rules);
    defaults.push(...r.defaults);
    if (r.error) return r.error;
    for (const i of r.included) {
      const e = i.startsWith('dir:') ? includedFiles(game, i.slice(4)).map(readFile).find(Boolean) : readFile(i);
      if (e) return e;
    }
    return null;
  };
  const error = readFile(SUDOERS);
  return { rules, defaults, files: [...seen], error };
}

// Does a rule apply to this account (its name, %one of its groups, ALL)?
const forEachOf = (game: Shell, r: Rule, account: string) =>
  r.who.some((q) => q === 'ALL' || q === account || (q.startsWith('%') && game.groupsFor(account).includes(q.slice(1))));

// Does one of the rule's commands cover this command (full path and arguments)?
function covers(allowedOne: string, requested: string): boolean {
  if (allowedOne === 'ALL') return true;
  const [path, ...args] = allowedOne.split(/\s+/);
  const [dPath, ...argsD] = requested.split(/\s+/);
  if (!wildcard(path).test(dPath)) return false;
  if (!args.length) return true;
  if (args.length === 1 && args[0] === '""') return argsD.length === 0;
  return wildcard(args.join(' ')).test(argsD.join(' '));
}

/** Can this account run this command (full path) as root with sudo? */
export function permitted(game: Shell, account: string, command: string, as = 'root'): boolean {
  return read(game).rules.some(
    (r) => forEachOf(game, r, account) && (r.as.includes(as) || r.as.includes('ALL')) && r.commands.some((c) => covers(c, command)),
  );
}

/** An account's rules, as sudo -l displays them: "(root) NOPASSWD: /usr/bin/…". */
export function rulesFor(game: Shell, account: string): string[] {
  return read(game)
    .rules.filter((r) => forEachOf(game, r, account))
    .map((r) => `(${r.asText}) ${r.withoutPassword ? 'NOPASSWD: ' : ''}${r.commands.join(', ')}`);
}
