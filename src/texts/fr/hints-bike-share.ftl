### Indices gradués des Vélos partagés (voir src/engine/hints.ts) : un
### message par étape, hint-<chapitre>-<événement>, avec .lead (une
### direction, sans la commande exacte) et .solution (presque la réponse).

## Chapitre 1 — L'Angle mort

hint-blind-spot-targets =
    .lead = Demandez à Prometheus quelles cibles il interroge, et comment va chacune : son API HTTP répond sur le port 9090 (man prometheus, man curl, man jq).
    .solution = curl -s localhost:9090/api/v1/targets | jq '.data.activeTargets[] | {"{"}job: .labels.job, instance: .labels.instance, health, lastError{"}"}'
hint-blind-spot-deadline =
    .lead = Lisez la lastError de la cible node qui est tombée : un délai dépassé désigne le réseau, pas l'exporteur.
    .solution = curl -s localhost:9090/api/v1/targets | jq -r '.data.activeTargets[] | .lastError'
hint-blind-spot-refused =
    .lead = Et le job rental : quelle adresse interroge-t-il ? Comparez avec le mot de Tomás.
    .solution = grep -A3 rental /etc/prometheus/prometheus.yml, puis cat mot_de_tomas.txt
hint-blind-spot-saddle-open =
    .lead = Sur selle, l'exporteur répond en local ; son pare-feu décide qui d'autre peut joindre le port 9100. Laissez passer jauge, et jauge seule (man ufw).
    .solution = ssh selle, puis sudo ufw allow from 192.0.2.54 to any port 9100 proto tcp
hint-blind-spot-config-check =
    .lead = Corrigez scrape_configs dans /etc/prometheus/prometheus.yml : la cible de l'appli, et le node exporter de moyeu. Puis faites vérifier le fichier par promtool (man promtool).
    .solution = sudo nano /etc/prometheus/prometheus.yml (rental : selle.internal:3000 ; node : ajoutez moyeu.internal:9100), puis promtool check config /etc/prometheus/prometheus.yml
hint-blind-spot-hub-up =
    .lead = Prometheus fait encore tourner la configuration lue au démarrage : faites-lui relire le fichier, sans le redémarrer (man prometheus, man systemctl).
    .solution = sudo systemctl reload prometheus
hint-blind-spot-end =
    .lead = Toutes les cibles up, le port de selle ouvert à jauge seule, et le fichier identique à ce qui tourne. Revérifiez les cibles après un scrape.
    .solution = curl -s localhost:9090/api/v1/targets | jq -r '.data.activeTargets[] | "\(.labels.instance) \(.health)"'

## Chapitre 2 — Le Seuil

hint-threshold-disk-query =
    .lead = Interrogez l'espace libre de chaque système de fichiers, rapporté à sa taille : deux métriques du node exporter, divisées (man promtool, query instant).
    .solution = promtool query instant http://localhost:9090 'node_filesystem_avail_bytes / node_filesystem_size_bytes'
hint-threshold-error-query =
    .lead = http_requests_total est un counter : son débit sur 5 minutes, pour les 5xx, comparé au débit de toutes les requêtes. Additionnez de chaque côté avant de diviser.
    .solution = promtool query instant http://localhost:9090 'sum by (job) (rate(http_requests_total{"{"}status=~"5.."{"}"}[5m])) / sum by (job) (rate(http_requests_total[5m]))'
hint-threshold-disk-rule =
    .lead = Un fichier de règles dans /etc/prometheus/rules/, un groupe, une règle d'alerte (alert, expr, for, labels, annotations) ; vérifiez-le avec promtool, puis rechargez Prometheus.
    .solution = sudo nano /etc/prometheus/rules/bikes.yml : groups, - name: bikes, rules, - alert: DiskAlmostFull, expr: node_filesystem_avail_bytes{"{"}fstype!="tmpfs"{"}"} / node_filesystem_size_bytes < 0.10, for: 5m, labels severity: warning, annotations summary ; promtool check rules /etc/prometheus/rules/bikes.yml ; sudo systemctl reload prometheus
