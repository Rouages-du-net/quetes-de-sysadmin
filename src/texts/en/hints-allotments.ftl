### Graded hints for The Allotments (see src/engine/hints.ts): one message
### per step, hint-<chapter>-<event>, with .lead (a direction, without the
### exact command) and .solution (almost the answer).

## Chapter 1 — Sleeping Connections

hint-sleeping-connections-crowd =
    .lead = Who holds the database's connections? Open MariaDB as the system's root and list the connections (man mariadb).
    .solution = sudo mariadb -e "SHOW PROCESSLIST" | head; sudo mariadb -e "SHOW PROCESSLIST" | grep -c Sleep
hint-sleeping-connections-timeout =
    .lead = How long may a connection sleep before the server closes it? Look at the timeout variables, and lower the right one for the running server.
    .solution = sudo mariadb -e "SHOW VARIABLES LIKE 'wait_timeout'"; sudo mariadb -e "SET GLOBAL wait_timeout = 300"
hint-sleeping-connections-cleared =
    .lead = The connections already open kept their old timeout: list their ids and end them.
    .solution = sudo mariadb -N -e "SELECT id FROM information_schema.PROCESSLIST WHERE command = 'Sleep' AND user = 'plotline'" | sudo xargs -n1 mariadb-admin kill (or KILL id; for each)
hint-sleeping-connections-persisted =
    .lead = SET GLOBAL lasts until the next start: write the same value where the server reads its settings at start.
    .solution = sudo nano /etc/mysql/mariadb.conf.d/50-server.cnf: wait_timeout = 300 under [mariadbd]
hint-sleeping-connections-slow-log =
    .lead = Each plot page is slow too: ask MariaDB to note the slow queries (the slow query log), then read it.
    .solution = sudo mariadb -e "SET GLOBAL slow_query_log = ON; SET GLOBAL long_query_time = 1"; then sudo tail /var/lib/mysql/trowel-slow.log (SHOW VARIABLES LIKE 'slow_query_log_file')
hint-sleeping-connections-explain =
    .lead = Ask MariaDB how it runs that query (EXPLAIN): which index, how many rows?
    .solution = sudo mariadb plots -e "EXPLAIN SELECT * FROM bookings WHERE plot_id = 17 ORDER BY starts_on DESC"
hint-sleeping-connections-index =
    .lead = Give bookings an index on the column the WHERE clause filters (man mariadb: CREATE INDEX).
    .solution = sudo mariadb plots -e "CREATE INDEX idx_plot ON bookings (plot_id)"
hint-sleeping-connections-end =
    .lead = Check everything: the timeout at runtime and in the file, no old sleeping connection, the index, max_connections sensible.
    .solution = sudo mariadb -e "SHOW PROCESSLIST"; grep -E 'wait_timeout|max_connections' /etc/mysql/mariadb.conf.d/50-server.cnf; sudo mariadb plots -e "SHOW INDEX FROM bookings"

## Chapter 2 — Least Privilege

hint-least-privilege-scan =
    .lead = Read Selin's report: which port answers from the internet, and what is behind it?
    .solution = cat scan_from_selin.txt; sudo ss -tlnp | grep 3306
hint-least-privilege-accounts =
    .lead = List the database's accounts, with the address each may come from and how it authenticates, then their rights.
    .solution = sudo mariadb -e "SELECT user, host, plugin FROM mysql.user"; sudo mariadb -e "SHOW GRANTS FOR 'root'@'%'"
hint-least-privilege-app-account =
    .lead = Create an account for the app alone, from barrow's address, with only the statements it runs on plots (man mariadb: CREATE USER, GRANT).
    .solution = sudo mariadb -e "CREATE USER 'app'@'198.51.100.134' IDENTIFIED BY 'a-long-new-password'; GRANT SELECT, INSERT, UPDATE, DELETE ON plots.* TO 'app'@'198.51.100.134'"
hint-least-privilege-app-switched =
    .lead = On barrow, give the app its new account in its settings, then restart it so that it reads them. Check its log.
    .solution = ssh barrow; sudo nano /srv/plotline/.env (DB_USER=app, DB_PASSWORD=…); sudo systemctl restart plotline; sudo tail /var/log/plotline/app.log
hint-least-privilege-root-local =
    .lead = Nobody needs root from the network any more: remove that account, and keep root@localhost on unix_socket.
    .solution = sudo mariadb -e "DROP USER 'root'@'%'"; sudo mariadb -e "SHOW GRANTS FOR 'root'@'localhost'"
