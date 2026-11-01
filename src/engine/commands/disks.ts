// Les disques : lsblk (util-linux) pour les voir, mount et umount pour
// brancher un système de fichiers dans l'arborescence. D'après
// https://man7.org/linux/man-pages/man8/mount.8.html et lsblk(8).
//
//   etat.peripheriques = { '/dev/sdb1': { disque, taille, systeme, etiquette, arbre } }
//   etat.montages = [{ chemin, capacite, nom, systeme, lectureSeule }]
//
// Monter, c'est faire apparaître l'arbre du périphérique au point de montage
// (ce qu'il y avait dans le dossier est caché, pas effacé) ; démonter le
// détache. Monté en lecture seule (-o ro), rien ne peut y être écrit.
// Sur une machine au stockage décrit, mount lit /etc/fstab (voir fstab.ts) : mount -a,
// mount point_de_montage, sources UUID= et LABEL=.
// Écarts : pas d'options autres que ro/rw ; un seul type
// de système de fichiers par périphérique.

import type { Directory, Node } from '../world';
import type { Shell } from '../shell';
import type { Command } from './index';
import { storageOf } from '../storage';
import { readFstab, resolveSource, systemFor } from '../fstab';
import { lsblkStockage } from './storage';

export interface Device {
  // Le disque entier (/dev/sdb) et ses numéros (MAJ:MIN), amovible ou non.
  disk: string;
  majmin: [number, number];
  removable: boolean;
  size: number;
  system: string;
  label?: string;
  uuid: string;
  tree: Directory;
}

export interface Mount {
  path: string;
  capacity: number;
  name: string;
  system?: string;
  onlyRead?: boolean;
  options?: string;
  // Ce que cachait le point de montage, rendu au démontage.
  cache?: { children: Record<string, Node>; owner?: string; group?: string; mode?: string };
}

const devices = (game: Shell): Record<string, Device> => game.state.devices ?? {};
const mounts = (game: Shell): Mount[] => (game.state.mounts ??= []);

/** « 29.3G », « 20G », comme lsblk (puissances de 1024). */
function lsblkSize(bytes: number): string {
  const units = ['B', 'K', 'M', 'G', 'T'];
  let v = bytes;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  const rounded = Math.round(v * 10) / 10;
  return `${Number.isInteger(rounded) ? rounded : rounded.toFixed(1)}${units[i]}`;
}

function lsblk(game: Shell, args: string[]): string {
  // Une machine aux disques décrits (stockage.ts) : disques, partitions, RAID, colonnes au choix.
  const st = storageOf(game);
  if (st) return lsblkStockage(game, st, args);
  const complete = args.includes('-f') || args.includes('--fs');
  // Le disque de la machine (vda) et ses partitions montées, puis les périphériques.
  type Line = {
    name: string;
    majmin: string;
    rm: number;
    size: number;
    type: string;
    point: string;
    system: string;
    label: string;
    uuid: string;
  };
  const disks = new Map<string, { majmin: string; rm: number; size: number; parts: Line[] }>();
  for (const m of mounts(game).filter((x) => x.name.startsWith('/dev/vd'))) {
    const disk = m.name.replace(/\d+$/, '');
    const d = disks.get(disk) ?? { majmin: '254:0', rm: 0, size: m.capacity, parts: [] };
    d.parts.push({
      name: m.name,
      majmin: `254:${d.parts.length + 1}`,
      rm: 0,
      size: m.capacity,
      type: 'part',
      point: m.path,
      system: m.system ?? 'ext4',
      label: '',
      uuid: '3f6d2c1e-8a4b-4c1d-9e2f-5b7a0c9d1e42',
    });
    disks.set(disk, d);
  }
  for (const [name, p] of Object.entries(devices(game))) {
    const d = disks.get(p.disk) ?? { majmin: `${p.majmin[0]}:${p.majmin[1] - 1}`, rm: p.removable ? 1 : 0, size: p.size, parts: [] };
    const m = mounts(game).find((x) => x.name === name);
    d.parts.push({
      name,
      majmin: `${p.majmin[0]}:${p.majmin[1]}`,
      rm: p.removable ? 1 : 0,
      size: p.size,
      type: 'part',
      point: m?.path ?? '',
      system: p.system,
      label: p.label ?? '',
      uuid: p.uuid,
    });
    disks.set(p.disk, d);
  }
  const short = (n: string) => n.replace('/dev/', '');
  const lines: string[] = [];
  if (complete) {
    lines.push('NAME   FSTYPE FSVER LABEL      UUID                                 FSAVAIL FSUSE% MOUNTPOINTS');
    for (const [disk, d] of disks) {
      lines.push(short(disk));
      d.parts.forEach((p, i) => {
        const m = mounts(game).find((x) => x.name === p.name);
        const place = m ? game.find(m.path) : null;
        const inUse = place ? game.size(place) : 0;
        const freeMem = m ? lsblkSize(Math.max(0, p.size - inUse)) : '';
        const pct = m ? `${Math.round((100 * inUse) / p.size)}%` : '';
        lines.push(
          `${(i === d.parts.length - 1 ? '└─' : '├─') + short(p.name)}`.padEnd(7) +
            `${p.system.padEnd(7)}${''.padEnd(6)}${p.label.padEnd(11)}${p.uuid.padEnd(37)}${freeMem.padStart(7)} ${pct.padStart(6)} ${p.point}`.trimEnd(),
        );
      });
    }
    return lines.join('\n');
  }
  lines.push('NAME   MAJ:MIN RM  SIZE RO TYPE MOUNTPOINTS');
  for (const [disk, d] of disks) {
    lines.push(`${short(disk).padEnd(6)} ${d.majmin.padStart(7)} ${String(d.rm).padStart(2)} ${lsblkSize(d.size).padStart(5)}  0 disk `);
    d.parts.forEach((p, i) => {
      const m = mounts(game).find((x) => x.name === p.name);
      const name = (i === d.parts.length - 1 ? '└─' : '├─') + short(p.name);
      lines.push(
        `${name.padEnd(6)} ${p.majmin.padStart(7)} ${String(p.rm).padStart(2)} ${lsblkSize(p.size).padStart(5)} ${m?.onlyRead ? ' 1' : ' 0'} part ${p.point}`,
      );
    });
  }
  return lines.join('\n');
}

