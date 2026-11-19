// The Windows engine, step 2: Active Directory and Group Policy, on the
// test domain HARBOUR (tests/ad-fixture.ts): users, groups, OUs and their
// filters; nested groups in the tokens of share and NTFS permissions; the
// lockout after five wrong passwords (event 4740 with the caller computer),
// Unlock-ADAccount, Search-ADAccount; GPO links, blocked inheritance,
// enforcement, security filtering, gpupdate and gpresult; the help pages of
// the ActiveDirectory and GroupPolicy modules.

import { describe, expect, it } from 'vitest';
import type { Shell } from '../src/engine/shell';
import { harbour, CLOCK } from './ad-fixture';
import { windowsLogin } from '../src/engine/windows-accounts';
import { shareAccess, token } from '../src/engine/windows-acl';
import { windows } from '../src/engine/windows';
import { domainOf, findIdentity, lockedOut } from '../src/engine/windows-ad';
import { applyPolicy, resultant, appliedSettings } from '../src/engine/windows-gpo';
import { CMDLETS } from '../src/engine/commands/powershell';
import { NATIVES } from '../src/engine/commands/windows-natives';
import { COMMANDS } from '../src/engine/commands';
import { pageMan } from '../src/engine/commands/manual';
import { LANGUAGES, translator } from '../src/texts';

const run = (s: Shell, ...lines: string[]) => lines.map((l) => s.execute(l) ?? '').filter(Boolean).join('\n');

function domain() {
  const h = harbour();
  const dc = h.host('dc01');
  const files = h.host('files');
  windowsLogin(dc);
  return { ...h, dc, files };
}

