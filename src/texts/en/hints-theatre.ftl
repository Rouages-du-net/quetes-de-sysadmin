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
