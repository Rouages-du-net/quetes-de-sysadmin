// LVM (lvm2 2.03, Debian 13): pvs, vgs, lvs to look; pvcreate, vgextend,
// vgreduce, pvmove and lvextend to grow; resize2fs (e2fsprogs 1.47) for
// the file system; update-initramfs so that boot knows the arrays
// (mdadm.conf). Outputs and messages based on lvm(8), lvextend(8),
// pvmove(8), resize2fs(8) and
// update-initramfs(8): https://man7.org/linux/man-pages/man8/lvm.8.html,
// https://man7.org/linux/man-pages/man8/resize2fs.8.html,
// https://manpages.debian.org/trixie/initramfs-tools-core/update-initramfs.8.en.html
// Differences: see docs/SCENARIOS.md (LVM).

import type { Shell } from '../shell';
import type { Command } from './index';
import { help } from './manual';
import { arrayFor, devUpdate, partitionFor, storageOf, type StorageState } from '../storage';
import {
  allocate,
  EXTENT,
  lvExtents,
  pvExtents,
  freeOn,
  vgFree,
  readLv,
  lvm,
  mountsUpdate,
  socketsOn,
  pvsFor,
  sizeFor,
  lvSize,
  lvmSize,
  totalVg,
} from '../lvm';

const withoutDev = (name: string) => name.replace(/^\/dev\//, '');
const KERNEL = '6.12.48+deb13-amd64';

// Without being root, LVM cannot take its lock.
const notRoot = (game: Shell) =>
  game.error('  WARNING: Running as a non-root user. Functionality may be unavailable.\n  /run/lock/lvm/P_global:aux: open failed: Permission denied', 5);

const grid = (headers: string[], lines: string[][], right: number[]) => {
  const widths = headers.map((e, i) => Math.max(e.length, ...lines.map((l) => l[i].length)));
  const line = (l: string[]) => '  ' + l.map((v, i) => (right.includes(i) ? v.padStart(widths[i]) : v.padEnd(widths[i]))).join(' ');
  return [line(headers), ...lines.map(line)].join('\n');
};

function pvs(game: Shell, st: StorageState): string {
  const l = lvm(st);
  return grid(
    ['PV', 'VG', 'Fmt', 'Attr', 'PSize', 'PFree'],
    Object.keys(l.pvs)
      .sort()
      .map((pv) => [`/dev/${pv}`, l.pvs[pv].vg ?? '', 'lvm2', l.pvs[pv].vg ? 'a--' : '---', lvmSize(pvExtents(st, pv) * EXTENT), lvmSize(freeOn(st, pv) * EXTENT)]),
    [4, 5],
  );
}

function vgs(st: StorageState): string {
  const l = lvm(st);
  return grid(
    ['VG', '#PV', '#LV', '#SN', 'Attr', 'VSize', 'VFree'],
    Object.keys(l.vgs).map((vg) => [
      vg,
      String(pvsFor(st, vg).length),
      String(Object.keys(l.vgs[vg].lvs).length),
      '0',
      'wz--n-',
      lvmSize(totalVg(st, vg) * EXTENT),
      lvmSize(vgFree(st, vg) * EXTENT),
    ]),
    [1, 2, 3, 5, 6],
  );
}

function lvs(st: StorageState): string {
  const l = lvm(st);
  return grid(
    ['LV', 'VG', 'Attr', 'LSize', 'Pool', 'Origin', 'Data%', 'Meta%', 'Move', 'Log', 'Cpy%Sync', 'Convert'],
    Object.entries(l.vgs).flatMap(([vg, g]) =>
      Object.entries(g.lvs).map(([n, lv]) => [n, vg, lv.point ? '-wi-ao----' : '-wi-a-----', lvmSize(lvSize(lv)), '', '', '', '', '', '', '', '']),
    ),
    [3],
  ).replace(/ +$/gm, '');
}

/** A device that can be given to LVM: it exists, and nothing else holds it. */
function usable(game: Shell, st: StorageState, path: string): string | null {
  const n = withoutDev(path);
  if (sizeFor(st, n) === null || !path.startsWith('/dev/')) return game.error(`  No device found for ${path}.`, 5), null;
  const p = partitionFor(st, n);
  if (arrayFor(st, n) || (p && arrayFor(st, p.disk))) return game.error(`  Cannot use ${path}: device is an md component`, 5), null;
  if (st.disks[n]?.table) return game.error(`  Cannot use ${path}: device is partitioned`, 5), null;
  return n;
}

function pvcreate(game: Shell, st: StorageState, targets: string[]): string {
  if (!targets.length) return game.error('  Please enter a physical volume path.\n  Run `pvcreate --help\' for more information.', 3);
  const outputs: string[] = [];
  for (const c of targets) {
    const pv = lvm(st).pvs[withoutDev(c)];
    if (pv?.vg) {
      game.error(`  Can't initialize physical volume "${c}" of volume group "${pv.vg}" without -ff\n  ${c}: physical volume not initialized.`, 5);
      continue;
    }
    const n = usable(game, st, c);
    if (!n) continue;
    lvm(st).pvs[n] ??= { vg: null, uuid: uuidLvm(`pv-${n}`) };
    outputs.push(`  Physical volume "${c}" successfully created.`);
  }
  devUpdate(game);
  return outputs.join('\n');
}

// LVM's UUIDs: 32 characters in groups of 6-4-4-4-4-4-6, derived from a name.
function uuidLvm(seed: string): string {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let h = 0x811c9dc5;
  let s = '';
  for (let i = 0; s.length < 32; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i % seed.length) ^ i, 0x01000193) >>> 0;
    s += alphabet[h % alphabet.length];
  }
  return [6, 4, 4, 4, 4, 4, 6].reduce<[string[], number]>(([g, k], n) => [[...g, s.slice(k, k + n)], k + n], [[], 0])[0].join('-');
}

