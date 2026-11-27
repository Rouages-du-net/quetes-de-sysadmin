### Historia «De Guardia», capítulo 1 «El disco lleno»: un registro que se
### hincha, un archivo borrado que sigue abierto, logrotate. Los comandos,
### las rutas, las directivas y los mensajes (df, du, lsof, logrotate)
### nunca se traducen.

chapter-full-disk = El disco lleno
    .summary = 2:47 de la madrugada, el disco del servidor de la radio está lleno: encontrar al culpable, entender por qué rm no libera nada, y dejar los registros en manos de logrotate.

## Archivos

full-disk-message-zoe =
    Un mensaje de Zoé, voluntaria técnica de Radio Barrio (2:40):

    «Perdona que te despierte en tu primera guardia… La grabación
    automática del programa nocturno acaba de fallar: "No space left on
    device". El servidor dice que su disco está lleno, pero no veo qué ha
    podido llenarlo, no hemos añadido nada últimamente.

    Los próximos programas tienen que volver a grabarse, y que no
    vuelva a pasar.

    Para sudo: antena-2027.»
full-disk-conf-stream =
    # Radio Barrio: repetidor del directo (el servicio radio-stream)
    port = 8000
    mount = /directo
    logfile = /var/log/radio/stream.log
    # debug: todo, en cada paquete; info: lo esencial (Zoé, 12/08: debug para la investigación)
    loglevel = debug
full-disk-stream-log =
    2027-08-15 02:46:58.112 DEBUG relay: packet 98412331 from source 127.0.0.1:41022 (4096 bytes)
    2027-08-15 02:46:58.113 DEBUG relay: buffer 61% full, 12 listeners
    2027-08-15 02:46:58.113 DEBUG relay: packet 98412332 from source 127.0.0.1:41022 (4096 bytes)
    2027-08-15 02:46:58.114 DEBUG relay: sent 4096 bytes to 12 listeners
    2027-08-15 02:46:58.114 DEBUG relay: packet 98412333 from source 127.0.0.1:41022 (4096 bytes)
    2027-08-15 02:46:58.115 ERROR record: cannot write /srv/radio/programas/nocturno-2027-08-15.ogg: No space left on device
full-disk-syslog =
    Aug 15 02:40:01 radio CRON[24117]: (radio) CMD (/usr/local/bin/record nocturno)
    Aug 15 02:40:03 radio record[24118]: write failed: No space left on device
full-disk-syslog-old =
    Jul 31 23:50:01 radio CRON[20871]: (radio) CMD (/usr/local/bin/record late-jazz)
    Jul 31 23:59:58 radio record[20872]: recording finished: late-jazz-2027-07-31.ogg
    Aug  1 00:00:01 radio systemd[1]: Starting logrotate.service - Rotate log files...
    Aug  1 00:00:02 radio systemd[1]: logrotate.service: Deactivated successfully.
full-disk-logrotate-conf =
    # see "man logrotate" for details

    # global options do not affect preceding include directives

    # rotate log files weekly
    weekly

    # keep 4 weeks worth of backlogs
    rotate 4

    # create new (empty) log files after rotating old ones
    create

    # uncomment this if you want your log files compressed
    #compress

    # packages drop log rotation information into this directory
    include /etc/logrotate.d

    # system-specific logs may also be configured here.
full-disk-logrotate-rsyslog =
    /var/log/syslog
    /var/log/auth.log
    {"{"}
    	rotate 4
    	weekly
    	missingok
    	notifempty
    	compress
    	delaycompress
    	sharedscripts
    	postrotate
    		/usr/lib/rsyslog/rsyslog-rotate
    	endscript
    {"}"}
full-disk-logrotate-apt =
    /var/log/apt/term.log {"{"}
      rotate 12
      monthly
      compress
      missingok
      notifempty
    {"}"}

## Eventos

full-disk-event-full =
    100 %: ni un solo byte libre. Antes de borrar nada, hay que saber qué
    ocupa el espacio: du mide, carpeta a carpeta (du -sh /var/*, y luego
    más hondo), y a menudo está del lado de los registros.
full-disk-event-culprit =
    ¡El registro del repetidor pesa él solo más de quince gigabytes! Antes
    de borrarlo, mira lo que contiene (tail), y por qué ha crecido tanto.
full-disk-event-debug =
    Líneas DEBUG, varias por cada paquete del directo: el repetidor apunta
    todo lo que hace, cientos de veces por segundo. El nivel de registro
    se fija en su configuración (/etc/radio/stream.conf); un programa solo
    vuelve a leer su configuración al arrancar, o con un reload.
full-disk-event-ghost =
    df sigue diciendo lleno, pero du ya no encuentra el archivo: se ha
    borrado mientras el repetidor lo seguía teniendo abierto. Mientras un
    programa mantenga un archivo abierto, su espacio no se devuelve (sudo
    lsof +L1 lo muestra). Tiene que cerrarlo: reiniciándolo, por ejemplo.
    La próxima vez, truncate -s 0 vacía un registro sin esta trampa.
full-disk-event-renamed =
    El registro se ha renombrado, pero el repetidor sigue escribiendo en
    el archivo antiguo, con su nuevo nombre (sudo lsof -p 1730): un
    programa conserva el archivo que abrió, no su nombre. Para logrotate,
    hace falta o bien copytruncate (copiar y luego vaciar), o bien que
    vuelva a abrir su registro (postrotate … systemctl reload radio-stream
    … endscript).
# { $percent }: ocupación del disco
full-disk-event-breathes =
    El disco respira: { $percent } % ocupado. La grabación nocturna puede
    continuar. Ahora, a evitar la próxima vez.
full-disk-event-end =
    El disco tiene sitio, el repetidor funciona en modo normal, y logrotate
    se encargará de su registro a partir de ahora. Zoé: «Perdón por lo del
    debug… se me había olvidado por completo».

    ¡Bien hecho! Has terminado el capítulo 1 de De Guardia. (Lo siguiente:
    ssh radio.)

    QUÉ HA PASADO
    Un nivel de registro dejado en debug llenó el disco en tres días.
    Borrar un archivo abierto no libera nada mientras el programa lo
    tenga: df lo cuenta, du ya no lo ve. Había que vaciar el archivo
    (truncate) o reiniciar el programa, volver a poner el nivel normal,
    y dejar el registro en manos de logrotate.

    BUENA PRÁCTICA
    - Disco lleno: df para ver, du para encontrar, lsof +L1 para los
      archivos borrados pero todavía abiertos.
    - Vacía un registro con truncate -s 0, mejor que con rm.
    - Cada registro tiene su configuración de logrotate (rotación,
      compresión), con copytruncate o un postrotate que haga volver a
      abrir el archivo.
    - El modo debug, solo mientras dure una investigación; y una alerta
      cuando el disco pase del 80 % (más adelante en la historia).
    - Deja constancia de lo que se ha cambiado (y por qué).

    DOCUMENTACIÓN
    - logrotate: https://man7.org/linux/man-pages/man8/logrotate.8.html
    - lsof: https://man7.org/linux/man-pages/man8/lsof.8.html
    - truncate: https://www.gnu.org/software/coreutils/manual/html_node/truncate-invocation.html
