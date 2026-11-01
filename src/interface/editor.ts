// The nano editor in the terminal: title bar, text area, status
// line and shortcuts. ^O writes, ^X exits (offering to save if the
// text has changed: O, N or ^C). The shortcuts are also buttons, for
// keyboards without a Ctrl key (mobiles).

import type { Translate } from '../texts';

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

function el<K extends keyof HTMLElementTagNameMap>(name: K, attrs: Record<string, string> = {}, ...children: (Node | string)[]) {
  const e = document.createElement(name);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  e.append(...children);
  return e;
}

const shortcut = (key: string, label: string) =>
  el('button', { type: 'button', class: 'nano-key' }, el('kbd', {}, key), ` ${label}`);

export function editor(o: EditorOptions): HTMLElement {
  const { t } = o;
  const modified = el('span', { class: 'nano-modified' });
  const zone = el('textarea', {
    class: 'nano-text',
    spellcheck: 'false',
    autocapitalize: 'off',
    autocomplete: 'off',
    'aria-label': t('nano-zone', { path: o.path }),
  }) as HTMLTextAreaElement;
  zone.value = o.text;
  const state = el('div', { class: 'nano-status', role: 'status', 'aria-live': 'polite' }, o.message);

  const write = shortcut('^O', t('nano-write'));
  const quit = shortcut('^X', t('nano-quit'));
  const help = el('div', { class: 'nano-help' }, write, quit);
  const yes = shortcut('O', t('nano-yes'));
  const not = shortcut('N', t('nano-not'));
  const cancel = shortcut('^C', t('nano-cancel'));
  const question = el('div', { class: 'nano-help', hidden: '' }, yes, not, cancel);

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
    state.textContent = message;
    modifiedUpdate();
  };
  const ask = (yes: boolean) => {
    help.hidden = yes;
    question.hidden = !yes;
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
