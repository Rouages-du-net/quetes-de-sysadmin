// Story "The Card Catalogue" — chapter "The Policy That Doesn't Apply":
// Monday morning, the posters for the spring story times are on the
// Events share, and half the people who need them have no E: drive.
// Josephine (Hilltop) and Kofi (Riverside) don't have it; at Central,
// Nandini doesn't either, though the children's team does. The drive
// comes from the GPO "Events Drive", which Tomas tested at Central with
// the children's team:
//   - gpresult on register only knows register's own logons ("does not
//     have RSoP data"): gpresult /s HILL-DESK1 /user LENDING\jbaptiste /r
//     reads what was applied on Josephine's workstation (or
//     Get-GPResultantSetOfPolicy -Computer … -User … -ReportType Html):
//     Events Drive is neither applied nor filtered out: no link reaches
//     her OU;
//   - Get-GPInheritance -Target 'OU=Hilltop,OU=Branches,…' (Staff Drives,
//     Archives Drive inherited, no Events Drive), Get-GPOReport 'Events
//     Drive' -ReportType Xml (LinksTo: Central only);
//   - the fix of the first layer: New-GPLink 'Events Drive' -Target
//     'OU=Branches,DC=lending,DC=internal' (and Remove-GPLink from
//     Central), or a link on each branch's OU;
//   - gpresult /s CENTRAL-DESK1 /user LENDING\nmukherjee /r: Events Drive
//     "Filtering: Denied (Security)": Get-GPPermission 'Events Drive' -All:
//     GpoApply for GG_Children only, while DL_Events_RW (the share) holds
//     GG_Children and GG_Management;
//   - the second layer: Set-GPPermission 'Events Drive' -TargetName
//     GG_Management -TargetType Group -PermissionLevel GpoApply (or the
//     share's group, DL_Events_RW);
//   - Invoke-GPUpdate -Computer HILL-DESK1 -Target User (gpupdate /force on
//     the workstation), then gpresult /s again: E: is there.
// Objective checked on the state: for every enabled account in OU=Branches
// that is (through its groups) in GG_Children or GG_Management, the
// resulting user policy maps E: (Events Drive applied); for every other
// account of the domain (lending, local history, leavers, service
// accounts, administrators), it doesn't; no link of Events Drive on the
// domain's root, none enforced; and one of the three complaining
// workstations has refreshed and now has E:.
// False leads: a link at the domain's root (every account of the domain
// reads it; with Authenticated Users, the service accounts and leavers get
// the drive), Enforced (it doesn't make a GPO reach an OU it isn't linked
// above, nor pass security filtering), GpoApply for Authenticated Users
// (the lending staff get a drive they can't open), gpupdate /force on
// register (it refreshes register, not the librarians' workstations).
// Sources (Microsoft Learn): gpresult
// (https://learn.microsoft.com/windows-server/administration/windows-commands/gpresult),
// Get-GPResultantSetOfPolicy, New-GPLink, Get-GPInheritance,
// Set-GPPermission, Invoke-GPUpdate
// (https://learn.microsoft.com/powershell/module/grouppolicy/),
// security filtering
// (https://learn.microsoft.com/troubleshoot/windows-server/group-policy/apply-group-policy-objects-users-computers),
// Group Policy processing and precedence
// (https://learn.microsoft.com/previous-versions/windows/desktop/policy/group-policy-hierarchy).

import { type Chapter } from '../world';
import type { Game } from '../shell';
import { token } from '../windows-acl';
import { accountName, allGroups, below, byDn, type AdObject } from '../windows-ad';
import { applies, gpoByName, linksInOrder, logonClients, resultant, type AppliedPolicy } from '../windows-gpo';
import { BASE, HOME, ad, ou, ran, register, said, stacksHost } from './card-catalogue';

