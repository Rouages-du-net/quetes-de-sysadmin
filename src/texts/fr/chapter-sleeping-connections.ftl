### Histoire « Les Jardins », chapitre « Connexions endormies » : le site
### des jardins familiaux répond « Too many connections ». Les connexions de
### MariaDB (SHOW PROCESSLIST), wait_timeout, max_connections, KILL, le
### journal des requêtes lentes, EXPLAIN, CREATE INDEX. Les commandes,
### options, chemins, le SQL et les sorties ne se traduisent pas.

chapter-sleeping-connections = Connexions endormies
    .summary = Un samedi de printemps, le site de réservation des jardins familiaux répond « Too many connections » juste quand tout le monde veut un créneau d'arrosage. Trouvez qui tient les connexions de la base, pourquoi elles ne partent jamais, et pourquoi chaque page met quarante secondes.

## Fichiers

sleeping-connections-message-halima =
    De : Halima (présidente, association des Jardins de Greenholme)
    Samedi 10 mai, 9 h 20

    Bonjour, et bienvenue à bord !

    C'est le premier samedi ensoleillé de la saison et tout le monde essaie
    de réserver un créneau d'arrosage ou le motoculteur sur
    www.greenholme.example. La moitié tombe sur une page qui dit « Too many
    connections », l'autre moitié attend sans fin. Lwazi, qui a écrit
    Plotline (notre appli de réservation), est dans un train jusqu'à ce
    soir ; il dit que c'est « la base de données » et vous a laissé un mot.

    La base vit sur truelle, là où vous êtes. sudo marche avec votre mot de
    passe. Vous pourriez regarder ? Et s'il vous plaît, ne faites pas juste
    disparaître le problème pour une heure : samedi prochain, ce sera pareil.

    Halima

sleeping-connections-note-lwazi =
    Notes de Lwazi (truelle, 2027, mises à jour au printemps dernier)

    - truelle fait tourner MariaDB (le paquet Debian, le service mariadb).
      La base s'appelle plots : members, plots, waitlist, bookings.
    - Plotline tourne sur shed (198.51.100.133) et se connecte à truelle par
      le réseau arrière, en tant que plotline.
    - En root sur truelle, sudo mariadb ouvre la base (Debian laisse entrer
      le root du système par la socket, sans mot de passe).
    - La configuration : /etc/mysql/mariadb.conf.d/50-server.cnf. Les
      journaux vont dans le journal système : journalctl -u mariadb.
    - Je sais que l'appli ne ferme pas bien ses connexions. C'est sur ma
      liste. MariaDB finit par les nettoyer, je crois ?

    Lwazi

## Événements

sleeping-connections-event-crowd =
    Regardez la colonne Command : presque toutes les connexions sont en
    Sleep. Elles viennent toutes de shed (198.51.100.133), en tant que
    plotline, et leur Time grandit sans cesse : des milliers de secondes de
    sommeil. Chacune tient une des 151 places (max_connections) ; quand
    elles sont toutes prises, le visiteur suivant reçoit « Too many
    connections » (vous n'êtes entré·e que parce que root garde une place
    de plus). Combien de temps MariaDB laisse-t-il dormir une connexion
    avant de la fermer ? (SHOW VARIABLES LIKE '%timeout%' ; man mariadb.)
sleeping-connections-event-too-big =
    Un max_connections de cette taille ne fait que reculer le mur : l'appli
    remplirait dix mille places comme elle remplit les 151, et chaque
    connexion coûte de la mémoire (des tampons, un thread) jusqu'à ce que le
    serveur en manque. La limite est un garde-fou ; ce qui ne va pas, c'est
    que rien ne ferme jamais les connexions endormies. Revenez à une valeur
    raisonnable (151 par défaut).
sleeping-connections-event-restart-only =
    Le redémarrage a fermé toutes les connexions, et le site respire de
    nouveau. Mais l'appli en ouvre trois nouvelles chaque demi-minute sans
    jamais les fermer, et wait_timeout laisse toujours chacune dormir huit
    heures : en moins d'une heure, les 151 places sont de nouveau pleines.
    Qu'est-ce qui décide combien de temps une connexion endormie peut
    rester, au prochain démarrage aussi ?
sleeping-connections-event-timeout =
    wait_timeout est plus court pour le serveur : les connexions qui
    s'ouvrent à partir de maintenant seront fermées après ce temps de
    sommeil (« Aborted connection … Got timeout reading communication
    packets » dans le journal). Et celles qui sont déjà là ?
sleeping-connections-event-old-sessions =
    { $count } connexions endormies sont toujours là, et leur Time dépasse
    votre nouvelle limite. SET GLOBAL ne change que la valeur par défaut que
    les nouvelles sessions copient en se connectant : chaque session
    existante garde le wait_timeout qu'elle a reçu, huit heures. Il faut les
    fermer (KILL id;, ou mariadb-admin kill id,id,… ; SELECT id FROM
    information_schema.PROCESSLIST WHERE … les liste).
