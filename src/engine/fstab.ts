// /etc/fstab, read the way mount and systemd read it: one line per file
// system (source, mount point, type, options, dump, pass). The source
// is given by UUID=, LABEL=, or a /dev path (/dev/sde1,
// /dev/mapper/vg-lv, /dev/disk/by-uuid/…). At boot, systemd waits for
// each source (90 s): a missing source without the nofail option makes
// local-fs.target fail, and the machine stops in rescue mode
// (emergency). After fstab(5) (https://man7.org/linux/man-pages/man5/fstab.5.html),
// systemd.mount(5) (https://www.freedesktop.org/software/systemd/man/latest/systemd.mount.html)
// and findmnt(8).
// Differences: no swap, no network mounts, no x-systemd.* other than nofail
// and noauto; a single file system type per device.

import type { Game } from './shell';
import type { Directory } from './world';
import { partitionFor, type StorageState } from './storage';
import { readLv } from './lvm';

/** A file system on a device (/dev/md0, /dev/mapper/lab-photos, /dev/sde1). */
export interface FilesSystem {
  type: string;
  uuid: string;
  label?: string;
  // What it contains, for a medium mounted during the game (a USB disk).
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

/** The fstab lines, and those that can't be read (fewer than four fields). */
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

export const systems = (st: StorageState): Record<string, FilesSystem> => (st.fs ??= {});

/** The device (/dev/…) an fstab or mount source designates, if it exists. */
export function resolveSource(st: StorageState, source: string): string | null {
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

/** A device's file system, if it has one. */
export const systemFor = (st: StorageState, dev: string): FilesSystem | null => systems(st)[dev] ?? null;

/**
 * What systemd would find at boot with this fstab: the entries whose
 * source is missing (without nofail), which block local-fs.target.
 */
export function blocking(st: StorageState, text: string): FstabInput[] {
  return readFstab(text).inputs.filter(
    (e) => e.type !== 'swap' && !e.options.includes('noauto') && !e.options.includes('nofail') && (!resolveSource(st, e.source) || !systemFor(st, resolveSource(st, e.source)!)),
  );
}

/** The name of systemd's mount unit for a mount point (/srv/scans → srv-scans.mount). */
export const mountUnit = (target: string) => (target === '/' ? '-.mount' : `${target.replace(/^\//, '').replace(/\//g, '-')}.mount`);
/** The name of a device's unit (/dev/sdc1 → dev-sdc1.device). */
export const deviceUnit = (source: string) => `${source.replace(/^\//, '').replace(/-/g, '\\x2d').replace(/\//g, '-')}.device`;

/** The fstab as systemd read it (at boot, or at the last daemon-reload). */
export const systemdFstab = (j: Game): string => j.state.fstabRead ?? j.read('/etc/fstab') ?? '';
