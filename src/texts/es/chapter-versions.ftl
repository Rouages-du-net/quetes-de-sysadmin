### Historia «El Archivo», capítulo 2 «Las Versiones»: restic.
### Los comandos, las rutas, los ID de instantáneas y los mensajes de restic
### (en inglés) no se traducen.

chapter-versions = Las Versiones
    .summary = Una copia que conserva el error: encontrar la versión buena con restic y luego liberar espacio sin perderla.

## Archivos

versions-word-rosa =
    Una nota de Rosa, la bibliotecaria:

    «Desde enero, los fondos viven en este servidor nuevo, y los copio
    cada noche con restic en el disco que nos presta el ayuntamiento
    (/mnt/ayuntamiento). Las copias están cifradas: el personal del
    ayuntamiento no puede leer nuestros archivos. La contraseña está en
    ~/.config/restic/contrasena (y en papel, en la caja fuerte).

    Desastre: esta mañana, la transcripción del diario de Marie está llena
    de faltas absurdas. El becario lanzó un script de «corrección
    automática» hace unas noches. Y la copia de cada noche guardó
    fielmente la versión estropeada…

    Otras dos preocupaciones: el ayuntamiento dice que nuestro disco está
    casi lleno (df -h /mnt/ayuntamiento), y ya no estoy segura de que
    nuestro repositorio esté en buen estado.

    ¿Podrías:
    1. encontrar la versión buena del diario y volver a ponerla en su sitio;
    2. liberar espacio en el disco, sin tirar la versión buena;
    3. comprobar que el repositorio está sano?

    Mis comandos de siempre están en notes_restic.txt.»
versions-notes-restic =
    NOTAS DE ROSA — RESTIC

    Cada comando necesita el repositorio y la contraseña:
      restic -r /mnt/ayuntamiento/restic-biblioteca --password-file ~/.config/restic/contrasena COMANDO

    Los comandos que ya he usado:
      snapshots      la lista de copias (instantáneas)
      ls ID          lo que contiene una instantánea

    Los demás (dump, find, diff, restore, forget, prune, check…) están en
    man restic. ID: bastan los 8 primeros caracteres, o latest.
versions-journal =
    DIARIO DE MARIE, COSTURERA (1931-1940) — TRANSCRIPCIÓN

    12 de marzo de 1931. Anoche ardió el mercado. Las vendedoras
    salvaron lo que pudieron; Fatou perdió todas sus telas. Cosimos hasta
    la mañana para que tuviera algo que vender el sábado.

    3 de junio de 1936. Huelga en el taller. Cantamos en el patio. El
    patrón cedió: dos semanas de vacaciones pagadas, la primera vez en mi
    vida.

    9 de septiembre de 1939. Ahmed se ha ido esta mañana. Le he bordado su
    nombre en el forro de la chaqueta, para que no lo olvide, allá lejos.
versions-journal-damaged =
    DIARIO DE MARIE, COSTURERA (1931-1940) — TRANSCRIPCIÓN

    12 de marzo de 1931. Anoche ardio el mercado. Las bendedoras
    salvaron lo que pudieron; Fatou perdio todas sus télas. Cocimos hasta
    la mañana para que tubiera algo que bender el sábado.

    3 de junio de 1936. Uelga en el tayer. Cantemos en el patio. El
    patron cedio: dos semanas de bacaciones pagadas, la primera ves en mi
    bida.

    9 de septiembre de 1939. Ahmed se a ido esta mañana. Le e vordado su
    nombre en el forro de la chaqueta, para que no lo holvide, aya lejos.
versions-recipe-added = Añadida en enero de 2027: el mafé de Fatou, dictado por su nieta.
versions-image-tiff = (imagen TIFF, escaneo en bruto)

## Eventos

# { $file }: el archivo de la contraseña
versions-event-password =
    El repositorio está cifrado… pero su contraseña está en { $file },
    legible por todas las cuentas de la máquina (ls -l). Rosa tiene una
    cuenta aquí, y mañana quizá otro becario. ¿Quién debería poder leerla?
