// Line endings: a text written on Windows ends its lines with CR LF (\r\n),
// one on Linux with LF (\n) alone. dos2unix and unix2dos convert a file in
// place, tr deletes or translates characters (tr -d '\r'), and the
// gitattributes(5) page explains how git keeps a repository's scripts in LF.
// After dos2unix(1) (https://waterlan.home.xs4all.nl/dos2unix/dos2unix.htm),
// GNU tr (https://www.gnu.org/software/coreutils/manual/html_node/tr-invocation.html)
// and https://git-scm.com/docs/gitattributes.
// Differences (docs/SCENARIOS.md): dos2unix knows no code pages (-iso,
// -c) nor BOM options; tr's sets know escapes, ranges and four classes.

import type { Shell } from '../shell';
import type { Command } from './index';
import { content } from '../tools';
import { systemd } from '../systemd';

/** dos2unix -i: the counts of DOS, Unix and Mac line breaks. */
function counts(text: string): [number, number, number] {
  const dos = (text.match(/\r\n/g) ?? []).length;
  const unix = (text.match(/(?<!\r)\n/g) ?? []).length;
  const mac = (text.match(/\r(?!\n)/g) ?? []).length;
  return [dos, unix, mac];
}

function convert(game: Shell, args: string[], input: string | null, to: 'unix' | 'dos'): string {
  const me = to === 'unix' ? 'dos2unix' : 'unix2dos';
  const change = (t: string) => (to === 'unix' ? t.replace(/\r\n/g, '\n') : t.replace(/\r?\n/g, '\r\n'));
  let quiet = false;
  let info = false;
  let pairs = false;
  const files: string[] = [];
  for (const a of args) {
    if (a === '-q' || a === '--quiet') quiet = true;
    else if (a === '-i' || a === '--info') info = true;
    else if (a === '-n' || a === '--newfile') pairs = true;
    else if (a === '-k' || a === '--keepdate' || a === '-o' || a === '--oldfile') continue;
    else if (a === '-h' || a === '--help') return game.t(`${me}-usage`);
    else if (a.startsWith('-') && a !== '-') return game.error(`${me}: option '${a}' unknown.\n${game.t(`${me}-usage`)}`, 1);
    else files.push(a);
  }
  // No file: a filter, from the pipe to the output.
  if (!files.length) return change(input ?? '');
  const messages: string[] = [];
  const out: string[] = [];
  const read = (f: string): string | null => {
    const n = game.find(f);
    if (!n) {
      game.error(`${me}: ${f}: No such file or directory`, 2);
      return null;
    }
    if (n.type !== 'file') {
      game.error(`${me}: Skipping ${f}, not a regular file.`, 1);
      return null;
    }
    if (n.charset === 'binary' || /\u0000/.test(content(n, game))) {
      game.error(`${me}: Binary symbol 0x00 found at line 1\n${me}: Skipping binary file ${f}`, 1);
      return null;
    }
    if (!game.can(n, 'r')) {
      game.error(`${me}: Failed to open input file ${f}: Permission denied`, 13);
      return null;
    }
    return content(n, game);
  };
  if (info) {
    for (const f of files) {
      const text = read(f);
      if (text === null) continue;
      const [dos, unix, mac] = counts(text);
      out.push(`${String(dos).padStart(8)}${String(unix).padStart(8)}${String(mac).padStart(8)}  no_bom    text    ${f}`);
    }
    return out.join('\n');
  }
  const write = (target: string, text: string, from?: string): void => {
    const n = game.find(target);
    if (n?.type === 'file') {
      if (!game.can(n, 'w') || game.onlyRead(target)) {
        game.error(`${me}: Failed to write to temporary output file ${target.replace(/[^/]*$/, '')}d2utmpAb12Cd: Permission denied\n${me}: problems converting file ${target}`, 13);
        return;
      }
      n.content = text;
      n.lines = true;
      delete n.size;
      n.mtime = systemd(game)?.clock ?? n.mtime;
    } else {
      const refused = game.place(me, target, { type: 'file', content: text, owner: game.who, lines: true });
      if (refused) return void game.error(refused, 1);
    }
    if (!quiet) messages.push(from ? `${me}: converting file ${from} to file ${target} in ${to === 'unix' ? 'Unix' : 'DOS'} format...` : `${me}: converting file ${target} to ${to === 'unix' ? 'Unix' : 'DOS'} format...`);
  };
  if (pairs) {
    for (let i = 0; i + 1 < files.length; i += 2) {
      const text = read(files[i]);
      if (text !== null) write(files[i + 1], change(text), files[i]);
    }
  } else
    for (const f of files) {
      const text = read(f);
      if (text !== null) write(f, change(text));
    }
  // (dos2unix writes them on stderr: the game shows them like its output, without counting an error.)
  return messages.join('\n');
}

