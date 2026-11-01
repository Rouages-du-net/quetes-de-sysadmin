// Simulated Apache httpd (Debian's apache2 package): the configuration read
// as Apache reads it (apache2.conf, its Include, the modules loaded by
// LoadModule, the <VirtualHost>, <Directory>, <IfModule>… sections), checked
// like `apache2ctl configtest`, then applied on start and on
// reload. A request picks its virtual host, then Apache finds the
// file, reading the .htaccess files (if AllowOverride allows it) and the
// mod_rewrite rules. nginx and curl talk to it as to an app
// (etat.applis, address 127.0.0.1:port).
// Based on the Apache 2.4 documentation:
// https://httpd.apache.org/docs/2.4/configuring.html (files, sections, modules),
// https://httpd.apache.org/docs/2.4/vhosts/details.html (choosing the virtual host:
// first the address and port, then the requested name, otherwise the first one),
// https://httpd.apache.org/docs/2.4/sections.html#merging (merge order),
// https://httpd.apache.org/docs/2.4/howto/htaccess.html and
// https://httpd.apache.org/docs/2.4/mod/core.html#allowoverride (.htaccess),
// https://httpd.apache.org/docs/2.4/mod/mod_rewrite.html and
// https://httpd.apache.org/docs/2.4/rewrite/tech.html (per-directory rules),
// https://httpd.apache.org/docs/2.4/bind.html (Listen); and the package's
// README.Debian (sites-available, a2ensite, envvars).
// Differences: only some of the directives (the others are refused
// like those of a missing module), no PHP nor CGI, no expiry
// headers nor compression; wildcards in <Directory> paths are
// not read.

import type { Game } from './shell';
import { wildcard } from './tools';
import { systemd } from './systemd';
import type { App, Request } from './nginx';
import type { Listening } from './commands/ss';

export const VERSION = '2.4.65';
export const SIGNATURE = `Apache/${VERSION} (Debian)`;
export const ROOT = '/etc/apache2';
export const CONF = `${ROOT}/apache2.conf`;
// The PID of the main process (root) and those of the serving processes (www-data).
export const PID = 2301;

// The variables of /etc/apache2/envvars, read by apache2ctl.
const ENV: Record<string, string> = {
  APACHE_RUN_USER: 'www-data',
  APACHE_RUN_GROUP: 'www-data',
  APACHE_PID_FILE: '/var/run/apache2/apache2.pid',
  APACHE_RUN_DIR: '/var/run/apache2',
  APACHE_LOCK_DIR: '/var/lock/apache2',
  APACHE_LOG_DIR: '/var/log/apache2',
};

// The modules compiled into Debian's binary (apache2ctl -M: "static").
export const STATIC = ['core', 'so', 'watchdog', 'http', 'log_config', 'logio', 'version', 'unixd'];

// Where a directive is allowed (S: server configuration, V: <VirtualHost>,
// D: <Directory>, <Location>, <Files>, H: .htaccess), the module that
// defines it, and, in a .htaccess, the AllowOverride category it requires.
interface Rule {
  module: string;
  or: string;
  override?: string;
  section?: boolean;
}
const R = (module: string, or: string, override?: string): Rule => ({ module, or, override });
const S = (module: string, or: string, override?: string): Rule => ({ module, or, override, section: true });
const ALL = 'SVDH';
const DIRECTIVES: Record<string, Rule> = {
  AccessFileName: R('core', 'SV'),
  AddDefaultCharset: R('core', ALL, 'FileInfo'),
  AllowOverride: R('core', 'D'),
  DefaultRuntimeDir: R('core', 'S'),
  Define: R('core', 'SVD'),
  DocumentRoot: R('core', 'SV'),
  ErrorDocument: R('core', ALL, 'FileInfo'),
  ErrorLog: R('core', 'SV'),
  FileETag: R('core', ALL, 'FileInfo'),
  HostnameLookups: R('core', 'SVD'),
  Include: R('core', 'SVD'),
  IncludeOptional: R('core', 'SVD'),
  KeepAlive: R('core', 'SV'),
  KeepAliveTimeout: R('core', 'SV'),
  LimitRequestBody: R('core', ALL, 'All'),
  Listen: R('core', 'S'),
  LogLevel: R('core', 'SVD'),
  MaxKeepAliveRequests: R('core', 'SV'),
  Mutex: R('core', 'S'),
  Options: R('core', ALL, 'Options'),
  PidFile: R('core', 'S'),
  Protocols: R('core', 'SV'),
  ServerAdmin: R('core', 'SV'),
  ServerAlias: R('core', 'V'),
  ServerName: R('core', 'SV'),
  ServerRoot: R('core', 'S'),
  ServerSignature: R('core', ALL, 'All'),
  ServerTokens: R('core', 'S'),
  Timeout: R('core', 'SV'),
  TraceEnable: R('core', 'SV'),
  UseCanonicalName: R('core', 'SVD'),
  LoadModule: R('so', 'S'),
  User: R('unixd', 'S'),
  Group: R('unixd', 'S'),
  CustomLog: R('log_config', 'SV'),
  LogFormat: R('log_config', 'SV'),
  StartServers: R('mpm_event', 'S'),
  MinSpareThreads: R('mpm_event', 'S'),
  MaxSpareThreads: R('mpm_event', 'S'),
  ThreadLimit: R('mpm_event', 'S'),
  ThreadsPerChild: R('mpm_event', 'S'),
  MaxRequestWorkers: R('mpm_event', 'S'),
  MaxConnectionsPerChild: R('mpm_event', 'S'),
  Require: R('authz_core', 'DH', 'AuthConfig'),
  AuthType: R('authn_core', 'DH', 'AuthConfig'),
  AuthName: R('authn_core', 'DH', 'AuthConfig'),
  AuthUserFile: R('authn_file', 'DH', 'AuthConfig'),
  AuthBasicProvider: R('auth_basic', 'DH', 'AuthConfig'),
  Order: R('access_compat', 'DH', 'Limit'),
  Allow: R('access_compat', 'DH', 'Limit'),
  Deny: R('access_compat', 'DH', 'Limit'),
  DirectoryIndex: R('dir', ALL, 'Indexes'),
  DirectorySlash: R('dir', ALL, 'Indexes'),
  TypesConfig: R('mime', 'S'),
  AddType: R('mime', ALL, 'FileInfo'),
  AddCharset: R('mime', ALL, 'FileInfo'),
  AddEncoding: R('mime', ALL, 'FileInfo'),
  AddHandler: R('mime', ALL, 'FileInfo'),
  AddLanguage: R('mime', ALL, 'FileInfo'),
  AddOutputFilter: R('mime', ALL, 'FileInfo'),
  SetEnvIf: R('setenvif', ALL, 'FileInfo'),
  SetEnvIfNoCase: R('setenvif', ALL, 'FileInfo'),
  BrowserMatch: R('setenvif', ALL, 'FileInfo'),
  BrowserMatchNoCase: R('setenvif', ALL, 'FileInfo'),
  SetEnv: R('env', ALL, 'FileInfo'),
  UnsetEnv: R('env', ALL, 'FileInfo'),
  PassEnv: R('env', ALL, 'FileInfo'),
  AddOutputFilterByType: R('filter', ALL, 'FileInfo'),
  RequestReadTimeout: R('reqtimeout', 'SV'),
  IndexOptions: R('autoindex', ALL, 'Indexes'),
  IndexIgnore: R('autoindex', ALL, 'Indexes'),
  RewriteEngine: R('rewrite', ALL, 'FileInfo'),
  RewriteRule: R('rewrite', ALL, 'FileInfo'),
  RewriteCond: R('rewrite', ALL, 'FileInfo'),
  RewriteOptions: R('rewrite', ALL, 'FileInfo'),
  RewriteBase: R('rewrite', 'DH', 'FileInfo'),
  Alias: R('alias', 'SV'),
  ScriptAlias: R('alias', 'SV'),
  Redirect: R('alias', ALL, 'FileInfo'),
  RedirectMatch: R('alias', ALL, 'FileInfo'),
  RedirectPermanent: R('alias', ALL, 'FileInfo'),
  Header: R('headers', ALL, 'FileInfo'),
  RequestHeader: R('headers', ALL, 'FileInfo'),
  ExpiresActive: R('expires', ALL, 'Indexes'),
  ExpiresByType: R('expires', ALL, 'Indexes'),
  ExpiresDefault: R('expires', ALL, 'Indexes'),
  ProxyPass: R('proxy', 'SVD'),
  ProxyPassReverse: R('proxy', 'SVD'),
  ProxyPreserveHost: R('proxy', 'SV'),
  ProxyRequests: R('proxy', 'SV'),
  SSLEngine: R('ssl', 'SV'),
  SSLCertificateFile: R('ssl', 'SV'),
  SSLCertificateKeyFile: R('ssl', 'SV'),
  SSLProtocol: R('ssl', 'SV'),
  SSLCipherSuite: R('ssl', 'SV'),
  SSLSessionCache: R('ssl', 'S'),
  SSLRandomSeed: R('ssl', 'S'),
  SSLPassPhraseDialog: R('ssl', 'S'),
  VirtualHost: S('core', 'S'),
  Directory: S('core', 'SV'),
  DirectoryMatch: S('core', 'SV'),
  Location: S('core', 'SV'),
  LocationMatch: S('core', 'SV'),
  Files: S('core', ALL, 'All'),
  FilesMatch: S('core', ALL, 'All'),
  IfModule: S('core', ALL),
  IfDefine: S('core', ALL),
  IfVersion: S('version', ALL),
  Limit: S('core', 'DH'),
  LimitExcept: S('core', 'DH'),
};
// Directive names are case-insensitive.
const BY_MINUSCULES = Object.fromEntries(Object.keys(DIRECTIVES).map((n) => [n.toLowerCase(), n]));

