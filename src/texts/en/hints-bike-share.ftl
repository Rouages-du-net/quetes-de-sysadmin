### Graded hints for The Bike Share (see src/engine/hints.ts): one message
### per step, hint-<chapter>-<event>, with .lead (a direction, without the
### exact command) and .solution (almost the answer).

## Chapter 1 — The Blind Spot

hint-blind-spot-targets =
    .lead = Ask Prometheus which targets it scrapes, and how each one is doing: its HTTP API answers on port 9090 (man prometheus, man curl, man jq).
    .solution = curl -s localhost:9090/api/v1/targets | jq '.data.activeTargets[] | {"{"}job: .labels.job, instance: .labels.instance, health, lastError{"}"}'
hint-blind-spot-deadline =
    .lead = Read the lastError of the node target that is down: a timeout points at the network, not at the exporter.
    .solution = curl -s localhost:9090/api/v1/targets | jq -r '.data.activeTargets[] | .lastError'
hint-blind-spot-refused =
    .lead = And the rental job: what address does it scrape? Compare with Tomás's note.
    .solution = grep -A3 rental /etc/prometheus/prometheus.yml, then cat note_from_tomas.txt
hint-blind-spot-saddle-open =
    .lead = On saddle, the exporter answers locally; its firewall decides who else may reach port 9100. Let gauge through, and only gauge (man ufw).
    .solution = ssh saddle, then sudo ufw allow from 192.0.2.54 to any port 9100 proto tcp
hint-blind-spot-config-check =
    .lead = Fix scrape_configs in /etc/prometheus/prometheus.yml: the app's target, and hub's node exporter. Then have promtool check the file (man promtool).
    .solution = sudo nano /etc/prometheus/prometheus.yml (rental: saddle.internal:3000; node: add hub.internal:9100), then promtool check config /etc/prometheus/prometheus.yml
hint-blind-spot-hub-up =
    .lead = Prometheus still runs the configuration it read at start: have it reread the file, without restarting it (man prometheus, man systemctl).
    .solution = sudo systemctl reload prometheus
hint-blind-spot-end =
    .lead = Every target up, saddle's port open to gauge only, and the file the same as what runs. Check the targets again after a scrape.
    .solution = curl -s localhost:9090/api/v1/targets | jq -r '.data.activeTargets[] | "\(.labels.instance) \(.health)"'

## Chapter 2 — The Threshold

hint-threshold-disk-query =
    .lead = Query the free space of each file system as a share of its size: two metrics of the node exporter, divided (man promtool, query instant).
    .solution = promtool query instant http://localhost:9090 'node_filesystem_avail_bytes / node_filesystem_size_bytes'
hint-threshold-error-query =
    .lead = http_requests_total is a counter: its rate over 5 minutes, for the 5xx, compared with the rate of all requests. Add up on each side before dividing.
    .solution = promtool query instant http://localhost:9090 'sum by (job) (rate(http_requests_total{"{"}status=~"5.."{"}"}[5m])) / sum by (job) (rate(http_requests_total[5m]))'
hint-threshold-disk-rule =
    .lead = A rule file in /etc/prometheus/rules/, a group, an alerting rule (alert, expr, for, labels, annotations); check it with promtool, then reload Prometheus.
    .solution = sudo nano /etc/prometheus/rules/bikes.yml: groups, - name: bikes, rules, - alert: DiskAlmostFull, expr: node_filesystem_avail_bytes{"{"}fstype!="tmpfs"{"}"} / node_filesystem_size_bytes < 0.10, for: 5m, labels severity: warning, annotations summary; promtool check rules /etc/prometheus/rules/bikes.yml; sudo systemctl reload prometheus
hint-threshold-error-rule =
    .lead = A second rule in the same group, for the error rate, with a for: long enough to let the normal bursts pass (a few minutes).
    .solution = - alert: HighErrorRate, expr: the ratio of the two sums > 0.05, for: 10m, labels severity: page, annotations summary; promtool check rules, sudo systemctl reload prometheus
hint-threshold-disk-firing =
    .lead = Watch the alerts: pending first, firing once the for: has passed. Let some time go by (man sleep).
    .solution = sleep 300, then curl -s localhost:9090/api/v1/alerts | jq '.data.alerts[] | {"{"}name: .labels.alertname, instance: .labels.instance, state{"}"}'
hint-threshold-disk-resolved =
    .lead = Now free hub's disk, as Ngozi said: the old backup only.
    .solution = ssh hub, then sudo rm /var/backups/docks-2029-04.tar.gz
hint-threshold-error-firing =
    .lead = The error alert needs its for: to pass too; keep watching /api/v1/alerts.
    .solution = sleep 600, then curl -s localhost:9090/api/v1/alerts | jq .
hint-threshold-error-resolved =
    .lead = The alert has fired: apply Tomás's fix on saddle, then let the 5-minute window empty itself of the bad minutes.
    .solution = ssh saddle, sudo systemctl restart rental, exit, then sleep 600
hint-threshold-end =
    .lead = Both rules loaded, each with severity and summary, the disk alert resolved, the app fixed and no error alert left; the files on disk loaded.
    .solution = curl -s localhost:9090/api/v1/rules | jq '.data.groups[].rules[] | {"{"}name, state, health{"}"}'

## Chapter 3 — Quiet Hours

hint-quiet-hours-repeats =
    .lead = Read what the relay posted to the chat: its log, on gauge.
    .solution = tail -n 20 /var/log/alert-relay/relay.log
hint-quiet-hours-routes =
    .lead = Where does the Alertmanager send an alert with severity=page? amtool can draw its routing tree and test labels (man amtool).
    .solution = amtool config routes, then amtool config routes test severity=page alertname=NodeDown
hint-quiet-hours-routing =
    .lead = In /etc/prometheus/alertmanager.yml, the child route's matcher must say what the rules set; check the file with amtool, then have the Alertmanager reread it.
    .solution = severity="page" instead of severity="critical", amtool check-config /etc/prometheus/alertmanager.yml, sudo systemctl reload prometheus-alertmanager
hint-quiet-hours-repeat-interval =
    .lead = Once an hour at most: the route's repeat_interval (and its children inherit it).
    .solution = repeat_interval: 4h in the route, amtool check-config, sudo systemctl reload prometheus-alertmanager
hint-quiet-hours-silenced =
    .lead = A silence for hub only, covering 10:00 to 11:30, with a comment (man amtool, silence add).
    .solution = amtool silence add instance="hub.internal:9100" --duration=2h30m --comment="hub: disk replaced"
hint-quiet-hours-end =
    .lead = Routing, repeat interval, a silence for hub only; Prometheus and the Alertmanager running, the rules untouched.
    .solution = amtool silence query, amtool config routes test severity=warning, systemctl status prometheus prometheus-alertmanager