describe('Active Directory: users, groups, OUs', () => {
  it("Get-ADUser: the module's default properties, sorted; -Properties; a missing identity stops", () => {
    const { dc } = domain();
    expect(run(dc, 'Get-ADUser alice')).toBe(
      [
        '',
        'DistinguishedName : CN=Alice Martin,OU=Pilots,OU=Staff,DC=harbour,DC=internal',
        'Enabled           : True',
        'GivenName         : Alice',
        'Name              : Alice Martin',
        'ObjectClass       : user',
        `ObjectGUID        : ${findIdentity(domainOf(dc)!.ad, 'alice')!.guid}`,
        'SamAccountName    : alice',
        `SID               : ${domainOf(dc)!.ad.sid}-1106`,
        'Surname           : Martin',
        'UserPrincipalName : alice@harbour.internal',
      ].join('\n'),
    );
    expect(run(dc, 'Get-ADUser bob -Properties Manager, Department | Select-Object Department, Manager')).toMatch(/Office +CN=Alice Martin,OU=Pilots,OU=Staff,DC=harbour,DC=internal/);
    expect(run(dc, 'Get-ADUser alice -Properties *')).toMatch(/^LockedOut +: False$/m);
    expect(run(dc, 'Get-ADUser alice -Properties Shoesize')).toContain('One or more properties are invalid.');
    const missing = run(dc, 'Get-ADUser nobody -ErrorAction SilentlyContinue');
    expect(missing).toContain("Get-ADUser : Cannot find an object with identity: 'nobody' under: 'DC=harbour,DC=internal'.");
    expect(missing).toContain('ActiveDirectoryCmdlet:Microsoft.ActiveDirectory.Management.ADIdentityNotFoundException,Microsoft.ActiveDirectory.Management.Commands.GetADUser');
    // By DN, by SID, by UPN-less name: the same account.
    const sid = run(dc, '(Get-ADUser alice).SID');
    expect(run(dc, `Get-ADUser ${sid} | Select-Object -ExpandProperty SamAccountName`, "Get-ADUser 'CN=Alice Martin,OU=Pilots,OU=Staff,DC=harbour,DC=internal' | Select-Object -ExpandProperty SamAccountName")).toBe('alice\nalice');
  });

  it('-Filter (the expression language, script blocks, $variables), -LDAPFilter, -SearchBase', () => {
    const { dc } = domain();
    expect(run(dc, "Get-ADUser -Filter \"Department -eq 'Pilotage'\" | Select-Object -ExpandProperty SamAccountName")).toBe('alice\ncarla');
    expect(run(dc, "Get-ADUser -Filter {Department -eq 'Pilotage' -and Enabled -eq $true} | Select-Object -ExpandProperty SamAccountName")).toBe('alice');
    expect(run(dc, '$dept = "Office"', 'Get-ADUser -Filter {Department -eq $dept} | Select-Object -ExpandProperty Name')).toBe('Bob Diallo');
    expect(run(dc, "Get-ADUser -Filter \"Name -like 'Bob*' -or Surname -eq 'Ivanov'\" | Select-Object -ExpandProperty SamAccountName")).toBe('bob\ndmitri');
    expect(run(dc, "Get-ADUser -LDAPFilter '(&(objectClass=user)(title=Pilot))' | Select-Object -ExpandProperty SamAccountName")).toBe('alice');
    expect(run(dc, "Get-ADUser -LDAPFilter '(userAccountControl:1.2.840.113556.1.4.803:=2)' -SearchBase 'OU=Staff,DC=harbour,DC=internal' | Select-Object -ExpandProperty SamAccountName")).toBe('carla');
    expect(run(dc, "Get-ADUser -Filter * -SearchBase 'OU=Pilots,OU=Staff,DC=harbour,DC=internal' | Measure-Object | Select-Object -ExpandProperty Count")).toBe('2');
    const bad = run(dc, "Get-ADUser -Filter \"Name -contains 'x'\"");
    expect(bad).toContain("Error parsing query: 'Name -contains 'x'' Error Message: 'Operator Not supported: -contains'");
    expect(bad).toContain('ADFilterParsingException');
    expect(run(dc, 'Get-ADComputer -Filter * | Select-Object -ExpandProperty Name')).toBe('DC01\nFILES');
    // Dates compare as dates: a $variable holding one, read by the module from the session.
    expect(run(dc, '$since = (Get-Date).AddDays(-90)', 'Get-ADUser -Filter {LastLogonDate -lt $since -and Enabled -eq $true} | Select-Object -ExpandProperty SamAccountName')).toBe('dmitri');
    expect(run(dc, 'Get-ADOrganizationalUnit -Filter "Name -like \'*s\'" | Select-Object -ExpandProperty Name')).toBe('Domain Controllers\nServers\nContractors\nPilots');
  });

  it('New-ADUser: disabled by default, a refused password leaves it created and disabled; Set-, Enable-, Remove-ADUser', () => {
    const { dc } = domain();
    const weak = run(dc, "New-ADUser -Name 'Eve Moreau' -SamAccountName eve -AccountPassword (ConvertTo-SecureString 'short' -AsPlainText -Force) -Enabled $true");
    expect(weak).toContain('The password does not meet the length, complexity, or history requirement of the domain.');
    expect(run(dc, 'Get-ADUser eve | Select-Object -ExpandProperty Enabled')).toBe('False');
    // The domain's complexity: not the account's name (eve) nor a part of the full name.
    expect(run(dc, "Set-ADAccountPassword eve -Reset -NewPassword (ConvertTo-SecureString 'Eve-2029-pw' -AsPlainText -Force)")).toContain('The password does not meet the length, complexity, or history requirement of the domain.');
    run(dc, "Set-ADAccountPassword eve -Reset -NewPassword (ConvertTo-SecureString 'Quay-2029-pw!' -AsPlainText -Force)", 'Enable-ADAccount eve');
    expect(run(dc, 'Get-ADUser eve | Select-Object -ExpandProperty Enabled')).toBe('True');
    run(dc, "New-ADUser -Name 'Farid Ali' -GivenName Farid -Surname Ali -SamAccountName farid -Path 'OU=Office,OU=Staff,DC=harbour,DC=internal' -AccountPassword (ConvertTo-SecureString 'Farid-2029-pw' -AsPlainText -Force) -Enabled $true -ChangePasswordAtLogon $true");
    expect(run(dc, 'Get-ADUser farid -Properties PasswordExpired, PasswordLastSet | Select-Object PasswordExpired, PasswordLastSet')).toMatch(/True\s*$/m);
    expect(run(dc, "New-ADUser -Name 'Farid Ali' -Path 'OU=Office,OU=Staff,DC=harbour,DC=internal'")).toContain('The specified account already exists');
    run(dc, "Set-ADUser bob -Title 'Head clerk' -Replace @{physicalDeliveryOfficeName='Quay 2'}");
    expect(run(dc, 'Get-ADUser bob -Properties Title, Office | Select-Object Title, Office')).toMatch(/Head clerk +Quay 2/);
    expect(run(dc, 'Remove-ADUser dmitri -WhatIf')).toBe('What if: Performing the operation "Remove" on target "CN=Dmitri Ivanov,OU=Contractors,DC=harbour,DC=internal".');
    // Without -Confirm:$false it asks (ConfirmImpact High).
    expect(run(dc, 'Remove-ADUser dmitri')).toContain('Performing the operation "Remove" on target "CN=Dmitri Ivanov,OU=Contractors,DC=harbour,DC=internal".');
    run(dc, 'N');
    expect(run(dc, 'Remove-ADUser dmitri -Confirm:$false', 'Get-ADUser -Filter "SamAccountName -eq \'dmitri\'"')).toBe('');
  });

  it('groups: members, nesting (-Recursive), Add-/Remove-ADGroupMember, Get-ADPrincipalGroupMembership, New-ADGroup', () => {
    const { dc } = domain();
    expect(run(dc, "Get-ADGroupMember 'Docs Editors' | Select-Object -ExpandProperty name")).toBe('Pilots');
    expect(run(dc, "Get-ADGroupMember 'Docs Editors' -Recursive | Select-Object -ExpandProperty SamAccountName")).toBe('alice\ncarla');
    expect(run(dc, "Get-ADGroupMember 'Docs Editors'")).toMatch(/^distinguishedName : CN=Pilots,OU=Staff,DC=harbour,DC=internal$/m);
    expect(run(dc, 'Get-ADPrincipalGroupMembership bob | Select-Object -ExpandProperty name')).toBe('Domain Users\nOffice Staff');
    expect(run(dc, 'Get-ADGroup "Docs Editors" | Select-Object GroupScope, GroupCategory')).toMatch(/DomainLocal +Security/);
    run(dc, "New-ADGroup 'Docs Readers' -GroupScope DomainLocal -Path 'OU=Staff,DC=harbour,DC=internal'", "Add-ADGroupMember -Identity 'Docs Readers' -Members 'Office Staff'");
    expect(run(dc, "Get-ADGroupMember 'Docs Readers' -Recursive | Select-Object -ExpandProperty SamAccountName")).toBe('bob');
    expect(run(dc, "Add-ADGroupMember 'Docs Readers' 'Office Staff'")).toContain('The specified account name is already a member of the group');
    expect(run(dc, "Add-ADGroupMember 'Docs Readers' ghost")).toContain("Cannot find an object with identity: 'ghost'");
    run(dc, "Remove-ADGroupMember Pilots carla -Confirm:$false");
    expect(run(dc, 'Get-ADGroupMember Pilots | Select-Object -ExpandProperty SamAccountName')).toBe('alice');
    expect(run(dc, "New-ADGroup Bad -GroupScope Planet")).toContain('Unable to match the identifier name Planet to a valid enumerator name.');
  });

  it('OUs: New-ADOrganizationalUnit protected, Remove refused, Move-ADObject', () => {
    const { dc } = domain();
    run(dc, "New-ADOrganizationalUnit Workstations -Path 'DC=harbour,DC=internal'");
    expect(run(dc, "Get-ADOrganizationalUnit 'OU=Workstations,DC=harbour,DC=internal' -Properties ProtectedFromAccidentalDeletion | Select-Object -ExpandProperty ProtectedFromAccidentalDeletion")).toBe('True');
    expect(run(dc, "Remove-ADOrganizationalUnit 'OU=Workstations,DC=harbour,DC=internal' -Confirm:$false")).toContain('Access is denied');
    run(dc, "Set-ADOrganizationalUnit 'OU=Workstations,DC=harbour,DC=internal' -ProtectedFromAccidentalDeletion $false", "Remove-ADOrganizationalUnit 'OU=Workstations,DC=harbour,DC=internal' -Confirm:$false");
    expect(run(dc, "Get-ADOrganizationalUnit -Filter \"Name -eq 'Workstations'\"")).toBe('');
    expect(run(dc, "Remove-ADOrganizationalUnit 'OU=Staff,DC=harbour,DC=internal' -Confirm:$false")).toContain('Access is denied');
    run(dc, "Get-ADUser bob | Move-ADObject -TargetPath 'OU=Pilots,OU=Staff,DC=harbour,DC=internal'");
    expect(run(dc, 'Get-ADUser bob | Select-Object -ExpandProperty DistinguishedName')).toBe('CN=Bob Diallo,OU=Pilots,OU=Staff,DC=harbour,DC=internal');
    expect(run(dc, "Get-ADUser bob -Properties CanonicalName | Select-Object -ExpandProperty CanonicalName")).toBe('harbour.internal/Staff/Pilots/Bob Diallo');
  });

  it('the domain: Get-ADDomain, Get-ADDomainController, the password policy', () => {
    const { dc } = domain();
    expect(run(dc, 'Get-ADDomain | Select-Object DNSRoot, NetBIOSName, PDCEmulator')).toMatch(/harbour\.internal +HARBOUR +dc01\.harbour\.internal/);
    expect(run(dc, 'Get-ADDomainController | Select-Object HostName, IPv4Address')).toMatch(/dc01\.harbour\.internal +192\.0\.2\.70/);
    const policy = run(dc, 'Get-ADDefaultDomainPasswordPolicy');
    expect(policy).toMatch(/^LockoutDuration +: 00:30:00$/m);
    expect(policy).toMatch(/^LockoutThreshold +: 5$/m);
    expect(policy).toMatch(/^MaxPasswordAge +: 42\.00:00:00$/m);
    run(dc, 'Set-ADDefaultDomainPasswordPolicy harbour.internal -LockoutThreshold 10 -LockoutDuration 00:15:00');
    expect(run(dc, '(Get-ADDefaultDomainPasswordPolicy).LockoutThreshold', '(Get-ADDefaultDomainPasswordPolicy).LockoutDuration.TotalMinutes')).toBe('10\n15');
  });

  it('the module is on the domain controller; on a member only with the tools; net user /domain', () => {
    const { files } = domain();
    expect(run(files, 'Get-ADUser alice')).toContain("The term 'Get-ADUser' is not recognized");
    const tooled = harbour({ files: { domain: { dns: 'harbour.internal', netbios: 'HARBOUR', dc: 'dc01', tools: true } } }).host('files');
    expect(run(tooled, 'Get-ADUser alice | Select-Object -ExpandProperty Name')).toBe('Alice Martin');
    const net = run(files, 'net user bob /domain');
    expect(net).toContain('The request will be processed at a domain controller for domain harbour.internal.');
    expect(net).toMatch(/Global Group memberships +\*Domain Users +\*Office Staff/);
    expect(run(files, 'net user /domain')).toContain('User accounts for \\\\DC01.harbour.internal');
  });
});

