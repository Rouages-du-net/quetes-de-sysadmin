// openssl (OpenSSL 3.5) and update-ca-certificates: an internal
// certificate authority's tools, on the model of ../pki.ts.
//
// openssl's subcommands follow https://docs.openssl.org/3.0/man1/:
// genpkey, genrsa, ecparam -genkey, pkey, rsa (keys); req (requests, and
// -x509 self-signed certificates with the default configuration's v3_ca);
// x509 (reading a certificate, and -req to sign a request with -CA/-CAkey,
// the .srl serial file, -extfile/-extensions, -copy_extensions); verify
// (-CAfile, -untrusted, -crl_check(_all), -CRLfile, -verify_hostname); ca
// (an openssl.cnf database: index.txt, serial, crlnumber, newcerts/;
// signing, -revoke with -crl_reason, -gencrl); crl; s_client against the
// story's services (pkiNet) or the machine's own nginx.
// update-ca-certificates follows Debian's script
// (https://manpages.debian.org/trixie/ca-certificates/update-ca-certificates.8.en.html):
// /etc/ca-certificates.conf and the *.crt files of
// /usr/local/share/ca-certificates become links in /etc/ssl/certs and the
// bundle ca-certificates.crt that curl and openssl read.
// curl (pkiCurl) on a story with an internal PKI: the trust store,
// --cacert, -k, --cert/--key for client certificates, -v.
// Differences: no passphrase on keys (-aes256, a key without -noenc: the
// game says so); s_client returns at once; a subset of the options; the
// RSA dots of key generation are not drawn.

import type { Shell } from '../shell';
import type { Command } from './index';
import type { File } from '../world';
import { httpRequest, type Response } from '../nginx';
import { checkCertificate, SSL_HELP } from './network';
import { dateOpenssl, pem, read, readAll, subject, type Certificate, type KeyInfo } from '../tls';
import { sha1, sha256 } from './checksums';
import {
  BUNDLE,
  CA_CONF,
  DAY,
  EKU_NAMES,
  KU_NAMES,
  LOCAL_CAS,
  MOZILLA,
  REASONS,
  VERIFY_ERRORS,
  addExtension,
  bytesOf,
  cnOf,
  colons,
  crlPem,
  csrPem,
  dnParts,
  extensionsOf,
  keyPem,
  longName,
  makeCertificate,
  matchesHost,
  modulus,
  newKey,
  nowUtc,
  parseSubj,
  publicPem,
  randomSerial,
  readConf,
  readCrls,
  readCsr,
  readIndex,
  readKey,
  readPublic,
  sectionExtensions,
  selfSigned,
  serialText,
  slashDn,
  subjectHash,
  trustStore,
  utcTime,
  verify,
  writeIndex,
  type Crl,
  type Extensions,
  type IndexEntry,
  type VerifyError,
} from '../pki';

export const VERSION = 'OpenSSL 3.5.1 1 Jul 2025 (Library: OpenSSL 3.5.1 1 Jul 2025)';
export const DEFAULT_CNF = '/usr/lib/ssl/openssl.cnf';

// ——— The story's network: which machine answers for a name ———

export interface PkiNet {
  // The story's main machine (its identifier).
  main: string;
  // Each name → the machine that answers (the main one or an internal host).
  hosts: Record<string, string>;
  // Each machine's address.
  addresses: Record<string, string>;
}

export const pkiNet = (game: Shell): PkiNet | undefined => game.principal.state.pkiNet;
const machine = (game: Shell, name: string): Shell | null => (name === pkiNet(game)!.main ? game.principal : game.principal.internal(name));
const addressOf = (game: Shell) => pkiNet(game)?.addresses[game.host] ?? '127.0.0.1';

/** An HTTPS request to one of the story's services, as a client of `game`. */
export function tlsRequest(game: Shell, host: string, path: string, port: number, o: { certificate?: string; trace?: boolean; method?: string; agent?: string } = {}): Response | null | 'unknown' {
  const net = pkiNet(game);
  const name = host.toLowerCase();
  const target = net?.hosts[name] ?? (['localhost', '127.0.0.1'].includes(name) ? game.host : undefined);
  if (!target) return 'unknown';
  const s = machine(game, target);
  if (!s) return 'unknown';
  return httpRequest(s, name, path, port, o.trace ?? true, { address: addressOf(game), time: s.state.systemd?.clock ?? 0, agent: o.agent ?? 'curl/8.14.1', method: o.method, certificate: o.certificate });
}

// ——— Files ———

type Loaded = { text: string } | { error: string };

function load(game: Shell, path: string, what: string): Loaded {
  if (path === '-') return { error: `Could not read ${what} from stdin` };
  const n = game.find(path);
  if (!n || n.type !== 'file') return { error: `Could not open file or uri for loading ${what} from ${path}: No such file or directory` };
  if (!game.traverses(path) || !game.can(n, 'r')) return { error: `Could not open file or uri for loading ${what} from ${path}: Permission denied` };
  return { text: game.read(path) ?? '' };
}

/** Writes a file like openssl: a private key is created 0600 (bio_open_owner). */
function writeOut(game: Shell, path: string, text: string, secret = false): string | null {
  const n = game.find(path);
  if (n?.type === 'directory') return `Can't open "${path}" for writing, Is a directory`;
  if (n?.type === 'file') {
    if (!game.can(n, 'w')) return `Can't open "${path}" for writing, Permission denied`;
    if (n.link !== undefined) return writeOut(game, game.realPath(path), text, secret);
    n.content = text;
    n.lines = true;
    delete n.size;
    return null;
  }
  const node: File = { type: 'file', content: text, lines: true, owner: game.who, group: game.who === 'root' ? 'root' : undefined, ...(secret ? { mode: 'rw-------' } : {}) };
  const e = game.place('openssl', path, node);
  return e ? `Can't open "${path}" for writing, ${/space/i.test(e) ? 'No space left on device' : /exist|missing|No such/i.test(e) ? 'No such file or directory' : 'Permission denied'}` : null;
}

// ——— Options ———

interface Parsed {
  flags: Set<string>;
  values: Record<string, string[]>;
  rest: string[];
  bad?: string;
}

const DIGESTS = ['sha1', 'sha224', 'sha256', 'sha384', 'sha512', 'md5'];

function options(args: string[], withValue: string[], flags: string[], digests = false): Parsed {
  const p: Parsed = { flags: new Set(), values: {}, rest: [] };
  for (let i = 0; i < args.length; i++) {
    const a = args[i].replace(/^--(?=\w)/, '-');
    if (!a.startsWith('-') || a === '-') {
      p.rest.push(args[i]);
      continue;
    }
    const name = a.slice(1);
    if (withValue.includes(name)) (p.values[name] ??= []).push(args[++i] ?? '');
    else if (flags.includes(name) || (digests && DIGESTS.includes(name))) p.flags.add(name);
    else {
      p.bad ??= name;
    }
  }
  return p;
}

const unknown = (game: Shell, prog: string, name: string, digests: boolean) =>
  game.error(`${prog}: ${digests ? `Unknown option or message digest: ${name}` : `Unknown option: -${name}`}\n${prog}: Use -help for summary.`, 1);
const one = (p: Parsed, k: string) => p.values[k]?.at(-1);

// ——— Display ———

const wrapHex = (b: number[], perLine: number, indent: number, upper = false) => {
  const s = b.map((x) => x.toString(16).padStart(2, '0')).map((x) => (upper ? x.toUpperCase() : x));
  const lines: string[] = [];
  for (let i = 0; i < s.length; i += perLine) lines.push(' '.repeat(indent) + s.slice(i, i + perLine).join(':') + (i + perLine < s.length ? ':' : ''));
  return lines;
};

const keyOf = (c: Certificate): KeyInfo => c.key ?? { alg: 'EC', bits: 256, id: `public-${c.serial}` };
const sigName = (alg: 'RSA' | 'EC' | undefined) => (alg === 'RSA' ? 'sha256WithRSAEncryption' : 'ecdsa-with-SHA256');
const skid = (id: string) => colons(bytesOf(`skid:${id}`, 20), true);

function publicKeyLines(k: KeyInfo, indent: number): string[] {
  const pad = ' '.repeat(indent);
  if (k.alg === 'RSA') {
    const mod = bytesOf(`modulus:${k.id}`, k.bits / 8);
    mod[0] |= 0x80;
    return [`${pad}Public Key Algorithm: rsaEncryption`, `${pad}    Public-Key: (${k.bits} bit)`, `${pad}    Modulus:`, ...wrapHex([0, ...mod], 15, indent + 8), `${pad}    Exponent: 65537 (0x10001)`];
  }
  const p384 = k.bits === 384;
  return [
    `${pad}Public Key Algorithm: id-ecPublicKey`,
    `${pad}    Public-Key: (${k.bits} bit)`,
    `${pad}    pub:`,
    ...wrapHex([4, ...bytesOf(`ecpub:${k.id}`, p384 ? 96 : 64)], 15, indent + 8),
    `${pad}    ASN1 OID: ${p384 ? 'secp384r1' : 'prime256v1'}`,
    `${pad}    NIST CURVE: ${p384 ? 'P-384' : 'P-256'}`,
  ];
}

