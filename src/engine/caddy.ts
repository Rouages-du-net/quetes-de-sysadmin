// A machine's Caddy: the Caddyfile read the way the caddyfile adapter reads
// it, the configuration applied on start and reload, and automatic HTTPS.
// For each site whose address is a domain name (neither http:// nor :80),
// Caddy itself obtains a certificate from Let's Encrypt (ACME) and redirects
// HTTP to HTTPS. The authority checks, from the internet, that the machine
// answers for that name on port 80 (HTTP-01 challenge) or 443 (TLS-ALPN-01):
// the name's DNS must lead here, and the firewall must let it through.
// Caddy's logs are JSON lines (zap).
// Sources: https://caddyserver.com/docs/caddyfile/concepts,
// https://caddyserver.com/docs/automatic-https,
// https://caddyserver.com/docs/caddyfile/directives,
// https://caddyserver.com/docs/command-line,
// https://letsencrypt.org/docs/challenge-types/
// Differences: a subset of the directives is applied (root, file_server,
// respond, redir, reverse_proxy); the others are recognised but have no
// effect; no named matchers or handle blocks; a single authority (Let's
// Encrypt, no ZeroSSL); a failed challenge is retried as soon as its cause
// has gone (instead of waiting for the delay); localhost and IP addresses
// get no internal certificate.

import type { Game, Shell } from './shell';
import { writeLog, systemd, toUtc } from './systemd';
import { verdict, type Firewall } from './firewall';
import { covers, DURATION, ISSUER, read as readCertificate, pem, type Certificate } from './tls';
import { privateKey, INTERMEDIATE } from './commands/certbot';
import { appRequest, type Response } from './nginx';
import type { Listening } from './commands/ss';

export const CADDYFILE = '/etc/caddy/Caddyfile';
export const PID = 812;
export const VERSION = 'v2.10.2 h1:g/gTYjGMD0dec+UgMw8SnfmJ3I9+M2TdvoRL/Ovu6U8=';
export const ACME_ISSUER = 'acme-v02.api.letsencrypt.org-directory';
const IT = 'https://acme-v02.api.letsencrypt.org/directory';
export const STOCKAGE = '/var/lib/caddy/.local/share/caddy';
const AUTOSAVE = '/var/lib/caddy/.config/caddy/autosave.json';
// An address of Let's Encrypt's validation servers (for the firewall).
const VALIDATOR = '198.51.100.77';

// ——— Reading the Caddyfile ———

export interface Directive {
  name: string;
  args: string[];
  line: number;
  block?: Directive[];
}

export interface Address {
  schema: string;
  host: string;
  port: number;
  // The text as written (for messages).
  text: string;
}

export interface Site {
  addresses: Address[];
  directives: Directive[];
  line: number;
}

export interface ConfigCaddy {
  global: Directive[];
  sites: Site[];
  // The first difference with what caddy fmt would write (line number), otherwise null.
  notFormatted: number | null;
}

// The directives known in sites, according to the Caddy 2.10 documentation.
const DIRECTIVES = new Set([
  'abort', 'acme_server', 'basic_auth', 'basicauth', 'bind', 'encode', 'error', 'file_server', 'forward_auth', 'fs', 'handle', 'handle_errors',
  'handle_path', 'header', 'import', 'intercept', 'invoke', 'log', 'log_append', 'log_skip', 'map', 'method', 'metrics', 'php_fastcgi', 'push',
  'redir', 'request_body', 'request_header', 'respond', 'reverse_proxy', 'rewrite', 'root', 'route', 'templates', 'tls', 'tracing', 'try_files',
  'uri', 'vars',
]);
const GLOBAL = new Set([
  'debug', 'http_port', 'https_port', 'default_bind', 'order', 'storage', 'storage_clean_interval', 'admin', 'persist_config', 'log', 'grace_period',
  'shutdown_delay', 'auto_https', 'email', 'default_sni', 'local_certs', 'skip_install_trust', 'acme_ca', 'acme_ca_root', 'acme_eab', 'acme_dns',
  'on_demand_tls', 'key_type', 'cert_issuer', 'renew_interval', 'ocsp_interval', 'ocsp_stapling', 'preferred_chains', 'servers', 'pki', 'events',
]);
// The directives that need at least one argument (without a block).
const WITH_ARGUMENT = new Set(['root', 'redir', 'respond', 'reverse_proxy', 'encode', 'rewrite', 'try_files', 'import', 'header', 'bind', 'tls']);

