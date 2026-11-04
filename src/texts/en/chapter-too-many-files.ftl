### Story "The Observatory", chapter 3 "Too Many Open Files": a process's
### limits, ulimit, prlimit, LimitNOFILE=. Commands, paths and the tools'
### outputs are not translated.

chapter-too-many-files = Too Many Open Files
    .summary = The gallery's new archive page answers 500: "EMFILE: too many open files". The shell's ulimit says 1024, limits.conf says nothing, and the gallery is a service. Give it the limit it needs, for good.

## Files

too-many-files-message-amara =
    From:     Amara
    To:       you
    Subject:  The archive page is broken

    Hello,

    I'm back! This morning I updated the gallery (version 1.5): it has a
    new page, the archive, with a mosaic of all our photos since 2019,
    2400 of them. The home page works, but the archive answers with an
    error:
      curl -i http://localhost:8080/archive

    The members are waiting for it. I don't know where to look: it works
    on my laptop.

    Same sudo password: nebula-2028.

    Amara

too-many-files-archive-page =
    <!DOCTYPE html>
    <html lang="en">
    <head><meta charset="utf-8"><title>Astronomy club — archive</title></head>
    <body>
    <h1>The archive</h1>
    <p>{ $photos } photos since 2019, in a mosaic.</p>
    </body>
    </html>

## Events

too-many-files-event-emfile =
    "EMFILE: too many open files": the gallery tried to open one more
    file, and the kernel refused. Each process has a limit on the number
    of files it holds open at once. How many does it hold, and what is
    its limit? Everything about a process is under /proc/PID (its PID:
    systemctl status gallery).
too-many-files-event-limits =
    Max open files: a soft limit (what the process may use) and a hard
    one (the ceiling up to which it may raise its soft limit itself).
    The archive opens all its 2400 photos and keeps them open: 1024 is
    not enough. Who gave the gallery 1024? It is a service: systemd,
    which starts it.
too-many-files-event-ulimit-shell =
    ulimit changes the limits of YOUR shell, and of what you start from
    it. The gallery was started by systemd: your shell's limits don't
    reach it.
too-many-files-event-limits-conf =
    /etc/security/limits.conf is read by pam_limits when a session opens
    (ssh, login, su). A systemd service doesn't open any session: it
    never reads this file. Its limits come from its unit (man
    systemd.exec: LimitNOFILE=).
too-many-files-event-too-small =
    The gallery now has its own limit, but it is too low: the archive
    holds about { $need } files at once (2400 photos, plus what Node.js
    already holds). Give it some room: 4096, for example.
too-many-files-event-restart-needed =
    systemd has the new limit, but the gallery's process still has the
    old one: a limit is set when the process starts. Restart the
    gallery (sudo systemctl restart gallery).
too-many-files-event-live-only =
    The running gallery now has enough (prlimit changes a running
    process's limits). But only until its next restart: systemd will
    start it again with 1024. Write the limit in its unit too.
too-many-files-event-end =
    The archive answers 200: the mosaic is back, and its limit is in the
    gallery's unit, so it will survive restarts and reboots. Amara: "So
    that's why it worked on my laptop: I ran it from my terminal!"

    Well done! You have finished the chapter "Too Many Open Files".

    WHAT HAPPENED
    The archive opens its 2400 photos and keeps them open. The gallery,
    a systemd service, had systemd's default limit: 1024 open files
    (soft), 524288 (hard). Past 1024, open() fails: EMFILE.

    WHERE LIMITS COME FROM
    - A process inherits its parent's limits, and may lower them, or
      raise its soft limit up to its hard one.
    - systemd sets a service's limits when it starts it: LimitNOFILE= in
      the unit (default 1024:524288).
    - A login session gets them from pam_limits (limits.conf), and
      ulimit changes the shell's: neither reaches a service.
    - prlimit changes a running process's limits, until it restarts.

    GOOD PRACTICE
    - Look at the real process: cat /proc/PID/limits, ls /proc/PID/fd |
      wc -l (what it holds), lsof -p PID.
    - sudo systemctl edit gallery: {"["}Service] LimitNOFILE=4096, then sudo
      systemctl restart gallery.
    - Raise it reasonably: a program that keeps thousands of files open
      may also have a leak to fix.

    DOCUMENTATION
    - LimitNOFILE=: https://www.freedesktop.org/software/systemd/man/latest/systemd.exec.html#LimitCPU=
    - /proc/PID/limits: https://man7.org/linux/man-pages/man5/proc_pid_limits.5.html
    - prlimit: https://man7.org/linux/man-pages/man1/prlimit.1.html
