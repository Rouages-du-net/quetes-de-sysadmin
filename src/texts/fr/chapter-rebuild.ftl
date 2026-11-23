### Histoire « Le Refuge », chapitre « Reconstruire sur la machine de
### secours » : enclos s'est noyé dans la cave inondée ; abri, une Debian
### neuve, est reconstruit depuis les sauvegardes dans l'ordre du plan
### (paquets, restauration à côté, la base et ses vérifications, services
### dans l'ordre, un test local).
### Les commandes, options, chemins et sorties ne se traduisent pas.

chapter-rebuild = Reconstruire sur la machine de secours
    .summary = Cette nuit, la cave a été inondée, et le serveur avec. Une machine donnée attend, fraîchement installée, et avec elle les sauvegardes et l'enveloppe de la trésorière. Suivez le plan : les paquets, une restauration à côté du nouveau système, la base vérifiée ligne à ligne, les services dans le bon ordre, et un test avant que quiconque ne bascule quoi que ce soit.

## Fichiers

rebuild-message-teuila =
    De : Teuila
    Vendredi 14 novembre, 8 h 30

    Mauvaise nouvelle. La rivière est montée dans la nuit et la cave de la
    grange des Coteaux est sous 40 cm d'eau. enclos était en bas. Le site
    est coupé depuis le milieu de la nuit (les vérifications de prairie
    sont dans /var/log/sitewatch.log). Les animaux vont bien : les chenils
    sont à l'étage.

    Bonne nouvelle : Wiremu a apporté la machine que le club informatique
    nous a donnée le mois dernier. Il y a installé Debian 13 ce matin, avec
    restic, et l'a appelée abri ; elle est à la Rivière, sur le réseau (ssh
    abri depuis ici). Rahel a ouvert l'enveloppe : c'est dans
    enveloppe.txt, à côté de ce message.

    Le plan que nous avons corrigé ensemble est dans /srv/drp/plan.md, avec
    son ordre de restauration. Pourriez-vous remettre le site et l'appli en
    route sur abri ? Ne basculez rien pour l'instant : nous le ferons
    ensemble cet après-midi, une fois que ça marche.

    Teuila

rebuild-envelope =
    L'ENVELOPPE SCELLÉE (coffre de Rahel), ouverte le vendredi 14 novembre, 8 h 15

    Dépôt restic des refuges (clé de secours) :

        dépôt :          { $repo }
        mot de passe :   { $password }

    Dariusz, mai 2029 : « Cette clé ouvre toutes les sauvegardes, de
    n'importe où. Si vous lisez ceci, quelque chose de grave est arrivé :
    respirez, suivez le plan. »

## Événements

rebuild-event-down =
    Toutes les cinq minutes depuis 2 h 50, la vérification expire :
    l'adresse des Coteaux ne répond plus. La dernière vérification réussie
    date de 2 h 45, et la dernière sauvegarde de 2 h : au pire, 50 minutes
    de données perdues, bien dans le RPO de 24 heures du plan.
rebuild-event-paddock-gone =
    enclos ne répond plus, et ne répondra plus : il est sous l'eau. Tout ce
    dont vous avez besoin est désormais dans le dépôt et dans l'enveloppe.
rebuild-event-haven =
    abri : une Debian 13 neuve, restic installé, rien d'autre. L'ordre de
    restauration du plan est votre liste (/srv/drp/plan.md sur prairie) :
    d'abord, les paquets dont les services ont besoin.
rebuild-event-no-lists =
    Une machine fraîchement installée ne connaît encore aucun paquet : apt
    update d'abord, puis apt install.
rebuild-event-packages =
    nginx et PostgreSQL sont installés (et démarrés, comme le font les
    paquets Debian), avec leur configuration par défaut. Maintenant, les
    fichiers propres aux refuges, depuis le dépôt : son adresse et son mot
    de passe sont dans l'enveloppe.
rebuild-event-wrong-password =
    Ce mot de passe n'ouvre aucune clé du dépôt. Celui de la tâche
    nocturne s'est noyé avec enclos : c'est celui de l'enveloppe.
rebuild-event-snapshots =
    Le dépôt s'ouvre avec la clé de l'enveloppe, par sftp depuis abri : le
    dernier instantané date de 2 h cette nuit. Restaurez-le à côté du
    nouveau système (--target sur un répertoire vide), puis reprenez ce qui
    doit revenir.
