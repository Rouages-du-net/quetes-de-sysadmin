// Histoire « La Ruche » : un tiers-lieu (des bureaux d'associations, un café
// avec un wifi pour les invité·es, une imprimante et des caméras). Son
// routeur est une Debian (machine ruche) : eth0 vers le fournisseur d'accès,
// eth1 vers le commutateur. L'électricien vient de découper le réseau en
// VLAN sur le commutateur (port 1 : trunk 802.1Q vers le routeur) ; le
// routeur, lui, n'a pas suivi. Ce que les chapitres ont en commun.

import { d, f, accountsFiles, type Accounts, type Directory, type Node } from '../world';
import { machineName } from '../machines';
import type { Game } from '../shell';
import { create, startNetwork, type Device, type Lan } from '../lan';
import { startDnsmasq, readDnsmasq } from '../dnsmasq';
import { newSystemd, type DefinitionService } from '../systemd';
import { logTraffic, readConf } from '../nftables';
import { applySysctl } from '../commands/nftables';
import { internet, type ElementPlan } from '../plan';
import type { Translate } from '../../texts';

export const M = '/home/you';
export const PASSWORD = 'bee-2027';
// Lundi 8 novembre 2027, 8 h 15.
export const NOW = Date.UTC(2027, 10, 8, 8, 15, 0);

// Le plan des VLAN (celui de l'électricien) : numéro, nom, réseau, adresse du routeur.
export const VLANS = [
  { id: 10, name: 'bureaux', reseau: '10.10.10.0/24', routeur: '10.10.10.1/24' },
  { id: 20, name: 'invites', reseau: '10.10.20.0/24', routeur: '10.10.20.1/24' },
  { id: 30, name: 'equipements', reseau: '10.10.30.0/24', routeur: '10.10.30.1/24' },
];

// Les appareils branchés au commutateur (adresses MAC de documentation, RFC 7042).
export const devices = (printerInDhcp: boolean): Device[] => [
  { name: 'nas', mac: '00:00:5e:00:53:05', vlan: 10, fixed: '10.10.10.5' },
  { name: 'poste-malik', mac: '00:00:5e:00:53:10', vlan: 10 },
  { name: 'poste-accueil', mac: '00:00:5e:00:53:11', vlan: 10 },
  { name: 'telephone-visiteur', mac: '00:00:5e:00:53:20', vlan: 20 },
  printerInDhcp
    ? { name: 'imprimante', mac: '00:00:5e:00:53:30', vlan: 30 }
    : { name: 'imprimante', mac: '00:00:5e:00:53:30', vlan: 30, fixed: '10.10.30.10' },
  { name: 'camera-entree', mac: '00:00:5e:00:53:31', vlan: 30, fixed: '10.10.30.11' },
];

export const hiveAccounts = (): Accounts => ({
  users: { root: { uid: 0, group: 'root', home: '/root' }, you: { uid: 1000, group: 'you' } },
  groups: {
    root: { gid: 0, members: [] },
    adm: { gid: 4, members: ['you'] },
    sudo: { gid: 27, members: ['you'] },
    you: { gid: 1000, members: [] },
  },
});

