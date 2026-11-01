### Story "The Game Library", chapter 3 "The Database": back up a
### PostgreSQL database with pg_dump, check the restore, repair a table. The
### commands, the SQL and PostgreSQL's messages are not translated.

chapter-database = The Database
    .summary = Copying the files of a running database is not a backup: pg_dump every night, a test restore, then a table to put back in a hurry.

## Files

database-message-berenice =
    A message from Bérénice:

    "The game loans are in a PostgreSQL database, gamelib, on the
    server. Malo says it's backed up, since rsnapshot copies
    /var/lib/postgresql every night (his note is next to this one). But a
    friend who works in IT told me that's not a real backup.

    Could you make sure the database is really backed up every
    night (in /var/backups/postgresql), and check that we'd know how to
    put it back? Above all, don't touch the real database while you try
    things out: volunteers record loans all day long.

    For sudo: dice-2027."
database-word-malo =
    A note from Malo:

    "The database files are in /var/lib/postgresql/16/main, and
    rsnapshot copies them every night along with the rest. To talk to the
    database: psql. The account with all the rights on the database is called postgres."
database-crontab-root = Snapshots (rsnapshot): weekly at 3:00 on Monday, daily at 3:30
# The tables' columns, and the members' districts.
database-columns-boardgames = id,name,copies
database-columns-members = id,card,district
database-columns-loans = id,game_id,member_id,out_on,returned_on
database-districts = north,south,east,west,centre
database-names-games = snakes and ladders,ludo,draughts,mikado,dominoes,animal memory,ladder game,oware,go,connect four,mancala,tangram,solitaire,battleship,happy families

## Events

database-event-role =
    PostgreSQL doesn't know you: through the local socket, you connect under
    the name of your account ("peer" authentication), and neither "you" nor
    root is a role in this database. The postgres account, however, has all
    the rights: sudo -u postgres (man sudo).
database-event-on-true =
    Stop! This restore targeted gamelib, the live database: its tables
    already exist, hence the errors. Restoring over the real database to
    "try it out" risks overwriting today's loans. A test
    restore is done in a separate database (man createdb).
database-event-test-succeeded =
    The test database contains as many games, members and loans as the
    real one: the backup can be restored. That's the only way to know
    a backup works. (The test database can be deleted with
    dropdb.)
database-incident =
    2:05 pm. Bérénice, in a panic: "A volunteer clicked on "clear
    history" in the admin page… The list of loans is
    empty! The games and members are still there. Can you put the
    loans back, WITHOUT touching the rest?"
    (Check with psql: how many rows are left in loans? Your
    backup from this morning contains the whole table; man pg_restore.)
database-event-duplicates =
    pg_restore refuses: some loans from the backup are already in the table
    (duplicate key). You only reload data into an empty table, or
    by recreating it (--clean).
database-event-cron-root =
    The job in root's crontab runs pg_dump as root, which is not a
    role in the database: every night, it would fail (role "root" does not
    exist). Use the postgres account's crontab (sudo crontab -u postgres -e), or
    sudo -u postgres in front of the command.
database-event-loans-returned =
    The 1,873 loans are back, and nothing else has moved. Bérénice:
    "Phew!"
database-event-end =
    The database is backed up every night for real, the restore has been
    checked, and the table emptied by mistake came back in one command.

    Well done! You have finished chapter 3 of The Game Library, and the whole story.

    WHAT HAPPENED
    Copying the files of a running database (as rsnapshot did)
    can give an inconsistent copy: the database writes during the copy.
    pg_dump, on the other hand, reads the database as at one precise moment
    and produces a consistent backup, without stopping it. A restore into a
    test database proved it worked; then pg_restore put back only one
    table, the only one affected.

    GOOD PRACTICE
    - Back up a database with its own tool (pg_dump, mysqldump), every
      night, then copy the archive along with the rest (rsnapshot, restic,
      offline).
    - The custom format (-Fc): compressed, and you can restore just a
      part of it (-t).
    - Test the restore regularly, in a separate database.
    - Whatever changed since the last backup is lost: to lose less,
      archive the database's log (WAL, point-in-time recovery).
    - Never experiment on the live database.

    DOCUMENTATION
    - Backing up with pg_dump: https://www.postgresql.org/docs/16/backup-dump.html
    - Why copying the files is not enough: https://www.postgresql.org/docs/16/backup-file.html
    - pg_restore: https://www.postgresql.org/docs/16/app-pgrestore.html
