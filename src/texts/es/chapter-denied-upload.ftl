### Historia «La Fanzinoteca», capítulo «Denegado»: los escaneos de un
### catálogo de fanzines cambiaron de disco, y el perfil AppArmor de php-fpm
### los rechaza. Las líneas DENIED del núcleo, el perfil y su archivo
### local/, apparmor_parser -r. Los comandos, las opciones, las rutas, las
### reglas de perfil y las salidas no se traducen.

chapter-denied-upload = Denegado
    .summary = La feria del fanzine es mañana, y desde que los escaneos cambiaron de disco el catálogo de la fanzinoteca muestra una página de error y rechaza todas las subidas, aunque los permisos de los archivos parecen correctos. Averigua quién dice que no, y deja pasar a la aplicación sin abrir toda la máquina.

## Archivos

denied-upload-message-nomvula =
    De: Nomvula (coordinadora de la Fanzinoteca)
    Viernes 11 de marzo, 17:40

    ¡Hola, y gracias por venir un viernes por la tarde!

    Mañana es nuestra feria del fanzine, y desde esta tarde el catálogo en
    línea muestra una página de error. Peor aún: el voluntariado que
    escanea los fanzines nuevos no puede subirlos, la página solo dice
    "Upload failed.".

    El único cambio de hoy: a las tres, Rahim movió los escaneos al disco
    nuevo (el viejo estaba lleno) y cambió los ajustes de la aplicación. Lo
    comprobó antes de irse a buscar las mesas: /srv/scans pertenece a
    www-data, como el directorio antiguo. Él tampoco lo entiende.

    Bartek, que instaló grapadora en 2031, dejó notas en tu carpeta
    personal. sudo funciona con tu contraseña. Y por favor: Bartek siempre
    decía que no había que apagar sin más la protección del servidor. No la
    víspera de la feria.

    Nomvula

denied-upload-notes-bartek =
    Notas de Bartek (grapadora, 2031)

    - grapadora: Debian 13, nginx delante, PHP 8.4 detrás (el servicio
      php8.4-fpm). La aplicación del catálogo, zinecat, está en
      /var/www/zinecat; sus ajustes, en config.php.
    - AppArmor está activo por defecto en Debian. Instalé el paquete
      apparmor-profiles por su perfil de php-fpm: php-fpm funciona
      confinado, un fallo de la aplicación no entregaría toda la máquina.
    - El perfil es /etc/apparmor.d/php-fpm. Pertenece al paquete: no lo
      toco. Nuestras propias reglas están en /etc/apparmor.d/local/php-fpm.
    - sudo aa-status lista los perfiles cargados y los procesos que
      confinan.
    - Debian 13 no tiene /var/log/syslog: los mensajes del núcleo, los de
      AppArmor incluidos, están en el journal (sudo journalctl -k) y en
      sudo dmesg.
    - Los registros de nginx: /var/log/nginx/access.log y error.log.

## Eventos

denied-upload-event-denied =
    Ahí está. apparmor="DENIED" operation="open" profile="php-fpm"
    name="/srv/scans/": el núcleo le ha denegado a php-fpm (fsuid=33:
    www-data) leer el directorio, aunque sus permisos lo permiten. A
    AppArmor se le pregunta después de los permisos, y decide por ruta,
    según el perfil del programa. requested_mask="r" es una lectura;
    operation="mknod" con "c" es crear un archivo: una subida. ¿Qué reglas
    tiene el perfil de php-fpm? (man apparmor.d)

denied-upload-event-profile =
    El perfil de php-fpm termina con include if exists <local/php-fpm>: las
    reglas propias del sitio, en un archivo que ninguna actualización de
    paquete sobrescribirá nunca. Las líneas de Bartek nombran ahí
    /var/www/zinecat/scans, el sitio antiguo.

denied-upload-event-disabled =
    El perfil de php-fpm ya no está cargado, o está desactivado: puede que
    el catálogo vuelva a funcionar, pero php-fpm funciona ahora sin
    confinamiento, y un fallo de la aplicación alcanzaría toda la máquina.
    Vuelve a activarlo (man aa-enforce). Ojo con los procesos que ya están
    en marcha: un perfil se asocia cuando se ejecuta un programa.

denied-upload-event-complain =
    El modo complain: AppArmor lo deja pasar todo y lo anota como
    apparmor="ALLOWED". Sirve para observar un programa un rato, no para
    arreglar nada: en modo complain, el perfil no protege nada. Vuelve a
    ponerlo en modo enforce cuando la regla correcta esté en su sitio.

denied-upload-event-vendor =
    /etc/apparmor.d/php-fpm pertenece al paquete apparmor-profiles (un
    archivo de configuración que dpkg sigue): en la próxima actualización,
    dpkg preguntará si conservar tu versión o tomar la nueva, y quizá la
    siguiente persona tome la nueva. Quita de ahí tus líneas: las reglas del
    sitio van en el archivo que el perfil incluye para eso.

denied-upload-event-chmod =
    Ahora todo el mundo puede escribir en /srv/scans. Los permisos no eran
    el problema (www-data es la dueña del directorio): a AppArmor se le
    pregunta después de ellos, y sigue diciendo que no. Deja los permisos
    como estaban (chmod 755).

denied-upload-event-parser-local =
    local/php-fpm es un trozo de perfil, no un perfil: el analizador no
    puede cargarlo solo. Vuelve a cargar el perfil que lo incluye, el
    archivo de /etc/apparmor.d mismo.

denied-upload-event-parser-error =
    El analizador ha rechazado el archivo, y el núcleo ha conservado el
    perfil que tenía. El mensaje nombra el archivo y la línea; cada regla
    termina con una coma, y una coma que falta se señala en la línea
    siguiente.

