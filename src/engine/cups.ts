// CUPS, the print server of a Debian machine (cups 2.4): the scheduler
// cupsd and its state, kept in state.cups. What it models:
// - /etc/cups/cupsd.conf, read when cupsd starts (systemctl reload is
//   refused: the unit has no ExecReload=): LogLevel, MaxLogSize, PreserveJobHistory, PreserveJobFiles,
//   ErrorPolicy, Listen and Port, Browsing, the <Location> blocks (Order,
//   Allow, Deny) that decide who reaches a path, and <Policy default> with
//   its <Limit> blocks (Require user @OWNER @SYSTEM) and JobPrivateValues;
// - the queues (printers), which cupsd keeps in memory and writes to
//   /etc/cups/printers.conf when they change and when it stops, and reads
//   from it when it starts: a hand edit made while cupsd runs is lost;
// - jobs (an id, an owner, a title, a size, pages, a state: pending, held,
//   processing, completed, canceled, aborted), their files in the spool
//   /var/spool/cups (control file c00042, document d00042-001), kept after
//   printing for PreserveJobFiles (a day by default) and their history for
//   PreserveJobHistory (forever by default);
// - the logs of /var/log/cups: error_log (by LogLevel, rotated by cupsd at
//   MaxLogSize into error_log.O), access_log, page_log;
// - the devices on the network (what lpinfo and driverless find, whether
//   they speak IPP Everywhere) and the printing itself: the first job of an
//   enabled queue prints at the printer's pages per minute.
// Sources: https://www.cups.org/doc/man-cupsd.conf.html,
// https://www.cups.org/doc/man-cupsd.html, https://www.cups.org/doc/man-printers.conf.html
// (the warning about editing it), https://www.cups.org/doc/man-lpadmin.html,
// https://www.cups.org/doc/policies.html, https://www.cups.org/doc/sharing.html,
// https://www.cups.org/doc/spec-design.html (the spool's files).
// Simplifications: no classes, no filters nor backends to run (a document
// prints at the device's speed), no authentication (a local user is who
// they are; a remote client's requesting-user-name is trusted, as CUPS
// does without AuthType), no TLS, no subscriptions, one PPD option set.

import type { Game, Shell } from './shell';
import type { Directory, File, Node } from './world';
import { systemd } from './systemd';

export const CUPSD_CONF = '/etc/cups/cupsd.conf';
export const PRINTERS_CONF = '/etc/cups/printers.conf';
export const SPOOL = '/var/spool/cups';
export const LOG_DIR = '/var/log/cups';
export const VERSION = '2.4.10';
export const SYSTEM_GROUP = 'lpadmin';

export type JobState = 'pending' | 'held' | 'processing' | 'completed' | 'canceled' | 'aborted';
export const FINISHED: JobState[] = ['completed', 'canceled', 'aborted'];

export interface Printer {
  name: string;
  info: string;
  location: string;
  uri: string;
  makeModel: string;
  // 'everywhere' (a PPD made from the printer's IPP attributes), 'raw', or a model of lpinfo -m.
  driver: string;
  state: 'idle' | 'processing' | 'stopped';
  stateTime: number;
  message: string;
  accepting: boolean;
  acceptTime: number;
  rejectReason?: string;
  shared: boolean;
  // lpadmin -u allow:… / deny:… (names and @groups).
  allow?: string[];
  deny?: string[];
  errorPolicy?: string;
  id: number;
}

export interface Job {
  id: number;
  printer: string;
  user: string;
  title: string;
  size: number;
  pages: number;
  printed: number;
  state: JobState;
  host: string;
  created: number;
  completed?: number;
  // The document is gone from the spool (purged, or removed by hand: lost).
  noFile?: boolean;
  // Removed by hand while cupsd still counts on it.
  lost?: boolean;
  // Its document was written to the spool.
  filed?: boolean;
  reason?: string;
}

export interface Device {
  // The ways to name it: its IPP or socket URI, its address, its names.
  uri: string;
  names: string[];
  address: string;
  makeModel: string;
  ipp: boolean;
  online: boolean;
  ppm: number;
  // What driverless and lpinfo -v show (DNS-SD name).
  dnssd?: string;
}

export interface Model {
  name: string;
  makeModel: string;
  // Installed by a package (its file must exist), or always there.
  file?: string;
}

export interface Location {
  path: string;
  order: 'allow,deny' | 'deny,allow';
  allow: string[];
  deny: string[];
  line: number;
}
export interface Limit {
  ops: string[];
  require: string[] | null;
}
export interface Policy {
  name: string;
  values: Record<string, string>;
  limits: Limit[];
}
export interface CupsdConf {
  directives: Record<string, string>;
  listen: string[];
  locations: Location[];
  policies: Record<string, Policy>;
  warnings: string[];
  errors: string[];
}

export interface Network {
  // The server's interfaces: name, address, prefix length.
  interfaces: { name: string; address: string; prefix: number }[];
  // Known clients: their address, their name (access_log shows the address).
  names?: Record<string, string>;
}

export interface CupsState {
  printers: Record<string, Printer>;
  jobs: Job[];
  nextJob: number;
  nextPrinter: number;
  default: string | null;
  devices: Device[];
  models: Model[];
  network: Network;
  // The configuration cupsd runs with (read when it started), and its text.
  conf: CupsdConf | null;
  confText?: string;
  // What cupsd last wrote to printers.conf (to tell a hand edit).
  written: string;
  // Its log files' base sizes (a big log the story starts with).
  logBase?: Record<string, number>;
}

export const cups = (j: Game): CupsState => j.state.cups as CupsState;
export const hasCups = (j: Game) => !!j.state.cups;
export const running = (j: Game) => systemd(j)?.services.cups?.state === 'active';
const clock = (j: Game) => systemd(j)?.clock ?? 0;

