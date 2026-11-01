// Le carnet du sysadmin : chaque commande du jeu, la première fois qu'on la
// lance, s'ajoute à un aide-mémoire personnel (sa ligne du manuel, la
// première ligne tapée, le chapitre). Gardé dans le navigateur avec la
// progression, exportable en Markdown.

import type { Shell } from './shell';
import type { Translate } from '../texts';
import { COMMANDS } from './commands';
import { page, recap } from './commands/manual';
import { STORIES } from './chapters';
import { grade } from './achievements';

export interface NotebookInput {
  // La première ligne où la commande a servi, et le chapitre (identifiant ; vide sur le poste).
  line: string;
  chapter: string;
}

export type Notebook = Record<string, NotebookInput>;

// Les commandes du manuel lui-même, que le shell traite à part.
const MANUAL = ['man', 'apropos', 'whatis'];

/** Après une ligne tapée dans ce shell : les commandes lancées pour la première fois rejoignent le carnet. Renvoie les nouvelles. */
export function note(notebook: Notebook, sh: Shell): string[] {
  const fresh: string[] = [];
  const { line, commands } = sh.last;
  for (const args of commands) {
    const name = (args[0] ?? '').split('/').at(-1)!;
    const known = MANUAL.includes(name) || (sh.known().includes(name) && !!COMMANDS[name] && COMMANDS[name].section !== 5);
    if (!name || !known || notebook[name]) continue;
    notebook[name] = { line: line.trim(), chapter: sh.chapter.id === 'poste' ? '' : sh.chapter.id };
    fresh.push(name);
  }
  return fresh;
}

/** La ligne du carnet : ce que fait la commande, en une phrase (comme whatis). */
export const description = (name: string, t: Translate) => recap(t(page(name)));

/** La progression : pour chaque histoire commencée, les chapitres terminés. */
export function progress(finished: string[], t: Translate): string[] {
  const lines = STORIES.flatMap((h) => {
    const done = h.chapters.filter((c) => finished.includes(c.id));
    if (!done.length) return [];
    return [
      `- ${t('carnet-progression-histoire', { histoire: t(`histoire-${h.id}`), faits: done.length, total: h.chapters.length })}`,
      ...done.map((c) => `  - ${t('chapitre-numero', { numero: c.number })} : ${t(`chapitre-${c.id}`)}`),
    ];
  });
  return [`## ${t('carnet-progression')}`, '', ...(lines.length ? lines : [t('carnet-progression-vide')]), ''];
}

/** Le carnet en Markdown : son titre (au nom de la joueuse ou du joueur, s'il est donné), la progression (si elle est donnée), puis les commandes, triées par nom. */
export function inMarkdown(notebook: Notebook, t: Translate, finished?: string[], playerName = ''): string {
  const names = Object.keys(notebook).sort((a, b) => a.localeCompare(b));
  return [
    `# ${playerName ? t('carnet-titre-de', { nom: playerName }) : t('carnet-titre')}`,
    '',
    t('carnet-markdown-intro', { nombre: names.length }),
    '',
    ...(finished ? [t('carnet-grade', { grade: t(`grade-${grade(finished)}`) }), ''] : []),
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
        ...(e.chapter ? [t('carnet-decouverte', { chapitre: t(`chapitre-${e.chapter}`) }), ''] : []),
        t('carnet-manuel', { commande: `man ${name}` }),
        '',
      ];
    }),
  ].join('\n');
}
