### Die gestuften Hinweise von „Der Bienenstock“ (siehe src/engine/hints.ts):
### eine Nachricht pro Schritt, mit .lead (eine Spur, ohne den genauen
### Befehl) und .solution (fast die Antwort). Ortsnamen wie in names.ftl.

## Kapitel 1 — VLANs

hint-vlan-in-place =
    .lead = Der Trunk transportiert die VLANs 10, 20 und 30, getaggt (switch-plan.txt): Der Router braucht eine VLAN-Schnittstelle pro Nummer auf eth1, mit seiner .1-Adresse in jedem Netz. man ip-link (type vlan), oder man interfaces, um es direkt in /etc/network/interfaces zu schreiben.
    .solution = Für jedes VLAN (10, dann 20, dann 30): sudo ip link add link eth1 name eth1.10 type vlan id 10, sudo ip addr add 10.10.10.1/24 dev eth1.10, sudo ip link set eth1.10 up. Oder direkt: die drei Abschnitte in /etc/network/interfaces, dann sudo ifup -a.
hint-vlan-end =
    .lead = Was du mit ip machst, verschwindet beim Neustart: Nur /etc/network/interfaces wird wieder gelesen. Ein Abschnitt auto + iface … inet static pro VLAN (man interfaces), dann ifup.
    .solution = sudo nano /etc/network/interfaces, und für jedes VLAN: „auto eth1.10“, „iface eth1.10 inet static“, „address 10.10.10.1/24“ (ebenso für eth1.20 und eth1.30); dann sudo ifup -a, und ip -br a zum Prüfen.

## Kapitel 2 — DHCP

hint-dhcp-end =
    .lead = dnsmasq bedient noch das alte Netz (/etc/dnsmasq.d/hive): Es braucht einen Bereich pro VLAN (dhcp-range), muss auf den VLAN-Schnittstellen lauschen und nie auf eth0 (interface=), und eine Reservierung für den Drucker anhand seiner MAC (dhcp-host). man dnsmasq; dnsmasq --test zum Prüfen.
    .solution = sudo nano /etc/dnsmasq.d/hive: interface=eth1.10,eth1.20,eth1.30; dhcp-range=10.10.10.100,10.10.10.200,12h (ebenso für 10.10.20.x und 10.10.30.x); dhcp-host=00:00:5e:00:53:30,drucker,10.10.30.10. Dann sudo dnsmasq --test und sudo systemctl restart dnsmasq.

## Kapitel 3 — Die Zonen

hint-zones-in-place =
    .lead = Drei Dinge: Der Router muss Pakete weiterleiten (man sysctl: net.ipv4.ip_forward), sie unter seiner eigenen Adresse hinausschicken (man nft: masquerade), und eine standardmäßig geschlossene Kette forward haben, die Antworten zurücklässt (ct state) und dann Zone für Zone öffnet. notizen-von-sacha.txt liefert den Anfang; /etc/nftables.conf ist der richtige Ort.
    .solution = In /etc/nftables.conf: table inet filter mit einer Kette forward „policy drop;“, „ct state established,related accept“, „iifname "eth1.10" accept“, „iifname "eth1.20" oifname "eth0" accept“; table ip nat mit einer Kette postrouting (type nat hook postrouting priority srcnat) und „oifname "eth0" masquerade“. Dann sudo sysctl -w net.ipv4.ip_forward=1, sudo nft -c -f /etc/nftables.conf und sudo nft -f /etc/nftables.conf.
hint-zones-end =
    .lead = Alles funktioniert, bis zum nächsten Neustart. Kernel-Einstellungen bewahrt man in /etc/sysctl.d auf (man sysctl.d), Regeln in /etc/nftables.conf, beim Booten vom Dienst nftables geladen… wenn er aktiviert ist.
    .solution = sudo nano /etc/sysctl.d/90-router.conf mit „net.ipv4.ip_forward = 1“, dann sudo sysctl --system; die Regeln in /etc/nftables.conf (sudo nft -c -f /etc/nftables.conf), dann sudo systemctl enable --now nftables.

## Kapitel 4 — Homeoffice

