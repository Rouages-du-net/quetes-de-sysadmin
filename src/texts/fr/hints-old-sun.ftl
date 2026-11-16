### Indices gradués du vieux Soleil (voir src/engine/hints.ts) : un message
### par étape, hint-<chapitre>-<événement>, avec .lead (une piste) et
### .solution (presque la réponse).

## Chapitre 1 — Lire avant de toucher

hint-read-first-smf =
    .lead = Pas de systemd ici : les services de Solaris 10 sont gérés par SMF. Liste-les (man svcs).
    .solution = svcs (et svcs -x pour ce qui est cassé) : svc:/application/database/postgresql_84:default_64bit fait tourner la base.
hint-read-first-data-dir =
    .lead = Un service SMF a des propriétés : l'une d'elles dit où PostgreSQL range ses données (man svcprop).
    .solution = svcprop -p postgresql_84/data postgresql_84:default_64bit (ou ps -ef : le -D du processus postgres).
hint-read-first-zfs =
    .lead = Les disques sont en ZFS : quel jeu de données contient ce répertoire ? (man zfs)
    .solution = zfs list : data/postgres est monté sur /var/postgres.
hint-read-first-encoding =
    .lead = La base elle-même : son nom, son jeu de caractères. psql sait lister les bases (avec le compte postgres).
    .solution = sudo -u postgres psql -l : seeds, en LATIN1. Sa version : SELECT version().
hint-read-first-snapshot =
    .lead = Avant tout changement, un filet de sécurité qui prend un instant : ZFS sait figer un jeu de données (man zfs, snapshot).
    .solution = sudo zfs snapshot data/postgres@before-migration, puis zfs list -t snapshot.
hint-read-first-end =
    .lead = Complète migration.md : le service (postgresql_84), le répertoire de données et son jeu de données, la base (seeds), sa version (8.4) et son jeu de caractères (LATIN1).
    .solution = nano migration.md : svc:/application/database/postgresql_84:default_64bit ; /var/postgres/8.4/data_64 sur data/postgres ; seeds, PostgreSQL 8.4, LATIN1 ; data/postgres@before-migration.

## Chapitre 2 — Les octets à l'envers

hint-byte-order-stopped =
    .lead = Avant de copier quoi que ce soit, arrête ce qui écrit dans la base : le catalogue est un service SMF lui aussi (man svcadm).
    .solution = sudo svcadm disable seed-catalogue, puis svcs seed-catalogue (disabled).
hint-byte-order-restored =
    .lead = Les fichiers de données ne voyagent pas vers une autre version ou un autre processeur ; une sauvegarde logique, si (man pg_dump). Copie-la ensuite sur greenhouse, crée la base et rejoue-la avec psql.
    .solution = sudo -u postgres pg_dump seeds > seeds.sql ; scp seeds.sql greenhouse: ; ssh greenhouse ; sudo -u postgres createdb -O catalogue seeds ; sudo -u postgres psql -d seeds -f seeds.sql.
hint-byte-order-end =
    .lead = Vérifie sur greenhouse : les mêmes nombres de lignes que sur herbier, et les accents (SELECT name FROM varieties). Les � de cat viennent du terminal, pas des données.
    .solution = sudo -u postgres psql -d seeds -c "SELECT name FROM varieties". Si tu vois Ã© : sudo -u postgres dropdb seeds, recrée la base, et rejoue la sauvegarde d'origine, intacte.

## Chapitre 3 — Vérifier, puis basculer

hint-switch-over-counted =
    .lead = Avant de basculer, prouve que les deux bases sont d'accord : compte les lignes sur greenhouse et sur herbier.
    .solution = Sur greenhouse : sudo -u postgres psql -d seeds -c "SELECT count(*) FROM lendings" ; la même chose sur herbier.
hint-switch-over-online =
    .lead = Le catalogue lit l'adresse de sa base dans son fichier de configuration quand il démarre (svcprop seed-catalogue dit lequel).
    .solution = sudo nano /etc/opt/seed-catalogue/catalogue.ini : db_host = greenhouse.internal ; puis sudo svcadm enable seed-catalogue.
hint-switch-over-frozen =
    .lead = Garde l'ancienne base, mais assure-toi que plus rien ne peut y écrire (un réglage de la base, ou l'arrêt de son service).
    .solution = sudo -u postgres psql -c "ALTER DATABASE seeds SET default_transaction_read_only = on" (ou sudo svcadm disable postgresql_84:default_64bit).
hint-switch-over-end =
    .lead = Vérifie : le catalogue en ligne sur greenhouse, l'ancienne base figée, et les anciennes données et leur instantané toujours là.
    .solution = svcs seed-catalogue, zfs list -t snapshot, ls -ld /var/postgres/8.4/data_64 (sudo).
