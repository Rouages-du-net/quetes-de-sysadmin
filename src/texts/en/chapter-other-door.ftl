### Story "The Ferry", chapter "The Other Door": the firewall is a "table
### ip", so IPv6 goes through untouched: PostgreSQL and the admin pages are
### open from the internet over IPv6. nmap -6, ss, nftables families (inet),
### ICMPv6. Commands, options, addresses, paths and outputs are not
### translated.

chapter-other-door = The Other Door
    .summary = The fibre cooperative's monthly scan finds the database and the booking app's admin pages open on the ferry's server, but only in IPv6. Compare both views from outside, find why the firewall lets IPv6 through, and write one policy for both families without cutting IPv6 off.

## Files

other-door-message-amaru =
    From: Amaru (ferry cooperative)
    Thursday 12 April, 13:50

    Hello again,

    Rangi forwarded islenet's monthly scan of its members' servers (it's
    in your home directory). Since IPv6, they scan both. He wrote one
    sentence above it: "Your database is open to the whole internet in
    IPv6. Not in IPv4."

    I don't understand: Tevita told me the firewall closes everything
    except the site and ssh. The database must only be read by the
    booking desk, here at the harbour office (198.51.100.40). And the
    booking app's admin pages are for us, not for the world.

    Could you look? lookout is still there to see from outside.

    Amaru

other-door-scan-report =
    islenet, monthly scan of members' servers, April 2029
    Member: ferry cooperative, server quay.ferry.example

    IPv4 192.0.2.52
      22/tcp    open      ssh
      53/tcp    open      domain
      80/tcp    open      http
      5432/tcp  filtered  postgresql
      8080/tcp  filtered  http-proxy

    IPv6 { $address }
      22/tcp    open      ssh
      53/tcp    open      domain
      80/tcp    closed    http
      5432/tcp  open      postgresql    <-- !
      8080/tcp  open      http-proxy    <-- !

    Reminder: a service that only the office uses should not be
    reachable from the internet, in either family.

## Events

other-door-event-scan6 =
    Seen from the internet, in IPv6, PostgreSQL (5432) answers. Now the
    same scan in IPv4 (nmap without -6), to compare.
other-door-event-scan4 =
    In IPv4, 5432 is "filtered": something drops the packets. Tevita's
    firewall does its job, in IPv4. Two doors, one guarded. On quay: who
    listens, and on which addresses? (ss -tlnp)
other-door-event-sockets =
    PostgreSQL listens twice: 0.0.0.0:5432 (every IPv4 address)
    and [::]:5432 (every IPv6 address). The admin pages listen on *:8080: one
    IPv6 socket that also takes IPv4 (IPV6_V6ONLY off). Nothing wrong
    there: the office needs the database. It's the firewall's job to
    choose who comes in. Read its rules (nft list ruleset).
other-door-event-ruleset =
    "table ip filter": a table of the ip family only sees IPv4 packets.
    IPv6 packets go through the ip6 family, and the inet family serves
    both. There is no ip6 or inet table here: in IPv6, nothing is
    filtered at all. One policy for both families: a table inet (man nft).
other-door-event-disabled =
    IPv6 is off: the open ports are hidden, but the AAAA records still
    send IPv6 visitors to quay, and they now hit a wall. And turning it
    back on (sysctl -w …disable_ipv6=0) brings back the link-local and
    SLAAC addresses, not the fixed one: that one goes back with ip -6 addr
    add (or systemctl restart networking). The firewall is where this is
    fixed.
other-door-event-nd-dropped =
    quay no longer answers anything in IPv6, not even ping or ssh: the
    router asks "who has 2001:db8:4e1:20::80?" with an ICMPv6 neighbour
    solicitation, and your input chain drops it. IPv4 has ARP outside the
    firewall; IPv6 does it with ICMPv6, so the rules must let it in:
    icmpv6 type {"{"} nd-neighbor-solicit, nd-neighbor-advert, nd-router-advert {"}"}
    accept (RFC 4890 lists the others worth keeping: packet-too-big…).
other-door-event-v6-stricter =
    A service that passes in IPv4 doesn't pass in IPv6 any more: a rule
    of the IPv4 table is missing from the IPv6 one. That's the trap of
    two copies kept by hand: a table inet holds one set of rules for both.
other-door-event-office-cut =
    The booking desk (198.51.100.40, IPv4) no longer reaches the database:
    keep its rule (ip saddr 198.51.100.40 tcp dport 5432 accept).
other-door-event-ssh-cut =
    The workstation would no longer reach ssh: keep port 22 open.
other-door-event-closed-now =
    The loaded ruleset now holds in both families: ssh, DNS and the site
    pass, the database and the admin pages don't, the office still
    reads, and neighbour discovery gets through. For now: the nftables
    service loads /etc/nftables.conf at boot (and on reload).
other-door-event-not-saved =
    The rules loaded now are not those of /etc/nftables.conf: at the next
    reboot (or systemctl reload nftables), the IPv6 door reopens. Write
    them in the file, nft -c -f to check it, then load it.
other-door-event-closed-boot =
    /etc/nftables.conf holds the policy for both families, and the
    nftables service is active: it will load it at boot.
other-door-event-end =
    Rangi: "Second scan this morning: 5432 and 8080 filtered in IPv4 and in
    IPv6. Clean." Amaru: "And the booking desk still works. Perfect."

    Well done! You finished chapter 2 of The Ferry. (What comes next is
    waiting for you: ssh quay.)

    WHAT HAPPENED
    quay's firewall was a table of the ip family: it only ever saw IPv4.
    When IPv6 arrived, every service listening on [::] or * became
    reachable in IPv6 with no filter at all: the database, the admin
    pages. You compared both families from outside (nmap, nmap -6), saw
    the sockets (ss -tlnp), and wrote one policy for both, in a table inet,
    with the ICMPv6 that IPv6 can't live without, in the file and loaded.

    GOOD PRACTICE
    - Turning IPv6 on means auditing the firewall in IPv6: scan both
      families, from outside.
    - nftables: a table inet holds the rules of both families; ip saddr
      only matches IPv4, ip6 saddr only IPv6.
    - Never drop ICMPv6 wholesale: neighbour discovery and router
      advertisements go through it (RFC 4890).
    - Disabling IPv6 to hide a hole breaks what depends on it (the AAAA
      records): fix the filter instead.
    - ufw: IPV6=yes in /etc/default/ufw; rules added while it was "no"
      exist for IPv4 only.
    - Prefer a service listening only where it's needed (127.0.0.1, ::1)
      over a firewall that hides it.

    DOCUMENTATION
    - nftables families: https://wiki.nftables.org/wiki-nftables/index.php/Nftables_families
    - A simple ruleset for a server: https://wiki.nftables.org/wiki-nftables/index.php/Simple_ruleset_for_a_server
    - Filtering ICMPv6 (RFC 4890): https://www.rfc-editor.org/rfc/rfc4890
    - nmap and IPv6: https://nmap.org/book/man-ipv6.html
