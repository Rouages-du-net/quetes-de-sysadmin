### Historia «La Despensa», capítulo «El disco perdido»: el disco de copias,
### perdido en el tranvía y recuperado, no estaba cifrado. LUKS (cryptsetup),
### un archivo de clave y una frase de paso, /etc/crypttab y /etc/fstab. Los
### comandos, opciones, rutas, nombres de dispositivos y salidas no se
### traducen.

chapter-lost-disk = El disco perdido
    .summary = El disco de copias de la despensa pasó un fin de semana en objetos perdidos del tranvía, sin cifrar, con la lista de los hogares a los que ayuda. Cífralo con LUKS, da a la tarea nocturna un archivo de clave y a la tesorera una frase de paso, descríbelo en crypttab y fstab, y vuelve a poner la copia en él.

## Files

lost-disk-message-fatou =
    De: Fatou (coordinadora)
    Lunes, 9:02

    Hola, y gracias por venir tan rápido.

    El viernes por la tarde Joaquín se llevó el disco de copias a casa,
    como cada semana (el disco que sale del edificio, por si hay un
    incendio). Se dejó la mochila en el tranvía. Objetos perdidos se la ha
    devuelto esta mañana, con el disco dentro, aparentemente intacto.

    Aparentemente. Ese disco contiene una copia de todo: la lista de los
    hogares a los que ayudamos (familias.csv), con sus notas. Si alguien
    lo hubiera conectado a un portátil, podría haberlo leído todo.

    Quiero que esto no vuelva a ser posible nunca. Joaquín ha vuelto a
    conectar el disco a cajon (está montado en /mnt/offsite, como cada
    semana). Mei, nuestra tesorera, te ha dejado una nota.

    Fatou

lost-disk-note-mei =
    Nota de Mei (tesorera)

    Guardo las contraseñas de la asociación en nuestro gestor de
    contraseñas, y una copia en papel en un sobre cerrado en el banco.
    Para el disco de copias he generado esta frase de paso:

        { $passphrase }

    Ya está en el gestor de contraseñas («Disco de copias — LUKS») y en el
    sobre. Úsala para el disco, como una entrada que no depende del
    servidor. Luego borra esta nota: no pinta nada en cajon.

lost-disk-last-sync =
    rsync al disco externo: viernes 2 de marzo de 2029, 18:40, OK.

## Events

lost-disk-event-disk =
    Ahí está: sdb, un disco extraíble (RM 1), y su partición sdb1, un
    sistema de archivos ext4 normal con la etiqueta OFFSITE, montado en
    /mnt/offsite. Cualquiera puede leerlo en cualquier ordenador. Para
    cifrarlo, primero tiene que estar libre: nada montado, nadie usándolo.
lost-disk-event-system-disk =
    cryptsetup se ha negado: ese dispositivo está en uso. Menos mal, porque
    sda es el disco del propio cajon, desde el que funciona el sistema.
    Cifrarlo habría borrado el servidor. El disco de copias es el otro:
    compruébalo con lsblk (RM, SIZE, MOUNTPOINTS) antes de nombrar un
    dispositivo.
lost-disk-event-in-use =
    cryptsetup no formatea un dispositivo montado: desmóntalo primero
    (umount). No te preocupes por lo que contiene: es la copia del viernes
    pasado, y los originales están en cajon, en /srv.
lost-disk-event-unmounted =
    El disco está libre. Formatearlo con LUKS borra lo que contiene y
    escribe al principio una cabecera con ranuras de clave (man
    cryptsetup, luksFormat). Nombra el dispositivo con cuidado: la
    partición sdb1 (o el disco entero sdb).
lost-disk-event-lowercase =
    cryptsetup solo continúa si escribes YES, en mayúsculas: cualquier otra
    cosa, «yes» incluido, cancela. Es un reductor de velocidad a propósito:
    es el último momento para comprobar el nombre del dispositivo.
lost-disk-event-formatted =
    El dispositivo es ahora LUKS: una cabecera (cryptsetup luksDump muestra
    sus ranuras de clave) y, tras ella, solo datos cifrados. No se puede
    montar nada directamente: hay que abrirlo (cryptsetup open DISPOSITIVO
    NOMBRE), lo que crea un dispositivo en claro, /dev/mapper/NOMBRE.
    Atención: el sistema de archivos va en ese.
lost-disk-event-mounted-luks =
    mount no sabe qué hacer con crypto_LUKS: el dispositivo cifrado nunca
    se monta directamente. Ábrelo (cryptsetup open DISPOSITIVO NOMBRE), y
    luego monta /dev/mapper/NOMBRE una vez que tenga un sistema de
    archivos.
lost-disk-event-mkfs-header =
    mkfs.ext4 ha escrito encima de la propia partición cifrada: la
    cabecera LUKS ha desaparecido, y el disco vuelve a estar en claro. El
    sistema de archivos va en la correspondencia abierta,
    /dev/mapper/NOMBRE, nunca en el dispositivo que hay debajo. Vuelve a
    empezar con luksFormat.
lost-disk-event-filesystem =
    Un sistema de archivos ext4 vive dentro del dispositivo cifrado: lo que
    escribes en /dev/mapper/NOMBRE se cifra camino del disco. Ahora las
    claves. La tarea nocturna no puede escribir una frase de paso:
    necesita un archivo de clave (bytes aleatorios: dd desde
    /dev/urandom), legible solo por root, añadido en una segunda ranura
    (luksAddKey).
