// Story "The Bike Share": what its chapters share. A neighbourhood bike
// share cooperative (four stations, about sixty bikes) runs its rental app
// on saddle (selle in French, 192.0.2.55) and the docking stations'
// gateway on hub (moyeu, 192.0.2.56); gauge (jauge, 192.0.2.54), the
// story's machine, is the monitoring server Aroha set up before moving
// away: Prometheus, its node exporter, the Alertmanager, and a small relay
// that posts the Alertmanager's webhooks to the volunteers' chat (#team,
// #on-call). saddle and hub are internal hosts, reached with ssh from
// gauge. Ngozi coordinates the cooperative; Tomás writes the rental app.
// The network (state.metricsNet): names, each machine's ufw, its services,
// and what each port answers: Prometheus's API (9090), the Alertmanager's
// (9093), the relay (9099), node exporters (9100), the rental app (3000,
// /metrics). Metrics are computed from the machines' state and the clock:
// file systems from their files (like df), CPU and memory from a steady
// profile, the app's counters from its traffic (a baseline, short bursts
// of errors every quarter of an hour, an incident in chapter 2) since its
// process started. Each command, a minute passes (sleep: more).
// Addresses: RFC 5737 (192.0.2.54-56, 203.0.113.161 for the outside).
// Sources: https://prometheus.io/docs/guides/node-exporter/,
// https://github.com/prometheus/node_exporter (metric names),
// https://prometheus.io/docs/practices/naming/ and /instrumentation/.

import { accountsFiles, d, f, type Accounts, type Directory, type Node, type Rights, type InternalHost } from '../world';
import { machineName } from '../machines';
import type { Game, Shell } from '../shell';
import type { Translate } from '../../texts';
import { newSystemd, systemd, type DefinitionService } from '../systemd';
import { generateKey } from '../access';
import { newFirewall, verdict, type Firewall } from '../firewall';
import type { Listening } from '../commands/ss';
import type { Process } from '../commands/system';
import { advance, newProm, prom, promHttp, selfMetrics, readAll, reloadProm, setHooks, startProm, stopProm, type Family, type MetricsNet, type Reply, type Rule } from '../prometheus';
import { am, newAm, readAmConfig, receive, reloadAm, startAm, stopAm, tickAm, AM_CONFIG, AM_PID } from '../alertmanager';
import { amHttp } from '../commands/prometheus';
import { evaluate, labelsText, type Labels, type Matcher, type Storage, type StoredSeries } from '../promql';

export const HOME = '/home/you';
export const PASSWORD = 'pedal-2029';
export const GAUGE = '192.0.2.54';
export const SADDLE = '192.0.2.55';
export const HUB = '192.0.2.56';
// Someone on the internet (to check what a firewall leaves open).
export const OUTSIDE = '203.0.113.161';
export const PROM_PID = 812;
export const RELAY_LOG = '/var/log/alert-relay/relay.log';
export const RULES_DIR = '/etc/prometheus/rules';
export const BACKUP = '/var/backups/docks-2029-04.tar.gz';
export const PHOTOS = '/srv/docks/photos';

// Monday 7 May 2029, 14:10 (chapter 1); Tuesday 15 May, 9:05 (chapter 2); Saturday 19 May, 9:40 (chapter 3).
export const NOW_1 = Date.UTC(2029, 4, 7, 14, 10, 0);
export const NOW_2 = Date.UTC(2029, 4, 15, 9, 5, 0);
export const NOW_3 = Date.UTC(2029, 4, 19, 9, 40, 0);
const BOOT = Date.UTC(2029, 4, 2, 6, 12, 0);
// Chapter 2: the rental app's bug, since this morning's release.
export const INCIDENT = Date.UTC(2029, 4, 15, 8, 20, 0);
// Chapter 3: the planned maintenance of hub (a disk replaced).
export const MAINTENANCE_FROM = Date.UTC(2029, 4, 19, 10, 0, 0);
export const MAINTENANCE_TO = Date.UTC(2029, 4, 19, 11, 30, 0);

export type ChapterNo = 1 | 2 | 3;
const GiB = 1024 ** 3;

export const gaugeAccounts = (): Accounts => ({
  users: {
    root: { uid: 0, group: 'root', home: '/root' },
    prometheus: { uid: 110, group: 'prometheus', home: '/var/lib/prometheus', shell: '/usr/sbin/nologin' },
    you: { uid: 1000, group: 'you' },
    ngozi: { uid: 1001, group: 'ngozi' },
  },
  groups: {
    root: { gid: 0, members: [] },
    adm: { gid: 4, members: ['you'] },
    sudo: { gid: 27, members: ['you', 'ngozi'] },
    prometheus: { gid: 117, members: [] },
    you: { gid: 1000, members: [] },
    ngozi: { gid: 1001, members: [] },
  },
});

const hostAccounts =
  (service: string, uid: number): (() => Accounts) =>
  () => ({
    users: {
      root: { uid: 0, group: 'root', home: '/root' },
      prometheus: { uid: 110, group: 'prometheus', home: '/var/lib/prometheus', shell: '/usr/sbin/nologin' },
      [service]: { uid, group: service, home: `/srv/${service}`, shell: '/usr/sbin/nologin' },
      you: { uid: 1000, group: 'you' },
    },
    groups: {
      root: { gid: 0, members: [] },
      adm: { gid: 4, members: ['you'] },
      sudo: { gid: 27, members: ['you'] },
      prometheus: { gid: 117, members: [] },
      [service]: { gid: uid, members: [] },
      you: { gid: 1000, members: [] },
    },
  });

// ——— Helpers ———

const principal = (j: Game): Shell => (j as Shell).principal;
export const sd = (j: Game) => systemd(principal(j))!;
export const now = (j: Game) => sd(j).clock;
/** The time the metrics are computed for: Prometheus's current tick while time passes, otherwise the clock. */
export const metricTime = (j: Game) => (prom(principal(j))?.lastTick as number | undefined) || now(j);
export const host = (j: Game, name: 'saddle' | 'hub'): Shell => principal(j).internal(name)!;
export const running = (s: Game, name: string) => systemd(s)?.services[name]?.state === 'active';
/** What a machine of the story last printed (gauge, saddle or hub). */
export function seen(j: Game, text: string | RegExp): boolean {
  const p = principal(j);
  const shells = [p, ...(['saddle', 'hub'] as const).map((n) => p.internals.get(n)).filter((x): x is Shell => !!x)];
  return shells.some((s) => {
    const all = `${s.last.output}\n${s.last.errors.join('\n')}`;
    return typeof text === 'string' ? all.includes(text) : text.test(all);
  });
}
export const typed = (j: Game) => principal(j).commandLine ?? '';

// ——— The network ———

/** The names gauge knows (its /etc/hosts), in the game's language. */
export function names(t: Translate): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [id, address] of [
    ['gauge', GAUGE],
    ['saddle', SADDLE],
    ['hub', HUB],
  ] as const) {
    const n = machineName(t, id);
    out[n] = address;
    out[`${n}.internal`] = address;
    out[address] = address;
  }
  return out;
}