function extensionLines(e: Extensions, indent: number, ids?: { skid: string; akid?: string }): string[] {
  const pad = ' '.repeat(indent);
  const out: string[] = [];
  if (e.bc) out.push(`${pad}X509v3 Basic Constraints: ${e.bcCritical ? 'critical' : ''}`, `${pad}    CA:${e.ca ? 'TRUE' : 'FALSE'}${e.ca && e.pathlen !== undefined ? `, pathlen:${e.pathlen}` : ''}`);
  if (e.ku) out.push(`${pad}X509v3 Key Usage: ${e.kuCritical ? 'critical' : ''}`, `${pad}    ${e.ku.map((k) => KU_NAMES[k]).join(', ')}`);
  if (e.eku) out.push(`${pad}X509v3 Extended Key Usage: `, `${pad}    ${e.eku.map((k) => EKU_NAMES[k]).join(', ')}`);
  if (ids) out.push(`${pad}X509v3 Subject Key Identifier: `, `${pad}    ${ids.skid}`);
  if (ids?.akid) out.push(`${pad}X509v3 Authority Key Identifier: `, `${pad}    ${ids.akid}`);
  if (e.dns || e.ips) out.push(`${pad}X509v3 Subject Alternative Name: `, `${pad}    ${[...(e.dns ?? []).map((n) => `DNS:${n}`), ...(e.ips ?? []).map((n) => `IP Address:${n}`)].join(', ')}`);
  return out;
}

const signatureLines = (seed: string, alg: 'RSA' | 'EC' | undefined) => {
  const b = alg === 'RSA' ? bytesOf(`sig:${seed}`, 256) : [0x30, 0x45, 0x02, 0x21, 0x00, ...bytesOf(`sig:${seed}`, 32), 0x02, 0x20, ...bytesOf(`sig2:${seed}`, 32)];
  return wrapHex(b, 18, 8);
};

/** openssl x509 -text. */
export function certText(c: Certificate): string {
  const s = serialText(c.serial);
  const e = c.key ? extensionsOf(c) : { dns: c.names };
  const lines = [
    'Certificate:',
    '    Data:',
    '        Version: 3 (0x2)',
    ...(s.short ? [`        Serial Number: ${s.short}`] : ['        Serial Number:', `            ${s.long}`]),
    `        Signature Algorithm: ${sigName(c.sig)}`,
    `        Issuer: ${c.issuer}`,
    '        Validity',
    `            Not Before: ${dateOpenssl(c.start)}`,
    `            Not After : ${dateOpenssl(c.end)}`,
    `        Subject: ${subject(c)}`,
    '        Subject Public Key Info:',
    ...publicKeyLines(keyOf(c), 12),
    '        X509v3 extensions:',
    ...extensionLines(e, 12, { skid: skid(keyOf(c).id), akid: c.signer && !selfSigned(c) ? skid(c.signer) : c.signer ? skid(c.signer) : undefined }),
    `    Signature Algorithm: ${sigName(c.sig)}`,
    '    Signature Value:',
    ...signatureLines(`${c.serial}${c.signer}`, c.sig),
  ];
  return lines.join('\n');
}

function csrText(r: { subject: string; key: KeyInfo; ext: Extensions }): string {
  const ext = extensionLines(r.ext, 20);
  return [
    'Certificate Request:',
    '    Data:',
    '        Version: 1 (0x0)',
    `        Subject: ${r.subject}`,
    '        Subject Public Key Info:',
    ...publicKeyLines(r.key, 12),
    '        Attributes:',
    ...(ext.length ? ['            Requested Extensions:', ...ext] : ['            (none)', '            Requested Extensions:']),
    `    Signature Algorithm: ${sigName(r.key.alg)}`,
    '    Signature Value:',
    ...signatureLines(`csr${r.key.id}${r.subject}`, r.key.alg),
  ].join('\n');
}

function crlText(c: Crl): string {
  const lines = [
    'Certificate Revocation List (CRL):',
    '        Version 2 (0x1)',
    '        Signature Algorithm: ecdsa-with-SHA256',
    `        Issuer: ${c.issuer}`,
    `        Last Update: ${dateOpenssl(c.last)}`,
    `        Next Update: ${dateOpenssl(c.next)}`,
    '        CRL extensions:',
    '            X509v3 Authority Key Identifier: ',
    `                ${skid(c.signer)}`,
    ...(c.number !== undefined ? ['            X509v3 CRL Number: ', `                ${parseInt(c.number, 16)}`] : []),
  ];
  if (!c.revoked.length) lines.push('No Revoked Certificates.');
  else {
    lines.push('Revoked Certificates:');
    for (const r of c.revoked) {
      lines.push(`    Serial Number: ${r.serial.toUpperCase()}`, `        Revocation Date: ${dateOpenssl(r.date)}`);
      if (r.reason) lines.push('        CRL entry extensions:', '            X509v3 CRL Reason Code: ', `                ${REASONS[r.reason] ?? r.reason}`);
    }
  }
  lines.push('    Signature Algorithm: ecdsa-with-SHA256', '    Signature Value:', ...signatureLines(`crl${c.signer}${c.number}`, 'EC'));
  return lines.join('\n');
}

const enc = (s: string) => new TextEncoder().encode(s);
const fingerprint = (c: Certificate, digest: 'sha1' | 'sha256') =>
  `${digest} Fingerprint=${(digest === 'sha1' ? sha1 : sha256)(enc(pem(c)))
    .toUpperCase()
    .match(/../g)!
    .join(':')}`;

// ——— Keys: genpkey, genrsa, ecparam, pkey, rsa ———

const NO_PASSPHRASE = (game: Shell) => game.error(game.t('openssl-no-passphrase'), 1);
const CURVES: Record<string, number> = { 'P-256': 256, prime256v1: 256, 'P-384': 384, secp384r1: 384 };

function genpkey(game: Shell, args: string[]): string {
  const p = options(args, ['algorithm', 'pkeyopt', 'out', 'outform', 'pass'], ['quiet', 'text', 'aes256', 'aes128']);
  if (p.bad) return unknown(game, 'genpkey', p.bad, false);
  if (p.flags.has('aes256') || p.flags.has('aes128')) return NO_PASSPHRASE(game);
  const alg = (one(p, 'algorithm') ?? '').toUpperCase();
  if (!alg) return game.error('genpkey: Either -algorithm or -paramfile must be specified\ngenpkey: Use -help for summary.', 1);
  if (alg !== 'RSA' && alg !== 'EC') return game.error(`genpkey: Algorithm ${one(p, 'algorithm')} not found`, 1);
  let bits = alg === 'RSA' ? 2048 : 0;
  for (const o of p.values.pkeyopt ?? []) {
    const [k, v] = o.split(':');
    if (k === 'rsa_keygen_bits' && alg === 'RSA') bits = Number(v);
    else if ((k === 'ec_paramgen_curve' || k === 'group') && alg === 'EC') {
      if (!CURVES[v]) return game.error(`genpkey: Error setting ${k}:${v} parameter:\nunknown curve name (${v})`, 1);
      bits = CURVES[v];
    } else return game.error(`genpkey: Error setting ${o} parameter:\n${o}: parameter setting error`, 1);
  }
  if (alg === 'EC' && !bits) return game.error('genpkey: Error generating EC key\n...:error:1C8000B5:Provider routines:ec_gen_init:no parameters set', 1);
  if (alg === 'RSA' && bits < 512) return game.error(`genpkey: Error setting rsa_keygen_bits:${bits} parameter:\nkey size too small`, 1);
  return outputKey(game, newKey(game, alg, bits), one(p, 'out'));
}

function outputKey(game: Shell, k: KeyInfo, out: string | undefined, label = 'PRIVATE KEY'): string {
  const text = keyPem(k, label);
  if (!out || out === '-') return text;
  const e = writeOut(game, out, text, true);
  return e ? game.error(e, 1) : '';
}

function genrsa(game: Shell, args: string[]): string {
  const p = options(args, ['out', 'passout'], ['quiet', 'aes256', 'aes128', 'des3', 'traditional']);
  if (p.bad) return unknown(game, 'genrsa', p.bad, false);
  if (p.flags.has('aes256') || p.flags.has('aes128') || p.flags.has('des3')) return NO_PASSPHRASE(game);
  const bits = Number(p.rest[0] ?? 2048);
  if (!Number.isInteger(bits) || bits < 512) return game.error(`genrsa: Error generating RSA key\nkey size too small`, 1);
  return outputKey(game, newKey(game, 'RSA', bits), one(p, 'out'));
}

function ecparam(game: Shell, args: string[]): string {
  const p = options(args, ['name', 'out'], ['genkey', 'noout', 'text', 'list_curves']);
  if (p.bad) return unknown(game, 'ecparam', p.bad, false);
  if (p.flags.has('list_curves')) return '  prime256v1: X9.62/SECG curve over a 256 bit prime field\n  secp384r1 : NIST/SECG curve over a 384 bit prime field';
  const name = one(p, 'name');
  if (!name || !CURVES[name]) return game.error(`ecparam: unknown curve name (${name ?? ''})`, 1);
  if (!p.flags.has('genkey')) return '-----BEGIN EC PARAMETERS-----\nBggqhkjOPQMBBw==\n-----END EC PARAMETERS-----';
  const k = newKey(game, 'EC', CURVES[name]);
  const params = p.flags.has('noout') ? '' : '-----BEGIN EC PARAMETERS-----\nBggqhkjOPQMBBw==\n-----END EC PARAMETERS-----\n';
  const out = one(p, 'out');
  const text = params + keyPem(k, 'EC PRIVATE KEY');
  if (!out) return text;
  const e = writeOut(game, out, text, true);
  return e ? game.error(e, 1) : '';
}

function loadKey(game: Shell, path: string, what = 'private key'): KeyInfo | string {
  const l = load(game, path, what);
  if ('error' in l) return l.error;
  if (/ENCRYPTED PRIVATE KEY/.test(l.text)) return `Could not read ${what} from ${path}`;
  return readKey(l.text) ?? `Could not find ${what} from ${path}`;
}

