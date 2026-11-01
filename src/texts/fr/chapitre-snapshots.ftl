### Histoire « La Ludothèque », chapitre 2 « Les instantanés » : rsnapshot,
### liens physiques, rotation quotidienne et hebdomadaire, cron. Les
### commandes, chemins, directives et messages de rsnapshot ne se traduisent pas.

chapter-snapshots = Les instantanés
    .resume = Pouvoir revenir à n'importe quel jour des deux dernières semaines : rsnapshot, ses tabulations, ses liens physiques, et cron.

## Fichiers

snapshots-message-berenice =
    Un message de Bérénice :

    « Après l'attaque, Malo voudrait qu'on puisse revenir à n'importe quel
    jour des deux dernières semaines, sans brancher le disque USB à chaque
    fois. Il a installé rsnapshot ; sa configuration est encore celle livrée
    par Debian (/etc/rsnapshot.conf).

    Ce qu'il faut :
      - sauvegarder /srv/partage/ ;
      - sur le second disque du serveur, monté sur /mnt/instantanes
        (pas sur le disque du système !) ;
      - garder 7 instantanés quotidiens et 4 hebdomadaires ;
      - que ça tourne tout seul, chaque nuit et chaque semaine.

    Malo a laissé un conseil : « rsnapshot configtest avant tout, et
    attention aux tabulations ». Pour sudo : ludo-2027. »
# { $numero } : le numéro du jeu ajouté
snapshots-line-inventory = jeu offert n°{ $numero };1;neuf
snapshots-inventory-old =
    jeu;exemplaires;etat
    jeu de l'oie;3;bon
    petits chevaux;2;bon

## Événements

# { $mails } : le nombre de courriels envoyés par cron
snapshots-two-weeks =
    Deux semaines passent. Chaque jour, Bérénice ajoute à l'inventaire les
    jeux offerts ; chaque nuit, cron lance ce qui est prévu. Regarde ce
    qu'il y a maintenant dans /mnt/instantanes (et le courrier de cron :
    { $mails ->
        [0] aucun message, tout s'est bien passé)
        [one] un message ; « nothing to copy » est normal les premiers jours,
            tant qu'il n'y a pas assez d'instantanés quotidiens)
       *[other] { $mails } messages ; « nothing to copy » est normal les
            premiers jours, tant qu'il n'y a pas assez d'instantanés quotidiens)
    }.
snapshots-event-spaces =
    rsnapshot refuse sa configuration : dans /etc/rsnapshot.conf, les
    éléments d'une ligne sont séparés par des TABULATIONS, jamais par des
    espaces (même si ça se ressemble à l'écran). Dans nano, la touche Tab
    écrit une tabulation.
snapshots-event-same-disk =
    Les instantanés sont rangés sur le disque du système, à côté des
    données : si ce disque lâche, tout part avec. Malo voulait le second
    disque, /mnt/instantanes (snapshot_root).
# { $exemple } : le début d'un courriel de cron
snapshots-event-mails =
    cron a envoyé du courrier : ses tâches ont écrit des erreurs. Par
    exemple :

    { $exemple }

    Une tâche de la crontab d'un compte ordinaire n'a pas les droits de
    root ; celle de root, si (sudo crontab -e).
snapshots-event-links =
    Le premier instantané pèse tout son poids, les suivants presque rien :
    les fichiers qui n'ont pas changé ne sont pas recopiés, mais liés. ls
    -i montre le même numéro d'inode pour le même fichier dans deux
    instantanés : un seul fichier, deux noms. Chaque instantané paraît
    pourtant complet.
snapshots-event-error-berenice =
    Les instantanés tournent : sept quotidiens, et le premier hebdomadaire.
    Et justement, Bérénice : « Oups… Hier soir, j'ai remplacé l'inventaire
    par une vieille copie qui traînait sur ma clé : tous les jeux offerts
    ont disparu ! Tu peux le remettre comme avant-hier ? »
    (L'instantané de cette nuit a déjà la mauvaise version : regarde les
    précédents, diff t'aidera.)
snapshots-event-wrong-version =
    L'inventaire du partage est toujours l'ancienne copie : l'instantané le
    plus récent (.0) a été pris APRÈS l'erreur de Bérénice. Il faut celui
    de la nuit d'avant.
snapshots-event-end =
    L'inventaire est revenu, avec tous les jeux offerts. Bérénice : « Et
    chaque jour des deux dernières semaines est là, sans que le disque
    soit plein ! »

    Bravo ! Tu as terminé le chapitre 2 de La Ludothèque. (La suite t'attend :
    ssh ludotheque.)

    CE QUI S'EST PASSÉ
    Chaque nuit, rsnapshot a fait tourner les instantanés quotidiens :
    l'ancien .0 devient .1, et ainsi de suite ; le plus vieux est supprimé.
    Le nouveau .0 est une copie de .1 par liens physiques, que rsync met à
    jour : seuls les fichiers modifiés prennent de la place. Une fois par
    semaine, le plus vieux quotidien devient un hebdomadaire. Pour réparer
    l'erreur de Bérénice, il suffisait de recopier le fichier depuis
    l'instantané d'avant l'erreur.

    LA BONNE PRATIQUE
    - Des instantanés sur un autre disque (et une copie hors ligne en plus :
      un instantané sur la même machine ne protège pas de tout).
    - configtest après chaque modification ; des tabulations, pas des
      espaces.
    - Le niveau le plus rare lancé un peu avant le plus fréquent, dans la
      crontab de root.
    - Lire le courrier de cron : c'est là qu'arrivent les erreurs.
    - S'exercer à restaurer un fichier, avant d'en avoir besoin.

    UNE AUTRE VOIE
    restic (« Les versions », Les Archives) ou borg : déduplication (un
    fichier modifié ne recopie que ses morceaux), chiffrement, dépôt
    distant (sftp, stockage objet) ; mais on restaure avec l'outil (restic
    restore), pas avec cp. rsnapshot : de simples dossiers qu'on lit avec
    ls, mais ni chiffrement ni déduplication fine, et il faut un système
    de fichiers qui gère les liens physiques.

    LA DOCUMENTATION
    - rsnapshot : https://rsnapshot.org/rsnapshot/docs/docs.html
    - rsnapshot(1) : https://manpages.debian.org/bookworm/rsnapshot/rsnapshot.1.en.html
    - Liens physiques (ln) : https://www.gnu.org/software/coreutils/manual/html_node/ln-invocation.html
