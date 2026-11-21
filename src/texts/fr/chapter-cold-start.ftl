### Histoire « La Maison de santé », chapitre « Le Démarrage à froid » :
### après une coupure de courant, la VM de la comptabilité n'est pas
### revenue ; démarrée à la main, elle se met en pause sur un /var plein :
### une chaîne d'instantanés externes oubliés. virsh list, dominfo,
### domstate, domblkerror, qemu-img info, blockcommit, snapshot-delete,
### autostart. Les commandes, options, chemins et sorties ne se traduisent pas.

chapter-cold-start = Le Démarrage à froid
    .summary = Samedi soir, un orage a coupé le courant dans la vallée. Lundi, l'agenda de l'accueil est revenu, mais pas le serveur de la comptabilité, et Priya a les salaires à envoyer. Trouvez pourquoi une machine virtuelle est restée éteinte, pourquoi elle se fige dès qu'elle démarre, et faites de la place sur l'hyperviseur sans perdre un an de comptes.

## Fichiers

cold-start-message-grace =
    De : Grace (responsable de la maison de santé)
    Lundi 11 mars, 8 h 05

    Bonjour, et bienvenue à la maison de santé de Millbrook !

    L'orage de samedi soir a coupé le courant pendant trois heures, plus
    longtemps que ne tient l'onduleur. foyer, le serveur du bureau du
    fond, a redémarré tout seul au retour du courant. L'agenda des
    rendez-vous (agenda) et les dossiers médicaux (records) fonctionnent ;
    la comptabilité (ledger), non, et Priya doit envoyer les salaires
    mercredi.

    Tous nos serveurs sont des machines virtuelles sur foyer (KVM, avec
    libvirt) : vous êtes dans le groupe libvirt, et sudo marche avec votre
    mot de passe. Ilse, qui a tout installé, est partie vivre sur la
    côte ; elle vous a laissé un mot dans votre répertoire. Priya aussi.

    S'il vous plaît, ne perdez pas les comptes de Priya.

    Grace

cold-start-note-ilse =
    Notes d'Ilse (foyer)

    - virsh est ton ami : virsh list --all montre toutes les VM, allumées
      ou non. ~/.config/libvirt/libvirt.conf fait parler virsh à
      qemu:///system.
    - Les images sont dans /var/lib/libvirt/images (root seulement : sudo).
    - Avant chaque opération risquée sur ledger, j'ai pris un instantané
      (virsh snapshot-create-as --disk-only) : avant la mise à jour du
      logiciel, avant la clôture de l'exercice, avant le passage à Debian
      13. Je comptais faire le ménage après…
    - ledger-test-clone.qcow2 est une copie faite en janvier pour tester la
      nouvelle version de la compta avec Priya. Rien ne s'en sert ; elle
      peut partir dès que Priya dit que le test est fini.

    Ilse

cold-start-message-priya =
    De : Priya (comptabilité, lundi et mercredi)

    Bonjour ! Le test de la nouvelle version qu'Ilse a lancé en janvier
    est terminé : on est restés sur l'ancienne. Sa copie de test peut être
    supprimée, je n'en ai pas besoin.

    Les vrais comptes sont sur ledger, et il me les faut pour mercredi.

    Priya

## Événements

cold-start-event-list =
    ledger est « shut off » : agenda et records sont revenus avec foyer,
    pas ledger. Un domaine ne démarre avec son hôte que s'il est marqué
    autostart (virsh dominfo le montre). Avant de le démarrer, regardez-le :
    virsh dominfo ledger.
cold-start-event-autostart-off =
    Autostart: disable. ledger n'est jamais revenu tout seul après un
    redémarrage : quelqu'un le démarrait toujours à la main. Cela se corrige
    (man virsh, autostart), mais d'abord : démarre-t-il seulement ?
    virsh start ledger.
cold-start-event-paused =
    ledger a démarré… et s'est figé quelques secondes plus tard : le
    voilà « paused » (virsh list). Un invité qui ne peut plus écrire sur
    son disque est mis en pause par QEMU plutôt que laissé abîmer son
    système de fichiers (sa règle par défaut, werror=enospc). Pourquoi ?
    virsh domstate ledger --reason, virsh domblkerror ledger, et que dit le
    disque de l'hôte (df -h) ?
