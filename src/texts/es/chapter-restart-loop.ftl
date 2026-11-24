### Historia «El Comedor», capítulo 2 «El bucle de reinicios»: Restart=,
### RestartSec=, el límite de arranques, PartOf=. Los nombres de unidades,
### las rutas y los mensajes de systemd no se traducen.

chapter-restart-loop = El bucle de reinicios
    .summary = Restart=always tenía que hacer volver la aplicación sola: anoche se rindió al cabo de medio segundo. Hacer que sobreviva a los reinicios de PostgreSQL.

## Archivos

restart-loop-message-ibrahim =
    De:      Ibrahim
    Para:    tú
    Asunto:  Restart=always no ha servido de nada

    Hola:

    Desde tu arreglo, los reinicios van bien. Pero anoche, las
    actualizaciones automáticas actualizaron PostgreSQL (lo reinician al
    hacerlo), y esta mañana las reservas volvían a estar caídas.

    Había leído que Restart=always hace que systemd reinicie un servicio que
    muere, así que lo había añadido a /etc/systemd/system/menu.service hace
    unos días. Por lo visto systemd lo intentó… ¿y luego se rindió? No
    entiendo el journal.

    Las actualizaciones volverán a reiniciar PostgreSQL: ¿puedes hacer que
    la aplicación lo aguante sola? Para probar, puedes hacer lo que hacen las
    actualizaciones: sudo systemctl restart postgresql. Las reservas tienen
    que volver sin que nadie arranque la aplicación a mano. La misma
    contraseña de sudo: lentejas-2028.

    Ibrahim

## Eventos

restart-loop-event-limit =
    «Start request repeated too quickly», Result: start-limit-hit. Cuando
    PostgreSQL se reinició, la aplicación perdió su conexión y salió;
    Restart= la reinició al cabo de RestartSec=, 100 ms por defecto…
    mientras PostgreSQL todavía se estaba reiniciando. Cinco fallos en
    medio segundo: pasado el límite de arranques (5 arranques en 10 s por
    defecto), systemd se rinde. Mira las horas en journalctl -u menu.
restart-loop-event-too-often =
    «start of the service was attempted too often»: systemd cuenta los
    arranques, incluso los tuyos, y se niega mientras el límite esté
    alcanzado. Una vez corregida la causa, sudo systemctl reset-failed menu
    olvida los fallos (systemctl start también vuelve a funcionar pasado
    StartLimitIntervalSec=).
restart-loop-event-again =
    El mismo bucle: PostgreSQL se reinició, la aplicación murió, volvió
    cinco veces demasiado pronto, y systemd volvió a rendirse. Mientras la
    aplicación se reinicie antes de que vuelva la base de datos, Restart=
    solo no servirá. O le das tiempo a PostgreSQL (RestartSec=), o atas la
    aplicación a PostgreSQL para que se pare y vuelva a arrancar con él (man
    systemd.unit: PartOf=).
restart-loop-event-binds-to =
    BindsTo= ha parado la aplicación con PostgreSQL, esta vez limpiamente.
    Pero nada la ha vuelto a arrancar: BindsTo= propaga la parada, no el
    arranque. Para «reiniciarse con él», es PartOf= (con After=, para volver
    después de él).
restart-loop-event-end =
    PostgreSQL se ha reiniciado, y la aplicación ha vuelto sola, después de
    él. Ibrahim: «En la cocina ni se han dado cuenta. Esta noche dejaré
    pasar las actualizaciones».

    ¡Bien hecho! Has terminado el capítulo «El bucle de reinicios».

    QUÉ HA PASADO
    Cuando PostgreSQL se reinicia, la aplicación pierde su conexión y sale
    con un fallo. Restart=always hacía que systemd la reiniciara al cabo de
    RestartSec=, 100 ms por defecto: cinco veces en medio segundo, mientras
    la base de datos todavía se estaba reiniciando. Pasados
    StartLimitBurst= arranques (5) en StartLimitIntervalSec= (10 s), systemd
    deja de intentarlo: Result: start-limit-hit, y la aplicación se quedó
    caída hasta la mañana.

    DOS SALIDAS
    - PartOf=postgresql.service (con After=): cuando PostgreSQL se para o se
      reinicia, systemd para primero la aplicación, y la vuelve a arrancar
      después de la base de datos. Ningún fallo.
    - Restart=on-failure con RestartSec=5s: la aplicación muere, pero
      systemd espera lo suficiente para que PostgreSQL vuelva antes de
      reintentarlo.
    - BindsTo= para la aplicación con PostgreSQL pero no la hace volver.

    BUENA PRÁCTICA
    - Restart=on-failure en lugar de always (una parada limpia no es un
      fallo), y un RestartSec= de unos segundos: un bucle de reinicios
      instantáneos solo llena el journal.
    - Tras un start-limit-hit, corrige la causa, y luego systemctl
      reset-failed y systemctl start.
    - Prueba de día lo que pasará de noche: sudo systemctl restart
      postgresql, y luego systemctl status menu.

    DOCUMENTACIÓN
    - Restart=, RestartSec=: https://www.freedesktop.org/software/systemd/man/latest/systemd.service.html#Restart=
    - StartLimitIntervalSec=, StartLimitBurst=, PartOf=, BindsTo=: https://www.freedesktop.org/software/systemd/man/latest/systemd.unit.html
