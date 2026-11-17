// Story "The Music School": what its chapters share. A community music
// school (lessons for children and adults, a few concerts a year) has one
// server, stave (portee in French), a Windows Server 2022 that Gabriel, a
// parent who volunteered as its admin for six years, set up and has just
// handed over: you are the new admin (a few hours a week). Mariam runs the
// school; Samir coordinates the teachers; Beatriz runs the office
// (registrations, fees). The server holds the departments' shares (Teachers,
// Office, Public) with their NTFS permissions, the Agenda (the lesson and
// room booking app, a service under its own local account svc_agenda), a
// nightly backup task under svc_backup (C:\Scripts\backup.ps1 copies the
// shares to D:\Backup), and the logs of both on D:\Logs.
// OpenSSH lands in cmd.exe (no DefaultShell set): `powershell` switches.
// Chapters 3 and 4 (planned) reuse this world: the logs filling D:, and the
// backup task that silently stopped (see docs/SCENARIOS.md).
// Sources (Microsoft Learn): "Share and NTFS permissions"
// (https://learn.microsoft.com/troubleshoot/windows-server/networking/permissions-on-shared-folders-and-ntfs),
// "Service user accounts" (https://learn.microsoft.com/windows/win32/services/service-user-accounts),
// "OpenSSH Server configuration for Windows" (DefaultShell).

import { player, type Accounts, type Directory, type File, type Node, type NtfsAce } from '../world';
import type { Translate } from '../../texts';
import type { Game, Shell } from '../shell';
import { machineName, privateKey, storyMachine, WORKSTATION } from '../machines';
import { publicFor } from '../access';
import { windows, type WinEvent, type WinService, type WinShare } from '../windows';
import { FULL, MODIFY, READ_EXECUTE } from '../windows-acl';
import { windowsAccounts, windowsMachine, windowsState, type WindowsOptions, type WindowsUserSpec } from '../windows-world';
import type { WinTask } from '../windows-tasks';
import { cmdletNamed } from '../commands/powershell';

export const STORY = 'music-school';
export const ADDRESS = '192.0.2.42';
export const HOME = '/C/Users/you';

const GIB = 1024 ** 3;
const MIB = 1024 ** 2;
const KIB = 1024;
const DAY = 86_400_000;
const H = 3_600_000;

// The service accounts' passwords (Windows passwords: not translated).
export const AGENDA_PASSWORD = 'Etude-3pw-Lx81';
export const BACKUP_PASSWORD = 'Coda-5ty-Hn42';
// The player's own (the key is what logs on; Windows keeps a password anyway).
const PLAYER_PASSWORD = 'Treble-2029-adm';

/** The computer's name in the language (STAVE, PORTEE). */
export const computer = (t: Translate) => machineName(t, 'stave').toUpperCase();

export const TEACHERS = ['samir', 'lucia', 'yuki'];
export const OFFICE = ['beatriz', 'tomasz'];

const USERS: WindowsUserSpec[] = [
  { name: 'samir', password: 'Violin-2029-sm', fullName: 'Samir Benali', description: 'Violin, teachers\' coordinator', groups: ['Users', 'Teachers'], passwordAge: 31 },
  { name: 'lucia', password: 'Piano-2029-lf', fullName: 'Lucia Ferreira', description: 'Piano', groups: ['Users', 'Teachers'], passwordAge: 12 },
  { name: 'yuki', password: 'Cello-2029-yt', fullName: 'Yuki Tanaka', description: 'Cello and orchestra', groups: ['Users', 'Teachers'], passwordAge: 40 },
  { name: 'beatriz', password: 'Office-2029-bo', fullName: 'Beatriz Okafor', description: 'Office: registrations and fees', groups: ['Users', 'Office'], passwordAge: 5 },
  { name: 'tomasz', password: 'Office-2029-tw', fullName: 'Tomasz Wolski', description: 'Office (Wednesdays)', groups: ['Users', 'Office'], passwordAge: 22 },
  { name: 'svc_agenda', password: AGENDA_PASSWORD, description: 'Agenda service account', groups: ['Users'], neverExpires: true, passwordAge: 190 },
  { name: 'svc_backup', password: BACKUP_PASSWORD, description: 'Backup task account', groups: ['Users', 'Backup Operators'], neverExpires: true, passwordAge: 190 },
];

