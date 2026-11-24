### Historia «El Laboratorio», capítulo 4 «El reinicio atascado»: el modo
### de emergencia, /etc/fstab por UUID, nofail, findmnt --verify, mount -a,
### systemctl daemon-reload. Los comandos, las opciones, las rutas y las
### salidas no se traducen.

chapter-stuck-boot = El reinicio atascado
    .summary = El servidor ya no se reinicia: espera un disco que ha cambiado de nombre. Entender el modo de emergencia, designar el disco por su UUID, comprobar fstab antes de reanudar el arranque.

## Archivos

# The line Théo added to /etc/fstab (a comment)
stuck-boot-fstab-comment = # Disco USB de los escaneos (Theo, de un tutorial que segui en mi portatil)
# { $banner }: the emergency mode message, in English as on the real console
stuck-boot-message-odile =
    Un mensaje de Odile (martes 25 de enero, 7:50):

    «¡El sitio web no funciona desde anoche! El proveedor dice que el
    servidor se reinició por una actualización (un núcleo nuevo), y que “se
    paró en modo de emergencia”. Nos han abierto su consola: es como estar
    delante de la pantalla del servidor, como root. Esto es lo que dice:

    { $banner }

    La semana pasada Théo conectó su disco USB, el de los escaneos de los
    negativos antiguos, y lo añadió “para que se monte solo”. A veces se lo
    lleva al club para escanear. ¿Tendrá algo que ver?»

## Eventos

stuck-boot-event-journal =
    systemd esperó 90 segundos a /dev/sdc1 y luego se rindió: sin él,
    /srv/scans no se puede montar, y local-fs.target (todos los sistemas de
    archivos locales) falla. La máquina se para entonces en modo de
    emergencia, sin arrancar sus servicios. Pero ¿quién es sdc hoy?
    (lsblk -f, blkid)
stuck-boot-event-disks =
    sdc es uno de los dos discos de 4 TB, que entró en md2 en el capítulo
    anterior: ya ni siquiera tiene partición. El disco USB de Théo se llama
    ahora sde (RM = 1: extraíble), y su partición lleva la etiqueta SCANS.
    Los nombres sdX siguen el orden en que el núcleo encuentra los discos;
    el UUID no cambia.
stuck-boot-event-name =
    /dev/sde1 funcionaría hoy… hasta que se añada el próximo disco, o hasta
    el próximo arranque en que el disco USB se encuentre antes que otro.
    Como las dos primeras líneas de fstab, desígnalo por lo que no cambia:
    UUID=… (o LABEL=…).
stuck-boot-event-deleted =
    Sin su línea en fstab, el servidor arrancaría… pero los escaneos de
    Théo no volverían a montarse nunca. Conserva la línea, y corrígela.
stuck-boot-event-read =
    fstab tiene ahora una línea ilegible (necesita al menos cuatro campos:
    origen, punto de montaje, tipo, opciones): mount -a lo señala, y el
    arranque la ignoraría. Vuelve a leer el archivo.
stuck-boot-event-without-nofail =
    El UUID es correcto. Pero Théo a veces se lleva el disco: ese día, el
    servidor volvería a pararse en modo de emergencia. La opción nofail
    (man fstab) le dice a systemd que siga sin él.
stuck-boot-event-fixed =
    fstab es correcto: el disco de los escaneos por su UUID, con nofail.
    Antes de reanudar el arranque, compruébalo (findmnt --verify), pruébalo
    (mount -a) y haz que systemd lo relea: dedujo sus unidades de montaje
    de la versión antigua (systemctl daemon-reload).
stuck-boot-event-relapse =
    El arranque se ha reanudado… y ha vuelto a pararse en modo de
    emergencia: systemd sigue esperando un disco que no encuentra. Corrige
    primero fstab.
stuck-boot-event-relapse-reload =
    El arranque se ha reanudado… y ha vuelto a pararse en modo de
    emergencia: fstab es correcto, pero systemd sigue usando la versión
    antigua, la que leyó al arrancar. systemctl daemon-reload hace que lo
    relea.
stuck-boot-event-mounted =
    El disco de los escaneos está montado en /srv/scans (df -h, findmnt).
    Queda salir del modo de emergencia: reanuda el arranque normal (man
    systemctl: default, o exit), o reinicia.
stuck-boot-event-end =
    Odile: «¡El sitio web ha vuelto! Y Théo recupera sus escaneos. Dice que
    nunca más copiará un tutorial sin entenderlo».

    ¡Bien hecho! Has terminado el capítulo 4, y la historia de El
    Laboratorio.

    QUÉ HA PASADO
    Una línea de /etc/fstab designaba el disco USB por su nombre,
    /dev/sdc1. Los dos discos de 4 TB añadidos en el capítulo 3 tomaron los
    nombres sdc y sdd; el disco USB pasó a ser sde. Al reiniciar, systemd
    esperó a /dev/sdc1, y luego paró la máquina en modo de emergencia.
    Encontraste el disco por su UUID, corregiste fstab con nofail, lo
    comprobaste, hiciste que systemd releyera el archivo y reanudaste el
    arranque.

    BUENA PRÁCTICA
    - En fstab, UUID=… o LABEL=…, nunca /dev/sdX.
    - nofail para cualquier disco que pueda faltar (USB, disco externo);
      x-systemd.device-timeout=10s para no esperar 90 segundos.
    - Tras cada cambio: findmnt --verify, mount -a, y luego systemctl
      daemon-reload, antes de reiniciar.
    - El modo de emergencia no es una avería: una shell de root, el journal
      (journalctl -xb), y lo necesario para reparar. Consigue el acceso a la
      consola del proveedor antes de necesitarlo.
    - Lleva un registro de lo que añades al servidor, y por qué.

    DOCUMENTACIÓN
    - fstab: https://man7.org/linux/man-pages/man5/fstab.5.html
    - systemd.mount (nofail, x-systemd.*): https://www.freedesktop.org/software/systemd/man/latest/systemd.mount.html
    - findmnt: https://man7.org/linux/man-pages/man8/findmnt.8.html
    - fstab en Debian: https://wiki.debian.org/fstab
