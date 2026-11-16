### Graded hints for The Old Sun (see src/engine/hints.ts): one message per
### step, hint-<chapter>-<event>, with .lead (a direction) and .solution
### (almost the answer).

## Chapter 1 — Read Before Touching

hint-read-first-smf =
    .lead = No systemd here: Solaris 10's services are managed by SMF. List them (man svcs).
    .solution = svcs (and svcs -x for what's broken): svc:/application/database/postgresql_84:default_64bit runs the database.
hint-read-first-data-dir =
    .lead = An SMF service has properties: one of them says where PostgreSQL keeps its data (man svcprop).
    .solution = svcprop -p postgresql_84/data postgresql_84:default_64bit (or ps -ef: the -D of the postgres process).
hint-read-first-zfs =
    .lead = The disks are in ZFS: which dataset holds that directory? (man zfs)
    .solution = zfs list: data/postgres is mounted on /var/postgres.
hint-read-first-encoding =
    .lead = The database itself: its name, its character set. psql can list the databases (as the postgres account).
    .solution = sudo -u postgres psql -l: seeds, in LATIN1. Its version: SELECT version().
hint-read-first-snapshot =
    .lead = Before any change, a safety net that takes an instant: ZFS can freeze a dataset (man zfs, snapshot).
    .solution = sudo zfs snapshot data/postgres@before-migration, then zfs list -t snapshot.
hint-read-first-end =
    .lead = Complete migration.md: the service (postgresql_84), the data directory and its dataset, the database (seeds), its version (8.4) and its character set (LATIN1).
    .solution = nano migration.md: svc:/application/database/postgresql_84:default_64bit; /var/postgres/8.4/data_64 on data/postgres; seeds, PostgreSQL 8.4, LATIN1; data/postgres@before-migration.

## Chapter 2 — Bytes in the Wrong Order

hint-byte-order-stopped =
    .lead = Before copying anything, stop what writes to the database: the catalogue is an SMF service too (man svcadm).
    .solution = sudo svcadm disable seed-catalogue, then svcs seed-catalogue (disabled).
hint-byte-order-restored =
    .lead = Data files don't travel to another version or processor; a dump does (man pg_dump). Then copy it to greenhouse, create the database there and replay it with psql.
    .solution = sudo -u postgres pg_dump seeds > seeds.sql; scp seeds.sql greenhouse:; ssh greenhouse; sudo -u postgres createdb -O catalogue seeds; sudo -u postgres psql -d seeds -f seeds.sql.
hint-byte-order-end =
    .lead = Check on greenhouse: the same counts as on herbarium, and the accents (SELECT name FROM varieties). The � in cat is the terminal, not the data.
    .solution = sudo -u postgres psql -d seeds -c "SELECT name FROM varieties". If you see Ã©: sudo -u postgres dropdb seeds, createdb again, and replay the original dump, untouched.

## Chapter 3 — Trust, Then Switch

hint-switch-over-counted =
    .lead = Before switching, prove both databases agree: count the rows on greenhouse and on herbarium.
    .solution = On greenhouse: sudo -u postgres psql -d seeds -c "SELECT count(*) FROM lendings"; the same on herbarium.
hint-switch-over-online =
    .lead = The catalogue reads its database's address in its configuration file when it starts (svcprop seed-catalogue tells which file).
    .solution = sudo nano /etc/opt/seed-catalogue/catalogue.ini: db_host = greenhouse.internal; then sudo svcadm enable seed-catalogue.
hint-switch-over-frozen =
    .lead = Keep the old database, but make sure nothing can write to it any more (a setting of the database, or stop its service).
    .solution = sudo -u postgres psql -c "ALTER DATABASE seeds SET default_transaction_read_only = on" (or sudo svcadm disable postgresql_84:default_64bit).
hint-switch-over-end =
    .lead = Check: the catalogue online on greenhouse, the old database frozen, and the old data and its snapshot still there.
    .solution = svcs seed-catalogue, zfs list -t snapshot, ls -ld /var/postgres/8.4/data_64 (sudo).