const GROUPS = [
  { name: 'Teachers', description: 'The school\'s teachers' },
  { name: 'Office', description: 'Registrations, fees, planning' },
];

/** The Agenda: the lesson and room booking app, a service under its own local account. */
export const AGENDA: WinService = {
  name: 'Agenda',
  display: 'Agenda - lessons and rooms',
  status: 'Running',
  start: 'Automatic',
  account: '.\\svc_agenda',
  password: AGENDA_PASSWORD,
  path: '"C:\\Program Files\\Agenda\\agenda-server.exe" --config "C:\\ProgramData\\Agenda\\agenda.ini"',
  process: 'agenda-server.exe',
  description: 'Bookings of lessons and rooms for the music school (web app on port 8080).',
};

/** The nightly backup: C:\Scripts\backup.ps1 under svc_backup, at 1:30. */
export const backupTask = (t: Translate): WinTask => ({
  path: '\\',
  name: 'Nightly Backup',
  state: 'Ready',
  author: `${computer(t)}\\Gabriel`,
  description: 'Copies D:\\Shares to D:\\Backup every night.',
  user: `${computer(t)}\\svc_backup`,
  logon: 'Password',
  password: BACKUP_PASSWORD,
  actions: [{ execute: 'C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe', arguments: '-NoProfile -ExecutionPolicy Bypass -File C:\\Scripts\\backup.ps1' }],
  triggers: [{ kind: 'Daily', start: Date.UTC(2029, 2, 1, 1, 30, 0) }],
  lastResult: 0,
});

export const BACKUP_SCRIPT = [
  '# Nightly copy of the shares (Gabriel, March 2029)',
  '$day = Get-Date -Format yyyy-MM-dd',
  'Copy-Item D:\\Shares\\* D:\\Backup\\Shares -Recurse -Force',
  'Add-Content D:\\Logs\\Backup\\backup.log "$day copy done"',
].join('\r\n');

const ace = (id: string, mask: number, inherit = true): NtfsAce => ({ id, mask, ...(inherit ? { oi: true, ci: true } : {}) });
const SYSTEM_ADMINS = [ace('NT AUTHORITY\\SYSTEM', FULL), ace('BUILTIN\\Administrators', FULL)];
const file = (content: string, mtime: number, size?: number): File => ({ type: 'file', content, lines: true, mtime, ...(size !== undefined ? { size: Math.round(size) } : {}) });
const binary = (size: number, mtime: number): File => ({ type: 'file', content: '(binary)', size: Math.round(size), mtime });
const dir = (children: Record<string, Node> = {}, acl?: Directory['acl']): Directory => ({ type: 'directory', children, ...(acl ? { acl } : {}) });

export interface StaveOptions {
  // The machine's clock (local time, read as UTC).
  clock: number;
  // The LessonPlans folder still frozen read-only for the teachers (chapter 1's starting point).
  frozenLessonPlans?: boolean;
  // The share permissions of Teachers: New-SmbShare's default (Everyone Read), or fixed.
  teachersShare?: 'default' | 'fixed';
  // The Agenda's stored password, if it differs from the account's (chapter 2).
  agendaStored?: string;
  // svc_agenda's password, if it was changed (chapter 2).
  agendaPassword?: string;
  // When svc_agenda's password was last set (days before the clock).
  agendaPasswordAge?: number;
  // The Agenda's state at the start.
  agendaStatus?: WinService['status'];
  // The System log (oldest first).
  events?: WinEvent[];
  // The chapter's own files in the player's profile (Documents included).
  home?: (t: Translate) => Record<string, Node>;
  // Extra log files (D:\Logs\Agenda), for a chapter that needs them.
  agendaLogs?: Record<string, Node>;
}

