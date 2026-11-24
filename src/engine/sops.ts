// SOPS and age, simulated: secrets kept encrypted in a git repository. age
// 1.2.1 (Debian 13's age package) and SOPS 3.10.2 (the upstream .deb from
// getsops/sops, SOPS isn't in Debian's archive).
// - age's X25519 keys: AGE-SECRET-KEY-1… identities and age1… recipients,
//   real Bech32 with its checksum (BIP 173), derived deterministically (never
//   random): the public key comes from the secret one by a hash, not by
//   Curve25519. An identity file holds "# created:", "# public key:" and the
//   secret line, as age-keygen writes it.
// - The data key (32 bytes), "wrapped" for each recipient in an armored age
//   file (-----BEGIN AGE ENCRYPTED FILE-----): its header has the real
//   format (age-encryption.org/v1, a "-> X25519" stanza, "---" and a MAC)
//   but the wrapping is a hash, not X25519 and ChaCha20-Poly1305: only the
//   identity whose recipient it names opens it.
// - The values: ENC[AES256_GCM,data:…,iv:…,tag:…,type:str], the real format
//   (a 32-byte IV, a 16-byte tag, the key's path as additional data), with
//   a keystream from SHA-256 in place of AES-GCM: a value edited by hand
//   fails its tag, one moved to another key too.
// - The MAC: 128 hexadecimal digits over the values in order (SHA-512 in
//   SOPS; here two SHA-256), encrypted with the last modification date as
//   additional data, like SOPS: a line removed, or an unencrypted value
//   changed, gives "MAC mismatch".
// - The dotenv store (a .env file: KEY=value lines, # comments, the
//   metadata as sops_… lines, flattened like stores/flatten.go), the
//   creation rules of .sops.yaml (path_regex relative to the file's
//   directory, age, key_groups, encrypted_regex, unencrypted_regex,
//   encrypted_suffix, unencrypted_suffix), found from the current
//   directory upwards.
// Sources: https://getsops.io/docs/, https://age-encryption.org/v1,
// https://github.com/getsops/sops/tree/v3.10.2 (stores/dotenv/store.go,
// stores/flatten.go, aes/cipher.go, sops.go, config/config.go,
// usererrors.go, cmd/sops/codes/codes.go), https://github.com/FiloSottile/age
// (v1.2.1: cmd/age-keygen/keygen.go, x25519.go, internal/bech32).

import { sha256 } from './commands/checksums';
import type { Shell } from './shell';
import { systemd } from './systemd';

export const SOPS_VERSION = '3.10.2';
export const AGE_VERSION = '1.2.1';

// ——— Bytes ———