// ——— Dates ———

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const two = (n: number) => String(n).padStart(2, '0');
/** strftime's %c in the C locale, as lpstat writes dates: Mon Nov 23 08:05:11 2026. */
export function cDate(ms: number): string {
  const d = new Date(ms);
  return `${DAYS[d.getUTCDay()]} ${MONTHS[d.getUTCMonth()]} ${String(d.getUTCDate()).padStart(2, ' ')} ${two(d.getUTCHours())}:${two(d.getUTCMinutes())}:${two(d.getUTCSeconds())} ${d.getUTCFullYear()}`;
}
/** The logs' date: [23/Nov/2026:08:05:11 +0000]. */
export function logDate(ms: number): string {
  const d = new Date(ms);
  return `[${two(d.getUTCDate())}/${MONTHS[d.getUTCMonth()]}/${d.getUTCFullYear()}:${two(d.getUTCHours())}:${two(d.getUTCMinutes())}:${two(d.getUTCSeconds())} +0000]`;
}

// ——— cupsd.conf ———

// The directives cupsd.conf(5) documents that the game reads, or accepts.
const TOP = new Set(
  [
    'AccessLogLevel', 'AutoPurgeJobs', 'BrowseLocalProtocols', 'BrowseWebIF', 'Browsing', 'DefaultAuthType', 'DefaultEncryption', 'DefaultLanguage',
    'DefaultPaperSize', 'DefaultPolicy', 'DefaultShared', 'DirtyCleanInterval', 'ErrorPolicy', 'FilterLimit', 'HostNameLookups', 'IdleExitTimeout',
    'JobKillDelay', 'JobRetryInterval', 'JobRetryLimit', 'KeepAlive', 'Listen', 'LogDebugHistory', 'LogLevel', 'LogTimeFormat', 'MaxClients',
    'MaxClientsPerHost', 'MaxCopies', 'MaxHoldTime', 'MaxJobs', 'MaxJobsPerPrinter', 'MaxJobsPerUser', 'MaxJobTime', 'MaxLogSize', 'MultipleOperationTimeout',
    'PageLogFormat', 'Port', 'PreserveJobFiles', 'PreserveJobHistory', 'ReloadTimeout', 'ServerAdmin', 'ServerAlias', 'ServerName', 'ServerTokens',
    'SSLListen', 'SSLOptions', 'SSLPort', 'Timeout', 'WebInterface',
  ].map((x) => x.toLowerCase()),
);
const IN_LOCATION = new Set(['order', 'allow', 'deny', 'authtype', 'require', 'satisfy', 'encryption', 'authclass', 'authgroupname']);
const IN_POLICY = new Set(['jobprivateaccess', 'jobprivatevalues', 'subscriptionprivateaccess', 'subscriptionprivatevalues']);
const LEVELS = ['none', 'emerg', 'alert', 'crit', 'error', 'warn', 'notice', 'info', 'debug', 'debug2'];

/** Reads cupsd.conf like cupsd: directives, <Location>, <Policy> and <Limit> blocks. */
export function parseConf(text: string): CupsdConf {
  const c: CupsdConf = { directives: {}, listen: [], locations: [], policies: {}, warnings: [], errors: [] };
  let location: Location | null = null;
  let policy: Policy | null = null;
  let limit: Limit | null = null;
  const where = (n: number) => `on line ${n} of ${CUPSD_CONF}`;
  text.split('\n').forEach((raw, i) => {
    const n = i + 1;
    const line = raw.replace(/^\s+|\s+$/g, '');
    if (!line || line.startsWith('#')) return;
    const open = /^<(\w+)\s*([^>]*)>$/.exec(line);
    const close = /^<\/(\w+)>$/.exec(line);
    if (open) {
      const tag = open[1].toLowerCase();
      if (tag === 'location' && !location && !policy) location = { path: open[2].trim() || '/', order: 'deny,allow', allow: [], deny: [], line: n };
      else if (tag === 'policy' && !location && !policy) policy = { name: open[2].trim(), values: {}, limits: [] };
      else if ((tag === 'limit' || tag === 'limitexcept') && (policy || location) && !limit) limit = { ops: open[2].trim().split(/\s+/).filter(Boolean), require: null };
      else c.errors.push(`Syntax error ${where(n)}.`);
      return;
    }
    if (close) {
      const tag = close[1].toLowerCase();
      if ((tag === 'limit' || tag === 'limitexcept') && limit) {
        if (policy) policy.limits.push(limit);
        limit = null;
      } else if (tag === 'location' && location && !limit) {
        c.locations.push(location);
        location = null;
      } else if (tag === 'policy' && policy && !limit) {
        c.policies[policy.name] = policy;
        policy = null;
      } else c.errors.push(`Syntax error ${where(n)}.`);
      return;
    }
    const m = /^(\S+)(?:\s+(.*))?$/.exec(line)!;
    const name = m[1];
    const value = (m[2] ?? '').trim();
    const key = name.toLowerCase();
    if (limit) {
      if (key === 'require') limit.require = value.replace(/^user\s+/i, '').split(/\s+/).filter(Boolean);
      else if (!IN_LOCATION.has(key)) c.warnings.push(`Unknown directive ${name} ${where(n)}.`);
      return;
    }
    if (location) {
      if (key === 'order') {
        const o = value.toLowerCase().replace(/\s+/g, '');
        if (o === 'allow,deny' || o === 'deny,allow') location.order = o;
        else c.errors.push(`Unknown Order value ${value} ${where(n)}.`);
      } else if (key === 'allow' || key === 'deny') {
        const items = value.replace(/^from\s+/i, '').split(/\s+/).filter(Boolean);
        (key === 'allow' ? location.allow : location.deny).push(...items);
      } else if (!IN_LOCATION.has(key)) c.warnings.push(`Unknown directive ${name} ${where(n)}.`);
      return;
    }
    if (policy) {
      if (IN_POLICY.has(key)) policy.values[key] = value;
      else c.warnings.push(`Unknown directive ${name} ${where(n)}.`);
      return;
    }
    if (key === 'listen' || key === 'port') {
      c.listen.push(key === 'port' ? `*:${value}` : value);
      return;
    }
    if (!TOP.has(key)) {
      c.warnings.push(`Unknown directive ${name} ${where(n)}.`);
      return;
    }
    if (key === 'loglevel' && !LEVELS.includes(value.toLowerCase())) c.warnings.push(`Unknown LogLevel ${value} ${where(n)}.`);
    else c.directives[key] = value;
  });
  if (limit || location || policy) c.errors.push(`Syntax error on line ${text.split('\n').length} of ${CUPSD_CONF}.`);
  return c;
}

