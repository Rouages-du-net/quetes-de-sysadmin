### The graduated hints of the story "The Theatre": a lead, then almost the
### answer, for each step (see src/engine/hints.ts).

## Chapter 1 — Opening Night

hint-too-many-clients-full =
    .lead = What does the ticket office say when it fails? (man journalctl: -u; the server's log is in /var/log/postgresql)
    .solution = journalctl -u boxoffice: "remaining connection slots are reserved for roles with the SUPERUSER attribute".
hint-too-many-clients-idle =
    .lead = Who holds the connections, and doing what? The superuser can still get in (man psql: pg_stat_activity).
    .solution = sudo -u postgres psql -c "SELECT pid, state, state_change, query FROM pg_stat_activity": 15 connections "idle in transaction".
hint-too-many-clients-end =
    .lead = PostgreSQL can end the sessions left idle in a transaction by itself (man psql: SHOW, ALTER SYSTEM, pg_reload_conf).
    .solution = sudo -u postgres psql -c "ALTER SYSTEM SET idle_in_transaction_session_timeout = '1min'", then sudo -u postgres psql -c "SELECT pg_reload_conf()".

## Chapter 2 — The Slow Query

hint-slow-query-slow =
    .lead = Which query is slow? The app's journal and PostgreSQL's log say it (man journalctl).
    .solution = journalctl -u boxoffice: "slow query (4812 ms): SELECT seat, status FROM bookings WHERE show_id = 42".
hint-slow-query-seqscan =
    .lead = How does PostgreSQL run this query? (man psql: EXPLAIN, EXPLAIN ANALYZE)
    .solution = sudo -u postgres psql -d boxoffice -c "EXPLAIN ANALYZE SELECT seat, status FROM bookings WHERE show_id = 42": Parallel Seq Scan, 480,000 rows read.
hint-slow-query-end =
    .lead = Give PostgreSQL a way to find the rows of one show without reading the whole table (man psql: CREATE INDEX).
    .solution = sudo -u postgres psql -d boxoffice -c "CREATE INDEX ON bookings (show_id)", then EXPLAIN again: Index Scan.

## Chapter 3 — Read Only

hint-read-only-account =
    .lead = Which account does the tool use, and what can that account do? (the tool's configuration; man psql: \du, \dp)
    .solution = sudo cat /etc/ticket-stats/config.env: DATABASE_URL=postgres://boxoffice:…, the owner of every table.
hint-read-only-role =
    .lead = Create an account that may log in, and give it the right to read, nothing else (man psql: CREATE ROLE, GRANT).
    .solution = sudo -u postgres psql -d boxoffice -c "CREATE ROLE stats LOGIN PASSWORD 'choose-one'; GRANT SELECT ON ALL TABLES IN SCHEMA public TO stats"
hint-read-only-end =
    .lead = The tables still to come need default privileges, for the role that will create them (man psql: ALTER DEFAULT PRIVILEGES). Then the tool's configuration, and its restart.
    .solution = sudo -u postgres psql -d boxoffice -c "ALTER DEFAULT PRIVILEGES FOR ROLE boxoffice IN SCHEMA public GRANT SELECT ON TABLES TO stats; GRANT SELECT ON donations TO stats", then stats and its password in /etc/ticket-stats/config.env, and sudo systemctl restart ticket-stats.

## Chapter 4 — The Failover

hint-failover-down =
    .lead = What does the ticket office say, and does stage still answer? (man journalctl; man pg_isready: -h)
    .solution = journalctl -u boxoffice: "connect EHOSTUNREACH 192.0.2.29:5432"; pg_isready -h stage.internal: no response.
hint-failover-standby =
    .lead = And this machine's PostgreSQL, what is it? (man pg_lsclusters; man psql: pg_is_in_recovery, pg_last_xact_replay_timestamp)
    .solution = pg_lsclusters: 16 main, online,recovery: a standby, which replayed everything up to 06:47:14.
hint-failover-end =
    .lead = Make the standby the primary (man pg_ctlcluster: promote), then send the app to it (its .env) and restart it.
    .solution = sudo pg_ctlcluster 16 main promote, then DATABASE_URL=postgres://boxoffice:…@localhost/boxoffice in /srv/boxoffice/.env, and sudo systemctl restart boxoffice.
