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
  // Après un démarrage ou un rechargement réussi : le service applique sa
  // configuration (ex. sshd).
  charger?: (jeu: Jeu) => void;
  // reload vérifie d'abord la configuration avec `verifier` (comme
  // ExecReload=/usr/sbin/sshd -t) ; sinon, il recharge sans vérifier.
  verifierAuRechargement?: boolean;
  // Type=oneshot : le service fait son travail puis s'arrête (ex. certbot,
  // lancé par un timer) ; il ne reste pas « active (running) ».
  ponctuel?: boolean;
  // Type=oneshot avec RemainAfterExit=yes (networking, nftables) : le travail
  // fait, il reste « active (exited) », sans processus.
  resteActif?: boolean;
  // À l'arrêt du service (ex. timesyncd : l'horloge n'est plus suivie).
  arret?: (jeu: Jeu) => void;
  // Comment il s'est arrêté en échec (exit-code, oom-kill…).
  resultat?: string;
  // Les réglages des fichiers de surcharge (systemctl edit) : MemoryMax=, Restart=.
  memoireMax?: number;
  redemarrage?: string;
  surcharges?: string[];
  empreinteSurcharges?: string;
  // Une unité écrite à la main (/etc/systemd/system/NOM.service) : son fichier,
  // et ce qu'elle lance (ExecStart=) ; renvoie le code de retour.
  fichier?: string;
  executer?: (jeu: Jeu) => number;
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
  // L'heure affichée par la machine (son fuseau, son horloge qui dérive) :
  // l'écart avec la vraie heure, et l'abréviation du fuseau (voir heure.ts).
  ecart?: number;
  zone?: string;
  // Les timers (NOM.timer), voir minuteries.ts.
  minuteries?: Record<string, import('./minuteries').Minuterie>;
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
  if (s.ponctuel) {
    // Un service écrit à la main : son programme tourne, et son code de retour décide.
    const code = s.executer?.(jeu) ?? 0;
    if (code !== 0) {
      journaliser(
        sd,
        unite,
        'systemd',
        1,
        `${unite}: Main process exited, code=exited, status=${code}/${code === 1 ? 'FAILURE' : 'INVALIDARGUMENT'}`,
        4,
      );
      journaliser(sd, unite, 'systemd', 1, `${unite}: Failed with result 'exit-code'.`, 4, false);
      journaliser(sd, unite, 'systemd', 1, `Failed to start ${unite} - ${s.description}.`, 3, false);
      s.etat = 'failed';
      s.resultat = 'exit-code';
      s.depuis = sd.horloge;
      return false;
    }
    journaliser(sd, unite, 'systemd', 1, `${unite}: Deactivated successfully.`);
    journaliser(sd, unite, 'systemd', 1, `Finished ${unite} - ${s.description}.`, 6, false);
    s.etat = 'inactive';
    s.depuis = sd.horloge;
    return true;
  }
  journaliser(sd, unite, 'systemd', 1, `Started ${unite} - ${s.description}.`);
  // Le service tourne déjà quand il applique sa configuration (il peut recevoir des requêtes).
  s.etat = 'active';
  s.resultat = undefined;
  s.charger?.(jeu);
  s.depuis = sd.horloge;
  const liste: Processus[] = (jeu.etat.processus ??= []);
  for (const p of s.processus) if (!liste.some((q) => q.pid === p.pid)) liste.push({ ...p });
  return true;
}

// Les processus du service s'arrêtent ; leurs enfants zombies disparaissent avec eux (init les récupère).
function retirerProcessus(jeu: Jeu, s: Service) {
  if (jeu.etat.processus)
    jeu.etat.processus = (jeu.etat.processus as Processus[]).filter(
      (p) => !s.processus.some((q) => q.pid === p.pid || (p.ppid === q.pid && p.zombie)),
    );
}

export function arreter(jeu: Jeu, sd: Systemd, nom: string) {
  const s = sd.services[nom];
  const unite = `${nom}.service`;
  journaliser(sd, unite, 'systemd', 1, `Stopping ${unite} - ${s.description}...`);
  journaliser(sd, unite, 'systemd', 1, `Stopped ${unite} - ${s.description}.`);
  s.etat = 'inactive';
  s.depuis = sd.horloge;
  retirerProcessus(jeu, s);
  s.arret?.(jeu);
}

