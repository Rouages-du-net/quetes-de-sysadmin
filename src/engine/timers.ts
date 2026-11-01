// Hand-written units and systemd timers: a file
// /etc/systemd/system/NAME.service (Type=oneshot, ExecStart=, User=) and
// NAME.timer (OnCalendar=, OnBootSec=, OnUnitActiveSec=), loaded on
// demand or by daemon-reload. After systemd.timer(5), systemd.time(7)
// and systemd.service(5):
// https://www.freedesktop.org/software/systemd/man/latest/systemd.timer.html,
// https://www.freedesktop.org/software/systemd/man/latest/systemd.time.html
// Differences: OnCalendar= understands a day of the week, *-*-* and a time
// H:M[:S] (*, numbers, lists, start/step), plus minutely, hourly, daily,
// weekly; to the minute; no Persistent= nor RandomizedDelaySec=.

import type { Game, Shell } from './shell';
import { writeLog, systemd, type Systemd } from './systemd';
import { parse, aRunning } from './cron';
import { send } from './commands/monitoring';

export interface Timer {
  description: string;
  // The service it starts (Unit=, otherwise NAME.service).
  unit: string;
  calendar: string[];
  // OnBootSec=, OnActiveSec=, OnUnitActiveSec= (ms).
  afterBoot?: number;
  afterActivation?: number;
  afterLast?: number;
  active: boolean;
  state: 'active' | 'inactive';
  since: number;
  // Last trigger.
  last?: number;
  file: string;
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

interface Calendar {
  days: Set<number> | null;
  hours: Set<number>;
  minutes: Set<number>;
  // The normalised form, like systemd-analyze calendar.
  normal: string;
}

// A field: *, 5, 0/15 (from 0 in steps of 15), */10, 1,15,30, 8..18.
function field(text: string, max: number): { values: Set<number>; normal: string } | null {
  const values = new Set<number>();
  const normal: string[] = [];
  for (const chunk of text.split(',')) {
    const m = /^(\*|\d{1,2})(?:\.\.(\d{1,2}))?(?:\/(\d{1,2}))?$/.exec(chunk);
    if (!m) return null;
    const start = m[1] === '*' ? 0 : Number(m[1]);
    const end = m[2] !== undefined ? Number(m[2]) : m[3] !== undefined || m[1] === '*' ? max : start;
    const not = m[3] !== undefined ? Number(m[3]) : 1;
    if (start > max || end > max || not === 0) return null;
    for (let v = start; v <= end; v += not) values.add(v);
    const two = (n: number) => String(n).padStart(2, '0');
    normal.push(
      m[1] === '*' && !m[3] ? '*' : `${m[1] === '*' ? '00' : two(start)}${m[2] !== undefined ? `..${two(end)}` : ''}${m[3] ? `/${not}` : ''}`,
    );
  }
  return { values, normal: normal.join(',') };
}

const SHORTCUTS: Record<string, string> = {
  minutely: '*-*-* *:*:00',
  hourly: '*-*-* *:00:00',
  daily: '*-*-* 00:00:00',
  weekly: 'Mon *-*-* 00:00:00',
};

/** OnCalendar= → the minutes at which the timer triggers; null if systemd would refuse the expression. */
export function readCalendar(text: string): Calendar | null {
  let rest = (SHORTCUTS[text.trim()] ?? text).trim().split(/\s+/);
  let days: Set<number> | null = null;
  let prefix = '';
  if (/^[A-Z][a-z]{2}/.test(rest[0] ?? '')) {
    days = new Set();
    for (const p of rest[0].split(',')) {
      const [a, b] = p.split('..').map((x) => DAYS.indexOf(x));
      if (a < 0 || (b !== undefined && b < 0)) return null;
      for (let j = a; j !== (b ?? a) + 1; j = (j + 1) % 7) {
        days.add(j);
        if (b === undefined) break;
      }
    }
    prefix = `${rest[0]} `;
    rest = rest.slice(1);
  }
  if (rest.length === 2) {
    if (rest[0] !== '*-*-*') return null;
    rest = rest.slice(1);
  } else if (rest.length !== 1) return null;
  const time = rest[0].split(':');
  if (time.length < 2 || time.length > 3) return null;
  const hours = field(time[0], 23);
  const minutes = field(time[1], 59);
  const seconds = time[2] === undefined ? { values: new Set([0]), normal: '00' } : field(time[2], 59);
  if (!hours || !minutes || !seconds) return null;
  const sec = seconds.normal === '*' ? '*' : seconds.normal;
  return { days, hours: hours.values, minutes: minutes.values, normal: `${prefix}*-*-* ${hours.normal}:${minutes.normal}:${sec}` };
}

/** The next minute (after `after`, excluded) at which the expression triggers (local time read as UTC). */
export function nextCalendar(c: Calendar, after: number): number | null {
  let t = Math.floor(after / 60_000) * 60_000 + 60_000;
  for (let i = 0; i < 60 * 24 * 8; i++, t += 60_000) {
    const d = new Date(t);
    if (c.minutes.has(d.getUTCMinutes()) && c.hours.has(d.getUTCHours()) && (!c.days || c.days.has(d.getUTCDay()))) return t;
  }
  return null;
}

/** "5min", "1h", "30s", "300" (seconds), "1h 30min" → ms; null if unreadable. */
export function readDuration(text: string): number | null {
  const units: Record<string, number> = { '': 1000, s: 1000, sec: 1000, m: 60_000, min: 60_000, h: 3_600_000, hr: 3_600_000, d: 86_400_000 };
  let total = 0;
  const chunks = text.trim().split(/\s+/);
  for (const m of chunks) {
    const p = /^(\d+)([a-z]*)$/.exec(m);
    if (!p || units[p[2]] === undefined) return null;
    total += Number(p[1]) * units[p[2]];
  }
  return chunks.length ? total : null;
}

/** The machine's boot (the first message of this boot). */
const machineBoot = (sd: Systemd) => sd.log.find((e) => e.boot === sd.boot)?.time ?? sd.clock;

/** A timer's next trigger after `after`; null if it has none left (e.g. OnUnitActiveSec= alone, service never started). */
export function nextTrigger(sd: Systemd, m: Timer, after: number): number | null {
  if (m.state !== 'active') return null;
  const candidates: number[] = [];
  for (const text of m.calendar) {
    const c = readCalendar(text);
    const t = c && nextCalendar(c, after);
    if (t) candidates.push(t);
  }
  const moreLate = (t: number) => (t > after ? t : null);
  if (m.afterBoot !== undefined && !m.last) {
    const t = moreLate(machineBoot(sd) + m.afterBoot);
    if (t) candidates.push(t);
  }
  if (m.afterActivation !== undefined && !m.last) {
    const t = moreLate(m.since + m.afterActivation);
    if (t) candidates.push(t);
  }
  // OnUnitActiveSec=: counted from the service's last start (nothing as long as it has never run).
  if (m.afterLast !== undefined && m.last !== undefined)
    candidates.push(Math.max(m.last + m.afterLast, Math.floor(after / 60_000) * 60_000 + 60_000));
  return candidates.length ? Math.min(...candidates) : null;
}

// ——— Unit files ———

function sections(text: string): Record<string, Record<string, string[]>> {
  const r: Record<string, Record<string, string[]>> = {};
  let section = '';
  for (const line of text.split('\n')) {
    const l = line.trim();
    if (!l || l.startsWith('#') || l.startsWith(';')) continue;
    const s = /^\[(.+)\]$/.exec(l);
    if (s) {
      section = s[1];
      r[section] ??= {};
      continue;
    }
    const m = /^([A-Za-z]+)\s*=\s*(.*)$/.exec(l);
    if (m && section) (r[section][m[1]] ??= []).push(m[2]);
  }
  return r;
}

/** Reads the units of /etc/systemd/system (hand-written services and timers). */
export function loadUnits(game: Shell, sd: Systemd): void {
  const place = game.find('/etc/systemd/system');
  if (place?.type !== 'directory') return;
  for (const [fileName, n] of Object.entries(place.children)) {
    if (n.type !== 'file') continue;
    const path = `/etc/systemd/system/${fileName}`;
    const text = game.read(path) ?? '';
    const u = sections(text);
    const description = u.Unit?.Description?.at(-1) ?? fileName;
    if (fileName.endsWith('.service')) {
      const name = fileName.slice(0, -8);
      const old = sd.services[name];
      if (old && !old.file) continue;
      const exec = u.Service?.ExecStart?.at(-1) ?? '';
      const account = u.Service?.User?.at(-1) ?? 'root';
      sd.services[name] = {
        description,
        state: old?.state ?? 'inactive',
        active: old?.active ?? false,
        process: [],
        executable: exec.split(/\s+/)[0].split('/').at(-1) ?? name,
        since: old?.since ?? sd.clock,
        oneshot: (u.Service?.Type?.at(-1) ?? 'simple') === 'oneshot',
        file: path,
        execute: (j) => execute(j as Shell, sd, name, exec, account),
      };
    } else if (fileName.endsWith('.timer')) {
      const name = fileName.slice(0, -6);
      const t = u.Timer ?? {};
      const calendar = (t.OnCalendar ?? []).filter((c) => {
        if (readCalendar(c)) return true;
        writeLog(
          sd,
          '',
          'systemd',
          1,
          `${path}:${text.split('\n').findIndex((l) => l.includes(c)) + 1}: Failed to parse calendar specification, ignoring: ${c}`,
          4,
          false,
        );
        return false;
      });
      const duration = (key: string) => {
        const v = t[key]?.at(-1);
        return v === undefined ? undefined : (readDuration(v) ?? undefined);
      };
      const old = sd.timers?.[name];
      (sd.timers ??= {})[name] = {
        description,
        unit: (t.Unit?.at(-1) ?? `${name}.service`).replace(/\.service$/, ''),
        calendar,
        afterBoot: duration('OnBootSec'),
        afterActivation: duration('OnActiveSec'),
        afterLast: duration('OnUnitActiveSec'),
        active: old?.active ?? false,
        state: old?.state ?? 'inactive',
        since: old?.since ?? sd.clock,
        last: old?.last,
        file: path,
      };
    }
  }
}

/** ExecStart=: the command runs under its account (User=), its output goes to the journal. */
function execute(game: Shell, sd: Systemd, name: string, command: string, account: string): number {
  if (!command) {
    writeLog(sd, `${name}.service`, 'systemd', 1, `${name}.service: Service has no ExecStart=, ExecStop=, or SuccessAction=. Refusing.`, 3);
    return 1;
  }
  const before = game.who;
  game.who = account;
  try {
    const r = game.underCommand(command, '/');
    const pid = 4000 + (game.state.nextUnitPid = ((game.state.nextUnitPid as number | undefined) ?? 0) + 1);
    for (const line of r.output.split('\n').filter(Boolean))
      writeLog(sd, `${name}.service`, command.split(/\s+/)[0].split('/').at(-1)!, pid, line, 6, false);
    return r.code;
  } finally {
    game.who = before;
  }
}

/** The timer that starts this service (for "TriggeredBy:"). */
export const timerFor = (sd: Systemd, service: string) => Object.entries(sd.timers ?? {}).find(([, m]) => m.unit === service)?.[0];

/**
 * Make time pass minute by minute (from `start` to `end`): at each
 * minute, `eachMinute` (what happens in the story), then the timers
 * and cron jobs that fall on that minute. Returns how many hand-written
 * jobs (timers in /etc, crontabs) ran.
 */
export function passTime(game: Shell, start: number, end: number, eachMinute?: (t: number) => void): number {
  const sd = systemd(game)!;
  let launches = 0;
  // Minute by minute, on the round minute (like cron and timers).
  for (let t = Math.ceil(start / 60_000) * 60_000; t < end; t += 60_000) {
    sd.clock = t;
    eachMinute?.(t);
    for (const m of Object.values(sd.timers ?? {})) {
      if (nextTrigger(sd, m, t - 60_000) !== t) continue;
      const s = sd.services[m.unit];
      if (!s) continue;
      m.last = t;
      sd.clock = t;
      // Count the hand-written timers (not those shipped with the system).
      if (m.file.startsWith('/etc/')) launches++;
      writeLog(sd, `${m.unit}.service`, 'systemd', 1, `Starting ${m.unit}.service - ${s.description}...`, 6, false);
      launchOneshot(game, sd, m.unit);
    }
    for (const [account, text] of Object.entries((game.state.crontabs ?? {}) as Record<string, string>))
      for (const task of parse(text, '').tasks)
        if (aRunning(task, t)) {
          const before = game.who;
          game.who = account;
          launches++;
          try {
            // Like cron: what a job writes is mailed to its account.
            const output = game.runTask(task.command);
            if (output.trim()) send(game, [account], `Cron <${account}@${sd.host}> ${task.command}`, output);
          } finally {
            game.who = before;
          }
        }
  }
  sd.clock = end;
  return launches;
}

// A oneshot service started by its timer (without "Started", already written).
function launchOneshot(game: Shell, sd: Systemd, name: string) {
  const s = sd.services[name];
  const code = s.execute?.(game) ?? 0;
  const unit = `${name}.service`;
  if (code !== 0) {
    writeLog(sd, unit, 'systemd', 1, `${unit}: Main process exited, code=exited, status=${code}/FAILURE`, 4, false);
    writeLog(sd, unit, 'systemd', 1, `${unit}: Failed with result 'exit-code'.`, 4, false);
    s.state = 'failed';
    s.result = 'exit-code';
  } else {
    writeLog(sd, unit, 'systemd', 1, `${unit}: Deactivated successfully.`, 6, false);
    writeLog(sd, unit, 'systemd', 1, `Finished ${unit} - ${s.description}.`, 6, false);
    s.state = 'inactive';
  }
  s.since = sd.clock;
}
