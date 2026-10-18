### Histoire « La Gazette », chapitre 5 « La migration » : une migration de
### base de données qui empêche le retour arrière. Les commandes, chemins et
### messages de journalctl, systemctl et curl ne se traduisent pas.

chapitre-migration = La migration
    .resume = La nouvelle version a migré la base : l'ancienne ne sait plus la lire. Quand le retour arrière est impossible, on répare en avant.

## Fichiers

migration-message-de-samia =
    Un message de Samia, mardi 8 h 30 :

    « Le Kiosque répond une erreur depuis ce matin ! Théo a mis la 2.0.0
    sur vert hier soir et a basculé nginx avant de partir (son mot est à
    côté). Ce matin, il a voulu revenir sur bleu… et ça ne marche pas non
    plus, alors il a tout remis sur vert.

    Il faut :
      - que le Kiosque fonctionne de nouveau ;
      - et que l'autre emplacement redevienne un vrai filet de sécurité,
        prêt à prendre le relais.

    Pour sudo : gazette-2027. »
migration-mot-de-theo =
    Un mot de Théo :

    « Désolé… J'ai lancé la 2.0.0 sur vert hier vers 23 h, /health n'était
    pas content mais j'ai basculé quand même, il était tard. Ce matin, j'ai
    essayé de remettre bleu (1.6.1) : erreur aussi. Je n'y comprends rien,
    la 1.6.1 marchait très bien avant-hier ! »
migration-notes-200 =
    Kiosque 2.0.0 — notes de version

    ATTENTION : cette version MIGRE LA BASE DE DONNÉES au démarrage
    (schéma 3 → 4 : la colonne abonnes.courriel devient abonnes.email).
    Les versions 1.x ne savent pas lire une base migrée : faites une
    sauvegarde (pg_dump) avant de démarrer la 2.0.0.

    Configuration : KIOSQUE_SMTP est remplacée par une adresse complète,
      KIOSQUE_SMTP_URL=smtp://smtp.gazette.example:587
    (dans /etc/kiosque/kiosque.env).

## Événements

migration-evenement-vert-malade =
    Vert (2.0.0) n'est pas en bonne santé : une variable de configuration
    lui manque. Ses notes de version (/srv/kiosque/versions/2.0.0/) disent
    sans doute ce qui a changé.
migration-evenement-schema =
    Bleu (1.6.1) ne sait plus lire la base : elle est au schéma 4, et la
    1.6.1 ne connaît que le 3. Qui l'a modifiée ? Le journal du service
    vert le dit (journalctl -u kiosque-vert).
migration-evenement-migration-vue =
    Voilà : au démarrage, la 2.0.0 a migré la base (la colonne courriel
    renommée en email). Une migration ne revient pas en arrière toute
    seule : la 1.6.1 ne retrouvera plus sa colonne. Le retour arrière par
    bleu est impossible ; il reste à réparer en avant : faire marcher la
    2.0.0.
migration-evenement-retour-impossible =
    nginx envoie le trafic à bleu (1.6.1)… qui répond 500 : la base a été
    migrée sous ses pieds. Changer de version de code ne suffit pas quand
    les données ont changé de forme. Remets vert, et répare-le.
migration-evenement-repare =
    Le Kiosque répond de nouveau, en 2.0.0. Mais l'autre emplacement
    tourne une version qui ne sait plus lire la base : ce n'est plus un
    filet de sécurité. Mets-le en 2.0.0 aussi, en bonne santé.
migration-evenement-fin =
    Le Kiosque marche en 2.0.0, et les deux emplacements savent lire la
    base migrée : le prochain retour arrière sera possible. Samia : « Et la
    prochaine fois, une sauvegarde de la base avant chaque migration. »

    Bravo ! Tu as terminé le chapitre 5 de La Gazette, et toute l'histoire.

    CE QUI S'EST PASSÉ
    La 2.0.0 a migré la base au démarrage, avant même de recevoir le
    moindre visiteur. Changer le lien du proxy remet l'ancien code, pas
    l'ancienne forme des données : la 1.6.1 ne pouvait plus lire la base.
    Quand le retour arrière est impossible, on répare en avant : ici, la
    variable de configuration renommée, annoncée dans les notes de version.

    LA BONNE PRATIQUE
    - Lire les notes de version ; ne jamais basculer si /health se plaint.
    - Sauvegarder la base juste avant une migration (pg_dump), et savoir
      la restaurer.
    - Des migrations compatibles avec la version précédente : étendre
      d'abord (ajouter la colonne email, écrire dans les deux), basculer,
      puis contracter (retirer courriel) une version plus tard.
    - Après une migration, mettre l'emplacement de secours à la même
      version : un filet de sécurité qui ne sait pas lire les données n'en
      est pas un.
    - Les journaux du service (journalctl -u) racontent ce qui s'est passé.

    LA DOCUMENTATION
    - Changements en parallèle (étendre, puis contracter) : https://martinfowler.com/bliki/ParallelChange.html
    - pg_dump : https://www.postgresql.org/docs/current/app-pgdump.html
    - journalctl : https://www.freedesktop.org/software/systemd/man/latest/journalctl.html
