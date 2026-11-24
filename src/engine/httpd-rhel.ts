// Apache httpd 2.4.63 as Rocky Linux 10 packages it (state.httpd, see
// rhel.ts): /etc/httpd/conf/httpd.conf and conf.d/*.conf read at start and
// on reload (Listen, DocumentRoot, <Directory> with Require, <VirtualHost>
// with ServerName/ServerAlias, ProxyPass, welcome.conf's test page), the
// sockets it binds (SELinux's name_bind for httpd_t), the requests it
// serves (Unix rights for the apache account, then SELinux: search on each
// directory, read on the file), its reverse proxy (name_connect), its logs
// (/var/log/httpd/error_log and access_log) and its journal.
// Messages from httpd's sources at 2.4.63 (server/listen.c AH00072,
// server/main.c AH00015, mpm event "no listening sockets available",
// server/core.c AH00132, server/request.c AH00035, modules/proxy AH00957,
// AH00959, AH01114, mod_authz_core AH01630) and Rocky's package (httpd.conf,
// welcome.conf, the "SELinux policy enabled" notice of Red Hat's
// httpd-2.4.x-selinux patch, "Server configured, listening on" of its
// systemd patch). https://httpd.apache.org/docs/2.4/
// Simplified (see docs/SCENARIOS.md): the directives the story uses, no
// .htaccess, no modules' own configuration, a proxy worker never put in
// error state (AH00959's 60 s retry is not modelled).

import type { Game, Shell } from './shell';
import type { Listening } from './commands/ss';
import { systemd, writeLog } from './systemd';
import { check, HTTPD, portType as portTypeOf } from './selinux';
import type { Node } from './world';

export const CONF = '/etc/httpd/conf/httpd.conf';
export const CONF_D = '/etc/httpd/conf.d';
export const ERROR_LOG = '/var/log/httpd/error_log';
export const ACCESS_LOG = '/var/log/httpd/access_log';
export const NOINDEX = '/usr/share/httpd/noindex/index.html';
export const SERVER = 'Apache/2.4.63 (Rocky Linux)';

export interface Site {
  port: number | null;
  names: string[];
  root: string;
  proxies: [string, string][];
}
export interface HttpdConf {
  listens: number[];
  main: Site;
  vhosts: Site[];
  // <Directory> → Require all granted / denied.
  dirs: Record<string, 'granted' | 'denied'>;
  welcome: boolean;
  serverName: boolean;
}
export interface HttpdState {
  loaded: HttpdConf | null;
  pid: number;
  // The apps on this machine's ports (a reverse proxy's backends): port → page for a path.
  backends: Record<number, { service: string; answer: (path: string) => string }>;
}
export const httpd = (game: Game): HttpdState | undefined => game.state.httpd as HttpdState | undefined;

const KNOWN = new Set(
  'ServerRoot Listen Include IncludeOptional User Group ServerAdmin ServerName ServerAlias AllowOverride Require DocumentRoot Options DirectoryIndex ErrorLog LogLevel LogFormat CustomLog ScriptAlias TypesConfig AddType AddOutputFilter AddDefaultCharset MIMEMagicFile EnableSendfile ErrorDocument Alias ProxyPass ProxyPassReverse ProxyPreserveHost ProxyRequests Header RequestHeader Redirect LoadModule KeepAlive Timeout'.split(' '),
);
const unquote = (s: string) => s.replace(/^"(.*)"$/, '$1');

