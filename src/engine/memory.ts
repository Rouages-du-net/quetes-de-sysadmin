// A machine's memory: what each process occupies (RSS), and what the kernel
// does when there is none left (the OOM killer kills the process occupying
// the most); a systemd limit (MemoryMax=) does the same at the scale of a
// service. Based on https://www.kernel.org/doc/gorman/html/understand/understand016.html
// and https://www.freedesktop.org/software/systemd/man/latest/systemd.resource-control.html#MemoryMax=bytes.
//
//   state.memory = { total, kernel, rss: { pid: bytes } }
//   state.kernel = [{ time, text }]   (the kernel's messages, for dmesg)
// Differences: no swap, no cache that frees itself; the OOM killer's score
// only takes the occupied memory into account.

import type { Game } from './shell';
import type { Process } from './commands/system';
import { start, writeLog, systemd, type Systemd } from './systemd';

export interface Memory {
  total: number;
  // What the kernel and caches take, outside processes.
  kernel: number;
  rss: Record<number, number>;
}

export const memory = (j: Game): Memory | undefined => j.state.memory;
export const process = (j: Game): Process[] => j.state.process ?? [];
const Mo = 1024 * 1024;

/** The occupied memory (kernel included). */
export const used = (j: Game) => {
  const m = memory(j)!;
  const live = new Set(process(j).map((p) => p.pid));
  return m.kernel + Object.entries(m.rss).reduce((t, [pid, o]) => t + (live.has(Number(pid)) ? o : 0), 0);
};

/** A kernel line (dmesg, journalctl -k). */
export function kernel(j: Game, text: string) {
  const sd = systemd(j);
  (j.state.kernel ??= []).push({ time: sd?.clock ?? 0, text });
  if (sd) writeLog(sd, '', 'kernel', 0, text, 3, false);
}

// The service whose main process this is.
const serviceFor = (sd: Systemd, pid: number) => Object.entries(sd.services).find(([, s]) => s.state === 'active' && s.process[0]?.pid === pid);

/** A process killed by the OOM killer: kernel and systemd messages, service restarted if Restart= says so. */
function kill(j: Game, p: Process, group: string | null) {
  const m = memory(j)!;
  const rss = Math.round((m.rss[p.pid] ?? 0) / 1024);
  const uid = j.accounts.users[p.user]?.uid ?? 0;
  const name = p.command.split(/\s+/)[0].split('/').at(-1)!;
  kernel(
    j,
    group
      ? `Memory cgroup out of memory: Killed process ${p.pid} (${name}) total-vm:${rss + 180_000}kB, anon-rss:${rss}kB, file-rss:0kB, shmem-rss:0kB, UID:${uid} pgtables:${Math.round(rss / 470)}kB oom_score_adj:0`
      : `Out of memory: Killed process ${p.pid} (${name}) total-vm:${rss + 180_000}kB, anon-rss:${rss}kB, file-rss:0kB, shmem-rss:0kB, UID:${uid} pgtables:${Math.round(rss / 470)}kB oom_score_adj:0`,
  );
  j.state.process = process(j).filter((x) => x.pid !== p.pid);
  delete m.rss[p.pid];
  const sd = systemd(j);
  const found = sd && serviceFor(sd, p.pid);
  if (!sd || !found) return;
  const [serviceName, s] = found;
  const unit = `${serviceName}.service`;
  writeLog(sd, unit, 'systemd', 1, `${unit}: A process of this unit has been killed by the OOM killer.`, 4);
  writeLog(sd, unit, 'systemd', 1, `${unit}: Main process exited, code=killed, status=9/KILL`, 4, false);
  writeLog(sd, unit, 'systemd', 1, `${unit}: Failed with result 'oom-kill'.`, 4, false);
  s.state = 'failed';
  s.result = 'oom-kill';
  s.since = sd.clock;
  const restart = ['on-failure', 'always', 'on-abnormal'].includes(s.reboot ?? '');
  j.state.oomKilled = [...(j.state.oomKilled ?? []), { service: serviceName, cgroup: !!group, restart }];
  // Restart=on-failure (or always, on-abnormal): systemd restarts it.
  if (restart) {
    const restarts = (j.state.restarts ??= {});
    restarts[serviceName] = (restarts[serviceName] ?? 0) + 1;
    writeLog(sd, unit, 'systemd', 1, `${unit}: Scheduled restart job, restart counter is at ${restarts[serviceName]}.`);
    start(j, sd, serviceName, true);
  }
}

/**
 * After each instant: a service limit that is exceeded kills its process;
 * with no memory left at all, the kernel kills the biggest.
 */
export function checkMemory(j: Game) {
  const m = memory(j);
  const sd = systemd(j);
  if (!m || !sd) return;
  for (const [, s] of Object.entries(sd.services)) {
    const pid = s.process[0]?.pid;
    if (s.state !== 'active' || !s.maxMemory || pid === undefined) continue;
    const p = process(j).find((x) => x.pid === pid);
    if (p && (m.rss[pid] ?? 0) > s.maxMemory) kill(j, p, s.description);
  }
  while (used(j) > m.total) {
    const moreBig = [...process(j)].filter((p) => (m.rss[p.pid] ?? 0) > 0).sort((a, b) => (m.rss[b.pid] ?? 0) - (m.rss[a.pid] ?? 0))[0];
    if (!moreBig) break;
    // The process that asked for memory (here, the one that grows) triggers the OOM killer.
    const requester = process(j).find((p) => p.pid === j.state.memoryRequester) ?? moreBig;
    kernel(
      j,
      `${requester.command.split(/\s+/)[0].split('/').at(-1)} invoked oom-killer: gfp_mask=0x140cca(GFP_HIGHUSER_MOVABLE|__GFP_COMP), order=0, oom_score_adj=0`,
    );
    kill(j, moreBig, null);
  }
  // The %MEM columns of ps and top follow the real memory.
  for (const p of process(j)) p.mem = Math.round((1000 * (m.rss[p.pid] ?? 0)) / m.total) / 10;
}

/** "1.9Gi", "61Mi", like free -h. */
export function freeSize(bytes: number): string {
  if (bytes === 0) return '0B';
  const units = ['B', 'Ki', 'Mi', 'Gi', 'Ti'];
  let v = bytes;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v >= 10 || i === 0 ? Math.round(v) : v.toFixed(1)}${units[i]}`;
}

export const inMo = (bytes: number) => bytes / Mo;

/** "300M", "1G", "512K" (MemoryMax=) → bytes; null if unreadable. */
export function readSize(text: string): number | null {
  const m = /^(\d+(?:\.\d+)?)([KMGT]?)$/i.exec(text.trim());
  if (!m) return null;
  return Math.round(Number(m[1]) * { '': 1, K: 1024, M: Mo, G: 1024 * Mo, T: 1024 * 1024 * Mo }[m[2].toUpperCase() as '' | 'K' | 'M' | 'G' | 'T']);
}
