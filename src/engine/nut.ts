// Network UPS Tools as Debian 13 ("trixie") ships it: NUT 2.8.1
// (nut-server, nut-client 2.8.1-5+deb13u1, https://packages.debian.org/trixie/nut-server),
// and the power behind it: one UPS, the machines it feeds, their firmware.
//
//   principal.state.power = the physical world: the mains, the UPS (its
//                           battery, its output, its kill timers, its self
//                           test), each machine it feeds (load, power state,
//                           power restore policy, halting and booting)
//   state.nut             = on each machine: what its NUT daemons loaded and
//                           do (driver, upsd, upsmon, upssched's timers)
//
// - The configuration files, read like NUT's parseconf (words, quotes, #
//   comments): ups.conf ([section], driver, port, desc, offdelay, ondelay),
//   upsd.conf (LISTEN, read only at startup), upsd.users ([user], password,
//   actions, instcmds, upsmon primary|secondary), upsmon.conf (MONITOR,
//   MINSUPPLIES, SHUTDOWNCMD, NOTIFYCMD, NOTIFYFLAG, NOTIFYMSG, POLLFREQ,
//   POLLFREQALERT, HOSTSYNC, DEADTIME, FINALDELAY, POWERDOWNFLAG,
//   RBWARNTIME), upssched.conf (CMDSCRIPT, PIPEFN, LOCKFN, AT … START-TIMER,
//   CANCEL-TIMER, EXECUTE). https://networkupstools.org/docs/man/ups.conf.html,
//   upsd.conf.html, upsd.users.html, upsmon.conf.html, upssched.conf.html
// - The services: nut-driver@NAME (upsdrvctl start NAME), nut-server (upsd),
//   nut-monitor (upsmon), as the units of NUT 2.8.1 (scripts/systemd/).
// - upsd answers its clients (upsc, upscmd, upsrw, upsmon) with the
//   protocol's errors (UNKNOWN-UPS, ACCESS-DENIED, DRIVER-NOT-CONNECTED,
//   READONLY…) and logins (NUMLOGINS); the UPS's variables are those of
//   usbhid-ups with its APC HID subdriver (drivers/apc-hid.c).
// - upsmon: its poll loop, its notifications (the default messages of
//   clients/upsmon.h, SYSLOG, WALL, EXEC), when a UPS is critical
//   (is_ups_critical: FSD, OB+LB, and HOSTSYNC for a secondary), MINSUPPLIES,
//   the primary's forced shutdown (FSD on upsd, waiting for the secondaries
//   to log out up to HOSTSYNC, FINALDELAY, POWERDOWNFLAG, SHUTDOWNCMD) and
//   the end of the halt (nutshutdown: upsmon -K, upsdrvctl shutdown: the UPS
//   cuts its output after offdelay and gives it back after ondelay,
//   shutdown.return). Messages from clients/upsmon.c (v2.8.1).
// - upssched: its timers, started and cancelled by the AT lines, CMDSCRIPT
//   run with the timer's name.
// - The machines: a halt takes its time; power lost while running or
//   halting is a crash; when power comes back, the firmware's power restore
//   policy decides (always-on, previous, always-off; ipmitool chassis
//   policy).
// Simplifications: see docs/SCENARIOS.md (NUT): one UPS on USB; time
// passes in steps of one second; a halt is a fixed duration per machine.

import type { Game, Shell } from './shell';
import { systemd, writeLog, start, stop, type Systemd } from './systemd';
import type { Process } from './commands/system';
import { verdict, type Firewall } from './firewall';
import { runScript } from './script';

export const VERSION = '2.8.1';
export const PORT = 3493;
export const ETC = '/etc/nut';

// ——— The physical world ———

export type Policy = 'always-on' | 'previous' | 'always-off';

export interface Powered {
  // On the UPS's output.
  fed: boolean;
  load: number;
  state: 'on' | 'halting' | 'off' | 'booting';
  until: number;
  haltSeconds: number;
  bootSeconds: number;
  policy: Policy;
  // Running when the power went (for the "previous" policy).
  wasOn: boolean;
  lastEvent: string;
  // The BMC's event log (ipmitool sel list).
  sel: { time: number; sensor: string; event: string }[];
}

export interface Ups {
  output: boolean;
  charge: number;
  // What is left of the battery's capacity (1: new).
  health: number;
  // Seconds of runtime at full load (900 W) with a new, full battery.
  capacity: number;
  realpower: number;
  chargeLow: number;
  runtimeLow: number;
  mfrDate: string;
  replace: boolean;
  test: { kind: 'quick' | 'deep'; started: number } | null;
  testResult: string;
  // When the last test ended, and how.
  tests: { kind: 'quick' | 'deep'; started: number; ended: number; result: string }[];
  // The kill power command (upsdrvctl shutdown): when the output goes off, and when it comes back.
  offAt: number | null;
  onAt: number | null;
  beeper: 'enabled' | 'disabled' | 'muted';
  // The output was cut by an empty battery: it comes back with the mains.
  depleted?: boolean;
  sensitivity: string;
  transferLow: number;
  transferHigh: number;
}

export interface PowerWorld {
  clock: number;
  mains: boolean;
  voltage: number;
  ups: Ups;
  hosts: Record<string, Powered>;
  // What else the UPS feeds (the switch, the router), in watts.
  extra?: number;
  // Mains interruptions to come (story: a breaker, a flickering line).
  cuts: { from: number; to: number }[];
  // What happened, for the stories' checks.
  history: { time: number; host: string; what: 'halted' | 'crash-running' | 'crash-halting' | 'booted' | 'button' | 'kill' | 'ups-off' | 'ups-on' }[];
  // The machine's shells, by name (set by the story).
  shells?: Record<string, () => Shell | null>;
  wall?: { host: string; text: string; time?: number }[];
}

export const power = (j: Game): PowerWorld => (j as Shell).principal.state.power as PowerWorld;

/** Load in percent of the UPS's real power. */
export function loadPercent(w: PowerWorld): number {
  if (!w.ups.output) return 0;
  const watts = (w.extra ?? 0) + Object.values(w.hosts).filter((h) => h.fed && h.state !== 'off').reduce((s, h) => s + h.load, 0);
  return Math.round((watts / w.ups.realpower) * 100);
}

/** battery.runtime: seconds at the present load (Peukert-ish: less load, longer). */
export function runtime(w: PowerWorld): number {
  const load = Math.max(loadPercent(w), 5) / 100;
  return Math.round(((w.ups.capacity * w.ups.health * w.ups.charge) / 100 / load) * (load < 0.5 ? 1.15 : 1));
}

const onBattery = (w: PowerWorld) => w.ups.output && (!w.mains || w.ups.test?.kind === 'deep');
const lowBattery = (w: PowerWorld) => onBattery(w) && (w.ups.charge <= w.ups.chargeLow || runtime(w) <= w.ups.runtimeLow);

/** ups.status as the driver writes it (usbhid-ups: CAL, OL/OB, DISCHRG, CHRG, LB, RB). */
export function deviceStatus(w: PowerWorld): string[] {
  const s: string[] = [];
  if (w.ups.test?.kind === 'deep') s.push('CAL');
  s.push(onBattery(w) ? 'OB' : 'OL');
  if (onBattery(w)) s.push('DISCHRG');
  else if (w.ups.charge < 100) s.push('CHRG');
  if (lowBattery(w)) s.push('LB');
  if (w.ups.replace) s.push('RB');
  return s;
}

// ——— Configuration files (parseconf) ———

/** A line's words, like NUT's parseconf: spaces separate, "quotes" group, \ escapes, # starts a comment. */
export function words(line: string): string[] {
  const out: string[] = [];
  let cur = '';
  let inWord = false;
  let quote = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '\\' && i + 1 < line.length) {
      cur += line[++i];
      inWord = true;
    } else if (c === '"') {
      quote = !quote;
      inWord = true;
    } else if (!quote && c === '#') break;
    else if (!quote && /\s/.test(c)) {
      if (inWord) out.push(cur);
      cur = '';
      inWord = false;
    } else {
      cur += c;
      inWord = true;
    }
  }
  if (inWord) out.push(cur);
  return out;
}

const lines = (text: string | null) => (text ?? '').split('\n').map((l, i) => ({ w: words(l), n: i + 1 })).filter((l) => l.w.length);

export interface UpsSection {
  name: string;
  driver?: string;
  port?: string;
  desc?: string;
  offdelay?: number;
  ondelay?: number;
  options: Record<string, string>;
}

/** ups.conf: [name] sections, key = value. */
export function readUpsConf(text: string | null): Record<string, UpsSection> {
  const out: Record<string, UpsSection> = {};
  let cur: UpsSection | null = null;
  for (const { w } of lines(text)) {
    const head = /^\[(.+)\]$/.exec(w.join(' '));
    if (head) {
      cur = out[head[1]] = { name: head[1], options: {} };
      continue;
    }
    if (!cur) continue;
    const [k, eq, ...v] = w;
    const value = eq === '=' ? v.join(' ') : eq?.startsWith('=') ? [eq.slice(1), ...v].join(' ') : 'true';
    const key = k.includes('=') ? k.split('=')[0] : k;
    const val = k.includes('=') ? k.split('=').slice(1).join('=') : value;
    cur.options[key] = val;
    if (key === 'driver') cur.driver = val;
    if (key === 'port') cur.port = val;
    if (key === 'desc') cur.desc = val;
    if (key === 'offdelay') cur.offdelay = Number(val);
    if (key === 'ondelay') cur.ondelay = Number(val);
  }
  return out;
}

export interface NutUser {
  password?: string;
  actions: string[];
  instcmds: string[];
  upsmon?: 'primary' | 'secondary';
}

