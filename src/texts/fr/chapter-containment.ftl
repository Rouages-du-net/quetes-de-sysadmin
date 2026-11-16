### Histoire « Le Bastion », chapitre « Le Confinement » : couper le mineur
### et l'intrus·e avec iptables sans s'enfermer dehors, arrêter le mineur et
### son chien de garde, fermer le compte deploy. Les commandes, chemins et
### adresses ne sont pas traduits.

chapter-containment = Le Confinement
    .summary = Couper le mineur et l'intrus·e sans s'enfermer dehors, arrêter ce qui tourne, et fermer le compte utilisé.

## Fichiers

containment-email-nadia =
    De :     Nadia
    À :      toi
    Objet :  Re : Signalement d'abus

    Merci pour les notes. Mon cousin dit qu'il suffit de débrancher le
    serveur. Mais les livreur·ses ont besoin des tournées à 11 h. On peut
    arrêter les dégâts sans arrêter les livraisons ?

    Nadia

containment-incident =
    # Incident — four (livraisons)

    ## Ce qui tourne
    /tmp/.cache/kworkerd (deploy), surveillé par /bin/sh /tmp/.cache/.w.

    ## À qui ça parle
    198.51.100.66, port 3333 (le pool).

    ## Par où c'est entré
    deploy, par mot de passe, depuis 203.0.113.66, le 13/04 à 02:40:57.

    ## Confinement
    (à faire : couper le pool et l'adresse de l'intrus·e, arrêter ce qui
    tourne, fermer deploy — sans couper ton propre ssh, et sans arrêter les
    livraisons)

## Événements

# { $pool } : l'adresse du pool
containment-event-pool =
    Le mineur ne peut plus joindre { $pool } : quoi qu'il calcule, il ne
    peut plus le rendre. L'hébergeur verra la connexion s'arrêter.
# { $address } : l'adresse de l'intrus·e
containment-event-attacker =
    { $address } ne peut plus ouvrir de connexion vers ce serveur. Ça
    n'arrêtera pas quelqu'un qui change d'adresse, mais ça ferme le chemin
    utilisé.
containment-event-locked-out =
    Attention : avec ces règles, ta prochaine connexion ssh depuis ton poste
    serait refusée. Ta session actuelle reste ouverte (le pare-feu ne coupe
    pas une connexion établie), mais déconnecte-toi maintenant et tu restes
    dehors. Accepte d'abord ton propre ssh (iptables -L --line-numbers pour
    voir l'ordre).
# { $pid } : le PID du nouveau mineur
containment-event-respawn =
    kworkerd est revenu, PID { $pid } : le chien de garde (/bin/sh
    /tmp/.cache/.w) le relance dès qu'il manque. Arrête d'abord le chien de
    garde, ou fige-le (kill -STOP), puis le mineur.
containment-event-app-down =
    L'appli de livraison s'est arrêtée : elle tournait aussi sous deploy,
    elle est partie avec le reste. Les livreur·ses en ont besoin à 11 h :
    relance-la (systemctl).
containment-event-relaunched =
    L'appli est repartie… et le chien de garde et le mineur aussi. Démarrer
    l'appli les a relancés : quelque chose dans l'appli elle-même le fait.
    Note-le dans incident.md ; arrête-les de nouveau, et garde ça pour
    l'étape suivante.
containment-event-stopped =
    Plus rien ne tourne depuis /tmp/.cache. Les fichiers sont toujours là,
    et ce qui les relance aussi : ce sera le travail de l'étape suivante.
containment-event-password-only =
    usermod -L verrouille le mot de passe de deploy, pas le compte : sshd
    accepte toujours une clé, et l'intrus·e en a peut-être laissé une. Le
    manuel de usermod dit quoi ajouter pour verrouiller le compte pour de
    bon (l'EXPIRE_DATE).
containment-event-closed =
    deploy ne peut plus se connecter du tout, ni par clé ni par mot de
    passe. Selma en aura besoin lundi ; on le rouvrira proprement à ce
    moment-là.
containment-event-end =
    Nadia : « Les tournées sont en ligne et l'hébergeur dit que la connexion
    s'est arrêtée. Merci. Et on n'a rien eu à débrancher. »

    Bravo ! Tu as terminé le chapitre « Le Confinement ».

    CE QUI S'EST PASSÉ
    Tu as arrêté les dégâts sans arrêter l'activité : le pool et l'adresse de
    l'intrus·e sont bloqués, le mineur et son chien de garde arrêtés dans le
    bon ordre, et deploy fermé pour de bon, clé comprise. Et l'appli de
    livraison tourne toujours.

    BONNE PRATIQUE
    - Confiner d'abord, nettoyer ensuite : le but est d'arrêter le mal en
      gardant les preuves et le service.
    - Avant une règle de pare-feu, penser à son propre accès : une session
      établie survit, la suivante non.
    - Un processus qui revient a un parent qui le relance : regarder
      l'arbre (ps -ef, la colonne PPID) et arrêter le parent d'abord.
    - usermod -L verrouille le mot de passe, pas le compte : avec sshd et
      PAM, une clé l'ouvre encore. Faire expirer le compte (usermod -e 1) ou
      lui donner nologin.

    UNE AUTRE FAÇON DE FAIRE
    Sur une machine virtuelle, l'hébergeur peut prendre un instantané de la
    mémoire et du disque avant qu'on touche à quoi que ce soit : la preuve la
    plus fidèle qui soit. Sur un serveur physique, l'isoler du réseau (un
    port de switch) fait le même travail que les règles de pare-feu, depuis
    l'extérieur de la machine.

    DOCUMENTATION
    - iptables : https://man7.org/linux/man-pages/man8/iptables.8.html
    - kill et les signaux : https://man7.org/linux/man-pages/man7/signal.7.html
    - usermod (-L, -e) : https://man7.org/linux/man-pages/man8/usermod.8.html
    - NIST SP 800-61r2, le confinement : https://csrc.nist.gov/pubs/sp/800/61/r2/final
