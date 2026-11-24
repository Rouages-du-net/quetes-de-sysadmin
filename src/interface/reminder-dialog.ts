// The daily reminder (see reminder.ts in the engine): a calendar file made
// here and downloaded; the player's calendar app does the reminding. Its
// texts (dialog-reminder.ftl) load when the dialog first opens.

import { readTime, reminderIcs } from '../engine/reminder';
import type { Context } from './context';
import { downloadFile, el, uid } from './dom';

// Opened from the menu's button (game.ts), which gets the focus back. This
// module is a chunk of its own (lazy-dialog.ts).
export default function reminderDialog(ctx: Context, reminderButton: HTMLButtonElement) {
  const { t, lazy, display } = ctx;
  const reminderId = uid('qds-reminder');
  const reminderTime = el('input', { type: 'time', id: `${reminderId}-time`, required: '', value: '18:30' }) as HTMLInputElement;
  const reminderDownload = el('button', { type: 'button', class: 'button' }, lazy('dialog-reminder', 'reminder-download'));
  const reminderStatus = el('p', { class: 'map-legend', role: 'status' });
  const closeReminder = el('button', { type: 'button', class: 'button button-secondary' }, lazy('dialog-reminder', 'reminder-close'));
  const reminderWindow = el(
    'dialog',
    { class: 'reminder-window', 'aria-labelledby': reminderId },
    el('h2', { id: reminderId }, lazy('dialog-reminder', 'reminder-title')),
    el('p', { class: 'map-legend' }, lazy('dialog-reminder', 'reminder-intro', true)),
    el('p', { class: 'reminder-field' }, el('label', { for: reminderTime.id }, lazy('dialog-reminder', 'reminder-time')), ' ', reminderTime),
    el('p', { class: 'map-legend' }, lazy('dialog-reminder', 'reminder-floating', true)),
    el('p', { class: 'map-legend' }, lazy('dialog-reminder', 'reminder-private', true)),
    reminderStatus,
    el('p', { class: 'map-actions' }, closeReminder, ' ', reminderDownload),
  ) as HTMLDialogElement;

  const show = () => {
    reminderTime.value = readTime(display.reminder) ? display.reminder : '18:30';
    reminderStatus.textContent = '';
    reminderWindow.showModal();
  };
  reminderDownload.addEventListener('click', () => {
    const url = `https://sysadmin.rouages.net/${t.language}/`;
    const ics = reminderIcs({
      time: reminderTime.value,
      start: ctx.today(),
      now: new Date(),
      language: t.language,
      url,
      title: t('reminder-event-title'),
      description: t('reminder-event-description', { url }),
      alarm: t('reminder-event-alarm'),
    });
    if (!ics) {
      reminderStatus.textContent = t('reminder-invalid');
      reminderTime.focus();
      return;
    }
    // The time chosen, offered again next time (a setting of this browser).
    display.reminder = reminderTime.value;
    ctx.storeDisplay();
    downloadFile(ics, 'text/calendar', t('reminder-file'));
    reminderStatus.textContent = t('reminder-ready');
  });
  closeReminder.addEventListener('click', () => reminderWindow.close());
  reminderWindow.addEventListener('close', () => setTimeout(() => reminderButton.focus()));

  return { window: reminderWindow, show };
}
