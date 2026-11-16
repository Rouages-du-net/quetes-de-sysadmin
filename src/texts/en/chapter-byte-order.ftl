### Story "The Old Sun", chapter "Bytes in the Wrong Order": move the
### database to greenhouse with a dump, not its data files, and mind the
### character set. Commands, paths and messages are not translated.

chapter-byte-order = Bytes in the Wrong Order
    .summary = Move the catalogue's database to the new server: Odette's tar of the data files won't start there, a dump will; stop what writes first, and mind the accents.

## Files

byte-order-email-inaya =
    From:  Inaya
    To:    you

    I called Odette. She says it's easy: "copy the weekly tar to the new
    server and start PostgreSQL on it, I did that when we changed disks".
    The lending desk is closed until Thursday, so we can stop the catalogue
    in the meantime.

    greenhouse is reachable from herbarium (ssh greenhouse, your key is
    already there).

    Inaya

byte-order-migration =
    # Moving the catalogue off herbarium

    ## The database service (its SMF name)
    svc:/application/database/postgresql_84:default_64bit, and the
    catalogue: svc:/site/seed-catalogue:default.

    ## Where its data lives (directory, ZFS dataset)
    /var/postgres/8.4/data_64, on data/postgres.

    ## The database (name, PostgreSQL version, character set)
    seeds, PostgreSQL 8.4, LATIN1. herbarium is a SPARC (big-endian).

    ## Before touching anything
    data/postgres@before-migration (zfs snapshot).

## Events

byte-order-event-incompatible =
    It won't start: these files were written by PostgreSQL 8.4, and
    greenhouse runs 16. Even with the same version, they wouldn't do: SPARC
    writes its numbers big-endian, the x86 little-endian, and a data
    directory is the server's memory laid on disk, byte order included. And
    a tar taken while the server ran isn't even consistent. What travels
    between versions and machines is a dump: SQL text (pg_dump).
byte-order-event-stopped =
    The catalogue is stopped: nobody can record a lending while you copy.
    A dump is consistent with itself, but what is written after it would
    be lost on the new server.
byte-order-event-replacement =
    � where the accents should be: the dump is in LATIN1 (one byte per
    accented letter), and greenhouse's terminal reads UTF-8. The file isn't
    broken: its first lines say SET client_encoding = 'LATIN1', and psql
    will convert it while restoring.
byte-order-event-invalid =
    "invalid byte sequence for encoding UTF8": the file's bytes are LATIN1,
    but it now says it is UTF-8. The file and its SET client_encoding must
    agree.
byte-order-event-mojibake =
    CrimÃ©e instead of Crimée: the accents were converted twice. The file
    was converted to UTF-8 (iconv), but still says SET client_encoding =
    'LATIN1', so PostgreSQL converted each byte again. Drop the database
    (dropdb), and restore the original dump as it is, or fix its SET
    client_encoding line too.
byte-order-event-missing-rows =
    greenhouse doesn't have all of herbarium's rows: lendings were recorded
    after the dump. Stop the catalogue first, then dump again, and restore
    into an empty database.
byte-order-event-restored =
    The seeds database exists on greenhouse, with its three tables.
byte-order-event-end =
    Inaya: "I opened the catalogue on greenhouse: Tomato 'Noire de Crimée'
    has all its accents! And the lendings are all there."

    Well done! You have finished the chapter "Bytes in the Wrong Order".

    WHAT HAPPENED
    Odette's tar holds the data files of a PostgreSQL 8.4 running on
    SPARC: another version, and another byte order than greenhouse's x86.
    Data files don't travel; a dump does. With the catalogue stopped, the
    dump holds everything; restored with psql, its SET client_encoding =
    'LATIN1' told PostgreSQL how to read the accents, and it stored them in
    UTF-8.

    GOOD PRACTICE
    - Move a database between versions or machines with a dump (pg_dump),
      never by copying its files.
    - Stop what writes before the dump you're going to switch to.
    - Mind the character set: a file and the encoding it declares must
      agree. file and head tell you which; on a UTF-8 terminal, LATIN1
      shows as �, and that's not damage.
    - Check after restoring: counts, and a few rows with accents.

    ANOTHER WAY
    pg_dump -E UTF8 converts while dumping. For a big database, pg_dump
    -Fc (custom format) with pg_restore -j restores in parallel. Between
    two machines with the same version and architecture, replication
    (streaming, or pg_upgrade for versions) avoids a long stop.

    DOCUMENTATION
    - Upgrading a PostgreSQL cluster: https://www.postgresql.org/docs/16/upgrading.html
    - pg_dump: https://www.postgresql.org/docs/16/app-pgdump.html
    - Character set support: https://www.postgresql.org/docs/16/multibyte.html