function pvremove(game: Shell, st: StorageState, targets: string[]): string {
  if (!targets.length) return game.error('  Please enter a physical volume path\n  Run `pvremove --help\' for more information.', 3);
  const outputs: string[] = [];
  for (const c of targets) {
    const n = withoutDev(c);
    const pv = lvm(st).pvs[n];
    if (!pv) {
      game.error(`  No PV found on device ${c}.`, 5);
      continue;
    }
    if (pv.vg) {
      game.error(`  PV ${c} is used by VG ${pv.vg} so please use vgreduce first.\n  (If you are certain you need pvremove, then confirm by using --force twice.)`, 5);
      continue;
    }
    delete lvm(st).pvs[n];
    outputs.push(`  Labels on physical volume "${c}" successfully wiped.`);
  }
  return outputs.join('\n');
}

function vgextend(game: Shell, st: StorageState, args: string[]): string {
  const [vg, ...targets] = args;
  if (!vg) return game.error('  Please enter volume group name and physical volume(s)\n  Run `vgextend --help\' for more information.', 3);
  if (!lvm(st).vgs[vg]) return game.error(`  Volume group "${vg}" not found\n  Cannot process volume group ${vg}`, 5);
  if (!targets.length) return game.error('  Please enter volume group name and physical volume(s)\n  Run `vgextend --help\' for more information.', 3);
  const outputs: string[] = [];
  for (const c of targets) {
    const pv = lvm(st).pvs[withoutDev(c)];
    if (pv?.vg) return game.error(`  Physical volume '${c}' is already in volume group '${pv.vg}'\n  Unable to add physical volume '${c}' to volume group '${vg}'\n  ${c}: physical volume not initialized.`, 5);
    if (!pv) {
      // vgextend itself initialises a device that is not a PV yet.
      const n = usable(game, st, c);
      if (!n) return '';
      lvm(st).pvs[n] = { vg: null, uuid: uuidLvm(`pv-${n}`) };
      outputs.push(`  Physical volume "${c}" successfully created.`);
    }
  }
  for (const c of targets) lvm(st).pvs[withoutDev(c)].vg = vg;
  devUpdate(game);
  return [...outputs, `  Volume group "${vg}" successfully extended`].join('\n');
}

