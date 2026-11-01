// Dependencies between systemd units, and the order of a boot. A unit
// file (/usr/lib/systemd/system/NAME.service, or /etc/systemd/system/
// NAME.service) and its drop-ins (NAME.service.d/*.conf) say what a
// service needs: Requires=, Wants=, BindsTo= pull other units in, After=
// and Before= only order them; PartOf= propagates stop and restart.
// Restart=, RestartSec=, StartLimitBurst= and StartLimitIntervalSec= decide
// what happens when it dies. A boot starts what multi-user.target wants
// (the enabled services), in the order the After= and Before= lines give,
// in parallel otherwise; systemd-analyze reads its timing.
// After systemd.unit(5), systemd.service(5), systemctl(1) and
// systemd-analyze(1):
// https://www.freedesktop.org/software/systemd/man/latest/systemd.unit.html,
// https://www.freedesktop.org/software/systemd/man/latest/systemd.service.html,
// https://www.freedesktop.org/software/systemd/man/latest/systemd-analyze.html
// Differences: "parallel" units start one after the other in the order of
// their definition (the race is always lost the same way); a few targets
// only, declared by the chapter; no Conflicts=, Requisite=, slices nor
// sockets; Type=notify is not modelled (a service is ready when it starts).

import type { Game } from './shell';
import { readyAt, scheduleRestart, start, startLimitHit, limitHit, stop, writeLog, type Service, type Systemd } from './systemd';
import { readDuration } from './timers';

export interface Dependencies {
  after: string[];
  before: string[];
  requires: string[];
  wants: string[];
  bindsTo: string[];
  partOf: string[];
  wantedBy: string[];
}

export interface Target {
  description: string;
  wants: string[];
  after: string[];
}

export interface BootTiming {
  // Kernel and userspace times (ms).
  kernel: number;
  userspace: number;
  // Each unit of the boot: when it started (from the start of userspace) and how long it took.
  units: Record<string, { at: number; took: number }>;
}

const LISTS: Record<string, keyof Dependencies> = {
  After: 'after',
  Before: 'before',
  Requires: 'requires',
  Wants: 'wants',
  BindsTo: 'bindsTo',
  PartOf: 'partOf',
  WantedBy: 'wantedBy',
};

/** NAME.service, NAME.target… → the key: a service by its short name, the rest whole. */
export const key = (unit: string) => (unit.endsWith('.service') ? unit.slice(0, -8) : unit);
export const unitOf = (k: string) => (k.includes('.') ? k : `${k}.service`);

// ——— Unit files ———

export interface Line {
  file: string;
  number: number;
  section: string;
  name: string;
  value: string;
}

/** The lines of a unit file: [Section], then Key=Value (comments and blank lines ignored). */
export function unitLines(game: Game, file: string): { lines: Line[]; sections: { name: string; number: number }[] } {
  const lines: Line[] = [];
  const sections: { name: string; number: number }[] = [];
  let section = '';
  (game.read(file) ?? '').split('\n').forEach((raw, i) => {
    const l = raw.trim();
    if (!l || l.startsWith('#') || l.startsWith(';')) return;
    const s = /^\[(.+)\]$/.exec(l);
    if (s) {
      section = s[1];
      sections.push({ name: section, number: i + 1 });
      return;
    }
    const m = /^([A-Za-z]+)\s*=\s*(.*)$/.exec(l);
    if (m && section) lines.push({ file, number: i + 1, section, name: m[1], value: m[2].trim() });
  });
  return { lines, sections };
}

/** The unit's main file, if there is one: hand-written in /etc, otherwise the package's. */
export function mainFile(game: Game, name: string, s?: Service): string | null {
  for (const f of [s?.file, `/etc/systemd/system/${unitOf(name)}`, s?.unitFile, `/usr/lib/systemd/system/${unitOf(name)}`])
    if (f && game.find(f)?.type === 'file') return f;
  return null;
}