/** A directive's value as cupsd uses it (its default otherwise). */
export function directive(c: CupsdConf | null, name: string): string {
  const v = c?.directives[name.toLowerCase()];
  if (v !== undefined) return v;
  const DEFAULTS: Record<string, string> = {
    loglevel: 'warn',
    maxlogsize: '1m',
    preservejobhistory: 'Yes',
    preservejobfiles: '86400',
    errorpolicy: 'stop-printer',
    browsing: 'Yes',
    defaultshared: 'Yes',
    webinterface: 'No',
  };
  return DEFAULTS[name.toLowerCase()] ?? '';
}

/** A size (MaxLogSize): bytes, with k, m or g. 0: no rotation. */
export function sizeValue(v: string): number {
  const m = /^(\d+)\s*([kmg]?)$/i.exec(v.trim());
  if (!m) return 1024 * 1024;
  return Number(m[1]) * { '': 1, k: 1024, m: 1024 ** 2, g: 1024 ** 3 }[m[2].toLowerCase() as '' | 'k' | 'm' | 'g'];
}
/** A time (PreserveJobHistory, PreserveJobFiles): Yes (forever), No (0), seconds, or with w, d, h, m. */
export function timeValue(v: string): number {
  const x = v.trim().toLowerCase();
  if (['yes', 'on', 'true'].includes(x)) return Infinity;
  if (['no', 'off', 'false'].includes(x)) return 0;
  const m = /^(\d+)\s*([wdhm]?)$/.exec(x);
  if (!m) return Infinity;
  return Number(m[1]) * { '': 1, m: 60, h: 3600, d: 86400, w: 604800 }[m[2] as '' | 'm' | 'h' | 'd' | 'w'] * 1000;
}

// ——— Who may reach what ———

const ipNumber = (a: string) => a.split('.').reduce((t, x) => t * 256 + Number(x), 0);
const isIp = (a: string) => /^\d{1,3}(\.\d{1,3}){3}$/.test(a);
const inNet = (address: string, net: string, prefix: number) => {
  if (!isIp(address) || !isIp(net)) return false;
  const mask = prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0;
  return ((ipNumber(address) & mask) >>> 0) === ((ipNumber(net) & mask) >>> 0);
};
const isLocalhost = (a: string) => a === 'localhost' || a === '127.0.0.1' || a === '::1';

/** Does an Allow/Deny value match this client? */
export function matches(st: CupsState, value: string, address: string): boolean {
  const v = value.toLowerCase();
  if (v === 'all' || v === '*') return true;
  if (v === 'none') return false;
  if (v === '@local') return st.network.interfaces.some((i) => inNet(address, i.address, i.prefix));
  const ifc = /^@if\((.+)\)$/.exec(v);
  if (ifc) return st.network.interfaces.some((i) => i.name === ifc[1] && inNet(address, i.address, i.prefix));
  if (v === 'localhost') return isLocalhost(address);
  const cidr = /^([\d.]+)\/(\d+)$/.exec(v);
  if (cidr) return inNet(address, cidr[1], Number(cidr[2]));
  const mask = /^([\d.]+)\/([\d.]+)$/.exec(v);
  if (mask && isIp(mask[2])) return inNet(address, mask[1], ipNumber(mask[2]).toString(2).replace(/0+$/, '').length);
  // A partial address: 198.51.100 or 198.51.100.*
  const part = v.replace(/\.\*$/, '');
  if (/^\d{1,3}(\.\d{1,3}){0,2}$/.test(part)) return address.startsWith(`${part}.`);
  if (isIp(v)) return v === address;
  // A name: the client's, or *.domain.
  const name = st.network.names?.[address]?.toLowerCase();
  if (!name) return false;
  return v.startsWith('*.') || v.startsWith('.') ? name.endsWith(v.replace(/^\*/, '')) : name === v;
}

/** Does cupsd listen where this client can connect? */
export function listensFor(st: CupsState, c: CupsdConf, address: string): boolean {
  if (isLocalhost(address)) return true;
  return c.listen.some((l) => {
    if (l.startsWith('/')) return false;
    const host = l.replace(/:\d+$/, '').replace(/^\[|\]$/g, '');
    if (host === '*' || host === '0.0.0.0' || host === '' || /^\d+$/.test(l)) return true;
    if (isLocalhost(host)) return false;
    const i = st.network.interfaces.find((x) => x.address === host || x.name === host);
    return !!i && inNet(address, i.address, i.prefix);
  });
}