// The modules of mods-available (.load and .conf files) and their dependencies (a2enmod).
export const DEPENDENCIES: Record<string, string[]> = { ssl: ['setenvif', 'mime', 'socache_shmcb'], proxy_http: ['proxy'] };

export class ApacheError extends Error {}
const syntax = (file: string, line: number, message: string): never => {
  throw new ApacheError(`AH00526: Syntax error on line ${line} of ${file}:\n${message}`);
};
const invalidCommand = (name: string) => `Invalid command '${name}', perhaps misspelled or defined by a module not included in the server configuration`;

// ——— Lecture ———

// A directive read: its name (as written), its arguments, where it comes from;
// a section has its children.
export interface Line {
  name: string;
  args: string[];
  file: string;
  line: number;
  children?: Line[];
}

// The words of a line: separated by spaces, quotes group them.
function words(text: string): string[] {
  const listing: string[] = [];
  for (const m of text.matchAll(/"((?:[^"\\]|\\.)*)"|'([^']*)'|(\S+)/g)) listing.push(m[1] ?? m[2] ?? m[3]);
  return listing;
}

// The logical lines of a file: comments and empty lines removed, "\" at the end of a line continues it.
function linesFor(text: string): { text: string; line: number }[] {
  const result: { text: string; line: number }[] = [];
  const raw = text.split('\n');
  for (let i = 0; i < raw.length; i++) {
    const start = i + 1;
    let l = raw[i];
    while (l.endsWith('\\') && i + 1 < raw.length) l = l.slice(0, -1) + ' ' + raw[++i];
    const t = l.trim();
    if (t && !t.startsWith('#')) result.push({ text: t, line: start });
  }
  return result;
}

// A module name: "rewrite_module", "mod_rewrite.c" → "rewrite".
const module = (name: string) => name.replace(/^mod_/, '').replace(/\.c$/, '').replace(/_module$/, '');

// The reading state: loaded modules (in order), defined variables, warnings.
interface Read {
  modules: string[];
  defined: Set<string>;
  warnings: string[];
}

/**
 * Reads a configuration file (or a .htaccess, context "H") and its
 * Include; throws an ErreurApache in Apache's format.
 */
