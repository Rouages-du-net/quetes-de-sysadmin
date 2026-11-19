// sha256sum (GNU coreutils 9.x): a file's SHA-256 digest, and checking a
// list of digests (-c), the way a restore is compared with what was backed
// up. After https://www.gnu.org/software/coreutils/manual/html_node/sha2-utilities.html
// and FIPS 180-4 for the hash itself (computed for real, on the file's bytes).
// Difference: a file the game only describes by its size (a big archive
// without content) is hashed on its description (content and size), so two
// such files with the same description have the same digest.

import type { File } from '../world';
import type { Shell } from '../shell';
import type { Command } from './index';
import { content } from '../tools';

const K = [
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe,
  0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da, 0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7,
  0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b,
  0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070, 0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
];

/** The SHA-256 of some bytes, in hexadecimal. */
export function sha256(bytes: Uint8Array): string {
  const h = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19];
  const length = bytes.length;
  const padded = new Uint8Array(Math.ceil((length + 9) / 64) * 64);
  padded.set(bytes);
  padded[length] = 0x80;
  const view = new DataView(padded.buffer);
  view.setUint32(padded.length - 8, Math.floor((length * 8) / 2 ** 32));
  view.setUint32(padded.length - 4, (length * 8) >>> 0);
  const w = new Uint32Array(64);
  const rotr = (x: number, n: number) => (x >>> n) | (x << (32 - n));
  for (let o = 0; o < padded.length; o += 64) {
    for (let i = 0; i < 16; i++) w[i] = view.getUint32(o + i * 4);
    for (let i = 16; i < 64; i++) {
      const s0 = rotr(w[i - 15], 7) ^ rotr(w[i - 15], 18) ^ (w[i - 15] >>> 3);
      const s1 = rotr(w[i - 2], 17) ^ rotr(w[i - 2], 19) ^ (w[i - 2] >>> 10);
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) >>> 0;
    }
    let [a, b, c, d, e, f, g, hh] = h;
    for (let i = 0; i < 64; i++) {
      const t1 = (hh + (rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25)) + ((e & f) ^ (~e & g)) + K[i] + w[i]) >>> 0;
      const t2 = ((rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22)) + ((a & b) ^ (a & c) ^ (b & c))) >>> 0;
      hh = g;
      g = f;
      f = e;
      e = (d + t1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (t1 + t2) >>> 0;
    }
    h[0] = (h[0] + a) >>> 0;
    h[1] = (h[1] + b) >>> 0;
    h[2] = (h[2] + c) >>> 0;
    h[3] = (h[3] + d) >>> 0;
    h[4] = (h[4] + e) >>> 0;
    h[5] = (h[5] + f) >>> 0;
    h[6] = (h[6] + g) >>> 0;
    h[7] = (h[7] + hh) >>> 0;
  }
  return h.map((x) => x.toString(16).padStart(8, '0')).join('');
}

/** The bytes of a text as a file holds them: UTF-8, ending with a newline (what the game stores without it). */
export function fileBytes(text: string, binary = false): Uint8Array {
  if (binary) return Uint8Array.from([...text].map((c) => c.charCodeAt(0) & 0xff));
  return new TextEncoder().encode(text === '' ? '' : `${text}\n`);
}

/** A file's digest, as sha256sum computes it. */
export function digestOf(game: Shell, n: File): string {
  const text = content(n, game);
  if (n.size !== undefined && n.size !== new TextEncoder().encode(text).length) return sha256(new TextEncoder().encode(`${text}|${n.size}`));
  return sha256(fileBytes(text, n.charset === 'binary'));
}

function sha256sum(game: Shell, args: string[], input: string | null): string {
  const check = args.includes('-c') || args.includes('--check');
  const quiet = args.includes('--quiet');
  const silent = args.includes('--status');
  const files = args.filter((a) => !a.startsWith('-') || a === '-');
  const open = (path: string): File | string => {
    const n = game.find(path);
    if (!n) return `sha256sum: ${path}: No such file or directory`;
    if (n.type === 'directory') return `sha256sum: ${path}: Is a directory`;
    if (!game.traverses(path) || !game.can(n, 'r')) return `sha256sum: ${path}: Permission denied`;
    return n;
  };
  if (!check) {
    if (!files.length || files[0] === '-') return `${sha256(fileBytes(input ?? ''))}  -`;
    const lines: string[] = [];
    for (const path of files) {
      const n = open(path);
      if (typeof n === 'string') game.error(n, 1);
      else lines.push(`${digestOf(game, n)}  ${path}`);
    }
    return lines.join('\n');
  }
  // -c: each line "DIGEST  FILE", the file read relative to where you are.
  const list = files[0] && files[0] !== '-' ? open(files[0]) : null;
  if (typeof list === 'string') return game.error(list, 1);
  const text = list ? content(list, game) : (input ?? '');
  const out: string[] = [];
  let failed = 0;
  let unread = 0;
  let badLines = 0;
  for (const line of text.split('\n').filter((l) => l.trim())) {
    const m = /^([0-9a-fA-F]{64}) [ *](.+)$/.exec(line);
    if (!m) {
      badLines++;
      continue;
    }
    const n = open(m[2]);
    if (typeof n === 'string') {
      unread++;
      game.error(n.replace(/^sha256sum: [^:]+: /, `sha256sum: ${m[2]}: `));
      out.push(`${m[2]}: FAILED open or read`);
      continue;
    }
    const ok = digestOf(game, n) === m[1].toLowerCase();
    if (!ok) failed++;
    if (!ok || !quiet) out.push(`${m[2]}: ${ok ? 'OK' : 'FAILED'}`);
  }
  const listed = files[0] ?? '-';
  if (badLines && badLines === text.split('\n').filter((l) => l.trim()).length) return game.error(`sha256sum: ${listed}: no properly formatted checksum lines found`, 1);
  if (unread) game.error(`sha256sum: WARNING: ${unread} listed file${unread > 1 ? 's' : ''} could not be read`, 1);
  if (failed) game.error(`sha256sum: WARNING: ${failed} computed checksum${failed > 1 ? 's' : ''} did NOT match`, 1);
  if (failed || unread) game.status = 1;
  game.state.sha256Checked = [...((game.state.sha256Checked as { cwd: string; ok: number; failed: number }[] | undefined) ?? []), { cwd: game.cwd, ok: out.filter((l) => l.endsWith(': OK')).length, failed: failed + unread }];
  return silent ? '' : out.join('\n');
}

export const CHECKSUMS: Record<string, Command> = {
  sha256sum: { ownOptions: true, launch: ({ args, game, input }) => sha256sum(game, args, input) },
};
