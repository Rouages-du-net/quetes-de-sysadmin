### Pistas graduales de La Colmena (ver src/engine/hints.ts): un mensaje por
### paso, hint-<capítulo>-<evento>, con .lead (una pista, sin el comando
### exacto) y .solution (casi la respuesta). Los nombres de lugares, como en
### names.ftl.

## Capítulo 1 — Las VLAN

hint-vlan-in-place =
    .lead = El trunk lleva las VLAN 10, 20 y 30, etiquetadas (plano-switch.txt): el router necesita una interfaz VLAN por número en eth1, con su dirección .1 en cada red. man ip-link (type vlan), o man interfaces para escribirlo directamente en /etc/network/interfaces.
    .solution = Para cada VLAN (10, luego 20, luego 30): sudo ip link add link eth1 name eth1.10 type vlan id 10, sudo ip addr add 10.10.10.1/24 dev eth1.10, sudo ip link set eth1.10 up. O directamente: las tres estrofas en /etc/network/interfaces, y luego sudo ifup -a.
hint-vlan-end =
    .lead = Lo que haces con ip desaparece al reiniciar: solo se vuelve a leer /etc/network/interfaces. Una estrofa auto + iface … inet static por VLAN (man interfaces), y luego ifup.
    .solution = sudo nano /etc/network/interfaces, y para cada VLAN: «auto eth1.10», «iface eth1.10 inet static», «address 10.10.10.1/24» (lo mismo para eth1.20 y eth1.30); luego sudo ifup -a, e ip -br a para comprobarlo.

## Capítulo 2 — DHCP

hint-dhcp-end =
    .lead = dnsmasq sigue sirviendo la antigua red (/etc/dnsmasq.d/hive): le hace falta un rango por VLAN (dhcp-range), escuchar en las interfaces VLAN y nunca en eth0 (interface=), y una reserva para la impresora según su MAC (dhcp-host). man dnsmasq; dnsmasq --test para comprobar.
    .solution = sudo nano /etc/dnsmasq.d/hive: interface=eth1.10,eth1.20,eth1.30; dhcp-range=10.10.10.100,10.10.10.200,12h (lo mismo para 10.10.20.x y 10.10.30.x); dhcp-host=00:00:5e:00:53:30,impresora,10.10.30.10. Luego sudo dnsmasq --test y sudo systemctl restart dnsmasq.

## Capítulo 3 — Las zonas

hint-zones-in-place =
    .lead = Tres cosas: el router debe reenviar los paquetes (man sysctl: net.ipv4.ip_forward), hacerlos salir con su propia dirección (man nft: masquerade), y tener una cadena forward cerrada por defecto que deje volver las respuestas (ct state) y luego abra zona a zona. notas-de-sacha.txt da el principio; /etc/nftables.conf es el sitio correcto.
    .solution = En /etc/nftables.conf: table inet filter con una cadena forward «policy drop;», «ct state established,related accept», «iifname "eth1.10" accept», «iifname "eth1.20" oifname "eth0" accept»; table ip nat con una cadena postrouting (type nat hook postrouting priority srcnat) y «oifname "eth0" masquerade». Luego sudo sysctl -w net.ipv4.ip_forward=1, sudo nft -c -f /etc/nftables.conf y sudo nft -f /etc/nftables.conf.
hint-zones-end =
    .lead = Todo funciona, hasta el próximo reinicio. Los ajustes del kernel se guardan en /etc/sysctl.d (man sysctl.d), las reglas en /etc/nftables.conf, que carga en el arranque el servicio nftables… si está habilitado.
    .solution = sudo nano /etc/sysctl.d/90-router.conf con «net.ipv4.ip_forward = 1», y luego sudo sysctl --system; las reglas en /etc/nftables.conf (sudo nft -c -f /etc/nftables.conf), y luego sudo systemctl enable --now nftables.

## Capítulo 4 — Teletrabajo