function readFile(game: Game, file: string, context: string, read: Read, text?: string): Line[] {
  const lines = linesFor(text ?? game.read(file) ?? '');
  let i = 0;
  // ${VAR} variables: those of envvars, then Define.
  const replace = (l: string) =>
    l.replace(/\$\{([A-Za-z0-9_]+)\}/g, (all, v: string) => {
      if (ENV[v] !== undefined) return ENV[v];
      if (read.defined.has(v)) return '';
      if (!read.warnings.includes(`AH00111: Config variable \${${v}} is not defined`))
        read.warnings.push(`AH00111: Config variable \${${v}} is not defined`);
      return all;
    });
  const block = (ctx: string, isOpen: { name: string; line: number } | null, enabled: boolean): Line[] => {
    const listing: Line[] = [];
    while (i < lines.length) {
      const { text: raw, line } = lines[i++];
      const l = replace(raw);
      const end = /^<\/([^\s>]+)\s*>$/.exec(l);
      if (end) {
        if (!isOpen) syntax(file, line, `</${end[1]}> without matching <${end[1]}> section`);
        if (end[1].toLowerCase() !== isOpen!.name.toLowerCase()) syntax(file, line, `Expected </${isOpen!.name}> but saw </${end[1]}>`);
        return listing;
      }
      const start = /^<([^\s>]+)(.*?)>?$/.exec(l);
      if (start && l.startsWith('<')) {
        const rawName = start[1];
        const args = words(start[2].replace(/>\s*$/, ''));
        const name = BY_MINUSCULES[rawName.toLowerCase()];
        if (!enabled) {
          block(ctx, { name: rawName, line }, false);
          continue;
        }
        const rule = name ? DIRECTIVES[name] : undefined;
        if (!rule || !rule.section || !isLoad(read, rule.module)) syntax(file, line, invalidCommand(`<${rawName}`));
        if (name === 'VirtualHost' && ctx === 'V') syntax(file, line, '<VirtualHost> cannot occur within <VirtualHost> section');
        if (!rule!.or.includes(ctx)) syntax(file, line, `<${name} not allowed here`);
        if (name === 'IfModule' || name === 'IfDefine' || name === 'IfVersion') {
          const condition = args[0] ?? '';
          const not = condition.startsWith('!');
          const what = condition.replace(/^!/, '');
          const yes = name === 'IfModule' ? isLoad(read, module(what)) : name === 'IfDefine' ? read.defined.has(what) : true;
          const inside = block(ctx, { name: rawName, line }, yes !== not);
          if (yes !== not) listing.push(...inside);
          continue;
        }
        const under = name === 'VirtualHost' ? 'V' : ctx === 'H' ? 'H' : 'D';
        const children = block(under, { name: rawName, line }, true);
        listing.push({ name: name!, args, file, line, children });
        continue;
      }
      if (!enabled) continue;
      const [rawName, ...args] = words(l);
      const name = BY_MINUSCULES[rawName.toLowerCase()];
      const rule = name ? DIRECTIVES[name] : undefined;
      if (!rule || rule.section || !isLoad(read, rule.module)) syntax(file, line, invalidCommand(rawName));
      if (!rule!.or.includes(ctx)) syntax(file, line, `${name} not allowed here`);
      checkArguments(name!, args, file, line);
      if (name === 'LoadModule') {
        const m = module(args[0]);
        if (read.modules.includes(m)) read.warnings.push(`AH01574: module ${args[0]} is already loaded, skipping`);
        else if (!game.find(args[1]?.startsWith('/') ? args[1] : `/usr/lib/apache2/${args[1] ?? ''}`))
          syntax(file, line, `Cannot load ${args[1]} into server: ${args[1]}: cannot open shared object file: No such file or directory`);
        else read.modules.push(m);
        continue;
      }
      if (name === 'Define') {
        if (args[0]) read.defined.add(args[0]);
        continue;
      }
      if (name === 'Include' || name === 'IncludeOptional') {
        for (const f of included(game, args[0] ?? '', name === 'IncludeOptional', file, line)) listing.push(...readFile(game, f, ctx, read));
        continue;
      }
      listing.push({ name: name!, args, file, line });
    }
    if (isOpen) {
      const last = lines.at(-1)?.line ?? isOpen.line;
      syntax(file, last, `${file}:${isOpen.line}: <${isOpen.name}> was not closed.`);
    }
    return listing;
  };
  return block(context, null, true);
}

const isLoad = (read: Read, m: string) => STATIC.includes(m) || read.modules.includes(m);

// A few argument checks, with Apache's messages.
function checkArguments(name: string, args: string[], file: string, line: number) {
  const one: Record<string, string> = {
    DocumentRoot: 'Root directory of the document tree',
    ServerName: 'The hostname and port of the server',
    ErrorLog: 'The filename of the error log',
  };
  if (one[name] && args.length !== 1) syntax(file, line, `${name} takes one argument, ${one[name]}`);
  if (['RewriteEngine', 'KeepAlive'].includes(name) && !/^(on|off)$/i.test(args[0] ?? '')) syntax(file, line, `${name} must be On or Off`);
  if (name === 'Listen' && (!args.length || args.length > 2)) syntax(file, line, 'Listen requires 1 or 2 arguments.');
  if (name === 'AllowOverride')
    for (const a of args)
      if (!/^(all|none|authconfig|fileinfo|indexes|limit|options(=.*)?|nonfatal=.*)$/i.test(a)) syntax(file, line, `Illegal override option ${a}`);
  if (name === 'Require' && !args.length) syntax(file, line, 'Require requires at least one argument');
  if (name === 'RewriteRule') {
    if (args.length < 2) syntax(file, line, 'RewriteRule: bad argument line');
    try {
      new RegExp(args[0].replace(/^!/, ''));
    } catch {
      syntax(file, line, `RewriteRule: cannot compile regular expression '${args[0]}'`);
    }
  }
}

