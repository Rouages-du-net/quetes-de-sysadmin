// The Progressive Web App at build time: once Astro has written dist/,
// this integration writes dist/sw.js from the template
// src/pwa/service-worker.js, with the list of files to precache and a
// version computed from their content (a new build = a new cache, and the
// old ones are deleted when the new service worker activates).
// Runs in Node, never in the browser; see docs/DEPLOYMENT.md.

import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { AstroIntegration } from 'astro';

// The languages of the site: each has its game page and its manifest.
export const LANGUAGES = ['en', 'fr'] as const;

// What an installed game needs to start offline, as URL paths: each
// language's page and manifest, the icons, and Astro's files (the game's
// script, its styles, the font; only the WOFF2 version of the font, which
// every browser with service workers reads).
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
  paths.push(...listed('_astro', '/_astro/', (name) => !name.endsWith('.woff')));
  return paths;
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
export function serviceWorker(template: string, id: string, paths: string[]): string {
  return template.replace('%BUILD_ID%', id).replace('/* %PRECACHE% */ []', JSON.stringify(paths));
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
        writeFileSync(join(dist, 'sw.js'), serviceWorker(template, id, paths));
        logger.info(`sw.js written: version ${id}, ${paths.length} files precached`);
      },
    },
  };
}
