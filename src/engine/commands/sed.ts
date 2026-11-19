// sed and stat, in two flavours: GNU's on the Linux machines, BSD's on a
// FreeBSD machine (see ../freebsd.ts). The differences that break a script
// copied from one to the other are the point:
//   - sed -i: GNU takes an optional suffix glued to the option (-i, -i.bak);
//     BSD requires one, as the next word (-i '' for none). On BSD,
//     `sed -i 's/a/b/' file` takes 's/a/b/' as the suffix and `file` as the
//     script: "sed: 1: "file": invalid command code f".
//   - stat: GNU's -c FORMAT (%s, %n, %U…); BSD's -f FORMAT (%z, %N, %Su…).
//     GNU's -f means "file system status"; BSD has no -c.
// Sources: GNU sed (https://www.gnu.org/software/sed/manual/sed.html),
// FreeBSD sed(1) and stat(1) (https://man.freebsd.org/), GNU coreutils stat.
// Simplifications: sed's commands s (flags g, p, I, N), d, p and q, with an
// address (a line number, $, /regex/) or a range (addr1,addr2, addr1,+N) and !;
// stat's common format sequences.

import type { Shell } from '../shell';
import type { Command, Context } from './index';
import type { File, Node } from '../world';
import { isBsd } from '../freebsd';
import { toBasicRegex } from './text';
import { content, sizeFor } from '../tools';

// ——— sed ———

type SedAddress = { line?: number; last?: boolean; re?: RegExp; plus?: number };
interface SedCommand {
  address: SedAddress | null;
  // A range addr1,addr2 (addr2 may be +N): `active` while inside it.
  end?: SedAddress;
  active?: boolean;
  until?: number;
  not: boolean;
  name: 's' | 'd' | 'p' | 'q';
  re?: RegExp;
  replacement?: string;
  global?: boolean;
  print?: boolean;
  nth?: number;
}

class SedError extends Error {}

/** Parses a sed script; errors are worded like the flavour's sed. */
function parseScript(script: string, extended: boolean, bsd: boolean): SedCommand[] {
  const cmds: SedCommand[] = [];
  const fail = (gnu: string, bsdText: string) => {
    throw new SedError(bsd ? `sed: 1: "${script}": ${bsdText}` : `sed: -e expression #1, char ${Math.max(1, i)}: ${gnu}`);
  };
  const regex = (source: string, flags = '') => {
    try {
      return new RegExp(extended ? source : toBasicRegex(source), flags);
    } catch {
      return fail('Invalid preceding regular expression', 'RE error: invalid regular expression');
    }
  };
  // Reads up to the delimiter (a backslash escapes it).
  const until = (d: string): string | null => {
    let out = '';
    while (i < script.length) {
      const c = script[i];
      if (c === '\\' && script[i + 1] === d) {
        out += d;
        i += 2;
        continue;
      }
      if (c === '\\' && i + 1 < script.length) {
        out += c + script[i + 1];
        i += 2;
        continue;
      }
      if (c === d) {
        i++;
        return out;
      }
      out += c;
      i++;
    }
    return null;
  };
  let i = 0;
  while (i < script.length) {
    while (i < script.length && /[\s;]/.test(script[i])) i++;
    if (i >= script.length) break;
    const readAddress = (second: boolean): SedAddress | null => {
      if (second && script[i] === '+' && /\d/.test(script[i + 1] ?? '')) {
        const m = /^\+(\d+)/.exec(script.slice(i))!;
        i += m[0].length;
        return { plus: Number(m[1]) };
      }
      if (/\d/.test(script[i])) {
        const m = /^\d+/.exec(script.slice(i))!;
        i += m[0].length;
        return { line: Number(m[0]) };
      }
      if (script[i] === '$') {
        i++;
        return { last: true };
      }
      if (script[i] === '/') {
        i++;
        const r = until('/');
        if (r === null) fail('unterminated address regex', 'unterminated regular expression');
        return { re: regex(r!) };
      }
      return null;
    };
    const address: SedCommand['address'] = readAddress(false);
    let end: SedAddress | undefined;
    if (address && script[i] === ',') {
      i++;
      end = readAddress(true) ?? fail('unexpected `,\'', 'expected context address');
    }
    let not = false;
    while (script[i] === ' ') i++;
    if (script[i] === '!') {
      not = true;
      i++;
    }
    const name = script[i];
    i++;
    if (name === 's') {
      const d = script[i];
      if (!d || d === '\\' || d === '\n') fail("unterminated `s' command", 'unterminated substitute pattern');
      i++;
      const pattern = until(d);
      if (pattern === null) fail("unterminated `s' command", 'unterminated substitute pattern');
      const replacement = until(d);
      if (replacement === null) fail("unterminated `s' command", 'unterminated substitute in regular expression');
      let global = false;
      let print = false;
      let insensitive = false;
      let nth = 1;
      while (i < script.length && /[gpI0-9]/.test(script[i])) {
        const f = script[i++];
        if (f === 'g') global = true;
        else if (f === 'p') print = true;
        else if (f === 'I') insensitive = true;
        else nth = Number(f);
      }
      if (i < script.length && !/[\s;}]/.test(script[i])) fail(`unknown option to \`s'`, `bad flag in substitute command: '${script[i]}'`);
      cmds.push({ address, end, not, name: 's', re: regex(pattern!, insensitive ? 'gi' : 'g'), replacement: replacement!, global, print, nth });
    } else if (name === 'd' || name === 'p' || name === 'q') cmds.push({ address, end, not, name });
    else if (name === 'b' || name === 't') {
      // A branch: to a label (":label"), which the game's scripts never define.
      const label = /^\s*([^;\n]*)/.exec(script.slice(i))![1].trim();
      i += label.length;
      if (label) fail(`can't find label for jump to \`${label}'`, `undefined label "${label}"`);
    } else fail(`unknown command: \`${name}'`, `invalid command code ${name}`);
  }
  return cmds;
}