hint-threshold-error-rule =
    .lead = Une deuxième règle dans le même groupe, pour le taux d'erreurs, avec un for: assez long pour laisser passer les rafales normales (quelques minutes).
    .solution = - alert: HighErrorRate, expr: le rapport des deux sommes > 0.05, for: 10m, labels severity: page, annotations summary ; promtool check rules, sudo systemctl reload prometheus
hint-threshold-disk-firing =
    .lead = Surveillez les alertes : pending d'abord, firing une fois le for: écoulé. Laissez passer du temps (man sleep).
    .solution = sleep 300, puis curl -s localhost:9090/api/v1/alerts | jq '.data.alerts[] | {"{"}name: .labels.alertname, instance: .labels.instance, state{"}"}'
hint-threshold-disk-resolved =
    .lead = Libérez maintenant le disque de moyeu, comme l'a dit Ngozi : seulement l'ancienne sauvegarde.
    .solution = ssh moyeu, puis sudo rm /var/backups/docks-2029-04.tar.gz
hint-threshold-error-firing =
    .lead = L'alerte des erreurs attend aussi son for: ; continuez de regarder /api/v1/alerts.
    .solution = sleep 600, puis curl -s localhost:9090/api/v1/alerts | jq .
hint-threshold-error-resolved =
    .lead = L'alerte a sonné : appliquez la correction de Tomás sur selle, puis laissez la fenêtre de 5 minutes se vider des mauvaises minutes.
    .solution = ssh selle, sudo systemctl restart rental, exit, puis sleep 600
hint-threshold-end =
    .lead = Les deux règles chargées, chacune avec severity et summary, l'alerte du disque résolue, l'appli corrigée et plus d'alerte d'erreurs ; les fichiers du disque chargés.
    .solution = curl -s localhost:9090/api/v1/rules | jq '.data.groups[].rules[] | {"{"}name, state, health{"}"}'

## Chapitre 3 — Heures calmes

hint-quiet-hours-repeats =
    .lead = Lisez ce que le relais a posté dans la messagerie : son journal, sur jauge.
    .solution = tail -n 20 /var/log/alert-relay/relay.log
hint-quiet-hours-routes =
    .lead = Où l'Alertmanager envoie-t-il une alerte severity=page ? amtool sait dessiner son arbre d'aiguillage et tester des étiquettes (man amtool).
    .solution = amtool config routes, puis amtool config routes test severity=page alertname=NodeDown
hint-quiet-hours-routing =
    .lead = Dans /etc/prometheus/alertmanager.yml, la condition de la route fille doit dire ce que posent les règles ; vérifiez le fichier avec amtool, puis faites-le relire à l'Alertmanager.
    .solution = severity="page" au lieu de severity="critical", amtool check-config /etc/prometheus/alertmanager.yml, sudo systemctl reload prometheus-alertmanager
hint-quiet-hours-repeat-interval =
    .lead = Une fois par heure au plus : le repeat_interval de la route (ses filles en héritent).
    .solution = repeat_interval: 4h dans la route, amtool check-config, sudo systemctl reload prometheus-alertmanager
hint-quiet-hours-silenced =
    .lead = Un silence pour moyeu seul, qui couvre 10 h à 11 h 30, avec un commentaire (man amtool, silence add).
    .solution = amtool silence add instance="moyeu.internal:9100" --duration=2h30m --comment="moyeu : disque changé"
hint-quiet-hours-end =
    .lead = L'aiguillage, l'intervalle de répétition, un silence pour moyeu seul ; Prometheus et l'Alertmanager qui tournent, les règles intactes.
    .solution = amtool silence query, amtool config routes test severity=warning, systemctl status prometheus prometheus-alertmanager
