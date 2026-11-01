### Story "The Hive", chapter "DHCP": dnsmasq hands out addresses in each
### VLAN. dnsmasq options, commands and paths are not translated.

chapter-dhcp = DHCP
    .resume = The VLANs are there, but nobody has an address: one DHCP range per VLAN with dnsmasq, a reservation for the printer, and not a word towards the ISP box.

## Files

dhcp-email-malik =
    From:    Malik
    To:      you
    Subject: VLANs are great, but…

    The NAS and the camera answer, thanks! But the office computers and
    the café's wifi still have no address. They ask the router for one
    over DHCP: dnsmasq handles that (/etc/dnsmasq.d, man dnsmasq). It is
    still serving the old flat network.

    Another thing: the new printer arrived. It can only get its address
    over DHCP, but every computer expects it at 10.10.30.10. Its MAC
    address is on the label: 00:00:5e:00:53:30.

    And the electrician made me promise to tell you: "above all, the DHCP
    must NEVER answer on the ISP box's side". I didn't quite understand.

    The journal (journalctl -u dnsmasq) and the lease file
    (/var/lib/misc/dnsmasq.leases) tell who got what.

    For sudo: bee-2027

## Events

dhcp-event-wan =
    Careful: dnsmasq listens on every interface, including eth0, the
    internet provider's network. A DHCP server answering at the
    neighbours' (a "rogue DHCP server") is the kind of failure that cuts
    off a whole neighbourhood. Tell dnsmasq where it is allowed to listen
    (interface=, or except-interface=eth0).
# { $adresse }: the printer's expected address
dhcp-event-printer-elsewhere =
    The printer got an address… but not { $adresse }, and the computers
    can't find it. dnsmasq can reserve an address for a device, based on
    its MAC address (man dnsmasq: dhcp-host).
dhcp-event-end =
    Every device has its address in its VLAN, the printer is in its place,
    and the ISP box hears nothing. Malik: "The café has wifi, the offices
    have internet… well, almost: apparently nothing gets out yet."

    Well done! You have finished the chapter "DHCP".

    WHAT HAPPENED
    A device that joins a network shouts "can anyone give me an
    address?" (DHCPDISCOVER). The network's DHCP server answers (OFFER),
    the device accepts (REQUEST), the server confirms (ACK) and records
    the lease. dnsmasq picks the range based on the interface where the
    request arrives: one range per VLAN, in each interface's network.

    GOOD PRACTICE
    - One range per network, and reservations (MAC → address) for what
      must be found: printers, servers, cameras.
    - Limit the interfaces where DHCP listens: never on the internet side.
    - dnsmasq --test before restarting; the journal and the lease file to
      check.

    ANOTHER WAY
    Kea, ISC's DHCP server, which replaces isc-dhcp-server (end of life
    since late 2022): databases, high availability, API, but heavier to
    install. dnsmasq does DHCP and DNS caching in a single small program:
    ideal for a small network.

    DOCUMENTATION
    - dnsmasq: https://dnsmasq.org/docs/dnsmasq-man.html
