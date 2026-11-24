### Historia «El Centro de Salud», capítulo «Muy justo»: el hipervisor usa
### swap (la memoria de sus invitados está sobrecomprometida), y el disco de
### un invitado está lleno. free, virsh dommemstat, setmem --live --config,
### snapshot-create-as, blockresize (o qemu-img resize con la máquina
### apagada), growpart, resize2fs, snapshot-delete. Los comandos, las
### opciones, las rutas y las salidas no se traducen.

chapter-tight-fit = Muy justo
    .summary = Todo va lento en Millbrook, y las historias clínicas se niegan a guardar. El hipervisor ha prometido a sus invitados más memoria de la que tiene, y el disco de un invitado está lleno de archivos que la ley obliga a conservar. Reparte la memoria con sensatez, amplía un disco con seguridad con una instantánea como red, y no conserves la red para siempre.

## Archivos

tight-fit-message-grace =
    De: Grace (gerente del centro)
    Jueves 18 de abril, 14:00

    Todo va lentísimo hoy: agenda tarda diez segundos en abrir un día, el
    portal se queda sin respuesta. Y Joon dice que la aplicación de
    historias clínicas se niega a guardar las notas de sus consultas (su
    nota está en tu carpeta personal).

    Antes de cambiar nada en records, por favor asegúrate de que podemos
    volver atrás si sale mal. La copia de seguridad de anoche está en el
    NAS, como siempre.

    Grace

tight-fit-note-joon =
    Nota de Joon (enfermera)

    La aplicación de historias clínicas dice «could not write to file». La
    empresa informática que la instaló dice que el disco del servidor está
    lleno, y que las exportaciones mensuales de /srv/records/exports NO se
    deben borrar: tenemos que conservarlas (mira RETENTION.txt en records).

    Joon

tight-fit-retention =
    CONSERVACIÓN - exportaciones de records

    Exportaciones mensuales de la aplicación de historias clínicas.
    Conservarlas en su sitio durante el plazo exigido por la política del
    centro. No borrar, no mover. Preguntas: Grace.

## Eventos

tight-fit-event-swap =
    hogar usa swap: su RAM está llena, y el núcleo empuja páginas de
    memoria al disco, y luego las vuelve a traer. Todos los invitados se
    ralentizan. ¿Quién ocupa qué? virsh list, virsh dominfo para cada
    invitado (Used memory), virsh nodeinfo para hogar, y desde dentro:
    virsh dommemstat records.
tight-fit-event-memstat =
    A records le dieron 16 GiB. Lo que usa de verdad es «actual» menos lo
    que está «unused» y lo que solo es caché (disk_caches): unos 3,4 GiB.
    Un invitado llena de caché la memoria que se le da, y esa memoria se
    pierde para el anfitrión. El balón puede devolverla: virsh setmem (man
    virsh, sus --live y --config).
tight-fit-event-too-high =
    setmem no puede pasar de la memoria máxima del dominio (<memory>): esa
    se cambia con setmaxmem --config, y solo se aplica en el próximo
    arranque.
tight-fit-event-config-only =
    --config cambia la definición, para el próximo arranque: records sigue
    ocupando ahora 16 GiB, y hogar sigue usando swap. --live cambia el
    invitado en marcha (el balón); las dos a la vez es la respuesta
    habitual.
tight-fit-event-memory-fixed =
    hogar ya no usa swap, y las definiciones también caben en su RAM en
    el próximo arranque: los invitados juntos reciben menos de lo que tiene
    el anfitrión, con margen para el propio hogar.
tight-fit-event-guest-full =
    El sistema de archivos raíz de records está lleno: 20 GiB, y las
    exportaciones tienen que quedarse. El disco tiene que crecer: primero
    la imagen (desde hogar), luego la partición y el sistema de archivos
    (dentro del invitado). Pero Grace pidió antes una forma de volver
    atrás.
tight-fit-event-lock =
    qemu-img se niega: records está en marcha y QEMU tiene un bloqueo de
    escritura sobre su imagen. Cambiar el tamaño de una imagen a espaldas
    de un invitado en marcha la corrompería. Mientras funciona: virsh
    blockresize, a través de QEMU. O apágalo, y luego qemu-img resize.
