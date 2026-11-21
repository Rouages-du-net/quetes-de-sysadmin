### Story "The Staff Room", chapter "The Paper Trail": debug logs that
### fill the disk and keep pupils' names, a job history and documents kept
### forever, anyone cancelling anyone's jobs, admin pages open to the
### school. cupsd.conf, cupsctl, logs. Commands, options, paths and
### outputs are not translated.

chapter-paper-trail = The Paper Trail
    .summary = The print server remembers too much: weeks of debug logs on a full disk, every report card's title, every document. Put the logs back in their place, teach CUPS to forget, and close what was left open.

## Files

paper-trail-message-ines =
    From: Ines (school office)
    Friday 7 December, 16:00

    Hello,

    Two things, and the second worries me.

    chalk sent an alert this morning: /var is almost full. Darius, who
    looked after it before you, "debugged the MFP" in November; I don't
    know what he left behind.

    And our data protection officer came by (her request is in your
    folder). She saw, on the printer's web page, the list of everything
    printed this term: report cards, support plans, medical forms, with
    the pupils' names in the titles. Anyone at school can see it. And
    last week Sven cancelled Amara's report cards to get his own printed
    first: it seems anyone can cancel anyone's job.

    Can you put all that in order? The staff must keep printing, of
    course.

    Ines

paper-trail-dpo-request =
    From: the school's data protection officer
    To: Ines, and whoever looks after the print server

    Print jobs are personal data when their titles name pupils. I ask:

    - a print history of one week at most (for problems and costs);
    - no documents kept on the server once printed (a day at most);
    - names and titles visible to their owner and the administrators only;
    - logs that don't record what is printed, beyond what's necessary;
    - the server's administration reachable from the server itself only.

    Thank you.

## Events

paper-trail-event-big-log =
    /var is nearly full, and /var/log/cups/error_log weighs 3.9 GB. What
    has cupsd been writing? (sudo tail /var/log/cups/error_log, grep
    LogLevel /etc/cups/cupsd.conf.)
paper-trail-event-names =
    LogLevel debug2: cupsd writes everything, every job's attributes
    included: its name, its owner, its host. The pupils' names end up in
    the log, gigabytes of it. And MaxLogSize 0: cupsd never rotates it.
paper-trail-event-history =
    The history goes back to October (lpstat -W completed -o), and with
    PreserveJobFiles Yes every document is still in the spool
    (/var/spool/cups/d01188-001…). By default CUPS keeps the history
    forever (PreserveJobHistory Yes) and documents a day. The DPO asks
    for a week and none.
paper-trail-event-not-applied =
    cupsd.conf changed, but cupsd runs with what it read at start: restart
    it (cupsd -t checks the file first), or use cupsctl, which restarts it.
paper-trail-event-stopped =
    cupsd isn't running any more: nobody can print. systemctl status cups
    and journalctl -u cups say why (a syntax error in cupsd.conf: cupsd -t
    shows the line).
paper-trail-event-loglevel =
    cupsd now logs at a sane level: warnings and errors (and a failed job's
    debug history), without every job's attributes.
paper-trail-event-rotation =
    The logs will be rotated: cupsd itself at MaxLogSize (error_log
    becomes error_log.O), or logrotate's file for /var/log/cups.
paper-trail-event-rotated-o =
    cupsd rotated the big log: it's now error_log.O, and it still takes
    3.9 GB. The old log has no more use: it can go (and with it, the
    pupils' names it holds).
paper-trail-event-small =
    /var/log/cups is back to a reasonable size, and the disk breathes
    (df -h /var).
paper-trail-event-kept =
    CUPS now forgets: the history beyond a week and the printed documents
    are purged (lpstat -W completed -o, sudo ls /var/spool/cups).
paper-trail-event-private =
    JobPrivateValues hides the names, owners and hosts of a job from
    everyone but its owner and the administrators.
paper-trail-event-cancel-policy =
    Cancel-Job requires its owner or an administrator again (Require user
    @OWNER @SYSTEM, the default policy).
paper-trail-event-admin-closed =
    /admin answers localhost only: from the staff's or the pupils'
    networks, 403 (access_log).
paper-trail-event-cancel-all =
    cancel -a cancelled today's jobs too: the staff will send them again.
    The old jobs were finished already; it's CUPS's settings that keep
    them.
paper-trail-event-broke-printing =
    The staff (or the library's Chromebooks) can no longer print: the
    change went too far. /admin is to close; /printers must stay open to
    the school.
paper-trail-event-end =
    Ines: "The DPO is happy, the disk is happy, and Amara's report cards
    came out first. Have a good weekend!"

    Well done! You finished The Paper Trail.

    WHAT HAPPENED
    Darius had left LogLevel debug2 and MaxLogSize 0: 3.9 GB of error_log,
    with every job's name in it, and logrotate's file removed. CUPS kept
    every job's history and document for the term (PreserveJobHistory and
    PreserveJobFiles Yes), showed titles to anyone (JobPrivateValues
    none), let anyone cancel anything, and served /admin to the whole
    school. You put LogLevel back to warn with a rotation, removed the old
    log, limited the history to a week and the documents to a day or
    none, hid private values, required the owner to cancel, and closed
    /admin, all applied by a restart.

    GOOD PRACTICE
    - Debug logging is for a moment: put LogLevel back (cupsctl
      --no-debug-logging), and keep a rotation (MaxLogSize or logrotate).
    - What a server prints is data: decide how long you keep it
      (PreserveJobHistory, PreserveJobFiles, page_log), and write it down.
    - Keep CUPS's default policy: JobPrivateValues default, Cancel-Job for
      @OWNER @SYSTEM.
    - Administration from localhost (cupsctl --no-remote-admin), or over
      ssh with a tunnel when you need the web pages.
    - cupsctl changes cupsd.conf and restarts cupsd; after nano, cupsd -t
      then systemctl restart cups.
    - A rotated log still takes its space until it's gone.

    DOCUMENTATION
    - cupsd.conf: https://www.cups.org/doc/man-cupsd.conf.html
    - cupsctl: https://www.cups.org/doc/man-cupsctl.html
    - Managing operation policies: https://www.cups.org/doc/policies.html
    - CUPS's log files: https://www.cups.org/doc/man-cupsd-logs.html
