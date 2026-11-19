// Story "The Card Catalogue": what its chapters share. A network of three
// public libraries (Central, Riverside, Hilltop) has one Active Directory
// domain, lending.internal (NetBIOS LENDING): register (registre in
// French), its domain controller, a Windows Server 2022 reached from the
// workstation with ssh (it lands in PowerShell), and stacks (rayons), a
// member file server, an internal host reached from register with
// Windows' own OpenSSH client (ssh stacks). Tomas, who set the domain up
// and ran it for five years, has moved to the city's IT department; you
// take over, a few days a week. Nandini directs the network; Ines,
// Bongani and Nandini herself run the branches.
// The domain follows Tomas's conventions (Documents\conventions.txt):
//   - users in OU=<branch>,OU=Branches, sAMAccountName = first initial +
//     surname (kmensah), Department, Title and Manager filled in;
//   - AGDLP: people go into a global group per department (GG_Lending,
//     GG_Children, GG_LocalHistory, GG_Management), those groups into the
//     domain local groups of the shares (DL_Staff_RW, DL_Events_RW,
//     DL_Archives_RW, DL_Archives_RO, DL_Finance_RW), which alone appear
//     in the NTFS permissions of stacks;
//   - leavers: disabled, moved to OU=Leavers, out of their groups (kept a
//     year: their SID owns files, their mailbox is archived).
// Left for chapters 3 and 4: an old leaver still in groups (oadeyemi),
// inactive accounts (ychen, pmorel), a GPO linked to the wrong OU and
// filtered to one group too few (Events Drive: on OU=Central instead of
// OU=Branches, GG_Children without GG_Management), workstations where
// librarians are logged on (their policy: gpresult /s), a service account
// that looks inactive but isn't (svc_backup: the offsite copy runs twice a
// year), a Remote Desktop rule open to Any on stacks. The AD Recycle Bin
// has been on since Tomas built the domain.
// Sources (Microsoft Learn): "Active Directory Domain Services overview"
// (https://learn.microsoft.com/windows-server/identities/ad-ds/get-started/virtual-dc/active-directory-domain-services-overview),
// "Group scope" (https://learn.microsoft.com/windows-server/identity/ad-ds/manage/understand-security-groups#group-scope),
// the ActiveDirectory module (https://learn.microsoft.com/powershell/module/activedirectory/).

import { player, type Accounts, type Directory, type File, type InternalHost, type Node, type NtfsAce } from '../world';
import type { Translate } from '../../texts';
import type { Game, Shell } from '../shell';
import { machineName, privateKey, storyMachine, WORKSTATION } from '../machines';
import { generateKey, publicFor } from '../access';
import { windows, type WinEvent, type WinShare } from '../windows';
import { FULL, MODIFY, READ_EXECUTE } from '../windows-acl';
import { domainController, windowsAccounts, windowsMachine, windowsState, type WindowsOptions } from '../windows-world';
import type { FwRule } from '../windows-firewall';
import { domainOf, findIdentity, type AdObject, type AdUserSpec, type DomainSpec } from '../windows-ad';
import type { WinTask } from '../windows-tasks';
import { advanceWindows } from '../windows-tasks';
import { cmdletNamed } from '../commands/powershell';

export const STORY = 'card-catalogue';
export const DNS = 'lending.internal';
export const NETBIOS = 'LENDING';
export const BASE = 'DC=lending,DC=internal';
export const ADDRESS = '192.0.2.46';
export const STACKS = '192.0.2.47';
// A public catalogue kiosk, on the libraries' flat network.
export const KIOSK = '192.0.2.210';
export const HOME = '/C/Users/you';

const GIB = 1024 ** 3;
const KIB = 1024;
const MIB = 1024 ** 2;
const DAY = 86_400_000;
const H = 3_600_000;
const MIN = 60_000;

/** Days between a date and the clock (a last logon fixed in time, whatever the chapter's day). */
const since = (o: CatalogueOptions, at: number) => (o.clock - at) / DAY;
// The offsite copy of the Archives, under svc_backup: 1 October and 1 April, at 3:00.
export const OFFSITE_LAST = Date.UTC(2029, 9, 1, 3, 0, 0);

