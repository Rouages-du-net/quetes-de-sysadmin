// Compressing and decompressing: gzip, gunzip, zcat, zgrep, zless, zmore,
// zdiff (GNU gzip 1.13), bzip2, bunzip2, bzcat (bzip2 1.0.8), xz, unxz,
// xzcat (XZ Utils 5.8), and zip/unzip (Info-ZIP 3.0 / 6.0, not installed by
// default on Debian: apt install zip unzip). The files' model is in
// ../compression.ts. Messages, exit codes (1 for an error, 2 for a warning)
// and listings follow the real tools:
// https://www.gnu.org/software/gzip/manual/gzip.html,
// https://sourceware.org/bzip2/manual/manual.html,
// https://tukaani.org/xz/man/xz.1.html, unzip(1), zip(1).
// Differences: no real DEFLATE (sizes are estimates), no -S suffix, -r only
// for gzip; zip has no -u/-d/-m, unzip asks once per conflict.

import type { Command, Context } from './index';
import type { Shell } from '../shell';
import type { File, Node } from '../world';
import { content, sizeFor } from '../tools';
import { nowOf } from '../time';
import { installedSet } from './apt';
import {
  alreadyCompressed,
  formatOf,
  pack,
  packedSize,
  SUFFIX,
  textBytes,
  unpack,
  zipBytes,
  zipEntries,
  type Format,
  type Unpacked,
  type ZipEntry,
} from '../compression';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const pad = (n: number) => String(n).padStart(2, '0');
const basename = (p: string) => p.replace(/\/+$/, '').split('/').pop() ?? p;

/** A file's raw bytes (LATIN1 and binary files as they are). */
const bytesOf = (n: File, game: Shell) => content(n, game);

/** A compressed file's or archive's text, read back (gzip -d, zcat, less through lesspipe). */
export function decompressed(n: File, game: Shell): Unpacked | null {
  if (n.archive || n.link !== undefined) return null;
  return n.charset === 'binary' ? unpack(content(n, game)) : null;
}

// ——— Per format: names and messages ———

interface Tool {
  format: Format;
  name: string;
  suffixes: [string, string][];
  missing: (f: string) => string;
  exists: (f: string) => string;
  notFormat: (f: string) => string;
  unknownSuffix: (f: string) => string;
  directory: (f: string) => string;
  terminal: string;
  verbose: (f: string, out: string, raw: number, packed: number, keep: boolean, decompress: boolean) => string;
}

const ratio = (raw: number, data: number) => (raw ? ((100 * (raw - data)) / raw).toFixed(1) : '0.0').padStart(5);
// What gzip -l and -v count as the compressed data: the file less its header and trailer.
const gzipData = (packed: number, name?: string) => packed - 18 - (name ? new TextEncoder().encode(name).length + 1 : 0);

