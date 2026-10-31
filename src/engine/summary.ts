// Le bilan de fin de chapitre : combien de commandes (et d'erreurs),
// combien d'indices, et, étape par étape, la commande qui l'a franchie à
// côté de la solution de référence (celle des indices, voir indices.ts).
// Les objectifs sont vérifiés sur l'état de la machine : la commande du
// joueur ou de la joueuse peut être différente et tout aussi bonne. Le
// temps passé est mesuré par l'interface (le moteur reste déterministe).

import type { Shell } from './shell';

export interface EtapeBilan {
  etape: string;
  // La commande qui a franchi l'étape ; null : l'étape a été passée autrement.
  ligne: string | null;
  solution: string;
}

export interface Bilan {
  commandes: number;
  erreurs: number;
  indices: number;
  etapes: EtapeBilan[];
}

/** Le bilan d'un chapitre (sur sa session principale). */
export function bilan(sh: Shell): Bilan {
  const c = sh.chapitre;
  const ordre = c.etapes ?? c.evenements.map((e) => e.id);
  return {
    commandes: sh.commandesTapees,
    erreurs: sh.commandesEnErreur,
    indices: sh.indicesDemandes.size,
    etapes: ordre
      .filter((e) => sh.t.existe(`indice-${c.id}-${e}.solution`))
      .map((e) => ({ etape: e, ligne: sh.franchies[e] ?? null, solution: sh.t(`indice-${c.id}-${e}.solution`) })),
  };
}
