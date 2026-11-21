// bash's builtins a sysadmin types every day (man bash, "SHELL BUILTIN
// COMMANDS"): true, false, type, command and printf. echo's -e is in
// files.ts, test and [ in scripts.ts and shell.ts.

import type { Shell } from '../shell';
import { COMMANDS, type Command } from './index';

// What bash builds in (type says "is a shell builtin"; which finds nothing).
export const SHELL_BUILTINS = ['cd', 'exit', 'umask', 'echo', 'pwd', 'help', 'test', '[', 'history', 'true', 'false', 'type', 'command', 'printf', 'export', 'unset', 'alias', 'kill', 'read', 'set', 'source', 'jobs', 'fg', 'bg', 'ulimit', 'shift', 'local', 'return', 'trap', 'getopts', '.', ':'];
// bash's reserved words (type says "is a shell keyword").
export const SHELL_KEYWORDS = ['if', 'then', 'else', 'elif', 'fi', 'case', 'esac', 'for', 'select', 'while', 'until', 'do', 'done', 'in', 'function', 'time', '{', '}', '!', '[[', ']]'];
// The aliases of Debian's /etc/skel/.bashrc (the colour ones, enabled when dircolors exists).
export const DEBIAN_ALIASES: Record<string, string> = { ls: 'ls --color=auto', grep: 'grep --color=auto', fgrep: 'fgrep --color=auto', egrep: 'egrep --color=auto' };

/** Where a program of the game lives (/usr/sbin for administration commands, like which deduces it). */
export const programPath = (name: string) => `${COMMANDS[name]?.section === 8 ? '/usr/sbin' : '/usr/bin'}/${name}`;

// What a name is for bash on this machine: an alias, a keyword, a builtin, a program, or nothing.
// An alias's text: one of the session, or Debian's for a command the chapter has.
const aliasOf = (game: Shell, name: string): string | undefined =>
  Object.hasOwn(game.aliases, name) ? game.aliases[name] : DEBIAN_ALIASES[name] && game.known().includes(name) ? DEBIAN_ALIASES[name] : undefined;

function kind(game: Shell, name: string): 'alias' | 'keyword' | 'function' | 'builtin' | 'file' | null {
  if (aliasOf(game, name) !== undefined) return 'alias';
  if (SHELL_KEYWORDS.includes(name)) return 'keyword';
  if (Object.hasOwn(game.functions, name)) return 'function';
  if (SHELL_BUILTINS.includes(name) && (game.known().includes(name) || ['true', 'false', 'type', 'command', 'test', '[', 'help', 'history', 'exit', '.', ':'].includes(name))) return 'builtin';
  const c = COMMANDS[name];
  if (c && !c.directory && c.section !== 5 && !c.cmdlet && !c.cl && !c.winexe && game.known().includes(name)) return 'file';
  return null;
}

// type [-t|-p|-a] name…: how bash would read each name.
function type(game: Shell, args: string[]): string {
  const flags = new Set(args.filter((a) => /^-[atpP]+$/.test(a)).flatMap((a) => [...a.slice(1)]));
  const bad = args.find((a) => a.startsWith('-') && !/^-[atpP]+$/.test(a));
  if (bad) {
    game.status = 2;
    return game.error(`-bash: type: ${bad.slice(0, 2)}: invalid option\ntype: usage: type [-afptP] name [name ...]`);
  }
  const out: string[] = [];
  for (const name of args.filter((a) => !a.startsWith('-'))) {
    const k = kind(game, name);
    if (!k) {
      game.status = 1;
      if (!flags.has('t') && !flags.has('p')) game.error(`-bash: type: ${name}: not found`);
      continue;
    }
    if (flags.has('t')) out.push(k);
    else if (flags.has('p') || flags.has('P')) {
      if (k === 'file' || (flags.has('P') && COMMANDS[name])) out.push(programPath(name));
    } else {
      const all = flags.has('a');
      if (k === 'alias') out.push(`${name} is aliased to \`${aliasOf(game, name)}'`);
      if (k === 'keyword') out.push(`${name} is a shell keyword`);
      if (k === 'function') out.push(`${name} is a function`);
      if (k === 'builtin' || (all && SHELL_BUILTINS.includes(name) && k === 'alias')) out.push(`${name} is a shell builtin`);
      if (k === 'file' || (all && k === 'alias' && COMMANDS[name] && game.known().includes(name))) out.push(`${name} is ${programPath(name)}`);
      if (all && k === 'file' && ['kill', 'echo', 'printf', 'test', 'pwd', 'true', 'false'].includes(name)) out.unshift(`${name} is a shell builtin`);
    }
  }
  return out.join('\n');
}

