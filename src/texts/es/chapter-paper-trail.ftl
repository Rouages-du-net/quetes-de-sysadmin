### Historia «La Sala de Profesores», capítulo «El rastro de papel»:
### registros de depuración que llenan el disco y guardan nombres del
### alumnado, un historial de trabajos y documentos guardados para siempre,
### cualquiera cancelando los trabajos de cualquiera, páginas de
### administración abiertas a toda la escuela. cupsd.conf, cupsctl,
### registros. Los comandos, opciones, rutas y salidas no se traducen.

chapter-paper-trail = El rastro de papel
    .summary = El servidor de impresión recuerda demasiado: semanas de registros de depuración en un disco lleno, el título de cada boletín de notas, cada documento. Vuelve a poner los registros en su sitio, enseña a CUPS a olvidar y cierra lo que se quedó abierto.

## Files

paper-trail-message-ines =
    De: Ines (secretaría de la escuela)
    Viernes 7 de diciembre, 16:00

    Hola:

    Dos cosas, y la segunda me preocupa.

    tiza ha enviado una alerta esta mañana: /var está casi lleno. Darius,
    que se ocupaba de él antes que tú, «depuró la multifunción» en
    noviembre; no sé qué dejó atrás.

    Y ha pasado nuestra delegada de protección de datos (su solicitud está
    en tu carpeta). Vio, en la página web de la impresora, la lista de
    todo lo impreso este trimestre: boletines de notas, planes de apoyo,
    fichas médicas, con los nombres del alumnado en los títulos. Cualquiera
    en la escuela puede verla. Y la semana pasada Sven canceló los
    boletines de Amara para que se imprimieran antes los suyos: parece que
    cualquiera puede cancelar el trabajo de cualquiera.

    ¿Puedes poner orden en todo eso? El profesorado tiene que seguir
    imprimiendo, claro.

    Ines

paper-trail-dpo-request =
    De: la delegada de protección de datos de la escuela
    Para: Ines, y quien se ocupe del servidor de impresión

    Los trabajos de impresión son datos personales cuando sus títulos
    nombran a alumnos y alumnas. Pido:

    - un historial de impresión de una semana como máximo (para los
      problemas y los costes);
    - ningún documento guardado en el servidor una vez impreso (un día como
      máximo);
    - nombres y títulos visibles solo para su propietario y los
      administradores;
    - registros que no guarden lo que se imprime, más allá de lo necesario;
    - la administración del servidor accesible solo desde el propio
      servidor.

    Gracias.

## Events

paper-trail-event-big-log =
    /var está casi lleno, y /var/log/cups/error_log pesa 3,9 GB. ¿Qué ha
    estado escribiendo cupsd? (sudo tail /var/log/cups/error_log, grep
    LogLevel /etc/cups/cupsd.conf.)
paper-trail-event-names =
    LogLevel debug2: cupsd lo escribe todo, incluidos los atributos de cada
    trabajo: su nombre, su propietario, su host. Los nombres del alumnado
    acaban en el registro, gigabytes de él. Y MaxLogSize 0: cupsd nunca lo
    rota.
paper-trail-event-history =
    El historial se remonta a octubre (lpstat -W completed -o), y con
    PreserveJobFiles Yes todos los documentos siguen en el spool
    (/var/spool/cups/d01188-001…). Por defecto, CUPS guarda el historial
    para siempre (PreserveJobHistory Yes) y los documentos un día. La
    delegada pide una semana y ninguno.
paper-trail-event-not-applied =
    cupsd.conf ha cambiado, pero cupsd funciona con lo que leyó al
    arrancar: reinícialo (cupsd -t comprueba antes el archivo), o usa
    cupsctl, que lo reinicia.
paper-trail-event-stopped =
    cupsd ya no está en marcha: nadie puede imprimir. systemctl status cups
    y journalctl -u cups dicen por qué (un error de sintaxis en
    cupsd.conf: cupsd -t muestra la línea).
paper-trail-event-loglevel =
    cupsd registra ahora a un nivel sensato: avisos y errores (y el
    historial de depuración de un trabajo fallido), sin los atributos de
    cada trabajo.
