### Abgestufte Hinweise für Die alte Sonne (siehe src/engine/hints.ts): eine
### Nachricht pro Schritt, hint-<chapter>-<event>, mit .lead (eine Richtung)
### und .solution (fast die Antwort).

## Kapitel 1 — Erst lesen, dann anfassen

hint-read-first-smf =
    .lead = Hier gibt es kein systemd: Die Dienste von Solaris 10 werden von SMF verwaltet. Liste sie auf (man svcs).
    .solution = svcs (und svcs -x für das, was kaputt ist): svc:/application/database/postgresql_84:default_64bit betreibt die Datenbank.
hint-read-first-data-dir =
    .lead = Ein SMF-Dienst hat Eigenschaften: Eine davon sagt, wo PostgreSQL seine Daten aufbewahrt (man svcprop).
    .solution = svcprop -p postgresql_84/data postgresql_84:default_64bit (oder ps -ef: das -D des Prozesses postgres).
hint-read-first-zfs =
    .lead = Die Platten sind in ZFS: Welches Dataset enthält dieses Verzeichnis? (man zfs)
    .solution = zfs list: data/postgres ist auf /var/postgres eingehängt.
hint-read-first-encoding =
    .lead = Die Datenbank selbst: ihr Name, ihr Zeichensatz. psql kann die Datenbanken auflisten (als Konto postgres).
    .solution = sudo -u postgres psql -l: seeds, in LATIN1. Ihre Version: SELECT version().
hint-read-first-snapshot =
    .lead = Vor jeder Änderung ein Sicherheitsnetz, das einen Augenblick dauert: ZFS kann ein Dataset einfrieren (man zfs, snapshot).
    .solution = sudo zfs snapshot data/postgres@before-migration, dann zfs list -t snapshot.
hint-read-first-end =
    .lead = Ergänze migration.md: der Dienst (postgresql_84), das Datenverzeichnis und sein Dataset, die Datenbank (seeds), ihre Version (8.4) und ihr Zeichensatz (LATIN1).
    .solution = nano migration.md: svc:/application/database/postgresql_84:default_64bit; /var/postgres/8.4/data_64 auf data/postgres; seeds, PostgreSQL 8.4, LATIN1; data/postgres@before-migration.

## Kapitel 2 — Bytes in falscher Reihenfolge

hint-byte-order-stopped =
    .lead = Bevor du etwas kopierst, stoppe, was in die Datenbank schreibt: Der Katalog ist auch ein SMF-Dienst (man svcadm).
    .solution = sudo svcadm disable seed-catalogue, dann svcs seed-catalogue (disabled).
hint-byte-order-restored =
    .lead = Datendateien reisen nicht zu einer anderen Version oder einem anderen Prozessor; ein Dump schon (man pg_dump). Kopier ihn dann nach greenhouse, leg dort die Datenbank an und spiel ihn mit psql ein.
    .solution = sudo -u postgres pg_dump seeds > seeds.sql; scp seeds.sql greenhouse:; ssh greenhouse; sudo -u postgres createdb -O catalogue seeds; sudo -u postgres psql -d seeds -f seeds.sql.
hint-byte-order-end =
    .lead = Prüfe auf greenhouse: dieselben Anzahlen wie auf herbarium, und die Akzente (SELECT name FROM varieties). Das � bei cat ist das Terminal, nicht die Daten.
    .solution = sudo -u postgres psql -d seeds -c "SELECT name FROM varieties". Wenn du Ã© siehst: sudo -u postgres dropdb seeds, wieder createdb, und den ursprünglichen Dump unverändert einspielen.

## Kapitel 3 — Erst vertrauen, dann umschalten

hint-switch-over-counted =
    .lead = Beweise vor dem Umschalten, dass beide Datenbanken übereinstimmen: Zähle die Zeilen auf greenhouse und auf herbarium.
    .solution = Auf greenhouse: sudo -u postgres psql -d seeds -c "SELECT count(*) FROM lendings"; dasselbe auf herbarium.
hint-switch-over-online =
    .lead = Der Katalog liest die Adresse seiner Datenbank beim Start aus seiner Konfigurationsdatei (svcprop seed-catalogue sagt, welche Datei).
    .solution = sudo nano /etc/opt/seed-catalogue/catalogue.ini: db_host = greenhouse.internal; dann sudo svcadm enable seed-catalogue.
hint-switch-over-frozen =
    .lead = Behalte die alte Datenbank, aber sorge dafür, dass nichts mehr in sie schreiben kann (eine Einstellung der Datenbank, oder ihren Dienst stoppen).
    .solution = sudo -u postgres psql -c "ALTER DATABASE seeds SET default_transaction_read_only = on" (oder sudo svcadm disable postgresql_84:default_64bit).
hint-switch-over-end =
    .lead = Prüfe: der Katalog online auf greenhouse, die alte Datenbank eingefroren, und die alten Daten und ihr Snapshot noch da.
    .solution = svcs seed-catalogue, zfs list -t snapshot, ls -ld /var/postgres/8.4/data_64 (sudo).
