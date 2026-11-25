### Die gestuften Hinweise der Geschichte „Das Theater“: eine Spur, dann
### fast die Antwort, für jeden Schritt (siehe src/engine/hints.ts).

## Kapitel 1 — Premiere

hint-too-many-clients-full =
    .lead = Was sagt die Ticketkasse, wenn sie scheitert? (man journalctl: -u; das Log des Servers liegt in /var/log/postgresql)
    .solution = journalctl -u boxoffice: „remaining connection slots are reserved for roles with the SUPERUSER attribute“.
hint-too-many-clients-idle =
    .lead = Wer hält die Verbindungen, und was tut er damit? Der Superuser kommt noch hinein (man psql: pg_stat_activity).
    .solution = sudo -u postgres psql -c "SELECT pid, state, state_change, query FROM pg_stat_activity": 15 Verbindungen „idle in transaction“.
hint-too-many-clients-end =
    .lead = PostgreSQL kann die Sitzungen, die in einer Transaktion untätig sind, selbst beenden (man psql: SHOW, ALTER SYSTEM, pg_reload_conf).
    .solution = sudo -u postgres psql -c "ALTER SYSTEM SET idle_in_transaction_session_timeout = '1min'", dann sudo -u postgres psql -c "SELECT pg_reload_conf()".

## Kapitel 2 — Die langsame Abfrage

hint-slow-query-slow =
    .lead = Welche Abfrage ist langsam? Das Journal der App und das Log von PostgreSQL sagen es (man journalctl).
    .solution = journalctl -u boxoffice: „slow query (4812 ms): SELECT seat, status FROM bookings WHERE show_id = 42“.
hint-slow-query-seqscan =
    .lead = Wie führt PostgreSQL diese Abfrage aus? (man psql: EXPLAIN, EXPLAIN ANALYZE)
    .solution = sudo -u postgres psql -d boxoffice -c "EXPLAIN ANALYZE SELECT seat, status FROM bookings WHERE show_id = 42": Parallel Seq Scan, 480.000 Zeilen gelesen.
hint-slow-query-end =
    .lead = Gib PostgreSQL einen Weg, die Zeilen eines Stücks zu finden, ohne die ganze Tabelle zu lesen (man psql: CREATE INDEX).
    .solution = sudo -u postgres psql -d boxoffice -c "CREATE INDEX ON bookings (show_id)", dann noch einmal EXPLAIN: Index Scan.

## Kapitel 3 — Nur lesen

hint-read-only-account =
    .lead = Welches Konto benutzt das Werkzeug, und was darf dieses Konto? (die Konfiguration des Werkzeugs; man psql: \du, \dp)
    .solution = sudo cat /etc/ticket-stats/config.env: DATABASE_URL=postgres://boxoffice:…, der Besitzer jeder Tabelle.
hint-read-only-role =
    .lead = Leg ein Konto an, das sich anmelden darf, und gib ihm das Recht zu lesen, sonst nichts (man psql: CREATE ROLE, GRANT).
    .solution = sudo -u postgres psql -d boxoffice -c "CREATE ROLE stats LOGIN PASSWORD 'waehl-eins'; GRANT SELECT ON ALL TABLES IN SCHEMA public TO stats"
hint-read-only-end =
    .lead = Die Tabellen, die noch kommen, brauchen Standardrechte, für die Rolle, die sie anlegen wird (man psql: ALTER DEFAULT PRIVILEGES). Dann die Konfiguration des Werkzeugs, und sein Neustart.
    .solution = sudo -u postgres psql -d boxoffice -c "ALTER DEFAULT PRIVILEGES FOR ROLE boxoffice IN SCHEMA public GRANT SELECT ON TABLES TO stats; GRANT SELECT ON donations TO stats", dann stats und sein Passwort in /etc/ticket-stats/config.env, und sudo systemctl restart ticket-stats.

## Kapitel 4 — Die Umschaltung

hint-failover-down =
    .lead = Was sagt die Ticketkasse, und antwortet stage noch? (man journalctl; man pg_isready: -h)
    .solution = journalctl -u boxoffice: „connect EHOSTUNREACH 192.0.2.29:5432“; pg_isready -h stage.internal: keine Antwort.
hint-failover-standby =
    .lead = Und das PostgreSQL dieser Maschine, was ist es? (man pg_lsclusters; man psql: pg_is_in_recovery, pg_last_xact_replay_timestamp)
    .solution = pg_lsclusters: 16 main, online,recovery: ein Standby, der alles bis 06:47:14 nachgespielt hat.
hint-failover-end =
    .lead = Mach den Standby zum Primärserver (man pg_ctlcluster: promote), schick dann die App zu ihm (ihre .env) und starte sie neu.
    .solution = sudo pg_ctlcluster 16 main promote, dann DATABASE_URL=postgres://boxoffice:…@localhost/boxoffice in /srv/boxoffice/.env, und sudo systemctl restart boxoffice.