function vgreduce(game: Shell, st: StorageState, args: string[]): string {
  const [vg, ...targets] = args;
  if (!vg || !targets.length) return game.error('  Please give volume group name and physical volume paths\n  Run `vgreduce --help\' for more information.', 3);
  if (!lvm(st).vgs[vg]) return game.error(`  Volume group "${vg}" not found\n  Cannot process volume group ${vg}`, 5);
  const outputs: string[] = [];
  for (const c of targets) {
    const n = withoutDev(c);
    if (lvm(st).pvs[n]?.vg !== vg) {
      game.error(`  Physical Volume "${c}" not found in Volume Group "${vg}".`, 5);
      continue;
    }
    if (socketsOn(st, n) > 0) {
      game.error(`  Physical volume "${c}" still in use`, 5);
      continue;
    }
    if (pvsFor(st, vg).length === 1) {
      game.error(`  Can't remove final physical volume "${c}" from volume group "${vg}"`, 5);
      continue;
    }
    lvm(st).pvs[n].vg = null;
    outputs.push(`  Removed "${c}" from volume group "${vg}"`);
  }
  return outputs.join('\n');
}

function pvmove(game: Shell, st: StorageState, args: string[]): string {
  const [source, ...dest] = args.filter((a) => !a.startsWith('-'));
  if (!source) return game.error('  Please enter source physical volume.\n  Run `pvmove --help\' for more information.', 3);
  const n = withoutDev(source);
  const vg = lvm(st).pvs[n]?.vg;
  if (!vg) return game.error(`  Physical volume ${source} not in a volume group.`, 5);
  const a = socketsOn(st, n);
  if (!a) return game.error(`  No data to move for ${vg}.`, 5);
  const targets = dest.length ? dest.map(withoutDev) : pvsFor(st, vg).filter((p) => p !== n);
  for (const c of targets) if (lvm(st).pvs[c]?.vg !== vg) return game.error(`  Physical Volume "/dev/${c}" not found in Volume Group "${vg}".`, 5);
  const place = targets.reduce((t, c) => t + freeOn(st, c), 0);
  if (place < a) return game.error(`  Insufficient free space: ${a} extents needed, but only ${place} available\n  Unable to allocate mirror extents for ${vg}/pvmove0.\n  Failed to convert pvmove LV to mirrored.`, 5);
  // Each piece placed on the source moves to the destinations.
  for (const lv of Object.values(lvm(st).vgs[vg].lvs)) {
    const on = lv.segments.filter((s) => s.pv === n).reduce((t, s) => t + s.extents, 0);
    if (!on) continue;
    lv.segments = lv.segments.filter((s) => s.pv !== n);
    allocate(st, lv, on, targets);
  }
  return [25, 50, 75, 100].map((p) => `  ${source}: Moved: ${p.toFixed(2)}%`).join('\n');
}

// "+1.5T", "500G", "+100%FREE": the wanted size, in extents, or an error.
function wantedSize(st: StorageState, vg: string, current: number, l: string | null, L: string | null): number | string {
  if (L !== null) {
    const m = /^(\+?)(\d+(?:\.\d+)?)([bkmgtpBKMGTP]?)$/.exec(L);
    if (!m) return `  Invalid argument for --size: ${L}`;
    const postman = { b: 1, k: 1024, m: 1024 ** 2, g: 1024 ** 3, t: 1024 ** 4, p: 1024 ** 5 }[(m[3] || 'm').toLowerCase() as 'b']!;
    const n = Math.ceil((Number(m[2]) * postman) / EXTENT);
    return m[1] ? current + n : n;
  }
  const m = /^(\+?)(\d+)(%FREE|%VG)?$/.exec(l ?? '');
  if (!m) return `  Invalid argument for --extents: ${l}`;
  const n = m[3] === '%FREE' ? Math.floor((vgFree(st, vg) * Number(m[2])) / 100) : m[3] === '%VG' ? Math.floor((totalVg(st, vg) * Number(m[2])) / 100) : Number(m[2]);
  return m[1] ? current + n : n;
}

