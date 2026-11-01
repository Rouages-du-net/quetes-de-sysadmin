// Story "The Hive", chapter "The Annex": The Hive opens a second place,
// the Annex, in a former workshop across town. Its router (Debian too,
// behind its provider's box) has its own network, 10.20.10.0/24. Sami, a
// volunteer there, has created its keys; the two sites must be linked by
// the WireGuard VPN already used for Malik's remote work:
//   - one more [Peer] in /etc/wireguard/wg0.conf: the Annex's public key,
//     and its AllowedIPs: its address in the tunnel AND its whole network
//     (for WireGuard, these are the addresses this peer may send from, and
//     those sent to it: wg-quick turns them into routes);
//   - restart wg0 (wg-quick doesn't reread the file by itself);
//   - complete annex-wg0.conf: the router's public key, the Endpoint,
//     AllowedIPs = the offices' network, and PersistentKeepalive: behind a
//     box, The Hive's router can't reach the Annex unless the Annex keeps
//     the way open.
// Objective checked on the state: a computer at the Annex reaches the NAS,
// a computer in the offices prints at the Annex, the Annex doesn't see the
// cameras, Malik still reaches the NAS, now AND at the next boot.
// Sources: https://www.wireguard.com/#cryptokey-routing,
// https://man7.org/linux/man-pages/man8/wg.8.html (PersistentKeepalive),
// https://man7.org/linux/man-pages/man8/wg-quick.8.html (routes)

import { f, name, type Chapter } from '../world';
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
import { fluxFor } from './zones';
import { MALIK, MALIK_PUBLIC } from './remote-work';
import {
  hiveAccounts,
  dnsmasqVlan,
  initialiseFirewall,
  interfacesDmz,
  M,
  hiveWorld,
  PASSWORD,
  NFTABLES_DMZ,
  lanWithDmz,
  ROUTER_SYSCTL,
  hiveSystemd,
  hivePlan,
} from './hive';
import type { Translate } from '../../texts';

// The private key of The Hive's router (created in the chapter "Working from home"), and that of the Annex's router (it never leaves the Annex).
const ROUTER_KEY = '2H8lWIAEPk9kEtfgQW8ZQVaCUVKhwmA1PDgxbjXZqXk=';
const ANNEX_KEY = 'cDqmuXhcmm7LqTLk8TNfgPuG1GqnfxHaU2D7OWNw11U=';
export const ROUTER_PUBLIC = isPublic(ROUTER_KEY)!;
export const ANNEX_PUBLIC = isPublic(ANNEX_KEY)!;
const ANNEX_CONF = `${M}/annex-wg0.conf`;

