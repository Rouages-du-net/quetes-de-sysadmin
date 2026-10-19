// La Ruche : le réseau d'un tiers-lieu (VLAN, DHCP…). Rejoué avec la
// console, dans chaque langue.

import { describe, expect, it } from 'vitest';
import { Console } from '../src/moteur/console';
import { HISTOIRES } from '../src/moteur/chapitres';
import { LANGUES, LANGUE_DE_REFERENCE } from '../src/textes';

const EFFACEUR = HISTOIRES.find((h) => h.id === 'effaceur')!.chapitres.map((c) => c.id);
const MDP = 'abeille-2027';
const VLANS = `
auto eth1.10
iface eth1.10 inet static
    address 10.10.10.1/24

auto eth1.20
iface eth1.20 inet static
    address 10.10.20.1
    netmask 255.255.255.0

auto eth1.30
iface eth1.30 inet static
    address 10.10.30.1/24
`;

for (const langue of LANGUES)
  describe(`La Ruche — ${langue}`, () => {
    const fr = langue === LANGUE_DE_REFERENCE;
    const contient = (tout: string, texte: string) => fr && expect(tout).toContain(texte);
    const partie = (termines: string[] = []) => {
      const c = new Console({ langue, termines: [...EFFACEUR, ...termines] });
      const une = (l: string) => {
        let sortie = c.executer(l) ?? '';
        if (c.shell.attente) sortie += '\n' + (c.executer(MDP) ?? '');
        return sortie;
      };
      const jouer = (lignes: string[]) => lignes.map(une).join('\n');
      const editer = (commande: string, changer: (texte: string) => string) => {
        une(commande);
        c.enregistrer(changer(c.edition!.texte));
        return c.quitterEdition();
      };
      jouer(['ssh ruche', 'yes']);
      return { c, jouer, editer };
    };

    it('chapitre 1 — solution : /etc/network/interfaces, ifup -a', () => {
      const { c, jouer, editer } = partie();
      let tout = jouer(['ip -br a', 'ping -c 1 10.10.10.5', 'man interfaces']);
      expect(tout).toContain('INTERFACES(5)');
      expect(tout).toContain('eth1             UP             192.168.1.1/24');
      expect(tout).toContain('1 packets transmitted, 0 received, 100% packet loss');
      editer('sudo nano /etc/network/interfaces', (t) => t + VLANS);
      tout = jouer(['sudo ifup -a', 'ip -br a', 'ping -c 1 nas', 'ip -d link show eth1.30']);
      expect(tout).toContain('eth1.20@eth1     UP             10.10.20.1/24');
      expect(tout).toContain('64 bytes from 10.10.10.5');
      expect(tout).toContain('vlan protocol 802.1Q id 30');
      contient(tout, 'https://manpages.debian.org/trixie/vlan/vlan-interfaces.5.en.html');
      expect(c.termines).toContain('vlan');
    });

    it('chapitre 1 — autre solution : ip d’abord, puis le fichier', () => {
      const { c, jouer, editer } = partie();
      let tout = [10, 20, 30]
        .map((v) =>
          jouer([
            `sudo ip link add link eth1 name eth1.${v} type vlan id ${v}`,
            `sudo ip addr add 10.10.${v}.1/24 dev eth1.${v}`,
            `sudo ip link set eth1.${v} up`,
          ]),
        )
        .join('\n');
      tout += jouer(['ping -c 1 10.10.30.11']);
      expect(tout).toContain('64 bytes from 10.10.30.11');
      contient(tout, 'disparaîtra au prochain redémarrage');
      expect(c.termines).not.toContain('vlan');
      // Le fichier, avec vlan-raw-device et des noms à soi.
      tout = editer(
        'sudo nano /etc/network/interfaces',
        (t) =>
          t +
          [10, 20, 30].map((v) => `\nauto vlan${v}\niface vlan${v} inet static\n    vlan-raw-device eth1\n    address 10.10.${v}.1/24\n`).join(''),
      );
      expect(c.termines).toContain('vlan');
    });

    it('chapitre 1 — fausses pistes : le mauvais numéro, une faute dans le fichier, sans sudo', () => {
      const { c, jouer, editer } = partie();
      let tout = jouer(['ip link add link eth1 name eth1.30 type vlan id 30', 'sudo ip link add link eth1 name eth1.30 type vlan id 3']);
      expect(tout).toContain('RTNETLINK answers: Operation not permitted');
      tout = jouer(['sudo ip addr add 10.10.30.1/24 dev eth1.30', 'sudo ip link set eth1.30 up', 'ping -c 2 imprimante']);
      expect(tout).toContain('From 10.10.30.1 icmp_seq=1 Destination Host Unreachable');
      contient(tout, 'pas le bon numéro de VLAN');
      jouer(['sudo ip link del eth1.30']);
      editer(
        'sudo nano /etc/network/interfaces',
        (t) => t + VLANS.replace('10.10.20.1\n    netmask 255.255.255.0', '10.10.20.1\n    netmask 255.255.0.255'),
      );
      tout = jouer(['sudo ifup -a']);
      expect(tout).toContain('invalid netmask 255.255.0.255');
      expect(c.termines).not.toContain('vlan');
    });

    const RUCHE = '/etc/dnsmasq.d/ruche';
    const PLAGES = 'dhcp-range=10.10.10.100,10.10.10.200,12h\ndhcp-range=10.10.20.100,10.10.20.250,2h\ndhcp-range=10.10.30.100,10.10.30.200,24h\n';
    const RESERVATION = 'dhcp-host=00:00:5e:00:53:30,imprimante,10.10.30.10\n';

    it('chapitre 2 — solution : une plage par VLAN, la réservation, interface=', () => {
      const { c, jouer, editer } = partie(['vlan']);
      let tout = jouer(['cat /var/lib/misc/dnsmasq.leases', 'journalctl -u dnsmasq']);
      expect(tout).toContain('DHCP, IP range 192.168.1.100 -- 192.168.1.200');
      editer(`sudo nano ${RUCHE}`, () => 'interface=eth1.10,eth1.20,eth1.30\n' + PLAGES + RESERVATION);
      tout = jouer(['sudo dnsmasq --test', 'sudo systemctl restart dnsmasq', 'cat /var/lib/misc/dnsmasq.leases', 'ping -c 1 imprimante']);
      expect(tout).toContain('dnsmasq: syntax check OK.');
      expect(tout).toContain('00:00:5e:00:53:30 10.10.30.10 imprimante');
      expect(tout).toContain('64 bytes from 10.10.30.10');
      contient(tout, 'https://dnsmasq.org/docs/dnsmasq-man.html');
      expect(c.termines).toContain('dhcp');
    });

    it('chapitre 2 — autre solution : un joker, et except-interface', () => {
      const { c, jouer, editer } = partie(['vlan']);
      editer(`sudo nano ${RUCHE}`, () => 'except-interface=eth0\n' + PLAGES.replace(/dhcp-range=/g, 'dhcp-range=set:x,') + RESERVATION);
      jouer(['sudo systemctl restart dnsmasq']);
      expect(c.termines).toContain('dhcp');
    });

    it('chapitre 2 — fausses pistes : l’ancienne interface, la box qui entend, une faute, l’imprimante ailleurs', () => {
      const { c, jouer, editer } = partie(['vlan']);
      editer(`sudo nano ${RUCHE}`, (t) => t + '\n' + PLAGES);
      let tout = jouer(['sudo systemctl restart dnsmasq', 'cat /var/lib/misc/dnsmasq.leases']);
      // interface=eth1 n'écoute pas eth1.10 : personne n'a d'adresse.
      expect(tout).not.toContain('poste-malik');
      tout = editer(`sudo nano ${RUCHE}`, () => PLAGES);
      contient(tout, 'DHCP pirate');
      tout = editer(`sudo nano ${RUCHE}`, () => 'interfaces=eth1*\n' + PLAGES);
      tout += jouer(['sudo dnsmasq --test', 'sudo systemctl restart dnsmasq']);
      expect(tout).toContain(`dnsmasq: bad option at line 1 of ${RUCHE}`);
      editer(`sudo nano ${RUCHE}`, () => 'interface=eth1*\n' + PLAGES);
      tout = jouer(['sudo systemctl restart dnsmasq']);
      contient(tout, 'pas 10.10.30.10');
      expect(c.termines).not.toContain('dhcp');
    });

    const NFTABLES = `#!/usr/sbin/nft -f

flush ruleset

define BUREAUX = "eth1.10"

table inet filter {
	chain input {
		type filter hook input priority filter; policy accept;
	}
	chain forward {
		type filter hook forward priority filter; policy drop;
		ct state established,related accept
		iifname $BUREAUX counter accept
		iifname "eth1.20" oifname "eth0" accept
		log prefix "forward refuse: " counter
	}
}

table ip nat {
	chain postrouting {
		type nat hook postrouting priority srcnat;
		oifname "eth0" masquerade
	}
}
`;

    it('chapitre 3 — solution : /etc/sysctl.d, /etc/nftables.conf, systemctl enable --now', () => {
      const { c, jouer, editer } = partie(['vlan', 'dhcp']);
      let tout = jouer(['cat notes-de-sacha.txt', 'sysctl net.ipv4.ip_forward', 'sudo conntrack -L', 'man sysctl.d']);
      expect(tout).toContain('SYSCTL.D(5)');
      expect(tout).toContain('net.ipv4.ip_forward = 0');
      expect(tout).toContain('1 flow entries have been shown.');
      editer('sudo nano /etc/sysctl.d/90-routeur.conf', () => 'net.ipv4.ip_forward = 1\n');
      tout = jouer(['sudo sysctl --system']);
      expect(tout).toContain('* Applying /etc/sysctl.d/90-routeur.conf ...');
      expect(tout).toContain('net.ipv4.ip_forward = 1');
      editer('sudo nano /etc/nftables.conf', () => NFTABLES);
      tout = jouer([
        'sudo nft -c -f /etc/nftables.conf',
        'sudo systemctl enable --now nftables',
        'sudo nft list ruleset',
        'sudo conntrack -L',
        'journalctl -k',
      ]);
      expect(tout).toContain('iifname "eth1.10" counter packets 3 bytes 180 accept');
      expect(tout).toContain('dst=198.51.100.80 sport=51735 dport=443 src=198.51.100.80 dst=192.0.2.21');
      expect(tout).toContain('forward refuse: IN=eth1.20 OUT=eth1.10');
      expect(tout).not.toContain('dst=203.0.113.50');
      contient(tout, 'https://wiki.nftables.org/wiki-nftables/index.php/Performing_Network_Address_Translation_(NAT)');
      expect(c.termines).toContain('zones');
      // Après un redémarrage, tout revient tout seul.
      tout = jouer(['sudo reboot', 'ssh ruche', 'sysctl net.ipv4.ip_forward', 'sudo conntrack -L -s 10.10.20.197']);
      expect(tout).toContain('net.ipv4.ip_forward = 1');
      expect(tout).toContain('dst=198.51.100.80 sport=47099 dport=443 src=198.51.100.80 dst=192.0.2.21');
      expect(tout).not.toContain('dport=445');
    });

    it('chapitre 3 — autre solution : à la main d’abord, le redémarrage, puis les fichiers (adresses et ensembles)', () => {
      const { c, jouer, editer } = partie(['vlan', 'dhcp']);
      let tout = jouer([
        'echo 1 | sudo tee /proc/sys/net/ipv4/ip_forward',
        'sudo nft add table ip nat',
        "sudo nft 'add chain ip nat postrouting { type nat hook postrouting priority srcnat; }'",
        'sudo nft add rule ip nat postrouting oifname "eth0" masquerade',
        "sudo nft 'add chain inet filter forward { type filter hook forward priority 0; policy drop; }'",
      ]);
      contient(tout, 'y compris là où il ne faut pas');
      expect(tout).toContain('Error: Could not process rule: No such file or directory');
      tout = jouer([
        'sudo nft add table inet filter',
        "sudo nft 'add chain inet filter forward { type filter hook forward priority 0; policy drop; }'",
        'sudo nft add rule inet filter forward ip saddr 10.10.10.0/24 accept',
        'sudo nft add rule inet filter forward ip saddr 10.10.20.0/24 ip daddr != 10.0.0.0/8 accept',
      ]);
      contient(tout, 'pas les réponses');
      tout = jouer([
        'sudo nft -a list chain inet filter forward',
        'sudo nft insert rule inet filter forward ct state { established, related } accept',
      ]);
      expect(tout).toContain('ip saddr 10.10.20.0/24 ip daddr != 10.0.0.0/8 accept # handle 3');
      contient(tout, 'si le routeur');
      expect(c.termines).not.toContain('zones');
      tout = jouer(['sudo reboot', 'ssh ruche', 'cat /proc/sys/net/ipv4/ip_forward', 'sudo nft list ruleset']);
      expect(tout).toMatch(/cat courriel_malik.txt\n0\n/);
      expect(tout).not.toContain('masquerade');
      editer('sudo nano /etc/sysctl.conf', (t) => t.replace('#net.ipv4.ip_forward=1', 'net.ipv4.ip_forward=1'));
      editer('sudo nano /etc/nftables.conf', () =>
        NFTABLES.replace('iifname $BUREAUX counter accept', 'ip saddr 10.10.10.0/24 accept').replace(
          'iifname "eth1.20" oifname "eth0" accept',
          'iifname { "eth1.20" } ip daddr != { 10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16 } tcp dport { http, https } accept',
        ),
      );
      jouer(['sudo sysctl -p', 'sudo systemctl enable nftables', 'sudo systemctl start nftables']);
      expect(c.termines).toContain('zones');
    });

    it('chapitre 3 — fausses pistes : sans sudo, une faute, ssh fermé, la caméra qui sort', () => {
      const { c, jouer, editer } = partie(['vlan', 'dhcp']);
      let tout = jouer([
        'nft list ruleset',
        'sysctl -w net.ipv4.ip_forward=1',
        'sysctl net.ipv4.ip_forwrd',
        'echo 1 > /proc/sys/net/ipv4/ip_forward',
      ]);
      expect(tout).toContain('netlink: Error: cache initialization failed: Operation not permitted');
      expect(tout).toContain('sysctl: permission denied on key "net.ipv4.ip_forward"');
      expect(tout).toContain('sysctl: cannot stat /proc/sys/net/ipv4/ip_forwrd: No such file or directory');
      editer('sudo nano /etc/nftables.conf', () => NFTABLES.replace('oifname "eth0" accept', 'oifnam "eth0" accept'));
      tout = jouer(['sudo nft -c -f /etc/nftables.conf', 'sudo systemctl start nftables']);
      expect(tout).toContain('/etc/nftables.conf:15:21-26: Error: syntax error, unexpected string');
      expect(tout).toContain('Job for nftables.service failed');
      // L'entrée fermée : plus de nouvelle connexion ssh.
      editer('sudo nano /etc/nftables.conf', () => NFTABLES.replace('priority filter; policy accept;', 'priority filter; policy drop;'));
      tout = jouer(['sudo sysctl -w net.ipv4.ip_forward=1', 'sudo nft -f /etc/nftables.conf']);
      contient(tout, 'ne tient qu');
      expect(c.termines).not.toContain('zones');
      // NAT pour tout le monde, sans filtrer : la caméra sort.
      editer('sudo nano /etc/nftables.conf', () => NFTABLES.replace('policy drop;\n\t\tct state', 'policy accept;\n\t\tct state'));
      tout = jouer(['sudo nft -f /etc/nftables.conf', 'sudo conntrack -L -d 203.0.113.50']);
      expect(tout).toContain('src=10.10.30.11 dst=203.0.113.50');
      expect(c.termines).not.toContain('zones');
    });

    const PEER_MALIK = (cle: string) => `\n[Peer]\nPublicKey = ${cle}\nAllowedIPs = 10.10.99.2/32\n`;
    const WG0 = (cle: string) => `[Interface]\nAddress = 10.10.99.1/24\nListenPort = 51820\nPrivateKey = ${cle}\n`;
    const clesDe = (c: Console) => ({
      malik: c.shell.lire('/home/vous/courriel_malik.txt')!.match(/[A-Za-z0-9+/]{43}=/)![0],
      privee: () => c.shell.lire('/home/vous/privatekey')!.trim(),
      publique: () => c.shell.lire('/home/vous/publickey')!.trim(),
    });
    const PORTABLE =
      (pub: string, endpoint = 'ruche.example:51820') =>
      (t: string) =>
        t
          .replace('PublicKey =', `PublicKey = ${pub}`)
          .replace('Endpoint =', `Endpoint = ${endpoint}`)
          .replace('AllowedIPs =', 'AllowedIPs = 10.10.10.0/24');
    const PARE_FEU = (t: string) =>
      t
        .replace('icmp type echo-request accept', 'icmp type echo-request accept\n\t\tudp dport 51820 accept')
        .replace('iifname "eth1.20" oifname "eth0" accept', 'iifname "eth1.20" oifname "eth0" accept\n\t\tiifname "wg0" oifname "eth1.10" accept');

    it('chapitre 4 — solution : umask 077, wg0.conf, le portable, le pare-feu, wg-quick@wg0', () => {
      const { c, jouer, editer } = partie(['vlan', 'dhcp', 'zones']);
      const k = clesDe(c);
      let tout = jouer(['cat portable-malik.conf', 'umask 077', 'wg genkey | tee privatekey | wg pubkey > publickey', 'ls -l']);
      expect(tout).toContain('-rw------- vous     vous         44 privatekey');
      editer('sudo nano /etc/wireguard/wg0.conf', () => WG0(k.privee()) + PEER_MALIK(k.malik));
      editer('nano portable-malik.conf', PORTABLE(k.publique()));
      editer('sudo nano /etc/nftables.conf', PARE_FEU);
      tout = jouer([
        'sudo nft -c -f /etc/nftables.conf',
        'sudo systemctl reload nftables',
        'sudo systemctl enable --now wg-quick@wg0',
        'sudo wg show',
        'ping -c 1 10.10.99.2',
      ]);
      expect(tout).toContain('latest handshake: 7 seconds ago');
      expect(tout).toContain('endpoint: 198.51.100.23:41414');
      expect(tout).toContain('64 bytes from 10.10.99.2');
      tout += jouer(['ip -br a']);
      expect(tout).toContain('wg0              UNKNOWN        10.10.99.1/24');
      contient(tout, 'https://www.wireguard.com/quickstart/');
      expect(c.termines).toContain('vpn');
    });

    it('chapitre 4 — fausses pistes : la clé lisible, la porte fermée, les clés croisées, wg-quick puis le service', () => {
      const { c, jouer, editer } = partie(['vlan', 'dhcp', 'zones']);
      const k = clesDe(c);
      let tout = jouer(['wg genkey > privatekey', 'wg pubkey < privatekey', 'sudo wg show', 'wg show']);
      expect(tout).toContain('Warning: writing to world accessible file.');
      expect(tout).toContain('Unable to access interface: Operation not permitted');
      jouer(['cat privatekey | wg pubkey > publickey']);
      tout = editer('sudo nano /etc/wireguard/wg0.conf', () => WG0(k.privee()) + PEER_MALIK(k.malik));
      contient(tout, 'comptes de la machine peuvent le lire');
      // Les clés croisées : la clé PRIVÉE du routeur donnée au portable.
      editer('nano portable-malik.conf', PORTABLE(k.privee()));
      tout = jouer(['sudo wg-quick up wg0']);
      expect(tout).toContain('[#] ip link set mtu 1420 up dev wg0');
      // Porte fermée d'abord : la chaîne input jette l'UDP.
      contient(tout, 'la chaîne input les jette');
      jouer(['sudo nft add rule inet filter input udp dport 51820 accept']);
      tout = jouer(['sudo wg show wg0']);
      expect(tout).not.toContain('latest handshake');
      editer(
        'nano portable-malik.conf',
        () =>
          '[Interface]\nAddress = 10.10.99.2/32\n\n[Peer]\n' +
          `PublicKey = ${k.publique()}\nEndpoint = 192.0.2.21:51820\nAllowedIPs = 10.10.10.5/32\n`,
      );
      tout = jouer(['sudo wg show wg0', 'sudo systemctl enable wg-quick@wg0', 'sudo systemctl start wg-quick@wg0', 'journalctl -u wg-quick@wg0']);
      expect(tout).toContain('latest handshake');
      expect(tout).toContain("wg-quick: `wg0' already exists");
      jouer(['sudo nft add rule inet filter forward iifname wg0 accept', 'chmod 600 privatekey']);
      // Tout marche… jusqu'au redémarrage : le pare-feu n'est pas dans le fichier.
      expect(c.termines).not.toContain('vpn');
      tout = jouer(['sudo wg-quick down wg0', 'sudo systemctl start wg-quick@wg0', 'sudo reboot', 'ssh ruche', 'sudo wg show wg0']);
      expect(tout).toContain('[#] ip link delete dev wg0');
      // wg0 est revenu (le service), mais pas la règle tapée à la main : plus de poignée de main.
      expect(tout).toContain('peer: ');
      expect(tout).not.toContain('latest handshake');
      editer('sudo nano /etc/nftables.conf', PARE_FEU);
      jouer(['sudo systemctl restart nftables']);
      expect(c.termines).toContain('vpn');
    });

    const ETH140 = '\nauto eth1.40\niface eth1.40 inet static\n    address 10.10.40.1/24\n';
    const DMZ = (t: string) =>
      t
        .replace(
          'iifname "wg0" oifname "eth1.10" accept',
          'iifname "wg0" oifname "eth1.10" accept\n\t\tiifname "eth0" oifname "eth1.40" ip daddr 10.10.40.10 tcp dport { http, https } accept\n\t\tiifname "eth1.40" oifname "eth0" accept',
        )
        .replace(
          '\t\toifname "eth0" masquerade\n\t}',
          '\t\toifname "eth0" masquerade\n\t}\n\tchain prerouting {\n\t\ttype nat hook prerouting priority dstnat;\n\t\tiifname "eth0" tcp dport { 80, 443 } dnat to 10.10.40.10\n\t}',
        );

    it('chapitre 5 — solution : eth1.40, dnat au prerouting, forward vers la DMZ seulement', () => {
      const { c, jouer, editer } = partie(['vlan', 'dhcp', 'zones', 'vpn']);
      let tout = jouer(['cat plan-commutateur.txt', 'ping -c 1 web']);
      // Sans interface dans ce réseau, le ping part vers la box et s'y perd.
      expect(tout).toContain('1 packets transmitted, 0 received, 100% packet loss');
      editer('sudo nano /etc/network/interfaces', (t) => t + ETH140);
      editer('sudo nano /etc/nftables.conf', DMZ);
      tout = jouer(['sudo ifup eth1.40', 'sudo nft -c -f /etc/nftables.conf', 'sudo systemctl reload nftables', 'sudo conntrack -L -s 203.0.113.77']);
      expect(tout).toContain('src=203.0.113.77 dst=192.0.2.21 sport=42637 dport=443 src=10.10.40.10 dst=203.0.113.77 sport=443');
      expect(tout).not.toContain('dport=22');
      contient(tout, 'Netfilter_hooks');
      tout = jouer(['sudo conntrack -L -s 10.10.40.10']);
      expect(tout).toContain('src=10.10.40.10 dst=198.51.100.80');
      expect(tout).not.toContain('dst=10.10.10.5');
      expect(c.termines).toContain('dmz');
    });

    it('chapitre 5 — fausses pistes : sans forward, l’adresse publique, tout publier, la DMZ ouverte, à la main', () => {
      const { c, jouer, editer } = partie(['vlan', 'dhcp', 'zones', 'vpn']);
      let tout = jouer([
        'sudo ip link add link eth1 name eth1.40 type vlan id 40',
        'sudo ip addr add 10.10.40.1/24 dev eth1.40',
        'sudo ip link set eth1.40 up',
        "sudo nft 'add chain ip nat prerouting { type nat hook prerouting priority dstnat; }'",
        'sudo nft add rule ip nat prerouting iifname eth0 dnat to 10.10.40.10',
      ]);
      contient(tout, 'fermée par défaut');
      tout = jouer(['sudo nft add rule inet filter forward ip daddr 192.0.2.21 accept']);
      contient(tout, 'ne la verra jamais');
      // Tout publier, et la DMZ qui voit tout : trop ouvert.
      tout = jouer([
        'sudo nft add rule inet filter forward iifname eth0 oifname eth1.40 accept',
        'sudo nft add rule inet filter forward iifname eth1.40 accept',
      ]);
      contient(tout, 'la DMZ est trop ouverte');
      expect(c.termines).not.toContain('dmz');
      // Corrigé à la main : marche, mais ne tient pas.
      tout = jouer([
        'sudo nft flush chain ip nat prerouting',
        'sudo nft add rule ip nat prerouting iifname eth0 tcp dport { 80, 443 } dnat to 10.10.40.10',
        'sudo nft -a list chain inet filter forward',
      ]);
      const poignee = (regle: string) => tout.match(new RegExp(`${regle} # handle (\\d+)`))![1];
      tout = jouer([
        `sudo nft delete rule inet filter forward handle ${poignee('ip daddr 192.0.2.21 accept')}`,
        `sudo nft delete rule inet filter forward handle ${poignee('iifname "eth1.40" accept')}`,
        `sudo nft delete rule inet filter forward handle ${poignee('iifname "eth0" oifname "eth1.40" accept')}`,
        'sudo nft add rule inet filter forward iifname eth0 oifname eth1.40 tcp dport { 80, 443 } accept',
        'sudo nft add rule inet filter forward iifname eth1.40 oifname eth0 accept',
      ]);
      contient(tout, 'au prochain redémarrage');
      expect(c.termines).not.toContain('dmz');
      editer('sudo nano /etc/network/interfaces', (t) => t + ETH140);
      editer('sudo nano /etc/nftables.conf', DMZ);
      expect(c.termines).toContain('dmz');
    });

    const cleAnnexe = (c: Console) => c.shell.lire('/home/vous/courriel_sami.txt')!.match(/[A-Za-z0-9+/]{43}=/)![0];
    const PAIR_ANNEXE =
      (cle: string, autorisees = '10.10.99.3/32, 10.20.10.0/24') =>
      (t: string) =>
        t + `\n\n# Annexe\n[Peer]\nPublicKey = ${cle}\nAllowedIPs = ${autorisees}\n`;
    const CONF_ANNEXE =
      (pub: string, autorisees = '10.10.10.0/24', keepalive = true) =>
      (t: string) =>
        t
          .replace('PublicKey =', `PublicKey = ${pub}`)
          .replace('Endpoint =', 'Endpoint = ruche.example:51820')
          .replace('AllowedIPs =', `AllowedIPs = ${autorisees}${keepalive ? '\nPersistentKeepalive = 25' : ''}`);

    it('chapitre 6 — solution : un pair pour le site, ses AllowedIPs, PersistentKeepalive', () => {
      const { c, jouer, editer } = partie(['vlan', 'dhcp', 'zones', 'vpn', 'dmz']);
      let tout = jouer(['sudo wg show']);
      const pub = tout.match(/public key: (\S+)/)![1];
      editer('sudo nano /etc/wireguard/wg0.conf', PAIR_ANNEXE(cleAnnexe(c)));
      editer('nano annexe-wg0.conf', CONF_ANNEXE(pub));
      tout = jouer(['sudo systemctl restart wg-quick@wg0', 'ip route', 'sudo wg show', 'ping -c 1 10.20.10.20']);
      expect(tout).toContain('10.20.10.0/24 dev wg0 scope link');
      expect(tout).toContain('allowed ips: 10.10.99.3/32, 10.20.10.0/24');
      expect(tout).toContain('64 bytes from 10.20.10.20');
      contient(tout, 'https://www.wireguard.com/#cryptokey-routing');
      expect(c.termines).toContain('annexe');
    });

    it('chapitre 6 — fausses pistes : pas relu, l’adresse seule, l’Annexe qui s’endort, tout ouvert', () => {
      const { c, jouer, editer } = partie(['vlan', 'dhcp', 'zones', 'vpn', 'dmz']);
      const pub = jouer(['sudo wg show']).match(/public key: (\S+)/)![1];
      let tout = editer('sudo nano /etc/wireguard/wg0.conf', PAIR_ANNEXE(cleAnnexe(c), '10.10.99.3/32'));
      contient(tout, 'ne relit pas le fichier');
      editer('nano annexe-wg0.conf', CONF_ANNEXE(pub, '10.10.10.0/24', false));
      tout = jouer(['sudo systemctl restart wg-quick@wg0']);
      contient(tout, 'tout son réseau');
      editer('sudo nano /etc/wireguard/wg0.conf', (t) => t.replace('AllowedIPs = 10.10.99.3/32', 'AllowedIPs = 10.10.99.3/32, 10.20.10.0/24'));
      tout = jouer(['sudo wg-quick up wg0', 'sudo wg-quick down wg0', 'sudo wg-quick up wg0', 'ping -c 1 10.20.10.20']);
      expect(tout).toContain("wg-quick: `wg0' already exists");
      expect(tout).toContain('1 packets transmitted, 0 received, 100% packet loss');
      contient(tout, 'PersistentKeepalive');
      // Tout ouvert : tout La Ruche dans le tunnel côté Annexe, et forward qui laisse tout passer depuis wg0.
      editer('nano annexe-wg0.conf', (t) => t.replace('AllowedIPs = 10.10.10.0/24', 'AllowedIPs = 10.10.0.0/16'));
      tout = jouer(['sudo nft add rule inet filter forward iifname wg0 accept']);
      contient(tout, 'les caméras de La Ruche');
      expect(c.termines).not.toContain('annexe');
      jouer(['sudo systemctl restart nftables']);
      editer('nano annexe-wg0.conf', (t) => t + '\nPersistentKeepalive = 25\n');
      expect(c.termines).toContain('annexe');
    });

    const B = 'dc=laruche,dc=example';
    const ADMIN = `-x -D cn=admin,${B} -w rayon-de-miel`;
    const SAMI = (motDePasse: string, numero = '10004') =>
      `dn: uid=sami,ou=people,${B}\nobjectClass: inetOrgPerson\nobjectClass: posixAccount\nuid: sami\ncn: Sami Lemaire\nsn: Lemaire\ngivenName: Sami\nuidNumber: ${numero}\ngidNumber: 10000\nhomeDirectory: /home/sami\nloginShell: /bin/bash\nuserPassword: ${motDePasse}\n`;
    const GROUPES = `dn: cn=bureaux,ou=groups,${B}\nchangetype: modify\ndelete: memberUid\nmemberUid: camille\n-\nadd: memberUid\nmemberUid: sami\n\ndn: cn=equipe,ou=groups,${B}\nchangetype: modify\ndelete: memberUid\nmemberUid: camille\n`;

    it('chapitre 7 — solution : ldapdelete, un LDIF avec slappasswd, les groupes', () => {
      const { c, jouer, editer } = partie(['vlan', 'dhcp', 'zones', 'vpn', 'dmz', 'annexe']);
      let tout = jouer([
        'cat modele-ines.ldif',
        'ldapsearch -x -LLL "(memberUid=camille)" dn',
        'ldapsearch -x -LLL "(objectClass=posixAccount)" uidNumber',
      ]);
      expect(tout).toContain('dn: cn=bureaux,ou=groups,dc=laruche,dc=example');
      expect(tout).toContain('uidNumber: 10003');
      expect(tout).not.toContain('userPassword: {SSHA}');
      tout = jouer([`ldapdelete ${ADMIN} uid=camille,ou=people,${B}`, 'slappasswd -s choisi-par-sami']);
      const empreinte = tout.match(/\{SSHA\}\S+/)![0];
      expect(empreinte).toHaveLength(38);
      editer('nano sami.ldif', () => SAMI(empreinte));
      editer('nano groupes.ldif', () => GROUPES);
      tout = jouer([
        `ldapadd ${ADMIN} -f sami.ldif`,
        `ldapmodify ${ADMIN} -f groupes.ldif`,
        `ldapwhoami -x -D uid=sami,ou=people,${B} -w choisi-par-sami`,
      ]);
      expect(tout).toContain(`adding new entry "uid=sami,ou=people,${B}"`);
      expect(tout).toContain(`modifying entry "cn=bureaux,ou=groups,${B}"`);
      expect(tout).toContain(`dn:uid=sami,ou=people,${B}`);
      contient(tout, 'https://www.openldap.org/doc/admin26/dbtools.html');
      expect(c.termines).toContain('annuaire');
    });

    it('chapitre 7 — autre solution : en root par ldapi, ldappasswd qui demande le mot de passe', () => {
      const { c, jouer, editer } = partie(['vlan', 'dhcp', 'zones', 'vpn', 'dmz', 'annexe']);
      const EXT = '-Q -Y EXTERNAL -H ldapi:///';
      editer('nano sami.ldif', () => SAMI('provisoire').replace('userPassword: provisoire\n', ''));
      editer('nano groupes.ldif', () => GROUPES);
      let tout = jouer([
        `sudo ldapdelete ${EXT} uid=camille,ou=people,${B}`,
        `sudo ldapadd ${EXT} -f sami.ldif`,
        `sudo ldapmodify ${EXT} -f groupes.ldif`,
      ]);
      expect(c.termines).not.toContain('annuaire');
      tout = jouer([`ldappasswd -x -D cn=admin,${B} -W -S uid=sami,ou=people,${B}`]);
      for (const r of ['nouveau-sami', 'nouveau-sami', 'rayon-de-miel']) tout += c.executer(r) ?? '';
      tout += jouer([`sudo ldapsearch ${EXT} -LLL uid=sami userPassword`]);
      expect(tout).toMatch(/userPassword: \{SSHA\}/);
      expect(c.termines).toContain('annuaire');
    });

    it('chapitre 7 — fausses pistes : anonyme, un attribut manquant, en clair, le même numéro, le groupe oublié, slapd arrêté', () => {
      const { c, jouer, editer } = partie(['vlan', 'dhcp', 'zones', 'vpn', 'dmz', 'annexe']);
      let tout = jouer([`ldapdelete -x uid=camille,ou=people,${B}`, `ldapdelete -x -D cn=admin,${B} -w faux uid=camille,ou=people,${B}`]);
      expect(tout).toContain('ldap_delete: Strong(er) authentication required (8)');
      expect(tout).toContain('ldap_bind: Invalid credentials (49)');
      tout = jouer([`ldapdelete ${ADMIN} uid=camille,ou=people,${B}`]);
      contient(tout, 'pas son nom dans les groupes');
      editer('nano sami.ldif', () => SAMI('en-clair', '10002').replace('sn: Lemaire\n', ''));
      tout = jouer([`ldapadd ${ADMIN} -f sami.ldif`]);
      expect(tout).toContain("ldap_add: Object class violation (65)\n\tadditional info: object class 'inetOrgPerson' requires attribute 'sn'");
      editer('nano sami.ldif', () => SAMI('en-clair', '10002'));
      tout = jouer([`ldapadd ${ADMIN} -f sami.ldif`]);
      contient(tout, 'EN CLAIR');
      contient(tout, 'le même uidNumber');
      contient(tout, 'pas dans le groupe');
      tout = jouer(['sudo systemctl stop slapd', 'ldapsearch -x uid=sami']);
      expect(tout).toContain("ldap_sasl_bind(SIMPLE): Can't contact LDAP server (-1)");
      contient(tout, 'slapd ne tourne plus');
      editer('nano groupes.ldif', () => GROUPES);
      editer('nano numero.ldif', () => `dn: uid=sami,ou=people,${B}\nchangetype: modify\nreplace: uidNumber\nuidNumber: 10004\n`);
      jouer([
        'sudo systemctl start slapd',
        `ldapmodify ${ADMIN} -f groupes.ldif`,
        `ldapmodify ${ADMIN} -f numero.ldif`,
        `ldappasswd ${ADMIN} -s sami-choisit uid=sami,ou=people,${B}`,
      ]);
      expect(c.termines).toContain('annuaire');
    });

    const RAD = '/etc/freeradius/3.0';
    const CLIENT_BORNE = (t: string) => t + '\n\nclient bornes {\n\tipaddr = 10.10.30.0/24\n\tsecret = Rk7-borne-2028\n}\n';
    const MODULE = (t: string) =>
      t
        .replace("base_dn = 'dc=example,dc=org'", "base_dn = 'dc=laruche,dc=example'")
        .replace(
          "#\tidentity = 'cn=admin,dc=example,dc=org'\n#\tpassword = mypass",
          "\tidentity = 'cn=admin,dc=laruche,dc=example'\n\tpassword = rayon-de-miel",
        )
        .replace('#\t\tmembership_filter', '\t\tmembership_filter');
    const VLAN = (id: number) => `\tTunnel-Type = VLAN,\n\tTunnel-Medium-Type = IEEE-802,\n\tTunnel-Private-Group-Id = ${id}\n`;
    const USERS = (t: string) => `${t}\nDEFAULT Ldap-Group == "bureaux"\n${VLAN(10)}\nDEFAULT\n${VLAN(20)}`;
    const ENTREE_RADIUS = (t: string) =>
      t.replace(
        'iifname "eth1*" udp dport { 53, 67 } accept',
        'iifname "eth1*" udp dport { 53, 67 } accept\n\t\t# RADIUS from the Wi-Fi access points\n\t\tiifname "eth1.30" udp dport 1812 accept',
      );

    it('chapitre 8 — solution : le pare-feu, clients.conf, le module ldap, le fichier users', () => {
      const { c, jouer, editer } = partie(['vlan', 'dhcp', 'zones', 'vpn', 'dmz', 'annexe', 'annuaire']);
      let tout = jouer(['cat borne-bureaux.txt', 'radtest sami choisi-par-sami localhost 0 testing123']);
      expect(tout).toContain('Secret partagé         : Rk7-borne-2028');
      expect(tout).toContain('(0) -: Expected Access-Accept got Access-Reject');
      editer('sudo nano /etc/nftables.conf', ENTREE_RADIUS);
      editer(`sudo nano ${RAD}/clients.conf`, CLIENT_BORNE);
      editer(`sudo nano ${RAD}/mods-available/ldap`, MODULE);
      editer(`sudo nano ${RAD}/mods-config/files/authorize`, USERS);
      tout = jouer([
        `sudo ln -s ../mods-available/ldap ${RAD}/mods-enabled/ldap`,
        'sudo freeradius -XC',
        'sudo systemctl reload nftables',
        'sudo systemctl restart freeradius',
      ]);
      expect(tout).toContain('Configuration appears to be OK');
      tout += jouer([
        'radtest sami choisi-par-sami localhost 0 testing123',
        'radtest leo cafe-leo-2028 localhost 0 testing123',
        'journalctl -u freeradius -n 5',
      ]);
      expect(tout).toContain('Received Access-Accept Id 154 from 127.0.0.1:1812');
      expect(tout).toContain('\tTunnel-Private-Group-Id:0 = "10"');
      expect(tout).toContain('\tTunnel-Private-Group-Id:0 = "20"');
      expect(tout).toContain('Login OK: [sami] (from client bornes port 0)');
      expect(tout).toContain('Login incorrect (No Auth-Type found: rejecting the user via Post-Auth-Type = Reject): [camille]');
      contient(tout, 'https://wiki.freeradius.org/modules/Rlm_ldap');
      expect(c.termines).toContain('wifi');
    });

    it('chapitre 8 — fausses pistes : la porte fermée, pas relu, sans ldap, anonyme, memberOf, l’ordre, freeradius -X', () => {
      const { c, jouer, editer } = partie(['vlan', 'dhcp', 'zones', 'vpn', 'dmz', 'annexe', 'annuaire']);
      let tout = jouer(['ls /etc/freeradius/3.0']);
      expect(tout).toContain('Permission non accordée');
      tout = editer(`sudo nano ${RAD}/clients.conf`, (t) => t + '\n\nclient bornes {\n\tipaddr = 10.10.30.20\n\tsecret = mauvais\n}\n');
      contient(tout, 'chaîne input');
      tout = jouer(['sudo nft add rule inet filter input iifname eth1.30 udp dport 1812 accept']);
      contient(tout, 'ne relit ses fichiers');
      tout = jouer(['sudo systemctl restart freeradius', 'journalctl -u freeradius -n 3']);
      expect(tout).toContain('Shared secret is incorrect.');
      contient(tout, 'secret partagé');
      editer(`sudo nano ${RAD}/clients.conf`, (t) => t.replace('secret = mauvais', 'secret = Rk7-borne-2028'));
      tout = jouer(['sudo systemctl restart freeradius']);
      contient(tout, 'mods-enabled');
      tout = jouer([`sudo ln -s ../mods-available/ldap ${RAD}/mods-enabled/ldap`, 'sudo systemctl restart freeradius']);
      contient(tout, 'en anonyme');
      editer(`sudo nano ${RAD}/mods-available/ldap`, (t) => MODULE(t).replace('\t\tmembership_filter', '#\t\tmembership_filter'));
      editer(`sudo nano ${RAD}/mods-config/files/authorize`, (t) => `${t}\nDEFAULT\n${VLAN(20)}\nDEFAULT Ldap-Group == "bureaux"\n${VLAN(10)}`);
      editer(`sudo nano ${RAD}/clients.conf`, (t) => t + '\nclient borne2\n');
      tout = jouer(['sudo freeradius -XC', 'sudo systemctl restart freeradius']);
      expect(tout).toContain(`Expecting section start brace '{' after "client borne2"`);
      expect(tout).toContain('Job for freeradius.service failed');
      editer(`sudo nano ${RAD}/clients.conf`, (t) => t.replace('\nclient borne2', ''));
      tout = jouer(['sudo systemctl restart freeradius']);
      contient(tout, "cherche l'attribut memberOf");
      editer(`sudo nano ${RAD}/mods-available/ldap`, (t) => t.replace('#\t\tmembership_filter', '\t\tmembership_filter'));
      tout = jouer(['sudo freeradius -X', 'sudo systemctl stop freeradius', 'sudo freeradius -X']);
      expect(tout).toContain('Address already in use');
      expect(tout).toContain('(2)   Tunnel-Private-Group-Id = 20');
      contient(tout, 'Ctrl+C');
      expect(c.termines).not.toContain('wifi');
      editer(`sudo nano ${RAD}/mods-config/files/authorize`, (t) => {
        const i = t.indexOf('\nDEFAULT\n');
        return t.slice(0, i) + '\n' + USERS('').trim();
      });
      tout = jouer(['sudo systemctl start freeradius']);
      contient(tout, 'Au prochain démarrage');
      editer('sudo nano /etc/nftables.conf', ENTREE_RADIUS);
      expect(c.termines).toContain('wifi');
    });
  });
