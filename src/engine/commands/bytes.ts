// Looking at bytes rather than text: od (GNU coreutils), xxd (vim's),
// hexdump (util-linux), and dd (GNU coreutils), which copies by blocks and
// can translate between ASCII and EBCDIC.
// After https://www.gnu.org/software/coreutils/manual/html_node/od-invocation.html,
// https://www.gnu.org/software/coreutils/manual/html_node/dd-invocation.html,
// https://man7.org/linux/man-pages/man1/hexdump.1.html and xxd(1)
// (https://manpages.debian.org/bookworm/xxd/xxd.1.en.html).
// A text file of the game ends with a newline, as on disk; a binary file
// (File.charset = 'binary', see ../ebcdic.ts) is read byte for byte.
// Differences: od knows the types c, x, o, u, d (1, 2 or 4 bytes) and
// -A, -N, -j, -v, -w is not there; xxd has no -r (revert) nor -b; hexdump
// knows its default format and -C, without -e formats; dd copies files
// (if=, of=, or the pipe), with bs, ibs, obs, cbs, count, skip and
// conv=ascii, ebcdic, block, unblock, lcase, ucase, notrunc; its timing is
// always the same.

import type { Command } from './index';
import { hex as hexOf } from './restic';
import type { Shell } from '../shell';
import { bytesOf, byteString, isBinary, DD_ASCII, DD_EBCDIC } from '../ebcdic';
import { systemd } from '../systemd';

/** The bytes a tool reads: a file's (with its final newline if it is text), or the pipe's. */
function readBytes(game: Shell, cmd: string, file: string | undefined, input: string | null): number[] | null {
  if (file !== undefined && file !== '-') {
    const n = game.find(file);
    const text = game.readFor(cmd, file);
    if (text === null) return null;
    if (n?.type === 'file' && n.charset === 'binary') return bytesOf(text);
    return text ? [...new TextEncoder().encode(text), 0x0a] : [];
  }
  if (input === null) {
    game.error(game.t('text-without-input', { command: cmd }));
    return null;
  }
  if (game.outputCharset === 'binary') return bytesOf(input);
  return input ? [...new TextEncoder().encode(input), 0x0a] : [];
}

/** "512", "1K", "2k", "1M", "0x10": a size as od, dd and xxd read it; null if unreadable. */
function size(text: string): number | null {
  const m = /^(0x[0-9a-fA-F]+|\d+)([kKMG]|kB|KB|MB)?$/.exec(text);
  if (!m) return null;
  const units: Record<string, number> = { '': 1, k: 1024, K: 1024, kB: 1000, KB: 1000, M: 1048576, MB: 1_000_000, G: 1073741824 };
  return Number(m[1]) * units[m[2] ?? ''];
}

const hex = (n: number, width: number) => n.toString(16).padStart(width, '0');
const printable = (b: number) => (b >= 0x20 && b <= 0x7e ? String.fromCharCode(b) : '.');

// ——— od ———

interface OdType {
  kind: 'c' | 'x' | 'o' | 'u' | 'd';
  bytes: number;
}
const OD_WIDTH: Record<string, number> = { c1: 4, x1: 3, o1: 4, u1: 4, d1: 5, x2: 5, o2: 7, u2: 6, d2: 7, x4: 9, o4: 12, u4: 11, d4: 12 };
const ESCAPES: Record<number, string> = { 0: '\\0', 7: '\\a', 8: '\\b', 9: '\\t', 10: '\\n', 11: '\\v', 12: '\\f', 13: '\\r' };

function odField(t: OdType, b: number[]): string {
  if (t.kind === 'c') return ESCAPES[b[0]] ?? (b[0] >= 0x20 && b[0] <= 0x7e ? String.fromCharCode(b[0]) : b[0].toString(8).padStart(3, '0'));
  // Little-endian, like the PC od runs on.
  let v = b.reduce((acc, x, i) => acc + x * 2 ** (8 * i), 0);
  if (t.kind === 'd' && v >= 2 ** (8 * t.bytes - 1)) v -= 2 ** (8 * t.bytes);
  const digits = { x: 2 * t.bytes, o: Math.ceil((8 * t.bytes) / 3) }[t.kind as 'x' | 'o'];
  if (t.kind === 'x') return v.toString(16).padStart(digits, '0');
  if (t.kind === 'o') return v.toString(8).padStart(digits, '0');
  return String(v);
}