/** The machine at an address, seen from a machine (127.0.0.1 is itself). */
function machineAt(from: Game, address: string): Shell | null {
  const p = principal(from);
  if (['127.0.0.1', '::1', 'localhost'].includes(address)) return from as Shell;
  if (address === GAUGE) return p;
  if (address === SADDLE) return p.internal('saddle');
  if (address === HUB) return p.internal('hub');
  return null;
}

const addressOf = (s: Game): string => {
  const p = principal(s);
  if (s === p) return GAUGE;
  if (s === p.internals.get('saddle')) return SADDLE;
  if (s === p.internals.get('hub')) return HUB;
  return GAUGE;
};

/** hub is away for its maintenance (chapter 3), whatever is asked of it. */
const away = (target: Shell) => {
  const p = principal(target);
  const m = p.state.maintenance as { from: number; to: number } | undefined;
  const t = metricTime(p);
  return !!m && target === p.internals.get('hub') && t >= m.from && t < m.to;
};

const html = (code: number, body: string): Reply => ({ kind: 'http', code, body, type: 'text/html; charset=utf-8' });
const plain = (code: number, body: string): Reply => ({ kind: 'http', code, body, type: 'text/plain; charset=utf-8' });

export const NET: MetricsNet = {
  addressOf,
  resolve(from, name) {
    const n = name.toLowerCase();
    if (['localhost', '127.0.0.1', '::1', 'ip6-localhost'].includes(n)) return '127.0.0.1';
    return names(from.t)[n] ?? null;
  },
  request(from, address, port, method, path, query, body) {
    const target = machineAt(from, address);
    if (!target) return { kind: 'timeout' };
    if (away(target)) return { kind: 'timeout' };
    const local = target === from;
    // The target's firewall (ufw), unless the request comes from the machine itself.
    const fw = target.state.ufw as Firewall | undefined;
    if (!local && fw) {
      const v = verdict(fw, port, addressOf(from));
      if (v === 'blocked') return { kind: 'timeout' };
      if (v === 'refused') return { kind: 'refused' };
    }
    const p = principal(from);
    const on = (svc: string) => running(target, svc);
    if (target === p) {
      if (port === 9090) {
        if (!on('prometheus') || !prom(p)?.up) return { kind: 'refused' };
        if (path === '/metrics') return { kind: 'metrics', families: selfMetrics(prom(p)!) };
        return { kind: 'http', ...promHttp(p, method, path.split('?')[0], query) };
      }
      if (port === 9093) {
        if (!on('prometheus-alertmanager') || !am(p)?.up) return { kind: 'refused' };
        return { kind: 'http', ...amHttp(p, method, path.split('?')[0], query, body) };
      }
      if (port === 9099) {
        if (!on('alert-relay')) return { kind: 'refused' };
        return relay(p, method, path, body);
      }
    }
    if (port === 9100) {
      if (!on('prometheus-node-exporter')) return { kind: 'refused' };
      if (path === '/metrics') return { kind: 'metrics', families: nodeFamilies(target) };
      if (path === '/') return html(200, '<html>\n<head><title>Node Exporter</title></head>\n<body>\n<h1>Node Exporter</h1>\n<p><a href="/metrics">Metrics</a></p>\n</body>\n</html>\n');
      return plain(404, '404 page not found\n');
    }
    if (target === p.internals.get('saddle') && port === 3000) {
      if (!on('rental')) return { kind: 'refused' };
      if (path === '/metrics') return { kind: 'metrics', families: appFamilies(target) };
      if (path === '/health') return plain(200, 'ok');
      if (path === '/') return { kind: 'http', code: 200, body: `{"service":"rental","version":"${(p.state.incident as { to: number } | null)?.to === Infinity ? '2.4.0' : rentalVersion(target)}","stations":4}`, type: 'application/json; charset=utf-8' };
      return html(404, `<!DOCTYPE html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n<title>Error</title>\n</head>\n<body>\n<pre>Cannot ${method} ${path}</pre>\n</body>\n</html>\n`);
    }
    return { kind: 'refused' };
  },
};

// ——— The relay: the Alertmanager's webhooks, posted to the chat ———

function relay(p: Shell, method: string, path: string, body: string): Reply {
  const channels: Record<string, string> = { '/team': '#team', '/on-call': '#on-call' };
  if (method !== 'POST') return plain(200, 'alert-relay: POST the Alertmanager\'s webhooks to /team or /on-call\n');
  const channel = channels[path];
  if (!channel) return plain(404, 'unknown channel\n');
  let v: { status: string; alerts: { labels: Labels; status: string }[] };
  try {
    v = JSON.parse(body);
  } catch {
    return plain(400, 'bad request\n');
  }
  const n = p.find(RELAY_LOG);
  const t = now(p);
  const at = new Date((p.state.prometheus?.lastTick as number) || t).toISOString().replace('.000Z', 'Z');
  const lines = v.alerts.map((a) => `${at} ${channel} ${a.status.toUpperCase()} ${a.labels.alertname ?? ''} ${Object.entries(a.labels).filter(([k]) => k !== 'alertname').sort(([x], [y]) => x.localeCompare(y)).map(([k, x]) => `${k}=${x}`).join(' ')}`.trimEnd());
  if (n?.type === 'file' && typeof n.content === 'string') n.content = n.content ? `${n.content}\n${lines.join('\n')}` : lines.join('\n');
  return plain(200, 'ok\n');
}

// ——— What the exporters expose ———

interface Profile {
  cpus: number;
  busy: number;
  load: number;
  memory: number;
  available: number;
  receive: number;
  transmit: number;
}
const PROFILES: Record<string, Profile> = {
  gauge: { cpus: 2, busy: 0.08, load: 0.21, memory: 4 * GiB, available: 2.6 * GiB, receive: 21_000, transmit: 9_000 },
  saddle: { cpus: 2, busy: 0.22, load: 0.64, memory: 4 * GiB, available: 1.7 * GiB, receive: 64_000, transmit: 118_000 },
  hub: { cpus: 2, busy: 0.12, load: 0.35, memory: 2 * GiB, available: 1.1 * GiB, receive: 39_000, transmit: 12_000 },
};
const idOf = (s: Game) => {
  const p = principal(s);
  return s === p ? 'gauge' : s === p.internals.get('saddle') ? 'saddle' : 'hub';
};

// The file systems' usage, like df: computed once per time step (passTime), or now.
let usageCache: Map<Game, { path: string; device: string; fstype: string; size: number; used: number }[]> | null = null;
export function fsUsage(s: Game): { path: string; device: string; fstype: string; size: number; used: number }[] {
  const cached = usageCache?.get(s);
  if (cached) return cached;
  const sh = s as Shell;
  const mounts = (sh.state.mounts ?? []) as { path: string; capacity: number; name: string; system?: string }[];
  return mounts.map((m) => {
    const inside = mounts.filter((x) => x.path !== m.path && (m.path === '/' || x.path.startsWith(m.path + '/')));
    const place = sh.find(m.path);
    const other = inside.reduce((t, x) => t + ((n) => (n ? sh.size(n) : 0))(sh.find(x.path)), 0);
    const used = Math.min(m.capacity, (place ? sh.size(place) : 0) - other);
    return { path: m.path, device: m.name, fstype: m.system ?? 'ext4', size: m.capacity, used };
  });
}