const utf8 = (s: string) => new TextEncoder().encode(s);
const fromUtf8 = (b: Uint8Array) => new TextDecoder().decode(b);
const hexBytes = (hex: string) => Uint8Array.from(hex.match(/../g)!.map((x) => parseInt(x, 16)));
const toHex = (b: Uint8Array) => [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
/** SHA-256 of a text, as bytes. */
const digest = (s: string) => hexBytes(sha256(utf8(s)));

export function b64(bytes: Uint8Array, padding = true): string {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  const s = btoa(bin);
  return padding ? s : s.replace(/=+$/, '');
}
export function unb64(s: string): Uint8Array | null {
  try {
    const t = s.replace(/\s/g, '');
    const padded = t + '='.repeat((4 - (t.length % 4)) % 4);
    return Uint8Array.from(atob(padded), (c) => c.charCodeAt(0));
  } catch {
    return null;
  }
}

/** n bytes derived from a seed (SHA-256 in counter mode). */
function stream(seed: string, n: number): Uint8Array {
  const out = new Uint8Array(n);
  for (let i = 0, block = 0; i < n; block++) {
    const d = digest(`${seed}#${block}`);
    for (let j = 0; j < d.length && i < n; j++) out[i++] = d[j];
  }
  return out;
}

// ——— Bech32 (BIP 173), as age's internal/bech32 ———

const CHARSET = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l';
const GEN = [0x3b6a57b2, 0x26508e6d, 0x1ea119fa, 0x3d4233dd, 0x2a1462b3];
function polymod(values: number[]): number {
  let chk = 1;
  for (const v of values) {
    const top = chk >>> 25;
    chk = ((chk & 0x1ffffff) << 5) ^ v;
    for (let i = 0; i < 5; i++) if ((top >>> i) & 1) chk ^= GEN[i];
  }
  return chk >>> 0;
}
const hrpExpand = (hrp: string) => [...[...hrp].map((c) => c.charCodeAt(0) >> 5), 0, ...[...hrp].map((c) => c.charCodeAt(0) & 31)];
function convert(data: number[], from: number, to: number, pad: boolean): number[] | null {
  let acc = 0;
  let bits = 0;
  const out: number[] = [];
  const max = (1 << to) - 1;
  for (const v of data) {
    acc = (acc << from) | v;
    bits += from;
    while (bits >= to) {
      bits -= to;
      out.push((acc >> bits) & max);
    }
  }
  if (pad) {
    if (bits > 0) out.push((acc << (to - bits)) & max);
  } else if (bits >= from || ((acc << (to - bits)) & max) !== 0) return null;
  return out;
}
export function bech32Encode(hrp: string, bytes: Uint8Array): string {
  const data = convert([...bytes], 8, 5, true)!;
  const mod = polymod([...hrpExpand(hrp), ...data, 0, 0, 0, 0, 0, 0]) ^ 1;
  const checksum = Array.from({ length: 6 }, (_, i) => (mod >> (5 * (5 - i))) & 31);
  return `${hrp}1${[...data, ...checksum].map((d) => CHARSET[d]).join('')}`;
}
/** Decodes Bech32; an error like age's (internal/bech32). */
export function bech32Decode(s: string): { hrp: string; bytes: Uint8Array } | { error: string } {
  if (s.toLowerCase() !== s && s.toUpperCase() !== s) return { error: 'mixed case' };
  const low = s.toLowerCase();
  const pos = low.lastIndexOf('1');
  if (pos < 1 || pos + 7 > low.length) return { error: `separator '1' at invalid position: pos=${pos}, len=${low.length}` };
  const hrp = low.slice(0, pos);
  const data: number[] = [];
  for (let p = pos + 1; p < low.length; p++) {
    const d = CHARSET.indexOf(low[p]);
    if (d < 0) return { error: `invalid character data part: s[${p}]=${low[p]}` };
    data.push(d);
  }
  if (polymod([...hrpExpand(hrp), ...data]) !== 1) return { error: 'invalid checksum' };
  const bytes = convert(data.slice(0, -6), 5, 8, false);
  if (!bytes) return { error: 'non-zero padding' };
  return { hrp, bytes: Uint8Array.from(bytes) };
}

// ——— age keys ———

export interface AgeKey {
  secret: string;
  public: string;
}

/** The recipient of a secret key's bytes (here a hash, not X25519). */
const recipientOf = (secret: Uint8Array) => bech32Encode('age', digest(`x25519:${toHex(secret)}`));

/** A key pair from a seed: always the same for the same seed. */
export function ageKey(seed: string): AgeKey {
  const bytes = digest(`age-keygen:${seed}`);
  return { secret: bech32Encode('age-secret-key-', bytes).toUpperCase(), public: recipientOf(bytes) };
}

/** The identity file age-keygen writes. */
export const identityFile = (k: AgeKey, created: string) => `# created: ${created}\n# public key: ${k.public}\n${k.secret}\n`;

/** A recipient, checked like age.ParseX25519Recipient. */
export function parseRecipient(s: string): string | { error: string } {
  const r = bech32Decode(s);
  if ('error' in r) return { error: `malformed recipient "${s}": ${r.error}` };
  if (r.hrp !== 'age') return { error: `malformed recipient "${s}": invalid type "${r.hrp}"` };
  if (r.bytes.length !== 32) return { error: `malformed recipient "${s}": invalid X25519 public key` };
  return s;
}

/** The identities of an identity file (age.ParseIdentities): their recipients. */
export function parseIdentities(text: string): { recipients: string[]; secrets: string[] } | { error: string } {
  const recipients: string[] = [];
  const secrets: string[] = [];
  const lines = text.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i].trim();
    if (!l || l.startsWith('#')) continue;
    const r = bech32Decode(l);
    if ('error' in r) return { error: `error at line ${i + 1}: malformed secret key: ${r.error}` };
    if (r.hrp !== 'age-secret-key-') return { error: `error at line ${i + 1}: malformed secret key: unknown type "${r.hrp}"` };
    recipients.push(recipientOf(r.bytes));
    secrets.push(l);
  }
  if (!recipients.length) return { error: 'no secret keys found' };
  return { recipients, secrets };
}

