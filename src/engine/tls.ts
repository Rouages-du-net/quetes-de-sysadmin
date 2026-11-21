// Simulated TLS certificates. A certificate is a real PEM file
// (-----BEGIN CERTIFICATE-----, base64): what the base64 holds is the
// game's own (the useful information, readable by openssl and curl),
// instead of an X.509 structure. Copying, moving or damaging the file
// therefore does what you expect: a damaged certificate can't be read.
// Display formats based on OpenSSL 3 (https://docs.openssl.org/3.5/man1/openssl-x509/).

export interface Certificate {
  // Common name (CN) and covered names (subjectAltName).
  cn: string;
  names: string[];
  issuer: string;
  serial: string;
  // Dates UTC, en millisecondes.
  start: number;
  end: number;
  // A certificate of an internal PKI (see pki.ts) says more: its whole
  // subject, its public key, the key that signed it (its issuer's), its
  // extensions. Without `key`, a certificate is a public one (Let's
  // Encrypt's), trusted as before.
  subjectDn?: string;
  key?: KeyInfo;
  signer?: string;
  // A subjectAltName extension is present (names: its DNS names; ips: its IP addresses).
  san?: boolean;
  ips?: string[];
  // basicConstraints (present, critical, CA, pathlen), keyUsage, extendedKeyUsage.
  bc?: boolean;
  bcCritical?: boolean;
  ca?: boolean;
  pathlen?: number;
  ku?: string[];
  kuCritical?: boolean;
  eku?: string[];
  // The issuer's key algorithm (for the signature algorithm shown).
  sig?: 'RSA' | 'EC';
}

// A key pair: its algorithm, its size, and what identifies it (both halves
// share it; see pki.ts).
export interface KeyInfo {
  alg: 'RSA' | 'EC';
  bits: number;
  id: string;
}

const MARK = 'quetes-x509:';

// Base64 encoding of an ASCII text (browser and Node alike).
const base64 = (text: string) => btoa(text);

/** A certificate's PEM file (lines of 64 characters, like OpenSSL). */
export function pem(c: Certificate): string {
  // A real ECDSA certificate is about fifteen lines long: pad it out.
  const text = MARK + JSON.stringify(c) + '\u0000';
  const body = base64(text + c.serial.repeat(Math.ceil(Math.max(0, 760 - text.length) / c.serial.length))).match(/.{1,64}/g)!;
  return ['-----BEGIN CERTIFICATE-----', ...body, '-----END CERTIFICATE-----'].join('\n');
}

// One PEM block's content, decoded (null if damaged).
function decodeBlock(body: string): Certificate | null {
  try {
    const decode = atob(body.replace(/\s/g, ''));
    if (!decode.startsWith(MARK)) return null;
    return JSON.parse(decode.slice(MARK.length, decode.indexOf('\u0000'))) as Certificate;
  } catch {
    return null;
  }
}

/** Reads the first certificate of a PEM text; null if there is none or it is damaged. */
export function read(text: string | null): Certificate | null {
  const m = /-----BEGIN CERTIFICATE-----\r?\n([\s\S]*?)\r?\n-----END CERTIFICATE-----/.exec(text ?? '');
  return m ? decodeBlock(m[1]) : null;
}

/** Every readable certificate of a PEM text (a bundle, a chain), in order. */
export function readAll(text: string | null): Certificate[] {
  const out: Certificate[] = [];
  for (const m of (text ?? '').matchAll(/-----BEGIN CERTIFICATE-----\r?\n([\s\S]*?)\r?\n-----END CERTIFICATE-----/g)) {
    const c = decodeBlock(m[1]);
    if (c) out.push(c);
  }
  return out;
}

const MONTH = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "Jan 21 06:39:59 2027 GMT", like OpenSSL. */
export function dateOpenssl(ms: number): string {
  const d = new Date(ms);
  return `${MONTH[d.getUTCMonth()]} ${String(d.getUTCDate()).padStart(2, ' ')} ${d.toISOString().slice(11, 19)} ${d.getUTCFullYear()} GMT`;
}

/** "2027-01-21 06:39:59+00:00", like certbot. */
export const dateCertbot = (ms: number) => `${new Date(ms).toISOString().slice(0, 19).replace('T', ' ')}+00:00`;

export const subject = (c: Certificate) => c.subjectDn ?? `CN=${c.cn}`;

/** Does the certificate cover this name? (exact names, or a *.domain wildcard one level deep) */
export const covers = (c: Certificate, name: string) =>
  c.names.some((n) => n === name.toLowerCase() || (n.startsWith('*.') && name.toLowerCase().split('.').slice(1).join('.') === n.slice(2)));

export const DURATION = 90 * 86_400_000;
export const ISSUER = "C=US, O=Let's Encrypt, CN=E6";
