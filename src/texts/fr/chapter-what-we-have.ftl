### Histoire « Le Refuge », chapitre « Qu'avons-nous ? » : le plan de
### reprise d'activité écrit en 2029, comparé à ce que fait vraiment tourner
### enclos (unités, minuteries, sockets, la tâche de sauvegarde), RPO et RTO
### par service, et une sauvegarde dans chaque RPO. Aussi les textes que
### partage toute l'histoire (shelter-*).
### Les commandes, options, chemins et sorties ne se traduisent pas.

chapter-what-we-have = Qu'avons-nous ?
    .summary = Les refuges pour animaux ont un plan de reprise écrit. Il était vrai en 2029. Avant que quoi que ce soit n'arrive, comparez-le à ce que le serveur fait vraiment tourner, donnez à chaque service une perte de données et une durée d'arrêt qu'il peut vraiment tenir, et vérifiez que chacun a une sauvegarde assez récente.

## Partagés par l'histoire : les données et les fichiers du monde

shelter-animal-names =
    Biscotte
    Mangue
    Poivre
    Genièvre
    Otis
    Clémentine
    Caramel
    Noisette
    Cornichon
    Nala
    Ronce
    Ziggy
    Saule
    Fudge
    Pixel
    Safran
    Haricot
    Luna
    Tofu
    Érable
    Kiwi
    Poussière
    Citrouille
    Gingembre
    Mousse
    Trèfle
    Bowie
    Cacahuète
    Chaussette
    Indigo
shelter-species =
    chien
    chat
    chat
    lapin
    chien
    cochon d'Inde
shelter-volunteer-names =
    Teuila
    Mirela
    Rahel
    Wiremu
    Oyelaran
    Bilal
    Chiamaka
    Dmitri
    Ximena
    Farida
    Gideon
    Hyun-woo
    Isolde
    Jamal
    Kalinda
    Lorenzo
    Mahsa
    Nikolai
    Odessa
    Priyanka
shelter-site-hillside = les Coteaux
shelter-site-riverbend = la Rivière
shelter-env-comment = Réglages d'Adopte (Dariusz, 2029). Lus au démarrage du service.
shelter-adopt-readme =
    Adopte : l'appli d'adoption des refuges (Flask, servie par gunicorn sur
    127.0.0.1:8000, derrière le /adopt/ de nginx).
    Ses données sont dans la base PostgreSQL « shelter » (animals,
    adoptions, volunteers). Elle a besoin de la base pour démarrer.
shelter-backup-comment = Sauvegarde nocturne d'enclos vers prairie (Dariusz, 2029) : le dump de la base, puis restic.
shelter-vetlink-comment = vetlink : récupère les fiches de la clinique vétérinaire pour nos animaux, toutes les heures (Mirela, 2031).
shelter-site-index =
    <!DOCTYPE html>
    <html lang="fr">
    <head>
    <meta charset="utf-8">
    <title>Refuges des Coteaux</title>
    </head>
    <body>
    <h1>Refuges des Coteaux</h1>
    <p>Chiens, chats et lapins qui attendent une famille, aux Coteaux et à la Rivière.</p>
    <p><a href="/adopt/">Adopter</a> · <a href="/adopt/animals">Les animaux qui vous attendent</a></p>
    </body>
    </html>
shelter-app-home =
    <!DOCTYPE html>
    <html lang="fr">
    <head><meta charset="utf-8"><title>Adopte — Refuges des Coteaux</title></head>
    <body><h1>Adopte</h1><p>Rencontrez les animaux, prenez rendez-vous, commencez une adoption.</p></body>
    </html>
shelter-app-animals =
    <!DOCTYPE html>
    <html lang="fr">
    <head><meta charset="utf-8"><title>Les animaux qui attendent — Adopte</title></head>
    <body><h1>Les animaux qui attendent</h1><p>{ $count } animaux attendent une famille.</p></body>
    </html>
