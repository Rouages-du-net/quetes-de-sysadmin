// Story "The Hive", chapter "DHCP": the VLANs are there, but the
// computers and phones no longer get an address: dnsmasq still serves
// the old flat network (interface=eth1, 192.168.1.x). The new
// printer must keep 10.10.30.10 (every workstation has it configured).
//   - one range per VLAN (dhcp-range), in each interface's network;
//   - dnsmasq must listen on the VLANs (interface=eth1.10…, or eth1*), and
//     above all not on eth0, the ISP's network;
//   - a reservation for the printer (dhcp-host=MAC,name,address);
//   - dnsmasq --test, then systemctl restart dnsmasq.
// Objective checked on the state: each DHCP device got an address
// in its VLAN's network, the printer its own, and dnsmasq doesn't listen on
// eth0.
// Sources: https://dnsmasq.org/docs/dnsmasq-man.html

import { f, type Chapter } from '../world';
import type { Game } from '../shell';
import { inside, lan } from '../lan';
import { answersOn } from '../dnsmasq';
import { hiveAccounts, initialiseHive, INTERFACES_VLAN, M, hiveWorld, PASSWORD, newLan, hiveSystemd, VLANS, hivePlan } from './hive';

const FLAT_A_DNSMASQ = `# The DHCP server of the LAN
interface=eth1
dhcp-range=192.168.1.100,192.168.1.200,12h`;
const PRINTER = '10.10.30.10';

const inDhcp = (j: Game) => lan(j)!.devices.filter((a) => !a.fixed);
const servedWell = (j: Game) =>
  inDhcp(j).every((a) => a.lease && inside(a.lease, VLANS.find((v) => v.id === a.vlan)!.network)) &&
  lan(j)!.devices.find((a) => a.name === 'imprimante')?.lease === PRINTER;

export const dhcp: Chapter = {
  id: 'dhcp',
  number: 2,
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
    'dnsmasq',
  ],
  home: M,
  welcome: 'email_malik.txt',
  names: true,
  final: 'end',
  password: PASSWORD,
  accounts: hiveAccounts,
  state: () => ({ lan: newLan(true), systemd: hiveSystemd() }),
  initialise: initialiseHive,
  createWorld: (t) =>
    hiveWorld({ interfaces: INTERFACES_VLAN, dnsmasq: FLAT_A_DNSMASQ, home: { 'email_malik.txt': f(t('dhcp-email-malik')) } }),
  events: [
    { id: 'wan', condition: (j) => answersOn(j, 'eth0'), message: (j) => j.t('dhcp-event-wan') },
    {
      id: 'printer-elsewhere',
      condition: (j) => {
        const b = lan(j)!.devices.find((a) => a.name === 'imprimante')?.lease;
        return !!b && b !== PRINTER;
      },
      message: (j) => j.t('dhcp-event-printer-elsewhere', { address: PRINTER }),
    },
    { id: 'end', condition: (j) => servedWell(j) && !answersOn(j, 'eth0'), message: (j) => j.t('dhcp-event-end') },
  ],
};
