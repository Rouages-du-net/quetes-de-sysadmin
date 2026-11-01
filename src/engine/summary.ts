// Le bilan de fin de chapitre : combien de commandes (et d'erreurs),
// combien d'indices, et, étape par étape, la commande qui l'a franchie à
// côté de la solution de référence (celle des indices, voir indices.ts).
// Les objectifs sont vérifiés sur l'état de la machine : la commande du
// joueur ou de la joueuse peut être différente et tout aussi bonne. Le
// temps passé est mesuré par l'interface (le moteur reste déterministe).

import type { Shell } from './shell';

export interface SummaryStep {
  step: string;
  // La commande qui a franchi l'étape ; null : l'étape a été passée autrement.
  line: string | null;
  solution: string;
}

export interface Summary {
  commands: number;
  errors: number;
  hints: number;
  steps: SummaryStep[];
}

/** Le bilan d'un chapitre (sur sa session principale). */
export function summary(sh: Shell): Summary {
  const c = sh.chapter;
  const order = c.steps ?? c.events.map((e) => e.id);
  return {
    commands: sh.typedCommands,
    errors: sh.commandsInError,
    hints: sh.requestsHints.size,
    steps: order
      .filter((e) => sh.t.exists(`indice-${c.id}-${e}.solution`))
      .map((e) => ({ step: e, line: sh.passed[e] ?? null, solution: sh.t(`indice-${c.id}-${e}.solution`) })),
  };
}