// Monday 14 January 2030, 10:10.
export const NOW = Date.UTC(2030, 0, 14, 10, 10, 0);
const MIN = 60_000;
const DAY = 86_400_000;
const GPO = 'Events Drive';
// The workstations where people are logged on this morning.
export const SESSIONS = [
  { computer: 'CENTRAL-DESK1', user: 'nmukherjee', logon: Date.UTC(2030, 0, 14, 8, 41, 0) },
  { computer: 'CENTRAL-DESK2', user: 'tnguyen', logon: Date.UTC(2030, 0, 14, 8, 55, 0) },
  { computer: 'RIVER-DESK1', user: 'kmensah', logon: Date.UTC(2030, 0, 14, 9, 2, 0) },
  { computer: 'HILL-DESK1', user: 'jbaptiste', logon: Date.UTC(2030, 0, 14, 8, 50, 0) },
  { computer: 'HILL-DESK2', user: 'bdlamini', logon: Date.UTC(2030, 0, 14, 9, 20, 0) },
];
// Those who wrote to Nandini (and Nandini herself).
const COMPLAINED = ['jbaptiste', 'kmensah', 'nmukherjee'];

const text = (content: string, mtime: number) => ({ type: 'file' as const, content: content.replace(/\n/g, '\r\n'), lines: true, mtime });

const options = { clock: NOW, arrivals: true, rafaelChanged: (NOW - Date.UTC(2030, 0, 7, 8, 52, 0)) / DAY, scansFixed: true, sessions: SESSIONS };
const machine = register({
  ...options,
  home: (t) => ({ 'email_nandini.txt': text(t('unapplied-policy-email-nandini'), NOW - 25 * MIN) }),
});

const gpo = (j: Game) => gpoByName(ad(j), GPO);
const users = (j: Game) => ad(j).objects.filter((o) => o.cls === 'user');
const ids = (j: Game, o: AdObject) => token(j, accountName(ad(j), o));
/** Who the drive is for: an enabled account of a branch, a children's librarian or a manager (DL_Events_RW's groups). */
const wants = (j: Game, o: AdObject) => below(o.dn, ou('Branches')) && o.enabled !== false && allGroups(ad(j), o).some((g) => ['gg_children', 'gg_management'].includes(g.name.toLowerCase()));
/** Does this account's resulting user policy map E:? */
const getsE = (j: Game, o: AdObject) => resultant(j, ad(j), o.dn, 'user', ids(j, o)).applied.some((e) => e.gpo.settings.some((s) => s.kind === 'driveMap' && /^e:?$/i.test(s.letter)));
/** Every one of them is reached by a link of the GPO (security filtering aside). */
const reached = (j: Game) => users(j).filter((o) => wants(j, o)).every((o) => linksInOrder(ad(j), o.dn).some((e) => e.gpo.name === GPO && e.link.enabled));
/** Every one of them has Apply Group Policy (the link aside). */
const filtering = (j: Game) => !!gpo(j) && users(j).filter((o) => wants(j, o)).every((o) => applies(j, gpo(j)!, ids(j, o)));
const everyoneRight = (j: Game) => users(j).every((o) => getsE(j, o) === wants(j, o));
/** Who gets the drive without being meant to (the people of the branches first). */
const tooMany = (j: Game) => {
  const out = users(j).filter((o) => !wants(j, o) && getsE(j, o));
  return [...out.filter((o) => below(o.dn, ou('Branches'))), ...out.filter((o) => !below(o.dn, ou('Branches')))];
};
const atRoot = (j: Game) => (byDn(ad(j), BASE)?.gpLinks ?? []).some((l) => l.gpo === gpo(j)?.id);
const enforced = (j: Game) => ad(j).objects.some((o) => (o.gpLinks ?? []).some((l) => l.gpo === gpo(j)?.id && l.enforced));
const policyRight = (j: Game) => everyoneRight(j) && !atRoot(j) && !enforced(j);
/** A workstation of someone who complained has refreshed its policy, and maps E: now. */
const refreshed = (j: Game) => (ad(j).clients ?? []).some((c) => COMPLAINED.includes(c.user) && ((c.gp as AppliedPolicy | undefined)?.drives ?? []).some((d) => d.letter === 'E'));

/** The last output is someone's resulting set of policy (gpresult, or its report read back). */
const rsopOf = (j: Game, sam: string) => said(j, new RegExp(`RSOP data for LENDING\\\\${sam} on `, 'i'));

