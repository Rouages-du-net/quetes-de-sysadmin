// LVM (Linux's logical volume manager) on a machine's storage
// (storage.ts): physical volumes (PV: a disk, a partition or a RAID
// array), gathered into volume groups (VG), in which logical volumes (LV)
// are carved out to hold the file systems.
// An LV is a series of pieces (segments) taken from the PVs of its group,
// in 4 MiB extents. Growing an LV does not change its file system:
// resize2fs (or lvextend -r) must follow. Based on lvm(8),
// lvextend(8), pvmove(8) (https://man7.org/linux/man-pages/man8/lvm.8.html)
// and resize2fs(8) (https://man7.org/linux/man-pages/man8/resize2fs.8.html).
//
//   state.storage.lvm = { pvs: { md1: { vg: 'lab', uuid } }, vgs: { lab: { uuid, lvs: { photos: { segments, fs } } } } }
//
// Differences: a single extent size (4 MiB), no real metadata, no
// snapshots or thin volumes; the file system is always ext4, and its size
// is kept next to the LV.

import type { Game } from './shell';
import { SECTOR, partitionFor, type StorageState } from './storage';

export const EXTENT = 4 * 1024 * 1024;
// The space LVM keeps at the start of each PV for its metadata.
const PV_HEADER = 1024 * 1024;

export interface Segment {
  pv: string;
  extents: number;
}

export interface LogicVolume {
  segments: Segment[];
  // The size of the ext4 file system it holds (bytes), and where it is mounted.
  fs: number;
  point?: string;
  // Its device number (253:n, device-mapper).
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

export const lvm = (st: StorageState): Lvm => (st.lvm ??= { pvs: {}, vgs: {} });

/** The size of a device (sda, sdb2, md1), in bytes, or null if it does not exist. */
export function sizeFor(st: StorageState, name: string): number | null {
  if (st.arrays[name]) return st.arrays[name].blocks * 1024;
  if (st.disks[name]) return st.disks[name].sectors * SECTOR;
  const p = partitionFor(st, name);
  return p ? p.p.sectors * SECTOR : null;
}

/** A PV's extents. */
export const pvExtents = (st: StorageState, pv: string) => Math.floor(((sizeFor(st, pv) ?? 0) - PV_HEADER) / EXTENT);
/** The extents taken on a PV by the LVs of its group. */
export function socketsOn(st: StorageState, pv: string): number {
  const vg = lvm(st).pvs[pv]?.vg;
  if (!vg) return 0;
  return Object.values(lvm(st).vgs[vg].lvs).reduce((t, lv) => t + lv.segments.filter((s) => s.pv === pv).reduce((u, s) => u + s.extents, 0), 0);
}
export const pvsFor = (st: StorageState, vg: string) => Object.keys(lvm(st).pvs).filter((p) => lvm(st).pvs[p].vg === vg);
export const freeOn = (st: StorageState, pv: string) => pvExtents(st, pv) - socketsOn(st, pv);
export const lvExtents = (lv: LogicVolume) => lv.segments.reduce((t, s) => t + s.extents, 0);
export const totalVg = (st: StorageState, vg: string) => pvsFor(st, vg).reduce((t, p) => t + pvExtents(st, p), 0);
export const vgFree = (st: StorageState, vg: string) => pvsFor(st, vg).reduce((t, p) => t + freeOn(st, p), 0);

/** "/dev/lab/photos", "lab/photos", "/dev/mapper/lab-photos" → [group, volume], or null. */
export function readLv(st: StorageState, name: string): [string, string] | null {
  const mapper = /^\/dev\/mapper\/([\w.+]+)-([\w.+]+)$/.exec(name);
  const path = /^(?:\/dev\/)?([\w.+-]+)\/([\w.+-]+)$/.exec(name);
  const [vg, lv] = mapper ? [mapper[1], mapper[2]] : path && path[1] !== 'mapper' ? [path[1], path[2]] : [];
  return vg && lv && lvm(st).vgs[vg]?.lvs[lv] ? [vg, lv] : null;
}

/** Takes `n` extents for an LV, on the allowed PVs (in order), extending its last segment if possible. */
export function allocate(st: StorageState, lv: LogicVolume, n: number, pvs: string[]): void {
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

/** Is the device held by LVM (a PV in a group)? */
export const heldByLvm = (st: StorageState, name: string) => !!lvm(st).pvs[name];

/** An LV's size in bytes. */
export const lvSize = (lv: LogicVolume) => lvExtents(lv) * EXTENT;

/**
 * The way LVM writes a size: "<1.79t" (pvs, vgs, lvs: units of 1024,
 * two decimals, "<" when rounding exceeds the real value), or "<1.79 TiB"
 * in its messages.
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

/** An LV's mount (for df) follows the size of its file system. */
export function mountsUpdate(j: Game, st: StorageState): void {
  const mounts: { path: string; name: string; capacity: number }[] = j.state.mounts ?? [];
  for (const [vg, g] of Object.entries(lvm(st).vgs))
    for (const [name, lv] of Object.entries(g.lvs)) {
      const m = mounts.find((x) => x.name === `/dev/mapper/${vg}-${name}`);
      if (m) m.capacity = lv.fs;
    }
}
