// A machine's HAProxy (state.haproxy): /etc/haproxy/haproxy.cfg read and
// checked like haproxy -c (sections global, defaults, frontend, backend,
// listen; bind, default_backend, balance roundrobin|leastconn|first|source,
// server lines with check, inter, fall, rise, backup, weight, maxconn,
// disabled; default-server; option httpchk [METHOD] URI, http-check send,
// http-check expect status|rstatus; the stats socket), applied when the
// service starts or reloads. Health checks run every `inter` against the
// backends the story declares (state.haBackends on the main machine: what
// answers at an address and port); a server is DOWN after `fall` failed
// checks and UP again after `rise` good ones (it starts UP: one failure
// marks it DOWN). The runtime API on the stats socket (socat): show stat,
// show servers state, show info, show backend, disable/enable server, set
// server … state ready|drain|maint, set/get weight. Requests are balanced
// over the usable servers (UP and ready; the backups when none is), logged
// in the HTTP log format to /var/log/haproxy.log (Debian's rsyslog rule for
// haproxy's /dev/log socket).
// Sources: https://docs.haproxy.org/3.0/configuration.html (server options,
// option httpchk, http-check expect, balance, log format 8.2.3),
// https://docs.haproxy.org/3.0/management.html (9.3 the runtime API, show
// stat's fields, show servers state), Debian's haproxy package.
// Differences: show stat prints its first 51 fields; one request per
// client at a time; no ACLs, no stick tables, no SSL, no persistence; a
// reload starts the servers afresh (as without server-state-file).

import type { Game, Shell } from './shell';
import { systemd } from './systemd';

export const CFG = '/etc/haproxy/haproxy.cfg';
export const LOG = '/var/log/haproxy.log';
export const HAPROXY_VERSION = '3.0.11-1';

export interface ServerConf {
  name: string;
  addr: string;
  port: number;
  check: boolean;
  inter: number;
  fall: number;
  rise: number;
  backup: boolean;
  weight: number;
  maxconn: number;
  disabled: boolean;
  line: number;
}

export interface BackendConf {
  name: string;
  balance: string;
  httpchk: { method: string; uri: string } | null;
  expect: { kind: 'status' | 'rstatus'; value: string } | null;
  // 'http-check' rules written without option httpchk.
  orphanCheck: boolean;
  servers: ServerConf[];
  line: number;
  allbackups: boolean;
}

export interface FrontendConf {
  name: string;
  binds: { addr: string; port: number }[];
  defaultBackend: string | null;
  line: number;
}

export interface HaproxyConf {
  frontends: FrontendConf[];
  backends: BackendConf[];
  socket: string | null;
  httplog: boolean;
  alerts: string[];
  warnings: string[];
}

const SECTIONS = ['global', 'defaults', 'frontend', 'backend', 'listen', 'peers', 'resolvers', 'userlist', 'program', 'http-errors', 'mailers', 'cache', 'ring'];
const GLOBAL = ['log', 'chroot', 'stats', 'user', 'group', 'daemon', 'maxconn', 'nbthread', 'ca-base', 'crt-base', 'ssl-default-bind-ciphers', 'ssl-default-bind-ciphersuites', 'ssl-default-bind-options', 'pidfile', 'tune.ssl.default-dh-param', 'master-worker', 'hard-stop-after'];
const PROXY = ['log', 'mode', 'option', 'timeout', 'errorfile', 'retries', 'maxconn', 'bind', 'default_backend', 'use_backend', 'balance', 'server', 'default-server', 'http-check', 'http-request', 'http-response', 'stats', 'acl', 'cookie', 'description', 'compression', 'monitor-uri', 'capture', 'fullconn', 'hash-type', 'http-reuse'];
const SERVER_WORDS = ['check', 'inter', 'fall', 'rise', 'backup', 'weight', 'maxconn', 'disabled', 'enabled', 'port', 'fastinter', 'downinter', 'slowstart', 'cookie', 'on-marked-down', 'observe', 'error-limit', 'ssl', 'verify', 'send-proxy', 'agent-check', 'resolvers', 'init-addr'];
const VALUE_WORDS = ['inter', 'fall', 'rise', 'weight', 'maxconn', 'port', 'fastinter', 'downinter', 'slowstart', 'cookie', 'on-marked-down', 'observe', 'error-limit', 'verify', 'resolvers', 'init-addr'];

/** Distance between two words (for "did you mean"). */
function distance(a: string, b: string): number {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[a.length][b.length];
}
const nearest = (w: string, list: string[]) => list.filter((x) => distance(w, x) <= 2).sort((a, b) => distance(w, a) - distance(w, b))[0];

/** A time like HAProxy reads it: 2000, 2s, 500ms, 1m. */
function readTime(v: string): number | null {
  const m = /^(\d+)(us|ms|s|m|h|d)?$/.exec(v);
  if (!m) return null;
  const k: Record<string, number> = { us: 0.001, ms: 1, s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 };
  return Number(m[1]) * k[m[2] ?? 'ms'];
}

