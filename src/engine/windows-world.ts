// A Windows Server 2022 as a story declares it: the default tree of C:\
// (Windows, Program Files, ProgramData, Users with their profiles) with its
// default NTFS permissions, the built-in and local accounts, the default
// services, the registry's usual keys, the event logs (the Task
// Scheduler's history disabled, as Windows Server ships it), the local
// password policy, the network, OpenSSH (DefaultShell or not). A story
// calls windowsMachine() and adds its own files, services, shares, tasks.
// Sources (Microsoft Learn): "Default folder permissions" of a Windows
// Server volume root (CREATOR OWNER, SYSTEM, Administrators full control,
// Users read & execute, create folders and append), "Local accounts"
// (https://learn.microsoft.com/windows/security/identity-protection/access-control/local-accounts),
// "Services on Windows Server"
// (https://learn.microsoft.com/windows-server/security/windows-services/security-guidelines-for-disabling-system-services-in-windows-server),
// "OpenSSH Server configuration for Windows" (DefaultShell, sshd_config).

import type { Accounts, Directory, File, Node, NtfsAce } from './world';
import type { WinEvent, WinService, WinShare, WinVolume, Windows } from './windows';
import type { WinTask } from './windows-tasks';
import { BUILTIN_GROUPS, BUILTIN_USERS, type WinGroup, type WinUser } from './windows-accounts';
import { FULL, MODIFY, READ_EXECUTE } from './windows-acl';
import { dword, expand, key, sz, type Registry } from './windows-registry';

const DAY = 86_400_000;
const GR_GE = 0x80000000 + 0x20000000;

export interface WindowsUserSpec {
  name: string;
  password: string;
  fullName?: string;
  description?: string;
  // Local groups (Administrators, Users, Remote Desktop Users, or the story's own).
  groups?: string[];
  enabled?: boolean;
  // How long ago the password was set (days).
  passwordAge?: number;
  neverExpires?: boolean;
  // A profile under C:\Users (true by default for the player and administrators).
  profile?: boolean;
}

export interface WindowsOptions {
  // The computer's name, in capitals (CABINET).
  computer: string;
  // The player's account (an administrator) and its password.
  player: string;
  password: string;
  // The machine's clock (ms, local time read as UTC).
  clock: number;
  users?: WindowsUserSpec[];
  // The story's local groups (their members: account names).
  groups?: { name: string; description?: string; members?: string[] }[];
  volumes?: WinVolume[];
  network?: Windows['network'];
  // OpenSSH's DefaultShell: PowerShell (the default here), or cmd.exe (null: no DefaultShell set).
  defaultShell?: 'powershell' | null;
  services?: WinService[];
  shares?: WinShare[];
  tasks?: WinTask[];
  // The System log's first events (oldest first); the others start empty.
  events?: WinEvent[];
  // The Task Scheduler's history (off by default on Windows Server).
  taskHistory?: boolean;
  // The local password policy (42 days, complexity on).
  policy?: Windows['policy'];
}

const ace = (id: string, mask: number, flags: Partial<NtfsAce> = {}): NtfsAce => ({ id, mask, ...flags });
const OICI = { oi: true, ci: true };

/** The root of a volume formatted on Windows Server (icacls D:\). */
export const ROOT_ACES = (): NtfsAce[] => [
  ace('CREATOR OWNER', FULL, { ...OICI, io: true }),
  ace('NT AUTHORITY\\SYSTEM', FULL, OICI),
  ace('BUILTIN\\Administrators', FULL, OICI),
  ace('BUILTIN\\Users', READ_EXECUTE, OICI),
  ace('BUILTIN\\Users', 0x4, { ci: true }),
  ace('BUILTIN\\Users', 0x2, { ci: true, io: true }),
];

/** A folder that keeps its own permissions (inheritance off): the profile of a user, C:\Windows… */
const own = (children: Record<string, Node>, owner: string, aces: NtfsAce[]): Directory => ({ type: 'directory', children, acl: { owner, aces, protected: true } });
const dir = (children: Record<string, Node> = {}): Directory => ({ type: 'directory', children });
const file = (content: string, size?: number): File => ({ type: 'file', content, lines: true, ...(size !== undefined ? { size } : {}) });

