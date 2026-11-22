// restic: encrypted, deduplicated backups, as snapshots. Based on the
// documentation of restic 0.18 (https://restic.readthedocs.io/en/stable/):
// backup, snapshots, ls, find, diff, dump, restore, forget (--keep-*
// policies), prune, check (--read-data), stats, init, key (list, add,
// remove, passwd: https://restic.readthedocs.io/en/stable/070_encryption.html).
// The repository is kept in
// state.restic (like git repositories); its files on disk (config, keys/,
// snapshots/, data/…) are unreadable without the password, and their size
// follows what the repository contains: df sees the space freed by prune.
//
//   state.restic = { [repository path]: Repo }
//
// The repository and its password come from -r and --password-file (-p),
// or from the environment (RESTIC_REPOSITORY, RESTIC_PASSWORD_FILE,
// RESTIC_PASSWORD), or the password is typed. Each key opens the repository
// with its own password (keys/); the password of a key opens nothing else.
// Differences: one output line per step instead of progress bars; one
// "pack" per snapshot; no --repository-file, no password-command.

import type { File, Node } from '../world';
import type { Shell } from '../shell';
import { wildcard } from '../tools';
import type { Command } from './index';

export interface Version {
  content: string;
  size: number;
  // Modification date (the machine's local time, milliseconds).
  modified: number;
}

export interface Snapshot {
  id: string;
  time: number;
  host: string;
  paths: string[];
  files: Record<string, Version>;
}

export interface RepoKey {
  id: string;
  password: string;
  user: string;
  host: string;
  created: number;
}

export interface Repo {
  id: string;
  // The first key's password (a repository made by a chapter); keys, when there are several.
  password: string;
  keys?: RepoKey[];
  // check --read-data was run since the last change.
  dataChecked?: boolean;
  snapshotList: Snapshot[];
  // The stored data: one pack per backup, with its blobs (stored size).
  packs: { id: string; blobs: Record<string, number> }[];
  // check was run since the repository's last modification.
  checked: boolean;
  // forget removed snapshots, without prune: the space is not given back yet.
  pruneNeeded: boolean;
}

/** The repository's keys (a repository made with one password has one key). */
export function keysOf(repo: Repo): RepoKey[] {
  return (repo.keys ??= [{ id: hex(`key-${repo.id}`), password: repo.password, user: 'root', host: '', created: 0 }]);
}

// Hexadecimal hash derived from a text (FNV-1a), always the same.
export function hex(seed: string, length = 64): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 0x01000193) >>> 0;
  let s = '';
  for (let i = 0; s.length < length; i++) {
    h = Math.imul(h ^ (i + 0x9e), 0x01000193) >>> 0;
    s += (h >>> 24).toString(16).padStart(2, '0');
  }
  return s.slice(0, length);
}

// One blob per file content: the same version is stored only once.
const blob = (path: string, v: Version) => hex(`${path}|${v.size}|${v.content}`);
// restic compresses (zstd): text shrinks, media hardly at all.
const stores = (path: string, v: Version) => Math.round(v.size * (/\.(png|jpe?g|ogg|mp3|pdf|tiff?|gz)$/i.test(path) ? 0.99 : 0.4));

/** Adds a snapshot to the repository (backup); returns what was new. */
export function addSnapshot(repo: Repo, i: Snapshot) {
  const known = new Set(repo.packs.flatMap((p) => Object.keys(p.blobs)));
  const previous = repo.snapshotList.filter((s) => s.paths.join() === i.paths.join()).at(-1);
  const fresh: Record<string, number> = {};
  let newFiles = 0;
  let changes = 0;
  for (const [path, v] of Object.entries(i.files)) {
    const b = blob(path, v);
    const before = previous?.files[path];
    if (!before) newFiles++;
    else if (blob(path, before) !== b) changes++;
    if (!known.has(b)) {
      fresh[b] = stores(path, v);
      known.add(b);
    }
  }
  if (Object.keys(fresh).length) repo.packs.push({ id: hex(`pack-${i.id}`), blobs: fresh });
  repo.snapshotList.push(i);
  repo.checked = false;
  return {
    nouveauxFichiers: newFiles,
    changes,
    inchanges: Object.keys(i.files).length - newFiles - changes,
    ajoute: Object.values(fresh).reduce((a, b) => a + b, 0),
    precedent: previous,
  };
}

export const repoSize = (d: Repo) => d.packs.reduce((t, p) => t + Object.values(p.blobs).reduce((a, b) => a + b, 0), 0);

// ——— Affichage ———

