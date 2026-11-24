### Historia «La Vigilancia», capítulo «Sin prueba no hay certeza»: volver
### a demostrar que las correcciones aguantan, buscar un intento anterior en
### los registros. Los comandos, las rutas y el formato del registro de
### accesos de nginx no se traducen.

chapter-proof = Sin prueba no hay certeza
    .summary = Volver a demostrar que las correcciones aguantan, y comprobar si ya se había intentado aprovechar el fallo.

## Archivos

proof-email-salome =
    De:      Salomé
    Para:    tú
    Asunto:  Una última cosa antes de cerrar la semana

    Dos CVE corregidos está bien; todavía hay que demostrarlo, no solo
    creerlo. Confirma con apt (man apt) que no queda nada pendiente para
    nginx y rsync.

    Y un hábito que conviene crear, aunque sea a posteriori: ¿alguien había
    intentado ya aprovechar el fallo de nginx (HTTP/2) antes de que lo
    corrigieras? El registro de accesos de nginx guarda cada petición (man
    grep para buscar en él). Un intento fallido no hace daño a nadie, pero
    merece anotarse: quiere decir que alguien, ahí fuera, ya estaba
    buscando.

    Salomé

## Eventos

proof-event-versions =
    apt lo confirma: no queda nada que actualizar para nginx ni para rsync.
    Solo una vez comprobado está corregido de verdad.
# { $address }: the address of the attempt that was found
proof-event-found =
    Una línea del registro de accesos llama la atención: una petición HTTP/2
    vacía, sin navegador declarado, rechazada por nginx (código 400), desde
    { $address }, unos días antes de la corrección. No es la prueba de una
    intrusión lograda (nginx la rechazó), pero es un rastro que conviene
    guardar: alguien ya estaba buscando.
proof-event-end =
    Salomé: «Eso es lo que llamo una prueba: no "creo que está corregido",
    sino "apt lo confirma, y aquí está el intento que hemos detectado"».

    ¡Bien hecho! Has terminado el capítulo «Sin prueba no hay certeza».

    QUÉ HA PASADO
    Una corrección aplicada sin comprobar no es más que una intención.
    Comprobar después (un apt list --upgradable vacío) convierte «creo que
    está hecho» en un hecho establecido. Buscar en los registros un intento
    anterior, aunque fallara, da una idea de quién se interesaba ya por este
    servidor, y desde cuándo.

    BUENA PRÁCTICA
    - Vuelve a demostrar siempre una corrección después de aplicarla: apt
      list --upgradable, o el propio comando de la herramienta corregida.
    - Busca rastros de un intento antes de cerrar un incidente, incluso sin
      prueba de que tuviera éxito: forma parte de la vigilancia, no solo de
      la respuesta a un incidente ya visible.
    - Conserva los registros el tiempo suficiente para releerlos: un intento
      a menudo solo se descubre después, una vez que se conoce el fallo.

    OTRA MANERA
    Un sistema de detección de intrusiones (como fail2ban, que ya viste en
    «El centinela», o una herramienta más completa como Suricata) puede
    detectar este tipo de intento en directo en lugar de a posteriori, y
    reaccionar por sí solo (bloquear la dirección). Los dos se
    complementan: la detección en directo para reaccionar rápido, la
    relectura de los registros para entender lo que se escapó.

    DOCUMENTACIÓN
    - apt: https://manpages.debian.org/trixie/apt/apt.8.en.html
    - Formato del registro de accesos de nginx: https://nginx.org/en/docs/http/ngx_http_log_module.html