// ——— The data key, wrapped for each recipient ———

const ARMOR_BEGIN = '-----BEGIN AGE ENCRYPTED FILE-----';
const ARMOR_END = '-----END AGE ENCRYPTED FILE-----';

/** The data key encrypted for a recipient, as SOPS stores it (an armored age file). */
export function wrapKey(dataKey: Uint8Array, recipient: string, seed: string): string {
  const eph = b64(stream(`eph:${seed}:${recipient}`, 32), false);
  const pad = digest(`wrap:${recipient}:${eph}`);
  const body = b64(dataKey.map((b, i) => b ^ pad[i]), false);
  const mac = b64(digest(`mac:${recipient}:${toHex(dataKey)}:${eph}`), false);
  const header = utf8(`age-encryption.org/v1\n-> X25519 ${eph}\n${body}\n--- ${mac}\n`);
  const payload = stream(`payload:${seed}:${recipient}`, 64);
  const all = new Uint8Array(header.length + payload.length);
  all.set(header);
  all.set(payload, header.length);
  const text = b64(all);
  const lines = text.match(/.{1,64}/g)!;
  return `${ARMOR_BEGIN}\n${lines.join('\n')}\n${ARMOR_END}\n`;
}

/** The data key from an armored age file, with one of these recipients' identities; null if none matches. */
export function unwrapKey(armored: string, recipients: string[]): Uint8Array | null {
  const inside = armored.replace(ARMOR_BEGIN, '').replace(ARMOR_END, '');
  const bytes = unb64(inside);
  if (!bytes) return null;
  let text = '';
  for (const b of bytes) text += String.fromCharCode(b);
  const m = /^age-encryption\.org\/v1\n-> X25519 (\S+)\n(\S+)\n--- (\S+)\n/.exec(text);
  if (!m) return null;
  for (const r of recipients) {
    const pad = digest(`wrap:${r}:${m[1]}`);
    const body = unb64(m[2]);
    if (!body || body.length !== 32) continue;
    const key = body.map((b, i) => b ^ pad[i]);
    if (b64(digest(`mac:${r}:${toHex(key)}:${m[1]}`), false) === m[3]) return key;
  }
  return null;
}

// ——— Values: ENC[AES256_GCM,…] ———

const ENC = /^ENC\[AES256_GCM,data:(.+),iv:(.+),tag:(.+),type:(.+)\]/;

export function encryptValue(plain: string, key: Uint8Array, aad: string, type = 'str', seed = ''): string {
  if (plain === '') return '';
  const data = utf8(plain);
  const iv = stream(`iv:${toHex(key)}:${aad}:${plain}:${seed}`, 32);
  const ks = stream(`ks:${toHex(key)}:${toHex(iv)}:${aad}`, data.length);
  const cipher = data.map((b, i) => b ^ ks[i]);
  const tag = digest(`tag:${toHex(key)}:${toHex(iv)}:${toHex(cipher)}:${aad}`).slice(0, 16);
  return `ENC[AES256_GCM,data:${b64(cipher)},iv:${b64(iv)},tag:${b64(tag)},type:${type}]`;
}

/** A value decrypted, or the error aes/cipher.go gives. */
export function decryptValue(value: string, key: Uint8Array, aad: string): { plain: string; type: string } | { error: string } {
  if (value === '') return { plain: '', type: 'str' };
  const m = ENC.exec(value);
  if (!m) return { error: `Input string ${value} does not match sops' data format` };
  const data = unb64(m[1]);
  if (!data) return { error: 'Error base64-decoding data: illegal base64 data at input byte 0' };
  const iv = unb64(m[2]);
  if (!iv) return { error: 'Error base64-decoding iv: illegal base64 data at input byte 0' };
  const tag = unb64(m[3]);
  if (!tag) return { error: 'Error base64-decoding tag: illegal base64 data at input byte 0' };
  const want = digest(`tag:${toHex(key)}:${toHex(iv)}:${toHex(data)}:${aad}`).slice(0, 16);
  if (toHex(want) !== toHex(tag)) return { error: 'Could not decrypt with AES_GCM: cipher: message authentication failed' };
  const ks = stream(`ks:${toHex(key)}:${toHex(iv)}:${aad}`, data.length);
  return { plain: fromUtf8(data.map((b, i) => b ^ ks[i])), type: m[4] };
}

