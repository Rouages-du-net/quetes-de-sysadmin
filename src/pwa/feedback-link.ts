// The footer's "Report a problem or an idea" (src/layouts/Base.astro): on a
// page with the game, it opens the game's dialog (the element's
// openFeedback(), see src/engine/feedback.ts); elsewhere, or without
// JavaScript, it leads to the game's page with #report, which opens it there.
// Nothing is sent: the dialog only shows a report for the player to send.

type Game = HTMLElement & { openFeedback?: () => void };
const TAG = 'quetes-de-sysadmin';
const game = () => document.querySelector<Game>(TAG);

export function wireReport() {
  for (const link of document.querySelectorAll<HTMLAnchorElement>('a[data-report]'))
    link.addEventListener('click', (e) => {
      const g = game();
      if (!g?.openFeedback) return;
      e.preventDefault();
      g.openFeedback();
    });
  if (location.hash !== '#report' || !game()) return;
  // Once: a reload or a shared link doesn't open it again.
  history.replaceState(history.state, '', location.pathname + location.search);
  customElements.whenDefined(TAG).then(() => game()?.openFeedback?.());
}