export function nodeFamilies(s: Game): Family[] {
  const id = idOf(s);
  const pr = PROFILES[id];
  const t = metricTime(s);
  const up = (t - BOOT) / 1000;
  const wave = Math.sin(t / 600_000) * 0.05;
  const cpu: Family = { name: 'node_cpu_seconds_total', help: 'Seconds the CPUs spent in each mode.', type: 'counter', samples: [] };
  for (let c = 0; c < pr.cpus; c++)
    for (const [mode, share] of [
      ['idle', 1 - pr.busy],
      ['iowait', pr.busy * 0.08],
      ['system', pr.busy * 0.27],
      ['user', pr.busy * 0.65],
    ] as [string, number][])
      cpu.samples.push({ labels: { cpu: String(c), mode }, v: Math.round(up * share * 100) / 100 });
  const fs = fsUsage(s);
  const fsLabels = (x: (typeof fs)[number]) => ({ device: x.device, fstype: x.fstype, mountpoint: x.path });
  const tmpfs = { device: 'tmpfs', fstype: 'tmpfs', mountpoint: '/run' };
  const RUN = 402_653_184;
  return [
    { name: 'node_boot_time_seconds', help: 'Node boot time, in unixtime.', type: 'gauge', samples: [{ labels: {}, v: BOOT / 1000 }] },
    cpu,
    {
      name: 'node_exporter_build_info',
      help: "A metric with a constant '1' value labeled by version, revision, branch, goversion from which node_exporter was built, and the goos and goarch for the build.",
      type: 'gauge',
      samples: [{ labels: { branch: 'debian/sid', goarch: 'amd64', goos: 'linux', goversion: 'go1.24.4', revision: '1.9.0-1', tags: 'unknown', version: '1.9.0' }, v: 1 }],
    },
    { name: 'node_filesystem_avail_bytes', help: 'Filesystem space available to non-root users in bytes.', type: 'gauge', samples: [...fs.map((x) => ({ labels: fsLabels(x), v: Math.max(0, x.size - x.used) })), { labels: tmpfs, v: RUN - 1_327_104 }] },
    { name: 'node_filesystem_free_bytes', help: 'Filesystem free space in bytes.', type: 'gauge', samples: [...fs.map((x) => ({ labels: fsLabels(x), v: Math.max(0, x.size - x.used) + Math.round(x.size * 0.05) })), { labels: tmpfs, v: RUN - 1_327_104 }] },
    { name: 'node_filesystem_readonly', help: 'Filesystem read-only status.', type: 'gauge', samples: [...fs.map((x) => ({ labels: fsLabels(x), v: 0 })), { labels: tmpfs, v: 0 }] },
    { name: 'node_filesystem_size_bytes', help: 'Filesystem size in bytes.', type: 'gauge', samples: [...fs.map((x) => ({ labels: fsLabels(x), v: x.size })), { labels: tmpfs, v: RUN }] },
    { name: 'node_load1', help: '1m load average.', type: 'gauge', samples: [{ labels: {}, v: Math.round((pr.load + wave) * 100) / 100 }] },
    { name: 'node_load5', help: '5m load average.', type: 'gauge', samples: [{ labels: {}, v: Math.round((pr.load + wave / 2) * 100) / 100 }] },
    { name: 'node_load15', help: '15m load average.', type: 'gauge', samples: [{ labels: {}, v: pr.load }] },
    { name: 'node_memory_MemAvailable_bytes', help: 'Memory information field MemAvailable_bytes.', type: 'gauge', samples: [{ labels: {}, v: Math.round(pr.available * (1 + wave / 5)) }] },
    { name: 'node_memory_MemTotal_bytes', help: 'Memory information field MemTotal_bytes.', type: 'gauge', samples: [{ labels: {}, v: pr.memory }] },
    { name: 'node_network_receive_bytes_total', help: 'Network device statistic receive_bytes.', type: 'counter', samples: [{ labels: { device: 'eth0' }, v: Math.round(up * pr.receive) }, { labels: { device: 'lo' }, v: Math.round(up * 800) }] },
    { name: 'node_network_transmit_bytes_total', help: 'Network device statistic transmit_bytes.', type: 'counter', samples: [{ labels: { device: 'eth0' }, v: Math.round(up * pr.transmit) }, { labels: { device: 'lo' }, v: Math.round(up * 800) }] },
    { name: 'node_uname_info', help: 'Labeled system information as provided by the uname system call.', type: 'gauge', samples: [{ labels: { domainname: '(none)', machine: 'x86_64', nodename: machineName(s.t, id), release: '6.12.0-quetes', sysname: 'Linux', version: '#1 SMP PREEMPT_DYNAMIC Debian 6.12.27-1 (2025-05-08)' }, v: 1 }] },
  ];
}

// ——— The rental app's traffic ———

// Requests per second, by route and status; 5xx come from /returns.
export const RATES = { stations: 2.4, notFound: 0.03, rentals: 0.6, returns: 1.0 };
const BASE_ERRORS = 0.04;
const SPIKE_EXTRA = 0.66;
const INCIDENT_ERRORS = 0.5;

/** Seconds spent in "spike" minutes (the 12th and 13th of each quarter of an hour: a station reconnecting) from 0 to t. */
function spikeSeconds(t: number): number {
  const m = Math.floor(t / 60_000);
  const frac = (t % 60_000) / 1000;
  const r = m % 15;
  return Math.floor(m / 15) * 120 + (r > 12 ? 120 : r === 12 ? 60 + frac : r === 11 ? frac : 0);
}

/** 5xx answers given from 0 to t (a cumulative integral), with an incident between `from` and `to`. */
export function errorsUntil(t: number, incident: { from: number; to: number } | null): number {
  let e = (BASE_ERRORS * t) / 1000 + SPIKE_EXTRA * spikeSeconds(t);
  if (incident && t > incident.from) {
    const u = Math.min(t, incident.to);
    e += ((INCIDENT_ERRORS - BASE_ERRORS) * (u - incident.from)) / 1000 - SPIKE_EXTRA * (spikeSeconds(u) - spikeSeconds(incident.from));
  }
  return e;
}

/** The counters of an app process started at `start`, at t. */
export function appCounters(start: number, t: number, incident: { from: number; to: number } | null) {
  const dt = Math.max(0, (t - start) / 1000);
  const errors = Math.floor(errorsUntil(t, incident) - errorsUntil(start, incident));
  return {
    stations: Math.floor(RATES.stations * dt),
    notFound: Math.floor(RATES.notFound * dt),
    rentals: Math.floor(RATES.rentals * dt),
    returnsOk: Math.floor(RATES.returns * dt) - errors,
    errors,
  };
}

const rentalVersion = (s: Game) => (s.read('/srv/rental/VERSION') ?? '2.4.0').trim();

