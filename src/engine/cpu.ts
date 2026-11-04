// A machine's processors: how the CPU time is shared between the processes
// that want it, what nice changes, what a service's CPUQuota= caps, and the
// load average.
//
//   state.cpu = { cores, demand: { pid: cores wanted }, load: [1, 5, 15 min], at }
//
// The scheduler (CFS, then EEVDF) gives each runnable thread a share in
// proportion to its weight; a nice value of +1 lowers the weight by about
// 1.25 (sched_prio_to_weight in the kernel: 1024 at nice 0, 15 at nice 19,
// 88761 at nice -20). A process never gets more than it wants, and a
// service's CPUQuota= caps all its processes together (100 % = one CPU).
// The load average counts the threads that want to run (running or waiting
// for a CPU), whatever their nice value, averaged over 1, 5 and 15 minutes
// (an exponential decay, like the kernel's calc_load).
// Sources: https://man7.org/linux/man-pages/man7/sched.7.html,
// https://man7.org/linux/man-pages/man2/setpriority.2.html,
// https://www.freedesktop.org/software/systemd/man/latest/systemd.resource-control.html#CPUQuota=,
// https://man7.org/linux/man-pages/man5/proc_loadavg.5.html
// Simplifications (see docs/SCENARIOS.md): the share is computed between all
// processes at once (as with kernel.sched_autogroup_enabled=0 and no cgroup
// hierarchy: on a real system, autogroups and cgroups first share between
// sessions and services); CPUWeight= multiplies the weight of the service's
// processes; a process's threads all have its nice value.

import type { Game } from './shell';
import type { Process } from './commands/system';
import { systemd, type Systemd } from './systemd';

export interface Cpu {
  cores: number;
  // What each process wants (in CPUs: 1 = a busy thread, 8 = eight).
  demand: Record<number, number>;
  // The load average at `at` (systemd clock, ms).
  load: [number, number, number];
  at: number;
}

export const cpu = (j: Game): Cpu | undefined => j.state.cpu;
const processes = (j: Game): Process[] => j.state.process ?? [];

/** The weight of a nice value, like the kernel's table (1024 at 0, ×1.25 per step). */
export const weight = (nice: number) => Math.round(1024 / 1.25 ** Math.max(-20, Math.min(19, nice)));

/** The service a process belongs to (its main process or one of its processes). */
export function serviceOf(sd: Systemd | undefined, pid: number): string | null {
  if (!sd) return null;
  for (const [name, s] of Object.entries(sd.services)) if (s.state === 'active' && s.process.some((p) => p.pid === pid)) return name;
  return null;
}

/**
 * The CPU each process gets (in CPUs), in proportion to its weight, never
 * more than it wants, a service's processes together never more than its
 * CPUQuota=. What a process doesn't take goes to the others.
 */
export function shares(j: Game): Record<number, number> {
  const c = cpu(j);
  if (!c) return {};
  const sd = systemd(j);
  const live = processes(j).filter((p) => !p.zombie && !p.stopped && (c.demand[p.pid] ?? 0) > 0);
  const group = (p: Process) => serviceOf(sd, p.pid);
  const w = (p: Process) => weight(p.nice ?? 0) * ((sd?.services[group(p) ?? '']?.cpuWeight ?? 100) / 100);
  const cap = (g: string | null) => (g ? sd?.services[g]?.cpuQuota : undefined);
  const given: Record<number, number> = {};
  let free = [...live];
  let rest = c.cores;
  for (let turn = 0; turn < 100 && free.length && rest > 1e-9; turn++) {
    const total = free.reduce((t, p) => t + w(p), 0);
    const tentative = new Map(free.map((p) => [p, (rest * w(p)) / total]));
    // A process that wants less than its share: it gets what it wants.
    const content = free.filter((p) => tentative.get(p)! >= c.demand[p.pid] - 1e-9);
    if (content.length) {
      for (const p of content) {
        given[p.pid] = c.demand[p.pid];
        rest -= c.demand[p.pid];
      }
      free = free.filter((p) => !content.includes(p));
      continue;
    }
    // A service over its quota: its processes share what the quota leaves.
    const over = [...new Set(free.map(group))].find((g) => {
      const q = cap(g);
      if (q === undefined) return false;
      const taken = live.filter((p) => group(p) === g && given[p.pid] !== undefined).reduce((t, p) => t + given[p.pid], 0);
      return taken + free.filter((p) => group(p) === g).reduce((t, p) => t + tentative.get(p)!, 0) > q + 1e-9;
    });
    if (over !== undefined) {
      const members = free.filter((p) => group(p) === over);
      const taken = live.filter((p) => group(p) === over && given[p.pid] !== undefined).reduce((t, p) => t + given[p.pid], 0);
      const left = Math.max(0, cap(over)! - taken);
      const part = members.reduce((t, p) => t + w(p), 0);
      for (const p of members) {
        given[p.pid] = Math.min(c.demand[p.pid], (left * w(p)) / part);
        rest -= given[p.pid];
      }
      free = free.filter((p) => !members.includes(p));
      continue;
    }
    for (const p of free) given[p.pid] = tentative.get(p)!;
    rest = 0;
    free = [];
  }
  return given;
}

/** The threads that want to run (the load average's count). */
export const runnable = (j: Game) => {
  const c = cpu(j)!;
  return processes(j)
    .filter((p) => !p.zombie && !p.stopped)
    .reduce((t, p) => t + Math.ceil((c.demand[p.pid] ?? 0) - 1e-9), 0);
};

const PERIODS = [60_000, 300_000, 900_000];

/**
 * Brings the machine's CPU up to date: the load average decays towards the
 * current count, and the %CPU columns of ps and top follow the shares.
 */
export function refreshCpu(j: Game) {
  const c = cpu(j);
  if (!c) return;
  const now = systemd(j)?.clock ?? c.at;
  const n = runnable(j);
  const dt = Math.max(0, now - c.at);
  c.load = c.load.map((l, i) => {
    const e = Math.exp(-dt / PERIODS[i]);
    return l * e + n * (1 - e);
  }) as [number, number, number];
  c.at = now;
  const s = shares(j);
  for (const p of processes(j)) p.cpu = Math.round(1000 * (s[p.pid] ?? 0)) / 10;
}

/** The load average, as uptime and top write it ("4.97, 4.85, 4.40"). */
export const loadText = (j: Game) => cpu(j)!.load.map((l) => l.toFixed(2)).join(', ');

/** What the processes use, out of all the CPUs (0 to 1): all, and the part of the "niced" ones. */
export function usage(j: Game): { all: number; nice: number } {
  const c = cpu(j)!;
  const s = shares(j);
  let all = 0;
  let nice = 0;
  for (const p of processes(j)) {
    all += s[p.pid] ?? 0;
    if ((p.nice ?? 0) > 0) nice += s[p.pid] ?? 0;
  }
  return { all: all / c.cores, nice: nice / c.cores };
}

/** "50%" (CPUQuota=) → CPUs (0.5); null if unreadable. */
export function readQuota(text: string): number | null {
  const m = /^(\d+(?:\.\d+)?)%$/.exec(text.trim());
  return m && Number(m[1]) > 0 ? Number(m[1]) / 100 : null;
}

/** "-20" to "19" (Nice=); null if unreadable or out of range. */
export function readNice(text: string): number | null {
  const t = text.trim();
  if (!/^[+-]?\d+$/.test(t)) return null;
  const n = Number(t);
  return n >= -20 && n <= 19 ? n : null;
}
