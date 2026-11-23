### Story "The Shelter", chapter "What Do We Have?": the disaster recovery
### plan, written in 2029, compared with what paddock really runs (units,
### timers, sockets, the backup job), RPO and RTO per service, and a backup
### within each RPO. Also the texts the whole story shares (shelter-*).
### Commands, options, paths and outputs are not translated.

chapter-what-we-have = What Do We Have?
    .summary = The animal shelters have a written disaster recovery plan. It was true in 2029. Before anything goes wrong, compare it with what the server really runs, give every service a recovery point and a recovery time it can actually meet, and make sure each one has a backup young enough.

## Shared by the story: the world's data and files

shelter-animal-names =
    Biscuit
    Mango
    Pepper
    Juniper
    Otis
    Clementine
    Rolo
    Hazel
    Pickles
    Nala
    Bramble
    Ziggy
    Willow
    Fudge
    Pixel
    Saffron
    Bean
    Luna
    Tofu
    Maple
    Kiwi
    Dusty
    Pumpkin
    Ginger
    Moss
    Clover
    Bowie
    Peanut
    Socks
    Indigo
shelter-species =
    dog
    cat
    cat
    rabbit
    dog
    guinea pig
shelter-volunteer-names =
    Teuila
    Mirela
    Rahel
    Wiremu
    Oyelaran
    Bilal
    Chiamaka
    Dmitri
    Ximena
    Farida
    Gideon
    Hyun-woo
    Isolde
    Jamal
    Kalinda
    Lorenzo
    Mahsa
    Nikolai
    Odessa
    Priyanka
shelter-site-hillside = Hillside
shelter-site-riverbend = Riverbend
shelter-env-comment = Adopt's settings (Dariusz, 2029). Read when the service starts.
shelter-adopt-readme =
    Adopt: the shelters' adoption app (Flask, served by gunicorn on
    127.0.0.1:8000, behind nginx's /adopt/).
    Its data is in the PostgreSQL database "shelter" (animals, adoptions,
    volunteers). It needs the database to start.
shelter-backup-comment = Nightly backup of paddock to meadow (Dariusz, 2029): the database's dump, then restic.
shelter-vetlink-comment = vetlink: pulls the vet clinic's records of our animals, every hour (Mirela, 2031).
shelter-site-index =
    <!DOCTYPE html>
    <html lang="en">
    <head>
    <meta charset="utf-8">
    <title>Hillside Animal Shelters</title>
    </head>
    <body>
    <h1>Hillside Animal Shelters</h1>
    <p>Dogs, cats and rabbits waiting for a home, at Hillside and Riverbend.</p>
    <p><a href="/adopt/">Adopt</a> · <a href="/adopt/animals">The animals waiting for you</a></p>
    </body>
    </html>
shelter-app-home =
    <!DOCTYPE html>
    <html lang="en">
    <head><meta charset="utf-8"><title>Adopt — Hillside Animal Shelters</title></head>
    <body><h1>Adopt</h1><p>Meet the animals, book a visit, start an adoption.</p></body>
    </html>
shelter-app-animals =
    <!DOCTYPE html>
    <html lang="en">
    <head><meta charset="utf-8"><title>The animals waiting — Adopt</title></head>
    <body><h1>The animals waiting</h1><p>{ $count } animals are waiting for a home.</p></body>
    </html>
shelter-plan-col-service = Service
shelter-plan-col-backup = Backup
shelter-plan-col-owner = Owner
shelter-zone-comment = hillsideshelters.example, hidden primary on meadow; the registrar's server serves it.
shelter-drill-draft =
    #!/bin/sh
    # Restore drill (Mirela's draft, November 2031). Not scheduled yet.
    set -e
    export RESTIC_REPOSITORY={ $repo }
    export RESTIC_PASSWORD_FILE=/root/.restic-drill
    restic snapshots --latest 1
    echo "$(date -Is) drill done"

