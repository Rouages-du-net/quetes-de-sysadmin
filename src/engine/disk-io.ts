// A machine's disk I/O (state.io), for iostat, pidstat, ionice and top.
// Each program that reads or writes asks for a throughput; the disk serves
// at most `capacity`. When the demand approaches capacity, requests wait:
// the wait (await) climbs, and blocked processes push up iowait and load.
// What limits a program:
//   - IOReadBandwidthMax= / IOWriteBandwidthMax= of its service (cgroup v2,
//     io.max): works with every scheduler;
//   - ionice (idle class: only when the disk is free): only if the disk's
//     scheduler handles priorities (mq-deadline, bfq); "none", the one of
//     virtual disks, ignores them.
// Sources: https://docs.kernel.org/admin-guide/cgroup-v2.html#io,
// https://www.freedesktop.org/software/systemd/man/latest/systemd.resource-control.html#IOReadBandwidthMax=device%20bytes,
// https://man7.org/linux/man-pages/man1/ionice.1.html,
// https://docs.kernel.org/block/switching-sched.html
// Differences: a single disk; a very simplified queueing model (beyond
// 60 % of capacity, the wait climbs fast); the figures are those of the
// moment, even for iostat's first report.

import type { Game } from './shell';
import { systemd } from './systemd';
import type { Process } from './commands/system';

export interface Request {
  // The service doing this I/O (its main process), or a fixed pid.
  service?: string;
  pid?: number;
  // Requested throughputs (kB/s).
  read: number;
  write: number;
  // Reading follows writing (a copy: rsync reads at the pace it writes).
  copyOf?: boolean;
  // A program sensitive to waiting (the live stream): its wait counts for the objective.
  sensible?: boolean;
}

export interface IoState {
  disk: string;
  // The disk's scheduler (none, mq-deadline, bfq).
  scheduler: string;
  // Total throughput the disk can serve (kB/s).
  capacity: number;
  requests: Request[];
  // Classes set with ionice: pid → class (1 realtime, 2 best-effort, 3 idle) and priority.
  classes: Record<number, { cls: number; prio: number }>;
  cpus: number;
}

export const io = (j: Game): IoState | undefined => j.state.io;

export interface Rate {
  pid: number;
  command: string;
  uid: number;
  read: number;
  write: number;
  waiting: number;
  sensible: boolean;
}

// The main process of an active service.
function pidFor(j: Game, d: Request): Process | undefined {
  const all: Process[] = j.state.process ?? [];
  if (d.pid !== undefined) return all.find((p) => p.pid === d.pid);
  const s = systemd(j)?.services[d.service ?? ''];
  if (!s || s.state !== 'active') return undefined;
  const pid = s.process[0]?.pid;
  return all.find((p) => p.pid === pid);
}

// A service's io.max limits that apply to this disk (kB/s).
function limits(j: Game, e: IoState, d: Request): { read: number; write: number } {
  const s = d.service ? systemd(j)?.services[d.service] : undefined;
  const on = (l?: { device: string; bytes: number }) => (l && targetsPartition(l.device, e.disk) ? l.bytes / 1024 : Infinity);
  return { read: on(s?.readIo), write: on(s?.writeIo) };
}

/** systemd accepts the disk, one of its partitions, or a path on one of its file systems. */
export const targetsPartition = (device: string, disk: string) =>
  device === `/dev/${disk}` || new RegExp(`^/dev/${disk}\\d+$`).test(device) || (device.startsWith('/') && !device.startsWith('/dev/'));

/** Do ionice's priorities count with this scheduler? */
export const activesPriorities = (e: IoState) => e.scheduler === 'mq-deadline' || e.scheduler === 'bfq';

/** What the disk serves each program, now, and its overall state. */
export function diskState(j: Game) {
  const e = io(j)!;
  const live = e.requests.flatMap((d) => {
    const p = pidFor(j, d);
    if (!p) return [];
    const l = limits(j, e, d);
    let write = Math.min(d.write, l.write);
    let read = Math.min(d.read, l.read);
    // A copy moves at the pace of the slower of its two sides.
    if (d.copyOf) {
      const not = Math.min(d.write ? write / d.write : 1, d.read ? read / d.read : 1);
      write = d.write * not;
      read = d.read * not;
    }
    const cls = activesPriorities(e) ? (e.classes[p.pid]?.cls ?? 2) : 2;
    return [{ p, d, read, write, cls }];
  });
  const total = (v: typeof live) => v.reduce((t, x) => t + x.read + x.write, 0);
  const priority = live.filter((v) => v.cls !== 3);
  const toRepos = live.filter((v) => v.cls === 3);
  const prioRequest = total(priority);
  // The prioritised ones first; idle ones get what remains.
  const partPrio = Math.min(1, e.capacity / Math.max(prioRequest, 1));
  const rest = Math.max(0, e.capacity - prioRequest * partPrio);
  const partRepos = Math.min(1, rest / Math.max(total(toRepos), 1));
  const load = prioRequest / e.capacity;
  // The wait of a priority request: a few ms, then the queue grows.
  const waiting = 6 + Math.max(0, load - 0.6) * 1500 + (toRepos.length && partRepos > 0 ? 3 : 0);
  const rates: Rate[] = live.map((v) => {
    const part = v.cls === 3 ? partRepos : partPrio;
    return {
      pid: v.p.pid,
      command: v.p.command.split(/\s+/)[0].split('/').at(-1)!,
      uid: v.p.user === 'root' ? 0 : (j.accounts.users[v.p.user]?.uid ?? 1000),
      read: v.read * part,
      write: v.write * part,
      waiting: v.cls === 3 ? waiting * 4 : waiting,
      sensible: !!v.d.sensible,
    };
  });
  const served = rates.reduce((t, x) => t + x.read + x.write, 0);
  const utilisation = Math.min(99.8, (served / e.capacity) * 100);
  // The processes blocked waiting for the disk (state D): iowait and load.
  const blocked = rates.filter((x) => x.waiting > 50 || x.read + x.write > e.capacity * 0.2).length;
  const iowait = Math.min(85, utilisation > 50 ? utilisation * 0.8 : utilisation * 0.1);
  return { e, debits: rates, utilisation, waiting: waiting, iowait, load: 0.3 + blocked * 1.9 + (utilisation > 90 ? 1.2 : 0) };
}

/** Is the sensitive program (the live stream) served in time? */
export const timeAServed = (j: Game) =>
  diskState(j)
    .debits.filter((d) => d.sensible)
    .every((d) => d.waiting < 100);
