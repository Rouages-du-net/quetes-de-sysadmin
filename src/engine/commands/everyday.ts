// Everyday companions of the game's commands: xargs (GNU findutils 4.9,
// https://www.gnu.org/software/findutils/manual/html_node/find_html/Invoking-xargs.html),
// env and printenv (coreutils 9.4).

import type { Shell } from '../shell';
import type { Command } from './index';
import { COMMANDS } from './index';

/** The environment a program sees: what a login sets, then what was exported (and NAME=value before it). */
export function environmentOf(game: Shell): Record<string, string> {
  const exported = Object.fromEntries([...game.exported].filter((n) => n in game.vars).map((n) => [n, game.vars[n]]));
  return { ...game.defaults(), ...exported, ...game.environment };
}

// xargs's items: blanks separate them, quotes and backslashes protect them
// (like GNU xargs without -0 or -d); -0: NUL-separated; -d: a delimiter.
function items(input: string, nul: boolean, delimiter: string | null): string[] | { error: string } {
  if (nul) return input.split('\0').filter((x, k, all) => x !== '' || k < all.length - 1).filter((x) => x !== '');
  if (delimiter !== null) return input.replace(/\n$/, '').split(delimiter);
  const out: string[] = [];
  let word: string | null = null;
  let quote = '';
  for (let k = 0; k < input.length; k++) {
    const c = input[k];
    if (quote) {
      if (c === quote) quote = '';
      else if (c === '\n') return { error: `xargs: unmatched ${quote === '"' ? 'double' : 'single'} quote; by default quotes are special to xargs unless you use the -0 option` };
      else word += c;
    } else if (c === '"' || c === "'") {
      quote = c;
      word ??= '';
    } else if (c === '\\' && k + 1 < input.length) {
      word = (word ?? '') + input[++k];
    } else if (/\s/.test(c)) {
      if (word !== null) out.push(word);
      word = null;
    } else word = (word ?? '') + c;
  }
  if (quote) return { error: `xargs: unmatched ${quote === '"' ? 'double' : 'single'} quote; by default quotes are special to xargs unless you use the -0 option` };
  if (word !== null) out.push(word);
  return out;
}

function xargs(game: Shell, args: string[], input: string | null, last: boolean): string {
  let max = Infinity;
  let lines = 0;
  let replace: string | null = null;
  let nul = false;
  let delimiter: string | null = null;
  let empty = true;
  let trace = false;
  let k = 0;
  const bad = (option: string, value: string) => {
    game.status = 1;
    return game.error(`xargs: invalid number "${value}" for -${option} option\nTry 'xargs --help' for more information.`);
  };
  // The options come first; the command and its arguments follow.
  for (; k < args.length && args[k].startsWith('-') && args[k] !== '-'; k++) {
    const a = args[k];
    const value = (short: string) => (a.length > short.length ? a.slice(short.length) : args[++k]);
    if (a === '--') {
      k++;
      break;
    }
    if (a === '-0' || a === '--null') nul = true;
    else if (a === '-r' || a === '--no-run-if-empty') empty = false;
    else if (a === '-t' || a === '--verbose') trace = true;
    else if (a.startsWith('-n') || a.startsWith('--max-args')) {
      const v = a.startsWith('--') ? a.split('=')[1] ?? args[++k] : value('-n');
      if (!/^\d+$/.test(v ?? '') || Number(v) < 1) return bad('n', v ?? '');
      max = Number(v);
    } else if (a.startsWith('-L') || a.startsWith('--max-lines')) {
      const v = a.startsWith('--') ? a.split('=')[1] ?? args[++k] : value('-L');
      if (!/^\d+$/.test(v ?? '') || Number(v) < 1) return bad('L', v ?? '');
      lines = Number(v);
    } else if (a.startsWith('-I') || a.startsWith('--replace')) {
      replace = a.startsWith('--') ? (a.split('=')[1] ?? '{}') : (value('-I') ?? '{}');
    } else if (a.startsWith('-i')) replace = a.length > 2 ? a.slice(2) : '{}';
    else if (a.startsWith('-d') || a.startsWith('--delimiter')) {
      const v = a.startsWith('--') ? a.split('=')[1] ?? args[++k] : value('-d');
      delimiter = v === '\\n' ? '\n' : v === '\\t' ? '\t' : v === '\\0' ? '\0' : (v ?? '');
    } else {
      game.status = 1;
      return game.error(a.startsWith('--') ? `xargs: unrecognized option '${a}'\nTry 'xargs --help' for more information.` : `xargs: invalid option -- '${a[1]}'\nTry 'xargs --help' for more information.`);
    }
  }
  const command = args.slice(k).length ? args.slice(k) : ['echo'];
  const text = input ?? '';
  // -I and -L work line by line.
  let groups: string[][];
  if (replace !== null || lines) {
    const all = (nul ? text.split('\0') : delimiter !== null ? text.split(delimiter) : text.split('\n')).filter((l) => l.trim() !== '');
    if (replace !== null) groups = all.map((l) => [l.replace(/^\s+/, '')]);
    else {
      const parsed = all.map((l) => items(l, false, null));
      const error = parsed.find((p) => !Array.isArray(p)) as { error: string } | undefined;
      if (error) return game.error(error.error, 1);
      groups = [];
      for (let g = 0; g < parsed.length; g += lines) groups.push((parsed.slice(g, g + lines) as string[][]).flat());
    }
  } else {
    const all = items(text, nul, delimiter);
    if (!Array.isArray(all)) return game.error(all.error, 1);
    groups = [];
    for (let g = 0; g < all.length; g += max === Infinity ? Math.max(all.length, 1) : max) groups.push(all.slice(g, g + (max === Infinity ? all.length : max)));
  }
  // GNU xargs runs the command once even without input, unless -r.
  if (!groups.length && empty && replace === null) groups = [[]];
  const outputs: string[] = [];
  let status = 0;
  for (const g of groups) {
    const line = replace !== null ? command.map((a) => a.split(replace!).join(g[0])) : [...command, ...g];
    if (trace) game.error(line.join(' '));
    const c = COMMANDS[line[0]];
    if ((!c || !game.known().includes(line[0])) && !line[0].includes('/')) {
      game.error(`xargs: ${line[0]}: No such file or directory`, 127);
      return outputs.join('\n');
    }
    const before = game.errorCount();
    const r = game.run(line, null, last);
    const code = game.status ?? (game.errorCount() > before ? 1 : 0);
    if (code >= 1 && code <= 125) status = 123;
    if (r) outputs.push(r);
  }
  game.status = status || null;
  return outputs.join('\n');
}

