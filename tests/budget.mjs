// The weight of a first visit, checked after each build (npm run build):
// the JavaScript and CSS a browser fetches before the terminal answers, on
// the home pages and for the embeddable file (what counts:
// src/pwa/first-load.mjs). Fails when it goes over the budget (see
// docs/DEPLOYMENT.md, "Chunks and budget").
//
//   node tests/budget.mjs                  check dist/ against the budget
//   node tests/budget.mjs --report DIR     only print the table for DIR
//   node tests/budget.mjs --files          list the files too

import { readFileSync } from 'node:fs';
import { relative } from 'node:path';
import { gzipSync, brotliCompressSync } from 'node:zlib';
import { embedFirstVisit, pageFirstVisit } from '../src/pwa/first-load.mjs';

// Gzip bytes (what mod_deflate sends), about 15 % over the size measured
// when the budget was set (455, 459 and 482 KiB, once the engine's families,
// openssl, docker, Apache, Postfix, PostgreSQL, Samba, the disks' tools and
// the auditor's among them, the manual's examples, the chapters' summaries
// and English's core for another language left the first visit); raise it
// on purpose, not by habit.
// Spanish, a draft (src/texts/languages.json), fetches English's core with
// its own: the same 15 % over what it weighed when it was added.
const BUDGET = { '/en/': 536_000, '/fr/': 541_000, '/es/': 600_000, embed: 568_000 };

const report = process.argv.includes('--report');
const dist = report ? process.argv[process.argv.indexOf('--report') + 1] : 'dist';

const kb = (n) => `${(n / 1024).toFixed(0)} KiB`;
const rows = [];
let failed = false;
for (const [name, files] of [
  ['/en/', pageFirstVisit(dist, 'en', 'en')],
  ['/fr/', pageFirstVisit(dist, 'fr', 'fr')],
  ['/es/', pageFirstVisit(dist, 'es', 'es', true)],
  ['embed', embedFirstVisit(dist)],
]) {
  const content = files.map((f) => readFileSync(f));
  const raw = content.reduce((n, c) => n + c.length, 0);
  const gzip = content.reduce((n, c) => n + gzipSync(c, { level: 6 }).length, 0);
  const brotli = content.reduce((n, c) => n + brotliCompressSync(c).length, 0);
  const over = !report && gzip > BUDGET[name];
  failed ||= over;
  rows.push(
    `${name.padEnd(6)} ${String(files.length).padStart(3)} files  raw ${kb(raw).padStart(9)}  gzip ${kb(gzip).padStart(8)}  brotli ${kb(brotli).padStart(8)}${report ? '' : `  budget ${kb(BUDGET[name])}${over ? '  OVER BUDGET' : ''}`}`,
  );
  if (process.argv.includes('--files')) for (const f of files) rows.push(`         ${relative(dist, f)}`);
}
console.log(`First visit (JS + CSS before the terminal answers), ${dist}:\n${rows.join('\n')}`);
if (failed) {
  console.error('\nThe first visit is over budget: load the new code lazily (a story module, an engine family, a text group), or raise BUDGET in tests/budget.mjs on purpose.');
  process.exit(1);
}
