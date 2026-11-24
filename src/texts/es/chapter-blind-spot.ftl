### Historia «Las Bicis Compartidas», capítulo «El punto ciego»: Prometheus
### está instalado, pero dos de sus objetivos fallan en silencio y falta una
### máquina. La API HTTP con curl y jq, promtool, el /metrics de un exporter,
### ufw, scrape_configs y la recarga. Los comandos, opciones, nombres de
### métricas, direcciones, rutas y salidas no se traducen.

chapter-blind-spot = El punto ciego
    .summary = El sábado pasado la pasarela de las estaciones se paró y nadie lo supo hasta que sonaron los teléfonos, y sin embargo había un Prometheus que debía vigilarlo todo. Pregúntale qué ve de verdad, y haz que vea toda la cooperativa.

## Files

blind-spot-message-ngozi =
    De: Ngozi (cooperativa de bicis compartidas)
    Lunes 7 de mayo, 14:00

    ¡Hola, y te damos la bienvenida a bordo!

    El sábado pasado las estaciones dejaron de alquilar bicis durante tres
    horas: buje, la máquina que habla con las estaciones, se había parado,
    y nadie lo supo hasta que sonaron los teléfonos. Y eso que Aroha
    instaló Prometheus en medidor antes de mudarse, precisamente para que
    lo vigilara todo.

    ¿Puedes mirar qué ve realmente Prometheus? En medidor no hay
    navegador, pero Prometheus responde en su API HTTP, puerto 9090: curl
    habla con ella (jq hace legible su JSON), y promtool también sabe
    preguntarle.

    Debería vigilarse a sí mismo, nuestras tres máquinas (medidor, sillin y
    buje: un node exporter en el puerto 9100 en cada una), y la aplicación
    de alquiler en sillin (ver la nota de Tomás).

    Ngozi

blind-spot-note-tomas =
    Nota de Tomás

    La aplicación de alquiler funciona en sillin desde marzo, en el puerto
    3000. Expone sus métricas en /metrics (prom-client, el formato de texto
    habitual). Aroha la probó primero aquí, en medidor, antes de la
    mudanza.

    Tomás

## Events

blind-spot-event-targets =
    Hay objetivos caídos («health»: «down», o up a 0), cada uno con su
    lastError. Prometheus va a buscar: cada 15 segundos recoge cada
    objetivo (un GET HTTP a /metrics) y registra up, 1 si la recogida
    funcionó, 0 si no. Y busca buje en la lista.
blind-spot-event-deadline =
    «context deadline exceeded»: Prometheus esperó al exporter de sillin
    hasta el tiempo límite de recogida y no recibió nada, ni siquiera un
    rechazo. Eso lo hace un cortafuegos que descarta paquetes. En sillin
    (ssh sillin): ¿responde el exporter en local (curl
    localhost:9100/metrics)? ¿Qué deja pasar su cortafuegos (sudo ufw
    status)?
blind-spot-event-refused =
    «connection refused» en 127.0.0.1:3000: el job rental sigue recogiendo
    del propio medidor, donde nada escucha en el puerto 3000. La nota de
    Tomás dice dónde vive ahora la aplicación.
blind-spot-event-exporter =
    El node exporter responde: texto, una muestra por línea, con # HELP y
    # TYPE antes de cada familia de métricas (un counter solo crece, un
    gauge sube y baja). Eso es lo que lee Prometheus en cada recogida.
blind-spot-event-app-metrics =
    Las métricas de la aplicación: http_requests_total es un counter, con
    las etiquetas method, route y status; http_request_duration_seconds un
    histograma (_bucket, _sum, _count); rental_bikes_available un gauge
    para cada estación.
blind-spot-event-too-open =
    El puerto 9100 está ahora abierto a todo internet: un node exporter le
    cuenta a cualquiera cosas de tu máquina (su núcleo, sus discos, su
    carga). Solo lo necesita medidor: permítelo solo desde 192.0.2.54, y
    borra la regla amplia (sudo ufw status numbered, luego sudo ufw delete
    con su número).
