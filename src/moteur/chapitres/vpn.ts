// Histoire « La Ruche » — chapitre « Le télétravail » : Malik veut ouvrir
// les dossiers du NAS depuis chez lui. Surtout pas en ouvrant le partage de
// fichiers sur internet : un VPN WireGuard sur le routeur.
//   - des clés pour le routeur (wg genkey | tee … | wg pubkey), sans laisser
//     la clé privée lisible par tous (umask 077) ;
//   - /etc/wireguard/wg0.conf : [Interface] (Address, ListenPort, PrivateKey)
//     et un [Peer] pour le portable de Malik (sa clé publique, AllowedIPs) ;
//   - compléter portable-malik.conf : la clé publique du routeur, Endpoint,
//     AllowedIPs (le réseau des bureaux) ;
//   - ouvrir le port UDP dans la chaîne input, et wg0 → bureaux dans forward ;
//   - wg-quick up wg0, puis systemctl enable wg-quick@wg0.
// Objectif vérifié sur l'état : le portable de Malik (Lan.distants) fait sa
// poignée de main et joint le NAS, maintenant ET au prochain démarrage
// (service activé, fichiers), ssh reste ouvert au poste d'administration, et
// aucune copie de la clé privée du routeur n'est lisible par les autres comptes.
// Sources : https://www.wireguard.com/quickstart/, https://man7.org/linux/man-pages/man8/wg.8.html,
// https://man7.org/linux/man-pages/man8/wg-quick.8.html, https://wiki.debian.org/WireGuard

import { d, f, type Chapitre, type Dossier, type Noeud } from '../monde';
import type { Jeu } from '../shell';
import { auDemarrage, nft } from '../nftables';
import { sysctlAuDemarrage } from '../commandes/nftables';
import { publicDu, serviceWg } from '../commandes/wireguard';
import { confDe, etatTunnel, lireConfWg, publique, wg, type Distant, type EtatTunnel } from '../wireguard';
import { systemd } from '../systemd';
import type { Shell } from '../shell';
import { FLUX, sshOuvert } from './zones';
import {
  comptesRuche,
  DNSMASQ_VLAN,
  INTERFACES_VLAN,
  M,
  mondeRuche,
  MOT_DE_PASSE,
  initialiserPareFeu,
  NFTABLES_ZONES,
  nouveauLan,
  SYSCTL_ROUTEUR,
  systemdRuche,
  planRuche,
} from './ruche';

// La clé privée du portable de Malik (l'exemple de la documentation de WireGuard) : elle ne quitte jamais le portable.
const CLE_MALIK = 'yAnz5TF+lXXJte14tji3zlMNq+hd2rYUIgJBgB3fBmk=';
export const PUBLIQUE_MALIK = publique(CLE_MALIK)!;
const PORTABLE = `${M}/portable-malik.conf`;

export const MALIK: Distant = { nom: 'portable-malik', adresse: '198.51.100.23', cle: PUBLIQUE_MALIK, conf: PORTABLE, vers: '10.10.10.5', port: 445 };

const publicDe = (j: Jeu) => publicDu(j as Shell);
const maintenant = (j: Jeu) => etatTunnel(j, MALIK, publicDe(j));

// Au prochain démarrage : wg-quick@wg0 s'il est activé (le fichier), nftables s'il est activé, les fichiers sysctl.
function auRedemarrage(j: Jeu): EtatTunnel {
  const sd = systemd(j);
  const interfaces: Record<string, { conf: ReturnType<typeof lireConfWg>; parService: boolean }> = {};
  for (const [nom, s] of Object.entries(sd?.services ?? {})) {
    const m = /^wg-quick@(.+)$/.exec(nom);
    if (!m || !s.active) continue;
    const c = lireConfWg(j.lire(confDe(m[1])) ?? '');
    if (j.lire(confDe(m[1])) !== null && !c.erreurs.length) interfaces[m[1]] = { conf: c, parService: true };
  }
  const ruleset = (sd?.services.nftables?.active && auDemarrage(j)) || { tables: [] };
  const transfert = sysctlAuDemarrage(j, 'net.ipv4.ip_forward', '0') === '1';
  return etatTunnel(j, MALIK, { ...publicDe(j), interfaces, ruleset, transfert }).etat;
}
const sshAuRedemarrage = (j: Jeu) => sshOuvert((systemd(j)?.services.nftables?.active && auDemarrage(j)) || { tables: [] });

