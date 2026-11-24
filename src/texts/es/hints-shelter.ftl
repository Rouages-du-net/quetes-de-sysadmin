### Pistas graduales de «El Refugio» (ver src/engine/hints.ts): un mensaje
### por paso, hint-<capítulo>-<evento>, con .lead (una pista, sin el comando
### exacto) y .solution (casi la respuesta).

## Capítulo 1 — ¿Qué tenemos?

hint-what-we-have-paddock =
    .lead = El plan está en pradera; lo que describe funciona en cercado. Lee el plan, y luego ve a mirar (man ssh).
    .solution = cat /srv/drp/plan.md, luego ssh cercado
hint-what-we-have-units =
    .lead = Empieza por lo que ejecuta systemd en cercado: los servicios, cargados y activos (man systemctl, list-units).
    .solution = systemctl list-units --type=service
hint-what-we-have-timers =
    .lead = Lo que se ejecuta solo, con un horario: los temporizadores de systemd, y cron (man systemctl, list-timers; man crontab).
    .solution = systemctl list-timers, luego systemctl cat vetlink-sync.service
hint-what-we-have-sockets =
    .lead = Lo que escucha, y para quién: los sockets TCP en LISTEN, con su proceso (man ss).
    .solution = sudo ss -tlnp
hint-what-we-have-script =
    .lead = El plan dice que una tarea nocturna hace las copias: el temporizador nombra el servicio, el servicio nombra el script. ¿Qué copia?
    .solution = systemctl cat shelter-backup.service, luego cat /usr/local/sbin/shelter-backup
hint-what-we-have-snapshots =
    .lead = Lo que contiene de verdad el repositorio: sus instantáneas, sus rutas, sus fechas. La tarea conoce el repositorio y su archivo de contraseña (man restic).
    .solution = en cercado: sudo restic -r sftp:restic@pradera.internal:/srv/restic -p /root/.restic-pass snapshots
hint-what-we-have-rows =
    .lead = Reescribe la tabla del plan: una fila por servicio que funciona de verdad, un RPO que la tarea nocturna pueda cumplir, un RTO, su copia, un responsable que siga aquí.
    .solution = nano /srv/drp/plan.md: quita phpList, RPO 24h para la aplicación, añade | Fichas veterinarias (vetlink) | 24h | 2d | restic, cada noche | Mirela |, responsables Teuila, tú, Mirela.
hint-what-we-have-fixed =
    .lead = Las fichas de vetlink tienen que estar en la copia nocturna: su línea restic backup lista las rutas que toma.
    .solution = en cercado: sudo nano /usr/local/sbin/shelter-backup, añade /srv/vetlink a la línea restic backup.
hint-what-we-have-saved =
    .lead = La tarea solo se ejecuta a las 2:00. Hasta entonces vetlink sigue sin copia: una copia ahora cierra el hueco.
    .solution = en cercado: sudo /usr/local/sbin/shelter-backup (o sudo systemctl start shelter-backup.service)
hint-what-we-have-end =
    .lead = Cada servicio de la tabla necesita una instantánea más reciente que su RPO, y la tabla solo debe contener lo que funciona.
    .solution = Comprueba restic snapshots: la última contiene /srv/vetlink, y ningún RPO de la tabla es más corto que 24h.

## Capítulo 2 — Reconstruir en la de repuesto

hint-rebuild-haven =
    .lead = El mensaje de Teuila, el sobre y el orden de restauración del plan están en pradera; la máquina nueva se llama refugio.
    .solution = cat /srv/drp/plan.md, cat sobre.txt, luego ssh refugio
hint-rebuild-packages =
    .lead = El primer paso del plan en una máquina vacía: los paquetes que necesitan sus servicios, de Debian (man apt).
    .solution = sudo apt update, luego sudo apt install nginx postgresql
hint-rebuild-snapshots =
    .lead = La dirección del repositorio y la contraseña de recuperación están en el sobre; restic pide la contraseña cuando no se le da ninguna (man restic).
    .solution = sudo restic -r sftp:restic@pradera.internal:/srv/restic snapshots, luego la contraseña del sobre.
hint-rebuild-restored =
    .lead = Restaura la última instantánea al lado del sistema nuevo, nunca encima: --target nombra una carpeta vacía, restic recrea las rutas completas debajo.
    .solution = sudo restic -r sftp:restic@pradera.internal:/srv/restic restore latest --target /srv/restore
hint-rebuild-copied =
    .lead = De lo restaurado, copia solo lo que es de los refugios: el sitio, la aplicación, las fichas de vetlink (man cp).
    .solution = sudo cp -r /srv/restore/var/www/shelter /var/www/, sudo cp -r /srv/restore/srv/adopt /srv/restore/srv/vetlink /srv/
hint-rebuild-database =
    .lead = La base de datos vuelve desde el volcado de /srv/restore/var/backups: primero una base de datos vacía, luego el volcado leído en ella, como postgres (man createdb, man psql).
    .solution = sudo -u postgres createdb shelter, luego sudo -u postgres psql shelter -f /srv/restore/var/backups/shelter.sql