hint-remote-work-in-place =
    .lead = El router necesita claves (man wg: genkey, pubkey; antes umask, para que solo tú puedas leer la clave privada), un /etc/wireguard/wg0.conf con [Interface] y un [Peer] para Malik, malik-laptop.conf completado, y el cortafuegos: el puerto UDP de WireGuard en la cadena input, wg0 hacia las oficinas en forward. man wg-quick para levantar la interfaz.
    .solution = umask 077 y luego wg genkey | tee privatekey | wg pubkey > publickey; sudo nano /etc/wireguard/wg0.conf: Address = 10.10.99.1/24, ListenPort = 51820, PrivateKey = (privatekey), y [Peer] PublicKey = (la clave de Malik), AllowedIPs = 10.10.99.2/32; en malik-laptop.conf: PublicKey = (publickey), Endpoint = hive.example:51820, AllowedIPs = 10.10.10.0/24; en /etc/nftables.conf: «udp dport 51820 accept» (input) e «iifname "wg0" oifname "eth1.10" accept» (forward), sudo systemctl reload nftables; por último sudo systemctl enable --now wg-quick@wg0.
hint-remote-work-end =
    .lead = El túnel funciona, pero ¿en el próximo arranque? wg0 solo vuelve por su servicio si está habilitado, y el cortafuegos solo si sus reglas están en /etc/nftables.conf. Una interfaz levantada a mano con wg-quick impide arrancar al servicio.
    .solution = sudo wg-quick down wg0 y luego sudo systemctl enable --now wg-quick@wg0; las reglas escritas con nft, copiadas en /etc/nftables.conf, y luego sudo systemctl reload nftables. Y ninguna copia de la clave privada legible por todo el mundo (chmod 600 privatekey).

## Capítulo 5 — La DMZ

hint-dmz-in-place =
    .lead = El router todavía no tiene interfaz en la VLAN 40 (plano-switch.txt, man interfaces). Luego una traducción de destino en el hook prerouting (man nft: dnat) para los puertos 80 y 443, y la cadena forward: internet hacia el servidor solo en esos puertos, el servidor hacia internet, nada hacia el interior. Cuidado: forward ve la dirección DESPUÉS de la traducción.
    .solution = En /etc/network/interfaces: auto eth1.40, iface eth1.40 inet static, address 10.10.40.1/24, y luego sudo ifup eth1.40. En /etc/nftables.conf: una cadena prerouting (type nat hook prerouting priority dstnat) en table ip nat, con «iifname "eth0" tcp dport {"{"} 80, 443 {"}"} dnat to 10.10.40.10»; en forward: «iifname "eth0" oifname "eth1.40" ip daddr 10.10.40.10 tcp dport {"{"} 80, 443 {"}"} accept» e «iifname "eth1.40" oifname "eth0" accept». Luego sudo nft -c -f /etc/nftables.conf y sudo systemctl reload nftables.
hint-dmz-end =
    .lead = La DMZ funciona ahora mismo, pero un reinicio solo conserva los archivos: la interfaz eth1.40 en /etc/network/interfaces, las reglas (dnat y forward) en /etc/nftables.conf.
    .solution = Escribe eth1.40 en /etc/network/interfaces (auto eth1.40, iface eth1.40 inet static, address 10.10.40.1/24) y copia las reglas escritas con nft en /etc/nftables.conf; compruébalo con sudo nft -c -f /etc/nftables.conf, y luego sudo systemctl reload nftables.

## Capítulo 6 — El Anexo

hint-annex-in-place =
    .lead = El Anexo es un peer más en /etc/wireguard/wg0.conf. Para WireGuard, sus AllowedIPs son las direcciones desde las que este peer puede enviar Y las que se le envían: para una sede, toda su red. Luego completa annex-wg0.conf (sudo wg show da la clave pública del router), recordando que el Anexo está detrás del router de un operador (man wg: PersistentKeepalive). wg-quick no vuelve a leer el archivo por sí solo.
    .solution = En /etc/wireguard/wg0.conf, añade [Peer] PublicKey = (la clave de Sami), AllowedIPs = 10.10.99.3/32, 10.20.10.0/24; en annex-wg0.conf: PublicKey = (la de sudo wg show), Endpoint = hive.example:51820, AllowedIPs = 10.10.10.0/24, PersistentKeepalive = 25; luego sudo systemctl restart wg-quick@wg0, e ip route o sudo wg show para comprobarlo.
