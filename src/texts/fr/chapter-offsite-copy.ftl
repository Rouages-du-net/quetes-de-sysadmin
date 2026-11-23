### Histoire « La Troupe de danse », chapitre « La Copie hors site » : la
### sauvegarde nocturne rclone vers Garage échoue depuis une coupure de
### courant. Commandes, options, chemins et sorties : non traduits.

chapter-offsite-copy = La Copie hors site
    .summary = Chaque nuit, le partage du bureau est copié vers le stockage objet de la troupe, et chaque nuit depuis la coupure de courant, la copie échoue. Trouve pourquoi, une erreur après l'autre, rends la copie sûre, et ramène le rapport de la trésorière depuis la dernière bonne copie.

## Fichiers

offsite-copy-message-linh =
    De : Linh
    Lundi 12 avril, 8 h 50

    Salut ! Mauvaise nouvelle : la sauvegarde du bureau ne marche plus
    depuis la coupure de courant du samedi 3 avril. Je ne l'ai vu qu'hier.

    J'ai essayé deux ou trois choses dimanche, désolé·e si j'ai aggravé
    les choses :
    - un forum disait que « Date is too old » venait de la région, alors
      j'ai mis region = us-east-1 dans /etc/rclone/office.conf, comme dans
      leur exemple ;
    - et j'ai retiré l'écriture à la clé office-backup sur le bucket backups
      (sudo garage bucket deny --write…), pour que rien ne puisse effacer
      nos sauvegardes tant que c'est cassé.

    Le script est /usr/local/bin/office-backup, lancé chaque nuit par
    office-backup.timer. Anahera a un souci aussi, lis son message.

    Linh

offsite-copy-message-anahera =
    De : Anahera (trésorière)
    Samedi 10 avril

    J'ai fait une bêtise : j'ai enregistré le modèle vide par-dessus notre
    rapport pour le conseil des arts,
    /srv/office/grants/arts-council-report-2031.txt, et il est à rendre
    jeudi. La sauvegarde du bureau doit avoir le bon, d'avant la coupure.
    Tu peux le récupérer ? Et ne perds pas les nouveaux fichiers non plus,
    s'il te plaît (l'ordre de passage du gala, les nouveaux inscrits).

    Anahera

offsite-copy-notes-teodora =
    Notes de Teodora (coulisses, la sauvegarde du bureau)

    - /usr/local/bin/office-backup lance rclone sync de /srv/office vers
      garage:backups/office. sync rend la destination identique à la
      source : il copie ce qui a changé, et supprime ce qui n'est plus dans
      la source. Sa configuration : /etc/rclone/office.conf (sudo).
    - Le minuteur lance office-backup.service chaque nuit à 2 h 30 ; sa
      sortie va dans le journal : journalctl -u office-backup.
    - Pour regarder la copie : sudo rclone --config /etc/rclone/office.conf
      ls garage:backups/office (ou lsl, avec les dates).
    - Garage vérifie la date de chaque requête, et sa région s'appelle
      « garage » (s3_region dans /etc/garage.toml).
    - À faire : un essai à blanc avant de changer le script (le -n de
      rclone), et un rclone check de temps en temps.

## Événements

offsite-copy-event-failing =
    Garage refuse les requêtes de la sauvegarde : « Date is too old ».
    Chaque requête S3 porte la date à laquelle elle a été signée, prise à
    l'horloge de la machine. Garage refuse une requête datée de plus de 24
    heures avant sa propre horloge (Amazon S3 tolère 15 minutes :
    RequestTimeTooSkewed). Quelle heure coulisses croit-elle qu'il est ?

offsite-copy-event-clock =
    L'horloge est de nouveau juste : coulisses suit NTP. Garage acceptera
    maintenant la date des requêtes ; relance la sauvegarde (sans rien
    changer d'autre pour l'instant) et lis l'erreur suivante.

offsite-copy-event-region =
    La région est revenue à celle de Garage, « garage ». La région fait
    partie de la portée de la signature (date/région/s3/aws4_request) : avec
    une autre région, Garage répond AuthorizationHeaderMalformed et donne la
    portée qu'il attendait.

offsite-copy-event-insecure =
    Couper la vérification des certificats n'aide pas ici : les erreurs
    viennent de Garage, qui a répondu, par une connexion TLS qui marchait.
    Et cela laisse n'importe qui entre coulisses et vault se faire passer
    pour le stockage et lire les sauvegardes. Garde la vérification des
    certificats.

offsite-copy-event-write =
    office-backup peut de nouveau écrire dans backups. Les droits de Garage
    sont read, write et owner, par bucket : il n'existe pas d'« écrire mais
    jamais supprimer », donc retirer write ne fait qu'arrêter la sauvegarde.
    Ce qui protège les anciennes copies d'un mauvais sync, c'est de garder
    ce qu'il remplace et supprime.