const TOOLS: Record<Format, Tool> = {
  gzip: {
    format: 'gzip',
    name: 'gzip',
    suffixes: [['.gz', ''], ['-gz', ''], ['.z', ''], ['-z', ''], ['_z', ''], ['.tgz', '.tar'], ['.taz', '.tar']],
    missing: (f) => `gzip: ${f}: No such file or directory`,
    exists: (f) => `gzip: ${f} already exists;\tnot overwritten`,
    notFormat: (f) => `gzip: ${f}: not in gzip format`,
    unknownSuffix: (f) => `gzip: ${f}: unknown suffix -- ignored`,
    directory: (f) => `gzip: ${f} is a directory -- ignored`,
    terminal: 'gzip: compressed data not written to a terminal. Use -f to force compression.\nFor help, type: gzip -h',
    verbose: (f, out, raw, packed, keep, decompress) =>
      `${f}:\t${ratio(raw, gzipData(packed, decompress ? basename(out) : basename(f)))}% -- ${keep ? 'created' : 'replaced with'} ${out}`,
  },
  bzip2: {
    format: 'bzip2',
    name: 'bzip2',
    suffixes: [['.bz2', ''], ['.bz', ''], ['.tbz2', '.tar'], ['.tbz', '.tar']],
    missing: (f) => `bzip2: Can't open input file ${f}: No such file or directory.`,
    exists: (f) => `bzip2: Output file ${f} already exists.`,
    notFormat: (f) => `bzip2: ${f} is not a bzip2 file.`,
    unknownSuffix: (f) => `bzip2: Can't guess original name for ${f} -- using ${f}.out`,
    directory: (f) => `bzip2: Input file ${f} is a directory.`,
    terminal: "bzip2: I won't write compressed data to a terminal.\nbzip2: For help, type: `bzip2 --help'.",
    verbose: (f, _out, raw, packed, _keep, decompress) => {
      if (decompress) return `  ${f}: done`;
      const r = packed ? raw / packed : 0;
      return `  ${f}:${' '.repeat(Math.max(1, 4 - f.length + 2))}${r.toFixed(3)}:1, ${((8 * packed) / Math.max(raw, 1)).toFixed(3).padStart(6)} bits/byte, ${(100 * (1 - packed / Math.max(raw, 1))).toFixed(2)}% saved, ${raw} in, ${packed} out.`;
    },
  },
  xz: {
    format: 'xz',
    name: 'xz',
    suffixes: [['.xz', ''], ['.txz', '.tar']],
    missing: (f) => `xz: ${f}: No such file or directory`,
    exists: (f) => `xz: ${f}: File exists`,
    notFormat: (f) => `xz: ${f}: File format not recognized`,
    unknownSuffix: (f) => `xz: ${f}: Filename has an unknown suffix, skipping`,
    directory: (f) => `xz: ${f}: Is a directory, skipping`,
    terminal: 'xz: Compressed data cannot be written to a terminal\nxz: Try `xz --help\' for more information.',
    verbose: (f, _out, raw, packed, _keep, decompress) => `${f}: ${decompress ? `${raw} B / ${packed} B` : `${packed} B / ${raw} B`} = ${(packed / Math.max(raw, 1)).toFixed(3)}`,
  },
};

interface Flags {
  decompress: boolean;
  stdout: boolean;
  keep: boolean;
  force: boolean;
  list: boolean;
  test: boolean;
  verbose: boolean;
  quiet: boolean;
  recursive: boolean;
  level: number;
  files: string[];
}

const LONG: Record<string, string> = {
  stdout: 'c', 'to-stdout': 'c', decompress: 'd', uncompress: 'd', force: 'f', keep: 'k', list: 'l', recursive: 'r', test: 't', verbose: 'v', quiet: 'q', fast: '1', best: '9', 'no-name': 'n', name: 'N',
};

function parse(game: Shell, tool: Tool, args: string[], base: Partial<Flags>): Flags | string {
  const f: Flags = { decompress: false, stdout: false, keep: false, force: false, list: false, test: false, verbose: false, quiet: false, recursive: false, level: 6, files: [], ...base };
  let ended = false;
  const allowed = tool.format === 'gzip' ? 'cdfklnNqrtvV123456789' : tool.format === 'bzip2' ? 'cdfkqstvzV123456789' : 'cdfklqtvzV0123456789';
  for (const a of args) {
    if (ended || a === '-' || !a.startsWith('-')) {
      f.files.push(a);
      continue;
    }
    if (a === '--') {
      ended = true;
      continue;
    }
    const letters = a.startsWith('--') ? LONG[a.slice(2)] : a.slice(1);
    if (letters === undefined || (tool.format === 'bzip2' && a.startsWith('--') && (a === '--list' || a === '--recursive'))) {
      if (tool.format === 'bzip2') return `bzip2: Bad flag \`${a}'\nbzip2, a block-sorting file compressor.  Version 1.0.8, 13-Jul-2019.`;
      if (tool.format === 'xz') return `xz: unrecognized option '${a}'\nxz: Try \`xz --help' for more information.`;
      return `gzip: unrecognized option '${a}'\nTry \`gzip --help' for more information.`;
    }
    for (const l of letters) {
      if (!allowed.includes(l)) {
        if (tool.format === 'bzip2') return `bzip2: Bad flag \`${a}'\nbzip2, a block-sorting file compressor.  Version 1.0.8, 13-Jul-2019.`;
        if (tool.format === 'xz') return `xz: invalid option -- '${l}'\nxz: Try \`xz --help' for more information.`;
        return `gzip: invalid option -- '${l}'\nTry \`gzip --help' for more information.`;
      }
      if (l === 'd') f.decompress = true;
      else if (l === 'z') f.decompress = false;
      else if (l === 'c') f.stdout = true;
      else if (l === 'k') f.keep = true;
      else if (l === 'f') f.force = true;
      else if (l === 'l') f.list = true;
      else if (l === 't') f.test = true;
      else if (l === 'v') f.verbose = true;
      else if (l === 'q') f.quiet = true;
      else if (l === 'r') f.recursive = true;
      else if (/\d/.test(l)) f.level = Number(l);
    }
  }
  void game;
  return f;
}

