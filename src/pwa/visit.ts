// The site's own page views (imported by src/pwa/site.ts, so by every page
// of src/layouts/Base.astro): one view per page, with its language, and
// "app-opened" when the installed game is launched (display-mode
// standalone, arriving from no page of the site). Sent by src/stats.ts to
// the site's counter, only when the build has one; never in exam mode.
// What is sent: docs/DEPLOYMENT.md, "Statistics".

import { savedExam, send, SITE_COUNTER } from '../stats';

export function countVisit() {
  if (!SITE_COUNTER || savedExam()) return;
  const language = document.documentElement.lang || 'en';
  send(SITE_COUNTER, undefined, { language });
  let fromSite = false;
  try {
    fromSite = new URL(document.referrer).origin === location.origin;
  } catch {}
  const standalone = matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
  if (standalone && !fromSite) send(SITE_COUNTER, 'app-opened', { language });
}
