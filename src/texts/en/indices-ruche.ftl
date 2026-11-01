### Graded hints for The Hive (see src/engine/hints.ts): one message per
### step, indice-<chapter>-<event>, with .piste (a lead, without the exact
### command) and .solution (almost the answer). Place names as in noms.ftl.

## Chapter 1 — VLANs

indice-vlan-en-place =
    .piste = The trunk carries VLANs 10, 20 and 30, tagged (switch-plan.txt): the router needs one VLAN interface per number on eth1, with its .1 address in each network. man ip-link (type vlan), or man interfaces to write it straight into /etc/network/interfaces.
    .solution = For each VLAN (10, then 20, then 30): sudo ip link add link eth1 name eth1.10 type vlan id 10, sudo ip addr add 10.10.10.1/24 dev eth1.10, sudo ip link set eth1.10 up. Or directly: the three stanzas in /etc/network/interfaces, then sudo ifup -a.
indice-vlan-fin =
    .piste = What you do with ip vanishes at reboot: only /etc/network/interfaces is read again. One auto + iface … inet static stanza per VLAN (man interfaces), then ifup.
    .solution = sudo nano /etc/network/interfaces, and for each VLAN: "auto eth1.10", "iface eth1.10 inet static", "address 10.10.10.1/24" (same for eth1.20 and eth1.30); then sudo ifup -a, and ip -br a to check.

## Chapter 2 — DHCP

indice-dhcp-fin =
    .piste = dnsmasq still serves the old network (/etc/dnsmasq.d/hive): it needs one range per VLAN (dhcp-range), to listen on the VLAN interfaces and never on eth0 (interface=), and a reservation for the printer based on its MAC (dhcp-host). man dnsmasq; dnsmasq --test to check.
    .solution = sudo nano /etc/dnsmasq.d/hive: interface=eth1.10,eth1.20,eth1.30; dhcp-range=10.10.10.100,10.10.10.200,12h (same for 10.10.20.x and 10.10.30.x); dhcp-host=00:00:5e:00:53:30,imprimante,10.10.30.10. Then sudo dnsmasq --test and sudo systemctl restart dnsmasq.

## Chapter 3 — The Zones

indice-zones-en-place =
    .piste = Three things: the router must forward packets (man sysctl: net.ipv4.ip_forward), send them out under its own address (man nft: masquerade), and have a forward chain closed by default that lets replies back (ct state) and then opens zone by zone. notes-from-sacha.txt gives the start; /etc/nftables.conf is the right place.
    .solution = In /etc/nftables.conf: table inet filter with a forward chain "policy drop;", "ct state established,related accept", "iifname "eth1.10" accept", "iifname "eth1.20" oifname "eth0" accept"; table ip nat with a postrouting chain (type nat hook postrouting priority srcnat) and "oifname "eth0" masquerade". Then sudo sysctl -w net.ipv4.ip_forward=1, sudo nft -c -f /etc/nftables.conf and sudo nft -f /etc/nftables.conf.
indice-zones-fin =
    .piste = Everything works, until the next reboot. Kernel settings are kept in /etc/sysctl.d (man sysctl.d), rules in /etc/nftables.conf, loaded at boot by the nftables service… if it is enabled.
    .solution = sudo nano /etc/sysctl.d/90-router.conf with "net.ipv4.ip_forward = 1", then sudo sysctl --system; the rules in /etc/nftables.conf (sudo nft -c -f /etc/nftables.conf), then sudo systemctl enable --now nftables.

## Chapter 4 — Working from home

