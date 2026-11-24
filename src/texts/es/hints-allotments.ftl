### Pistas graduales de «Los Huertos» (ver src/engine/hints.ts): un mensaje
### por paso, hint-<capítulo>-<evento>, con .lead (una pista, sin el comando
### exacto) y .solution (casi la respuesta).

## Capítulo 1 — Conexiones dormidas

hint-sleeping-connections-crowd =
    .lead = ¿Quién retiene las conexiones de la base de datos? Abre MariaDB como el root del sistema y lista las conexiones (man mariadb).
    .solution = sudo mariadb -e "SHOW PROCESSLIST" | head; sudo mariadb -e "SHOW PROCESSLIST" | grep -c Sleep
hint-sleeping-connections-timeout =
    .lead = ¿Cuánto tiempo puede dormir una conexión antes de que el servidor la cierre? Mira las variables de tiempo de espera, y baja la correcta para el servidor en marcha.
    .solution = sudo mariadb -e "SHOW VARIABLES LIKE 'wait_timeout'"; sudo mariadb -e "SET GLOBAL wait_timeout = 300"
hint-sleeping-connections-cleared =
    .lead = Las conexiones ya abiertas conservan su antiguo tiempo de espera: lista sus id y termínalas.
    .solution = sudo mariadb -N -e "SELECT id FROM information_schema.PROCESSLIST WHERE command = 'Sleep' AND user = 'plotline'" | sudo xargs -n1 mariadb-admin kill (o KILL id; para cada una)
hint-sleeping-connections-persisted =
    .lead = SET GLOBAL dura hasta el próximo arranque: escribe el mismo valor donde el servidor lee su configuración al arrancar.
    .solution = sudo nano /etc/mysql/mariadb.conf.d/50-server.cnf: wait_timeout = 300 bajo [mariadbd]
hint-sleeping-connections-slow-log =
    .lead = Cada página de parcela también es lenta: pide a MariaDB que anote las consultas lentas (el registro de consultas lentas), y luego léelo.
    .solution = sudo mariadb -e "SET GLOBAL slow_query_log = ON; SET GLOBAL long_query_time = 1"; luego sudo tail /var/lib/mysql/paleta-slow.log (SHOW VARIABLES LIKE 'slow_query_log_file')
hint-sleeping-connections-explain =
    .lead = Pregunta a MariaDB cómo ejecuta esa consulta (EXPLAIN): ¿qué índice, cuántas filas?
    .solution = sudo mariadb plots -e "EXPLAIN SELECT * FROM bookings WHERE plot_id = 17 ORDER BY starts_on DESC"
hint-sleeping-connections-index =
    .lead = Dale a bookings un índice sobre la columna que filtra la cláusula WHERE (man mariadb: CREATE INDEX).
    .solution = sudo mariadb plots -e "CREATE INDEX idx_plot ON bookings (plot_id)"
hint-sleeping-connections-end =
    .lead = Compruébalo todo: el tiempo de espera en marcha y en el archivo, ninguna conexión dormida antigua, el índice, un max_connections sensato.
    .solution = sudo mariadb -e "SHOW PROCESSLIST"; grep -E 'wait_timeout|max_connections' /etc/mysql/mariadb.conf.d/50-server.cnf; sudo mariadb plots -e "SHOW INDEX FROM bookings"

## Capítulo 2 — Mínimo privilegio

hint-least-privilege-scan =
    .lead = Lee el informe de Selin: ¿qué puerto responde desde internet, y qué hay detrás?
    .solution = cat escaneo_de_selin.txt; sudo ss -tlnp | grep 3306
hint-least-privilege-accounts =
    .lead = Lista las cuentas de la base de datos, con la dirección desde la que puede venir cada una y cómo se autentica, y luego sus derechos.
    .solution = sudo mariadb -e "SELECT user, host, plugin FROM mysql.user"; sudo mariadb -e "SHOW GRANTS FOR 'root'@'%'"
hint-least-privilege-app-account =
    .lead = Crea una cuenta solo para la aplicación, desde la dirección de barrow, con solo las sentencias que ejecuta sobre plots (man mariadb: CREATE USER, GRANT).
    .solution = sudo mariadb -e "CREATE USER 'app'@'198.51.100.134' IDENTIFIED BY 'una-contrasena-larga-y-nueva'; GRANT SELECT, INSERT, UPDATE, DELETE ON plots.* TO 'app'@'198.51.100.134'"
hint-least-privilege-app-switched =
    .lead = En barrow, pon la nueva cuenta de la aplicación en su configuración, y luego reiníciala para que la lea. Comprueba su registro.
    .solution = ssh barrow; sudo nano /srv/plotline/.env (DB_USER=app, DB_PASSWORD=…); sudo systemctl restart plotline; sudo tail /var/log/plotline/app.log
