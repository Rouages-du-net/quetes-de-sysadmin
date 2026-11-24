### Historia «La Compañía de Danza», capítulo «La copia externa»: la copia
### de seguridad nocturna con rclone hacia Garage falla desde un corte de
### luz. El reloj (el límite de 24 horas de Garage), la región S3, una clave
### sin escritura, rclone sync hecho seguro con --backup-dir, rclone check,
### un archivo restaurado. Los comandos, las opciones, las rutas y las
### salidas no se traducen.

chapter-offsite-copy = La copia externa
    .summary = Cada noche el recurso compartido de la oficina se copia en el almacén de objetos de la compañía, y cada noche desde el corte de luz ha fallado. Averigua por qué, un error tras otro, haz que la copia sea segura y recupera el informe de la tesorera de la última copia buena.

## Archivos

offsite-copy-message-linh =
    De: Linh
    Lunes 12 de abril, 8:50

    ¡Hola! Malas noticias: la copia de seguridad de la oficina no
    funciona desde el corte de luz del sábado 3 de abril. Me di cuenta
    ayer.

    Probé algunas cosas el domingo, perdón si lo he empeorado:
    - un foro decía que «Date is too old» tenía que ver con la región, así
      que puse region = us-east-1 en /etc/rclone/office.conf, como en su
      ejemplo;
    - y le quité la escritura a la clave office-backup en el bucket
      backups (sudo garage bucket deny --write…), para que nada pueda
      borrar nuestras copias mientras está roto.

    El script es /usr/local/bin/office-backup, que office-backup.timer
    lanza cada noche. Anahera también tiene un problema, mira su mensaje.

    Linh

offsite-copy-message-anahera =
    De: Anahera (tesorera)
    Sábado 10 de abril

    He hecho una tontería: guardé la plantilla vacía encima de nuestro
    informe para el consejo de las artes,
    /srv/office/grants/arts-council-report-2031.txt, y hay que entregarlo
    el jueves. La copia de seguridad de la oficina debe de tener el bueno,
    de antes del corte de luz. ¿Puedes recuperarlo? Por favor, no pierdas
    tampoco los archivos nuevos (el orden de la gala, las nuevas altas).

    Anahera

offsite-copy-notes-teodora =
    Notas de Teodora (bastidores, la copia de seguridad de la oficina)

    - /usr/local/bin/office-backup ejecuta rclone sync de /srv/office a
      garage:backups/office. sync hace que el destino sea igual que el
      origen: copia lo que ha cambiado, y borra lo que ya no está en el
      origen. Su configuración: /etc/rclone/office.conf (sudo).
    - El temporizador lanza office-backup.service cada noche a las 2:30;
      su salida va al diario: journalctl -u office-backup.
    - Para mirar la copia: sudo rclone --config /etc/rclone/office.conf
      ls garage:backups/office (o lsl, con las fechas).
    - Garage comprueba la fecha de cada petición, y su región se llama
      «garage» (s3_region en /etc/garage.toml).
    - Pendiente: una prueba en seco antes de cambiar el script (el -n de
      rclone), y un rclone check de vez en cuando.

## Eventos

offsite-copy-event-failing =
    Garage rechaza las peticiones de la copia: «Date is too old». Cada
    petición S3 lleva la fecha en que se firmó, según el propio reloj de
    la máquina. Garage rechaza una petición fechada más de 24 horas antes
    que su propio reloj (Amazon S3 permite 15 minutos:
    RequestTimeTooSkewed). ¿Qué hora cree bastidores que es?

offsite-copy-event-clock =
    El reloj vuelve a estar bien: bastidores sigue NTP. Garage aceptará
    ahora las fechas de las peticiones; vuelve a probar la copia (sin
    cambiar nada más todavía) y lee el siguiente error.

offsite-copy-event-region =
    La región vuelve a ser la de Garage, «garage». La región forma parte
    del ámbito de la firma (date/region/s3/aws4_request): con otra región,
    Garage responde AuthorizationHeaderMalformed y nombra el ámbito que
    esperaba.

offsite-copy-event-insecure =
    Desactivar la comprobación de certificados no ayuda aquí: los errores
    vienen de Garage, que respondió, por una conexión TLS que funcionaba.
    Y deja que cualquiera entre bastidores y vault se haga pasar por el
    almacén y lea las copias. Deja activas las comprobaciones de
    certificados.

offsite-copy-event-write =
    office-backup puede volver a escribir en backups. Los permisos de
    Garage son read, write y owner, por bucket: no existe «escribir pero
    nunca borrar», así que quitar la escritura solo para la copia. Lo que
    protege las copias antiguas de un sync malo es conservar lo que
    sustituye y borra.

