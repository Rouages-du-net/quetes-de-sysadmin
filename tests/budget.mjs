// The weight of a first visit, checked after each build (npm run build):
// the JavaScript and CSS a browser fetches before the terminal answers, on
// the home pages and for the embeddable file. Fails when it goes over the
// budget (see docs/DEPLOYMENT.md, "Chunks and budget").
//
// What counts: the page's scripts and styles, the modules they import
// statically, and what the element fetches at once (element.ts): the game
// (game-*.js and its imports) and the core texts of the page's language,
// English's (the fallback) and every language's shared texts. Not counted:
// stories and the manual's pages, which load later (story-registry.ts,
// src/texts/index.ts).
//
//   node tests/budget.mjs                 check dist/ against the budget
//   node tests/budget.mjs --report DIR    only print the table for DIR

import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname, posix } from 'node:path';
import { gzipSync, brotliCompressSync } from 'node:zlib';

// Gzip bytes (what mod_deflate sends), with about 15 % of margin over the
// size measured when the budget was set; raise it on purpose, not by habit.
const BUDGET = { '/en/': 960_000, '/fr/': 1_040_000, embed: 1_040_000 };

const report = process.argv.includes('--report');
const dist = report ? process.argv[process.argv.indexOf('--report') + 1] : 'dist';

const STATIC = /(?:^|[;}\s)])(?:import|export)\s*(?:[\w$*{}\s,]+from\s*)?["']([^"']+\.(?:js|css))["']/g;

function closure(start, root) {
  const seen = new Set();
  const stack = [...start];
  while (stack.length) {
    const f = stack.pop();
    if (seen.has(f) || !existsSync(f)) continue;
    seen.add(f);
    if (!f.endsWith('.js')) continue;
    for (const m of readFileSync(f, 'utf8').matchAll(STATIC)) {
      const target = m[1].startsWith('/') ? join(root, m[1]) : join(dirname(f), m[1]);
      stack.push(target);
    }
  }
  return [...seen];
}

// What the element fetches at once: the game and the core texts.
const firstLoad = (dir, language) =>
  existsSync(dir)
    ? readdirSync(dir)
        .filter((f) => f.endsWith('.js'))
        .filter((f) => /^game[.-]/.test(f) || new RegExp(`^texts-(${language}|en)--core[.-]`).test(f) || /^texts-.+--shared[.-]/.test(f))
        .map((f) => join(dir, f))
    : [];

function page(path, language) {
  const html = readFileSync(join(dist, path, 'index.html'), 'utf8');
  const refs = [...html.matchAll(/<(?:script[^>]*src|link[^>]*rel="stylesheet"[^>]*href)="([^"]+)"/g)].map((m) => join(dist, m[1]));
  return closure([...refs, ...firstLoad(join(dist, '_astro'), language)], dist);
}

function embed() {
  const dir = join(dist, 'integration');
  return closure([join(dir, 'quetes-de-sysadmin.js'), ...firstLoad(join(dir, 'chunks'), 'en')], dist);
}

const kb = (n) => `${(n / 1024).toFixed(0)} KiB`;
const rows = [];
let failed = false;
for (const [name, files] of [
  ['/en/', page('en', 'en')],
  ['/fr/', page('fr', 'fr')],
  ['embed', embed()],
]) {
  const content = files.map((f) => readFileSync(f));
  const raw = content.reduce((n, c) => n + c.length, 0);
  const gzip = content.reduce((n, c) => n + gzipSync(c, { level: 6 }).length, 0);
  const brotli = content.reduce((n, c) => n + brotliCompressSync(c).length, 0);
  const over = !report && gzip > BUDGET[name];
  failed ||= over;
  rows.push(`${name.padEnd(6)} ${String(files.length).padStart(3)} files  raw ${kb(raw).padStart(9)}  gzip ${kb(gzip).padStart(8)}  brotli ${kb(brotli).padStart(8)}${report ? '' : `  budget ${kb(BUDGET[name])}${over ? '  OVER BUDGET' : ''}`}`);
  if (process.argv.includes('--files')) for (const f of files) rows.push(`         ${posix.normalize(f)}`);
}
console.log(`First visit (JS + CSS before the terminal answers), ${dist}:\n${rows.join('\n')}`);
if (failed) {
  console.error('\nThe first visit is over budget: load the new code lazily (a story module, a text group), or raise BUDGET in tests/budget.mjs on purpose.');
  process.exit(1);
}
