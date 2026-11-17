// Story "The Music School" — chapter "The Silent Backup": Beatriz deleted
// a bank statement by mistake and asks for it from the backup. The
// "Nightly Backup" task shows Ready, but nothing new has reached D:\Backup
// for weeks, and two failures hide one behind the other:
//   (a) svc_backup's password expired on 20 December ("Password never
//       expires" was off, though the password manager's entry says a
//       service account's password doesn't expire, by the school's
//       policy): every night the logon fails, LastTaskResult 2147943730
//       (0x80070532), 4625 in the Security log, 101/104 in the Task
//       Scheduler's history once it is enabled (wevtutil sl … /e:true);
//   (b) once it runs again, the script returns 0 though Copy-Item failed:
//       Beatriz's Office\Bank folder (since 12 December) doesn't let
//       svc_backup read it, and a non-terminating error doesn't change
//       powershell.exe -File's exit code. Bank was never backed up.
// The fixes: Set-LocalUser svc_backup -PasswordNeverExpires $true (and,
// if its password is changed, Set-ScheduledTask -User -Password or
// schtasks /change /rp); the script made to fail visibly
// ($ErrorActionPreference = 'Stop', -ErrorAction Stop, try/catch and
// exit 1, -ErrorVariable or $?); svc_backup given read on Bank (icacls
// /grant "svc_backup:(OI)(CI)(RX)"); then Start-ScheduledTask.
// Objective checked on the state: the task is Ready with its daily
// trigger, runs as svc_backup (not SYSTEM, not an administrator) whose
// logon works and whose password doesn't expire; its last run returned 0
// and copied Bank and the newest files; the script reports failures (a
// run of the task that met an error ended non-zero, or the script turns
// errors into a non-zero exit); Bank stays closed to the teachers.
// False leads: "it says Ready", running the task as SYSTEM or as an
// administrator, svc_backup in Administrators, disabling the task, net
// user /expires:never (the account's expiry, not the password's), a new
// password on the account only (0x8007052E), running the script by hand.
// Sources: https://learn.microsoft.com/powershell/module/scheduledtasks/get-scheduledtaskinfo,
// https://learn.microsoft.com/windows/win32/taskschd/task-scheduler-error-and-success-constants,
// https://learn.microsoft.com/powershell/module/microsoft.powershell.core/about/about_try_catch_finally?view=powershell-5.1,
// https://learn.microsoft.com/powershell/module/microsoft.powershell.core/about/about_preference_variables?view=powershell-5.1,
// https://learn.microsoft.com/powershell/module/microsoft.powershell.localaccounts/set-localuser?view=powershell-5.1,
// https://learn.microsoft.com/windows-server/administration/windows-commands/wevtutil

import type { Chapter, Directory, File } from '../world';
import type { Game } from '../shell';
import { windows } from '../windows';
import { findUser, logonError, passwordExpires } from '../windows-accounts';
import { effectiveRights, FULL, MODIFY, R, token } from '../windows-acl';
import { advanceWindows, findTask, nextRun, type WinTask } from '../windows-tasks';
import type { ScriptRun } from '../commands/powershell';
import { BACKUP_PASSWORD, HOME, TEACHERS, computer, ran, said, server, stave } from './music-school';

// Monday 14 January 2030, 9:10.
export const NOW = Date.UTC(2030, 0, 14, 9, 10, 0);
const DAY = 86_400_000;
const KIB = 1024;
// svc_backup's password was set on 8 November at 15:00: with 42 days, it expired on 20 December.
const SET = Date.UTC(2029, 10, 8, 15, 0, 0);
// Beatriz created Office\Bank on 12 December; the nights are replayed from then.
const BANK_CREATED = Date.UTC(2029, 11, 12, 10, 20, 0);
const BANK = '/D/Shares/Office/Bank';
const BACKUP_BANK = '/D/Backup/Shares/Office/Bank';
const NEW_SCORE = 'spring-concert-parts.zip';
const SCRIPT = '/C/Scripts/backup.ps1';

const bin = (size: number, mtime: number): File => ({ type: 'file', content: '(binary)', size, mtime });

