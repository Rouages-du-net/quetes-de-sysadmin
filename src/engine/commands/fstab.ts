// blkid et findmnt (util-linux 2.40) : qui est qui parmi les disques (UUID,
// étiquette, type), ce qui est monté, et la vérification de /etc/fstab
// (findmnt --verify), à faire avant tout redémarrage. D'après blkid(8) et
// findmnt(8) : https://man7.org/linux/man-pages/man8/blkid.8.html,
// https://man7.org/linux/man-pages/man8/findmnt.8.html
// Écarts : voir docs/SCENARIOS.md (blkid, findmnt).

import type { Shell } from '../shell';
import type { Command } from './index';
import { help } from './manual';
import { arrayFor, stockage, type Stockage } from '../storage';
import { lvm } from '../lvm';
import { readFstab, resolveSource, systemFor } from '../fstab';

// Ce que blkid sait d'un périphérique : son système de fichiers, ou ce qu'il est (membre RAID, PV).
function attributes(st: Stockage, dev: string): string | null {
  const n = dev.replace(/^\/dev\//, '');
  const fs = systemFor(st, dev);
  const fields: string[] = [];
  if (fs) {
    if (fs.label) fields.push(`LABEL="${fs.label}"`);
    fields.push(`UUID="${fs.uuid}"`, 'BLOCK_SIZE="4096"', `TYPE="${fs.type}"`);
  } else if (arrayFor(st, n)) {
    const [, g] = arrayFor(st, n)!;
    fields.push(`UUID="${g.uuid}"`, `LABEL="${g.name}"`, 'TYPE="linux_raid_member"');
  } else if (lvm(st).pvs[n]) fields.push(`UUID="${lvm(st).pvs[n].uuid}"`, 'TYPE="LVM2_member"');
  const p = /^(sd[a-z])(\d+)$/.exec(n);
  const part = p ? st.disks[p[1]]?.partitions.find((x) => x.number === Number(p[2])) : undefined;
  if (part) fields.push(`PARTUUID="${part.uuid.toLowerCase()}"`);
  return fields.length ? `${dev}: ${fields.join(' ')}` : null;
}

// Tous les périphériques, dans l'ordre où blkid les trouve : disques et partitions, grappes, volumes logiques.
function all(st: Stockage): string[] {
  const disks = Object.entries(st.disks)
    .sort(([, a], [, b]) => a.rank - b.rank)
    .flatMap(([n, d]) => [`/dev/${n}`, ...d.partitions.map((p) => `/dev/${n}${p.number}`)]);
  const arrays = Object.keys(st.arrays).map((n) => `/dev/${n}`);
  const lvs = Object.entries(lvm(st).vgs).flatMap(([vg, g]) => Object.keys(g.lvs).map((lv) => `/dev/mapper/${vg}-${lv}`));
  return [...disks, ...arrays, ...lvs];
}

function blkid(game: Shell, args: string[]): string {
  const st = stockage(game);
  if (!st) return game.error('', 2);
  const value = (o: string) => (args.includes(o) ? args[args.indexOf(o) + 1] : undefined);
  const uuid = value('-U');
  const label = value('-L');
  if (uuid !== undefined || label !== undefined) {
    const dev = resolveSource(st, uuid !== undefined ? `UUID=${uuid}` : `LABEL=${label}`);
    if (!dev) return game.error('', 2);
    return dev;
  }
  const targets = args.filter((a, i) => !a.startsWith('-') && !['-U', '-L'].includes(args[i - 1]));
  const lines = (targets.length ? targets : all(st)).map((d) => attributes(st, resolveSource(st, d) ?? d));
  const found = lines.filter((l): l is string => l !== null);
  // Rien trouvé : blkid ne dit rien, et répond 2.
  if (!found.length) return game.error('', 2);
  return found.join('\n');
}

const mounts = (game: Shell): { path: string; name: string; system?: string; onlyRead?: boolean }[] => game.state.montages ?? [];

function findmnt(game: Shell, args: string[]): string {
  if (args.includes('--verify') || args.includes('-x')) return check(game, args.includes('--verbose') || args.includes('-v'));
  const target = args.find((a) => !a.startsWith('-'));
  const listing = [...mounts(game)].sort((a, b) => a.path.localeCompare(b.path));
  const chosen = target ? listing.filter((m) => m.path === game.resolve(target) || m.name === target) : listing;
  if (!chosen.length) {
    game.status = 1;
    return '';
  }
  const options = (m: (typeof listing)[0]) => `${m.onlyRead ? 'ro' : 'rw'},relatime${m.path === '/' ? ',errors=remount-ro' : ''}`;
  // L'arbre : chaque montage sous celui qui le contient.
  const depth = (m: (typeof listing)[0]) => (target ? 0 : listing.filter((x) => x !== m && (x.path === '/' || m.path.startsWith(x.path + '/'))).length);
  const targets = chosen.map((m) => `${depth(m) ? `${'  '.repeat(depth(m) - 1)}└─` : ''}${m.path}`);
  const widths = [Math.max(6, ...targets.map((c) => c.length)), Math.max(6, ...chosen.map((m) => m.name.length)), 6];
  const line = (a: string, b: string, c: string, d: string) => `${a.padEnd(widths[0])} ${b.padEnd(widths[1])} ${c.padEnd(widths[2])} ${d}`;
  return [line('TARGET', 'SOURCE', 'FSTYPE', 'OPTIONS'), ...chosen.map((m, i) => line(targets[i], m.name, m.system ?? 'ext4', options(m)))].join('\n');
}

// findmnt --verify : chaque ligne de fstab, ses sources, ses points de montage.
function check(game: Shell, verbose: boolean): string {
  const text = game.read('/etc/fstab') ?? '';
  const st = stockage(game);
  const { inputs, errors: reads } = readFstab(text);
  const outputs: string[] = [];
  let errors = 0;
  let warnings = 0;
  const views = new Set<string>();
  for (const e of inputs) {
    const notes: string[] = [];
    const dev = st ? resolveSource(st, e.source) : null;
    if (!dev) {
      errors++;
      notes.push(e.source.startsWith('/') ? `   [E] unreachable source: ${e.source}: No such file or directory` : `   [E] unreachable on-disk source: ${e.source} (no such device)`);
    } else if (verbose) notes.push(`   [ ] source ${e.source} found`);
    if (dev && st) {
      const fs = systemFor(st, dev);
      if (fs && e.type !== 'auto' && fs.type !== e.type) {
        errors++;
        notes.push(`   [E] ${e.type} does not match with on-disk ${fs.type}`);
      }
    }
    const place = game.find(e.target);
    if (e.type !== 'swap' && place?.type !== 'dossier') {
      warnings++;
      notes.push(`   [W] target does not exist`);
    }
    if (views.has(e.target)) {
      warnings++;
      notes.push(`   [W] target specified more than once`);
    }
    views.add(e.target);
    if (notes.length) outputs.push(e.target, ...notes);
  }
  const total = errors + warnings + reads.length;
  if (errors) game.status = 1;
  if (!total) return [...outputs, 'Success, no errors or warnings detected'].join('\n');
  const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;
  return [...outputs, '', `${plural(reads.length, 'parse error')}, ${plural(errors, 'error')}, ${plural(warnings, 'warning')}`].join('\n');
}

export const FSTAB: Record<string, Command> = {
  // La page de manuel de /etc/fstab (section 5), pas une commande.
  fstab: { section: 5, launch: () => '' },
  blkid: {
    section: 8,
    ownOptions: true,
    launch: ({ args, game }) => (args.includes('-h') || args.includes('--help') ? help('blkid', FSTAB.blkid, game.t) : blkid(game, args)),
  },
  findmnt: {
    section: 8,
    ownOptions: true,
    launch: ({ args, game }) => (args.includes('-h') || args.includes('--help') ? help('findmnt', FSTAB.findmnt, game.t) : findmnt(game, args)),
  },
};

