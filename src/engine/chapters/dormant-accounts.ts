// Story "The Card Catalogue" — chapter "Doors and Dormant Accounts": the
// city's IT security team runs a scan of the libraries' public address
// every quarter, and an audit of the accounts once a year. This time the
// scan found Remote Desktop open (the router still forwards TCP 3389 to
// stacks, since Tomas worked from home in 2028), and the audit asks for
// the accounts nobody used for 90 days: disabled, in Leavers, out of
// their groups, and a CSV report for the auditors.
//   - ssh stacks; Get-NetFirewallRule -Enabled True -Direction Inbound |
//     Where-Object DisplayName -like '*Remote*' (or Get-NetFirewallPortFilter
//     | Where-Object LocalPort -eq 3389 | Get-NetFirewallRule),
//     Get-NetFirewallAddressFilter: "Remote Desktop - Any", RemoteAddress
//     Any, every profile;
//   - nobody uses Remote Desktop any more (you come in with ssh):
//     Disable-NetFirewallRule -DisplayName 'Remote Desktop - Any' (or
//     Remove-NetFirewallRule), or narrowed to your workstation:
//     Set-NetFirewallRule … -RemoteAddress 192.0.2.2;
//   - on register: Search-ADAccount -AccountInactive -TimeSpan
//     90.00:00:00 -UsersOnly: Guest and krbtgt (built-in, disabled), ychen
//     and pmorel (staff), oadeyemi (a leaver of May, still in his
//     groups), svc_backup (the offsite copy runs twice a year: its last
//     logon is from October, and it is needed again on 1 April);
//   - -SearchBase 'OU=Branches,…' keeps the people; a function or a loop:
//     Disable-ADAccount, the groups but Domain Users removed, Move-ADObject
//     to OU=Leavers; Select-Object … | Export-Csv … -NoTypeInformation;
//   - Remove-ADPrincipalGroupMembership oadeyemi -MemberOf GG_Lending,
//     DL_Staff_RW.
// Objective checked on the state: from a public address and from a kiosk,
// stacks refuses TCP 3389; register still reaches stacks' ssh; every
// firewall profile on; ychen and pmorel disabled, in OU=Leavers, in no
// group but Domain Users; oadeyemi in no group; every other account as it
// was (enabled, its OU, its groups: the active people, the service
// accounts, the built-in accounts), none deleted; a CSV file on register
// (Import-Csv reads it) with a row for ychen and one for pmorel, and none
// for an active person.
// False leads: turning a firewall profile off, cutting your own ssh
// (stacks' OpenSSH rule removed or narrowed away from register), the
// rule narrowed to the whole network (LocalSubnet, 192.0.2.0/24: the
// kiosks are on it), -TimeSpan too short (Leila, on leave since December,
// would be closed), disabling svc_backup (the April copy would fail),
// moving the built-in accounts, deleting accounts.
// Sources (Microsoft Learn): Search-ADAccount
// (https://learn.microsoft.com/powershell/module/activedirectory/search-adaccount),
// "Understanding the AD Account attributes - LastLogonTimeStamp"
// (https://learn.microsoft.com/archive/blogs/askds/the-lastlogontimestamp-attribute-what-it-was-designed-for-and-how-it-works),
// Export-Csv (https://learn.microsoft.com/powershell/module/microsoft.powershell.utility/export-csv?view=powershell-5.1),
// Set-NetFirewallRule (https://learn.microsoft.com/powershell/module/netsecurity/set-netfirewallrule),
// "Securing Remote Desktop" (https://learn.microsoft.com/windows-server/remote/remote-desktop-services/rds-plan-access-from-anywhere).

import { type Chapter, type Directory, type Node } from '../world';
import type { Game, Shell } from '../shell';
import { firewall, firewallAllows, PROFILES, type FwRule } from '../windows-firewall';
import { below, parentDn, sameDn, type AdObject } from '../windows-ad';
import { applyPolicy } from '../windows-gpo';
import { csvObjects } from '../commands/windows-files';
import { ADDRESS, HOME, KIOSK, ad, directGroupNames, object, ou, ran, register, said, stacks, stacksHost, stacksRan, stacksSaid } from './card-catalogue';

