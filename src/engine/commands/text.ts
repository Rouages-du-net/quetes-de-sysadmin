// Text commands: they read files, or what comes through a pipe when they
// are given no file. That is Unix's strength: small tools that do one
// thing, and that are chained together.

import { options, wildcard, compareNames } from '../tools';
import { colourise, readColour, invalidColourMessage, sgr } from '../colours';
import type { Command, Context } from './index';
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

// -n 5, -n5 or -5 → 5.
function count(args: string[], fallback: number): { n: number; rest: string[] } {
  const rest: string[] = [];
  let n = fallback;
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '-n') n = Number(args[++i]);
    else if (/^-n\d+$/.test(a)) n = Number(a.slice(2));
    else if (/^-\d+$/.test(a)) n = Number(a.slice(1));
    else rest.push(a);
  }
  return { n: Number.isFinite(n) ? n : fallback, rest };
}

function head(cmd: 'head' | 'tail') {
  return (c: Context) => {
    const { n, rest } = count(c.args, 10);
    const ts = texts(cmd, c, rest);
    return ts
      .map(({ name, text }) => {
        const l = linesFor(text);
        const part = cmd === 'head' ? l.slice(0, n) : l.slice(Math.max(0, l.length - n));
        return (ts.length > 1 ? `==> ${name} <==\n` : '') + part.join('\n');
      })
      .join('\n\n');
  };
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

  sort: {
    launch: (c) => {
      const { letters, rest } = options(c.args);
      const lines = texts('sort', c, rest).flatMap((t) => linesFor(t.text));
      const num = (l: string) => parseFloat(l.trim()) || 0;
      lines.sort(letters.has('n') ? (a, b) => num(a) - num(b) || a.localeCompare(b, 'fr') : (a, b) => a.localeCompare(b, 'fr'));
      if (letters.has('r')) lines.reverse();
      return lines.join('\n');
    },
  },

  uniq: {
    launch: (c) => {
      const { letters, rest } = options(c.args);
      const groups: { line: string; n: number }[] = [];
      for (const l of texts('uniq', c, rest).flatMap((t) => linesFor(t.text))) {
        const last = groups.at(-1);
        if (last && last.line === l) last.n++;
        else groups.push({ line: l, n: 1 });
      }
      return groups.map((g) => (letters.has('c') ? `${String(g.n).padStart(7)} ${g.line}` : g.line)).join('\n');
    },
  },

  cut: {
    launch: (c) => {
      let sep = '\t';
      let fields: number[] = [];
      const files: string[] = [];
      for (let i = 0; i < c.args.length; i++) {
        const a = c.args[i];
        if (a === '-d') sep = c.args[++i] ?? sep;
        else if (a.startsWith('-d')) sep = a.slice(2);
        else if (a === '-f') fields = (c.args[++i] ?? '').split(',').map(Number);
        else if (a.startsWith('-f')) fields = a.slice(2).split(',').map(Number);
        else files.push(a);
      }
      if (!fields.length || fields.some((n) => !n)) return c.game.error(c.game.t('cut-fields'));
      if (sep.length !== 1) return c.game.error(c.game.t('cut-separator'));
      return texts('cut', c, files)
        .flatMap((t) => linesFor(t.text))
        .map((l) => {
          const parts = l.split(sep);
          return parts.length === 1 ? l : fields.map((n) => parts[n - 1]).filter((p) => p !== undefined).join(sep);
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
