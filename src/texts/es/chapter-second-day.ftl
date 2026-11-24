### Historia «El Centro de Datos», capítulo «Segundo día»: cuentas y
### grupos. Malo debe leer los registros de nginx sin sudo (grupo adm), y
### el equipo web necesita una carpeta compartida (/srv/equipo).
### Los nombres de cuentas y grupos (malo, adm, web-team), los comandos,
### las rutas y los modos (640, 770) no se traducen.

chapter-second-day = Segundo día
    .summary = Una incorporación: cuentas y grupos, id, usermod -aG, chgrp, chmod para el grupo.

## Archivos

second-day-email-awa =
    De:      Awa (responsable de operaciones)
    Para:    tú
    Asunto:  Segundo día, dos cositas

    ¡Gracias por lo de ayer! Hoy se une Malo para echar una mano. Su cuenta
    ya existe (malo). Dos cosas que resolver antes de que llegue:

    1. Malo debe poder LEER los registros de nginx (/var/log/nginx), para
       detectar robots como el de ayer. Pero nada de sudo para él: no
       necesita ser administrador para leer un registro. Tú los lees
       sin sudo… ¿por qué? Compara  id  e  id malo , y mira los
       permisos con  ls -l /var/log/nginx

    2. El equipo web (el grupo web-team) necesita una carpeta compartida,
       /srv/equipo, donde cada persona pueda dejar sus informes. Ninguna
       otra cuenta de la máquina debe poder leer ni escribir ahí, y menos
       www-data: el sitio funciona con esa cuenta y, si algún día lo
       atacan, el atacante actuará con sus permisos.

    La contraseña de sudo no ha cambiado. Mis notas sobre permisos están en
    ~/notes_awa.txt, y el manual es tu amigo: man usermod, man chgrp.
second-day-notes-awa =
    NOTAS DE AWA — LEER  ls -l

      -rw-r----- www-data adm      84211 access.log
       ^^^             ^^^  propietario, luego grupo
          ^^^          permisos del propietario (rw-), del grupo (r--),
             ^^^       y luego de los demás (---)

    Para saber qué permisos se aplican a alguien, comprueba en orden:
    ¿es el propietario? Si no, ¿es miembro del grupo?
    Si no, es «los demás». Solo cuenta un trío, el primero que
    encaja.

    Los grupos de una cuenta:  id nombre  o  groups nombre
    En Debian, el grupo adm sirve para supervisar la máquina: sus miembros
    pueden leer los registros de /var/log.

    Para una carpeta, r = ver la lista, w = crear o borrar dentro,
    x = entrar. En números: r = 4, w = 2, x = 1, así que 7 = rwx, 5 = r-x,
    0 = nada (ver man chmod).

## Eventos

second-day-event-replaced =
    Ay: ¡Malo ya no está en el grupo web-team!

    Sin la opción -a, usermod -G SUSTITUYE la lista de grupos secundarios
    en lugar de añadirle el nuevo. Es una trampa clásica, que ya ha dejado
    a más de un administrador sin su propio acceso a sudo. Compruébalo
    con groups malo y vuelve a leer man usermod para devolverle a Malo
    sus grupos.
# { $logs }: la carpeta de los registros
second-day-event-logs-open =
    Cuidado: con estos permisos, TODAS las cuentas de la máquina pueden leer
    los registros de { $logs }, incluida www-data, la cuenta del sitio web.

    Un registro de accesos contiene las direcciones IP de los visitantes:
    son datos personales, que hay que proteger (RGPD). Vuelve a quitar los
    permisos a los demás (640) y usa mejor el grupo previsto para eso.
second-day-event-malo-reads =
    Malo puede leer los registros, sin sudo y sin abrirlos a todo el
    mundo: es miembro del grupo adm, y los registros dan permiso de lectura
    a ese grupo (r-- en medio de rw-r-----).

    Por cierto, en una máquina real Malo tendrá que volver a iniciar
    sesión: los grupos de una sesión se leen al conectarse.
# { $share }: la ruta de la carpeta compartida
second-day-event-share-open =
    Cuidado: ahora cualquier cuenta puede escribir en { $share },
    incluida www-data. Si atacan el sitio, el atacante puede dejar ahí
    lo que quiera. Quita todos los permisos a los demás (última cifra 0).
second-day-event-share =
    La carpeta { $share } está lista: el equipo web puede entrar, leer
    y escribir ahí, y las demás cuentas no ven nada.
second-day-event-end =
    Awa asoma la cabeza por la puerta: «Perfecto. Malo lee los registros,
    la carpeta compartida está cerrada a los demás y nadie tiene más
    permisos de los necesarios».

    ¡Bien hecho! Has terminado el capítulo 2 de El Centro de Datos.

    QUÉ HA PASADO
    En Linux, los permisos de un archivo se deciden en tres casillas:
    propietario, grupo, los demás. Añadir a Malo al grupo adm le dio
    exactamente lo que necesitaba, sin sudo y sin abrir los registros
    a todo el mundo. Para /srv/equipo, un grupo y el modo 770
    (rwx para el propietario y el grupo, nada para los demás) hacen
    una verdadera carpeta de equipo.

    BUENA PRÁCTICA
    - Mínimo privilegio: da un grupo en vez de sudo, y nunca
      chmod 777 u o+r «para que funcione».
    - usermod -aG para añadir un grupo; -G solo sustituye la lista.
    - Para ir más allá: chmod g+s en una carpeta compartida (bit setgid)
      hace que los archivos nuevos tomen el grupo de la carpeta.

    DOCUMENTACIÓN
    - usermod: https://man7.org/linux/man-pages/man8/usermod.8.html
    - chmod: https://man7.org/linux/man-pages/man1/chmod.1.html
    - Grupos de sistema de Debian (adm…): https://wiki.debian.org/SystemGroups
