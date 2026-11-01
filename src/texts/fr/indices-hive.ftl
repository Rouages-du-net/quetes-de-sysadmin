### Indices gradués de La Ruche (voir src/engine/hints.ts) : un message
### par étape, indice-<chapitre>-<événement>, avec .piste (une direction, sans
### la commande exacte) et .solution (presque la réponse : la commande, avec
### ce qu'elle fait). Les noms des lieux sont ceux de noms.ftl.

## Chapitre 1 — Les VLAN

indice-vlan-en-place =
    .piste = Le trunk porte les VLAN 10, 20 et 30 étiquetés (plan-commutateur.txt) : le routeur a besoin d'une interface VLAN par numéro sur eth1, avec son adresse .1 dans chaque réseau. man ip-link (type vlan), ou man interfaces pour l'écrire tout de suite dans /etc/network/interfaces.
    .solution = Pour chaque VLAN (10, puis 20, puis 30) : sudo ip link add link eth1 name eth1.10 type vlan id 10, sudo ip addr add 10.10.10.1/24 dev eth1.10, sudo ip link set eth1.10 up. Ou directement : les trois strophes dans /etc/network/interfaces, puis sudo ifup -a.
indice-vlan-fin =
    .piste = Ce qui est fait avec ip disparaît au redémarrage : seul /etc/network/interfaces est relu. Une strophe auto + iface … inet static par VLAN (man interfaces), puis ifup.
    .solution = sudo nano /etc/network/interfaces, et pour chaque VLAN : « auto eth1.10 », « iface eth1.10 inet static », « address 10.10.10.1/24 » (idem eth1.20 et eth1.30) ; puis sudo ifup -a et ip -br a pour vérifier.

## Chapitre 2 — Le DHCP

indice-dhcp-fin =
    .piste = dnsmasq sert encore l'ancien réseau (/etc/dnsmasq.d/hive) : il lui faut une plage par VLAN (dhcp-range), écouter les interfaces VLAN et jamais eth0 (interface=), et une réservation pour l'imprimante d'après sa MAC (dhcp-host). man dnsmasq ; dnsmasq --test pour vérifier.
    .solution = sudo nano /etc/dnsmasq.d/hive : interface=eth1.10,eth1.20,eth1.30 ; dhcp-range=10.10.10.100,10.10.10.200,12h (idem 10.10.20.x et 10.10.30.x) ; dhcp-host=00:00:5e:00:53:30,imprimante,10.10.30.10. Puis sudo dnsmasq --test et sudo systemctl restart dnsmasq.

## Chapitre 3 — Les zones

indice-zones-en-place =
    .piste = Trois choses : que le routeur transmette les paquets (man sysctl : net.ipv4.ip_forward), qu'il les fasse sortir sous sa propre adresse (man nft : masquerade), et une chaîne forward fermée par défaut qui laisse revenir les réponses (ct state) puis ouvre zone par zone. Les notes-de-sacha.txt donnent le début ; /etc/nftables.conf est le bon endroit.
    .solution = Dans /etc/nftables.conf : table inet filter avec une chaîne forward « policy drop; », « ct state established,related accept », « iifname "eth1.10" accept », « iifname "eth1.20" oifname "eth0" accept » ; table ip nat avec une chaîne postrouting (type nat hook postrouting priority srcnat) et « oifname "eth0" masquerade ». Puis sudo sysctl -w net.ipv4.ip_forward=1, sudo nft -c -f /etc/nftables.conf et sudo nft -f /etc/nftables.conf.
indice-zones-fin =
    .piste = Tout marche, jusqu'au prochain redémarrage. Les réglages du noyau se gardent dans /etc/sysctl.d (man sysctl.d), les règles dans /etc/nftables.conf, chargé au démarrage par le service nftables… s'il est activé.
    .solution = sudo nano /etc/sysctl.d/90-router.conf avec « net.ipv4.ip_forward = 1 », puis sudo sysctl --system ; les règles dans /etc/nftables.conf (sudo nft -c -f /etc/nftables.conf), puis sudo systemctl enable --now nftables.

## Chapitre 4 — Le télétravail

