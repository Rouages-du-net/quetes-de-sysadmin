// Simulated systemd: a machine's services, journal and clock, kept in
// state.systemd. Behaviours and messages based on systemd's documentation
// (https://www.freedesktop.org/software/systemd/man/latest/systemctl.html,
// .../journalctl.html): systemctl and journalctl answer in English, dates
// follow the system's language, as on a real Linux.
// Dependencies between units (After=, Requires=, Wants=, BindsTo=,
// PartOf=), the order of a boot, Restart= and the start limit: see units.ts.
// Differences: a single main process per service, a clock that moves one
// second per action, a few targets only (declared by the chapter).

import { sgr } from './colours';
import type { Game } from './shell';
import type { Process } from './commands/system';
import { bootUnits } from './units';

export interface Service {
  description: string;
  state: 'active' | 'inactive' | 'failed';
  // Started when the machine boots (systemctl enable).
  active: boolean;
  // The service's processes when it runs (the first one is the main one).
  process: Process[];
  // Executable, for "Main PID: 612 (nginx)".
  executable: string;
  since: number;
  // On start: null if all is well, otherwise the error messages the
  // program writes to the journal before stopping.
  check?: (game: Game) => string[] | null;
  // After a successful start or reload: the service applies its
  // configuration (e.g. sshd).
  load?: (game: Game) => void;
  // reload first checks the configuration with `check` (like
  // ExecReload=/usr/sbin/sshd -t); otherwise, it reloads without checking.
  checkToReload?: boolean;
  // Type=oneshot: the service does its work then stops (e.g. certbot,
  // started by a timer); it doesn't stay "active (running)".
  oneshot?: boolean;
  // Type=oneshot with RemainAfterExit=yes (networking, nftables): once the work
  // is done, it stays "active (exited)", with no process.
  activeRest?: boolean;
  // When the service stops (e.g. timesyncd: the clock is no longer synchronized).
  stop?: (game: Game) => void;
  // How it stopped in failure (exit-code, oom-kill…).
  result?: string;
  // The settings from override files (systemctl edit): MemoryMax=, Restart=.
  maxMemory?: number;
  reboot?: string;
  // IOReadBandwidthMax= and IOWriteBandwidthMax= (the target disk, in bytes per second).
  readIo?: { device: string; bytes: number };
  writeIo?: { device: string; bytes: number };
  overrides?: string[];
  overridesFingerprint?: string;
  // A hand-written unit (/etc/systemd/system/NAME.service): its file,
  // and what it runs (ExecStart=); returns the exit code.
  file?: string;
  execute?: (game: Game) => number;
  // Dependencies (units.ts): read from the unit file and its drop-ins.
  deps?: import('./units').Dependencies;
  // The unit file of a service the chapter models (its behaviour stays the
  // chapter's: check, process): /usr/lib/systemd/system/NAME.service by default.
  unitFile?: string;
  modelled?: boolean;
  // Restart= delay (RestartSec=, ms), and the start limit (StartLimitBurst=,
  // StartLimitIntervalSec=): systemd's defaults are 100 ms, 5 starts in 10 s.
  restartSec?: number;
  startLimitBurst?: number;
  startLimitInterval?: number;
  // The recent starts (to count them against the start limit).
  attempts?: number[];
  // ExecStart= as read in the unit file and its drop-ins.
  execStart?: string;
  // How long the service takes to start (ms; systemd-analyze blame), 100 ms by default.
  startDuration?: number | ((game: Game) => number);
}

export interface Input {
  time: number;
  boot: number;
  unit: string;
  ident: string;
  pid: number;
  message: string;
  // 3 = error, 4 = warning, 6 = info (syslog).
  priority: number;
}

export interface Systemd {
  host: string;
  services: Record<string, Service>;
  log: Input[];
  // Simulated local time (milliseconds, read as UTC), current boot.
  clock: number;
  boot: number;
  // True after a reboot, once the services' state has been looked at.
  checkedAfterBoot?: boolean;
  // A service was started by hand since the last boot: what is running
  // no longer proves that the machine comes back up on its own.
  mainAStarted?: boolean;
  // The time the machine shows (its time zone, its drifting clock):
  // the offset from the real time, and the time zone's abbreviation (see time.ts).
  difference?: number;
  zone?: string;
  // The timers (NAME.timer), see timers.ts.
  timers?: Record<string, import('./timers').Timer>;
  // Boot with dependencies (units.ts): the targets the chapter declares
  // (network-online.target…), and the timing of the last boot.
  ordered?: boolean;
  targets?: Record<string, import('./units').Target>;
  lastBoot?: import('./units').BootTiming;
  // Restarts scheduled by Restart= (run by runPending, units.ts).
  pending?: { unit: string; at: number; counter: number }[];
  // The mounts of /etc/fstab at boot, and what each service waits for or requires among them.
  mountUnits?: Record<string, import('./units').MountUnit>;
  mountEdges?: Record<string, { after: string[]; requires: string[] }>;
  shuttingDown?: boolean;
}

