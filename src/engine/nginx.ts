// Simulated nginx: the configuration read the way nginx reads it (nginx.conf
// and its includes, directives ended by ";", blocks in braces), checked
// like `nginx -t`, then applied on start and on reload (like sshd.ts).
// curl then queries the loaded configuration.
// Based on nginx's documentation: https://nginx.org/en/docs/switches.html
// (command line), https://nginx.org/en/docs/http/ngx_http_core_module.html
// (listen, server_name, root, index) and https://nginx.org/en/docs/http/request_processing.html
// (choice of server: the requested name, otherwise the port's default server).
// The choice of location block follows https://nginx.org/en/docs/http/ngx_http_core_module.html#location:
// = exact, then the longest prefix (which wins if it carries ^~), then the
// regular expressions (~, ~* case-insensitive) in order, otherwise that prefix.
// proxy_set_header (https://nginx.org/en/docs/http/ngx_http_proxy_module.html#proxy_set_header):
// inherited from the level above only if the level has none; by default,
// Host $proxy_host and Connection close; the client's other headers pass through.
// Access logs (https://nginx.org/en/docs/http/ngx_http_log_module.html):
// log_format (combined predefined), access_log path [format] or off, at
// http or server level (the server's own replace the http ones); map
// (https://nginx.org/en/docs/http/ngx_http_map_module.html) makes a
// variable from another: exact keys, then regular expressions in order
// (~, ~* case-insensitive, captures $1 or named), default; the usual way to
// write a truncated address in the log.
// Differences: only some of the directives; a log file deleted by hand is
// created again at the next line (nginx would keep writing to the deleted
// file until a reload or `nginx -s reopen`).

import type { Game } from './shell';
import { wildcard } from './tools';
import { summerTime, systemd, toUtc } from './systemd';
import { read as readCertificate, readAll, subject } from './tls';
import { family } from './families';

export const VERSION = '1.26.3';
export const CONF = '/etc/nginx/nginx.conf';
const PREFIX = '/etc/nginx';

// The known directives: number of arguments (min, max) and allowed blocks
// (main = outside any block). A "types" block holds MIME types, not
// directives.
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
  ssl_client_certificate: r(1, 1, ['http', 'server']),
  ssl_trusted_certificate: r(1, 1, ['http', 'server']),
  ssl_verify_client: r(1, 1, ['http', 'server']),
  ssl_verify_depth: r(1, 1, ['http', 'server']),
  ssl_crl: r(1, 1, ['http', 'server']),
  access_log: r(1, 5, HTTP),
  log_format: r(2, 99, ['http']),
  map: r(2, 2, ['http'], true),
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
// In an upstream block, server is a simple directive: server address [weight=N] [backup] [down]…
const UPSTREAM_SERVER = r(1, 9, ['upstream']);

interface Directive {
  name: string;
  args: string[];
  file: string;
  line: number;
  children?: Directive[];
}

