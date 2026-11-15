// A machine's gpg (GnuPG): a keyring (state.gpg.keyring) and the encrypted
// or signed files it makes and reads. The chapter seeds the keyring and,
// for the player's secret key, its passphrase (state.gpg.passphrase).
// Based on https://www.gnupg.org/documentation/manuals/gnupg/ (gpg(1)).
// Simplification: the cryptography is SIMULATED, not real. An "encrypted"
// file keeps its plaintext in the node's `crypto` field and shows opaque
// PGP armour; a signature records who signed and a digest of the content.
// So gpg here teaches the workflow (encrypt a backup, verify a release),
// not real secrecy — nothing is actually protected at rest.

import type { Shell } from './shell';
import type { CryptoBlob, File } from './world';
import { base64, condensed } from './machines';

export interface GpgKey {
  // 40 hex characters; the key id is its last 16, the short id its last 8.
  fingerprint: string;
  uid: string; // "Name <email>"
  created: string; // YYYY-MM-DD
  algo: string; // e.g. "ed25519", "rsa4096"
  // true when the machine also holds the private key (listed by -K).
  secret?: boolean;
}

export interface GpgState {
  keyring: GpgKey[];
  // The passphrase protecting the player's secret key (undefined: none).
  passphrase?: string;
}

export const gpg = (j: Shell): GpgState => (j.state.gpg ??= { keyring: [] });
export const keyId = (k: GpgKey) => k.fingerprint.slice(-16);
export const shortId = (k: GpgKey) => k.fingerprint.slice(-8);
export const spacedFingerprint = (f: string) => (f.match(/.{1,4}/g) ?? []).join(' ');

/** A key matched by a name, an email, a key id or a fingerprint (as -r / -u accept). */
export function findKey(j: Shell, who: string): GpgKey | undefined {
  const q = who.toLowerCase().replace(/\s+/g, '');
  return gpg(j).keyring.find((k) => {
    const f = k.fingerprint.toLowerCase();
    return f === q || f.endsWith(q) || k.uid.toLowerCase().includes(who.toLowerCase());
  });
}

/** PGP armour: opaque base64 lines between the BEGIN/END markers. */
export function armour(kind: string, seed: string): string {
  const body = (base64(condensed(seed) + kind, 180).match(/.{1,64}/g) ?? []).join('\n');
  return `-----BEGIN PGP ${kind}-----\n\n${body}\n=${base64(seed + kind, 4)}\n-----END PGP ${kind}-----\n`;
}

/** A deterministic digest of a file's content (not a real hash). */
export const digest = (text: string) => condensed(text);

/** The File node for an encrypted or signed output (armour on screen, crypto underneath). */
export function blob(kind: string, seed: string, crypto: CryptoBlob, owner: string): File {
  return { type: 'file', content: armour(kind, seed), lines: true, owner, crypto };
}

/** The plaintext of an encrypted file, if this machine can open it, else a reason. */
export function open(j: Shell, file: File, passphrase: string | null): { data: string } | { error: string } {
  const c = file.crypto;
  if (!c || c.kind !== 'message') return { error: 'gpg: no valid OpenPGP data found.' };
  if (c.mode === 'symmetric') {
    if (passphrase === null) return { error: 'ask' };
    if (c.passDigest !== digest(passphrase)) return { error: 'gpg: decryption failed: Bad session key' };
    return { data: c.data ?? '' };
  }
  // Public-key: we must hold a secret key that is one of the recipients.
  const mine = gpg(j).keyring.filter((k) => k.secret).map(keyId);
  if (!(c.recipients ?? []).some((r) => mine.includes(r))) return { error: 'gpg: decryption failed: No secret key' };
  const pass = gpg(j).passphrase;
  if (pass !== undefined) {
    if (passphrase === null) return { error: 'ask' };
    if (passphrase !== pass) return { error: 'gpg: decryption failed: Bad passphrase' };
  }
  return { data: c.data ?? '' };
}

/** Verify a signature over `text`: Good / BAD / no public key. */
export function verify(j: Shell, sig: CryptoBlob, text: string): string {
  const key = gpg(j).keyring.find((k) => keyId(k) === sig.signer);
  if (!key) return `gpg: Can't check signature: No public key\ngpg: using ${sig.signerUid ? 'key' : ''} ${sig.signer}`.trim();
  if (sig.digest !== digest(text)) return `gpg: BAD signature from "${key.uid}"`;
  return `gpg: Good signature from "${key.uid}"`;
}