/** The drop-ins (NAME.service.d/*.conf), in the order systemd reads them. */
export function dropIns(game: Game, name: string): string[] {
  const files: string[] = [];
  for (const base of ['/usr/lib/systemd/system', '/etc/systemd/system.control', '/etc/systemd/system']) {
    const place = game.find(`${base}/${unitOf(name)}.d`);
    if (place?.type === 'directory')
      files.push(...Object.keys(place.children).filter((f) => f.endsWith('.conf')).sort().map((f) => `${base}/${unitOf(name)}.d/${f}`));
  }
  // Like systemd: by file name, whatever the directory; a later one wins.
  return files.sort((a, b) => a.split('/').at(-1)!.localeCompare(b.split('/').at(-1)!));
}

/** Every line of the unit, its file then its drop-ins. */
export const allLines = (game: Game, name: string, s?: Service) => {
  const main = mainFile(game, name, s);
  return [...(main ? [main] : []), ...dropIns(game, name)].flatMap((f) => unitLines(game, f).lines);
};

/** Rereads the dependencies and Restart= settings of every unit that has a file (daemon-reload, boot). */
export function loadDependencies(game: Game, sd: Systemd) {
  for (const [name, s] of Object.entries(sd.services)) {
    const lines = allLines(game, name, s);
    if (!lines.length && !mainFile(game, name, s)) continue;
    const deps: Dependencies = { after: [], before: [], requires: [], wants: [], bindsTo: [], partOf: [], wantedBy: [] };
    let restart: string | undefined;
    let restartSec: number | undefined;
    let burst: number | undefined;
    let interval: number | undefined;
    let exec: string | undefined;
    for (const l of lines) {
      const list = LISTS[l.name];
      // An empty assignment resets the list (systemd.unit(5)).
      if (list && (l.section === 'Unit' || (l.section === 'Install' && list === 'wantedBy'))) {
        if (!l.value) deps[list] = [];
        else deps[list].push(...l.value.split(/\s+/));
      } else if (l.section === 'Service' && l.name === 'Restart') restart = l.value || undefined;
      else if (l.section === 'Service' && l.name === 'RestartSec') restartSec = readSeconds(l.value) ?? restartSec;
      else if (l.section === 'Unit' && l.name === 'StartLimitBurst') burst = Number(l.value) || undefined;
      else if (l.section === 'Unit' && l.name === 'StartLimitIntervalSec') interval = readSeconds(l.value) ?? interval;
      else if (l.section === 'Service' && l.name === 'ExecStart') exec = l.value ? (exec === undefined || exec === '' ? l.value : exec) : '';
    }
    s.deps = deps;
    s.reboot = restart ?? s.reboot;
    s.restartSec = restartSec;
    s.startLimitBurst = burst;
    s.startLimitInterval = interval;
    s.execStart = exec;
  }
}

/** "5", "5s", "500ms", "2min" → ms (a bare number is in seconds, like systemd). */
export function readSeconds(text: string): number | null {
  const ms = /^(\d+)ms$/.exec(text.trim());
  if (ms) return Number(ms[1]);
  if (text.trim() === 'infinity') return Infinity;
  return readDuration(text);
}

// ——— The units around a unit ———

const depsOf = (sd: Systemd, k: string): Dependencies | Target | undefined =>
  sd.services[k]?.deps ?? sd.targets?.[k];

/** What this unit pulls in (Requires=, Wants=, BindsTo=), by key. */
export function pulls(sd: Systemd, k: string): string[] {
  const d = depsOf(sd, k);
  if (!d) return [];
  // The enabled units whose [Install] says WantedBy= this one (the .wants/ links).
  const wantedBy = Object.entries(sd.services)
    .filter(([, s]) => s.active && s.deps?.wantedBy.includes(unitOf(k)))
    .map(([n]) => n);
  const all = 'requires' in d ? [...d.requires, ...d.bindsTo, ...d.wants] : d.wants;
  return [...new Set([...all.map(key), ...wantedBy])];
}

/** The units this one starts after (its After=, and the Before= of the others). */
export function afters(sd: Systemd, k: string): string[] {
  const own = (depsOf(sd, k)?.after ?? []).map(key);
  const others = Object.entries(sd.services)
    .filter(([, s]) => s.deps?.before.map(key).includes(k))
    .map(([n]) => n);
  return [...new Set([...own, ...others])];
}

