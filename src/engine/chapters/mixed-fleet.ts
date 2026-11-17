// Story "Next Door Windows": what its chapters share. A cooperative of
// architects (the Drawing Office) runs compass, a Debian server (the backup
// of the projects, Plotter: the service that exports the drawings to PDF),
// next to cabinet, a Windows Server 2022 file server that Priya, their
// contractor, installed and looks after once a month. Ifeoma runs the
// office; Henrik, an architect, writes scripts on his Windows laptop. The
// Linux admin's part of a mixed fleet: a script with Windows line endings,
// the Windows share mounted on Linux, and a look inside the Windows server
// through its built-in OpenSSH, where the shell is PowerShell.
// Sources: dos2unix(1), gitattributes(5), mount.cifs(8), Microsoft Learn
// (OpenSSH for Windows, SMBv1, PowerShell 5.1), see each chapter.

import { accountsFiles, d, f, path, player, type Accounts, type Directory, type File, type InternalHost, type Node } from '../world';
import type { Translate } from '../../texts';
import type { Game, Shell } from '../shell';
import { generateKey } from '../access';
import { machineName } from '../machines';
import { newSystemd } from '../systemd';
import { newCommit, type Commit } from '../commands/git';
import type { Windows, WinEvent } from '../windows';
import { cifsMounts } from '../cifs';

export const HOME = '/home/you';
// calque-2029 in French (passwords.ftl).
export const PASSWORD = 'drafting-2029';
export const ADDRESS = '192.0.2.40';
export const CABINET = '192.0.2.41';
export const OPS = `${HOME}/ops`;
export const MOUNT = '/mnt/plans';
// The Windows account Priya made for compass (a Windows password: not translated).
export const SVC = 'compass-svc';
export const SVC_PASSWORD = 'Ruler-2029-cab';
export const AUTHOR = 'Henrik <henrik@drawing-office.example>';

/** Your key on compass, authorised for your administrator account on cabinet. */
export const KEY = generateKey('mixed-fleet-compass', 'you@compass');

const GIB = 1024 ** 3;
const MIB = 1024 ** 2;

// ——— compass: Debian ———

export const compassAccounts = (): Accounts => ({
  users: {
    root: { uid: 0, group: 'root', home: '/root' },
    you: { uid: 1000, group: 'you' },
    henrik: { uid: 1002, group: 'henrik' },
    plotter: { uid: 1001, group: 'plotter', home: '/opt/plotter', shell: '/usr/sbin/nologin' },
  },
  groups: {
    root: { gid: 0, members: [] },
    sudo: { gid: 27, members: ['you'] },
    you: { gid: 1000, members: [] },
    henrik: { gid: 1002, members: [] },
    plotter: { gid: 1001, members: [] },
  },
});

/** The backup script as Henrik wrote it, on his Windows laptop. */
export const BACKUP_LINES = [
  '#!/bin/bash',
  '# Nightly copy of the current projects - Henrik (written on my laptop)',
  'SRC=/srv/projects',
  'DEST=/srv/nightly',
  '',
  'cd $SRC && cp -r current $DEST',
  'echo "Backup finished"',
];
export const BACKUP_CRLF = BACKUP_LINES.join('\r\n');
export const BACKUP_LF = BACKUP_LINES.join('\n');

/** ~/ops, the office's scripts: Henrik's two commits (made on Windows, so in CR LF). */
export function opsHistory(t: Translate): Commit[] {
  const readme = t('mixed-fleet-ops-readme');
  const c1 = newCommit(null, 'Add README', AUTHOR, 'Mon Nov 5 17:02:11 2029 +0100', { 'about.txt': readme });
  const c2 = newCommit(c1, 'Add nightly backup script', AUTHOR, 'Mon Nov 5 17:40:52 2029 +0100', { 'about.txt': readme, 'nightly-copy.sh': BACKUP_CRLF });
  return [c1, c2];
}

export const FSTAB_BASE = `# /etc/fstab: static file system information.
#
# <file system> <mount point>   <type>  <options>       <dump>  <pass>
UUID=6c1f8e2a-3b7d-4e19-a5c2-0d9f4b8e7a13 /               ext4    errors=remount-ro 0       1`;

const SUDOERS = 'root ALL=(ALL:ALL) ALL\n%sudo ALL=(ALL:ALL) ALL';

export interface CompassOptions {
  home: Record<string, Node>;
  backup?: string;
  fstab?: string;
  credentials?: string;
  plotterLog?: string;
}

