### Historia «La Fanzinoteca», capítulo «Un perfil propio»: un script de
### copia de seguridad que funciona como root recibe su propio perfil
### AppArmor: aa-autodep, el modo complain, una ejecución, aa-logprof,
### aa-enforce. Los comandos, las opciones, las rutas, las reglas de perfil
### y las salidas no se traducen.

chapter-backup-profile = Un perfil propio
    .summary = El script de copia de seguridad de la fanzinoteca funciona como root y guarda todo lo que enumera su configuración: el mes pasado se llevó el archivo de contraseñas. Dale su propio perfil AppArmor, aprendido de lo que hace de verdad, para que incluso como root solo alcance los escaneos, el catálogo y su archivo comprimido.

## Archivos

backup-profile-message-hinewai =
    De: Hinewai (la Fanzinoteca)
    Martes 22 de marzo, 19:10

    ¡Hola! Gracias otra vez por la feria. Ahora, una preocupación mía.

    Mi script de copia de seguridad, /usr/local/sbin/zine-backup, funciona
    como root todas las noches (cron) y guarda lo que enumera
    /etc/zine-backup.conf. En febrero alguien añadió /etc a SOURCES "para
    conservar los ajustes de nginx", y el archivo comprimido copiado en la
    memoria USB compartida del voluntariado contenía /etc/shadow. Quité
    /etc y cambiamos todas las contraseñas, pero nada impide que vuelva a
    pasar: el script es root, lee lo que le digan que lea.

    La junta quiere que lo confine AppArmor, como a php-fpm: los escaneos,
    la base de datos del catálogo, su archivo en /srv/backup, y nada más,
    diga lo que diga su configuración. Rahim instaló auditd la semana
    pasada (la wiki de Debian dice que las herramientas de perfiles lo
    piden): las líneas de AppArmor van ahora a /var/log/audit/audit.log.

    Puedes lanzar la copia cuando quieras: sudo zine-backup, o sudo
    systemctl start zine-backup. A esta hora nadie usa el catálogo.

    Hinewai

## Eventos

backup-profile-event-script =
    El script lee su lista en /etc/zine-backup.conf y se la pasa a tar,
    como root: basta una línea en ese archivo para guardar cualquier cosa.
    Un perfil solo le dejará alcanzar lo que una copia de seguridad
    necesita. aa-autodep escribe uno primero (man aa-autodep).

backup-profile-event-profile-file =
    El script tiene un perfil en /etc/apparmor.d, cargado en modo complain:
    lo deja pasar todo y anota lo que sus reglas no cubren. Lanza ahora la
    copia, para que el núcleo vea lo que hace de verdad.

backup-profile-event-too-early =
    El perfil, en modo enforce, ha denegado algo que la copia necesita, y
    la copia ha fallado: las líneas DENIED de /var/log/audit/audit.log
    dicen qué. O el programa no se observó antes en modo complain (es
    demasiado pronto para enforce), o una regla es demasiado estrecha: el
    nombre del archivo comprimido cambia en cada ejecución, su regla no
    debe nombrar el archivo de esta noche.

backup-profile-event-not-attached =
    Hay un perfil cargado, pero el script ha funcionado sin confinamiento:
    su asociación (la ruta después del nombre del perfil, o el nombre mismo
    cuando empieza por /) debe corresponder a /usr/local/sbin/zine-backup.

backup-profile-event-observed =
    La ejecución ha pasado en modo complain, y audit.log ha recibido sus
    líneas apparmor="ALLOWED": la configuración leída, date, tar y gzip
    ejecutados, los escaneos y el catálogo leídos (con capability
    dac_read_search: el catálogo pertenece a www-data y los demás no pueden
    leerlo, así que incluso root lo necesita), el archivo comprimido
    escrito. aa-logprof las convierte en reglas, una pregunta cada vez (man
    aa-logprof).

backup-profile-event-too-wide =
    Este perfil todavía deja a la copia alcanzar { $path }: nada que una
    copia de seguridad necesite. Un patrón que sube demasiado (/**), o tar
    ejecutado sin confinamiento (ux), devuelve lo que el perfil debía
    quitar.

backup-profile-event-rules =
    El perfil contiene ahora las reglas de la copia. Sigue en modo
    complain: todavía no protege nada.

backup-profile-event-enforced =
    El perfil está en modo enforce. Vuelve a lanzar la copia: tiene que
    seguir funcionando.

backup-profile-event-shadow =
    tar: /etc/shadow: Cannot open: Permission denied, y una línea
    apparmor="DENIED": con /etc/shadow en SOURCES, el perfil lo deniega,
    sea root o no. Vuelve a quitarlo de la configuración: entonces la copia
    debería funcionar.

backup-profile-event-end =
    Hinewai: «La junta está contenta. Y yo dormiré mejor: ponga lo que se
    ponga en ese archivo, el script ya no puede llevarse las contraseñas».

    ¡Bien hecho! Has terminado el capítulo «Un perfil propio».

    QUÉ HA PASADO
    El script de copia de seguridad funcionaba como root y leía todo lo que
    enumeraba su configuración. Le diste su propio perfil: aa-autodep lo
    creó en modo complain, una ejecución dejó que el núcleo anotara lo que
    hacía el script (con auditd, en /var/log/audit/audit.log), aa-logprof
    convirtió esas líneas en reglas (tar y gzip como ix, los directorios con
    patrones, capability dac_read_search para el catálogo), y después
    aa-enforce. El script es un proceso nuevo en cada ejecución: el perfil
    se asocia en su próximo exec, no hay nada que reiniciar. Sea root o no,
    ya no puede leer /etc/shadow.

    BUENA PRÁCTICA
    - Observa antes de aplicar: el modo complain, una ejecución real (el
      camino habitual de la tarea nocturna), y después las reglas.
    - Lee cada pregunta de aa-logprof: permite lo que el programa necesita,
      un patrón para un directorio en vez de la lista de sus archivos,
      nunca ux, nunca /**.
    - Comprueba un perfil en los dos sentidos: la tarea funciona, y lo que
      no debe tocar se deniega (DENIED).
    - Bajo AppArmor, root no lo puede todo: las capacidades también son
      reglas (capability dac_read_search).
    - Mantén corto el modo complain, y guarda el perfil con la
      configuración de la máquina (y en sus copias de seguridad).

    OTRA MANERA
    El aislamiento de systemd restringe lo que ve un servicio sin perfil
    (ProtectSystem=strict, ReadWritePaths=, InaccessiblePaths=/etc/shadow).
    SELinux confina por etiquetas: un dominio para el script, tipos en sus
    archivos; una separación más fuerte, pero etiquetar todo lo que lee una
    copia de seguridad cuesta más trabajo.

    DOCUMENTACIÓN
    - aa-logprof(8): https://manpages.debian.org/trixie/apparmor-utils/aa-logprof.8.en.html
    - aa-autodep(8): https://manpages.debian.org/trixie/apparmor-utils/aa-autodep.8.en.html
    - aa-enforce(8), aa-complain(8): https://manpages.debian.org/trixie/apparmor-utils/aa-enforce.8.en.html
    - apparmor.d(5): https://manpages.debian.org/trixie/apparmor/apparmor.d.5.en.html
    - Crear perfiles con las herramientas: https://gitlab.com/apparmor/apparmor/-/wikis/Profiling_with_tools
