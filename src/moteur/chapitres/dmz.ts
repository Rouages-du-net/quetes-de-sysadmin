// Histoire « La Ruche » — chapitre « La DMZ » : La Ruche héberge elle-même
// son site de réservation des salles, sur un petit serveur (web). Inès,
// bénévole, l'a installé et branché sur le port 21 du commutateur, que
// l'électricien a mis dans un nouveau VLAN 40, la DMZ. Il faut :
//   - l'interface eth1.40 du routeur (10.10.40.1/24), dans le fichier ;
//   - une traduction de destination (dnat, chaîne nat au hook prerouting) :
//     ce qui arrive sur eth0 en TCP 80 et 443 part vers 10.10.40.10 ;
//   - la chaîne forward : internet → le serveur, sur ces ports-là seulement
//     (la règle voit l'adresse APRÈS traduction), et le serveur → internet
//     (ses mises à jour) ; mais rien du serveur vers le réseau interne : s'il
//     est piraté, il ne doit rien voir d'autre.
// Objectif vérifié sur l'état : le trafic simulé (internet vers le site,
// le serveur vers ses mises à jour et vers le NAS, les bureaux vers le
// serveur, et les zones du chapitre 3) passe ou est bloqué comme prévu,
// maintenant ET au prochain démarrage (interfaces, nftables), ssh restant
// ouvert au poste d'administration.
// Sources : https://wiki.nftables.org/wiki-nftables/index.php/Performing_Network_Address_Translation_(NAT),
// https://wiki.nftables.org/wiki-nftables/index.php/Netfilter_hooks

import { f, type Chapitre } from '../monde';
import type { Jeu } from '../shell';
import { lan, reseauAuDemarrage } from '../lan';
import { auDemarrage, essayer, nft, resultats, routage, type Flux, type Resultat } from '../nftables';
import { sysctlAuDemarrage } from '../commandes/nftables';
import { systemd } from '../systemd';
import { FLUX, sshOuvert } from './zones';
import {
  comptesRuche,
  DNSMASQ_VLAN,
  initialiserPareFeu,
  INTERFACES_VLAN,
  M,
  mondeRuche,
  MOT_DE_PASSE,
  NFTABLES_TELETRAVAIL,
  lanAvecDmz,
  SYSCTL_ROUTEUR,
  systemdRuche,
} from './ruche';

export const PUBLIQUE = '192.0.2.21';
const VISITEUR = '203.0.113.77';

// Le trafic de la DMZ, et ce qui doit passer ; les zones du chapitre 3 restent vraies.
export const FLUX_DMZ: (Flux & { permis: boolean })[] = [
  ...FLUX,
  { de: VISITEUR, vers: PUBLIQUE, proto: 'tcp', port: 443, permis: true },
  { de: VISITEUR, vers: PUBLIQUE, proto: 'tcp', port: 80, permis: true },
  { de: VISITEUR, vers: PUBLIQUE, proto: 'tcp', port: 22, permis: false },
  { de: 'web', vers: '198.51.100.80', proto: 'tcp', port: 443, permis: true },
  { de: 'poste-malik', vers: 'web', proto: 'tcp', port: 22, permis: true },
  { de: 'web', vers: 'nas', proto: 'tcp', port: 445, permis: false },
  { de: 'web', vers: 'imprimante', proto: 'tcp', port: 631, permis: false },
];
const permis = (r: Resultat) => FLUX_DMZ.find((x) => x.de === r.flux.de && x.vers === r.flux.vers && x.port === r.flux.port)!.permis;
// Ce qui est interdit doit être jeté (ou impossible : le serveur n'a pas encore de réseau).
const refuse = (r: Resultat) => r.etat === 'bloque' || r.etat === 'impossible';
const conforme = (rs: Resultat[]) => rs.every((r) => (permis(r) ? r.etat === 'ok' : refuse(r)));
const duSite = (r: Resultat) => r.flux.de === VISITEUR && r.flux.port !== 22;

const maintenant = (j: Jeu) => conforme(resultats(j)) && sshOuvert(nft(j));
const auRedemarrage = (j: Jeu) => {
  const l = reseauAuDemarrage(j)!;
  const rs = (systemd(j)?.services.nftables?.active && auDemarrage(j)) || { tables: [] };
  const transfert = sysctlAuDemarrage(j, 'net.ipv4.ip_forward', '0') === '1';
  return conforme(FLUX_DMZ.map((x) => essayer(l, rs, transfert, x))) && sshOuvert(rs);
};

// Une règle de la chaîne forward qui attend l'adresse publique : elle ne verra jamais rien, le dnat a déjà eu lieu.
const attendLaPublique = (j: Jeu) =>
  nft(j).tables.some((t) =>
    t.chaines.some(
      (c) => c.base?.hook === 'forward' && c.regles.some((r) => r.conditions.some((x) => x.champ === 'ip daddr' && x.valeurs.includes(PUBLIQUE))),
    ),
  );

export const dmz: Chapitre = {
  id: 'dmz',
  numero: 5,
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
    'reboot',
    'sysctl',
    'nft',
    'conntrack',
  ],
  maison: M,
  accueil: 'courriel_ines.txt',
  final: 'fin',
  motDePasse: MOT_DE_PASSE,
  comptes: comptesRuche,
  etat: () => {
    const sd = systemdRuche();
    sd.services.nftables.active = true;
    sd.services.nftables.etat = 'active';
    const l = lanAvecDmz();
    return { lan: { ...l, flux: FLUX_DMZ.map(({ permis: _, ...x }) => x) }, systemd: sd, nft: { tables: [] } };
  },
  initialiser: initialiserPareFeu,
  creerMonde: (t) =>
    mondeRuche({
      interfaces: INTERFACES_VLAN,
      dnsmasq: DNSMASQ_VLAN,
      nftables: NFTABLES_TELETRAVAIL,
      sysctl: SYSCTL_ROUTEUR,
      maison: { 'courriel_ines.txt': f(t('dmz-courriel-ines')), 'plan-commutateur.txt': f(t('dmz-plan-commutateur'), { lignes: true }) },
    }),
  evenements: [
    { id: 'adresse-publique', condition: attendLaPublique, message: (j) => j.t('dmz-evenement-adresse-publique', { adresse: PUBLIQUE }) },
    {
      id: 'sans-forward',
      condition: (j) => resultats(j).some((r) => duSite(r) && r.etat === 'bloque' && !!r.destination) && routage(j),
      message: (j) => j.t('dmz-evenement-sans-forward'),
    },
    {
      id: 'trop-ouvert',
      condition: (j) => resultats(j).some((r) => !permis(r) && !refuse(r) && (r.flux.de === 'web' || r.flux.de === VISITEUR)),
      message: (j) => j.t('dmz-evenement-trop-ouvert'),
    },
    { id: 'ssh', condition: (j) => !sshOuvert(nft(j)), message: (j) => j.t('zones-evenement-ssh') },
    { id: 'en-place', condition: (j) => maintenant(j) && !auRedemarrage(j), message: (j) => j.t('dmz-evenement-en-place') },
    { id: 'fin', condition: (j) => !!lan(j) && maintenant(j) && auRedemarrage(j), message: (j) => j.t('dmz-evenement-fin') },
  ],
};
