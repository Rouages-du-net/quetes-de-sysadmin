// "Where do I start?" (see start-here.ts in the engine): a button of the
// menu, always there (hidden in exam mode), and on a first visit a card
// above the menu with the same questions: not a window, it blocks nothing.
// The questions themselves are a dialog of their own (start-here-dialog.ts).

import { complete, readAnswers } from '../engine/start-here';
import type { Context } from './context';
import { el, uid } from './dom';
import { lazyDialog } from './lazy-dialog';

export function startHerePart(ctx: Context) {
  const { t, typo, display, terminal: gameTerminal, options, finished } = ctx;
  const startHereButton = el('button', { type: 'button', class: 'start-here-button', 'aria-haspopup': 'dialog' }, t('start-here-button'));
  const startHereEntry = el('p', { class: 'start-here-entry' }, startHereButton);
  // On a first visit, the same questions offered by a card above the menu: not a window, it blocks nothing.
  const startOfferId = uid('qds-start-offer');
  const startOfferAnswer = el('button', { type: 'button', class: 'button', 'aria-haspopup': 'dialog' }, t('start-here-offer-answer'));
  const startOfferDismiss = el('button', { type: 'button', class: 'button button-secondary' }, t('start-here-offer-dismiss'));
  const startOffer = el(
    'section',
    { class: 'start-offer', 'aria-labelledby': startOfferId, hidden: '' },
    el('h2', { id: startOfferId }, t('start-here-offer-title')),
    el('p', {}, typo(t('start-here-offer-text'))),
    el('p', { class: 'start-offer-actions' }, startOfferAnswer, ' ', startOfferDismiss),
  );
  const dialog = lazyDialog(ctx, 'dialog-start-here', () => import('./start-here-dialog').then((m) => m.default));

  // The menu's button, hidden in exam mode (like the tour and the hints); the
  // first visit's card, until it is answered or dismissed, never in exam mode
  // nor when the host page opens a story of its choice. The answers are a
  // setting of this browser (display), not progress: neither the short code
  // nor the save file holds them.
  const startUpdate = () => {
    startHereEntry.hidden = gameTerminal.exam;
    startOffer.hidden = gameTerminal.exam || !!options.story || finished.length > 0 || display.startOffer === 'done' || complete(readAnswers(display.startHere));
  };
  const openStart = () => dialog.use((d) => d.show());
  startHereButton.addEventListener('click', openStart);
  startOfferAnswer.addEventListener('click', openStart);
  startOfferDismiss.addEventListener('click', () => {
    display.startOffer = 'done';
    ctx.applyDisplay();
    // The card goes: the focus goes to the menu's button, where the questions stay.
    startHereButton.focus();
  });

  /** Where the tour's last step points: the first visit's card, or the menu's button. */
  const tourTarget = () => (startOffer.hidden ? startHereButton : startOfferAnswer);

  return { startHereEntry, startOffer, startSlot: dialog.slot, startUpdate, tourTarget };
}