/** A user's profile: SYSTEM, Administrators and the user, full control, inheritance off. */
export function profile(computer: string, user: string): Directory {
  const id = `${computer}\\${user}`;
  return own(
    { Desktop: dir(), Documents: dir(), Downloads: dir(), AppData: { ...dir({ Local: dir({ Temp: dir() }), Roaming: dir() }) } },
    id,
    [ace('NT AUTHORITY\\SYSTEM', FULL, OICI), ace('BUILTIN\\Administrators', FULL, OICI), ace(id, FULL, OICI)],
  );
}

/** The C:\ drive of a fresh Windows Server 2022, with its profiles. */
export function systemDrive(o: WindowsOptions): Directory {
  const profiles = [o.player, ...(o.users ?? []).filter((u) => u.profile ?? (u.groups ?? []).includes('Administrators')).map((u) => u.name)];
  const exe = (size: number) => file('(binary)', size);
  const trusted = 'NT SERVICE\\TrustedInstaller';
  const windowsAces = [
    ace(trusted, FULL),
    ace(trusted, FULL, { ci: true, io: true }),
    ace('NT AUTHORITY\\SYSTEM', MODIFY),
    ace('NT AUTHORITY\\SYSTEM', FULL, { ...OICI, io: true }),
    ace('BUILTIN\\Administrators', MODIFY),
    ace('BUILTIN\\Administrators', FULL, { ...OICI, io: true }),
    ace('BUILTIN\\Users', READ_EXECUTE),
    ace('BUILTIN\\Users', GR_GE, { ...OICI, io: true }),
    ace('CREATOR OWNER', FULL, { ...OICI, io: true }),
  ];
  const system32 = dir({
    'cmd.exe': exe(289_792),
    'icacls.exe': exe(36_352),
    'ipconfig.exe': exe(35_840),
    'net.exe': exe(57_344),
    'sc.exe': exe(71_680),
    'schtasks.exe': exe(229_376),
    'whoami.exe': exe(70_656),
    'reg.exe': exe(77_312),
    'takeown.exe': exe(43_520),
    'wevtutil.exe': exe(240_640),
    'svchost.exe': exe(57_528),
    WindowsPowerShell: dir({ 'v1.0': dir({ 'powershell.exe': exe(452_608) }) }),
    OpenSSH: dir({ 'sshd.exe': exe(1_211_904), 'ssh.exe': exe(950_784) }),
    drivers: dir({ etc: dir({ hosts: file('# Copyright (c) 1993-2009 Microsoft Corp.\r\n#\r\n# This is a sample HOSTS file used by Microsoft TCP/IP for Windows.\r\n#\r\n# localhost name resolution is handled within DNS itself.\r\n#\t127.0.0.1       localhost\r\n#\t::1             localhost') }) }),
    LogFiles: dir(),
    config: dir(),
  });
  return {
    type: 'directory',
    acl: { owner: trusted, aces: ROOT_ACES() },
    children: {
      PerfLogs: dir(),
      'Program Files': own({ 'Windows NT': dir(), WindowsPowerShell: dir({ Modules: dir() }), 'Common Files': dir() }, trusted, windowsAces),
      'Program Files (x86)': own({}, trusted, windowsAces),
      ProgramData: own(
        { ssh: dir({ sshd_config: file('# Windows OpenSSH\r\nPasswordAuthentication yes\r\nMatch Group administrators\r\n       AuthorizedKeysFile __PROGRAMDATA__/ssh/administrators_authorized_keys'), logs: dir() }), Microsoft: dir() },
        'NT AUTHORITY\\SYSTEM',
        [ace('NT AUTHORITY\\SYSTEM', FULL, OICI), ace('BUILTIN\\Administrators', FULL, OICI), ace('CREATOR OWNER', FULL, { ...OICI, io: true }), ace('BUILTIN\\Users', READ_EXECUTE, OICI), ace('BUILTIN\\Users', 0x116, { ci: true })],
      ),
      Users: own(
        { Public: dir({ Documents: dir(), Desktop: dir() }), Default: dir({ Desktop: dir(), Documents: dir() }), ...Object.fromEntries(profiles.map((u) => [u, profile(o.computer, u)])) },
        'NT AUTHORITY\\SYSTEM',
        [ace('NT AUTHORITY\\SYSTEM', FULL, OICI), ace('BUILTIN\\Administrators', FULL, OICI), ace('BUILTIN\\Users', READ_EXECUTE, OICI), ace('Everyone', READ_EXECUTE)],
      ),
      Windows: own({ System32: system32, Temp: dir(), Logs: dir(), Tasks: dir() }, trusted, windowsAces),
    },
  };
}

