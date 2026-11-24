// The nano editor in the terminal: title bar, text area, status
// line and shortcuts. ^O writes, ^X exits (offering to save if the
// text has changed: O, N or ^C). The shortcuts are also buttons, for
// keyboards without a Ctrl key (mobiles).

import type { Translate } from '../texts';
import { el } from './dom';

export interface EditorOptions {
  t: Translate;
  path: string;
  text: string;
  message: string;
  /** Writes the text; returns nano's message, and whether it was written. */
  save: (text: string) => { message: string; written: boolean };
  /** The editor is closed. */
  close: () => void;
}

const shortcut = (key: string, label: string) =>
  el('button', { type: 'button', class: 'nano-key' }, el('kbd', {}, key), ` ${label}`);

export function editor(o: EditorOptions): HTMLElement {
  const { t } = o;
  const id = `qds-nano-${Math.random().toString(36).slice(2, 8)}`;
  const modified = el('span', { class: 'nano-modified', id: `${id}-modified` });
  const zone = el('textarea', {
    class: 'nano-text',
    spellcheck: 'false',
    autocapitalize: 'off',
    autocomplete: 'off',
    'aria-label': t('nano-zone', { path: o.path }),
    // A screen reader says the shortcuts and the modified state with the field; the status line is announced (role="status").
    'aria-describedby': `${id}-help ${id}-modified`,
  }) as HTMLTextAreaElement;
  zone.value = o.text;
  const state = el('div', { class: 'nano-status', role: 'status', 'aria-live': 'polite' }, o.message);

  const write = shortcut('^O', t('nano-write'));
  const quit = shortcut('^X', t('nano-quit'));
  const help = el('div', { class: 'nano-help', id: `${id}-help` }, write, quit);
  // nano's own letter for yes: Y in English, O (oui) in French; both work.
  const yes = shortcut(t('nano-yes-key'), t('nano-yes'));
  const not = shortcut('N', t('nano-not'));
  const cancel = shortcut('^C', t('nano-cancel'));
  // A group named by its question: the focus lands on Yes, and the question is read with it.
  const question = el('div', { class: 'nano-help', role: 'group', 'aria-label': t('nano-save'), hidden: '' }, yes, not, cancel);

  const root = el(
    'div',
    { class: 'nano', role: 'group', 'aria-label': `nano ${o.path}` },
    el('div', { class: 'nano-title' }, el('span', {}, 'GNU nano 7.2'), el('span', { class: 'nano-path' }, o.path), modified),
    zone,
    state,
    help,
    question,
  );

  let saves = o.text;
  const modifiedUpdate = () => (modified.textContent = zone.value !== saves ? t('nano-modified') : '');
  const close = () => {
    root.remove();
    o.close();
  };
  const save = () => {
    const { message, written } = o.save(zone.value);
    if (written) saves = zone.value;
    state.removeAttribute('aria-hidden');
    state.textContent = message;
    modifiedUpdate();
  };
  const ask = (yes: boolean) => {
    help.hidden = yes;
    question.hidden = !yes;
    // The question is read with the focus, on its group: not a second time by the status line.
    if (yes) state.setAttribute('aria-hidden', 'true');
    else state.removeAttribute('aria-hidden');
    state.textContent = yes ? t('nano-save') : '';
    (yes ? question.querySelector('button')! : zone).focus();
    // On a small screen, the question must be visible.
    if (yes) question.scrollIntoView?.({ block: 'nearest' });
  };
  const exit = () => (zone.value === saves ? close() : ask(true));

  zone.addEventListener('input', modifiedUpdate);
  write.addEventListener('click', () => (save(), zone.focus()));
  quit.addEventListener('click', exit);
  yes.addEventListener('click', () => {
    save();
    if (zone.value === saves) close();
    else ask(false);
  });
  not.addEventListener('click', close);
  cancel.addEventListener('click', () => ask(false));
  root.addEventListener('keydown', (e) => {
    const key = e.key.toLowerCase();
    if (!question.hidden) {
      if (key === 'o' || key === 'y') yes.click();
      else if (key === 'n') not.click();
      else if ((e.ctrlKey && key === 'c') || e.key === 'Escape') cancel.click();
      else return;
      e.preventDefault();
      return;
    }
    if (!e.ctrlKey) return;
    if (key === 'o' || key === 's') save();
    else if (key === 'x') exit();
    else return;
    e.preventDefault();
  });
  queueMicrotask(() => zone.focus());
  return root;
}