versions-event-bad-password =
    Contraseña incorrecta: sin ella, restic no puede descifrar nada, ni
    siquiera la lista de copias. Es a propósito. Perder esta contraseña es
    perder todas las copias: guarda siempre una copia de ella en otro
    sitio (Rosa tiene la suya en la caja fuerte).
versions-event-elsewhere =
    La versión buena del diario ha vuelto… pero no a su sitio: restic
    vuelve a crear la ruta completa bajo la carpeta dada a --target.
    Todavía tienes que ponerla en ~/fondos/manuscritos/.
versions-event-restored =
    El diario de Marie ha vuelto, palabra por palabra. Para eso sirve tener
    versiones: una copia espejo (rsync --delete) habría copiado el error
    desde la primera noche.

    Piensa también en la copia de esta noche: mientras ninguna instantánea
    reciente contenga la versión buena, conservarla depende de las antiguas.
versions-event-lost =
    Ya ninguna instantánea contiene la versión buena del diario: la
    política de forget las ha quitado todas. En un servidor real, estaría
    perdida (salvo que haya otra copia en otro sitio). Aquí puedes
    reiniciar el capítulo desde el menú. Antes de borrar, forget --dry-run
    muestra lo que se iría.
versions-event-forgotten-without-prune =
    forget ha quitado instantáneas de la lista… pero df -h /mnt/ayuntamiento
    no se mueve: forget solo borra las «etiquetas». Los datos solo se van
    con prune (o forget --prune).
versions-event-place =
    El disco respira: prune ha borrado los datos que ya no usa ninguna
    instantánea restante (sobre todo los escaneos en bruto de enero).
    df -h /mnt/ayuntamiento lo muestra.
versions-event-end =
    Rosa vuelve a leer el diario de Marie: «Anoche ardió el mercado»,
    como en el cuaderno original. El disco del ayuntamiento tiene sitio,
    el repositorio está comprobado y la contraseña ya no está al alcance
    de todo el mundo.

    ¡Bien hecho! Has terminado el capítulo 2 de El Archivo.

    QUÉ HA PASADO
    Un script estropeó un archivo; cada noche, la copia guardó la versión
    estropeada. Como restic conserva instantáneas, la versión buena seguía
    en las de antes del 2 de febrero. Un espejo la habría perdido desde la
    primera noche.

    BUENA PRÁCTICA
    - Conserva versiones, y una política clara: por ejemplo 7 diarias, 4
      semanales, 12 mensuales (forget --keep-daily 7 --keep-weekly 4
      --keep-monthly 12 --prune). Pruébala con --dry-run.
    - Un error puede pasar desapercibido durante días: hacen falta
      versiones más antiguas que el tiempo que se tarda en darse cuenta.
    - forget quita instantáneas; solo prune devuelve el espacio.
    - restic check con regularidad, y una restauración real de vez en
      cuando: una copia que nunca se ha restaurado es solo una esperanza.
    - Cifra las copias que duermen en casa de otros, y guarda bien la
      contraseña (archivo en 600, y una copia fuera de la máquina).

    OTRA MANERA
    rsnapshot («Instantáneas», La Ludoteca): cada instantánea es una
    carpeta normal que se lee con ls y se recupera con cp, sin necesidad
    de herramienta para restaurar; pero sin cifrado, y con deduplicación
    solo por archivo entero. restic: cifrado, deduplicado por trozos, y un
    repositorio que puede vivir en otro sitio (sftp, almacenamiento de
    objetos).

    DOCUMENTACIÓN
    - Trabajar con repositorios: https://restic.readthedocs.io/en/stable/045_working_with_repos.html
    - Restaurar: https://restic.readthedocs.io/en/stable/050_restore.html
    - Quitar instantáneas: https://restic.readthedocs.io/en/stable/060_forget.html
