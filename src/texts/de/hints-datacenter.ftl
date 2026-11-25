### Abgestufte Hinweise für „Das Rechenzentrum“ (siehe src/engine/hints.ts):
### eine Nachricht pro Schritt, hint-<kapitel>-<ereignis>, mit .lead (eine
### Spur, ohne den genauen Befehl) und .solution (fast die Antwort).
### Dateinamen wie in names.ftl.

## Kapitel 1 — Erster Tag

hint-first-day-account =
    .lead = Das Log ist /var/log/nginx/access.log. Behalte die Zeilen mit einem 503-Fehler und zähl sie dann: zwei Werkzeuge aus Awas Notizen, verbunden durch eine Pipe.
    .solution = grep " 503 " /var/log/nginx/access.log | wc -l (grep behält die 503-Zeilen, wc -l zählt sie).
hint-first-day-robot =
    .lead = Die IP-Adresse ist das erste Feld jeder Zeile. Behalte nur sie, sortiere, zähl gleiche Zeilen und sortiere dann nach Zahl: Awas Notizen liefern die Kette.
    .solution = cut -d " " -f 1 /var/log/nginx/access.log | sort | uniq -c | sort -n | tail -3 (die letzte Zeile ist die gesprächigste Adresse).
hint-first-day-override =
    .lead = Die Website ist langsam: Irgendein Prozess frisst den Prozessor. Ein Befehl listet alle Prozesse der Maschine auf, mit ihrer %CPU.
    .solution = ps aux (schau auf die Spalte %CPU: php-fpm: pool catalogue steht bei 99 %).
hint-first-day-rule =
    .lead = Sperr den Roboter in /etc/nginx/blocked.conf, im Format deny ADRESSE; ohne die vorhandenen Regeln zu löschen. Die Datei gehört root, und eine Umleitung >> macht deine Shell, nicht sudo: tee kann für dich schreiben.
    .solution = echo "deny 198.51.100.77;" | sudo tee -a /etc/nginx/blocked.conf (-a hängt an, statt zu überschreiben).
hint-first-day-blocked =
    .lead = nginx liest seine Datei nicht von selbst neu: Du musst es darum bitten, über den Dienstverwalter.
    .solution = sudo systemctl reload nginx
hint-first-day-repaired =
    .lead = Der überlastete Prozess läuft noch (ps aux). Stopp ihn: Er gehört www-data, du brauchst also sudo. systemd startet ihn sauber neu.
    .solution = ps aux, um seine Nummer zu finden, dann sudo kill PID (zuerst 4242, oder die des neu gestarteten Prozesses bei 99 %).
hint-first-day-report =
    .lead = Der Bericht kommt in ~/bericht.txt: die Zahl der 503-Fehler und die Adresse des Roboters. > legt die Datei an, >> hängt eine Zeile an.
    .solution = grep " 503 " /var/log/nginx/access.log | wc -l > ~/bericht.txt, dann echo "Verursacher: 198.51.100.77" >> ~/bericht.txt

## Kapitel 2 — Zweiter Tag

hint-second-day-malo-reads =
    .lead = ls -l /var/log/nginx zeigt, welcher Gruppe die Logs gehören und was diese Gruppe darf. Nimm Malo in diese Gruppe auf, ohne ihn aus seiner eigenen zu entfernen (man usermod: Vorsicht bei -G ohne -a). Gib nicht allen Leserechte.
    .solution = sudo usermod -aG adm malo (-a fügt die Gruppe hinzu, ohne seine anderen Gruppen zu ersetzen; prüfe mit groups malo).
hint-second-day-share =
    .lead = /srv/team gehört root. Gib es der Gruppe web-team, dann Rechte für die Gruppe und keine für die anderen (man chgrp, man chmod). Kein 777!
    .solution = sudo chgrp web-team /srv/team, dann sudo chmod 770 /srv/team (die Gruppe liest, schreibt, geht hinein; die anderen nichts).
