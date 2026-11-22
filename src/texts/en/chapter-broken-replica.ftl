### Story "The Allotments", chapter "Broken Replica": the replica stopped on
### a duplicate key. SHOW REPLICA STATUS, read_only, START/STOP REPLICA,
### sql_slave_skip_counter, GTID, CHECKSUM TABLE, mariadb-dump
### --single-transaction, a restore test. Commands, options, paths, SQL and
### outputs are not translated.

chapter-broken-replica = Broken Replica
    .summary = The reporting copy of the allotments' database stopped following the real one on Saturday evening, and nobody noticed: the waiting list Moana prints is two days old, and so is every nightly backup. Repair the replica properly, then prove the backups can be restored.

## Files

broken-replica-message-moana =
    From: Moana (secretary, Greenholme Allotments Association)
    Monday 2 June, 8:45

    Kia ora,

    This morning my waiting list report (the one I make from the reporting
    server, rake) doesn't show the people who signed up yesterday. And I
    think I may have caused it: on Saturday afternoon I added my neighbour,
    Esi Boateng, to the waiting list from my report tool, straight on rake.
    It let me, so I thought it was fine.

    Lwazi says rake is a "replica" of trowel and that the nightly backups
    are taken on it too. I'd like Esi to stay on the list, please!

    Moana

broken-replica-note-lwazi =
    Lwazi, April 2031

    - trowel is the primary: Plotline (on barrow) writes there. Its binary
      log goes to /var/log/mysql. rake (198.51.100.132) replicates it, with
      GTIDs, as repl. Moana's reports read rake, so they never slow the site.
    - On rake: sudo mariadb, then SHOW REPLICA STATUS\G.
    - Backups: rake's /usr/local/sbin/plots-backup, every night at 2:30
      (/etc/cron.d/plots-backup), into /var/backups/mariadb. I've never
      tried to restore one.
    - ssh rake from trowel; sudo works there with your password.

## Events

broken-replica-event-stopped =
    Slave_IO_Running: Yes, Slave_SQL_Running: No. The IO thread still copies
    what trowel writes, but the SQL thread, which applies it, stopped on
    Saturday at 18:12 and Seconds_Behind_Master is NULL. Last_SQL_Error says
    why: a row trowel inserted into plots.waitlist, id 1043, already exists
    on rake. Compare that row on both servers.
broken-replica-event-cause =
    On rake, waiting list 1043 is Esi, written by hand on Saturday at 17:46;
    on trowel, 1043 is Wairimu, who signed up on the site at 18:12. A replica
    must only receive what its primary sends: one write made on it is enough
    for the two copies to disagree. What would have stopped Moana's tool
    from writing there? (man mariadb: read_only.)
broken-replica-event-skipped =
    The SQL thread runs again, past the failing event: Wairimu's row was
    skipped, not applied. rake's 1043 is still Esi, and Wairimu exists only
    on trowel. The replica now holds a different database, quietly. Compare
    the tables on both servers (CHECKSUM TABLE plots.waitlist; on each).
broken-replica-event-skip-again =
    { $count } events skipped now. Each skip throws away a change trowel
    made: the replica follows, but further and further from its primary.
    Skipping hides an error, it doesn't repair data.
broken-replica-event-read-only =
    read_only is on: rake now refuses writes from ordinary accounts, Moana's
    tool included ("running with the --read-only option"). Replication
    itself and administrators (READ_ONLY ADMIN) can still write.
broken-replica-event-read-only-kept =
    read_only is in rake's configuration now: it will still be on after a
    restart.
broken-replica-event-repaired =
    Both threads run, no error, Seconds_Behind_Master: 0. rake has caught up
    with the two days of changes it missed.
broken-replica-event-diverged =
    The replica runs, but the checksums differ: rake doesn't hold the same
    rows as trowel. Replication only applies changes; it never compares nor
    fixes what already differs. Find the rows that differ, or rebuild rake
    from a consistent dump of trowel (mariadb-dump --single-transaction
    --master-data --gtid).
broken-replica-event-identical =
    The same checksums on both servers: rake is again an exact copy of
    trowel.
broken-replica-event-jun =
    Esi is on the waiting list, on trowel, where writes belong; rake
    receives her row like any other.
broken-replica-event-locking-dump =
    Without --single-transaction, mariadb-dump locked the tables while it
    read them (LOCK TABLES): during the whole dump, rake's SQL thread waited
    behind it (watch Seconds_Behind_Master), and on trowel the site would
    have waited. For InnoDB tables, --single-transaction reads a consistent
    snapshot without locking anything.
broken-replica-event-inconsistent-dump =
    That dump read each table at a different moment while rake kept
    applying changes (no lock, no transaction): a booking may be in it
    without its member, a waiting list row without its update. It looks
    fine and restores without error, but it is not a picture of one
    moment. --single-transaction gives one.
broken-replica-event-script =
    The nightly script now dumps with --single-transaction: a consistent
    snapshot, without stopping replication.
broken-replica-event-backup =
    A consistent dump of rake, taken while it was in step with trowel. A
    backup counts once you have restored it, though.
broken-replica-event-restored =
    The dump restored into another database, with the same rows: this
    backup is proven. Drop the scratch database when you're done.
broken-replica-event-end =
    Moana: "Esi and yesterday's sign-ups are all on my report. I won't
    write on rake again, and now it wouldn't let me anyway!"

    Well done! You finished Broken Replica.

    WHAT HAPPENED
    A row written by hand on the replica took an id that the primary gave
    to someone else minutes later; when that row arrived, rake's SQL thread
    stopped on a duplicate key and the replica fell two days behind,
    taking the nightly backups with it. You made rake read-only, removed
    the stray row there and added Esi on trowel, restarted replication and
    checked that both servers hold the same rows; then you made the backup
    consistent and proved it by restoring it.

    GOOD PRACTICE
    - A replica is read_only (in its configuration): writes go to the
      primary only. Watch Slave_SQL_Running and Seconds_Behind_Master, not
      just whether the server answers.
    - sql_slave_skip_counter throws a change away: the replica runs again
      but differs from its primary. Repair the data, or rebuild the replica
      from a consistent dump with its GTID position.
    - Compare rather than hope: CHECKSUM TABLE on both sides (pt-table-checksum
      or mariadb-dump and diff on a big base).
    - mariadb-dump --single-transaction gives a consistent snapshot of
      InnoDB tables without locking; --skip-lock-tables alone gives tables
      read at different moments.
    - A backup is proven by a restore: into a scratch database, then compare.

    DOCUMENTATION
    - SHOW REPLICA STATUS: https://mariadb.com/kb/en/show-replica-status/
    - Global transaction IDs: https://mariadb.com/kb/en/gtid/
    - read_only: https://mariadb.com/kb/en/server-system-variables/#read_only
    - sql_slave_skip_counter: https://mariadb.com/kb/en/replication-and-binary-log-system-variables/#sql_slave_skip_counter
    - CHECKSUM TABLE: https://mariadb.com/kb/en/checksum-table/
    - mariadb-dump: https://mariadb.com/kb/en/mariadb-dump/
