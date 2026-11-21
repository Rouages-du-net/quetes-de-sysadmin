// An internal certificate authority's world: keys, certificate requests,
// certificates with their extensions, revocation lists (CRLs), an
// `openssl ca` database (index.txt, serial, crlnumber) and the trust store
// of a Debian machine (/etc/ssl/certs, filled by update-ca-certificates).
// Like tls.ts, every object is a real PEM file whose base64 holds the
// game's own description (readable by openssl, curl and nginx) instead of
// DER: copying, concatenating or damaging a file does what you expect.
// Keys are derived, never random: the same commands give the same keys.
//
// Chain building and checks follow OpenSSL 3's verifier
// (https://docs.openssl.org/3.0/man1/openssl-verification-options/):
// trusted certificates first, an anchor must be self-signed unless the
// partial chain is allowed (curl allows it), then the CA and purpose
// checks, the host name (the subject's CN only when there is no DNS name
// in subjectAltName), revocation with CRLs, and the validity dates.
// Error numbers and texts are X509_verify_cert_error_string()'s.
// Names and extensions: RFC 5280 (https://www.rfc-editor.org/rfc/rfc5280).
// Differences: no real cryptography (a signature is the issuer's key's
// identifier), no passphrase on keys, a subset of the extensions.

import type { Shell } from './shell';
import { systemd, toUtc } from './systemd';
import { covers, readAll, subject, type Certificate, type KeyInfo } from './tls';

export const DAY = 86_400_000;

// ——— Deterministic bytes ———

function fnv(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 0x01000193) >>> 0;
  return h;
}

/** n bytes derived from a seed (xorshift32). */
export function bytesOf(seed: string, n: number): number[] {
  let x = fnv(seed) || 0x9e3779b9;
  const out: number[] = [];
  for (let i = 0; i < n; i++) {
    x ^= x << 13;
    x >>>= 0;
    x ^= x >>> 17;
    x ^= x << 5;
    x >>>= 0;
    out.push(x & 0xff);
  }
  return out;
}

export const hex = (b: number[]) => b.map((x) => x.toString(16).padStart(2, '0')).join('');
export const colons = (b: number[], upper = false) => {
  const s = b.map((x) => x.toString(16).padStart(2, '0')).join(':');
  return upper ? s.toUpperCase() : s;
};

/** The game's clock (UTC, ms). */
export const nowUtc = (game: Shell) => toUtc(systemd(game)?.clock ?? 0);

// ——— PEM armour ———

const armour = (label: string, mark: string, data: unknown, size: number) => {
  const text = `${mark}${JSON.stringify(data)}\u0000`;
  const fill = hex(bytesOf(text, Math.max(0, Math.ceil((size - text.length) / 2))));
  const body = btoa(text + fill).match(/.{1,64}/g)!;
  return [`-----BEGIN ${label}-----`, ...body, `-----END ${label}-----`].join('\n');
};

function blocks(text: string | null, label: string): string[] {
  const re = new RegExp(`-----BEGIN ${label}-----\\r?\\n([\\s\\S]*?)\\r?\\n-----END ${label}-----`, 'g');
  return [...(text ?? '').matchAll(re)].map((m) => m[1]);
}

function unarmour<T>(body: string, mark: string): T | null {
  try {
    const decode = atob(body.replace(/\s/g, ''));
    if (!decode.startsWith(mark)) return null;
    return JSON.parse(decode.slice(mark.length, decode.indexOf('\u0000'))) as T;
  } catch {
    return null;
  }
}

// ——— Keys ———

const KEY_MARK = 'quetes-pkey:';
const PUB_MARK = 'quetes-pub:';

/** A private key (PKCS#8, "BEGIN PRIVATE KEY"; ecparam writes "EC PRIVATE KEY"). */
export const keyPem = (k: KeyInfo, label = 'PRIVATE KEY') => armour(label, KEY_MARK, k, k.alg === 'RSA' ? 1190 : 138);
export const publicPem = (k: KeyInfo) => armour('PUBLIC KEY', PUB_MARK, k, k.alg === 'RSA' ? 294 : 91);

