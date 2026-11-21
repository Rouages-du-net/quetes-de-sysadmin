### Histoire « La Maison de santé », chapitre « À l'étroit » : l'hyperviseur
### swappe (la mémoire de ses invités est surallouée), et le disque d'un
### invité est plein. free, virsh dommemstat, setmem --live --config,
### snapshot-create-as, blockresize (ou qemu-img resize à l'arrêt),
### growpart, resize2fs, snapshot-delete. Les commandes, options, chemins
### et sorties ne se traduisent pas.

chapter-tight-fit = À l'étroit
    .summary = Tout est lent à Millbrook, et les dossiers médicaux refusent d'enregistrer. L'hyperviseur a promis à ses invités plus de mémoire qu'il n'en a, et le disque d'un invité est plein de fichiers que la loi oblige à garder. Partagez la mémoire avec bon sens, agrandissez un disque prudemment avec un instantané comme filet, et ne gardez pas le filet pour toujours.

## Fichiers

tight-fit-message-grace =
    De : Grace (responsable de la maison de santé)
    Jeudi 18 avril, 14 h 00

    Tout est si lent aujourd'hui : agenda met dix secondes à ouvrir une
    journée, le portail expire. Et Joon dit que l'application des dossiers
    refuse d'enregistrer les notes de ses consultations (son mot est dans
    votre répertoire).

    Avant de changer quoi que ce soit sur records, assurez-vous qu'on
    puisse revenir en arrière si ça tourne mal. La sauvegarde de cette nuit
    est sur le NAS, comme d'habitude.

    Grace

tight-fit-note-joon =
    Mot de Joon (infirmière)

    L'application des dossiers dit « could not write to file ». La société
    qui l'a installée dit que le disque du serveur est plein, et que les
    exports mensuels de /srv/records/exports ne doivent SURTOUT PAS être
    supprimés : nous devons les garder (voir RETENTION.txt sur records).

    Joon

tight-fit-retention =
    CONSERVATION - exports de records

    Exports mensuels de l'application des dossiers médicaux. À garder en
    place pendant la durée de conservation exigée par la politique de la
    maison de santé. Ne pas supprimer, ne pas déplacer. Questions : Grace.

## Événements

tight-fit-event-swap =
    foyer swappe : sa mémoire vive est pleine, et le noyau envoie des pages
    sur le disque, puis va les rechercher. Tous les invités ralentissent.
    Qui prend quoi ? virsh list, virsh dominfo pour chaque invité (Used
    memory), virsh nodeinfo pour foyer, et vu de l'intérieur : virsh
    dommemstat records.
tight-fit-event-memstat =
    records a reçu 16 Gio. Ce qu'il utilise vraiment, c'est « actual » moins
    ce qui est « unused » et ce qui n'est que du cache (disk_caches) :
    environ 3,4 Gio. Un invité remplit de cache la mémoire qu'on lui donne,
    et cette mémoire est perdue pour l'hôte. Le ballon peut la rendre :
    virsh setmem (man virsh, ses --live et --config).
tight-fit-event-too-high =
    setmem ne peut pas dépasser la mémoire maximale du domaine (<memory>) :
    celle-là se change avec setmaxmem --config, et ne s'applique qu'au
    prochain démarrage.
tight-fit-event-config-only =
    --config change la définition, pour le prochain démarrage : records
    garde 16 Gio maintenant, et foyer swappe toujours. --live change
    l'invité allumé (le ballon) ; les deux à la fois, c'est la réponse
    habituelle.
tight-fit-event-memory-fixed =
    foyer ne swappe plus, et les définitions tiennent aussi dans sa mémoire
    au prochain démarrage : les invités reçoivent ensemble moins que ce que
    l'hôte possède, avec de la place pour foyer lui-même.
