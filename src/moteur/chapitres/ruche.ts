// Histoire « La Ruche » : un tiers-lieu (des bureaux d'associations, un café
// avec un wifi pour les invité·es, une imprimante et des caméras). Son
// routeur est une Debian (machine ruche) : eth0 vers le fournisseur d'accès,
// eth1 vers le commutateur. L'électricien vient de découper le réseau en
// VLAN sur le commutateur (port 1 : trunk 802.1Q vers le routeur) ; le
// routeur, lui, n'a pas suivi. Ce que les chapitres ont en commun.

import { d, f, fichiersComptes, type Comptes, type Dossier, type Noeud } from '../monde';
import type { Jeu } from '../shell';
import { creer, demarrerReseau, type Appareil, type Lan } from '../lan';
import { demarrerDnsmasq, lireDnsmasq } from '../dnsmasq';
import { nouveauSystemd, type DefinitionService } from '../systemd';

export const M = '/home/vous';
export const MOT_DE_PASSE = 'abeille-2027';
// Lundi 8 novembre 2027, 8 h 15.
export const MAINTENANT = Date.UTC(2027, 10, 8, 8, 15, 0);

// Le plan des VLAN (celui de l'électricien) : numéro, nom, réseau, adresse du routeur.
export const VLANS = [
  { id: 10, nom: 'bureaux', reseau: '10.10.10.0/24', routeur: '10.10.10.1/24' },
  { id: 20, nom: 'invites', reseau: '10.10.20.0/24', routeur: '10.10.20.1/24' },
  { id: 30, nom: 'equipements', reseau: '10.10.30.0/24', routeur: '10.10.30.1/24' },
];

// Les appareils branchés au commutateur (adresses MAC de documentation, RFC 7042).
export const appareils = (imprimanteEnDhcp: boolean): Appareil[] => [
  { nom: 'nas', mac: '00:00:5e:00:53:05', vlan: 10, fixe: '10.10.10.5' },
  { nom: 'poste-malik', mac: '00:00:5e:00:53:10', vlan: 10 },
  { nom: 'poste-accueil', mac: '00:00:5e:00:53:11', vlan: 10 },
  { nom: 'telephone-visiteur', mac: '00:00:5e:00:53:20', vlan: 20 },
  imprimanteEnDhcp
    ? { nom: 'imprimante', mac: '00:00:5e:00:53:30', vlan: 30 }
    : { nom: 'imprimante', mac: '00:00:5e:00:53:30', vlan: 30, fixe: '10.10.30.10' },
  { nom: 'camera-entree', mac: '00:00:5e:00:53:31', vlan: 30, fixe: '10.10.30.11' },
];

export const comptesRuche = (): Comptes => ({
  utilisateurs: { root: { uid: 0, groupe: 'root', maison: '/root' }, vous: { uid: 1000, groupe: 'vous' } },
  groupes: {
    root: { gid: 0, membres: [] },
    adm: { gid: 4, membres: ['vous'] },
    sudo: { gid: 27, membres: ['vous'] },
    vous: { gid: 1000, membres: [] },
  },
});

// /etc/network/interfaces de Debian ; le LAN est encore un seul réseau à plat.
export const INTERFACES_A_PLAT = `# This file describes the network interfaces available on your system
# and how to activate them. For more information, see interfaces(5).

source /etc/network/interfaces.d/*

# The loopback network interface
auto lo
iface lo inet loopback

# WAN: the ISP link
auto eth0
iface eth0 inet static
    address 192.0.2.21/24
    gateway 192.0.2.1

# LAN: one flat network for everyone
auto eth1
iface eth1 inet static
    address 192.168.1.1/24`;

