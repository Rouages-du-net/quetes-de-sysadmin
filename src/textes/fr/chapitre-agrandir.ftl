### Histoire « Le Labo », chapitre 3 « La place qui manque » : une grappe
### neuve (mdadm --create), LVM (pvcreate, vgextend, lvextend), le système
### de fichiers (resize2fs), mdadm.conf et l'initramfs. Les commandes,
### options, chemins et sorties ne se traduisent pas.

chapitre-agrandir = La place qui manque
    .resume = Le disque des photos est plein et le concours d'hiver arrive : faire une grappe RAID des deux disques neufs, la donner à LVM, agrandir le volume et son système de fichiers, et que le démarrage s'en souvienne.

## Fichiers

agrandir-message-d-odile =
    Un message d'Odile (samedi 15 janvier, 9 h 50) :

    « Bonne année ! Le concours d'hiver commence lundi, et on attend
    environ 1,5 To de photos. Mais la galerie dit déjà “disque presque
    plein” : on a versé hier toutes les archives de l'automne.

    J'ai fait comme tu m'avais dit : j'ai demandé deux disques de plus à
    l'hébergeur. Il les a branchés ce matin, deux disques de 4 To. Il
    dit qu'ils sont “vierges, à vous de jouer”.

    Est-ce qu'on peut agrandir la place des photos sans rien casser ? Et
    sans perdre la sécurité des deux disques, bien sûr. »

## Événements

agrandir-evenement-plein =
    /srv est plein à 97 %. Il n'est pas sur une partition, mais sur
    /dev/mapper/labo-photos : un volume logique LVM. Que reste-t-il dans
    son groupe ? (man vgs, man lvs, man pvs)
agrandir-evenement-lvm =
    LVM empile trois étages : des volumes physiques (PV, ici la grappe
    md1), réunis en un groupe (VG labo), où l'on taille des volumes
    logiques (LV photos, monté sur /srv). Le groupe n'a plus une étendue de
    libre. Les deux disques neufs, sdc et sdd, attendent : d'abord une
    grappe RAID 1 avec eux, pour garder la sécurité des deux disques
    (man mdadm, --create).
# { $disque } : le disque seul dans le groupe
agrandir-evenement-seul =
    Attention : { $disque } est entré dans le groupe labo tel quel, sans
    RAID. Si ce disque lâche, tout ce que LVM y aura posé est perdu, et
    avec lui le volume des photos entier. Ressors-le du groupe (man
    vgreduce). S'il porte déjà des données, il faut d'abord les déménager
    (man pvmove) vers une grappe : une grappe peut naître avec un seul
    disque et une place vide (« missing », man mdadm), et recevoir son
    second disque plus tard.
# { $grappe } : la nouvelle grappe
agrandir-evenement-grappe =
    { $grappe } est créée, et sert déjà : sa première synchronisation
    (resync, dans /proc/mdstat) se fait en arrière-plan. Elle devient
    maintenant un volume physique du groupe labo (man pvcreate, man
    vgextend).
agrandir-evenement-etendu =
    Le groupe labo a de la place : vgs le montre (VFree). Le volume des
    photos, lui, n'a pas encore bougé : à agrandir (man lvextend).
agrandir-evenement-lv-seul =
    Le volume logique a grandi (lvs), mais df ne voit rien : le système de
    fichiers qu'il porte a gardé sa taille. Il faut l'agrandir lui aussi
    (man resize2fs ; la prochaine fois, lvextend -r fait les deux).
agrandir-evenement-agrandi =
    /srv a de la place pour le concours d'hiver, toujours sur deux copies.
    Reste le démarrage : la nouvelle grappe doit être déclarée dans
    /etc/mdadm/mdadm.conf (sa ligne ARRAY : man mdadm, --detail --brief),
    sinon elle risque de revenir sous un autre nom.
agrandir-evenement-doublons =
    mdadm.conf décrit maintenant une grappe deux fois : mdadm --detail
    --scan redonne aussi md0 et md1, déjà présentes. Au démarrage, mdadm
    s'en plaindrait. Garde une seule ligne ARRAY par grappe (sudo nano).
agrandir-evenement-conf =
    La nouvelle grappe est dans mdadm.conf. Mais au démarrage, c'est la
    copie de ce fichier dans l'initramfs qui compte : il faut la refaire
    (man update-initramfs).
agrandir-evenement-fin =
    Odile : « 3,6 To de plus ? Le concours peut venir ! »

    Bravo ! Tu as terminé le chapitre 3 du Labo. (La suite t'attend :
    ssh labo.)

    CE QUI S'EST PASSÉ
    Le volume des photos (LVM, sur la grappe md1) était plein. Tu as fait
    une grappe RAID 1 des deux disques neufs, tu l'as donnée au groupe de
    volumes, puis tu as agrandi le volume logique et son système de
    fichiers, sans rien démonter. Enfin, la nouvelle grappe est déclarée
    dans mdadm.conf, et l'initramfs le sait.

    LA BONNE PRATIQUE
    - RAID d'abord, LVM par-dessus : chaque volume physique doit être
      redondant ; un disque seul dans le groupe met tout le volume en
      danger.
    - lvextend ne grandit que le volume : resize2fs (ou lvextend -r) pour
      le système de fichiers ; ext4 s'agrandit à chaud, pas se rétrécit.
    - Laisser un peu de place libre dans le groupe : elle servira à un
      instantané (lvcreate -s) ou à une urgence.
    - Après une nouvelle grappe : sa ligne ARRAY dans mdadm.conf, une
      seule fois, puis update-initramfs -u.
    - Le RAID ne remplace toujours pas une sauvegarde.

    LA DOCUMENTATION
    - LVM : https://man7.org/linux/man-pages/man8/lvm.8.html
    - lvextend : https://man7.org/linux/man-pages/man8/lvextend.8.html
    - resize2fs : https://man7.org/linux/man-pages/man8/resize2fs.8.html
    - Le RAID logiciel sur Debian : https://wiki.debian.org/SoftwareRAID