/** haproxy.cfg read like HAProxy 3.0 (alerts stop it, warnings don't). */
export function parseCfg(text: string, file = CFG): HaproxyConf {
  const c: HaproxyConf = { frontends: [], backends: [], socket: null, httplog: false, alerts: [], warnings: [] };
  const at = (n: number) => `parsing [${file}:${n}]`;
  let section = '';
  let front: FrontendConf | null = null;
  let back: BackendConf | null = null;
  let defaults = { inter: 2000, fall: 3, rise: 2 };
  let local = { ...defaults };
  for (const [k, raw] of text.split('\n').entries()) {
    const n = k + 1;
    const w = raw.replace(/(^|\s)#.*$/, '').trim().split(/\s+/).filter(Boolean);
    if (!w.length) continue;
    const [word, ...v] = w;
    if (SECTIONS.includes(word)) {
      section = word;
      front = null;
      back = null;
      if (word === 'defaults') local = defaults;
      if (['frontend', 'backend', 'listen'].includes(word)) {
        if (!v[0]) {
          c.alerts.push(`${at(n)} : '${word}' expects <name> as an argument.`);
          continue;
        }
        if (word !== 'backend') c.frontends.push((front = { name: v[0], binds: [], defaultBackend: null, line: n }));
        if (word !== 'frontend') c.backends.push((back = { name: v[0], balance: 'roundrobin', httpchk: null, expect: null, orphanCheck: false, servers: [], line: n, allbackups: false }));
        local = { ...defaults };
      }
      continue;
    }
    if (!section) {
      c.alerts.push(`${at(n)} : unknown keyword '${word}' out of section.`);
      continue;
    }
    if (section === 'global') {
      if (!GLOBAL.includes(word)) {
        const near = nearest(word, GLOBAL);
        c.alerts.push(`${at(n)} : unknown keyword '${word}' in 'global' section${near ? `; did you mean '${near}' maybe ?` : ''}`);
      }
      if (word === 'stats' && v[0] === 'socket') c.socket = v[1] ?? null;
      continue;
    }
    if (!['defaults', 'frontend', 'backend', 'listen'].includes(section)) continue;
    if (!PROXY.includes(word)) {
      const near = nearest(word, PROXY);
      c.alerts.push(`${at(n)} : unknown keyword '${word}' in '${section}' section${near ? `; did you mean '${near}' maybe ?` : ''}`);
      continue;
    }
    if (word === 'option' && v[0] === 'httplog') c.httplog = true;
    if (word === 'bind' && front) {
      const m = /^(.*):(\d+)$/.exec(v[0] ?? '');
      if (!m) c.alerts.push(`${at(n)} : 'bind' : missing port number: '${v[0] ?? ''}'`);
      else front.binds.push({ addr: m[1] === '' || m[1] === '*' ? '*' : m[1], port: Number(m[2]) });
    }
    if (word === 'default_backend' && front) front.defaultBackend = v[0] ?? null;
    if (word === 'balance' && back) {
      if (!['roundrobin', 'leastconn', 'first', 'source', 'static-rr', 'uri', 'random'].includes(v[0] ?? '')) c.alerts.push(`${at(n)} : 'balance' only supports 'roundrobin', 'static-rr', 'leastconn', 'source', 'uri', 'url_param', 'hdr(name)', 'rdp-cookie(name)', 'random' and 'first' options.`);
      else back.balance = v[0];
    }
    if (word === 'option' && v[0] === 'httpchk' && (back || section === 'defaults')) {
      // option httpchk / option httpchk <uri> / option httpchk <method> <uri> [<version>]
      const method = v.length >= 3 ? v[1] : 'OPTIONS';
      const uri = v.length >= 3 ? v[2] : (v[1] ?? '/');
      if (back) back.httpchk = { method: v.length === 2 ? 'GET' : method, uri };
    }
    if (word === 'option' && v[0] === 'allbackups' && back) back.allbackups = true;
    if (word === 'http-check' && back) {
      if (v[0] === 'expect') {
        const neg = v[1] === '!';
        const kind = v[neg ? 2 : 1];
        const value = v[neg ? 3 : 2];
        if ((kind === 'status' || kind === 'rstatus') && value) back.expect = { kind, value };
        else if (!['string', 'rstring'].includes(kind ?? '')) c.alerts.push(`${at(n)} : 'http-check expect' : unknown match '${kind ?? ''}'.`);
      } else if (v[0] === 'send') {
        const mi = v.indexOf('meth');
        const ui = v.indexOf('uri');
        back.httpchk = { method: mi >= 0 ? v[mi + 1] : 'GET', uri: ui >= 0 ? v[ui + 1] : '/' };
      } else if (!['connect', 'disable-on-404', 'comment', 'set-var', 'unset-var'].includes(v[0] ?? '')) c.alerts.push(`${at(n)} : 'http-check' only supports 'comment', 'connect', 'send', 'expect', 'set-var', 'unset-var' and 'disable-on-404' (got '${v[0] ?? ''}').`);
    }
    if (word === 'default-server' || (word === 'server' && back)) {
      const name = word === 'server' ? v[0] : '';
      const addr = word === 'server' ? v[1] : '';
      const opts = word === 'server' ? v.slice(2) : v;
      const s: ServerConf = { name: name ?? '', addr: '', port: 0, check: false, inter: local.inter, fall: local.fall, rise: local.rise, backup: false, weight: 1, maxconn: 0, disabled: false, line: n };
      if (word === 'server') {
        const m = /^([\d.]+|[\w.-]+):(\d+)$/.exec(addr ?? '');
        if (!name || !addr) {
          c.alerts.push(`${at(n)} : 'server' expects <name> and <addr>[:<port>] as arguments.`);
          continue;
        }
        if (!m) {
          c.alerts.push(`${at(n)} : 'server ${name}' : missing port number: '${addr}'`);
          continue;
        }
        s.addr = m[1];
        s.port = Number(m[2]);
      }
      let bad = false;
      for (let i = 0; i < opts.length; i++) {
        const o = opts[i];
        if (!SERVER_WORDS.includes(o)) {
          const near = nearest(o, SERVER_WORDS);
          c.alerts.push(`${at(n)} : '${word}${name ? ` ${name}` : ''}' unknown keyword '${o}'.${near ? ` Did you mean '${near}' maybe ?` : ''}`);
          bad = true;
          break;
        }
        if (VALUE_WORDS.includes(o)) {
          const val = opts[++i];
          if (val === undefined) {
            c.alerts.push(`${at(n)} : '${word}${name ? ` ${name}` : ''}' : '${o}' expects an integer argument.`);
            bad = true;
            break;
          }
          if (o === 'inter') s.inter = readTime(val) ?? s.inter;
          if (o === 'fall' || o === 'rise' || o === 'weight' || o === 'maxconn') {
            const num = Number(val);
            if (!Number.isInteger(num) || num < (o === 'weight' || o === 'maxconn' ? 0 : 1)) {
              c.alerts.push(`${at(n)} : '${word}${name ? ` ${name}` : ''}' : invalid value '${val}' for '${o}'.`);
              bad = true;
              break;
            }
            s[o] = num;
          }
        } else if (o === 'check') s.check = true;
        else if (o === 'backup') s.backup = true;
        else if (o === 'disabled') s.disabled = true;
      }
      if (bad) continue;
      if (word === 'default-server') {
        local = { inter: s.inter, fall: s.fall, rise: s.rise };
        if (section === 'defaults') defaults = { ...local };
      } else if (back) {
        if (back.servers.some((x) => x.name === s.name)) c.alerts.push(`${at(n)} : backend '${back.name}' : duplicate server '${s.name}' already defined at line ${back.servers.find((x) => x.name === s.name)!.line}.`);
        else back.servers.push(s);
      }
    }
  }
  for (const f of c.frontends) {
    if (f.defaultBackend && !c.backends.some((b) => b.name === f.defaultBackend)) c.alerts.push(`Proxy '${f.name}': unable to find required default_backend: '${f.defaultBackend}'.`);
    if (!f.binds.length && !c.backends.some((b) => b.name === f.name)) c.alerts.push(`Proxy '${f.name}': no bind line declared for proxy.`);
  }
  for (const b of c.backends) {
    if (b.expect && !b.httpchk) {
      b.orphanCheck = true;
      c.warnings.push(`config : 'http-check' rules ignored for proxy '${b.name}' as they require 'option httpchk' (or 'http-check send').`);
    }
    if (b.httpchk && !b.servers.some((s) => s.check)) c.warnings.push(`config : 'option httpchk' ignored for proxy '${b.name}' as no server has the 'check' option.`);
  }
  return c;
}

/** What haproxy -c prints for a configuration, and whether it is valid. */
export function checkReport(c: HaproxyConf, pid: number, file = CFG): { lines: string[]; ok: boolean } {
  const pad = (k: string) => `[${k}]`.padEnd(10);
  const lines = c.warnings.map((w) => `${pad('WARNING')} (${pid}) : ${w}`);
  if (c.alerts.length) {
    lines.push(...c.alerts.map((a) => `${pad('ALERT')} (${pid}) : config : ${a}`));
    lines.push(`${pad('ALERT')} (${pid}) : config : Error(s) found in configuration file : ${file}`);
    lines.push(`${pad('ALERT')} (${pid}) : config : Fatal errors found in configuration.`);
    return { lines, ok: false };
  }
  lines.push('Configuration file is valid');
  return { lines, ok: true };
}

// ——— The running HAProxy ———

export interface ServerRun {
  name: string;
  backend: string;
  conf: ServerConf;
  admin: 'ready' | 'drain' | 'maint';
  up: boolean;
  health: number;
  nextCheck: number;
  status: string;
  code: number | null;
  desc: string;
  duration: number;
  scur: number;
  smax: number;
  stot: number;
  lbtot: number;
  hrsp: number[];
  chkfail: number;
  chkdown: number;
  lastChange: number;
  downtime: number;
  weight: number;
}

export interface HaproxyRun {
  conf: HaproxyConf;
  pid: number;
  started: number;
  servers: ServerRun[];
  rr: Record<string, number>;
  feTotal: number;
  feCur: number;
  hrsp: number[];
}

export interface Answer {
  code: number;
  reason: string;
  headers: string[];
  body: string;
}

/** What answers at an address and port (the story's backends): an HTTP answer, 'open' (TCP only), or null (refused). */
export type Backends = (address: string, port: number, path: string) => Answer | null;

export const haproxy = (j: Game): HaproxyRun | null => (j.state.haproxy as HaproxyRun | undefined) ?? null;
const backends = (j: Game): Backends => ((j as Shell).principal.state.haBackends as Backends | undefined) ?? (() => null);
const clock = (j: Game) => systemd(j)?.clock ?? 0;

/** A line in /var/log/haproxy.log (rsyslog's high-precision format, Debian's default). */
export function haLog(j: Game, message: string) {
  const r = haproxy(j);
  const n = j.find(LOG);
  const t = new Date(clock(j)).toISOString().replace(/\.(\d{3})Z$/, (_, ms) => `.${ms}${String(clock(j) % 997).padStart(3, '0')}+00:00`);
  const line = `${t} ${j.host} haproxy[${r?.pid ?? 0}]: ${message}`;
  if (n?.type === 'file') {
    const text = typeof n.content === 'string' ? n.content : '';
    // Keep the file at a reasonable size (logrotate would).
    const lines = text ? text.split('\n') : [];
    if (lines.length > 600) lines.splice(0, lines.length - 500);
    lines.push(line);
    n.content = lines.join('\n');
    n.lines = true;
    delete n.size;
  }
}

function freshServers(c: HaproxyConf, now: number): ServerRun[] {
  return c.backends.flatMap((b) =>
    b.servers.map((s) => ({
      name: s.name,
      backend: b.name,
      conf: s,
      admin: s.disabled ? 'maint' : 'ready',
      up: true,
      health: s.rise,
      nextCheck: now + (s.inter * (b.servers.indexOf(s) + 1)) / (b.servers.length + 1),
      status: s.check ? 'INI' : '',
      code: null,
      desc: '',
      duration: 0,
      scur: 0,
      smax: 0,
      stot: 0,
      lbtot: 0,
      hrsp: [0, 0, 0, 0, 0, 0],
      chkfail: 0,
      chkdown: 0,
      lastChange: now,
      downtime: 0,
      weight: s.weight,
    })),
  );
}

/** Why HAProxy can't start with this configuration (it binds its sockets): null if it can. */
export function startProblem(j: Game, c: HaproxyConf, local: (addr: string) => boolean): string[] | null {
  if (c.alerts.length) return checkReport(c, 0).lines.filter((l) => l.startsWith('[ALERT]')).map((l) => l.replace(/^\[ALERT\]\s+\(0\) : /, ''));
  const nonlocal = (j.read('/proc/sys/net/ipv4/ip_nonlocal_bind') ?? '0').trim() === '1';
  for (const f of c.frontends)
    for (const b of f.binds)
      if (b.addr !== '*' && !local(b.addr) && !nonlocal) return [`Starting frontend ${f.name}: cannot bind socket (Cannot assign requested address) [${b.addr}:${b.port}]`, 'failed to start the proxies'];
  return null;
}

/** HAProxy starts (or reloads: the new process starts with fresh server states). */
export function startHaproxy(j: Game, pid: number) {
  const c = parseCfg(j.read(CFG) ?? '');
  const now = clock(j);
  const old = haproxy(j);
  j.state.haproxy = { conf: c, pid, started: now, servers: freshServers(c, now), rr: {}, feTotal: old?.feTotal ?? 0, feCur: 0, hrsp: old?.hrsp ?? [0, 0, 0, 0, 0, 0] } satisfies HaproxyRun;
  for (const f of c.frontends) haLog(j, `Proxy ${f.name} started.`);
  for (const b of c.backends) if (!c.frontends.some((f) => f.name === b.name)) haLog(j, `Proxy ${b.name} started.`);
}

export function stopHaproxy(j: Game) {
  const r = haproxy(j);
  if (!r) return;
  for (const f of r.conf.frontends) haLog(j, `Proxy ${f.name} stopped (cumulated conns: FE: ${r.feTotal}, BE: ${r.feTotal}).`);
  j.state.haproxy = null;
}

const usable = (s: ServerRun) => s.up && s.admin === 'ready' && s.weight > 0;
const counts = (r: HaproxyRun, b: string) => r.servers.filter((s) => s.backend === b);

function transition(j: Game, s: ServerRun, up: boolean, reason: string, now: number) {
  const r = haproxy(j)!;
  s.up = up;
  s.lastChange = now;
  if (!up) s.chkdown++;
  const others = counts(r, s.backend);
  const active = others.filter((x) => !x.conf.backup && x.up && x.admin !== 'maint').length;
  const backup = others.filter((x) => x.conf.backup && x.up && x.admin !== 'maint').length;
  const what = s.conf.backup ? 'Backup Server' : 'Server';
  const msg = up
    ? `${what} ${s.backend}/${s.name} is UP, reason: ${reason}, check duration: ${s.duration}ms. ${active} active and ${backup} backup servers online. 0 sessions requeued, 0 total in queue.`
    : `${what} ${s.backend}/${s.name} is DOWN, reason: ${reason}, check duration: ${s.duration}ms. ${active} active and ${backup} backup servers left. ${s.scur} sessions active, 0 requeued, 0 remaining in queue.`;
  haLog(j, msg);
  if (!up && active === 0 && backup === 0) haLog(j, `backend ${s.backend} has no server available!`);
}

/** The health checks due at this moment. */
export function runChecks(j: Game, now: number) {
  const r = haproxy(j);
  if (!r) return;
  for (const s of r.servers) {
    if (!s.conf.check || s.admin === 'maint' || now < s.nextCheck) continue;
    s.nextCheck = now + s.conf.inter;
    const b = r.conf.backends.find((x) => x.name === s.backend)!;
    const answer = backends(j)(s.conf.addr, s.conf.port, b.httpchk?.uri ?? '/');
    let ok: boolean;
    let reason: string;
    s.duration = answer ? 1 + (s.name.length % 3) : 0;
    if (!answer) {
      ok = false;
      s.status = 'L4CON';
      s.code = null;
      s.desc = 'Connection refused';
      reason = 'Layer4 connection problem, info: "Connection refused"';
    } else if (!b.httpchk) {
      ok = true;
      s.status = 'L4OK';
      s.code = null;
      s.desc = '';
      reason = 'Layer4 check passed';
    } else {
      const expect = b.expect;
      ok = expect ? (expect.kind === 'status' ? expect.value.split(',').includes(String(answer.code)) : new RegExp(expect.value).test(String(answer.code))) : answer.code >= 200 && answer.code < 400;
      s.status = ok ? 'L7OK' : 'L7STS';
      s.code = answer.code;
      s.desc = answer.reason;
      reason = ok ? `Layer7 check passed, code: ${answer.code}` : `Layer7 wrong status, code: ${answer.code}, info: "${answer.reason}"`;
    }
    const max = s.conf.rise + s.conf.fall - 1;
    if (ok) {
      if (!s.up) {
        s.health++;
        if (s.health >= s.conf.rise) {
          s.health = max;
          transition(j, s, true, reason, now);
        }
      } else s.health = Math.min(max, s.health + 1);
    } else {
      s.chkfail++;
      if (s.up) {
        s.health--;
        if (s.health < s.conf.rise) {
          s.health = 0;
          transition(j, s, false, reason, now);
        }
      } else s.health = 0;
    }
  }
}

/** The server a new request goes to, or null (no server available). */
export function pick(j: Game, backend: string): ServerRun | null {
  const r = haproxy(j)!;
  const all = counts(r, backend);
  const b = r.conf.backends.find((x) => x.name === backend);
  let pool = all.filter((s) => !s.conf.backup && usable(s));
  if (!pool.length) {
    const backups = all.filter((s) => s.conf.backup && usable(s));
    pool = b?.allbackups ? backups : backups.slice(0, 1);
  }
  if (!pool.length) return null;
  if (b?.balance === 'leastconn') {
    const least = Math.min(...pool.map((s) => s.scur));
    pool = pool.filter((s) => s.scur === least);
  }
  if (b?.balance === 'first') return pool[0];
  const k = r.rr[backend] ?? 0;
  r.rr[backend] = k + 1;
  return pool[k % pool.length];
}

/** The 503 HAProxy answers when no server is available. */
export const NO_SERVER: Answer = {
  code: 503,
  reason: 'Service Unavailable',
  headers: ['content-length: 107', 'cache-control: no-cache', 'content-type: text/html'],
  body: '<html><body><h1>503 Service Unavailable</h1>\nNo server is available to handle this request.\n</body></html>',
};

/** A client's request reaching this HAProxy on a port: the answer and the server, logged; null if nothing listens there. */
export function request(j: Game, port: number, path: string, client: string, now: number, cut = false): { answer: Answer | null; server: string } | null {
  const r = haproxy(j);
  if (!r) return null;
  const f = r.conf.frontends.find((x) => x.binds.some((b) => b.port === port));
  if (!f) return null;
  const backend = f.defaultBackend ?? (r.conf.backends.some((b) => b.name === f.name) ? f.name : null);
  r.feTotal++;
  const date = (() => {
    const d = new Date(now);
    const M = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][d.getUTCMonth()];
    const p = (x: number, w = 2) => String(x).padStart(w, '0');
    return `${p(d.getUTCDate())}/${M}/${d.getUTCFullYear()}:${p(d.getUTCHours())}:${p(d.getUTCMinutes())}:${p(d.getUTCSeconds())}.${p(now % 1000, 3)}`;
  })();
  const s = backend ? pick(j, backend) : null;
  const conns = `${r.feCur + 1}/${r.feCur + 1}/${s ? s.scur : 0}/${s ? s.scur : 0}/0`;
  const where = `${f.name} ${backend ?? f.name}/${s?.name ?? '<NOSRV>'}`;
  if (cut && s) {
    s.stot++;
    s.lbtot++;
    haLog(j, `${client} [${date}] ${where} 0/0/1/-1/2 -1 0 - - CD-- ${conns} 0/0 "GET ${path} HTTP/1.1"`);
    return { answer: null, server: s.name };
  }
  if (!s) {
    r.hrsp[4]++;
    haLog(j, `${client} [${date}] ${where} 0/-1/-1/-1/0 503 ${NO_SERVER.body.length + 110} - - SC-- ${conns} 0/0 "GET ${path} HTTP/1.1"`);
    return { answer: NO_SERVER, server: '<NOSRV>' };
  }
  s.stot++;
  s.lbtot++;
  const a = backends(j)(s.conf.addr, s.conf.port, path);
  if (!a) {
    r.hrsp[4]++;
    s.hrsp[4]++;
    haLog(j, `${client} [${date}] ${where} 0/0/-1/-1/3002 503 ${NO_SERVER.body.length + 110} - - SC-- ${conns} 3/0 "GET ${path} HTTP/1.1"`);
    return { answer: NO_SERVER, server: s.name };
  }
  const k = Math.min(5, Math.floor(a.code / 100)) - 1;
  s.hrsp[k]++;
  r.hrsp[k]++;
  const tr = 8 + (path.length % 17);
  haLog(j, `${client} [${date}] ${where} 0/0/1/${tr}/${tr + 1} ${a.code} ${a.body.length + 180} - - ---- ${conns} 0/0 "GET ${path} HTTP/1.1"`);
  return { answer: a, server: s.name };
}