/** The MAC of the values, as SOPS computes it (128 hexadecimal digits, upper case). */
export const macOf = (values: string[]) => {
  const joined = values.join('');
  return (sha256(utf8(`sha512a:${joined}`)) + sha256(utf8(`sha512b:${joined}`))).toUpperCase();
};

// ——— The dotenv store ———

export interface Item {
  key: string;
  value: string;
  comment?: boolean;
}

export interface Metadata {
  recipients: { recipient: string; enc: string }[];
  lastModified: string;
  mac: string;
  unencryptedSuffix?: string;
  encryptedSuffix?: string;
  unencryptedRegex?: string;
  encryptedRegex?: string;
  version: string;
}

/** A dotenv file's lines (stores/dotenv LoadPlainFile); an error for a line without "=". */
export function readDotenv(text: string): Item[] | { error: string } {
  const items: Item[] = [];
  for (const line of text.split('\n')) {
    if (!line) continue;
    if (line.startsWith('#')) items.push({ key: '', value: line.slice(1), comment: true });
    else {
      const pos = line.indexOf('=');
      if (pos < 0) return { error: `invalid dotenv input line: ${line}` };
      items.push({ key: line.slice(0, pos), value: line.slice(pos + 1).replace(/\\n/g, '\n') });
    }
  }
  return items;
}

export const emitDotenv = (items: Item[]) => items.map((i) => (i.comment ? `#${i.value}\n` : `${i.key}=${i.value.replace(/\n/g, '\\n')}\n`)).join('');

const SOPS_PREFIX = 'sops_';

/** Splits a dotenv file into its items and its metadata (still flat). */
export function splitMetadata(items: Item[]): { items: Item[]; flat: Record<string, string> } {
  const flat: Record<string, string> = {};
  const rest: Item[] = [];
  for (const i of items) {
    if (!i.comment && i.key.startsWith(SOPS_PREFIX)) flat[i.key.slice(SOPS_PREFIX.length)] = i.value;
    else rest.push(i);
  }
  return { items: rest, flat };
}

/** The metadata of a flat map (UnflattenMetadata, then ToInternal); an error like Go's when it's missing. */
export function readMetadata(flat: Record<string, string>): Metadata | { error: string } {
  const last = flat.lastmodified ?? '';
  if (!/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(\.\d+)?(Z|[+-]\d\d:\d\d)$/.test(last))
    return { error: `parsing time "${last}" as "2006-01-02T15:04:05Z07:00": cannot parse "${last}" as "2006"` };
  const recipients: Metadata['recipients'] = [];
  for (let n = 0; `age__list_${n}__map_recipient` in flat || `age__list_${n}__map_enc` in flat; n++)
    recipients.push({ recipient: flat[`age__list_${n}__map_recipient`] ?? '', enc: flat[`age__list_${n}__map_enc`] ?? '' });
  return {
    recipients,
    lastModified: last,
    mac: flat.mac ?? '',
    unencryptedSuffix: flat.unencrypted_suffix,
    encryptedSuffix: flat.encrypted_suffix,
    unencryptedRegex: flat.unencrypted_regex,
    encryptedRegex: flat.encrypted_regex,
    version: flat.version ?? '',
  };
}

/** The metadata as sops_… lines, in Go's sorted order (FlattenMetadata, EncodeNewLines). */
export function metadataItems(m: Metadata): Item[] {
  const flat: Record<string, string> = {};
  m.recipients.forEach((r, n) => {
    flat[`age__list_${n}__map_enc`] = r.enc;
    flat[`age__list_${n}__map_recipient`] = r.recipient;
  });
  flat.lastmodified = m.lastModified;
  flat.mac = m.mac;
  if (m.unencryptedSuffix) flat.unencrypted_suffix = m.unencryptedSuffix;
  if (m.encryptedSuffix) flat.encrypted_suffix = m.encryptedSuffix;
  if (m.unencryptedRegex) flat.unencrypted_regex = m.unencryptedRegex;
  if (m.encryptedRegex) flat.encrypted_regex = m.encryptedRegex;
  flat.version = m.version;
  return Object.keys(flat)
    .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))
    .map((k) => ({ key: SOPS_PREFIX + k, value: flat[k] }));
}

