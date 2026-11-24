### Historia «La Despensa», capítulo «El simulacro de restauración»: la
### pérdida del servidor escenificada en un portátil prestado (repuesto),
### solo con el disco y el sobre de la tesorera. cryptsetup open, restic check
### --read-data, restic restore, sha256sum -c, y la base de datos que olvidó
### la tarea. Los comandos, opciones, rutas y salidas no se traducen.

chapter-restore-drill = El simulacro de restauración
    .summary = Sábado por la mañana, la despensa escenifica la pérdida de su servidor: un portátil prestado, el disco de copias y el sobre de la tesorera, nada más. Abre el disco, lee el repositorio hasta sus datos, restaura, demuestra que los archivos están intactos y descubre lo que la copia nunca contuvo.

## Files

restore-drill-message-fatou =
    De: Fatou (coordinadora)
    Sábado 17 de marzo, 9:45

    Hoy hacemos como si cajon hubiera desaparecido: quemado, robado, lo
    que sea. Noor nos ha prestado su viejo portátil, al que llamamos
    repuesto. Tiene Debian recién instalado (con cryptsetup y restic),
    puedes llegar a él desde cajon (ssh repuesto), y Joaquín le ha
    conectado el disco de copias.

    La regla del juego: en repuesto, solo el disco y lo que hay en el
    sobre de Mei. Nada de cajon: en un desastre de verdad, los archivos de
    cajon serían cenizas. Mei nos ha abierto el sobre:

        Disco de copias (LUKS):          { $disk }
        Copias (recuperación restic):    { $restic }

    (Después sellará uno nuevo.) La lista de comprobación está en
    simulacro.txt.

    Fatou

restore-drill-checklist =
    SIMULACRO DE RESTAURACIÓN — lista de comprobación (Fatou, marzo de 2029)

    1. En repuesto: encontrar el disco de copias, abrirlo con la frase de
       paso del sobre, montarlo.
    2. Abrir el repositorio con la contraseña del sobre; listar las
       instantáneas.
    3. Comprobar el repositorio, entero, datos incluidos.
    4. Restaurar la última instantánea AL LADO (no encima de nada), por
       ejemplo bajo /srv/restore.
    5. Demostrar que los archivos están intactos: la tarea escribe su
       SHA-256 en SHA256SUMS antes de cada copia.
    6. ¿Podría volver a arrancar la aplicación con esto? Necesita sus
       archivos Y su base de datos (el volcado nocturno, pantry.sql).
    7. Arreglar lo que haya revelado el simulacro. Cerrar el disco en
       repuesto.

## Events

restore-drill-event-log =
    «backup completed», cada noche. El registro dice que el script llegó a
    su última línea: no dice qué se copió, ni si se puede volver a leer.
    Para eso es hoy.
restore-drill-event-plugged =
    Ahí está, en repuesto: sdb1, crypto_LUKS. repuesto no tiene archivo de
    clave, ni crypttab, nada: la frase de paso del sobre es la única
    entrada (cryptsetup open).
restore-drill-event-copied-secret =
    Eso es un secreto de cajon (su archivo de clave, o la contraseña restic
    de la tarea), copiado en repuesto. En un desastre de verdad se habría
    quemado con cajon: así el simulacro no demuestra nada. Bórralo de
    repuesto y usa el sobre.
restore-drill-event-opened-key =
    El disco se abrió con el archivo de clave de cajon: es la clave que
    muere con cajon. Ciérralo, y vuelve a abrirlo con la frase de paso de
    Mei.
restore-drill-event-opened =
    El disco se abre solo con la frase de paso del sobre: primera mitad de
    la pregunta de Mei, respondida de verdad. repuesto no tiene
    /mnt/offsite: cualquier carpeta vacía sirve como punto de montaje
    (mkdir).
restore-drill-event-mounted =
    Montado. El repositorio está en restic/: repuesto no tiene
    /root/.restic-pass, así que restic pedirá la contraseña (o da -r y
    escribe la del sobre).
restore-drill-event-nightly-key =
    Esa es la contraseña de la tarea, de cajon: el día de un desastre de
    verdad, no la tendrías. Usa la del sobre.
restore-drill-event-snapshots =
    El repositorio se abre con la contraseña del sobre: segunda mitad de la
    pregunta. Antes de fiarte de él, compruébalo, hasta los datos.