function pkey(game: Shell, args: string[], rsa = false): string {
  const prog = rsa ? 'rsa' : 'pkey';
  const p = options(args, ['in', 'out', 'inform', 'outform'], ['pubout', 'pubin', 'noout', 'text', 'modulus', 'check', 'text_pub']);
  if (p.bad) return unknown(game, prog, p.bad, false);
  const file = one(p, 'in');
  let k: KeyInfo | null = null;
  if (p.flags.has('pubin')) {
    if (!file) return game.error(`${prog}: no input file`, 1);
    const l = load(game, file, 'public key');
    if ('error' in l) return game.error(l.error, 1);
    k = readPublic(l.text) ?? readKey(l.text);
    if (!k) return game.error(`Could not find public key from ${file}`, 1);
  } else {
    if (!file) return game.error(`${prog}: -in is required here (the key would be read from the terminal)`, 1);
    const r = loadKey(game, file);
    if (typeof r === 'string') return game.error(r, 1);
    k = r;
  }
  if (rsa && k.alg !== 'RSA') return game.error('rsa: Not an RSA key', 1);
  const lines: string[] = [];
  if (p.flags.has('modulus')) lines.push(`Modulus=${modulus(k)}`);
  if (p.flags.has('check')) lines.push(rsa ? 'RSA key ok' : 'Key is valid');
  if (p.flags.has('text') || p.flags.has('text_pub')) lines.push(k.alg === 'RSA' ? `Private-Key: (${k.bits} bit, 2 primes)` : `Private-Key: (${k.bits} bit)`, ...publicKeyLines(k, 0).slice(1));
  if (!p.flags.has('noout')) {
    const text = p.flags.has('pubout') || p.flags.has('pubin') ? publicPem(k) : keyPem(k);
    const out = one(p, 'out');
    if (out && out !== '-') {
      const e = writeOut(game, out, text, !p.flags.has('pubout'));
      if (e) return game.error(e, 1);
    } else lines.push(text);
  }
  return lines.join('\n');
}

// ——— Extensions from a configuration ———

function confExtensions(game: Shell, prog: string, file: string, section: string | undefined): Extensions | string {
  const l = load(game, file, 'config');
  if ('error' in l) return `${prog}: Can't open "${file}" for reading, No such file or directory`;
  const conf = readConf(l.text);
  const sec = section ?? conf['']['extensions'] ?? '';
  const e = sectionExtensions(conf, sec);
  if (typeof e === 'string') return `${prog}: Error checking extension section ${sec || 'default'}\n${e}`;
  return e;
}

function addexts(list: string[] | undefined, base: Extensions): Extensions | string {
  const ext: Extensions = { ...base };
  for (const a of list ?? []) {
    const i = a.indexOf('=');
    if (i <= 0) return `Error parsing extension "${a}"`;
    const e = addExtension(ext, a.slice(0, i).trim(), a.slice(i + 1).trim());
    if (e) return `Error adding extension "${a}"\n${e}`;
  }
  return ext;
}

// The default configuration's [ v3_ca ] (Debian's /usr/lib/ssl/openssl.cnf).
const V3_CA: Extensions = { bc: true, bcCritical: true, ca: true };

// ——— req ———

const DN_PROMPTS: [string, string, string][] = [
  ['C', 'Country Name (2 letter code) [AU]:', 'AU'],
  ['ST', 'State or Province Name (full name) [Some-State]:', 'Some-State'],
  ['L', 'Locality Name (eg, city) []:', ''],
  ['O', 'Organization Name (eg, company) [Internet Widgits Pty Ltd]:', 'Internet Widgits Pty Ltd'],
  ['OU', 'Organizational Unit Name (eg, section) []:', ''],
  ['CN', 'Common Name (e.g. server FQDN or YOUR name) []:', ''],
  ['emailAddress', 'Email Address []:', ''],
];

function req(game: Shell, args: string[]): string {
  const p = options(
    args,
    ['key', 'newkey', 'keyout', 'subj', 'addext', 'days', 'out', 'in', 'config', 'extensions', 'reqexts', 'set_serial', 'pkeyopt', 'outform', 'inform', 'passout', 'passin'],
    ['new', 'x509', 'nodes', 'noenc', 'noout', 'text', 'verify', 'subject', 'pubkey', 'batch', 'utf8', 'quiet'],
    true,
  );
  if (p.bad) return unknown(game, 'req', p.bad, true);
  const now = Math.floor(nowUtc(game) / 1000) * 1000;
  // Reading a request.
  if (!p.flags.has('new') && !p.flags.has('x509') && !p.values.newkey) {
    const file = one(p, 'in');
    if (!file) return game.error('req: a request is read with -in file (or made with -new)', 1);
    const l = load(game, file, 'certificate request');
    if ('error' in l) return game.error(l.error, 1);
    const r = readCsr(l.text);
    if (!r) return game.error(`Unable to load X509 request from ${file}`, 1);
    const lines: string[] = [];
    if (p.flags.has('verify')) lines.push('Certificate request self-signature verify OK');
    if (p.flags.has('subject')) lines.push(`subject=${r.subject}`);
    if (p.flags.has('pubkey')) lines.push(publicPem(r.key));
    if (p.flags.has('text')) lines.push(csrText(r));
    if (!p.flags.has('noout')) lines.push(csrPem(r));
    return lines.join('\n');
  }
  // The key: -key file, or -newkey (written to -keyout).
  let key: KeyInfo;
  let keyText: string | null = null;
  if (one(p, 'key')) {
    const k = loadKey(game, one(p, 'key')!);
    if (typeof k === 'string') return game.error(k, 1);
    key = k;
  } else {
    if (!p.flags.has('nodes') && !p.flags.has('noenc')) return NO_PASSPHRASE(game);
    const spec = one(p, 'newkey') ?? 'rsa:2048';
    const [algo, size] = spec.split(':');
    if (/^rsa$/i.test(algo)) key = newKey(game, 'RSA', Number(size ?? 2048));
    else if (/^ec$/i.test(algo)) {
      const curve = (p.values.pkeyopt ?? []).map((o) => o.split(':')).find(([k]) => k === 'ec_paramgen_curve')?.[1];
      if (!curve || !CURVES[curve]) return game.error('req: Error generating EC key: -newkey ec needs -pkeyopt ec_paramgen_curve:P-256', 1);
      key = newKey(game, 'EC', CURVES[curve]);
    } else return game.error(`req: Unknown algorithm ${algo}`, 1);
    keyText = keyPem(key);
  }
  const extList = p.values.addext;
  const finish = (dn: string): string => {
    const out: string[] = [];
    if (keyText) {
      const ko = one(p, 'keyout');
      if (ko && ko !== '-') {
        const e = writeOut(game, ko, keyText, true);
        if (e) return game.error(e, 1);
      } else out.push(keyText);
    }
    let base: Extensions = {};
    if (one(p, 'config') && (one(p, 'extensions') || one(p, 'reqexts'))) {
      const e = confExtensions(game, 'req', one(p, 'config')!, one(p, 'extensions') ?? one(p, 'reqexts'));
      if (typeof e === 'string') return game.error(e, 1);
      base = e;
    } else if (p.flags.has('x509')) base = V3_CA;
    const ext = addexts(extList, base);
    if (typeof ext === 'string') return game.error(ext, 1);
    let text: string;
    if (p.flags.has('x509')) {
      const days = Number(one(p, 'days') ?? 30);
      const c = { ...makeCertificate({ subject: dn, key, issuer: dn, signer: key.id, serial: one(p, 'set_serial') ? Number(one(p, 'set_serial')).toString(16).toUpperCase() : randomSerial(game), start: now, end: now + days * DAY, ext }), sig: key.alg };
      text = pem(c);
      if (p.flags.has('text')) out.push(certText(c));
    } else {
      const r = { subject: dn, key, ext };
      text = csrPem(r);
      if (p.flags.has('text')) out.push(csrText(r));
    }
    const o = one(p, 'out');
    if (!p.flags.has('noout')) {
      if (o && o !== '-') {
        const e = writeOut(game, o, text);
        if (e) return game.error(e, 1);
      } else out.push(text);
    }
    return out.join('\n');
  };
  const subj = one(p, 'subj');
  if (subj !== undefined) {
    const dn = parseSubj(subj);
    if (dn === null)
      return game.error(`req: subject name is expected to be in the format /type0=value0/type1=value1/type2=... where characters may be escaped by \\. This name is not in that format: '${subj}'\nreq: Error making certificate request`, 1);
    if (!dn) return game.error('req: No objects specified in config file\nreq: Error making certificate request', 1);
    return finish(dn);
  }
  // No -subj: the questions of the default configuration.
  const who = game.who;
  const answers: [string, string][] = [];
  const intro = [
    'You are about to be asked to enter information that will be incorporated',
    'into your certificate request.',
    'What you are about to enter is what is called a Distinguished Name or a DN.',
    'There are quite a few fields but you can leave some blank',
    "For some fields there will be a default value,",
    "If you enter '.', the field will be left blank.",
    '-----',
  ].join('\n');
  const ask = (k: number): void => {
    game.ask(DN_PROMPTS[k][1], (v) => {
      const value = v === '' ? DN_PROMPTS[k][2] : v === '.' ? '' : v;
      if (value) answers.push([DN_PROMPTS[k][0], value]);
      if (k + 1 < DN_PROMPTS.length) {
        ask(k + 1);
        return '';
      }
      const before = game.who;
      game.who = who;
      try {
        if (!answers.length) return game.error('req: No objects specified in config file\nreq: Error making certificate request', 1);
        return finish(answers.map(([a, b]) => `${a}=${b}`).join(', '));
      } finally {
        game.who = before;
      }
    });
  };
  ask(0);
  return intro;
}

// ——— x509 ———

