### Story "The Data Centre", chapter 4 "The great fire":
### rebuilding a server from the backups. Commands, paths, file names and
### the messages of apt, nginx and tar are not translated. The website's
### HTML pages (incendie-site-*) belong to the media library: they are
### translated.

chapitre-incendie = The great fire
    .resume = The data centre burned down: start again from an empty machine with the backups, apt, tar and nginx -t.

## Files

incendie-courriel-awa =
    From:    Awa (operations manager)
    To:      you
    Subject: Fire at the data centre: we're rebuilding

    Last night, around 12:47 am, a fire broke out in our hosting
    provider's data centre. Nobody was hurt. But our server's room burned:
    the server, its disks, and everything that was on them.

    This morning the provider delivered a brand new machine: a perfectly
    clean Debian, with the same name and the same IP address (they moved
    it to the new machine). Your account is there, with your usual
    password (welcome-2026). Nothing else: no nginx, no website.

    Luckily, our backups go every night to another data centre, in
    another city. The provider mounted them on /mnt/backup. My
    recovery plan is there too: DRP.txt.

    I'm on site with the firefighters. Get the media library's website
    back online, and tell me what we lost.
incendie-pra =
    DISASTER RECOVERY PLAN (DRP) — MEDIA LIBRARY WEBSITE
    To follow if the server is lost: we start again from a new machine.

    Backed up every night at 12:30 am, in another data centre:
      /etc/nginx/sites-available/mediatheque   the website, for nginx
      /etc/nginx/sites-enabled/mediatheque     the same, enabled
      /etc/nginx/bloques.conf                  the blocked addresses
      /var/www/mediatheque/                    the pages

    One archive per night: /mnt/backup/mediatheque-YYYY-MM-DD.tar.gz

    Paths are stored in it from the root, without the leading /.

    1. Install nginx (Debian package).
    2. Check the archive BEFORE extracting it: list it in full.
    3. Extract it in its place, from the root.
    4. Check nginx's configuration, then reload it.
    5. Test with curl, asking for the website by its name.

    The details of each command are in its manual (man apt, man tar,
    man nginx, man curl).

## The media library website (restored pages)

incendie-site-index-1 =
    <!DOCTYPE html>
    <html lang="en">
    <head><meta charset="utf-8"><title>Neighbourhood Media Library</title></head>
    <body>
    <h1>Neighbourhood Media Library</h1>
    <p>Open Tuesday to Saturday, 10 am to 6 pm.</p>
    <p>The online catalogue will be back soon.</p>
    </body>
    </html>
incendie-site-index-2 =
    <!DOCTYPE html>
    <html lang="en">
    <head><meta charset="utf-8"><title>Neighbourhood Media Library</title></head>
    <body>
    <h1>Neighbourhood Media Library</h1>
    <p>Open Tuesday to Saturday, 10 am to 6 pm.</p>
    <p>Autumn half-term: special opening on Sunday 25 October, 2 pm to 5 pm.</p>
    <p>The online catalogue will be back soon.</p>
    </body>
    </html>
incendie-site-index-3 =
    <!DOCTYPE html>
    <html lang="en">
    <head><meta charset="utf-8"><title>Neighbourhood Media Library</title></head>
    <body>
    <h1>Neighbourhood Media Library</h1>
    <p>Open Tuesday to Saturday, 10 am to 6 pm.</p>
    <p>Autumn half-term: special opening on Sunday 25 October, 2 pm to 5 pm.</p>
    <p>Thursday 29 October, 6 pm: meet a comic book author.</p>
    <p>The online catalogue will be back soon.</p>
    </body>
    </html>
incendie-site-horaires =
    <!DOCTYPE html>
    <html lang="en">
    <head><meta charset="utf-8"><title>Opening hours — Neighbourhood Media Library</title></head>
    <body>
    <h1>Opening hours</h1>
    <p>Tuesday to Saturday, 10 am to 6 pm. Closed on Sundays and Mondays.</p>
    </body>
    </html>

## Events

incendie-evenement-liste-vide =
    A new machine doesn't know any package yet: its list of available
    packages is empty. First you need to download it from the Debian
    repositories. The manual tells you how: man apt.
incendie-evenement-nginx =
    nginx is installed, and it's already running: on Debian, installing a
    service starts and enables it. Try curl http://localhost: it's nginx's
    welcome page. The web server is there; the website is still missing.
incendie-evenement-tronquee =
    "Unexpected EOF": last night's archive is cut off. The backup
    started at 12:30 am; at 12:47 am, the fire broke out, and the upload
    stopped halfway. Look at its size with ls -l, next to the others.

    tar reads what comes before the cut, then stops: extracted, this
    archive would give back the configuration, but not a single page of the website. A backup you have never read back is only a hope. Take the
    latest archive that reads all the way through.
incendie-evenement-mauvais-lieu =
    The archive was extracted where you were: in your directory, not in
    place of the lost files. nginx won't find them there. Read man tar
    again: an option lets you choose where to extract. (You can delete
    what was extracted here.)
incendie-evenement-doublon =
    nginx rejects the configuration: "a duplicate default server". Two
    websites want to be the default website on port 80: the media
    library's, restored from the backup, and the one Debian installs with
    nginx, in /etc/nginx/sites-enabled/. On the old server, there was only
    one. Which one should you keep? (man nginx, and nginx -t after each
    change.)

    Good news: as long as the new configuration is rejected, nginx keeps
    the old one. The server doesn't go down.
incendie-evenement-mercredi =
    The website answers… with Wednesday's page: the holiday opening hours
    are missing, which Awa added on Wednesday afternoon. This archive is
    not the most recent intact one.
incendie-evenement-fin =
    curl http://medialibrary.example answers: the media library is back
    online, on a machine that didn't exist last night.

    Awa: "Thanks. We lost Thursday's work: the announcement for next
    Thursday's event was in last night's backup, the one the fire cut
    off. I'll put it back. Everything else is there, because the backups
    were SOMEWHERE ELSE."

    Well done! You have finished chapter 4 of The Data Centre. (One last
    chapter awaits you, three months later: The certificate has expired.)

    WHAT HAPPENED
    The fire destroyed the server and its disks. What saved the website: a
    backup every night, in another data centre, and a recovery plan
    written in advance. The latest archive, however, was cut off in the
    middle of being written: without tar -tzf, you would have restored a
    half-empty website.

    This isn't fiction. During the night of 9 to 10 March 2021, a fire
    destroyed a building of OVHcloud's data centre in Strasbourg (SBG2).
    Thousands of customers were affected, and some lost everything: their
    backups were on the same site as their servers.

    GOOD PRACTICE
    - 3-2-1: three copies, on two media, one of them far away (another
      city, not just another building).
    - Write the recovery plan BEFORE the fire, and try it for real on an
      empty machine.
    - Read your backups back (tar -tzf) and monitor their size: a cut-off
      archive looks like an archive.
    - Decide in advance how much you accept to lose (here, one day) and
      how quickly you must be back up.
    - An SSH host key that changes: check the new fingerprint by another
      means before removing the old one (ssh-keygen -R).
    - sudo nginx -t before each reload; only one default_server per port.

    DOCUMENTATION
    - apt: https://manpages.debian.org/trixie/apt/apt.8.en.html
    - nginx, the command line: https://nginx.org/en/docs/switches.html
    - nginx, choosing the website: https://nginx.org/en/docs/http/request_processing.html
    - GNU tar: https://www.gnu.org/software/tar/manual/
    - ssh-keygen: https://man.openbsd.org/ssh-keygen
