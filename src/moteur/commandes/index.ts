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
import { SSH } from './ssh';
import { COMPTES } from './comptes';
import { SUDOERS_COMMANDES, sudoListe } from './sudoers';
import { TMUX } from './tmux';
import { SYSTEMD } from './systemd';
import { EDITEUR } from './editeur';
import { SSHD } from './sshd';
import { UFW } from './ufw';
import { SS } from './ss';
import { FAIL2BAN } from './fail2ban';
import { SAUVEGARDE } from './sauvegarde';
import { APT } from './apt';
import { CERTBOT } from './certbot';
import { RESTIC } from './restic';
import { BIND } from './bind';
import { AWK } from './awk';
import { DOCKER } from './docker';
import { NC } from './nc';
import { DIFF } from './diff';
import { SCRIPTS } from './scripts';
import { DISQUES } from './disques';
import { RSNAPSHOT } from './rsnapshot';
import { POSTGRES } from './postgres';
import { JOURNAUX } from './journaux';
import { MEMOIRE } from './memoire';
import { HEURE } from './heure';
import { SUPERVISION } from './supervision';
import { TRANSFERTS } from './transferts';

export interface Contexte {
  args: string[];
  // Ce qui arrive par un tube (null : rien, la commande est en tête).
  entree: string | null;
  jeu: Shell;
  // Vrai si la sortie va à l'écran (dernière commande, sans redirection).
  dernier: boolean;
}

export interface Commande {
  // Le texte de la page man est dans src/textes/<langue>/manuel.ftl
  // (man-<commande>) ; ici, la partie technique (voir pages.ts).
  // Options courtes acceptées. Si présent, une option inconnue donne le
  // vrai message d'erreur, qui renvoie vers --help.
  options?: string[];
  // Commandes d'exemple (leur explication : .exemple-N dans manuel.ftl).
  exemples?: string[];
  voir?: string[];
  // La commande analyse elle-même ses options (pas de contrôle générique).
  propresOptions?: boolean;
  // Section du manuel : 1 (commandes), 8 (administration, ex. usermod).
  section?: number;
  // Une commande hors du PATH (un plugin de supervision) : on ne la lance que
  // par son chemin complet, dans ce dossier.
  dossier?: string;
  lancer: (c: Contexte) => string;
}

export const COMMANDES: Record<string, Commande> = {
  ...FICHIERS,
  ...TEXTE,
  ...SYSTEME,
  ...RESEAU,
  ...GIT,
  ...SSH,
  ...COMPTES,
  ...SUDOERS_COMMANDES,
  ...TMUX,
  ...SYSTEMD,
  ...EDITEUR,
  ...SSHD,
  ...UFW,
  ...SS,
  ...FAIL2BAN,
  ...SAUVEGARDE,
  ...APT,
  ...CERTBOT,
  ...RESTIC,
  ...BIND,
  ...AWK,
  ...DOCKER,
  ...NC,
  ...DIFF,
  ...SCRIPTS,
  ...DISQUES,
  ...RSNAPSHOT,
  ...POSTGRES,
  ...JOURNAUX,
  ...MEMOIRE,
  ...HEURE,
  ...SUPERVISION,
  ...TRANSFERTS,
  // Traités par le shell lui-même (voir shell.ts) : une entrée ici pour le
  // manuel et la complétion.
  sudo: { lancer: ({ args, jeu }) => (/^-l+$/.test(args[0] ?? '') ? sudoListe(jeu, args) : '') },
  clear: { lancer: () => '' },
  man: { lancer: () => '' },
  apropos: { lancer: () => '' },
  whatis: { lancer: () => '' },
  aide: { lancer: () => '' },
};

// Options, exemples et renvois du manuel (pages.ts).
for (const [nom, complement] of Object.entries(PAGES)) if (COMMANDES[nom]) Object.assign(COMMANDES[nom], complement);
