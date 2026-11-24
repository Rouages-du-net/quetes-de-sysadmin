// My progress (see progress.ts): a name for the notebook, and a way to
// continue on another device: the short code, or the save file. A restored
// save is written, then the game starts again from it (remount).

import { progressCode, backupFile, readCode, readFile, cleanName, mergeOnCall, type Backup } from '../engine/progress';
import type { Context } from './context';
import { downloadFile, el, icon, ICON_PROGRESS, refocusOnClose, uid } from './dom';

export function progressPart(ctx: Context, remount: () => void) {
  const { t, typo, finished } = ctx;
  const progressButton = el('button', { type: 'button', class: 'pill', 'aria-haspopup': 'dialog' }, icon(...ICON_PROGRESS), el('span', {}, t('progress-button')));
  const progressId = uid('qds-progress');
  const nameField = el('input', { type: 'text', id: `${progressId}-name`, maxlength: '60', autocomplete: 'name', spellcheck: 'false' }) as HTMLInputElement;
  const currentCode = el('code', { class: 'progress-code' });
  const copyCode = el('button', { type: 'button', class: 'link' }, t('progress-copy'));
  const codeField = el('input', { type: 'text', id: `${progressId}-code`, autocomplete: 'off', spellcheck: 'false', autocapitalize: 'characters', placeholder: 'QDS-…' }) as HTMLInputElement;
  const resumeCode = el('button', { type: 'button', class: 'button' }, t('progress-resume'));
  const download = el('button', { type: 'button', class: 'button' }, t('progress-download'));
  const fileField = el('input', { type: 'file', id: `${progressId}-file`, accept: '.json,application/json' }) as HTMLInputElement;
  const progressState = el('p', { class: 'progress-state', role: 'status' });
  const closeProgress = el('button', { type: 'button', class: 'button' }, t('map-close'));
  const progressWindow = el(
    'dialog',
    { class: 'progress-window', 'aria-labelledby': progressId },
    el('h2', { id: progressId }, t('progress-title')),
    el('p', { class: 'map-legend' }, typo(t('progress-intro'))),
    el(
      'section',
      { class: 'progress-section' },
      el('h3', {}, el('label', { for: nameField.id }, t('progress-name'))),
      el('p', { class: 'map-legend' }, typo(t('progress-name-help'))),
      el('p', {}, nameField),
    ),
    // The short code: copy it, or type one to continue on another device.
    el(
      'section',
      { class: 'progress-section' },
      el('h3', {}, t('progress-code-title')),
      el('p', { class: 'map-legend' }, typo(t('progress-code-help'))),
      el('p', { class: 'progress-input' }, currentCode, ' ', copyCode),
      el('p', { class: 'progress-input' }, el('label', { for: codeField.id }, t('progress-code-input')), ' ', codeField, ' ', resumeCode),
    ),
    // The save file: download a backup, or load one back.
    el(
      'section',
      { class: 'progress-section' },
      el('h3', {}, t('progress-file-title')),
      el('p', { class: 'map-legend' }, typo(t('progress-file-help'))),
      el('p', { class: 'progress-input' }, download),
      el('p', { class: 'progress-input' }, el('label', { for: fileField.id }, t('progress-file-input')), ' ', fileField),
    ),
    progressState,
    el('p', { class: 'map-actions' }, closeProgress),
  ) as HTMLDialogElement;

  // A restored save (code or file): it is written, then the game restarts from it.
  const resume = ({ onCall: days, ...s }: Backup) => {
    try {
      localStorage.setItem(ctx.KEY, JSON.stringify(s));
      // The file's on-call days join this browser's (the best of each day): the streak follows.
      if (days) localStorage.setItem(`${ctx.KEY}-on-call`, JSON.stringify(mergeOnCall(ctx.results, days)));
    } catch {}
    progressWindow.close();
    remount();
  };
  const progressUpdate = () => {
    nameField.value = ctx.playerName;
    currentCode.textContent = progressCode(finished);
    progressState.textContent = '';
  };
  progressButton.addEventListener('click', () => {
    progressUpdate();
    progressWindow.showModal();
  });
  closeProgress.addEventListener('click', () => progressWindow.close());
  refocusOnClose(progressWindow, () => ctx.input);
  nameField.addEventListener('change', () => {
    ctx.playerName = cleanName(nameField.value);
    nameField.value = ctx.playerName;
    ctx.notebookUpdate();
    ctx.save();
  });
  copyCode.addEventListener('click', () => {
    navigator.clipboard
      ?.writeText(currentCode.textContent ?? '')
      .then(() => (progressState.textContent = t('notebook-copy')))
      .catch(() => (progressState.textContent = t('notebook-copy-impossible')));
  });
  // The code only gives finished chapters: they are added, losing nothing from here.
  const tryCode = () => {
    const read = readCode(codeField.value);
    if ('error' in read) {
      progressState.textContent = t(`progress-${read.error}`);
      codeField.focus();
      return;
    }
    const fresh = read.finished.filter((id) => !finished.includes(id));
    if (!fresh.length) {
      progressState.textContent = t('progress-nothing-new');
      return;
    }
    resume({ ...ctx.backupState(), finished: [...finished, ...fresh] });
  };
  resumeCode.addEventListener('click', tryCode);
  codeField.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') tryCode();
  });
  download.addEventListener('click', () => {
    downloadFile(backupFile({ ...ctx.backupState(), onCall: ctx.results }, new Date()), 'application/json', t('progress-name-file'));
    progressState.textContent = t('progress-downloaded');
  });
  // The file replaces everything kept here: ask first.
  fileField.addEventListener('change', async () => {
    const file = fileField.files?.[0];
    if (!file) return;
    const read = readFile(await file.text());
    fileField.value = '';
    if ('error' in read) {
      progressState.textContent = t(`progress-${read.error}`);
      return;
    }
    if (!confirm(t('progress-confirm', { count: read.backup.finished?.length ?? 0 }))) return;
    resume(read.backup);
  });

  return { progressButton, progressWindow };
}