const X509_VALUES = ['in', 'out', 'checkend', 'ext', 'CA', 'CAkey', 'CAserial', 'set_serial', 'days', 'extfile', 'extensions', 'copy_extensions', 'signkey', 'key', 'inform', 'outform', 'nameopt', 'certopt', 'CAform', 'CAkeyform', 'passin', 'not_before', 'not_after'];
const X509_FLAGS = ['noout', 'text', 'dates', 'startdate', 'enddate', 'subject', 'issuer', 'serial', 'fingerprint', 'modulus', 'pubkey', 'req', 'CAcreateserial', 'hash', 'subject_hash', 'issuer_hash', 'purpose', 'nocert', 'email', 'ocspid', 'x509toreq', 'noenc'];

function x509(game: Shell, args: string[], input: string | null): string {
  // The order of the printing options matters: read it from the line.
  const p = options(args, X509_VALUES, X509_FLAGS, true);
  if (p.bad) return unknown(game, 'x509', p.bad, true);
  const file = one(p, 'in');
  const now = Math.floor(nowUtc(game) / 1000) * 1000;
  let c: Certificate;
  const notes: string[] = [];
  if (p.flags.has('req')) {
    let text = input;
    if (file) {
      const l = load(game, file, 'certificate request');
      if ('error' in l) return game.error(l.error, 1);
      text = l.text;
    }
    const r = readCsr(text);
    if (!r) return game.error(`Unable to load X509 request from ${file ?? '<stdin>'}`, 1);
    notes.push('Certificate request self-signature ok', `subject=${r.subject}`);
    const days = Number(one(p, 'days') ?? 30);
    if (!Number.isFinite(days) || days <= 0) return game.error(`x509: Invalid number of days: ${one(p, 'days')}`, 1);
    // Extensions: the request's (only with -copy_extensions), then those of -extfile.
    let ext: Extensions = {};
    const copy = one(p, 'copy_extensions') ?? 'none';
    if (!['none', 'copy', 'copyall'].includes(copy)) return game.error(`x509: Invalid extension copy option: "${copy}"`, 1);
    if (copy !== 'none') ext = { ...r.ext };
    if (one(p, 'extfile')) {
      const e = confExtensions(game, 'x509', one(p, 'extfile')!, one(p, 'extensions'));
      if (typeof e === 'string') return game.error(e, 1);
      ext = copy === 'copy' ? { ...e, ...ext } : { ...ext, ...e };
    }
    const caFile = one(p, 'CA');
    const signFile = one(p, 'signkey') ?? one(p, 'key');
    if (caFile) {
      const l = load(game, caFile, 'CA certificate');
      if ('error' in l) return game.error(l.error, 1);
      const ca = read(l.text);
      if (!ca) return game.error(`Could not find CA certificate from ${caFile}\nUnable to load CA certificate`, 1);
      const keyFile = one(p, 'CAkey') ?? caFile;
      const k = loadKey(game, keyFile, 'CA private key');
      if (typeof k === 'string') return game.error(k, 1);
      if (!ca.key || ca.key.id !== k.id) return game.error('Error: CA certificate and CA private key do not match', 1);
      // The serial: -set_serial, otherwise the .srl file (created with -CAcreateserial).
      let serial: string;
      if (one(p, 'set_serial')) serial = BigInt(one(p, 'set_serial')!).toString(16).toUpperCase();
      else {
        const srl = one(p, 'CAserial') ?? `${caFile.replace(/\.[^./]*$/, '')}.srl`;
        const n = game.find(srl);
        if (n?.type === 'file') {
          const last = (game.read(srl) ?? '').trim();
          if (!/^[0-9A-Fa-f]+$/.test(last)) return game.error(`${srl}: unable to load number from ${srl}\nerror while loading serial number`, 1);
          serial = (BigInt(`0x${last}`) + 1n).toString(16).toUpperCase();
          if (serial.length % 2) serial = `0${serial}`;
        } else if (p.flags.has('CAcreateserial')) serial = randomSerial(game);
        else return game.error(`${srl}: No such file or directory\nerror while loading serial number`, 1);
        const e = writeOut(game, srl, serial);
        if (e) return game.error(e, 1);
      }
      c = { ...makeCertificate({ subject: r.subject, key: r.key, issuer: subject(ca), signer: ca.key.id, serial, start: now, end: now + days * DAY, ext }), sig: ca.key.alg };
    } else if (signFile) {
      const k = loadKey(game, signFile);
      if (typeof k === 'string') return game.error(k, 1);
      c = { ...makeCertificate({ subject: r.subject, key: k, issuer: r.subject, signer: k.id, serial: one(p, 'set_serial') ?? randomSerial(game), start: now, end: now + days * DAY, ext }), sig: k.alg };
    } else return game.error('x509: We need a private key to sign with, use -key or -CAkey or -CA with private key', 1);
  } else {
    let text = input;
    if (file) {
      const l = load(game, file, 'certificate');
      if ('error' in l) return game.error(l.error, 1);
      text = l.text;
    }
    const r = read(text);
    if (!r) return game.error(`Could not find certificate from ${file ?? '<stdin>'}\nUnable to load certificate`, 1);
    c = r;
  }
  // The printing options, in their order on the line.
  const lines: string[] = [];
  let status = 0;
  const digest: 'sha1' | 'sha256' = p.flags.has('sha256') ? 'sha256' : 'sha1';
  for (let i = 0; i < args.length; i++) {
    const a = args[i].replace(/^--(?=\w)/, '-').slice(1);
    if (X509_VALUES.includes(a)) {
      if (a === 'checkend') {
        const n = Number(args[i + 1]);
        const expires = c.end < nowUtc(game) + n * 1000;
        lines.push(expires ? 'Certificate will expire' : 'Certificate will not expire');
        if (expires) status = 1;
      } else if (a === 'ext') {
        const wanted = (args[i + 1] ?? '').split(',');
        const map: Record<string, keyof Extensions> = { subjectAltName: 'dns', basicConstraints: 'bc', keyUsage: 'ku', extendedKeyUsage: 'eku' };
        const e = c.key ? extensionsOf(c) : { dns: c.names };
        const chosen: Extensions = {};
        for (const w of wanted) {
          const k = map[w.trim()];
          if (!k) continue;
          if (k === 'dns' && (e.dns || e.ips)) Object.assign(chosen, { dns: e.dns, ips: e.ips });
          if (k === 'bc' && e.bc) Object.assign(chosen, { bc: e.bc, bcCritical: e.bcCritical, ca: e.ca, pathlen: e.pathlen });
          if (k === 'ku' && e.ku) Object.assign(chosen, { ku: e.ku, kuCritical: e.kuCritical });
          if (k === 'eku' && e.eku) chosen.eku = e.eku;
        }
        lines.push(...extensionLines(chosen, 0));
        if (!Object.keys(e).length) lines.push('No extensions in certificate');
      }
      i++;
      continue;
    }
    switch (a) {
      case 'text':
        lines.push(certText(c));
        break;
      case 'dates':
        lines.push(`notBefore=${dateOpenssl(c.start)}`, `notAfter=${dateOpenssl(c.end)}`);
        break;
      case 'startdate':
        lines.push(`notBefore=${dateOpenssl(c.start)}`);
        break;
      case 'enddate':
        lines.push(`notAfter=${dateOpenssl(c.end)}`);
        break;
      case 'subject':
        lines.push(`subject=${subject(c)}`);
        break;
      case 'issuer':
        lines.push(`issuer=${c.issuer}`);
        break;
      case 'serial':
        lines.push(`serial=${c.serial.toUpperCase()}`);
        break;
      case 'fingerprint':
        lines.push(fingerprint(c, digest));
        break;
      case 'modulus':
        lines.push(keyOf(c).alg === 'RSA' ? `Modulus=${modulus(keyOf(c))}` : 'Modulus=No modulus for this public key type');
        break;
      case 'pubkey':
        lines.push(publicPem(keyOf(c)));
        break;
      case 'hash':
      case 'subject_hash':
        lines.push(subjectHash(c));
        break;
      case 'issuer_hash':
        lines.push(hexIssuerHash(c));
        break;
    }
  }
  const out = one(p, 'out');
  const text = pem(c);
  if (out && out !== '-') {
    const e = writeOut(game, out, text);
    if (e) return game.error(e, 1);
  } else if (!p.flags.has('noout')) lines.push(text);
  if (notes.length) {
    game.error(notes.join('\n'));
    game.status = status;
  }
  if (status) game.status = status;
  return lines.join('\n');
}

const hexIssuerHash = (c: Certificate) => subjectHash({ ...c, subjectDn: c.issuer });

// ——— verify ———

/** The certificates of -CAfile (and the machine's store, as OpenSSL's default directory). */
function trustedFor(game: Shell, caFile: string | undefined, noDefault: boolean): Certificate[] | string {
  const out: Certificate[] = noDefault ? [] : trustStore(game);
  if (caFile) {
    const l = load(game, caFile, 'CA certificates');
    if ('error' in l) return `Error loading file ${caFile}`;
    const certs = readAll(l.text);
    if (!certs.length) return `Error loading file ${caFile}`;
    out.push(...certs);
  }
  return out;
}