/** The decompressed name for a compressed one, by its suffix (null: unknown suffix). */
function plainName(tool: Tool, path: string): string | null {
  for (const [s, r] of tool.suffixes) if (path.endsWith(s) && basename(path).length > s.length) return path.slice(0, -s.length) + r;
  return null;
}

/** Compresses a node (a text, or a tar archive) into a new one. */
function compressNode(game: Shell, tool: Tool, n: File, name: string, level: number): File {
  const mtime = n.mtime ?? nowOf(game);
  const raw = sizeFor(n, game);
  const size = packedSize(tool.format, raw, { name: tool.format === 'gzip' ? name : undefined, level, already: alreadyCompressed(name) });
  if (n.archive) return { ...n, read: undefined, archive: { ...n.archive, compressed: true, format: tool.format === 'gzip' ? undefined : tool.format }, size, mtime };
  const text = bytesOf(n, game);
  const isize = n.size ?? textBytes(text, n.charset).length;
  return {
    type: 'file',
    content: pack(tool.format, text, { name: tool.format === 'gzip' ? name : undefined, mtime, level, charset: n.charset, isize }),
    charset: 'binary',
    size,
    mtime,
    owner: n.owner,
    group: n.group,
    mode: n.mode,
  };
}

/** The archive's format (null: not compressed), or the compressed file's. */
const formatOfNode = (n: File, game: Shell): Format | null =>
  n.archive ? (n.archive.compressed ? (n.archive.format ?? 'gzip') : null) : n.charset === 'binary' ? formatOf(content(n, game)) : null;

/** The decompressed node. */
function decompressNode(game: Shell, n: File, u: Unpacked | null): File {
  if (n.archive) {
    const files = Object.values(n.archive.files);
    return { ...n, read: undefined, archive: { ...n.archive, compressed: false, format: undefined }, size: files.reduce((t, f) => t + 512 + sizeFor(f, game), 1024) };
  }
  const real = textBytes(u!.text, u!.charset).length;
  return {
    type: 'file',
    content: u!.text,
    lines: !u!.charset,
    ...(u!.charset ? { charset: u!.charset } : {}),
    ...(u!.isize !== real ? { size: u!.isize } : {}),
    mtime: n.mtime,
    owner: n.owner,
    group: n.group,
    mode: n.mode,
  };
}

/** A tar archive's bytes as a stream (zcat x.tar.gz): its names and NULs, the rest unseen. */
const tarStream = (n: File) => Object.keys(n.archive!.files).map((p) => `${p}\0\0\0\0ustar  \0`).join('\0'.repeat(8));

