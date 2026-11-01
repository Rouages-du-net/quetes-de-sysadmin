### Story "The Hive", chapter "VLANs": a Debian router behind
### a switch split into VLANs. The commands, the interface names and the
### syntax of /etc/network/interfaces are not translated.

chapter-vlan = VLANs
    .summary = The switch has been split into three VLANs; the router still talks flat. 802.1Q interfaces, and make them survive a reboot.

## Files

vlan-email-malik =
    From:    Malik (facilities manager at The Hive)
    To:      you
    Subject: No network since this morning

    The electrician came by this weekend: he "split the network into VLANs"
    on the switch, so that the guest Wi-Fi can no longer see our
    computers, the printer or the cameras. His plan is in
    switch-plan.txt.

    Since then, nothing works: even the office NAS doesn't answer any more!
    He told me: "it's up to the router to follow, you need to create the
    VLAN interfaces on it". The router is this machine (eth0 to the
    provider's box, eth1 to the switch).

    The previous contractor configured the network in /etc/network/interfaces
    (man interfaces). And to see what's happening right now: man ip.

    For sudo: bee-2027

vlan-plan-switch =
    SWITCH PLAN — The Hive (electrician, November 2027)

    Port 1     : to the router (eth1). 802.1Q TRUNK: VLAN 10, 20, 30
                 tagged. Nothing left on the native VLAN.
    Ports 2-12 : VLAN 10 "bureaux"      (untagged, offices)
    Ports 13-16: VLAN 20 "invites"      (café Wi-Fi access points)
    Ports 17-20: VLAN 30 "equipements"  (printer, cameras)

    Addresses (to configure on the router):
      VLAN 10  bureaux      10.10.10.0/24   router: 10.10.10.1
      VLAN 20  invites      10.10.20.0/24   router: 10.10.20.1
      VLAN 30  equipements  10.10.30.0/24   router: 10.10.30.1

    Devices with a fixed address:
      nas           10.10.10.5   (VLAN 10)
      imprimante    10.10.30.10  (VLAN 30)
      camera-entree 10.10.30.11  (VLAN 30)

## Events

vlan-event-bad-number =
    One of your VLAN interfaces has an address on a network… but not the right
    VLAN number: its frames go out tagged with another number, and
    the switch doesn't put them in the right VLAN. A ping to a device
    on that network shows it (Destination Host Unreachable). Check with
    ip -d link show.
vlan-event-in-place =
    All three VLANs respond: the NAS, the printer and the camera too (ping).
    But what you did with ip will disappear at the next reboot: only
    /etc/network/interfaces is read again at boot. Write the three VLANs there
    (man interfaces), then ifup.
vlan-event-end =
    The three VLANs are up, and written down to last. Malik: "The NAS is
    back! And the café Wi-Fi can't see the printer any more, that's what
    the electrician wanted."

    Well done! You've finished the chapter "VLANs".

    WHAT HAPPENED
    A VLAN splits a switch into several separate networks. On a
    "trunk" port, several VLANs share the same cable: each frame carries
    an 802.1Q tag with its number. So the router needs one
    interface per VLAN (eth1.10, eth1.20, eth1.30), with its address in
    each network. Without a tag, its frames landed in the native VLAN,
    where there's nobody left.

    GOOD PRACTICE
    - One VLAN per use: offices, guests, equipment (printers,
      cameras, phones), administration.
    - The plan written down somewhere (numbers, networks, ports), and kept up to date.
    - ip to try things out, /etc/network/interfaces (or systemd-networkd) to
      make them last; ip -d link show to check the number.
    - A trunk's native VLAN: empty, or at least not the one for
      sensitive equipment.

    ANOTHER WAY
    systemd-networkd (.netdev and .network files) or NetworkManager
    (nmcli) describe the same VLANs differently. Debian keeps ifupdown on
    servers; Ubuntu goes through netplan, which writes the configuration for
    systemd-networkd. The principle doesn't change: one interface per VLAN,
    on the card connected to the trunk.

    DOCUMENTATION
    - interfaces (Debian): https://manpages.debian.org/trixie/ifupdown/interfaces.5.en.html
    - VLAN in interfaces: https://manpages.debian.org/trixie/vlan/vlan-interfaces.5.en.html
    - ip link: https://man7.org/linux/man-pages/man8/ip-link.8.html
