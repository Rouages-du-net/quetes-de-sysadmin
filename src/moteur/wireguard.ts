// WireGuard sur un routeur (etat.wg) : des clés (wg genkey, wg pubkey), une
// interface (wg0) décrite par /etc/wireguard/wg0.conf et montée par
// wg-quick, et des pairs distants (Lan.distants) qui essaient de s'y
// connecter depuis internet.
// Le format est celui de wg(8) et wg-quick(8) :
// https://man7.org/linux/man-pages/man8/wg.8.html,
// https://man7.org/linux/man-pages/man8/wg-quick.8.html,
// https://www.wireguard.com/quickstart/
// Une poignée de main réussit si le pair a la bonne clé publique du routeur,
// la bonne adresse et le bon port, si la chaîne input laisse passer l'UDP,
// et si le routeur connaît la clé publique du pair. Ensuite, ses paquets
// passent si l'adresse du tunnel est dans les AllowedIPs du pair (côté
// routeur), la destination dans ses AllowedIPs à lui, et si la chaîne
// forward les laisse aller (et revenir).
// Écarts : les clés ont le bon format, mais la clé publique n'est pas
// calculée par Curve25519 (une empreinte qui en tient lieu) ; pas de
// PresharedKey vérifiée, de PostUp exécuté, de routage de tout le trafic
// (0.0.0.0/0) côté routeur ni d'IPv6.

import type { Jeu } from './shell';
import { cidr, creer, dans, estIp, lan, reseauDe, supprimer } from './lan';
import { nft, routage, traverser, type Ruleset } from './nftables';

export const DOSSIER = '/etc/wireguard';

// ——— Les clés (32 octets en base64) ———

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

function versB64(o: number[]): string {
  let s = '';
  for (let i = 0; i < o.length; i += 3) {
    const n = (o[i] << 16) | ((o[i + 1] ?? 0) << 8) | (o[i + 2] ?? 0);
    s += B64[(n >> 18) & 63] + B64[(n >> 12) & 63] + (i + 1 < o.length ? B64[(n >> 6) & 63] : '=') + (i + 2 < o.length ? B64[n & 63] : '=');
  }
  return s;
}

function depuisB64(s: string): number[] | null {
  if (!/^[A-Za-z0-9+/]{43}=$/.test(s)) return null;
  const bits = s
    .slice(0, 43)
    .split('')
    .map((c) => B64.indexOf(c).toString(2).padStart(6, '0'))
    .join('');
  // 43 caractères : 258 bits, dont les 2 derniers doivent être nuls.
  if (!bits.endsWith('00')) return null;
  return Array.from({ length: 32 }, (_, i) => parseInt(bits.slice(i * 8, i * 8 + 8), 2));
}

export const cleValide = (s: string) => depuisB64(s.trim()) !== null;

/** wg genkey : une clé privée (toujours différente, mais rejouable : un compteur de l'état). */
export function genererCle(j: Jeu): string {
  const n = (j.etat.wgCompteur = (j.etat.wgCompteur ?? 0) + 1);
  let x = (n * 2654435761) >>> 0 || 1;
  const o = Array.from({ length: 32 }, () => {
    x ^= x << 13;
    x >>>= 0;
    x ^= x >>> 17;
    x ^= x << 5;
    x >>>= 0;
    return x & 255;
  });
  // Comme une vraie clé Curve25519 : bits de poids faible et fort ajustés.
  o[0] &= 248;
  o[31] = (o[31] & 127) | 64;
  return versB64(o);
}

/** wg pubkey : la clé publique d'une clé privée (une empreinte qui tient lieu de Curve25519) ; null si la clé est mal formée. */
export function publique(cle: string): string | null {
  const o = depuisB64(cle.trim());
  if (!o) return null;
  let h = 2166136261;
  const sortie = Array.from({ length: 32 }, (_, i) => {
    for (const b of [...o, i]) {
      h ^= b;
      h = Math.imul(h, 16777619) >>> 0;
    }
    return (h >>> 8) & 255;
  });
  return versB64(sortie);
}

// ——— La configuration (wg-quick) ———

export interface Pair {
  cle: string;
  autorisees: string[];
  endpoint?: string;
}

export interface ConfWg {
  adresses: string[];
  port?: number;
  cle?: string;
  pairs: Pair[];
  // Les messages de wg setconf ou de wg-quick, s'il y a une faute.
  erreurs: string[];
}

const IFACE_WG_QUICK = ['address', 'dns', 'mtu', 'table', 'preup', 'postup', 'predown', 'postdown', 'saveconfig'];