// env [-i] [-u NAME] [NAME=value…] [command…]: the environment, or a command run in a changed one.
function env(game: Shell, args: string[], input: string | null, last: boolean): string {
  let vars = environmentOf(game);
  let k = 0;
  for (; k < args.length; k++) {
    const a = args[k];
    if (a === '-i' || a === '-' || a === '--ignore-environment') vars = {};
    else if (a === '-u' || a === '--unset') delete vars[args[++k] ?? ''];
    else if (a.startsWith('-u')) delete vars[a.slice(2)];
    else if (a.startsWith('--unset=')) delete vars[a.slice(8)];
    else if (/^[A-Za-z_]\w*=/.test(a)) {
      const [n, ...v] = a.split('=');
      vars[n] = v.join('=');
    } else if (a.startsWith('-') && a !== '--') {
      game.status = 125;
      return game.error(`env: invalid option -- '${a[1]}'\nTry 'env --help' for more information.`);
    } else {
      if (a === '--') k++;
      break;
    }
  }
  const rest = args.slice(k);
  if (!rest.length) return Object.entries(vars).map(([n, v]) => `${n}=${v}`).join('\n');
  if (!COMMANDS[rest[0]] || !game.known().includes(rest[0])) {
    game.status = 127;
    return game.error(`env: '${rest[0]}': No such file or directory`);
  }
  const before = game.environment;
  game.environment = vars;
  try {
    return game.run(rest, input, last);
  } finally {
    game.environment = before;
  }
}

// printenv [NAME…]: the environment, or the values asked for (exit code 1 if one is missing).
function printenv(game: Shell, args: string[]): string {
  const vars = environmentOf(game);
  const names = args.filter((a) => !a.startsWith('-'));
  if (!names.length) return Object.entries(vars).map(([n, v]) => `${n}=${v}`).join('\n');
  const found = names.filter((n) => Object.hasOwn(vars, n));
  if (found.length < names.length) game.status = 1;
  return found.map((n) => vars[n]).join('\n');
}

export const EVERYDAY: Record<string, Command> = {
  xargs: { ownOptions: true, launch: ({ args, game, input, last }) => xargs(game, args, input, last) },
  env: { ownOptions: true, launch: ({ args, game, input, last }) => env(game, args, input, last) },
  printenv: { launch: ({ args, game }) => printenv(game, args) },
};
