### Historia «El Centro de Salud», capítulo «El lado equivocado»: un
### invitado en la red NAT de libvirt no se alcanza desde la oficina; una
### copia hecha a mano comparte la dirección MAC y el machine-id de su
### original. virsh domiflist, net-dhcp-leases, edit, attach-interface,
### domifaddr, virt-clone, systemd-machine-id-setup. Los comandos, las
### opciones, las rutas y las salidas no se traducen.

chapter-wrong-side = El lado equivocado
    .summary = El nuevo portal de pacientes funciona en el hipervisor, y en ningún otro sitio. Y desde ayer la agenda de citas de recepción a veces muestra una copia de formación en lugar de las citas reales. Averigua a qué lado del puente está cada máquina virtual, y da a una copia hecha a mano una identidad propia.

## Archivos

wrong-side-message-grace =
    De: Grace (gerente del centro)
    Martes 26 de marzo, 9:10

    Dos problemas esta mañana, me temo.

    1. Hamid montó la semana pasada portal, la máquina virtual del portal
    de citas para pacientes. Dice que funciona «en hogar», pero en el
    mostrador de recepción no se abre nada. Dejó una nota en el PC de
    recepción (ssh reception).

    2. Desde ayer por la tarde, la agenda de citas de recepción (agenda) a
    veces muestra «TRAINING COPY» y pacientes de ejemplo en lugar de las
    citas de hoy, y luego otra vez las reales. Hamid hizo ayer una copia
    de agenda para formar el jueves a las dos nuevas recepcionistas: la
    siguen necesitando, ¡pero no en lugar de la de verdad!

    Grace

wrong-side-note-hamid =
    Nota de Hamid (recepción)

    El portal: lo instalé en hogar con virt-install, todas las opciones
    por defecto. En hogar, curl http://192.168.122.47/ muestra el portal.
    Aquí, en el navegador de recepción, nada.

    La copia de formación: copié agenda.qcow2 a agenda-training.qcow2,
    hice virsh dumpxml agenda > training.xml, cambié el nombre y el disco,
    y virsh define dijo que el uuid ya existía, así que borré la línea del
    uuid. Luego virsh start, y dentro le cambié el nombre de máquina a
    agenda-training. ¡Funciona!

    Hamid

## Eventos

wrong-side-event-nat-seen =
    La interfaz de portal está en la red llamada «default»: la red NAT de
    libvirt, un puente privado (virbr0, 192.168.122.0/24) que solo existe
    dentro de hogar. Sus invitados pueden salir (hogar los enmascara),
    pero ninguna máquina de la oficina puede entrar: no hay ninguna ruta
    hacia 192.168.122.0/24 en ningún sitio salvo en hogar. Compruébalo
    desde el PC de recepción: ssh reception.
wrong-side-event-unreachable =
    Visto desde recepción: nada. Sus paquetes para 192.168.122.47 van al
    router de la oficina, que nunca ha oído hablar de esa red. Los otros
    invitados (agenda, ledger, records) tienen una dirección en la red de
    la oficina: ¿cómo están conectados? virsh domiflist agenda, y
    /etc/network/interfaces en hogar.
wrong-side-event-nat-hack =
    Una regla DNAT en hogar redirigiría un puerto a portal... hasta que
    libvirt reescriba sus propias reglas (lo hace cuando su red se
    reinicia), y portal seguiría siendo invisible para todo lo demás (ssh,
    la monitorización). El invitado no necesita una puerta en hogar:
    necesita estar él mismo en la red de la oficina, como agenda.
wrong-side-event-promisc =
    El modo promiscuo hace que una interfaz reciba todas las tramas,
    incluso las que no van dirigidas a ella. Un puente ya hace lo que
    debe: br0 no es el problema, portal simplemente no está conectado a
    él.
wrong-side-event-config-bridge =
    La definición de portal pone ahora su interfaz en br0. El invitado en
    marcha no ha cambiado: QEMU sigue funcionando con su definición
    antigua (virsh dumpxml portal muestra la que funciona, --inactive la
    siguiente). Un cambio de definición se aplica cuando el dominio vuelve
    a arrancar: una parada completa, luego un arranque.
wrong-side-event-reboot-only =
    virsh reboot reinicia el invitado dentro del mismo proceso QEMU: la
    misma definición en marcha, la misma red NAT. Para aplicar una
    definición nueva, el dominio tiene que pararse y volver a arrancar
    (virsh shutdown, esperar a «shut off», virsh start). O cambiar
    también el invitado en marcha, con detach-interface y
    attach-interface --live --config.
