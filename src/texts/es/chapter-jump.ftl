### Historia «El Centro Cívico», capítulo «El salto»: llegar a una máquina
### interna pasando por la pasarela (ssh -J, ProxyJump). Las opciones de
### ssh_config, los comandos, las rutas y los mensajes de OpenSSH (en
### inglés) no se traducen.

chapter-jump = El salto
    .summary = A la wiki solo se llega a través de la pasarela: ssh -J, y luego un atajo ProxyJump en ~/.ssh/config.

## Archivos

jump-email-yasmine =
    De:       Yasmine
    Para:     tú
    Asunto:   La wiki

    ¡Bien hecho con la pasarela! Siguiente paso: la wiki de las
    asociaciones. Es la máquina «wiki» (wiki.civico.internal, 10.20.0.11),
    en nuestra red interna: no se puede llegar a ella desde internet, solo
    desde civico. Mira /etc/hosts aquí: son los nombres que conoce civico.

    Gaspard lo hacía así: ssh civico, y luego, una vez en civico, ssh
    wiki. Pero para que funcionara el segundo ssh, había copiado su clave
    PRIVADA en civico. La he borrado: si alguien entrara en la pasarela, se
    llevaría la llave de toda la red.

    Al parecer ssh puede «saltar» a través de una máquina, directamente
    desde tu puesto, sin que tu clave privada salga de él (man ssh, opción
    -J). Y para no tener que escribirlo cada vez, se puede escribir de una
    vez por todas en ~/.ssh/config, en tu puesto (man ssh_config,
    ProxyJump): me gustaría que bastara con un simple «ssh wiki».

    Ya he añadido tu clave pública en nuestras máquinas, junto con la mía.

jump-note-gaspard =
    Nota de Gaspard (marzo de 2019)

    La wiki funciona aquí, en /srv/wiki. Las páginas son simples archivos
    Markdown; se editan desde el navegador.

    Para llegar aquí: ssh civico, y luego ssh wiki. (Puse mi clave en
    ~/.ssh en civico, es más cómodo.)

jump-wiki-welcome =
    # Wiki de las asociaciones

    ¡Te damos la bienvenida a la wiki del Centro Cívico! Cada asociación
    tiene su página: horarios, contactos, salas reservadas.

    - Los Huertos Compartidos
    - El coro de los martes
    - El club de ajedrez
    - El taller de bicis

## Eventos

jump-event-key-private =
    ATENCIÓN: hay una clave privada en ~/.ssh en civico (una línea
    «BEGIN OPENSSH PRIVATE KEY»). Es justo lo que Yasmine quería evitar: la
    pasarela es la máquina más expuesta de la red.

    Bórrala (rm), y salta mejor desde tu puesto: man ssh, opción -J.
jump-event-to-wiki =
    ¡Ya estás en la wiki! Tu conexión ha pasado por civico, pero tu clave
    privada se ha quedado en tu puesto: civico solo ha transmitido un túnel
    cifrado de extremo a extremo entre tu puesto y la wiki.

    (Mira tu prompt: tu@wiki. hostname lo confirma.)

    Queda una cosa, el atajo: en tu puesto, un bloque en ~/.ssh/config
    para que baste con un simple «ssh wiki» (man ssh_config, ProxyJump).
jump-event-shortcut =
    El atajo está en el ~/.ssh/config de tu puesto: ssh encuentra ahí el
    camino hacia la wiki, a través de civico. (Para ver lo que entiende
    ssh: ssh -G wiki.)
jump-event-end =
    Un simple «ssh wiki» desde tu puesto, y ninguna clave privada en la
    pasarela. Yasmine: «Está más limpio que en tiempos de Gaspard… ¡pero
    no se lo digas!»

    ¡Bien hecho! Has terminado el capítulo «El salto».

    QUÉ HA PASADO
    Con -J (o ProxyJump), ssh se conecta primero a la pasarela y le pide
    que abra un simple conducto hacia la wiki. Por ese conducto, tu puesto
    habla directamente con la wiki: la comprobación de su clave de host y
    tu autenticación se hacen de extremo a extremo. La pasarela solo ve
    pasar tráfico cifrado, y tu clave privada nunca sale de tu puesto.

    BUENA PRÁCTICA
    - Nunca copies una clave privada en un servidor, y menos aún en la
      pasarela (el «bastión»), la máquina más expuesta.
    - Salta con ssh -J o ProxyJump mejor que con dos ssh seguidos (o con
      la opción ForwardAgent, que expone tu agente a la pasarela).
    - Escribe tus atajos en ~/.ssh/config (Host, HostName, User,
      ProxyJump); compruébalos con ssh -G.
    - HostName se entiende desde el punto de vista de la pasarela: es la
      pasarela la que busca «wiki» en su /etc/hosts (o en su DNS).

    DOCUMENTACIÓN
    - ssh, opción -J: https://man.openbsd.org/ssh#J
    - ssh_config, ProxyJump: https://man.openbsd.org/ssh_config#ProxyJump
