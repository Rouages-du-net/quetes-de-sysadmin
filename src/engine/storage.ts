// A machine's storage: its disks (and what SMART says about them), their
// partitions (GPT), and the software RAID arrays (md) that assemble them.
// It is what lsblk, smartctl, mdadm, sfdisk and grub-install read, and what
// /proc/mdstat shows. Based on the kernel's documentation
// (https://docs.kernel.org/admin-guide/md.html), mdadm(8)
// (https://man7.org/linux/man-pages/man8/mdadm.8.html), smartctl(8)
// (https://www.smartmontools.org/browser/trunk/smartmontools/smartctl.8.in)
// and sfdisk(8) (https://man7.org/linux/man-pages/man8/sfdisk.8.html).
//
//   state.storage = { disks: { sda: Disk, … }, arrays: { md0: Array, … }, grub: ['sda'] }
//
// A RAID 1 array keeps the same content on each of its members
// (partitions). A member can be active, faulty (F), or rebuilding: it
// receives the copy from the others, one array at a time (the others
// wait: DELAYED). Time passes with each command (advance): rebuilding a
// big disk takes a few commands.
// Differences: RAID 1 only; a single sector size (512 bytes); no real
// write-intent bitmap (--re-add rebuilds like --add, but faster); the
// disks' content is not copied (the world stays the machine's).

import type { Game } from './shell';
import type { Directory } from './world';
import type { Lvm } from './lvm';
import type { FilesSystem } from './fstab';

export const SECTOR = 512;

export type TypePartition = 'bios' | 'raid' | 'linux';

/** The GPT identifiers of partition types (sfdisk -d). */
export const GUID_TYPE: Record<TypePartition, string> = {
  bios: '21686148-6449-6E6F-744E-656564454649',
  raid: 'A19D880F-05FC-4D3B-A006-743F0F84911E',
  linux: '0FC63DAF-8483-4772-8E79-3D69D8477DE4',
};
/** Their names, as sfdisk and fdisk show them. */
export const TYPE_NAME: Record<TypePartition, string> = { bios: 'BIOS boot', raid: 'Linux RAID', linux: 'Linux filesystem' };

export interface Partition {
  number: number;
  start: number;
  sectors: number;
  type: TypePartition;
  uuid: string;
}

export interface Smart {
  hours: number;
  temperature: number;
  // Reallocated sectors (5), pending reallocation (197), offline uncorrectable (198).
  reallocated: number;
  inWaiting: number;
  unreadable: number;
  // Link errors (199, UDMA_CRC) and logged ATA errors.
  crc: number;
  ataErrors: number;
  // The overall verdict (PASSED as long as no attribute has crossed its threshold).
  failure?: boolean;
}

export interface Disk {
  template: string;
  serial: string;
  sectors: number;
  // The GPT table's identifier (label-id), or null: blank disk.
  table: string | null;
  partitions: Partition[];
  smart: Smart;
  // The disk's rank (sda: 0, sdb: 1…), for its MAJ:MIN numbers.
  rank: number;
  // A removable disk (USB): RM = 1 in lsblk.
  removable?: boolean;
}

// spare: a spare member, which will take the place of a faulty one.
export type MemberState = 'active' | 'faulty' | 'rebuilding' | 'spare';

export interface Member {
  // The partition, without /dev/ (sda2).
  part: string;
  // Its number in the array (the [n] of /proc/mdstat), and its slot (RaidDevice).
  number: number;
  role: number | null;
  state: MemberState;
  // Rebuild: the part already copied (0 to 1).
  copyOf?: number;
  // Back through --re-add: only the blocks changed since it left are copied again.
  fast?: boolean;
}

export interface Array {
  level: 'raid1';
  wanted: number;
  // The usable size, in 1 KiB blocks (like /proc/mdstat).
  blocks: number;
  uuid: string;
  name: string;
  members: Member[];
  events: number;
  creation: number;
  // Large arrays have a write-intent bitmap (bitmap: line of /proc/mdstat).
  bitmap?: boolean;
  // A brand new array synchronizes its members (resync): the part already done.
  synchro?: number;
  rank: number;
}

export interface StorageState {
  disks: Record<string, Disk>;
  arrays: Record<string, Array>;
  // The disks where GRUB is installed (in their boot area).
  grub: string[];
  // LVM on top (see lvm.ts).
  lvm?: Lvm;
  // The file systems, by device (/dev/md0…), see fstab.ts.
  fs?: Record<string, FilesSystem>;
}

