// LUKS: a whole device (a disk or a partition) encrypted by dm-crypt, its
// header and its key slots, and the mappings it opens (/dev/mapper/NAME),
// the clear device you make a file system on. /etc/crypttab names the
// devices to open, with a key file or a passphrase. After cryptsetup(8)
// (https://man7.org/linux/man-pages/man8/cryptsetup.8.html, cryptsetup 2.7),
// the LUKS2 on-disk format (https://gitlab.com/cryptsetup/LUKS2-docs) and
// crypttab(5) (https://man7.org/linux/man-pages/man5/crypttab.5.html).
//
//   storage.luks  = { '/dev/sdb1': Header }      the encrypted devices
//   storage.crypt = { offsite: { device, … } }    the open mappings
//
// A key slot holds a secret: a passphrase, or the content of a key file
// (one slot each; 32 slots in LUKS2). Opening tries each slot. The clear
// file system lives in the header while the device is closed (inner), and
// in storage.fs['/dev/mapper/NAME'] while it is open.
// Differences: no real encryption (the tree is kept as is), a single cipher
// (aes-xts-plain64, 512-bit key, argon2id), no tokens, no detached header,
// no LUKS1; digests and salts are derived from the device's UUID.

import type { Game } from './shell';
import type { FilesSystem } from './fstab';
import { partitionFor, storageOf, type StorageState } from './storage';
import { sizeFor } from './lvm';
import { hex } from './commands/restic';

export interface Keyslot {
  kind: 'passphrase' | 'keyfile';
  // The passphrase, or the key file's content.
  secret: string;
}

export interface Header {
  uuid: string;
  // Slot number → key.
  slots: Record<number, Keyslot>;
  // Grows with each change of the header (luksDump shows it).
  epoch: number;
  label?: string;
  // The clear file system, while the device is closed.
  inner?: FilesSystem;
}

export interface Mapping {
  device: string;
  // How it was opened (a chapter checks a restore drill used a passphrase).
  with: Keyslot['kind'];
  slot: number;
}

// LUKS2's default header: 16 MiB before the data.
export const HEADER_BYTES = 16 * 1024 * 1024;
export const SLOTS = 32;

export const luksOf = (st: StorageState): Record<string, Header> => (st.luks ??= {});
export const cryptOf = (st: StorageState): Record<string, Mapping> => (st.crypt ??= {});