/** Sessions: the servers still receiving traffic keep a few; the others see theirs end, one every few seconds. */
export function settle(j: Game, receiving: (s: ServerRun) => boolean) {
  const r = haproxy(j);
  if (!r) return;
  for (const s of r.servers) {
    const target = receiving(s) && usable(s) ? 3 : 0;
    if (s.scur < target) s.scur++;
    else if (s.scur > target) s.scur--;
    s.smax = Math.max(s.smax, s.scur);
  }
}

// ——— The runtime API (stats socket) ———

const FIELDS =
  'pxname,svname,qcur,qmax,scur,smax,slim,stot,bin,bout,dreq,dresp,ereq,econ,eresp,wretr,wredis,status,weight,act,bck,chkfail,chkdown,lastchg,downtime,qlimit,pid,iid,sid,throttle,lbtot,tracked,type,rate,rate_lim,rate_max,check_status,check_code,check_duration,hrsp_1xx,hrsp_2xx,hrsp_3xx,hrsp_4xx,hrsp_5xx,hrsp_other,hanafail,req_rate,req_rate_max,req_tot,cli_abrt,srv_abrt';

function statusOf(s: ServerRun): string {
  if (s.admin === 'maint') return 'MAINT';
  if (!s.conf.check) return s.admin === 'drain' ? 'DRAIN' : 'no check';
  const max = s.conf.rise + s.conf.fall - 1;
  if (s.up) {
    if (s.admin === 'drain') return 'DRAIN';
    return s.health < max ? `UP ${s.health - s.conf.rise + 1}/${s.conf.fall}` : 'UP';
  }
  return s.health > 0 ? `DOWN ${s.health}/${s.conf.rise}` : 'DOWN';
}

