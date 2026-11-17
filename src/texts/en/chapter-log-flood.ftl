### Story "The Music School", chapter "The Log Flood": the data volume is
### full of the booking app's logs, left at the debug level since June.
### Commands, cmdlets, paths and outputs are not translated.

chapter-log-flood = The Log Flood
    .summary = The booking app can't save anything and the teachers can't save in their share: the data volume is full. Find what fills it, free room without losing the logs the office needs, and stop it filling up again.

## Files

log-flood-email-beatriz =
    From:  Beatriz (office)
    To:    you

    Hello,

    Since last night the Agenda answers "Could not save the booking"
    to every new booking, and this morning Samir couldn't save his
    orchestra plan in the Teachers share: "There is not enough space on
    the disk".

    Gabriel told us in June that he had "turned up the Agenda's logs"
    to chase the double bookings. Did he ever turn them back down?

    Careful: I am still sorting out the family that was charged twice
    on 4 December, and I need the Agenda's logs of those weeks. Mariam's
    rule is that we always keep the last 30 days of logs.

    Thanks!
    Beatriz

## Events

log-flood-event-full =
    D: (Data) has a few hundred megabytes left out of 500 GB: no wonder
    nothing can be saved. What takes all that room? Search D:\ for the
    biggest files (Get-ChildItem -Recurse -File, Sort-Object Length).
log-flood-event-culprit =
    D:\Logs\Agenda: one file a day since 12 June, agenda-2029-06-12.log
    and so on, several GB each. The Agenda starts a new log at midnight
    and nothing ever deletes the old ones. Why so big, though? Its
    configuration is in C:\ProgramData\Agenda\agenda.ini.
log-flood-event-level =
    level=debug: the Agenda writes every request, every SQL query, every
    cache lookup. The file was last changed on 12 June: Gabriel's
    troubleshooting, never undone. First free some room, then turn the
    level back down.
log-flood-event-whatif =
    -WhatIf lists what would go, without deleting anything. Check the
    list: only logs older than 30 days, nothing from the weeks Beatriz
    needs, not the current agenda.log.
log-flood-event-in-use =
    agenda.log is the Agenda's current log: the service holds it open,
    and Windows refuses to delete a file another process is using. That's
    a safeguard: the current log is today's, and the old ones are where
    the room is.
log-flood-event-recent-deleted =
    Logs from the last 30 days are gone, and Beatriz needed them for the
    double charge of 4 December. Without a copy, they can't come back:
    restart the chapter (or use the rescue snapshot) and delete only the
    older ones (Where-Object LastWriteTime -lt (Get-Date).AddDays(-30)).
log-flood-event-current-deleted =
    The current agenda.log is gone, with this morning's errors in it:
    the evidence of the incident. Next time, stop at the old logs.
log-flood-event-backup-deleted =
    The backup in D:\Backup isn't what fills the disk, and deleting it
    leaves the school without a copy of its shares. Restart the chapter
    (or use the rescue snapshot): the old logs are where the room is.
log-flood-event-compressed =
    NTFS compression shrinks text logs a lot, and it does buy room. But
    at the debug level the Agenda keeps writing several GB a day: the
    disk fills again, a bit later. Old logs past the retention period
    have nothing to be kept for; and the level is the real cause.
log-flood-event-freed =
    D: has room again, and the last 30 days of logs are still there.
    Now the cause: at the debug level, it will be full again in a few
    months. Lower the level in agenda.ini.
log-flood-event-freed-quiet =
    D: has room again, and the last 30 days of logs are still there.
log-flood-event-not-applied =
    agenda.ini says a lower level now, but the Agenda read its
    configuration when it started, in debug: it goes on writing every
    request until it starts again (Restart-Service).
log-flood-event-stopped =
    The Agenda is stopped: nobody can book a lesson. Start it again
    (Start-Service Agenda).
log-flood-event-quieter =
    The Agenda runs with a quieter log level: a few MB a day instead of
    several GB. There is still the room to free on D:.
log-flood-event-quieter-freed =
    The Agenda runs with a quieter log level: a few MB a day instead of
    several GB.
log-flood-event-cleanup-task =
    A scheduled cleanup task: a good second layer, so that old logs never
    pile up again, whatever the level. Make sure it keeps 30 days, and
    test it once (Start-ScheduledTask) before trusting it.
log-flood-event-end =
    Beatriz: "The Agenda saves bookings again, and Samir has saved his
    plan. And I still have my logs from early December, thank you!"

    Well done! You have finished the chapter "The Log Flood".

    WHAT HAPPENED
    In June, Gabriel set the Agenda's log level to debug to chase a bug,
    and never set it back. The Agenda starts a new log file every
    midnight, and nothing deletes the old ones: six months of debug logs,
    a few GB a day, filled the 500 GB of D:. You found the culprit by
    size, deleted only the logs older than the 30 days the school keeps
    (after a -WhatIf), and put the level back to a normal one, restarting
    the service so that it read it.

    GOOD PRACTICE
    - Find before you delete: Get-Volume for the volume,
      Get-ChildItem -Recurse -File | Sort-Object Length -Descending for
      the biggest files, Measure-Object -Sum for a folder's total.
    - Delete by a criterion you can check (LastWriteTime older than the
      retention period), with -WhatIf first.
    - A file a service holds open can't be deleted, and shouldn't be:
      it's the current log.
    - Debug logging is for the time of an investigation: note it, and
      turn it off when you're done. A service reads its configuration
      when it starts.
    - Every log needs a retention: a cleanup task
      (Register-ScheduledTask) or the app's own setting, and a
      monitoring of free space that warns before 100%.

    ANOTHER WAY
    NTFS compression (compact /c) shrinks old text logs, if they must be
    kept; it doesn't stop what fills the disk. IIS has its own log
    settings (rollover), and nothing deletes its old logs either: a
    scheduled task is the usual way.

    DOCUMENTATION
    - Get-Volume: https://learn.microsoft.com/powershell/module/storage/get-volume
    - Remove-Item: https://learn.microsoft.com/powershell/module/microsoft.powershell.management/remove-item?view=powershell-5.1
    - Where-Object: https://learn.microsoft.com/powershell/module/microsoft.powershell.core/where-object?view=powershell-5.1
    - Register-ScheduledTask: https://learn.microsoft.com/powershell/module/scheduledtasks/register-scheduledtask
    - compact: https://learn.microsoft.com/windows-server/administration/windows-commands/compact
