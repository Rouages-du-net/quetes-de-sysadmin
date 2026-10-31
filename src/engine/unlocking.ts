// Les histoires s'ouvrent peu à peu. La première (L'Effaceur) est ouverte
// d'emblée ; chacune des autres déclare dans `apres` (chapters/index.ts) les
// chapitres à finir avant d'en recevoir la clé : ce qu'elle suppose déjà su.
// Un joueur ou une joueuse avance ainsi par vagues, au lieu de tout voir
// ouvert après La Racine.

import { HISTOIRES } from './chapters';
import type { Histoire } from './world';

export const PREMIERE = 'effaceur';

const histoire = (id: string): Histoire | undefined => HISTOIRES.find((h) => h.id === id);
const histoireDe = (chapitre: string): Histoire | undefined => HISTOIRES.find((h) => h.chapitres.some((c) => c.id === chapitre));

/** Les chapitres qui manquent encore pour ouvrir cette histoire (vide : elle est ouverte). */
export function manquants(id: string, termines: readonly string[]): string[] {
  return (histoire(id)?.apres ?? []).filter((c) => !termines.includes(c));
}

/** Une histoire est ouverte quand ses chapitres « apres » sont tous finis. */
export const ouverte = (id: string, termines: readonly string[]): boolean => manquants(id, termines).length === 0;

/**
 * Tous les chapitres à finir, dans l'ordre, pour ouvrir cette histoire (et
 * celles dont elle dépend) : les chapitres d'une histoire se suivent, donc
 * finir l'un suppose d'avoir fini ceux d'avant.
 */
export function prerequis(id: string): string[] {
  const vus: string[] = [];
  const ajouter = (h: string) => {
    for (const c of histoire(h)?.apres ?? []) {
      const source = histoireDe(c)!;
      ajouter(source.id);
      for (const x of source.chapitres.slice(0, source.chapitres.findIndex((y) => y.id === c) + 1)) if (!vus.includes(x.id)) vus.push(x.id);
    }
  };
  ajouter(id);
  return vus;
}
