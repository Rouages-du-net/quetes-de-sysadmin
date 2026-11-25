### Die gestuften Hinweise von „Das Audit“ (siehe src/engine/hints.ts):
### eine Nachricht pro Schritt, mit .lead (eine Richtung, ohne den genauen
### Befehl) und .solution (fast die Antwort: der Befehl, mit dem, was er
### tut). Die Ortsnamen sind die von names.ftl.

## Kapitel 2 — Der Bericht

hint-report-ssh =
    .lead = Befund C1: eine Option in /etc/ssh/sshd_config (man sshd_config). Nach der Änderung muss sshd seine Konfiguration neu lesen: zuerst prüfen (man sshd), dann den Dienst neu laden lassen.
    .solution = sudo nano /etc/ssh/sshd_config: PermitRootLogin no. Dann sudo sshd -t, sudo systemctl reload ssh (und sudo sshd -T | grep permitroot, um zu sehen, was angewendet ist).
hint-report-account =
    .lead = Befund C2: Lucas' Konto darf zu nichts mehr taugen. Am saubersten ist es, es zu löschen (man userdel); sonst sperren, ablaufen lassen UND aus der Gruppe sudo nehmen (man usermod, man chage, man gpasswd).
    .solution = sudo userdel lucas (mit -r, um das Home-Verzeichnis zu löschen). Oder: sudo usermod -L -e 1 lucas, dann sudo gpasswd -d lucas sudo.
hint-report-sudo =
    .lead = Befund C3: sudo -l zeigt die Regeln deines Kontos. Eine kommt aus einer Datei in /etc/sudoers.d, geschrieben von cloud-init. Eine sudoers-Datei bearbeitet man mit visudo (man visudo, man sudoers).
    .solution = sudo grep -r NOPASSWD /etc/sudoers.d findet die Datei; sudo visudo -f /etc/sudoers.d/90-cloud-init-users, das NOPASSWD: entfernen (oder die Datei mit sudo rm löschen: Die Gruppe sudo behält ihr Recht, mit Passwort).
hint-report-secret =
    .lead = Befund C4: ls -l zeigt, wer /srv/bestellungen/.env lesen kann (man chmod). Schließ sie für die anderen Konten, aber nicht für ihren Besitzer: Die App ist es, die sie liest.
    .solution = sudo chmod 600 /srv/bestellungen/.env (oder 640, wenn die Gruppe bestellungen sie lesen muss), dann ls -l, um zu prüfen, dass der Besitzer noch bestellungen ist.

## Kapitel 3 — Die Exposition

hint-exposure-listening =
    .lead = Bevor du Türen schließt, schau, welche Programme auf welchen Ports lauschen, auf dem Server selbst (man ss). Salomés Scan liegt in auditscan.txt.
    .solution = sudo ss -tlnp (die lauschenden TCP-Sockets, numerisch, mit dem Programm). 0.0.0.0: alle Schnittstellen; 127.0.0.1: nur diese Maschine.
hint-exposure-firewall =
    .lead = ufw lehnt eingehend standardmäßig ab, sobald es aktiv ist; du musst nur erlauben, was offen bleiben muss (SSH, http, https), BEVOR du es einschaltest (man ufw).
    .solution = sudo ufw allow OpenSSH, sudo ufw allow "Nginx Full", dann sudo ufw enable (sudo ufw status verbose zum Prüfen).
hint-exposure-redis-local =
    .lead = Die Firewall ist eine Schicht; Redis selbst muss auch nur der Maschine zuhören: eine Direktive in /etc/redis/redis.conf. Ein Programm liest seine Konfiguration neu, wenn es neu startet.
    .solution = sudo nano /etc/redis/redis.conf: bind 127.0.0.1 -::1 (statt bind * -::*). Dann sudo systemctl restart redis-server, und sudo ss -tlnp zum Prüfen.
hint-exposure-end =
    .lead = Die Firewall filtert und Redis ist lokal; beweis, dass SSH noch durchkommt, mit einer neuen Verbindung von deinem Rechner aus.
    .solution = exit, dann ssh baeckerei.

## Kapitel 4 — Die Spuren

hint-traces-found =
    .lead = Das Journal des Dienstes ssh bewahrt erfolgreiche Anmeldungen auf, mit der Adresse und dem Fingerabdruck des Schlüssels; last fasst zusammen, wer sich wann und von wo angemeldet hat (man journalctl, man last).
    .solution = journalctl -u ssh | grep Accepted (oder sudo grep, oder last nadia): die Zeile um 3:12 Uhr, von 203.0.113.99.
hint-traces-key-identified =
    .lead = ssh-keygen kann den Fingerabdruck jedes Schlüssels in einer Datei zeigen (man ssh-keygen, Option -l). Nadias Datei ist nur für sie lesbar: Du brauchst sudo.
    .solution = sudo ssh-keygen -l -f /home/nadia/.ssh/authorized_keys, dann mit dem SHA256-Fingerabdruck im Journal vergleichen.
hint-traces-key-revoked =
    .lead = Entferne aus authorized_keys die Zeile, deren Fingerabdruck der der nächtlichen Anmeldung ist, und nur diese: Nadias muss bleiben.
    .solution = sudo nano /home/nadia/.ssh/authorized_keys: die Zeile „… nadia@laptop“ (die zweite) löschen, speichern.
hint-traces-cron-found =
    .lead = Was für ein Konto von selbst läuft: seine crontab (man crontab). Um die eines anderen Kontos zu lesen, musst du root sein.
    .solution = sudo crontab -u nadia -l