export class CaddyError extends Error {}

interface TokensLine {
  line: number;
  tokens: string[];
}

// Splits the text into lines of tokens (quotes, backticks, comments).
function split(text: string): TokensLine[] {
  const lines: TokensLine[] = [];
  text.split('\n').forEach((rawValue, i) => {
    const tokens: string[] = [];
    let active = '';
    let inside: string | null = null;
    let inCourse = false;
    for (let k = 0; k < rawValue.length; k++) {
      const c = rawValue[k];
      if (inside) {
        if (c === '\\' && inside === '"' && rawValue[k + 1] === '"') {
          active += '"';
          k++;
        } else if (c === inside) inside = null;
        else active += c;
        continue;
      }
      if (c === '"' || c === '`') {
        inside = c;
        inCourse = true;
        continue;
      }
      if (c === '#' && !inCourse) break;
      if (/\s/.test(c)) {
        if (inCourse) tokens.push(active);
        active = '';
        inCourse = false;
        continue;
      }
      active += c;
      inCourse = true;
    }
    if (inCourse) tokens.push(active);
    if (tokens.length) lines.push({ line: i + 1, tokens });
  });
  return lines;
}

/** A site address: [scheme://]host[:port], or :port. */
export function readAddress(text: string): Address {
  const m = /^(?:(https?):\/\/)?([^:/]*)(?::(\d+))?(\/.*)?$/.exec(text);
  const schema = m?.[1] ?? '';
  const host = (m?.[2] ?? text).toLowerCase();
  const port = m?.[3] ? Number(m[3]) : schema === 'http' ? 80 : 443;
  return { schema, host, port, text };
}

export const isIp = (s: string) => /^\d{1,3}(\.\d{1,3}){3}$/.test(s);

/** Reads a Caddyfile; throws CaddyError with Caddy's message (without "Error:"). */
export function readCaddyfile(text: string, file = CADDYFILE): ConfigCaddy {
  const lines = split(text);
  let i = 0;
  const expectedEnd = (line: number) => new CaddyError(`${file}:${line} - Error during parsing: Unexpected EOF`);
  const block = (opening: number, check: (d: Directive) => void): Directive[] => {
    const directives: Directive[] = [];
    while (i < lines.length) {
      const { line, tokens } = lines[i++];
      if (tokens[0] === '}' && tokens.length === 1) return directives;
      const opens = tokens.at(-1) === '{';
      const d: Directive = { name: tokens[0], args: (opens ? tokens.slice(1, -1) : tokens.slice(1)).filter((j) => j !== '}'), line };
      check(d);
      if (opens) d.block = block(line, () => {});
      directives.push(d);
      // "respond ok }": a closing brace at the end of a line is not allowed.
      if (!opens && tokens.length > 1 && tokens.at(-1) === '}') throw new CaddyError(`${file}:${line} - Error during parsing: Unexpected next token after '${tokens.at(-2)}' on same line`);
    }
    throw expectedEnd(opening);
  };
  const siteDirective = (d: Directive) => {
    if (!DIRECTIVES.has(d.name)) {
      const site = /[.:]/.test(d.name) || d.name.startsWith('http');
      throw new CaddyError(
        `${file}:${d.line}: unrecognized directive: ${d.name}${site ? '\nDid you mean to define a second site? If so, you must use curly braces around each site to separate their configurations.' : ''}`,
      );
    }
    if (WITH_ARGUMENT.has(d.name) && !d.args.length) throw new CaddyError(`${file}:${d.line} - Error during parsing: Wrong argument count or unexpected line ending after '${d.name}'`);
  };
  const config: ConfigCaddy = { global: [], sites: [], notFormatted: null };
  // The global options block: braces on their own, at the very top.
  if (lines[0]?.tokens.length === 1 && lines[0].tokens[0] === '{') {
    i = 1;
    config.global = block(lines[0].line, (d) => {
      if (!GLOBAL.has(d.name)) throw new CaddyError(`${file}:${d.line}: unrecognized global option: ${d.name}`);
    });
  }
  while (i < lines.length) {
    const { line, tokens } = lines[i++];
    if (tokens[0] === '}') throw new CaddyError(`${file}:${line} - Error during parsing: Unexpected '}' because no matching opening brace`);
    const opens = tokens.at(-1) === '{';
    const texts = (opens ? tokens.slice(0, -1) : tokens)
      .join(' ')
      .split(/[\s,]+/)
      .filter(Boolean);
    if (!opens && config.sites.length) {
      // After a first site in braces, a line without braces: a stray directive.
      siteDirective({ name: tokens[0], args: [], line });
      throw new CaddyError(`${file}:${line}: unrecognized directive: ${tokens[0]}`);
    }
    if (!texts.length) throw new CaddyError(`${file}:${line} - Error during parsing: Unexpected '{'`);
    let directives: Directive[];
    if (opens) directives = block(line, siteDirective);
    else {
      // A single site, without braces: the whole rest of the file belongs to it.
      directives = [];
      while (i < lines.length) {
        const l = lines[i++];
        if (l.tokens[0] === '}' && l.tokens.length === 1) throw new CaddyError(`${file}:${l.line} - Error during parsing: Unexpected '}' because no matching opening brace`);
        const o = l.tokens.at(-1) === '{';
        const d: Directive = { name: l.tokens[0], args: o ? l.tokens.slice(1, -1) : l.tokens.slice(1), line: l.line };
        siteDirective(d);
        if (o) d.block = block(l.line, () => {});
        directives.push(d);
      }
    }
    config.sites.push({ addresses: texts.map(readAddress), directives, line });
  }
  // Two sites cannot answer at the same address.
  const views = new Set<string>();
  config.sites.forEach((s, n) =>
    s.addresses.forEach((a, k) => {
      const key = `${a.schema}|${a.host}|${a.port}`;
      if (views.has(key)) throw new CaddyError(`server block ${n}, key ${k} (${a.text}): ambiguous site definition: ${a.text}`);
      views.add(key);
    }),
  );
  const own = formatValue(text).split('\n');
  const raw = text.replace(/\n+$/, '').split('\n');
  const difference = raw.findIndex((l, k) => l !== own[k]);
  config.notFormatted = difference !== -1 ? difference + 1 : own.length !== raw.length ? raw.length + 1 : null;
  return config;
}

