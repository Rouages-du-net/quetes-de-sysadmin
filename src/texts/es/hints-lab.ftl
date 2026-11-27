### Pistas graduadas de El Laboratorio (ver src/engine/hints.ts): un mensaje
### por paso, hint-<capítulo>-<evento>, con .lead (una dirección, sin el
### comando exacto) y .solution (casi la respuesta). Los nombres de lugares
### son los de names.ftl.

## Capítulo 1 — El disco cansado

hint-tired-disk-alert =
    .lead = Odile habla de correos de smartd: léelos (man mail, y el archivo de tu buzón). El núcleo, por su parte, lleva la cuenta de los errores de lectura (man dmesg).
    .solution = mail, y luego cat /var/mail/tu (o sudo dmesg): sdb tiene sectores ilegibles.
hint-tired-disk-arrays =
    .lead = Antes de tocar un disco, mira para qué sirve: el RAID por software muestra el estado de sus arreglos en un archivo de /proc (man mdadm).
    .solution = cat /proc/mdstat (o sudo mdadm --detail /dev/md0): md0 y md1, cada uno con una partición de sda y otra de sdb.
hint-tired-disk-smart =
    .lead = Pregúntale a sdb por su salud, completa: identidad, veredicto, atributos (man smartctl). Luego compara con sda.
    .solution = sudo smartctl -a /dev/sdb (Reallocated_Sector_Ct, Current_Pending_Sector), y luego sudo smartctl -a /dev/sda.
hint-tired-disk-removed =
    .lead = Cada partición de sdb tiene que salir de su arreglo: primero declarada averiada, luego retirada (man mdadm). Hay dos arreglos.
    .solution = sudo mdadm --manage /dev/md0 --fail /dev/sdb2 --remove /dev/sdb2, y luego lo mismo para /dev/sdb3 en /dev/md1.
hint-tired-disk-ticket =
    .lead = El procedimiento del proveedor pide dos cosas del disco: el identificador que no cambia nunca, aunque cambien los nombres sda y sdb, y el atributo SMART que muestra que falla (man smartctl).
    .solution = sudo smartctl -a /dev/sdb (Serial Number, y el valor bruto de Reallocated_Sector_Ct: 1208), y luego nano ~/ticket.txt: una solicitud de sustitución con los dos, y no el número de sda.
hint-tired-disk-end =
    .lead = Hace falta todo a la vez: nada de sdb en los arreglos, sda todavía activo en los dos, y una solicitud que da el número de serie de sdb (no el de sda) y sus sectores reasignados.
    .solution = cat /proc/mdstat ([U_] para md0 y md1, sin sdb) y cat ~/ticket.txt (solo el número de sdb).

## Capítulo 2 — El disco nuevo

hint-new-disk-new =
    .lead = Mira los discos y sus particiones: ¿qué se ha entregado en lugar del antiguo sdb? (man lsblk)
    .solution = lsblk: sdb no tiene ninguna partición; cat /proc/mdstat: los arreglos están en [U_].
hint-new-disk-table =
    .lead = El disco nuevo tiene que particionarse exactamente como sda: sfdisk puede escribir la tabla de un disco como un script, y otro sfdisk puede volver a leerla (man sfdisk). Cuidado con el sentido.
    .solution = sudo sfdisk -d /dev/sda | sudo sfdisk /dev/sdb (y luego lsblk para comprobar).
hint-new-disk-added =
    .lead = Cada partición nueva se une al arreglo de su gemela en sda (man mdadm, añadir un miembro).
    .solution = sudo mdadm --manage /dev/md0 --add /dev/sdb2, y luego sudo mdadm --manage /dev/md1 --add /dev/sdb3.
hint-new-disk-rebuilt =
    .lead = La reconstrucción lleva su tiempo: síguela en el archivo que muestra el estado de los arreglos, hasta que estén completos.
    .solution = cat /proc/mdstat, varias veces, hasta [UU] para md0 y md1.
hint-new-disk-grub =
    .lead = El servidor tiene que poder arrancar desde el disco nuevo: el cargador de arranque se instala en el disco entero (man grub-install).
    .solution = sudo grub-install /dev/sdb
