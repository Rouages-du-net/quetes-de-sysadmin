### Story "The Huts", chapter 2 "The Full Journal": systemd's journal on
### disk, journalctl --disk-usage and --vacuum-*, SystemMaxUse=.
### Configuration, paths and the tools' outputs are not translated.

chapter-journal-full = The Full Journal
    .summary = The valley's disk is at 93 %. The huts' files are small; something else takes gigabytes in /var/log. Give the space back, and make sure it stays given back.

## Files

journal-full-message-lou =
    From:     Lou
    To:       you
    Subject:  Disk almost full

    Hello,

    The hosting panel says valley's disk is at 93 %. The huts' log files
    (thanks again!) are a few megabytes, so it must be something else.

    I did enable a "debug" option in hut-collector last month, to
    understand a sensor problem… maybe related?

    Don't touch /var/lib/hut-data: it's the archive of all the
    measurements since 2019.

    Same sudo password: summit-2028.

    Lou

## Events

journal-full-event-disk =
    93 % used. Where does it go? du -sh on the big directories will tell
    (sudo du -sh /var/log/*, /var/lib/*).
journal-full-event-journal =
    systemd's journal, in /var/log/journal, takes gigabytes: thirty
    archived files, one a day, and the active one. Since hut-collector
    writes in debug, it grows fast. journald keeps by default up to 10 %
    of the file system… and it is the rest of the disk that is short.
    (man journalctl: --disk-usage, --vacuum-size; man journald.conf)
journal-full-event-rm =
    The journal's active file was deleted by hand. journald still writes
    into it (it holds it open), but nothing can read it any more, and its
    space only comes back when journald restarts. Archived files are
    trimmed with journalctl --vacuum-…, never with rm.
journal-full-event-vacuum-only =
    The archives are trimmed: space is back. But nothing stops the journal
    from growing again at the same pace. journald needs a limit
    (SystemMaxUse= in journald.conf), applied when it starts.
journal-full-event-restart-needed =
    The limit is written, but journald reads its configuration when it
    starts: sudo systemctl restart systemd-journald.
journal-full-event-too-big =
    A limit is set, but too high for this disk: with the measurements'
    archive, 1G for the journal is plenty (SystemMaxUse=1G at most).
journal-full-event-end =
    The journal is under its new limit, and journald will keep it there:
    the disk is back under 80 %. Lou: "And I've switched off debug in
    hut-collector, promised."

    Well done! You have finished the chapter "The Full Journal".

    WHAT HAPPENED
    hut-collector wrote in debug into the journal, hundreds of megabytes
    a day. journald's default limit (10 % of the file system, up to 4G)
    allowed six gigabytes on this disk, next to an archive that already
    took most of it.

    THE JOURNAL ON DISK
    - journalctl --disk-usage: how much it takes.
    - journalctl --vacuum-size=500M (or --vacuum-time=2weeks): trims the
      archived files now.
    - SystemMaxUse= in /etc/systemd/journald.conf (or a drop-in in
      journald.conf.d): the lasting limit, applied when journald starts.

    GOOD PRACTICE
    - Never rm in /var/log/journal: journalctl --vacuum-….
    - Set a limit suited to the disk, and watch the disk (df) with an
      alert.
    - A program in debug is a program that will fill a disk: switch it
      off once the problem is understood.

    DOCUMENTATION
    - journald.conf: https://www.freedesktop.org/software/systemd/man/latest/journald.conf.html
    - journalctl --vacuum-size: https://www.freedesktop.org/software/systemd/man/latest/journalctl.html
