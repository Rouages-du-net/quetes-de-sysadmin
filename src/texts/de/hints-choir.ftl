### Graded hints for The Choir (see src/engine/hints.ts): one message per
### step, hint-<chapter>-<event>, with .lead (a direction, without the exact
### command) and .solution (almost the answer).


## Chapter 1 — Kept Forever

hint-kept-forever-policy =
    .lead = Was hat der Vorstand versprochen? Lies die Aufbewahrungsrichtlinie, von der Amara spricht.
    .solution = cat /srv/choir/docs/aufbewahrungsrichtlinie.txt
hint-kept-forever-forever =
    .lead = Vergleiche mit dem, was der Server aufbewahrt: liste die Logs des Webservers auf und lies, wie logrotate sie rotiert.
    .solution = ls /var/log/nginx | tail; ls /var/log/nginx | wc -l; cat /etc/logrotate.d/nginx
hint-kept-forever-rotation =
    .lead = Lass logrotate höchstens dreißig Tage Access-Logs behalten (man logrotate: daily, rotate, maxage).
    .solution = sudo nano /etc/logrotate.d/nginx: daily, rotate 30 (oder weekly mit rotate 3 behalten, oder maxage 30 hinzufügen); sudo logrotate -d /etc/logrotate.d/nginx
hint-kept-forever-purged =
    .lead = logrotate entfernt die hunderte Archive nicht, die seine alte Anzahl zurückgelassen hat: finde sie über ihr Alter, prüfe die Liste, dann lösche sie. Behalte die letzten Wochen.
    .solution = find /var/log/nginx -name 'access.log.*' -mtime +30; dann sudo find /var/log/nginx -name 'access.log.*' -mtime +30 -delete
hint-kept-forever-anonymised =
    .lead = Schreib eine Variable mit der gekürzten Adresse (man nginx: map, mit einem regulären Ausdruck für IPv4 und einem für IPv6, und einem default), ein log_format, das sie benutzt, und gib es access_log. Testen, neu laden.
    .solution = in /etc/nginx/conf.d/anonymise.conf: map $remote_addr $remote_addr_anon { "{" } ~(?P<ip>\d+\.\d+\.\d+)\. $ip.0; ~(?P<ip>[^:]+:[^:]+): $ip::; default 0.0.0.0; { "}" } und log_format anonymised '$remote_addr_anon - $remote_user [$time_local] "$request" $status $body_bytes_sent "$http_referer" "$http_user_agent"'; dann access_log /var/log/nginx/access.log anonymised; in nginx.conf; sudo nginx -t; sudo systemctl reload nginx
