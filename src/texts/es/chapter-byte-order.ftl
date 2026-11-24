### Historia «El Viejo Sun», capítulo «Bytes en el orden equivocado»: mudar
### la base de datos a greenhouse con un volcado, no con sus archivos de
### datos, y cuidar el juego de caracteres. Los comandos, rutas y mensajes no
### se traducen.

chapter-byte-order = Bytes en el orden equivocado
    .summary = Muda la base de datos del catálogo al servidor nuevo: el tar de Odette con los archivos de datos no arrancará allí, un volcado sí; para antes lo que escribe y cuida los acentos.

## Files

byte-order-email-inaya =
    De:    Inaya
    Para:  tú

    He llamado a Odette. Dice que es fácil: «copia el tar semanal al
    servidor nuevo y arranca PostgreSQL encima, yo lo hice cuando
    cambiamos los discos». El mostrador de préstamos está cerrado hasta el
    jueves, así que podemos parar el catálogo mientras tanto.

    greenhouse es accesible desde herbario (ssh greenhouse, tu clave ya
    está allí).

    Inaya

byte-order-migration =
    # Sacar el catálogo de herbario

    ## El servicio de la base de datos (su nombre SMF)
    svc:/application/database/postgresql_84:default_64bit, y el
    catálogo: svc:/site/seed-catalogue:default.

    ## Dónde viven sus datos (directorio, dataset ZFS)
    /var/postgres/8.4/data_64, en data/postgres.

    ## La base de datos (nombre, versión de PostgreSQL, juego de caracteres)
    seeds, PostgreSQL 8.4, LATIN1. herbario es un SPARC (big-endian).

    ## Antes de tocar nada
    data/postgres@before-migration (zfs snapshot).

## Events

byte-order-event-incompatible =
    No arranca: estos archivos los escribió PostgreSQL 8.4, y greenhouse
    tiene la 16. Incluso con la misma versión no servirían: SPARC escribe
    sus números en big-endian, el x86 en little-endian, y un directorio de
    datos es la memoria del servidor puesta en disco, orden de los bytes
    incluido. Y un tar hecho con el servidor en marcha ni siquiera es
    coherente. Lo que viaja entre versiones y máquinas es un volcado: texto
    SQL (pg_dump).
byte-order-event-stopped =
    El catálogo está parado: nadie puede registrar un préstamo mientras
    copias. Un volcado es coherente consigo mismo, pero lo que se escriba
    después se perdería en el servidor nuevo.
byte-order-event-replacement =
    � donde deberían estar los acentos: el volcado está en LATIN1 (un byte
    por letra acentuada), y la terminal de greenhouse lee UTF-8. El archivo
    no está roto: sus primeras líneas dicen SET client_encoding = 'LATIN1',
    y psql lo convertirá al restaurarlo.
byte-order-event-invalid =
    «invalid byte sequence for encoding UTF8»: los bytes del archivo son
    LATIN1, pero ahora dice que es UTF-8. El archivo y su SET
    client_encoding tienen que coincidir.
byte-order-event-mojibake =
    CrimÃ©e en lugar de Crimée: los acentos se convirtieron dos veces. El
    archivo se convirtió a UTF-8 (iconv), pero sigue diciendo SET
    client_encoding = 'LATIN1', así que PostgreSQL volvió a convertir cada
    byte. Borra la base (dropdb) y restaura el volcado original tal cual, o
    corrige también su línea SET client_encoding.
byte-order-event-missing-rows =
    greenhouse no tiene todas las filas de herbario: se registraron
    préstamos después del volcado. Para primero el catálogo, vuelve a hacer
    el volcado y restáuralo en una base vacía.
byte-order-event-restored =
    La base seeds existe en greenhouse, con sus tres tablas.
byte-order-event-end =
    Inaya: «He abierto el catálogo en greenhouse: ¡el tomate 'Noire de
    Crimée' tiene todos sus acentos! Y los préstamos están todos.»

    ¡Bien hecho! Has terminado el capítulo «Bytes en el orden equivocado».

    QUÉ HA PASADO
    El tar de Odette contiene los archivos de datos de un PostgreSQL 8.4
    que funciona en SPARC: otra versión, y otro orden de bytes que el x86
    de greenhouse. Los archivos de datos no viajan; un volcado sí. Con el
    catálogo parado, el volcado lo contiene todo; restaurado con psql, su
    SET client_encoding = 'LATIN1' le dijo a PostgreSQL cómo leer los
    acentos, y los guardó en UTF-8.

    BUENA PRÁCTICA
    - Muda una base de datos entre versiones o máquinas con un volcado
      (pg_dump), nunca copiando sus archivos.
    - Para lo que escribe antes del volcado con el que vas a hacer el
      cambio.
    - Cuida el juego de caracteres: un archivo y la codificación que
      declara deben coincidir. file y head te dicen cuál es; en una
      terminal UTF-8, LATIN1 se ve como �, y eso no es un daño.
    - Comprueba después de restaurar: los recuentos, y algunas filas con
      acentos.

    OTRA MANERA
    pg_dump -E UTF8 convierte al hacer el volcado. Para una base grande,
    pg_dump -Fc (formato custom) con pg_restore -j restaura en paralelo.
    Entre dos máquinas con la misma versión y arquitectura, la replicación
    (streaming, o pg_upgrade para las versiones) evita una parada larga.

    DOCUMENTACIÓN
    - Actualizar un clúster PostgreSQL: https://www.postgresql.org/docs/16/upgrading.html
    - pg_dump: https://www.postgresql.org/docs/16/app-pgdump.html
    - Juegos de caracteres: https://www.postgresql.org/docs/16/multibyte.html