export function appFamilies(s: Game): Family[] {
  const p = principal(s);
  const t = metricTime(s);
  const start = (s.state.rentalStart as number) ?? BOOT;
  const c = appCounters(start, t, (p.state.incident as { from: number; to: number } | null) ?? null);
  const total = c.stations + c.notFound + c.rentals + c.returnsOk + c.errors;
  const buckets: [string, number][] = [
    ['0.05', 0.62],
    ['0.1', 0.85],
    ['0.25', 0.95],
    ['0.5', 0.985],
    ['1', 0.997],
    ['+Inf', 1],
  ];
  const stations: [string, number][] = [
    ['harbour', 7],
    ['market', 3],
    ['school', 11],
    ['library', 5],
  ];
  const minute = Math.floor(t / 60_000);
  return [
    { name: 'http_requests_total', help: 'HTTP requests handled, by method, route and status code.', type: 'counter', samples: [
      { labels: { method: 'GET', route: '/stations', status: '200' }, v: c.stations },
      { labels: { method: 'GET', route: '/stations/:id', status: '404' }, v: c.notFound },
      { labels: { method: 'POST', route: '/rentals', status: '201' }, v: c.rentals },
      { labels: { method: 'POST', route: '/returns', status: '200' }, v: c.returnsOk },
      { labels: { method: 'POST', route: '/returns', status: '500' }, v: c.errors },
    ] },
    { name: 'http_request_duration_seconds', help: 'HTTP request duration in seconds.', type: 'histogram', samples: [
      ...buckets.map(([le, share]) => ({ name: 'http_request_duration_seconds_bucket', labels: { le }, v: Math.floor(total * share) })),
      { name: 'http_request_duration_seconds_sum', labels: {}, v: Math.round(total * 0.071 * 1000) / 1000 },
      { name: 'http_request_duration_seconds_count', labels: {}, v: total },
    ] },
    { name: 'rental_bikes_available', help: 'Bikes docked and available, by station.', type: 'gauge', samples: stations.map(([station, n], i) => ({ labels: { station }, v: Math.max(0, n + ((minute + i) % 3) - 1) })) },
    { name: 'process_resident_memory_bytes', help: 'Resident memory size in bytes.', type: 'gauge', samples: [{ labels: {}, v: 91_234_304 }] },
    { name: 'process_start_time_seconds', help: 'Start time of the process since unix epoch in seconds.', type: 'gauge', samples: [{ labels: {}, v: Math.floor(start / 1000) }] },
  ];
}

// ——— Time passing ———

setHooks({
  onTick: (j, t) => tickAm(j, t),
  send: (j, address, alerts, t) => {
    const m = /^([^:]+)(?::(\d+))?$/.exec(address);
    if (!m) return false;
    const a = NET.resolve(j, m[1]);
    const r = a ? NET.request(j, a, Number(m[2] ?? 80), 'GET', '/-/healthy', {}, '') : null;
    if (!r || r.kind !== 'http' || r.code !== 200) return false;
    receive(j, alerts, t);
    return true;
  },
});

/** Each command, a minute (sleep: more): scrapes, rules, notifications; the internal machines keep the same time. */
export function passTime(j: Game) {
  const p = principal(j);
  const s = sd(p);
  let slept = 0;
  for (const x of [p, ...p.internals.values()]) {
    slept += (x.state.slept as number) ?? 0;
    x.state.slept = 0;
  }
  // A long sleep is cut to a day.
  const target = s.clock + 60_000 + Math.min(slept, 86_400_000);
  usageCache = new Map([p, ...p.internals.values()].map((x) => [x, fsUsage(x)]));
  try {
    advance(p, target);
  } finally {
    usageCache = null;
  }
  s.clock = target;
  for (const x of p.internals.values()) {
    const xs = systemd(x);
    if (xs) xs.clock = target;
  }
}

// ——— The services ———

const proc = (pid: number, user: string, command: string, ignores?: string[]): Process => ({ pid, user, cpu: 0.2, mem: 1.1, command, ...(ignores ? { ignores } : {}) });

function gaugeServices(): Record<string, DefinitionService> {
  const promProcess = proc(PROM_PID, 'prometheus', '/usr/bin/prometheus', ['HUP']);
  const amProcess = proc(AM_PID, 'prometheus', '/usr/bin/prometheus-alertmanager', ['HUP']);
  return {
    ssh: { description: 'OpenBSD Secure Shell server', active: true, executable: 'sshd', process: [proc(588, 'root', 'sshd: /usr/sbin/sshd -D [listener] 0 of 10-100 startups')] },
    prometheus: {
      description: 'Monitoring system and time series database',
      active: true,
      executable: 'prometheus',
      process: [promProcess],
      check: (j) => {
        const r = readAll(j);
        return 'error' in r ? [`ts=${new Date(now(j)).toISOString()} caller=main.go:1415 level=error msg="Error loading config (--config.file=/etc/prometheus/prometheus.yml)" file=/etc/prometheus/prometheus.yml err="${r.error.replace(/"/g, '\\"').replace(/\n/g, '\\n')}"`] : null;
      },
      load: (j) => {
        const p = prom(j)!;
        if (p.up) reloadProm(j, now(j));
        else startProm(j, now(j));
      },
      stop: (j) => stopProm(j, now(j)),
    },
    'prometheus-node-exporter': { description: 'Prometheus exporter for machine metrics', active: true, executable: 'prometheus-node-exporter', process: [proc(790, 'prometheus', '/usr/bin/prometheus-node-exporter')] },
    'prometheus-alertmanager': {
      description: 'Alertmanager for prometheus',
      active: true,
      executable: 'prometheus-alertmanager',
      process: [amProcess],
      check: (j) => {
        try {
          readAmConfig(j.read(AM_CONFIG) ?? '');
          return null;
        } catch (e) {
          return [`ts=${new Date(now(j)).toISOString()} caller=coordinator.go:118 level=error component=configuration msg="Loading configuration file failed" file=${AM_CONFIG} err="${(e as Error).message.replace(/"/g, '\\"').replace(/\n/g, '\\n')}"`];
        }
      },
      load: (j) => {
        const a = am(j)!;
        if (a.up) reloadAm(j, now(j));
        else startAm(j, now(j));
      },
      stop: (j) => stopAm(j, now(j)),
    },
    'alert-relay': { description: 'Alertmanager webhooks to the volunteers\' chat', active: true, executable: 'alert-relay', process: [proc(861, 'nobody', '/usr/local/bin/alert-relay --listen 127.0.0.1:9099')] },
  };
}

const LISTENING_GAUGE: Listening[] = [
  { proto: 'tcp', address: '0.0.0.0', port: 22, process: 'sshd', pid: 588 },
  { proto: 'tcp', address: '*', port: 9090, process: 'prometheus', pid: PROM_PID },
  { proto: 'tcp', address: '*', port: 9093, process: 'prometheus-aler', pid: AM_PID },
  { proto: 'tcp', address: '*', port: 9094, process: 'prometheus-aler', pid: AM_PID },
  { proto: 'tcp', address: '127.0.0.1', port: 9099, process: 'alert-relay', pid: 861 },
  { proto: 'tcp', address: '*', port: 9100, process: 'prometheus-node', pid: 790 },
];

