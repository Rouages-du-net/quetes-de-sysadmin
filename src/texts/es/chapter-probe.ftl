### Historia «De Guardia», capítulo 5 «La sonda»: supervisión (los plugins
### de monitoring-plugins, mail -E), un temporizador systemd (o cron), y un
### simulacro de avería de noche. Los comandos, las opciones, las directivas
### y los mensajes de las herramientas no se traducen.

chapter-probe = La sonda
    .summary = Cuatro noches arreglando las cosas a posteriori: esta vez, Zoé quiere que la avisen antes de que se rompan. Y esta noche organiza un simulacro…

## Archivos

probe-message-zoe =
    Un mensaje de Zoé (lunes, 18:20):

    «Cuatro noches, cuatro averías, y cada vez nos hemos enterado
    demasiado tarde. He empezado una sonda: /usr/local/bin/probe. Ejecuta
    comprobaciones (los «plugins» de supervisión, los de Nagios o Icinga)
    y me manda por correo todo lo que no está OK. El correo de root me
    llega a mí (/etc/aliases), y de ahí a mi móvil.

    Queda trabajo: solo mira el disco del sistema, y nada la ejecuta.
    ¿Podrías completarla, y luego hacer que se ejecute cada 5 minutos?

    Y para saber si funciona de verdad, propongo un simulacro: la noche
    siguiente provocaré dos averías, sin decir cuáles. En cuanto tu sonda
    esté programada, lanzo el simulacro. Si me avisan a tiempo, lo
    arreglo. Pero nada de falsas alarmas, ¿vale? Quiero poder dormir.»
probe-script =
    #!/bin/sh
    # La sonda de Radio Barrio (Zoé, en construcción).
    # Cada comprobación que no está OK se envía por correo (mail -E: nada si todo va bien).
    # Las comprobaciones vienen de monitoring-plugins (como Nagios o Icinga):
    # escriben una línea, OK, WARNING o CRITICAL (man check_disk).
    P=/usr/lib/nagios/plugins
    ALERT="mail -E -s alerta-radio root"

    # El disco del sistema: aviso por debajo del 20 % libre, crítico por debajo del 10 %.
    $P/check_disk -w 20% -c 10% -p / | grep -v " OK" | $ALERT

    # TODO: el volumen de datos, /srv/radio (y sus inodos: acuérdate…)
    # TODO: ¿responde el directo? (el repetidor escucha en el puerto 8000, ruta /directo)
    # TODO: ejecutarla cada 5 minutos (¿cron? ¿un temporizador systemd?)
probe-podcasts-readme =
    Miniaturas de los pódcast: la importación automática las deja en
    miniaturas/ (una imagen por episodio).

## La noche del simulacro

# { $runs }: cuántas veces se ha ejecutado la sonda (o una tarea programada)
probe-night =
    Tu sonda está programada: Zoé lanza el simulacro. Pasan la tarde y
    luego la noche ({ $runs ->
        [0] no se ha ejecutado ninguna tarea programada
        [one] una tarea programada se ha ejecutado una vez
       *[other] las tareas programadas se han ejecutado { $runs } veces
    }).
# { $alert }, { $repaired }: horas; { $minutes }: duración del silencio
probe-night-relay-seen =
    1:10: Zoé detiene el repetidor del directo, de golpe. A las { $alert },
    suena su móvil; vuelve a arrancar el repetidor a las { $repaired }. El
    directo ha estado en silencio { $minutes } minutos.
probe-night-relay-missed =
    1:10: Zoé detiene el repetidor del directo, de golpe… y no se avisa a
    nadie. El directo se queda en silencio hasta la mañana. ¿Qué comprueba
    tu sonda cuando el repetidor deja de responder? (man check_http, man
    check_procs)
probe-night-relay-slow =
    La alerta ha llegado, pero más de 15 minutos después de la avería:
    para una radio, es mucho. ¿Con qué frecuencia se ejecuta la sonda?
    (systemctl list-timers, systemd-analyze calendar)