tight-fit-event-shrink-refused =
    Reducir un disco corta su final, con lo que haya escrito allí: QEMU se
    niega salvo que se le diga --shrink, y solo después de haber reducido
    antes el sistema de archivos y la partición. Aquí el disco tiene que
    crecer.
tight-fit-event-shrunk =
    La imagen se ha reducido por debajo de lo que records había escrito: el
    final de su disco ha desaparecido, sistema de archivos incluido. Si
    hiciste antes una instantánea, virsh snapshot-revert recupera el
    disco; si no, vuelve a empezar el capítulo (o usa la instantánea de
    rescate).
tight-fit-event-snapshot =
    Una instantánea de records, tomada antes de tocar su disco: una forma
    de volver atrás si la ampliación sale mal (virsh snapshot-revert). Vive
    dentro de records.qcow2: en el mismo disco, protege de un error, no de
    la pérdida del disco.
tight-fit-event-grown =
    La imagen de records es más grande: el núcleo del invitado lo vio
    enseguida (dmesg en el invitado, lsblk). La partición y el sistema de
    archivos no han crecido: en el invitado, growpart, luego resize2fs (man
    growpart).
tight-fit-event-grown-no-net =
    La imagen de records es más grande. Ha ido bien, pero sin instantánea
    previa: si hubiera salido mal, la copia de seguridad de anoche era la
    única forma de volver. Ahora la partición y el sistema de archivos: en
    el invitado, growpart, luego resize2fs.
tight-fit-event-partition =
    La partición ocupa ahora todo el disco (lsblk). El sistema de archivos
    todavía tiene su tamaño antiguo: resize2fs amplía un sistema de
    archivos ext4 mientras está montado.
tight-fit-event-filesystem =
    El sistema de archivos de records tiene sitio (df -h en el invitado):
    la aplicación puede volver a escribir, y las exportaciones siguen ahí.
    Comprueba, y luego no olvides las instantáneas: virsh snapshot-list
    records.
tight-fit-event-cleaned =
    No queda ninguna instantánea en records: ni la tuya, ya inútil, ni la
    de Ilse de octubre, a la que nadie volvería nunca (desharía seis meses
    de historias clínicas).
tight-fit-event-end =
    Grace: «agenda se abre al instante, y las notas de Joon se guardan.
    ¡Gracias!»

    ¡Bien hecho! Has terminado el capítulo «Muy justo».

    QUÉ HA PASADO
    A los invitados de hogar se les había prometido más memoria de la que
    tiene hogar; records solo ya ocupaba 16 GiB, llenos de caché, para 3,4
    GiB de uso real, y hogar usaba swap. Le diste a records 6 GiB ahora y
    en su próximo arranque (setmem --live --config). Su disco estaba lleno
    de exportaciones que tienen que quedarse: hiciste una instantánea,
    ampliaste la imagen (virsh blockresize con la máquina en marcha, o
    qemu-img resize con ella apagada), ampliaste la partición (growpart) y
    el sistema de archivos (resize2fs) en el invitado, comprobaste, y
    borraste las instantáneas.

    BUENA PRÁCTICA
    - Suma lo que reciben los invitados (su memoria actual) y mantenlo por
      debajo de lo que tiene el anfitrión, con margen para el propio
      anfitrión. Un invitado llena su memoria de caché: dommemstat dice lo
      que usa de verdad.
    - setmem --live para ahora, --config para el próximo arranque;
      setmaxmem solo con el dominio apagado.
    - Amplía un disco en tres pasos: la imagen, la partición, el sistema de
      archivos. Nunca cambies el tamaño de una imagen que usa un QEMU en
      marcha a sus espaldas, y nunca reduzcas sin reducir antes lo que hay
      dentro.
    - Una instantánea antes de un cambio arriesgado, borrada justo
      después: una instantánea está en el mismo disco, no es una copia de
      seguridad, y una antigua pesa sobre la imagen para siempre.

    DOCUMENTACIÓN
    - virsh (setmem, dommemstat, blockresize, instantáneas): https://libvirt.org/manpages/virsh.html
    - qemu-img resize: https://www.qemu.org/docs/master/tools/qemu-img.html
    - growpart: https://manpages.debian.org/trixie/cloud-guest-utils/growpart.1.en.html
    - resize2fs: https://man7.org/linux/man-pages/man8/resize2fs.8.html
    - La memoria en el XML de un dominio: https://libvirt.org/formatdomain.html#memory-allocation
