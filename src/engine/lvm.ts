// LVM (le gestionnaire de volumes logiques de Linux) sur le stockage d'une
// machine (stockage.ts) : des volumes physiques (PV : un disque, une
// partition ou une grappe RAID), réunis en groupes de volumes (VG), où l'on
// découpe des volumes logiques (LV) qui portent les systèmes de fichiers.
// Un LV est une suite de morceaux (segments) pris sur les PV de son groupe,
// en étendues de 4 Mio. Agrandir un LV ne change pas son système de
// fichiers : resize2fs (ou lvextend -r) doit suivre. D'après lvm(8),
// lvextend(8), pvmove(8) (https://man7.org/linux/man-pages/man8/lvm.8.html)
// et resize2fs(8) (https://man7.org/linux/man-pages/man8/resize2fs.8.html).
//
//   etat.stockage.lvm = { pvs: { md1: { vg: 'labo', uuid } }, vgs: { labo: { uuid, lvs: { photos: { segments, fs } } } } }
//
// Écarts : une seule taille d'étendue (4 Mio), pas de métadonnées réelles,
// pas d'instantanés ni de volumes fins ; le système de fichiers est toujours
// ext4, et sa taille est gardée à côté du LV.

import type { Jeu } from './shell';
import { SECTEUR, partitionDe, type Stockage } from './storage';

export const ETENDUE = 4 * 1024 * 1024;
// La place que LVM garde en tête de chaque PV pour ses métadonnées.
const ENTETE_PV = 1024 * 1024;

export interface Segment {
  pv: string;
  etendues: number;
}

export interface VolumeLogique {
  segments: Segment[];
  // La taille du système de fichiers ext4 qu'il porte (octets), et où il est monté.
  fs: number;
  point?: string;
  // Son numéro de périphérique (253:n, device-mapper).
  mineur: number;
}

export interface GroupeVolumes {
  uuid: string;
  lvs: Record<string, VolumeLogique>;
}

export interface VolumePhysique {
  vg: string | null;
  uuid: string;
}

export interface Lvm {
  pvs: Record<string, VolumePhysique>;
  vgs: Record<string, GroupeVolumes>;
}

export const lvm = (st: Stockage): Lvm => (st.lvm ??= { pvs: {}, vgs: {} });

/** La taille d'un périphérique (sda, sdb2, md1), en octets, ou null s'il n'existe pas. */
export function tailleDe(st: Stockage, nom: string): number | null {
  if (st.grappes[nom]) return st.grappes[nom].blocs * 1024;
  if (st.disques[nom]) return st.disques[nom].secteurs * SECTEUR;
  const p = partitionDe(st, nom);
  return p ? p.p.secteurs * SECTEUR : null;
}

/** Les étendues d'un PV. */
export const etenduesPv = (st: Stockage, pv: string) => Math.floor(((tailleDe(st, pv) ?? 0) - ENTETE_PV) / ETENDUE);
/** Les étendues prises sur un PV par les LV de son groupe. */
export function prisesSur(st: Stockage, pv: string): number {
  const vg = lvm(st).pvs[pv]?.vg;
  if (!vg) return 0;
  return Object.values(lvm(st).vgs[vg].lvs).reduce((t, lv) => t + lv.segments.filter((s) => s.pv === pv).reduce((u, s) => u + s.etendues, 0), 0);
}
export const pvsDe = (st: Stockage, vg: string) => Object.keys(lvm(st).pvs).filter((p) => lvm(st).pvs[p].vg === vg);
export const libresSur = (st: Stockage, pv: string) => etenduesPv(st, pv) - prisesSur(st, pv);
export const etenduesLv = (lv: VolumeLogique) => lv.segments.reduce((t, s) => t + s.etendues, 0);
export const totalVg = (st: Stockage, vg: string) => pvsDe(st, vg).reduce((t, p) => t + etenduesPv(st, p), 0);
export const libresVg = (st: Stockage, vg: string) => pvsDe(st, vg).reduce((t, p) => t + libresSur(st, p), 0);

/** « /dev/labo/photos », « labo/photos », « /dev/mapper/labo-photos » → [groupe, volume], ou null. */
export function lireLv(st: Stockage, nom: string): [string, string] | null {
  const mapper = /^\/dev\/mapper\/([\w.+]+)-([\w.+]+)$/.exec(nom);
  const chemin = /^(?:\/dev\/)?([\w.+-]+)\/([\w.+-]+)$/.exec(nom);
  const [vg, lv] = mapper ? [mapper[1], mapper[2]] : chemin && chemin[1] !== 'mapper' ? [chemin[1], chemin[2]] : [];
  return vg && lv && lvm(st).vgs[vg]?.lvs[lv] ? [vg, lv] : null;
}

/** Prend `n` étendues pour un LV, sur les PV permis (dans l'ordre), en prolongeant son dernier segment si possible. */
export function allouer(st: Stockage, lv: VolumeLogique, n: number, pvs: string[]): void {
  let reste = n;
  for (const pv of pvs) {
    if (reste <= 0) break;
    const pris = Math.min(reste, libresSur(st, pv));
    if (pris <= 0) continue;
    const dernier = lv.segments.at(-1);
    if (dernier && dernier.pv === pv) dernier.etendues += pris;
    else lv.segments.push({ pv, etendues: pris });
    reste -= pris;
  }
}

/** Le périphérique est-il tenu par LVM (un PV dans un groupe) ? */
export const tenuParLvm = (st: Stockage, nom: string) => !!lvm(st).pvs[nom];

/** La taille d'un LV en octets. */
export const tailleLv = (lv: VolumeLogique) => etenduesLv(lv) * ETENDUE;

/**
 * Comme LVM écrit une taille : « <1.79t » (pvs, vgs, lvs : unités de 1024,
 * deux décimales, « < » quand l'arrondi dépasse la vraie valeur), ou « <1.79 TiB »
 * dans ses messages.
 */
export function tailleLvm(octets: number, long = false): string {
  if (octets === 0) return long ? '0 ' : '0';
  const unites = ['b', 'k', 'm', 'g', 't', 'p'];
  const longues = ['B', 'KiB', 'MiB', 'GiB', 'TiB', 'PiB'];
  let v = octets;
  let i = 0;
  while (v >= 1024 && i < unites.length - 1) {
    v /= 1024;
    i++;
  }
  const arrondi = Math.round(v * 100) / 100;
  const moins = arrondi > v + 1e-9 ? '<' : '';
  return `${moins}${arrondi.toFixed(2)}${long ? ` ${longues[i]}` : unites[i]}`;
}

/** Le montage d'un LV (pour df) suit la taille de son système de fichiers. */
export function majMontages(j: Jeu, st: Stockage): void {
  const montages: { chemin: string; nom: string; capacite: number }[] = j.etat.montages ?? [];
  for (const [vg, g] of Object.entries(lvm(st).vgs))
    for (const [nom, lv] of Object.entries(g.lvs)) {
      const m = montages.find((x) => x.nom === `/dev/mapper/${vg}-${nom}`);
      if (m) m.capacite = lv.fs;
    }
}