// A location block: the prefix (or the exact path, with =, or a regular
// expression, with ~ or ~*) and what is done there.
export interface Location {
  exact: boolean;
  path: string;
  regex?: RegExp;
  // ^~: this prefix, if it is the longest, comes before the regular expressions.
  priority?: boolean;
  // proxy_set_header: [header, value with its variables].
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

// limit_req: the zone (key and rate) and the tolerated burst.
export interface Limit {
  zone: string;
  burst: number;
  withoutDelay: boolean;
}

export interface LimitZone {
  // The key: $binary_remote_addr (one per address), or something else.
  key: string;
  // Requests per second.
  rate: number;
}

export interface Server {
  // Listening addresses ("0.0.0.0:80", "[::]:80"); those where it is the default server.
  listening: string[];
  // The [::] addresses with ipv6only=off, which also take IPv4.
  dual?: string[];
  byDefault: string[];
  names: string[];
  root: string;
  index: string[];
  refusal: string[];
  // HTTPS addresses (listen … ssl) and the certificate read on loading:
  // renewing the file changes nothing until nginx has reloaded.
  ssl: string[];
  certificate: string | null;
  // Client certificates (https://nginx.org/en/docs/http/ngx_http_ssl_module.html#ssl_verify_client):
  // the CAs trusted (ssl_client_certificate), the CRLs (ssl_crl), read on loading too.
  verifyClient?: 'on' | 'optional' | 'optional_no_ca';
  verifyDepth?: number;
  clientCas?: string;
  crl?: string;
  locations: Location[];
  // return at server level (e.g. redirect to HTTPS).
  back?: string[];
  limit?: Limit;
  statusLimit?: number;
  // access_log: the server's own, otherwise the http block's, otherwise the default.
  accessLog?: AccessLog;
}

// A group of servers (upstream): proxy_pass http://name/ balances between them.
export interface Upstream {
  servers: { address: string; weight: number; rescue: boolean; off: boolean }[];
}

// A map block: the value of $variable computed from the source (a string with variables).
export interface MapBlock {
  source: string;
  entries: { key: string; regex?: RegExp; value: string }[];
  fallback: string;
}

// Where a server writes its access log, and in which format (a log_format name); empty: off.
export type AccessLog = { path: string; format: string }[];

export interface Configuration {
  servers: Server[];
  // log_format: name → the format (combined predefined); map: variable (without $) → block.
  formats?: Record<string, string>;
  maps?: Record<string, MapBlock>;
  upstreams: Record<string, Upstream>;
  // nginx -t's warnings ([warn]): the configuration stays valid.
  warnings: string[];
  zones: Record<string, LimitZone>;
}

class ConfError extends Error {}
const failure = (message: string, file: string, line: number): never => {
  throw new ConfError(`${message} in ${file}:${line}`);
};

// Splits a file into words, ";", "{" and "}", with their line.
function tokens(text: string): { word: string; line: number }[] {
  const listing: { word: string; line: number }[] = [];
  text.split('\n').forEach((rawValue, i) => {
    const line = rawValue.replace(/(^|\s)#.*$/, '$1');
    for (const m of line.matchAll(/"([^"]*)"|'([^']*)'|[;{}]|[^\s;{}"']+/g)) listing.push({ word: m[1] ?? m[2] ?? m[0], line: i + 1 });
  });
  return listing;
}

// The files of an include: a path, or a pattern (*) that may match nothing.
function includedFiles(game: Game, pattern: string, file: string, line: number): string[] {
  const path = pattern.startsWith('/') ? pattern : `${PREFIX}/${pattern}`;
  if (!path.includes('*') && !path.includes('?')) {
    const n = game.find(path);
    if (!n || n.type !== 'file') failure(`open() "${path}" failed (2: No such file or directory)`, file, line);
    return [path];
  }
  // A broken link in sites-enabled/ makes nginx -t fail.
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

// Reads a file and its includes; returns its directives (in the `context` block).
// `read` receives the files read, in order (for nginx -T).
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
        // In "types", each line maps a MIME type to extensions.
        if (ctx === 'types') continue;
        // In "map", each line is a key and its value (or default, hostnames…).
        if (ctx === 'map') {
          if (j.word === '{') failure(`unexpected "{"`, file, line);
          if (name === 'include') {
            for (const included of includedFiles(game, args[0] ?? '', file, line)) directives.push(...parse(game, included, ctx, read));
            continue;
          }
          if (['hostnames', 'volatile'].includes(name) && !args.length) continue;
          if (args.length !== 1) failure(`invalid number of the map parameters`, file, line);
          directives.push({ name, args, file, line });
          continue;
        }
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

// nginx reads the certificate and its key on loading; OpenSSL 3's messages.
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
  const keyText = open(key!, 'certificate key');
  // An internal PKI's certificate (pki.ts): the key must be its own.
  const c = readCertificate(content);
  if (c?.key) {
    const k = family('tls').readKey(keyText);
    if (!k)
      failure(`cannot load certificate key "${key!.args[0]}": PEM_read_bio_PrivateKey() failed (SSL: error:1E08010C:DECODER routines::unsupported:No supported data to decode.)`, key!.file, key!.line);
    if (k!.id !== c.key.id)
      failure(`SSL_CTX_use_PrivateKey("${key!.args[0]}") failed (SSL: error:05800074:x509 certificate routines::key values mismatch)`, key!.file, key!.line);
  }
  return content;
}

// ssl_verify_client, ssl_client_certificate, ssl_verify_depth, ssl_crl: read on loading.
function loadClientTls(game: Game, children: Directive[], http: Directive[], server: Directive): Partial<Server> {
  const found = (name: string) => children.find((d) => d.name === name) ?? http.find((d) => d.name === name);
  const verify = found('ssl_verify_client');
  const cas = found('ssl_client_certificate') ?? found('ssl_trusted_certificate');
  const depth = found('ssl_verify_depth');
  const crl = found('ssl_crl');
  if (verify && !['on', 'off', 'optional', 'optional_no_ca'].includes(verify.args[0]))
    failure(`invalid value "${verify.args[0]}" in "ssl_verify_client" directive, it must be "on", "off", "optional" or "optional_no_ca"`, verify.file, verify.line);
  if (depth && !/^\d+$/.test(depth.args[0])) failure(`invalid value "${depth.args[0]}" in "ssl_verify_depth" directive`, depth.file, depth.line);
  const mode = verify?.args[0] === 'off' ? undefined : (verify?.args[0] as Server['verifyClient'] | undefined);
  if ((mode === 'on' || mode === 'optional') && !cas) failure('no ssl_client_certificate or ssl_trusted_certificate for ssl_verify_client', verify!.file, verify!.line);
  const open = (d: Directive, routine: string) => {
    const path = d.args[0];
    const n = game.find(path);
    if (!n || n.type !== 'file')
      failure(
        `${routine}("${path}") failed (SSL: error:80000002:system library::No such file or directory:calling fopen(${path}, r) error:10000080:BIO routines::no such file error:05880002:x509 certificate routines::system lib)`,
        d.file,
        d.line,
      );
    return game.read(path) ?? '';
  };
  void server;
  return {
    ...(mode ? { verifyClient: mode } : {}),
    ...(depth ? { verifyDepth: Number(depth.args[0]) } : {}),
    ...(cas ? { clientCas: open(cas, 'SSL_CTX_load_verify_locations') } : {}),
    ...(crl ? { crl: open(crl, 'X509_LOOKUP_load_file') } : {}),
  };
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

// limit_req zone=name [burst=N] [nodelay]: the zone must exist.
function readLimit(d: Directive, zones: Record<string, LimitZone>): Limit {
  const zone = d.args.find((a) => a.startsWith('zone='))?.slice(5);
  const burst = d.args.find((a) => a.startsWith('burst='))?.slice(6);
  const unknown = d.args.find((a) => !a.startsWith('zone=') && !a.startsWith('burst=') && a !== 'nodelay' && !a.startsWith('delay='));
  if (unknown) failure(`invalid parameter "${unknown}"`, d.file, d.line);
  if (!zone) failure(`no shared memory zone specified`, d.file, d.line);
  if (burst !== undefined && !/^\d+$/.test(burst)) failure(`invalid burst value "${burst}"`, d.file, d.line);
  // A zone never declared: nginx -t says so without file or line.
  if (!zones[zone!]) throw new ConfError(`zero size shared memory zone "${zone}"`);
  return { zone: zone!, burst: Number(burst ?? 0), withoutDelay: d.args.includes('nodelay') };
}

// "80", "[::]:80", "192.0.2.11:80" → address:port.
const address = (value: string) =>
  /^\d+$/.test(value) ? `0.0.0.0:${value}` : /^\[[^\]]*\]$/.test(value) ? `${value}:80` : value.includes(':') ? value : `${value}:80`;

/** Reads and checks the whole configuration; throws an error in nginx's format. */
function build(game: Game, read: string[] = []): Configuration {
  if (!game.find(CONF)) failure(`open() "${CONF}" failed (2: No such file or directory)`, CONF, 0);
  const root = parse(game, CONF, 'main', read);
  const http = root.find((d) => d.name === 'http')?.children ?? [];
  const values = (listing: Directive[], name: string) => listing.filter((d) => d.name === name).flatMap((d) => d.args);
  const zones = readZones(http);
  const formats = readFormats(http);
  const maps = readMaps(http);
  const named = (m: MapBlock, v: string) => m.entries.some((e) => e.regex && e.regex.source.includes(`(?<${v}>`));
  const known = (v: string) => KNOWN_VARIABLES.has(v) || !!maps[v] || /^(http|arg|cookie|sent_http|upstream_http)_\w+$/.test(v);
  for (const [n, f] of Object.entries(formats)) {
    if (n === 'combined') continue;
    for (const m of f.text.matchAll(/\$\{?(\w+)\}?/g)) if (!known(m[1])) failure(`unknown "${m[1]}" variable`, f.file, f.line);
  }
  for (const m of Object.values(maps))
    for (const v of [m.source, ...m.entries.map((e) => e.value), m.fallback].flatMap((x) => [...x.matchAll(/\$\{?(\w+)\}?/g)].map((y) => y[1])))
      if (!known(v) && !/^\d$/.test(v) && !named(m, v)) failure(`unknown "${v}" variable`, m.file, m.line);
  const accessLogs = (ds: Directive[]): AccessLog | undefined => {
    const own = ds.filter((d) => d.name === 'access_log');
    if (!own.length) return undefined;
    const out: AccessLog = [];
    for (const d of own) {
      if (d.args[0] === 'off') continue;
      const format = d.args[1] && !d.args[1].includes('=') ? d.args[1] : 'combined';
      if (!formats[format]) failure(`unknown log format "${format}"`, d.file, d.line);
      out.push({ path: d.args[0], format });
    }
    return out;
  };
  const httpLogs = accessLogs(http);
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
      const dual: string[] = [];
      for (const l of children.filter((d) => d.name === 'listen')) {
        const a = address(l.args[0]);
        listening.push(a);
        // ipv6only=off: the [::] socket also takes IPv4 (https://nginx.org/en/docs/http/ngx_http_core_module.html#listen).
        const only = l.args.find((x) => x.startsWith('ipv6only='));
        if (only && !['ipv6only=on', 'ipv6only=off'].includes(only)) failure(`invalid ipv6only flags "${only.slice(9)}"`, l.file, l.line);
        if (only === 'ipv6only=off' && a.startsWith('[::]:')) dual.push(a);
        if (l.args.includes('ssl')) ssl.push(a);
        if (l.args.includes('default_server')) {
          if (bySeenDefault[a]) failure(`a duplicate default server for ${a}`, l.file, l.line);
          bySeenDefault[a] = true;
          byDefault.push(a);
        }
      }
      const certificate = ssl.length ? loadCertificate(game, children, http, s) : null;
      const clientTls = ssl.length ? loadClientTls(game, children, http, s) : {};
      // The same name on the same address: the first server read keeps it.
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
        ...clientTls,
        locations,
        back: children.find((d) => d.name === 'return')?.args,
        listening: listening.length ? listening : ['0.0.0.0:80'],
        dual,
        byDefault,
        names,
        root: values(children, 'root')[0] ?? values(http, 'root')[0] ?? '/usr/share/nginx/html',
        index: values(children, 'index').length ? values(children, 'index') : values(http, 'index').length ? values(http, 'index') : ['index.html'],
        refusal: [...values(http, 'deny'), ...values(children, 'deny')],
        accessLog: accessLogs(children) ?? httpLogs ?? [{ path: '/var/log/nginx/access.log', format: 'combined' }],
      };
    });
  return {
    servers,
    warnings,
    zones,
    upstreams: readUpstreams(http),
    formats: Object.fromEntries(Object.entries(formats).map(([n, f]) => [n, f.text])),
    maps: Object.fromEntries(Object.entries(maps).map(([n, m]) => [n, { source: m.source, entries: m.entries, fallback: m.fallback }])),
  };
}