hint-traces-cron-cleaned =
    .lead = Entferne die Zeile des Eindringlings aus Nadias crontab, ohne ihr Backup zu löschen: crontab -r löscht alles, crontab -e lässt dich wählen.
    .solution = sudo crontab -u nadia -e: die Zeile mit curl … | sh löschen, die mit sicherung.sh behalten.
hint-traces-secret-seen =
    .lead = Nadias Befehlsverlauf (.bash_history, nur für sie lesbar) sagt, was während der nächtlichen Sitzung getippt wurde. Um ihn an ihrer Stelle zu lesen, brauchst du sudo.
    .solution = sudo cat /home/nadia/.bash_history: Die Person hat /srv/bestellungen/.env gelesen, also ist das Passwort der Datenbank kompromittiert.
hint-traces-password =
    .lead = Ein Datenbankpasswort ändert man auf beiden Seiten: in PostgreSQL (psql, ALTER ROLE, vom Konto postgres aus: man psql) UND in DATABASE_URL der Datei .env; die App liest .env erst beim Neustart neu. Mindestens zwölf Zeichen.
    .solution = sudo -u postgres psql -c "ALTER ROLE bestellungen PASSWORD 'eine-lange-passphrase'", dann sudo nano /srv/bestellungen/.env (dasselbe Passwort in DATABASE_URL), dann sudo systemctl restart bestellungen und systemctl status bestellungen.

## Kapitel 1 — Der Rahmen

hint-scope-letter =
    .lead = Bevor du irgendetwas scannst: Das Auftragsschreiben liegt in deinem Verzeichnis. Es sagt, was du prüfen darfst, und was du nicht anfassen darfst.
    .solution = cat auftragsschreiben.txt: Der Rahmen ist EINE Maschine, baeckerei.internal (192.0.2.22). Der Nachbar (192.0.2.24) gehört nicht dazu.
hint-scope-scan =
    .lead = nmap scannt die Ports einer Maschine (man nmap): Gib ihm die genaue Adresse oder den Namen der Maschine im Rahmen, und frag auch nach den Versionen der Dienste.
    .solution = nmap -sV baeckerei.internal (nicht 192.0.2.0/24: Das würde auch den Nachbarn prüfen).
hint-scope-trace =
    .lead = Einen Beweis bewahrt man auf: nmap kann sein Ergebnis, so wie du es liest, in eine Datei schreiben (man nmap, die Option -oN).
    .solution = nmap -sV -oN inventar.txt baeckerei.internal
hint-scope-end =
    .lead = Vervollständige auditnotizen.md mit nano: was du gefunden hast (die Ports der Datenbank und von Redis haben im Internet nichts zu suchen) und was du bemerkt hast, ohne es anzufassen (den Server des Nachbarn).
    .solution = nano auditnotizen.md: unter „Was ich gefunden habe“ 5432 (PostgreSQL) und 6379 (Redis) nennen; unter „Außerhalb des Rahmens“ nachbar.internal (192.0.2.24) nennen, außerhalb des Rahmens, nicht geprüft.

## Kapitel 5 — Die Nachprüfung

hint-follow-up-scan =
    .lead = Wiederhole die Bestandsaufnahme wie am ersten Tag, mit Versionen, auf dem Server und nur auf ihm (man nmap).
    .solution = nmap -sV baeckerei.internal
hint-follow-up-lynis =
    .lead = Lynis prüft die Maschine, auf der es läuft; es braucht root, um alles zu lesen (man lynis). Es behebt nichts.
    .solution = sudo lynis audit system
hint-follow-up-update =
    .lead = Die Warnung von Lynis (PKGS-7392) betrifft verwundbare Pakete: apt weiß, was wartet (man apt).
    .solution = sudo apt update, sudo apt upgrade (apt list --upgradable zeigt, was wartet).
hint-follow-up-hardened =
    .lead = Unter den Vorschlägen die, die die Mühe wert sind: SSH (sshd_config, man sshd_config), die UMASK in /etc/login.defs, das Banner /etc/issue. Du brauchst einen Index von mindestens 70, ohne Warnung, und die angewendete SSH-Konfiguration.
    .solution = sudo grep suggestion /var/log/lynis-report.dat. Zum Beispiel: X11Forwarding no und MaxAuthTries 3 in /etc/ssh/sshd_config (dann sudo sshd -t, sudo systemctl reload ssh), UMASK 027 in /etc/login.defs, ein rechtlicher Hinweis in /etc/issue.
hint-follow-up-proof-lynis =
    .lead = Eine Korrektur, die nicht bewiesen ist, ist nur eine Absicht: Lass Lynis noch einmal laufen, damit es den aktuellen Zustand wiedergibt.
    .solution = sudo lynis audit system
hint-follow-up-nmap-own =
    .lead = Wiederhole den Scan mit Versionen, jetzt, wo die Updates eingespielt sind: Die angezeigte SSH-Version hat sich geändert.
    .solution = nmap -sV baeckerei.internal
hint-follow-up-end =
    .lead = Vervollständige abschlussbericht.md mit nano: eine Zusammenfassung, die behobenen Befunde (Teile 1 bis 4), die Beweise (der genaue Index deines letzten Lynis-Laufs und die gesehenen Ports), und was bleibt, mit einer noch offenen Kennung von Lynis.
    .solution = nano abschlussbericht.md: unter „Beweise“ der Index des letzten Audits und die Ports 22, 80, 443; unter „Noch zu tun“ zum Beispiel FINT-4350 (Dateiintegrität) oder LOGG-2154 (entfernte Logs).