// The player's own password (the key is what logs on; the domain keeps one anyway).
const PLAYER_PASSWORD = 'Catalogue-2030-adm';
// The service account of the scan import, its password in the password manager (Documents\vault-svc_scans.txt).
export const SCANS_PASSWORD = 'Folio-8vt-Rq37';
// Rafael's passwords: the one he had until Monday (still stored in the task), and his new one.
export const RAFAEL_OLD = 'Parchment-41-Rs';
export const RAFAEL_NEW = 'Vellum-2030-Rs';
// svc_backup's password (stored in the offsite copy's task).
export const BACKUP_PASSWORD = 'Night-7qx-Bk52';

/** The domain controller's and the file server's computer names in the language (REGISTER, STACKS; REGISTRE, RAYONS). */
export const dcName = (t: Translate) => machineName(t, 'register').toUpperCase();
export const stacksName = (t: Translate) => machineName(t, 'stacks').toUpperCase();

/** An OU path as a DN: 'Branches/Riverside' → OU=Riverside,OU=Branches,DC=lending,DC=internal. */
export const ou = (path: string) => [...path.split('/').reverse().map((p) => `OU=${p}`), BASE].join(',');

export const GG = ['GG_Lending', 'GG_Children', 'GG_LocalHistory', 'GG_Management'];
export const DL = ['DL_Staff_RW', 'DL_Events_RW', 'DL_Archives_RW', 'DL_Archives_RO', 'DL_Finance_RW'];

// The people (diverse, fictional), by branch. lastLogon: days ago.
const STAFF: AdUserSpec[] = [
  { sam: 'nmukherjee', given: 'Nandini', surname: 'Mukherjee', ou: 'Branches/Central', password: 'Lantern-2030-nm', department: 'Management', title: 'Network Director', groups: ['GG_Management'], passwordAge: 33 },
  { sam: 'iduarte', given: 'Ines', surname: 'Duarte', ou: 'Branches/Riverside', password: 'Harbour-2030-id', department: 'Management', title: 'Branch Manager', manager: 'nmukherjee', groups: ['GG_Management'], passwordAge: 58 },
  { sam: 'bdlamini', given: 'Bongani', surname: 'Dlamini', ou: 'Branches/Hilltop', password: 'Summit-2030-bd', department: 'Management', title: 'Branch Manager', manager: 'nmukherjee', groups: ['GG_Management'], passwordAge: 12 },
  // Amara: acting deputy at Riverside since the autumn, and an exception on the finance share while she covers the budget.
  { sam: 'aokoye', given: 'Amara', surname: 'Okoye', ou: 'Branches/Riverside', password: 'Story-2030-ao', department: 'Children', title: 'Youth Librarian', manager: 'iduarte', groups: ['GG_Children', 'GG_Management', 'DL_Finance_RW'], passwordAge: 40 },
  // Leila: on parental leave since mid-December, back in March (her last logon: 17 December).
  { sam: 'lhassan', given: 'Leila', surname: 'Hassan', ou: 'Branches/Riverside', password: 'Return-2030-lh', department: 'Lending', title: 'Library Assistant', manager: 'iduarte', groups: ['GG_Lending'], passwordAge: 21 },
  { sam: 'tnguyen', given: 'Thanh', surname: 'Nguyen', ou: 'Branches/Central', password: 'Shelf-2030-tn', department: 'Lending', title: 'Library Assistant', manager: 'nmukherjee', groups: ['GG_Lending'], passwordAge: 70 },
  { sam: 'rsilva', given: 'Rafael', surname: 'Silva', ou: 'Branches/Central', password: RAFAEL_OLD, department: 'Local History', title: 'Archivist', manager: 'nmukherjee', groups: ['GG_LocalHistory'], passwordAge: 88 },
  { sam: 'ychen', given: 'Yan', surname: 'Chen', ou: 'Branches/Central', password: 'Tales-2029-yc', department: 'Children', title: 'Storyteller', manager: 'nmukherjee', groups: ['GG_Children'], passwordAge: 160, lastLogon: 131 },
  { sam: 'mrossi', given: 'Mateo', surname: 'Rossi', ou: 'Branches/Hilltop', password: 'Renewal-2030-mr', department: 'Lending', title: 'Library Assistant', manager: 'bdlamini', groups: ['GG_Lending'], passwordAge: 30 },
  { sam: 'jbaptiste', given: 'Josephine', surname: 'Baptiste', ou: 'Branches/Hilltop', password: 'Rhyme-2030-jb', department: 'Children', title: 'Youth Librarian', manager: 'bdlamini', groups: ['GG_Children'], passwordAge: 9 },
  { sam: 'pmorel', given: 'Pierre', surname: 'Morel', ou: 'Branches/Hilltop', password: 'Ledger-2029-pm', department: 'Local History', title: 'Volunteer Archivist', manager: 'bdlamini', groups: ['GG_LocalHistory'], passwordAge: 240, lastLogon: 212 },
  // An old leaver (May 2029): disabled and in Leavers, but still in his groups (chapter 4).
  { sam: 'oadeyemi', given: 'Olu', surname: 'Adeyemi', ou: 'Leavers', password: 'Spine-2029-oa', enabled: false, department: 'Lending', title: 'Library Assistant', description: 'Left 2029-05-31', groups: ['GG_Lending', 'DL_Staff_RW'], passwordAge: 260, lastLogon: 220 },
  // The offsite copy of the Archives runs as svc_backup twice a year (1 October, 1 April): its last logon looks old.
  { sam: 'svc_backup', name: 'Backup Service', ou: 'Service Accounts', password: BACKUP_PASSWORD, description: 'Offsite copy of the Archives (stacks), 1 April and 1 October', neverExpires: true, groups: ['DL_Archives_RO'], passwordAge: 300 },
  { sam: 'svc_scans', name: 'Scan Import', ou: 'Service Accounts', password: SCANS_PASSWORD, description: 'Scan import into the Archives share (stacks)', groups: ['DL_Archives_RW'], neverExpires: true, passwordAge: 120, lastLogon: null },
];

