### Pistas graduales de La Despensa (ver src/engine/hints.ts): un mensaje por
### paso, hint-<capítulo>-<evento>, con .lead (una dirección, sin el comando
### exacto) y .solution (casi la respuesta). Los nombres de lugares son los
### de names.ftl.

## Capítulo 1 — El disco perdido

hint-lost-disk-disk =
    .lead = Encuentra el disco de copias entre los discos del servidor: cuál es extraíble, qué sistema de archivos lleva, dónde está montado (man lsblk).
    .solution = lsblk, luego lsblk -f: sdb1, ext4 con la etiqueta OFFSITE, montado en /mnt/offsite.
hint-lost-disk-unmounted =
    .lead = Un dispositivo no se puede cifrar mientras está montado (man umount).
    .solution = sudo umount /mnt/offsite
hint-lost-disk-formatted =
    .lead = LUKS se configura con cryptsetup: su acción que escribe una cabecera nueva en un dispositivo pide YES en mayúsculas, y luego dos veces una frase de paso. La frase de paso de Mei está en su nota (man cryptsetup).
    .solution = sudo cryptsetup luksFormat /dev/sdb1, luego YES, luego dos veces la frase de paso de Mei.
hint-lost-disk-filesystem =
    .lead = El dispositivo cifrado hay que abrirlo con un nombre, y el sistema de archivos se hace en el dispositivo en claro que aparece en /dev/mapper (man cryptsetup, man mkfs.ext4).
    .solution = sudo cryptsetup open /dev/sdb1 offsite (la frase de paso de Mei), luego sudo mkfs.ext4 /dev/mapper/offsite.
hint-lost-disk-keyfile =
    .lead = La tarea nocturna necesita un archivo de clave: bytes aleatorios (dd lee /dev/urandom), legible solo por root, y luego añadido en otra ranura de clave (man dd, man chmod, man cryptsetup luksAddKey).
    .solution = sudo dd if=/dev/urandom of=/root/offsite.key bs=512 count=8, sudo chmod 400 /root/offsite.key, sudo cryptsetup luksAddKey /dev/sdb1 /root/offsite.key (la frase de paso de Mei).
hint-lost-disk-passphrase =
    .lead = Una ranura debe abrirse con la frase de paso que Mei guarda en el gestor de contraseñas: la de su nota (man cryptsetup luksAddKey).
    .solution = sudo cryptsetup luksAddKey /dev/sdb1 --key-file /root/offsite.key, luego dos veces la frase de paso de Mei.
hint-lost-disk-crypttab =
    .lead = /etc/crypttab nombra el disco: el nombre de la correspondencia, su UUID LUKS, el archivo de clave, y opciones para un disco extraíble (man crypttab; el UUID: cryptsetup luksUUID o blkid).
    .solution = sudo nano /etc/crypttab, añade: offsite UUID=<el UUID de sdb1> /root/offsite.key luks,noauto
hint-lost-disk-fstab =
    .lead = La línea antigua de fstab monta una etiqueta que ya no existe: debería montar en su lugar el dispositivo abierto, sin hacer esperar al arranque (man fstab).
    .solution = sudo nano /etc/fstab, sustituye la línea LABEL=OFFSITE por: /dev/mapper/offsite /mnt/offsite ext4 noauto,nofail 0 2
hint-lost-disk-copied =
    .lead = El disco está vacío: ábrelo, móntalo y copia en él los archivos de la despensa desde /srv (man cryptdisks_start, man rsync).
    .solution = sudo cryptdisks_start offsite (si está cerrado), sudo mount /mnt/offsite, sudo rsync -a /srv/despensa /mnt/offsite/
hint-lost-disk-closed =
    .lead = Antes de que el disco se vaya: desmóntalo, y luego cierra el dispositivo cifrado (man umount, man cryptsetup close o man cryptdisks_stop).
    .solution = cd (fuera de /mnt/offsite), sudo umount /mnt/offsite, sudo cryptsetup close offsite
hint-lost-disk-note =
    .lead = La frase de paso de Mei no pinta nada en el servidor una vez que está en una ranura.
    .solution = rm nota_de_mei.txt
hint-lost-disk-end =
    .lead = Todo a la vez: LUKS con la frase de paso de Mei y un archivo de clave que solo lee root, crypttab (UUID, noauto) y fstab, los archivos en el disco, el disco cerrado, la nota borrada.
    .solution = sudo cryptsetup luksDump /dev/sdb1 (dos ranuras), cat /etc/crypttab /etc/fstab, sudo ls -l /root, lsblk (nada abierto bajo sdb1), ls (ninguna nota).

## Capítulo 2 — La llave de repuesto

hint-spare-key-opened =
    .lead = El disco está cerrado: ábrelo como lo describe crypttab, y luego móntalo como lo hace fstab (man cryptdisks_start).
    .solution = sudo cryptdisks_start offsite, luego sudo mount /mnt/offsite.
