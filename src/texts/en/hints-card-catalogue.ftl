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
    .lead = The task needs an account of its own, not Rafael's: Tomas made one for this job (the service accounts' descriptions say which, Get-ADUser -Properties Description), its password is in the vault Nandini exported (Get-Help Set-ScheduledTask).
    .solution = Set-ScheduledTask 'Scan Import' -User 'LENDING\svc_scans' -Password '<the vault's password>' (or schtasks /change /tn "Scan Import" /ru LENDING\svc_scans /rp …).
hint-stale-password-end =
    .lead = The source is fixed: now give Rafael his account back, from register (Get-Help Unlock-ADAccount).
    .solution = exit (back to register), then Unlock-ADAccount rsilva.

## Chapter 3 — The Policy That Doesn't Apply

hint-unapplied-policy-josephine =
    .lead = What did Group Policy apply on Josephine's workstation? gpresult can read another computer's result for one user (man gpresult: /s, /user).
    .solution = gpresult /s HILL-DESK1 /user LENDING\jbaptiste /r: Staff Drives applied, Archives Drive filtered out, Events Drive nowhere.
hint-unapplied-policy-links =
    .lead = A GPO gpresult doesn't even list isn't linked above the person's OU. Where is Events Drive linked, and what reaches OU=Hilltop (Get-Help Get-GPInheritance, Get-GPOReport)?
    .solution = Get-GPInheritance -Target 'OU=Hilltop,OU=Branches,DC=lending,DC=internal' (no Events Drive), Get-GPOReport 'Events Drive' -ReportType Xml (LinksTo: Central).
hint-unapplied-policy-linked =
    .lead = Tomas's conventions say where a GPO for the staff is linked (Get-Help New-GPLink).
    .solution = New-GPLink 'Events Drive' -Target 'OU=Branches,DC=lending,DC=internal', then Remove-GPLink 'Events Drive' -Target 'OU=Central,OU=Branches,DC=lending,DC=internal'.
hint-unapplied-policy-nandini =
    .lead = Nandini is at Central, where the link has always been. What does her workstation say about Events Drive?
    .solution = gpresult /s CENTRAL-DESK1 /user LENDING\nmukherjee /r: Events Drive, Filtering: Denied (Security).
hint-unapplied-policy-filtering =
    .lead = Denied (Security) is security filtering: who has Apply Group Policy on the GPO (Get-Help Get-GPPermission)? And who is the Events share for (Get-ADGroupMember DL_Events_RW)?
    .solution = Get-GPPermission 'Events Drive' -All: GpoApply for GG_Children only; DL_Events_RW holds GG_Children and GG_Management.
hint-unapplied-policy-filtered =
    .lead = Give the missing group the right to apply it, without opening it to everyone (Get-Help Set-GPPermission -Examples).
    .solution = Set-GPPermission 'Events Drive' -TargetName GG_Management -TargetType Group -PermissionLevel GpoApply
hint-unapplied-policy-end =
    .lead = The directory is right; the workstations apply it at their next refresh. Ask one now, then check (Get-Help Invoke-GPUpdate).
    .solution = Invoke-GPUpdate -Computer HILL-DESK1 -Target User, then gpresult /s HILL-DESK1 /user LENDING\jbaptiste /r: Events Drive applied.

## Chapter 4 — Doors and Dormant Accounts

hint-dormant-accounts-rdp-found =
    .lead = Read the audit in Documents, then go and look at stacks' firewall: which enabled inbound rule lets 3389 in (Get-Help Get-NetFirewallRule, Get-NetFirewallPortFilter)?
    .solution = ssh stacks, then Get-NetFirewallPortFilter | Where-Object LocalPort -eq 3389 | Get-NetFirewallRule | Where-Object Enabled -eq True: "Remote Desktop - Any"; Get-NetFirewallAddressFilter shows RemoteAddress Any.
hint-dormant-accounts-rdp-closed =
    .lead = Nobody uses Remote Desktop any more: close that rule, not the profile, and keep your own way in (Get-Help Disable-NetFirewallRule, Set-NetFirewallRule).
    .solution = Disable-NetFirewallRule -DisplayName 'Remote Desktop - Any' (or Set-NetFirewallRule -DisplayName 'Remote Desktop - Any' -RemoteAddress 192.0.2.2), then exit.
hint-dormant-accounts-inactive =
    .lead = Back on register: which accounts haven't logged on for 90 days (Get-Help Search-ADAccount; a TimeSpan is written days.hours:minutes:seconds)?
    .solution = Search-ADAccount -AccountInactive -TimeSpan 90.00:00:00 -UsersOnly | Select-Object SamAccountName, Enabled, LastLogonDate, DistinguishedName
hint-dormant-accounts-service-account =
    .lead = Before closing anything: what is svc_backup for? Its description, and what runs as it on stacks.
    .solution = Get-ADUser svc_backup -Properties Description, or on stacks: Get-ScheduledTask | Select-Object TaskName, @{"{"}n='User';e={"{"}$_.Principal.UserId{"}"}{"}"} (Offsite Copy, every 1 April).
hint-dormant-accounts-closed =
    .lead = Keep the search to the people (-SearchBase), then for each account: disable, take out of its groups but Domain Users, move to Leavers. A function or a foreach loop (Get-Help ForEach-Object).
    .solution = $old = Search-ADAccount -AccountInactive -TimeSpan 90.00:00:00 -UsersOnly -SearchBase 'OU=Branches,DC=lending,DC=internal'; foreach ($a in $old) {"{"} Disable-ADAccount $a; Get-ADPrincipalGroupMembership $a | Where-Object Name -ne 'Domain Users' | ForEach-Object {"{"} Remove-ADGroupMember $_ $a -Confirm:$false {"}"}; Move-ADObject $a -TargetPath 'OU=Leavers,DC=lending,DC=internal' {"}"}
hint-dormant-accounts-leftover =
    .lead = The audit asks whether your leavers are really out of their groups. Look at Leavers' accounts (Get-ADPrincipalGroupMembership).
    .solution = Remove-ADPrincipalGroupMembership oadeyemi -MemberOf GG_Lending, DL_Staff_RW -Confirm:$false
hint-dormant-accounts-report =
    .lead = The auditors want a CSV file: the same search, the columns they ask for (Get-Help Export-Csv -Examples).
    .solution = $old | Select-Object SamAccountName, Name, LastLogonDate | Export-Csv C:\Users\you\Documents\dormant-accounts.csv -NoTypeInformation, then Import-Csv to check.
hint-dormant-accounts-end =
    .lead = Check each point of the audit: stacks' 3389 closed (and your ssh open), the two people closed, Olu's groups, the report; nothing else changed.
    .solution = Search-ADAccount -AccountInactive -TimeSpan 90.00:00:00 -UsersOnly | Select-Object SamAccountName, Enabled, DistinguishedName; Get-ADPrincipalGroupMembership for each; Import-Csv on the report.
