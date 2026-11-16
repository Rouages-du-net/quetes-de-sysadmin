### Histoire « L'Autre Unix », chapitre « Le script qui cassait » : un script
### de sauvegarde écrit pour Debian, lancé sur FreeBSD. Les commandes,
### options, chemins et messages d'erreur ne sont pas traduits.

chapter-portable-script = Le script qui cassait
    .summary = Un script de sauvegarde écrit sous Debian échoue sur le serveur FreeBSD du ciné-club : lire chaque erreur, et le corriger avec le manuel de ce système.

## Fichiers

portable-script-message-yanis =
    De :  Yanis
    À :   toi

    Salut ! Je suis le nouveau bénévole du ciné-club. J'ai écrit un script
    pour sauvegarder le site chaque nuit (nightly-backup.sh, dans ton
    dossier). Sur mon portable Debian, il marche parfaitement. Sur le
    serveur, la dernière sauvegarde notée dans /var/backups/state.conf date
    du 1er septembre.

    Lucien, qui a installé le serveur il y a des années, disait toujours
    « ce n'est pas Linux, c'est FreeBSD ». Je croyais qu'Unix, c'était
    Unix…

    Tu peux le faire marcher ? La sauvegarde de cette nuit (à la date
    d'hier) serait un bon début.

    Yanis

## Événements

portable-script-event-not-found =
    « not found »… à propos d'un fichier qui est bien là. FreeBSD lit la
    première ligne, #!/bin/bash, et cherche /bin/bash : il n'existe pas.
    bash ne fait pas partie du système de base de FreeBSD (un paquet le
    mettrait dans /usr/local/bin/bash). Le shell du système de base, c'est
    /bin/sh : un script qui n'a besoin que de sh tourne partout.
portable-script-event-date =
    date: illegal option -- d. -d, c'est le date de GNU (celui de Debian).
    FreeBSD a son propre date, venu de BSD, avec d'autres options : son
    manuel (man date) dit comment décaler une date (-v).
portable-script-event-stat =
    stat: illegal option -- c. -c FORMAT, c'est le stat de GNU. Le stat de
    BSD prend son format avec -f, et les séquences diffèrent aussi : man
    stat.
portable-script-event-sed =
    sed se plaint d'un script nommé /var/backups/state.conf : le -i du sed
    de BSD prend toujours un mot après lui, le suffixe de la copie de
    secours (-i '' pour aucune). Ici, il a pris le s/…/…/ comme suffixe,
    puis le nom du fichier comme script (/var/ est devenu une adresse, b
    une commande). man sed, à -i.
portable-script-event-end =
    Yanis : « La sauvegarde d'hier, enfin ! Et state.conf est à jour.
    Désormais, je lirai le manuel de la machine sur laquelle je suis. »

    Bravo ! Tu as terminé le chapitre « Le script qui cassait ».

    CE QUI S'EST PASSÉ
    Le script était écrit pour les outils de Debian, ceux de GNU. FreeBSD a
    ses propres outils, venus de BSD : mêmes noms, même rôle, mais d'autres
    options. date -d, stat -c et sed -i sans suffixe n'existent que chez
    GNU ; et bash n'est pas installé par défaut.

    BONNE PRATIQUE
    - Lire le manuel de la machine sur laquelle on est : man date sur
      FreeBSD, ce n'est pas man date sur Debian.
    - Pour un script qui doit tourner partout : #!/bin/sh, et seulement ce
      que POSIX garantit (date +%F, mais pas date -d ; pas de sed -i du
      tout : écrire dans un fichier temporaire, puis mv).
    - set -e s'arrête à la première erreur : le message dit quelle ligne.

    UNE AUTRE FAÇON DE FAIRE
    pkg install coreutils apporte les outils de GNU sur FreeBSD, avec un g
    devant (gdate, gstat, et gsed dans son propre paquet) : pratique pour un
    script copié tel quel, mais le script dépend alors de paquets. pkg
    install bash, et #!/usr/local/bin/bash (ou #!/usr/bin/env bash), pour
    bash lui-même.

    DOCUMENTATION
    - date(1) sur FreeBSD : https://man.freebsd.org/cgi/man.cgi?query=date
    - sed(1) sur FreeBSD : https://man.freebsd.org/cgi/man.cgi?query=sed
    - stat(1) sur FreeBSD : https://man.freebsd.org/cgi/man.cgi?query=stat
    - Le Handbook de FreeBSD, les shells : https://docs.freebsd.org/en/books/handbook/basics/#shells