cold-start-event-no-space =
    « vda: no space », et /var est à 100 % : l'invité a écrit, son image a
    grossi, et le système de fichiers qui porte les images est plein. Qui
    prend toute cette place ? sudo ls -lh /var/lib/libvirt/images, et
    quelles images ledger utilise-t-il vraiment ? virsh domblklist ledger,
    puis qemu-img info sur son disque (sudo).
cold-start-event-lock =
    qemu-img refuse : l'image est utilisée, et QEMU la verrouille pour que
    personne n'écrive dans son dos. Pour seulement la lire, demandez une
    ouverture partagée : qemu-img info -U (--force-share). N'écrivez jamais
    dans une image qu'un invité allumé utilise.
cold-start-event-chain =
    Le disque de ledger est une chaîne : before-upgrade repose sur
    before-yearend, qui repose sur before-update, qui repose sur
    ledger.qcow2. Chaque instantané externe a figé l'image du dessous et
    créé un nouveau fichier par-dessus, où sont allées toutes les
    écritures depuis. Quatre fichiers pour un seul disque de 200 Gio
    (virtual : ce que voit l'invité ; disk size : ce que l'hôte lui
    donne). Regardez aussi les instantanés : virsh snapshot-list ledger.
cold-start-event-acpi-paused =
    virsh shutdown appuie sur le bouton d'alimentation virtuel (ACPI) : le
    système de l'invité doit l'entendre et s'éteindre de lui-même. Un
    invité en pause n'entend rien : ledger est toujours en pause. Le
    problème, c'est son disque, pas son alimentation.
cold-start-event-destroyed =
    virsh destroy débranche la prise : aucun arrêt, l'invité s'arrête net,
    comme l'orage le lui a fait. Il était en pause, donc rien n'était à
    moitié écrit cette fois ; sur un invité allumé, destroy est le dernier
    recours. La chaîne et le /var plein sont toujours là.
cold-start-event-revert =
    Heureux refus. Revenir à before-update remettrait ledger tel qu'il
    était en mars de l'an dernier : un an de comptes disparus. Un
    instantané est un point où revenir, pas un endroit d'où continuer à
    vivre.
cold-start-event-undefine =
    libvirt refuse de supprimer la définition d'un domaine qui a encore des
    instantanés, et il a raison : cela ne réparerait pas le disque de
    ledger, et avec --remove-all-storage, cela le supprimerait.
cold-start-event-rm-held =
    Vous avez supprimé une image que ledger utilise. Regardez df : aucune
    place n'est revenue. QEMU garde le fichier ouvert (sudo lsof le montre
    « (deleted) ») : ses blocs ne seront libérés qu'à l'arrêt de l'invité.
    Et à cet arrêt, la chaîne pointera vers un fichier qui n'existe plus.
    N'arrêtez pas ledger : tant que QEMU tient le fichier, une fusion
    (block commit) peut encore le lire et tout ramener dans la base.
cold-start-event-broken =
    La chaîne de ledger est cassée : une image dont il a besoin a disparu,
    et QEMU ne la tient plus. libvirt ne peut plus démarrer le domaine
    (« Cannot access backing file »). Ce qui avait été écrit dans cette
    image est perdu. Recommencez le chapitre (ou utilisez l'instantané de
    secours) : ne supprimez jamais une image sans vérifier ce qui s'en sert
    (virsh domblklist, qemu-img info --backing-chain).
cold-start-event-commit-failed =
    La fusion a échoué : fusionner une image dans sa base fait grossir la
    base de ce qu'elle reçoit, et /var n'a plus de place. Faites d'abord de
    la place, avec ce dont rien ne se sert (le mot d'Ilse, le message de
    Priya), puis fusionnez.
cold-start-event-room =
    Le clone de test est parti : environ 12 Gio libres sur /var. C'est peu :
    la chaîne contient encore un an d'écritures au-dessus de la base.
    Fusionnez-la : virsh blockcommit avec --active --pivot ramène toute la
    chaîne dans la base pendant que l'invité tourne (ou est en pause) ;
    virsh snapshot-delete fusionne un instantané externe à la fois (man
    virsh).
