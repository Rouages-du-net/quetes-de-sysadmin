### Historia «El Club de Fotografía», capítulo 1 «La carpeta compartida»:
### una exportación NFS (/etc/exports, exportfs), el cortafuegos,
### mount -t nfs y fstab. La configuración, las rutas y las salidas de las
### herramientas no se traducen.

chapter-nfs-export = La carpeta compartida
    .summary = Las fotos del club viven en el NAS. El ordenador del laboratorio debería verlas como una de sus propias carpetas, y seguir viéndolas tras un reinicio.

## Archivos

nfs-export-message-margot =
    De:      Margot
    Para:    tú
    Asunto:  Las fotos en el ordenador del laboratorio

    Hola:

    ¡Bienvenida o bienvenido a las máquinas del club! El NAS (donde estás)
    guarda todas nuestras fotos en /srv/photos. En el laboratorio hay un
    ordenador (darkroom, lo alcanzas con ssh darkroom desde aquí) donde
    retocamos e imprimimos.

    Hoy copiamos las fotos de un lado a otro con memorias USB. Me encantaría
    que el ordenador del laboratorio viera la carpeta del NAS en
    /mnt/photos, como si fuera suya, y que siguiera ahí después de un
    reinicio.

    Solo el ordenador del laboratorio, por favor: el NAS está en la red del
    club, donde también están los portátiles de los visitantes.

    Tu contraseña de sudo (en las dos máquinas): obturador-2028.

    Margot

## Eventos

nfs-export-event-exports =
    /etc/exports es la lista de lo que el NAS comparte por NFS, y con quién:
    una línea por carpeta, y luego cada cliente con sus opciones entre
    paréntesis, sin espacio delante (man exports):
    /srv/photos 192.0.2.32(rw,sync,no_subtree_check). Sin rw, una
    exportación es de solo lectura.
nfs-export-event-not-loaded =
    La línea está en /etc/exports, pero el NAS sigue sirviendo su lista
    antigua: el servidor lee el archivo cuando arranca, o cuando se lo pides
    (sudo exportfs -ra; exportfs -v muestra lo que sirve).
nfs-export-event-loaded =
    El NAS sirve ahora /srv/photos al ordenador del laboratorio
    (exportfs -v). Ahora el cliente: ssh darkroom, y luego mount (man mount,
    man nfs).
nfs-export-event-too-open =
    Cuidado: esta exportación es para todo el mundo (*), o con
    no_root_squash. Los portátiles de los visitantes podrían montarla, y
    root en un cliente sería root sobre las fotos. Exporta solo al ordenador
    del laboratorio, y conserva root_squash (el valor por defecto).
nfs-export-event-no-mount-point =
    Un montaje necesita una carpeta existente a la que engancharse: crea
    antes /mnt/photos (sudo mkdir).
nfs-export-event-firewall =
    El montaje espera, y luego se rinde: nada responde. El cortafuegos del
    NAS solo deja entrar SSH, y NFS (puerto 2049) se descarta. Ábrelo solo
    para el ordenador del laboratorio (man ufw). showmount también pregunta
    a rpcbind (puerto 111); mount solo, en NFSv4, solo necesita el 2049.
nfs-export-event-denied =
    El NAS responde, y se niega: su lista de exportaciones no incluye este
    cliente (o sigue siendo la antigua). Comprueba lo que sirve:
    sudo exportfs -v en el NAS, y la dirección del ordenador del
    laboratorio.
nfs-export-event-mounted =
    /mnt/photos muestra las fotos del NAS (df -h, mount | grep nfs). Hasta
    el próximo reinicio: para que vuelva, el /etc/fstab del ordenador del
    laboratorio tiene que describirlo (man fstab; _netdev espera a la red).
nfs-export-event-read-only =
    Está montado, pero en solo lectura: una exportación sin rw es ro. Añade
    rw a las opciones de la exportación en el NAS, y luego
    sudo exportfs -ra.
nfs-export-event-end =
    El ordenador del laboratorio ve las fotos en /mnt/photos, y fstab las
    traerá de vuelta en cada arranque. Margot: «¡Se acabaron las memorias
    USB! Sam ya está imprimiendo desde el NAS».

    ¡Bien hecho! Has terminado el capítulo «La carpeta compartida».

    QUÉ HA PASADO
    El NAS no exportaba nada (el /etc/exports de Debian son todo
    comentarios), y su cortafuegos descartaba NFS. Una exportación solo para
    el ordenador del laboratorio, el cortafuegos abierto para él, un
    montaje, y una línea en fstab.

    NFS EN POCAS PALABRAS
    - En el servidor: /etc/exports (carpeta, clientes, opciones), y luego
      exportfs -ra; exportfs -v lista lo que se sirve.
    - En el cliente: mount -t nfs servidor:/carpeta /punto; en /etc/fstab:
      servidor:/carpeta /punto nfs defaults,_netdev 0 0.
    - NFSv4 solo necesita el puerto 2049 (TCP).

    BUENA PRÁCTICA
    - Exporta a clientes con nombre o a una red pequeña, nunca a *.
    - Conserva root_squash: root en un cliente se convierte en nobody en el
      servidor.
    - NFS con sec=sys se fía del cliente sobre quién es quién: solo máquinas
      que gestionas tú. Para más, Kerberos (sec=krb5).

    DOCUMENTACIÓN
    - exports(5): https://man7.org/linux/man-pages/man5/exports.5.html
    - nfs(5): https://man7.org/linux/man-pages/man5/nfs.5.html
    - Debian: https://wiki.debian.org/NFSServerSetup