// command -v|-V name…, or command name args: runs a program, without its alias.
function command(game: Shell, args: string[], input: string | null, last: boolean): string {
  if (args[0] === '-v' || args[0] === '-V') {
    const names = args.slice(1);
    if (args[0] === '-V') return type(game, names);
    const out: string[] = [];
    for (const name of names) {
      const k = kind(game, name);
      if (k === 'alias') out.push(`alias ${name}='${aliasOf(game, name)}'`);
      else if (k === 'file') out.push(programPath(name));
      else if (k) out.push(name);
    }
    if (!out.length) game.status = 1;
    return out.join('\n');
  }
  if (!args.length) return '';
  return game.run(args, input, last);
}

// printf FORMAT [ARGUMENTS…] (bash's builtin, like coreutils' printf): the
// format is reused while arguments remain; %s %b %c %d %i %u %o %x %X %e %f %g %%,
// with flags, width and precision; the escapes \n \t \\ \a \b \f \r \v \0NNN.
function printf(game: Shell, args: string[]): string {
  if (!args.length) {
    game.status = 2;
    return game.error('-bash: printf: usage: printf [-v var] format [arguments]');
  }
  const [format, ...rest] = args;
  const queue = [...rest];
  let out = '';
  let failed = false;
  const number = (v: string | undefined, integer: boolean): number => {
    if (v === undefined || v === '') return 0;
    // 'A or "A: the character's code.
    if (/^['"]./.test(v)) return v.codePointAt(1)!;
    const n = integer ? (/^[-+]?(0x[0-9a-f]+|0[0-7]*|\d+)$/i.test(v.trim()) ? Number.parseInt(v, /^[-+]?0x/i.test(v) ? 16 : /^[-+]?0\d/.test(v) ? 8 : 10) : NaN) : Number(v);
    if (Number.isNaN(n)) {
      game.error(`-bash: printf: ${v}: invalid number`);
      failed = true;
      // bash still prints what it could read (3.5 → 3), or 0.
      const head = /^[-+]?\d+/.exec(v);
      return head ? Number(head[0]) : 0;
    }
    return n;
  };
  const pad = (text: string, flags: string, width: number) => {
    if (text.length >= width) return text;
    if (flags.includes('-')) return text.padEnd(width);
    if (flags.includes('0') && /^[-+]?[\d.]/.test(text) && !/[a-z]/i.test(text.replace(/e[-+]\d+$/i, ''))) {
      const sign = /^[-+]/.test(text) ? text[0] : '';
      return sign + text.slice(sign.length).padStart(width - sign.length, '0');
    }
    return text.padStart(width);
  };
  for (let round = 0; round === 0 || queue.length; round++) {
    let used = 0;
    for (let i = 0; i < format.length; i++) {
      const c = format[i];
      if (c === '\\') {
        const e = escape(format, i);
        out += e.text;
        i = e.end;
        continue;
      }
      if (c !== '%') {
        out += c;
        continue;
      }
      const m = /^%([-+ 0#]*)(\d+|\*)?(?:\.(\d+|\*))?([sbcdiuoxXeEfgG%])/.exec(format.slice(i));
      if (!m) {
        out += c;
        continue;
      }
      i += m[0].length - 1;
      const [, flags, w, p, conv] = m;
      if (conv === '%') {
        out += '%';
        continue;
      }
      const width = w === '*' ? (used++, number(queue.shift(), true)) : Number(w ?? 0);
      const precision = p === '*' ? (used++, number(queue.shift(), true)) : p === undefined ? undefined : Number(p);
      used++;
      const v = queue.shift();
      let text: string;
      if (conv === 's') text = precision === undefined ? (v ?? '') : (v ?? '').slice(0, precision);
      else if (conv === 'b') {
        let t = '';
        const s = v ?? '';
        for (let k = 0; k < s.length; k++) {
          if (s[k] === '\\') {
            const e = escape(s, k);
            t += e.text;
            k = e.end;
          } else t += s[k];
        }
        text = t;
      } else if (conv === 'c') text = (v ?? '').slice(0, 1);
      else if ('diu'.includes(conv)) {
        const n = Math.trunc(number(v, true));
        text = (n >= 0 && flags.includes('+') ? '+' : n >= 0 && flags.includes(' ') ? ' ' : '') + String(n);
      } else if ('oxX'.includes(conv)) {
        const n = Math.trunc(number(v, true));
        text = n.toString(conv === 'o' ? 8 : 16);
        if (conv === 'X') text = text.toUpperCase();
        if (flags.includes('#') && n !== 0) text = (conv === 'o' ? '0' : conv === 'x' ? '0x' : '0X') + text;
      } else {
        const n = number(v, false);
        const digits = precision ?? 6;
        text = /[eE]/.test(conv) ? n.toExponential(digits).replace(/e([-+])(\d)$/, 'e$10$2') : /[gG]/.test(conv) ? String(Number(n.toPrecision(digits || 1))) : n.toFixed(digits);
        if (conv === 'E') text = text.toUpperCase();
        if (n >= 0 && flags.includes('+')) text = '+' + text;
      }
      out += pad(text, flags, width);
    }
    // A format without any conversion is printed once, whatever the arguments.
    if (!used) break;
  }
  if (failed) game.status = 1;
  return out.replace(/\n$/, '');
}

/** A backslash escape at position i (printf's format, %b, echo -e): its text and where it ends. */
export function escape(s: string, i: number): { text: string; end: number } {
  const n = s[i + 1];
  const simple: Record<string, string> = { n: '\n', t: '\t', '\\': '\\', a: '\x07', b: '\b', f: '\f', r: '\r', v: '\v', e: '\x1b', E: '\x1b', '"': '"', "'": "'" };
  if (n !== undefined && simple[n] !== undefined) return { text: simple[n], end: i + 1 };
  const octal = /^0?([0-7]{1,3})/.exec(s.slice(i + 1));
  if (octal && /[0-7]/.test(n ?? '')) return { text: String.fromCharCode(parseInt(octal[1], 8)), end: i + octal[0].length };
  const hex = /^x([0-9a-fA-F]{1,2})/.exec(s.slice(i + 1));
  if (hex) return { text: String.fromCharCode(parseInt(hex[1], 16)), end: i + hex[0].length };
  return { text: '\\', end: i };
}

// alias [name[=value]…]: lists, shows or defines aliases (for this session).
function alias(game: Shell, args: string[]): string {
  const all = { ...Object.fromEntries(Object.entries(DEBIAN_ALIASES).filter(([n]) => !Object.hasOwn(game.aliases, n))), ...game.aliases };
  const show = (n: string) => `alias ${n}='${all[n].replace(/'/g, "'\\''")}'`;
  const names = args.filter((a) => a !== '-p');
  if (!names.length) return Object.keys(all).sort().map(show).join('\n');
  const out: string[] = [];
  for (const a of names) {
    const eq = a.indexOf('=');
    if (eq > 0) {
      game.aliases[a.slice(0, eq)] = a.slice(eq + 1);
      continue;
    }
    if (Object.hasOwn(all, a)) out.push(show(a));
    else game.error(`-bash: alias: ${a}: not found`, 1);
  }
  return out.join('\n');
}

// unalias [-a] name…: forgets aliases.
function unalias(game: Shell, args: string[]): string {
  if (args.includes('-a')) {
    for (const n of Object.keys(game.aliases)) delete game.aliases[n];
    return '';
  }
  if (!args.length) return game.error('unalias: usage: unalias [-a] name [name ...]', 2);
  for (const a of args) {
    if (Object.hasOwn(game.aliases, a)) delete game.aliases[a];
    else game.error(`-bash: unalias: ${a}: not found`, 1);
  }
  return '';
}

export const BUILTINS: Record<string, Command> = {
  alias: { ownOptions: true, launch: ({ args, game }) => alias(game, args) },
  unalias: { ownOptions: true, launch: ({ args, game }) => unalias(game, args) },
  true: { ownOptions: true, launch: () => '' },
  false: {
    ownOptions: true,
    launch: ({ game }) => {
      game.status = 1;
      return '';
    },
  },
  type: { ownOptions: true, launch: ({ args, game }) => type(game, args) },
  command: { ownOptions: true, launch: ({ args, game, input, last }) => command(game, args, input, last) },
  printf: { ownOptions: true, launch: ({ args, game }) => printf(game, args) },
};
