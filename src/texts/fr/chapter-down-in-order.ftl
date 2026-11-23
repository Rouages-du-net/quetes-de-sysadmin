### Histoire « Le Mur d'escalade », chapitre « Chacun son tour » : le NAS
### branché sur le même onduleur devient le secondaire d'upsmon. upsd.conf
### (LISTEN, un redémarrage), upsd.users (upsmon secondary), ufw, upsmon.conf
### et nut.conf du secondaire, HOSTSYNC, offdelay et ondelay dans ups.conf,
### un exercice. Commandes, options, chemins, lignes de configuration et
### sorties ne sont pas traduits.

chapter-down-in-order = Chacun son tour
    .summary = Le NAS qui garde les photos de la salle et les décharges signées partage désormais l'onduleur du serveur, mais personne ne lui dit quand s'arrêter. Faites-en le secondaire de l'onduleur par le réseau, sans ouvrir l'onduleur à tout internet, et assurez-vous qu'il est arrêté avant que l'onduleur coupe le courant.

## Fichiers

down-in-order-message-akosua =
    De : Akosua (archive photo et décharges, le Dévers)
    Vendredi 26 novembre, 21 h 45

    Salut ! Nkechi m'a raconté l'exercice de la semaine dernière : relais
    s'arrête proprement maintenant. Génial.

    Depuis la tempête, harness (le NAS, 198.51.100.142) est branché sur le
    même onduleur que relais, dans la baie du bureau. Mais il ne sait rien
    de l'onduleur : mardi il est mort avec le courant, et ses disques ont
    passé la nuit à se vérifier. Les décharges sont dessus, on doit les
    garder cinq ans.

    Haruto disait que le NAS pourrait écouter relais : relais parle à
    l'onduleur en USB et pourrait transmettre les nouvelles par le réseau.
    Je ne sais pas comment. nut-client est installé sur harness, rien n'est
    configuré. Vous pouvez faire ssh de relais vers harness avec votre clé ;
    sudo marche là-bas aussi.

    Une chose que je sais : harness est lent à s'arrêter. Samba d'abord,
    puis il vide le cache de ses disques. Comptez deux minutes et demie.

    La salle est fermée : vous pouvez refaire un exercice ce soir.

    Akosua

## Événements

down-in-order-event-listen-restart =
    upsd.conf a sa nouvelle ligne LISTEN, mais upsd écoute toujours au même
    endroit (ss -tlnp) : upsd ne lit LISTEN qu'à son démarrage. Un reload
    relit upsd.users et ups.conf, pas ceci : redémarrez nut-server.

down-in-order-event-listen =
    upsd écoute maintenant aussi sur le réseau du bureau : harness peut le
    joindre sur le port 3493, si le pare-feu de relais le laisse passer.

down-in-order-event-exposed =
    Attention : depuis internet, le port 3493 de l'adresse publique de
    relais répond maintenant. upsd donne l'état de l'onduleur à qui le
    demande, et avec un mot de passe deviné, quelqu'un pourrait demander un
    arrêt forcé. N'écoutez que sur l'adresse du bureau, ou ne laissez
    passer que harness dans le pare-feu.

down-in-order-event-secondary-user =
    harness a un compte dans upsd.users. « upsmon secondary » lui donne ce
    qu'il faut à un secondaire : se connecter et suivre l'onduleur, rien de
    plus.

down-in-order-event-too-much =
    Un deuxième « primary » : un primaire peut mettre FSD et arrêter toutes
    les machines de l'onduleur. Seul relais, qui pilote l'onduleur et le
    coupe en dernier, doit être primaire ; harness suit en secondaire (dans
    upsd.users et dans la ligne MONITOR de harness).

down-in-order-event-firewall =
    Le pare-feu de relais laisse entrer harness sur le 3493.

down-in-order-event-blocked =
    La connexion expire : le ufw de relais jette ce qu'il n'autorise pas.
    Autorisez le 3493/tcp depuis harness (man ufw : allow from ADRESSE to
    any port PORT).

