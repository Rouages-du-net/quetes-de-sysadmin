// Briques du monde du jeu : un vrai système de fichiers miniature.
// Un dossier = un lieu, un fichier = un objet ou un personnage.
// Chaque chapitre (voir chapitres/) construit son propre monde.

import type { Jeu } from './shell';
import type { Activite } from './activite';
import type { Traduire } from '../textes';
import type { ElementPlan } from './plan';

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
  // expire : fin de validité du compte (AAAA-MM-JJ, usermod -e, chage -E).
  utilisateurs: Record<string, { uid: number; groupe: string; maison?: string; shell?: string; expire?: string }>;
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

// Une machine du réseau interne d'une histoire : son monde, ses comptes,
// son état ; ses événements sont ceux du chapitre (vérifiés sur la
// machine principale).
export interface HoteInterne {
  adresse: string;
  domaine: string;
  creerMonde: (t: Traduire) => Dossier;
  comptes?: () => Comptes;
  etat?: (t: Traduire) => Record<string, unknown>;
  initialiser?: (jeu: Jeu) => void;
  // Commandes connues (par défaut, celles du chapitre).
  commandes?: string[];
}

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
  // Le plan du réseau de l'histoire à ce chapitre (le réseau prévu, voir plan.ts).
  plan?: (t: Traduire) => ElementPlan;
  // Les noms des lieux et des objets se traduisent (voir nom() et chemin()) :
  // le monde est créé avec les noms français, puis chacun est remplacé par
  // celui de la langue. Les chemins des événements passent alors par chemin().
  noms?: boolean;
  // Fichier de la maison affiché au début du chapitre.
  accueil: string;
  creerMonde: (t: Traduire) => Dossier;
  evenements: Evenement[];
  // Le chapitre est réussi quand cet événement s'est produit.
  final: string;
  // L'ordre des étapes dans le jeu, pour les indices (voir indices.ts), quand
  // il diffère de celui des événements.
  etapes?: string[];
  // Appelé après chaque commande (ex. l'Effaceur qui avance) ; renvoie un message.
  apresCommande?: (jeu: Jeu) => string | void;
  // Appelé juste avant de lancer chaque commande (ex. le temps qui passe : la
  // commande voit déjà le monde tel qu'il est devenu depuis la précédente).
  avantCommande?: (jeu: Jeu) => void;
  // La vie de la machine pendant qu'on joue (visiteurs, robots, attaques) : voir activite.ts.
  activite?: Activite;
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
  // Les machines du réseau interne de l'histoire (derrière la machine
  // principale), qu'on joint en ssh depuis elle (ou avec ssh -J).
  hotes?: Record<string, HoteInterne>;
  // Les clés publiques du poste sont recopiées sur les machines de l'histoire
  // à chaque connexion (une coordinatrice qui tient les clés à jour).
  clesDuJoueur?: boolean;
  // Les événements se vérifient aussi après les commandes tapées sur le
  // poste (le chapitre regarde ce qu'on y fait : ~/.ssh/config, tunnels…).
  surveillePoste?: boolean;
}

// Une histoire : une suite de chapitres. Les histoires sont indépendantes.
// Titre et résumé : histoire-<id> dans src/textes/<langue>/histoires.ftl.
export interface Histoire {
  id: string;
  chapitres: Chapitre[];
  // Les chapitres (d'autres histoires) à finir avant d'en recevoir la clé :
  // les histoires s'ouvrent peu à peu (voir deverrouillage.ts). Sans : la
  // première histoire, ouverte d'emblée.
  apres?: string[];
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

// Les noms des lieux et des objets d'une histoire (les dossiers et les
// fichiers qu'on tape) : le nom français sert d'identifiant, chaque langue
// donne le sien dans src/textes/<langue>/noms.ftl, sous nom-<nom> (le point
// initial devient « point- », les autres points des tirets). Un nom absent
// reste tel quel (home, etc, les noms des vrais outils).
const cleDuNom = (francais: string) => `nom-${francais.replace(/^\./, 'point-').replace(/\./g, '-')}`;
/** Un mot de passe donné par une histoire, dans la langue (mots-de-passe.ftl : farine-2028 → flour-2028). */
export const motDePasse = (t: Traduire, francais: string) => (t.existe(`mdp-${francais}`) ? t(`mdp-${francais}`) : francais);
export const nom = (t: Traduire, francais: string) => (t.existe(cleDuNom(francais)) ? t(cleDuNom(francais)) : francais);
/** Un chemin du monde, traduit nom par nom : /Cabane/Jetee/filet → /Hut/Pier/net. */
export const chemin = (t: Traduire, francais: string) =>
  francais
    .split('/')
    .map((m) => (m ? nom(t, m) : m))
    .join('/');

// Les comptes qui se traduisent : celui du joueur ou de la joueuse
// (« vous », you en anglais) et l'utilisateur système de l'Effaceur. Les
// autres comptes (root, www-data, les personnages : malo, yasmine…) gardent
// leur nom. Comme les lieux, les chapitres sont écrits avec le nom
// français ; le monde (propriétaires, /home/vous) et les comptes sont
// renommés à la création, et le code désigne le compte du joueur par
// `jeu.joueur` (ou `joueur(t)` avant que le jeu existe).
const COMPTES_TRADUITS = ['vous', 'effaceur'];
export const compte = (t: Traduire, francais: string) => (COMPTES_TRADUITS.includes(francais) ? nom(t, francais) : francais);
/** Le compte du joueur ou de la joueuse dans la langue : vous, you… */
export const joueur = (t: Traduire) => compte(t, 'vous');

/** Le monde dans la langue : chaque dossier et chaque fichier prend son nom traduit, ses propriétaires aussi. */
export function traduireNoms(t: Traduire, dossier: Dossier): Dossier {
  const droits = (n: Noeud) => {
    if (n.proprio) n.proprio = compte(t, n.proprio);
    if (n.groupe) n.groupe = compte(t, n.groupe);
    return n;
  };
  droits(dossier);
  dossier.enfants = Object.fromEntries(
    Object.entries(dossier.enfants).map(([n, e]) => [nom(t, n), e.type === 'dossier' ? traduireNoms(t, e) : droits(e)]),
  );
  return dossier;
}

/** Les comptes dans la langue : noms des utilisateurs et des groupes, membres, maisons. */
export const traduireComptes = (t: Traduire, c: Comptes): Comptes => ({
  utilisateurs: Object.fromEntries(
    Object.entries(c.utilisateurs).map(([n, u]) => [compte(t, n), { ...u, groupe: compte(t, u.groupe), ...(u.maison ? { maison: chemin(t, u.maison) } : {}) }]),
  ),
  groupes: Object.fromEntries(Object.entries(c.groupes).map(([n, g]) => [compte(t, n), { ...g, membres: g.membres.map((m) => compte(t, m)) }])),
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
