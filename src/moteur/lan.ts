// Le réseau local d'une machine qui sert de routeur (etat.lan) : ses
// interfaces (physiques, et VLAN 802.1Q sur une interface « trunk » reliée
// au commutateur), leurs adresses, les routes, et les appareils branchés au
// commutateur (chacun dans un VLAN, avec une adresse fixe ou donnée par DHCP).
//   - la configuration persistante : /etc/network/interfaces, lu comme
//     ifupdown (https://manpages.debian.org/trixie/ifupdown/interfaces.5.en.html) :
//     auto, iface … inet static|manual|loopback, address (CIDR, ou netmask),
//     gateway, vlan-raw-device, source ; une interface « eth1.10 » est le
//     VLAN 10 de eth1 (paquet vlan, https://manpages.debian.org/trixie/vlan/vlan-interfaces.5.en.html) ;
//   - l'état courant, que changent ip, ifup et ifdown, et que le démarrage
//     reconstruit depuis le fichier (les interfaces « auto ») ;
//   - ping : un appareil répond s'il est dans le VLAN de l'interface dont le
//     réseau contient son adresse, et que cette interface est montée.
// Écarts : IPv4 seulement, pas d'ARP visible, pas de MTU ni de bonding ; le
// commutateur est décrit par le chapitre (ports déjà configurés).

import type { Jeu } from './shell';
import type { Flux } from './nftables';

export interface Interface {
  nom: string;
  up: boolean;
  // Adresses au format CIDR (10.10.10.1/24).
  adresses: string[];
  mac: string;
  vlan?: { parent: string; id: number };
}

export interface Appareil {
  nom: string;
  mac: string;
  // Le VLAN de son port sur le commutateur (non étiqueté) ; 1 : le VLAN natif.
  vlan: number;
  // Adresse fixe (configurée sur l'appareil) ; sinon il la demande en DHCP.
  fixe?: string;
  // Adresse obtenue par DHCP (bail).
  bail?: string;
}

export interface Lan {
  interfaces: Record<string, Interface>;
  // La passerelle par défaut (route default via … dev …).
  passerelle: { via: string; dev: string } | null;
  // L'interface reliée au port « trunk » du commutateur, et les VLAN qu'il transporte.
  trunk: string;
  vlans: number[];
  appareils: Appareil[];
  // Un numéro par interface, dans l'ordre de création (ip a).
  ordre: string[];
  // Le trafic que les appareils essaient à travers le routeur (voir nftables.ts).
  flux?: Flux[];
}

export const INTERFACES = '/etc/network/interfaces';
export const lan = (j: Jeu) => j.etat.lan as Lan | undefined;

// ——— Adresses ———

export const versNombre = (ip: string) => ip.split('.').reduce((t, o) => t * 256 + Number(o), 0);
export const versIp = (n: number) => [24, 16, 8, 0].map((d) => (n >>> d) & 255).join('.');
export const estIp = (s: string) => /^\d{1,3}(\.\d{1,3}){3}$/.test(s) && s.split('.').every((o) => Number(o) <= 255);

/** « 10.10.10.1/24 » → adresse, longueur, réseau, diffusion ; null si la forme est fausse. */
export function cidr(texte: string): { ip: string; longueur: number; reseau: number; diffusion: number } | null {
  const [ip, l] = texte.split('/');
  const longueur = l === undefined ? 32 : Number(l);
  if (!estIp(ip) || !Number.isInteger(longueur) || longueur < 0 || longueur > 32) return null;
  const masque = longueur === 0 ? 0 : (0xffffffff << (32 - longueur)) >>> 0;
  const reseau = (versNombre(ip) & masque) >>> 0;
  return { ip, longueur, reseau, diffusion: (reseau | (~masque >>> 0)) >>> 0 };
}

/** Le masque « 255.255.255.0 » en longueur (24) ; null s'il n'est pas contigu. */
export function longueurMasque(masque: string): number | null {
  if (!estIp(masque)) return null;
  const bits = versNombre(masque).toString(2).padStart(32, '0');
  return /^1*0*$/.test(bits) ? (bits.indexOf('0') === -1 ? 32 : bits.indexOf('0')) : null;
}

/** Cette adresse est-elle dans ce réseau (10.10.10.0/24) ? */
export function dans(ip: string, reseau: string): boolean {
  const c = cidr(reseau);
  if (!c || !estIp(ip)) return false;
  const masque = c.longueur === 0 ? 0 : (0xffffffff << (32 - c.longueur)) >>> 0;
  return (versNombre(ip) & masque) >>> 0 === c.reseau;
}

/** Le réseau d'une adresse CIDR (10.10.10.1/24 → 10.10.10.0/24). */
export const reseauDe = (adresse: string) => {
  const c = cidr(adresse)!;
  return `${versIp(c.reseau)}/${c.longueur}`;
};

