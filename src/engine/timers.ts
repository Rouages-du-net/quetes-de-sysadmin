// Les unités écrites à la main et les timers de systemd : un fichier
// /etc/systemd/system/NOM.service (Type=oneshot, ExecStart=, User=) et
// NOM.timer (OnCalendar=, OnBootSec=, OnUnitActiveSec=), chargés à la
// demande ou par daemon-reload. D'après systemd.timer(5), systemd.time(7)
// et systemd.service(5) :
// https://www.freedesktop.org/software/systemd/man/latest/systemd.timer.html,
// https://www.freedesktop.org/software/systemd/man/latest/systemd.time.html
// Écarts : OnCalendar= comprend un jour de la semaine, *-*-* et une heure
// H:M[:S] (*, nombres, listes, a/pas), plus minutely, hourly, daily,
// weekly ; à la minute près ; pas de Persistent= ni de RandomizedDelaySec=.

import type { Jeu, Shell } from './shell';
import { journaliser, systemd, type Systemd } from './systemd';
import { analyser, tourneA } from './cron';
import { envoyer } from './commands/monitoring';

export interface Minuterie {
  description: string;
  // Le service qu'il lance (Unit=, sinon NOM.service).
  unite: string;
  calendrier: string[];
  // OnBootSec=, OnActiveSec=, OnUnitActiveSec= (ms).
  apresDemarrage?: number;
  apresActivation?: number;
  apresDerniere?: number;
  active: boolean;
  etat: 'active' | 'inactive';
  depuis: number;
  // Dernier déclenchement.
  dernier?: number;
  fichier: string;
}

const JOURS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

interface Calendrier {
  jours: Set<number> | null;
  heures: Set<number>;
  minutes: Set<number>;
  // La forme normalisée, comme systemd-analyze calendar.
  normal: string;
}

// Un champ : *, 5, 0/15 (de 0 en 0 par 15), */10, 1,15,30, 8..18.
function champ(texte: string, max: number): { valeurs: Set<number>; normal: string } | null {
  const valeurs = new Set<number>();
  const normal: string[] = [];
  for (const morceau of texte.split(',')) {
    const m = /^(\*|\d{1,2})(?:\.\.(\d{1,2}))?(?:\/(\d{1,2}))?$/.exec(morceau);
    if (!m) return null;
    const debut = m[1] === '*' ? 0 : Number(m[1]);
    const fin = m[2] !== undefined ? Number(m[2]) : m[3] !== undefined || m[1] === '*' ? max : debut;
    const pas = m[3] !== undefined ? Number(m[3]) : 1;
    if (debut > max || fin > max || pas === 0) return null;
    for (let v = debut; v <= fin; v += pas) valeurs.add(v);
    const deux = (n: number) => String(n).padStart(2, '0');
    normal.push(
      m[1] === '*' && !m[3] ? '*' : `${m[1] === '*' ? '00' : deux(debut)}${m[2] !== undefined ? `..${deux(fin)}` : ''}${m[3] ? `/${pas}` : ''}`,
    );
  }
  return { valeurs, normal: normal.join(',') };
}

const RACCOURCIS: Record<string, string> = {
  minutely: '*-*-* *:*:00',
  hourly: '*-*-* *:00:00',
  daily: '*-*-* 00:00:00',
  weekly: 'Mon *-*-* 00:00:00',
};

