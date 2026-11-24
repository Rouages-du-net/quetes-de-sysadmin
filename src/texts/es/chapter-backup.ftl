### Historia «El Borrador», capítulo 4 «La Copia de Seguridad»: rsync y cron.
### Los comandos, las rutas del sistema y la salida de rsync y cron no se
### traducen; los nombres de lugares y archivos (recuerdos, /mnt/copia,
### nota_de_maelle.txt…) vienen de names.ftl.

chapter-backup = La Copia de Seguridad
    .summary = Nunca más: copiar con rsync, cada noche con cron, y saber restaurar.

## Archivos

backup-word-maelle =
    Una nota de Maëlle, la farera del Faro:

    «Desde que el Borrador se detuvo, el reino ha recuperado sus recuerdos
    (están en ~/recuerdos). Pero sigo teniendo miedo: ¿y si algo volviera
    a borrarlos?

    Alguien me ha conectado un disco de copias, montado en /mnt/copia.
    ¿Podrías:

    1. copiar los recuerdos en /mnt/copia/recuerdos;
    2. hacer que esta copia se rehaga SOLA, cada noche;
    3. y demostrarme que sabemos recuperarlos el día que haga falta?

    Me han hablado de rsync y de cron. Lo encontrarás todo en man rsync
    y man crontab.»
backup-memory-first-letter =
    La primera carta que llegó al Puerto después de volver la luz.
    Empieza así: «Querida Maëlle, vimos el Faro desde alta mar…»
backup-memory-lighthouse =
    La noche en que el Faro volvió a encenderse: un haz que barría el mar y
    la capitana Ana izando la vela.
backup-memory-village =
    El Pueblo de fiesta: la masa madre salvada, el reloj otra vez en marcha,
    la escuela recuperada.
backup-memory-nour =
    Nour, encontrada en la Galeria, riéndose mientras come queso.
backup-memory-eraser =
    El Borrador vaciando por fin la Papelera, como el primer día, y
    nada más.
backup-memory-lighthouse-festival =
    La fiesta del Faro, hoy: todo el reino en el Espigon, y
    farolillos de papel hasta la Linterna.

## La noche (cron)

# { $file }: el recuerdo que llegó durante el día
backup-night-start =
    Cae la tarde sobre el reino. Durante el día ha llegado un recuerdo
    nuevo: ~/recuerdos/{ $file }.

    Pasa la noche. Entre medianoche y las 6 de la mañana, cron se despierta
    y ejecuta lo que le pide tu crontab…
backup-night-still =
    Pasa otra noche. Entre medianoche y las 6 de la mañana, cron ejecuta lo
    que le pide tu crontab…
backup-night-ok =
    Por la mañana, la copia está al día: { $file } está ahí,
    sin que hayas escrito nada. Eso es una copia de seguridad automática.
backup-morning =
    Pero llega Maëlle, desolada: «Quería ordenar… ¡y he borrado
    ~/recuerdos/{ $file }!» En Linux, rm no pasa por una papelera.
    Por suerte, tienes una copia. Restaura este recuerdo.
backup-night-nothing =
    Por la mañana, nada ha cambiado: ninguna de las tareas de tu crontab
    cayó durante la noche, entre medianoche y las 6. Vuelve a leer los cinco
    campos de la hora (man crontab): minuto, hora, día del mes, mes, día de la semana.
# { $mail }: lo que escribieron las tareas
backup-night-mail =
    Por la mañana, la copia no está al día. Cron te ha dejado este correo,
    con lo que escribió tu tarea:

    { $mail }
backup-night-failure =
    Por la mañana, la copia no está al día: tu tarea se ejecutó, pero no
    copió los recuerdos en el sitio correcto. Comprueba el comando a mano,
    con rsync -n para probar sin tocar nada.

## Eventos

# { $backup }: la carpeta de la copia
backup-event-nested =
    Fíjate bien: ahora tienes { $backup }/recuerdos, una carpeta recuerdos
    DENTRO de la carpeta recuerdos. Para rsync, la barra final del origen
    importa: «recuerdos/» quiere decir «el contenido de recuerdos»,
    «recuerdos» quiere decir «la carpeta misma». Esta carpeta de más no
    molesta, pero apunta bien a partir de ahora: rsync -a ~/recuerdos/
    seguido del destino.
backup-event-copy =
    Los recuerdos están copiados en el disco de copias. Pero una copia que
    hay que acordarse de hacer a mano siempre acaba olvidada. Pide a cron
    que la rehaga cada noche: crontab -e.
# { $file }: el recuerdo borrado
backup-event-lost =
    ¡{ $file } ha desaparecido… también de la copia! Con --delete,
    rsync ha copiado el borrado: un espejo reproduce los errores como
    todo lo demás. Por eso se guardan varias versiones (rsnapshot,
    restic: eso será más adelante). Aquí, reinicia el capítulo para
    volver a intentarlo.
backup-event-end =
    El recuerdo ha vuelto. Maëlle: «Así que esto es una copia de verdad:
    una copia en otro sitio, que se rehace sola y que ya hemos conseguido
    restaurar».

    ¡Bien hecho! Has terminado el capítulo 4 de El Borrador.

    QUÉ HA PASADO
    rsync copió los recuerdos a otro disco; cron rehace la copia
    cada noche; y por la mañana la copia sirvió, de verdad.

    BUENA PRÁCTICA
    - La barra final importa: rsync -a origen/ destino/.
    - Prueba primero con -n (--dry-run), sobre todo con --delete.
    - Una copia manual se olvida: prográmala (cron).
    - Una copia que nunca se ha restaurado no es una copia: prueba la
      restauración.
    - La regla 3-2-1: tres copias, en dos soportes, una de ellas en otro
      sitio; y varias versiones, porque un espejo (--delete) también copia
      los errores.

    OTRA MANERA
    Un temporizador de systemd en lugar de cron: el resultado en journalctl,
    una ejecución perdida recuperada al arrancar (Persistent=true). Y rsync
    mantiene un espejo: un archivo borrado o dañado también lo estará en la
    copia en la ejecución siguiente. Para conservar varios días, rsnapshot o
    restic (El Archivo, La Ludoteca).

    DOCUMENTACIÓN
    - rsync: https://download.samba.org/pub/rsync/rsync.1
    - crontab: https://manpages.debian.org/bookworm/cron/crontab.5.en.html
