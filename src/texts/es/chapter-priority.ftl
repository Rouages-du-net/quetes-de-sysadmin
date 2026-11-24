### Historia «La Vigilancia», capítulo «La prioridad»: ordenar dos CVE por
### la exposición tanto como por la puntuación CVSS. Los identificadores CVE
### son ficticios; los nombres de paquetes, los comandos y las rutas no se
### traducen.

chapter-priority = La prioridad
    .summary = Decidir qué corregir primero: la exposición cuenta tanto como la puntuación CVSS.

## Archivos

priority-email-salome =
    De:      Salomé
    Para:    tú
    Asunto:  Dos CVE, ¿en qué orden?

    Buen trabajo con la clasificación. Quedan dos CVE por tratar: nginx
    (puntuación 8.2) y rsync (puntuación 9.8). Si te quedas en la
    puntuación, rsync va primero, es la más alta. Pero la puntuación sola no
    lo cuenta todo.

    Hazte la pregunta que me hago siempre: ¿quién puede alcanzar este
    servicio, y cómo? Mira lo que escucha de verdad en este servidor (man
    ss, man nmap). Un servicio accesible desde internet, aunque tenga una
    puntuación más baja, merece tratarse antes que una herramienta que nunca
    se ejecuta a menos que la lances tú.

    Escribe tu decisión en prioridad.md, con el porqué. Y dime también qué
    hacemos con el CVE de openssh-server: se aplica a este servidor, pero
    ¿exige alguna acción?

    Salomé

priority-template =
    # Prioridad — la Panadería

    (por completar: el orden para tratar los dos CVE retenidos, con el
    porqué; y qué hacer con el CVE de openssh-server)

priority-a-complete = (por completar
priority-words-expose = internet, accesible, alcanzable, expuesto, público, publico, desde fuera, 80, 443
priority-words-local = ningún puerto, ningun puerto, sin puerto, no escucha, no está en escucha, no esta en escucha, local, línea de comandos, linea de comandos, herramienta, no es un servicio, ningún servicio, ningun servicio
priority-words-protected = ya protegido, ya está en "no", ya esta en "no", ya en no, nada que hacer, ninguna acción, ninguna accion, kbdinteractiveauthentication

## Revisión

priority-review = Salomé revisa tu decisión:
priority-missing-template = Todavía queda la línea «(por completar)» de la plantilla.
priority-missing-order = Hay que nombrar los dos CVE (nginx y rsync), nginx primero.
priority-missing-exposure = Di por qué: ¿qué hace que nginx sea accesible desde internet, y por qué rsync no lo es (mira ss -tlnp o nmap)?
priority-missing-ssh = No olvides el CVE de openssh-server: ¿se aplica? ¿Necesita alguna acción?

## Eventos

priority-event-score-only =
    Has puesto rsync antes que nginx: es el orden de la puntuación CVSS (9.8
    frente a 8.2), pero mira la exposición. Una puntuación mide lo grave que
    es SI se alcanza el fallo; no dice nada de lo fácil que es alcanzarlo.
    Vuelve a ejecutar ss -tlnp o nmap -sV en este servidor: ¿quién puede
    hablar con cada servicio?
priority-event-expose =
    Esto es lo que escucha de verdad: 80 y 443 responden a cualquier
    dirección. rsync nunca tiene un puerto abierto: es una herramienta que
    se ejecuta, no un servicio que espera conexiones.
priority-event-order =
    Tu orden se sostiene: nginx primero (expuesto), rsync después (una
    puntuación más alta, pero ningún puerto, así que no hay manera de
    alcanzarlo a distancia).
priority-event-end =
    Salomé: «Eso es exactamente. La puntuación dice "si te da", no "si
    puede darme"».

    ¡Bien hecho! Has terminado el capítulo «La prioridad».

    QUÉ HA PASADO
    Una puntuación CVSS mide el impacto de un fallo una vez alcanzado
    (pérdida de datos, control del sistema…), no lo fácil que es
    alcanzarlo. Un servicio accesible desde internet con una puntuación
    media suele ser más urgente que una herramienta local con una puntuación
    alta, porque nadie más que tú puede desencadenar el segundo fallo.

    BUENA PRÁCTICA
    - Cruza la puntuación con la exposición real (ss -tlnp, nmap -sV) antes
      de decidir un orden.
    - Un fallo que necesita un acceso que ya tienes (local, autenticado) es
      casi siempre menos urgente que uno accesible desde fuera, incluso con
      una puntuación igual o menor.
    - Anota la decisión y su motivo: un orden de prioridad que no se puede
      explicar no se puede defender.

    OTRA MANERA
    La versión 4.0 de CVSS añade de hecho métricas de exposición («Attack
    Requirements», «Attack Complexity») a la puntuación base, para meter una
    parte de este razonamiento directamente en la cifra; aun así conviene
    comprobar tú la exposición real de tu propio sistema, que la puntuación
    no conoce.

    DOCUMENTACIÓN
    - ss: https://man7.org/linux/man-pages/man8/ss.8.html
    - nmap: https://nmap.org/book/man.html
    - CVSS: https://www.first.org/cvss/
