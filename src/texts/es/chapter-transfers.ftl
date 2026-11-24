### Historia «El Centro Cívico», capítulo «Transferencias»: copiar archivos
### entre máquinas (scp, rsync). Los comandos, las opciones, las rutas y
### los mensajes de las herramientas (en inglés) no se traducen.

chapter-transfers = Transferencias
    .summary = Traer un archivo de la wiki a tu puesto (scp), y luego poner al día la copia en archives (rsync).

## Archivos

transfers-email-yasmine =
    De:      Yasmine
    Para:    tú
    Asunto:  Antes de la asamblea general

    ¡La asamblea general es el sábado! Dos cosas antes:

    1. El informe anual está en la wiki:
       /srv/wiki/exports/informe-2027.pdf. ¿Podrías traerlo a TU puesto?
       Lo imprimiré desde tu sitio. (man scp; el atajo que escribiste para
       la wiki también sirve para scp.)

    2. La copia de la carpeta compartida (/srv/compartido, aquí en civico)
       no se hace desde el año pasado. Va a archives, en
       /srv/copias/compartido: los mismos archivos, en los mismos sitios.
       Gaspard usaba rsync, desde civico: solo copia lo que ha cambiado
       (man rsync). Hasta creó una clave solo para eso,
       ~/.ssh/id_copia (mira ~/.ssh/config, aquí).

    Gaspard me dice por teléfono: «Cuidado con la barra final del origen,
    con rsync. Y prueba primero con -n».

transfers-minutes-agm-2026 =
    Asamblea general 2026 — acta

    Presentes: 34 asociaciones de 41.
    Informe anual aprobado por unanimidad. Presupuesto aprobado (2
    abstenciones).
    Proyecto del año: una wiki compartida para todas las asociaciones.
transfers-minutes-board-2027-09 =
    Junta directiva — septiembre de 2027

    Punto 1: la informática del Centro la retoma una persona voluntaria
    nueva. A Gaspard todavía se le puede localizar por teléfono.
    Punto 2: la asamblea general se celebrará el sábado 9 de octubre.
transfers-schedule =
    Reservas de salas — octubre de 2027

    Sala 1: coro (martes 19:00), club de ajedrez (jueves 18:00)
    Sala 2: taller de bicis (sábado 10:00)
    Salón de actos: asamblea general (sábado 9 de octubre, 14:00)

## Eventos

transfers-event-report =
    El informe anual está en tu puesto: scp ha pasado por civico (el
    ProxyJump de tu atajo), igual que ssh.
# { $directory }: la carpeta de más que se ha creado
transfers-event-nested =
    Mira en archives: ahora hay una carpeta { $directory }. Sin barra
    final, rsync ha copiado la CARPETA compartido dentro de la copia, en
    lugar de su CONTENIDO.

    Vuelve a empezar con /srv/compartido/. Y para quitar la carpeta de
    más, rsync puede borrar del otro lado lo que no existe en el origen:
    la opción --delete (man rsync). Potente, así que haz antes un ensayo,
    con -n.
transfers-event-backup =
    La copia en archives está al día: todos los archivos de
    /srv/compartido están ahí, en el mismo sitio. Vuelve a lanzar el
    mismo comando: a rsync ya no le queda nada que copiar.
transfers-event-end =
    El informe está en tu puesto, y la copia en archives está al día.
    Yasmine: «¡Gracias! Gaspard también te felicita, ha visto tu copia».

    ¡Bien hecho! Has terminado «El Centro Cívico».

    QUÉ HA PASADO
    scp copia archivos por la misma conexión cifrada que ssh, con las
    mismas claves y los mismos atajos (~/.ssh/config, ProxyJump). rsync
    también pasa por ssh; pero primero compara los dos lados y solo envía
    lo que ha cambiado: ideal para una copia que se rehace a menudo.

    BUENA PRÁCTICA
    - La barra final del origen importa, con rsync: /srv/compartido/
      copia el contenido, /srv/compartido copia la carpeta.
    - Haz siempre antes un ensayo (rsync -n, o --dry-run), sobre todo con
      --delete, que borra del otro lado lo que ya no existe en el origen.
    - Una clave dedicada para cada tarea automática (id_copia), no la
      clave de una persona; en el servidor, se puede restringir aún más en
      authorized_keys (opción restrict).
    - Nunca FTP ni telnet: envían las contraseñas en claro por la red.
      scp, sftp y rsync pasan por ssh.

    DOCUMENTACIÓN
    - scp: https://man.openbsd.org/scp
    - rsync: https://download.samba.org/pub/rsync/rsync.1
    - authorized_keys, opción restrict: https://man.openbsd.org/sshd#AUTHORIZED_KEYS_FILE_FORMAT
