### Histoire « Les Vélos partagés », chapitre « L'Angle mort » : Prometheus
### est installé, mais deux de ses cibles échouent en silence et une machine
### manque. L'API HTTP avec curl et jq, promtool, le /metrics d'un
### exporteur, ufw, scrape_configs et le rechargement. Les commandes,
### options, noms de métriques, adresses, chemins et sorties ne sont pas
### traduits.

chapter-blind-spot = L'Angle mort
    .summary = Samedi dernier, la passerelle des stations s'est arrêtée et personne ne l'a su avant que les téléphones sonnent ; pourtant un Prometheus devait tout surveiller. Demandez-lui ce qu'il voit vraiment, et faites-lui voir toute la coopérative.

## Fichiers

blind-spot-message-ngozi =
    De : Ngozi (coopérative de vélos partagés)
    Lundi 7 mai, 14 h

    Bonjour, et bienvenue à bord !

    Samedi dernier, les stations n'ont plus loué de vélos pendant trois
    heures : moyeu, la machine qui parle aux stations, s'était arrêtée, et
    personne ne l'a su avant que les téléphones sonnent. Pourtant, Aroha
    avait installé Prometheus sur jauge avant de déménager, justement pour
    qu'il surveille tout.

    Pouvez-vous regarder ce que Prometheus voit vraiment ? Il n'y a pas de
    navigateur sur jauge, mais Prometheus répond sur son API HTTP, port
    9090 : curl lui parle (jq rend son JSON lisible), et promtool sait
    l'interroger aussi.

    Il devrait surveiller lui-même, nos trois machines (jauge, selle et
    moyeu : un node exporter sur le port 9100 de chacune), et l'appli de
    location sur selle (voir le mot de Tomás).

    Ngozi

blind-spot-note-tomas =
    Mot de Tomás

    L'appli de location tourne sur selle depuis mars, sur le port 3000.
    Elle expose ses métriques sur /metrics (prom-client, le format texte
    habituel). Aroha l'avait d'abord essayée ici, sur jauge, avant le
    déménagement.

    Tomás

## Événements

blind-spot-event-targets =
    Des cibles sont tombées ("health": "down", ou up à 0), chacune avec sa
    lastError. Prometheus va chercher : toutes les 15 secondes il « scrape »
    chaque cible (un GET HTTP sur /metrics) et note up, 1 si ça a marché,
    0 sinon. Et cherchez moyeu dans la liste.
blind-spot-event-deadline =
    « context deadline exceeded » : Prometheus a attendu l'exporteur de
    selle jusqu'au délai du scrape, et n'a rien reçu, pas même un refus. Un
    pare-feu qui jette les paquets fait ça. Sur selle (ssh selle),
    l'exporteur répond-il en local (curl localhost:9100/metrics) ? Que
    laisse passer son pare-feu (sudo ufw status) ?
blind-spot-event-refused =
    « connection refused » sur 127.0.0.1:3000 : le job rental interroge
    encore jauge elle-même, où rien n'écoute sur le port 3000. Le mot de
    Tomás dit où vit l'appli maintenant.
blind-spot-event-exporter =
    Le node exporter répond : du texte, un échantillon par ligne, avec
    # HELP et # TYPE avant chaque famille de métriques (un counter ne fait
    que croître, une gauge monte et descend). C'est ce que Prometheus lit à
    chaque scrape.
blind-spot-event-app-metrics =
    Les métriques de l'appli : http_requests_total est un counter, avec les
    étiquettes method, route et status ; http_request_duration_seconds un
    histogramme (_bucket, _sum, _count) ; rental_bikes_available une gauge
    par station.
blind-spot-event-too-open =
    Le port 9100 est maintenant ouvert à tout internet : un node exporter
    raconte votre machine à n'importe qui (son noyau, ses disques, sa
    charge). Seule jauge en a besoin : autorisez-la, elle seule, depuis
    192.0.2.54, et supprimez la règle trop large (sudo ufw status numbered,
    puis sudo ufw delete avec son numéro).
