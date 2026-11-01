// Briques du monde du jeu : un vrai système de fichiers miniature.
// Un dossier = un lieu, un fichier = un objet ou un personnage.
// Chaque chapitre (voir chapters/) construit son propre monde.

import type { Game } from './shell';
import type { Activity } from './activity';
import type { Translate } from '../texts';
import type { ElementPlan } from './plan';

export type File = {
  type: 'fichier';
  content: string | ((game: Game) => string);
  // Effet de la lecture (cat), ex. tirer un levier. Renvoie un message en plus.
  read?: (game: Game) => string | void;
  // Si présent, l'objet refuse d'être déplacé ou effacé, avec ce message.
  isProtected?: { mv?: string; rm?: string };
  // Fichier « ligne par ligne » (journal, liste, configuration) : chaque
  // ligne compte (pour grep notamment), on ne recolle pas les paragraphes.
  lines?: boolean;
  // Texte écrit (histoire, dialogue) : reçoit la typographie de la langue à
  // l'affichage (voir typographie() dans src/texts/).
  prose?: boolean;
  // Taille simulée en octets (images, vidéos…), sinon celle du texte.
  size?: number;
  // Contenu d'une archive tar : chemins relatifs → copies des fichiers.
  // `tronquee` : l'archive a été coupée en cours d'écriture ; seuls ses
  // `tronquee` premiers fichiers sont lisibles.
  archive?: { files: Record<string, File>; compressed: boolean; truncated?: number };
  // Lien symbolique (ln -s) : le chemin visé, tel qu'il a été écrit (relatif
  // au lieu du lien, ou absolu). On le suit pour lire, écrire, entrer.
  link?: string;
  // Date de dernière modification (ms, heure locale lue comme UTC, comme
  // l'horloge de systemd) ; sans elle, le fichier est considéré comme récent.
  mtime?: number;
} & Rights;
// Propriétaire, groupe et permissions Unix (rwx pour le propriétaire, le
// groupe, les autres). Par défaut : « vous », le groupe qui porte le nom du
// propriétaire, rw-r--r-- (fichier), rwxr-xr-x (lieu).
export type Rights = { owner?: string; group?: string; mode?: string };

// Les comptes d'une machine, comme /etc/passwd et /etc/group : chaque
// utilisateur·rice a un groupe principal et peut être membre d'autres
// groupes (groupes secondaires).
export interface Accounts {
  // expire : fin de validité du compte (AAAA-MM-JJ, usermod -e, chage -E).
  users: Record<string, { uid: number; group: string; home?: string; shell?: string; expires?: string }>;
  groups: Record<string, { gid: number; members: string[] }>;
}

// Les comptes de toutes les machines qui n'en déclarent pas : root, et
// « vous », membre du groupe sudo (comme le premier compte d'une Debian).
export const accountsByDefault = (): Accounts => ({
  users: { root: { uid: 0, group: 'root', home: '/root' }, you: { uid: 1000, group: 'you' } },
  groups: { root: { gid: 0, members: [] }, sudo: { gid: 27, members: ['you'] }, you: { gid: 1000, members: [] } },
});
export type Directory = {
  type: 'dossier';
  children: Record<string, Node>;
  // Raison du blocage si on ne peut pas encore y entrer, sinon null.
  blocked?: (game: Game) => string | null;
} & Rights;
export type Node = File | Directory;

// Une machine du réseau interne d'une histoire : son monde, ses comptes,
// son état ; ses événements sont ceux du chapitre (vérifiés sur la
// machine principale).
export interface InternalHost {
  address: string;
  domain: string;
  createWorld: (t: Translate) => Directory;
  accounts?: () => Accounts;
  state?: (t: Translate) => Record<string, unknown>;
  initialise?: (game: Game) => void;
  // Commandes connues (par défaut, celles du chapitre).
  commands?: string[];
}

// Un événement de l'histoire : quand `condition` devient vraie (vérifiée
// après chaque commande), `action` modifie le monde et `message` s'affiche.
// Chaque événement ne se produit qu'une fois.
export interface Event {
  id: string;
  condition: (game: Game) => boolean;
  action?: (game: Game) => void;
  message: string | ((game: Game) => string);
}

