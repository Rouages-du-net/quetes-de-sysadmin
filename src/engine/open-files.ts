// The files a service keeps open (a log, most often).
// As on Linux, a file deleted (rm) while a process still has it open no
// longer exists in any directory, but its space is only given back when it
// is closed: df counts it, du no longer sees it (lsof +L1 shows it).
// A renamed file stays the one the process writes to (hence logrotate's
// postrotate, or copytruncate).
//
//   state.openFiles = [{ service, pid, user, command, fd, path, node }]

import type { File } from './world';
import type { Game } from './shell';
import { systemd } from './systemd';

export interface Open {
  service: string;
  pid: number;
  user: string;
  command: string;
  fd: number;
  // The path under which the process opened it (updated if logrotate renames it).
  path: string;
  node: File;
}

export const openSet = (j: Game): Open[] => (j.state.openFiles ??= []);

/** Is the file still held (its service is running)? */
export const held = (j: Game, o: Open) => systemd(j)?.services[o.service]?.state === 'active';

/** Has this file been deleted (no name leads to it any more)? */
export const erases = (j: Game, o: Open) => j.find(o.path) !== o.node;

/**
 * When a service starts: it opens its log (creating it if it doesn't
 * exist) in append mode. Replaces what the service held before.
 */
export function open(j: Game, o: Omit<Open, 'node'>, owner: string, group?: string): File {
  const here = j.find(o.path);
  let node: File;
  if (here?.type === 'file') node = here;
  else {
    node = { type: 'file', content: '', lines: true, owner, ...(group ? { group } : {}), mode: 'rw-r-----', size: 0 };
    const parent = j.find(o.path.replace(/\/[^/]+$/, ''));
    if (parent?.type === 'directory') parent.children[o.path.split('/').at(-1)!] = node;
  }
  j.state.openFiles = openSet(j).filter((x) => x.service !== o.service);
  openSet(j).push({ ...o, node });
  return node;
}

/** The space held by files deleted but still open, under a mount point. */
export function ghostPlace(j: Game, mount: string): number {
  return openSet(j)
    .filter((o) => held(j, o) && erases(j, o) && (mount === '/' || o.path === mount || o.path.startsWith(mount + '/')))
    .reduce((t, o) => t + (o.node.size ?? (typeof o.node.content === 'string' ? o.node.content.length : 0)), 0);
}
