// Histoire « La Ruche » : un tiers-lieu (des bureaux d'associations, un café
// avec un wifi pour les invité·es, une imprimante et des caméras). Son
// routeur est une Debian (machine ruche) : eth0 vers le fournisseur d'accès,
// eth1 vers le commutateur. L'électricien vient de découper le réseau en
// VLAN sur le commutateur (port 1 : trunk 802.1Q vers le routeur) ; le
// routeur, lui, n'a pas suivi. Ce que les chapitres ont en commun.

import { d, f, fichiersComptes, type Comptes, type Dossier, type Noeud } from '../monde';
import { nomMachine } from '../machines';
import type { Jeu } from '../shell';
import { creer, demarrerReseau, type Appareil, type Lan } from '../lan';
import { demarrerDnsmasq, lireDnsmasq } from '../dnsmasq';
import { nouveauSystemd, type DefinitionService } from '../systemd';
import { journaliserTrafic, lireConf } from '../nftables';
import { appliquerSysctl } from '../commandes/nftables';
import { internet, type ElementPlan } from '../plan';
import type { Traduire } from '../../textes';

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

/** dnsmasq une fois le chapitre « Le DHCP » fini : une plage par VLAN, l'imprimante réservée. */
export const DNSMASQ_VLAN = `# The DHCP server of the LAN: one range per VLAN
interface=eth1.10,eth1.20,eth1.30
dhcp-range=10.10.10.100,10.10.10.200,12h
dhcp-range=10.10.20.100,10.10.20.250,2h
dhcp-range=10.10.30.100,10.10.30.200,24h
dhcp-host=00:00:5e:00:53:30,imprimante,10.10.30.10`;

// /etc/nftables.conf, tel que l'installe le paquet Debian : tout est permis.
export const NFTABLES_DEBIAN = `#!/usr/sbin/nft -f

flush ruleset

table inet filter {
	chain input {
		type filter hook input priority filter;
	}
	chain forward {
		type filter hook forward priority filter;
	}
	chain output {
		type filter hook output priority filter;
	}
}`;

// /etc/sysctl.conf de Debian (abrégé) : le transfert de paquets y est commenté.
const SYSCTL_CONF = `#
# /etc/sysctl.conf - Configuration file for setting system variables
# See /etc/sysctl.d/ for additional system variables.
# See sysctl.conf (5) for information.
#

#kernel.domainname = example.com

# Uncomment the following to stop low-level messages on console
#kernel.printk = 3 4 1 3

###################################################################
# Functions previously found in netbase
#

# Uncomment the next two lines to enable Spoof protection (reverse-path filter)
# Turn on Source Address Verification in all interfaces to
# prevent some spoofing attacks
#net.ipv4.conf.default.rp_filter=1
#net.ipv4.conf.all.rp_filter=1

# Uncomment the next line to enable TCP/IP SYN cookies
# See http://lwn.net/Articles/277146/
# Note: This may impact IPv6 TCP sessions too
#net.ipv4.tcp_syncookies=1

# Uncomment the next line to enable packet forwarding for IPv4
#net.ipv4.ip_forward=1

# Uncomment the next line to enable packet forwarding for IPv6
#  Enabling this option disables Stateless Address Autoconfiguration
#  based on Router Advertisements for this host
#net.ipv6.conf.all.forwarding=1`;

// Les réglages du noyau que le jeu connaît (/proc/sys), à leur valeur au démarrage.
export const SYSCTL_DEFAUTS: Record<string, string> = {
  'kernel.hostname': 'ruche',
  'net.ipv4.conf.all.forwarding': '0',
  'net.ipv4.conf.all.rp_filter': '2',
  'net.ipv4.conf.default.rp_filter': '2',
  'net.ipv4.ip_forward': '0',
  'net.ipv4.tcp_syncookies': '1',
  'net.ipv6.conf.all.forwarding': '0',
  'vm.swappiness': '60',
};

// /proc/sys en arborescence (net/ipv4/ip_forward…).
function procSys(): Dossier {
  const racineSys: Dossier = d({}, undefined, racine);
  for (const [cle, v] of Object.entries(SYSCTL_DEFAUTS)) {
    const morceaux = cle.split('.');
    let dossier = racineSys;
    for (const m of morceaux.slice(0, -1)) dossier = (dossier.enfants[m] ??= d({}, undefined, racine)) as Dossier;
    dossier.enfants[morceaux.at(-1)!] = f(v, { proprio: 'root', mode: 'rw-r--r--' });
  }
  return racineSys;
}

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

