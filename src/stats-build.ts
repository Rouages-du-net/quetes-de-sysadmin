// The statistics server in the site's security policy (CSP), at build time:
// once Astro has written dist/, this integration adds the Umami server of
// PUBLIC_UMAMI_HOST to connect-src in dist/.htaccess, so that the pages may
// post to it (src/stats.ts). Without the variable, the policy stays
// `connect-src 'self'`, as in public/.htaccess. Runs in Node, never in the
// browser; see docs/DEPLOYMENT.md, "Statistics".

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { AstroIntegration } from 'astro';
import { loadEnv } from 'vite';

/** The server's origin (https only), or null when none is set; throws on a value that isn't one. */
export function statsOrigin(host: string | undefined): string | null {
  if (!host?.trim()) return null;
  const url = new URL(host.trim());
  if (url.protocol !== 'https:') throw new Error(`PUBLIC_UMAMI_HOST must be an https:// address, not ${host}`);
  return url.origin;
}

/** The .htaccess with the server added to connect-src (unchanged without one). */
export function withStatsHost(htaccess: string, origin: string | null): string {
  if (!origin) return htaccess;
  const policy = /(Content-Security-Policy "[^"]*connect-src 'self')([^;"]*)/;
  if (!policy.test(htaccess)) throw new Error(".htaccess: no connect-src 'self' in the Content-Security-Policy");
  return htaccess.replace(policy, (_, start: string, rest: string) => (rest.includes(origin) ? `${start}${rest}` : `${start} ${origin}${rest}`));
}

export function statsCsp(): AstroIntegration {
  return {
    name: 'sysadmin-quests-stats-csp',
    hooks: {
      'astro:build:done': ({ dir, logger }) => {
        const file = join(fileURLToPath(dir), '.htaccess');
        const origin = statsOrigin(loadEnv('production', process.cwd(), 'PUBLIC_').PUBLIC_UMAMI_HOST);
        if (!origin || !existsSync(file)) {
          logger.info('statistics: off (no PUBLIC_UMAMI_HOST)');
          return;
        }
        writeFileSync(file, withStatsHost(readFileSync(file, 'utf8'), origin));
        logger.info(`statistics: ${origin} allowed in .htaccess's connect-src`);
      },
    },
  };
}
