// Story "The Card Catalogue" — chapter "Comings and Goings": Friday
// afternoon, two HR tickets. Kofi Mensah starts on Monday as a youth
// librarian at Riverside; Mateo Rossi, a library assistant at Hilltop,
// left today. On register, the domain controller (it lands in
// PowerShell):
//   - Tomas's conventions (Documents\conventions.txt): the account name,
//     the OU per branch, AGDLP, what happens to a leaver;
//   - Get-ADOrganizationalUnit -Filter *, Get-ADUser -Filter … -SearchBase;
//   - Get-ADUser aokoye -Properties Department, Title, Manager and
//     Get-ADPrincipalGroupMembership aokoye: the colleague HR says to
//     copy has more than her job (GG_Management as acting deputy, and
//     DL_Finance_RW directly, an exception);
//   - Get-ADGroupMember DL_Events_RW: GG_Children inside (AGDLP);
//   - New-ADUser -Name 'Kofi Mensah' -GivenName Kofi -Surname Mensah
//     -SamAccountName kmensah -Path 'OU=Riverside,OU=Branches,…'
//     -Department Children -Title 'Youth Librarian' -Manager iduarte
//     -AccountPassword (Read-Host -AsSecureString, or ConvertTo-SecureString)
//     -ChangePasswordAtLogon $true -Enabled $true; Add-ADGroupMember
//     GG_Children kmensah;
//   - Disable-ADAccount mrossi, Get-ADPrincipalGroupMembership mrossi,
//     Remove-ADGroupMember GG_Lending mrossi (or
//     Remove-ADPrincipalGroupMembership), Move-ADObject … -TargetPath
//     'OU=Leavers,…'.
// Objective checked on the state: kmensah exists in OU=Riverside, enabled,
// with a password he must change at his first logon, the ticket's
// Department, Title and Manager, and in GG_Children only (no DL_ group
// directly, no admin group); mrossi still exists (his SID), disabled, in
// OU=Leavers, in no group but his primary one.
// False leads: copying Amara's groups (GG_Management, DL_Finance_RW), a
// DL_ group directly (AGDLP), Domain Admins, a password the domain refuses
// (the account is then created disabled), deleting Mateo (the AD Recycle
// Bin is on: Restore-ADObject brings him back, SID and groups included).
// Sources: https://learn.microsoft.com/powershell/module/activedirectory/new-aduser,
// https://learn.microsoft.com/windows-server/identity/ad-ds/plan/security-best-practices/implementing-least-privilege-administrative-models,
// https://learn.microsoft.com/windows-server/identity/ad-ds/manage/understand-security-groups,
// https://learn.microsoft.com/windows-server/security/group-policy/password-must-meet-complexity-requirements,
// https://learn.microsoft.com/powershell/module/activedirectory/restore-adobject

import { type Chapter } from '../world';
import type { Game } from '../shell';
import { allGroups, passwordExpired, sameDn } from '../windows-ad';
import { DL, HOME, ad, directGroupNames, now, object, ou, ran, register, said } from './card-catalogue';

// Friday 4 January 2030, 16:20.
export const NOW = Date.UTC(2030, 0, 4, 16, 20, 0);

const text = (content: string, mtime: number) => ({ type: 'file' as const, content: content.replace(/\n/g, '\r\n'), lines: true, mtime });

const machine = register({
  clock: NOW,
  home: (t) => ({
    'email_nandini.txt': text(t('comings-and-goings-email-nandini'), NOW - 30 * 60_000),
    Documents: {
      type: 'directory',
      children: {
        'hr-0112-arrival.txt': text(t('comings-and-goings-ticket-arrival'), NOW - 2 * 86_400_000),
        'hr-0113-departure.txt': text(t('comings-and-goings-ticket-departure'), NOW - 50 * 60_000),
      },
    },
  }),
});

