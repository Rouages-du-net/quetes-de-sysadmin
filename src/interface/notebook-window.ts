// The sysadmin's notebook (see notebook.ts in the engine): the commands
// already run, each with its line from the manual and the player's example,
// the shortcuts worth knowing at the top; taken away as a Markdown file or
// through the clipboard.

import { description, inMarkdown } from '../engine/notebook';
import { loadTexts, textsLoaded } from '../texts';
import type { Context } from './context';
import { downloadFile, el, refocusOnClose, uid } from './dom';

// The shortcuts worth knowing, at the top of the notebook (keys and syntax are not translated).
const SHORTCUTS: [string, string][] = [
  ['~', 'shortcuts-home'],
  ['-', 'shortcuts-back'],
  ['..', 'shortcuts-up'],
  ['Tab', 'shortcuts-tab'],
  ['↑ ↓', 'shortcuts-history'],
  ['Ctrl-C', 'shortcuts-cancel'],
  ['Esc Tab', 'shortcuts-escape-tab'],
  ['Shift-Tab', 'shortcuts-shift-tab'],
  ['Alt-R', 'shortcuts-reread'],
];

export function notebookPart(ctx: Context, notebookButton: HTMLButtonElement) {
  const { t, typo, notebook } = ctx;
  const accountNotebook = el('span', { class: 'account' });
  const titleNotebook = el('span', {});
  const listNotebook = el('dl', {});
  const emptyNotebook = el('p', {}, typo(t('notebook-empty')));
  const exported = el('button', { type: 'button', class: 'link' }, t('notebook-export'));
  const copyNotebook = el('button', { type: 'button', class: 'link' }, t('notebook-copy-button'));
  const stateNotebook = el('span', { class: 'notebook-state', role: 'status' });
  const actionsNotebook = el('p', { class: 'notebook-actions' }, exported, ' · ', copyNotebook, ' ', stateNotebook);
  const shortcuts = el(
    'section',
    { class: 'shortcuts' },
    el('h3', {}, t('shortcuts-title')),
    el('dl', {}, ...SHORTCUTS.flatMap(([key, text]) => [el('dt', {}, el('kbd', {}, key)), el('dd', {}, typo(t(text)))])),
  );
  const notebookId = uid('qds-notebook');
  const closeNotebook = el('button', { type: 'button', class: 'button' }, t('notebook-close'));
  const notebookWindow = el(
    'dialog',
    { class: 'notebook notebook-window', 'aria-labelledby': notebookId },
    el('h2', { id: notebookId }, titleNotebook, ' ', accountNotebook),
    shortcuts,
    el('p', { class: 'notebook-help' }, typo(t('notebook-help'))),
    emptyNotebook,
    listNotebook,
    actionsNotebook,
    el('p', { class: 'map-actions' }, closeNotebook),
  ) as HTMLDialogElement;

  // The notebook's button shows a dot when commands were added since it was last opened.
  let notebookSeen = Object.keys(notebook).length;
  const notebookUpdate = () => {
    const names = Object.keys(notebook).sort((a, b) => a.localeCompare(b));
    notebookButton.classList.toggle('fresh', names.length > notebookSeen);
    titleNotebook.textContent = ctx.playerName ? t('notebook-title-of', { name: ctx.playerName }) : t('notebook-title');
    accountNotebook.textContent = t('notebook-account', { count: names.length });
    emptyNotebook.hidden = names.length > 0;
    actionsNotebook.hidden = names.length === 0;
    // Each command's sentence comes from the manual's pages: until they have
    // loaded (in the background once the terminal is ready), the command and
    // its example alone, then the list again.
    const manual = textsLoaded(t.language, 'manual');
    if (!manual && names.length) loadTexts(t.language, 'manual').then(notebookUpdate, () => {});
    listNotebook.replaceChildren(
      ...names.flatMap((name) => [
        el('dt', {}, el('code', {}, name)),
        el('dd', {}, ...(manual ? [typo(description(name, t)), ' '] : []), el('code', { class: 'example' }, notebook[name].line)),
      ]),
    );
  };

  // The notebook can be taken away: a Markdown file, or the clipboard.
  const markdown = () => inMarkdown(notebook, t, ctx.finished, ctx.playerName);
  exported.addEventListener('click', () => ctx.withTexts('manual', () => downloadFile(markdown(), 'text/markdown', t('notebook-file'))));
  copyNotebook.addEventListener('click', () => ctx.withTexts('manual', () => {
    navigator.clipboard
      ?.writeText(markdown())
      .then(() => (stateNotebook.textContent = t('notebook-copy')))
      .catch(() => (stateNotebook.textContent = t('notebook-copy-impossible')));
  }));
  notebookButton.addEventListener('click', () => {
    notebookUpdate();
    notebookSeen = Object.keys(notebook).length;
    notebookButton.classList.remove('fresh');
    notebookWindow.showModal();
  });
  closeNotebook.addEventListener('click', () => notebookWindow.close());
  refocusOnClose(notebookWindow, () => ctx.input);

  return { notebookWindow, notebookUpdate };
}