/** What caddy fmt writes: one tab per brace level, one space between tokens, at most one blank line. */
export function formatValue(text: string): string {
  const output: string[] = [];
  let level = 0;
  let emptyBefore = false;
  for (const rawValue of text.split('\n')) {
    const line = rawValue.trim();
    if (!line) {
      if (output.length && !emptyBefore) output.push('');
      emptyBefore = true;
      continue;
    }
    emptyBefore = false;
    // One space between tokens, outside quotes and comments.
    let compact = '';
    let inside: string | null = null;
    for (let k = 0; k < line.length; k++) {
      const c = line[k];
      if (inside) {
        compact += c;
        if (c === inside) inside = null;
      } else if (c === '#') {
        compact += line.slice(k);
        break;
      } else if (/\s/.test(c)) {
        if (!compact.endsWith(' ')) compact += ' ';
      } else {
        if (c === '"' || c === '`') inside = c;
        compact += c;
      }
    }
    if (compact.startsWith('}')) level = Math.max(0, level - 1);
    output.push('\t'.repeat(level) + compact);
    if (compact.endsWith('{') && !compact.startsWith('#')) level++;
  }
  while (output.at(-1) === '') output.pop();
  return output.join('\n');
}

// ——— The sites as Caddy serves them ———

const global = (c: ConfigCaddy, name: string) => c.global.find((d) => d.name === name);
const modeHttps = (c: ConfigCaddy) => global(c, 'auto_https')?.args[0] ?? 'on';

/** Does the address get automatic HTTPS (ACME certificate)? */
export const managedOne = (c: ConfigCaddy, a: Address) =>
  !['off', 'disable_certs', 'ignore_loaded_certs'].includes(modeHttps(c)) && a.schema !== 'http' && a.port !== 80 && !!a.host && a.host.includes('.') && !isIp(a.host) && !a.host.includes('*');

/** The names whose certificate Caddy manages. */
export const managedNames = (c: ConfigCaddy) => [...new Set(c.sites.flatMap((s) => s.addresses.filter((a) => managedOne(c, a)).map((a) => a.host)))];

