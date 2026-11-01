// Taking your progress from one machine to another (one computer lab, then
// another), without an account and without a server:
//   - a short code, to copy by hand (QDS-XXXX-XXXX): the finished chapters,
//     nothing else, with a checksum against typos;
//   - a file, the browser's whole save (notebook, keys created…).
// Neither one is a proof: they can be copied and modified.

import { STORIES } from './chapters';
import { ACHIEVEMENTS } from './achievements';

// The order of the chapters in the short code. Only ever add to it, at the
// end: a code given yesterday must stay valid tomorrow (tests/progress.test.ts).
export const CODE_ORDER = [
  'lighthouse', 'village', 'root', 'backup',
  'first-day', 'second-day', 'reboot-night', 'fire', 'certificate',
  'lost-packet',
  'manuscript',
  'archives', 'versions',
  'shut-the-door', 'firewall', 'sentinel', 'sharing', 'works-for-me', 'concert', 'port', 'repeat-offenders',
  'update', 'compose', 'firewall-hole', 'full-powers',
  'bare-repo', 'rollback', 'blue-green', 'canary', 'migration',
  'ransom', 'snapshots', 'database',
  'full-disk', 'memory', 'inodes', 'clock', 'probe', 'post-mortem', 'bottleneck',
  'keys', 'jump', 'tunnel', 'transfers', 'web-host',
  'departure', 'shared-rights', 'secret', 'proxy', 'updates', 'auto-updates',
  'vlan', 'dhcp', 'zones', 'remote-work', 'dmz', 'annex', 'directory', 'wifi',
  'report', 'exposure', 'traces',
  'scope', 'follow-up',
  'tired-disk', 'new-disk', 'more-room', 'stuck-boot',
  'bulletin', 'priority', 'fix', 'proof', 'routine',
  'repair-cafe',
  'postman', 'signature', 'policy',
  'inventory', 'playbook', 'rehearsal',
  'padlock',
  'boot-order', 'restart-loop', 'slow-boot',
];

// Crockford's Base32: no I, L, O nor U, which would be confused when copying.
const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
const VERSION = 1;

// CRC-8 (polynomial 0x07): a typo changes the checksum.
function crc8(bytes: number[]): number {
  let crc = 0;
  for (const o of bytes) {
    crc ^= o;
    for (let i = 0; i < 8; i++) crc = crc & 0x80 ? ((crc << 1) ^ 0x07) & 0xff : (crc << 1) & 0xff;
  }
  return crc;
}

