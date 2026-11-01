// L'astreinte et l'incident du jour. Chaque jour, un chapitre est tiré de la
// date (le même pour tout le monde, sans serveur) parmi ceux qui ressemblent à
// une vraie panne : on le rejoue « d'astreinte », avec un budget d'erreur,
// comme l'objectif de disponibilité (SLA) d'un service. Le budget fond avec
// le temps, chaque indice et chaque commande en erreur. À la fin, une carte
// de score à partager, en texte (comme on partage une grille de mots).
// Le moteur ne lit pas l'heure : l'interface donne la date et le temps écoulé.

import { STORIES } from './chapters';
import { PATH } from './paths';

// 30 minutes d'indisponibilité tolérée pour l'incident.
export const BUDGET_MS = 30 * 60 * 1000;
export const MS_HINT_COST = 3 * 60 * 1000;
export const MS_ERROR_COST = 20 * 1000;

// Les incidents possibles : les chapitres des parcours qui parlent de pannes,
// sans ceux des premiers pas (il faut déjà savoir se servir du terminal), ni
// ceux qui s'appuient sur le poste tel que les chapitres précédents l'ont
// laissé (clés, ~/.ssh/config : surveillePoste, clesDuJoueur) : ouverts
// directement, ils pourraient être impossibles à finir.
const THEMES = ['production', 'web', 'security', 'network', 'backups', 'deployment'];
const standalone = (id: string) => {
  const c = STORIES.flatMap((h) => h.chapters).find((x) => x.id === id)!;
  return !c.watchesWorkstation && !c.playerKeys;
};
export const INCIDENTS: string[] = [...new Set(PATH.filter((p) => THEMES.includes(p.id)).flatMap((p) => p.chapters))].filter(standalone);

// FNV-1a : un nombre stable tiré d'un texte.
function condensed(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 0x01000193) >>> 0;
  return h;
}

/**
 * Le chapitre de l'incident du jour, pour une date AAAA-MM-JJ, parmi ceux
 * des histoires déjà ouvertes (les histoires s'ouvrent peu à peu) ; null
 * s'il n'y en a encore aucun.
 */
export function dayIncident(date: string, isOpen: (story: string) => boolean = () => true): string | null {
  const possible = INCIDENTS.filter((id) => isOpen(STORIES[placeFor(id).h].id));
  return possible.length ? possible[condensed(`incident-${date}`) % possible.length] : null;
}

/** Où trouver ce chapitre : son histoire et son rang (pour l'ouvrir). */
export function placeFor(chapter: string): { h: number; c: number } {
  const h = STORIES.findIndex((x) => x.chapters.some((c) => c.id === chapter));
  return { h, c: STORIES[h].chapters.findIndex((c) => c.id === chapter) };
}

/** Ce qui reste du budget (en ms, jamais négatif). */
export function remainingBudget(elapsed: number, hints: number, errors: number): number {
  return Math.max(0, BUDGET_MS - elapsed - hints * MS_HINT_COST - errors * MS_ERROR_COST);
}

/** La jauge en cinq cases, comme une grille de mots : 🟩 pleine, 🟨 entamée, ⬜ vide. */
export function gauge(remaining: number): string {
  const part = (remaining / BUDGET_MS) * 5;
  return Array.from({ length: 5 }, (_, i) => (part >= i + 1 ? '🟩' : part > i ? '🟨' : '⬜')).join('');
}

/** Le pourcentage du budget qui reste (entier). */
export const percent = (remaining: number) => Math.round((remaining / BUDGET_MS) * 100);