shelter-plan-2029 =
    # Disaster recovery plan — Hillside Animal Shelters

    Written by Dariusz, May 2029. Keep it up to date, and keep it off paddock:
    the plan must survive the server it describes.

    ## Services

    | Service | RPO | RTO | Backup | Owner |
    |---------|-----|-----|--------|-------|
    | Website (nginx) | 24h | 2d | restic, every night at 02:00 | Dariusz |
    | Adoption app and its database (PostgreSQL) | 1h | 1d | pg_dump then restic, every night at 02:00 | Dariusz |
    | Newsletter (phpList) | 1w | 1w | restic, every night at 02:00 | Dariusz |

    RPO (recovery point objective): how much data we can afford to lose,
    the time since the last good backup.
    RTO (recovery time objective): how long the service may stay down.
    Durations as 30min, 4h, 1d, 1w.

    ## Backups

    The nightly job on paddock (/usr/local/sbin/shelter-backup, started by
    shelter-backup.timer) dumps the database, then sends its files to the
    restic repository on meadow (/srv/restic, over sftp). The recovery
    password is in a sealed envelope in Rahel's safe.

    ## Restore order

    To be written.

shelter-plan-2031 =
    # Disaster recovery plan — Hillside Animal Shelters

    Written by Dariusz, May 2029; reviewed by Teuila and you, November 2031.
    Keep it up to date, and keep it off paddock: the plan must survive the
    server it describes.

    ## Services

    | Service | RPO | RTO | Backup | Owner |
    |---------|-----|-----|--------|-------|
    | Website (nginx) | 24h | 8h | restic, every night at 02:00 | Teuila |
    | Adoption app and its database (PostgreSQL) | 24h | 8h | pg_dump then restic, every night at 02:00 | you |
    | Vet records (vetlink) | 24h | 2d | restic, every night at 02:00 | Mirela |

    ## Backups

    The nightly job on paddock dumps the database (shelter.sql, with its
    SHA-256 in shelter.sha256 and its row counts in shelter.counts), then
    sends /etc, /var/www, /srv/adopt, /srv/vetlink and /var/backups to the
    restic repository on meadow (/srv/restic, over sftp). The recovery
    password is in a sealed envelope in Rahel's safe.

    ## Restore order

    1. A machine with a fresh Debian 13 and restic.
    2. The packages the services need (the plan's table), from Debian.
    3. The latest snapshot, restored BESIDE the new system. /etc belongs to
       the new machine: take from the backup only what is ours (the site,
       the app, the units), never its disks, its identity or its keys.
    4. The database, recreated from the dump, checked against the job's
       SHA-256 and row counts before anything uses it.
    5. Start in the order of dependencies: the database, the app, then
       nginx.
    6. Test on the machine itself, before anyone switches anything.
    7. Switch www (its TTL is 300 seconds since November 2031, for this),
       and check from outside.
    8. Write the review; plan the next drill.

## Files

what-we-have-message-teuila =
    From: Teuila (coordinator)
    Monday 3 November, 9:20

    Hello, and welcome to the shelters!

    The board asked me a simple question: "if paddock died tonight, what
    would we do?". We have an answer on paper: Dariusz's disaster recovery
    plan, /srv/drp/plan.md here on meadow. But Dariusz moved to the coast
    in 2030, and the plan hasn't moved since 2029.

    Could you make it true again? Look at what paddock really runs (ssh
    paddock from here), compare with the plan, and fix the table: one row
    per service, with an RPO and an RTO we can really keep, its backup, and
    someone who's still here to answer for it (me, Mirela, Rahel, Wiremu,
    or you).

    And check that every service in it really has a recent enough backup.
    The repository is here on meadow, in /srv/restic; paddock's nightly job
    has the password.

    Thank you!
    Teuila

## Events

what-we-have-event-plan =
    Dariusz's table: three services, their RPO (how much data you can
    lose) and RTO (how long they can be down). Is that still what paddock
    runs? The plan's own words are the place to start, not the answer:
    look at the machine.
what-we-have-event-paddock =
    You're on paddock, in Hillside's cellar. An inventory starts with what
    runs, not with what was written: the services (systemctl
    list-units --type=service), what is scheduled (systemctl
    list-timers, crontab -l), what listens (ss -tlnp).
