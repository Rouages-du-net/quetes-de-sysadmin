// nginx simulé : la configuration lue comme nginx la lit (nginx.conf et ses
// include, directives terminées par « ; », blocs entre accolades), vérifiée
// comme `nginx -t`, puis appliquée au démarrage et au rechargement (comme
// sshd.ts). curl interroge ensuite la configuration chargée.
// D'après la documentation de nginx : https://nginx.org/en/docs/switches.html
// (ligne de commande), https://nginx.org/en/docs/http/ngx_http_core_module.html
// (listen, server_name, root, index) et https://nginx.org/en/docs/http/request_processing.html
// (choix du serveur : le nom demandé, sinon le serveur par défaut du port).
// Le choix du bloc location suit https://nginx.org/en/docs/http/ngx_http_core_module.html#location :
// = exact, puis le plus long préfixe (qui l'emporte s'il porte ^~), puis les
// expressions régulières (~, ~* sans casse) dans l'ordre, sinon ce préfixe.
// proxy_set_header (https://nginx.org/en/docs/http/ngx_http_proxy_module.html#proxy_set_header) :
// hérité du niveau du dessus seulement si le niveau n'en a aucun ; par défaut,
// Host $proxy_host et Connection close ; les autres en-têtes du client passent.
// Écarts : une partie des directives seulement.

import type { Game } from './shell';
import { wildcard } from './tools';
import { summerTime, systemd, toUtc } from './systemd';
import { read as readCertificate } from './tls';

export const VERSION = '1.26.3';
export const CONF = '/etc/nginx/nginx.conf';
const PREFIX = '/etc/nginx';

// Les directives connues : nombre d'arguments (min, max) et blocs autorisés
// (main = hors de tout bloc). Un bloc « types » contient des types MIME, pas
// des directives.
type Rule = { min: number; max: number; inside: string[]; block?: boolean };
const r = (min: number, max: number, inside: string[], block = false): Rule => ({ min, max, inside, block });
const EVERYWHERE = ['main', 'events', 'http', 'server', 'location'];
const HTTP = ['http', 'server', 'location'];
const DIRECTIVES: Record<string, Rule> = {
  user: r(1, 2, ['main']),
  worker_processes: r(1, 1, ['main']),
  pid: r(1, 1, ['main']),
  error_log: r(1, 2, EVERYWHERE),
  include: r(1, 1, EVERYWHERE),
  events: r(0, 0, ['main'], true),
  worker_connections: r(1, 1, ['events']),
  http: r(0, 0, ['main'], true),
  sendfile: r(1, 1, HTTP),
  tcp_nopush: r(1, 1, HTTP),
  types_hash_max_size: r(1, 1, HTTP),
  types: r(0, 0, HTTP, true),
  default_type: r(1, 1, HTTP),
  ssl_protocols: r(1, 9, ['http', 'server']),
  ssl_prefer_server_ciphers: r(1, 1, ['http', 'server']),
  ssl_certificate: r(1, 1, ['http', 'server']),
  ssl_certificate_key: r(1, 1, ['http', 'server']),
  access_log: r(1, 3, HTTP),
  gzip: r(1, 1, HTTP),
  server_tokens: r(1, 1, HTTP),
  server: r(0, 0, ['http'], true),
  listen: r(1, 9, ['server']),
  server_name: r(1, 99, ['server']),
  root: r(1, 1, HTTP),
  index: r(1, 99, HTTP),
  location: r(1, 2, ['server', 'location'], true),
  try_files: r(2, 99, ['server', 'location']),
  return: r(1, 2, ['server', 'location']),
  allow: r(1, 1, HTTP),
  alias: r(1, 1, ['location']),
  proxy_pass: r(1, 1, ['location']),
  proxy_set_header: r(2, 2, HTTP),
  proxy_http_version: r(1, 1, HTTP),
  limit_req_zone: r(3, 4, ['http']),
  limit_req: r(1, 3, HTTP),
  limit_req_status: r(1, 1, HTTP),
  deny: r(1, 1, HTTP),
  upstream: r(1, 1, ['http'], true),
  keepalive: r(1, 1, ['upstream']),
  least_conn: r(0, 0, ['upstream']),
};
// Dans un bloc upstream, server est une simple directive : server adresse [weight=N] [backup] [down]…
const UPSTREAM_SERVER = r(1, 9, ['upstream']);

interface Directive {
  name: string;
  args: string[];
  file: string;
  line: number;
  children?: Directive[];
}

// Un bloc location : le préfixe (ou le chemin exact, avec =, ou une
// expression régulière, avec ~ ou ~*) et ce qu'on y fait.
export interface Location {
  exact: boolean;
  path: string;
  regex?: RegExp;
  // ^~ : ce préfixe, s'il est le plus long, passe avant les expressions régulières.
  priority?: boolean;
  // proxy_set_header : [en-tête, valeur avec ses variables].
  headers: [string, string][];
  root?: string;
  alias?: string;
  index?: string[];
  proxy?: string;
  back?: string[];
  limit?: Limit;
  refusal: string[];
  statusLimit?: number;
}