// /etc/network/interfaces de Debian ; le LAN est encore un seul réseau à plat.
export const FLAT_A_INTERFACES = `# This file describes the network interfaces available on your system
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
export const INTERFACES_VLAN = `${FLAT_A_INTERFACES.replace('# LAN: one flat network for everyone\nauto eth1\niface eth1 inet static\n    address 192.168.1.1/24', '# LAN: the trunk to the switch (VLANs 10, 20, 30)\nauto eth1\niface eth1 inet manual')}
${VLANS.map((v) => `\n# VLAN ${v.id}: ${v.name}\nauto eth1.${v.id}\niface eth1.${v.id} inet static\n    address ${v.routeur}`).join('\n')}`;

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
export const DEFAULTS_SYSCTL: Record<string, string> = {
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
function procSys(): Directory {
  const sysRoot: Directory = d({}, undefined, root);
  for (const [key, v] of Object.entries(DEFAULTS_SYSCTL)) {
    const chunks = key.split('.');
    let directory = sysRoot;
    for (const m of chunks.slice(0, -1)) directory = (directory.children[m] ??= d({}, undefined, root)) as Directory;
    directory.children[chunks.at(-1)!] = f(v, { owner: 'root', mode: 'rw-r--r--' });
  }
  return sysRoot;
}

/** L'état du réseau local de départ (reconstruit depuis /etc/network/interfaces au démarrage). */
export function newLan(printerInDhcp: boolean): Lan {
  const l: Lan = {
    interfaces: {},
    gateway: null,
    trunk: 'eth1',
    vlans: VLANS.map((v) => v.id),
    devices: devices(printerInDhcp),
    order: [],
  };
  for (const name of ['lo', 'eth0', 'eth1']) create(l, name);
  return l;
}

const root = { owner: 'root' };
const file = (content: string, owner = 'root') => f(content, { lines: true, owner });

/** Les services : networking (ifup -a), systemd-sysctl, ssh, dnsmasq (le DHCP) et nftables (désactivé, comme sur Debian). */
export function hiveSystemd(services: Record<string, DefinitionService> = {}) {
  return newSystemd('hive', NOW - 40 * 86_400_000, NOW, {
    networking: {
      description: 'Raise network interfaces',
      active: true,
      activeRest: true,
      executable: 'ifup',
      process: [],
      load: (j) => startNetwork(j),
    },
    'systemd-sysctl': {
      description: 'Apply Kernel Variables',
      active: true,
      executable: 'systemd-sysctl',
      activeRest: true,
      process: [],
      load: (j) => applySysctl(j, DEFAULTS_SYSCTL),
    },
    ssh: {
      description: 'OpenBSD Secure Shell server',
      active: true,
      executable: 'sshd',
      process: [{ pid: 612, user: 'root', cpu: 0, mem: 0.2, command: 'sshd: /usr/sbin/sshd -D [listener] 0 of 10-100 startups' }],
    },
    dnsmasq: {
      description: 'dnsmasq - A lightweight DHCP and caching DNS server',
      active: true,
      executable: 'dnsmasq',
      process: [
        {
          pid: 1450,
          user: 'dnsmasq',
          cpu: 0,
          mem: 0.1,
          command: '/usr/sbin/dnsmasq -x /run/dnsmasq/dnsmasq.pid -u dnsmasq -7 /etc/dnsmasq.d,.dpkg-dist,.dpkg-old,.dpkg-new',
        },
      ],
      check: (j) => {
        const e = readDnsmasq(j).errors;
        return e.length ? [...e, 'FAILED to start up'] : null;
      },
      checkToReload: true,
      load: (j) => startDnsmasq(j),
    },
    // ExecStart et ExecReload : nft -f /etc/nftables.conf ; ExecStop : nft flush ruleset.
    nftables: {
      description: 'nftables',
      active: false,
      state: 'inactive',
      executable: 'nft',
      activeRest: true,
      process: [],
      check: (j) => {
        const { error } = readConf(j);
        return error ? error.split('\n') : null;
      },
      checkToReload: true,
      load: (j) => {
        const { ruleset } = readConf(j);
        if (ruleset) j.state.nft = ruleset;
        logTraffic(j);
      },
      stop: (j) => {
        j.state.nft = { tables: [] };
      },
    },
    ...services,
  });
}

/** Au début du chapitre : le réseau monté depuis le fichier, puis dnsmasq. */
export function initialiseHive(j: Game) {
  startNetwork(j);
  startDnsmasq(j);
}

/** Le monde commun : /etc (comptes, réseau, dnsmasq, nftables, sysctl), la maison de vous, /var/lib/misc, /proc/sys. */
export function hiveWorld(o: {
  interfaces: string;
  dnsmasq: string;
  home: Record<string, Node>;
  nftables?: string;
  sysctl?: Record<string, Node>;
  etc?: Record<string, Node>;
}): Directory {
  return d(
    {
      etc: d(
        {
          ...accountsFiles(),
          hostname: file('hive'),
          network: d({ interfaces: file(o.interfaces), 'interfaces.d': d({}, undefined, root) }, undefined, root),
          'dnsmasq.conf': file('# Configuration file for dnsmasq.\n#\n# See /etc/dnsmasq.d for the local configuration.'),
          'dnsmasq.d': d({ hive: file(o.dnsmasq) }, undefined, root),
          'nftables.conf': f(o.nftables ?? NFTABLES_DEBIAN, { lines: true, owner: 'root', mode: 'rwxr-xr-x' }),
          'sysctl.conf': file(SYSCTL_CONF),
          ...o.etc,
          'sysctl.d': d(
            { 'README.sysctl': file('Files in /etc/sysctl.d/ are read by systemd-sysctl and by sysctl --system.\nSee sysctl.d(5).'), ...o.sysctl },
            undefined,
            root,
          ),
        },
        undefined,
        root,
      ),
      home: d({ you: d(o.home) }, undefined, root),
      var: d(
        { lib: d({ misc: d({ 'dnsmasq.leases': f('', { lines: true, owner: 'dnsmasq' }) }, undefined, root) }, undefined, root) },
        undefined,
        root,
      ),
      tmp: d({}, undefined, { owner: 'root', mode: 'rwxrwxrwt' }),
      proc: d({ sys: procSys() }, undefined, root),
    },
    undefined,
    root,
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
export function initialiseFirewall(j: Game) {
  initialiseHive(j);
  applySysctl(j, DEFAULTS_SYSCTL);
  j.state.nft = readConf(j, { tables: [] }).ruleset ?? { tables: [] };
}

// Le réglage du routage, écrit dans le chapitre « Les zones ».
export const ROUTER_SYSCTL = { '90-router.conf': f('net.ipv4.ip_forward = 1', { lines: true, owner: 'root' }) };

// Le pare-feu à la fin du « télétravail » : WireGuard entre (UDP 51820) et va vers les bureaux.
export const REMOTE_WORK_NFTABLES = NFTABLES_ZONES.replace(
  'icmp type echo-request accept',
  'icmp type echo-request accept\n\t\t# WireGuard\n\t\tudp dport 51820 accept',
).replace('iifname "eth1.20" oifname "eth0" accept', 'iifname "eth1.20" oifname "eth0" accept\n\t\tiifname "wg0" oifname "eth1.10" accept');

/** Le réseau à la fin de « La DMZ » : eth1.40 dans le fichier, et le pare-feu qui publie le site. */
export const INTERFACES_DMZ = `${INTERFACES_VLAN}

