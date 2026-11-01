// Les indices gradués, demandés par le joueur ou la joueuse (le panneau
// « Mission ») : d'abord le manuel à lire, puis une piste, puis presque la
// réponse. Ils suivent la partie : l'indice est celui de la première étape
// du chapitre pas encore franchie. Le mode examen n'en donne aucun, et le
// débrief dit combien on en a demandé.
// Textes : src/texts/<langue>/indices-<histoire>.ftl, un message par étape
// (indice-<chapitre>-<événement>) avec ses attributs .piste et .solution.
// Une étape sans message n'a pas d'indice (une fausse piste, un avertissement).

import type { Shell } from './shell';
import { allSheets } from './sheets';

export type HintLevel = 'manuel' | 'piste' | 'solution';
export const HINT_LEVELS: HintLevel[] = ['manuel', 'piste', 'solution'];

export interface Hint {
  // L'étape visée (l'identifiant de l'événement), ou null : plus rien à indiquer.
  step: string | null;
  // Les pages du manuel utiles dans ce chapitre (les commandes qu'il fait découvrir).
  manual: string[];
  lead: string | null;
  solution: string | null;
}

/** L'indice du moment pour cette session (son chapitre, ses étapes déjà franchies). */
export function hint(sh: Shell): Hint {
  const c = sh.chapter;
  const sheet = allSheets().find((f) => f.chapter === c);
  const manual = sheet?.fresh.length ? sheet.fresh : c.commands.filter((x) => !['ls', 'cd', 'pwd', 'cat', 'less'].includes(x)).slice(0, 4);
  const order = c.steps ?? c.events.map((e) => e.id);
  const step = order.find((e) => !sh.flags.has(e) && sh.t.exists(`indice-${c.id}-${e}.piste`));
  if (!step) return { step: null, manual, lead: null, solution: null };
  const id = `indice-${c.id}-${step}`;
  return { step, manual, lead: sh.t(`${id}.piste`), solution: sh.t(`${id}.solution`) };
}
