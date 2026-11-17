// Story "The Music School" — chapter "The Log Flood": D: (Data, 500 GB)
// is full. In June, Gabriel set the Agenda's log level to debug to chase a
// double-booking bug and never set it back; the Agenda starts a new log
// each midnight (agenda.log becomes agenda-YYYY-MM-DD.log) and nothing
// ever deletes the old ones: 189 files of a few GB each.
//   - Get-Volume, Get-PSDrive D: 180 MB free;
//   - Get-ChildItem D:\ -Recurse -File | Sort-Object Length -Descending |
//     Select-Object -First 10 FullName, Length; Get-ChildItem D:\Logs\Agenda
//     | Measure-Object Length -Sum;
//   - Get-Content C:\ProgramData\Agenda\agenda.ini: level=debug;
//   - Get-ChildItem D:\Logs\Agenda -Filter agenda-*.log | Where-Object
//     LastWriteTime -lt (Get-Date).AddDays(-30) | Remove-Item -WhatIf,
//     then without -WhatIf (the last 30 days stay: Mariam's rule, and
//     Beatriz's investigation of 4 December);
//   - (Get-Content agenda.ini) -replace 'level=debug', 'level=info' |
//     Set-Content agenda.ini, Restart-Service Agenda (it reads its
//     configuration when it starts).
// Objective checked on the state: D: has at least 100 GB free, the logs
// of the last 30 days are all there, the backup (D:\Backup) is intact, the
// Agenda runs with a log level below debug (read at its last start).
// False leads: deleting the current agenda.log (in use by the Agenda:
// "being used by another process"), deleting everything in the folder
// (the recent logs, needed), deleting the backup to make room, NTFS
// compression (compact /c) without lowering the level (it buys time),
// lowering the level in the file without restarting the service.
// A cleanup task (Register-ScheduledTask) is welcome, not required.
// Sources: https://learn.microsoft.com/powershell/module/storage/get-volume,
// https://learn.microsoft.com/powershell/module/microsoft.powershell.management/remove-item?view=powershell-5.1,
// https://learn.microsoft.com/powershell/module/microsoft.powershell.core/where-object?view=powershell-5.1,
// https://learn.microsoft.com/windows-server/administration/windows-commands/compact,
// https://learn.microsoft.com/powershell/module/scheduledtasks/register-scheduledtask

import type { Chapter, File, Node } from '../world';
import type { Game } from '../shell';
import { logEvent, volumeFree, type WinService } from '../windows';
import { findService } from '../windows-services';
import { tasks } from '../windows-tasks';
import { HOME, iniLevel, quietEvents, ran, said, server, stave, event } from './music-school';

// Tuesday 18 December 2029, 8:35.
export const NOW = Date.UTC(2029, 11, 18, 8, 35, 0);
const DAY = 86_400_000;
const GIB = 1024 ** 3;
const MIB = 1024 ** 2;
// Gabriel set level=debug on 12 June; the rotated logs run from that day to yesterday.
const FIRST = Date.UTC(2029, 5, 12);
const LAST = Date.UTC(2029, 11, 17);
// Mariam's rule: the last 30 days of logs are kept (from 18 November).
const KEEP_FROM = NOW - (NOW % DAY) - 30 * DAY;
// What D: must have free at the end.
export const ENOUGH = 100 * GIB;
const LOGS = '/D/Logs/Agenda';

const ymd = (ms: number) => new Date(ms).toISOString().slice(0, 10);

/** A day's weight in the Agenda's traffic: weekdays, quiet weekends, the summer break, the busier autumn term. */
function weight(day: number): number {
  // A day's own variation (±8 %), fixed by its date.
  const jitter = 1 + ((Math.floor(day / DAY) * 7919) % 17 - 8) / 100;
  const w = [0.25, 1, 1, 1, 1, 1, 0.7][new Date(day).getUTCDay()] * jitter;
  if (day >= Date.UTC(2029, 6, 7) && day <= Date.UTC(2029, 8, 1)) return w * 0.12;
  return day > Date.UTC(2029, 8, 1) ? w * 1.15 : w;
}