hint-remote-work-in-place =
    .lead = Der Router braucht Schlüssel (man wg: genkey, pubkey; zuerst umask, damit nur du den privaten Schlüssel lesen kannst), eine /etc/wireguard/wg0.conf mit [Interface] und einem [Peer] für Malik, eine ausgefüllte malik-laptop.conf, und die Firewall: der UDP-Port von WireGuard in der Kette input, wg0 zu den Büros in forward. man wg-quick, um die Schnittstelle hochzufahren.
    .solution = umask 077, dann wg genkey | tee privatekey | wg pubkey > publickey; sudo nano /etc/wireguard/wg0.conf: Address = 10.10.99.1/24, ListenPort = 51820, PrivateKey = (privatekey), und [Peer] PublicKey = (Maliks Schlüssel), AllowedIPs = 10.10.99.2/32; in malik-laptop.conf: PublicKey = (publickey), Endpoint = hive.example:51820, AllowedIPs = 10.10.10.0/24; in /etc/nftables.conf: „udp dport 51820 accept“ (input) und „iifname "wg0" oifname "eth1.10" accept“ (forward), sudo systemctl reload nftables; zuletzt sudo systemctl enable --now wg-quick@wg0.
hint-remote-work-end =
    .lead = Der Tunnel funktioniert, aber beim nächsten Booten? wg0 kommt über seinen Dienst nur zurück, wenn er aktiviert ist, und die Firewall nur, wenn ihre Regeln in /etc/nftables.conf stehen. Eine von Hand mit wg-quick hochgefahrene Schnittstelle hindert den Dienst am Starten.
    .solution = sudo wg-quick down wg0, dann sudo systemctl enable --now wg-quick@wg0; mit nft getippte Regeln nach /etc/nftables.conf kopiert, dann sudo systemctl reload nftables. Und keine Kopie des privaten Schlüssels, die alle lesen können (chmod 600 privatekey).

## Kapitel 5 — Die DMZ

hint-dmz-in-place =
    .lead = Der Router hat noch keine Schnittstelle im VLAN 40 (switch-plan.txt, man interfaces). Dann eine Zieladressübersetzung am Hook prerouting (man nft: dnat) für die Ports 80 und 443, und die Kette forward: das Internet zum Server, nur auf diesen Ports, der Server zum Internet, nichts nach innen. Vorsicht: forward sieht die Adresse NACH der Übersetzung.
    .solution = In /etc/network/interfaces: auto eth1.40, iface eth1.40 inet static, address 10.10.40.1/24, dann sudo ifup eth1.40. In /etc/nftables.conf: eine Kette prerouting (type nat hook prerouting priority dstnat) in table ip nat, mit „iifname "eth0" tcp dport {"{"} 80, 443 {"}"} dnat to 10.10.40.10“; in forward: „iifname "eth0" oifname "eth1.40" ip daddr 10.10.40.10 tcp dport {"{"} 80, 443 {"}"} accept“ und „iifname "eth1.40" oifname "eth0" accept“. Dann sudo nft -c -f /etc/nftables.conf und sudo systemctl reload nftables.
hint-dmz-end =
    .lead = Die DMZ funktioniert gerade jetzt, aber ein Neustart behält nur die Dateien: die Schnittstelle eth1.40 in /etc/network/interfaces, die Regeln (dnat und forward) in /etc/nftables.conf.
    .solution = Schreib eth1.40 in /etc/network/interfaces (auto eth1.40, iface eth1.40 inet static, address 10.10.40.1/24) und kopier die mit nft getippten Regeln nach /etc/nftables.conf; prüf mit sudo nft -c -f /etc/nftables.conf, dann sudo systemctl reload nftables.

## Kapitel 6 — Die Nebenstelle

hint-annex-in-place =
    .lead = Die Nebenstelle ist ein Peer mehr in /etc/wireguard/wg0.conf. Für WireGuard sind ihre AllowedIPs die Adressen, von denen aus dieser Peer senden darf, UND die, die an ihn geschickt werden: für einen Standort sein ganzes Netz. Füll dann annex-wg0.conf aus (sudo wg show gibt den öffentlichen Schlüssel des Routers), und denk daran, dass die Nebenstelle hinter einer Box des Providers sitzt (man wg: PersistentKeepalive). wg-quick liest die Datei nicht von selbst neu.
    .solution = In /etc/wireguard/wg0.conf [Peer] hinzufügen: PublicKey = (Samis Schlüssel), AllowedIPs = 10.10.99.3/32, 10.20.10.0/24; in annex-wg0.conf: PublicKey = (der aus sudo wg show), Endpoint = hive.example:51820, AllowedIPs = 10.10.10.0/24, PersistentKeepalive = 25; dann sudo systemctl restart wg-quick@wg0, und ip route oder sudo wg show zum Prüfen.
