// Story "The Hive", chapter "The Zones": each VLAN has its addresses, but
// nothing gets out. The router doesn't forward packets
// (net.ipv4.ip_forward = 0), and nobody translates the private addresses
// (NAT). The former volunteer had done it by hand, without writing it down
// anywhere: everything was lost on reboot. And Malik wants zones:
//   - the offices (VLAN 10) go everywhere: the internet, the printer;
//   - the guests (VLAN 20): the internet, and nothing else (neither the NAS nor the cameras);
//   - the equipment (VLAN 30): nothing to the internet (the cameras "phone
//     home" to their manufacturer), but the NAS records the cameras.
// To do: sysctl (and /etc/sysctl.d so it lasts), a forward chain with a
// drop policy and ct state established,related, a nat chain with
// masquerade on eth0, in /etc/nftables.conf, and nftables enabled.
// Objective checked on the state: the devices' simulated traffic (Lan.flux)
// passes or is blocked as intended, now AND with what would be loaded at
// boot (sysctl files, /etc/nftables.conf, service enabled), without
// closing ssh to the administration computer.
// Sources: https://wiki.nftables.org/wiki-nftables/index.php/Performing_Network_Address_Translation_(NAT),
// https://wiki.nftables.org/wiki-nftables/index.php/Simple_ruleset_for_a_home_router,
// https://www.netfilter.org/projects/nftables/manpage.html, https://man7.org/linux/man-pages/man5/sysctl.d.5.html

import { f, type Chapter } from '../world';
import type { Game } from '../shell';
import { isIp, lan } from '../lan';
import { toBoot, attempt, nft, results, routing, traverse, type Flux, type Result, type Ruleset } from '../nftables';
import { sysctlToBoot } from '../commands/nftables';
import { systemd } from '../systemd';
import { WORKSTATION } from '../machines';
import { hiveAccounts, DNSMASQ_VLAN, initialiseHive, INTERFACES_VLAN, M, hiveWorld, PASSWORD, newLan, hiveSystemd, hivePlan } from './hive';

// The devices' traffic, and what must get through.
export const FLUX: (Flux & { permitted: boolean })[] = [
  { forEachOf: 'poste-malik', to: '198.51.100.80', proto: 'tcp', port: 443, permitted: true },
  { forEachOf: 'poste-accueil', to: 'imprimante', proto: 'tcp', port: 631, permitted: true },
  { forEachOf: 'nas', to: 'camera-entree', proto: 'tcp', port: 554, permitted: true },
  { forEachOf: 'telephone-visiteur', to: '198.51.100.80', proto: 'tcp', port: 443, permitted: true },
  { forEachOf: 'telephone-visiteur', to: 'nas', proto: 'tcp', port: 445, permitted: false },
  { forEachOf: 'telephone-visiteur', to: 'camera-entree', proto: 'tcp', port: 554, permitted: false },
  { forEachOf: 'camera-entree', to: '203.0.113.50', proto: 'tcp', port: 443, permitted: false },
];
const permitted = (r: Result) => FLUX.find((x) => x.forEachOf === r.flux.forEachOf && x.to === r.flux.to)!.permitted;
// An exchange with the internet (an address), not with a device on the local network (a name).
const internet = (r: Result) => isIp(r.flux.to);

const compliant = (rs: Result[]) => rs.every((r) => (permitted(r) ? r.state === 'ok' : r.state === 'blocked'));

// ssh from the administration computer to the router (input chain), for a new connection.
export const openSsh = (r: Ruleset) =>
  traverse(r, 'input', 'filter', {
    iif: 'eth0',
    oif: '',
    saddr: WORKSTATION.address,
    daddr: '192.0.2.21',
    proto: 'tcp',
    sport: 52814,
    dport: 22,
    ct: 'new',
    size: 60,
  }).pass;

const now = (j: Game) => compliant(results(j)) && openSsh(nft(j));
// At the next boot: the sysctl files, /etc/nftables.conf if nftables.service is enabled.
const toReboot = (j: Game) => {
  const l = lan(j)!;
  const active = !!systemd(j)?.services.nftables?.active;
  const rs = (active && toBoot(j)) || { tables: [] };
  const transfer = sysctlToBoot(j, 'net.ipv4.ip_forward', '0') === '1';
  return compliant(FLUX.map((x) => attempt(l, rs, transfer, x))) && openSsh(rs);
};

export const zones: Chapter = {
  id: 'zones',
  number: 3,
  plan: hivePlan(),
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
    'echo',
    'tee',
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
  ],
  home: M,
  welcome: 'email_malik.txt',
  names: true,
  final: 'end',
  password: PASSWORD,
  accounts: hiveAccounts,
  state: () => ({ lan: { ...newLan(true), flux: FLUX.map(({ permitted: _, ...x }) => x) }, systemd: hiveSystemd(), nft: { tables: [] } }),
  initialise: initialiseHive,
  createWorld: (t) =>
    hiveWorld({
      interfaces: INTERFACES_VLAN,
      dnsmasq: DNSMASQ_VLAN,
      home: { 'email_malik.txt': f(t('zones-email-malik')), 'notes-from-sacha.txt': f(t('zones-notes-sacha'), { lines: true }) },
    }),
  events: [
    {
      id: 'without-translation',
      condition: (j) => routing(j) && results(j).some((r) => permitted(r) && internet(r) && r.state === 'no-response' && !r.translated),
      message: (j) => j.t('zones-event-without-translation'),
    },
    {
      id: 'responses',
      condition: (j) => results(j).some((r) => permitted(r) && r.state === 'no-response' && (!internet(r) || !!r.translated)),
      message: (j) => j.t('zones-event-responses'),
    },
    {
      id: 'all-open',
      condition: (j) => {
        const rs = results(j);
        return rs.filter((r) => permitted(r) && internet(r)).every((r) => r.state === 'ok') && rs.some((r) => !permitted(r) && r.state !== 'blocked');
      },
      message: (j) => j.t('zones-event-all-open'),
    },
    { id: 'ssh', condition: (j) => !openSsh(nft(j)), message: (j) => j.t('zones-event-ssh') },
    { id: 'in-place', condition: (j) => now(j) && !toReboot(j), message: (j) => j.t('zones-event-in-place') },
    { id: 'end', condition: (j) => now(j) && toReboot(j), message: (j) => j.t('zones-event-end') },
  ],
};
