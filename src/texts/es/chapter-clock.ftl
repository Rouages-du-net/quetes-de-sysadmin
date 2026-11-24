### Historia «De Guardia», capítulo 4 «El reloj»: zona horaria, NTP
### (systemd-timesyncd), timedatectl, cron que lee la zona horaria al
### arrancar. Los comandos, las opciones, las directivas y los mensajes de
### las herramientas no se traducen.

chapter-clock = El reloj
    .summary = Lunes, 9:12: el programa matinal solo se ha grabado a partir de las 8:09. ¿Ha perdido la noción del tiempo el servidor, migrado este fin de semana?

## Archivos

clock-message-zoe =
    Un mensaje de Zoé (lunes, 9:05):

    «El programa matinal ("matinal", de 6:00 a 9:00) solo se ha grabado a
    partir de las 8:09: ¡hemos perdido dos horas de emisión! Es la tarea
    cron de la cuenta radio la que lanza la grabación (sudo crontab -u
    radio -l), y no ha cambiado.

    Lo que sí ha cambiado: el proveedor de alojamiento migró el servidor
    a una máquina nueva este fin de semana (su correo está en
    correo_alojamiento.txt). Y sin embargo, el registro de grabación sí
    dice "06:00"…»
clock-mail-host =
    De: support@hosting.example
    Asunto: Migración de su servidor radio terminada

    Hola:

    Su servidor se migró a nuestra nueva infraestructura el sábado por la
    noche, a partir de una imagen de sistema estándar: sus datos y su
    configuración se han copiado.

    Recordatorio: desde nuestra red, el acceso a los servidores NTP
    públicos está filtrado. Use nuestro servidor de hora:
    ntp.hosting.example (el antiguo, ntp.old-hosting.example, se ha
    apagado).

    El equipo de soporte
clock-timesyncd-conf =
    #  This file is part of systemd.
    #
    # Entries in this file show the compile time defaults. Local configuration
    # should be created by either modifying this file (or a copy of it placed in
    # /etc/ if the original file is shipped in /usr/), or by creating "drop-ins" in
    # the /etc/systemd/timesyncd.conf.d/ directory. The latter is generally
    # recommended. Defaults can be restored by simply deleting the main
    # configuration file and all drop-ins located in /etc/.
    #
    # See timesyncd.conf(5) for details.

    {"[Time]"}
    NTP=ntp.old-hosting.example
    #FallbackNTP=0.debian.pool.ntp.org 1.debian.pool.ntp.org 2.debian.pool.ntp.org 3.debian.pool.ntp.org
    #RootDistanceMaxSec=5
    #PollIntervalMinSec=32
    #PollIntervalMaxSec=2048
clock-script-save =
    #!/bin/sh
    # record PROGRAMA DURACIÓN: graba el directo durante DURACIÓN minutos.
    # La hora del registro es la hora de la máquina (date).
    echo "$(date '+%F %T') $1: start ($2 min)" >> /var/log/radio/record.log
    exec /usr/local/bin/stream-record --mount /directo --minutes "$2" --out "/srv/radio/programas/$1-$(date +%F).ogg"
clock-journal-save =
    2027-08-26 06:00:01 matinal: start (180 min)
    2027-08-26 23:00:01 nocturno: start (240 min)
    2027-08-27 06:00:01 matinal: start (180 min)
    2027-08-27 23:00:01 nocturno: start (240 min)
    2027-08-28 23:00:01 nocturno: start (240 min)
    2027-08-29 23:00:01 nocturno: start (240 min)
    2027-08-30 06:00:01 matinal: start (180 min)

## Eventos

clock-event-utc =
    UTC: la máquina vive en la hora de Greenwich, no en la de París (dos
    horas más en verano). Y cron lanza las tareas a la hora local de la
    máquina: «6:00» en el crontab quiere decir 6:00 UTC, es decir, las
    8:00 en París. La imagen del proveedor conservó la zona horaria por
    defecto. La zona horaria se fija con timedatectl (man timedatectl).
clock-event-late =
    «System clock synchronized: no»: nadie pone el reloj en hora. El reloj
    de un ordenador se desvía unos segundos al día… y este ya va nueve
    minutos atrasado (tu puesto dice 9:12). Ese es el trabajo de NTP
    (Network Time Protocol): aquí, el servicio systemd-timesyncd, que está
    parado (NTP service: inactive).
clock-event-manual =
    El reloj está en hora… por ahora. Sin NTP, sigue desviándose, y nadie
    lo corregirá la próxima vez. Mejor dejarle ese trabajo a
    systemd-timesyncd.
clock-event-silent =
    systemd-timesyncd funciona, pero el reloj sigue sin sincronizarse: el
    servidor NTP al que pregunta no responde (sudo journalctl -u
    systemd-timesyncd, o timedatectl timesync-status). Su configuración
    está en /etc/systemd/timesyncd.conf; solo la vuelve a leer al
    arrancar. El correo del proveedor, por cierto, habla de NTP.
clock-event-synced =
    «Contacted time server»: el reloj está sincronizado, y
    systemd-timesyncd lo mantendrá en hora (timedatectl).
clock-event-not-active =
    systemd-timesyncd funciona, pero no está habilitado: la próxima vez
    que la máquina se reinicie, no volverá a arrancar. timedatectl set-ntp
    true hace las dos cosas (o systemctl enable).
clock-event-cron =
    La zona horaria ha cambiado, pero cron la leyó al arrancar, el sábado:
    hasta que se reinicie, sigue contando en UTC, y el programa matinal de
    mañana seguiría empezando a las 8:00. (Pasa lo mismo con muchos
    servicios que llevan mucho tiempo en marcha: un cambio de zona horaria
    debe ir seguido de un reinicio.)
clock-event-end =
    La máquina está en la hora de París, sincronizada por NTP, y cron lo
    sabe. Mañana, el programa matinal se grabará a las 6:00. Zoé: «Le
    pediré al proveedor que fije la zona horaria en su imagen…»

    ¡Bien hecho! Has terminado el capítulo 4 de De Guardia.

    QUÉ HA PASADO
    La máquina nueva estaba en UTC, la zona horaria por defecto de la
    imagen: cron lanzaba la grabación a las 6:00 UTC, las 8:00 en París.
    Y sin NTP (timesyncd parado, y apuntando a un servidor que ya no
    existe), su reloj iba nueve minutos atrasado. Los registros escribían
    «06:00» sin decir en qué zona horaria.

    BUENA PRÁCTICA
    - Primero timedatectl: zona horaria, sincronización, servicio NTP.
    - La zona horaria: timedatectl set-timezone Europe/Paris, y luego
      reinicia los servicios que programan cosas (cron).
    - NTP siempre activo: timedatectl set-ntp true, con el servidor del
      proveedor si los servidores públicos están filtrados (NTP= en
      /etc/systemd/timesyncd.conf, y luego reinicia systemd-timesyncd).
    - No pongas la hora a mano (date -s): no dura.
    - Muchos equipos mantienen los servidores en UTC y escriben sus
      crontabs en consecuencia: lo que importa es saberlo, y dejarlo
      escrito. A los registros les conviene mostrar la zona horaria
      (date +%z).

    DOCUMENTACIÓN
    - timedatectl: https://www.freedesktop.org/software/systemd/man/latest/timedatectl.html
    - timesyncd.conf: https://www.freedesktop.org/software/systemd/man/latest/timesyncd.conf.html
    - cambiar la zona horaria en Debian: https://wiki.debian.org/TimeZoneChanges