# VLAN 40: dmz (the public web server)
auto eth1.40
iface eth1.40 inet static
    address 10.10.40.1/24`;

export const NFTABLES_DMZ = REMOTE_WORK_NFTABLES.replace(
  'iifname "wg0" oifname "eth1.10" accept',
  'iifname "wg0" oifname "eth1.10" accept\n\t\t# the DMZ: the site from the internet, the server to the internet only\n\t\tiifname "eth0" oifname "eth1.40" ip daddr 10.10.40.10 tcp dport { 80, 443 } accept\n\t\tiifname "eth1.40" oifname "eth0" accept',
).replace(
  '\t\toifname "eth0" masquerade\n\t}',
  '\t\toifname "eth0" masquerade\n\t}\n\tchain prerouting {\n\t\ttype nat hook prerouting priority dstnat;\n\t\tiifname "eth0" tcp dport { 80, 443 } dnat to 10.10.40.10\n\t}',
);

/** Le réseau local avec la DMZ (VLAN 40, le serveur web). */
export function lanWithDmz(): Lan {
  const l = newLan(true);
  l.vlans.push(40);
  l.devices.push({ name: 'web', mac: '00:00:5e:00:53:40', vlan: 40, fixed: '10.10.40.10' });
  return l;
}

/**
 * Le plan du réseau de La Ruche, tel que l'équipe l'a prévu (celui du
 * plan-commutateur.txt) : le routeur, ses VLAN et leurs appareils ; puis, au
 * fil des chapitres, le télétravail, la DMZ, l'Annexe, l'annuaire, la borne Wi-Fi.
 */
export const hivePlan =
  (o: { remoteWork?: boolean; dmz?: boolean; annex?: boolean; directory?: boolean; wifi?: boolean } = {}) =>
  (t: Translate): ElementPlan => {
    // Les rôles du routeur : des étiquettes, séparées comme sur un schéma.
    const listing = (words: string[]) => words.join(' · ');
    const vlans = [...VLANS, ...(o.dmz ? [{ id: 40, name: 'dmz', reseau: '10.10.40.0/24' }] : [])];
    const all = [
      ...devices(false),
      ...(o.dmz ? [{ name: 'web', vlan: 40, fixed: '10.10.40.10' }] : []),
      ...(o.wifi ? [{ name: 'borne-wifi', vlan: 30, fixed: '10.10.30.20' }] : []),
    ];
    return internet(t, {
      role: 'routeur',
      name: machineName(t, 'hive'),
      address: '192.0.2.21',
      note: listing([t('plan-note-router'), 'DHCP', ...(o.directory || o.wifi ? ['LDAP'] : []), ...(o.wifi ? ['RADIUS'] : [])]),
      host: 'hive',
      children: [
        ...vlans.map((v) => ({
          role: 'reseau' as const,
          name: t('plan-vlan', { id: String(v.id), nom: v.name }),
          address: v.reseau,
          children: all
            .filter((a) => a.vlan === v.id)
            .map((a) => ({ role: (a.name === 'nas' || a.name === 'web' ? 'serveur' : 'appareil') as ElementPlan['role'], name: a.name, address: a.fixed ?? t('plan-dhcp') })),
        })),
        ...(o.remoteWork
          ? [{ role: 'poste' as const, name: 'malik-laptop', address: '198.51.100.23', note: t('plan-note-remote-work'), tunnel: true }]
          : []),
        ...(o.annex
          ? [
              {
                role: 'routeur' as const,
                name: t('plan-annex'),
                address: '203.0.113.60',
                note: t('plan-note-annex'),
                tunnel: true,
                children: [
                  {
                    role: 'reseau' as const,
                    name: t('plan-network-annex'),
                    address: '10.20.10.0/24',
                    children: [
                      { role: 'appareil' as const, name: 'poste-annexe', address: '10.20.10.15' },
                      { role: 'appareil' as const, name: 'imprimante-annexe', address: '10.20.10.20' },
                    ],
                  },
                ],
              },
            ]
          : []),
      ],
    });
  };