/** The ports Caddy listens on with this configuration. */
export function listenersPorts(c: ConfigCaddy): number[] {
  const ports = new Set(c.sites.flatMap((s) => s.addresses.map((a) => a.port)));
  if (managedNames(c).length && !['off', 'disable_redirects'].includes(modeHttps(c))) ports.add(80);
  return [...ports].sort((a, b) => a - b);
}

// ——— Caddy's state (state.caddy) ———

export interface CaddyState {
  // The configuration in service (null: Caddy is not running).
  load: ConfigCaddy | null;
  // The names under which the machine reaches itself (for curl).
  names: string[];
  // The machine's public address, and what public DNS says about each name.
  ip: string;
  dns: Record<string, string>;
  // The names for which obtaining the certificate failed (Caddy will retry).
  waiting: string[];
  attempts: Record<string, number>;
}

export const caddyState = (game: Game): CaddyState | undefined => game.state.caddy;

const certificateDirectory = (name: string) => `${STOCKAGE}/certificates/${ACME_ISSUER}/${name}`;

/** The certificate Caddy has for this name, if it is still valid. */
export function certificateFor(game: Game, name: string): { certificate: Certificate; content: string } | null {
  const content = game.read(`${certificateDirectory(name)}/${name}.crt`);
  const c = readCertificate(content);
  const now = toUtc(systemd(game)?.clock ?? 0);
  if (!c || !content || c.end < now || !covers(c, name)) return null;
  return { certificate: c, content };
}

// An instant in zap's format (seconds since 1970, with milliseconds).
const ts = (game: Game) => (toUtc(systemd(game)?.clock ?? 0) / 1000 + 0.123).toFixed(3);

/** A JSON line in caddy.service's journal. */
export function note(game: Game, level: string, logger: string | null, msg: string, fields: Record<string, unknown> = {}, advance = false) {
  const sd = systemd(game);
  if (!sd) return;
  const line = JSON.stringify({ level: level, ts: 0, ...(logger ? { logger } : {}), msg, ...fields }).replace('"ts":0', `"ts":${ts(game)}`);
  writeLog(sd, 'caddy.service', 'caddy', PID, line, level === 'error' ? 3 : level === 'warn' ? 4 : 6, advance);
}

/** The machine's Caddyfile, read; or Caddy's error. */
export function readConfigCaddy(game: Game, file = CADDYFILE): { config: ConfigCaddy } | { error: string } {
  const text = game.read(file);
  if (text === null) return { error: `reading config from file: open ${file}: no such file or directory` };
  try {
    return { config: readCaddyfile(text, file) };
  } catch (e) {
    if (e instanceof CaddyError) return { error: `adapting config using caddyfile: ${e.message}` };
    throw e;
  }
}

/** On service start and reload: null if all is well, otherwise the error lines. */
export function checkCaddy(game: Game): string[] | null {
  const r = readConfigCaddy(game);
  return 'error' in r ? [`Error: ${r.error}`] : null;
}

// Caddy's listening sockets (ss -tlnp): those of the configuration, and the admin API.
function listen(game: Game, c: ConfigCaddy | null) {
  const other = ((game.state.listening ?? []) as Listening[]).filter((e) => e.process !== 'caddy');
  const caddy: Listening[] = c ? [{ proto: 'tcp', address: '127.0.0.1', port: 2019, process: 'caddy', pid: PID }, ...listenersPorts(c).map((port) => ({ proto: 'tcp' as const, address: '*', port, process: 'caddy', pid: PID }))] : [];
  if (c && listenersPorts(c).includes(443)) caddy.push({ proto: 'udp', address: '*', port: 443, process: 'caddy', pid: PID });
  game.state.listening = [...other, ...caddy];
}

