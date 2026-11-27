// Anonymous visit statistics, counted by the owner's own Umami server
// (https://umami.is), without loading its script: this module posts to
// Umami's tracking API itself. What is sent, and when: docs/DEPLOYMENT.md,
// "Statistics".
//
// Off unless the build was given an Umami server and a website id
// (PUBLIC_UMAMI_HOST and PUBLIC_UMAMI_SITE_ID or PUBLIC_UMAMI_EMBED_ID, read
// by Vite at build time: see .env.example). Without them (local development,
// a fork, the tests) the counters are null and nothing is ever sent.
// Nothing is sent either when the browser asks not to be tracked (Do Not
// Track, Global Privacy Control), nor in exam mode (the caller checks it).
// No cookie, no identifier kept in the browser: Umami counts visits from a
// hash of the request it rotates itself.
//
// The request is the one Umami's own tracker makes (src/tracker/index.js of
// umami-software/umami, `send` and `getPayload`): POST {host}/api/send, a
// JSON body { type: 'event', payload: { website, hostname, screen, language,
// title, url, referrer, name?, data? } }, Content-Type application/json; a
// payload without `name` is a page view, with one an event. See
// https://docs.umami.is/docs/api/sending-stats ("Sending stats").
// Two deliberate differences: the url is the path alone (no query string,
// no fragment), and the referrer only another site's origin.

export interface Counter {
  /** https://host/api/send */
  endpoint: string;
  /** Umami's website id. */
  website: string;
}

/** A counter, or null when the host or the id is missing or not an https URL. */
export function counterOf(host: unknown, website: unknown): Counter | null {
  if (typeof host !== 'string' || typeof website !== 'string' || !host.trim() || !website.trim()) return null;
  try {
    const url = new URL(host.trim());
    if (url.protocol !== 'https:') return null;
    return { endpoint: `${url.origin}/api/send`, website: website.trim() };
  } catch {
    return null;
  }
}

/** The site's pages (src/layouts/Base.astro, src/pwa/visit.ts) and the game on them. */
export const SITE_COUNTER = counterOf(import.meta.env.PUBLIC_UMAMI_HOST, import.meta.env.PUBLIC_UMAMI_SITE_ID);
/** The game embedded in another site (the build of vite.integration.config.ts). */
export const EMBED_COUNTER = counterOf(import.meta.env.PUBLIC_UMAMI_HOST, import.meta.env.PUBLIC_UMAMI_EMBED_ID);

/**
 * The counter of the <quetes-de-sysadmin> element (src/element.ts): on the
 * site's pages the site's (they count their own views), embedded in another
 * site the embeds' one, unless the page says stats="off".
 */
export function elementCounter(embedded: boolean, statsAttribute: string | null, site = SITE_COUNTER, embed = EMBED_COUNTER): Counter | null {
  if (!embedded) return site;
  return statsAttribute?.trim().toLowerCase() === 'off' ? null : embed;
}

/** What the sender reads of the browser (window, or a stand-in in the tests). */
export interface Browser {
  fetch: (url: string, init: RequestInit) => Promise<unknown>;
  navigator: { language?: string; doNotTrack?: string | null; globalPrivacyControl?: boolean };
  location: { hostname: string; pathname: string };
  document: { title: string; referrer: string };
  screen: { width: number; height: number };
}

const here = (): Browser | undefined => (typeof window === 'undefined' || typeof window.fetch !== 'function' ? undefined : (window as unknown as Browser));

/** The browser asks not to be tracked: Do Not Track or Global Privacy Control. */
export function declined(b: Browser): boolean {
  const n = b.navigator as Browser['navigator'] & { msDoNotTrack?: string };
  return n.doNotTrack === '1' || n.doNotTrack === 'yes' || n.msDoNotTrack === '1' || n.globalPrivacyControl === true;
}

/** Another site's origin, or nothing (the same site, no referrer, a bad URL). */
function referrerOf(b: Browser): string {
  try {
    const url = new URL(b.document.referrer);
    return url.hostname === b.location.hostname || !/^https?:$/.test(url.protocol) ? '' : `${url.origin}/`;
  } catch {
    return '';
  }
}

/** Umami's payload: a page view, or an event when it has a name. */
export function payload(counter: Counter, b: Browser, name?: string, data?: Record<string, string>) {
  return {
    website: counter.website,
    hostname: b.location.hostname,
    screen: `${b.screen.width}x${b.screen.height}`,
    language: b.navigator.language ?? '',
    title: encodeURIComponent(b.document.title),
    url: encodeURI(b.location.pathname),
    referrer: encodeURI(referrerOf(b)),
    ...(name ? { name } : {}),
    ...(data ? { data } : {}),
  };
}

/**
 * Counts a page view (no name) or an event. Never throws, never waits:
 * returns whether a request left. Nothing leaves without a counter, or when
 * the browser declines tracking.
 */
export function send(counter: Counter | null, name?: string, data?: Record<string, string>, b: Browser | undefined = here()): boolean {
  try {
    if (!counter || !b || declined(b)) return false;
    const init: RequestInit = {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'event', payload: payload(counter, b, name, data) }),
      credentials: 'omit',
      keepalive: true,
    };
    // A browser that refuses keepalive for a request with a preflight: once more without it.
    b.fetch(counter.endpoint, init).catch(() => b.fetch(counter.endpoint, { ...init, keepalive: false }).catch(() => {}));
    return true;
  } catch {
    return false;
  }
}

/** Exam mode saved by the game under this key (localStorage): then nothing is counted. */
export function savedExam(key = 'quetes-de-sysadmin'): boolean {
  try {
    return JSON.parse(localStorage.getItem(key) ?? '{}')?.exam === true;
  } catch {
    return false;
  }
}
