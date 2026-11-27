### Pistas graduales de De Guardia (ver src/engine/hints.ts): un mensaje por
### paso, hint-<capítulo>-<evento>, con .lead (una pista, sin el comando
### exacto) y .solution (casi la respuesta). Los nombres de lugares, como en
### names.ftl.

## Capítulo 1 — El disco lleno

hint-full-disk-full =
    .lead = Zoé habla de un disco lleno. Antes de buscar nada, comprueba lo ocupados que están los sistemas de archivos (man df, la opción que muestra tamaños legibles).
    .solution = df -h (/ está al 100 %)
hint-full-disk-culprit =
    .lead = ¿Qué ocupa el espacio? du mide, carpeta a carpeta: empieza por los registros, en /var/log, y luego baja donde pese.
    .solution = sudo du -sh /var/log/* (la contraseña está en el mensaje de Zoé), luego sudo du -sh /var/log/radio/*: stream.log pesa más de 15 GB.
hint-full-disk-debug =
    .lead = Antes de borrar este registro enorme, mira lo que contiene: sus últimas líneas te dicen por qué crece tan rápido.
    .solution = sudo tail /var/log/radio/stream.log (líneas DEBUG por cada paquete)
hint-full-disk-breathes =
    .lead = Hay que devolver el espacio, pero rm no basta: el repetidor mantiene el archivo abierto. Vacíalo sin borrarlo (man truncate), o reinicia el programa que lo tiene.
    .solution = sudo truncate -s 0 /var/log/radio/stream.log (luego df -h para comprobarlo; si ya lo borraste: sudo systemctl restart radio-stream)
hint-full-disk-end =
    .lead = Para que no vuelva a pasar: vuelve a poner el nivel de registro normal en /etc/radio/stream.conf (el repetidor solo lo vuelve a leer al arrancar), y deja el registro en manos de logrotate, en /etc/logrotate.d, con una manera de hacerle reabrir el archivo (man logrotate).
    .solution = sudo nano /etc/radio/stream.conf (loglevel = info), sudo systemctl restart radio-stream, luego sudo nano /etc/logrotate.d/radio: /var/log/radio/*.log {"{"} daily, rotate 7, compress, missingok, copytruncate {"}"} (una directiva por línea; sudo logrotate -d /etc/logrotate.d/radio para comprobarlo).

## Capítulo 2 — La memoria

hint-memory-oom =
    .lead = La lista se ha parado sola. ¿Qué dice de ella systemctl status? ¿Y el registro del kernel, que guarda la pista de los procesos que ha tenido que matar?
    .solution = systemctl status radio-playlist (Result: oom-kill), luego sudo dmesg -T (Out of memory: Killed process…)
hint-memory-zombies =
    .lead = Mira la lista de todos los procesos y su estado: algunos están marcados <defunct>. La columna PPID te dice quién es su padre.
    .solution = ps -ef (o ps aux): zombis [convertir] <defunct>, hijos del PID 2305 (el servicio radio-podcast)
hint-memory-contained =
    .lead = La lista tiene una fuga: reiniciada tal cual, vuelve a crecer. systemd puede limitar la memoria de un servicio y reiniciarlo si muere, con un override (man systemctl: edit; man systemd.resource-control: MemoryMax=). Luego mírala crecer con top.
    .solution = sudo systemctl edit radio-playlist, escribe [Service] y luego MemoryMax=600M y Restart=on-failure; sudo systemctl start radio-playlist, y luego top (o free -h) varias veces: systemd la mata y la reinicia.
hint-memory-without-zombies =
    .lead = Un zombi no se puede matar: ya está muerto. Solo su padre puede hacerlo desaparecer, o desaparecer él mismo (init recoge entonces a los zombis).
    .solution = sudo systemctl restart radio-podcast (el servicio del padre, PID 2305)
hint-memory-end =
    .lead = Para terminar, hace falta todo a la vez: la lista en marcha, un límite de memoria razonable (unos cientos de MB), un reinicio automático, ningún zombi, y el repetidor activo. Si escribiste un archivo de unidad a mano, systemd tiene que volver a leerlo.
    .solution = systemctl status radio-playlist (Memory … max), ps aux sin <defunct>; tras un archivo escrito a mano: sudo systemctl daemon-reload, y luego sudo systemctl start radio-playlist

## Capítulo 3 — Los inodos

hint-inodes-almost-empty =
    .lead = Otra vez «No space left on device»: empieza por comprobar el espacio libre del volumen de datos, /srv/radio.
    .solution = df -h (/srv/radio está casi vacío)
hint-inodes-more-inodes =
    .lead = El espacio no es el único recurso de un sistema de archivos: cada archivo necesita un inodo, y su número es fijo. Una opción de df los cuenta (man df).
    .solution = df -i (o df -ih): el 100 % de los inodos de /srv/radio están ocupados
hint-inodes-culprit =
    .lead = ¿Quién ha creado tantos archivos? du puede contar inodos en lugar de bytes (man du), carpeta a carpeta.
    .solution = sudo du --inodes -d 1 /srv/radio (la carpeta stats contiene más de 65 000 archivos)
hint-inodes-restarts =
    .lead = Zoé quiere conservar los últimos 30 días. rm * fallará (demasiados argumentos); find recorre la carpeta él mismo, elige archivos por su edad y puede borrarlos (man find: -mtime, -delete).
    .solution = sudo find /srv/radio/stats -type f -mtime +30 -delete (pruébalo primero sin -delete, con | wc -l)
hint-inodes-end =
    .lead = Para que no vuelva a pasar, la limpieza tiene que ejecutarse cada noche: una tarea cron, en el crontab de una cuenta con permiso para borrar estos archivos (root, o radio).
    .solution = sudo crontab -e, y añade: 15 4 * * * find /srv/radio/stats -type f -mtime +30 -delete

## Capítulo 4 — El reloj

hint-clock-utc =
    .lead = La tarea cron no ha cambiado, y sin embargo arranca con dos horas de retraso. ¿Qué hora cree la máquina que es, y en qué zona horaria cree que vive?
    .solution = date, o timedatectl (Time zone: Etc/UTC)
hint-clock-late =
    .lead = timedatectl también te dice si el reloj está sincronizado, y si el servicio NTP está en marcha. Compara con la hora de tu puesto.
    .solution = timedatectl (System clock synchronized: no, NTP service: inactive)
hint-clock-synced =
    .lead = La sincronización es trabajo de systemd-timesyncd: hay que habilitarlo, y darle un servidor NTP que responda. El correo del alojamiento dice cuál; la configuración está en /etc/systemd/timesyncd.conf (se vuelve a leer al arrancar).
    .solution = sudo nano /etc/systemd/timesyncd.conf (NTP=ntp.hosting.example), luego sudo timedatectl set-ntp true (o sudo systemctl restart systemd-timesyncd si ya está en marcha)
hint-clock-cron =
    .lead = La máquina debe vivir en la hora de París. La zona horaria se fija con timedatectl (man timedatectl: set-timezone, list-timezones).
    .solution = sudo timedatectl set-timezone Europe/Paris
hint-clock-end =
    .lead = cron leyó la zona horaria al arrancar, el sábado: sigue contando en UTC. Y timesyncd debe estar habilitado, para volver a arrancar en el próximo arranque de la máquina.
    .solution = sudo systemctl restart cron (y, si aún no está hecho, sudo timedatectl set-ntp true)

## Capítulo 5 — La sonda

hint-probe-end =
    .lead = La sonda de Zoé (/usr/local/bin/probe) tiene tres TODO: vigilar /srv/radio, espacio E inodos (man check_disk: -W, -K), comprobar que el directo responde (man check_http, puerto 8000, /directo), y ejecutarla cada 5 minutos (un temporizador systemd o cron). Unos umbrales demasiado ajustados dan alertas por nada.
    .solution = En sudo nano /usr/local/bin/probe, añade: $P/check_disk -w 20% -c 10% -W 20% -K 10% -p /srv/radio | grep -v " OK" | $ALERT y $P/check_http -H localhost -p 8000 -u /directo | grep -v " OK" | $ALERT; luego sudo crontab -e: */5 * * * * /usr/local/bin/probe (o probe.service + probe.timer con OnCalendar=*:0/5, y sudo systemctl enable --now probe.timer).