export function compassWorld(t: Translate, o: CompassOptions): Directory {
  const root = { owner: 'root' };
  const place = (children: Record<string, Node>, rights: { owner?: string; group?: string; mode?: string } = root) => d(children, undefined, rights);
  const file = (text: string, rights: { owner?: string; group?: string; mode?: string } = root): File => f(text, { lines: true, ...rights });
  const drawing = (bytes: number) => f('(binary)', { size: bytes, owner: 'henrik' });
  return place({
    etc: place({
      ...accountsFiles(),
      hostname: file('compass'),
      hosts: file(`127.0.0.1\tlocalhost\n${ADDRESS}\tcompass compass.internal\n${CABINET}\t${machineName(t, 'cabinet')} ${machineName(t, 'cabinet')}.internal`),
      fstab: file(o.fstab ?? FSTAB_BASE),
      sudoers: file(SUDOERS, { owner: 'root', mode: 'r--r-----' }),
    }),
    home: place({
      you: d({
        ...o.home,
        ops: d({ '.git': d({ HEAD: f('ref: refs/heads/main', { lines: true }) }), 'about.txt': f(t('mixed-fleet-ops-readme'), { lines: true }), 'nightly-copy.sh': f(o.backup ?? BACKUP_CRLF, { lines: true, mode: 'rwxr-xr-x' }) }),
        '.ssh': d(
          {
            id_ed25519: f(KEY.isPrivate, { lines: true, mode: 'rw-------' }),
            'id_ed25519.pub': f(KEY.isPublic, { lines: true }),
          },
          undefined,
          { mode: 'rwx------' },
        ),
      }),
      henrik: place({}, { owner: 'henrik', mode: 'rwx------' }),
    }),
    root: place(o.credentials ? { '.smbcredentials': file(o.credentials, { owner: 'root', mode: 'rw-------' }) } : {}, { owner: 'root', mode: 'rwx------' }),
    srv: place({
      projects: place(
        {
          current: d({ 'harbour-library.dwg': drawing(48 * MIB), 'school-canteen.dwg': drawing(31 * MIB), 'notes.txt': f(t('mixed-fleet-project-notes'), { lines: true, owner: 'henrik' }) }, undefined, { owner: 'henrik' }),
        },
        { owner: 'henrik' },
      ),
      nightly: place({}, { owner: 'you' }),
    }),
    mnt: place({ plans: place({}) }),
    opt: place({ plotter: place({ 'plotter.conf': file(t('mixed-fleet-plotter-conf')) }, { owner: 'plotter' }) }),
    var: place({ log: place({ plotter: place({ 'export.log': file(o.plotterLog ?? '', { owner: 'plotter' }) }, { owner: 'plotter' }) }) }),
    tmp: place({}, { owner: 'root', mode: 'rwxrwxrwt' }),
  });
}

export function compassState(t: Translate, o: { now: number; apt?: boolean; git?: boolean; mounted?: boolean }) {
  const proc = (pid: number, user: string, command: string) => ({ pid, user, cpu: 0, mem: 0.3, command });
  return {
    systemd: newSystemd('compass', Date.UTC(2029, 10, 1, 7, 0, 0), o.now, {
      ssh: { description: 'OpenBSD Secure Shell server', active: true, executable: 'sshd', process: [proc(612, 'root', 'sshd: /usr/sbin/sshd -D')] },
      cron: { description: 'Regular background program processing daemon', active: true, executable: 'cron', process: [proc(588, 'root', '/usr/sbin/cron -f')] },
      plotter: { description: 'Plotter - drawing export service', active: true, executable: 'plotter', process: [proc(744, 'plotter', '/opt/plotter/bin/plotter --config /opt/plotter/plotter.conf')] },
    }),
    nfsAddress: ADDRESS,
    mounts: [{ path: '/', capacity: 64 * GIB, name: '/dev/vda1', system: 'ext4' }],
    ...(o.apt ? { apt: { lists: true, installed: { curl: '8.14.1-2', rsync: '3.4.1+ds1-5', tar: '1.35+dfsg-3.1', 'openssh-server': '1:10.0p1-7', smbclient: '2:4.22.3+dfsg-4', dos2unix: '7.5.2-1', ...(o.mounted ? { 'cifs-utils': '2:7.2-2' } : {}) } } } : {}),
    ...(o.git ? { git: { [path(t, OPS)]: { commits: opsHistory(t), index: { ...opsHistory(t).at(-1)!.files } } }, author: `${player(t)} <${player(t)}@drawing-office.example>`, date: 'Tue Nov 6 09:41:00 2029 +0100' } : {}),
  };
}

// ——— cabinet: Windows Server 2022 ———

export const cabinetAccounts = (): Accounts => ({
  users: {
    Administrator: { uid: 500, group: 'Administrators', home: '/C/Users/Administrator' },
    you: { uid: 1001, group: 'Users', home: '/C/Users/you' },
    [SVC]: { uid: 1002, group: 'Users', home: '/C/Users/compass-svc' },
  },
  groups: {
    Administrators: { gid: 544, members: ['Administrator', 'you'] },
    Users: { gid: 545, members: ['you', SVC] },
  },
});