// Les clés privées en service (celles des fichiers de /etc/wireguard).
function clesPrivees(j: Jeu): string[] {
  const dossier = j.trouver('/etc/wireguard');
  if (dossier?.type !== 'dossier') return [];
  return Object.keys(dossier.enfants)
    .filter((n) => n.endsWith('.conf'))
    .map((n) => lireConfWg(j.lire(`/etc/wireguard/${n}`) ?? '').cle)
    .filter((c): c is string => !!c);
}

// Un fichier lisible par un compte quelconque (ni propriétaire, ni du groupe) : r pour les autres, et x sur chaque dossier du chemin.
const pourTous = (n: Noeud, droit: 'r' | 'x') => (n.mode ?? (n.type === 'dossier' ? 'rwxr-xr-x' : 'rw-r--r--'))[droit === 'r' ? 6 : 8] !== '-';

/** Une copie de la clé privée du routeur que tout le monde peut lire ? */
export function cleExposee(j: Jeu): string | null {
  const cles = clesPrivees(j);
  if (!cles.length) return null;
  const chercher = (n: Noeud, chemin: string): string | null => {
    if (n.type === 'fichier') return pourTous(n, 'r') && cles.some((c) => (j.lire(chemin) ?? '').includes(c)) ? chemin : null;
    if (!pourTous(n, 'x') || chemin === '/proc') return null;
    for (const [nom, e] of Object.entries((n as Dossier).enfants)) {
      const r = chercher(e, `${chemin === '/' ? '' : chemin}/${nom}`);
      if (r) return r;
    }
    return null;
  };
  return chercher(j.racine, '/');
}

const fini = (j: Jeu) => maintenant(j).etat === 'ok' && auRedemarrage(j) === 'ok' && sshOuvert(nft(j)) && sshAuRedemarrage(j) && !cleExposee(j);

export const vpn: Chapitre = {
  id: 'vpn',
  numero: 4,
  plan: planRuche({ teletravail: true }),
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
    'mv',
    'rm',
    'chmod',
    'umask',
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
    'wg',
    'wg-quick',
  ],
  maison: M,
  accueil: 'courriel_malik.txt',
  noms: true,
  final: 'fin',
  motDePasse: MOT_DE_PASSE,
  comptes: comptesRuche,
  etat: () => {
    const sd = systemdRuche({ 'wg-quick@wg0': serviceWg('wg0') });
    sd.services.nftables.active = true;
    sd.services.nftables.etat = 'active';
    return { lan: { ...nouveauLan(true), flux: FLUX.map(({ permis: _, ...x }) => x), distants: [MALIK] }, systemd: sd, nft: { tables: [] }, wg: {} };
  },
  initialiser: initialiserPareFeu,
  creerMonde: (t) =>
    mondeRuche({
      interfaces: INTERFACES_VLAN,
      dnsmasq: DNSMASQ_VLAN,
      nftables: NFTABLES_ZONES,
      sysctl: SYSCTL_ROUTEUR,
      etc: { wireguard: d({}, undefined, { proprio: 'root', mode: 'rwx------' }) },
      maison: {
        'courriel_malik.txt': f(t('vpn-courriel-malik', { cle: PUBLIQUE_MALIK })),
        'portable-malik.conf': f(t('vpn-portable-malik'), { lignes: true }),
      },
    }),
  evenements: [
    { id: 'cle-exposee', condition: (j) => !!cleExposee(j), message: (j) => j.t('vpn-evenement-cle-exposee', { fichier: cleExposee(j)! }) },
    { id: 'filtre', condition: (j) => maintenant(j).etat === 'filtre', message: (j) => j.t('vpn-evenement-filtre') },
    {
      id: 'poignee',
      condition: (j) => Object.keys(wg(j)).length > 0 && ['conf', 'adresse', 'cle-routeur', 'inconnu'].includes(maintenant(j).etat),
      message: (j) => j.t('vpn-evenement-poignee'),
    },
    {
      id: 'sans-nas',
      condition: (j) => ['autorisees', 'route', 'transfert'].includes(maintenant(j).etat),
      message: (j) => j.t('vpn-evenement-sans-nas'),
    },
    { id: 'ssh', condition: (j) => !sshOuvert(nft(j)), message: (j) => j.t('zones-evenement-ssh') },
    { id: 'en-place', condition: (j) => maintenant(j).etat === 'ok' && auRedemarrage(j) !== 'ok', message: (j) => j.t('vpn-evenement-en-place') },
    { id: 'fin', condition: fini, message: (j) => j.t('vpn-evenement-fin') },
  ],
};