/** The replacement, with & and \1…\9. */
const replace = (rep: string, m: RegExpExecArray) =>
  rep.replace(/\\([0-9&n\\])|&/g, (all, k: string | undefined) => {
    if (all === '&') return m[0];
    if (k === 'n') return '\n';
    if (k === '\\') return '\\';
    if (k === '&') return '&';
    return m[Number(k)] ?? '';
  });

function run(cmds: SedCommand[], text: string, quiet: boolean): string {
  const lines = text === '' ? [] : text.split('\n');
  const out: string[] = [];
  for (let n = 0; n < lines.length; n++) {
    let line = lines[n];
    let deleted = false;
    let stop = false;
    const matches = (a: SedAddress) => {
      const r = a.line !== undefined ? a.line === n + 1 : a.last ? n === lines.length - 1 : a.re!.test(line);
      if (a.re) a.re.lastIndex = 0;
      return r;
    };
    for (const c of cmds) {
      const a = c.address;
      let hit: boolean;
      if (!a) hit = true;
      else if (!c.end) hit = matches(a);
      else if (c.active) {
        // Inside a range: this line is in it; the range ends on addr2 (a line number already passed ends it at once).
        hit = true;
        const e = c.end;
        if (e.plus !== undefined ? n + 1 >= c.until! : e.line !== undefined ? n + 1 >= e.line : matches(e)) c.active = false;
      } else if (matches(a)) {
        hit = true;
        const e = c.end;
        c.until = e.plus !== undefined ? n + 1 + e.plus : undefined;
        // GNU: addr2 is only looked for from the next line; a line number at or before this one ends the range here.
        c.active = e.plus !== undefined ? e.plus > 0 : e.line !== undefined ? e.line > n + 1 : e.last ? n !== lines.length - 1 : true;
      } else hit = false;
      if (c.not) hit = !hit;
      if (!hit) continue;
      if (c.name === 'd') {
        deleted = true;
        break;
      }
      if (c.name === 'p') out.push(line);
      if (c.name === 'q') {
        stop = true;
        break;
      }
      if (c.name === 's') {
        const re = c.re!;
        re.lastIndex = 0;
        let count = 0;
        let changed = false;
        line = line.replace(re, (...all) => {
          count++;
          const groups = all.slice(0, -2) as string[];
          const m = Object.assign([...groups], { index: 0, input: line }) as unknown as RegExpExecArray;
          if (c.global ? count >= c.nth! : count === c.nth) {
            changed = true;
            return replace(c.replacement!, m);
          }
          return groups[0];
        });
        if (changed && c.print) out.push(line);
      }
    }
    if (!deleted && !quiet) out.push(line);
    if (stop) break;
  }
  return out.join('\n');
}

const SED_USAGE_BSD = 'usage: sed script [-Ealnru] [-i extension] [file ...]\n\tsed [-Ealnu] [-i extension] [-e script] ... [-f script_file] ... [file ...]';

