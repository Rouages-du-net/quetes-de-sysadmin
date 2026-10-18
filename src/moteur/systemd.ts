// systemd simulé : services, journal et horloge d'une machine, rangés dans
// etat.systemd. Comportements et messages d'après la documentation de
// systemd (https://www.freedesktop.org/software/systemd/man/latest/systemctl.html,
// .../journalctl.html) : systemctl et journalctl répondent en anglais, les
// dates suivent la langue du système, comme sur un vrai Linux.
// Écarts : pas de cibles ni de dépendances entre unités, un seul processus
// principal par service, horloge qui avance d'une seconde par action.

import type { Jeu } from './shell';
import type { Processus } from './commandes/systeme';

export interface Service {
  description: string;
  etat: 'active' | 'inactive' | 'failed';
  // Lancé au démarrage de la machine (systemctl enable).
  active: boolean;
  // Processus du service quand il tourne (le premier est le principal).
  processus: Processus[];
  // Exécutable, pour « Main PID: 612 (nginx) ».
  executable: string;
  depuis: number;
  // Au démarrage : null si tout va bien, sinon les messages d'erreur que le
  // programme écrit dans le journal avant de s'arrêter.
  verifier?: (jeu: Jeu) => string[] | null;
}

export interface Entree {
  temps: number;
  demarrage: number;
  unite: string;
  ident: string;
  pid: number;
  message: string;
  // 3 = erreur, 4 = avertissement, 6 = information (syslog).
  priorite: number;
}

export interface Systemd {
  hote: string;
  services: Record<string, Service>;
  journal: Entree[];
  // Heure locale simulée (millisecondes, lue comme UTC), démarrage en cours.
  horloge: number;
  demarrage: number;
  // Vrai après un redémarrage, une fois l'état des services consulté.
  verifieApresDemarrage?: boolean;
  // Un service a été démarré à la main depuis le dernier démarrage : ce qui
  // tourne ne prouve plus que la machine repart toute seule.
  demarreALaMain?: boolean;
}

export const systemd = (jeu: Jeu): Systemd | undefined => jeu.etat.systemd;

// Une entrée du journal, et l'horloge qui avance d'une seconde (sauf pour
// les lignes qui suivent dans la même seconde).
export function journaliser(sd: Systemd, unite: string, ident: string, pid: number, message: string, priorite = 6, avance = true) {
  if (avance) sd.horloge += 1000;
  sd.journal.push({ temps: sd.horloge, demarrage: sd.demarrage, unite, ident, pid, message, priorite });
}

/** Démarre un service ; renvoie false s'il échoue (erreurs au journal). */
export function demarrer(jeu: Jeu, sd: Systemd, nom: string, auDemarrage = false): boolean {
  const s = sd.services[nom];
  if (!auDemarrage) sd.demarreALaMain = true;
  const unite = `${nom}.service`;
  journaliser(sd, unite, 'systemd', 1, `Starting ${unite} - ${s.description}...`);
  const erreurs = s.verifier?.(jeu) ?? null;
  const pid = s.processus[0]?.pid ?? 1;
  if (erreurs) {
    erreurs.forEach((e, i) => journaliser(sd, unite, s.executable, pid, e, 3, i === 0));
    journaliser(sd, unite, 'systemd', 1, `${unite}: Control process exited, code=exited, status=1/FAILURE`, 4, false);
    journaliser(sd, unite, 'systemd', 1, `${unite}: Failed with result 'exit-code'.`, 4, false);
    journaliser(sd, unite, 'systemd', 1, `Failed to start ${unite} - ${s.description}.`, 3, false);
    s.etat = 'failed';
    s.depuis = sd.horloge;
    retirerProcessus(jeu, s);
    return false;
  }
  journaliser(sd, unite, 'systemd', 1, `Started ${unite} - ${s.description}.`);
  s.etat = 'active';
  s.depuis = sd.horloge;
  const liste: Processus[] = (jeu.etat.processus ??= []);
  for (const p of s.processus) if (!liste.some((q) => q.pid === p.pid)) liste.push({ ...p });
  return true;
}

function retirerProcessus(jeu: Jeu, s: Service) {
  if (jeu.etat.processus) jeu.etat.processus = (jeu.etat.processus as Processus[]).filter((p) => !s.processus.some((q) => q.pid === p.pid));
}

