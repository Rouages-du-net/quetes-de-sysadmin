// A machine's mail: Postfix (main.cf read like postconf, the queue,
// deliveries and /var/log/mail.log), OpenDKIM (opendkim.conf, the key,
// signing as mail goes through the milter) and, on the other side, remote
// mail servers that check SPF, DKIM and DMARC with the simulated DNS
// (dns.ts: they see what the secondary publishes, like the rest of the internet).
// Based on the documentation of Postfix (https://www.postfix.org/postconf.5.html,
// https://www.postfix.org/MILTER_README.html, https://www.postfix.org/postqueue.1.html),
// OpenDKIM (opendkim.conf(5), opendkim-genkey(8), opendkim-testkey(8), Debian's
// opendkim.conf) and RFC 7208 (SPF), 6376 (DKIM) and 7489 (DMARC).
//
//   state.mail = {
//     ip: the machine's public address (the one recipients see),
//     file: the waiting messages (deferred), counter: for their identifiers,
//     postfix: main.cf loaded, dkim: opendkim.conf loaded,
//     providers: the remote servers, by domain (declared by the chapter),
//     restored: what was accepted elsewhere (for the checks),
//   }
//
// Differences: no real SMTP nor real cryptography (a "public" key is
// computed from the private one); the remote servers query DNS without a
// cache; Postfix doesn't retry on its own (postqueue -f); Postfix's chroot is
// only simulated for the milter's socket; no KeyTable/SigningTable nor
// DNSSEC.

import type { Game } from './shell';
import { dns, query, txtText, type Rr } from './dns';
import { systemd } from './systemd';

export interface Message {
  id: string;
  // The envelope sender (MAIL FROM) and the remaining recipients.
  forEachOf: string;
  a: string[];
  // The From: header (its domain counts for DMARC), the subject, the body.
  from: string;
  subject: string;
  body: string;
  arrives: number;
  size: number;
  // The last reason for waiting (postqueue -p).
  reason?: string;
  // The DKIM signature added by the milter (d= and s=, and the key that signed).
  signature?: Signature | null;
  // The machine that really sends it (for SPF); by default, this one.
  ip?: string;
}

export interface Signature {
  d: string;
  s: string;
  key: string;
}

export type SpfResult = 'pass' | 'fail' | 'softfail' | 'neutral' | 'none' | 'permerror' | 'temperror';

export interface Authentication {
  spf: SpfResult;
  // The domain SPF checked (the envelope's).
  domainSpf: string;
  dkim: 'pass' | 'fail' | 'none' | 'permerror';
  domainDkim?: string;
  reasonDkim?: string;
  dmarc: 'pass' | 'fail' | 'none' | 'permerror';
  policy?: string;
  domainFrom: string;
}

// A remote mail server: its MX, its address, and what it answers to a message.
export interface Provider {
  mx: string;
  ip: string;
  // "250 …": accepted; "4xx": retry later; "5xx": rejected.
  receive: (game: Game, auth: Authentication, m: Message, recipient: string) => string;
}

export interface ConfPostfix {
  values: Record<string, string>;
}

export interface ConfDkim {
  domains: string[];
  selector?: string;
  key?: string;
  socket: string;
  mode: string;
  safe: boolean;
}

export interface MailState {
  ip: string;
  file: Message[];
  counter: number;
  postfix: ConfPostfix | null;
  dkim: ConfDkim | null;
  providers: Record<string, Provider>;
  restored: { message: Message; recipient: string; auth: Authentication }[];
}

export const mail = (game: Game): MailState | undefined => game.state.mail;

// ——— Postfix: main.cf ———

export const MAIN_CF = '/etc/postfix/main.cf';

