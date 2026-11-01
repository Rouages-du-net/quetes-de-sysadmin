// Caddy d'une machine : le Caddyfile lu comme le fait l'adaptateur
// caddyfile, la configuration appliquée au démarrage et au rechargement, et
// le HTTPS automatique. Pour chaque site dont l'adresse est un nom de domaine
// (ni http://, ni :80), Caddy obtient lui-même un certificat auprès de Let's
// Encrypt (ACME) et redirige HTTP vers HTTPS. L'autorité vérifie, depuis
// internet, que la machine répond pour ce nom sur le port 80 (défi HTTP-01)
// ou 443 (TLS-ALPN-01) : le DNS du nom doit mener ici, et le pare-feu laisser
// passer. Les journaux de Caddy sont des lignes JSON (zap).
// Sources : https://caddyserver.com/docs/caddyfile/concepts,
// https://caddyserver.com/docs/automatic-https,
// https://caddyserver.com/docs/caddyfile/directives,
// https://caddyserver.com/docs/command-line,
// https://letsencrypt.org/docs/challenge-types/
// Écarts : un sous-ensemble des directives est appliqué (root, file_server,
// respond, redir, reverse_proxy) ; les autres sont reconnues mais sans effet ;
// pas de matchers nommés ni de blocs handle ; une seule autorité (Let's
// Encrypt, sans ZeroSSL) ; un défi raté est retenté dès que la cause a
// disparu (au lieu d'attendre le délai) ; localhost et les adresses IP ne
// reçoivent pas de certificat interne.

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
// Une adresse des serveurs de validation de Let's Encrypt (pour le pare-feu).
const VALIDATOR = '198.51.100.77';

// ——— Lecture du Caddyfile ———

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
  // Le texte tel qu'écrit (pour les messages).
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
  // Le premier écart avec ce qu'écrirait caddy fmt (numéro de ligne), sinon null.
  notFormatted: number | null;
}

// Les directives connues des sites, d'après la documentation de Caddy 2.10.
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
// Les directives qui demandent au moins un argument (sans bloc).
const WITH_ARGUMENT = new Set(['root', 'redir', 'respond', 'reverse_proxy', 'encode', 'rewrite', 'try_files', 'import', 'header', 'bind', 'tls']);

export class CaddyError extends Error {}

interface TokensLine {
  line: number;
  tokens: string[];
}

// Découpe le texte en lignes de jetons (guillemets, accents graves, commentaires).
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

/** Une adresse de site : [schéma://]hôte[:port], ou :port. */
export function readAddress(text: string): Address {
  const m = /^(?:(https?):\/\/)?([^:/]*)(?::(\d+))?(\/.*)?$/.exec(text);
  const schema = m?.[1] ?? '';
  const host = (m?.[2] ?? text).toLowerCase();
  const port = m?.[3] ? Number(m[3]) : schema === 'http' ? 80 : 443;
  return { schema, host, port, text };
}

export const isIp = (s: string) => /^\d{1,3}(\.\d{1,3}){3}$/.test(s);