function verifyCmd(game: Shell, args: string[]): string {
  const p = options(args, ['CAfile', 'CApath', 'untrusted', 'CRLfile', 'verify_hostname', 'purpose', 'attime', 'verify_depth'], ['crl_check', 'crl_check_all', 'partial_chain', 'show_chain', 'no-CAfile', 'no-CApath', 'no-CAstore', 'x509_strict', 'verbose']);
  if (p.bad) return unknown(game, 'verify', p.bad, false);
  const trusted = trustedFor(game, one(p, 'CAfile'), p.flags.has('no-CApath') && p.flags.has('no-CAfile'));
  if (typeof trusted === 'string') return game.error(trusted, 1);
  const untrusted: Certificate[] = [];
  for (const u of p.values.untrusted ?? []) {
    const l = load(game, u, 'untrusted certificates');
    if ('error' in l) return game.error(`Error loading file ${u}`, 1);
    untrusted.push(...readAll(l.text));
  }
  const crls: Crl[] = [];
  for (const f of p.values.CRLfile ?? []) {
    const l = load(game, f, 'CRLs');
    if ('error' in l) return game.error(`Error loading file ${f}`, 1);
    crls.push(...readCrls(l.text));
  }
  const files = p.rest.length ? p.rest : [];
  if (!files.length) return game.error('verify: a certificate to check is needed (verify [options] cert.pem)', 1);
  const purpose = one(p, 'purpose');
  const lines: string[] = [];
  let failed = false;
  for (const f of files) {
    const l = load(game, f, 'certificate');
    if ('error' in l) {
      game.error(`${l.error}\nUnable to load certificate file`);
      failed = true;
      continue;
    }
    const c = read(l.text);
    if (!c) {
      game.error(`Could not find certificate from ${f}\nUnable to load certificate file`);
      failed = true;
      continue;
    }
    const r = verify(c, {
      now: nowUtc(game),
      trusted,
      untrusted: [...untrusted, ...readAll(l.text).slice(1)],
      crls,
      crlCheck: p.flags.has('crl_check_all') ? 'all' : p.flags.has('crl_check') ? 'leaf' : 'none',
      host: one(p, 'verify_hostname') ?? null,
      purpose: purpose === 'sslserver' || purpose === 'sslclient' ? purpose : null,
      partial: p.flags.has('partial_chain'),
    });
    if (r.errors.length) {
      const e = r.errors[0];
      game.error([subject(r.chain[e.depth] ?? c), `error ${e.code} at ${e.depth} depth lookup: ${VERIFY_ERRORS[e.code]}`, `error ${f}: verification failed`].join('\n'));
      failed = true;
    } else {
      lines.push(`${f}: OK`);
      if (p.flags.has('show_chain')) {
        lines.push('Chain:');
        r.chain.forEach((x, i) => lines.push(`depth=${i}: ${subject(x)}${i === r.chain.length - 1 ? '' : ' (untrusted)'}`));
      }
    }
  }
  game.status = failed ? 2 : 0;
  return lines.join('\n');
}

// ——— s_client ———

function sClient(game: Shell, args: string[]): string {
  const p = options(args, ['connect', 'servername', 'CAfile', 'CApath', 'cert', 'key', 'verify_hostname', 'verify', 'port', 'host', 'starttls', 'alpn'], ['showcerts', 'quiet', 'brief', 'verify_return_error', 'no-CAfile', 'no-CApath', 'tls1_2', 'tls1_3', 'crlf', 'ign_eof', 'state', 'debug', 'prexit', 'no_ign_eof']);
  if (p.bad) return game.error(`s_client: Unknown option: -${p.bad}\ns_client: Use -help for summary.`, 1);
  if (!pkiNet(game)) return legacySClient(game, args);
  const target = one(p, 'connect') ?? (p.rest[0]?.includes(':') ? p.rest[0] : '');
  const [host, port = '443'] = target.split(':');
  if (!host) return game.error('s_client: -connect host:port is required', 1);
  const sni = one(p, 'servername') ?? (/^\d+(\.\d+){3}$/.test(host) ? null : host);
  let clientChain: string | undefined;
  if (one(p, 'cert')) {
    const l = load(game, one(p, 'cert')!, 'client certificate');
    if ('error' in l) return game.error(`${l.error}\nunable to load client certificate file`, 1);
    const k = loadKey(game, one(p, 'key') ?? one(p, 'cert')!);
    if (typeof k === 'string') return game.error(`${k}\nunable to load client certificate private key file`, 1);
    const c = read(l.text);
    if (!c || c.key?.id !== k.id) return game.error('error setting private key\n...:error:05800074:x509 certificate routines:X509_check_private_key:key values mismatch', 1);
    clientChain = l.text;
  }
  const r = tlsRequest(game, sni ?? host, '/', Number(port), { certificate: clientChain, trace: false });
  if (r === 'unknown') return game.error(`BIO_lookup_ex: ${host}: Name or service not known\nconnect:errno=0`, 1);
  if (!r?.certificate) return game.error(`connect to ${host} port ${port} failed: Connection refused\nconnect:errno=111`, 1);
  const chain = readAll(r.certificate);
  const leaf = chain[0];
  if (!leaf) return game.error('write:errno=104', 1);
  const trusted = trustedFor(game, one(p, 'CAfile'), false);
  if (typeof trusted === 'string') return game.error(trusted, 1);
  const res = verify(leaf, { now: nowUtc(game), trusted, untrusted: chain.slice(1), host: one(p, 'verify_hostname') ?? null, purpose: 'sslserver', all: true });
  const errAt = (d: number) => res.errors.filter((e) => e.depth === d);
  const out: string[] = ['CONNECTED(00000003)'];
  // The verify callback, from the top of the chain built down to the leaf.
  const shown = res.chain.length;
  for (let d = shown - 1; d >= 0; d--) {
    const c = res.chain[d];
    const errs = errAt(d);
    if (!errs.length) out.push(`depth=${d} ${subject(c)}`, 'verify return:1');
    for (const e of errs) {
      out.push(`depth=${d} ${subject(c)}`, `verify error:num=${e.code}:${VERIFY_ERRORS[e.code]}`);
      if (e.code === 10) out.push(`notAfter=${dateOpenssl(c.end)}`);
      if (e.code === 9) out.push(`notBefore=${dateOpenssl(c.start)}`);
      out.push('verify return:1');
    }
    if (errs.length) out.push(`depth=${d} ${subject(c)}`, 'verify return:1');
  }
  const final: VerifyError | undefined = res.errors.at(-1);
  if (final && p.flags.has('verify_return_error')) return game.error([...out, `${'80BB0B6B297F0000'}:error:0A000086:SSL routines:tls_post_process_server_certificate:certificate verify failed:../ssl/statem/statem_clnt.c:2102:`].join('\n'), 1);
  out.push('---', 'Certificate chain');
  chain.forEach((c, i) => {
    out.push(` ${i} s:${subject(c)}`, `   i:${c.issuer}`, `   a:PKEY: ${keyOf(c).alg === 'RSA' ? 'rsaEncryption' : 'id-ecPublicKey'}, ${keyOf(c).bits} (bit); sigalg: ${sigName(c.sig)}`, `   v:NotBefore: ${dateOpenssl(c.start)}; NotAfter: ${dateOpenssl(c.end)}`);
    if (p.flags.has('showcerts')) out.push(pem(c));
  });
  out.push('---');
  if (!p.flags.has('showcerts')) out.push('Server certificate', pem(leaf));
  out.push(`subject=${subject(leaf)}`, `issuer=${leaf.issuer}`, '---');
  const names = (r as Response & { clientCaNames?: string[] }).clientCaNames;
  out.push(...(names?.length ? ['Acceptable client certificate CA names', ...names] : ['No client certificate CA names sent']));
  out.push(
    'Peer signing digest: SHA256',
    `Peer signature type: ${keyOf(leaf).alg === 'RSA' ? 'rsa_pss_rsae_sha256' : 'ecdsa_secp256r1_sha256'}`,
    'Negotiated TLS1.3 group: X25519MLKEM768',
    '---',
    `SSL handshake has read ${1200 + chain.length * 820} bytes and written ${clientChain ? 1520 : 1561} bytes`,
    final ? `Verification error: ${VERIFY_ERRORS[final.code]}` : 'Verification: OK',
    '---',
    'New, TLSv1.3, Cipher is TLS_AES_256_GCM_SHA384',
    'Protocol: TLSv1.3',
    `Server public key is ${keyOf(leaf).bits} bit`,
    'This TLS version forbids renegotiation.',
    'Compression: NONE',
    'Expansion: NONE',
    'No ALPN negotiated',
    'Early data was not sent',
    `Verify return code: ${final ? `${final.code} (${VERIFY_ERRORS[final.code]})` : '0 (ok)'}`,
    '---',
    'DONE',
  );
  return out.join('\n');
}

// The machine's own nginx, for a story without an internal PKI (Let's Encrypt's certificates).
function legacySClient(game: Shell, args: string[]): string {
  let target = '';
  let sni: string | null = null;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '-connect') target = args[++i] ?? '';
    else if (args[i] === '-servername') sni = args[++i] ?? '';
  }
  const [host, port = '443'] = target.split(':');
  if (!host) return game.error('s_client: -connect host:port is required');
  const localNames = ['localhost', '127.0.0.1', ...(game.state.nginx?.names ?? [])];
  if (!localNames.includes(host.toLowerCase())) return game.error(`BIO_lookup_ex: ${host}: Name or service not known\nconnect:errno=0`);
  const r = httpRequest(game, sni ?? host, '/', Number(port));
  if (!r?.certificate) return game.error(`connect to ${host} port ${port} failed: Connection refused\nconnect:errno=111`);
  const c = read(r.certificate)!;
  const problem = checkCertificate(game, r.certificate, sni ?? host);
  const code = !problem ? '0 (ok)' : problem.includes('expired') ? '10 (certificate has expired)' : problem.includes('not yet') ? '9 (certificate is not yet valid)' : '62 (hostname mismatch)';
  return [
    'CONNECTED(00000003)',
    `depth=0 ${subject(c)}`,
    ...(problem?.includes('expired') ? ['verify error:num=10:certificate has expired', `notAfter=${dateOpenssl(c.end)}`] : []),
    'verify return:1',
    '---',
    'Certificate chain',
    ` 0 s:${subject(c)}`,
    `   i:${c.issuer}`,
    '   a:PKEY: id-ecPublicKey, 256 (bit); sigalg: ecdsa-with-SHA384',
    `   v:NotBefore: ${dateOpenssl(c.start)}; NotAfter: ${dateOpenssl(c.end)}`,
    '---',
    'Server certificate',
    pem(c),
    `subject=${subject(c)}`,
    `issuer=${c.issuer}`,
    '---',
    'SSL handshake has read 2563 bytes and written 404 bytes',
    `Verify return code: ${code}`,
    '---',
    'DONE',
  ].join('\n');
}

