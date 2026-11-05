### Histoire « Le Club photo », chapitre 2 « À qui sont ces fichiers ? » :
### NFS transporte des numéros (uid, gid), root_squash, usermod -u, chown.
### La configuration, les chemins et les sorties des outils ne sont pas
### traduits.

chapter-nfs-owners = À qui sont ces fichiers ?
    .summary = Les scans de Sam, copiés depuis l'ordinateur du labo, appartiennent à Nora sur le NAS, et Sam ne peut plus modifier ses propres albums. Trouve pourquoi, et répare-le pour de bon.

## Fichiers

nfs-owners-message-margot =
    De :     Margot
    À :      toi
    Objet :  Les scans de Sam sont à Nora ??

    Bonjour,

    Depuis la semaine dernière, Sam scanne ses films sur l'ordinateur du
    labo et les copie dans /mnt/photos/2028-film-scans. Mais sur le NAS,
    ls -l dit qu'ils appartiennent à Nora ! Nora ne comprend pas, Sam est
    furieux.

    Et c'est pire : depuis l'ordinateur du labo, Sam ne peut plus
    retoucher ses propres photos de 2028-outings. Il a essayé avec sudo,
    et a eu « Permission denied » quand même.

    Sam est toujours connecté sur l'ordinateur du labo, en pleine
    retouche (darktable). Même mot de passe sudo : obturateur-2028.

    Margot

## Événements

nfs-owners-event-numbers =
    En NFS (sec=sys), le serveur ne connaît pas les noms : le client
    envoie des numéros (uid, gid), et chaque machine les affiche avec ses
    propres noms. Sam a le 1001 sur l'ordinateur du labo, le 1002 sur le
    NAS ; et le 1001, sur le NAS, c'est Nora. Compare : id sam sur chaque
    machine (ou ls -n, qui montre les numéros).
nfs-owners-event-squash =
    sudo n'aide pas : avec root_squash (le défaut), root sur un client
    devient nobody (65534) sur le NAS, et nobody ne peut pas écrire ici.
    C'est une protection : jamais no_root_squash pour ça. La sortie, c'est
    que Sam soit Sam partout.
nfs-owners-event-no-root-squash =
    no_root_squash donne à root sur l'ordinateur du labo tous les droits
    sur les photos du NAS : quiconque est root sur un client (ou branche
    un portable avec cette adresse) pourrait tout effacer ou modifier.
    Remets root_squash, et donne plutôt à Sam le même uid sur les deux
    machines.
nfs-owners-event-busy =
    usermod refuse de changer l'uid d'un compte en cours d'utilisation :
    Sam est connecté sur l'ordinateur du labo (ps -u sam). Demande-lui
    d'enregistrer et de se déconnecter, ou termine sa session toi-même
    (pkill -u sam), puis recommence.
nfs-owners-event-taken =
    Le 1001 est celui de Nora sur le NAS : changer l'uid de Sam sur le NAS
    créerait une collision. Le NAS a le plus de fichiers et le plus de
    comptes ; aligne l'ordinateur du labo sur lui (Sam y a le 1002).
nfs-owners-event-uid =
    Sam a le même numéro sur les deux machines maintenant : depuis
    l'ordinateur du labo, ses albums sont de nouveau à lui. Reste les
    scans déjà copiés, qui portent le 1001 sur le NAS : le numéro de Nora,
    et celui de son groupe. Rends-les à Sam et au club, sur le NAS
    (man chown : -R, propriétaire:groupe).
nfs-owners-event-end =
    Sam a le 1002 partout, ses scans sont à lui, et il peut retoucher ses
    albums depuis l'ordinateur du labo. root reste écrasé. Margot : « Nora
    et Sam se reparlent. Je tiendrai une liste des uid, promis. »

    Bravo ! Tu as terminé le chapitre « À qui sont ces fichiers ? ».

    CE QUI S'EST PASSÉ
    Le compte de Sam a été créé en premier sur l'ordinateur du labo
    (1001), après celui de Nora sur le NAS (1001 aussi). NFS en sec=sys ne
    transporte que des numéros : pour le NAS, 1001 c'est Nora, quel que
    soit le nom que lui donne le client.

    LES MÊMES NUMÉROS PARTOUT
    - id sam sur chaque machine, ls -n pour voir les numéros.
    - usermod -u 1002 sam (le compte ne doit pas être utilisé ; les
      fichiers du répertoire personnel suivent ; groupmod -g pour le
      groupe), puis chown sur le serveur pour ce qui a été écrit avec les
      mauvais numéros.
    - Pour beaucoup de machines : un annuaire (LDAP, voir « L'Annuaire »)
      pour que chaque machine ait les mêmes uid, ou NFSv4 avec Kerberos et
      idmapd (des noms au lieu des numéros).

    BONNES PRATIQUES
    - Garder root_squash ; no_root_squash seulement pour une machine de
      totale confiance, pour un besoin précis (un serveur de sauvegarde,
      des postes sans disque).
    - Prévoir les uid avant le premier compte de chaque machine.

    DOCUMENTATION
    - exports(5), User ID Mapping : https://man7.org/linux/man-pages/man5/exports.5.html
    - usermod(8) : https://man7.org/linux/man-pages/man8/usermod.8.html
