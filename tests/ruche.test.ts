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
      contient(tout, 'au prochain\nredémarrage'.replace('\n', ' '));
      expect(c.termines).not.toContain('dmz');
      editer('sudo nano /etc/network/interfaces', (t) => t + ETH140);
      editer('sudo nano /etc/nftables.conf', DMZ);
      expect(c.termines).toContain('dmz');
    });
  });