// The variables a log format or a map may use (ngx_http_core_module's and the log module's).
const KNOWN_VARIABLES = new Set([
  'remote_addr', 'binary_remote_addr', 'remote_user', 'remote_port', 'time_local', 'time_iso8601', 'msec', 'request', 'request_method', 'request_uri', 'uri',
  'document_uri', 'args', 'query_string', 'status', 'body_bytes_sent', 'bytes_sent', 'request_length', 'request_time', 'host', 'hostname', 'server_name',
  'server_addr', 'server_port', 'server_protocol', 'scheme', 'https', 'pipe', 'connection', 'connection_requests', 'upstream_addr', 'upstream_status',
  'upstream_response_time', 'proxy_add_x_forwarded_for', 'realip_remote_addr', 'nginx_version', 'pid',
]);

const COMBINED = '$remote_addr - $remote_user [$time_local] "$request" $status $body_bytes_sent "$http_referer" "$http_user_agent"';

// log_format name [escape=default|json|none] string ...; (combined is predefined and can't be redefined)
function readFormats(http: Directive[]): Record<string, { text: string; file: string; line: number }> {
  const formats: Record<string, { text: string; file: string; line: number }> = { combined: { text: COMBINED, file: '', line: 0 } };
  for (const d of http.filter((x) => x.name === 'log_format')) {
    const [name, ...rest] = d.args;
    if (formats[name]) failure(`duplicate "log_format" name "${name}"`, d.file, d.line);
    const escape = rest[0]?.startsWith('escape=') ? rest.shift()! : null;
    if (escape && !['escape=default', 'escape=json', 'escape=none'].includes(escape)) failure(`unknown log format escaping "${escape.slice(7)}"`, d.file, d.line);
    if (!rest.length) failure(`invalid number of arguments in "log_format" directive`, d.file, d.line);
    formats[name] = { text: rest.join(''), file: d.file, line: d.line };
  }
  return formats;
}