/** The private key of a PEM text (null if there is none); certbot's keys count as EC keys. */
export function readKey(text: string | null): KeyInfo | null {
  for (const label of ['PRIVATE KEY', 'EC PRIVATE KEY', 'RSA PRIVATE KEY']) {
    for (const body of blocks(text, label)) {
      const k = unarmour<KeyInfo>(body, KEY_MARK);
      if (k) return k;
      try {
        const legacy = /^quetes-cle:([^:]*):/.exec(atob(body.replace(/\s/g, '')));
        if (legacy) return { alg: 'EC', bits: 256, id: `legacy-${legacy[1]}` };
      } catch {
        /* damaged */
      }
    }
  }
  return null;
}

export const readPublic = (text: string | null): KeyInfo | null => {
  for (const body of blocks(text, 'PUBLIC KEY')) {
    const k = unarmour<KeyInfo>(body, PUB_MARK);
    if (k) return k;
  }
  return null;
};

/** A new key, derived from the machine and a counter (deterministic). */
export function newKey(game: Shell, alg: 'RSA' | 'EC', bits: number): KeyInfo {
  const n = (game.state.pkiKeys = (game.state.pkiKeys ?? 0) + 1);
  return { alg, bits, id: hex(bytesOf(`${game.host ?? 'host'}:${n}:${alg}${bits}`, 10)) };
}

/** An RSA key's modulus, in capitals (openssl x509/rsa -modulus). */
export const modulus = (k: KeyInfo) => {
  const b = bytesOf(`modulus:${k.id}`, k.bits / 8);
  b[0] |= 0x80;
  return hex(b).toUpperCase();
};

// ——— Names ———