function run(game: Shell, tool: Tool, f: Flags, input: string | null, last: boolean): string {
  const out: string[] = [];
  let status = 0;
  const fail = (message: string, code = 1) => {
    if (code === 2 && f.quiet) {
      status = Math.max(status, code);
      return;
    }
    game.error(message);
    status = code === 1 ? 1 : Math.max(status, code);
  };
  const toStdout = f.stdout || f.test;
  // Compressed data to the screen: refused unless -f.
  if (!f.decompress && !f.list && !f.test && (f.stdout || !f.files.length || f.files.includes('-')) && last && !f.force) {
    game.error(tool.terminal);
    game.status = 1;
    return '';
  }
  const files = f.files.length ? f.files : ['-'];
  const list: string[][] = [];
  let totals = [0, 0];
  for (const file of files) {
    if (file === '-') {
      const text = input ?? '';
      if (f.decompress || f.list || f.test) {
        const u = unpack(text, tool.format);
        if (!u) {
          fail(tool.notFormat('stdin'));
          continue;
        }
        if (f.list) {
          list.push(listRow(tool, u, text.length, ''));
          continue;
        }
        if (f.test) continue;
        game.outputCharset = u.charset ?? null;
        out.push(u.text);
      } else {
        game.outputCharset = 'binary';
        out.push(pack(tool.format, text, { mtime: nowOf(game), level: f.level, charset: game.outputCharset === 'binary' ? undefined : undefined }));
      }
      continue;
    }
    // zcat x, gunzip x: x.gz when x itself doesn't exist.
    let path = file;
    let n = game.find(path);
    if (!n && (f.decompress || f.list || f.test) && game.find(path + SUFFIX[tool.format])) {
      path += SUFFIX[tool.format];
      n = game.find(path);
    }
    if (!n) {
      fail(tool.missing(file));
      continue;
    }
    if (n.type === 'directory') {
      if (f.recursive && tool.format === 'gzip') {
        const walk = (p: string, d: Node) => {
          if (d.type !== 'directory') return;
          for (const [k, child] of Object.entries(d.children)) {
            const cp = `${p.replace(/\/$/, '')}/${k}`;
            if (child.type === 'directory') walk(cp, child);
            else one(cp, child, true);
          }
        };
        walk(path, n);
      } else fail(tool.directory(file), tool.format === 'gzip' ? 2 : 1);
      continue;
    }
    one(path, n, false);
  }

  function one(path: string, n: File, recursing: boolean) {
    if (!game.traverses(path) || !game.can(n, 'r')) return fail(`${tool.name}: ${path}: Permission denied`);
    if (f.list || f.test || f.decompress) {
      // gunzip x: the suffix first (gzip -dc and -l read any name).
      if (f.decompress && !toStdout && !f.list && !plainName(tool, path)) {
        if (recursing) return;
        return fail(tool.unknownSuffix(path), 2);
      }
      const format = formatOfNode(n, game);
      const u = n.archive ? null : decompressed(n, game);
      if (format !== tool.format || (!n.archive && !u)) {
        // gzip -r -d skips what isn't compressed, quietly.
        if (recursing && !plainName(tool, path)) return;
        return fail(tool.notFormat(path));
      }
      if (f.list) {
        if (n.archive) {
          const raw = Object.values(n.archive.files).reduce((t, x) => t + 512 + sizeFor(x, game), 1024);
          list.push(listRow(tool, { format: tool.format, mtime: Math.floor((n.mtime ?? nowOf(game)) / 1000), xfl: 0, text: '', isize: raw, crc: 0, name: undefined }, sizeFor(n, game), plainName(tool, path) ?? path));
        } else list.push(listRow(tool, u!, sizeFor(n, game), tool.format === 'xz' ? path : (plainName(tool, path) ?? path)));
        return;
      }
      if (f.test) return;
      if (toStdout) {
        if (n.archive) {
          game.outputCharset = 'binary';
          out.push(tarStream(n));
        } else {
          game.outputCharset = u!.charset ?? null;
          out.push(u!.text);
        }
        return;
      }
      const target = plainName(tool, path);
      if (!target) return fail(tool.unknownSuffix(path), 2);
      write(path, target, n, decompressNode(game, n, u), sizeFor(n, game));
      return;
    }
    // Compressing.
    if (plainName(tool, path) && !f.stdout && !f.force) {
      if (recursing) return;
      if (tool.format === 'gzip') return fail(`gzip: ${path} already has ${SUFFIX.gzip} suffix -- unchanged`, 2);
      if (tool.format === 'bzip2') return fail(`bzip2: Input file ${path} already has .bz2 suffix.`);
      return fail(`xz: ${path}: File already has \`${SUFFIX.xz}' suffix, skipping`, 2);
    }
    const packed = compressNode(game, tool, n, basename(path), f.level);
    if (f.stdout) {
      game.outputCharset = 'binary';
      out.push(n.archive ? pack(tool.format, tarStream(n), { name: basename(path), mtime: packed.mtime }) : (packed.content as string));
      return;
    }
    write(path, path + SUFFIX[tool.format], n, packed, sizeFor(packed, game));
  }

  function write(path: string, target: string, n: File, made: File, packed: number) {
    if (game.find(target) && !f.force) return fail(tool.exists(target), tool.format === 'gzip' ? 2 : 1);
    if (!f.keep && !game.writtenIn(path)) return fail(`${tool.name}: ${path}: Permission denied`);
    // Who runs gzip owns the new file (root keeps the original owner, like gzip run as root).
    if (game.who !== 'root') {
      made.owner = game.who;
      made.group = undefined;
    }
    const error = game.place(tool.name, target, made);
    if (error) return fail(`${tool.name}: ${target}: Permission denied`);
    if (!f.keep) game.erase(path);
    const raw = f.decompress ? sizeFor(made, game) : sizeFor(n, game);
    if (f.verbose) game.error(tool.verbose(path, target, raw, packed, f.keep, f.decompress));
  }

  if (f.list) {
    if (tool.format === 'xz') {
      out.push('Strms  Blocks   Compressed Uncompressed  Ratio  Check   Filename', ...list.map((r) => r[0]));
    } else {
      const head = f.verbose
        ? 'method  crc     date  time           compressed        uncompressed  ratio uncompressed_name'
        : '         compressed        uncompressed  ratio uncompressed_name';
      out.push(head, ...list.map((r) => (f.verbose ? r[1] : r[0])));
      if (list.length > 1) {
        totals = list.reduce((t, r) => [t[0] + Number(r[2]), t[1] + Number(r[3])], [0, 0]);
        const row = `${String(totals[0]).padStart(19)} ${String(totals[1]).padStart(19)} ${ratio(totals[1], totals[0] - 24 * list.length)}% (totals)`;
        out.push(f.verbose ? `${' '.repeat(31)}${row}` : row);
      }
    }
  }
  // -v's lines go to the error output: they don't make it fail.
  game.status = status;
  return out.join('\n');
}

