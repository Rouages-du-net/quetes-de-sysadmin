### Ce que partagent les chapitres des « Vélos partagés » : un commentaire
### de prometheus.yml, les résumés des règles, les README de selle et de
### moyeu, et les messages des outils simulés que le jeu ne modélise pas.
### Les commandes, noms de métriques, étiquettes, chemins et sorties ne sont
### pas traduits.

bike-share-prometheus-comment = Configuration de Prometheus pour les vélos partagés (Aroha, mars 2029)
bike-share-rule-disk-summary = Moins de 10 % libres sur {"{{"} $labels.mountpoint {"}}"} de {"{{"} $labels.instance {"}}"}
bike-share-rule-errors-summary = L'appli de location répond des erreurs à {"{{"} $value | humanizePercentage {"}}"} de ses requêtes
bike-share-rule-node-summary = {"{{"} $labels.instance {"}}"} ne répond plus à Prometheus
bike-share-saddle-readme =
    selle — l'appli de location (Node.js, port 3000, derrière nginx sur le 80)

    Ses métriques : curl localhost:3000/metrics. Celles de la machine : le
    node exporter, sur le 9100. Le pare-feu, c'est ufw (sudo ufw status).

    Tomás
bike-share-hub-readme =
    moyeu — la passerelle des stations (docks-gateway, port 8443)

    Les photos des stations sont dans /srv/docks/photos (un répertoire par
    mois). Les métriques de la machine : le node exporter, sur le 9100.

    Aroha
promtool-query-not-simulated = promtool query { $command } : pas simulé dans ce jeu (promtool query instant l'est).
promtool-test-not-simulated = promtool test rules : pas simulé dans ce jeu ; l'histoire essaie elle-même ses règles sur des journées inventées.
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