paper-trail-event-rotation =
    Los registros se rotarán: el propio cupsd al llegar a MaxLogSize
    (error_log pasa a ser error_log.O), o el archivo de logrotate para
    /var/log/cups.
paper-trail-event-rotated-o =
    cupsd ha rotado el registro grande: ahora es error_log.O, y sigue
    ocupando 3,9 GB. El registro antiguo ya no sirve para nada: puede irse
    (y con él, los nombres del alumnado que contiene).
paper-trail-event-small =
    /var/log/cups vuelve a tener un tamaño razonable, y el disco respira
    (df -h /var).
paper-trail-event-kept =
    CUPS ahora olvida: el historial de más de una semana y los documentos
    impresos se purgan (lpstat -W completed -o, sudo ls /var/spool/cups).
paper-trail-event-private =
    JobPrivateValues oculta los nombres, propietarios y hosts de un trabajo
    a todo el mundo salvo a su propietario y a los administradores.
paper-trail-event-cancel-policy =
    Cancel-Job vuelve a exigir a su propietario o a un administrador
    (Require user @OWNER @SYSTEM, la política por defecto).
paper-trail-event-admin-closed =
    /admin solo responde a localhost: desde las redes del profesorado o
    del alumnado, 403 (access_log).
paper-trail-event-cancel-all =
    cancel -a también ha cancelado los trabajos de hoy: el profesorado los
    volverá a enviar. Los trabajos antiguos ya estaban terminados; son los
    ajustes de CUPS los que los conservan.
paper-trail-event-broke-printing =
    El profesorado (o los Chromebooks de la biblioteca) ya no puede
    imprimir: el cambio ha ido demasiado lejos. /admin hay que cerrarlo;
    /printers debe quedarse abierto a la escuela.
paper-trail-event-end =
    Ines: «La delegada está contenta, el disco está contento, y los
    boletines de Amara han salido los primeros. ¡Buen fin de semana!»

    ¡Bien hecho! Has terminado El rastro de papel.

    QUÉ HA PASADO
    Darius había dejado LogLevel debug2 y MaxLogSize 0: 3,9 GB de
    error_log, con el nombre de cada trabajo dentro, y el archivo de
    logrotate quitado. CUPS guardaba el historial y el documento de cada
    trabajo durante todo el trimestre (PreserveJobHistory y
    PreserveJobFiles Yes), mostraba los títulos a cualquiera
    (JobPrivateValues none), dejaba que cualquiera cancelara cualquier cosa
    y servía /admin a toda la escuela. Volviste a poner LogLevel en warn
    con una rotación, quitaste el registro antiguo, limitaste el historial
    a una semana y los documentos a un día o a ninguno, ocultaste los
    valores privados, exigiste al propietario para cancelar y cerraste
    /admin, todo aplicado con un reinicio.

    BUENA PRÁCTICA
    - El registro de depuración es para un momento: vuelve a poner
      LogLevel (cupsctl --no-debug-logging), y conserva una rotación
      (MaxLogSize o logrotate).
    - Lo que imprime un servidor son datos: decide cuánto tiempo los
      guardas (PreserveJobHistory, PreserveJobFiles, page_log), y
      anótalo.
    - Conserva la política por defecto de CUPS: JobPrivateValues default,
      Cancel-Job para @OWNER @SYSTEM.
    - Administración desde localhost (cupsctl --no-remote-admin), o por ssh
      con un túnel cuando necesites las páginas web.
    - cupsctl cambia cupsd.conf y reinicia cupsd; después de nano, cupsd -t
      y luego systemctl restart cups.
    - Un registro rotado sigue ocupando su espacio hasta que desaparece.

    DOCUMENTACIÓN
    - cupsd.conf: https://www.cups.org/doc/man-cupsd.conf.html
    - cupsctl: https://www.cups.org/doc/man-cupsctl.html
    - Gestionar las políticas de operación: https://www.cups.org/doc/policies.html
    - Los archivos de registro de CUPS: https://www.cups.org/doc/man-cupsd-logs.html