/** Redémarrage de la machine : seuls les services activés (enable) repartent. */
export function redemarrer(jeu: Jeu, sd: Systemd) {
  journaliser(sd, '', 'systemd-logind', 512, 'The system will reboot now!');
  for (const [nom, s] of Object.entries(sd.services)) if (s.etat === 'active') arreter(jeu, sd, nom);
  sd.horloge += 90_000;
  sd.demarrage++;
  jeu.etat.processus = (jeu.etat.processus as Processus[] | undefined)?.filter((p) => p.pid === 1) ?? [];
  // Le noyau installé devient celui qui tourne ; /run (tmpfs) repart vide, avec reboot-required.
  const noyau = jeu.etat.noyau as { courant: string; installe: string } | undefined;
  if (noyau) noyau.courant = noyau.installe;
  for (const f of ['/var/run/reboot-required', '/var/run/reboot-required.pkgs']) if (jeu.existe(f)) jeu.effacer(f);
  // Les sessions tmux meurent avec la machine ; les règles du pare-feu aussi (nftables.service les recharge s'il est activé).
  if (jeu.etat.tmux) jeu.etat.tmux = {};
  if (jeu.etat.nft) jeu.etat.nft = { tables: [] };
  // Les interfaces WireGuard aussi (wg-quick@wg0 les remonte s'il est activé).
  if (jeu.etat.wg) {
    for (const nom of Object.keys(jeu.etat.wg)) delete jeu.etat.lan?.interfaces[nom];
    jeu.etat.wg = {};
  }
  journaliser(sd, '', 'kernel', 0, `Linux version ${noyau?.courant ?? '6.12.0-quetes'} (${sd.hote})`);
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

// Le dernier dimanche d'un mois, à 1 h UTC : changement d'heure en Europe.
const dernierDimanche = (annee: number, mois: number) => {
  const d = new Date(Date.UTC(annee, mois + 1, 0, 1));
  return d.getTime() - d.getUTCDay() * 86_400_000;
};

/** L'horloge des machines suit l'heure de Paris : vrai en heure d'été (CEST, UTC+2). */
export function heureEte(local: number): boolean {
  const annee = new Date(local).getUTCFullYear();
  const utc = local - 3600_000;
  return utc >= dernierDimanche(annee, 2) && utc < dernierDimanche(annee, 9);
}

/** Heure locale de la machine → heure UTC (millisecondes). */
export const versUtc = (local: number) => local - (heureEte(local) ? 2 : 1) * 3600_000;

/** « mar. 2026-10-13 20:00:01 CEST », comme systemctl status. */
export function dateComplete(ms: number, langue: string, sd?: Systemd): string {
  const zone = sd?.zone ?? (heureEte(ms) ? 'CEST' : 'CET');
  const affiche = ms + (sd?.ecart ?? 0);
  const { weekday } = parties(affiche, langue, { weekday: 'short' });
  return `${weekday} ${new Date(affiche).toISOString().slice(0, 10)} ${heure(affiche)} ${zone}`;
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
  `${dateJournal(e.temps + (sd.ecart ?? 0), langue)} ${sd.hote} ${e.ident}${e.pid ? `[${e.pid}]` : ''}: ${e.message}`;

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

/** systemctl reload : renvoie false si la configuration est refusée (le service garde l'ancienne). */
export function recharger(jeu: Jeu, sd: Systemd, nom: string): boolean {
  const s = sd.services[nom];
  const unite = `${nom}.service`;
  const pid = s.processus[0]?.pid ?? 1;
  journaliser(sd, unite, 'systemd', 1, `Reloading ${unite} - ${s.description}...`);
  const erreurs = s.verifierAuRechargement ? s.verifier?.(jeu) : null;
  if (erreurs) {
    erreurs.forEach((e, i) => journaliser(sd, unite, s.executable, pid, e, 3, i === 0));
    journaliser(sd, unite, 'systemd', 1, `${unite}: Control process exited, code=exited, status=255/EXCEPTION`, 4, false);
    journaliser(sd, unite, 'systemd', 1, `Reload failed for ${unite} - ${s.description}.`, 3, false);
    return false;
  }
  s.charger?.(jeu);
  journaliser(sd, unite, 'systemd', 1, `Reloaded ${unite} - ${s.description}.`);
  return true;
}
