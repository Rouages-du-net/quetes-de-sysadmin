### Story "The Card Catalogue", chapter "Doors and Dormant Accounts": the
### city's yearly audit: Remote Desktop open to the Internet on the file
### server, and the accounts nobody used for 90 days, closed with a small
### script and listed in a CSV report.
### Commands, cmdlets, account names, addresses, paths and outputs are not
### translated.

chapter-dormant-accounts = Doors and Dormant Accounts
    .summary = The city's IT security team found Remote Desktop open to the Internet on the file server, and wants the accounts nobody used for 90 days closed, with a report. Close the door without locking yourself out, then write a small script that closes the dormant accounts, and only them.

## Files

dormant-accounts-email-nandini =
    From:  Nandini Mukherjee (network director)
    To:    you

    Good morning,

    The city's IT security team sent us their yearly audit (in your
    Documents). Two things for us, by Friday. Mind the second one:
    last year Tomas closed an account the archives still needed, and
    we only found out in April.

    The report they want goes in your Documents too, as a CSV file: it
    goes straight into their spreadsheet.

    Nandini

# { $scanner }: the scanner's address (not translated).
dormant-accounts-audit =
    City of the libraries - IT security - yearly audit 2030
    Network: public libraries (LENDING)

    1. EXTERNAL SCAN (quarterly, from { $scanner })
       The libraries' public address answers on TCP 3389 (Remote
       Desktop). The router forwards it to an internal server.
       Remote Desktop must never be reachable from the Internet, nor
       from the public kiosks. Administration only from the IT
       workstation (192.0.2.2).

    2. DORMANT ACCOUNTS
       Accounts of people with no logon for 90 days or more:
         - disable them, move them to your leavers' OU, remove them
           from every group (the primary group excepted);
         - send us the list as a CSV file (account name, name, last
           logon).
       Do not touch service accounts without checking what uses them.
       Check, too, that your leavers really are out of their groups.

dormant-accounts-gpo-refresh =
    Ninety minutes later, stacks refreshes its policy in the background:
    the rule from the servers' GPO lets register in again on port 22.
    (In real life, someone may have had to drive to the server room.)

## Events

dormant-accounts-event-rdp-found =
    "Remote Desktop - Any": TCP 3389, from Any address, on every
    profile. Tomas made it in 2028 to work from home, and the router
    still forwards the port: anyone on the Internet can try passwords on
    stacks' Remote Desktop, and so can anyone at a public kiosk. The
    built-in Remote Desktop rules are off; this one isn't. Does anyone
    still use Remote Desktop? You come in with ssh.
dormant-accounts-event-profile-off =
    A firewall profile is off: on that network, stacks now accepts
    everything, every port, from everyone. The door you were asked to
    close is wide open, and so is every other. Turn it back on
    (Set-NetFirewallProfile -Enabled True) and deal with the one rule.
dormant-accounts-event-ssh-cut =
    Careful: stacks' firewall no longer lets register in on port 22.
    Your session holds (an open connection stays open), but the next
    ssh stacks will time out. Put it back now (Get-NetFirewallRule
    -Name OpenSSH-Server-In-TCP, Enable-NetFirewallRule,
    Set-NetFirewallRule -RemoteAddress), before you exit.
# { $kiosk }: a kiosk's address (not translated).
dormant-accounts-event-lan-wide =
    From the Internet, closed. But { $kiosk }, a public catalogue kiosk,
    still gets in: it is on the same network (192.0.2.0/24) as the
    staff. LocalSubnet or the whole /24 isn't "the admin workstation".
