### Las pistas graduadas de la historia «El Teatro»: una dirección, y luego
### casi la respuesta, para cada paso (ver src/engine/hints.ts).

## Capítulo 1 — Noche de estreno

hint-too-many-clients-full =
    .lead = ¿Qué dice la taquilla cuando falla? (man journalctl: -u; el registro del servidor está en /var/log/postgresql)
    .solution = journalctl -u boxoffice: «remaining connection slots are reserved for roles with the SUPERUSER attribute».
hint-too-many-clients-idle =
    .lead = ¿Quién retiene las conexiones, y haciendo qué? El superusuario todavía puede entrar (man psql: pg_stat_activity).
    .solution = sudo -u postgres psql -c "SELECT pid, state, state_change, query FROM pg_stat_activity": 15 conexiones «idle in transaction».
hint-too-many-clients-end =
    .lead = PostgreSQL puede terminar por sí solo las sesiones que se quedan inactivas dentro de una transacción (man psql: SHOW, ALTER SYSTEM, pg_reload_conf).
    .solution = sudo -u postgres psql -c "ALTER SYSTEM SET idle_in_transaction_session_timeout = '1min'", y luego sudo -u postgres psql -c "SELECT pg_reload_conf()".

## Capítulo 2 — La consulta lenta

hint-slow-query-slow =
    .lead = ¿Qué consulta es lenta? El journal de la aplicación y el registro de PostgreSQL lo dicen (man journalctl).
    .solution = journalctl -u boxoffice: «slow query (4812 ms): SELECT seat, status FROM bookings WHERE show_id = 42».
hint-slow-query-seqscan =
    .lead = ¿Cómo ejecuta PostgreSQL esta consulta? (man psql: EXPLAIN, EXPLAIN ANALYZE)
    .solution = sudo -u postgres psql -d boxoffice -c "EXPLAIN ANALYZE SELECT seat, status FROM bookings WHERE show_id = 42": Parallel Seq Scan, 480 000 filas leídas.
hint-slow-query-end =
    .lead = Dale a PostgreSQL una manera de encontrar las filas de un espectáculo sin leer la tabla entera (man psql: CREATE INDEX).
    .solution = sudo -u postgres psql -d boxoffice -c "CREATE INDEX ON bookings (show_id)", y luego otra vez EXPLAIN: Index Scan.

## Capítulo 3 — Solo lectura

hint-read-only-account =
    .lead = ¿Qué cuenta usa la herramienta, y qué puede hacer esa cuenta? (la configuración de la herramienta; man psql: \du, \dp)
    .solution = sudo cat /etc/ticket-stats/config.env: DATABASE_URL=postgres://boxoffice:…, el dueño de todas las tablas.
hint-read-only-role =
    .lead = Crea una cuenta que pueda conectarse, y dale el derecho de leer, nada más (man psql: CREATE ROLE, GRANT).
    .solution = sudo -u postgres psql -d boxoffice -c "CREATE ROLE stats LOGIN PASSWORD 'elige-una'; GRANT SELECT ON ALL TABLES IN SCHEMA public TO stats"
hint-read-only-end =
    .lead = Las tablas que están por venir necesitan privilegios por defecto, para el rol que las creará (man psql: ALTER DEFAULT PRIVILEGES). Luego la configuración de la herramienta, y su reinicio.
    .solution = sudo -u postgres psql -d boxoffice -c "ALTER DEFAULT PRIVILEGES FOR ROLE boxoffice IN SCHEMA public GRANT SELECT ON TABLES TO stats; GRANT SELECT ON donations TO stats", luego stats y su contraseña en /etc/ticket-stats/config.env, y sudo systemctl restart ticket-stats.

## Capítulo 4 — La conmutación

hint-failover-down =
    .lead = ¿Qué dice la taquilla, y sigue respondiendo stage? (man journalctl; man pg_isready: -h)
    .solution = journalctl -u boxoffice: «connect EHOSTUNREACH 192.0.2.29:5432»; pg_isready -h stage.internal: no response.
hint-failover-standby =
    .lead = ¿Y el PostgreSQL de esta máquina, qué es? (man pg_lsclusters; man psql: pg_is_in_recovery, pg_last_xact_replay_timestamp)
    .solution = pg_lsclusters: 16 main, online,recovery: un standby, que lo reprodujo todo hasta las 06:47:14.
hint-failover-end =
    .lead = Convierte el standby en primario (man pg_ctlcluster: promote), y luego manda allí la aplicación (su .env) y reiníciala.
    .solution = sudo pg_ctlcluster 16 main promote, luego DATABASE_URL=postgres://boxoffice:…@localhost/boxoffice en /srv/boxoffice/.env, y sudo systemctl restart boxoffice.
