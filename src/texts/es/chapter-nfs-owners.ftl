### Historia «El Club de Fotografía», capítulo 2 «¿De quién son estos
### archivos?»: NFS transporta números (uid, gid), root_squash, usermod -u,
### chown. La configuración, las rutas y las salidas de las herramientas no
### se traducen.

chapter-nfs-owners = ¿De quién son estos archivos?
    .summary = Los escaneos de Sam, copiados desde el ordenador del laboratorio, pertenecen a Nora en el NAS, y Sam ya no puede modificar sus propios álbumes. Averiguar por qué, y arreglarlo para siempre.

## Archivos

nfs-owners-message-margot =
    De:      Margot
    Para:    tú
    Asunto:  ¿¿Los escaneos de Sam son de Nora??

    Hola:

    Desde la semana pasada, Sam escanea sus carretes en el ordenador del
    laboratorio y los copia en /mnt/photos/2028-film-scans. Pero en el NAS,
    ls -l dice que pertenecen a Nora. Nora no entiende nada, Sam está
    furioso.

    Y es peor: desde el ordenador del laboratorio, Sam ya no puede retocar
    sus propias fotos de 2028-outings. Lo intentó con sudo, y aun así
    obtuvo «Permission denied».

    Sam sigue conectado en el ordenador del laboratorio, retocando
    (darktable). La misma contraseña de sudo: obturador-2028.

    Margot

## Eventos

nfs-owners-event-numbers =
    Por NFS (sec=sys), el servidor no conoce nombres: el cliente envía
    números (uid, gid), y cada máquina los muestra con sus propios nombres.
    Sam es el 1001 en el ordenador del laboratorio, el 1002 en el NAS; y el
    1001, en el NAS, es Nora. Compara: id sam en cada máquina (o ls -n, que
    muestra los números).
nfs-owners-event-squash =
    sudo no ayuda: con root_squash (el valor por defecto), root en un
    cliente se convierte en nobody (65534) en el NAS, y nobody no puede
    escribir aquí. Es una protección: nunca no_root_squash para eso. La
    salida es que Sam sea Sam en todas partes.
nfs-owners-event-no-root-squash =
    no_root_squash da a root en el ordenador del laboratorio todos los
    derechos sobre las fotos del NAS: cualquiera que sea root en un cliente
    (o que conecte un portátil con esa dirección) podría borrarlo o
    cambiarlo todo. Vuelve a poner root_squash, y da mejor a Sam el mismo uid
    en las dos máquinas.
nfs-owners-event-busy =
    usermod no cambia el uid de una cuenta en uso: Sam está conectado en el
    ordenador del laboratorio (ps -u sam). Pídele que guarde y cierre la
    sesión, o termina tú su sesión (pkill -u sam), y luego vuelve a
    intentarlo.
nfs-owners-event-taken =
    El 1001 es de Nora en el NAS: cambiar el uid de Sam en el NAS chocaría.
    El NAS tiene más archivos y más cuentas; alinea el ordenador del
    laboratorio con él (allí Sam es el 1002).
nfs-owners-event-uid =
    Sam tiene ahora el mismo número en las dos máquinas: desde el ordenador
    del laboratorio, sus álbumes vuelven a ser suyos. Queda: los escaneos ya
    copiados, que llevan el 1001 en el NAS: el número de Nora, y el de su
    grupo. Devuélveselos a Sam y al club, en el NAS (man chown: -R,
    dueño:grupo).
nfs-owners-event-end =
    Sam es el 1002 en todas partes, sus escaneos son suyos, y puede retocar
    sus álbumes desde el ordenador del laboratorio. root sigue aplastado
    (squash). Margot: «Nora y Sam vuelven a ser amigos. Llevaré una lista de
    los uid, prometido».

    ¡Bien hecho! Has terminado el capítulo «¿De quién son estos archivos?».

    QUÉ HA PASADO
    La cuenta de Sam se creó primero en el ordenador del laboratorio
    (1001), después de la de Nora en el NAS (1001 también). NFS con sec=sys
    solo transporta números: para el NAS, el 1001 es Nora, lo llame como lo
    llame el cliente.

    LOS MISMOS NÚMEROS EN TODAS PARTES
    - id sam en cada máquina, ls -n para ver los números.
    - usermod -u 1002 sam (la cuenta no debe estar en uso; los archivos de
      la carpeta personal siguen; groupmod -g para el grupo), y luego chown
      en el servidor para lo que se escribió con los números incorrectos.
    - Para muchas máquinas: un directorio (LDAP, ver «El directorio») para
      que todas las máquinas tengan los mismos uid, o NFSv4 con Kerberos e
      idmapd (nombres en lugar de números).

    BUENA PRÁCTICA
    - Conserva root_squash; no_root_squash solo para una máquina en la que
      confías por completo, para una necesidad precisa (un servidor de
      copias, clientes sin disco).
    - Planifica los uid antes de la primera cuenta de cada máquina.

    DOCUMENTACIÓN
    - exports(5), User ID Mapping: https://man7.org/linux/man-pages/man5/exports.5.html
    - usermod(8): https://man7.org/linux/man-pages/man8/usermod.8.html
