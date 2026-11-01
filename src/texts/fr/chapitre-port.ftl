### Histoire « Les Lettres du quartier », chapitre 7 « Le port » :
### déplacer SSH sur un autre port sans s'enfermer dehors (sshd, ufw,
### ~/.ssh/config, la prison de fail2ban). Les commandes, chemins, options
### et lignes de journal ne se traduisent pas.

chapitre-port = Le port
    .resume = Les robots saturent le journal de SSH : le déplacer sur le port 2222, sans s'enfermer dehors, et sans oublier fail2ban.

## Fichiers

# { $port } : le nouveau port de SSH
port-courriel-kofi =
    De :     Kofi
    À :      toi
    Objet :  Le port de SSH

    Rania a regardé le journal de SSH (journalctl -u ssh) : des centaines
    de « Invalid user » chaque nuit, toujours sur le port 22. fail2ban en
    bannit, mais il en revient d'autres, et on ne voit plus rien d'utile
    dans ce journal.

    Elle propose de déplacer SSH sur le port { $port } : « Ça ne protège
    de rien (nos clés et fail2ban, si), mais la plupart des robots ne
    frappent qu'au 22. Le journal redeviendra lisible. »

    D'accord, mais je me souviens du pare-feu : on avait failli
    s'enfermer dehors. Cette fois, il y a plusieurs portes à ouvrir avant
    d'en fermer une :
      - le serveur SSH lui-même (man sshd_config, Port) ;
      - le pare-feu (sudo ufw status) ;
      - ton poste, qui doit savoir où frapper (man ssh_config) ;
      - et fail2ban : sa prison sshd surveille-t-elle le bon port ?

    Rania ajoute : « ufw n'est qu'une façade. Les vraies règles, celles du
    noyau, se lisent avec sudo nft list ruleset. Ça vaut le coup d'œil. »

## Événements

port-evenement-enferme =
    ATTENTION : sshd n'écoute plus sur aucun port que le pare-feu laisse
    passer. Ta session tient (ni sshd ni ufw ne coupent les connexions en
    cours), mais la prochaine connexion échouera. Corrige AVANT de te
    déconnecter : remets l'ancien port, ou ouvre le nouveau dans ufw.
# { $port } : le nouveau port
port-evenement-deux-ports =
    Bien joué : sshd écoute sur les deux ports, 22 et { $port }, et le
    pare-feu laisse passer { $port }. C'est la manœuvre sûre : l'ancienne
    porte reste ouverte pendant qu'on essaie la nouvelle. Teste-la depuis
    ton poste, dans une autre connexion, avant de fermer quoi que ce soit.
    (sudo nft list ruleset montre la règle que ufw vient d'écrire, dans la
    chaîne ufw-user-input.)
# { $port } : le nouveau port
port-evenement-essai =
    Te voilà connecté·e par le port { $port }. La nouvelle porte marche :
    tu peux maintenant fermer l'ancienne, dans sshd et dans le pare-feu.
port-evenement-defaut =
    fail2ban a rechargé jail.local, mais sa prison sshd garde toujours le
    port 22. Un « port = 2222 » placé dans [DEFAULT] ne vaut que pour les
    prisons qui ne disent rien de leur port ; or le [sshd] de jail.conf dit
    « port = ssh », et une valeur dans la section d'une prison l'emporte
    toujours sur [DEFAULT], quel que soit le fichier (man jail.conf). Le
    réglage va dans une section [sshd] de jail.local.
port-evenement-sentinelle =
    SSH n'écoute plus que sur 2222… mais la prison sshd de fail2ban bannit
    toujours sur le port « ssh », c'est-à-dire 22 (port = ssh, dans
    jail.conf). Une adresse bannie pourrait continuer d'essayer sur 2222.
    sudo nft list ruleset le montre : dans la table f2b-table, la règle
    rejette les adresses bannies vers « tcp dport {"{"} 22 {"}"} » seulement.
port-evenement-fin =
    SSH n'écoute plus que sur le port 2222, le pare-feu ne laisse plus
    passer que lui, fail2ban le surveille, et ton poste sait où frapper.
    Le lendemain, Rania : « Trois tentatives cette nuit au lieu de quatre
    cents. Le journal est redevenu lisible. »

    Bravo ! Tu as terminé le chapitre « Le port ».

    CE QUI S'EST PASSÉ
    Changer le port de SSH ne rend pas le serveur plus sûr : un balayage
    des ports le retrouve en quelques secondes, et ce sont les clés, la
    configuration de sshd et fail2ban qui protègent. Mais les robots qui
    ne frappent qu'au 22 disparaissent du journal, et les vraies alertes
    redeviennent visibles. Le risque, lui, est réel : un port fermé trop
    tôt, et on reste dehors.

    LA BONNE PRATIQUE
    - Ouvrir avant de fermer : sshd sur les deux ports, ufw autorise le
      nouveau, on teste depuis une autre connexion, puis on ferme l'ancien.
    - Tout ce qui parle du port suit : pare-feu, fail2ban (port de la
      prison, dans une section [sshd]), ~/.ssh/config des postes, outils de
      supervision.
    - ufw et fail2ban écrivent des règles nftables : sudo nft list ruleset
      montre ce que le noyau applique vraiment.
    - Sur Ubuntu 22.10 et suivantes, SSH démarre par une socket systemd
      (ssh.socket) : après avoir changé le port, systemctl daemon-reload,
      puis systemctl restart ssh.socket.

    LA DOCUMENTATION
    - sshd_config, Port : https://man.openbsd.org/sshd_config#Port
    - ssh_config, Port : https://man.openbsd.org/ssh_config#Port
    - jail.conf (fail2ban) : https://manpages.debian.org/bookworm/fail2ban/jail.conf.5.en.html
    - ufw : https://manpages.ubuntu.com/manpages/noble/man8/ufw.8.html