const DMESG = '\n       dmesg(1) may have more information after failed mount system call.';

// Sur une machine au stockage décrit (stockage.ts), un système de fichiers qu'on peut monter.
function periphStockage(game: Shell, source: string): (Device & { name: string }) | null {
  const st = storageOf(game);
  if (!st) return null;
  const dev = resolveSource(st, source);
  const fs = dev ? systemFor(st, dev) : null;
  if (!dev || !fs?.tree) return null;
  return { name: dev, disk: dev, majmin: [8, 0], removable: false, size: fs.bytes ?? 0, system: fs.type, label: fs.label, uuid: fs.uuid, tree: fs.tree };
}

// mount -a : tout ce que décrit /etc/fstab (sauf noauto), et qui n'est pas déjà monté.
function mountAll(game: Shell): string {
  if (game.who !== 'root') return game.error('mount: only root can use "--all" option');
  const text = game.read('/etc/fstab') ?? '';
  const { inputs, errors } = readFstab(text);
  for (const n of errors) game.error(`mount: /etc/fstab: parse error at line ${n} -- ignored`);
  const st = storageOf(game);
  for (const e of inputs) {
    if (e.type === 'swap' || e.options.includes('noauto') || mounts(game).some((m) => m.path === e.target)) continue;
    const dev = st ? resolveSource(st, e.source) : null;
    if (!dev || !st || !systemFor(st, dev)) {
      // nofail : un support absent n'est pas une erreur.
      if (!e.options.includes('nofail')) game.error(`mount: ${e.target}: special device ${e.source} does not exist.${DMESG}`, 32);
      continue;
    }
    if (mounts(game).some((m) => m.name === dev)) continue;
    const r = brancher(game, e.source, e.target, e.options.join(','));
    if (r) game.error(r, 32);
  }
  // util-linux prévient quand fstab a changé depuis que systemd l'a lue.
  if (game.state.fstabRead !== undefined && game.state.fstabRead !== text)
    game.error("mount: (hint) your fstab has been modified, but systemd still uses\n       the old version; use 'systemctl daemon-reload' to reload.");
  return '';
}

/** Monte une source sur un point (renvoie le message d'erreur de mount, ou ''). */
function brancher(game: Shell, source: string, point: string, options: string): string {
  const absolute = game.resolve(point);
  const p = devices(game)[source] ? { ...devices(game)[source], name: source } : periphStockage(game, source);
  if (!p) return `mount: ${absolute}: special device ${source} does not exist.${DMESG}`;
  const place = game.find(absolute);
  if (place?.type !== 'dossier') return `mount: ${absolute}: mount point does not exist.${DMESG}`;
  const already = mounts(game).find((m) => m.name === p.name);
  if (already) return `mount: ${absolute}: ${p.name} already mounted on ${already.path}.${DMESG}`;
  const onlyRead = options.split(',').includes('ro');
  const cache = { children: place.children, owner: place.owner, group: place.group, mode: place.mode };
  place.children = p.tree.children;
  place.owner = p.tree.owner;
  place.group = p.tree.group;
  place.mode = p.tree.mode;
  mounts(game).push({ path: absolute, capacity: p.size, name: p.name, system: p.system, onlyRead, cache });
  return '';
}

