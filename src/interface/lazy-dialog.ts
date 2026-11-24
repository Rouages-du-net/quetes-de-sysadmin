// A dialog the player rarely opens ("Where do I start?", "Report a problem
// or an idea", the daily reminder, a chapter's summary) is a chunk of its
// own, a module named *-dialog.ts: its code loads when it first opens, side
// by side with its texts (dialog-*.ftl, see src/texts/plugin.mjs), and it
// takes its place in the game, held until then by an empty comment. The
// service worker precaches these chunks (src/pwa/build.ts), so they open
// offline too.

import { loadTexts, textsLoaded } from '../texts';
import type { Context } from './context';

export interface Dialog {
  window: HTMLDialogElement;
}

/** group: the dialog's texts (null: its texts are in the core). */
export function lazyDialog<D extends Dialog>(ctx: Context, group: string | null, load: () => Promise<(ctx: Context) => D>) {
  const slot = document.createComment('');
  let built: D | null = null;
  const ready = (then: (dialog: D) => void) => (group ? ctx.withTexts(group, () => then(built!)) : then(built!));
  /** Runs `then` once the dialog is built and its texts are there. */
  const use = (then: (dialog: D) => void) => {
    if (built) return ready(then);
    Promise.all([load(), !group || textsLoaded(ctx.t.language, group) ? null : loadTexts(ctx.t.language, group)]).then(
      ([make]) => {
        if (!built) {
          built = make(ctx);
          slot.replaceWith(built.window);
        }
        ready(then);
      },
      () => ctx.announce(ctx.t('loading-failed')),
    );
  };
  return { slot, use, built: () => built };
}
