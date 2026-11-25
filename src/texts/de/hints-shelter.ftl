### Abgestufte Hinweise für „Das Tierheim“ (siehe src/engine/hints.ts): eine
### Nachricht pro Schritt, hint-<kapitel>-<ereignis>, mit .lead (eine Spur,
### ohne den genauen Befehl) und .solution (fast die Antwort).

## Kapitel 1 — Was haben wir?

hint-what-we-have-paddock =
    .lead = Der Plan liegt auf wiese; was er beschreibt, läuft auf koppel. Lies den Plan, dann geh hin und schau nach (man ssh).
    .solution = cat /srv/drp/plan.md, dann ssh koppel
hint-what-we-have-units =
    .lead = Fang mit dem an, was systemd auf koppel laufen hat: die Dienste, geladen und aktiv (man systemctl, list-units).
    .solution = systemctl list-units --type=service
hint-what-we-have-timers =
    .lead = Was von selbst läuft, nach Zeitplan: die Timer von systemd, und cron (man systemctl, list-timers; man crontab).
    .solution = systemctl list-timers, dann systemctl cat vetlink-sync.service
hint-what-we-have-sockets =
    .lead = Was lauscht, und für wen: die TCP-Sockets in LISTEN, mit ihrem Prozess (man ss).
    .solution = sudo ss -tlnp
hint-what-we-have-script =
    .lead = Der Plan sagt, ein nächtlicher Job macht die Backups: Der Timer nennt den Dienst, der Dienst nennt das Skript. Was sichert es?
    .solution = systemctl cat shelter-backup.service, dann cat /usr/local/sbin/shelter-backup
hint-what-we-have-snapshots =
    .lead = Was das Repository wirklich enthält: seine Snapshots, ihre Pfade, ihre Daten. Der Job kennt das Repository und seine Passwortdatei (man restic).
    .solution = auf koppel: sudo restic -r sftp:restic@wiese.internal:/srv/restic -p /root/.restic-pass snapshots
hint-what-we-have-rows =
    .lead = Schreib die Tabelle des Plans neu: eine Zeile pro Dienst, der wirklich läuft, ein RPO, das der nächtliche Job einhalten kann, ein RTO, sein Backup, eine verantwortliche Person, die noch da ist.
    .solution = nano /srv/drp/plan.md: phpList entfernen, RPO 24h für die App, | Tierarztakten (vetlink) | 24h | 2 Tage | restic, jede Nacht | Mirela | hinzufügen, Verantwortliche Teuila, du, Mirela.
hint-what-we-have-fixed =
    .lead = Die Akten von vetlink müssen ins nächtliche Backup: Seine Zeile restic backup listet die Pfade, die es mitnimmt.
    .solution = auf koppel: sudo nano /usr/local/sbin/shelter-backup, /srv/vetlink zur Zeile restic backup hinzufügen.
hint-what-we-have-saved =
    .lead = Der Job läuft erst um 2:00. Bis dahin hat vetlink noch keine Kopie: Ein Backup jetzt schließt die Lücke.
    .solution = auf koppel: sudo /usr/local/sbin/shelter-backup (oder sudo systemctl start shelter-backup.service)
hint-what-we-have-end =
    .lead = Jeder Dienst der Tabelle braucht einen Snapshot, der jünger ist als sein RPO, und die Tabelle darf nur enthalten, was läuft.
    .solution = Prüfe restic snapshots: Der neueste enthält /srv/vetlink, und kein RPO in der Tabelle ist kürzer als 24h.

## Kapitel 2 — Neuaufbau auf dem Ersatz

hint-rebuild-haven =
    .lead = Teuilas Nachricht, der Umschlag und die Reihenfolge der Wiederherstellung im Plan liegen auf wiese; die neue Maschine heißt zuflucht.
    .solution = cat /srv/drp/plan.md, cat umschlag.txt, dann ssh zuflucht
hint-rebuild-packages =
    .lead = Der erste Schritt des Plans auf einer leeren Maschine: die Pakete, die ihre Dienste brauchen, aus Debian (man apt).
    .solution = sudo apt update, dann sudo apt install nginx postgresql
hint-rebuild-snapshots =
    .lead = Die Adresse des Repositorys und das Wiederherstellungspasswort stehen im Umschlag; restic fragt nach dem Passwort, wenn keines angegeben ist (man restic).
    .solution = sudo restic -r sftp:restic@wiese.internal:/srv/restic snapshots, dann das Passwort aus dem Umschlag.
hint-rebuild-restored =
    .lead = Stell den neuesten Snapshot neben dem neuen System wieder her, nie darüber: --target nennt ein leeres Verzeichnis, restic legt die vollen Pfade darunter neu an.
    .solution = sudo restic -r sftp:restic@wiese.internal:/srv/restic restore latest --target /srv/restore
hint-rebuild-copied =
    .lead = Kopiere aus dem Wiederhergestellten nur zurück, was den Tierheimen selbst gehört: die Website, die App, die Akten von vetlink (man cp).
    .solution = sudo cp -r /srv/restore/var/www/shelter /var/www/, sudo cp -r /srv/restore/srv/adopt /srv/restore/srv/vetlink /srv/
hint-rebuild-database =
    .lead = Die Datenbank kommt aus dem Dump in /srv/restore/var/backups zurück: zuerst eine leere Datenbank, dann den Dump hineinlesen, als postgres (man createdb, man psql).
    .solution = sudo -u postgres createdb shelter, dann sudo -u postgres psql shelter -f /srv/restore/var/backups/shelter.sql