function odType(text: string): OdType[] | null {
  const r: OdType[] = [];
  let i = 0;
  while (i < text.length) {
    const c = text[i++];
    if (c === 'c') {
      r.push({ kind: 'c', bytes: 1 });
      continue;
    }
    if (!'xoud'.includes(c)) return null;
    let bytes = 4;
    if (/[124]/.test(text[i] ?? '')) bytes = Number(text[i++]);
    else if (/\d/.test(text[i] ?? '')) return null;
    r.push({ kind: c as OdType['kind'], bytes });
  }
  return r.length ? r : null;
}

function od(game: Shell, args: string[], input: string | null): string {
  let radix = 'o';
  const types: OdType[] = [];
  let limit = Infinity;
  let skip = 0;
  let all = false;
  const files: string[] = [];
  const invalid = (letter: string) => game.error(`od: invalid option -- '${letter}'\nTry 'od --help' for more information.`, 1);
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    const value = () => (a.length > 2 ? a.slice(2) : args[++i]) ?? '';
    if (a === '-' || !a.startsWith('-')) files.push(a);
    else if (a.startsWith('-A')) {
      radix = value();
      if (!['o', 'd', 'x', 'n'].includes(radix)) return game.error(`od: invalid output address radix '${radix}'; it must be one character from [doxn]`, 1);
    } else if (a.startsWith('-t')) {
      const text = value();
      const t = odType(text);
      if (!t) return game.error(`od: invalid type string '${text}'`, 1);
      types.push(...t);
    } else if (a.startsWith('-N') || a.startsWith('-j')) {
      const text = value();
      const v = size(text);
      if (v === null) return game.error(`od: invalid -${a[1]} argument '${text}'`, 1);
      if (a[1] === 'N') limit = v;
      else skip = v;
    } else
      for (const l of a.slice(1)) {
        if (l === 'c') types.push({ kind: 'c', bytes: 1 });
        else if (l === 'b') types.push({ kind: 'o', bytes: 1 });
        else if (l === 'x') types.push({ kind: 'x', bytes: 2 });
        else if (l === 'o') types.push({ kind: 'o', bytes: 2 });
        else if (l === 'd') types.push({ kind: 'u', bytes: 2 });
        else if (l === 'v') all = true;
        else return invalid(l);
      }
  }
  if (!types.length) types.push({ kind: 'o', bytes: 2 });
  const read = readBytes(game, 'od', files[0], input);
  if (read === null) return '';
  const data = read.slice(skip, skip + limit);
  // Every field padded to the same width per byte, so the lines of several types line up.
  const perByte = Math.max(...types.map((t) => OD_WIDTH[`${t.kind}${t.bytes}`] / t.bytes));
  const address = (n: number) => (radix === 'n' ? '' : radix === 'x' ? hex(n, 6) : radix === 'd' ? String(n).padStart(7, '0') : n.toString(8).padStart(7, '0'));
  const indent = radix === 'n' ? '' : ' '.repeat(radix === 'x' ? 6 : 7);
  const out: string[] = [];
  let previous: string | null = null;
  let starred = false;
  for (let i = 0; i < data.length; i += 16) {
    const chunk = data.slice(i, i + 16);
    const key = chunk.join(',');
    if (!all && chunk.length === 16 && key === previous) {
      if (!starred) out.push('*');
      starred = true;
      continue;
    }
    previous = chunk.length === 16 ? key : null;
    starred = false;
    types.forEach((t, k) => {
      let line = '';
      for (let j = 0; j < chunk.length; j += t.bytes) {
        const piece = chunk.slice(j, j + t.bytes);
        while (piece.length < t.bytes) piece.push(0);
        line += odField(t, piece).padStart(perByte * t.bytes);
      }
      out.push((k === 0 ? address(skip + i) : indent) + line);
    });
  }
  if (radix !== 'n') out.push(address(skip + data.length));
  return out.join('\n');
}

// ——— xxd ———