export const systemd = (game: Game): Systemd | undefined => game.state.systemd;

// A journal entry, and the clock moving one second forward (except for
// the lines that follow in the same second).
export function writeLog(sd: Systemd, unit: string, ident: string, pid: number, message: string, priority = 6, advance = true) {
  if (advance) sd.clock += 1000;
  sd.log.push({ time: sd.clock, boot: sd.boot, unit, ident, pid, message, priority });
}

/** Starts a service; returns false if it fails (errors in the journal). */
export function start(game: Game, sd: Systemd, name: string, toBoot = false): boolean {
  const s = sd.services[name];
  if (!toBoot) sd.mainAStarted = true;
  const unit = `${name}.service`;
  // The start limit (StartLimitBurst= starts in StartLimitIntervalSec=): systemd refuses.
  if (sd.ordered && limitHit(sd, s, sd.clock)) {
    startLimitHit(sd, name, false);
    return false;
  }
  writeLog(sd, unit, 'systemd', 1, `Starting ${unit} - ${s.description}...`);
  // Starting takes time (ms): the service is ready once it is over.
  const duration = typeof s.startDuration === 'function' ? s.startDuration(game) : (s.startDuration ?? 0);
  sd.clock += duration;
  const errors = s.check?.(game) ?? null;
  const pid = s.process[0]?.pid ?? 1;
  if (errors) {
    errors.forEach((e, i) => writeLog(sd, unit, s.executable, pid, e, 3, i === 0));
    writeLog(sd, unit, 'systemd', 1, `${unit}: ${s.process.length ? 'Main' : 'Control'} process exited, code=exited, status=1/FAILURE`, 4, false);
    writeLog(sd, unit, 'systemd', 1, `${unit}: Failed with result 'exit-code'.`, 4, false);
    writeLog(sd, unit, 'systemd', 1, `Failed to start ${unit} - ${s.description}.`, 3, false);
    s.state = 'failed';
    s.result = 'exit-code';
    s.since = sd.clock;
    processRetirer(game, s);
    // Restart=: systemd tries again after RestartSec=.
    if (sd.ordered && !toBoot) scheduleRestart(sd, name, sd.clock, 1);
    return false;
  }
  if (s.oneshot) {
    // A hand-written service: its program runs, and its exit code decides.
    const code = s.execute?.(game) ?? 0;
    if (code !== 0) {
      writeLog(
        sd,
        unit,
        'systemd',
        1,
        `${unit}: Main process exited, code=exited, status=${code}/${code === 1 ? 'FAILURE' : 'INVALIDARGUMENT'}`,
        4,
      );
      writeLog(sd, unit, 'systemd', 1, `${unit}: Failed with result 'exit-code'.`, 4, false);
      writeLog(sd, unit, 'systemd', 1, `Failed to start ${unit} - ${s.description}.`, 3, false);
      s.state = 'failed';
      s.result = 'exit-code';
      s.since = sd.clock;
      return false;
    }
    writeLog(sd, unit, 'systemd', 1, `${unit}: Deactivated successfully.`);
    writeLog(sd, unit, 'systemd', 1, `Finished ${unit} - ${s.description}.`, 6, false);
    s.state = 'inactive';
    s.since = sd.clock;
    return true;
  }
  writeLog(sd, unit, 'systemd', 1, `Started ${unit} - ${s.description}.`);
  // The service is already running when it applies its configuration (it can receive requests).
  s.state = 'active';
  s.result = undefined;
  s.load?.(game);
  s.since = sd.clock;
  const listing: Process[] = (game.state.process ??= []);
  for (const p of s.process) if (!listing.some((q) => q.pid === p.pid)) listing.push({ ...p });
  return true;
}

// The service's processes stop; their zombie children disappear with them (init reaps them).
function processRetirer(game: Game, s: Service) {
  if (game.state.process)
    game.state.process = (game.state.process as Process[]).filter(
      (p) => !s.process.some((q) => q.pid === p.pid || (p.ppid === q.pid && p.zombie)),
    );
}

// ——— Restart= and the start limit (systemd.service(5), systemd.unit(5)) ———

/** True if a new start would go beyond StartLimitBurst= starts in StartLimitIntervalSec=. */
export function limitHit(sd: Systemd, s: Service, at: number): boolean {
  const interval = s.startLimitInterval ?? 10_000;
  s.attempts = (s.attempts ?? []).filter((t) => t > at - interval);
  if (interval > 0 && s.attempts.length >= (s.startLimitBurst ?? 5)) return true;
  s.attempts.push(at);
  return false;
}