// The files of an Include (relative to ServerRoot), sorted; a broken link doesn't open.
function included(game: Game, pattern: string, optional: boolean, file: string, line: number): string[] {
  const path = pattern.startsWith('/') ? pattern : `${ROOT}/${pattern}`;
  const open = (c: string) => {
    const n = game.find(c);
    if (!n) syntax(file, line, `Could not open configuration file ${c}: No such file or directory`);
    return c;
  };
  if (!/[*?[]/.test(path)) {
    if (!game.find(path) && optional) return [];
    return [open(path)];
  }
  const directory = path.slice(0, path.lastIndexOf('/')) || '/';
  const namePattern = path.slice(path.lastIndexOf('/') + 1);
  const n = game.find(directory);
  if (!n || n.type !== 'directory') {
    if (optional) return [];
    return syntax(file, line, `Could not open config directory ${directory}: No such file or directory`);
  }
  const re = wildcard(namePattern);
  const found = Object.keys(n.children)
    .filter((name) => re.test(name))
    .sort()
    .map((name) => `${directory}/${name}`);
  if (!found.length && !optional) syntax(file, line, `No matches for the wildcard '${namePattern}' in '${directory}', failing`);
  return found.map(open);
}

// ——— Loaded configuration ———

export interface Address {
  // "*" (all), or an address.
  ip: string;
  port: number | '*';
}

export interface Rewrite {
  // RewriteEngine On/Off; undefined: not set at this level (inherited).
  engine?: boolean;
  rules: Line[];
  base?: string;
  // The place (directory) of per-directory rules.
  directory?: string;
}

export interface Section {
  type: string;
  pattern: string;
  regex?: RegExp;
  lines: Line[];
}

export interface Host {
  addresses: Address[];
  name?: string;
  alias: string[];
  root?: string;
  log?: string;
  admin?: string;
  file: string;
  line: number;
  sections: Section[];
  rewrite: Rewrite;
  // Directives outside any section (DirectoryIndex, Options… at server or host level).
  lines: Line[];
}

export interface Configuration {
  modules: string[];
  listeners: { ip: string; port: number }[];
  principal: Host;
  hosts: Host[];
  // Global ServerName (otherwise: AH00558).
  globalName?: string;
  warnings: string[];
  accessFile: string;
}

const val = (lines: Line[], name: string) => lines.filter((l) => l.name === name).at(-1)?.args;
const sections = (lines: Line[]): Section[] =>
  lines
    .filter((l) => l.children && l.name !== 'VirtualHost')
    .map((l) => {
      const match = l.name.endsWith('Match') || l.args[0] === '~';
      const pattern = l.args[0] === '~' ? (l.args[1] ?? '') : (l.args[0] ?? '');
      let regex: RegExp | undefined;
      if (match)
        try {
          regex = new RegExp(pattern);
        } catch {
          syntax(l.file, l.line, `Regex could not be compiled`);
        }
      const type = l.name.replace(/Match$/, '');
      return { type, pattern: type === 'Directory' && !match ? pattern.replace(/\/+$/, '') || '/' : pattern, regex, lines: l.children! };
    });

// The rewrite rules of one level (server, host, section, .htaccess).
function rewriteFor(lines: Line[], directory?: string): Rewrite {
  const engine = val(lines, 'RewriteEngine');
  return {
    engine: engine ? /^on$/i.test(engine[0]) : undefined,
    rules: lines.filter((l) => l.name === 'RewriteRule' || l.name === 'RewriteCond'),
    base: val(lines, 'RewriteBase')?.[0],
    directory,
  };
}

// "*:80", "127.0.0.1:8080", "_default_:443", "[::1]:80" → address and port.
function readAddress(text: string): Address {
  const m = /^(\[[^\]]+\]|[^:]+)(?::(\d+|\*))?$/.exec(text);
  const ip = !m || m[1] === '_default_' ? '*' : m[1];
  const port = m?.[2] === undefined || m[2] === '*' ? '*' : Number(m[2]);
  return { ip, port };
}

function host(lines: Line[], file: string, line: number, addresses: Address[]): Host {
  return {
    addresses,
    name: val(lines, 'ServerName')?.[0]?.replace(/^https?:\/\//, '').replace(/:\d+$/, '').toLowerCase(),
    alias: lines.filter((l) => l.name === 'ServerAlias').flatMap((l) => l.args.map((a) => a.toLowerCase())),
    root: val(lines, 'DocumentRoot')?.[0]?.replace(/\/+$/, ''),
    log: val(lines, 'ErrorLog')?.[0],
    admin: val(lines, 'ServerAdmin')?.[0],
    file,
    line,
    sections: sections(lines),
    rewrite: rewriteFor(lines),
    lines: lines.filter((l) => !l.children),
  };
}

// Listen 80 → all addresses (IPv6 and IPv4), Listen 127.0.0.1:8080 → only one.
function listeners(lines: Line[]): { ip: string; port: number }[] {
  return lines
    .filter((l) => l.name === 'Listen')
    .map((l) => {
      const a = l.args[0];
      if (/^\d+$/.test(a)) return { ip: '*', port: Number(a) };
      const m = /^(\[[^\]]+\]|[^:]+):(\d+)$/.exec(a);
      if (!m) syntax(l.file, l.line, `Port must be specified`);
      return { ip: m![1], port: Number(m![2]) };
    });
}

/** Reads and checks the whole configuration; throws an ErreurApache. */
export function build(game: Game): Configuration {
  if (!game.find(CONF)) throw new ApacheError(`apache2: Could not open configuration file ${CONF}: No such file or directory`);
  const read: Read = { modules: [], defined: new Set(), warnings: [] };
  const lines = readFile(game, CONF, 'S', read);
  const principal = host(lines, CONF, 0, []);
  principal.root ??= '/var/www/html';
  principal.log ??= `${ENV.APACHE_LOG_DIR}/error.log`;
  principal.admin ??= '[no address given]';
  const hosts = lines
    .filter((l) => l.name === 'VirtualHost')
    .map((v) => {
      if (!v.args.length) syntax(v.file, v.line, '<VirtualHost> directive requires additional arguments');
      return host(v.children!, v.file, v.line, v.args.map(readAddress));
    });
  const warnings = [...read.warnings];
  for (const h of [principal, ...hosts])
    if (h.root && game.find(h.root)?.type !== 'directory') warnings.push(`AH00112: Warning: DocumentRoot [${h.root}] does not exist`);
  const listing = listeners(lines);
  if (!listing.length) throw new ApacheError('no listening sockets available, shutting down\nAH00015: Unable to open logs');
  return {
    modules: [...STATIC, ...read.modules],
    listeners: listing,
    principal,
    hosts,
    globalName: val(lines, 'ServerName')?.[0],
    warnings,
    accessFile: val(lines, 'AccessFileName')?.[0] ?? '.htaccess',
  };
}

/** The configuration, or the error: like apache2ctl configtest. */
export function test(game: Game): { config: Configuration; error: null } | { config: null; error: string } {
  try {
    return { config: build(game), error: null };
  } catch (e) {
    if (e instanceof ApacheError) return { config: null, error: e.message };
    throw e;
  }
}

// Without a global ServerName, Apache says so each time it reads the configuration.
export const AH00558 =
  "AH00558: apache2: Could not reliably determine the server's fully qualified domain name, using 127.0.1.1. Set the 'ServerName' directive globally to suppress this message";

// ——— Start: the listening addresses ———

