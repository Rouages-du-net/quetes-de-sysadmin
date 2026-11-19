### Story "The Bike Share", chapter "The Blind Spot": Prometheus is
### installed, but two of its targets fail in silence and a machine is
### missing. The HTTP API with curl and jq, promtool, an exporter's
### /metrics, ufw, scrape_configs and the reload. Commands, options,
### metric names, addresses, paths and outputs are not translated.

chapter-blind-spot = The Blind Spot
    .summary = Last Saturday the docking stations' gateway stopped and nobody knew until the phones rang, yet a Prometheus was supposed to watch everything. Ask it what it really sees, and make it see the whole cooperative.

## Files

blind-spot-message-ngozi =
    From: Ngozi (bike share cooperative)
    Monday 7 May, 14:00

    Hello, and welcome aboard!

    Last Saturday the docking stations stopped renting bikes for three
    hours: hub, the machine that talks to the stations, had stopped, and
    nobody knew until the phones rang. Yet Aroha installed Prometheus on
    gauge before she moved away, precisely so that it would watch
    everything.

    Can you look at what Prometheus actually sees? There is no browser on
    gauge, but Prometheus answers on its HTTP API, port 9090: curl talks to
    it (jq makes its JSON readable), and promtool knows how to ask it too.

    It should watch itself, our three machines (gauge, saddle and hub: a
    node exporter on port 9100 on each), and the rental app on saddle (see
    Tomás's note).

    Ngozi

blind-spot-note-tomas =
    Note from Tomás

    The rental app runs on saddle since March, on port 3000. It exposes
    its metrics at /metrics (prom-client, the usual text format). Aroha
    first tried it here, on gauge, before the move.

    Tomás

## Events

blind-spot-event-targets =
    Targets are down ("health": "down", or up at 0), each with its
    lastError. Prometheus pulls: every 15 seconds it scrapes each target
    (an HTTP GET on /metrics) and records up, 1 if the scrape worked, 0
    otherwise. And look for hub in the list.
blind-spot-event-deadline =
    "context deadline exceeded": Prometheus waited for saddle's exporter
    until the scrape timeout and got nothing back, not even a refusal. A
    firewall that drops packets does that. On saddle (ssh saddle): does the
    exporter answer locally (curl localhost:9100/metrics)? What does its
    firewall let through (sudo ufw status)?
blind-spot-event-refused =
    "connection refused" on 127.0.0.1:3000: the rental job still scrapes
    gauge itself, where nothing listens on port 3000. Tomás's note says
    where the app lives now.
blind-spot-event-exporter =
    The node exporter answers: text, one sample per line, with # HELP and
    # TYPE before each metric family (a counter only grows, a gauge goes up
    and down). That is what Prometheus reads at each scrape.
blind-spot-event-app-metrics =
    The app's metrics: http_requests_total is a counter, with the labels
    method, route and status; http_request_duration_seconds a histogram
    (_bucket, _sum, _count); rental_bikes_available a gauge for each
    station.
blind-spot-event-too-open =
    Port 9100 is now open to the whole internet: a node exporter tells
    anyone about your machine (its kernel, its disks, its load). Only gauge
    needs it: allow it from 192.0.2.54 only, and delete the broad rule
    (sudo ufw status numbered, then sudo ufw delete with its number).
blind-spot-event-saddle-open =
    saddle now lets gauge reach its exporter on port 9100, and nobody else.
    At the next scrape, the target should come up.
blind-spot-event-config-invalid =
    promtool refuses the file, and says which line and why. Prometheus
    itself would refuse it the same way when rereading it, and keep its old
    configuration.
blind-spot-event-config-check =
    promtool check config agrees: the syntax is valid, and the rule files
    it names were checked too. Prometheus still runs the configuration it
    read before, until it rereads the file.
blind-spot-event-lifecycle =
    "Lifecycle API is not enabled": POST /-/reload only works if Prometheus
    was started with --web.enable-lifecycle (ARGS in
    /etc/default/prometheus). Without it, the reload goes through a signal:
    sudo systemctl reload prometheus, which sends SIGHUP.
blind-spot-event-bad-reload =
    The reload failed: Prometheus keeps the configuration it had, and says
    why in its journal (sudo journalctl -u prometheus -n 20). systemctl
    didn't notice: a reload only sends a signal. Check the file with
    promtool first.
blind-spot-event-not-reloaded =
    The file is right, but Prometheus still runs the configuration it read
    before: have it reread the file (sudo systemctl reload prometheus).
blind-spot-event-saddle-up = saddle's node exporter is up.
blind-spot-event-rental-up = The rental app is up: its counters reach Prometheus every 15 seconds.
blind-spot-event-hub-up =
    hub is watched: if its exporter stops answering, its up goes to 0
    within 15 seconds. That is the signal Saturday lacked.
blind-spot-event-end =
    Ngozi: "All green! Next time hub stops, Prometheus will see it at once.
    Now, someone has to be told... next week?"

    Well done! You finished The Blind Spot.

    WHAT HAPPENED
    Prometheus pulls: every scrape_interval it scrapes each target of its
    scrape_configs and records up, 1 or 0. Two targets had been failing in
    silence since March: saddle's firewall dropped port 9100 (context
    deadline exceeded), and the rental job still pointed at localhost:3000,
    the app's old place (connection refused). hub had never been added. You
    read the targets through the API, opened 9100 on saddle for gauge only,
    fixed the targets, checked the file with promtool and had Prometheus
    reread it: { $targets } targets, all up.

    GOOD PRACTICE
    - Watch the watcher: the targets' health (up) is the first thing to
      check, and the first alert to write.
    - No web interface needed: the HTTP API answers curl (jq to read it),
      and promtool query instant runs a query.
    - promtool check config before every reload: a failed reload keeps the
      old configuration and only says so in the journal.
    - A reload rather than a restart (systemctl reload prometheus: SIGHUP):
      Prometheus keeps its alerts' state.
    - An exporter tells a lot about a machine: open its port to the
      Prometheus server only.
    - Prometheus adds job and instance to every series; labels under
      static_configs say more about a target.

    DOCUMENTATION
    - scrape_config: https://prometheus.io/docs/prometheus/latest/configuration/configuration/#scrape_config
    - The HTTP API: https://prometheus.io/docs/prometheus/latest/querying/api/
    - promtool: https://prometheus.io/docs/prometheus/latest/command-line/promtool/
    - The node exporter: https://prometheus.io/docs/guides/node-exporter/
