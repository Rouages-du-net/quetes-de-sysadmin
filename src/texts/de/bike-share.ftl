### Was die Kapitel von „Der Fahrradverleih“ gemeinsam nutzen: ein
### Kommentar von prometheus.yml, die summaries der Regeln, die READMEs von
### sattel und nabe und die Meldungen der simulierten Werkzeuge, die das
### Spiel nicht modelliert. Befehle, Metriknamen, Labels, Pfade und
### Ausgaben werden nicht übersetzt.

bike-share-prometheus-comment = Prometheus-Konfiguration für den Fahrradverleih (Aroha, März 2029)
bike-share-rule-disk-summary = Weniger als 10 % frei auf {"{{"} $labels.mountpoint {"}}"} von {"{{"} $labels.instance {"}}"}
bike-share-rule-errors-summary = Die Verleih-App beantwortet {"{{"} $value | humanizePercentage {"}}"} ihrer Anfragen mit Fehlern
bike-share-rule-node-summary = {"{{"} $labels.instance {"}}"} antwortet Prometheus nicht
bike-share-saddle-readme =
    sattel — die Verleih-App (Node.js, Port 3000, hinter nginx auf 80)

    Ihre Metriken: curl localhost:3000/metrics. Die der Maschine: der Node
    Exporter, auf 9100. Die Firewall ist ufw (sudo ufw status).

    Tomás
bike-share-hub-readme =
    nabe — das Gateway der Ausleihstationen (docks-gateway, Port 8443)

    Die Fotos der Stationen liegen in /srv/docks/photos (ein Verzeichnis pro
    Monat). Die Metriken der Maschine: der Node Exporter, auf 9100.

    Aroha
promtool-query-not-simulated = promtool query { $command }: in diesem Spiel nicht simuliert (promtool query instant schon).
promtool-test-not-simulated = promtool test rules: in diesem Spiel nicht simuliert; ihre Regeln probiert die Geschichte selbst an erfundenen Tagen aus.
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
