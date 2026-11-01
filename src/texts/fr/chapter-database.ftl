### Histoire « La Ludothèque », chapitre 3 « La base » : sauvegarder une base
### PostgreSQL avec pg_dump, vérifier la restauration, réparer une table. Les
### commandes, le SQL et les messages de PostgreSQL ne se traduisent pas.

chapter-database = La base
    .summary = Copier les fichiers d'une base qui tourne n'est pas une sauvegarde : pg_dump chaque nuit, une restauration de test, puis une table à remettre d'urgence.

## Fichiers

database-message-berenice =
    Un message de Bérénice :

    « Les prêts de jeux sont dans une base PostgreSQL, ludo, sur le
    serveur. Malo dit qu'elle est sauvegardée, puisque rsnapshot copie
    /var/lib/postgresql chaque nuit (son mot est à côté). Mais une amie
    informaticienne m'a dit que ce n'était pas une vraie sauvegarde.

    Tu peux faire en sorte que la base soit vraiment sauvegardée chaque
    nuit (dans /var/backups/postgresql), et vérifier qu'on saurait la
    remettre ? Surtout, sans toucher à la vraie base pendant tes essais :
    les bénévoles enregistrent des prêts toute la journée.

    Pour sudo : ludo-2027. »
database-word-malo =
    Un mot de Malo :

    « Les fichiers de la base sont dans /var/lib/postgresql/16/main, et
    rsnapshot les copie chaque nuit avec le reste. Pour parler à la base :
    psql. Le compte qui a tous les droits sur la base s'appelle postgres. »
database-crontab-root = Instantanés (rsnapshot) : weekly à 3 h le lundi, daily à 3 h 30
# Les colonnes des tables, et les quartiers des membres.
database-columns-boardgames = id,nom,exemplaires
database-columns-members = id,carte,quartier
database-columns-loans = id,jeu_id,membre_id,sorti_le,rendu_le
database-districts = nord,sud,est,ouest,centre
database-names-games = jeu de l'oie,petits chevaux,dames,mikado,dominos,memory des animaux,jeu de l'échelle,awalé,jeu de go,puissance 4,mancala,tangram,solitaire,bataille navale,jeu des sept familles

## Événements

database-event-role =
    PostgreSQL ne te connaît pas : par le socket local, on se connecte sous
    le nom de son compte (authentification « peer »), et ni vous ni root ne
    sont des rôles de cette base. Le compte postgres, lui, a tous les droits :
    sudo -u postgres (man sudo).
database-event-on-true =
    Halte ! Cette restauration visait ludo, la base en service : ses tables
    existent déjà, d'où les erreurs. Restaurer par-dessus la vraie base pour
    « essayer », c'est risquer d'écraser les prêts du jour. Une
    restauration de test se fait dans une base à part (man createdb).
database-event-test-succeeded =
    La base de test contient autant de jeux, de membres et de prêts que la
    vraie : la sauvegarde se restaure. C'est la seule façon de savoir
    qu'une sauvegarde marche. (La base de test pourra être supprimée avec
    dropdb.)
database-incident =
    14 h 05. Bérénice, affolée : « Un bénévole a cliqué sur « vider
    l'historique » dans la page d'administration… La liste des prêts est
    vide ! Les jeux et les membres sont toujours là. Tu peux remettre les
    prêts, SANS toucher au reste ? »
    (Vérifie avec psql : combien de lignes reste-t-il dans prets ? Ta
    sauvegarde de ce matin contient la table entière ; man pg_restore.)
database-event-duplicates =
    pg_restore refuse : des prêts de la sauvegarde sont déjà dans la table
    (clé en double). On ne réinjecte des données que dans une table vide, ou
    en la recréant (--clean).
database-event-cron-root =
    La tâche de la crontab de root lance pg_dump sous root, qui n'est pas un
    rôle de la base : chaque nuit, elle échouerait (role "root" does not
    exist). La crontab du compte postgres (sudo crontab -u postgres -e), ou
    sudo -u postgres devant la commande.
database-event-loans-returned =
    Les 1 873 prêts sont revenus, et rien d'autre n'a bougé. Bérénice :
    « Ouf ! »
database-event-end =
    La base est sauvegardée chaque nuit pour de vrai, la restauration a été
    vérifiée, et la table vidée par erreur est revenue en une commande.

    Bravo ! Tu as terminé le chapitre 3 de La Ludothèque, et toute l'histoire.

    CE QUI S'EST PASSÉ
    Copier les fichiers d'une base qui tourne (comme le faisait rsnapshot)
    peut donner une copie incohérente : la base écrit pendant la copie.
    pg_dump, lui, lit la base comme à un instant précis et produit une
    sauvegarde cohérente, sans l'arrêter. Une restauration dans une base de
    test a prouvé qu'elle marchait ; puis pg_restore n'a remis qu'une
    table, la seule touchée.

    LA BONNE PRATIQUE
    - Sauvegarder une base avec son outil (pg_dump, mysqldump), chaque
      nuit, puis copier l'archive avec le reste (rsnapshot, restic, hors
      ligne).
    - Le format custom (-Fc) : compressé, et on peut n'en restaurer qu'une
      partie (-t).
    - Tester la restauration régulièrement, dans une base à part.
    - Ce qui a changé depuis la dernière sauvegarde est perdu : pour moins
      perdre, archiver le journal de la base (WAL, restauration à un
      instant donné).
    - Les essais, jamais sur la base en service.

    LA DOCUMENTATION
    - Sauvegarder avec pg_dump : https://www.postgresql.org/docs/16/backup-dump.html
    - Pourquoi la copie des fichiers ne suffit pas : https://www.postgresql.org/docs/16/backup-file.html
    - pg_restore : https://www.postgresql.org/docs/16/app-pgrestore.html
