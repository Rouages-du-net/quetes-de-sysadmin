### Abgestufte Hinweise für Der Fahrradverleih (siehe src/engine/hints.ts):
### eine Nachricht pro Schritt, hint-<chapter>-<event>, mit .lead (eine
### Richtung, ohne den genauen Befehl) und .solution (fast die Antwort).

## Kapitel 1 — Der tote Winkel

hint-blind-spot-targets =
    .lead = Frag Prometheus, welche Targets er scrapt und wie es jedem geht: Seine HTTP-API antwortet auf Port 9090 (man prometheus, man curl, man jq).
    .solution = curl -s localhost:9090/api/v1/targets | jq '.data.activeTargets[] | {"{"}job: .labels.job, instance: .labels.instance, health, lastError{"}"}'
hint-blind-spot-deadline =
    .lead = Lies den lastError des node-Targets, das down ist: Ein Timeout zeigt auf das Netz, nicht auf den Exporter.
    .solution = curl -s localhost:9090/api/v1/targets | jq -r '.data.activeTargets[] | .lastError'
hint-blind-spot-refused =
    .lead = Und der Job rental: Welche Adresse scrapt er? Vergleiche mit Tomás' Notiz.
    .solution = grep -A3 rental /etc/prometheus/prometheus.yml, dann cat notiz_von_tomas.txt
hint-blind-spot-saddle-open =
    .lead = Auf sattel antwortet der Exporter lokal; seine Firewall entscheidet, wer sonst Port 9100 erreichen darf. Lass messuhr durch, und nur messuhr (man ufw).
    .solution = ssh sattel, dann sudo ufw allow from 192.0.2.54 to any port 9100 proto tcp
hint-blind-spot-config-check =
    .lead = Korrigiere scrape_configs in /etc/prometheus/prometheus.yml: das Target der App und den Node Exporter von nabe. Lass dann promtool die Datei prüfen (man promtool).
    .solution = sudo nano /etc/prometheus/prometheus.yml (rental: sattel.internal:3000; node: nabe.internal:9100 hinzufügen), dann promtool check config /etc/prometheus/prometheus.yml
hint-blind-spot-hub-up =
    .lead = Prometheus läuft immer noch mit der Konfiguration, die er beim Start gelesen hat: Lass ihn die Datei neu lesen, ohne ihn neu zu starten (man prometheus, man systemctl).
    .solution = sudo systemctl reload prometheus
hint-blind-spot-end =
    .lead = Jedes Target up, der Port von sattel nur für messuhr offen, und die Datei gleich dem, was läuft. Prüf die Targets nach einem Scrapen noch einmal.
    .solution = curl -s localhost:9090/api/v1/targets | jq -r '.data.activeTargets[] | "\(.labels.instance) \(.health)"'

## Kapitel 2 — Der Schwellenwert

hint-threshold-disk-query =
    .lead = Frag den freien Platz jedes Dateisystems als Anteil seiner Größe ab: zwei Metriken des Node Exporters, geteilt (man promtool, query instant).
    .solution = promtool query instant http://localhost:9090 'node_filesystem_avail_bytes / node_filesystem_size_bytes'
hint-threshold-error-query =
    .lead = http_requests_total ist ein Counter: seine Rate über 5 Minuten, für die 5xx, verglichen mit der Rate aller Anfragen. Auf jeder Seite summieren, bevor du teilst.
    .solution = promtool query instant http://localhost:9090 'sum by (job) (rate(http_requests_total{"{"}status=~"5.."{"}"}[5m])) / sum by (job) (rate(http_requests_total[5m]))'
hint-threshold-disk-rule =
    .lead = Eine Regeldatei in /etc/prometheus/rules/, eine Gruppe, eine Alarmregel (alert, expr, for, labels, annotations); prüf sie mit promtool und lade dann Prometheus neu.
    .solution = sudo nano /etc/prometheus/rules/bikes.yml: groups, - name: bikes, rules, - alert: DiskAlmostFull, expr: node_filesystem_avail_bytes{"{"}fstype!="tmpfs"{"}"} / node_filesystem_size_bytes < 0.10, for: 5m, labels severity: warning, annotations summary; promtool check rules /etc/prometheus/rules/bikes.yml; sudo systemctl reload prometheus
