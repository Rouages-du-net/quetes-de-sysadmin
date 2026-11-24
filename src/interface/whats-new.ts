// What's new since the last visit (see releases.ts): the menu's "New"
// badges, and the count the installed app shows on its icon.

import { CATALOGUE as STORIES } from '../engine/catalogue';
import { markSeen, readSeen, whatsNew, type Seen } from '../engine/releases';
import type { Context } from './context';

export function whatsNewPart(ctx: Context, storiesBoutons: HTMLButtonElement[], incident: () => string | null) {
  // A setting of this browser (KEY-whats-new), not progress: the newest
  // release seen, and the stories marked "New" until opened.
  const SEEN_KEY = `${ctx.KEY}-whats-new`;
  let seen: Required<Seen> = { until: '', fresh: {} };
  try {
    seen = whatsNew(readSeen(JSON.parse(localStorage.getItem(SEEN_KEY) ?? '{}')), ctx.today());
    localStorage.setItem(SEEN_KEY, JSON.stringify(seen));
  } catch {}
  const freshUpdate = () => {
    storiesBoutons.forEach((b, h) => {
      (b.querySelector('.new-badge') as HTMLElement).hidden = !(STORIES[h].id in seen.fresh);
    });
  };
  // A story opened: no longer new.
  const storySeen = (h: number) => {
    if (!(STORIES[h].id in seen.fresh)) return;
    seen = markSeen(seen, STORIES[h].id);
    try {
      localStorage.setItem(SEEN_KEY, JSON.stringify(seen));
    } catch {}
    freshUpdate();
    badgeUpdate();
  };
  // What would deserve the installed app's badge (src/pwa/site.ts shows it, never the
  // embedded game): the new stories, and today's incident not solved yet. An event
  // from the game, which a host page may ignore.
  let badgeSent = -1;
  const badgeUpdate = () => {
    const count = Object.keys(seen.fresh).length + (incident() && !ctx.results[ctx.today()] ? 1 : 0);
    if (count === badgeSent) return;
    badgeSent = count;
    ctx.game.dispatchEvent(new CustomEvent('qds-badge', { bubbles: true, composed: true, detail: { count } }));
  };
  return { freshUpdate, storySeen, badgeUpdate };
}