/** "54.120 MiB", like restic. */
export function size(bytes: number): string {
  const units = ['B', 'KiB', 'MiB', 'GiB', 'TiB'];
  let v = bytes;
  let u = 0;
  while (v >= 1024 && u < units.length - 1) {
    v /= 1024;
    u++;
  }
  return u === 0 ? `${v} B` : `${v.toFixed(3)} ${units[u]}`;
}

const date = (ms: number) => new Date(ms).toISOString().slice(0, 19).replace('T', ' ');
const short = (id: string) => id.slice(0, 8);

// ——— The repository on disk ———

// An encrypted file: unreadable text, of the wanted size.
const digit = (seed: string, bytes?: number): File => ({
  type: 'file',
  content: hex(seed, 96)
    .replace(/(.{48})/g, '$1\n')
    .trim(),
  size: bytes,
  lines: true,
  mode: 'r--r--r--',
});

/** Rewrites the repository's files (under `path`) according to its content. */
export function writeRepo(game: Shell, path: string, repo: Repo) {
  const n = game.find(path);
  if (n?.type !== 'directory') return;
  n.children = repoChildren(repo);
}

/** The files of a repository on disk (a chapter builds a repository on a medium with it). */
export function repoChildren(repo: Repo): Record<string, Node> {
  const place = (children: Record<string, Node>) => ({ type: 'directory' as const, children, mode: 'rwx------' });
  return {
    config: digit(`config-${repo.id}`, 155),
    keys: place(Object.fromEntries(keysOf(repo).map((k) => [k.id, digit(`key-${k.id}`, 455)]))),
    snapshots: place(Object.fromEntries(repo.snapshotList.map((i) => [i.id, digit(`instantane-${i.id}`, 290)]))),
    index: place({ [hex(`index-${repo.packs.length}-${repoSize(repo)}`)]: digit(`index-${repo.id}`, 1200 + repo.packs.length * 180) }),
    data: place(Object.fromEntries(repo.packs.map((p) => [p.id, digit(p.id, Object.values(p.blobs).reduce((a, b) => a + b, 0) + 512)]))),
    locks: place({}),
  };
}

// ——— Retention policy (forget) ———

const isoWeek = (ms: number) => {
  const d = new Date(ms);
  const thursday = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 3 - ((d.getUTCDay() + 6) % 7)));
  const start = new Date(Date.UTC(thursday.getUTCFullYear(), 0, 4));
  return `${thursday.getUTCFullYear()}-${Math.round(((thursday.getTime() - start.getTime()) / 86_400_000 + ((start.getUTCDay() + 6) % 7) - 3) / 7) + 1}`;
};

const POLITIQUES: { option: string; name: string; bucket: (ms: number, i: number) => string }[] = [
  { option: '--keep-last', name: 'last', bucket: (_, i) => String(i) },
  { option: '--keep-hourly', name: 'hourly', bucket: (ms) => date(ms).slice(0, 13) },
  { option: '--keep-daily', name: 'daily', bucket: (ms) => date(ms).slice(0, 10) },
  { option: '--keep-weekly', name: 'weekly', bucket: (ms) => isoWeek(ms) },
  { option: '--keep-monthly', name: 'monthly', bucket: (ms) => date(ms).slice(0, 7) },
  { option: '--keep-yearly', name: 'yearly', bucket: (ms) => date(ms).slice(0, 4) },
];

/** --keep-within's duration (1y6m, 3m, 30d, 12h): years, months, days and hours; null if unreadable. */
export function readWithin(text: string): { y: number; m: number; d: number; h: number } | null {
  const m = /^(?:(\d+)y)?(?:(\d+)m)?(?:(\d+)d)?(?:(\d+)h)?$/.exec(text);
  if (!m || !text) return null;
  return { y: Number(m[1] ?? 0), m: Number(m[2] ?? 0), d: Number(m[3] ?? 0), h: Number(m[4] ?? 0) };
}

/** The snapshots kept by a policy, with their reasons (like restic); `within`: --keep-within, from the latest snapshot. */
export function applyPolicy(snapshotList: Snapshot[], policy: Record<string, number>, within?: { text: string; y: number; m: number; d: number; h: number }) {
  const reasons = new Map<string, string[]>();
  const recent = [...snapshotList].sort((a, b) => b.time - a.time);
  if (within && recent.length) {
    const d = new Date(recent[0].time);
    d.setUTCFullYear(d.getUTCFullYear() - within.y, d.getUTCMonth() - within.m, d.getUTCDate() - within.d);
    const limit = d.getTime() - within.h * 3_600_000;
    for (const s of recent) if (s.time > limit) reasons.set(s.id, [`within ${within.text}`]);
  }
  for (const p of POLITIQUES) {
    const n = policy[p.name];
    if (!n) continue;
    let remaining = n;
    let last: string | null = null;
    recent.forEach((s, i) => {
      const bucket = p.bucket(s.time, i);
      if (remaining > 0 && bucket !== last) {
        reasons.set(s.id, [...(reasons.get(s.id) ?? []), `${p.name} snapshot`]);
        remaining--;
      }
      last = bucket;
    });
  }
  return reasons;
}

