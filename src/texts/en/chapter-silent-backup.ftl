### Story "The Music School", chapter "The Silent Backup": the nightly
### backup task shows Ready but has not copied anything for weeks, and its
### script hid its errors before that. Commands, cmdlets, paths, passwords
### and outputs are not translated.

chapter-silent-backup = The Silent Backup
    .summary = A file to restore, and the backup has nothing recent: the nightly task says Ready, yet it fails every night. Find why in its result and the logs, fix its account, then make its script report failures instead of hiding them.

## Files

silent-backup-email-mariam =
    From:  Mariam (director)
    To:    you

    Good morning,

    On Friday Beatriz deleted the November bank statement by mistake,
    from the Office share (Office\Bank). Could you get it back from the
    backup? Gabriel's handover says the "Nightly Backup" task copies
    the shares to D:\Backup every night at 1:30, and writes what it did
    in D:\Logs\Backup\backup.log.

    And while you're there, could you check that the backup really
    works? I would sleep better.

    The password manager's entry of the backup account is exported in
    Documents\vault-svc_backup.txt (delete it when you're done).

    Mariam

# { $password }: the account's password (not translated).
silent-backup-vault =
    Password manager - one entry, exported by Mariam (14 January 2030)

    Title:     stave - svc_backup
    Username:  svc_backup
    Password:  { $password }
    Modified:  8 November 2029, 15:00 (Gabriel)
    Notes:     Local account of the Nightly Backup task on stave.
               School policy for service accounts: the password never
               expires; it is changed by hand once a year (insurer's
               audit, item 4.2), and the task gets it the same day.

## Events

silent-backup-event-ready =
    State: Ready. That only means the task is enabled and waiting for its
    next trigger; it says nothing about how its last run went. Ask the
    Task Scheduler for that (Get-ScheduledTaskInfo).
silent-backup-event-result =
    LastTaskResult: 2147943730, that is 0x80070532 in hexadecimal
    ('{"{"}0:X{"}"}' -f 2147943730): "The password for this account has
    expired." Last night's run didn't even start. Since when? The
    script's own log, D:\Logs\Backup\backup.log, will say when it last
    copied.
silent-backup-event-own-log =
    The last "copy done" dates from 20 December. Nearly four weeks
    without a backup, and nobody noticed: the task fails without a
    sound.
silent-backup-event-history-off =
    The Task Scheduler's history is disabled, as on every Windows Server
    by default: nothing was recorded. Turn it on (wevtutil sl
    Microsoft-Windows-TaskScheduler/Operational /e:true), and the next
    runs will be. Meanwhile, failed logons are in the Security log
    (4625).
silent-backup-event-history-on =
    The Task Scheduler's history is on: from now on, every run leaves its
    events (100 started, 101 failed to start, 104 logon failed, 201
    action completed and its return code).
silent-backup-event-events =
    "The specified account's password has expired.": the account the task
    runs as can't log on. Look at svc_backup itself (Get-LocalUser, or net
    user).
silent-backup-event-expired =
    PasswordExpires: 20 December 2029. The password was set on
    8 November and the local policy gives passwords 42 days: on the
    20th, it expired, and the task has failed every night since. Yet
    the password manager's entry says the school's service accounts
    don't expire.
silent-backup-event-account-expires =
    /expires is the ACCOUNT's expiry date, not its password's: svc_backup's
    account never expired. The password's expiry is set with
    Set-LocalUser -PasswordNeverExpires.
silent-backup-event-task-password =
    svc_backup's password changed, but the task still keeps the old one:
    tonight it would fail with 0x8007052E ("The user name or password is
    incorrect"). Give the task the new one too (Set-ScheduledTask -User
    -Password, or schtasks /change /ru /rp).
silent-backup-event-logon-fixed =
    The task's account can log on again, and its password won't expire
    any more, as the school's policy says. Run the task now rather than
    wait for 1:30 (Start-ScheduledTask), and check what it did.
silent-backup-event-will-expire =
    The task's account can log on again, but its password still expires
    after 42 days: the same silent failure, in six weeks. The school's
    policy says its service accounts' passwords don't expire.
silent-backup-event-system =
    The task runs as SYSTEM now: it can read everything, so it "works".
    But a script anyone with write access to C:\Scripts can change would
    run with every right on the server. Give it back to svc_backup.
silent-backup-event-admin-task =
    The task runs as an administrator now: every right on the server for
    a copy script, and your own password to keep up to date. Give it
    back to svc_backup.
silent-backup-event-admin =
    svc_backup is in Administrators now: a backup account needs to read
    the shares and write the backup, no more. Take it out of the group.
