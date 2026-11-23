### Story "The Shelter", chapter "Rebuild on the Spare": paddock drowned
### in the flooded cellar; haven, a fresh Debian, is rebuilt from the
### backups in the plan's order (packages, restore beside, the database
### and its checks, services in order, a local test).
### Commands, options, paths and outputs are not translated.

chapter-rebuild = Rebuild on the Spare
    .summary = Last night the cellar flooded, and the server with it. A donated machine is waiting, freshly installed, and so are the backups and the treasurer's envelope. Follow the plan: packages, a restore beside the new system, the database checked row by row, the services in the right order, and a test before anyone switches anything.

## Files

rebuild-message-teuila =
    From: Teuila
    Friday 14 November, 8:30

    Bad news. The river came up in the night and the cellar of the barn at
    Hillside is under 40 cm of water. paddock was down there. The site has
    been down since the small hours (meadow's checks are in
    /var/log/sitewatch.log). The animals are fine: the kennels are
    upstairs.

    Good news: Wiremu brought the machine the computer club gave us last
    month. He installed Debian 13 on it this morning, with restic, and
    called it haven; it's at Riverbend, on the network (ssh haven from
    here). Rahel opened the envelope: it's in envelope.txt, next to this
    message.

    The plan we fixed together is in /srv/drp/plan.md, with its restore
    order. Could you bring the site and the app back on haven? Don't
    switch anything yet: we'll do that together this afternoon, once it
    works.

    Teuila

rebuild-envelope =
    THE SEALED ENVELOPE (Rahel's safe), opened Friday 14 November, 8:15

    Restic repository of the shelters (recovery key):

        repository:  { $repo }
        password:    { $password }

    Dariusz, May 2029: "This key opens every backup, from anywhere. If you
    are reading this, something bad happened: breathe, follow the plan."

## Events

rebuild-event-down =
    Every five minutes since 2:50, the check times out: Hillside's address
    no longer answers. The last good check was at 2:45, and the last
    backup ran at 2:00: at worst, 50 minutes of data are lost, well inside
    the plan's 24-hour RPO.
rebuild-event-paddock-gone =
    paddock no longer answers, and won't: it's under water. Everything
    you need now is in the repository and in the envelope.
rebuild-event-haven =
    haven: a fresh Debian 13, restic installed, nothing else. The plan's
    restore order is your checklist (/srv/drp/plan.md on meadow): first,
    the packages the services need.
rebuild-event-no-lists =
    A freshly installed machine knows no package yet: apt update first,
    then apt install.
rebuild-event-packages =
    nginx and PostgreSQL are installed (and started, as Debian packages
    do), with their default configuration. Now the shelters' own files,
    from the repository: its address and password are in the envelope.
rebuild-event-wrong-password =
    That password opens no key of the repository. The nightly job's
    password drowned with paddock: the envelope's is the one.
rebuild-event-snapshots =
    The repository opens with the envelope's key, over sftp from haven:
    the last snapshot is from 2:00 last night. Restore it beside the new
    system (--target on an empty directory), then take what belongs back.
rebuild-event-over-etc =
    The restore went over /: paddock's { $files } replaced haven's. On the
    next boot, haven would look for paddock's disk (fstab), and every
    machine that knows haven would see a new SSH host key; two machines
    with one machine-id confuse DHCP and the journal. Wiremu, who kept a
    copy of the fresh install's /etc, puts haven's own files back. Restore
    beside (--target /srv/restore, for example) and copy only what is the
    shelters' own.
rebuild-event-restored =
    The snapshot is beside the new system, its full paths recreated under
    the target. Now copy back what is the shelters' own: the site
    (/var/www/shelter), the app (/srv/adopt), vetlink's records
    (/srv/vetlink), nginx's site file, the app's unit. Leave paddock's
    fstab, hostname, machine-id and SSH keys where they are.
rebuild-event-copied =
    The site and the app are in place. The app's unit is read after
    systemctl daemon-reload. The database comes first: the app can't start
    without it.
rebuild-event-too-early =
    adopt failed to start: its database isn't there yet (journalctl -u
    adopt says which). That's why the plan starts the database before the
    app: restore it, then start adopt again.
rebuild-event-database =
    Every row of last night's dump is back in shelter. Before trusting it,
    compare with what the job recorded: shelter.sha256 for the dump
    itself, shelter.counts for the rows of each table.
rebuild-event-verified =
    The dump matches what the job recorded: nothing was damaged on the way.
rebuild-event-adopt =
    adopt is running, on its database.
rebuild-event-default-site =
    That's nginx's default page: the request reached the default site. The
    shelters' site answers for its own name (server_name): ask for it, with
    curl -H "Host: …", or enable the site first.
rebuild-event-nginx =
    nginx serves the shelters' site on haven.
rebuild-event-vetlink =
    Mirela's vet records are back in /srv/vetlink: the fix of a fortnight
    ago paid off.
rebuild-event-tested =
    curl on haven itself reaches the app through nginx: the site works
    before anyone points the world at it.
rebuild-event-end =
    Teuila: "Mirela just saw Biscuit's page on haven. Lunch, then we
    switch."

    Well done! You finished chapter 2 of The Shelter.

    WHAT HAPPENED
    paddock was lost with the cellar. On a blank machine, with the
    repository and the envelope only, you followed the plan: packages from
    Debian, the latest snapshot restored beside the new system, the
    shelters' own files copied into place, the database recreated from its
    dump and checked against the job's checksum and counts, the services
    started in the order of their dependencies, and a local test before
    any switch.

    GOOD PRACTICE
    - Rebuild from the plan, step by step: under stress, a checklist beats
      memory.
    - Restore beside, then copy what is yours. A machine's /etc holds its
      identity (fstab and its disks' UUIDs, hostname, machine-id, SSH host
      keys, network): never restore another machine's over it.
    - A database comes back from its dump, then is checked (checksum,
      row counts) before anything uses it.
    - Start in the order of dependencies (After=, Requires=): the
      database, the app, then what serves it.
    - Test locally (curl -H "Host: …" http://localhost/) before switching.
    - The recovery key lives off-site, on paper: the job's key drowned
      with the server.

    DOCUMENTATION
    - restic, restoring from backup: https://restic.readthedocs.io/en/stable/050_restore.html
    - restic, sftp repositories: https://restic.readthedocs.io/en/stable/030_preparing_a_new_repo.html#sftp
    - PostgreSQL, restoring a dump: https://www.postgresql.org/docs/current/backup-dump.html#BACKUP-DUMP-RESTORE
    - systemd.unit, After= and Requires=: https://www.freedesktop.org/software/systemd/man/latest/systemd.unit.html
    - NIST SP 800-34 Rev. 1 (the recovery phase): https://csrc.nist.gov/pubs/sp/800/34/r1/upd1/final