/** A few of a day's debug lines (the file's size is the real one). */
function debugLines(day: number, until = 86_399_000): string {
  const d = ymd(day);
  const at = (ms: number) => new Date(day + ms).toISOString().slice(11, 23);
  return [
    `${d} ${at(12)} INFO  agenda-server rotated log, level=debug`,
    `${d} ${at(41_207)} DEBUG http GET /api/rooms?week=current 200 3ms session=7f2a`,
    `${d} ${at(41_209)} DEBUG sql SELECT id, room, starts, ends, teacher FROM bookings WHERE week = ? -- 212 rows`,
    `${d} ${at(41_214)} DEBUG cache miss rooms:week params={"week":"current"} 0.4ms`,
    `${d} ${at(Math.min(until, 41_950_118))} DEBUG http GET /api/health 200 1ms session=-`,
  ].join('\r\n');
}

/** The rotated logs, one per day since 12 June, sized after the day's traffic (about 492 GB in all). */
function rotatedLogs(): Record<string, Node> {
  const days: number[] = [];
  for (let d = FIRST; d <= LAST; d += DAY) days.push(d);
  const total = days.reduce((sum, d) => sum + weight(d), 0);
  const unit = (492 * GIB) / total;
  return Object.fromEntries(days.map((d) => [`agenda-${ymd(d)}.log`, { type: 'file', content: debugLines(d), lines: true, size: Math.round(weight(d) * unit), mtime: d + DAY - 1000 } satisfies File]));
}

/** Today's log, still open: the night's debug lines, then the disk full. */
const currentLog = (): File => ({
  type: 'file',
  content: [
    debugLines(NOW - (NOW % DAY), 27_000_000),
    `${ymd(NOW)} 07:52:10.417 ERROR booking save failed: There is not enough space on the disk. (room=Studio-1 lesson=trial family=F-2291)`,
    `${ymd(NOW)} 08:03:44.902 ERROR booking save failed: There is not enough space on the disk. (room=Hall lesson=orchestra family=-)`,
    `${ymd(NOW)} 08:31:09.226 DEBUG http GET /api/health 200 1ms session=-`,
  ].join('\r\n'),
  lines: true,
  size: Math.round(1.9 * GIB),
  mtime: NOW - 4 * 60_000,
});

const machine = stave({
  clock: NOW,
  teachersShare: 'fixed',
  agendaLevel: 'debug',
  agendaLog: currentLog(),
  agendaLogs: rotatedLogs(),
  dataFree: 180 * MIB,
  // The server warned twice that D: was nearly full (srv, 2013).
  events: [
    ...quietEvents(NOW),
    ...[NOW - (NOW % DAY) - 2 * 3_600_000 + 600_000, NOW - (NOW % DAY) + 6 * 3_600_000 + 600_000].map((at) => event(at, 2013, 'Warning', 'srv', 'The D: disk is at or near capacity.  You may need to delete some files.')),
  ].sort((a, b) => a.time - b.time),
  home: (t) => ({ 'email_beatriz.txt': { type: 'file', content: t('log-flood-email-beatriz').replace(/\n/g, '\r\n'), lines: true, mtime: NOW - 30 * 60_000 } }),
});

const agenda = (j: Game): WinService => findService(j, 'Agenda')!;
const freeD = (j: Game) => volumeFree(server(j), 'D');
/** The logs of the last 30 days, all still there. */
export const RECENT = (() => {
  const out: string[] = [];
  for (let d = KEEP_FROM; d <= LAST; d += DAY) out.push(`agenda-${ymd(d)}.log`);
  return out;
})();
const recentKept = (j: Game) => RECENT.every((n) => j.find(`${LOGS}/${n}`)?.type === 'file');
const backupIntact = (j: Game) => ['Teachers', 'Office', 'Public'].every((n) => j.find(`/D/Backup/Shares/${n}`)?.type === 'directory');
const QUIET = ['info', 'warning', 'warn', 'error'];
const quieter = (j: Game) => agenda(j).status === 'Running' && QUIET.includes(String(j.state.agendaLevel));
/** A file of the Agenda's logs NTFS-compressed. */
const compressed = (j: Game) => {
  const d = j.find(LOGS);
  return d?.type === 'directory' && Object.values(d.children).some((n) => n.type === 'file' && n.onDisk !== undefined);
};
const freed = (j: Game) => freeD(j) >= ENOUGH && recentKept(j);

