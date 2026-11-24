// systemctl, journalctl and reboot, on the simulated systemd (../systemd.ts).
// Messages based on systemd (https://www.freedesktop.org/software/systemd/man/latest/):
// they stay in English, like those of the real systemctl.

import type { Shell } from '../shell';
import { stop, dateComplete, start, duration, writeLog, logLine, reload, restart, systemd, type Systemd } from '../systemd';
import type { Command } from './index';
import { family } from '../families';
import { colourise, sgr } from '../colours';
import { readSize } from '../memory';
import { readNice, readQuota } from '../cpu';
import { human, JOURNAL, journalFiles, machineId, usage, vacuum } from '../journal-files';
import { readLimit } from '../limits';
import { loadUnits, readCalendar, nextCalendar, nextTrigger, timerFor } from '../timers';
import { toUtc, summerTime } from '../systemd';
import {
  loadDependencies, startWithDependencies, stopWithDependents, restartWithDependents, runPending, dependencyTree, catUnit, verify,
  analyzeDuration, criticalChain, mainFile, key,
} from '../units';

const CAPTION = [
  '',
  'LOAD   = Reflects whether the unit definition was properly loaded.',
  'ACTIVE = The high-level unit activation state, i.e. generalization of SUB.',
  'SUB    = The low-level unit activation state, values depend on unit type.',
];

const underState = (state: string) => (state === 'active' ? 'running' : state === 'failed' ? 'failed' : 'dead');
const unitName = (raw: string) => raw.replace(/\.service$/, '');

// Like systemctl on a terminal: the green dot of an active service, the red cross of a failure.
type Paint = (code: string, text: string) => string;
const raw: Paint = (_code, text) => text;

function status(game: Shell, sd: Systemd, name: string, paint: Paint = raw): string {
  const s = sd.services[name];
  const unit = `${name}.service`;
  const language = game.t.language;
  const since = `since ${dateComplete(s.since, language, sd)}; ${duration(sd.clock - s.since)} ago`;
  const enabled =
    s.state === 'active'
      ? `${paint('0;1;32', `active (${s.activeRest ? 'exited' : 'running'})`)} ${since}`
      : s.state === 'failed'
        ? `${paint('0;1;31', 'failed')} (Result: ${s.result ?? 'exit-code'}) ${since}`
        : `inactive (dead)`;
  const lines = [
    // × (×): systemd's failure symbol.
    `${s.state === 'failed' ? paint('0;1;31', '\u00d7') : s.state === 'active' ? paint('0;1;32', '●') : '○'} ${unit} - ${s.description}`,
    `     Loaded: loaded (${s.file ?? (sd.ordered ? mainFile(game, name, s) : null) ?? `/usr/lib/systemd/system/${unit}`}; ${s.static ? 'static' : `${s.active ? 'enabled' : 'disabled'}; preset: enabled`})`,
    ...(s.overrides?.length
      ? s.overrides.flatMap((path, i) => {
          const place = path.replace(/\/[^/]+$/, '');
          const newPlace = i === 0 || !s.overrides![i - 1].startsWith(place + '/');
          const last = !s.overrides![i + 1]?.startsWith(place + '/');
          return [...(newPlace ? [`${i === 0 ? '    Drop-In:' : '            '} ${place}`] : []), `             ${last ? '└─' : '├─'}${path.split('/').at(-1)}`];
        })
      : []),
    `     Active: ${enabled}`,
    ...(timerFor(sd, name) ? [`TriggeredBy: ● ${timerFor(sd, name)}.timer`] : []),
  ];
  if (s.state === 'active' && s.process[0]) lines.push(`   Main PID: ${s.process[0].pid} (${s.executable})`);
  // The service's memory (and its limit, MemoryMax=), if the machine tracks it.
  const rss = game.state.memory?.rss?.[s.process[0]?.pid ?? -1];
  if (s.state === 'active' && rss !== undefined) {
    const mo = (o: number) => `${(o / 1048576).toFixed(1)}M`;
    lines.push(`     Memory: ${mo(rss)}${s.maxMemory ? ` (max: ${mo(s.maxMemory)} available: ${mo(Math.max(0, s.maxMemory - rss))})` : ''}`);
  }
  const log = sd.log.filter((e) => e.unit === unit && e.boot === sd.boot).slice(-10);
  if (log.length) lines.push('', ...log.map((e) => logLine(e, sd, language, paint !== raw)));
  return lines.join('\n');
}

function listing(sd: Systemd, onlyFailures: boolean, paint: Paint = raw): string {
  const units = Object.entries(sd.services).filter(([, s]) => (onlyFailures ? s.state === 'failed' : s.state !== 'inactive'));
  const width = Math.max(4, ...units.map(([n]) => n.length + 8));
  const lines = [`  ${'UNIT'.padEnd(width)} LOAD   ACTIVE   SUB     DESCRIPTION`];
  for (const [name, s] of units)
    lines.push(
      s.state === 'failed'
        ? `${paint('0;1;31', '●')} ${paint('0;1;39', `${name}.service`.padEnd(width))} loaded ${paint('0;1;31', s.state.padEnd(8))} ${paint('0;1;31', underState(s.state).padEnd(7))} ${s.description}`
        : `  ${`${name}.service`.padEnd(width)} loaded ${s.state.padEnd(8)} ${underState(s.state).padEnd(7)} ${s.description}`,
    );
  return [...lines, ...CAPTION, '', `${units.length} loaded units listed.`].join('\n');
}

// The override files (/etc/systemd/system/NAME.service.d/*.conf, and
// those of systemctl set-property in /etc/systemd/system.control):
// MemoryMax=, IOReadBandwidthMax=, IOWriteBandwidthMax= and Restart= of the
// [Service] section, reread by daemon-reload
// (systemctl edit and set-property do it by themselves). Based on
// https://www.freedesktop.org/software/systemd/man/latest/systemd.unit.html
// ("drop-in"). Difference: the other keys are ignored.
const OVERRIDES_PLACES = ['/etc/systemd/system.control', '/etc/systemd/system'];
const overridesPaths = (game: Shell, name: string) =>
  OVERRIDES_PLACES.flatMap((base) => {
    const place = game.find(`${base}/${name}.service.d`);
    return place?.type === 'directory' ? Object.keys(place.children).filter((f) => f.endsWith('.conf')).sort().map((f) => `${base}/${name}.service.d/${f}`) : [];
  });
// What the overrides on disk say (to see whether they changed since the last read).
// The hand-written unit file (if there is one) and its overrides, as they are on disk.
const fingerprint = (game: Shell, name: string) =>
  [`/etc/systemd/system/${name}.service`, ...overridesPaths(game, name)].map((c) => `${c}\n${game.read(c) ?? ''}`).join('\n');
