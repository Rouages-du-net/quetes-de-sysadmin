// La mémoire d'une machine : ce que chaque processus occupe (RSS), et ce que
// fait le noyau quand il n'y en a plus (l'OOM killer tue le processus qui en
// occupe le plus) ; une limite systemd (MemoryMax=) fait la même chose à
// l'échelle d'un service. D'après https://www.kernel.org/doc/gorman/html/understand/understand016.html
// et https://www.freedesktop.org/software/systemd/man/latest/systemd.resource-control.html#MemoryMax=bytes.
//
//   etat.memoire = { total, noyau, rss: { pid: octets } }
//   etat.noyau = [{ temps, texte }]   (les messages du noyau, pour dmesg)
// Écarts : pas de swap, pas de cache qui se libère tout seul ; le score de
// l'OOM killer ne tient compte que de la mémoire occupée.

import type { Game } from './shell';
import type { Process } from './commands/system';
import { start, writeLog, systemd, type Systemd } from './systemd';

export interface Memory {
  total: number;
  // Ce que prennent le noyau et les caches, hors processus.
  kernel: number;
  rss: Record<number, number>;
}

export const memory = (j: Game): Memory | undefined => j.state.memoire;
export const process = (j: Game): Process[] => j.state.processus ?? [];
const Mo = 1024 * 1024;

/** La mémoire occupée (noyau compris). */
export const used = (j: Game) => {
  const m = memory(j)!;
  const live = new Set(process(j).map((p) => p.pid));
  return m.kernel + Object.entries(m.rss).reduce((t, [pid, o]) => t + (live.has(Number(pid)) ? o : 0), 0);
};

/** Une ligne du noyau (dmesg, journalctl -k). */
export function kernel(j: Game, text: string) {
  const sd = systemd(j);
  (j.state.noyau ??= []).push({ time: sd?.clock ?? 0, text });
  if (sd) writeLog(sd, '', 'kernel', 0, text, 3, false);
}

// Le service dont ce processus est le principal.
const serviceFor = (sd: Systemd, pid: number) => Object.entries(sd.services).find(([, s]) => s.state === 'active' && s.process[0]?.pid === pid);

/** Un processus tué par l'OOM killer : messages du noyau et de systemd, service relancé si Restart= le veut. */
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
  j.state.processus = process(j).filter((x) => x.pid !== p.pid);
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
  j.state.oomTues = [...(j.state.oomTues ?? []), { service: serviceName, cgroup: !!group, restart }];
  // Restart=on-failure (ou always, on-abnormal) : systemd le relance.
  if (restart) {
    const restarts = (j.state.relances ??= {});
    restarts[serviceName] = (restarts[serviceName] ?? 0) + 1;
    writeLog(sd, unit, 'systemd', 1, `${unit}: Scheduled restart job, restart counter is at ${restarts[serviceName]}.`);
    start(j, sd, serviceName, true);
  }
}

/**
 * Après chaque instant : une limite de service dépassée tue son processus ;
 * plus de mémoire du tout, le noyau tue le plus gros.
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
    // Le processus qui demandait de la mémoire (ici, celui qui grossit) déclenche l'OOM killer.
    const requester = process(j).find((p) => p.pid === j.state.memoireDemandeur) ?? moreBig;
    kernel(
      j,
      `${requester.command.split(/\s+/)[0].split('/').at(-1)} invoked oom-killer: gfp_mask=0x140cca(GFP_HIGHUSER_MOVABLE|__GFP_COMP), order=0, oom_score_adj=0`,
    );
    kill(j, moreBig, null);
  }
  // Les colonnes %MEM de ps et top suivent la mémoire réelle.
  for (const p of process(j)) p.mem = Math.round((1000 * (m.rss[p.pid] ?? 0)) / m.total) / 10;
}

/** « 1.9Gi », « 61Mi », comme free -h. */
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

/** « 300M », « 1G », « 512K » (MemoryMax=) → octets ; null si illisible. */
export function readSize(text: string): number | null {
  const m = /^(\d+(?:\.\d+)?)([KMGT]?)$/i.exec(text.trim());
  if (!m) return null;
  return Math.round(Number(m[1]) * { '': 1, K: 1024, M: Mo, G: 1024 * Mo, T: 1024 * 1024 * Mo }[m[2].toUpperCase() as '' | 'K' | 'M' | 'G' | 'T']);
}