const loop = (ip: string) => ip === '127.0.0.1' || ip === '[::1]' || ip === 'localhost';

// The sockets Apache opens for Listen (as ss shows them).
function sockets(config: Configuration): Listening[] {
  return config.listeners.map((e) => ({ proto: 'tcp' as const, address: e.ip, port: e.port, process: 'apache2', pid: PID }));
}

// An address already taken by another program (etat.ecoute): Apache's error.
function listenSockets(game: Game, config: Configuration): string[] {
  const other = ((game.state.listening ?? []) as Listening[]).filter((e) => e.process !== 'apache2' && e.proto === 'tcp');
  const overlaps = (ip: string, port: number, e: Listening) =>
    e.port === port &&
    (ip === '*' || e.address === ip || e.address === '0.0.0.0' || e.address === '*' || (e.address === '[::]' && ip.startsWith('[')));
  const messages: string[] = [];
  for (const { ip, port } of config.listeners) {
    if (!other.some((e) => overlaps(ip, port, e))) continue;
    // Listen 80 : Apache essaie [::]:80 puis 0.0.0.0:80.
    const attempts = ip === '*' ? [`[::]:${port}`, `0.0.0.0:${port}`] : [`${ip}:${port}`];
    for (const a of attempts) messages.push(`(98)Address already in use: AH00072: make_sock: could not bind to address ${a}`);
  }
  return messages;
}

/** For systemd: apachectl's messages when Apache doesn't start (null if it starts). */
export function checkApache(game: Game): string[] | null {
  const res = test(game);
  if (!res.config) return [...res.error.split('\n'), "Action 'start' failed.", 'The Apache error log may have more information.'];
  const before = [...res.config.warnings, ...(res.config.globalName ? [] : [AH00558])];
  const busy = listenSockets(game, res.config);
  if (!busy.length) return null;
  return [...before, ...busy, 'no listening sockets available, shutting down', 'AH00015: Unable to open logs', "Action 'start' failed.", 'The Apache error log may have more information.'];
}

// [Fri Nov 20 10:02:03.123456 2026]: the time in Apache's logs.
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const apacheTime = (ms: number) => {
  const d = new Date(ms);
  return `${DAYS[d.getUTCDay()]} ${MONTH[d.getUTCMonth()]} ${String(d.getUTCDate()).padStart(2, '0')} ${d.toISOString().slice(11, 19)}.${String(100000 + (ms % 900000)).slice(0, 6)} ${d.getUTCFullYear()}`;
};

// A line in one of Apache's error logs (the file must exist).
function writeLog(game: Game, file: string, level: string, message: string, client?: string) {
  const n = game.find(file);
  if (n?.type !== 'file' || typeof n.content !== 'string') return;
  const tid = level.startsWith('mpm') || level.startsWith('core:notice') ? PID : 140237;
  const line = `[${apacheTime(systemd(game)?.clock ?? 0)}] [${level}] [pid ${client ? PID + 1 : PID}:tid ${client ? 140237 : tid}] ${client ? `[client ${client}] ` : ''}${message}`;
  n.content = n.content ? `${n.content}\n${line}` : line;
}

/** On start and reload: the configuration read becomes the one in use, on its addresses. */
export function loadApache(game: Game) {
  const config = test(game).config;
  const old = game.state.apache?.load as Configuration | null | undefined;
  game.state.apache = { ...(game.state.apache ?? {}), load: config };
  if (!config) return;
  // ss: Apache's sockets replace the old ones.
  game.state.listening = [...((game.state.listening ?? []) as Listening[]).filter((e) => e.process !== 'apache2'), ...sockets(config)];
  // nginx and curl reach Apache on 127.0.0.1: one "app" per listening port.
  const apps: Record<string, App> = (game.state.apps ??= {});
  for (const [key, a] of Object.entries(apps)) if (a.service === 'apache2') delete apps[key];
  for (const { ip, port } of config.listeners)
    if (ip === '*' || ip === '0.0.0.0' || ip === '127.0.0.1')
      apps[`127.0.0.1:${port}`] = { service: 'apache2', pages: {}, answer: (j, path, request) => answer(j, port, path, request) };
  const log = config.principal.log!;
  if (old) writeLog(game, log, 'mpm_event:notice', 'AH00493: SIGUSR1 received.  Doing graceful restart');
  writeLog(game, log, 'mpm_event:notice', `AH00489: ${SIGNATURE} configured -- resuming normal operations`);
  writeLog(game, log, 'core:notice', "AH00094: Command line: '/usr/sbin/apache2'");
}

/** On stop: no more sockets, no more configuration in use. */
export function stopApache(game: Game) {
  game.state.listening = ((game.state.listening ?? []) as Listening[]).filter((e) => e.process !== 'apache2');
  const log = (game.state.apache?.load as Configuration | null)?.principal.log;
  if (log) writeLog(game, log, 'mpm_event:notice', 'AH00491: caught SIGTERM, shutting down');
  game.state.apache = { ...(game.state.apache ?? {}), load: null };
}

// ——— Requests ———

const REASONS: Record<number, string> = {
  200: 'OK',
  301: 'Moved Permanently',
  302: 'Found',
  403: 'Forbidden',
  404: 'Not Found',
  410: 'Gone',
  500: 'Internal Server Error',
};
const TEXTS: Record<number, (link: string, admin: string) => string> = {
  301: (link) => `<p>The document has moved <a href="${link}">here</a>.</p>`,
  302: (link) => `<p>The document has moved <a href="${link}">here</a>.</p>`,
  403: () => "<p>You don't have permission to access this resource.</p>",
  404: () => '<p>The requested URL was not found on this server.</p>',
  410: () =>
    '<p>The requested resource is no longer available on this server and there is no forwarding address.\nPlease remove all references to this resource.</p>',
  500: (_, admin) =>
    `<p>The server encountered an internal error or\nmisconfiguration and was unable to complete\nyour request.</p>\n<p>Please contact the server administrator at \n ${admin} to inform them of the time this error occurred,\n and the actions you performed just before this error.</p>\n<p>More information about this error may be available\nin the server error log.</p>`,
};

export interface ApacheResponse {
  code: number;
  body: string;
  type?: string;
  headers?: string[];
}

// What the request found: the virtual host that serves it, and the address it gives in its pages.
interface Context {
  config: Configuration;
  host: Host;
  name: string;
  port: number;
  client: string;
  trace: boolean;
}

