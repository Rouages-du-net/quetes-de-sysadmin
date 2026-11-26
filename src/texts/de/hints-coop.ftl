### Abgestufte Hinweise für „Die Genossenschaft“ (siehe src/engine/hints.ts):
### eine Nachricht pro Schritt, hint-<kapitel>-<ereignis>, mit .lead (eine
### Spur, ohne den genauen Befehl) und .solution (fast die Antwort).
### Ortsnamen wie in names.ftl.

## Kapitel 1 — Der Abschied

hint-departure-backup =
    .lead = Bevor du etwas schließt: Was lässt Marc unter seinem Konto laufen? Seine crontab (als root) startet ein Skript, das in seinem Home-Verzeichnis liegt. Der Auftrag muss seinen Abschied überleben: das Skript außerhalb von /home, und ein Konto, das bleibt, um es auszuführen.
    .solution = sudo cp /home/marc/bin/kasse-sicherung.sh /usr/local/bin/, dann sudo crontab -e und die Zeile: 30 2 * * * /usr/local/bin/kasse-sicherung.sh (die crontab von root)
hint-departure-closed =
    .lead = Zugänge schließen heißt, sie überall zu schließen: sein Konto (usermod -L sperrt nur das Passwort, nicht den SSH-Schlüssel: lies man usermod noch einmal), die Gruppe sudo, sein Schlüssel im Konto deploy (nur seine Zeile), und seine noch offene Sitzung (who, ps -u marc).
    .solution = sudo usermod -e 1 marc (das Konto läuft ab), sudo gpasswd -d marc sudo, sudo nano /home/deploy/.ssh/authorized_keys (nur die Zeile marc@laptop löschen), dann sudo pkill -u marc
hint-departure-end =
    .lead = Ein Teil fehlt: Geh Awas E-Mail Punkt für Punkt durch. Marc darf auf keinem Weg hineinkommen, die CI und Lina behalten ihre Schlüssel in deploy, und das nächtliche Backup läuft als root oder deploy.
    .solution = sudo crontab -l (ist das Backup da?), sudo cat /home/deploy/.ssh/authorized_keys (deploy@ci und lina@werkstatt da, marc@laptop weg), sudo chage -l marc, groups marc, who

## Kapitel 2 — Gemeinsame Rechte

hint-shared-rights-directory =
    .lead = ls -l /srv/till/abrechnungen: Das Verzeichnis gehört root, und jede Abrechnung der Gruppe ihrer Autorin oder ihres Autors. Du brauchst ein Verzeichnis der Gruppe till, für die Gruppe beschreibbar, dessen setgid-Bit seine Gruppe an alles weitergibt, was darin angelegt wird (man chmod).
    .solution = sudo chgrp -R till /srv/till/abrechnungen, sudo chmod -R g+w /srv/till/abrechnungen, dann sudo chmod g+s /srv/till/abrechnungen (ls -ld zeigt drwxrwsr-x)
hint-shared-rights-mask =
    .lead = Die nächsten Dateien von Lina und Karim werden rw-r--r-- geboren: Das ist ihre Maske (umask 022). Sie wird bei der Anmeldung gesetzt, in ihrer ~/.profile oder für alle in /etc/profile.d (man umask).
    .solution = sudo nano /home/lina/.profile und sudo nano /home/karim/.profile: #umask 022 durch umask 002 ersetzen (oder eine Datei /etc/profile.d/umask-team.sh mit umask 002)
hint-shared-rights-sudo =
    .lead = Eine sudo-Regel für die Gruppe till, in einer eigenen Datei in /etc/sudoers.d (ohne Punkt im Namen), geschrieben mit visudo, das vor dem Speichern prüft. Der Befehl wird mit seinem vollständigen Pfad (which) und seinen Argumenten geschrieben, damit nichts anderes erlaubt ist (man sudoers).
    .solution = sudo visudo -f /etc/sudoers.d/till, mit der Zeile %till ALL=(root) /usr/bin/systemctl restart till — dann sudo -l -U lina zum Prüfen
hint-shared-rights-end =
    .lead = Verzeichnis, Maske und sudo eingerichtet? Schau dir an, was schon im Verzeichnis lag: Die Abrechnungen von gestern müssen auch der Gruppe till gehören und für sie beschreibbar sein.
    .solution = ls -l /srv/till/abrechnungen, dann sudo chgrp -R till /srv/till/abrechnungen und sudo chmod -R g+w /srv/till/abrechnungen

## Kapitel 3 — Das Geheimnis

