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

import { f, type Chapitre } from '../monde';
import type { Jeu } from '../shell';
import { estIp, lan } from '../lan';
import { auDemarrage, essayer, nft, resultats, routage, traverser, type Flux, type Resultat, type Ruleset } from '../nftables';
import { sysctlAuDemarrage } from '../commandes/nftables';
import { systemd } from '../systemd';
import { POSTE } from '../machines';
import { comptesRuche, DNSMASQ_VLAN, initialiserRuche, INTERFACES_VLAN, M, mondeRuche, MOT_DE_PASSE, nouveauLan, systemdRuche } from './ruche';

// Le trafic des appareils, et ce qui doit passer.
export const FLUX: (Flux & { permis: boolean })[] = [
  { de: 'poste-malik', vers: '198.51.100.80', proto: 'tcp', port: 443, permis: true },
  { de: 'poste-accueil', vers: 'imprimante', proto: 'tcp', port: 631, permis: true },
  { de: 'nas', vers: 'camera-entree', proto: 'tcp', port: 554, permis: true },
  { de: 'telephone-visiteur', vers: '198.51.100.80', proto: 'tcp', port: 443, permis: true },
  { de: 'telephone-visiteur', vers: 'nas', proto: 'tcp', port: 445, permis: false },
  { de: 'telephone-visiteur', vers: 'camera-entree', proto: 'tcp', port: 554, permis: false },
  { de: 'camera-entree', vers: '203.0.113.50', proto: 'tcp', port: 443, permis: false },
];
const permis = (r: Resultat) => FLUX.find((x) => x.de === r.flux.de && x.vers === r.flux.vers)!.permis;
// Un échange vers internet (une adresse), et non vers un appareil du réseau local (un nom).
const internet = (r: Resultat) => estIp(r.flux.vers);

const conforme = (rs: Resultat[]) => rs.every((r) => (permis(r) ? r.etat === 'ok' : r.etat === 'bloque'));

// ssh depuis le poste d'administration vers le routeur (chaîne input), pour une nouvelle connexion.
const sshOuvert = (r: Ruleset) =>
  traverser(r, 'input', 'filter', {
    iif: 'eth0',
    oif: '',
    saddr: POSTE.adresse,
    daddr: '192.0.2.21',
    proto: 'tcp',
    sport: 52814,
    dport: 22,
    ct: 'new',
    taille: 60,
  }).passe;

const maintenant = (j: Jeu) => conforme(resultats(j)) && sshOuvert(nft(j));
// Au prochain démarrage : les fichiers sysctl, /etc/nftables.conf si nftables.service est activé.
const auRedemarrage = (j: Jeu) => {
  const l = lan(j)!;
  const active = !!systemd(j)?.services.nftables?.active;
  const rs = (active && auDemarrage(j)) || { tables: [] };
  const transfert = sysctlAuDemarrage(j, 'net.ipv4.ip_forward', '0') === '1';
  return conforme(FLUX.map((x) => essayer(l, rs, transfert, x))) && sshOuvert(rs);
};

export const zones: Chapitre = {
  id: 'zones',
  numero: 3,
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
  maison: M,
  accueil: 'courriel_malik.txt',
  final: 'fin',
  motDePasse: MOT_DE_PASSE,
  comptes: comptesRuche,
  etat: () => ({ lan: { ...nouveauLan(true), flux: FLUX.map(({ permis: _, ...x }) => x) }, systemd: systemdRuche(), nft: { tables: [] } }),
  initialiser: initialiserRuche,
  creerMonde: (t) =>
    mondeRuche({
      interfaces: INTERFACES_VLAN,
      dnsmasq: DNSMASQ_VLAN,
      maison: { 'courriel_malik.txt': f(t('zones-courriel-malik')), 'notes-de-sacha.txt': f(t('zones-notes-sacha'), { lignes: true }) },
    }),
  evenements: [
    {
      id: 'sans-traduction',
      condition: (j) => routage(j) && resultats(j).some((r) => permis(r) && internet(r) && r.etat === 'sans-reponse' && !r.traduite),
      message: (j) => j.t('zones-evenement-sans-traduction'),
    },
    {
      id: 'reponses',
      condition: (j) => resultats(j).some((r) => permis(r) && r.etat === 'sans-reponse' && (!internet(r) || !!r.traduite)),
      message: (j) => j.t('zones-evenement-reponses'),
    },
    {
      id: 'tout-ouvert',
      condition: (j) => {
        const rs = resultats(j);
        return rs.filter((r) => permis(r) && internet(r)).every((r) => r.etat === 'ok') && rs.some((r) => !permis(r) && r.etat !== 'bloque');
      },
      message: (j) => j.t('zones-evenement-tout-ouvert'),
    },
    { id: 'ssh', condition: (j) => !sshOuvert(nft(j)), message: (j) => j.t('zones-evenement-ssh') },
    { id: 'en-place', condition: (j) => maintenant(j) && !auRedemarrage(j), message: (j) => j.t('zones-evenement-en-place') },
    { id: 'fin', condition: (j) => maintenant(j) && auRedemarrage(j), message: (j) => j.t('zones-evenement-fin') },
  ],
};
