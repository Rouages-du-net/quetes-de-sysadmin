### Histoire « Le Labo », chapitre 2 « Le disque neuf » : recopier une table
### de partitions (sfdisk), reconstruire le RAID (mdadm --add, /proc/mdstat),
### installer GRUB sur le nouveau disque. Les commandes, options, chemins et
### sorties ne se traduisent pas.

chapitre-disque-neuf = Le disque neuf
    .resume = Le disque neuf est arrivé, vierge : le découper comme l'autre sans se tromper de sens, reconstruire les deux grappes RAID, et rendre le serveur capable de démarrer sur chacun des disques.

## Fichiers

disque-neuf-message-d-odile =
    Un message d'Odile (dimanche, 8 h 05) :

    « L'hébergeur a répondu cette nuit : “Le disque défectueux a été
    remplacé. Le nouveau disque est livré vierge : à vous de le
    partitionner et de reconstruire votre RAID.” Je t'avoue que je ne sais
    pas ce que ça veut dire… Le site marche, en tout cas.

    L'ancien bénévole avait laissé une note : “les deux disques sont
    découpés pareil, et GRUB est sur les deux, pour que le serveur démarre
    même si l'un lâche”. »

## Événements

disque-neuf-evenement-neuf =
    Le nouveau sdb : 1,8 T, aucune partition. Les grappes, elles, tournent
    sur sda seul ([U_] dans /proc/mdstat). Avant de l'ajouter au RAID, il
    faut le découper exactement comme sda : sfdisk sait écrire la table
    d'un disque sous forme de script, et la relire (man sfdisk).
disque-neuf-evenement-trop-tot =
    mdadm ne trouve pas cette partition : sdb est encore vierge. D'abord la
    table de partitions (la même que sur sda), ensuite les grappes.
disque-neuf-evenement-sens =
    sfdisk a refusé d'écrire sur un disque en service : heureusement !
    C'était sda, le disque qui fait tourner le serveur. Dans un tube, c'est
    le disque nommé en dernier qui est écrasé : sfdisk -d /dev/sda lit sda,
    sfdisk /dev/sdb écrit sur sdb.
disque-neuf-evenement-disque-entier =
    Tu as mis le disque sdb ENTIER dans une grappe : son superbloc RAID a
    écrasé sa table de partitions, et il n'y a plus de place pour GRUB ni
    pour l'autre grappe. Ressors-le (--fail puis --remove), recopie la
    table de sda, et ajoute la bonne partition : sdb2 dans md0, sdb3 dans
    md1.
disque-neuf-evenement-table =
    sdb est découpé comme sda : sdb1 (BIOS boot, la place de GRUB), sdb2 et
    sdb3 (Linux RAID). Chaque partition rejoint maintenant la grappe de sa
    jumelle : sdb2 dans md0, sdb3 dans md1.
disque-neuf-evenement-ajoutes =
    Les deux partitions ont rejoint leur grappe. Regarde /proc/mdstat : une
    grappe se reconstruit à la fois (recovery), l'autre attend son tour
    (DELAYED). Pendant ce temps, le serveur continue de servir les photos.
    Ici le temps file vite : chaque commande compte pour une demi-heure.
disque-neuf-evenement-reconstruit =
    Partout [UU] : les deux grappes ont de nouveau leurs deux copies. Reste
    ce qui comptera le jour où sda lâchera : pouvoir démarrer sur sdb.
disque-neuf-evenement-grub =
    GRUB est installé sur sdb : si sda tombe, le serveur pourra démarrer
    sur l'autre disque.
disque-neuf-evenement-fin =
    Odile : « Donc si un disque lâche encore, on ne perd rien, et le serveur
    redémarre quand même ? Génial. »

    Bravo ! Tu as terminé le chapitre 2 du Labo. (La suite t'attend :
    ssh labo.)

    CE QUI S'EST PASSÉ
    Le disque neuf était vierge. Tu as recopié la table de partitions de
    sda (sfdisk -d, puis sfdisk sur sdb : le sens compte), ajouté chaque
    partition à la grappe de sa jumelle, suivi la reconstruction, et
    installé GRUB sur le nouveau disque.

    LA BONNE PRATIQUE
    - Vérifier deux fois le disque visé avant d'écrire une table : lsblk,
      et son numéro de série.
    - Ajouter aux grappes des partitions, pas le disque entier, quand le
      disque porte aussi GRUB.
    - Suivre la reconstruction (cat /proc/mdstat) et ne rien redémarrer
      avant [UU].
    - GRUB sur chaque disque d'un RAID 1, sinon la panne du premier empêche
      de démarrer.
    - La table recopiée garde les identifiants de l'autre disque (label-id,
      uuid) : sur un vrai serveur, sgdisk -G /dev/sdb en tire de nouveaux.
    - mdadm prévient quand une grappe se dégrade (MAILADDR dans
      /etc/mdadm/mdadm.conf) : encore faut-il lire les courriers de root.

    LA DOCUMENTATION
    - sfdisk : https://man7.org/linux/man-pages/man8/sfdisk.8.html
    - mdadm : https://man7.org/linux/man-pages/man8/mdadm.8.html
    - GRUB et le BIOS : https://www.gnu.org/software/grub/manual/grub/html_node/BIOS-installation.html