// ——— The command ———

interface Context {
  game: Shell;
  path: string;
  repo: Repo;
  // The key the password opened.
  key: RepoKey;
}

const HEADER = (d: Repo) => `repository ${short(d.id)} opened (version 2, compression level auto)`;

function findSnapshot(repo: Repo, id: string | undefined): Snapshot | string {
  if (!id) return 'Fatal: no snapshot ID specified';
  if (id === 'latest') return repo.snapshotList.at(-1) ?? `Fatal: failed to find snapshot: no snapshot found`;
  const found = repo.snapshotList.filter((s) => s.id.startsWith(id));
  if (found.length === 1) return found[0];
  return found.length
    ? `Fatal: failed to find snapshot: multiple IDs with prefix "${id}" found`
    : `Fatal: failed to find snapshot: no matching ID found for prefix "${id}"`;
}

const snapshotLine = (s: Snapshot) =>
  `${short(s.id)}  ${date(s.time)}  ${s.host.padEnd(12)}  ${s.paths.join(', ').padEnd(16)}  ${size(Object.values(s.files).reduce((t, v) => t + v.size, 0)).padStart(11)}`;

function snapshots({ repo }: Context): string {
  const title = `ID        Time                 Host          Paths             ${'Size'.padStart(11)}`;
  const trait = '-'.repeat(title.length);
  return [HEADER(repo), title, trait, ...repo.snapshotList.map(snapshotLine), trait, `${repo.snapshotList.length} snapshots`].join('\n');
}

function toPlural(n: number, word: string) {
  return `${n} ${word}${n === 1 ? '' : 's'}`;
}

function grid(listing: Snapshot[], reasons?: Map<string, string[]>) {
  return listing.map((s) =>
    `${short(s.id)}  ${date(s.time)}  ${s.host.padEnd(12)}  ${(reasons?.get(s.id) ?? []).join(', ').padEnd(16)}  ${s.paths.join(', ')}`.trimEnd(),
  );
}

// The blobs still used by a snapshot: prune keeps those.
function prune(c: Context): string[] {
  const { repo } = c;
  const used = new Set(repo.snapshotList.flatMap((s) => Object.entries(s.files).map(([path, v]) => blob(path, v))));
  const before = repoSize(repo);
  let removedPacks = 0;
  let rewritten = 0;
  repo.packs = repo.packs
    .map((p) => {
      const kept = Object.fromEntries(Object.entries(p.blobs).filter(([b]) => used.has(b)));
      if (!Object.keys(kept).length) {
        removedPacks++;
        return null;
      }
      if (Object.keys(kept).length < Object.keys(p.blobs).length) {
        rewritten++;
        return { id: hex(`reecrit-${p.id}`), blobs: kept };
      }
      return p;
    })
    .filter((p): p is Repo['packs'][number] => p !== null);
  const after = repoSize(repo);
  repo.pruneNeeded = false;
  repo.checked = false;
  c.game.state.resticPruned = true;
  writeRepo(c.game, c.path, repo);
  return [
    'loading indexes...',
    'loading all snapshots...',
    `finding data that is still in use for ${toPlural(repo.snapshotList.length, 'snapshot')}`,
    `[0:00] 100.00%  ${repo.snapshotList.length} / ${repo.snapshotList.length} snapshots`,
    'searching used packs...',
    'collecting packs for deletion and repacking',
    '',
    `to repack:          ${size(rewritten ? Math.round((before - after) / 10) : 0)}`,
    `to delete:          ${size(before - after)}`,
    `total prune:        ${size(before - after)}`,
    `remaining:          ${size(after)}`,
    `unused size after prune: 0 B (0.00% of remaining size)`,
    '',
    ...(rewritten ? [`repacking packs`, `[0:00] 100.00%  ${rewritten} / ${rewritten} packs repacked`] : []),
    'rebuilding index',
    `removing ${toPlural(removedPacks + rewritten, 'old pack')}`,
    'done',
  ];
}