silent-backup-event-disabled =
    The task no longer runs on its own: no failure any more, and no
    backup either. It must run every night (Enable-ScheduledTask, and
    its daily trigger).
silent-backup-event-ran =
    LastTaskResult: 0, and backup.log says "copy done". Now Beatriz's
    statement: look for it in D:\Backup\Shares\Office.
silent-backup-event-missing =
    No Bank folder in the backup, not even an old one. Yet the task said
    0 and "copy done", each night up to 20 December. Something failed in
    the copy, and the script said nothing. Read it:
    C:\Scripts\backup.ps1.
silent-backup-event-by-hand =
    You ran the script yourself: as an administrator, you can read
    everything, so it can succeed where the task fails. The task runs as
    svc_backup: what counts is what svc_backup can do (Start-ScheduledTask
    runs it as its account).
silent-backup-event-loud =
    This time the task's result isn't 0: the script met an error and said
    so. That's what a monitoring, or you, can see. Now, what failed?
silent-backup-event-bank-acl =
    Bank doesn't inherit its parent's permissions: Beatriz gave it to
    the Office group and the administrators only. svc_backup can't read
    it, so Copy-Item skipped it, with an error nobody saw.
silent-backup-event-readable =
    svc_backup can read Bank now. Run the task again and check its
    result.
silent-backup-event-too-open =
    Now the teachers can read the school's bank statements. Bank needs
    to be readable by the office and by the backup account, not by
    everyone.
silent-backup-event-quiet-script =
    The backup copied everything this time. But if a folder fails
    tomorrow, the script will still answer 0. Make it report errors
    ($ErrorActionPreference = 'Stop', or try/catch with exit 1), so that
    LastTaskResult tells the truth.
silent-backup-event-end =
    Mariam: "So the November statement was never in the backup... The bank
    will send us a copy. But now I know that if the backup fails, we
    will see it. Thank you!"

    Well done! You have finished the chapter "The Silent Backup". And
    the story "The Music School" is complete.

    WHAT HAPPENED
    Two failures hid one behind the other. Since 20 December, svc_backup's
    password had expired ("password never expires" was off, contrary to
    the school's policy): the Task Scheduler couldn't log on, every
    night, LastTaskResult 0x80070532, while Get-ScheduledTask still
    said Ready. And before that, since 12 December, the script copied
    everything except Beatriz's Bank folder, which svc_backup couldn't
    read: Copy-Item wrote a non-terminating error, the script went on,
    and powershell.exe -File returned 0. "copy done", every night.

    GOOD PRACTICE
    - Ready isn't a result: read LastRunTime and LastTaskResult
      (Get-ScheduledTaskInfo), and turn on the Task Scheduler's history.
    - A service account's password: either it never expires and is
      changed by hand, on a schedule, everywhere it is stored; or it
      expires, and something reminds you before it does. An expiry
      nobody knows about is a silent outage.
    - A script run by a task must fail loudly: $ErrorActionPreference =
      'Stop' or -ErrorAction Stop, try/catch, and exit 1 on error;
      otherwise errors are only lines nobody reads.
    - Test as the account the task runs as (Start-ScheduledTask), not as
      an administrator; give that account what it needs to read, no
      more: not SYSTEM, not Administrators.
    - A backup isn't checked until a restore is: look for a recent file
      in it now and then.

    ANOTHER WAY
    In a domain, a group managed service account (gMSA) changes its own
    password and the task follows. robocopy /B, run by a member of Backup
    Operators, reads files whatever their permissions, with the backup
    privilege; Windows Server Backup (wbadmin) saves whole volumes.

    DOCUMENTATION
    - Get-ScheduledTaskInfo: https://learn.microsoft.com/powershell/module/scheduledtasks/get-scheduledtaskinfo
    - Task Scheduler error and success constants: https://learn.microsoft.com/windows/win32/taskschd/task-scheduler-error-and-success-constants
    - about_Try_Catch_Finally: https://learn.microsoft.com/powershell/module/microsoft.powershell.core/about/about_try_catch_finally?view=powershell-5.1
    - about_Preference_Variables ($ErrorActionPreference): https://learn.microsoft.com/powershell/module/microsoft.powershell.core/about/about_preference_variables?view=powershell-5.1
    - Set-LocalUser: https://learn.microsoft.com/powershell/module/microsoft.powershell.localaccounts/set-localuser?view=powershell-5.1
    - Group managed service accounts: https://learn.microsoft.com/windows-server/security/group-managed-service-accounts/group-managed-service-accounts-overview