/** Le même fichier, avec les trois VLAN (la solution du chapitre « Les VLAN »). */
export const INTERFACES_VLAN = `${INTERFACES_A_PLAT.replace('# LAN: one flat network for everyone\nauto eth1\niface eth1 inet static\n    address 192.168.1.1/24', '# LAN: the trunk to the switch (VLANs 10, 20, 30)\nauto eth1\niface eth1 inet manual')}
${VLANS.map((v) => `\n# VLAN ${v.id}: ${v.nom}\nauto eth1.${v.id}\niface eth1.${v.id} inet static\n    address ${v.routeur}`).join('\n')}`;

/** L'état du réseau local de départ (reconstruit depuis /etc/network/interfaces au démarrage). */
export function nouveauLan(imprimanteEnDhcp: boolean): Lan {
  const l: Lan = {
    interfaces: {},
    passerelle: null,
    trunk: 'eth1',
    vlans: VLANS.map((v) => v.id),
    appareils: appareils(imprimanteEnDhcp),
    ordre: [],
  };
  for (const nom of ['lo', 'eth0', 'eth1']) creer(l, nom);
  return l;
}

const racine = { proprio: 'root' };
const fichier = (contenu: string, proprio = 'root') => f(contenu, { lignes: true, proprio });

/** Les services : networking (ifup -a), ssh, et dnsmasq (le DHCP). */
export function systemdRuche(services: Record<string, DefinitionService> = {}) {
  return nouveauSystemd('ruche', MAINTENANT - 40 * 86_400_000, MAINTENANT, {
    networking: { description: 'Raise network interfaces', active: true, executable: 'ifup', processus: [], charger: (j) => demarrerReseau(j) },
    ssh: {
      description: 'OpenBSD Secure Shell server',
      active: true,
      executable: 'sshd',
      processus: [{ pid: 612, utilisateur: 'root', cpu: 0, mem: 0.2, commande: 'sshd: /usr/sbin/sshd -D [listener] 0 of 10-100 startups' }],
    },
    dnsmasq: {
      description: 'dnsmasq - A lightweight DHCP and caching DNS server',
      active: true,
      executable: 'dnsmasq',
      processus: [
        {
          pid: 1450,
          utilisateur: 'dnsmasq',
          cpu: 0,
          mem: 0.1,
          commande: '/usr/sbin/dnsmasq -x /run/dnsmasq/dnsmasq.pid -u dnsmasq -7 /etc/dnsmasq.d,.dpkg-dist,.dpkg-old,.dpkg-new',
        },
      ],
      verifier: (j) => {
        const e = lireDnsmasq(j).erreurs;
        return e.length ? [...e, 'FAILED to start up'] : null;
      },
      verifierAuRechargement: true,
      charger: (j) => demarrerDnsmasq(j),
    },
    ...services,
  });
}

/** Au début du chapitre : le réseau monté depuis le fichier, puis dnsmasq. */
export function initialiserRuche(j: Jeu) {
  demarrerReseau(j);
  demarrerDnsmasq(j);
}

/** Le monde commun : /etc (comptes, réseau, dnsmasq), la maison de vous, /var/lib/misc. */
export function mondeRuche(o: { interfaces: string; dnsmasq: string; maison: Record<string, Noeud> }): Dossier {
  return d(
    {
      etc: d(
        {
          ...fichiersComptes(),
          hostname: fichier('ruche'),
          network: d({ interfaces: fichier(o.interfaces), 'interfaces.d': d({}, undefined, racine) }, undefined, racine),
          'dnsmasq.conf': fichier('# Configuration file for dnsmasq.\n#\n# See /etc/dnsmasq.d for the local configuration.'),
          'dnsmasq.d': d({ ruche: fichier(o.dnsmasq) }, undefined, racine),
        },
        undefined,
        racine,
      ),
      home: d({ vous: d(o.maison) }, undefined, racine),
      var: d(
        { lib: d({ misc: d({ 'dnsmasq.leases': f('', { lignes: true, proprio: 'dnsmasq' }) }, undefined, racine) }, undefined, racine) },
        undefined,
        racine,
      ),
      tmp: d({}, undefined, { proprio: 'root', mode: 'rwxrwxrwt' }),
    },
    undefined,
    racine,
  );
}