/** upsd.users: [user] sections; actions and instcmds accumulate. */
export function readUsers(text: string | null): { users: Record<string, NutUser>; warnings: string[] } {
  const users: Record<string, NutUser> = {};
  const warnings: string[] = [];
  let cur: NutUser | null = null;
  for (const { w } of lines(text)) {
    const head = /^\[(.+)\]$/.exec(w.join(' '));
    if (head) {
      cur = users[head[1]] = { actions: [], instcmds: [] };
      continue;
    }
    const key = w[0].toLowerCase();
    const rest = (w[1] === '=' ? w.slice(2) : w.slice(1)).flatMap((x) => x.split(/[\s,]+/)).filter(Boolean);
    if (!cur) {
      if (key === 'password') warnings.push('Ignoring password definition outside user section');
      continue;
    }
    if (key === 'password') cur.password = rest.join(' ');
    else if (key === 'actions') cur.actions.push(...rest.map((x) => x.toUpperCase()));
    else if (key === 'instcmds') cur.instcmds.push(...rest);
    else if (key === 'upsmon') {
      const t = rest[0]?.toLowerCase();
      if (t === 'primary' || t === 'master') cur.upsmon = 'primary';
      else if (t === 'secondary' || t === 'slave') cur.upsmon = 'secondary';
      else warnings.push(`Unknown upsmon type ${rest[0] ?? ''}`);
    } else if (key === 'allowfrom') warnings.push('allowfrom in upsd.users is no longer used');
    else warnings.push(`Unrecognized user setting ${w[0]}`);
  }
  return { users, warnings };
}

/** upsd.conf: LISTEN address [port] (and the warnings of directives no longer supported). */
export function readUpsdConf(text: string | null): { listen: { address: string; port: number }[]; warnings: string[] } {
  const listen: { address: string; port: number }[] = [];
  const warnings: string[] = [];
  for (const { w } of lines(text)) {
    const k = w[0].toUpperCase();
    if (k === 'LISTEN' && w[1]) listen.push({ address: w[1], port: Number(w[2] ?? PORT) });
    else if (k === 'ACCEPT' || k === 'REJECT' || k === 'ACL') warnings.push(`${k} in upsd.conf is no longer supported - switch to LISTEN`);
  }
  return { listen, warnings };
}

export interface Monitor {
  sys: string;
  upsname: string;
  host: string;
  port: number;
  pv: number;
  user: string;
  pass: string;
  primary: boolean;
}

export interface MonConf {
  monitors: Monitor[];
  minsupplies: number;
  shutdowncmd: string | null;
  notifycmd: string | null;
  flags: Record<string, string[]>;
  messages: Record<string, string>;
  pollfreq: number;
  pollfreqalert: number;
  hostsync: number;
  deadtime: number;
  finaldelay: number;
  powerdownflag: string | null;
  rbwarntime: number;
  // POLLFAIL_LOG_THROTTLE_MAX: -1 logs every failed poll, 0 only changes, N every N polls.
  throttle: number;
  warnings: string[];
}

export const NOTIFY_TYPES = ['ONLINE', 'ONBATT', 'LOWBATT', 'FSD', 'COMMOK', 'COMMBAD', 'SHUTDOWN', 'REPLBATT', 'NOCOMM', 'NOPARENT', 'CAL', 'OFF', 'NOTOFF', 'BYPASS', 'NOTBYPASS'];
// clients/upsmon.h: the default messages.
export const DEFAULT_MESSAGES: Record<string, string> = {
  ONLINE: 'UPS %s on line power',
  ONBATT: 'UPS %s on battery',
  LOWBATT: 'UPS %s battery is low',
  FSD: 'UPS %s: forced shutdown in progress',
  COMMOK: 'Communications with UPS %s established',
  COMMBAD: 'Communications with UPS %s lost',
  SHUTDOWN: 'Auto logout and shutdown proceeding',
  REPLBATT: 'UPS %s battery needs to be replaced',
  NOCOMM: 'UPS %s is unavailable',
  NOPARENT: 'upsmon parent process died - shutdown impossible',
  CAL: 'UPS %s: calibration in progress',
};

/** Splits upsname[@hostname[:port]]. */
export function splitName(sys: string): { upsname: string; host: string; port: number } {
  const [upsname, rest] = sys.split('@');
  const [host, port] = (rest ?? 'localhost').split(':');
  return { upsname, host: host || 'localhost', port: Number(port ?? PORT) };
}

/** upsmon.conf. */
export function readMonConf(text: string | null, file = `${ETC}/upsmon.conf`): MonConf {
  const c: MonConf = {
    monitors: [],
    minsupplies: 1,
    shutdowncmd: null,
    notifycmd: null,
    flags: {},
    messages: {},
    pollfreq: 5,
    pollfreqalert: 5,
    hostsync: 15,
    deadtime: 15,
    finaldelay: 5,
    powerdownflag: null,
    rbwarntime: 43200,
    throttle: -1,
    warnings: [],
  };
  for (const { w } of lines(text)) {
    const k = w[0].toUpperCase();
    const num = (d: number) => (Number.isFinite(Number(w[1])) ? Number(w[1]) : d);
    if (k === 'MONITOR') {
      if (w.length < 6) {
        c.warnings.push(`Ignoring invalid MONITOR line in ${file}!`, 'MONITOR configuration directives require five arguments.');
        continue;
      }
      const pv = Number(w[2]);
      const type = w[5].toLowerCase();
      const n = splitName(w[1]);
      if (c.monitors.some((m) => m.sys === w[1])) {
        c.warnings.push(`Warning: ignoring duplicate UPS [${w[1]}]`);
        continue;
      }
      c.monitors.push({ sys: w[1], ...n, pv: Number.isFinite(pv) && pv >= 0 ? pv : 0, user: w[3], pass: w[4], primary: type === 'primary' || type === 'master' });
    } else if (k === 'MINSUPPLIES') c.minsupplies = num(1);
    else if (k === 'SHUTDOWNCMD') c.shutdowncmd = w[1] ?? null;
    else if (k === 'NOTIFYCMD') c.notifycmd = w[1] ?? null;
    else if (k === 'NOTIFYFLAG' && w[1]) {
      const t = w[1].toUpperCase();
      if (!NOTIFY_TYPES.includes(t)) c.warnings.push(`'${w[1]}' is not a valid notify event name`);
      else c.flags[t] = (w[2] ?? '').split('+').map((x) => x.toUpperCase()).filter(Boolean);
    } else if (k === 'NOTIFYMSG' && w[1]) c.messages[w[1].toUpperCase()] = w[2] ?? '';
    else if (k === 'POLLFREQ') c.pollfreq = num(5);
    else if (k === 'POLLFREQALERT') c.pollfreqalert = num(5);
    else if (k === 'HOSTSYNC') c.hostsync = num(15);
    else if (k === 'DEADTIME') c.deadtime = num(15);
    else if (k === 'FINALDELAY') c.finaldelay = num(5);
    else if (k === 'POWERDOWNFLAG') c.powerdownflag = w[1] ?? null;
    else if (k === 'RBWARNTIME') c.rbwarntime = num(43200);
    else if (k === 'POLLFAIL_LOG_THROTTLE_MAX') c.throttle = num(-1);
  }
  return c;
}

export interface Sched {
  cmdscript: string | null;
  ats: { type: string; ups: string; cmd: string; args: string[] }[];
  error: string | null;
}

/** upssched.conf: CMDSCRIPT, PIPEFN and LOCKFN must come before the first AT. */
export function readSched(text: string | null): Sched {
  const s: Sched = { cmdscript: null, ats: [], error: null };
  let pipe = false;
  let lock = false;
  for (const { w } of lines(text)) {
    const k = w[0].toUpperCase();
    if (k === 'CMDSCRIPT') s.cmdscript = w[1] ?? null;
    else if (k === 'PIPEFN') pipe = true;
    else if (k === 'LOCKFN') lock = true;
    else if (k === 'AT') {
      if (!s.cmdscript) s.error ??= 'CMDSCRIPT must be set before any ATs in the config file!';
      else if (!pipe) s.error ??= 'PIPEFN must be set before any ATs in the config file!';
      else if (!lock) s.error ??= 'LOCKFN must be set before any ATs in the config file!';
      if (w.length >= 4) s.ats.push({ type: w[1].toUpperCase(), ups: w[2], cmd: w[3].toUpperCase(), args: w.slice(4) });
    }
  }
  return s;
}

// ——— Each machine's NUT ———

export interface Login {
  user: string;
  from: string;
  ups: string;
  primary: boolean;
}

export interface MonState extends Monitor {
  granted: boolean;
  loggedIn: boolean;
  // -1: never tried; 0: failing; 1: talking.
  comm: -1 | 0 | 1;
  line: -1 | 0 | 1;
  flags: string[];
  lastPoll: number;
  lastNonCrit: number;
  lastRb: number;
  failure: string | null;
  failState: number;
  // The last login error logged (logged once), and whether "assuming dead" was.
  loginError?: string;
  deadLogged?: boolean;
  failCount?: number;
}

export interface NutState {
  // Which ups.conf sections have a running driver (and the offdelay/ondelay it started with).
  drivers: Record<string, { offdelay: number; ondelay: number }>;
  upsd: null | { listen: { address: string; port: number }[]; sections: Record<string, UpsSection>; users: Record<string, NutUser>; fsd: string[]; logins: Login[] };
  upsmon: null | {
    conf: MonConf;
    mons: MonState[];
    // upsmon -c fsd received; then the forced shutdown's steps.
    fsdRequested?: boolean;
    phase?: { step: 'sync' | 'final'; since: number };
  };
  timers: { name: string; at: number }[];
  // Pids of the daemons (for the journal).
  pids: { driver: number; upsd: number; upsmon: number; sched: number };
}