/** Reads the configuration like httpd -t: the configuration, or AH00526's lines. */
export function readConf(game: Game): HttpdConf | { errors: string[] } {
  const files = [CONF];
  const d = game.find(CONF_D);
  const main = game.read(CONF);
  if (main === null) return { errors: [`AH00534: httpd: Configuration error: No MPM loaded.`] };
  if (/^\s*IncludeOptional\s+conf\.d\/\*\.conf/m.test(main) && d?.type === 'directory')
    files.push(...Object.keys(d.children).filter((k) => k.endsWith('.conf')).sort().map((k) => `${CONF_D}/${k}`));
  const conf: HttpdConf = { listens: [], main: { port: null, names: [], root: '/var/www/html', proxies: [] }, vhosts: [], dirs: {}, welcome: false, serverName: false };
  for (const file of files) {
    const text = game.read(file) ?? '';
    let site: Site = conf.main;
    let dir: string | null = null;
    const lines = text.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line || line.startsWith('#')) continue;
      const open = /^<(\w+)\s*([^>]*)>$/.exec(line);
      const close = /^<\/(\w+)>$/.exec(line);
      if (open) {
        const [, tag, arg] = open;
        if (tag === 'VirtualHost') {
          const port = Number(/:(\d+)/.exec(arg)?.[1] ?? 80);
          site = { port, names: [], root: conf.main.root, proxies: [] };
          conf.vhosts.push(site);
        } else if (tag === 'Directory') dir = unquote(arg.trim()).replace(/\/$/, '') || '/';
        else if (tag === 'LocationMatch' && file.endsWith('welcome.conf')) conf.welcome = true;
        continue;
      }
      if (close) {
        if (close[1] === 'VirtualHost') site = conf.main;
        if (close[1] === 'Directory') dir = null;
        continue;
      }
      const [name, ...rest] = line.split(/\s+/);
      if (!KNOWN.has(name))
        return {
          errors: [
            `AH00526: Syntax error on line ${i + 1} of ${file}:`,
            `Invalid command '${name}', perhaps misspelled or defined by a module not included in the server configuration`,
          ],
        };
      const value = unquote(rest.join(' '));
      if (name === 'Listen') {
        const port = Number(/(\d+)$/.exec(value)?.[1]);
        if (port) conf.listens.push(port);
      } else if (name === 'DocumentRoot') site.root = value.replace(/\/$/, '');
      else if (name === 'ServerName') {
        if (site === conf.main) conf.serverName = true;
        site.names.push(value.split(':')[0].toLowerCase());
      } else if (name === 'ServerAlias') site.names.push(...rest.map((x) => x.toLowerCase()));
      else if (name === 'ProxyPass' && rest.length >= 2) site.proxies.push([rest[0], rest[1]]);
      else if (name === 'Require' && dir && rest[0] === 'all') conf.dirs[dir] = rest[1] === 'granted' ? 'granted' : 'denied';
    }
  }
  if (!conf.listens.length) return { errors: ['AH00534: httpd: Configuration error: No listening sockets available, shutting down'] };
  // vhosts on the main server's DocumentRoot when they don't name one: kept as read.
  return conf;
}

// ——— The service ———

const timeOfLog = (ms: number) => {
  const d = new Date(ms);
  const day = d.toUTCString().slice(0, 3);
  const month = d.toUTCString().slice(8, 11);
  return `${day} ${month} ${String(d.getUTCDate()).padStart(2, '0')} ${d.toISOString().slice(11, 19)}.${String(512_000 + (ms % 1000) * 371).padStart(6, '0').slice(0, 6)} ${d.getUTCFullYear()}`;
};
/** A line of error_log. */
export function errorLog(game: Game, module: string, level: string, message: string, pid?: number): void {
  const h = httpd(game);
  const clock = systemd(game)?.clock ?? 0;
  const p = pid ?? (h?.pid ?? 2201) + 4;
  append(game, ERROR_LOG, `[${timeOfLog(clock)}] [${module}:${level}] [pid ${p}:tid ${p + 7}] ${message}`);
}
function append(game: Game, path: string, line: string) {
  const n = (game as Shell).find(path);
  if (n?.type !== 'file') return;
  const old = typeof n.content === 'string' ? n.content : '';
  n.content = old ? `${old}\n${line}` : line;
  n.lines = true;
  delete n.size;
}

