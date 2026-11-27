### Story "The Music School", chapter "Locked Out": the booking app's service
### doesn't start after its account's password was changed and the server
### restarted. Commands, cmdlets, paths, passwords and outputs are not
### translated.

chapter-service-logon = Locked Out
    .summary = The school's booking app is down since the server restarted: its service won't start. Find why in the event log, then give the service its account's new password, without giving it more rights than it needs.

## Files

service-logon-email-mariam =
    From:  Mariam (director)
    To:    you

    Good morning,

    The Agenda is down: since this morning the teachers and the office
    get "This site can't be reached" on http://stave.internal:8080, and
    families can't book their trial lessons.

    The server restarted on Sunday night for Windows Update. Gabriel, who
    looked after it, left on Friday; in case you need them, I exported
    the server's entries from the password manager, in
    Documents\vault-service-accounts.txt. Please delete that file when
    you're done.

    Could you get the Agenda back up, without breaking anything else?

    Mariam

# { $agenda }, { $backup }, { $admin }: the passwords (not translated).
service-logon-vault =
    Password manager - folder "stave", exported by Mariam (10 December 2029)

    Title:     stave - svc_backup
    Username:  svc_backup
    Password:  { $backup }
    Modified:  3 June 2029 (Gabriel)
    Notes:     Local account. Changed every year (insurer's audit,
               item 4.2).

    Title:     stave - svc_agenda
    Username:  svc_agenda
    Password:  { $agenda }
    Modified:  7 December 2029, 16:42 (Gabriel)
    Notes:     Local account. Changed every year (insurer's audit,
               item 4.2).

    Title:     Agenda - web admin
    Username:  admin
    Password:  { $admin }
    Modified:  2 September 2029 (Gabriel)
    Notes:     http://stave.internal:8080/admin

## Events

service-logon-event-stopped =
    The Agenda is Stopped, though its start type is Automatic: it should
    have started with the server on Sunday night. Try starting it, and
    read what Windows answers.
service-logon-event-start-failed =
    Refused. The error itself says little; Windows writes the details in
    its event log, under the Service Control Manager, the part of Windows
    that starts services: the System log (Get-WinEvent, Get-EventLog).
service-logon-event-events =
    Event 7038: the Agenda "was unable to log on as .\svc_agenda with the
    currently configured password", then 7000: "logon failure". The
    service starts under its own account, with a password Windows stored
    when the service was set up. Which account, exactly? (Get-CimInstance
    Win32_Service, or sc.exe qc)
service-logon-event-account =
    StartName: .\svc_agenda, the local account (the dot means this
    computer). Windows keeps that account's password with the service: if
    someone changed the account's password, the service's copy didn't
    follow. When was it last set? (Get-LocalUser, PasswordLastSet)
service-logon-event-rotated =
    PasswordLastSet: Friday, 16:42, Gabriel's last day (the insurer's
    audit asks for new service passwords every year). The service kept
    running on its logon until Sunday's restart, then tried the old one.
    The new password is in the entries Mariam exported: the one of the
    account the service logs on as.
service-logon-event-other-account =
    The Agenda now logs on as { $account }: an account made for another
    job, with rights the booking app doesn't need (svc_backup is a Backup
    Operator: it can read every file on the server). The Agenda has its
    own account, the one its StartName gave: svc_agenda.
service-logon-event-sc-alias =
    In PowerShell, sc is not sc.exe: it's an alias of Set-Content, which
    writes into files, and doesn't know what to do with obj=. Type sc.exe
    in full (in cmd.exe, sc is enough).
service-logon-event-local-system =
    The Agenda now runs as LocalSystem: it starts, but with every right on
    the server, the system's files, the shares, the other services. A
    flaw in the booking app would become a flaw in the whole server. Put
    it back on its own account, svc_agenda, with its password (sc.exe
    config … obj= … password= …).
service-logon-event-reset =
    You changed svc_agenda's password again. The password manager now has
    an old one, and the service still has an older one: everything that
    uses this account must get the new password (the service, the
    password manager), or the next start fails the same way.
service-logon-event-wrong-password =
    The service now has a password that isn't the account's: its next
    start will fail with the same 7038. Copy it from the password
    manager's entry, exactly.
service-logon-event-start-type =
    The Agenda no longer starts with the server: it would be down again
    after the next Windows Update restart. Its start type should be
    Automatic (Set-Service -StartupType, or sc.exe config … start= auto).
service-logon-event-admin =
    svc_agenda is in Administrators now: the booking app would have every
    right on the server. A service account gets the rights its app needs,
    no more. Take it out of the group (Remove-LocalGroupMember).
service-logon-event-configured =
    The service has the account's new password now. Start it, and check
    that it runs.
service-logon-event-vault-deleted =
    The exported entry is deleted: the password stays in the password
    manager, and nowhere else on the server. Thank you, says Mariam.
service-logon-event-end =
    Mariam: "The Agenda is back, the families are booking again. Thank
    you! I'll write it in the procedure: when a service password
    changes, the service gets it the same day, and we restart it to
    check."

    Well done! You have finished the chapter "Locked Out".

    WHAT HAPPENED
    A Windows service starts under a logon account; for a local account,
    the Service Control Manager keeps its password with the service's
    configuration. Gabriel rightly changed svc_agenda's password, but not
    the copy the service kept. The Agenda went on running until Sunday's
    update restart, then could not log on: 7038 and 7000 in the System
    log, error 1069. You gave the service the new password from the
    password manager (sc.exe config), and started it under its own
    account.

    GOOD PRACTICE
    - Changing a service account's password means updating everything
      that stores it: services (Get-CimInstance Win32_Service, StartName),
      scheduled tasks (Get-ScheduledTask, their Principal), scripts.
    - Restart the service right after the change: a failure shows the
      same day, not at the next reboot, at 3 a.m.
    - The System log says why: event 7038 names the account, 7000 the
      service.
    - Least privilege: a service runs as its own account with the rights
      it needs, not as LocalSystem nor as an administrator.
    - Passwords live in the password manager; an export is deleted once
      used.

    ANOTHER WAY
    In a domain, a group managed service account (gMSA) changes its own
    password and the services follow, with nothing to retype. On a
    single server, a virtual account (NT SERVICE\Agenda) needs no
    password at all, when the app only needs local rights. The Services
    console (services.msc), Log On tab, does what sc.exe config does.

    DOCUMENTATION
    - Service user accounts: https://learn.microsoft.com/windows/win32/services/service-user-accounts
    - sc.exe config: https://learn.microsoft.com/windows-server/administration/windows-commands/sc-config
    - Events 7000, 7011, 7009: https://learn.microsoft.com/troubleshoot/windows-server/system-management-components/event-id-7000-7011-7009
    - Get-WinEvent: https://learn.microsoft.com/powershell/module/microsoft.powershell.diagnostics/get-winevent?view=powershell-5.1
    - Group managed service accounts: https://learn.microsoft.com/windows-server/security/group-managed-service-accounts/group-managed-service-accounts-overview
