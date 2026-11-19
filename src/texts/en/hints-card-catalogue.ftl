### Graded hints for The Card Catalogue (see src/engine/hints.ts): one
### message per step, hint-<chapter>-<event>, with .lead (a direction) and
### .solution (almost the answer).

## Chapter 1 — Comings and Goings

hint-comings-and-goings-ous =
    .lead = Read the tickets and Tomas's conventions (Documents), then look at the domain's OUs (Get-Command -Module ActiveDirectory, Get-Help Get-ADOrganizationalUnit).
    .solution = Get-ADOrganizationalUnit -Filter * | Select-Object DistinguishedName: Riverside is OU=Riverside,OU=Branches,DC=lending,DC=internal.
hint-comings-and-goings-colleague =
    .lead = HR says "same as Amara": look at what Amara's account is a member of before copying anything (Get-Help Get-ADPrincipalGroupMembership).
    .solution = Get-ADPrincipalGroupMembership aokoye | Select-Object name: GG_Children, but also GG_Management and DL_Finance_RW.
hint-comings-and-goings-agdlp =
    .lead = Which groups hold people, which hold groups? Look inside a DL_ group (Get-Help Get-ADGroupMember).
    .solution = Get-ADGroupMember DL_Events_RW: GG_Children and GG_Management. A youth librarian goes into GG_Children only.
hint-comings-and-goings-created =
    .lead = Create Kofi's account with everything the ticket and the conventions ask, in one command (Get-Help New-ADUser -Examples; a SecureString: Get-Help ConvertTo-SecureString).
    .solution = New-ADUser -Name 'Kofi Mensah' -GivenName Kofi -Surname Mensah -SamAccountName kmensah -Path 'OU=Riverside,OU=Branches,DC=lending,DC=internal' -Department Children -Title 'Youth Librarian' -Manager iduarte -AccountPassword (ConvertTo-SecureString 'A-long-2030-Phrase' -AsPlainText -Force) -ChangePasswordAtLogon $true -Enabled $true
hint-comings-and-goings-arrival =
    .lead = Now his group: his department's global group, and nothing else (Get-Help Add-ADGroupMember).
    .solution = Add-ADGroupMember GG_Children kmensah, then Get-ADPrincipalGroupMembership kmensah to check: Domain Users and GG_Children.
hint-comings-and-goings-leaver-disabled =
    .lead = Mateo: the conventions say never delete a leaver. First, make sure nobody can log on with his account (Get-Help Disable-ADAccount).
    .solution = Disable-ADAccount mrossi
hint-comings-and-goings-leaver-groups =
    .lead = What is Mateo still a member of? Take him out of it (Get-Help Remove-ADPrincipalGroupMembership, or Remove-ADGroupMember).
    .solution = Get-ADPrincipalGroupMembership mrossi, then Remove-ADPrincipalGroupMembership mrossi -MemberOf GG_Lending -Confirm:$false (Domain Users, his primary group, stays).
hint-comings-and-goings-end =
    .lead = Last, where leavers wait: an OU of their own (Get-Help Move-ADObject). Check Kofi's account against the ticket too.
    .solution = Get-ADUser mrossi | Move-ADObject -TargetPath 'OU=Leavers,DC=lending,DC=internal'

## Chapter 2 — The Stale Password

hint-stale-password-locked =
    .lead = Is Rafael's account locked, or disabled? The ActiveDirectory module can list locked accounts (Get-Help Search-ADAccount).
    .solution = Search-ADAccount -LockedOut: rsilva.
hint-stale-password-bad-logons =
    .lead = How many wrong passwords, and when was the last one? Those are properties Get-ADUser only shows when asked (Get-Help Get-ADUser -Parameter Properties).
    .solution = Get-ADUser rsilva -Properties LockedOut, BadLogonCount, LastBadPasswordAttempt, PasswordLastSet
hint-stale-password-caller =
    .lead = The domain controller logs each lockout in its Security log, with the computer the wrong password came from (Get-Help Get-WinEvent: -FilterHashtable; the lockout event is 4740).
    .solution = Get-WinEvent -FilterHashtable @{"{"}LogName='Security'; Id=4740{"}"} -MaxEvents 1 | Format-List Message: Caller Computer Name: STACKS.
hint-stale-password-on-stacks =
    .lead = Go and look on that computer: Windows Server has an OpenSSH client too (man ssh).
    .solution = ssh stacks (yes to the host key), then Get-WinEvent -FilterHashtable @{"{"}LogName='Security'; Id=4625{"}"} -MaxEvents 1 | Format-List Message.
hint-stale-password-task =
    .lead = Logon type 4 is a batch logon: what runs on a schedule there, and as whom (Get-Help Get-ScheduledTask; the account is in its Principal)?
    .solution = Get-ScheduledTask | Select-Object TaskName, @{"{"}n='User';e={"{"}$_.Principal.UserId{"}"}{"}"}, or schtasks /query /v /fo list: Scan Import runs as LENDING\rsilva.
hint-stale-password-fixed =
    .lead = The task needs an account of its own, not Rafael's: Tomas made one, its password is in the vault Nandini exported (Get-Help Set-ScheduledTask).
    .solution = Set-ScheduledTask 'Scan Import' -User 'LENDING\svc_scans' -Password '<the vault's password>' (or schtasks /change /tn "Scan Import" /ru LENDING\svc_scans /rp …).
hint-stale-password-end =
    .lead = The source is fixed: now give Rafael his account back, from register (Get-Help Unlock-ADAccount).
    .solution = exit (back to register), then Unlock-ADAccount rsilva.
