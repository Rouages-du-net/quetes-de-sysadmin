### Indices gradués de La Maison de santé (voir src/engine/hints.ts) : un
### message par étape, hint-<chapitre>-<événement>, avec .lead (une
### direction, sans la commande exacte) et .solution (presque la réponse).

## Chapitre 1 — Le Démarrage à froid

hint-cold-start-list =
    .lead = Demandez à libvirt tous les domaines, ceux qui sont arrêtés aussi (man virsh, list).
    .solution = virsh list --all
hint-cold-start-autostart-off =
    .lead = Avant de le démarrer, regardez le détail du domaine arrêté : démarre-t-il avec l'hôte ?
    .solution = virsh dominfo ledger
hint-cold-start-paused =
    .lead = Démarrez le domaine, et regardez son état quelques secondes plus tard.
    .solution = virsh start ledger, puis virsh list
hint-cold-start-no-space =
    .lead = Pourquoi est-il en pause ? virsh sait dire la raison et l'erreur du disque ; et regardez les systèmes de fichiers de l'hôte.
    .solution = virsh domstate ledger --reason ; virsh domblkerror ledger ; df -h /var
hint-cold-start-chain =
    .lead = Quelles images forment le disque de ledger ? qemu-img sait suivre une chaîne, et ne doit pas verrouiller une image utilisée (man qemu-img, -U).
    .solution = sudo qemu-img info -U --backing-chain /var/lib/libvirt/images/ledger.before-upgrade ; virsh snapshot-list ledger
hint-cold-start-room =
    .lead = Fusionner demande de la place. Le mot d'Ilse et le message de Priya désignent une image dont rien ne se sert : vérifiez-le, puis supprimez-la.
    .solution = sudo ls -lh /var/lib/libvirt/images ; sudo rm /var/lib/libvirt/images/ledger-test-clone.qcow2
hint-cold-start-merged =
    .lead = Fusionnez toute la chaîne dans sa base pendant que l'invité est en pause : une fusion de la couche active, avec bascule (man virsh, blockcommit).
    .solution = virsh blockcommit ledger vda --active --pivot --verbose
hint-cold-start-cleaned =
    .lead = Les images intermédiaires sont sorties de la chaîne mais toujours sur le disque, et libvirt liste encore les instantanés : supprimez les deux (snapshot-delete a une option pour les métadonnées seules).
    .solution = sudo rm /var/lib/libvirt/images/ledger.before-* ; virsh snapshot-delete ledger before-upgrade --metadata (et les deux autres)
hint-cold-start-resumed =
    .lead = L'invité est toujours en pause : réveillez-le.
    .solution = virsh resume ledger
hint-cold-start-autostart =
    .lead = Faites-le revenir avec l'hôte la prochaine fois (man virsh, autostart).
    .solution = virsh autostart ledger
hint-cold-start-ssh =
    .lead = Vérifiez de l'intérieur : connectez-vous.
    .solution = ssh ledger
hint-cold-start-end =
    .lead = Vérifiez le tout : ledger allumé, autostart, une seule image, /var avec de la place.
    .solution = virsh list --all ; virsh dominfo ledger ; virsh domblklist ledger ; df -h /var

## Chapitre 2 — Le Mauvais Côté

hint-wrong-side-nat-seen =
    .lead = Sur quel réseau est l'interface de portal ? (man virsh, domiflist)
    .solution = virsh domiflist portal
hint-wrong-side-unreachable =
    .lead = Essayez depuis là où ça compte : le PC de l'accueil (ssh reception), avec l'adresse que donne Hamid.
    .solution = ssh reception, puis curl http://192.168.122.47/
hint-wrong-side-config-bridge =
    .lead = Les autres invités sont sur le pont de l'hôte (virsh domiflist agenda). Changez la définition de portal pour que son interface soit de type bridge, sur br0 (man virsh, edit).
    .solution = virsh edit portal : <interface type='bridge'> et <source bridge='br0'/>