hint-kept-forever-journal =
    .lead = Das Journal behält auch Jahre (journalctl --disk-usage, ls /var/log/journal/*). Gib journald ein Höchstalter (man journald.conf), dann starte es neu.
    .solution = sudo nano /etc/systemd/journald.conf: MaxRetentionSec=30day unter [Journal]; sudo systemctl restart systemd-journald
hint-kept-forever-end =
    .lead = Prüf alles gegen die Richtlinie: die Web-Logs (dreißig Tage, gekürzte Adressen), das Audit-Log (zwölf Monate, unangetastet), das Journal (dreißig Tage).
    .solution = sudo tail -n 3 /var/log/nginx/access.log; ls -l /var/log/nginx /var/log/choir; journalctl --disk-usage

## Chapter 2 — The Access Request

hint-access-request-her-row =
    .lead = Fang mit der Datenbank der Mitglieder-App an: welche Tabellen, und ihre Zeile in der Mitgliedertabelle (man psql; die Datenbank ist choir, ihr Admin ist postgres).
    .solution = sudo -u postgres psql choir -c '\dt'; sudo -u postgres psql choir -c "SELECT * FROM members WHERE last_name = 'Raman'"
hint-access-request-tables =
    .lead = Andere Tabellen verweisen auf sie über ihre id (27) oder ihre E-Mail: frag jede ab und schreib die Ergebnisse in das Verzeichnis der Antwort.
    .solution = sudo -u postgres psql choir -c "SELECT * FROM attendance WHERE member_id = 27" > /srv/choir/dsgvo-anfragen/priya-raman/proben.txt (dasselbe für payments; newsletter WHERE email = 'priya.raman@mail.example'; und members WHERE id = 27)
hint-access-request-uploads =
    .lead = Der Mitgliederbereich bewahrt Uploads in einem Verzeichnis pro Mitglieds-id auf.
    .solution = sudo ls /srv/choir/uploads/27; sudo cp /srv/choir/uploads/27/* /srv/choir/dsgvo-anfragen/priya-raman/
hint-access-request-logs =
    .lead = Durchsuche die Logs nach ihrer E-Mail, auch die mit gzip gepackten (man zgrep), und behalte nur ihre Zeilen.
    .solution = grep -rl priya.raman /var/log; grep priya.raman@mail.example /var/log/choir/audit.log; zgrep priya.raman@mail.example /var/log/choir/audit.log.1.gz; grep priya.raman@mail.example /var/log/mail.log (jeweils > eine Datei in der Antwort)
hint-access-request-old-copy =
    .lead = Ist sie sonst noch irgendwo auf der Platte? Durchsuche die Dateien des Chors nach ihrem Namen oder ihrer Telefonnummer.
    .solution = sudo grep -r 'Priya Raman' /srv/choir; sudo grep 'Priya Raman' /srv/choir/exports/phone-tree-2030-10.csv > /srv/choir/dsgvo-anfragen/priya-raman/telefonkette.txt
hint-access-request-end =
    .lead = Prüf die Antwort: alle ihre Daten, und keine von anderen (keine andere E-Mail oder Telefonnummer).
    .solution = ls -l /srv/choir/dsgvo-anfragen/priya-raman; grep -rh '@' /srv/choir/dsgvo-anfragen/priya-raman | grep -v priya.raman

## Chapter 3 — Forget Me

hint-forget-me-found =
    .lead = Finde Tomas in der Datenbank, und jede Tabelle, die auf ihn verweist.
    .solution = sudo -u postgres psql choir -c "SELECT * FROM members WHERE last_name = 'Novak'"; dann attendance und payments WHERE member_id = 41, newsletter WHERE email = 'tomas.novak@mail.example'
hint-forget-me-erased =
    .lead = Lösch ihn aus den Tabellen, die die Löschung erreicht, und lass die Beiträge in Ruhe (die Richtlinie behält Buchhaltungsunterlagen zehn Jahre).
    .solution = sudo -u postgres psql choir -c "DELETE FROM attendance WHERE member_id = 41; DELETE FROM newsletter WHERE email = 'tomas.novak@mail.example'; DELETE FROM members WHERE id = 41"
hint-forget-me-uploads =
    .lead = Sein Foto und seine Einwilligung liegen in den Uploads, unter seiner id.
    .solution = sudo ls /srv/choir/uploads/41; sudo rm /srv/choir/uploads/41/photo.jpg /srv/choir/uploads/41/consent-form.pdf; sudo rmdir /srv/choir/uploads/41
hint-forget-me-purge-broken =
    .lead = Ist Rubens Bereinigung je gelaufen? Schau dir die Timer an (alle), den Dienst und sein Journal.
    .solution = systemctl list-timers --all; systemctl cat choir-purge.service; sudo systemctl start choir-purge.service; sudo journalctl -u choir-purge
hint-forget-me-purge =
    .lead = Repariere das Konto, unter dem sie läuft (eines mit Datenbankrolle), füge die Anwesenheiten zum Skript hinzu, lade systemd neu, starte den Dienst zum Testen und aktiviere den Timer.
    .solution = sudo nano /etc/systemd/system/choir-purge.service (User=postgres); sudo nano /usr/local/sbin/choir-purge (psql choir -c "DELETE FROM attendance WHERE rehearsed_on < current_date - interval '2 years'"); sudo systemctl daemon-reload; sudo systemctl start choir-purge.service; sudo systemctl enable --now choir-purge.timer
hint-forget-me-snapshots =
    .lead = Was enthalten die Backups? Liste die Snapshots des restic-Repositorys auf (sein Ort und sein Passwort stehen im Backup-Skript).
    .solution = sudo cat /usr/local/sbin/choir-backup; sudo restic -r /var/backups/restic --password-file /root/.restic-pass snapshots
hint-forget-me-trimmed =
    .lead = Vergiss die Snapshots, die älter als etwa drei Monate sind, und lösch ihre Daten (man restic: forget, --keep-weekly, --keep-within, --prune). Versuch zuerst --dry-run.
    .solution = sudo restic -r /var/backups/restic --password-file /root/.restic-pass forget --keep-weekly 13 --prune
hint-forget-me-script =
    .lead = Lass das wöchentliche Backup von selbst vergessen: dasselbe forget, mit --prune, nach dem Backup in seinem Skript.
    .solution = sudo nano /usr/local/sbin/choir-backup: restic forget --keep-weekly 13 --prune nach restic backup
hint-forget-me-end =
    .lead = Prüf alles: Tomas weg, aber seine Zahlungen behalten, der Bereinigungs-Timer aktiv, die Backups gestutzt und das Skript bereit.
    .solution = systemctl list-timers; sudo -u postgres psql choir -c "SELECT * FROM payments WHERE member_id = 41"; sudo restic -r /var/backups/restic --password-file /root/.restic-pass snapshots