denied-upload-event-too-open =
    Esa regla le da toda la máquina a php-fpm: ahora podría leer /etc/shadow
    o las claves de root. Un perfil enumera lo que el programa necesita: el
    directorio de los escaneos y lo que contiene, nada más.

denied-upload-event-not-reloaded =
    La regla está en el archivo, pero el núcleo sigue teniendo el perfil
    antiguo: AppArmor lee un perfil cuando se carga, no cuando cambian sus
    archivos. Vuelve a cargarlo (man apparmor_parser).

denied-upload-event-read-only =
    El catálogo vuelve a leer los escaneos, pero las subidas siguen
    fallando: el perfil deja a php-fpm leer /srv/scans, no crear archivos
    ahí (mknod, requested_mask="c": hace falta w).

denied-upload-event-unconfined =
    El perfil está cargado, pero los procesos de php-fpm funcionan sin
    confinamiento: se ejecutaron mientras el perfil no estaba cargado, y un
    perfil se asocia cuando se ejecuta un programa (sudo aa-status lo
    muestra). Reinicia php8.4-fpm.

denied-upload-event-fixed =
    El núcleo vuelve a dejar entrar a php-fpm en /srv/scans: el catálogo
    responde, y la última subida ha funcionado (ls -l /srv/scans). No hace
    falta reiniciar: un perfil sustituido en el núcleo se aplica enseguida a
    los procesos que confina.

denied-upload-event-end =
    Nomvula: «riso-dreams-04 está en el catálogo, y el voluntariado vuelve a
    subir sus escaneos. Rahim dice que pensará en AppArmor la próxima vez
    que mueva algo. ¡Nos vemos en la feria!».

    ¡Bien hecho! Has terminado el capítulo «Denegado».

    QUÉ HA PASADO
    php-fpm funciona bajo el perfil AppArmor php-fpm, que enumera por su
    ruta los archivos que puede usar. Las reglas del sitio que escribió
    Bartek, en local/php-fpm, nombraban /var/www/zinecat/scans. Cuando Rahim
    movió los escaneos a /srv/scans, los permisos Unix eran correctos, pero
    la ruta ya no estaba en el perfil: el núcleo lo denegó, y lo anotó
    (apparmor="DENIED" … name="/srv/scans/"). Añadiste el sitio nuevo a
    local/php-fpm y volviste a cargar el perfil con apparmor_parser -r: los
    procesos en marcha recibieron las reglas nuevas enseguida.

    BUENA PRÁCTICA
    - "Permission denied" aunque los permisos parecen correctos: lee el
      registro del núcleo (journalctl -k, dmesg; /var/log/audit/audit.log
      cuando auditd está en marcha) buscando apparmor="DENIED": profile,
      operation, name y requested_mask dicen a quién se le denegó qué.
    - Las reglas de un sitio van en /etc/apparmor.d/local/NOMBRE, nunca en
      el perfil del paquete: una actualización sustituye el archivo del
      paquete.
    - Vuelve a cargar el perfil mismo (apparmor_parser -r
      /etc/apparmor.d/NOMBRE, o systemctl reload apparmor), no su trozo
      local.
    - Da lo mínimo: /srv/scans/ r y /srv/scans/** rw, no /** rw.
    - aa-disable, el modo complain olvidado, chmod 777: acallan el mensaje,
      el agujero sigue ahí. Y un perfil reactivado solo alcanza a los
      programas ejecutados después.
    - Cuando mueves los datos de un servicio, mueve también su
      confinamiento.

    OTRA MANERA
    SELinux (Red Hat, Fedora, Rocky Linux) decide por etiquetas, no por
    rutas: un archivo está permitido por su tipo (httpd_sys_rw_content_t),
    esté donde esté. Allí, un archivo movido debe volver a etiquetarse
    (semanage fcontext, restorecon); con AppArmor, su ruta nueva debe
    nombrarse en el perfil. Una etiqueta sigue a un archivo renombrado; una
    ruta se lee más fácilmente en una regla.

    DOCUMENTACIÓN
    - apparmor.d(5): https://manpages.debian.org/trixie/apparmor/apparmor.d.5.en.html
    - apparmor_parser(8): https://manpages.debian.org/trixie/apparmor/apparmor_parser.8.en.html
    - aa-status(8): https://manpages.debian.org/trixie/apparmor/aa-status.8.en.html
    - AppArmor en Debian: https://wiki.debian.org/AppArmor/HowToUse
    - AppArmor: https://apparmor.net

## Lo que comparten los capítulos de la historia: guardado aquí para que se cargue con la historia.

zine-library-local-comment = # Reglas propias del sitio para php-fpm (Bartek, 2031): el catálogo de fanzines.
zine-library-local-comment-scans = # Los escaneos se mudaron al disco nuevo (marzo de 2033).
zine-library-local-readme =
    # Los añadidos y cambios propios del sitio para un perfil van en un
    # archivo de este directorio con el nombre del perfil (local/php-fpm
    # para php-fpm). El perfil lo incluye ("include if exists
    # <local/php-fpm>"), y ninguna actualización de paquete lo sobrescribe.
    # Tras un cambio, vuelve a cargar el perfil mismo:
    # apparmor_parser -r /etc/apparmor.d/php-fpm
zine-library-config-comment = // Dónde se guardan los escaneos (Rahim, 11 de marzo: movidos al disco nuevo).
zine-library-script-comment = # zine-backup: la copia de seguridad nocturna del catálogo (Hinewai, 2032).
zine-library-conf-comment = # Lo que guarda zine-backup (SOURCES) y dónde (DEST).
zine-library-cron-comment = # Todas las noches a las 2:30 (Hinewai).