/** echo "show stat" | socat stdio /run/haproxy/admin.sock */
export function showStat(j: Game): string {
  const r = haproxy(j)!;
  const now = clock(j);
  const sec = (t: number) => String(Math.max(0, Math.floor((now - t) / 1000)));
  const lines = [`# ${FIELDS},`];
  let iid = 1;
  const row = (cells: (string | number)[]) => lines.push(`${cells.join(',')},`);
  const pad = (n: number) => Array(n).fill('');
  for (const f of r.conf.frontends) {
    row([f.name, 'FRONTEND', '', '', r.feCur, r.feCur, 262120, r.feTotal, r.feTotal * 412, r.feTotal * 2051, 0, 0, 0, '', '', '', '', 'OPEN', '', '', '', '', '', '', '', '', 1, iid++, 0, '', '', '', 0, 1, 0, 3, '', '', '', 0, ...r.hrsp, 0, '', 1, 3, r.feTotal, '', '']);
  }
  for (const b of r.conf.backends) {
    const id = iid++;
    const servers = counts(r, b.name);
    servers.forEach((s, k) => {
      const check = s.conf.check ? (s.admin === 'maint' ? '' : s.status) : '';
      row([
        b.name, s.name, 0, 0, s.scur, s.smax, s.conf.maxconn || '', s.stot, s.stot * 412, s.stot * 2051, '', 0, '', 0, 0, 0, 0, statusOf(s), s.weight, s.conf.backup ? 0 : 1, s.conf.backup ? 1 : 0,
        s.conf.check ? s.chkfail : '', s.conf.check ? s.chkdown : '', sec(s.lastChange), s.conf.check ? Math.floor(s.downtime / 1000) : '', '', 1, id, k + 1, '', s.lbtot, '', 2, 0, '', 1, check, s.code ?? '', s.conf.check ? s.duration : '',
        ...s.hrsp, 0, '', '', '', '', 0, 0,
      ]);
    });
    const up = servers.filter((s) => usable(s) || (s.up && s.admin === 'drain'));
    row([b.name, 'BACKEND', 0, 0, servers.reduce((t, s) => t + s.scur, 0), servers.reduce((t, s) => t + s.smax, 0), 26212, servers.reduce((t, s) => t + s.stot, 0), 0, 0, 0, 0, '', 0, 0, 0, 0, up.length ? 'UP' : 'DOWN', servers.filter(usable).reduce((t, s) => t + s.weight, 0), servers.filter((s) => usable(s) && !s.conf.backup).length, servers.filter((s) => usable(s) && s.conf.backup).length, '', 0, sec(r.started), 0, '', 1, id, 0, '', servers.reduce((t, s) => t + s.lbtot, 0), '', 1, 0, '', 2, '', '', '', ...pad(0), 0, 0, 0, 0, servers.reduce((t, s) => t + s.hrsp[4], 0), 0, '', '', '', '', 0, 0]);
  }
  return lines.join('\n');
}