/** systemd refuses to start the service again: Result: start-limit-hit. */
export function startLimitHit(sd: Systemd, name: string, at: number | false) {
  const s = sd.services[name];
  const unit = `${name}.service`;
  const write = (message: string, priority: number) =>
    at === false ? writeLog(sd, unit, 'systemd', 1, message, priority) : sd.log.push({ time: at, boot: sd.boot, unit, ident: 'systemd', pid: 1, message, priority });
  write(`${unit}: Start request repeated too quickly.`, 4);
  write(`${unit}: Failed with result 'start-limit-hit'.`, 4);
  write(`Failed to start ${unit} - ${s.description}.`, 3);
  s.state = 'failed';
  s.result = 'start-limit-hit';
  s.since = at === false ? sd.clock : at;
}

/** Restart=always or on-failure: the next attempt, RestartSec= after the failure. */
export function scheduleRestart(sd: Systemd, name: string, failed: number, counter: number) {
  const s = sd.services[name];
  if (sd.shuttingDown || !['always', 'on-failure', 'on-abnormal'].includes(s.reboot ?? '')) return;
  (sd.pending ??= []).push({ unit: name, at: failed + (s.restartSec ?? 100), counter });
}

/** The service is running, and was ready at that moment. */
export const readyAt = (sd: Systemd, name: string, at: number) => sd.services[name]?.state === 'active' && sd.services[name].since <= at;

export function stop(game: Game, sd: Systemd, name: string) {
  const s = sd.services[name];
  const unit = `${name}.service`;
  writeLog(sd, unit, 'systemd', 1, `Stopping ${unit} - ${s.description}...`);
  writeLog(sd, unit, 'systemd', 1, `Stopped ${unit} - ${s.description}.`);
  s.state = 'inactive';
  s.since = sd.clock;
  processRetirer(game, s);
  s.stop?.(game);
}

/** Machine reboot: only the enabled services (enable) come back. */
export function restart(game: Game, sd: Systemd) {
  writeLog(sd, '', 'systemd-logind', 512, 'The system will reboot now!');
  sd.shuttingDown = true;
  for (const [name, s] of Object.entries(sd.services)) if (s.state === 'active') stop(game, sd, name);
  sd.shuttingDown = false;
  sd.pending = [];
  sd.clock += 90_000;
  sd.boot++;
  game.state.process = (game.state.process as Process[] | undefined)?.filter((p) => p.pid === 1) ?? [];
  // The installed kernel becomes the running one; /run (tmpfs) starts empty again, with reboot-required.
  const kernel = game.state.kernel as { active: string; installed: string } | undefined;
  if (kernel) kernel.active = kernel.installed;
  for (const f of ['/var/run/reboot-required', '/var/run/reboot-required.pkgs']) if (game.exists(f)) game.erase(f);
  // tmux sessions die with the machine; so do the firewall rules (nftables.service reloads them if it is enabled).
  if (game.state.tmux) game.state.tmux = {};
  if (game.state.nft) game.state.nft = { tables: [] };
  // So do WireGuard interfaces (wg-quick@wg0 brings them back up if it is enabled).
  if (game.state.wg) {
    for (const name of Object.keys(game.state.wg)) delete game.state.lan?.interfaces[name];
    game.state.wg = {};
  }
  writeLog(sd, '', 'kernel', 0, `Linux version ${kernel?.active ?? '6.12.0-quetes'} (${sd.host})`);
  // A machine that mounts its disks according to /etc/fstab (see fstab.ts): if that is
  // not possible, it stops in emergency mode, without starting its services.
  const mounts = game.state.startMounts as ((j: Game) => boolean) | undefined;
  if (mounts && !mounts(game)) {
    for (const s of Object.values(sd.services)) {
      s.state = 'inactive';
      s.since = sd.clock;
    }
    sd.checkedAfterBoot = false;
    sd.mainAStarted = false;
    return;
  }
  if (sd.ordered) bootUnits(game, sd);
  else
    for (const [name, s] of Object.entries(sd.services)) {
      s.state = 'inactive';
      s.since = sd.clock;
      if (s.active) start(game, sd, name, true);
    }
  sd.checkedAfterBoot = false;
  sd.mainAStarted = false;
}

// ——— Dates ———

const parts = (ms: number, language: string, options: Intl.DateTimeFormatOptions) =>
  Object.fromEntries(new Intl.DateTimeFormat(language, { timeZone: 'UTC', ...options }).formatToParts(new Date(ms)).map((p) => [p.type, p.value]));
const timeOfDay = (ms: number) => new Date(ms).toISOString().slice(11, 19);