/** A line of gzip -l (plain, verbose) or of xz -l, with the sizes (compressed, original). */
function listRow(tool: Tool, u: Unpacked, packed: number, name: string): string[] {
  if (tool.format === 'xz') {
    const human = (b: number) => (b >= 1024 * 1024 ? `${(b / 1024 / 1024).toFixed(1)} MiB` : b >= 1024 ? `${(b / 1024).toFixed(1)} KiB` : `${b} B`);
    return [`    1       1 ${human(packed).padStart(12)} ${human(u.isize).padStart(12)}  ${(packed / Math.max(u.isize, 1)).toFixed(3)}  CRC64   ${name}${tool.suffixes[0][0] && name ? '' : ''}`, '', String(packed), String(u.isize)];
  }
  const data = gzipData(packed, u.name);
  const plain = `${String(packed).padStart(19)} ${String(u.isize).padStart(19)} ${ratio(u.isize, data)}% ${name}`;
  const d = new Date(u.mtime * 1000);
  const verbose = `defla ${u.crc.toString(16).padStart(8, '0')} ${MONTHS[d.getUTCMonth()]} ${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())} ${plain}`;
  return [plain, verbose, String(packed), String(u.isize)];
}

/** gzip, bzip2, xz and their cousins (gunzip = gzip -d, zcat = gzip -dc…). */
function tool(format: Format, base: Partial<Flags> = {}): Command {
  return {
    ownOptions: true,
    launch: ({ args, game, input, last }) => {
      const t = TOOLS[format];
      const f = parse(game, t, args, base);
      if (typeof f === 'string') return game.error(f, 1);
      // zcat x (no .gz): gzip tries x.gz; with -l, xz checks its own.
      if (format === 'xz' && f.list && !f.files.length) return game.error('xz: --list does not support reading from standard input', 1);
      return run(game, t, f, input, last);
    },
  };
}

// ——— zgrep, zless, zmore, zdiff ———

/** The text of a file for the z* scripts: decompressed if it is compressed, as it is otherwise (like gzip -cdfq). */
function zText(game: Shell, cmd: string, path: string): string | null {
  let n = game.find(path);
  if (!n && game.find(path + '.gz')) n = game.find(path + '.gz');
  if (!n) return game.error(`gzip: ${path}: No such file or directory`, cmd === 'zgrep' ? 2 : 1), null;
  if (n.type === 'directory') return game.error(`gzip: ${path} is a directory -- ignored`, 2), null;
  if (!game.can(n, 'r')) return game.error(`gzip: ${path}: Permission denied`, 2), null;
  const u = decompressed(n, game);
  return u ? u.text : content(n, game);
}

