### Histoire « La Ludothèque », chapitre 1 « La rançon » : un rançongiciel,
### l'arrêter, retrouver une sauvegarde hors ligne et restaurer. Les
### commandes, chemins et messages de ps, mount, restic, crontab ne se
### traduisent pas. Les adresses et le portefeuille sont fictifs.

chapitre-ransom = La rançon
    .resume = Lundi matin, tous les fichiers de la ludothèque sont chiffrés : arrêter l'attaque, comprendre pourquoi la copie du NAS ne sert à rien, et restaurer depuis le disque hors ligne.

## Fichiers

ransom-message-de-berenice =
    Un message de Bérénice, présidente de la ludothèque :

    « Catastrophe ! Ce matin, plus aucun fichier du partage (/srv/partage)
    ne s'ouvre : ils finissent tous par .locked, et un message réclame de
    l'argent. On ne paiera pas.

    On a une copie de tout sur le NAS, chaque nuit (/mnt/nas). Et Malo
    fait une sauvegarde chaque dimanche sur le disque USB du tiroir,
    qu'il débranche ensuite (il est branché sur le serveur ce matin, mais
    pas monté). Le mot de passe de cette sauvegarde est dans le coffre :
      pion-cavalier-tour-27

    Je te laisse faire. Pour sudo : ludo-2027. »
ransom-note =
    VOS FICHIERS SONT CHIFFRÉS.
    Pour les récupérer, envoyez 0,5 bitcoin à l'adresse
    bc1q-exemple-adresse-fictive avant 72 heures.
    Passé ce délai, vos fichiers seront perdus.
ransom-crontab-root = Copie du partage sur le NAS, chaque nuit à 2 h 30
ransom-inventaire =
    jeu;exemplaires;etat
    jeu de l'oie;3;bon
    petits chevaux;2;bon
    dames;4;un pion manquant
    mikado;2;bon
    dominos;5;bon
    memory des animaux;2;bon
ransom-planning =
    Permanences de juin
    mercredi 14 h - 18 h : deux bénévoles
    samedi 10 h - 12 h : un·e bénévole et l'atelier règles du jeu
    samedi 14 h - 18 h : trois bénévoles (fête du jeu le 26)
ransom-affiche =
    FÊTE DU JEU — samedi 26 juin, place du marché
    Jeux en bois, tournoi de dames, coin des tout-petits.
    Gratuit, ouvert à toutes et à tous.
ransom-regles-oie =
    Le jeu de l'oie
    Chaque joueur·se lance deux dés et avance d'autant de cases.
    Une oie : on avance encore du même nombre. Le puits : on attend
    qu'un·e autre joueur·se vienne vous délivrer. Premier·e à la case 63 :
    gagné·e (il faut y tomber pile).
ransom-regles-chevaux =
    Les petits chevaux
    Il faut faire 6 pour sortir un cheval de l'écurie. On fait le tour du
    plateau, puis on monte l'escalier jusqu'au centre. Faire 6 donne un
    nouveau lancer.
ransom-regles-dames =
    Les dames
    On se déplace en diagonale, vers l'avant. On prend en sautant par-dessus
    un pion adverse ; prendre est obligatoire. Un pion qui atteint la
    dernière rangée devient une dame.

## Événements

ransom-evenement-etendue =
    Tout est chiffré, et une demande de rançon attend dans chaque dossier.
    On ne paie pas : rien ne garantit qu'on récupère quoi que ce soit, et
    ça finance l'attaque suivante. Avant de restaurer quoi que ce soit, il
    faut savoir si l'attaque est terminée : un programme tourne-t-il encore
    (ps aux) ? Et le journal de la nuit (journalctl) dit peut-être par où il
    est entré.
ransom-evenement-chiffreur-vu =
    Un programme caché dans /home/accueil/.cache, qui tourne sous le compte
    accueil et prend tout le processeur : c'est le chiffreur. Il faut
    l'arrêter (il appartient à un autre compte : man kill, et sudo). Puis
    chercher ce qui pourrait le relancer.
ransom-evenement-nas =
    Sur le NAS aussi, tout est en .locked : cette nuit à 2 h 30, la copie
    automatique (rsync --delete, dans la crontab de root) a fidèlement
    recopié les fichiers chiffrés, et effacé les bons. Une copie
    synchronisée, toujours branchée, n'est pas une sauvegarde : elle
    recopie aussi les dégâts. Reste le disque du tiroir (lsblk).
ransom-evenement-rechiffre =
    Des fichiers restaurés viennent d'être chiffrés à leur tour : le
    chiffreur tourne encore. On n'éteint pas l'incendie en remettant des
    meubles dans la maison : d'abord l'arrêter, ensuite restaurer.
ransom-evenement-cle-trop-tot =
    Attention : le disque de sauvegarde est branché alors que le chiffreur
    tourne encore. Cette fois, il n'a pas le droit d'y écrire (ses fichiers
    appartiennent à root), mais avec un autre compte, la dernière
    sauvegarde aurait pu y passer. On arrête l'attaque d'abord, et on monte
    une sauvegarde en lecture seule (mount -o ro).
# Le chiffreur relancé par la crontab du compte accueil
ransom-retour =
    Le chiffreur est revenu (ps aux) ! Quelque chose le relance à
    intervalles réguliers. Où se rangent les tâches planifiées d'un compte ?
    (man crontab)
ransom-evenement-restaure =
    Les six fichiers sont revenus, dans leur version de dimanche soir : ce
    qui a changé depuis (presque rien, cette fois) est perdu. Reste à
    nettoyer les .locked et les demandes de rançon, et à rendre le disque
    de sauvegarde hors ligne.
ransom-evenement-fin =
    Le partage est propre, l'attaque arrêtée, le compte fautif verrouillé,
    et la sauvegarde de nouveau hors ligne. Bérénice : « Et pas un centime
    versé. Malo avait raison de débrancher ce disque chaque dimanche. »

    Bravo ! Tu as terminé le chapitre 1 de La Ludothèque. (La suite t'attend :
    ssh ludotheque.)

    CE QUI S'EST PASSÉ
    Le mot de passe du compte accueil a été deviné (journalctl : trois
    échecs puis une connexion, à 3 h du matin). Un programme a chiffré tout
    ce que ce compte pouvait modifier, et s'est installé dans sa crontab
    pour revenir. La copie de nuit sur le NAS, toujours branchée, a recopié
    les dégâts. Seule la sauvegarde hors ligne, débranchée, a survécu.

    LA BONNE PRATIQUE
    - Ne pas payer ; signaler l'attaque (cybermalveillance.gouv.fr en France).
    - D'abord arrêter l'attaque : le processus, ce qui le relance
      (crontab, services), le compte utilisé (verrouillé, mot de passe
      changé).
    - Restaurer seulement ensuite, depuis une sauvegarde montée en lecture
      seule ; vérifier ; puis la remettre hors ligne.
    - La règle 3-2-1 : au moins une copie hors ligne, ou immuable. Une
      synchronisation (rsync --delete) n'est pas une sauvegarde.
    - Des mots de passe longs, pas de connexion SSH par mot de passe
      depuis internet, et fail2ban.

    LA DOCUMENTATION
    - Guide de l'ANSSI : https://cyber.gouv.fr/publications/attaques-par-rancongiciels-tous-concernes
    - Guide de la CISA (en anglais) : https://www.cisa.gov/stopransomware/ransomware-guide
    - Restaurer avec restic : https://restic.readthedocs.io/en/stable/050_restore.html
    - mount : https://man7.org/linux/man-pages/man8/mount.8.html
