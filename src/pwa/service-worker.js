// The service worker of sysadmin.rouages.net (published as /sw.js, scope /).
// A template: at the end of `astro build`, the integration of
// src/pwa/build.ts replaces BUILD_ID and PRECACHE (see docs/DEPLOYMENT.md).
// It lets the installed game start and play offline: the game is 100 %
// static and the progress lives in localStorage, so the pages and their
// files are all it needs.
// Registered by src/pwa/site.ts on the site's own pages only, never by the
// embeddable element (a host page's origin is not ours to control).
// Reference: https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API

const VERSION = '%BUILD_ID%';
const PREFIX = 'qds-';
const CACHE = PREFIX + VERSION;
// The game shell of each language, its manifest and icons, and Astro's files.
const PRECACHE = /* %PRECACHE% */ [];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(PRECACHE.map((path) => new Request(path, { cache: 'reload' }))))
      .then(() => self.skipWaiting()),
  );
});

// The caches of earlier versions go; this one takes the open pages.
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key.startsWith(PREFIX) && key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

// A response worth keeping: complete, from our origin, not a redirection
// (a redirected response can't answer a navigation).
const keepable = (response) => response && response.ok && response.type === 'basic' && !response.redirected;

const put = (request, response) => {
  if (keepable(response)) {
    const copy = response.clone();
    caches.open(CACHE).then((cache) => cache.put(request, copy));
  }
  return response;
};

// A server may add "Vary: Origin" (module scripts are fetched with an Origin
// header, the precache without): the cached copy is the same file all the same.
const MATCH = { ignoreVary: true };

// Astro's files carry a hash in their name: they never change.
const cacheFirst = (request) =>
  caches.match(request, MATCH).then((hit) => hit || fetch(request).then((response) => put(request, response)));

// Pages and the other files: the network first, so a new version shows at
// once; the cache when offline. A page never visited falls back to the game
// in its language.
const networkFirst = (request, url) =>
  fetch(request)
    .then((response) => put(request, response))
    .catch(() =>
      caches.match(request, { ...MATCH, ignoreSearch: true }).then((hit) => {
        if (hit) return hit;
        if (request.mode !== 'navigate') return Response.error();
        return caches.match(url.pathname.startsWith('/fr/') ? '/fr/' : '/en/', MATCH).then((home) => home || Response.error());
      }),
    );

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  // Nothing from another origin, and not the file other sites embed.
  if (url.origin !== self.location.origin || url.pathname.startsWith('/integration/') || url.pathname === '/sw.js') return;
  event.respondWith(url.pathname.startsWith('/_astro/') ? cacheFirst(request) : networkFirst(request, url));
});