/** After a successful start or reload: Caddy applies its configuration and obtains the missing certificates. */
export function loadCaddy(game: Game) {
  const e = caddyState(game);
  const r = readConfigCaddy(game);
  if (!e || 'error' in r) return;
  const c = r.config;
  e.load = c;
  note(game, 'info', null, 'using config from file', { file: CADDYFILE });
  if (c.notFormatted !== null) note(game, 'warn', null, "Caddyfile input is not formatted; run 'caddy fmt --overwrite' to fix inconsistencies", { adapter: 'caddyfile', file: CADDYFILE, line: c.notFormatted });
  note(game, 'info', null, 'adapted config to JSON', { adapter: 'caddyfile' });
  note(game, 'info', 'admin', 'admin endpoint started', { address: 'localhost:2019', enforce_origin: false, origins: ['//localhost:2019', '//[::1]:2019', '//127.0.0.1:2019'] });
  // One "server" per port, like the adapter (srv0, srv1…).
  const ports = [...new Set(c.sites.flatMap((s) => s.addresses.map((a) => a.port)))].sort((a, b) => b - a);
  ports.forEach((port, n) => {
    const managed = c.sites.flatMap((s) => s.addresses.filter((a) => a.port === port && managedOne(c, a)));
    if (port === 80) note(game, 'warn', 'http.auto_https', 'server is listening only on the HTTP port, so no automatic HTTPS will be applied to this server', { server_name: `srv${n}`, http_port: 80 });
    else if (managed.length && !['off', 'disable_redirects'].includes(modeHttps(c))) note(game, 'info', 'http.auto_https', 'enabling automatic HTTP->HTTPS redirects', { server_name: `srv${n}` });
  });
  if (listenersPorts(c).includes(443)) note(game, 'info', 'http', 'enabling HTTP/3 listener', { addr: ':443' });
  listenersPorts(c).forEach((port) =>
    note(game, 'info', 'http.log', 'server running', { name: ports.includes(port) ? `srv${ports.indexOf(port)}` : 'remaining_auto_https_redirects', protocols: ['h1', 'h2', 'h3'] }),
  );
  note(game, 'info', null, 'autosaved config (load with --resume flag)', { file: AUTOSAVE });
  listen(game, c);
  const names = managedNames(c);
  if (names.length) note(game, 'info', 'http', 'enabling automatic TLS certificate management', { domains: names });
  note(game, 'info', null, 'serving initial configuration');
  e.waiting = [];
  for (const name of names) if (!certificateFor(game, name)) get(game, name);
}

/** When the service stops: nothing listens any more. */
export function stopCaddy(game: Game) {
  const e = caddyState(game);
  if (e) e.load = null;
  listen(game, null);
}

// Why the authority cannot validate this name (null: it can).
function problem(game: Game, name: string): { type: string; detail: string } | null {
  const e = caddyState(game)!;
  const ip = e.dns[name];
  if (!ip) return { type: 'dns', detail: `DNS problem: NXDOMAIN looking up A for ${name} - check that a DNS record exists for this domain` };
  if (ip !== e.ip) return { type: 'connection', detail: `${ip}: Timeout during connect (likely firewall problem)` };
  const pf = game.state.ufw as Firewall | undefined;
  const open = (port: number) => !pf || verdict(pf, port, VALIDATOR) === 'accepted';
  if (!open(80) && !open(443)) return { type: 'connection', detail: `${ip}: Timeout during connect (likely firewall problem)` };
  return null;
}

// A serial number, derived from the name and the number of attempts (deterministic).
function serial(name: string, n: number): string {
  let h = 0x811c9dc5;
  for (const c of `${name}#${n}`) h = Math.imul(h ^ c.charCodeAt(0), 0x01000193) >>> 0;
  return Array.from({ length: 5 }, (_, i) => ((Math.imul(h, i + 3) >>> 0) ^ (h >>> i)).toString(16).padStart(8, '0'))
    .join('')
    .slice(0, 36)
    .replace(/^./, '0');
}

// Creates the missing directories (owned by caddy), then writes the file.
function put(game: Game, path: string, content: string, mode: string) {
  const s = game as Shell;
  const before = s.who;
  s.who = 'root';
  const chunks = path.split('/').filter(Boolean);
  for (let k = 1; k < chunks.length; k++) {
    const directory = `/${chunks.slice(0, k).join('/')}`;
    if (!s.exists(directory)) s.place('caddy', directory, { type: 'directory', children: {}, owner: 'caddy', group: 'caddy', mode: 'rwx------' });
  }
  s.place('caddy', path, { type: 'file', content, lines: true, owner: 'caddy', group: 'caddy', mode });
  s.who = before;
}