function lvextend(game: Shell, st: StorageState, args: string[]): string {
  let L: string | null = null;
  let l: string | null = null;
  let fs = false;
  const positional: string[] = [];
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '-L' || a === '--size') L = args[++i] ?? '';
    else if (a.startsWith('-L')) L = a.slice(2);
    else if (a.startsWith('--size=')) L = a.slice(7);
    else if (a === '-l' || a === '--extents') l = args[++i] ?? '';
    else if (a.startsWith('-l')) l = a.slice(2);
    else if (a.startsWith('--extents=')) l = a.slice(10);
    else if (a === '-r' || a === '--resizefs') fs = true;
    else if (a.startsWith('-')) return game.error(`lvextend: unrecognized option '${a}'\n  Error during parsing of command line.`, 3);
    else positional.push(a);
  }
  const [target, ...allowedPvs] = positional;
  if (!target) return game.error('  Please specify a logical volume path.\n  Run `lvextend --help\' for more information.', 3);
  if (L === null && l === null) return game.error('  Please specify either size or extents but not both.\n  Run `lvextend --help\' for more information.', 3);
  const who = readLv(st, target);
  if (!who) return game.error(`  Failed to find logical volume "${withoutDev(target)}"`, 5);
  const [vg, name] = who;
  const lv = lvm(st).vgs[vg].lvs[name];
  const before = lvExtents(lv);
  const wanted = wantedSize(st, vg, before, l, L);
  if (typeof wanted === 'string') return game.error(wanted, 3);
  if (wanted === before) return game.error(`  New size (${before} extents) matches existing size (${before} extents).`, 5);
  if (wanted < before) return game.error(`  New size given (${wanted} extents) not larger than existing size (${before} extents)`, 5);
  const permitted = allowedPvs.length ? allowedPvs.map(withoutDev) : pvsFor(st, vg);
  const free = permitted.reduce((t, p) => t + Math.max(0, freeOn(st, p)), 0);
  if (wanted - before > free) return game.error(`  Insufficient free space: ${wanted - before} extents needed, but only ${free} available`, 5);
  allocate(st, lv, wanted - before, permitted);
  const outputs = [`  Size of logical volume ${vg}/${name} changed from ${lvmSize(before * EXTENT, true)} (${before} extents) to ${lvmSize(wanted * EXTENT, true)} (${wanted} extents).`];
  if (fs) {
    outputs.push(
      `  File system ext4 found on ${vg}/${name}${lv.point ? ` mounted at ${lv.point}` : ''}.`,
      `  Extending file system ext4 to ${lvmSize(lvSize(lv), true)} (${lvSize(lv)} bytes) on ${vg}/${name}...`,
      ...growFs(st, vg, name),
      `  Extended file system ext4 on ${vg}/${name}.`,
    );
    mountsUpdate(game, st);
  }
  outputs.push(`  Logical volume ${vg}/${name} successfully resized.`);
  return outputs.join('\n');
}

const E2FS_HEADER = 'resize2fs 1.47.2 (1-Jan-2025)';
// ext4's block groups (32,768 blocks of 4 KiB) and their descriptors (64 per block).
const descriptors = (bytes: number) => Math.ceil(Math.ceil(bytes / 4096 / 32_768) / 64);

/** The file system takes up the whole LV; returns what resize2fs writes. */
function growFs(st: StorageState, vg: string, name: string): string[] {
  const lv = lvm(st).vgs[vg].lvs[name];
  const before = lv.fs;
  lv.fs = lvSize(lv);
  return [
    E2FS_HEADER,
    ...(lv.point ? [`Filesystem at /dev/mapper/${vg}-${name} is mounted on ${lv.point}; on-line resizing required`] : []),
    `old_desc_blocks = ${descriptors(before)}, new_desc_blocks = ${descriptors(lv.fs)}`,
    `The filesystem on /dev/mapper/${vg}-${name} is now ${lv.fs / 4096} (4k) blocks long.`,
    '',
  ];
}