/** Lit un fichier de configuration comme wg-quick (ses clés à lui) puis wg setconf (le reste). */
export function lireConfWg(texte: string): ConfWg {
  const c: ConfWg = { adresses: [], pairs: [], erreurs: [] };
  let section: 'interface' | 'peer' | null = null;
  for (const brute of texte.split('\n')) {
    const ligne = brute.replace(/#.*/, '').trim();
    if (!ligne) continue;
    const titre = /^\[(\w+)\]$/.exec(ligne);
    if (titre) {
      const t = titre[1].toLowerCase();
      if (t === 'interface') section = 'interface';
      else if (t === 'peer') {
        section = 'peer';
        c.pairs.push({ cle: '', autorisees: [] });
      } else return { ...c, erreurs: [`Line unrecognized: \`${ligne}'`, 'Configuration parsing error'] };
      continue;
    }
    const k = ligne.indexOf('=');
    const cle = (k < 0 ? ligne : ligne.slice(0, k)).trim().toLowerCase();
    const valeur = k < 0 ? '' : ligne.slice(k + 1).trim();
    const mauvais = (m: string) => ({ ...c, erreurs: [m, 'Configuration parsing error'] });
    const nonReconnue = () => mauvais(`Line unrecognized: \`${ligne.replace(/\s+/g, '')}'`);
    if (k < 0 || !section) return nonReconnue();
    if (section === 'interface') {
      if (cle === 'address') {
        for (const a of valeur.split(',').map((x) => x.trim())) {
          if (!cidr(a)) return { ...c, erreurs: [`Error: any valid prefix is expected rather than "${a}".`] };
          c.adresses.push(a.includes('/') ? a : `${a}/32`);
        }
      } else if (IFACE_WG_QUICK.includes(cle)) continue;
      else if (cle === 'listenport') {
        if (!/^\d+$/.test(valeur) || Number(valeur) > 65535) return mauvais(`Unable to parse port: \`${valeur}'`);
        c.port = Number(valeur);
      } else if (cle === 'privatekey') {
        if (!cleValide(valeur)) return mauvais(`Key is not the correct length or format: \`${valeur}'`);
        c.cle = valeur;
      } else if (cle === 'fwmark') continue;
      else return nonReconnue();
    } else {
      const p = c.pairs.at(-1)!;
      if (cle === 'publickey') {
        if (!cleValide(valeur)) return mauvais(`Key is not the correct length or format: \`${valeur}'`);
        p.cle = valeur;
      } else if (cle === 'allowedips') {
        for (const a of valeur
          .split(',')
          .map((x) => x.trim())
          .filter(Boolean)) {
          if (!cidr(a)) return mauvais(`Unable to parse IP address: \`${a}'`);
          p.autorisees.push(a.includes('/') ? a : `${a}/32`);
        }
      } else if (cle === 'endpoint') {
        if (!/^[\w.-]+:\d+$/.test(valeur)) return mauvais(`Unable to parse endpoint: \`${valeur}'`);
        p.endpoint = valeur;
      } else if (cle === 'presharedkey') {
        if (!cleValide(valeur)) return mauvais(`Key is not the correct length or format: \`${valeur}'`);
      } else if (cle === 'persistentkeepalive') continue;
      else return nonReconnue();
    }
  }
  if (c.pairs.some((p) => !p.cle)) return { ...c, erreurs: ['A peer is missing a public key', 'Configuration parsing error'] };
  return c;
}

// ——— L'état : les interfaces montées ———

export interface InterfaceWg {
  conf: ConfWg;
  // Montée par le service (wg-quick@wg0) ou à la main (wg-quick up).
  parService: boolean;
}

export const wg = (j: Jeu): Record<string, InterfaceWg> => (j.etat.wg ??= {});
export const confDe = (nom: string) => `${DOSSIER}/${nom}.conf`;

/** wg-quick up : renvoie les lignes « [#] … » et les erreurs, et monte l'interface si tout va bien. */
export function monterWg(j: Jeu, nom: string, parService: boolean): { lignes: string[]; erreur: string | null } {
  const l = lan(j);
  const texte = j.lire(confDe(nom));
  if (texte === null) return { lignes: [], erreur: `wg-quick: \`${confDe(nom)}' does not exist` };
  if (wg(j)[nom] || l?.interfaces[nom]) return { lignes: [], erreur: `wg-quick: \`${nom}' already exists` };
  const c = lireConfWg(texte);
  const lignes = [`[#] ip link add ${nom} type wireguard`, `[#] wg setconf ${nom} /dev/fd/63`];
  if (c.erreurs.length) {
    // Comme wg-quick : l'interface créée est retirée.
    return { lignes: [...lignes, ...c.erreurs, `[#] ip link delete dev ${nom}`], erreur: '' };
  }
  for (const a of c.adresses) lignes.push(`[#] ip -4 address add ${a} dev ${nom}`);
  lignes.push(`[#] ip link set mtu 1420 up dev ${nom}`);
  wg(j)[nom] = { conf: c, parService };
  if (l) {
    const i = creer(l, nom);
    i.wireguard = true;
    i.up = true;
    i.adresses = [...c.adresses];
  }
  return { lignes, erreur: null };
}

export function demonterWg(j: Jeu, nom: string): string | null {
  if (!wg(j)[nom]) return `wg-quick: \`${nom}' is not a WireGuard interface`;
  delete wg(j)[nom];
  const l = lan(j);
  if (l) supprimer(l, nom);
  return null;
}

// ——— Les pairs distants ———

/** Un appareil sur internet qui se connecte au routeur par WireGuard (le portable de Malik…). */
export interface Distant {
  nom: string;
  // Son adresse publique (d'où viennent ses paquets UDP).
  adresse: string;
  // Sa clé publique (sa clé privée ne quitte jamais l'appareil).
  cle: string;
  // Son fichier de configuration, que le chapitre fait compléter.
  conf: string;
  // Ce qu'il essaie de joindre à travers le tunnel.
  vers: string;
  port: number;
}

export type EtatTunnel =
  | 'eteint' // pas d'interface WireGuard montée
  | 'conf' // la configuration du pair est incomplète ou fausse
  | 'adresse' // Endpoint : pas le routeur, ou pas le bon port
  | 'filtre' // la chaîne input jette l'UDP
  | 'cle-routeur' // le pair n'a pas la clé publique du routeur
  | 'inconnu' // le routeur ne connaît pas la clé publique du pair
  | 'autorisees' // l'adresse du pair n'est pas dans ses AllowedIPs (côté routeur)
  | 'route' // la destination n'est pas dans les AllowedIPs du pair
  | 'transfert' // ip_forward, ou la chaîne forward
  | 'ok';

/** Où en est le pair, avec ce ruleset et ces interfaces (maintenant, ou au démarrage). */
export function etatTunnel(
  j: Jeu,
  d: Distant,
  o: { ruleset?: Ruleset; interfaces?: Record<string, InterfaceWg>; transfert?: boolean; adressePublique: string; noms: string[] },
): { etat: EtatTunnel; nom?: string } {
  const interfaces = o.interfaces ?? wg(j);
  const ruleset = o.ruleset ?? nft(j);
  const transfert = o.transfert ?? routage(j);
  const entrees = Object.entries(interfaces);
  if (!entrees.length) return { etat: 'eteint' };
  const client = lireConfWg(j.lire(d.conf) ?? '');
  const pairRouteur = client.pairs[0];
  const adresseClient = client.adresses[0]?.split('/')[0];
  if (client.erreurs.length || !pairRouteur?.endpoint || !adresseClient) return { etat: 'conf' };
  const [hote, port] = pairRouteur.endpoint.split(':');
  if (hote !== o.adressePublique && !o.noms.includes(hote)) return { etat: 'adresse' };
  const iface = entrees.find(([, i]) => i.conf.port === Number(port));
  if (!iface) return { etat: 'adresse' };
  const [nom, i] = iface;
  const entree = {
    iif: 'eth0',
    oif: '',
    saddr: d.adresse,
    daddr: o.adressePublique,
    proto: 'udp' as const,
    sport: 51820,
    dport: Number(port),
    ct: 'new' as const,
    taille: 148,
  };
  if (!traverser(ruleset, 'input', 'filter', entree).passe) return { etat: 'filtre', nom };
  if (!i.conf.cle || pairRouteur.cle !== publique(i.conf.cle)) return { etat: 'cle-routeur', nom };
  const pair = i.conf.pairs.find((p) => p.cle === d.cle);
  if (!pair) return { etat: 'inconnu', nom };
  if (!pair.autorisees.some((a) => dans(adresseClient, a))) return { etat: 'autorisees', nom };
  if (!estIp(d.vers) || !pairRouteur.autorisees.some((a) => dans(d.vers, a))) return { etat: 'route', nom };
  if (!transfert) return { etat: 'transfert', nom };
  const l = lan(j);
  const sortie = l && Object.values(l.interfaces).find((x) => x.nom !== nom && x.up && x.adresses.some((a) => dans(d.vers, reseauDe(a))));
  const aller = {
    iif: nom,
    oif: sortie?.nom ?? '',
    saddr: adresseClient,
    daddr: d.vers,
    proto: 'tcp' as const,
    sport: 49152,
    dport: d.port,
    ct: 'new' as const,
    taille: 60,
  };
  const retour = {
    ...aller,
    iif: aller.oif,
    oif: nom,
    saddr: d.vers,
    daddr: adresseClient,
    sport: d.port,
    dport: 49152,
    ct: 'established' as const,
    taille: 1500,
  };
  if (!traverser(ruleset, 'forward', 'filter', aller).passe || !traverser(ruleset, 'forward', 'filter', retour).passe)
    return { etat: 'transfert', nom };
  return { etat: 'ok', nom };
}
