### Histoire « La Coopérative », chapitre « Le départ » : retirer tous ses
### accès à un bénévole qui part, sans rien casser. Les commandes, les
### chemins et les noms de comptes ne se traduisent pas.

chapitre-depart = Le départ
    .resume = Marc s'en va : fermer son compte (vraiment), retirer sa clé partout, son sudo, sa session, et garder la sauvegarde qu'il faisait tourner.

## Fichiers

depart-courriel-awa =
    De :     Awa (coordinatrice de l'épicerie coopérative)
    À :      toi
    Objet :  Marc s'en va

    Comme tu le sais, Marc part s'installer à Brest à la fin de la semaine.
    C'est lui qui tenait le serveur depuis le début : merci de prendre la
    suite ! Il est d'accord pour qu'on ferme ses accès dès aujourd'hui (il a
    tout rendu, c'est juste la bonne pratique).

    Ce qu'il faut, d'après lui :
    1. que son compte ne permette plus d'entrer, d'aucune façon (il se
       connectait par clé SSH, man usermod) ;
    2. qu'il n'ait plus sudo ;
    3. sa clé est aussi sur le compte partagé deploy (celui qui sert aux
       mises en ligne) : enlève SA clé, mais pas celles des autres ;
    4. il est peut-être encore connecté (who) ;
    5. et surtout : il faisait tourner « des trucs » sous son compte. Je
       sais qu'il y a la sauvegarde de nuit de la caisse : elle doit
       continuer à tourner ! (crontab -l -u marc, en root)

    Pour sudo, ton mot de passe est : radis-2027

depart-notes-marc =
    Mes notes (Marc)

    - La caisse tourne en service (till.service), sous le compte till.
    - Mises en ligne : par le compte deploy (clés dans
      /home/deploy/.ssh/authorized_keys : la CI, Lina et moi).
    - Sauvegarde : mon script ~/bin/sauvegarde-caisse.sh, chaque nuit à
      2 h 30, dans ma crontab. À reprendre un jour proprement…

## Événements

depart-evenement-verrou-seul =
    Le mot de passe de marc est verrouillé… mais il se connectait par clé
    SSH, et usermod -L n'y change rien. Relis man usermod : pour fermer
    vraiment un compte, il faut aussi le faire expirer (ou lui retirer son
    shell de connexion, ou ses clés).
# { $fichier } : le fichier des clés du compte deploy
depart-evenement-deploy-vide =
    Attention : il manque des clés dans { $fichier } ! La CI et Lina ne
    pourront plus mettre la caisse en ligne. On ne retire que la ligne de
    Marc (sa clé finit par marc@portable). Remets les autres : nano, en
    gardant les lignes deploy@ci et lina@atelier.
depart-evenement-script-perdu =
    Le dossier de Marc a disparu, et avec lui son script de sauvegarde… et
    la sauvegarde de cette nuit ne tournera pas (cron ignore la crontab d'un
    compte supprimé).

    Heureusement, la sauvegarde d'hier contient /home : regarde dans
    /srv/sauvegardes (en root). La prochaine fois : d'abord regarder ce
    qu'un compte fait tourner, ensuite supprimer.
depart-evenement-tache-personnelle =
    La sauvegarde est dans TA crontab. Elle tourne… jusqu'au jour où, toi
    aussi, tu passeras la main : c'est exactement le piège de Marc. Une
    tâche de la coopérative va dans la crontab de root (sudo crontab -e), ou
    dans un fichier de /etc/cron.d, et son script hors d'un dossier
    personnel (par exemple /usr/local/bin).
depart-evenement-sauvegarde =
    La sauvegarde de la caisse ne dépend plus du compte de Marc : son script
    est hors de /home/marc, et c'est un compte qui reste qui la lance.
depart-evenement-ferme =
    Marc ne peut plus entrer : ni par son compte, ni par deploy, plus de
    sudo, plus de session ouverte.
depart-evenement-fin =
    Tout est fermé, rien n'est cassé. Awa : « Marc te dit merci… et
    bienvenue dans l'équipe ! »

    Bravo ! Tu as terminé le chapitre « Le départ ».

    CE QUI S'EST PASSÉ
    Fermer un compte, ce n'est pas un seul geste. usermod -L ne verrouille
    que le mot de passe : une clé SSH passe toujours. Il faut faire expirer
    le compte (usermod -e 1, ou chage -E 0), ou lui retirer son shell, ou le
    supprimer. Et les accès vivent aussi ailleurs : une clé dans un compte
    partagé, une place dans le groupe sudo, une session encore ouverte, des
    tâches planifiées dont l'équipe dépend.

    LA BONNE PRATIQUE
    - Une liste de départ : compte (expiré ou supprimé), clés (partout,
      y compris les comptes partagés), groupes (sudo !), sessions (who,
      pkill -u), crontab et services du compte.
    - Regarder ce qu'un compte fait tourner AVANT de le supprimer
      (crontab -l -u, ps -u, find / -user).
    - Les tâches de l'équipe ne vivent pas dans un compte personnel : crontab
      de root ou d'un compte de service, /etc/cron.d, timers systemd.
    - Mieux encore : une clé par personne et pas de compte partagé, pour
      savoir qui a fait quoi, et retirer un accès sans gêner les autres.

    LA DOCUMENTATION
    - usermod : https://man7.org/linux/man-pages/man8/usermod.8.html
    - userdel : https://man7.org/linux/man-pages/man8/userdel.8.html
    - chage : https://man7.org/linux/man-pages/man1/chage.1.html
