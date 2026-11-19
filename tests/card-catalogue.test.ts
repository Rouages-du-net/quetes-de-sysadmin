// The Card Catalogue: an Active Directory domain (lending.internal), its
// domain controller register as the story's machine (it lands in
// PowerShell), and stacks, a member file server reached from it with
// Windows' OpenSSH client. Accounts created and closed by the conventions
// (AGDLP), then a lockout whose source is a scheduled task on stacks.
// Replayed with the console, in every language, with the false leads.

import { describe, expect, it } from 'vitest';
import { Console } from '../src/engine/console';
import { prerequisites } from '../src/engine/unlocking';
import { LANGUAGES } from '../src/texts';
import type { Shell } from '../src/engine/shell';
import { domainOf, findIdentity, lockedOut } from '../src/engine/windows-ad';
import { windows } from '../src/engine/windows';
import { findTask } from '../src/engine/windows-tasks';
import { SCANS_PASSWORD } from '../src/engine/chapters/card-catalogue';
import { resultant } from '../src/engine/windows-gpo';
import { token } from '../src/engine/windows-acl';
import { firewallAllows } from '../src/engine/windows-firewall';

const BEFORE = [...prerequisites('card-catalogue')];
const RIVERSIDE = 'OU=Riverside,OU=Branches,DC=lending,DC=internal';
const LEAVERS = 'OU=Leavers,DC=lending,DC=internal';
const KOFI = `New-ADUser -Name 'Kofi Mensah' -GivenName Kofi -Surname Mensah -SamAccountName kmensah -Path '${RIVERSIDE}' -Department Children -Title 'Youth Librarian' -Manager iduarte`;
const PASSWORD = "(ConvertTo-SecureString 'Bookmark-2030-Monday' -AsPlainText -Force)";

