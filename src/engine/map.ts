// La carte de la machine où l'on est : les lieux (dossiers) qu'on connaît,
// en arbre depuis la racine, avec l'endroit où l'on se trouve. Pour ne rien
// dévoiler, elle montre seulement les lieux où l'on est entré (cd), le
// chemin qui y mène, et les lieux qu'on aperçoit depuis eux (leurs
// sous-dossiers visibles) ; un lieu caché (.nom) n'y paraît qu'une fois
// visité. Ni les fichiers, ni ce qu'il y a dans les lieux seulement aperçus.

import type { Directory } from './world';
import type { Shell } from './shell';

export interface Place {
  name: string;
  path: string;
  // On y est entré ; on y est ; c'est la maison (~) ; on ne peut pas encore y entrer.
  visit: boolean;
  here: boolean;
  home: boolean;
  closed: boolean;
  children: Place[];
}

const parents = (path: string) => {
  const chunks = path.split('/').filter(Boolean);
  return chunks.map((_, i) => '/' + chunks.slice(0, i + 1).join('/'));
};

/** La carte de la session : l'arbre des lieux connus, depuis la racine (/). */
export function map(sh: Shell): Place {
  // Les lieux visités, et tout le chemin qui y mène (on y est passé).
  const walked = new Set<string>(['/']);
  for (const v of [...sh.visits, sh.cwd]) for (const p of parents(v)) walked.add(p);
  const place = (name: string, path: string, d: Directory, showChildren: boolean): Place => {
    const children = showChildren
      ? Object.entries(d.children)
          .filter(([n, e]) => e.type === 'directory' && (!n.startsWith('.') || walked.has(`${path === '/' ? '' : path}/${n}`)))
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([n, e]) => {
            const c = `${path === '/' ? '' : path}/${n}`;
            return place(n, c, e as Directory, walked.has(c));
          })
      : [];
    return {
      name,
      path,
      visit: walked.has(path),
      here: path === sh.cwd,
      home: path === sh.home,
      closed: !!d.blocked?.(sh),
      children,
    };
  };
  // Un lieu visité montre ses sous-dossiers ; un lieu de passage aussi (on les a vus en chemin).
  return place('/', '/', sh.root, true);
}