shelter-plan-col-service = Service
shelter-plan-col-backup = Sauvegarde
shelter-plan-col-owner = Responsable
shelter-zone-comment = hillsideshelters.example, primaire caché sur prairie ; le serveur du registraire la sert.
shelter-drill-draft =
    #!/bin/sh
    # Exercice de restauration (brouillon de Mirela, novembre 2031). Pas encore programmé.
    set -e
    export RESTIC_REPOSITORY={ $repo }
    export RESTIC_PASSWORD_FILE=/root/.restic-drill
    restic snapshots --latest 1
    echo "$(date -Is) drill done"

shelter-plan-2029 =
    # Plan de reprise d'activité — Refuges des Coteaux

    Écrit par Dariusz, mai 2029. Tenez-le à jour, et gardez-le hors
    d'enclos : le plan doit survivre au serveur qu'il décrit.

    ## Services

    | Service | RPO | RTO | Sauvegarde | Responsable |
    |---------|-----|-----|------------|-------------|
    | Site web (nginx) | 24h | 2j | restic, chaque nuit à 02:00 | Dariusz |
    | Appli d'adoption et sa base (PostgreSQL) | 1h | 1j | pg_dump puis restic, chaque nuit à 02:00 | Dariusz |
    | Lettre d'information (phpList) | 1sem | 1sem | restic, chaque nuit à 02:00 | Dariusz |

    RPO (objectif de point de reprise) : combien de données on peut se
    permettre de perdre, le temps écoulé depuis la dernière bonne sauvegarde.
    RTO (objectif de délai de reprise) : combien de temps le service peut
    rester arrêté.
    Durées sous la forme 30min, 4h, 1j, 1sem.

    ## Sauvegardes

    La tâche nocturne d'enclos (/usr/local/sbin/shelter-backup, lancée par
    shelter-backup.timer) fait le dump de la base, puis envoie ses fichiers
    au dépôt restic de prairie (/srv/restic, par sftp). Le mot de passe de
    secours est dans une enveloppe scellée, dans le coffre de Rahel.

    ## Ordre de restauration

    À écrire.