export interface Rules {
  unencryptedSuffix?: string;
  encryptedSuffix?: string;
  unencryptedRegex?: string;
  encryptedRegex?: string;
}

/** Is this item encrypted (Tree.shouldBeEncrypted, with a dotenv file's one-level paths)? */
export function shouldBeEncrypted(i: Item, r: Rules): boolean {
  const path = i.comment ? [] : [i.key];
  let encrypted = true;
  if (r.unencryptedSuffix && path.some((p) => p.endsWith(r.unencryptedSuffix!))) encrypted = false;
  if (r.encryptedSuffix) encrypted = path.some((p) => p.endsWith(r.encryptedSuffix!));
  if (r.unencryptedRegex && path.some((p) => goRegex(r.unencryptedRegex!)?.test(p))) encrypted = false;
  if (r.encryptedRegex) encrypted = path.some((p) => goRegex(r.encryptedRegex!)?.test(p));
  return encrypted;
}

/** A Go (RE2) regular expression, read by JavaScript: the common subset. */
export function goRegex(s: string): RegExp | null {
  try {
    return new RegExp(s.replace(/^\(\?i\)/, ''), s.startsWith('(?i)') ? 'i' : '');
  } catch {
    return null;
  }
}

// ——— A whole file ———

export interface Opened {
  items: Item[];
  metadata: Metadata;
}

/** A file's items and metadata, before decryption. */
export function openFile(text: string): Opened | { error: string; code: number } {
  const items = readDotenv(text);
  if ('error' in items) return { error: `Error unmarshalling input file: ${items.error}`, code: 1 };
  const { items: rest, flat } = splitMetadata(items);
  const m = readMetadata(flat);
  if ('error' in m) return { error: m.error, code: 1 };
  return { items: rest, metadata: m };
}

/** Is this text a SOPS file (dotenv with its metadata)? */
export const isSopsFile = (text: string | null) => !!text && !('error' in openFile(text));

const wrap = (text: string, width: number) =>
  text
    .split('\n')
    .map((para) => {
      const out: string[] = [];
      let line = '';
      for (const word of para.split(' ')) {
        if (line && (line + ' ' + word).length > width) {
          out.push(line);
          line = word;
        } else line = line ? `${line} ${word}` : word;
      }
      out.push(line);
      return out.join('\n');
    })
    .join('\n');
export { wrap as wordWrap };

/** What decrypting the data key prints when no identity opens it (usererrors.go). */
export function noKeyError(recipients: string[], cause: string): string {
  const keys = recipients.map((r) => {
    const msg = wrap(cause, 60)
      .split('\n')
      .map((l) => `  | ${l}`)
      .join('\n');
    const lines = ('-' + msg.slice(1)).split('\n').map((l) => `  ${l}`);
    return `${r}: FAILED\n${lines.join('\n')}`;
  });
  const group = `Group 0: FAILED\n${keys.join('\n\n').split('\n').map((l) => `  ${l}`).join('\n')}`;
  const trailer = wrap('Recovery failed because no master key was able to decrypt the file. In order for SOPS to recover the file, at least one key has to be successful, but none were.', 75);
  return `Failed to get the data key required to decrypt the SOPS file.\n\n${group}\n\n${trailer}`;
}

export interface Identities {
  recipients: string[];
  // Why none could be loaded (the file missing…), when none were.
  error?: string;
}

export interface Decrypted {
  items: Item[];
  metadata: Metadata;
  dataKey: Uint8Array;
}

/** Decrypts a whole file with these identities (DecryptTree); an error with SOPS' exit code otherwise. */
export function decryptFile(text: string, ids: Identities, ignoreMac = false): Decrypted | { error: string; code: number } {
  const o = openFile(text);
  if ('error' in o) return o;
  const m = o.metadata;
  let dataKey: Uint8Array | null = null;
  if (!ids.error) for (const r of m.recipients) dataKey ??= unwrapKey(r.enc, ids.recipients);
  if (!dataKey) {
    const cause = ids.error ? `failed to load age identities: ${ids.error}` : 'failed to create reader for decrypting sops data key with age: no identity matched any of the recipients';
    return { error: noKeyError(m.recipients.map((r) => r.recipient), cause), code: 128 };
  }
  const plain: Item[] = [];
  const macValues: string[] = [];
  for (const i of o.items) {
    if (shouldBeEncrypted(i, m)) {
      const r = decryptValue(i.value, dataKey, i.comment ? ':' : `${i.key}:`);
      if ('error' in r) {
        if (i.comment) {
          plain.push(i);
          continue;
        }
        return { error: `Error decrypting tree: Error walking tree: Could not decrypt value: ${r.error}`, code: 25 };
      }
      plain.push({ ...i, value: r.plain });
      if (!i.comment) macValues.push(r.plain);
    } else {
      plain.push(i);
      if (!i.comment) macValues.push(i.value);
    }
  }
  if (!ignoreMac) {
    const computed = macOf(macValues);
    const stored = decryptValue(m.mac, dataKey, m.lastModified);
    if ('error' in stored) return { error: `Cannot decrypt MAC: ${stored.error}`, code: 51 };
    if (stored.plain !== computed) return { error: `MAC mismatch. File has ${stored.plain || 'no MAC'}, computed ${computed}`, code: 51 };
  }
  return { items: plain, metadata: m, dataKey };
}