/** "/C=FR/O=Airwaves Federation/CN=x" → "C=FR, O=Airwaves Federation, CN=x"; null if malformed. */
export function parseSubj(subj: string): string | null {
  if (!subj.startsWith('/')) return null;
  const parts = subj
    .slice(1)
    .split(/(?<!\\)\//)
    .filter(Boolean);
  const out: string[] = [];
  for (const p of parts) {
    const i = p.indexOf('=');
    if (i <= 0) return null;
    out.push(`${p.slice(0, i).trim()}=${p.slice(i + 1).replace(/\\\//g, '/')}`);
  }
  return out.join(', ');
}

/** "C=FR, O=…, CN=x" → [["C","FR"], …]. */
export const dnParts = (dn: string): [string, string][] =>
  dn
    .split(/,\s*(?=[A-Za-z]+=)/)
    .filter(Boolean)
    .map((p) => [p.slice(0, p.indexOf('=')), p.slice(p.indexOf('=') + 1)]);

export const cnOf = (dn: string) => dnParts(dn).find(([k]) => k === 'CN')?.[1] ?? '';
export const slashDn = (dn: string) => dnParts(dn).map(([k, v]) => `/${k}=${v}`).join('');
const LONG: Record<string, string> = { C: 'countryName', ST: 'stateOrProvinceName', L: 'localityName', O: 'organizationName', OU: 'organizationalUnitName', CN: 'commonName', emailAddress: 'emailAddress' };
export const longName = (k: string) => LONG[k] ?? k;

// ——— Extensions ———

export interface Extensions {
  dns?: string[];
  ips?: string[];
  bc?: boolean;
  bcCritical?: boolean;
  ca?: boolean;
  pathlen?: number;
  ku?: string[];
  kuCritical?: boolean;
  eku?: string[];
}

export const KU_NAMES: Record<string, string> = {
  digitalSignature: 'Digital Signature',
  nonRepudiation: 'Non Repudiation',
  keyEncipherment: 'Key Encipherment',
  dataEncipherment: 'Data Encipherment',
  keyAgreement: 'Key Agreement',
  keyCertSign: 'Certificate Sign',
  cRLSign: 'CRL Sign',
};
export const EKU_NAMES: Record<string, string> = {
  serverAuth: 'TLS Web Server Authentication',
  clientAuth: 'TLS Web Client Authentication',
  codeSigning: 'Code Signing',
  emailProtection: 'E-mail Protection',
  OCSPSigning: 'OCSP Signing',
};

/** A configuration file like openssl.cnf: sections of name = value ($var expanded). */
export function readConf(text: string): Record<string, Record<string, string>> {
  const out: Record<string, Record<string, string>> = { '': {} };
  let section = out[''];
  for (const raw of text.split('\n')) {
    const line = raw.replace(/(^|\s)#.*$/, '').trim();
    if (!line) continue;
    const s = /^\[\s*([^\]]+?)\s*\]$/.exec(line);
    if (s) {
      section = out[s[1]] ??= {};
      continue;
    }
    const i = line.indexOf('=');
    if (i <= 0) continue;
    const name = line.slice(0, i).trim();
    const value = line
      .slice(i + 1)
      .trim()
      .replace(/^"(.*)"$/, '$1')
      .replace(/\$(\w+)|\$\{(\w+)\}/g, (m, a, b) => section[a ?? b] ?? out[''][a ?? b] ?? m);
    section[name] = value;
  }
  return out;
}

/**
 * One extension "name = value" (from a section, or -addext), added to `ext`.
 * Returns an error message (OpenSSL's reason) or null.
 */
export function addExtension(ext: Extensions, name: string, value: string, conf?: Record<string, Record<string, string>>): string | null {
  const items = value.split(',').map((x) => x.trim()).filter(Boolean);
  const critical = items[0] === 'critical';
  const list = critical ? items.slice(1) : items;
  switch (name) {
    case 'subjectAltName': {
      const dns: string[] = [];
      const ips: string[] = [];
      const add = (k: string, v: string): string | null => {
        const kind = k.replace(/\.\d+$/, '');
        if (kind === 'DNS') dns.push(v.toLowerCase());
        else if (kind === 'IP') {
          if (!/^\d{1,3}(\.\d{1,3}){3}$/.test(v) && !v.includes(':')) return `bad ip address:value=${v}`;
          ips.push(v);
        } else if (kind !== 'email' && kind !== 'URI') return `unsupported option:name=${k}`;
        return null;
      };
      for (const item of list) {
        if (item.startsWith('@')) {
          const sec = conf?.[item.slice(1)];
          if (!sec) return `section not found:section=${item.slice(1)}`;
          for (const [k, v] of Object.entries(sec)) {
            const e = add(k, v);
            if (e) return e;
          }
          continue;
        }
        const i = item.indexOf(':');
        if (i <= 0) return `missing value:name=${item}`;
        const e = add(item.slice(0, i), item.slice(i + 1));
        if (e) return e;
      }
      ext.dns = dns;
      ext.ips = ips;
      return null;
    }
    case 'basicConstraints': {
      ext.bc = true;
      ext.bcCritical = critical;
      ext.ca = false;
      delete ext.pathlen;
      for (const item of list) {
        const [k, v = ''] = item.split(':').map((x) => x.trim());
        if (k === 'CA') ext.ca = /^true$/i.test(v);
        else if (k === 'pathlen') ext.pathlen = Number(v);
        else return `invalid name:name=${k}`;
      }
      return null;
    }
    case 'keyUsage': {
      if (list.some((x) => !KU_NAMES[x])) return `invalid usage:value=${list.find((x) => !KU_NAMES[x])}`;
      ext.ku = list;
      ext.kuCritical = critical;
      return null;
    }
    case 'extendedKeyUsage': {
      if (list.some((x) => !EKU_NAMES[x])) return `invalid object identifier:value=${list.find((x) => !EKU_NAMES[x])}`;
      ext.eku = list;
      return null;
    }
    // Always added (hash, keyid): nothing to keep.
    case 'subjectKeyIdentifier':
    case 'authorityKeyIdentifier':
      return null;
    default:
      return `unknown extension name:name=${name}`;
  }
}

/** The extensions of a configuration section. */
export function sectionExtensions(conf: Record<string, Record<string, string>>, section: string): Extensions | string {
  const sec = conf[section];
  if (!sec) return `section not found:section=${section}`;
  const ext: Extensions = {};
  for (const [k, v] of Object.entries(sec)) {
    const e = addExtension(ext, k, v, conf);
    if (e) return e;
  }
  return ext;
}

export const extensionsOf = (c: Certificate): Extensions => ({
  ...(c.san ? { dns: c.names, ips: c.ips ?? [] } : {}),
  ...(c.bc ? { bc: true, bcCritical: c.bcCritical, ca: c.ca, pathlen: c.pathlen } : {}),
  ...(c.ku ? { ku: c.ku, kuCritical: c.kuCritical } : {}),
  ...(c.eku ? { eku: c.eku } : {}),
});

/** Copies extensions onto a certificate. */
export function withExtensions(c: Certificate, e: Extensions): Certificate {
  const out: Certificate = { ...c };
  if (e.dns || e.ips) {
    out.san = true;
    out.names = e.dns ?? [];
    out.ips = e.ips ?? [];
  }
  if (e.bc) Object.assign(out, { bc: true, bcCritical: !!e.bcCritical, ca: !!e.ca, ...(e.pathlen !== undefined ? { pathlen: e.pathlen } : {}) });
  if (e.ku) Object.assign(out, { ku: e.ku, kuCritical: !!e.kuCritical });
  if (e.eku) out.eku = e.eku;
  return out;
}

/** Merges two sets of extensions (`over` wins, like -addext over the configuration). */
export const mergeExtensions = (base: Extensions, over: Extensions): Extensions => ({ ...base, ...over });

// ——— Certificates ———

export interface CertSpec {
  subject: string;
  key: KeyInfo;
  issuer: string;
  signer: string;
  serial: string;
  start: number;
  end: number;
  ext: Extensions;
}

export function makeCertificate(s: CertSpec): Certificate {
  return withExtensions({ cn: cnOf(s.subject), names: [], issuer: s.issuer, serial: s.serial, start: s.start, end: s.end, subjectDn: s.subject, key: s.key, signer: s.signer }, s.ext);
}

export const selfSigned = (c: Certificate) => !!c.key && c.signer === c.key.id;
export const sameCert = (a: Certificate, b: Certificate) => a.serial === b.serial && subject(a) === subject(b) && a.signer === b.signer;
/** Is `c` signed by `i`'s key, with `i`'s subject as issuer? */
export const issuedBy = (c: Certificate, i: Certificate) => !!i.key && c.signer === i.key.id && c.issuer === subject(i);

/** A serial number as openssl shows it: decimal and hex when small, otherwise colon hex. */
export function serialText(serial: string): { short: string | null; long: string } {
  const clean = serial.replace(/^0+(?=.)/, '');
  if (clean.length <= 8) {
    const n = parseInt(clean, 16);
    return { short: `${n} (0x${clean.toLowerCase()})`, long: '' };
  }
  const even = clean.length % 2 ? `0${clean}` : clean;
  return { short: null, long: even.toLowerCase().match(/../g)!.join(':') };
}

/** A new random-looking serial (x509 -CAcreateserial, req -x509): 20 bytes, derived. */
export function randomSerial(game: Shell): string {
  const n = (game.state.pkiSerials = (game.state.pkiSerials ?? 0) + 1);
  const b = bytesOf(`serial:${game.host ?? ''}:${n}`, 20);
  b[0] &= 0x7f;
  return hex(b).toUpperCase();
}

// ——— Certificate requests ———

const CSR_MARK = 'quetes-csr:';

export interface Csr {
  subject: string;
  key: KeyInfo;
  ext: Extensions;
}

export const csrPem = (r: Csr) => armour('CERTIFICATE REQUEST', CSR_MARK, r, 640);
export const readCsr = (text: string | null): Csr | null => {
  for (const body of blocks(text, 'CERTIFICATE REQUEST')) {
    const r = unarmour<Csr>(body, CSR_MARK);
    if (r) return r;
  }
  return null;
};

// ——— Revocation lists ———

const CRL_MARK = 'quetes-crl:';

export interface Revoked {
  serial: string;
  date: number;
  reason?: string;
}

export interface Crl {
  issuer: string;
  signer: string;
  last: number;
  next: number;
  number?: string;
  revoked: Revoked[];
}

export const crlPem = (c: Crl) => armour('X509 CRL', CRL_MARK, c, 420 + c.revoked.length * 40);
export const readCrls = (text: string | null): Crl[] =>
  blocks(text, 'X509 CRL')
    .map((b) => unarmour<Crl>(b, CRL_MARK))
    .filter((c): c is Crl => !!c);

export const REASONS: Record<string, string> = {
  unspecified: 'Unspecified',
  keyCompromise: 'Key Compromise',
  CACompromise: 'CA Compromise',
  affiliationChanged: 'Affiliation Changed',
  superseded: 'Superseded',
  cessationOfOperation: 'Cessation Of Operation',
  certificateHold: 'Certificate Hold',
  removeFromCRL: 'Remove From CRL',
};

// ——— The openssl ca database ———

export interface IndexEntry {
  status: 'V' | 'R' | 'E';
  expiry: number;
  revoked?: number;
  reason?: string;
  serial: string;
  file: string;
  subject: string;
}

/** "300304083110Z" (UTCTime, YYMMDDHHMMSSZ). */
export const utcTime = (ms: number) => new Date(ms).toISOString().slice(2, 19).replace(/[-T:]/g, '') + 'Z';
export function fromUtcTime(s: string): number {
  const m = /^(\d\d)(\d\d)(\d\d)(\d\d)(\d\d)(\d\d)Z$/.exec(s);
  if (!m) return 0;
  const year = Number(m[1]) + (Number(m[1]) < 50 ? 2000 : 1900);
  return Date.UTC(year, Number(m[2]) - 1, Number(m[3]), Number(m[4]), Number(m[5]), Number(m[6]));
}

export function readIndex(text: string): IndexEntry[] {
  return text
    .split('\n')
    .filter((l) => l.trim())
    .map((l) => {
      const [status, expiry, rev = '', serial = '', file = 'unknown', subject = ''] = l.split('\t');
      const [revDate, reason] = rev.split(',');
      return { status: (status as IndexEntry['status']) || 'V', expiry: fromUtcTime(expiry), ...(revDate ? { revoked: fromUtcTime(revDate) } : {}), ...(reason ? { reason } : {}), serial: serial.toUpperCase(), file, subject };
    });
}

export const writeIndex = (entries: IndexEntry[]) =>
  entries.map((e) => [e.status, utcTime(e.expiry), e.revoked ? `${utcTime(e.revoked)}${e.reason ? `,${e.reason}` : ''}` : '', e.serial, e.file, e.subject].join('\t')).join('\n') + (entries.length ? '\n' : '');

// ——— Verification ———

export const VERIFY_ERRORS: Record<number, string> = {
  2: 'unable to get issuer certificate',
  3: 'unable to get certificate CRL',
  7: 'certificate signature failure',
  9: 'certificate is not yet valid',
  10: 'certificate has expired',
  11: 'CRL is not yet valid',
  12: 'CRL has expired',
  18: 'self-signed certificate',
  19: 'self-signed certificate in certificate chain',
  20: 'unable to get local issuer certificate',
  21: 'unable to verify the first certificate',
  22: 'certificate chain too long',
  23: 'certificate revoked',
  24: 'invalid CA certificate',
  25: 'path length constraint exceeded',
  26: 'unsupported certificate purpose',
  32: 'key usage does not include certificate signing',
  62: 'hostname mismatch',
};

export interface VerifyOptions {
  now: number;
  trusted: Certificate[];
  untrusted?: Certificate[];
  crls?: Crl[];
  // CRL checks: the leaf only (-crl_check), or the whole chain (-crl_check_all, nginx's ssl_crl).
  crlCheck?: 'none' | 'leaf' | 'all';
  host?: string | null;
  purpose?: 'sslserver' | 'sslclient' | null;
  // A trusted certificate that isn't self-signed may end the chain (curl does it).
  partial?: boolean;
  // How many intermediate CAs are allowed (nginx's ssl_verify_depth).
  depth?: number;
  // Stop at the first error (curl, openssl verify, nginx), or go on (s_client).
  all?: boolean;
}

export interface VerifyError {
  depth: number;
  code: number;
}

export interface VerifyResult {
  chain: Certificate[];
  errors: VerifyError[];
}

/** Does the certificate's name match this host (SAN DNS names; the CN only without DNS SAN)? */
export function matchesHost(c: Certificate, host: string): boolean {
  const h = host.toLowerCase();
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(h)) return (c.ips ?? []).includes(h);
  if (c.names.length) return covers(c, h);
  if (c.key && c.san) return false;
  return c.cn.toLowerCase() === h;
}