cold-start-event-merged =
    La chaîne est fusionnée : le disque de ledger, c'est ledger.qcow2 seul,
    avec tout ce qui avait été écrit par-dessus. Les images
    intermédiaires et les instantanés sont partis avec elle.
cold-start-event-merged-leftovers =
    La chaîne est fusionnée : ledger écrit maintenant dans ledger.qcow2
    seul. Mais les fichiers intermédiaires sont toujours sur /var
    (blockcommit ne les supprime pas sans --delete), et libvirt liste
    encore les instantanés, qui désignent des images qui ne sont plus dans
    la chaîne. Supprimez les fichiers dont plus rien ne se sert (vérifiez
    avec virsh domblklist ledger), et les métadonnées périmées : virsh
    snapshot-delete --metadata.
cold-start-event-paused-again =
    De nouveau en pause : l'invité a continué d'écrire, et /var était
    toujours plein des anciennes images intermédiaires. Une fusion copie
    des données dans la base ; elle ne libère rien tant que les anciens
    fichiers restent sur le disque.
cold-start-event-cleaned =
    /var a de nouveau de la place : une seule image pour ledger, aucune
    image intermédiaire qui traîne, et des métadonnées d'instantanés qui
    correspondent au disque.
cold-start-event-resumed =
    ledger tourne de nouveau (virsh resume réveille un invité en pause ;
    il reprend là où il s'était figé). Laissez-lui quelques secondes pour
    finir de démarrer.
cold-start-event-autostart =
    ledger est marqué autostart : /etc/libvirt/qemu/autostart/ledger.xml
    pointe vers sa définition, et le prochain orage ne l'oubliera pas.
cold-start-event-ssh =
    Vous êtes sur ledger : les comptes de Priya sont dans
    /srv/ledger/books. Revenez sur foyer avec exit.
cold-start-event-end =
    Grace : « Priya dit que les comptes sont tous là, salaires mercredi
    comme prévu. Merci ! »

    Bravo ! Vous avez terminé Le Démarrage à froid.

    CE QUI S'EST PASSÉ
    La coupure de samedi a fait redémarrer foyer. agenda et records étaient
    marqués autostart ; ledger, non. Démarré à la main, il s'est mis en
    pause aussitôt : en un an, Ilse avait pris trois instantanés externes
    de son disque sans jamais les fusionner. Chacun avait créé une nouvelle
    image par-dessus, où allaient toutes les écritures, et la chaîne de
    quatre images avait rempli /var. Vous avez fait de la place avec ce
    dont rien ne se servait (le clone de test), fusionné la chaîne dans sa
    base, supprimé les restes et les métadonnées périmées, réveillé ledger,
    l'avez marqué autostart et vérifié de l'intérieur.

    BONNES PRATIQUES
    - virsh list --all, pas virsh list : sinon un domaine arrêté
      n'apparaît pas. virsh autostart pour chaque invité qui doit revenir
      avec son hôte.
    - « paused (I/O error) » avec « no space » : regardez le système de
      fichiers de l'hôte avant de toucher à l'invité.
    - Une image fine (qcow2) peut grossir jusqu'à sa taille virtuelle : la
      somme des tailles virtuelles peut bien dépasser le disque. Surveillez
      df sur l'hôte.
    - Un instantané externe est un nouveau fichier posé sur l'ancien :
      refusionnez-le (blockcommit, ou snapshot-delete depuis libvirt 9) dès
      qu'il ne sert plus. Ne faites jamais rm d'une image d'une chaîne.
    - qemu-img info -U pour lire une image utilisée ; n'y écrivez jamais.
    - Un instantané est un point où revenir, sur le même disque : ce n'est
      pas une sauvegarde.

    DOCUMENTATION
    - virsh : https://libvirt.org/manpages/virsh.html
    - Fusionner des chaînes d'images : https://libvirt.org/kbase/merging_disk_image_chains.html
    - Les instantanés dans libvirt : https://libvirt.org/kbase/snapshots.html
    - qemu-img : https://www.qemu.org/docs/master/tools/qemu-img.html
    - KVM sur Debian : https://wiki.debian.org/KVM