hint-new-disk-end =
    .lead = Hace falta todo a la vez: sdb particionado como sda, los dos arreglos completos y al día, y GRUB en sdb.
    .solution = lsblk, cat /proc/mdstat ([UU] en todas partes), sudo grub-install /dev/sdb si todavía no está hecho.

## Capítulo 3 — Falta sitio

hint-more-room-full =
    .lead = Mira cómo de llenos están los sistemas de archivos (man df): ¿cuál está lleno, y en qué dispositivo?
    .solution = df -h: /srv, en /dev/mapper/laboratorio-photos, está lleno al 97 %.
hint-more-room-lvm =
    .lead = /srv es un volumen lógico LVM: mira sus tres capas, volúmenes físicos, grupos y volúmenes lógicos (man pvs, man vgs, man lvs).
    .solution = sudo vgs (VFree a 0), sudo pvs (md1 solo), sudo lvs; luego lsblk: sdc y sdd son nuevos.
hint-more-room-array =
    .lead = Antes de dar los discos nuevos a LVM, haz con ellos un arreglo RAID 1, para conservar dos copias (man mdadm, crear un arreglo).
    .solution = sudo mdadm --create /dev/md2 --level=1 --raid-devices=2 /dev/sdc /dev/sdd, y luego y para confirmar.
hint-more-room-extended =
    .lead = El arreglo nuevo tiene que convertirse en un volumen físico, y luego unirse al grupo laboratorio (man pvcreate, man vgextend).
    .solution = sudo pvcreate /dev/md2, y luego sudo vgextend laboratorio /dev/md2 (sudo vgs: VFree ha crecido).
hint-more-room-grown =
    .lead = Amplía el volumen lógico photos, y luego el sistema de archivos que lleva (man lvextend, man resize2fs).
    .solution = sudo lvextend -r -l +100%FREE /dev/laboratorio/photos (o lvextend sin -r, y luego sudo resize2fs /dev/laboratorio/photos); df -h /srv para comprobar.
hint-more-room-conf =
    .lead = El arreglo nuevo tiene que declararse en /etc/mdadm/mdadm.conf, una sola vez: mdadm puede escribir su línea ARRAY (man mdadm). Cuidado, el archivo pertenece a root.
    .solution = sudo mdadm --detail --brief /dev/md2 | sudo tee -a /etc/mdadm/mdadm.conf
hint-more-room-end =
    .lead = El arranque lee una copia de mdadm.conf, guardada en el initramfs: reconstrúyelo (man update-initramfs). También necesitas al menos 1,5 TB libres en /srv, y ningún disco solo en el grupo.
    .solution = sudo update-initramfs -u

## Capítulo 4 — El reinicio atascado

hint-stuck-boot-journal =
    .lead = El mensaje del modo de emergencia dice dónde mirar: el journal de este arranque, con sus explicaciones (man journalctl).
    .solution = journalctl -xb (o journalctl -b -p err): «Timed out waiting for device /dev/sdc1».
hint-stuck-boot-disks =
    .lead = ¿Quién es sdc hoy, y adónde ha ido el disco USB? Mira los discos con sus sistemas de archivos, etiquetas y UUID (man lsblk, man blkid).
    .solution = lsblk -f (o blkid): sdc está en md2; el disco USB es sde, su partición sde1 lleva la etiqueta SCANS y un UUID.
hint-stuck-boot-fixed =
    .lead = En /etc/fstab, la línea de los escaneos tiene que designar el disco por lo que no cambia, y no bloquear el arranque si falta (man fstab: UUID=, nofail).
    .solution = nano /etc/fstab: UUID=c27a9e41-5b3d-4f8a-a1e6-9d0b2c4f7e13  /srv/scans  ext4  defaults,nofail  0  2 (el UUID que da blkid), y luego findmnt --verify.
hint-stuck-boot-mounted =
    .lead = Prueba fstab sin reiniciar: mount puede montar todo lo que describe el archivo (man mount). Y systemd tiene que releer el archivo (man systemctl).
    .solution = systemctl daemon-reload, luego mount -a, y luego df -h /srv/scans.
hint-stuck-boot-end =
    .lead = Queda salir del modo de emergencia: reanuda el arranque normal, como dice el mensaje de la consola (man systemctl).
    .solution = systemctl default (o exit, o reboot)