export const nut = (j: Game): NutState => (j.state.nut ??= { drivers: {}, upsd: null, upsmon: null, timers: [], pids: { driver: 1210, upsd: 1225, upsmon: 1240, sched: 1302 } }) as NutState;
export const hasNut = (j: Game) => !!j.state.nut;

const sd = (j: Game) => systemd(j) as Systemd;
const hostName = (j: Game) => sd(j).host;
const pw = (j: Game) => power(j);

/** A line in a machine's journal, at the world's time. */
export function log(j: Game, unit: string, ident: string, pid: number, message: string, priority = 6) {
  const s = sd(j);
  if (!s) return;
  s.clock = Math.max(s.clock, pw(j).clock);
  s.log.push({ time: s.clock, boot: s.boot, unit, ident, pid, message, priority });
}

const read = (j: Game, file: string) => (j as Shell).read(file);
export const upsConf = (j: Game) => readUpsConf(read(j, `${ETC}/ups.conf`));
export const driverUnit = (name: string) => `nut-driver@${name}`;

// ——— The services ———

/** The driver's unit for a section: its checks at start (the unit's ExecStart and the driver's own). */
function driverErrors(j: Game, name: string): string[] | null {
  const sec = upsConf(j)[name];
  if (!sec) return [`FATAL: Could not find a NUT device section for service unit ${name}`];
  if (sec.driver !== 'usbhid-ups') return ['Network UPS Tools - UPS driver controller 2.8.1', `Can't start /usr/lib/nut/${sec.driver ?? 'NONE'}: No such file or directory`];
  if (sec.port !== 'auto' && sec.port !== undefined) return ['Network UPS Tools - Generic HID driver 0.52 (2.8.1)', 'USB communication driver (libusb 1.0) 0.46', 'No matching HID UPS found', 'Driver failed to start (exit status=1)'];
  // Another section already holds the USB device.
  const other = Object.keys(nut(j).drivers).find((n) => n !== name);
  if (other) return ['Network UPS Tools - Generic HID driver 0.52 (2.8.1)', 'USB communication driver (libusb 1.0) 0.46', "libusb1: Could not open any HID devices: insufficient permissions on everything", 'No matching HID UPS found', 'Driver failed to start (exit status=1)'];
  return null;
}

function startDriver(j: Game, name: string) {
  const sec = upsConf(j)[name];
  if (!sec) return;
  nut(j).drivers[name] = { offdelay: sec.offdelay ?? 20, ondelay: sec.ondelay ?? 30 };
  const unit = `${driverUnit(name)}.service`;
  const pid = nut(j).pids.driver;
  for (const m of ['Network UPS Tools - Generic HID driver 0.52 (2.8.1)', 'USB communication driver (libusb 1.0) 0.46', 'Using subdriver: APC HID 0.100', 'Network UPS Tools - UPS driver controller 2.8.1'])
    log(j, unit, driverUnit(name), pid, m);
}

/** upsd's checks at start: its sections, its listening addresses. */
function upsdErrors(j: Game): string[] | null {
  const sections = upsConf(j);
  if (!Object.keys(sections).length) return ['Network UPS Tools upsd 2.8.1', 'Fatal error: at least one UPS must be defined in ups.conf'];
  const { listen } = readUpsdConf(read(j, `${ETC}/upsd.conf`));
  const addrs = listen.length ? listen : [{ address: '127.0.0.1', port: PORT }];
  const mine = addresses(j);
  const ok = addrs.filter((a) => a.address === '0.0.0.0' || a.address === '::' || a.address === '*' || a.address === '::1' || mine.includes(a.address));
  if (!ok.length) return ['Network UPS Tools upsd 2.8.1', ...addrs.map((a) => `not listening on ${a.address} port ${a.port}`), 'no listening interface available'];
  return null;
}

/** The machine's own IPv4 addresses (its interfaces). */
export function addresses(j: Game): string[] {
  const lan = (j.state.baseLan ?? j.state.lan) as { interfaces: Record<string, { addresses: string[] }> } | undefined;
  return ['127.0.0.1', ...Object.values(lan?.interfaces ?? {}).flatMap((i) => i.addresses.map((a) => a.split('/')[0]))];
}

function startUpsd(j: Game) {
  const n = nut(j);
  const { listen, warnings } = readUpsdConf(read(j, `${ETC}/upsd.conf`));
  const addrs = listen.length ? listen : [{ address: '127.0.0.1', port: PORT }, { address: '::1', port: PORT }];
  const mine = addresses(j);
  const unit = 'nut-server.service';
  const pid = n.pids.upsd;
  log(j, unit, 'nut-server', pid, 'Network UPS Tools upsd 2.8.1');
  for (const w of warnings) log(j, unit, 'nut-server', pid, w, 4);
  const good: { address: string; port: number }[] = [];
  for (const a of addrs) {
    if (a.address === '0.0.0.0' || a.address === '::' || a.address === '::1' || mine.includes(a.address)) {
      good.push(a);
      log(j, unit, 'nut-server', pid, `listening on ${a.address} port ${a.port}`);
    } else if (a.address === '*') {
      good.push({ address: '0.0.0.0', port: a.port }, { address: '::', port: a.port });
      log(j, unit, 'nut-server', pid, `listening on :: port ${a.port}`);
      log(j, unit, 'nut-server', pid, `listening on 0.0.0.0 port ${a.port}`);
    } else log(j, unit, 'nut-server', pid, `not listening on ${a.address} port ${a.port}`, 3);
  }
  n.upsd = { listen: good, sections: {}, users: {}, fsd: [], logins: [] };
  loadUpsd(j, true);
  syncListening(j);
}

/** upsd reads ups.conf and upsd.users (at start and on reload; LISTEN only at start). */
function loadUpsd(j: Game, starting: boolean) {
  const n = nut(j);
  if (!n.upsd) return;
  const unit = 'nut-server.service';
  const pid = n.pids.upsd;
  const sections = upsConf(j);
  if (!starting) log(j, unit, 'nut-server', pid, 'SIGHUP: reloading configuration');
  for (const name of Object.keys(sections)) if (!n.upsd.sections[name] || starting) log(j, unit, 'nut-server', pid, `Connected to UPS [${name}]: usbhid-ups-${name}`);
  n.upsd.sections = sections;
  if (starting) log(j, unit, 'nut-server', pid, `Found ${Object.keys(sections).length} UPS defined in ups.conf`);
  const usersFile = (j as Shell).find(`${ETC}/upsd.users`);
  const { users, warnings } = readUsers(read(j, `${ETC}/upsd.users`));
  if (usersFile?.type === 'file' && /r..$/.test(usersFile.mode ?? '')) log(j, unit, 'nut-server', pid, `${ETC}/upsd.users is world readable`, 4);
  for (const w of warnings) log(j, unit, 'nut-server', pid, w, 4);
  n.upsd.users = users;
  if (starting) log(j, unit, 'nut-server', pid, 'Running as foreground process, not saving a PID file', 4);
  // Clients of a UPS that is gone are kicked.
  n.upsd.logins = n.upsd.logins.filter((l) => sections[l.ups]);
}

function syncListening(j: Game) {
  const list = (j.state.listening ??= []) as { proto: string; address: string; port: number; process: string; pid: number }[];
  const others = list.filter((l) => l.process !== 'upsd');
  const n = nut(j);
  j.state.listening = [...others, ...(n.upsd ? n.upsd.listen.map((a) => ({ proto: 'tcp', address: a.address, port: a.port, process: 'upsd', pid: n.pids.upsd })) : [])];
}

function stopUpsd(j: Game) {
  const n = nut(j);
  if (n.upsd) log(j, 'nut-server.service', 'nut-server', n.pids.upsd, 'Signal 15: exiting');
  n.upsd = null;
  syncListening(j);
}

/** upsmon's checks at start: its power values, its shutdown command. */
function upsmonErrors(j: Game): string[] | null {
  const conf = readMonConf(read(j, `${ETC}/upsmon.conf`));
  const total = conf.monitors.reduce((s, m) => s + m.pv, 0);
  if (total < conf.minsupplies)
    return [
      'Network UPS Tools upsmon 2.8.1',
      ...conf.warnings,
      '',
      'Fatal error: insufficient power configured!',
      '',
      `Sum of power values........: ${total}`,
      `Minimum value (MINSUPPLIES): ${conf.minsupplies}`,
      '',
      'Edit your upsmon.conf and change the values.',
    ];
  return null;
}

function startUpsmon(j: Game) {
  const n = nut(j);
  const conf = readMonConf(read(j, `${ETC}/upsmon.conf`));
  const unit = 'nut-monitor.service';
  const pid = n.pids.upsmon;
  log(j, unit, 'nut-monitor', pid, 'Network UPS Tools upsmon 2.8.1');
  for (const w of conf.warnings) log(j, unit, 'nut-monitor', pid, w, 4);
  if (!conf.shutdowncmd) log(j, unit, 'nut-monitor', pid, 'Warning: no shutdown command defined!', 4);
  if (conf.powerdownflag) {
    log(j, unit, 'nut-monitor', pid, `Using power down flag file ${conf.powerdownflag}`);
    // A flag left by the last shutdown is removed when upsmon starts.
    if ((j as Shell).exists(conf.powerdownflag)) (j as Shell).erase(conf.powerdownflag);
  }
  n.upsmon = { conf, mons: [] };
  addMonitors(j, conf.monitors);
  log(j, unit, 'nut-monitor', pid + 1, 'Init SSL without certificate database');
}

