// L'astreinte et l'incident du jour. Chaque jour, un chapitre est tiré de la
// date (le même pour tout le monde, sans serveur) parmi ceux qui ressemblent à
// une vraie panne : on le rejoue « d'astreinte », avec un budget d'erreur,
// comme l'objectif de disponibilité (SLA) d'un service. Le budget fond avec
// le temps, chaque indice et chaque commande en erreur. À la fin, une carte
// de score à partager, en texte (comme on partage une grille de mots).
// Le moteur ne lit pas l'heure : l'interface donne la date et le temps écoulé.

import { HISTOIRES } from './chapitres';
import { PARCOURS } from './parcours';

// 30 minutes d'indisponibilité tolérée pour l'incident.
export const BUDGET_MS = 30 * 60 * 1000;
export const COUT_INDICE_MS = 3 * 60 * 1000;
export const COUT_ERREUR_MS = 20 * 1000;

// Les incidents possibles : les chapitres des parcours qui parlent de pannes,
// sans ceux des premiers pas (il faut déjà savoir se servir du terminal), ni
// ceux qui s'appuient sur le poste tel que les chapitres précédents l'ont
// laissé (clés, ~/.ssh/config : surveillePoste, clesDuJoueur) : ouverts
// directement, ils pourraient être impossibles à finir.
const THEMES = ['production', 'web', 'securite', 'reseau', 'sauvegardes', 'deploiement'];
const autonome = (id: string) => {
  const c = HISTOIRES.flatMap((h) => h.chapitres).find((x) => x.id === id)!;
  return !c.surveillePoste && !c.clesDuJoueur;
};
export const INCIDENTS: string[] = [...new Set(PARCOURS.filter((p) => THEMES.includes(p.id)).flatMap((p) => p.chapitres))].filter(autonome);

// FNV-1a : un nombre stable tiré d'un texte.
function condense(texte: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < texte.length; i++) h = Math.imul(h ^ texte.charCodeAt(i), 0x01000193) >>> 0;
  return h;
}

/** Le chapitre de l'incident du jour, pour une date AAAA-MM-JJ. */
export function incidentDuJour(date: string): string {
  return INCIDENTS[condense(`incident-${date}`) % INCIDENTS.length];
}

/** Où trouver ce chapitre : son histoire et son rang (pour l'ouvrir). */
export function placeDe(chapitre: string): { h: number; c: number } {
  const h = HISTOIRES.findIndex((x) => x.chapitres.some((c) => c.id === chapitre));
  return { h, c: HISTOIRES[h].chapitres.findIndex((c) => c.id === chapitre) };
}

/** Ce qui reste du budget (en ms, jamais négatif). */
export function budgetRestant(ecoule: number, indices: number, erreurs: number): number {
  return Math.max(0, BUDGET_MS - ecoule - indices * COUT_INDICE_MS - erreurs * COUT_ERREUR_MS);
}

/** La jauge en cinq cases, comme une grille de mots : 🟩 pleine, 🟨 entamée, ⬜ vide. */
export function jauge(restant: number): string {
  const part = (restant / BUDGET_MS) * 5;
  return Array.from({ length: 5 }, (_, i) => (part >= i + 1 ? '🟩' : part > i ? '🟨' : '⬜')).join('');
}

/** Le pourcentage du budget qui reste (entier). */
export const pourcent = (restant: number) => Math.round((restant / BUDGET_MS) * 100);
