### Histoire « La Maison de santé », chapitre « Le Mauvais Côté » : un
### invité sur le réseau NAT de libvirt est injoignable depuis le bureau ;
### une copie faite à la main partage l'adresse MAC et le machine-id de son
### original. virsh domiflist, net-dhcp-leases, edit, attach-interface,
### domifaddr, virt-clone, systemd-machine-id-setup. Les commandes,
### options, chemins et sorties ne se traduisent pas.

chapter-wrong-side = Le Mauvais Côté
    .summary = Le nouveau portail des patient·es marche sur l'hyperviseur, et nulle part ailleurs. Et depuis hier, l'agenda de l'accueil montre parfois une copie d'entraînement au lieu des vrais rendez-vous. Trouvez de quel côté du pont est chaque machine virtuelle, et donnez à une copie faite main une identité à elle.

## Fichiers

wrong-side-message-grace =
    De : Grace (responsable de la maison de santé)
    Mardi 26 mars, 9 h 10

    Deux problèmes ce matin, j'en ai peur.

    1. Hamid a installé portal la semaine dernière, la machine virtuelle du
    portail de rendez-vous pour les patient·es. Il dit que ça marche « sur
    foyer », mais à l'accueil rien ne s'ouvre. Il a laissé un mot sur le PC
    de l'accueil (ssh reception).

    2. Depuis hier après-midi, l'agenda de l'accueil (agenda) affiche
    parfois « TRAINING COPY » et des patient·es fictif·ves au lieu des
    rendez-vous du jour, puis de nouveau les vrais. Hamid a fait hier une
    copie d'agenda pour former jeudi les deux nouvelles personnes de
    l'accueil : elles en ont toujours besoin, mais pas à la place du vrai !

    Grace

wrong-side-note-hamid =
    Mot de Hamid (accueil)

    Le portail : je l'ai installé sur foyer avec virt-install, toutes les
    options par défaut. Sur foyer, curl http://192.168.122.47/ affiche le
    portail. Ici, dans le navigateur de l'accueil, rien.

    La copie d'entraînement : j'ai copié agenda.qcow2 en
    agenda-training.qcow2, fait virsh dumpxml agenda > training.xml,
    changé le nom et le disque, et virsh define disait que l'uuid existait
    déjà, alors j'ai supprimé la ligne uuid. Puis virsh start, et dedans
    j'ai changé son nom d'hôte en agenda-training. Ça marche !

    Hamid

## Événements

wrong-side-event-nat-seen =
    L'interface de portal est sur le réseau nommé « default » : le réseau
    NAT de libvirt, un pont privé (virbr0, 192.168.122.0/24) qui n'existe
    qu'à l'intérieur de foyer. Ses invités peuvent sortir (foyer les
    masque), mais aucune machine du bureau ne peut entrer : il n'y a de
    route vers 192.168.122.0/24 que sur foyer. Vérifiez-le depuis le PC de
    l'accueil : ssh reception.
wrong-side-event-unreachable =
    Vu de l'accueil : rien. Ses paquets pour 192.168.122.47 partent vers le
    routeur du bureau, qui n'a jamais entendu parler de ce réseau. Les
    autres invités (agenda, ledger, records) ont une adresse sur le réseau
    du bureau : comment sont-ils branchés ? virsh domiflist agenda, et
    /etc/network/interfaces sur foyer.
wrong-side-event-nat-hack =
    Une règle DNAT sur foyer ferait suivre un port vers portal… jusqu'à ce
    que libvirt réécrive ses propres règles (il le fait quand son réseau
    redémarre), et portal resterait invisible pour tout le reste (ssh, la
    supervision). L'invité n'a pas besoin d'une porte dans foyer : il doit
    être lui-même sur le réseau du bureau, comme agenda.
wrong-side-event-promisc =
    Le mode promiscuité fait recevoir à une interface toutes les trames,
    même celles qui ne lui sont pas adressées. Un pont fait déjà ce qu'il
    doit : br0 n'est pas le problème, portal n'y est tout simplement pas
    branché.
wrong-side-event-config-bridge =
    La définition de portal met maintenant son interface sur br0. L'invité
    allumé n'a pas changé : QEMU tourne toujours avec l'ancienne définition
    (virsh dumpxml portal montre celle qui tourne, --inactive la
    prochaine). Un changement de définition s'applique quand le domaine
    redémarre : un arrêt complet, puis un démarrage.
wrong-side-event-reboot-only =
    virsh reboot redémarre l'invité dans le même processus QEMU : même
    définition en cours, même réseau NAT. Pour appliquer une nouvelle
    définition, le domaine doit s'arrêter et redémarrer (virsh shutdown,
    attendre « shut off », virsh start). Ou changer aussi l'invité allumé,
    avec detach-interface et attach-interface --live --config.
