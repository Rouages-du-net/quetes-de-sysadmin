### Historia «El Club de Fotografía», capítulo 3 «Los portátiles»: un
### recurso compartido Samba (smb.conf, testparm, smbpasswd, máscaras,
### smbclient). La configuración, las rutas y las salidas de las
### herramientas no se traducen.

chapter-samba-share = Los portátiles
    .summary = Los portátiles Windows de los socios también deberían abrir las fotos, por la wifi del club. Un recurso compartido Samba solo para el club, donde una foto añadida por un socio la puedan retocar los demás.

## Archivos

samba-share-message-margot =
    De:      Margot
    Para:    tú
    Asunto:  ¿Y nuestros portátiles?

    Hola:

    El ordenador del laboratorio funciona de maravilla. Ahora Sam y Nora
    querrían abrir las fotos desde sus portátiles (Windows), por la wifi del
    club (192.0.2.0/24). Samba está instalado en el NAS (smbd funciona),
    pero todavía no comparte nada.

    - Un recurso compartido «photos» con /srv/photos, solo para los socios
      del club. Tom ha dejado el club: conserva su cuenta en el NAS para sus
      archivos antiguos, pero sin acceso al recurso compartido.
    - Una foto añadida por un socio tiene que poder retocarla los demás.
    - Nada de acceso de invitados, evidentemente.

    La misma contraseña de sudo: obturador-2028. Para las pruebas, la
    contraseña del portátil de Sam será negativo-2028, la de Nora
    diapositiva-2028 (las cambiarán).

    Margot

## Eventos

samba-share-event-share =
    Un recurso compartido sirve /srv/photos. testparm comprueba smb.conf
    (sudo testparm -s), smbclient lo prueba desde aquí:
    smbclient //localhost/photos -U sam -c "ls". smbd lee smb.conf en cada
    conexión nueva: no hace falta reiniciar para un recurso compartido.
samba-share-event-unknown =
    testparm no conoce uno de los parámetros: se ignora, como si no
    estuviera. Comprueba cómo se escribe en man smb.conf (valid users, read
    only, create mask…).
samba-share-event-logon-failure =
    Samba rechaza el inicio de sesión: guarda sus propias contraseñas,
    separadas de las de Unix (man smbpasswd: -a). Cada socio necesita una:
    sudo smbpasswd -a sam.
samba-share-event-read-only =
    El recurso compartido es de solo lectura: es el valor por defecto de
    Samba. read only = no (o writable = yes) en la sección del recurso.
samba-share-event-guest =
    guest ok = yes deja entrar a cualquiera que esté en la wifi, sin
    contraseña (como nobody). El club pidió lo contrario: quítalo, y lista
    quién puede entrar (valid users = @club).
samba-share-event-tom =
    Cualquier cuenta del NAS puede entrar en este recurso compartido, Tom
    incluido, en cuanto tenga una contraseña de Samba. valid users = @club
    reserva el recurso para los miembros del grupo.
samba-share-event-passwords =
    Sam y Nora pueden conectarse. Prueba a añadir una foto como Sam
    (smbclient … -c "put /tmp/contact-sheet.jpg sheet.jpg"), y luego mira
    sus permisos en el NAS: ¿podría retocarla Nora?
samba-share-event-masks =
    Mira los permisos del archivo nuevo (ls -l): por defecto, Samba crea los
    archivos en rw-r--r-- (create mask = 0744), y solo su autor puede
    cambiarlos. Para el club: create mask = 0664 y directory mask = 2775 (y
    los archivos tienen que pertenecer al grupo club: force group = club, o
    el setgid de /srv/photos).
samba-share-event-firewall =
    El recurso compartido está listo, pero los portátiles están en la wifi,
    y el cortafuegos del NAS solo deja entrar SSH y NFS: SMB usa el puerto
    445 (ufw conoce la aplicación «Samba»). Ábrelo solo a la red del club.
samba-share-event-end =
    Los portátiles abren \\nas\photos con la contraseña de Samba de cada
    socio; Tom y los invitados se quedan fuera, y una foto añadida por uno
    la pueden retocar los demás. Margot: «Nora ha retocado la garza de Sam.
    Está encantado. Más o menos».

    ¡Bien hecho! Has terminado el capítulo «Los portátiles».

    QUÉ HA PASADO
    Samba estaba instalado pero no compartía nada. Un recurso compartido
    para el grupo del club, contraseñas de Samba para sus miembros, máscaras
    para que el grupo pueda escribir, y el cortafuegos abierto a la red del
    club.

    UN RECURSO COMPARTIDO SAMBA
    - En /etc/samba/smb.conf: [photos], path = /srv/photos, read only = no,
      valid users = @club, create mask = 0664, directory mask = 2775, force
      group = club.
    - testparm -s tras cada cambio; smbd lee el archivo en cada conexión
      nueva.
    - smbpasswd -a NOMBRE: la contraseña propia de Samba; pdbedit -L las
      lista.
    - smbclient //servidor/recurso -U NOMBRE -c "ls" para probarlo.

    BUENA PRÁCTICA
    - Nada de guest ok en un recurso compartido con archivos personales.
    - Los permisos de Linux se siguen aplicando bajo Samba: las máscaras y
      el grupo deciden quién puede cambiar qué.
    - SMB solo en la red local (445), nunca abierto a Internet.

    DOCUMENTACIÓN
    - smb.conf(5): https://www.samba.org/samba/docs/current/man-html/smb.conf.5.html
    - smbpasswd(8): https://www.samba.org/samba/docs/current/man-html/smbpasswd.8.html
    - Debian: https://wiki.debian.org/Samba/ServerSimple
