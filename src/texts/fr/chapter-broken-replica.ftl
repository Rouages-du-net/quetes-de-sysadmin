### Histoire « Les Jardins », chapitre « Le réplica en panne » : le réplica
### s'est arrêté sur une clé en double. SHOW REPLICA STATUS, read_only,
### START/STOP REPLICA, sql_slave_skip_counter, GTID, CHECKSUM TABLE,
### mariadb-dump --single-transaction, un test de restauration. Les
### commandes, options, chemins, le SQL et les sorties ne se traduisent pas.

chapter-broken-replica = Le réplica en panne
    .summary = La copie de consultation de la base des jardins a cessé de suivre la vraie samedi soir, et personne ne l'a vu : la liste d'attente qu'Moana imprime date de deux jours, et chaque sauvegarde nocturne aussi. Réparez le réplica proprement, puis prouvez que les sauvegardes se restaurent.

## Fichiers

broken-replica-message-moana =
    De : Moana (secrétaire, association des Jardins de Greenholme)
    Lundi 2 juin, 8 h 45

    Kia ora,

    Ce matin, mon rapport de liste d'attente (celui que je fais depuis le
    serveur de consultation, rake) ne montre pas les personnes inscrites
    hier. Et je crois que c'est peut-être ma faute : samedi après-midi, j'ai
    ajouté ma voisine, Esi Boateng, à la liste d'attente depuis mon outil
    de rapports, directement sur rake. Il m'a laissée faire, alors j'ai
    pensé que c'était bon.

    Lwazi dit que rake est un « réplica » de truelle et que les
    sauvegardes nocturnes sont prises dessus aussi. J'aimerais qu'Esi
    reste sur la liste, s'il vous plaît !

    Moana

broken-replica-note-lwazi =
    Lwazi, avril 2031

    - truelle est le primaire : Plotline (sur barrow) y écrit. Son journal
      binaire va dans /var/log/mysql. rake (198.51.100.132) le réplique,
      avec les GTID, en tant que repl. Les rapports de Moana lisent rake,
      pour ne jamais ralentir le site.
    - Sur rake : sudo mariadb, puis SHOW REPLICA STATUS\G.
    - Sauvegardes : /usr/local/sbin/plots-backup sur rake, chaque nuit à
      2 h 30 (/etc/cron.d/plots-backup), dans /var/backups/mariadb. Je n'ai
      jamais essayé d'en restaurer une.
    - ssh rake depuis truelle ; sudo y marche avec votre mot de passe.

## Événements

broken-replica-event-stopped =
    Slave_IO_Running: Yes, Slave_SQL_Running: No. Le thread IO copie
    toujours ce que truelle écrit, mais le thread SQL, qui l'applique,
    s'est arrêté samedi à 18 h 12 et Seconds_Behind_Master vaut NULL.
    Last_SQL_Error dit pourquoi : une ligne que truelle a insérée dans
    plots.waitlist, id 1043, existe déjà sur rake. Comparez cette ligne sur
    les deux serveurs.
broken-replica-event-cause =
    Sur rake, la ligne 1043 de la liste d'attente est Esi, écrite à la main
    samedi à 17 h 46 ; sur truelle, 1043 est Wairimu, inscrite sur le site à
    18 h 12. Un réplica ne doit recevoir que ce que son primaire lui envoie :
    une seule écriture faite dessus suffit pour que les deux copies ne
    soient plus d'accord. Qu'est-ce qui aurait empêché l'outil de Moana d'y
    écrire ? (man mariadb : read_only.)
broken-replica-event-skipped =
    Le thread SQL repart, après l'événement fautif : la ligne de Wairimu a
    été sautée, pas appliquée. Le 1043 de rake est toujours Esi, et Wairimu
    n'existe que sur truelle. Le réplica garde maintenant une base
    différente, en silence. Comparez les tables sur les deux serveurs
    (CHECKSUM TABLE plots.waitlist; sur chacun).
broken-replica-event-skip-again =
    { $count } événements sautés maintenant. Chaque saut jette un
    changement fait par truelle : le réplica suit, mais de plus en plus loin
    de son primaire. Sauter cache une erreur, ça ne répare pas les données.
broken-replica-event-read-only =
    read_only est actif : rake refuse maintenant les écritures des comptes
    ordinaires, l'outil de Moana compris (« running with the --read-only
    option »). La réplication elle-même et les administrateur·rices (READ_ONLY
    ADMIN) peuvent toujours écrire.
broken-replica-event-read-only-kept =
    read_only est maintenant dans la configuration de rake : il sera
    toujours actif après un redémarrage.
