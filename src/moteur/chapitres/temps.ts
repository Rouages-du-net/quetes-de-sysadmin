// Histoire « La Machine à remonter le temps » : git, pour garder l'historique
// d'un texte et revenir en arrière. Inès, romancière, a abîmé son manuscrit ;
// heureusement, il est suivi par git. Ses poèmes, eux, ne le sont pas.

import { chemin, d, f, nom, type Chapitre } from '../monde';
import type { Traduire } from '../../textes';
import { nouveauCommit, type Commit, type Depot } from '../commandes/git';

const M = '/home/vous';
const ROMAN = `${M}/roman`;
const POEMES = `${M}/poemes`;

// Les versions du roman, les commits et les poèmes sont des textes de
// l'histoire, dans la langue du jeu (chapitre-manuscrit.ftl).
const POEMES_INES = ['mer.txt', 'phare.txt', 'zohra.txt'];

function versions(t: Traduire) {
  const [ch1, ch2, ch3, degats] = ['1', '2', '3', '3-abime'].map((n) => t(`manuscrit-roman-chapitre-${n}`));
  return {
    v1: ch1,
    v2: `${ch1}\n\n${ch2}`,
    v3: `${ch1}\n\n${ch2}\n\n${ch3}`,
    v4: `${ch1}\n\n${ch2}\n\n${degats}`,
  };
}

function historique(t: Traduire): Depot {
  const v = versions(t);
  const commits: Commit[] = [];
  const ajouter = (message: string, date: string, texte: string) =>
    commits.push(nouveauCommit(commits.at(-1) ?? null, message, t('manuscrit-autrice'), date, { 'roman.txt': texte }));
  ajouter(t('manuscrit-commit-1'), 'Mon Oct 5 22:14:09 2026 +0200', v.v1);
  ajouter(t('manuscrit-commit-2'), 'Thu Oct 8 21:40:33 2026 +0200', v.v2);
  ajouter(t('manuscrit-commit-3'), 'Sun Oct 11 23:02:51 2026 +0200', v.v3);
  ajouter(t('manuscrit-commit-4'), 'Mon Oct 12 07:55:12 2026 +0200', v.v4);
  return { commits, index: { 'roman.txt': v.v4 } };
}

export const temps: Chapitre = {
  id: 'manuscrit',
  numero: 1,
  commandes: ['ls', 'cd', 'pwd', 'cat', 'less', 'head', 'git'],
  maison: M,
  accueil: 'message_d_ines.txt',
  noms: true,
  final: 'fin',
  etat: (t) => ({
    git: { [chemin(t, ROMAN)]: historique(t) },
    auteur: t('manuscrit-autrice'),
    date: 'Tue Oct 13 10:30:00 2026 +0200',
  }),
  creerMonde: (t) => {
    return d({
      home: d({
        vous: d({
          'message_d_ines.txt': f(t('manuscrit-message-d-ines')),
          roman: d({
            '.git': d({ HEAD: f('ref: refs/heads/main', { lignes: true }) }),
            'roman.txt': f(versions(t).v4, { lignes: true }),
          }),
          poemes: d(Object.fromEntries(POEMES_INES.map((poeme) => [poeme, f(t(`manuscrit-poeme-${poeme.replace('.txt', '')}`), { lignes: true })]))),
          'aide_git.txt': f(t('manuscrit-aide-git')),
        }),
      }),
    });
  },
  evenements: [
    {
      id: 'historique',
      condition: (j) => j.derniere.commandes[0]?.[0] === 'git' && j.derniere.commandes[0]?.[1] === 'log',
      message: (j) => j.t('manuscrit-evenement-historique'),
    },
    {
      id: 'restaure',
      condition: (j) => j.lire(chemin(j.t, `${ROMAN}/roman.txt`)) === versions(j.t).v3,
      message: (j) => j.t('manuscrit-evenement-restaure'),
    },
    {
      id: 'sauve',
      condition: (j) => {
        const depot: Depot = j.etat.git[chemin(j.t, ROMAN)];
        return depot.commits.length > 4 && depot.commits.at(-1)!.fichiers['roman.txt'] === versions(j.t).v3;
      },
      message: (j) => j.t('manuscrit-evenement-sauve'),
    },
    {
      id: 'poemes',
      condition: (j) => {
        const depot: Depot | undefined = j.etat.git?.[chemin(j.t, POEMES)];
        const c = depot?.commits.at(-1);
        return !!c && POEMES_INES.every((poeme) => nom(j.t, poeme) in c.fichiers);
      },
      message: (j) => j.t('manuscrit-evenement-poemes'),
    },
    {
      id: 'fin',
      condition: (j) => j.drapeaux.has('sauve') && j.drapeaux.has('poemes'),
      message: (j) => j.t('manuscrit-evenement-fin'),
    },
  ],
};
