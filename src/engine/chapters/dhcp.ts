// Histoire « La Ruche » — chapitre « Le DHCP » : les VLAN sont là, mais les
// ordinateurs et les téléphones n'ont plus d'adresse : dnsmasq sert encore
// l'ancien réseau à plat (interface=eth1, 192.168.1.x). La nouvelle
// imprimante, elle, doit garder 10.10.30.10 (tous les postes l'ont configurée).
//   - une plage par VLAN (dhcp-range), dans le réseau de chaque interface ;
//   - dnsmasq doit écouter les VLAN (interface=eth1.10…, ou eth1*), et
//     surtout pas eth0, le réseau du fournisseur d'accès ;
//   - une réservation pour l'imprimante (dhcp-host=MAC,nom,adresse) ;
//   - dnsmasq --test, puis systemctl restart dnsmasq.
// Objectif vérifié sur l'état : chaque appareil en DHCP a reçu une adresse
// dans le réseau de son VLAN, l'imprimante la sienne, et dnsmasq n'écoute pas
// eth0.
// Sources : https://dnsmasq.org/docs/dnsmasq-man.html

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
  inDhcp(j).every((a) => a.lease && inside(a.lease, VLANS.find((v) => v.id === a.vlan)!.reseau)) &&
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
      message: (j) => j.t('dhcp-event-printer-elsewhere', { adresse: PRINTER }),
    },
    { id: 'end', condition: (j) => servedWell(j) && !answersOn(j, 'eth0'), message: (j) => j.t('dhcp-event-end') },
  ],
};
