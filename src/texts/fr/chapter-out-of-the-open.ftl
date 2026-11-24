### Histoire « Le Syndicat des locataires », chapitre « Hors de vue » : un
### fichier .env commité en clair, chiffré avec sops et age, son mot de
### passe changé, déchiffré au déploiement. Commandes, options, chemins,
### clés, noms de variables et sorties des outils : non traduits.

chapter-out-of-the-open = Hors de vue
    .summary = L'appli de réparations du syndicat de locataires garde le mot de passe de sa base dans un fichier .env, commité en clair, et le dépôt a passé trois jours sur une forge publique par erreur. Chiffre-le avec sops et age pour qu'il puisse rester dans git, fais-le déchiffrer au déploiement, et occupe-toi du mot de passe qui est déjà sorti.

## Partagé par les chapitres de l'histoire

tenants-union-readme =
    # Repairline

    Les locataires de Larkspur signalent les réparations (une fuite, le
    chauffage, l'humidité), et le syndicat des locataires de Larkspur les
    suit auprès du bailleur.

    - app.py : l'appli (Flask), lancée par gunicorn, le service repairline.
    - .env : ses réglages (la base de données et le courriel).
    - deploy.sh : met les réglages dans /etc/repairline/env et redémarre
      l'appli. À lancer en root sur loquet : sudo /srv/repairline/deploy.sh

    La clé age du serveur lui-même (sa clé publique, pour sops) :
    { $key }

tenants-union-commit-1 = Repairline : les locataires signalent les réparations, le syndicat les suit
tenants-union-commit-2 = Réglages du serveur, pour que deploy.sh marche
tenants-union-commit-3 = Photos des dégâts : une limite de 8 Mo
tenants-union-commit-4 = Chiffrer .env avec sops et age, changer le mot de passe de la base
tenants-union-commit-5 = Ajouter la clé age de Makoa
tenants-union-commit-6 = Réglages du relais de courriel, chiffrés

## Fichiers

out-of-the-open-message-taslima =
    De : Taslima (secrétaire du syndicat des locataires de Larkspur)
    Mardi 8 mars, 19 h 05

    Bonjour, et bienvenue dans la petite équipe technique du syndicat !

    D'abord, quelque chose de gênant. La semaine dernière, Makoa a mis un
    miroir du dépôt de Repairline sur une forge publique, code.example,
    « pour que d'autres syndicats puissent le reprendre ». Il est resté
    public trois jours avant qu'il s'en aperçoive et le supprime. Le dépôt
    contient un fichier .env avec le mot de passe de la base dedans, en
    clair, depuis janvier. N'importe qui a pu le cloner.

    Makoa dit que la solution, c'est sops et age : le .env reste dans git,
    mais chiffré, et seuls les gens (et le serveur) qui ont une clé peuvent
    le lire. Le serveur a déjà sa propre clé age, celle de root, dans
    /etc/repairline/ (sa clé publique est dans le README). J'aimerais que
    le .env soit chiffré pour le serveur et pour toi, et une règle pour que le
    prochain fichier de secrets qu'on ajoutera (le relais de courriel
    arrive) soit chiffré de la même façon. Et tout ce qu'il faut faire pour
    le mot de passe qui est sorti.

    Le code est dans /srv/repairline ; les bénévoles le clonent depuis
    /srv/git/repairline.git, alors pousse là-bas quand tu as fini. L'appli
    doit continuer de marcher : les locataires s'en servent tous les soirs.

    Merci !
    Taslima

## Événements

out-of-the-open-event-history-seen =
    Le voilà : git garde chaque version de chaque fichier. Le mot de passe
    est dans l'historique depuis le commit de Makoa du 26 janvier, et
    chaque clone du dépôt a sa propre copie de cet historique, ceux des
    visiteurs de la forge compris. Chiffrer le fichier à partir de
    maintenant protège les prochaines versions, pas les anciennes.
out-of-the-open-event-base64 =
    base64 est un encodage, pas un chiffrement : n'importe qui l'inverse
    avec base64 -d, sans aucune clé. Un secret en base64 est un secret en
    clair qui demande une commande de plus pour être lu.
out-of-the-open-event-gitignore =
    Un fichier .gitignore ne fait que tenir les fichiers non suivis hors de
    git : .env est déjà suivi, il le reste donc, et git rm --cached ne
    ferait que le retirer des prochains commits. Le mot de passe reste dans
    l'historique de toute façon, et le déploiement, qui lit .env dans le
    dépôt, perdrait ses réglages. Garde .env dans git, mais chiffré.
out-of-the-open-event-key-made =
    Tu as ta propre clé age : la partie secrète reste dans
    ~/.config/sops/age/keys.txt (là où sops la cherche, lisible par toi
    seul·e), la partie publique (age1…) est celle que tu donnes aux autres
    pour qu'ils chiffrent pour toi.
out-of-the-open-event-rule-written =
    Le fichier .sops.yaml a une règle de création : chaque fichier dont le
    chemin correspond à path_regex est chiffré pour les clés listées sous
    age, quelle que soit la personne qui lance sops. .env et le mail.env du
    relais de courriel y correspondront tous les deux.
out-of-the-open-event-wrong-recipient =
    Le fichier .env est chiffré, mais pas pour le serveur : sa clé
    ({ $key }) n'est pas parmi les destinataires, donc root sur loquet ne
    peut pas le déchiffrer au déploiement. sops ne peut déchiffrer qu'avec
    une clé pour laquelle le fichier a été chiffré. Déchiffre-le, ou
    refais-le avec les bons destinataires.