/** gauge's state at the start of a chapter. */
export function gaugeState(t: Translate, chapter: ChapterNo) {
  const at = chapter === 1 ? NOW_1 : chapter === 2 ? NOW_2 : NOW_3;
  const services = gaugeServices();
  return {
    systemd: newSystemd(machineName(t, 'gauge'), BOOT, at, services),
    process: Object.values(services).flatMap((s) => s.process ?? []),
    prometheus: newProm(),
    alertmanager: newAm(),
    metricsNet: NET,
    metricsHere: true,
    incident: chapter === 2 ? { from: INCIDENT, to: Infinity } : null,
    ...(chapter === 3 ? { maintenance: { from: MAINTENANCE_FROM, to: MAINTENANCE_TO } } : {}),
    listening: LISTENING_GAUGE,
    mounts: [{ path: '/', capacity: 40 * GiB, name: '/dev/vda1', system: 'ext4' }],
    onSignal: (j: Game, p: Process, signal: string) => {
      if (signal !== 'HUP') return;
      if (p.pid === PROM_PID) reloadProm(j, now(j));
      if (p.pid === AM_PID) reloadAm(j, now(j));
    },
  };
}

/** At the start: the daemons read their configuration, and the last 40 minutes are replayed (scrapes, rules, notifications). */
export function initialiseGauge(j: Game) {
  const s = j as Shell;
  const t = now(j);
  const start = t - 40 * 60_000;
  const p = prom(j)!;
  startProm(j, start);
  startAm(j, start);
  p.lastTick = start - 15_000;
  // The internal machines exist from the start (their state is scraped).
  s.internal('saddle');
  s.internal('hub');
  usageCache = new Map([s, ...s.internals.values()].map((x) => [x, fsUsage(x)]));
  try {
    advance(j, t);
  } finally {
    usageCache = null;
  }
  sd(j).clock = t;
  sd(j).log.sort((a, b) => a.time - b.time);
}

// ——— The configuration files ———

/** Aroha's prometheus.yml (chapter 1), or as chapter 1 left it. */
export const prometheusYml = (t: Translate, chapter: ChapterNo) => {
  const saddle = `${machineName(t, 'saddle')}.internal`;
  const hub = `${machineName(t, 'hub')}.internal`;
  return `# ${t('bike-share-prometheus-comment')}
# Debian: /etc/prometheus/prometheus.yml (see man prometheus)

global:
  scrape_interval: 15s
  evaluation_interval: 15s
  external_labels:
    monitor: 'bikes'

alerting:
  alertmanagers:
    - static_configs:
        - targets: ['localhost:9093']

rule_files:
  - 'rules/*.yml'

scrape_configs:
  - job_name: 'prometheus'
    static_configs:
      - targets: ['localhost:9090']

  - job_name: 'node'
    static_configs:
      - targets: ['localhost:9100', '${saddle}:9100'${chapter === 1 ? '' : `, '${hub}:9100'`}]

  - job_name: 'rental'
    static_configs:
      - targets: ['${chapter === 1 ? 'localhost' : saddle}:3000']
`;
};

/** The rules chapter 2 leaves (chapter 3 starts with them, and NodeDown). */
export const rulesYml = (t: Translate) => `groups:
  - name: bikes
    rules:
      - alert: DiskAlmostFull
        expr: node_filesystem_avail_bytes{fstype!="tmpfs"} / node_filesystem_size_bytes < 0.10
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "${t('bike-share-rule-disk-summary')}"

      - alert: HighErrorRate
        expr: sum by (job) (rate(http_requests_total{status=~"5.."}[5m])) / sum by (job) (rate(http_requests_total[5m])) > 0.05
        for: 10m
        labels:
          severity: page
        annotations:
          summary: "${t('bike-share-rule-errors-summary')}"

      - alert: NodeDown
        expr: up{job="node"} == 0
        for: 2m
        labels:
          severity: page
        annotations:
          summary: "${t('bike-share-rule-node-summary')}"
`;

/** Aroha's alertmanager.yml: a matcher that no rule uses, and a repeat every minute. */
export const ALERTMANAGER_YML = `# Alertmanager configuration (Aroha, March 2029)
# Debian: /etc/prometheus/alertmanager.yml (see man prometheus-alertmanager)

global:
  resolve_timeout: 5m

route:
  receiver: team
  group_by: ['alertname']
  group_wait: 30s
  group_interval: 5m
  repeat_interval: 1m
  routes:
    - matchers:
        - severity="critical"
      receiver: on-call

receivers:
  - name: team
    webhook_configs:
      - url: http://127.0.0.1:9099/team
  - name: on-call
    webhook_configs:
      - url: http://127.0.0.1:9099/on-call
`;

const DEFAULT_PROMETHEUS = `# Set the command-line arguments to pass to the server.
# Due to shell escaping, to pass backslashes for regexes, you need to double
# them (\\\\d for \\d). If running under systemd, you need to double them again
# (\\\\\\\\d to mean \\d), and escape newlines too.
ARGS=""

# Prometheus supports the following options:
#
#  --config.file="/etc/prometheus/prometheus.yml"
#    Prometheus configuration file path.
#  --web.listen-address="0.0.0.0:9090"
#    Address to listen on for UI, API, and telemetry.
#  --web.enable-lifecycle
#    Enable shutdown and reload via HTTP request.
#  --storage.tsdb.path="/var/lib/prometheus/metrics2/"
#    Base path for metrics storage.
#  --storage.tsdb.retention.time=15d
#    How long to retain samples in storage.`;

/** What the relay posted before the chapter (chapter 3): Tuesday's unseen NodeDown, then the same warning every minute. */
function relayHistory(t: Translate, chapter: ChapterNo): string {
  if (chapter !== 3) return '';
  const saddle = `${machineName(t, 'saddle')}.internal`;
  const lines = [
    `2029-05-15T21:47:30Z #team FIRING NodeDown instance=${saddle}:9100 job=node monitor=bikes severity=page`,
    `2029-05-15T21:51:30Z #team RESOLVED NodeDown instance=${saddle}:9100 job=node monitor=bikes severity=page`,
  ];
  return lines.join('\n');
}

const HOSTS = (t: Translate) =>
  [
    '127.0.0.1\tlocalhost',
    `${GAUGE}\t${machineName(t, 'gauge')}.internal ${machineName(t, 'gauge')}`,
    `${SADDLE}\t${machineName(t, 'saddle')}.internal ${machineName(t, 'saddle')}`,
    `${HUB}\t${machineName(t, 'hub')}.internal ${machineName(t, 'hub')}`,
    '',
    '# The following lines are desirable for IPv6 capable hosts',
    '::1     localhost ip6-localhost ip6-loopback',
  ].join('\n');

const big = (size: number, rights: Rights = { owner: 'root' }) => f('', { size, ...rights });

