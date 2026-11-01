// Histoire « La Ruche » — chapitre « L'Annexe » : La Ruche ouvre un second
// lieu, l'Annexe, dans un ancien atelier de l'autre côté de la ville. Son
// routeur (Debian aussi, derrière la box de son fournisseur) a son réseau,
// 10.20.10.0/24. Sami, bénévole là-bas, a créé ses clés ; il faut relier les
// deux sites par le VPN WireGuard qui sert déjà au télétravail de Malik :
//   - un [Peer] de plus dans /etc/wireguard/wg0.conf : la clé publique de
//     l'Annexe, et ses AllowedIPs : son adresse dans le tunnel ET tout son
//     réseau (pour WireGuard, ce sont les adresses d'où ce pair a le droit
//     d'envoyer, et celles qu'on lui envoie : wg-quick en fait des routes) ;
//   - relancer wg0 (wg-quick ne relit pas le fichier tout seul) ;
//   - compléter annex-wg0.conf : la clé publique du routeur, l'Endpoint,
//     AllowedIPs = le réseau des bureaux, et PersistentKeepalive : derrière
//     une box, le routeur de La Ruche ne peut pas joindre l'Annexe si elle ne
//     garde pas le passage ouvert.
// Objectif vérifié sur l'état : un poste de l'Annexe joint le NAS, un poste
// des bureaux imprime à l'Annexe, l'Annexe ne voit pas les caméras, Malik
// joint toujours le NAS, maintenant ET au prochain démarrage.
// Sources : https://www.wireguard.com/#cryptokey-routing,
// https://man7.org/linux/man-pages/man8/wg.8.html (PersistentKeepalive),
// https://man7.org/linux/man-pages/man8/wg-quick.8.html (routes)

import { f, type Chapter } from '../world';
import type { Game } from '../shell';
import type { Shell } from '../shell';
import { addressFor, lan } from '../lan';
import { toBoot, nft } from '../nftables';
import { sysctlToBoot } from '../commands/nftables';
import { publicFields, serviceWg } from '../commands/wireguard';
import {
  confFor,
  tunnelState,
  stateToRemote,
  readConfWg,
  mountWg,
  isPublic,
  wg,
  type Remote,
  type TunnelState,
  type InterfaceWg,
} from '../wireguard';
import { systemd } from '../systemd';
import { openSsh } from './zones';
import { FLUX_DMZ } from './dmz';
import { MALIK, MALIK_PUBLIC } from './remote-work';
import {
  hiveAccounts,
  DNSMASQ_VLAN,
  initialiseFirewall,
  INTERFACES_DMZ,
  M,
  hiveWorld,
  PASSWORD,
  NFTABLES_DMZ,
  lanWithDmz,
  ROUTER_SYSCTL,
  hiveSystemd,
  hivePlan,
} from './hive';

// La clé privée du routeur de La Ruche (créée au chapitre « Le télétravail »), et celle du routeur de l'Annexe (elle ne quitte pas l'Annexe).
const ROUTER_KEY = '2H8lWIAEPk9kEtfgQW8ZQVaCUVKhwmA1PDgxbjXZqXk=';
const ANNEX_KEY = 'cDqmuXhcmm7LqTLk8TNfgPuG1GqnfxHaU2D7OWNw11U=';
export const ROUTER_PUBLIC = isPublic(ROUTER_KEY)!;
export const ANNEX_PUBLIC = isPublic(ANNEX_KEY)!;
const ANNEX_CONF = `${M}/annex-wg0.conf`;

// Le routeur de l'Annexe : un poste de là-bas (10.20.10.15) va au NAS.
export const ANNEX: Remote = {
  name: 'annexe',
  address: '203.0.113.60',
  key: ANNEX_PUBLIC,
  conf: ANNEX_CONF,
  to: '10.10.10.5',
  port: 445,
  network: '10.20.10.0/24',
  source: '10.20.10.15',
  behindNat: true,
};
const ANNEX_PRINTER = '10.20.10.20';

export const WG0 = `[Interface]
Address = 10.10.99.1/24
ListenPort = 51820
PrivateKey = ${ROUTER_KEY}

# Malik (laptop)
[Peer]
PublicKey = ${MALIK_PUBLIC}
AllowedIPs = 10.10.99.2/32`;

export const MALIK_LAPTOP = `[Interface]
Address = 10.10.99.2/32

[Peer]
PublicKey = ${ROUTER_PUBLIC}
Endpoint = hive.example:51820
AllowedIPs = 10.10.10.0/24`;

/** wg0.conf à la fin de « L'Annexe » : Malik et le routeur de l'Annexe. */
export const ANNEX_WG0 = `${WG0}

# Annexe
[Peer]
PublicKey = ${ANNEX_PUBLIC}
AllowedIPs = 10.10.99.3/32, 10.20.10.0/24`;

type O = { interfaces?: Record<string, InterfaceWg>; ruleset?: ReturnType<typeof nft>; transfer?: boolean };
const publicOf = (j: Game) => publicFields(j as Shell);

// L'adresse d'un poste des bureaux (son bail DHCP).
const officesWorkstation = (j: Game) => {
  const a = lan(j)?.devices.find((x) => x.name === 'poste-malik');
  return (a && addressFor(a)) ?? '10.10.10.150';
};

const toNas = (j: Game, o: O = {}) => tunnelState(j, ANNEX, { ...publicOf(j), ...o }).state;
const toPrinter = (j: Game, o: O = {}) => stateToRemote(j, ANNEX, officesWorkstation(j), ANNEX_PRINTER, 631, { ...publicOf(j), ...o }).state;
const toCamera = (j: Game, o: O = {}) => tunnelState(j, { ...ANNEX, to: '10.10.30.11', port: 554 }, { ...publicOf(j), ...o }).state;
const malik = (j: Game, o: O = {}) => tunnelState(j, MALIK, { ...publicOf(j), ...o }).state;