/** An empty data volume (D:\) with the root's default permissions. */
export const dataDrive = (children: Record<string, Node> = {}): Directory => ({ type: 'directory', children, acl: { owner: 'BUILTIN\\Administrators', aces: ROOT_ACES() } });

/** The services a Windows Server 2022 runs out of the box (a subset). */
export const DEFAULT_SERVICES = (): WinService[] => [
  { name: 'BITS', display: 'Background Intelligent Transfer Service', status: 'Stopped', start: 'Manual' },
  { name: 'Dhcp', display: 'DHCP Client', status: 'Running', start: 'Automatic', account: 'NT Authority\\LocalService' },
  { name: 'Dnscache', display: 'DNS Client', status: 'Running', start: 'Automatic', account: 'NT AUTHORITY\\NetworkService' },
  { name: 'EventLog', display: 'Windows Event Log', status: 'Running', start: 'Automatic', account: 'NT AUTHORITY\\LocalService' },
  { name: 'LanmanServer', display: 'Server', status: 'Running', start: 'Automatic', description: 'Supports file, print, and named-pipe sharing over the network for this computer.' },
  { name: 'LanmanWorkstation', display: 'Workstation', status: 'Running', start: 'Automatic', account: 'NT AUTHORITY\\NetworkService' },
  { name: 'MpsSvc', display: 'Windows Defender Firewall', status: 'Running', start: 'Automatic', account: 'NT Authority\\LocalService' },
  { name: 'Schedule', display: 'Task Scheduler', status: 'Running', start: 'Automatic' },
  { name: 'Spooler', display: 'Print Spooler', status: 'Running', start: 'Automatic', path: 'C:\\Windows\\System32\\spoolsv.exe', process: 'spoolsv.exe' },
  { name: 'ssh-agent', display: 'OpenSSH Authentication Agent', status: 'Stopped', start: 'Disabled' },
  { name: 'sshd', display: 'OpenSSH SSH Server', status: 'Running', start: 'Automatic', path: 'C:\\Windows\\System32\\OpenSSH\\sshd.exe', process: 'sshd.exe' },
  { name: 'W32Time', display: 'Windows Time', status: 'Running', start: 'Manual', account: 'NT AUTHORITY\\LocalService' },
  { name: 'WinDefend', display: 'Microsoft Defender Antivirus Service', status: 'Running', start: 'Automatic', path: '"C:\\ProgramData\\Microsoft\\Windows Defender\\platform\\4.18.24090.11-0\\MsMpEng.exe"', process: 'MsMpEng.exe' },
  { name: 'WinRM', display: 'Windows Remote Management (WS-Management)', status: 'Running', start: 'Automatic', account: 'NT AUTHORITY\\NetworkService' },
  { name: 'wuauserv', display: 'Windows Update', status: 'Stopped', start: 'Manual' },
];

