### Histoire « Le Théâtre », chapitre 1 « Soir de première » :
### max_connections, pg_stat_activity, idle in transaction,
### idle_in_transaction_session_timeout. Le SQL, les chemins et les sorties
### des outils ne sont pas traduits.

chapter-too-many-clients = Soir de première
    .summary = La vente des billets de la première a ouvert à 10 h, et depuis, la billetterie affiche des erreurs : PostgreSQL refuse les nouvelles connexions. Trouve qui les tient, et fais en sorte que ça ne se reproduise pas.

## Fichiers

too-many-clients-message-camille =
    De :     Camille
    À :      toi
    Objet :  URGENT : billetterie en panne

    Bonjour,

    La vente du « Gardien du phare » (la première, le 28 février) a
    ouvert à 10 h, et depuis 10 h 05 environ la billetterie affiche
    « Désolé ! La billetterie est indisponible ». Les gens appellent le
    théâtre. Le site : curl -i http://localhost:3000/

    C'est une petite machine, alors l'an dernier on a baissé le
    max_connections de PostgreSQL à 20. Mais on n'a qu'une seule appli !

    Le mot de passe sudo : rideau-2028. L'administrateur de PostgreSQL,
    c'est le compte postgres : sudo -u postgres psql.

    Camille

## Évènements

too-many-clients-event-full =
    « remaining connection slots are reserved for roles with the
    SUPERUSER attribute » : toutes les connexions ordinaires sont prises.
    PostgreSQL garde 3 de ses max_connections pour les superutilisateurs :
    tu peux encore entrer avec sudo -u postgres psql. Qui tient les autres ?
    (man psql : pg_stat_activity)
too-many-clients-event-idle =
    « idle in transaction » : l'appli a ouvert une transaction (BEGIN,
    puis SELECT … FOR UPDATE : la place est bloquée), et attend depuis,
    sans COMMIT ni ROLLBACK. Regarde state_change : certaines depuis 10 h.
    Chaque visiteur·se qui choisit une place et part sans payer garde une
    connexion pour toujours.
too-many-clients-event-terminated =
    Des connexions ont été terminées, et la billetterie respire… un
    moment : chaque nouveau·elle visiteur·se qui choisit une place en
    bloque une autre. Les terminer à la main, ce sont les premiers
    secours. PostgreSQL peut les terminer lui-même au bout d'un délai
    (man psql : SHOW, ALTER SYSTEM ; le réglage concerne les sessions
    inactives dans une transaction).
too-many-clients-event-restart-needed =
    max_connections a changé dans le fichier, mais SHOW max_connections
    dit toujours l'ancienne valeur : ce réglage ne change qu'au
    redémarrage de PostgreSQL (« change requires restart »), qui ferme
    toutes les connexions.
too-many-clients-event-more-room =
    Plus de place : la billetterie remarche, pour l'instant. Mais la
    fuite est toujours là : chaque place abandonnée bloque une connexion,
    et les nouvelles places se rempliront pareil (et chaque connexion
    coûte de la mémoire sur une petite machine). Qu'est-ce qui termine les
    transactions abandonnées ?
too-many-clients-event-reload-needed =
    Le fichier dit idle_in_transaction_session_timeout, mais le serveur
    ne l'a pas encore lu : SHOW montre l'ancienne valeur. Celui-ci ne
    demande pas de redémarrage : sudo systemctl reload postgresql (ou
    SELECT pg_reload_conf();).
too-many-clients-event-too-long =
    Un délai est posé, mais long : une place bloquée aussi longtemps gêne
    les autres acheteur·ses, et les connexions s'accumulent quand même
    pendant le rush. Quelques minutes au plus (1min suffit largement pour
    une page de paiement).
too-many-clients-event-stopped =
    Un service est arrêté : PostgreSQL et la billetterie doivent tourner
    pour la vente (sudo systemctl start …).
too-many-clients-event-end =
    Les transactions abandonnées se terminent maintenant d'elles-mêmes :
    la billetterie retrouve ses connexions, et la vente continue.
    Camille : « Plus que sept places au rang A, et plus personne
    n'attend ! »

    Bravo ! Tu as terminé le chapitre « Soir de première ».

    CE QUI S'EST PASSÉ
    PostgreSQL accepte max_connections connexions (20 ici), et en garde
    3 pour les superutilisateurs. Quand un·e visiteur·se choisissait une
    place, l'appli ouvrait une transaction pour la bloquer (FOR UPDATE),
    et la gardait, avec sa connexion, jusqu'au paiement. Celles et ceux
    qui partaient ne payaient jamais : chacun·e laissait une connexion
    « idle in transaction ». À 10 h 05, l'appli les tenait toutes.

    LES OUTILS
    - pg_stat_activity : une ligne par connexion ; state et state_change
      disent qui attend, et depuis quand.
    - pg_terminate_backend(pid) : en termine une ; les premiers secours.
    - idle_in_transaction_session_timeout : le serveur termine toute
      session inactive dans une transaction au-delà de ce délai. Il
      s'applique au rechargement.
    - max_connections demande un redémarrage, et plus de place ne fait
      que retarder une fuite.

    BONNES PRATIQUES
    - Ne jamais garder une transaction ouverte en attendant une personne :
      bloquer une place avec une ligne et une date d'expiration, pas avec
      un verrou.
    - Poser idle_in_transaction_session_timeout (et statement_timeout) sur
      tout serveur où une appli peut oublier une transaction.
    - Les places réservées au superutilisateur sont ce qui t'a permis
      d'entrer pendant l'incident : ne donne pas le rôle superutilisateur à
      l'appli.

    DOCUMENTATION
    - Les réglages de connexion : https://www.postgresql.org/docs/16/runtime-config-connection.html
    - idle_in_transaction_session_timeout : https://www.postgresql.org/docs/16/runtime-config-client.html
    - pg_stat_activity : https://www.postgresql.org/docs/16/monitoring-stats.html