const OP_STATE = (s: ServerRun) => (s.up ? 2 : 0);
const ADMIN_STATE = (s: ServerRun) => (s.admin === 'maint' ? 1 : s.admin === 'drain' ? 8 : 0);
const CHECK_STATUS: Record<string, number> = { '': 0, INI: 1, L4OK: 5, L4CON: 7, L7OK: 13, L7STS: 15 };

/** show servers state [backend] (format version 1). */
export function showServersState(j: Game, only?: string): string | null {
  const r = haproxy(j)!;
  if (only && !r.conf.backends.some((b) => b.name === only)) return null;
  const now = clock(j);
  const lines = ['1', '# be_id be_name srv_id srv_name srv_addr srv_op_state srv_admin_state srv_uweight srv_iweight srv_time_since_last_change srv_check_status srv_check_result srv_check_health srv_check_state srv_agent_state bk_f_forced_id srv_f_forced_id srv_fqdn srv_port srvrecord srv_use_ssl srv_check_port srv_check_addr srv_agent_addr srv_agent_port'];
  r.conf.backends.forEach((b, bi) => {
    if (only && b.name !== only) return;
    counts(r, b.name).forEach((s, k) => {
      lines.push(
        [bi + r.conf.frontends.length + 1, b.name, k + 1, s.name, s.conf.addr, OP_STATE(s), ADMIN_STATE(s), s.weight, s.conf.weight, Math.floor((now - s.lastChange) / 1000), CHECK_STATUS[s.status] ?? 0, s.conf.check ? (s.up ? 3 : 2) : 1, s.health, s.conf.check ? 6 : 0, 0, 0, 0, '-', s.conf.port, '-', 0, 0, '-', '-', 0].join(' '),
      );
    });
  });
  return lines.join('\n');
}

