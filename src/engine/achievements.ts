// Les succès et le grade : de petites récompenses, vérifiées sur ce qui
// s'est vraiment passé (la ligne tapée, l'état de la partie), jamais
// déclarées par le joueur ou la joueuse. Les textes (nom, description)
// sont dans src/texts/<langue>/interface.ftl : succes-<id>, et
// succes-<id>.description. Un succès « caché » ne montre son nom qu'une
// fois obtenu (les clins d'œil).

import { STORIES } from './chapters';
import type { Shell } from './shell';
import type { Notebook } from './notebook';

export interface Context {
  // La session où la ligne a été tapée (null : vérification hors d'une ligne).
  sh: Shell | null;
  finished: string[];
  notebook: Notebook;
  // Meilleurs temps en mode examen, par chapitre (ms).
  records: Record<string, number>;
}

export interface Achievements {
  id: string;
  cache?: boolean;
  obtained: (c: Context) => boolean;
}

const finishedStories = (finished: string[]) => STORIES.filter((h) => h.chapters.every((c) => finished.includes(c.id)));
const commands = (c: Context) => c.sh?.last.commands ?? [];

export const ACHIEVEMENTS: Achievements[] = [
  { id: 'premiere-commande', obtained: (c) => Object.keys(c.notebook).length > 0 },
  { id: 'manuel', obtained: (c) => 'man' in c.notebook || 'apropos' in c.notebook },
  { id: 'cache-ls', obtained: (c) => commands(c).some((a) => a[0] === 'ls' && a.slice(1).some((o) => /^-[a-zA-Z]*a/.test(o) || o === '--all')) },
  { id: 'tube', obtained: (c) => commands(c).length >= 2 },
  { id: 'redirection', obtained: (c) => !!c.sh?.last.redirection },
  { id: 'premier-chapitre', obtained: (c) => c.finished.length >= 1 },
  { id: 'effaceur', obtained: (c) => finishedStories(c.finished).some((h) => h.id === 'eraser') },
  { id: 'restauration', obtained: (c) => ['backup', 'versions', 'snapshots', 'database'].some((id) => c.finished.includes(id)) },
  { id: 'reseau', obtained: (c) => finishedStories(c.finished).some((h) => h.id === 'hive') },
  { id: 'trois-histoires', obtained: (c) => finishedStories(c.finished).length >= 3 },
  { id: 'toutes-histoires', obtained: (c) => finishedStories(c.finished).length === STORIES.length },
  { id: 'cinquante-commandes', obtained: (c) => Object.keys(c.notebook).length >= 50 },
  { id: 'sans-indice', obtained: (c) => !!c.sh?.finished && c.sh.chapter.id !== 'desk' && c.sh.requestsHints.size === 0 },
  { id: 'examen', obtained: (c) => Object.keys(c.records).length > 0 },
  { id: 'examen-eclair', obtained: (c) => Object.values(c.records).some((ms) => ms < 5 * 60_000) },
  // Les clins d'œil : une ligne bien précise (voir OEUFS dans shell.ts).
  { id: 'xyzzy', cache: true, obtained: (c) => !!c.sh?.eggs.has('xyzzy') },
  { id: 'sandwich', cache: true, obtained: (c) => !!c.sh?.eggs.has('sandwich') },
  { id: 'sl', cache: true, obtained: (c) => !!c.sh?.eggs.has('sl') },
];

/** Les succès obtenus maintenant et pas encore notés (dans l'ordre de la liste). */
export const newAchievements = (c: Context, already: Record<string, string>) => ACHIEVEMENTS.filter((s) => !already[s.id] && s.obtained(c)).map((s) => s.id);

// Les grades, du premier au dernier : le nombre de chapitres terminés pour l'atteindre.
export const GRADES: { id: string; chapters: number }[] = [
  { id: 'stagiaire', chapters: 0 },
  { id: 'apprenti', chapters: 1 },
  { id: 'junior', chapters: 4 },
  { id: 'admin', chapters: 15 },
  { id: 'confirme', chapters: 30 },
  { id: 'senior', chapters: 45 },
];
const ALL = () => STORIES.reduce((n, h) => n + h.chapters.length, 0);

/** Le grade d'après les chapitres terminés : « SRE » pour tout le jeu. */
export function grade(finished: string[]): string {
  const n = finished.length;
  if (n >= ALL()) return 'sre';
  return GRADES.filter((g) => n >= g.chapters).at(-1)!.id;
}