// The useful default values (postconf -d), in Debian's version.
const DEFAULTS: Record<string, string> = {
  myhostname: '',
  mydomain: '',
  myorigin: '$myhostname',
  mydestination: '$myhostname, localhost.$mydomain, localhost',
  inet_interfaces: 'all',
  inet_protocols: 'all',
  relayhost: '',
  mynetworks: '127.0.0.0/8 [::ffff:127.0.0.0]/104 [::1]/128',
  smtpd_milters: '',
  non_smtpd_milters: '',
  milter_default_action: 'tempfail',
  milter_protocol: '6',
  alias_maps: 'hash:/etc/aliases',
  alias_database: 'hash:/etc/aliases',
  mailbox_size_limit: '0',
  recipient_delimiter: '',
  smtpd_banner: '$myhostname ESMTP $mail_name (Debian/GNU)',
  mail_name: 'Postfix',
  biff: 'yes',
  append_dot_mydomain: 'no',
  readme_directory: 'no',
  compatibility_level: '3.6',
  smtpd_tls_cert_file: '/etc/ssl/certs/ssl-cert-snakeoil.pem',
  smtpd_tls_key_file: '/etc/ssl/private/ssl-cert-snakeoil.key',
  smtpd_tls_security_level: 'none',
  smtp_tls_security_level: 'none',
  smtp_tls_CApath: '',
  smtpd_relay_restrictions: 'permit_mynetworks permit_sasl_authenticated defer_unauth_destination',
  maximal_queue_lifetime: '5d',
  queue_run_delay: '300s',
  data_directory: '/var/lib/postfix',
  queue_directory: '/var/spool/postfix',
  smtp_tls_session_cache_database: '',
  smtpd_tls_session_cache_database: '',
  smtpd_tls_loglevel: '0',
  smtp_tls_loglevel: '0',
  smtpd_tls_auth_only: 'no',
  smtpd_tls_protocols: '>=TLSv1',
  smtpd_tls_mandatory_protocols: '>=TLSv1',
  smtp_tls_protocols: '>=TLSv1',
  smtp_tls_mandatory_protocols: '>=TLSv1',
  smtpd_recipient_restrictions: '',
  smtpd_sender_restrictions: '',
  smtpd_helo_restrictions: '',
  smtpd_client_restrictions: '',
  smtpd_helo_required: 'no',
  smtpd_sasl_auth_enable: 'no',
  smtpd_sasl_type: 'cyrus',
  smtpd_sasl_path: 'smtpd',
  disable_vrfy_command: 'no',
  message_size_limit: '10240000',
  home_mailbox: '',
  mailbox_command: '',
  virtual_alias_maps: '$virtual_maps',
  virtual_mailbox_domains: '$virtual_mailbox_maps',
  local_recipient_maps: 'proxy:unix:passwd.byname $alias_maps',
  header_checks: '',
  smtputf8_enable: 'yes',
  delay_warning_time: '0h',
  notify_classes: 'resource, software',
  milter_mail_macros: 'i {auth_type} {auth_authen} {auth_author} {mail_addr} {mail_host} {mail_mailer}',
  milter_connect_macros: 'j {daemon_name} {daemon_addr} v _',
  milter_command_timeout: '30s',
  milter_connect_timeout: '30s',
  smtp_helo_name: '$myhostname',
};
export const PARAMETERS = Object.keys(DEFAULTS);

/** Reads main.cf like Postfix: "name = value", a line starting with a space continues the previous one. */
export function readMainCf(text: string): { values: Record<string, string>; unknown: string[]; order: string[] } {
  const values: Record<string, string> = {};
  const order: string[] = [];
  let active: string | null = null;
  for (const rawValue of text.split('\n')) {
    if (/^\s*#/.test(rawValue) || !rawValue.trim()) {
      active = null;
      continue;
    }
    if (/^\s/.test(rawValue) && active) {
      values[active] += ' ' + rawValue.trim();
      continue;
    }
    const m = /^([A-Za-z0-9_]+)\s*=\s*(.*)$/.exec(rawValue);
    if (!m) continue;
    active = m[1];
    values[m[1]] = m[2].trim();
    if (!order.includes(m[1])) order.push(m[1]);
  }
  return { values, unknown: order.filter((n) => !(n in DEFAULTS)), order };
}

/** A parameter's value, with $variables expanded (like postconf -x). */
export function parameter(game: Game, name: string, values?: Record<string, string>): string {
  const v = values ?? mail(game)?.postfix?.values ?? readMainCf(game.read(MAIN_CF) ?? '').values;
  const host = (game.read('/etc/hostname') ?? systemd(game)?.host ?? 'localhost').trim();
  const raw = (n: string): string => {
    if (n in v) return v[n];
    if (n === 'myhostname') return host;
    if (n === 'mydomain') return raw('myhostname').split('.').slice(1).join('.') || 'localdomain';
    return DEFAULTS[n] ?? '';
  };
  const expand = (text: string, depth = 0): string =>
    depth > 8 ? text : text.replace(/\$\{?([a-z_]+)\}?/g, (_, n: string) => expand(raw(n), depth + 1));
  return expand(raw(name));
}