const kofi = (j: Game) => object(j, 'kmensah');
const mateo = (j: Game) => object(j, 'mrossi');
const groupsOf = (j: Game, sam: string) => {
  const o = object(j, sam);
  return o ? directGroupNames(j, o).map((g) => g.toLowerCase()) : [];
};

// ——— The arrival ———

/** A Kofi created under another name than the conventions' (kofi, kofi.mensah…). */
const otherName = (j: Game) => ad(j).objects.some((o) => o.cls === 'user' && o.sam?.toLowerCase() !== 'kmensah' && (/^kofi\b/i.test(o.name) || o.given?.toLowerCase() === 'kofi'));
const inRiverside = (j: Game) => !!kofi(j) && sameDn(kofi(j)!.dn.split(',').slice(1).join(','), ou('Branches/Riverside'));
const details = (j: Game) => {
  const k = kofi(j);
  const manager = object(j, 'iduarte')!;
  return !!k && k.given?.toLowerCase() === 'kofi' && k.surname?.toLowerCase() === 'mensah' && /^children$/i.test(k.department?.trim() ?? '') && /^youth librarian$/i.test(k.title?.trim() ?? '') && !!k.manager && sameDn(k.manager, manager.dn);
};
/** A password is set, he must change it at his first logon, and the account is enabled. */
const ready = (j: Game) => {
  const k = kofi(j);
  return !!k && !!k.enabled && !!ad(j).passwords[k.guid] && !!k.mustChange && passwordExpired(ad(j), k, now(j));
};
const onlyChildren = (j: Game) => {
  const g = groupsOf(j, 'kmensah');
  return g.length === 1 && g[0] === 'gg_children';
};
/** Amara's extras: management, the finance exception. */
const copied = (j: Game) => groupsOf(j, 'kmensah').some((g) => g === 'gg_management' || g === 'dl_finance_rw');
/** A DL_ group directly (AGDLP: people go into GG_ groups). */
const directDl = (j: Game) => groupsOf(j, 'kmensah').some((g) => DL.some((d) => d.toLowerCase() === g));
/** An administrators' group, directly or by nesting. */
const ADMIN_GROUPS = ['domain admins', 'enterprise admins', 'schema admins', 'administrators', 'account operators', 'server operators', 'backup operators', 'group policy creator owners'];
const admin = (j: Game) => {
  const k = kofi(j);
  return !!k && allGroups(ad(j), k).some((g) => ADMIN_GROUPS.includes(g.name.toLowerCase()));
};
const arrivalDone = (j: Game) => inRiverside(j) && details(j) && ready(j) && onlyChildren(j) && !admin(j);

// ——— The departure ———

const leaversDn = ou('Leavers');
const leaverDisabled = (j: Game) => !!mateo(j) && !mateo(j)!.enabled;
const leaverMoved = (j: Game) => !!mateo(j) && sameDn(mateo(j)!.dn.split(',').slice(1).join(','), leaversDn);
const leaverOut = (j: Game) => !!mateo(j) && groupsOf(j, 'mrossi').length === 0;
const departureDone = (j: Game) => leaverDisabled(j) && leaverMoved(j) && leaverOut(j);

export const COMMANDS_COMINGS_AND_GOINGS = [
  'Get-ADUser', 'Get-ADOrganizationalUnit', 'Get-ADGroup', 'Get-ADGroupMember', 'Get-ADPrincipalGroupMembership', 'New-ADUser', 'Set-ADUser',
  'Add-ADGroupMember', 'Remove-ADGroupMember', 'Remove-ADPrincipalGroupMembership', 'Disable-ADAccount', 'Enable-ADAccount', 'Set-ADAccountPassword',
  'Move-ADObject', 'ConvertTo-SecureString', 'Read-Host', 'Get-Content', 'Get-Help',
];

