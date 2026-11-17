// Scheduled tasks of a Windows machine (the Task Scheduler): a task has a
// principal (SYSTEM, or a local user whose password the Task Scheduler
// stored when the task was registered: "Run whether user is logged on or
// not"), actions (a program and its arguments), triggers (daily, weekly,
// once), a state (Ready, Disabled, Running) and the result of its last run
// (LastTaskResult: 0, 267011 = 0x41303 "has not yet run", 2147943726 =
// 0x8007052E "The user name or password is incorrect", 2147942402 =
// 0x80070002 "file not found"…). When it runs: the logon first (a password
// changed since, a disabled or expired account: the task doesn't start,
// events 104 and 101), then the action: powershell.exe -File runs the
// script through the game's PowerShell as that account (non-terminating
// errors don't change the exit code, as with the real -File: the classic
// "silent" failure), another program is found or not (203, 103).
// The history goes to Microsoft-Windows-TaskScheduler/Operational, which
// Windows Server keeps disabled until "Enable All Tasks History" (the log's
// enabled flag). Time passes minute by minute (advanceWindows), like
// timers.ts's passTime for systemd, so a nightly task can be rehearsed.
// Sources (Microsoft Learn): ScheduledTasks module
// (https://learn.microsoft.com/powershell/module/scheduledtasks/?view=windowsserver2022-ps),
// "Task Scheduler Error and Success Constants"
// (https://learn.microsoft.com/windows/win32/taskschd/task-scheduler-error-and-success-constants),
// schtasks (https://learn.microsoft.com/windows-server/administration/windows-commands/schtasks),
// about_PowerShell_exe (-File: exit code)
// (https://learn.microsoft.com/powershell/module/microsoft.powershell.core/about/about_powershell_exe?view=powershell-5.1).
// Simplifications: one action runs (the first), no conditions (idle, AC
// power), no "run task as soon as possible after a scheduled start is
// missed", no repetition within a day.

import type { Shell } from './shell';
import { guid, logEvent, resolveWindows, TASK_LOG, windows } from './windows';
import { findUser, logonError } from './windows-accounts';

export interface TaskTrigger {
  kind: 'Daily' | 'Weekly' | 'Once' | 'AtStartup' | 'AtLogOn';
  // StartBoundary (local time, read as UTC).
  start: number;
  // Weekly: the days (0 Sunday … 6 Saturday).
  days?: number[];
  // Daily: every N days.
  every?: number;
  enabled?: boolean;
}
export interface TaskAction {
  execute: string;
  arguments?: string;
  workingDirectory?: string;
}
export interface WinTask {
  path: string;
  name: string;
  state: 'Ready' | 'Disabled' | 'Running';
  author?: string;
  description?: string;
  // The account (SYSTEM, CABINET\svc_backup) and how it logs on.
  user: string;
  logon: 'Password' | 'ServiceAccount' | 'InteractiveToken' | 'S4U';
  // The password stored for a Password logon.
  password?: string;
  runLevel?: 'Limited' | 'Highest';
  actions: TaskAction[];
  triggers: TaskTrigger[];
  lastRun?: number;
  lastResult: number;
  // A story's own action: what the program does (its exit code).
  run?: (game: Shell) => number;
}

export const NEVER_RUN = 267011;
export const RUNNING = 267009;
export const LOGON_FAILURE = 2147943726;
export const ACCOUNT_DISABLED = 2147943731;
export const PASSWORD_EXPIRED = 2147943730;
export const FILE_NOT_FOUND = 2147942402;
const DAY = 86_400_000;

/** The machine's tasks. */
export const tasks = (game: Shell): WinTask[] => (windows(game).tasks ??= []) as WinTask[];

/** A task by name (and path), without case. */
export function findTask(game: Shell, name: string, path?: string): WinTask | undefined {
  const full = name.includes('\\') ? name : null;
  return tasks(game).find((t) => (full ? `${t.path}${t.name}`.toLowerCase() === (full.startsWith('\\') ? full : `\\${full}`).toLowerCase() : t.name.toLowerCase() === name.toLowerCase() && (!path || t.path.toLowerCase() === path.toLowerCase())));
}