/** Encrypts plain items with a data key for these recipients (EncryptTree, then the keys). */
export function encryptFile(items: Item[], dataKey: Uint8Array, recipients: string[], given: Rules, lastModified: string, seed: string, keepEnc?: Metadata['recipients']): string {
  // Without any rule, SOPS uses its default: values ending in _unencrypted stay clear.
  const rules: Rules = given.unencryptedSuffix || given.encryptedSuffix || given.unencryptedRegex || given.encryptedRegex ? given : { unencryptedSuffix: '_unencrypted' };
  const macValues: string[] = [];
  const out = items.map((i, n) => {
    const enc = shouldBeEncrypted(i, rules);
    if (!i.comment) macValues.push(i.value);
    return enc ? { ...i, value: encryptValue(i.value, dataKey, i.comment ? ':' : `${i.key}:`, i.comment ? 'comment' : 'str', `${seed}:${n}`) } : i;
  });
  const m: Metadata = {
    recipients: recipients.map((r) => ({ recipient: r, enc: keepEnc?.find((k) => k.recipient === r)?.enc ?? wrapKey(dataKey, r, seed) })),
    lastModified,
    mac: encryptValue(macOf(macValues), dataKey, lastModified, 'str', `${seed}:mac`),
    ...rules,
    version: SOPS_VERSION,
  };
  return emitDotenv([...out, ...metadataItems(m)]);
}

export const rulesOf = (m: Metadata): Rules => ({
  ...(m.unencryptedSuffix ? { unencryptedSuffix: m.unencryptedSuffix } : {}),
  ...(m.encryptedSuffix ? { encryptedSuffix: m.encryptedSuffix } : {}),
  ...(m.unencryptedRegex ? { unencryptedRegex: m.unencryptedRegex } : {}),
  ...(m.encryptedRegex ? { encryptedRegex: m.encryptedRegex } : {}),
});

// ——— .sops.yaml ———

export interface CreationRule extends Rules {
  pathRegex?: string;
  age: string[];
}

/**
 * Reads .sops.yaml's creation_rules (a subset of YAML: a list of mappings;
 * age as a string, comma-separated, possibly folded with >- or |, or
 * key_groups with age lists). null without creation rules; an error like
 * config.go's.
 */
