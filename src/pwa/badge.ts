// The installed game's icon badge (App Badging API): the number of stories
// released since the last visit, plus one while the incident of the day is
// not solved. The game says what deserves it (a `qds-badge` event, see
// badgeUpdate in src/interface/whats-new.ts); only the site's own pages show it,
// and only when the game runs installed (display-mode: standalone): never
// in a browser tab, never in a page that embeds the game. The badge shows
// once the app is in the background, and goes when the player comes back:
// what it announced is in front of them. Feature-detected: browsers
// without the API (Firefox, Safari outside an installed web app) do nothing.
// No background check: see docs/ROADMAP.md ("What's new", Periodic
// Background Sync).
// Reference: https://developer.mozilla.org/en-US/docs/Web/API/Badging_API

interface BadgeNavigator {
  setAppBadge?: (count?: number) => Promise<void>;
  clearAppBadge?: () => Promise<void>;
  standalone?: boolean;
}

/** What the badge should show: nothing while the game is on screen, the count once hidden. */
export const badgeFor = (count: number, visible: boolean): number => (visible ? 0 : Math.max(0, Math.floor(count)));

export function wireBadge(doc: Document = document, nav: BadgeNavigator = navigator as Navigator & BadgeNavigator) {
  if (typeof nav.setAppBadge !== 'function' || typeof nav.clearAppBadge !== 'function') return;
  const installed = () => matchMedia('(display-mode: standalone)').matches || nav.standalone === true;
  let count = 0;
  const show = () => {
    if (!installed()) return;
    const n = badgeFor(count, doc.visibilityState === 'visible');
    (n ? nav.setAppBadge!(n) : nav.clearAppBadge!()).catch(() => {});
  };
  doc.addEventListener('qds-badge', (e) => {
    count = (e as CustomEvent<{ count: number }>).detail?.count ?? 0;
    show();
  });
  doc.addEventListener('visibilitychange', show);
}