const isTrusted = (c: Certificate, trusted: Certificate[]) => trusted.some((t) => sameCert(t, c));

/** Builds the chain and checks it, like X509_verify_cert(). */
export function verify(leaf: Certificate, o: VerifyOptions): VerifyResult {
  const errors: VerifyError[] = [];
  const stop = () => !o.all && errors.length > 0;
  const chain = [leaf];
  let anchored = false;
  // 1. The chain: trusted certificates first, then those the peer sent.
  for (let guard = 0; guard < 10; guard++) {
    const cur = chain[chain.length - 1];
    if (isTrusted(cur, o.trusted) && (selfSigned(cur) || o.partial)) {
      anchored = true;
      break;
    }
    if (selfSigned(cur)) {
      errors.push({ depth: chain.length - 1, code: chain.length === 1 ? 18 : 19 });
      break;
    }
    const fromTrusted = o.trusted.find((t) => issuedBy(cur, t) && !chain.some((x) => sameCert(x, t)));
    const fromPeer = fromTrusted ? undefined : (o.untrusted ?? []).find((t) => issuedBy(cur, t) && !chain.some((x) => sameCert(x, t)));
    const next = fromTrusted ?? fromPeer;
    if (next) {
      chain.push(next);
      continue;
    }
    const someTrusted = chain.some((x) => isTrusted(x, o.trusted));
    errors.push({ depth: chain.length - 1, code: someTrusted ? 2 : 20 });
    if (chain.length === 1) errors.push({ depth: 0, code: 21 });
    break;
  }
  if (stop()) return { chain, errors: errors.slice(0, 1) };
  // 2. The depth, the CAs' constraints, the leaf's purpose.
  if (o.depth !== undefined && chain.length - 2 > o.depth) {
    errors.push({ depth: o.depth + 1, code: 22 });
    if (stop()) return { chain, errors };
  }
  for (let i = 1; i < chain.length; i++) {
    const c = chain[i];
    if (!c.key) continue;
    if (!c.ca) errors.push({ depth: i, code: 24 });
    else if (c.pathlen !== undefined && i - 1 > c.pathlen) errors.push({ depth: i, code: 25 });
    else if (c.ku && !c.ku.includes('keyCertSign')) errors.push({ depth: i, code: 32 });
    if (stop()) return { chain, errors };
  }
  if (o.purpose && leaf.eku && !leaf.eku.includes(o.purpose === 'sslserver' ? 'serverAuth' : 'clientAuth')) {
    errors.push({ depth: 0, code: 26 });
    if (stop()) return { chain, errors };
  }
  // 3. The host name.
  if (o.host && !matchesHost(leaf, o.host)) {
    errors.push({ depth: 0, code: 62 });
    if (stop()) return { chain, errors };
  }
  // 4. Revocation: each certificate's issuer's CRL (not the anchor's own).
  if (o.crlCheck && o.crlCheck !== 'none') {
    const last = o.crlCheck === 'all' ? chain.length - (anchored && selfSigned(chain[chain.length - 1]) ? 1 : 0) : 1;
    for (let i = 0; i < Math.min(last, chain.length); i++) {
      const c = chain[i];
      const crl = (o.crls ?? []).find((x) => x.signer === c.signer && x.issuer === c.issuer);
      if (!crl) errors.push({ depth: i, code: 3 });
      else if (crl.last > o.now) errors.push({ depth: i, code: 11 });
      else if (crl.next < o.now) errors.push({ depth: i, code: 12 });
      else if (crl.revoked.some((r) => r.serial.toUpperCase().replace(/^0+/, '') === c.serial.toUpperCase().replace(/^0+/, ''))) errors.push({ depth: i, code: 23 });
      if (stop()) return { chain, errors };
    }
  }
  // 5. The dates, from the anchor down to the leaf.
  for (let i = chain.length - 1; i >= 0; i--) {
    const c = chain[i];
    if (o.now < c.start) errors.push({ depth: i, code: 9 });
    else if (o.now > c.end) errors.push({ depth: i, code: 10 });
    if (stop()) return { chain, errors };
  }
  return { chain, errors };
}

// ——— The trust store (Debian's ca-certificates) ———

export const BUNDLE = '/etc/ssl/certs/ca-certificates.crt';
export const LOCAL_CAS = '/usr/local/share/ca-certificates';
export const MOZILLA = '/usr/share/ca-certificates';
export const CA_CONF = '/etc/ca-certificates.conf';

/** The certificates a machine trusts (the bundle update-ca-certificates writes). */
export const trustStore = (game: Shell): Certificate[] => readAll(game.read(BUNDLE));

/** The subject hash openssl uses for /etc/ssl/certs links ("a1b2c3d4.0"). */
export const subjectHash = (c: Certificate) => hex(bytesOf(`hash:${subject(c)}`, 4));

/** A certificate's lines in the bundle: one PEM after the other. */
export { readAll };