function launch(c: Context, action: string, args: string[]): string {
  const { game, repo } = c;
  const options = new Set(args.filter((a) => a.startsWith('-')));
  const values = (name: string) => {
    const listing: string[] = [];
    args.forEach((a, i) => {
      if (a === name) listing.push(args[i + 1] ?? '');
      else if (a.startsWith(`${name}=`)) listing.push(a.slice(name.length + 1));
    });
    return listing;
  };
  // The arguments that are not options (nor their values).
  const withValue = ['--target', '--include', '-i', '--exclude', '-e', '--host', '--tag', '--path', ...POLITIQUES.map((p) => p.option), '--keep-within', '--mode'];
  const positional = args.filter((a, i) => !a.startsWith('-') && !withValue.includes(args[i - 1] ?? ''));

  if (action === 'snapshots') return snapshots(c);

  if (action === 'ls') {
    const s = findSnapshot(repo, positional[0]);
    if (typeof s === 'string') return game.error(s);
    const filter = positional.slice(1);
    const all = Object.keys(s.files).sort();
    const read = filter.length ? all.filter((p) => filter.some((f) => p === f || p.startsWith(f.replace(/\/$/, '') + '/'))) : all;
    const lines = read.map((p) =>
      options.has('-l') || options.has('--long')
        ? `-rw-r--r--  1000  1000 ${String(s.files[p].size).padStart(10)} ${date(s.files[p].modified)} ${p}`
        : p,
    );
    return [
      HEADER(repo),
      `snapshot ${short(s.id)} of [${s.paths.join(' ')}] at ${date(s.time)} by ${game.player}@${s.host}${filter.length ? ` filtered by [${filter.join(' ')}]` : ''}:`,
      ...lines,
    ].join('\n');
  }

  if (action === 'find') {
    const pattern = positional[0];
    if (!pattern) return game.error('Fatal: wrong number of arguments');
    const re = wildcard(pattern);
    const long = options.has('-l') || options.has('--long');
    const blocks: string[] = [];
    game.state.resticFound = [...((game.state.resticFound as { pattern: string; found: boolean }[] | undefined) ?? []), { pattern, found: repo.snapshotList.some((s) => Object.keys(s.files).some((p) => re.test(p) || re.test(p.split('/').at(-1)!))) }];
    for (const s of repo.snapshotList) {
      const found = Object.keys(s.files).filter((p) => re.test(p) || re.test(p.split('/').at(-1)!));
      if (!found.length) continue;
      blocks.push(
        `Found matching entries in snapshot ${short(s.id)} from ${date(s.time)}`,
        ...found.map((p) => (long ? `-rw-r--r--  1000  1000 ${String(s.files[p].size).padStart(10)} ${date(s.files[p].modified)} ${p}` : p)),
        '',
      );
    }
    return [HEADER(repo), ...blocks].join('\n').trimEnd();
  }

  if (action === 'diff') {
    const [a, b] = positional.map((id) => findSnapshot(repo, id));
    if (positional.length !== 2) return game.error('Fatal: specify two snapshot IDs');
    if (typeof a === 'string') return game.error(a);
    if (typeof b === 'string') return game.error(b);
    const paths = [...new Set([...Object.keys(a.files), ...Object.keys(b.files)])].sort();
    const lines: string[] = [];
    let n = 0;
    let r = 0;
    let m = 0;
    for (const p of paths) {
      const va = a.files[p];
      const vb = b.files[p];
      if (!va) (lines.push(`+    ${p}`), n++);
      else if (!vb) (lines.push(`-    ${p}`), r++);
      else if (blob(p, va) !== blob(p, vb)) (lines.push(`M    ${p}`), m++);
    }
    return [
      HEADER(repo),
      `comparing snapshot ${short(a.id)} to ${short(b.id)}:`,
      '',
      ...lines,
      '',
      `Files:     ${String(n).padStart(5)} new, ${String(r).padStart(5)} removed, ${String(m).padStart(5)} changed`,
    ].join('\n');
  }

  if (action === 'dump') {
    const s = findSnapshot(repo, positional[0]);
    if (typeof s === 'string') return game.error(s);
    const p = positional[1];
    if (!p) return game.error('Fatal: no file and no snapshot specified');
    const v = s.files[p];
    if (!v) return game.error(`Fatal: cannot dump file: path "${p}" not found in snapshot`);
    return v.content;
  }

  if (action === 'restore') {
    const s = findSnapshot(repo, positional[0]);
    if (typeof s === 'string') return game.error(s);
    const [target] = values('--target');
    if (!target) return game.error('Fatal: Please specify a directory to restore to (--target)');
    const included = [...values('--include'), ...values('-i')];
    const chosen = Object.keys(s.files).filter(
      (p) =>
        !included.length ||
        included.some((i) => p === i || p.startsWith(i.replace(/\/$/, '') + '/') || wildcard(i).test(p) || wildcard(i).test(p.split('/').at(-1)!)),
    );
    const base = game.resolve(target).replace(/\/$/, '');
    // restic recreates the full path under --target.
    const errors: string[] = [];
    let bytes = 0;
    if (!options.has('--dry-run'))
      for (const p of chosen) {
        const v = s.files[p];
        const parts = p.split('/').filter(Boolean);
        let place = base === '' ? '' : base;
        if (place && !game.exists(place)) {
          const e = game.place('restic', place, { type: 'directory', children: {}, owner: game.who });
          if (e) errors.push(e);
        }
        for (const part of parts.slice(0, -1)) {
          place = `${place}/${part}`;
          if (!game.exists(place)) game.place('restic', place, { type: 'directory', children: {}, owner: game.who });
        }
        const e = game.place('restic', `${place}/${parts.at(-1)}`, {
          type: 'file',
          content: v.content,
          size: v.size === v.content.length ? undefined : v.size,
          lines: true,
          owner: game.who,
        });
        if (e) errors.push(e);
        else bytes += v.size;
      }
    if (errors.length) return game.error(errors.join('\n'));
    if (!options.has('--dry-run')) game.state.resticRestoredTo = base;
    return [
      HEADER(repo),
      `restoring snapshot ${short(s.id)} of [${s.paths.join(' ')}] at ${date(s.time)} by ${game.player}@${s.host} to ${target}`,
      `Summary: Restored ${chosen.length} files/dirs (${size(bytes)}) in 0:00`,
    ].join('\n');
  }

  if (action === 'backup') {
    const paths = positional.map((p) => game.resolve(p).replace(/\/$/, ''));
    if (!paths.length) return game.error('Fatal: nothing to backup, please specify source files/dirs');
    const files: Record<string, Version> = {};
    const clock = game.state.resticClock ?? 0;
    const walk = (path: string) => {
      const n = game.find(path);
      if (!n) return;
      if (n.type === 'file') {
        const content = game.read(path) ?? '';
        files[path] = {
          content,
          size: n.size ?? new TextEncoder().encode(content).length,
          modified: (n as File & { modified?: number }).modified ?? clock,
        };
      } else for (const name of Object.keys(n.children).sort()) walk(`${path}/${name}`);
    };
    for (const ch of paths) {
      if (!game.exists(ch)) return game.error(`Fatal: unable to save snapshot: lstat ${ch}: no such file or directory`);
      walk(ch);
    }
    game.state.resticClock = clock + 60_000;
    const i: Snapshot = { id: hex(`instantane-${repo.snapshotList.length}-${clock}`), time: clock, host: game.hostName, paths, files };
    const r = addSnapshot(repo, i);
    writeRepo(game, c.path, repo);
    const total = Object.values(files).reduce((t, v) => t + v.size, 0);
    return [
      HEADER(repo),
      r.precedent ? `using parent snapshot ${short(r.precedent.id)}` : 'no parent snapshot found, will read all files',
      '',
      `Files:       ${String(r.nouveauxFichiers).padStart(4)} new, ${String(r.changes).padStart(4)} changed, ${String(r.inchanges).padStart(4)} unmodified`,
      `Added to the repository: ${size(r.ajoute)}`,
      '',
      `processed ${toPlural(Object.keys(files).length, 'file')}, ${size(total)} in 0:01`,
      `snapshot ${short(i.id)} saved`,
    ].join('\n');
  }

  if (action === 'forget') {
    const policy: Record<string, number> = {};
    for (const p of POLITIQUES) {
      const v = values(p.option)[0];
      if (v !== undefined) {
        if (!/^\d+$/.test(v))
          return game.error(`Fatal: invalid argument "${v}" for "${p.option}" flag: strconv.ParseInt: parsing "${v}": invalid syntax`);
        policy[p.name] = Number(v);
      }
    }
    const withinText = values('--keep-within')[0];
    const within = withinText === undefined ? undefined : readWithin(withinText);
    if (withinText !== undefined && !within) return game.error(`Fatal: invalid argument "${withinText}" for "--keep-within" flag: invalid duration "${withinText}"`);
    const ids = positional;
    const trial = options.has('--dry-run') || options.has('-n');
    let removed: Snapshot[];
    const output = [HEADER(repo)];
    if (ids.length) {
      const found = ids.map((id) => findSnapshot(repo, id));
      const error = found.find((t): t is string => typeof t === 'string');
      if (error) return game.error(error);
      removed = found as Snapshot[];
      output.push(...removed.map((s) => `removed snapshot ${short(s.id)}`));
    } else {
      if (!Object.keys(policy).length && !within) return [...output, 'no policy was specified, no snapshots will be removed'].join('\n');
      const reasons = applyPolicy(repo.snapshotList, policy, within ? { text: withinText!, ...within } : undefined);
      const kept = repo.snapshotList.filter((s) => reasons.has(s.id));
      removed = repo.snapshotList.filter((s) => !reasons.has(s.id));
      output.push(
        `Applying Policy: ${[
          ...(Object.keys(policy).length
            ? [
                `keep ${Object.entries(policy)
                  .map(([k, v]) => `${v} ${k}`)
                  .join(', ')} snapshots`,
              ]
            : []),
          ...(within ? [`keep snapshots within ${withinText} of the newest`] : []),
        ].join(', ')}`,
        `keep ${toPlural(kept.length, 'snapshot')}:`,
        'ID        Time                 Host          Reasons           Paths',
        ...grid(kept, reasons),
        '',
      );
      if (removed.length)
        output.push(
          `remove ${toPlural(removed.length, 'snapshot')}:`,
          'ID        Time                 Host                            Paths',
          ...grid(removed),
          '',
        );
    }
    if (trial) return [...output, 'Would have removed the snapshots above (dry run).'].join('\n');
    repo.snapshotList = repo.snapshotList.filter((s) => !removed.includes(s));
    repo.checked = false;
    if (removed.length) repo.pruneNeeded = true;
    game.state.resticForgotten = true;
    writeRepo(game, c.path, repo);
    if (removed.length) output.push(`[0:00] 100.00%  ${removed.length} / ${removed.length} files deleted`);
    if (options.has('--prune')) output.push(...prune(c));
    return output.join('\n');
  }

  if (action === 'prune') return [HEADER(repo), ...prune(c)].join('\n');

  if (action === 'check') {
    repo.checked = true;
    const readData = options.has('--read-data') || [...options].some((o) => o.startsWith('--read-data-subset'));
    if (readData) repo.dataChecked = true;
    const packs = repo.packs.length;
    return [
      'using temporary cache in /tmp/restic-check-cache-4012',
      HEADER(repo),
      'created new cache in /tmp/restic-check-cache-4012',
      'create exclusive lock for repository',
      'load indexes',
      'check all packs',
      'check snapshots, trees and blobs',
      `[0:00] 100.00%  ${repo.snapshotList.length} / ${repo.snapshotList.length} snapshots`,
      ...(readData ? ['read all data', `[0:00] 100.00%  ${packs} / ${packs} packs`] : []),
      'no errors were found',
    ].join('\n');
  }

  if (action === 'stats') {
    const raw = values('--mode')[0] === 'raw-data';
    if (raw)
      return [
        HEADER(repo),
        'scanning...',
        'Stats in raw-data mode:',
        `     Snapshots processed:  ${repo.snapshotList.length}`,
        `              Total Size:  ${size(repoSize(repo))}`,
      ].join('\n');
    return [
      HEADER(repo),
      'scanning...',
      'Stats in restore-size mode:',
      `     Snapshots processed:  ${repo.snapshotList.length}`,
      `        Total File Count:  ${repo.snapshotList.reduce((t, s) => t + Object.keys(s.files).length, 0)}`,
      `              Total Size:  ${size(repo.snapshotList.reduce((t, s) => t + Object.values(s.files).reduce((a, v) => a + v.size, 0), 0))}`,
    ].join('\n');
  }

  if (action === 'key') return key(c, positional, values);

  return game.error(`Fatal: unknown command "${action}" for "restic"\n${game.t('restic-usage')}`);
}