// limit_req : la zone (clé et débit) et la rafale tolérée.
export interface Limit {
  zone: string;
  burst: number;
  withoutDelay: boolean;
}

export interface LimitZone {
  // La clé : $binary_remote_addr (une par adresse), ou autre chose.
  key: string;
  // Requêtes par seconde.
  rate: number;
}

export interface Server {
  // Adresses d'écoute (« 0.0.0.0:80 », « [::]:80 ») ; celles où il est le serveur par défaut.
  listening: string[];
  byDefault: string[];
  names: string[];
  root: string;
  index: string[];
  refusal: string[];
  // Adresses en HTTPS (listen … ssl) et le certificat lu au chargement :
  // renouveler le fichier ne change rien tant que nginx n'a pas rechargé.
  ssl: string[];
  certificate: string | null;
  locations: Location[];
  // return au niveau du serveur (ex. redirection vers HTTPS).
  back?: string[];
  limit?: Limit;
  statusLimit?: number;
}

// Un groupe de serveurs (upstream) : proxy_pass http://nom/ répartit entre eux.
export interface Upstream {
  servers: { address: string; weight: number; rescue: boolean; off: boolean }[];
}

export interface Configuration {
  servers: Server[];
  upstreams: Record<string, Upstream>;
  // Les avertissements de nginx -t ([warn]) : la configuration reste valable.
  warnings: string[];
  zones: Record<string, LimitZone>;
}

class ConfError extends Error {}
const failure = (message: string, file: string, line: number): never => {
  throw new ConfError(`${message} in ${file}:${line}`);
};