/** Caddy requests a certificate for this name: it gets it, or records the failure (it will retry). */
export function get(game: Game, name: string): boolean {
  const e = caddyState(game)!;
  const trial = (e.attempts[name] = (e.attempts[name] ?? 0) + 1);
  note(game, 'info', 'tls.obtain', 'acquiring lock', { identifier: name }, true);
  note(game, 'info', 'tls.obtain', 'lock acquired', { identifier: name });
  note(game, 'info', 'tls.obtain', 'obtaining certificate', { identifier: name });
  const type = trial % 2 ? 'http-01' : 'tls-alpn-01';
  note(game, 'info', 'acme_client', 'trying to solve challenge', { identifier: name, challenge_type: type, ca: IT });
  const p = problem(game, name);
  if (p) {
    const urn = `urn:ietf:params:acme:error:${p.type}`;
    note(game, 'error', 'acme_client', 'challenge failed', { identifier: name, challenge_type: type, problem: { type: urn, title: '', detail: p.detail, instance: '', subproblems: [] } }, true);
    note(game, 'error', 'acme_client', 'validating authorization', {
      identifier: name,
      problem: { type: urn, title: '', detail: p.detail, instance: '', subproblems: [] },
      order: `https://acme-v02.api.letsencrypt.org/acme/order/2398412/${3_841_290_117 + trial}`,
      attempt: 1,
      max_attempts: 3,
    });
    const error = `HTTP 400 ${urn} - ${p.detail}`;
    note(game, 'error', 'tls.obtain', 'could not get certificate from issuer', { identifier: name, issuer: ACME_ISSUER, error: error });
    note(game, 'error', 'tls.obtain', 'will retry', {
      error: `[${name}] Obtain: [${name}] solving challenge: ${name}: [${name}] authorization failed: ${error} (ca=${IT})`,
      attempt: trial,
      retrying_in: 60 * 2 ** Math.min(trial - 1, 5),
      elapsed: 2.4 * trial,
      max_duration: 2_592_000,
    });
    note(game, 'info', 'tls.obtain', 'releasing lock', { identifier: name });
    if (!e.waiting.includes(name)) e.waiting.push(name);
    return false;
  }
  note(game, 'info', 'acme_client', 'authorization finalized', { identifier: name, authz_status: 'valid' }, true);
  note(game, 'info', 'acme_client', 'validations succeeded; finalizing order', { order: `https://acme-v02.api.letsencrypt.org/acme/order/2398412/${3_841_290_117 + trial}` });
  note(game, 'info', 'acme_client', 'successfully downloaded available certificate chains', { count: 2, first_url: `https://acme-v02.api.letsencrypt.org/acme/cert/${serial(name, trial)}` });
  const start = Math.floor((toUtc(systemd(game)?.clock ?? 0) - 3600_000) / 1000) * 1000;
  const c: Certificate = { cn: name, names: [name], issuer: ISSUER, serial: serial(name, trial), start, end: start + DURATION - 1000 };
  const directory = certificateDirectory(name);
  put(game, `${directory}/${name}.crt`, `${pem(c)}\n${INTERMEDIATE}`, 'rw-------');
  put(game, `${directory}/${name}.key`, privateKey(c.serial), 'rw-------');
  put(game, `${directory}/${name}.json`, JSON.stringify({ sans: [name], issuer_data: { url: `https://acme-v02.api.letsencrypt.org/acme/cert/${c.serial}`, ca: IT } }, null, '\t'), 'rw-------');
  note(game, 'info', 'tls.obtain', 'certificate obtained successfully', { identifier: name, issuer: ACME_ISSUER });
  note(game, 'info', 'tls.obtain', 'releasing lock', { identifier: name });
  e.waiting = e.waiting.filter((n) => n !== name);
  return true;
}

/**
 * Before each command: Caddy retries the failed certificates. The real
 * delay (one minute, then longer and longer) is skipped as soon as the cause
 * has gone; as long as it remains, nothing changes.
 */
export function retry(game: Game) {
  const e = caddyState(game);
  const sd = systemd(game);
  if (!e?.load || !e.waiting.length || sd?.services.caddy?.state !== 'active') return;
  for (const name of [...e.waiting]) {
    if (problem(game, name)) continue;
    sd.clock += 60_000;
    get(game, name);
  }
}

// ——— Requests ———

const REASONS: Record<number, string> = { 200: 'OK', 301: 'Moved Permanently', 302: 'Found', 307: 'Temporary Redirect', 308: 'Permanent Redirect', 404: 'Not Found', 502: 'Bad Gateway' };
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const dateHttp = (ms: number) => {
  const d = new Date(toUtc(ms));
  return `${DAYS[d.getUTCDay()]}, ${String(d.getUTCDate()).padStart(2, '0')} ${MONTH[d.getUTCMonth()]} ${d.getUTCFullYear()} ${d.toISOString().slice(11, 19)} GMT`;
};

