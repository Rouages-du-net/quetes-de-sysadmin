### Histoire « Le vieux Soleil », chapitre « Lire avant de toucher » : lire un
### système Solaris 10 inconnu avant d'en déménager quoi que ce soit. Les
### commandes, FMRI, chemins et sorties ne sont pas traduits.

chapter-read-first = Lire avant de toucher
    .summary = Le vieux serveur Sun de la grainothèque tourne sous Solaris 10 : trouver ce qui fait tourner le catalogue, où vivent ses données et dans quel jeu de caractères, et prendre un instantané de sécurité avant toute chose.

## Fichiers

read-first-email-inaya =
    De :  Inaya
    À :   toi

    Bonjour ! Je coordonne les bénévoles de la grainothèque. Notre
    catalogue (les variétés, les adhérent·es, qui a emprunté quoi) vit
    depuis 2009 sur le vieux serveur Sun du placard, herbier. C'est Odette
    qui l'a installé ; elle est partie à la retraite au bord de la mer et ne
    répond au téléphone que le dimanche.

    Nous avons acheté un nouveau serveur, greenhouse (Debian, beaucoup plus
    petit et beaucoup plus silencieux), et nous aimerions y déménager le
    catalogue. Mais personne n'ose toucher au Sun : ce n'est pas Linux, et
    la dernière fois que quelqu'un l'a redémarré, ça a pris tout
    l'après-midi.

    Pourrais-tu d'abord regarder comment il est fait, et le noter dans
    migration.md ? Les notes d'Odette sont dans ton dossier.

    Inaya

read-first-notes-odette =
    Notes d'Odette (2014)
    - Le catalogue = PostgreSQL + PHP. Tout est lancé par SMF.
    - Sauvegarde hebdomadaire : /export/backup/pgdata-weekly.tar (tout le
      répertoire de données, chaque dimanche soir).
    - Disques : ZFS, deux miroirs. Jamais de rm dans /var/postgres !
    - grep ne connaît pas -q ici : /usr/xpg4/bin/grep, si.

read-first-template =
    # Déménager le catalogue d'herbier

    ## Le service de la base (son nom SMF)
    (à compléter)

    ## Où vivent ses données (répertoire, jeu de données ZFS)
    (à compléter)

    ## La base (nom, version de PostgreSQL, jeu de caractères)
    (à compléter)

    ## Avant de toucher à quoi que ce soit
    (à compléter : le filet de sécurité)

## Événements

read-first-event-linux-habit =
    Introuvable : Solaris 10 n'a ni systemd ni top. Ses services sont gérés
    par SMF : svcs les liste, svcs -x explique ce qui ne va pas, svcadm les
    pilote. Et prstat joue le rôle de top (man prstat).
read-first-event-old-grep =
    Le /usr/bin/grep de Solaris date d'avant POSIX : pas de -q, pas de -E,
    pas de -r. La version POSIX est dans /usr/xpg4/bin/grep (les notes
    d'Odette le disaient). Même histoire pour sed, tar et d'autres :
    /usr/bin garde l'ancien comportement, pour les scripts des années 1990.
read-first-event-smf =
    Le voilà : svc:/application/database/postgresql_84:default_64bit,
    online. Sur Solaris, un service se nomme par un FMRI ; svcs -l et svcprop
    en disent plus. Et à côté, svc:/site/seed-catalogue:default : le
    catalogue lui-même, un manifeste écrit par Odette.
read-first-event-maintenance =
    sendmail est en maintenance depuis mars 2025 : rien à voir avec le
    catalogue, et probablement cassé depuis des années. Note-le, ne le
    répare pas maintenant : un changement à la fois, surtout sur une machine
    que personne ne connaît.
read-first-event-data-dir =
    Les données de PostgreSQL vivent dans /var/postgres/8.4/data_64
    (l'instance 64 bits). Ne jamais toucher ces fichiers à la main.
read-first-event-sparc =
    sun4u, sparcv9 : un processeur SPARC. Il écrit ses nombres avec l'octet
    de poids fort en premier (gros-boutiste, big-endian), l'inverse du x86
    de greenhouse. À garder en tête au moment de déménager les données.
read-first-event-zfs =
    /var/postgres est un jeu de données ZFS à lui seul, data/postgres, sur
    le pool « data » (deux disques en miroir). ZFS peut en prendre un
    instantané en un instant.
read-first-event-encoding =
    seeds, LATIN1 : la base a été créée en ISO 8859-1, un octet par lettre,
    comme souvent en 2009. Le PostgreSQL de greenhouse travaille en UTF-8.
    Les accents demanderont de l'attention au moment du déménagement.
read-first-event-snapshot =
    Un instantané de data/postgres : quoi qu'il arrive ensuite, les données
    telles qu'elles sont maintenant peuvent revenir en quelques secondes
    (zfs rollback). Il ne prend presque pas de place : ZFS ne garde que les
    blocs qui changeront ensuite.
read-first-event-end =
    Inaya : « J'ai lu tes notes. Pour la première fois, je comprends ce
    qu'il y a dans ce placard ! »

    Bravo ! Tu as terminé le chapitre « Lire avant de toucher ».

    CE QUI S'EST PASSÉ
    Tu as lu un système inconnu sans rien y changer, avec ses propres
    outils : SMF pour les services, ZFS pour les disques, psql pour la base.
    migration.md dit maintenant ce qui fait tourner le catalogue, où vivent
    ses données et dans quel jeu de caractères ; et un instantané ZFS garde
    les données d'aujourd'hui à portée de main.

    BONNE PRATIQUE
    - Sur un système qu'on ne connaît pas, lire avant d'agir : ses
      services, ses disques, ses versions, et ce qui est déjà cassé
      (svcs -x).
    - Noter au fur et à mesure : les notes servent à toi, et à qui viendra
      après.
    - Prendre un filet de sécurité avant le premier changement : un
      instantané, une sauvegarde qu'on sait restaurer.
    - Utiliser les outils du système plutôt que lui imposer ses habitudes :
      svcs plutôt que ps | grep, /usr/xpg4/bin quand il faut le
      comportement POSIX.

    UNE AUTRE FAÇON DE FAIRE
    Un inventaire complet listerait aussi les tâches cron (crontab -l pour
    chaque compte), la configuration réseau (ifconfig -a, /etc/hosts) et les
    paquets (pkginfo). Sur Solaris 11, la même chose se fait avec le
    système de paquets IPS (pkg list) et ipadm.

    DOCUMENTATION
    - svcs(1) : https://docs.oracle.com/cd/E26505_01/html/816-5165/svcs-1.html
    - zfs(1M) : https://docs.oracle.com/cd/E26505_01/html/816-5166/zfs-1m.html
    - PostgreSQL 8.4, les jeux de caractères : https://www.postgresql.org/docs/8.4/multibyte.html
