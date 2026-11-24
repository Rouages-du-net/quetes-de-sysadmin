### Historia «El Comedor», capítulo 4 «El disco que llega tarde»: un
### montaje que llega después del servicio que lo necesita
### (RequiresMountsFor=, nofail, lo que oculta un punto de montaje). Los
### nombres de unidades, las rutas y los mensajes de systemd no se traducen.

chapter-late-disk = El disco que llega tarde
    .summary = Las reservas de esta mañana han desaparecido del disco USB del comedor. No se han perdido: están ocultas. Encontrarlas, y hacer que la aplicación espere a su disco.

## Archivos

late-disk-message-ibrahim =
    De:      Ibrahim
    Para:    tú
    Asunto:  ¡Las reservas de la mañana han desaparecido!

    Hola:

    Un desastre: la cocina abre la lista del día (la aplicación la escribe
    en /srv/data/bookings/, un archivo por día) y las reservas de esta
    mañana no están. La gente reservó entre las 6:30 y las 9:00, las vi en
    la aplicación, y el archivo del día ni siquiera existe en el disco.

    /srv/data es nuestro viejo disco USB (en /etc/fstab, con nofail desde el
    día en que estaba desconectado y el servidor no arrancaba, acuérdate de
    El Laboratorio). Esta mañana temprano hubo un reinicio, por las
    actualizaciones.

    ¿Puedes encontrar las reservas de la mañana y volver a ponerlas en el
    disco? Y asegurarte de que no vuelva a pasar en el próximo reinicio.
    Contraseña lentejas-2028.

    Ibrahim

late-disk-header = hora;nombre;comensales
late-disk-bookings =
    06:41;Amadou;2
    06:58;Claire;1
    07:12;Rui;4
    07:30;Mei;2
    07:52;Youssef;3
    08:05;Hanna;1
    08:17;Kwame;2
    08:33;Lucia;5
    08:46;Tomasz;1
    08:59;Nadia;2
late-disk-old-bookings =
    10:02;Amadou;2
    10:45;Rui;3
    11:10;Hanna;1

## Eventos

late-disk-event-hidden =
    Ahí está: la lista del día, con las reservas de la mañana. Estaba justo
    ahí, en /srv/data… pero en el disco del sistema, en la carpeta sobre la
    que se monta el disco USB. Un montaje oculta lo que contenía la carpeta
    (sigue ahí, intacto); desmontado, vuelve a verse. Ponla a salvo, y luego
    ponla en el disco USB.
late-disk-event-order =
    «Mounted srv-data.mount»: el disco USB llegó unos 25 segundos después
    del inicio del arranque, y la aplicación había arrancado mucho antes.
    Con nofail, nada espera a este montaje. Entonces, ¿dónde escribió la
    aplicación la lista de esta mañana? (findmnt, ¿y qué contiene /srv/data
    sin su disco?)
late-disk-event-recovered =
    Las reservas de la mañana han vuelto al disco USB: la cocina tiene su
    lista. Ahora la causa: en el próximo reinicio, la aplicación volverá a
    arrancar antes que el disco. Dile a systemd que necesita /srv/data (man
    systemd.unit: RequiresMountsFor=), y luego reinicia para comprobarlo.
late-disk-event-no-nofail =
    Sin nofail, todo el arranque espera al disco USB: la aplicación arranca
    después de él, sí. Pero el día que falte el disco, el servidor se parará
    en modo de emergencia, como ya pasó una vez. RequiresMountsFor= solo en
    la aplicación habría dejado arrancar al servidor.
late-disk-event-end =
    Tras el reinicio, el disco USB se montó primero, y luego la aplicación
    arrancó y escribió en él. Ibrahim: «Y las reservas de esta mañana están
    ahí. ¡La cocina puede servir!».

    ¡Bien hecho! Has terminado el capítulo «El disco que llega tarde».

    QUÉ HA PASADO
    El disco USB tarda unos 25 segundos en aparecer al arrancar. Su línea de
    fstab tiene nofail (para que el servidor arranque aun sin él), y con
    nofail nada espera al montaje. La aplicación arrancó primero y escribió
    la lista del día en /srv/data… la carpeta vacía del disco del sistema.
    Cuando el disco USB se montó encima, ocultó ese archivo: para todo el
    mundo, la lista había desaparecido. Solo estaba oculta.

    LO QUE OCULTA UN PUNTO DE MONTAJE
    - Montar un disco sobre una carpeta oculta el contenido de esa carpeta
      sin borrarlo; desmontarlo lo vuelve a mostrar.
    - Para mirar sin desmontar: monta el disco del sistema en otro sitio
      (mount --bind / /mnt/root), y luego mira en /mnt/root/srv/data.
    - Una trampa clásica: un servicio que escribe antes de que su disco esté
      ahí, o una copia de seguridad que llena el disco del sistema mientras
      falta el disco de copias.

    EL ARREGLO
    - RequiresMountsFor=/srv/data en el [Unit] de la aplicación: la
      aplicación exige el montaje de /srv/data y arranca después de él. Si
      falta el disco, la aplicación no arranca (mejor que escribir en el
      sitio equivocado), y el servidor arranca de todos modos.
    - Conserva nofail para un disco que puede faltar; quitarlo hace esperar
      a todo el arranque, y lo para en modo de emergencia si el disco no
      está.

    DOCUMENTACIÓN
    - RequiresMountsFor=: https://www.freedesktop.org/software/systemd/man/latest/systemd.unit.html#RequiresMountsFor=
    - nofail y los montajes al arrancar: https://www.freedesktop.org/software/systemd/man/latest/systemd.mount.html
    - mount, umount: https://man7.org/linux/man-pages/man8/mount.8.html