/** Kofi, the new youth librarian at Riverside (chapter 1), as the player was asked to create him. */
export const KOFI: AdUserSpec = { sam: 'kmensah', given: 'Kofi', surname: 'Mensah', ou: 'Branches/Riverside', password: 'Bookmark-2030-km', department: 'Children', title: 'Youth Librarian', manager: 'iduarte', groups: ['GG_Children'], passwordAge: 2, lastLogon: 1 };

export interface CatalogueOptions {
  // The domain controller's clock (local time, read as UTC).
  clock: number;
  // Chapter 1 done: Kofi created, Mateo disabled in Leavers.
  arrivals?: boolean;
  // Rafael's password: when he changed it (days before the clock), null if not yet (chapter 1).
  rafaelChanged?: number | null;
  // The chapter's own files in the player's profile on register (Documents included).
  home?: (t: Translate) => Record<string, Node>;
  // stacks' scheduled tasks (the scan import, by default Rafael's).
  tasks?: (t: Translate) => WinTask[];
  // stacks' Task Scheduler history.
  taskHistory?: boolean;
  // Chapter 2 done: the scan import runs as svc_scans.
  scansFixed?: boolean;
  // Chapter 3 done: Events Drive linked to OU=Branches, applied to GG_Children and GG_Management.
  eventsFixed?: boolean;
  // Who is logged on to which workstation (gpresult /s), since when (ms).
  sessions?: { computer: string; user: string; logon: number }[];
  // Local firewall rules of stacks besides the defaults.
  stacksRules?: FwRule[];
}

// Last logons fixed in time (the others: the day before the chapter).
const LAST_LOGON: Record<string, number> = {
  lhassan: Date.UTC(2029, 11, 17, 17, 2, 0),
  ychen: Date.UTC(2029, 7, 26, 16, 40, 0),
  pmorel: Date.UTC(2029, 5, 6, 11, 15, 0),
  oadeyemi: Date.UTC(2029, 4, 31, 17, 30, 0),
  svc_backup: OFFSITE_LAST,
  mrossi: Date.UTC(2029, 11, 30, 17, 10, 0),
};

