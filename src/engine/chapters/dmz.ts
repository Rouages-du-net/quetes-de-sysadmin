// Story "The Hive", chapter "The DMZ": The Hive hosts its own room-booking
// site, on a small server (web). Inès, a volunteer, installed it and plugged
// it into port 21 of the switch, which the electrician put in a new
// VLAN 40, the DMZ. You need:
//   - the router's eth1.40 interface (10.10.40.1/24), in the file;
//   - a destination translation (dnat, nat chain on the prerouting hook):
//     what arrives on eth0 in TCP 80 and 443 goes to 10.10.40.10;
//   - the forward chain: internet → the server, on those ports only (the
//     rule sees the address AFTER translation), and the server → internet
//     (its updates); but nothing from the server to the internal network:
//     if it is compromised, it must see nothing else.
// Objective checked on the state: the simulated traffic (internet to the
// site, the server to its updates and to the NAS, the offices to the
// server, and the zones of chapter 3) passes or is blocked as intended,
// now AND at the next boot (interfaces, nftables), with ssh staying open
// to the administration computer.
// Sources: https://wiki.nftables.org/wiki-nftables/index.php/Performing_Network_Address_Translation_(NAT),
// https://wiki.nftables.org/wiki-nftables/index.php/Netfilter_hooks

import { f, type Chapter } from '../world';
import type { Game } from '../shell';
import { lan, networkToBoot } from '../lan';
import { toBoot, attempt, nft, results, routing, type Flux, type Result } from '../nftables';
import { sysctlToBoot } from '../commands/nftables';
import { systemd } from '../systemd';
import { FLUX, fluxFor, openSsh } from './zones';
import {
  hiveAccounts,
  dnsmasqVlan,
  initialiseFirewall,
  interfacesVlan,
  M,
  hiveWorld,
  PASSWORD,
  REMOTE_WORK_NFTABLES,
  lanWithDmz,
  ROUTER_SYSCTL,
  hiveSystemd,
  hivePlan,
  fluxIn,
} from './hive';

export const PUBLIC = '192.0.2.21';
const VISITOR = '203.0.113.77';

// The DMZ's traffic, and what must get through; the zones of chapter 3 still hold.
export const FLUX_DMZ: (Flux & { permitted: boolean })[] = [
  ...FLUX,
  { forEachOf: VISITOR, to: PUBLIC, proto: 'tcp', port: 443, permitted: true },
  { forEachOf: VISITOR, to: PUBLIC, proto: 'tcp', port: 80, permitted: true },
  { forEachOf: VISITOR, to: PUBLIC, proto: 'tcp', port: 22, permitted: false },
  { forEachOf: 'web', to: '198.51.100.80', proto: 'tcp', port: 443, permitted: true },
  { forEachOf: 'malik-pc', to: 'web', proto: 'tcp', port: 22, permitted: true },
  { forEachOf: 'web', to: 'nas', proto: 'tcp', port: 445, permitted: false },
  { forEachOf: 'web', to: 'printer', proto: 'tcp', port: 631, permitted: false },
];
const permitted = (j: Game, r: Result) =>
  FLUX_DMZ.map((x) => fluxIn(j.t, x)).find((x) => x.forEachOf === r.flux.forEachOf && x.to === r.flux.to && x.port === r.flux.port)!.permitted;
// What is forbidden must be dropped (or impossible: the server has no network yet).
const refuse = (r: Result) => r.state === 'blocked' || r.state === 'impossible';
const compliant = (j: Game, rs: Result[]) => rs.every((r) => (permitted(j, r) ? r.state === 'ok' : refuse(r)));
const site = (r: Result) => r.flux.forEachOf === VISITOR && r.flux.port !== 22;

const now = (j: Game) => compliant(j, results(j)) && openSsh(nft(j));
const toReboot = (j: Game) => {
  const l = networkToBoot(j)!;
  const rs = (systemd(j)?.services.nftables?.active && toBoot(j)) || { tables: [] };
  const transfer = sysctlToBoot(j, 'net.ipv4.ip_forward', '0') === '1';
  return compliant(j, FLUX_DMZ.map((x) => attempt(l, rs, transfer, fluxIn(j.t, x)))) && openSsh(rs);
};

// A forward-chain rule expecting the public address: it will never see anything, the dnat has already happened.
const waitsPublic = (j: Game) =>
  nft(j).tables.some((t) =>
    t.strings.some(
      (c) => c.base?.hook === 'forward' && c.rules.some((r) => r.conditions.some((x) => x.field === 'ip daddr' && x.values.includes(PUBLIC))),
    ),
  );

export const dmz: Chapter = {
  id: 'dmz',
  number: 5,
  plan: hivePlan({ remoteWork: true, dmz: true }),
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
    'ifup',
    'ifdown',
    'ping',
    'systemctl',
    'journalctl',
    'reboot',
    'sysctl',
    'nft',
    'conntrack',
  ],
  home: M,
  welcome: 'email_ines.txt',
  names: true,
  final: 'end',
  password: PASSWORD,
  accounts: hiveAccounts,
  state: (t) => {
    const sd = hiveSystemd();
    sd.services.nftables.active = true;
    sd.services.nftables.state = 'active';
    const l = lanWithDmz(t);
    return { lan: { ...l, flux: fluxFor(t, FLUX_DMZ) }, systemd: sd, nft: { tables: [] } };
  },
  initialise: initialiseFirewall,
  createWorld: (t) =>
    hiveWorld({
      interfaces: interfacesVlan(t),
      dnsmasq: dnsmasqVlan(t),
      nftables: REMOTE_WORK_NFTABLES,
      sysctl: ROUTER_SYSCTL,
      home: { 'email_ines.txt': f(t('dmz-email-ines')), 'switch-plan.txt': f(t('dmz-plan-switch'), { lines: true }) },
    }),
  events: [
    { id: 'address-public', condition: waitsPublic, message: (j) => j.t('dmz-event-address-public', { address: PUBLIC }) },
    {
      id: 'without-forward',
      condition: (j) => results(j).some((r) => site(r) && r.state === 'blocked' && !!r.destination) && routing(j),
      message: (j) => j.t('dmz-event-without-forward'),
    },
    {
      id: 'too-open',
      condition: (j) => results(j).some((r) => !permitted(j, r) && !refuse(r) && (r.flux.forEachOf === 'web' || r.flux.forEachOf === VISITOR)),
      message: (j) => j.t('dmz-event-too-open'),
    },
    { id: 'ssh', condition: (j) => !openSsh(nft(j)), message: (j) => j.t('zones-event-ssh') },
    { id: 'in-place', condition: (j) => now(j) && !toReboot(j), message: (j) => j.t('dmz-event-in-place') },
    { id: 'end', condition: (j) => !!lan(j) && now(j) && toReboot(j), message: (j) => j.t('dmz-event-end') },
  ],
};
