// Histoire « La Ruche » — chapitre « L'Annexe » : La Ruche ouvre un second
// lieu, l'Annexe, dans un ancien atelier de l'autre côté de la ville. Son
// routeur (Debian aussi, derrière la box de son fournisseur) a son réseau,
// 10.20.10.0/24. Sami, bénévole là-bas, a créé ses clés ; il faut relier les
// deux sites par le VPN WireGuard qui sert déjà au télétravail de Malik :
//   - un [Peer] de plus dans /etc/wireguard/wg0.conf : la clé publique de
//     l'Annexe, et ses AllowedIPs : son adresse dans le tunnel ET tout son
//     réseau (pour WireGuard, ce sont les adresses d'où ce pair a le droit
//     d'envoyer, et celles qu'on lui envoie : wg-quick en fait des routes) ;
//   - relancer wg0 (wg-quick ne relit pas le fichier tout seul) ;
//   - compléter annexe-wg0.conf : la clé publique du routeur, l'Endpoint,
//     AllowedIPs = le réseau des bureaux, et PersistentKeepalive : derrière
//     une box, le routeur de La Ruche ne peut pas joindre l'Annexe si elle ne
//     garde pas le passage ouvert.
// Objectif vérifié sur l'état : un poste de l'Annexe joint le NAS, un poste
// des bureaux imprime à l'Annexe, l'Annexe ne voit pas les caméras, Malik
// joint toujours le NAS, maintenant ET au prochain démarrage.
// Sources : https://www.wireguard.com/#cryptokey-routing,
// https://man7.org/linux/man-pages/man8/wg.8.html (PersistentKeepalive),
// https://man7.org/linux/man-pages/man8/wg-quick.8.html (routes)

import { f, type Chapitre } from '../monde';
import type { Jeu } from '../shell';
import type { Shell } from '../shell';
import { adresseDe, lan } from '../lan';
import { auDemarrage, nft } from '../nftables';
import { sysctlAuDemarrage } from '../commandes/nftables';
import { publicDu, serviceWg } from '../commandes/wireguard';
import {
  confDe,
  etatTunnel,
  etatVersDistant,
  lireConfWg,
  monterWg,
  publique,
  wg,
  type Distant,
  type EtatTunnel,
  type InterfaceWg,
} from '../wireguard';
import { systemd } from '../systemd';
import { sshOuvert } from './zones';
import { FLUX_DMZ } from './dmz';
import { MALIK, PUBLIQUE_MALIK } from './vpn';
import {
  comptesRuche,
  DNSMASQ_VLAN,
  initialiserPareFeu,
  INTERFACES_DMZ,
  M,
  mondeRuche,
  MOT_DE_PASSE,
  NFTABLES_DMZ,
  lanAvecDmz,
  SYSCTL_ROUTEUR,
  systemdRuche,
  planRuche,
} from './ruche';

// La clé privée du routeur de La Ruche (créée au chapitre « Le télétravail »), et celle du routeur de l'Annexe (elle ne quitte pas l'Annexe).
const CLE_ROUTEUR = '2H8lWIAEPk9kEtfgQW8ZQVaCUVKhwmA1PDgxbjXZqXk=';
const CLE_ANNEXE = 'cDqmuXhcmm7LqTLk8TNfgPuG1GqnfxHaU2D7OWNw11U=';
export const PUBLIQUE_ROUTEUR = publique(CLE_ROUTEUR)!;
export const PUBLIQUE_ANNEXE = publique(CLE_ANNEXE)!;
const CONF_ANNEXE = `${M}/annexe-wg0.conf`;

// Le routeur de l'Annexe : un poste de là-bas (10.20.10.15) va au NAS.
export const ANNEXE: Distant = {
  nom: 'annexe',
  adresse: '203.0.113.60',
  cle: PUBLIQUE_ANNEXE,
  conf: CONF_ANNEXE,
  vers: '10.10.10.5',
  port: 445,
  reseau: '10.20.10.0/24',
  source: '10.20.10.15',
  derriereNat: true,
};
const IMPRIMANTE_ANNEXE = '10.20.10.20';

export const WG0 = `[Interface]
Address = 10.10.99.1/24
ListenPort = 51820
PrivateKey = ${CLE_ROUTEUR}

# Malik (laptop)
[Peer]
PublicKey = ${PUBLIQUE_MALIK}
AllowedIPs = 10.10.99.2/32`;

export const PORTABLE_MALIK = `[Interface]
Address = 10.10.99.2/32

[Peer]
PublicKey = ${PUBLIQUE_ROUTEUR}
Endpoint = ruche.example:51820
AllowedIPs = 10.10.10.0/24`;

/** wg0.conf à la fin de « L'Annexe » : Malik et le routeur de l'Annexe. */
export const WG0_ANNEXE = `${WG0}

# Annexe
[Peer]
PublicKey = ${PUBLIQUE_ANNEXE}
AllowedIPs = 10.10.99.3/32, 10.20.10.0/24`;

type O = { interfaces?: Record<string, InterfaceWg>; ruleset?: ReturnType<typeof nft>; transfert?: boolean };
const publicDe = (j: Jeu) => publicDu(j as Shell);

// L'adresse d'un poste des bureaux (son bail DHCP).
const posteBureaux = (j: Jeu) => {
  const a = lan(j)?.appareils.find((x) => x.nom === 'poste-malik');
  return (a && adresseDe(a)) ?? '10.10.10.150';
};

