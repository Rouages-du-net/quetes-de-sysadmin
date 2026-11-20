// Compressed files: gzip (RFC 1952), bzip2, xz, and zip archives. A
// compressed file is a binary file (File.charset = 'binary') whose bytes
// start like the real format: gzip's header (magic 1f 8b, method 8, flags,
// the date, XFL, the OS, the original name), bzip2's "BZh9", xz's
// "\xfd7zXZ\0", zip's "PK\x03\x04". What follows is the text, scrambled
// with a fixed key stream (not DEFLATE): cat shows garbage, as with the real
// thing, and gunzip, zcat, file and gzip -l read it back, through a pipe, a
// redirection or a copy alike. gzip's trailer keeps the CRC-32 of the text
// and its declared size (ISIZE), so a story's big log keeps its size.
// File.size is the compressed size, estimated from the text (about a third
// for logs, nothing gained on what is already compressed).
// https://www.rfc-editor.org/rfc/rfc1952, https://www.gnu.org/software/gzip/manual/gzip.html

import type { File } from './world';

export type Format = 'gzip' | 'bzip2' | 'xz';

export interface Unpacked {
  format: Format;
  // The original name (gzip's FNAME, absent when compressed from a pipe).
  name?: string;
  // The original date (s since 1970, local time read as UTC; 0: none).
  mtime: number;
  // gzip's XFL: 2 for -9 (max compression), 4 for -1 (max speed).
  xfl: number;
  // The text, and what it was: UTF-8 text, LATIN1, raw bytes.
  text: string;
  charset?: 'latin1' | 'binary';
  // The size the trailer declares (ISIZE), and the text's CRC-32.
  isize: number;
  crc: number;
}

const MAGIC: Record<Format, string> = { gzip: '\x1f\x8b\x08', bzip2: 'BZh9', xz: '\xfd7zXZ\x00' };
export const SUFFIX: Record<Format, string> = { gzip: '.gz', bzip2: '.bz2', xz: '.xz' };

// The key stream (a fixed linear congruential generator): the same text always gives the same bytes.
function scramble(bytes: number[]): number[] {
  let x = 0x2545f491;
  return bytes.map((b) => {
    x = (Math.imul(x, 1103515245) + 12345) >>> 0;
    return b ^ ((x >>> 16) & 0xff);
  });
}

