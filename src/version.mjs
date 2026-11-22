// The game's version, written into the code at build time (Vite's `define`,
// as __QDS_VERSION__): package.json's version, then the commit it was built
// from and that commit's date, e.g. "0.1.0+808f721 2026-11-22". The same
// commit always gives the same text (no build clock). Without git (an
// archive of the sources), only package.json's version. Shown by the
// feedback dialog (src/engine/feedback.ts), so a report says which build it
// comes from. Used by astro.config.mjs, vite.integration.config.ts and
// vitest.config.ts; runs in Node, never in the browser.

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export function buildVersion() {
  const { version } = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
  try {
    const [hash, date] = execFileSync('git', ['log', '-1', '--format=%h %cs'], {
      cwd: fileURLToPath(new URL('..', import.meta.url)),
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    })
      .trim()
      .split(' ');
    return hash && date ? `${version}+${hash} ${date}` : version;
  } catch {
    return version;
  }
}

/** Vite's `define` for the version (a JSON string literal). */
export const versionDefine = () => ({ __QDS_VERSION__: JSON.stringify(buildVersion()) });
