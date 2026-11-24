### Historia «El Refugio», capítulo «Reconstruir en la de repuesto»:
### cercado se ahogó en el sótano inundado; refugio, un Debian recién
### instalado, se reconstruye a partir de las copias en el orden del plan
### (paquetes, restauración al lado, la base de datos y sus comprobaciones,
### los servicios en orden, una prueba local).
### Los comandos, las opciones, las rutas y las salidas no se traducen.

chapter-rebuild = Reconstruir en la de repuesto
    .summary = Anoche se inundó el sótano, y el servidor con él. Una máquina donada espera, recién instalada, y también las copias y el sobre de la tesorera. Sigue el plan: paquetes, una restauración al lado del sistema nuevo, la base de datos comprobada fila a fila, los servicios en el orden correcto, y una prueba antes de que nadie cambie nada.

## Archivos

rebuild-message-teuila =
    De: Teuila
    Viernes 14 de noviembre, 8:30

    Malas noticias. El río creció durante la noche y el sótano del granero
    de Hillside está bajo 40 cm de agua. cercado estaba ahí abajo. El
    sitio está caído desde la madrugada (las comprobaciones de pradera
    están en /var/log/sitewatch.log). Los animales están bien: las perreras
    están arriba.

    Buenas noticias: Wiremu ha traído la máquina que nos regaló el club de
    informática el mes pasado. Le instaló Debian 13 esta mañana, con
    restic, y la llamó refugio; está en Riverbend, en la red (ssh refugio
    desde aquí). Rahel abrió el sobre: está en sobre.txt, junto a este
    mensaje.

    El plan que arreglamos juntos está en /srv/drp/plan.md, con su orden
    de restauración. ¿Podrías devolver el sitio y la aplicación en
    refugio? No cambies nada todavía: lo haremos juntos esta tarde, una
    vez que funcione.

    Teuila

rebuild-envelope =
    EL SOBRE CERRADO (caja fuerte de Rahel), abierto el viernes 14 de noviembre, 8:15

    Repositorio restic de los refugios (clave de recuperación):

        repository:  { $repo }
        password:    { $password }

    Dariusz, mayo de 2029: «Esta clave abre todas las copias, desde
    cualquier sitio. Si estás leyendo esto, ha pasado algo malo: respira,
    sigue el plan».

## Eventos

rebuild-event-down =
    Cada cinco minutos desde las 2:50, la comprobación agota el tiempo de
    espera: la dirección de Hillside ya no responde. La última
    comprobación buena fue a las 2:45, y la última copia se ejecutó a las
    2:00: en el peor caso, se han perdido 50 minutos de datos, muy dentro
    del RPO de 24 horas del plan.
rebuild-event-paddock-gone =
    cercado ya no responde, y no responderá: está bajo el agua. Todo lo
    que necesitas ahora está en el repositorio y en el sobre.
rebuild-event-haven =
    refugio: un Debian 13 recién instalado, restic instalado, nada más. El
    orden de restauración del plan es tu lista de comprobación
    (/srv/drp/plan.md en pradera): primero, los paquetes que necesitan los
    servicios.
rebuild-event-no-lists =
    Una máquina recién instalada todavía no conoce ningún paquete: primero
    apt update, luego apt install.
rebuild-event-packages =
    nginx y PostgreSQL están instalados (y arrancados, como hacen los
    paquetes de Debian), con su configuración por defecto. Ahora los
    archivos propios de los refugios, desde el repositorio: su dirección y
    su contraseña están en el sobre.
rebuild-event-wrong-password =
    Esa contraseña no abre ninguna clave del repositorio. La contraseña de
    la tarea nocturna se ahogó con cercado: la buena es la del sobre.
rebuild-event-snapshots =
    El repositorio se abre con la clave del sobre, por sftp desde refugio:
    la última instantánea es de las 2:00 de anoche. Restáurala al lado del
    sistema nuevo (--target sobre una carpeta vacía), y luego vuelve a
    poner lo que le corresponde.
rebuild-event-over-etc =
    La restauración se hizo sobre /: los { $files } de cercado han
    sustituido a los de refugio. En el próximo arranque, refugio buscaría
    el disco de cercado (fstab), y cada máquina que conoce refugio vería
    una clave de host SSH nueva; dos máquinas con un mismo machine-id
    confunden al DHCP y al diario. Wiremu, que guardó una copia del /etc
    de la instalación limpia, vuelve a poner los archivos propios de
    refugio. Restaura al lado (--target /srv/restore, por ejemplo) y copia
    solo lo que es de los refugios.