## Capítulo 6 — El post-mortem

hint-post-mortem-notes =
    .lead = Empieza por lo que Théo apuntó esa noche, en tu carpeta personal. Son pistas que comprobar, no hechos.
    .solution = cat notes_theo.txt
hint-post-mortem-reboot =
    .lead = Los registros son exactos al segundo. Lee los de la noche del 11 al 12 de septiembre, entre las 2:00 y las 3:30 (man journalctl: --since, --until): ¿qué arrancó justo antes de que se parara el repetidor?
    .solution = sudo journalctl --since "2027-09-12 02:00" --until "2027-09-12 03:30" (apt-daily-upgrade, y luego Stopping radio-stream.service); luego sudo cat /var/log/unattended-upgrades/unattended-upgrades-dpkg.log y last
hint-post-mortem-origin =
    .lead = La opción desconocida esperaba en stream.conf. ¿Desde cuándo? El diario también guarda los comandos ejecutados con sudo: busca quién abrió ese archivo, y cuándo.
    .solution = sudo journalctl | grep stream.conf (el 20 de agosto, sudo nano /etc/radio/stream.conf, nunca reiniciado)
hint-post-mortem-end =
    .lead = Completa postmortem.md (nano), conservando los títulos «##» de la plantilla y sin dejar ningún «(por completar»: Resumen; Cronología con las horas de los registros (avería, primera alerta, vuelta del directo); Impacto en minutos; Causas (el desencadenante, y desde cuándo esperaba el error); Lo que funcionó bien; Acciones (al menos dos líneas «-»). Sin culpables: nada de «la culpa» ni «por culpa de».
    .solution = Cronología: 02:13 (la actualización reinicia el repetidor), 02:15 (primera alerta), 02:58 (el repetidor vuelve); Impacto: 45 minutos; Causas: unattended-upgrades (needrestart) reinició el repetidor, una opción desconocida (bitrate_max) esperaba en stream.conf desde el 20 de agosto; Lo que funcionó bien: la sonda avisó en 2 minutos; Acciones: - comprobar la configuración antes de cada reinicio (ExecStartPre=) - reiniciar el repetidor después de cada cambio.

## Capítulo 7 — El cuello de botella

hint-bottleneck-iowait =
    .lead = Zoé dice que el procesador casi no hace nada. Mira la línea %Cpu(s) de top: cada columna tiene su significado (man top), y una de ellas cuenta el tiempo pasado esperando al disco.
    .solution = top («wa» es enorme: eso es el iowait); luego iostat -x y sudo pidstat -d para ver el disco saturado y quién lo mantiene ocupado
hint-bottleneck-end =
    .lead = Lo que mantiene ocupado el disco (pidstat nombra su proceso; systemctl list-timers dice qué arranca a las 16:00) no debe detenerse. ionice no sirve con el planificador «none»; un límite de ancho de banda puesto por systemd funciona siempre (man systemd.resource-control: IOWriteBandwidthMax=), en el disco correcto (iostat lo nombra), ni demasiado bajo ni demasiado alto.
    .solution = sudo systemctl set-property radio-archives "IOWriteBandwidthMax=/dev/vda 20M" (guardado en /etc), luego iostat -x para comprobarlo; si el archivado está parado: sudo systemctl start radio-archives
