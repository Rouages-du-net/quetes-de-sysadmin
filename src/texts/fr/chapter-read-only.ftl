### Histoire « Le Théâtre », chapitre 3 « Lecture seule » : les rôles,
### GRANT, les privilèges par défaut. Le SQL, les chemins et les sorties
### des outils ne sont pas traduits.

chapter-read-only = Lecture seule
    .summary = L'outil de statistiques d'Inès utilise le compte de l'appli, celui à qui appartiennent toutes les tables : la semaine dernière, elle a renommé tous les spectacles par erreur. Donne-lui un compte qui lit tout et ne change rien, y compris les tables à venir.

## Fichiers

read-only-message-camille =
    De :     Camille
    À :      toi
    Objet :  Inès et la base de données

    Bonjour,

    Inès, notre bénévole pour les chiffres, a un petit outil qui fait le
    rapport hebdomadaire des ventes (ticket-stats, un service sur le
    serveur). Je lui ai donné le compte de l'appli pour se connecter,
    parce que c'est celui que j'avais (voir /etc/ticket-stats/config.env).

    La semaine dernière, en explorant la base avec ce même compte, Inès a
    renommé tous les spectacles en « test » par erreur. J'ai restauré la
    sauvegarde de la nuit ; on a perdu deux heures de réservations.

    Tu pourrais lui faire un compte qui peut tout lire mais rien changer ?
    Et le mettre dans l'outil. Attention : j'ajoute une table des dons
    cette semaine (la migration tourne en boxoffice, comme toutes les
    migrations), et elle en aura besoin aussi dans son rapport.

    Même mot de passe sudo : rideau-2028.

    Camille

## Évènements

read-only-event-account =
    L'outil se connecte en boxoffice : le rôle de l'appli, propriétaire de
    toutes les tables. Un propriétaire peut tout faire avec ses tables :
    lire, modifier, vider, supprimer. Qui peut faire quoi ? (man psql : \du
    pour les rôles, \dp pour les privilèges de chaque table)
read-only-event-role =
    Un nouveau rôle peut lire les spectacles. Pour l'essayer sans son mot
    de passe : en superutilisateur, SET ROLE nom; puis une requête (dans
    le même -c, séparées par « ; ») : tout s'exécute avec les privilèges
    de ce rôle.
read-only-event-too-much =
    Ce rôle peut aussi modifier les données (INSERT, UPDATE, DELETE ou
    TRUNCATE sur une table) : c'est exactement ce qui ne doit plus
    arriver. Seulement GRANT SELECT, et REVOKE le reste (REVOKE ALL ON …
    FROM rôle, puis GRANT SELECT).
read-only-event-superuser =
    Un superutilisateur passe outre toutes les vérifications : il peut
    tout lire, tout modifier et tout supprimer, dans toutes les bases.
    Jamais pour un compte qui ne fait que lire (ALTER ROLE … NOSUPERUSER).
read-only-event-member =
    Un membre de boxoffice hérite de tous les droits de boxoffice, y
    compris la propriété des tables : il peut les modifier et les
    supprimer. Donne les privilèges eux-mêmes, pas le rôle du propriétaire
    (REVOKE boxoffice FROM …).
read-only-event-migration =
    Camille : « La migration est passée : il y a maintenant une table
    donations. » Elle a été créée par boxoffice, après ton GRANT. Le
    nouveau rôle peut-il la lire ?
read-only-event-donations-denied =
    Le nouveau rôle ne peut pas lire donations : GRANT … ON ALL TABLES ne
    concerne que les tables qui existent à ce moment-là. Pour les tables à
    venir, PostgreSQL a les privilèges par défaut (man psql : ALTER DEFAULT
    PRIVILEGES), donnés pour les tables que créera un rôle donné.
read-only-event-wrong-creator =
    Les privilèges par défaut s'appliquent aux tables créées par un rôle :
    sans FOR ROLE, celui qui lance la commande (postgres, ici). Les
    migrations tournent en boxoffice : ALTER DEFAULT PRIVILEGES FOR ROLE
    boxoffice IN SCHEMA public GRANT SELECT ON TABLES TO …
read-only-event-no-defaults =
    Le nouveau rôle lit donations maintenant, mais la prochaine table sera
    oubliée de la même façon. Ajoute des privilèges par défaut pour les
    tables que créera boxoffice (ALTER DEFAULT PRIVILEGES FOR ROLE
    boxoffice …).
read-only-event-tool =
    Le rôle est prêt. L'outil se connecte toujours en boxoffice : change
    son DATABASE_URL dans /etc/ticket-stats/config.env (avec le nouveau
    rôle et son mot de passe), puis redémarre-le.
read-only-event-tool-failed =
    ticket-stats n'a pas démarré : systemctl status ticket-stats et
    journalctl -u ticket-stats disent pourquoi (le rôle, son mot de passe,
    son LOGIN, ou une table qu'il ne peut pas lire).
read-only-event-end =
    Le rapport hebdomadaire tourne avec { $role } : il lit toutes les
    tables, donations comprise, et ne peut en modifier aucune. Inès :
    « Je peux explorer sans crainte maintenant ! » Camille : « Et les
    prochaines migrations ne casseront pas le rapport. »

    Bravo ! Tu as terminé le chapitre « Lecture seule ».

    CE QUI S'EST PASSÉ
    L'outil, et Inès, utilisaient boxoffice, propriétaire de toutes les
    tables. Un propriétaire peut tout faire, et PostgreSQL ne distingue
    pas une erreur d'un ordre : UPDATE shows SET title = 'test' était
    permis.

    RÔLES ET PRIVILÈGES
    - CREATE ROLE … LOGIN PASSWORD '…' : un compte qui peut se connecter.
    - GRANT SELECT ON ALL TABLES IN SCHEMA public TO … : les tables qui
      existent maintenant.
    - ALTER DEFAULT PRIVILEGES FOR ROLE boxoffice IN SCHEMA public GRANT
      SELECT ON TABLES TO … : les tables que créera boxoffice.
    - Ni superutilisateur, ni membre du rôle propriétaire : les deux
      donnent tous les droits.

    BONNES PRATIQUES
    - Un rôle par usage : l'appli, les migrations, les rapports, chaque
      personne. Le moindre privilège dont chacun a besoin.
    - Essayer un rôle avant de le confier : SET ROLE …; puis les requêtes
      qu'il fera, et une qu'il ne doit pas faire.
    - \dp et \ddp montrent qui peut faire quoi.

    DOCUMENTATION
    - Les privilèges : https://www.postgresql.org/docs/16/ddl-priv.html
    - GRANT : https://www.postgresql.org/docs/16/sql-grant.html
    - ALTER DEFAULT PRIVILEGES : https://www.postgresql.org/docs/16/sql-alterdefaultprivileges.html