offsite-copy-event-wrong-way =
    Algunos archivos nuevos del recurso compartido han desaparecido: un
    sync hace que su destino sea igual que su origen, y aquí el destino
    era /srv/office. El bucket solo tenía la copia del 2 de abril, así que
    los archivos escritos desde entonces se borraron en bastidores. En un
    servidor real se habrían perdido; aquí, vuelve a empezar el capítulo
    (o usa la instantánea de rescate), y ejecuta antes un sync con
    --dry-run.

offsite-copy-event-overwritten =
    El informe bueno ha desaparecido de todas partes: el sync sustituyó la
    copia del bucket por la plantilla, y nada conservó la antigua. En un
    servidor real se habría perdido; aquí, vuelve a empezar el capítulo (o
    usa la instantánea de rescate). Antes de sincronizar, restaura el
    informe, o dile a rclone dónde guardar lo que sustituye (el manual de
    rclone: --backup-dir).

offsite-copy-event-restored =
    El informe ha vuelto a /srv/office con sus cifras de 2031: Anahera
    puede enviarlo.

offsite-copy-event-safe =
    El script conserva ahora lo que destruiría: con --backup-dir, cada
    archivo que sync sustituye o borra en garage:backups/office se mueve a
    esa carpeta en su lugar. Una carpeta con fecha separa los cambios de
    cada noche.

offsite-copy-event-dry-run =
    Una prueba en seco: rclone dice lo que copiaría, sustituiría y
    borraría, y no toca nada. Lee dos veces los borrados antes de
    ejecutarlo de verdad.

offsite-copy-event-synced =
    El office/ del bucket vuelve a ser igual que el recurso compartido,
    archivos nuevos incluidos.

offsite-copy-event-checked =
    rclone check ha comparado los dos lados archivo por archivo (tamaños y
    MD5): ninguna diferencia.

offsite-copy-event-end =
    Linh: «La copia vuelve a estar en verde, y Anahera ha enviado su
    informe. ¡La próxima vez no tocaré las claves!»

    ¡Bien hecho! Has terminado el capítulo «La copia externa».

    QUÉ HA PASADO
    Tras el corte de luz, el reloj de bastidores iba tres días atrasado y
    NTP estaba desactivado. Cada petición S3 se firma con su fecha: Garage
    rechaza una fechada más de 24 horas antes que su propio reloj («Date
    is too old»), y el rclone sync nocturno fallaba desde entonces. Luego
    dos cambios bienintencionados añadieron sus propios errores: una
    región que no es la de Garage (el ámbito de la firma no coincidía) y
    una clave sin escritura (AccessDenied). Arreglaste el reloj, la región
    y la clave, recuperaste el informe de la última copia buena, e hiciste
    que el sync conservara lo que sustituye o borra.

    BUENA PRÁCTICA
    - Lee el error, arregla una causa cada vez, vuelve a probar: cada
      arreglo mostraba el siguiente error.
    - Mantén los relojes sincronizados (NTP): las firmas, los certificados
      y los registros dependen de ello.
    - rclone sync borra: ejecútalo antes con --dry-run, comprueba el
      sentido (origen, luego destino), y dale --backup-dir en el mismo
      bucket, fuera del destino, para que un error se pueda deshacer.
    - rclone check después de una copia, y una restauración de vez en
      cuando: una copia que nadie ha leído es una esperanza, no una copia
      de seguridad.
    - Una tarea nocturna que falla tiene que verse: el fallo de un
      temporizador en el diario no ayuda a nadie si nadie mira
      (OnFailure= con una notificación, o monitorización).

    OTRA FORMA DE HACERLO
    Garage no tiene versionado ni bloqueo de objetos, así que el bucket no
    puede conservar él mismo versiones antiguas. Una regla de ciclo de
    vida (Garage admite Expiration) puede limpiar las carpetas de
    --backup-dir al cabo de unos meses. Para historial y deduplicación,
    restic o Borg pueden guardar instantáneas cifradas en un bucket; como
    ninguna clave de Garage puede escribir sin poder borrar, guarda una
    segunda copia en un sitio al que no llegue la clave de la copia.

    DOCUMENTACIÓN
    - rclone sync: https://rclone.org/commands/rclone_sync/
    - --backup-dir: https://rclone.org/docs/#backup-dir-dir
    - rclone check: https://rclone.org/commands/rclone_check/
    - rclone y S3: https://rclone.org/s3/
    - Garage con rclone y la AWS CLI: https://garagehq.deuxfleurs.fr/documentation/connect/cli/
    - Las reglas de ciclo de vida de Garage: https://garagehq.deuxfleurs.fr/documentation/reference-manual/s3-compatibility/