// Monday 28 January 2030, 9:40.
export const NOW = Date.UTC(2030, 0, 28, 9, 40, 0);
const MIN = 60_000;
const DAY = 86_400_000;
// The city's scanner, from the Internet (through the router's port forward), and your workstation.
export const SCANNER = '198.51.100.77';
export const ADMIN_DESK = '192.0.2.2';
// The two staff accounts nobody used for 90 days.
export const DORMANT = ['ychen', 'pmorel'];
const LEAVER = 'oadeyemi';

/** The rule Tomas added in 2028 to work from home. */
export const RDP_ANY: FwRule = {
  name: '{8f3b2c71-5d0e-4a6b-9c1f-2e7d4a9b6c30}',
  display: 'Remote Desktop - Any',
  group: '',
  description: 'Tomas, 2028: RDP from home (the router forwards 3389)',
  enabled: true,
  direction: 'Inbound',
  action: 'Allow',
  profiles: [...PROFILES],
  protocol: 'TCP',
  localPort: ['3389'],
  remotePort: ['Any'],
  remoteAddress: ['Any'],
};

const text = (content: string, mtime: number) => ({ type: 'file' as const, content: content.replace(/\n/g, '\r\n'), lines: true, mtime });

const options = { clock: NOW, arrivals: true, rafaelChanged: (NOW - Date.UTC(2030, 0, 7, 8, 52, 0)) / DAY, scansFixed: true, eventsFixed: true, stacksRules: [RDP_ANY] };
const machine = register({
  ...options,
  home: (t) => ({
    'email_nandini.txt': text(t('dormant-accounts-email-nandini'), NOW - 20 * MIN),
    Documents: { type: 'directory', children: { 'city-it-audit.txt': text(t('dormant-accounts-audit', { scanner: SCANNER }), NOW - 3 * DAY) } },
  }),
});

// ——— The door ———

const fw = (j: Game) => firewall(stacks(j));
const rdpFrom = (j: Game, address: string) => firewallAllows(stacks(j), { protocol: 'TCP', port: 3389, remote: address });
const profilesOn = (j: Game) => PROFILES.every((p) => fw(j).profiles[p].enabled);
/** register still reaches stacks' OpenSSH (your way in). */
const sshKept = (j: Game) => firewallAllows(stacks(j), { protocol: 'TCP', port: 22, remote: ADDRESS });
const doorClosed = (j: Game) => !rdpFrom(j, SCANNER) && !rdpFrom(j, KIOSK) && profilesOn(j);

// ——— The accounts ———

interface Snapshot {
  dn: string;
  enabled: boolean;
  groups: string[];
}
const users = (j: Game) => ad(j).objects.filter((o) => o.cls === 'user');
const groupsOf = (j: Game, o: AdObject) => directGroupNames(j, o).map((g) => g.toLowerCase()).sort();
const snapshot = (j: Game) => j.state.accounts as Record<string, Snapshot>;
const leavers = ou('Leavers');
const inLeavers = (o: AdObject) => sameDn(parentDn(o.dn), leavers);
const closed = (j: Game, sam: string) => {
  const o = object(j, sam);
  return !!o && o.enabled === false && inLeavers(o) && groupsOf(j, o).length === 0;
};
/** An account that must stay as it was (not dormant, not the leaver): its DN, its state, its groups. */
const kept = (j: Game, sam: string) => {
  const o = object(j, sam);
  const was = snapshot(j)[sam];
  return !!o && sameDn(o.dn, was.dn) && (o.enabled !== false) === was.enabled && groupsOf(j, o).join() === was.groups.join();
};
const others = (j: Game) => Object.keys(snapshot(j)).filter((sam) => !DORMANT.includes(sam) && sam !== LEAVER);
const changed = (j: Game) => others(j).filter((sam) => !kept(j, sam));
const missing = (j: Game) => Object.keys(snapshot(j)).filter((sam) => !object(j, sam));
const isService = (sam: string) => /^svc_/i.test(sam);
const isBuiltin = (j: Game, sam: string) => !below(snapshot(j)[sam].dn, ou('Branches')) && !isService(sam) && !below(snapshot(j)[sam].dn, leavers);
/** People of the branches (enabled, not dormant): those a too short -TimeSpan would catch. */
const activePeople = (j: Game) => others(j).filter((sam) => below(snapshot(j)[sam].dn, ou('Branches')) && snapshot(j)[sam].enabled);
const dormantClosed = (j: Game) => DORMANT.every((sam) => closed(j, sam));
const leaverClean = (j: Game) => {
  const o = object(j, LEAVER);
  return !!o && groupsOf(j, o).length === 0 && o.enabled === false && inLeavers(o);
};