// Une adresse MAC de documentation (RFC 7042) pour une interface du routeur.
const macDe = (nom: string) => {
  let h = 0;
  for (const c of nom) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return `52:54:00:${[16, 8, 0].map((d) => ((h >>> d) & 255).toString(16).padStart(2, '0')).join(':')}`;
};

/** Le VLAN d'une interface, vu du commutateur : son id si c'est un VLAN du trunk, 1 si c'est le trunk lui-même ; null sinon. */
export function vlanDe(l: Lan, i: Interface): number | null {
  if (i.vlan) return i.vlan.parent === l.trunk ? i.vlan.id : null;
  return i.nom === l.trunk ? 1 : null;
}

/** L'interface est-elle vraiment en service (montée, et son parent aussi) ? */
export const enService = (l: Lan, i: Interface) => i.up && (!i.vlan || !!l.interfaces[i.vlan.parent]?.up);

// ——— Le fichier /etc/network/interfaces (ifupdown) ———

export interface Strophe {
  nom: string;
  methode: string;
  auto: boolean;
  adresse?: string;
  passerelle?: string;
  vlan?: { parent: string; id: number };
}

/** Lit /etc/network/interfaces (et ses « source ») ; les erreurs au format d'ifup. */
export function lireInterfaces(j: Jeu): { strophes: Record<string, Strophe>; erreurs: string[] } {
  const strophes: Record<string, Strophe> = {};
  const autos = new Set<string>();
  const erreurs: string[] = [];
  const lire = (fichier: string) => {
    const texte = j.lire(fichier);
    if (texte === null) return;
    let courante: Strophe | null = null;
    let masque: string | undefined;
    const finir = () => {
      if (courante && masque && courante.adresse && !courante.adresse.includes('/')) {
        const l = longueurMasque(masque);
        if (l === null) erreurs.push(`${fichier}: invalid netmask ${masque}`);
        else courante.adresse = `${courante.adresse}/${l}`;
      }
      masque = undefined;
    };
    texte.split('\n').forEach((brute, i) => {
      const ligne = brute.replace(/#.*/, '').trim();
      if (!ligne) return;
      const [mot, ...reste] = ligne.split(/\s+/);
      if (mot === 'auto' || mot === 'allow-hotplug') {
        reste.forEach((n) => autos.add(n));
        return;
      }
      if (mot === 'source') {
        for (const motif of reste) {
          const k = motif.lastIndexOf('/');
          const dossier = j.trouver(motif.slice(0, k));
          const re = new RegExp(
            `^${motif
              .slice(k + 1)
              .replace(/\./g, '\\.')
              .replace(/\*/g, '.*')}$`,
          );
          if (dossier?.type === 'dossier') for (const n of Object.keys(dossier.enfants).sort()) if (re.test(n)) lire(`${motif.slice(0, k)}/${n}`);
        }
        return;
      }
      if (mot === 'iface') {
        finir();
        const [nom, famille, methode] = reste;
        if (famille !== 'inet' || !['static', 'manual', 'loopback', 'dhcp'].includes(methode ?? ''))
          erreurs.push(`${fichier}:${i + 1}: unknown or no method and no address family`);
        courante = { nom, methode: methode ?? '', auto: false };
        const v = /^(.+)\.(\d+)$/.exec(nom);
        if (v) courante.vlan = { parent: v[1], id: Number(v[2]) };
        strophes[nom] = courante;
        return;
      }
      if (!courante) {
        erreurs.push(`${fichier}:${i + 1}: option with empty value`);
        return;
      }
      const valeur = reste.join(' ');
      if (mot === 'address') {
        if (!cidr(valeur.split('/')[0])) erreurs.push(`${fichier}:${i + 1}: invalid address ${valeur}`);
        else courante.adresse = valeur;
      } else if (mot === 'netmask') masque = valeur;
      else if (mot === 'gateway') courante.passerelle = valeur;
      else if (mot === 'vlan-raw-device' || mot === 'vlan_raw_device') {
        const id = Number(/(\d+)$/.exec(courante.nom)?.[1]);
        courante.vlan = { parent: valeur, id };
      }
    });
    finir();
  };
  lire(INTERFACES);
  for (const n of autos) if (strophes[n]) strophes[n].auto = true;
  return { strophes, erreurs };
}

// ——— Changer l'état (ip, ifup, ifdown) ———

/** Crée une interface (VLAN, ou physique pour le monde de départ). */
export function creer(l: Lan, nom: string, vlan?: { parent: string; id: number }): Interface {
  const i: Interface = {
    nom,
    up: false,
    adresses: [],
    mac: vlan ? (l.interfaces[vlan.parent]?.mac ?? macDe(nom)) : macDe(nom),
    ...(vlan ? { vlan } : {}),
  };
  l.interfaces[nom] = i;
  if (!l.ordre.includes(nom)) l.ordre.push(nom);
  return i;
}

export function supprimer(l: Lan, nom: string) {
  delete l.interfaces[nom];
  // Les VLAN d'une interface supprimée disparaissent avec elle.
  for (const [n, i] of Object.entries(l.interfaces)) if (i.vlan?.parent === nom) delete l.interfaces[n];
  if (l.passerelle?.dev === nom) l.passerelle = null;
}

/** ifup : monte une interface d'après sa strophe ; renvoie le message d'erreur d'ifup, ou null. */
export function monter(j: Jeu, l: Lan, s: Strophe): string | null {
  if (s.methode === 'loopback') return null;
  let i = l.interfaces[s.nom];
  if (!i) {
    if (!s.vlan) return `Cannot find device "${s.nom}"`;
    if (!l.interfaces[s.vlan.parent]) return `Cannot find device "${s.vlan.parent}"`;
    i = creer(l, s.nom, s.vlan);
  }
  // Monter un VLAN monte aussi son interface parente (comme le fait ifupdown avec le paquet vlan).
  if (i.vlan) l.interfaces[i.vlan.parent].up = true;
  i.up = true;
  if (s.methode === 'static' && s.adresse) {
    if (!i.adresses.includes(s.adresse)) i.adresses.push(s.adresse);
    if (s.passerelle) l.passerelle = { via: s.passerelle, dev: s.nom };
  }
  return null;
}

export function demonter(l: Lan, s: Strophe) {
  const i = l.interfaces[s.nom];
  if (!i) return;
  i.up = false;
  i.adresses = [];
  if (l.passerelle?.dev === s.nom) l.passerelle = null;
  // ifdown d'un VLAN le supprime.
  if (i.vlan) delete l.interfaces[s.nom];
}

/** Au démarrage (et à systemctl restart networking) : l'état repart du fichier, interfaces « auto ». */
export function demarrerReseau(j: Jeu) {
  const l = lan(j);
  if (!l) return;
  for (const [nom, i] of Object.entries(l.interfaces)) {
    if (i.vlan) delete l.interfaces[nom];
    else Object.assign(i, { up: nom === 'lo', adresses: nom === 'lo' ? ['127.0.0.1/8'] : [] });
  }
  l.passerelle = null;
  const { strophes } = lireInterfaces(j);
  const montees: string[] = [];
  for (const s of [...Object.values(strophes).filter((x) => !x.vlan), ...Object.values(strophes).filter((x) => x.vlan)])
    if (s.auto && !monter(j, l, s)) montees.push(s.nom);
  // L'état d'ifupdown (/run/network/ifstate) : ce qui a été monté.
  j.etat.ifstate = montees;
}

// ——— Joindre une adresse ———

/** L'interface (en service) dont le réseau contient cette adresse. */
export function interfacePour(l: Lan, ip: string): Interface | null {
  return Object.values(l.interfaces).find((i) => enService(l, i) && i.adresses.some((a) => dans(ip, reseauDe(a)))) ?? null;
}

/** L'interface du routeur (en service, avec une adresse) qui reçoit ce VLAN. */
export function interfaceDuVlan(l: Lan, vlan: number): Interface | null {
  return Object.values(l.interfaces).find((i) => enService(l, i) && i.adresses.length && vlanDe(l, i) === vlan) ?? null;
}

/** Une adresse privée (RFC 1918) ? */
export const prive = (ip: string) => dans(ip, '10.0.0.0/8') || dans(ip, '172.16.0.0/12') || dans(ip, '192.168.0.0/16');

/** L'adresse d'un appareil (fixe, ou son bail DHCP). */
export const adresseDe = (a: Appareil) => a.fixe ?? a.bail;

/**
 * Ce que donne un ping depuis le routeur : « local » (une de ses adresses),
 * « appareil » (il répond), « injoignable » (personne ne répond sur ce
 * réseau, l'adresse source de l'erreur), « internet » (par la passerelle),
 * « perdu » (une adresse privée envoyée à la passerelle) ou « pas-de-route ».
 */
export function joindre(
  l: Lan,
  ip: string,
): { quoi: 'local' | 'appareil' | 'internet' | 'perdu' | 'pas-de-route'; source?: string } | { quoi: 'injoignable'; source: string } {
  if (ip.startsWith('127.') || Object.values(l.interfaces).some((i) => i.adresses.some((a) => a.split('/')[0] === ip))) return { quoi: 'local' };
  const i = interfacePour(l, ip);
  if (i) {
    const source = i.adresses.find((a) => dans(ip, reseauDe(a)))!.split('/')[0];
    const vlan = vlanDe(l, i);
    const ok = vlan !== null && l.vlans.concat(1).includes(vlan) && l.appareils.some((a) => a.vlan === vlan && adresseDe(a) === ip);
    return ok ? { quoi: 'appareil', source } : { quoi: 'injoignable', source };
  }
  const gw = l.passerelle;
  if (gw && l.interfaces[gw.dev] && enService(l, l.interfaces[gw.dev]))
    // Une adresse privée (RFC 1918) ne se route pas sur internet : la box la jette.
    return { quoi: prive(ip) ? 'perdu' : 'internet', source: l.interfaces[gw.dev].adresses[0]?.split('/')[0] };
  return { quoi: 'pas-de-route' };
}
