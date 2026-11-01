// Les histoires s'ouvrent peu à peu. La première (L'Effaceur) est ouverte
// d'emblée ; chacune des autres déclare dans `apres` (chapters/index.ts) les
// chapitres à finir avant d'en recevoir la clé : ce qu'elle suppose déjà su.
// Un joueur ou une joueuse avance ainsi par vagues, au lieu de tout voir
// ouvert après La Racine.

import { STORIES } from './chapters';
import type { Story } from './world';

export const FIRST = 'effaceur';

const story = (id: string): Story | undefined => STORIES.find((h) => h.id === id);
const storyFor = (chapter: string): Story | undefined => STORIES.find((h) => h.chapters.some((c) => c.id === chapter));

/** Les chapitres qui manquent encore pour ouvrir cette histoire (vide : elle est ouverte). */
export function missing(id: string, finished: readonly string[]): string[] {
  return (story(id)?.after ?? []).filter((c) => !finished.includes(c));
}

/** Une histoire est ouverte quand ses chapitres « apres » sont tous finis. */
export const isOpen = (id: string, finished: readonly string[]): boolean => missing(id, finished).length === 0;

/**
 * Tous les chapitres à finir, dans l'ordre, pour ouvrir cette histoire (et
 * celles dont elle dépend) : les chapitres d'une histoire se suivent, donc
 * finir l'un suppose d'avoir fini ceux d'avant.
 */
export function prerequisites(id: string): string[] {
  const seen: string[] = [];
  const add = (h: string) => {
    for (const c of story(h)?.after ?? []) {
      const source = storyFor(c)!;
      add(source.id);
      for (const x of source.chapters.slice(0, source.chapters.findIndex((y) => y.id === c) + 1)) if (!seen.includes(x.id)) seen.push(x.id);
    }
  };
  add(id);
  return seen;
}
