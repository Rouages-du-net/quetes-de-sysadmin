// Histoire « La Ruche » — chapitre « Les VLAN » : l'électricien a découpé
// le réseau en trois VLAN sur le commutateur (bureaux, invité·es,
// équipements), avec un port trunk vers le routeur. Depuis, plus rien ne
// marche : le routeur parle encore à plat (sans étiquette 802.1Q, donc au
// VLAN natif, où il n'y a plus personne).
//   - créer une interface par VLAN sur eth1 (ip link add … type vlan id …),
//     avec l'adresse du routeur dans chaque réseau ;
//   - l'écrire dans /etc/network/interfaces (eth1.10, eth1.20, eth1.30),
//     pour que ça tienne au prochain démarrage, et ifup.
// Objectif vérifié sur l'état : pour chaque VLAN, une interface montée sur
// eth1 avec le bon numéro et l'adresse .1 de son réseau, ET la même chose
// dans /etc/network/interfaces (auto, static).
// Sources : https://manpages.debian.org/trixie/vlan/vlan-interfaces.5.en.html,
// https://man7.org/linux/man-pages/man8/ip-link.8.html, IEEE 802.1Q

import { f, type Chapter } from '../world';
import type { Game } from '../shell';
import { inService, lan, readInterfaces, vlanFor } from '../lan';
import { hiveAccounts, initialiseHive, FLAT_A_INTERFACES, M, hiveWorld, PASSWORD, newLan, hiveSystemd, VLANS, hivePlan } from './hive';

const FLAT_A_DNSMASQ = `# The DHCP server of the LAN
interface=eth1
dhcp-range=192.168.1.100,192.168.1.200,12h`;

// En ce moment : l'interface montée du VLAN, avec l'adresse du routeur.
const inPlace = (j: Game, v: (typeof VLANS)[number]) => {
  const l = lan(j)!;
  return Object.values(l.interfaces).some((i) => inService(l, i) && vlanFor(l, i) === v.id && i.addresses.includes(v.routeur));
};
// Dans le fichier : une strophe auto, static, sur eth1, avec le bon numéro et la bonne adresse.
const written = (j: Game, v: (typeof VLANS)[number]) =>
  Object.values(readInterfaces(j).stanzas).some(
    (s) => s.auto && s.method === 'static' && s.vlan?.parent === 'eth1' && s.vlan.id === v.id && s.address === v.routeur,
  );
// Une interface VLAN dont l'adresse est celle d'un autre numéro (10.10.30.1 sur le VLAN 3…).
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
  welcome: 'courriel_malik.txt',
  names: true,
  final: 'fin',
  password: PASSWORD,
  accounts: hiveAccounts,
  state: () => ({ lan: newLan(false), systemd: hiveSystemd() }),
  initialise: initialiseHive,
  createWorld: (t) =>
    hiveWorld({
      interfaces: FLAT_A_INTERFACES,
      dnsmasq: FLAT_A_DNSMASQ,
      home: { 'courriel_malik.txt': f(t('vlan-courriel-malik')), 'plan-commutateur.txt': f(t('vlan-plan-commutateur'), { lines: true }) },
    }),
  events: [
    { id: 'mauvais-numero', condition: badNumber, message: (j) => j.t('vlan-evenement-mauvais-numero') },
    { id: 'en-place', condition: (j) => allInPlace(j) && !allWritten(j), message: (j) => j.t('vlan-evenement-en-place') },
    { id: 'fin', condition: (j) => allInPlace(j) && allWritten(j), message: (j) => j.t('vlan-evenement-fin') },
  ],
};
