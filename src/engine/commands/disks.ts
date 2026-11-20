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
import { brancher, deviceFor, devices, mountAll, mounts, DMESG, type Mount } from '../devices';
import { cifsLine, mountCifs, unmountCifs, type CifsMount } from '../cifs';
import { cryptOf, deviceFor as luksDevice, luksOf, mappedBytes, mappingOf } from '../luks';
import { sizeFor } from '../lvm';
import { hex } from './restic';

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
      .map((m) => (m.cifs ? cifsLine(game, m as Mount & { cifs: CifsMount }) : m.nfs ? mountLine(game, m as Mount & { nfs: NfsMount }) : `${m.name} on ${m.path} type ${m.system ?? 'ext4'} (${m.onlyRead ? 'ro' : 'rw'},${m.options ?? 'relatime'})`))
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
  // A Windows (SMB) share: //server/share, -t cifs (mount.cifs, see cifs.ts).
  if (type === 'cifs' || type === 'smb3' || source.startsWith('//')) {
    if (positional.length === 2 && !options) options = readFstab(game.read('/etc/fstab') ?? '').inputs.find((e) => e.source === source && e.target === absolute)?.options.join(',') ?? '';
    return cifs(game, source, point, options);
  }
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

/**
 * mount.cifs's exit code (cifs-utils 7.0, mount.h): EX_USAGE (1) for what it
 * refuses before mounting, the errno for a credentials file it can't open,
 * EX_FAIL (32) when the mount itself fails.
 */
