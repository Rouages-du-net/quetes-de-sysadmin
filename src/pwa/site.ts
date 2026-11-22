// The Progressive Web App on the site's own pages (imported by
// src/layouts/Base.astro): the service worker that lets the installed game
// play offline, and the footer's "Install the game".
// Never imported by the embeddable element (src/element.ts): a page that
// embeds the game keeps its own origin, and its own service workers.

import { wireInstall } from './install';

export function registerServiceWorker() {
  // Only the built site has /sw.js (written by src/pwa/build.ts), not `astro dev`.
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return;
  const register = () => navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => {});
  if (document.readyState === 'complete') register();
  else addEventListener('load', register, { once: true });
}

registerServiceWorker();
wireInstall();
