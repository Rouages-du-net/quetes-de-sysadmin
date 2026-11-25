### Graded hints for The Allotments (see src/engine/hints.ts): one message
### per step, hint-<chapter>-<event>, with .lead (a direction, without the
### exact command) and .solution (almost the answer).


## Chapter 1 — Sleeping Connections

hint-sleeping-connections-crowd =
    .lead = Wer hält die Verbindungen der Datenbank? Öffne MariaDB als root des Systems und liste die Verbindungen auf (man mariadb).
    .solution = sudo mariadb -e "SHOW PROCESSLIST" | head; sudo mariadb -e "SHOW PROCESSLIST" | grep -c Sleep
hint-sleeping-connections-timeout =
    .lead = Wie lange darf eine Verbindung schlafen, bevor der Server sie schließt? Schau dir die Timeout-Variablen an und senke die richtige für den laufenden Server.
    .solution = sudo mariadb -e "SHOW VARIABLES LIKE 'wait_timeout'"; sudo mariadb -e "SET GLOBAL wait_timeout = 300"
hint-sleeping-connections-cleared =
    .lead = Die schon offenen Verbindungen haben ihr altes Timeout behalten: liste ihre ids auf und beende sie.
    .solution = sudo mariadb -N -e "SELECT id FROM information_schema.PROCESSLIST WHERE command = 'Sleep' AND user = 'plotline'" | sudo xargs -n1 mariadb-admin kill (oder KILL id; für jede)
hint-sleeping-connections-persisted =
    .lead = SET GLOBAL hält bis zum nächsten Start: schreib denselben Wert dorthin, wo der Server beim Start seine Einstellungen liest.
    .solution = sudo nano /etc/mysql/mariadb.conf.d/50-server.cnf: wait_timeout = 300 unter [mariadbd]
hint-sleeping-connections-slow-log =
    .lead = Jede Parzellenseite ist auch langsam: lass MariaDB die langsamen Abfragen notieren (das Slow Query Log), dann lies es.
    .solution = sudo mariadb -e "SET GLOBAL slow_query_log = ON; SET GLOBAL long_query_time = 1"; dann sudo tail /var/lib/mysql/trowel-slow.log (SHOW VARIABLES LIKE 'slow_query_log_file')
hint-sleeping-connections-explain =
    .lead = Frag MariaDB, wie es diese Abfrage ausführt (EXPLAIN): welcher Index, wie viele Zeilen?
    .solution = sudo mariadb plots -e "EXPLAIN SELECT * FROM bookings WHERE plot_id = 17 ORDER BY starts_on DESC"
hint-sleeping-connections-index =
    .lead = Gib bookings einen Index auf der Spalte, nach der die WHERE-Klausel filtert (man mariadb: CREATE INDEX).
    .solution = sudo mariadb plots -e "CREATE INDEX idx_plot ON bookings (plot_id)"
hint-sleeping-connections-end =
    .lead = Prüf alles: das Timeout zur Laufzeit und in der Datei, keine alte schlafende Verbindung, der Index, max_connections vernünftig.
    .solution = sudo mariadb -e "SHOW PROCESSLIST"; grep -E 'wait_timeout|max_connections' /etc/mysql/mariadb.conf.d/50-server.cnf; sudo mariadb plots -e "SHOW INDEX FROM bookings"

## Chapter 2 — Least Privilege

hint-least-privilege-scan =
    .lead = Lies Selins Bericht: welcher Port antwortet aus dem Internet, und was steckt dahinter?
    .solution = cat scan_von_selin.txt; sudo ss -tlnp | grep 3306
hint-least-privilege-accounts =
    .lead = Liste die Konten der Datenbank auf, mit der Adresse, von der jedes kommen darf, und wie es sich authentifiziert, dann ihre Rechte.
    .solution = sudo mariadb -e "SELECT user, host, plugin FROM mysql.user"; sudo mariadb -e "SHOW GRANTS FOR 'root'@'%'"
hint-least-privilege-app-account =
    .lead = Leg ein Konto nur für die App an, von der Adresse von barrow, mit nur den Anweisungen, die sie auf plots ausführt (man mariadb: CREATE USER, GRANT).
    .solution = sudo mariadb -e "CREATE USER 'app'@'198.51.100.134' IDENTIFIED BY 'ein-langes-neues-passwort'; GRANT SELECT, INSERT, UPDATE, DELETE ON plots.* TO 'app'@'198.51.100.134'"
hint-least-privilege-app-switched =
    .lead = Gib der App auf barrow ihr neues Konto in ihren Einstellungen, dann starte sie neu, damit sie sie liest. Prüf ihr Log.
    .solution = ssh barrow; sudo nano /srv/plotline/.env (DB_USER=app, DB_PASSWORD=…); sudo systemctl restart plotline; sudo tail /var/log/plotline/app.log
hint-least-privilege-root-local =
    .lead = Niemand braucht mehr root aus dem Netzwerk: entferne dieses Konto, und behalte root@localhost mit unix_socket.
    .solution = sudo mariadb -e "DROP USER 'root'@'%'"; sudo mariadb -e "SHOW GRANTS FOR 'root'@'localhost'"
