### Story "The Observatory", chapter 4 "The Stuck Process": signals (TERM,
### KILL), a script's trap, a stale PID file. Commands, paths and the
### tools' outputs are not translated.

chapter-stuck-process = The Stuck Process
    .summary = Last night's copy to the club's NAS never finished: rsync waits, its script retries forever, and won't let itself be stopped. Get rid of it cleanly, so that tonight's copy runs.

## Files

stuck-process-message-amara =
    From:     Amara
    To:       you
    Subject:  The NAS copy is stuck

    Hello,

    Every night at 2 am, cron runs /usr/local/bin/sync-photos, which
    copies the gallery to the club's NAS. Last night the NAS was off (a
    power cut at the club's room). It is back since 9 am, but the copy
    started at 2 am is still there, stuck.

    And if it is still there tonight, the new copy won't even start: the
    script keeps a PID file and gives up if it finds one.

    I tried kill on it, nothing happened. Can you make it go away, and
    check that tonight's copy will run?

    Same sudo password: nebula-2028.

    Amara

## Events

stuck-process-event-stuck =
    The copy: a /bin/bash script (sync-photos), and its child, rsync,
    which has been waiting for the NAS since 2 am. ps -ef shows who
    started whom (the PPID column).
stuck-process-event-ignored =
    SIG{ $signal } sent, and the script is still there: no error, nothing.
    A process can ignore a signal, or handle it its own way (look at the
    script: trap). Only two signals can't be caught nor ignored (man 7
    signal).
stuck-process-event-respawn =
    rsync died… and a new one appeared (PID { $pid }): the script retries
    it in a loop ("until rsync …; do sleep 60; done"). As long as the
    script lives, killing its child is useless.
stuck-process-event-orphan =
    The script is gone, but its rsync is still there: the children of a
    process that dies are not killed with it, they are adopted by init
    (PPID 1). rsync itself is an ordinary process: it accepts TERM.
stuck-process-event-stale =
    No more processes. But the script ended with KILL: it couldn't run
    its last line (rm -f "$LOCK"). Its PID file still says 3301, a
    process that doesn't exist any more: tonight, the new copy will find
    it and give up ("already running"). A stale PID file is removed by
    hand, once you have checked that the process is really gone.
stuck-process-event-early-lock =
    The PID file is gone, but the stuck script is still running: tonight
    a second copy will start alongside it. The file only goes once
    nobody holds it any more.
stuck-process-event-cron-stopped =
    cron is stopped: tonight, nothing will start the copy at all. Start
    it again (sudo systemctl start cron).
stuck-process-event-end =
    No copy left running, no PID file: tonight at 2 am, cron will start
    sync-photos, and it will find the NAS. Amara: "I'll add a timeout to
    rsync (--timeout), so it gives up by itself next time."

    Well done! You have finished the chapter "The Stuck Process".

    WHAT HAPPENED
    rsync waited for the NAS all night. Its script ignored TERM, INT and
    HUP (trap '' …), and restarted rsync each time it died. kill without
    an option sends TERM: ignored.

    THE SIGNALS
    - TERM (15): "please stop"; the default of kill. A program can catch
      it to clean up, or ignore it.
    - KILL (9): the kernel ends the process at once. It can't be caught:
      no cleanup at all (here, the PID file stays).
    - HUP (1): often "reread your configuration" for a daemon; INT (2):
      Ctrl-C; STOP and CONT: pause, resume.
    - The children of a killed process don't die with it: they are
      adopted by init.

    GOOD PRACTICE
    - TERM first, wait a little, KILL only if needed, and then clean up
      what the program would have cleaned up itself.
    - Look at the parents: ps -ef, ps -o pid,ppid,stat,args.
    - Before removing a PID file, check its process: ps -p PID.
    - A copy over the network needs a timeout (rsync --timeout).

    DOCUMENTATION
    - The signals: https://man7.org/linux/man-pages/man7/signal.7.html
    - kill: https://man7.org/linux/man-pages/man1/kill.1.html
    - trap: https://www.gnu.org/software/bash/manual/html_node/Bourne-Shell-Builtins.html#index-trap