/** The <Location> that applies to a path (the longest that starts it), like cupsdFindBest. */
export function locationFor(c: CupsdConf, path: string): Location | null {
  const p = path.toLowerCase().replace(/\/+$/, '') || '/';
  return (
    c.locations
      .filter((l) => {
        const x = l.path.toLowerCase().replace(/\/+$/, '') || '/';
        return x === '/' || p === x || p.startsWith(`${x}/`);
      })
      .sort((a, b) => b.path.length - a.path.length)[0] ?? null
  );
}

/** Would cupsd let this client reach this path (the network, then its <Location>)? Localhost always may. */
export function reaches(j: Game, address: string, path: string, c: CupsdConf | null = cups(j).conf): boolean {
  const st = cups(j);
  if (!c || !running(j)) return false;
  if (isLocalhost(address)) return true;
  if (!listensFor(st, c, address)) return false;
  const l = locationFor(c, path);
  if (!l) return true;
  const allowed = l.allow.some((v) => matches(st, v, address));
  const denied = l.deny.some((v) => matches(st, v, address));
  return l.order === 'allow,deny' ? allowed && !denied : !denied || allowed;
}

/** Is a location open to anyone (Allow all, *)? */
export const allowsAll = (c: CupsdConf | null) => !!c?.locations.some((l) => l.allow.some((v) => ['all', '*'].includes(v.toLowerCase())));

/** An administrator for CUPS: root, or a member of the SystemGroup (lpadmin on Debian). */
export const isAdmin = (j: Game, user: string) => user === 'root' || (j as Shell).groupsFor(user).includes(SYSTEM_GROUP);

/** The <Limit> of the default policy that covers an operation. */
function limitFor(c: CupsdConf | null, op: string): Limit | null {
  const p = c?.policies[directive(c, 'DefaultPolicy') || 'default'] ?? c?.policies.default;
  if (!p) return null;
  return p.limits.find((l) => l.ops.some((o) => o.toLowerCase() === op.toLowerCase())) ?? p.limits.find((l) => l.ops.some((o) => o.toLowerCase() === 'all')) ?? null;
}

/** Does a Require user list let this user act on a job of this owner? */
function required(j: Game, list: string[] | null, user: string, owner: string): boolean {
  if (!list) return true;
  return list.some((r) => {
    if (r === '@OWNER') return user === owner;
    if (r === '@SYSTEM') return isAdmin(j, user);
    if (r.startsWith('@')) return (j as Shell).groupsFor(user).includes(r.slice(1));
    if (r === 'valid-user') return true;
    return r === user;
  });
}

/** May this user cancel this job (the default policy's Cancel-Job limit)? */
export const mayCancel = (j: Game, user: string, job: Job) => {
  const limit = limitFor(cups(j).conf, 'Cancel-Job');
  return required(j, limit ? limit.require : ['@OWNER', '@SYSTEM'], user, job.user);
};
/** The job attributes hidden from other users (JobPrivateValues). */
export function privateValues(c: CupsdConf | null): string[] {
  const p = c?.policies.default;
  const v = (p?.values.jobprivatevalues ?? 'default').toLowerCase();
  if (v === 'none') return [];
  if (v === 'default' || v === 'all') return ['job-name', 'job-originating-host-name', 'job-originating-user-name', 'phone'];
  return v.split(/[\s,]+/).filter(Boolean);
}
/** May this user see this attribute of another's job? */
export const sees = (j: Game, user: string, job: Job, attribute: string) => user === job.user || isAdmin(j, user) || !privateValues(cups(j).conf).includes(attribute);

// ——— The files ———

function dir(j: Game, path: string): Directory | null {
  const n = j.find(path);
  return n?.type === 'directory' ? n : null;
}
function setFile(j: Game, path: string, file: File) {
  const at = path.lastIndexOf('/');
  const parent = dir(j, path.slice(0, at) || '/');
  if (parent) parent.children[path.slice(at + 1)] = file;
}
const fileSize = (n: Node | null) => (n?.type === 'file' ? (n.size ?? (typeof n.content === 'string' ? n.content.length : 0)) : 0);

/** Appends lines to a log of /var/log/cups, rotating it at MaxLogSize like cupsd (into NAME.O). */
export function appendLog(j: Game, name: 'error_log' | 'access_log' | 'page_log', lines: string[], extraBytes = 0) {
  if (!lines.length && !extraBytes) return;
  const path = `${LOG_DIR}/${name}`;
  const n = j.find(path);
  const max = sizeValue(directive(cups(j).conf, 'MaxLogSize'));
  let file: File = n?.type === 'file' ? n : { type: 'file', content: '', lines: true, owner: 'root', group: 'adm', mode: 'rw-r-----' };
  // cupsd checks the size before it writes: past MaxLogSize, the log becomes NAME.O and a new one starts.
  if (max > 0 && fileSize(file) > max) {
    setFile(j, `${path}.O`, file);
    file = { type: 'file', content: '', lines: true, owner: file.owner, group: file.group, mode: file.mode };
  }
  const text = typeof file.content === 'string' ? file.content : '';
  const added = lines.join('\n');
  const content = text ? (added ? `${text}\n${added}` : text) : added;
  const base = file.size !== undefined ? file.size - text.length : 0;
  file = { ...file, content, ...(base || extraBytes ? { size: base + content.length + extraBytes } : {}) };
  if (file.size !== undefined && file.size === content.length) delete file.size;
  setFile(j, path, file);
}

const LEVEL_CHAR: Record<string, string> = { error: 'E', warn: 'W', notice: 'N', info: 'I', debug: 'D', debug2: 'd' };
/** A line of error_log, if LogLevel lets it through. */
export function log(j: Game, level: 'error' | 'warn' | 'notice' | 'info' | 'debug' | 'debug2', message: string, job?: number) {
  const current = LEVELS.indexOf(directive(cups(j).conf, 'LogLevel').toLowerCase());
  if (LEVELS.indexOf(level) > current) return;
  appendLog(j, 'error_log', [`${LEVEL_CHAR[level]} ${logDate(clock(j))} ${job !== undefined ? `[Job ${job}] ` : ''}${message}`]);
}