/** The options of stave's windowsMachine(), in the language (player, computer's name). */
export function staveOptions(t: Translate, o: StaveOptions): WindowsOptions {
  const C = computer(t);
  const fixed = o.teachersShare === 'fixed';
  const shares: WinShare[] = [
    {
      name: 'Teachers',
      path: 'D:\\Shares\\Teachers',
      description: 'Lesson plans, scores, recordings',
      change: [],
      // New-SmbShare without -FullAccess/-ChangeAccess: Everyone, Read.
      access: fixed ? [{ account: 'Everyone', right: 'Read' }, { account: `${C}\\Teachers`, right: 'Change' }] : [{ account: 'Everyone', right: 'Read' }],
    },
    { name: 'Office', path: 'D:\\Shares\\Office', description: 'Registrations and fees', change: [], access: [{ account: `${C}\\Office`, right: 'Change' }, { account: 'BUILTIN\\Administrators', right: 'Full' }] },
    { name: 'Public', path: 'D:\\Shares\\Public', description: 'Posters, concert programmes', change: [], access: [{ account: 'Everyone', right: 'Read' }, { account: `${C}\\Teachers`, right: 'Change' }, { account: `${C}\\Office`, right: 'Change' }] },
  ];
  const users = USERS.map((u) => (u.name === 'svc_agenda' ? { ...u, password: o.agendaPassword ?? u.password, passwordAge: o.agendaPasswordAge ?? u.passwordAge } : u));
  return {
    computer: C,
    player: player(t),
    password: PLAYER_PASSWORD,
    clock: o.clock,
    users,
    groups: GROUPS,
    volumes: [
      { letter: 'C', label: '', size: Math.round(126.4 * GIB), base: Math.round(24.8 * GIB) },
      { letter: 'D', label: 'Data', size: 500 * GIB, base: Math.round(1.2 * GIB) },
    ],
    network: { address: ADDRESS, mask: '255.255.255.0', gateway: '192.0.2.1', dns: '192.0.2.1', suffix: 'internal' },
    // No DefaultShell: OpenSSH lands in cmd.exe (chapter 1's first lesson).
    defaultShell: null,
    services: [{ ...AGENDA, status: o.agendaStatus ?? AGENDA.status, password: o.agendaStored ?? AGENDA.password }],
    shares,
    tasks: [{ ...backupTask(t), lastRun: o.clock - ((o.clock - 1.5 * H) % DAY) }],
    events: o.events ?? quietEvents(o.clock),
    taskHistory: false,
  };
}

/** The music school's files on D: (shares, backup, logs), with their NTFS permissions. */
function dataDrive(t: Translate, o: StaveOptions): Record<string, Node> {
  const C = computer(t);
  const ago = (days: number) => o.clock - days * DAY;
  const teachers = `${C}\\Teachers`;
  const office = `${C}\\Office`;
  const lessons = dir(
    {
      'piano-beginners-term2.docx': binary(46 * KIB, ago(80)),
      'violin-group-term2.docx': binary(38 * KIB, ago(75)),
      'theory-grade1.pdf': binary(1.2 * MIB, ago(120)),
      'orchestra-plan-december.docx': binary(52 * KIB, ago(9)),
    },
    // Gabriel froze LessonPlans during the summer copy: inheritance off, the teachers read only.
    o.frozenLessonPlans ? { protected: true, aces: [...SYSTEM_ADMINS, ace(teachers, READ_EXECUTE), ace(`${C}\\svc_backup`, READ_EXECUTE)] } : undefined,
  );
  return {
    Shares: dir(
      {
        Teachers: dir(
          {
            LessonPlans: lessons,
            Scores: dir({ 'bach-minuet-g.pdf': binary(310 * KIB, ago(200)), 'winter-concert-parts.zip': binary(18 * MIB, ago(6)), 'scales-cello.pdf': binary(140 * KIB, ago(64)) }),
            Recordings: dir({ 'spring-concert-2029.mp3': binary(84 * MIB, ago(230)) }),
          },
          { protected: true, aces: [...SYSTEM_ADMINS, ace(teachers, MODIFY), ace(`${C}\\svc_backup`, READ_EXECUTE)] },
        ),
        Office: dir(
          { 'registrations-2029.xlsx': binary(212 * KIB, ago(1)), 'fees-autumn.xlsx': binary(96 * KIB, ago(3)), 'rooms.xlsx': binary(31 * KIB, ago(40)) },
          { protected: true, aces: [...SYSTEM_ADMINS, ace(office, MODIFY), ace(`${C}\\svc_backup`, READ_EXECUTE)] },
        ),
        Public: dir(
          { 'winter-concert-poster.pdf': binary(2.4 * MIB, ago(12)), 'timetable-2029-2030.pdf': binary(180 * KIB, ago(90)) },
          { protected: true, aces: [...SYSTEM_ADMINS, ace('BUILTIN\\Users', READ_EXECUTE), ace(teachers, MODIFY), ace(office, MODIFY), ace(`${C}\\svc_backup`, READ_EXECUTE)] },
        ),
      },
      { protected: true, aces: [...SYSTEM_ADMINS, ace('BUILTIN\\Users', READ_EXECUTE, false)] },
    ),
    Backup: dir({ Shares: dir() }, { protected: true, aces: [...SYSTEM_ADMINS, ace(`${C}\\svc_backup`, MODIFY)] }),
    Logs: dir(
      {
        Agenda: dir({
          'agenda.log': file(agendaLog(o.clock), o.clock - 2 * H, 3.1 * MIB),
          ...(o.agendaLogs ?? {}),
        }),
        Backup: dir({ 'backup.log': file(backupLog(o.clock), ago(0) - ((o.clock - 1.5 * H) % DAY) + 4 * 60_000) }, { protected: true, aces: [...SYSTEM_ADMINS, ace(`${C}\\svc_backup`, MODIFY)] }),
      },
      { protected: true, aces: [...SYSTEM_ADMINS, ace('BUILTIN\\Users', READ_EXECUTE)] },
    ),
  };
}