hint-wrong-side-bridged =
    .lead = Une nouvelle définition s'applique quand le domaine redémarre, pas quand l'invité redémarre.
    .solution = virsh shutdown portal ; virsh list --all (shut off) ; virsh start portal
hint-wrong-side-reception-ok =
    .lead = Vérifiez depuis le PC de l'accueil, par son nom dans le DNS du bureau.
    .solution = ssh reception, puis curl http://portal.internal/
hint-wrong-side-clash-seen =
    .lead = Comparez l'interface de la copie avec celle de l'original.
    .solution = virsh domiflist agenda ; virsh domiflist agenda-training
hint-wrong-side-new-mac =
    .lead = La copie a besoin d'une MAC à elle : arrêtez-la et retirez la ligne mac de sa définition (libvirt en crée une nouvelle), ou utilisez virt-clone.
    .solution = virsh shutdown agenda-training ; virsh edit agenda-training (supprimez la ligne <mac address=…/>) ; virsh start agenda-training
hint-wrong-side-new-id =
    .lead = Dans la copie, /etc/machine-id est celui d'agenda : videz-le et laissez systemd en créer un nouveau (man systemd-machine-id-setup). Regardez l'invite : ssh tombe sur celle qui répond.
    .solution = ssh agenda-training ; sudo rm /etc/machine-id ; sudo systemd-machine-id-setup
hint-wrong-side-separate =
    .lead = Le client DHCP demande son adresse au démarrage.
    .solution = sudo reboot dans la copie (ou virsh reboot agenda-training) ; virsh domifaddr agenda-training --source arp
hint-wrong-side-end =
    .lead = Vérifiez depuis l'accueil : l'agenda doit toujours être le vrai.
    .solution = ssh reception ; curl http://agenda.internal/ (deux fois)

## Chapitre 3 — À l'étroit

hint-tight-fit-swap =
    .lead = foyer manque-t-il de mémoire ? Regardez sa mémoire vive et son swap.
    .solution = free -h
hint-tight-fit-memstat =
    .lead = Que reçoit chaque invité, et qu'utilise-t-il vraiment ? (man virsh, dominfo, dommemstat)
    .solution = virsh dominfo records ; virsh dommemstat records
hint-tight-fit-memory-fixed =
    .lead = Donnez moins de mémoire à records, maintenant et à son prochain démarrage (man virsh, setmem : --live, --config).
    .solution = virsh setmem records 6G --live --config
hint-tight-fit-guest-full =
    .lead = Regardez le disque de records de l'intérieur.
    .solution = ssh records ; df -h /
hint-tight-fit-snapshot =
    .lead = Grace veut un retour possible avant que vous touchiez au disque (man virsh, snapshot-create-as).
    .solution = virsh snapshot-create-as records before-grow
hint-tight-fit-grown =
    .lead = Agrandissez l'image pendant que records tourne, en passant par QEMU (man virsh, blockresize) ; ou arrêtez-le et utilisez qemu-img resize.
    .solution = virsh blockresize records vda 40G
hint-tight-fit-partition =
    .lead = Dans records, le disque est plus grand ; sa partition, non (lsblk ; man growpart).
    .solution = sudo growpart /dev/vda 1
hint-tight-fit-filesystem =
    .lead = La partition est plus grande ; maintenant le système de fichiers (man resize2fs).
    .solution = sudo resize2fs /dev/vda1 ; df -h /
hint-tight-fit-cleaned =
    .lead = Ça a marché : le filet peut partir, et le vieux dont personne ne se servira aussi.
    .solution = virsh snapshot-list records ; virsh snapshot-delete records before-grow ; virsh snapshot-delete records before-trixie
hint-tight-fit-end =
    .lead = Vérifiez : pas de swap sur foyer, de la place sur records, plus d'instantané.
    .solution = free -h ; virsh snapshot-list records ; ssh records puis df -h /
