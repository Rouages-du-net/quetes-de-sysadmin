### Pistas graduales de La Sala de Profesores (ver src/engine/hints.ts): un
### mensaje por paso, hint-<capítulo>-<evento>, con .lead (una dirección, sin
### el comando exacto) y .solution (casi la respuesta).

## Capítulo 1 — La cola atascada

hint-stuck-queue-queue =
    .lead = Pide a CUPS el panorama completo: el planificador, las colas, si cada una está activada y acepta trabajos, y los trabajos (man lpstat).
    .solution = lpstat -t
hint-stuck-queue-error-log =
    .lead = La cola se paró por un motivo: el registro de cupsd está en /var/log/cups.
    .solution = tail -n 30 /var/log/cups/error_log
hint-stuck-queue-jobs =
    .lead = ¿Qué trabajo está a la cabeza de la cola de secretaría, y cuánto ocupa? (man lpq)
    .solution = lpq -P office, o lpstat -o office
hint-stuck-queue-canceled =
    .lead = Cancela ese trabajo, y solo ese: cancel recibe un identificador de trabajo, no solo una impresora (man cancel).
    .solution = cancel 117
hint-stuck-queue-purged =
    .lead = Un trabajo cancelado conserva su documento en el spool durante un tiempo: cancel tiene una opción para purgarlo.
    .solution = cancel -x 117
hint-stuck-queue-enabled =
    .lead = La impresora vuelve a estar encendida, el trabajo desbocado ha desaparecido: hay que activar la cola (man cupsenable).
    .solution = cupsenable office
hint-stuck-queue-end =
    .lead = Comprueba que los documentos de los compañeros se están imprimiendo, y que el spool ha encogido.
    .solution = lpstat -p office; lpq -P office; df -h /var

## Capítulo 2 — La impresora nueva

hint-new-printer-discover =
    .lead = ¿Qué ofrece la red? CUPS puede listar las impresoras que se anuncian, y las que imprimen sin controlador (man lpinfo, man driverless).
    .solution = driverless, o sudo lpinfo -v
hint-new-printer-added =
    .lead = Crea una cola para la multifunción con lpadmin: su nombre, activada, su URI IPP del albarán, y el modelo IPP Everywhere (man lpadmin).
    .solution = lpadmin -p staffroom -E -v ipp://mfp-staffroom.internal/ipp/print -m everywhere
hint-new-printer-default =
    .lead = El destino por defecto del servidor lo fija lpadmin, no lpoptions.
    .solution = lpadmin -d staffroom
hint-new-printer-pupil-printed =
    .lead = Quién puede conectarse a qué ruta está en cupsd.conf: lee <Location />, y compara @LOCAL con las interfaces del servidor (ip -br addr). El access_log muestra quién imprime.
    .solution = grep -A4 '<Location />' /etc/cups/cupsd.conf; ip -br addr; tail /var/log/cups/access_log
hint-new-printer-restricted =
    .lead = Restringe la multifunción al profesorado: un <Location /printers/NOMBRE> que solo permita la red del profesorado (luego cupsd -t y un reinicio), o los usuarios permitidos de la cola (lpadmin -u).
    .solution = añade a cupsd.conf: <Location /printers/staffroom> Order allow,deny / Allow 198.51.100.0/24 </Location>, luego sudo systemctl restart cups (o lpadmin -p staffroom -u allow:@staff)
hint-new-printer-everywhere-refused =
    .lead = Ahora la LaserJet de recepción: su URI es socket://, puerto 9100 (el albarán). Pruébala primero sin controlador, y lee lo que responde lpadmin.
    .solution = lpadmin -p reception -E -v socket://laserjet-reception.internal:9100 -m everywhere
hint-new-printer-hpcups =
    .lead = Necesita un controlador: lpinfo -m lista los instalados; las impresoras de HP tienen los suyos en un paquete de Debian (apt search hpcups).
    .solution = sudo apt update, luego sudo apt install printer-driver-hpcups
hint-new-printer-old-added =
    .lead = Busca el modelo de la LaserJet 4250 en lpinfo -m y dáselo a lpadmin -m.
    .solution = lpadmin -p reception -E -v socket://laserjet-reception.internal:9100 -m drv:///hpcups.drv/hp-laserjet_4250.ppd
hint-new-printer-end =
    .lead = La multifunción sin controlador y por defecto, el profesorado dentro, los Chromebooks fuera (pero todavía en la biblioteca), la LaserJet con su controlador, cupsd funcionando con la configuración del archivo.
    .solution = lpstat -t; tail /var/log/cups/access_log

## Capítulo 3 — El rastro de papel

hint-paper-trail-big-log =
    .lead = ¿Qué llena /var? Mira el tamaño de los registros (man du, man df).
    .solution = df -h /var; sudo du -sh /var/log/cups/* /var/spool/cups
hint-paper-trail-names =
    .lead = ¿Qué escribe cupsd en su error_log, y a qué nivel?
    .solution = sudo tail /var/log/cups/error_log; grep -E 'LogLevel|MaxLogSize' /etc/cups/cupsd.conf
hint-paper-trail-history =
    .lead = ¿Hasta cuándo recuerda CUPS los trabajos, y sus documentos? (man lpstat: -W; man cupsd.conf: PreserveJobHistory, PreserveJobFiles)
    .solution = lpstat -W completed -o; sudo ls /var/spool/cups
hint-paper-trail-loglevel =
    .lead = Vuelve a poner el nivel de registro normal y aplícalo: cupsctl hace las dos cosas (man cupsctl).
    .solution = cupsctl --no-debug-logging
hint-paper-trail-rotation =
    .lead = Un registro necesita una rotación: la del propio cupsd (MaxLogSize) o la de logrotate.
    .solution = cupsctl MaxLogSize=1m
hint-paper-trail-small =
    .lead = El registro antiguo de 3,9 GB sigue ahí (quizá renombrado error_log.O): ya no sirve para nada.
    .solution = sudo rm /var/log/cups/error_log.O (o sudo truncate -s 0 /var/log/cups/error_log)
hint-paper-trail-kept =
    .lead = Una semana de historial, documentos no conservados: dos directivas de cupsd.conf, aplicadas con un reinicio.
    .solution = cupsctl PreserveJobHistory=1w PreserveJobFiles=No
hint-paper-trail-private =
    .lead = Quién puede ver el nombre y el propietario de un trabajo: un valor de la política por defecto (man cupsd.conf, JobPrivateValues).
    .solution = cupsctl JobPrivateValues=default
hint-paper-trail-cancel-policy =
    .lead = Quién puede cancelar un trabajo: el límite Cancel-Job de la política por defecto; cupsctl tiene una opción para eso.
    .solution = cupsctl --no-user-cancel-any
hint-paper-trail-admin-closed =
    .lead = Las páginas de administración: cupsctl puede dejar de servirlas a la red.
    .solution = cupsctl --no-remote-admin
hint-paper-trail-end =
    .lead = Todo aplicado (cupsd funcionando con el archivo), los registros pequeños, el profesorado sigue imprimiendo.
    .solution = cupsctl; df -h /var; lpstat -t
