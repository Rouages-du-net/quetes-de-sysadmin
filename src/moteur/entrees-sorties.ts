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

import type { Jeu } from './shell';
import { systemd } from './systemd';
import type { Processus } from './commandes/systeme';

export interface Demande {
  // Le service qui fait ces entrées-sorties (son processus principal), ou un pid fixe.
  service?: string;
  pid?: number;
  // Débits demandés (kB/s).
  lecture: number;
  ecriture: number;
  // La lecture suit l'écriture (une copie : rsync lit au rythme où il écrit).
  copie?: boolean;
  // Un programme sensible à l'attente (le direct) : son attente compte pour l'objectif.
  sensible?: boolean;
}

export interface EtatIO {
  disque: string;
  // Ordonnanceur du disque (none, mq-deadline, bfq).
  ordonnanceur: string;
  // Débit total que le disque sait servir (kB/s).
  capacite: number;
  demandes: Demande[];
  // Classes posées avec ionice : pid → classe (1 temps réel, 2 au mieux, 3 au repos) et priorité.
  classes: Record<number, { classe: number; prio: number }>;
  cpus: number;
}

export const io = (j: Jeu): EtatIO | undefined => j.etat.io;

export interface Debit {
  pid: number;
  commande: string;
  uid: number;
  lecture: number;
  ecriture: number;
  attente: number;
  sensible: boolean;
}

// Le processus principal d'un service actif.
function pidDe(j: Jeu, d: Demande): Processus | undefined {
  const tous: Processus[] = j.etat.processus ?? [];
  if (d.pid !== undefined) return tous.find((p) => p.pid === d.pid);
  const s = systemd(j)?.services[d.service ?? ''];
  if (!s || s.etat !== 'active') return undefined;
  const pid = s.processus[0]?.pid;
  return tous.find((p) => p.pid === pid);
}

// Les limites io.max d'un service qui portent sur ce disque (kB/s).
function limites(j: Jeu, e: EtatIO, d: Demande): { lecture: number; ecriture: number } {
  const s = d.service ? systemd(j)?.services[d.service] : undefined;
  const sur = (l?: { appareil: string; octets: number }) => (l && visePartition(l.appareil, e.disque) ? l.octets / 1024 : Infinity);
  return { lecture: sur(s?.ioLecture), ecriture: sur(s?.ioEcriture) };
}

/** systemd accepte le disque, une de ses partitions, ou un chemin sur un de ses systèmes de fichiers. */
export const visePartition = (appareil: string, disque: string) =>
  appareil === `/dev/${disque}` || new RegExp(`^/dev/${disque}\\d+$`).test(appareil) || (appareil.startsWith('/') && !appareil.startsWith('/dev/'));

/** Les priorités d'ionice comptent-elles avec cet ordonnanceur ? */
export const prioritesActives = (e: EtatIO) => e.ordonnanceur === 'mq-deadline' || e.ordonnanceur === 'bfq';

/** Ce que le disque sert à chaque programme, maintenant, et son état général. */
export function etatDisque(j: Jeu) {
  const e = io(j)!;
  const vivants = e.demandes.flatMap((d) => {
    const p = pidDe(j, d);
    if (!p) return [];
    const l = limites(j, e, d);
    let ecriture = Math.min(d.ecriture, l.ecriture);
    let lecture = Math.min(d.lecture, l.lecture);
    // Une copie avance au pas le plus lent de ses deux côtés.
    if (d.copie) {
      const pas = Math.min(d.ecriture ? ecriture / d.ecriture : 1, d.lecture ? lecture / d.lecture : 1);
      ecriture = d.ecriture * pas;
      lecture = d.lecture * pas;
    }
    const classe = prioritesActives(e) ? (e.classes[p.pid]?.classe ?? 2) : 2;
    return [{ p, d, lecture, ecriture, classe }];
  });
  const total = (v: typeof vivants) => v.reduce((t, x) => t + x.lecture + x.ecriture, 0);
  const prioritaires = vivants.filter((v) => v.classe !== 3);
  const auRepos = vivants.filter((v) => v.classe === 3);
  const demandePrio = total(prioritaires);
  // Les prioritaires d'abord ; au repos, ce qui reste.
  const partPrio = Math.min(1, e.capacite / Math.max(demandePrio, 1));
  const reste = Math.max(0, e.capacite - demandePrio * partPrio);
  const partRepos = Math.min(1, reste / Math.max(total(auRepos), 1));
  const charge = demandePrio / e.capacite;
  // L'attente d'une requête prioritaire : quelques ms, puis la file s'allonge.
  const attente = 6 + Math.max(0, charge - 0.6) * 1500 + (auRepos.length && partRepos > 0 ? 3 : 0);
  const debits: Debit[] = vivants.map((v) => {
    const part = v.classe === 3 ? partRepos : partPrio;
    return {
      pid: v.p.pid,
      commande: v.p.commande.split(/\s+/)[0].split('/').at(-1)!,
      uid: v.p.utilisateur === 'root' ? 0 : (j.comptes.utilisateurs[v.p.utilisateur]?.uid ?? 1000),
      lecture: v.lecture * part,
      ecriture: v.ecriture * part,
      attente: v.classe === 3 ? attente * 4 : attente,
      sensible: !!v.d.sensible,
    };
  });
  const servi = debits.reduce((t, x) => t + x.lecture + x.ecriture, 0);
  const utilisation = Math.min(99.8, (servi / e.capacite) * 100);
  // Les processus bloqués en attente du disque (état D) : l'iowait et la charge.
  const bloques = debits.filter((x) => x.attente > 50 || x.lecture + x.ecriture > e.capacite * 0.2).length;
  const iowait = Math.min(85, utilisation > 50 ? utilisation * 0.8 : utilisation * 0.1);
  return { e, debits, utilisation, attente, iowait, charge: 0.3 + bloques * 1.9 + (utilisation > 90 ? 1.2 : 0) };
}

/** Le programme sensible (le direct) est-il servi à temps ? */
export const servieATemps = (j: Jeu) =>
  etatDisque(j)
    .debits.filter((d) => d.sensible)
    .every((d) => d.attente < 100);