/** The registry's usual keys. */
export function defaultRegistry(o: WindowsOptions): Registry {
  return {
    HKLM: key('HKEY_LOCAL_MACHINE', {}, [
      key('SOFTWARE', {}, [
        key('Microsoft', {}, [
          key('Windows NT', {}, [
            key('CurrentVersion', { ProductName: sz('Windows Server 2022 Standard'), EditionID: sz('ServerStandard'), CurrentBuild: sz('20348'), DisplayVersion: sz('21H2'), InstallationType: sz('Server'), RegisteredOwner: sz('Windows User'), SystemRoot: sz('C:\\Windows') }),
          ]),
          key('Windows', {}, [key('CurrentVersion', { ProgramFilesDir: sz('C:\\Program Files'), CommonFilesDir: sz('C:\\Program Files\\Common Files') }, [key('Run')])]),
        ]),
        key('OpenSSH', o.defaultShell === null ? {} : { DefaultShell: sz('C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe') }),
        key('Policies'),
      ]),
      key('SYSTEM', {}, [
        key('CurrentControlSet', {}, [
          key('Control', {}, [key('ComputerName', {}, [key('ComputerName', { ComputerName: sz(o.computer) })]), key('TimeZoneInformation', { TimeZoneKeyName: sz('UTC') })]),
          key('Services'),
        ]),
      ]),
    ]),
    HKCU: key('HKEY_CURRENT_USER', {}, [key('Environment', { TEMP: expand('%USERPROFILE%\\AppData\\Local\\Temp'), TMP: expand('%USERPROFILE%\\AppData\\Local\\Temp') }), key('Software', {}, [key('Microsoft')]), key('Console', { QuickEdit: dword(1) })]),
  };
}

/** The Linux-style accounts the game's ssh reads (kept in step with the Windows accounts, see syncAccounts). */
export function windowsAccounts(o: WindowsOptions): () => Accounts {
  return () => {
    const users: Accounts['users'] = { Administrator: { uid: 1500, group: 'Administrators', home: '/C/Users/Administrator' }, [o.player]: { uid: 2000, group: 'Administrators', home: `/C/Users/${o.player}` } };
    (o.users ?? []).forEach((u, i) => (users[u.name] = { uid: 2001 + i, group: u.groups?.[0] ?? 'Users', home: `/C/Users/${u.name}` }));
    const groups: Accounts['groups'] = {};
    for (const [name, rid] of BUILTIN_GROUPS) groups[name] = { gid: rid, members: [] };
    for (const g of o.groups ?? []) groups[g.name] = { gid: 3000 + Object.keys(groups).length, members: [] };
    groups.Administrators.members.push('Administrator', o.player);
    for (const u of o.users ?? []) for (const g of u.groups ?? ['Users']) groups[g]?.members.push(u.name);
    for (const g of o.groups ?? []) for (const m of g.members ?? []) if (!groups[g.name].members.includes(m)) groups[g.name].members.push(m);
    return { users, groups };
  };
}

