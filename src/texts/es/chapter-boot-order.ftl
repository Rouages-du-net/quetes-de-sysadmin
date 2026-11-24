### Historia «El Comedor», capítulo 1 «El orden de arranque»: la aplicación
### arranca antes que su base de datos (After=, Requires=, Wants=). Los
### nombres de unidades, las rutas y los mensajes de systemd no se traducen.

chapter-boot-order = El orden de arranque
    .summary = Tras un corte de luz, el servidor del comedor vuelve, pero su aplicación de reservas no: arranca antes que su base de datos. Enseñarle a systemd el orden.

## Archivos

boot-order-message-ibrahim =
    De:      Ibrahim
    Para:    tú
    Asunto:  Las reservas se han vuelto a caer

    Hola:

    Esta mañana ha habido un corte de luz en el barrio. El servidor ha
    vuelto solo, pero las reservas no: la aplicación del menú (el servicio
    menu) está en «failed». El voluntariado de la cocina no puede ver quién
    viene a comer.

    La última vez simplemente hice sudo systemctl start menu y funcionó.
    Pero después de cada reinicio es la misma historia, y no siempre estoy.
    Escribí yo mismo el archivo de unidad, /etc/systemd/system/menu.service,
    siguiendo un tutorial: funciona cuando lo arranco a mano, así que no
    puede estar tan mal, ¿no?

    ¿Puedes hacer que las reservas vuelvan solas después de un reinicio?
    Puedes reiniciar el servidor para comprobarlo (sudo reboot): a esta
    hora no reserva nadie. Tu contraseña de sudo es lentejas-2028.

    ¡Gracias!
    Ibrahim

## Eventos

boot-order-event-refused =
    «connect ECONNREFUSED 127.0.0.1:5432»: la aplicación llamó a la puerta
    de PostgreSQL (puerto 5432)… y nadie contestó. Y sin embargo postgresql
    funciona ahora. Mira el journal de este arranque, unidad por unidad y
    por orden cronológico (journalctl -b): ¿quién arrancó primero? ¿Y qué
    dice el archivo de unidad sobre la base de datos? (systemctl cat menu)
boot-order-event-by-hand =
    La aplicación vuelve a funcionar, arrancada a mano: la cocina puede
    tomar reservas. Pero nada ha cambiado en su unidad: en el próximo
    reinicio, arrancará en el mismo orden que esta mañana. Corrige la causa,
    y luego reinicia para comprobarlo (sudo reboot).
boot-order-event-wrong-name =
    Cuidado con el nombre: systemd conoce postgresql.service, no
    postgres.service. Un After= o un Wants= sobre una unidad que no existe
    se ignora sin decir nada (systemctl list-dependencies menu,
    systemd-analyze verify menu.service).
boot-order-event-requires-only =
    Sigue en failed después del reinicio, aun con la dependencia declarada.
    Requires= (o Wants=) dice «arranca también PostgreSQL», no «arráncalo
    primero»: los dos arrancan a la vez, y la aplicación sigue llegando
    demasiado pronto. El orden es otra línea: After= (man systemd.unit).
boot-order-event-order =
    systemd sabe ahora que la aplicación arranca después de PostgreSQL
    (systemctl list-dependencies --after menu). Un reinicio dirá si basta:
    sudo reboot, y luego mira los servicios.
boot-order-event-end =
    Tras el reinicio, PostgreSQL arrancó primero, luego la aplicación, luego
    nginx: todo funciona sin que nadie toque nada. Ibrahim: «¡Así que para
    eso sirve After=! Lo pondré en mi tutorial».

    ¡Bien hecho! Has terminado el capítulo «El orden de arranque».

    QUÉ HA PASADO
    Al arrancar, systemd lanza los servicios activados en paralelo, lo más
    rápido que puede. Nada en la unidad de Ibrahim decía que la aplicación
    necesitaba la base de datos: la aplicación arrancó a la vez que
    PostgreSQL, intentó conectarse antes de que PostgreSQL estuviera listo,
    y se paró. Arrancada a mano más tarde, encontró la base de datos en
    marcha: «funciona a mano», pero no al arrancar.

    DEPENDENCIA U ORDEN: DOS COSAS DISTINTAS
    - Requires=postgresql.service: arranca también PostgreSQL, y si falla,
      no arranques la aplicación. Wants= es la versión suave (arráncalo,
      pero sigue si falla).
    - After=postgresql.service: si los dos arrancan, arranca primero
      PostgreSQL, y espera a que esté listo.
    - Solos, Requires= o Wants= arrancan los dos a la vez; solo, After=
      ordena pero no arrastra nada. La pareja habitual: After= + Requires=
      (o Wants=).

    BUENA PRÁCTICA
    - Pon el cambio en un drop-in (sudo systemctl edit menu) o en el archivo
      de unidad, y luego sudo systemctl daemon-reload; compruébalo con
      systemctl cat menu y systemctl list-dependencies menu.
    - systemd-analyze verify menu.service detecta las erratas (claves
      desconocidas, unidades que no existen).
    - Un servicio que «funciona a mano» no demuestra nada sobre el próximo
      arranque: la única prueba es un reinicio (en un momento tranquilo), y
      luego systemctl --failed.
    - El programa también debería ser paciente: una aplicación que vuelve a
      intentar conectarse a su base de datos durante unos segundos sobrevive
      a un arranque lento.

    DOCUMENTACIÓN
    - systemd.unit, After= y Requires=: https://www.freedesktop.org/software/systemd/man/latest/systemd.unit.html
    - systemctl (cat, list-dependencies, edit): https://www.freedesktop.org/software/systemd/man/latest/systemctl.html
