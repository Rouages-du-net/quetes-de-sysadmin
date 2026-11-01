// Les fichiers qu'un service garde ouverts (un journal, le plus souvent).
// Comme sous Linux, un fichier effacé (rm) alors qu'un processus l'a encore
// ouvert n'existe plus dans aucun dossier, mais sa place n'est rendue qu'à
// la fermeture : df le compte, du ne le voit plus (lsof +L1 le montre).
// Un fichier renommé reste celui que le processus écrit (d'où le
// postrotate de logrotate, ou copytruncate).
//
//   etat.ouverts = [{ service, pid, utilisateur, commande, fd, chemin, noeud }]

import type { File } from './world';
import type { Game } from './shell';
import { systemd } from './systemd';

export interface Open {
  service: string;
  pid: number;
  user: string;
  command: string;
  fd: number;
  // Le chemin sous lequel le processus l'a ouvert (mis à jour si logrotate le renomme).
  path: string;
  node: File;
}

export const openSet = (j: Game): Open[] => (j.state.ouverts ??= []);

/** Le fichier tient-il encore (son service tourne) ? */
export const held = (j: Game, o: Open) => systemd(j)?.services[o.service]?.state === 'active';

/** Ce fichier a-t-il été effacé (plus aucun nom ne mène à lui) ? */
export const erases = (j: Game, o: Open) => j.find(o.path) !== o.node;

/**
 * Au démarrage d'un service : il ouvre son journal (le crée s'il n'existe
 * pas) en ajout. Remplace ce que le service tenait avant.
 */
export function open(j: Game, o: Omit<Open, 'node'>, owner: string, group?: string): File {
  const here = j.find(o.path);
  let node: File;
  if (here?.type === 'fichier') node = here;
  else {
    node = { type: 'fichier', content: '', lines: true, owner, ...(group ? { group } : {}), mode: 'rw-r-----', size: 0 };
    const parent = j.find(o.path.replace(/\/[^/]+$/, ''));
    if (parent?.type === 'dossier') parent.children[o.path.split('/').at(-1)!] = node;
  }
  j.state.ouverts = openSet(j).filter((x) => x.service !== o.service);
  openSet(j).push({ ...o, node });
  return node;
}

/** La place que tiennent les fichiers effacés mais encore ouverts, sous un point de montage. */
export function ghostPlace(j: Game, mount: string): number {
  return openSet(j)
    .filter((o) => held(j, o) && erases(j, o) && (mount === '/' || o.path === mount || o.path.startsWith(mount + '/')))
    .reduce((t, o) => t + (o.node.size ?? (typeof o.node.content === 'string' ? o.node.content.length : 0)), 0);
}