const DAY = 86_400_000;

/** The plans share: the office's projects (about 62 GB), their PDF exports, the templates. */
function plansShare(t: Translate, clock: number): Directory {
  const file = (bytes: number, days: number) => f('(binary)', { size: Math.round(bytes), mtime: clock - days * DAY });
  const project = (files: Record<string, [number, number]>) => d(Object.fromEntries(Object.entries(files).map(([n, [b, days]]) => [n, file(b, days)])));
  return d({
    Projects: d({
      '2028-housing-coop': project({ 'model.rvt': [11.2 * GIB, 260], 'site-plan.dwg': [212 * MIB, 255], 'renders.zip': [6.4 * GIB, 250] }),
      '2029-harbour-library': project({ 'model.rvt': [17.8 * GIB, 3], 'facade.dwg': [348 * MIB, 4], 'renders.zip': [9.1 * GIB, 6], 'survey.pdf': [96 * MIB, 40] }),
      '2029-school-canteen': project({ 'model.rvt': [12.6 * GIB, 2], 'kitchen.dwg': [188 * MIB, 5], 'renders.zip': [3.9 * GIB, 9] }),
    }),
    exports: d({ 'harbour-library-A1.pdf': file(38 * MIB, 1), 'school-canteen-A1.pdf': file(29 * MIB, 2) }),
    Templates: d({ 'title-block.dwt': file(2 * MIB, 400), 'readme.txt': f(t('mixed-fleet-templates-readme'), { lines: true, mtime: clock - 400 * DAY }) }),
  });
}

const scansShare = (clock: number) =>
  d(Object.fromEntries(Array.from({ length: 6 }, (_, i) => [`scan-2029-11-${String(4 + i).padStart(2, '0')}.tif`, f('(binary)', { size: Math.round(1.4 * GIB), mtime: clock - (10 - i) * DAY })])));

export const D_SIZE = 500 * GIB;
const D_BASE = Math.round(1.6 * GIB);
export const ARCHIVE = 'plans-full-2029-11-03.zip';
// What the volume D: keeps free once the archive is there (about 11 MB).
const LEFT = 11.4 * MIB;

const sizeOf = (n: Node): number => (n.type === 'file' ? (n.size ?? 0) : Object.values(n.children).reduce((a, c) => a + sizeOf(c), 0));

export interface CabinetOptions {
  clock: number;
  archive?: boolean;
  events?: WinEvent[];
}

export function cabinetWorld(t: Translate, o: CabinetOptions): Directory {
  const plans = plansShare(t, o.clock);
  const scans = scansShare(o.clock);
  const hiddenDir = d({}, undefined, { owner: 'Administrator' });
  const backup = d({});
  if (o.archive) backup.children[ARCHIVE] = f('(binary)', { size: Math.round(D_SIZE - D_BASE - sizeOf(plans) - sizeOf(scans) - LEFT), mtime: Date.UTC(2029, 10, 3, 18, 40, 0) });
  return d({
    C: d({
      Users: d({
        you: d({ Desktop: d({}), Documents: d({ 'cabinet-handover.txt': f(t('mixed-fleet-handover'), { lines: true, mtime: Date.UTC(2029, 9, 28, 16, 0, 0) }) }) }),
        Administrator: d({}),
        Public: d({}),
      }),
      ProgramData: d({ ssh: d({ administrators_authorized_keys: f(KEY.isPublic, { lines: true }), sshd_config: f('# Windows OpenSSH (Priya)\nPasswordAuthentication no\nMatch Group administrators\n       AuthorizedKeysFile __PROGRAMDATA__/ssh/administrators_authorized_keys', { lines: true }) }) }),
      Windows: d({ System32: d({ drivers: d({}) }) }),
    }),
    D: d({
      Shares: d({ plans, Scans: scans }),
      Backup: backup,
      'System Volume Information': hiddenDir,
      '$RECYCLE.BIN': d({}),
    }),
  });
}