// ——— Keys (restic key list|add|remove|passwd) ———

/** Asks a new password twice (or reads --new-password-file), then `then`. */
function newPassword(c: Context, file: string | undefined, then: (password: string) => string): string {
  const { game } = c;
  if (file) {
    const n = game.find(file);
    if (!n || n.type !== 'file') return game.error(`Fatal: Load(<new password file>): open ${file}: no such file or directory`);
    if (!game.traverses(file) || !game.can(n, 'r')) return game.error(`Fatal: Load(<new password file>): open ${file}: permission denied`);
    return then((game.read(file) ?? '').split('\n')[0]);
  }
  const who = game.who;
  const as = <T,>(f: () => T) => {
    const before = game.who;
    game.who = who;
    try {
      return f();
    } finally {
      game.who = before;
    }
  };
  game.ask(
    'enter new password: ',
    (first) => {
      game.ask(
        'enter password again: ',
        (second) => {
          if (first !== second) return 'Fatal: passwords do not match';
          if (!first) return 'Fatal: an empty password is not allowed by default. Pass the flag `--insecure-no-password` to restic to disable this check.';
          return as(() => then(first));
        },
        true,
      );
      return '';
    },
    true,
  );
  return '';
}

function key(c: Context, positional: string[], values: (name: string) => string[]): string {
  const { game, repo } = c;
  const sub = positional[0];
  const keys = keysOf(repo);
  const clock = (game.state.resticClock ?? 0) as number;
  const made = (password: string) => {
    const k: RepoKey = {
      id: hex(`key-${repo.id}-${keys.length}-${password}`),
      password,
      user: values('--user')[0] ?? game.who,
      host: values('--host')[0] ?? game.hostName,
      created: clock,
    };
    keys.push(k);
    repo.checked = false;
    return k;
  };
  if (sub === 'list' || sub === undefined) {
    const rows = keys.map((k) => [`${k === c.key ? '*' : ' '}${short(k.id)}`, k.user, k.host, date(k.created)]);
    const head = [' ID', 'User', 'Host', 'Created'];
    const widths = head.map((h, i) => Math.max(h.length, ...rows.map((r) => r[i].length)));
    const line = (r: string[]) => r.map((x, i) => (i === r.length - 1 ? x : x.padEnd(widths[i]))).join('  ');
    const rule = '-'.repeat(widths.reduce((a, b) => a + b + 2, 0) - 2);
    return [HEADER(repo), line(head), rule, ...rows.map(line), rule].join('\n');
  }
  if (sub === 'add')
    return newPassword(c, values('--new-password-file')[0], (password) => {
      const k = made(password);
      writeRepo(game, c.path, repo);
      game.state.resticKeyAdded = true;
      return [HEADER(repo), `saved new key with ID ${k.id}`].join('\n');
    });
  if (sub === 'passwd')
    return newPassword(c, values('--new-password-file')[0], (password) => {
      const k = made(password);
      repo.keys = keys.filter((x) => x !== c.key);
      writeRepo(game, c.path, repo);
      game.state.resticKeyChanged = true;
      return [HEADER(repo), `saved new key as ${k.id}`].join('\n');
    });
  if (sub === 'remove') {
    const id = positional[1];
    if (!id) return game.error('Fatal: key remove expects one argument as the key id');
    const found = keys.filter((k) => k.id.startsWith(id));
    if (found.length !== 1) return game.error(found.length ? `Fatal: multiple IDs with prefix "${id}" found` : `Fatal: no matching ID found for prefix "${id}"`);
    if (found[0] === c.key) {
      game.state.resticRemoveCurrent = true;
      return game.error('Fatal: refusing to remove key currently used to access repository');
    }
    repo.keys = keys.filter((k) => k !== found[0]);
    repo.checked = false;
    writeRepo(game, c.path, repo);
    game.state.resticKeyRemoved = true;
    return [HEADER(repo), `removed key ${found[0].id}`].join('\n');
  }
  return game.error(`Error: unknown command "${sub}" for "restic key"\nRun 'restic key --help' for usage.`);
}