what-we-have-event-units =
    nginx, postgresql, and adopt: the adoption app the plan mentions, a
    service of its own (its unit is in /etc/systemd/system). And
    no phpList anywhere.
what-we-have-event-timers =
    Two timers of the shelters' own: shelter-backup (the nightly job) and
    vetlink-sync, every hour. vetlink is in no line of the plan. systemctl
    cat vetlink-sync.service says what it runs, and where its data goes.
what-we-have-event-sockets =
    ssh and nginx facing the network; PostgreSQL (5432) and the app's
    gunicorn (8000) on 127.0.0.1 only, behind nginx. What listens matches
    what runs: nothing hidden there.
what-we-have-event-no-phplist =
    No phpList on paddock: it was removed in 2030 (the newsletter went to
    a mailing service). A plan that restores what no longer exists sends
    you looking for it on the worst night of the year: its row goes.
what-we-have-event-script =
    The nightly job backs up /etc, /var/www, /srv/adopt and /var/backups.
    vetlink writes its records in { $path }: it isn't in the list.
    Mirela's records are in no backup at all.
what-we-have-event-snapshots =
    The repository's snapshots: one per night, at 2:00, kept 14 days and 8
    weeks. Each one's paths say what it holds; restic ls or find say
    whether a file is in it. A plan's RPO is only true if the backups are
    that young.
what-we-have-event-rpo-unmet =
    An RPO shorter than the backups' rhythm can't be kept: the job runs
    once a night, so on the worst night you lose up to 24 hours. Either
    the RPO says the truth (24h), or the schedule changes to meet it.
what-we-have-event-old-owner =
    Dariusz is in the table still. An owner is the person you call at
    3 a.m., and Dariusz left two years ago: Teuila, Mirela, Rahel,
    Wiremu, or you.
what-we-have-event-stale-row =
    phpList's row is still there: the plan would restore a service paddock
    stopped running in 2030. Remove it.
what-we-have-event-rows =
    The table is true: the site, the app and its database, vetlink, each
    with an RPO the job can keep, an RTO, a backup, an owner. Now the
    backups have to keep the promise too.
what-we-have-event-unsaved =
    vetlink has its row, with an RPO: but no snapshot holds its records.
    The plan promises a backup that doesn't exist yet. The job's restic
    backup line on paddock decides what goes in.
what-we-have-event-fixed =
    The nightly job takes vetlink's records from tonight. Until tonight,
    there is still no copy: a backup now (run the job, or restic backup
    yourself) closes the gap today.
what-we-have-event-saved =
    A snapshot holds vetlink's records: Mirela's work now survives
    paddock.
what-we-have-event-end =
    Teuila: "So that's what we really have. I'll print it for the board,
    and give Rahel a copy for the safe, with the envelope."

    Well done! You finished chapter 1 of The Shelter.

    WHAT HAPPENED
    The plan described paddock as it was in 2029. The inventory (systemd's
    units and timers, the sockets, the job) found a service gone (phpList),
    a service missing from both the plan and the backups (vetlink), an RPO
    of one hour for a database backed up once a night, and an owner who
    had left. The table now says what runs, what each service can lose and
    how long it can wait, who answers for it; and every service has a
    snapshot younger than its RPO.

    GOOD PRACTICE
    - A plan is checked against the machine, not against itself: what
      runs (systemctl list-units, list-timers, crontab -l), what listens
      (ss -tlnp), what is backed up (the job, restic snapshots and ls).
    - RPO and RTO are business decisions, written down: the backups'
      rhythm must meet the RPO, the restore must fit in the RTO.
    - Every service has an owner who is still around.
    - Keep the plan off the server it describes, and on paper somewhere.
    - Every new service (a timer added one afternoon) goes in the plan and
      in the backups the same day.

    DOCUMENTATION
    - NIST SP 800-34 Rev. 1, Contingency Planning Guide (business impact analysis, RPO, RTO): https://csrc.nist.gov/pubs/sp/800/34/r1/upd1/final
    - restic, working with repositories: https://restic.readthedocs.io/en/stable/045_working_with_repos.html
    - systemctl: https://www.freedesktop.org/software/systemd/man/latest/systemctl.html
