// The installable game: what the footer offers, the manifests, and the
// service worker written after the build (src/pwa/).
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { installOffer, isIos } from '../src/pwa/install';
import { manifest } from '../src/pwa/manifest';
import { assetList, buildId, precacheList, serviceWorker } from '../src/pwa/build';

describe('Install the game (footer)', () => {
  it('offers the button only when the browser can install, the help on iOS, nothing once installed', () => {
    expect(installOffer({ standalone: false, prompt: true, ios: false })).toBe('button');
    expect(installOffer({ standalone: false, prompt: false, ios: false })).toBe('none');
    expect(installOffer({ standalone: false, prompt: false, ios: true })).toBe('ios-help');
    expect(installOffer({ standalone: true, prompt: true, ios: false })).toBe('none');
    expect(installOffer({ standalone: true, prompt: false, ios: true })).toBe('none');
  });

  it('recognises iPhones and iPads (iPadOS says it is a Mac with a touch screen)', () => {
    expect(isIos('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)', 'iPhone', 5)).toBe(true);
    expect(isIos('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', 'MacIntel', 5)).toBe(true);
    expect(isIos('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', 'MacIntel', 0)).toBe(false);
    expect(isIos('Mozilla/5.0 (Linux; Android 15)', 'Linux armv8l', 5)).toBe(false);
  });
});

describe('The web app manifests', () => {
  it('one per language, scoped to its pages, with any and maskable icons', () => {
    const m = manifest({ lang: 'fr', name: 'Quêtes de Sysadmin', shortName: 'Sysadmin', description: 'x' });
    expect(m).toMatchObject({ lang: 'fr', start_url: '/fr/', scope: '/fr/', id: '/fr/', display: 'standalone' });
    expect(m.icons.map((i) => `${i.sizes} ${i.purpose}`)).toEqual(['192x192 any', '512x512 any', '512x512 maskable']);
  });
});

describe('The service worker', () => {
  const fakeDist = () => {
    const dist = mkdtempSync(join(tmpdir(), 'qds-dist-'));
    for (const dir of ['en', 'fr', '_astro', 'icons', 'en/teachers']) mkdirSync(join(dist, dir), { recursive: true });
    writeFileSync(join(dist, 'en/index.html'), '<p>en</p>');
    writeFileSync(join(dist, 'fr/index.html'), '<p>fr</p>');
    writeFileSync(join(dist, 'en/teachers/index.html'), '<p>sheets</p>');
    writeFileSync(join(dist, 'en/manifest.webmanifest'), '{}');
    writeFileSync(join(dist, 'fr/manifest.webmanifest'), '{}');
    writeFileSync(join(dist, 'favicon.svg'), '<svg/>');
    writeFileSync(join(dist, 'icons/icon-192.png'), 'png');
    writeFileSync(join(dist, '_astro/game.abc.js'), 'import"./engine.ghi.js";');
    writeFileSync(join(dist, '_astro/engine.ghi.js'), 'engine');
    writeFileSync(join(dist, '_astro/texts-fr--core.jkl.js'), 'texts');
    writeFileSync(join(dist, '_astro/eraser.mno.js'), 'a story');
    writeFileSync(join(dist, '_astro/texts-en--manual.pqr.js'), 'the manual');
    writeFileSync(join(dist, '_astro/font.def.woff2'), 'woff2');
    writeFileSync(join(dist, '_astro/font.def.woff'), 'woff');
    return dist;
  };

  it('precaches each language\'s game, its manifest, the icons and its first visit\'s files (no WOFF, no other page, no story, no manual)', () => {
    expect(precacheList(fakeDist())).toEqual([
      '/en/',
      '/en/manifest.webmanifest',
      '/fr/',
      '/fr/manifest.webmanifest',
      '/favicon.svg',
      '/icons/icon-192.png',
      '/_astro/engine.ghi.js',
      '/_astro/font.def.woff2',
      '/_astro/game.abc.js',
      '/_astro/texts-fr--core.jkl.js',
    ]);
  });

  it('knows every hashed file of the build, to keep the stories it cached at runtime', () => {
    expect(assetList(fakeDist())).toContain('/_astro/eraser.mno.js');
    expect(assetList(fakeDist())).not.toContain('/_astro/font.def.woff');
  });

  it('a new version when a precached file changes, the same otherwise', () => {
    const dist = fakeDist();
    const paths = precacheList(dist);
    const before = buildId(dist, paths, 'template');
    expect(buildId(dist, paths, 'template')).toBe(before);
    writeFileSync(join(dist, 'en/index.html'), '<p>en, again</p>');
    expect(buildId(dist, paths, 'template')).not.toBe(before);
  });

  it('the template receives the version and the list', () => {
    const template = readFileSync('src/pwa/service-worker.js', 'utf8');
    const sw = serviceWorker(template, '0123456789ab', ['/en/', '/_astro/x.js'], ['/_astro/x.js', '/_astro/y.js']);
    expect(sw).toContain("const VERSION = '0123456789ab';");
    expect(sw).toContain('const PRECACHE = ["/en/","/_astro/x.js"];');
    expect(sw).toContain('const ASSETS = ["/_astro/x.js","/_astro/y.js"];');
    expect(sw).not.toMatch(/%BUILD_ID%|%PRECACHE%|%ASSETS%/);
  });
});