/** OnCalendar= → les minutes où le timer se déclenche ; null si systemd refuserait l'expression. */
export function lireCalendrier(texte: string): Calendrier | null {
  let reste = (RACCOURCIS[texte.trim()] ?? texte).trim().split(/\s+/);
  let jours: Set<number> | null = null;
  let prefixe = '';
  if (/^[A-Z][a-z]{2}/.test(reste[0] ?? '')) {
    jours = new Set();
    for (const p of reste[0].split(',')) {
      const [a, b] = p.split('..').map((x) => JOURS.indexOf(x));
      if (a < 0 || (b !== undefined && b < 0)) return null;
      for (let j = a; j !== (b ?? a) + 1; j = (j + 1) % 7) {
        jours.add(j);
        if (b === undefined) break;
      }
    }
    prefixe = `${reste[0]} `;
    reste = reste.slice(1);
  }
  if (reste.length === 2) {
    if (reste[0] !== '*-*-*') return null;
    reste = reste.slice(1);
  } else if (reste.length !== 1) return null;
  const temps = reste[0].split(':');
  if (temps.length < 2 || temps.length > 3) return null;
  const heures = champ(temps[0], 23);
  const minutes = champ(temps[1], 59);
  const secondes = temps[2] === undefined ? { valeurs: new Set([0]), normal: '00' } : champ(temps[2], 59);
  if (!heures || !minutes || !secondes) return null;
  const sec = secondes.normal === '*' ? '*' : secondes.normal;
  return { jours, heures: heures.valeurs, minutes: minutes.valeurs, normal: `${prefixe}*-*-* ${heures.normal}:${minutes.normal}:${sec}` };
}

/** La prochaine minute (après `apres`, exclue) où l'expression se déclenche (heure locale lue comme UTC). */
export function prochainCalendrier(c: Calendrier, apres: number): number | null {
  let t = Math.floor(apres / 60_000) * 60_000 + 60_000;
  for (let i = 0; i < 60 * 24 * 8; i++, t += 60_000) {
    const d = new Date(t);
    if (c.minutes.has(d.getUTCMinutes()) && c.heures.has(d.getUTCHours()) && (!c.jours || c.jours.has(d.getUTCDay()))) return t;
  }
  return null;
}

/** « 5min », « 1h », « 30s », « 300 » (secondes), « 1h 30min » → ms ; null si illisible. */
export function lireDuree(texte: string): number | null {
  const unites: Record<string, number> = { '': 1000, s: 1000, sec: 1000, m: 60_000, min: 60_000, h: 3_600_000, hr: 3_600_000, d: 86_400_000 };
  let total = 0;
  const morceaux = texte.trim().split(/\s+/);
  for (const m of morceaux) {
    const p = /^(\d+)([a-z]*)$/.exec(m);
    if (!p || unites[p[2]] === undefined) return null;
    total += Number(p[1]) * unites[p[2]];
  }
  return morceaux.length ? total : null;
}

/** Le démarrage de la machine (le premier message de ce démarrage). */
const demarrageMachine = (sd: Systemd) => sd.journal.find((e) => e.demarrage === sd.demarrage)?.temps ?? sd.horloge;

/** Le prochain déclenchement d'un timer après `apres` ; null s'il n'en a plus (ex. OnUnitActiveSec= seul, service jamais lancé). */
export function prochainDeclenchement(sd: Systemd, m: Minuterie, apres: number): number | null {
  if (m.etat !== 'active') return null;
  const candidats: number[] = [];
  for (const texte of m.calendrier) {
    const c = lireCalendrier(texte);
    const t = c && prochainCalendrier(c, apres);
    if (t) candidats.push(t);
  }
  const plusTard = (t: number) => (t > apres ? t : null);
  if (m.apresDemarrage !== undefined && !m.dernier) {
    const t = plusTard(demarrageMachine(sd) + m.apresDemarrage);
    if (t) candidats.push(t);
  }
  if (m.apresActivation !== undefined && !m.dernier) {
    const t = plusTard(m.depuis + m.apresActivation);
    if (t) candidats.push(t);
  }
  // OnUnitActiveSec= : compté depuis le dernier lancement du service (rien tant qu'il n'a jamais tourné).
  if (m.apresDerniere !== undefined && m.dernier !== undefined)
    candidats.push(Math.max(m.dernier + m.apresDerniere, Math.floor(apres / 60_000) * 60_000 + 60_000));
  return candidats.length ? Math.min(...candidats) : null;
}

