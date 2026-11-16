### Histoire « Le Bastion », chapitre « L'Alarme » : un signalement d'abus
### de l'hébergeur ; trouver ce qui tourne, à qui ça parle et par où c'est
### entré, et le noter avant d'agir. Les commandes, chemins, adresses et
### lignes de journal ne sont pas traduits.

chapter-alarm = L'Alarme
    .summary = L'hébergeur dit que le serveur parle à un pool de minage : trouver ce qui tourne, à qui ça parle et par où c'est entré, avant de toucher à quoi que ce soit.

## Fichiers

alarm-email-nadia =
    De :     Nadia
    À :      toi
    Objet :  Tr : Signalement d'abus pour 192.0.2.33

    Désolée pour le samedi. Notre hébergeur a envoyé ça à 7 h, je n'en
    comprends pas la moitié. Le site des livraisons est lent ce matin, en
    plus. Tu peux regarder ? Selma (la développeuse de l'appli de livraison)
    est absente jusqu'à lundi.

    ---------- Message transféré ----------
    De :     abuse@host.example
    Objet :  Abuse report for 192.0.2.33

    Our monitoring shows that your server 192.0.2.33 has kept a connection
    open to 198.51.100.66, port 3333, since 13 April around 02:41 UTC. This
    address is a known cryptocurrency mining pool. This activity usually
    means a compromised machine. Please investigate and reply within 48
    hours.

    Nadia

    P.-S. Les notes d'incident que Salomé nous a appris à tenir sont dans
    incident.md.

alarm-incident-template =
    # Incident — four (livraisons)

    Ouvert le samedi 14 avril 2029, 8 h 20, après le signalement de l'hébergeur.

    ## Ce qui tourne
    (à compléter : quel programme, sous quel compte, depuis quel dossier)

    ## À qui ça parle
    (à compléter : quelle adresse et quel port)

    ## Par où c'est entré
    (à compléter : quel compte, depuis quelle adresse, à quelle heure, comment)

    ## Chronologie
    - 13/04 02:41 — première connexion au pool, d'après l'hébergeur.

## Événements

alarm-event-process =
    Un « kworkerd » prend presque deux processeurs entiers, sous deploy, et
    tourne depuis /tmp/.cache. Son nom imite un thread du noyau, mais un
    vrai s'affiche entre crochets ([kworker/0:1]), appartient à root et n'a
    pas de chemin sur le disque. Et son parent, un shell qui exécute
    /tmp/.cache/.w, n'a rien à voir avec l'appli.
# { $pool } : l'adresse du pool
alarm-event-connection =
    Le voilà : kworkerd a une connexion établie vers { $pool }, port 3333,
    l'adresse du signalement. Le programme et la connexion ne font qu'un.
alarm-event-connection-anonymous =
    Une connexion établie vers { $pool }, port 3333 : l'adresse de
    l'hébergeur. Mais quel programme la tient ? La colonne des processus ne
    s'affiche qu'avec -p, et pour les sockets des autres comptes, seulement
    pour root.
# { $address } : l'adresse de l'intrus·e
alarm-event-entry =
    Dans le journal de ssh, quatorze mots de passe refusés pour deploy depuis
    { $address }, puis « Accepted password » depuis la même adresse à
    02:40:57. Quelqu'un a deviné le mot de passe de deploy. Pourtant ce
    serveur n'accepte que des clés… du moins, c'est ce que tu croyais.
alarm-event-stopped-early =
    Tu l'as arrêté, et il est revenu aussitôt avec un autre PID : quelque
    chose le relance. Ce sera pour l'étape suivante ; pour l'instant, note
    ce que tu vois avant que ça ne change.
alarm-event-end =
    Nadia : « Donc quelqu'un se sert de notre serveur pour gagner de
    l'argent. Je préfère qu'on sache exactement quoi avant d'y toucher, tu as
    raison. »

    Bravo ! Tu as terminé le chapitre « L'Alarme ».

    CE QUI S'EST PASSÉ
    Dans la nuit du 12 au 13 avril, quelqu'un a essayé des mots de passe sur
    le compte deploy depuis 203.0.113.66, et a trouvé le bon à 02:40. Il ou
    elle a laissé un mineur déguisé en thread du noyau (kworkerd, dans
    /tmp/.cache), et une petite boucle shell qui le surveille. Depuis, le
    serveur travaille pour quelqu'un d'autre, et l'hébergeur l'a remarqué.

    BONNE PRATIQUE
    - Observer avant d'agir : ce qui tourne (ps, top), à qui ça parle (ss
      -tnp ou netstat -tnp, avec sudo pour voir les processus), par où c'est
      entré (journalctl -u ssh, last).
    - Noter au fur et à mesure, avec les heures : incident.md est la mémoire
      de l'incident, et la base de ce que tu diras à Nadia, à l'hébergeur,
      et peut-être à d'autres.
    - Ne pas éteindre la machine par réflexe : ce qui tourne en mémoire et
      les connexions ouvertes font partie des preuves.

    UNE AUTRE FAÇON DE FAIRE
    Un outil de détection d'intrusion sur la machine (auditd, AIDE, ou une
    surveillance des processus et des connexions sortantes) aurait donné
    l'alerte avant l'hébergeur. Le signalement de l'hébergeur est une
    deuxième ligne de défense, pas la première.

    DOCUMENTATION
    - ps : https://man7.org/linux/man-pages/man1/ps.1.html
    - ss : https://man7.org/linux/man-pages/man8/ss.8.html
    - journalctl : https://www.freedesktop.org/software/systemd/man/latest/journalctl.html
    - NIST SP 800-61r2, la gestion des incidents : https://csrc.nist.gov/pubs/sp/800/61/r2/final
