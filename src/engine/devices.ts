// The devices a machine can mount (state.devices: USB disks, partitions
// described by a chapter, or file systems of the described storage) and the
// mounts themselves (state.mounts): attaching a tree at a mount point, mount
// -a from /etc/fstab, what a reboot detaches. The mount, umount and lsblk
// commands are in commands/disks.ts; this module doesn't depend on the
// commands (units.ts uses it at boot), so that the game's list of commands
// is complete whatever the order the modules are loaded in.

import type { Directory, Node } from './world';
import type { Shell } from './shell';
import { storageOf } from './storage';
import { readFstab, resolveSource, systemFor } from './fstab';
import { mountNfs, type NfsMount } from './nfs';

export interface Device {
  // The whole disk (/dev/sdb) and its numbers (MAJ:MIN), removable or not.
  disk: string;
  majmin: [number, number];
  removable: boolean;
  size: number;
  system: string;
  label?: string;
  uuid: string;
  tree: Directory;
  // How long the device takes to appear at boot (ms): an old USB disk spinning up.
  delay?: number;
}

export interface Mount {
  path: string;
  capacity: number;
  name: string;
  system?: string;
  onlyRead?: boolean;
  options?: string;
  // What the mount point hid, given back on unmount.
  cache?: { children: Record<string, Node>; owner?: string; group?: string; mode?: string };
  // A network mount (see nfs.ts).
  nfs?: NfsMount;
}

export const devices = (game: Shell): Record<string, Device> => game.state.devices ?? {};

/** A source of /etc/fstab or mount (/dev/vdb1, UUID=…, LABEL=…) among the simple devices (state.devices). */
export function deviceFor(game: Shell, source: string): string | null {
  const m = /^(UUID|LABEL)=(.*)$/.exec(source);
  const value = m?.[2].replace(/^"|"$/g, '');
  const found = Object.entries(devices(game)).find(([path, d]) => (m ? (m[1] === 'UUID' ? d.uuid === value : d.label === value) : path === source));
  return found?.[0] ?? null;
}
export const mounts = (game: Shell): Mount[] => (game.state.mounts ??= []);

export const DMESG = '\n       dmesg(1) may have more information after failed mount system call.';

// On a machine with described storage (storage.ts), a file system that can be mounted.
export function periphStockage(game: Shell, source: string): (Device & { name: string }) | null {
  const st = storageOf(game);
  if (!st) return null;
  const dev = resolveSource(st, source);
  const fs = dev ? systemFor(st, dev) : null;
  if (!dev || !fs?.tree) return null;
  return { name: dev, disk: dev, majmin: [8, 0], removable: false, size: fs.bytes ?? 0, system: fs.type, label: fs.label, uuid: fs.uuid, tree: fs.tree };
}

// mount -a: everything /etc/fstab describes (except noauto) that isn't already mounted.
export function mountAll(game: Shell): string {
  if (game.who !== 'root') return game.error('mount: only root can use "--all" option');
  const text = game.read('/etc/fstab') ?? '';
  const { inputs, errors } = readFstab(text);
  for (const n of errors) game.error(`mount: /etc/fstab: parse error at line ${n} -- ignored`);
  const st = storageOf(game);
  for (const e of inputs) {
    if (e.type === 'swap' || e.options.includes('noauto') || mounts(game).some((m) => m.path === e.target)) continue;
    if (e.type.startsWith('nfs')) {
      const r = mountNfs(game, e.source, e.target, e.options.join(','));
      if (r) game.error(r, 32);
      continue;
    }
    // A machine without described storage: its simple devices (state.devices).
    if (!st) {
      const d = deviceFor(game, e.source);
      if (!d) {
        if (!e.options.includes('nofail')) game.error(`mount: ${e.target}: special device ${e.source} does not exist.${DMESG}`, 32);
        continue;
      }
      if (mounts(game).some((m) => m.name === d)) continue;
      const r = brancher(game, d, e.target, e.options.join(','));
      if (r) game.error(r, 32);
      continue;
    }
    const dev = resolveSource(st, e.source);
    if (!dev || !systemFor(st, dev)) {
      // nofail: a missing medium is not an error.
      if (!e.options.includes('nofail')) game.error(`mount: ${e.target}: special device ${e.source} does not exist.${DMESG}`, 32);
      continue;
    }
    if (mounts(game).some((m) => m.name === dev)) continue;
    const r = brancher(game, e.source, e.target, e.options.join(','));
    if (r) game.error(r, 32);
  }
  // util-linux warns when fstab changed since systemd read it.
  if (game.state.fstabRead !== undefined && game.state.fstabRead !== text)
    game.error("mount: (hint) your fstab has been modified, but systemd still uses\n       the old version; use 'systemctl daemon-reload' to reload.");
  return '';
}

/** Mounts a source on a point (returns mount's error message, or ''). */
export function brancher(game: Shell, source: string, point: string, options: string): string {
  const absolute = game.resolve(point);
  const p = devices(game)[source] ? { ...devices(game)[source], name: source } : periphStockage(game, source);
  if (!p) return `mount: ${absolute}: special device ${source} does not exist.${DMESG}`;
  const place = game.find(absolute);
  if (place?.type !== 'directory') return `mount: ${absolute}: mount point does not exist.${DMESG}`;
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

/** At boot: mounts what fstab describes and can be mounted (the rest was checked before). */
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

/** Before a reboot: every simple device is detached (what the mount points hid comes back). */
export function detachDevices(game: Shell) {
  for (const m of [...mounts(game)]) {
    const p = devices(game)[m.name];
    if (!p || !m.cache) continue;
    const place = game.find(m.path) as Directory;
    p.tree.children = place.children;
    Object.assign(place, { children: m.cache.children, owner: m.cache.owner, group: m.cache.group, mode: m.cache.mode });
    game.state.mounts = mounts(game).filter((x) => x !== m);
  }
}