const errorPage = (c: Context, code: number, link = ''): ApacheResponse => ({
  code,
  type: 'text/html; charset=iso-8859-1',
  body: `<!DOCTYPE HTML PUBLIC "-//IETF//DTD HTML 2.0//EN">\n<html><head>\n<title>${code} ${REASONS[code]}</title>\n</head><body>\n<h1>${REASONS[code]}</h1>\n${TEXTS[code](link, c.host.admin ?? c.config.principal.admin!)}\n<hr>\n<address>${SIGNATURE} Server at ${c.name} Harbour ${c.port}</address>\n</body></html>`,
  headers: [`Server: ${SIGNATURE}`, ...(link ? [`Location: ${link}`] : [])],
});

const correspond = (a: Address, ip: string, port: number) => (a.port === '*' || a.port === port) && (a.ip === '*' || a.ip === ip);

/** The virtual host that serves a connection (address, port) for this name: first the address, then the name, otherwise the first one. */
export function chooseHost(config: Configuration, ip: string, port: number, name: string): Host {
  const exacts = config.hosts.filter((h) => h.addresses.some((a) => a.ip !== '*' && correspond(a, ip, port)));
  const candidates = exacts.length ? exacts : config.hosts.filter((h) => h.addresses.some((a) => a.ip === '*' && correspond(a, ip, port)));
  if (!candidates.length) return config.principal;
  const n = name.toLowerCase();
  return candidates.find((h) => h.name === n || h.alias.some((a) => wildcard(a).test(n))) ?? candidates[0];
}

// The merged settings for a file: <Directory> sections, .htaccess, <Files>, <Location>.
interface Settings {
  overrides: Set<string>;
  refuse?: boolean;
  index: string[];
  lists: boolean;
  rewrite: Rewrite;
}

// AllowOverride All, None, or a list of categories.
function readOverrides(args: string[]): Set<string> {
  if (args.some((a) => /^all$/i.test(a))) return new Set(['AuthConfig', 'FileInfo', 'Indexes', 'Limit', 'Options']);
  if (args.some((a) => /^none$/i.test(a))) return new Set();
  return new Set(args.map((a) => a.replace(/=.*$/, '')).map((a) => ['AuthConfig', 'FileInfo', 'Indexes', 'Limit', 'Options'].find((c) => c.toLowerCase() === a.toLowerCase()) ?? a));
}

function apply(r: Settings, lines: Line[], directory?: string) {
  for (const l of lines) {
    if (l.name === 'AllowOverride') r.overrides = readOverrides(l.args);
    else if (l.name === 'Require') {
      const a = l.args.join(' ').toLowerCase();
      if (a === 'all denied') r.refuse = true;
      else if (a === 'all granted') r.refuse = false;
    } else if (l.name === 'DirectoryIndex') r.index = l.args.filter((a) => a.toLowerCase() !== 'disabled');
    else if (l.name === 'Options') {
      for (const o of l.args) {
        if (/^[+]?indexes$/i.test(o) || /^all$/i.test(o)) r.lists = true;
        else if (/^-indexes$/i.test(o) || /^none$/i.test(o)) r.lists = false;
      }
      // Options without + or - replaces the whole list.
      if (l.args.every((o) => !/^[+-]/.test(o)) && !l.args.some((o) => /^(indexes|all)$/i.test(o))) r.lists = false;
    }
  }
  // mod_rewrite, per directory: the state (On/Off) is inherited, the rules are not
  // (those of the deepest level replace those above).
  if (directory !== undefined) {
    const n = rewriteFor(lines, directory);
    r.rewrite = { engine: n.engine ?? r.rewrite.engine, rules: n.rules, base: n.base, directory };
  }
}

// Read a .htaccess like Apache: each directive must be known, and allowed by AllowOverride.
function readHtaccess(game: Game, path: string, overrides: Set<string>, modules: string[]): Line[] {
  const read: Read = { modules: modules.filter((m) => !STATIC.includes(m)), defined: new Set(), warnings: [] };
  const lines = readFile(game, path, 'H', read, game.read(path) ?? '');
  const check = (listing: Line[]) => {
    for (const l of listing) {
      const cat = DIRECTIVES[l.name]?.override;
      if (cat && cat !== 'All' && !overrides.has(cat)) throw new ApacheError(`${path}: ${l.name} not allowed here`);
      if (l.children) check(l.children);
    }
  };
  check(lines);
  return lines;
}

const dirname = (path: string) => path.slice(0, path.lastIndexOf('/')) || '/';

/** The settings that apply to a file (null: an unreadable .htaccess, the error in the log). */
function settingsFor(game: Game, c: Context, file: string, url: string): Settings | { error: string } {
  // By default (Apache 2.4): AllowOverride None; then the server, then the virtual host.
  const r: Settings = { overrides: new Set(), index: ['index.html'], lists: true, rewrite: { rules: [] } };
  apply(r, c.config.principal.lines);
  if (c.host !== c.config.principal) apply(r, c.host.lines);
  const all = [...c.config.principal.sections, ...c.host.sections];
  // The directories of the path, from / to the deepest one that exists.
  const parts = file.split('/').filter(Boolean);
  const directories = ['/'];
  for (let i = 1; i <= parts.length; i++) {
    const d = '/' + parts.slice(0, i).join('/');
    if (game.find(d)?.type !== 'directory') break;
    directories.push(d);
  }
  for (const d of directories) {
    for (const s of all.filter((s) => s.type === 'Directory' && !s.regex && s.pattern === d)) apply(r, s.lines, d);
    if (!r.overrides.size) continue;
    const ht = `${d === '/' ? '' : d}/${c.config.accessFile}`;
    if (game.find(ht)?.type !== 'file') continue;
    try {
      apply(r, readHtaccess(game, ht, r.overrides, c.config.modules), d);
    } catch (e) {
      if (e instanceof ApacheError) return { error: e.message.replace(/^AH00526: Syntax error on line \d+ of ([^:]+):\n/, '$1: ') };
      throw e;
    }
  }
  const directory = directories.at(-1)!;
  for (const s of all.filter((s) => s.type === 'Directory' && s.regex?.test(directory))) apply(r, s.lines, directory);
  const base = file.slice(file.lastIndexOf('/') + 1);
  for (const s of all.filter((s) => s.type === 'Files' && (s.regex ? s.regex.test(base) : wildcard(s.pattern).test(base)))) apply(r, s.lines);
  for (const s of all.filter((s) => s.type === 'Location' && (s.regex ? s.regex.test(url) : url.startsWith(s.pattern)))) apply(r, s.lines);
  return r;
}