blind-spot-event-saddle-open =
    sillin deja ahora que medidor llegue a su exporter en el puerto 9100, y
    nadie más. En la próxima recogida, el objetivo debería subir.
blind-spot-event-config-invalid =
    promtool rechaza el archivo, y dice qué línea y por qué. El propio
    Prometheus lo rechazaría igual al volver a leerlo, y conservaría su
    configuración anterior.
blind-spot-event-config-check =
    promtool check config está de acuerdo: la sintaxis es válida, y los
    archivos de reglas que nombra también se han comprobado. Prometheus
    sigue con la configuración que leyó antes, hasta que vuelva a leer el
    archivo.
blind-spot-event-lifecycle =
    «Lifecycle API is not enabled»: POST /-/reload solo funciona si
    Prometheus se arrancó con --web.enable-lifecycle (ARGS en
    /etc/default/prometheus). Sin eso, la recarga pasa por una señal: sudo
    systemctl reload prometheus, que envía SIGHUP.
blind-spot-event-bad-reload =
    La recarga ha fallado: Prometheus conserva la configuración que tenía,
    y dice por qué en su registro (sudo journalctl -u prometheus -n 20).
    systemctl no se ha dado cuenta: una recarga solo envía una señal.
    Comprueba primero el archivo con promtool.
blind-spot-event-not-reloaded =
    El archivo es correcto, pero Prometheus sigue con la configuración que
    leyó antes: haz que vuelva a leer el archivo (sudo systemctl reload
    prometheus).
blind-spot-event-saddle-up = El node exporter de sillin está arriba.
blind-spot-event-rental-up = La aplicación de alquiler está arriba: sus contadores llegan a Prometheus cada 15 segundos.
blind-spot-event-hub-up =
    buje está vigilado: si su exporter deja de responder, su up pasa a 0
    en menos de 15 segundos. Es la señal que le faltó al sábado.
blind-spot-event-end =
    Ngozi: «¡Todo en verde! La próxima vez que buje se pare, Prometheus lo
    verá enseguida. Ahora, habrá que avisar a alguien... ¿la semana que
    viene?»

    ¡Bien hecho! Has terminado El punto ciego.

    QUÉ HA PASADO
    Prometheus va a buscar: cada scrape_interval recoge cada objetivo de
    sus scrape_configs y registra up, 1 o 0. Dos objetivos fallaban en
    silencio desde marzo: el cortafuegos de sillin descartaba el puerto
    9100 (context deadline exceeded), y el job rental seguía apuntando a
    localhost:3000, el antiguo sitio de la aplicación (connection
    refused). buje nunca se había añadido. Leíste los objetivos a través
    de la API, abriste el 9100 en sillin solo para medidor, corregiste los
    objetivos, comprobaste el archivo con promtool e hiciste que Prometheus
    lo volviera a leer: { $targets } objetivos, todos arriba.

    BUENA PRÁCTICA
    - Vigila al vigilante: la salud de los objetivos (up) es lo primero que
      hay que comprobar, y la primera alerta que hay que escribir.
    - No hace falta interfaz web: la API HTTP responde a curl (jq para
      leerla), y promtool query instant ejecuta una consulta.
    - promtool check config antes de cada recarga: una recarga fallida
      conserva la configuración anterior y solo lo dice en el registro.
    - Una recarga en lugar de un reinicio (systemctl reload prometheus:
      SIGHUP): Prometheus conserva el estado de sus alertas.
    - Un exporter cuenta mucho de una máquina: abre su puerto solo al
      servidor Prometheus.
    - Prometheus añade job e instance a cada serie; las etiquetas bajo
      static_configs dicen más sobre un objetivo.

    DOCUMENTACIÓN
    - scrape_config: https://prometheus.io/docs/prometheus/latest/configuration/configuration/#scrape_config
    - La API HTTP: https://prometheus.io/docs/prometheus/latest/querying/api/
    - promtool: https://prometheus.io/docs/prometheus/latest/command-line/promtool/
    - El node exporter: https://prometheus.io/docs/guides/node-exporter/