function resize2fs(game: Shell, st: StorageState | null, args: string[]): string {
  const target = args.find((a) => !a.startsWith('-'));
  if (!target) return game.error(`Usage: resize2fs [-d debug_flags] [-f] [-F] [-M] [-P] [-p] device [-b|-s|new_size] [-S RAID-stride] [-z undo_file]\n`, 1);
  if (game.who !== 'root') return game.error(`${E2FS_HEADER}\nresize2fs: Permission denied while trying to open ${target}\nCouldn't find valid filesystem superblock.`, 1);
  const who = st ? readLv(st, target) : null;
  if (!st || !who) return game.error(`${E2FS_HEADER}\nresize2fs: No such file or directory while trying to open ${target}\nCouldn't find valid filesystem superblock.`, 1);
  const lv = lvm(st).vgs[who[0]].lvs[who[1]];
  if (lv.fs >= lvSize(lv)) return `${E2FS_HEADER}\nThe filesystem is already ${lv.fs / 4096} (4k) blocks long.  Nothing to do!\n`;
  const output = growFs(st, who[0], who[1]).join('\n');
  mountsUpdate(game, st);
  return output;
}

function updateInitramfs(game: Shell, args: string[]): string {
  if (!args.includes('-u') && !args.includes('-c')) return game.error(game.t('update-initramfs-usage'), 1);
  if (game.who !== 'root') return game.error(`update-initramfs: Generating /boot/initrd.img-${KERNEL}\ncp: cannot create regular file '/boot/initrd.img-${KERNEL}.new': Permission denied`, 1);
  // The initramfs carries mdadm's configuration as it is now.
  game.state.initramfs = { mdadm: game.read('/etc/mdadm/mdadm.conf') ?? '' };
  return `update-initramfs: Generating /boot/initrd.img-${KERNEL}`;
}

// LVM's commands: root first, then a storage model.
const withLvm =
  (f: (game: Shell, st: StorageState, args: string[]) => string, name: string) =>
  ({ args, game }: { args: string[]; game: Shell }) => {
    if (args.includes('-h') || args.includes('--help')) return help(name, LVM[name], game.t);
    if (game.who !== 'root') return notRoot(game);
    const st = storageOf(game);
    if (!st) return game.error('  No volume groups found.', 5);
    return f(game, st, args);
  };

export const LVM: Record<string, Command> = {
  pvs: { section: 8, ownOptions: true, launch: withLvm((game, st) => pvs(game, st), 'pvs') },
  vgs: { section: 8, ownOptions: true, launch: withLvm((_, st) => vgs(st), 'vgs') },
  lvs: { section: 8, ownOptions: true, launch: withLvm((_, st) => lvs(st), 'lvs') },
  pvcreate: { section: 8, ownOptions: true, launch: withLvm((game, st, args) => pvcreate(game, st, args.filter((a) => !a.startsWith('-'))), 'pvcreate') },
  vgextend: { section: 8, ownOptions: true, launch: withLvm((game, st, args) => vgextend(game, st, args.filter((a) => !a.startsWith('-'))), 'vgextend') },
  pvremove: { section: 8, ownOptions: true, launch: withLvm((game, st, args) => pvremove(game, st, args.filter((a) => !a.startsWith('-'))), 'pvremove') },
  vgreduce: { section: 8, ownOptions: true, launch: withLvm((game, st, args) => vgreduce(game, st, args.filter((a) => !a.startsWith('-'))), 'vgreduce') },
  pvmove: { section: 8, ownOptions: true, launch: withLvm((game, st, args) => pvmove(game, st, args), 'pvmove') },
  lvextend: { section: 8, ownOptions: true, launch: withLvm((game, st, args) => lvextend(game, st, args), 'lvextend') },
  resize2fs: {
    section: 8,
    ownOptions: true,
    launch: ({ args, game }) => (args.includes('--help') ? help('resize2fs', LVM.resize2fs, game.t) : resize2fs(game, storageOf(game), args)),
  },
  'update-initramfs': {
    section: 8,
    ownOptions: true,
    launch: ({ args, game }) => (args.includes('-h') || args.includes('--help') ? help('update-initramfs', LVM['update-initramfs'], game.t) : updateInitramfs(game, args)),
  },
};
