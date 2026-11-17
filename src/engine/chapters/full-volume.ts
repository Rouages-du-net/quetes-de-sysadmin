// Story "Next Door Windows" — chapter "The Other Side": since this morning,
// Plotter can't save its PDFs on the share: "No space left on device". From
// Linux, the share's volume is full (df: 100%) while the share itself holds
// some 62 GB (du): what fills the volume is outside the share, where Linux
// can't look. cabinet has Windows' built-in OpenSSH, and its shell is
// PowerShell:
//   - ssh cabinet: "PS C:\Users\you>"; Linux habits fail (grep is "not
//     recognized"; ls -la: "A parameter cannot be found that matches
//     parameter name 'la'"), the cmdlets and their aliases work;
//   - Get-Volume or Get-PSDrive: D: (Data) has 11 MB left of 500 GB;
//   - Get-ChildItem D:\ -Recurse | Sort-Object Length -Descending |
//     Select-Object -First 5: a 437 GB zip in D:\Backup, left on 3 November;
//   - Get-WinEvent -LogName System -MaxEvents 10 (or Get-EventLog): srv's
//     event 2013, "The D: disk is at or near capacity";
//   - Get-Help, help, man: the manual, in PowerShell's layout.
// The player only reads on Windows (Priya administers it): the objective is
// the diagnosis written in ~/cabinet-report.txt, naming the volume and the
// file; Priya then removes the archive.
// False lead: deleting drawings on the share from Linux to make room.
// Sources: https://learn.microsoft.com/windows-server/administration/openssh/openssh-overview,
// https://learn.microsoft.com/powershell/module/microsoft.powershell.management/get-childitem?view=powershell-5.1,
// https://learn.microsoft.com/powershell/module/storage/get-volume,
// https://learn.microsoft.com/powershell/module/microsoft.powershell.diagnostics/get-winevent?view=powershell-5.1

import { f, path, type Chapter } from '../world';
import type { Game, Shell } from '../shell';
import { mountCifs } from '../cifs';
import { machineName } from '../machines';
import { cmdletNamed } from '../commands/powershell';
import {
  ARCHIVE, FSTAB_BASE, HOME, MOUNT, PASSWORD, SVC, SVC_PASSWORD, cabinet, cabinetHost, compassAccounts, compassState, compassWorld, event, quietEvents,
} from './mixed-fleet';

// Tuesday 20 November 2029, 8:15.
export const NOW = Date.UTC(2029, 10, 20, 8, 15, 0);
const H = 3_600_000;

const EVENTS = [
  ...quietEvents(Date.UTC(2029, 10, 20, 0, 0, 0)),
  ...[Date.UTC(2029, 10, 18, 21, 30), Date.UTC(2029, 10, 19, 7, 40), Date.UTC(2029, 10, 19, 18, 2), Date.UTC(2029, 10, 20, 6, 0, 3)].map((time) =>
    event(time, 2013, 'Warning', 'srv', 'The D: disk is at or near capacity. You may need to delete some files.'),
  ),
  event(Date.UTC(2029, 10, 20, 6, 0, 2) + H / 3600, 50, 'Warning', 'Microsoft-Windows-SMBServer', "The server could not write to the file \\Shares\\plans\\exports\\harbour-library-A1.pdf on volume D: because the disk is full."),
].sort((a, b) => a.time - b.time);

export const fstabCifs = (t: Game['t']) => `${FSTAB_BASE}\n//${machineName(t, 'cabinet')}.internal/plans /mnt/plans cifs credentials=/root/.smbcredentials,uid=plotter,gid=plotter,file_mode=0664,dir_mode=0775,_netdev,nofail 0 0`;
const LOG = [
  '2029-11-19 06:00:01 plotter: exported harbour-library-A1.pdf (38 MB) to /mnt/plans/exports',
  '2029-11-20 06:00:02 plotter: cannot write /mnt/plans/exports/harbour-library-A1.pdf: No space left on device (os error 28)',
  '2029-11-20 06:00:02 plotter: export failed, will retry tomorrow at 06:00',
].join('\n');

