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
      let tout = jouer(['ip -br a', 'ping -c 1 10.10.10.5']);
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
  });