// ——— The report ———

/** Every CSV file on register's C: (outside Windows), with its rows. */
function reports(j: Game): { path: string; rows: Record<string, unknown>[] }[] {
  const out: { path: string; rows: Record<string, unknown>[] }[] = [];
  const walk = (d: Directory, path: string) => {
    for (const [name, n] of Object.entries(d.children) as [string, Node][]) {
      if (n.type === 'directory' && !(path === '/C' && /^(windows|program files|programdata)$/i.test(name))) walk(n, `${path}/${name}`);
      else if (n.type === 'file' && /\.csv$/i.test(name)) out.push({ path: `${path}/${name}`, rows: csvObjects((j as Shell).read(`${path}/${name}`) ?? '').map((o) => o.props) });
    }
  };
  const c = j.find('/C');
  if (c?.type === 'directory') walk(c, '/C');
  return out;
}
/** Does a row name this account (its sAMAccountName, its name, its DN)? */
const names = (j: Game, row: Record<string, unknown>, sam: string) => {
  const o = object(j, sam);
  const ids = [sam, o?.name, o?.upn].filter(Boolean).map((x) => String(x).toLowerCase());
  return Object.values(row).some((v) => {
    const t = String(v ?? '').toLowerCase();
    return ids.includes(t) || (!!o && t.startsWith(`cn=${o.name.toLowerCase()},`));
  });
};
const goodReport = (j: Game) => reports(j).some((r) => DORMANT.every((sam) => r.rows.some((row) => names(j, row, sam))) && !activePeople(j).some((sam) => r.rows.some((row) => names(j, row, sam))));
const reportWithActive = (j: Game) => reports(j).some((r) => activePeople(j).some((sam) => r.rows.some((row) => names(j, row, sam))));

const accountsDone = (j: Game) => dormantClosed(j) && leaverClean(j) && changed(j).length === 0 && missing(j).length === 0;

export const COMMANDS_DORMANT_ACCOUNTS = [
  'ssh', 'Get-NetFirewallRule', 'Get-NetFirewallAddressFilter', 'Get-NetFirewallPortFilter', 'Set-NetFirewallRule', 'Disable-NetFirewallRule', 'Search-ADAccount',
  'Get-ADUser', 'Disable-ADAccount', 'Get-ADPrincipalGroupMembership', 'Remove-ADPrincipalGroupMembership', 'Move-ADObject', 'Export-Csv', 'Import-Csv', 'Select-Object',
  'ForEach-Object', 'Get-ScheduledTask', 'exit', 'Get-Help',
];