const machine = stave({
  clock: NOW,
  teachersShare: 'fixed',
  backupPasswordAge: (NOW - SET) / DAY,
  backupNeverExpires: false,
  backupLogUntil: BANK_CREATED,
  home: (t) => ({
    'email_mariam.txt': { type: 'file', content: t('silent-backup-email-mariam').replace(/\n/g, '\r\n'), lines: true, mtime: NOW - 20 * 60_000 },
    Documents: {
      type: 'directory',
      children: { 'vault-svc_backup.txt': { type: 'file', content: t('silent-backup-vault', { password: BACKUP_PASSWORD }).replace(/\n/g, '\r\n'), lines: true, mtime: NOW - 18 * 60_000 } },
    },
  }),
});

/** Beatriz's folder, as she made it on 12 December: inheritance off, the office and the administrators only (not svc_backup). */
function bankFolder(game: Game): Directory {
  const C = computer(game.t);
  const ace = (id: string, mask: number) => ({ id, mask, oi: true, ci: true });
  return {
    type: 'directory',
    children: { 'statements-2029-10.pdf': bin(176 * KIB, BANK_CREATED), 'statements-2029-11.pdf': bin(188 * KIB, BANK_CREATED + 60_000) },
    acl: { owner: 'BUILTIN\\Administrators', protected: true, aces: [ace('NT AUTHORITY\\SYSTEM', FULL), ace('BUILTIN\\Administrators', FULL), ace(`${C}\\Office`, MODIFY)] },
  } as Directory;
}

const task = (j: Game): WinTask | undefined => findTask(server(j), 'Nightly Backup');
const backupUser = (j: Game) => findUser(j, 'svc_backup');
const runsAsBackup = (j: Game) => {
  const t = task(j);
  return !!t && /\\svc_backup$/i.test(t.user) && t.logon === 'Password';
};
const logonWorks = (j: Game) => runsAsBackup(j) && logonError(j, 'svc_backup', task(j)!.password ?? '') === null;
const neverExpires = (j: Game) => {
  const u = backupUser(j);
  return !!u && passwordExpires(j, u) === null;
};
const isAdmin = (j: Game, user: string) => token(j, user).has('BUILTIN\\Administrators');
const readable = (j: Game, user: string, path: string) => !!(effectiveRights(server(j), path, token(j, user)) & R.ReadData);
const bankReadable = (j: Game) => !!j.find(BANK) && readable(j, 'svc_backup', BANK) && readable(j, 'svc_backup', `${BANK}/statements-2029-10.pdf`);
const bankTooOpen = (j: Game) => TEACHERS.some((u) => readable(j, u, BANK) || readable(j, u, `${BANK}/statements-2029-10.pdf`));
const scriptRuns = (j: Game): ScriptRun[] => (j.state.psScriptRuns ?? []) as ScriptRun[];
/** The task's runs since the chapter started (as svc_backup). */
const taskRuns = (j: Game) => scriptRuns(j).filter((r) => r.who.toLowerCase() === 'svc_backup' && r.file.toLowerCase() === 'c:\\scripts\\backup.ps1');
/** A run of the script that met an error and said so in its exit code. */
const loudRun = (j: Game) => taskRuns(j).some((r) => r.failures > 0 && r.code !== 0);