// restic init: a new, empty repository, with one key.
function init(game: Shell, path: string, given: string, passwordFile: string, envPassword: string | undefined): string {
  const create = (password: string) => {
    if (!game.exists(path)) {
      const parts = path.split('/').filter(Boolean);
      let at = '';
      for (const part of parts) {
        at += `/${part}`;
        if (game.exists(at)) continue;
        const refused = game.place('restic', at, { type: 'directory', children: {}, owner: game.who, mode: 'rwx------' });
        if (refused) return game.error(`Fatal: create repository at ${given} failed: mkdir ${at}: permission denied`);
      }
    }
    const clock = (game.state.resticClock ?? 0) as number;
    const repo: Repo = { id: hex(`repository-${path}-${clock}`), password, snapshotList: [], packs: [], checked: false, pruneNeeded: false };
    keysOf(repo)[0].host = game.hostName;
    keysOf(repo)[0].user = game.who;
    keysOf(repo)[0].created = clock;
    ((game.state.restic ??= {}) as Record<string, Repo>)[path] = repo;
    writeRepo(game, path, repo);
    game.state.resticInit = path;
    return [
      `created restic repository ${repo.id.slice(0, 10)} at ${given}`,
      '',
      'Please note that knowledge of your password is required to access',
      'the repository. Losing your password means that your data is',
      'irrecoverably lost.',
    ].join('\n');
  };
  if (passwordFile) {
    const n = game.find(passwordFile);
    if (!n || n.type !== 'file') return game.error(`Fatal: Load(<password file>): open ${passwordFile}: no such file or directory`);
    if (!game.traverses(passwordFile) || !game.can(n, 'r')) return game.error(`Fatal: Load(<password file>): open ${passwordFile}: permission denied`);
    return create((game.read(passwordFile) ?? '').trim());
  }
  if (envPassword !== undefined) return create(envPassword);
  const who = game.who;
  game.ask(
    'enter password for new repository: ',
    (first) => {
      game.ask(
        'enter password again: ',
        (second) => {
          if (first !== second) return 'Fatal: passwords do not match';
          const before = game.who;
          game.who = who;
          try {
            return [...game.recoverErrors(), create(first)].filter(Boolean).join('\n');
          } finally {
            game.who = before;
          }
        },
        true,
      );
      return '';
    },
    true,
  );
  return '';
}