/** Starting httpd: its configuration, then each socket; null if all went well, else the lines it writes. */
export function startCheck(game: Game): string[] | null {
  const conf = readConf(game);
  if ('errors' in conf) return conf.errors;
  const h = httpd(game)!;
  const taken = ((game.state.listening ?? []) as Listening[]).filter((l) => l.process !== 'httpd');
  for (const port of [...new Set(conf.listens)]) {
    if (taken.some((l) => l.port === port && l.proto === 'tcp'))
      return [`(98)Address already in use: AH00072: make_sock: could not bind to address [::]:${port}`, `(98)Address already in use: AH00072: make_sock: could not bind to address 0.0.0.0:${port}`, 'no listening sockets available, shutting down', 'AH00015: Unable to open logs'];
    const allowed = check(game, { target: `system_u:object_r:${portTypeOf(game, port)}:s0`, tclass: 'tcp_socket', perm: 'name_bind', detail: `src=${port}`, pid: h.pid, syscall: 49, uid: 0 });
    if (!allowed)
      return [`(13)Permission denied: AH00072: make_sock: could not bind to address [::]:${port}`, `(13)Permission denied: AH00072: make_sock: could not bind to address 0.0.0.0:${port}`, 'no listening sockets available, shutting down', 'AH00015: Unable to open logs'];
  }
  return null;
}

/** httpd started (or reloaded): its configuration applies, its sockets listen. */
export function load(game: Game): void {
  const conf = readConf(game);
  const h = httpd(game)!;
  if ('errors' in conf) return;
  h.loaded = conf;
  const others = ((game.state.listening ?? []) as Listening[]).filter((l) => l.process !== 'httpd');
  game.state.listening = [...others, ...[...new Set(conf.listens)].map((port) => ({ proto: 'tcp' as const, address: '[::]', port, process: 'httpd', pid: h.pid, v6only: false }))];
  const sd = systemd(game)!;
  if (!conf.serverName) writeLog(sd, 'httpd.service', 'httpd', h.pid, `AH00558: httpd: Could not reliably determine the server's fully qualified domain name, using ${(game as Shell).hostName}.internal. Set the 'ServerName' directive globally to suppress this message`, 6, false);
  writeLog(sd, 'httpd.service', 'httpd', h.pid, `Server configured, listening on: ${[...new Set(conf.listens)].map((p) => `port ${p}`).join(', ')}`, 6, false);
  errorLog(game, 'core', 'notice', `SELinux policy enabled; httpd running as context ${HTTPD}`, h.pid);
  errorLog(game, 'mpm_event', 'notice', `AH00489: ${SERVER} configured -- resuming normal operations`, h.pid);
  errorLog(game, 'core', 'notice', `AH00094: Command line: '/usr/sbin/httpd -D FOREGROUND'`, h.pid);
}
export function stopped(game: Game): void {
  const h = httpd(game);
  if (h) h.loaded = null;
  game.state.listening = ((game.state.listening ?? []) as Listening[]).filter((l) => l.process !== 'httpd');
}

// ——— Requests ———

export interface Answer {
  code: number;
  body: string;
  type?: string;
}
const REASONS: Record<number, string> = { 200: 'OK', 403: 'Forbidden', 404: 'Not Found', 503: 'Service Unavailable' };
const page = (code: number, title: string, text: string) =>
  `<!DOCTYPE HTML PUBLIC "-//IETF//DTD HTML 2.0//EN">\n<html><head>\n<title>${code} ${title}</title>\n</head><body>\n<h1>${title}</h1>\n<p>${text}</p>\n</body></html>`;
const FORBIDDEN = page(403, 'Forbidden', "You don't have permission to access this resource.");
const NOT_FOUND = page(404, 'Not Found', 'The requested URL was not found on this server.');
const UNAVAILABLE = page(503, 'Service Unavailable', 'The server is temporarily unable to service your\nrequest due to maintenance downtime or capacity\nproblems. Please try again later.');

