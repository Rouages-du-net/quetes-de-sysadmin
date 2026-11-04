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