/** The script, read: does it turn an error into a non-zero exit code? */
export function strictScript(text: string): boolean {
  const s = text.replace(/#.*$/gm, '');
  const stop = /\$ErrorActionPreference\s*=\s*['"]?stop\b/i.test(s) || /-(ErrorAction|ea)\s*:?\s*['"]?stop\b/i.test(s);
  const exits = /\bexit\s+(\(?\s*)?([1-9]|\$)/i.test(s) || /\bthrow\b/i.test(s);
  // Stop alone ends the script with code 1; with a catch, the catch must exit or throw.
  if (stop) return /\bcatch\b/i.test(s) ? exits : true;
  const checks = /-(ErrorVariable|ev)\b/i.test(s) || /\$\?/.test(s) || /\$Error\b/i.test(s);
  return checks && exits;
}
const reports = (j: Game) => loudRun(j) || strictScript(j.read(SCRIPT) ?? '');
/** The last run of the task copied Bank and the newest score. */
const freshBackup = (j: Game) => {
  const t = task(j);
  return !!t && t.lastResult === 0 && (t.lastRun ?? 0) >= NOW && !!j.find(`${BACKUP_BANK}/statements-2029-10.pdf`) && !!j.find(`/D/Backup/Shares/Teachers/Scores/${NEW_SCORE}`);
};

export const COMMANDS_SILENT_BACKUP = [
  'Get-ScheduledTask', 'Get-ScheduledTaskInfo', 'Start-ScheduledTask', 'Set-ScheduledTask', 'schtasks', 'Get-WinEvent', 'wevtutil', 'Get-LocalUser', 'Set-LocalUser', 'net',
  'Get-Content', 'Set-Content', 'Test-Path', 'Get-ChildItem', 'icacls', 'Get-Acl', 'Get-Help',
];

export const silentBackup: Chapter = {
  id: 'silent-backup',
  number: 4,
  commands: COMMANDS_SILENT_BACKUP,
  home: HOME,
  welcome: 'email_mariam.txt',
  names: true,
  final: 'end',
  steps: ['ready', 'result', 'expired', 'logon-fixed', 'missing', 'loud', 'readable', 'end'],
  accounts: machine.accounts,
  state: machine.state,
  createWorld: machine.createWorld,
  initialise: (j) => {
    // Bank appears on 12 December; then the nights run, as they did: eight silent "successes"
    // that skip Bank, then the expired password from the 21st on.
    const w = windows(j);
    const office = j.find('/D/Shares/Office') as Directory;
    office.children.Bank = bankFolder(j);
    w.clock = BANK_CREATED;
    advanceWindows(server(j), NOW);
    // The files saved since the last backup that ran.
    const scores = j.find('/D/Shares/Teachers/Scores') as Directory;
    scores.children[NEW_SCORE] = bin(22 * 1024 * KIB, NOW - 5 * DAY);
    const bank = j.find(BANK) as Directory;
    bank.children['standing-orders.xlsx'] = bin(43 * KIB, NOW - 5 * DAY + 3_600_000);
    // Friday: Beatriz deleted the November statement by mistake.
    delete bank.children['statements-2029-11.pdf'];
    j.state.psScriptRuns = [];
  },
  events: [
    { id: 'ready', condition: (j) => ran(j, 'Get-ScheduledTask', 'schtasks') && said(j, /Nightly Backup +.*Ready/), message: (j) => j.t('silent-backup-event-ready') },
    {
      id: 'result',
      condition: (j) => ran(j, 'Get-ScheduledTaskInfo', 'schtasks', 'Get-ScheduledTask') && (said(j, /LastTaskResult +: 2147943730/) || said(j, /Last Result: +-2147023566/) || said(j, '80070532')),
      message: (j) => j.t('silent-backup-event-result'),
    },
    { id: 'own-log', condition: (j) => ran(j, 'Get-Content', 'type', 'cat') && said(j, '2029-12-20 copy done'), message: (j) => j.t('silent-backup-event-own-log') },
    { id: 'history-off', condition: (j) => ran(j, 'Get-WinEvent', 'wevtutil') && (said(j, /TaskScheduler\/Operational/) || /taskscheduler/i.test(j.last.line)) && !windows(j).logs?.['Microsoft-Windows-TaskScheduler/Operational']?.enabled, message: (j) => j.t('silent-backup-event-history-off') },
    { id: 'history-on', condition: (j) => !!windows(j).logs?.['Microsoft-Windows-TaskScheduler/Operational']?.enabled, message: (j) => j.t('silent-backup-event-history-on') },
    { id: 'events', condition: (j) => said(j, 'failed to log on') || said(j, "The specified account's password has expired."), message: (j) => j.t('silent-backup-event-events') },
    {
      id: 'expired',
      condition: (j) => ran(j, 'Get-LocalUser', 'net') && /svc_backup/i.test(j.last.line) && said(j, /PasswordExpires|Password expires/) && said(j, '12/20/2029'),
      message: (j) => j.t('silent-backup-event-expired'),
    },
    { id: 'account-expires', condition: (j) => ran(j, 'net') && /\/expires:/i.test(j.last.line) && said(j, 'The command completed successfully'), message: (j) => j.t('silent-backup-event-account-expires') },
    {
      id: 'task-password',
      condition: (j) => runsAsBackup(j) && logonError(j, 'svc_backup', task(j)!.password ?? '') === 1326,
      message: (j) => j.t('silent-backup-event-task-password'),
    },
    { id: 'logon-fixed', condition: (j) => logonWorks(j) && neverExpires(j), message: (j) => j.t('silent-backup-event-logon-fixed') },
    { id: 'will-expire', condition: (j) => logonWorks(j) && !neverExpires(j), message: (j) => j.t('silent-backup-event-will-expire') },
    { id: 'system', condition: (j) => !!task(j) && /^system$/i.test(task(j)!.user), message: (j) => j.t('silent-backup-event-system') },
    { id: 'admin-task', condition: (j) => !!task(j) && !/^system$/i.test(task(j)!.user) && isAdmin(j, task(j)!.user.replace(/^.*\\/, '')), message: (j) => j.t('silent-backup-event-admin-task') },
    { id: 'admin', condition: (j) => isAdmin(j, 'svc_backup'), message: (j) => j.t('silent-backup-event-admin') },
    { id: 'disabled', condition: (j) => !task(j) || task(j)!.state === 'Disabled' || nextRun(server(j), task(j)!) === null, message: (j) => j.t('silent-backup-event-disabled') },
    { id: 'ran', condition: (j) => taskRuns(j).some((r) => r.code === 0) && !j.find(BACKUP_BANK), message: (j) => j.t('silent-backup-event-ran') },
    {
      id: 'missing',
      condition: (j) =>
        !j.find(BACKUP_BANK) &&
        ((ran(j, 'Test-Path') && /backup/i.test(j.last.line) && /bank/i.test(j.last.line) && said(j, /^False$/m)) ||
          (ran(j, 'Get-ChildItem', 'dir', 'ls') && /backup/i.test(j.last.line) && /office/i.test(j.last.line) && said(j, 'fees-autumn.xlsx'))),
      message: (j) => j.t('silent-backup-event-missing'),
    },
    {
      id: 'by-hand',
      condition: (j) => scriptRuns(j).some((r) => r.who.toLowerCase() !== 'svc_backup') || (ran(j, 'powershell', 'powershell.exe') && /backup\.ps1/i.test(j.last.line)) || /^\s*(&\s*)?['"]?(\.\\|c:\\scripts\\)backup\.ps1/i.test(j.last.line),
      message: (j) => j.t('silent-backup-event-by-hand'),
    },
    { id: 'loud', condition: loudRun, message: (j) => j.t('silent-backup-event-loud') },
    {
      id: 'bank-acl',
      condition: (j) => ran(j, 'icacls', 'Get-Acl') && /bank/i.test(j.last.line) && said(j, /\\Office/) && !said(j, 'svc_backup'),
      message: (j) => j.t('silent-backup-event-bank-acl'),
    },
    { id: 'readable', condition: bankReadable, message: (j) => j.t('silent-backup-event-readable') },
    { id: 'too-open', condition: bankTooOpen, message: (j) => j.t('silent-backup-event-too-open') },
    { id: 'quiet-script', condition: (j) => freshBackup(j) && !reports(j), message: (j) => j.t('silent-backup-event-quiet-script') },
    {
      id: 'end',
      condition: (j) =>
        !!task(j) &&
        task(j)!.state === 'Ready' &&
        nextRun(server(j), task(j)!) !== null &&
        logonWorks(j) &&
        neverExpires(j) &&
        !isAdmin(j, 'svc_backup') &&
        freshBackup(j) &&
        reports(j) &&
        !bankTooOpen(j),
      message: (j) => j.t('silent-backup-event-end'),
    },
  ],
};