function zgrep({ args, game, last }: Context): string {
  const options: string[] = [];
  const operands: string[] = [];
  let pattern: string | null = null;
  for (let k = 0; k < args.length; k++) {
    const a = args[k];
    if (a === '-e' || a === '-f') {
      options.push(a, args[++k] ?? '');
      pattern = '';
    } else if (/^-[ABCm]$/.test(a)) options.push(a, args[++k] ?? '');
    else if (a.startsWith('-') && a !== '-') options.push(a);
    else operands.push(a);
  }
  if (pattern === null) pattern = operands.shift() ?? null;
  if (pattern === null) return game.error('Usage: zgrep [OPTION]... [-e] PATTERN [FILE]...\nTry \'zgrep --help\' for more information.', 2);
  const letters = options.filter((o) => /^-[a-zA-Z]+$/.test(o)).join('');
  const names = letters.includes('h') ? false : letters.includes('H') || operands.length > 1;
  const pass = options.filter((o) => !/^-[hH]+$/.test(o)).map((o) => (/^-[a-zA-Z]+$/.test(o) ? o.replace(/[hH]/g, '') : o)).filter((o) => o !== '-');
  const out: string[] = [];
  let found = false;
  let trouble = false;
  for (const file of operands.length ? operands : ['-']) {
    const text = file === '-' ? null : zText(game, 'zgrep', file);
    if (file !== '-' && text === null) {
      trouble = true;
      continue;
    }
    const r = game.run(['grep', ...pass, ...(pattern !== '' ? [pattern] : [])], text ?? '', last);
    if ((game.status ?? 0) === 0) found = true;
    if (!r) continue;
    if (letters.includes('l')) out.push(file);
    else if (names) out.push(r.split('\n').map((l) => `${file}:${l}`).join('\n'));
    else out.push(r);
  }
  game.status = trouble ? 2 : found ? 0 : 1;
  return out.join('\n');
}

function zview(cmd: 'zless' | 'zmore') {
  return ({ args, game, input }: Context) => {
    const files = args.filter((a) => !a.startsWith('-'));
    if (!files.length) return input ?? '';
    const texts = files.map((f) => zText(game, cmd, f)).filter((t): t is string => t !== null);
    // zmore announces each file when there are several, like more.
    if (cmd === 'zmore' && files.length > 1) return texts.map((t, k) => `------> ${files[k]} <------\n${t}`).join('\n');
    return texts.join('\n');
  };
}

function zdiff({ args, game, last }: Context): string {
  const options = args.filter((a) => a.startsWith('-'));
  const files = args.filter((a) => !a.startsWith('-'));
  if (!files.length) return game.error('zdiff: missing operand\nTry `zdiff --help\' for more information.', 2);
  // One file: x.gz against x.
  const pair = files.length === 1 ? [files[0], plainName(TOOLS.gzip, files[0]) ?? files[0]] : files.slice(0, 2);
  const a = zText(game, 'zdiff', pair[0]);
  const b = zText(game, 'zdiff', pair[1]);
  if (a === null || b === null) return '';
  // diff reads both texts through files it is given: a temporary pair under /tmp, as zdiff does.
  const tmp = (k: number, text: string) => {
    const p = `/tmp/zdiff.${k}`;
    game.place('zdiff', p, { type: 'file', content: text, lines: true, owner: game.who });
    return p;
  };
  const [pa, pb] = [tmp(1, a), tmp(2, b)];
  try {
    const out = game.run(['diff', ...options, pa, pb], null, last);
    return out.replaceAll(pa, pair[0]).replaceAll(pb, pair[1]);
  } finally {
    game.erase(pa);
    game.erase(pb);
  }
}

// ——— zip and unzip ———

/** zip and unzip aren't installed by default on Debian: apt install zip unzip. */
const notInstalled = (game: Shell, pkg: string) => {
  if (installedSet(game)[pkg]) return null;
  game.status = 127;
  return game.error(`-bash: ${pkg}: command not found`), '';
};

const zipDate = (ms: number) => {
  const d = new Date(ms);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
};