const users = (o: CatalogueOptions): AdUserSpec[] =>
  [...STAFF, ...(o.arrivals ? [KOFI] : [])].map((u) => {
    const at = LAST_LOGON[u.sam];
    if (at !== undefined && at < o.clock) u = { ...u, lastLogon: since(o, at) };
    if (u.sam === 'mrossi' && o.arrivals) return { ...u, ou: 'Leavers', enabled: false, groups: [], description: 'Left 2030-01-04', lastLogon: since(o, Date.UTC(2030, 0, 4, 15, 50, 0)) };
    if (u.sam === 'rsilva' && o.rafaelChanged != null) return { ...u, password: RAFAEL_NEW, passwordAge: o.rafaelChanged };
    // The scan import runs as svc_scans every 5 minutes since chapter 2: its last logon is a few minutes old.
    if (u.sam === 'svc_scans' && o.scansFixed) return { ...u, lastLogon: 4 / (24 * 60) };
    return u;
  });

/** The domain, as the story declares it. */
export function domainSpec(t: Translate, o: CatalogueOptions): Omit<DomainSpec, 'dc'> {
  return {
    dns: DNS,
    netbios: NETBIOS,
    ous: [
      { path: 'Branches', description: 'The network\'s three libraries' },
      { path: 'Branches/Central', description: 'Central Library' },
      { path: 'Branches/Riverside', description: 'Riverside branch' },
      { path: 'Branches/Hilltop', description: 'Hilltop branch' },
      { path: 'Groups', description: 'GG_ by department, DL_ by share (AGDLP)' },
      { path: 'Leavers', description: 'Disabled accounts of people who left, kept 12 months' },
      { path: 'Servers' },
      { path: 'Service Accounts' },
      { path: 'Workstations' },
      { path: 'Workstations/Central' },
      { path: 'Workstations/Riverside' },
      { path: 'Workstations/Hilltop' },
      { path: 'Workstations/Kiosks', description: 'Public catalogue kiosks' },
    ],
    users: users(o),
    groups: [
      { name: 'GG_Lending', ou: 'Groups', description: 'Lending desk staff, all branches' },
      { name: 'GG_Children', ou: 'Groups', description: 'Children\'s library staff, all branches' },
      { name: 'GG_LocalHistory', ou: 'Groups', description: 'Local history and archives staff' },
      { name: 'GG_Management', ou: 'Groups', description: 'Director and branch managers' },
      { name: 'DL_Staff_RW', ou: 'Groups', scope: 'DomainLocal', members: ['GG_Lending', 'GG_Children', 'GG_LocalHistory', 'GG_Management'], description: '\\\\stacks\\Staff: modify' },
      { name: 'DL_Events_RW', ou: 'Groups', scope: 'DomainLocal', members: ['GG_Children', 'GG_Management'], description: '\\\\stacks\\Events: modify' },
      { name: 'DL_Archives_RW', ou: 'Groups', scope: 'DomainLocal', members: ['GG_LocalHistory'], description: '\\\\stacks\\Archives: modify' },
      { name: 'DL_Archives_RO', ou: 'Groups', scope: 'DomainLocal', members: ['GG_Lending', 'GG_Children'], description: '\\\\stacks\\Archives: read' },
      { name: 'DL_Finance_RW', ou: 'Groups', scope: 'DomainLocal', members: ['GG_Management'], description: '\\\\stacks\\Finance: modify' },
    ],
    computers: [
      { name: stacksName(t), ou: 'Servers', address: STACKS },
      { name: 'CENTRAL-DESK1', ou: 'Workstations/Central', os: 'Windows 11 Pro' },
      { name: 'CENTRAL-DESK2', ou: 'Workstations/Central', os: 'Windows 11 Pro' },
      { name: 'RIVER-DESK1', ou: 'Workstations/Riverside', os: 'Windows 11 Pro' },
      { name: 'HILL-DESK1', ou: 'Workstations/Hilltop', os: 'Windows 11 Pro' },
      { name: 'HILL-DESK2', ou: 'Workstations/Hilltop', os: 'Windows 11 Pro' },
      // The public catalogue kiosks, on the same network as the staff (192.0.2.0/24).
      { name: 'KIOSK-CENTRAL', ou: 'Workstations/Kiosks', os: 'Windows 11 Pro', address: KIOSK },
      { name: 'KIOSK-RIVER', ou: 'Workstations/Kiosks', os: 'Windows 11 Pro', address: '192.0.2.211' },
    ],
    // Tomas turned the AD Recycle Bin on when he built the domain.
    recycleBin: 400,
    sessions: o.sessions,
    // The Default Domain Policy: 10 characters, complexity, 90 days; locked after 5 wrong passwords for 30 minutes.
    policy: { minLength: 10, maxAge: 90, threshold: 5, duration: 30, window: 30 },
    gpos: [
      { name: 'Staff Drives', description: 'S: for every member of staff', settings: [{ kind: 'driveMap', letter: 'S', path: `\\\\${machineName(t, 'stacks')}\\Staff`, label: 'Staff' }], links: [{ target: 'Branches' }] },
      { name: 'Archives Drive', description: 'A: for local history', settings: [{ kind: 'driveMap', letter: 'A', path: `\\\\${machineName(t, 'stacks')}\\Archives`, label: 'Archives' }], links: [{ target: 'Branches' }], apply: ['GG_LocalHistory'] },
      // Chapter 3: linked to OU=Central only, where Tomas tested it with the children's team, and
      // filtered to GG_Children only; meant for every branch, managers too (as DL_Events_RW).
      {
        name: 'Events Drive',
        description: 'E: for children\'s staff and managers, every branch',
        settings: [{ kind: 'driveMap', letter: 'E', path: `\\\\${machineName(t, 'stacks')}\\Events`, label: 'Events' }],
        links: [{ target: o.eventsFixed ? 'Branches' : 'Branches/Central' }],
        apply: o.eventsFixed ? ['GG_Children', 'GG_Management'] : ['GG_Children'],
      },
      {
        name: 'Server Firewall',
        description: 'SMB and ping from the libraries\' network',
        settings: [
          { kind: 'firewallRule', display: 'Allow SMB from the libraries', protocol: 'TCP', localPort: ['445'], remoteAddress: ['192.0.2.0/24'], action: 'Allow' },
          { kind: 'firewallRule', display: 'Allow ping from the libraries', protocol: 'ICMPv4', localPort: ['Any'], remoteAddress: ['192.0.2.0/24'], action: 'Allow' },
        ],
        links: [{ target: 'Servers' }],
      },
    ],
  };
}