hint-least-privilege-root-local =
    .lead = Ya nadie necesita root desde la red: quita esa cuenta, y conserva root@localhost con unix_socket.
    .solution = sudo mariadb -e "DROP USER 'root'@'%'"; sudo mariadb -e "SHOW GRANTS FOR 'root'@'localhost'"
hint-least-privilege-cleanup =
    .lead = Quita lo que nadie usa: las cuentas anónimas, la base de datos test y sus permisos, la cuenta del antiguo servidor shed (mariadb-secure-installation hace una parte).
    .solution = sudo mariadb-secure-installation (responde Y), luego sudo mariadb -e "DROP USER 'plotline'@'198.51.100.133'"
hint-least-privilege-network =
    .lead = MariaDB escucha en todas las direcciones: haz que escuche solo en la red interna (bind-address, y luego un reinicio), o deja entrar solo a la red interna con el cortafuegos.
    .solution = sudo nano /etc/mysql/mariadb.conf.d/50-server.cnf: bind-address = 198.51.100.131; sudo systemctl restart mariadb; sudo ss -tlnp | grep 3306
hint-least-privilege-end =
    .lead = Comprueba el conjunto: el registro de la aplicación en barrow, las cuentas y sus permisos, dónde escucha MariaDB.
    .solution = sudo mariadb -e "SELECT user, host, plugin FROM mysql.user"; sudo ss -tlnp; ssh barrow sudo tail -n 3 /var/log/plotline/app.log

## Capítulo 3 — La réplica rota

hint-broken-replica-stopped =
    .lead = Ve a rake y pide a la réplica su estado: ¿qué hilo funciona, cuál se paró, y por qué?
    .solution = ssh rake; sudo mariadb -e "SHOW REPLICA STATUS\G"
hint-broken-replica-cause =
    .lead = El error nombra una tabla y un id: mira esa fila en rake, y luego en paleta.
    .solution = sudo mariadb plots -e "SELECT * FROM waitlist WHERE id = 1043" (en rake, luego en paleta)
hint-broken-replica-read-only =
    .lead = Primero impide que nadie vuelva a escribir en rake (man mariadb: read_only).
    .solution = en rake: sudo mariadb -e "SET GLOBAL read_only = ON"
hint-broken-replica-read-only-kept =
    .lead = Haz que sobreviva a un reinicio: la configuración de rake tiene una línea preparada para ello.
    .solution = en rake: sudo nano /etc/mysql/mariadb.conf.d/50-server.cnf: read_only = ON (sin comentar)
hint-broken-replica-repaired =
    .lead = Quita la fila intrusa en rake (rake debe contener lo que envía paleta), luego vuelve a arrancar el hilo SQL y mira cómo se pone al día.
    .solution = en rake: sudo mariadb plots -e "DELETE FROM waitlist WHERE id = 1043"; sudo mariadb -e "START REPLICA"; sudo mariadb -e "SHOW REPLICA STATUS\G" | grep -E 'Running|Behind|Error'
hint-broken-replica-identical =
    .lead = Demuestra que los dos servidores tienen las mismas filas: calcula las sumas de comprobación de las tablas en cada uno.
    .solution = sudo mariadb -e "CHECKSUM TABLE plots.members, plots.plots, plots.waitlist, plots.bookings" (en paleta y en rake)
hint-broken-replica-jun =
    .lead = La fila de Esi se perdió de rake: vuelve a añadirla, donde van las escrituras.
    .solution = en paleta: sudo mariadb plots -e "INSERT INTO waitlist (name, email, wants, added_on) VALUES ('Esi Boateng', 'esi.boateng@mail.example', 'half', '2031-05-31')"
hint-broken-replica-script =
    .lead = El volcado nocturno lee las tablas sin una instantánea coherente: arregla la línea mariadb-dump del script (man mariadb-dump).
    .solution = en rake: sudo nano /usr/local/sbin/plots-backup: mariadb-dump --single-transaction plots > …
hint-broken-replica-backup =
    .lead = Haz una copia de seguridad ahora, como la hará el script.
    .solution = en rake: sudo /usr/local/sbin/plots-backup (o sudo mariadb-dump --single-transaction plots > /var/backups/mariadb/plots-check.sql)
hint-broken-replica-restored =
    .lead = Restaura ese volcado en una base de datos provisional en rake, y luego compárala con plots.
    .solution = en rake: sudo mariadb -e "CREATE DATABASE restore_check"; sudo sh -c 'mariadb restore_check < /var/backups/mariadb/plots-2031-06-02.sql'; sudo mariadb -e "CHECKSUM TABLE restore_check.waitlist, plots.waitlist"
hint-broken-replica-end =
    .lead = Comprueba el conjunto: read_only en rake (ahora y en su archivo), el estado de la réplica, las sumas de comprobación, Esi en paleta, el script, un volcado restaurado.
    .solution = en rake: sudo mariadb -e "SELECT @@read_only"; sudo mariadb -e "SHOW REPLICA STATUS\G" | grep -E 'Running|Behind'