hint-least-privilege-cleanup =
    .lead = Remove what nobody uses: the anonymous accounts, the test database and its grants, the account of the old server shed (mariadb-secure-installation does part of it).
    .solution = sudo mariadb-secure-installation (answer Y), then sudo mariadb -e "DROP USER 'plotline'@'198.51.100.133'"
hint-least-privilege-network =
    .lead = MariaDB listens on every address: make it listen on the back network only (bind-address, then a restart), or let only the back network in with the firewall.
    .solution = sudo nano /etc/mysql/mariadb.conf.d/50-server.cnf: bind-address = 198.51.100.131; sudo systemctl restart mariadb; sudo ss -tlnp | grep 3306
hint-least-privilege-end =
    .lead = Check the whole: the app's log on barrow, the accounts and their grants, where MariaDB listens.
    .solution = sudo mariadb -e "SELECT user, host, plugin FROM mysql.user"; sudo ss -tlnp; ssh barrow sudo tail -n 3 /var/log/plotline/app.log

## Chapter 3 — Broken Replica

hint-broken-replica-stopped =
    .lead = Go to rake and ask the replica for its status: which thread runs, which stopped, and why?
    .solution = ssh rake; sudo mariadb -e "SHOW REPLICA STATUS\G"
hint-broken-replica-cause =
    .lead = The error names a table and an id: look at that row on rake, then on trowel.
    .solution = sudo mariadb plots -e "SELECT * FROM waitlist WHERE id = 1043" (on rake, then on trowel)
hint-broken-replica-read-only =
    .lead = First stop anyone from writing on rake again (man mariadb: read_only).
    .solution = on rake: sudo mariadb -e "SET GLOBAL read_only = ON"
hint-broken-replica-read-only-kept =
    .lead = Make it survive a restart: rake's configuration has a line ready for it.
    .solution = on rake: sudo nano /etc/mysql/mariadb.conf.d/50-server.cnf: read_only = ON (uncommented)
hint-broken-replica-repaired =
    .lead = Remove the stray row on rake (rake must hold what trowel sends), then start the SQL thread again and watch it catch up.
    .solution = on rake: sudo mariadb plots -e "DELETE FROM waitlist WHERE id = 1043"; sudo mariadb -e "START REPLICA"; sudo mariadb -e "SHOW REPLICA STATUS\G" | grep -E 'Running|Behind|Error'
hint-broken-replica-identical =
    .lead = Prove that both servers hold the same rows: compute the tables' checksums on each.
    .solution = sudo mariadb -e "CHECKSUM TABLE plots.members, plots.plots, plots.waitlist, plots.bookings" (on trowel and on rake)
hint-broken-replica-jun =
    .lead = Esi's row was lost from rake: add her again, where writes belong.
    .solution = on trowel: sudo mariadb plots -e "INSERT INTO waitlist (name, email, wants, added_on) VALUES ('Esi Boateng', 'esi.boateng@mail.example', 'half', '2031-05-31')"
hint-broken-replica-script =
    .lead = The nightly dump reads tables without a consistent snapshot: fix the script's mariadb-dump line (man mariadb-dump).
    .solution = on rake: sudo nano /usr/local/sbin/plots-backup: mariadb-dump --single-transaction plots > …
hint-broken-replica-backup =
    .lead = Take a backup now, the way the script will.
    .solution = on rake: sudo /usr/local/sbin/plots-backup (or sudo mariadb-dump --single-transaction plots > /var/backups/mariadb/plots-check.sql)
hint-broken-replica-restored =
    .lead = Restore that dump into a scratch database on rake, then compare it with plots.
    .solution = on rake: sudo mariadb -e "CREATE DATABASE restore_check"; sudo sh -c 'mariadb restore_check < /var/backups/mariadb/plots-2031-06-02.sql'; sudo mariadb -e "CHECKSUM TABLE restore_check.waitlist, plots.waitlist"
hint-broken-replica-end =
    .lead = Check the whole: read_only on rake (now and in its file), the replica's status, the checksums, Esi on trowel, the script, a restored dump.
    .solution = on rake: sudo mariadb -e "SELECT @@read_only"; sudo mariadb -e "SHOW REPLICA STATUS\G" | grep -E 'Running|Behind'