export function loadOverrides(game: Shell, sd: Systemd) {
  for (const [name, s] of Object.entries(sd.services)) {
    const paths = overridesPaths(game, name);
    s.overridesFingerprint = fingerprint(game, name);
    s.overrides = paths.length ? paths : undefined;
    s.maxMemory = undefined;
    s.reboot = undefined;
    s.readIo = undefined;
    s.writeIo = undefined;
    s.nice = undefined;
    s.cpuQuota = undefined;
    s.cpuWeight = undefined;
    s.limitNofile = undefined;
    // Nice=, CPUQuota=, CPUWeight= and LimitNOFILE= are also read in the unit file itself
    // (the other keys of the unit file are read by units.ts or the chapter).
    const main = mainFile(game, name, s);
    // The last file read wins (like systemd: names are sorted, /etc/systemd/system after system.control here).
    for (const path of [...(main ? [main] : []), ...paths]) {
      const dropIn = path !== main;
      let section = '';
      for (const line of (game.read(path) ?? '').split('\n')) {
        const l = line.trim();
        if (/^\[.*\]$/.test(l)) section = l;
        const m = /^(\w+)\s*=\s*(.*)$/.exec(l);
        if (!m || section !== '[Service]') continue;
        if (m[1] === 'Nice') s.nice = readNice(m[2]) ?? undefined;
        if (m[1] === 'CPUQuota') s.cpuQuota = m[2] === '' ? undefined : (readQuota(m[2]) ?? undefined);
        if (m[1] === 'CPUWeight') s.cpuWeight = /^\d+$/.test(m[2]) && Number(m[2]) >= 1 && Number(m[2]) <= 10000 ? Number(m[2]) : undefined;
        if (m[1] === 'LimitNOFILE') s.limitNofile = m[2] === '' ? undefined : (readLimit(m[2]) ?? undefined);
        if (!dropIn) continue;
        if (m[1] === 'MemoryMax') s.maxMemory = readSize(m[2]) ?? undefined;
        if (m[1] === 'Restart') s.reboot = m[2];
        const io = /^IO(Read|Write)BandwidthMax$/.exec(m[1]);
        const limit = io ? readIoLimit(m[2]) : null;
        if (io && limit) s[io[1] === 'Read' ? 'readIo' : 'writeIo'] = limit;
      }
    }
  }
}

/** "/dev/vda 20M" (IOWriteBandwidthMax=) → the disk and bytes per second; null if unreadable. */
function readIoLimit(text: string): { device: string; bytes: number } | null {
  const [device, rate, ...rest] = text.trim().split(/\s+/);
  const bytes = rate ? readSize(rate) : null;
  return device?.startsWith('/') && bytes !== null && !rest.length ? { device, bytes } : null;
}