let TABLE: number[] | null = null;
/** CRC-32 (IEEE 802.3), as gzip's trailer and cksum's cousins compute it. */
export function crc32(bytes: number[]): number {
  TABLE ??= Array.from({ length: 256 }, (_, n) => {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    return c >>> 0;
  });
  let crc = 0xffffffff;
  for (const b of bytes) crc = TABLE[(crc ^ b) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

const le32 = (n: number) => [n & 0xff, (n >>> 8) & 0xff, (n >>> 16) & 0xff, (n >>> 24) & 0xff];
const read32 = (s: string, at: number) => (s.charCodeAt(at) | (s.charCodeAt(at + 1) << 8) | (s.charCodeAt(at + 2) << 16) | (s.charCodeAt(at + 3) << 24)) >>> 0;
const str = (b: number[]) => String.fromCharCode(...b);
const toStr = (b: number[]) => {
  let s = '';
  for (let i = 0; i < b.length; i += 8192) s += String.fromCharCode(...b.slice(i, i + 8192));
  return s;
};

/** A text's bytes: UTF-8, or one byte per character for LATIN1 and raw bytes. */
export const textBytes = (text: string, charset?: 'latin1' | 'binary'): number[] =>
  charset ? Array.from(text, (c) => c.charCodeAt(0) & 0xff) : Array.from(new TextEncoder().encode(text));

/** The compressed bytes of a text. */
export function pack(format: Format, text: string, o: { name?: string; mtime?: number; level?: number; charset?: 'latin1' | 'binary'; isize?: number } = {}): string {
  const bytes = textBytes(text, o.charset);
  const body = toStr(scramble(bytes));
  const trailer = str([...le32(crc32(bytes)), ...le32((o.isize ?? bytes.length) >>> 0)]);
  if (format !== 'gzip') return `${MAGIC[format]}${o.charset === 'binary' ? 'B' : o.charset === 'latin1' ? 'L' : 'U'}${body}${trailer}`;
  // FLG: FNAME (8) when there is a name, FCOMMENT (16) carries the charset.
  const flags = (o.name ? 8 : 0) | (o.charset ? 16 : 0);
  const xfl = o.level === 9 ? 2 : o.level === 1 ? 4 : 0;
  const header = str([0x1f, 0x8b, 8, flags, ...le32(Math.floor((o.mtime ?? 0) / 1000)), xfl, 3]);
  const name = o.name ? `${toStr(Array.from(new TextEncoder().encode(o.name)))}\0` : '';
  const comment = o.charset ? `${o.charset}\0` : '';
  return header + name + comment + body + trailer;
}

/** Which format these bytes are (by their magic number), or null. */
export function formatOf(bytes: string): Format | null {
  if (bytes.startsWith('\x1f\x8b')) return 'gzip';
  if (bytes.startsWith('BZh')) return 'bzip2';
  if (bytes.startsWith('\xfd7zXZ\x00')) return 'xz';
  return null;
}

/** Reads compressed bytes back; null if they are not in this format (or damaged). */
export function unpack(bytes: string, format?: Format): Unpacked | null {
  const f = formatOf(bytes);
  if (!f || (format && f !== format) || bytes.length < 12) return null;
  let at: number;
  let name: string | undefined;
  let mtime = 0;
  let xfl = 0;
  let charset: 'latin1' | 'binary' | undefined;
  if (f === 'gzip') {
    const flags = bytes.charCodeAt(3);
    mtime = read32(bytes, 4);
    xfl = bytes.charCodeAt(8);
    at = 10;
    if (flags & 8) {
      const end = bytes.indexOf('\0', at);
      if (end < 0) return null;
      name = new TextDecoder().decode(Uint8Array.from(bytes.slice(at, end), (c) => c.charCodeAt(0)));
      at = end + 1;
    }
    if (flags & 16) {
      const end = bytes.indexOf('\0', at);
      if (end < 0) return null;
      const c = bytes.slice(at, end);
      charset = c === 'latin1' || c === 'binary' ? c : undefined;
      at = end + 1;
    }
  } else {
    at = MAGIC[f].length;
    const c = bytes[at++];
    charset = c === 'B' ? 'binary' : c === 'L' ? 'latin1' : undefined;
  }
  const body = bytes.slice(at, bytes.length - 8);
  if (body.length < 0) return null;
  const raw = scramble(Array.from(body, (c) => c.charCodeAt(0)));
  const crc = read32(bytes, bytes.length - 8);
  if (crc32(raw) !== crc) return null;
  const text = charset ? toStr(raw) : new TextDecoder().decode(Uint8Array.from(raw));
  return { format: f, name, mtime, xfl, text, charset, isize: read32(bytes, bytes.length - 4), crc };
}

// Names whose content is already compressed: gzip gains (almost) nothing on them.
const ALREADY = /\.(png|jpe?g|gif|webp|mp3|ogg|opus|flac|mp4|webm|mkv|zip|gz|tgz|bz2|xz|zst|pdf|tif)$/i;

/** The compressed size of `raw` bytes, as the format would write them (an estimate). */
export function packedSize(format: Format, raw: number, o: { name?: string; level?: number; already?: boolean } = {}): number {
  const ratio = o.already ? 1.001 : format === 'gzip' ? (o.level ?? 6) >= 6 ? 0.3 : (o.level ?? 6) >= 2 ? 0.34 : 0.4 : format === 'bzip2' ? 0.26 : 0.27;
  const data = raw < 64 ? raw + 2 : Math.round(64 + (raw - 64) * ratio);
  if (format === 'gzip') return 18 + (o.name ? new TextEncoder().encode(o.name).length + 1 : 0) + data;
  return format === 'bzip2' ? 40 + data : 60 + data;
}

/** A compressed file for a story's world: `text` once decompressed, `size` its original size. */
export function packedFile(format: Format, text: string, o: { name?: string; mtime?: number; size?: number; level?: number } & Omit<Partial<File>, 'size'> = {}): File {
  const { name, mtime, size, level, ...rest } = o;
  const raw = size ?? new TextEncoder().encode(text).length;
  return {
    type: 'file',
    ...rest,
    content: pack(format, text, { name, mtime, level, isize: raw }),
    charset: 'binary',
    size: packedSize(format, raw, { name, level }),
    ...(mtime !== undefined ? { mtime } : {}),
  };
}

export const alreadyCompressed = (name: string) => ALREADY.test(name);

// ——— zip archives ———

export interface ZipEntry {
  name: string;
  // A directory's name ends with /; it has no text.
  text: string;
  charset?: 'latin1' | 'binary';
  mode?: string;
  mtime?: number;
  // The original size, when the text stands for a bigger file.
  size?: number;
}

/** A zip archive's bytes: its entries, scrambled after "PK\x03\x04". */
export const zipBytes = (entries: ZipEntry[]) => {
  const json = Array.from(new TextEncoder().encode(JSON.stringify(entries)));
  return `PK\x03\x04${toStr(scramble(json))}${str(le32(crc32(json)))}`;
};

/** A zip archive's entries, or null if these bytes are no zip archive. */
export function zipEntries(bytes: string): ZipEntry[] | null {
  if (!bytes.startsWith('PK\x03\x04') || bytes.length < 8) return null;
  const raw = scramble(Array.from(bytes.slice(4, -4), (c) => c.charCodeAt(0)));
  if (crc32(raw) !== read32(bytes, bytes.length - 4)) return null;
  try {
    return JSON.parse(new TextDecoder().decode(Uint8Array.from(raw))) as ZipEntry[];
  } catch {
    return null;
  }
}
