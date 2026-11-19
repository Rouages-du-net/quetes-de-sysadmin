### What the chapters of "The Bike Share" share: a comment of
### prometheus.yml, the rules' summaries, the READMEs of saddle and hub,
### and the messages of the simulated tools that the game doesn't model.
### Commands, metric names, labels, paths and outputs are not translated.

bike-share-prometheus-comment = Prometheus configuration for the bike share (Aroha, March 2029)
bike-share-rule-disk-summary = Less than 10 % free on {"{{"} $labels.mountpoint {"}}"} of {"{{"} $labels.instance {"}}"}
bike-share-rule-errors-summary = The rental app answers errors to {"{{"} $value | humanizePercentage {"}}"} of its requests
bike-share-rule-node-summary = {"{{"} $labels.instance {"}}"} does not answer Prometheus
bike-share-saddle-readme =
    saddle — the rental app (Node.js, port 3000, behind nginx on 80)

    Its metrics: curl localhost:3000/metrics. The machine's: the node
    exporter, on 9100. The firewall is ufw (sudo ufw status).

    Tomás
bike-share-hub-readme =
    hub — the docking stations' gateway (docks-gateway, port 8443)

    The stations' photos are in /srv/docks/photos (one directory a month).
    The machine's metrics: the node exporter, on 9100.

    Aroha
promtool-query-not-simulated = promtool query { $command }: not simulated in this game (promtool query instant is).
promtool-test-not-simulated = promtool test rules: not simulated in this game; its rules are tried on made-up days by the story itself.
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