function xxd(game: Shell, args: string[], input: string | null): string {
  let seek = 0;
  let length = Infinity;
  let columns: number | null = null;
  let group: number | null = null;
  let plain = false;
  let upper = false;
  const files: string[] = [];
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    const value = () => {
      const text = /^-[a-z]+$/.test(a) ? args[++i] : a.replace(/^-[a-z]+/, '');
      const v = size((text ?? '').replace(/^\+/, ''));
      return v;
    };
    if (a === '-' || !a.startsWith('-')) files.push(a);
    else if (/^-(s|seek)/.test(a)) seek = value() ?? 0;
    else if (/^-(l|len)/.test(a)) length = value() ?? Infinity;
    else if (/^-(c|cols)/.test(a)) columns = value();
    else if (/^-(g|groupsize)/.test(a)) group = value();
    else if (/^-(p|ps|postscript|plain)$/.test(a)) plain = true;
    else if (a === '-u') upper = true;
    else if (a === '-v' || a === '-version') return 'xxd 2022-01-14 by Juergen Weigert et al.';
    else return game.error(XXD_USAGE, 1);
  }
  const read = readBytes(game, 'xxd', files[0], input);
  if (read === null) return '';
  const data = read.slice(seek, seek + length);
  const h = (b: number) => (upper ? hex(b, 2).toUpperCase() : hex(b, 2));
  if (plain) {
    const c = columns || 30;
    const out: string[] = [];
    for (let i = 0; i < data.length; i += c) out.push(data.slice(i, i + c).map(h).join(''));
    return out.join('\n');
  }
  const c = columns || 16;
  const g = group ?? 2;
  const groups = g > 0 ? Math.ceil(c / g) : 1;
  const width = c * 2 + (g > 0 ? groups - 1 : 0);
  const out: string[] = [];
  for (let i = 0; i < data.length; i += c) {
    const chunk = data.slice(i, i + c);
    const parts: string[] = [];
    for (let j = 0; j < chunk.length; j += g > 0 ? g : c) parts.push(chunk.slice(j, j + (g > 0 ? g : c)).map(h).join(''));
    out.push(`${hex(seek + i, 8)}: ${parts.join(' ').padEnd(width)}  ${chunk.map(printable).join('')}`);
  }
  return out.join('\n');
}

// xxd's exit_with_usage() (vim 9.0.1378's src/xxd/xxd.c, the xxd 2022-01-14 of
// Debian 12): the whole summary for -h or an unknown option, exit code 1.
const XXD_USAGE = [
  'Usage:',
  '       xxd [options] [infile [outfile]]',
  '    or',
  '       xxd -r [-s [-]offset] [-c cols] [-ps] [infile [outfile]]',
  'Options:',
  "    -a          toggle autoskip: A single '*' replaces nul-lines. Default off.",
  '    -b          binary digit dump (incompatible with -ps,-i,-r). Default hex.',
  '    -C          capitalize variable names in C include file style (-i).',
  '    -c cols     format <cols> octets per line. Default 16 (-i: 12, -ps: 30).',
  '    -E          show characters in EBCDIC. Default ASCII.',
  '    -e          little-endian dump (incompatible with -ps,-i,-r).',
  '    -g bytes    number of octets per group in normal output. Default 2 (-e: 4).',
  '    -h          print this summary.',
  '    -i          output in C include file style.',
  '    -l len      stop after <len> octets.',
  '    -n name     set the variable name used in C include output (-i).',
  '    -o off      add <off> to the displayed file position.',
  '    -ps         output in postscript plain hexdump style.',
  '    -r          reverse operation: convert (or patch) hexdump into binary.',
  '    -r -s off   revert with <off> added to file positions found in hexdump.',
  '    -d          show offset in decimal instead of hex.',
  '    -s [+][-]seek  start at <seek> bytes abs. (or +: rel.) infile offset.',
  '    -u          use upper case hex letters.',
  '    -v          show version: "xxd 2022-01-14 by Juergen Weigert et al.".',
].join('\n');

// ——— hexdump ———

function hexdump(game: Shell, args: string[], input: string | null): string {
  let canonical = false;
  let length = Infinity;
  let skip = 0;
  let all = false;
  const files: string[] = [];
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (!a.startsWith('-') || a === '-') files.push(a);
    else if (a === '-C' || a === '--canonical') canonical = true;
    else if (a === '-v' || a === '--no-squeezing') all = true;
    else if (/^-[ns]/.test(a)) {
      const v = size(a.length > 2 ? a.slice(2) : (args[++i] ?? ''));
      if (v === null) return game.error(`hexdump: invalid number '${a.length > 2 ? a.slice(2) : args[i]}'`, 1);
      if (a[1] === 'n') length = v;
      else skip = v;
    } else
      // util-linux's errtryhelp() (checked with util-linux 2.39): two lines.
      return game.error(`hexdump: invalid option -- '${a.slice(1, 2)}'\nTry 'hexdump --help' for more information.`, 1);
  }
  const read = readBytes(game, 'hexdump', files[0], input);
  if (read === null) return '';
  const data = read.slice(skip, skip + length);
  const out: string[] = [];
  let previous: string | null = null;
  let starred = false;
  for (let i = 0; i < data.length; i += 16) {
    const chunk = data.slice(i, i + 16);
    const key = chunk.join(',');
    if (!all && chunk.length === 16 && key === previous) {
      if (!starred) out.push('*');
      starred = true;
      continue;
    }
    previous = chunk.length === 16 ? key : null;
    starred = false;
    if (canonical) {
      let line = `${hex(skip + i, 8)}  `;
      for (let j = 0; j < 16; j++) line += (j < chunk.length ? `${hex(chunk[j], 2)} ` : '   ') + (j === 7 ? ' ' : '');
      out.push(`${line} |${chunk.map(printable).join('')}|`);
    } else {
      const words: string[] = [];
      for (let j = 0; j < chunk.length; j += 2) words.push(hex(chunk[j] + (chunk[j + 1] ?? 0) * 256, 4));
      out.push(`${hex(skip + i, 7)} ${words.join(' ')}`);
    }
  }
  if (data.length) out.push(canonical ? hex(skip + data.length, 8) : hex(skip + data.length, 7));
  return out.join('\n');
}

