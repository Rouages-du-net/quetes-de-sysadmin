### Historia «El Viejo Sun», capítulo «Confiar, y luego cambiar»: apuntar el
### catálogo al servidor nuevo y dejar el viejo congelado. Los comandos,
### rutas y parámetros no se traducen.

chapter-switch-over = Confiar, y luego cambiar
    .summary = Comprueba que las dos bases coinciden, apunta el catálogo a greenhouse y deja la vieja congelada en lugar de borrada, hasta que la nueva haya demostrado lo que vale.

## Files

switch-over-email-inaya =
    De:    Inaya
    Para:  tú

    El mostrador de préstamos vuelve a abrir mañana. Mi sobrino abrió el
    PostgreSQL de greenhouse a herbario (listen_addresses y pg_hba.conf,
    dice). La configuración del catálogo está en
    /etc/opt/seed-catalogue/catalogue.ini.

    Odette pide una cosa: «no tiréis la vieja enseguida».

    Inaya

switch-over-migration =
    # Sacar el catálogo de herbario

    ## Hecho
    - Instantánea: data/postgres@before-migration.
    - Volcado (LATIN1) restaurado en greenhouse (UTF8), acentos comprobados.

    ## Por hacer
    - Comprobar: los mismos recuentos en los dos lados.
    - Apuntar el catálogo a greenhouse, y volver a arrancarlo.
    - La base vieja: conservarla, pero asegurarse de que nada escribe en
      ella.

## Events

switch-over-event-counted =
    Contado en greenhouse. La misma consulta en herbario debería dar los
    mismos números: esa es la prueba, antes de que nadie escriba en la
    nueva.
switch-over-event-still-old =
    El catálogo vuelve a funcionar… pero todavía con la base de herbario
    (db_host = localhost): los nuevos préstamos irían a la máquina vieja.
    Cambia catalogue.ini y luego reinícialo (svcadm restart).
switch-over-event-online =
    El catálogo está en línea y escribe en greenhouse.
switch-over-event-frozen =
    En la base vieja ya no se puede escribir: si algo apunta todavía a
    ella, fallará con estrépito en lugar de llenar en silencio la base
    equivocada.
switch-over-event-not-kept =
    Cuidado: los datos viejos o su instantánea han desaparecido. Hasta que
    el servidor nuevo haya demostrado lo que vale (unas semanas de uso, una
    copia restaurada), la máquina vieja es el camino de vuelta.
switch-over-event-end =
    Inaya: «Primer préstamo en el servidor nuevo: la judía 'Mère Hélène',
    para Zoë. Y el Sun sigue en el armario, tranquilo, por si acaso.»

    ¡Bien hecho! Has terminado el capítulo «Confiar, y luego cambiar» y la
    historia «El Viejo Sun».

    QUÉ HA PASADO
    Comprobaste que las dos bases coinciden, apuntaste el catálogo a
    greenhouse y lo reiniciaste, y congelaste la base vieja sin borrarla.
    Si algo va mal en las próximas semanas, el camino de vuelta sigue ahí:
    los datos de herbario, su instantánea ZFS y las notas de Odette.

    BUENA PRÁCTICA
    - Comprueba antes de cambiar: recuentos en los dos lados, algunas
      filas a mano.
    - Cambia en un solo sitio (la configuración de la aplicación), y luego
      reinicia lo que la lee.
    - Congela el sistema viejo en lugar de borrarlo: en solo lectura
      (default_transaction_read_only) o parado, pero conservado.
    - Decide de antemano cuándo se irá de verdad la máquina vieja: por
      ejemplo, tras la primera copia restaurada de la nueva.

    OTRA MANERA
    Un nombre DNS para la base de datos (db.seeds.internal) permitiría
    cambiar modificando un registro, sin tocar la aplicación. Para un
    servicio que no puede parar, la replicación lógica copia los cambios
    de forma continua hasta el cambio.

    DOCUMENTACIÓN
    - default_transaction_read_only: https://www.postgresql.org/docs/16/runtime-config-client.html
    - svcadm(1M): https://docs.oracle.com/cd/E26505_01/html/816-5166/svcadm-1m.html
