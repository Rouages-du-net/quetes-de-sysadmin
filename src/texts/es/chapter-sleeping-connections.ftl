### Historia «Los Huertos», capítulo «Conexiones dormidas»: el sitio de los
### huertos responde «Too many connections». Las conexiones de MariaDB (SHOW
### PROCESSLIST), wait_timeout, max_connections, KILL, el registro de
### consultas lentas, EXPLAIN, CREATE INDEX. Los comandos, las opciones, las
### rutas, el SQL y las salidas no se traducen.

chapter-sleeping-connections = Conexiones dormidas
    .summary = Un sábado de primavera, el sitio de reservas de los huertos responde «Too many connections» justo cuando todo el mundo quiere un turno de riego. Averigua quién retiene las conexiones de la base de datos, por qué no se van nunca, y por qué cada página tarda cuarenta segundos.

## Archivos

sleeping-connections-message-halima =
    De: Halima (presidenta, Asociación de Huertos de Greenholme)
    Sábado 10 de mayo, 9:20

    ¡Hola, y bienvenida o bienvenido a bordo!

    Es el primer sábado soleado de la temporada y todo el mundo intenta
    reservar un turno de riego o la motoazada en www.greenholme.example.
    La mitad recibe una página que dice «Too many connections», la otra
    mitad espera eternamente. Lwazi, que escribió Plotline (nuestra
    aplicación de reservas), está en un tren hasta esta noche; dice que
    es «la base de datos» y te ha dejado una nota.

    La base de datos vive en paleta, donde estás ahora. sudo funciona con
    tu contraseña. ¿Podrías echarle un vistazo? Por favor, no hagas solo
    que el problema desaparezca durante una hora: el sábado que viene
    será igual.

    Halima

sleeping-connections-note-lwazi =
    Notas de Lwazi (paleta, 2027, actualizadas la primavera pasada)

    - paleta ejecuta MariaDB (el paquete de Debian, el servicio mariadb).
      La base de datos es plots: members, plots, waitlist, bookings.
    - Plotline funciona en shed (198.51.100.133) y se conecta a paleta por
      la red interna, como plotline. bookings contiene todas las reservas
      desde 2019: solo el turno de riego reserva cada parcela cada tarde.
    - Como root en paleta, sudo mariadb abre la base de datos (Debian deja
      entrar al root del sistema por el socket, sin contraseña).
    - La configuración: /etc/mysql/mariadb.conf.d/50-server.cnf. Los
      registros van al diario: journalctl -u mariadb.
    - Sé que la aplicación no cierra bien sus conexiones. Está en mi
      lista. MariaDB acaba limpiándolas, ¿no?

    Lwazi

## Eventos

sleeping-connections-event-crowd =
    Mira la columna Command: casi todas las conexiones están en Sleep.
    Todas vienen de shed (198.51.100.133) como plotline, y su Time no deja
    de crecer: miles de segundos dormidas. Cada una ocupa una de las 151
    plazas (max_connections); cuando están todas ocupadas, el siguiente
    visitante recibe «Too many connections» (tú solo has entrado porque
    root guarda una plaza extra). ¿Cuánto tiempo deja MariaDB dormir una
    conexión antes de cerrarla? (SHOW VARIABLES LIKE '%timeout%'; man
    mariadb.)
sleeping-connections-event-too-big =
    max_connections a ese tamaño solo mueve el muro: la aplicación
    llenaría diez mil plazas igual que llena 151, y cada conexión cuesta
    memoria (búferes, un hilo) hasta que el servidor se queda sin ella. El
    límite es una salvaguarda; lo que falla es que nada cierra nunca las
    conexiones dormidas. Devuélvelo a un valor sensato (151 es el valor
    por defecto).
sleeping-connections-event-restart-only =
    El reinicio ha cerrado todas las conexiones, y el sitio vuelve a
    respirar. Pero la aplicación abre tres nuevas cada medio minuto y
    nunca las cierra, y wait_timeout sigue dejando dormir cada una ocho
    horas: en menos de una hora las 151 plazas vuelven a estar llenas.
    ¿Qué decide cuánto tiempo puede quedarse una conexión dormida, también
    en el próximo arranque?
sleeping-connections-event-timeout =
    wait_timeout es ahora más corto para el servidor: las conexiones que
    se abran a partir de ahora se cerrarán tras ese tiempo de sueño
    («Aborted connection … Got timeout reading communication packets» en
    el diario). ¿Afecta a las que ya están ahí?
sleeping-connections-event-old-sessions =
    Siguen ahí { $count } conexiones dormidas, y su Time sigue creciendo
    más allá de tu nuevo límite. SET GLOBAL solo cambia el valor por
    defecto que copian las sesiones nuevas al conectarse: cada sesión
    existente conserva el wait_timeout que recibió, ocho horas. Hay que
    cerrarlas (KILL id;, o mariadb-admin kill id,id,…; SELECT id FROM
    information_schema.PROCESSLIST WHERE … las lista).