function sed({ args, input, game }: Context): string {
  const bsd = isBsd(game);
  let quiet = false;
  let extended = false;
  let inPlace: string | null = null;
  const scripts: string[] = [];
  const rest: string[] = [];
  for (let k = 0; k < args.length; k++) {
    const a = args[k];
    if (a === '--') {
      rest.push(...args.slice(k + 1));
      break;
    }
    if (!a.startsWith('-') || a === '-') {
      rest.push(a);
      continue;
    }
    if (a === '--quiet' || a === '--silent') quiet = true;
    else if (a === '--regexp-extended') extended = true;
    else if (a.startsWith('--in-place')) {
      if (bsd) return game.error(`sed: illegal option -- -\n${SED_USAGE_BSD}`, 1);
      inPlace = a.includes('=') ? a.slice(a.indexOf('=') + 1) : '';
    } else if (a === '--expression') scripts.push(args[++k] ?? '');
    else if (a === '--help') {
      if (bsd) return game.error(`sed: illegal option -- -\n${SED_USAGE_BSD}`, 1);
      return '';
    } else {
      // Grouped short options: -ne, -Ei…
      for (let j = 1; j < a.length; j++) {
        const o = a[j];
        if (o === 'n') quiet = true;
        else if (o === 'E' || o === 'r') extended = true;
        else if (o === 'e') {
          const glued = a.slice(j + 1);
          scripts.push(glued || (args[++k] ?? ''));
          break;
        } else if (o === 'i') {
          const glued = a.slice(j + 1);
          // GNU: the suffix is glued or absent. BSD: glued, or the NEXT word (even '').
          if (glued) inPlace = glued;
          else if (bsd) {
            if (k + 1 >= args.length) return game.error(`sed: option requires an argument -- i\n${SED_USAGE_BSD}`, 1);
            inPlace = args[++k];
          } else inPlace = '';
          break;
        } else if (bsd) return game.error(`sed: illegal option -- ${o}\n${SED_USAGE_BSD}`, 1);
        else return game.error(`sed: invalid option -- '${o}'\nUsage: sed [OPTION]... {script-only-if-no-other-script} [input-file]...\n\nTry 'sed --help' for more information.`, 1);
      }
    }
  }
  if (!scripts.length) {
    if (!rest.length) return game.error(bsd ? SED_USAGE_BSD : 'Usage: sed [OPTION]... {script-only-if-no-other-script} [input-file]...\n\nTry \'sed --help\' for more information.', 1);
    scripts.push(rest.shift()!);
  }
  let cmds: SedCommand[];
  try {
    cmds = parseScript(scripts.join('\n'), extended, bsd);
  } catch (e) {
    if (e instanceof SedError) return game.error(e.message, 1);
    throw e;
  }
  if (inPlace !== null) {
    if (!rest.length) return game.error(bsd ? SED_USAGE_BSD : 'sed: no input files', bsd ? 1 : 4);
    for (const file of rest) {
      const n = game.find(file);
      if (!n) {
        game.error(bsd ? `sed: ${file}: No such file or directory` : `sed: can't read ${file}: No such file or directory`, bsd ? 1 : 2);
        continue;
      }
      if (n.type !== 'file') {
        game.error(bsd ? `sed: ${file}: in-place editing only works for regular files` : `sed: couldn't edit ${file}: not a regular file`, 4);
        continue;
      }
      if (!game.can(n, 'r') || !game.can(n, 'w')) {
        game.error(`sed: couldn't open temporary file ${file.replace(/[^/]*$/, '')}sed${bsd ? 'XXXXXX' : 'Ab12Cd'}: Permission denied`, 4);
        continue;
      }
      const before = content(n, game);
      if (inPlace) game.place('sed', `${file}${inPlace}`, { ...n, content: before } as File);
      n.content = run(cmds, before, quiet);
      n.lines = true;
      delete n.size;
    }
    return '';
  }
  if (!rest.length) {
    if (input === null) return game.error(bsd ? SED_USAGE_BSD : 'Usage: sed [OPTION]... {script-only-if-no-other-script} [input-file]...', 1);
    return run(cmds, input, quiet);
  }
  const outputs: string[] = [];
  for (const file of rest) {
    const text = game.read(file);
    if (text === null) {
      game.error(bsd ? `sed: ${file}: No such file or directory` : `sed: can't read ${file}: No such file or directory`, bsd ? 1 : 2);
      continue;
    }
    outputs.push(run(cmds, text, quiet));
  }
  return outputs.filter((o) => o !== '').join('\n');
}

// ——— stat ———