dormant-accounts-event-rdp-closed =
    Port 3389 closed to everyone: from the Internet and from the kiosks.
    You still come in with ssh. (The router's port forward should go
    too: a note for Nandini's provider.)
dormant-accounts-event-rdp-narrowed =
    Port 3389 open only to the IT workstation: not from the Internet,
    not from the kiosks. You still come in with ssh.
dormant-accounts-event-inactive =
    The domain's inactive accounts. Look closely before you act: Guest
    and krbtgt are built-in accounts (disabled, never "logged on"),
    oadeyemi left in May, svc_backup is a service account. The people
    are ychen and pmorel. -SearchBase can keep the search to the
    branches' people.
dormant-accounts-event-too-short =
    lhassan in the list: Leila is on parental leave since December, back
    in March. With too short a -TimeSpan, the audit closes people who
    are coming back. The audit says 90 days.
dormant-accounts-event-service-account =
    svc_backup runs the offsite copy of the Archives, on 1 October and 1
    April. Its last logon is from October: inactive for 90 days, and
    needed again in nine weeks. A service account's LastLogonDate says
    when it last logged on, not whether something depends on it.
dormant-accounts-event-service-touched =
    A service account was changed. svc_backup looks inactive, but the
    Offsite Copy task on stacks runs as svc_backup on 1 April: disabled,
    out of its group or moved, the copy fails (0x80070533, the account
    is disabled), and the Archives go unsaved offsite. Put it back as it
    was: Enable-ADAccount, its group, OU=Service Accounts.
dormant-accounts-event-builtin-touched =
    A built-in account was moved or changed (Guest, krbtgt,
    Administrator…). They are disabled or needed by the domain itself:
    the audit is about people. Put it back where it was (Move-ADObject).
# { $accounts }: account names (not translated).
dormant-accounts-event-active-touched =
    An active person's account was changed: { $accounts }. They logged
    on in the last 90 days: put the account back as it was (enabled, its
    OU, its groups).
# { $accounts }: account names (not translated).
dormant-accounts-event-deleted =
    Deleted: { $accounts }. The audit asks to disable, not delete: the
    SID owns files, the auditors want the name. The Recycle Bin still
    has it (Get-ADObject -IncludeDeletedObjects, Restore-ADObject).
dormant-accounts-event-closed =
    ychen and pmorel: disabled, in Leavers, out of their groups. If one
    of them comes back, Enable-ADAccount, one GG_ group and a Move-ADObject
    bring them back.
dormant-accounts-event-leftover-seen =
    Olu left in May 2029. Disabled, in Leavers... but still in GG_Lending
    and DL_Staff_RW. Disabled, he can't log on; but whoever enables his
    account again (by mistake, or to "check something") gets all his
    access back at once, and every report on the Staff share lists him.
dormant-accounts-event-leftover =
    Olu is out of his groups too: Leavers is clean.
dormant-accounts-event-report-active =
    A CSV report lists an active person: the auditors would close an
    account that is in use. Write it from the right search
    (-TimeSpan 90.00:00:00, the branches' people).
dormant-accounts-event-report =
    The report is there, and Import-Csv reads it back: the auditors can
    paste it into their spreadsheet.
dormant-accounts-event-end =
    Nandini: "The scan is clean, the audit has its list, and the archives
    will be copied in April. Thank you!"

    Well done! You have finished the chapter "Doors and Dormant
    Accounts", and the story "The Card Catalogue".

    WHAT HAPPENED
    Tomas opened Remote Desktop to Any on stacks in 2028 to work from
    home; the router still forwarded the port, so the city's scan found
    it from the Internet. Nobody uses Remote Desktop any more: you
    closed the rule without touching the profiles or your own ssh. Then
    the audit: Search-ADAccount found the accounts nobody used for 90
    days, but among them were built-in accounts, a leaver, and a service
    account that only works twice a year. You closed the two people's
    accounts with a script, cleaned the old leaver's groups, and wrote
    the list with Export-Csv.

    GOOD PRACTICE
    - Remote Desktop never faces the Internet: a VPN or a gateway in
      front, and at least a firewall rule limited to the admins'
      addresses (-RemoteAddress). Prefer disabling a rule nobody uses:
      it says what it was, and can come back.
    - Narrow a rule, never a whole profile. Before changing the rule
      you came in by, check what still lets you in.
    - An audit script reads first and acts second: keep the search in a
      variable, look at it, export it (Export-Csv -NoTypeInformation),
      then act on it, with -WhatIf the first time.
    - LastLogonDate is lastLogonTimestamp: replicated with up to 14
      days' lag, and only a logon counts. Exclude what isn't a person:
      -SearchBase the people's OU, service accounts in their own OU,
      built-in accounts.
    - Disable, don't delete: a disabled account comes back in one
      command; a deleted one needs the Recycle Bin, for 180 days.

    LIKE "THE DIRECTORY", IN ACTIVE DIRECTORY
    Search-ADAccount -AccountInactive is an LDAP search on the
    lastLogonTimestamp attribute: Get-ADUser -LDAPFilter
    '(lastLogonTimestamp<=…)' does the same, with the date written as a
    FILETIME (100-nanosecond intervals since 1601), as ldapsearch would.

    DOCUMENTATION
    - Search-ADAccount: https://learn.microsoft.com/powershell/module/activedirectory/search-adaccount
    - Export-Csv: https://learn.microsoft.com/powershell/module/microsoft.powershell.utility/export-csv?view=powershell-5.1
    - Set-NetFirewallRule: https://learn.microsoft.com/powershell/module/netsecurity/set-netfirewallrule
    - Remote Desktop from anywhere, safely: https://learn.microsoft.com/windows-server/remote/remote-desktop-services/rds-plan-access-from-anywhere
    - The AD Recycle Bin: https://learn.microsoft.com/windows-server/identity/ad-ds/get-started/adac/advanced-ad-ds-management-using-active-directory-administrative-center--level-200-