/** The boot's units: what multi-user.target wants (the enabled services), and what they pull in. */
function bootSet(sd: Systemd): string[] {
  const set: string[] = [];
  const add = (k: string) => {
    if (set.includes(k) || (!sd.services[k] && !sd.targets?.[k])) return;
    set.push(k);
    pulls(sd, k).forEach(add);
  };
  // multi-user.target wants the enabled services installed for it (WantedBy=multi-user.target);
  // a service enabled for another target comes with that target.
  Object.entries(sd.services)
    .filter(([, s]) => s.active && (!s.deps?.wantedBy.length || s.deps.wantedBy.includes('multi-user.target')))
    .forEach(([n]) => add(n));
  // Ordered like the definitions (the services, then the targets).
  const order = [...Object.keys(sd.services), ...Object.keys(sd.targets ?? {})];
  return set.sort((a, b) => order.indexOf(a) - order.indexOf(b));
}

const durationOf = (game: Game, sd: Systemd, k: string) => {
  const s = sd.services[k];
  if (!s) return 0;
  return typeof s.startDuration === 'function' ? s.startDuration(game) : (s.startDuration ?? 100);
};

/** When each unit of the boot starts (ms after the start of userspace), following After= and Before=. */
function schedule(game: Game, sd: Systemd, set: string[]): Record<string, { at: number; took: number }> {
  const times: Record<string, { at: number; took: number }> = {};
  const computing = new Set<string>();
  const time = (k: string): { at: number; took: number } => {
    if (times[k]) return times[k];
    // An ordering cycle: systemd breaks it (here, the edge that closes it is ignored).
    if (computing.has(k)) return { at: 0, took: 0 };
    computing.add(k);
    const at = Math.max(0, ...afters(sd, k).filter((x) => set.includes(x)).map((x) => time(x).at + time(x).took));
    computing.delete(k);
    return (times[k] = { at, took: durationOf(game, sd, k) });
  };
  set.forEach(time);
  return times;
}

/**
 * A boot: the units start in the order of the schedule (at the same moment,
 * in the order of their definition); a unit whose Requires= or BindsTo=
 * failed doesn't start ("Dependency failed"). The machine is up when the last
 * one is ready; systemd-analyze reads the timing.
 */
export function bootUnits(game: Game, sd: Systemd) {
  loadDependencies(game, sd);
  for (const s of Object.values(sd.services)) {
    s.state = 'inactive';
    s.since = sd.clock;
    s.attempts = [];
    s.result = undefined;
  }
  sd.pending = [];
  const set = bootSet(sd);
  const times = schedule(game, sd, set);
  const base = sd.clock;
  const order = [...set].sort((a, b) => times[a].at - times[b].at || set.indexOf(a) - set.indexOf(b));
  for (const k of order) {
    const s = sd.services[k];
    if (!s) continue;
    const t = times[k];
    sd.clock = Math.max(sd.clock, base + t.at - 1000);
    const needed = [...(s.deps?.requires ?? []), ...(s.deps?.bindsTo ?? [])].map(key);
    // A required unit that failed (not one still starting: without After=, both start together).
    const missing = needed.find((n) => sd.services[n] && (sd.services[n].state === 'failed' || sd.services[n].result === 'dependency'));
    if (missing && set.includes(missing)) {
      dependencyFailed(sd, k);
      continue;
    }
    // start() lets the start's duration pass: the program checks what it needs once it is over.
    start(game, sd, k, true);
  }
  const userspace = Math.max(0, ...set.map((k) => times[k].at + times[k].took));
  sd.lastBoot = { kernel: 1906, userspace, units: times };
  sd.clock = Math.max(sd.clock, base + userspace);
  for (const [n, s] of Object.entries(sd.services)) if (s.state === 'failed' && s.result === 'exit-code') scheduleRestart(sd, n, s.since, 1);
  runPending(game, sd);
}