rebuild-event-restored =
    La instantánea está al lado del sistema nuevo, con sus rutas completas
    recreadas bajo el destino. Ahora copia lo que es de los refugios: el
    sitio (/var/www/shelter), la aplicación (/srv/adopt), las fichas de
    vetlink (/srv/vetlink), el archivo del sitio de nginx, la unidad de la
    aplicación. Deja donde están el fstab, el hostname, el machine-id y
    las claves SSH de cercado.
rebuild-event-copied =
    El sitio y la aplicación están en su sitio. La unidad de la aplicación
    se lee tras systemctl daemon-reload. La base de datos va primero: la
    aplicación no puede arrancar sin ella.
rebuild-event-too-early =
    adopt no ha podido arrancar: su base de datos todavía no está
    (journalctl -u adopt dice cuál). Por eso el plan arranca la base de
    datos antes que la aplicación: restáurala, y luego vuelve a arrancar
    adopt.
rebuild-event-database =
    Todas las filas del volcado de anoche han vuelto a shelter. Antes de
    fiarte, compara con lo que registró la tarea: shelter.sha256 para el
    volcado en sí, shelter.counts para las filas de cada tabla.
rebuild-event-verified =
    El volcado coincide con lo que registró la tarea: nada se ha dañado
    por el camino.
rebuild-event-adopt =
    adopt está en marcha, con su base de datos.
rebuild-event-default-site =
    Esa es la página por defecto de nginx: la petición ha llegado al sitio
    por defecto. El sitio de los refugios responde a su propio nombre
    (server_name): pídelo con curl -H "Host: …", o activa antes el sitio.
rebuild-event-nginx =
    nginx sirve el sitio de los refugios en refugio.
rebuild-event-vetlink =
    Las fichas veterinarias de Mirela han vuelto a /srv/vetlink: el
    arreglo de hace quince días ha valido la pena.
rebuild-event-tested =
    curl en el propio refugio llega a la aplicación a través de nginx: el
    sitio funciona antes de que nadie dirija el mundo hacia él.
rebuild-event-end =
    Teuila: «Mirela acaba de ver la página de Galleta en refugio. Comemos,
    y luego cambiamos».

    ¡Bien hecho! Has terminado el capítulo 2 de «El Refugio».

    QUÉ HA PASADO
    cercado se perdió con el sótano. En una máquina vacía, solo con el
    repositorio y el sobre, seguiste el plan: paquetes de Debian, la
    última instantánea restaurada al lado del sistema nuevo, los archivos
    propios de los refugios copiados en su sitio, la base de datos
    recreada a partir de su volcado y comprobada con la suma y los
    recuentos de la tarea, los servicios arrancados en el orden de sus
    dependencias, y una prueba local antes de cualquier cambio.

    BUENA PRÁCTICA
    - Reconstruye siguiendo el plan, paso a paso: bajo presión, una lista
      de comprobación gana a la memoria.
    - Restaura al lado, y luego copia lo que es tuyo. El /etc de una
      máquina contiene su identidad (fstab y los UUID de sus discos,
      hostname, machine-id, claves de host SSH, red): nunca restaures
      encima el de otra máquina.
    - Una base de datos vuelve desde su volcado, y luego se comprueba
      (suma, recuentos de filas) antes de que nada la use.
    - Arranca en el orden de las dependencias (After=, Requires=): la base
      de datos, la aplicación, luego lo que la sirve.
    - Prueba en local (curl -H "Host: …" http://localhost/) antes de
      cambiar.
    - La clave de recuperación vive fuera, en papel: la clave de la tarea
      se ahogó con el servidor.

    DOCUMENTACIÓN
    - restic, restaurar desde una copia: https://restic.readthedocs.io/en/stable/050_restore.html
    - restic, repositorios sftp: https://restic.readthedocs.io/en/stable/030_preparing_a_new_repo.html#sftp
    - PostgreSQL, restaurar un volcado: https://www.postgresql.org/docs/current/backup-dump.html#BACKUP-DUMP-RESTORE
    - systemd.unit, After= y Requires=: https://www.freedesktop.org/software/systemd/man/latest/systemd.unit.html
    - NIST SP 800-34 Rev. 1 (la fase de recuperación): https://csrc.nist.gov/pubs/sp/800/34/r1/upd1/final