/** gauge's world: the system, Prometheus's and the Alertmanager's files, and what the chapter adds in the home directory. */
export function gaugeWorld(t: Translate, chapter: ChapterNo, home: Record<string, Node>): Directory {
  const root: Rights = { owner: 'root' };
  const place = (children: Parameters<typeof d>[0], rights: Rights = root) => d(children, undefined, rights);
  const file = (text: string, rights: Rights = root) => f(text, { lines: true, ...rights });
  const key = generateKey('bike-share-gauge', `you@${machineName(t, 'gauge')}`);
  return place({
    etc: place({
      ...accountsFiles(),
      hostname: file(machineName(t, 'gauge')),
      hosts: file(HOSTS(t)),
      'resolv.conf': file('search internal\nnameserver 192.0.2.1'),
      default: place({ prometheus: file(DEFAULT_PROMETHEUS), 'prometheus-alertmanager': file('# Set the command-line arguments to pass to the server.\nARGS=""'), 'prometheus-node-exporter': file('# Set the command-line arguments to pass to the server.\nARGS=""') }),
      prometheus: place({
        'prometheus.yml': file(prometheusYml(t, chapter)),
        'alertmanager.yml': file(ALERTMANAGER_YML),
        rules: place(chapter === 3 ? { 'bikes.yml': file(rulesYml(t)) } : {}),
      }),
      amtool: place({ 'config.yml': file('# amtool configuration (see man amtool)\nalertmanager.url: http://localhost:9093\n') }),
    }),
    home: place({
      you: d({ ...home, '.ssh': d({ id_ed25519: f(key.isPrivate, { lines: true, mode: 'rw-------' }), 'id_ed25519.pub': f(key.isPublic, { lines: true }) }, undefined, { mode: 'rwx------' }) }),
      ngozi: place({}, { owner: 'ngozi', mode: 'rwx------' }),
    }),
    root: place({}, { owner: 'root', mode: 'rwx------' }),
    tmp: place({}, { owner: 'root', mode: 'rwxrwxrwt' }),
    usr: place({ lib: big(3.1 * GiB) }),
    var: place({
      lib: place({ prometheus: place({ metrics2: big(6.4 * GiB, { owner: 'prometheus' }) }, { owner: 'prometheus', mode: 'rwxr-x---' }) }),
      log: place({
        'alert-relay': place({ 'relay.log': file(relayHistory(t, chapter), { owner: 'nobody', group: 'adm', mode: 'rw-r--r--' }) }, { owner: 'root', group: 'adm', mode: 'rwxr-xr-x' }),
      }),
    }),
  });
}

// ——— saddle and hub, the monitored machines ———

/** saddle's firewall: ssh, the public site through nginx, the app's port for gauge only (9100 forgotten in chapter 1). */
export const saddleFirewall = (chapter: ChapterNo): Firewall => ({
  ...newFirewall(),
  enabled: true,
  rules: [
    { action: 'allow', to: '22/tcp', ports: [22], forEachOf: null },
    { action: 'allow', to: '80/tcp', ports: [80], forEachOf: null },
    { action: 'allow', to: '3000/tcp', ports: [3000], forEachOf: GAUGE },
    ...(chapter === 1 ? [] : [{ action: 'allow' as const, to: '9100/tcp', ports: [9100], forEachOf: GAUGE }]),
  ],
});
const hubFirewall = (): Firewall => ({
  ...newFirewall(),
  enabled: true,
  rules: [
    { action: 'allow', to: '22/tcp', ports: [22], forEachOf: null },
    { action: 'allow', to: '8443/tcp', ports: [8443], forEachOf: null },
    { action: 'allow', to: '9100/tcp', ports: [9100], forEachOf: GAUGE },
  ],
});

export const HOST_COMMANDS = ['ls', 'cd', 'pwd', 'cat', 'less', 'head', 'tail', 'grep', 'nano', 'sudo', 'df', 'du', 'rm', 'mv', 'ss', 'ufw', 'curl', 'systemctl', 'journalctl', 'sleep', 'exit'];

function hostWorld(t: Translate, id: 'saddle' | 'hub', chapter: ChapterNo, extra: Record<string, Node>): Directory {
  const root: Rights = { owner: 'root' };
  const place = (children: Parameters<typeof d>[0], rights: Rights = root) => d(children, undefined, rights);
  const file = (text: string, rights: Rights = root) => f(text, { lines: true, ...rights });
  const key = generateKey('bike-share-gauge', `you@${machineName(t, 'gauge')}`);
  void chapter;
  return place({
    etc: place({
      ...accountsFiles(),
      hostname: file(machineName(t, id)),
      hosts: file(HOSTS(t)),
      default: place({ 'prometheus-node-exporter': file('# Set the command-line arguments to pass to the server.\nARGS=""') }),
    }),
    home: place({ you: d({ 'README.txt': f(t(`bike-share-${id}-readme`)), '.ssh': d({ authorized_keys: f(key.isPublic, { lines: true, mode: 'rw-------' }) }, undefined, { mode: 'rwx------' }) }) }),
    root: place({}, { owner: 'root', mode: 'rwx------' }),
    tmp: place({}, { owner: 'root', mode: 'rwxrwxrwt' }),
    usr: place({ lib: big(2.6 * GiB) }),
    ...extra,
  });
}

const hostSystemd = (t: Translate, id: string, at: number, more: Record<string, DefinitionService>) =>
  newSystemd(machineName(t, id), BOOT, at, {
    ssh: { description: 'OpenBSD Secure Shell server', active: true, executable: 'sshd', process: [proc(602, 'root', 'sshd: /usr/sbin/sshd -D [listener] 0 of 10-100 startups')] },
    'prometheus-node-exporter': { description: 'Prometheus exporter for machine metrics', active: true, executable: 'prometheus-node-exporter', process: [proc(711, 'prometheus', '/usr/bin/prometheus-node-exporter')] },
    ...more,
  });

const at = (chapter: ChapterNo) => (chapter === 1 ? NOW_1 : chapter === 2 ? NOW_2 : NOW_3);