wrong-side-event-bridged =
    portal está en br0, y el DHCP de la oficina le ha dado una dirección:
    { $address }. Ahora prueba desde donde importa: el PC de recepción.
wrong-side-event-reception-ok =
    Recepción llega a portal: en la red de la oficina, es una máquina como
    las demás, con su nombre en el DNS de la oficina (portal.internal).
wrong-side-event-clash-seen =
    agenda-training tiene exactamente la dirección MAC de agenda, en el
    mismo puente. Dos máquinas que responden por una MAC: el puente y las
    tablas de los vecinos siguen a quien habló el último, y recepción
    recibe una, luego la otra. Copiar el XML a mano copió la MAC; copiar el
    disco copió también todo lo que hay dentro. virt-clone da a un clon una
    MAC nueva y un uuid nuevo; dentro, la copia todavía necesita una
    identidad propia.
wrong-side-event-original-changed =
    Has cambiado agenda, la agenda de citas de verdad: su MAC o su
    machine-id. Recepción y el DHCP de la oficina conocen agenda por ellos
    (192.0.2.90). Es la copia la que tiene que cambiar, no el original:
    deja agenda como estaba.
wrong-side-event-new-mac =
    agenda-training tiene una dirección MAC propia en su definición. Queda
    una identidad por arreglar: lo que hay dentro del disco. Cuidado: ssh
    llega a cualquiera de las dos máquinas que responda; lee el prompt.
wrong-side-event-same-ip =
    Una MAC nueva, y sigue la misma dirección: 192.0.2.90 para las dos. El
    DHCP de la oficina reconoce a un cliente por su identificador de
    cliente, y systemd-networkd lo deriva de /etc/machine-id, que el disco
    copiado comparte con agenda. Da a la copia su propio machine-id (man
    machine-id, man systemd-machine-id-setup), y luego reinicia.
wrong-side-event-new-id =
    agenda-training tiene un machine-id propio. En su próximo arranque
    pedirá al DHCP una dirección con su propio nombre.
wrong-side-event-separate =
    agenda-training es una máquina aparte: su MAC, su machine-id, su
    dirección ({ $address }). agenda conserva 192.0.2.90.
wrong-side-event-end =
    Grace: «Recepción puede dar citas a los pacientes en el portal, y la
    agenda de citas sigue siendo la agenda de citas. ¡Hamid quiere
    aprender virt-clone ahora!»

    ¡Bien hecho! Has terminado el capítulo «El lado equivocado».

    QUÉ HA PASADO
    portal se instaló con la red por defecto de virt-install: la red NAT
    de libvirt, que solo existe dentro de hogar. Pasaste su interfaz al
    puente br0 del anfitrión, lo paraste y lo arrancaste, y el DHCP de la
    oficina le dio una dirección a la que todo el mundo llega.
    agenda-training, copiada a mano, tenía la dirección MAC de agenda y,
    dentro de su disco, el machine-id de agenda: la misma MAC en el
    puente, el mismo identificador de cliente DHCP, la misma dirección.
    Diste a la copia su propia MAC y su propio machine-id, y no tocaste el
    original.

    BUENA PRÁCTICA
    - NAT (la red por defecto) para un invitado al que nadie necesita
      llegar; un puente hacia la LAN para un servidor. virsh domiflist te
      dice cuál.
    - Un cambio en la definición de un dominio se aplica en su próximo
      arranque, no en un reinicio del invitado. virsh dumpxml muestra lo
      que funciona, --inactive lo que funcionará.
    - Clona con virt-clone (uuid nuevo, MAC nueva, el disco copiado), con
      el origen apagado; luego prepara el interior: virt-sysprep, o al
      menos un /etc/machine-id vacío y un nombre de máquina nuevo.
    - Dos máquinas con una misma dirección MAC o un mismo machine-id:
      síntomas que van y vienen. Busca primero los duplicados.
    - No abras agujeros en el hipervisor (DNAT) para llegar a un invitado
      que debería estar en la LAN.

    DOCUMENTACIÓN
    - Domain XML, interfaces de red: https://libvirt.org/formatdomain.html#network-interfaces
    - Redes en libvirt: https://wiki.libvirt.org/Networking.html
    - Un puente en Debian: https://wiki.debian.org/KVM#Setting_up_bridge_networking
    - machine-id: https://www.freedesktop.org/software/systemd/man/latest/machine-id.html
    - virt-clone: https://github.com/virt-manager/virt-manager/blob/main/man/virt-clone.rst
