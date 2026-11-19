// Text commands: they read files, or what comes through a pipe when they
// are given no file. That is Unix's strength: small tools that do one
// thing, and that are chained together.

import { options, wildcard, compareNames } from '../tools';
import { colourise, readColour, invalidColourMessage, sgr } from '../colours';
import { COMMANDS, type Command, type Context } from './index';
import { isBsd } from '../freebsd';
import { isSolaris } from '../solaris';

// The lines to process: those of the given files, else the pipe's input.
function texts(cmd: string, { input, game }: Context, files: string[]): { name: string; text: string }[] {
  if (!files.length) {
    if (input === null) game.error(game.t('text-without-input', { command: cmd }));
    return input === null ? [] : [{ name: '', text: input }];
  }
  return files
    .map((f) => ({ name: f, text: game.readFor(cmd, f) }))
    .filter((t): t is { name: string; text: string } => t.text !== null);
}

const linesFor = (t: string) => (t === '' ? [] : t.split('\n'));

// -n 5, -n5 or -5 → 5; tail's -n +N (from line N) and head's -n -N (all but the
// last N) keep their sign; -c N counts bytes instead of lines.
function count(args: string[], fallback: number): { n: number; sign: string; bytes: boolean; rest: string[]; bad?: string } {
  const rest: string[] = [];
  let value = String(fallback);
  let bytes = false;
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '-n' || a === '-c' || a === '--lines' || a === '--bytes') {
      value = args[++i] ?? '';
      bytes = a === '-c' || a === '--bytes';
    } else if (/^-[nc].+$/.test(a)) {
      value = a.slice(2);
      bytes = a[1] === 'c';
    } else if (/^--(lines|bytes)=/.test(a)) {
      value = a.slice(a.indexOf('=') + 1);
      bytes = a.startsWith('--bytes');
    } else if (/^-\d+$/.test(a)) value = a.slice(1);
    else rest.push(a);
  }
  const m = /^([+-]?)(\d+)$/.exec(value.trim());
  if (!m) return { n: fallback, sign: '', bytes, rest, bad: value };
  return { n: Number(m[2]), sign: m[1], bytes, rest };
}

function head(cmd: 'head' | 'tail') {
  return (c: Context) => {
    const { n, sign, bytes, rest, bad } = count(c.args, 10);
    if (bad !== undefined) return c.game.error(`${cmd}: invalid number of ${bytes ? 'bytes' : 'lines'}: \u2018${bad}\u2019`, 1);
    const ts = texts(cmd, c, rest);
    return ts
      .map(({ name, text }) => {
        let part: string;
        if (bytes) {
          // Bytes, the final newline included (the game's texts keep none).
          const all = text === '' ? '' : `${text}\n`;
          part = (cmd === 'head' ? (sign === '-' ? all.slice(0, Math.max(0, all.length - n)) : all.slice(0, n)) : sign === '+' ? all.slice(Math.max(0, n - 1)) : all.slice(Math.max(0, all.length - n))).replace(/\n$/, '');
        } else {
          const l = linesFor(text);
          // head -n -N: all but the last N; tail -n +N: from line N on.
          part = (cmd === 'head' ? (sign === '-' ? l.slice(0, Math.max(0, l.length - n)) : l.slice(0, n)) : sign === '+' ? l.slice(Math.max(0, n - 1)) : l.slice(Math.max(0, l.length - n))).join('\n');
        }
        return (ts.length > 1 ? `==> ${name} <==\n` : '') + part;
      })
      .join('\n\n');
  };
}

// ——— sort (GNU coreutils: https://www.gnu.org/software/coreutils/manual/html_node/sort-invocation.html) ———

interface SortKey {
  start: { field: number; char: number };
  end: { field: number; char: number } | null;
  flags: string;
}

// -k POS1[,POS2]: F[.C][flags].
function sortKey(spec: string): SortKey | null {
  const m = /^(\d+)(?:\.(\d+))?([bdfghiMnRrV]*)(?:,(\d+)(?:\.(\d+))?([bdfghiMnRrV]*))?$/.exec(spec);
  if (!m || Number(m[1]) < 1) return null;
  return {
    start: { field: Number(m[1]), char: Number(m[2] ?? 1) },
    end: m[4] ? { field: Number(m[4]), char: Number(m[5] ?? 0) } : null,
    flags: (m[3] ?? '') + (m[6] ?? ''),
  };
}

