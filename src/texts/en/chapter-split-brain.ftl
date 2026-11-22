### Story "The Blood Drive", chapter "Split Brain": both load balancers
### hold the virtual address after a network change (a firewall that drops
### VRRP on lb2, new routers using the same virtual_router_id). ip a,
### journalctl, tcpdump, nft, virtual_router_id, unicast_peer. Commands,
### options, paths and outputs are not translated.

chapter-split-brain = Split Brain
    .summary = After a night of network work, half the donors' connections break. Both load balancers believe they are in charge: find out why they no longer hear each other, and give them back a single voice.

## Files

split-brain-message-kirsi =
    From: Kirsi (network team)
    Wednesday 5 June, 9:20

    Hi,

    Last night (Tuesday, from 21:30) we installed the new edge routers:
    a pair, edge-a (192.0.2.252) and edge-b (192.0.2.253), sharing the
    gateway 192.0.2.254 with VRRP, so the gateway survives a router
    failure. While we were at it, we applied our hardening baseline (v3,
    nftables) to lb2; lb1 gets it next week.

    This morning the edge routers' log is full of lines like these:
      arp: 192.0.2.108 moved from 52:54:00:6c:01:04 to 52:54:00:6c:01:05 on vlan20
      arp: 192.0.2.108 moved from 52:54:00:6c:01:05 to 52:54:00:6c:01:04 on vlan20
      vrrp: VRID 51: advert from 192.0.2.104 with a different address list, ignored

    Two machines answer for 192.0.2.108. I'm sure it's not the routers ;)

    Kirsi

split-brain-message-zainab =
    From: Zainab (donor services)

    Donors write that the site "breaks one time in two": the page loads,
    then the next click fails, then it works again. Can you have a look?

    Zainab

## Events

split-brain-event-two-masters =
    lb2 holds 192.0.2.108 too: two masters. The gateway learns the
    address's MAC from whoever answered last, and each switch resets the
    connections that were on the other one. Split brain: each node thinks
    the other is gone. Ask keepalived on each why (journalctl -u
    keepalived).
split-brain-event-lower-priority =
    lb1 hears lb2's advertisements (priority 100, lower than its own 101)
    and tells it so every second ("forcing new election"). But lb2 behaves
    as if it heard nothing. Does lb2 receive lb1's advertisements? tcpdump
    on lb2 shows what reaches its network card (VRRP is IP protocol 112).
split-brain-event-on-the-wire =
    lb1's advertisements reach lb2's network card: tcpdump sees them. But
    tcpdump looks at packets before the firewall does, keepalived after.
    Something on lb2 drops them on the way in: look at its firewall (nft
    list ruleset).
split-brain-event-ruleset =
    The baseline's input chain drops everything it doesn't allow (policy
    drop), and nothing allows VRRP: protocol 112, sent to 224.0.0.18. lb2
    never hears lb1, so it took the address. Let VRRP in (man nft: ip
    protocol, ip daddr), now and in /etc/nftables.conf.
split-brain-event-stopped =
    With keepalived stopped on one node, there is only one master, but no
    backup either: the next failure takes the site down. The node must stay
    in the group, and hear the other one.
split-brain-event-priorities =
    Priorities only matter between nodes that hear each other: as long as
    lb2's firewall drops lb1's advertisements, each node is alone in its
    election, and each wins it.
split-brain-event-single-master =
    One master again: lb2 hears lb1, sees a higher priority, and went back
    to BACKUP (it removed the address). The donors' connections stop
    breaking.
split-brain-event-persisted =
    And lb2's /etc/nftables.conf lets VRRP in too: the next reboot or
    restart of nftables won't bring the split brain back. Tell Kirsi, so
    that the baseline v4 includes it for lb1.
split-brain-event-clash =
    Another VRRP group shares the link: edge-a advertises VRID 51 (prio 120,
    address 192.0.2.254), the same virtual_router_id as your pair. keepalived
    drops its adverts as "bogus" (another address list), and the routers
    log yours. The same VRID on one link for two groups is asking for
    trouble: one of them must move, and the routers' VRID belongs to the
    network team.
split-brain-event-vrid-half =
    lb1 and lb2 no longer have the same virtual_router_id: they are in two
    different VRRP groups now, and each is master of its own. Both nodes
    must use the same VRID.
split-brain-event-vrid =
    Your pair no longer meets the routers' group: its own virtual_router_id
    on both nodes (or unicast advertisements between the two).
split-brain-event-end =
    Kirsi: "The routers' log is quiet, and the baseline v4 will allow VRRP
    on both load balancers. Sorry about lb2!" Zainab: "The donors stopped
    writing. Thank you!"

    Well done! You finished Split Brain.

    WHAT HAPPENED
    Tuesday night, the hardening baseline gave lb2 an input chain that
    dropped everything it didn't allow, VRRP included. lb2 stopped hearing
    lb1 and took the address too: two masters, a gateway whose ARP entry
    swung between them, every other donor's connection reset. In the same
    night, the new edge routers started a VRRP group with the same VRID, 51.
    You found the two masters (ip a), saw that lb1's adverts reached lb2's
    card (tcpdump) but not its keepalived (nft), let VRRP in for good, and
    moved your pair off VRID 51.

    GOOD PRACTICE
    - Two masters means the nodes don't hear each other: look at the path
      of the advertisements (tcpdump on the receiving side, then its
      firewall), not at the priorities.
    - A firewall on a VRRP node must let protocol 112 in (from the peer, to
      224.0.0.18 or the peer's address with unicast_peer). Persist it.
    - One VRID per group on a link. Agree on the numbers with the network
      team, or use unicast_peer.
    - Monitor "both masters" (the address on both nodes) as an alert of its
      own: split brain doesn't stop a site, it makes it unreliable.

    DOCUMENTATION
    - keepalived.conf(5): https://www.keepalived.org/manpage.html
    - nft(8): https://www.netfilter.org/projects/nftables/manpage.html
    - tcpdump(1): https://www.tcpdump.org/manpages/tcpdump.1.html
    - VRRP (RFC 3768): https://www.rfc-editor.org/rfc/rfc3768