/** The principal as the Task Scheduler names it (CABINET\svc_backup, SYSTEM). */
export function taskUser(game: Shell, t: WinTask): string {
  if (/^(nt authority\\)?system$/i.test(t.user)) return 'SYSTEM';
  const u = findUser(game, t.user);
  return u ? `${windows(game).computer}\\${u.name}` : t.user;
}

/** The next time a trigger fires after `after` (null: never). */
export function nextTrigger(tr: TaskTrigger, after: number): number | null {
  if (tr.enabled === false) return null;
  if (tr.kind === 'Once') return tr.start > after ? tr.start : null;
  if (tr.kind === 'Daily') {
    const every = (tr.every ?? 1) * DAY;
    if (tr.start > after) return tr.start;
    return tr.start + (Math.floor((after - tr.start) / every) + 1) * every;
  }
  if (tr.kind === 'Weekly') {
    const days = tr.days ?? [new Date(tr.start).getUTCDay()];
    const timeOfDay = tr.start % DAY;
    let day = Math.max(Math.floor(after / DAY) * DAY, Math.floor(tr.start / DAY) * DAY);
    for (let i = 0; i < 8; i++, day += DAY) {
      const at = day + timeOfDay;
      if (at > after && at >= tr.start && days.includes(new Date(at).getUTCDay())) return at;
    }
  }
  return null;
}

/** The task's next run (NextRunTime). */
export function nextRun(game: Shell, t: WinTask): number | null {
  if (t.state === 'Disabled') return null;
  const all = t.triggers.map((tr) => nextTrigger(tr, windows(game).clock)).filter((x): x is number => x !== null);
  return all.length ? Math.min(...all) : null;
}

/** Runs PowerShell scripts for tasks (set by commands/powershell.ts, which holds the interpreter). */
export const scripting: { run: ((game: Shell, text: string, file: string) => number) | null } = { run: null };

const task = (game: Shell, id: number, level: 'Information' | 'Error' | 'Warning', message: string, user?: string) =>
  logEvent(game, TASK_LOG, { id, level, provider: 'Microsoft-Windows-TaskScheduler', message, user });

/** What the action does: its exit code, or an HRESULT when it can't be launched. */
function launch(game: Shell, t: WinTask, a: TaskAction): number {
  if (t.run) return t.run(game);
  const exe = a.execute.replace(/^"|"$/g, '').trim();
  const bare = exe.split('\\').at(-1)!.toLowerCase();
  if (bare === 'powershell.exe' || bare === 'powershell') {
    const m = /-file\s+(?:"([^"]+)"|(\S+))/i.exec(a.arguments ?? '');
    if (!m) return 0;
    const file = resolveWindows(game, m[1] ?? m[2]);
    const node = file.exists ? game.find(file.path) : null;
    // powershell.exe -File with a missing script: it says so and exits with -196608.
    if (!node || node.type !== 'file') return 4294770688;
    return scripting.run ? scripting.run(game, game.read(file.path) ?? '', file.path) : 0;
  }
  if (bare === 'cmd.exe' || bare === 'cmd') return 0;
  const where = exe.includes('\\') ? resolveWindows(game, exe) : resolveWindows(game, `C:\\Windows\\System32\\${exe}`);
  return where.exists ? 0 : FILE_NOT_FOUND;
}

/**
 * Runs a task now (Start-ScheduledTask, schtasks /run, or its trigger):
 * the logon, the action as its account, the result and the history.
 */