const NETWORK = (address: string) => ({ address, mask: '255.255.255.0', gateway: '192.0.2.1', dns: ADDRESS, suffix: DNS });

/** register's options, in the language (player, computer's name). */
export function registerOptions(t: Translate, o: CatalogueOptions): WindowsOptions {
  return {
    computer: dcName(t),
    player: player(t),
    password: PLAYER_PASSWORD,
    clock: o.clock,
    network: NETWORK(ADDRESS),
    volumes: [{ letter: 'C', label: '', size: Math.round(126.4 * GIB), base: Math.round(23.9 * GIB) }],
    events: quietEvents(o.clock),
  };
}

const ace = (id: string, mask: number, inherit = true): NtfsAce => ({ id, mask, ...(inherit ? { oi: true, ci: true } : {}) });
const SYSTEM_ADMINS = [ace('NT AUTHORITY\\SYSTEM', FULL), ace('BUILTIN\\Administrators', FULL)];
const file = (content: string, mtime: number, size?: number): File => ({ type: 'file', content, lines: true, mtime, ...(size !== undefined ? { size: Math.round(size) } : {}) });
const binary = (size: number, mtime: number): File => ({ type: 'file', content: '(binary)', size: Math.round(size), mtime });
const dir = (children: Record<string, Node> = {}, acl?: Directory['acl']): Directory => ({ type: 'directory', children, ...(acl ? { acl } : {}) });
const crlf = (text: string) => text.replace(/\n/g, '\r\n');

/** The game's key for register (the workstation's), and your key on register for stacks. */
export const STACKS_KEY = generateKey('card-catalogue-register', 'you@register');