// ——— ca ———

interface CaConfig {
  file: string;
  section: string;
  conf: Record<string, Record<string, string>>;
  get: (k: string) => string | undefined;
}

function caConfig(game: Shell, p: Parsed): CaConfig | string {
  const file = one(p, 'config') ?? DEFAULT_CNF;
  const l = load(game, file, 'config');
  if ('error' in l) return `Can't open "${file}" for reading, No such file or directory\nerror loading the config file '${file}'`;
  const conf = readConf(l.text);
  const section = one(p, 'name') ?? conf.ca?.default_ca;
  if (!section || !conf[section]) return `variable lookup failed for ca::default_ca\nUsing configuration from ${file}`;
  return { file, section, conf, get: (k) => conf[section][k] };
}

/** The CA's certificate and key (the key needs root, as it should). */
function caKeys(game: Shell, cfg: CaConfig): { ca: Certificate; key: KeyInfo } | string {
  const certFile = cfg.get('certificate') ?? '';
  const keyFile = cfg.get('private_key') ?? '';
  const k = loadKey(game, keyFile, 'CA private key');
  if (typeof k === 'string') return k;
  const l = load(game, certFile, 'CA certificate');
  if ('error' in l) return l.error;
  const ca = read(l.text);
  if (!ca) return `Could not find CA certificate from ${certFile}`;
  if (ca.key?.id !== k.id) return 'CA certificate and CA private key do not match';
  return { ca, key: k };
}

function caCmd(game: Shell, args: string[]): string {
  const p = options(
    args,
    ['config', 'name', 'in', 'out', 'days', 'extensions', 'extfile', 'revoke', 'crl_reason', 'crldays', 'crlhours', 'policy', 'md', 'cert', 'keyfile', 'status', 'subj', 'passin', 'startdate', 'enddate', 'outdir'],
    ['batch', 'notext', 'gencrl', 'updatedb', 'verbose', 'selfsign', 'preserveDN', 'noemailDN'],
    true,
  );
  if (p.bad) return unknown(game, 'ca', p.bad, true);
  const cfg = caConfig(game, p);
  if (typeof cfg === 'string') return game.error(cfg, 1);
  const head = `Using configuration from ${cfg.file}`;
  const db = cfg.get('database') ?? '';
  const dbText = game.read(db);
  if (dbText === null) return game.error(`${head}\n${db}: No such file or directory\nunable to open '${db}'`, 1);
  const index = readIndex(dbText);
  const now = Math.floor(nowUtc(game) / 1000) * 1000;
  const saveDb = (entries: IndexEntry[]): string | null => {
    const old = writeOut(game, `${db}.old`, dbText);
    return old ?? writeOut(game, db, writeIndex(entries));
  };
  // -status serial
  if (one(p, 'status')) {
    const s = one(p, 'status')!.toUpperCase();
    const e = index.find((x) => x.serial === s);
    if (!e) return game.error(`${head}\nSerial ${s} not present in db.\nError verifying serial ${s}!`, 1);
    game.error(`${head}\n${s}=${e.status === 'V' ? 'Valid' : e.status === 'R' ? 'Revoked' : 'Expired'} (${e.status})`);
    game.status = 0;
    return '';
  }
  // -revoke file
  if (one(p, 'revoke')) {
    const keys = caKeys(game, cfg);
    if (typeof keys === 'string') return game.error(`${head}\n${keys}`, 1);
    const f = one(p, 'revoke')!;
    const l = load(game, f, 'certificate');
    if ('error' in l) return game.error(`${head}\n${l.error}`, 1);
    const c = read(l.text);
    if (!c) return game.error(`${head}\nCould not find certificate from ${f}`, 1);
    const reason = one(p, 'crl_reason');
    if (reason && !REASONS[reason]) return game.error(`${head}\nUnknown CRL reason ${reason}\nError in revocation arguments`, 1);
    const serial = c.serial.toUpperCase();
    const lines = [head];
    let e = index.find((x) => x.serial.replace(/^0+/, '') === serial.replace(/^0+/, ''));
    if (!e) {
      lines.push(`Adding Entry with serial number ${serial} to DB for ${slashDn(subject(c))}`);
      e = { status: 'V', expiry: c.end, serial, file: 'unknown', subject: slashDn(subject(c)) };
      index.push(e);
    }
    if (e.status === 'R') return game.error([...lines, `ERROR:Already revoked, serial number ${e.serial}`].join('\n'), 1);
    e.status = 'R';
    e.revoked = now;
    if (reason) e.reason = reason;
    const w = saveDb(index);
    if (w) return game.error([...lines, w].join('\n'), 1);
    lines.push(`Revoking Certificate ${e.serial}.`, 'Database updated');
    game.error(lines.join('\n'));
    game.status = 0;
    return '';
  }
  // -gencrl
  if (p.flags.has('gencrl')) {
    const keys = caKeys(game, cfg);
    if (typeof keys === 'string') return game.error(`${head}\n${keys}`, 1);
    const days = Number(one(p, 'crldays') ?? cfg.get('default_crl_days') ?? NaN);
    const hours = Number(one(p, 'crlhours') ?? 0);
    if (!Number.isFinite(days) && !hours) return game.error(`${head}\ncannot lookup how long until the next CRL is issued`, 1);
    const numberFile = cfg.get('crlnumber');
    let number: string | undefined;
    if (numberFile) {
      const t = (game.read(numberFile) ?? '').trim();
      if (!/^[0-9A-Fa-f]+$/.test(t)) return game.error(`${head}\nerror while loading CRL number`, 1);
      number = t.toUpperCase();
    }
    const crl: Crl = {
      issuer: subject(keys.ca),
      signer: keys.key.id,
      last: now,
      next: now + (Number.isFinite(days) ? days : 0) * DAY + hours * 3_600_000,
      number,
      revoked: index.filter((x) => x.status === 'R').map((x) => ({ serial: x.serial, date: x.revoked ?? now, ...(x.reason ? { reason: x.reason } : {}) })),
    };
    if (numberFile && number) {
      const next = (BigInt(`0x${number}`) + 1n).toString(16).toUpperCase().padStart(number.length, '0');
      writeOut(game, `${numberFile}.old`, `${number}\n`);
      const e = writeOut(game, numberFile, `${next}\n`);
      if (e) return game.error(`${head}\n${e}`, 1);
    }
    const text = crlPem(crl);
    const out = one(p, 'out');
    game.error(head);
    game.status = 0;
    if (out) {
      const e = writeOut(game, out, text);
      if (e) return game.error(e, 1);
      return '';
    }
    return text;
  }
  // Signing a request.
  const inFile = one(p, 'in') ?? p.rest[0];
  if (!inFile) return game.error(`${head}\nNo request to sign: give it with -in file.csr`, 1);
  const keys = caKeys(game, cfg);
  if (typeof keys === 'string') return game.error(`${head}\n${keys}`, 1);
  const l = load(game, inFile, 'certificate request');
  if ('error' in l) return game.error(`${head}\n${l.error}`, 1);
  const r = readCsr(l.text);
  if (!r) return game.error(`${head}\nUnable to load certificate request from ${inFile}`, 1);
  if (!cnOf(r.subject)) return game.error(`${head}\nCheck that the request matches the signature\nSignature ok\nThe commonName field needed to be supplied and was missing`, 1);
  const attr = readConf(game.read(`${db}.attr`) ?? '')['']['unique_subject'] ?? 'yes';
  if (/^y/i.test(attr)) {
    const dup = index.find((x) => x.status === 'V' && x.subject === slashDn(r.subject));
    if (dup) return game.error(`${head}\nCheck that the request matches the signature\nSignature ok\nERROR:There is already a certificate for ${dup.subject}\nThe matching entry has the following details\nType          :Valid\nExpires on    :${utcTime(dup.expiry)}\nSerial Number :${dup.serial}\nFile name     :${dup.file}\nSubject Name  :${dup.subject}`, 1);
  }
  const serialFile = cfg.get('serial') ?? '';
  const serial = (game.read(serialFile) ?? '').trim().toUpperCase();
  if (!/^[0-9A-F]+$/.test(serial)) return game.error(`${head}\n${serialFile}: No such file or directory\nerror while loading serial number`, 1);
  const days = Number(one(p, 'days') ?? cfg.get('default_days') ?? 30);
  let ext: Extensions = {};
  const copy = cfg.get('copy_extensions') ?? 'none';
  if (copy !== 'none') ext = { ...r.ext };
  const section = one(p, 'extensions') ?? cfg.get('x509_extensions');
  if (section) {
    const e = one(p, 'extfile') ? confExtensions(game, 'ca', one(p, 'extfile')!, section) : sectionExtensions(cfg.conf, section);
    if (typeof e === 'string') return game.error(`${head}\n${e}`, 1);
    ext = copy === 'copy' ? { ...e, ...ext } : { ...ext, ...e };
  }
  const c = { ...makeCertificate({ subject: r.subject, key: r.key, issuer: subject(keys.ca), signer: keys.key.id, serial, start: now, end: now + days * DAY, ext }), sig: keys.key.alg };
  const s = serialText(serial);
  const details = [
    'Check that the request matches the signature',
    'Signature ok',
    'Certificate Details:',
    `        Serial Number: ${s.short ?? s.long}`,
    '        Validity',
    `            Not Before: ${dateOpenssl(c.start)}`,
    `            Not After : ${dateOpenssl(c.end)}`,
    '        Subject:',
    ...dnParts(r.subject).map(([k, v]) => `            ${longName(k).padEnd(26)}= ${v}`),
    ...(Object.keys(ext).length ? ['        X509v3 extensions:', ...extensionLines(ext, 12, { skid: skid(c.key!.id), akid: skid(keys.key.id) })] : []),
    `Certificate is to be certified until ${dateOpenssl(c.end)} (${days} days)`,
  ];
  const who = game.who;
  const text = p.flags.has('notext') ? pem(c) : `${certText(c)}\n${pem(c)}`;
  const out = one(p, 'out');
  // Writes the certificate, the serial and the database; null if all went well.
  const commit = (): string | null => {
    const before = game.who;
    game.who = who;
    try {
      const dir = cfg.get('new_certs_dir');
      if (dir) {
        const e = writeOut(game, `${dir}/${serial}.pem`, text);
        if (e) return e;
      }
      if (out) {
        const e = writeOut(game, out, text);
        if (e) return e;
      }
      let next = (BigInt(`0x${serial}`) + 1n).toString(16).toUpperCase();
      if (next.length < serial.length) next = next.padStart(serial.length, '0');
      writeOut(game, `${serialFile}.old`, `${serial}\n`);
      writeOut(game, serialFile, `${next}\n`);
      index.push({ status: 'V', expiry: c.end, serial, file: 'unknown', subject: slashDn(r.subject) });
      const w = saveDb(index);
      if (w) return w;
      writeOut(game, `${db}.attr`, `unique_subject = ${/^y/i.test(attr) ? 'yes' : 'no'}\n`);
      return null;
    } finally {
      game.who = before;
    }
  };
  const done = ['Write out database with 1 new entries', 'Database updated'];
  if (p.flags.has('batch')) {
    const e = commit();
    if (e) return game.error([head, ...details, e].join('\n'), 1);
    game.error([head, ...details, '', ...done].join('\n'));
    game.status = 0;
    return out ? '' : text;
  }
  game.ask('Sign the certificate? [y/n]:', (yes) => {
    if (!/^y/i.test(yes)) return '\n\nCERTIFICATE WILL NOT BE CERTIFIED';
    game.ask('\n1 out of 1 certificate requests certified, commit? [y/n]', (ok) => {
      if (!/^y/i.test(ok)) return 'CERTIFICATION CANCELED';
      const e = commit();
      if (e) return game.error(e, 1);
      return [...done, ...(out ? [] : [text])].join('\n');
    });
    return '';
  });
  return [head, ...details].join('\n');
}

