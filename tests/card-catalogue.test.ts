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
      expect(play(["Get-ScheduledTask | Select-Object TaskName, @{n='User';e={$_.Principal.UserId}}"])).toMatch(/Scan Import LENDING\\rsilva/);
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
  });
