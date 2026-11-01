### Story "The Neighbourhood Letters", chapter 5 "Works on my machine":
### DNS (BIND). Commands, paths, domain names, zone files and the messages
### of dig, named and rndc are not translated.

chapter-works-for-me = Works on my machine
    .summary = The café's website only works for Kofi: DNS, BIND zone, serial number, TTL.

## Files

works-for-me-email-kofi =
    From:    Kofi (The Neighbourhood Letters association)
    To:      you
    Subject: It works on my machine!

    I don't get it. The café's website works perfectly on my computer, but
    the café's customers say they land on an error page from the old
    hosting provider. And www.cafe.example doesn't work anywhere, not even
    on my computer.

    And yet I did "point" the name to our server: I added this line to
    /etc/hosts, on my computer:

      203.0.113.10   cafe.example

    Rania says that's not how it's done, and that our server is the one
    that is authoritative for the cafe.example zone (BIND, the named
    service). The registry keeps a copy of it, on ns2.registry.example.

    Can you take a look? Rania left some help in help_dns.txt. For
    sudo: ants-2026
works-for-me-help-dns =
    DNS HELP — BY RANIA

    /etc/hosts only changes the computer it is on: it's a "homemade"
    answer that nobody else sees.

    The real DNS, for our domains:
      /etc/bind/named.conf.local      the list of our zones
      /etc/bind/zones/db.NAME         one zone per file
    Our letters.example zone is a good model.

    Who answers what?
      dig cafe.example                        the public resolver (9.9.9.9)
      dig @localhost cafe.example             our server (ns1)
      dig @ns2.registry.example cafe.example  the registry's copy (ns2)

    After a change: named-checkzone, then rndc reload.
    Everything else: man dig, man named-checkzone, man rndc.

## Events

# { $hours }: the time left before the resolver forgets the old address
works-for-me-event-cache =
    Our server gives the new address… but the public resolver still
    answers with the old one. Look at the number before IN: it's the TTL
    left. The resolver kept yesterday's answer in its cache, and will keep
    it for { $hours ->
        [one] about one more hour
       *[other] about { $hours } more hours
    }, like every resolver in the world that asked for it. This is what
    people wrongly call "propagation": nothing propagates, caches expire.
    You can't flush them; you can only plan ahead (a short TTL before a
    change). In the meantime, check directly with the two authoritative
    servers.
works-for-me-event-error-zone =
    named rejects the zone and keeps the old version: the site doesn't
    break, but nothing has changed. journalctl -u named tells you why;
    named-checkzone tells you before reloading.
works-for-me-event-serial =
    ns1 (our server) and ns2 (the registry's copy) no longer give the same
    answer: ns2 hasn't copied the zone. A secondary server only copies a
    zone if its serial number (the SOA serial) has increased.
    journalctl -u named reports it. The usual habit: YYYYMMDDnn, today's
    date and a change number.
works-for-me-event-point-final =
    Careful: in a zone, a name written without a trailing dot is completed
    with the zone name. cafe.example (without the dot) becomes
    cafe.example.cafe.example.: dig @localhost www.cafe.example shows it.
    For a full name: cafe.example. with the dot.
works-for-me-event-end =
    ns1 and ns2 give the same answer: cafe.example and www.cafe.example
    lead to the Letters server. Resolvers will follow, at the latest when
    their cache expires. Kofi removes the line from his /etc/hosts:
    "So I see what everyone else sees!"

    Well done! You have finished chapter 5 of The Neighbourhood Letters.
    (What comes next: Concert night.)

    WHAT HAPPENED
    /etc/hosts only applies to the machine it is on: on Kofi's computer,
    the name led to the right server; everywhere else, DNS still gave the
    old address. The cafe.example zone, on our server, had never been
    changed, and there was no record for www.

    GOOD PRACTICE
    - Always test like everyone else: dig, without a "homemade" /etc/hosts.
    - Query the authoritative servers (dig @ns1, dig @ns2) to find out what
      is published; the resolver only tells you what it has in cache.
    - Increase the SOA serial with every change, otherwise the
      secondaries keep the old zone.
    - named-checkzone before rndc reload; journalctl -u named after.
    - A full name ends with a dot in a zone file.
    - Before moving, lower the TTL (for example to 300 seconds) one day
      ahead: caches will quickly forget the old address.

    DOCUMENTATION
    - BIND zone files: https://bind9.readthedocs.io/en/stable/chapter3.html
    - dig, named-checkzone, rndc: https://bind9.readthedocs.io/en/stable/manpages.html
    - DNS, its names and its cache (RFC 1034): https://www.rfc-editor.org/rfc/rfc1034
