### Histoire « Le Bastion », chapitre « Le Durcissement » : couper les mots
### de passe pour de bon (le fichier d'ajout qui l'emporte), un pare-feu
### qui refuse par défaut et survit à un redémarrage, et deploy rendu par
### clé. Les commandes, chemins et options ne sont pas traduits.

chapter-hardening = Le Durcissement
    .summary = Couper les mots de passe pour de bon, un pare-feu qui refuse par défaut et survit à un redémarrage, et rendre son compte à Selma, par clé seulement.

## Fichiers

hardening-email-nadia =
    De :     Nadia
    À :      toi
    Objet :  Lundi

    Selma voudrait déployer cet après-midi. Elle peut, sans risque ? Et
    comment on fait pour que ça ne puisse plus arriver ? L'hébergeur demande
    ce qu'on a changé.

    Nadia

hardening-incident =
    # Incident — four (livraisons)

    ## Nettoyé (14/04)
    Crontab, clé, /tmp/.cache, server.js restauré depuis la version signée.

    ## Pourquoi c'était possible
    - Mots de passe acceptés par ssh, alors que sshd_config dit « no ».
    - Pas de pare-feu : tous les ports ouverts, le 3000 de l'appli aussi.

    ## Leçons (à faire)
    - Mots de passe coupés, pour de vrai.
    - Pare-feu : refuser par défaut, n'ouvrir que le nécessaire, et le
      garder après un redémarrage (/etc/iptables/rules.v4).
    - deploy rendu à Selma, par clé seulement.

## Événements

hardening-event-looked =
    sshd -T dit « passwordauthentication yes », alors que sshd_config dit
    no. sshd_config commence par un Include de sshd_config.d/*.conf, et pour
    chaque mot-clé, la première valeur lue l'emporte : le fichier d'ajout,
    lu en premier, gagne.
hardening-event-not-reloaded =
    Les fichiers disent maintenant no, mais sshd applique toujours la
    configuration lue à son dernier démarrage ou rechargement : recharge ssh
    (systemctl).
hardening-event-passwords =
    Les connexions par mot de passe sont coupées dans la configuration que
    sshd applique : seules les clés ouvrent une session désormais.
hardening-event-locked-out =
    Attention : avec ces règles, ta prochaine connexion ssh serait refusée.
    Ta session actuelle ne risque rien, mais accepte le port 22 avant de te
    déconnecter.
hardening-event-no-loopback =
    La politique refuse par défaut, mais rien n'accepte la boucle locale
    (lo) : nginx joint l'appli sur 127.0.0.1, et ce serait refusé aussi. La
    première règle d'un pare-feu qui refuse par défaut laisse en général
    passer lo.
# { $port } : le port de l'appli
hardening-event-firewall =
    Le refus par défaut est en place : lo, les réponses aux connexions du
    serveur lui-même, ssh, http et https sont acceptés ; le reste est
    refusé, y compris le { $port }, qui était ouvert au monde entier.
hardening-event-saved =
    Les règles sont enregistrées dans /etc/iptables/rules.v4 :
    iptables-persistent les recharge au démarrage. Sans ça, un redémarrage
    aurait tout rouvert au monde.
hardening-event-deploy =
    deploy est de nouveau utilisable, et avec les mots de passe coupés,
    seule la clé de Selma l'ouvre.
hardening-event-end =
    Nadia : « J'ai envoyé tes notes à l'hébergeur. Ils disent que c'est la
    première fois qu'on leur répond avec une chronologie. »

    Bravo ! Tu as terminé le chapitre « Le Durcissement » et l'histoire « Le
    Bastion ».

    CE QUI S'EST PASSÉ
    La porte d'entrée était un fichier d'ajout laissé « pour un moment » :
    une seule ligne dans sshd_config.d, lue avant sshd_config, qui acceptait
    de nouveau les mots de passe. Tu les as coupés pour de vrai, tu as fermé
    tous les ports qui n'avaient pas à être ouverts avec un pare-feu qui
    refuse par défaut, enregistré pour le prochain démarrage, et tu as rendu
    son compte à Selma, par clé seulement.

    BONNE PRATIQUE
    - Vérifier ce qui s'applique, pas ce qu'on croit : sshd -T pour ssh,
      iptables -L ou nmap depuis l'extérieur pour le pare-feu.
    - Une exception temporaire a besoin d'une date de fin et de quelqu'un
      pour la retirer : l'écrire dans le fichier lui-même, et dans un rappel.
    - Refuser par défaut, puis ouvrir le nécessaire : lo, les réponses
      (ESTABLISHED,RELATED), puis chaque service. Et l'enregistrer, sinon le
      prochain redémarrage défait tout.
    - Clore l'incident par un compte rendu : ce qui s'est passé, quand, ce
      qui a été fait, ce qui change. incident.md est prêt à envoyer.

    UNE AUTRE FAÇON DE FAIRE
    fail2ban (vu dans « La sentinelle ») aurait banni 203.0.113.66 après
    quelques échecs. ufw écrit les mêmes règles iptables avec des commandes
    plus simples, et nftables leur succède. Et une revue des fichiers
    d'ajout (sshd_config.d, sudoers.d…) a toute sa place dans la veille
    hebdomadaire de « La Veille ».

    DOCUMENTATION
    - sshd_config (Include, première valeur) : https://man.openbsd.org/sshd_config
    - iptables : https://man7.org/linux/man-pages/man8/iptables.8.html
    - iptables-save : https://man7.org/linux/man-pages/man8/iptables-save.8.html
    - iptables sous Debian (iptables-persistent) : https://wiki.debian.org/iptables
    - NIST SP 800-61r2, l'après-incident : https://csrc.nist.gov/pubs/sp/800/61/r2/final