/** "Oct 13 21:02:44", like journalctl (abbreviated month in the language). */
export function logDate(ms: number, language: string): string {
  const { month } = parts(ms, language, { month: 'short' });
  return `${month} ${new Date(ms).toISOString().slice(8, 10)} ${timeOfDay(ms)}`;
}

// The last Sunday of a month, at 1 a.m. UTC: daylight saving change in Europe.
const lastSunday = (year: number, month: number) => {
  const d = new Date(Date.UTC(year, month + 1, 0, 1));
  return d.getTime() - d.getUTCDay() * 86_400_000;
};

/** The machines' clock follows Paris time: true in summer time (CEST, UTC+2). */
export function summerTime(local: number): boolean {
  const year = new Date(local).getUTCFullYear();
  const utc = local - 3600_000;
  return utc >= lastSunday(year, 2) && utc < lastSunday(year, 9);
}

/** Machine local time → UTC time (milliseconds). */
export const toUtc = (local: number) => local - (summerTime(local) ? 2 : 1) * 3600_000;

/** "Tue 2026-10-13 20:00:01 CEST", like systemctl status. */
export function dateComplete(ms: number, language: string, sd?: Systemd): string {
  const zone = sd?.zone ?? (summerTime(ms) ? 'CEST' : 'CET');
  const shows = ms + (sd?.difference ?? 0);
  const { weekday } = parts(shows, language, { weekday: 'short' });
  return `${weekday} ${new Date(shows).toISOString().slice(0, 10)} ${timeOfDay(shows)} ${zone}`;
}

/** "1h 2min", "3min 12s", "5s", like systemd. */
export function duration(ms: number): string {
  let s = Math.max(0, Math.round(ms / 1000));
  const h = Math.floor(s / 3600);
  const min = Math.floor((s % 3600) / 60);
  s %= 60;
  if (h) return min ? `${h}h ${min}min` : `${h}h`;
  if (min) return s ? `${min}min ${s}s` : `${min}min`;
  return `${s}s`;
}

// On a terminal, journalctl highlights the message according to its priority:
// error and worse in bold red, warning in bold yellow, notice
// in bold (systemd's colours, see journalctl(1) and SYSTEMD_COLORS).
const PRIORITY_COLOUR = (p: number) => (p <= 3 ? '1;31' : p === 4 ? '1;33' : p === 5 ? '1' : '');

export const logLine = (e: Input, sd: Systemd, language: string, colour = false) =>
  `${logDate(e.time + (sd.difference ?? 0), language)} ${sd.host} ${e.ident}${e.pid ? `[${e.pid}]` : ''}: ${colour ? sgr(PRIORITY_COLOUR(e.priority), e.message) : e.message}`;

export type DefinitionService = Omit<Service, 'since' | 'state' | 'process'> & { state?: Service['state']; process?: Process[] };

/**
 * The systemd state of a machine booted at `started` (local time, read as
 * UTC): the active services started at that moment; `now` is the time at
 * the start of the chapter.
 */
export function newSystemd(host: string, started: number, now: number, definitions: Record<string, DefinitionService>): Systemd {
  const sd: Systemd = { host, services: {}, log: [], clock: started, boot: 1 };
  writeLog(sd, '', 'kernel', 0, `Linux version 6.12.0-quetes (${host})`);
  for (const [name, d] of Object.entries(definitions)) {
    const state = d.state ?? 'active';
    sd.services[name] = { ...d, state, process: d.process ?? [], since: sd.clock };
    if (state === 'active') {
      writeLog(sd, `${name}.service`, 'systemd', 1, `Starting ${name}.service - ${d.description}...`);
      writeLog(sd, `${name}.service`, 'systemd', 1, `Started ${name}.service - ${d.description}.`);
      sd.services[name].since = sd.clock;
    }
  }
  sd.clock = now;
  return sd;
}

/** systemctl reload: returns false if the configuration is rejected (the service keeps the old one). */
export function reload(game: Game, sd: Systemd, name: string): boolean {
  const s = sd.services[name];
  const unit = `${name}.service`;
  const pid = s.process[0]?.pid ?? 1;
  writeLog(sd, unit, 'systemd', 1, `Reloading ${unit} - ${s.description}...`);
  const errors = s.checkToReload ? s.check?.(game) : null;
  if (errors) {
    errors.forEach((e, i) => writeLog(sd, unit, s.executable, pid, e, 3, i === 0));
    writeLog(sd, unit, 'systemd', 1, `${unit}: Control process exited, code=exited, status=255/EXCEPTION`, 4, false);
    writeLog(sd, unit, 'systemd', 1, `Reload failed for ${unit} - ${s.description}.`, 3, false);
    return false;
  }
  s.load?.(game);
  writeLog(sd, unit, 'systemd', 1, `Reloaded ${unit} - ${s.description}.`);
  return true;
}
