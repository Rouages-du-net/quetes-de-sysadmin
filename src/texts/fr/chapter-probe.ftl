### Histoire « L'Astreinte », chapitre 5 « La sonde » : la supervision
### (plugins de monitoring-plugins, mail -E), un timer systemd (ou cron),
### et un exercice de panne la nuit. Les commandes, options, directives et
### messages des outils ne se traduisent pas.

chapter-probe = La sonde
    .summary = Quatre nuits à réparer après coup : cette fois, Zoé veut être prévenue avant que ça casse. Et cette nuit, elle organise un exercice…

## Fichiers

probe-message-zoe =
    Un message de Zoé (lundi, 18 h 20) :

    « Quatre nuits, quatre pannes, et chaque fois on l'a su trop tard.
    J'ai commencé une sonde : /usr/local/bin/probe. Elle lance des
    contrôles (les « plugins » de supervision, ceux de Nagios ou
    d'Icinga) et m'envoie par courrier tout ce qui n'est pas OK. Le
    courrier de root arrive chez moi (/etc/aliases), et de là sur mon
    téléphone.

    Il reste du travail : elle ne regarde que le disque système, et rien
    ne la lance. Tu peux la compléter, puis la faire tourner toutes les
    5 minutes ?

    Et pour savoir si elle marche vraiment, je propose un exercice : la
    nuit qui suit, je provoquerai deux pannes, sans dire lesquelles. Dès
    que ta sonde sera planifiée, je lance l'exercice. Si je suis
    prévenue à temps, je répare. Mais pas de fausses alertes, hein : je
    veux pouvoir dormir. »
probe-script =
    #!/bin/sh
    # La sonde de Radio Quartier (Zoé, en chantier).
    # Chaque contrôle qui n'est pas OK part par courrier (mail -E : rien si tout va bien).
    # Les contrôles viennent de monitoring-plugins (comme Nagios ou Icinga) :
    # ils écrivent une ligne OK, WARNING ou CRITICAL (man check_disk).
    P=/usr/lib/nagios/plugins
    ALERTE="mail -E -s Alerte-radio root"

    # Le disque système : alerte sous 20 % de libre, critique sous 10 %.
    $P/check_disk -w 20% -c 10% -p / | grep -v " OK" | $ALERTE

    # À FAIRE : le volume des données, /srv/radio (et ses inodes : souviens-toi…)
    # À FAIRE : le direct répond-il ? (le relais écoute sur le port 8000, chemin /direct)
    # À FAIRE : la lancer toutes les 5 minutes (cron ? un timer systemd ?)
probe-podcasts-readme =
    Vignettes des podcasts : l'import automatique les dépose dans
    vignettes/ (une image par épisode).

## La nuit d'exercice

# { $runs } : combien de fois la sonde (ou une tâche planifiée) a tourné
probe-night =
    Ta sonde est planifiée : Zoé lance l'exercice. La soirée, puis la nuit
    passent ({ $runs ->
        [0] aucune tâche planifiée n'a tourné
        [one] une tâche planifiée a tourné
       *[other] les tâches planifiées ont tourné { $runs } fois
    }).
# { $alert }, { $repaired } : heures ; { $minutes } : durée du silence
probe-night-relay-seen =
    1 h 10 : Zoé arrête le relais du flux, d'un coup. À { $alert }, son
    téléphone sonne ; elle relance le relais à { $repaired }. Le direct a
    été muet { $minutes } minutes.
probe-night-relay-missed =
    1 h 10 : Zoé arrête le relais du flux, d'un coup… et personne n'est
    prévenu. Le direct reste muet jusqu'au matin. Que vérifie ta sonde
    quand le relais ne répond plus ? (man check_http, man check_procs)
probe-night-relay-slow =
    L'alerte est arrivée, mais plus de 15 minutes après la panne : pour
    une radio, c'est long. À quelle fréquence la sonde tourne-t-elle ?
    (systemctl list-timers, systemd-analyze calendar)
# { $alert } : heure
probe-night-inodes-seen =
    1 h 40 : l'import des vignettes s'emballe et crée des milliers de
    petits fichiers sur /srv/radio. À { $alert }, bien avant la fin des
    inodes, Zoé est prévenue et arrête l'import.
# { $full } : heure
probe-night-inodes-missed =
    1 h 40 : l'import des vignettes s'emballe et crée des milliers de
    petits fichiers sur /srv/radio. À { $full }, plus un inode libre :
    l'enregistrement de nuit échoue, sans que personne n'ait été prévenu.
    check_disk surveille-t-il ce volume, et ses inodes ? (man check_disk :
    -W et -K)
# { $count } : alertes reçues quand tout allait bien
probe-night-false =
    { $count ->
        [one] Zoé a reçu une alerte
       *[other] Zoé a reçu { $count } alertes
    } alors que tout allait bien. Des alertes pour rien, et au bout de
    quelques nuits plus personne ne les lit : un seuil trop serré, un
    contrôle qui écrit même quand tout va bien (cron envoie aussi par
    courrier tout ce qu'une tâche écrit) ?
probe-night-never =
    Rien n'a tourné de la nuit. Le timer est-il démarré, et se
    déclenche-t-il vraiment (systemctl list-timers) ? Attention :
    OnUnitActiveSec= seul ne part jamais, le service n'ayant encore jamais
    tourné (man systemd.timer).

## Événements

# { $directory } : le dossier des plugins
probe-event-plugin-outside-path =
    Les plugins de supervision ne sont pas dans le PATH : sur Debian, ils
    vivent dans { $directory }, et se lancent par leur chemin complet (comme
    dans la sonde de Zoé).
probe-event-first-alert =
    Zoé : « Bien reçu ton courrier ! » Tester une alerte avant d'en avoir
    besoin, c'est la bonne idée.
probe-event-end =
    Les deux pannes de l'exercice ont été vues à temps, et la nuit a été
    calme le reste du temps. Zoé : « Je n'ai jamais aussi bien dormi
    pendant une panne. »

    Bravo ! Tu as terminé le chapitre 5 de L'Astreinte. (La suite t'attend :
    ssh radio.)

    CE QUI S'EST PASSÉ
    Une sonde lance des contrôles (des plugins : une ligne et un code de
    retour, 0 OK, 1 WARNING, 2 CRITICAL) et prévient quand quelque chose
    ne va pas. Il fallait surveiller ce qui avait déjà cassé (le disque,
    les inodes, le direct), la faire tourner souvent (un timer systemd),
    et la tester par un exercice de panne.

    LA BONNE PRATIQUE
    - Surveiller ce qui compte pour les gens (le direct répond-il ?), pas
      seulement les ressources.
    - Des seuils qui laissent le temps d'agir (alerte à 80 %, critique à
      90 %), y compris pour les inodes.
    - Pas d'alerte pour rien : chaque alerte doit demander une action.
    - Un timer systemd (ou cron) pour la régularité ; systemctl
      list-timers et journalctl -u pour vérifier qu'il tourne.
    - Tester les alertes : un exercice de panne vaut mieux qu'une vraie
      surprise. Les outils complets (Icinga, Zabbix, Prometheus…)
      reprennent les mêmes idées.

    UNE AUTRE VOIE
    Une supervision centrale : Icinga ou Nagios (qui utilisent ces mêmes
    plugins check_*), Prometheus et ses alertes, Uptime Kuma pour
    surveiller des sites, Monit qui relance aussi les services. Un script
    et un timer suffisent pour une petite machine ; au-delà, un outil
    central voit toutes les machines et garde l'historique.

    LA DOCUMENTATION
    - les plugins et leurs codes de retour : https://www.monitoring-plugins.org/doc/guidelines.html
    - check_disk : https://www.monitoring-plugins.org/doc/man/check_disk.html
    - les timers systemd : https://www.freedesktop.org/software/systemd/man/latest/systemd.timer.html
