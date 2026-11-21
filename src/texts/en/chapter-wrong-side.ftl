### Story "The Health Centre", chapter "The Wrong Side": a guest on
### libvirt's NAT network is unreachable from the office; a copy made by
### hand shares its original's MAC address and machine-id. virsh domiflist,
### net-dhcp-leases, edit, attach-interface, domifaddr, virt-clone,
### systemd-machine-id-setup. Commands, options, paths and outputs are not
### translated.

chapter-wrong-side = The Wrong Side
    .summary = The new patient portal works on the hypervisor, and nowhere else. And since yesterday the reception's appointment book sometimes shows a training copy instead of the real appointments. Find out which side of the bridge each virtual machine is on, and give a hand-made copy an identity of its own.

## Files

wrong-side-message-grace =
    From: Grace (practice manager)
    Tuesday 26 March, 9:10

    Two problems this morning, I'm afraid.

    1. Hamid set up portal last week, the virtual machine for the patients'
    appointment portal. He says it works "on hearth", but at the
    reception desk nothing opens. He left a note on the reception PC
    (ssh reception).

    2. Since yesterday afternoon, the reception's appointment book (agenda)
    sometimes shows "TRAINING COPY" and sample patients instead of today's
    appointments, then the real ones again. Hamid made a copy of agenda
    yesterday to train the two new receptionists on Thursday: they still
    need it, but not instead of the real one!

    Grace

wrong-side-note-hamid =
    Note from Hamid (reception)

    The portal: I installed it on hearth with virt-install, all the default
    options. On hearth, curl http://192.168.122.47/ shows the portal. Here,
    in the reception's browser, nothing.

    The training copy: I copied agenda.qcow2 to agenda-training.qcow2, did
    virsh dumpxml agenda > training.xml, changed the name and the disk,
    and virsh define said the uuid already existed, so I deleted the uuid
    line. Then virsh start, and inside I changed its hostname to
    agenda-training. It works!

    Hamid

## Events

wrong-side-event-nat-seen =
    portal's interface is on the network named "default": libvirt's NAT
    network, a private bridge (virbr0, 192.168.122.0/24) that exists only
    inside hearth. Its guests can go out (hearth masquerades them), but no
    machine of the office can come in: there is no route to 192.168.122.0/24
    anywhere but on hearth. Check it from the reception PC: ssh reception.
wrong-side-event-unreachable =
    Seen from the reception: nothing. Its packets for 192.168.122.47 go to
    the office's router, which has never heard of that network. The other
    guests (agenda, ledger, records) have an address on the office's
    network: how are they connected? virsh domiflist agenda, and
    /etc/network/interfaces on hearth.
wrong-side-event-nat-hack =
    A DNAT rule on hearth would forward one port to portal... until libvirt
    rewrites its own rules (it does when its network restarts), and portal
    would still be invisible for everything else (ssh, the monitoring).
    The guest doesn't need a door in hearth: it needs to be on the office's
    network itself, like agenda.
wrong-side-event-promisc =
    Promiscuous mode makes an interface receive every frame, even those not
    addressed to it. A bridge already does what it must: br0 isn't the
    problem, portal simply isn't plugged into it.
wrong-side-event-config-bridge =
    portal's definition now puts its interface on br0. The running guest
    hasn't changed: QEMU still runs with its old definition (virsh dumpxml
    portal shows the running one, --inactive the next one). A change of
    definition applies when the domain starts again: a full stop, then a
    start.
wrong-side-event-reboot-only =
    virsh reboot reboots the guest inside the same QEMU process: same
    running definition, same NAT network. To apply a new definition, the
    domain must stop and start again (virsh shutdown, wait for "shut off",
    virsh start). Or change the running guest too, with
    detach-interface and attach-interface --live --config.
wrong-side-event-bridged =
    portal is on br0, and the office's DHCP gave it an address:
    { $address }. Now try from where it matters: the reception PC.
wrong-side-event-reception-ok =
    The reception reaches portal: on the office's network, it is a machine
    like the others, with its name in the office's DNS (portal.internal).
wrong-side-event-clash-seen =
    agenda-training has exactly agenda's MAC address, on the same bridge.
    Two machines answering for one MAC: the bridge and the neighbours'
    tables follow whoever spoke last, and the reception gets one, then the
    other. Copying the XML by hand copied the MAC; copying the disk copied
    everything inside it too. virt-clone gives a clone a new MAC and a new
    uuid; inside, the copy still needs an identity of its own.
wrong-side-event-original-changed =
    That is agenda you changed, the real appointment book: its MAC or its
    machine-id. The reception and the office's DHCP know agenda by them
    (192.0.2.90). It is the copy that must change, not the original: put
    agenda back as it was.
wrong-side-event-new-mac =
    agenda-training has a MAC address of its own in its definition. One
    identity left to fix: what is inside the disk. Careful: ssh lands on
    whichever of the two machines answers; read the prompt.
wrong-side-event-same-ip =
    A new MAC, and still the same address: 192.0.2.90 for both. The office's
    DHCP knows a client by its client identifier, and systemd-networkd
    derives it from /etc/machine-id, which the copied disk shares with
    agenda. Give the copy its own machine-id (man machine-id, man
    systemd-machine-id-setup), then a reboot.
wrong-side-event-new-id =
    agenda-training has a machine-id of its own. At its next boot it will
    ask the DHCP for an address under its own name.
wrong-side-event-separate =
    agenda-training is a machine of its own: its MAC, its machine-id, its
    address ({ $address }). agenda keeps 192.0.2.90.
wrong-side-event-end =
    Grace: "The reception can book patients on the portal, and the
    appointment book stays the appointment book. Hamid wants to learn
    virt-clone now!"

    Well done! You finished The Wrong Side.

    WHAT HAPPENED
    portal was installed with virt-install's default network: libvirt's NAT
    network, which only exists inside hearth. You moved its interface to
    the host's bridge br0, stopped and started it, and the office's DHCP
    gave it an address everyone can reach. agenda-training, copied by hand,
    had agenda's MAC address and, inside its disk, agenda's machine-id: the
    same MAC on the bridge, the same DHCP client identifier, the same
    address. You gave the copy its own MAC and its own machine-id, and
    left the original alone.

    GOOD PRACTICE
    - NAT (the default network) for a guest nobody needs to reach; a
      bridge to the LAN for a server. virsh domiflist tells you which.
    - A change in a domain's definition applies at its next start, not at a
      guest reboot. virsh dumpxml shows what runs, --inactive what will.
    - Clone with virt-clone (new uuid, new MAC, the disk copied), the source
      shut off; then prepare the inside: virt-sysprep, or at least an empty
      /etc/machine-id and a new hostname.
    - Two machines with one MAC address or one machine-id: symptoms that
      come and go. Look for duplicates first.
    - Don't punch holes in the hypervisor (DNAT) to reach a guest that
      belongs on the LAN.

    DOCUMENTATION
    - Domain XML, network interfaces: https://libvirt.org/formatdomain.html#network-interfaces
    - libvirt networking: https://wiki.libvirt.org/Networking.html
    - A bridge on Debian: https://wiki.debian.org/KVM#Setting_up_bridge_networking
    - machine-id: https://www.freedesktop.org/software/systemd/man/latest/machine-id.html
    - virt-clone: https://github.com/virt-manager/virt-manager/blob/main/man/virt-clone.rst