/** "Dependency failed": the unit doesn't start because a unit it requires failed. */
export function dependencyFailed(sd: Systemd, k: string) {
  const s = sd.services[k];
  const unit = unitOf(k);
  writeLog(sd, unit, 'systemd', 1, `Dependency failed for ${unit} - ${s.description}.`, 3);
  writeLog(sd, unit, 'systemd', 1, `${unit}: Job ${unit}/start failed with result 'dependency'.`, 4, false);
  s.state = 'inactive';
  s.result = 'dependency';
  s.since = sd.clock;
}

/**
 * systemctl start: the units it requires or wants first (those it must start
 * after, then the others), then the unit itself. Returns 'ok', 'failed',
 * 'dependency' or 'limit' (start limit hit).
 */
export function startWithDependencies(game: Game, sd: Systemd, k: string, seen = new Set<string>()): 'ok' | 'failed' | 'dependency' | 'limit' {
  const s = sd.services[k];
  if (!s || seen.has(k)) return 'ok';
  seen.add(k);
  if (s.state === 'active') return 'ok';
  const needed = [...(s.deps?.requires ?? []), ...(s.deps?.bindsTo ?? [])].map(key);
  for (const d of pulls(sd, k)) {
    const target = sd.targets?.[d];
    const units = target ? target.wants.map(key) : [d];
    for (const u of units) {
      const r = startWithDependencies(game, sd, u, seen);
      if (r !== 'ok' && needed.includes(d)) {
        dependencyFailed(sd, k);
        return 'dependency';
      }
    }
  }
  const before = s.attempts?.length ?? 0;
  if (start(game, sd, k)) return 'ok';
  return s.result === 'start-limit-hit' && (s.attempts?.length ?? 0) === before ? 'limit' : 'failed';
}

/** The units to stop with this one: PartOf= and BindsTo= point at it. */
export const boundTo = (sd: Systemd, k: string, how: 'partOf' | 'bindsTo' | 'both' = 'both') =>
  Object.entries(sd.services)
    .filter(([, s]) => (how !== 'bindsTo' && s.deps?.partOf.map(key).includes(k)) || (how !== 'partOf' && s.deps?.bindsTo.map(key).includes(k)))
    .map(([n]) => n);

/** systemctl stop: the units that are part of it, or bound to it, stop first. */
export function stopWithDependents(game: Game, sd: Systemd, k: string) {
  for (const d of boundTo(sd, k)) if (sd.services[d].state === 'active') stop(game, sd, d);
  if (sd.services[k].state === 'active') stop(game, sd, k);
  else sd.services[k].state = 'inactive';
}

/** systemctl restart: the units that are part of it (PartOf=) restart with it, after it. */
export function restartWithDependents(game: Game, sd: Systemd, k: string): ReturnType<typeof startWithDependencies> {
  const parts = boundTo(sd, k, 'partOf').filter((d) => sd.services[d].state === 'active');
  stopWithDependents(game, sd, k);
  const r = startWithDependencies(game, sd, k);
  for (const d of parts) startWithDependencies(game, sd, d);
  return r;
}

/**
 * A running service dies (its program exits in failure, e.g. it lost its
 * database): its last words go to the journal, then Restart= decides.
 */
export function crash(sd: Systemd, k: string, messages: string[]) {
  const s = sd.services[k];
  if (!s || s.state !== 'active') return;
  const unit = unitOf(k);
  const pid = s.process[0]?.pid ?? 1;
  messages.forEach((m, i) => writeLog(sd, unit, s.executable, pid, m, 3, i === 0));
  writeLog(sd, unit, 'systemd', 1, `${unit}: Main process exited, code=exited, status=1/FAILURE`, 4, false);
  writeLog(sd, unit, 'systemd', 1, `${unit}: Failed with result 'exit-code'.`, 4, false);
  s.state = 'failed';
  s.result = 'exit-code';
  s.since = sd.clock;
  scheduleRestart(sd, k, sd.clock, 1);
}

/**
 * The restarts Restart= scheduled, in the order of time (the journal is
 * put back in order afterwards): each attempt counts against the start
 * limit, and the program checks what it needs at that moment (`check` reads
 * sd.clock).
 */
