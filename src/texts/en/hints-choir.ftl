### Graded hints for The Choir (see src/engine/hints.ts): one message per
### step, hint-<chapter>-<event>, with .lead (a direction, without the exact
### command) and .solution (almost the answer).

## Chapter 1 — Kept Forever

hint-kept-forever-policy =
    .lead = What did the board promise? Read the retention policy Amara mentions.
    .solution = cat /srv/choir/docs/retention-policy.txt
hint-kept-forever-forever =
    .lead = Compare with what the server keeps: list the web server's logs, and read how logrotate rotates them.
    .solution = ls /var/log/nginx | tail; ls /var/log/nginx | wc -l; cat /etc/logrotate.d/nginx
hint-kept-forever-rotation =
    .lead = Make logrotate keep thirty days of access logs at most (man logrotate: daily, rotate, maxage).
    .solution = sudo nano /etc/logrotate.d/nginx: daily, rotate 30 (or keep weekly with rotate 3, or add maxage 30); sudo logrotate -d /etc/logrotate.d/nginx
hint-kept-forever-purged =
    .lead = logrotate won't remove the hundreds of archives its old count left behind: find them by their age, check the list, then delete them. Keep the last weeks.
    .solution = find /var/log/nginx -name 'access.log.*' -mtime +30; then sudo find /var/log/nginx -name 'access.log.*' -mtime +30 -delete
hint-kept-forever-anonymised =
    .lead = Write a variable holding the truncated address (man nginx: map, with a regular expression for IPv4 and one for IPv6, and a default), a log_format that uses it, and give it to access_log. Test, reload.
    .solution = in /etc/nginx/conf.d/anonymise.conf: map $remote_addr $remote_addr_anon {"{"} ~(?P<ip>\d+\.\d+\.\d+)\. $ip.0; ~(?P<ip>[^:]+:[^:]+): $ip::; default 0.0.0.0; {"}"} and log_format anonymised '$remote_addr_anon - $remote_user [$time_local] "$request" $status $body_bytes_sent "$http_referer" "$http_user_agent"'; then access_log /var/log/nginx/access.log anonymised; in nginx.conf; sudo nginx -t; sudo systemctl reload nginx