export function saddleHost(chapter: ChapterNo): InternalHost {
  return {
    address: SADDLE,
    domain: 'saddle.internal',
    accounts: hostAccounts('rental', 998),
    commands: HOST_COMMANDS,
    afterCommand: passTime,
    state: (t) => ({
      systemd: hostSystemd(t, 'saddle', at(chapter), {
        rental: {
          description: 'Bike share rental app',
          active: true,
          executable: 'node',
          process: [proc(930, 'rental', '/usr/bin/node /srv/rental/server.js')],
          // The process starts again: its counters begin at zero; the release on disk is the one that runs.
          load: (j) => {
            const p = principal(j);
            j.state.rentalStart = now(p);
            const inc = p.state.incident as { from: number; to: number } | null;
            if (inc && inc.to === Infinity && now(p) >= inc.from) inc.to = now(p);
          },
        },
      }),
      process: [proc(602, 'root', 'sshd: /usr/sbin/sshd -D'), proc(711, 'prometheus', '/usr/bin/prometheus-node-exporter'), proc(930, 'rental', '/usr/bin/node /srv/rental/server.js')],
      ufw: saddleFirewall(chapter),
      metricsHere: true,
      // The app's process started this morning (chapter 2: with the faulty release).
      rentalStart: at(chapter) - (chapter === 2 ? 60 : 300) * 60_000,
      listening: [
        { proto: 'tcp', address: '0.0.0.0', port: 22, process: 'sshd', pid: 602 },
        { proto: 'tcp', address: '0.0.0.0', port: 80, process: 'nginx', pid: 655 },
        { proto: 'tcp', address: '*', port: 3000, process: 'node', pid: 930 },
        { proto: 'tcp', address: '*', port: 9100, process: 'prometheus-node', pid: 711 },
      ] satisfies Listening[],
      mounts: [{ path: '/', capacity: 30 * GiB, name: '/dev/vda1', system: 'ext4' }, ...(chapter === 3 ? [{ path: '/var/lib/rental', capacity: 10 * GiB, name: '/dev/vdb1', system: 'ext4' }] : [])],
    }),
    createWorld: (t) =>
      hostWorld(t, 'saddle', chapter, {
        srv: d(
          {
            rental: d(
              {
                'server.js': f("const app = require('./app');\nconst metrics = require('./metrics'); // prom-client: GET /metrics\napp.listen(process.env.PORT || 3000);", { lines: true, owner: 'rental' }),
                VERSION: f(chapter === 2 ? '2.4.1' : chapter === 3 ? '2.4.1' : '2.3.2', { lines: true, owner: 'rental' }),
                ...(chapter === 2 ? { 'RELEASE-NOTES.txt': f(t('threshold-release-notes'), { owner: 'rental' }) } : {}),
              },
              undefined,
              { owner: 'rental', group: 'rental' },
            ),
          },
          undefined,
          { owner: 'root' },
        ),
        var: d(
          {
            log: d({}, undefined, { owner: 'root', group: 'adm' }),
            lib: d({ rental: d(chapter === 3 ? { photos: big(9.2 * GiB, { owner: 'rental' }) } : {}, undefined, { owner: 'rental' }), cache: big(1.4 * GiB) }, undefined, { owner: 'root' }),
          },
          undefined,
          { owner: 'root' },
        ),
      }),
  };
}

export function hubHost(chapter: ChapterNo): InternalHost {
  return {
    address: HUB,
    domain: 'hub.internal',
    accounts: hostAccounts('docks', 997),
    commands: HOST_COMMANDS,
    afterCommand: passTime,
    state: (t) => ({
      systemd: hostSystemd(t, 'hub', at(chapter), {
        docks: { description: 'Docking stations gateway', active: true, executable: 'docks-gateway', process: [proc(944, 'docks', '/usr/local/bin/docks-gateway --listen :8443')] },
      }),
      process: [proc(602, 'root', 'sshd: /usr/sbin/sshd -D'), proc(711, 'prometheus', '/usr/bin/prometheus-node-exporter'), proc(944, 'docks', '/usr/local/bin/docks-gateway --listen :8443')],
      ufw: hubFirewall(),
      metricsHere: true,
      listening: [
        { proto: 'tcp', address: '0.0.0.0', port: 22, process: 'sshd', pid: 602 },
        { proto: 'tcp', address: '*', port: 8443, process: 'docks-gateway', pid: 944 },
        { proto: 'tcp', address: '*', port: 9100, process: 'prometheus-node', pid: 711 },
      ] satisfies Listening[],
      mounts: [{ path: '/', capacity: 40 * GiB, name: '/dev/vda1', system: 'ext4' }],
    }),
    createWorld: (t) =>
      hostWorld(t, 'hub', chapter, {
        srv: d({ docks: d({ photos: d(Object.fromEntries(['2029-02', '2029-03', '2029-04', '2029-05'].map((m, i) => [m, big([4.8, 5.4, 5.6, 4.9][i] * GiB, { owner: 'docks' })])), undefined, { owner: 'docks' }) }, undefined, { owner: 'docks' }) }, undefined, { owner: 'root' }),
        var: d(
          {
            backups: d(chapter === 2 ? { 'docks-2029-04.tar.gz': big(13.6 * GiB) } : {}, undefined, { owner: 'root' }),
            log: d({}, undefined, { owner: 'root', group: 'adm' }),
          },
          undefined,
          { owner: 'root' },
        ),
      }),
  };
}

// ——— What the chapters check ———

/** The targets of the loaded configuration, with the machine and port they reach. */
export function targetsOf(j: Game) {
  const p = prom(j);
  if (!p) return [];
  return Object.values(p.targets).map((tg) => {
    const m = /^(.*?)(?::(\d+))?$/.exec(tg.address)!;
    const a = NET.resolve(principal(j), m[1]);
    const where = a === '127.0.0.1' ? GAUGE : a;
    return { ...tg, where, port: Number(m[2] ?? 80) };
  });
}

/** The five scrapes chapter 1 wants: Prometheus, the three node exporters, the app. */
export const WANTED: [string, number][] = [
  [GAUGE, 9090],
  [GAUGE, 9100],
  [SADDLE, 9100],
  [HUB, 9100],
  [SADDLE, 3000],
];
export const isUp = (j: Game, address: string, port: number) => targetsOf(j).some((x) => x.where === address && x.port === port && x.health === 'up');

/** saddle's node exporter: reachable by gauge, not by the internet. */
export const saddleFirewallOk = (j: Game) => {
  const fw = host(j, 'saddle').state.ufw as Firewall;
  return verdict(fw, 9100, GAUGE) === 'accepted' && verdict(fw, 9100, OUTSIDE) !== 'accepted';
};

/** The configuration on disk is the one running (a restart would give the same). */
export const configSaved = (j: Game) => {
  const p = prom(j);
  const r = readAll(j);
  return !!p && !('error' in r) && r.text === p.configText && JSON.stringify(r.groups.map((g) => g.rules.map((x) => [x.name, x.exprText, x.for, x.labels]))) === JSON.stringify(p.groups.map((g) => g.rules.map((x) => [x.name, x.exprText, x.for, x.labels])));
};

// ——— Trying a rule on made-up data (chapter 2) ———

/** A storage that computes its samples: one series per label set, a function of time. */
function synthetic(series: { labels: Labels; at: (t: number) => number }[], from: number): Storage {
  const cache = new Map<string, StoredSeries>();
  return {
    select(ms: Matcher[], start: number, end: number) {
      const out: StoredSeries[] = [];
      for (const s of series) {
        if (!ms.every((m) => matchOne(s.labels, m))) continue;
        const k = labelsText(s.labels);
        let stored = cache.get(k);
        if (!stored) {
          stored = { labels: s.labels, samples: [] };
          cache.set(k, stored);
        }
        // Samples every 15 s, computed when first asked.
        const first = Math.max(from, Math.floor((start - 300_000) / 15_000) * 15_000);
        if (!stored.samples.length || stored.samples[0].t > first || stored.samples.at(-1)!.t < end) {
          stored.samples = [];
          for (let t = first; t <= end; t += 15_000) stored.samples.push({ t, v: s.at(t) });
        }
        out.push(stored);
      }
      return out;
    },
  };
}
const matchOne = (l: Labels, m: Matcher) => {
  const v = l[m.name] ?? '';
  if (m.op === '=') return v === m.value;
  if (m.op === '!=') return v !== m.value;
  const re = new RegExp(`^(?:${m.value})$`);
  return m.op === '=~' ? re.test(v) : !re.test(v);
};