// A mod_rewrite rule: [pattern, target, flags] and its conditions.
interface Result {
  path?: string;
  httpRequest?: string;
  code?: number;
  link?: string;
  end?: boolean;
}

function flags(text: string | undefined): Record<string, string> {
  const d: Record<string, string> = {};
  for (const f of (text ?? '').replace(/^\[|\]$/g, '').split(',').filter(Boolean)) {
    const [n, v = ''] = f.split('=');
    d[n.trim().toUpperCase()] = v;
  }
  return d;
}

/** Applies the rules (server context: on the URL; per directory: on the path without the directory's prefix). */
function rewrite(
  game: Game,
  rules: Line[],
  subject: string,
  variables: Record<string, string>,
  toUrl: (target: string) => string,
): Result | null {
  let conditions: { test: string; pattern: string; flags: Record<string, string> }[] = [];
  let current = subject;
  let change: Result | null = null;
  for (const l of rules) {
    if (l.name === 'RewriteCond') {
      conditions.push({ test: l.args[0] ?? '', pattern: l.args[1] ?? '', flags: flags(l.args[2]) });
      continue;
    }
    const [pattern, target, d] = [l.args[0], l.args[1], flags(l.args[2])];
    const conds = conditions;
    conditions = [];
    const not = pattern.startsWith('!');
    let m: RegExpExecArray | null;
    try {
      m = new RegExp(pattern.replace(/^!/, ''), 'NC' in d ? 'i' : '').exec(current);
    } catch {
      continue;
    }
    if (not ? m : !m) continue;
    // The conditions (all of them, or one with [OR]); %1 refers to the last one that matched.
    let last: RegExpExecArray | null = null;
    let ok = true;
    for (let i = 0; i < conds.length; i++) {
      const c = conds[i];
      const value = c.test.replace(/%\{([A-Z_:]+)\}/g, (_, v: string) => variables[v] ?? '');
      const negation = c.pattern.startsWith('!');
      const p = c.pattern.replace(/^!/, '');
      let yes: boolean;
      if (p === '-f') yes = game.find(value)?.type === 'file';
      else if (p === '-d') yes = game.find(value)?.type === 'directory';
      else if (p === '-s') yes = (game.read(value) ?? '').length > 0;
      else if (p.startsWith('=')) yes = value === p.slice(1);
      else {
        const r = new RegExp(p, 'NC' in c.flags ? 'i' : '').exec(value);
        yes = !!r;
        if (r && !negation) last = r;
      }
      if (negation) yes = !yes;
      if ('OR' in c.flags) {
        if (yes) {
          // Conditions joined by [OR]: one is enough, the following ones of the group are skipped.
          while (i < conds.length - 1 && 'OR' in conds[i].flags) i++;
          continue;
        }
        if (i < conds.length - 1) continue;
      }
      if (!yes) {
        ok = false;
        break;
      }
    }
    if (!ok) continue;
    if ('F' in d) return { code: 403 };
    if ('G' in d) return { code: 410 };
    if (target !== '-') {
      const filled = target.replace(/\$(\d)/g, (_, n: string) => m?.[Number(n)] ?? '').replace(/%(\d)/g, (_, n: string) => last?.[Number(n)] ?? '');
      const [path, httpRequest] = filled.split('?');
      if ('R' in d) {
        const absolute = /^https?:\/\//.test(path) ? path : null;
        return { code: Number(d.R) || 302, link: absolute ?? toUrl(path) + (httpRequest !== undefined ? `?${httpRequest}` : ''), end: true };
      }
      current = path;
      change = { path, httpRequest: httpRequest !== undefined ? httpRequest + ('QSA' in d && variables.QUERY_STRING ? `&${variables.QUERY_STRING}` : '') : undefined, end: 'END' in d };
    }
    if ('L' in d || 'END' in d) break;
  }
  return change;
}

const listPage = (url: string, names: string[]) =>
  `<!DOCTYPE HTML PUBLIC "-//W3C//DTD HTML 3.2 Final//EN">\n<html>\n <head>\n  <title>Index of ${url}</title>\n </head>\n <body>\n<h1>Index of ${url}</h1>\n<ul>${names.map((n) => `<li><a href="${n}"> ${n}</a></li>`).join('\n')}</ul>\n</body></html>`;

/**
 * A request to Apache, on 127.0.0.1:port: null if Apache isn't listening
 * there. `demande` carries the headers received (Host picks the virtual host).
 */