indice-remote-work-en-place =
    .piste = Il faut des clés au routeur (man wg : genkey, pubkey ; umask avant, pour que la clé privée ne soit lisible que par toi), un /etc/wireguard/wg0.conf avec [Interface] et un [Peer] pour Malik, malik-laptop.conf complété, et le pare-feu : le port UDP de WireGuard dans la chaîne input, wg0 vers les bureaux dans forward. man wg-quick pour monter l'interface.
    .solution = umask 077 puis wg genkey | tee privatekey | wg pubkey > publickey ; sudo nano /etc/wireguard/wg0.conf : Address = 10.10.99.1/24, ListenPort = 51820, PrivateKey = (privatekey), et [Peer] PublicKey = (la clé de Malik), AllowedIPs = 10.10.99.2/32 ; dans malik-laptop.conf : PublicKey = (publickey), Endpoint = hive.example:51820, AllowedIPs = 10.10.10.0/24 ; dans /etc/nftables.conf : « udp dport 51820 accept » (input) et « iifname "wg0" oifname "eth1.10" accept » (forward), sudo systemctl reload nftables ; enfin sudo systemctl enable --now wg-quick@wg0.
indice-remote-work-fin =
    .piste = Le tunnel marche, mais au prochain démarrage ? wg0 ne revient que par son service s'il est activé, et le pare-feu que si ses règles sont dans /etc/nftables.conf. Une interface montée à la main avec wg-quick empêche le service de démarrer.
    .solution = sudo wg-quick down wg0 puis sudo systemctl enable --now wg-quick@wg0 ; les règles tapées avec nft recopiées dans /etc/nftables.conf, puis sudo systemctl reload nftables. Et pas de copie de la clé privée lisible par tous (chmod 600 privatekey).

## Chapitre 5 — La DMZ

indice-dmz-en-place =
    .piste = Le routeur n'a pas encore d'interface dans le VLAN 40 (plan-commutateur.txt, man interfaces). Ensuite, une traduction de destination au hook prerouting (man nft : dnat) pour les ports 80 et 443, et la chaîne forward : internet vers le serveur sur ces ports-là seulement, le serveur vers internet, rien vers l'intérieur. Attention : forward voit l'adresse APRÈS traduction.
    .solution = Dans /etc/network/interfaces : auto eth1.40, iface eth1.40 inet static, address 10.10.40.1/24, puis sudo ifup eth1.40. Dans /etc/nftables.conf : une chaîne prerouting (type nat hook prerouting priority dstnat) dans la table ip nat, avec « iifname "eth0" tcp dport {"{"} 80, 443 {"}"} dnat to 10.10.40.10 » ; dans forward : « iifname "eth0" oifname "eth1.40" ip daddr 10.10.40.10 tcp dport {"{"} 80, 443 {"}"} accept » et « iifname "eth1.40" oifname "eth0" accept ». Puis sudo nft -c -f /etc/nftables.conf et sudo systemctl reload nftables.
indice-dmz-fin =
    .piste = La DMZ marche en ce moment, mais un redémarrage ne garde que les fichiers : l'interface eth1.40 dans /etc/network/interfaces, les règles (dnat et forward) dans /etc/nftables.conf.
    .solution = Écris eth1.40 dans /etc/network/interfaces (auto eth1.40, iface eth1.40 inet static, address 10.10.40.1/24) et recopie les règles tapées avec nft dans /etc/nftables.conf ; vérifie avec sudo nft -c -f /etc/nftables.conf, puis sudo systemctl reload nftables.

## Chapitre 6 — L'Annexe

indice-annex-en-place =
    .piste = L'Annexe est un pair de plus dans /etc/wireguard/wg0.conf. Pour WireGuard, ses AllowedIPs sont les adresses d'où ce pair peut envoyer ET celles qu'on lui envoie : pour un site, tout son réseau. Puis annex-wg0.conf à compléter (sudo wg show donne la clé publique du routeur), sans oublier que l'Annexe est derrière une box (man wg : PersistentKeepalive). wg-quick ne relit pas le fichier tout seul.
    .solution = Dans /etc/wireguard/wg0.conf, ajouter [Peer] PublicKey = (la clé de Sami), AllowedIPs = 10.10.99.3/32, 10.20.10.0/24 ; dans annex-wg0.conf : PublicKey = (celle de sudo wg show), Endpoint = hive.example:51820, AllowedIPs = 10.10.10.0/24, PersistentKeepalive = 25 ; puis sudo systemctl restart wg-quick@wg0, et ip route ou sudo wg show pour vérifier.
