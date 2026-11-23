// The files of a first visit: what a browser fetches before the terminal
// answers. Read from a build (dist/), in Node: by tests/budget.mjs (the
// budget of a first visit) and src/pwa/build.ts (what the service worker
// precaches). See docs/DEPLOYMENT.md, "Chunks and budget".
//
// What counts: the page's scripts and styles, the modules they import
// statically, and what the element fetches at once (src/element.ts): the
// game (game-*.js, game.*.js and its imports), the core texts of the page's
// language, and every language's shared texts. Not counted: what loads once
// the terminal is ready or later (src/texts/index.ts, src/interface/game.ts):
// English's core for another language (the fallback), the chapters'
// summaries, the manual's pages, the stories and the engine families they
// bring (src/engine/families.ts).

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';

// A static import or re-export in a built module (minified or not); not import().
const STATIC = /(?:^|[;}\s)])(?:import|export)\s*(?:[\w$*{}\s,]+from\s*)?["']([^"']+\.(?:js|css))["']/g;

/** These files and every module they import statically (absolute paths on disk). */
export function closure(start, dist) {
  const seen = new Set();
  const stack = [...start];
  while (stack.length) {
    const f = stack.pop();
    if (seen.has(f) || !existsSync(f)) continue;
    seen.add(f);
    if (!f.endsWith('.js')) continue;
    for (const m of readFileSync(f, 'utf8').matchAll(STATIC)) stack.push(m[1].startsWith('/') ? join(dist, m[1]) : join(dirname(f), m[1]));
  }
  return [...seen];
}

/** The chunks the element fetches at once, in a directory of chunks. */
export function elementChunks(dir, language) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith('.js'))
    .filter((f) => /^game[.-]/.test(f) || new RegExp(`^texts-${language}--core[.-]`).test(f) || /^texts-.+--shared[.-]/.test(f))
    .sort()
    .map((f) => join(dir, f));
}

/** A site page's first visit (path like "en"), its files on disk. */
export function pageFirstVisit(dist, path, language) {
  const html = readFileSync(join(dist, path, 'index.html'), 'utf8');
  const refs = [...html.matchAll(/<(?:script[^>]*src|link[^>]*rel="stylesheet"[^>]*href)="([^"]+)"/g)].map((m) => join(dist, m[1]));
  return closure([...refs, ...elementChunks(join(dist, '_astro'), language)], dist);
}

/** The embeddable file's first visit (in English, the language without a page to say otherwise). */
export function embedFirstVisit(dist) {
  const dir = join(dist, 'integration');
  return closure([join(dir, 'quetes-de-sysadmin.js'), ...elementChunks(join(dir, 'chunks'), 'en')], dist);
}
