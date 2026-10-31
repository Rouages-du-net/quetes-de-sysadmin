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

import type { Jeu } from './shell';
import type { Processus } from './commands/system';
import { demarrer, journaliser, systemd, type Systemd } from './systemd';

export interface Memoire {
  total: number;
  // Ce que prennent le noyau et les caches, hors processus.
  noyau: number;
  rss: Record<number, number>;
}

export const memoire = (j: Jeu): Memoire | undefined => j.etat.memoire;
export const processus = (j: Jeu): Processus[] => j.etat.processus ?? [];
const Mo = 1024 * 1024;

/** La mémoire occupée (noyau compris). */
export const utilisee = (j: Jeu) => {
  const m = memoire(j)!;
  const vivants = new Set(processus(j).map((p) => p.pid));
  return m.noyau + Object.entries(m.rss).reduce((t, [pid, o]) => t + (vivants.has(Number(pid)) ? o : 0), 0);
};

/** Une ligne du noyau (dmesg, journalctl -k). */
export function noyau(j: Jeu, texte: string) {
  const sd = systemd(j);
  (j.etat.noyau ??= []).push({ temps: sd?.horloge ?? 0, texte });
  if (sd) journaliser(sd, '', 'kernel', 0, texte, 3, false);
}

// Le service dont ce processus est le principal.
const serviceDe = (sd: Systemd, pid: number) => Object.entries(sd.services).find(([, s]) => s.etat === 'active' && s.processus[0]?.pid === pid);

/** Un processus tué par l'OOM killer : messages du noyau et de systemd, service relancé si Restart= le veut. */
function tuer(j: Jeu, p: Processus, groupe: string | null) {
  const m = memoire(j)!;
  const rss = Math.round((m.rss[p.pid] ?? 0) / 1024);
  const uid = j.comptes.utilisateurs[p.utilisateur]?.uid ?? 0;
  const nom = p.commande.split(/\s+/)[0].split('/').at(-1)!;
  noyau(
    j,
    groupe
      ? `Memory cgroup out of memory: Killed process ${p.pid} (${nom}) total-vm:${rss + 180_000}kB, anon-rss:${rss}kB, file-rss:0kB, shmem-rss:0kB, UID:${uid} pgtables:${Math.round(rss / 470)}kB oom_score_adj:0`
      : `Out of memory: Killed process ${p.pid} (${nom}) total-vm:${rss + 180_000}kB, anon-rss:${rss}kB, file-rss:0kB, shmem-rss:0kB, UID:${uid} pgtables:${Math.round(rss / 470)}kB oom_score_adj:0`,
  );
  j.etat.processus = processus(j).filter((x) => x.pid !== p.pid);
  delete m.rss[p.pid];
  const sd = systemd(j);
  const trouve = sd && serviceDe(sd, p.pid);
  if (!sd || !trouve) return;
  const [nomService, s] = trouve;
  const unite = `${nomService}.service`;
  journaliser(sd, unite, 'systemd', 1, `${unite}: A process of this unit has been killed by the OOM killer.`, 4);
  journaliser(sd, unite, 'systemd', 1, `${unite}: Main process exited, code=killed, status=9/KILL`, 4, false);
  journaliser(sd, unite, 'systemd', 1, `${unite}: Failed with result 'oom-kill'.`, 4, false);
  s.etat = 'failed';
  s.resultat = 'oom-kill';
  s.depuis = sd.horloge;
  const relance = ['on-failure', 'always', 'on-abnormal'].includes(s.redemarrage ?? '');
  j.etat.oomTues = [...(j.etat.oomTues ?? []), { service: nomService, cgroup: !!groupe, relance }];
  // Restart=on-failure (ou always, on-abnormal) : systemd le relance.
  if (relance) {
    const relances = (j.etat.relances ??= {});
    relances[nomService] = (relances[nomService] ?? 0) + 1;
    journaliser(sd, unite, 'systemd', 1, `${unite}: Scheduled restart job, restart counter is at ${relances[nomService]}.`);
    demarrer(j, sd, nomService, true);
  }
}

/**
 * Après chaque instant : une limite de service dépassée tue son processus ;
 * plus de mémoire du tout, le noyau tue le plus gros.
 */
export function verifierMemoire(j: Jeu) {
  const m = memoire(j);
  const sd = systemd(j);
  if (!m || !sd) return;
  for (const [, s] of Object.entries(sd.services)) {
    const pid = s.processus[0]?.pid;
    if (s.etat !== 'active' || !s.memoireMax || pid === undefined) continue;
    const p = processus(j).find((x) => x.pid === pid);
    if (p && (m.rss[pid] ?? 0) > s.memoireMax) tuer(j, p, s.description);
  }
  while (utilisee(j) > m.total) {
    const plusGros = [...processus(j)].filter((p) => (m.rss[p.pid] ?? 0) > 0).sort((a, b) => (m.rss[b.pid] ?? 0) - (m.rss[a.pid] ?? 0))[0];
    if (!plusGros) break;
    // Le processus qui demandait de la mémoire (ici, celui qui grossit) déclenche l'OOM killer.
    const demandeur = processus(j).find((p) => p.pid === j.etat.memoireDemandeur) ?? plusGros;
    noyau(
      j,
      `${demandeur.commande.split(/\s+/)[0].split('/').at(-1)} invoked oom-killer: gfp_mask=0x140cca(GFP_HIGHUSER_MOVABLE|__GFP_COMP), order=0, oom_score_adj=0`,
    );
    tuer(j, plusGros, null);
  }
  // Les colonnes %MEM de ps et top suivent la mémoire réelle.
  for (const p of processus(j)) p.mem = Math.round((1000 * (m.rss[p.pid] ?? 0)) / m.total) / 10;
}

/** « 1.9Gi », « 61Mi », comme free -h. */
export function tailleFree(octets: number): string {
  if (octets === 0) return '0B';
  const unites = ['B', 'Ki', 'Mi', 'Gi', 'Ti'];
  let v = octets;
  let i = 0;
  while (v >= 1024 && i < unites.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v >= 10 || i === 0 ? Math.round(v) : v.toFixed(1)}${unites[i]}`;
}

export const enMo = (octets: number) => octets / Mo;

/** « 300M », « 1G », « 512K » (MemoryMax=) → octets ; null si illisible. */
export function lireTaille(texte: string): number | null {
  const m = /^(\d+(?:\.\d+)?)([KMGT]?)$/i.exec(texte.trim());
  if (!m) return null;
  return Math.round(Number(m[1]) * { '': 1, K: 1024, M: Mo, G: 1024 * Mo, T: 1024 * 1024 * Mo }[m[2].toUpperCase() as '' | 'K' | 'M' | 'G' | 'T']);
}