lost-disk-event-keyfile-open =
    Ese archivo de clave abre el disco, y alguien que no es root puede
    leerlo (ls -l: sus permisos, su propietario). Un archivo de clave es
    una contraseña: chmod 400, propiedad de root, en una carpeta en la que
    solo entra root (/root).
lost-disk-event-keyfile-on-disk =
    Ese archivo de clave está en el propio disco de copias: una llave
    dejada en la cerradura. Se iría con el disco, y de todas formas no
    puede abrir aquello en lo que está. Guárdalo en cajon, en /root.
lost-disk-event-keyfile =
    El archivo de clave abre el disco, y solo root puede leerlo: la tarea
    nocturna podrá abrirlo sin que nadie escriba nada. Pero si cajon
    muere, esa clave muere con él. El disco también debe abrirse con algo
    guardado en otro sitio: la frase de paso de Mei.
lost-disk-event-own-passphrase =
    Esa frase de paso está en una ranura, pero no es la que guarda Mei: si
    la olvidas, nadie más puede abrir el disco. Añade también la suya
    (luksAddKey), y después puedes quitar la tuya (luksRemoveKey).
lost-disk-event-passphrase =
    La frase de paso de Mei abre el disco: si cajon se quema, su sobre
    basta para leer la copia en cualquier máquina Linux.
lost-disk-event-insecure =
    cryptdisks_start avisa sobre los permisos del archivo de clave: debería
    pertenecer a root y no poder leerlo nadie más (chmod 400 o 600).
lost-disk-event-crypttab-name =
    Esa línea de crypttab nombra el disco por /dev/sdX: el nombre de un
    disco USB cambia con el orden en que se conectan los discos. Usa su
    UUID LUKS (UUID=…, ver blkid o cryptsetup luksUUID).
lost-disk-event-crypttab-auto =
    Esa línea de crypttab haría que el arranque esperara a un disco que se
    va todos los fines de semana. Un disco extraíble lleva noauto (abierto
    bajo demanda, cryptdisks_start) o nofail.
lost-disk-event-crypttab =
    /etc/crypttab describe el disco: su nombre, su UUID, el archivo de
    clave, y noauto. cryptdisks_start NOMBRE lo abre con el archivo de
    clave, como lo hará la tarea nocturna. Ahora /etc/fstab: la línea
    antigua monta una etiqueta que ya no existe.
lost-disk-event-fstab =
    /etc/fstab monta /dev/mapper/NOMBRE, no al arrancar (noauto o nofail):
    una vez abierto el disco, basta con mount /mnt/offsite.
lost-disk-event-copied =
    Los archivos de la despensa vuelven a estar en el disco cifrado: esta
    semana, al menos, hay copia.
lost-disk-event-busy =
    La correspondencia sigue en uso: hay algo montado en ella. Desmonta
    primero (umount), y luego cierra.
lost-disk-event-closed =
    El disco está cerrado: sin una clave, no es más que ruido. Joaquín
    puede llevárselo el viernes.
lost-disk-event-note =
    La nota de Mei ya no está en cajon: la frase de paso solo vive donde
    debe, en el gestor de contraseñas y en el sobre.
lost-disk-event-note-early =
    Has borrado la nota de Mei antes de que su frase de paso estuviera en
    una ranura: te la acaba de volver a enviar (cat de la nota). Bórrala
    una vez que el disco se abra con ella.
lost-disk-event-end =
    Fatou: «¿Así que si la mochila vuelve a perderse, quien la encuentre se
    lleva un ladrillo? ¿Y si cajon muere, el sobre de Mei lo abre?
    Perfecto.»

    ¡Bien hecho! Has terminado el capítulo 1 de La Despensa. (Te espera lo
    que viene después: ssh cajon.)

    QUÉ HA PASADO
    El disco de copias viajaba en claro. Lo desmontaste, lo cifraste con
    LUKS (cryptsetup luksFormat, tras un YES en mayúsculas), lo abriste e
    hiciste el sistema de archivos en la correspondencia
    (/dev/mapper/NOMBRE), le diste dos claves: un archivo de clave que solo
    lee root, para la tarea nocturna, y la frase de paso de Mei, guardada
    fuera del servidor. crypttab y fstab lo describen, los archivos
    vuelven a estar en él, y sale del edificio cerrado.

    BUENA PRÁCTICA
    - Todo disco que sale del edificio va cifrado: una copia perdida debe
      ser un objeto perdido, no una fuga de datos.
    - Comprueba dos veces el dispositivo antes de luksFormat (lsblk: RM,
      SIZE, el modelo).
    - Nunca una sola clave: una automática (un archivo de clave, solo root)
      y una humana guardada en otro sitio (gestor de contraseñas, sobre
      cerrado).
    - Un archivo de clave nunca se guarda en el disco que abre, y nunca lo
      puede leer nadie más que root.
    - crypttab y fstab: el UUID en lugar de /dev/sdX, noauto o nofail para
      un disco extraíble, para que el arranque no lo espere.
    - Haz también copia de la cabecera LUKS (cryptsetup
      luksHeaderBackup): una cabecera dañada inutiliza todas las claves.
    - Cifrado no es copiado: vuelve a copiar los archivos, y prueba a
      abrirlo con cada clave.

    DOCUMENTACIÓN
    - cryptsetup: https://man7.org/linux/man-pages/man8/cryptsetup.8.html
    - crypttab: https://man7.org/linux/man-pages/man5/crypttab.5.html
    - FAQ de cryptsetup: https://gitlab.com/cryptsetup/cryptsetup/-/wikis/FrequentlyAskedQuestions
    - crypttab y cryptdisks en Debian: https://cryptsetup-team.pages.debian.net/cryptsetup/README.Debian.html
