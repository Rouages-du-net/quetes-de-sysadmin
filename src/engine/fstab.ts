// /etc/fstab, lu comme le lisent mount et systemd : une ligne par système de
// fichiers (source, point de montage, type, options, dump, pass). La source
// se donne par UUID=, LABEL=, ou un chemin de /dev (/dev/sde1,
// /dev/mapper/vg-lv, /dev/disk/by-uuid/…). Au démarrage, systemd attend
// chaque source (90 s) : une source introuvable sans l'option nofail fait
// échouer local-fs.target, et la machine s'arrête en mode secours
// (emergency). D'après fstab(5) (https://man7.org/linux/man-pages/man5/fstab.5.html),
// systemd.mount(5) (https://www.freedesktop.org/software/systemd/man/latest/systemd.mount.html)
// et findmnt(8).
// Écarts : pas de swap, de montages réseau, ni de x-systemd.* autres que nofail
// et noauto ; un seul type de système de fichiers par périphérique.

import type { Jeu } from './shell';
import type { Dossier } from './world';
import { partitionDe, type Stockage } from './storage';
import { lireLv } from './lvm';

/** Un système de fichiers sur un périphérique (/dev/md0, /dev/mapper/labo-photos, /dev/sde1). */
export interface SystemeFichiers {
  type: string;
  uuid: string;
  label?: string;
  // Ce qu'il contient, pour un support qu'on monte pendant la partie (un disque USB).
  arbre?: Dossier;
  octets?: number;
}

export interface EntreeFstab {
  ligne: number;
  source: string;
  cible: string;
  type: string;
  options: string[];
  passe: number;
}

/** Les lignes de fstab, et celles qu'on ne sait pas lire (moins de quatre champs). */
export function lireFstab(texte: string): { entrees: EntreeFstab[]; erreurs: number[] } {
  const entrees: EntreeFstab[] = [];
  const erreurs: number[] = [];
  texte.split('\n').forEach((brute, i) => {
    const l = brute.trim();
    if (!l || l.startsWith('#')) return;
    const champs = l.split(/\s+/);
    if (champs.length < 4) {
      erreurs.push(i + 1);
      return;
    }
    entrees.push({ ligne: i + 1, source: champs[0], cible: champs[1], type: champs[2], options: champs[3].split(','), passe: Number(champs[5] ?? 0) });
  });
  return { entrees, erreurs };
}

export const systemes = (st: Stockage): Record<string, SystemeFichiers> => (st.fs ??= {});

/** Le périphérique (/dev/…) que désigne une source de fstab ou de mount, s'il existe. */
export function resoudreSource(st: Stockage, source: string): string | null {
  const fs = systemes(st);
  const par = (cle: 'uuid' | 'label', valeur: string) => Object.keys(fs).find((d) => fs[d][cle] === valeur) ?? null;
  const m = /^(UUID|LABEL)=(.*)$/.exec(source);
  if (m) return par(m[1] === 'UUID' ? 'uuid' : 'label', m[2].replace(/^"|"$/g, ''));
  const lien = /^\/dev\/disk\/by-(uuid|label)\/(.+)$/.exec(source);
  if (lien) return par(lien[1] === 'uuid' ? 'uuid' : 'label', lien[2]);
  if (!source.startsWith('/dev/')) return null;
  const lv = lireLv(st, source);
  if (lv) return `/dev/mapper/${lv[0]}-${lv[1]}`;
  const n = source.slice(5);
  return st.disques[n] || st.grappes[n] || partitionDe(st, n) ? source : null;
}

/** Le système de fichiers d'un périphérique, s'il en a un. */
export const systemeDe = (st: Stockage, dev: string): SystemeFichiers | null => systemes(st)[dev] ?? null;

/**
 * Ce que systemd trouverait au démarrage avec cette fstab : les entrées dont la
 * source manque (sans nofail), qui bloquent local-fs.target.
 */
export function bloquantes(st: Stockage, texte: string): EntreeFstab[] {
  return lireFstab(texte).entrees.filter(
    (e) => e.type !== 'swap' && !e.options.includes('noauto') && !e.options.includes('nofail') && (!resoudreSource(st, e.source) || !systemeDe(st, resoudreSource(st, e.source)!)),
  );
}

/** Le nom de l'unité de montage de systemd pour un point de montage (/srv/scans → srv-scans.mount). */
export const uniteMontage = (cible: string) => (cible === '/' ? '-.mount' : `${cible.replace(/^\//, '').replace(/\//g, '-')}.mount`);
/** Le nom de l'unité d'un périphérique (/dev/sdc1 → dev-sdc1.device). */
export const uniteDevice = (source: string) => `${source.replace(/^\//, '').replace(/-/g, '\\x2d').replace(/\//g, '-')}.device`;

/** La fstab telle que systemd l'a lue (au démarrage, ou au dernier daemon-reload). */
export const fstabDeSystemd = (j: Jeu): string => j.etat.fstabLue ?? j.lire('/etc/fstab') ?? '';
