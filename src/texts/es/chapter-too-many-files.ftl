### Historia «El Observatorio», capítulo 3 «Demasiados archivos abiertos»:
### los límites de un proceso, ulimit, prlimit, LimitNOFILE=. Los comandos,
### las rutas y las salidas de las herramientas no se traducen.

chapter-too-many-files = Demasiados archivos abiertos
    .summary = La nueva página de archivo de la galería responde 500: «EMFILE: too many open files». El ulimit del shell dice 1024, limits.conf no dice nada, y la galería es un servicio. Darle el límite que necesita, para siempre.

## Archivos

too-many-files-message-amara =
    De:      Amara
    Para:    tú
    Asunto:  La página del archivo está rota

    Hola:

    ¡He vuelto! Esta mañana actualicé la galería (versión 1.5): tiene una
    página nueva, el archivo, con un mosaico de todas nuestras fotos desde
    2019, 2400 en total. La página de inicio funciona, pero el archivo
    responde con un error:
      curl -i http://localhost:8080/archive

    Los socios la están esperando. No sé dónde mirar: en mi portátil
    funciona.

    La misma contraseña de sudo: nebulosa-2028.

    Amara

too-many-files-archive-page =
    <!DOCTYPE html>
    <html lang="es">
    <head><meta charset="utf-8"><title>Club de astronomía — archivo</title></head>
    <body>
    <h1>El archivo</h1>
    <p>{ $photos } fotos desde 2019, en mosaico.</p>
    </body>
    </html>

## Eventos

too-many-files-event-emfile =
    «EMFILE: too many open files»: la galería intentó abrir un archivo más,
    y el núcleo se negó. Cada proceso tiene un límite en el número de
    archivos que mantiene abiertos a la vez. ¿Cuántos tiene abiertos, y cuál
    es su límite? Todo lo de un proceso está en /proc/PID (su PID:
    systemctl status gallery).
too-many-files-event-limits =
    Max open files: un límite blando (lo que el proceso puede usar) y uno
    duro (el techo hasta el que puede subir él mismo su límite blando). El
    archivo abre sus 2400 fotos y las mantiene abiertas: 1024 no basta.
    ¿Quién le dio 1024 a la galería? Es un servicio: systemd, que la
    arranca.
too-many-files-event-ulimit-shell =
    ulimit cambia los límites de TU shell, y de lo que lances desde él. La
    galería la arrancó systemd: los límites de tu shell no la alcanzan.
too-many-files-event-limits-conf =
    /etc/security/limits.conf lo lee pam_limits cuando se abre una sesión
    (ssh, login, su). Un servicio de systemd no abre ninguna sesión: nunca
    lee este archivo. Sus límites vienen de su unidad (man systemd.exec:
    LimitNOFILE=).
too-many-files-event-too-small =
    La galería tiene ahora su propio límite, pero es demasiado bajo: el
    archivo mantiene unos { $need } archivos abiertos a la vez (2400 fotos,
    más lo que Node.js ya tiene). Dale margen: 4096, por ejemplo.
too-many-files-event-restart-needed =
    systemd tiene el nuevo límite, pero el proceso de la galería sigue con
    el antiguo: un límite se fija cuando arranca el proceso. Reinicia la
    galería (sudo systemctl restart gallery).
too-many-files-event-live-only =
    La galería en marcha tiene ahora suficiente (prlimit cambia los límites
    de un proceso en marcha). Pero solo hasta su próximo reinicio: systemd
    la volverá a arrancar con 1024. Escribe también el límite en su unidad.
too-many-files-event-end =
    El archivo responde 200: el mosaico ha vuelto, y su límite está en la
    unidad de la galería, así que sobrevivirá a los reinicios del servicio y
    de la máquina. Amara: «¡Así que por eso funcionaba en mi portátil: la
    lanzaba desde mi terminal!».

    ¡Bien hecho! Has terminado el capítulo «Demasiados archivos abiertos».

    QUÉ HA PASADO
    El archivo abre sus 2400 fotos y las mantiene abiertas. La galería, un
    servicio de systemd, tenía el límite por defecto de systemd: 1024
    archivos abiertos (blando), 524288 (duro). Pasados 1024, open() falla:
    EMFILE.

    DE DÓNDE VIENEN LOS LÍMITES
    - Un proceso hereda los límites de su padre, y puede bajarlos, o subir
      su límite blando hasta el duro.
    - systemd fija los límites de un servicio cuando lo arranca:
      LimitNOFILE= en la unidad (por defecto 1024:524288).
    - Una sesión de inicio los recibe de pam_limits (limits.conf), y ulimit
      cambia los del shell: ninguno de los dos alcanza a un servicio.
    - prlimit cambia los límites de un proceso en marcha, hasta que se
      reinicia.

    BUENA PRÁCTICA
    - Mira el proceso real: cat /proc/PID/limits, ls /proc/PID/fd | wc -l
      (lo que tiene abierto), lsof -p PID.
    - sudo systemctl edit gallery: {"["}Service] LimitNOFILE=4096, y luego
      sudo systemctl restart gallery.
    - Súbelo con mesura: un programa que mantiene miles de archivos abiertos
      quizá tenga también una fuga que corregir.

    DOCUMENTACIÓN
    - LimitNOFILE=: https://www.freedesktop.org/software/systemd/man/latest/systemd.exec.html#LimitCPU=
    - /proc/PID/limits: https://man7.org/linux/man-pages/man5/proc_pid_limits.5.html
    - prlimit: https://man7.org/linux/man-pages/man1/prlimit.1.html
