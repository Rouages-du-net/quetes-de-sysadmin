// Le stockage d'une machine : ses disques (et ce que SMART en dit), leurs
// partitions (GPT), et les grappes RAID logiciel (md) qui les assemblent.
// C'est ce que lisent lsblk, smartctl, mdadm, sfdisk et grub-install, et ce
// que montre /proc/mdstat. D'après la documentation du noyau
// (https://docs.kernel.org/admin-guide/md.html), mdadm(8)
// (https://man7.org/linux/man-pages/man8/mdadm.8.html), smartctl(8)
// (https://www.smartmontools.org/browser/trunk/smartmontools/smartctl.8.in)
// et sfdisk(8) (https://man7.org/linux/man-pages/man8/sfdisk.8.html).
//
//   etat.stockage = { disques: { sda: Disque, … }, grappes: { md0: Grappe, … }, grub: ['sda'] }
//
// Une grappe RAID 1 garde le même contenu sur chacun de ses membres (des
// partitions). Un membre peut être actif, défectueux (F), ou en
// reconstruction : il reçoit la copie des autres, une grappe à la fois
// (les autres attendent : DELAYED). Le temps passe à chaque commande
// (avancer) : la reconstruction d'un gros disque prend quelques commandes.
// Écarts : RAID 1 seulement ; une seule taille de secteur (512 octets) ;
// pas de bitmap d'écriture réelle (--re-add reconstruit comme --add, mais
// plus vite) ; le contenu des disques n'est pas copié (le monde reste celui
// de la machine).

import type { Game } from './shell';
import type { Directory } from './world';
import type { Lvm } from './lvm';
import type { FilesSystem } from './fstab';

export const SECTOR = 512;

export type TypePartition = 'bios' | 'raid' | 'linux';

/** Les identifiants GPT des types de partition (sfdisk -d). */
export const GUID_TYPE: Record<TypePartition, string> = {
  bios: '21686148-6449-6E6F-744E-656564454649',
  raid: 'A19D880F-05FC-4D3B-A006-743F0F84911E',
  linux: '0FC63DAF-8483-4772-8E79-3D69D8477DE4',
};
/** Leur nom, comme sfdisk et fdisk l'affichent. */
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
  // Secteurs réalloués (5), en attente de réallocation (197), illisibles hors ligne (198).
  reallocated: number;
  inWaiting: number;
  unreadable: number;
  // Erreurs de liaison (199, UDMA_CRC) et erreurs ATA journalisées.
  crc: number;
  ataErrors: number;
  // Le verdict global (PASSED tant qu'aucun attribut n'a franchi son seuil).
  failure?: boolean;
}

export interface Disk {
  template: string;
  serial: string;
  sectors: number;
  // L'identifiant de la table GPT (label-id), ou null : disque vierge.
  table: string | null;
  partitions: Partition[];
  smart: Smart;
  // Le rang du disque (sda : 0, sdb : 1…), pour ses numéros MAJ:MIN.
  rank: number;
  // Un disque amovible (USB) : RM = 1 dans lsblk.
  removable?: boolean;
}

// spare : un membre de rechange, qui prendra la place d'un défectueux.
export type MemberState = 'actif' | 'defectueux' | 'reconstruction' | 'spare';

export interface Member {
  // La partition, sans /dev/ (sda2).
  part: string;
  // Son numéro dans la grappe (le [n] de /proc/mdstat), et sa place (RaidDevice).
  number: number;
  role: number | null;
  state: MemberState;
  // Reconstruction : la part déjà copiée (0 à 1).
  copyOf?: number;
  // Revenu par --re-add : seuls les blocs changés depuis son départ sont recopiés.
  fast?: boolean;
}

export interface Array {
  level: 'raid1';
  wanted: number;
  // La taille utile, en blocs de 1 Kio (comme /proc/mdstat).
  blocks: number;
  uuid: string;
  name: string;
  members: Member[];
  events: number;
  creation: number;
  // Les grosses grappes ont un bitmap d'écriture (ligne bitmap: de /proc/mdstat).
  bitmap?: boolean;
  // Une grappe toute neuve synchronise ses membres (resync) : la part déjà faite.
  synchro?: number;
  rank: number;
}

export interface Stockage {
  disks: Record<string, Disk>;
  arrays: Record<string, Array>;
  // Les disques où GRUB est installé (dans leur zone de démarrage).
  grub: string[];
  // LVM par-dessus (voir lvm.ts).
  lvm?: Lvm;
  // Les systèmes de fichiers, par périphérique (/dev/md0…), voir fstab.ts.
  fs?: Record<string, FilesSystem>;
}

// Débit de reconstruction (Kio/s), et temps simulé à chaque commande.
const SPEED = 180_000;
export const SECONDS_BY_COMMAND = 1800;

export const stockage = (j: Game): Stockage | null => (j.state.stockage as Stockage | undefined) ?? null;

/** « sdb2 » → le disque sdb et sa partition 2 (ou null). */
export function partitionFor(st: Stockage, name: string): { disk: string; d: Disk; p: Partition } | null {
  const m = /^(?:\/dev\/)?(sd[a-z])(\d+)$/.exec(name);
  if (!m) return null;
  const d = st.disks[m[1]];
  const p = d?.partitions.find((x) => x.number === Number(m[2]));
  return d && p ? { disk: m[1], d, p } : null;
}

