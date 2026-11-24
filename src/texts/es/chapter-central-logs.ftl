### Historia «Los Refugios», capítulo 1 «Reunir los registros»: rsyslog
### como servidor central (imudp), el cortafuegos, un archivo por refugio,
### stop. La configuración, las rutas y las salidas de las herramientas no
### se traducen.

chapter-central-logs = Reunir los registros
    .summary = Los tres refugios de montaña envían sus registros al servidor del valle, y no llega nada. Hacer que el valle escuche, dejar entrar a los refugios y dar a cada refugio su propio archivo.

## Archivos

central-logs-message-lou =
    De:      Lou
    Para:    tú
    Asunto:  Los registros de los refugios

    Hola:

    Esta primavera configuré las pequeñas máquinas de los tres refugios
    (refugio-lago, refugio-puerto, refugio-cresta) para que envíen todos sus
    registros a este servidor del valle, con una línea en su
    rsyslog: *.* @valle.internal:514 (UDP).

    La idea: leerlo todo desde aquí, sin subir a cada refugio. Pero a valle
    no llega nada. ¿Podrías ver por qué?

    Y cuando funcione, me gustaría un archivo por refugio, en
    /var/log/remote/, no todo mezclado en el propio /var/log/syslog del
    valle.

    Tu contraseña de sudo: cumbre-2028.

    Lou

## Eventos

central-logs-event-silent =
    Aquí nada escucha en UDP 514: en /etc/rsyslog.conf, el módulo que recibe
    syslog por UDP (imudp) y su entrada están comentados, tal como lo
    instala Debian. Un servidor solo recibe lo que se le ha dicho que
    escuche.
central-logs-event-restart-needed =
    El archivo de configuración es correcto, pero el rsyslog en marcha lo
    leyó al arrancar: reinícialo (sudo systemctl restart rsyslog). Antes,
    sudo rsyslogd -N1 comprueba la configuración sin tocar el servicio en
    marcha.
central-logs-event-listening =
    rsyslog escucha ahora en UDP 514 (ss -ulnp lo muestra). Pero ¿entran los
    mensajes de los refugios? Mira lo que llega, y lo que hay entre los
    refugios y el puerto.
central-logs-event-firewall =
    rsyslog escucha, pero no entra nada de los refugios: ufw solo deja
    entrar SSH, y UDP 514 se descarta antes de que rsyslog vea nada. Deja
    entrar a los refugios, y solo a ellos si puedes (man ufw: from … to any
    port … proto udp).
central-logs-event-mixed =
    Los mensajes de los refugios llegan… al /var/log/syslog del valle,
    mezclados con los suyos. rsyslog aplica todas las reglas que coinciden,
    en orden: una regla para los refugios (un archivo por refugio: una
    plantilla con %HOSTNAME%) tiene que ir primero, y terminar con stop,
    para que las reglas por defecto no los reciban también. Los archivos de
    /etc/rsyslog.d se leen antes que las reglas de rsyslog.conf.
central-logs-event-config-error =
    rsyslog ha arrancado con errores en su configuración: su journal dice
    cuáles (journalctl -u rsyslog), y también sudo rsyslogd -N1. Las reglas
    erróneas se ignoran.
central-logs-event-end =
    Cada refugio tiene ahora su propio archivo ({ $file }…), y el syslog del
    valle sigue siendo del valle. Lou: «Veo la nevera del refugio del lago
    desde aquí. Magia».

    ¡Bien hecho! Has terminado el capítulo «Reunir los registros».

    QUÉ HA PASADO
    Los refugios enviaban sus registros a valle por UDP, pero el rsyslog de
    valle no escuchaba (imudp comentado), y además su cortafuegos descartaba
    UDP 514. UDP nunca se queja: los refugios no tenían ni idea de que no
    llegaba nada.

    EL SERVIDOR CENTRAL
    - module(load="imudp") e input(type="imudp" port="514") en rsyslog.conf
      (o TCP: imtcp, más fiable).
    - El cortafuegos abierto solo para los remitentes.
    - Una plantilla con %HOSTNAME% (o %FROMHOST-IP%) para un archivo por
      máquina, y stop para que los mensajes no vayan a ningún otro sitio.

    BUENA PRÁCTICA
    - sudo rsyslogd -N1 tras cada cambio, antes de reiniciar.
    - Prueba desde el remitente: logger "prueba desde el refugio del lago",
      y luego búscalo en el servidor.
    - UDP pierde mensajes sin decirlo: TCP (imtcp, @@servidor en los
      remitentes), con una cola, es mejor para los registros que importan.

    DOCUMENTACIÓN
    - imudp: https://www.rsyslog.com/doc/configuration/modules/imudp.html
    - Las plantillas: https://www.rsyslog.com/doc/configuration/templates.html
    - Los filtros: https://www.rsyslog.com/doc/configuration/filters.html