// Rebuild speed (KiB/s), and simulated time per command.
const SPEED = 180_000;
export const SECONDS_BY_COMMAND = 1800;

export const storageOf = (j: Game): StorageState | null => (j.state.storage as StorageState | undefined) ?? null;

/** "sdb2" → the disk sdb and its partition 2 (or null). */
export function partitionFor(st: StorageState, name: string): { disk: string; d: Disk; p: Partition } | null {
  const m = /^(?:\/dev\/)?(sd[a-z])(\d+)$/.exec(name);
  if (!m) return null;
  const d = st.disks[m[1]];
  const p = d?.partitions.find((x) => x.number === Number(m[2]));
  return d && p ? { disk: m[1], d, p } : null;
}

/** The array this partition is a member of (without /dev/), or null. */
export const arrayFor = (st: StorageState, part: string): [string, Array] | null =>
  Object.entries(st.arrays).find(([, g]) => g.members.some((m) => m.part === part)) ?? null;

/** Is a partition held by an array or a mount? (sfdisk refuses to touch its disk.) */
export const busyDisk = (st: StorageState, disk: string) =>
  [disk, ...(st.disks[disk]?.partitions.map((p) => `${disk}${p.number}`) ?? [])].some((n) => arrayFor(st, n) !== null || !!st.lvm?.pvs[n]);

export const majmin = (st: StorageState, name: string): [number, number] => {
  const p = /^(sd[a-z])(\d*)$/.exec(name);
  if (p) return [8, st.disks[p[1]].rank * 16 + (p[2] ? Number(p[2]) : 0)];
  return [9, st.arrays[name]?.rank ?? 0];
};

/** The working members (active, or up to date) and the count of slots held. */
export const active = (g: Array) => g.members.filter((m) => m.state === 'active');
export const inRebuild = (g: Array) => g.members.filter((m) => m.state === 'rebuilding');
export const degraded = (g: Array) => active(g).length < g.wanted;
export const healthy = (g: Array) => active(g).length === g.wanted && g.members.every((m) => m.state === 'active');

// The array rebuilding right now: the first one (in the order md0, md1…); the others wait.
export function rebuiltInThisMoment(st: StorageState): string | null {
  return Object.keys(st.arrays)
    .sort((a, b) => st.arrays[a].rank - st.arrays[b].rank)
    .find((n) => inRebuild(st.arrays[n]).length > 0 || st.arrays[n].synchro !== undefined) ?? null;
}

/** Time passes (one command): the rebuild progresses. */
export function advance(st: StorageState, seconds = SECONDS_BY_COMMAND): void {
  let rest = seconds;
  // Once an array is done, the next one starts in the remaining time.
  while (rest > 0) {
    const name = rebuiltInThisMoment(st);
    if (!name) return;
    const g = st.arrays[name];
    // A new array: synchronizing its members.
    if (g.synchro !== undefined) {
      const done = g.synchro * g.blocks;
      if (done + SPEED * rest < g.blocks) {
        g.synchro = (done + SPEED * rest) / g.blocks;
        return;
      }
      rest -= Math.ceil((g.blocks - done) / SPEED);
      delete g.synchro;
      g.events += 1;
      continue;
    }
    const m = inRebuild(g)[0];
    const total = m.fast ? Math.min(g.blocks, 2_000_000) : g.blocks;
    const done = (m.copyOf ?? 0) * total;
    const possible = SPEED * rest;
    if (done + possible < total) {
      m.copyOf = (done + possible) / total;
      return;
    }
    rest -= Math.ceil((total - done) / SPEED);
    m.state = 'active';
    delete m.copyOf;
    delete m.fast;
    g.events += 1;
  }
}

/** The first free number in an array ([n] in /proc/mdstat). */
export const freeNumber = (g: Array) => Math.max(-1, ...g.members.map((m) => m.number)) + 1;

/** The free slot (RaidDevice) of a degraded array, or null. */
export function freePlace(g: Array): number | null {
  for (let r = 0; r < g.wanted; r++) if (!g.members.some((m) => m.role === r && m.state !== 'faulty')) return r;
  return null;
}

// ——— /proc/mdstat ———