function zip({ args, game }: Context): string {
  const missing = notInstalled(game, 'zip');
  if (missing !== null) return missing;
  let recursive = false;
  let quiet = false;
  const operands: string[] = [];
  for (const a of args) {
    if (/^-[rqv9]+$/.test(a)) {
      if (a.includes('r')) recursive = true;
      if (a.includes('q')) quiet = true;
    } else if (a.startsWith('-') && a !== '-') return game.error(`zip error: Invalid command arguments (short option '${a[1]}' not supported)`, 16);
    else operands.push(a);
  }
  if (!operands.length) return game.error('zip error: Invalid command arguments (nothing to select from)', 16);
  let archive = operands[0];
  if (!/\.[^./]+$/.test(basename(archive))) archive += '.zip';
  const before = game.find(archive);
  const entries: ZipEntry[] = before?.type === 'file' ? (zipEntries(content(before, game)) ?? []) : [];
  const lines: string[] = [];
  let added = 0;
  const add = (path: string, n: Node) => {
    const name = path.replace(/^\.?\/+/, '') + (n.type === 'directory' ? '/' : '');
    const k = entries.findIndex((e) => e.name === name);
    let how = 'stored 0%';
    let entry: ZipEntry;
    if (n.type === 'directory') entry = { name, text: '', mode: n.mode ?? 'rwxr-xr-x', mtime: nowOf(game) };
    else {
      const raw = sizeFor(n, game);
      const data = packedSize('gzip', raw, { already: alreadyCompressed(name) }) - 18;
      const pct = raw ? Math.round((100 * (raw - data)) / raw) : 0;
      if (pct > 0) how = `deflated ${pct}%`;
      entry = { name, text: content(n, game), ...(n.charset ? { charset: n.charset } : {}), mode: n.mode ?? 'rw-r--r--', mtime: n.mtime ?? nowOf(game), ...(n.size !== undefined ? { size: n.size } : {}) };
    }
    if (k >= 0) entries[k] = entry;
    else entries.push(entry);
    added++;
    lines.push(`${k >= 0 ? 'updating' : '  adding'}: ${name} (${how})`);
    if (n.type === 'directory' && recursive) for (const [c, child] of Object.entries(n.children)) add(`${path.replace(/\/$/, '')}/${c}`, child);
  };
  for (const op of operands.slice(1)) {
    const n = game.find(op);
    if (!n) {
      lines.push(`\tzip warning: name not matched: ${op}`);
      continue;
    }
    if (n.type === 'file' && !game.can(n, 'r')) {
      lines.push(`\tzip warning: could not open for reading: ${op}`);
      continue;
    }
    add(op, n);
  }
  if (!added) {
    game.error([...lines, '', `zip error: Nothing to do! (${archive})`].join('\n'));
    game.status = 12;
    return '';
  }
  const bytes = zipBytes(entries);
  const size = 22 + entries.reduce((t, e) => t + 76 + 2 * e.name.length + (e.text ? packedSize('gzip', e.size ?? textBytes(e.text, e.charset).length, { already: alreadyCompressed(e.name) }) - 18 : 0), 0);
  const node: File = { type: 'file', content: bytes, charset: 'binary', size, owner: game.who, mtime: nowOf(game) };
  const error = game.place('zip', archive, node);
  if (error) return game.error(`zip I/O error: Permission denied\n\nzip error: Could not create output file (${archive})`, 15);
  return quiet ? lines.filter((l) => l.startsWith('\t')).join('\n') : lines.join('\n');
}

