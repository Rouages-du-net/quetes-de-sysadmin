### Story "The Theatre", chapter 2 "The Slow Query": EXPLAIN, a sequential
### scan, CREATE INDEX. SQL, paths and the tools' outputs are not
### translated.

chapter-slow-query = The Slow Query
    .summary = The seat map takes five seconds to show up, for every show. PostgreSQL logs the slow query; ask it how it runs it, and give it a shortcut.

## Files

slow-query-message-camille =
    From:     Camille
    To:       you
    Subject:  The seat map is so slow

    Hello,

    Thanks again for the opening night! Now the seat map is very slow:
    five seconds before the seats show up, for every show. It used to be
    instant when the theatre opened. To time it:
      curl -s -o /dev/null -w '%{"{"}time_total{"}"}\n' http://localhost:3000/shows/42/seats

    The bookings table keeps every seat sold since the theatre opened. I
    don't want to delete our history.

    Same sudo password: curtain-2028.

    Camille

## Events

slow-query-event-slow =
    4812 ms for one query: SELECT seat, status FROM bookings WHERE
    show_id = 42. PostgreSQL logs every statement slower than 1 s
    (log_min_duration_statement in postgresql.conf). How does it run it?
    (man psql: EXPLAIN)
slow-query-event-seqscan =
    Seq Scan on bookings: to find the 380 seats of show 42, PostgreSQL
    reads the whole table, all 480,000 rows (with two parallel workers,
    but still). "Rows Removed by Filter" in EXPLAIN ANALYZE says how many
    it read for nothing. A table of contents for show_id would let it go
    straight to the right rows.
slow-query-event-wrong-column =
    An index on bookings, but not on the column of the condition: the
    query looks for show_id = 42, and EXPLAIN still reads the whole table.
    An index helps the queries that filter (or sort) on its column.
slow-query-event-vacuum =
    VACUUM tidies up dead rows, ANALYZE refreshes the statistics the
    planner uses: both are healthy, but neither creates a way to find the
    rows of one show without reading them all.
slow-query-event-end =
    The seat map shows up instantly again: EXPLAIN now uses the index
    { $index } (Index Scan), and reads 380 rows instead of 480,000.
    Camille: "And we keep the whole history!"

    Well done! You have finished the chapter "The Slow Query".

    WHAT HAPPENED
    The bookings table grows with every show. Without an index on
    show_id, finding one show's seats means reading every row: fine with
    a few thousand, five seconds with 480,000. EXPLAIN said so: Seq Scan,
    Filter, Rows Removed by Filter.

    THE INDEX
    An index (a B-tree by default) is a sorted copy of a column, with
    where each row is: PostgreSQL finds the rows of show 42 in a few
    steps, whatever the size of the table. It takes room on disk and
    slows each INSERT a little: you index the columns your queries filter
    on, not every column.

    GOOD PRACTICE
    - Find the slow queries: log_min_duration_statement (or the
      pg_stat_statements extension).
    - EXPLAIN shows the plan; EXPLAIN ANALYZE runs it and adds the real
      times.
    - On a busy production table, CREATE INDEX CONCURRENTLY doesn't block
      writes while it builds.

    DOCUMENTATION
    - EXPLAIN: https://www.postgresql.org/docs/16/using-explain.html
    - Indexes: https://www.postgresql.org/docs/16/indexes-intro.html
    - CREATE INDEX: https://www.postgresql.org/docs/16/sql-createindex.html
