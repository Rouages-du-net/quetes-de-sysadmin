// Histoire « La Ruche » — chapitre « Les zones » : chaque VLAN a ses
// adresses, mais rien ne sort. Le routeur ne transmet pas les paquets
// (net.ipv4.ip_forward = 0), et personne ne traduit les adresses privées
// (NAT). L'ancien bénévole l'avait fait à la main, sans l'écrire nulle part :
// tout est parti au redémarrage. Et Malik veut des zones :
//   - les bureaux (VLAN 10) vont partout : internet, l'imprimante ;
//   - les invité·es (VLAN 20) : internet, et rien d'autre (ni le NAS, ni les caméras) ;
//   - les équipements (VLAN 30) : rien vers internet (les caméras « appellent
//     la maison » chez leur fabricant), mais le NAS enregistre les caméras.
// À faire : sysctl (et /etc/sysctl.d pour que ça dure), une chaîne forward
// en politique drop avec ct state established,related, une chaîne nat avec
// masquerade sur eth0, dans /etc/nftables.conf, et nftables activé.
// Objectif vérifié sur l'état : le trafic simulé des appareils (Lan.flux)
// passe ou est bloqué comme prévu, maintenant ET avec ce qui serait chargé
// au démarrage (fichiers sysctl, /etc/nftables.conf, service activé), sans
// fermer ssh au poste d'administration.
// Sources : https://wiki.nftables.org/wiki-nftables/index.php/Performing_Network_Address_Translation_(NAT),
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

// Le trafic des appareils, et ce qui doit passer.
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
// Un échange vers internet (une adresse), et non vers un appareil du réseau local (un nom).
const internet = (r: Result) => isIp(r.flux.to);

const compliant = (rs: Result[]) => rs.every((r) => (permitted(r) ? r.state === 'ok' : r.state === 'bloque'));

// ssh depuis le poste d'administration vers le routeur (chaîne input), pour une nouvelle connexion.
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
// Au prochain démarrage : les fichiers sysctl, /etc/nftables.conf si nftables.service est activé.
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
  welcome: 'courriel_malik.txt',
  names: true,
  final: 'fin',
  password: PASSWORD,
  accounts: hiveAccounts,
  state: () => ({ lan: { ...newLan(true), flux: FLUX.map(({ permitted: _, ...x }) => x) }, systemd: hiveSystemd(), nft: { tables: [] } }),
  initialise: initialiseHive,
  createWorld: (t) =>
    hiveWorld({
      interfaces: INTERFACES_VLAN,
      dnsmasq: DNSMASQ_VLAN,
      home: { 'courriel_malik.txt': f(t('zones-courriel-malik')), 'notes-de-sacha.txt': f(t('zones-notes-sacha'), { lines: true }) },
    }),
  events: [
    {
      id: 'sans-traduction',
      condition: (j) => routing(j) && results(j).some((r) => permitted(r) && internet(r) && r.state === 'sans-reponse' && !r.translated),
      message: (j) => j.t('zones-evenement-sans-traduction'),
    },
    {
      id: 'reponses',
      condition: (j) => results(j).some((r) => permitted(r) && r.state === 'sans-reponse' && (!internet(r) || !!r.translated)),
      message: (j) => j.t('zones-evenement-reponses'),
    },
    {
      id: 'tout-ouvert',
      condition: (j) => {
        const rs = results(j);
        return rs.filter((r) => permitted(r) && internet(r)).every((r) => r.state === 'ok') && rs.some((r) => !permitted(r) && r.state !== 'bloque');
      },
      message: (j) => j.t('zones-evenement-tout-ouvert'),
    },
    { id: 'ssh', condition: (j) => !openSsh(nft(j)), message: (j) => j.t('zones-evenement-ssh') },
    { id: 'en-place', condition: (j) => now(j) && !toReboot(j), message: (j) => j.t('zones-evenement-en-place') },
    { id: 'fin', condition: (j) => now(j) && toReboot(j), message: (j) => j.t('zones-evenement-fin') },
  ],
};
