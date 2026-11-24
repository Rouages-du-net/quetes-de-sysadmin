### Historia «El Teatro», capítulo 2 «La consulta lenta»: EXPLAIN, un
### recorrido secuencial, CREATE INDEX. El SQL, las rutas y las salidas de
### las herramientas no se traducen.

chapter-slow-query = La consulta lenta
    .summary = El plano de la sala tarda cinco segundos en aparecer, para cada espectáculo. PostgreSQL registra la consulta lenta; pregúntale cómo la ejecuta, y dale un atajo.

## Archivos

slow-query-message-camille =
    De:      Camille
    Para:    tú
    Asunto:  El plano de la sala va lentísimo

    Hola:

    ¡Gracias otra vez por la noche del estreno! Ahora el plano de la sala va
    muy lento: cinco segundos antes de que aparezcan las butacas, para cada
    espectáculo. Cuando abrió el teatro era instantáneo. Para
    cronometrarlo:
      curl -s -o /dev/null -w '%{"{"}time_total{"}"}\n' http://localhost:3000/shows/42/seats

    La tabla bookings guarda cada butaca vendida desde que abrió el teatro.
    No quiero borrar nuestro historial.

    La misma contraseña de sudo: telon-2028.

    Camille

## Eventos

slow-query-event-slow =
    4812 ms para una consulta: SELECT seat, status FROM bookings WHERE
    show_id = 42. PostgreSQL registra cada sentencia que tarda más de 1 s
    (log_min_duration_statement en postgresql.conf). ¿Cómo la ejecuta? (man
    psql: EXPLAIN)
slow-query-event-seqscan =
    Seq Scan on bookings: para encontrar las 380 butacas del espectáculo
    42, PostgreSQL lee la tabla entera, las 480 000 filas (con dos procesos
    paralelos, pero aun así). «Rows Removed by Filter» en EXPLAIN ANALYZE
    dice cuántas ha leído para nada. Un índice de show_id le permitiría ir
    directamente a las filas correctas.
slow-query-event-wrong-column =
    Un índice en bookings, pero no en la columna de la condición: la
    consulta busca show_id = 42, y EXPLAIN sigue leyendo la tabla entera. Un
    índice ayuda a las consultas que filtran (u ordenan) por su columna.
slow-query-event-vacuum =
    VACUUM ordena las filas muertas, ANALYZE refresca las estadísticas que
    usa el planificador: las dos cosas son sanas, pero ninguna crea una
    manera de encontrar las filas de un espectáculo sin leerlas todas.
slow-query-event-end =
    El plano de la sala vuelve a aparecer al instante: EXPLAIN usa ahora el
    índice { $index } (Index Scan), y lee 380 filas en lugar de 480 000.
    Camille: «¡Y conservamos todo el historial!».

    ¡Bien hecho! Has terminado el capítulo «La consulta lenta».

    QUÉ HA PASADO
    La tabla bookings crece con cada espectáculo. Sin un índice en show_id,
    encontrar las butacas de un espectáculo obliga a leer todas las filas:
    va bien con unos miles, son cinco segundos con 480 000. EXPLAIN lo
    decía: Seq Scan, Filter, Rows Removed by Filter.

    EL ÍNDICE
    Un índice (un árbol B por defecto) es una copia ordenada de una columna,
    con el sitio de cada fila: PostgreSQL encuentra las filas del
    espectáculo 42 en unos pocos pasos, sea cual sea el tamaño de la tabla.
    Ocupa sitio en disco y ralentiza un poco cada INSERT: se indexan las
    columnas por las que filtran tus consultas, no todas las columnas.

    BUENA PRÁCTICA
    - Encuentra las consultas lentas: log_min_duration_statement (o la
      extensión pg_stat_statements).
    - EXPLAIN muestra el plan; EXPLAIN ANALYZE lo ejecuta y añade los
      tiempos reales.
    - En una tabla de producción con mucha actividad, CREATE INDEX
      CONCURRENTLY no bloquea las escrituras mientras se construye.

    DOCUMENTACIÓN
    - EXPLAIN: https://www.postgresql.org/docs/16/using-explain.html
    - Los índices: https://www.postgresql.org/docs/16/indexes-intro.html
    - CREATE INDEX: https://www.postgresql.org/docs/16/sql-createindex.html
