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

import type { Game } from './shell';
import { SECTOR, partitionFor, type Stockage } from './storage';

export const EXTENT = 4 * 1024 * 1024;
// La place que LVM garde en tête de chaque PV pour ses métadonnées.
const PV_HEADER = 1024 * 1024;

export interface Segment {
  pv: string;
  extents: number;
}

export interface LogicVolume {
  segments: Segment[];
  // La taille du système de fichiers ext4 qu'il porte (octets), et où il est monté.
  fs: number;
  point?: string;
  // Son numéro de périphérique (253:n, device-mapper).
  minor: number;
}

export interface VolumesGroup {
  uuid: string;
  lvs: Record<string, LogicVolume>;
}

export interface PhysicalVolume {
  vg: string | null;
  uuid: string;
}

export interface Lvm {
  pvs: Record<string, PhysicalVolume>;
  vgs: Record<string, VolumesGroup>;
}

export const lvm = (st: Stockage): Lvm => (st.lvm ??= { pvs: {}, vgs: {} });

/** La taille d'un périphérique (sda, sdb2, md1), en octets, ou null s'il n'existe pas. */
export function sizeFor(st: Stockage, name: string): number | null {
  if (st.arrays[name]) return st.arrays[name].blocks * 1024;
  if (st.disks[name]) return st.disks[name].sectors * SECTOR;
  const p = partitionFor(st, name);
  return p ? p.p.sectors * SECTOR : null;
}

/** Les étendues d'un PV. */
export const pvExtents = (st: Stockage, pv: string) => Math.floor(((sizeFor(st, pv) ?? 0) - PV_HEADER) / EXTENT);
/** Les étendues prises sur un PV par les LV de son groupe. */
export function socketsOn(st: Stockage, pv: string): number {
  const vg = lvm(st).pvs[pv]?.vg;
  if (!vg) return 0;
  return Object.values(lvm(st).vgs[vg].lvs).reduce((t, lv) => t + lv.segments.filter((s) => s.pv === pv).reduce((u, s) => u + s.extents, 0), 0);
}
export const pvsFor = (st: Stockage, vg: string) => Object.keys(lvm(st).pvs).filter((p) => lvm(st).pvs[p].vg === vg);
export const freeOn = (st: Stockage, pv: string) => pvExtents(st, pv) - socketsOn(st, pv);
export const lvExtents = (lv: LogicVolume) => lv.segments.reduce((t, s) => t + s.extents, 0);
export const totalVg = (st: Stockage, vg: string) => pvsFor(st, vg).reduce((t, p) => t + pvExtents(st, p), 0);
export const vgFree = (st: Stockage, vg: string) => pvsFor(st, vg).reduce((t, p) => t + freeOn(st, p), 0);

/** « /dev/labo/photos », « labo/photos », « /dev/mapper/labo-photos » → [groupe, volume], ou null. */
export function readLv(st: Stockage, name: string): [string, string] | null {
  const mapper = /^\/dev\/mapper\/([\w.+]+)-([\w.+]+)$/.exec(name);
  const path = /^(?:\/dev\/)?([\w.+-]+)\/([\w.+-]+)$/.exec(name);
  const [vg, lv] = mapper ? [mapper[1], mapper[2]] : path && path[1] !== 'mapper' ? [path[1], path[2]] : [];
  return vg && lv && lvm(st).vgs[vg]?.lvs[lv] ? [vg, lv] : null;
}

/** Prend `n` étendues pour un LV, sur les PV permis (dans l'ordre), en prolongeant son dernier segment si possible. */
export function allocate(st: Stockage, lv: LogicVolume, n: number, pvs: string[]): void {
  let rest = n;
  for (const pv of pvs) {
    if (rest <= 0) break;
    const taken = Math.min(rest, freeOn(st, pv));
    if (taken <= 0) continue;
    const last = lv.segments.at(-1);
    if (last && last.pv === pv) last.extents += taken;
    else lv.segments.push({ pv, extents: taken });
    rest -= taken;
  }
}

/** Le périphérique est-il tenu par LVM (un PV dans un groupe) ? */
export const heldByLvm = (st: Stockage, name: string) => !!lvm(st).pvs[name];

/** La taille d'un LV en octets. */
export const lvSize = (lv: LogicVolume) => lvExtents(lv) * EXTENT;

/**
 * Comme LVM écrit une taille : « <1.79t » (pvs, vgs, lvs : unités de 1024,
 * deux décimales, « < » quand l'arrondi dépasse la vraie valeur), ou « <1.79 TiB »
 * dans ses messages.
 */
export function lvmSize(bytes: number, long = false): string {
  if (bytes === 0) return long ? '0 ' : '0';
  const units = ['b', 'k', 'm', 'g', 't', 'p'];
  const longOptions = ['B', 'KiB', 'MiB', 'GiB', 'TiB', 'PiB'];
  let v = bytes;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  const rounded = Math.round(v * 100) / 100;
  const less = rounded > v + 1e-9 ? '<' : '';
  return `${less}${rounded.toFixed(2)}${long ? ` ${longOptions[i]}` : units[i]}`;
}

/** Le montage d'un LV (pour df) suit la taille de son système de fichiers. */
export function mountsUpdate(j: Game, st: Stockage): void {
  const mounts: { path: string; name: string; capacity: number }[] = j.state.montages ?? [];
  for (const [vg, g] of Object.entries(lvm(st).vgs))
    for (const [name, lv] of Object.entries(g.lvs)) {
      const m = mounts.find((x) => x.name === `/dev/mapper/${vg}-${name}`);
      if (m) m.capacity = lv.fs;
    }
}