export function answer(game: Game, port: number, path: string, request: Request = { headers: {}, address: '127.0.0.1' }): ApacheResponse {
  const config: Configuration = game.state.apache.load;
  const requestHost = request.headers.host ?? `127.0.0.1:${port}`;
  const name = requestHost.replace(/:\d+$/, '');
  const seenPort = Number(/:(\d+)$/.exec(requestHost)?.[1] ?? port);
  const h = chooseHost(config, '127.0.0.1', port, name);
  const c: Context = { config, host: h, name, port: seenPort, client: `${request.address}:${41200 + (port % 100)}`, trace: request.trace !== false };
  const log = h.log ?? config.principal.log!;
  const alert = (level: string, message: string) => c.trace && writeLog(game, log, level, message, c.client);
  const root = (h.root ?? config.principal.root!).replace(/\/+$/, '');
  let [url, httpRequest] = path.split('?');
  url = url || '/';
  const variables = (file: string) => ({
    REQUEST_URI: url,
    REQUEST_FILENAME: file,
    HTTP_HOST: requestHost,
    QUERY_STRING: httpRequest ?? '',
    HTTPS: 'off',
    DOCUMENT_ROOT: root,
    SERVER_NAME: h.name ?? name,
  });
  const link = (target: string) => `http://${requestHost}${target.startsWith('/') ? target : `/${target}`}`;
  // The server context (RewriteEngine in the VirtualHost): only once, on the URL.
  if (h.rewrite.engine && h.rewrite.rules.length) {
    const r = rewrite(game, h.rewrite.rules, url, variables(root + url), link);
    if (r?.code) return errorPage(c, r.code, r.link);
    if (r?.path) {
      url = r.path.startsWith('/') ? r.path : `/${r.path}`;
      if (r.httpRequest !== undefined) httpRequest = r.httpRequest;
    }
  }
  // An internal redirect (per-directory rule) restarts processing; at most 10 times.
  let finished = false;
  for (let turn = 0; turn <= 10; turn++) {
    const file = root + url;
    const r = settingsFor(game, c, file.replace(/\/+$/, '') || '/', url);
    if ('error' in r) {
      alert('core:alert', r.error);
      return errorPage(c, 500);
    }
    const rr = r.rewrite;
    if (!finished && rr.engine && rr.rules.length && rr.directory) {
      // The path, without the rules' directory (nor a leading slash).
      const prefix = rr.directory === '/' ? '/' : `${rr.directory}/`;
      const subject = file.startsWith(prefix) ? file.slice(prefix.length) : file === rr.directory ? '' : null;
      if (subject !== null) {
        const directoryUrl = rr.base ?? (rr.directory.startsWith(root) ? rr.directory.slice(root.length) || '/' : '/');
        const toUrl = (target: string) => (target.startsWith('/') ? target : `${directoryUrl.replace(/\/?$/, '/')}${target}`);
        const res = rewrite(game, rr.rules, subject, variables(file), (target) => link(toUrl(target)));
        if (res?.code) return errorPage(c, res.code, res.link);
        if (res?.path) {
          const following = toUrl(res.path);
          if (res.httpRequest !== undefined) httpRequest = res.httpRequest;
          finished = !!res.end;
          if (following !== url) {
            if (turn === 10) {
              alert(
                'core:error',
                "AH00124: Request exceeded the limit of 10 internal redirects due to probable configuration error. Use 'LimitInternalRecursion' to increase the limit if necessary. Use 'LogLevel debug' to get a backtrace.",
              );
              return errorPage(c, 500);
            }
            url = following;
            continue;
          }
        }
      }
    }
    if (r.refuse) {
      alert('authz_core:error', `AH01630: client denied by server configuration: ${file}`);
      return errorPage(c, 403);
    }
    const n = game.find(file);
    if (!n) return errorPage(c, 404);
    if (n.type === 'directory') {
      // mod_dir: a directory without a trailing slash is redirected to the address with the slash.
      if (!url.endsWith('/')) return errorPage(c, 301, link(`${url}/`));
      const index = r.index.find((i) => game.find(`${file}${i}`)?.type === 'file');
      if (index) {
        url += index;
        continue;
      }
      if (r.lists && config.modules.includes('autoindex'))
        return { code: 200, body: listPage(url, Object.keys(n.children).sort()), type: 'text/html;charset=UTF-8', headers: [`Server: ${SIGNATURE}`] };
      alert(
        'autoindex:error',
        `AH01276: Cannot serve directory ${file}: No matching DirectoryIndex (${r.index.join(',')}) found, and server-generated directory index forbidden by Options directive`,
      );
      return errorPage(c, 403);
    }
    if (!game.can(n, 'r', 'www-data')) {
      alert('core:error', `(13)Permission denied: AH00132: file permissions deny server access: ${file}`);
      return errorPage(c, 403);
    }
    const body = typeof n.content === 'function' ? n.content(game) : n.content;
    return { code: 200, body, type: 'text/html', headers: [`Server: ${SIGNATURE}`] };
  }
  return errorPage(c, 500);
}

/** For the game's checks: what Apache answers (without writing anything to the log), null if it isn't listening on this port. */
export function ask(game: Game, port: number, path: string, host: string): ApacheResponse | null {
  const app: App | undefined = game.state.apps?.[`127.0.0.1:${port}`];
  if (!app || app.service !== 'apache2' || systemd(game)?.services.apache2?.state !== 'active' || !game.state.apache?.load) return null;
  return answer(game, port, path, { headers: { host: host }, address: '127.0.0.1', trace: false });
}

/** The addresses Apache listens on (to check that it stays on the loopback). */
export const apacheListeners = (game: Game): { ip: string; port: number }[] =>
  systemd(game)?.services.apache2?.state === 'active' ? ((game.state.apache?.load as Configuration | null)?.listeners ?? []) : [];
export const onlyLocal = (game: Game) => apacheListeners(game).length > 0 && apacheListeners(game).every((e) => loop(e.ip));

// ——— apache2ctl -S and -M ———

const shows = (a: Address) => `${a.ip}:${a.port}`;

/** apache2ctl -S: the virtual hosts, by address, then the rest of the configuration. */
export function vhosts(config: Configuration): string {
  const nameFor = (h: Host) => h.name ?? config.globalName ?? '127.0.1.1';
  const byAddress = new Map<string, Host[]>();
  for (const h of config.hosts)
    for (const a of h.addresses) {
      const k = shows(a);
      byAddress.set(k, [...(byAddress.get(k) ?? []), h]);
    }
  const lines = ['VirtualHost configuration:'];
  for (const [address, listing] of byAddress) {
    const port = address.split(':').at(-1);
    const or = (h: Host) => `(${h.file}:${h.line})`;
    if (listing.length === 1) {
      lines.push(`${address.padEnd(22)} ${nameFor(listing[0])} ${or(listing[0])}`);
      continue;
    }
    lines.push(`${address.padEnd(22)} is a NameVirtualHost`, `         default server ${nameFor(listing[0])} ${or(listing[0])}`);
    for (const h of listing) {
      lines.push(`         port ${port} namevhost ${nameFor(h)} ${or(h)}`);
      for (const a of h.alias) lines.push(`                 alias ${a}`);
    }
  }
  lines.push(
    `ServerRoot: "${ROOT}"`,
    `Main DocumentRoot: "${config.principal.root}"`,
    `Main ErrorLog: "${config.principal.log}"`,
    'Mutex watchdog-callback: using_defaults',
    'Mutex default: dir="/var/run/apache2/" mechanism=default ',
    `PidFile: "${ENV.APACHE_PID_FILE}"`,
    'Define: DUMP_VHOSTS',
    'Define: DUMP_RUN_CFG',
    'User: name="www-data" id=33',
    'Group: name="www-data" id=33',
  );
  return lines.join('\n');
}

/** apache2ctl -M: the loaded modules, in order. */
export const modulesCharges = (config: Configuration) =>
  ['Loaded Modules:', ...config.modules.map((m) => ` ${m}_module (${STATIC.includes(m) ? 'static' : 'shared'})`)].join('\n');