/** A line of access_log. */
export function access(j: Game, from: string, method: string, path: string, code: number, op: string, status: string, user = '-') {
  appendLog(j, 'access_log', [`${from} - ${user} ${logDate(clock(j))} "${method} ${path} HTTP/1.1" ${code} ${code === 200 ? 300 + path.length * 7 : 0} ${op} ${status}`]);
}

const spoolName = (id: number) => String(id).padStart(5, '0');
const controlSize = (job: Job) => 900 + job.title.length * 3;

/** Does the spool still hold this job's document (it hasn't been purged, and nobody removed it)? */
export const hasDocument = (j: Game, job: Job) => !!dir(j, SPOOL)?.children[`d${spoolName(job.id)}-001`];

/**
 * Brings the spool in line with cupsd's jobs: a control file per job it
 * remembers, a document while it hasn't printed or for PreserveJobFiles.
 * A document someone removed by hand is not put back: the job has lost it.
 */
export function syncSpool(j: Game) {
  const st = cups(j);
  const spool = dir(j, SPOOL);
  if (!spool) return;
  checkSpool(j);
  for (const job of st.jobs) {
    const c = `c${spoolName(job.id)}`;
    const d = `d${spoolName(job.id)}-001`;
    if (!spool.children[c] && !job.filed) spool.children[c] = { type: 'file', content: '', size: controlSize(job), owner: 'root', group: 'lp', mode: 'rw-------', mtime: job.created };
    if (!job.noFile && !spool.children[d]) spool.children[d] = { type: 'file', content: '', size: job.size, owner: 'root', group: 'lp', mode: 'rw-r-----', mtime: job.created };
    job.filed = true;
    if (job.noFile && spool.children[d] && !job.lost) delete spool.children[d];
  }
  const known = new Set(st.jobs.flatMap((x) => [`c${spoolName(x.id)}`, `d${spoolName(x.id)}-001`]));
  for (const name of Object.keys(spool.children)) if (/^[cd]\d{5}/.test(name) && !known.has(name)) delete spool.children[name];
}

/** The documents removed by hand from the spool since the last look: those jobs have lost them. */
export function checkSpool(j: Game): Job[] {
  const spool = dir(j, SPOOL);
  if (!spool) return [];
  const lost: Job[] = [];
  for (const job of cups(j).jobs)
    if (job.filed && !job.noFile && !spool.children[`d${spoolName(job.id)}-001`]) {
      job.noFile = true;
      job.lost = true;
      lost.push(job);
    }
  return lost;
}

/** The space the spool takes (bytes). */
export const spoolBytes = (j: Game) => Object.values(dir(j, SPOOL)?.children ?? {}).reduce((t, n) => t + fileSize(n), 0);

// ——— printers.conf ———

export const TYPE = (p: Printer) => 8392780 + (p.shared ? 0 : 8) + (p.driver === 'raw' ? 0 : 4);

/** printers.conf as cupsd writes it. */
export function printersText(st: CupsState, at: number): string {
  const lines = [`# Printer configuration file for CUPS v${VERSION}`, `# Written by cupsd`, `# DO NOT EDIT THIS FILE WHEN CUPSD IS RUNNING`, `NextPrinterId ${st.nextPrinter}`];
  for (const p of Object.values(st.printers)) {
    const tag = st.default === p.name ? 'DefaultPrinter' : 'Printer';
    lines.push(
      `<${tag} ${p.name}>`,
      `PrinterId ${p.id}`,
      `UUID urn:uuid:${uuid(p.name)}`,
      `Info ${p.info}`,
      `Location ${p.location}`,
      `MakeModel ${p.makeModel}`,
      `DeviceURI ${p.uri}`,
      `State ${p.state === 'stopped' ? 'Stopped' : 'Idle'}`,
      ...(p.message ? [`StateMessage ${p.message}`] : []),
      `StateTime ${Math.floor(p.stateTime / 1000)}`,
      `ConfigTime ${Math.floor(at / 1000)}`,
      ...(p.state === 'stopped' ? ['Reason paused'] : []),
      `Type ${TYPE(p)}`,
      `Accepting ${p.accepting ? 'Yes' : 'No'}`,
      `Shared ${p.shared ? 'Yes' : 'No'}`,
      'JobSheets none none',
      'QuotaPeriod 0',
      'PageLimit 0',
      'KLimit 0',
      ...(p.allow ?? []).map((u) => `AllowUser ${u}`),
      ...(p.deny ?? []).map((u) => `DenyUser ${u}`),
      'OpPolicy default',
      `ErrorPolicy ${p.errorPolicy ?? directive(st.conf, 'ErrorPolicy')}`,
      `</${tag}>`,
    );
  }
  return lines.join('\n');
}

/** cupsd writes printers.conf (after a change, and when it stops). */
export function writePrinters(j: Game) {
  const st = cups(j);
  const text = printersText(st, clock(j));
  const n = j.find(PRINTERS_CONF);
  setFile(j, PRINTERS_CONF, { ...(n?.type === 'file' ? n : { owner: 'root', group: 'lp', mode: 'rw-------' }), type: 'file', content: text, lines: true });
  st.written = text;
}

/** Has printers.conf been changed since cupsd wrote it? */
export const editedByHand = (j: Game) => (j.read(PRINTERS_CONF) ?? '') !== cups(j).written;