// Découpe un fichier en mots, « ; », « { » et « } », avec leur ligne.
function tokens(text: string): { word: string; line: number }[] {
  const listing: { word: string; line: number }[] = [];
  text.split('\n').forEach((rawValue, i) => {
    const line = rawValue.replace(/(^|\s)#.*$/, '$1');
    for (const m of line.matchAll(/"([^"]*)"|'([^']*)'|[;{}]|[^\s;{}"']+/g)) listing.push({ word: m[1] ?? m[2] ?? m[0], line: i + 1 });
  });
  return listing;
}

// Les fichiers d'un include : un chemin, ou un motif (*) qui peut ne rien trouver.
function includedFiles(game: Game, pattern: string, file: string, line: number): string[] {
  const path = pattern.startsWith('/') ? pattern : `${PREFIX}/${pattern}`;
  if (!path.includes('*') && !path.includes('?')) {
    const n = game.find(path);
    if (!n || n.type !== 'file') failure(`open() "${path}" failed (2: No such file or directory)`, file, line);
    return [path];
  }
  // Un lien cassé dans sites-enabled/ fait échouer nginx -t.
  const check = (path: string) => {
    if (!game.find(path)) failure(`open() "${path}" failed (2: No such file or directory)`, file, line);
    return path;
  };
  const directory = path.slice(0, path.lastIndexOf('/')) || '/';
  const n = game.find(directory);
  if (!n || n.type !== 'directory') return [];
  const re = wildcard(path.slice(path.lastIndexOf('/') + 1));
  return Object.keys(n.children)
    .filter((name) => re.test(name) && n.children[name].type === 'file')
    .sort()
    .map((name) => check(`${directory}/${name}`));
}

// Lit un fichier et ses include ; renvoie ses directives (dans le bloc `contexte`).
// `lus` reçoit les fichiers lus, dans l'ordre (pour nginx -T).
function parse(game: Game, file: string, context: string, read: string[]): Directive[] {
  read.push(file);
  const listing = tokens(game.read(file) ?? '');
  let i = 0;
  const block = (ctx: string, open: boolean): Directive[] => {
    const directives: Directive[] = [];
    let words: { word: string; line: number }[] = [];
    while (i < listing.length) {
      const j = listing[i++];
      if (j.word === ';' || j.word === '{') {
        if (!words.length) failure(`unexpected "${j.word}"`, file, j.line);
        const [name, ...args] = words.map((m) => m.word);
        const line = words[0].line;
        words = [];
        // Dans « types », chaque ligne associe un type MIME à des extensions.
        if (ctx === 'types') continue;
        const rule = ctx === 'upstream' && name === 'server' ? UPSTREAM_SERVER : DIRECTIVES[name];
        if (!rule) failure(`unknown directive "${name}"`, file, line);
        if (!rule.inside.includes(ctx)) failure(`"${name}" directive is not allowed here`, file, line);
        if (j.word === '{' && !rule.block) failure(`directive "${name}" is not terminated by ";"`, file, line);
        if (j.word === ';' && rule.block) failure(`directive "${name}" has no opening "{"`, file, line);
        if (args.length < rule.min || args.length > rule.max) failure(`invalid number of arguments in "${name}" directive`, file, line);
        if (name === 'include') {
          for (const included of includedFiles(game, args[0], file, line)) directives.push(...parse(game, included, ctx, read));
          continue;
        }
        const d: Directive = { name, args, file, line };
        if (rule.block) d.children = block(name, true);
        directives.push(d);
      } else if (j.word === '}') {
        if (words.length) failure(`unexpected "}"`, file, j.line);
        if (!open) failure(`unexpected "}"`, file, j.line);
        return directives;
      } else words.push(j);
    }
    if (words.length) failure(`unexpected end of file, expecting ";" or "}"`, file, words.at(-1)!.line);
    if (open) failure(`unexpected end of file, expecting "}"`, file, (listing.at(-1)?.line ?? 0) + 1);
    return directives;
  };
  return block(context, false);
}

// nginx lit le certificat et sa clé au chargement ; messages d'OpenSSL 3.
function loadCertificate(game: Game, children: Directive[], http: Directive[], server: Directive): string {
  const found = (name: string) => children.find((d) => d.name === name) ?? http.find((d) => d.name === name);
  const cert = found('ssl_certificate');
  const key = found('ssl_certificate_key');
  const listen = children.find((d) => d.name === 'listen' && d.args.includes('ssl')) ?? server;
  if (!cert) failure(`no "ssl_certificate" is defined for the "listen ... ssl" directive`, listen.file, listen.line);
  const open = (d: Directive, what: string) => {
    const path = d.args[0];
    const n = game.find(path);
    if (!n || n.type !== 'file')
      failure(
        `cannot load ${what} "${path}": BIO_new_file() failed (SSL: error:80000002:system library::No such file or directory:calling fopen(${path}, r) error:10000080:BIO routines::no such file)`,
        d.file,
        d.line,
      );
    return game.read(path) ?? '';
  };
  const content = open(cert!, 'certificate');
  if (!readCertificate(content))
    failure(
      `cannot load certificate "${cert!.args[0]}": PEM_read_bio_X509_AUX() failed (SSL: error:0480006C:PEM routines::no start line:Expecting: TRUSTED CERTIFICATE)`,
      cert!.file,
      cert!.line,
    );
  if (!key) failure(`no "ssl_certificate_key" is defined for certificate "${cert!.args[0]}"`, listen.file, listen.line);
  open(key!, 'certificate key');
  return content;
}

// limit_req_zone $binary_remote_addr zone=nom:10m rate=2r/s;
function readZones(http: Directive[]): Record<string, LimitZone> {
  const zones: Record<string, LimitZone> = {};
  for (const d of http.filter((x) => x.name === 'limit_req_zone')) {
    const [key, ...params] = d.args;
    const zone = params.find((p) => p.startsWith('zone='))?.slice(5);
    const rate = params.find((p) => p.startsWith('rate='))?.slice(5);
    const unknown = params.find((p) => !p.startsWith('zone=') && !p.startsWith('rate=') && p !== 'sync');
    if (unknown) failure(`invalid parameter "${unknown}"`, d.file, d.line);
    if (!zone || !/^[\w-]+:\d+[km]?$/i.test(zone)) failure(`no zone in "limit_req_zone" directive`, d.file, d.line);
    const m = /^(\d+)r\/([sm])$/.exec(rate ?? '');
    if (!m) failure(`invalid rate "${rate ?? ''}"`, d.file, d.line);
    zones[zone!.split(':')[0]] = { key, rate: Number(m![1]) / (m![2] === 'm' ? 60 : 1) };
  }
  return zones;
}

// limit_req zone=nom [burst=N] [nodelay] : la zone doit exister.
function readLimit(d: Directive, zones: Record<string, LimitZone>): Limit {
  const zone = d.args.find((a) => a.startsWith('zone='))?.slice(5);
  const burst = d.args.find((a) => a.startsWith('burst='))?.slice(6);
  const unknown = d.args.find((a) => !a.startsWith('zone=') && !a.startsWith('burst=') && a !== 'nodelay' && !a.startsWith('delay='));
  if (unknown) failure(`invalid parameter "${unknown}"`, d.file, d.line);
  if (!zone) failure(`no shared memory zone specified`, d.file, d.line);
  if (burst !== undefined && !/^\d+$/.test(burst)) failure(`invalid burst value "${burst}"`, d.file, d.line);
  // Une zone jamais déclarée : nginx -t le dit sans fichier ni ligne.
  if (!zones[zone!]) throw new ConfError(`zero size shared memory zone "${zone}"`);
  return { zone: zone!, burst: Number(burst ?? 0), withoutDelay: d.args.includes('nodelay') };
}

// « 80 », « [::]:80 », « 192.0.2.11:80 » → adresse:port.
const address = (value: string) => (/^\d+$/.test(value) ? `0.0.0.0:${value}` : value.includes(':') ? value : `${value}:80`);

/** Lit et vérifie toute la configuration ; lève une erreur au format de nginx. */
function build(game: Game, read: string[] = []): Configuration {
  if (!game.find(CONF)) failure(`open() "${CONF}" failed (2: No such file or directory)`, CONF, 0);
  const root = parse(game, CONF, 'main', read);
  const http = root.find((d) => d.name === 'http')?.children ?? [];
  const values = (listing: Directive[], name: string) => listing.filter((d) => d.name === name).flatMap((d) => d.args);
  const zones = readZones(http);
  const bySeenDefault: Record<string, true> = {};
  const seenNames = new Set<string>();
  const warnings: string[] = [];
  const servers = http
    .filter((d) => d.name === 'server')
    .map((s): Server => {
      const children = s.children ?? [];
      const listening: string[] = [];
      const byDefault: string[] = [];
      const ssl: string[] = [];
      for (const l of children.filter((d) => d.name === 'listen')) {
        const a = address(l.args[0]);
        listening.push(a);
        if (l.args.includes('ssl')) ssl.push(a);
        if (l.args.includes('default_server')) {
          if (bySeenDefault[a]) failure(`a duplicate default server for ${a}`, l.file, l.line);
          bySeenDefault[a] = true;
          byDefault.push(a);
        }
      }
      const certificate = ssl.length ? loadCertificate(game, children, http, s) : null;
      // Un même nom sur la même adresse : le premier serveur lu le garde.
      const names: string[] = [];
      for (const name of values(children, 'server_name').map((n) => n.toLowerCase())) {
        const conflicts = (listening.length ? listening : ['0.0.0.0:80']).filter((a) => seenNames.has(`${name} ${a}`));
        for (const a of conflicts) warnings.push(`conflicting server name "${name}" on ${a}, ignored`);
        if (!conflicts.length) names.push(name);
        for (const a of listening.length ? listening : ['0.0.0.0:80']) seenNames.add(`${name} ${a}`);
      }
      const headersFor = (ds: Directive[]) => ds.filter((d) => d.name === 'proxy_set_header').map((d) => [d.args[0], d.args[1]] as [string, string]);
      const serverHeaders = headersFor(children).length ? headersFor(children) : headersFor(http);
      const locations = children
        .filter((d) => d.name === 'location')
        .map((l): Location => {
          const modifier = l.args.length === 2 ? l.args[0] : null;
          if (modifier && !['=', '~', '~*', '^~'].includes(modifier))
            failure(`invalid location modifier "${modifier}"`, l.file, l.line);
          const exact = modifier === '=';
          let regex: RegExp | undefined;
          if (modifier === '~' || modifier === '~*')
            try {
              regex = new RegExp(l.args[1], modifier === '~*' ? 'i' : '');
            } catch (e) {
              failure(
                `pcre2_compile() failed: ${(e as Error).message.replace(/^Invalid regular expression: /, '')} in "${l.args[1]}"`,
                l.file,
                l.line,
              );
            }
          const inside = l.children ?? [];
          const one = (name: string) => inside.find((d) => d.name === name)?.args;
          const limit = inside.find((d) => d.name === 'limit_req');
          return {
            limit: limit ? readLimit(limit, zones) : undefined,
            refusal: values(inside, 'deny'),
            statusLimit: one('limit_req_status') ? Number(one('limit_req_status')![0]) : undefined,
            exact,
            regex,
            priority: modifier === '^~',
            headers: headersFor(inside).length ? headersFor(inside) : serverHeaders,
            path: l.args.at(-1)!,
            root: one('root')?.[0],
            alias: one('alias')?.[0],
            index: one('index'),
            proxy: one('proxy_pass')?.[0],
            back: one('return'),
          };
        });
      const limit = children.find((d) => d.name === 'limit_req') ?? http.find((d) => d.name === 'limit_req');
      const status = values(children, 'limit_req_status')[0] ?? values(http, 'limit_req_status')[0];
      return {
        limit: limit ? readLimit(limit, zones) : undefined,
        statusLimit: status ? Number(status) : undefined,
        ssl,
        certificate,
        locations,
        back: children.find((d) => d.name === 'return')?.args,
        listening: listening.length ? listening : ['0.0.0.0:80'],
        byDefault,
        names,
        root: values(children, 'root')[0] ?? values(http, 'root')[0] ?? '/usr/share/nginx/html',
        index: values(children, 'index').length ? values(children, 'index') : values(http, 'index').length ? values(http, 'index') : ['index.html'],
        refusal: [...values(http, 'deny'), ...values(children, 'deny')],
      };
    });
  return { servers, warnings, zones, upstreams: readUpstreams(http) };
}

// upstream nom { server 127.0.0.1:3001 weight=9; server 127.0.0.1:3002 weight=1; }
// https://nginx.org/en/docs/http/ngx_http_upstream_module.html#server
function readUpstreams(http: Directive[]): Record<string, Upstream> {
  const upstreams: Record<string, Upstream> = {};
  for (const u of http.filter((d) => d.name === 'upstream')) {
    const name = u.args[0];
    if (upstreams[name]) failure(`duplicate upstream "${name}"`, u.file, u.line);
    const servers = (u.children ?? [])
      .filter((d) => d.name === 'server')
      .map((d) => {
        const [adr, ...params] = d.args;
        let weight = 1;
        for (const p of params) {
          if (p.startsWith('weight=')) {
            weight = Number(p.slice(7));
            if (!Number.isInteger(weight) || weight < 1) failure(`invalid parameter "${p}"`, d.file, d.line);
          } else if (!['backup', 'down'].includes(p) && !/^(max_fails|fail_timeout|max_conns)=/.test(p))
            failure(`invalid parameter "${p}"`, d.file, d.line);
        }
        return {
          address: adr.includes(':') ? adr.replace(/^localhost/, '127.0.0.1') : `${adr}:80`,
          weight,
          rescue: params.includes('backup'),
          off: params.includes('down'),
        };
      });
    if (!servers.length) failure(`no servers are inside upstream`, u.file, u.line);
    upstreams[name] = { servers };
  }
  return upstreams;
}

// Le tourniquet pondéré de nginx (smooth weighted round-robin) : à chaque
// requête, chaque serveur gagne son poids, le plus haut est choisi et perd la
// somme des poids. Avec 9 et 1 : 9 requêtes sur 10 pour le premier.
function tourniquet(game: Game, name: string, upstream: Upstream, excluded: string[], trace: boolean): string | null {
  const candidates = upstream.servers.filter((x) => !x.off && !x.rescue && !excluded.includes(x.address));
  const listing = candidates.length ? candidates : upstream.servers.filter((x) => !x.off && x.rescue && !excluded.includes(x.address));
  if (!listing.length) return null;
  const states: Record<string, Record<string, number>> = (game.state.nginxTurnstiles ??= {});
  const active = { ...(states[name] ?? {}) };
  const total = listing.reduce((t, x) => t + x.weight, 0);
  for (const x of listing) active[x.address] = (active[x.address] ?? 0) + x.weight;
  const chosen = listing.reduce((a, b) => (active[b.address] > active[a.address] ? b : a));
  active[chosen.address] -= total;
  // Les vérifications du jeu ne font pas tourner le tourniquet.
  if (trace) states[name] = active;
  return chosen.address;
}

/** Vérifie la configuration : null si elle est bonne, sinon le message [emerg]. */
export function test(game: Game): { config: Configuration; error: null } | { config: null; error: string } {
  try {
    return { config: build(game), error: null };
  } catch (e) {
    if (e instanceof ConfError) return { config: null, error: e.message };
    throw e;
  }
}

/** Les fichiers de configuration lus, dans l'ordre (nginx -T). */
export function readFiles(game: Game): string[] {
  const read: string[] = [];
  build(game, read);
  return read;
}

// L'heure de nginx dans ses journaux : « 2026/10/23 08:15:02 ».
export const nginxTime = (ms: number) => new Date(ms).toISOString().slice(0, 19).replace('T', ' ').replaceAll('-', '/');

// Pour systemd : nginx refuse de démarrer (ou de recharger) une mauvaise configuration.
export function checkNginx(game: Game): string[] | null {
  const { error } = test(game);
  if (!error) return null;
  const h = nginxTime((systemd(game)?.clock ?? 0) + 1000);
  return [`${h} [emerg] 2411#2411: ${error}`, `nginx: configuration file ${CONF} test failed`];
}

/** Au démarrage et au rechargement : la configuration lue devient celle qui sert. */
export function loadNginx(game: Game) {
  game.state.nginx = { ...(game.state.nginx ?? {}), load: test(game).config };
}

export interface Response {
  code: number;
  body: string;
  headers: string[];
  // En HTTPS : le certificat présenté par le serveur (PEM).
  certificate?: string;
}

const REASONS: Record<number, string> = {
  200: 'OK',
  301: 'Moved Permanently',
  302: 'Found',
  403: 'Forbidden',
  404: 'Not Found',
  429: 'Too Many Requests',
  500: 'Internal Server Error',
  502: 'Bad Gateway',
  503: 'Service Temporarily Unavailable',
  504: 'Gateway Time-out',
};
const page = (code: number) =>
  `<html>\n<head><title>${code} ${REASONS[code]}</title></head>\n<body>\n<center><h1>${code} ${REASONS[code]}</h1></center>\n<hr><center>nginx/${VERSION}</center>\n</body>\n</html>`;
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
// En-tête Date (GMT) ; l'horloge de la machine est à l'heure de Paris.
const dateHttp = (ms: number) => {
  const d = new Date(toUtc(ms));
  return `${DAYS[d.getUTCDay()]}, ${String(d.getUTCDate()).padStart(2, '0')} ${MONTH[d.getUTCMonth()]} ${d.getUTCFullYear()} ${d.toISOString().slice(11, 19)} GMT`;
};

// Les programmes derrière nginx (proxy_pass) : etat.applis, par adresse
// « 127.0.0.1:3000 ». Une appli répond tant que son service systemd tourne.
export interface App {
  service: string;
  // Les pages qu'elle sert, par chemin ; ailleurs, la page 404 d'Express.
  pages: Record<string, string>;
  // Ou une appli qui calcule sa réponse (version, configuration, santé…).
  // entetes : ceux qu'elle ajoute (Server, Location…).
  answer?: (game: Game, path: string, request: Request) => { code: number; body: string; type?: string; headers?: string[] };
  // Requêtes par seconde qu'elle sait servir (sans limite si absent).
  capacity?: number;
}

// Ce que l'appli voit d'une requête : les en-têtes reçus (noms en minuscules) et l'adresse de la connexion.
export interface Request {
  headers: Record<string, string>;
  address: string;
  // false : une vérification du jeu, qui ne laisse pas de trace dans les journaux.
  trace?: boolean;
}

const PAGE_EXPRESS = (path: string) =>
  `<!DOCTYPE html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n<title>Error</title>\n</head>\n<body>\n<pre>Cannot GET ${path}</pre>\n</body>\n</html>`;

/** Ce que répond une appli (sans passer par nginx). */
export function answerApp(
  game: Game,
  app: App,
  path: string,
  request: Request = { headers: {}, address: '127.0.0.1' },
): { code: number; body: string; type?: string; headers?: string[] } {
  if (app.answer) return app.answer(game, path.split('?')[0], request);
  const body = app.pages[path.split('?')[0]];
  return body === undefined ? { code: 404, body: PAGE_EXPRESS(path) } : { code: 200, body };
}

/** Une appli jointe directement sur son port (curl http://127.0.0.1:3001/) : null si personne n'écoute. */
export function appRequest(
  game: Game,
  port: number,
  path: string,
  headers: Record<string, string> = {},
): { code: number; body: string; type?: string; headers?: string[] } | null {
  const app: App | undefined = game.state.apps?.[`127.0.0.1:${port}`];
  if (!app || systemd(game)?.services[app.service]?.state !== 'active') return null;
  return answerApp(game, app, path, { headers, address: '127.0.0.1' });
}

// Une ligne de /var/log/nginx/error.log (si le fichier existe).
function errorLog(game: Game, level: string, message: string) {
  if (!game.state.nginxTrace) return;
  const n = game.find('/var/log/nginx/error.log');
  if (n?.type !== 'file' || typeof n.content !== 'string') return;
  const number = (game.state.nginxConnections = (game.state.nginxConnections ?? 0) + 1);
  const line = `${nginxTime(systemd(game)?.clock ?? 0)} [${level}] 2412#2412: *${number} ${message}`;
  n.content = n.content ? `${n.content}\n${line}` : line;
}

/** Le bloc location qui traite ce chemin, comme nginx : = exact, le plus long préfixe (^~ s'arrête là), les expressions régulières dans l'ordre, sinon ce préfixe. */
export function chooseLocation(server: Server, path: string): Location | null {
  const exact = server.locations.find((l) => l.exact && l.path === path);
  if (exact) return exact;
  const prefix =
    server.locations.filter((l) => !l.exact && !l.regex && path.startsWith(l.path)).sort((a, b) => b.path.length - a.path.length)[0] ?? null;
  if (prefix?.priority) return prefix;
  return server.locations.find((l) => l.regex?.test(path)) ?? prefix;
}

/**
 * Une requête HTTP (port 80) ou HTTPS (443) vers cette machine : null si
 * personne n'écoute. Le serveur est choisi par son nom (en-tête Host, ou SNI
 * en HTTPS), sinon c'est celui par défaut du port, sinon le premier ; puis
 * le bloc location, qui sert un fichier, renvoie (return) ou passe la
 * requête à une appli (proxy_pass).
 */
export function httpRequest(game: Game, host: string, path: string, port = 80, trace = true, client?: Client): Response | null {
  // Les vérifications du jeu (objectifs) interrogent nginx sans laisser de trace au journal.
  game.state.nginxTrace = trace;
  const who = client ?? { address: '127.0.0.1', time: systemd(game)?.clock ?? 0, agent: 'curl/8.14.1' };
  const r = handle(game, host, path, port, who);
  if (r && trace) accessLog(game, who, path, r);
  return r;
}

// Qui fait la requête : son adresse, l'heure (locale, en millisecondes), son
// navigateur ; la méthode (GET par défaut) et les en-têtes qu'il envoie (noms en minuscules).
export interface Client {
  address: string;
  time: number;
  agent: string;
  method?: string;
  headers?: Record<string, string>;
}

// « 27/Mar/2027:20:00:01 +0100 », comme $time_local.
function localeTime(ms: number): string {
  const d = new Date(ms);
  return `${String(d.getUTCDate()).padStart(2, '0')}/${MONTH[d.getUTCMonth()]}/${d.getUTCFullYear()}:${d.toISOString().slice(11, 19)} ${summerTime(ms) ? '+0200' : '+0100'}`;
}

// Une ligne de /var/log/nginx/access.log (format combined), si le chapitre le demande.
function accessLog(game: Game, c: Client, path: string, r: Response) {
  if (!game.state.nginx?.journalAcces) return;
  const n = game.find('/var/log/nginx/access.log');
  if (n?.type !== 'file' || typeof n.content !== 'string') return;
  const line = `${c.address} - - [${localeTime(c.time)}] "${c.method ?? 'GET'} ${path} HTTP/1.1" ${r.code} ${new TextEncoder().encode(r.body).length} "-" "${c.agent}"`;
  n.content = n.content ? `${n.content}\n${line}` : line;
}

// Une adresse couverte par une règle deny (adresse, plage CIDR ou all).
function couvert(rule: string, address: string): boolean {
  if (rule === 'all') return true;
  const [base, bits = '32'] = rule.split('/');
  const count = (ip: string) => ip.split('.').reduce((t, o) => t * 256 + Number(o), 0);
  if (!/^\d+\.\d+\.\d+\.\d+$/.test(base) || !/^\d+\.\d+\.\d+\.\d+$/.test(address)) return rule === address;
  const mask = Number(bits) === 0 ? 0 : 2 ** 32 - 2 ** (32 - Number(bits));
  return (count(base) & mask) >>> 0 === (count(address) & mask) >>> 0;
}

function handle(game: Game, host: string, path: string, port: number, client: Client): Response | null {
  const sd = systemd(game);
  const config: Configuration | null = game.state.nginx?.load ?? null;
  if (!config || sd?.services.nginx?.state !== 'active') return null;
  const a = /^\[|:/.test(host) ? `[::]:${port}` : `0.0.0.0:${port}`;
  const candidates = config.servers.filter((s) => s.listening.includes(a));
  const server = candidates.find((s) => s.names.includes(host.toLowerCase())) ?? candidates.find((s) => s.byDefault.includes(a)) ?? candidates[0];
  if (!server) return null;
  // Un port en HTTPS ne répond pas en clair (et inversement) : on ne simule que le bon cas.
  if (server.ssl.includes(a) !== (port === 443)) return null;
  const response = (code: number, body: string, more: string[] = []): Response => ({
    code,
    body,
    certificate: port === 443 ? (server.certificate ?? undefined) : undefined,
    headers: [
      `HTTP/1.1 ${code} ${REASONS[code] ?? ''}`.trimEnd(),
      `Server: nginx/${VERSION}`,
      `Date: ${dateHttp(sd!.clock)}`,
      'Content-Type: text/html',
      `Content-Length: ${new TextEncoder().encode(body).length}`,
      'Connection: keep-alive',
      ...more,
    ],
  });
  const variables = (text: string) =>
    text
      .replaceAll('$request_uri', path)
      .replaceAll('$host', host.toLowerCase())
      .replaceAll('$scheme', port === 443 ? 'https' : 'http')
      .replaceAll('$server_name', server.names[0] ?? '');
  // return code [adresse ou texte] : 301/302 avec Location, sinon le texte.
  const back = ([code, what = '']: string[]) => {
    const n = Number(code);
    if (n >= 300 && n < 400) return response(n, page(n), [`Location: ${variables(what)}`]);
    return response(n, variables(what));
  };
  const loc = chooseLocation(server, path.split('?')[0]);
  const context = `client: ${client.address}, server: ${server.names[0] ?? '_'}, request: "GET ${path} HTTP/1.1", host: "${host}"`;
  // deny : 403 (http, puis server, puis location).
  if ([...server.refusal, ...(loc?.refusal ?? [])].some((r) => couvert(r, client.address))) {
    errorLog(game, 'error', `access forbidden by rule, ${context}`);
    return response(403, page(403));
  }
  // limit_req : un seau qui fuit au débit de la zone ; au-delà de la rafale, refus.
  const limit = loc?.limit ?? server.limit;
  if (limit) {
    const zone = config.zones[limit.zone];
    const key = zone.key === '$binary_remote_addr' || zone.key === '$remote_addr' ? client.address : zone.key;
    const buckets: Record<string, { excess: number; last: number }> = (game.state.nginxBuckets ??= {});
    const bucket = buckets[`${limit.zone}|${key}`];
    const excess = bucket ? Math.max(0, bucket.excess - (zone.rate * (client.time - bucket.last)) / 1000 + 1) : 0;
    if (excess > limit.burst) {
      errorLog(game, 'error', `limiting requests, excess: ${excess.toFixed(3)} by zone "${limit.zone}", ${context}`);
      const status = loc?.statusLimit ?? server.statusLimit ?? 503;
      return response(status, page(status));
    }
    // Les vérifications du jeu ne remplissent pas le seau.
    if (game.state.nginxTrace) buckets[`${limit.zone}|${key}`] = { excess, last: client.time };
  }
  if (server.back) return back(server.back);
  if (loc?.back) return back(loc.back);
  if (loc?.proxy) {
    const m = /^https?:\/\/([^/]+)(\/.*)?$/.exec(loc.proxy);
    const upstreamHost = (m?.[1] ?? '').replace(/^localhost(?=:|$)/, '127.0.0.1');
    // Avec une partie chemin dans proxy_pass, elle remplace le préfixe de la location.
    const upstream = m?.[2] !== undefined ? m[2] + path.slice(loc.path.length) : path;
    const group = config.upstreams?.[upstreamHost];
    const connection = (address: string) =>
      `connect() failed (111: Connection refused) while connecting to upstream, client: ${client.address}, server: ${server.names[0] ?? '_'}, request: "GET ${path} HTTP/1.1", upstream: "http://${address}${upstream}", host: "${host}"`;
    const reach = (address: string): App | null => {
      const a: App | undefined = game.state.apps?.[address.includes(':') ? address : `${address}:80`];
      return a && sd!.services[a.service]?.state === 'active' ? a : null;
    };
    let address = upstreamHost;
    let app: App | null = null;
    if (group) {
      // Un serveur qui ne répond pas : nginx essaie le suivant (proxy_next_upstream error).
      const tried: string[] = [];
      for (;;) {
        const chosen = tourniquet(game, upstreamHost, group, tried, !!game.state.nginxTrace);
        if (!chosen) {
          errorLog(
            game,
            'error',
            `no live upstreams while connecting to upstream, client: ${client.address}, server: ${server.names[0] ?? '_'}, request: "GET ${path} HTTP/1.1", upstream: "http://${upstreamHost}${upstream}", host: "${host}"`,
          );
          return response(502, page(502));
        }
        address = chosen;
        app = reach(chosen);
        if (app) break;
        errorLog(game, 'error', connection(chosen));
        tried.push(chosen);
      }
    } else {
      app = reach(address);
      if (!app) {
        errorLog(game, 'error', connection(address));
        return response(502, page(502));
      }
    }
    game.state.nginxLastUpstream = address;
    // Une appli a une capacité : au-delà, elle ne répond plus à temps (504).
    if (app.capacity) {
      const load: Record<string, number> = (game.state.appLoaded ??= {});
      const seconde = `${address}|${Math.floor(client.time / 1000)}`;
      if (game.state.nginxTrace) load[seconde] = (load[seconde] ?? 0) + 1;
      if ((load[seconde] ?? 0) > app.capacity) {
        errorLog(
          game,
          'error',
          `upstream timed out (110: Connection timed out) while reading response header from upstream, ${context}, upstream: "http://${address}${upstream}"`,
        );
        return response(504, page(504));
      }
    }
    // Les en-têtes que l'appli reçoit : ceux du client, Host et Connection par défaut, puis proxy_set_header.
    const received: Record<string, string> = { ...(client.headers ?? {}), host: upstreamHost, connection: 'close' };
    const xff = client.headers?.['x-forwarded-for'];
    for (const [name, value] of loc.headers) {
      const v = value
        .replaceAll('$proxy_add_x_forwarded_for', xff ? `${xff}, ${client.address}` : client.address)
        .replaceAll('$remote_addr', client.address)
        .replaceAll('$proxy_host', upstreamHost)
        .replaceAll('$http_host', host)
        // $http_nom : l'en-tête « nom » envoyé par le client (tirets écrits _), vide s'il n'en a pas envoyé.
        .replace(/\$http_([a-z0-9_]+)/g, (_, n: string) => client.headers?.[n.replace(/_/g, '-')] ?? '');
      // Une valeur vide : l'en-tête n'est pas envoyé.
      if (variables(v) === '') delete received[name.toLowerCase()];
      else received[name.toLowerCase()] = variables(v);
    }
    const r = answerApp(game, app, upstream, { headers: received, address: '127.0.0.1', trace: !!game.state.nginxTrace });
    // Une redirection de l'appli passe telle quelle (proxy_redirect n'est pas simulé).
    return response(r.code, r.body, (r.headers ?? []).filter((e) => e.startsWith('Location: ')));
  }
  // Un fichier : root + chemin, ou alias à la place du préfixe de la location.
  const withoutRequest = path.split('?')[0] || '/';
  const target = loc?.alias
    ? loc.alias.replace(/\/$/, '') + '/' + withoutRequest.slice(loc.path.length).replace(/^\//, '')
    : (loc?.root ?? server.root).replace(/\/$/, '') + withoutRequest;
  const index = loc?.index ?? server.index;
  const request = game.find(target);
  let file = request;
  if (request?.type === 'directory') {
    const name = index.find((i) => request.children[i] && game.find(`${target.replace(/\/$/, '')}/${i}`)?.type === 'file');
    // Un lieu sans page d'index : nginx refuse d'en montrer la liste.
    if (!name) {
      errorLog(
        game,
        'error',
        `directory index of "${target.replace(/\/?$/, '/')}" is forbidden, client: 127.0.0.1, server: ${server.names[0] ?? '_'}, request: "GET ${path} HTTP/1.1", host: "${host}"`,
      );
      return response(403, page(403));
    }
    file = game.find(`${target.replace(/\/$/, '')}/${name}`);
  }
  if (!file || file.type !== 'file') {
    errorLog(
      game,
      'error',
      `open() "${target}" failed (2: No such file or directory), client: 127.0.0.1, server: ${server.names[0] ?? '_'}, request: "GET ${path} HTTP/1.1", host: "${host}"`,
    );
    return response(404, page(404));
  }
  // Les processus de travail de nginx tournent sous le compte www-data.
  if (!game.can(file, 'r', 'www-data')) return response(403, page(403));
  const body = typeof file.content === 'function' ? file.content(game) : file.content;
  return response(200, body);
}