// Les textes d'un chapitre sont dans src/texts/<langue>/<histoire>.ftl :
// son titre (chapitre-<id>, avec l'attribut .resume) et tout ce qu'il
// affiche, sous des identifiants qui commencent par le sien.
export interface Chapter {
  id: string;
  number: number;
  // Commandes connues dans ce chapitre (les autres sont « pas encore apprises »).
  commands: string[];
  // Le dossier « maison » (~), où l'on commence.
  home: string;
  // Le plan du réseau de l'histoire à ce chapitre (le réseau prévu, voir plan.ts).
  plan?: (t: Translate) => ElementPlan;
  // Les noms des lieux et des objets se traduisent (voir nom() et chemin()) :
  // le monde est créé avec les noms français, puis chacun est remplacé par
  // celui de la langue. Les chemins des événements passent alors par chemin().
  names?: boolean;
  // Fichier de la maison affiché au début du chapitre.
  welcome: string;
  createWorld: (t: Translate) => Directory;
  events: Event[];
  // Le chapitre est réussi quand cet événement s'est produit.
  final: string;
  // L'ordre des étapes dans le jeu, pour les indices (voir indices.ts), quand
  // il diffère de celui des événements.
  steps?: string[];
  // Appelé après chaque commande (ex. l'Effaceur qui avance) ; renvoie un message.
  afterCommand?: (game: Game) => string | void;
  // Appelé juste avant de lancer chaque commande (ex. le temps qui passe : la
  // commande voit déjà le monde tel qu'il est devenu depuis la précédente).
  beforeCommand?: (game: Game) => void;
  // La vie de la machine pendant qu'on joue (visiteurs, robots, attaques) : voir activite.ts.
  activity?: Activity;
  // Mot de passe de « vous » pour sudo (absent : sudo pas encore appris).
  password?: string;
  // Comptes et groupes de la machine (par défaut : comptesParDefaut).
  accounts?: () => Accounts;
  // Appelé une fois le monde et l'état créés (ex. charger la configuration
  // d'un service à partir des fichiers du monde).
  initialise?: (game: Game) => void;
  // État propre à l'histoire (processus, réseau, dépôts git…), recréé à
  // chaque partie. Les commandes spécialisées le lisent et le modifient.
  state?: (t: Translate) => Record<string, unknown>;
  // La machine a été réinstallée pour ce chapitre : nouvelle clé d'hôte SSH
  // (voir machines.ts), que le known_hosts du poste ne connaît pas encore.
  hostKey?: string;
  // Les machines du réseau interne de l'histoire (derrière la machine
  // principale), qu'on joint en ssh depuis elle (ou avec ssh -J).
  hosts?: Record<string, InternalHost>;
  // Les clés publiques du poste sont recopiées sur les machines de l'histoire
  // à chaque connexion (une coordinatrice qui tient les clés à jour).
  playerKeys?: boolean;
  // Les événements se vérifient aussi après les commandes tapées sur le
  // poste (le chapitre regarde ce qu'on y fait : ~/.ssh/config, tunnels…).
  watchesWorkstation?: boolean;
}

// Une histoire : une suite de chapitres. Les histoires sont indépendantes.
// Titre et résumé : histoire-<id> dans src/texts/<langue>/histoires.ftl.
export interface Story {
  id: string;
  chapters: Chapter[];
  // Les chapitres (d'autres histoires) à finir avant d'en recevoir la clé :
  // les histoires s'ouvrent peu à peu (voir deverrouillage.ts). Sans : la
  // première histoire, ouverte d'emblée.
  after?: string[];
}

// Les textes sont écrits avec des retours à la ligne pour être lisibles dans
// le code ; on recolle les lignes d'un même paragraphe pour que le terminal
// les fasse passer à la ligne selon la largeur de l'écran. On garde tels
// quels les lignes indentées et les tableaux (alignés par des doubles espaces).
// Un titre en capitales (« CE QUI S'EST PASSÉ ») reste aussi sur sa ligne.
const title = (l: string) => /\p{Lu}/u.test(l) && l === l.toUpperCase();
// Une liste numérotée (« 1. », « 2) ») garde un élément par ligne.
const number = (l: string) => /^\d+[.)] /.test(l);
const raw = (l: string) => l === '' || l.startsWith(' ') || l.startsWith('- ') || l.includes('  ') || title(l) || number(l);
export const clean = (t: string) =>
  t
    .replace(/^\n+|\s+$/g, '')
    .split('\n')
    .reduce<string[]>((lines, l) => {
      const prec = lines.at(-1);
      if (prec !== undefined && !raw(prec) && !raw(l)) lines[lines.length - 1] = `${prec} ${l}`;
      else lines.push(l);
      return lines;
    }, [])
    .join('\n');

export const f = (content: File['content'], options: Omit<File, 'type' | 'content'> = {}): File => ({
  type: 'fichier',
  content: typeof content !== 'string' ? content : options.lines ? content.replace(/^\n+|\s+$/g, '') : clean(content),
  prose: typeof content === 'string' && !options.lines,
  ...options,
});

