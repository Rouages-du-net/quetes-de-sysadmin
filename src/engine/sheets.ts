// Les fiches pour les enseignant·es : pour chaque chapitre, ce qu'il demande
// avant (le chapitre précédent ; pour les histoires qui le demandent, les
// clés données à la fin de l'Effaceur), les commandes qu'il fait découvrir
// (absentes des chapitres qui le précèdent dans l'ordre du jeu), et une durée
// indicative, tirée du nombre d'étapes que le jeu vérifie.

import { HISTOIRES } from './chapters';
import type { Chapitre, Histoire } from './world';

export interface Fiche {
  histoire: Histoire;
  chapitre: Chapitre;
  // Le chapitre à finir avant (null : aucun dans l'histoire).
  avant: Chapitre | null;
  nouvelles: string[];
  // Minutes, arrondies à 5.
  duree: number;
}

// Les commandes de tous les jours, qu'on ne présente plus après l'Effaceur.
const COURANTES = ['ls', 'cd', 'pwd', 'cat', 'less', 'id', 'whoami', 'clear', 'exit', 'help', 'man'];

/** Les fiches de toutes les histoires, dans l'ordre du jeu. */
export function fiches(): Fiche[] {
  const vues = new Set<string>();
  return HISTOIRES.flatMap((histoire) =>
    histoire.chapitres.map((chapitre, i) => {
      const nouvelles = chapitre.commandes.filter((c) => !vues.has(c) && (histoire.id === 'effaceur' || !COURANTES.includes(c)));
      chapitre.commandes.forEach((c) => vues.add(c));
      // Une dizaine de minutes pour lire et s'installer, puis environ trois par étape vérifiée.
      const duree = Math.max(15, Math.round((10 + 3 * chapitre.evenements.length) / 5) * 5);
      return { histoire, chapitre, avant: i > 0 ? histoire.chapitres[i - 1] : null, nouvelles, duree };
    }),
  );
}