hint-spare-key-job =
    .lead = Lee la tarea nocturna: ¿cómo le dice a restic dónde está el repositorio, y dónde está la contraseña?
    .solution = sudo cat /usr/local/sbin/nightly-backup: RESTIC_REPOSITORY=/mnt/offsite/restic, RESTIC_PASSWORD_FILE=/root/.restic-pass.
hint-spare-key-snapshots =
    .lead = Lista las instantáneas del repositorio, como root, con el repositorio y el archivo de contraseña que usa la tarea (man restic; sudo reinicia el entorno).
    .solution = sudo restic -r /mnt/offsite/restic -p /root/.restic-pass snapshots (o sudo RESTIC_REPOSITORY=… RESTIC_PASSWORD_FILE=… restic snapshots).
hint-spare-key-one-key =
    .lead = restic tiene un comando para las claves que abren un repositorio (man restic).
    .solution = sudo restic -r /mnt/offsite/restic -p /root/.restic-pass key list: una sola clave, con su contraseña solo en cajon.
hint-spare-key-escrowed =
    .lead = Añade una entrada cuya contraseña guarde Mei: la de su nota. Conserva la clave de la tarea (man restic, key add).
    .solution = sudo restic -r /mnt/offsite/restic -p /root/.restic-pass key add, luego dos veces la contraseña de Mei.
hint-spare-key-checked =
    .lead = Después de cambiar las claves del repositorio, compruébalo (man restic).
    .solution = sudo restic -r /mnt/offsite/restic -p /root/.restic-pass check
hint-spare-key-note =
    .lead = La contraseña de Mei debe vivir fuera del servidor.
    .solution = rm nota_de_mei.txt
hint-spare-key-closed =
    .lead = Deja el disco como lo encontraste: desmontado y cerrado (man cryptdisks_stop).
    .solution = sudo umount /mnt/offsite, luego sudo cryptdisks_stop offsite.
hint-spare-key-end =
    .lead = Todo a la vez: dos claves (la de la tarea y la de Mei), una comprobación tras añadir la suya, ninguna copia de su contraseña en cajon, el disco cerrado.
    .solution = key list (dos claves), check, rm de la nota, umount, cryptdisks_stop.

## Capítulo 3 — El simulacro de restauración

hint-restore-drill-plugged =
    .lead = El simulacro se hace en el portátil prestado: conéctate a él, y luego encuentra el disco y su tipo (man ssh, man lsblk).
    .solution = ssh repuesto, luego lsblk -f: sdb1 crypto_LUKS.
hint-restore-drill-opened =
    .lead = Abre el disco cifrado con la frase de paso del mensaje de Fatou, la del sobre (man cryptsetup open).
    .solution = sudo cryptsetup open /dev/sdb1 offsite, luego la frase de paso del disco.
hint-restore-drill-mounted =
    .lead = Monta el dispositivo abierto en una carpeta vacía de tu elección (man mkdir, man mount).
    .solution = sudo mkdir /mnt/offsite, luego sudo mount /dev/mapper/offsite /mnt/offsite.
hint-restore-drill-snapshots =
    .lead = Abre el repositorio con la contraseña restic del sobre, escrita cuando restic la pida (man restic).
    .solution = sudo restic -r /mnt/offsite/restic snapshots, luego la contraseña de recuperación restic.
hint-restore-drill-read-data =
    .lead = Comprueba el repositorio, releyendo cada byte de sus datos, no solo su estructura (man restic, check).
    .solution = sudo restic -r /mnt/offsite/restic check --read-data
hint-restore-drill-restored =
    .lead = Restaura la última instantánea al lado, bajo una carpeta de tu elección (man restic, restore).
    .solution = sudo restic -r /mnt/offsite/restic restore latest --target /srv/restore
hint-restore-drill-verified =
    .lead = La tarea escribió las huellas de los archivos en SHA256SUMS: compruébalas desde la carpeta donde se restauró (man sha256sum).
    .solution = cd /srv/restore/srv/despensa, luego sha256sum -c SHA256SUMS.
hint-restore-drill-no-dump =
    .lead = La línea 6 de la lista: busca el volcado de la base de datos en las copias (man restic, find).
    .solution = sudo restic -r /mnt/offsite/restic find pantry.sql: nada.
hint-restore-drill-fixed =
    .lead = En cajon, la tarea debe copiar también el volcado: su línea restic backup solo nombra una carpeta.
    .solution = exit (de vuelta a cajon), sudo nano /usr/local/sbin/nightly-backup: restic backup /srv/despensa /var/backups/pantry.sql
hint-restore-drill-closed =
    .lead = En repuesto, deja el disco desmontado y cerrado (man umount, man cryptsetup close).
    .solution = ssh repuesto, cd, sudo umount /mnt/offsite, sudo cryptsetup close offsite.
hint-restore-drill-end =
    .lead = Todo a la vez: en repuesto, el disco abierto con la frase de paso, el repositorio con la contraseña del sobre, check --read-data, los archivos restaurados y verificados, nada copiado de cajon, el disco cerrado; en cajon, la tarea copia el volcado.
    .solution = Rehaz lo que falte en repuesto (ssh repuesto), y comprueba /usr/local/sbin/nightly-backup en cajon.