export function runTask(game: Shell, t: WinTask, cause: 'user' | 'time'): number {
  const w = windows(game);
  const id = guid(game);
  const who = taskUser(game, t);
  const name = `${t.path}${t.name}`;
  t.lastRun = w.clock;
  if (cause === 'user') task(game, 110, 'Information', `Task Scheduler launched "${id}"  instance of task "${name}" for user "${game.who}" .`);
  else task(game, 107, 'Information', `Task Scheduler launched "${id}"  instance of task "${name}" due to a time trigger condition.`);
  // The logon (a stored password, or the account's state).
  if (who !== 'SYSTEM') {
    const u = findUser(game, t.user);
    const error = !u ? 1326 : logonError(game, u.name, t.logon === 'Password' ? (t.password ?? '') : undefined);
    if (error) {
      const code = error === 1331 ? ACCOUNT_DISABLED : error === 1330 ? PASSWORD_EXPIRED : LOGON_FAILURE;
      t.lastResult = code;
      task(game, 104, 'Error', `Task Scheduler failed to log on "${who}" .  Failure occurred in "LogonUserCall" .  User Action: Ensure the credentials for the task are correctly specified. Additional Data: Error Value: ${code}.`);
      task(game, 101, 'Error', `Task Scheduler failed to start "${name}" task for user "${who}". Additional Data: Error Value: ${code}.`);
      logEvent(game, 'Security', {
        id: 4625,
        level: 'Information',
        provider: 'Microsoft-Windows-Security-Auditing',
        keywords: 'Audit Failure',
        message: `An account failed to log on.\n\nLogon Type:\t\t\t4\n\nAccount For Which Logon Failed:\n\tAccount Name:\t\t${u?.name ?? t.user}\n\tAccount Domain:\t\t${w.computer}\n\nFailure Information:\n\tFailure Reason:\t\t${error === 1331 ? 'Account currently disabled.' : error === 1330 ? "The specified account's password has expired." : 'Unknown user name or bad password.'}`,
      });
      return code;
    }
  }
  task(game, 100, 'Information', `Task Scheduler started "${id}" instance of the "${name}" task for user "${who}".`);
  const action = t.actions[0];
  if (!action) {
    t.lastResult = 0;
    return 0;
  }
  const before = game.who;
  const cwd = game.cwd;
  game.who = who === 'SYSTEM' ? 'SYSTEM' : who.replace(/^.*\\/, '');
  let code: number;
  try {
    if (action.workingDirectory) {
      const wd = resolveWindows(game, action.workingDirectory);
      if (wd.exists) game.cwd = wd.path;
    }
    code = launch(game, t, action);
  } finally {
    game.who = before;
    game.cwd = cwd;
  }
  if (code === FILE_NOT_FOUND) {
    t.lastResult = code;
    task(game, 203, 'Error', `Task Scheduler failed to launch action "${action.execute}" in instance "${id}" of task "${name}". Additional Data: Error Value: ${code}.`);
    task(game, 103, 'Error', `Task Scheduler failed to start instance "${id}" of "${name}"  task for user "${who}" . Additional Data: Error Value: ${code}.`);
    return code;
  }
  task(game, 200, 'Information', `Task Scheduler launched action "${action.execute}" in instance "${id}" of task "${name}".`);
  task(game, 201, 'Information', `Task Scheduler successfully completed task "${name}" , instance "${id}" , action "${action.execute}" with return code ${code}.`);
  task(game, 102, 'Information', `Task Scheduler successfully finished "${id}" instance of the "${name}" task for user "${who}".`);
  t.lastResult = code;
  return code;
}

/**
 * Lets time pass on the machine until `end`, minute by minute: each Ready
 * task whose trigger falls in that minute runs. Returns how many ran.
 */
export function advanceWindows(game: Shell, end: number): number {
  const w = windows(game);
  let runs = 0;
  for (let t = Math.ceil((w.clock + 1) / 60_000) * 60_000; t <= end; t += 60_000) {
    for (const k of tasks(game)) {
      if (k.state !== 'Ready') continue;
      if (!k.triggers.some((tr) => nextTrigger(tr, t - 60_000) === t)) continue;
      w.clock = t;
      runTask(game, k, 'time');
      runs++;
    }
  }
  w.clock = Math.max(w.clock, end);
  return runs;
}

/** Hex form of a result (0x8007052E), as schtasks and the event text show it. */
export const hexResult = (n: number) => `0x${(n >>> 0).toString(16).toUpperCase()}`;
