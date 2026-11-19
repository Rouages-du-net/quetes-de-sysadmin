### Histoire « Les Vélos partagés », chapitre « Le Seuil » : deux règles
### d'alerte, un disque plein et un taux d'erreurs. PromQL (une gauge
### comparée, rate() sur les counters, additionner avant de diviser), les
### fichiers de règles, for:, labels et annotations, promtool check rules,
### les états des alertes. Les commandes, options, noms de métriques,
### PromQL, chemins et sorties ne sont pas traduits.

chapter-threshold = Le Seuil
    .summary = Prometheus voit toutes les machines, mais personne ne le regarde. Écrivez les deux alertes dont la coopérative a besoin, un disque qui se remplit et une appli qui répond des erreurs, pour qu'elles sonnent quand quelque chose ne va vraiment pas, et se taisent le reste du temps.

## Fichiers

threshold-message-ngozi =
    De : Ngozi (coopérative de vélos partagés)
    Mardi 15 mai, 9 h

    Bonjour,

    Prometheus voit tout maintenant, mais personne ne le regarde de la
    journée. Deux alertes, s'il vous plaît, dans /etc/prometheus/rules/
    (prometheus.yml lit déjà rules/*.yml) :

    1. Un disque avec moins de 10 % d'espace libre, sur n'importe laquelle
       de nos machines. Gravité : warning.
    2. L'appli de location qui répond des erreurs (5xx) à plus de 5 % de
       ses requêtes. Gravité : page : c'est celle qui réveille la personne
       d'astreinte.

    Chacune avec un résumé (summary) : une phrase qui dit ce qui ne va pas,
    et où.

    Attention : Tomás dit que l'appli a de courtes rafales d'erreurs
    quelques fois par heure (une station qui se reconnecte). Elles sont
    normales, et ne doivent réveiller personne.

    Pour tester vos alertes, deux choses ne vont pas en ce moment. Le
    disque de moyeu est presque plein depuis la sauvegarde de la semaine
    dernière (/var/backups/docks-2029-04.tar.gz, déjà copiée ailleurs :
    supprimez-la une fois que votre alerte aura sonné). Et voyez le mot de
    Tomás.

    Ngozi

threshold-note-tomas =
    Mot de Tomás

    Depuis la version de ce matin (2.4.0), environ un retour sur deux
    échoue avec une erreur 500 (un bogue avec les codes de batterie des
    bornes). La correction, 2.4.1, est déjà sur selle (/srv/rental/VERSION) ;
    elle prend effet au redémarrage du service (sur selle : sudo systemctl
    restart rental).

    Ne le redémarrez qu'une fois votre alerte déclenchée : on veut savoir
    qu'elle marche.

    Tomás

threshold-release-notes =
    rental 2.4.1

    - Corrige les erreurs 500 de POST /returns quand une borne envoie un
      code de batterie (2.4.0).

## Événements

threshold-event-disk-query =
    Chaque système de fichiers, avec sa part d'espace libre. Lequel est
    bas ? (Un tmpfs comme /run vit en mémoire : écartez-le, avec
    fstype!="tmpfs" ou mountpoint="/".)
threshold-event-error-query =
    rate() transforme un counter en débit par seconde, moyenné sur sa
    fenêtre ([5m]). Pour comparer les erreurs à toutes les requêtes,
    divisez un débit par l'autre. Mais quelle série par laquelle ?
    Regardez les étiquettes de chaque côté.
threshold-event-rate-gauge =
    rate() est fait pour les counters, qui ne font que croître (leur nom
    finit par _total). Sur une gauge comme node_filesystem_avail_bytes, il
    prend chaque baisse pour une remise à zéro : absurde, et Prometheus
    prévient (« metric might not be a counter »). Comparez directement la
    valeur d'une gauge ; pour voir où elle va, deriv() ou predict_linear().
threshold-event-raw-counter =
    Une règle sur la valeur brute d'un counter : http_requests_total ne
    fait que croître depuis le démarrage de l'appli. Une fois le seuil
    passé, il ne redescend jamais : l'alerte sonnerait pour toujours,
    jusqu'au prochain redémarrage qui le remet à zéro. Alertez sur son
    rate().
threshold-event-unsummed =
    Cette règle divise chaque série par elle-même : la série des 500 de
    /returns par cette même série, donc 1, cent pour cent d'erreurs, tout
    le temps. Additionnez d'abord, puis divisez : sum by (job) du débit des
    5xx, divisé par sum by (job) du débit de toutes les requêtes.
threshold-event-not-errors =
    status!="200" compte aussi les 201 (une location créée) et les 404 (une
    station inconnue) : pas des erreurs de l'appli. Les erreurs du serveur,
    ce sont les 5xx : status=~"5..".
threshold-event-no-for =
    Sans for:, une alerte sonne dès que son expression est vraie, en une
    seule évaluation : chaque rafale d'erreurs (deux minutes, quelques fois
    par heure) bipperait quelqu'un, se résoudrait, puis recommencerait.
    for: 10m demande que la condition dure avant de sonner ; en attendant,
    l'alerte est « pending ».
threshold-event-disk-rule =
    La règle du disque est chargée. Essayée sur des journées inventées,
    elle prévient pour toute machine à 7 % de libre, et se tait à 12 %.
    Regardez /api/v1/alerts : l'alerte de moyeu devrait être pending, puis
    firing une fois son for: écoulé (sleep fait passer le temps).
threshold-event-error-rule =
    La règle des erreurs est chargée, et tient sur des journées inventées :
    elle sonne pendant un incident qui dure, et se tait pendant les rafales
    d'une journée normale.
threshold-event-labels =
    Une règle sans étiquette severity ou sans annotation summary :
    l'Alertmanager aiguille les alertes selon leurs étiquettes (severity),
    et la personne qui en reçoit une lit d'abord son résumé. Ajoutez les
    deux.
threshold-event-pending =
    « pending » : l'expression est vraie, et l'alerte attend que son for:
    soit écoulé avant de sonner. Si la condition cesse entre-temps, elle
    redevient inactive, et personne n'en entend parler.
threshold-event-disk-firing =
    L'alerte du disque de moyeu sonne (firing). Comme l'a dit Ngozi,
    l'ancienne sauvegarde peut partir maintenant (sur moyeu :
    /var/backups/docks-2029-04.tar.gz).
threshold-event-photos =
    Ngozi : « Les photos des stations ! Elles prouvent l'état de chaque vélo
    à son retour… Je les ai remises depuis la copie extérieure. » Le
    fichier à supprimer, c'était l'ancienne sauvegarde, dans /var/backups.
threshold-event-disk-resolved =
    Place libérée : à l'évaluation suivante l'expression est fausse, et
    l'alerte se résout (Prometheus continue un moment de le dire à
    l'Alertmanager, pour que le « resolved » arrive à tout le monde).
threshold-event-restart-early =
    Tomás : « Les erreurs ont cessé, merci ! Mais on n'a jamais vu l'alerte
    sonner. La règle est-elle prête pour la prochaine fois ? » Elle doit
    quand même tenir sur des journées inventées : /api/v1/rules montre ce
    qui est chargé.
threshold-event-error-firing =
    L'alerte des erreurs sonne : les erreurs ont duré plus que son for:.
    Maintenant, la correction : redémarrez rental sur selle.
threshold-event-error-resolved =
    L'appli tourne en 2.4.1 ; son taux d'erreurs est revenu à la normale,
    et l'alerte se résout une fois les mauvaises minutes sorties de sa
    fenêtre.
threshold-event-end =
    Ngozi : « Les deux alertes marchent, et elles savent se taire. La
    semaine prochaine : s'assurer qu'elles arrivent à quelqu'un, au bon
    moment. »

    Bravo ! Vous avez terminé Le Seuil.

    CE QUI S'EST PASSÉ
    Vous avez traduit deux questions en PromQL. Le disque :
    node_filesystem_avail_bytes / node_filesystem_size_bytes < 0.10, une
    gauge comparée directement. Les erreurs : le débit des 5xx sur le débit
    de toutes les requêtes, chacun additionné d'abord, > 0.05. Dans un
    fichier de règles, avec un for: (combien de temps la condition doit
    tenir), une étiquette severity et un résumé ; puis promtool check rules,
    un rechargement, et vous avez vu les alertes passer à pending, à
    firing, puis se résoudre après chaque correction.

    BONNES PRATIQUES
    - Alerter sur ce que ressentent les utilisateur·rices (des erreurs, un
      disque plein), avec un seuil et une durée.
    - rate() pour les counters (…_total), jamais leur valeur brute ; jamais
      rate() sur une gauge.
    - Additionner avant de diviser (sum by (job)) : un rapport de deux
      sommes.
    - for: absorbe les courtes rafales : trop court, il bippe pour rien ;
      trop long, il arrive tard.
    - Tester une alerte : la voir sonner une fois (ici, de vraies pannes ;
      ailleurs, promtool test rules avec des séries inventées).
    - Les étiquettes aiguillent l'alerte (severity), les annotations
      l'expliquent (summary, description, runbook_url).

    DOCUMENTATION
    - Les règles d'alerte : https://prometheus.io/docs/prometheus/latest/configuration/alerting_rules/
    - rate() : https://prometheus.io/docs/prometheus/latest/querying/functions/#rate
    - Opérateurs et appariement des vecteurs : https://prometheus.io/docs/prometheus/latest/querying/operators/
    - Bonnes pratiques d'alerte : https://prometheus.io/docs/practices/alerting/
