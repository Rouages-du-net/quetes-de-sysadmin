// La carte de la machine où l'on est : les lieux (dossiers) qu'on connaît,
// en arbre depuis la racine, avec l'endroit où l'on se trouve. Pour ne rien
// dévoiler, elle montre seulement les lieux où l'on est entré (cd), le
// chemin qui y mène, et les lieux qu'on aperçoit depuis eux (leurs
// sous-dossiers visibles) ; un lieu caché (.nom) n'y paraît qu'une fois
// visité. Ni les fichiers, ni ce qu'il y a dans les lieux seulement aperçus.

import type { Dossier } from './monde';
import type { Shell } from './shell';

export interface Lieu {
  nom: string;
  chemin: string;
  // On y est entré ; on y est ; c'est la maison (~) ; on ne peut pas encore y entrer.
  visite: boolean;
  ici: boolean;
  maison: boolean;
  ferme: boolean;
  enfants: Lieu[];
}

const parents = (chemin: string) => {
  const morceaux = chemin.split('/').filter(Boolean);
  return morceaux.map((_, i) => '/' + morceaux.slice(0, i + 1).join('/'));
};

/** La carte de la session : l'arbre des lieux connus, depuis la racine (/). */
export function carte(sh: Shell): Lieu {
  // Les lieux visités, et tout le chemin qui y mène (on y est passé).
  const parcourus = new Set<string>(['/']);
  for (const v of [...sh.visites, sh.cwd]) for (const p of parents(v)) parcourus.add(p);
  const lieu = (nom: string, chemin: string, d: Dossier, montrerEnfants: boolean): Lieu => {
    const enfants = montrerEnfants
      ? Object.entries(d.enfants)
          .filter(([n, e]) => e.type === 'dossier' && (!n.startsWith('.') || parcourus.has(`${chemin === '/' ? '' : chemin}/${n}`)))
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([n, e]) => {
            const c = `${chemin === '/' ? '' : chemin}/${n}`;
            return lieu(n, c, e as Dossier, parcourus.has(c));
          })
      : [];
    return {
      nom,
      chemin,
      visite: parcourus.has(chemin),
      ici: chemin === sh.cwd,
      maison: chemin === sh.maison,
      ferme: !!d.bloque?.(sh),
      enfants,
    };
  };
  // Un lieu visité montre ses sous-dossiers ; un lieu de passage aussi (on les a vus en chemin).
  return lieu('/', '/', sh.racine, true);
}
