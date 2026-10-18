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
  // `tronquee` : l'archive a été coupée en cours d'écriture ; seuls ses
  // `tronquee` premiers fichiers sont lisibles.
  archive?: { fichiers: Record<string, Fichier>; compresse: boolean; tronquee?: number };
  // Lien symbolique (ln -s) : le chemin visé, tel qu'il a été écrit (relatif
  // au lieu du lien, ou absolu). On le suit pour lire, écrire, entrer.
  lien?: string;
  // Date de dernière modification (ms, heure locale lue comme UTC, comme
  // l'horloge de systemd) ; sans elle, le fichier est considéré comme récent.
  mtime?: number;
} & Droits;
// Propriétaire, groupe et permissions Unix (rwx pour le propriétaire, le
// groupe, les autres). Par défaut : « vous », le groupe qui porte le nom du
// propriétaire, rw-r--r-- (fichier), rwxr-xr-x (lieu).
export type Droits = { proprio?: string; groupe?: string; mode?: string };

// Les comptes d'une machine, comme /etc/passwd et /etc/group : chaque
// utilisateur·rice a un groupe principal et peut être membre d'autres
// groupes (groupes secondaires).
export interface Comptes {
  utilisateurs: Record<string, { uid: number; groupe: string; maison?: string; shell?: string }>;
  groupes: Record<string, { gid: number; membres: string[] }>;
}

// Les comptes de toutes les machines qui n'en déclarent pas : root, et
// « vous », membre du groupe sudo (comme le premier compte d'une Debian).
export const comptesParDefaut = (): Comptes => ({
  utilisateurs: { root: { uid: 0, groupe: 'root', maison: '/root' }, vous: { uid: 1000, groupe: 'vous' } },
  groupes: { root: { gid: 0, membres: [] }, sudo: { gid: 27, membres: ['vous'] }, vous: { gid: 1000, membres: [] } },
});
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
  // Comptes et groupes de la machine (par défaut : comptesParDefaut).
  comptes?: () => Comptes;
  // Appelé une fois le monde et l'état créés (ex. charger la configuration
  // d'un service à partir des fichiers du monde).
  initialiser?: (jeu: Jeu) => void;
  // État propre à l'histoire (processus, réseau, dépôts git…), recréé à
  // chaque partie. Les commandes spécialisées le lisent et le modifient.
  etat?: (t: Traduire) => Record<string, unknown>;
  // La machine a été réinstallée pour ce chapitre : nouvelle clé d'hôte SSH
  // (voir machines.ts), que le known_hosts du poste ne connaît pas encore.
  cleHote?: string;
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
// Un titre en capitales (« CE QUI S'EST PASSÉ ») reste aussi sur sa ligne.
const titre = (l: string) => /\p{Lu}/u.test(l) && l === l.toUpperCase();
// Une liste numérotée (« 1. », « 2) ») garde un élément par ligne.
const numero = (l: string) => /^\d+[.)] /.test(l);
const brut = (l: string) => l === '' || l.startsWith(' ') || l.startsWith('- ') || l.includes('  ') || titre(l) || numero(l);
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

// /etc/passwd et /etc/group, tenus à jour à partir des comptes de la
// machine (usermod les modifie) : à poser dans le /etc d'un monde.
export const fichiersComptes = (): Record<string, Fichier> => ({
  passwd: f(
    (jeu) =>
      Object.entries(jeu.comptes.utilisateurs)
        .map(([nom, u]) =>
          [nom, 'x', u.uid, jeu.comptes.groupes[u.groupe]?.gid ?? u.uid, '', u.maison ?? `/home/${nom}`, u.shell ?? '/bin/bash'].join(':'),
        )
        .join('\n'),
    { lignes: true, proprio: 'root' },
  ),
  group: f(
    (jeu) =>
      Object.entries(jeu.comptes.groupes)
        .map(([nom, g]) => `${nom}:x:${g.gid}:${g.membres.join(',')}`)
        .join('\n'),
    { lignes: true, proprio: 'root' },
  ),
});
