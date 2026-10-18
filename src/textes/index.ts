// Accès aux textes de l'interface. format() remplace {variable} et gère les
// pluriels de la forme {n, plural, one {…} other {…}} avec Intl.PluralRules,
// pour que chaque langue écrive ses propres règles.

import { fr, type Cle } from './fr';

export const LANGUES = { fr } as const;
export type Langue = keyof typeof LANGUES;

export function textes(langue: Langue = 'fr') {
  const dico: Record<Cle, string> = LANGUES[langue] ?? fr;
  const pluriels = new Intl.PluralRules(langue);
  return (cle: Cle, vars: Record<string, string | number> = {}) =>
    dico[cle]
      .replace(/\{(\w+), plural, ((?:\w+ \{[^}]*\}\s*)+)\}/g, (_, nom: string, formes: string) => {
        const n = Number(vars[nom]);
        const choix = Object.fromEntries([...formes.matchAll(/(\w+) \{([^}]*)\}/g)].map((m) => [m[1], m[2]]));
        return (choix[pluriels.select(n)] ?? choix.other ?? '').replace(/#/g, new Intl.NumberFormat(langue).format(n));
      })
      .replace(/\{(\w+)\}/g, (_, nom: string) => String(vars[nom] ?? `{${nom}}`));
}