/** A device given to cryptsetup: /dev/sdb1, sdb1, /dev/disk/by-uuid/…; its /dev path if it exists. */
export function deviceFor(st: StorageState, given: string): string | null {
  const byUuid = /^(?:\/dev\/disk\/by-uuid\/|UUID=)(.+)$/.exec(given);
  if (byUuid) {
    const found = Object.entries(st.fs ?? {}).find(([, f]) => f.uuid === byUuid[1].replace(/^"|"$/g, ''));
    return found?.[0] ?? null;
  }
  const n = given.replace(/^\/dev\//, '');
  if (st.disks[n] || partitionFor(st, n) || st.arrays[n]) return `/dev/${n}`;
  if (given.startsWith('/dev/mapper/') && st.fs?.[given]) return given;
  return null;
}

/** The size of the clear device a mapping gives (the device minus the header). */
export const mappedBytes = (st: StorageState, device: string) => Math.max(0, (sizeFor(st, device.replace(/^\/dev\//, '')) ?? 0) - HEADER_BYTES);

/** The mapping open on this device, if any: [name, mapping]. */
export const mappingOf = (st: StorageState, device: string): [string, Mapping] | null =>
  Object.entries(cryptOf(st)).find(([, m]) => m.device === device) ?? null;

/** The slot a secret opens, or null. */
export function slotFor(h: Header, secret: string, kind?: Keyslot['kind']): number | null {
  for (const [n, k] of Object.entries(h.slots)) if (k.secret === secret && (!kind || k.kind === kind)) return Number(n);
  return null;
}

export const freeSlot = (h: Header): number | null => {
  for (let i = 0; i < SLOTS; i++) if (!h.slots[i]) return i;
  return null;
};

/** A LUKS2 UUID derived from the device and the moment (deterministic). */
export const newUuid = (seed: string) => {
  const x = hex(`luks-${seed}`, 32);
  return `${x.slice(0, 8)}-${x.slice(8, 12)}-4${x.slice(13, 16)}-a${x.slice(17, 20)}-${x.slice(20, 32)}`;
};

/** Formats a device: a new header (one key), and what it held is gone. */
export function format(st: StorageState, device: string, key: Keyslot, seed: string, label?: string): Header {
  const h: Header = { uuid: newUuid(`${device}-${seed}`), slots: { 0: key }, epoch: 3, ...(label ? { label } : {}) };
  luksOf(st)[device] = h;
  // Whatever file system was there is overwritten (its tree is lost).
  (st.fs ??= {})[device] = { type: 'crypto_LUKS', uuid: h.uuid, ...(label ? { label } : {}) };
  // A whole disk: its partition table goes too.
  const n = device.replace(/^\/dev\//, '');
  const d = st.disks[n];
  if (d) {
    for (const p of d.partitions) delete st.fs[`/dev/${n}${p.number}`];
    d.partitions = [];
    d.table = null;
  }
  return h;
}

/** Opens a device under a name: its clear file system appears as /dev/mapper/NAME. */
export function open(st: StorageState, device: string, name: string, slot: number): void {
  const h = luksOf(st)[device];
  cryptOf(st)[name] = { device, with: h.slots[slot].kind, slot };
  if (h.inner) {
    (st.fs ??= {})[`/dev/mapper/${name}`] = h.inner;
    delete h.inner;
  }
}

/** Closes a mapping: the clear file system goes back into the header. */
export function close(st: StorageState, name: string): void {
  const m = cryptOf(st)[name];
  if (!m) return;
  const fs = st.fs?.[`/dev/mapper/${name}`];
  const h = luksOf(st)[m.device];
  if (fs && h) h.inner = fs;
  if (st.fs) delete st.fs[`/dev/mapper/${name}`];
  delete cryptOf(st)[name];
}

/** A device is busy: mounted, held by an open mapping, a RAID array or LVM, or (a disk) one of its partitions is. */
export function busy(j: Game, st: StorageState, device: string): boolean {
  const mounts = (j.state.mounts ?? []) as { name: string }[];
  const n = device.replace(/^\/dev\//, '');
  const parts = st.disks[n] ? st.disks[n].partitions.map((p) => `${n}${p.number}`) : [];
  return [n, ...parts].some(
    (x) =>
      mounts.some((m) => m.name === `/dev/${x}`) ||
      !!mappingOf(st, `/dev/${x}`) ||
      Object.values(st.arrays).some((g) => g.members.some((m) => m.part === x)) ||
      !!st.lvm?.pvs[x],
  );
}

// ——— /etc/crypttab ———

export interface CrypttabEntry {
  line: number;
  name: string;
  source: string;
  key: string;
  options: string[];
}

/** /etc/crypttab: name, source device, key file (none or - : a passphrase), options. */
export function readCrypttab(text: string): CrypttabEntry[] {
  const entries: CrypttabEntry[] = [];
  text.split('\n').forEach((raw, i) => {
    const l = raw.trim();
    if (!l || l.startsWith('#')) return;
    const [name, source, key = 'none', options = ''] = l.split(/\s+/);
    if (!source) return;
    entries.push({ line: i + 1, name, source, key, options: options.split(',').filter(Boolean) });
  });
  return entries;
}

/** /dev/mapper/NAME files follow the open mappings (for ls and completion). */
export function mapperUpdate(j: Game): void {
  const st = storageOf(j);
  const dev = j.find('/dev');
  if (!st || dev?.type !== 'directory') return;
  const names = Object.keys(cryptOf(st));
  const mapper = (dev.children.mapper ??= { type: 'directory', children: { control: { type: 'file', content: '', owner: 'root', mode: 'rw-------' } }, owner: 'root', mode: 'rwxr-xr-x' });
  if (mapper.type !== 'directory') return;
  for (const k of Object.keys(mapper.children)) if (k !== 'control' && !names.includes(k) && !k.includes('-')) delete mapper.children[k];
  for (const n of names) mapper.children[n] ??= { type: 'file', content: '', owner: 'root', group: 'disk', mode: 'rw-rw----', lines: true };
}