/** The player's profile on register: Tomas's handover, the conventions, the chapter's files. */
function profileFiles(t: Translate, o: CatalogueOptions): Record<string, Node> {
  const docs: Record<string, Node> = {
    'handover.txt': file(crlf(t('card-catalogue-handover')), Date.UTC(2029, 11, 20, 17, 30, 0)),
    'conventions.txt': file(crlf(t('card-catalogue-conventions')), Date.UTC(2029, 11, 20, 17, 25, 0)),
  };
  const own = { ...(o.home?.(t) ?? {}) };
  const documents = own.Documents;
  delete own.Documents;
  return {
    ...own,
    Documents: dir({ ...docs, ...(documents?.type === 'directory' ? documents.children : {}) }),
    // Your key for stacks (Windows' OpenSSH client reads %USERPROFILE%\.ssh).
    '.ssh': dir({ id_ed25519: { ...file(STACKS_KEY.isPrivate, Date.UTC(2029, 11, 20, 17, 0, 0)), mode: 'rw-------' }, 'id_ed25519.pub': file(STACKS_KEY.isPublic, Date.UTC(2029, 11, 20, 17, 0, 0)) }),
  };
}

/** register: the domain controller, as a chapter declares it (home, accounts, state, world). */
export function register(o: CatalogueOptions) {
  const dc = (t: Translate) =>
    domainController(registerOptions(t, o), domainSpec(t, o), {
      C: (c) => {
        const programData = c.children.ProgramData;
        // The game's key for register, authorised for its administrators.
        const ssh = programData?.type === 'directory' ? programData.children.ssh : undefined;
        const m = storyMachine(STORY);
        if (ssh?.type === 'directory' && m) ssh.children.administrators_authorized_keys = file(`${publicFor(privateKey(m))} ${player(t)}@${machineName(t, WORKSTATION.name)}`, Date.UTC(2029, 11, 20, 17, 0, 0));
        const usersDir = c.children.Users;
        const mine = usersDir?.type === 'directory' ? usersDir.children[player(t)] : undefined;
        if (mine?.type === 'directory') Object.assign(mine.children, profileFiles(t, o));
      },
    });
  return {
    home: HOME,
    // The accounts in English: the game translates "you" (vous in French).
    accounts: (): Accounts => windowsAccounts({ computer: 'REGISTER', player: 'you', password: PLAYER_PASSWORD, clock: o.clock, domain: { dns: DNS, netbios: NETBIOS, dc: '', role: 'dc' } })(),
    state: (t: Translate) => dc(t).state(),
    createWorld: (t: Translate): Directory => dc(t).createWorld(),
  };
}

// ——— stacks: the member file server ———

/** The scan import, as Tomas set it up with Rafael in September: under Rafael's own account, every 5 minutes. */
export const scanTask = (): WinTask => ({
  path: '\\',
  name: 'Scan Import',
  state: 'Ready',
  author: `${NETBIOS}\\tnovak`,
  description: 'Moves the archive scanner\'s PDFs from D:\\Scans into the Archives share.',
  user: `${NETBIOS}\\rsilva`,
  logon: 'Password',
  password: RAFAEL_OLD,
  actions: [{ execute: 'C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe', arguments: '-NoProfile -File C:\\Scripts\\scan-import.ps1' }],
  // Every day at 7:00, then every 5 minutes for 12 hours.
  triggers: [{ kind: 'Daily', start: Date.UTC(2029, 8, 3, 7, 0, 0), repeat: 5 * MIN, duration: 12 * H }],
  lastResult: 0,
  // The script moves what the scanner dropped (the game keeps no trace of each file).
  run: () => 0,
});

/** The offsite copy: the Archives to the removable disk Nandini takes to the city hall's vault, twice a year, as svc_backup. */
export const offsiteTask = (): WinTask => ({
  path: '\\',
  name: 'Offsite Copy',
  state: 'Ready',
  author: `${NETBIOS}\\tnovak`,
  description: 'Copies the Archives share to the offsite disk (E:), 1 April and 1 October.',
  user: `${NETBIOS}\\svc_backup`,
  logon: 'Password',
  password: BACKUP_PASSWORD,
  actions: [{ execute: 'C:\\Windows\\System32\\Robocopy.exe', arguments: 'D:\\Shares\\Archives E:\\Archives /MIR /R:2 /LOG:C:\\Scripts\\offsite.log' }],
  // Every 182 days from 1 October 2029, 3:00 (the next: 1 April 2030).
  triggers: [{ kind: 'Daily', start: OFFSITE_LAST, every: 182 }],
  lastRun: OFFSITE_LAST,
  lastResult: 0,
  run: () => 0,
});