// ——— dd ———

const CONVERSIONS = ['ascii', 'ebcdic', 'ibm', 'block', 'unblock', 'lcase', 'ucase', 'notrunc', 'sync', 'noerror', 'fsync', 'fdatasync', 'excl', 'nocreat', 'sparse', 'swab'];

/** dd's statistics: "N+M records in/out", then the bytes, a duration and a speed (always the same: the engine has no time). */
function statistics(inFull: number, inPartial: number, outFull: number, outPartial: number, bytes: number): string {
  const seconds = 0.000412;
  const si = (n: number) => {
    const units = ['B', 'kB', 'MB', 'GB'];
    let k = 0;
    while (n >= 999.5 && k < units.length - 1) (n /= 1000), k++;
    return `${n < 10 && k ? n.toFixed(1) : Math.round(n)} ${units[k]}`;
  };
  const iec = (n: number) => {
    const units = ['B', 'KiB', 'MiB', 'GiB'];
    let k = 0;
    while (n >= 1023.5 && k < units.length - 1) (n /= 1024), k++;
    return `${n < 10 && k ? n.toFixed(1) : Math.round(n)} ${units[k]}`;
  };
  const amount = bytes === 1 ? '1 byte' : bytes < 1000 ? `${bytes} bytes` : `${bytes} bytes (${si(bytes)}, ${iec(bytes)})`;
  return `${inFull}+${inPartial} records in\n${outFull}+${outPartial} records out\n${amount} copied, ${seconds} s, ${si(bytes / seconds)}/s`;
}