describe('Active Directory: logons, tokens and the lockout', () => {
  it('a domain account in tokens: nested groups give share and NTFS access on the member', () => {
    const { files } = domain();
    const docs = windows(files).shares.find((s) => s.name === 'Docs')!;
    // alice: Pilots, which is in Docs Editors (Modify on the folder).
    expect(token(files, 'HARBOUR\\alice').has('HARBOUR\\Docs Editors')).toBe(true);
    expect(token(files, 'alice@harbour.internal').has('HARBOUR\\Domain Users')).toBe(true);
    const tides = '/D/Shares/Docs/tides.txt';
    expect(shareAccess(files, docs, tides, 'HARBOUR\\alice', 'write')).toBe(true);
    expect(shareAccess(files, docs, tides, 'HARBOUR\\bob', 'write')).toBe(false);
    expect(shareAccess(files, docs, tides, 'HARBOUR\\bob', 'read')).toBe(true);
    // The player: a Domain Admin, so an administrator of the member.
    expect(run(files, 'whoami')).toBe('harbour\\you');
    expect(run(files, 'whoami /groups')).toMatch(/HARBOUR\\Domain Admins +Group/);
    expect(token(files, 'you').has('BUILTIN\\Administrators')).toBe(true);
    // icacls takes domain groups.
    expect(run(files, 'icacls D:\\Shares\\Docs /grant "HARBOUR\\Office Staff:(OI)(CI)(M)"')).toContain('Successfully processed 1 files');
    expect(shareAccess(files, docs, tides, 'HARBOUR\\bob', 'write')).toBe(true);
  });

  it('five wrong passwords lock the account: 4740 on the domain controller with the caller, 4625 on the member; Unlock-ADAccount', () => {
    const { bridge, dc, files } = domain();
    for (let i = 0; i < 4; i++) expect(run(bridge, "smbclient //files/Docs -U 'HARBOUR\\bob%wrong' -c ls")).toBe('session setup failed: NT_STATUS_LOGON_FAILURE');
    expect(run(dc, 'Get-ADUser bob -Properties BadLogonCount, LockedOut | Select-Object BadLogonCount, LockedOut')).toMatch(/4 +False/);
    run(bridge, "smbclient //files/Docs -U 'HARBOUR\\bob%wrong' -c ls");
    const ad = domainOf(dc)!.ad;
    expect(lockedOut(ad, findIdentity(ad, 'bob')!, CLOCK)).toBe(true);
    // Locked: even the right password is refused.
    expect(run(bridge, "smbclient //files/Docs -U 'HARBOUR\\bob%Bob-2029-pw' -c ls")).toBe('session setup failed: NT_STATUS_LOGON_FAILURE');
    const lockout = run(dc, 'Get-WinEvent -FilterHashtable @{LogName="Security"; Id=4740} -MaxEvents 1 | Select-Object -ExpandProperty Message');
    expect(lockout).toContain('A user account was locked out.');
    expect(lockout).toContain('Account Name:\t\tbob');
    expect(lockout).toContain('Caller Computer Name:\tBRIDGE');
    expect(run(files, 'Get-WinEvent -FilterHashtable @{LogName="Security"; Id=4625} -MaxEvents 1 | Select-Object -ExpandProperty Message')).toContain('Failure Reason:\t\tAccount locked out.');
    expect(run(dc, 'Search-ADAccount -LockedOut | Select-Object -ExpandProperty SamAccountName')).toBe('bob');
    expect(run(files, 'net user bob /domain')).toMatch(/Account active +Locked/);
    // A password reset doesn't unlock.
    run(dc, "Set-ADAccountPassword bob -Reset -NewPassword (ConvertTo-SecureString 'Quay-2030-pw!' -AsPlainText -Force)");
    expect(run(dc, 'Search-ADAccount -LockedOut | Select-Object -ExpandProperty SamAccountName')).toBe('bob');
    run(dc, 'Unlock-ADAccount bob');
    expect(run(dc, 'Search-ADAccount -LockedOut')).toBe('');
    expect(run(bridge, "smbclient //files/Docs -U 'HARBOUR\\bob%Quay-2030-pw!' -c ls")).toContain('tides.txt');
    expect(run(dc, '(Get-ADUser bob -Properties BadLogonCount).BadLogonCount')).toBe('0');
  });

  it('ssh with a domain account: DOMAIN\\user or user@domain; wrong passwords count, the caller is the member', () => {
    const { bridge, dc } = domain();
    run(dc, 'Set-ADDefaultDomainPasswordPolicy harbour.internal -LockoutThreshold 3');
    expect(run(bridge, 'ssh bob@harbour.internal@files', 'yes', 'nope', 'nope', 'nope')).toContain('bob@harbour.internal@files: Permission denied (publickey,password).');
    expect(run(dc, 'Get-WinEvent -FilterHashtable @{LogName="Security"; Id=4740} -MaxEvents 1 | Select-Object -ExpandProperty Message')).toContain('Caller Computer Name:\tFILES');
    expect(run(bridge, "ssh 'HARBOUR\\alice'@files", 'Alice-2029-pw')).toBe('');
    // A disabled account is refused.
    expect(run(bridge, "ssh 'HARBOUR\\carla'@files", 'Carla-2029-pw', 'Carla-2029-pw', 'Carla-2029-pw')).toContain('Permission denied');
  });

  it('Search-ADAccount: disabled, inactive, password never expires', () => {
    const { dc } = domain();
    expect(run(dc, 'Search-ADAccount -AccountDisabled -UsersOnly | Select-Object -ExpandProperty SamAccountName')).toBe('Guest\nkrbtgt\ncarla');
    expect(run(dc, "Search-ADAccount -AccountInactive -TimeSpan 90.00:00:00 -UsersOnly -SearchBase 'DC=harbour,DC=internal' | Where-Object Enabled | Select-Object -ExpandProperty SamAccountName")).toBe('dmitri');
    expect(run(dc, 'Search-ADAccount -PasswordNeverExpires -UsersOnly | Where-Object Enabled | Select-Object -ExpandProperty SamAccountName')).toBe('Administrator\nsvc_backup');
    expect(run(dc, 'Search-ADAccount')).toContain('Parameter set cannot be resolved');
    expect(run(dc, 'Search-ADAccount -AccountDisabled -UsersOnly | Disable-ADAccount -WhatIf')).toContain('What if: Performing the operation "Set" on target "CN=Carla Nguyen');
  });
});

