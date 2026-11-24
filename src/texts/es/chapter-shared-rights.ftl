### Historia «La Cooperativa», capítulo «Permisos compartidos»: una carpeta
### de equipo (setgid, umask) y una regla sudo ajustada (visudo). Los
### comandos, las rutas y la sintaxis de sudoers no se traducen.

chapter-shared-rights = Permisos compartidos
    .summary = Una carpeta donde el equipo de la caja pueda trabajar juntos de verdad (setgid, umask), y el derecho a reiniciar la caja, nada más (visudo).

## Archivos

shared-rights-email-awa =
    De:      Awa
    Para:    tú
    Asunto:  El equipo de la caja

    Dos problemas con el equipo de la caja (Lina y Karim, grupo till):

    1. Los extractos diarios están en /srv/till/extractos. Lina no puede
       corregir los de Karim, y al revés. ¡Y eso que los dos están en el
       grupo till! Mira ls -l. Todo lo que creen ahí, hoy y mañana, debe
       pertenecer al grupo till y poder modificarlo el grupo (man chmod,
       man umask).

    2. Cuando la caja se cuelga, tienen que llamar a alguien con sudo para
       que ejecute systemctl restart till. Marc les daba su contraseña…
       Dales el derecho a reiniciar la caja, y NADA más (man sudoers, man
       visudo; sudo -l -U lina para comprobarlo).

    Para sudo, tu contraseña sigue siendo: rabano-2027

shared-rights-statement-17 =
    Extracto de caja — domingo 17 de octubre (Lina)
    Fondo de caja: 150,00
    Ventas: 1.243,60
shared-rights-statement-18 =
    Extracto de caja — lunes 18 de octubre (Karim)
    Fondo de caja: 150,00
    Ventas: 987,20

## Eventos

shared-rights-event-sudoers-broken =
    sudo está roto: la política tiene un error (vuelve a leer el mensaje),
    y sudo entonces lo rechaza TODO, incluso a ti. Por eso sudoers se edita
    con visudo, que comprueba antes de guardar.

    En un servidor real, haría falta la consola de rescate del proveedor
    (o pkexec). Aquí: «Reiniciar este capítulo», debajo del terminal.
# { $file }: el archivo de reglas ignorado
shared-rights-event-file-ignore =
    Tu regla está en { $file }… ¡que sudo no lee! @includedir ignora los
    archivos cuyo nombre contiene un punto o termina en ~ (vuelve a leer
    /etc/sudoers.d/README). Dale un nombre sin punto, como
    /etc/sudoers.d/till.
shared-rights-event-too-large =
    Cuidado: con esta regla, Lina y Karim pueden abrir un shell de root
    (sudo bash), y por tanto hacer CUALQUIER COSA. No es lo que pide Awa:
    solo reiniciar la caja, con la ruta completa del comando y sus
    argumentos.
shared-rights-event-systemctl-whole =
    Casi: con systemctl y sin argumentos, Lina y Karim pueden reiniciar la
    caja… pero también detener ssh o cualquier otro servicio. Escribe el
    comando entero: ruta, y argumentos.
shared-rights-event-sudo =
    sudo -l -U lina lo confirma: el equipo de la caja puede reiniciar la
    caja, y nada más.
# { $directory }: la carpeta compartida
shared-rights-event-directory =
    { $directory } pertenece ahora al grupo till, que puede escribir en
    ella, y tiene el bit setgid (la s de drwxrwsr-x): todo lo que se cree
    dentro tendrá el grupo till. Queda lo que ya está ahí, y los permisos
    que Lina y Karim darán a sus próximos archivos (umask).
shared-rights-event-mask =
    Lina y Karim tendrán la máscara 002 en su próxima conexión: sus
    archivos nuevos serán rw-rw-r--, modificables por el grupo.
shared-rights-event-end =
    Al día siguiente: Lina guarda su extracto (-rw-rw-r-- lina till), Karim
    corrige una coma sin pedírselo a nadie, y cuando la caja se cuelga a
    mediodía, la reinicia él mismo con sudo. Awa: «¡Se acabó que circulen
    contraseñas!»

    ¡Bien hecho! Has terminado el capítulo «Permisos compartidos».

    QUÉ HA PASADO
    Un archivo pertenece al grupo principal de quien lo crea, con los
    permisos que permite su máscara (umask 022: rw-r--r--). Para trabajar
    en equipo, hacen falta las dos cosas: el bit setgid en la carpeta (el
    grupo de la carpeta se transmite a los archivos nuevos) y una máscara
    002 (el grupo puede escribir). Y sudo no es todo o nada: una regla
    puede permitir un solo comando preciso, a un solo grupo preciso.

    BUENA PRÁCTICA
    - Carpeta de equipo: chgrp equipo, chmod 2775 (o g+ws), y luego
      chgrp -R y chmod -R g+w para lo que ya existe.
    - umask 002 en el ~/.profile del equipo (o /etc/profile.d).
    - Siempre visudo (-f para /etc/sudoers.d/nombre-sin-punto), rutas
      completas (which), argumentos escritos completos; comprueba con
      sudo -l -U cuenta.
    - Nunca compartas una contraseña: da a cada persona un derecho preciso.

    DOCUMENTACIÓN
    - sudoers: https://www.sudo.ws/docs/man/sudoers.man/
    - visudo: https://www.sudo.ws/docs/man/visudo.man/
    - setgid en las carpetas: https://www.gnu.org/software/coreutils/manual/html_node/Directory-Setuid-and-Setgid.html
