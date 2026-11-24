// The intro tour of a first visit: a few bubbles pointing at the real
// interface (seen again from the settings). Never in exam mode.

import type { Context } from './context';
import { el, uid } from './dom';

export function tourPart(ctx: Context, steps: [() => HTMLElement, string][]) {
  const { t, typo, game } = ctx;
  const tourId = uid('qds-tour');
  const tourCount = el('span', { class: 'tour-count' });
  const tourText = el('p', { class: 'tour-text' });
  const tourSkip = el('button', { type: 'button', class: 'link' }, t('tour-skip'));
  const tourNext = el('button', { type: 'button', class: 'button primary' }, t('tour-next'));
  const tourBox = el(
    'div',
    { class: 'tour', role: 'dialog', 'aria-modal': 'false', 'aria-labelledby': tourId, hidden: '' },
    el('p', { class: 'tour-head' }, el('strong', { id: tourId }, t('tour-label')), ' ', tourCount),
    tourText,
    el('p', { class: 'tour-actions' }, tourSkip, tourNext),
  );
  game.append(tourBox);
  let tourStep = -1;
  let tourTarget: HTMLElement | null = null;
  const placeTour = () => {
    if (tourStep < 0 || !tourTarget) return;
    const r = tourTarget.getBoundingClientRect();
    const g = game.getBoundingClientRect();
    const width = Math.min(22 * 16, g.width);
    tourBox.style.width = `${width}px`;
    tourBox.style.top = `${r.bottom - g.top + 8}px`;
    tourBox.style.left = `${Math.max(0, Math.min(r.left - g.left, g.width - width))}px`;
  };
  const endTour = () => {
    tourTarget?.classList.remove('tour-target');
    tourTarget = null;
    tourStep = -1;
    tourBox.hidden = true;
    ctx.display.tour = 'done';
    ctx.applyDisplay();
    ctx.input.focus();
  };
  const showTourStep = () => {
    tourTarget?.classList.remove('tour-target');
    const [target, text] = steps[tourStep];
    tourTarget = target();
    tourTarget.classList.add('tour-target');
    tourCount.textContent = t('tour-step', { step: tourStep + 1, total: steps.length });
    tourText.replaceChildren(typo(t(text)));
    tourNext.textContent = t(tourStep === steps.length - 1 ? 'tour-done' : 'tour-next');
    tourBox.hidden = false;
    placeTour();
    tourTarget.scrollIntoView({ block: 'center' });
    tourBox.scrollIntoView({ block: 'nearest' });
    tourNext.focus();
  };
  const startTour = () => {
    if (ctx.terminal.exam) return;
    tourStep = 0;
    showTourStep();
  };
  tourNext.addEventListener('click', () => {
    if (++tourStep >= steps.length) endTour();
    else showTourStep();
  });
  tourSkip.addEventListener('click', endTour);
  tourBox.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      endTour();
    }
  });
  if (typeof ResizeObserver !== 'undefined') new ResizeObserver(placeTour).observe(game);

  return { startTour };
}
