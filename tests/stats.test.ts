// The visit statistics (src/stats.ts, src/stats-build.ts): nothing leaves
// without a server and an id, nor when the browser declines tracking (Do
// Not Track, Global Privacy Control), nor in exam mode, nor from a page
// that says stats="off"; a page view and an event have Umami's payload; the
// build adds the server to the CSP only when there is one.
import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it } from 'vitest';
import { counterOf, declined, elementCounter, EMBED_COUNTER, payload, savedExam, send, SITE_COUNTER, type Browser } from '../src/stats';
import { statsOrigin, withStatsHost } from '../src/stats-build';

const COUNTER = counterOf('https://stats.example/', '11111111-2222-3333-4444-555555555555')!;

function browser(over: Partial<Browser['navigator']> = {}, referrer = '') {
  const calls: { url: string; init: RequestInit }[] = [];
  const b: Browser = {
    fetch: (url, init) => {
      calls.push({ url, init });
      return Promise.resolve({ ok: true });
    },
    navigator: { language: 'fr-FR', doNotTrack: null, ...over },
    location: { hostname: 'school.example', pathname: '/games/sysadmin/' },
    document: { title: 'Les quêtes', referrer },
    screen: { width: 1280, height: 800 },
  };
  return { b, calls };
}

describe('statistics', () => {
  it('are off without a server or an id (the tests, local builds, forks)', () => {
    expect(SITE_COUNTER).toBeNull();
    expect(EMBED_COUNTER).toBeNull();
    expect(counterOf(undefined, 'id')).toBeNull();
    expect(counterOf('https://stats.example', '')).toBeNull();
    expect(counterOf('', 'id')).toBeNull();
    expect(counterOf('http://stats.example', 'id')).toBeNull();
    expect(counterOf('not a url', 'id')).toBeNull();
    const { b, calls } = browser();
    expect(send(null, undefined, undefined, b)).toBe(false);
    expect(send(SITE_COUNTER, 'story-opened', { story: 'eraser' }, b)).toBe(false);
    expect(calls).toEqual([]);
  });

  it("post to the server's /api/send", () => {
    expect(COUNTER).toEqual({ endpoint: 'https://stats.example/api/send', website: '11111111-2222-3333-4444-555555555555' });
    expect(counterOf(' https://stats.example/umami/ ', ' id ')).toEqual({ endpoint: 'https://stats.example/api/send', website: 'id' });
  });

  it('send nothing when the browser declines tracking', () => {
    for (const over of [{ doNotTrack: '1' }, { doNotTrack: 'yes' }, { globalPrivacyControl: true }]) {
      const { b, calls } = browser(over);
      expect(declined(b)).toBe(true);
      expect(send(COUNTER, undefined, undefined, b)).toBe(false);
      expect(calls).toEqual([]);
    }
    expect(declined(browser({ doNotTrack: '0', globalPrivacyControl: false }).b)).toBe(false);
  });

  it("count a page view as Umami's tracker does, without cookies", async () => {
    const { b, calls } = browser({}, 'https://forum.example/thread/42?user=someone');
    expect(send(COUNTER, undefined, { language: 'fr' }, b)).toBe(true);
    expect(calls).toHaveLength(1);
    const [{ url, init }] = calls;
    expect(url).toBe('https://stats.example/api/send');
    expect(init).toMatchObject({ method: 'POST', credentials: 'omit', keepalive: true, headers: { 'Content-Type': 'application/json' } });
    expect(JSON.parse(String(init.body))).toEqual({
      type: 'event',
      payload: {
        website: COUNTER.website,
        hostname: 'school.example',
        screen: '1280x800',
        language: 'fr-FR',
        title: encodeURIComponent('Les quêtes'),
        url: '/games/sysadmin/',
        // Another site's origin only: not its path nor its query.
        referrer: 'https://forum.example/',
        data: { language: 'fr' },
      },
    });
  });

  it('count an event with its name and data', () => {
    const { b, calls } = browser({}, 'https://school.example/');
    send(COUNTER, 'chapter-finished', { story: 'eraser', chapter: 'awakening', language: 'en' }, b);
    const body = JSON.parse(String(calls[0].init.body));
    expect(body.type).toBe('event');
    expect(body.payload).toMatchObject({ name: 'chapter-finished', data: { story: 'eraser', chapter: 'awakening', language: 'en' }, referrer: '' });
    expect(payload(COUNTER, b)).not.toHaveProperty('name');
  });

  it('never throw nor wait: a failed request is dropped in silence', async () => {
    const { b } = browser();
    let attempts = 0;
    b.fetch = () => {
      attempts++;
      return Promise.reject(new TypeError('Failed to fetch'));
    };
    expect(send(COUNTER, 'story-opened', { story: 'eraser' }, b)).toBe(true);
    await new Promise((r) => setTimeout(r, 0));
    // Once more without keepalive, then nothing.
    expect(attempts).toBe(2);
    b.fetch = () => {
      throw new Error('blocked');
    };
    expect(send(COUNTER, undefined, undefined, b)).toBe(false);
  });

  it('pick the counter of the element: the site, an embed, or none with stats="off"', () => {
    const site = counterOf('https://stats.example', 'site')!;
    const embed = counterOf('https://stats.example', 'embed')!;
    expect(elementCounter(false, null, site, embed)).toBe(site);
    expect(elementCounter(false, 'off', site, embed)).toBe(site);
    expect(elementCounter(true, null, site, embed)).toBe(embed);
    expect(elementCounter(true, 'on', site, embed)).toBe(embed);
    expect(elementCounter(true, 'off', site, embed)).toBeNull();
    expect(elementCounter(true, ' OFF ', site, embed)).toBeNull();
    expect(elementCounter(true, null)).toBeNull();
  });

  describe('exam mode, as the game saved it', () => {
    const had = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
    const store = (items: Record<string, string>) =>
      Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { getItem: (k: string) => items[k] ?? null } });
    afterEach(() => {
      if (had) Object.defineProperty(globalThis, 'localStorage', had);
      else delete (globalThis as { localStorage?: unknown }).localStorage;
    });
    it('stops the page views', () => {
      store({ 'quetes-de-sysadmin': JSON.stringify({ exam: true }) });
      expect(savedExam()).toBe(true);
      store({ 'quetes-de-sysadmin': JSON.stringify({ exam: false }) });
      expect(savedExam()).toBe(false);
      store({ 'quetes-de-sysadmin': '{not json' });
      expect(savedExam()).toBe(false);
      store({});
      expect(savedExam()).toBe(false);
    });
  });

  it("add the server to the CSP's connect-src only when there is one", () => {
    const htaccess = `Header always set Content-Security-Policy "default-src 'self'; connect-src 'self'; manifest-src 'self'"\n`;
    expect(statsOrigin(undefined)).toBeNull();
    expect(statsOrigin('')).toBeNull();
    expect(withStatsHost(htaccess, null)).toBe(htaccess);
    const origin = statsOrigin('https://stats.example/some/path');
    expect(origin).toBe('https://stats.example');
    const out = withStatsHost(htaccess, origin);
    expect(out).toContain("connect-src 'self' https://stats.example; manifest-src 'self'");
    expect(withStatsHost(out, origin)).toBe(out);
    expect(() => statsOrigin('http://stats.example')).toThrow();
    expect(() => statsOrigin('stats.example')).toThrow();
    // The site's own policy, as the build changes it.
    const site = readFileSync('public/.htaccess', 'utf8');
    expect(site).toMatch(/connect-src 'self';/);
    expect(withStatsHost(site, 'https://stats.example')).toMatch(/Content-Security-Policy "[^"]*connect-src 'self' https:\/\/stats\.example;/);
  });
});
