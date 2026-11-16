### Story "The Old Sun", chapter "Read Before Touching": read an unfamiliar
### Solaris 10 system before moving anything off it. Commands, FMRIs, paths
### and outputs are not translated.

chapter-read-first = Read Before Touching
    .summary = The seed library's old Sun box runs Solaris 10: find what runs the catalogue, where its data lives and in which character set, and take a safety snapshot before anything else.

## Files

read-first-email-inaya =
    From:  Inaya
    To:    you

    Hello! I coordinate the volunteers of the seed library. Our catalogue
    (the varieties, the members, who borrowed what) has lived since 2009 on
    the old Sun server in the cupboard, herbarium. Odette set it up; she has
    retired to the seaside and only answers the phone on Sundays.

    We bought a new server, greenhouse (Debian, much smaller and much
    quieter), and we would like the catalogue to move there. But nobody
    dares touch the Sun: it's not Linux, and the last time someone rebooted
    it, it took the whole afternoon.

    Could you first look at how it is put together, and write it down in
    migration.md? Odette's notes are in your folder.

    Inaya

read-first-notes-odette =
    Odette's notes (2014)
    - The catalogue = PostgreSQL + PHP. Everything is started by SMF.
    - Weekly backup: /export/backup/pgdata-weekly.tar (the whole data
      directory, every Sunday night).
    - Disks: ZFS, two mirrors. Never rm in /var/postgres!
    - grep doesn't know -q here: /usr/xpg4/bin/grep does.

read-first-template =
    # Moving the catalogue off herbarium

    ## The database service (its SMF name)
    (to complete)

    ## Where its data lives (directory, ZFS dataset)
    (to complete)

    ## The database (name, PostgreSQL version, character set)
    (to complete)

    ## Before touching anything
    (to complete: the safety net)

## Events

read-first-event-linux-habit =
    Not found: Solaris 10 has neither systemd nor top. Its services are run
    by SMF: svcs lists them, svcs -x explains what's wrong, svcadm drives
    them. And prstat plays top's part (man prstat).
read-first-event-old-grep =
    Solaris's /usr/bin/grep dates from before POSIX: no -q, no -E, no -r.
    The POSIX version is in /usr/xpg4/bin/grep (Odette's notes said so).
    Same story for sed, tar and others: /usr/bin keeps the old behaviour,
    for the scripts of the 1990s.
read-first-event-smf =
    There it is: svc:/application/database/postgresql_84:default_64bit,
    online. On Solaris, a service is named by an FMRI; svcs -l and svcprop
    tell more about it. And next to it, svc:/site/seed-catalogue:default:
    the catalogue itself, a manifest Odette wrote.
read-first-event-maintenance =
    sendmail has been in maintenance since March 2025: unrelated to the
    catalogue, and probably broken for years. Note it, don't fix it now:
    one change at a time, especially on a box nobody knows.
read-first-event-data-dir =
    PostgreSQL's data lives in /var/postgres/8.4/data_64 (the 64-bit
    instance). Never touch those files by hand.
read-first-event-sparc =
    sun4u, sparcv9: a SPARC processor. It writes its numbers with the most
    significant byte first (big-endian), the opposite of the x86 in
    greenhouse. Worth remembering when it's time to move the data.
read-first-event-zfs =
    /var/postgres is a ZFS dataset of its own, data/postgres, on the "data"
    pool (two mirrored disks). ZFS can take a snapshot of it in an instant.
read-first-event-encoding =
    seeds, LATIN1: the database was created in ISO 8859-1, one byte per
    letter, as was common in 2009. greenhouse's PostgreSQL works in UTF-8.
    The accents will need care when it moves.
read-first-event-snapshot =
    A snapshot of data/postgres: whatever happens next, the data as it is
    now can come back in seconds (zfs rollback). It takes almost no room:
    ZFS only keeps the blocks that change afterwards.
read-first-event-end =
    Inaya: "I read your notes. For the first time, I understand what's in
    that cupboard!"

    Well done! You have finished the chapter "Read Before Touching".

    WHAT HAPPENED
    You read an unfamiliar system without changing anything, with its own
    tools: SMF for the services, ZFS for the disks, psql for the database.
    migration.md now says what runs the catalogue, where its data lives,
    and in which character set; and a ZFS snapshot keeps today's data
    within reach.

    GOOD PRACTICE
    - On a system you don't know, read before you act: its services, its
      disks, its versions, and what's already broken (svcs -x).
    - Write it down as you go: the notes are for you, and for whoever comes
      next.
    - Take a safety net before the first change: a snapshot, a backup you
      know how to restore.
    - Use the system's own tools rather than forcing your habits on it:
      svcs rather than ps | grep, /usr/xpg4/bin when POSIX behaviour is
      needed.

    ANOTHER WAY
    A full inventory would also list the cron jobs (crontab -l as each
    user), the network configuration (ifconfig -a, /etc/hosts) and the
    packages (pkginfo). On Solaris 11, the same is done with the IPS
    packaging system (pkg list) and ipadm.

    DOCUMENTATION
    - svcs(1): https://docs.oracle.com/cd/E26505_01/html/816-5165/svcs-1.html
    - zfs(1M): https://docs.oracle.com/cd/E26505_01/html/816-5166/zfs-1m.html
    - PostgreSQL 8.4, character set support: https://www.postgresql.org/docs/8.4/multibyte.html
