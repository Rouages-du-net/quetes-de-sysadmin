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

import { f, type Chapitre } from '../monde';
import type { Jeu } from '../shell';
import { enService, lan, lireInterfaces, vlanDe } from '../lan';
import { comptesRuche, initialiserRuche, INTERFACES_A_PLAT, M, mondeRuche, MOT_DE_PASSE, nouveauLan, systemdRuche, VLANS } from './ruche';

const DNSMASQ_A_PLAT = `# The DHCP server of the LAN
interface=eth1
dhcp-range=192.168.1.100,192.168.1.200,12h`;

// En ce moment : l'interface montée du VLAN, avec l'adresse du routeur.
const enPlace = (j: Jeu, v: (typeof VLANS)[number]) => {
  const l = lan(j)!;
  return Object.values(l.interfaces).some((i) => enService(l, i) && vlanDe(l, i) === v.id && i.adresses.includes(v.routeur));
};
// Dans le fichier : une strophe auto, static, sur eth1, avec le bon numéro et la bonne adresse.
const ecrit = (j: Jeu, v: (typeof VLANS)[number]) =>
  Object.values(lireInterfaces(j).strophes).some(
    (s) => s.auto && s.methode === 'static' && s.vlan?.parent === 'eth1' && s.vlan.id === v.id && s.adresse === v.routeur,
  );
// Une interface VLAN dont l'adresse est celle d'un autre numéro (10.10.30.1 sur le VLAN 3…).
const mauvaisNumero = (j: Jeu) => {
  const l = lan(j)!;
  return Object.values(l.interfaces).some((i) => i.vlan && VLANS.some((v) => i.adresses.includes(v.routeur) && i.vlan!.id !== v.id));
};
const tousEnPlace = (j: Jeu) => VLANS.every((v) => enPlace(j, v));
const tousEcrits = (j: Jeu) => VLANS.every((v) => ecrit(j, v));

export const vlan: Chapitre = {
  id: 'vlan',
  numero: 1,
  commandes: [
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
  maison: M,
  accueil: 'courriel_malik.txt',
  noms: true,
  final: 'fin',
  motDePasse: MOT_DE_PASSE,
  comptes: comptesRuche,
  etat: () => ({ lan: nouveauLan(false), systemd: systemdRuche() }),
  initialiser: initialiserRuche,
  creerMonde: (t) =>
    mondeRuche({
      interfaces: INTERFACES_A_PLAT,
      dnsmasq: DNSMASQ_A_PLAT,
      maison: { 'courriel_malik.txt': f(t('vlan-courriel-malik')), 'plan-commutateur.txt': f(t('vlan-plan-commutateur'), { lignes: true }) },
    }),
  evenements: [
    { id: 'mauvais-numero', condition: mauvaisNumero, message: (j) => j.t('vlan-evenement-mauvais-numero') },
    { id: 'en-place', condition: (j) => tousEnPlace(j) && !tousEcrits(j), message: (j) => j.t('vlan-evenement-en-place') },
    { id: 'fin', condition: (j) => tousEnPlace(j) && tousEcrits(j), message: (j) => j.t('vlan-evenement-fin') },
  ],
};
