### Historia «La Donación de Sangre», capítulo «El servidor enfermo»: un
### backend que responde 500 sigue recibiendo tráfico (sin comprobación de
### salud); un backend que hay que sacar para mantenimiento sin cortar
### sesiones. option httpchk, http-check expect, check, fall, rise, la API
### de ejecución (socat, show stat, set server … state drain). Los
### comandos, las opciones, las rutas y las salidas no se traducen.

chapter-sick-server = El servidor enfermo
    .summary = Uno de cada tres donantes recibe una página de error, y un técnico espera en la puerta para reparar un servidor web. Enseña a HAProxy a distinguir un servidor sano de uno enfermo, y saca un servidor del grupo sin cortar la cita de nadie.

## Archivos

sick-server-message-zainab =
    De: Zainab (atención a donantes)
    Miércoles 22 de mayo, 10:05

    ¡Hola otra vez!

    Desde esta mañana, más o menos uno de cada tres donantes recibe una
    página de error al elegir una sesión («Server Error (500)»); si lo
    vuelven a intentar, suele funcionar. Hemos tenido quejas.

    Además: el técnico de la empresa de alojamiento está aquí para cambiar
    un módulo de memoria de web2 (lleva tiempo informando de errores de
    memoria). Espera tu visto bueno: apagará web2 en cuanto nadie lo esté
    usando, y prefiero que nadie pierda una cita a medio hacer.

    Zainab

sick-server-message-teodor =
    De: Teodor (aplicación de citas)

    ¡Hola! La aplicación tiene una página de salud: GET /health en el
    puerto 8080 responde 200 cuando la aplicación y su base de datos están
    bien, y 500 cuando no. Está ahí para los balanceadores de carga, si la
    preguntan.

    El socket de ejecución de HAProxy es /run/haproxy/admin.sock (stats
    socket en haproxy.cfg). Bastien usaba algo así:
    echo "show stat" | sudo socat stdio /run/haproxy/admin.sock

    Teodor

## Eventos

sick-server-event-errors =
    Los errores 500 vienen de web3: HAProxy le envía una petición de cada
    tres (balance roundrobin), y la aplicación de web3 responde «Server
    Error (500)» a todas. ¿Por qué HAProxy le sigue enviando peticiones?
    Pregunta a HAProxy qué piensa de sus servidores.
sick-server-event-denied =
    El socket pertenece a root y al grupo haproxy (modo 660): socat
    necesita sudo.
sick-server-event-no-check =
    «no check»: HAProxy no comprueba sus servidores en absoluto. Considera
    que todos están activos, respondan lo que respondan. Los servidores
    necesitan la opción check, y una comprobación que mire la aplicación,
    no solo el puerto (man haproxy, y su manual de configuración: option
    httpchk).
sick-server-event-tcp-only =
    Los servidores se comprueban ahora, pero web3 sigue UP: «L4OK». Sin
    option httpchk, una comprobación solo abre una conexión TCP al puerto
    8080, y la aplicación de web3 la acepta. La enferma es la aplicación,
    no su puerto: comprueba /health por HTTP (option httpchk GET /health,
    http-check expect status 200).
sick-server-event-http-check =
    web3 está DOWN: «Layer7 wrong status, code: 500» en
    /var/log/haproxy.log, L7STS en show stat. Tras `fall` comprobaciones
    fallidas HAProxy deja de enviarle peticiones; tras `rise` buenas (en
    cuanto Teodor arregle su base de datos) volverá solo.
sick-server-event-lb2-synced =
    lb2 comprueba igual: si la dirección pasa mañana a lb2, su HAProxy
    tampoco enviará donantes a un servidor enfermo.
sick-server-event-wrong-node =
    web2 está fuera del grupo en el balanceador que no tiene la dirección:
    las peticiones de los donantes pasan por el otro. Hazlo en el maestro
    (ip a te dice cuál es).
sick-server-event-removed =
    La línea server de web2 ha desaparecido de un haproxy.cfg. Volverá
    después de la reparación, así que habrá que volver a escribirla,
    recargar, y mantenerla igual en los dos balanceadores. La API de
    ejecución está hecha para esto: saca un servidor y lo vuelve a poner
    sin tocar el archivo.
sick-server-event-drained =
    web2 no recibe peticiones nuevas (drain: las sesiones ya abiertas
    terminan; maint: sin tráfico y sin comprobaciones). Mira cómo bajan
    sus sesiones (scur en show stat) antes de que el técnico lo apague.
sick-server-event-cut =
    La aplicación de web2 se paró mientras todavía había donantes en ella:
    sus citas se rompieron a medio camino. Primero drena, espera a que
    terminen las sesiones, y luego apaga.
sick-server-event-tech-working =
    Zainab: «El técnico ha apagado web2, tardará más o menos un minuto».
    Mientras tanto la comprobación de HAProxy sobre web2 falla, como es
    normal.
sick-server-event-tech-done =
    Zainab: «web2 ha vuelto, con su memoria nueva». Funciona, pero HAProxy
    todavía lo mantiene fuera del grupo (drain o maint): vuelve a ponerlo
    (set server … state ready).
sick-server-event-end =
    Zainab: «Se acabaron las páginas de error, y el técnico dice que web2
    está contento. Teodor está arreglando las conexiones de web3 a la base
    de datos».

    ¡Bien hecho! Has terminado el capítulo «El servidor enfermo».

    QUÉ HA PASADO
    La aplicación de web3 perdió sus conexiones a la base de datos y
    respondía 500 a cada petición, pero HAProxy no tenía comprobaciones de
    salud: seguía enviando a web3 un tercio de los donantes. Añadiste una
    comprobación HTTP de /health en los dos balanceadores: web3 pasó a
    DOWN y dejó de recibir tráfico. Luego sacaste web2 del grupo con la
    API de ejecución de HAProxy, esperaste a que terminaran sus sesiones,
    dejaste trabajar al técnico, y lo volviste a poner, sin tocar la
    configuración.

    BUENA PRÁCTICA
    - Una comprobación de salud tiene que preguntar a la aplicación, no
      solo a su puerto: option httpchk sobre una página que compruebe lo
      que necesita la aplicación (aquí su base de datos).
    - fall y rise evitan los vaivenes: un servidor sale del grupo tras
      unos cuantos fallos y vuelve tras unos cuantos éxitos.
    - Mantén idénticas las configuraciones de los balanceadores (diff, o
      mejor: gestión de la configuración).
    - Mantenimiento: drain (sin peticiones nuevas), espera a que scur
      llegue a 0, luego para. La API de ejecución cambia el estado en
      marcha; el archivo sigue siendo la referencia. Una recarga vuelve a
      partir del archivo.

    DOCUMENTACIÓN
    - Manual de configuración de HAProxy (option httpchk, http-check, server):
      https://docs.haproxy.org/3.0/configuration.html
    - Guía de gestión de HAProxy (la API de ejecución): https://docs.haproxy.org/3.0/management.html
    - socat: http://www.dest-unreach.org/socat/doc/socat.html