offsite-copy-event-wrong-way =
    Des fichiers nouveaux du partage ont disparu : un sync rend sa
    destination identique à sa source, et ici la destination était
    /srv/office. Le bucket n'avait que la copie du 2 avril, donc les
    fichiers écrits depuis ont été supprimés sur coulisses. Sur un vrai
    serveur, ils seraient perdus ; ici, recommence le chapitre (ou utilise
    le point de restauration), et lance d'abord un sync avec --dry-run.

offsite-copy-event-overwritten =
    Le bon rapport a disparu partout : le sync a remplacé la copie du
    bucket par le modèle, et rien n'a gardé l'ancienne. Sur un vrai serveur,
    il serait perdu ; ici, recommence le chapitre (ou utilise le point de
    restauration). Avant de synchroniser, restaure le rapport, ou dis à
    rclone où garder ce qu'il remplace (le manuel de rclone : --backup-dir).

offsite-copy-event-restored =
    Le rapport est de retour dans /srv/office avec ses chiffres de 2031 :
    Anahera peut l'envoyer.

offsite-copy-event-safe =
    Le script garde maintenant ce qu'il détruirait : avec --backup-dir,
    chaque fichier que sync remplace ou supprime dans garage:backups/office
    est déplacé dans ce dossier au lieu d'être perdu. Un dossier daté sépare
    les changements de chaque nuit.

offsite-copy-event-dry-run =
    Un essai à blanc : rclone dit ce qu'il copierait, remplacerait et
    supprimerait, et ne touche à rien. Relis deux fois les suppressions
    avant de le lancer pour de vrai.

offsite-copy-event-synced =
    Le office/ du bucket est de nouveau identique au partage, nouveaux
    fichiers compris.

offsite-copy-event-checked =
    rclone check a comparé les deux côtés fichier par fichier (tailles et
    MD5) : aucune différence.

offsite-copy-event-end =
    Linh : « La sauvegarde est repassée au vert, et Anahera a envoyé son
    rapport. Je laisserai les clés tranquilles la prochaine fois ! »

    Bravo ! Tu as terminé La Copie hors site.

    CE QUI S'EST PASSÉ
    Après la coupure de courant, l'horloge de coulisses avait trois jours de
    retard et NTP était coupé. Chaque requête S3 est signée avec sa date :
    Garage refuse une requête datée de plus de 24 heures avant sa propre
    horloge (« Date is too old »), et le rclone sync de la nuit échouait
    depuis. Puis deux changements bien intentionnés ont ajouté leurs propres
    erreurs : une région qui n'est pas celle de Garage (la portée de la
    signature ne correspondait pas) et une clé sans écriture
    (AccessDenied). Tu as réparé l'horloge, la région et la clé, ramené le
    rapport depuis la dernière bonne copie, et fait garder au sync ce qu'il
    remplace ou supprime.

    BONNE PRATIQUE
    - Lire l'erreur, corriger une cause à la fois, réessayer : chaque
      correction a montré l'erreur suivante.
    - Garder les horloges synchronisées (NTP) : signatures, certificats et
      journaux en dépendent.
    - rclone sync supprime : le lancer d'abord avec --dry-run, vérifier le
      sens (la source, puis la destination), et lui donner --backup-dir sur
      le même bucket, hors de la destination, pour qu'une erreur se
      rattrape.
    - rclone check après une sauvegarde, et une restauration de temps en
      temps : une copie que personne n'a relue est un espoir, pas une
      sauvegarde.
    - Une tâche de nuit en échec doit se voir : un échec de minuteur dans
      le journal n'aide personne si personne ne regarde (OnFailure= avec
      une notification, ou une supervision).

    UNE AUTRE FAÇON DE FAIRE
    Garage n'a ni versionnage ni verrouillage d'objets : le bucket ne peut
    pas garder lui-même les anciennes versions. Une règle de cycle de vie
    (Garage gère Expiration) peut nettoyer les dossiers de --backup-dir
    après quelques mois. Pour un historique et de la déduplication, restic
    ou Borg peuvent ranger des instantanés chiffrés dans un bucket ; comme
    aucune clé Garage ne peut écrire sans pouvoir supprimer, garder une
    deuxième copie là où la clé de la sauvegarde n'a pas accès.

    DOCUMENTATION
    - rclone sync : https://rclone.org/commands/rclone_sync/
    - --backup-dir : https://rclone.org/docs/#backup-dir-dir
    - rclone check : https://rclone.org/commands/rclone_check/
    - rclone et S3 : https://rclone.org/s3/
    - Garage avec rclone et l'outil AWS : https://garagehq.deuxfleurs.fr/documentation/connect/cli/
    - Les règles de cycle de vie de Garage : https://garagehq.deuxfleurs.fr/documentation/reference-manual/s3-compatibility/