hint-rebuild-verified =
    .lead = Der Job hat die SHA-256 des Dumps und die Zeilen jeder Tabelle aufgezeichnet, neben dem Dump: Vergleiche (man sha256sum, man psql).
    .solution = cd /srv/restore/var/backups && sha256sum -c shelter.sha256 (und sudo -u postgres psql shelter -c "SELECT count(*) FROM animals" gegen shelter.counts)
hint-rebuild-adopt =
    .lead = Die Unit der App liegt im wiederhergestellten /etc/systemd/system: Leg sie an ihren Platz, lass systemd sie lesen, starte sie, sobald ihre Datenbank da ist (man systemctl).
    .solution = sudo cp /srv/restore/etc/systemd/system/adopt.service /etc/systemd/system/, sudo systemctl daemon-reload, sudo systemctl enable --now adopt
hint-rebuild-nginx =
    .lead = nginx braucht die Site-Datei der Tierheime, aktiviert, seine Konfiguration geprüft, dann neu geladen (man nginx).
    .solution = sudo cp /srv/restore/etc/nginx/sites-available/shelter /etc/nginx/sites-available/, sudo ln -s /etc/nginx/sites-available/shelter /etc/nginx/sites-enabled/, sudo nginx -t, sudo systemctl reload nginx
hint-rebuild-vetlink =
    .lead = Mirelas Tierarztakten sind auch im Snapshot, unter /srv/vetlink.
    .solution = sudo cp -r /srv/restore/srv/vetlink /srv/
hint-rebuild-tested =
    .lead = Teste auf zuflucht selbst, indem du die Website nach ihrem Namen fragst und die App hinter /adopt/ (man curl, -H).
    .solution = curl -H "Host: www.hillsideshelters.example" http://localhost/adopt/animals
hint-rebuild-end =
    .lead = Die Reihenfolge der Wiederherstellung im Plan, bis zum Ende: die Website, die App auf ihrer geprüften Datenbank, die Akten von vetlink, ein lokaler Test.
    .solution = Prüf auf zuflucht mit curl -H "Host: www.hillsideshelters.example" http://localhost/ und /adopt/animals.

## Kapitel 3 — Umschalten und lernen

hint-switch-and-learn-outside-closed =
    .lead = Bevor du den Namen umziehst, prüf von hier aus, dass die öffentliche Adresse von Riverbend mit der Website antwortet (man curl).
    .solution = curl -H "Host: www.hillsideshelters.example" http://203.0.113.163/
hint-switch-and-learn-opened =
    .lead = Die Firewall von zuflucht lässt nur ssh herein: Das Web muss auch durch (man ufw).
    .solution = auf zuflucht: sudo ufw allow 80/tcp (oder sudo ufw allow "Nginx HTTP"), dann sudo ufw status
hint-switch-and-learn-outside =
    .lead = Jetzt, wo zuflucht das Web hereinlässt, prüf noch einmal von wiese aus, über die öffentliche Adresse.
    .solution = curl -H "Host: www.hillsideshelters.example" http://203.0.113.163/adopt/animals
hint-switch-and-learn-zone =
    .lead = Die Zone liegt auf wiese, in /etc/bind: Die Adresse von www ändert sich, und die Seriennummer auch, bevor named sie neu lädt (man named-checkzone, man rndc).
    .solution = sudo nano /etc/bind/db.hillsideshelters.example: www → 203.0.113.163, Seriennummer 2031111401; sudo named-checkzone hillsideshelters.example /etc/bind/db.hillsideshelters.example; sudo rndc reload
hint-switch-and-learn-switched =
    .lead = Frag den Server des Registrars, den die Welt fragt: Liefert er die neue Adresse aus (man dig)?
    .solution = dig @ns1.registrar.example www.hillsideshelters.example
hint-switch-and-learn-resolver =
    .lead = Der öffentliche Resolver behält, was ihm gesagt wurde, für die Dauer der TTL: Frag ihn, und ein paar Minuten später noch einmal.
    .solution = dig www.hillsideshelters.example (die TTL der ANSWER zählt herunter)
hint-switch-and-learn-review =
    .lead = Füll jeden Abschnitt von rueckblick.md aus: Die Uhrzeiten der Zeitleiste kommen aus den Logs (sitewatch.log, die Snapshots, das Journal von named); jede Maßnahme hat eine verantwortliche Person; niemand, dem man die Schuld gibt.
    .solution = nano rueckblick.md: Zeitleiste mit 02:00 (letztes Backup), 02:50 (erste gescheiterte Prüfung), der Uhrzeit des Umschaltens; Maßnahmen wie „- Den Server aus dem Keller holen (Wiremu)“.
hint-switch-and-learn-drill =
    .lead = Mirelas Skript listet nur die Snapshots. Eine Übung stellt daneben wieder her, prüft, was zurückgekommen ist, und läuft von selbst (man restic, man sha256sum, man crontab).
    .solution = sudo nano /usr/local/sbin/restore-drill: restic restore latest --target /tmp/drill --include /var/backups, dann cd /tmp/drill/var/backups && sha256sum -c shelter.sha256; sudo crontab -e: 0 4 1 * * /usr/local/sbin/restore-drill
hint-switch-and-learn-end =
    .lead = Alles auf einmal: www von zuflucht aus für die Welt ausgeliefert, von außen geprüft, die Nachbetrachtung geschrieben, die Übung geplant.
    .solution = dig @ns1.registrar.example www.hillsideshelters.example, curl von wiese aus, rueckblick.md vollständig, die Übung in der crontab von root.