/** The scan import after chapter 2: as svc_scans. */
export const scanTaskFixed = (): WinTask => ({ ...scanTask(), user: `${NETBIOS}\\svc_scans`, password: SCANS_PASSWORD });

export const SCAN_SCRIPT = [
  '# Scan import - Tomas, September 2029',
  '# The archive scanner drops PDFs in D:\\Scans; they go to the Archives share.',
  'Move-Item D:\\Scans\\*.pdf D:\\Shares\\Archives\\Incoming -Force',
].join('\r\n');

/** stacks' options, in the language. */
export function stacksOptions(t: Translate, o: CatalogueOptions): WindowsOptions {
  const share = (name: string, description: string): WinShare => ({ name, path: `D:\\Shares\\${name}`, description, change: [], access: [{ account: 'NT AUTHORITY\\Authenticated Users', right: 'Change' }, { account: 'BUILTIN\\Administrators', right: 'Full' }] });
  return {
    computer: stacksName(t),
    player: player(t),
    password: PLAYER_PASSWORD,
    clock: o.clock,
    network: NETWORK(STACKS),
    domain: { dns: DNS, netbios: NETBIOS, dc: 'register', ou: ou('Servers') },
    volumes: [
      { letter: 'C', label: '', size: Math.round(126.4 * GIB), base: Math.round(22.1 * GIB) },
      { letter: 'D', label: 'Data', size: 1000 * GIB, base: Math.round(312 * GIB) },
    ],
    shares: [share('Staff', 'Everyone\'s documents'), share('Events', 'Story times, workshops, posters'), share('Archives', 'Local history: scans and finding aids'), share('Finance', 'Budgets and invoices'), share('Scans', 'Archive scanner drop folder')],
    tasks: o.tasks?.(t) ?? [o.scansFixed ? scanTaskFixed() : scanTask(), offsiteTask()],
    firewallRules: o.stacksRules,
    taskHistory: o.taskHistory ?? true,
    events: quietEvents(o.clock),
  };
}

/** The shares' folders on stacks, with their NTFS permissions: domain local groups only (AGDLP). */
function stacksData(o: CatalogueOptions): Record<string, Node> {
  const ago = (days: number) => o.clock - days * DAY;
  const dl = (g: string, mask = MODIFY) => ace(`${NETBIOS}\\${g}`, mask);
  const own = (children: Record<string, Node>, aces: NtfsAce[]) => dir(children, { protected: true, aces: [...SYSTEM_ADMINS, ...aces, ace(`${NETBIOS}\\svc_backup`, READ_EXECUTE)] });
  return {
    Shares: dir(
      {
        Staff: own({ 'rota-january.xlsx': binary(48 * KIB, ago(6)), 'opening-hours-2030.pdf': binary(220 * KIB, ago(20)) }, [dl('DL_Staff_RW')]),
        Events: own({ 'story-time-posters': dir({ 'january.pdf': binary(1.4 * MIB, ago(15)) }), 'workshops-2030.docx': binary(64 * KIB, ago(9)) }, [dl('DL_Events_RW')]),
        Archives: own({ Incoming: dir({ 'parish-register-1882-p014.pdf': binary(3.2 * MIB, ago(8)) }), 'finding-aid-mills.docx': binary(88 * KIB, ago(40)) }, [dl('DL_Archives_RW'), dl('DL_Archives_RO', READ_EXECUTE)]),
        Finance: own({ 'budget-2030.xlsx': binary(130 * KIB, ago(3)), 'invoices-q4.xlsx': binary(95 * KIB, ago(12)) }, [dl('DL_Finance_RW')]),
        Scans: own({}, [dl('DL_Archives_RW')]),
      },
      { protected: true, aces: [...SYSTEM_ADMINS, ace('BUILTIN\\Users', READ_EXECUTE, false)] },
    ),
  };
}

