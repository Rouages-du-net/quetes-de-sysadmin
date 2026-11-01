// systemctl, journalctl and reboot, on the simulated systemd (../systemd.ts).
// Messages based on systemd (https://www.freedesktop.org/software/systemd/man/latest/):
// they stay in English, like those of the real systemctl.

import type { Shell } from '../shell';
import { stop, dateComplete, start, duration, writeLog, logLine, reload, restart, systemd, type Systemd } from '../systemd';
import type { Command } from './index';
import { colourise, sgr } from '../colours';
import { readSize } from '../memory';
import { loadUnits, readCalendar, nextCalendar, nextTrigger, timerFor } from '../timers';
import { toUtc } from '../systemd';
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
    `     Loaded: loaded (${s.file ?? (sd.ordered ? mainFile(game, name, s) : null) ?? `/usr/lib/systemd/system/${unit}`}; ${s.active ? 'enabled' : 'disabled'}; preset: enabled)`,
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
    // The last file read wins (like systemd: names are sorted, /etc/systemd/system after system.control here).
    for (const path of paths) {
      let section = '';
      for (const line of (game.read(path) ?? '').split('\n')) {
        const l = line.trim();
        if (/^\[.*\]$/.test(l)) section = l;
        const m = /^(\w+)\s*=\s*(.*)$/.exec(l);
        if (!m || section !== '[Service]') continue;
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
  const relative = /^-(\d+)\s*(s|min|m|h|d)$/.exec(text.trim());
  if (relative) return now - Number(relative[1]) * { s: 1000, min: 60_000, m: 60_000, h: 3_600_000, d: 86_400_000 }[relative[2] as 's']!;
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
          .filter(([k, t]) => sd.services[k] && t.took > 0)
          .sort((a, b) => b[1].took - a[1].took)
          .map(([k, t]) => [analyzeDuration(t.took), `${k}.service`]);
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
      const now = args.includes('--now');
      const unknown = args.find((a) => /^-[^-]/.test(a));
      if (unknown) return game.error(`systemctl: invalid option -- '${unknown[1]}'`);
      const words = args.filter((a) => !a.startsWith('--') || a === '--failed');
      const [action = 'list-units', ...names] = words;
      const VERBS = ['status', 'start', 'stop', 'restart', 'reload', 'enable', 'disable', 'is-active', 'is-enabled', 'list-units', 'reboot', '--failed', 'edit', 'daemon-reload', 'set-property', 'list-timers', 'default', 'cat', 'list-dependencies', 'reset-failed'];
      if (!VERBS.includes(action)) return game.error(`Unknown command verb '${action}'.`);
      // Looking at the services' state after a reboot: that is checking.
      const consulter = () => (sd.checkedAfterBoot = true);
      if (action === '--failed' || (action === 'list-units' && args.includes('--failed'))) return consulter(), listing(sd, true, paint);
      if (action === 'list-units') return consulter(), listing(sd, false, paint);
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
          if (m[1] !== 'MemoryMax' && !io) return game.error(`Failed to set unit properties on ${name}.service: Cannot set property ${m[1]}, or unknown property.`);
          if (io && !readIoLimit(m[2])) return game.error(`Failed to parse ${m[1]}= value: ${m[2]}`);
          if (!io && m[2] !== 'infinity' && readSize(m[2]) === null) return game.error(`Failed to parse MemoryMax= value: ${m[2]}`);
          const place = `/etc/systemd/system.control/${name}.service.d`;
          for (const path of ['/etc/systemd', '/etc/systemd/system.control', place])
            if (!game.exists(path)) game.place('systemctl', path, { type: 'directory', children: {}, owner: 'root' });
          const file = `${place}/50-${m[1]}.conf`;
          const value = io ? `${readIoLimit(m[2])!.device} ${readIoLimit(m[2])!.bytes}` : m[2] === 'infinity' ? 'infinity' : readSize(m[2]);
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
        const name = unitName(raw);
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
        } else if (action === 'is-enabled') outputs.push(s.active ? 'enabled' : 'disabled');
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
            if (s.state !== 'active') game.error(`${name}.service is not active, cannot reload.`);
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
      if (!sd) return '-- No entries --';
      let unit: string | null = null;
      let count: number | null = null;
      let priority = 7;
      let onlyBoot = false;
      let onlyKernel = false;
      let since: number | null = null;
      let until: number | null = null;
      let follow = false;
      for (let i = 0; i < args.length; i++) {
        const a = args[i];
        if (a.startsWith('--')) {
          if (a.startsWith('--unit=')) unit = a.slice(7);
          else if (a === '--follow') follow = true;
          else if (a === '--no-pager' || a === '--pager-end') continue;
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
          if ('unp'.includes(l)) {
            const value = a.slice(j + 1) || args[++i];
            if (value === undefined) return game.error(`journalctl: option requires an argument -- '${l}'`);
            if (l === 'u') unit = value;
            else if (l === 'n') count = Number(value);
            else priority = { emerg: 0, alert: 1, crit: 2, err: 3, warning: 4, notice: 5, info: 6, debug: 7 }[value] ?? Number(value);
            break;
          }
          if (l === 'b') onlyBoot = true;
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
      // Reading the whole journal: root, or the adm and systemd-journal groups.
      const allowed = game.who === 'root' || game.groupsFor(game.who).some((g) => g === 'adm' || g === 'systemd-journal');
      if (!allowed)
        return [
          'Hint: You are currently not seeing messages from other users and the system.',
          "      Users in groups 'adm', 'systemd-journal' can see all messages.",
          '      Pass -q to turn off this notice.',
          '-- No entries --',
        ].join('\n');
      const u = unit && (unit.endsWith('.service') ? unit : `${unit}.service`);
      // Dates are read in the machine's time (the one the journal displays).
      const shows = (e: { time: number }) => e.time + (sd.difference ?? 0);
      const kept = (e: (typeof sd.log)[number]) =>
        (!u || e.unit === u) &&
        (!onlyKernel || e.ident === 'kernel') &&
        e.priority <= priority &&
        (!onlyBoot || e.boot === sd.boot) &&
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
      const lines: string[] = [];
      inputs.forEach((e, i) => {
        if (i > 0 && e.boot !== inputs[i - 1].boot) lines.push(`-- Boot ${String(e.boot).padStart(2, '0')}f3c1e9a7d54b2c8e06a1d9f4b7c2e5 --`);
        lines.push(logLine(e, sd, game.t.language, colour));
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
