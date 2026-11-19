### Story "The Card Catalogue", chapter "The Stale Password": an
### account locks every morning; the domain controller's events point to
### the file server, where a scheduled task still holds the old password.
### Commands, cmdlets, account names, paths, passwords and outputs are
### not translated.

chapter-stale-password = The Stale Password
    .summary = Rafael's account locks every morning, and unlocking it only lasts an hour. Find which computer keeps trying his old password, fix what stored it, then unlock him, without weakening the lockout policy.

## Files

stale-password-email-nandini =
    From:  Nandini Mukherjee (network director)
    To:    you

    Good morning,

    Rafael (archives, Central) is locked out AGAIN. Third morning in a
    row. On Monday Windows told him his password had expired, he
    changed it at his desk, and since then he's locked within the hour.
    I unlocked him on Monday and yesterday (Tomas showed me how): it
    holds for a while, then it's back.

    He swears he types the right password, only on his PC at the
    Central desk, and he hasn't written the old one anywhere.

    Could you find out what's going on? I exported the vault entry
    Tomas told me you'd need: Documents\vault-svc_scans.txt. Delete it
    when you're done.

    Nandini

# { $password }: the account's password (not translated).
stale-password-vault =
    Password manager - one entry, exported by Nandini (9 January 2030)

    Title:     LENDING - svc_scans
    Username:  LENDING\svc_scans
    Password:  { $password }
    Modified:  12 December 2029 (Tomas)
    Notes:     Service account for the scan import on stacks
               (replaces Rafael's account in the task). OU=Service
               Accounts, password never expires.

## Time passing

stale-password-relocked =
    Half an hour later, the phone: Rafael is locked out again. Unlocking
    resets the counter, not its cause: something keeps trying his old
    password, and five wrong tries lock the account for 30 minutes.
stale-password-holds =
    Half an hour later, Rafael is still logged on, and no new 4740 on
    register.

## Events

stale-password-event-locked =
    rsilva, LockedOut. A locked account isn't a disabled one: the
    domain refuses even the right password for 30 minutes (the Default
    Domain Policy), after five wrong ones. How many, and when?
stale-password-event-bad-logons =
    PasswordLastSet: Monday, 8:52. Wrong passwords ever since, at a
    steady pace: a person who mistypes doesn't keep that rhythm. Which
    computer sends them? The domain controller writes it in its Security
    log, in the lockout event: 4740.
stale-password-event-caller =
    "Caller Computer Name": the computer that asked the domain controller
    to check the password. It isn't Rafael's desk PC: it's the file
    server. Something on that server logs on as Rafael. From register,
    Windows' own OpenSSH client goes there: ssh followed by its name.
stale-password-event-on-stacks =
    You're on the file server, as a Domain Admin. Its own Security log
    has the failed logons (4625), with their logon type: 2 at the
    keyboard, 3 from the network, 4 a batch job, 5 a service.
stale-password-event-logon-type =
    Logon Type 4: a batch logon, the kind a scheduled task makes. A task
    that runs as Rafael, with a password stored when it was registered.
stale-password-event-task =
    The scan import: Tomas set it up in September under Rafael's own
    account, "Run whether user is logged on or not", every 5 minutes. The
    Task Scheduler stored the password he had then. On Monday Rafael
    changed it; the task kept the old one, and tries it twelve times an
    hour. Five wrong tries: locked.
stale-password-event-policy =
    The lockout policy is weaker now. It would hide the symptom for every
    account of the domain, and leave password guessing free on all of
    them; the task would still fail. Put it back as it was (5 attempts,
    30 minutes): Set-ADDefaultDomainPasswordPolicy.
stale-password-event-reset =
    You reset Rafael's password: he doesn't know the new one, a reset
    doesn't unlock the account, and the task still holds the old one,
    which is now two passwords behind. Whatever stores a password must
    be updated, not the person.
stale-password-event-system =
    The import now runs as SYSTEM: it no longer locks anyone, but it can
    do anything on the file server, every share, every file. The task
    only needs to move scans into Archives: that's what svc_scans was
    made for.
stale-password-event-person =
    The import runs under a person's account again (or the domain
    controller's administrator's). The next time that person changes a
    password, or leaves, the import breaks, or locks them out. A job has
    its own service account: svc_scans, its password in the vault.
stale-password-event-task-off =
    The scan import doesn't run any more: Rafael won't be locked, but the
    archive scanner's PDFs pile up in D:\Scans and never reach Archives.
    Fix the task rather than stopping it: under svc_scans.
stale-password-event-fixed =
    The import runs as svc_scans now, with its own password: nothing on
    stacks tries Rafael's password any more. He's still locked out,
    though: the lockout lasts 30 minutes, or until an administrator
    unlocks the account.
stale-password-event-fixed-unlocked =
    The import runs as svc_scans now, with its own password: nothing on
    stacks tries Rafael's password any more.
stale-password-event-vault-deleted =
    The exported entry is deleted: the password stays in the vault and
    in the task, nowhere else. Thank you, says Nandini.
stale-password-event-end =
    Rafael: "Half an hour, and still logged on! And my scans are in
    Archives. Thank you!"

    Well done! You have finished the chapter "The Stale Password".

    WHAT HAPPENED
    In September, Tomas set up the scan import on stacks as a scheduled
    task running under Rafael's account; the Task Scheduler stored his
    password. On Monday Rafael's password expired and he changed it; the
    task kept trying the old one every 5 minutes. After five wrong
    tries, the domain locks an account for 30 minutes: unlocked or not,
    Rafael was locked again within the hour. The domain controller's
    event 4740 named the computer (STACKS), its 4625 events the logon
    type (4, batch), and the task showed its principal. You gave the
    task its own service account, then unlocked Rafael.

    GOOD PRACTICE
    - A recurring lockout has a source: Search-ADAccount -LockedOut,
      Get-ADUser -Properties BadLogonCount, LastBadPasswordAttempt, then
      event 4740 on the domain controller (the PDC emulator) for the
      caller computer, and 4625 there for the logon type.
    - The usual sources: scheduled tasks, services, mapped drives with
      saved credentials (cmdkey), a phone still syncing mail.
    - Fix the source first, unlock second: the reverse order only buys
      half an hour.
    - Jobs run under service accounts, never under a person's: people
      change passwords and leave. In a domain, a group managed service
      account (gMSA) even changes its own password.
    - Don't weaken the lockout policy to silence a symptom: it protects
      every account against password guessing.

    LIKE "THE DIRECTORY", IN ACTIVE DIRECTORY
    LockedOut, BadLogonCount and LastBadPasswordAttempt are attributes of
    the directory (lockoutTime, badPwdCount, badPasswordTime), which an
    LDAP filter can search, as with ldapsearch:
    Get-ADUser -LDAPFilter '(lockoutTime>=1)'.

    DOCUMENTATION
    - Event 4740: https://learn.microsoft.com/windows/security/threat-protection/auditing/event-4740
    - Event 4625 and the logon types: https://learn.microsoft.com/windows/security/threat-protection/auditing/event-4625
    - Search-ADAccount: https://learn.microsoft.com/powershell/module/activedirectory/search-adaccount
    - Unlock-ADAccount: https://learn.microsoft.com/powershell/module/activedirectory/unlock-adaccount
    - Set-ScheduledTask: https://learn.microsoft.com/powershell/module/scheduledtasks/set-scheduledtask
    - Account lockout threshold: https://learn.microsoft.com/windows/security/threat-protection/security-policy-settings/account-lockout-threshold
    - Group managed service accounts: https://learn.microsoft.com/windows-server/security/group-managed-service-accounts/group-managed-service-accounts-overview