export function readSopsConfig(text: string): CreationRule[] | null | { error: string } {
  const lines = text.split('\n').map((l) => (/^\s*#/.test(l) ? '' : l.replace(/\s+#.*$/, '')));
  for (let n = 0; n < lines.length; n++)
    if (/^\s*\t/.test(lines[n])) return { error: `Could not unmarshal config file: yaml: line ${n + 1}: found character that cannot start any token` };
  const top = lines.findIndex((l) => /^creation_rules\s*:\s*$/.test(l));
  if (top < 0) return null;
  // The rules' lines, until the next top-level key.
  const body: { n: number; indent: number; t: string }[] = [];
  for (let n = top + 1; n < lines.length; n++) {
    if (!lines[n].trim()) continue;
    const indent = lines[n].length - lines[n].trimStart().length;
    if (indent === 0 && !lines[n].startsWith('-')) break;
    body.push({ n, indent, t: lines[n].trim() });
  }
  if (!body.length) return null;
  const dash = body[0].indent;
  const unquote = (v: string) => v.trim().replace(/^'(.*)'$|^"(.*)"$/, (_, a?: string, b?: string) => (a !== undefined ? a.replace(/''/g, "'") : (b ?? '').replace(/\\\\/g, '\\')));
  const rules: CreationRule[] = [];
  let i = 0;
  while (i < body.length) {
    const first = body[i];
    if (first.indent !== dash || !first.t.startsWith('-')) return { error: `Could not unmarshal config file: yaml: line ${first.n + 1}: did not find expected '-' indicator` };
    // The rule's lines: its "- " line, then what is more indented.
    const own = [{ ...first, indent: dash + 2, t: first.t.replace(/^-\s*/, '') }];
    i++;
    while (i < body.length && body[i].indent > dash) own.push(body[i++]);
    const rule: CreationRule = { age: [] };
    const keyIndent = own[0].indent;
    for (let k = 0; k < own.length; k++) {
      const l = own[k];
      if (l.indent !== keyIndent) continue;
      const kv = /^([\w-]+)\s*:\s*(.*)$/.exec(l.t);
      if (!kv) return { error: `Could not unmarshal config file: yaml: line ${l.n + 1}: could not find expected ':'` };
      const [, key, value] = kv;
      const deeper: string[] = [];
      for (let j = k + 1; j < own.length && own[j].indent > keyIndent; j++) deeper.push(own[j].t);
      if (key === 'path_regex') rule.pathRegex = unquote(value);
      else if (key === 'age') rule.age.push(...recipientList(/^[>|]-?$/.test(value.trim()) ? deeper.join(' ') : unquote(value)));
      else if (key === 'key_groups')
        for (const d of deeper) {
          const m = /^(?:-\s*)?(?:age\s*:\s*)?(?:-\s*)?(.*)$/.exec(d)!;
          if (/^age1/.test(unquote(m[1]))) rule.age.push(...recipientList(unquote(m[1])));
        }
      else if (key === 'encrypted_regex') rule.encryptedRegex = unquote(value);
      else if (key === 'unencrypted_regex') rule.unencryptedRegex = unquote(value);
      else if (key === 'encrypted_suffix') rule.encryptedSuffix = unquote(value);
      else if (key === 'unencrypted_suffix') rule.unencryptedSuffix = unquote(value);
    }
    if ([rule.encryptedRegex, rule.unencryptedRegex, rule.encryptedSuffix, rule.unencryptedSuffix].filter(Boolean).length > 1)
      return { error: 'error loading config: cannot use more than one of encrypted_suffix, unencrypted_suffix, encrypted_regex, unencrypted_regex, encrypted_comment_regex, or unencrypted_comment_regex for the same rule' };
    rules.push(rule);
  }
  return rules;
}

const recipientList = (s: string) =>
  s
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean);

/** The .sops.yaml SOPS uses from a directory: there or in a parent (config.LookupConfigFile). */
export function findConfig(game: Shell, from: string): string | null {
  let dir = from;
  for (let depth = 0; depth < 100; depth++) {
    const p = `${dir === '/' ? '' : dir}/.sops.yaml`;
    if (game.find(p)?.type === 'file') return p;
    if (dir === '/') return null;
    dir = dir.replace(/\/[^/]+$/, '') || '/';
  }
  return null;
}

/** The creation rule for a file (parseCreationRuleForFile): its path relative to the config's directory. */
export function ruleFor(rules: CreationRule[], configPath: string, file: string): CreationRule | null {
  const dir = configPath.replace(/\/[^/]+$/, '') || '/';
  const rel = file.startsWith(`${dir}/`) ? file.slice(dir.length + 1) : file;
  for (const r of rules) {
    if (!r.pathRegex) return r;
    const re = goRegex(r.pathRegex);
    if (re?.test(rel)) return r;
  }
  return null;
}

// ——— The game's state: what makes each generation different ———

export interface SopsState {
  seq: number;
}
export const sopsState = (game: Shell): SopsState => (game.state.sops ??= { seq: 0 });
export const nextSeed = (game: Shell, what: string) => `${game.hostName}:${what}:${++sopsState(game).seq}`;

/** RFC 3339 in UTC, from the machine's clock. */
export function rfc3339(game: Shell): string {
  const t = systemd(game)?.clock ?? 0;
  return new Date(t).toISOString().replace(/\.\d+Z$/, 'Z');
}
/** A new data key, never the same twice. */
export const newDataKey = (game: Shell, path: string) => digest(`datakey:${nextSeed(game, path)}:${rfc3339(game)}`);