function addMonitors(j: Game, list: Monitor[]) {
  const n = nut(j);
  for (const m of list) {
    log(j, 'nut-monitor.service', 'nut-monitor', n.pids.upsmon, m.pv ? `UPS: ${m.sys} (${m.primary ? 'primary' : 'secondary'}) (power value ${m.pv})` : `UPS: ${m.sys} (monitoring only)`);
    n.upsmon!.mons.push({ ...m, granted: false, loggedIn: false, comm: -1, line: -1, flags: [], lastPoll: 0, lastNonCrit: pw(j).clock, lastRb: 0, failure: null, failState: 0 });
  }
}

/** upsmon -c reload / systemctl reload nut-monitor: the MONITOR lines compared, the rest replaced. */
export function reloadUpsmon(j: Game) {
  const n = nut(j);
  if (!n.upsmon) return;
  const unit = 'nut-monitor.service';
  const pid = n.upsmon ? n.pids.upsmon : 0;
  log(j, unit, 'nut-monitor', pid + 1, 'Reloading configuration');
  const conf = readMonConf(read(j, `${ETC}/upsmon.conf`));
  for (const w of conf.warnings) log(j, unit, 'nut-monitor', pid + 1, w, 4);
  const total = conf.monitors.reduce((s, m) => s + m.pv, 0);
  if (total < conf.minsupplies) {
    log(j, unit, 'nut-monitor', pid + 1, `Fatal error: total power value (${total}) less than MINSUPPLIES (${conf.minsupplies})`, 2);
    log(j, unit, 'nut-monitor', pid + 1, 'Impossible power configuration, unable to continue', 2);
    const s = sd(j).services['nut-monitor'];
    stop(j, sd(j), 'nut-monitor');
    s.state = 'failed';
    s.result = 'exit-code';
    return;
  }
  const keep: MonState[] = [];
  for (const old of n.upsmon.mons) {
    const now = conf.monitors.find((m) => m.sys === old.sys);
    if (!now) {
      log(j, unit, 'nut-monitor', pid + 1, `No longer monitoring UPS [${old.sys}]`, 5);
      logout(j, old);
      continue;
    }
    if (now.pv !== old.pv) log(j, unit, 'nut-monitor', pid + 1, `UPS [${old.sys}]: redefined power value to ${now.pv}`);
    if (now.user !== old.user || now.pass !== old.pass) {
      log(j, unit, 'nut-monitor', pid + 1, now.user !== old.user ? `UPS [${old.sys}]: redefined username` : `UPS [${old.sys}]: redefined password`);
      logout(j, old);
      old.loggedIn = false;
      old.granted = false;
    }
    if (now.primary !== old.primary) {
      log(j, unit, 'nut-monitor', pid + 1, `UPS [${old.sys}]: redefined as a ${now.primary ? 'primary' : 'secondary'}`);
      old.granted = false;
      if (old.loggedIn) logout(j, old), (old.loggedIn = false);
    }
    keep.push({ ...old, ...now });
  }
  n.upsmon.mons = keep;
  n.upsmon.conf = conf;
  addMonitors(j, conf.monitors.filter((m) => !keep.some((k) => k.sys === m.sys)));
}

function stopUpsmon(j: Game) {
  const n = nut(j);
  if (!n.upsmon) return;
  for (const m of n.upsmon.mons) logout(j, m);
  log(j, 'nut-monitor.service', 'nut-monitor', n.pids.upsmon + 1, 'Signal 15: exiting');
  n.upsmon = null;
}

/** Hooks the NUT services of a machine (its units' start, reload and stop). */
export function attachNut(j: Game) {
  const services = sd(j).services;
  for (const [name, svc] of Object.entries(services)) {
    if (name.startsWith('nut-driver@')) {
      const section = name.slice('nut-driver@'.length);
      svc.check = (g) => driverErrors(g, section);
      svc.load = (g) => startDriver(g, section);
      svc.stop = (g) => {
        delete nut(g).drivers[section];
      };
    } else if (name === 'nut-server') {
      svc.check = (g) => upsdErrors(g);
      svc.load = (g) => (nut(g).upsd ? loadUpsd(g, false) : startUpsd(g));
      svc.stop = (g) => stopUpsd(g);
    } else if (name === 'nut-monitor') {
      svc.check = (g) => upsmonErrors(g);
      svc.load = (g) => (nut(g).upsmon ? reloadUpsmon(g) : startUpsmon(g));
      svc.stop = (g) => stopUpsmon(g);
    }
  }
}

/** The NUT units of Debian 13's packages. */
export const NUT_UNITS = {
  driver: (name: string) => ({ description: `Network UPS Tools - device driver for ${name}`, executable: 'usbhid-ups', process: [{ pid: 1210, user: 'nut', cpu: 0, mem: 0.1, command: `/lib/nut/usbhid-ups -a ${name}` }] }),
  server: () => ({ description: 'Network UPS Tools - power devices information server', executable: 'upsd', aliases: ['upsd'], process: [{ pid: 1225, user: 'nut', cpu: 0, mem: 0.1, command: '/lib/nut/upsd -F' }] }),
  monitor: () => ({
    description: 'Network UPS Tools - power device monitor and shutdown controller',
    executable: 'upsmon',
    aliases: ['upsmon'],
    process: [
      { pid: 1240, user: 'root', cpu: 0, mem: 0.1, command: '/lib/nut/upsmon -F' },
      { pid: 1241, user: 'nut', cpu: 0, mem: 0.1, command: '/lib/nut/upsmon -F' },
    ],
  }),
};

// ——— upsd, as its clients see it ———

export type NutError =
  | 'UNKNOWN-UPS'
  | 'ACCESS-DENIED'
  | 'DRIVER-NOT-CONNECTED'
  | 'DATA-STALE'
  | 'VAR-NOT-SUPPORTED'
  | 'READONLY'
  | 'INVALID-VALUE'
  | 'CMD-NOT-SUPPORTED'
  | 'INVALID-ARGUMENT';
export const ERROR_TEXT: Record<string, string> = {
  'UNKNOWN-UPS': 'Unknown UPS',
  'ACCESS-DENIED': 'Access denied',
  'DRIVER-NOT-CONNECTED': 'Driver not connected',
  'DATA-STALE': 'Data stale',
  'VAR-NOT-SUPPORTED': 'Variable not supported by UPS',
  READONLY: 'Read-only variable',
  'INVALID-VALUE': 'Invalid value for variable',
  'CMD-NOT-SUPPORTED': 'Instant command not supported',
  'INVALID-ARGUMENT': 'Invalid argument',
};

/** The story's machines for NUT's clients: names and addresses (set by the story). */
export interface NutNet {
  hosts: Record<string, { addresses: string[]; names: string[] }>;
}
const net = (j: Game) => (j as Shell).principal.state.nutNet as NutNet;

/** The shell of a machine of the story. */
export function shellOf(j: Game, name: string): Shell | null {
  const p = (j as Shell).principal;
  return pw(p).shells?.[name]?.() ?? null;
}
/** This machine's name in the story. */
export function nameOf(j: Game): string {
  const p = (j as Shell).principal;
  return Object.keys(pw(p).shells ?? {}).find((n) => shellOf(p, n) === j) ?? '';
}