// The fields of a line: separated by the -t character, or by blanks (a field begins with its leading blanks).
function fieldsOf(line: string, sep: string | null): { text: string; at: number }[] {
  const out: { text: string; at: number }[] = [];
  if (sep !== null) {
    let at = 0;
    for (const f of line.split(sep)) {
      out.push({ text: f, at });
      at += f.length + 1;
    }
    return out;
  }
  const re = /\s*\S+/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(line))) out.push({ text: m[0], at: m.index });
  return out;
}

function keyText(line: string, k: SortKey, sep: string | null): string {
  const fields = fieldsOf(line, sep);
  const from = fields[k.start.field - 1];
  if (!from) return '';
  const start = from.at + k.start.char - 1;
  if (!k.end) return line.slice(start);
  const to = fields[k.end.field - 1];
  const end = !to ? line.length : k.end.char === 0 ? to.at + to.text.length : to.at + k.end.char;
  return line.slice(start, Math.max(start, end));
}

// -h: 2K, 1.5M, 3G… (a larger suffix is larger, whatever the number).
const human = (t: string) => {
  const m = /^\s*(-?\d+(?:[.,]\d+)?)\s*([KMGTPEZY]?)/i.exec(t);
  if (!m) return 0;
  return parseFloat(m[1].replace(',', '.')) * 1024 ** ' KMGTPEZY'.indexOf((m[2] || ' ').toUpperCase());
};
// -n: the number at the start (blanks skipped), 0 otherwise.
const numeric = (t: string) => {
  const m = /^\s*(-?\d+(?:\.\d+)?)/.exec(t);
  return m ? parseFloat(m[1]) : 0;
};
// -V: version numbers compared piece by piece (1.10 after 1.9).
const version = (a: string, b: string) => a.localeCompare(b, 'en', { numeric: true });

function sortCompare(flags: string): (a: string, b: string) => number {
  const fold = flags.includes('f');
  const blanks = flags.includes('b');
  const base = (a: string, b: string) => {
    if (blanks) [a, b] = [a.trimStart(), b.trimStart()];
    if (flags.includes('h')) return human(a) - human(b);
    if (flags.includes('n') || flags.includes('g')) return numeric(a) - numeric(b);
    if (flags.includes('V')) return version(a, b);
    if (fold) return compareText(a.toLowerCase(), b.toLowerCase());
    return compareText(a, b);
  };
  return flags.includes('r') ? (a, b) => base(b, a) : base;
}

const compareText = (a: string, b: string) => a.localeCompare(b, 'fr');

function sort(c: Context): string {
  const { game } = c;
  let letters = '';
  let sep: string | null = null;
  let output: string | null = null;
  const keys: SortKey[] = [];
  const files: string[] = [];
  const a = c.args;
  for (let i = 0; i < a.length; i++) {
    const x = a[i];
    if (x === '--') {
      files.push(...a.slice(i + 1));
      break;
    }
    if (!x.startsWith('-') || x === '-') {
      files.push(x);
      continue;
    }
    // Grouped letters; -k, -t and -o take a value, glued or not.
    for (let j = 1; j < x.length; j++) {
      const o = x[j];
      if (o === 'k' || o === 't' || o === 'o') {
        const v = x.slice(j + 1) || a[++i];
        if (v === undefined) return game.error(`sort: option requires an argument -- '${o}'\nTry 'sort --help' for more information.`, 2);
        if (o === 't') {
          if (v.length !== 1) return game.error(`sort: multi-character tab \u2018${v}\u2019`, 2);
          sep = v;
        } else if (o === 'o') output = v;
        else {
          const k = sortKey(v);
          if (!k) return game.error(`sort: invalid number at field start: invalid count at start of \u2018${v}\u2019`, 2);
          keys.push(k);
        }
        break;
      }
      letters += o;
    }
  }
  const lines = texts('sort', c, files).flatMap((t) => linesFor(t.text));
  // The options given alone apply to every key that has no flag of its own.
  const global = letters.replace(/[uscm]/g, '');
  const cmp = (x: string, y: string) => {
    for (const k of keys) {
      const r = sortCompare(k.flags.replace(/b/g, '') ? k.flags : global + k.flags)(keyText(x, k, sep), keyText(y, k, sep));
      if (r) return r;
    }
    if (!keys.length) {
      const r = sortCompare(global)(x, y);
      if (r || letters.includes('u')) return r;
    }
    // Last resort: the whole line, byte against byte (not with -s or -u).
    if (letters.includes('s') || letters.includes('u')) return 0;
    const r = compareText(x, y);
    return letters.includes('r') ? -r : r;
  };
  // -c: is it already sorted? The first line out of order, and exit code 1.
  if (letters.includes('c')) {
    for (let k = 1; k < lines.length; k++)
      if (cmp(lines[k - 1], lines[k]) > 0) {
        game.status = 1;
        return game.error(`sort: ${files[0] ?? '-'}:${k + 1}: disorder: ${lines[k]}`, 1);
      }
    return '';
  }
  const sorted = [...lines].sort(cmp);
  // -u: one line of each group of equal keys (the first).
  const result = letters.includes('u') ? sorted.filter((l, k) => k === 0 || cmp(sorted[k - 1], l) !== 0) : sorted;
  // -o FILE: written into the file (it may be one of the inputs: sort -o f f).
  if (output !== null) {
    COMMANDS.tee.launch({ args: [output], input: result.join('\n'), game, last: false });
    return '';
  }
  return result.join('\n');
}