const compliant = (j: Game, o: O = {}) => toNas(j, o) === 'ok' && toPrinter(j, o) === 'ok' && toCamera(j, o) !== 'ok' && malik(j, o) === 'ok';

// Au prochain démarrage : les wg-quick@ activés (leurs fichiers), nftables, les fichiers sysctl.
function toReboot(j: Game): O {
  const sd = systemd(j);
  const interfaces: Record<string, InterfaceWg> = {};
  for (const [name, s] of Object.entries(sd?.services ?? {})) {
    const m = /^wg-quick@(.+)$/.exec(name);
    const text = m && s.active ? j.read(confFor(m[1])) : null;
    if (!m || text === null) continue;
    const c = readConfWg(text);
    if (!c.errors.length) interfaces[m[1]] = { conf: c, byService: true };
  }
  return {
    interfaces,
    ruleset: (sd?.services.nftables?.active && toBoot(j)) || { tables: [] },
    transfer: sysctlToBoot(j, 'net.ipv4.ip_forward', '0') === '1',
  };
}

// Le fichier a un pair pour l'Annexe, mais wg0 tourne encore avec l'ancien.
const notReread = (j: Game) => {
  const file = readConfWg(j.read(confFor('wg0')) ?? '');
  const inWorks = wg(j).wg0?.conf;
  return file.peers.some((p) => p.key === ANNEX_PUBLIC) && !inWorks?.peers.some((p) => p.key === ANNEX_PUBLIC);
};

const failedHandshake = (e: TunnelState) => ['conf', 'adresse', 'filtre', 'cle-routeur', 'inconnu'].includes(e);

export const annex: Chapter = {
  id: 'annex',
  number: 6,
  plan: hivePlan({ remoteWork: true, dmz: true, annex: true }),
  commands: [
    'ls',
    'cd',
    'pwd',
    'cat',
    'less',
    'head',
    'tail',
    'grep',
    'nano',
    'cp',
    'sudo',
    'id',
    'whoami',
    'ip',
    'ping',
    'systemctl',
    'journalctl',
    'reboot',
    'sysctl',
    'nft',
    'conntrack',
    'wg',
    'wg-quick',
  ],
  home: M,
  welcome: 'email_sami.txt',
  names: true,
  final: 'fin',
  password: PASSWORD,
  accounts: hiveAccounts,
  state: () => {
    const sd = hiveSystemd({ 'wg-quick@wg0': serviceWg('wg0') });
    for (const name of ['nftables', 'wg-quick@wg0']) Object.assign(sd.services[name], { active: true, state: 'active' });
    const l = lanWithDmz();
    return { lan: { ...l, flux: FLUX_DMZ.map(({ permitted: _, ...x }) => x), remotes: [MALIK, ANNEX] }, systemd: sd, nft: { tables: [] }, wg: {} };
  },
  initialise: (j) => {
    initialiseFirewall(j);
    mountWg(j, 'wg0', true);
  },
  createWorld: (t) =>
    hiveWorld({
      interfaces: INTERFACES_DMZ,
      dnsmasq: DNSMASQ_VLAN,
      nftables: NFTABLES_DMZ,
      sysctl: ROUTER_SYSCTL,
      etc: {
        wireguard: {
          type: 'dossier',
          children: { 'wg0.conf': f(WG0, { lines: true, owner: 'root', mode: 'rw-------' }) },
          owner: 'root',
          mode: 'rwx------',
        },
      },
      home: {
        'email_sami.txt': f(t('annex-courriel-sami', { cle: ANNEX_PUBLIC })),
        'annex-wg0.conf': f(t('annex-conf'), { lines: true }),
        'malik-laptop.conf': f(MALIK_LAPTOP, { lines: true }),
      },
    }),
  events: [
    { id: 'pas-relu', condition: notReread, message: (j) => j.t('annex-evenement-pas-relu') },
    {
      id: 'poignee',
      condition: (j) => !notReread(j) && !!wg(j).wg0?.conf.peers.some((p) => p.key === ANNEX_PUBLIC) && failedHandshake(toNas(j)),
      message: (j) => j.t('annex-evenement-poignee'),
    },
    { id: 'autorisees', condition: (j) => toNas(j) === 'autorisees', message: (j) => j.t('annex-evenement-autorisees') },
    { id: 'route', condition: (j) => toNas(j) === 'route', message: (j) => j.t('annex-evenement-route') },
    { id: 'endormi', condition: (j) => toNas(j) === 'ok' && toPrinter(j) === 'endormi', message: (j) => j.t('annex-evenement-endormi') },
    { id: 'cameras', condition: (j) => toCamera(j) === 'ok', message: (j) => j.t('annex-evenement-cameras') },
    { id: 'malik', condition: (j) => !!wg(j).wg0 && malik(j) !== 'ok', message: (j) => j.t('annex-evenement-malik') },
    { id: 'ssh', condition: (j) => !openSsh(nft(j)), message: (j) => j.t('zones-evenement-ssh') },
    { id: 'en-place', condition: (j) => compliant(j) && !compliant(j, toReboot(j)), message: (j) => j.t('annex-evenement-en-place') },
    { id: 'fin', condition: (j) => compliant(j) && openSsh(nft(j)) && compliant(j, toReboot(j)), message: (j) => j.t('annex-evenement-fin') },
  ],
};
