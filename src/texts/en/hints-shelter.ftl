### Graded hints for The Shelter (see src/engine/hints.ts): one message per
### step, hint-<chapter>-<event>, with .lead (a direction, without the
### exact command) and .solution (almost the answer).

## Chapter 1 — What Do We Have?

hint-what-we-have-paddock =
    .lead = The plan is on meadow; what it describes runs on paddock. Read the plan, then go and look (man ssh).
    .solution = cat /srv/drp/plan.md, then ssh paddock
hint-what-we-have-units =
    .lead = Start with what systemd runs on paddock: the services, loaded and active (man systemctl, list-units).
    .solution = systemctl list-units --type=service
hint-what-we-have-timers =
    .lead = What runs on its own, on a schedule: systemd's timers, and cron (man systemctl, list-timers; man crontab).
    .solution = systemctl list-timers, then systemctl cat vetlink-sync.service
hint-what-we-have-sockets =
    .lead = What listens, and for whom: the TCP sockets in LISTEN, with their process (man ss).
    .solution = sudo ss -tlnp
hint-what-we-have-script =
    .lead = The plan says a nightly job makes the backups: the timer names the service, the service names the script. What does it back up?
    .solution = systemctl cat shelter-backup.service, then cat /usr/local/sbin/shelter-backup
hint-what-we-have-snapshots =
    .lead = What the repository really holds: its snapshots, their paths, their dates. The job knows the repository and its password file (man restic).
    .solution = on paddock: sudo restic -r sftp:restic@meadow.internal:/srv/restic -p /root/.restic-pass snapshots
hint-what-we-have-rows =
    .lead = Rewrite the plan's table: one row per service that really runs, an RPO the nightly job can keep, an RTO, its backup, an owner who is still here.
    .solution = nano /srv/drp/plan.md: remove phpList, RPO 24h for the app, add | Vet records (vetlink) | 24h | 2d | restic, every night | Mirela |, owners Teuila, you, Mirela.
hint-what-we-have-fixed =
    .lead = vetlink's records must be in the nightly backup: its restic backup line lists the paths it takes.
    .solution = on paddock: sudo nano /usr/local/sbin/shelter-backup, add /srv/vetlink to the restic backup line.
hint-what-we-have-saved =
    .lead = The job only runs at 2:00. Until then vetlink still has no copy: a backup now closes the gap.
    .solution = on paddock: sudo /usr/local/sbin/shelter-backup (or sudo systemctl start shelter-backup.service)
hint-what-we-have-end =
    .lead = Every service of the table needs a snapshot younger than its RPO, and the table must hold only what runs.
    .solution = Check restic snapshots: the latest one holds /srv/vetlink, and no RPO in the table is shorter than 24h.

## Chapter 2 — Rebuild on the Spare

hint-rebuild-haven =
    .lead = Teuila's message, the envelope and the plan's restore order are on meadow; the new machine is called haven.
    .solution = cat /srv/drp/plan.md, cat envelope.txt, then ssh haven
hint-rebuild-packages =
    .lead = The plan's first step on a blank machine: the packages its services need, from Debian (man apt).
    .solution = sudo apt update, then sudo apt install nginx postgresql
hint-rebuild-snapshots =
    .lead = The repository's address and the recovery password are in the envelope; restic asks for the password when none is given (man restic).
    .solution = sudo restic -r sftp:restic@meadow.internal:/srv/restic snapshots, then the envelope's password.
hint-rebuild-restored =
    .lead = Restore the latest snapshot beside the new system, never over it: --target names an empty directory, restic recreates the full paths under it.
    .solution = sudo restic -r sftp:restic@meadow.internal:/srv/restic restore latest --target /srv/restore
hint-rebuild-copied =
    .lead = From what was restored, copy back only what is the shelters' own: the site, the app, vetlink's records (man cp).
    .solution = sudo cp -r /srv/restore/var/www/shelter /var/www/, sudo cp -r /srv/restore/srv/adopt /srv/restore/srv/vetlink /srv/
hint-rebuild-database =
    .lead = The database comes back from the dump in /srv/restore/var/backups: an empty database first, then the dump read into it, as postgres (man createdb, man psql).
    .solution = sudo -u postgres createdb shelter, then sudo -u postgres psql shelter -f /srv/restore/var/backups/shelter.sql