// cut's LIST: N, N-M, N-, -M, separated by commas; positions start at 1.
function cutList(spec: string): ((n: number) => boolean) | string {
  const parts = spec.split(',');
  const ranges: [number, number][] = [];
  for (const p of parts) {
    const m = /^(\d*)(-?)(\d*)$/.exec(p);
    if (!m || (!m[1] && !m[3])) return 'invalid';
    const from = m[1] ? Number(m[1]) : 1;
    const to = m[2] ? (m[3] ? Number(m[3]) : Infinity) : from;
    if (from === 0 || to === 0) return 'zero';
    if (to < from) return 'decreasing';
    ranges.push([from, to]);
  }
  return (n: number) => ranges.some(([a, b]) => n >= a && n <= b);
}

// GNU grep's options, read like getopt_long (grep 3.11's messages).
// Source: https://www.gnu.org/software/grep/manual/grep.html
const GREP_TRY = "Usage: grep [OPTION]... PATTERNS [FILE]...\nTry 'grep --help' for more information.";
const GREP_LONG: Record<string, string> = {
  'ignore-case': 'i',
  'invert-match': 'v',
  count: 'c',
  quiet: 'q',
  silent: 'q',
  'extended-regexp': 'E',
  'perl-regexp': 'P',
  'fixed-strings': 'F',
  'no-filename': 'h',
  'with-filename': 'H',
  'line-number': 'n',
  'only-matching': 'o',
  recursive: 'r',
  'dereference-recursive': 'R',
  'files-with-matches': 'l',
  'files-without-match': 'L',
  'word-regexp': 'w',
  'line-regexp': 'x',
  'no-messages': 's',
  'no-group-separator': '',
};
// The long options that take a value (--after-context=3 or --after-context 3).
const GREP_LONG_VALUE: Record<string, string> = {
  'after-context': 'A',
  'before-context': 'B',
  context: 'C',
  'max-count': 'm',
  regexp: 'e',
  file: 'f',
  'group-separator': '',
  include: '',
  exclude: '',
  'exclude-dir': '',
};
const GREP_LETTERS = 'ivcqEPFhHnorRlLwxs';

type GrepOptions = {
  letters: Set<string>;
  rest: string[];
  after?: number;
  before?: number;
  context?: number;
  max: number;
  separator: string | null;
  // -e PATTERN (repeatable) and -f FILE, in their order; null: the pattern is the first operand.
  patterns: { text?: string; file?: string }[] | null;
  include: string[];
  exclude: string[];
  excludeDir: string[];
};

/**
 * The options of GNU grep, or its error message (exit code 2). `lenient`: on
 * FreeBSD and Solaris, whose own check has already accepted the arguments,
 * letters that only that grep knows are ignored.
 */
