// What the terminal adds under an output: one-time tips (see tips.ts) and
// the error explainer (see explainer.ts). Never in exam mode, and each can
// be turned off in the settings.

import type { Shell } from '../engine/shell';
import { newMemory, newTips, type TipMemory } from '../engine/tips';
import { explain } from '../engine/explainer';
import { withoutColours } from '../engine/colours';
import type { Context } from './context';
import { el, uid } from './dom';

export function notesPart(ctx: Context) {
  const { t, typo, terminal: gameTerminal } = ctx;
  // What each session remembers for the tips.
  const tipMemories = new WeakMap<Shell, TipMemory>();

  // ——— Tips (see tips.ts): once each, never in exam mode, unless turned off ———
  function showTips(sh: Shell, before: string, said: boolean, tab: boolean) {
    if (!ctx.display.tips || gameTerminal.exam) return;
    let memory = tipMemories.get(sh);
    if (!memory) tipMemories.set(sh, (memory = newMemory()));
    for (const tip of newTips({ sh, before, tab, said }, memory, ctx.shownTips)) {
      ctx.shownTips.push(tip);
      ctx.output.appendChild(el('p', { class: 'tip', role: 'note' }, el('strong', {}, t('tip-label'), el('span', { class: 'visually-hidden' }, '.')), ' ', typo(t(`tip-${tip}`))));
    }
  }

  // ——— The error explainer (see explainer.ts): never in exam mode, unless turned off ———
  // Under the output of a line that failed with a message beginners often
  // misread, a button that unfolds a short explanation. The output (a log
  // read by screen readers) announces neither the button nor the
  // explanation: the button is added inside a part where announcements are
  // off, and the explanation is announced only when the player opens it.
  const explainedId = uid('qds-exam');
  let explanations = 0;
  function offerExplanation(sh: Shell, printed: string, failed: boolean, fresh: boolean) {
    if (!ctx.display.explainer || gameTerminal.exam) return;
    // The line's own error messages, those shown on the screen (not those sent to a file or /dev/null).
    const errors = fresh ? sh.last.errors.filter((e) => e && printed.includes(e)) : null;
    const found = explain({ failed, output: withoutColours(printed), errors }, t);
    if (!found) return;
    const id = `${explainedId}-explained-${++explanations}`;
    const text = el('div', { class: 'explanation', id, 'aria-live': 'polite', hidden: '' });
    const button = el('button', { type: 'button', class: 'explainer-button', 'aria-expanded': 'false', 'aria-controls': id }, t('explainer-button'));
    const block = el('div', { class: 'explainer', 'aria-live': 'off', 'data-explanation': found });
    // Added empty, then filled: nothing for the log to announce.
    ctx.output.appendChild(block);
    block.append(button, text);
    button.addEventListener('click', (e) => {
      const open = button.getAttribute('aria-expanded') !== 'true';
      button.setAttribute('aria-expanded', String(open));
      text.hidden = !open;
      // Filled when opened (announced then), emptied when closed.
      text.replaceChildren(...(open ? [el('strong', {}, t('explainer-label')), ' ', typo(t(`explainer-${found}`))] : []));
      // Opened at the bottom of the terminal: brought into view (without animation).
      if (open) text.scrollIntoView({ block: 'nearest' });
      // From the keyboard, the focus stays on the button (a click elsewhere in the terminal goes back to the command line).
      if (e.detail === 0) e.stopPropagation();
    });
  }

  return { showTips, offerExplanation };
}
