### Story "The Hive", chapter "The Zones": routing, NAT and a firewall
### between the VLANs, with sysctl and nftables. Commands, nft keywords,
### interface names and paths are not translated.

chapitre-zones = The Zones
    .resume = Nothing gets out to the internet, and everyone sees everything: routing, address translation (NAT) and a firewall between the VLANs, with nftables, all surviving a reboot.

## Files

zones-courriel-malik =
    From:    Malik
    To:      you
    Subject: The internet doesn't get out

    Everyone has their address, thanks! But nothing gets out to the
    internet: not the offices, not the café's wifi. Sacha, the volunteer
    who looked after the network before you, says he had "set everything
    up by hand"; his notes are in notes-from-sacha.txt. The router rebooted
    on Saturday, during the power cut.

    And while we're at it, what we really wanted with the VLANs:

    - the offices (VLAN 10): internet, and the printer;
    - the guest wifi (VLAN 20): internet, and NOTHING else. The NAS
      holds the files of the community grocery's beneficiaries, and
      there are the cameras;
    - the equipment (VLAN 30): no internet at all. The cameras try to
      send their footage to their manufacturer, and we don't want that.
      The NAS, however, must keep recording the cameras.

    You're working from the admin workstation (192.0.2.2), over ssh:
    don't lock yourself out!

    To see who talks to whom through the router: sudo conntrack -L.
    The rest: man nft, man sysctl.

    For sudo: bee-2027

zones-notes-sacha =
    SACHA'S NOTES (La Ruche's network)

    To get the network out to the internet, after a router reboot
    (one day I'll put this in a file):

      sudo sysctl -w net.ipv4.ip_forward=1
      sudo nft add table ip nat
      sudo nft 'add chain ip nat postrouting {"{"} type nat hook postrouting priority srcnat; {"}"}'
      sudo nft add rule ip nat postrouting oifname "eth0" masquerade

    No filtering: everyone sees everything, but hey, we're among friends.

## Events

zones-evenement-sans-traduction =
    The router now forwards packets… and they go out through eth0 with
    their private address (10.10.x.x). On the internet, nobody knows
    where to reply to a private address: they are reserved for local
    networks (RFC 1918), and the ISP box drops them. The router has to
    send them out under its own address (address translation, or NAT:
    man nft, masquerade). sudo conntrack -L shows the exchanges left
    without a reply ([UNREPLIED]).
zones-evenement-reponses =
    The questions get through, but not the answers: with a drop policy,
    a server's reply is a packet like any other, coming in through an
    interface where nothing allows it. The firewall tracks exchanges
    (ct state): it can recognise a reply to an exchange already allowed
    (established) and let it come back.
zones-evenement-tout-ouvert =
    The internet works everywhere… including where it shouldn't: a
    visitor's phone reaches the NAS or a camera, or the camera gets out
    to the internet. By default, the forward chain lets everything
    through. The right method: close everything (policy drop), then open
    only what is wanted, zone by zone.
zones-evenement-ssh =
    Careful: with these rules, a new ssh connection from the admin
    workstation (192.0.2.2) would be refused by the input chain. Your
    current session is hanging by a thread: if it drops, nobody gets
    into the router any more (short of plugging a screen into it). Let
    ssh through before closing the rest.
zones-evenement-en-place =
    Everything works the way Malik wanted… for now. But what if the
    router reboots, like on Saturday? sysctl -w and nft on the command
    line don't last. Kernel settings are written in /etc/sysctl.d (man
    sysctl.d), the rules in /etc/nftables.conf, which the nftables
    service loads at boot… if it is enabled.
zones-evenement-fin =
    The offices get out to the internet and can print, the café has wifi
    and sees only that, the cameras stay at home, and everything will
    hold at the next reboot. Malik: "Sacha says it's the first time the
    firewall has been written down anywhere."

    Well done! You have finished the chapter "The Zones".

    WHAT HAPPENED
    A Linux router only forwards packets from one network to another if
    it is allowed to (net.ipv4.ip_forward = 1). The VLAN addresses are
    private: to get out to the internet, the router replaces the source
    address with its own (masquerade) and records the exchange so it can
    return the reply to the right device (connection tracking,
    conntrack). The forward chain decides what goes through: you close
    everything there (policy drop), let replies come back
    (ct state established,related), then open zone by zone (iifname,
    oifname).

    GOOD PRACTICE
    - Close by default, open what is wanted; let replies through just
      once, at the top of the chain.
    - Never lock yourself out: open ssh (input chain) before closing the
      rest, and test with nft -c before loading.
    - What must last goes in files: /etc/sysctl.d,
      /etc/nftables.conf, and systemctl enable nftables.
    - An example forward chain, for this network:

        chain forward {"{"}
            type filter hook forward priority filter; policy drop;
            ct state established,related accept
            iifname "eth1.10" accept
            iifname "eth1.20" oifname "eth0" accept
        {"}"}

    DOCUMENTATION
    - nft: https://www.netfilter.org/projects/nftables/manpage.html
    - NAT with nftables: https://wiki.nftables.org/wiki-nftables/index.php/Performing_Network_Address_Translation_(NAT)
    - A home router: https://wiki.nftables.org/wiki-nftables/index.php/Simple_ruleset_for_a_home_router
    - sysctl.d: https://man7.org/linux/man-pages/man5/sysctl.d.5.html
