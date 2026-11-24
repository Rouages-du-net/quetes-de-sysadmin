### Las pistas graduadas de la historia «El Observatorio»: una dirección, y
### luego casi la respuesta, para cada paso (ver src/engine/hints.ts).

## Capítulo 1 — Carga pesada

hint-heavy-load-load =
    .lead = ¿Cómo de ocupada está la máquina? (man uptime: la carga media; man nproc: cuántas CPU)
    .solution = uptime da una carga de unos 9; nproc dice 2 CPU: siete procesos esperan una CPU en todo momento.
hint-heavy-load-workers =
    .lead = ¿Quién se lleva la CPU? (man top, man ps)
    .solution = top: ocho procesos stack-worker de jules, cada uno a un 22 %, y la galería (node) con la misma parte.
hint-heavy-load-end =
    .lead = Da a los procesos de trabajo una prioridad más baja, a todos, sin pararlos (man renice: -n, -p, -u). Luego cronometra la galería como lo hace Amara.
    .solution = sudo renice -n 19 -u jules, y luego curl -s -o /dev/null -w '%{"{"}time_total{"}"}\n' http://localhost:8080/

## Capítulo 2 — La cuota

hint-quota-measure =
    .lead = ¿Cuánta CPU se lleva el apilado esta mañana, con nice o sin él? (man top, man systemd-cgtop)
    .solution = top: los ocho procesos de trabajo en NI 19 se llevan casi todo de las dos CPU; systemd-cgtop muestra stacking.service cerca del 200 %.
hint-quota-end =
    .lead = Nice no pone techo: systemd puede limitar el tiempo de CPU de un servicio (man systemd.resource-control: CPUQuota=). El 40 % de dos CPU es ¿qué porcentaje de UNA?
    .solution = sudo systemctl set-property stacking CPUQuota=80% (se aplica enseguida, se guarda en disco), y luego systemd-cgtop.

## Capítulo 3 — Demasiados archivos abiertos

hint-too-many-files-emfile =
    .lead = ¿Qué dice la galería cuando falla el archivo? (man journalctl: -u)
    .solution = journalctl -u gallery: «Error: EMFILE: too many open files».
hint-too-many-files-limits =
    .lead = ¿Cuál es el límite del proceso de la galería, no el de tu shell? (man proc: /proc/PID/limits; man prlimit)
    .solution = cat /proc/840/limits: Max open files 1024 (blando), 524288 (duro). O sudo prlimit --pid 840 --nofile.
hint-too-many-files-end =
    .lead = Un servicio recibe sus límites de systemd, cuando arranca (man systemd.exec: LimitNOFILE=).
    .solution = sudo systemctl edit gallery: {"["}Service] LimitNOFILE=4096; luego sudo systemctl restart gallery, y curl -i http://localhost:8080/archive.

## Capítulo 4 — El proceso atascado

hint-stuck-process-stuck =
    .lead = ¿Qué procesos forman la copia, y quién lanzó a quién? (man ps: -ef, la columna PPID)
    .solution = ps -ef: /bin/bash /usr/local/bin/sync-photos (3301), y su hijo rsync (3302).
hint-stuck-process-ignored =
    .lead = kill envía TERM. ¿La acepta el script? Léelo (cat /usr/local/bin/sync-photos), y busca las señales que nada puede ignorar (man 7 signal).
    .solution = El script tiene trap '' INT TERM HUP: sudo kill -KILL 3301 (o kill -9).
hint-stuck-process-end =
    .lead = Tras KILL: ¿qué queda de la copia, y qué no le dio tiempo a limpiar al script? (ps -ef, el LOCK del script)
    .solution = sudo kill sobre el rsync que queda, comprueba con ps -p 3301 que el script ya no está, y luego sudo rm /run/sync-photos.pid.
