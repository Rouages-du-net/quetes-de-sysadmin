// Histoire « La Machine à remonter le temps » : git, pour garder l'historique
// d'un texte et revenir en arrière. Inès, romancière, a abîmé son manuscrit ;
// heureusement, il est suivi par git. Ses poèmes, eux, ne le sont pas.

import { path, d, f, name, type Chapter } from '../world';
import type { Translate } from '../../texts';
import { newCommit, type Commit, type Repo } from '../commands/git';

const M = '/home/vous';
const NOVEL = `${M}/roman`;
const POEMS = `${M}/poemes`;

// Les versions du roman, les commits et les poèmes sont des textes de
// l'histoire, dans la langue du jeu (chapitre-manuscript.ftl).
const INES_POEMS = ['mer.txt', 'phare.txt', 'zohra.txt'];

function versions(t: Translate) {
  const [ch1, ch2, ch3, damage] = ['1', '2', '3', '3-abime'].map((n) => t(`manuscript-roman-chapitre-${n}`));
  return {
    v1: ch1,
    v2: `${ch1}\n\n${ch2}`,
    v3: `${ch1}\n\n${ch2}\n\n${ch3}`,
    v4: `${ch1}\n\n${ch2}\n\n${damage}`,
  };
}

function history(t: Translate): Repo {
  const v = versions(t);
  const commits: Commit[] = [];
  // Le fichier suivi, sous son nom dans la langue (novel.txt…).
  const novel = name(t, 'roman.txt');
  const add = (message: string, date: string, text: string) =>
    commits.push(newCommit(commits.at(-1) ?? null, message, t('manuscript-autrice'), date, { [novel]: text }));
  add(t('manuscript-commit-1'), 'Mon Oct 5 22:14:09 2026 +0200', v.v1);
  add(t('manuscript-commit-2'), 'Thu Oct 8 21:40:33 2026 +0200', v.v2);
  add(t('manuscript-commit-3'), 'Sun Oct 11 23:02:51 2026 +0200', v.v3);
  add(t('manuscript-commit-4'), 'Mon Oct 12 07:55:12 2026 +0200', v.v4);
  return { commits, index: { [novel]: v.v4 } };
}

export const time: Chapter = {
  id: 'manuscript',
  number: 1,
  commands: ['ls', 'cd', 'pwd', 'cat', 'less', 'head', 'git'],
  home: M,
  welcome: 'message_d_ines.txt',
  names: true,
  final: 'fin',
  state: (t) => ({
    git: { [path(t, NOVEL)]: history(t) },
    auteur: t('manuscript-autrice'),
    date: 'Tue Oct 13 10:30:00 2026 +0200',
  }),
  createWorld: (t) => {
    return d({
      home: d({
        vous: d({
          'message_d_ines.txt': f(t('manuscript-message-d-ines')),
          roman: d({
            '.git': d({ HEAD: f('ref: refs/heads/main', { lines: true }) }),
            'roman.txt': f(versions(t).v4, { lines: true }),
          }),
          poemes: d(Object.fromEntries(INES_POEMS.map((poem) => [poem, f(t(`manuscript-poeme-${poem.replace('.txt', '')}`), { lines: true })]))),
          'aide_git.txt': f(t('manuscript-aide-git')),
        }),
      }),
    });
  },
  events: [
    {
      id: 'historique',
      condition: (j) => j.last.commands[0]?.[0] === 'git' && j.last.commands[0]?.[1] === 'log',
      message: (j) => j.t('manuscript-evenement-historique'),
    },
    {
      id: 'restaure',
      condition: (j) => j.read(path(j.t, `${NOVEL}/roman.txt`)) === versions(j.t).v3,
      message: (j) => j.t('manuscript-evenement-restaure'),
    },
    {
      id: 'sauve',
      condition: (j) => {
        const repo: Repo = j.state.git[path(j.t, NOVEL)];
        return repo.commits.length > 4 && repo.commits.at(-1)!.files[name(j.t, 'roman.txt')] === versions(j.t).v3;
      },
      message: (j) => j.t('manuscript-evenement-sauve'),
    },
    {
      id: 'poemes',
      condition: (j) => {
        const repo: Repo | undefined = j.state.git?.[path(j.t, POEMS)];
        const c = repo?.commits.at(-1);
        return !!c && INES_POEMS.every((poem) => name(j.t, poem) in c.files);
      },
      message: (j) => j.t('manuscript-evenement-poemes'),
    },
    {
      id: 'fin',
      condition: (j) => j.flags.has('sauve') && j.flags.has('poemes'),
      message: (j) => j.t('manuscript-evenement-fin'),
    },
  ],
};