hint-rebuild-verified =
    .lead = The job recorded the dump's SHA-256 and each table's rows, next to the dump: compare (man sha256sum, man psql).
    .solution = cd /srv/restore/var/backups && sha256sum -c shelter.sha256 (and sudo -u postgres psql shelter -c "SELECT count(*) FROM animals" against shelter.counts)
hint-rebuild-adopt =
    .lead = The app's unit is in the restored /etc/systemd/system: put it in place, have systemd read it, start it once its database is there (man systemctl).
    .solution = sudo cp /srv/restore/etc/systemd/system/adopt.service /etc/systemd/system/, sudo systemctl daemon-reload, sudo systemctl enable --now adopt
hint-rebuild-nginx =
    .lead = nginx needs the shelters' site file, enabled, its configuration checked, then reloaded (man nginx).
    .solution = sudo cp /srv/restore/etc/nginx/sites-available/shelter /etc/nginx/sites-available/, sudo ln -s /etc/nginx/sites-available/shelter /etc/nginx/sites-enabled/, sudo nginx -t, sudo systemctl reload nginx
hint-rebuild-vetlink =
    .lead = Mirela's vet records are in the snapshot too, under /srv/vetlink.
    .solution = sudo cp -r /srv/restore/srv/vetlink /srv/
hint-rebuild-tested =
    .lead = Test on haven itself, asking for the site by its name and the app behind /adopt/ (man curl, -H).
    .solution = curl -H "Host: www.hillsideshelters.example" http://localhost/adopt/animals
hint-rebuild-end =
    .lead = The plan's restore order, to the end: the site, the app on its checked database, vetlink's records, a local test.
    .solution = Check with curl -H "Host: www.hillsideshelters.example" http://localhost/ and /adopt/animals on haven.

## Chapter 3 — Switch and Learn

hint-switch-and-learn-outside-closed =
    .lead = Before moving the name, check from here that Riverbend's public address answers with the site (man curl).
    .solution = curl -H "Host: www.hillsideshelters.example" http://203.0.113.163/
hint-switch-and-learn-opened =
    .lead = haven's firewall only lets ssh in: the web must get through too (man ufw).
    .solution = on haven: sudo ufw allow 80/tcp (or sudo ufw allow "Nginx HTTP"), then sudo ufw status
hint-switch-and-learn-outside =
    .lead = Now that haven lets the web in, check again from meadow, through the public address.
    .solution = curl -H "Host: www.hillsideshelters.example" http://203.0.113.163/adopt/animals
hint-switch-and-learn-zone =
    .lead = The zone is on meadow, in /etc/bind: www's address changes, and so must the serial, before named reloads it (man named-checkzone, man rndc).
    .solution = sudo nano /etc/bind/db.hillsideshelters.example: www → 203.0.113.163, serial 2031111401; sudo named-checkzone hillsideshelters.example /etc/bind/db.hillsideshelters.example; sudo rndc reload
hint-switch-and-learn-switched =
    .lead = Ask the registrar's server, which the world asks: does it serve the new address (man dig)?
    .solution = dig @ns1.registrar.example www.hillsideshelters.example
hint-switch-and-learn-resolver =
    .lead = The public resolver keeps what it was told for the TTL: ask it, and again a few minutes later.
    .solution = dig www.hillsideshelters.example (the ANSWER's TTL counts down)
hint-switch-and-learn-review =
    .lead = Fill every section of review.md: the timeline's times come from the logs (sitewatch.log, the snapshots, named's journal); each action has an owner; no one to blame.
    .solution = nano review.md: Timeline with 02:00 (last backup), 02:50 (first failed check), the switch's time; Actions as "- Move the server out of the cellar (Wiremu)".
hint-switch-and-learn-drill =
    .lead = Mirela's script only lists the snapshots. A drill restores beside, checks what came back, and runs on its own (man restic, man sha256sum, man crontab).
    .solution = sudo nano /usr/local/sbin/restore-drill: restic restore latest --target /tmp/drill --include /var/backups, then cd /tmp/drill/var/backups && sha256sum -c shelter.sha256; sudo crontab -e: 0 4 1 * * /usr/local/sbin/restore-drill
hint-switch-and-learn-end =
    .lead = Everything at once: www served from haven to the world, checked from outside, the review written, the drill scheduled.
    .solution = dig @ns1.registrar.example www.hillsideshelters.example, curl from meadow, review.md complete, the drill in root's crontab.
