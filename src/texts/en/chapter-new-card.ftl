### Story "The Ferry", chapter "The New Card": quay's SLAAC address
### followed its new network card, the AAAA records still name the old one.
### ip -6, link-local and %eth0, a static address (inet6 static), the BIND
### zone and its serial. Commands, options, addresses, paths and outputs
### are not translated.

chapter-new-card = The New Card
    .summary = Since the ferry cooperative's server got a new network card, its site no longer answers in IPv6, only for passengers on mobile data. Read its IPv6 addresses and routes, give it an address that won't move again, and publish it in the DNS zone.

## Files

new-card-message-amaru =
    From: Amaru (ferry cooperative)
    Tuesday 10 April, 9:00

    Hello, and welcome aboard!

    Something is wrong with the site since last week, and only for some
    people. On the office Wi-Fi, the timetable shows at once. On my phone,
    on mobile data, it spins for a long time; sometimes it shows in the
    end, sometimes it says the site can't be reached. Passengers have
    called about it.

    Last Tuesday the server's network card died. The computer shop on the
    mainland put in a new one, and everything started again. Since then,
    I think. Tevita, who set the server up, has moved to the mainland; he
    told me on the phone that the island's internet "went IPv6" a month
    ago, and that he "added the AAAA".

    Rangi, at islenet, sent an email about addresses: it's in your home
    directory. islenet also lends us its monitoring box, lookout, to look
    at the server from outside (ssh lookout).

    Amaru