// myorigin may name a file (/etc/mailname, as on Debian).
export function origin(game: Game): string {
  const o = parameter(game, 'myorigin');
  return (o.startsWith('/') ? (game.read(o) ?? '').trim() : o).toLowerCase();
}

/** postfix reload / start: main.cf becomes the configuration in use. */
export function loadPostfix(game: Game) {
  const c = mail(game);
  if (c) c.postfix = { values: readMainCf(game.read(MAIN_CF) ?? '').values };
}

// ——— OpenDKIM ———

export const OPENDKIM_CONF = '/etc/opendkim.conf';

/** Reads opendkim.conf: "Name value", one directive per line. */
export function readDkim(text: string): ConfDkim {
  const v: Record<string, string> = {};
  for (const l of text.split('\n')) {
    const m = /^\s*([A-Za-z]+)\s+(.+?)\s*$/.exec(l.replace(/#.*$/, ''));
    if (m) v[m[1].toLowerCase()] = m[2];
  }
  return {
    domains: (v.domain ?? '').split(/[\s,]+/).filter(Boolean).map((d) => d.toLowerCase()),
    selector: v.selector,
    key: v.keyfile,
    socket: v.socket ?? 'inet:8891@localhost',
    mode: v.mode ?? 'sv',
    safe: !/^(no|false|0)$/i.test(v.requiresafekeys ?? 'yes'),
  };
}

// Is the private key readable by others than its owner (and its group)? (RequireSafeKeys)
const notSure = (game: Game, path: string) => {
  const n = game.find(path);
  const mode = n?.mode ?? 'rw-r--r--';
  return /[rw]/.test(mode.slice(6, 9));
};

// Can the opendkim account traverse every directory leading to the file?
const traversable = (game: Game, path: string, account: string) => {
  const parts = path.split('/').filter(Boolean).slice(0, -1);
  for (let i = 1; i <= parts.length; i++) {
    const n = game.find('/' + parts.slice(0, i).join('/'));
    if (!n || !game.can(n, 'x', account)) return false;
  }
  return true;
};

/** For systemd: opendkim refuses to start if the key is missing, unreadable or unsafe. */
export function checkOpendkim(game: Game): string[] | null {
  const conf = readDkim(game.read(OPENDKIM_CONF) ?? '');
  if (!conf.key) return null;
  const n = game.find(conf.key);
  if (!n || n.type !== 'file') return [`opendkim: ${OPENDKIM_CONF}: ${conf.key}: open(): No such file or directory`];
  if (!game.can(n, 'r', 'opendkim') || !traversable(game, conf.key, 'opendkim')) return [`opendkim: ${OPENDKIM_CONF}: ${conf.key}: open(): Permission denied`];
  if (conf.safe && notSure(game, conf.key))
    return [`opendkim: ${OPENDKIM_CONF}: ${conf.key}: key data is not secure: ${conf.key} can be read or written by other users`];
  return null;
}

export function loadDkim(game: Game) {
  const c = mail(game);
  if (c) c.dkim = readDkim(game.read(OPENDKIM_CONF) ?? '');
}

export function stopDkim(game: Game) {
  const c = mail(game);
  if (c) c.dkim = null;
}

// A deterministic fingerprint of a text (FNV-1a), to make keys that look real.
function fingerprint(text: string, seed = 0): number {
  let h = 0x811c9dc5 ^ seed;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h;
}
const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
/** A deterministic base64 string of `length` characters, drawn from a seed. */
export function base64For(seed: string, length: number): string {
  let s = '';
  for (let i = 0; s.length < length; i++) s += B64[fingerprint(`${seed}:${i}`) % 64];
  return s;
}

/** The PEM private key opendkim-genkey makes (bits, domain, selector, draw). */
export function privateKey(seed: string, bits = 2048): string {
  const body = base64For(`prive:${seed}`, bits === 1024 ? 848 : 1624);
  const lines = body.match(/.{1,64}/g)!;
  return ['-----BEGIN PRIVATE KEY-----', ...lines, '-----END PRIVATE KEY-----'].join('\n');
}

/** The public key (p=) that goes with a private key: the same for the same file. */
export function publicKey(isPrivate: string): string | null {
  const body = /-----BEGIN (?:RSA )?PRIVATE KEY-----([\s\S]*?)-----END/.exec(isPrivate)?.[1].replace(/\s+/g, '');
  if (!body) return null;
  const long = body.length > 1000;
  return `MII${long ? 'BIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA' : 'GfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQC'}${base64For(`public:${body}`, long ? 342 : 174)}IDAQAB`;
}

/** opendkim-genkey's .txt file: the record to publish, cut into strings of at most 250 characters. */
export function dkimRecord(selector: string, domain: string, isPublic: string): string {
  const chunks = [`"v=DKIM1; h=sha256; k=rsa; "`, ...`p=${isPublic}`.match(/.{1,250}/g)!.map((m) => `"${m}"`)];
  return `${selector}._domainkey\tIN\tTXT\t( ${chunks.join('\n\t  ')} )  ; ----- DKIM key ${selector} for ${domain}`;
}

// ——— DNS as seen from the internet ———

// The remote servers query what the internet publishes (the secondary, and the others' zones).
// "primary" view: what the machine's server publishes (before the secondary has copied it).
export type View = 'secondary' | 'primary';
const ask = (game: Game, name: string, type: string, view: View = 'secondary'): { rrs: Rr[]; exists: boolean } => {
  const d = dns(game);
  if (!d) return { rrs: [], exists: false };
  const r = query(game, view, name, type, systemd(game)?.clock ?? 0);
  return { rrs: r.responses.filter((x) => x.type === type), exists: r.status === 'NOERROR' };
};
export const txt = (game: Game, name: string, view: View = 'secondary') => ask(game, name, 'TXT', view).rrs.map((r) => txtText(r.data));
const addresses = (game: Game, name: string, view: View) => ask(game, name, 'A', view).rrs.map((r) => r.data.trim());

// ——— SPF (RFC 7208) ———

const inNetwork = (ip: string, cidr: string) => {
  const [base, bits = '32'] = cidr.split('/');
  const n = (x: string) => x.split('.').reduce((t, o) => t * 256 + Number(o), 0);
  if (!/^\d+\.\d+\.\d+\.\d+$/.test(base) || !/^\d+\.\d+\.\d+\.\d+$/.test(ip)) return false;
  const mask = Number(bits) === 0 ? 0 : 2 ** 32 - 2 ** (32 - Number(bits));
  return (n(base) & mask) >>> 0 === (n(ip) & mask) >>> 0;
};

/** The SPF result for an address sending on behalf of a domain (check_host of RFC 7208). */
export function checkSpf(game: Game, ip: string, domain: string, account = { requetes: 0 }, view: View = 'secondary'): { result: SpfResult; reason: string } {
  const records = txt(game, domain, view).filter((t) => /^v=spf1(\s|$)/i.test(t));
  if (!records.length) return { result: 'none', reason: `no SPF record for ${domain}` };
  if (records.length > 1) return { result: 'permerror', reason: `more than one SPF record for ${domain}` };
  const terms = records[0].split(/\s+/).slice(1).filter(Boolean);
  let redirection: string | null = null;
  const RESULTS: Record<string, SpfResult> = { '+': 'pass', '-': 'fail', '~': 'softfail', '?': 'neutral' };
  for (const term of terms) {
    const mod = /^(redirect|exp)=(.+)$/i.exec(term);
    if (mod) {
      if (mod[1].toLowerCase() === 'redirect') redirection = mod[2];
      continue;
    }
    const m = /^([+\-~?]?)([a-z0-9]+)(?:[:]([^/]+))?(?:\/(\d+))?$/i.exec(term);
    if (!m) return { result: 'permerror', reason: `invalid term '${term}'` };
    const qualifier = RESULTS[m[1] || '+'];
    const mec = m[2].toLowerCase();
    const target = (m[3] ?? domain).toLowerCase();
    let found = false;
    if (['a', 'mx', 'include', 'exists', 'ptr'].includes(mec) && ++account.requetes > 10)
      return { result: 'permerror', reason: 'too many DNS lookups' };
    if (mec === 'all') found = true;
    else if (mec === 'ip4') found = !!m[3] && inNetwork(ip, m[4] ? `${m[3]}/${m[4]}` : m[3]);
    else if (mec === 'ip6') found = false;
    else if (mec === 'a') found = addresses(game, target, view).some((a) => inNetwork(ip, `${a}/${m[4] ?? 32}`));
    else if (mec === 'mx')
      found = ask(game, target, 'MX', view)
        .rrs.map((r) => r.data.split(' ')[1])
        .some((host) => addresses(game, host, view).some((a) => inNetwork(ip, `${a}/${m[4] ?? 32}`)));
    else if (mec === 'include') {
      if (!m[3]) return { result: 'permerror', reason: `include without a domain` };
      const r = checkSpf(game, ip, target, account, view);
      if (r.result === 'permerror' || r.result === 'none') return { result: 'permerror', reason: `include:${target}: ${r.reason}` };
      found = r.result === 'pass';
    } else if (mec === 'exists' || mec === 'ptr') found = false;
    else return { result: 'permerror', reason: `unknown mechanism '${mec}'` };
    if (found) return { result: qualifier, reason: `${ip} matched ${term} in the SPF record of ${domain}` };
  }
  if (redirection) return checkSpf(game, ip, redirection.toLowerCase(), account, view);
  return { result: 'neutral', reason: `no mechanism matched ${ip} for ${domain}` };
}

// ——— DKIM and DMARC ———

/** The tags of a DKIM or DMARC record: "v=DKIM1; k=rsa; p=…". */
export const tags = (text: string): Record<string, string> =>
  Object.fromEntries(
    text
      .split(';')
      .map((x) => x.trim())
      .filter(Boolean)
      .map((x) => {
        const i = x.indexOf('=');
        return [x.slice(0, i).trim().toLowerCase(), x.slice(i + 1).replace(/\s+/g, '')];
      }),
  );

export function checkDkim(game: Game, sig: Signature | null | undefined, view: View = 'secondary'): { result: Authentication['dkim']; reason?: string } {
  if (!sig) return { result: 'none', reason: 'message not signed' };
  const records = txt(game, `${sig.s}._domainkey.${sig.d}`, view);
  if (!records.length) return { result: 'permerror', reason: 'no key for signature' };
  const b = tags(records[0]);
  if (!b.p) return { result: 'fail', reason: 'key revoked' };
  if (b.p !== sig.key) return { result: 'fail', reason: 'signature did not verify' };
  return { result: 'pass' };
}

// The organizational domain (here, the last two levels: gardens.example).
const organisation = (d: string) => d.toLowerCase().split('.').slice(-2).join('.');
const domainFor = (address: string) => (/@([^>\s]+)>?\s*$/.exec(address)?.[1] ?? '').toLowerCase();

/** The DMARC policy published for a domain (null: none; "permerror": several or unreadable). */
export function dmarcPolicy(game: Game, domain: string, view: View = 'secondary'): Record<string, string> | 'permerror' | null {
  const listing = txt(game, `_dmarc.${domain}`, view).filter((t) => /^v=DMARC1(\s*;|$)/i.test(t));
  if (!listing.length) return null;
  if (listing.length > 1) return 'permerror';
  const b = tags(listing[0]);
  if (!['none', 'quarantine', 'reject'].includes((b.p ?? '').toLowerCase())) return 'permerror';
  return b;
}

/** What a receiving server checks: SPF (envelope), DKIM (signature), DMARC (alignment with From:). */
export function authenticate(game: Game, m: Message): Authentication {
  const ip = m.ip ?? mail(game)?.ip ?? '';
  const domainSpf = domainFor(m.forEachOf) || domainFor(`<${m.forEachOf}>`);
  const spf = checkSpf(game, ip, domainSpf).result;
  const dkim = checkDkim(game, m.signature);
  const domainFrom = domainFor(m.from);
  const policy = dmarcPolicy(game, domainFrom);
  const base = { spf, domainSpf, dkim: dkim.result, reasonDkim: dkim.reason, domainDkim: m.signature?.d, domainFrom };
  if (policy === null) return { ...base, dmarc: 'none' };
  if (policy === 'permerror') return { ...base, dmarc: 'permerror' };
  const aligne =
    (spf === 'pass' && organisation(domainSpf) === organisation(domainFrom)) ||
    (dkim.result === 'pass' && organisation(m.signature!.d) === organisation(domainFrom));
  return { ...base, dmarc: aligne ? 'pass' : 'fail', policy: policy.p.toLowerCase() };
}

// ——— The log (/var/log/mail.log) ———

export const MAIL_LOG = '/var/log/mail.log';

// "2027-05-03T09:30:01.123456+02:00", like rsyslog on Debian.
export function logTime(local: number): string {
  const d = new Date(local);
  const summer = (() => {
    const year = d.getUTCFullYear();
    const last = (month: number) => {
      const x = new Date(Date.UTC(year, month + 1, 0, 1));
      return x.getTime() - x.getUTCDay() * 86_400_000;
    };
    const utc = local - 3600_000;
    return utc >= last(2) && utc < last(9);
  })();
  return `${d.toISOString().slice(0, 19)}.${String(100000 + (local % 900000)).slice(0, 6)}${summer ? '+02:00' : '+01:00'}`;
}

let currentPid = 0;
/** A mail.log line: "host postfix/smtp[pid]: message". */
export function writeLog(game: Game, program: string, message: string) {
  const sd = systemd(game);
  const n = game.find(MAIL_LOG);
  if (!sd || n?.type !== 'file' || typeof n.content !== 'string') return;
  const pids: Record<string, number> = { pickup: 2401, cleanup: 2402, qmgr: 1188, smtp: 2404, local: 2405, smtpd: 2406, postqueue: 2407, postsuper: 2408, opendkim: 812 };
  currentPid = pids[program.replace(/^postfix\//, '')] ?? 2409;
  const line = `${logTime(sd.clock)} ${sd.host} ${program}[${currentPid}]: ${message}`;
  n.content = n.content ? `${n.content}\n${line}` : line;
}

// ——— Delivery ———

/** A queue identifier, like Postfix's (10 hexadecimal digits, upper case). */
export function newId(game: Game): string {
  const c = mail(game)!;
  c.counter++;
  return (fingerprint(`file:${c.counter}`) >>> 0).toString(16).toUpperCase().padStart(8, '0') + String.fromCharCode(65 + (c.counter % 6)) + String(c.counter % 10);
}

// A milter's socket in main.cf (inet:localhost:8891, unix:/path) compared with opendkim's (inet:8891@localhost, local:/path).
function joinedSocket(game: Game, milter: string): { ok: boolean; error?: string } {
  const c = mail(game)!;
  const enabled = systemd(game)?.services.opendkim?.state === 'active' && !!c.dkim;
  const inet = /^inet:(?:(\[?[^:\]]+\]?):)?(\d+)$/.exec(milter);
  const unix = /^unix:(.+)$/.exec(milter);
  if (!inet && !unix) return { ok: false, error: `warning: invalid milter address: ${milter}` };
  const refusal = `warning: connect to Milter service ${milter}: ${unix ? 'No such file or directory' : 'Connection refused'}`;
  if (!enabled) return { ok: false, error: refusal };
  const socket = c.dkim!.socket;
  if (inet) {
    const p = /^inet6?:(\d+)(?:@(.+))?$/.exec(socket);
    const host = (inet[1] ?? 'localhost').replace(/[[\]]/g, '');
    const local = ['localhost', '127.0.0.1'];
    const ok = !!p && p[1] === inet[2] && (!p[2] || local.includes(p[2])) && local.includes(host);
    return ok ? { ok } : { ok: false, error: refusal };
  }
  // Postfix runs in a chroot (/var/spool/postfix): the socket's path is relative to it.
  const l = /^(?:local|unix):(.+)$/.exec(socket);
  const ok = !!l && l[1] === `/var/spool/postfix${unix![1]}`;
  return ok ? { ok } : { ok: false, error: refusal };
}

/**
 * Going through cleanup: the milters (non_smtpd_milters for mail
 * submitted on the machine) add the DKIM signature. Returns null if the
 * message must wait (milter unreachable with milter_default_action =
 * tempfail).
 */
function signer(game: Game, m: Message): boolean {
  const c = mail(game)!;
  const milters = parameter(game, 'non_smtpd_milters').split(/[\s,]+/).filter(Boolean);
  m.signature = null;
  for (const milter of milters) {
    const p = joinedSocket(game, milter);
    if (!p.ok) {
      writeLog(game, 'postfix/cleanup', p.error ?? '');
      const action = parameter(game, 'milter_default_action');
      if (action === 'accept') continue;
      m.reason = '4.7.1 Service unavailable - try again later';
      writeLog(game, 'postfix/cleanup', `${m.id}: milter-reject: END-OF-MESSAGE from localhost[127.0.0.1]: 4.7.1 Service unavailable - try again later; from=<${m.forEachOf}> to=<${m.a[0]}>`);
      return false;
    }
    const conf = c.dkim!;
    const domain = domainFor(m.from);
    if (!conf.mode.includes('s') || !conf.domains.includes(domain) || !conf.selector || !conf.key) continue;
    const isPrivate = game.read(conf.key);
    const isPublic = isPrivate ? publicKey(isPrivate) : null;
    if (!isPublic) continue;
    m.signature = { d: domain, s: conf.selector, key: isPublic };
    writeLog(game, 'opendkim', `${m.id}: DKIM-Signature field added (s=${conf.selector}, d=${domain})`);
  }
  return true;
}

// Delivery to one recipient: local (our domains) or to a remote server.
function putBack(game: Game, m: Message, recipient: string): 'sent' | 'deferred' | 'bounced' {
  const c = mail(game)!;
  const domain = domainFor(recipient);
  const local = parameter(game, 'mydestination')
    .split(/[\s,]+/)
    .filter(Boolean)
    .map((x) => x.toLowerCase());
  const delay = Math.max(0, Math.round(((systemd(game)?.clock ?? m.arrives) - m.arrives) / 1000));
  if (local.includes(domain)) {
    drop(game, recipient, m);
    writeLog(game, 'postfix/local', `${m.id}: to=<${recipient}>, relay=local, delay=${delay}, delays=0.02/0.01/0/0.01, dsn=2.0.0, status=sent (delivered to mailbox)`);
    return 'sent';
  }
  const f = c.providers[domain];
  if (!f) {
    writeLog(game, 'postfix/smtp', `${m.id}: to=<${recipient}>, relay=none, delay=${delay}, delays=0.01/0/0.2/0, dsn=5.4.4, status=bounced (Host or domain name not found. Name service error for name=${domain} type=MX: Host not found)`);
    return 'bounced';
  }
  const auth = authenticate(game, m);
  const response = f.receive(game, auth, m, recipient);
  const relay = `${f.mx}[${f.ip}]:25`;
  const dsn = /^\d{3}[ -](\d\.\d+\.\d+)/.exec(response)?.[1] ?? '2.0.0';
  if (response.startsWith('2')) {
    c.restored.push({ message: m, recipient, auth });
    writeLog(game, 'postfix/smtp', `${m.id}: to=<${recipient}>, relay=${relay}, delay=${delay}, delays=0.02/0.01/0.31/0.12, dsn=${dsn}, status=sent (${response})`);
    return 'sent';
  }
  const status = response.startsWith('4') ? 'deferred' : 'bounced';
  m.reason = `host ${f.mx}[${f.ip}] said: ${response} (in reply to end of DATA command)`;
  writeLog(game, 'postfix/smtp', `${m.id}: to=<${recipient}>, relay=${relay}, delay=${delay}, delays=0.02/0.01/0.31/0.12, dsn=${dsn}, status=${status} (${m.reason})`);
  return status;
}

// The mailbox of a machine account (/var/mail/account, mbox format).
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const dateMbox = (ms: number) => {
  const d = new Date(ms);
  return `${DAYS[d.getUTCDay()]} ${MONTH[d.getUTCMonth()]} ${String(d.getUTCDate()).padStart(2)} ${d.toISOString().slice(11, 19)} ${d.getUTCFullYear()}`;
};

export function drop(game: Game, address: string, m: Message, headers: string[] = []) {
  const local = address.replace(/@.*$/, '').toLowerCase();
  const alias = new RegExp(`^${local}:\\s*(\\S+)`, 'm').exec(game.read('/etc/aliases') ?? '')?.[1];
  const account = alias ? alias.replace(/@.*$/, '') : local;
  if (!game.accounts.users[account]) return;
  const text = [
    `From ${m.forEachOf} ${dateMbox(systemd(game)?.clock ?? m.arrives)}`,
    ...headers,
    `From: ${m.from}`,
    `To: ${address}`,
    `Subject: ${m.subject}`,
    `Message-Id: <${m.id}@${parameter(game, 'myhostname')}>`,
    '',
    m.body,
    '',
  ].join('\n');
  const path = `/var/mail/${account}`;
  const n = game.find(path);
  if (n?.type === 'file') n.content = `${typeof n.content === 'string' && n.content ? n.content + '\n' : ''}${text}`;
  else if (game.find('/var/mail')?.type === 'directory')
    (game.find('/var/mail') as { children: Record<string, unknown> }).children[account] = {
      type: 'file',
      content: text,
      lines: true,
      owner: account,
      group: 'mail',
      mode: 'rw-rw----',
    };
}

/** Tries to deliver a message; it stays in the queue (deferred) while a recipient is waiting. */
export function attempt(game: Game, m: Message) {
  const c = mail(game)!;
  const remaining: string[] = [];
  for (const a of m.a) if (putBack(game, m, a) === 'deferred') remaining.push(a);
  m.a = remaining;
  if (!remaining.length) {
    writeLog(game, 'postfix/qmgr', `${m.id}: removed`);
    c.file = c.file.filter((x) => x !== m);
  } else if (!c.file.includes(m)) c.file.push(m);
}

/** Mail submitted on the machine (mail, sendmail): pickup, cleanup (milters), qmgr, then delivery. */
export function submit(game: Game, forEachOf: string, a: string[], subject: string, body: string, uid: number, from?: string): Message | null {
  const c = mail(game);
  if (!c) return null;
  const domain = origin(game);
  const sender = forEachOf.includes('@') ? forEachOf : `${forEachOf}@${domain}`;
  const recipients = a.map((x) => (x.includes('@') ? x : `${x}@${domain}`));
  const m: Message = {
    id: '',
    forEachOf: sender,
    a: recipients,
    from: from ?? sender,
    subject,
    body,
    arrives: systemd(game)?.clock ?? 0,
    size: 420 + body.length + subject.length,
  };
  m.id = newId(game);
  writeLog(game, 'postfix/pickup', `${m.id}: uid=${uid} from=<${forEachOf}>`);
  // Postfix stopped: the message waits in maildrop.
  if (systemd(game)?.services.postfix?.state !== 'active') {
    m.reason = 'mail system is down';
    c.file.push(m);
    return m;
  }
  writeLog(game, 'postfix/cleanup', `${m.id}: message-id=<${m.id}@${parameter(game, 'myhostname')}>`);
  if (!signer(game, m)) {
    c.file.push(m);
    return m;
  }
  writeLog(game, 'postfix/qmgr', `${m.id}: from=<${sender}>, size=${m.size}, nrcpt=${recipients.length} (queue active)`);
  attempt(game, m);
  return m;
}

/** postqueue -f: Postfix retries everything waiting (and re-signs what hadn't gone through the milter). */
export function empty(game: Game) {
  const c = mail(game)!;
  for (const m of [...c.file]) {
    if (m.reason === 'mail system is down' || m.reason?.startsWith('4.7.1 Service unavailable')) {
      m.reason = undefined;
      writeLog(game, 'postfix/cleanup', `${m.id}: message-id=<${m.id}@${parameter(game, 'myhostname')}>`);
      if (!signer(game, m)) continue;
    }
    attempt(game, m);
  }
}

/** postqueue -p (mailq): the queue. */
export function showFile(game: Game): string {
  const c = mail(game)!;
  if (!c.file.length) return 'Mail queue is empty';
  const blocks = c.file.map((m) => {
    const d = new Date(m.arrives);
    const date = `${DAYS[d.getUTCDay()]} ${MONTH[d.getUTCMonth()]} ${String(d.getUTCDate()).padStart(2)} ${d.toISOString().slice(11, 19)}`;
    return [
      `${m.id.padEnd(12)}${String(m.size).padStart(8)} ${date}  ${m.forEachOf}`,
      ...(m.reason ? [`(${m.reason})`] : []),
      ...m.a.map((a) => `${' '.repeat(41)}${a}`),
      '',
    ].join('\n');
  });
  const ko = Math.max(1, Math.round(c.file.reduce((t, m) => t + m.size, 0) / 1024));
  return ['-Queue ID-  --Size-- ----Arrival Time---- -Sender/Recipient-------', ...blocks, `-- ${ko} Kbytes in ${c.file.length} Request${c.file.length > 1 ? 's' : ''}.`].join('\n');
}

/** A checker's report (like check-auth): the results, and the Authentication-Results header. */
export function verificationReport(auth: Authentication, m: Message, mx: string): string {
  const dkim =
    auth.dkim === 'pass' ? `dkim=pass header.d=${auth.domainDkim} header.s=${m.signature?.s}` : `dkim=${auth.dkim} (${auth.reasonDkim ?? 'message not signed'})`;
  const dmarc = `dmarc=${auth.dmarc}${auth.policy ? ` (p=${auth.policy})` : ''} header.from=${auth.domainFrom}`;
  return [
    '==========================================================',
    'Summary of Results',
    '==========================================================',
    `SPF check:          ${auth.spf}`,
    `DKIM check:         ${auth.dkim}`,
    `DMARC check:        ${auth.dmarc}`,
    '==========================================================',
    '',
    `Authentication-Results: ${mx};`,
    `\tspf=${auth.spf} smtp.mailfrom=${m.forEachOf};`,
    `\t${dkim};`,
    `\t${dmarc}`,
  ].join('\n');
}

export const withoutSignature = (m: Message): Message => ({ ...m, signature: undefined });
export type { Rr };
