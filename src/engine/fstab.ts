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

import type { Game } from './shell';
import type { Directory } from './world';
import { partitionFor, type Stockage } from './storage';
import { readLv } from './lvm';

/** Un système de fichiers sur un périphérique (/dev/md0, /dev/mapper/labo-photos, /dev/sde1). */
export interface FilesSystem {
  type: string;
  uuid: string;
  label?: string;
  // Ce qu'il contient, pour un support qu'on monte pendant la partie (un disque USB).
  tree?: Directory;
  bytes?: number;
}

export interface FstabInput {
  line: number;
  source: string;
  target: string;
  type: string;
  options: string[];
  pass: number;
}

/** Les lignes de fstab, et celles qu'on ne sait pas lire (moins de quatre champs). */
export function readFstab(text: string): { inputs: FstabInput[]; errors: number[] } {
  const inputs: FstabInput[] = [];
  const errors: number[] = [];
  text.split('\n').forEach((rawValue, i) => {
    const l = rawValue.trim();
    if (!l || l.startsWith('#')) return;
    const fields = l.split(/\s+/);
    if (fields.length < 4) {
      errors.push(i + 1);
      return;
    }
    inputs.push({ line: i + 1, source: fields[0], target: fields[1], type: fields[2], options: fields[3].split(','), pass: Number(fields[5] ?? 0) });
  });
  return { inputs, errors };
}

export const systems = (st: Stockage): Record<string, FilesSystem> => (st.fs ??= {});

/** Le périphérique (/dev/…) que désigne une source de fstab ou de mount, s'il existe. */
export function resolveSource(st: Stockage, source: string): string | null {
  const fs = systems(st);
  const by = (key: 'uuid' | 'label', value: string) => Object.keys(fs).find((d) => fs[d][key] === value) ?? null;
  const m = /^(UUID|LABEL)=(.*)$/.exec(source);
  if (m) return by(m[1] === 'UUID' ? 'uuid' : 'label', m[2].replace(/^"|"$/g, ''));
  const link = /^\/dev\/disk\/by-(uuid|label)\/(.+)$/.exec(source);
  if (link) return by(link[1] === 'uuid' ? 'uuid' : 'label', link[2]);
  if (!source.startsWith('/dev/')) return null;
  const lv = readLv(st, source);
  if (lv) return `/dev/mapper/${lv[0]}-${lv[1]}`;
  const n = source.slice(5);
  return st.disks[n] || st.arrays[n] || partitionFor(st, n) ? source : null;
}

/** Le système de fichiers d'un périphérique, s'il en a un. */
export const systemFor = (st: Stockage, dev: string): FilesSystem | null => systems(st)[dev] ?? null;

/**
 * Ce que systemd trouverait au démarrage avec cette fstab : les entrées dont la
 * source manque (sans nofail), qui bloquent local-fs.target.
 */
export function blocking(st: Stockage, text: string): FstabInput[] {
  return readFstab(text).inputs.filter(
    (e) => e.type !== 'swap' && !e.options.includes('noauto') && !e.options.includes('nofail') && (!resolveSource(st, e.source) || !systemFor(st, resolveSource(st, e.source)!)),
  );
}

/** Le nom de l'unité de montage de systemd pour un point de montage (/srv/scans → srv-scans.mount). */
export const mountUnit = (target: string) => (target === '/' ? '-.mount' : `${target.replace(/^\//, '').replace(/\//g, '-')}.mount`);
/** Le nom de l'unité d'un périphérique (/dev/sdc1 → dev-sdc1.device). */
export const deviceUnit = (source: string) => `${source.replace(/^\//, '').replace(/-/g, '\\x2d').replace(/\//g, '-')}.device`;

/** La fstab telle que systemd l'a lue (au démarrage, ou au dernier daemon-reload). */
export const systemdFstab = (j: Game): string => j.state.fstabLue ?? j.read('/etc/fstab') ?? '';