hint-rebuild-verified =
    .lead = La tarea registró el SHA-256 del volcado y las filas de cada tabla, junto al volcado: compara (man sha256sum, man psql).
    .solution = cd /srv/restore/var/backups && sha256sum -c shelter.sha256 (y sudo -u postgres psql shelter -c "SELECT count(*) FROM animals" frente a shelter.counts)
hint-rebuild-adopt =
    .lead = La unidad de la aplicación está en el /etc/systemd/system restaurado: ponla en su sitio, haz que systemd la lea, arráncala una vez que esté su base de datos (man systemctl).
    .solution = sudo cp /srv/restore/etc/systemd/system/adopt.service /etc/systemd/system/, sudo systemctl daemon-reload, sudo systemctl enable --now adopt
hint-rebuild-nginx =
    .lead = nginx necesita el archivo del sitio de los refugios, activado, su configuración comprobada, y luego una recarga (man nginx).
    .solution = sudo cp /srv/restore/etc/nginx/sites-available/shelter /etc/nginx/sites-available/, sudo ln -s /etc/nginx/sites-available/shelter /etc/nginx/sites-enabled/, sudo nginx -t, sudo systemctl reload nginx
hint-rebuild-vetlink =
    .lead = Las fichas veterinarias de Mirela también están en la instantánea, bajo /srv/vetlink.
    .solution = sudo cp -r /srv/restore/srv/vetlink /srv/
hint-rebuild-tested =
    .lead = Prueba en el propio refugio, pidiendo el sitio por su nombre y la aplicación detrás de /adopt/ (man curl, -H).
    .solution = curl -H "Host: www.hillsideshelters.example" http://localhost/adopt/animals
hint-rebuild-end =
    .lead = El orden de restauración del plan, hasta el final: el sitio, la aplicación sobre su base de datos comprobada, las fichas de vetlink, una prueba local.
    .solution = Comprueba con curl -H "Host: www.hillsideshelters.example" http://localhost/ y /adopt/animals en refugio.

## Capítulo 3 — Cambiar y aprender

hint-switch-and-learn-outside-closed =
    .lead = Antes de mover el nombre, comprueba desde aquí que la dirección pública de Riverbend responde con el sitio (man curl).
    .solution = curl -H "Host: www.hillsideshelters.example" http://203.0.113.163/
hint-switch-and-learn-opened =
    .lead = El cortafuegos de refugio solo deja entrar ssh: la web también tiene que pasar (man ufw).
    .solution = en refugio: sudo ufw allow 80/tcp (o sudo ufw allow "Nginx HTTP"), luego sudo ufw status
hint-switch-and-learn-outside =
    .lead = Ahora que refugio deja entrar la web, vuelve a comprobar desde pradera, a través de la dirección pública.
    .solution = curl -H "Host: www.hillsideshelters.example" http://203.0.113.163/adopt/animals
hint-switch-and-learn-zone =
    .lead = La zona está en pradera, en /etc/bind: la dirección de www cambia, y el serial también, antes de que named la recargue (man named-checkzone, man rndc).
    .solution = sudo nano /etc/bind/db.hillsideshelters.example: www → 203.0.113.163, serial 2031111401; sudo named-checkzone hillsideshelters.example /etc/bind/db.hillsideshelters.example; sudo rndc reload
hint-switch-and-learn-switched =
    .lead = Pregunta al servidor del registrador, al que pregunta el mundo: ¿sirve la dirección nueva (man dig)?
    .solution = dig @ns1.registrar.example www.hillsideshelters.example
hint-switch-and-learn-resolver =
    .lead = El resolutor público guarda lo que le dijeron durante el TTL: pregúntale, y otra vez unos minutos después.
    .solution = dig www.hillsideshelters.example (el TTL de la ANSWER va bajando)
hint-switch-and-learn-review =
    .lead = Rellena cada sección de revision.md: las horas de la cronología salen de los registros (sitewatch.log, las instantáneas, el diario de named); cada acción tiene un responsable; nadie a quien culpar.
    .solution = nano revision.md: Cronología con 02:00 (última copia), 02:50 (primera comprobación fallida), la hora del cambio; Acciones como «- Sacar el servidor del sótano (Wiremu)».
hint-switch-and-learn-drill =
    .lead = El script de Mirela solo lista las instantáneas. Un simulacro restaura al lado, comprueba lo que ha vuelto, y se ejecuta solo (man restic, man sha256sum, man crontab).
    .solution = sudo nano /usr/local/sbin/restore-drill: restic restore latest --target /tmp/drill --include /var/backups, luego cd /tmp/drill/var/backups && sha256sum -c shelter.sha256; sudo crontab -e: 0 4 1 * * /usr/local/sbin/restore-drill
hint-switch-and-learn-end =
    .lead = Todo a la vez: www servido desde refugio al mundo, comprobado desde fuera, la revisión escrita, el simulacro programado.
    .solution = dig @ns1.registrar.example www.hillsideshelters.example, curl desde pradera, revision.md completo, el simulacro en el crontab de root.
