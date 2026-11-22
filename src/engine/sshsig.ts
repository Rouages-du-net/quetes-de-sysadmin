// SSH signatures (OpenSSH's SSHSIG, `ssh-keygen -Y sign`), as git uses them
// with gpg.format = ssh, and allowed_signers files.
// https://man.openbsd.org/ssh-keygen#Y, https://github.com/openssh/openssh-portable/blob/master/PROTOCOL.sshsig,
// https://git-scm.com/docs/git-config#Documentation/git-config.txt-gpgsshallowedSignersFile
//
// The cryptography is simulated: a signature holds the signer's public key,
// the namespace and the SHA-256 of what was signed, encoded like the real
// armour (it starts with "U1NIU0lH", that is "SSHSIG"). Whoever holds the
// private key makes it (publicFor in access.ts ties both halves); checking
// compares the digest, the namespace and the key with the allowed signers.

import { base64Decode, base64Encode } from './base64';
import { sha256 } from './commands/checksums';
import { publicFor } from './access';

export interface SshSignature {
  // The signer's public key, without its comment: "ssh-ed25519 AAAA…".
  key: string;
  namespace: string;
  // SHA-256 (hex) of the signed message.
  digest: string;
}

const BEGIN = '-----BEGIN SSH SIGNATURE-----';
const END = '-----END SSH SIGNATURE-----';

/** The SHA-256 of a text, in hex. */
export const digestText = (text: string) => sha256(new TextEncoder().encode(text));

/** A public key's two first words (type and base64), the comment left out. */
export const bareKey = (key: string) => key.trim().split(/\s+/).slice(0, 2).join(' ');

/** Is this text an OpenSSH private key? */
export const isPrivateKey = (text: string | null) => !!text && text.trimStart().startsWith('-----BEGIN OPENSSH PRIVATE KEY-----');

/** Signs a message with a private key's text: the signature's armour. */
export function sign(privateKey: string, namespace: string, message: string): string {
  const s: SshSignature = { key: publicFor(privateKey), namespace, digest: digestText(message) };
  const body = base64Encode(`SSHSIG\u0000${JSON.stringify(s)}`);
  return [BEGIN, ...(body.match(/.{1,70}/g) ?? []), END].join('\n');
}

/** Reads a signature's armour; null if it isn't one. */
export function readSignature(text: string | null): SshSignature | null {
  if (!text) return null;
  const start = text.indexOf(BEGIN);
  const end = text.indexOf(END);
  if (start < 0 || end < start) return null;
  const raw = base64Decode(text.slice(start + BEGIN.length, end));
  if (!raw?.startsWith('SSHSIG\u0000')) return null;
  try {
    const s = JSON.parse(raw.slice(7)) as SshSignature;
    return typeof s.key === 'string' && typeof s.namespace === 'string' && typeof s.digest === 'string' ? s : null;
  } catch {
    return null;
  }
}

export interface AllowedSigner {
  principals: string[];
  namespaces: string[] | null;
  key: string;
}

/**
 * An allowed_signers file (ssh-keygen(1), "ALLOWED SIGNERS"): one line per
 * key, "principals [options] keytype base64 [comment]", principals
 * separated by commas (wildcards * and ?), options namespaces="…",
 * valid-after, valid-before, cert-authority (only namespaces is read here).
 */
export function readAllowedSigners(text: string): AllowedSigner[] {
  const out: AllowedSigner[] = [];
  for (const raw of text.split('\n')) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const words = line.match(/(?:[^\s"]+|"[^"]*")+/g) ?? [];
    const [principals, ...rest] = words;
    const k = rest.findIndex((w) => /^(ssh-|ecdsa-|sk-)/.test(w));
    if (!principals || k < 0 || !rest[k + 1]) continue;
    const options = rest.slice(0, k).join(',');
    const ns = /namespaces="([^"]*)"/.exec(options);
    out.push({ principals: principals.split(','), namespaces: ns ? ns[1].split(',') : null, key: `${rest[k]} ${rest[k + 1]}` });
  }
  return out;
}

const wildcard = (pattern: string, value: string) =>
  new RegExp(`^${pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\?/g, '.')}$`).test(value);

/** The principals an allowed_signers file gives a key (for a namespace). */
export function principalsFor(text: string, key: string, namespace?: string): string[] {
  return readAllowedSigners(text)
    .filter((s) => s.key === bareKey(key) && (!namespace || !s.namespaces || s.namespaces.some((n) => wildcard(n, namespace))))
    .flatMap((s) => s.principals);
}

/** Is this key allowed for this principal (and namespace)? */
export const allowedFor = (text: string, key: string, principal: string, namespace?: string) =>
  readAllowedSigners(text).some(
    (s) => s.key === bareKey(key) && s.principals.some((p) => wildcard(p, principal)) && (!namespace || !s.namespaces || s.namespaces.some((n) => wildcard(n, namespace))),
  );
