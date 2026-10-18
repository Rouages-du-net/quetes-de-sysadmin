// cron : les tâches planifiées d'une machine (crontab(5) :
// https://manpages.debian.org/bookworm/cron/crontab.5.en.html).
//   m h dom mon dow commande, avec *, listes (1,5), plages (1-5), pas (*/15),
//   et les raccourcis @hourly, @daily, @weekly, @monthly, @yearly, @reboot.
//   Si jour du mois ET jour de la semaine sont restreints, l'un OU l'autre
//   suffit (comme le vrai cron).
// Les crontabs vivent dans etat.crontabs (par compte). Le jeu ne peut pas
// attendre : une histoire « fait passer la nuit » et lance les tâches qui
// tombent dans ce créneau (nuit()).

import type { Jeu } from './shell';

export const MODELE = `# Edit this file to introduce tasks to be run by cron.
#
# Each task to run has to be defined through a single line
# indicating with different fields when the task will be run
# and what command to run for the task
#
# To define the time you can provide concrete values for
# minute (m), hour (h), day of month (dom), month (mon),
# and day of week (dow) or use '*' in these fields (for 'any').
#
# Notice that tasks will be started based on the cron's system
# daemon's notion of time and timezones.
#
# Output of the crontab jobs (including errors) is sent through
# email to the user the crontab file belongs to (unless redirected).
#
# For example, you can run a backup of all your user accounts
# at 5 a.m every week with:
# 0 5 * * 1 tar -zcf /var/backups/home.tgz /home/
#
# For more information see the manual pages of crontab(5) and cron(8)
#
# m h  dom mon dow   command
`;

export interface Tache {
  ligne: string;
  commande: string;
  champs: Set<number>[];
  // Jour du mois / jour de la semaine restreints (règle du « ou »).
  domEtoile: boolean;
  dowEtoile: boolean;
}

const BORNES: [string, number, number][] = [
  ['minute', 0, 59],
  ['hour', 0, 23],
  ['day-of-month', 1, 31],
  ['month', 1, 12],
  ['day-of-week', 0, 7],
];
const RACCOURCIS: Record<string, string> = {
  '@yearly': '0 0 1 1 *',
  '@annually': '0 0 1 1 *',
  '@monthly': '0 0 1 * *',
  '@weekly': '0 0 * * 0',
  '@daily': '0 0 * * *',
  '@midnight': '0 0 * * *',
  '@hourly': '0 * * * *',
};

function champ(texte: string, min: number, max: number): Set<number> | null {
  const valeurs = new Set<number>();
  for (const partie of texte.split(',')) {
    const m = /^(\*|(\d+)(?:-(\d+))?)(?:\/(\d+))?$/.exec(partie);
    if (!m) return null;
    const debut = m[1] === '*' ? min : Number(m[2]);
    const fin = m[1] === '*' ? max : m[3] !== undefined ? Number(m[3]) : m[4] ? max : debut;
    const pas = m[4] ? Number(m[4]) : 1;
    if (debut < min || fin > max || debut > fin || pas < 1) return null;
    for (let v = debut; v <= fin; v += pas) valeurs.add(v);
  }
  // 7 = dimanche, comme 0.
  if (max === 7 && valeurs.has(7)) valeurs.add(0);
  return valeurs;
}

/** Lit une crontab ; erreurs au format de crontab -e (fichier:ligne: bad champ). */
export function analyser(texte: string, fichier: string): { taches: Tache[]; erreurs: string[]; auDemarrage: string[] } {
  const taches: Tache[] = [];
  const auDemarrage: string[] = [];
  const erreurs: string[] = [];
  texte.split('\n').forEach((brute, i) => {
    const ligne = brute.trim();
    if (!ligne || ligne.startsWith('#') || /^[A-Za-z_]+\s*=/.test(ligne)) return;
    const mots = ligne.split(/\s+/);
    if (mots[0] === '@reboot') {
      if (mots.length < 2) erreurs.push(`"${fichier}":${i + 1}: bad command`);
      else auDemarrage.push(mots.slice(1).join(' '));
      return;
    }
    const [horaire, reste] = RACCOURCIS[mots[0]] ? [RACCOURCIS[mots[0]].split(' '), mots.slice(1)] : [mots.slice(0, 5), mots.slice(5)];
    const champs: Set<number>[] = [];
    for (let k = 0; k < 5; k++) {
      const c = horaire[k] === undefined ? null : champ(horaire[k], BORNES[k][1], BORNES[k][2]);
      if (!c) return void erreurs.push(`"${fichier}":${i + 1}: bad ${BORNES[k][0]}`);
      champs.push(c);
    }
    if (!reste.length) return void erreurs.push(`"${fichier}":${i + 1}: bad command`);
    taches.push({ ligne, commande: reste.join(' '), champs, domEtoile: horaire[2] === '*', dowEtoile: horaire[4] === '*' });
  });
  if (erreurs.length) erreurs.push("errors in crontab file, can't install.");
  return { taches, erreurs, auDemarrage };
}

/** La tâche tourne-t-elle à cette minute (date lue comme heure locale, en UTC) ? */
export function tourneA(t: Tache, ms: number): boolean {
  const d = new Date(ms);
  const [mi, h, dom, mon, dow] = t.champs;
  if (!mi.has(d.getUTCMinutes()) || !h.has(d.getUTCHours()) || !mon.has(d.getUTCMonth() + 1)) return false;
  const jourMois = dom.has(d.getUTCDate());
  const jourSemaine = dow.has(d.getUTCDay());
  if (t.domEtoile || t.dowEtoile) return (t.domEtoile || jourMois) && (t.dowEtoile || jourSemaine);
  return jourMois || jourSemaine;
}

export interface Execution {
  commande: string;
  sortie: string;
}

/**
 * Fait passer un créneau (de `debut` à `fin`) : chaque tâche de chaque
 * crontab qui tombe dedans est lancée une fois, sous son compte, depuis sa
 * maison. Renvoie ce qui a tourné, avec ce que cron aurait envoyé par courrier.
 */
export function passer(jeu: Jeu & { executerTache(ligne: string): string; qui: string }, debut: number, fin: number): Execution[] {
  const executions: Execution[] = [];
  const crontabs: Record<string, string> = jeu.etat.crontabs ?? {};
  for (const [compte, texte] of Object.entries(crontabs)) {
    for (const t of analyser(texte, '').taches) {
      let tourne = false;
      for (let ms = debut; ms < fin && !tourne; ms += 60_000) tourne = tourneA(t, ms);
      if (!tourne) continue;
      const avant = jeu.qui;
      jeu.qui = compte;
      try {
        executions.push({ commande: t.commande, sortie: jeu.executerTache(t.commande) });
      } finally {
        jeu.qui = avant;
      }
    }
  }
  return executions;
}