function unzip({ args, game }: Context): string {
  const missing = notInstalled(game, 'unzip');
  if (missing !== null) return missing;
  let listOnly = false;
  let overwrite: boolean | null = null;
  let quiet = false;
  let dir = '';
  const operands: string[] = [];
  for (let k = 0; k < args.length; k++) {
    const a = args[k];
    if (a === '-d') dir = args[++k] ?? '';
    else if (/^-[lonq]+$/.test(a)) {
      if (a.includes('l')) listOnly = true;
      if (a.includes('o')) overwrite = true;
      if (a.includes('n')) overwrite = false;
      if (a.includes('q')) quiet = true;
    } else if (a.startsWith('-')) return game.error(`error:  -${a[1]} option not recognized\n\nUsage: unzip [-Z] [-opts[modifiers]] file[.zip] [list] [-x xlist] [-d exdir]`, 10);
    else operands.push(a);
  }
  if (!operands.length) return 'UnZip 6.00 of 20 April 2009, by Debian. Original by Info-ZIP.\n\nUsage: unzip [-Z] [-opts[modifiers]] file[.zip] [list] [-x xlist] [-d exdir]';
  const name = operands[0];
  const n = game.find(name) ?? game.find(`${name}.zip`);
  if (!n || n.type !== 'file') return game.error(`unzip:  cannot find or open ${name}, ${name}.zip or ${name}.ZIP.`, 9);
  const entries = zipEntries(content(n, game));
  if (!entries)
    return game.error(
      `Archive:  ${name}\n  End-of-central-directory signature not found.  Either this file is not\n  a zipfile, or it constitutes one disk of a multi-part archive.  In the\n  latter case the central directory and zipfile comment will be found on\n  the last disk(s) of this archive.\nunzip:  cannot find zipfile directory in one of ${name} or\n        ${name}.zip, and cannot find ${name}.ZIP, period.`,
      9,
    );
  const sizeOf = (e: ZipEntry) => (e.name.endsWith('/') ? 0 : (e.size ?? textBytes(e.text, e.charset).length));
  if (listOnly) {
    const total = entries.reduce((t, e) => t + sizeOf(e), 0);
    return [
      `Archive:  ${name}`,
      '  Length      Date    Time    Name',
      '---------  ---------- -----   ----',
      ...entries.map((e) => `${String(sizeOf(e)).padStart(9)}  ${zipDate(e.mtime ?? 0)}   ${e.name}`),
      '---------                     -------',
      `${String(total).padStart(9)}                     ${entries.length} file${entries.length === 1 ? '' : 's'}`,
    ].join('\n');
  }
  const base = dir ? dir.replace(/\/$/, '') : '';
  if (dir && !game.find(dir)) game.place('unzip', dir, { type: 'directory', children: {}, owner: game.who });
  const out: string[] = quiet ? [] : [`Archive:  ${name}`];
  const where = (e: ZipEntry) => (base ? `${base}/${e.name}` : e.name).replace(/\/$/, '');
  const extract = (k: number, all: boolean | null): string => {
    for (; k < entries.length; k++) {
      const e = entries[k];
      const path = where(e);
      // The directories leading to it.
      const parts = path.split('/');
      for (let i = 1; i < parts.length; i++) {
        const p = parts.slice(0, i).join('/');
        if (p && !game.find(p)) game.place('unzip', p, { type: 'directory', children: {}, owner: game.who });
      }
      if (e.name.endsWith('/')) {
        if (!game.find(path)) {
          game.place('unzip', path, { type: 'directory', children: {}, owner: game.who, mode: e.mode });
          if (!quiet) out.push(`   creating: ${path}/`);
        }
        continue;
      }
      if (game.find(path) && all !== true) {
        if (all === false) continue;
        const rest = k;
        game.ask(`replace ${path}? [y]es, [n]o, [A]ll, [N]one, [r]ename: `, (answer) => {
          const a = answer.trim();
          if (a === 'A') return extract(rest, true);
          if (a === 'N') return extract(rest + 1, false);
          if (/^y/i.test(a)) {
            put(e, path);
            return extract(rest + 1, null);
          }
          return extract(rest + 1, null);
        });
        return out.splice(0).join('\n');
      }
      put(e, path);
    }
    return out.splice(0).join('\n');
  };
  const put = (e: ZipEntry, path: string) => {
    const real = textBytes(e.text, e.charset).length;
    const node: File = {
      type: 'file',
      content: e.text,
      lines: !e.charset,
      ...(e.charset ? { charset: e.charset } : {}),
      ...(e.size !== undefined && e.size !== real ? { size: e.size } : {}),
      owner: game.who,
      mode: e.mode,
      mtime: e.mtime,
    };
    const old = game.find(path);
    if (old?.type === 'file') game.erase(path);
    const error = game.place('unzip', path, node);
    if (error) return void game.error(`error:  cannot create ${path}\n        Permission denied`, 1);
    const verb = packedSize('gzip', real, { already: alreadyCompressed(e.name) }) - 18 < real ? '  inflating' : ' extracting';
    if (!quiet) out.push(`${verb}: ${path.padEnd(23)} `);
  };
  return extract(0, overwrite);
}

export const COMPRESS: Record<string, Command> = {
  gzip: tool('gzip'),
  gunzip: tool('gzip', { decompress: true }),
  zcat: tool('gzip', { decompress: true, stdout: true }),
  bzip2: tool('bzip2'),
  bunzip2: tool('bzip2', { decompress: true }),
  bzcat: tool('bzip2', { decompress: true, stdout: true }),
  xz: tool('xz'),
  unxz: tool('xz', { decompress: true }),
  xzcat: tool('xz', { decompress: true, stdout: true }),
  zgrep: { ownOptions: true, launch: zgrep },
  zless: { ownOptions: true, launch: zview('zless') },
  zmore: { ownOptions: true, launch: zview('zmore') },
  zdiff: { ownOptions: true, launch: zdiff },
  zip: { ownOptions: true, launch: zip },
  unzip: { ownOptions: true, launch: unzip },
};