function dd(game: Shell, args: string[], input: string | null): string {
  const op: Record<string, string> = {};
  for (const a of args) {
    const m = /^([a-z]+)=(.*)$/.exec(a);
    if (!m || !['if', 'of', 'bs', 'ibs', 'obs', 'cbs', 'count', 'skip', 'seek', 'conv', 'status', 'iflag', 'oflag'].includes(m[1]))
      return game.error(`dd: unrecognized operand '${a}'\nTry 'dd --help' for more information.`, 1);
    op[m[1]] = m[2];
  }
  const numbers: Record<string, number> = {};
  for (const k of ['bs', 'ibs', 'obs', 'cbs', 'count', 'skip', 'seek']) {
    if (op[k] === undefined) continue;
    const v = size(op[k]);
    if (v === null || ((k === 'bs' || k === 'ibs' || k === 'obs' || k === 'cbs') && v === 0)) return game.error(`dd: invalid number: '${op[k]}'`, 1);
    numbers[k] = v;
  }
  const conv = (op.conv ?? '').split(',').filter(Boolean);
  const unknown = conv.find((c) => !CONVERSIONS.includes(c));
  if (unknown) return game.error(`dd: invalid conversion: '${unknown}'\nTry 'dd --help' for more information.`, 1);
  if (conv.includes('ascii') && (conv.includes('ebcdic') || conv.includes('ibm'))) return game.error(`dd: cannot combine any two of {ascii,ebcdic,ibm}`, 1);
  if (conv.includes('block') && conv.includes('unblock')) return game.error(`dd: cannot combine block and unblock`, 1);
  if (op.status && !['none', 'noxfer', 'progress'].includes(op.status)) return game.error(`dd: invalid status level: '${op.status}'\nTry 'dd --help' for more information.`, 1);
  const ibs = numbers.bs ?? numbers.ibs ?? 512;
  const obs = numbers.bs ?? numbers.obs ?? 512;
  // /dev/urandom never ends: count says how much to take. The game's random
  // bytes are derived from the target and a counter (the engine stays deterministic).
  const random = op.if === '/dev/urandom' || op.if === '/dev/random';
  if (random && numbers.count === undefined) return game.error(game.t('dd-random-endless', { file: op.if }), 1);
  let read: number[] | null;
  if (random) {
    const draws = (game.state.randomDraws ?? 0) as number;
    game.state.randomDraws = draws + 1;
    const wanted = (numbers.skip ?? 0) * ibs + numbers.count! * ibs;
    read = (hexOf(`urandom-${op.of ?? ''}-${draws}`, Math.min(wanted, 1 << 20) * 2).match(/../g) ?? []).map((x) => parseInt(x, 16));
  } else read = readBytes(game, 'dd', op.if, input);
  if (read === null) return '';
  let data = read.slice((numbers.skip ?? 0) * ibs);
  if (numbers.count !== undefined) data = data.slice(0, numbers.count * ibs);
  const inFull = Math.floor(data.length / ibs);
  const inPartial = data.length % ibs ? 1 : 0;
  // GNU's order: ascii translates then unblocks; ebcdic blocks then translates.
  const cbs = numbers.cbs;
  const unblock = (b: number[]) => {
    if (!cbs) return b;
    const r: number[] = [];
    for (let i = 0; i < b.length; i += cbs) {
      const record = b.slice(i, i + cbs);
      while (record.length && record.at(-1) === 0x20) record.pop();
      r.push(...record, 0x0a);
    }
    return r;
  };
  const block = (b: number[]) => {
    if (!cbs) return b;
    const r: number[] = [];
    let line: number[] = [];
    const flush = () => r.push(...line.slice(0, cbs), ...Array(Math.max(0, cbs - line.length)).fill(0x20));
    for (const x of b)
      if (x === 0x0a) {
        flush();
        line = [];
      } else line.push(x);
    if (line.length) flush();
    return r;
  };
  if (conv.includes('ascii')) data = unblock(data.map((x) => DD_ASCII[x]));
  else if (conv.includes('ebcdic') || conv.includes('ibm')) data = block(data).map((x) => DD_EBCDIC[x]);
  else if (conv.includes('unblock')) data = unblock(data);
  else if (conv.includes('block')) data = block(data);
  if (conv.includes('lcase')) data = data.map((x) => (x >= 0x41 && x <= 0x5a ? x + 32 : x));
  if (conv.includes('ucase')) data = data.map((x) => (x >= 0x61 && x <= 0x7a ? x - 32 : x));
  const text = byteString(data);
  const stats = op.status === 'none' ? '' : statistics(inFull, inPartial, Math.floor(data.length / obs), data.length % obs ? 1 : 0, data.length);
  if (op.of === undefined) {
    // To the screen or the pipe; the statistics go to stderr.
    if (stats) game.error(stats);
    game.status = 0;
    game.outputCharset = isBinary(text) ? 'binary' : null;
    return text.replace(/\n$/, '');
  }
  // A text that ends with a newline is kept the game's way (without it); bytes are kept as they are.
  // /dev/null: the bytes go nowhere (to count the records).
  if (op.of === '/dev/null') return stats;
  const binary = isBinary(text);
  const kept = binary ? text : text.replace(/\n$/, '');
  const n = game.find(op.of);
  if (n?.type === 'directory') return game.error(`dd: failed to open '${op.of}': Is a directory`, 1);
  if (n) {
    if (!game.traverses(op.of) || !game.can(n, 'w')) return game.error(`dd: failed to open '${op.of}': Permission denied`, 1);
    n.content = kept;
    n.lines = !binary;
    delete n.size;
    if (binary) n.charset = 'binary';
    else delete n.charset;
    n.mtime = systemd(game)?.clock;
  } else {
    const refused = game.place('dd', op.of, { type: 'file', content: kept, owner: game.who, lines: !binary, ...(binary ? { charset: 'binary' as const } : {}), mtime: systemd(game)?.clock });
    if (refused) return game.error(`dd: failed to open '${op.of}': ${game.find(op.of + '/..') ? 'Permission denied' : 'No such file or directory'}`, 1);
  }
  return stats;
}

export const BYTES: Record<string, Command> = {
  od: { ownOptions: true, launch: ({ args, input, game }) => od(game, args, input) },
  xxd: { ownOptions: true, launch: ({ args, input, game }) => xxd(game, args, input) },
  hexdump: { ownOptions: true, launch: ({ args, input, game }) => hexdump(game, args, input) },
  dd: { ownOptions: true, launch: ({ args, input, game }) => dd(game, args, input) },
};