/** Reads printers.conf when cupsd starts: the queues, their state, the default. */
export function readPrinters(j: Game) {
  const st = cups(j);
  const text = j.read(PRINTERS_CONF) ?? '';
  const out: Record<string, Printer> = {};
  let p: Printer | null = null;
  let def: string | null = null;
  for (const raw of text.split('\n')) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const open = /^<(Default)?Printer\s+(\S+)>$/.exec(line);
    if (open) {
      const old = st.printers[open[2]];
      p = { ...(old ?? { ...newPrinter(st, open[2], '', 'raw', ''), stateTime: clock(j), acceptTime: clock(j) }), allow: undefined, deny: undefined };
      if (open[1]) def = open[2];
      continue;
    }
    if (/^<\/(Default)?Printer>$/.test(line)) {
      if (p) out[p.name] = p;
      p = null;
      continue;
    }
    const m = /^(\S+)\s*(.*)$/.exec(line)!;
    if (!p) {
      if (m[1] === 'NextPrinterId') st.nextPrinter = Number(m[2]) || st.nextPrinter;
      continue;
    }
    const v = m[2];
    switch (m[1]) {
      case 'Info': p.info = v; break;
      case 'Location': p.location = v; break;
      case 'MakeModel': p.makeModel = v; break;
      case 'DeviceURI': p.uri = v; break;
      case 'State': p.state = /^stopped$/i.test(v) ? 'stopped' : 'idle'; break;
      case 'StateMessage': p.message = v; break;
      case 'Accepting': p.accepting = /^yes$/i.test(v); break;
      case 'Shared': p.shared = /^yes$/i.test(v); break;
      case 'AllowUser': (p.allow ??= []).push(v); break;
      case 'DenyUser': (p.deny ??= []).push(v); break;
      case 'ErrorPolicy': p.errorPolicy = v; break;
      case 'PrinterId': p.id = Number(v) || p.id; break;
    }
  }
  // A queue without a PPD in /etc/cups/ppd prints raw, whatever its MakeModel says.
  for (const q of Object.values(out)) {
    const ppd = j.find(`/etc/cups/ppd/${q.name}.ppd`);
    if (ppd?.type !== 'file') {
      if (q.driver !== 'raw') log(j, 'warn', `Printer ${q.name} has no PPD file, printing raw.`);
      q.driver = 'raw';
      q.makeModel = 'Local Raw Printer';
    }
  }
  st.printers = out;
  st.default = def && out[def] ? def : null;
}

