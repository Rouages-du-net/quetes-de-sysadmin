### Historia «El Café de Idiomas», capítulo «Permiso denegado, pero…»: un
### sitio movido con mv conserva la etiqueta SELinux de la carpeta personal;
### httpd no puede leerlo. ls -Z, el registro de auditoría (ausearch,
### audit2why), semanage fcontext y restorecon. Los comandos, las opciones,
### las rutas, las etiquetas y las salidas no se traducen.

chapter-wrong-label = Permiso denegado, pero…
    .summary = El sitio nuevo está en su sitio, los permisos parecen perfectos, y la pantalla del café muestra una página de prueba. A httpd se le rechaza algo que los permisos Unix permiten: encuentra quién lo rechaza, lee por qué, y arréglalo de forma que aguante el próximo reetiquetado, sin apagar SELinux.

## Archivos

wrong-label-message-thuy =
    De: Thuy (mesa de vietnamita, y quien cuida de la pizarra)
    Sábado 12 de diciembre, 10:15

    ¡Hola!

    Itzel puso el sitio nuevo en tetera esta mañana, y desde entonces la
    pantalla junto a la puerta vuelve a mostrar la "Test Page" gris en lugar
    de las mesas. Ha comprobado los permisos dos veces; hasta me mandó una
    captura de ls -l, todo rw-r--r--. El jueves vinieron 40 personas; el
    sábado tenemos la jornada de puertas abiertas, y me encantaría que las
    mesas salieran en la pantalla.

    Kaveh, de la asociación de al lado, viene esta noche a las 22:00 a
    reiniciar tetera por una actualización del núcleo. Seun dejó tetera
    preparada para eso, dijo.

    Thuy

wrong-label-message-itzel =
    De: Itzel
    Sábado 12 de diciembre, 09:45

    Construí el sitio nuevo en mi carpeta personal en tetera (~/site), y
    luego lo moví a /srv/site, que es donde van los sitios web, según leí.
    Exactamente lo que hice:

        sudo mkdir /srv/site
        cd ~/site && sudo mv css index.html tables.html /srv/site/

    Luego un archivo para httpd, /etc/httpd/conf.d/commontongue.conf, con
    DocumentRoot "/srv/site", y sudo systemctl restart httpd. Ningún error.
    Los archivos se pueden leer desde cualquier cuenta. ¿Qué más quiere
    httpd?

    Itzel

## Eventos

wrong-label-event-test-page =
    Esa página de prueba es httpd diciendo 403 para "/": el welcome.conf de
    Rocky la muestra cada vez que httpd rechaza la página de inicio. httpd
    encontró el sitio pero no le dejaron leerlo. Su registro de errores
    (/var/log/httpd/error_log) dice qué archivo.

wrong-label-event-error-log =
    «Permission denied» para un archivo que cualquier cuenta puede leer: los
    permisos Unix no son los únicos en tetera. Cada archivo tiene también una
    etiqueta SELinux, que ls puede mostrar (man ls, -Z), y cada proceso una
    (ps -Z): la de httpd es httpd_t.

wrong-label-event-labels =
    user_home_t: la etiqueta de los archivos de una carpeta personal. mv no
    reetiqueta: los archivos conservaron la etiqueta que tenían en la
    carpeta de Itzel, y httpd_t no puede leer user_home_t. Compara con
    /var/www/html (ls -Zd). Quién lo rechazó, y cuándo, está en el registro
    de auditoría.

wrong-label-event-avc =
    Un AVC es un rechazo de SELinux: quién (scontext, httpd_t), qué
    (tcontext, el tipo del archivo; tclass) y qué permiso ({"{"} read {"}"}),
    permissive=0: rechazado. audit2why explica una denegación (puede que
    falte su paquete: dnf encuentra qué paquete tiene un comando).

wrong-label-event-tools-missing =
    semanage, audit2why y audit2allow no vienen en una instalación mínima:
    llegan con un paquete. dnf puede decir cuál (man dnf: provides).

wrong-label-event-tools =
    Las herramientas de la política ya están. audit2why lee las denegaciones
    y dice por qué; semanage fcontext -l dice qué etiqueta da la política a
    cada ruta. ¿Qué le da a /srv/site?

wrong-label-event-permissive =
    Permissive: SELinux ya no rechaza nada, así que el sitio se ve; eso
    demuestra que SELinux es la causa, pero todos los servicios confinados de
    tetera han perdido su protección, no solo httpd. Vuelve a enforcing
    (setenforce 1) y arregla las etiquetas en su lugar.

wrong-label-event-config-off =
    /etc/selinux/config ya no dice SELINUX=enforcing: en el próximo arranque
    (esta noche, con Kaveh), tetera arrancaría sin la protección de SELinux.
    Vuelve a poner enforcing en el archivo.

wrong-label-event-chmod =
    Un archivo del sitio ahora lo puede escribir cualquiera (chmod 777 u
    o+w): los permisos Unix ya bastaban para httpd, no eran el problema.
    Devuélvelos (644 para los archivos, 755 para los directorios); lo que le
    falta a httpd es la etiqueta.