sleeping-connections-event-cleared =
    Las antiguas conexiones dormidas han desaparecido y las nuevas solo se
    quedan unos minutos: las plazas están libres, el sitio vuelve a
    responder.
sleeping-connections-event-persisted =
    El wait_timeout más corto está ahora en 50-server.cnf: el servidor lo
    leerá en cada arranque, no solo hasta el próximo reinicio.
sleeping-connections-event-slow-log =
    El registro de consultas lentas está activo: cada consulta que dura
    más de long_query_time se escribe ahí con su tiempo y las filas que
    examinó. Léelo (el archivo es slow_query_log_file; SHOW VARIABLES LIKE
    'slow_query%'): ¿qué consulta es lenta, y cuántas filas lee para
    responder?
sleeping-connections-event-explain =
    type ALL, key NULL, rows 1834212: para encontrar las reservas de una
    parcela, MariaDB lee la tabla entera, cada vez que un visitante abre
    la página de una parcela, y cada una de esas conexiones se queda
    ocupada cuarenta segundos. Un índice sobre la columna de la cláusula
    WHERE le permite ir directo a las filas correctas (man mariadb: CREATE
    INDEX).
sleeping-connections-event-wrong-index =
    Ese índice empieza por otra columna: para WHERE plot_id = …, MariaDB no
    puede usarlo (EXPLAIN sigue diciendo type ALL). Un índice ayuda a las
    consultas cuyo WHERE (u ORDER BY) empieza por su primera columna.
sleeping-connections-event-index =
    Con el índice, EXPLAIN dice type ref, unos cientos de filas: la página
    de una parcela responde en unos milisegundos en lugar de cuarenta
    segundos.
sleeping-connections-event-end =
    Halima: «¡Funciona! Alguien ya ha reservado la motoazada para las 14:00.
    Lwazi dice que esta noche arreglará las conexiones de la aplicación, y
    te da las gracias por el índice».

    ¡Bien hecho! Has terminado el capítulo «Conexiones dormidas».

    QUÉ HA PASADO
    Plotline abría conexiones a MariaDB y nunca las cerraba. Con
    wait_timeout en su valor por defecto, 28800 segundos, el servidor
    mantenía cada una dormida ocho horas, hasta que las 151 plazas de
    max_connections estuvieron todas ocupadas y los visitantes recibieron
    «Too many connections». Al mismo tiempo, cada página de parcela leía
    los 1,8 millones de filas de bookings, porque ningún índice cubría
    plot_id. Acortaste wait_timeout para el servidor en marcha y en su
    configuración, cerraste las sesiones que conservaban su antiguo
    tiempo de espera, encontraste la consulta lenta y le diste su índice.

    BUENA PRÁCTICA
    - SHOW PROCESSLIST primero: quién está conectado, desde dónde, haciendo
      qué (Sleep, o una consulta y durante cuánto tiempo).
    - SET GLOBAL cambia el servidor en marcha y solo lo copian las
      sesiones nuevas; el archivo de configuración es lo que lee el
      próximo arranque. Haz las dos cosas.
    - max_connections es una salvaguarda: subirlo esconde una fuga hasta
      que se acaba la memoria. El arreglo de verdad está en la aplicación
      (cerrar las conexiones, o un pool de conexiones), y wait_timeout
      limpia detrás.
    - El registro de consultas lentas y EXPLAIN te dicen qué consulta hace
      daño y por qué; un índice sobre la columna de la cláusula WHERE suele
      ser toda la respuesta.
    - Root guarda una conexión extra (extra_max_connections): nunca dejes
      que una aplicación se conecte con una cuenta que tenga ese
      privilegio.

    DOCUMENTACIÓN
    - Variables de sistema del servidor (wait_timeout, max_connections): https://mariadb.com/kb/en/server-system-variables/
    - SHOW PROCESSLIST: https://mariadb.com/kb/en/show-processlist/
    - KILL: https://mariadb.com/kb/en/kill/
    - El registro de consultas lentas: https://mariadb.com/kb/en/slow-query-log-overview/
    - EXPLAIN: https://mariadb.com/kb/en/explain/
    - CREATE INDEX: https://mariadb.com/kb/en/create-index/

## Lo que comparten los tres capítulos de la historia: guardado aquí para que se cargue con la historia.

allotments-plotline-readme =
    Plotline, la aplicación de reservas de los Huertos de Greenholme (Lwazi).
    gunicorn en 0.0.0.0:8000, detrás del nginx del sitio.
    Su configuración está en /srv/plotline/.env, que se lee cuando arranca
    el servicio plotline: sudo systemctl restart plotline tras un cambio.
    Su registro: /var/log/plotline/app.log.