// ——— tr ———

const CLASSES: Record<string, string> = {
  upper: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
  lower: 'abcdefghijklmnopqrstuvwxyz',
  digit: '0123456789',
  space: ' \t\n\r\v\f',
};

/** A tr set: escapes (\r, \n, \t, \\, \NNN), ranges (a-z) and classes ([:upper:]). */
function expandSet(set: string): string {
  let out = '';
  const chars: string[] = [];
  for (let i = 0; i < set.length; i++) {
    const cls = /^\[:(\w+):\]/.exec(set.slice(i));
    if (cls && CLASSES[cls[1]]) {
      chars.push(...CLASSES[cls[1]]);
      i += cls[0].length - 1;
      continue;
    }
    if (set[i] === '\\' && i + 1 < set.length) {
      const oct = /^\\([0-7]{1,3})/.exec(set.slice(i));
      if (oct) {
        chars.push(String.fromCharCode(parseInt(oct[1], 8)));
        i += oct[0].length - 1;
        continue;
      }
      const e = set[++i];
      chars.push({ n: '\n', r: '\r', t: '\t', v: '\v', f: '\f', a: '\x07', b: '\b', '\\': '\\' }[e] ?? e);
      continue;
    }
    chars.push(set[i]);
  }
  for (let i = 0; i < chars.length; i++) {
    if (chars[i + 1] === '-' && i + 2 < chars.length) {
      const [a, b] = [chars[i].charCodeAt(0), chars[i + 2].charCodeAt(0)];
      for (let c = a; c <= b; c++) out += String.fromCharCode(c);
      i += 2;
    } else out += chars[i];
  }
  return out;
}

function tr(game: Shell, args: string[], input: string | null): string {
  const flags = new Set<string>();
  const sets: string[] = [];
  for (const a of args) {
    if (/^-[dsc]+$/.test(a)) for (const l of a.slice(1)) flags.add(l);
    else if (a === '--delete') flags.add('d');
    else if (a === '--squeeze-repeats') flags.add('s');
    else if (a.startsWith('-') && a.length > 1) return game.error(`tr: invalid option -- '${a.replace(/^-+/, '')[0]}'\nTry 'tr --help' for more information.`, 1);
    else sets.push(a);
  }
  const delete_ = flags.has('d');
  const squeeze = flags.has('s');
  if (!sets.length) return game.error("tr: missing operand\nTry 'tr --help' for more information.", 1);
  if (delete_ && !squeeze && sets.length > 1)
    return game.error(`tr: extra operand '${sets[1]}'\nOnly one string may be given when deleting without squeezing repeated characters.\nTry 'tr --help' for more information.`, 1);
  if (!delete_ && !squeeze && sets.length < 2) return game.error(`tr: missing operand after '${sets[0]}'\nTwo strings must be given when translating.\nTry 'tr --help' for more information.`, 1);
  if (sets.length > 2) return game.error(`tr: extra operand '${sets[2]}'\nTry 'tr --help' for more information.`, 1);
  let text = input ?? '';
  const one = expandSet(sets[0]);
  if (delete_) text = [...text].filter((c) => !one.includes(c)).join('');
  else if (sets[1] !== undefined) {
    const two = expandSet(sets[1]);
    text = [...text].map((c) => (one.includes(c) ? (two[one.indexOf(c)] ?? two.at(-1) ?? '') : c)).join('');
  }
  if (squeeze) {
    const last = expandSet(sets.at(-1)!);
    text = [...text].filter((c, i, all) => !(i > 0 && c === all[i - 1] && last.includes(c))).join('');
  }
  return text;
}

export const LINE_ENDINGS: Record<string, Command> = {
  dos2unix: { ownOptions: true, launch: ({ args, input, game }) => convert(game, args, input, 'unix') },
  unix2dos: { ownOptions: true, launch: ({ args, input, game }) => convert(game, args, input, 'dos') },
  tr: { ownOptions: true, launch: ({ args, input, game }) => tr(game, args, input) },
  // Manual page only (git's attributes file).
  gitattributes: { section: 5, launch: () => '' },
};
