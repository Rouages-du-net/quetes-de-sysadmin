### Lo que comparten los capítulos de «Las Bicis Compartidas»: un comentario
### de prometheus.yml, los resúmenes de las reglas, los README de sillin y
### buje, y los mensajes de las herramientas simuladas que el juego no
### modela. Los comandos, nombres de métricas, etiquetas, rutas y salidas no
### se traducen.

bike-share-prometheus-comment = Configuración de Prometheus para las bicis compartidas (Aroha, marzo de 2029)
bike-share-rule-disk-summary = Menos del 10 % libre en {"{{"} $labels.mountpoint {"}}"} de {"{{"} $labels.instance {"}}"}
bike-share-rule-errors-summary = La aplicación de alquiler responde con errores al {"{{"} $value | humanizePercentage {"}}"} de sus peticiones
bike-share-rule-node-summary = {"{{"} $labels.instance {"}}"} ya no responde a Prometheus
bike-share-saddle-readme =
    sillin — la aplicación de alquiler (Node.js, puerto 3000, detrás de nginx en el 80)

    Sus métricas: curl localhost:3000/metrics. Las de la máquina: el node
    exporter, en el 9100. El cortafuegos es ufw (sudo ufw status).

    Tomás
bike-share-hub-readme =
    buje — la pasarela de las estaciones (docks-gateway, puerto 8443)

    Las fotos de las estaciones están en /srv/docks/photos (una carpeta
    por mes). Las métricas de la máquina: el node exporter, en el 9100.

    Aroha
promtool-query-not-simulated = promtool query { $command }: no simulado en este juego (promtool query instant sí).
promtool-test-not-simulated = promtool test rules: no simulado en este juego; la propia historia prueba sus reglas en días inventados.
jq-usage =
    Usage:  jq [OPTIONS] FILTER [FILES...]
            jq [OPTIONS] --args FILTER [ARGUMENTS...]

    jq is a tool for processing JSON inputs, applying the given filter to
    its JSON text inputs and producing the filter's results as JSON on
    standard output.

    Example:

        $ echo '{"{"}"foo": 0{"}"}' | jq .
        {"{"}
          "foo": 0
        {"}"}

    For listing the command options, use jq --help.
