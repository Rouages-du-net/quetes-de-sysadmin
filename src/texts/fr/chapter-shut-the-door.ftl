### Histoire « Les Lettres du quartier », chapitre « Fermer la porte » :
### durcir SSH sur un serveur neuf attaqué par force brute. Les mots-clés de
### sshd_config (PermitRootLogin…), les commandes, les chemins et les
### messages d'OpenSSH (en anglais) ne se traduisent pas.

chapter-shut-the-door = Fermer la porte
    .summary = Durcir SSH : sshd_config, sshd -t, reload, et ne pas s'enfermer dehors.

## Fichiers

door-email-kofi =
    De :     Kofi (La Fourmilière)
    À :      toi
    Objet :  Le nouveau serveur des Lettres

    Grâce à toi, le site des Lettres du quartier remarche ! Du coup,
    l'association a loué un petit serveur rien que pour lui. L'hébergeur l'a
    installé hier soir et t'a créé un compte (vous), avec ta clé SSH : c'est
    comme ça que tu viens d'entrer.

    Mais une amie m'a dit qu'un serveur neuf se fait attaquer dans l'heure.
    Peux-tu regarder qui frappe à la porte (le journal du service ssh) et la
    fermer comme il faut ?

    1. Plus personne ne doit pouvoir se connecter directement en root.
    2. Plus de mots de passe du tout pour SSH : seulement des clés.
    3. Et surtout, vérifie que TOI, tu peux toujours entrer !

    La configuration du serveur SSH est dans /etc/ssh/sshd_config
    (man sshd_config). Pour sudo, ton mot de passe est : fourmis-2026
    (oui, il en faut encore un pour sudo, même sans mots de passe pour SSH).

## Événements

# { $config } : le chemin du fichier de configuration
door-event-error =
    Il y a une erreur dans la configuration de SSH ! Avant de recharger, vérifie
    toujours avec  sudo sshd -t : il donne le fichier et la ligne en cause.

    (Bonne nouvelle : tant que la configuration est fausse, systemctl reload
    ssh refuse de l'appliquer et sshd garde l'ancienne. Tu ne t'enfermeras pas
    dehors à cause d'une faute de frappe.)
door-event-locked-out =
    ATTENTION : avec la configuration que sshd vient de charger, une nouvelle
    connexion de ton compte serait refusée. Ta session actuelle, elle, reste
    ouverte : sshd ne coupe jamais les sessions en cours.

    C'est le moment de corriger, AVANT de te déconnecter. C'est pour ça qu'on
    garde toujours une session ouverte quand on modifie la configuration de
    SSH.
door-event-without-effect =
    Étrange : tu as écrit PasswordAuthentication no et rechargé ssh… mais les
    mots de passe sont toujours acceptés. Demande à sshd ce qu'il applique
    vraiment :

      sudo sshd -T | grep -i password

    Puis relis le début de /etc/ssh/sshd_config, et man sshd_config : pour
    chaque mot-clé, quelle valeur l'emporte quand il apparaît deux fois ?
door-event-closed =
    sshd applique ta nouvelle configuration : plus de root, plus de mots de
    passe. Dans le journal (journalctl -u ssh), les robots se font maintenant
    éconduire avant même d'essayer un mot de passe (« [preauth] »).

    Reste le plus important : vérifier que TU peux toujours entrer. Sur un
    vrai serveur, on garde cette session ouverte et on en ouvre une deuxième
    pour tester. Ici : exit, puis ssh lettres.
door-event-end =
    Tu es entré·e avec ta clé : la porte est fermée aux robots, mais pas à toi.
    Kofi : « Merci ! Je dormirai mieux. »

    Bravo ! Tu as terminé le chapitre « Fermer la porte ».

    CE QUI S'EST PASSÉ
    Un serveur exposé sur internet reçoit des tentatives de connexion en
    quelques minutes : des robots essaient root et des noms courants (admin,
    test, ubuntu) avec des mots de passe faibles. En n'acceptant plus que des
    clés, et jamais root en direct, on leur ferme la porte : une clé ne se
    devine pas.

    LA BONNE PRATIQUE
    - PermitRootLogin no et PasswordAuthentication no ; on devient root avec
      sudo, depuis son propre compte.
    - Toujours sudo sshd -t avant de recharger, et sudo sshd -T pour voir ce
      qui est vraiment appliqué.
    - Attention aux fichiers inclus (Include) : pour chaque mot-clé, la
      PREMIÈRE valeur lue l'emporte.
    - Garder une session ouverte pendant les changements, et tester avec une
      nouvelle connexion avant de la fermer.
    - Pour aller plus loin : bannir les robots insistants (fail2ban) et
      filtrer les ports (pare-feu), dans les prochains chapitres.

    LA DOCUMENTATION
    - sshd_config : https://man.openbsd.org/sshd_config
    - sshd : https://man.openbsd.org/sshd
