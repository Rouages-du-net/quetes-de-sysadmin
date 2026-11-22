// The Progressive Web App at build time: once Astro has written dist/,
// this integration writes dist/sw.js from the template
// src/pwa/service-worker.js, with the list of files to precache and a
// version computed from their content (a new build = a new cache, and the
// old ones are deleted when the new service worker activates).
// Runs in Node, never in the browser; see docs/DEPLOYMENT.md.

import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { AstroIntegration } from 'astro';
import { pageFirstVisit } from './first-load.mjs';

// The languages of the site: each has its game page and its manifest.
export const LANGUAGES = ['en', 'fr'] as const;

// What an installed game needs to start offline, as URL paths: each
// language's page and manifest, the icons, and the files of each page's
// first visit (first-load.mjs: the game's scripts, its core texts, the
// styles) with the font (only its WOFF2 version, which every browser with
// service workers reads), and the dialogs' texts (texts-*--dialog-*: small,
// and a dialog must open offline). The stories and the manual's pages are
// not precached: the service worker keeps them when they are first loaded.
export function precacheList(dist: string): string[] {
  const paths: string[] = [];
  for (const lang of LANGUAGES) {
    if (existsSync(join(dist, lang, 'index.html'))) paths.push(`/${lang}/`);
    if (existsSync(join(dist, lang, 'manifest.webmanifest'))) paths.push(`/${lang}/manifest.webmanifest`);
  }
  if (existsSync(join(dist, 'favicon.svg'))) paths.push('/favicon.svg');
  const listed = (dir: string, prefix: string, keep: (name: string) => boolean) =>
    existsSync(join(dist, dir))
      ? readdirSync(join(dist, dir))
          .filter(keep)
          .sort()
          .map((name) => `${prefix}${name}`)
      : [];
  paths.push(...listed('icons', '/icons/', (name) => name.endsWith('.png')));
  const firstVisit = new Set(
    LANGUAGES.filter((lang) => existsSync(join(dist, lang, 'index.html'))).flatMap((lang) => pageFirstVisit(dist, lang, lang).map((f: string) => relative(join(dist, '_astro'), f))),
  );
  paths.push(...listed('_astro', '/_astro/', (name) => name.endsWith('.woff2') || firstVisit.has(name) || /^texts-[\w-]+--dialog-/.test(name)));
  return paths;
}

// Every file of Astro's (all hashed): the service worker keeps, from one
// version to the next, the stories it had cached that are still there (or
// their new version: same name, new hash).
export function assetList(dist: string): string[] {
  return existsSync(join(dist, '_astro'))
    ? readdirSync(join(dist, '_astro'))
        .filter((name) => !name.endsWith('.woff'))
        .sort()
        .map((name) => `/_astro/${name}`)
    : [];
}

// The file behind a precached path.
const fileOf = (dist: string, path: string) => join(dist, path.endsWith('/') ? `${path}index.html` : path);

// The build's version: a hash of the template and of every precached file.
export function buildId(dist: string, paths: string[], template: string): string {
  const hash = createHash('sha256').update(template);
  for (const path of paths) hash.update(path).update(readFileSync(fileOf(dist, path)));
  return hash.digest('hex').slice(0, 12);
}

// The service worker, from its template.
export function serviceWorker(template: string, id: string, paths: string[], assets: string[] = []): string {
  return template.replace('%BUILD_ID%', id).replace('/* %PRECACHE% */ []', JSON.stringify(paths)).replace('/* %ASSETS% */ []', JSON.stringify(assets));
}

const TEMPLATE = fileURLToPath(new URL('./service-worker.js', import.meta.url));

export function pwa(): AstroIntegration {
  return {
    name: 'sysadmin-quests-pwa',
    hooks: {
      'astro:build:done': ({ dir, logger }) => {
        const dist = fileURLToPath(dir);
        const template = readFileSync(TEMPLATE, 'utf8');
        const paths = precacheList(dist);
        const id = buildId(dist, paths, template);
        writeFileSync(join(dist, 'sw.js'), serviceWorker(template, id, paths, assetList(dist)));
        const bytes = paths.reduce((n, path) => n + readFileSync(fileOf(dist, path)).length, 0);
        logger.info(`sw.js written: version ${id}, ${paths.length} files precached (${Math.round(bytes / 1024)} KiB)`);
      },
    },
  };
}