/** Where a host name points: a machine of the story and the address used. */
export function resolveHost(j: Game, host: string): { name: string; address: string } | null {
  const me = nameOf(j);
  if (host === 'localhost' || host === '127.0.0.1' || host === '::1') return { name: me, address: '127.0.0.1' };
  // /etc/hosts first, then the story's DNS.
  const hosts = read(j, '/etc/hosts') ?? '';
  let address: string | null = /^\d+\.\d+\.\d+\.\d+$/.test(host) ? host : null;
  if (!address)
    for (const l of hosts.split('\n')) {
      const w = l.replace(/#.*/, '').trim().split(/\s+/);
      if (w.length > 1 && w.slice(1).includes(host)) address = w[0];
    }
  for (const [name, h] of Object.entries(net(j).hosts)) {
    if (address && h.addresses.includes(address)) return { name, address: name === me ? '127.0.0.1' : address };
    if (!address && h.names.includes(host)) return { name, address: name === me ? '127.0.0.1' : h.addresses[0] };
  }
  return address ? { name: '', address } : null;
}

/** The source address of a connection from this machine to that address. */
export function sourceAddress(j: Game, to: string): string {
  if (to.startsWith('127.')) return '127.0.0.1';
  const mine = addresses(j).filter((a) => !a.startsWith('127.'));
  const prefix = to.split('.').slice(0, 3).join('.');
  return mine.find((a) => a.startsWith(prefix + '.')) ?? mine[0] ?? '127.0.0.1';
}

/** A TCP connection to upsd: the server's shell, or the reason it fails (upscli's messages). */
export function connectUpsd(j: Game, host: string, port = PORT): { server: Shell; from: string } | { error: string; noHost?: boolean } {
  const r = resolveHost(j, host);
  if (!r) return { error: 'No such host', noHost: true };
  const server = r.name ? shellOf(j, r.name) : null;
  const w = pw(j);
  if (!server || (w.hosts[r.name] && w.hosts[r.name].state !== 'on')) return { error: 'Connection failure: No route to host' };
  const from = r.name === nameOf(j) ? '127.0.0.1' : sourceAddress(j, r.address);
  const n = server.state.nut as NutState | undefined;
  const listens = !!n?.upsd?.listen.some((a) => a.port === port && (a.address === r.address || a.address === '0.0.0.0' || (r.address === '127.0.0.1' && a.address === '127.0.0.1')));
  const ufw = server.state.ufw as Firewall | undefined;
  if (ufw && from !== '127.0.0.1') {
    const v = verdict(ufw, port, from);
    if (v === 'blocked') return { error: 'Connection failure: Connection timed out' };
    if (v === 'refused') return { error: 'Connection failure: Connection refused' };
  }
  if (!listens) return { error: 'Connection failure: Connection refused' };
  return { server, from };
}

/** Could a machine outside (the internet) reach upsd? */
export function exposed(server: Shell, outside: string, publicAddress: string): boolean {
  const n = server.state.nut as NutState | undefined;
  if (!n?.upsd) return false;
  const listens = n.upsd.listen.some((a) => a.address === '0.0.0.0' || a.address === publicAddress || a.address === '::');
  const ufw = server.state.ufw as Firewall | undefined;
  return listens && (!ufw || verdict(ufw, PORT, outside) === 'accepted');
}

const upsdOf = (s: Shell) => (s.state.nut as NutState | undefined)?.upsd ?? null;

/** The UPS's variables as upsd serves them (or the error). */
export function variables(server: Shell, ups: string): Record<string, string> | NutError {
  const d = upsdOf(server);
  if (!d?.sections[ups]) return 'UNKNOWN-UPS';
  const drv = (server.state.nut as NutState).drivers[ups];
  if (!drv) return 'DRIVER-NOT-CONNECTED';
  const w = pw(server);
  const sec = d.sections[ups];
  const status = [...(d.fsd.includes(ups) ? ['FSD'] : []), ...deviceStatus(w)];
  const charge = Math.floor(w.ups.charge);
  const v: Record<string, string> = {
    'battery.charge': String(charge),
    'battery.charge.low': String(w.ups.chargeLow),
    'battery.charge.warning': '50',
    'battery.mfr.date': w.ups.mfrDate,
    'battery.runtime': String(runtime(w)),
    'battery.runtime.low': String(w.ups.runtimeLow),
    'battery.type': 'PbAc',
    'battery.voltage': (onBattery(w) ? 23.4 + charge * 0.03 : 27.2).toFixed(1),
    'battery.voltage.nominal': '24.0',
    'device.mfr': 'American Power Conversion',
    'device.model': 'Back-UPS RS 1500MS2',
    'device.serial': '0B2238L41562',
    'device.type': 'ups',
    'driver.name': 'usbhid-ups',
    'driver.parameter.pollfreq': '30',
    'driver.parameter.pollinterval': '2',
    'driver.parameter.port': sec.port ?? 'auto',
    'driver.parameter.synchronous': 'auto',
    'driver.state': 'quiet',
    'driver.version': VERSION,
    'driver.version.data': 'APC HID 0.100',
    'driver.version.internal': '0.52',
    'driver.version.usb': 'libusb-1.0.28 (API: 0x100010a)',
    'input.sensitivity': w.ups.sensitivity,
    'input.transfer.high': String(w.ups.transferHigh),
    'input.transfer.low': String(w.ups.transferLow),
    'input.voltage': (w.mains ? w.voltage : 0).toFixed(1),
    'input.voltage.nominal': '230',
    'ups.beeper.status': w.ups.beeper,
    'ups.delay.shutdown': String(drv.offdelay),
    'ups.delay.start': String(drv.ondelay),
    'ups.firmware': '969.e2 .I',
    'ups.firmware.aux': 'e2',
    'ups.load': String(loadPercent(w)),
    'ups.mfr': 'American Power Conversion',
    'ups.mfr.date': '2028/08/21',
    'ups.model': 'Back-UPS RS 1500MS2',
    'ups.productid': '0002',
    'ups.realpower.nominal': String(w.ups.realpower),
    'ups.serial': '0B2238L41562',
    'ups.status': status.join(' '),
    'ups.test.result': w.ups.testResult,
    'ups.timer.reboot': '0',
    'ups.timer.shutdown': w.ups.offAt === null ? '-1' : String(Math.max(0, Math.round((w.ups.offAt - w.clock) / 1000))),
    'ups.timer.start': w.ups.onAt === null ? '0' : String(Math.max(0, Math.round((w.ups.onAt - w.clock) / 1000))),
    'ups.vendorid': '051d',
  };
  if (sec.offdelay !== undefined) v['driver.parameter.offdelay'] = String(drv.offdelay);
  if (sec.ondelay !== undefined) v['driver.parameter.ondelay'] = String(drv.ondelay);
  return Object.fromEntries(Object.entries(v).sort(([a], [b]) => a.localeCompare(b)));
}

/** Read-write variables (upsrw): their description and type (data/cmdvartab, apc-hid.c's ST_FLAG_RW). */
export const RW: Record<string, { desc: string; max: number }> = {
  'battery.charge.low': { desc: 'Remaining battery level when UPS switches to LB (percent)', max: 10 },
  'battery.mfr.date': { desc: 'Battery manufacturing date', max: 10 },
  'battery.runtime.low': { desc: 'Remaining battery runtime when UPS switches to LB (seconds)', max: 10 },
  'input.sensitivity': { desc: 'Input power sensitivity', max: 10 },
  'input.transfer.high': { desc: 'High voltage transfer point (V)', max: 10 },
  'input.transfer.low': { desc: 'Low voltage transfer point (V)', max: 10 },
  'ups.delay.shutdown': { desc: 'Interval to wait after shutdown with delay command (seconds)', max: 10 },
  'ups.delay.start': { desc: 'Interval to wait before (re)starting the load (seconds)', max: 10 },
};

/** Instant commands (upscmd -l): data/cmdvartab's descriptions, those apc-hid maps. */
export const INSTCMDS: Record<string, string> = {
  'beeper.disable': 'Disable the UPS beeper',
  'beeper.enable': 'Enable the UPS beeper',
  'beeper.mute': 'Temporarily mute the UPS beeper',
  'beeper.off': 'Obsolete (use beeper.disable or beeper.mute)',
  'beeper.on': 'Obsolete (use beeper.enable)',
  'driver.killpower': 'Tell the driver daemon to initiate UPS shutdown; should be unlocked with driver.flag.allow_killpower option or variable setting',
  'driver.reload': 'Reload running driver configuration from the file system (only works for changes in some options)',
  'driver.reload-or-error': 'Reload running driver configuration from the file system (only works for changes in some options); return an error if something changed and could not be applied live (so the caller can restart it with new options)',
  'driver.reload-or-exit': 'Reload running driver configuration from the file system (only works for changes in some options); exit the running driver if something changed and could not be applied live (so service management framework can restart it with new options)',
  'load.off': 'Turn off the load immediately',
  'load.off.delay': 'Turn off the load with a delay (seconds)',
  'shutdown.reboot': 'Shut down the load briefly while rebooting the UPS',
  'shutdown.return': 'Turn off the load and return when power is back',
  'shutdown.stop': 'Stop a shutdown in progress',
  'test.battery.start.deep': 'Start a deep battery test',
  'test.battery.start.quick': 'Start a quick battery test',
  'test.battery.stop': 'Stop the battery test',
  'test.panel.start': 'Start testing the UPS panel',
  'test.panel.stop': 'Stop a UPS panel test',
};

/** user_checkaction: is this user (with this password) allowed this action (upsmon primary gives LOGIN, PRIMARY and FSD; secondary LOGIN)? */
export function allowed(server: Shell, user: string, password: string, action: string): boolean {
  const u = upsdOf(server)?.users[user];
  if (!u || u.password === undefined || u.password !== password) return false;
  const a = action.toUpperCase();
  if (u.actions.includes(a)) return true;
  if (u.upsmon && a === 'LOGIN') return true;
  if (u.upsmon === 'primary' && (a === 'PRIMARY' || a === 'MASTER' || a === 'FSD')) return true;
  return false;
}

/** INSTCMD: the user's instcmds, then the driver. */
export function instcmd(server: Shell, ups: string, user: string, password: string, cmd: string): NutError | null {
  const d = upsdOf(server);
  if (!d?.sections[ups]) return 'UNKNOWN-UPS';
  const u = d.users[user];
  if (!u || u.password !== password || !(u.instcmds.includes('ALL') || u.instcmds.includes(cmd))) return 'ACCESS-DENIED';
  if (!(server.state.nut as NutState).drivers[ups]) return 'DRIVER-NOT-CONNECTED';
  if (!INSTCMDS[cmd]) return 'CMD-NOT-SUPPORTED';
  const w = pw(server);
  const unit = `${driverUnit(ups)}.service`;
  log(server, 'nut-server.service', 'nut-server', (server.state.nut as NutState).pids.upsd, `Instant command: ${user}@127.0.0.1 did ${cmd} on ${ups} (tracking ID: disabled)`);
  if (cmd === 'test.battery.start.quick' || cmd === 'test.battery.start.deep') {
    w.ups.test = { kind: cmd.endsWith('quick') ? 'quick' : 'deep', started: w.clock };
    w.ups.testResult = 'In progress';
    log(server, unit, driverUnit(ups), (server.state.nut as NutState).pids.driver, `instcmd: successful (${cmd})`);
  } else if (cmd === 'test.battery.stop') {
    if (w.ups.test) endTest(w, 'Aborted');
  } else if (cmd === 'beeper.mute') w.ups.beeper = 'muted';
  else if (cmd === 'beeper.disable' || cmd === 'beeper.off') w.ups.beeper = 'disabled';
  else if (cmd === 'beeper.enable' || cmd === 'beeper.on') w.ups.beeper = 'enabled';
  else if (cmd === 'shutdown.return' || cmd === 'load.off.delay') kill(server, ups);
  else if (cmd === 'shutdown.stop') {
    w.ups.offAt = null;
    w.ups.onAt = null;
  } else if (cmd === 'load.off') {
    w.ups.offAt = w.clock;
    w.ups.onAt = null;
  }
  return null;
}

/** SET VAR: actions = SET, then the variable must be read-write and the value valid. */
export function setVar(server: Shell, ups: string, user: string, password: string, name: string, value: string): NutError | null {
  const d = upsdOf(server);
  if (!d?.sections[ups]) return 'UNKNOWN-UPS';
  if (!allowed(server, user, password, 'SET')) return 'ACCESS-DENIED';
  if (!(server.state.nut as NutState).drivers[ups]) return 'DRIVER-NOT-CONNECTED';
  const vars = variables(server, ups);
  if (typeof vars === 'string') return vars;
  if (!(name in vars)) return 'VAR-NOT-SUPPORTED';
  if (!RW[name]) return 'READONLY';
  if (value.length > RW[name].max) return 'INVALID-VALUE';
  const w = pw(server);
  const n = Number(value);
  if (name === 'battery.mfr.date') {
    if (!/^\d{4}\/\d{2}\/\d{2}$/.test(value)) return 'INVALID-VALUE';
    w.ups.mfrDate = value;
  } else if (name === 'input.sensitivity') {
    if (!['low', 'medium', 'high'].includes(value)) return 'INVALID-VALUE';
    w.ups.sensitivity = value;
  } else {
    if (!/^\d+$/.test(value)) return 'INVALID-VALUE';
    if (name === 'battery.charge.low') w.ups.chargeLow = n;
    if (name === 'battery.runtime.low') w.ups.runtimeLow = n;
    if (name === 'input.transfer.high') w.ups.transferHigh = n;
    if (name === 'input.transfer.low') w.ups.transferLow = n;
    const drv = (server.state.nut as NutState).drivers[ups];
    if (name === 'ups.delay.shutdown') drv.offdelay = n;
    if (name === 'ups.delay.start') drv.ondelay = n;
  }
  log(server, 'nut-server.service', 'nut-server', (server.state.nut as NutState).pids.upsd, `Set variable: ${user}@127.0.0.1 set ${name} on ${ups} to ${value} (tracking ID: disabled)`);
  return null;
}

// ——— The UPS ———

function endTest(w: PowerWorld, result: string) {
  if (!w.ups.test) return;
  w.ups.tests.push({ ...w.ups.test, ended: w.clock, result });
  w.ups.testResult = result;
  w.ups.test = null;
}

/** upsdrvctl shutdown (or the shutdown.return command): the output goes off after offdelay, comes back after ondelay. */
export function kill(server: Shell, ups: string) {
  const w = pw(server);
  const sec = upsConf(server)[ups];
  const off = sec?.offdelay ?? 20;
  const on = sec?.ondelay ?? 30;
  w.ups.offAt = w.clock + off * 1000;
  w.ups.onAt = w.clock + Math.max(on, off + 1) * 1000;
  w.history.push({ time: w.clock, host: nameOf(server), what: 'kill' });
}

// ——— A second of the world ———

/** Notification: syslog, wall, and NOTIFYCMD (upssched included). */
function notify(j: Game, m: MonState | null, type: string) {
  const n = nut(j);
  const conf = n.upsmon?.conf;
  if (!conf) return;
  const msg = (conf.messages[type] ?? DEFAULT_MESSAGES[type] ?? type).replace('%s', m?.sys ?? '');
  const flags = conf.flags[type] ?? ['SYSLOG', 'WALL'];
  if (flags.includes('IGNORE')) return;
  if (flags.includes('SYSLOG')) log(j, 'nut-monitor.service', 'nut-monitor', n.pids.upsmon + 1, msg, 5);
  if (flags.includes('WALL')) (pw(j).wall ??= []).push({ host: nameOf(j), text: msg, time: pw(j).clock });
  if (flags.includes('EXEC') && conf.notifycmd) execNotify(j, conf.notifycmd, msg, type, m?.sys ?? '');
}

/** Runs a script of the machine as the nut user, with NOTIFYTYPE and UPSNAME. */
function runAsNut(j: Game, path: string, args: string[], env: Record<string, string>): void {
  const s = j as Shell;
  const text = s.read(path);
  if (text === null) {
    log(j, 'nut-monitor.service', 'nut-monitor', nut(j).pids.upsmon + 1, `Unable to call shutdown command: ${path}`, 3);
    return;
  }
  const before = s.who;
  s.who = 'nut';
  try {
    runScript(s, text, { cwd: '/', name: path, arguments: args, environment: { PATH: '/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin', ...env } });
  } finally {
    s.who = before;
  }
}

const isUpssched = (cmd: string) => /(^|\/)upssched$/.test(cmd);

function execNotify(j: Game, cmd: string, msg: string, type: string, ups: string) {
  if (isUpssched(cmd)) return upssched(j, type, ups);
  runAsNut(j, cmd, [msg], { NOTIFYTYPE: type, UPSNAME: ups });
}

/** upssched: the AT lines for this event and this UPS. */
function upssched(j: Game, type: string, ups: string) {
  const n = nut(j);
  const sched = readSched(read(j, `${ETC}/upssched.conf`));
  const pid = n.pids.sched;
  if (sched.error) {
    log(j, 'nut-monitor.service', 'upssched', pid, sched.error, 2);
    return;
  }
  const w = pw(j);
  for (const at of sched.ats) {
    if (at.type !== type || (at.ups !== '*' && at.ups !== ups)) continue;
    if (at.cmd === 'START-TIMER' && at.args[0]) {
      const secs = Number(at.args[1]);
      if (!Number.isFinite(secs) || secs < 0) log(j, 'nut-monitor.service', 'upssched', pid, 'bogus offset for timer, ignoring');
      else {
        if (!n.timers.length) log(j, 'nut-monitor.service', 'upssched', pid, 'Timer daemon started');
        n.timers.push({ name: at.args[0], at: w.clock + secs * 1000 });
      }
    } else if (at.cmd === 'CANCEL-TIMER' && at.args[0]) {
      const k = n.timers.findIndex((x) => x.name === at.args[0]);
      if (k >= 0) n.timers.splice(k, 1);
      else if (at.args[1]) schedExec(j, sched, at.args[1]);
    } else if (at.cmd === 'EXECUTE' && at.args[0]) {
      log(j, 'nut-monitor.service', 'upssched', pid, `Executing command: ${at.args[0]}`);
      schedExec(j, sched, at.args[0]);
    } else log(j, 'nut-monitor.service', 'upssched', pid, `Invalid command: ${at.cmd}`, 3);
  }
}

function schedExec(j: Game, sched: Sched, arg: string) {
  if (!sched.cmdscript) return;
  runAsNut(j, sched.cmdscript, [arg], {});
}

/** upssched's timers that are due. */
function schedTick(j: Game) {
  const n = nut(j);
  const w = pw(j);
  const due = n.timers.filter((x) => x.at <= w.clock);
  if (!due.length) return;
  n.timers = n.timers.filter((x) => x.at > w.clock);
  const sched = readSched(read(j, `${ETC}/upssched.conf`));
  for (const d of due) schedExec(j, sched, d.name);
  if (!n.timers.length) log(j, 'nut-monitor.service', 'upssched', n.pids.sched, 'Timer queue empty, exiting');
}

function logout(j: Game, m: MonState) {
  if (!m.loggedIn) return;
  const c = connectUpsd(j, m.host, m.port);
  const server = 'server' in c ? c.server : m.host === 'localhost' ? (j as Shell) : null;
  const d = server ? upsdOf(server) : null;
  if (d) {
    const k = d.logins.findIndex((l) => l.user === m.user && l.ups === m.upsname && l.from === ('from' in c ? c.from : '127.0.0.1'));
    if (k >= 0) {
      const l = d.logins[k];
      d.logins.splice(k, 1);
      log(server!, 'nut-server.service', 'nut-server', (server!.state.nut as NutState).pids.upsd, `User ${l.user}@${l.from} logged out from UPS [${l.ups}]`);
    }
  }
  m.loggedIn = false;
  m.granted = false;
}

/** One poll of a monitored UPS (upsmon's pollups: connect, log in, GET VAR status). */
function poll(j: Game, m: MonState) {
  const n = nut(j);
  const w = pw(j);
  const pid = n.pids.upsmon + 1;
  const unit = 'nut-monitor.service';
  m.lastPoll = w.clock;
  const fail = (text: string, code: number) => {
    const throttle = n.upsmon!.conf.throttle;
    if (m.failState !== code) {
      if (throttle >= 0)
        log(j, unit, 'nut-monitor', pid, `Poll UPS [${m.sys}] failure state code changed from ${m.failState} to ${code}; report below will ${throttle === 0 ? 'not be repeated to syslog:' : `only be repeated to syslog every ${throttle} polling loop cycles:`}`, 3);
      log(j, unit, 'nut-monitor', pid, text, 3);
      m.failCount = 0;
    } else if (throttle < 0 || (throttle > 0 && (m.failCount = (m.failCount ?? 0) + 1) >= throttle)) {
      log(j, unit, 'nut-monitor', pid, text, 3);
      m.failCount = 0;
    }
    m.failState = code;
    m.failure = text;
    if (m.comm !== 0) {
      if (m.comm === 1) notify(j, m, 'COMMBAD');
      m.comm = 0;
    }
    if (m.loggedIn) m.loggedIn = false;
  };
  const c = connectUpsd(j, m.host, m.port);
  if ('error' in c) return fail(`UPS [${m.sys}]: connect failed: ${c.error}`, 31);
  const d = upsdOf(c.server)!;
  if (!m.loggedIn) {
    const loginError = !d.sections[m.upsname] ? 'Unknown UPS' : !allowed(c.server, m.user, m.pass, 'LOGIN') ? 'Access denied' : null;
    if (loginError) {
      if (m.loginError !== loginError) log(j, unit, 'nut-monitor', pid, `Can't login to UPS [${m.sys}]: ${loginError}`, 3);
      m.loginError = loginError;
    } else {
      m.loginError = undefined;
      m.loggedIn = true;
      d.logins.push({ user: m.user, from: c.from, ups: m.upsname, primary: false });
      log(c.server, 'nut-server.service', 'nut-server', (c.server.state.nut as NutState).pids.upsd, `User ${m.user}@${c.from} logged into UPS [${m.upsname}]`);
      if (m.primary) {
        if (allowed(c.server, m.user, m.pass, 'PRIMARY')) {
          m.granted = true;
          d.logins.at(-1)!.primary = true;
        } else {
          log(j, unit, 'nut-monitor', pid, `Primary managerial privileges unavailable on UPS [${m.sys}]`, 1);
          log(j, unit, 'nut-monitor', pid, 'Reason: Access denied', 1);
        }
      }
    }
  }
  const vars = variables(c.server, m.upsname);
  if (vars === 'UNKNOWN-UPS') return fail(`Poll UPS [${m.sys}] failed - [${m.upsname}] does not exist on server ${m.host}`, 4);
  if (typeof vars === 'string') return fail(`Poll UPS [${m.sys}] failed - ${ERROR_TEXT[vars]}`, vars === 'DRIVER-NOT-CONNECTED' ? 39 : 10);
  if (m.failState) log(j, unit, 'nut-monitor', pid, `Poll UPS [${m.sys}] recovered from failure state code ${m.failState} - now 0`, 3);
  m.failState = 0;
  m.failure = null;
  if (m.comm === 0) notify(j, m, 'COMMOK');
  m.comm = 1;
  const flags = vars['ups.status'].split(' ');
  // ups_on_line / ups_on_batt / ups_low_batt / ups_fsd / upsreplbatt
  if (flags.includes('OL') && !m.flags.includes('OL')) {
    if (m.line !== -1) notify(j, m, 'ONLINE');
    m.line = 1;
  }
  if (flags.includes('OB') && !m.flags.includes('OB')) {
    notify(j, m, 'ONBATT');
    m.line = 0;
  }
  if (flags.includes('LB') && !m.flags.includes('LB')) notify(j, m, 'LOWBATT');
  if (flags.includes('FSD') && !m.flags.includes('FSD')) notify(j, m, 'FSD');
  if (flags.includes('CAL') && !m.flags.includes('CAL')) notify(j, m, 'CAL');
  if (flags.includes('RB') && w.clock - m.lastRb > (n.upsmon!.conf.rbwarntime * 1000)) {
    notify(j, m, 'REPLBATT');
    m.lastRb = w.clock;
  }
  m.flags = flags;
}

/** is_ups_critical (clients/upsmon.c). */
function critical(j: Game, m: MonState): boolean {
  const w = pw(j);
  const conf = nut(j).upsmon!.conf;
  if (m.flags.includes('FSD')) return true;
  if (m.comm === 0 && m.line === 0) {
    if (!m.deadLogged) log(j, 'nut-monitor.service', 'nut-monitor', nut(j).pids.upsmon + 1, `UPS [${m.sys}] was last known to be not fully online and currently is not communicating, assuming dead`, 4);
    m.deadLogged = true;
    return true;
  }
  if (!m.flags.includes('OB') || !m.flags.includes('LB')) {
    m.lastNonCrit = w.clock;
    return false;
  }
  if (m.flags.includes('CAL')) return false;
  if (m.primary && m.granted) return true;
  if (w.clock - m.lastNonCrit > conf.hostsync * 1000) {
    log(j, 'nut-monitor.service', 'nut-monitor', nut(j).pids.upsmon + 1, `Giving up on the primary for UPS [${m.sys}] after ${Math.round((w.clock - m.lastNonCrit) / 1000)} sec since last comms`, 4);
    return true;
  }
  return false;
}

/** What SHUTDOWNCMD does: halt, reboot, or nothing the game knows. */
export function shutdownKind(cmd: string | null): 'halt' | 'reboot' | 'none' {
  if (!cmd) return 'none';
  const w = cmd.trim().split(/\s+/);
  const prog = w[0].split('/').at(-1);
  if (prog === 'shutdown') return w.some((x) => x === '-r' || x === '--reboot') ? 'reboot' : 'halt';
  if (prog === 'poweroff' || prog === 'halt') return 'halt';
  if (prog === 'reboot') return 'reboot';
  if (prog === 'systemctl') return w.includes('poweroff') || w.includes('halt') ? 'halt' : w.includes('reboot') ? 'reboot' : 'none';
  return 'none';
}

/** One second of upsmon on a machine. */
function upsmonTick(j: Game) {
  const n = nut(j);
  const mon = n.upsmon;
  if (!mon) return;
  const w = pw(j);
  const pid = n.pids.upsmon + 1;
  const unit = 'nut-monitor.service';
  if (mon.phase) {
    const { conf } = mon;
    if (mon.phase.step === 'sync') {
      // sync_secondaries: until each UPS we are the primary for has one login (ours), or HOSTSYNC.
      const waiting = mon.mons.some((m) => {
        if (!m.granted) return false;
        const c = connectUpsd(j, m.host, m.port);
        return 'server' in c && upsdOf(c.server)!.logins.filter((l) => l.ups === m.upsname).length > 1;
      });
      if (!waiting || w.clock - mon.phase.since > conf.hostsync * 1000) {
        if (waiting) log(j, unit, 'nut-monitor', pid, 'Host sync timer expired, forcing shutdown');
        doShutdown(j);
      }
    } else if (w.clock - mon.phase.since >= conf.finaldelay * 1000) runShutdown(j);
    return;
  }
  if (mon.fsdRequested) {
    mon.fsdRequested = false;
    log(j, unit, 'nut-monitor', pid, 'Signal 10: User requested FSD');
    return forceShutdown(j);
  }
  for (const m of mon.mons) {
    const freq = m.flags.includes('OB') ? mon.conf.pollfreqalert : mon.conf.pollfreq;
    if (w.clock - m.lastPoll >= freq * 1000) poll(j, m);
  }
  // recalc
  let value = 0;
  for (const m of mon.mons) if (!critical(j, m)) value += m.pv;
  if (value < mon.conf.minsupplies) forceShutdown(j);
}

/** forceshutdown: FSD on the UPSes we are primary for, then wait for the secondaries. */
function forceShutdown(j: Game) {
  const mon = nut(j).upsmon!;
  const w = pw(j);
  let primary = false;
  for (const m of mon.mons) {
    if (!(m.primary && m.granted)) continue;
    primary = true;
    const c = connectUpsd(j, m.host, m.port);
    if ('server' in c) {
      const d = upsdOf(c.server)!;
      if (!d.sections[m.upsname]) log(j, 'nut-monitor.service', 'nut-monitor', nut(j).pids.upsmon + 1, `FSD set on UPS ${m.sys} failed: ERR UNKNOWN-UPS`, 3);
      else if (!d.fsd.includes(m.upsname)) d.fsd.push(m.upsname);
    }
  }
  // A primary whose MONITOR names an unknown UPS still tries (FSD fails), then shuts down.
  if (!primary && mon.mons.some((m) => m.primary)) {
    for (const m of mon.mons.filter((x) => x.primary)) log(j, 'nut-monitor.service', 'nut-monitor', nut(j).pids.upsmon + 1, `FSD set on UPS ${m.sys} failed: ${m.loggedIn ? 'Access denied' : 'Unknown UPS'}`, 3);
    primary = true;
  }
  if (primary) mon.phase = { step: 'sync', since: w.clock };
  else doShutdown(j);
}

/** doshutdown: the messages, SHUTDOWN's notification, then FINALDELAY. */
function doShutdown(j: Game) {
  const mon = nut(j).upsmon!;
  const pid = nut(j).pids.upsmon + 1;
  log(j, 'nut-monitor.service', 'nut-monitor', pid, 'Executing automatic power-fail shutdown', 2);
  (pw(j).wall ??= []).push({ host: nameOf(j), text: 'Executing automatic power-fail shutdown', time: pw(j).clock });
  notify(j, null, 'SHUTDOWN');
  mon.phase = { step: 'final', since: pw(j).clock };
}

/** After FINALDELAY: the power down flag, SHUTDOWNCMD, upsmon exits (and logs out). */
function runShutdown(j: Game) {
  const n = nut(j);
  const mon = n.upsmon!;
  const s = j as Shell;
  if (mon.conf.powerdownflag && mon.mons.some((m) => m.primary)) {
    const dir = mon.conf.powerdownflag.replace(/\/[^/]*$/, '') || '/';
    const parent = s.find(dir);
    if (parent?.type === 'directory') parent.children[mon.conf.powerdownflag.split('/').at(-1)!] = { type: 'file', content: 'upsmon-shutdown-file', owner: 'root', group: 'root', mode: 'rw-r--r--' } as never;
    else log(j, 'nut-monitor.service', 'nut-monitor', n.pids.upsmon, 'Failed to create power down flag!', 3);
  }
  const kind = shutdownKind(mon.conf.shutdowncmd);
  for (const m of mon.mons) logout(j, m);
  mon.phase = undefined;
  if (kind === 'none') {
    if (!mon.conf.shutdowncmd || !s.exists(mon.conf.shutdowncmd.split(/\s+/)[0])) log(j, 'nut-monitor.service', 'nut-monitor', n.pids.upsmon, `Unable to call shutdown command: ${mon.conf.shutdowncmd ?? ''}`, 3);
    // upsmon exits all the same.
    n.upsmon = null;
    const svc = sd(j).services['nut-monitor'];
    if (svc) svc.state = 'inactive';
    return;
  }
  beginHalt(j, kind === 'reboot');
}

// ——— Machines: halting, crashing, booting ———

const hostOf = (j: Game) => pw(j).hosts[nameOf(j)];

/** The machine starts to shut down (systemd stops its services); its power goes when the halt is over. */
export function beginHalt(j: Game, reboot = false) {
  const h = hostOf(j);
  const w = pw(j);
  const s = sd(j);
  if (!h || h.state !== 'on') return;
  writeLogAt(j, '', 'systemd-logind', 512, reboot ? 'The system will reboot now!' : 'The system will power off now!');
  writeLogAt(j, '', 'systemd-logind', 512, reboot ? 'System is rebooting.' : 'System is powering down.');
  s.shuttingDown = true;
  for (const [name, svc] of Object.entries(s.services)) if (svc.state === 'active') stop(j, s, name);
  s.shuttingDown = false;
  s.clock = Math.max(s.clock, w.clock);
  h.state = 'halting';
  h.until = w.clock + h.haltSeconds * 1000;
  (j as Shell).state.haltKind = reboot ? 'reboot' : 'halt';
}

function writeLogAt(j: Game, unit: string, ident: string, pid: number, message: string, priority = 6) {
  log(j, unit, ident, pid, message, priority);
}

/** The end of a halt: systemd-shutdown runs nutshutdown (upsmon -K, upsdrvctl shutdown), then the power goes. */
function endHalt(j: Game) {
  const h = hostOf(j);
  const w = pw(j);
  const s = j as Shell;
  const flag = nut(j).upsmon?.conf.powerdownflag ?? readMonConf(read(j, `${ETC}/upsmon.conf`)).powerdownflag;
  if (flag && s.read(flag)?.startsWith('upsmon-shutdown-file')) {
    // nutshutdown: the drivers of ups.conf send the kill power command.
    for (const name of Object.keys(upsConf(j))) if (upsConf(j)[name].driver === 'usbhid-ups') kill(s, name);
  }
  if (s.state.haltKind === 'reboot') {
    w.history.push({ time: w.clock, host: nameOf(j), what: 'halted' });
    h.state = 'booting';
    h.until = w.clock + h.bootSeconds * 1000;
    return;
  }
  h.state = 'off';
  h.wasOn = false;
  h.lastEvent = 'command';
  w.history.push({ time: w.clock, host: nameOf(j), what: 'halted' });
}

/** Power lost under a machine still running (or halting): a crash. */
function crash(j: Game) {
  const h = hostOf(j);
  const w = pw(j);
  w.history.push({ time: w.clock, host: nameOf(j), what: h.state === 'halting' ? 'crash-halting' : 'crash-running' });
  h.wasOn = h.state === 'on' || h.state === 'halting' || h.state === 'booting';
  h.state = 'off';
  h.lastEvent = 'ac-failed';
  h.sel.push({ time: w.clock, sensor: 'Power Unit #0x01', event: 'AC lost | Asserted' });
  const s = sd(j);
  for (const svc of Object.values(s.services)) if (svc.state === 'active') svc.state = 'inactive';
  const n = nut(j);
  n.upsd = null;
  n.upsmon = null;
  n.drivers = {};
  n.timers = [];
  if (j.state.process) j.state.process = (j.state.process as (Process & { base?: boolean })[]).filter((p) => p.pid === 1 || p.base);
}

/** The machine boots: a new boot in its journal, its enabled services started. */
export function boot(j: Game) {
  const h = hostOf(j);
  const w = pw(j);
  const s = sd(j);
  s.clock = Math.max(s.clock, w.clock);
  s.boot++;
  const n = nut(j);
  n.upsd = null;
  n.upsmon = null;
  n.drivers = {};
  n.timers = [];
  j.state.process = (j.state.process as (Process & { base?: boolean })[] | undefined)?.filter((p) => p.pid === 1 || p.base) ?? [];
  writeLog(s, '', 'kernel', 0, `Linux version 6.12.48+deb13-amd64 (${s.host})`, 6, false);
  if (h.lastEvent === 'ac-failed') writeLog(s, '', 'kernel', 0, 'EXT4-fs (vda1): recovery complete', 6, false);
  for (const [name, svc] of Object.entries(s.services)) {
    svc.state = 'inactive';
    svc.since = s.clock;
    if (svc.active) start(j, s, name, true);
  }
  s.checkedAfterBoot = false;
  s.mainAStarted = false;
  h.state = 'on';
  w.history.push({ time: w.clock, host: nameOf(j), what: 'booted' });
  h.sel.push({ time: w.clock, sensor: 'System ACPI Power State #0x01', event: 'S0/G0: working | Asserted' });
  w.clock = Math.max(w.clock, s.clock);
}

/** Someone presses a machine's power button. */
export function pressButton(w: PowerWorld, name: string) {
  const h = w.hosts[name];
  if (!h || h.state !== 'off' || !w.ups.output) return;
  h.state = 'booting';
  h.until = w.clock + h.bootSeconds * 1000;
  h.lastEvent = 'command';
  w.history.push({ time: w.clock, host: name, what: 'button' });
}

/** One second for the whole story: the mains, the UPS, the machines, every machine's NUT. */
export function second(p: Shell) {
  const w = pw(p);
  w.clock += 1000;
  const t = w.clock;
  // The mains.
  const cut = w.cuts.some((c) => c.from <= t && t < c.to);
  w.mains = !cut;
  w.cuts = w.cuts.filter((c) => c.to > t - 1000);
  const u = w.ups;
  // The battery.
  if (u.output && onBattery(w)) {
    const capacity = (u.capacity * u.health) / (Math.max(loadPercent(w), 5) / 100);
    u.charge = Math.max(0, u.charge - 100 / capacity);
  } else if (w.mains && u.charge < 100) u.charge = Math.min(100, u.charge + 100 / (u.health < 0.5 ? 3 * 3600 : 6 * 3600));
  // The self test.
  if ((u.test?.kind === 'quick' && t - u.test.started >= 10_000) || (u.test?.kind === 'deep' && u.charge <= 25)) {
    endTest(w, u.health < 0.5 ? (u.test.kind === 'quick' ? 'Done and warning' : 'Done and error') : 'Done and passed');
    // The UPS asks for a new battery after a failed test, and stops once one passes.
    u.replace = u.health < 0.5;
  }
  // The output: a kill timer, an empty battery.
  const feeding = Object.entries(w.hosts);
  if (u.output && ((u.offAt !== null && t >= u.offAt) || (!w.mains && u.charge <= 0))) {
    if (!w.mains && u.charge <= 0) u.depleted = true;
    u.output = false;
    u.offAt = null;
    w.history.push({ time: t, host: '', what: 'ups-off' });
    for (const [name, h] of feeding) if (h.fed && h.state !== 'off') crash(shellOf(p, name)!);
  }
  if (!u.output && w.mains && (u.depleted || (u.onAt !== null && t >= u.onAt))) {
    u.output = true;
    u.depleted = false;
    u.onAt = null;
    w.history.push({ time: t, host: '', what: 'ups-on' });
    for (const [, h] of feeding) {
      if (!h.fed || h.state !== 'off') continue;
      if (h.policy === 'always-on' || (h.policy === 'previous' && h.wasOn)) {
        h.state = 'booting';
        h.until = t + h.bootSeconds * 1000;
      }
    }
  }
  if (u.onAt !== null && u.output && u.offAt === null && t >= u.onAt) u.onAt = null;
  // The machines.
  for (const [name, h] of feeding) {
    const s = shellOf(p, name);
    if (!s) continue;
    if (h.state === 'halting' && t >= h.until) endHalt(s);
    else if (h.state === 'booting' && t >= h.until) boot(s);
  }
  // Their NUT.
  for (const [name, h] of feeding) {
    const s = shellOf(p, name);
    if (!s || h.state !== 'on' || !s.state.nut) continue;
    upsmonTick(s);
    schedTick(s);
  }
  for (const [name] of feeding) {
    const s = shellOf(p, name);
    const c = s && systemd(s);
    if (c) c.clock = Math.max(c.clock, w.clock);
  }
}

/** Is anything still moving (a halt, a boot, a kill timer, a forced shutdown)? */
export function busy(w: PowerWorld, p: Shell): boolean {
  if (w.ups.offAt !== null || w.ups.onAt !== null || !w.ups.output) return true;
  for (const [name, h] of Object.entries(w.hosts)) {
    if (h.state === 'halting' || h.state === 'booting') return true;
    const s = shellOf(p, name);
    if (h.state === 'on' && (s?.state.nut as NutState | undefined)?.upsmon?.phase) return true;
    if (h.state === 'on' && (s?.state.nut as NutState | undefined)?.upsmon?.fsdRequested) return true;
  }
  return false;
}

/** The wall messages written since, as wall(1) shows them on that machine's terminals. */
export function takeWall(w: PowerWorld, host: string, hostname: string, when: (ms: number) => string): string {
  const mine = (w.wall ?? []).filter((x) => x.host === host);
  w.wall = (w.wall ?? []).filter((x) => x.host !== host);
  return mine.map((x) => `Broadcast message from nut@${hostname} (somewhere) (${when(x.time ?? w.clock)}):\n\n${x.text}`).join('\n\n');
}

/** For a story's trial: the notification upsmon would send for this event (its flags, NOTIFYCMD, upssched). */
export function trialNotify(j: Game, type: string, sys: string) {
  notify(j, { sys } as MonState, type);
}
/** For a story's trial: upssched's timers that are due now. */
export const trialTimers = (j: Game) => schedTick(j);
