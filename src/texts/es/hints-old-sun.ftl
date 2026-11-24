### Pistas graduales de El Viejo Sun (ver src/engine/hints.ts): un mensaje
### por paso, hint-<capítulo>-<evento>, con .lead (una dirección) y .solution
### (casi la respuesta).

## Capítulo 1 — Leer antes de tocar

hint-read-first-smf =
    .lead = Aquí no hay systemd: los servicios de Solaris 10 los gestiona SMF. Lístalos (man svcs).
    .solution = svcs (y svcs -x para lo que está roto): svc:/application/database/postgresql_84:default_64bit ejecuta la base de datos.
hint-read-first-data-dir =
    .lead = Un servicio SMF tiene propiedades: una de ellas dice dónde guarda PostgreSQL sus datos (man svcprop).
    .solution = svcprop -p postgresql_84/data postgresql_84:default_64bit (o ps -ef: el -D del proceso postgres).
hint-read-first-zfs =
    .lead = Los discos están en ZFS: ¿qué dataset contiene ese directorio? (man zfs)
    .solution = zfs list: data/postgres está montado en /var/postgres.
hint-read-first-encoding =
    .lead = La base de datos en sí: su nombre, su juego de caracteres. psql puede listar las bases (con la cuenta postgres).
    .solution = sudo -u postgres psql -l: seeds, en LATIN1. Su versión: SELECT version().
hint-read-first-snapshot =
    .lead = Antes de cualquier cambio, una red de seguridad que se hace en un instante: ZFS puede congelar un dataset (man zfs, snapshot).
    .solution = sudo zfs snapshot data/postgres@before-migration, luego zfs list -t snapshot.
hint-read-first-end =
    .lead = Completa migration.md: el servicio (postgresql_84), el directorio de datos y su dataset, la base (seeds), su versión (8.4) y su juego de caracteres (LATIN1).
    .solution = nano migration.md: svc:/application/database/postgresql_84:default_64bit; /var/postgres/8.4/data_64 en data/postgres; seeds, PostgreSQL 8.4, LATIN1; data/postgres@before-migration.

## Capítulo 2 — Bytes en el orden equivocado

hint-byte-order-stopped =
    .lead = Antes de copiar nada, para lo que escribe en la base: el catálogo también es un servicio SMF (man svcadm).
    .solution = sudo svcadm disable seed-catalogue, luego svcs seed-catalogue (disabled).
hint-byte-order-restored =
    .lead = Los archivos de datos no viajan a otra versión ni a otro procesador; un volcado sí (man pg_dump). Luego cópialo a greenhouse, crea allí la base y reprodúcelo con psql.
    .solution = sudo -u postgres pg_dump seeds > seeds.sql; scp seeds.sql greenhouse:; ssh greenhouse; sudo -u postgres createdb -O catalogue seeds; sudo -u postgres psql -d seeds -f seeds.sql.
hint-byte-order-end =
    .lead = Comprueba en greenhouse: los mismos recuentos que en herbario, y los acentos (SELECT name FROM varieties). El � de cat es la terminal, no los datos.
    .solution = sudo -u postgres psql -d seeds -c "SELECT name FROM varieties". Si ves Ã©: sudo -u postgres dropdb seeds, otra vez createdb, y reproduce el volcado original, sin tocar.

## Capítulo 3 — Confiar, y luego cambiar

hint-switch-over-counted =
    .lead = Antes de cambiar, demuestra que las dos bases coinciden: cuenta las filas en greenhouse y en herbario.
    .solution = En greenhouse: sudo -u postgres psql -d seeds -c "SELECT count(*) FROM lendings"; lo mismo en herbario.
hint-switch-over-online =
    .lead = El catálogo lee la dirección de su base en su archivo de configuración al arrancar (svcprop seed-catalogue dice qué archivo).
    .solution = sudo nano /etc/opt/seed-catalogue/catalogue.ini: db_host = greenhouse.internal; luego sudo svcadm enable seed-catalogue.
hint-switch-over-frozen =
    .lead = Conserva la base vieja, pero asegúrate de que ya nada puede escribir en ella (un parámetro de la base, o parar su servicio).
    .solution = sudo -u postgres psql -c "ALTER DATABASE seeds SET default_transaction_read_only = on" (o sudo svcadm disable postgresql_84:default_64bit).
hint-switch-over-end =
    .lead = Comprueba: el catálogo en línea en greenhouse, la base vieja congelada, y los datos viejos y su instantánea todavía ahí.
    .solution = svcs seed-catalogue, zfs list -t snapshot, ls -ld /var/postgres/8.4/data_64 (sudo).
