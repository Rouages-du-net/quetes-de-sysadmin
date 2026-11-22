### Histoire « La Chorale », chapitre « Oubliez-moi » : un choriste qui
### part demande l'effacement (article 17 du RGPD) ; les pièces comptables
### restent ; puis une purge qui tourne vraiment (un minuteur systemd) et
### des sauvegardes qui vieillissent (restic forget --prune). Les commandes,
### options, chemins et sorties ne sont pas traduits.

chapter-forget-me = Oubliez-moi
    .summary = Un ténor quitte la chorale et demande qu'on l'oublie. Effacez-le là où la loi le permet, gardez ce que la loi demande de garder, puis faites que la politique s'applique toute seule : une purge nocturne qui tourne vraiment, et des sauvegardes qui ne se souviennent pas de tout pour toujours.

## Fichiers

forget-me-message-kenji =
    De : Kenji (trésorier)
    Lundi 7 avril, 9 h 30

    Bonjour,

    Tomas Novak nous a quittés samedi, et il demande que nous effacions ses
    données (son message est dans votre dossier personnel). C'est normal.
    Une chose, de la part du trésorier : ses cotisations sont dans nos
    comptes, et les comptes doivent être gardés dix ans. La politique le dit
    aussi. Ne faites pas mentir mes livres, s'il vous plaît.

    Au passage, Amara se demande si les « 2 ans après le départ » de la
    politique ont jamais été appliqués. Ruben avait écrit un script de
    purge pour ça, je crois, et la sauvegarde hebdomadaire tourne depuis
    2029. Est-ce qu'une sauvegarde oublie quoi que ce soit ?

    Kenji

forget-me-message-tomas =
    De : Tomas Novak
    À : le bureau de la Chorale des Berges
    Dimanche 6 avril

    Bonjour,

    Comme vous le savez, je pars vivre à Lisbonne pour le travail. Ce fut
    une joie de chanter avec vous pendant ces années.

    Je souhaite que vous effaciez mes données personnelles (article 17 du
    RGPD) : mon profil, ma photo, mes présences, la lettre d'information.
    Je sais que vous devez peut-être garder certaines choses pour la
    comptabilité ; dites-moi simplement lesquelles.

    Merci à toutes et à tous, et bonne chance pour le concert de printemps !
    Tomas

## Événements

forget-me-event-found =
    Voilà Tomas, choriste 41. Il est dans plus d'une table : la table des
    choristes, les présences, les cotisations, la lettre d'information (par
    son adresse électronique). Lesquelles l'effacement atteint-il, et
    laquelle la loi demande-t-elle de garder ?
forget-me-event-payments-deleted =
    Ses cotisations ont disparu de la table des paiements : ce sont les
    pièces comptables de la chorale, que la politique (et la loi) gardent
    dix ans. L'effacement ne s'applique pas aux données qu'on a
    l'obligation de garder (RGPD, article 17, 3). Remettez-les : la
    sauvegarde de la nuit les contient
    (grep SUB-20 /var/backups/choir.sql | grep 041), et INSERT INTO
    payments VALUES (…) les reprend, une ligne par cotisation.
forget-me-event-erased =
    Tomas a disparu des choristes, des présences et de la lettre
    d'information, et ses cotisations restent dans les livres avec son nom :
    c'est ce que Kenji lui écrira. Quoi d'autre garde ses données sur le
    disque ?
forget-me-event-uploads =
    Sa photo et son formulaire de consentement ont disparu des fichiers
    envoyés.
forget-me-event-purge-broken =
    La purge de Ruben n'a jamais tourné : son minuteur n'a jamais été
    activé, et son service tourne sous www-data, qui n'a pas de rôle dans
    PostgreSQL (« role "www-data" does not exist »). Et son script dit
    « TODO attendance ». Réparez le service, le script et le minuteur (man
    systemd.timer, systemctl enable --now), ou planifiez la tâche
    autrement.
forget-me-event-purge-too-much =
    Attention : la purge, telle qu'elle tournera cette nuit, supprimerait
    des données que la politique garde (choristes actuel·les, personnes
    parties depuis moins de deux ans, présences récentes, les paiements ou
    la lettre d'information). Vérifiez ses clauses WHERE avant de laisser un
    minuteur les exécuter chaque nuit.
forget-me-event-purge-partial =
    La purge, telle qu'elle tournera, fait la moitié du travail : la
    politique limite aussi les présences aux répétitions à deux ans, et les
    fiches des ancien·nes choristes à deux ans après leur départ. Les deux
    lignes ont leur place dans la tâche.
forget-me-event-purge-idle =
    Une purge est planifiée, mais exécutée comme elle le sera, elle ne
    supprime rien : regardez ce qu'elle dit quand elle tourne (systemctl
    start, puis journalctl -u), sous quel compte elle tourne, et si ce
    compte peut atteindre la base.