export function arreter(jeu: Jeu, sd: Systemd, nom: string) {
  const s = sd.services[nom];
  const unite = `${nom}.service`;
  journaliser(sd, unite, 'systemd', 1, `Stopping ${unite} - ${s.description}...`);
  journaliser(sd, unite, 'systemd', 1, `Stopped ${unite} - ${s.description}.`);
  s.etat = 'inactive';
  s.depuis = sd.horloge;
  retirerProcessus(jeu, s);
}

/** Redémarrage de la machine : seuls les services activés (enable) repartent. */
export function redemarrer(jeu: Jeu, sd: Systemd) {
  journaliser(sd, '', 'systemd-logind', 512, 'The system will reboot now!');
  for (const [nom, s] of Object.entries(sd.services)) if (s.etat === 'active') arreter(jeu, sd, nom);
  sd.horloge += 90_000;
  sd.demarrage++;
  jeu.etat.processus = (jeu.etat.processus as Processus[] | undefined)?.filter((p) => p.pid === 1) ?? [];
  journaliser(sd, '', 'kernel', 0, `Linux version 6.12.0-quetes (${sd.hote})`);
  for (const [nom, s] of Object.entries(sd.services)) {
    s.etat = 'inactive';
    s.depuis = sd.horloge;
    if (s.active) demarrer(jeu, sd, nom, true);
  }
  sd.verifieApresDemarrage = false;
  sd.demarreALaMain = false;
}

// ——— Dates ———

const parties = (ms: number, langue: string, options: Intl.DateTimeFormatOptions) =>
  Object.fromEntries(new Intl.DateTimeFormat(langue, { timeZone: 'UTC', ...options }).formatToParts(new Date(ms)).map((p) => [p.type, p.value]));
const heure = (ms: number) => new Date(ms).toISOString().slice(11, 19);

/** « oct. 13 21:02:44 », comme journalctl (mois abrégé de la langue). */
export function dateJournal(ms: number, langue: string): string {
  const { month } = parties(ms, langue, { month: 'short' });
  return `${month} ${new Date(ms).toISOString().slice(8, 10)} ${heure(ms)}`;
}

/** « mar. 2026-10-13 20:00:01 CEST », comme systemctl status. */
export function dateComplete(ms: number, langue: string): string {
  const { weekday } = parties(ms, langue, { weekday: 'short' });
  return `${weekday} ${new Date(ms).toISOString().slice(0, 10)} ${heure(ms)} CEST`;
}

/** « 1h 2min », « 3min 12s », « 5s », comme systemd. */
export function duree(ms: number): string {
  let s = Math.max(0, Math.round(ms / 1000));
  const h = Math.floor(s / 3600);
  const min = Math.floor((s % 3600) / 60);
  s %= 60;
  if (h) return min ? `${h}h ${min}min` : `${h}h`;
  if (min) return s ? `${min}min ${s}s` : `${min}min`;
  return `${s}s`;
}

export const ligneJournal = (e: Entree, sd: Systemd, langue: string) =>
  `${dateJournal(e.temps, langue)} ${sd.hote} ${e.ident}${e.pid ? `[${e.pid}]` : ''}: ${e.message}`;

export type DefinitionService = Omit<Service, 'depuis' | 'etat' | 'processus'> & { etat?: Service['etat']; processus?: Processus[] };

/**
 * L'état systemd d'une machine allumée à `demarre` (heure locale, lue comme
 * UTC) : les services actifs ont démarré à ce moment-là ; `maintenant` est
 * l'heure au début du chapitre.
 */
export function nouveauSystemd(hote: string, demarre: number, maintenant: number, definitions: Record<string, DefinitionService>): Systemd {
  const sd: Systemd = { hote, services: {}, journal: [], horloge: demarre, demarrage: 1 };
  journaliser(sd, '', 'kernel', 0, `Linux version 6.12.0-quetes (${hote})`);
  for (const [nom, d] of Object.entries(definitions)) {
    const etat = d.etat ?? 'active';
    sd.services[nom] = { ...d, etat, processus: d.processus ?? [], depuis: sd.horloge };
    if (etat === 'active') {
      journaliser(sd, `${nom}.service`, 'systemd', 1, `Starting ${nom}.service - ${d.description}...`);
      journaliser(sd, `${nom}.service`, 'systemd', 1, `Started ${nom}.service - ${d.description}.`);
      sd.services[nom].depuis = sd.horloge;
    }
  }
  sd.horloge = maintenant;
  return sd;
}