export const comingsAndGoings: Chapter = {
  id: 'comings-and-goings',
  number: 1,
  commands: COMMANDS_COMINGS_AND_GOINGS,
  home: HOME,
  welcome: 'email_nandini.txt',
  names: true,
  final: 'end',
  steps: ['ous', 'colleague', 'agdlp', 'created', 'arrival', 'leaver-disabled', 'leaver-groups', 'end'],
  accounts: machine.accounts,
  state: machine.state,
  createWorld: machine.createWorld,
  events: [
    {
      id: 'ous',
      condition: (j) => ran(j, 'Get-ADOrganizationalUnit', 'Get-ADObject', 'Get-ADUser') && said(j, 'OU=Riverside,OU=Branches') && said(j, /Leavers|OU=Hilltop/),
      message: (j) => j.t('comings-and-goings-event-ous'),
    },
    {
      id: 'colleague',
      condition: (j) => ran(j, 'Get-ADPrincipalGroupMembership', 'Get-ADUser', 'net') && /aokoye/i.test(j.last.line) && said(j, 'DL_Finance_RW'),
      message: (j) => j.t('comings-and-goings-event-colleague'),
    },
    {
      id: 'agdlp',
      condition: (j) => ran(j, 'Get-ADGroupMember', 'Get-ADGroup') && /DL_/i.test(j.last.line) && said(j, /GG_Children|GG_Lending/),
      message: (j) => j.t('comings-and-goings-event-agdlp'),
    },
    { id: 'complexity', condition: (j) => said(j, 'The password does not meet the length, complexity, or history requirement of the domain.'), message: (j) => j.t('comings-and-goings-event-complexity') },
    { id: 'other-name', condition: otherName, message: (j) => j.t('comings-and-goings-event-other-name') },
    { id: 'created', condition: (j) => !!kofi(j), message: (j) => j.t('comings-and-goings-event-created') },
    { id: 'created-disabled', condition: (j) => !!kofi(j) && !kofi(j)!.enabled && ran(j, 'New-ADUser'), message: (j) => j.t('comings-and-goings-event-created-disabled') },
    { id: 'wrong-ou', condition: (j) => !!kofi(j) && !inRiverside(j), message: (j) => j.t('comings-and-goings-event-wrong-ou') },
    { id: 'copied', condition: copied, message: (j) => j.t('comings-and-goings-event-copied') },
    { id: 'direct-dl', condition: (j) => directDl(j) && !copied(j), message: (j) => j.t('comings-and-goings-event-direct-dl') },
    { id: 'admin', condition: admin, message: (j) => j.t('comings-and-goings-event-admin') },
    { id: 'no-change', condition: (j) => !!kofi(j) && !!kofi(j)!.enabled && !!ad(j).passwords[kofi(j)!.guid] && !kofi(j)!.mustChange, message: (j) => j.t('comings-and-goings-event-no-change') },
    { id: 'details', condition: (j) => inRiverside(j) && ready(j) && onlyChildren(j) && !details(j), message: (j) => j.t('comings-and-goings-event-details') },
    { id: 'arrival', condition: arrivalDone, message: (j) => j.t('comings-and-goings-event-arrival') },
    { id: 'deleted', condition: (j) => !mateo(j), message: (j) => j.t('comings-and-goings-event-deleted') },
    // The AD Recycle Bin is on: Restore-ADObject brings him back with his SID and his groups.
    { id: 'restored', condition: (j) => j.flags.has('deleted') && !!mateo(j), message: (j) => j.t('comings-and-goings-event-restored') },
    { id: 'leaver-disabled', condition: leaverDisabled, message: (j) => j.t('comings-and-goings-event-leaver-disabled') },
    { id: 'leaver-groups', condition: (j) => leaverDisabled(j) && leaverOut(j), message: (j) => j.t(leaverMoved(j) ? 'comings-and-goings-event-leaver-groups-moved' : 'comings-and-goings-event-leaver-groups') },
    { id: 'leaver-moved', condition: (j) => leaverMoved(j) && !leaverOut(j), message: (j) => j.t('comings-and-goings-event-leaver-moved') },
    { id: 'end', condition: (j) => arrivalDone(j) && departureDone(j), message: (j) => j.t('comings-and-goings-event-end') },
  ],
};
