// systemd simulé : services, journal et horloge d'une machine, rangés dans
// etat.systemd. Comportements et messages d'après la documentation de
// systemd (https://www.freedesktop.org/software/systemd/man/latest/systemctl.html,
// .../journalctl.html) : systemctl et journalctl répondent en anglais, les
// dates suivent la langue du système, comme sur un vrai Linux.
// Écarts : pas de cibles ni de dépendances entre unités, un seul processus
// principal par service, horloge qui avance d'une seconde par action.

import { sgr } from './colours';
import type { Game } from './shell';
import type { Process } from './commands/system';

export interface Service {
  description: string;
  state: 'active' | 'inactive' | 'failed';
  // Lancé au démarrage de la machine (systemctl enable).
  active: boolean;
  // Processus du service quand il tourne (le premier est le principal).
  process: Process[];
  // Exécutable, pour « Main PID: 612 (nginx) ».
  executable: string;
  since: number;
  // Au démarrage : null si tout va bien, sinon les messages d'erreur que le
  // programme écrit dans le journal avant de s'arrêter.
  check?: (game: Game) => string[] | null;
  // Après un démarrage ou un rechargement réussi : le service applique sa
  // configuration (ex. sshd).
  load?: (game: Game) => void;
  // reload vérifie d'abord la configuration avec `verifier` (comme
  // ExecReload=/usr/sbin/sshd -t) ; sinon, il recharge sans vérifier.
  checkToReload?: boolean;
  // Type=oneshot : le service fait son travail puis s'arrête (ex. certbot,
  // lancé par un timer) ; il ne reste pas « active (running) ».
  oneshot?: boolean;
  // Type=oneshot avec RemainAfterExit=yes (networking, nftables) : le travail
  // fait, il reste « active (exited) », sans processus.
  activeRest?: boolean;
  // À l'arrêt du service (ex. timesyncd : l'horloge n'est plus suivie).
  stop?: (game: Game) => void;
  // Comment il s'est arrêté en échec (exit-code, oom-kill…).
  result?: string;
  // Les réglages des fichiers de surcharge (systemctl edit) : MemoryMax=, Restart=.
  maxMemory?: number;
  reboot?: string;
  // IOReadBandwidthMax= et IOWriteBandwidthMax= (le disque visé, en octets par seconde).
  readIo?: { device: string; bytes: number };
  writeIo?: { device: string; bytes: number };
  overrides?: string[];
  overridesFingerprint?: string;
  // Une unité écrite à la main (/etc/systemd/system/NOM.service) : son fichier,
  // et ce qu'elle lance (ExecStart=) ; renvoie le code de retour.
  file?: string;
  execute?: (game: Game) => number;
}

export interface Input {
  time: number;
  boot: number;
  unit: string;
  ident: string;
  pid: number;
  message: string;
  // 3 = erreur, 4 = avertissement, 6 = information (syslog).
  priority: number;
}

export interface Systemd {
  host: string;
  services: Record<string, Service>;
  log: Input[];
  // Heure locale simulée (millisecondes, lue comme UTC), démarrage en cours.
  clock: number;
  boot: number;
  // Vrai après un redémarrage, une fois l'état des services consulté.
  checkedAfterBoot?: boolean;
  // Un service a été démarré à la main depuis le dernier démarrage : ce qui
  // tourne ne prouve plus que la machine repart toute seule.
  mainAStarted?: boolean;
  // L'heure affichée par la machine (son fuseau, son horloge qui dérive) :
  // l'écart avec la vraie heure, et l'abréviation du fuseau (voir heure.ts).
  difference?: number;
  zone?: string;
  // Les timers (NOM.timer), voir minuteries.ts.
  timers?: Record<string, import('./timers').Timer>;
}

export const systemd = (game: Game): Systemd | undefined => game.state.systemd;

// Une entrée du journal, et l'horloge qui avance d'une seconde (sauf pour
// les lignes qui suivent dans la même seconde).
export function writeLog(sd: Systemd, unit: string, ident: string, pid: number, message: string, priority = 6, advance = true) {
  if (advance) sd.clock += 1000;
  sd.log.push({ time: sd.clock, boot: sd.boot, unit, ident, pid, message, priority });
}