hint-annex-end =
    .lead = Las dos sedes se hablan ahora mismo. En el arranque, wg0 vuelve a arrancar desde /etc/wireguard/wg0.conf por el servicio wg-quick@wg0, y el cortafuegos desde /etc/nftables.conf: todo lo que se ha hecho a mano tiene que estar ahí.
    .solution = El peer del Anexo (PublicKey, AllowedIPs = 10.10.99.3/32, 10.20.10.0/24) tiene que estar en /etc/wireguard/wg0.conf, y el servicio habilitado: sudo systemctl enable wg-quick@wg0, y luego sudo systemctl restart wg-quick@wg0. Una regla nft escrita a mano va en /etc/nftables.conf (o se borra con sudo systemctl restart nftables).

## Capítulo 7 — El directorio

hint-directory-end =
    .lead = Dos personas de las que ocuparse: Camille (su entrada, pero también su nombre en los grupos: memberUid no se actualiza solo), y Sami (una entrada basada en plantilla-ines.ldif, un uidNumber libre, una contraseña con hash, y el grupo oficinas). man ldapdelete, man ldapadd, man ldapmodify, man slappasswd; para escribir hay que identificarse (el correo de Malik).
    .solution = ldapdelete -x -D cn=admin,dc=thehive,dc=example -w panal uid=camille,ou=people,dc=thehive,dc=example; slappasswd para el hash {"{"}SSHA{"}"}; sami.ldif basado en plantilla-ines.ldif (uid sami, cn Sami Lemaire, sn Lemaire, uidNumber 10004, userPassword = el hash) y ldapadd -x -D … -w … -f sami.ldif; luego un LDIF con «changetype: modify» para cn=oficinas (delete: memberUid camille, add: memberUid sami) y cn=equipo (delete: memberUid camille), pasado a ldapmodify -x -D … -w … -f.

## Capítulo 8 — El wifi de las oficinas

hint-wifi-in-place =
    .lead = Cuatro ajustes, en el orden que sigue una petición: la cadena input debe dejar entrar UDP 1812 desde la VLAN del punto de acceso; el punto de acceso debe estar declarado en clients.conf (punto-oficinas.txt); el módulo ldap activado (un enlace en mods-enabled) con base_dn, una identidad, y membership_filter; el archivo users (mods-config/files/authorize) da la VLAN, y el orden importa. freeradius solo vuelve a leer sus archivos al arrancar: freeradius -XC para comprobar, radtest para probar.
    .solution = /etc/nftables.conf, cadena input: «iifname "eth1.30" udp dport 1812 accept»; clients.conf: client puntos con ipaddr = 10.10.30.0/24 y secret = Rk7-punto-2028; mods-available/ldap: base_dn = 'dc=thehive,dc=example', identity = 'cn=admin,dc=thehive,dc=example', password = panal, membership_filter descomentado; sudo ln -s ../mods-available/ldap /etc/freeradius/3.0/mods-enabled/ldap; en authorize: DEFAULT Ldap-Group == "oficinas" con Tunnel-Private-Group-Id = 10, y luego DEFAULT con 20 (más Tunnel-Type = VLAN, Tunnel-Medium-Type = IEEE-802); sudo freeradius -XC, sudo systemctl reload nftables, sudo systemctl restart freeradius.
hint-wifi-end =
    .lead = El wifi funciona ahora mismo; freeradius volverá a leer sus archivos en el arranque, pero ¿y el cortafuegos? Una regla escrita con nft desaparece al reiniciar.
    .solution = Copia la regla de la cadena input («iifname "eth1.30" udp dport 1812 accept») en /etc/nftables.conf, y luego sudo nft -c -f /etc/nftables.conf y sudo systemctl reload nftables.
