### Histoire « Le Labo », chapitre 4 « Le redémarrage qui coince » : le mode
### secours, /etc/fstab par UUID, nofail, findmnt --verify, mount -a,
### systemctl daemon-reload. Les commandes, options, chemins et sorties ne se
### traduisent pas.

chapitre-stuck-boot = Le redémarrage qui coince
    .resume = Le serveur ne redémarre plus : il attend un disque qui a changé de nom. Comprendre le mode secours, désigner le disque par son UUID, vérifier fstab avant de reprendre le démarrage.

## Fichiers

# La ligne ajoutée par Théo dans /etc/fstab (un commentaire)
stuck-boot-fstab-commentaire = # Disque USB des numérisations (Théo, d'après un tuto suivi sur mon portable)
# { $banniere } : le message du mode secours, en anglais comme sur la vraie console
stuck-boot-message-d-odile =
    Un message d'Odile (mardi 25 janvier, 7 h 50) :

    « Le site ne répond plus depuis cette nuit ! L'hébergeur dit que le
    serveur a redémarré pour une mise à jour (un nouveau noyau), et qu'il
    “s'est arrêté en mode secours”. Il nous a ouvert sa console : c'est
    comme si on était devant l'écran du serveur, en root. Voilà ce qui y
    est écrit :

    { $banniere }

    Théo a branché la semaine dernière son disque USB, celui des
    numérisations des vieux négatifs, et il l'a ajouté “pour qu'il se
    monte tout seul”. Il l'emporte parfois au club pour scanner. Ça a un
    rapport ? »

## Événements

stuck-boot-evenement-journal =
    systemd a attendu /dev/sdc1 pendant 90 secondes, puis il a abandonné :
    sans lui, /srv/scans ne peut pas être monté, et local-fs.target (tous
    les systèmes de fichiers locaux) échoue. La machine s'arrête alors en
    mode secours, sans lancer ses services. Mais qui est sdc aujourd'hui ?
    (lsblk -f, blkid)
stuck-boot-evenement-disques =
    sdc est l'un des deux disques de 4 To, entré dans md2 au chapitre
    précédent : il n'a même plus de partition. Le disque USB de Théo
    s'appelle maintenant sde (RM = 1 : amovible), et sa partition porte
    l'étiquette SCANS. Les noms sdX suivent l'ordre où le noyau trouve les
    disques ; l'UUID, lui, ne change pas.
stuck-boot-evenement-nom =
    /dev/sde1 marcherait aujourd'hui… jusqu'au prochain disque ajouté, ou
    au prochain redémarrage où le disque USB est trouvé avant un autre.
    Comme les deux premières lignes de fstab, désigne-le par ce qui ne
    change pas : UUID=… (ou LABEL=…).
stuck-boot-evenement-supprimee =
    Sans sa ligne dans fstab, le serveur démarrerait… mais les scans de
    Théo ne seraient plus jamais montés. Il faut garder la ligne, et la
    corriger.
stuck-boot-evenement-lecture =
    fstab a maintenant une ligne illisible (il en faut au moins quatre
    champs : source, point de montage, type, options) : mount -a la
    signale, et le démarrage l'ignorerait. Relis le fichier.
stuck-boot-evenement-sans-nofail =
    L'UUID est le bon. Mais Théo emporte parfois le disque : ce jour-là,
    le serveur s'arrêterait de nouveau en mode secours. L'option nofail
    (man fstab) dit à systemd de continuer sans lui.
stuck-boot-evenement-corrige =
    fstab est juste : le disque des scans par son UUID, avec nofail. Avant
    de reprendre le démarrage, vérifie-le (findmnt --verify), essaie-le
    (mount -a), et fais-le relire à systemd : il a tiré ses unités de
    montage de l'ancienne version (systemctl daemon-reload).
stuck-boot-evenement-rechute =
    Le démarrage a repris… et s'est de nouveau arrêté en mode secours :
    systemd attend toujours un disque introuvable. Il faut d'abord
    corriger fstab.
stuck-boot-evenement-rechute-reload =
    Le démarrage a repris… et s'est de nouveau arrêté en mode secours :
    fstab est juste, mais systemd utilise encore l'ancienne version, celle
    qu'il a lue au démarrage. systemctl daemon-reload la lui fait relire.
stuck-boot-evenement-monte =
    Le disque des scans est monté sur /srv/scans (df -h, findmnt). Reste à
    sortir du mode secours : reprendre le démarrage normal (man systemctl :
    default, ou exit), ou redémarrer.
stuck-boot-evenement-fin =
    Odile : « Le site est revenu ! Et Théo retrouve ses scans. Il dit
    qu'il ne recopiera plus jamais un tutoriel sans le comprendre. »

    Bravo ! Tu as terminé le chapitre 4, et l'histoire du Labo.

    CE QUI S'EST PASSÉ
    Une ligne de /etc/fstab désignait le disque USB par son nom, /dev/sdc1.
    Les deux disques de 4 To ajoutés au chapitre 3 ont pris les noms sdc
    et sdd ; le disque USB est devenu sde. Au redémarrage, systemd a attendu
    /dev/sdc1, puis il a arrêté la machine en mode secours. Tu as retrouvé
    le disque par son UUID, corrigé fstab avec nofail, vérifié, fait
    relire le fichier à systemd, et repris le démarrage.

    LA BONNE PRATIQUE
    - Dans fstab, UUID=… ou LABEL=…, jamais /dev/sdX.
    - nofail pour tout disque qui peut manquer (USB, disque externe) ;
      x-systemd.device-timeout=10s pour ne pas attendre 90 secondes.
    - Après chaque modification : findmnt --verify, mount -a, puis
      systemctl daemon-reload, avant de redémarrer.
    - Le mode secours n'est pas une panne : un shell root, le journal
      (journalctl -xb), et de quoi réparer. Avoir l'accès console de
      l'hébergeur avant d'en avoir besoin.
    - Garder une trace de ce qu'on ajoute au serveur, et pourquoi.

    LA DOCUMENTATION
    - fstab : https://man7.org/linux/man-pages/man5/fstab.5.html
    - systemd.mount (nofail, x-systemd.*) : https://www.freedesktop.org/software/systemd/man/latest/systemd.mount.html
    - findmnt : https://man7.org/linux/man-pages/man8/findmnt.8.html
    - fstab sur Debian : https://wiki.debian.org/fstab