const ymd = (ms: number) => new Date(ms).toISOString().slice(0, 10);

/** The Agenda's own log: a quiet week of bookings. */
function agendaLog(clock: number): string {
  const lines: string[] = [];
  for (let day = clock - 3 * DAY - (clock % DAY); day < clock - (clock % DAY); day += DAY) {
    lines.push(`${ymd(day)} 07:58:12 INFO  agenda-server listening on 0.0.0.0:8080`);
    lines.push(`${ymd(day)} 09:14:40 INFO  booking room=Studio-2 lesson=piano teacher=lucia`);
    lines.push(`${ymd(day)} 17:31:05 INFO  booking room=Hall lesson=orchestra teacher=yuki`);
  }
  return lines.join('\r\n');
}

function backupLog(clock: number): string {
  const lines: string[] = [];
  for (let i = 4; i >= 1; i--) lines.push(`${ymd(clock - i * DAY + DAY)} copy done`);
  return lines.join('\r\n');
}

/** The player's profile: the chapter's files, Gabriel's handover in Documents. */
function profileFiles(t: Translate, o: StaveOptions): Record<string, Node> {
  const docs: Record<string, Node> = { 'handover.txt': file(t('music-school-handover').replace(/\n/g, '\r\n'), Date.UTC(2029, 10, 30, 17, 10, 0)) };
  const own = { ...(o.home?.(t) ?? {}) };
  const documents = own.Documents;
  delete own.Documents;
  return { ...own, Documents: dir({ ...docs, ...(documents?.type === 'directory' ? documents.children : {}) }) };
}

/** stave: a Windows Server 2022, as a chapter declares it (home, accounts, state, world). */
export function stave(o: StaveOptions) {
  return {
    home: HOME,
    // The accounts in English: the game translates "you" (vous in French).
    accounts: (): Accounts => windowsAccounts(staveOptionsEnglish(o))(),
    state: (t: Translate) => windowsState(staveOptions(t, o)),
    createWorld: (t: Translate): Directory => {
      const m = windowsMachine(staveOptions(t, o), {
        C: (c) => {
          c.children.Scripts = dir({ 'backup.ps1': file(BACKUP_SCRIPT, Date.UTC(2029, 2, 1, 20, 0, 0)) }, { protected: true, aces: [...SYSTEM_ADMINS, ace(`${computer(t)}\\svc_backup`, READ_EXECUTE)] });
          const programFiles = c.children['Program Files'];
          if (programFiles?.type === 'directory') programFiles.children.Agenda = dir({ 'agenda-server.exe': binary(24 * MIB, Date.UTC(2029, 5, 2, 10, 0, 0)) });
          const programData = c.children.ProgramData;
          if (programData?.type === 'directory') {
            programData.children.Agenda = dir({ 'agenda.ini': file('[server]\r\nport=8080\r\ndatabase=C:\\ProgramData\\Agenda\\agenda.db\r\nlog=D:\\Logs\\Agenda\\agenda.log', Date.UTC(2029, 5, 2, 10, 0, 0)), 'agenda.db': binary(41 * MIB, o.clock - 3 * H) });
            // The game's key for stave, authorised for its administrators (Gabriel put it there for you).
            const ssh = programData.children.ssh;
            const m = storyMachine(STORY);
            if (ssh?.type === 'directory' && m) ssh.children.administrators_authorized_keys = file(`${publicFor(privateKey(m))} ${player(t)}@${machineName(t, WORKSTATION.name)}`, Date.UTC(2029, 10, 30, 17, 0, 0));
          }
          const users = c.children.Users;
          const mine = users?.type === 'directory' ? users.children[player(t)] : undefined;
          if (mine?.type === 'directory') Object.assign(mine.children, profileFiles(t, o));
        },
        D: dataDrive(t, o),
      });
      return m.createWorld();
    },
  };
}

