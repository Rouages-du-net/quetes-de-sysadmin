### Histoire « Le Théâtre », chapitre 4 « La Bascule » : un réplica en
### flux, sa promotion, l'appli dirigée vers lui. Le SQL, les chemins et
### les sorties des outils ne sont pas traduits.

chapter-failover = La Bascule
    .summary = Le serveur principal de la base, sur une autre machine, est mort depuis l'aube, et toutes les pages de la billetterie échouent. Cette machine garde un réplica, à la seconde près. Fais-en le principal, et ramène la billetterie.

## Fichiers

failover-message-camille =
    De :     Camille
    À :      toi
    Objet :  stage est mort

    Bonjour,

    Le mois dernier, le technicien de notre hébergeur a déplacé le
    serveur principal de la base sur une deuxième machine,
    stage.internal, et a fait de celle-ci un « réplica » qui copie tout
    en temps réel. « Si stage tombe, vous basculez sur le réplica »,
    a-t-il dit. Il est parti depuis.

    L'hébergeur écrit que le disque de stage est mort à 6 h 47 ce matin,
    et qu'elle ne reviendra pas avant demain. La billetterie affiche des
    erreurs depuis, et le spectacle de ce soir commence à 20 h.

    Tu peux basculer ? Les réglages de l'appli sont dans
    /srv/boxoffice/.env.

    Même mot de passe sudo : rideau-2028.

    Camille

## Évènements

failover-event-down =
    stage.internal (192.0.2.29) ne répond pas : « No route to host ». Le
    DATABASE_URL de l'appli pointe vers elle, et le PostgreSQL de cette
    machine aussi, qui l'attend dans son journal. Qu'est-ce donc que le
    PostgreSQL de cette machine ? (man pg_lsclusters)
failover-event-standby =
    online,recovery : ce PostgreSQL est un réplica (standby). Il rejoue ce
    que son principal lui envoie (primary_conninfo dans
    postgresql.auto.conf ; standby.signal dans son répertoire de données
    le garde en récupération), et refuse toute écriture. Jusqu'où est-il
    allé avant la mort de stage ? (man psql : pg_last_xact_replay_timestamp)
failover-event-lag =
    La dernière transaction rejouée date de 06:47:14, une seconde avant la
    mort de stage : presque rien n'est perdu. Un réplica ne devient pas
    principal tout seul ; quelqu'un doit le décider (man pg_ctlcluster :
    promote).
failover-event-restarted-standby =
    Redémarré, toujours réplica : standby.signal est toujours là, et un
    redémarrage ne change pas un rôle. La promotion, si (pg_ctlcluster 16
    main promote, ou SELECT pg_promote()).
failover-event-read-only =
    L'appli parle maintenant au PostgreSQL de cette machine, mais c'est
    toujours un réplica : « cannot execute INSERT in a read-only
    transaction ». Promeus-le d'abord.
failover-event-promoted =
    Promu : ce PostgreSQL sort de la récupération, prend une nouvelle
    ligne de temps (timeline), et accepte les écritures. C'est le principal
    maintenant. Reste à y amener l'appli.
failover-event-restart-app =
    Le .env pointe vers cette machine maintenant, mais l'appli le lit à
    son démarrage : redémarre-la (sudo systemctl restart boxoffice).
failover-event-end =
    La billetterie répond de nouveau, sur la base de cette machine,
    devenue le principal. Camille : « Douze jurés en colère ce soir : plus
    que 64 places, et les gens réservent ! »

    Bravo ! Tu as terminé le chapitre « La Bascule ».

    CE QUI S'EST PASSÉ
    Le principal (stage) est mort à 06:47:15. Le réplica d'ici avait
    rejoué tout jusqu'à 06:47:14, mais un réplica est en lecture seule et
    attend son principal pour toujours : rien ne bascule tout seul. Tu
    l'as promu, puis tu y as dirigé l'appli et tu l'as redémarrée.

    LES ÉTAPES D'UNE BASCULE
    - Vérifier que le principal est vraiment parti (pg_isready -h, ping) :
      deux principaux en même temps, c'est le pire (split brain).
    - Vérifier jusqu'où le réplica est allé : pg_last_xact_replay_timestamp().
    - Promouvoir : pg_ctlcluster 16 main promote, ou SELECT pg_promote().
    - Diriger les clients vers le nouveau principal, et les redémarrer.

    ENSUITE
    - Quand stage reviendra, elle ne doit pas démarrer en principal : la
      reconstruire en réplica du nouveau principal (pg_basebackup), ou
      l'effacer.
    - D'ici là, tu n'as plus de réplica : prévois le suivant maintenant.
    - Écris la procédure, et répète-la : une bascule s'apprend un jour
      calme, pas un soir de spectacle.

    DOCUMENTATION
    - La bascule : https://www.postgresql.org/docs/16/warm-standby-failover.html
    - Les fonctions de contrôle de la récupération : https://www.postgresql.org/docs/16/functions-admin.html#FUNCTIONS-RECOVERY-CONTROL
    - pg_ctlcluster : https://manpages.debian.org/bookworm/postgresql-common/pg_ctlcluster.1.en.html
