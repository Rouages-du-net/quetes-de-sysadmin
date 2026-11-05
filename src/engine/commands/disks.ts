// Disks: lsblk (util-linux) to see them, mount and umount to attach a
// file system to the tree. Based on
// https://man7.org/linux/man-pages/man8/mount.8.html and lsblk(8).
//
//   state.devices = { '/dev/sdb1': { disk, size, system, label, tree } }
//   state.mounts = [{ path, capacity, name, system, onlyRead }]
//
// Mounting makes the device's tree appear at the mount point (what was in
// the directory is hidden, not erased); unmounting detaches it. Mounted
// read-only (-o ro), nothing can be written to it.
// On a machine with described storage, mount reads /etc/fstab (see fstab.ts): mount -a,
// mount mount_point, UUID= and LABEL= sources.
// Differences: no options other than ro/rw; a single file system type
// per device.

import type { Directory } from '../world';
import type { Shell } from '../shell';
import type { Command } from './index';
import { storageOf } from '../storage';
import { readFstab, systemFor } from '../fstab';
import { lsblkStockage } from './storage';
import { mountLine, mountNfs, unmountNfs, type NfsMount } from '../nfs';
import { brancher, deviceFor, devices, mountAll, mounts, type Mount } from '../devices';

// Re-exported for the chapters (see devices.ts).
export { brancher, detachDevices, deviceFor, mountToBoot, type Device, type Mount } from '../devices';

/** "29.3G", "20G", like lsblk (powers of 1024). */
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
  // A machine with described disks (storage.ts): disks, partitions, RAID, chosen columns.
  const st = storageOf(game);
  if (st) return lsblkStockage(game, st, args);
  const complete = args.includes('-f') || args.includes('--fs');
  // The machine's disk (vda) and its mounted partitions, then the devices.
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

function mount(game: Shell, args: string[]): string {
  if (!args.length)
    return mounts(game)
      .map((m) => (m.nfs ? mountLine(game, m as Mount & { nfs: NfsMount }) : `${m.name} on ${m.path} type ${m.system ?? 'ext4'} (${m.onlyRead ? 'ro' : 'rw'},${m.options ?? 'relatime'})`))
      .join('\n');
  let options = '';
  let type = '';
  const positional: string[] = [];
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '-o') options = args[++i] ?? '';
    else if (args[i] === '-t') type = args[++i] ?? '';
    else if (args[i].startsWith('-o')) options = args[i].slice(2);
    else if (args[i] === '-a' || args[i] === '--all') return mountAll(game);
    else if (!args[i].startsWith('-')) positional.push(args[i]);
  }
  // A single argument: the mount point (or the source) of an fstab line.
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
  // A network file system: host:/path (or -t nfs, nfs4), see nfs.ts.
  if (type.startsWith('nfs') || /^[^/:]+:\//.test(source)) {
    if (positional.length === 2 && readFstab(game.read('/etc/fstab') ?? '').inputs.some((e) => e.source === source && e.target === absolute))
      options ||= readFstab(game.read('/etc/fstab') ?? '').inputs.find((e) => e.source === source && e.target === absolute)!.options.join(',');
    const r = mountNfs(game, source, point, options);
    return r ? game.error(r, 32) : '';
  }
  // UUID= or LABEL= (from fstab) on a machine with simple devices.
  if (!devices(game)[source] && !storageOf(game) && deviceFor(game, source)) {
    const r = brancher(game, deviceFor(game, source)!, point, options);
    return r ? game.error(r, 32) : '';
  }
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
  if (place?.type !== 'directory')
    return game.error(`mount: ${absolute}: mount point does not exist.\n       dmesg(1) may have more information after failed mount system call.`);
  const already = mounts(game).find((m) => m.name === source);
  if (already)
    return game.error(
      `mount: ${absolute}: ${source} already mounted on ${already.path}.\n       dmesg(1) may have more information after failed mount system call.`,
    );
  const onlyRead = options.split(',').includes('ro');
  // The directory's content is hidden (not erased) while the device is mounted on it.
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
  if (m?.nfs) {
    if (game.cwd === m.path || game.cwd.startsWith(m.path + '/')) return game.error(`umount.nfs4: ${m.path}: device is busy`);
    unmountNfs(game, m.path);
    return '';
  }
  if (!m || !m.cache) return game.error(`umount: ${shows}: not mounted.`);
  // You can't unmount a place you are in (like a process working there).
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
