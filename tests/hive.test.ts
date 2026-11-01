// The Hive: the network of a third place (VLAN, DHCP…). Replayed with the
// console, in each language.

import { describe, expect, it } from 'vitest';
import { Console } from '../src/engine/console';
import { STORIES } from '../src/engine/chapters';
import { prerequisites } from '../src/engine/unlocking';
import { LANGUAGES, translator } from '../src/texts';
import { inLanguage, machinesInLanguage } from './names';
import { name, password } from '../src/engine/world';

// L'Effaceur, then the chapters to finish to receive the story's key.
const ERASER = [...new Set([...STORIES.find((h) => h.id === 'eraser')!.chapters.map((c) => c.id), ...prerequisites('hive')])];
const MDP = 'bee-2027';
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

for (const language of LANGUAGES)
  describe(`The Hive — ${language}`, () => {
    const fr = language === 'fr';
    // A line written with the reference names, in the game's language.
    const L = (line: string) => inLanguage(translator(language), line);
    // A name of the world (printer, offices…) and a password of the story, in the game's language.
    const N = (word: string) => name(translator(language), word);
    const P = (id: string) => password(translator(language), id);
    const contains = (all: string, text: string) => fr && expect(all).toContain(text);
    const part = (finished: string[] = []) => {
      const c = new Console({ language, finished: [...ERASER, ...finished] });
      const one = (l: string) => {
        let output = c.execute(L(l)) ?? '';
        if (c.shell.waiting) output += '\n' + (c.execute(machinesInLanguage(c.t, MDP)) ?? '');
        return output;
      };
      const play = (lines: string[]) => lines.map(one).join('\n');
      const edit = (command: string, change: (text: string) => string) => {
        one(command);
        c.save(change(c.edition!.text));
        return c.quitEdition();
      };
      play(['ssh hive', 'yes']);
      return { c, jouer: play, editer: edit };
    };

    it('chapter 1 — solution: /etc/network/interfaces, ifup -a', () => {
      const { c, jouer: play, editer: edit } = part();
      let all = play(['ip -br a', 'ping -c 1 10.10.10.5', 'man interfaces']);
      expect(all).toContain('INTERFACES(5)');
      expect(all).toContain('eth1             UP             192.168.1.1/24');
      expect(all).toContain('1 packets transmitted, 0 received, 100% packet loss');
      edit('sudo nano /etc/network/interfaces', (t) => t + VLANS);
      all = play(['sudo ifup -a', 'ip -br a', 'ping -c 1 nas', 'ip -d link show eth1.30']);
      expect(all).toContain('eth1.20@eth1     UP             10.10.20.1/24');
      expect(all).toContain('64 bytes from 10.10.10.5');
      expect(all).toContain('vlan protocol 802.1Q id 30');
      contains(all, 'https://manpages.debian.org/trixie/vlan/vlan-interfaces.5.en.html');
      expect(c.finished).toContain('vlan');
    });

    it('chapter 1 — other solution: ip first, then the file', () => {
      const { c, jouer: play, editer: edit } = part();
      let all = [10, 20, 30]
        .map((v) =>
          play([
            `sudo ip link add link eth1 name eth1.${v} type vlan id ${v}`,
            `sudo ip addr add 10.10.${v}.1/24 dev eth1.${v}`,
            `sudo ip link set eth1.${v} up`,
          ]),
        )
        .join('\n');
      all += play(['ping -c 1 10.10.30.11']);
      expect(all).toContain('64 bytes from 10.10.30.11');
      contains(all, 'disparaîtra au prochain redémarrage');
      expect(c.finished).not.toContain('vlan');
      // The file, with vlan-raw-device and names of one's own.
      all = edit(
        'sudo nano /etc/network/interfaces',
        (t) =>
          t +
          [10, 20, 30].map((v) => `\nauto vlan${v}\niface vlan${v} inet static\n    vlan-raw-device eth1\n    address 10.10.${v}.1/24\n`).join(''),
      );
      expect(c.finished).toContain('vlan');
    });

    it('chapter 1 — false leads: the wrong number, a mistake in the file, without sudo', () => {
      const { c, jouer: play, editer: edit } = part();
      let all = play(['ip link add link eth1 name eth1.30 type vlan id 30', 'sudo ip link add link eth1 name eth1.30 type vlan id 3']);
      expect(all).toContain('RTNETLINK answers: Operation not permitted');
      all = play(['sudo ip addr add 10.10.30.1/24 dev eth1.30', 'sudo ip link set eth1.30 up', 'ping -c 2 printer']);
      expect(all).toContain('From 10.10.30.1 icmp_seq=1 Destination Host Unreachable');
      contains(all, 'pas le bon numéro de VLAN');
      play(['sudo ip link del eth1.30']);
      edit(
        'sudo nano /etc/network/interfaces',
        (t) => t + VLANS.replace('10.10.20.1\n    netmask 255.255.255.0', '10.10.20.1\n    netmask 255.255.0.255'),
      );
      all = play(['sudo ifup -a']);
      expect(all).toContain('invalid netmask 255.255.0.255');
      expect(c.finished).not.toContain('vlan');
    });

    const HIVE = '/etc/dnsmasq.d/hive';
    const RANGES = 'dhcp-range=10.10.10.100,10.10.10.200,12h\ndhcp-range=10.10.20.100,10.10.20.250,2h\ndhcp-range=10.10.30.100,10.10.30.200,24h\n';
    const RESERVATION = `dhcp-host=00:00:5e:00:53:30,${N('printer')},10.10.30.10\n`;

    it('chapter 2 — solution: one range per VLAN, the reservation, interface=', () => {
      const { c, jouer: play, editer: edit } = part(['vlan']);
      let all = play(['cat /var/lib/misc/dnsmasq.leases', 'journalctl -u dnsmasq']);
      expect(all).toContain('DHCP, IP range 192.168.1.100 -- 192.168.1.200');
      edit(`sudo nano ${HIVE}`, () => 'interface=eth1.10,eth1.20,eth1.30\n' + RANGES + RESERVATION);
      all = play(['sudo dnsmasq --test', 'sudo systemctl restart dnsmasq', 'cat /var/lib/misc/dnsmasq.leases', 'ping -c 1 printer']);
      expect(all).toContain('dnsmasq: syntax check OK.');
      expect(all).toContain(`00:00:5e:00:53:30 10.10.30.10 ${N('printer')}`);
      expect(all).toContain('64 bytes from 10.10.30.10');
      contains(all, 'https://dnsmasq.org/docs/dnsmasq-man.html');
      expect(c.finished).toContain('dhcp');
    });

    it('chapter 2 — other solution: a wildcard, and except-interface', () => {
      const { c, jouer: play, editer: edit } = part(['vlan']);
      edit(`sudo nano ${HIVE}`, () => 'except-interface=eth0\n' + RANGES.replace(/dhcp-range=/g, 'dhcp-range=set:x,') + RESERVATION);
      play(['sudo systemctl restart dnsmasq']);
      expect(c.finished).toContain('dhcp');
    });

    it('chapter 2 — false leads: the old interface, the home router that hears, a mistake, the printer elsewhere', () => {
      const { c, jouer: play, editer: edit } = part(['vlan']);
      edit(`sudo nano ${HIVE}`, (t) => t + '\n' + RANGES);
      let all = play(['sudo systemctl restart dnsmasq', 'cat /var/lib/misc/dnsmasq.leases']);
      // interface=eth1 doesn't listen on eth1.10: nobody gets an address.
      expect(all).not.toContain(N('malik-pc'));
      all = edit(`sudo nano ${HIVE}`, () => RANGES);
      contains(all, 'DHCP pirate');
      all = edit(`sudo nano ${HIVE}`, () => 'interfaces=eth1*\n' + RANGES);
      all += play(['sudo dnsmasq --test', 'sudo systemctl restart dnsmasq']);
      expect(all).toContain(`dnsmasq: bad option at line 1 of ${HIVE}`);
      edit(`sudo nano ${HIVE}`, () => 'interface=eth1*\n' + RANGES);
      all = play(['sudo systemctl restart dnsmasq']);
      contains(all, 'pas 10.10.30.10');
      expect(c.finished).not.toContain('dhcp');
    });

    const NFTABLES = `#!/usr/sbin/nft -f

flush ruleset

define OFFICES = "eth1.10"

table inet filter {
	chain input {
		type filter hook input priority filter; policy accept;
	}
	chain forward {
		type filter hook forward priority filter; policy drop;
		ct state established,related accept
		iifname $OFFICES counter accept
		iifname "eth1.20" oifname "eth0" accept
		log prefix "forward drop: " counter
	}
}

table ip nat {
	chain postrouting {
		type nat hook postrouting priority srcnat;
		oifname "eth0" masquerade
	}
}
`;

    it('chapter 3 — solution: /etc/sysctl.d, /etc/nftables.conf, systemctl enable --now', () => {
      const { c, jouer: play, editer: edit } = part(['vlan', 'dhcp']);
      let all = play([L('cat notes-from-sacha.txt'), 'sysctl net.ipv4.ip_forward', 'sudo conntrack -L', 'man sysctl.d']);
      expect(all).toContain('SYSCTL.D(5)');
      expect(all).toContain('net.ipv4.ip_forward = 0');
      expect(all).toContain('1 flow entries have been shown.');
      edit('sudo nano /etc/sysctl.d/90-router.conf', () => 'net.ipv4.ip_forward = 1\n');
      all = play(['sudo sysctl --system']);
      expect(all).toContain('* Applying /etc/sysctl.d/90-router.conf ...');
      expect(all).toContain('net.ipv4.ip_forward = 1');
      edit('sudo nano /etc/nftables.conf', () => NFTABLES);
      all = play([
        'sudo nft -c -f /etc/nftables.conf',
        'sudo systemctl enable --now nftables',
        'sudo nft list ruleset',
        'sudo conntrack -L',
        'journalctl -k',
      ]);
      expect(all).toContain('iifname "eth1.10" counter packets 3 bytes 180 accept');
      // The source port follows the device's name, which is the language's (malik-pc, poste-malik).
      expect(all).toContain(`dst=198.51.100.80 sport=${fr ? 51735 : 59041} dport=443 src=198.51.100.80 dst=192.0.2.21`);
      expect(all).toContain('forward drop: IN=eth1.20 OUT=eth1.10');
      expect(all).not.toContain('dst=203.0.113.50');
      contains(all, 'https://wiki.nftables.org/wiki-nftables/index.php/Performing_Network_Address_Translation_(NAT)');
      expect(c.finished).toContain('zones');
      // After a reboot, everything comes back on its own.
      all = play(['sudo reboot', 'ssh hive', 'sysctl net.ipv4.ip_forward', 'sudo conntrack -L -s 10.10.20.197']);
      expect(all).toContain('net.ipv4.ip_forward = 1');
      expect(all).toContain(`dst=198.51.100.80 sport=${fr ? 47099 : 55828} dport=443 src=198.51.100.80 dst=192.0.2.21`);
      expect(all).not.toContain('dport=445');
    });

    it('chapter 3 — other solution: by hand first, the reboot, then the files (addresses and sets)', () => {
      const { c, jouer: play, editer: edit } = part(['vlan', 'dhcp']);
      let all = play([
        'echo 1 | sudo tee /proc/sys/net/ipv4/ip_forward',
        'sudo nft add table ip nat',
        "sudo nft 'add chain ip nat postrouting { type nat hook postrouting priority srcnat; }'",
        'sudo nft add rule ip nat postrouting oifname "eth0" masquerade',
        "sudo nft 'add chain inet filter forward { type filter hook forward priority 0; policy drop; }'",
      ]);
      contains(all, 'y compris là où il ne faut pas');
      expect(all).toContain('Error: Could not process rule: No such file or directory');
      all = play([
        'sudo nft add table inet filter',
        "sudo nft 'add chain inet filter forward { type filter hook forward priority 0; policy drop; }'",
        'sudo nft add rule inet filter forward ip saddr 10.10.10.0/24 accept',
        'sudo nft add rule inet filter forward ip saddr 10.10.20.0/24 ip daddr != 10.0.0.0/8 accept',
      ]);
      contains(all, 'pas les réponses');
      all = play([
        'sudo nft -a list chain inet filter forward',
        'sudo nft insert rule inet filter forward ct state { established, related } accept',
      ]);
      expect(all).toContain('ip saddr 10.10.20.0/24 ip daddr != 10.0.0.0/8 accept # handle 3');
      contains(all, 'si le routeur');
      expect(c.finished).not.toContain('zones');
      all = play(['sudo reboot', 'ssh hive', 'cat /proc/sys/net/ipv4/ip_forward', 'sudo nft list ruleset']);
      expect(all).toContain(`cat ${L('email_malik.txt')}\n0\n`);
      expect(all).not.toContain('masquerade');
      edit('sudo nano /etc/sysctl.conf', (t) => t.replace('#net.ipv4.ip_forward=1', 'net.ipv4.ip_forward=1'));
      edit('sudo nano /etc/nftables.conf', () =>
        NFTABLES.replace('iifname $OFFICES counter accept', 'ip saddr 10.10.10.0/24 accept').replace(
          'iifname "eth1.20" oifname "eth0" accept',
          'iifname { "eth1.20" } ip daddr != { 10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16 } tcp dport { http, https } accept',
        ),
      );
      play(['sudo sysctl -p', 'sudo systemctl enable nftables', 'sudo systemctl start nftables']);
      expect(c.finished).toContain('zones');
    });

    it('chapter 3 — false leads: without sudo, a mistake, ssh closed, the camera going out', () => {
      const { c, jouer: play, editer: edit } = part(['vlan', 'dhcp']);
      let all = play([
        'nft list ruleset',
        'sysctl -w net.ipv4.ip_forward=1',
        'sysctl net.ipv4.ip_forwrd',
        'echo 1 > /proc/sys/net/ipv4/ip_forward',
      ]);
      expect(all).toContain('netlink: Error: cache initialization failed: Operation not permitted');
      expect(all).toContain('sysctl: permission denied on key "net.ipv4.ip_forward"');
      expect(all).toContain('sysctl: cannot stat /proc/sys/net/ipv4/ip_forwrd: No such file or directory');
      edit('sudo nano /etc/nftables.conf', () => NFTABLES.replace('oifname "eth0" accept', 'oifnam "eth0" accept'));
      all = play(['sudo nft -c -f /etc/nftables.conf', 'sudo systemctl start nftables']);
      expect(all).toContain('/etc/nftables.conf:15:21-26: Error: syntax error, unexpected string');
      expect(all).toContain('Job for nftables.service failed');
      // Input closed: no more new ssh connection.
      edit('sudo nano /etc/nftables.conf', () => NFTABLES.replace('priority filter; policy accept;', 'priority filter; policy drop;'));
      all = play(['sudo sysctl -w net.ipv4.ip_forward=1', 'sudo nft -f /etc/nftables.conf']);
      contains(all, 'ne tient qu');
      expect(c.finished).not.toContain('zones');
      // NAT for everyone, without filtering: the camera goes out.
      edit('sudo nano /etc/nftables.conf', () => NFTABLES.replace('policy drop;\n\t\tct state', 'policy accept;\n\t\tct state'));
      all = play(['sudo nft -f /etc/nftables.conf', 'sudo conntrack -L -d 203.0.113.50']);
      expect(all).toContain('src=10.10.30.11 dst=203.0.113.50');
      expect(c.finished).not.toContain('zones');
    });

    const PEER_MALIK = (key: string) => `\n[Peer]\nPublicKey = ${key}\nAllowedIPs = 10.10.99.2/32\n`;
    const WG0 = (key: string) => `[Interface]\nAddress = 10.10.99.1/24\nListenPort = 51820\nPrivateKey = ${key}\n`;
    const keysFor = (c: Console) => ({
      malik: c.shell.read(L('/home/you/email_malik.txt'))!.match(/[A-Za-z0-9+/]{43}=/)![0],
      privee: () => c.shell.read(L('/home/you/privatekey'))!.trim(),
      isPublic: () => c.shell.read(L('/home/you/publickey'))!.trim(),
    });
    const LAPTOP =
      (pub: string, endpoint = 'hive.example:51820') =>
      (t: string) =>
        t
          .replace('PublicKey =', `PublicKey = ${pub}`)
          .replace('Endpoint =', `Endpoint = ${endpoint}`)
          .replace('AllowedIPs =', 'AllowedIPs = 10.10.10.0/24');
    const FIREWALL = (t: string) =>
      t
        .replace('icmp type echo-request accept', 'icmp type echo-request accept\n\t\tudp dport 51820 accept')
        .replace('iifname "eth1.20" oifname "eth0" accept', 'iifname "eth1.20" oifname "eth0" accept\n\t\tiifname "wg0" oifname "eth1.10" accept');

    it('chapter 4 — solution: umask 077, wg0.conf, the laptop, the firewall, wg-quick@wg0', () => {
      const { c, jouer: play, editer: edit } = part(['vlan', 'dhcp', 'zones']);
      const k = keysFor(c);
      let all = play(['cat malik-laptop.conf', 'umask 077', 'wg genkey | tee privatekey | wg pubkey > publickey', 'ls -l']);
      const me = L('you');
      expect(all).toContain(`-rw------- ${me.padEnd(8)} ${me.padEnd(8)} ${'44'.padStart(6)} privatekey`);
      edit('sudo nano /etc/wireguard/wg0.conf', () => WG0(k.privee()) + PEER_MALIK(k.malik));
      edit('nano malik-laptop.conf', LAPTOP(k.isPublic()));
      edit('sudo nano /etc/nftables.conf', FIREWALL);
      all = play([
        'sudo nft -c -f /etc/nftables.conf',
        'sudo systemctl reload nftables',
        'sudo systemctl enable --now wg-quick@wg0',
        'sudo wg show',
        'ping -c 1 10.10.99.2',
      ]);
      expect(all).toContain('latest handshake: 7 seconds ago');
      expect(all).toContain('endpoint: 198.51.100.23:41414');
      expect(all).toContain('64 bytes from 10.10.99.2');
      all += play(['ip -br a']);
      expect(all).toContain('wg0              UNKNOWN        10.10.99.1/24');
      contains(all, 'https://www.wireguard.com/quickstart/');
      expect(c.finished).toContain('remote-work');
    });

    it('chapter 4 — false leads: the readable key, the closed door, the crossed keys, wg-quick then the service', () => {
      const { c, jouer: play, editer: edit } = part(['vlan', 'dhcp', 'zones']);
      const k = keysFor(c);
      let all = play(['wg genkey > privatekey', 'wg pubkey < privatekey', 'sudo wg show', 'wg show']);
      expect(all).toContain('Warning: writing to world accessible file.');
      expect(all).toContain('Unable to access interface: Operation not permitted');
      play(['cat privatekey | wg pubkey > publickey']);
      all = edit('sudo nano /etc/wireguard/wg0.conf', () => WG0(k.privee()) + PEER_MALIK(k.malik));
      contains(all, 'comptes de la machine peuvent le lire');
      // Crossed keys: the router's PRIVATE key given to the laptop.
      edit('nano malik-laptop.conf', LAPTOP(k.privee()));
      all = play(['sudo wg-quick up wg0']);
      expect(all).toContain('[#] ip link set mtu 1420 up dev wg0');
      // Door closed first: the input chain drops the UDP.
      contains(all, 'la chaîne input les jette');
      play(['sudo nft add rule inet filter input udp dport 51820 accept']);
      all = play(['sudo wg show wg0']);
      expect(all).not.toContain('latest handshake');
      edit(
        'nano malik-laptop.conf',
        () =>
          '[Interface]\nAddress = 10.10.99.2/32\n\n[Peer]\n' +
          `PublicKey = ${k.isPublic()}\nEndpoint = 192.0.2.21:51820\nAllowedIPs = 10.10.10.5/32\n`,
      );
      all = play(['sudo wg show wg0', 'sudo systemctl enable wg-quick@wg0', 'sudo systemctl start wg-quick@wg0', 'journalctl -u wg-quick@wg0']);
      expect(all).toContain('latest handshake');
      expect(all).toContain("wg-quick: `wg0' already exists");
      play(['sudo nft add rule inet filter forward iifname wg0 accept', 'chmod 600 privatekey']);
      // Everything works… until the reboot: the firewall is not in the file.
      expect(c.finished).not.toContain('remote-work');
      all = play(['sudo wg-quick down wg0', 'sudo systemctl start wg-quick@wg0', 'sudo reboot', 'ssh hive', 'sudo wg show wg0']);
      expect(all).toContain('[#] ip link delete dev wg0');
      // wg0 is back (the service), but not the rule typed by hand: no more handshake.
      expect(all).toContain('peer: ');
      expect(all).not.toContain('latest handshake');
      edit('sudo nano /etc/nftables.conf', FIREWALL);
      play(['sudo systemctl restart nftables']);
      expect(c.finished).toContain('remote-work');
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

    it('chapter 5 — solution: eth1.40, dnat in prerouting, forward to the DMZ only', () => {
      const { c, jouer: play, editer: edit } = part(['vlan', 'dhcp', 'zones', 'remote-work']);
      let all = play([L('cat switch-plan.txt'), 'ping -c 1 web']);
      // Without an interface in this network, the ping goes to the home router and gets lost there.
      expect(all).toContain('1 packets transmitted, 0 received, 100% packet loss');
      edit('sudo nano /etc/network/interfaces', (t) => t + ETH140);
      edit('sudo nano /etc/nftables.conf', DMZ);
      all = play(['sudo ifup eth1.40', 'sudo nft -c -f /etc/nftables.conf', 'sudo systemctl reload nftables', 'sudo conntrack -L -s 203.0.113.77']);
      expect(all).toContain('src=203.0.113.77 dst=192.0.2.21 sport=42637 dport=443 src=10.10.40.10 dst=203.0.113.77 sport=443');
      expect(all).not.toContain('dport=22');
      contains(all, 'Netfilter_hooks');
      all = play(['sudo conntrack -L -s 10.10.40.10']);
      expect(all).toContain('src=10.10.40.10 dst=198.51.100.80');
      expect(all).not.toContain('dst=10.10.10.5');
      expect(c.finished).toContain('dmz');
    });

    it('chapter 5 — false leads: without forward, the public address, publishing everything, the open DMZ, by hand', () => {
      const { c, jouer: play, editer: edit } = part(['vlan', 'dhcp', 'zones', 'remote-work']);
      let all = play([
        'sudo ip link add link eth1 name eth1.40 type vlan id 40',
        'sudo ip addr add 10.10.40.1/24 dev eth1.40',
        'sudo ip link set eth1.40 up',
        "sudo nft 'add chain ip nat prerouting { type nat hook prerouting priority dstnat; }'",
        'sudo nft add rule ip nat prerouting iifname eth0 dnat to 10.10.40.10',
      ]);
      contains(all, 'fermée par défaut');
      all = play(['sudo nft add rule inet filter forward ip daddr 192.0.2.21 accept']);
      contains(all, 'ne la verra jamais');
      // Publishing everything, and the DMZ that sees everything: too open.
      all = play([
        'sudo nft add rule inet filter forward iifname eth0 oifname eth1.40 accept',
        'sudo nft add rule inet filter forward iifname eth1.40 accept',
      ]);
      contains(all, 'la DMZ est trop ouverte');
      expect(c.finished).not.toContain('dmz');
      // Fixed by hand: works, but doesn't last.
      all = play([
        'sudo nft flush chain ip nat prerouting',
        'sudo nft add rule ip nat prerouting iifname eth0 tcp dport { 80, 443 } dnat to 10.10.40.10',
        'sudo nft -a list chain inet filter forward',
      ]);
      const handshake = (rule: string) => all.match(new RegExp(`${rule} # handle (\\d+)`))![1];
      all = play([
        `sudo nft delete rule inet filter forward handle ${handshake('ip daddr 192.0.2.21 accept')}`,
        `sudo nft delete rule inet filter forward handle ${handshake('iifname "eth1.40" accept')}`,
        `sudo nft delete rule inet filter forward handle ${handshake('iifname "eth0" oifname "eth1.40" accept')}`,
        'sudo nft add rule inet filter forward iifname eth0 oifname eth1.40 tcp dport { 80, 443 } accept',
        'sudo nft add rule inet filter forward iifname eth1.40 oifname eth0 accept',
      ]);
      contains(all, 'au prochain redémarrage');
      expect(c.finished).not.toContain('dmz');
      edit('sudo nano /etc/network/interfaces', (t) => t + ETH140);
      edit('sudo nano /etc/nftables.conf', DMZ);
      expect(c.finished).toContain('dmz');
    });

    const annexKey = (c: Console) => c.shell.read(L('/home/you/email_sami.txt'))!.match(/[A-Za-z0-9+/]{43}=/)![0];
    const ANNEX_PEER =
      (key: string, allowed = '10.10.99.3/32, 10.20.10.0/24') =>
      (t: string) =>
        t + `\n\n# Annex\n[Peer]\nPublicKey = ${key}\nAllowedIPs = ${allowed}\n`;
    const ANNEX_CONF =
      (pub: string, allowed = '10.10.10.0/24', keepalive = true) =>
      (t: string) =>
        t
          .replace('PublicKey =', `PublicKey = ${pub}`)
          .replace('Endpoint =', 'Endpoint = hive.example:51820')
          .replace('AllowedIPs =', `AllowedIPs = ${allowed}${keepalive ? '\nPersistentKeepalive = 25' : ''}`);

    it('chapter 6 — solution: one peer for the site, its AllowedIPs, PersistentKeepalive', () => {
      const { c, jouer: play, editer: edit } = part(['vlan', 'dhcp', 'zones', 'remote-work', 'dmz']);
      let all = play(['sudo wg show']);
      const pub = all.match(/public key: (\S+)/)![1];
      edit('sudo nano /etc/wireguard/wg0.conf', ANNEX_PEER(annexKey(c)));
      edit('nano annex-wg0.conf', ANNEX_CONF(pub));
      all = play(['sudo systemctl restart wg-quick@wg0', 'ip route', 'sudo wg show', 'ping -c 1 10.20.10.20']);
      expect(all).toContain('10.20.10.0/24 dev wg0 scope link');
      expect(all).toContain('allowed ips: 10.10.99.3/32, 10.20.10.0/24');
      expect(all).toContain('64 bytes from 10.20.10.20');
      contains(all, 'https://www.wireguard.com/#cryptokey-routing');
      expect(c.finished).toContain('annex');
    });

    it('chapter 6 — false leads: not reloaded, the address alone, the Annex falling asleep, all open', () => {
      const { c, jouer: play, editer: edit } = part(['vlan', 'dhcp', 'zones', 'remote-work', 'dmz']);
      const pub = play(['sudo wg show']).match(/public key: (\S+)/)![1];
      let all = edit('sudo nano /etc/wireguard/wg0.conf', ANNEX_PEER(annexKey(c), '10.10.99.3/32'));
      contains(all, 'ne relit pas le fichier');
      edit('nano annex-wg0.conf', ANNEX_CONF(pub, '10.10.10.0/24', false));
      all = play(['sudo systemctl restart wg-quick@wg0']);
      contains(all, 'tout son réseau');
      edit('sudo nano /etc/wireguard/wg0.conf', (t) => t.replace('AllowedIPs = 10.10.99.3/32', 'AllowedIPs = 10.10.99.3/32, 10.20.10.0/24'));
      all = play(['sudo wg-quick up wg0', 'sudo wg-quick down wg0', 'sudo wg-quick up wg0', 'ping -c 1 10.20.10.20']);
      expect(all).toContain("wg-quick: `wg0' already exists");
      expect(all).toContain('1 packets transmitted, 0 received, 100% packet loss');
      contains(all, 'PersistentKeepalive');
      // All open: all of The Hive in the tunnel on the Annex side, and forward letting everything through from wg0.
      edit('nano annex-wg0.conf', (t) => t.replace('AllowedIPs = 10.10.10.0/24', 'AllowedIPs = 10.10.0.0/16'));
      all = play(['sudo nft add rule inet filter forward iifname wg0 accept']);
      contains(all, 'les caméras de La Ruche');
      expect(c.finished).not.toContain('annex');
      play(['sudo systemctl restart nftables']);
      edit('nano annex-wg0.conf', (t) => t + '\nPersistentKeepalive = 25\n');
      expect(c.finished).toContain('annex');
    });

    const B = 'dc=thehive,dc=example';
    const ADMIN = `-x -D cn=admin,${B} -w honeycomb`;
    const SAMI = (password: string, number = '10004') =>
      `dn: uid=sami,ou=people,${B}\nobjectClass: inetOrgPerson\nobjectClass: posixAccount\nuid: sami\ncn: Sami Lemaire\nsn: Lemaire\ngivenName: Sami\nuidNumber: ${number}\ngidNumber: 10000\nhomeDirectory: /home/sami\nloginShell: /bin/bash\nuserPassword: ${password}\n`;
    const GROUPS = `dn: cn=${N('offices')},ou=groups,${B}\nchangetype: modify\ndelete: memberUid\nmemberUid: camille\n-\nadd: memberUid\nmemberUid: sami\n\ndn: cn=${N('team')},ou=groups,${B}\nchangetype: modify\ndelete: memberUid\nmemberUid: camille\n`;

    it('chapter 7 — solution: ldapdelete, an LDIF with slappasswd, the groups', () => {
      const { c, jouer: play, editer: edit } = part(['vlan', 'dhcp', 'zones', 'remote-work', 'dmz', 'annex']);
      let all = play([
        'cat ines-template.ldif',
        'ldapsearch -x -LLL "(memberUid=camille)" dn',
        'ldapsearch -x -LLL "(objectClass=posixAccount)" uidNumber',
      ]);
      expect(all).toContain(`dn: cn=${N('offices')},ou=groups,dc=thehive,dc=example`);
      expect(all).toContain('uidNumber: 10003');
      expect(all).not.toContain('userPassword: {SSHA}');
      all = play([`ldapdelete ${ADMIN} uid=camille,ou=people,${B}`, 'slappasswd -s chosen-by-sami']);
      const fingerprint = all.match(/\{SSHA\}\S+/)![0];
      expect(fingerprint).toHaveLength(38);
      edit('nano sami.ldif', () => SAMI(fingerprint));
      edit('nano groups.ldif', () => GROUPS);
      all = play([
        `ldapadd ${ADMIN} -f sami.ldif`,
        `ldapmodify ${ADMIN} -f groups.ldif`,
        `ldapwhoami -x -D uid=sami,ou=people,${B} -w chosen-by-sami`,
      ]);
      expect(all).toContain(`adding new entry "uid=sami,ou=people,${B}"`);
      expect(all).toContain(`modifying entry "cn=${N('offices')},ou=groups,${B}"`);
      expect(all).toContain(`dn:uid=sami,ou=people,${B}`);
      contains(all, 'https://www.openldap.org/doc/admin26/dbtools.html');
      expect(c.finished).toContain('directory');
    });

    it('chapter 7 — other solution: as root through ldapi, ldappasswd asking for the password', () => {
      const { c, jouer: play, editer: edit } = part(['vlan', 'dhcp', 'zones', 'remote-work', 'dmz', 'annex']);
      const EXT = '-Q -Y EXTERNAL -H ldapi:///';
      edit('nano sami.ldif', () => SAMI('temporary').replace('userPassword: temporary\n', ''));
      edit('nano groups.ldif', () => GROUPS);
      let all = play([
        `sudo ldapdelete ${EXT} uid=camille,ou=people,${B}`,
        `sudo ldapadd ${EXT} -f sami.ldif`,
        `sudo ldapmodify ${EXT} -f groups.ldif`,
      ]);
      expect(c.finished).not.toContain('directory');
      all = play([`ldappasswd -x -D cn=admin,${B} -W -S uid=sami,ou=people,${B}`]);
      for (const r of ['new-sami', 'new-sami', P('honeycomb')]) all += c.execute(r) ?? '';
      all += play([`sudo ldapsearch ${EXT} -LLL uid=sami userPassword`]);
      expect(all).toMatch(/userPassword: \{SSHA\}/);
      expect(c.finished).toContain('directory');
    });

    it('chapter 7 — false leads: anonymous, a missing attribute, in clear text, the same number, the forgotten group, slapd stopped', () => {
      const { c, jouer: play, editer: edit } = part(['vlan', 'dhcp', 'zones', 'remote-work', 'dmz', 'annex']);
      let all = play([`ldapdelete -x uid=camille,ou=people,${B}`, `ldapdelete -x -D cn=admin,${B} -w wrong uid=camille,ou=people,${B}`]);
      expect(all).toContain('ldap_delete: Strong(er) authentication required (8)');
      expect(all).toContain('ldap_bind: Invalid credentials (49)');
      all = play([`ldapdelete ${ADMIN} uid=camille,ou=people,${B}`]);
      contains(all, 'pas son nom dans les groupes');
      edit('nano sami.ldif', () => SAMI('in-clear', '10002').replace('sn: Lemaire\n', ''));
      all = play([`ldapadd ${ADMIN} -f sami.ldif`]);
      expect(all).toContain("ldap_add: Object class violation (65)\n\tadditional info: object class 'inetOrgPerson' requires attribute 'sn'");
      edit('nano sami.ldif', () => SAMI('in-clear', '10002'));
      all = play([`ldapadd ${ADMIN} -f sami.ldif`]);
      contains(all, 'EN CLAIR');
      contains(all, 'le même uidNumber');
      contains(all, 'pas dans le groupe');
      all = play(['sudo systemctl stop slapd', 'ldapsearch -x uid=sami']);
      expect(all).toContain("ldap_sasl_bind(SIMPLE): Can't contact LDAP server (-1)");
      contains(all, 'slapd ne tourne plus');
      edit('nano groups.ldif', () => GROUPS);
      edit('nano number.ldif', () => `dn: uid=sami,ou=people,${B}\nchangetype: modify\nreplace: uidNumber\nuidNumber: 10004\n`);
      play([
        'sudo systemctl start slapd',
        `ldapmodify ${ADMIN} -f groups.ldif`,
        `ldapmodify ${ADMIN} -f number.ldif`,
        `ldappasswd ${ADMIN} -s sami-chooses uid=sami,ou=people,${B}`,
      ]);
      expect(c.finished).toContain('directory');
    });

    const RAD = '/etc/freeradius/3.0';
    const BOUND_CLIENT = (t: string) => t + `\n\nclient aps {\n\tipaddr = 10.10.30.0/24\n\tsecret = ${P('Rk7-ap-2028')}\n}\n`;
    const MODULE = (t: string) =>
      t
        .replace("base_dn = 'dc=example,dc=org'", "base_dn = 'dc=thehive,dc=example'")
        .replace(
          "#\tidentity = 'cn=admin,dc=example,dc=org'\n#\tpassword = mypass",
          `\tidentity = 'cn=admin,dc=thehive,dc=example'\n\tpassword = ${P('honeycomb')}`,
        )
        .replace('#\t\tmembership_filter', '\t\tmembership_filter');
    const VLAN = (id: number) => `\tTunnel-Type = VLAN,\n\tTunnel-Medium-Type = IEEE-802,\n\tTunnel-Private-Group-Id = ${id}\n`;
    const USERS = (t: string) => `${t}\nDEFAULT Ldap-Group == "${N('offices')}"\n${VLAN(10)}\nDEFAULT\n${VLAN(20)}`;
    const RADIUS_INPUT = (t: string) =>
      t.replace(
        'iifname "eth1*" udp dport { 53, 67 } accept',
        'iifname "eth1*" udp dport { 53, 67 } accept\n\t\t# RADIUS from the Wi-Fi access points\n\t\tiifname "eth1.30" udp dport 1812 accept',
      );

    it('chapter 8 — solution: the firewall, clients.conf, the ldap module, the users file', () => {
      const { c, jouer: play, editer: edit } = part(['vlan', 'dhcp', 'zones', 'remote-work', 'dmz', 'annex', 'directory']);
      let all = play([L('cat ap-offices.txt'), 'radtest sami chosen-by-sami localhost 0 testing123']);
      if (fr) expect(all).toContain('Secret partagé         : Rk7-borne-2028');
      expect(all).toContain('(0) -: Expected Access-Accept got Access-Reject');
      edit('sudo nano /etc/nftables.conf', RADIUS_INPUT);
      edit(`sudo nano ${RAD}/clients.conf`, BOUND_CLIENT);
      edit(`sudo nano ${RAD}/mods-available/ldap`, MODULE);
      edit(`sudo nano ${RAD}/mods-config/files/authorize`, USERS);
      all = play([
        `sudo ln -s ../mods-available/ldap ${RAD}/mods-enabled/ldap`,
        'sudo freeradius -XC',
        'sudo systemctl reload nftables',
        'sudo systemctl restart freeradius',
      ]);
      expect(all).toContain('Configuration appears to be OK');
      all += play([
        'radtest sami chosen-by-sami localhost 0 testing123',
        'radtest leo cafe-leo-2028 localhost 0 testing123',
        'journalctl -u freeradius -n 5',
      ]);
      expect(all).toContain('Received Access-Accept Id 154 from 127.0.0.1:1812');
      expect(all).toContain('\tTunnel-Private-Group-Id:0 = "10"');
      expect(all).toContain('\tTunnel-Private-Group-Id:0 = "20"');
      expect(all).toContain('Login OK: [sami] (from client aps port 0)');
      expect(all).toContain('Login incorrect (No Auth-Type found: rejecting the user via Post-Auth-Type = Reject): [camille]');
      contains(all, 'https://wiki.freeradius.org/modules/Rlm_ldap');
      expect(c.finished).toContain('wifi');
    });

    it('chapter 8 — false leads: the closed door, not reloaded, without ldap, anonymous, memberOf, the order, freeradius -X', () => {
      const { c, jouer: play, editer: edit } = part(['vlan', 'dhcp', 'zones', 'remote-work', 'dmz', 'annex', 'directory']);
      let all = play(['ls /etc/freeradius/3.0']);
      if (fr) expect(all).toContain('Permission non accordée');
      all = edit(`sudo nano ${RAD}/clients.conf`, (t) => t + '\n\nclient aps {\n\tipaddr = 10.10.30.20\n\tsecret = wrong\n}\n');
      contains(all, 'chaîne input');
      all = play(['sudo nft add rule inet filter input iifname eth1.30 udp dport 1812 accept']);
      contains(all, 'ne relit ses fichiers');
      all = play(['sudo systemctl restart freeradius', 'journalctl -u freeradius -n 3']);
      expect(all).toContain('Shared secret is incorrect.');
      contains(all, 'secret partagé');
      edit(`sudo nano ${RAD}/clients.conf`, (t) => t.replace('secret = wrong', `secret = ${P('Rk7-ap-2028')}`));
      all = play(['sudo systemctl restart freeradius']);
      contains(all, 'mods-enabled');
      all = play([`sudo ln -s ../mods-available/ldap ${RAD}/mods-enabled/ldap`, 'sudo systemctl restart freeradius']);
      contains(all, 'en anonyme');
      edit(`sudo nano ${RAD}/mods-available/ldap`, (t) => MODULE(t).replace('\t\tmembership_filter', '#\t\tmembership_filter'));
      edit(`sudo nano ${RAD}/mods-config/files/authorize`, (t) => `${t}\nDEFAULT\n${VLAN(20)}\nDEFAULT Ldap-Group == "${N('offices')}"\n${VLAN(10)}`);
      edit(`sudo nano ${RAD}/clients.conf`, (t) => t + '\nclient ap2\n');
      all = play(['sudo freeradius -XC', 'sudo systemctl restart freeradius']);
      expect(all).toContain(`Expecting section start brace '{' after "client ap2"`);
      expect(all).toContain('Job for freeradius.service failed');
      edit(`sudo nano ${RAD}/clients.conf`, (t) => t.replace('\nclient ap2', ''));
      all = play(['sudo systemctl restart freeradius']);
      contains(all, "cherche l'attribut memberOf");
      edit(`sudo nano ${RAD}/mods-available/ldap`, (t) => t.replace('#\t\tmembership_filter', '\t\tmembership_filter'));
      all = play(['sudo freeradius -X', 'sudo systemctl stop freeradius', 'sudo freeradius -X']);
      expect(all).toContain('Address already in use');
      expect(all).toContain('(2)   Tunnel-Private-Group-Id = 20');
      contains(all, 'Ctrl+C');
      expect(c.finished).not.toContain('wifi');
      edit(`sudo nano ${RAD}/mods-config/files/authorize`, (t) => {
        const i = t.indexOf('\nDEFAULT\n');
        return t.slice(0, i) + '\n' + USERS('').trim();
      });
      all = play(['sudo systemctl start freeradius']);
      contains(all, 'Au prochain démarrage');
      edit('sudo nano /etc/nftables.conf', RADIUS_INPUT);
      expect(c.finished).toContain('wifi');
    });
  });