export function grepOptions(args: string[], lenient = false): GrepOptions | string {
  const o: GrepOptions = { letters: new Set(), rest: [], max: -1, separator: '--', patterns: null, include: [], exclude: [], excludeDir: [] };
  // A context length: a decimal number, with spaces or + before it (strtoimax).
  const length = (v: string): number | string => (/^\s*\+?\d+$/.test(v) ? Math.min(Number(v.trim()), Number.MAX_SAFE_INTEGER) : `grep: ${v}: invalid context length argument`);
  const valued = (letter: string, v: string): string | null => {
    if (letter === 'e' || letter === 'f') {
      (o.patterns ??= []).push(letter === 'e' ? { text: v } : { file: v });
      return null;
    }
    if (letter === 'm') {
      if (!/^\s*[+-]?\d+$/.test(v)) return 'grep: invalid max count';
      const n = Number(v.trim());
      o.max = n < 0 ? -1 : n;
      return null;
    }
    const n = length(v);
    if (typeof n === 'string') return n;
    if (letter === 'A') o.after = n;
    else if (letter === 'B') o.before = n;
    else o.context = n;
    return null;
  };
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--') {
      o.rest.push(...args.slice(i + 1));
      break;
    }
    if (a.startsWith('--')) {
      const [name, ...value] = a.slice(2).split('=');
      const v = value.length ? value.join('=') : undefined;
      if (name in GREP_LONG) {
        if (v !== undefined) return `grep: option '--${name}' doesn't allow an argument\n${GREP_TRY}`;
        if (name === 'no-group-separator') o.separator = null;
        else o.letters.add(GREP_LONG[name]);
      } else if (name in GREP_LONG_VALUE) {
        const given = v ?? args[++i];
        if (given === undefined) return `grep: option '--${name}' requires an argument\n${GREP_TRY}`;
        if (name === 'group-separator') o.separator = given;
        else if (name === 'include') o.include.push(given);
        else if (name === 'exclude') o.exclude.push(given);
        else if (name === 'exclude-dir') o.excludeDir.push(given);
        else {
          const error = valued(GREP_LONG_VALUE[name], given);
          if (error) return error;
        }
      } else if (!lenient) return `grep: unrecognized option '--${name}'\n${GREP_TRY}`;
      continue;
    }
    if (!a.startsWith('-') || a === '-') {
      o.rest.push(a);
      continue;
    }
    // -NUM is -C NUM: the digits of one word make one number (-12), a new word starts again.
    let digits = '';
    for (let j = 1; j < a.length; j++) {
      const l = a[j];
      if (/\d/.test(l)) {
        digits += l;
        o.context = Math.min(Number(digits), Number.MAX_SAFE_INTEGER);
      } else if ('ABCmef'.includes(l)) {
        const v = j < a.length - 1 ? a.slice(j + 1) : args[++i];
        if (v === undefined) return `grep: option requires an argument -- '${l}'\n${GREP_TRY}`;
        const error = valued(l, v);
        if (error) return error;
        break;
      } else if (GREP_LETTERS.includes(l)) o.letters.add(l);
      else if (!lenient) return `grep: invalid option -- '${l}'\n${GREP_TRY}`;
    }
  }
  return o;
}