wrong-side-event-bridged =
    portal est sur br0, et le DHCP du bureau lui a donné une adresse :
    { $address }. Essayez maintenant depuis là où ça compte : le PC de
    l'accueil.
wrong-side-event-reception-ok =
    L'accueil joint portal : sur le réseau du bureau, c'est une machine
    comme les autres, avec son nom dans le DNS du bureau (portal.internal).
wrong-side-event-clash-seen =
    agenda-training a exactement l'adresse MAC d'agenda, sur le même pont.
    Deux machines qui répondent pour une seule MAC : le pont et les tables
    des voisins suivent celle qui a parlé en dernier, et l'accueil tombe sur
    l'une, puis sur l'autre. Copier le XML à la main a copié la MAC ; copier
    le disque a copié aussi tout ce qu'il contient. virt-clone donne à un
    clone une nouvelle MAC et un nouvel uuid ; à l'intérieur, la copie a
    encore besoin d'une identité à elle.
wrong-side-event-original-changed =
    C'est agenda que vous avez modifié, le vrai agenda des rendez-vous : sa
    MAC ou son machine-id. L'accueil et le DHCP du bureau connaissent agenda
    par eux (192.0.2.90). C'est la copie qui doit changer, pas l'original :
    remettez agenda comme il était.
wrong-side-event-new-mac =
    agenda-training a une adresse MAC à lui dans sa définition. Reste une
    identité à corriger : celle qui est dans le disque. Attention : ssh
    tombe sur celle des deux machines qui répond, regardez l'invite.
wrong-side-event-same-ip =
    Une nouvelle MAC, et toujours la même adresse : 192.0.2.90 pour les
    deux. Le DHCP du bureau reconnaît un client à son identifiant client,
    et systemd-networkd le calcule à partir de /etc/machine-id, que le
    disque copié partage avec agenda. Donnez à la copie son propre
    machine-id (man machine-id, man systemd-machine-id-setup), puis un
    redémarrage.
wrong-side-event-new-id =
    agenda-training a un machine-id à lui. À son prochain démarrage, il
    demandera une adresse au DHCP sous son propre nom.
wrong-side-event-separate =
    agenda-training est une machine à part entière : sa MAC, son
    machine-id, son adresse ({ $address }). agenda garde 192.0.2.90.
wrong-side-event-end =
    Grace : « L'accueil peut prendre les rendez-vous sur le portail, et
    l'agenda reste l'agenda. Hamid veut apprendre virt-clone maintenant ! »

    Bravo ! Vous avez terminé Le Mauvais Côté.

    CE QUI S'EST PASSÉ
    portal avait été installé avec le réseau par défaut de virt-install :
    le réseau NAT de libvirt, qui n'existe qu'à l'intérieur de foyer. Vous
    avez mis son interface sur le pont de l'hôte, br0, l'avez arrêté et
    redémarré, et le DHCP du bureau lui a donné une adresse que tout le
    monde peut joindre. agenda-training, copié à la main, avait l'adresse
    MAC d'agenda et, dans son disque, le machine-id d'agenda : la même MAC
    sur le pont, le même identifiant client DHCP, la même adresse. Vous avez
    donné à la copie sa propre MAC et son propre machine-id, sans toucher à
    l'original.

    BONNES PRATIQUES
    - Le NAT (le réseau default) pour un invité que personne n'a besoin de
      joindre ; un pont vers le réseau local pour un serveur. virsh
      domiflist dit lequel.
    - Un changement dans la définition d'un domaine s'applique à son
      prochain démarrage, pas à un redémarrage de l'invité. virsh dumpxml
      montre ce qui tourne, --inactive ce qui tournera.
    - Clonez avec virt-clone (nouvel uuid, nouvelle MAC, disque copié),
      source éteinte ; puis préparez l'intérieur : virt-sysprep, ou au
      moins un /etc/machine-id vide et un nouveau nom d'hôte.
    - Deux machines avec une même MAC ou un même machine-id : des symptômes
      qui vont et viennent. Cherchez d'abord les doublons.
    - Ne percez pas de trous dans l'hyperviseur (DNAT) pour joindre un
      invité dont la place est sur le réseau local.

    DOCUMENTATION
    - XML des domaines, interfaces réseau : https://libvirt.org/formatdomain.html#network-interfaces
    - Le réseau dans libvirt : https://wiki.libvirt.org/Networking.html
    - Un pont sur Debian : https://wiki.debian.org/KVM#Setting_up_bridge_networking
    - machine-id : https://www.freedesktop.org/software/systemd/man/latest/machine-id.html
    - virt-clone : https://github.com/virt-manager/virt-manager/blob/main/man/virt-clone.rst