/** La grappe dont cette partition est membre (sans /dev/), ou null. */
export const arrayFor = (st: Stockage, part: string): [string, Array] | null =>
  Object.entries(st.arrays).find(([, g]) => g.members.some((m) => m.part === part)) ?? null;

/** Une partition est-elle tenue par une grappe ou un montage ? (sfdisk refuse de toucher son disque.) */
export const busyDisk = (st: Stockage, disk: string) =>
  [disk, ...(st.disks[disk]?.partitions.map((p) => `${disk}${p.number}`) ?? [])].some((n) => arrayFor(st, n) !== null || !!st.lvm?.pvs[n]);

export const majmin = (st: Stockage, name: string): [number, number] => {
  const p = /^(sd[a-z])(\d*)$/.exec(name);
  if (p) return [8, st.disks[p[1]].rank * 16 + (p[2] ? Number(p[2]) : 0)];
  return [9, st.arrays[name]?.rank ?? 0];
};

/** Les membres en état de marche (actifs, ou à jour) et le compte des places tenues. */
export const active = (g: Array) => g.members.filter((m) => m.state === 'actif');
export const inRebuild = (g: Array) => g.members.filter((m) => m.state === 'reconstruction');
export const degraded = (g: Array) => active(g).length < g.wanted;
export const healthy = (g: Array) => active(g).length === g.wanted && g.members.every((m) => m.state === 'actif');

// La grappe qui reconstruit en ce moment : la première (dans l'ordre md0, md1…) ; les autres attendent.
export function rebuiltInThisMoment(st: Stockage): string | null {
  return Object.keys(st.arrays)
    .sort((a, b) => st.arrays[a].rank - st.arrays[b].rank)
    .find((n) => inRebuild(st.arrays[n]).length > 0 || st.arrays[n].synchro !== undefined) ?? null;
}

/** Le temps passe (une commande) : la reconstruction avance. */
export function advance(st: Stockage, seconds = SECONDS_BY_COMMAND): void {
  let rest = seconds;
  // Une grappe finie, la suivante commence dans le temps qui reste.
  while (rest > 0) {
    const name = rebuiltInThisMoment(st);
    if (!name) return;
    const g = st.arrays[name];
    // Une grappe neuve : la synchronisation de ses membres.
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
    m.state = 'actif';
    delete m.copyOf;
    delete m.fast;
    g.events += 1;
  }
}

/** Le premier numéro libre d'une grappe ([n] dans /proc/mdstat). */
export const freeNumber = (g: Array) => Math.max(-1, ...g.members.map((m) => m.number)) + 1;

/** La place libre (RaidDevice) d'une grappe dégradée, ou null. */
export function freePlace(g: Array): number | null {
  for (let r = 0; r < g.wanted; r++) if (!g.members.some((m) => m.role === r && m.state !== 'defectueux')) return r;
  return null;
}

// ——— /proc/mdstat ———

const bar = (copyOf: number) => {
  const full = Math.min(19, Math.floor(copyOf * 20));
  return `[${'='.repeat(full)}>${'.'.repeat(19 - full)}]`;
};

/** Le contenu de /proc/mdstat. */
export function mdstat(st: Stockage): string {
  const lines = ['Personalities : [raid1] [linear] [multipath] [raid0] [raid6] [raid5] [raid4] [raid10] '];
  const inCourse = rebuiltInThisMoment(st);
  const names = Object.keys(st.arrays).sort((a, b) => st.arrays[b].rank - st.arrays[a].rank);
  for (const name of names) {
    const g = st.arrays[name];
    // Les membres, du plus récent au plus ancien, (F) pour les défectueux.
    const members = [...g.members]
      .sort((a, b) => b.number - a.number)
      .map((m) => `${m.part}[${m.number}]${m.state === 'defectueux' ? '(F)' : m.state === 'spare' ? '(S)' : ''}`)
      .join(' ');
    lines.push(`${name} : active ${g.level} ${members}`);
    const places = Array.from({ length: g.wanted }, (_, r) => (g.members.some((m) => m.role === r && m.state === 'actif') ? 'U' : '_')).join('');
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

// ——— Tailles, comme les outils les écrivent ———

/** « 1.8T », « 32G », « 1M » : comme lsblk (puissances de 1024, un chiffre après la virgule). */
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

/** « 1.82 TiB » (fdisk, sfdisk) et « 31.97 GiB 34.33 GB » (mdadm). */
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

/** Les fichiers de périphérique de /dev suivent les disques, partitions et grappes (pour ls et la complétion). */
export function devUpdate(j: Game): void {
  const st = stockage(j);
  const dev = j.find('/dev');
  if (!st || dev?.type !== 'dossier') return;
  const names = [
    ...Object.entries(st.disks).flatMap(([n, d]) => [n, ...d.partitions.map((p) => `${n}${p.number}`)]),
    ...Object.keys(st.arrays),
  ];
  for (const k of Object.keys(dev.children)) if (/^(sd[a-z]\d*|md\d+)$/.test(k) && !names.includes(k)) delete dev.children[k];
  for (const n of names)
    dev.children[n] ??= { type: 'fichier', content: '', owner: 'root', group: 'disk', mode: 'rw-rw----', lines: true };
}

/** Un dossier /dev de départ (rempli par majDev). */
export const devDirectory = (): Directory => ({ type: 'dossier', children: {}, owner: 'root', mode: 'rwxr-xr-x' });