tight-fit-event-guest-full =
    Le système de fichiers racine de records est plein : 20 Gio, et les
    exports doivent rester. Le disque doit grandir : l'image d'abord
    (depuis foyer), puis la partition et le système de fichiers (dans
    l'invité). Mais Grace a demandé d'abord un retour en arrière possible.
tight-fit-event-lock =
    qemu-img refuse : records tourne, et QEMU tient un verrou en écriture
    sur son image. Redimensionner une image dans le dos d'un invité allumé
    l'abîmerait. Pendant qu'il tourne : virsh blockresize, en passant par
    QEMU. Ou arrêtez-le, puis qemu-img resize.
tight-fit-event-shrink-refused =
    Réduire un disque coupe sa fin, avec tout ce qui y est écrit : QEMU
    refuse sans --shrink, et seulement après avoir d'abord réduit le
    système de fichiers et la partition. Ici, le disque doit grandir.
tight-fit-event-shrunk =
    L'image a été réduite en dessous de ce que records avait écrit : la fin
    de son disque a disparu, système de fichiers compris. Si vous aviez
    pris un instantané avant, virsh snapshot-revert ramène le disque ;
    sinon, recommencez le chapitre (ou utilisez l'instantané de secours).
tight-fit-event-snapshot =
    Un instantané de records, pris avant de toucher à son disque : un
    retour possible si l'agrandissement tourne mal (virsh snapshot-revert).
    Il vit dans records.qcow2 : sur le même disque, il protège d'une
    erreur, pas de la perte du disque.
tight-fit-event-grown =
    L'image de records est plus grande : le noyau de l'invité l'a vu tout
    de suite (dmesg dans l'invité, lsblk). La partition et le système de
    fichiers n'ont pas grandi : dans l'invité, growpart, puis resize2fs
    (man growpart).
tight-fit-event-grown-no-net =
    L'image de records est plus grande. Tout s'est bien passé, mais sans
    instantané avant : si ça avait mal tourné, la sauvegarde de la nuit
    aurait été le seul retour possible. La partition et le système de
    fichiers sont la suite : dans l'invité, growpart, puis resize2fs.
tight-fit-event-partition =
    La partition remplit maintenant le disque (lsblk). Le système de
    fichiers a gardé son ancienne taille : resize2fs agrandit un ext4
    pendant qu'il est monté.
tight-fit-event-filesystem =
    Le système de fichiers de records a de la place (df -h dans l'invité) :
    l'application peut de nouveau écrire, et les exports sont toujours là.
    Vérifiez, puis n'oubliez pas les instantanés : virsh snapshot-list
    records.
tight-fit-event-cleaned =
    Plus aucun instantané sur records : ni le vôtre, devenu inutile, ni
    celui d'Ilse en octobre, vers lequel personne ne reviendrait jamais
    (cela effacerait six mois de dossiers médicaux).
tight-fit-event-end =
    Grace : « agenda s'ouvre tout de suite, et les notes de Joon sont
    enregistrées. Merci ! »

    Bravo ! Vous avez terminé À l'étroit.

    CE QUI S'EST PASSÉ
    On avait promis aux invités de foyer plus de mémoire que foyer n'en a ;
    records seul tenait 16 Gio, remplis de cache, pour 3,4 Gio vraiment
    utilisés, et foyer swappait. Vous avez donné 6 Gio à records,
    maintenant et à son prochain démarrage (setmem --live --config). Son
    disque était plein d'exports qui doivent rester : vous avez pris un
    instantané, agrandi l'image (virsh blockresize pendant qu'il tourne, ou
    qemu-img resize à l'arrêt), agrandi la partition (growpart) et le
    système de fichiers (resize2fs) dans l'invité, vérifié, et supprimé
    les instantanés.

    BONNES PRATIQUES
    - Additionnez ce que reçoivent les invités (leur mémoire courante) et
      gardez-le sous ce que possède l'hôte, avec de la place pour l'hôte
      lui-même. Un invité remplit sa mémoire de cache : dommemstat dit ce
      qu'il utilise vraiment.
    - setmem --live pour maintenant, --config pour le prochain démarrage ;
      setmaxmem seulement quand le domaine est arrêté.
    - Agrandir un disque se fait en trois temps : l'image, la partition, le
      système de fichiers. Ne redimensionnez jamais une image dans le dos
      d'un QEMU qui l'utilise, et ne réduisez jamais sans réduire d'abord
      ce qu'elle contient.
    - Un instantané avant un changement risqué, supprimé juste après : un
      instantané est sur le même disque, ce n'est pas une sauvegarde, et un
      vieil instantané pèse sur l'image pour toujours.

    DOCUMENTATION
    - virsh (setmem, dommemstat, blockresize, instantanés) : https://libvirt.org/manpages/virsh.html
    - qemu-img resize : https://www.qemu.org/docs/master/tools/qemu-img.html
    - growpart : https://manpages.debian.org/trixie/cloud-guest-utils/growpart.1.en.html
    - resize2fs : https://man7.org/linux/man-pages/man8/resize2fs.8.html
    - La mémoire dans le XML d'un domaine : https://libvirt.org/formatdomain.html#memory-allocation