/** Démarre un service ; renvoie false s'il échoue (erreurs au journal). */
export function start(game: Game, sd: Systemd, name: string, toBoot = false): boolean {
  const s = sd.services[name];
  if (!toBoot) sd.mainAStarted = true;
  const unit = `${name}.service`;
  writeLog(sd, unit, 'systemd', 1, `Starting ${unit} - ${s.description}...`);
  const errors = s.check?.(game) ?? null;
  const pid = s.process[0]?.pid ?? 1;
  if (errors) {
    errors.forEach((e, i) => writeLog(sd, unit, s.executable, pid, e, 3, i === 0));
    writeLog(sd, unit, 'systemd', 1, `${unit}: Control process exited, code=exited, status=1/FAILURE`, 4, false);
    writeLog(sd, unit, 'systemd', 1, `${unit}: Failed with result 'exit-code'.`, 4, false);
    writeLog(sd, unit, 'systemd', 1, `Failed to start ${unit} - ${s.description}.`, 3, false);
    s.state = 'failed';
    s.since = sd.clock;
    processRetirer(game, s);
    return false;
  }
  if (s.oneshot) {
    // Un service écrit à la main : son programme tourne, et son code de retour décide.
    const code = s.execute?.(game) ?? 0;
    if (code !== 0) {
      writeLog(
        sd,
        unit,
        'systemd',
        1,
        `${unit}: Main process exited, code=exited, status=${code}/${code === 1 ? 'FAILURE' : 'INVALIDARGUMENT'}`,
        4,
      );
      writeLog(sd, unit, 'systemd', 1, `${unit}: Failed with result 'exit-code'.`, 4, false);
      writeLog(sd, unit, 'systemd', 1, `Failed to start ${unit} - ${s.description}.`, 3, false);
      s.state = 'failed';
      s.result = 'exit-code';
      s.since = sd.clock;
      return false;
    }
    writeLog(sd, unit, 'systemd', 1, `${unit}: Deactivated successfully.`);
    writeLog(sd, unit, 'systemd', 1, `Finished ${unit} - ${s.description}.`, 6, false);
    s.state = 'inactive';
    s.since = sd.clock;
    return true;
  }
  writeLog(sd, unit, 'systemd', 1, `Started ${unit} - ${s.description}.`);
  // Le service tourne déjà quand il applique sa configuration (il peut recevoir des requêtes).
  s.state = 'active';
  s.result = undefined;
  s.load?.(game);
  s.since = sd.clock;
  const listing: Process[] = (game.state.process ??= []);
  for (const p of s.process) if (!listing.some((q) => q.pid === p.pid)) listing.push({ ...p });
  return true;
}

// Les processus du service s'arrêtent ; leurs enfants zombies disparaissent avec eux (init les récupère).
function processRetirer(game: Game, s: Service) {
  if (game.state.process)
    game.state.process = (game.state.process as Process[]).filter(
      (p) => !s.process.some((q) => q.pid === p.pid || (p.ppid === q.pid && p.zombie)),
    );
}

export function stop(game: Game, sd: Systemd, name: string) {
  const s = sd.services[name];
  const unit = `${name}.service`;
  writeLog(sd, unit, 'systemd', 1, `Stopping ${unit} - ${s.description}...`);
  writeLog(sd, unit, 'systemd', 1, `Stopped ${unit} - ${s.description}.`);
  s.state = 'inactive';
  s.since = sd.clock;
  processRetirer(game, s);
  s.stop?.(game);
}

/** Redémarrage de la machine : seuls les services activés (enable) repartent. */
export function restart(game: Game, sd: Systemd) {
  writeLog(sd, '', 'systemd-logind', 512, 'The system will reboot now!');
  for (const [name, s] of Object.entries(sd.services)) if (s.state === 'active') stop(game, sd, name);
  sd.clock += 90_000;
  sd.boot++;
  game.state.process = (game.state.process as Process[] | undefined)?.filter((p) => p.pid === 1) ?? [];
  // Le noyau installé devient celui qui tourne ; /run (tmpfs) repart vide, avec reboot-required.
  const kernel = game.state.kernel as { active: string; installed: string } | undefined;
  if (kernel) kernel.active = kernel.installed;
  for (const f of ['/var/run/reboot-required', '/var/run/reboot-required.pkgs']) if (game.exists(f)) game.erase(f);
  // Les sessions tmux meurent avec la machine ; les règles du pare-feu aussi (nftables.service les recharge s'il est activé).
  if (game.state.tmux) game.state.tmux = {};
  if (game.state.nft) game.state.nft = { tables: [] };
  // Les interfaces WireGuard aussi (wg-quick@wg0 les remonte s'il est activé).
  if (game.state.wg) {
    for (const name of Object.keys(game.state.wg)) delete game.state.lan?.interfaces[name];
    game.state.wg = {};
  }
  writeLog(sd, '', 'kernel', 0, `Linux version ${kernel?.active ?? '6.12.0-quetes'} (${sd.host})`);
  // Une machine qui monte ses disques selon /etc/fstab (voir fstab.ts) : si ce n'est
  // pas possible, elle s'arrête en mode secours, sans lancer ses services.
  const mounts = game.state.startMounts as ((j: Game) => boolean) | undefined;
  if (mounts && !mounts(game)) {
    for (const s of Object.values(sd.services)) {
      s.state = 'inactive';
      s.since = sd.clock;
    }
    sd.checkedAfterBoot = false;
    sd.mainAStarted = false;
    return;
  }
  for (const [name, s] of Object.entries(sd.services)) {
    s.state = 'inactive';
    s.since = sd.clock;
    if (s.active) start(game, sd, name, true);
  }
  sd.checkedAfterBoot = false;
  sd.mainAStarted = false;
}

// ——— Dates ———

const parts = (ms: number, language: string, options: Intl.DateTimeFormatOptions) =>
  Object.fromEntries(new Intl.DateTimeFormat(language, { timeZone: 'UTC', ...options }).formatToParts(new Date(ms)).map((p) => [p.type, p.value]));