// ——— Les fichiers d'unité ———

function sections(texte: string): Record<string, Record<string, string[]>> {
  const r: Record<string, Record<string, string[]>> = {};
  let section = '';
  for (const ligne of texte.split('\n')) {
    const l = ligne.trim();
    if (!l || l.startsWith('#') || l.startsWith(';')) continue;
    const s = /^\[(.+)\]$/.exec(l);
    if (s) {
      section = s[1];
      r[section] ??= {};
      continue;
    }
    const m = /^([A-Za-z]+)\s*=\s*(.*)$/.exec(l);
    if (m && section) (r[section][m[1]] ??= []).push(m[2]);
  }
  return r;
}

/** Lit les unités de /etc/systemd/system (services et timers écrits à la main). */
export function chargerUnites(jeu: Shell, sd: Systemd): void {
  const lieu = jeu.trouver('/etc/systemd/system');
  if (lieu?.type !== 'dossier') return;
  for (const [nomFichier, n] of Object.entries(lieu.enfants)) {
    if (n.type !== 'fichier') continue;
    const chemin = `/etc/systemd/system/${nomFichier}`;
    const texte = jeu.lire(chemin) ?? '';
    const u = sections(texte);
    const description = u.Unit?.Description?.at(-1) ?? nomFichier;
    if (nomFichier.endsWith('.service')) {
      const nom = nomFichier.slice(0, -8);
      const ancien = sd.services[nom];
      if (ancien && !ancien.fichier) continue;
      const exec = u.Service?.ExecStart?.at(-1) ?? '';
      const compte = u.Service?.User?.at(-1) ?? 'root';
      sd.services[nom] = {
        description,
        etat: ancien?.etat ?? 'inactive',
        active: ancien?.active ?? false,
        processus: [],
        executable: exec.split(/\s+/)[0].split('/').at(-1) ?? nom,
        depuis: ancien?.depuis ?? sd.horloge,
        ponctuel: (u.Service?.Type?.at(-1) ?? 'simple') === 'oneshot',
        fichier: chemin,
        executer: (j) => executer(j as Shell, sd, nom, exec, compte),
      };
    } else if (nomFichier.endsWith('.timer')) {
      const nom = nomFichier.slice(0, -6);
      const t = u.Timer ?? {};
      const calendrier = (t.OnCalendar ?? []).filter((c) => {
        if (lireCalendrier(c)) return true;
        journaliser(
          sd,
          '',
          'systemd',
          1,
          `${chemin}:${texte.split('\n').findIndex((l) => l.includes(c)) + 1}: Failed to parse calendar specification, ignoring: ${c}`,
          4,
          false,
        );
        return false;
      });
      const duree = (cle: string) => {
        const v = t[cle]?.at(-1);
        return v === undefined ? undefined : (lireDuree(v) ?? undefined);
      };
      const ancien = sd.minuteries?.[nom];
      (sd.minuteries ??= {})[nom] = {
        description,
        unite: (t.Unit?.at(-1) ?? `${nom}.service`).replace(/\.service$/, ''),
        calendrier,
        apresDemarrage: duree('OnBootSec'),
        apresActivation: duree('OnActiveSec'),
        apresDerniere: duree('OnUnitActiveSec'),
        active: ancien?.active ?? false,
        etat: ancien?.etat ?? 'inactive',
        depuis: ancien?.depuis ?? sd.horloge,
        dernier: ancien?.dernier,
        fichier: chemin,
      };
    }
  }
}