for (const language of LANGUAGES)
  describe(`The Card Catalogue — ${language}`, () => {
    const fr = language === 'fr';
    const REGISTER = fr ? 'registre' : 'register';
    const STACKS = fr ? 'rayons' : 'stacks';
    const contains = (all: string, text: string) => fr && expect(all).toContain(text);
    const part = (finished: string[] = []) => {
      const c = new Console({ language, finished: [...BEFORE, ...finished] });
      // Windows commands, accounts and DNs aren't translated: only the machines' names.
      const one = (l: string) => c.execute(l.replace(/\bregister\b/g, REGISTER).replace(/\bstacks\b/g, STACKS)) ?? '';
      const play = (lines: string[]) => lines.map(one).join('\n');
      const dc = () => ((c.shell as Shell).principal ?? c.shell) as Shell;
      const flag = (id: string) => dc().flags.has(id);
      const banner = play(['ssh register', 'yes']);
      const ad = () => domainOf(dc())!.ad;
      const user = (sam: string) => findIdentity(ad(), sam);
      const groups = (sam: string) => ad().objects.filter((g) => g.cls === 'group' && (g.members ?? []).includes(user(sam)!.dn)).map((g) => g.name);
      return { c, play, flag, banner, dc, ad, user, groups };
    };

    // ——— Chapter 1: "Comings and Goings" ———
    it('chapter 1 — solution: the OUs, Amara, AGDLP, Kofi in one command, Mateo closed', () => {
      const { c, play, flag, banner, user, groups } = part();
      expect(banner).toContain('Windows PowerShell');
      contains(banner, 'Arrivées et départs');
      expect(c.shell.prompt()).toBe(`PS C:\\Users\\${fr ? 'vous' : 'you'}>`);
      expect(play(['Get-Content Documents\\conventions.txt'])).toContain('AGDLP');
      expect(play(['Get-ADOrganizationalUnit -Filter * | Select-Object -ExpandProperty DistinguishedName'])).toContain(RIVERSIDE);
      expect(flag('ous')).toBe(true);
      const amara = play(['Get-ADPrincipalGroupMembership aokoye | Select-Object -ExpandProperty name']);
      expect(amara).toContain('Domain Users\nGG_Children\nGG_Management\nDL_Finance_RW');
      contains(amara, 'intérim');
      expect(flag('colleague')).toBe(true);
      const nested = play(['Get-ADGroupMember DL_Events_RW | Select-Object -ExpandProperty name']);
      expect(nested).toContain('GG_Children\nGG_Management');
      contains(nested, 'AGDLP');
      expect(flag('agdlp')).toBe(true);
      play([`${KOFI} -AccountPassword ${PASSWORD} -ChangePasswordAtLogon $true -Enabled $true`]);
      expect(flag('created')).toBe(true);
      expect(flag('created-disabled')).toBe(false);
      expect(play(['Get-ADUser kmensah -Properties Department, Title, Manager, Enabled, PasswordExpired | Select-Object Enabled, PasswordExpired, Department'])).toMatch(/True +True +Children/);
      const arrival = play(['Add-ADGroupMember GG_Children kmensah']);
      contains(arrival, 'Kofi est prêt pour lundi');
      expect(flag('arrival')).toBe(true);
      expect(groups('kmensah')).toEqual(['GG_Children']);
      play(['Disable-ADAccount mrossi']);
      expect(flag('leaver-disabled')).toBe(true);
      expect(play(['Get-ADPrincipalGroupMembership mrossi | Select-Object -ExpandProperty name'])).toBe('Domain Users\nGG_Lending');
      play(['Remove-ADPrincipalGroupMembership mrossi -MemberOf GG_Lending -Confirm:$false']);
      expect(flag('leaver-groups')).toBe(true);
      expect(c.finished).not.toContain('comings-and-goings');
      const end = play([`Get-ADUser mrossi | Move-ADObject -TargetPath '${LEAVERS}'`]);
      contains(end, 'Bravo');
      expect(end).toContain('https://learn.microsoft.com/powershell/module/activedirectory/new-aduser');
      expect(c.finished).toContain('comings-and-goings');
      expect(user('mrossi')!.dn).toBe(`CN=Mateo Rossi,${LEAVERS}`);
      expect(user('mrossi')!.enabled).toBe(false);
    });

    it('chapter 1 — another way: a refused password, then Set-ADAccountPassword, Enable-ADAccount, Set-ADUser; Remove-ADGroupMember', () => {
      const { c, play, flag, user } = part();
      // The account's name in the password: refused, the account created disabled.
      const refused = play([`${KOFI} -AccountPassword (ConvertTo-SecureString 'Kofi-2030-temp' -AsPlainText -Force) -Enabled $true`]);
      expect(refused).toContain('The password does not meet the length, complexity, or history requirement of the domain.');
      contains(refused, 'politique de mots de passe du domaine');
      expect(flag('complexity')).toBe(true);
      expect(flag('created-disabled')).toBe(true);
      expect(user('kmensah')!.enabled).toBe(false);
      play(["Set-ADAccountPassword kmensah -Reset -NewPassword (ConvertTo-SecureString 'Riverside-Story-2030' -AsPlainText -Force)", 'Enable-ADAccount kmensah', 'Add-ADGroupMember GG_Children kmensah']);
      // He wouldn't have to change it.
      expect(flag('no-change')).toBe(true);
      expect(flag('arrival')).toBe(false);
      play(['Set-ADUser kmensah -ChangePasswordAtLogon $true']);
      expect(flag('arrival')).toBe(true);
      play(['Disable-ADAccount mrossi', `Move-ADObject 'CN=Mateo Rossi,OU=Hilltop,OU=Branches,DC=lending,DC=internal' -TargetPath '${LEAVERS}'`]);
      expect(flag('leaver-moved')).toBe(true);
      expect(c.finished).not.toContain('comings-and-goings');
      expect(play(['Remove-ADGroupMember GG_Lending mrossi'])).toContain('Are you sure you want to perform this action?');
      const end = play(['Y']);
      contains(end, 'Bravo');
      expect(c.finished).toContain('comings-and-goings');
    });

    it("chapter 1 — false leads: Amara's groups copied, a DL_ group directly, Domain Admins, the wrong OU, Mateo deleted", () => {
      const { c, play, flag, groups } = part();
      play([`New-ADUser -Name 'Kofi Mensah' -GivenName Kofi -Surname Mensah -SamAccountName kmensah -Department Children -Title 'Youth Librarian' -Manager iduarte -AccountPassword ${PASSWORD} -ChangePasswordAtLogon $true -Enabled $true`]);
      // Created in CN=Users, the default.
      expect(flag('wrong-ou')).toBe(true);
      play([`Get-ADUser kmensah | Move-ADObject -TargetPath '${RIVERSIDE}'`]);
      // "Same as Amara": every group of hers.
      const copy = play(["Get-ADPrincipalGroupMembership aokoye | Where-Object Name -ne 'Domain Users' | ForEach-Object { Add-ADGroupMember $_ -Members kmensah }"]);
      contains(copy, 'extras d');
      expect(flag('copied')).toBe(true);
      expect(groups('kmensah')).toEqual(['GG_Children', 'GG_Management', 'DL_Finance_RW']);
      play(['Remove-ADPrincipalGroupMembership kmensah -MemberOf GG_Management, DL_Finance_RW -Confirm:$false']);
      expect(flag('arrival')).toBe(true);
      // AGDLP: a person straight into a DL_ group.
      const direct = play(['Add-ADGroupMember DL_Events_RW kmensah']);
      contains(direct, 'AGDLP');
      expect(flag('direct-dl')).toBe(true);
      play(['Remove-ADGroupMember DL_Events_RW kmensah -Confirm:$false', "Add-ADGroupMember 'Domain Admins' kmensah"]);
      expect(flag('admin')).toBe(true);
      play(["Remove-ADGroupMember 'Domain Admins' kmensah -Confirm:$false"]);
      // Primary group: Domain Users can't be removed.
      expect(play(["Remove-ADPrincipalGroupMembership mrossi -MemberOf 'Domain Users' -Confirm:$false"])).toContain("The user cannot be removed from a group because the group is currently the user's primary group");
      // Deleting Mateo: asked, then gone; the chapter can't end.
      expect(play(['Remove-ADUser mrossi'])).toContain('Performing the operation "Remove" on target "CN=Mateo Rossi');
      const deleted = play(['Y']);
      contains(deleted, 'SID');
      expect(flag('deleted')).toBe(true);
      expect(c.finished).not.toContain('comings-and-goings');
    });

    it('chapter 1 — deleting Mateo, then the AD Recycle Bin: Restore-ADObject brings him back with his SID and his group', () => {
      const { c, play, flag, user, groups } = part();
      const sid = user('mrossi')!.rid;
      play(['Remove-ADUser mrossi -Confirm:$false']);
      expect(flag('deleted')).toBe(true);
      expect(play(['Get-ADUser mrossi'])).toContain("Cannot find an object with identity: 'mrossi'");
      expect(play(["Get-ADOptionalFeature 'Recycle Bin Feature' | Select-Object -ExpandProperty EnabledScopes"])).toContain('CN=Partitions,CN=Configuration,DC=lending,DC=internal');
      const bin = play(["Get-ADObject -Filter 'isDeleted -eq $true -and Name -ne \"Deleted Objects\"' -IncludeDeletedObjects -Properties LastKnownParent | Format-List"]);
      expect(bin).toMatch(/DistinguishedName +: CN=Mateo Rossi\\0ADEL:[0-9a-f-]+,CN=Deleted Objects,DC=lending,DC=internal/);
      expect(bin).toContain('LastKnownParent   : OU=Hilltop,OU=Branches,DC=lending,DC=internal');
      expect(bin).toContain('Deleted           : True');
      const back = play(["Get-ADObject -Filter 'SamAccountName -eq \"mrossi\"' -IncludeDeletedObjects | Restore-ADObject"]);
      contains(back, 'même SID');
      expect(flag('restored')).toBe(true);
      expect(user('mrossi')!.rid).toBe(sid);
      expect(user('mrossi')!.dn).toBe('CN=Mateo Rossi,OU=Hilltop,OU=Branches,DC=lending,DC=internal');
      expect(groups('mrossi')).toEqual(['GG_Lending']);
      // Nothing left to restore.
      expect(play(['Restore-ADObject mrossi'])).toContain("Cannot find an object with identity: 'mrossi'");
      play([`${KOFI} -AccountPassword ${PASSWORD} -ChangePasswordAtLogon $true -Enabled $true`, 'Add-ADGroupMember GG_Children kmensah', 'Disable-ADAccount mrossi', 'Remove-ADGroupMember GG_Lending mrossi -Confirm:$false']);
      const end = play([`Move-ADObject 'CN=Mateo Rossi,OU=Hilltop,OU=Branches,DC=lending,DC=internal' -TargetPath '${LEAVERS}'`]);
      contains(end, 'Bravo');
      expect(c.finished).toContain('comings-and-goings');
    });

    it('chapter 1 — another name than the conventions', () => {
      const { play, flag } = part();
      play([`New-ADUser -Name 'Kofi Mensah' -GivenName Kofi -Surname Mensah -SamAccountName kofi.mensah -Path '${RIVERSIDE}'`]);
      expect(flag('other-name')).toBe(true);
    });

    // ——— Chapter 2: "The Stale Password" ———
    it('chapter 2 — solution: locked, 4740 names stacks, the task, svc_scans, then unlock', () => {
      const { c, play, flag, banner, dc, ad, user } = part(['comings-and-goings']);
      contains(banner, 'Le mot de passe périmé');
      expect(lockedOut(ad(), user('rsilva')!, windows(dc()).clock)).toBe(true);
      expect(play(['Search-ADAccount -LockedOut | Select-Object -ExpandProperty SamAccountName'])).toMatch(/^rsilva/);
      expect(flag('locked')).toBe(true);
      expect(play(['Get-ADUser rsilva -Properties LockedOut, BadLogonCount, LastBadPasswordAttempt, PasswordLastSet | Select-Object LockedOut, PasswordLastSet'])).toMatch(/True +1\/7\/2030 8:52:00 AM/);
      expect(flag('bad-logons')).toBe(true);
      const lockout = play(["Get-WinEvent -FilterHashtable @{LogName='Security'; Id=4740} -MaxEvents 1 | Format-List Message"]);
      expect(lockout).toContain('Account Name:\t\trsilva');
      expect(lockout).toContain(`Caller Computer Name:\t${STACKS.toUpperCase()}`);
      expect(flag('caller')).toBe(true);
      // The directory's attributes, with an LDAP filter.
      expect(play(["Get-ADUser -LDAPFilter '(lockoutTime>=1)' | Select-Object -ExpandProperty SamAccountName"])).toBe('rsilva');
      const there = play(['ssh stacks', 'yes']);
      expect(there).toContain('Windows PowerShell');
      expect(c.shell.prompt()).toBe(`PS C:\\Users\\${fr ? 'vous' : 'you'}>`);
      expect(play(['hostname'])).toContain(STACKS.toUpperCase());
      expect(flag('on-stacks')).toBe(true);
      expect(play(["Get-WinEvent -FilterHashtable @{LogName='Security'; Id=4625} -MaxEvents 1 | Format-List Message"])).toMatch(/Logon Type:\t+4/);
      expect(flag('logon-type')).toBe(true);
      expect(play(["Get-ScheduledTask | Select-Object TaskName, @{n='User';e={$_.Principal.UserId}}"])).toMatch(/Scan Import +LENDING\\rsilva/);
      expect(flag('task')).toBe(true);
      expect(play(["Get-ScheduledTaskInfo 'Scan Import' | Select-Object -ExpandProperty LastTaskResult"])).toBe('2147944309');
      const fixed = play([`Set-ScheduledTask 'Scan Import' -User 'LENDING\\svc_scans' -Password '${SCANS_PASSWORD}'`]);
      contains(fixed, 'svc_scans maintenant');
      expect(flag('fixed')).toBe(true);
      expect(c.finished).not.toContain('stale-password');
      play(['exit']);
      const end = play(['Unlock-ADAccount rsilva']);
      contains(end, 'toujours connecté');
      contains(end, 'Bravo');
      expect(c.finished).toContain('stale-password');
      expect(lockedOut(ad(), user('rsilva')!, windows(dc()).clock)).toBe(false);
      // The import ran meanwhile, as svc_scans.
      expect(findTask(dc().internal('stacks')!, 'Scan Import')!.lastResult).toBe(0);
    });

    it('chapter 2 — false leads: unlocking first (it relocks), the policy, a reset, SYSTEM, the task disabled; schtasks /change', () => {
      const { c, play, flag, ad } = part(['comings-and-goings']);
      const relock = play(['Unlock-ADAccount rsilva']);
      contains(relock, 'de nouveau verrouillé');
      expect(play(['Search-ADAccount -LockedOut | Select-Object -ExpandProperty SamAccountName'])).toMatch(/^rsilva/);
      play(['Set-ADDefaultDomainPasswordPolicy lending.internal -LockoutThreshold 0']);
      expect(flag('policy')).toBe(true);
      play(["Set-ADAccountPassword rsilva -Reset -NewPassword (ConvertTo-SecureString 'Another-2030-pass' -AsPlainText -Force)"]);
      expect(flag('reset')).toBe(true);
      play(['ssh stacks', 'yes', "Set-ScheduledTask 'Scan Import' -User SYSTEM"]);
      expect(flag('system')).toBe(true);
      play(["Disable-ScheduledTask 'Scan Import'"]);
      expect(flag('task-off')).toBe(true);
      // A wrong password for svc_scans: refused (and it counts on svc_scans).
      expect(play(['schtasks /change /tn "Scan Import" /ru LENDING\\svc_scans /rp nope'])).toContain('ERROR: The user name or password is incorrect.');
      play([`schtasks /change /tn "Scan Import" /ru LENDING\\svc_scans /rp ${SCANS_PASSWORD} /enable`, 'exit']);
      expect(flag('fixed')).toBe(true);
      play(['Unlock-ADAccount rsilva']);
      // The policy is still off: no end.
      expect(c.finished).not.toContain('stale-password');
      const end = play(['Set-ADDefaultDomainPasswordPolicy lending.internal -LockoutThreshold 5']);
      contains(end, 'Bravo');
      expect(c.finished).toContain('stale-password');
      expect(ad().policy.threshold).toBe(5);
    });

    // ——— Chapter 3: "The Policy That Doesn't Apply" ———
    const AFTER_2 = ['comings-and-goings', 'stale-password'];
    const BRANCHES = 'OU=Branches,DC=lending,DC=internal';
    const CENTRAL = 'OU=Central,OU=Branches,DC=lending,DC=internal';
    const hasE = (dc: Shell, sam: string) => {
      const ad = domainOf(dc)!.ad;
      const o = findIdentity(ad, sam)!;
      return resultant(dc, ad, o.dn, 'user', token(dc, `LENDING\\${sam}`)).applied.some((e) => e.gpo.name === 'Events Drive');
    };

    it("chapter 3 — solution: gpresult on the workstations, the link, the filtering, Invoke-GPUpdate", () => {
      const { c, play, flag, banner, dc } = part(AFTER_2);
      contains(banner, "La stratégie qui ne s'applique pas");
      // register knows only its own logons.
      const none = play(['gpresult /r /user LENDING\\jbaptiste']);
      expect(none).toContain('INFO: The user "LENDING\\jbaptiste" does not have RSoP data.');
      expect(flag('no-rsop')).toBe(true);
      const josephine = play(['gpresult /s HILL-DESK1 /user LENDING\\jbaptiste /r']);
      expect(josephine).toContain('RSOP data for LENDING\\jbaptiste on HILL-DESK1 : Logging Mode');
      expect(josephine).toMatch(/Applied Group Policy Objects\n {4}-+\n {8}Staff Drives\n/);
      expect(josephine).toContain('        Archives Drive\n            Filtering:  Denied (Security)');
      expect(josephine).not.toMatch(/ {8}Events Drive/);
      contains(josephine, 'aucun lien');
      expect(flag('josephine')).toBe(true);
      expect(play([`Get-GPInheritance -Target 'OU=Hilltop,${BRANCHES}'`])).toContain('InheritedGpoLinks     : {Staff Drives, Archives Drive, Default Domain Policy}');
      expect(flag('links')).toBe(true);
      expect(play(["Get-GPOReport 'Events Drive' -ReportType Xml"])).toContain('<SOMPath>lending.internal/Branches/Central</SOMPath>');
      play([`New-GPLink 'Events Drive' -Target '${BRANCHES}'`, `Remove-GPLink 'Events Drive' -Target '${CENTRAL}'`]);
      expect(flag('linked')).toBe(true);
      expect(hasE(dc(), 'jbaptiste')).toBe(true);
      expect(hasE(dc(), 'nmukherjee')).toBe(false);
      const nandini = play(['gpresult /s CENTRAL-DESK1 /user LENDING\\nmukherjee /r /scope:user']);
      expect(nandini).toContain('        Events Drive\n            Filtering:  Denied (Security)');
      expect(nandini).not.toContain('COMPUTER SETTINGS');
      expect(flag('nandini')).toBe(true);
      expect(play(["Get-GPPermission 'Events Drive' -All | Where-Object Permission -eq GpoApply | Select-Object -ExpandProperty Trustee"])).toMatch(/^GG_Children\n\n/);
      expect(flag('filtering')).toBe(true);
      const right = play(["Set-GPPermission 'Events Drive' -TargetName GG_Management -TargetType Group -PermissionLevel GpoApply"]);
      contains(right, 'prochaine actualisation');
      expect(flag('right')).toBe(true);
      expect(hasE(dc(), 'nmukherjee')).toBe(true);
      expect(hasE(dc(), 'tnguyen')).toBe(false);
      expect(hasE(dc(), 'svc_scans')).toBe(false);
      expect(c.finished).not.toContain('unapplied-policy');
      const end = play(['Invoke-GPUpdate -Computer HILL-DESK1 -Target User -Force']);
      contains(end, 'Bravo');
      expect(end).toContain('https://learn.microsoft.com/windows-server/administration/windows-commands/gpresult');
      expect(c.finished).toContain('unapplied-policy');
      expect(play(['gpresult /s HILL-DESK1 /user LENDING\\jbaptiste /r /scope:user'])).toMatch(/Applied Group Policy Objects\n {4}-+\n {8}Staff Drives\n {8}Events Drive\n/);
    });

    it('chapter 3 — another way: a link per branch, the share’s DL_ group, Get-GPResultantSetOfPolicy, refreshing Kofi’s workstation', () => {
      const { c, play, flag, dc } = part(AFTER_2);
      const report = play(['Get-GPResultantSetOfPolicy -Computer RIVER-DESK1 -User LENDING\\kmensah -ReportType Html -Path Documents\\kofi.html']);
      expect(report).toMatch(/RsopMode +: Logging/);
      const read = play(['Get-Content Documents\\kofi.html']);
      expect(read).toContain('RSOP data for LENDING\\kmensah on RIVER-DESK1');
      expect(flag('josephine')).toBe(true);
      play([`New-GPLink 'Events Drive' -Target 'OU=Riverside,${BRANCHES}'`, `New-GPLink 'Events Drive' -Target 'OU=Hilltop,${BRANCHES}'`]);
      expect(flag('linked')).toBe(true);
      // Nobody else asked: Bongani's workstation shows the same filtering.
      expect(play(['gpresult /s HILL-DESK2 /user LENDING\\bdlamini /r /scope:user'])).toContain('Filtering:  Denied (Security)');
      play(["Set-GPPermission -Name 'Events Drive' -TargetName DL_Events_RW -TargetType Group -PermissionLevel GpoApply"]);
      expect(flag('filtered')).toBe(true);
      expect(hasE(dc(), 'bdlamini')).toBe(true);
      expect(hasE(dc(), 'lhassan')).toBe(false);
      play(['Invoke-GPUpdate -Computer RIVER-DESK1']);
      expect(c.finished).toContain('unapplied-policy');
    });

    it('chapter 3 — false leads: gpupdate on register, the domain root, Enforced, Authenticated Users', () => {
      const { c, play, flag, dc } = part(AFTER_2);
      const here = play(['gpupdate /force']);
      expect(here).toContain('User Policy update has completed successfully.');
      contains(here, 'registre lui-même');
      expect(flag('gpupdate-here')).toBe(true);
      // Enforced on Central: it reaches no other OU.
      play([`Set-GPLink 'Events Drive' -Target '${CENTRAL}' -Enforced Yes`]);
      expect(flag('enforced')).toBe(true);
      expect(hasE(dc(), 'jbaptiste')).toBe(false);
      play([`Set-GPLink 'Events Drive' -Target '${CENTRAL}' -Enforced No`]);
      // The root, then everyone may apply it: the service accounts and the lending desk get E:.
      const root = play(["New-GPLink 'Events Drive' -Target 'DC=lending,DC=internal'"]);
      contains(root, 'racine');
      expect(flag('root')).toBe(true);
      const everyone = play(["Set-GPPermission 'Events Drive' -TargetName 'Authenticated Users' -TargetType Group -PermissionLevel GpoApply"]);
      expect(flag('everyone')).toBe(true);
      expect(everyone).toMatch(/tnguyen/);
      expect(hasE(dc(), 'svc_scans')).toBe(true);
      play(['Invoke-GPUpdate -Computer HILL-DESK1']);
      expect(c.finished).not.toContain('unapplied-policy');
      // Put right: GpoRead for Authenticated Users (-Replace lowers it), the managers, the link where the staff are.
      play([
        "Set-GPPermission 'Events Drive' -TargetName 'Authenticated Users' -TargetType Group -PermissionLevel GpoRead -Replace",
        "Set-GPPermission 'Events Drive' -TargetName GG_Management -TargetType Group -PermissionLevel GpoApply",
        "Remove-GPLink 'Events Drive' -Target 'DC=lending,DC=internal'",
      ]);
      expect(c.finished).not.toContain('unapplied-policy');
      const end = play([`New-GPLink 'Events Drive' -Target '${BRANCHES}'`, 'Invoke-GPUpdate -Computer CENTRAL-DESK1 -Target User']);
      contains(end, 'Bravo');
      expect(c.finished).toContain('unapplied-policy');
    });

    // ——— Chapter 4: "Doors and Dormant Accounts" ———
    const AFTER_3 = [...AFTER_2, 'unapplied-policy'];
    const LEAVERS_OU = LEAVERS;
    const SEARCH = `Search-ADAccount -AccountInactive -TimeSpan 90.00:00:00 -UsersOnly -SearchBase '${BRANCHES}'`;
    const rdp = (dc: Shell, from: string) => firewallAllows(dc.internal('stacks')!, { protocol: 'TCP', port: 3389, remote: from });

    it('chapter 4 — solution: the RDP rule disabled; a foreach loop, Export-Csv, the old leaver', () => {
      const { c, play, flag, banner, dc, user, groups } = part(AFTER_3);
      contains(banner, 'Portes et comptes dormants');
      expect(rdp(dc(), '198.51.100.77')).toBe(true);
      expect(play([`Get-Content Documents\\${fr ? 'audit-informatique-ville.txt' : 'city-it-audit.txt'}`])).toContain('TCP 3389');
      play(['ssh stacks', 'yes']);
      const rule = play(['Get-NetFirewallPortFilter | Where-Object LocalPort -eq 3389 | Get-NetFirewallRule | Where-Object Enabled -eq True | Select-Object DisplayName, Profile']);
      expect(rule).toMatch(/Remote Desktop - Any +Any/);
      contains(rule, 'Bureau à distance');
      expect(flag('rdp-found')).toBe(true);
      expect(play(["Get-NetFirewallRule -DisplayName 'Remote Desktop - Any' | Get-NetFirewallAddressFilter"])).toContain('RemoteAddress : Any');
      play(["Disable-NetFirewallRule -DisplayName 'Remote Desktop - Any'"]);
      expect(flag('rdp-closed')).toBe(true);
      expect(rdp(dc(), '198.51.100.77')).toBe(false);
      expect(rdp(dc(), '192.0.2.210')).toBe(false);
      expect(play(["Get-ScheduledTask | Select-Object TaskName, @{n='User';e={$_.Principal.UserId}}"])).toMatch(/Offsite Copy +LENDING\\svc_backup/);
      expect(flag('service-account')).toBe(true);
      play(['exit']);
      const all = play(['Search-ADAccount -AccountInactive -TimeSpan 90.00:00:00 -UsersOnly | Select-Object -ExpandProperty SamAccountName']);
      expect(all.split('\n').slice(0, 6)).toEqual(['Guest', 'krbtgt', 'ychen', 'pmorel', 'oadeyemi', 'svc_backup']);
      expect(flag('inactive')).toBe(true);
      play([`$old = ${SEARCH}`]);
      expect(play(['$old | Select-Object -ExpandProperty SamAccountName'])).toBe('ychen\npmorel');
      const report = play([`$old | Select-Object SamAccountName, Name, LastLogonDate | Export-Csv Documents\\dormant-accounts.csv -NoTypeInformation`]);
      contains(report, 'tableur');
      expect(flag('report')).toBe(true);
      expect(play(['Get-Content Documents\\dormant-accounts.csv'])).toBe('"SamAccountName","Name","LastLogonDate"\n"ychen","Yan Chen","8/26/2029 4:40:00 PM"\n"pmorel","Pierre Morel","6/6/2029 11:15:00 AM"');
      expect(play(['(Import-Csv Documents\\dormant-accounts.csv).Count'])).toBe('2');
      play([`foreach ($a in $old) { Disable-ADAccount $a; Get-ADPrincipalGroupMembership $a | Where-Object Name -ne 'Domain Users' | ForEach-Object { Remove-ADGroupMember $_ $a -Confirm:$false }; Move-ADObject $a -TargetPath '${LEAVERS_OU}' }`]);
      expect(flag('closed')).toBe(true);
      expect(user('ychen')!.dn).toBe(`CN=Yan Chen,${LEAVERS_OU}`);
      expect(groups('pmorel')).toEqual([]);
      expect(c.finished).not.toContain('dormant-accounts');
      expect(play(['Get-ADPrincipalGroupMembership oadeyemi | Select-Object -ExpandProperty name'])).toContain('Domain Users\nGG_Lending\nDL_Staff_RW');
      expect(flag('leftover-seen')).toBe(true);
      const end = play(['Remove-ADPrincipalGroupMembership oadeyemi -MemberOf GG_Lending, DL_Staff_RW -Confirm:$false']);
      contains(end, 'Bravo');
      expect(end).toContain('https://learn.microsoft.com/powershell/module/activedirectory/search-adaccount');
      expect(c.finished).toContain('dormant-accounts');
      // The others as they were.
      expect(user('svc_backup')!.enabled).toBe(true);
      expect(groups('lhassan')).toEqual(['GG_Lending']);
    });

    it('chapter 4 — another way: the rule narrowed to the IT workstation, a function dot-sourced from a script, a pipeline', () => {
      const { c, play, flag, dc } = part(AFTER_3);
      play(['ssh stacks', 'yes', "Set-NetFirewallRule -DisplayName 'Remote Desktop - Any' -RemoteAddress 192.0.2.2", 'exit']);
      expect(flag('rdp-closed')).toBe(true);
      expect(rdp(dc(), '192.0.2.2')).toBe(true);
      expect(rdp(dc(), '192.0.2.210')).toBe(false);
      play([
        "Set-Content Documents\\audit.ps1 -Value 'function Close-DormantAccount {', '  param([Parameter(ValueFromPipeline)] $Account)', '  process {', '    Disable-ADAccount $Account', '    Get-ADPrincipalGroupMembership $Account | Where-Object Name -ne ''Domain Users'' | ForEach-Object { Remove-ADPrincipalGroupMembership $Account -MemberOf $_ -Confirm:$false }', '    Move-ADObject $Account -TargetPath ''OU=Leavers,DC=lending,DC=internal''', '  }', '}'",
        '. .\\Documents\\audit.ps1',
      ]);
      play([`${SEARCH} | ConvertTo-Csv -NoTypeInformation | Out-File Documents\\inactive.csv`]);
      expect(flag('report')).toBe(true);
      play([`${SEARCH} | Close-DormantAccount`]);
      expect(flag('closed')).toBe(true);
      play(["Get-ADGroup -Filter \"Name -like 'GG_*' -or Name -like 'DL_*'\" | ForEach-Object { Remove-ADGroupMember $_ -Members oadeyemi -Confirm:$false -ErrorAction SilentlyContinue }"]);
      expect(flag('leftover')).toBe(true);
      expect(c.finished).toContain('dormant-accounts');
    });

    it('chapter 4 — false leads: a profile off, the whole network, your own ssh (back through the GPO), too short a TimeSpan, svc_backup, krbtgt, a deletion', () => {
      const { c, play, flag, dc } = part(AFTER_3);
      play(['ssh stacks', 'yes', 'Set-NetFirewallProfile -Profile Domain -Enabled False']);
      expect(flag('profile-off')).toBe(true);
      expect(rdp(dc(), '198.51.100.77')).toBe(true);
      play(['Set-NetFirewallProfile -Profile Domain -Enabled True', "Set-NetFirewallRule -DisplayName 'Remote Desktop - Any' -RemoteAddress LocalSubnet"]);
      expect(flag('lan-wide')).toBe(true);
      expect(flag('rdp-closed')).toBe(false);
      play(["Set-NetFirewallRule -DisplayName 'Remote Desktop - Any' -Enabled False"]);
      expect(flag('rdp-closed')).toBe(true);
      // Your own door: the session holds, the next one doesn't.
      const cut = play(['Disable-NetFirewallRule -Name OpenSSH-Server-In-TCP']);
      contains(cut, 'avant de sortir');
      expect(flag('ssh-cut')).toBe(true);
      play(['exit']);
      expect(play(['ssh stacks'])).toMatch(/timed out/);
      // The servers' firewall GPO opens it again at its next refresh.
      const back = play(["New-NetFirewallRule -DisplayName 'Admin ssh from register' -Direction Inbound -Protocol TCP -LocalPort 22 -RemoteAddress 192.0.2.46 -Action Allow -PolicyStore 'lending.internal\\Server Firewall'"]);
      contains(back, 'arrière-plan');
      expect(play(['ssh stacks'])).toContain('Windows PowerShell');
      play(['exit']);
      // Too short: Leila, on leave since December.
      const short = play(['Search-ADAccount -AccountInactive -TimeSpan 30.00:00:00 -UsersOnly | Select-Object -ExpandProperty SamAccountName']);
      expect(short).toContain('lhassan');
      expect(flag('too-short')).toBe(true);
      play(['Disable-ADAccount lhassan']);
      expect(flag('active-touched')).toBe(true);
      play(['Enable-ADAccount lhassan']);
      // Everything inactive, without looking: svc_backup and the built-in accounts with them.
      play([`Search-ADAccount -AccountInactive -TimeSpan 90.00:00:00 -UsersOnly | Disable-ADAccount`]);
      expect(flag('service-touched')).toBe(true);
      play(['Enable-ADAccount svc_backup', `Get-ADUser krbtgt | Move-ADObject -TargetPath '${LEAVERS_OU}'`]);
      expect(flag('builtin-touched')).toBe(true);
      play([`Move-ADObject 'CN=krbtgt,${LEAVERS_OU}' -TargetPath 'CN=Users,DC=lending,DC=internal'`]);
      // Deleting pmorel instead of closing him: the Recycle Bin brings him back.
      const gone = play(['Remove-ADUser pmorel -Confirm:$false']);
      contains(gone, 'corbeille');
      expect(flag('deleted')).toBe(true);
      play(["Get-ADObject -Filter 'SamAccountName -eq \"pmorel\"' -IncludeDeletedObjects | Restore-ADObject"]);
      play([
        `${SEARCH} | Select-Object SamAccountName, Name | Export-Csv Documents\\report.csv -NoTypeInformation`,
        `${SEARCH} | ForEach-Object { Disable-ADAccount $_; Remove-ADPrincipalGroupMembership $_ -MemberOf (Get-ADPrincipalGroupMembership $_ | Where-Object Name -ne 'Domain Users') -Confirm:$false; Move-ADObject $_ -TargetPath '${LEAVERS_OU}' }`,
        'Remove-ADPrincipalGroupMembership oadeyemi -MemberOf GG_Lending, DL_Staff_RW -Confirm:$false',
      ]);
      expect(flag('closed')).toBe(true);
      expect(c.finished).toContain('dormant-accounts');
    });
  });