export function runPending(game: Game, sd: Systemd) {
  const now = sd.clock;
  let touched = false;
  while (sd.pending?.length) {
    sd.pending.sort((a, b) => a.at - b.at);
    const p = sd.pending.shift()!;
    const s = sd.services[p.unit];
    if (!s || s.state === 'active') continue;
    touched = true;
    const unit = unitOf(p.unit);
    const at = (message: string, priority = 6, ident = 'systemd', pid = 1) =>
      sd.log.push({ time: p.at, boot: sd.boot, unit, ident, pid, message, priority });
    at(`${unit}: Scheduled restart job, restart counter is at ${p.counter}.`);
    at(`Stopped ${unit} - ${s.description}.`);
    if (limitHit(sd, s, p.at)) {
      startLimitHit(sd, p.unit, p.at);
      continue;
    }
    at(`Starting ${unit} - ${s.description}...`);
    const clock = sd.clock;
    sd.clock = p.at;
    const errors = s.check?.(game) ?? null;
    sd.clock = clock;
    if (errors) {
      errors.forEach((e) => at(e, 3, s.executable, s.process[0]?.pid ?? 1));
      at(`${unit}: Main process exited, code=exited, status=1/FAILURE`, 4);
      at(`${unit}: Failed with result 'exit-code'.`, 4);
      at(`Failed to start ${unit} - ${s.description}.`, 3);
      s.state = 'failed';
      s.result = 'exit-code';
      s.since = p.at;
      scheduleRestart(sd, p.unit, p.at, p.counter + 1);
      continue;
    }
    at(`Started ${unit} - ${s.description}.`);
    s.state = 'active';
    s.result = undefined;
    s.since = p.at;
    s.load?.(game);
    sd.clock = Math.max(sd.clock, p.at);
  }
  if (touched) sd.log.sort((a, b) => a.time - b.time);
  sd.clock = Math.max(sd.clock, now);
}

export { readyAt };

// ——— What systemctl and systemd-analyze show ———

const DOT = { active: '●', failed: '●', inactive: '○' } as const;

/** systemctl list-dependencies: the units pulled in (or, with --after/--before, the ordering), as a tree. */
export function dependencyTree(sd: Systemd, root: string, how: 'pulls' | 'after' | 'before', paint: (code: string, text: string) => string): string {
  const children = (k: string) => {
    if (how === 'pulls') return pulls(sd, k).filter((x) => sd.services[x] || sd.targets?.[x]);
    if (how === 'after') return afters(sd, k).filter((x) => sd.services[x] || sd.targets?.[x]);
    return Object.keys({ ...sd.services, ...(sd.targets ?? {}) }).filter((x) => afters(sd, x).includes(k));
  };
  const dot = (k: string) => {
    const s = sd.services[k];
    const state = s ? s.state : targetReached(sd, k) ? 'active' : 'inactive';
    return state === 'active' ? paint('0;1;32', DOT.active) : state === 'failed' ? paint('0;1;31', DOT.failed) : DOT.inactive;
  };
  const lines = [unitOf(root)];
  const walk = (k: string, prefix: string, seen: Set<string>) => {
    const list = children(k);
    list.forEach((c, i) => {
      const last = i === list.length - 1;
      lines.push(`${dot(c)} ${prefix}${last ? '└─' : '├─'}${unitOf(c)}`);
      if (!seen.has(c)) walk(c, `${prefix}${last ? '  ' : '│ '}`, new Set([...seen, c]));
    });
  };
  walk(root, '', new Set([root]));
  return lines.join('\n');
}

/** A target is reached when the units it waits for are done (whatever their result). */
export const targetReached = (sd: Systemd, k: string) => !!sd.targets?.[k] && sd.lastBoot !== undefined;

/** systemctl cat: the unit file, then its drop-ins, each under its path. */
export function catUnit(game: Game, sd: Systemd, k: string): string | null {
  const main = mainFile(game, k, sd.services[k]);
  const files = [...(main ? [main] : []), ...dropIns(game, k)];
  if (!files.length) return null;
  return files.map((f) => `# ${f}\n${(game.read(f) ?? '').replace(/\n+$/, '')}`).join('\n\n');
}