/** Au démarrage : monte ce que décrit fstab et qui peut l'être (le reste a été vérifié avant). */
export function mountToBoot(game: Shell): void {
  const before = game.who;
  game.who = 'root';
  try {
    mountAll(game);
    game.recoverErrors();
  } finally {
    game.who = before;
  }
}

function mount(game: Shell, args: string[]): string {
  if (!args.length)
    return mounts(game)
      .map((m) => `${m.name} on ${m.path} type ${m.system ?? 'ext4'} (${m.onlyRead ? 'ro' : 'rw'},${m.options ?? 'relatime'})`)
      .join('\n');
  let options = '';
  const positional: string[] = [];
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '-o') options = args[++i] ?? '';
    else if (args[i] === '-t') i++;
    else if (args[i].startsWith('-o')) options = args[i].slice(2);
    else if (args[i] === '-a' || args[i] === '--all') return mountAll(game);
    else if (!args[i].startsWith('-')) positional.push(args[i]);
  }
  // Un seul argument : le point de montage (ou la source) d'une ligne de fstab.
  if (positional.length === 1) {
    const only = positional[0];
    const e = readFstab(game.read('/etc/fstab') ?? '').inputs.find((x) => x.target === game.resolve(only) || x.source === only);
    if (!e) return game.error(`mount: ${only}: can't find in /etc/fstab.`);
    positional.push(e.target);
    positional[0] = e.source;
    options ||= e.options.join(',');
  }
  const [source, point] = positional;
  if (!source || !point) return game.error(game.t('mount-usage'));
  const absolute = game.resolve(point);
  if (game.who !== 'root')
    return game.error(`mount: ${absolute}: must be superuser to use mount.\n       dmesg(1) may have more information after failed mount system call.`);
  if (!devices(game)[source] && storageOf(game)) {
    const r = brancher(game, source, point, options);
    return r ? game.error(r, 32) : '';
  }
  const p = devices(game)[source];
  if (!p)
    return game.error(
      `mount: ${absolute}: special device ${source} does not exist.\n       dmesg(1) may have more information after failed mount system call.`,
    );
  const place = game.find(absolute);
  if (place?.type !== 'dossier')
    return game.error(`mount: ${absolute}: mount point does not exist.\n       dmesg(1) may have more information after failed mount system call.`);
  const already = mounts(game).find((m) => m.name === source);
  if (already)
    return game.error(
      `mount: ${absolute}: ${source} already mounted on ${already.path}.\n       dmesg(1) may have more information after failed mount system call.`,
    );
  const onlyRead = options.split(',').includes('ro');
  // Le contenu du dossier est caché (pas effacé) tant que le périphérique y est monté.
  const cache = { children: place.children, owner: place.owner, group: place.group, mode: place.mode };
  place.children = p.tree.children;
  place.owner = p.tree.owner;
  place.group = p.tree.group;
  place.mode = p.tree.mode;
  mounts(game).push({ path: absolute, capacity: p.size, name: source, system: p.system, onlyRead, cache });
  return '';
}

function unmount(game: Shell, args: string[]): string {
  const target = args.find((a) => !a.startsWith('-'));
  if (!target) return game.error(game.t('umount-usage'));
  const m = mounts(game).find((x) => x.name === target || x.path === game.resolve(target));
  const shows = m?.path ?? game.resolve(target);
  if (game.who !== 'root') return game.error(`umount: ${shows}: must be superuser to unmount.`);
  if (!m || !m.cache) return game.error(`umount: ${shows}: not mounted.`);
  // On ne démonte pas un lieu où l'on se trouve (comme un processus qui y travaille).
  if (game.cwd === m.path || game.cwd.startsWith(m.path + '/')) return game.error(`umount: ${m.path}: target is busy.`);
  const place = game.find(m.path) as Directory;
  const p = devices(game)[m.name];
  if (p) p.tree.children = place.children;
  const fs = storageOf(game) ? systemFor(storageOf(game)!, m.name) : null;
  if (fs?.tree) fs.tree.children = place.children;
  Object.assign(place, { children: m.cache.children, owner: m.cache.owner, group: m.cache.group, mode: m.cache.mode });
  game.state.mounts = mounts(game).filter((x) => x !== m);
  return '';
}

export const DISKS: Record<string, Command> = {
  lsblk: { options: ['f'], launch: ({ args, game }) => lsblk(game, args) },
  mount: { section: 8, ownOptions: true, launch: ({ args, game }) => mount(game, args) },
  umount: { section: 8, ownOptions: true, launch: ({ args, game }) => unmount(game, args) },
};