function toBase32(bytes: number[]): string {
  let bits = 0;
  let value = 0;
  let output = '';
  for (const o of bytes) {
    value = (value << 8) | o;
    bits += 8;
    while (bits >= 5) {
      output += ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) output += ALPHABET[(value << (5 - bits)) & 31];
  return output;
}

function sinceBase32(text: string): number[] | null {
  let bits = 0;
  let value = 0;
  const bytes: number[] = [];
  for (const c of text) {
    const i = ALPHABET.indexOf(c);
    if (i < 0) return null;
    value = ((value << 5) | i) & 0xffff;
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return bytes;
}

/** The short code of the finished chapters: QDS-XXXX-XXXX… */
export function progressCode(finished: string[]): string {
  const cases: number[] = [];
  CODE_ORDER.forEach((id, i) => {
    if (finished.includes(id)) cases[i >> 3] = (cases[i >> 3] ?? 0) | (1 << (i & 7));
  });
  const bytes = [VERSION, ...Array.from(cases, (o) => o ?? 0)];
  const groups = toBase32([...bytes, crc8(bytes)]).match(/.{1,4}/g)!;
  return ['QDS', ...groups].join('-');
}

export type CodeError = 'code-unreadable' | 'code-mistake' | 'code-too-recent';

/** The finished chapters of a code, or what is wrong. Tolerates lower case, spaces, O for 0, I and L for 1. */
export function readCode(code: string): { finished: string[] } | { error: CodeError } {
  const net = code
    .toUpperCase()
    .replace(/[\s-]/g, '')
    .replace(/^QDS/, '')
    .replace(/O/g, '0')
    .replace(/[IL]/g, '1');
  const bytes = net.length >= 4 ? sinceBase32(net) : null;
  if (!bytes || bytes.length < 2) return { error: 'code-unreadable' };
  // The last padding bits of base32 do not make a byte: the checksum is the last whole byte.
  const sum = bytes.at(-1)!;
  const data = bytes.slice(0, -1);
  if (crc8(data) !== sum) return { error: 'code-mistake' };
  if (data[0] !== VERSION) return { error: 'code-too-recent' };
  const finished: string[] = [];
  data.slice(1).forEach((o, j) => {
    for (let b = 0; b < 8; b++)
      if (o & (1 << b)) {
        const id = CODE_ORDER[j * 8 + b];
        if (!id) return;
        finished.push(id);
      }
  });
  // A chapter beyond the list: the code comes from a newer version of the game.
  const cases = data.slice(1).reduce((n, o) => n + o.toString(2).replace(/0/g, '').length, 0);
  if (cases !== finished.length) return { error: 'code-too-recent' };
  return { finished };
}

// ——— The file ———

export interface Backup {
  finished?: string[];
  story?: string | null;
  known?: string;
  ssh?: { files: Record<string, string>; phrases?: Record<string, string> };
  notebook?: Record<string, { line: string; chapter: string }>;
  exam?: boolean;
  records?: Record<string, number>;
  // The (optional) name put at the top of the notebook: "Notebook of …".
  name?: string;
  // The achievements earned (see achievements.ts): identifier → date (ISO).
  achievements?: Record<string, string>;
}

const FORMAT = 'quetes-de-sysadmin';

/** The save file: the browser's save, dated. */
export const backupFile = (s: Backup, date: Date) =>
  JSON.stringify({ format: FORMAT, version: VERSION, date: date.toISOString(), backup: s }, null, 2);

const string = (x: unknown): x is string => typeof x === 'string';
const dictionary = (x: unknown): x is Record<string, unknown> => !!x && typeof x === 'object' && !Array.isArray(x);
const strings = (x: unknown) => (dictionary(x) ? Object.fromEntries(Object.entries(x).filter(([, v]) => string(v))) as Record<string, string> : undefined);

export type FileError = 'file-unreadable' | 'file-other' | 'file-too-recent';

/** A file's save, cleaned (only what the game knows is kept), or what is wrong. */
export function readFile(text: string): { backup: Backup } | { error: FileError } {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { error: 'file-unreadable' };
  }
  if (!dictionary(raw) || raw.format !== FORMAT || !dictionary(raw.backup)) return { error: 'file-other' };
  if (typeof raw.version !== 'number' || raw.version > VERSION) return { error: 'file-too-recent' };
  const s = raw.backup;
  const chapters = new Set(STORIES.flatMap((h) => h.chapters.map((c) => c.id)));
  const stories = new Set(STORIES.map((h) => h.id));
  const ssh = dictionary(s.ssh) ? { files: strings(s.ssh.files) ?? {}, phrases: strings(s.ssh.phrases) } : undefined;
  const notebook = dictionary(s.notebook)
    ? Object.fromEntries(
        Object.entries(s.notebook)
          .filter(([, e]) => dictionary(e) && string(e.line) && string(e.chapter))
          .map(([n, e]) => [n, { line: (e as { line: string }).line, chapter: (e as { chapter: string }).chapter }]),
      )
    : undefined;
  const records = dictionary(s.records)
    ? (Object.fromEntries(Object.entries(s.records).filter(([id, ms]) => chapters.has(id) && typeof ms === 'number' && ms > 0)) as Record<string, number>)
    : undefined;
  return {
    backup: {
      finished: Array.isArray(s.finished) ? s.finished.filter((id): id is string => string(id) && chapters.has(id)) : [],
      story: string(s.story) && stories.has(s.story) ? s.story : null,
      ...(string(s.known) ? { known: s.known } : {}),
      ...(ssh ? { ssh } : {}),
      ...(notebook ? { notebook } : {}),
      exam: s.exam === true,
      ...(records ? { records } : {}),
      ...(string(s.name) && s.name.trim() ? { name: cleanName(s.name) } : {}),
      ...(dictionary(s.achievements)
        ? { achievements: Object.fromEntries(Object.entries(s.achievements).filter(([id, date]) => ACHIEVEMENTS.some((x) => x.id === id) && string(date))) as Record<string, string> }
        : {}),
    },
  };
}

/** A name for the notebook: one line, without control characters, 60 characters at most. */
export const cleanName = (name: string) =>
  name
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 60);