hint-secret-closed =
    .lead = Frag die Website selbst mit curl nach /.env: nginx liefert das ganze Verzeichnis der App aus, versteckte Dateien eingeschlossen (.env, aber auch .git). In der Konfiguration der Website kann eine location mit einem regulären Ausdruck jeden Pfad verweigern, der „/.“ enthält (die Dokumentation von location und deny).
    .solution = sudo nano /etc/nginx/sites-available/coop: location ~ /\. {"{"} deny all; {"}"} im server-Block ergänzen, dann sudo nginx -t und sudo systemctl reload nginx
hint-secret-attacker =
    .lead = Wer hat den Schlüssel genommen? Das Zugriffslog von nginx (/var/log/nginx/access.log) hält jede Anfrage nach /.env fest, mit der Adresse und der Antwort 200. Eine Direktive von nginx verweigert eine Adresse.
    .solution = sudo grep '\.env' /var/log/nginx/access.log (es ist 203.0.113.77), dann deny 203.0.113.77; im server-Block der Website, und sudo systemctl reload nginx
hint-secret-key-written =
    .lead = Der alte Schlüssel ist deaktiviert: Der neue steht in Awas E-Mail, und er gehört in die Datei .env der Kassen-App (/srv/till/app).
    .solution = sudo nano /srv/till/app/.env: den Wert von ZAHLUNG_SCHLUESSEL= durch den neuen Schlüssel aus der E-Mail ersetzen
hint-secret-end =
    .lead = Der neue Schlüssel ist eingetragen, aber die App liest ihre .env nur beim Start. Ihre Route /health sagt dir, welchen Schlüssel sie benutzt.
    .solution = sudo systemctl restart till, dann curl http://127.0.0.1:3000/health ("zahlung": "ok")

## Kapitel 4 — Der Proxy

hint-proxy-end =
    .lead = Vergleiche die beiden Logs: nginx sieht den Roboter (198.51.100.66), die Kasse sieht nur 127.0.0.1. nginx muss die Adresse des Clients in einem Header weiterreichen (proxy_set_header), und die App darf diesem Header nur glauben, wenn er von nginx kommt (TRUST_PROXY, Express-Leitfaden „behind proxies“): nicht true, der Roboter schreibt seinen eigenen X-Forwarded-For.
    .solution = In der location /till/ von /etc/nginx/sites-available/coop: proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for; — in /srv/till/app/.env: TRUST_PROXY=loopback — dann sudo systemctl reload nginx und sudo systemctl restart till

## Kapitel 5 — Die Updates

hint-updates-a-day =
    .lead = apt kennt neue Versionen erst, wenn es die Repositorys neu gelesen hat (man apt: zuerst update, dann upgrade). Das WLAN wird abbrechen: Eine lange Operation gehört in eine Sitzung, die die Verbindung überlebt (man tmux). Wurde dpkg unterbrochen, sagt dir apt, was auszuführen ist.
    .solution = sudo apt update, dann tmux new -s upgrade und sudo apt upgrade; wenn die Verbindung abbricht: ssh genossenschaft und tmux attach -t upgrade (ohne tmux: sudo dpkg --configure -a, dann sudo apt upgrade)
hint-updates-till-down =
    .lead = Die Pakete sind installiert, aber uname -r liefert noch den alten Kernel. Eine Datei in /var/run sagt, warum du neu starten musst.
    .solution = cat /var/run/reboot-required.pkgs, dann sudo reboot (und ssh genossenschaft, um zurückzukommen)
hint-updates-end =
    .lead = Nach einem Neustart kommen nur aktivierte Dienste zurück. Prüf die Website und die Kasse (systemctl --failed, systemctl status till: „disabled“).
    .solution = sudo systemctl enable --now till (beim Start aktiviert, und sofort gestartet)

## Kapitel 6 — Automatische Updates

hint-auto-updates-end =
    .lead = Alles steht in /etc/apt/apt.conf.d: 20auto-upgrades schaltet die täglichen Aufträge an oder aus (bei „0“ passiert nichts), 50unattended-upgrades legt den Bericht fest (Mail), den Neustart und seine Uhrzeit (Automatic-Reboot-Time, nachts). Lass Origins-Pattern, wie es ist: nodejs kommt aus einem anderen Repository. Dann starte den Dienst, der jeden Morgen die Arbeit macht (systemctl list-timers).
    .solution = In 20auto-upgrades: beide Werte auf "1"; in 50unattended-upgrades Unattended-Upgrade::Mail "root";, Automatic-Reboot "true"; und Automatic-Reboot-Time "02:00"; einkommentieren — dann sudo systemctl start apt-daily-upgrade