// Les noms des lieux et des objets d'une histoire (les dossiers et les
// fichiers qu'on tape) : le nom français sert d'identifiant, chaque langue
// donne le sien dans src/texts/<langue>/noms.ftl, sous nom-<nom> (le point
// initial devient « point- », les autres points des tirets). Un nom absent
// reste tel quel (home, etc, les noms des vrais outils).
const nameKey = (french: string) => `nom-${french.replace(/^\./, 'point-').replace(/\./g, '-')}`;
/** Un mot de passe donné par une histoire, dans la langue (mots-de-passe.ftl : farine-2028 → flour-2028). */
export const password = (t: Translate, french: string) => (t.exists(`mdp-${french}`) ? t(`mdp-${french}`) : french);
export const name = (t: Translate, french: string) => (t.exists(nameKey(french)) ? t(nameKey(french)) : french);
/** Un chemin du monde, traduit nom par nom : /Cabane/Jetee/filet → /Hut/Pier/net. */
export const path = (t: Translate, english: string) =>
  english
    .split('/')
    .map((m, i, all) => (m && !systemDirectory(all.slice(0, i + 1).join('/')) ? name(t, m) : m))
    .join('/');

// Real system directories whose name is also a translated name of the world
// (/usr/share, /var/backups, /proc/sys/net, /etc/letsencrypt/live), and Le
// Labo's /srv/scans, a mount point fstab names: they keep their name.
const SYSTEM_DIRECTORIES = ['/usr/share', '/var/backups', '/proc/sys/net', '/etc/letsencrypt/live', '/srv/scans'];
export const systemDirectory = (p: string) => SYSTEM_DIRECTORIES.includes(p) || p.endsWith('/.local/share');

// Les comptes qui se traduisent : celui du joueur ou de la joueuse
// (« vous », you en anglais) et l'utilisateur système de l'Effaceur. Les
// autres comptes (root, www-data, les personnages : malo, yasmine…) gardent
// leur nom. Comme les lieux, les chapitres sont écrits avec le nom
// français ; le monde (propriétaires, /home/vous) et les comptes sont
// renommés à la création, et le code désigne le compte du joueur par
// `jeu.joueur` (ou `joueur(t)` avant que le jeu existe).
const TRANSLATED_ACCOUNTS = ['you', 'eraser'];
export const account = (t: Translate, french: string) => (TRANSLATED_ACCOUNTS.includes(french) ? name(t, french) : french);
/** Le compte du joueur ou de la joueuse dans la langue : vous, you… */
export const player = (t: Translate) => account(t, 'you');

/** Le monde dans la langue : chaque dossier et chaque fichier prend son nom traduit, ses propriétaires aussi. */
export function translateNames(t: Translate, directory: Directory, at = ''): Directory {
  const rights = (n: Node) => {
    if (n.owner) n.owner = account(t, n.owner);
    if (n.group) n.group = account(t, n.group);
    return n;
  };
  rights(directory);
  directory.children = Object.fromEntries(
    Object.entries(directory.children).map(([n, e]) => [systemDirectory(`${at}/${n}`) ? n : name(t, n), e.type === 'dossier' ? translateNames(t, e, `${at}/${n}`) : rights(e)]),
  );
  return directory;
}

/** Les comptes dans la langue : noms des utilisateurs et des groupes, membres, maisons. */
export const translateAccounts = (t: Translate, c: Accounts): Accounts => ({
  users: Object.fromEntries(
    Object.entries(c.users).map(([n, u]) => [account(t, n), { ...u, group: account(t, u.group), ...(u.home ? { home: path(t, u.home) } : {}) }]),
  ),
  groups: Object.fromEntries(Object.entries(c.groups).map(([n, g]) => [account(t, n), { ...g, members: g.members.map((m) => account(t, m)) }])),
});

export const d = (children: Record<string, Node>, blocked?: Directory['blocked'], rights: Rights = {}): Directory => ({
  type: 'dossier',
  children,
  blocked,
  ...rights,
});

// /etc/passwd et /etc/group, tenus à jour à partir des comptes de la
// machine (usermod les modifie) : à poser dans le /etc d'un monde.
export const accountsFiles = (): Record<string, File> => ({
  passwd: f(
    (game) =>
      Object.entries(game.accounts.users)
        .map(([name, u]) =>
          [name, 'x', u.uid, game.accounts.groups[u.group]?.gid ?? u.uid, '', u.home ?? `/home/${name}`, u.shell ?? '/bin/bash'].join(':'),
        )
        .join('\n'),
    { lines: true, owner: 'root' },
  ),
  group: f(
    (game) =>
      Object.entries(game.accounts.groups)
        .map(([name, g]) => `${name}:x:${g.gid}:${g.members.join(',')}`)
        .join('\n'),
    { lines: true, owner: 'root' },
  ),
});