/** Les services : networking (ifup -a), systemd-sysctl, ssh, dnsmasq (le DHCP) et nftables (désactivé, comme sur Debian). */
export function systemdRuche(services: Record<string, DefinitionService> = {}) {
  return nouveauSystemd('ruche', MAINTENANT - 40 * 86_400_000, MAINTENANT, {
    networking: {
      description: 'Raise network interfaces',
      active: true,
      resteActif: true,
      executable: 'ifup',
      processus: [],
      charger: (j) => demarrerReseau(j),
    },
    'systemd-sysctl': {
      description: 'Apply Kernel Variables',
      active: true,
      executable: 'systemd-sysctl',
      resteActif: true,
      processus: [],
      charger: (j) => appliquerSysctl(j, SYSCTL_DEFAUTS),
    },
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
    // ExecStart et ExecReload : nft -f /etc/nftables.conf ; ExecStop : nft flush ruleset.
    nftables: {
      description: 'nftables',
      active: false,
      etat: 'inactive',
      executable: 'nft',
      resteActif: true,
      processus: [],
      verifier: (j) => {
        const { erreur } = lireConf(j);
        return erreur ? erreur.split('\n') : null;
      },
      verifierAuRechargement: true,
      charger: (j) => {
        const { ruleset } = lireConf(j);
        if (ruleset) j.etat.nft = ruleset;
        journaliserTrafic(j);
      },
      arret: (j) => {
        j.etat.nft = { tables: [] };
      },
    },
    ...services,
  });
}

/** Au début du chapitre : le réseau monté depuis le fichier, puis dnsmasq. */
export function initialiserRuche(j: Jeu) {
  demarrerReseau(j);
  demarrerDnsmasq(j);
}

