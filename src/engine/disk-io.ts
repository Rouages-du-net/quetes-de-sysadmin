// Les entrées-sorties disque d'une machine (etat.io), pour iostat, pidstat,
// ionice et top. Chaque programme qui lit ou écrit demande un débit ; le
// disque en sert au plus `capacite`. Quand les demandes approchent la
// capacité, les requêtes attendent : l'attente (await) grimpe, les
// processus bloqués font monter l'iowait et la charge.
// Ce qui limite un programme :
//   - IOReadBandwidthMax= / IOWriteBandwidthMax= de son service (cgroup v2,
//     io.max) : marche avec tous les ordonnanceurs ;
//   - ionice (classe idle : seulement quand le disque est libre) : seulement
//     si l'ordonnanceur du disque gère les priorités (mq-deadline, bfq) ;
//     « none », celui des disques virtuels, les ignore.
// Sources : https://docs.kernel.org/admin-guide/cgroup-v2.html#io,
// https://www.freedesktop.org/software/systemd/man/latest/systemd.resource-control.html#IOReadBandwidthMax=device%20bytes,
// https://man7.org/linux/man-pages/man1/ionice.1.html,
// https://docs.kernel.org/block/switching-sched.html
// Écarts : un seul disque ; un modèle de file d'attente très simplifié
// (au-delà de 60 % de la capacité, l'attente grimpe vite) ; les chiffres
// sont ceux de l'instant, même pour le premier rapport d'iostat.

import type { Game } from './shell';
import { systemd } from './systemd';
import type { Process } from './commands/system';

export interface Request {
  // Le service qui fait ces entrées-sorties (son processus principal), ou un pid fixe.
  service?: string;
  pid?: number;
  // Débits demandés (kB/s).
  read: number;
  write: number;
  // La lecture suit l'écriture (une copie : rsync lit au rythme où il écrit).
  copyOf?: boolean;
  // Un programme sensible à l'attente (le direct) : son attente compte pour l'objectif.
  sensible?: boolean;
}

export interface IoState {
  disk: string;
  // Ordonnanceur du disque (none, mq-deadline, bfq).
  scheduler: string;
  // Débit total que le disque sait servir (kB/s).
  capacity: number;
  requests: Request[];
  // Classes posées avec ionice : pid → classe (1 temps réel, 2 au mieux, 3 au repos) et priorité.
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

// Le processus principal d'un service actif.
function pidFor(j: Game, d: Request): Process | undefined {
  const all: Process[] = j.state.process ?? [];
  if (d.pid !== undefined) return all.find((p) => p.pid === d.pid);
  const s = systemd(j)?.services[d.service ?? ''];
  if (!s || s.state !== 'active') return undefined;
  const pid = s.process[0]?.pid;
  return all.find((p) => p.pid === pid);
}

// Les limites io.max d'un service qui portent sur ce disque (kB/s).
function limits(j: Game, e: IoState, d: Request): { read: number; write: number } {
  const s = d.service ? systemd(j)?.services[d.service] : undefined;
  const on = (l?: { device: string; bytes: number }) => (l && targetsPartition(l.device, e.disk) ? l.bytes / 1024 : Infinity);
  return { read: on(s?.readIo), write: on(s?.writeIo) };
}

/** systemd accepte le disque, une de ses partitions, ou un chemin sur un de ses systèmes de fichiers. */
export const targetsPartition = (device: string, disk: string) =>
  device === `/dev/${disk}` || new RegExp(`^/dev/${disk}\\d+$`).test(device) || (device.startsWith('/') && !device.startsWith('/dev/'));

/** Les priorités d'ionice comptent-elles avec cet ordonnanceur ? */
export const activesPriorities = (e: IoState) => e.scheduler === 'mq-deadline' || e.scheduler === 'bfq';

/** Ce que le disque sert à chaque programme, maintenant, et son état général. */
export function diskState(j: Game) {
  const e = io(j)!;
  const live = e.requests.flatMap((d) => {
    const p = pidFor(j, d);
    if (!p) return [];
    const l = limits(j, e, d);
    let write = Math.min(d.write, l.write);
    let read = Math.min(d.read, l.read);
    // Une copie avance au pas le plus lent de ses deux côtés.
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
  // Les prioritaires d'abord ; au repos, ce qui reste.
  const partPrio = Math.min(1, e.capacity / Math.max(prioRequest, 1));
  const rest = Math.max(0, e.capacity - prioRequest * partPrio);
  const partRepos = Math.min(1, rest / Math.max(total(toRepos), 1));
  const load = prioRequest / e.capacity;
  // L'attente d'une requête prioritaire : quelques ms, puis la file s'allonge.
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
  // Les processus bloqués en attente du disque (état D) : l'iowait et la charge.
  const blocked = rates.filter((x) => x.waiting > 50 || x.read + x.write > e.capacity * 0.2).length;
  const iowait = Math.min(85, utilisation > 50 ? utilisation * 0.8 : utilisation * 0.1);
  return { e, debits: rates, utilisation, waiting: waiting, iowait, load: 0.3 + blocked * 1.9 + (utilisation > 90 ? 1.2 : 0) };
}

/** Le programme sensible (le direct) est-il servi à temps ? */
export const timeAServed = (j: Game) =>
  diskState(j)
    .debits.filter((d) => d.sensible)
    .every((d) => d.waiting < 100);
