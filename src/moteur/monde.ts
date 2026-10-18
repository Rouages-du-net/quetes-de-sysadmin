// Briques du monde du jeu : un vrai système de fichiers miniature.
// Un dossier = un lieu, un fichier = un objet ou un personnage.
// Chaque chapitre (voir chapitres/) construit son propre monde.

import type { Jeu } from './shell';
import type { Traduire } from '../textes';

export type Fichier = {
  type: 'fichier';
  contenu: string | ((jeu: Jeu) => string);
  // Effet de la lecture (cat), ex. tirer un levier. Renvoie un message en plus.
  lu?: (jeu: Jeu) => string | void;
  // Si présent, l'objet refuse d'être déplacé ou effacé, avec ce message.
  protege?: { mv?: string; rm?: string };
  // Fichier « ligne par ligne » (journal, liste, configuration) : chaque
  // ligne compte (pour grep notamment), on ne recolle pas les paragraphes.
  lignes?: boolean;
  // Texte écrit (histoire, dialogue) : reçoit la typographie de la langue à
  // l'affichage (voir typographie() dans src/textes/).
  prose?: boolean;
  // Taille simulée en octets (images, vidéos…), sinon celle du texte.
  taille?: number;
  // Contenu d'une archive tar : chemins relatifs → copies des fichiers.
  archive?: { fichiers: Record<string, Fichier>; compresse: boolean };
} & Droits;
// Propriétaire et permissions Unix (rwx pour le propriétaire, le groupe,
// les autres). Par défaut : « vous », rw-r--r-- (fichier), rwxr-xr-x (lieu).
export type Droits = { proprio?: string; mode?: string };
export type Dossier = {
  type: 'dossier';
  enfants: Record<string, Noeud>;
  // Raison du blocage si on ne peut pas encore y entrer, sinon null.
  bloque?: (jeu: Jeu) => string | null;
} & Droits;
export type Noeud = Fichier | Dossier;

// Un événement de l'histoire : quand `condition` devient vraie (vérifiée
// après chaque commande), `action` modifie le monde et `message` s'affiche.
// Chaque événement ne se produit qu'une fois.
export interface Evenement {
  id: string;
  condition: (jeu: Jeu) => boolean;
  action?: (jeu: Jeu) => void;
  message: string | ((jeu: Jeu) => string);
}

// Les textes d'un chapitre sont dans src/textes/<langue>/<histoire>.ftl :
// son titre (chapitre-<id>, avec l'attribut .resume) et tout ce qu'il
// affiche, sous des identifiants qui commencent par le sien.
export interface Chapitre {
  id: string;
  numero: number;
  // Commandes connues dans ce chapitre (les autres sont « pas encore apprises »).
  commandes: string[];
  // Le dossier « maison » (~), où l'on commence.
  maison: string;
  // Fichier de la maison affiché au début du chapitre.
  accueil: string;
  creerMonde: (t: Traduire) => Dossier;
  evenements: Evenement[];
  // Le chapitre est réussi quand cet événement s'est produit.
  final: string;
  // Appelé après chaque commande (ex. l'Effaceur qui avance) ; renvoie un message.
  apresCommande?: (jeu: Jeu) => string | void;
  // Mot de passe de « vous » pour sudo (absent : sudo pas encore appris).
  motDePasse?: string;
  // État propre à l'histoire (processus, réseau, dépôts git…), recréé à
  // chaque partie. Les commandes spécialisées le lisent et le modifient.
  etat?: () => Record<string, unknown>;
}

// Une histoire : une suite de chapitres. Les histoires sont indépendantes.
// Titre et résumé : histoire-<id> dans src/textes/<langue>/histoires.ftl.
export interface Histoire {
  id: string;
  chapitres: Chapitre[];
}

// Les textes sont écrits avec des retours à la ligne pour être lisibles dans
// le code ; on recolle les lignes d'un même paragraphe pour que le terminal
// les fasse passer à la ligne selon la largeur de l'écran. On garde tels
// quels les lignes indentées et les tableaux (alignés par des doubles espaces).
const brut = (l: string) => l === '' || l.startsWith(' ') || l.startsWith('- ') || l.includes('  ');
export const nettoyer = (t: string) =>
  t
    .replace(/^\n+|\s+$/g, '')
    .split('\n')
    .reduce<string[]>((lignes, l) => {
      const prec = lignes.at(-1);
      if (prec !== undefined && !brut(prec) && !brut(l)) lignes[lignes.length - 1] = `${prec} ${l}`;
      else lignes.push(l);
      return lignes;
    }, [])
    .join('\n');

export const f = (contenu: Fichier['contenu'], options: Omit<Fichier, 'type' | 'contenu'> = {}): Fichier => ({
  type: 'fichier',
  contenu: typeof contenu !== 'string' ? contenu : options.lignes ? contenu.replace(/^\n+|\s+$/g, '') : nettoyer(contenu),
  prose: typeof contenu === 'string' && !options.lignes,
  ...options,
});

export const d = (enfants: Record<string, Noeud>, bloque?: Dossier['bloque'], droits: Droits = {}): Dossier => ({
  type: 'dossier',
  enfants,
  bloque,
  ...droits,
});
