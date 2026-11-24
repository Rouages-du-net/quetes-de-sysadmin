### Historia «La Gaceta», capítulo 5 «La migración»: una migración de base
### de datos que impide volver atrás. Los comandos, las rutas y los mensajes
### de journalctl, systemctl y curl no se traducen.

chapter-migration = La migración
    .summary = La nueva versión ha migrado la base de datos: la antigua ya no puede leerla. Cuando volver atrás es imposible, se arregla hacia delante.

## Archivos

migration-message-samia =
    Un mensaje de Samia, martes 8:30:

    «¡El Quiosco responde con un error desde esta mañana! Théo puso la
    2.0.0 en verde (green) anoche y cambió nginx antes de irse (su nota
    está al lado de esta). Esta mañana intentó volver a azul (blue)… y
    tampoco funcionó, así que lo volvió a poner todo en verde.

    Necesitamos:
      - que el Quiosco vuelva a funcionar;
      - y que la otra ranura vuelva a ser una verdadera red de seguridad,
        lista para tomar el relevo.

    Para sudo: gazette-2027.»
migration-word-theo =
    Una nota de Théo:

    «Perdón… Lancé la 2.0.0 en verde anoche hacia las 23:00, /health no
    estaba contento pero cambié igualmente, era tarde. Esta mañana intenté
    volver a poner azul (1.6.1): error también. No entiendo nada, ¡la
    1.6.1 funcionaba perfectamente anteayer!»
migration-notes-200 =
    Quiosco 2.0.0 — notas de versión

    ATENCIÓN: esta versión MIGRA LA BASE DE DATOS al arrancar
    (esquema 3 → 4: la columna subscribers.mail pasa a ser
    subscribers.email). Las versiones 1.x no pueden leer una base de
    datos migrada: haz una copia de seguridad (pg_dump) antes de arrancar
    la 2.0.0.

    Configuración: KIOSK_SMTP se sustituye por una dirección completa,
      KIOSK_SMTP_URL=smtp://smtp.gazette.example:587
    (en /etc/kiosk/kiosk.env).

## Eventos

migration-event-green-sick =
    Verde (2.0.0) no está sano: falta una variable de configuración. Sus
    notas de versión (/srv/kiosk/versions/2.0.0/) probablemente dicen qué
    ha cambiado.
migration-event-schema =
    Azul (1.6.1) ya no puede leer la base de datos: está en el esquema 4, y
    la 1.6.1 solo conoce el 3. ¿Quién la ha cambiado? El registro del
    servicio verde te lo dice (journalctl -u kiosk-green).
migration-event-migration-view =
    Ahí está: al arrancar, la 2.0.0 migró la base de datos (la columna mail
    renombrada a email). Una migración no se deshace sola: la 1.6.1 nunca
    volverá a encontrar su columna. Volver a azul es imposible; queda
    arreglar hacia delante: hacer que funcione la 2.0.0.
migration-event-return-impossible =
    nginx envía el tráfico a azul (1.6.1)… que responde 500: la base de
    datos se migró bajo sus pies. Cambiar la versión del código no basta
    cuando los datos han cambiado de forma. Vuelve a poner verde, y
    arréglalo.
migration-event-repaired =
    El Quiosco vuelve a responder, con la 2.0.0. Pero la otra ranura
    ejecuta una versión que ya no puede leer la base de datos: ya no es
    una red de seguridad. Ponla también en la 2.0.0, sana.
migration-event-end =
    El Quiosco funciona con la 2.0.0, y las dos ranuras pueden leer la
    base de datos migrada: la próxima vuelta atrás será posible. Samia:
    «Y la próxima vez, una copia de la base de datos antes de cada
    migración».

    ¡Bien hecho! Has terminado el capítulo 5 de La Gaceta, y toda la
    historia.

    QUÉ HA PASADO
    La 2.0.0 migró la base de datos al arrancar, antes de recibir una sola
    visita. Cambiar el enlace del proxy devuelve el código antiguo, no la
    forma antigua de los datos: la 1.6.1 ya no podía leer la base de
    datos. Cuando volver atrás es imposible, se arregla hacia delante:
    aquí, la variable de configuración renombrada, anunciada en las notas
    de versión.

    BUENA PRÁCTICA
    - Lee las notas de versión; nunca cambies si /health se queja.
    - Haz una copia de la base de datos justo antes de una migración
      (pg_dump), y sabe restaurarla.
    - Migraciones compatibles con la versión anterior: primero ampliar
      (añadir la columna email, escribir en las dos), cambiar, y luego
      contraer (quitar mail) una versión más tarde.
    - Después de una migración, pon la ranura de reserva en la misma
      versión: una red de seguridad que no puede leer los datos no lo es.
    - Los registros del servicio (journalctl -u) cuentan lo que ha pasado.

    DOCUMENTACIÓN
    - Cambio en paralelo (ampliar y luego contraer): https://martinfowler.com/bliki/ParallelChange.html
    - pg_dump: https://www.postgresql.org/docs/current/app-pgdump.html
    - journalctl: https://www.freedesktop.org/software/systemd/man/latest/journalctl.html