hint-least-privilege-cleanup =
    .lead = Entferne, was niemand benutzt: die anonymen Konten, die Testdatenbank und ihre Rechte, das Konto des alten Servers shed (mariadb-secure-installation macht einen Teil davon).
    .solution = sudo mariadb-secure-installation (mit Y antworten), dann sudo mariadb -e "DROP USER 'plotline'@'198.51.100.133'"
hint-least-privilege-network =
    .lead = MariaDB lauscht auf jeder Adresse: lass es nur im hinteren Netzwerk lauschen (bind-address, dann ein Neustart), oder lass mit der Firewall nur das hintere Netzwerk herein.
    .solution = sudo nano /etc/mysql/mariadb.conf.d/50-server.cnf: bind-address = 198.51.100.131; sudo systemctl restart mariadb; sudo ss -tlnp | grep 3306
hint-least-privilege-end =
    .lead = Prüf das Ganze: das Log der App auf barrow, die Konten und ihre Rechte, wo MariaDB lauscht.
    .solution = sudo mariadb -e "SELECT user, host, plugin FROM mysql.user"; sudo ss -tlnp; ssh barrow sudo tail -n 3 /var/log/plotline/app.log

## Chapter 3 — Broken Replica

hint-broken-replica-stopped =
    .lead = Geh auf rake und frag die Replica nach ihrem Status: welcher Thread läuft, welcher hat angehalten, und warum?
    .solution = ssh rake; sudo mariadb -e "SHOW REPLICA STATUS\G"
hint-broken-replica-cause =
    .lead = Der Fehler nennt eine Tabelle und eine id: schau dir diese Zeile auf rake an, dann auf trowel.
    .solution = sudo mariadb plots -e "SELECT * FROM waitlist WHERE id = 1043" (auf rake, dann auf trowel)
hint-broken-replica-read-only =
    .lead = Hindere zuerst alle daran, wieder auf rake zu schreiben (man mariadb: read_only).
    .solution = auf rake: sudo mariadb -e "SET GLOBAL read_only = ON"
hint-broken-replica-read-only-kept =
    .lead = Lass es einen Neustart überstehen: die Konfiguration von rake hat schon eine Zeile dafür.
    .solution = auf rake: sudo nano /etc/mysql/mariadb.conf.d/50-server.cnf: read_only = ON (Kommentarzeichen entfernen)
hint-broken-replica-repaired =
    .lead = Entferne die verirrte Zeile auf rake (rake muss enthalten, was trowel schickt), dann starte den SQL-Thread wieder und sieh zu, wie er aufholt.
    .solution = auf rake: sudo mariadb plots -e "DELETE FROM waitlist WHERE id = 1043"; sudo mariadb -e "START REPLICA"; sudo mariadb -e "SHOW REPLICA STATUS\G" | grep -E 'Running|Behind|Error'
hint-broken-replica-identical =
    .lead = Beweise, dass beide Server dieselben Zeilen enthalten: berechne auf jedem die Prüfsummen der Tabellen.
    .solution = sudo mariadb -e "CHECKSUM TABLE plots.members, plots.plots, plots.waitlist, plots.bookings" (auf trowel und auf rake)
hint-broken-replica-jun =
    .lead = Esis Zeile ist auf rake verloren gegangen: füge sie wieder hinzu, dort, wo Schreibvorgänge hingehören.
    .solution = auf trowel: sudo mariadb plots -e "INSERT INTO waitlist (name, email, wants, added_on) VALUES ('Esi Boateng', 'esi.boateng@mail.example', 'half', '2031-05-31')"
hint-broken-replica-script =
    .lead = Der nächtliche Dump liest die Tabellen ohne konsistenten Snapshot: repariere die Zeile mit mariadb-dump im Skript (man mariadb-dump).
    .solution = auf rake: sudo nano /usr/local/sbin/plots-backup: mariadb-dump --single-transaction plots > …
hint-broken-replica-backup =
    .lead = Mach jetzt ein Backup, so wie das Skript es tun wird.
    .solution = auf rake: sudo /usr/local/sbin/plots-backup (oder sudo mariadb-dump --single-transaction plots > /var/backups/mariadb/plots-check.sql)
hint-broken-replica-restored =
    .lead = Stell diesen Dump in eine Schmierdatenbank auf rake wieder her, dann vergleiche ihn mit plots.
    .solution = auf rake: sudo mariadb -e "CREATE DATABASE restore_check"; sudo sh -c 'mariadb restore_check < /var/backups/mariadb/plots-2031-06-02.sql'; sudo mariadb -e "CHECKSUM TABLE restore_check.waitlist, plots.waitlist"
hint-broken-replica-end =
    .lead = Prüf das Ganze: read_only auf rake (jetzt und in seiner Datei), der Status der Replica, die Prüfsummen, Esi auf trowel, das Skript, ein wiederhergestellter Dump.
    .solution = auf rake: sudo mariadb -e "SELECT @@read_only"; sudo mariadb -e "SHOW REPLICA STATUS\G" | grep -E 'Running|Behind'
