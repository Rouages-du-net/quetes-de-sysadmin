### Story "The Other Unix", chapter "The Script That Broke": a backup script
### written for Debian, run on FreeBSD. Commands, options, paths and error
### messages are not translated.

chapter-portable-script = The Script That Broke
    .summary = A backup script written on Debian fails on the club's FreeBSD server: read each error, and fix it with this system's manual.

## Files

portable-script-message-yanis =
    From:  Yanis
    To:    you

    Hi! I'm the club's new volunteer. I wrote a script to back up the site
    every night (nightly-backup.sh, in your folder). On my Debian laptop it
    works perfectly. On the server, the last backup in
    /var/backups/state.conf is from 1 September.

    Lucien, who set the server up years ago, used to say "it's not Linux,
    it's FreeBSD". I thought Unix was Unix…

    Can you make it work? Last night's backup (yesterday's date) would be a
    good start.

    Yanis

## Events

portable-script-event-not-found =
    "not found"… about a file that is right there. FreeBSD reads the first
    line, #!/bin/bash, and looks for /bin/bash: it doesn't exist. bash isn't
    part of FreeBSD's base system (a package would put it in
    /usr/local/bin/bash). The base system's shell is /bin/sh: a script that
    only needs sh runs everywhere.
portable-script-event-date =
    date: illegal option -- d. -d is GNU date's (Debian's). FreeBSD has its
    own date, from BSD, with other options: its manual (man date) says how
    to adjust a date (-v).
portable-script-event-stat =
    stat: illegal option -- c. -c FORMAT is GNU stat's. BSD stat takes its
    format with -f, and the sequences differ too: man stat.
portable-script-event-sed =
    sed complains about a script called /var/backups/state.conf: BSD sed's
    -i always takes a word after it, the suffix of the backup copy (-i ''
    for none). Here, it took the s/…/…/ as the suffix, then the file's name
    as the script (/var/ became an address, b a command). man sed, at -i.
portable-script-event-end =
    Yanis: "Yesterday's backup, at last! And state.conf is up to date. I'll
    read the manual of the machine I'm on, from now on."

    Well done! You have finished the chapter "The Script That Broke".

    WHAT HAPPENED
    The script was written for Debian's tools, which are GNU's. FreeBSD
    has its own tools, from BSD: same names, same purpose, but other
    options. date -d, stat -c and sed -i without a suffix are GNU only; and
    bash isn't installed by default.

    GOOD PRACTICE
    - Read the manual of the machine you are on: man date on FreeBSD isn't
      man date on Debian.
    - For a script that must run everywhere: #!/bin/sh, and only what POSIX
      guarantees (date +%F, but not date -d; no sed -i at all: write to a
      temporary file, then mv).
    - set -e stops at the first error: the message tells you which line.

    ANOTHER WAY
    pkg install coreutils brings GNU's tools to FreeBSD, with a g in front
    (gdate, gstat, and gsed in its own package): handy for a script copied
    as is, but the script then depends on packages. pkg install bash, and
    #!/usr/local/bin/bash (or #!/usr/bin/env bash), for bash itself.

    DOCUMENTATION
    - date(1) on FreeBSD: https://man.freebsd.org/cgi/man.cgi?query=date
    - sed(1) on FreeBSD: https://man.freebsd.org/cgi/man.cgi?query=sed
    - stat(1) on FreeBSD: https://man.freebsd.org/cgi/man.cgi?query=stat
    - The FreeBSD Handbook, shells: https://docs.freebsd.org/en/books/handbook/basics/#shells