/** The English options, for the accounts the game then translates. */
const staveOptionsEnglish = (o: StaveOptions): WindowsOptions => ({ computer: 'STAVE', player: 'you', password: PLAYER_PASSWORD, clock: o.clock, users: USERS, groups: GROUPS });

// ——— The System log ———

export const event = (time: number, id: number, level: WinEvent['level'], provider: string, message: string): WinEvent => ({ time, id, level, provider, message });
const scm = (time: number, service: string, state: string) => event(time, 7036, 'Information', 'Service Control Manager', `The ${service} service entered the ${state} state.`);

/** A quiet server's System log over the last days. */
export function quietEvents(until: number): WinEvent[] {
  const out: WinEvent[] = [];
  const start = until - (until % DAY) - 5 * DAY;
  for (let day = start; day < until; day += DAY) {
    out.push(scm(day + 3 * H, 'Windows Update', 'running'), scm(day + 3 * H + 240_000, 'Windows Update', 'stopped'));
    out.push(event(day + 6 * H, 98, 'Information', 'Microsoft-Windows-Ntfs', 'Volume D: (\\Device\\HarddiskVolume4) is healthy.  No action is needed.'));
  }
  return out.filter((e) => e.time < until);
}

/** A restart for updates (TrustedInstaller), at `time`: 1074, 6006, then the boot's 6005 and 6013. */
export function rebootEvents(t: Translate, time: number): WinEvent[] {
  const C = computer(t);
  return [
    event(time, 1074, 'Information', 'User32', `The process C:\\Windows\\servicing\\TrustedInstaller.exe (${C}) has initiated the restart of computer ${C} on behalf of user NT AUTHORITY\\SYSTEM for the following reason: Operating System: Upgrade (Planned)\n Reason Code: 0x80020003\n Shutdown Type: restart\n Comment: `),
    event(time + 20_000, 6006, 'Information', 'EventLog', 'The Event log service was stopped.'),
    event(time + 95_000, 6005, 'Information', 'EventLog', 'The Event log service was started.'),
    event(time + 95_000, 6013, 'Information', 'EventLog', 'The system uptime is 12 seconds.'),
  ];
}

// ——— What the chapters' events read ———

/** The share, by name. */
export const share = (j: Game, name: string) => windows(j).shares.find((s) => s.name.toLowerCase() === name.toLowerCase())!;

/** Did the last line run one of these cmdlets or programs (aliases resolved, .exe optional)? */
export function ran(j: Game, ...names: string[]): boolean {
  const low = names.map((n) => n.toLowerCase());
  return j.last.commands.some((c) => {
    const typed = (c[0] ?? '').toLowerCase();
    const cmdlet = cmdletNamed(c[0] ?? '')?.name.toLowerCase();
    return low.includes(typed) || low.includes(typed.replace(/\.exe$/, '')) || (!!cmdlet && low.includes(cmdlet));
  });
}

/** The last line's output or errors say this. */
export const said = (j: Game, text: string | RegExp) => {
  const all = [j.last.output, ...j.last.errors];
  return all.some((x) => (typeof text === 'string' ? x.includes(text) : text.test(x)));
};

/** The session is in PowerShell (not cmd.exe). */
export const inPowerShell = (j: Game) => (windows(j).shells ?? []).at(-1) === 'powershell';

/** The Windows session behind a game (the chapter's own machine). */
export const server = (j: Game) => j as Shell;