hint-threshold-error-rule =
    .lead = Eine zweite Regel in derselben Gruppe, für die Fehlerrate, mit einem for:, das lang genug ist, um die normalen Schübe vorbeiziehen zu lassen (ein paar Minuten).
    .solution = - alert: HighErrorRate, expr: das Verhältnis der beiden Summen > 0.05, for: 10m, labels severity: page, annotations summary; promtool check rules, sudo systemctl reload prometheus
hint-threshold-disk-firing =
    .lead = Beobachte die Alarme: zuerst pending, firing, sobald das for: verstrichen ist. Lass etwas Zeit vergehen (man sleep).
    .solution = sleep 300, dann curl -s localhost:9090/api/v1/alerts | jq '.data.alerts[] | {"{"}name: .labels.alertname, instance: .labels.instance, state{"}"}'
hint-threshold-disk-resolved =
    .lead = Gib jetzt die Platte von nabe frei, wie Ngozi gesagt hat: nur das alte Backup.
    .solution = ssh nabe, dann sudo rm /var/backups/docks-2029-04.tar.gz
hint-threshold-error-firing =
    .lead = Auch beim Fehleralarm muss sein for: verstreichen; beobachte weiter /api/v1/alerts.
    .solution = sleep 600, dann curl -s localhost:9090/api/v1/alerts | jq .
hint-threshold-error-resolved =
    .lead = Der Alarm ist losgegangen: Wende Tomás' Korrektur auf sattel an und lass dann das 5-Minuten-Fenster die schlechten Minuten loswerden.
    .solution = ssh sattel, sudo systemctl restart rental, exit, dann sleep 600
hint-threshold-end =
    .lead = Beide Regeln geladen, jede mit severity und summary, der Plattenalarm aufgelöst, die App korrigiert und kein Fehleralarm mehr; die Dateien auf der Platte geladen.
    .solution = curl -s localhost:9090/api/v1/rules | jq '.data.groups[].rules[] | {"{"}name, state, health{"}"}'

## Kapitel 3 — Ruhezeiten

hint-quiet-hours-repeats =
    .lead = Lies, was das Relay in den Chat gepostet hat: sein Log, auf messuhr.
    .solution = tail -n 20 /var/log/alert-relay/relay.log
hint-quiet-hours-routes =
    .lead = Wohin schickt der Alertmanager einen Alarm mit severity=page? amtool kann seinen Routing-Baum zeichnen und Labels testen (man amtool).
    .solution = amtool config routes, dann amtool config routes test severity=page alertname=NodeDown
hint-quiet-hours-routing =
    .lead = In /etc/prometheus/alertmanager.yml muss der Matcher der Kindroute sagen, was die Regeln setzen; prüf die Datei mit amtool und lass den Alertmanager sie dann neu lesen.
    .solution = severity="page" statt severity="critical", amtool check-config /etc/prometheus/alertmanager.yml, sudo systemctl reload prometheus-alertmanager
hint-quiet-hours-repeat-interval =
    .lead = Höchstens einmal pro Stunde: das repeat_interval der Route (und ihre Kinder erben es).
    .solution = repeat_interval: 4h in der Route, amtool check-config, sudo systemctl reload prometheus-alertmanager
hint-quiet-hours-silenced =
    .lead = Eine Stummschaltung nur für nabe, von 10:00 bis 11:30, mit einem Kommentar (man amtool, silence add).
    .solution = amtool silence add instance="nabe.internal:9100" --duration=2h30m --comment="nabe: Platte getauscht"
hint-quiet-hours-end =
    .lead = Routing, Wiederholungsintervall, eine Stummschaltung nur für nabe; Prometheus und der Alertmanager laufen, die Regeln unberührt.
    .solution = amtool silence query, amtool config routes test severity=warning, systemctl status prometheus prometheus-alertmanager