// map $source $variable { key value; ~regex value; default value; }
function readMaps(http: Directive[]): Record<string, MapBlock & { file: string; line: number }> {
  const maps: Record<string, MapBlock & { file: string; line: number }> = {};
  for (const d of http.filter((x) => x.name === 'map')) {
    const [source, target] = d.args;
    if (!target.startsWith('$')) failure(`invalid variable name "${target}"`, d.file, d.line);
    const variable = target.slice(1);
    if (maps[variable] || KNOWN_VARIABLES.has(variable)) failure(`the duplicate "${variable}" variable`, d.file, d.line);
    const block: MapBlock & { file: string; line: number } = { source, entries: [], fallback: '', file: d.file, line: d.line };
    for (const e of d.children ?? []) {
      const value = e.args[0];
      if (e.name === 'default') {
        block.fallback = value;
        continue;
      }
      if (e.name.startsWith('~')) {
        const insensitive = e.name.startsWith('~*');
        const raw = e.name.slice(insensitive ? 2 : 1);
        try {
          // PCRE's named captures (?P<name>…) are written (?<name>…) in JavaScript.
          block.entries.push({ key: e.name, regex: new RegExp(raw.replace(/\(\?P</g, '(?<'), insensitive ? 'i' : ''), value });
        } catch (x) {
          failure(`pcre2_compile() failed: ${(x as Error).message.replace(/^Invalid regular expression: /, '')} in "${raw}"`, e.file, e.line);
        }
      } else {
        if (block.entries.some((x) => !x.regex && x.key === e.name)) failure(`duplicate parameter "${e.name}"`, e.file, e.line);
        block.entries.push({ key: e.name.replace(/^\\/, ''), value });
      }
    }
    maps[variable] = block;
  }
  return maps;
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

// nginx's weighted round-robin (smooth weighted round-robin): on each
// request, each server gains its weight, the highest is chosen and loses the
// sum of the weights. With 9 and 1: 9 requests out of 10 for the first.
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
  // The game's checks don't turn the round-robin.
  if (trace) states[name] = active;
  return chosen.address;
}

/** Checks the configuration: null if it is fine, otherwise the [emerg] message. */
export function test(game: Game): { config: Configuration; error: null } | { config: null; error: string } {
  try {
    return { config: build(game), error: null };
  } catch (e) {
    if (e instanceof ConfError) return { config: null, error: e.message };
    throw e;
  }
}

/** The configuration files read, in order (nginx -T). */
export function readFiles(game: Game): string[] {
  const read: string[] = [];
  build(game, read);
  return read;
}

// nginx's time in its logs: "2026/10/23 08:15:02".
export const nginxTime = (ms: number) => new Date(ms).toISOString().slice(0, 19).replace('T', ' ').replaceAll('-', '/');

// For systemd: nginx refuses to start (or reload) a bad configuration.
export function checkNginx(game: Game): string[] | null {
  const { error } = test(game);
  if (!error) return null;
  const h = nginxTime((systemd(game)?.clock ?? 0) + 1000);
  return [`${h} [emerg] 2411#2411: ${error}`, `nginx: configuration file ${CONF} test failed`];
}

/** On start and reload: the configuration read becomes the one that serves. */
export function loadNginx(game: Game) {
  game.state.nginx = { ...(game.state.nginx ?? {}), load: test(game).config };
}

export interface Response {
  code: number;
  body: string;
  headers: string[];
  // In HTTPS: the certificate presented by the server (PEM).
  certificate?: string;
  // The CAs it accepts for client certificates (s_client's "Acceptable client certificate CA names").
  clientCaNames?: string[];
}

const REASONS: Record<number, string> = {
  200: 'OK',
  400: 'Bad Request',
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
// nginx's 400 pages for client certificates (ngx_http_special_response.c).
const badRequest = (title: string) =>
  `<html>\n<head><title>400 ${title}</title></head>\n<body>\n<center><h1>400 Bad Request</h1></center>\n<center>${title}</center>\n<hr><center>nginx/${VERSION}</center>\n</body>\n</html>`;

// The client's certificate, checked like nginx with OpenSSL: null if accepted.
function clientVerdict(game: Game, server: Server, client: Client): { page: string; log: string } | null {
  const chain = readAll(client.certificate ?? null);
  if (!chain.length) return server.verifyClient === 'on' ? { page: 'No required SSL certificate was sent', log: 'client sent no required SSL certificate' } : null;
  if (server.verifyClient === 'optional_no_ca') return null;
  const { verify, readCrls, VERIFY_ERRORS } = family('tls');
  const r = verify(chain[0], {
    now: toUtc(systemd(game)?.clock ?? 0),
    trusted: readAll(server.clientCas ?? null),
    untrusted: chain.slice(1),
    crls: readCrls(server.crl ?? null),
    crlCheck: server.crl ? 'all' : 'none',
    purpose: 'sslclient',
    depth: server.verifyDepth ?? 1,
  });
  const e = r.errors[0];
  return e ? { page: 'The SSL certificate error', log: `client SSL certificate verify error: (${e.code}:${VERIFY_ERRORS[e.code]})` } : null;
}

const page = (code: number) =>
  `<html>\n<head><title>${code} ${REASONS[code]}</title></head>\n<body>\n<center><h1>${code} ${REASONS[code]}</h1></center>\n<hr><center>nginx/${VERSION}</center>\n</body>\n</html>`;
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
// Date header (GMT); the machine's clock is on Paris time.
const dateHttp = (ms: number) => {
  const d = new Date(toUtc(ms));
  return `${DAYS[d.getUTCDay()]}, ${String(d.getUTCDate()).padStart(2, '0')} ${MONTH[d.getUTCMonth()]} ${d.getUTCFullYear()} ${d.toISOString().slice(11, 19)} GMT`;
};

// The programs behind nginx (proxy_pass): state.apps, by address
// "127.0.0.1:3000". An app answers as long as its systemd service runs.
export interface App {
  service: string;
  // The pages it serves, by path; elsewhere, Express's 404 page.
  pages: Record<string, string>;
  // Or an app that computes its answer (version, configuration, health…).
  // entetes : ceux qu'elle ajoute (Server, Location…).
  answer?: (game: Game, path: string, request: Request) => { code: number; body: string; type?: string; headers?: string[] };
  // Requests per second it can serve (no limit if absent).
  capacity?: number;
  // How long it takes to answer, in seconds (curl -w '%{time_total}'); 0.004 if absent.
  time?: (game: Game) => number;
}

// What the app sees of a request: the headers received (lower-case names) and the connection's address.
export interface Request {
  headers: Record<string, string>;
  address: string;
  // false: a check by the game, which leaves no trace in the logs.
  trace?: boolean;
}

const PAGE_EXPRESS = (path: string) =>
  `<!DOCTYPE html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n<title>Error</title>\n</head>\n<body>\n<pre>Cannot GET ${path}</pre>\n</body>\n</html>`;

/** What an app answers (without going through nginx). */
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

/** An app reached directly on its port (curl http://127.0.0.1:3001/): null if nobody listens. */
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

// A line of /var/log/nginx/error.log (if the file exists).
function errorLog(game: Game, level: string, message: string) {
  if (!game.state.nginxTrace) return;
  const n = game.find('/var/log/nginx/error.log');
  if (n?.type !== 'file' || typeof n.content !== 'string') return;
  const number = (game.state.nginxConnections = (game.state.nginxConnections ?? 0) + 1);
  const line = `${nginxTime(systemd(game)?.clock ?? 0)} [${level}] 2412#2412: *${number} ${message}`;
  n.content = n.content ? `${n.content}\n${line}` : line;
}

/** The sockets the loaded configuration listens on, as ss shows them: 0.0.0.0, [::] (IPv6 only), or * (ipv6only=off). */
export function nginxSockets(config: Configuration): { address: string; port: number }[] {
  const out = new Map<string, { address: string; port: number }>();
  for (const s of config.servers)
    for (const l of s.listening) {
      const m = /^(.*):(\d+)$/.exec(l);
      if (!m) continue;
      const address = s.dual?.includes(l) ? '*' : m[1];
      out.set(`${address}:${m[2]}`, { address, port: Number(m[2]) });
    }
  return [...out.values()];
}

/** The location block that handles this path, like nginx: = exact, the longest prefix (^~ stops there), the regular expressions in order, otherwise that prefix. */
export function chooseLocation(server: Server, path: string): Location | null {
  const exact = server.locations.find((l) => l.exact && l.path === path);
  if (exact) return exact;
  const prefix =
    server.locations.filter((l) => !l.exact && !l.regex && path.startsWith(l.path)).sort((a, b) => b.path.length - a.path.length)[0] ?? null;
  if (prefix?.priority) return prefix;
  return server.locations.find((l) => l.regex?.test(path)) ?? prefix;
}

/**
 * An HTTP (port 80) or HTTPS (443) request to this machine: null if
 * nobody listens. The server is chosen by its name (Host header, or SNI
 * in HTTPS), otherwise the port's default one, otherwise the first; then
 * the location block, which serves a file, returns (return) or passes the
 * request to an app (proxy_pass).
 */
export function httpRequest(game: Game, host: string, path: string, port = 80, trace = true, client?: Client): Response | null {
  // The game's checks (objectives) query nginx without leaving a trace in the log.
  game.state.nginxTrace = trace;
  const who = client ?? { address: '127.0.0.1', time: systemd(game)?.clock ?? 0, agent: 'curl/8.14.1' };
  const r = handle(game, host, path, port, who);
  if (r && trace) accessLog(game, who, host, path, port, r);
  return r;
}

// Who makes the request: its address, the time (local, in milliseconds), its
// browser; the method (GET by default) and the headers it sends (lower-case names).
export interface Client {
  address: string;
  time: number;
  agent: string;
  // In HTTPS, the certificate chain the client presents (PEM), if any.
  certificate?: string;
  method?: string;
  headers?: Record<string, string>;
}

// "27/Mar/2027:20:00:01 +0100", like $time_local.
function localeTime(ms: number): string {
  const d = new Date(ms);
  return `${String(d.getUTCDate()).padStart(2, '0')}/${MONTH[d.getUTCMonth()]}/${d.getUTCFullYear()}:${d.toISOString().slice(11, 19)} ${summerTime(ms) ? '+0200' : '+0100'}`;
}

/**
 * The lines nginx writes for a request in its access logs (each access_log
 * of the server that takes it, in its log_format, the map variables
 * computed), without writing them: [file, line].
 */
export function accessLines(game: Game, c: Client, host: string, path: string, port: number, r: Pick<Response, 'code' | 'body'>): [string, string][] {
  const config: Configuration | null = game.state.nginx?.load ?? null;
  if (!config) return [];
  const picked = pickServer(config, host, port, c);
  const logs = picked?.server.accessLog ?? [{ path: '/var/log/nginx/access.log', format: 'combined' }];
  const header = (name: string) => c.headers?.[name.replace(/_/g, '-')] ?? '';
  const base: Record<string, string> = {
    remote_addr: c.address,
    remote_user: '',
    time_local: localeTime(c.time),
    time_iso8601: `${new Date(c.time).toISOString().slice(0, 19)}${summerTime(c.time) ? '+02:00' : '+01:00'}`,
    msec: (c.time / 1000).toFixed(3),
    request: `${c.method ?? 'GET'} ${path} HTTP/1.1`,
    request_method: c.method ?? 'GET',
    request_uri: path,
    uri: path.split('?')[0],
    args: path.split('?')[1] ?? '',
    status: String(r.code),
    body_bytes_sent: String(new TextEncoder().encode(r.body).length),
    host: host.toLowerCase(),
    server_name: picked?.server.names[0] ?? '',
    server_protocol: 'HTTP/1.1',
    scheme: port === 443 ? 'https' : 'http',
    http_referer: header('referer'),
    http_user_agent: c.agent,
  };
  const value = (name: string, own: Record<string, string> = {}, depth = 0): string => {
    if (name in own) return own[name];
    if (name in base) return base[name];
    if (name.startsWith('http_')) return header(name.slice(5));
    const m = config.maps?.[name];
    if (!m || depth > 8) return '';
    const source = expand(m.source, {}, depth + 1);
    for (const e of [...m.entries.filter((x) => !x.regex), ...m.entries.filter((x) => x.regex)]) {
      if (!e.regex) {
        if (e.key === source) return expand(e.value, {}, depth + 1);
        continue;
      }
      const found = e.regex.exec(source);
      if (!found) continue;
      const captures: Record<string, string> = { ...(found.groups ?? {}) };
      found.forEach((g, i) => {
        if (i > 0) captures[String(i)] = g ?? '';
      });
      return expand(e.value, captures, depth + 1);
    }
    return expand(m.fallback, {}, depth + 1);
  };
  const expand = (text: string, own: Record<string, string> = {}, depth = 0): string => text.replace(/\$\{?(\w+)\}?/g, (_, n: string) => value(n, own, depth));
  // In a log line, an empty variable is written "-".
  const logged = (format: string) => format.replace(/\$\{?(\w+)\}?/g, (_, n: string) => value(n) || '-');
  return logs.map((l) => [l.path, logged(config.formats?.[l.format] ?? COMBINED)]);
}

// The lines of the access logs (access_log, log_format), if the chapter asks for it.
function accessLog(game: Game, c: Client, host: string, path: string, port: number, r: Response) {
  if (!game.state.nginx?.accessLog) return;
  for (const [file, line] of accessLines(game, c, host, path, port, r)) {
    let n = game.find(file);
    if (!n) {
      const dir = game.find(file.replace(/\/[^/]+$/, '') || '/');
      if (dir?.type !== 'directory') continue;
      n = dir.children[file.split('/').at(-1)!] = { type: 'file', content: '', lines: true, owner: 'www-data', group: 'adm', mode: 'rw-r-----' };
    }
    if (n.type !== 'file' || typeof n.content !== 'string') continue;
    n.content = n.content ? `${n.content}\n${line}` : line;
    if (n.size !== undefined) n.size += line.length + 1;
    n.mtime = c.time;
  }
}

// An address covered by a deny rule (address, CIDR range or all).
function couvert(rule: string, address: string): boolean {
  if (rule === 'all') return true;
  const [base, bits = '32'] = rule.split('/');
  const count = (ip: string) => ip.split('.').reduce((t, o) => t * 256 + Number(o), 0);
  if (!/^\d+\.\d+\.\d+\.\d+$/.test(base) || !/^\d+\.\d+\.\d+\.\d+$/.test(address)) return rule === address;
  const mask = Number(bits) === 0 ? 0 : 2 ** 32 - 2 ** (32 - Number(bits));
  return (count(base) & mask) >>> 0 === (count(address) & mask) >>> 0;
}

/** The server block that takes a request (its name, otherwise the port's default server), and the address it took it on. */
function pickServer(config: Configuration, host: string, port: number, client: Client): { server: Server; at: string } | null {
  // The family the request arrived in: the client's address (::1, 2001:db8::…), or a literal [::1] host.
  const v6 = client.address.includes(':') || /^\[|:/.test(host);
  const dualAt = `[::]:${port}`;
  const a = v6 ? `[::]:${port}` : `0.0.0.0:${port}`;
  const takes = (s: Server) => s.listening.includes(a) || (!v6 && !!s.dual?.includes(dualAt));
  const candidates = config.servers.filter(takes);
  const at = (s: Server) => (s.listening.includes(a) ? a : dualAt);
  const server = candidates.find((s) => s.names.includes(host.toLowerCase())) ?? candidates.find((s) => s.byDefault.includes(at(s))) ?? candidates[0];
  return server ? { server, at: at(server) } : null;
}

function handle(game: Game, host: string, path: string, port: number, client: Client): Response | null {
  const sd = systemd(game);
  const config: Configuration | null = game.state.nginx?.load ?? null;
  if (!config || sd?.services.nginx?.state !== 'active') return null;
  const picked = pickServer(config, host, port, client);
  if (!picked) return null;
  const server = picked.server;
  const at = (_: Server) => picked.at;
  // An HTTPS port doesn't answer in plain text (and vice versa): only the right case is simulated.
  if (server.ssl.includes(at(server)) !== (port === 443)) return null;
  // A client certificate required: nginx checks it, and answers 400 if it is missing or refused.
  const refusedClient = port === 443 && server.verifyClient ? clientVerdict(game, server, client) : null;
  const response = (code: number, body: string, more: string[] = []): Response => ({
    code,
    body,
    certificate: port === 443 ? (server.certificate ?? undefined) : undefined,
    ...(port === 443 && server.verifyClient && server.clientCas ? { clientCaNames: readAll(server.clientCas).map(subject) } : {}),
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
  // return code [address or text]: 301/302 with Location, otherwise the text.
  const back = ([code, what = '']: string[]) => {
    const n = Number(code);
    if (n >= 300 && n < 400) return response(n, page(n), [`Location: ${variables(what)}`]);
    return response(n, variables(what));
  };
  const loc = chooseLocation(server, path.split('?')[0]);
  const context = `client: ${client.address}, server: ${server.names[0] ?? '_'}, request: "GET ${path} HTTP/1.1", host: "${host}"`;
  if (refusedClient) {
    errorLog(game, 'info', `${refusedClient.log} while reading client request headers, ${context}`);
    return response(400, badRequest(refusedClient.page));
  }
  // deny : 403 (http, puis server, puis location).
  if ([...server.refusal, ...(loc?.refusal ?? [])].some((r) => couvert(r, client.address))) {
    errorLog(game, 'error', `access forbidden by rule, ${context}`);
    return response(403, page(403));
  }
  // limit_req: a bucket that leaks at the zone's rate; beyond the burst, refused.
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
    // The game's checks don't fill the bucket.
    if (game.state.nginxTrace) buckets[`${limit.zone}|${key}`] = { excess, last: client.time };
  }
  if (server.back) return back(server.back);
  if (loc?.back) return back(loc.back);
  if (loc?.proxy) {
    const m = /^https?:\/\/([^/]+)(\/.*)?$/.exec(loc.proxy);
    // localhost: on a machine that speaks IPv6 with "::1 localhost" in /etc/hosts, nginx resolves both
    // addresses at load time and tries ::1 first, then 127.0.0.1 (proxy_next_upstream error).
    const both = /^localhost(?=:|$)/.test(m?.[1] ?? '') && !!game.state.lan?.ra && /^\s*::1\s+(.*\s)?localhost(\s|$)/m.test(game.read('/etc/hosts') ?? '');
    const upstreamHost = (m?.[1] ?? '').replace(/^localhost(?=:|$)/, '127.0.0.1');
    const portOf = /:(\d+)$/.exec(upstreamHost)?.[1] ?? '80';
    // With a path part in proxy_pass, it replaces the location's prefix.
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
      // A server that doesn't answer: nginx tries the next one (proxy_next_upstream error).
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
    } else if (both) {
      for (const candidate of [`[::1]:${portOf}`, `127.0.0.1:${portOf}`]) {
        address = candidate;
        app = reach(candidate);
        if (app) break;
        errorLog(game, 'error', connection(candidate));
      }
      if (!app) return response(502, page(502));
    } else {
      app = reach(address);
      if (!app) {
        errorLog(game, 'error', connection(address));
        return response(502, page(502));
      }
    }
    game.state.nginxLastUpstream = address;
    // An app has a capacity: beyond it, it no longer answers in time (504).
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
    // The headers the app receives: the client's, Host and Connection by default, then proxy_set_header.
    const received: Record<string, string> = { ...(client.headers ?? {}), host: upstreamHost, connection: 'close' };
    const xff = client.headers?.['x-forwarded-for'];
    for (const [name, value] of loc.headers) {
      const v = value
        .replaceAll('$proxy_add_x_forwarded_for', xff ? `${xff}, ${client.address}` : client.address)
        .replaceAll('$remote_addr', client.address)
        .replaceAll('$proxy_host', upstreamHost)
        .replaceAll('$http_host', host)
        // $http_name: the "name" header sent by the client (dashes written _), empty if it sent none.
        .replace(/\$http_([a-z0-9_]+)/g, (_, n: string) => client.headers?.[n.replace(/_/g, '-')] ?? '');
      // An empty value: the header is not sent.
      if (variables(v) === '') delete received[name.toLowerCase()];
      else received[name.toLowerCase()] = variables(v);
    }
    const r = answerApp(game, app, upstream, { headers: received, address: '127.0.0.1', trace: !!game.state.nginxTrace });
    // A redirect from the app passes as is (proxy_redirect is not simulated).
    return response(r.code, r.body, (r.headers ?? []).filter((e) => e.startsWith('Location: ')));
  }
  // A file: root + path, or alias in place of the location's prefix.
  const withoutRequest = path.split('?')[0] || '/';
  const target = loc?.alias
    ? loc.alias.replace(/\/$/, '') + '/' + withoutRequest.slice(loc.path.length).replace(/^\//, '')
    : (loc?.root ?? server.root).replace(/\/$/, '') + withoutRequest;
  const index = loc?.index ?? server.index;
  const request = game.find(target);
  let file = request;
  if (request?.type === 'directory') {
    const name = index.find((i) => request.children[i] && game.find(`${target.replace(/\/$/, '')}/${i}`)?.type === 'file');
    // A place with no index page: nginx refuses to show its listing.
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
  // nginx's worker processes run under the www-data account.
  if (!game.can(file, 'r', 'www-data')) return response(403, page(403));
  const body = typeof file.content === 'function' ? file.content(game) : file.content;
  return response(200, body);
}