// ——— crl ———

function crlCmd(game: Shell, args: string[]): string {
  const p = options(args, ['in', 'out', 'CAfile', 'inform', 'outform', 'nameopt'], ['noout', 'text', 'nextupdate', 'lastupdate', 'issuer', 'hash', 'crlnumber', 'verify'], true);
  if (p.bad) return unknown(game, 'crl', p.bad, true);
  const f = one(p, 'in');
  if (!f) return game.error('crl: a CRL is read with -in file', 1);
  const l = load(game, f, 'CRL');
  if ('error' in l) return game.error(l.error, 1);
  const c = readCrls(l.text)[0];
  if (!c) return game.error(`Could not find CRL from ${f}\nunable to load CRL`, 1);
  const lines: string[] = [];
  if (one(p, 'CAfile')) {
    const t = load(game, one(p, 'CAfile')!, 'CA certificates');
    if ('error' in t) return game.error(t.error, 1);
    const ok = readAll(t.text).some((x) => x.key?.id === c.signer && subject(x) === c.issuer);
    if (ok) {
      game.error('verify OK');
      game.status = 0;
    } else return game.error('verify failure\nunable to verify CRL', 1);
  }
  for (const a of args.map((x) => x.replace(/^--?/, ''))) {
    if (a === 'issuer') lines.push(`issuer=${c.issuer}`);
    if (a === 'lastupdate') lines.push(`lastUpdate=${dateOpenssl(c.last)}`);
    if (a === 'nextupdate') lines.push(`nextUpdate=${dateOpenssl(c.next)}`);
    if (a === 'crlnumber') lines.push(`crlNumber=0x${c.number ?? ''}`);
    if (a === 'hash') lines.push(subjectHash({ cn: '', names: [], issuer: '', serial: '0', start: 0, end: 0, subjectDn: c.issuer }));
    if (a === 'text') lines.push(crlText(c));
  }
  if (!p.flags.has('noout')) lines.push(crlPem(c));
  return lines.join('\n');
}

// ——— update-ca-certificates ———

function filesUnder(game: Shell, dir: string): string[] {
  const n = game.find(dir);
  if (n?.type !== 'directory') return [];
  return Object.keys(n.children)
    .sort()
    .flatMap((name) => {
      const path = `${dir}/${name}`;
      const c = game.find(path);
      return c?.type === 'directory' ? filesUnder(game, path) : [path];
    });
}

function updateCaCertificates(game: Shell, args: string[]): string {
  const fresh = args.includes('--fresh') || args.includes('-f');
  const bad = args.find((a) => !['--fresh', '-f', '--verbose', '-v', '--localcertsdir', '--certsconf'].includes(a));
  if (bad) return game.error(`/usr/sbin/update-ca-certificates: unknown option ${bad}`, 1);
  const certs = '/etc/ssl/certs';
  const lines = ['Updating certificates in /etc/ssl/certs...'];
  if (game.who !== 'root' || !game.can(game.find(certs) ?? { type: 'directory', children: {} }, 'w'))
    return game.error([...lines, `/usr/sbin/update-ca-certificates: 140: cannot create /etc/ssl/certs/ca-certificates.crt.new: Permission denied`].join('\n'), 2);
  // What should be trusted: ca-certificates.conf's lines, then the local *.crt.
  const wanted: { name: string; path: string; text: string }[] = [];
  for (const raw of (game.read(CA_CONF) ?? '').split('\n')) {
    const l = raw.trim();
    if (!l || l.startsWith('#') || l.startsWith('!')) continue;
    const path = `${MOZILLA}/${l}`;
    const text = game.read(path);
    if (text !== null) wanted.push({ name: l.split('/').at(-1)!.replace(/\.crt$/, '.pem'), path, text });
  }
  for (const path of filesUnder(game, LOCAL_CAS).filter((x) => x.endsWith('.crt'))) {
    const text = game.read(path) ?? '';
    if (readAll(text).length !== 1) {
      lines.push(`rehash: warning: skipping ${path.split('/').at(-1)!.replace(/\.crt$/, '.pem')},it does not contain exactly one certificate or CRL`);
      if (!readAll(text).length) continue;
    }
    wanted.push({ name: path.split('/').at(-1)!.replace(/\.crt$/, '.pem').replace(/ /g, '_'), path, text });
  }
  const dir = game.find(certs);
  if (dir?.type !== 'directory') return game.error(`${lines[0]}\nln: failed to create symbolic link in '${certs}': No such file or directory`, 1);
  const linked = Object.entries(dir.children).filter(([n, x]) => n.endsWith('.pem') && x.type === 'file' && x.link !== undefined).map(([n]) => n);
  if (fresh) for (const n of Object.keys(dir.children)) if (dir.children[n].type === 'file' && (dir.children[n] as File).link !== undefined) delete dir.children[n];
  const before = fresh ? [] : linked;
  const names = wanted.map((w) => w.name);
  const added = names.filter((n) => !before.includes(n));
  const removed = before.filter((n) => !names.includes(n));
  for (const n of removed) delete dir.children[n];
  // Hash links (a1b2c3d4.0 → name.pem), redone each time.
  for (const n of Object.keys(dir.children)) if (/^[0-9a-f]{8}\.\d$/.test(n)) delete dir.children[n];
  for (const w of wanted) {
    dir.children[w.name] = { type: 'file', content: '', link: w.path, owner: 'root', mode: 'rwxrwxrwx' };
    const c = readAll(w.text)[0];
    if (c) dir.children[`${subjectHash(c)}.0`] = { type: 'file', content: '', link: w.name, owner: 'root', mode: 'rwxrwxrwx' };
  }
  dir.children['ca-certificates.crt'] = { type: 'file', content: wanted.map((w) => w.text.trim()).join('\n'), lines: true, owner: 'root', mode: 'rw-r--r--' };
  lines.push(`${added.length} added, ${removed.length} removed; done.`, 'Running hooks in /etc/ca-certificates/update.d...', 'done.');
  return lines.join('\n');
}

// ——— curl on a story with an internal PKI ———

const CURL_VALUES = ['-H', '--header', '-o', '--output', '-X', '--request', '-d', '--data', '-A', '--user-agent', '-u', '--user', '-w', '--write-out', '-e', '--referer', '--cacert', '--capath', '--cert', '--key', '--resolve', '--connect-timeout', '-m', '--max-time', '--cert-type', '--key-type', '-E'];
const CURL_FLAGS = ['-k', '--insecure', '-s', '--silent', '-S', '--show-error', '-f', '--fail', '-I', '--head', '-i', '--include', '-v', '--verbose', '-L', '--location', '-4', '-6', '--ipv4', '--ipv6', '--fail-with-body', '--no-progress-meter'];
const LETTERS = 'ksSfIivL46';

