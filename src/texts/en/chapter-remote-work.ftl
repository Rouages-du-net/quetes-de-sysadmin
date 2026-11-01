### Story "The Hive", chapter "Working from home": a WireGuard VPN on the
### router. Commands, wg-quick keywords, interface names and paths are not
### translated.

chapter-remote-work = Working from home
    .summary = Malik wants to open the NAS from home: not by opening a port on the internet, but with a WireGuard VPN, well-guarded keys and a firewall that lets him in.

## Files

# { $cle }: the WireGuard public key of Malik's laptop
remote-work-email-malik =
    From:    Malik
    To:      you
    Subject: The NAS from home

    The network is running, thanks! One last request: I'd like to open the
    NAS folders from home, in the evening. The treasurer's nephew suggests
    "opening port 445 on the router box". I have my doubts.

    I prefer what you advised: a WireGuard VPN on the router. I've
    installed the app on my laptop. It created my keys, and gives me my
    public key:

        { $cle }

    In the tunnel, my laptop will have the address 10.10.99.2. The app
    asks me for the router's public key, its address (hive.example, or
    192.0.2.21) and its port: fill in malik-laptop.conf, I'll copy
    it over.

    WireGuard is installed on the router (man wg, man wg-quick; the
    configurations go in /etc/wireguard). And don't forget the zone
    firewall: the input chain is closed by default.

    For sudo: bee-2027

remote-work-laptop-malik =
    # The WireGuard configuration of Malik's laptop. His private key stays
    # on the laptop: the app never shows it.
    # To fill in: the Peer section, that is, the router.
    {"["}Interface]
    Address = 10.10.99.2/32

    {"["}Peer]
    # The router's public key:
    PublicKey =
    # The router's address and port, as seen from the internet:
    Endpoint =
    # The addresses to reach through the tunnel:
    AllowedIPs =

## Events

# { $fichier }: the file containing the private key
remote-work-event-key-exposed =
    Careful: { $fichier } contains the router's private key, and every
    account on the machine can read it. With this key, anyone could
    pretend to be the router. A private key is readable only by its owner
    (chmod 600, or umask 077 before creating it); once copied into
    /etc/wireguard, reserved for root, the other copies have no reason to
    exist any more.
remote-work-event-filter =
    Malik: "My app says: Handshake did not complete after 5 seconds."
    His packets do reach the router… and the input chain drops them: it is
    closed by default (policy drop), and nothing in it lets through the
    port WireGuard listens on (in UDP).
remote-work-event-handshake =
    Malik: "Still nothing: Handshake did not complete." sudo wg show
    confirms it: no "latest handshake" for his peer. To recognise each
    other, each side needs the other's PUBLIC key: Malik's in the Peer of
    wg0.conf, the router's in malik-laptop.conf. And the Endpoint must
    give the router's address and the port it listens on (ListenPort).
remote-work-event-without-nas =
    Malik: "Connected! … but the NAS doesn't answer." The handshake
    happened (sudo wg show: latest handshake). What's left is the path of
    the packets: the laptop's address must be in its peer's AllowedIPs, on
    the router side; the NAS in the AllowedIPs, on the laptop side; and the
    forward chain must let wg0 through to the offices.
remote-work-event-in-place =
    Malik is opening his folders from home… right now. At the next reboot,
    wg0 will only come back if the wg-quick@wg0 service is enabled, and
    the firewall only if its rules are in /etc/nftables.conf.
    (An interface brought up by hand with wg-quick up prevents the service
    from starting: wg-quick down first.)
remote-work-event-end =
    Malik opens the NAS folders from home, through an encrypted tunnel,
    without anything of the NAS being visible from the internet. And
    everything will come back at the next reboot. Malik: "The treasurer's
    nephew is a bit put out."

    Well done! You have finished the chapter "Working from home".

    WHAT HAPPENED
    WireGuard links two machines with keys, like ssh: each has a private
    key, which never leaves it, and gives its public key to the other.
    The laptop sends its encrypted packets over UDP to the router
    (Endpoint); the router accepts them if they come from a key it knows
    (Peer), and only for the addresses that peer is allowed to use
    (AllowedIPs). AllowedIPs works both ways: on the laptop side, it lists
    the networks to send into the tunnel.

    GOOD PRACTICE
    - Never open a file share (445) on the internet: a VPN, and a single
      open UDP port.
    - A private key is readable only by its owner: umask 077 before
      wg genkey, /etc/wireguard reserved for root.
    - One address per peer, as /32, in AllowedIPs; and the firewall decides
      where the tunnel leads (here, only the offices).
    - systemctl enable wg-quick@wg0, so that the tunnel comes back at
      boot.

    ANOTHER WAY
    OpenVPN: older and very widespread, based on TLS and certificates,
    able to go through TCP 443; heavier to configure. An SSH tunnel
    (ssh -L, The Community Centre) is enough for an occasional service,
    not for a whole network. Tailscale, or Headscale which you host
    yourself, build a WireGuard mesh and distribute the keys.

    DOCUMENTATION
    - Quick start: https://www.wireguard.com/quickstart/
    - wg: https://man7.org/linux/man-pages/man8/wg.8.html
    - wg-quick: https://man7.org/linux/man-pages/man8/wg-quick.8.html
    - WireGuard on Debian: https://wiki.debian.org/WireGuard