forget-me-event-purge =
    Cette nuit, et chaque nuit, la purge supprimera les ancien·nes
    choristes parti·es depuis plus de deux ans et les présences de plus de
    deux ans, et rien d'autre. Maintenant les sauvegardes : que
    contiennent-elles encore ?
forget-me-event-snapshots =
    { $count } instantanés hebdomadaires, jusqu'à septembre 2029 : la
    sauvegarde n'a jamais rien oublié. Tout ce qui est effacé aujourd'hui,
    et tout ce que la purge supprime, y vit pour toujours. La politique dit
    trois mois de sauvegardes hebdomadaires (man restic : forget,
    --keep-weekly, --keep-within, --prune).
forget-me-event-too-few =
    Il reste trop peu de sauvegardes : la politique dit trois mois de
    sauvegardes hebdomadaires, pour qu'une mauvaise sauvegarde cette nuit
    puisse encore être rattrapée par une plus ancienne. Des instantanés
    oubliés et purgés ne reviennent pas : sur un vrai serveur, ils seraient
    perdus ; ici, recommencez le chapitre (ou revenez à l'instantané de
    secours) et choisissez une politique qui garde environ trois mois.
forget-me-event-no-prune =
    Les vieux instantanés sont oubliés, mais leurs données sont toujours
    dans le dépôt : forget ne retire que les instantanés, prune supprime les
    données qu'aucun instantané n'utilise plus (ou forget --prune).
forget-me-event-trimmed =
    Le dépôt contient maintenant environ trois mois de sauvegardes
    hebdomadaires, purgées. Dimanche prochain, la sauvegarde en ajoute une :
    quelque chose fera-t-il partir la plus ancienne ?
forget-me-event-script-unchanged =
    Vous avez taillé le dépôt à la main, mais le script de sauvegarde
    hebdomadaire n'oublie rien : dans un an, il y aura cinquante instantanés
    de plus. La politique a sa place dans le script
    (/usr/local/sbin/choir-backup), après la sauvegarde.
forget-me-event-script =
    La sauvegarde hebdomadaire oublie maintenant ce qui a plus de trois mois
    environ, et purge : les données effacées sortent des sauvegardes à un
    rythme connu.
forget-me-event-end =
    Kenji : « Mes livres sont intacts, Tomas a sa réponse, et Amara dit que
    la politique tourne enfin toute seule. Je dormirai mieux. »

    Bravo ! Vous avez terminé Oubliez-moi.

    CE QUI S'EST PASSÉ
    Tomas a demandé l'effacement. Vous avez supprimé sa fiche, ses
    présences, son inscription à la lettre d'information et ses fichiers, et
    gardé ses cotisations, des pièces comptables que la chorale doit
    conserver. Puis vous avez fait tourner la politique toute seule : la
    purge de Ruben n'avait jamais tourné (un minuteur jamais activé, un
    compte sans rôle dans la base, les présences oubliées), et la
    sauvegarde hebdomadaire gardait tout depuis 2029. La purge tourne
    maintenant chaque nuit, et les sauvegardes gardent environ trois mois,
    purgées.

    BONNES PRATIQUES
    - Le droit à l'effacement (RGPD, article 17) a des limites : les
      données qu'on a l'obligation légale de garder (pièces comptables)
      restent, et la réponse dit à la personne lesquelles et pourquoi.
    - Effacer partout où la personne se trouve : chaque table qui pointe
      vers elle, les fichiers, puis les copies.
    - Une purge qui n'est pas planifiée est un vœu pieux. Testez-la comme
      elle tournera (son compte, son minuteur : systemctl start,
      journalctl -u), et vérifiez qu'elle supprime ce que dit la politique,
      et rien d'autre.
    - Les sauvegardes ne se modifient pas personne par personne : elles
      doivent vieillir à un rythme connu (restic forget avec une politique,
      et prune), et si l'une d'elles est restaurée un jour, il faut
      réappliquer les effacements.
    - Garder la trace de la demande elle-même (qui, quand, ce qui a été
      fait), pas les données qu'elle a effacées.

    UNE AUTRE FAÇON
    Pseudonymiser au lieu de supprimer (remplacer le nom par un
    identifiant) garde des statistiques, mais une donnée pseudonymisée reste
    une donnée personnelle pour le RGPD (considérant 26) : elle ne compte
    comme anonyme que si personne ne peut plus la relier à la personne.

    DOCUMENTATION
    - RGPD, articles 5, 17 et considérant 26 : https://eur-lex.europa.eu/eli/reg/2016/679/oj
    - La CNIL : https://www.cnil.fr/
    - systemd.timer(5) : https://www.freedesktop.org/software/systemd/man/latest/systemd.timer.html
    - restic, supprimer des instantanés : https://restic.readthedocs.io/en/stable/060_forget.html
