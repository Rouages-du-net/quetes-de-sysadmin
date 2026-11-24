// The service worker of sysadmin.rouages.net (published as /sw.js, scope /).
// A template: at the end of `astro build`, the integration of
// src/pwa/build.ts replaces BUILD_ID and PRECACHE (see docs/DEPLOYMENT.md).
// It lets the installed game start and play offline: the game is 100 %
// static and the progress lives in localStorage, so the pages and their
// files are all it needs. Only the game's shell is precached (each page's
// first visit: src/pwa/first-load.mjs); a story, its texts and the manual's
// pages load when the player first needs them (story-registry.ts), and are
// kept then: a story opened online plays offline afterwards.
// Registered by src/pwa/site.ts on the site's own pages only, never by the
// embeddable element (a host page's origin is not ours to control).
// Reference: https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API

const VERSION = '%BUILD_ID%';
const PREFIX = 'qds-';
const CACHE = PREFIX + VERSION;
// The hashed files loaded later (stories, texts, the manual): kept from one
// version to the next, as long as the build still has them.
const RUNTIME = PREFIX + 'runtime';
// The game shell of each language, its manifest and icons, and the files of its first visit.
const PRECACHE = /* %PRECACHE% */ [];
// Every hashed file of this build (/_astro/).
const ASSETS = /* %ASSETS% */ [];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(PRECACHE.map((path) => new Request(path, { cache: 'reload' }))))
      .then(() => self.skipWaiting()),
  );
});

// A hashed file's name without its hash (eraser.BZmxN69s.js → eraser.js).
const stem = (path) => path.replace(/[.-][\w-]{8}(\.\w+)$/, '$1');

// The files kept at runtime that this build no longer has go; the new
// version of each (same name, new hash) is fetched in their place, so the
// stories already played stay playable offline (when online at the update).
function tidyRuntime() {
  const current = new Set(ASSETS);
  return caches.open(RUNTIME).then((cache) =>
    cache.keys().then((requests) => {
      const gone = requests.map((r) => new URL(r.url).pathname).filter((path) => !current.has(path));
      const stems = new Set(gone.map(stem));
      const fresh = ASSETS.filter((path) => stems.has(stem(path)) && !PRECACHE.includes(path));
      return Promise.all([
        ...gone.map((path) => cache.delete(path, MATCH)),
        ...fresh.map((path) => cache.add(path).catch(() => {})),
      ]);
    }),
  );
}

// The caches of earlier versions go (not the runtime one, tidied); this one takes the open pages.
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key.startsWith(PREFIX) && key !== CACHE && key !== RUNTIME).map((key) => caches.delete(key))))
      .then(tidyRuntime)
      .then(() => self.clients.claim()),
  );
});

// A response worth keeping: complete, from our origin, not a redirection
// (a redirected response can't answer a navigation).
const keepable = (response) => response && response.ok && response.type === 'basic' && !response.redirected;

const put = (request, response, name = CACHE) => {
  if (keepable(response)) {
    const copy = response.clone();
    caches.open(name).then((cache) => cache.put(request, copy));
  }
  return response;
};

// A server may add "Vary: Origin" (module scripts are fetched with an Origin
// header, the precache without): the cached copy is the same file all the same.
const MATCH = { ignoreVary: true };

// Astro's files carry a hash in their name: they never change. Those not
// precached (a story, its texts, the manual) go to the runtime cache.
const cacheFirst = (request) =>
  caches.match(request, MATCH).then((hit) => hit || fetch(request).then((response) => put(request, response, RUNTIME)));

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
        // The game's page in the page's language (/fr/, /es/…) if it was kept, otherwise in English.
        const home = /^\/[a-z]{2}(?:-[A-Za-z]+)?\//.exec(url.pathname)?.[0] ?? '/en/';
        return caches
          .match(home, MATCH)
          .then((page) => page || caches.match('/en/', MATCH))
          .then((page) => page || Response.error());
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
