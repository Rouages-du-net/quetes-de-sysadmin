### Story "The Night Batch", chapter "The Late File": the timer started the
### batch before the bureau's file arrived. Wait for the file to be complete,
### never process it twice, and make a failure visible. Commands, paths,
### unit files and program outputs are not translated.

chapter-late-file = The Late File
    .summary = The batch ran at 02:00 on yesterday's file and said nothing: make it wait for the complete file, process it once, and let you know when it fails.

## Files

late-file-email-ayesha =
    From:  Ayesha
    To:    you

    Bad news. This morning, accounts noticed that the collection report
    had the same run date as yesterday's: at 02:00, the batch processed the
    file of the 22nd a second time. The bureau's file arrived at 02:41 last
    night, after our timer. And the batch said nothing: the service ended
    "successfully".

    I ran it by hand on the right file at 8:10, and took the .done away
    (the bureau writes contrib.ebc.done once its upload is complete). The
    report is right now: nobody will be debited twice.

    The bureau warns that its file may be late again. Could you fix the
    plumbing? The batch must wait for the file to be complete, never
    process the same file twice, and if the program ends badly, we must
    know about it (a mail to me or to you will do). The timer and the
    service are in /etc/systemd/system, the wrapper is
    /opt/batch/run-night.sh.

    The bureau agreed to a rehearsal: each time you change the wrapper, the
    units or a crontab, their next two nights will be late on purpose, and
    the second file will have a record missing.

    Ayesha

## The rehearsal

late-file-rehearsal = Rehearsal with the bureau: the next two nights.
late-file-night-first = Night of { $date }: the file is late, its .done arrives at { $done }.
late-file-night-second = Night of { $date }: the file is even later, its .done arrives at { $done }, and a record is missing (the trailer still counts it).
late-file-run = { $time }: the batch ran on the file of { $date }, return code { $rc }.
late-file-no-run = The batch processed no file.
late-file-verdict-stale = Wrong: it processed an old file, and the members would be debited twice. Only process a file whose .done is there.
late-file-verdict-partial = Wrong: it started on a file still being written (no trailer yet: return code 12). Wait for the .done.
late-file-verdict-none = Wrong: tonight's file was never processed. Does the batch try again after 02:00? Has systemd reloaded the timer, and is it active (systemctl daemon-reload, systemctl list-timers)? Or is the crontab installed?
late-file-verdict-twice = Wrong: tonight's file was processed { $count } times. Once it is processed, take its .done away (rm or mv).
late-file-verdict-too-late = Wrong: processed at { $time }, after 07:00, when accounts sends the report to the bank. Try again more often.
late-file-verdict-ok = Right: processed once, complete, with return code 0.
late-file-verdict-mailed = Right: return code 8, and { $who } received a mail at { $time }.
late-file-verdict-failed = Right: return code 8, and systemd marked { $unit } as failed at { $time } (systemctl status, journalctl -u).
late-file-verdict-silent = Wrong: return code 8, but nobody knows. The service ended successfully and nobody received a mail: the wrapper must pass the program's code on (set -e, or exit with it), or send a mail.
late-file-rehearsal-again = Change what needs changing: the bureau will rehearse the next two nights again.

## Events

late-file-event-diagnosed =
    There it is: the batch ran at 02:00 on Thursday and again on Friday, and
    both runs read the file of the 22nd (RUN DATE 291122). At 02:00 on
    Friday, the new file wasn't there yet; the timer doesn't know that, it
    only knows the time.
late-file-event-unscheduled =
    Nothing is scheduled any more: no active timer, no crontab. Tonight,
    the batch won't run at all.
late-file-event-first-night =
    The late night went well: the batch waited for the .done, then processed
    the file once, with return code 0.
late-file-event-second-night =
    The incomplete file was caught: return code 8, and somebody knows it.
late-file-event-end =
    Ayesha: "Two nights, two traps, and the batch got through both. Ramón
    read your wrapper: he says it's the first time in thirty years that
    the batch tells someone when something is wrong."

    Well done! You have finished the chapter "The Late File", and the story
    "The Night Batch".

    WHAT HAPPENED
    The timer started the batch at a fixed time, whether the file was there
    or not, and the wrapper ended with an echo: its exit code was always 0.
    The program had done what it was told. You changed the plumbing around
    it: the batch now waits for the bureau's .done (the sign that the
    upload is complete), takes it away once the file is processed, tries
    again during the night, and passes the program's return code on, so
    that a failure is seen.

    GOOD PRACTICE
    - Start a job on an event (the file is complete: a .done, a size that
      no longer changes), not only at a time.
    - Make a job idempotent: the same file must never be processed twice
      (take its flag away, move it to an archive).
    - A wrapper passes its programs' return codes on (set -e, exit $RC):
      systemd marks the service failed (systemctl --failed), cron mails
      the output.
    - Warn a human, and set a deadline: a file that never comes is an
      incident too.

    ANOTHER WAY
    A systemd path unit (PathExists=/srv/drop/contrib.ebc.done) starts the
    service as soon as the .done appears, without trying every ten minutes;
    OnFailure= starts another unit (a mail) when the service fails. On a
    mainframe, the scheduler (and the JCL's COND) did all that: it is the
    part to move with the most care.

    DOCUMENTATION
    - systemd.timer: https://www.freedesktop.org/software/systemd/man/latest/systemd.timer.html
    - systemd.path: https://www.freedesktop.org/software/systemd/man/latest/systemd.path.html
    - sh, set -e and exit: https://manpages.debian.org/bookworm/dash/sh.1.en.html
    - crontab(5): https://manpages.debian.org/bookworm/cron/crontab.5.en.html
