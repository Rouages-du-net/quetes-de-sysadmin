### Historia «El Laboratorio», capítulo 2 «El disco nuevo»: copiar una
### tabla de particiones (sfdisk), reconstruir el RAID (mdadm --add,
### /proc/mdstat), instalar GRUB en el disco nuevo. Los comandos, las
### opciones, las rutas y las salidas no se traducen.

chapter-new-disk = El disco nuevo
    .summary = El disco nuevo ha llegado, vacío: particionarlo como el otro sin equivocarse de sentido, reconstruir los dos arreglos RAID y hacer que el servidor pueda arrancar desde cualquiera de los dos discos.

## Archivos

new-disk-message-odile =
    Un mensaje de Odile (domingo, 8:05):

    «El proveedor contestó durante la noche: “Se ha sustituido el disco
    averiado. El disco nuevo se entrega vacío: te toca a ti particionarlo y
    reconstruir tu RAID.” Reconozco que no sé lo que quiere decir… En
    cualquier caso, el sitio web funciona.

    El voluntario anterior había dejado una nota: “los dos discos están
    particionados igual, y GRUB está en los dos, así que el servidor
    arranca aunque uno falle”.»

## Eventos

new-disk-event-new =
    El nuevo sdb: 1,8 T, ninguna partición. Los arreglos funcionan solo con
    sda ([U_] en /proc/mdstat). Antes de añadirlo al RAID, hay que
    particionarlo exactamente como sda: sfdisk puede escribir la tabla de un
    disco como un script, y volver a leerla (man sfdisk).
new-disk-event-too-early =
    mdadm no encuentra esa partición: sdb sigue vacío. Primero la tabla de
    particiones (la misma que la de sda), y luego los arreglos.
new-disk-event-direction =
    sfdisk se ha negado a escribir en un disco en uso: ¡menos mal! Era sda,
    el disco con el que funciona el servidor. En una tubería, el disco que
    se nombra en último lugar es el que se sobrescribe: sfdisk -d /dev/sda
    lee sda, sfdisk /dev/sdb escribe en sdb.
new-disk-event-disk-whole =
    Has metido el disco sdb ENTERO en un arreglo: su superbloque RAID ha
    sobrescrito su tabla de particiones, y ya no queda sitio ni para GRUB ni
    para el otro arreglo. Vuelve a sacarlo (--fail y luego --remove), copia
    la tabla de sda y añade la partición correcta: sdb2 en md0, sdb3 en md1.
new-disk-event-table =
    sdb está particionado como sda: sdb1 (BIOS boot, el sitio de GRUB), sdb2
    y sdb3 (Linux RAID). Ahora cada partición se une al arreglo de su
    gemela: sdb2 en md0, sdb3 en md1.
new-disk-event-added =
    Las dos particiones se han unido a su arreglo. Mira /proc/mdstat: se
    reconstruye un arreglo cada vez (recovery), el otro espera su turno
    (DELAYED). Mientras tanto, el servidor sigue sirviendo las fotos. Aquí
    el tiempo vuela: cada comando cuenta media hora.
new-disk-event-rebuilt =
    En todas partes [UU]: los dos arreglos vuelven a tener sus dos copias.
    Queda lo que importará el día que sda muera: poder arrancar desde sdb.
new-disk-event-grub =
    GRUB está instalado en sdb: si sda falla, el servidor puede arrancar
    desde el otro disco.
new-disk-event-end =
    Odile: «¿Así que si vuelve a fallar un disco, no perdemos nada y el
    servidor sigue arrancando? Estupendo».

    ¡Bien hecho! Has terminado el capítulo 2 de El Laboratorio. (Lo que
    sigue te espera: ssh laboratorio.)

    QUÉ HA PASADO
    El disco nuevo estaba vacío. Copiaste la tabla de particiones de sda
    (sfdisk -d, y luego sfdisk sobre sdb: el sentido importa), añadiste cada
    partición al arreglo de su gemela, seguiste la reconstrucción e
    instalaste GRUB en el disco nuevo.

    BUENA PRÁCTICA
    - Comprueba dos veces el disco de destino antes de escribir una tabla:
      lsblk, y su número de serie.
    - Añade particiones a los arreglos, no el disco entero, cuando el disco
      también lleva GRUB.
    - Sigue la reconstrucción (cat /proc/mdstat) y no reinicies nada antes
      de [UU].
    - GRUB en todos los discos de un RAID 1, o la avería del primero impide
      arrancar.
    - La tabla copiada conserva los identificadores del otro disco
      (label-id, uuid): en un servidor real, sgdisk -G /dev/sdb genera otros
      nuevos.
    - mdadm avisa cuando un arreglo se degrada (MAILADDR en
      /etc/mdadm/mdadm.conf): aun así, alguien tiene que leer el correo de
      root.

    DOCUMENTACIÓN
    - sfdisk: https://man7.org/linux/man-pages/man8/sfdisk.8.html
    - mdadm: https://man7.org/linux/man-pages/man8/mdadm.8.html
    - GRUB y la BIOS: https://www.gnu.org/software/grub/manual/grub/html_node/BIOS-installation.html