shelter-plan-2031 =
    # Plan de reprise d'activité — Refuges des Coteaux

    Écrit par Dariusz, mai 2029 ; relu par Teuila et vous, novembre 2031.
    Tenez-le à jour, et gardez-le hors d'enclos : le plan doit survivre au
    serveur qu'il décrit.

    ## Services

    | Service | RPO | RTO | Sauvegarde | Responsable |
    |---------|-----|-----|------------|-------------|
    | Site web (nginx) | 24h | 8h | restic, chaque nuit à 02:00 | Teuila |
    | Appli d'adoption et sa base (PostgreSQL) | 24h | 8h | pg_dump puis restic, chaque nuit à 02:00 | vous |
    | Fiches vétérinaires (vetlink) | 24h | 2j | restic, chaque nuit à 02:00 | Mirela |

    ## Sauvegardes

    La tâche nocturne d'enclos fait le dump de la base (shelter.sql, avec
    son SHA-256 dans shelter.sha256 et ses nombres de lignes dans
    shelter.counts), puis envoie /etc, /var/www, /srv/adopt, /srv/vetlink et
    /var/backups au dépôt restic de prairie (/srv/restic, par sftp). Le mot
    de passe de secours est dans une enveloppe scellée, dans le coffre de
    Rahel.

    ## Ordre de restauration

    1. Une machine avec une Debian 13 neuve et restic.
    2. Les paquets dont les services ont besoin (le tableau du plan), depuis
       Debian.
    3. Le dernier instantané, restauré À CÔTÉ du nouveau système. /etc
       appartient à la nouvelle machine : ne prenez de la sauvegarde que ce
       qui est à nous (le site, l'appli, les unités), jamais ses disques,
       son identité ou ses clés.
    4. La base, recréée depuis le dump, vérifiée avec le SHA-256 et les
       nombres de lignes de la tâche avant que quoi que ce soit ne s'en serve.
    5. Démarrer dans l'ordre des dépendances : la base, l'appli, puis nginx.
    6. Tester sur la machine elle-même, avant que quiconque ne bascule quoi
       que ce soit.
    7. Basculer www (son TTL est de 300 secondes depuis novembre 2031, pour
       ça), et vérifier depuis l'extérieur.
    8. Écrire le retour d'expérience ; prévoir le prochain exercice.

## Fichiers

what-we-have-message-teuila =
    De : Teuila (coordinatrice)
    Lundi 3 novembre, 9 h 20

    Bonjour, et bienvenue aux refuges !

    Le bureau m'a posé une question simple : « si enclos mourait cette
    nuit, que ferions-nous ? ». Nous avons une réponse sur papier : le plan
    de reprise de Dariusz, /srv/drp/plan.md ici sur prairie. Mais Dariusz
    est parti sur la côte en 2030, et le plan n'a pas bougé depuis 2029.

    Pourriez-vous le rendre vrai à nouveau ? Regardez ce que fait vraiment
    tourner enclos (ssh enclos depuis ici), comparez avec le plan, et
    corrigez le tableau : une ligne par service, avec un RPO et un RTO que
    nous pouvons vraiment tenir, sa sauvegarde, et quelqu'un qui est encore
    là pour en répondre (moi, Mirela, Rahel, Wiremu, ou vous).

    Et vérifiez que chaque service du tableau a vraiment une sauvegarde
    assez récente. Le dépôt est ici sur prairie, dans /srv/restic ; la
    tâche nocturne d'enclos a le mot de passe.

    Merci !
    Teuila

## Événements

what-we-have-event-plan =
    Le tableau de Dariusz : trois services, leur RPO (combien de données on
    peut perdre) et leur RTO (combien de temps ils peuvent être arrêtés).
    Est-ce encore ce que fait tourner enclos ? Les mots du plan sont le
    point de départ, pas la réponse : regardez la machine.
what-we-have-event-paddock =
    Vous êtes sur enclos, dans la cave des Coteaux. Un inventaire part de
    ce qui tourne, pas de ce qui a été écrit : les services (systemctl
    list-units --type=service), ce qui est programmé (systemctl
    list-timers, crontab -l), ce qui écoute (ss -tlnp).
what-we-have-event-units =
    nginx, postgresql, et adopt : l'appli d'adoption dont parle le plan, un
    service à part entière (son unité est dans /etc/systemd/system). Et
    aucun phpList nulle part.
what-we-have-event-timers =
    Deux minuteries propres aux refuges : shelter-backup (la tâche
    nocturne) et vetlink-sync, toutes les heures. vetlink n'est dans aucune
    ligne du plan. systemctl cat vetlink-sync.service dit ce qu'il lance,
    et où vont ses données.
what-we-have-event-sockets =
    ssh et nginx face au réseau ; PostgreSQL (5432) et le gunicorn de
    l'appli (8000) sur 127.0.0.1 seulement, derrière nginx. Ce qui écoute
    correspond à ce qui tourne : rien de caché de ce côté.
what-we-have-event-no-phplist =
    Pas de phpList sur enclos : il a été retiré en 2030 (la lettre
    d'information est partie chez un service d'envoi). Un plan qui
    restaure ce qui n'existe plus vous fait le chercher la pire nuit de
    l'année : sa ligne s'en va.
what-we-have-event-script =
    La tâche nocturne sauvegarde /etc, /var/www, /srv/adopt et /var/backups.
    vetlink écrit ses fiches dans { $path } : il n'est pas dans la liste.
    Les fiches de Mirela ne sont dans aucune sauvegarde.
what-we-have-event-snapshots =
    Les instantanés du dépôt : un par nuit, à 2 h, gardés 14 jours et 8
    semaines. Les chemins de chacun disent ce qu'il contient ; restic ls ou
    find disent si un fichier y est. Le RPO d'un plan n'est vrai que si les
    sauvegardes sont aussi jeunes.
what-we-have-event-rpo-unmet =
    Un RPO plus court que le rythme des sauvegardes ne peut pas être tenu :
    la tâche passe une fois par nuit, donc la pire nuit on perd jusqu'à 24
    heures. Soit le RPO dit la vérité (24h), soit le calendrier change pour
    le tenir.
what-we-have-event-old-owner =
    Dariusz est encore dans le tableau. Un·e responsable, c'est la personne
    qu'on appelle à 3 h du matin, et Dariusz est parti il y a deux ans :
    Teuila, Mirela, Rahel, Wiremu, ou vous.
what-we-have-event-stale-row =
    La ligne de phpList est toujours là : le plan restaurerait un service
    qu'enclos ne fait plus tourner depuis 2030. Retirez-la.
what-we-have-event-rows =
    Le tableau est vrai : le site, l'appli et sa base, vetlink, chacun avec
    un RPO que la tâche peut tenir, un RTO, une sauvegarde, un·e
    responsable. Maintenant, les sauvegardes doivent tenir la promesse
    elles aussi.
what-we-have-event-unsaved =
    vetlink a sa ligne, avec un RPO : mais aucun instantané ne contient ses
    fiches. Le plan promet une sauvegarde qui n'existe pas encore. La ligne
    restic backup de la tâche, sur enclos, décide de ce qui y entre.
what-we-have-event-fixed =
    La tâche nocturne prend les fiches de vetlink dès cette nuit. D'ici là,
    il n'en existe toujours aucune copie : une sauvegarde maintenant (lancez
    la tâche, ou restic backup vous-même) referme le trou aujourd'hui.