out-of-the-open-event-not-yours =
    Le fichier .env est chiffré pour le serveur, mais pas pour toi : à
    partir de maintenant, tu ne pourrais plus le lire ni le modifier
    toi-même. Ajoute ta propre clé publique aux destinataires.
out-of-the-open-event-encrypted =
    Le fichier .env est maintenant un fichier SOPS : les noms des
    variables restent lisibles (git diff reste utile), chaque valeur est un
    bloc ENC[AES256_GCM,…], et les lignes sops_ à la fin gardent la clé de
    données, chiffrée une fois pour chaque destinataire, et un MAC sur
    toutes les valeurs.
out-of-the-open-event-rotated =
    La base a un nouveau mot de passe. L'ancien ne vaut plus rien pour qui
    a copié l'historique. Tant que l'appli n'a pas le nouveau, elle
    échouera à son prochain redémarrage : le mot de passe doit arriver
    dans .env et dans les réglages déployés.
out-of-the-open-event-ciphertext-deployed =
    /etc/repairline/env contient les valeurs chiffrées : deploy.sh a
    copié .env tel quel, ENC[…] compris, et l'appli lirait ça comme son mot de
    passe. Le déploiement doit déchiffrer le fichier, avec une clé que le
    serveur possède.
out-of-the-open-event-root-without-key =
    sops a tourné en root et n'a trouvé aucune clé age : il cherche dans
    ~/.config/sops/age/keys.txt du compte qui le lance, et celui de root
    n'en a pas. La clé du serveur est dans /etc/repairline/age.key : la
    variable SOPS_AGE_KEY_FILE dit à sops où chercher (man sops).
out-of-the-open-event-app-down =
    Repairline n'a pas pu démarrer : elle n'arrive pas à se connecter à la
    base (journalctl -u repairline dit pourquoi). Le mot de passe de
    /etc/repairline/env et celui de la base doivent être les mêmes.
out-of-the-open-event-env-readable =
    /etc/repairline/env, les réglages déchiffrés, peut être lu par tous les
    comptes de loquet. Seul root en a besoin (systemd le lit avant de
    démarrer l'appli) : chmod 600.
out-of-the-open-event-deployed =
    Le déploiement a déchiffré .env avec la clé du serveur et redémarré
    l'appli, qui se connecte avec le nouveau mot de passe.
out-of-the-open-event-clear-commit =
    Le nouveau mot de passe est dans un commit, en clair : il est dans
    l'historique maintenant, comme l'ancien. Choisis-en un autre, et ne
    commite jamais .env qu'une fois chiffré.
out-of-the-open-event-committed-old =
    Le .env chiffré est commité, mais il contient toujours le mot de passe
    qui a fuité : le chiffrer ne le rend pas secret à nouveau. Change-le
    dans la base, puis dans .env.
out-of-the-open-event-committed =
    Le commit contient le .env chiffré, .sops.yaml et le nouveau
    deploy.sh. git diff et git log restent lisibles : les noms des
    variables sont en clair, seules les valeurs sont chiffrées.
out-of-the-open-event-pushed =
    origin l'a aussi : le prochain bénévole qui clone ou tire récupère le
    fichier chiffré, et la règle qui chiffrera les suivants.
out-of-the-open-event-end =
    Taslima : « L'appli marche, le mot de passe qui a fuité ne sert plus à
    rien, et je peux lire l'historique sans crainte. Merci ! »

    Bravo ! Tu as terminé Hors de vue.

    CE QUI S'EST PASSÉ
    Le mot de passe de la base était dans le dépôt, en clair, depuis
    janvier, et le dépôt a été public trois jours. Tu as créé une clé age,
    écrit .sops.yaml pour que chaque fichier .env soit chiffré pour la clé
    du serveur et la tienne, et chiffré .env avec sops. Comme l'ancien mot
    de passe était dans l'historique, et dans chaque clone, tu l'as changé
    dans PostgreSQL et dans le fichier chiffré. deploy.sh déchiffre
    maintenant .env avec la propre clé du serveur au moment du déploiement,
    et seul root peut lire le résultat.

    BONNE PRATIQUE
    - Un secret qui a été commité en clair, ne serait-ce qu'une fois, est
      compromis : change-le. Réécrire l'historique (git filter-repo) ne sert
      qu'en plus, et n'atteint pas les copies déjà faites.
    - base64 n'est pas un chiffrement, et .gitignore ne retire pas un
      fichier du suivi ni de l'historique.
    - Avec sops, chaque valeur est chiffrée avec une clé de données,
      elle-même chiffrée pour chaque destinataire (des clés publiques age) : le
      fichier .sops.yaml décide pour qui, pour chaque nouveau fichier.
    - Chiffre pour les machines qui déploient comme pour les personnes qui
      modifient : la clé privée du serveur ne le quitte jamais, la tienne ne
      te quitte jamais.
    - Déchiffre au moment du déploiement, dans un fichier que seul le
      lecteur du service peut lire.

    UNE AUTRE FAÇON DE FAIRE
    git-crypt chiffre des fichiers entiers de façon transparente dans git,
    et ansible-vault chiffre des fichiers ou des valeurs pour Ansible ; un
    gestionnaire de secrets (OpenBao, Vault) garde les secrets entièrement
    hors de git, au prix d'un service à faire tourner. sops garde la
    structure lisible et fonctionne avec age, PGP et les services de clés
    des clouds.

    DOCUMENTATION
    - SOPS : https://getsops.io/docs/
    - Chiffrer avec age : https://getsops.io/docs/#encrypting-using-age
    - Les règles de création de .sops.yaml : https://getsops.io/docs/#using-sops-yaml-conf-to-select-kms-pgp-and-age-for-new-files
    - age : https://age-encryption.org/
    - gitignore : https://git-scm.com/docs/gitignore