const versNas = (j: Jeu, o: O = {}) => etatTunnel(j, ANNEXE, { ...publicDe(j), ...o }).etat;
const versImprimante = (j: Jeu, o: O = {}) => etatVersDistant(j, ANNEXE, posteBureaux(j), IMPRIMANTE_ANNEXE, 631, { ...publicDe(j), ...o }).etat;
const versCamera = (j: Jeu, o: O = {}) => etatTunnel(j, { ...ANNEXE, vers: '10.10.30.11', port: 554 }, { ...publicDe(j), ...o }).etat;
const malik = (j: Jeu, o: O = {}) => etatTunnel(j, MALIK, { ...publicDe(j), ...o }).etat;

const conforme = (j: Jeu, o: O = {}) => versNas(j, o) === 'ok' && versImprimante(j, o) === 'ok' && versCamera(j, o) !== 'ok' && malik(j, o) === 'ok';

// Au prochain démarrage : les wg-quick@ activés (leurs fichiers), nftables, les fichiers sysctl.
function auRedemarrage(j: Jeu): O {
  const sd = systemd(j);
  const interfaces: Record<string, InterfaceWg> = {};
  for (const [nom, s] of Object.entries(sd?.services ?? {})) {
    const m = /^wg-quick@(.+)$/.exec(nom);
    const texte = m && s.active ? j.lire(confDe(m[1])) : null;
    if (!m || texte === null) continue;
    const c = lireConfWg(texte);
    if (!c.erreurs.length) interfaces[m[1]] = { conf: c, parService: true };
  }
  return {
    interfaces,
    ruleset: (sd?.services.nftables?.active && auDemarrage(j)) || { tables: [] },
    transfert: sysctlAuDemarrage(j, 'net.ipv4.ip_forward', '0') === '1',
  };
}

// Le fichier a un pair pour l'Annexe, mais wg0 tourne encore avec l'ancien.
const pasRelu = (j: Jeu) => {
  const fichier = lireConfWg(j.lire(confDe('wg0')) ?? '');
  const enMarche = wg(j).wg0?.conf;
  return fichier.pairs.some((p) => p.cle === PUBLIQUE_ANNEXE) && !enMarche?.pairs.some((p) => p.cle === PUBLIQUE_ANNEXE);
};

const poigneeRatee = (e: EtatTunnel) => ['conf', 'adresse', 'filtre', 'cle-routeur', 'inconnu'].includes(e);

export const annexe: Chapitre = {
  id: 'annexe',
  numero: 6,
  plan: planRuche({ teletravail: true, dmz: true, annexe: true }),
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
    'ping',
    'systemctl',
    'journalctl',
    'reboot',
    'sysctl',
    'nft',
    'conntrack',
    'wg',
    'wg-quick',
  ],
  maison: M,
  accueil: 'courriel_sami.txt',
  noms: true,
  final: 'fin',
  motDePasse: MOT_DE_PASSE,
  comptes: comptesRuche,
  etat: () => {
    const sd = systemdRuche({ 'wg-quick@wg0': serviceWg('wg0') });
    for (const nom of ['nftables', 'wg-quick@wg0']) Object.assign(sd.services[nom], { active: true, etat: 'active' });
    const l = lanAvecDmz();
    return { lan: { ...l, flux: FLUX_DMZ.map(({ permis: _, ...x }) => x), distants: [MALIK, ANNEXE] }, systemd: sd, nft: { tables: [] }, wg: {} };
  },
  initialiser: (j) => {
    initialiserPareFeu(j);
    monterWg(j, 'wg0', true);
  },
  creerMonde: (t) =>
    mondeRuche({
      interfaces: INTERFACES_DMZ,
      dnsmasq: DNSMASQ_VLAN,
      nftables: NFTABLES_DMZ,
      sysctl: SYSCTL_ROUTEUR,
      etc: {
        wireguard: {
          type: 'dossier',
          enfants: { 'wg0.conf': f(WG0, { lignes: true, proprio: 'root', mode: 'rw-------' }) },
          proprio: 'root',
          mode: 'rwx------',
        },
      },
      maison: {
        'courriel_sami.txt': f(t('annexe-courriel-sami', { cle: PUBLIQUE_ANNEXE })),
        'annexe-wg0.conf': f(t('annexe-conf'), { lignes: true }),
        'portable-malik.conf': f(PORTABLE_MALIK, { lignes: true }),
      },
    }),
  evenements: [
    { id: 'pas-relu', condition: pasRelu, message: (j) => j.t('annexe-evenement-pas-relu') },
    {
      id: 'poignee',
      condition: (j) => !pasRelu(j) && !!wg(j).wg0?.conf.pairs.some((p) => p.cle === PUBLIQUE_ANNEXE) && poigneeRatee(versNas(j)),
      message: (j) => j.t('annexe-evenement-poignee'),
    },
    { id: 'autorisees', condition: (j) => versNas(j) === 'autorisees', message: (j) => j.t('annexe-evenement-autorisees') },
    { id: 'route', condition: (j) => versNas(j) === 'route', message: (j) => j.t('annexe-evenement-route') },
    { id: 'endormi', condition: (j) => versNas(j) === 'ok' && versImprimante(j) === 'endormi', message: (j) => j.t('annexe-evenement-endormi') },
    { id: 'cameras', condition: (j) => versCamera(j) === 'ok', message: (j) => j.t('annexe-evenement-cameras') },
    { id: 'malik', condition: (j) => !!wg(j).wg0 && malik(j) !== 'ok', message: (j) => j.t('annexe-evenement-malik') },
    { id: 'ssh', condition: (j) => !sshOuvert(nft(j)), message: (j) => j.t('zones-evenement-ssh') },
    { id: 'en-place', condition: (j) => conforme(j) && !conforme(j, auRedemarrage(j)), message: (j) => j.t('annexe-evenement-en-place') },
    { id: 'fin', condition: (j) => conforme(j) && sshOuvert(nft(j)) && conforme(j, auRedemarrage(j)), message: (j) => j.t('annexe-evenement-fin') },
  ],
};
