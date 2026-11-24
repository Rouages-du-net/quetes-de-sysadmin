### Pistas graduales de Las Bicis Compartidas (ver src/engine/hints.ts): un
### mensaje por paso, hint-<capítulo>-<evento>, con .lead (una dirección, sin
### el comando exacto) y .solution (casi la respuesta).

## Capítulo 1 — El punto ciego

hint-blind-spot-targets =
    .lead = Pregunta a Prometheus qué objetivos recoge, y cómo está cada uno: su API HTTP responde en el puerto 9090 (man prometheus, man curl, man jq).
    .solution = curl -s localhost:9090/api/v1/targets | jq '.data.activeTargets[] | {"{"}job: .labels.job, instance: .labels.instance, health, lastError{"}"}'
hint-blind-spot-deadline =
    .lead = Lee el lastError del objetivo node que está caído: un tiempo agotado apunta a la red, no al exporter.
    .solution = curl -s localhost:9090/api/v1/targets | jq -r '.data.activeTargets[] | .lastError'
hint-blind-spot-refused =
    .lead = ¿Y el job rental: qué dirección recoge? Compárala con la nota de Tomás.
    .solution = grep -A3 rental /etc/prometheus/prometheus.yml, luego cat nota_de_tomas.txt
hint-blind-spot-saddle-open =
    .lead = En sillin, el exporter responde en local; su cortafuegos decide quién más puede llegar al puerto 9100. Deja pasar a medidor, y solo a medidor (man ufw).
    .solution = ssh sillin, luego sudo ufw allow from 192.0.2.54 to any port 9100 proto tcp
hint-blind-spot-config-check =
    .lead = Corrige scrape_configs en /etc/prometheus/prometheus.yml: el objetivo de la aplicación, y el node exporter de buje. Luego haz que promtool compruebe el archivo (man promtool).
    .solution = sudo nano /etc/prometheus/prometheus.yml (rental: sillin.internal:3000; node: añade buje.internal:9100), luego promtool check config /etc/prometheus/prometheus.yml
hint-blind-spot-hub-up =
    .lead = Prometheus sigue con la configuración que leyó al arrancar: haz que vuelva a leer el archivo, sin reiniciarlo (man prometheus, man systemctl).
    .solution = sudo systemctl reload prometheus
hint-blind-spot-end =
    .lead = Todos los objetivos arriba, el puerto de sillin abierto solo a medidor, y el archivo igual a lo que se ejecuta. Vuelve a mirar los objetivos tras una recogida.
    .solution = curl -s localhost:9090/api/v1/targets | jq -r '.data.activeTargets[] | "\(.labels.instance) \(.health)"'

## Capítulo 2 — El umbral

hint-threshold-disk-query =
    .lead = Consulta el espacio libre de cada sistema de archivos como proporción de su tamaño: dos métricas del node exporter, divididas (man promtool, query instant).
    .solution = promtool query instant http://localhost:9090 'node_filesystem_avail_bytes / node_filesystem_size_bytes'
hint-threshold-error-query =
    .lead = http_requests_total es un contador: su tasa en 5 minutos, para los 5xx, comparada con la tasa de todas las peticiones. Suma a cada lado antes de dividir.
    .solution = promtool query instant http://localhost:9090 'sum by (job) (rate(http_requests_total{"{"}status=~"5.."{"}"}[5m])) / sum by (job) (rate(http_requests_total[5m]))'
hint-threshold-disk-rule =
    .lead = Un archivo de reglas en /etc/prometheus/rules/, un grupo, una regla de alerta (alert, expr, for, labels, annotations); compruébalo con promtool, y luego recarga Prometheus.
    .solution = sudo nano /etc/prometheus/rules/bikes.yml: groups, - name: bikes, rules, - alert: DiskAlmostFull, expr: node_filesystem_avail_bytes{"{"}fstype!="tmpfs"{"}"} / node_filesystem_size_bytes < 0.10, for: 5m, labels severity: warning, annotations summary; promtool check rules /etc/prometheus/rules/bikes.yml; sudo systemctl reload prometheus
hint-threshold-error-rule =
    .lead = Una segunda regla en el mismo grupo, para la tasa de errores, con un for: lo bastante largo para dejar pasar las ráfagas normales (unos minutos).
    .solution = - alert: HighErrorRate, expr: el cociente de las dos sumas > 0.05, for: 10m, labels severity: page, annotations summary; promtool check rules, sudo systemctl reload prometheus
hint-threshold-disk-firing =
    .lead = Observa las alertas: primero pending, firing cuando haya pasado el for:. Deja pasar algo de tiempo (man sleep).
    .solution = sleep 300, luego curl -s localhost:9090/api/v1/alerts | jq '.data.alerts[] | {"{"}name: .labels.alertname, instance: .labels.instance, state{"}"}'
hint-threshold-disk-resolved =
    .lead = Ahora libera el disco de buje, como dijo Ngozi: solo la copia antigua.
    .solution = ssh buje, luego sudo rm /var/backups/docks-2029-04.tar.gz
hint-threshold-error-firing =
    .lead = La alerta de errores también necesita que pase su for:; sigue mirando /api/v1/alerts.
    .solution = sleep 600, luego curl -s localhost:9090/api/v1/alerts | jq .
hint-threshold-error-resolved =
    .lead = La alerta ha saltado: aplica la corrección de Tomás en sillin, y deja que la ventana de 5 minutos se vacíe de los minutos malos.
    .solution = ssh sillin, sudo systemctl restart rental, exit, luego sleep 600
hint-threshold-end =
    .lead = Las dos reglas cargadas, cada una con severity y summary, la alerta de disco resuelta, la aplicación corregida y ninguna alerta de errores; los archivos del disco cargados.
    .solution = curl -s localhost:9090/api/v1/rules | jq '.data.groups[].rules[] | {"{"}name, state, health{"}"}'

## Capítulo 3 — Horas tranquilas

hint-quiet-hours-repeats =
    .lead = Lee lo que el relé publicó en el chat: su registro, en medidor.
    .solution = tail -n 20 /var/log/alert-relay/relay.log
hint-quiet-hours-routes =
    .lead = ¿Adónde envía el Alertmanager una alerta con severity=page? amtool puede dibujar su árbol de encaminamiento y probar etiquetas (man amtool).
    .solution = amtool config routes, luego amtool config routes test severity=page alertname=NodeDown
hint-quiet-hours-routing =
    .lead = En /etc/prometheus/alertmanager.yml, el matcher de la ruta hija debe decir lo que ponen las reglas; comprueba el archivo con amtool, y luego haz que el Alertmanager lo vuelva a leer.
    .solution = severity="page" en lugar de severity="critical", amtool check-config /etc/prometheus/alertmanager.yml, sudo systemctl reload prometheus-alertmanager
hint-quiet-hours-repeat-interval =
    .lead = Una vez por hora como mucho: el repeat_interval de la ruta (y sus hijas lo heredan).
    .solution = repeat_interval: 4h en la ruta, amtool check-config, sudo systemctl reload prometheus-alertmanager
hint-quiet-hours-silenced =
    .lead = Un silencio solo para buje, que cubra de 10:00 a 11:30, con un comentario (man amtool, silence add).
    .solution = amtool silence add instance="buje.internal:9100" --duration=2h30m --comment="buje: disco cambiado"
hint-quiet-hours-end =
    .lead = Encaminamiento, intervalo de repetición, un silencio solo para buje; Prometheus y el Alertmanager en marcha, las reglas intactas.
    .solution = amtool silence query, amtool config routes test severity=warning, systemctl status prometheus prometheus-alertmanager