const ACTIONS = ['snapshots', 'ls', 'find', 'diff', 'dump', 'restore', 'backup', 'forget', 'prune', 'check', 'stats', 'init', 'key'];

export const RESTIC: Record<string, Command> = {
  restic: {
    ownOptions: true,
    launch: ({ args, game }) => {
      if (args.includes('version')) return 'restic 0.18.0 compiled with go1.24.4 on linux/amd64';
      // The global options: -r repository, --password-file / -p file.
      let pathRepo = '';
      let mdpFile = '';
      const rest: string[] = [];
      for (let i = 0; i < args.length; i++) {
        const a = args[i];
        if (a === '-r' || a === '--repo') pathRepo = args[++i] ?? '';
        else if (a.startsWith('--repo=')) pathRepo = a.slice(7);
        else if (a === '-p' || a === '--password-file') mdpFile = args[++i] ?? '';
        else if (a.startsWith('--password-file=')) mdpFile = a.slice(16);
        else rest.push(a);
      }
      const action = rest.find((a) => !a.startsWith('-'));
      if (!action) return game.error(game.t('restic-usage'));
      if (!ACTIONS.includes(action)) return game.error(`Error: unknown command "${action}" for "restic"\nRun 'restic --help' for usage.`);
      const next = rest.slice(rest.indexOf(action) + 1);
      // The environment (export, or NAME=value before the command; sudo resets it).
      const env = game.environment ?? {};
      pathRepo ||= env.RESTIC_REPOSITORY ?? '';
      mdpFile ||= env.RESTIC_PASSWORD_FILE ?? '';
      const envPassword = mdpFile ? undefined : env.RESTIC_PASSWORD;
      if (!pathRepo) return game.error('Fatal: Please specify repository location (-r or --repository-file)');
      const path = game.resolve(pathRepo).replace(/\/$/, '');
      const depots: Record<string, Repo> = (game.state.restic ??= {});
      // A repository is recognised by its config file, wherever it is mounted (a USB key, for example).
      const repo = depots[path] ?? Object.values(depots).find((d) => game.read(`${path}/config`) === digit(`config-${d.id}`).content);
      if (action === 'init') {
        if (repo || game.exists(`${path}/config`))
          return game.error(`Fatal: create repository at ${pathRepo} failed: config file already exists`);
        return init(game, path, pathRepo, mdpFile, envPassword);
      }
      if (!repo || !game.exists(`${path}/config`))
        return game.error(
          `Fatal: repository does not exist: unable to open config file: stat ${path}/config: no such file or directory\nIs there a repository at the following location?\n${pathRepo}`,
        );
      if (!game.traverses(`${path}/config`))
        return game.error(`Fatal: unable to open config file: open ${path}/config: permission denied\nIs there a repository at the following location?\n${pathRepo}`);
      const execute = (mdp: string) => {
        const k = keysOf(repo).find((x) => x.password === mdp);
        if (!k) {
          game.state.resticWrongPassword = true;
          return game.error('Fatal: wrong password or no key found');
        }
        game.state.resticKeyUsed = k.id;
        game.state.resticKeysUsed = [...new Set([...((game.state.resticKeysUsed as string[] | undefined) ?? []), k.id])];
        // What was run, with which subcommand (key list…): the chapters read it (an answer to a prompt is not in game.last).
        const done = action === 'key' ? `key ${next.find((a) => !a.startsWith('-')) ?? 'list'}` : action;
        const output = launch({ game, path, repo, key: k }, action, next);
        game.state.resticDone = [...((game.state.resticDone as string[] | undefined) ?? []), done];
        return output;
      };
      if (mdpFile) {
        const n = game.find(mdpFile);
        if (!n || n.type !== 'file') return game.error(`Fatal: Load(<password file>): open ${mdpFile}: no such file or directory`);
        if (!game.traverses(mdpFile) || !game.can(n, 'r')) return game.error(`Fatal: Load(<password file>): open ${mdpFile}: permission denied`);
        game.state.resticPasswordFile = game.resolve(mdpFile);
        return execute((game.read(mdpFile) ?? '').trim());
      }
      if (envPassword !== undefined) return execute(envPassword);
      // Without a file, restic asks for the password (not shown, like the real prompt).
      const who = game.who;
      game.ask('enter password for repository: ', (response) => {
        const before = game.who;
        game.who = who;
        try {
          // The errors of a reply are displayed with it.
          const output = execute(response);
          return [...game.recoverErrors(), output].filter(Boolean).join('\n');
        } finally {
          game.who = before;
        }
      }, true);
      return '';
    },
  },
};