export const COMMANDS_UNAPPLIED_POLICY = [
  'gpresult', 'Get-GPResultantSetOfPolicy', 'Get-GPInheritance', 'Get-GPO', 'Get-GPOReport', 'Get-GPPermission', 'New-GPLink', 'Remove-GPLink', 'Set-GPLink',
  'Set-GPPermission', 'Invoke-GPUpdate', 'Get-ADComputer', 'Get-ADGroupMember', 'Get-Content', 'Get-Help',
];

export const unappliedPolicy: Chapter = {
  id: 'unapplied-policy',
  number: 3,
  commands: COMMANDS_UNAPPLIED_POLICY,
  home: HOME,
  welcome: 'email_nandini.txt',
  names: true,
  final: 'end',
  steps: ['josephine', 'links', 'linked', 'nandini', 'filtering', 'filtered', 'end'],
  accounts: machine.accounts,
  state: machine.state,
  createWorld: machine.createWorld,
  hosts: { stacks: stacksHost(options) },
  // This morning's logons: each workstation applied its policy then.
  initialise: (j) => logonClients(j),
  events: [
    { id: 'no-rsop', condition: (j) => ran(j, 'gpresult', 'Get-GPResultantSetOfPolicy') && said(j, /does not have RSoP data/i), message: (j) => j.t('unapplied-policy-event-no-rsop') },
    { id: 'gpupdate-here', condition: (j) => (ran(j, 'gpupdate') || (ran(j, 'Invoke-GPUpdate') && !/-Computer|\s[A-Z]+-DESK\d/i.test(j.last.line))) && !refreshed(j), message: (j) => j.t('unapplied-policy-event-gpupdate-here') },
    { id: 'josephine', condition: (j) => (rsopOf(j, 'jbaptiste') || rsopOf(j, 'kmensah')) && said(j, 'Staff Drives') && !said(j, GPO), message: (j) => j.t('unapplied-policy-event-josephine') },
    {
      id: 'links',
      condition: (j) => (ran(j, 'Get-GPInheritance') && /OU=(Hilltop|Riverside)/i.test(j.last.line) && said(j, 'Staff Drives') && !said(j, GPO)) || (ran(j, 'Get-GPOReport', 'Get-GPInheritance') && (said(j, '<SOMName>Central</SOMName>') || (said(j, GPO) && /OU=Central/i.test(j.last.line)))),
      message: (j) => j.t('unapplied-policy-event-links'),
    },
    { id: 'root', condition: atRoot, message: (j) => j.t('unapplied-policy-event-root') },
    { id: 'enforced', condition: enforced, message: (j) => j.t('unapplied-policy-event-enforced') },
    { id: 'linked', condition: (j) => reached(j) && !atRoot(j), message: (j) => j.t('unapplied-policy-event-linked') },
    { id: 'nandini', condition: (j) => rsopOf(j, 'nmukherjee') && said(j, new RegExp(`${GPO}\\n\\s+Filtering:\\s+Denied \\(Security\\)`)), message: (j) => j.t('unapplied-policy-event-nandini') },
    { id: 'filtering', condition: (j) => ran(j, 'Get-GPPermission', 'Get-GPOReport') && /events drive/i.test(j.last.line) && said(j, 'GG_Children') && !said(j, 'GG_Management'), message: (j) => j.t('unapplied-policy-event-filtering') },
    {
      id: 'everyone',
      condition: (j) => tooMany(j).length > 0,
      message: (j) => j.t('unapplied-policy-event-everyone', { accounts: tooMany(j).slice(0, 4).map((o) => o.sam ?? o.name).join(', ') }),
    },
    { id: 'filtered', condition: (j) => filtering(j) && tooMany(j).length === 0, message: (j) => j.t(reached(j) ? 'unapplied-policy-event-filtered' : 'unapplied-policy-event-filtered-unlinked') },
    { id: 'right', condition: (j) => policyRight(j) && !refreshed(j), message: (j) => j.t('unapplied-policy-event-right') },
    { id: 'end', condition: (j) => policyRight(j) && refreshed(j), message: (j) => j.t('unapplied-policy-event-end') },
  ],
};