blind-spot-event-saddle-open =
    selle laisse maintenant jauge joindre son exporteur sur le port 9100,
    et personne d'autre. Au prochain scrape, la cible devrait passer à up.
blind-spot-event-config-invalid =
    promtool refuse le fichier, et dit à quelle ligne et pourquoi.
    Prometheus le refuserait de même en le relisant, et garderait son
    ancienne configuration.
blind-spot-event-config-check =
    promtool check config est d'accord : la syntaxe est valide, et les
    fichiers de règles qu'il cite ont été vérifiés aussi. Prometheus fait
    encore tourner la configuration lue avant, tant qu'il n'a pas relu le
    fichier.
blind-spot-event-lifecycle =
    « Lifecycle API is not enabled » : POST /-/reload ne marche que si
    Prometheus a été lancé avec --web.enable-lifecycle (ARGS dans
    /etc/default/prometheus). Sans lui, on recharge par un signal :
    sudo systemctl reload prometheus, qui envoie SIGHUP.
blind-spot-event-bad-reload =
    Le rechargement a échoué : Prometheus garde la configuration qu'il
    avait, et dit pourquoi dans son journal (sudo journalctl -u prometheus
    -n 20). systemctl n'a rien vu : un reload ne fait qu'envoyer un signal.
    Vérifiez d'abord le fichier avec promtool.
blind-spot-event-not-reloaded =
    Le fichier est bon, mais Prometheus fait encore tourner la
    configuration lue avant : faites-lui relire le fichier (sudo systemctl
    reload prometheus).
blind-spot-event-saddle-up = Le node exporter de selle est up.
blind-spot-event-rental-up = L'appli de location est up : ses compteurs arrivent à Prometheus toutes les 15 secondes.
blind-spot-event-hub-up =
    moyeu est surveillé : si son exporteur ne répond plus, son up passe à 0
    dans les 15 secondes. C'est le signal qui a manqué samedi.
blind-spot-event-end =
    Ngozi : « Tout est vert ! La prochaine fois que moyeu s'arrête,
    Prometheus le verra tout de suite. Maintenant, il faudrait que
    quelqu'un soit prévenu… la semaine prochaine ? »

    Bravo ! Vous avez terminé L'Angle mort.

    CE QUI S'EST PASSÉ
    Prometheus va chercher : à chaque scrape_interval, il interroge chaque
    cible de ses scrape_configs et note up, 1 ou 0. Deux cibles échouaient
    en silence depuis mars : le pare-feu de selle jetait le port 9100
    (context deadline exceeded), et le job rental visait encore
    localhost:3000, l'ancienne place de l'appli (connection refused).
    moyeu n'avait jamais été ajouté. Vous avez lu les cibles par l'API,
    ouvert le 9100 de selle à jauge seule, corrigé les cibles, vérifié le
    fichier avec promtool et fait relire Prometheus : { $targets } cibles,
    toutes up.

    BONNES PRATIQUES
    - Surveiller le surveillant : la santé des cibles (up) est la première
      chose à regarder, et la première alerte à écrire.
    - Pas besoin d'interface web : l'API HTTP répond à curl (jq pour la
      lire), et promtool query instant lance une requête.
    - promtool check config avant chaque rechargement : un rechargement
      raté garde l'ancienne configuration et ne le dit que dans le journal.
    - Recharger plutôt que redémarrer (systemctl reload prometheus :
      SIGHUP) : Prometheus garde l'état de ses alertes.
    - Un exporteur en dit long sur une machine : n'ouvrez son port qu'au
      serveur Prometheus.
    - Prometheus ajoute job et instance à chaque série ; des labels sous
      static_configs en disent plus sur une cible.

    DOCUMENTATION
    - scrape_config : https://prometheus.io/docs/prometheus/latest/configuration/configuration/#scrape_config
    - L'API HTTP : https://prometheus.io/docs/prometheus/latest/querying/api/
    - promtool : https://prometheus.io/docs/prometheus/latest/command-line/promtool/
    - Le node exporter : https://prometheus.io/docs/guides/node-exporter/
