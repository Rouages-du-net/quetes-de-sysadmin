### Historia «El Laboratorio», capítulo 3 «Falta sitio»: un arreglo nuevo
### (mdadm --create), LVM (pvcreate, vgextend, lvextend), el sistema de
### archivos (resize2fs), mdadm.conf y el initramfs. Los comandos, las
### opciones, las rutas y las salidas no se traducen.

chapter-more-room = Falta sitio
    .summary = El disco de las fotos está lleno y llega el concurso de invierno: hacer un arreglo RAID con los dos discos nuevos, dárselo a LVM, ampliar el volumen y su sistema de archivos, y que el arranque lo recuerde.

## Archivos

more-room-message-odile =
    Un mensaje de Odile (sábado 15 de enero, 9:50):

    «¡Feliz año nuevo! El concurso de invierno empieza el lunes, y
    esperamos alrededor de 1,5 TB de fotos. Pero la galería ya dice “disco
    casi lleno”: ayer subimos todo el archivo de otoño.

    Hice lo que me dijiste: le pedí dos discos más al proveedor. Los
    conectaron esta mañana, dos discos de 4 TB. Dicen que están “vacíos,
    todo tuyo”.

    ¿Podemos ampliar el espacio de las fotos sin romper nada? Y sin perder
    la seguridad de los dos discos, claro.»

## Eventos

more-room-event-full =
    /srv está lleno al 97 %. No está en una partición, sino en
    /dev/mapper/laboratorio-photos: un volumen lógico LVM. ¿Qué queda en su
    grupo? (man vgs, man lvs, man pvs)
more-room-event-lvm =
    LVM apila tres capas: volúmenes físicos (PV, aquí el arreglo md1),
    reunidos en un grupo (VG laboratorio), en el que se recortan volúmenes
    lógicos (LV photos, montado en /srv). Al grupo no le queda ni una sola
    extensión libre. Los dos discos nuevos, sdc y sdd, esperan: primero un
    arreglo RAID 1 con ellos, para conservar la seguridad de dos discos
    (man mdadm, --create).
# { $disk }: the lone disk in the group
more-room-event-only =
    Cuidado: { $disk } ha entrado en el grupo laboratorio tal cual, sin
    RAID. Si ese disco muere, se pierde todo lo que LVM haya puesto en él,
    y con ello el volumen de fotos entero. Sácalo del grupo (man vgreduce).
    Si ya hay datos en él, muévelos antes (man pvmove) a un arreglo: un
    arreglo puede nacer con un solo disco y un hueco vacío («missing», man
    mdadm), y recibir su segundo disco más tarde.
# { $array }: the new array
more-room-event-array =
    { $array } está creado, y ya se puede usar: su primera sincronización
    (resync, en /proc/mdstat) se hace en segundo plano. Ahora se convierte
    en un volumen físico del grupo laboratorio (man pvcreate, man
    vgextend).
more-room-event-extended =
    El grupo laboratorio tiene sitio: vgs lo muestra (VFree). El volumen de
    fotos todavía no se ha movido: amplíalo (man lvextend).
more-room-event-lv-only =
    El volumen lógico ha crecido (lvs), pero df no ve nada: el sistema de
    archivos que lleva ha conservado su tamaño. También hay que ampliarlo
    (man resize2fs; la próxima vez, lvextend -r hace las dos cosas).
more-room-event-grown =
    /srv tiene sitio para el concurso de invierno, siempre en dos copias.
    Queda el arranque: el arreglo nuevo tiene que declararse en
    /etc/mdadm/mdadm.conf (su línea ARRAY: man mdadm, --detail --brief), o
    podría volver con otro nombre.
more-room-event-duplicates =
    mdadm.conf describe ahora un arreglo dos veces: mdadm --detail --scan
    también da md0 y md1, que ya estaban. Al arrancar, mdadm se quejaría.
    Deja una sola línea ARRAY por arreglo (sudo nano).
more-room-event-conf =
    El arreglo nuevo está en mdadm.conf. Pero al arrancar, lo que cuenta es
    la copia de ese archivo en el initramfs: reconstrúyelo (man
    update-initramfs).
more-room-event-end =
    Odile: «¿3,6 TB más? ¡Que venga el concurso!».

    ¡Bien hecho! Has terminado el capítulo 3 de El Laboratorio. (Lo que
    sigue te espera: ssh laboratorio.)

    QUÉ HA PASADO
    El volumen de las fotos (LVM, sobre el arreglo md1) estaba lleno.
    Hiciste un arreglo RAID 1 con los dos discos nuevos, se lo diste al
    grupo de volúmenes, y luego ampliaste el volumen lógico y su sistema de
    archivos, sin desmontar nada. Por último, el arreglo nuevo está
    declarado en mdadm.conf, y el initramfs lo conoce.

    BUENA PRÁCTICA
    - Primero el RAID, LVM encima: cada volumen físico debe ser redundante;
      un disco solo en el grupo pone en riesgo todo el volumen.
    - lvextend solo amplía el volumen: resize2fs (o lvextend -r) para el
      sistema de archivos; ext4 crece en caliente, pero no se reduce en
      caliente.
    - Deja un poco de espacio libre en el grupo: servirá para una
      instantánea (lvcreate -s) o para una urgencia.
    - Tras un arreglo nuevo: su línea ARRAY en mdadm.conf, una sola vez, y
      luego update-initramfs -u.
    - El RAID sigue sin sustituir a una copia de seguridad.

    DOCUMENTACIÓN
    - LVM: https://man7.org/linux/man-pages/man8/lvm.8.html
    - lvextend: https://man7.org/linux/man-pages/man8/lvextend.8.html
    - resize2fs: https://man7.org/linux/man-pages/man8/resize2fs.8.html
    - RAID por software en Debian: https://wiki.debian.org/SoftwareRAID