broken-replica-event-repaired =
    Les deux threads tournent, sans erreur, Seconds_Behind_Master: 0. rake
    a rattrapé les deux jours de changements manqués.
broken-replica-event-diverged =
    Le réplica tourne, mais les sommes de contrôle diffèrent : rake n'a pas
    les mêmes lignes que truelle. La réplication ne fait qu'appliquer des
    changements ; elle ne compare ni ne corrige ce qui diffère déjà.
    Trouvez les lignes qui diffèrent, ou reconstruisez rake depuis un
    dump cohérent de truelle (mariadb-dump --single-transaction
    --master-data --gtid).
broken-replica-event-identical =
    Les mêmes sommes de contrôle sur les deux serveurs : rake est de
    nouveau une copie exacte de truelle.
broken-replica-event-jun =
    Esi est sur la liste d'attente, sur truelle, là où vont les écritures ;
    rake reçoit sa ligne comme les autres.
broken-replica-event-locking-dump =
    Sans --single-transaction, mariadb-dump a verrouillé les tables pendant
    qu'il les lisait (LOCK TABLES) : pendant tout le dump, le thread SQL de
    rake a attendu derrière lui (regardez Seconds_Behind_Master), et sur
    truelle, le site aurait attendu. Pour des tables InnoDB,
    --single-transaction lit un instantané cohérent sans rien verrouiller.
broken-replica-event-inconsistent-dump =
    Ce dump a lu chaque table à un moment différent pendant que rake
    continuait d'appliquer des changements (ni verrou, ni transaction) : une
    réservation peut y être sans son membre, une ligne de liste d'attente
    sans sa mise à jour. Il a l'air bon et se restaure sans erreur, mais ce
    n'est pas la photo d'un instant. --single-transaction en donne une.
broken-replica-event-script =
    Le script de la nuit fait maintenant son dump avec
    --single-transaction : un instantané cohérent, sans arrêter la
    réplication.
broken-replica-event-backup =
    Un dump cohérent de rake, pris pendant qu'il suivait truelle. Une
    sauvegarde ne compte qu'une fois restaurée, cela dit.
broken-replica-event-restored =
    Le dump restauré dans une autre base, avec les mêmes lignes : cette
    sauvegarde est prouvée. Supprimez la base de travail une fois fini.
broken-replica-event-end =
    Moana : « Esi et les inscrit·es d'hier sont toutes et tous sur mon rapport. Je
    n'écrirai plus sur rake, et de toute façon il ne me laisserait plus
    faire ! »

    Bravo ! Vous avez terminé Le réplica en panne.

    CE QUI S'EST PASSÉ
    Une ligne écrite à la main sur le réplica a pris un identifiant que le
    primaire a donné à quelqu'un d'autre quelques minutes plus tard ; quand
    cette ligne est arrivée, le thread SQL de rake s'est arrêté sur une clé
    en double et le réplica a pris deux jours de retard, emportant les
    sauvegardes nocturnes avec lui. Vous avez mis rake en lecture seule,
    retiré la ligne égarée et ajouté Esi sur truelle, relancé la
    réplication et vérifié que les deux serveurs ont les mêmes lignes ;
    puis vous avez rendu la sauvegarde cohérente et l'avez prouvée en la
    restaurant.

    BONNE PRATIQUE
    - Un réplica est en read_only (dans sa configuration) : les écritures
      vont au primaire seul. Surveillez Slave_SQL_Running et
      Seconds_Behind_Master, pas seulement si le serveur répond.
    - sql_slave_skip_counter jette un changement : le réplica repart mais
      diffère de son primaire. Réparez les données, ou reconstruisez le
      réplica depuis un dump cohérent avec sa position GTID.
    - Comparer plutôt qu'espérer : CHECKSUM TABLE des deux côtés
      (pt-table-checksum, ou mariadb-dump et diff, sur une grosse base).
    - mariadb-dump --single-transaction donne un instantané cohérent des
      tables InnoDB sans verrouiller ; --skip-lock-tables seul donne des
      tables lues à des moments différents.
    - Une sauvegarde se prouve par une restauration : dans une base de
      travail, puis comparer.

    DOCUMENTATION
    - SHOW REPLICA STATUS : https://mariadb.com/kb/en/show-replica-status/
    - Les identifiants de transaction globaux : https://mariadb.com/kb/en/gtid/
    - read_only : https://mariadb.com/kb/en/server-system-variables/#read_only
    - sql_slave_skip_counter : https://mariadb.com/kb/en/replication-and-binary-log-system-variables/#sql_slave_skip_counter
    - CHECKSUM TABLE : https://mariadb.com/kb/en/checksum-table/
    - mariadb-dump : https://mariadb.com/kb/en/mariadb-dump/