indice-remote-work-en-place =
    .piste = The router needs keys (man wg: genkey, pubkey; umask first, so that only you can read the private key), a /etc/wireguard/wg0.conf with [Interface] and a [Peer] for Malik, malik-laptop.conf filled in, and the firewall: WireGuard's UDP port in the input chain, wg0 to the offices in forward. man wg-quick to bring the interface up.
    .solution = umask 077 then wg genkey | tee privatekey | wg pubkey > publickey; sudo nano /etc/wireguard/wg0.conf: Address = 10.10.99.1/24, ListenPort = 51820, PrivateKey = (privatekey), and [Peer] PublicKey = (Malik's key), AllowedIPs = 10.10.99.2/32; in malik-laptop.conf: PublicKey = (publickey), Endpoint = hive.example:51820, AllowedIPs = 10.10.10.0/24; in /etc/nftables.conf: "udp dport 51820 accept" (input) and "iifname "wg0" oifname "eth1.10" accept" (forward), sudo systemctl reload nftables; finally sudo systemctl enable --now wg-quick@wg0.
indice-remote-work-fin =
    .piste = The tunnel works, but at the next boot? wg0 only comes back through its service if it is enabled, and the firewall only if its rules are in /etc/nftables.conf. An interface brought up by hand with wg-quick stops the service from starting.
    .solution = sudo wg-quick down wg0 then sudo systemctl enable --now wg-quick@wg0; rules typed with nft copied into /etc/nftables.conf, then sudo systemctl reload nftables. And no copy of the private key readable by everyone (chmod 600 privatekey).

## Chapter 5 — The DMZ

indice-dmz-en-place =
    .piste = The router has no interface in VLAN 40 yet (switch-plan.txt, man interfaces). Then a destination translation at the prerouting hook (man nft: dnat) for ports 80 and 443, and the forward chain: internet to the server on those ports only, the server to internet, nothing towards the inside. Careful: forward sees the address AFTER translation.
    .solution = In /etc/network/interfaces: auto eth1.40, iface eth1.40 inet static, address 10.10.40.1/24, then sudo ifup eth1.40. In /etc/nftables.conf: a prerouting chain (type nat hook prerouting priority dstnat) in table ip nat, with "iifname "eth0" tcp dport {"{"} 80, 443 {"}"} dnat to 10.10.40.10"; in forward: "iifname "eth0" oifname "eth1.40" ip daddr 10.10.40.10 tcp dport {"{"} 80, 443 {"}"} accept" and "iifname "eth1.40" oifname "eth0" accept". Then sudo nft -c -f /etc/nftables.conf and sudo systemctl reload nftables.
indice-dmz-fin =
    .piste = The DMZ works right now, but a reboot only keeps the files: the eth1.40 interface in /etc/network/interfaces, the rules (dnat and forward) in /etc/nftables.conf.
    .solution = Write eth1.40 into /etc/network/interfaces (auto eth1.40, iface eth1.40 inet static, address 10.10.40.1/24) and copy the rules typed with nft into /etc/nftables.conf; check with sudo nft -c -f /etc/nftables.conf, then sudo systemctl reload nftables.

## Chapter 6 — The Annex

indice-annex-en-place =
    .piste = The Annex is one more peer in /etc/wireguard/wg0.conf. For WireGuard, its AllowedIPs are the addresses this peer may send from AND those sent to it: for a site, its whole network. Then fill in annex-wg0.conf (sudo wg show gives the router's public key), remembering that the Annex sits behind an ISP box (man wg: PersistentKeepalive). wg-quick does not reread the file by itself.
    .solution = In /etc/wireguard/wg0.conf, add [Peer] PublicKey = (Sami's key), AllowedIPs = 10.10.99.3/32, 10.20.10.0/24; in annex-wg0.conf: PublicKey = (the one from sudo wg show), Endpoint = hive.example:51820, AllowedIPs = 10.10.10.0/24, PersistentKeepalive = 25; then sudo systemctl restart wg-quick@wg0, and ip route or sudo wg show to check.
indice-annex-fin =
    .piste = The two sites talk right now. At boot, wg0 starts again from /etc/wireguard/wg0.conf through the wg-quick@wg0 service, and the firewall from /etc/nftables.conf: everything set by hand must be in there.
    .solution = The Annex peer (PublicKey, AllowedIPs = 10.10.99.3/32, 10.20.10.0/24) must be in /etc/wireguard/wg0.conf, and the service enabled: sudo systemctl enable wg-quick@wg0, then sudo systemctl restart wg-quick@wg0. An nft rule typed by hand goes into /etc/nftables.conf (or is cleared with sudo systemctl restart nftables).

## Chapter 7 — The Directory

indice-directory-fin =
    .piste = Two people to deal with: Camille (her entry, but also her name in the groups: memberUid is not updated by itself), and Sami (an entry based on modele-ines.ldif, a free uidNumber, a hashed password, and the bureaux group). man ldapdelete, man ldapadd, man ldapmodify, man slappasswd; writing requires binding as someone (Malik's email).
    .solution = ldapdelete -x -D cn=admin,dc=thehive,dc=example -w rayon-de-miel uid=camille,ou=people,dc=thehive,dc=example; slappasswd for the {"{"}SSHA{"}"} hash; sami.ldif based on modele-ines.ldif (uid sami, cn Sami Lemaire, sn Lemaire, uidNumber 10004, userPassword = the hash) and ldapadd -x -D … -w … -f sami.ldif; then an LDIF with "changetype: modify" for cn=bureaux (delete: memberUid camille, add: memberUid sami) and cn=equipe (delete: memberUid camille), fed to ldapmodify -x -D … -w … -f.

## Chapter 8 — The Office Wi-Fi

indice-wifi-en-place =
    .piste = Four settings, in the order a request travels: the input chain must let UDP 1812 in from the access point's VLAN; the access point must be declared in clients.conf (ap-offices.txt); the ldap module enabled (a link in mods-enabled) with base_dn, an identity, and membership_filter; the users file (mods-config/files/authorize) gives the VLAN, and order matters. freeradius only rereads its files at startup: freeradius -XC to check, radtest to try.
    .solution = /etc/nftables.conf, input chain: "iifname "eth1.30" udp dport 1812 accept"; clients.conf: client bornes with ipaddr = 10.10.30.0/24 and secret = Rk7-borne-2028; mods-available/ldap: base_dn = 'dc=thehive,dc=example', identity = 'cn=admin,dc=thehive,dc=example', password = rayon-de-miel, membership_filter uncommented; sudo ln -s ../mods-available/ldap /etc/freeradius/3.0/mods-enabled/ldap; in authorize: DEFAULT Ldap-Group == "bureaux" with Tunnel-Private-Group-Id = 10, then DEFAULT with 20 (plus Tunnel-Type = VLAN, Tunnel-Medium-Type = IEEE-802); sudo freeradius -XC, sudo systemctl reload nftables, sudo systemctl restart freeradius.
indice-wifi-fin =
    .piste = The Wi-Fi works right now; freeradius will reread its files at boot, but what about the firewall? A rule typed with nft vanishes at reboot.
    .solution = Copy the input chain rule ("iifname "eth1.30" udp dport 1812 accept") into /etc/nftables.conf, then sudo nft -c -f /etc/nftables.conf and sudo systemctl reload nftables.