const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export const TEXT: Record<string, Command> = {
  less: {
    launch: (c) => texts('less', c, c.args.slice(0, 1)).map((t) => t.text).join('\n'),
  },

  grep: {
    // GNU grep reads its options itself (getopt_long): -A3, -nC2, -2, --context 3, -rn…
    ownOptions: true,
    launch: (raw) => {
      // --color: like the alias "grep --color=auto" of Debian's ~/.bashrc.
      const colour = readColour(raw.args, 'auto', 'auto');
      if (colour.invalid !== undefined) return raw.game.error(invalidColourMessage(raw, 'grep', colour.invalid));
      const c = { ...raw, args: colour.args };
      const game = c.game;
      const inColour = colourise(c, colour.when);
      // On FreeBSD and Solaris, the BSD or Solaris check already refused what that grep lacks.
      const parsed = grepOptions(c.args, isBsd(game) || isSolaris(game));
      if (typeof parsed === 'string') return game.error(parsed, 2);
      const { letters, max, separator } = parsed;
      // -A and -B override -C (and -NUM) whatever their order; -1 means "not asked".
      const after = parsed.after ?? parsed.context ?? -1;
      const before = parsed.before ?? parsed.context ?? -1;
      const withContext = after >= 0 || before >= 0;
      // Without -e nor -f, the pattern is the first operand; a pattern with newlines is several patterns.
      let patterns: string[];
      let files: string[];
      if (parsed.patterns) {
        patterns = [];
        for (const p of parsed.patterns) {
          if (p.text !== undefined) patterns.push(...p.text.split('\n'));
          else {
            const text = game.readFor('grep', p.file!);
            if (text === null) {
              game.status = 2;
              return '';
            }
            patterns.push(...linesFor(text));
          }
        }
        files = parsed.rest;
      } else {
        if (parsed.rest[0] === undefined) return game.error(game.t('grep-usage'));
        patterns = parsed.rest[0].split('\n');
        files = parsed.rest.slice(1);
      }
      const pattern = patterns.join('\n');
      const broken = letters.has('i');
      const invert = letters.has('v');
      const recursive = letters.has('r') || letters.has('R');
      // The patterns: basic regular expressions (BRE), extended with -E, plain text with -F;
      // -w: not inside a word (letters, digits, _), -x: the whole line.
      let re: RegExp | null = null;
      if (patterns.length) {
        const sources: string[] = [];
        for (const p of patterns) {
          let s = letters.has('F') ? escapeRegex(p) : letters.has('E') || letters.has('P') ? p : toBasicRegex(p);
          try {
            // -P (GNU): Perl-compatible expressions, close to JavaScript's (\d, \w, lookarounds).
            new RegExp(s);
          } catch {
            return game.error(/\[/.test(p) && !/\]/.test(p) ? 'grep: Unmatched [, [^, [:, [., or [=' : 'grep: Invalid regular expression', 2);
          }
          if (letters.has('x')) s = `^(?:${s})$`;
          else if (letters.has('w')) s = `(?<![A-Za-z0-9_])(?:${s})(?![A-Za-z0-9_])`;
          sources.push(`(?:${s})`);
        }
        re = new RegExp(sources.join('|'), broken ? 'i' : '');
      }
      const global = re ? new RegExp(re.source, re.flags + 'g') : null;
      const correspond = (l: string) => (re ? re.test(l) : false);
      // The matching parts of a line (for the colours and -o).
      const parts = (l: string): [number, number][] => {
        const found: [number, number][] = [];
        if (!global) return found;
        global.lastIndex = 0;
        for (let m = global.exec(l); m; m = global.exec(l)) {
          if (m[0] === '') {
            global.lastIndex++;
            continue;
          }
          found.push([m.index, m.index + m[0].length]);
        }
        return found;
      };

      // ——— What to read: the operands, the trees of -r, or the pipe ———
      const quiet = letters.has('s');
      let troubles = false;
      const complain = (key: string, target: string) => {
        troubles = true;
        if (!quiet) game.error(game.t(key, { command: 'grep', target }));
      };
      // --include, --exclude: on a file's name; --exclude-dir: on a directory's name.
      const globs = (list: string[], name: string) => list.some((g) => wildcard(g).test(name) || wildcard(g).test(name.split('/').filter(Boolean).at(-1) ?? name));
      const skipFile = (name: string) => (parsed.include.length > 0 && !globs(parsed.include, name)) || globs(parsed.exclude, name);
      const sources: { name: string; text: string }[] = [];
      const readFile = (path: string) => {
        const text = game.readFor('grep', path);
        if (text === null) troubles = true;
        else sources.push({ name: path, text });
      };
      // -r walks the directories in the game's usual order (GNU's is the directory's own order);
      // it skips the symbolic links it meets, -R follows them.
      const walk = (path: string, shown: string) => {
        const n = game.find(path)!;
        if (n.type !== 'directory') return;
        if (!game.traverses(path) || !game.can(n, 'r') || !game.can(n, 'x')) return complain('error-permission', shown || '.');
        for (const name of Object.keys(n.children).sort(compareNames)) {
          const child = n.children[name];
          const childPath = path === '/' ? `/${name}` : `${path.replace(/\/$/, '')}/${name}`;
          const childShown = shown ? `${shown.replace(/\/$/, '')}/${name}` : name;
          if (child.type === 'file' && child.link !== undefined && !letters.has('R')) continue;
          const target = game.find(childPath);
          if (!target) continue;
          if (target.type === 'directory') {
            if (!globs(parsed.excludeDir, name)) walk(childPath, childShown);
          } else if (!skipFile(name)) {
            if (!game.can(target, 'r')) complain('error-permission', childShown);
            else {
              const text = game.readFor('grep', childPath);
              if (text === null) troubles = true;
              else sources.push({ name: childShown, text });
            }
          }
        }
      };
      let someDirectory = false;
      if (recursive && !files.length) {
        // -r without a file: the current directory, names shown without "./".
        someDirectory = true;
        walk('.', '');
      } else if (!files.length) sources.push(...texts('grep', c, []));
      for (const file of files) {
        const n = game.find(file);
        if (!n) complain('error-missing', file);
        else if (n.type === 'directory') {
          someDirectory = true;
          if (!recursive) complain('error-is-one-directory', file);
          else if (!globs(parsed.excludeDir, file)) walk(file, file);
        } else if (skipFile(file)) continue;
        else if (!game.traverses(file) || !game.can(n, 'r')) complain('error-permission', file);
        else readFile(file);
      }

      // ——— The output ———
      // In colour (default GREP_COLORS): matches in bold red (ms, and mc in the
      // context lines of -v), the file name in magenta, the line number in green,
      // the separators (":", "-", "--") in cyan.
      const highlight = (l: string) => {
        if (!inColour) return l;
        let output = '';
        let i = 0;
        for (const [from, to] of parts(l)) {
          output += l.slice(i, from) + sgr('01;31', l.slice(from, to));
          i = to;
        }
        return output + l.slice(i);
      };
      const paint = (code: string, text: string) => (inColour ? sgr(code, text) : text);
      // -h: never the file name; -H: always; by default, with several files or a directory searched by -r.
      const named = letters.has('h') ? false : letters.has('H') || files.length > 1 || (recursive && someDirectory);
      const numbered = letters.has('n');
      const fileName = (name: string) => paint('35', name || '(standard input)');
      // A selected line's prefix ends with ":", a context line's with "-" (FILE-12-text, FILE:13:text).
      const prefix = (name: string, n: number, sep: ':' | '-') => (named ? fileName(name) + paint('36', sep) : '') + (numbered ? paint('32', String(n + 1)) + paint('36', sep) : '');
      const listing = letters.has('l') || letters.has('L');
      const outputs: string[] = [];
      let found = 0;
      // Something already printed (the separator also goes between two files).
      let used = false;
      for (const { name, text } of sources) {
        const lines = linesFor(text);
        const selected = (l: string) => correspond(l) !== invert;
        // -l, -L: only the names of the files (with, without a selected line); they win over -c.
        if (listing || letters.has('c')) {
          let n = 0;
          for (const l of lines) if (n !== max && selected(l) && !(listing && n)) n++;
          found += n;
          if (letters.has('l') ? n > 0 : letters.has('L') ? n === 0 : false) outputs.push(fileName(name));
          else if (!listing) outputs.push(named ? `${fileName(name)}${paint('36', ':')}${n}` : String(n));
          continue;
        }
        // GNU grep's algorithm (prtext): the lines before a selected line, the
        // line, then the following ones; "--" when a group does not follow the last line printed.
        let last = -1;
        let pending = 0;
        let n = 0;
        // -o prints the matching parts of each line it would print: none for a
        // context line, except with -v, where the context lines are those that match.
        const print = (i: number, sep: ':' | '-') => {
          if (letters.has('o')) for (const [a, b] of parts(lines[i])) outputs.push(prefix(name, i, sep) + paint('01;31', lines[i].slice(a, b)));
          else outputs.push(prefix(name, i, sep) + (invert === (sep === '-') ? highlight(lines[i]) : lines[i]));
          last = i;
        };
        for (let i = 0; i < lines.length && n !== max; i++) {
          if (!selected(lines[i])) {
            if (pending > 0) {
              print(i, '-');
              pending--;
            }
            continue;
          }
          const from = Math.max(last + 1, i - Math.max(before, 0));
          if (withContext && used && separator !== null && (last < 0 || from > last + 1)) outputs.push(paint('36', separator));
          for (let k = from; k < i; k++) print(k, '-');
          print(i, ':');
          used = true;
          pending = Math.max(after, 0);
          n++;
          // -m: once NUM lines are selected, grep still prints the trailing context, matching or not.
          if (n === max) for (let k = i + 1; k < lines.length && pending > 0; k++, pending--) print(k, '-');
        }
        found += n;
      }
      // -q: nothing on screen; only the exit code counts (0 as soon as a line is selected).
      if (letters.has('q')) {
        game.status = found ? 0 : troubles ? 2 : 1;
        return '';
      }
      // Like grep: code 1 when nothing matches (useful in a script), 2 after an error.
      game.status = troubles ? 2 : found ? 0 : 1;
      // Deliberate difference: the real grep says nothing when it finds nothing;
      // here, the game says so (only on screen, never in a pipe).
      if (!found && !troubles && !letters.has('c') && !listing && c.last && sources.length) game.error(game.t('grep-nothing', { pattern: pattern }));
      return outputs.join('\n');
    },
  },

  head: {
    launch: head('head'),
  },

  tail: {
    // -f (--follow, -F): after the end of the file, tail waits for what gets
    // appended and shows it, until Ctrl-C (Shell.follow, see activity.ts).
    launch: (c) => {
      const follow = c.args.some((a) => a === '-f' || a === '-F' || a === '--follow');
      const args = c.args.filter((a) => a !== '-f' && a !== '-F' && a !== '--follow');
      const output = head('tail')({ ...c, args });
      const { rest } = count(args, 10);
      // Difference: in a pipe (tail -f log | grep …), the game shows it once, without following.
      if (!follow || !c.last || rest.length !== 1 || c.game.readFor('tail', rest[0]) === null) return output;
      const file = c.game.resolve(rest[0]);
      let views = linesFor(c.game.read(file) ?? '').length;
      c.game.follow = {
        read: () => {
          const lines = linesFor(c.game.read(file) ?? '');
          if (lines.length < views) {
            views = lines.length;
            return `tail: ${rest[0]}: file truncated`;
          }
          const fresh = lines.slice(views);
          views = lines.length;
          return fresh.join('\n');
        },
      };
      return output;
    },
  },

  wc: {
    launch: (c) => {
      const { letters, rest } = options(c.args);
      const all = !letters.has('l') && !letters.has('w') && !letters.has('c');
      return texts('wc', c, rest)
        .map(({ name, text }) => {
          // Raw bytes (an EBCDIC file): counted as they are, no final newline; a line is a 0x0A byte.
          const node = name ? c.game.find(name) : null;
          const raw = node ? node.type === 'file' && node.charset === 'binary' : c.game.outputCharset === 'binary';
          // Like the real wc: line endings are counted.
          const fields: number[] = [];
          if (all || letters.has('l')) fields.push(raw ? text.split('\n').length - 1 : text === '' ? 0 : text.split('\n').length);
          if (all || letters.has('w')) fields.push(text.split(/[\s]+/).filter(Boolean).length);
          if (all || letters.has('c')) fields.push(raw ? text.length : new TextEncoder().encode(text).length + (text ? 1 : 0));
          return [fields.length === 1 ? String(fields[0]) : fields.map((n) => String(n).padStart(6)).join(' '), name].filter(Boolean).join(' ');
        })
        .join('\n');
    },
  },

  sort: { ownOptions: true, launch: sort },

  // uniq: equal neighbouring lines once (sort first); -c counts them, -d only
  // the repeated ones, -u only the others, -i ignores case, -f N skips N fields, -s N N characters.
  uniq: {
    launch: (c) => {
      const { game } = c;
      const flags = new Set<string>();
      let skipFields = 0;
      let skipChars = 0;
      const files: string[] = [];
      for (let i = 0; i < c.args.length; i++) {
        const a = c.args[i];
        if (/^-[fs]/.test(a)) {
          const v = a.slice(2) || c.args[++i] || '';
          if (!/^\d+$/.test(v)) return game.error(`uniq: ${v}: invalid number of ${a[1] === 'f' ? 'fields' : 'bytes'} to skip`, 1);
          if (a[1] === 'f') skipFields = Number(v);
          else skipChars = Number(v);
        } else if (/^-[a-zA-Z]+$/.test(a)) for (const l of a.slice(1)) flags.add(l);
        else files.push(a);
      }
      const keyOf = (l: string) => {
        let k = l;
        for (let f = 0; f < skipFields; f++) k = k.replace(/^\s*\S+/, '');
        k = k.slice(skipChars);
        return flags.has('i') ? k.toLowerCase() : k;
      };
      const groups: { line: string; key: string; n: number }[] = [];
      for (const l of texts('uniq', c, files.slice(0, 1)).flatMap((t) => linesFor(t.text))) {
        const last = groups.at(-1);
        const key = keyOf(l);
        if (last && last.key === key) last.n++;
        else groups.push({ line: l, key, n: 1 });
      }
      return groups
        .filter((g) => (!flags.has('d') || g.n > 1) && (!flags.has('u') || g.n === 1))
        .map((g) => (flags.has('c') ? `${String(g.n).padStart(7)} ${g.line}` : g.line))
        .join('\n');
    },
  },

  // cut -f LIST [-d C] [-s] | -c LIST | -b LIST, --complement, --output-delimiter.
  cut: {
    launch: (c) => {
      const { game } = c;
      let sep = '\t';
      let mode: 'f' | 'c' | null = null;
      let list = '';
      let complement = false;
      let onlyDelimited = false;
      let joiner: string | null = null;
      const files: string[] = [];
      const fail = (message: string) => game.error(`cut: ${message}\nTry 'cut --help' for more information.`, 1);
      for (let i = 0; i < c.args.length; i++) {
        const a = c.args[i];
        if (a === '--complement') complement = true;
        else if (a.startsWith('--output-delimiter=')) joiner = a.slice(19);
        else if (a === '-s' || a === '--only-delimited') onlyDelimited = true;
        else if (/^-[dfcb]/.test(a)) {
          const v = a.length > 2 ? a.slice(2) : c.args[++i];
          if (v === undefined) return fail(`option requires an argument -- '${a[1]}'`);
          if (a[1] === 'd') sep = v;
          else {
            if (mode) return fail('only one type of list may be specified');
            mode = a[1] === 'f' ? 'f' : 'c';
            list = v;
          }
        } else files.push(a);
      }
      if (!mode) return game.error(game.t('cut-fields'));
      if (sep.length !== 1) return game.error(game.t('cut-separator'));
      const picked = cutList(list);
      if (picked === 'zero') return fail(mode === 'f' ? 'fields are numbered from 1' : 'byte/character positions are numbered from 1');
      if (picked === 'decreasing') return fail('invalid decreasing range');
      if (typeof picked === 'string') return fail(`invalid field value \u2018${list}\u2019`);
      const keep = (n: number) => picked(n) !== complement;
      return texts('cut', c, files)
        .flatMap((t) => linesFor(t.text))
        .flatMap((l) => {
          if (mode === 'c') {
            const chars = [...l].filter((_, k) => keep(k + 1)).join('');
            return [chars];
          }
          const parts = l.split(sep);
          // A line without the delimiter: printed whole, unless -s.
          if (parts.length === 1) return onlyDelimited ? [] : [l];
          return [parts.filter((_, k) => keep(k + 1)).join(joiner ?? sep)];
        })
        .join('\n');
    },
  },
};

// A basic regular expression (BRE, like grep without -E) as a JavaScript expression:
// + ? | ( ) { } are ordinary characters, and special when preceded by \;
// brackets [...] are copied as they are.
export function toBasicRegex(pattern: string): string {
  let res = '';
  for (let i = 0; i < pattern.length; i++) {
    const c = pattern[i];
    if (c === '\\' && i + 1 < pattern.length) {
      const s = pattern[++i];
      res += '+?|(){}'.includes(s) ? s : `\\${s}`;
    } else if ('+?|(){}'.includes(c)) res += `\\${c}`;
    else if (c === '[') {
      const end = pattern.indexOf(']', i + (pattern[i + 1] === ']' ? 2 : pattern[i + 1] === '^' && pattern[i + 2] === ']' ? 3 : 1));
      if (end < 0) return pattern.slice(0, i) + '[';
      res += pattern.slice(i, end + 1);
      i = end;
    } else res += c;
  }
  return res;
}
