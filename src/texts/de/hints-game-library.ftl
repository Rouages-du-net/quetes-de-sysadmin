### Abgestufte Hinweise für „Die Ludothek“ (siehe src/engine/hints.ts): eine
### Nachricht pro Schritt, hint-<kapitel>-<ereignis>, mit .lead (eine Spur,
### ohne den genauen Befehl) und .solution (fast die Antwort). Ortsnamen
### wie in names.ftl.

## Kapitel 1 — Das Lösegeld

hint-ransom-restored =
    .lead = Stopp zuerst den Angriff: Ein Programm läuft noch (ps aux), und die crontab seines Kontos startet es neu. Erst dann das Offline-Backup: Die USB-Platte aus der Schublade (lsblk -f), nur lesend eingehängt, enthält ein restic-Repository. Die Kopie auf dem NAS ist auch verschlüsselt.
    .solution = sudo kill 3141 ; sudo crontab -u empfang -r ; sudo mount -o ro /dev/sdb1 /mnt/stick ; sudo restic -r /mnt/stick/repository restore latest --target / (Passwort: bauer-springer-turm-27)
hint-ransom-end =
    .lead = Die Dateien sind zurück. Schließ jetzt den Zugang (das Konto, dessen Passwort erraten wurde), wirf die .locked-Dateien und die Lösegeldforderungen weg und nimm das Backup wieder vom Netz (verlass /mnt/stick, um es auszuhängen).
    .solution = sudo usermod -L empfang ; sudo find /srv/freigabe -name "*.locked" -delete ; sudo find /srv/freigabe -name LIES-MICH-ZUR-WIEDERHERSTELLUNG.txt -delete ; cd ; sudo umount /mnt/stick

## Kapitel 2 — Die Snapshots

hint-snapshots-error-berenice =
    .lead = Richte /etc/rsnapshot.conf ein: snapshot_root auf der zweiten Platte, die Stufen retain (7 daily, 4 weekly), eine Zeile backup für /srv/freigabe/ — mit TABULATOREN zwischen den Feldern. rsnapshot configtest prüft sie, dann führt cron (das von root) sie aus.
    .solution = In sudo nano /etc/rsnapshot.conf: snapshot_root⇥/mnt/snapshots/, retain⇥daily⇥7 und retain⇥weekly⇥4 (statt der Zeilen alpha, beta und gamma), backup⇥/srv/freigabe/⇥localhost/ (⇥ = Tab); sudo rsnapshot configtest; dann in sudo crontab -e: 30 3 * * * /usr/bin/rsnapshot daily und 0 3 * * 1 /usr/bin/rsnapshot weekly
hint-snapshots-end =
    .lead = Der neueste Snapshot (.0) wurde nach Bérénices Fehler gemacht. Vergleiche das Inventar in älteren Snapshots mit diff und nimm das aus der Nacht davor.
    .solution = sudo cp /mnt/snapshots/daily.1/localhost/srv/freigabe/inventar.csv /srv/freigabe/ (daily.1: die Nacht davor, wenn deine Stufen daily heißen).

## Kapitel 3 — Die Datenbank

hint-database-test-succeeded =
    .lead = Ein echtes Backup einer laufenden Datenbank ist pg_dump, ausgeführt als Konto postgres (sudo -u). Und ein Backup ist nur etwas wert, wenn es sich wiederherstellen lässt: Probier es in einer eigenen Testdatenbank (man createdb, man pg_restore), nie über ludo.
    .solution = sudo -u postgres pg_dump -Fc -f /var/backups/postgresql/ludo.dump ludo ; sudo -u postgres createdb ludo_test ; sudo -u postgres pg_restore -d ludo_test /var/backups/postgresql/ludo.dump
hint-database-loans-returned =
    .lead = Die Tabelle ausleihen in ludo ist leer, der Rest ist unversehrt. pg_restore kann nur eine Tabelle zurückspielen (-t), und nur ihre Daten in eine leere Tabelle.
    .solution = sudo -u postgres pg_restore -d ludo --data-only -t ausleihen /var/backups/postgresql/ludo.dump
hint-database-end =
    .lead = Führ dieses pg_dump jetzt jede Nacht aus, als Rolle der Datenbank: root ist keine. Wessen crontab also?
    .solution = sudo crontab -u postgres -e, und ergänzen: 15 2 * * * pg_dump -Fc -f /var/backups/postgresql/ludo.dump ludo