// The Annex's router: a computer over there (10.20.10.15) goes to the NAS.
export const ANNEX: Remote = {
  name: 'annex',
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

/** wg0.conf at the end of "The Annex": Malik and the Annex's router. */
export const annexWg0 = (t: Translate) => `${WG0}

# ${t('annex-peer-comment')}
[Peer]
PublicKey = ${ANNEX_PUBLIC}
AllowedIPs = 10.10.99.3/32, 10.20.10.0/24`;

type O = { interfaces?: Record<string, InterfaceWg>; ruleset?: ReturnType<typeof nft>; transfer?: boolean };
const publicOf = (j: Game) => publicFields(j as Shell);

// The address of a computer in the offices (its DHCP lease).
const officesWorkstation = (j: Game) => {
  const a = lan(j)?.devices.find((x) => x.name === name(j.t, 'malik-pc'));
  return (a && addressFor(a)) ?? '10.10.10.150';
};

const toNas = (j: Game, o: O = {}) => tunnelState(j, ANNEX, { ...publicOf(j), ...o }).state;
const toPrinter = (j: Game, o: O = {}) => stateToRemote(j, ANNEX, officesWorkstation(j), ANNEX_PRINTER, 631, { ...publicOf(j), ...o }).state;
const toCamera = (j: Game, o: O = {}) => tunnelState(j, { ...ANNEX, to: '10.10.30.11', port: 554 }, { ...publicOf(j), ...o }).state;
const malik = (j: Game, o: O = {}) => tunnelState(j, MALIK, { ...publicOf(j), ...o }).state;

const compliant = (j: Game, o: O = {}) => toNas(j, o) === 'ok' && toPrinter(j, o) === 'ok' && toCamera(j, o) !== 'ok' && malik(j, o) === 'ok';

// At the next boot: the enabled wg-quick@ units (their files), nftables, the sysctl files.
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

// The file has a peer for the Annex, but wg0 still runs with the old one.
const notReread = (j: Game) => {
  const file = readConfWg(j.read(confFor('wg0')) ?? '');
  const inWorks = wg(j).wg0?.conf;
  return file.peers.some((p) => p.key === ANNEX_PUBLIC) && !inWorks?.peers.some((p) => p.key === ANNEX_PUBLIC);
};

const failedHandshake = (e: TunnelState) => ['conf', 'address', 'filtered', 'router-key', 'unknown'].includes(e);

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
  final: 'end',
  password: PASSWORD,
  accounts: hiveAccounts,
  state: (t) => {
    const sd = hiveSystemd({ 'wg-quick@wg0': serviceWg('wg0') });
    for (const name of ['nftables', 'wg-quick@wg0']) Object.assign(sd.services[name], { active: true, state: 'active' });
    const l = lanWithDmz(t);
    return { lan: { ...l, flux: fluxFor(t, FLUX_DMZ), remotes: [MALIK, ANNEX] }, systemd: sd, nft: { tables: [] }, wg: {} };
  },
  initialise: (j) => {
    initialiseFirewall(j);
    mountWg(j, 'wg0', true);
  },
  createWorld: (t) =>
    hiveWorld({
      interfaces: interfacesDmz(t),
      dnsmasq: dnsmasqVlan(t),
      nftables: NFTABLES_DMZ,
      sysctl: ROUTER_SYSCTL,
      etc: {
        wireguard: {
          type: 'directory',
          children: { 'wg0.conf': f(WG0, { lines: true, owner: 'root', mode: 'rw-------' }) },
          owner: 'root',
          mode: 'rwx------',
        },
      },
      home: {
        'email_sami.txt': f(t('annex-email-sami', { key: ANNEX_PUBLIC })),
        'annex-wg0.conf': f(t('annex-conf'), { lines: true }),
        'malik-laptop.conf': f(MALIK_LAPTOP, { lines: true }),
      },
    }),
  events: [
    { id: 'not-reread', condition: notReread, message: (j) => j.t('annex-event-not-reread') },
    {
      id: 'handshake',
      condition: (j) => !notReread(j) && !!wg(j).wg0?.conf.peers.some((p) => p.key === ANNEX_PUBLIC) && failedHandshake(toNas(j)),
      message: (j) => j.t('annex-event-handshake'),
    },
    { id: 'allowed', condition: (j) => toNas(j) === 'allowed-ips', message: (j) => j.t('annex-event-allowed') },
    { id: 'route', condition: (j) => toNas(j) === 'route', message: (j) => j.t('annex-event-route') },
    { id: 'asleep', condition: (j) => toNas(j) === 'ok' && toPrinter(j) === 'asleep', message: (j) => j.t('annex-event-asleep') },
    { id: 'cameras', condition: (j) => toCamera(j) === 'ok', message: (j) => j.t('annex-event-cameras') },
    { id: 'malik', condition: (j) => !!wg(j).wg0 && malik(j) !== 'ok', message: (j) => j.t('annex-event-malik') },
    { id: 'ssh', condition: (j) => !openSsh(nft(j)), message: (j) => j.t('zones-event-ssh') },
    { id: 'in-place', condition: (j) => compliant(j) && !compliant(j, toReboot(j)), message: (j) => j.t('annex-event-in-place') },
    { id: 'end', condition: (j) => compliant(j) && openSsh(nft(j)) && compliant(j, toReboot(j)), message: (j) => j.t('annex-event-end') },
  ],
};