describe('Group Policy', () => {
  it('Get-GPO, Get-GPInheritance: link order, blocked inheritance, enforced links', () => {
    const { dc } = domain();
    expect(run(dc, "Get-GPO 'Default Domain Policy' | Select-Object -ExpandProperty Id")).toBe('31b2f340-016d-11d2-945f-00c04fb984f9');
    expect(run(dc, "Get-GPO 'Nope'")).toContain('The "Nope" GPO was not found in the harbour.internal domain.');
    const pilots = run(dc, "Get-GPInheritance -Target 'OU=Pilots,OU=Staff,DC=harbour,DC=internal'");
    expect(pilots).toMatch(/^Path +: ou=pilots,ou=staff,dc=harbour,dc=internal$/m);
    expect(pilots).toMatch(/^InheritedGpoLinks +: \{Security Baseline, Pilots Drive, Office Drive, Default Domain Policy\}$/m);
    const contractors = run(dc, "Get-GPInheritance -Target 'OU=Contractors,DC=harbour,DC=internal'");
    expect(contractors).toMatch(/^GpoInheritanceBlocked +: Yes$/m);
    // Blocked: the Default Domain Policy no longer reaches it; the enforced baseline still does.
    expect(contractors).toMatch(/^InheritedGpoLinks +: \{Security Baseline\}$/m);
    run(dc, "Set-GPInheritance -Target 'OU=Contractors,DC=harbour,DC=internal' -IsBlocked No");
    expect(run(dc, "(Get-GPInheritance -Target 'OU=Contractors,DC=harbour,DC=internal').InheritedGpoLinks")).toBe('Security Baseline\nDefault Domain Policy');
  });

  it('New-GPO, New-GPLink (order), Set-GPLink, Remove-GPLink', () => {
    const { dc } = domain();
    run(dc, "New-GPO 'Pilots Wallpaper' -Comment 'The harbour at dawn'");
    const link = run(dc, "New-GPLink 'Pilots Wallpaper' -Target 'OU=Pilots,OU=Staff,DC=harbour,DC=internal' -Order 1");
    expect(link).toMatch(/^Order +: 1$/m);
    expect(run(dc, "(Get-GPInheritance -Target 'OU=Pilots,OU=Staff,DC=harbour,DC=internal').GpoLinks")).toBe('Pilots Wallpaper\nPilots Drive');
    expect(run(dc, "New-GPLink 'Pilots Wallpaper' -Target 'OU=Pilots,OU=Staff,DC=harbour,DC=internal'")).toContain("is already linked to a Scope of Management with Path 'OU=Pilots,OU=Staff,DC=harbour,DC=internal'");
    run(dc, "Set-GPLink 'Pilots Wallpaper' -Target 'OU=Pilots,OU=Staff,DC=harbour,DC=internal' -LinkEnabled No");
    expect(run(dc, "(Get-GPInheritance -Target 'OU=Pilots,OU=Staff,DC=harbour,DC=internal').InheritedGpoLinks")).not.toContain('Pilots Wallpaper');
    run(dc, "Remove-GPLink 'Pilots Wallpaper' -Target 'OU=Pilots,OU=Staff,DC=harbour,DC=internal'");
    expect(run(dc, "Remove-GPLink 'Pilots Wallpaper' -Target 'OU=Pilots,OU=Staff,DC=harbour,DC=internal'")).toContain('is not linked to a Scope of Management');
  });

  it('the resulting policy: security filtering, a disabled link, an empty side; gpresult and net use', () => {
    const { dc, files } = domain();
    const ad = domainOf(dc)!.ad;
    const alice = findIdentity(ad, 'alice')!;
    const r = resultant(files, ad, alice.dn, 'user', token(files, 'HARBOUR\\alice'));
    expect(r.applied.map((e) => e.gpo.name)).toEqual(['Pilots Drive']);
    expect(r.filtered).toEqual([
      { name: 'Local Group Policy', reason: 'Not Applied (Empty)' },
      { name: 'Default Domain Policy', reason: 'Not Applied (Empty)' },
      { name: 'Old Login Script', reason: 'Disabled (Link)' },
      { name: 'Office Drive', reason: 'Denied (Security)' },
      { name: 'Security Baseline', reason: 'Not Applied (Empty)' },
    ]);
    applyPolicy(files, 'both', 'alice');
    const report = run(files, 'gpresult /r');
    expect(report).toContain('RSOP data for HARBOUR\\alice on FILES : Logging Mode');
    expect(report).toContain('    CN=FILES,OU=Servers,DC=harbour,DC=internal');
    expect(report).toMatch(/Applied Group Policy Objects\n {4}-+\n {8}Security Baseline\n {8}Server Firewall\n {8}Default Domain Policy/);
    expect(report).toContain('        Office Drive\n            Filtering:  Denied (Security)');
    expect(report).toContain('        Old Login Script\n            Filtering:  Disabled (Link)');
    expect(run(files, 'net use')).toMatch(/OK +P: +\\\\files\\Docs/);
    expect(appliedSettings(files, 'userRight')[0].right).toBe('SeDenyInteractiveLogonRight');
    expect(run(files, 'gpresult /r /scope:computer')).not.toContain('USER SETTINGS');
    expect(run(files, 'gpresult')).toContain('ERROR: Invalid Syntax.');
  });

  it('Set-GPPermission: security filtering decides; moving the computer changes what applies', () => {
    const { dc, files } = domain();
    run(dc, "Set-GPPermission 'Server Firewall' -TargetName 'Authenticated Users' -TargetType Group -PermissionLevel GpoRead -Replace");
    expect(run(dc, "Get-GPPermission 'Server Firewall' -TargetName 'Authenticated Users' -TargetType Group | Select-Object -ExpandProperty Permission")).toBe('GpoRead');
    run(files, 'gpupdate /target:computer');
    expect(run(files, 'gpresult /r /scope:computer')).toContain('        Server Firewall\n            Filtering:  Denied (Security)');
    run(dc, "Set-GPPermission 'Server Firewall' -TargetName FILES$ -TargetType Computer -PermissionLevel GpoApply");
    run(files, 'gpupdate /force');
    expect(run(files, 'gpresult /r /scope:computer')).toMatch(/Applied Group Policy Objects\n {4}-+\n {8}Security Baseline\n {8}Server Firewall/);
    // The computer moved out of Servers: the GPO linked there no longer reaches it.
    run(dc, "Get-ADComputer FILES | Move-ADObject -TargetPath 'CN=Computers,DC=harbour,DC=internal'", 'Invoke-GPUpdate -Computer FILES -Force');
    expect(run(files, 'gpresult /r /scope:computer')).not.toContain('Server Firewall');
    expect(run(files, 'Get-NetFirewallRule -DisplayName "Allow SMB*" -ErrorAction SilentlyContinue')).toBe('');
  });

  it('Get-GPOReport: XML or HTML, to a file or as text', () => {
    const { dc } = domain();
    const xml = run(dc, "Get-GPOReport 'Pilots Drive' -ReportType Xml");
    expect(xml).toContain('<Name>Pilots Drive</Name>');
    expect(xml).toContain('<SOMPath>harbour.internal/Staff/Pilots</SOMPath>');
    run(dc, "Get-GPOReport 'Server Firewall' -ReportType Html -Path C:\\Users\\you\\Documents\\firewall.html");
    expect(dc.read('/C/Users/you/Documents/firewall.html')).toContain('Allow SMB from the office');
    expect(run(dc, "Get-GPOReport 'Server Firewall' -ReportType Pdf")).toContain('Unable to match the identifier name Pdf');
  });
});

describe('The manual of the domain', () => {
  it('every cmdlet and program has its page, in every language (on the domain controller)', () => {
    for (const language of LANGUAGES) {
      const h = harbour();
      const dc = h.host('dc01');
      (dc as unknown as { t: unknown }).t = translator(language);
      for (const c of CMDLETS) {
        expect(COMMANDS[c.name]?.cmdlet, c.name).toBe(true);
        const help = run(dc, `Get-Help ${c.name}`);
        expect(help, c.name).toContain(c.name);
        expect(help, c.name).not.toContain('could not find');
      }
      for (const n of NATIVES.filter((x) => x.page)) expect(pageMan(n.page!, COMMANDS[n.page!], translator(language)), n.page).toMatch(/^[A-Z.]+\(CMD\)/);
    }
  });
  it('Get-Help -Examples of a module cmdlet, man on Linux', () => {
    const { dc, bridge } = domain();
    expect(run(dc, 'Get-Help Unlock-ADAccount -Examples')).toContain('Search-ADAccount -LockedOut');
    expect(run(dc, 'Get-Help Get-ADUser -Parameter Filter')).toContain('-Filter');
    expect(run(bridge, 'man gpresult')).toMatch(/^GPRESULT\(CMD\)/);
  });
});