/** The machine's state: state.os = 'windows', state.windows, OpenSSH's settings. */
export function windowsState(o: WindowsOptions): Record<string, unknown> {
  const c = o.computer;
  const users: Record<string, WinUser> = {};
  for (const [name, rid, description, enabled] of BUILTIN_USERS) users[name] = { name, fullName: '', description, enabled, rid, passwordLastSet: name === 'Administrator' ? o.clock - 90 * DAY : null, neverExpires: name !== 'Administrator', lastLogon: null };
  users[o.player] = { name: o.player, fullName: '', description: '', enabled: true, rid: 1000, passwordLastSet: o.clock - 20 * DAY, lastLogon: o.clock - DAY, neverExpires: false };
  (o.users ?? []).forEach((u, i) => (users[u.name] = { name: u.name, fullName: u.fullName ?? '', description: u.description ?? '', enabled: u.enabled ?? true, rid: 1001 + i, passwordLastSet: o.clock - (u.passwordAge ?? 10) * DAY, neverExpires: u.neverExpires, lastLogon: null }));
  const groups: Record<string, WinGroup> = {};
  for (const [name, rid, description] of BUILTIN_GROUPS) groups[name] = { name, description, rid, builtin: true, members: [] };
  groups.Users.members.push('NT AUTHORITY\\INTERACTIVE', 'NT AUTHORITY\\Authenticated Users');
  groups.Administrators.members.push(`${c}\\Administrator`, `${c}\\${o.player}`);
  groups.Guests.members.push(`${c}\\Guest`);
  (o.groups ?? []).forEach((g, i) => (groups[g.name] = { name: g.name, description: g.description ?? '', rid: 1100 + i, members: [] }));
  for (const u of o.users ?? []) for (const g of u.groups ?? ['Users']) groups[g]?.members.push(`${c}\\${u.name}`);
  for (const g of o.groups ?? []) for (const m of g.members ?? []) if (!groups[g.name].members.includes(`${c}\\${m}`)) groups[g.name].members.push(`${c}\\${m}`);
  const passwords: Record<string, string> = { [o.player]: o.password, Administrator: `${o.password}!` };
  for (const u of o.users ?? []) passwords[u.name] = u.password;
  const windows: Windows = {
    computer: c,
    services: [...DEFAULT_SERVICES().filter((s) => !(o.services ?? []).some((x) => x.name === s.name)), ...(o.services ?? []).map((s) => ({ ...s, dependsOn: s.dependsOn && [...s.dependsOn] }))],
    volumes: o.volumes ?? [{ letter: 'C', label: '', size: Math.round(126.4 * 1024 ** 3), base: Math.round(21.7 * 1024 ** 3) }],
    events: (o.events ?? []).map((e) => ({ ...e })),
    shares: [
      { name: 'ADMIN$', path: 'C:\\Windows', description: 'Remote Admin', change: [], special: true, access: [{ account: 'BUILTIN\\Administrators', right: 'Full' }] },
      ...(o.volumes ?? [{ letter: 'C' }]).map((v) => ({ name: `${v.letter}$`, path: `${v.letter}:\\`, description: 'Default share', change: [], special: true, access: [{ account: 'BUILTIN\\Administrators', right: 'Full' as const }] })),
      { name: 'IPC$', path: '', description: 'Remote IPC', change: [], special: true },
      ...(o.shares ?? []).map((s) => ({ ...s, change: [...s.change], access: s.access?.map((a) => ({ ...a })) })),
    ],
    smb1: false,
    passwords,
    clock: o.clock,
    boot: o.clock - 6 * DAY,
    users: users as unknown as Record<string, unknown>,
    groups: groups as unknown as Record<string, unknown>,
    policy: o.policy ?? { maxAge: 42, minLength: 0, complexity: true },
    registry: defaultRegistry(o),
    // Each session gets its own copies (a story's options are shared).
    tasks: (o.tasks ?? []).map((t) => ({ ...t, actions: t.actions.map((a) => ({ ...a })), triggers: t.triggers.map((x) => ({ ...x, days: x.days && [...x.days] })) })),
    logs: {
      Application: { events: [], enabled: true },
      Security: { events: [], enabled: true },
      Setup: { events: [], enabled: true },
      'Microsoft-Windows-TaskScheduler/Operational': { events: [], enabled: !!o.taskHistory },
      'Windows PowerShell': { events: [], enabled: true },
    },
    network: o.network,
    shells: ['powershell'],
  };
  return { os: 'windows', windows, sshd: { load: { passwordauthentication: 'yes', pubkeyauthentication: 'yes' } }, realSsh: true };
}

/** What a chapter (or an internal host) needs for a Windows Server: its world, accounts and state. */
export function windowsMachine(o: WindowsOptions, drives: { C?: (c: Directory) => void; D?: Record<string, Node> } = {}) {
  return {
    home: `/C/Users/${o.player}`,
    accounts: windowsAccounts(o),
    state: () => windowsState(o),
    createWorld: (): Directory => {
      const c = systemDrive(o);
      drives.C?.(c);
      const children: Record<string, Node> = { C: c };
      for (const v of o.volumes ?? []) if (v.letter !== 'C') children[v.letter] = dataDrive(v.letter === 'D' ? (drives.D ?? {}) : {});
      return { type: 'directory', children };
    },
  };
}
