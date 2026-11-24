### Historia «El Teatro», capítulo 1 «Noche de estreno»: max_connections,
### pg_stat_activity, idle in transaction,
### idle_in_transaction_session_timeout. El SQL, las rutas y las salidas de
### las herramientas no se traducen.

chapter-too-many-clients = Noche de estreno
    .summary = La venta de entradas para la noche del estreno empezó a las 10:00, y desde entonces la taquilla responde con errores: PostgreSQL rechaza las conexiones nuevas. Averiguar quién las retiene, y hacer que no vuelva a pasar.

## Archivos

too-many-clients-message-camille =
    De:      Camille
    Para:    tú
    Asunto:  URGENTE: la taquilla no funciona

    Hola:

    La venta de «El Guardián del Faro» (noche del estreno, 28 de febrero)
    abrió a las 10:00, y desde las 10:05 más o menos la taquilla muestra
    «¡Lo sentimos! La taquilla no está disponible». La gente llama al
    teatro. El sitio: curl -i http://localhost:3000/

    Es una máquina pequeña, así que el año pasado bajamos el
    max_connections de PostgreSQL a 20. ¡Pero si solo tenemos una
    aplicación!

    La contraseña de sudo: telon-2028. El administrador de PostgreSQL es la
    cuenta postgres: sudo -u postgres psql.

    Camille

## Eventos

too-many-clients-event-full =
    «remaining connection slots are reserved for roles with the SUPERUSER
    attribute»: todas las conexiones normales están ocupadas. PostgreSQL
    reserva 3 de sus max_connections para los superusuarios: todavía puedes
    entrar con sudo -u postgres psql. ¿Quién retiene las demás? (man psql:
    pg_stat_activity)
too-many-clients-event-idle =
    «idle in transaction»: la aplicación abrió una transacción (BEGIN, y
    luego SELECT … FOR UPDATE: la butaca queda retenida), y desde entonces
    espera, sin COMMIT ni ROLLBACK. Mira state_change: algunas desde las
    10:00. Cada visitante que elige una butaca y se va sin pagar retiene
    una conexión para siempre.
too-many-clients-event-terminated =
    Se han terminado algunas conexiones, y la taquilla respira… durante un
    rato: cada nuevo visitante que elige una butaca retiene otra.
    Terminarlas a mano son primeros auxilios. PostgreSQL puede terminarlas
    él mismo al cabo de un tiempo (man psql: SHOW, ALTER SYSTEM; el ajuste
    trata de las sesiones inactivas dentro de una transacción).
too-many-clients-event-restart-needed =
    max_connections ha cambiado en el archivo, pero SHOW max_connections
    sigue diciendo el valor antiguo: este ajuste solo cambia con un
    reinicio de PostgreSQL («change requires restart»), que cierra todas las
    conexiones.
too-many-clients-event-more-room =
    Más sitio: la taquilla vuelve a funcionar, de momento. Pero la fuga
    sigue ahí: cada butaca abandonada retiene una conexión, y los nuevos
    huecos se llenarán igual (y cada conexión cuesta memoria en una máquina
    pequeña). ¿Qué termina las transacciones abandonadas?
too-many-clients-event-reload-needed =
    El archivo dice idle_in_transaction_session_timeout, pero el servidor
    todavía no lo ha leído: SHOW muestra el valor antiguo. Este no necesita
    reinicio: sudo systemctl reload postgresql (o SELECT pg_reload_conf();).
too-many-clients-event-too-long =
    Hay un tiempo máximo puesto, pero largo: una butaca retenida tanto
    tiempo bloquea a los demás compradores, y las conexiones se siguen
    acumulando durante la avalancha. Unos minutos como mucho (1min basta de
    sobra para una página de pago).
too-many-clients-event-stopped =
    Hay un servicio parado: PostgreSQL y la taquilla tienen que funcionar
    para la venta (sudo systemctl start …).
too-many-clients-event-end =
    Las transacciones abandonadas terminan ahora solas: la taquilla recupera
    sus conexiones, y la venta sigue. Camille: «¡Quedan siete butacas en la
    fila A, y ya nadie espera!».

    ¡Bien hecho! Has terminado el capítulo «Noche de estreno».

    QUÉ HA PASADO
    PostgreSQL acepta max_connections conexiones (20 aquí), y reserva 3 para
    los superusuarios. Cuando un visitante elegía una butaca, la aplicación
    abría una transacción para retenerla (FOR UPDATE), y la guardaba, con su
    conexión, hasta el pago. Los visitantes que se iban no pagaban nunca:
    cada uno dejaba una conexión «idle in transaction». A las 10:05, la
    aplicación las tenía todas.

    LAS HERRAMIENTAS
    - pg_stat_activity: una fila por conexión; state y state_change dicen
      quién espera, y desde cuándo.
    - pg_terminate_backend(pid): termina una; primeros auxilios.
    - idle_in_transaction_session_timeout: el servidor termina cualquier
      sesión inactiva dentro de una transacción durante más de ese tiempo.
      Se aplica con un reload.
    - max_connections necesita un reinicio, y más sitio solo retrasa una
      fuga.

    BUENA PRÁCTICA
    - No mantengas nunca una transacción abierta esperando a una persona:
      reserva una butaca con una fila y una fecha de caducidad, no con un
      bloqueo.
    - Pon idle_in_transaction_session_timeout (y statement_timeout) en
      cualquier servidor donde una aplicación pueda olvidar una transacción.
    - Los huecos reservados al superusuario son los que te dejan entrar
      durante el incidente: no le des a la aplicación el rol de
      superusuario.

    DOCUMENTACIÓN
    - Los ajustes de conexión: https://www.postgresql.org/docs/16/runtime-config-connection.html
    - idle_in_transaction_session_timeout: https://www.postgresql.org/docs/16/runtime-config-client.html
    - pg_stat_activity: https://www.postgresql.org/docs/16/monitoring-stats.html