/** Runs an alerting rule over made-up data from `from` to `to`: the label sets that went firing, and how many times. */
export function trial(rule: Rule, storage: Storage, from: number, to: number): { fired: Labels[]; firings: number } {
  const active = new Map<string, number>();
  const fired: Labels[] = [];
  let firings = 0;
  const firing = new Set<string>();
  for (let t = from; t <= to; t += 15_000) {
    let samples: { labels: Labels; v: number }[] = [];
    try {
      const v = evaluate(rule.expr, storage, t).value;
      samples = v.type === 'vector' ? v.samples : v.type === 'scalar' ? [{ labels: {}, v: v.v }] : [];
    } catch {
      return { fired: [], firings: 0 };
    }
    const now = new Set<string>();
    for (const s of samples) {
      const k = labelsText(s.labels);
      now.add(k);
      if (!active.has(k)) active.set(k, t);
      if (t - active.get(k)! >= rule.for && !firing.has(k)) {
        firing.add(k);
        firings++;
        fired.push(s.labels);
      }
    }
    for (const k of [...active.keys()])
      if (!now.has(k)) {
        active.delete(k);
        firing.delete(k);
      }
  }
  return { fired, firings };
}

const verdicts = new Map<string, unknown>();
const cached = <T>(k: string, f: () => T): T => {
  if (!verdicts.has(k)) verdicts.set(k, f());
  return verdicts.get(k) as T;
};
const ruleKey = (r: Rule) => `${r.exprText}|${r.for}`;

/** The label sets of the node targets (instance, job and their own labels), from the loaded configuration. */
function nodeTargets(j: Game): Labels[] {
  return targetsOf(j)
    .filter((x) => x.port === 9100)
    .map((x) => x.labels);
}
function appTargets(j: Game): Labels[] {
  const found = targetsOf(j)
    .filter((x) => x.port === 3000 && x.where === SADDLE)
    .map((x) => x.labels);
  return found.length ? found : [{ instance: `${machineName(j.t, 'saddle')}.internal:3000`, job: 'rental' }];
}

/** A disk rule: fires for any machine whose / has 7 % free, not at 12 % nor 40 %, and never for /run. */
export function diskRuleOk(j: Game, r: Rule): boolean {
  const targets = nodeTargets(j);
  if (!targets.length) return false;
  return cached(`disk|${ruleKey(r)}|${targets.map(labelsText).join()}`, () => {
    const t0 = now(j);
    const scenario = (low: Labels | null, ratio: number) => {
      const series: { labels: Labels; at: (t: number) => number }[] = [];
      for (const tg of targets) {
        const free = tg === low ? ratio : 0.4;
        const root = { device: '/dev/vda1', fstype: 'ext4', mountpoint: '/' };
        const run = { device: 'tmpfs', fstype: 'tmpfs', mountpoint: '/run' };
        const size = 40 * GiB;
        series.push(
          { labels: { __name__: 'node_filesystem_avail_bytes', ...tg, ...root }, at: () => size * free },
          { labels: { __name__: 'node_filesystem_free_bytes', ...tg, ...root }, at: () => size * (free + 0.05) },
          { labels: { __name__: 'node_filesystem_size_bytes', ...tg, ...root }, at: () => size },
          { labels: { __name__: 'node_filesystem_readonly', ...tg, ...root }, at: () => 0 },
          { labels: { __name__: 'node_filesystem_avail_bytes', ...tg, ...run }, at: () => 400_000_000 },
          { labels: { __name__: 'node_filesystem_free_bytes', ...tg, ...run }, at: () => 400_000_000 },
          { labels: { __name__: 'node_filesystem_size_bytes', ...tg, ...run }, at: () => 402_653_184 },
          { labels: { __name__: 'up', ...tg }, at: () => 1 },
        );
      }
      return synthetic(series, t0 - 3_600_000);
    };
    const firesFor = (tg: Labels, ratio: number) => trial(r, scenario(tg, ratio), t0, t0 + 40 * 60_000).fired;
    return (
      targets.every((tg) => firesFor(tg, 0.07).some((l) => l.instance === tg.instance && (l.mountpoint === undefined || l.mountpoint === '/'))) &&
      targets.every((tg) => firesFor(tg, 0.12).length === 0) &&
      trial(r, scenario(null, 0.4), t0, t0 + 40 * 60_000).fired.length === 0
    );
  });
}

/** The app's counters for made-up traffic (an incident all along, or a normal day with its bursts). */
function appStorage(j: Game, incident: boolean): Storage {
  const t0 = now(j);
  const start = t0 - 2 * 3_600_000;
  const inc = incident ? { from: start, to: Infinity } : null;
  const series: { labels: Labels; at: (t: number) => number }[] = [];
  for (const tg of appTargets(j)) {
    const c = (t: number) => appCounters(start, t, inc);
    const req = (method: string, route: string, status: string, k: keyof ReturnType<typeof appCounters>) => ({ labels: { __name__: 'http_requests_total', ...tg, method, route, status }, at: (t: number) => c(t)[k] });
    series.push(
      req('GET', '/stations', '200', 'stations'),
      req('GET', '/stations/:id', '404', 'notFound'),
      req('POST', '/rentals', '201', 'rentals'),
      req('POST', '/returns', '200', 'returnsOk'),
      req('POST', '/returns', '500', 'errors'),
      { labels: { __name__: 'up', ...tg }, at: () => 1 },
    );
  }
  return synthetic(series, start);
}

/** An error-rate rule: fires during a lasting incident (within 30 min), never on a normal day with its short bursts (90 min). */
export function errorRuleOk(j: Game, r: Rule): boolean {
  const k = `errors|${ruleKey(r)}|${appTargets(j).map(labelsText).join()}`;
  return cached(k, () => {
    const t0 = now(j);
    return trial(r, appStorage(j, true), t0, t0 + 30 * 60_000).fired.length > 0 && errorRuleQuiet(j, r);
  });
}
/** The rule stays quiet on a normal day. */
export function errorRuleQuiet(j: Game, r: Rule): boolean {
  return cached(`quiet|${ruleKey(r)}|${appTargets(j).map(labelsText).join()}`, () => {
    const t0 = now(j);
    return trial(r, appStorage(j, false), t0, t0 + 90 * 60_000).fired.length === 0;
  });
}
/** How many times the rule would fire on a normal day (no `for:` → bursts page). */
export function normalDayFirings(j: Game, r: Rule): number {
  return cached(`firings|${ruleKey(r)}|${appTargets(j).map(labelsText).join()}`, () => {
    const t0 = now(j);
    return trial(r, appStorage(j, false), t0, t0 + 90 * 60_000).firings;
  });
}

/** The loaded alerting rules. */
export const loadedAlertRules = (j: Game): Rule[] => (prom(j)?.groups ?? []).flatMap((g) => g.rules.filter((r) => r.kind === 'alert'));
/** The alerting rules of the files on disk (null if they don't load). */
export function diskAlertRules(j: Game): Rule[] | null {
  const r = readAll(principal(j));
  return 'error' in r ? null : r.groups.flatMap((g) => g.rules.filter((x) => x.kind === 'alert'));
}
export const wellLabelled = (r: Rule) => !!r.labels.severity && !!r.annotations.summary;

export { labelsText };