rebuild-event-over-etc =
    La restauration est passée par-dessus / : { $files } d'enclos ont
    remplacé ceux d'abri. Au prochain démarrage, abri chercherait le disque
    d'enclos (fstab), et chaque machine qui connaît abri verrait une
    nouvelle clé d'hôte SSH ; deux machines avec un même machine-id
    embrouillent le DHCP et le journal. Wiremu, qui avait gardé une copie
    du /etc de l'installation neuve, remet en place les fichiers propres à
    abri. Restaurez à côté (--target /srv/restore, par exemple) et ne
    recopiez que ce qui est aux refuges.
rebuild-event-restored =
    L'instantané est à côté du nouveau système, ses chemins complets
    recréés sous la cible. Recopiez maintenant ce qui est aux refuges : le
    site (/var/www/shelter), l'appli (/srv/adopt), les fiches de vetlink
    (/srv/vetlink), le fichier de site de nginx, l'unité de l'appli.
    Laissez où ils sont le fstab, le nom, le machine-id et les clés SSH
    d'enclos.
rebuild-event-copied =
    Le site et l'appli sont en place. L'unité de l'appli est lue après
    systemctl daemon-reload. La base passe d'abord : l'appli ne peut pas
    démarrer sans elle.
rebuild-event-too-early =
    adopt n'a pas pu démarrer : sa base n'est pas encore là (journalctl -u
    adopt dit laquelle). C'est pour cela que le plan démarre la base avant
    l'appli : restaurez-la, puis redémarrez adopt.
rebuild-event-database =
    Toutes les lignes du dump de cette nuit sont de retour dans shelter.
    Avant de lui faire confiance, comparez avec ce que la tâche a noté :
    shelter.sha256 pour le dump lui-même, shelter.counts pour les lignes de
    chaque table.
rebuild-event-verified =
    Le dump correspond à ce que la tâche avait noté : rien ne s'est abîmé
    en route.
rebuild-event-adopt =
    adopt tourne, sur sa base.
rebuild-event-default-site =
    C'est la page par défaut de nginx : la requête est arrivée au site par
    défaut. Le site des refuges répond à son propre nom (server_name) :
    demandez-le, avec curl -H "Host: …", ou activez d'abord le site.
rebuild-event-nginx =
    nginx sert le site des refuges sur abri.
rebuild-event-vetlink =
    Les fiches vétérinaires de Mirela sont de retour dans /srv/vetlink : la
    correction d'il y a quinze jours a payé.
rebuild-event-tested =
    curl, sur abri même, atteint l'appli à travers nginx : le site marche
    avant que quiconque n'y envoie le monde.
rebuild-event-end =
    Teuila : « Mirela vient de voir la page de Biscotte sur abri. On
    déjeune, puis on bascule. »

    Bravo ! Vous avez terminé le chapitre 2 du Refuge.

    CE QUI S'EST PASSÉ
    enclos a été perdu avec la cave. Sur une machine vierge, avec le dépôt
    et l'enveloppe seulement, vous avez suivi le plan : les paquets depuis
    Debian, le dernier instantané restauré à côté du nouveau système, les
    fichiers propres aux refuges recopiés à leur place, la base recréée
    depuis son dump et vérifiée avec la somme de contrôle et les nombres de
    lignes de la tâche, les services démarrés dans l'ordre de leurs
    dépendances, et un test local avant toute bascule.

    BONNES PRATIQUES
    - Reconstruire en suivant le plan, étape par étape : sous le stress,
      une liste vaut mieux que la mémoire.
    - Restaurer à côté, puis recopier ce qui est à soi. Le /etc d'une
      machine porte son identité (fstab et les UUID de ses disques, nom,
      machine-id, clés d'hôte SSH, réseau) : n'y restaurez jamais celui
      d'une autre.
    - Une base revient depuis son dump, puis se vérifie (somme de
      contrôle, nombres de lignes) avant que quoi que ce soit ne s'en serve.
    - Démarrer dans l'ordre des dépendances (After=, Requires=) : la base,
      l'appli, puis ce qui la sert.
    - Tester en local (curl -H "Host: …" http://localhost/) avant de basculer.
    - La clé de secours vit hors site, sur papier : celle de la tâche s'est
      noyée avec le serveur.

    DOCUMENTATION
    - restic, restaurer une sauvegarde : https://restic.readthedocs.io/en/stable/050_restore.html
    - restic, dépôts sftp : https://restic.readthedocs.io/en/stable/030_preparing_a_new_repo.html#sftp
    - PostgreSQL, restaurer un dump : https://www.postgresql.org/docs/current/backup-dump.html#BACKUP-DUMP-RESTORE
    - systemd.unit, After= et Requires= : https://www.freedesktop.org/software/systemd/man/latest/systemd.unit.html
    - NIST SP 800-34 Rev. 1 (la phase de reprise) : https://csrc.nist.gov/pubs/sp/800/34/r1/upd1/final