hint-second-day-end =
    .lead = Prüfe beide Aufgaben: Malo liest die Logs (ohne dass sie für alle offen sind) und bleibt in web-team; das gemeinsame Verzeichnis ist für die anderen Konten geschlossen.
    .solution = groups malo muss adm und web-team zeigen (sonst: sudo usermod -aG web-team malo); die Logs mit 640 (sudo chmod 640 /var/log/nginx/access.log /var/log/nginx/error.log); /srv/team mit 770.

## Kapitel 3 — Die Nacht des Neustarts

hint-reboot-night-nginx =
    .lead = Welche Dienste sind fehlgeschlagen oder gestoppt? systemctl kann sie auflisten und den Zustand jedes einzelnen angeben. Schau dir auch die Zeile Loaded von nginx an: Es zu starten reicht nicht, es muss mit der Maschine zurückkommen (man systemctl).
    .solution = sudo systemctl enable --now nginx (enable: startet mit der Maschine; --now: startet sofort).
hint-reboot-night-catalogue =
    .lead = Der Katalog will nicht starten: Sein Log sagt, warum (journalctl -u). Sein Log-Verzeichnis gehört root, während php-fpm als www-data läuft. Ändere den Besitzer, öffne es nicht für alle.
    .solution = sudo chown www-data: /var/log/catalogue, dann sudo systemctl restart catalogue
hint-reboot-night-end =
    .lead = Der echte Test ist der nächste Start: Starte die Maschine selbst neu und prüfe dann, ob alles ohne dich zurückgekommen ist.
    .solution = sudo reboot, dann nach dem erneuten Verbinden: systemctl --failed (oder systemctl status nginx catalogue).

## Kapitel 4 — Der große Brand

hint-fire-nginx =
    .lead = Die Maschine ist neu: Vor dem Installieren muss apt die Liste der verfügbaren Pakete herunterladen (man apt). Das Paket heißt nginx.
    .solution = sudo apt update, dann sudo apt install nginx (curl http://localhost zeigt die Willkommensseite).
hint-fire-end =
    .lead = Folge dem NFP (/mnt/sicherung/NFP.txt): Prüfe jedes Archiv, indem du es auflistest (tar -t), bevor du es entpackst, nimm das neueste, das sich bis zum Ende lesen lässt, entpacke es ab der Wurzel (man tar, -C). Dann nginx -t: Zwei Websites können nicht beide default_server auf demselben Port sein.
    .solution = sudo tar -xzf /mnt/sicherung/medialibrary-2026-10-22.tar.gz -C /, dann sudo rm /etc/nginx/sites-enabled/default, sudo nginx -t, sudo systemctl reload nginx und curl http://medialibrary.example

## Kapitel 5 — Das Zertifikat ist abgelaufen

hint-certificate-expires =
    .lead = Bestätige zuerst die Störung: Fordere die Website über HTTPS an, oder frag certbot nach dem Zustand seiner Zertifikate.
    .solution = curl https://medialibrary.example (oder sudo certbot certificates: INVALID: EXPIRED).
hint-certificate-challenge =
    .lead = Warum ist die automatische Erneuerung gescheitert? Spiel sie nach, ohne etwas kaputtzumachen: man certbot erwähnt eine Generalprobe.
    .solution = sudo certbot renew --dry-run (und journalctl -u certbot für das Log der letzten Nächte).
hint-certificate-end =
    .lead = certbot legt die Challenge in das Verzeichnis aus /etc/letsencrypt/renewal/medialibrary.example.conf, aber nginx liefert die Website aus /var/www/medialibrary aus. Korrigiere das Verzeichnis, erneuere wirklich, lade nginx neu und lass es nach jeder Erneuerung automatisch neu laden (such nach „hook“ in man certbot).
    .solution = sudo certbot renew --webroot -w /var/www/medialibrary, dann sudo certbot reconfigure --cert-name medialibrary.example --deploy-hook "systemctl reload nginx", dann sudo systemctl reload nginx