export const SERVICES: Windows['services'] = [
  { name: 'BITS', display: 'Background Intelligent Transfer Service', status: 'Stopped', start: 'Manual' },
  { name: 'Dhcp', display: 'DHCP Client', status: 'Running', start: 'Automatic' },
  { name: 'Dnscache', display: 'DNS Client', status: 'Running', start: 'Automatic' },
  { name: 'EventLog', display: 'Windows Event Log', status: 'Running', start: 'Automatic' },
  { name: 'LanmanServer', display: 'Server', status: 'Running', start: 'Automatic' },
  { name: 'LanmanWorkstation', display: 'Workstation', status: 'Running', start: 'Automatic' },
  { name: 'MpsSvc', display: 'Windows Defender Firewall', status: 'Running', start: 'Automatic' },
  { name: 'Spooler', display: 'Print Spooler', status: 'Stopped', start: 'Disabled' },
  { name: 'ssh-agent', display: 'OpenSSH Authentication Agent', status: 'Stopped', start: 'Disabled' },
  { name: 'sshd', display: 'OpenSSH SSH Server', status: 'Running', start: 'Automatic' },
  { name: 'W32Time', display: 'Windows Time', status: 'Running', start: 'Automatic' },
  { name: 'wbengine', display: 'Block Level Backup Engine Service', status: 'Stopped', start: 'Manual' },
  { name: 'WinDefend', display: 'Microsoft Defender Antivirus Service', status: 'Running', start: 'Automatic' },
  { name: 'WinRM', display: 'Windows Remote Management (WS-Management)', status: 'Running', start: 'Automatic' },
  { name: 'wuauserv', display: 'Windows Update', status: 'Stopped', start: 'Manual' },
];

export const event = (time: number, id: number, level: WinEvent['level'], provider: string, message: string): WinEvent => ({ time, id, level, provider, message });
const scm = (time: number, service: string, state: string) => event(time, 7036, 'Information', 'Service Control Manager', `The ${service} service entered the ${state} state.`);

/** The System log: the usual traffic of a quiet server. */
export function quietEvents(until: number): WinEvent[] {
  const out: WinEvent[] = [];
  for (let day = until - 6 * DAY; day < until; day += DAY) {
    out.push(scm(day + 3 * 3_600_000, 'Windows Update', 'running'), scm(day + 3 * 3_600_000 + 240_000, 'Windows Update', 'stopped'));
    out.push(event(day + 6 * 3_600_000, 98, 'Information', 'Microsoft-Windows-Ntfs', 'Volume D: (\\Device\\HarddiskVolume4) is healthy.  No action is needed.'));
  }
  return out;
}

export function cabinetHost(o: CabinetOptions): InternalHost {
  return {
    address: CABINET,
    domain: 'cabinet.internal',
    home: '/C/Users/you',
    accounts: cabinetAccounts,
    commands: [...CABINET_COMMANDS],
    state: (t) => ({
      os: 'windows',
      windows: {
        computer: machineName(t, 'cabinet').toUpperCase(),
        services: SERVICES.map((s) => ({ ...s })),
        volumes: [
          { letter: 'C', label: '', size: Math.round(99.39 * GIB), base: Math.round(38.2 * GIB) },
          { letter: 'D', label: 'Data', size: D_SIZE, base: D_BASE },
        ],
        events: o.events ?? quietEvents(o.clock),
        shares: [
          { name: 'ADMIN$', path: 'C:\\Windows', description: 'Remote Admin', change: ['Administrator'], special: true },
          { name: 'C$', path: 'C:\\', description: 'Default share', change: ['Administrator'], special: true },
          { name: 'D$', path: 'D:\\', description: 'Default share', change: ['Administrator'], special: true },
          { name: 'IPC$', path: '', description: 'Remote IPC', change: [], special: true },
          { name: 'plans', path: 'D:\\Shares\\plans', description: 'Drawings and plans', change: [SVC, 'Administrator'] },
          { name: 'scans', path: 'D:\\Shares\\Scans', description: 'Scanner drop folder', change: ['Administrator'] },
        ],
        smb1: false,
        passwords: { [SVC]: SVC_PASSWORD },
        clock: o.clock,
      } satisfies Windows,
    }),
    createWorld: (t) => cabinetWorld(t, o),
  };
}

// What the PowerShell session knows (the cmdlets, their aliases, two programs).
export const CABINET_COMMANDS = [
  'Get-ChildItem', 'Get-Content', 'Set-Location', 'Get-Location', 'Get-Service', 'Get-PSDrive', 'Get-Volume', 'Get-WinEvent', 'Get-EventLog', 'Get-SmbShare',
  'Where-Object', 'Sort-Object', 'Select-Object', 'Format-Table', 'Format-List', 'Measure-Object', 'Write-Output', 'Clear-Host', 'Get-Help', 'Get-Command',
  'Get-Alias', 'ls', 'dir', 'cat', 'type', 'cd', 'pwd', 'sort', 'select', 'where', 'ft', 'fl', 'help', 'man', 'hostname', 'whoami', 'exit',
];

/** The cabinet session, once you have been there. */
export const cabinet = (j: Game): Shell | null => (j as Shell).internal('cabinet');

/** The plans share mounted at /mnt/plans (on cabinet), if it is. */
export const plansMount = (j: Game) => cifsMounts(j as Shell).find((m) => m.path === MOUNT && m.cifs.share.toLowerCase() === 'plans');

export type { Translate };