/** Le monde commun : /etc (comptes, réseau, dnsmasq, nftables, sysctl), la maison de vous, /var/lib/misc, /proc/sys. */
export function mondeRuche(o: {
  interfaces: string;
  dnsmasq: string;
  maison: Record<string, Noeud>;
  nftables?: string;
  sysctl?: Record<string, Noeud>;
  etc?: Record<string, Noeud>;
}): Dossier {
  return d(
    {
      etc: d(
        {
          ...fichiersComptes(),
          hostname: fichier('ruche'),
          network: d({ interfaces: fichier(o.interfaces), 'interfaces.d': d({}, undefined, racine) }, undefined, racine),
          'dnsmasq.conf': fichier('# Configuration file for dnsmasq.\n#\n# See /etc/dnsmasq.d for the local configuration.'),
          'dnsmasq.d': d({ ruche: fichier(o.dnsmasq) }, undefined, racine),
          'nftables.conf': f(o.nftables ?? NFTABLES_DEBIAN, { lignes: true, proprio: 'root', mode: 'rwxr-xr-x' }),
          'sysctl.conf': fichier(SYSCTL_CONF),
          ...o.etc,
          'sysctl.d': d(
            { 'README.sysctl': fichier('Files in /etc/sysctl.d/ are read by systemd-sysctl and by sysctl --system.\nSee sysctl.d(5).'), ...o.sysctl },
            undefined,
            racine,
          ),
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
      proc: d({ sys: procSys() }, undefined, racine),
    },
    undefined,
    racine,
  );
}

// Le pare-feu à la fin des zones, avec une chaîne input fermée par défaut.
export const NFTABLES_ZONES = `#!/usr/sbin/nft -f

flush ruleset

table inet filter {
	chain input {
		type filter hook input priority filter; policy drop;
		ct state established,related accept
		iif "lo" accept
		# ssh, from the admin network only
		ip saddr 192.0.2.0/24 tcp dport 22 accept
		# DNS and DHCP for the VLANs
		iifname "eth1*" udp dport { 53, 67 } accept
		icmp type echo-request accept
	}
	chain forward {
		type filter hook forward priority filter; policy drop;
		ct state established,related accept
		iifname "eth1.10" accept
		iifname "eth1.20" oifname "eth0" accept
	}
	chain output {
		type filter hook output priority filter; policy accept;
	}
}

table ip nat {
	chain postrouting {
		type nat hook postrouting priority srcnat;
		oifname "eth0" masquerade
	}
}`;

/** Au début : le réseau, les réglages du noyau et le pare-feu du chapitre « Les zones ». */
export function initialiserPareFeu(j: Jeu) {
  initialiserRuche(j);
  appliquerSysctl(j, SYSCTL_DEFAUTS);
  j.etat.nft = lireConf(j, { tables: [] }).ruleset ?? { tables: [] };
}

// Le réglage du routage, écrit dans le chapitre « Les zones ».
export const SYSCTL_ROUTEUR = { '90-routeur.conf': f('net.ipv4.ip_forward = 1', { lignes: true, proprio: 'root' }) };

// Le pare-feu à la fin du « télétravail » : WireGuard entre (UDP 51820) et va vers les bureaux.
export const NFTABLES_TELETRAVAIL = NFTABLES_ZONES.replace(
  'icmp type echo-request accept',
  'icmp type echo-request accept\n\t\t# WireGuard\n\t\tudp dport 51820 accept',
).replace('iifname "eth1.20" oifname "eth0" accept', 'iifname "eth1.20" oifname "eth0" accept\n\t\tiifname "wg0" oifname "eth1.10" accept');

/** Le réseau à la fin de « La DMZ » : eth1.40 dans le fichier, et le pare-feu qui publie le site. */
export const INTERFACES_DMZ = `${INTERFACES_VLAN}

# VLAN 40: dmz (the public web server)
auto eth1.40
iface eth1.40 inet static
    address 10.10.40.1/24`;

export const NFTABLES_DMZ = NFTABLES_TELETRAVAIL.replace(
  'iifname "wg0" oifname "eth1.10" accept',
  'iifname "wg0" oifname "eth1.10" accept\n\t\t# the DMZ: the site from the internet, the server to the internet only\n\t\tiifname "eth0" oifname "eth1.40" ip daddr 10.10.40.10 tcp dport { 80, 443 } accept\n\t\tiifname "eth1.40" oifname "eth0" accept',
).replace(
  '\t\toifname "eth0" masquerade\n\t}',
  '\t\toifname "eth0" masquerade\n\t}\n\tchain prerouting {\n\t\ttype nat hook prerouting priority dstnat;\n\t\tiifname "eth0" tcp dport { 80, 443 } dnat to 10.10.40.10\n\t}',
);

/** Le réseau local avec la DMZ (VLAN 40, le serveur web). */
export function lanAvecDmz(): Lan {
  const l = nouveauLan(true);
  l.vlans.push(40);
  l.appareils.push({ nom: 'web', mac: '00:00:5e:00:53:40', vlan: 40, fixe: '10.10.40.10' });
  return l;
}

/**
 * Le plan du réseau de La Ruche, tel que l'équipe l'a prévu (celui du
 * plan-commutateur.txt) : le routeur, ses VLAN et leurs appareils ; puis, au
 * fil des chapitres, le télétravail, la DMZ, l'Annexe, l'annuaire, la borne Wi-Fi.
 */
export const planRuche =
  (o: { teletravail?: boolean; dmz?: boolean; annexe?: boolean; annuaire?: boolean; wifi?: boolean } = {}) =>
  (t: Traduire): ElementPlan => {
    // Les rôles du routeur : des étiquettes, séparées comme sur un schéma.
    const liste = (mots: string[]) => mots.join(' · ');
    const vlans = [...VLANS, ...(o.dmz ? [{ id: 40, nom: 'dmz', reseau: '10.10.40.0/24' }] : [])];
    const tous = [
      ...appareils(false),
      ...(o.dmz ? [{ nom: 'web', vlan: 40, fixe: '10.10.40.10' }] : []),
      ...(o.wifi ? [{ nom: 'borne-wifi', vlan: 30, fixe: '10.10.30.20' }] : []),
    ];
    return internet(t, {
      role: 'routeur',
      nom: nomMachine(t, 'ruche'),
      adresse: '192.0.2.21',
      note: liste([t('plan-note-routeur'), 'DHCP', ...(o.annuaire || o.wifi ? ['LDAP'] : []), ...(o.wifi ? ['RADIUS'] : [])]),
      hote: 'ruche',
      enfants: [
        ...vlans.map((v) => ({
          role: 'reseau' as const,
          nom: t('plan-vlan', { id: String(v.id), nom: v.nom }),
          adresse: v.reseau,
          enfants: tous
            .filter((a) => a.vlan === v.id)
            .map((a) => ({ role: (a.nom === 'nas' || a.nom === 'web' ? 'serveur' : 'appareil') as ElementPlan['role'], nom: a.nom, adresse: a.fixe ?? t('plan-dhcp') })),
        })),
        ...(o.teletravail
          ? [{ role: 'poste' as const, nom: 'portable-malik', adresse: '198.51.100.23', note: t('plan-note-teletravail'), tunnel: true }]
          : []),
        ...(o.annexe
          ? [
              {
                role: 'routeur' as const,
                nom: t('plan-annexe'),
                adresse: '203.0.113.60',
                note: t('plan-note-annexe'),
                tunnel: true,
                enfants: [
                  {
                    role: 'reseau' as const,
                    nom: t('plan-reseau-annexe'),
                    adresse: '10.20.10.0/24',
                    enfants: [
                      { role: 'appareil' as const, nom: 'poste-annexe', adresse: '10.20.10.15' },
                      { role: 'appareil' as const, nom: 'imprimante-annexe', adresse: '10.20.10.20' },
                    ],
                  },
                ],
              },
            ]
          : []),
      ],
    });
  };
