### Historia «El Teatro», capítulo 4 «La conmutación»: un standby en
### streaming, su promoción, la aplicación apuntando a él. El SQL, las rutas
### y las salidas de las herramientas no se traducen.

chapter-failover = La conmutación
    .summary = El primario de la base de datos, en otro servidor, está muerto desde el amanecer, y todas las páginas de la taquilla fallan. Esta máquina guarda una réplica, al día hasta el último segundo. Convertirla en el primario, y hacer que vuelva la taquilla.

## Archivos

failover-message-camille =
    De:      Camille
    Para:    tú
    Asunto:  stage ha muerto

    Hola:

    El mes pasado, el técnico de nuestro proveedor movió el primario de la
    base de datos a un segundo servidor, stage.internal, y configuró esta
    máquina como una «réplica» que lo copia todo en tiempo real. «Si stage
    falla, pasáis a la réplica», dijo. Desde entonces se ha ido.

    El proveedor escribe que el disco de stage murió a las 6:47 de esta
    mañana, y que no volverá antes de mañana. Desde entonces la taquilla
    muestra errores, y la función de la tarde empieza a las 20:00.

    ¿Puedes hacer el cambio? Los ajustes de la aplicación están en
    /srv/boxoffice/.env.

    La misma contraseña de sudo: telon-2028.

    Camille

## Eventos

failover-event-down =
    stage.internal (192.0.2.29) no responde: «No route to host». La
    DATABASE_URL de la aplicación apunta a él, y también el PostgreSQL de
    esta máquina, que lo espera en su registro. Entonces, ¿qué es el
    PostgreSQL de esta máquina? (man pg_lsclusters)
failover-event-standby =
    online,recovery: este PostgreSQL es un standby. Reproduce lo que le envía
    su primario (primary_conninfo en postgresql.auto.conf; standby.signal en
    su carpeta de datos lo mantiene en recuperación), y rechaza cualquier
    escritura. ¿Hasta dónde llegó antes de que stage muriera? (man psql:
    pg_last_xact_replay_timestamp)
failover-event-lag =
    La última transacción reproducida es de las 06:47:14, un segundo antes
    de que stage muriera: no se pierde casi nada. Un standby no puede
    convertirse en primario por sí solo; alguien tiene que decidirlo (man
    pg_ctlcluster: promote).
failover-event-restarted-standby =
    Reiniciado, y sigue siendo un standby: standby.signal sigue ahí, y un
    reinicio no cambia un papel. Lo hace la promoción (pg_ctlcluster 16 main
    promote, o SELECT pg_promote()).
failover-event-read-only =
    La aplicación habla ahora con el PostgreSQL de esta máquina, pero sigue
    siendo un standby: «cannot execute INSERT in a read-only transaction».
    Promuévelo primero.
failover-event-promoted =
    Promovido: este PostgreSQL sale de la recuperación, toma una nueva línea
    temporal (timeline) y acepta escrituras. Ahora es el primario. Falta que
    la aplicación venga a él.
failover-event-restart-app =
    El .env apunta ahora a esta máquina, pero la aplicación lo lee al
    arrancar: reiníciala (sudo systemctl restart boxoffice).
failover-event-end =
    La taquilla vuelve a responder, con la base de datos de esta máquina,
    que ahora es el primario. Camille: «Doce jurados sin piedad esta noche:
    quedan 64 butacas, ¡y la gente está reservando!».

    ¡Bien hecho! Has terminado el capítulo «La conmutación».

    QUÉ HA PASADO
    El primario (stage) murió a las 06:47:15. El standby de aquí lo había
    reproducido todo hasta las 06:47:14, pero un standby es de solo lectura
    y espera a su primario para siempre: nada cambia por sí solo. Lo
    promoviste, y luego hiciste que la aplicación apuntara a él y la
    reiniciaste.

    LOS PASOS DE UNA CONMUTACIÓN
    - Comprueba que el primario se ha ido de verdad (pg_isready -h, ping):
      dos primarios a la vez es el peor caso (split brain).
    - Comprueba hasta dónde llegó el standby:
      pg_last_xact_replay_timestamp().
    - Promueve: pg_ctlcluster 16 main promote, o SELECT pg_promote().
    - Haz que los clientes apunten al nuevo primario, y reinícialos.

    DESPUÉS
    - Cuando stage vuelva, no debe arrancar como primario: reconstrúyelo
      como standby del nuevo primario (pg_basebackup), o bórralo.
    - Hasta entonces, ya no tienes réplica: planifica ya la siguiente.
    - Pon el procedimiento por escrito, y ensáyalo: una conmutación se
      aprende un día tranquilo, no la noche de una función.

    DOCUMENTACIÓN
    - La conmutación: https://www.postgresql.org/docs/16/warm-standby-failover.html
    - Las funciones de control de la recuperación: https://www.postgresql.org/docs/16/functions-admin.html#FUNCTIONS-RECOVERY-CONTROL
    - pg_ctlcluster: https://manpages.debian.org/bookworm/postgresql-common/pg_ctlcluster.1.en.html