down-in-order-event-secondary =
    L'upsmon de harness est connecté à hallups sur relais en secondaire
    (upsc -c hallups sur relais liste deux clients). Batterie faible, relais
    met FSD, harness le voit et s'arrête, relais attend qu'il se déconnecte
    (HOSTSYNC) avant son propre arrêt.

down-in-order-event-drill-crash =
    Pendant l'exercice, harness a perdu le courant alors qu'il était encore
    en train de s'arrêter (son journal : le démarrage précédent finit au
    milieu de l'arrêt ; celui-ci commence par une vérification des disques).
    Il s'est déconnecté tout de suite, donc relais a continué ; relais
    s'est arrêté en une demi-minute, puis a dit à l'onduleur de couper ses
    prises offdelay secondes plus tard : 20 par défaut, alors que harness en
    a besoin de 150. Donnez à l'onduleur un délai plus long avant la coupure
    (man usbhid-ups : offdelay, ondelay).

down-in-order-event-ondelay =
    Dans ups.conf, ondelay n'est pas plus grand qu'offdelay. usbhid-ups(8) :
    ondelay « doit être plus grand » qu'offdelay, sinon l'onduleur risque de
    ne pas rendre le courant après une coupure.

down-in-order-event-not-enabled =
    Après l'exercice, l'upsmon de harness n'est pas revenu : nut-monitor est
    démarré mais pas activé sur harness, donc un démarrage ne le lance pas.
    Jusqu'à ce que quelqu'un s'en aperçoive, harness n'est plus protégé.

down-in-order-event-end =
    Akosua : « J'ai regardé les voyants du NAS pendant l'exercice : il
    s'est éteint une bonne minute avant le clic de l'onduleur, et tous deux
    sont revenus seuls. Les décharges vous remercient. »

    Bravo ! Vous avez terminé Chacun son tour.

    CE QUI S'EST PASSÉ
    harness partageait l'onduleur de relais sans le savoir. Vous avez fait
    écouter l'upsd de relais sur le réseau du bureau (LISTEN, lu seulement
    au démarrage), donné à harness un compte de secondaire et sa propre
    ligne MONITOR, ouvert le 3493 à harness seul, et activé son nut-monitor.
    Le premier exercice a montré le dernier piège : relais attendait que
    harness se déconnecte, mais harness se déconnecte en commençant son
    arrêt, et il lui faut deux minutes et demie ; l'onduleur coupait ses
    prises 20 secondes après l'arrêt de relais. Un offdelay plus long (et un
    ondelay plus grand encore) laisse à chaque machine le temps de
    s'arrêter.

    BONNES PRATIQUES
    - Un seul primaire par onduleur : la machine qui lui est reliée, qui
      s'arrête en dernier et dit à l'onduleur de couper. Les autres sont des
      secondaires par le réseau.
    - Ouvrir upsd aux machines qui en ont besoin, pas au monde : LISTEN sur
      l'adresse intérieure, et une règle de pare-feu par secondaire.
    - Chronométrer l'arrêt de la machine la plus lente et régler offdelay
      au-dessus, avec de la marge ; vérifier que la batterie tient aussi
      longtemps une fois faible (battery.runtime.low, battery.charge.low).
    - Activer les services, puis le prouver par un exercice : ce qui ne
      démarre pas au boot ne protège plus rien après la première coupure.

    UNE AUTRE FAÇON DE FAIRE
    Un secondaire peut s'arrêter plus tôt que la batterie faible, avec
    upssched (une minuterie après ONBATT) : les machines lentes partent
    alors en premier, et la batterie est gardée pour les autres.

    DOCUMENTATION
    - upsd.conf(5) : https://networkupstools.org/docs/man/upsd.conf.html
    - upsd.users(5) : https://networkupstools.org/docs/man/upsd.users.html
    - upsmon(8), la séquence d'arrêt : https://networkupstools.org/docs/man/upsmon.html
    - usbhid-ups(8), offdelay et ondelay : https://networkupstools.org/docs/man/usbhid-ups.html
    - nut.conf(5) : https://networkupstools.org/docs/man/nut.conf.html
