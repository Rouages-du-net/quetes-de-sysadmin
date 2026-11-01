// Story "The Hive" — chapter "VLANs": the electrician split the network into
// three VLANs on the switch (offices, guests, equipment), with a trunk port
// to the router. Since then, nothing works: the router still talks flat
// (without an 802.1Q tag, so on the native VLAN, where nobody is left).
//   - create one interface per VLAN on eth1 (ip link add … type vlan id …),
//     with the router's address in each network;
//   - write it in /etc/network/interfaces (eth1.10, eth1.20, eth1.30),
//     so that it holds at the next boot, and ifup.
// Objective checked on the state: for each VLAN, an interface up on eth1
// with the right number and the .1 address of its network, AND the same
// thing in /etc/network/interfaces (auto, static).
// Sources: https://manpages.debian.org/trixie/vlan/vlan-interfaces.5.en.html,
// https://man7.org/linux/man-pages/man8/ip-link.8.html, IEEE 802.1Q

import { f, type Chapter } from '../world';
import type { Game } from '../shell';
import { inService, lan, readInterfaces, vlanFor } from '../lan';
import { hiveAccounts, initialiseHive, FLAT_A_INTERFACES, M, hiveWorld, PASSWORD, newLan, hiveSystemd, VLANS, hivePlan } from './hive';

const FLAT_A_DNSMASQ = `# The DHCP server of the LAN
interface=eth1
dhcp-range=192.168.1.100,192.168.1.200,12h`;

// Right now: the VLAN's interface up, with the router's address.
const inPlace = (j: Game, v: (typeof VLANS)[number]) => {
  const l = lan(j)!;
  return Object.values(l.interfaces).some((i) => inService(l, i) && vlanFor(l, i) === v.id && i.addresses.includes(v.routeur));
};
// In the file: an auto, static stanza, on eth1, with the right number and the right address.
const written = (j: Game, v: (typeof VLANS)[number]) =>
  Object.values(readInterfaces(j).stanzas).some(
    (s) => s.auto && s.method === 'static' && s.vlan?.parent === 'eth1' && s.vlan.id === v.id && s.address === v.routeur,
  );
// A VLAN interface whose address belongs to another number (10.10.30.1 on VLAN 3…).
const badNumber = (j: Game) => {
  const l = lan(j)!;
  return Object.values(l.interfaces).some((i) => i.vlan && VLANS.some((v) => i.addresses.includes(v.routeur) && i.vlan!.id !== v.id));
};
const allInPlace = (j: Game) => VLANS.every((v) => inPlace(j, v));
const allWritten = (j: Game) => VLANS.every((v) => written(j, v));

export const vlan: Chapter = {
  id: 'vlan',
  number: 1,
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
    'sudo',
    'id',
    'whoami',
    'ip',
    'ifup',
    'ifdown',
    'ping',
    'systemctl',
    'journalctl',
  ],
  home: M,
  welcome: 'email_malik.txt',
  names: true,
  final: 'end',
  password: PASSWORD,
  accounts: hiveAccounts,
  state: (t) => ({ lan: newLan(t, false), systemd: hiveSystemd() }),
  initialise: initialiseHive,
  createWorld: (t) =>
    hiveWorld({
      interfaces: FLAT_A_INTERFACES,
      dnsmasq: FLAT_A_DNSMASQ,
      home: { 'email_malik.txt': f(t('vlan-email-malik')), 'switch-plan.txt': f(t('vlan-plan-switch'), { lines: true }) },
    }),
  events: [
    { id: 'bad-number', condition: badNumber, message: (j) => j.t('vlan-event-bad-number') },
    { id: 'in-place', condition: (j) => allInPlace(j) && !allWritten(j), message: (j) => j.t('vlan-event-in-place') },
    { id: 'end', condition: (j) => allInPlace(j) && allWritten(j), message: (j) => j.t('vlan-event-end') },
  ],
};