const timeOfDay = (ms: number) => new Date(ms).toISOString().slice(11, 19);

/** « oct. 13 21:02:44 », comme journalctl (mois abrégé de la langue). */
export function logDate(ms: number, language: string): string {
  const { month } = parts(ms, language, { month: 'short' });
  return `${month} ${new Date(ms).toISOString().slice(8, 10)} ${timeOfDay(ms)}`;
}

// Le dernier dimanche d'un mois, à 1 h UTC : changement d'heure en Europe.
const lastSunday = (year: number, month: number) => {
  const d = new Date(Date.UTC(year, month + 1, 0, 1));
  return d.getTime() - d.getUTCDay() * 86_400_000;
};

/** L'horloge des machines suit l'heure de Paris : vrai en heure d'été (CEST, UTC+2). */
export function summerTime(local: number): boolean {
  const year = new Date(local).getUTCFullYear();
  const utc = local - 3600_000;
  return utc >= lastSunday(year, 2) && utc < lastSunday(year, 9);
}

/** Heure locale de la machine → heure UTC (millisecondes). */
export const toUtc = (local: number) => local - (summerTime(local) ? 2 : 1) * 3600_000;

/** « mar. 2026-10-13 20:00:01 CEST », comme systemctl status. */
export function dateComplete(ms: number, language: string, sd?: Systemd): string {
  const zone = sd?.zone ?? (summerTime(ms) ? 'CEST' : 'CET');
  const shows = ms + (sd?.difference ?? 0);
  const { weekday } = parts(shows, language, { weekday: 'short' });
  return `${weekday} ${new Date(shows).toISOString().slice(0, 10)} ${timeOfDay(shows)} ${zone}`;
}

/** « 1h 2min », « 3min 12s », « 5s », comme systemd. */
export function duration(ms: number): string {
  let s = Math.max(0, Math.round(ms / 1000));
  const h = Math.floor(s / 3600);
  const min = Math.floor((s % 3600) / 60);
  s %= 60;
  if (h) return min ? `${h}h ${min}min` : `${h}h`;
  if (min) return s ? `${min}min ${s}s` : `${min}min`;
  return `${s}s`;
}

// Sur un terminal, journalctl met en valeur le message selon sa priorité :
// erreur et plus grave en rouge gras, avertissement en jaune gras, notice
// en gras (couleurs de systemd, voir journalctl(1) et SYSTEMD_COLORS).
const PRIORITY_COLOUR = (p: number) => (p <= 3 ? '1;31' : p === 4 ? '1;33' : p === 5 ? '1' : '');

export const logLine = (e: Input, sd: Systemd, language: string, colour = false) =>
  `${logDate(e.time + (sd.difference ?? 0), language)} ${sd.host} ${e.ident}${e.pid ? `[${e.pid}]` : ''}: ${colour ? sgr(PRIORITY_COLOUR(e.priority), e.message) : e.message}`;

export type DefinitionService = Omit<Service, 'since' | 'state' | 'process'> & { state?: Service['state']; process?: Process[] };

/**
 * L'état systemd d'une machine allumée à `demarre` (heure locale, lue comme
 * UTC) : les services actifs ont démarré à ce moment-là ; `maintenant` est
 * l'heure au début du chapitre.
 */
export function newSystemd(host: string, started: number, now: number, definitions: Record<string, DefinitionService>): Systemd {
  const sd: Systemd = { host, services: {}, log: [], clock: started, boot: 1 };
  writeLog(sd, '', 'kernel', 0, `Linux version 6.12.0-quetes (${host})`);
  for (const [name, d] of Object.entries(definitions)) {
    const state = d.state ?? 'active';
    sd.services[name] = { ...d, state, process: d.process ?? [], since: sd.clock };
    if (state === 'active') {
      writeLog(sd, `${name}.service`, 'systemd', 1, `Starting ${name}.service - ${d.description}...`);
      writeLog(sd, `${name}.service`, 'systemd', 1, `Started ${name}.service - ${d.description}.`);
      sd.services[name].since = sd.clock;
    }
  }
  sd.clock = now;
  return sd;
}

/** systemctl reload : renvoie false si la configuration est refusée (le service garde l'ancienne). */
export function reload(game: Game, sd: Systemd, name: string): boolean {
  const s = sd.services[name];
  const unit = `${name}.service`;
  const pid = s.process[0]?.pid ?? 1;
  writeLog(sd, unit, 'systemd', 1, `Reloading ${unit} - ${s.description}...`);
  const errors = s.checkToReload ? s.check?.(game) : null;
  if (errors) {
    errors.forEach((e, i) => writeLog(sd, unit, s.executable, pid, e, 3, i === 0));
    writeLog(sd, unit, 'systemd', 1, `${unit}: Control process exited, code=exited, status=255/EXCEPTION`, 4, false);
    writeLog(sd, unit, 'systemd', 1, `Reload failed for ${unit} - ${s.description}.`, 3, false);
    return false;
  }
  s.load?.(game);
  writeLog(sd, unit, 'systemd', 1, `Reloaded ${unit} - ${s.description}.`);
  return true;
}