restore-drill-event-check-only =
    restic check, sin opciones, comprueba la estructura del repositorio
    (índices, instantáneas, árboles): no el contenido de los paquetes. Para
    volver a leer cada byte del disco, es --read-data (man restic).
restore-drill-event-read-data =
    Cada paquete releído y verificado: los datos de este disco están
    enteros. Ahora restaura la última instantánea, al lado: restore …
    --target CARPETA vuelve a crear debajo la ruta completa.
restore-drill-event-over-root =
    --target / escribe los archivos donde estaban. En un repuesto vacío no
    hace daño, pero en una máquina en servicio sobrescribiría los datos de
    hoy con los de anoche. En un simulacro, restaura al lado y compara.
restore-drill-event-restored =
    Los archivos han vuelto, bajo la ruta completa que restic volvió a
    crear. Restaurado no es lo mismo que correcto: compáralos con lo que
    registró la tarea antes de la copia (SHA256SUMS, sha256sum -c, desde su
    carpeta).
restore-drill-event-mismatch =
    sha256sum señala un archivo que no coincide, o uno que no puede leer.
    Ejecútalo desde la carpeta donde está SHA256SUMS: los nombres de dentro
    son relativos.
restore-drill-event-verified =
    Cada archivo coincide con su SHA-256: la restauración es exacta. A la
    lista le queda una línea: la base de datos.
restore-drill-event-no-dump =
    No hay pantry.sql en ninguna instantánea: la tarea solo copia
    /srv/despensa. El volcado nocturno se escribe en cajon, en { $dump }, y
    nada se lo lleva nunca. Sin él, la aplicación volvería a arrancar
    vacía: ni visitas, ni citas. Arregla la tarea en cajon (su línea restic
    backup).
restore-drill-event-fixed =
    La tarea copia ahora también el volcado de la base de datos: a partir
    de esta noche, una restauración trae la aplicación entera. (El volcado
    se escribe a las 23:30, la copia se ejecuta a la 1:00: el orden es
    correcto.)
restore-drill-event-closed =
    El disco está desmontado y cerrado en repuesto: Joaquín puede
    llevárselo.
restore-drill-event-end =
    Fatou: «Así que: el sobre lo abre todo, los archivos vuelven intactos,
    y hemos encontrado el agujero antes del incendio. ¿El mismo simulacro
    dentro de seis meses?» Mei ya está sellando un sobre nuevo.

    ¡Bien hecho! Has terminado La Despensa.

    QUÉ HA PASADO
    Escenificaste la pérdida de cajon en una máquina vacía solo con el
    disco y el sobre: la frase de paso abrió el disco, la contraseña de
    recuperación abrió el repositorio, check --read-data leyó cada
    paquete, la última instantánea volvió al lado, y sha256sum -c demostró
    que los archivos eran exactos. El simulacro también encontró lo que
    ningún registro mostraba: el volcado de la base de datos nunca se
    copiaba. Ahora la tarea lo incluye.

    BUENA PRÁCTICA
    - Una copia que no has restaurado es una esperanza. Haz simulacros con
      regularidad, en otra máquina, solo con lo que sobreviviría a un
      desastre.
    - «backup completed» demuestra que el script terminó, no que contenga
      lo que debe: lista lo que necesita una restauración (archivos, base
      de datos, configuración) y busca cada cosa.
    - restic check --read-data vuelve a leer cada byte: ejecútalo de vez en
      cuando (o --read-data-subset en repositorios grandes).
    - Restaura al lado, y luego compara (sumas de comprobación, diff): nunca
      encima de datos vivos.
    - Anota cuánto duró el simulacro: es tu tiempo real de recuperación.
    - Base de datos: copia un volcado (pg_dump), hecho antes de que se
      ejecute la copia.

    DOCUMENTACIÓN
    - restic, restaurar: https://restic.readthedocs.io/en/stable/050_restore.html
    - restic, comprobar: https://restic.readthedocs.io/en/stable/045_working_with_repos.html#checking-integrity-and-consistency
    - sha256sum: https://www.gnu.org/software/coreutils/manual/html_node/sha2-utilities.html
    - PostgreSQL, copia y restauración: https://www.postgresql.org/docs/current/backup-dump.html
