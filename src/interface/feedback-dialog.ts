// "Report a problem or an idea" (see feedback.ts in the engine): what the
// report is about, the message, the parts of the context to include (each
// showing exactly what it adds), the exact text, and the player's own ways
// to send it. Nothing leaves the game: the player opens a prefilled GitHub
// issue (a link, in a new tab) or copies the text. Available in exam mode
// too (a bug can happen during a test), but without the commands: a public
// issue must not carry a test's answers. Its texts (dialog-feedback.ftl)
// load when the dialog first opens.

import { buildReport, DEFAULT_PARTS, FEEDBACK_KINDS, FEEDBACK_PARTS, partLines, reportText, transcript, type FeedbackContext, type FeedbackKind, type FeedbackPart } from '../engine/feedback';
import { SIZES, type Context } from './context';
import { el, uid } from './dom';

// Opened from a button under the menu, one among the chapter's actions, or
// the host page (the element's openFeedback(), the site's footer): see
// game.ts. This module is a chunk of its own (lazy-dialog.ts).
export default function feedbackDialog(ctx: Context) {
  const { t, typo, lazy, display, terminal: gameTerminal } = ctx;
  // Not a <form>: nothing is ever submitted.
  const feedbackId = uid('qds-feedback');
  const feedbackKinds = el(
    'fieldset',
    { class: 'feedback-kind' },
    el('legend', {}, lazy('dialog-feedback', 'feedback-kind-legend')),
    ...FEEDBACK_KINDS.map((k) => el('label', {}, el('input', { type: 'radio', name: `${feedbackId}-kind`, value: k }), ' ', el('span', {}, lazy('dialog-feedback', `feedback-kind-${k}`)))),
  );
  const feedbackMessage = el('textarea', { id: `${feedbackId}-message`, rows: '4', 'aria-describedby': `${feedbackId}-message-help`, spellcheck: 'true' }) as HTMLTextAreaElement;
  const feedbackBoxes = Object.fromEntries(
    FEEDBACK_PARTS.map((p) => [p, el('input', { type: 'checkbox', value: p, 'aria-describedby': `${feedbackId}-${p}` }) as HTMLInputElement]),
  ) as Record<FeedbackPart, HTMLInputElement>;
  // What each part adds: shown as is; the commands in a field the player may edit.
  const feedbackLines = Object.fromEntries(
    FEEDBACK_PARTS.filter((p) => p !== 'commands').map((p) => [p, el('pre', { class: 'feedback-lines', id: `${feedbackId}-${p}` })]),
  ) as Record<Exclude<FeedbackPart, 'commands'>, HTMLPreElement>;
  const feedbackCommands = el('textarea', { id: `${feedbackId}-commands-field`, class: 'feedback-commands', rows: '8', spellcheck: 'false', autocapitalize: 'off', wrap: 'off' }) as HTMLTextAreaElement;
  const feedbackCommandsNote = el('p', { class: 'map-legend', id: `${feedbackId}-commands` });
  const feedbackPreview = el('textarea', { id: `${feedbackId}-preview`, class: 'feedback-preview', rows: '10', readonly: '', spellcheck: 'false', wrap: 'off' }) as HTMLTextAreaElement;
  const feedbackTruncated = el('p', { class: 'feedback-truncated', hidden: '' });
  const feedbackGithub = el('a', { class: 'button feedback-github', target: '_blank', rel: 'noopener noreferrer', href: '#' }, lazy('dialog-feedback', 'feedback-github'), el('span', { class: 'visually-hidden' }, ' ', lazy('dialog-feedback', 'feedback-new-tab')));
  const feedbackCopy = el('button', { type: 'button', class: 'button button-secondary' }, lazy('dialog-feedback', 'feedback-copy'));
  const feedbackStatus = el('p', { class: 'map-legend', role: 'status' });
  const closeFeedback = el('button', { type: 'button', class: 'button' }, lazy('dialog-feedback', 'feedback-close'));
  const feedbackWindow = el(
    'dialog',
    { class: 'feedback-window', 'aria-labelledby': feedbackId },
    el('h2', { id: feedbackId }, lazy('dialog-feedback', 'feedback-title')),
    el('p', { class: 'map-legend' }, lazy('dialog-feedback', 'feedback-intro', true)),
    feedbackKinds,
    el('p', { class: 'feedback-field' }, el('label', { for: feedbackMessage.id }, lazy('dialog-feedback', 'feedback-message-label')), el('span', { class: 'map-legend', id: `${feedbackId}-message-help` }, lazy('dialog-feedback', 'feedback-message-help', true)), feedbackMessage),
    el(
      'fieldset',
      { class: 'feedback-parts' },
      el('legend', {}, lazy('dialog-feedback', 'feedback-parts-legend')),
      el('p', { class: 'map-legend' }, lazy('dialog-feedback', 'feedback-parts-help', true)),
      el(
        'ul',
        {},
        ...FEEDBACK_PARTS.map((p) =>
          el(
            'li',
            { 'data-part': p },
            el('label', {}, feedbackBoxes[p], ' ', el('span', {}, lazy('dialog-feedback', `feedback-part-${p}`))),
            ...(p === 'commands'
              ? [feedbackCommandsNote, el('label', { for: feedbackCommands.id, class: 'visually-hidden' }, lazy('dialog-feedback', 'feedback-commands-label')), feedbackCommands]
              : [feedbackLines[p]]),
          ),
        ),
      ),
      el('p', { class: 'map-legend' }, lazy('dialog-feedback', 'feedback-never', true)),
    ),
    el('h3', {}, el('label', { for: feedbackPreview.id }, lazy('dialog-feedback', 'feedback-preview'))),
    feedbackPreview,
    el('h3', {}, lazy('dialog-feedback', 'feedback-send')),
    el('p', { class: 'map-legend' }, lazy('dialog-feedback', 'feedback-github-help', true)),
    feedbackTruncated,
    el('p', { class: 'feedback-actions' }, feedbackGithub, ' ', feedbackCopy),
    el('p', { class: 'map-legend' }, lazy('dialog-feedback', 'feedback-copy-help', true)),
    feedbackStatus,
    el('p', { class: 'map-actions' }, closeFeedback),
  ) as HTMLDialogElement;

  const VERSION = typeof __QDS_VERSION__ === 'string' ? __QDS_VERSION__ : 'dev';
  let feedbackOpener: HTMLElement | null = null;
  const feedbackKind = (): FeedbackKind =>
    (feedbackKinds.querySelector<HTMLInputElement>('input:checked')?.value as FeedbackKind | undefined) ?? 'bug';
  const feedbackContext = (): FeedbackContext => {
    const remote = gameTerminal.remote;
    const sh = gameTerminal.shell;
    return {
      version: VERSION,
      language: t.language,
      chapter: remote
        ? { story: remote.story.id, chapter: remote.shell.chapter.id, number: remote.shell.chapter.number, machine: sh.hostName, directory: sh.cwd, events: remote.shell.log.length, finished: remote.shell.finished }
        : null,
      commands: gameTerminal.exam ? '' : feedbackCommands.value,
      browser: { userAgent: navigator.userAgent, viewport: `${innerWidth}x${innerHeight}`, screen: `${window.screen.width}x${window.screen.height}` },
      settings: { theme: display.theme, size: SIZES[display.size] ?? 1, colours: display.colours, tips: display.tips, explainer: display.explainer, autosave: display.autosave, exam: gameTerminal.exam },
      notebook: Object.keys(ctx.notebook).sort((a, b) => a.localeCompare(b)),
    };
  };
  // Each box's lines, the exact text, and the link: again after every change.
  const renderFeedback = () => {
    const context = feedbackContext();
    for (const p of FEEDBACK_PARTS) if (p !== 'commands') feedbackLines[p].textContent = partLines(p, context, t).join('\n');
    const parts = FEEDBACK_PARTS.filter((p) => feedbackBoxes[p].checked);
    const report = buildReport({ kind: feedbackKind(), message: feedbackMessage.value, parts, context, t });
    feedbackPreview.value = reportText(report);
    feedbackGithub.href = report.url;
    feedbackTruncated.hidden = !report.truncated;
    feedbackTruncated.textContent = report.truncated ? typo(report.messageCut ? t('feedback-link-message-cut') : t('feedback-link-truncated', { count: report.omittedLines })) : '';
  };
  const showFeedback = (opener: HTMLElement | null) => {
    if (feedbackWindow.open) return;
    feedbackOpener = opener;
    // What it is about: kept from the last time (a draft), a bug by default.
    if (!feedbackKinds.querySelector('input:checked')) feedbackKinds.querySelector<HTMLInputElement>('input[value="bug"]')!.checked = true;
    if (!feedbackWindow.dataset.opened) for (const p of FEEDBACK_PARTS) feedbackBoxes[p].checked = DEFAULT_PARTS.includes(p);
    feedbackWindow.dataset.opened = 'yes';
    // The commands as they are now, to edit; none in exam mode.
    const exam = gameTerminal.exam;
    feedbackCommands.value = exam ? '' : transcript(ctx.recentSteps, t);
    feedbackCommands.hidden = exam || !feedbackCommands.value;
    feedbackCommandsNote.textContent = typo(t(exam ? 'feedback-commands-exam' : feedbackCommands.value ? 'feedback-commands-help' : 'feedback-commands-none'));
    feedbackBoxes.commands.disabled = exam;
    if (exam) feedbackBoxes.commands.checked = false;
    feedbackStatus.textContent = '';
    renderFeedback();
    feedbackWindow.showModal();
    feedbackMessage.focus();
  };
  feedbackWindow.addEventListener('input', (e) => {
    if (e.target !== feedbackPreview) renderFeedback();
  });
  feedbackWindow.addEventListener('change', renderFeedback);
  // Copy: the Clipboard API, or else the text selected for the player to copy.
  const selectPreview = () => {
    feedbackPreview.focus();
    feedbackPreview.select();
    feedbackStatus.textContent = typo(t('feedback-copy-selected'));
  };
  feedbackCopy.addEventListener('click', () => {
    if (!navigator.clipboard?.writeText) return selectPreview();
    navigator.clipboard.writeText(feedbackPreview.value).then(() => (feedbackStatus.textContent = t('feedback-copied')), selectPreview);
  });
  closeFeedback.addEventListener('click', () => feedbackWindow.close());
  // Back where the player was: the button that opened it (from the host page, the browser's own choice).
  feedbackWindow.addEventListener('close', () => {
    const back = feedbackOpener;
    feedbackOpener = null;
    if (back) setTimeout(() => back.focus());
  });

  return { window: feedbackWindow, show: showFeedback };
}