/** ExecStart= : la commande tourne sous son compte (User=), sa sortie va au journal. */
function executer(jeu: Shell, sd: Systemd, nom: string, commande: string, compte: string): number {
  if (!commande) {
    journaliser(sd, `${nom}.service`, 'systemd', 1, `${nom}.service: Service has no ExecStart=, ExecStop=, or SuccessAction=. Refusing.`, 3);
    return 1;
  }
  const avant = jeu.qui;
  jeu.qui = compte;
  try {
    const r = jeu.sousCommande(commande, '/');
    const pid = 4000 + (jeu.etat.prochainPidUnite = ((jeu.etat.prochainPidUnite as number | undefined) ?? 0) + 1);
    for (const ligne of r.sortie.split('\n').filter(Boolean))
      journaliser(sd, `${nom}.service`, commande.split(/\s+/)[0].split('/').at(-1)!, pid, ligne, 6, false);
    return r.code;
  } finally {
    jeu.qui = avant;
  }
}

/** Le timer qui lance ce service (pour « TriggeredBy: »). */
export const timerDe = (sd: Systemd, service: string) => Object.entries(sd.minuteries ?? {}).find(([, m]) => m.unite === service)?.[0];

/**
 * Faire passer le temps minute par minute (de `debut` à `fin`) : à chaque
 * minute, `chaqueMinute` (ce qui arrive dans l'histoire), puis les timers
 * et les tâches cron qui tombent à cette minute. Renvoie combien de tâches
 * écrites à la main (timers de /etc, crontabs) ont tourné.
 */
export function passerTemps(jeu: Shell, debut: number, fin: number, chaqueMinute?: (t: number) => void): number {
  const sd = systemd(jeu)!;
  let lancements = 0;
  // Minute par minute, à la minute ronde (comme cron et les timers).
  for (let t = Math.ceil(debut / 60_000) * 60_000; t < fin; t += 60_000) {
    sd.horloge = t;
    chaqueMinute?.(t);
    for (const m of Object.values(sd.minuteries ?? {})) {
      if (prochainDeclenchement(sd, m, t - 60_000) !== t) continue;
      const s = sd.services[m.unite];
      if (!s) continue;
      m.dernier = t;
      sd.horloge = t;
      // On compte les timers écrits à la main (pas ceux livrés avec le système).
      if (m.fichier.startsWith('/etc/')) lancements++;
      journaliser(sd, `${m.unite}.service`, 'systemd', 1, `Starting ${m.unite}.service - ${s.description}...`, 6, false);
      lancerPonctuel(jeu, sd, m.unite);
    }
    for (const [compte, texte] of Object.entries((jeu.etat.crontabs ?? {}) as Record<string, string>))
      for (const tache of analyser(texte, '').taches)
        if (tourneA(tache, t)) {
          const avant = jeu.qui;
          jeu.qui = compte;
          lancements++;
          try {
            // Comme cron : ce qu'une tâche écrit part par courrier à son compte.
            const sortie = jeu.executerTache(tache.commande);
            if (sortie.trim()) envoyer(jeu, [compte], `Cron <${compte}@${sd.hote}> ${tache.commande}`, sortie);
          } finally {
            jeu.qui = avant;
          }
        }
  }
  sd.horloge = fin;
  return lancements;
}

// Un service ponctuel lancé par son timer (sans « Started », déjà écrit).
function lancerPonctuel(jeu: Shell, sd: Systemd, nom: string) {
  const s = sd.services[nom];
  const code = s.executer?.(jeu) ?? 0;
  const unite = `${nom}.service`;
  if (code !== 0) {
    journaliser(sd, unite, 'systemd', 1, `${unite}: Main process exited, code=exited, status=${code}/FAILURE`, 4, false);
    journaliser(sd, unite, 'systemd', 1, `${unite}: Failed with result 'exit-code'.`, 4, false);
    s.etat = 'failed';
    s.resultat = 'exit-code';
  } else {
    journaliser(sd, unite, 'systemd', 1, `${unite}: Deactivated successfully.`, 6, false);
    journaliser(sd, unite, 'systemd', 1, `Finished ${unite} - ${s.description}.`, 6, false);
    s.etat = 'inactive';
  }
  s.depuis = sd.horloge;
}
