// Les fiches pour les enseignant·es : pour chaque chapitre, ce qu'il demande
// avant (le chapitre précédent ; pour les histoires qui le demandent, les
// clés données à la fin de l'Effaceur), les commandes qu'il fait découvrir
// (absentes des chapitres qui le précèdent dans l'ordre du jeu), et une durée
// indicative, tirée du nombre d'étapes que le jeu vérifie.

import { STORIES } from './chapters';
import type { Chapter, Story } from './world';

export interface Sheet {
  story: Story;
  chapter: Chapter;
  // Le chapitre à finir avant (null : aucun dans l'histoire).
  before: Chapter | null;
  fresh: string[];
  // Minutes, arrondies à 5.
  duration: number;
}

// Les commandes de tous les jours, qu'on ne présente plus après l'Effaceur.
const CURRENT = ['ls', 'cd', 'pwd', 'cat', 'less', 'id', 'whoami', 'clear', 'exit', 'help', 'man'];

/** Les fiches de toutes les histoires, dans l'ordre du jeu. */
export function allSheets(): Sheet[] {
  const views = new Set<string>();
  return STORIES.flatMap((story) =>
    story.chapters.map((chapter, i) => {
      const fresh = chapter.commands.filter((c) => !views.has(c) && (story.id === 'eraser' || !CURRENT.includes(c)));
      chapter.commands.forEach((c) => views.add(c));
      // Une dizaine de minutes pour lire et s'installer, puis environ trois par étape vérifiée.
      const duration = Math.max(15, Math.round((10 + 3 * chapter.events.length) / 5) * 5);
      return { story, chapter, before: i > 0 ? story.chapters[i - 1] : null, fresh, duration };
    }),
  );
}