export const dormantAccounts: Chapter = {
  id: 'dormant-accounts',
  number: 4,
  commands: COMMANDS_DORMANT_ACCOUNTS,
  home: HOME,
  welcome: 'email_nandini.txt',
  names: true,
  final: 'end',
  steps: ['rdp-found', 'rdp-closed', 'inactive', 'service-account', 'closed', 'leftover', 'report', 'end'],
  accounts: machine.accounts,
  state: machine.state,
  createWorld: machine.createWorld,
  hosts: { stacks: stacksHost(options) },
  // The accounts as they are this morning, to tell what the audit changed.
  initialise: (j) => {
    j.state.accounts = Object.fromEntries(users(j).map((o) => [o.sam!, { dn: o.dn, enabled: o.enabled !== false, groups: groupsOf(j, o) } satisfies Snapshot]));
  },
  // Locked out of stacks: a rule the servers' firewall GPO gives (New-NetFirewallRule -PolicyStore
  // 'lending.internal\Server Firewall') reaches stacks at its next background refresh (90 minutes).
  afterCommand: (j) => {
    if (!j.flags.has('ssh-cut') || sshKept(j)) return;
    const s = stacks(j);
    const before = { rules: fw(j).rules.map((r) => ({ ...r })), profiles: JSON.parse(JSON.stringify(fw(j).profiles)) };
    applyPolicy(s, 'computer');
    if (sshKept(j)) return j.t('dormant-accounts-gpo-refresh');
    fw(j).rules = before.rules;
    fw(j).profiles = before.profiles;
  },
  events: [
    { id: 'rdp-found', condition: (j) => stacksRan(j, 'Get-NetFirewallRule', 'Get-NetFirewallAddressFilter', 'Get-NetFirewallPortFilter', 'netsh') && stacksSaid(j, 'Remote Desktop - Any'), message: (j) => j.t('dormant-accounts-event-rdp-found') },
    { id: 'profile-off', condition: (j) => !profilesOn(j), message: (j) => j.t('dormant-accounts-event-profile-off') },
    { id: 'ssh-cut', condition: (j) => !sshKept(j), message: (j) => j.t('dormant-accounts-event-ssh-cut') },
    { id: 'lan-wide', condition: (j) => !rdpFrom(j, SCANNER) && rdpFrom(j, KIOSK), message: (j) => j.t('dormant-accounts-event-lan-wide', { kiosk: KIOSK }) },
    { id: 'rdp-closed', condition: (j) => doorClosed(j) && sshKept(j), message: (j) => j.t(rdpFrom(j, ADMIN_DESK) ? 'dormant-accounts-event-rdp-narrowed' : 'dormant-accounts-event-rdp-closed') },
    {
      id: 'inactive',
      condition: (j) => ran(j, 'Search-ADAccount', 'Get-ADUser') && DORMANT.every((sam) => said(j, sam) || said(j, object(j, sam)?.name ?? sam)),
      message: (j) => j.t('dormant-accounts-event-inactive'),
    },
    { id: 'too-short', condition: (j) => ran(j, 'Search-ADAccount') && /AccountInactive/i.test(j.last.line) && said(j, 'lhassan'), message: (j) => j.t('dormant-accounts-event-too-short') },
    {
      id: 'service-account',
      condition: (j) => (ran(j, 'Get-ADUser') && said(j, 'Offsite copy of the Archives')) || (stacksRan(j, 'Get-ScheduledTask', 'schtasks') && stacksSaid(j, 'Offsite Copy') && stacksSaid(j, 'svc_backup')),
      message: (j) => j.t('dormant-accounts-event-service-account'),
    },
    {
      id: 'service-touched',
      condition: (j) => changed(j).some(isService),
      message: (j) => j.t('dormant-accounts-event-service-touched'),
    },
    { id: 'builtin-touched', condition: (j) => changed(j).some((sam) => isBuiltin(j, sam)), message: (j) => j.t('dormant-accounts-event-builtin-touched') },
    { id: 'active-touched', condition: (j) => changed(j).some((sam) => activePeople(j).includes(sam)), message: (j) => j.t('dormant-accounts-event-active-touched', { accounts: changed(j).filter((sam) => activePeople(j).includes(sam)).join(', ') }) },
    { id: 'deleted', condition: (j) => missing(j).length > 0, message: (j) => j.t('dormant-accounts-event-deleted', { accounts: missing(j).join(', ') }) },
    { id: 'closed', condition: dormantClosed, message: (j) => j.t('dormant-accounts-event-closed') },
    { id: 'leftover-seen', condition: (j) => ran(j, 'Get-ADPrincipalGroupMembership', 'Get-ADUser') && /oadeyemi/i.test(j.last.line) && said(j, /GG_Lending|DL_Staff_RW/), message: (j) => j.t('dormant-accounts-event-leftover-seen') },
    { id: 'leftover', condition: leaverClean, message: (j) => j.t('dormant-accounts-event-leftover') },
    { id: 'report-active', condition: reportWithActive, message: (j) => j.t('dormant-accounts-event-report-active') },
    { id: 'report', condition: goodReport, message: (j) => j.t('dormant-accounts-event-report') },
    { id: 'end', condition: (j) => doorClosed(j) && sshKept(j) && accountsDone(j) && goodReport(j), message: (j) => j.t('dormant-accounts-event-end') },
  ],
};