sleeping-connections-event-cleared =
    Les vieilles connexions endormies sont parties et les nouvelles ne
    restent que quelques minutes : les places sont libres, le site répond
    de nouveau.
sleeping-connections-event-persisted =
    Le wait_timeout plus court est maintenant dans 50-server.cnf : le
    serveur le lira à chaque démarrage, pas seulement jusqu'au prochain
    redémarrage.
sleeping-connections-event-slow-log =
    Le journal des requêtes lentes est actif : chaque requête plus longue
    que long_query_time y est écrite, avec sa durée et les lignes qu'elle a
    examinées. Lisez-le (le fichier est slow_query_log_file ; SHOW VARIABLES
    LIKE 'slow_query%') : quelle requête est lente, et combien de lignes
    lit-elle pour répondre ?
sleeping-connections-event-explain =
    type ALL, key NULL, rows 1834212 : pour trouver les réservations d'une
    parcelle, MariaDB lit toute la table, chaque fois qu'un visiteur ouvre
    la page d'une parcelle, et chacune de ces connexions reste occupée
    quarante secondes. Un index sur la colonne de la clause WHERE lui permet
    d'aller droit aux bonnes lignes (man mariadb : CREATE INDEX).
sleeping-connections-event-wrong-index =
    Cet index commence par une autre colonne : pour WHERE plot_id = …,
    MariaDB ne peut pas s'en servir (EXPLAIN dit toujours type ALL). Un
    index aide les requêtes dont le WHERE (ou l'ORDER BY) commence par sa
    première colonne.
sleeping-connections-event-index =
    Avec l'index, EXPLAIN dit type ref, quelques centaines de lignes : la
    page d'une parcelle répond en quelques millisecondes au lieu de
    quarante secondes.
sleeping-connections-event-end =
    Halima : « Ça marche ! Quelqu'un a déjà réservé le motoculteur pour
    14 h. Lwazi dit qu'il corrige les connexions de l'appli ce soir, et
    vous remercie pour l'index. »

    Bravo ! Vous avez terminé Connexions endormies.

    CE QUI S'EST PASSÉ
    Plotline ouvrait des connexions à MariaDB sans jamais les fermer. Avec
    wait_timeout à sa valeur par défaut, 28800 secondes, le serveur gardait
    chacune endormie pendant huit heures, jusqu'à ce que les 151 places de
    max_connections soient toutes prises et que les visiteurs reçoivent
    « Too many connections ». En même temps, chaque page de parcelle lisait
    les 1,8 million de lignes de bookings, faute d'index sur plot_id. Vous
    avez raccourci wait_timeout pour le serveur en marche et dans sa
    configuration, fermé les sessions qui gardaient leur ancien délai,
    trouvé la requête lente et lui avez donné son index.

    BONNE PRATIQUE
    - SHOW PROCESSLIST d'abord : qui est connecté, d'où, pour faire quoi
      (Sleep, ou une requête et depuis combien de temps).
    - SET GLOBAL change le serveur en marche et seules les nouvelles
      sessions le copient ; le fichier de configuration est ce que le
      prochain démarrage lit. Faites les deux.
    - max_connections est un garde-fou : le monter cache une fuite jusqu'à
      ce que la mémoire manque. La vraie correction est dans l'appli (fermer
      ses connexions, ou un pool de connexions), et wait_timeout nettoie
      derrière elle.
    - Le journal des requêtes lentes et EXPLAIN disent quelle requête fait
      mal et pourquoi ; un index sur la colonne de la clause WHERE est
      souvent toute la réponse.
    - root garde une connexion de plus (extra_max_connections) : ne laissez
      jamais une appli se connecter avec un compte qui a ce privilège.

    DOCUMENTATION
    - Variables système du serveur (wait_timeout, max_connections) : https://mariadb.com/kb/en/server-system-variables/
    - SHOW PROCESSLIST : https://mariadb.com/kb/en/show-processlist/
    - KILL : https://mariadb.com/kb/en/kill/
    - Le journal des requêtes lentes : https://mariadb.com/kb/en/slow-query-log-overview/
    - EXPLAIN : https://mariadb.com/kb/en/explain/
    - CREATE INDEX : https://mariadb.com/kb/en/create-index/

## Ce que les trois chapitres de l'histoire partagent : rangé ici pour être chargé avec l'histoire.

allotments-plotline-readme =
    Plotline, l'appli de réservation des Jardins de Greenholme (Lwazi).
    gunicorn sur 0.0.0.0:8000, derrière le nginx du site.
    Ses réglages sont dans /srv/plotline/.env, lus au démarrage du service
    plotline : sudo systemctl restart plotline après une modification.
    Son journal : /var/log/plotline/app.log.