/** stacks as an internal host of the story (reached from register: ssh stacks). */
export function stacksHost(o: CatalogueOptions): InternalHost {
  const machine = (t: Translate) =>
    windowsMachine(stacksOptions(t, o), {
      C: (c) => {
        c.children.Scripts = dir({ 'scan-import.ps1': file(SCAN_SCRIPT, Date.UTC(2029, 8, 2, 16, 0, 0)) }, { protected: true, aces: [...SYSTEM_ADMINS, ace(`${NETBIOS}\\DL_Archives_RW`, READ_EXECUTE)] });
        const programData = c.children.ProgramData;
        const ssh = programData?.type === 'directory' ? programData.children.ssh : undefined;
        if (ssh?.type === 'directory') ssh.children.administrators_authorized_keys = file(STACKS_KEY.isPublic, Date.UTC(2029, 11, 20, 17, 0, 0));
      },
      D: stacksData(o),
    });
  return {
    address: STACKS,
    domain: `stacks.${DNS}`,
    home: HOME,
    accounts: (): Accounts => windowsAccounts({ computer: 'STACKS', player: 'you', password: PLAYER_PASSWORD, clock: o.clock, domain: { dns: DNS, netbios: NETBIOS, dc: 'register' } })(),
    state: (t: Translate) => windowsState(stacksOptions(t, o)),
    createWorld: (t: Translate) => machine(t).createWorld(),
  };
}

// ——— The event logs ———

export const event = (time: number, id: number, level: WinEvent['level'], provider: string, message: string): WinEvent => ({ time, id, level, provider, message });
const scm = (time: number, service: string, state: string) => event(time, 7036, 'Information', 'Service Control Manager', `The ${service} service entered the ${state} state.`);

/** A quiet server's System log over the last days. */
export function quietEvents(until: number): WinEvent[] {
  const out: WinEvent[] = [];
  const start = until - (until % DAY) - 4 * DAY;
  for (let day = start; day < until; day += DAY) out.push(scm(day + 3 * H, 'Windows Update', 'running'), scm(day + 3 * H + 240_000, 'Windows Update', 'stopped'));
  return out.filter((e) => e.time < until);
}

// ——— What the chapters' events read ———

/** The domain (on register). */
export const ad = (j: Game) => domainOf(j)!.ad;
/** An account or group of the domain, by sAMAccountName. */
export const object = (j: Game, sam: string): AdObject | undefined => findIdentity(ad(j), sam);
/** The domain's clock (register's). */
export const now = (j: Game) => windows(j).clock;

/** The groups an account is directly in (its primary group, Domain Users, aside), by name. */
export function directGroupNames(j: Game, o: AdObject): string[] {
  return ad(j)
    .objects.filter((g) => g.cls === 'group' && (g.members ?? []).some((m) => m.toLowerCase() === o.dn.toLowerCase()))
    .map((g) => g.name);
}

/** stacks' session (created on the first connection, or by a chapter's initialise). */
export const stacks = (j: Game) => (j as Shell).principal.internal('stacks')!;

/** Lets time pass on the domain, minute by minute: register's clock, and stacks' tasks running. */
export function passMinutes(j: Game, end: number): void {
  const dc = (j as Shell).principal;
  const s = stacks(j);
  for (let t = Math.ceil((windows(dc).clock + 1) / MIN) * MIN; t <= end; t += MIN) {
    windows(dc).clock = t;
    advanceWindows(s, t);
  }
  windows(dc).clock = Math.max(windows(dc).clock, end);
  windows(s).clock = Math.max(windows(s).clock, end);
}

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
export const said = (j: Game, text: string | RegExp) => [j.last.output, ...j.last.errors].some((x) => (typeof text === 'string' ? x.includes(text) : text.test(x)));

/** stacks' session if something was typed there (an internal host: its own last line). */
export const onStacks = (j: Game): Shell | null => {
  const s = (j as Shell).principal.internal('stacks');
  return s && s.typedCommands > 0 ? s : null;
};
/** What was last typed on stacks said this. */
export const stacksSaid = (j: Game, x: string | RegExp) => {
  const s = onStacks(j);
  return !!s && [s.last.output, ...s.last.errors].some((o) => (typeof x === 'string' ? o.includes(x) : x.test(o)));
};
/** What was last typed on stacks ran one of these cmdlets or programs. */
export const stacksRan = (j: Game, ...names: string[]) => {
  const s = onStacks(j);
  return !!s && ran(s, ...names);
};