const bar = (copyOf: number) => {
  const full = Math.min(19, Math.floor(copyOf * 20));
  return `[${'='.repeat(full)}>${'.'.repeat(19 - full)}]`;
};

/** The content of /proc/mdstat. */
export function mdstat(st: StorageState): string {
  const lines = ['Personalities : [raid1] [linear] [multipath] [raid0] [raid6] [raid5] [raid4] [raid10] '];
  const inCourse = rebuiltInThisMoment(st);
  const names = Object.keys(st.arrays).sort((a, b) => st.arrays[b].rank - st.arrays[a].rank);
  for (const name of names) {
    const g = st.arrays[name];
    // The members, from the most recent to the oldest, (F) for faulty ones.
    const members = [...g.members]
      .sort((a, b) => b.number - a.number)
      .map((m) => `${m.part}[${m.number}]${m.state === 'faulty' ? '(F)' : m.state === 'spare' ? '(S)' : ''}`)
      .join(' ');
    lines.push(`${name} : active ${g.level} ${members}`);
    const places = Array.from({ length: g.wanted }, (_, r) => (g.members.some((m) => m.role === r && m.state === 'active') ? 'U' : '_')).join('');
    lines.push(`      ${g.blocks} blocks super 1.2 [${g.wanted}/${active(g).length}] [${places}]`);
    const r = inRebuild(g)[0];
    if (r && name === inCourse) {
      const copyOf = r.copyOf ?? 0;
      const total = r.fast ? Math.min(g.blocks, 2_000_000) : g.blocks;
      const done = Math.floor(copyOf * total);
      const minutes = (total - done) / SPEED / 60;
      lines.push(
        `      ${bar(copyOf)}  recovery = ${(Math.floor(copyOf * 1000) / 10).toFixed(1).padStart(4)}% (${done}/${total}) finish=${minutes.toFixed(1)}min speed=${SPEED}K/sec`,
      );
    } else if (r) lines.push('      \tresync=DELAYED');
    if (g.synchro !== undefined) {
      if (name === inCourse) {
        const done = Math.floor(g.synchro * g.blocks);
        lines.push(
          `      ${bar(g.synchro)}  resync = ${(Math.floor(g.synchro * 1000) / 10).toFixed(1).padStart(4)}% (${done}/${g.blocks}) finish=${((g.blocks - done) / SPEED / 60).toFixed(1)}min speed=${SPEED}K/sec`,
        );
      } else lines.push('      \tresync=DELAYED');
    }
    if (g.bitmap) lines.push('      bitmap: 0/15 pages [0KB], 65536KB chunk');
    lines.push('');
  }
  lines.push('unused devices: <none>');
  return lines.join('\n');
}

// ——— Sizes, as the tools write them ———

/** "1.8T", "32G", "1M": like lsblk (powers of 1024, one digit after the decimal point). */
export function shortSize(bytes: number): string {
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

/** "1.82 TiB" (fdisk, sfdisk) and "31.97 GiB 34.33 GB" (mdadm). */
export function binarySize(bytes: number): string {
  const units = ['B', 'KiB', 'MiB', 'GiB', 'TiB'];
  let v = bytes;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return `${Number(v.toFixed(2))} ${units[i]}`;
}
export function decimalSize(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let v = bytes;
  let i = 0;
  while (v >= 1000 && i < units.length - 1) {
    v /= 1000;
    i++;
  }
  return `${v.toFixed(2)} ${units[i]}`;
}

// ——— /dev ———

/** The device files of /dev follow the disks, partitions and arrays (for ls and completion). */
export function devUpdate(j: Game): void {
  const st = storageOf(j);
  const dev = j.find('/dev');
  if (!st || dev?.type !== 'directory') return;
  const names = [
    ...Object.entries(st.disks).flatMap(([n, d]) => [n, ...d.partitions.map((p) => `${n}${p.number}`)]),
    ...Object.keys(st.arrays),
  ];
  for (const k of Object.keys(dev.children)) if (/^(sd[a-z]\d*|md\d+)$/.test(k) && !names.includes(k)) delete dev.children[k];
  for (const n of names)
    dev.children[n] ??= { type: 'file', content: '', owner: 'root', group: 'disk', mode: 'rw-rw----', lines: true };
}

/** A starting /dev directory (filled by devUpdate). */
export const devDirectory = (): Directory => ({ type: 'directory', children: {}, owner: 'root', mode: 'rwxr-xr-x' });