/** A runtime API command; its answer (as HAProxy writes it, followed by an empty line). */
export function runtime(j: Game, line: string): string {
  const r = haproxy(j);
  if (!r) return '';
  const w = line.trim().split(/\s+/);
  const cmd = w.join(' ');
  const find = (spec: string | undefined): ServerRun | string => {
    const [b, s] = (spec ?? '').split('/');
    if (!b || !s) return 'Require \'backend/server\'.\n';
    if (!r.conf.backends.some((x) => x.name === b)) return 'No such backend.\n';
    return r.servers.find((x) => x.backend === b && x.name === s) ?? 'No such server.\n';
  };
  const now = clock(j);
  const setAdmin = (s: ServerRun, admin: ServerRun['admin']) => {
    if (s.admin === admin) return;
    const was = s.admin;
    s.admin = admin;
    s.lastChange = now;
    if (admin === 'maint') haLog(j, `Server ${s.backend}/${s.name} is going DOWN for maintenance. ${counts(r, s.backend).filter((x) => usable(x) && !x.conf.backup).length} active and ${counts(r, s.backend).filter((x) => usable(x) && x.conf.backup).length} backup servers left. ${s.scur} sessions active, 0 requeued, 0 remaining in queue.`);
    else if (admin === 'drain') haLog(j, `Server ${s.backend}/${s.name} enters drain state.`);
    else {
      if (was === 'maint') {
        // Leaving maintenance: the checks start again, from a server considered UP.
        s.health = s.conf.rise;
        s.nextCheck = now;
        s.up = true;
      }
      haLog(j, `Server ${s.backend}/${s.name} is ${s.up ? 'UP' : 'DOWN'} (leaving forced ${was === 'maint' ? 'maintenance' : 'drain'}).`);
    }
  };
  if (cmd === 'show stat') return `${showStat(j)}\n`;
  if (w[0] === 'show' && w[1] === 'servers' && w[2] === 'state') {
    const out = showServersState(j, w[3]);
    return out === null ? `Can't find backend.\n` : `${out}\n`;
  }
  if (cmd === 'show info') {
    const up = Math.floor((now - r.started) / 1000);
    return [
      'Name: HAProxy',
      `Version: ${HAPROXY_VERSION}`,
      'Release_date: 2025/06/03',
      'Nbthread: 2',
      'Nbproc: 1',
      'Process_num: 1',
      `Pid: ${r.pid}`,
      `Uptime: 0d ${Math.floor(up / 3600)}h${String(Math.floor((up % 3600) / 60)).padStart(2, '0')}m${String(up % 60).padStart(2, '0')}s`,
      `Uptime_sec: ${up}`,
      'Maxconn: 4096',
      `CurrConns: ${r.feCur}`,
      `CumConns: ${r.feTotal}`,
      `CumReq: ${r.feTotal}`,
      '',
    ].join('\n');
  }
  if (cmd === 'show backend') return `# name\n${r.conf.backends.map((b) => b.name).join('\n')}\n`;
  if ((w[0] === 'disable' || w[0] === 'enable') && w[1] === 'server') {
    const s = find(w[2]);
    if (typeof s === 'string') return s;
    setAdmin(s, w[0] === 'disable' ? 'maint' : 'ready');
    return '\n';
  }
  if (w[0] === 'set' && w[1] === 'server') {
    const s = find(w[2]);
    if (typeof s === 'string') return s;
    if (w[3] === 'state') {
      if (!['ready', 'drain', 'maint'].includes(w[4] ?? '')) return "'set server <srv> state' expects 'ready', 'drain' and 'maint'.\n";
      setAdmin(s, w[4] as ServerRun['admin']);
      return '\n';
    }
    if (w[3] === 'weight') {
      const n = Number((w[4] ?? '').replace('%', ''));
      if (!Number.isInteger(n) || n < 0 || n > 256) return 'Integer value between 0 and 256 expected.\n';
      s.weight = (w[4] ?? '').endsWith('%') ? Math.round((s.conf.weight * n) / 100) : n;
      return '\n';
    }
    return "'set server <srv>' only supports 'agent', 'health', 'state', 'weight', 'addr', 'fqdn' and 'check-port'.\n";
  }
  if ((w[0] === 'set' || w[0] === 'get') && w[1] === 'weight') {
    const s = find(w[2]);
    if (typeof s === 'string') return s;
    if (w[0] === 'get') return `${s.weight} (initial ${s.conf.weight})\n`;
    const n = Number((w[3] ?? '').replace('%', ''));
    if (!Number.isInteger(n) || n < 0 || n > 256) return 'Integer value between 0 and 256 expected.\n';
    s.weight = n;
    return '\n';
  }
  if (cmd === 'help' || cmd === '') return HELP;
  return `Unknown command: '${w[0]}'\n\n${HELP}`;
}

const HELP = `The following commands are valid at this level:
  disable server (DEPRECATED)             : disable a server for maintenance (use 'set server' instead)
  enable server  (DEPRECATED)             : enable a disabled server (use 'set server' instead)
  get weight <bk>/<srv>                   : report a server's current weight
  help [<command>]                        : list matching or all commands
  quit                                    : disconnect
  set server <bk>/<srv> [opts]            : change a server's state, weight, address or ssl
  set weight <bk>/<srv>  (DEPRECATED)     : change a server's weight (use 'set server' instead)
  show backend                            : list backends in the current running config
  show info [desc|json|typed|float]*      : report information about the running process
  show servers state [<backend>]          : dump volatile server information (all or for a single backend)
  show stat [desc|json|no-maint|typed|up]*: report counters for each proxy and server
`;

/** The server a name designates in a backend (for the stories). */
export const serverRun = (j: Game, backend: string, name: string) => haproxy(j)?.servers.find((s) => s.backend === backend && s.name === name) ?? null;