const KNOWN: Record<string, string[]> = {
  Unit: [
    'Description', 'Documentation', 'After', 'Before', 'Requires', 'Wants', 'BindsTo', 'PartOf', 'Requisite', 'Conflicts', 'RequiresMountsFor',
    'StartLimitIntervalSec', 'StartLimitBurst', 'ConditionPathExists', 'ConditionFileIsExecutable', 'OnFailure', 'DefaultDependencies',
  ],
  Service: [
    'Type', 'ExecStart', 'ExecStartPre', 'ExecStartPost', 'ExecReload', 'ExecStop', 'Restart', 'RestartSec', 'User', 'Group', 'WorkingDirectory',
    'Environment', 'EnvironmentFile', 'TimeoutStartSec', 'TimeoutStopSec', 'RemainAfterExit', 'MemoryMax', 'IOReadBandwidthMax',
    'IOWriteBandwidthMax', 'StandardOutput', 'StandardError', 'KillMode', 'LimitNOFILE', 'PrivateTmp', 'ProtectSystem', 'NoNewPrivileges',
    'ReadWritePaths', 'PIDFile',
  ],
  Install: ['WantedBy', 'RequiredBy', 'Alias', 'Also'],
};

/** systemd-analyze verify: unknown sections and keys, required units that don't exist. */
export function verify(game: Game, sd: Systemd, file: string, k: string): string[] {
  const problems: string[] = [];
  const unit = unitOf(k);
  for (const f of [file, ...dropIns(game, k)]) {
    const { lines, sections } = unitLines(game, f);
    for (const s of sections) if (!KNOWN[s.name]) problems.push(`${f}:${s.number}: Unknown section '${s.name}'. Ignoring.`);
    for (const l of lines)
      if (KNOWN[l.section] && !KNOWN[l.section].includes(l.name)) problems.push(`${f}:${l.number}: Unknown key name '${l.name}' in section '${l.section}', ignoring.`);
  }
  const deps = allLines(game, k).filter((l) => l.section === 'Unit' && ['Requires', 'Wants', 'BindsTo'].includes(l.name));
  for (const l of deps)
    for (const d of l.value.split(/\s+/).filter(Boolean))
      if (!sd.services[key(d)] && !sd.targets?.[key(d)]) problems.push(`${unit}: Failed to create ${unit}/start: Unit ${d} not found.`);
  return problems;
}

/** A duration the way systemd-analyze writes it: 702ms, 1.906s, 2min 1.512s. */
export function analyzeDuration(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)}ms`;
  const min = Math.floor(ms / 60_000);
  const rest = ms - min * 60_000;
  const s = rest % 1000 === 0 ? `${rest / 1000}s` : `${(rest / 1000).toFixed(3).replace(/0+$/, '')}s`;
  return min ? `${min}min ${s}` : s;
}

/** systemd-analyze critical-chain: from the unit, the dependency that finished last, down the chain. */
export function criticalChain(sd: Systemd, root: string): string {
  const times = sd.lastBoot?.units ?? {};
  const lines = [
    'The time when unit became active or started is printed after the "@" character.',
    'The time the unit took to start is printed after the "+" character.',
    '',
  ];
  const end = (k: string) => (times[k] ? times[k].at + times[k].took : 0);
  let k: string | undefined = root;
  let depth = 0;
  const seen = new Set<string>();
  while (k && !seen.has(k)) {
    seen.add(k);
    const t = times[k] ?? { at: k === 'multi-user.target' ? (sd.lastBoot?.userspace ?? 0) : 0, took: 0 };
    lines.push(`${depth ? `${'  '.repeat(depth - 1)}└─` : ''}${unitOf(k)} @${analyzeDuration(t.at)}${t.took ? ` +${analyzeDuration(t.took)}` : ''}`);
    const before: string[] = (k === 'multi-user.target' ? Object.keys(times).filter((x) => sd.services[x]?.active) : afters(sd, k)).filter((x) => times[x]);
    k = before.sort((a, b) => end(b) - end(a))[0];
    depth++;
  }
  return lines.join('\n');
}