hint-annex-end =
    .lead = Die zwei Standorte sprechen gerade jetzt miteinander. Beim Booten startet wg0 wieder aus /etc/wireguard/wg0.conf über den Dienst wg-quick@wg0, und die Firewall aus /etc/nftables.conf: Alles, was von Hand gesetzt wurde, muss dort drinstehen.
    .solution = Der Peer der Nebenstelle (PublicKey, AllowedIPs = 10.10.99.3/32, 10.20.10.0/24) muss in /etc/wireguard/wg0.conf stehen, und der Dienst aktiviert sein: sudo systemctl enable wg-quick@wg0, dann sudo systemctl restart wg-quick@wg0. Eine von Hand getippte nft-Regel gehört nach /etc/nftables.conf (oder wird mit sudo systemctl restart nftables gelöscht).

## Kapitel 7 — Der Verzeichnisdienst

hint-directory-end =
    .lead = Zwei Personen sind zu behandeln: Camille (ihr Eintrag, aber auch ihr Name in den Gruppen: memberUid wird nicht von selbst aktualisiert), und Sami (ein Eintrag nach ines-vorlage.ldif, eine freie uidNumber, ein gehashtes Passwort, und die Gruppe bueros). man ldapdelete, man ldapadd, man ldapmodify, man slappasswd; zum Schreiben muss man sich als jemand anmelden (Maliks E-Mail).
    .solution = ldapdelete -x -D cn=admin,dc=thehive,dc=example -w honigwabe uid=camille,ou=people,dc=thehive,dc=example; slappasswd für den Hash {"{"}SSHA{"}"}; sami.ldif nach ines-vorlage.ldif (uid sami, cn Sami Lemaire, sn Lemaire, uidNumber 10004, userPassword = der Hash) und ldapadd -x -D … -w … -f sami.ldif; dann ein LDIF mit „changetype: modify“ für cn=bueros (delete: memberUid camille, add: memberUid sami) und cn=team (delete: memberUid camille), an ldapmodify -x -D … -w … -f übergeben.

## Kapitel 8 — Das WLAN der Büros

hint-wifi-in-place =
    .lead = Vier Einstellungen, in der Reihenfolge, in der eine Anfrage reist: Die Kette input muss UDP 1812 aus dem VLAN des Zugangspunkts hereinlassen; der Zugangspunkt muss in clients.conf eingetragen sein (ap-bueros.txt); das Modul ldap aktiviert (ein Link in mods-enabled), mit base_dn, einer Identität und membership_filter; die Datei users (mods-config/files/authorize) gibt das VLAN, und die Reihenfolge zählt. freeradius liest seine Dateien nur beim Start neu: freeradius -XC zum Prüfen, radtest zum Ausprobieren.
    .solution = /etc/nftables.conf, Kette input: „iifname "eth1.30" udp dport 1812 accept“; clients.conf: client aps mit ipaddr = 10.10.30.0/24 und secret = Rk7-zugang-2028; mods-available/ldap: base_dn = 'dc=thehive,dc=example', identity = 'cn=admin,dc=thehive,dc=example', password = honigwabe, membership_filter einkommentiert; sudo ln -s ../mods-available/ldap /etc/freeradius/3.0/mods-enabled/ldap; in authorize: DEFAULT Ldap-Group == "bueros" mit Tunnel-Private-Group-Id = 10, dann DEFAULT mit 20 (dazu Tunnel-Type = VLAN, Tunnel-Medium-Type = IEEE-802); sudo freeradius -XC, sudo systemctl reload nftables, sudo systemctl restart freeradius.
hint-wifi-end =
    .lead = Das WLAN funktioniert gerade jetzt; freeradius liest seine Dateien beim Booten neu, aber was ist mit der Firewall? Eine mit nft getippte Regel verschwindet beim Neustart.
    .solution = Kopier die Regel der Kette input („iifname "eth1.30" udp dport 1812 accept“) nach /etc/nftables.conf, dann sudo nft -c -f /etc/nftables.conf und sudo systemctl reload nftables.
