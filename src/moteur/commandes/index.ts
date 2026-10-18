// Toutes les commandes du jeu. Chaque chapitre choisit celles qu'il connaît
// (Chapitre.commandes). Une commande lit ses arguments et l'entrée du tube,
// renvoie sa sortie, et signale ses erreurs avec jeu.erreur().

import type { Shell } from '../shell';
import { FICHIERS } from './fichiers';
import { TEXTE } from './texte';
import { SYSTEME } from './systeme';
import { RESEAU } from './reseau';
import { GIT } from './git';
import { PAGES } from './pages';

export interface Contexte {
  args: string[];
  // Ce qui arrive par un tube (null : rien, la commande est en tête).
  entree: string | null;
  jeu: Shell;
  // Vrai si la sortie va à l'écran (dernière commande, sans redirection).
  dernier: boolean;
}

export interface Commande {
  // « synopsis — description » : sert à fabriquer la page man (voir manuel.ts).
  manuel: string;
  // Options courtes acceptées (lettre → explication). Si présent, une option
  // inconnue donne le vrai message d'erreur, qui renvoie vers --help.
  options?: Record<string, string>;
  exemples?: [string, string][];
  voir?: string[];
  lancer: (c: Contexte) => string;
}

export const COMMANDES: Record<string, Commande> = {
  ...FICHIERS,
  ...TEXTE,
  ...SYSTEME,
  ...RESEAU,
  ...GIT,
  sudo: {
    manuel:
      'sudo commande — exécute une commande en tant que root, l’administrateur qui a tous les droits (superuser do). Demande TON mot de passe, pas celui de root.',
    lancer: () => '',
  },
  clear: { manuel: 'clear — efface l’écran.', lancer: () => '' },
  man: {
    manuel:
      'man [-k mot] commande — affiche le manuel d’une commande (manual). C’est le premier réflexe quand on ne sait plus comment marche une commande : sa syntaxe, ses options, des exemples. Sur un vrai Linux, la page s’ouvre en plein écran : on la parcourt avec les flèches, on cherche avec /mot et on la quitte avec q.',
    options: { k: 'cherche un mot dans le résumé de toutes les commandes (comme apropos), pour trouver la commande qui fait ce qu’on veut.' },
    exemples: [
      ['man ls', 'le manuel de ls'],
      ['man -k copie', 'quelles commandes parlent de copier ?'],
      ['ls --help', 'un résumé rapide, sans ouvrir le manuel'],
    ],
    voir: ['apropos', 'whatis'],
    lancer: () => '',
  },
  apropos: {
    manuel: 'apropos mot — cherche un mot dans le résumé de toutes les commandes. Comme man -k.',
    voir: ['man', 'whatis'],
    lancer: () => '',
  },
  whatis: {
    manuel: 'whatis commande — affiche en une ligne à quoi sert une commande.',
    voir: ['man', 'apropos'],
    lancer: () => '',
  },
  aide: { manuel: 'aide — liste les commandes que tu connais.', lancer: () => '' },
};

// Options, exemples et renvois du manuel (pages.ts).
for (const [nom, complement] of Object.entries(PAGES)) if (COMMANDES[nom]) Object.assign(COMMANDES[nom], complement);
