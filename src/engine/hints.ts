// Les indices gradués, demandés par le joueur ou la joueuse (le panneau
// « Mission ») : d'abord le manuel à lire, puis une piste, puis presque la
// réponse. Ils suivent la partie : l'indice est celui de la première étape
// du chapitre pas encore franchie. Le mode examen n'en donne aucun, et le
// débrief dit combien on en a demandé.
// Textes : src/texts/<langue>/indices-<histoire>.ftl, un message par étape
// (indice-<chapitre>-<événement>) avec ses attributs .piste et .solution.
// Une étape sans message n'a pas d'indice (une fausse piste, un avertissement).

import type { Shell } from './shell';
import { fiches } from './sheets';

export type Niveau = 'manuel' | 'piste' | 'solution';
export const NIVEAUX: Niveau[] = ['manuel', 'piste', 'solution'];

export interface Indice {
  // L'étape visée (l'identifiant de l'événement), ou null : plus rien à indiquer.
  etape: string | null;
  // Les pages du manuel utiles dans ce chapitre (les commandes qu'il fait découvrir).
  manuel: string[];
  piste: string | null;
  solution: string | null;
}

/** L'indice du moment pour cette session (son chapitre, ses étapes déjà franchies). */
export function indice(sh: Shell): Indice {
  const c = sh.chapitre;
  const fiche = fiches().find((f) => f.chapitre === c);
  const manuel = fiche?.nouvelles.length ? fiche.nouvelles : c.commandes.filter((x) => !['ls', 'cd', 'pwd', 'cat', 'less'].includes(x)).slice(0, 4);
  const ordre = c.etapes ?? c.evenements.map((e) => e.id);
  const etape = ordre.find((e) => !sh.drapeaux.has(e) && sh.t.existe(`indice-${c.id}-${e}.piste`));
  if (!etape) return { etape: null, manuel, piste: null, solution: null };
  const id = `indice-${c.id}-${etape}`;
  return { etape, manuel, piste: sh.t(`${id}.piste`), solution: sh.t(`${id}.solution`) };
}
