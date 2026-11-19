### Histoire « Les Vélos partagés », chapitre « Heures calmes » :
### l'aiguillage de l'Alertmanager, le regroupement et l'intervalle de
### répétition, et un silence pour une maintenance prévue. amtool,
### alertmanager.yml, le journal du relais. Les commandes, options,
### étiquettes, chemins et sorties ne sont pas traduits.

chapter-quiet-hours = Heures calmes
    .summary = Les alertes arrivent dans la messagerie, mais aux mauvaises personnes, encore et encore, et une maintenance prévue va réveiller pour rien la personne d'astreinte. Aiguillez les alertes, calmez-les, et faites taire ce que vous savez déjà, sans tout faire taire.

## Fichiers

quiet-hours-message-ngozi =
    De : Ngozi (coopérative de vélos partagés)
    Samedi 19 mai, 9 h 35

    Bonjour,

    Deux choses, dont une urgente.

    1. Les alertes arrivent dans la messagerie (le relais sur jauge poste
       ce que l'Alertmanager lui envoie : /var/log/alert-relay/relay.log),
       mais mal. #team reçoit le même avertissement sur le disque de selle
       toutes les cinq minutes (Tomás le videra lundi, ça peut attendre).
       Et mardi soir, selle est tombée quatre minutes : l'alerte est partie
       dans #team, et personne d'astreinte n'a été prévenu. Les pages vont
       dans #on-call, les warnings dans #team, et pas plus d'une fois par
       heure, s'il vous plaît.

    2. À 10 h, je change le disque de moyeu. Il sera arrêté jusque vers
       11 h 30. Je ne veux pas que la personne d'astreinte soit réveillée
       pour une chose qu'on connaît déjà. Mais je veux savoir si selle ou
       quoi que ce soit d'autre tombe pendant ce temps !

    amtool est installé (il lit /etc/amtool/config.yml).

    Ngozi

## Événements

quiet-hours-event-repeats =
    Le même avertissement, toutes les cinq minutes : repeat_interval: 1m
    dans /etc/prometheus/alertmanager.yml. L'Alertmanager renvoie une
    alerte qui sonne encore après repeat_interval (4h par défaut), mais ne
    regarde un groupe que tous les group_interval (ici 5m) : c'est le plus
    souvent qu'il puisse répéter. group_by décide de ce qui va ensemble.
quiet-hours-event-routes =
    L'arbre d'aiguillage : sous la route par défaut, une seule route, pour
    severity="critical". Vos règles disent page ou warning : critical ne
    correspond à rien, donc tout tombe dans le destinataire par défaut,
    team. (amtool config routes test severity=page montre où irait une
    alerte.)
quiet-hours-event-am-invalid =
    amtool refuse le fichier, et dit pourquoi. L'Alertmanager le refuserait
    aussi, et garderait son ancienne configuration.
quiet-hours-event-am-check =
    amtool check-config : le fichier est valide. L'Alertmanager fait encore
    tourner la configuration lue avant, tant qu'il n'a pas relu le fichier.
quiet-hours-event-am-not-reloaded =
    Le fichier est bon, mais l'Alertmanager ne l'a pas relu : sudo
    systemctl reload prometheus-alertmanager (ou un POST sur /-/reload).
quiet-hours-event-am-bad-reload =
    Le rechargement a échoué : l'Alertmanager garde son ancienne
    configuration, et son journal dit pourquoi (sudo journalctl -u
    prometheus-alertmanager -n 20).
quiet-hours-event-routing =
    L'aiguillage marche : une page va à on-call, un warning à team.
quiet-hours-event-repeat-interval =
    Pas plus d'un rappel par heure : le canal respire. Une alerte résolue
    est quand même annoncée (send_resolved, vrai par défaut pour un
    webhook).
quiet-hours-event-stopped =
    Prometheus ou l'Alertmanager est arrêté : plus rien ne sera remarqué,
    ni pendant la maintenance ni après, et selle pourrait tomber sans que
    personne le voie. Ngozi a demandé l'inverse. Relancez-le, et ne faites
    taire que ce que vous connaissez.
quiet-hours-event-rule-removed =
    La règle NodeDown a disparu : la maintenance de moyeu ne bippera pas,
    mais la prochaine chute de selle non plus, ni moyeu s'il ne revient pas
    à 11 h 30. Un silence, c'est pour un temps connu et limité ; supprimer
    une règle, c'est pour toujours.
quiet-hours-event-too-broad =
    Ce silence couvre aussi les alertes d'autres machines (ou toutes les
    pages) : si selle tombe pendant la maintenance, personne ne le saura.
    Restreignez-le à moyeu (son instance), et faites expirer le trop large
    (amtool silence expire avec son ID).
quiet-hours-event-too-short =
    Ce silence ne couvre pas toute la maintenance, de 10 h à 11 h 30 : il
    commence trop tard, ou sa fin bipperait quelqu'un. --duration compte à
    partir de maintenant (ou de --start). Un silence ne s'allonge pas, mais
    se remplace : ajoutez-en un nouveau, faites expirer l'ancien.
quiet-hours-event-silenced =
    Les alertes de moyeu sont mises en silence pour la maintenance :
    l'Alertmanager les reçoit toujours (amtool alert query --silenced), mais
    n'envoie rien. Le silence finit tout seul.
quiet-hours-event-paged =
    Le téléphone d'astreinte a sonné : le NodeDown de moyeu, pendant une
    maintenance que tout le monde connaissait. Un silence posé avant
    l'aurait fait taire.
quiet-hours-event-end =
    Ngozi : « Parfait. Je descends à la cave avec le disque neuf. Si selle
    cligne seulement des yeux, je le saurai. » (Vous pouvez regarder la
    matinée passer : sleep 1800, puis amtool alert query --silenced.)

    Bravo ! Vous avez terminé Heures calmes, et Les Vélos partagés.

    CE QUI S'EST PASSÉ
    Prometheus décide qu'une alerte sonne ; l'Alertmanager décide qui
    l'apprend, à quelle fréquence, et quand se taire. Sa seule route
    attendait severity="critical", une étiquette qu'aucune règle ne pose :
    toutes les alertes tombaient dans le destinataire par défaut (#team),
    et repeat_interval: 1m les répétait à chaque group_interval, toutes les
    cinq minutes. Vous avez corrigé la condition (page va à on-call), posé
    un intervalle de répétition raisonnable, vérifié le fichier (amtool
    check-config), rechargé, et mis moyeu en silence pour sa maintenance
    avec amtool, sans toucher aux règles ni rien arrêter.

    BONNES PRATIQUES
    - Aiguiller sur les étiquettes que les règles posent vraiment ; amtool
      config routes test montre où va une alerte.
    - Regrouper ce qui va ensemble (group_by), et répéter en heures, pas en
      minutes.
    - Une maintenance prévue, c'est un silence : des conditions étroites
      (instance=…), un début et une fin qui couvrent la fenêtre avec de la
      marge, un commentaire, un auteur. Jamais supprimer la règle, jamais
      arrêter la supervision.
    - L'inhibition (inhibit_rules) peut faire taire les alertes des
      services d'une machine pendant que la machine elle-même est tombée.
    - Vérifier une configuration avant de la recharger (amtool
      check-config, promtool check config).

    DOCUMENTATION
    - Alertmanager, route : https://prometheus.io/docs/alerting/latest/configuration/#route
    - Regroupement, inhibition, silences : https://prometheus.io/docs/alerting/latest/alertmanager/
    - amtool : https://github.com/prometheus/alertmanager#amtool