const OCTAL: Record<string, number> = { r: 4, w: 2, x: 1 };
const modeOf = (n: Node) => n.mode ?? (n.type === 'directory' ? 'rwxr-xr-x' : 'rw-r--r--');
const octal = (mode: string) => [0, 3, 6].map((k) => [...mode.slice(k, k + 3)].reduce((t, c) => t + (OCTAL[c] ?? 0), 0)).join('');
const symbolic = (n: Node) => `${n.type === 'directory' ? 'd' : '-'}${modeOf(n)}`;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const pad = (x: number) => String(x).padStart(2, '0');
const isoTime = (ms: number) => {
  const d = new Date(ms);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}.000000000 +0000`;
};
const bsdTime = (ms: number) => {
  const d = new Date(ms);
  return `${MONTHS[d.getUTCMonth()]} ${String(d.getUTCDate()).padStart(2)} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())} ${d.getUTCFullYear()}`;
};

function stat({ args, game }: Context): string {
  const bsd = isBsd(game);
  let format: string | null = null;
  const files: string[] = [];
  for (let k = 0; k < args.length; k++) {
    const a = args[k];
    if (bsd ? a === '-f' : a === '-c' || a === '--format' || a === '--printf') format = args[++k] ?? '';
    else if (!bsd && a.startsWith('--format=')) format = a.slice(9);
    else if (!bsd && a === '-f') return statFs(game, args.slice(k + 1).filter((x) => !x.startsWith('-')));
    else if (a.startsWith('-') && a !== '-') {
      if (bsd) return game.error(`stat: illegal option -- ${a.replace(/^-+/, '').charAt(0)}\nusage: stat [-FLnq] [-f format | -l | -r | -s | -x] [-t timefmt] [file|handle ...]`, 1);
      return game.error(`stat: invalid option -- '${a.replace(/^-+/, '').charAt(0)}'\nTry 'stat --help' for more information.`, 1);
    } else files.push(a);
  }
  if (!files.length) return game.error(bsd ? 'usage: stat [-FLnq] [-f format | -l | -r | -s | -x] [-t timefmt] [file|handle ...]' : "stat: missing operand\nTry 'stat --help' for more information.", 1);
  const out: string[] = [];
  for (const f of files) {
    const n = game.find(f);
    if (!n) {
      game.error(bsd ? `stat: ${f}: stat: No such file or directory` : `stat: cannot statx '${f}': No such file or directory`, 1);
      continue;
    }
    const size = n.type === 'file' ? sizeFor(n, game) : 4096;
    const owner = n.owner ?? game.who;
    const group = n.group ?? owner;
    const mtime = (n.type === 'file' ? n.mtime : undefined) ?? Date.UTC(2029, 0, 1);
    const values: Record<string, string> = bsd
      ? { z: String(size), N: f, n: '\n', Su: owner, Sg: group, Lp: octal(modeOf(n)), Sp: symbolic(n), m: String(Math.floor(mtime / 1000)), Sm: bsdTime(mtime), '%': '%' }
      : { s: String(size), n: f, U: owner, G: group, a: octal(modeOf(n)), A: symbolic(n), Y: String(Math.floor(mtime / 1000)), y: isoTime(mtime), F: n.type === 'directory' ? 'directory' : 'regular file', '%': '%' };
    if (format !== null) {
      const keys = Object.keys(values).sort((a, b) => b.length - a.length);
      let line = '';
      for (let i = 0; i < format.length; i++) {
        if (format[i] === '%' && i + 1 < format.length) {
          const key = keys.find((x) => format!.startsWith(x, i + 1));
          if (key) {
            line += values[key];
            i += key.length;
            continue;
          }
          // An unknown sequence: GNU prints it as is, BSD refuses the format.
          if (bsd) return game.error(`stat: '${format[i + 1]}': bad format`, 1);
        }
        line += format[i];
      }
      out.push(line);
    } else if (bsd) out.push(`92 ${1000 + f.length} ${symbolic(n)} 1 ${owner} ${group} 0 ${size} "${bsdTime(mtime)}" "${bsdTime(mtime)}" "${bsdTime(mtime)}" "${bsdTime(mtime)}" 4096 8 0 ${f}`);
    else
      out.push(
        [
          `  File: ${f}`,
          `  Size: ${size}\tBlocks: 8          IO Block: 4096   ${values.F}`,
          `Access: (0${values.a}/${values.A})  Uid: ( ----/${owner.padStart(8)})   Gid: ( ----/${group.padStart(8)})`,
          `Modify: ${values.y}`,
        ].join('\n'),
      );
  }
  return out.join('\n');
}

// GNU stat -f: the file system's status (rarely what a BSD habit meant).
function statFs(game: Shell, files: string[]): string {
  const out: string[] = [];
  for (const f of files) {
    if (!game.find(f)) {
      game.error(`stat: cannot read file system information for '${f}': No such file or directory`, 1);
      continue;
    }
    out.push(`  File: "${f}"\n    ID: 3f1c2a9b8e7d6c5a Namelen: 255     Type: ext2/ext3\nBlock size: 4096       Fundamental block size: 4096\nBlocks: Total: 7666388    Free: 5114231    Available: 4721015`);
  }
  return out.join('\n');
}

export const SED: Record<string, Command> = {
  sed: { ownOptions: true, launch: sed },
  stat: { ownOptions: true, launch: stat },
};