what-we-have-event-saved =
    Un instantané contient les fiches de vetlink : le travail de Mirela
    survit désormais à enclos.
what-we-have-event-end =
    Teuila : « Voilà donc ce que nous avons vraiment. Je l'imprime pour le
    bureau, et j'en donne une copie à Rahel pour le coffre, avec
    l'enveloppe. »

    Bravo ! Vous avez terminé le chapitre 1 du Refuge.

    CE QUI S'EST PASSÉ
    Le plan décrivait enclos tel qu'il était en 2029. L'inventaire (les
    unités et minuteries de systemd, les sockets, la tâche) a trouvé un
    service disparu (phpList), un service absent à la fois du plan et des
    sauvegardes (vetlink), un RPO d'une heure pour une base sauvegardée une
    fois par nuit, et un responsable parti. Le tableau dit maintenant ce
    qui tourne, ce que chaque service peut perdre et combien de temps il
    peut attendre, qui en répond ; et chaque service a un instantané plus
    jeune que son RPO.

    BONNES PRATIQUES
    - Un plan se vérifie sur la machine, pas sur lui-même : ce qui tourne
      (systemctl list-units, list-timers, crontab -l), ce qui écoute
      (ss -tlnp), ce qui est sauvegardé (la tâche, restic snapshots et ls).
    - RPO et RTO sont des décisions de l'association, écrites : le rythme
      des sauvegardes doit tenir le RPO, la restauration tenir dans le RTO.
    - Chaque service a un·e responsable qui est encore là.
    - Gardez le plan hors du serveur qu'il décrit, et sur papier quelque part.
    - Chaque nouveau service (une minuterie ajoutée un après-midi) entre
      dans le plan et dans les sauvegardes le jour même.

    DOCUMENTATION
    - NIST SP 800-34 Rev. 1, Contingency Planning Guide (analyse d'impact, RPO, RTO) : https://csrc.nist.gov/pubs/sp/800/34/r1/upd1/final
    - restic, travailler avec les dépôts : https://restic.readthedocs.io/en/stable/045_working_with_repos.html
    - systemctl : https://www.freedesktop.org/software/systemd/man/latest/systemctl.html
