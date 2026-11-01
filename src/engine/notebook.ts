// The sysadmin's notebook: each command of the game, the first time it is
// run, is added to a personal cheat sheet (its line from the manual, the
// first line typed, the chapter). Kept in the browser with the progress,
// exportable as Markdown.

import type { Shell } from './shell';
import type { Translate } from '../texts';
import { COMMANDS } from './commands';
import { page, recap } from './commands/manual';
import { STORIES } from './chapters';
import { grade } from './achievements';

export interface NotebookInput {
  // The first line where the command was used, and the chapter (identifier; empty on the workstation).
  line: string;
  chapter: string;
}

export type Notebook = Record<string, NotebookInput>;

// The manual's own commands, which the shell handles separately.
const MANUAL = ['man', 'apropos', 'whatis'];

/** After a line typed in this shell: the commands run for the first time join the notebook. Returns the new ones. */
export function note(notebook: Notebook, sh: Shell): string[] {
  const fresh: string[] = [];
  const { line, commands } = sh.last;
  for (const args of commands) {
    const name = (args[0] ?? '').split('/').at(-1)!;
    const known = MANUAL.includes(name) || (sh.known().includes(name) && !!COMMANDS[name] && COMMANDS[name].section !== 5);
    if (!name || !known || notebook[name]) continue;
    notebook[name] = { line: line.trim(), chapter: sh.chapter.id === 'desk' ? '' : sh.chapter.id };
    fresh.push(name);
  }
  return fresh;
}

/** The notebook's line: what the command does, in one sentence (like whatis). */
export const description = (name: string, t: Translate) => recap(t(page(name)));

/** The progress: for each story started, the finished chapters. */
export function progress(finished: string[], t: Translate): string[] {
  const lines = STORIES.flatMap((h) => {
    const done = h.chapters.filter((c) => finished.includes(c.id));
    if (!done.length) return [];
    return [
      `- ${t('notebook-progress-story', { story: t(`story-${h.id}`), finished: done.length, total: h.chapters.length })}`,
      ...done.map((c) => `  - ${t('chapter-number', { number: c.number })} : ${t(`chapter-${c.id}`)}`),
    ];
  });
  return [`## ${t('notebook-progress')}`, '', ...(lines.length ? lines : [t('notebook-progress-empty')]), ''];
}

/** The notebook in Markdown: its title (in the player's name, if given), the progress (if given), then the commands, sorted by name. */
export function inMarkdown(notebook: Notebook, t: Translate, finished?: string[], playerName = ''): string {
  const names = Object.keys(notebook).sort((a, b) => a.localeCompare(b));
  return [
    `# ${playerName ? t('notebook-title-of', { name: playerName }) : t('notebook-title')}`,
    '',
    t('notebook-markdown-intro', { count: names.length }),
    '',
    ...(finished ? [t('notebook-grade', { grade: t(`grade-${grade(finished)}`) }), ''] : []),
    ...(finished ? progress(finished, t) : []),
    ...names.flatMap((name) => {
      const e = notebook[name];
      return [
        `## ${name}`,
        '',
        `${description(name, t)}.`,
        '',
        '```',
        e.line,
        '```',
        '',
        ...(e.chapter ? [t('notebook-discovery', { chapter: t(`chapter-${e.chapter}`) }), ''] : []),
        t('notebook-manual', { command: `man ${name}` }),
        '',
      ];
    }),
  ].join('\n');
}