function uuid(seed: string): string {
  let h = 0x811c9dc5;
  for (const c of `cups-${seed}`) h = Math.imul(h ^ c.charCodeAt(0), 0x01000193) >>> 0;
  const hex = Array.from({ length: 4 }, (_, i) => (((Math.imul(h, i + 7) >>> 0) ^ (h >>> i)) >>> 0).toString(16).padStart(8, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-3${hex.slice(13, 16)}-8${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

export function newPrinter(st: CupsState, name: string, uri: string, driver: string, makeModel: string): Printer {
  return { name, info: name, location: '', uri, makeModel, driver, state: 'stopped', stateTime: 0, message: '', accepting: false, acceptTime: 0, shared: directive(st.conf, 'DefaultShared').toLowerCase() !== 'no', id: st.nextPrinter };
}

/** A queue's PPD file (generated for IPP Everywhere, copied from the model otherwise). */
export function ppdText(p: Printer): string {
  return [
    '*PPD-Adobe: "4.3"',
    `*%%%% PPD file for ${p.makeModel}`,
    `*FormatVersion: "4.3"`,
    `*FileVersion: "${VERSION}"`,
    `*LanguageVersion: English`,
    `*Manufacturer: "${p.makeModel.split(' ')[0]}"`,
    `*ModelName: "${p.makeModel.replace(/ - IPP Everywhere$|, hpcups.*$/, '')}"`,
    `*NickName: "${p.makeModel}"`,
    '*OpenUI *PageSize: PickOne',
    '*DefaultPageSize: A4',
    '*CloseUI: *PageSize',
    '*OpenUI *Duplex: PickOne',
    '*DefaultDuplex: None',
    '*CloseUI: *Duplex',
  ].join('\n');
}

// ——— Devices ———

/** The host part of a URI (ipp://host:631/path, socket://host:9100, dnssd://Name._ipp._tcp.local/). */
export function uriHost(uri: string): string | null {
  const m = /^[a-z]+:\/\/([^/:?]+)/i.exec(uri);
  return m ? decodeURIComponent(m[1]).toLowerCase() : null;
}
export const uriScheme = (uri: string) => (/^([a-z]+):/i.exec(uri)?.[1] ?? '').toLowerCase();

/** The device a URI points to (by its name, address or DNS-SD name). */
export function deviceFor(st: CupsState, uri: string): Device | null {
  const host = uriHost(uri)?.replace(/\._(ipps?|pdl-datastream|printer)\._tcp\.local\.?$/, '');
  if (!host) return null;
  return st.devices.find((d) => d.address === host || d.names.some((n) => n.toLowerCase() === host) || d.dnssd?.toLowerCase() === host) ?? null;
}

/** The models lpinfo -m lists (those of installed packages). */
export const models = (j: Game): Model[] => cups(j).models.filter((m) => !m.file || !!j.find(m.file));

// ——— Jobs ———

/** Jobs not finished, in order: the first of an enabled queue prints. */
export const active = (st: CupsState, printer?: string) => st.jobs.filter((x) => !FINISHED.includes(x.state) && (!printer || x.printer === printer));

/** A job ends: its time, its document kept or not (PreserveJobFiles), page_log. */
export function finish(j: Game, job: Job, state: 'completed' | 'canceled' | 'aborted', purge = false) {
  const st = cups(j);
  job.state = state;
  job.completed = clock(j);
  const p = st.printers[job.printer];
  if (p && p.state === 'processing' && !active(st, p.name).some((x) => x.state === 'processing')) {
    p.state = 'idle';
    p.stateTime = clock(j);
  }
  if (state === 'completed' || job.printed > 0)
    appendLog(j, 'page_log', [`${job.printer} ${job.user} ${job.id} ${logDate(clock(j))} total ${job.printed || job.pages} - ${job.host} ${job.title} A4 one-sided`]);
  if (purge || timeValue(directive(st.conf, 'PreserveJobFiles')) === 0) job.noFile = true;
  syncSpool(j);
}

/** cupsd forgets what PreserveJobHistory and PreserveJobFiles no longer keep (at start, and as time passes). */
export function purgeExpired(j: Game) {
  const st = cups(j);
  const now = clock(j);
  const history = timeValue(directive(st.conf, 'PreserveJobHistory'));
  const files = timeValue(directive(st.conf, 'PreserveJobFiles'));
  for (const job of st.jobs) if (job.completed !== undefined && now - job.completed >= files && !job.noFile) job.noFile = true;
  st.jobs = st.jobs.filter((job) => job.completed === undefined || now - job.completed < history);
  syncSpool(j);
}

/** Time passes for the printers: each enabled queue prints its first job at the device's speed. */
export function advance(j: Game, ms: number) {
  const st = cups(j);
  if (!running(j)) return;
  for (const p of Object.values(st.printers)) {
    if (p.state === 'stopped') continue;
    let budget = ((deviceFor(st, p.uri)?.ppm ?? 20) * ms) / 60_000;
    for (const job of active(st, p.name)) {
      if (job.state === 'held') continue;
      if (budget <= 0) break;
      if (job.noFile) {
        log(j, 'error', 'Aborting job because it has no files.', job.id);
        finish(j, job, 'aborted');
        continue;
      }
      const device = deviceFor(st, p.uri);
      if (!device?.online) {
        log(j, 'info', 'Unable to connect to printer; will retry in 30 seconds...', job.id);
        break;
      }
      if (job.state !== 'processing') {
        job.state = 'processing';
        p.state = 'processing';
        p.stateTime = clock(j);
        log(j, 'info', `Started backend /usr/lib/cups/backend/${uriScheme(p.uri)} (PID ${3100 + job.id})`, job.id);
      }
      const n = Math.min(budget, job.pages - job.printed);
      job.printed += n;
      budget -= n;
      if (job.printed >= job.pages - 1e-9) {
        job.printed = job.pages;
        log(j, 'info', 'Job completed.', job.id);
        finish(j, job, 'completed');
      }
    }
  }
  purgeExpired(j);
}

export interface Submission {
  from: string;
  user: string;
  printer: string;
  title: string;
  pages: number;
  size: number;
  host?: string;
}

/** What cupsd would answer to a print request, without queuing it: null if accepted. */
export function verdict(j: Game, s: Pick<Submission, 'from' | 'user' | 'printer'>): { status: string; code: number; message: string } | null {
  const st = cups(j);
  const path = `/printers/${s.printer}`;
  const local = isLocalhost(s.from);
  if (!running(j) || !st.conf) return { status: 'unreachable', code: 0, message: 'Connection refused' };
  if (!local && !reaches(j, s.from, path)) return { status: 'client-error-forbidden', code: 403, message: 'Forbidden' };
  const p = st.printers[s.printer];
  if (!p) return { status: 'client-error-not-found', code: 200, message: 'The printer or class does not exist.' };
  if (!local && !p.shared) return { status: 'client-error-not-possible', code: 200, message: 'The printer or class is not shared.' };
  if (!p.accepting) return { status: 'server-error-not-accepting-jobs', code: 200, message: `Destination "${p.name}" is not accepting jobs.` };
  const member = (u: string) => (u.startsWith('@') ? (j as Shell).groupsFor(s.user).includes(u.slice(1)) : u === s.user);
  if ((p.allow?.length && !p.allow.some(member)) || p.deny?.some(member)) return { status: 'client-error-not-authorized', code: 200, message: 'You are not allowed to print to this printer.' };
  return null;
}

/** A print request (Print-Job): checked like cupsd, then queued. Returns the job, or the IPP status refused. */
export function submit(j: Game, s: Submission): { job: Job } | { status: string; code: number; message: string } {
  const st = cups(j);
  const path = `/printers/${s.printer}`;
  const local = isLocalhost(s.from);
  const refused = verdict(j, s);
  if (refused) {
    if (refused.code === 0) return refused;
    if (refused.status === 'client-error-not-authorized') log(j, 'info', `Denying user "${s.user}" access to printer "${s.printer}"...`);
    if (refused.code === 200) log(j, 'error', `Returning IPP ${refused.status} for Print-Job (ipp://localhost${path}) from ${s.from}.`);
    access(j, s.from, 'POST', path, refused.code, refused.code === 200 ? 'Print-Job' : '-', refused.code === 200 ? refused.status : '-', refused.code === 200 ? s.user : '-');
    return refused;
  }
  const p = st.printers[s.printer];
  const job: Job = { id: st.nextJob++, printer: p.name, user: s.user, title: s.title, size: s.size, pages: s.pages, printed: 0, state: 'pending', host: s.host ?? (local ? 'localhost' : s.from), created: clock(j) };
  st.jobs.push(job);
  log(j, 'info', `Queued on "${p.name}" by "${s.user}".`, job.id);
  log(j, 'debug2', `job-name="${s.title}" job-originating-user-name="${s.user}" job-originating-host-name="${job.host}"`, job.id);
  access(j, local ? 'localhost' : s.from, 'POST', path, 200, 'Print-Job', 'successful-ok', s.user);
  syncSpool(j);
  return { job };
}

// ——— The scheduler starting and stopping ———

/** cupsd -t: the configuration's errors (fatal) and warnings. */
export function testConf(j: Game): CupsdConf {
  return parseConf(j.read(CUPSD_CONF) ?? '');
}

/** What cupsd writes to the journal when it can't start (null: it starts). */
export function startErrors(j: Game): string[] | null {
  const c = testConf(j);
  return c.errors.length ? c.errors : null;
}

/** cupsd starts: it reads cupsd.conf and printers.conf, then forgets the expired jobs. */
export function startCupsd(j: Game) {
  const st = cups(j);
  const c = testConf(j);
  st.conf = c;
  st.confText = j.read(CUPSD_CONF) ?? '';
  for (const w of c.warnings) log(j, 'error', w);
  readPrinters(j);
  // A job whose control file is gone is forgotten.
  const spool = dir(j, SPOOL);
  if (spool)
    st.jobs = st.jobs.filter((job) => {
      if (spool.children[`c${spoolName(job.id)}`]) return true;
      log(j, 'error', `Unable to open job control file "${SPOOL}/c${spoolName(job.id)}" - No such file or directory!`, job.id);
      return false;
    });
  for (const job of st.jobs) if (job.state === 'processing') job.state = 'pending';
  for (const p of Object.values(st.printers)) if (p.state === 'processing') p.state = 'idle';
  purgeExpired(j);
  log(j, 'info', `Listening to ${c.listen.join(', ') || 'nothing'}`);
  writePrinters(j);
}

/** cupsd stops: it writes its queues to printers.conf (a hand edit made meanwhile is lost). */
export function stopCupsd(j: Game) {
  log(j, 'info', 'Scheduler shutting down normally.');
  for (const job of cups(j).jobs) if (job.state === 'processing') job.state = 'pending';
  writePrinters(j);
}

/** Hooks the cups service to the model (call from the chapter's initialise). */
export function attach(j: Game) {
  const sd = systemd(j);
  const s = sd?.services.cups;
  if (!s) return;
  s.check = (g) => startErrors(g);
  s.load = (g) => startCupsd(g);
  s.stop = (g) => stopCupsd(g);
  // Debian 13's cups.service (cups 2.4.10, scheduler/cups.service.in) has no ExecReload=:
  // systemctl reload cups is refused; a restart rereads the files.
  s.noReload = true;
}

// ——— cupsd.conf edited like cupsctl ———

/** A top-level directive set (or added) in cupsd.conf's text. */
export function setDirective(text: string, name: string, value: string | null): string {
  const lines = text.split('\n');
  let depth = 0;
  let done = false;
  const out: string[] = [];
  for (const l of lines) {
    const t = l.trim();
    if (/^<\//.test(t)) depth--;
    else if (/^<\w/.test(t)) depth++;
    if (depth === 0 && !/^<\//.test(t) && new RegExp(`^${name}(\\s|$)`, 'i').test(t)) {
      if (!done && value !== null) out.push(`${name} ${value}`.trimEnd());
      done = true;
      continue;
    }
    out.push(l);
  }
  if (!done && value !== null) {
    const at = out.findIndex((l) => /^\s*</.test(l));
    out.splice(at < 0 ? out.length : at, 0, `${name} ${value}`.trimEnd());
  }
  return out.join('\n');
}

/** Changes the lines of a <Location> (adds the block if missing). */
export function editLocation(text: string, path: string, change: (body: string[]) => string[]): string {
  const lines = text.split('\n');
  const start = lines.findIndex((l) => new RegExp(`^\\s*<Location\\s+${path.replace(/[/]/g, '\\/')}\\s*>`, 'i').test(l));
  if (start < 0) return `${text}\n<Location ${path}>\n${change(['  Order allow,deny']).join('\n')}\n</Location>`;
  const end = lines.findIndex((l, i) => i > start && /^\s*<\/Location>/i.test(l));
  const body = change(lines.slice(start + 1, end));
  return [...lines.slice(0, start + 1), ...body, ...lines.slice(end)].join('\n');
}

/** The Require line of the default policy's Cancel-Job limit. */
export function editCancelLimit(text: string, require: string | null): string {
  const lines = text.split('\n');
  const policy = lines.findIndex((l) => /^\s*<Policy\s+default\s*>/i.test(l));
  if (policy < 0) return text;
  const start = lines.findIndex((l, i) => i > policy && /^\s*<Limit\s+[^>]*\bCancel-Job\b/i.test(l));
  if (start < 0) return text;
  const end = lines.findIndex((l, i) => i > start && /^\s*<\/Limit>/i.test(l));
  const body = lines.slice(start + 1, end).filter((l) => !/^\s*Require\s/i.test(l));
  if (require) body.unshift(`    Require user ${require}`);
  return [...lines.slice(0, start + 1), ...body, ...lines.slice(end)].join('\n');
}

/** A value of <Policy default> (JobPrivateValues, JobPrivateAccess), as cupsctl sets it. */
export function editPolicyValue(text: string, name: string, value: string): string {
  const lines = text.split('\n');
  const policy = lines.findIndex((l) => /^\s*<Policy\s+default\s*>/i.test(l));
  if (policy < 0) return text;
  const end = lines.findIndex((l, i) => i > policy && /^\s*<\/Policy>/i.test(l));
  const at = lines.findIndex((l, i) => i > policy && i < end && new RegExp(`^\\s*${name}\\s`, 'i').test(l));
  if (at >= 0) lines[at] = `  ${name} ${value}`;
  else lines.splice(policy + 1, 0, `  ${name} ${value}`);
  return lines.join('\n');
}

/** Is the running configuration the file's (no change waiting for a restart)? */
export const confApplied = (j: Game) => running(j) && cups(j).confText === (j.read(CUPSD_CONF) ?? '');