export type CaddyResponse = Response | { tls: 'alert' };

function response(game: Game, https: boolean, code: number, body: string, headers: [string, string][], certificate?: string): Response {
  const date = dateHttp(systemd(game)?.clock ?? 0);
  const all: [string, string][] = [...(https ? [['Alt-Svc', 'h3=":443"; ma=2592000'] as [string, string]] : []), ...headers, ['Server', 'Caddy'], ['Date', date]];
  if (!headers.some(([n]) => n === 'Content-Length')) all.push(['Content-Length', String(new TextEncoder().encode(body).length)]);
  const first = https ? `HTTP/2 ${code} ` : `HTTP/1.1 ${code} ${REASONS[code] ?? ''}`.trimEnd();
  return { code, body, headers: [first, ...all.map(([n, v]) => `${https ? n.toLowerCase() : n}: ${v}`)], certificate };
}

const replace = (text: string, host: string, path: string, schema: string) =>
  text.replaceAll('{uri}', path).replaceAll('{path}', path.split('?')[0]).replaceAll('{host}', host).replaceAll('{scheme}', schema).replaceAll('{http.request.uri}', path).replaceAll('{http.request.host}', host);

// A path matcher (/x, /x*, *): a directive's first argument, if it starts with / or is *.
function correspond(matcher: string, path: string): boolean {
  if (matcher === '*') return true;
  const p = path.split('?')[0];
  return matcher.endsWith('*') ? p.startsWith(matcher.slice(0, -1)) : p === matcher;
}

// What a site serves, in the order of Caddy's directives (redir, respond, reverse_proxy, file_server).
function serve(game: Game, site: Site, host: string, path: string, https: boolean, certificate?: string): Response {
  const schema = https ? 'https' : 'http';
  const withMatcher = (d: Directive) => (d.args[0] === '*' || d.args[0]?.startsWith('/') ? { matcher: d.args[0], rest: d.args.slice(1) } : { matcher: '*', rest: d.args });
  for (const d of site.directives.filter((x) => x.name === 'redir')) {
    const { matcher, rest } = d.args.length >= 2 && (d.args[0] === '*' || (d.args[0].startsWith('/') && !/^\d{3}$|^(permanent|temporary|html)$/.test(d.args[1] ?? ''))) ? withMatcher(d) : { matcher: '*', rest: d.args };
    if (!correspond(matcher, path)) continue;
    const code = rest[1] === 'permanent' ? 301 : rest[1] === 'temporary' || !rest[1] ? 302 : /^\d{3}$/.test(rest[1]) ? Number(rest[1]) : 302;
    return response(game, https, code, '', [['Location', replace(rest[0], host, path, schema)]], certificate);
  }
  for (const d of site.directives.filter((x) => x.name === 'respond')) {
    const { matcher, rest } = withMatcher(d);
    if (!correspond(matcher, path)) continue;
    const code = /^\d{3}$/.test(rest[0] ?? '') ? Number(rest[0]) : /^\d{3}$/.test(rest[1] ?? '') ? Number(rest[1]) : 200;
    const body = /^\d{3}$/.test(rest[0] ?? '') ? '' : replace(rest[0] ?? '', host, path, schema);
    return response(game, https, code, body, [['Content-Type', 'text/plain; charset=utf-8']], certificate);
  }
  for (const d of site.directives.filter((x) => x.name === 'reverse_proxy')) {
    const { matcher, rest } = withMatcher(d);
    if (!correspond(matcher, path)) continue;
    const port = Number(/:(\d+)$/.exec(rest[0] ?? '')?.[1] ?? 80);
    const r = appRequest(game, port, path, { host: host, 'x-forwarded-proto': schema, 'x-forwarded-host': host });
    if (!r) return response(game, https, 502, '', [], certificate);
    return response(game, https, r.code, r.body, [['Content-Type', r.type ?? 'text/html; charset=utf-8']], certificate);
  }
  const files = site.directives.find((x) => x.name === 'file_server');
  if (files) {
    const root = site.directives.find((x) => x.name === 'root');
    const docRoot = root ? (root.args.length > 1 ? root.args[1] : root.args[0]) : '.';
    const p = decodeURIComponent(path.split('?')[0]);
    const base = `${docRoot.replace(/\/$/, '')}${p}`;
    const node = game.find(base);
    const target = node?.type === 'directory' ? `${base.replace(/\/$/, '')}/index.html` : base;
    const n = game.find(target);
    if (n?.type !== 'file' || !game.can(n, 'r', 'caddy')) return response(game, https, 404, '', [], certificate);
    const body = game.read(target) ?? '';
    const type = target.endsWith('.html') ? 'text/html; charset=utf-8' : target.endsWith('.css') ? 'text/css; charset=utf-8' : 'text/plain; charset=utf-8';
    return response(game, https, 200, body, [['Accept-Ranges', 'bytes'], ['Content-Type', type], ['Etag', `"${serial(target, body.length).slice(0, 13)}"`]], certificate);
  }
  return response(game, https, 200, '', [], certificate);
}

