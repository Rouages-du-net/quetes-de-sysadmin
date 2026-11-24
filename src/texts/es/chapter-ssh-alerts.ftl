### Historia «Los Refugios», capítulo 3 «Inicios de sesión fallidos»: una
### regla de rsyslog con una condición, el orden de las reglas, stop. La
### configuración, las rutas y las salidas de las herramientas no se
### traducen.

chapter-ssh-alerts = Inicios de sesión fallidos
    .summary = Hay robots probando contraseñas en todos los refugios. La alerta de Lou lee un solo archivo: poner en él los inicios de sesión fallidos de todos los refugios, y nada más, sin romper los archivos por refugio.

## Archivos

ssh-alerts-message-lou =
    De:      Lou
    Para:    tú
    Asunto:  Una alerta para los ataques SSH

    Hola:

    He escrito una pequeña comprobación, que cron ejecuta cada cinco
    minutos: cuenta las líneas de /var/log/remote/ssh-failures.log, y me
    manda un SMS si crece demasiado rápido. Alguien probando contraseñas en
    un refugio, vaya.

    ¿Podrías hacer que rsyslog escriba ahí los inicios de sesión SSH
    fallidos de todos los refugios (y solo esos)? Los archivos por refugio
    tienen que seguir funcionando.

    La misma contraseña de sudo: cumbre-2028.

    Lou

## Eventos

ssh-alerts-event-failures =
    «Failed password for invalid user admin…»: el mensaje de sshd para una
    contraseña incorrecta. En rsyslog, un mensaje tiene propiedades:
    $programname (sshd), $msg (el texto), $fromhost-ip… Un «if» las
    comprueba (man rsyslog.conf).
ssh-alerts-event-rule =
    Una regla escribe en ssh-failures.log. ¿La usa ya rsyslog? Lee su
    configuración cuando arranca (sudo rsyslogd -N1 para comprobar, y luego
    un reinicio).
ssh-alerts-event-after-stop =
    La regla está, rsyslog se ha reiniciado, y ssh-failures.log sigue
    vacío: las reglas se ejecutan en orden, y los mensajes de los refugios
    se paran en la regla por refugio de 10-remote.conf. Una regla colocada
    después nunca los ve. Pon la tuya antes (un archivo leído antes: 05-…,
    o dentro del mismo bloque, antes del stop).
ssh-alerts-event-too-wide =
    ssh-failures.log recibe más que inicios de sesión fallidos: el filtro es
    demasiado amplio (el programa solo también coge «Accepted publickey…»).
    Añade una condición sobre el mensaje ($msg contains 'Failed password').
ssh-alerts-event-per-hut-broken =
    Los archivos por refugio ya no reciben nada: ahora una regla para los
    mensajes de los refugios antes que ellos, o se ha cambiado la regla por
    refugio. Las dos tienen que funcionar.
ssh-alerts-event-end =
    ssh-failures.log reúne los inicios de sesión fallidos de todos los
    refugios, y solo esos; cada refugio conserva su archivo. Lou: «Tres
    robots a la vez en el refugio del puerto, y ha sonado mi teléfono.
    Perfecto».

    ¡Bien hecho! Has terminado el capítulo «Inicios de sesión fallidos».

    QUÉ HA PASADO
    rsyslog aplica sus reglas en orden, y stop termina el viaje de un
    mensaje. La regla por refugio terminaba con stop: una regla nueva tenía
    que ir antes, y comprobar a la vez el programa y el mensaje.

    LAS REGLAS DE RSYSLOG
    - if $programname == 'sshd' and $msg contains 'Failed password' then
      /var/log/remote/ssh-failures.log
    - Los archivos de /etc/rsyslog.d se leen por orden alfabético (05-…
      antes que 10-…), antes que las reglas de rsyslog.conf.
    - Un mensaje puede ir a varios archivos, hasta un stop.

    BUENA PRÁCTICA
    - rsyslogd -N1, luego reinicia, y luego pruébalo: logger -t sshd "Failed
      password for test".
    - Una alerta sobre un ritmo (líneas por minuto), no sobre cada línea.
    - Contra la adivinación de contraseñas en sí: solo claves, y fail2ban.

    DOCUMENTACIÓN
    - Las condiciones de RainerScript: https://www.rsyslog.com/doc/rainerscript/control_structures.html
    - Las propiedades: https://www.rsyslog.com/doc/configuration/properties.html
