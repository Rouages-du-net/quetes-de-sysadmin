// The persistent journal on disk: /var/log/journal/MACHINE-ID/, the active
// files (system.journal, user-1000.journal) and the archived ones
// (system@…-…-….journal), with their sizes (they count in df and du).
// journald keeps it under SystemMaxUse= (journald.conf, its drop-ins in
// journald.conf.d), applied when systemd-journald starts; journalctl
// --disk-usage and --vacuum-size/--vacuum-time/--vacuum-files measure and
// trim it.
// Sources: https://www.freedesktop.org/software/systemd/man/latest/journald.conf.html,
// https://www.freedesktop.org/software/systemd/man/latest/journalctl.html#--vacuum-size=
// Simplifications: only SystemMaxUse= (and SystemKeepFree= is ignored);
// an archived file's date is in its name; the active file is never removed.

import { f, type Directory, type File } from './world';
import type { Game } from './shell';
import { systemd } from './systemd';
import { readSize } from './memory';

export const JOURNAL = '/var/log/journal';
export const JOURNALD_CONF = '/etc/systemd/journald.conf';

export interface JournalFile {
  path: string;
  name: string;
  node: File;
  size: number;
  archived: boolean;
  // When it was archived (ms), read in the name: system@…-0000000000a3f1c2-0006108b5c2e6000.journal.
  time: number;
}

/** The journal's files, the oldest first. */
export function journalFiles(j: Game): JournalFile[] {
  const root = j.find(JOURNAL);
  if (root?.type !== 'directory') return [];
  const out: JournalFile[] = [];
  for (const [id, dir] of Object.entries(root.children)) {
    if (dir.type !== 'directory') continue;
    for (const [name, n] of Object.entries((dir as Directory).children)) {
      if (n.type !== 'file' || !name.endsWith('.journal')) continue;
      const stamp = /-([0-9a-f]{16})\.journal$/.exec(name);
      out.push({ path: `${JOURNAL}/${id}/${name}`, name, node: n as File, size: (n as File).size ?? 0, archived: name.includes('@'), time: stamp ? Number(BigInt(`0x${stamp[1]}`) / 1000n) : Infinity });
    }
  }
  return out.sort((a, b) => a.time - b.time);
}

export const usage = (j: Game) => journalFiles(j).reduce((t, f) => t + f.size, 0);

/** "3.9G", "128.0M", like journalctl. */
export function human(bytes: number): string {
  const units = ['B', 'K', 'M', 'G', 'T'];
  let v = bytes;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return i === 0 ? `${v}B` : `${v.toFixed(1)}${units[i]}`;
}

/** Removes archived files, the oldest first, while `keep` says so; journalctl's lines. */
export function vacuum(j: Game, keep: (remaining: JournalFile[], f: JournalFile) => boolean): string[] {
  const lines: string[] = [];
  let freed = 0;
  let dir = '';
  for (const f of journalFiles(j)) {
    const remaining = journalFiles(j);
    if (!f.archived || keep(remaining, f)) continue;
    const parent = j.find(f.path.replace(/\/[^/]+$/, '')) as Directory;
    delete parent.children[f.name];
    freed += f.size;
    dir = f.path.replace(/\/[^/]+$/, '');
    lines.push(`Deleted archived journal ${f.path} (${human(f.size)}).`);
  }
  lines.push(`Vacuuming done, freed ${human(freed)} of archived journals from ${dir || `${JOURNAL}/${machineId(j)}`}.`);
  return lines;
}

export const machineId = (j: Game): string => {
  const root = j.find(JOURNAL);
  return root?.type === 'directory' ? (Object.keys(root.children)[0] ?? '') : '';
};

/** SystemMaxUse= as journald reads it: journald.conf, then its drop-ins (the last wins); null: the default. */
export function systemMaxUse(j: Game): number | null {
  const files = [JOURNALD_CONF];
  const dropins = j.find(`${JOURNALD_CONF}.d`);
  if (dropins?.type === 'directory') files.push(...Object.keys(dropins.children).filter((n) => n.endsWith('.conf')).sort().map((n) => `${JOURNALD_CONF}.d/${n}`));
  let value: number | null = null;
  for (const f of files) {
    let section = '';
    for (const raw of (j.read(f) ?? '').split('\n')) {
      const l = raw.trim();
      if (/^\[.*\]$/.test(l)) section = l;
      const m = /^SystemMaxUse\s*=\s*(\S*)$/.exec(l);
      if (m && section === '[Journal]') value = m[1] === '' ? null : readSize(m[1]);
    }
  }
  return value;
}

/** systemd-journald starts: it reads its limit, then trims the archived files beyond it. */
export function startJournald(j: Game) {
  // A new active file, if it was deleted (journald opens or creates it).
  const dir = j.find(`${JOURNAL}/${machineId(j)}`);
  if (dir?.type === 'directory' && !dir.children['system.journal'])
    dir.children['system.journal'] = f('', { owner: 'root', group: 'systemd-journal', mode: 'rw-r-----', size: 8 * 1024 * 1024 });
  const limit = systemMaxUse(j);
  j.state.journalLimit = limit;
  if (limit !== null) vacuum(j, (remaining) => remaining.reduce((t, f) => t + f.size, 0) <= limit);
}

/** The active file grows (a service writes): bytes added to system.journal. */
export function grow(j: Game, bytes: number) {
  const active = journalFiles(j).find((f) => f.name === 'system.journal');
  if (!active) return;
  active.node.size = (active.node.size ?? 0) + bytes;
  // journald rotates the active file at 128M, then trims to its limit.
  if (active.node.size > 128 * 1024 * 1024) {
    const parent = j.find(active.path.replace(/\/[^/]+$/, '')) as Directory;
    const now = BigInt(systemd(j)?.clock ?? 0) * 1000n;
    const name = `system@6d1f3c2a9b8e47f0a1c2d3e4f5a6b7c8-${(0xa3f1c2n + now / 1000000n).toString(16).padStart(16, '0')}-${now.toString(16).padStart(16, '0')}.journal`;
    parent.children[name] = { ...active.node, size: active.node.size };
    active.node.size = 8 * 1024 * 1024;
    const limit = j.state.journalLimit as number | null | undefined;
    if (limit) vacuum(j, (remaining) => remaining.reduce((t, f) => t + f.size, 0) <= limit);
  }
}