function cifsStatus(message: string): number {
  const cred = /^error (\d+) \(.*\) opening credential file /.exec(message);
  if (cred) return Number(cred[1]);
  return /^(mount\.cifs: bad UNC|bad user name|bad group name|Couldn't chdir|mount error: could not resolve)/.test(message) ? 1 : 32;
}

/** mount -t cifs (and mount.cifs): cifs-utils must be there; the password may be asked. */
export function cifs(game: Shell, source: string, point: string, options: string): string {
  const apt = game.state.apt as { installed: Record<string, string> } | undefined;
  if (apt && !apt.installed['cifs-utils'])
    return game.error(`mount: ${game.resolve(point)}: bad option; for several filesystems (e.g. nfs, cifs) you might need a /sbin/mount.<type> helper program.${DMESG}`, 32);
  const request = { source, point, options: options.split(',').filter(Boolean) };
  // The errors stay readable by the chapters (an answer to the prompt is not in game.last).
  const noted = (e: string) => ((game.state.cifsErrors ??= []) as string[]).push(e);
  const r = mountCifs(game, request);
  if (typeof r === 'string') return r ? (noted(r), game.error(r, cifsStatus(r))) : '';
  game.ask(
    r.ask,
    (typed) => {
      const again = mountCifs(game, { ...request, typed });
      if (typeof again === 'string' && again) {
        noted(again);
        game.status = cifsStatus(again);
        game.lastStatus = game.status;
        return again;
      }
      return '';
    },
    true,
  );
  return '';
}

function unmount(game: Shell, args: string[]): string {
  const target = args.find((a) => !a.startsWith('-'));
  if (!target) return game.error(game.t('umount-usage'));
  const m = mounts(game).find((x) => x.name === target || x.path === game.resolve(target));
  const shows = m?.path ?? game.resolve(target);
  if (game.who !== 'root') return game.error(`umount: ${shows}: must be superuser to unmount.`);
  if (m?.cifs) {
    if (game.cwd === m.path || game.cwd.startsWith(m.path + '/')) return game.error(`umount: ${m.path}: target is busy.`, 32);
    unmountCifs(game, m.path);
    return '';
  }
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

// mkfs.ext4 (e2fsprogs 1.47, mke2fs(8): https://man7.org/linux/man-pages/man8/mke2fs.8.html):
// a new, empty ext4 file system on a partition, a disk or an open LUKS
// mapping. What the device held is gone (a LUKS header too).
// Differences: ext4 only; no -b, -i, -m, -O; the superblock backups and
// counts follow the size, but the timings are instant.
function mkfs(game: Shell, args: string[]): string {
  let label: string | undefined;
  let force = false;
  let quiet = false;
  let type = 'ext4';
  const positional: string[] = [];
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '-L') label = args[++i];
    else if (a === '-t') type = args[++i] ?? '';
    else if (a === '-F') force = true;
    else if (a === '-q') quiet = true;
    else if (a.startsWith('-')) return game.error(`mkfs.ext4: invalid option -- '${a.replace(/^-+/, '')[0] ?? ''}'\nUsage: mkfs.ext4 [-c|-l filename] [-b block-size] [-C cluster-size]\n\t[-i bytes-per-inode] [-I inode-size] [-J journal-options]\n\t[-G flex-group-size] [-N number-of-inodes] [-d root-directory]\n\t[-m reserved-blocks-percentage] [-o creator-os]\n\t[-g blocks-per-group] [-L volume-label] [-M last-mounted-directory]\n\t[-O feature[,...]] [-r fs-revision] [-E extended-option[,...]]\n\t[-t fs-type] [-T usage-type ] [-U UUID] [-e errors_behavior][-z undo_file]\n\t[-jnqvDFSV] device [blocks-count]`, 1);
    else positional.push(a);
  }
  const banner = 'mke2fs 1.47.2 (1-Jan-2025)';
  if (type !== 'ext4') return game.error(`${banner}\n${game.t('mkfs-only-ext4')}`, 1);
  const given = positional[0];
  if (!given) return game.error('Usage: mkfs.ext4 [-L volume-label] [-F] device', 1);
  const st = storageOf(game);
  const mapping = /^\/dev\/mapper\/(.+)$/.exec(given);
  const dev = st ? (mapping && cryptOf(st)[mapping[1]] ? given : luksDevice(st, given)) : null;
  if (!st || !dev) return game.error(`${banner}\nThe file ${given} does not exist and no size was specified.`, 1);
  if (game.who !== 'root') return game.error(`${banner}\nmkfs.ext4: Permission denied while trying to determine filesystem size`, 1);
  const mounts = (game.state.mounts ?? []) as { name: string }[];
  const n = dev.replace(/^\/dev\//, '');
  const partsOf = st.disks[n]?.partitions.map((p) => `/dev/${n}${p.number}`) ?? [];
  if ([dev, ...partsOf].some((x) => mounts.some((m) => m.name === x))) return game.error(`${banner}\n${given} is mounted; will not make a filesystem here!`, 1);
  if (mappingOf(st, dev) || partsOf.some((x) => mappingOf(st, x)) || Object.values(st.arrays).some((g) => g.members.some((m) => m.part === n)))
    return game.error(`${banner}\n${given} is apparently in use by the system; will not make a filesystem here!`, 1);
  const bytes = mapping ? mappedBytes(st, cryptOf(st)[mapping[1]].device) : (sizeFor(st, n) ?? 0);
  const make = () => {
    const blocks = Math.floor(bytes / 4096);
    const groups = Math.ceil(blocks / 32768);
    const uuid = (() => {
      const x = hex(`mkfs-${dev}-${game.state.mkfsCount ?? 0}`, 32);
      return `${x.slice(0, 8)}-${x.slice(8, 12)}-4${x.slice(13, 16)}-8${x.slice(17, 20)}-${x.slice(20, 32)}`;
    })();
    game.state.mkfsCount = (game.state.mkfsCount ?? 0) + 1;
    // What was there is gone: a LUKS header, a partition table.
    delete luksOf(st)[dev];
    if (st.disks[n]) {
      for (const p of st.disks[n].partitions) delete st.fs?.[`/dev/${n}${p.number}`];
      st.disks[n].partitions = [];
      st.disks[n].table = null;
    }
    (st.fs ??= {})[dev] = {
      type: 'ext4',
      uuid,
      ...(label ? { label } : {}),
      bytes,
      tree: { type: 'directory', children: { 'lost+found': { type: 'directory', children: {}, owner: 'root', mode: 'rwx------' } }, owner: 'root', group: 'root', mode: 'rwxr-xr-x' },
    };
    game.state.mkfsDone = [...((game.state.mkfsDone as string[] | undefined) ?? []), dev];
    if (quiet) return '';
    // The backup superblocks: groups 1 and the powers of 3, 5 and 7 (sparse_super).
    const backups = [...new Set([1, ...[3, 5, 7].flatMap((b) => Array.from({ length: 20 }, (_, i) => b ** (i + 1)))])]
      .filter((g) => g < groups)
      .sort((a, b) => a - b)
      .map((g) => g * 32768);
    const lines: string[] = [];
    for (let i = 0; i < backups.length; i += 9) lines.push(`\t${backups.slice(i, i + 9).join(', ')}${i + 9 < backups.length ? ', ' : ''}`);
    return [
      `Creating filesystem with ${blocks} 4k blocks and ${groups * 8192} inodes`,
      `Filesystem UUID: ${uuid}`,
      'Superblock backups stored on blocks: ',
      ...lines,
      '',
      'Allocating group tables: done                            ',
      'Writing inode tables: done                            ',
      `Creating journal (${blocks > 1 << 25 ? 262144 : 65536} blocks): done`,
      'Writing superblocks and filesystem accounting information: done   ',
      '',
    ].join('\n');
  };
  const old = st.fs?.[dev];
  if (old && !force) {
    const who = game.who;
    game.ask(`${old.label ? `${given} contains a ${old.type} file system labelled '${old.label}'` : `${given} contains a ${old.type} file system`}\nProceed anyway? (y,N) `, (typed) => {
      if (!/^y/i.test(typed)) {
        game.status = 1;
        return '';
      }
      const before = game.who;
      game.who = who;
      try {
        return make();
      } finally {
        game.who = before;
      }
    });
    return quiet ? '' : banner;
  }
  const out = make();
  return quiet ? out : [banner, out].filter(Boolean).join('\n');
}

export const DISKS: Record<string, Command> = {
  'mkfs.ext4': { section: 8, ownOptions: true, launch: ({ args, game }) => mkfs(game, args) },
  lsblk: { options: ['f'], launch: ({ args, game }) => lsblk(game, args) },
  mount: { section: 8, ownOptions: true, launch: ({ args, game }) => mount(game, args) },
  umount: { section: 8, ownOptions: true, launch: ({ args, game }) => unmount(game, args) },
  // mount.cifs (cifs-utils), which mount -t cifs runs: mount.cifs //server/share point -o options.
  'mount.cifs': {
    section: 8,
    ownOptions: true,
    launch: ({ args, game }) => {
      const o = args.indexOf('-o');
      const options = o >= 0 ? (args[o + 1] ?? '') : '';
      const [source, point] = args.filter((a, i) => !a.startsWith('-') && (o < 0 || i !== o + 1));
      if (!source || !point) return game.error('\nUsage:  mount.cifs <remotetarget> <dir> -o <options>\n\nMount the remote target, specified as a UNC name, to a local directory.', 1);
      if (game.who !== 'root') return game.error('mount error: permission denied or not superuser and mount.cifs not installed SUID', 1);
      return cifs(game, source, point, options);
    },
  },
};