/** The headers curl -I shows for an answer. */
export function headersOf(game: Game, a: Answer): string[] {
  const date = new Date(systemd(game)?.clock ?? 0).toUTCString();
  return [`HTTP/1.1 ${a.code} ${REASONS[a.code] ?? ''}`.trimEnd(), `Date: ${date}`, `Server: ${SERVER}`, `Content-Length: ${new TextEncoder().encode(a.body + '\n').length}`, `Content-Type: ${a.type ?? 'text/html; charset=UTF-8'}`];
}

/** The <Directory> rule that applies to a path (the longest), denied by <Directory />. */
function required(conf: HttpdConf, path: string): 'granted' | 'denied' {
  let best = '';
  let rule: 'granted' | 'denied' = 'denied';
  for (const [dir, r] of Object.entries(conf.dirs))
    if ((dir === '/' || path === dir || path.startsWith(dir + '/')) && dir.length >= best.length) {
      best = dir;
      rule = r;
    }
  return rule;
}

/**
 * A request to this machine's httpd (null: nobody listens on that port).
 * `quiet`: a check by the story, which leaves no trace (no log, no AVC).
 */
export function serve(game: Game, req: { client: string; host: string; port: number; path: string; agent?: string; method?: string }, quiet = false): Answer | null {
  const h = httpd(game);
  const conf = h?.loaded;
  if (!h || !conf || systemd(game)?.services.httpd?.state !== 'active' || !conf.listens.includes(req.port)) return null;
  const sh = game as Shell;
  const host = req.host.toLowerCase().split(':')[0];
  const onPort = conf.vhosts.filter((v) => v.port === req.port);
  const site = onPort.find((v) => v.names.includes(host)) ?? onPort[0] ?? conf.main;
  const path = decodeURIComponent(req.path.split(/[?#]/)[0] || '/');
  const worker = h.pid + 4;
  const client = `${req.client}:${41000 + ((systemd(game)?.clock ?? 0) / 1000) % 20000}`;
  const finish = (a: Answer): Answer => {
    if (!quiet) {
      const d = new Date(systemd(game)?.clock ?? 0);
      const stamp = `${String(d.getUTCDate()).padStart(2, '0')}/${d.toUTCString().slice(8, 11)}/${d.getUTCFullYear()}:${d.toISOString().slice(11, 19)} +0000`;
      append(game, ACCESS_LOG, `${req.client} - - [${stamp}] "${req.method ?? 'GET'} ${req.path} HTTP/1.1" ${a.code} ${new TextEncoder().encode(a.body + '\n').length} "-" "${req.agent ?? 'curl/8.12.1'}"`);
    }
    return a;
  };
  const log = (module: string, message: string) => !quiet && errorLog(game, module, 'error', message, worker);
  // The reverse proxy (mod_proxy_http).
  const proxy = site.proxies.find(([prefix]) => path === prefix || path.startsWith(prefix.endsWith('/') ? prefix : prefix + '/'));
  if (proxy) {
    const m = /^http:\/\/([^/:]+)(?::(\d+))?(\/.*)?$/.exec(proxy[1]);
    const bport = Number(m?.[2] ?? 80);
    const baddr = m?.[1] ?? '127.0.0.1';
    const allowed = check(
      game,
      { target: `system_u:object_r:${portTypeOf(game, bport)}:s0`, tclass: 'tcp_socket', perm: 'name_connect', detail: `dest=${bport}`, pid: worker, syscall: 42 },
      quiet,
    );
    const backend = h.backends[bport];
    const up = backend && systemd(game)?.services[backend.service]?.state === 'active';
    if (!allowed || !up) {
      log('proxy', `(${allowed ? '111)Connection refused' : '13)Permission denied'}: AH00957: http: attempt to connect to ${baddr}:${bport} (${baddr}:${bport}) failed`);
      log('proxy', `AH00959: ap_proxy_connect_backend disabling worker for (${baddr}:${bport}) for 60s`);
      log('proxy_http', `[client ${client}] AH01114: HTTP: failed to make connection to backend: ${baddr}`);
      return finish({ code: 503, body: UNAVAILABLE });
    }
    const rest = path.slice(proxy[0].replace(/\/$/, '').length) || '/';
    return finish({ code: 200, body: backend.answer(((m?.[3] ?? '/').replace(/\/$/, '') + rest).replace(/^\/\//, '/')) });
  }
  // welcome.conf's test page, for "/" when httpd refuses it (no index, or no access to it).
  const forbiddenRoot = (a: Answer) => (conf.welcome && /^\/+$/.test(path) && a.code === 403 ? { code: 403, body: sh.read(NOINDEX) ?? FORBIDDEN } : a);
  if (path === '/.noindex.html' && conf.welcome) return finish({ code: 200, body: sh.read(NOINDEX) ?? '' });
  const root = site.root;
  let file = `${root}${path}`.replace(/\/+$/, '') || '/';
  if (required(conf, root) === 'denied') {
    log('authz_core', `[client ${client}] AH01630: client denied by server configuration: ${root}${path === '/' ? '/' : path}`);
    return finish(forbiddenRoot({ code: 403, body: FORBIDDEN }));
  }
  // Each directory from / down: the apache account's x, then SELinux's search below the document root.
  const parts = file.split('/').filter(Boolean);
  let n: Node | null = sh.root;
  let at = '';
  for (let i = 0; i < parts.length; i++) {
    if (n?.type !== 'directory') break;
    const searchable = sh.can(n, 'x', 'apache') && (at.length < root.length || check(game, { target: n.context ?? '', tclass: 'dir', perm: 'search', detail: `name="${at.split('/').pop() || '/'}" dev="vda4" ino=${inode(at)}`, pid: worker, syscall: 262 }, quiet));
    if (!searchable) {
      log('core', `(13)Permission denied: [client ${client}] AH00035: access to ${path} denied (filesystem path '${file}') because search permissions are missing on a component of the path`);
      return finish(forbiddenRoot({ code: 403, body: FORBIDDEN }));
    }
    const next: Node | undefined = n.children[parts[i]];
    at += `/${parts[i]}`;
    if (!next) return finish({ code: 404, body: NOT_FOUND });
    n = next.type === 'file' && next.link !== undefined ? sh.find(at) : next;
  }
  if (n?.type === 'directory') {
    const index = n.children['index.html'];
    if (!index || !sh.can(n, 'x', 'apache')) return finish(forbiddenRoot({ code: 403, body: FORBIDDEN }));
    const ok = check(game, { target: n.context ?? '', tclass: 'dir', perm: 'search', detail: `name="${at.split('/').pop() || '/'}" dev="vda4" ino=${inode(at)}`, pid: worker, syscall: 262 }, quiet);
    if (!ok) {
      log('core', `(13)Permission denied: [client ${client}] AH00035: access to ${path} denied (filesystem path '${file}/index.html') because search permissions are missing on a component of the path`);
      return finish(forbiddenRoot({ code: 403, body: FORBIDDEN }));
    }
    n = index;
    file = `${file}/index.html`;
    at = file;
  }
  if (!n || n.type !== 'file') return finish({ code: 404, body: NOT_FOUND });
  const readable =
    sh.can(n, 'r', 'apache') &&
    check(game, { target: n.context ?? '', tclass: 'file', perm: 'read', detail: `name="${file.split('/').pop()}" dev="vda4" ino=${inode(file)}`, pid: worker, syscall: 257 }, quiet);
  if (!readable) {
    log('core', `(13)Permission denied: [client ${client}] AH00132: file permissions deny server access: ${file}`);
    return finish(forbiddenRoot({ code: 403, body: FORBIDDEN }));
  }
  const body = typeof n.content === 'string' ? n.content : n.content(game);
  return finish({ code: 200, body, type: file.endsWith('.css') ? 'text/css' : undefined });
}

/** A stable inode number for a path (audit records show one). */
function inode(path: string): number {
  let h = 1_048_576;
  for (const c of path) h = (h * 33 + c.charCodeAt(0)) % 3_000_000;
  return 1_000_000 + h;
}
