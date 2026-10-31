// Les fichiers qu'un service garde ouverts (un journal, le plus souvent).
// Comme sous Linux, un fichier effacé (rm) alors qu'un processus l'a encore
// ouvert n'existe plus dans aucun dossier, mais sa place n'est rendue qu'à
// la fermeture : df le compte, du ne le voit plus (lsof +L1 le montre).
// Un fichier renommé reste celui que le processus écrit (d'où le
// postrotate de logrotate, ou copytruncate).
//
//   etat.ouverts = [{ service, pid, utilisateur, commande, fd, chemin, noeud }]

import type { Fichier } from './world';
import type { Jeu } from './shell';
import { systemd } from './systemd';

export interface Ouvert {
  service: string;
  pid: number;
  utilisateur: string;
  commande: string;
  fd: number;
  // Le chemin sous lequel le processus l'a ouvert (mis à jour si logrotate le renomme).
  chemin: string;
  noeud: Fichier;
}

export const ouverts = (j: Jeu): Ouvert[] => (j.etat.ouverts ??= []);

/** Le fichier tient-il encore (son service tourne) ? */
export const tenu = (j: Jeu, o: Ouvert) => systemd(j)?.services[o.service]?.etat === 'active';

/** Ce fichier a-t-il été effacé (plus aucun nom ne mène à lui) ? */
export const efface = (j: Jeu, o: Ouvert) => j.trouver(o.chemin) !== o.noeud;

/**
 * Au démarrage d'un service : il ouvre son journal (le crée s'il n'existe
 * pas) en ajout. Remplace ce que le service tenait avant.
 */
export function ouvrir(j: Jeu, o: Omit<Ouvert, 'noeud'>, proprio: string, groupe?: string): Fichier {
  const ici = j.trouver(o.chemin);
  let noeud: Fichier;
  if (ici?.type === 'fichier') noeud = ici;
  else {
    noeud = { type: 'fichier', contenu: '', lignes: true, proprio, ...(groupe ? { groupe } : {}), mode: 'rw-r-----', taille: 0 };
    const parent = j.trouver(o.chemin.replace(/\/[^/]+$/, ''));
    if (parent?.type === 'dossier') parent.enfants[o.chemin.split('/').at(-1)!] = noeud;
  }
  j.etat.ouverts = ouverts(j).filter((x) => x.service !== o.service);
  ouverts(j).push({ ...o, noeud });
  return noeud;
}

/** La place que tiennent les fichiers effacés mais encore ouverts, sous un point de montage. */
export function placeFantome(j: Jeu, montage: string): number {
  return ouverts(j)
    .filter((o) => tenu(j, o) && efface(j, o) && (montage === '/' || o.chemin === montage || o.chemin.startsWith(montage + '/')))
    .reduce((t, o) => t + (o.noeud.taille ?? (typeof o.noeud.contenu === 'string' ? o.noeud.contenu.length : 0)), 0);
}
