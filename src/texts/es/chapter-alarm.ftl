### Historia «El Bastión», capítulo «La alarma»: un aviso de abuso del
### proveedor de alojamiento; encontrar lo que se ejecuta, con quién habla y
### cómo entró, y anotarlo antes de actuar. Los comandos, las rutas, las
### direcciones y las líneas de registro no se traducen.

chapter-alarm = La alarma
    .summary = El proveedor de alojamiento dice que el servidor habla con un pool de minería: encontrar lo que se ejecuta, con quién habla y cómo entró, antes de tocar nada.

## Archivos

alarm-email-nadia =
    De:      Nadia
    Para:    tú
    Asunto:  RV: Aviso de abuso para 192.0.2.33

    Perdona por lo del sábado. Nuestro proveedor ha enviado esto a las
    7:00, y no entiendo la mitad. Además, el sitio de reparto va lento esta
    mañana. ¿Puedes mirarlo? Selma (la desarrolladora de la aplicación de
    reparto) no está hasta el lunes.

    ---------- Mensaje reenviado ----------
    De:      abuse@host.example
    Asunto:  Abuse report for 192.0.2.33

    Our monitoring shows that your server 192.0.2.33 has kept a connection
    open to 198.51.100.66, port 3333, since 13 April around 02:41 UTC. This
    address is a known cryptocurrency mining pool. This activity usually
    means a compromised machine. Please investigate and reply within 48
    hours.

    Nadia

    P. D.: Las notas de incidente que Salomé nos enseñó a llevar están en
    incident.md.

alarm-incident-template =
    # Incidente — horno (reparto)

    Abierto el sábado 14 de abril de 2029, 8:20, tras el aviso de abuso del proveedor.

    ## Qué se ejecuta
    (por completar: qué programa, con qué cuenta, desde qué carpeta)

    ## Con quién habla
    (por completar: qué dirección y qué puerto)

    ## Cómo entró
    (por completar: qué cuenta, desde qué dirección, a qué hora, cómo)

    ## Cronología
    - 13/04 02:41 — primera conexión al pool, según el proveedor.

## Eventos

alarm-event-process =
    Un «kworkerd» se lleva casi dos procesadores enteros, como deploy, y se
    ejecuta desde /tmp/.cache. Su nombre imita un hilo del núcleo, pero uno
    de verdad aparece entre corchetes ([kworker/0:1]), pertenece a root, y
    no tiene ninguna ruta en disco. Y su padre, una shell que ejecuta
    /tmp/.cache/.w, no es nada que la aplicación deba lanzar.
# { $pool }: the pool's address
alarm-event-connection =
    Aquí está: kworkerd tiene una conexión establecida con { $pool },
    puerto 3333, la dirección del aviso del proveedor. El programa y la
    conexión son la misma cosa.
alarm-event-connection-anonymous =
    Una conexión establecida con { $pool }, puerto 3333: la dirección del
    proveedor. Pero ¿qué programa la tiene? La columna del proceso solo
    aparece con -p, y para los sockets de otras cuentas, solo para root.
# { $address }: the intruder's address
alarm-event-entry =
    En el registro de ssh, catorce contraseñas fallidas para deploy desde
    { $address }, y luego «Accepted password» desde la misma dirección a las
    02:40:57. Alguien adivinó la contraseña de deploy. Y eso que este
    servidor solo acepta claves… o eso creías.
alarm-event-stopped-early =
    Lo has parado, y ha vuelto enseguida con otro PID: algo lo vuelve a
    lanzar. Eso es para el paso siguiente; por ahora, anota lo que ves
    antes de que nada cambie.
alarm-event-end =
    Nadia: «Así que alguien está usando nuestro servidor para ganar dinero.
    Prefiero saber exactamente qué antes de tocar nada, tienes razón».

    ¡Bien hecho! Has terminado el capítulo «La alarma».

    QUÉ HA PASADO
    En la noche del 12 al 13 de abril, alguien probó contraseñas en la
    cuenta deploy desde 203.0.113.66, y encontró la correcta a las 02:40.
    Dejó un minero disfrazado de hilo del núcleo (kworkerd, en
    /tmp/.cache), y un pequeño bucle de shell que lo vigila. Desde
    entonces, el servidor trabaja para esa persona, y el proveedor se dio
    cuenta.

    BUENA PRÁCTICA
    - Observa antes de actuar: qué se ejecuta (ps, top), con quién habla
      (ss -tnp o netstat -tnp, con sudo para ver los procesos), cómo entró
      (journalctl -u ssh, last).
    - Anótalo sobre la marcha, con las horas: incident.md es la memoria del
      incidente, y la base de lo que contarás a Nadia, al proveedor, y quizá
      a otras personas.
    - No apagues la máquina por acto reflejo: lo que se ejecuta en memoria y
      las conexiones abiertas forman parte de las pruebas.

    OTRA MANERA
    Una herramienta de detección de intrusiones en el propio servidor
    (auditd, AIDE, o una vigilancia de los procesos y las conexiones
    salientes) habría dado la alarma antes que el proveedor. El aviso del
    proveedor es una segunda línea de defensa, no la primera.

    DOCUMENTACIÓN
    - ps: https://man7.org/linux/man-pages/man1/ps.1.html
    - ss: https://man7.org/linux/man-pages/man8/ss.8.html
    - journalctl: https://www.freedesktop.org/software/systemd/man/latest/journalctl.html
    - NIST SP 800-61r2, gestión de incidentes: https://csrc.nist.gov/pubs/sp/800/61/r2/final