indice-annex-fin =
    .piste = Les deux sites se parlent en ce moment. Au démarrage, wg0 repart de /etc/wireguard/wg0.conf par le service wg-quick@wg0, et le pare-feu de /etc/nftables.conf : tout ce qui a été réglé à la main doit y être.
    .solution = Le pair de l'Annexe (PublicKey, AllowedIPs = 10.10.99.3/32, 10.20.10.0/24) doit être dans /etc/wireguard/wg0.conf, et le service activé : sudo systemctl enable wg-quick@wg0, puis sudo systemctl restart wg-quick@wg0. Une règle nft tapée à la main va dans /etc/nftables.conf (ou s'efface avec sudo systemctl restart nftables).

## Chapitre 7 — L'annuaire

indice-directory-fin =
    .piste = Deux départs à traiter : Camille (son entrée, mais aussi son nom dans les groupes : memberUid ne se met pas à jour seul), et Sami (une entrée d'après modele-ines.ldif, un uidNumber libre, un mot de passe en empreinte, et le groupe bureaux). man ldapdelete, man ldapadd, man ldapmodify, man slappasswd ; il faut s'identifier pour écrire (courriel de Malik).
    .solution = ldapdelete -x -D cn=admin,dc=thehive,dc=example -w rayon-de-miel uid=camille,ou=people,dc=thehive,dc=example ; slappasswd pour l'empreinte {"{"}SSHA{"}"} ; sami.ldif d'après modele-ines.ldif (uid sami, cn Sami Lemaire, sn Lemaire, uidNumber 10004, userPassword = l'empreinte) et ldapadd -x -D … -w … -f sami.ldif ; puis un LDIF « changetype: modify » pour cn=bureaux (delete: memberUid camille, add: memberUid sami) et cn=equipe (delete: memberUid camille), passé à ldapmodify -x -D … -w … -f.

## Chapitre 8 — Le Wi-Fi des bureaux

indice-wifi-en-place =
    .piste = Quatre réglages, dans l'ordre du trajet d'une demande : la chaîne input doit laisser entrer l'UDP 1812 depuis le VLAN de la borne ; la borne doit être déclarée dans clients.conf (borne-bureaux.txt) ; le module ldap activé (un lien dans mods-enabled) avec base_dn, une identité, et membership_filter ; le fichier users (mods-config/files/authorize) donne le VLAN, et l'ordre compte. freeradius ne relit ses fichiers qu'au démarrage : freeradius -XC pour vérifier, radtest pour essayer.
    .solution = /etc/nftables.conf, chaîne input : « iifname "eth1.30" udp dport 1812 accept » ; clients.conf : client bornes avec ipaddr = 10.10.30.0/24 et secret = Rk7-borne-2028 ; mods-available/ldap : base_dn = 'dc=thehive,dc=example', identity = 'cn=admin,dc=thehive,dc=example', password = rayon-de-miel, membership_filter décommenté ; sudo ln -s ../mods-available/ldap /etc/freeradius/3.0/mods-enabled/ldap ; dans authorize : DEFAULT Ldap-Group == "bureaux" avec Tunnel-Private-Group-Id = 10, puis DEFAULT avec 20 (et Tunnel-Type = VLAN, Tunnel-Medium-Type = IEEE-802) ; sudo freeradius -XC, sudo systemctl reload nftables, sudo systemctl restart freeradius.
indice-wifi-fin =
    .piste = Le Wi-Fi marche en ce moment ; freeradius relira ses fichiers au démarrage, mais le pare-feu ? Une règle tapée avec nft disparaît au redémarrage.
    .solution = Recopie la règle de la chaîne input (« iifname "eth1.30" udp dport 1812 accept ») dans /etc/nftables.conf, puis sudo nft -c -f /etc/nftables.conf et sudo systemctl reload nftables.