/** Lit un Caddyfile ; lance ErreurCaddy avec le message de Caddy (sans « Error: »). */
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
      // « respond ok }» : l'accolade fermante en fin de ligne n'est pas permise.
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
  // Le bloc des options globales : des accolades seules, tout en haut.
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
      // Après un premier site entre accolades, une ligne sans accolade : une directive égarée.
      siteDirective({ name: tokens[0], args: [], line });
      throw new CaddyError(`${file}:${line}: unrecognized directive: ${tokens[0]}`);
    }
    if (!texts.length) throw new CaddyError(`${file}:${line} - Error during parsing: Unexpected '{'`);
    let directives: Directive[];
    if (opens) directives = block(line, siteDirective);
    else {
      // Un seul site, sans accolades : toute la suite du fichier lui appartient.
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
  // Deux sites ne peuvent pas répondre à la même adresse.
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

/** Ce qu'écrit caddy fmt : une tabulation par niveau d'accolades, un espace entre jetons, une ligne vide au plus. */
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
    // Un espace entre les jetons, hors des guillemets et des commentaires.
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

// ——— Les sites tels que Caddy les sert ———

const global = (c: ConfigCaddy, name: string) => c.global.find((d) => d.name === name);
const modeHttps = (c: ConfigCaddy) => global(c, 'auto_https')?.args[0] ?? 'on';

/** L'adresse reçoit-elle le HTTPS automatique (certificat ACME) ? */
export const managedOne = (c: ConfigCaddy, a: Address) =>
  !['off', 'disable_certs', 'ignore_loaded_certs'].includes(modeHttps(c)) && a.schema !== 'http' && a.port !== 80 && !!a.host && a.host.includes('.') && !isIp(a.host) && !a.host.includes('*');

/** Les noms dont Caddy gère le certificat. */
export const managedNames = (c: ConfigCaddy) => [...new Set(c.sites.flatMap((s) => s.addresses.filter((a) => managedOne(c, a)).map((a) => a.host)))];

/** Les ports sur lesquels Caddy écoute avec cette configuration. */
export function listenersPorts(c: ConfigCaddy): number[] {
  const ports = new Set(c.sites.flatMap((s) => s.addresses.map((a) => a.port)));
  if (managedNames(c).length && !['off', 'disable_redirects'].includes(modeHttps(c))) ports.add(80);
  return [...ports].sort((a, b) => a - b);
}

// ——— L'état de Caddy (etat.caddy) ———

export interface CaddyState {
  // La configuration en service (null : Caddy ne tourne pas).
  load: ConfigCaddy | null;
  // Les noms sous lesquels la machine se joint elle-même (pour curl).
  names: string[];
  // L'adresse publique de la machine, et ce que le DNS public dit de chaque nom.
  ip: string;
  dns: Record<string, string>;
  // Les noms dont l'obtention du certificat a échoué (Caddy retentera).
  waiting: string[];
  attempts: Record<string, number>;
}

export const caddyState = (game: Game): CaddyState | undefined => game.state.caddy;

const certificateDirectory = (name: string) => `${STOCKAGE}/certificates/${ACME_ISSUER}/${name}`;

/** Le certificat que Caddy a pour ce nom, s'il est encore valable. */
export function certificateFor(game: Game, name: string): { certificate: Certificate; content: string } | null {
  const content = game.read(`${certificateDirectory(name)}/${name}.crt`);
  const c = readCertificate(content);
  const now = toUtc(systemd(game)?.clock ?? 0);
  if (!c || !content || c.end < now || !covers(c, name)) return null;
  return { certificate: c, content };
}

// Un instant au format de zap (secondes depuis 1970, avec les millièmes).
const ts = (game: Game) => (toUtc(systemd(game)?.clock ?? 0) / 1000 + 0.123).toFixed(3);

/** Une ligne JSON au journal de caddy.service. */
export function note(game: Game, level: string, logger: string | null, msg: string, fields: Record<string, unknown> = {}, advance = false) {
  const sd = systemd(game);
  if (!sd) return;
  const line = JSON.stringify({ level: level, ts: 0, ...(logger ? { logger } : {}), msg, ...fields }).replace('"ts":0', `"ts":${ts(game)}`);
  writeLog(sd, 'caddy.service', 'caddy', PID, line, level === 'error' ? 3 : level === 'warn' ? 4 : 6, advance);
}

/** Le Caddyfile de la machine, lu ; ou l'erreur de Caddy. */
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

/** Au démarrage et au rechargement du service : null si tout va bien, sinon les lignes d'erreur. */
export function checkCaddy(game: Game): string[] | null {
  const r = readConfigCaddy(game);
  return 'error' in r ? [`Error: ${r.error}`] : null;
}

// Les écoutes de Caddy (ss -tlnp) : celles de la configuration, et l'API d'administration.
function listen(game: Game, c: ConfigCaddy | null) {
  const other = ((game.state.listening ?? []) as Listening[]).filter((e) => e.process !== 'caddy');
  const caddy: Listening[] = c ? [{ proto: 'tcp', address: '127.0.0.1', port: 2019, process: 'caddy', pid: PID }, ...listenersPorts(c).map((port) => ({ proto: 'tcp' as const, address: '*', port, process: 'caddy', pid: PID }))] : [];
  if (c && listenersPorts(c).includes(443)) caddy.push({ proto: 'udp', address: '*', port: 443, process: 'caddy', pid: PID });
  game.state.listening = [...other, ...caddy];
}

/** Après un démarrage ou un rechargement réussi : Caddy applique sa configuration, et obtient les certificats qui manquent. */
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
  // Un « serveur » par port, comme l'adaptateur (srv0, srv1…).
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

/** À l'arrêt du service : plus rien n'écoute. */
export function stopCaddy(game: Game) {
  const e = caddyState(game);
  if (e) e.load = null;
  listen(game, null);
}

// Pourquoi l'autorité n'arrive pas à valider ce nom (null : elle y arrive).
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

// Un numéro de série, tiré du nom et du nombre d'essais (déterministe).
function serial(name: string, n: number): string {
  let h = 0x811c9dc5;
  for (const c of `${name}#${n}`) h = Math.imul(h ^ c.charCodeAt(0), 0x01000193) >>> 0;
  return Array.from({ length: 5 }, (_, i) => ((Math.imul(h, i + 3) >>> 0) ^ (h >>> i)).toString(16).padStart(8, '0'))
    .join('')
    .slice(0, 36)
    .replace(/^./, '0');
}

// Crée les dossiers qui manquent (au nom de caddy), puis pose le fichier.
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

/** Caddy demande un certificat pour ce nom : il l'obtient, ou note l'échec (il retentera). */
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
 * Avant chaque commande : Caddy retente les certificats en échec. Le délai
 * réel (une minute, puis de plus en plus) est sauté dès que la cause a
 * disparu ; tant qu'elle reste, rien ne change.
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

// ——— Les requêtes ———

const REASONS: Record<number, string> = { 200: 'OK', 301: 'Moved Permanently', 302: 'Found', 307: 'Temporary Redirect', 308: 'Permanent Redirect', 404: 'Not Found', 502: 'Bad Gateway' };
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const dateHttp = (ms: number) => {
  const d = new Date(toUtc(ms));
  return `${DAYS[d.getUTCDay()]}, ${String(d.getUTCDate()).padStart(2, '0')} ${MONTH[d.getUTCMonth()]} ${d.getUTCFullYear()} ${d.toISOString().slice(11, 19)} GMT`;
};

export type CaddyResponse = Response | { tls: 'alerte' };

function response(game: Game, https: boolean, code: number, body: string, headers: [string, string][], certificate?: string): Response {
  const date = dateHttp(systemd(game)?.clock ?? 0);
  const all: [string, string][] = [...(https ? [['Alt-Svc', 'h3=":443"; ma=2592000'] as [string, string]] : []), ...headers, ['Server', 'Caddy'], ['Date', date]];
  if (!headers.some(([n]) => n === 'Content-Length')) all.push(['Content-Length', String(new TextEncoder().encode(body).length)]);
  const first = https ? `HTTP/2 ${code} ` : `HTTP/1.1 ${code} ${REASONS[code] ?? ''}`.trimEnd();
  return { code, body, headers: [first, ...all.map(([n, v]) => `${https ? n.toLowerCase() : n}: ${v}`)], certificate };
}

const replace = (text: string, host: string, path: string, schema: string) =>
  text.replaceAll('{uri}', path).replaceAll('{path}', path.split('?')[0]).replaceAll('{host}', host).replaceAll('{scheme}', schema).replaceAll('{http.request.uri}', path).replaceAll('{http.request.host}', host);

// Un matcher de chemin (/x, /x*, *) : le premier argument d'une directive, s'il commence par / ou vaut *.
function correspond(matcher: string, path: string): boolean {
  if (matcher === '*') return true;
  const p = path.split('?')[0];
  return matcher.endsWith('*') ? p.startsWith(matcher.slice(0, -1)) : p === matcher;
}

// Ce que sert un site, dans l'ordre des directives de Caddy (redir, respond, reverse_proxy, file_server).
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
 * Une requête à Caddy, sur la machine : null si rien n'écoute sur ce port ;
 * { tls: 'alerte' } si Caddy n'a pas de certificat pour ce nom (la poignée de
 * main TLS échoue). `dehors` : la requête vient d'internet (le pare-feu compte).
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
  // Le site qui répond : celui de ce nom sur ce port, sinon celui sans nom (:port).
  const site =
    c.sites.find((s) => s.addresses.some((a) => a.port === port && a.host === name)) ?? c.sites.find((s) => s.addresses.some((a) => a.port === port && !a.host));
  if (https) {
    const cert = certificateFor(game, name);
    if (!site || !cert) return { tls: 'alerte' };
    return serve(game, site, name, path, true, cert.content);
  }
  if (site) return serve(game, site, name, path, false);
  // Sur le port 80, les noms gérés sont redirigés vers HTTPS (308).
  if (port === 80 && managedNames(c).includes(name) && !['off', 'disable_redirects'].includes(modeHttps(c)))
    return response(game, false, 308, '', [['Connection', 'close'], ['Location', `https://${name}${path}`]]);
  return response(game, false, 200, '', []);
}

// ——— caddy adapt : la configuration JSON (simplifiée) ———

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
