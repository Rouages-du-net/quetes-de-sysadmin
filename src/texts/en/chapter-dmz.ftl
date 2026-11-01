### Story "The Hive", chapter "The DMZ": a public server in a separate
### VLAN, destination translation (dnat) and the firewall. Commands, nft
### keywords, interface names and paths are not translated.

chapter-dmz = The DMZ
    .summary = The room booking website is now hosted on site: a separate VLAN (the DMZ), destination translation to make it reachable from the internet, and a server that sees nothing of the rest.

## Files

dmz-email-ines =
    From:    Inès (volunteer, La Ruche's website)
    To:      you
    Subject: The booking website, at our place!

    Hello! Malik told me you look after the router. We're no longer paying
    the hosting company: the room booking website now runs on a small
    server here, "web" (10.10.40.10, gateway 10.10.40.1). It answers over
    HTTP and HTTPS (ports 80 and 443).

    The electrician plugged it into port 21 of the switch, in a new
    VLAN 40: the "DMZ", he said. His plan is in
    switch-plan.txt.

    For people to find it, whatever arrives at the router's public
    address (192.0.2.21), ports 80 and 443, should go to the server. And
    it must be able to fetch its updates from the internet.

    Malik adds: "A server open to the internet is the one that gets
    attacked. If it falls, it mustn't see anything else of ours: not the
    NAS, not the printer." The offices, however, must be able to connect
    to it over ssh to administer it.

    To watch visits go by: sudo conntrack -L. The rest: man nft
    (dnat), man interfaces.

    For sudo: bee-2027

dmz-plan-switch =
    SWITCH PLAN — La Ruche (electrician, updated January 2028)

    Port 1     : to the router (eth1). 802.1Q TRUNK: VLAN 10, 20, 30, 40
                 tagged.
    Ports 2-12 : VLAN 10 "bureaux"
    Ports 13-16: VLAN 20 "invites"
    Ports 17-20: VLAN 30 "equipements"
    Port 21    : VLAN 40 "dmz" (the web server)

    Addresses:
      VLAN 40  dmz          10.10.40.0/24   router  : 10.10.40.1
                                            web     : 10.10.40.10 (static)

## Events

# { $adresse }: the router's public address
dmz-event-address-public =
    A rule in the forward chain expects the address { $adresse }… but it
    will never see it: destination translation (dnat) happens earlier,
    at the prerouting hook. When the packet reaches forward, it is already
    going to 10.10.40.10. That is the address forward must let through.
dmz-event-without-forward =
    Inès: "The website still doesn't answer from home." The router does
    translate the destination (sudo nft list ruleset), but the translated
    packet then goes through the forward chain, closed by default: nothing
    there lets the internet through to the DMZ.
dmz-event-too-open =
    Careful: with these rules, the DMZ is too open. Either the internet
    reaches the server on ports other than 80 and 443 (ssh, for example),
    or the server can open connections to the internal network. A DMZ
    only lets in what it publishes, and lets nothing out towards the
    inside.
dmz-event-in-place =
    The website answers, and the DMZ holds… for now. But after the next
    reboot? The eth1.40 interface must be in
    /etc/network/interfaces, and the rules in /etc/nftables.conf.
dmz-event-end =
    The booking website answers from the internet, the server gets its
    updates, the offices administer it, and if it is ever hacked, it sees
    neither the NAS nor the printer. Inès: "And hosting doesn't cost us
    anything any more!"

    Well done! You have finished the chapter "The DMZ".

    WHAT HAPPENED
    The router has only one public address. Destination translation
    (dnat, in a nat chain at the prerouting hook) changes the destination
    of packets arriving on certain ports: they are sent on to the server,
    and connection tracking returns the replies with the router's address.
    Since this change happens BEFORE routing, the forward chain already
    sees the new destination. The DMZ (demilitarised zone) is a separate
    network for whatever is visible from the internet.

    GOOD PRACTICE
    - Only publish the ports you need (80, 443), never "everything" to a
      server.
    - The DMZ cannot open anything towards the internal network; it is the
      inside that goes to it (administration from the offices).
    - In forward, write the destination AFTER translation (the server's
      address), and test with sudo conntrack -L.

    DOCUMENTATION
    - NAT with nftables: https://wiki.nftables.org/wiki-nftables/index.php/Performing_Network_Address_Translation_(NAT)
    - The path of packets (hooks): https://wiki.nftables.org/wiki-nftables/index.php/Netfilter_hooks
