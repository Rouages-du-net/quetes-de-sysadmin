### Pistas graduales de «El Centro de Salud» (ver src/engine/hints.ts): un
### mensaje por paso, hint-<capítulo>-<evento>, con .lead (una pista, sin el
### comando exacto) y .solution (casi la respuesta).

## Capítulo 1 — El arranque en frío

hint-cold-start-list =
    .lead = Pide a libvirt todos los dominios, también los parados (man virsh, list).
    .solution = virsh list --all
hint-cold-start-autostart-off =
    .lead = Antes de arrancarlo, mira los detalles del dominio parado: ¿arranca con el anfitrión?
    .solution = virsh dominfo ledger
hint-cold-start-paused =
    .lead = Arranca el dominio, y mira su estado unos segundos después.
    .solution = virsh start ledger, luego virsh list
hint-cold-start-no-space =
    .lead = ¿Por qué está en pausa? virsh puede decir el motivo y el error del disco; y mira los sistemas de archivos del anfitrión.
    .solution = virsh domstate ledger --reason; virsh domblkerror ledger; df -h /var
hint-cold-start-chain =
    .lead = ¿Qué imágenes forman el disco de ledger? qemu-img puede seguir una cadena de respaldo, y no debe bloquear una imagen en uso (man qemu-img, -U).
    .solution = sudo qemu-img info -U --backing-chain /var/lib/libvirt/images/ledger.before-upgrade; virsh snapshot-list ledger
hint-cold-start-room =
    .lead = Fusionar necesita sitio. La nota de Ilse y el mensaje de Priya nombran una imagen que nada usa: comprueba que nada la usa, y luego bórrala.
    .solution = sudo ls -lh /var/lib/libvirt/images; sudo rm /var/lib/libvirt/images/ledger-test-clone.qcow2
hint-cold-start-merged =
    .lead = Fusiona toda la cadena en su base mientras el invitado está en pausa: un block commit de la capa activa, con pivot (man virsh, blockcommit).
    .solution = virsh blockcommit ledger vda --active --pivot --verbose
hint-cold-start-cleaned =
    .lead = Las capas están fuera de la cadena pero siguen en el disco, y libvirt sigue listando las instantáneas: quita ambas cosas (snapshot-delete tiene una opción para los metadatos solos).
    .solution = sudo rm /var/lib/libvirt/images/ledger.before-*; virsh snapshot-delete ledger before-upgrade --metadata (y las otras dos)
hint-cold-start-resumed =
    .lead = El invitado sigue en pausa: despiértalo.
    .solution = virsh resume ledger
hint-cold-start-autostart =
    .lead = Haz que vuelva con el anfitrión la próxima vez (man virsh, autostart).
    .solution = virsh autostart ledger
hint-cold-start-ssh =
    .lead = Compruébalo desde dentro: conéctate a él.
    .solution = ssh ledger
hint-cold-start-end =
    .lead = Comprueba el conjunto: ledger en marcha, autostart, una sola imagen, /var con sitio.
    .solution = virsh list --all; virsh dominfo ledger; virsh domblklist ledger; df -h /var

## Capítulo 2 — El lado equivocado

hint-wrong-side-nat-seen =
    .lead = ¿En qué red está la interfaz de portal? (man virsh, domiflist)
    .solution = virsh domiflist portal
hint-wrong-side-unreachable =
    .lead = Prueba desde donde importa: el PC de recepción (ssh reception), con la dirección que da Hamid.
    .solution = ssh reception, luego curl http://192.168.122.47/
hint-wrong-side-config-bridge =
    .lead = Los otros invitados están en el puente del anfitrión (virsh domiflist agenda). Cambia la definición de portal para que su interfaz sea de tipo bridge, en br0 (man virsh, edit).
    .solution = virsh edit portal: <interface type='bridge'> y <source bridge='br0'/>
hint-wrong-side-bridged =
    .lead = Una definición nueva se aplica cuando el dominio vuelve a arrancar, no en un reinicio del invitado.
    .solution = virsh shutdown portal; virsh list --all (shut off); virsh start portal
hint-wrong-side-reception-ok =
    .lead = Comprueba desde el PC de recepción, por su nombre en el DNS de la oficina.
    .solution = ssh reception, luego curl http://portal.internal/
hint-wrong-side-clash-seen =
    .lead = Compara la interfaz de la copia con la del original.
    .solution = virsh domiflist agenda; virsh domiflist agenda-training
hint-wrong-side-new-mac =
    .lead = La copia necesita una MAC propia: párala, y quita la línea mac de su definición (libvirt crea una nueva), o usa virt-clone.
    .solution = virsh shutdown agenda-training; virsh edit agenda-training (borra la línea <mac address=…/>); virsh start agenda-training
hint-wrong-side-new-id =
    .lead = Dentro de la copia, /etc/machine-id es el de agenda: vacíalo y deja que systemd cree uno nuevo (man systemd-machine-id-setup). Mira el prompt: ssh llega a la que responda.
    .solution = ssh agenda-training; sudo rm /etc/machine-id; sudo systemd-machine-id-setup
hint-wrong-side-separate =
    .lead = El cliente DHCP pide su dirección al arrancar.
    .solution = sudo reboot en la copia (o virsh reboot agenda-training); virsh domifaddr agenda-training --source arp
hint-wrong-side-end =
    .lead = Comprueba desde recepción: la agenda de citas debería ser siempre la de verdad.
    .solution = ssh reception; curl http://agenda.internal/ (dos veces)

## Capítulo 3 — Muy justo

hint-tight-fit-swap =
    .lead = ¿Le falta memoria a hogar? Mira su RAM y su swap.
    .solution = free -h
hint-tight-fit-memstat =
    .lead = ¿Qué recibe cada invitado, y qué usa de verdad? (man virsh, dominfo, dommemstat)
    .solution = virsh dominfo records; virsh dommemstat records
hint-tight-fit-memory-fixed =
    .lead = Dale a records menos memoria, ahora y en su próximo arranque (man virsh, setmem: --live, --config).
    .solution = virsh setmem records 6G --live --config
hint-tight-fit-guest-full =
    .lead = Mira el disco de records desde dentro.
    .solution = ssh records; df -h /
hint-tight-fit-snapshot =
    .lead = Grace quiere una forma de volver atrás antes de que toques el disco (man virsh, snapshot-create-as).
    .solution = virsh snapshot-create-as records before-grow
hint-tight-fit-grown =
    .lead = Amplía la imagen mientras records funciona, a través de QEMU (man virsh, blockresize); o apágalo y usa qemu-img resize.
    .solution = virsh blockresize records vda 40G
hint-tight-fit-partition =
    .lead = Dentro de records, el disco es más grande; su partición no (lsblk; man growpart).
    .solution = sudo growpart /dev/vda 1
hint-tight-fit-filesystem =
    .lead = La partición es más grande; ahora el sistema de archivos (man resize2fs).
    .solution = sudo resize2fs /dev/vda1; df -h /
hint-tight-fit-cleaned =
    .lead = Ha funcionado: la red de seguridad puede irse, y también la antigua que nadie usará.
    .solution = virsh snapshot-list records; virsh snapshot-delete records before-grow; virsh snapshot-delete records before-trixie
hint-tight-fit-end =
    .lead = Comprueba: sin swap en hogar, sitio en records, ninguna instantánea.
    .solution = free -h; virsh snapshot-list records; ssh records, luego df -h /