export const COMMANDS_LOG_FLOOD = [
  'Get-Volume', 'Get-PSDrive', 'Get-ChildItem', 'Sort-Object', 'Select-Object', 'Measure-Object', 'Where-Object', 'Get-Date', 'Remove-Item', 'Get-Content', 'Set-Content',
  'Restart-Service', 'compact', 'Register-ScheduledTask', 'New-ScheduledTaskAction', 'New-ScheduledTaskTrigger', 'Get-Help',
];

export const logFlood: Chapter = {
  id: 'log-flood',
  number: 3,
  commands: COMMANDS_LOG_FLOOD,
  home: HOME,
  welcome: 'email_beatriz.txt',
  names: true,
  final: 'end',
  steps: ['full', 'culprit', 'level', 'whatif', 'freed', 'end'],
  accounts: machine.accounts,
  state: machine.state,
  createWorld: machine.createWorld,
  initialise: (j) => {
    // The Agenda runs since the last boot with the level it read then; the server warned twice.
    j.state.agendaLevel = 'debug';
    logEvent(j, 'Application', event(NOW - (NOW % DAY) + 7 * 3_600_000 + 3_130_417, 1000, 'Error', 'Agenda', 'booking save failed: There is not enough space on the disk.'));
  },
  events: [
    {
      id: 'full',
      condition: (j) => ran(j, 'Get-Volume', 'Get-PSDrive', 'Get-CimInstance', 'Get-WmiObject', 'fsutil') && (said(j, /\bData\b/) || said(j, /^D +[\d.]/m)),
      message: (j) => j.t('log-flood-event-full'),
    },
    {
      id: 'culprit',
      condition: (j) => ran(j, 'Get-ChildItem', 'Sort-Object', 'Measure-Object') && (said(j, /agenda-2029-\d\d-\d\d\.log/) || (ran(j, 'Measure-Object') && /logs/i.test(j.last.line) && said(j, /Sum +: \d{12}/))),
      message: (j) => j.t('log-flood-event-culprit'),
    },
    { id: 'level', condition: (j) => said(j, /^level=debug/m), message: (j) => j.t('log-flood-event-level') },
    { id: 'whatif', condition: (j) => said(j, 'What if: Performing the operation "Remove File" on target "D:\\Logs\\Agenda\\agenda-'), message: (j) => j.t('log-flood-event-whatif') },
    { id: 'in-use', condition: (j) => said(j, 'because it is being used by another process'), message: (j) => j.t('log-flood-event-in-use') },
    { id: 'recent-deleted', condition: (j) => !recentKept(j), message: (j) => j.t('log-flood-event-recent-deleted') },
    { id: 'current-deleted', condition: (j) => !j.find(`${LOGS}/agenda.log`), message: (j) => j.t('log-flood-event-current-deleted') },
    { id: 'backup-deleted', condition: (j) => !backupIntact(j), message: (j) => j.t('log-flood-event-backup-deleted') },
    { id: 'compressed', condition: compressed, message: (j) => j.t('log-flood-event-compressed') },
    { id: 'freed', condition: freed, message: (j) => j.t(quieter(j) ? 'log-flood-event-freed-quiet' : 'log-flood-event-freed') },
    { id: 'not-applied', condition: (j) => QUIET.includes(iniLevel(j) ?? '') && j.state.agendaLevel === 'debug', message: (j) => j.t('log-flood-event-not-applied') },
    { id: 'stopped', condition: (j) => agenda(j).status !== 'Running', message: (j) => j.t('log-flood-event-stopped') },
    { id: 'quieter', condition: quieter, message: (j) => j.t(freed(j) ? 'log-flood-event-quieter-freed' : 'log-flood-event-quieter') },
    { id: 'cleanup-task', condition: (j) => tasks(server(j)).some((t) => t.name !== 'Nightly Backup' && t.state === 'Ready' && t.triggers.length > 0), message: (j) => j.t('log-flood-event-cleanup-task') },
    { id: 'end', condition: (j) => freed(j) && backupIntact(j) && quieter(j), message: (j) => j.t('log-flood-event-end') },
  ],
};
