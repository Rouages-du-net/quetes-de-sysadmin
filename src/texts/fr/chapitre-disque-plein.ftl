### Histoire « L'Astreinte », chapitre 1 « Le disque plein » : un journal qui
### enfle, un fichier effacé encore ouvert, logrotate. Les commandes,
### chemins, directives et messages (df, du, lsof, logrotate) ne se traduisent pas.

chapitre-disque-plein = Le disque plein
    .resume = 2 h 47, le disque du serveur de la radio est plein : trouver le coupable, comprendre pourquoi rm ne rend rien, et confier les journaux à logrotate.

## Fichiers

disque-plein-message-de-zoe =
    Un message de Zoé, bénévole technique de Radio Quartier (2 h 40) :

    « Désolée de te réveiller pour ta première astreinte… L'enregistrement
    automatique de l'émission de nuit vient d'échouer : « No space left on
    device ». Le serveur dit que son disque est plein, mais je ne vois pas
    ce qui a pu le remplir, on n'a rien ajouté ces jours-ci.

    J'avais juste un peu bidouillé le relais du flux (le service
    radio-stream) la semaine dernière, pour comprendre des coupures. Il
    faudrait que ça reparte, et que ça ne se reproduise pas.

    Pour sudo : antenne-2027. »
disque-plein-conf-flux =
    # Radio Quartier : relais du flux (le service radio-stream)
    port = 8000
    mount = /direct
    logfile = /var/log/radio/stream.log
    # debug : tout, à chaque paquet ; info : l'essentiel (Zoé, 12/08 : debug pour l'enquête)
    loglevel = debug
disque-plein-flux-log =
    2027-08-15 02:46:58.112 DEBUG relay: packet 98412331 from source 127.0.0.1:41022 (4096 bytes)
    2027-08-15 02:46:58.113 DEBUG relay: buffer 61% full, 12 listeners
    2027-08-15 02:46:58.113 DEBUG relay: packet 98412332 from source 127.0.0.1:41022 (4096 bytes)
    2027-08-15 02:46:58.114 DEBUG relay: sent 4096 bytes to 12 listeners
    2027-08-15 02:46:58.114 DEBUG relay: packet 98412333 from source 127.0.0.1:41022 (4096 bytes)
    2027-08-15 02:46:58.115 ERROR record: cannot write /srv/radio/emissions/nuit-2027-08-15.ogg: No space left on device
disque-plein-syslog =
    Aug 15 02:40:01 radio CRON[24117]: (radio) CMD (/usr/local/bin/record nuit)
    Aug 15 02:40:03 radio record[24118]: write failed: No space left on device
disque-plein-logrotate-conf =
    # see "man logrotate" for details

    # global options do not affect preceding include directives

    # rotate log files weekly
    weekly

    # keep 4 weeks worth of backlogs
    rotate 4

    # create new (empty) log files after rotating old ones
    create

    # uncomment this if you want your log files compressed
    #compress

    # packages drop log rotation information into this directory
    include /etc/logrotate.d

    # system-specific logs may also be configured here.
disque-plein-logrotate-rsyslog =
    /var/log/syslog
    /var/log/auth.log
    {"{"}
    	rotate 4
    	weekly
    	missingok
    	notifempty
    	compress
    	delaycompress
    	sharedscripts
    	postrotate
    		/usr/lib/rsyslog/rsyslog-rotate
    	endscript
    {"}"}
disque-plein-logrotate-apt =
    /var/log/apt/term.log {"{"}
      rotate 12
      monthly
      compress
      missingok
      notifempty
    {"}"}

## Événements

disque-plein-evenement-plein =
    100 % : plus un octet de libre. Avant d'effacer quoi que ce soit, il
    faut savoir ce qui prend la place : du mesure, lieu par lieu (du -sh
    /var/*, puis plus profond), et c'est souvent du côté des journaux.
disque-plein-evenement-coupable =
    Le journal du relais pèse à lui seul plus de quinze gigaoctets ! Avant
    de le supprimer, regarde ce qu'il contient (tail), et pourquoi il a
    tant grossi.
disque-plein-evenement-debug =
    Des lignes DEBUG, plusieurs par paquet du flux : le relais écrit tout
    ce qu'il fait, des centaines de fois par seconde. Le niveau de journal
    est réglé dans sa configuration (/etc/radio/stream.conf) ; un programme
    ne relit sa configuration qu'au démarrage, ou au rechargement.
disque-plein-evenement-fantome =
    df dit toujours plein, mais du ne trouve plus le fichier : il a été
    effacé alors que le relais le tenait encore ouvert. Tant qu'un
    programme garde un fichier ouvert, sa place n'est pas rendue (sudo lsof
    +L1 le montre). Il faut qu'il le ferme : en le redémarrant, par exemple.
    La prochaine fois, truncate -s 0 vide un journal sans ce piège.
disque-plein-evenement-renomme =
    Le journal a été renommé, mais le relais écrit toujours dans l'ancien
    fichier, sous son nouveau nom (sudo lsof -p 1730) : un programme garde
    le fichier qu'il a ouvert, pas son nom. Pour logrotate, il faut soit
    copytruncate (copier puis vider), soit lui faire rouvrir son journal
    (postrotate … systemctl reload radio-stream … endscript).
# { $pourcent } : l'occupation du disque
disque-plein-evenement-respire =
    Le disque respire : { $pourcent } % occupés. L'enregistrement de nuit
    pourra reprendre. Reste à éviter la prochaine fois.
disque-plein-evenement-fin =
    Le disque a de la place, le relais tourne en mode normal, et logrotate
    s'occupera désormais de son journal. Zoé : « Désolée pour le debug…
    Je l'avais complètement oublié. »

    Bravo ! Tu as terminé le chapitre 1 de L'Astreinte. (La suite t'attend :
    ssh radio.)

    CE QUI S'EST PASSÉ
    Un niveau de journal laissé sur debug a rempli le disque en trois jours.
    Effacer un fichier ouvert ne libère rien tant que le programme le
    tient : df le compte, du ne le voit plus. Il fallait vider le fichier
    (truncate) ou faire redémarrer le programme, remettre le niveau normal,
    et confier le journal à logrotate.

    LA BONNE PRATIQUE
    - Disque plein : df pour voir, du pour trouver, lsof +L1 pour les
      fichiers effacés mais ouverts.
    - Vider un journal avec truncate -s 0, plutôt que rm.
    - Chaque journal a sa configuration logrotate (rotation, compression),
      avec copytruncate ou un postrotate qui fait rouvrir le fichier.
    - Le mode debug, seulement le temps d'une enquête ; et une alerte quand
      le disque dépasse 80 % (plus tard dans l'histoire).
    - Garder une trace de ce qui a été changé (et pourquoi).

    LA DOCUMENTATION
    - logrotate : https://man7.org/linux/man-pages/man8/logrotate.8.html
    - lsof : https://man7.org/linux/man-pages/man8/lsof.8.html
    - truncate : https://www.gnu.org/software/coreutils/manual/html_node/truncate-invocation.html
