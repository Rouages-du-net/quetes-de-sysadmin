### Story "The Hive", chapter "The Annex": linking two sites with
### WireGuard. Commands, wg-quick keywords, addresses and paths are
### never translated.

chapitre-annexe = The Annex
    .resume = La Ruche opens a second site: link its two networks through the VPN, with AllowedIPs acting as a routing table, and a path kept open through the Annex's ISP box.

## Files

# { $cle }: the WireGuard public key of the Annex router
annexe-courriel-sami =
    From:    Sami (volunteer at the Annex)
    To:      you
    Subject: Linking the Annex to La Ruche

    Hi! The Annex opens on Monday. I've set up our router (a Debian
    too, behind our ISP's box); our network is
    10.20.10.0/24.

    What we need:
    - the Annex computers can open the folders on La Ruche's NAS
      (10.10.10.5);
    - Malik can print on our printer (10.20.10.20) from the offices;
    - and nothing more: La Ruche's cameras don't look at us.

    Malik says the remote-work VPN can do the job: our router will be one
    more peer on wg0. It took the address 10.10.99.3 in the tunnel,
    and its public key is:

        { $cle }

    I've prepared annexe-wg0.conf: fill in the Peer part (your router)
    and I'll copy it over here. For your router's public key:
    sudo wg show.

    For sudo: abeille-2027

annexe-conf =
    # The WireGuard configuration of the Annex router (Sami will copy it).
    # Its private key stays at the Annex.
    {"["}Interface]
    Address = 10.10.99.3/24
    ListenPort = 51820

    {"["}Peer]
    # La Ruche's router:
    PublicKey =
    Endpoint =
    # La Ruche's addresses to send into the tunnel:
    AllowedIPs =

## Events

annexe-evenement-pas-relu =
    The file /etc/wireguard/wg0.conf has a peer for the Annex… but wg0
    is still running with the old configuration (sudo wg show):
    wg-quick doesn't reread the file by itself. You need to restart
    the interface (the wg-quick@wg0 service).
annexe-evenement-poignee =
    Sami: "Our router says: Handshake did not complete." sudo wg show
    confirms it: no "latest handshake" for the Annex peer.
    Each side must have the other's PUBLIC key, and the Endpoint must
    give the address and port of your router.
annexe-evenement-autorisees =
    Sami: "The tunnel is up, but our computers can't reach the
    NAS." The packets arrive… and the router drops them: they come from
    10.20.10.15, and for WireGuard, a peer may only send from the
    addresses in its AllowedIPs. For a whole site, that's its whole
    network.
annexe-evenement-route =
    Sami: "Still nothing to the NAS." On the Annex side, packets for
    10.10.10.5 don't go into the tunnel: in annexe-wg0.conf,
    AllowedIPs says what must go in (and wg-quick turns it into routes).
annexe-evenement-endormi =
    Sami: "The NAS works!" Malik: "And I can print at the Annex…
    sometimes. Then nothing for hours." The Annex router is
    behind its ISP's box: as long as it sends nothing, the
    box forgets the path, and La Ruche can no longer reach it. WireGuard
    can keep it open by sending a small packet from time to time
    (man wg: PersistentKeepalive).
annexe-evenement-cameras =
    Careful: the Annex can now reach La Ruche's cameras. Sami
    only asked for the NAS: the tunnel doesn't open everything, the firewall
    (the forward chain) decides where it leads.
annexe-evenement-malik =
    Careful: Malik can no longer reach the NAS from home. His laptop's
    peer must stay in wg0.conf, with its own address.
annexe-evenement-en-place =
    The two sites can talk… right now. At the next reboot,
    wg0 starts again from /etc/wireguard/wg0.conf through the wg-quick@wg0
    service: everything must be in there.
annexe-evenement-fin =
    The Annex computers open the NAS, Malik prints at the Annex, the
    tunnel stays open despite the box, and nothing else gets through. Sami:
    "It feels like we're in the same building."

    Well done! You've finished the chapter "The Annex".

    WHAT HAPPENED
    For WireGuard, AllowedIPs works both ways: it lists the
    addresses sent to this peer (wg-quick turns them into routes, visible
    with ip route) and those this peer is allowed to send from. To link
    two sites, each side puts the other's network there. And a site behind
    a box (NAT) must keep the path open: PersistentKeepalive
    sends a packet every 25 seconds.

    GOOD PRACTICE
    - Networks that don't overlap (10.10.x for La Ruche,
      10.20.x for the Annex), chosen before linking the sites.
    - The tunnel carries, the firewall decides: open only what
      was asked for.
    - After changing wg0.conf, restart the interface (or the
      service), and check with wg show and ip route.

    DOCUMENTATION
    - Cryptokey routing: https://www.wireguard.com/#cryptokey-routing
    - wg (PersistentKeepalive): https://man7.org/linux/man-pages/man8/wg.8.html
    - wg-quick (routes): https://man7.org/linux/man-pages/man8/wg-quick.8.html
