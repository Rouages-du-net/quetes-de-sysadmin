### Historia «Las Bicis Compartidas», capítulo «El umbral»: dos reglas de
### alerta, un disco lleno y una tasa de errores. PromQL (un gauge comparado,
### rate() sobre contadores, sum antes de dividir), archivos de reglas, for:,
### labels y annotations, promtool check rules, los estados de las alertas.
### Los comandos, opciones, nombres de métricas, PromQL, rutas y salidas no
### se traducen.

chapter-threshold = El umbral
    .summary = Prometheus ve ahora todas las máquinas, pero nadie lo mira. Escribe las dos alertas que necesita la cooperativa, un disco que se llena y una aplicación que responde errores, para que salten cuando algo va mal de verdad, y se callen el resto del tiempo.

## Files

threshold-message-ngozi =
    De: Ngozi (cooperativa de bicis compartidas)
    Martes 15 de mayo, 9:00

    Buenos días:

    Prometheus ya lo ve todo, pero nadie lo mira en todo el día. Dos
    alertas, por favor, en /etc/prometheus/rules/ (prometheus.yml ya lee
    rules/*.yml):

    1. Un disco con menos del 10 % de espacio libre, en cualquiera de
       nuestras máquinas. Severidad: warning.
    2. La aplicación de alquiler respondiendo errores (5xx) a más del 5 %
       de sus peticiones. Severidad: page: esa despierta a quien esté de
       guardia.

    Cada una con un resumen: una frase que diga qué va mal, y dónde.

    Cuidado: Tomás dice que la aplicación tiene pequeñas ráfagas de errores
    unas cuantas veces por hora (una estación que se reconecta). Son
    normales, y no deben despertar a nadie.

    Para probar tus alertas, ahora mismo hay dos cosas que van mal. El
    disco de buje está casi lleno desde la copia de la semana pasada
    (/var/backups/docks-2029-04.tar.gz, ya copiada en otro sitio: bórrala
    cuando tu alerta haya saltado). Y mira la nota de Tomás.

    Ngozi

threshold-note-tomas =
    Nota de Tomás

    Desde la versión de esta mañana (2.4.0), aproximadamente una devolución
    de cada dos falla con un error 500 (un fallo con los códigos de batería
    de los anclajes). La corrección, 2.4.1, ya está en sillin
    (/srv/rental/VERSION); se aplica cuando el servicio se reinicia (en
    sillin: sudo systemctl restart rental).

    Reinícialo solo cuando tu alerta haya saltado: queremos saber que
    funciona.

    Tomás

threshold-release-notes =
    rental 2.4.1

    - Corrige los errores 500 en POST /returns cuando un anclaje envía un
      código de batería (2.4.0).

## Events

threshold-event-disk-query =
    Cada sistema de archivos, con su proporción de espacio libre. ¿Cuál
    anda escaso? (Un tmpfs como /run vive en memoria: déjalo fuera, con
    fstype!="tmpfs" o mountpoint="/".)
threshold-event-error-query =
    rate() convierte un contador en una tasa por segundo, promediada sobre
    su ventana ([5m]). Para comparar los errores con todas las peticiones,
    divide una tasa por la otra. Pero ¿qué series entre cuáles? Mira las
    etiquetas a cada lado.
threshold-event-rate-gauge =
    rate() está hecho para contadores, que solo crecen (sus nombres
    terminan en _total). Sobre un gauge como node_filesystem_avail_bytes,
    toma cada bajada por un reinicio del contador: un sinsentido, y
    Prometheus avisa de ello («metric might not be a counter»). Compara
    directamente el valor de un gauge; para ver hacia dónde va, deriv() o
    predict_linear().
threshold-event-raw-counter =
    Una regla sobre el valor bruto de un contador: http_requests_total solo
    crece, desde el arranque de la aplicación. Una vez superado el umbral,
    nunca vuelve a bajar: la alerta saltaría para siempre, hasta que el
    próximo reinicio la ponga a cero. Alerta sobre su rate().
threshold-event-unsummed =
    Esta regla divide cada serie por sí misma: la serie de los 500 de
    /returns por esa misma serie, es decir 1, un cien por cien de errores,
    todo el tiempo. Suma primero, y luego divide: sum by (job) de la tasa
    de 5xx, dividido por sum by (job) de la tasa de todas las peticiones.
threshold-event-not-errors =
    status!="200" cuenta también los 201 (un alquiler creado) y los 404
    (una estación desconocida): no son errores de la aplicación. Los
    errores del servidor son los 5xx: status=~"5..".
threshold-event-no-for =
    Sin for:, una alerta salta en cuanto su expresión es verdadera, en una
    sola evaluación: cada ráfaga de errores (dos minutos, unas cuantas
    veces por hora) avisaría a alguien, se resolvería, y volvería a avisar.
    for: 10m pide que la condición dure antes de saltar; mientras tanto la
    alerta está «pending».
threshold-event-disk-rule =
    La regla del disco está cargada. Probada en días inventados, avisa para
    cualquier máquina con un 7 % libre, y se calla al 12 %. Mira
    /api/v1/alerts: la alerta de buje debería estar pending, y luego firing
    una vez pasado su for: (sleep hace pasar el tiempo).
threshold-event-error-rule =
    La regla de errores está cargada, y aguanta en días inventados: salta
    durante un incidente que dura, y se calla durante las ráfagas de un día
    normal.
threshold-event-labels =
    Una regla sin la etiqueta severity o sin la anotación summary: el
    Alertmanager encamina las alertas según sus etiquetas (severity), y
    quien recibe una lee primero su summary. Añade las dos.
threshold-event-pending =
    «pending»: la expresión es verdadera, y la alerta espera a que pase su
    for: antes de saltar. Si la condición se detiene mientras tanto, vuelve
    a inactive, y nadie se entera.
threshold-event-disk-firing =
    La alerta de disco de buje está saltando. Como dijo Ngozi, la copia
    antigua ya puede irse (en buje: /var/backups/docks-2029-04.tar.gz).
threshold-event-photos =
    Ngozi: «¡Las fotos de las estaciones! Demuestran el estado de cada bici
    cuando se devolvió... Las he vuelto a poner desde la copia externa.» El
    archivo que había que borrar era la copia antigua, en /var/backups.
threshold-event-disk-resolved =
    Espacio liberado: en la próxima evaluación la expresión es falsa, y la
    alerta se resuelve (Prometheus sigue avisando al Alertmanager un rato,
    para que el «resolved» llegue a todo el mundo).
threshold-event-restart-early =
    Tomás: «¡Los errores han parado, gracias! Pero nunca vimos saltar la
    alerta. ¿Está lista la regla para la próxima vez?» Todavía tiene que
    aguantar en días inventados: /api/v1/rules muestra lo que está cargado.
threshold-event-error-firing =
    La alerta de errores está saltando: los errores han durado más que su
    for:. Ahora la corrección: reinicia rental en sillin.
threshold-event-error-resolved =
    La aplicación funciona con la 2.4.1; su tasa de errores vuelve a la
    normalidad, y la alerta se resuelve en cuanto los minutos malos salen
    de su ventana.
threshold-event-end =
    Ngozi: «Las dos alertas funcionan, y saben cuándo callarse. La semana
    que viene: asegurarnos de que llegan a alguien, a la hora adecuada.»

    ¡Bien hecho! Has terminado El umbral.

    QUÉ HA PASADO
    Convertiste dos preguntas en PromQL. El disco:
    node_filesystem_avail_bytes / node_filesystem_size_bytes < 0.10, un
    gauge comparado directamente. Los errores: la tasa de los 5xx entre la
    tasa de todas las peticiones, cada una sumada antes, > 0.05. En un
    archivo de reglas, con un for: (cuánto debe durar la condición), una
    etiqueta severity y un summary; luego promtool check rules, una
    recarga, y viste las alertas pasar a pending, a firing, y resolverse
    tras cada corrección.

    BUENA PRÁCTICA
    - Alerta sobre lo que notan los usuarios (errores, un disco lleno), con
      un umbral y una duración.
    - rate() para los contadores (…_total), nunca su valor bruto; nunca
      rate() sobre un gauge.
    - Suma antes de dividir (sum by (job)): un cociente de dos sumas.
    - for: absorbe las ráfagas cortas: demasiado corto avisa para nada,
      demasiado largo llega tarde.
    - Prueba una alerta: mírala saltar una vez (aquí, fallos reales; en
      otros sitios, promtool test rules con series inventadas).
    - Las etiquetas encaminan la alerta (severity), las anotaciones la
      explican (summary, description, runbook_url).

    DOCUMENTACIÓN
    - Reglas de alerta: https://prometheus.io/docs/prometheus/latest/configuration/alerting_rules/
    - rate(): https://prometheus.io/docs/prometheus/latest/querying/functions/#rate
    - Operadores y emparejamiento de vectores: https://prometheus.io/docs/prometheus/latest/querying/operators/
    - Alertas, buenas prácticas: https://prometheus.io/docs/practices/alerting/
