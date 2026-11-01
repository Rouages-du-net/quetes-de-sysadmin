// Story "The Time Machine": git, to keep a text's history and go back in
// time. Inès, a novelist, has damaged her manuscript; luckily, it is tracked
// by git. Her poems, however, are not.

import { path, d, f, name, type Chapter } from '../world';
import type { Translate } from '../../texts';
import { newCommit, type Commit, type Repo } from '../commands/git';

const M = '/home/you';
const NOVEL = `${M}/novel`;
const POEMS = `${M}/poems`;

// The novel's versions, the commits and the poems are texts of the story,
// in the game's language (chapter-manuscript.ftl).
const INES_POEMS = ['sea.txt', 'lighthouse.txt', 'zohra.txt'];

function versions(t: Translate) {
  const [ch1, ch2, ch3, damage] = ['1', '2', '3', '3-damaged'].map((n) => t(`manuscript-novel-chapter-${n}`));
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
  // The tracked file, under its name in the language (novel.txt…).
  const novel = name(t, 'novel.txt');
  const add = (message: string, date: string, text: string) =>
    commits.push(newCommit(commits.at(-1) ?? null, message, t('manuscript-author'), date, { [novel]: text }));
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
  welcome: 'message_from_ines.txt',
  names: true,
  final: 'end',
  state: (t) => ({
    git: { [path(t, NOVEL)]: history(t) },
    author: t('manuscript-author'),
    date: 'Tue Oct 13 10:30:00 2026 +0200',
  }),
  createWorld: (t) => {
    return d({
      home: d({
        you: d({
          'message_from_ines.txt': f(t('manuscript-message-ines')),
          novel: d({
            '.git': d({ HEAD: f('ref: refs/heads/main', { lines: true }) }),
            'novel.txt': f(versions(t).v4, { lines: true }),
          }),
          poems: d(Object.fromEntries(INES_POEMS.map((poem) => [poem, f(t(`manuscript-poem-${poem.replace('.txt', '')}`), { lines: true })]))),
          'help_git.txt': f(t('manuscript-help-git')),
        }),
      }),
    });
  },
  events: [
    {
      id: 'history',
      condition: (j) => j.last.commands[0]?.[0] === 'git' && j.last.commands[0]?.[1] === 'log',
      message: (j) => j.t('manuscript-event-history'),
    },
    {
      id: 'restored',
      condition: (j) => j.read(path(j.t, `${NOVEL}/novel.txt`)) === versions(j.t).v3,
      message: (j) => j.t('manuscript-event-restored'),
    },
    {
      id: 'saved',
      condition: (j) => {
        const repo: Repo = j.state.git[path(j.t, NOVEL)];
        return repo.commits.length > 4 && repo.commits.at(-1)!.files[name(j.t, 'novel.txt')] === versions(j.t).v3;
      },
      message: (j) => j.t('manuscript-event-saved'),
    },
    {
      id: 'poems',
      condition: (j) => {
        const repo: Repo | undefined = j.state.git?.[path(j.t, POEMS)];
        const c = repo?.commits.at(-1);
        return !!c && INES_POEMS.every((poem) => name(j.t, poem) in c.files);
      },
      message: (j) => j.t('manuscript-event-poems'),
    },
    {
      id: 'end',
      condition: (j) => j.flags.has('saved') && j.flags.has('poems'),
      message: (j) => j.t('manuscript-event-end'),
    },
  ],
};
