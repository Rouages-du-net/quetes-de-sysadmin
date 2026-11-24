### Pistas graduales de El Otro Unix (ver src/engine/hints.ts): un mensaje
### por paso, hint-<capítulo>-<evento>, con .lead (una dirección) y .solution
### (casi la respuesta).

## Capítulo 1 — El script que se rompió

hint-portable-script-not-found =
    .lead = Ejecuta el script y lee lo que responde el sistema (./nightly-backup.sh). Luego mira su primera línea.
    .solution = ./nightly-backup.sh dice «not found»: su primera línea, #!/bin/bash, nombra un intérprete que FreeBSD no tiene. nano nightly-backup.sh, y cámbiala por #!/bin/sh.
hint-portable-script-date =
    .lead = Ahora el script se detiene en date. Este date no es el de Debian: lee SU manual (man date) para obtener el día de ayer.
    .solution = Sustituye date -d yesterday por date -v-1d (en nano), conservando +%F.
hint-portable-script-stat =
    .lead = Luego viene stat: man stat en esta máquina dice qué opción recibe un formato, y cómo pedir el tamaño.
    .solution = Sustituye stat -c %s por stat -f %z.
hint-portable-script-sed =
    .lead = Por último, sed -i: en BSD, -i siempre quiere una palabra detrás (man sed).
    .solution = Escribe sed -i '' "s/^last=.*/last=$DAY/" /var/backups/state.conf (el '' es un sufijo vacío: sin copia de seguridad).
hint-portable-script-end =
    .lead = Ejecuta el script hasta el final: el archivo comprimido de ayer debe estar en /var/backups, y state.conf debe decir last=2029-10-05.
    .solution = ./nightly-backup.sh, luego ls -l /var/backups y cat /var/backups/state.conf.

## Capítulo 2 — Aquí no hay systemd

hint-rc-services-installed =
    .lead = Aquí no hay apt: FreeBSD tiene su propio gestor de paquetes (man pkg).
    .solution = sudo pkg install nginx (responde y).
hint-rc-services-not-enabled =
    .lead = Los servicios se manejan con service (man service): intenta arrancar nginx.
    .solution = sudo service nginx start (y lee por qué se niega).
hint-rc-services-enabled =
    .lead = El mensaje nombra la variable de rc.conf. sysrc la escribe por ti (man sysrc).
    .solution = sudo sysrc nginx_enable=YES (o sudo service nginx enable).
hint-rc-services-end =
    .lead = Arráncalo ahora y comprueba que escucha en el puerto 80 (man sockstat).
    .solution = sudo service nginx start, luego sockstat -4l.

## Capítulo 3 — Gana la última regla

hint-last-rule-checked =
    .lead = Lee /etc/pf.conf y compruébalo sin cargarlo (man pfctl).
    .solution = cat /etc/pf.conf, luego sudo pfctl -nf /etc/pf.conf.
hint-last-rule-on =
    .lead = En pf decide la ÚLTIMA regla que coincide (man pf.conf). Pon las reglas en el orden de pf antes de activarlo.
    .solution = sudo nano /etc/pf.conf: primero «block in all», luego «pass in proto tcp to port {"{"} 22 80 {"}"}», luego «pass out all keep state». Después sudo sysrc pf_enable=YES y sudo service pf start.
hint-last-rule-end =
    .lead = pf debe arrancar al inicio, con las reglas del archivo: comprueba lo que está en vigor (pfctl -sr) y, desde tu puesto, qué responde (nc -zv).
    .solution = sudo pfctl -f /etc/pf.conf tras cada cambio, sudo pfctl -sr; exit, luego nc -zv proyector 3306 (no debe responder) y nc -zv proyector 80.