const said = (j: Game, text: string) => j.last.output.includes(text) || j.last.errors.some((e) => e.includes(text));
const typed = (j: Game, ...cmds: string[]) => j.last.commands.some((c) => cmds.includes(c[0]) || (c[0] === 'sudo' && cmds.includes(c[1])));
/** What was last typed on cabinet (if you went there), and its output. */
function onCabinet(j: Game): Shell | null {
  const c = cabinet(j);
  return c && c.typedCommands > 0 ? c : null;
}
const cabinetSaid = (j: Game, text: string) => {
  const c = onCabinet(j);
  return !!c && (c.last.output.includes(text) || c.last.errors.some((e) => e.includes(text)));
};
const cabinetRan = (j: Game, ...cmdlets: string[]) => {
  const c = onCabinet(j);
  return !!c && c.last.commands.some((x) => cmdlets.includes(cmdletNamed(x[0])?.name ?? x[0]));
};
const report = (j: Game) => j.read(path(j.t, `${HOME}/cabinet-report.txt`)) ?? '';
const written = (j: Game) => /\bD:/i.test(report(j)) && report(j).toLowerCase().includes(ARCHIVE);
/** The office's drawings on the share (a deletion from Linux shows here). */
const plansBytes = (j: Game) => {
  const c = cabinet(j);
  const n = c?.find('/D/Shares/plans');
  return n && c ? c.size(n) : 0;
};

export const COMMANDS_FULL = [
  'ls', 'cd', 'pwd', 'cat', 'less', 'head', 'tail', 'grep', 'nano', 'sudo', 'id', 'whoami', 'echo', 'touch', 'rm', 'cp', 'mv', 'df', 'du', 'find', 'sort',
  'mount', 'umount', 'findmnt', 'smbclient', 'ssh', 'systemctl', 'journalctl', 'ps',
];

export const fullVolume: Chapter = {
  id: 'full-volume',
  number: 3,
  commands: COMMANDS_FULL,
  home: HOME,
  welcome: 'email_ifeoma.txt',
  names: true,
  final: 'end',
  steps: ['full', 'outside', 'powershell', 'volume', 'culprit', 'end'],
  password: PASSWORD,
  accounts: compassAccounts,
  hosts: { cabinet: cabinetHost({ clock: NOW, archive: true, events: EVENTS }) },
  state: (t) => compassState(t, { now: NOW, apt: true, mounted: true }),
  createWorld: (t) =>
    compassWorld(t, {
      fstab: fstabCifs(t),
      credentials: `username=${SVC}\npassword=${SVC_PASSWORD}\ndomain=CABINET`,
      plotterLog: LOG,
      home: { 'email_ifeoma.txt': f(t('full-volume-email-ifeoma')), 'cabinet-report.txt': f(t('full-volume-report'), { lines: true }) },
    }),
  initialise: (j) => {
    // The share is mounted since the last boot (the fstab line of "The Share Next Door").
    const s = j as Shell;
    mountCifs(s, { source: `//${machineName(j.t, 'cabinet')}.internal/plans`, point: MOUNT, options: ['credentials=/root/.smbcredentials', 'uid=plotter', 'gid=plotter', 'file_mode=0664', 'dir_mode=0775', '_netdev', 'nofail'] });
    j.state.plansBytes = plansBytes(j);
  },
  events: [
    { id: 'full', condition: (j) => typed(j, 'df') && said(j, MOUNT) && said(j, '100%'), message: (j) => j.t('full-volume-event-full') },
    { id: 'outside', condition: (j) => typed(j, 'du') && j.last.line.includes(MOUNT), message: (j) => j.t('full-volume-event-outside') },
    { id: 'deleted-drawings', condition: (j) => plansBytes(j) < (j.state.plansBytes as number), message: (j) => j.t('full-volume-event-deleted-drawings') },
    { id: 'powershell', condition: (j) => !!onCabinet(j), message: (j) => j.t('full-volume-event-powershell') },
    { id: 'linux-habit', condition: (j) => cabinetSaid(j, 'is not recognized as the name of a cmdlet'), message: (j) => j.t('full-volume-event-linux-habit') },
    { id: 'parameter', condition: (j) => cabinetSaid(j, 'A parameter cannot be found that matches parameter name'), message: (j) => j.t('full-volume-event-parameter') },
    { id: 'volume', condition: (j) => cabinetRan(j, 'Get-Volume', 'Get-PSDrive') && (cabinetSaid(j, 'Data') || cabinetSaid(j, 'FileSystem')), message: (j) => j.t('full-volume-event-volume') },
    { id: 'culprit', condition: (j) => cabinetSaid(j, ARCHIVE), message: (j) => j.t('full-volume-event-culprit') },
    { id: 'event-log', condition: (j) => cabinetSaid(j, 'is at or near capacity'), message: (j) => j.t('full-volume-event-event-log') },
    { id: 'read-only', condition: (j) => ((onCabinet(j)?.state.psWriters as number | undefined) ?? 0) > 0, message: (j) => j.t('full-volume-event-read-only') },
    {
      id: 'end',
      condition: written,
      // Priya removes the archive, Plotter's next try goes through.
      action: (j) => {
        const c = cabinet(j);
        const backup = c?.find('/D/Backup');
        if (backup?.type === 'directory') delete backup.children[ARCHIVE];
      },
      message: (j) => j.t('full-volume-event-end'),
    },
  ],
};
