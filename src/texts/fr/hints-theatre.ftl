### Les indices gradués de l'histoire « Le Théâtre » : une piste, puis
### presque la réponse, pour chaque étape (voir src/engine/hints.ts).

## Chapitre 1 — Soir de première

hint-too-many-clients-full =
    .lead = Que dit la billetterie quand elle échoue ? (man journalctl : -u ; le journal du serveur est dans /var/log/postgresql)
    .solution = journalctl -u boxoffice : « remaining connection slots are reserved for roles with the SUPERUSER attribute ».
hint-too-many-clients-idle =
    .lead = Qui tient les connexions, et à faire quoi ? Le superutilisateur peut encore entrer (man psql : pg_stat_activity).
    .solution = sudo -u postgres psql -c "SELECT pid, state, state_change, query FROM pg_stat_activity" : 15 connexions « idle in transaction ».
hint-too-many-clients-end =
    .lead = PostgreSQL peut terminer lui-même les sessions restées inactives dans une transaction (man psql : SHOW, ALTER SYSTEM, pg_reload_conf).
    .solution = sudo -u postgres psql -c "ALTER SYSTEM SET idle_in_transaction_session_timeout = '1min'", puis sudo -u postgres psql -c "SELECT pg_reload_conf()".

## Chapitre 2 — La Requête lente

hint-slow-query-slow =
    .lead = Quelle requête est lente ? Le journal de l'appli et celui de PostgreSQL le disent (man journalctl).
    .solution = journalctl -u boxoffice : « slow query (4812 ms): SELECT seat, status FROM bookings WHERE show_id = 42 ».
hint-slow-query-seqscan =
    .lead = Comment PostgreSQL exécute-t-il cette requête ? (man psql : EXPLAIN, EXPLAIN ANALYZE)
    .solution = sudo -u postgres psql -d boxoffice -c "EXPLAIN ANALYZE SELECT seat, status FROM bookings WHERE show_id = 42" : Parallel Seq Scan, 480 000 lignes lues.
hint-slow-query-end =
    .lead = Donne à PostgreSQL un moyen de trouver les lignes d'un spectacle sans lire toute la table (man psql : CREATE INDEX).
    .solution = sudo -u postgres psql -d boxoffice -c "CREATE INDEX ON bookings (show_id)", puis EXPLAIN de nouveau : Index Scan.

## Chapitre 3 — Lecture seule

hint-read-only-account =
    .lead = Quel compte utilise l'outil, et que peut faire ce compte ? (la configuration de l'outil ; man psql : \du, \dp)
    .solution = sudo cat /etc/ticket-stats/config.env : DATABASE_URL=postgres://boxoffice:…, le propriétaire de toutes les tables.
hint-read-only-role =
    .lead = Crée un compte qui peut se connecter, et donne-lui le droit de lire, rien d'autre (man psql : CREATE ROLE, GRANT).
    .solution = sudo -u postgres psql -d boxoffice -c "CREATE ROLE stats LOGIN PASSWORD 'a-choisir'; GRANT SELECT ON ALL TABLES IN SCHEMA public TO stats"
hint-read-only-end =
    .lead = Les tables à venir ont besoin de privilèges par défaut, pour le rôle qui les créera (man psql : ALTER DEFAULT PRIVILEGES). Puis la configuration de l'outil, et son redémarrage.
    .solution = sudo -u postgres psql -d boxoffice -c "ALTER DEFAULT PRIVILEGES FOR ROLE boxoffice IN SCHEMA public GRANT SELECT ON TABLES TO stats; GRANT SELECT ON donations TO stats", puis stats et son mot de passe dans /etc/ticket-stats/config.env, et sudo systemctl restart ticket-stats.

## Chapitre 4 — La Bascule

hint-failover-down =
    .lead = Que dit la billetterie, et stage répond-elle encore ? (man journalctl ; man pg_isready : -h)
    .solution = journalctl -u boxoffice : « connect EHOSTUNREACH 192.0.2.29:5432 » ; pg_isready -h stage.internal : no response.
hint-failover-standby =
    .lead = Et le PostgreSQL de cette machine, qu'est-ce que c'est ? (man pg_lsclusters ; man psql : pg_is_in_recovery, pg_last_xact_replay_timestamp)
    .solution = pg_lsclusters : 16 main, online,recovery : un réplica, qui a rejoué tout jusqu'à 06:47:14.
hint-failover-end =
    .lead = Fais du réplica le principal (man pg_ctlcluster : promote), puis envoie l'appli vers lui (son .env) et redémarre-la.
    .solution = sudo pg_ctlcluster 16 main promote, puis DATABASE_URL=postgres://boxoffice:…@localhost/boxoffice dans /srv/boxoffice/.env, et sudo systemctl restart boxoffice.