export function pkiCurl(game: Shell, args: string[]): string {
  const flags = new Set<string>();
  const values: Record<string, string> = {};
  let url: string | undefined;
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (CURL_VALUES.includes(a)) values[a] = args[++i] ?? '';
    else if (CURL_FLAGS.includes(a)) flags.add(a);
    else if (/^-[A-Za-z0-9]+$/.test(a) && [...a.slice(1)].every((x) => LETTERS.includes(x) || x === 'o')) {
      for (const x of a.slice(1)) {
        if (x === 'o') values['-o'] = args[++i] ?? '';
        else flags.add(`-${x}`);
      }
    } else if (a.startsWith('--') && a.includes('=') && CURL_VALUES.includes(a.slice(0, a.indexOf('=')))) values[a.slice(0, a.indexOf('='))] = a.slice(a.indexOf('=') + 1);
    else if (a.startsWith('-')) return game.error(`curl: option ${a}: is unknown\ncurl: try 'curl --help' or 'curl --manual' for more information`, 2);
    else url ??= a;
  }
  const has = (...k: string[]) => k.some((x) => flags.has(x));
  const silent = has('-s', '--silent') && !has('-S', '--show-error');
  const fail = (code: number, message: string, help = false) => {
    if (!silent) game.error(`curl: (${code}) ${message}${help && !has('-s', '--silent') ? `\n${SSL_HELP}` : ''}`);
    game.status = code;
    return '';
  };
  if (!url) return game.error("curl: no URL specified\ncurl: try 'curl --help' or 'curl --manual' for more information", 2);
  const m = /^(?:(https?):\/\/)?([^/:]+)(?::(\d+))?(.*)$/.exec(url);
  if (!m) return fail(3, 'URL rejected: Malformed input to a URL function');
  const scheme = m[1] ?? 'http';
  const host = m[2];
  const port = Number(m[3] ?? (scheme === 'https' ? 443 : 80));
  const path = m[4] || '/';
  const verbose: string[] = [];
  const net = pkiNet(game)!;
  const ip = net.addresses[net.hosts[host.toLowerCase()] ?? ''] ?? (host === 'localhost' ? '127.0.0.1' : host);
  // The client certificate (--cert file, --key file).
  let clientChain: string | undefined;
  const certFile = values['--cert'] ?? values['-E'];
  if (certFile) {
    const n = game.find(certFile);
    if (!n || n.type !== 'file' || !game.can(n, 'r')) return fail(58, `could not load PEM client certificate from ${certFile}, OpenSSL error error:80000002:system library::No such file or directory, (no key found, wrong pass phrase, or wrong file format?)`);
    const text = game.read(certFile) ?? '';
    const keyFile = values['--key'] ?? certFile;
    const kn = game.find(keyFile);
    const key = kn?.type === 'file' && game.can(kn, 'r') ? readKey(game.read(keyFile)) : null;
    if (!key) return fail(58, `unable to set private key file: '${keyFile}' type PEM`);
    const c = read(text);
    if (!c || c.key?.id !== key.id) return fail(58, `unable to set private key file: '${keyFile}' type PEM`);
    clientChain = text;
  }
  const r = tlsRequest(game, host, path, port, { certificate: scheme === 'https' ? clientChain : undefined, method: values['-X'] ?? values['--request'] ?? (values['-d'] ?? values['--data'] ? 'POST' : undefined) });
  if (r === 'unknown') return fail(6, `Could not resolve host: ${host}`);
  if (has('-v', '--verbose')) verbose.push(`*   Trying ${ip}:${port}...`);
  if (!r) return fail(7, `Failed to connect to ${host} port ${port} after 0 ms: Couldn't connect to server`);
  if (has('-v', '--verbose')) verbose.push(`* Connected to ${host} (${ip}) port ${port}`);
  if (scheme === 'https') {
    const chain = readAll(r.certificate ?? null);
    const leaf = chain[0];
    const insecure = has('-k', '--insecure');
    const caFile = values['--cacert'];
    if (has('-v', '--verbose')) verbose.push('* ALPN: curl offers h2,http/1.1', '* TLSv1.3 (OUT), TLS handshake, Client hello (1):', `*  CAfile: ${caFile ?? BUNDLE}`, `*  CApath: ${values['--capath'] ?? '/etc/ssl/certs'}`);
    if (!leaf) return fail(35, 'OpenSSL/3.5.1: error:0A000410:SSL routines::ssl/tls alert handshake failure');
    game.state.lastPeerIssuer = leaf.issuer;
    let trusted: Certificate[];
    if (caFile) {
      const n = game.find(caFile);
      if (!n || n.type !== 'file' || !game.can(n, 'r')) return fail(77, `error setting certificate file: ${caFile}`);
      trusted = readAll(game.read(caFile));
    } else trusted = trustStore(game);
    if (has('-v', '--verbose'))
      verbose.push('* TLSv1.3 (IN), TLS handshake, Server hello (2):', '* TLSv1.3 (IN), TLS handshake, Certificate (11):', '* TLSv1.3 (IN), TLS handshake, CERT verify (15):', '* TLSv1.3 (IN), TLS handshake, Finished (20):', '* SSL connection using TLSv1.3 / TLS_AES_256_GCM_SHA384 / X25519MLKEM768 / ' + (keyOf(leaf).alg === 'RSA' ? 'RSASSA-PSS' : 'id-ecPublicKey'), '* Server certificate:', `*  subject: ${subject(leaf)}`, `*  start date: ${dateOpenssl(leaf.start)}`, `*  expire date: ${dateOpenssl(leaf.end)}`);
    if (!insecure) {
      if (!leaf.key) {
        const problem = checkCertificate(game, r.certificate ?? null, host);
        if (problem) return (flush(game, verbose), fail(60, problem, true));
      } else {
        const res = verify(leaf, { now: nowUtc(game), trusted, untrusted: chain.slice(1), partial: true, purpose: 'sslserver' });
        if (res.errors.length) return (flush(game, verbose), fail(60, `SSL certificate problem: ${VERIFY_ERRORS[res.errors[0].code]}`, true));
        if (!matchesHost(leaf, host))
          return (flush(game, verbose), fail(60, leaf.san || leaf.names.length ? `SSL: no alternative certificate subject name matches target hostname '${host}'` : `SSL: certificate subject name '${leaf.cn}' does not match target hostname '${host}'`, true));
      }
    }
    if (has('-v', '--verbose')) {
      const matched = leaf.names.find((n) => matchesHost({ ...leaf, names: [n] }, host));
      if (matched) verbose.push(`*  subjectAltName: host "${host}" matched cert's "${matched}"`);
      verbose.push(`*  issuer: ${leaf.issuer}`, insecure ? '*  SSL certificate verification failed, continuing anyway!' : '*  SSL certificate verify ok.');
    }
  }
  if (has('-v', '--verbose')) verbose.push(`> ${values['-X'] ?? 'GET'} ${path} HTTP/1.1`, `> Host: ${host}`, '> User-Agent: curl/8.14.1', '> Accept: */*', '>', `< ${r.headers[0]}`);
  flush(game, verbose);
  const code = r.code;
  if (has('-f', '--fail') && code >= 400) return fail(22, `The requested URL returned error: ${code}`);
  let shown = has('-I', '--head') ? r.headers.join('\n') : has('-i', '--include') ? `${r.headers.join('\n')}\n\n${r.body}` : r.body;
  const out = values['-o'] ?? values['--output'];
  if (out) {
    if (out !== '/dev/null') {
      const e = writeOut(game, out, shown);
      if (e) return fail(23, `client returned ERROR on write of ${shown.length} bytes`);
    }
    shown = '';
  }
  const w = values['-w'] ?? values['--write-out'];
  if (w !== undefined) shown += w.replace(/%\{http_code\}|%\{response_code\}/g, String(code)).replace(/%\{ssl_verify_result\}/g, '0').replace(/\\n/g, '\n');
  game.status = 0;
  return shown.replace(/\n$/, '');
}

// curl -v's lines go to the error output, before what follows.
function flush(game: Shell, verbose: string[]) {
  if (verbose.length) {
    const s = game.status;
    game.error(verbose.join('\n'));
    game.status = s;
  }
  verbose.length = 0;
}

// ——— The command ———

export const OPENSSL: Record<string, Command> = {
  openssl: {
    ownOptions: true,
    launch: ({ args, input, game }) => {
      const [under, ...rest] = args;
      switch (under) {
        case 'version':
          return VERSION;
        case 'x509':
          return x509(game, rest, input);
        case 's_client':
          return sClient(game, rest);
        case 'genpkey':
          return genpkey(game, rest);
        case 'genrsa':
          return genrsa(game, rest);
        case 'ecparam':
          return ecparam(game, rest);
        case 'pkey':
          return pkey(game, rest);
        case 'rsa':
          return pkey(game, rest, true);
        case 'req':
          return req(game, rest);
        case 'verify':
          return verifyCmd(game, rest);
        case 'ca':
          return caCmd(game, rest);
        case 'crl':
          return crlCmd(game, rest);
        case undefined:
          return game.error(game.t('openssl-usage'));
        default:
          return game.error(`Invalid command '${under}'; type "help" for a list.`, 1);
      }
    },
  },
  'update-ca-certificates': { ownOptions: true, section: 8, launch: ({ args, game }) => updateCaCertificates(game, args) },
};

// For the chapters: does `game` (as a client, with its trust store or `trusted`) trust what this name serves?
export function servedOk(game: Shell, host: string, trusted?: Certificate[]): { ok: boolean; code?: number; chain: Certificate[] } {
  const r = tlsRequest(game, host, '/', 443, { trace: false });
  if (!r || r === 'unknown') return { ok: false, chain: [] };
  const chain = readAll(r.certificate ?? null);
  if (!chain[0]) return { ok: false, chain };
  const res = verify(chain[0], { now: nowUtc(game), trusted: trusted ?? trustStore(game), untrusted: chain.slice(1), partial: true, purpose: 'sslserver', host });
  return { ok: !res.errors.length, code: res.errors[0]?.code, chain };
}