new-card-email-rangi =
    From: Rangi (islenet, the island's fibre cooperative)
    To: the ferry cooperative
    Subject: IPv6, your server's address

    Hello,

    As announced, IPv6 has been on since 5 March. Our router advertises
    your link's prefix, { $prefix }, and your server builds its own
    address in it (SLAAC). That's fine for a laptop. For a server whose
    address is in the DNS, I recommend a fixed one: we keep
    { $address } for you in our records. Our router is
    2001:db8:4e1:20::1 on that link (you'll see its link-local address as
    the gateway).

    Your DNS zone is still yours: ns1 is your server, and
    ns2.islenet.example, our secondary, copies the zone when its serial
    goes up.

    Rangi

## Events

new-card-event-addresses =
    eth0 has three kinds of IPv6 addresses. fe80::…/64, "scope link": the
    link-local address, which every IPv6 interface gives itself and which
    is only valid on its own link. 2001:db8:4e1:20:…/64, "scope global
    dynamic": a global address, built by SLAAC, from the router's prefix
    (the first 64 bits) and an identifier the machine computes itself. And
    lo has ::1. Look closely at the end of the two eth0 addresses, and at
    the card's MAC address (ip link).
new-card-event-mac =
    The MAC address of the new card is 00:00:5e:00:53:7c. Insert ff:fe in
    the middle, flip one bit of the first byte (00 becomes 02): 0200:5eff:fe00:537c.
    That's the end of both eth0 addresses: the interface identifier
    "modified EUI-64". New card, new MAC, so a new IPv6 address.
new-card-event-route =
    The IPv6 default route goes "via fe80::200:5eff:fe00:5301 dev eth0
    proto ra": through the router's link-local address, learnt from its
    advertisements (ra: router advertisement). A link-local address
    exists on every link at once: to reach it, you must say which one.
new-card-event-zone-needed =
    ping doesn't know which link to send a link-local address on: every
    interface has its own fe80::/64. Add the interface after a %:
    fe80::200:5eff:fe00:5301%eth0 (or ping -I eth0).
new-card-event-router =
    The router answers on its link-local address: the link works in IPv6.
    So the server is reachable... at its new address. What does the DNS
    give out? (dig, the AAAA type)
new-card-event-old-record =
    There it is: the DNS still gives 2001:db8:4e1:20:200:5eff:fe00:532a,
    the address the old card built (its MAC ended in 53:2a). Nobody has
    that address any more: phones that try IPv6 first wait for nothing,
    then fall back to IPv4 when they can. Rangi's advice: an address that
    doesn't depend on the card.
new-card-event-cut =
    The ssh session dropped: ifdown eth0 took down the very interface you
    were connected through. Amaru, at the office, typed ifup eth0 on the
    server's screen, and it's back (ssh quay). Over ssh, change an
    address with ip, or bring the network up again in one go (systemctl
    restart networking), never ifdown alone.
new-card-event-already =
    ifup refuses: eth0 is already up (ifupdown remembers it in
    /run/network/ifstate). To apply the file without cutting your own
    session, systemctl restart networking takes everything down and up
    again in one go; or add the address right away with ip -6 addr add,
    and leave the file for the next boot.
new-card-event-wrong-prefix =
    That address isn't in the link's prefix ({ $prefix }): the router will
    never send it anything. Delete it (ip -6 addr del, and the file) and
    take one in the prefix, the one Rangi keeps for you.
new-card-event-static-now =
    eth0 now carries a fixed address in the prefix, next to the SLAAC
    one. It's there until the next reboot only: write it in
    /etc/network/interfaces (an "iface eth0 inet6 static" stanza, man
    interfaces).
new-card-event-static-boot =
    At the next boot, ifupdown will give eth0 its fixed address, and the
    IPv6 route will still be there. Now the DNS.
new-card-event-no-route-boot =
    Careful: with this file, eth0 would boot with its address but without
    an IPv6 default route (accept_ra 0 refuses the router's advertisements,
    and there's no gateway). Add the gateway (the router's link-local
    address), or leave accept_ra alone.
new-card-event-no-route =
    quay has no IPv6 default route any more: it only reaches its own
    link. Bring back the router's advertisements (accept_ra), or give a
    gateway: ip -6 route add default via fe80::200:5eff:fe00:5301 dev eth0.
new-card-event-zone-loaded =
    named has loaded the new zone: dig @localhost gives the new address.
    And the rest of the internet? It also asks ns2.islenet.example.
new-card-event-serial =
    Your server gives the new address, but ns2.islenet.example, the
    secondary, still gives the old one: it only copies the zone when its
    serial (the first number of the SOA) goes up. Increase it (the
    convention: the date and a counter, 2029041001), check the file
    (named-checkzone), rndc reload.
new-card-event-slaac-record =
    The DNS now gives the address built from the new card. It works today,
    and it will break again at the next change of card (or of
    motherboard). A server's address in the DNS should be a fixed one.
new-card-event-published =
    The zone's public servers give quay's fixed address, for ferry.example,
    www and quay. lookout can check it from outside (ssh lookout, then
    ping6 www.ferry.example).
new-card-event-seen-outside =
    From the internet, www.ferry.example answers ping in IPv6, at its
    fixed address.
new-card-event-end =
    Amaru: "On my phone, the timetable shows at once now. Thank you!"
    (Between us, his phone still gets the page in IPv4: try curl -6 from
    lookout. That's for another day.)

    Well done! You finished chapter 1 of The Ferry. (What comes next is
    waiting for you: ssh quay.)

    WHAT HAPPENED
    quay built its IPv6 address by itself (SLAAC): the prefix the router
    advertises, then an identifier computed from the network card's MAC
    address (modified EUI-64). The new card brought a new address, but the
    AAAA records still named the old one: IPv6 clients knocked on an
    address nobody had. You gave quay a fixed address, { $address }, now
    (ip -6 addr add) and at boot (iface eth0 inet6 static), and published
    it: the AAAA records, a higher serial, named-checkzone, rndc reload.

    GOOD PRACTICE
    - A server in the DNS gets a fixed IPv6 address; SLAAC is for
      machines nobody looks for by name.
    - ip -6 addr: scope link (fe80::, valid on one link) and scope global;
      ip -6 route: the gateway is often the router's link-local address.
    - A link-local address needs its interface: fe80::…%eth0.
    - Over ssh, never ifdown the interface you are connected through.
    - Every change of a zone raises its serial, or the secondaries keep
      the old version.
    - Check from outside, in each family: ping -6, curl -6.

    DOCUMENTATION
    - SLAAC (RFC 4862): https://www.rfc-editor.org/rfc/rfc4862
    - The interfaces file, inet6 family: https://manpages.debian.org/trixie/ifupdown/interfaces.5.en.html
    - ip address: https://man7.org/linux/man-pages/man8/ip-address.8.html
    - BIND 9, zone files: https://bind9.readthedocs.io/en/stable/chapter3.html