wrong-label-event-home-boolean =
    httpd_read_user_content deja a httpd leer los archivos de todas las
    carpetas personales: el sitio se vería, pero también cualquier cosa que
    una cuenta deje en su carpeta. Vuelve a apagarlo; el sitio no debería
    parecer una carpeta personal.

wrong-label-event-module =
    Hay cargado un módulo hecho por audit2allow: httpd_t ahora puede leer
    todo lo que tenga esa etiqueta, en /srv/site y en todas las carpetas
    personales. Permite lo que se rechazó, no lo que tú querías. Quítalo
    (semodule -r) y da a los archivos la etiqueta correcta.

wrong-label-event-var-t =
    restorecon ha hecho lo que dice la política: /srv/site es var_t, como
    todo lo que hay bajo /srv que la política no conoce (semanage fcontext
    -l | grep /srv). httpd tampoco puede leer var_t. Primero la política
    tiene que aprender qué es /srv/site; después restorecon lo aplicará.

wrong-label-event-rule =
    La política ahora etiqueta el sitio como contenido web. Los archivos
    conservan su etiqueta actual hasta que algo los reetiquete: restorecon
    -Rv, y luego comprueba desde la pizarra.

wrong-label-event-relabelled =
    22:00. Kaveh: «He reiniciado tetera por la actualización del núcleo. Ha
    tardado una eternidad: ¿algo de "relabelling the file system"? Thuy dice
    que la pantalla vuelve a mostrar la página de prueba.»

    Seun había dejado /.autorelabel: al arrancar, todo el disco se reetiquetó
    según la política. Las etiquetas puestas con chcon no están en la
    política: han desaparecido, y /srv/site vuelve a ser var_t. Enseña a la
    política (semanage fcontext), y luego restorecon.

wrong-label-event-rebooted =
    22:00. Kaveh: «He reiniciado tetera por la actualización del núcleo.
    ¡Parece que todo bien!»

    Esta vez no hubo reetiquetado (/.autorelabel ya no estaba), así que las
    etiquetas puestas a mano sobrevivieron. Siguen sin estar en la política:
    el próximo restorecon o reetiquetado vuelve a poner var_t. Enseña a la
    política (semanage fcontext).

wrong-label-event-end =
    Thuy: «Las mesas salen en la pantalla, en siete idiomas. Itzel está
    bailando en la cocina.»

    ¡Bien hecho! Has terminado el capítulo «Permiso denegado, pero…».

    QUÉ HA PASADO
    Itzel movió el sitio desde su carpeta personal con mv, y mv conserva la
    etiqueta SELinux de un archivo: los archivos siguieron siendo
    user_home_t, que httpd_t no puede leer, así que httpd recibió del núcleo
    un «Permission denied» aunque los permisos Unix lo permitían (AH00132 en
    su registro de errores, un AVC en el registro de auditoría). La propia
    política etiqueta /srv/site como var_t. Enseñaste a la política que
    /srv/site es contenido web (semanage fcontext), y luego reetiquetaste
    los archivos a partir de ella (restorecon), así que las etiquetas
    aguantan también el próximo reetiquetado.

    BUENA PRÁCTICA
    - Un «Permission denied» que los permisos Unix no explican: mira las
      etiquetas (ls -Z, ps -Z) y el registro de auditoría (ausearch -m avc
      -ts recent).
    - Copia en su sitio (cp, que da al archivo nuevo la etiqueta de su
      lugar) o reetiqueta después de mover: mv conserva la etiqueta antigua.
    - Arregla la política, no el archivo: semanage fcontext -a -t
      httpd_sys_content_t "/srv/site(/.*)?" (o -e /var/www /srv/site), y
      luego restorecon -Rv /srv/site. chcon dura hasta el próximo
      reetiquetado.
    - setenforce 0 es un diagnóstico que dura segundos, nunca un arreglo;
      chmod 777 no arregla nada de lo que rechaza SELinux, y abre los
      archivos a todo el mundo.
    - audit2allow escribe una regla para lo que se rechazó: aquí, que httpd
      lea las carpetas personales. Lee primero audit2why: normalmente la
      respuesta es una etiqueta, un tipo de puerto o un booleano.
    - O usa lo que la política ya conoce: /var/www, o /srv/www (la política
      etiqueta /srv/www, y /srv/loquesea/www, como contenido web).

    DOCUMENTACIÓN
    - RHEL 10, Using SELinux, troubleshooting: https://docs.redhat.com/en/documentation/red_hat_enterprise_linux/10/html/using_selinux/troubleshooting-problems-related-to-selinux_using-selinux
    - semanage-fcontext(8): https://man7.org/linux/man-pages/man8/semanage-fcontext.8.html
    - restorecon(8): https://man7.org/linux/man-pages/man8/restorecon.8.html
    - Rocky Linux, learning SELinux: https://docs.rockylinux.org/guides/security/learning_selinux/