hint-kept-forever-journal =
    .lead = The journal keeps years too (journalctl --disk-usage, ls /var/log/journal/*). Give journald a maximum age (man journald.conf), then restart it.
    .solution = sudo nano /etc/systemd/journald.conf: MaxRetentionSec=30day under [Journal]; sudo systemctl restart systemd-journald
hint-kept-forever-end =
    .lead = Check everything against the policy: the web logs (thirty days, truncated addresses), the audit log (twelve months, untouched), the journal (thirty days).
    .solution = sudo tail -n 3 /var/log/nginx/access.log; ls -l /var/log/nginx /var/log/choir; journalctl --disk-usage

## Chapter 2 — The Access Request

hint-access-request-her-row =
    .lead = Start with the database of the members' app: which tables, and her row in the members table (man psql; the database is choir, its administrator is postgres).
    .solution = sudo -u postgres psql choir -c '\dt'; sudo -u postgres psql choir -c "SELECT * FROM members WHERE last_name = 'Raman'"
hint-access-request-tables =
    .lead = Other tables point to her by her id (27) or her email: query each one, and write the results into the answer's directory.
    .solution = sudo -u postgres psql choir -c "SELECT * FROM attendance WHERE member_id = 27" > /srv/choir/gdpr-requests/priya-raman/attendance.txt (the same for payments; newsletter WHERE email = 'priya.raman@mail.example'; and members WHERE id = 27)
hint-access-request-uploads =
    .lead = The members' area keeps uploads in one directory per member id.
    .solution = sudo ls /srv/choir/uploads/27; sudo cp /srv/choir/uploads/27/* /srv/choir/gdpr-requests/priya-raman/
hint-access-request-logs =
    .lead = Search the logs for her email, the gzipped ones too (man zgrep), and keep only her lines.
    .solution = grep -rl priya.raman /var/log; grep priya.raman@mail.example /var/log/choir/audit.log; zgrep priya.raman@mail.example /var/log/choir/audit.log.1.gz; grep priya.raman@mail.example /var/log/mail.log (each > a file in the answer)
hint-access-request-old-copy =
    .lead = Is she anywhere else on disk? Search the choir's files for her name or her phone number.
    .solution = sudo grep -r 'Priya Raman' /srv/choir; sudo grep 'Priya Raman' /srv/choir/exports/phone-tree-2030-10.csv > /srv/choir/gdpr-requests/priya-raman/phone-tree.txt
hint-access-request-end =
    .lead = Check the answer: all her data, and nobody else's (no other email or phone number).
    .solution = ls -l /srv/choir/gdpr-requests/priya-raman; grep -rh '@' /srv/choir/gdpr-requests/priya-raman | grep -v priya.raman

## Chapter 3 — Forget Me

hint-forget-me-found =
    .lead = Find Tomas in the database, and every table that points to him.
    .solution = sudo -u postgres psql choir -c "SELECT * FROM members WHERE last_name = 'Novak'"; then attendance and payments WHERE member_id = 41, newsletter WHERE email = 'tomas.novak@mail.example'
hint-forget-me-erased =
    .lead = Delete him from the tables erasure reaches, and leave the subscriptions alone (the policy keeps accounting records ten years).
    .solution = sudo -u postgres psql choir -c "DELETE FROM attendance WHERE member_id = 41; DELETE FROM newsletter WHERE email = 'tomas.novak@mail.example'; DELETE FROM members WHERE id = 41"
hint-forget-me-uploads =
    .lead = His photo and consent form are in the uploads, under his id.
    .solution = sudo ls /srv/choir/uploads/41; sudo rm /srv/choir/uploads/41/photo.jpg /srv/choir/uploads/41/consent-form.pdf; sudo rmdir /srv/choir/uploads/41
hint-forget-me-purge-broken =
    .lead = Has Ruben's purge ever run? Look at the timers (all of them), the service and its journal.
    .solution = systemctl list-timers --all; systemctl cat choir-purge.service; sudo systemctl start choir-purge.service; sudo journalctl -u choir-purge
hint-forget-me-purge =
    .lead = Fix the account it runs as (one with a database role), add the attendance to the script, reload systemd, start the service to test, and enable the timer.
    .solution = sudo nano /etc/systemd/system/choir-purge.service (User=postgres); sudo nano /usr/local/sbin/choir-purge (psql choir -c "DELETE FROM attendance WHERE rehearsed_on < current_date - interval '2 years'"); sudo systemctl daemon-reload; sudo systemctl start choir-purge.service; sudo systemctl enable --now choir-purge.timer
hint-forget-me-snapshots =
    .lead = What do the backups hold? List the restic repository's snapshots (its location and password are in the backup script).
    .solution = sudo cat /usr/local/sbin/choir-backup; sudo restic -r /var/backups/restic --password-file /root/.restic-pass snapshots
hint-forget-me-trimmed =
    .lead = Forget the snapshots older than about three months, and delete their data (man restic: forget, --keep-weekly, --keep-within, --prune). Try --dry-run first.
    .solution = sudo restic -r /var/backups/restic --password-file /root/.restic-pass forget --keep-weekly 13 --prune
hint-forget-me-script =
    .lead = Make the weekly backup forget on its own: the same forget, with --prune, after the backup in its script.
    .solution = sudo nano /usr/local/sbin/choir-backup: restic forget --keep-weekly 13 --prune after restic backup
hint-forget-me-end =
    .lead = Check it all: Tomas gone but his payments kept, the purge timer active, the backups trimmed and the script ready.
    .solution = systemctl list-timers; sudo -u postgres psql choir -c "SELECT * FROM payments WHERE member_id = 41"; sudo restic -r /var/backups/restic --password-file /root/.restic-pass snapshots