/**
 * A request to Caddy, on the machine: null if nothing listens on this port;
 * { tls: 'alert' } if Caddy has no certificate for this name (the TLS
 * handshake fails). `outside`: the request comes from the internet (the firewall counts).
 */
export function caddyRequest(game: Game, host: string, path: string, port: number, outside = false): CaddyResponse | null {
  const e = caddyState(game);
  const c = e?.load;
  if (!c || systemd(game)?.services.caddy?.state !== 'active') return null;
  if (!listenersPorts(c).includes(port)) return null;
  if (outside) {
    const pf = game.state.ufw as Firewall | undefined;
    if (pf && verdict(pf, port, '192.0.2.99') !== 'accepted') return null;
  }
  const name = host.toLowerCase().replace(/\.$/, '');
  const https = port !== 80 && c.sites.some((s) => s.addresses.some((a) => a.port === port && a.schema !== 'http'));
  // The site that answers: the one with this name on this port, otherwise the one without a name (:port).
  const site =
    c.sites.find((s) => s.addresses.some((a) => a.port === port && a.host === name)) ?? c.sites.find((s) => s.addresses.some((a) => a.port === port && !a.host));
  if (https) {
    const cert = certificateFor(game, name);
    if (!site || !cert) return { tls: 'alert' };
    return serve(game, site, name, path, true, cert.content);
  }
  if (site) return serve(game, site, name, path, false);
  // On port 80, managed names are redirected to HTTPS (308).
  if (port === 80 && managedNames(c).includes(name) && !['off', 'disable_redirects'].includes(modeHttps(c)))
    return response(game, false, 308, '', [['Connection', 'close'], ['Location', `https://${name}${path}`]]);
  return response(game, false, 200, '', []);
}

// ——— caddy adapt: the JSON configuration (simplified) ———

export function toJson(c: ConfigCaddy): unknown {
  const ports = [...new Set(c.sites.flatMap((s) => s.addresses.map((a) => a.port)))].sort((a, b) => b - a);
  const servers: Record<string, unknown> = {};
  ports.forEach((port, n) => {
    const routes = c.sites
      .filter((s) => s.addresses.some((a) => a.port === port))
      .map((s) => {
        const hosts = s.addresses.filter((a) => a.port === port && a.host).map((a) => a.host);
        const handle = s.directives
          .filter((d) => ['root', 'file_server', 'respond', 'redir', 'reverse_proxy', 'encode'].includes(d.name))
          .map((d) =>
            d.name === 'root'
              ? { handler: 'vars', root: d.args.at(-1) }
              : d.name === 'file_server'
                ? { handler: 'file_server', hide: ['/etc/caddy/Caddyfile'] }
                : d.name === 'reverse_proxy'
                  ? { handler: 'reverse_proxy', upstreams: d.args.filter((a) => !a.startsWith('/')).map((dial) => ({ dial })) }
                  : d.name === 'redir'
                    ? { handler: 'static_response', headers: { Location: [d.args[0]] }, status_code: d.args[1] === 'permanent' ? 301 : 302 }
                    : d.name === 'encode'
                      ? { handler: 'encode', encodings: Object.fromEntries(d.args.map((a) => [a, {}])) }
                      : { handler: 'static_response', body: d.args[0] },
          );
        return { ...(hosts.length ? { match: [{ host: hosts }] } : {}), handle: [{ handler: 'subroute', routes: [{ handle }] }], terminal: true };
      });
    servers[`srv${n}`] = { listen: [`:${port}`], routes };
  });
  return { apps: { http: { servers } } };
}