# { $alert }: hora
probe-night-inodes-seen =
    1:40: la importación de miniaturas se desboca y crea miles de pequeños
    archivos en /srv/radio. A las { $alert }, mucho antes de que se agoten
    los inodos, avisan a Zoé y detiene la importación.
# { $full }: hora
probe-night-inodes-missed =
    1:40: la importación de miniaturas se desboca y crea miles de pequeños
    archivos en /srv/radio. A las { $full }, ni un solo inodo libre: la
    grabación nocturna falla, sin que nadie reciba aviso. ¿Vigila
    check_disk este volumen, y sus inodos? (man check_disk: -W y -K)
# { $count }: alertas recibidas cuando todo iba bien
probe-night-false =
    { $count ->
        [one] Zoé ha recibido una alerta
       *[other] Zoé ha recibido { $count } alertas
    } cuando todo iba bien. Alertas por nada, y al cabo de unas noches ya
    nadie las lee: ¿un umbral demasiado ajustado, una comprobación que
    escribe aunque todo vaya bien (cron también manda por correo todo lo
    que escribe una tarea)?
probe-night-never =
    No se ha ejecutado nada en toda la noche. ¿Está arrancado el
    temporizador, y se dispara de verdad (systemctl list-timers)? Cuidado:
    OnUnitActiveSec= solo nunca se dispara, porque el servicio aún no se
    ha ejecutado nunca (man systemd.timer).

## Eventos

# { $directory }: la carpeta de los plugins
probe-event-plugin-outside-path =
    Los plugins de supervisión no están en el PATH: en Debian, viven en
    { $directory }, y se ejecutan por su ruta completa (como en la sonda
    de Zoé).
probe-event-first-alert =
    Zoé: «¡Recibido tu correo!» Probar una alerta antes de necesitarla es
    buena idea.
probe-event-end =
    Las dos averías del simulacro se detectaron a tiempo, y la noche fue
    tranquila el resto del tiempo. Zoé: «Nunca había dormido tan bien
    durante una avería».

    ¡Bien hecho! Has terminado el capítulo 5 de De Guardia. (Te espera lo
    siguiente: ssh radio.)

    QUÉ HA PASADO
    Una sonda ejecuta comprobaciones (plugins: una línea y un código de
    retorno, 0 OK, 1 WARNING, 2 CRITICAL) y avisa cuando algo va mal.
    Había que vigilar lo que ya se había roto (el disco, los inodos, el
    directo), ejecutarla a menudo (un temporizador systemd), y probarla
    con un simulacro de avería.

    BUENA PRÁCTICA
    - Vigila lo que le importa a la gente (¿responde el directo?), no
      solo los recursos.
    - Umbrales que dejen tiempo para actuar (aviso al 80 %, crítico al
      90 %), inodos incluidos.
    - Nada de alertas por nada: cada alerta debe pedir una acción.
    - Un temporizador systemd (o cron) para la regularidad; systemctl
      list-timers y journalctl -u para comprobar que se ejecuta.
    - Prueba las alertas: un simulacro de avería vale más que una
      sorpresa real. Las herramientas completas (Icinga, Zabbix,
      Prometheus…) se basan en las mismas ideas.

    OTRA MANERA
    Una supervisión central: Icinga o Nagios (que usan estos mismos
    plugins check_*), Prometheus y sus alertas, Uptime Kuma para vigilar
    sitios web, Monit que además reinicia servicios. Un script y un
    temporizador bastan para una máquina pequeña; más allá, una
    herramienta central ve todas las máquinas y guarda el historial.

    DOCUMENTACIÓN
    - los plugins y sus códigos de retorno: https://www.monitoring-plugins.org/doc/guidelines.html
    - check_disk: https://www.monitoring-plugins.org/doc/man/check_disk.html
    - los temporizadores de systemd: https://www.freedesktop.org/software/systemd/man/latest/systemd.timer.html