/** A moment for journalctl --since/--until (machine time, read as UTC); null if unreadable. */
function readMoment(sd: Systemd, text: string): number | null {
  const now = sd.clock + (sd.difference ?? 0);
  const day = Math.floor(now / 86_400_000) * 86_400_000;
  if (text === 'now') return now;
  if (text === 'today') return day;
  if (text === 'yesterday') return day - 86_400_000;
  if (text === 'tomorrow') return day + 86_400_000;
  // -1h, +30min, "1 hour ago", "2 days ago" (systemd.time(7)).
  const UNITS: Record<string, number> = { s: 1000, sec: 1000, second: 1000, seconds: 1000, m: 60_000, min: 60_000, minute: 60_000, minutes: 60_000, h: 3_600_000, hour: 3_600_000, hours: 3_600_000, d: 86_400_000, day: 86_400_000, days: 86_400_000, w: 604_800_000, week: 604_800_000, weeks: 604_800_000 };
  const relative = /^([-+])(\d+)\s*([a-z]+)$/.exec(text.trim()) ?? /^()(\d+)\s*([a-z]+)\s+ago$/.exec(text.trim());
  if (relative && UNITS[relative[3]]) return now + (relative[1] === '+' ? 1 : -1) * Number(relative[2]) * UNITS[relative[3]];
  const m = /^(?:(\d{4})-(\d{2})-(\d{2}))?\s*(?:(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/.exec(text.trim());
  if (!m || (!m[1] && !m[4])) return null;
  const base = m[1] ? Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : day;
  return base + (m[4] ? (Number(m[4]) * 3600 + Number(m[5]) * 60 + Number(m[6] ?? 0)) * 1000 : 0);
}

/** daemon-reload: the hand-written units, then the overrides. */
function reread(game: Shell, sd: Systemd) {
  loadUnits(game, sd);
  loadOverrides(game, sd);
  if (sd.ordered) loadDependencies(game, sd);
}

const dateOrDash = (game: Shell, sd: Systemd, ms: number | null | undefined) => (ms ? dateComplete(ms, game.t.language, sd) : '-');

function timersList(game: Shell, sd: Systemd, all: boolean): string {
  const timers = Object.entries(sd.timers ?? {}).filter(([, m]) => all || m.state === 'active');
  const lines = timers
    .map(([name, m]) => ({ name, m, next: nextTrigger(sd, m, sd.clock) }))
    .sort((a, b) => (a.next ?? Infinity) - (b.next ?? Infinity))
    .map(({ name, m, next }) => [
      dateOrDash(game, sd, next),
      next ? `${duration(next - sd.clock)} left` : '-',
      dateOrDash(game, sd, m.last),
      m.last ? `${duration(sd.clock - m.last)} ago` : '-',
      `${name}.timer`,
      `${m.unit}.service`,
    ]);
  const header = ['NEXT', 'LEFT', 'LAST', 'PASSED', 'UNIT', 'ACTIVATES'];
  const widths = header.map((e, i) => Math.max(e.length, ...lines.map((l) => l[i].length)));
  // Two spaces between columns: the table stays in one piece on screen.
  const aligner = (l: string[]) => l.map((c, i) => (i === l.length - 1 ? c : c.padEnd(widths[i]))).join('  ');
  return [
    aligner(header),
    ...lines.map(aligner),
    '',
    `${lines.length} timers listed.`,
    ...(all ? [] : ['Pass --all to see loaded but inactive timers, too.']),
  ].join('\n');
}

// systemctl start, stop, enable, status… of a timer.
function actionTimer(game: Shell, sd: Systemd, action: string, name: string, now: boolean): string {
  if (!sd.timers?.[name] && game.exists(`/etc/systemd/system/${name}.timer`)) reread(game, sd);
  const m = sd.timers?.[name];
  const unit = `${name}.timer`;
  if (!m) return game.error(action === 'status' || action.startsWith('is-') ? `Unit ${unit} could not be found.` : `Failed to ${action} ${unit}: Unit ${unit} not found.`);
  if (action === 'status') {
    const next = nextTrigger(sd, m, sd.clock);
    const service = sd.services[m.unit];
    return [
      `${m.state === 'active' ? '●' : '○'} ${unit} - ${m.description}`,
      `     Loaded: loaded (${m.file}; ${m.active ? 'enabled' : 'disabled'}; preset: enabled)`,
      `     Active: ${m.state === 'active' ? `active (waiting) since ${dateComplete(m.since, game.t.language, sd)}; ${duration(sd.clock - m.since)} ago` : 'inactive (dead)'}`,
      ...(m.state === 'active' ? [`    Trigger: ${next ? `${dateComplete(next, game.t.language, sd)}; ${duration(next - sd.clock)} left` : 'n/a'}`] : []),
      `   Triggers: ${service?.state === 'failed' ? '\u00d7' : '●'} ${m.unit}.service`,
      ...sd.log
        .filter((e) => e.unit === unit)
        .slice(-5)
        .map((e) => logLine(e, sd, game.t.language))
        .reduce<string[]>((l, x, i) => (i === 0 ? ['', x] : [...l, x]), []),
    ].join('\n');
  }
  if (action === 'is-active') return m.state;
  if (action === 'is-enabled') return m.active ? 'enabled' : 'disabled';
  if (game.who !== 'root') return refuse(game, action, unit);
  const startTimer = (): boolean => {
    if (m.state === 'active') return true;
    if (!m.calendar.length && m.afterBoot === undefined && m.afterActivation === undefined && m.afterLast === undefined) {
      writeLog(sd, unit, 'systemd', 1, `${unit}: Timer unit lacks value setting. Refusing.`, 3);
      game.error(`Failed to start ${unit}: Unit ${unit} has a bad unit file setting.\nSee system logs and 'systemctl status ${unit}' for details.`);
      return false;
    }
    if (!sd.services[m.unit] && !(game.exists(`/etc/systemd/system/${m.unit}.service`) && (reread(game, sd), sd.services[m.unit]))) {
      writeLog(sd, unit, 'systemd', 1, `${unit}: Refusing to start, unit ${m.unit}.service to trigger not loaded.`, 3);
      game.error(`Failed to start ${unit}: Unit ${m.unit}.service not found.`);
      return false;
    }
    m.state = 'active';
    m.since = sd.clock;
    writeLog(sd, unit, 'systemd', 1, `Started ${unit} - ${m.description}.`);
    return true;
  };
  const stopTimer = () => {
    if (m.state !== 'active') return;
    m.state = 'inactive';
    m.since = sd.clock;
    writeLog(sd, unit, 'systemd', 1, `${unit}: Deactivated successfully.`);
    writeLog(sd, unit, 'systemd', 1, `Stopped ${unit} - ${m.description}.`, 6, false);
  };
  const link = `/etc/systemd/system/timers.target.wants/${unit}`;
  switch (action) {
    case 'start':
      startTimer();
      return '';
    case 'stop':
      stopTimer();
      return '';
    case 'restart':
      stopTimer();
      startTimer();
      return '';
    case 'enable': {
      // Without an [Install] section (WantedBy=timers.target), nothing to enable.
      if (!/^\s*WantedBy\s*=/m.test(game.read(m.file) ?? 'WantedBy=timers.target'))
        return [
          'The unit files have no installation config (WantedBy=, RequiredBy=, UpheldBy=,',
          'Also=, or Alias= settings in the [Install] section, and DefaultInstance= for',
          'template units). This means they are not meant to be enabled or disabled using systemctl.',
        ].join('\n');
      const output = m.active ? '' : `Created symlink ${link} → ${m.file}.`;
      m.active = true;
      if (now) startTimer();
      return output;
    }
    case 'disable': {
      const output = m.active ? `Removed "${link}".` : '';
      m.active = false;
      if (now) stopTimer();
      return output;
    }
    default:
      return game.error(`Failed to ${action} ${unit}: Operation not supported`);
  }
}

// systemctl edit: the override opens in the editor; on closing, systemd rereads it.
function editOverride(game: Shell, sd: Systemd, name: string): string {
  const place = `/etc/systemd/system/${name}.service.d`;
  const file = `${place}/override.conf`;
  for (const path of ['/etc/systemd', '/etc/systemd/system', place])
    if (!game.exists(path)) game.place('systemctl', path, { type: 'directory', children: {}, owner: 'root' });
  const existing = game.read(file);
  const template = `### Editing ${file}\n### Anything between here and the comment below will become the contents of the drop-in file\n\n\n\n### Edits below this comment will be discarded\n`;
  const text = existing ?? template;
  game.edition = {
    path: file,
    text,
    root: true,
    conclude: true,
    message: game.t('nano-lines-read', { lines: text.split('\n').length }),
    after: () => {
      // Only the lines above the "Edits below…" comment are kept.
      const raw = game.read(file) ?? '';
      const kept = raw
        .split('### Edits below this comment will be discarded')[0]
        .split('\n')
        .filter((l) => !l.startsWith('### '))
        .join('\n')
        .trim();
      const n = game.find(file);
      if (!kept) {
        const d = game.find(place);
        if (d?.type === 'directory') delete d.children['override.conf'];
      } else if (n?.type === 'file') n.content = kept;
      loadOverrides(game, sd);
      if (sd.ordered) loadDependencies(game, sd);
      return '';
    },
  };
  return '';
}

// systemctl without being root: systemd would ask for a password (polkit).
const refuse = (game: Shell, action: string, name: string) => game.error(game.t('systemctl-access-refuse', { action, service: name }));

// networkctl: the links systemd-networkd manages (state.links), and how
// far each one got. After networkctl(1):
// https://www.freedesktop.org/software/systemd/man/latest/networkctl.html
export interface Link {
  type: 'loopback' | 'ether';
  carrier: boolean;
}
const networkFiles = (game: Shell) => {
  const place = game.find('/etc/systemd/network');
  return place?.type === 'directory' ? Object.keys(place.children).filter((f) => f.endsWith('.network')).sort().map((f) => `/etc/systemd/network/${f}`) : [];
};
/** The .network file that configures this link ([Match] Name=), and whether it is required for "online". */
export function linkConfig(game: Shell, name: string): { file: string; required: boolean } | null {
  for (const file of networkFiles(game)) {
    let section = '';
    let matches = false;
    let required = true;
    for (const raw of (game.read(file) ?? '').split('\n')) {
      const l = raw.trim();
      const s = /^\[(.+)\]$/.exec(l);
      if (s) section = s[1];
      const m = /^(\w+)\s*=\s*(.*)$/.exec(l);
      if (!m) continue;
      if (section === 'Match' && m[1] === 'Name') matches = m[2].split(/\s+/).includes(name);
      if (section === 'Link' && m[1] === 'RequiredForOnline') required = !/^(no|false|0)$/i.test(m[2]);
    }
    if (matches) return { file, required };
  }
  return null;
}
const linkState = (game: Shell, name: string, l: Link) =>
  l.type === 'loopback'
    ? { operational: 'carrier', setup: 'unmanaged' }
    : !linkConfig(game, name)
      ? { operational: l.carrier ? 'carrier' : 'off', setup: 'unmanaged' }
      : l.carrier
        ? { operational: 'routable', setup: 'configured' }
        : { operational: 'no-carrier', setup: 'configuring' };

/** "2weeks", "10d", "1months", "12h" (journalctl --vacuum-time) → milliseconds; null if unreadable. */
function readSpan(text: string): number | null {
  const m = /^(\d+)\s*(s|sec|m|min|h|hour|hours|d|day|days|w|week|weeks|month|months|y|year|years)?$/.exec(text.trim());
  if (!m) return null;
  const unit = m[2] ?? 's';
  const ms: Record<string, number> = { s: 1000, sec: 1000, m: 60_000, min: 60_000, h: 3_600_000, hour: 3_600_000, hours: 3_600_000, d: 86_400_000, day: 86_400_000, days: 86_400_000, w: 604_800_000, week: 604_800_000, weeks: 604_800_000, month: 2_629_800_000, months: 2_629_800_000, y: 31_557_600_000, year: 31_557_600_000, years: 31_557_600_000 };
  return ms[unit] === undefined ? null : Number(m[1]) * ms[unit];
}


// The boot IDs journalctl shows (-- Boot … --, --list-boots): one per boot, fixed.
export const bootId = (n: number) => `${String(n).padStart(2, '0')}f3c1e9a7d54b2c8e06a1d9f4b7c2e5`;

// systemctl list-unit-files [PATTERN…] [--type=T] [--state=S]: each unit file,
// its state (enabled, disabled, static) and Debian's preset (enable everything).
// https://www.freedesktop.org/software/systemd/man/latest/systemctl.html#list-unit-files%20PATTERN%E2%80%A6
function unitFiles(game: Shell, sd: Systemd, args: string[], patterns: string[]): string {
  const option = (name: string) => {
    const a = args.find((x) => x.startsWith(`--${name}=`));
    return a ? a.slice(name.length + 3).split(',') : args.includes(`--${name}`) ? (args[args.indexOf(`--${name}`) + 1] ?? '').split(',') : null;
  };
  const types = option('type') ?? option('t');
  const states = option('state');
  const rows: [string, string, string][] = [];
  for (const [n, x] of Object.entries(sd.services)) rows.push([`${n}.service`, x.static ? 'static' : x.active ? 'enabled' : 'disabled', x.static ? '-' : 'enabled']);
  for (const [n, m] of Object.entries(sd.timers ?? {})) rows.push([`${n}.timer`, m.active ? 'enabled' : 'disabled', 'enabled']);
  for (const t of ['basic.target', 'graphical.target', 'multi-user.target', 'network-online.target', 'rescue.target', 'sysinit.target', 'timers.target'])
    if (!rows.some(([u]) => u === t)) rows.push([t, 'static', '-']);
  const glob = (p: string, u: string) => new RegExp(`^${p.replace(/[.+^${}()|\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\?/g, '.')}$`).test(u);
  const chosen = rows
    .filter(([u]) => !types || types.includes(u.split('.').at(-1)!))
    .filter(([, st]) => !states || states.includes(st))
    .filter(([u]) => !patterns.length || patterns.some((p) => glob(p, u) || glob(`${p}.service`, u)))
    .sort((a, b) => a[0].localeCompare(b[0]));
  const w0 = Math.max(9, ...chosen.map((r) => r[0].length));
  const w1 = Math.max(5, ...chosen.map((r) => r[1].length));
  if (!chosen.length) return '0 unit files listed.';
  return [
    `${'UNIT FILE'.padEnd(w0)} ${'STATE'.padEnd(w1)} PRESET`,
    ...chosen.map(([u, st, pr]) => `${u.padEnd(w0)} ${st.padEnd(w1)} ${pr}`),
    '',
    `${chosen.length} unit files listed.`,
  ].join('\n');
}

// systemctl status with no unit: the machine, its state (running, or degraded
// with a failed unit) and its control groups as a tree, each service's
// processes under system.slice, the session's under user.slice.
function machineStatus(game: Shell, sd: Systemd, paint: Paint): string {
  const failed = Object.values(sd.services).filter((x) => x.state === 'failed').length;
  const boot = sd.log.find((e) => e.boot === sd.boot)?.time ?? sd.clock;
  const processes = (game.state.process ?? []) as { pid: number; user: string; command: string }[];
  const services = Object.entries(sd.services)
    .filter(([, x]) => x.state === 'active' && x.process.length)
    .map(([n, x]) => [`${n}.service`, processes.filter((p) => x.process.some((q) => q.pid === p.pid))] as const)
    .filter(([, ps]) => ps.length)
    .sort((a, b) => a[0].localeCompare(b[0]));
  const inServices = new Set(services.flatMap(([, ps]) => ps.map((p) => p.pid)));
  const player = game.player;
  const uid = game.accounts.users[player]?.uid ?? 1000;
  const mine = processes.filter((p) => p.user === player && !inServices.has(p.pid));
  const manager = mine.filter((p) => p.command.startsWith('/usr/lib/systemd/systemd --user') || p.command === '(sd-pam)');
  const session = [
    ...processes.filter((p) => p.user === 'root' && p.command.startsWith(`sshd-session: ${player}`)),
    ...mine.filter((p) => !manager.includes(p) && !p.command.startsWith('[')),
    { pid: (game.state.nextPid as number | undefined) ?? game.shellPid + 100, user: game.who, command: 'systemctl status' },
  ].sort((a, b) => a.pid - b.pid);
  const branch = (items: string[], prefix: string) => items.map((t, i) => `${prefix}${i === items.length - 1 ? '└─' : '├─'}${t}`);
  const lines = [
    `${paint(failed ? '0;1;31' : '0;1;32', '●')} ${sd.host}`,
    `    State: ${failed ? paint('0;1;31', 'degraded') : paint('0;1;32', 'running')}`,
    `    Units: ${200 + Object.keys(sd.services).length + Object.keys(sd.timers ?? {}).length} loaded (incl. loaded aliases)`,
    '     Jobs: 0 queued',
    `   Failed: ${failed} units`,
    `    Since: ${dateComplete(boot, game.t.language, sd)}; ${duration(sd.clock - boot)} ago`,
    '  systemd: 257.8-1~deb13u2',
    '   CGroup: /',
  ];
  const pad = '           ';
  const tree: string[] = [];
  const init = processes.find((p) => p.pid === 1);
  tree.push('├─init.scope', `│ └─1 ${init?.command ?? '/sbin/init'}`);
  tree.push('├─system.slice');
  services.forEach(([unit, ps], i) => {
    const last = i === services.length - 1;
    tree.push(`│ ${last ? '└─' : '├─'}${unit}`, ...branch(ps.map((p) => `${p.pid} ${p.command}`), `│ ${last ? '  ' : '│ '}`));
  });
  tree.push('└─user.slice', `  └─user-${uid}.slice`, `    ├─session-1.scope`, ...branch(session.map((p) => `${p.pid} ${p.command}`), '    │ '));
  tree.push(`    └─user@${uid}.service`, '      └─init.scope', ...branch(manager.map((p) => `${p.pid} ${p.command}`), '        '));
  return [...lines, ...tree.map((t) => pad + t)].join('\n');
}


// journalctl -o: short (the default), short-iso (ISO 8601 dates with the
// offset), short-precise (microseconds), short-full, short-unix, cat (the
// message only). https://www.freedesktop.org/software/systemd/man/latest/journalctl.html#-o
function formatted(e: Systemd['log'][number], sd: Systemd, output: string, language: string, colour: boolean): string {
  if (output === 'short') return logLine(e, sd, language, colour);
  const shows = e.time + (sd.difference ?? 0);
  const zone = sd.zone ?? (summerTime(shows) ? 'CEST' : 'CET');
  const offset = zone === 'CEST' ? '+02:00' : zone === 'CET' ? '+01:00' : '+00:00';
  const iso = new Date(shows).toISOString().slice(0, 19);
  const who = `${sd.host} ${e.ident}${e.pid ? `[${e.pid}]` : ''}: ${e.message}`;
  if (output === 'cat') return e.message;
  if (output === 'short-iso') return `${iso}${offset} ${who}`;
  if (output === 'short-unix') return `${(toUtc(e.time) / 1000).toFixed(6)} ${who}`;
  if (output === 'short-full') return `${dateComplete(e.time, language, sd)} ${who}`;
  const line = logLine(e, sd, language, false);
  return line.replace(/^(\S+ \d\d \d\d:\d\d:\d\d)/, '$1.000000');
}

export const SYSTEMD: Record<string, Command> = {
  // Manual pages only (configuration files and a service), see pages.ts.
  'systemd.unit': { section: 5, launch: () => '' },
  'systemd.service': { section: 5, launch: () => '' },
  'systemd.network': { section: 5, launch: () => '' },
  'systemd-networkd-wait-online': { section: 8, launch: () => '' },
  networkctl: {
    ownOptions: true,
    launch: ({ args, game }) => {
      const links = game.state.links as Record<string, Link> | undefined;
      if (!links) return game.error('Failed to connect to systemd-networkd: No such file or directory');
      const [verb = 'list', ...rest] = args.filter((a) => !a.startsWith('-'));
      const names = Object.keys(links);
      if (verb === 'list') {
        const rows = names.map((n, i) => {
          const st = linkState(game, n, links[n]);
          return [String(i + 1).padStart(3), n.padEnd(4), links[n].type.padEnd(8), st.operational.padEnd(11), st.setup];
        });
        return ['IDX LINK TYPE     OPERATIONAL SETUP', ...rows.map((r) => r.join(' ')), '', `${rows.length} links listed.`].join('\n');
      }
      if (verb === 'status') {
        const n = rest[0];
        if (!n) return `State: ${names.every((x) => linkState(game, x, links[x]).setup !== 'configuring') ? 'routable' : 'degraded'}`;
        if (!links[n]) return game.error(`Interface "${n}" not found.`);
        const st = linkState(game, n, links[n]);
        const c = linkConfig(game, n);
        return [
          `● ${names.indexOf(n) + 1}: ${n}`,
          `                   Link File: /usr/lib/systemd/network/99-default.link`,
          `                Network File: ${c?.file ?? 'n/a'}`,
          `                       State: ${st.operational} (${st.setup})`,
          `                Online state: ${st.setup === 'configured' ? 'online' : c && !c.required ? 'unknown' : 'offline'}`,
          `            Required For Online: ${c ? (c.required ? 'yes' : 'no') : 'no'}`,
        ].join('\n');
      }
      if (verb === 'reload') return game.who === 'root' ? '' : game.error('Failed to reload network settings: Access denied');
      return game.error(`Unknown command verb '${verb}'.`);
    },
  },

  // systemd-analyze calendar: test an OnCalendar= expression before writing it in a timer.
  'systemd-analyze': {
    ownOptions: true,
    launch: ({ args, game }) => {
      const sd = systemd(game);
      const [verb, ...expressions] = args.filter((a) => !a.startsWith('--'));
      const boot = sd?.lastBoot;
      // time, blame, critical-chain: the timing of the last boot.
      if (sd && boot && ['time', 'blame', 'critical-chain'].includes(verb)) sd.checkedAfterBoot = true;
      if (verb === 'time') {
        if (!sd || !boot) return game.error('Bootup is not yet finished. Please try again later.');
        const total = boot.kernel + boot.userspace;
        return [
          `Startup finished in ${analyzeDuration(boot.kernel)} (kernel) + ${analyzeDuration(boot.userspace)} (userspace) = ${analyzeDuration(total)} `,
          `multi-user.target reached after ${analyzeDuration(boot.userspace)} in userspace.`,
        ].join('\n');
      }
      if (verb === 'blame') {
        if (!sd || !boot) return game.error('Bootup is not yet finished. Please try again later.');
        const units = Object.entries(boot.units)
          .filter(([k, t]) => (sd.services[k] || sd.mountUnits?.[k]) && t.took > 0)
          .sort((a, b) => b[1].took - a[1].took)
          .map(([k, t]) => [analyzeDuration(t.took), k.includes('.') ? k : `${k}.service`]);
        const width = Math.max(...units.map((u) => u[0].length));
        return units.map(([d, u]) => `${d.padStart(width)} ${u}`).join('\n');
      }
      if (verb === 'critical-chain') {
        if (!sd || !boot) return game.error('Bootup is not yet finished. Please try again later.');
        const root = expressions[0] ? key(expressions[0]) : 'multi-user.target';
        if (!sd.services[root] && !sd.targets?.[root] && root !== 'multi-user.target') return game.error(`Failed to get ID: Unit ${expressions[0]} not loaded.`);
        return criticalChain(sd, root);
      }
      // verify: reads a unit file like systemd would, and says what it ignores.
      if (verb === 'verify') {
        if (!expressions.length) return game.error('Too few arguments.');
        const problems: string[] = [];
        for (const e of expressions) {
          const k = key(e.split('/').at(-1)!);
          const file = e.includes('/') ? game.resolve(e) : sd ? mainFile(game, k, sd.services[k]) : null;
          if (!file || game.find(file)?.type !== 'file') {
            problems.push(`Failed to prepare filename ${e}: No such file or directory`);
            continue;
          }
          if (sd) problems.push(...verify(game, sd, file, k));
        }
        if (problems.length) game.status = 1;
        return problems.join('\n');
      }
      if (verb !== 'calendar') return game.error(verb ? `Unknown command verb '${verb}'.` : 'Too few arguments.');
      if (!expressions.length) return game.error('Too few arguments.');
      const blocks: string[] = [];
      for (const text of expressions) {
        const c = readCalendar(text);
        if (!c) {
          game.error(`Failed to parse calendar specification '${text}': Invalid argument`);
          continue;
        }
        const now = sd?.clock ?? Date.UTC(2027, 0, 1);
        const next = nextCalendar(c, now);
        const utc = next ? new Date(toUtc(next)).toISOString() : '';
        const day = next ? new Intl.DateTimeFormat(game.t.language, { timeZone: 'UTC', weekday: 'short' }).format(new Date(toUtc(next))) : '';
        blocks.push(
          [
            `  Original form: ${text}`,
            `Normalized form: ${c.normal}`,
            `    Next elapse: ${next ? dateComplete(next, game.t.language, sd) : 'never'}`,
            ...(next ? [`       (in UTC): ${day} ${utc.slice(0, 10)} ${utc.slice(11, 19)} UTC`, `       From now: ${duration(next - now)} left`] : []),
          ].join('\n'),
        );
      }
      return blocks.join('\n\n');
    },
  },

  systemctl: {
    launch: (c) => {
      const { args, game } = c;
      // On a terminal, systemctl colours (not in a pipe or a file).
      const paint: Paint = colourise(c, 'auto') ? sgr : raw;
      const sd = systemd(game);
      if (!sd) return game.error('System has not been booted with systemd as init system (PID 1). Can\'t operate.');
      // --user, -M USER@: a user's service manager, on a machine with rootless Podman (podman.ts).
      if (game.state.podman && args.some((a) => a === '--user' || /^(-M|--machine)(=|$)/.test(a) || /^-M./.test(a))) return family('podman').userSystemctl(c);
      const now = args.includes('--now');
      const unknown = args.find((a) => /^-[^-]/.test(a) && a !== '-t');
      if (unknown) return game.error(`systemctl: invalid option -- '${unknown[1]}'`);
      // Options with a value: --type service, --state enabled (also written --type=service).
      const valued = ['--type', '--state', '-t'];
      const words = args.filter((a, k) => (!a.startsWith('-') || a === '--failed') && !valued.includes(args[k - 1]));
      const [action = 'list-units', ...names] = words;
      const VERBS = ['status', 'start', 'stop', 'restart', 'reload', 'enable', 'disable', 'is-active', 'is-enabled', 'list-units', 'reboot', '--failed', 'edit', 'daemon-reload', 'set-property', 'list-timers', 'default', 'cat', 'list-dependencies', 'reset-failed', 'list-unit-files', 'is-failed'];
      if (!VERBS.includes(action)) return game.error(`Unknown command verb '${action}'.`);
      // Looking at the services' state after a reboot: that is checking.
      const consulter = () => (sd.checkedAfterBoot = true);
      if (action === '--failed' || (action === 'list-units' && args.includes('--failed'))) return consulter(), listing(sd, true, paint);
      if (action === 'list-units') return consulter(), listing(sd, false, paint);
      if (action === 'list-unit-files') return unitFiles(game, sd, args, names);
      // status with no unit: the whole machine.
      if (action === 'status' && !names.length) return consulter(), machineStatus(game, sd, paint);
      if (action === 'daemon-reload') {
        if (game.who !== 'root') return refuse(game, 'daemon-reload', 'systemd');
        reread(game, sd);
        // systemd also rereads /etc/fstab (its .mount units are derived from it).
        if (game.state.fstabRead !== undefined) game.state.fstabRead = game.read('/etc/fstab') ?? '';
        return '';
      }
      // default: leave rescue mode, resume the normal boot (multi-user.target).
      if (action === 'default') {
        if (game.who !== 'root') return refuse(game, 'default', 'system');
        const resume = game.state.continueBoot as ((j: Shell) => string) | undefined;
        return resume ? resume(game) : '';
      }
      if (action === 'list-timers') return timersList(game, sd, args.includes('--all'));
      // list-dependencies: what a unit pulls in (Requires=, Wants=), or with --after / --before its ordering.
      if (action === 'list-dependencies') {
        const root = names[0] ? key(names[0]) : 'multi-user.target';
        if (!sd.services[root] && !sd.targets?.[root] && !(root === 'multi-user.target')) return game.error(`Unit ${names[0]} could not be found.`);
        if (root === 'multi-user.target' && !sd.targets?.[root])
          return ['multi-user.target', ...Object.entries(sd.services).filter(([, x]) => x.active).map(([n], i, all) => `${sd.services[n].state === 'active' ? paint('0;1;32', '●') : sd.services[n].state === 'failed' ? paint('0;1;31', '●') : '○'} ${i === all.length - 1 ? '└─' : '├─'}${n}.service`)].join('\n');
        return dependencyTree(sd, root, args.includes('--after') ? 'after' : args.includes('--before') ? 'before' : 'pulls', paint);
      }
      // cat: the unit file and its drop-ins, as systemd reads them.
      if (action === 'cat') {
        if (!names.length) return game.error('Too few arguments.');
        const outputs: string[] = [];
        for (const n of names) {
          const text = catUnit(game, sd, key(n));
          if (text === null) game.error(`No files found for ${key(n).includes('.') ? key(n) : `${key(n)}.service`}.`);
          else outputs.push(text);
        }
        return outputs.join('\n\n');
      }
      // reset-failed: forget the failures and the start limit.
      if (action === 'reset-failed') {
        if (game.who !== 'root') return refuse(game, 'reset-failed', names[0] ?? 'units');
        for (const [n, x] of Object.entries(sd.services))
          if (!names.length || names.map(unitName).includes(n)) {
            x.attempts = [];
            if (x.state === 'failed') x.state = 'inactive';
            x.result = undefined;
          }
        return '';
      }
      // set-property: the limit applies at once, and stays (a file in system.control).
      if (action === 'set-property') {
        const name = unitName(names[0] ?? '');
        const properties = names.slice(1);
        if (!names.length || !properties.length) return game.error('Too few arguments.');
        if (!sd.services[name]) return game.error(`Failed to set unit properties on ${name}.service: Unit ${name}.service not found.`);
        if (game.who !== 'root') return refuse(game, 'set-property', name);
        for (const p of properties) {
          const m = /^(\w+)=(.*)$/.exec(p);
          if (!m) return game.error(`Failed to set unit properties on ${name}.service: Not assignment: ${p}`);
          const io = /^IO(Read|Write)BandwidthMax$/.test(m[1]);
          const cpuProperty = m[1] === 'CPUQuota' || m[1] === 'CPUWeight';
          // Only resource-control properties can be set at run time (Nice= is not one: it applies when a process starts).
          if (m[1] !== 'MemoryMax' && !io && !cpuProperty) return game.error(`Failed to set unit properties on ${name}.service: Cannot set property ${m[1]}, or unknown property.`);
          if (io && !readIoLimit(m[2])) return game.error(`Failed to parse ${m[1]}= value: ${m[2]}`);
          if (m[1] === 'CPUQuota' && m[2] !== '' && readQuota(m[2]) === null) return game.error(`CPU quota '${m[2]}' invalid.`);
          if (m[1] === 'CPUWeight' && !(/^\d+$/.test(m[2]) && Number(m[2]) >= 1 && Number(m[2]) <= 10000)) return game.error(`Failed to parse CPUWeight= value: ${m[2]}`);
          if (m[1] === 'MemoryMax' && m[2] !== 'infinity' && readSize(m[2]) === null) return game.error(`Failed to parse MemoryMax= value: ${m[2]}`);
          const place = `/etc/systemd/system.control/${name}.service.d`;
          for (const path of ['/etc/systemd', '/etc/systemd/system.control', place])
            if (!game.exists(path)) game.place('systemctl', path, { type: 'directory', children: {}, owner: 'root' });
          const file = `${place}/50-${m[1]}.conf`;
          // systemd writes the quota back in its own form (CPUQuotaPerSecUSec, shown as a percentage).
          const value = cpuProperty
            ? m[1] === 'CPUQuota' && m[2] !== '' ? `${Math.round(readQuota(m[2])! * 10000) / 100}%` : m[2]
            : io ? `${readIoLimit(m[2])!.device} ${readIoLimit(m[2])!.bytes}` : m[2] === 'infinity' ? 'infinity' : readSize(m[2]);
          const content = `# This is a drop-in unit file extension, created via "systemctl set-property"\n# or an equivalent operation. Do not edit.\n[Service]\n${m[1]}=${value}`;
          const n = game.find(file);
          if (n?.type === 'file') n.content = content;
          else game.place('systemctl', file, { type: 'file', content, lines: true, owner: 'root' });
        }
        loadOverrides(game, sd);
        return '';
      }
      if (action === 'edit') {
        const name = unitName(names[0] ?? '');
        if (!names.length) return game.error('Too few arguments.');
        if (!sd.services[name]) return game.error(`No files found for ${name}.service.`);
        if (game.who !== 'root') return refuse(game, 'edit', name);
        return editOverride(game, sd, name);
      }
      if (action === 'reboot') {
        if (game.who !== 'root') return refuse(game, 'reboot', 'system');
        restart(game, sd);
        game.reboot = true;
        return '';
      }
      if (!names.length) return game.error(action === 'status' ? game.t('systemctl-usage') : `Too few arguments.`);
      const outputs: string[] = [];
      for (const raw of names) {
        if (raw.endsWith('.timer')) {
          const r = actionTimer(game, sd, action, raw.slice(0, -6), now);
          if (r) outputs.push(r);
          continue;
        }
        // A unit's Alias= (mariadb.service: mysql.service, mysqld.service).
        const asked = unitName(raw);
        const name = sd.services[asked] ? asked : (Object.keys(sd.services).find((k) => sd.services[k].aliases?.includes(asked)) ?? asked);
        // A hand-written unit never loaded: systemd reads it on demand.
        if (!sd.services[name] && game.exists(`/etc/systemd/system/${name}.service`)) reread(game, sd);
        const s = sd.services[name];
        if (!s) {
          if (action === 'status' || action.startsWith('is-')) game.error(`Unit ${name}.service could not be found.`);
          else game.error(`Failed to ${action} ${name}.service: Unit ${name}.service not found.`);
          continue;
        }
        // A hand-written override is only read after daemon-reload: systemctl reminds you.
        // (Never reread: the initial state, with no unit file or override.)
        if (fingerprint(game, name) !== (s.overridesFingerprint ?? `/etc/systemd/system/${name}.service\n`))
          outputs.push(`Warning: The unit file, source configuration file or drop-ins of ${name}.service changed on disk. Run 'systemctl daemon-reload' to reload units.`);
        if (action === 'status') {
          consulter();
          outputs.push(status(game, sd, name, paint));
        } else if (action === 'is-active') {
          consulter();
          outputs.push(s.state);
        } else if (action === 'is-enabled') {
          outputs.push(s.static ? 'static' : s.active ? 'enabled' : 'disabled');
          if (!s.static && !s.active) game.status = 1;
        } else if (action === 'is-failed') {
          outputs.push(s.state);
          if (s.state !== 'failed') game.status = 1;
        }
        else if (game.who !== 'root') refuse(game, action, name);
        else {
          const link = `/etc/systemd/system/multi-user.target.wants/${name}.service`;
          const failure = () =>
            game.error(
              `Job for ${name}.service failed because the control process exited with error code.\nSee "systemctl status ${name}.service" and "journalctl -xeu ${name}.service" for details.`,
            );
          if (action === 'enable') {
            if (!s.active) outputs.push(`Created symlink ${link} → /usr/lib/systemd/system/${name}.service.`);
            s.active = true;
            if (now && s.state !== 'active' && !start(game, sd, name)) failure();
          } else if (action === 'disable') {
            if (s.active) outputs.push(`Removed "${link}".`);
            s.active = false;
            if (now && s.state === 'active') stop(game, sd, name);
          } else if (action === 'stop') {
            if (sd.ordered) stopWithDependents(game, sd, name);
            else if (s.state === 'active') stop(game, sd, name);
            else s.state = 'inactive';
          } else if (sd.ordered && (action === 'start' || action === 'restart')) {
            sd.mainAStarted = true;
            const r = action === 'restart' ? restartWithDependents(game, sd, name) : startWithDependencies(game, sd, name);
            runPending(game, sd);
            if (r === 'failed') failure();
            else if (r === 'dependency') game.error(`A dependency job for ${name}.service failed. See 'journalctl -xe' for details.`);
            else if (r === 'limit')
              game.error(
                `Job for ${name}.service failed because start of the service was attempted too often.\nSee "systemctl status ${name}.service" and "journalctl -xeu ${name}.service" for details.\nTo force a start use "systemctl reset-failed ${name}.service"\nfollowed by "systemctl start ${name}.service" again.`,
              );
          } else if (action === 'reload') {
            if (s.noReload) game.error(`Failed to reload ${name}.service: Job type reload is not applicable for unit ${name}.service.`);
            else if (s.state !== 'active') game.error(`${name}.service is not active, cannot reload.`);
            else if (!reload(game, sd, name))
              game.error(
                `Job for ${name}.service failed because the control process exited with error code.\nSee "systemctl status ${name}.service" and "journalctl -xeu ${name}.service" for details.`,
              );
          } else {
            if (action === 'restart' && s.state === 'active') stop(game, sd, name);
            if (s.state !== 'active' && !start(game, sd, name)) failure();
          }
          const m = game.state.onSystemctl?.(game, action, name);
          if (m) outputs.push(m);
        }
      }
      return outputs.join('\n');
    },
  },

  journalctl: {
    // -n20, -xeu nginx: journalctl reads its options itself.
    ownOptions: true,
    launch: (c) => {
      const { args, game } = c;
      // On a terminal, serious messages are highlighted (not in a pipe).
      const colour = colourise(c, 'auto');
      const sd = systemd(game);
      // The journal's files on disk: their size, and trimming them (journal-files.ts).
      const vacuumArg = args.find((a) => /^--vacuum-(size|time|files)(=|$)/.test(a));
      if (args.includes('--disk-usage') || vacuumArg) {
        if (!journalFiles(game).length) return game.error('No journal files were found.');
        if (args.includes('--disk-usage')) return `Archived and active journals take up ${human(usage(game))} in the file system.`;
        if (game.who !== 'root') return game.error(`Failed to vacuum ${JOURNAL}/${machineId(game)}: Permission denied`);
        const [, kind, , raw] = /^--vacuum-(size|time|files)(=)?(.*)$/.exec(vacuumArg!)!;
        const value = raw || args[args.indexOf(vacuumArg!) + 1] || '';
        if (kind === 'size') {
          const max = readSize(value.replace(/B$/i, ''));
          if (max === null) return game.error(`Failed to parse size value: ${value}`);
          return vacuum(game, (remaining) => remaining.reduce((t, f) => t + f.size, 0) <= max).join('\n');
        }
        if (kind === 'files') {
          if (!/^\d+$/.test(value)) return game.error(`Failed to parse n_files: ${value}`);
          return vacuum(game, (remaining) => remaining.filter((f) => f.archived).length < Number(value) || remaining.filter((f) => f.archived).length <= Number(value)).join('\n');
        }
        const span = readSpan(value);
        if (span === null) return game.error(`Failed to parse timestamp: ${value}`);
        const now = sd?.clock ?? 0;
        return vacuum(game, (_, f) => f.time >= now - span).join('\n');
      }
      if (!sd) return '-- No entries --';
      let unit: string | null = null;
      let count: number | null = null;
      let priority = 7;
      let onlyBoot = false;
      let onlyKernel = false;
      let since: number | null = null;
      let until: number | null = null;
      let follow = false;
      // -b [N] (0: this boot, -1: the one before), -o FORMAT, -r, -g PATTERN, -p FROM..TO.
      let bootOffset: number | null = null;
      let output = 'short';
      let reverse = false;
      let grep: RegExp | null = null;
      let lowest = 0;
      let listBoots = false;
      // --user (-u then names a unit of the user's manager), --user-unit=UNIT.
      let userScope = false;
      let userUnit: string | null = null;
      const readPriority = (v: string) => ({ emerg: 0, alert: 1, crit: 2, err: 3, warning: 4, notice: 5, info: 6, debug: 7 } as Record<string, number>)[v] ?? (/^[0-7]$/.test(v) ? Number(v) : null);
      const setPriority = (v: string): boolean => {
        const [a, b] = v.split('..');
        const x = readPriority(a);
        const y = b === undefined ? null : readPriority(b);
        if (x === null || (b !== undefined && y === null)) return false;
        // -p err: err and more serious; -p FROM..TO: that range.
        if (y === null) [lowest, priority] = [0, x];
        else [lowest, priority] = [Math.min(x, y), Math.max(x, y)];
        return true;
      };
      for (let i = 0; i < args.length; i++) {
        const a = args[i];
        if (a.startsWith('--')) {
          if (a.startsWith('--unit=')) unit = a.slice(7);
          else if (a === '--user') userScope = true;
          else if (/^--user-unit(=|$)/.test(a)) userUnit = a.includes('=') ? a.slice(12) : (args[++i] ?? '');
          else if (a === '--follow') follow = true;
          else if (a === '--no-pager' || a === '--pager-end' || a === '--no-hostname' || a === '--quiet') continue;
          else if (a === '--reverse') reverse = true;
          else if (a === '--list-boots') listBoots = true;
          else if (/^--boot(=|$)/.test(a)) bootOffset = a.includes('=') ? Number(a.slice(7)) : /^-?\d+$/.test(args[i + 1] ?? '') ? Number(args[++i]) : 0;
          else if (/^--output(=|$)/.test(a)) output = a.includes('=') ? a.slice(9) : (args[++i] ?? '');
          else if (/^--grep(=|$)/.test(a)) grep = new RegExp(a.includes('=') ? a.slice(7) : (args[++i] ?? ''), 'i');
          else if (/^--priority(=|$)/.test(a)) {
            const v = a.includes('=') ? a.slice(11) : (args[++i] ?? '');
            if (!setPriority(v)) return game.error(`Failed to parse priority value: ${v}`);
          }
          // --since / --until: a date ("2027-09-12 02:00"), a time (today), today, yesterday.
          else if (/^--(since|until)(=|$)/.test(a)) {
            const value = a.includes('=') ? a.slice(a.indexOf('=') + 1) : args[++i];
            const ms = value === undefined ? null : readMoment(sd, value);
            if (ms === null) return game.error(`Failed to parse timestamp: ${value ?? ''}`);
            if (a.startsWith('--since')) since = ms;
            else until = ms;
          }
          else return game.error(`journalctl: unrecognized option '${a}'`);
          continue;
        }
        if (!a.startsWith('-')) return game.error(game.t('journalctl-argument', { argument: a }));
        // Grouped short options, like -xeu nginx: the last one may take a value.
        for (let j = 1; j < a.length; j++) {
          const l = a[j];
          if ('unpog'.includes(l)) {
            const value = a.slice(j + 1) || args[++i];
            if (value === undefined) return game.error(`journalctl: option requires an argument -- '${l}'`);
            if (l === 'u') unit = value;
            else if (l === 'n') count = Number(value);
            else if (l === 'o') output = value;
            else if (l === 'g') grep = new RegExp(value, /[A-Z]/.test(value) ? '' : 'i');
            else if (!setPriority(value)) return game.error(`Failed to parse priority value: ${value}`);
            break;
          }
          // -b alone (this boot), or -b -1, -b 0, -b1: a boot by its offset.
          if (l === 'b') {
            const glued = a.slice(j + 1);
            if (/^-?\d+$/.test(glued)) {
              bootOffset = Number(glued);
              break;
            }
            bootOffset = j === a.length - 1 && /^-?\d+$/.test(args[i + 1] ?? '') ? Number(args[++i]) : 0;
            onlyBoot = true;
          }
          else if (l === 'r') reverse = true;
          // -k: the kernel's messages, since this boot.
          else if (l === 'k') {
            onlyKernel = true;
            onlyBoot = true;
          }
          // -f: the last lines, then what arrives, until Ctrl-C (Shell.follow).
          else if (l === 'f') follow = true;
          else if (l !== 'x' && l !== 'e' && l !== 'q') return game.error(`journalctl: invalid option -- '${l}'`);
        }
      }
      if (!['short', 'short-iso', 'short-precise', 'short-full', 'cat', 'short-unix'].includes(output)) return game.error(`Unknown output format '${output}'.`);
      // The boots in the journal (--list-boots), and the one asked for (-b -1).
      const boots = [...new Set(sd.log.map((e) => e.boot))].sort((a, b) => a - b);
      if (listBoots) {
        const rows = boots.map((b) => {
          const entries = sd.log.filter((e) => e.boot === b);
          return `${String(b - sd.boot).padStart(3)} ${bootId(b)} ${dateComplete(entries[0].time, game.t.language, sd)} ${dateComplete(entries.at(-1)!.time, game.t.language, sd)}`;
        });
        return ['IDX BOOT ID                          FIRST ENTRY                 LAST ENTRY', ...rows].join('\n');
      }
      let boot: number | null = null;
      if (bootOffset !== null) {
        boot = bootOffset <= 0 ? sd.boot + bootOffset : (boots[bootOffset - 1] ?? -1);
        if (!boots.includes(boot)) return game.error(`Data from the specified boot (${bootOffset > 0 ? `+${bootOffset}` : bootOffset}) is not available: No such boot ID in journal`);
        onlyBoot = true;
      }
      if (userScope && unit !== null) [userUnit, unit] = [unit, null];
      // A user's own messages (--user, --user-unit): readable by that user.
      const mine = (userScope || userUnit !== null) && game.who !== 'root';
      // Reading the whole journal: root, or the adm and systemd-journal groups.
      const allowed = mine || game.who === 'root' || game.groupsFor(game.who).some((g) => g === 'adm' || g === 'systemd-journal');
      if (!allowed)
        return [
          'Hint: You are currently not seeing messages from other users and the system.',
          "      Users in groups 'adm', 'systemd-journal' can see all messages.",
          '      Pass -q to turn off this notice.',
          '-- No entries --',
        ].join('\n');
      const u = unit && (unit.endsWith('.service') ? unit : `${unit}.service`);
      const uu = userUnit && (userUnit.includes('.') ? userUnit : `${userUnit}.service`);
      // Dates are read in the machine's time (the one the journal displays).
      const shows = (e: { time: number }) => e.time + (sd.difference ?? 0);
      const kept = (e: (typeof sd.log)[number]) =>
        (!u || e.unit === u) &&
        (!uu || e.userUnit === uu) &&
        (!userScope || !!e.userUnit) &&
        (!mine || e.user === game.who) &&
        (!onlyKernel || e.ident === 'kernel') &&
        e.priority <= priority &&
        e.priority >= lowest &&
        (!grep || grep.test(e.message)) &&
        (!onlyBoot || e.boot === (boot ?? sd.boot)) &&
        (since === null || shows(e) >= since) &&
        (until === null || shows(e) <= until);
      let inputs = sd.log.filter(kept);
      // Like the real journalctl, -f shows the last 10 lines, then follows.
      if (count === null && follow) count = 10;
      if (count !== null) inputs = inputs.slice(-count);
      if (follow && c.last) {
        let views = sd.log.length;
        game.follow = {
          read: () => {
            const fresh = sd.log.slice(views).filter(kept);
            views = sd.log.length;
            return fresh.map((e) => logLine(e, sd, game.t.language, colour)).join('\n');
          },
        };
      }
      if (!inputs.length) return '-- No entries --';
      if (reverse) inputs = [...inputs].reverse();
      const lines: string[] = [];
      inputs.forEach((e, i) => {
        if (i > 0 && e.boot !== inputs[i - 1].boot && output !== 'cat') lines.push(`-- Boot ${bootId(e.boot)} --`);
        lines.push(formatted(e, sd, output, game.t.language, colour));
      });
      return lines.join('\n');
    },
  },

  reboot: {
    launch: ({ game }) => {
      const sd = systemd(game);
      if (game.who !== 'root') return game.error(game.t('reboot-refuse'));
      if (sd) restart(game, sd);
      game.reboot = true;
      return '';
    },
  },
};
