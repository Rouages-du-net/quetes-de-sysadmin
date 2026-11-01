### Graded hints for The Game Library (see src/engine/hints.ts): one message
### per step, indice-<chapter>-<event>, with .piste (a lead, without the exact
### command) and .solution (almost the answer). Place names as in noms.ftl.

## Chapter 1 — The ransom

indice-rancon-restaure =
    .piste = First stop the attack: a program is still running (ps aux), and its account's crontab restarts it. Only then the offline backup: the USB disk from the drawer (lsblk -f), mounted read-only, holds a restic repository. The NAS copy is encrypted too.
    .solution = sudo kill 3141 ; sudo crontab -u accueil -r ; sudo mount -o ro /dev/sdb1 /mnt/usb ; sudo restic -r /mnt/usb/repo restore latest --target / (password: pawn-knight-rook-27)
indice-rancon-fin =
    .piste = The files are back. Now close the way in (the account whose password was guessed), throw away the .locked files and the ransom notes, and put the backup offline again (step out of /mnt/usb to unmount it).
    .solution = sudo usermod -L accueil ; sudo find /srv/share -name "*.locked" -delete ; sudo find /srv/share -name READ-ME-TO-RECOVER.txt -delete ; cd ; sudo umount /mnt/usb

## Chapter 2 — Snapshots

indice-instantanes-erreur-berenice =
    .piste = Set up /etc/rsnapshot.conf: snapshot_root on the second disk, retain levels (7 daily, 4 weekly), a backup line for /srv/share/ — with TABS between the fields. rsnapshot configtest checks it, then cron (root's) runs it.
    .solution = In sudo nano /etc/rsnapshot.conf: snapshot_root⇥/mnt/snapshots/, retain⇥daily⇥7 and retain⇥weekly⇥4 (instead of the alpha, beta and gamma lines), backup⇥/srv/share/⇥localhost/ (⇥ = Tab); sudo rsnapshot configtest; then in sudo crontab -e: 30 3 * * * /usr/bin/rsnapshot daily and 0 3 * * 1 /usr/bin/rsnapshot weekly
indice-instantanes-fin =
    .piste = The most recent snapshot (.0) was taken after Bérénice's mistake. Compare the inventory in older snapshots with diff, and take the one from the night before.
    .solution = sudo cp /mnt/snapshots/daily.1/localhost/srv/share/inventory.csv /srv/share/ (daily.1: the night before, if your levels are called daily).

## Chapter 3 — The Database

indice-base-test-reussi =
    .piste = A real backup of a running database is pg_dump, run as the postgres account (sudo -u). And a backup is only worth something if it restores: try it in a separate test database (man createdb, man pg_restore), never over ludo.
    .solution = sudo -u postgres pg_dump -Fc -f /var/backups/postgresql/ludo.dump ludo ; sudo -u postgres createdb ludo_test ; sudo -u postgres pg_restore -d ludo_test /var/backups/postgresql/ludo.dump
indice-base-prets-revenus =
    .piste = The prets table in ludo is empty, the rest is intact. pg_restore can put back just one table (-t), and only its data into an empty table.
    .solution = sudo -u postgres pg_restore -d ludo --data-only -t prets /var/backups/postgresql/ludo.dump
indice-base-fin =
    .piste = Now run that pg_dump every night, as a role of the database: root is not one. Whose crontab, then?
    .solution = sudo crontab -u postgres -e, and add: 15 2 * * * pg_dump -Fc -f /var/backups/postgresql/ludo.dump ludo
