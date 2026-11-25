// When each story came out, and what is new since the player's last visit.
// One date per story (YYYY-MM-DD), written by hand when a story is added
// (tests/releases.test.ts fails while one is missing): the day it reached
// the repository's main branch. Stable and reproducible, unlike a date read
// from git at build time (a shallow clone has no history). The first
// stories' dates come from the repository's history on GitHub.
// Read by the Atom feeds of new stories (src/pages/<language>/feed.xml.ts,
// feed.ts) and by the menu's "New" badges (whatsNew below).

export const RELEASES: Readonly<Record<string, string>> = {
  eraser: '2026-10-18',
  datacenter: '2026-10-18',
  packet: '2026-10-18',
  'time-machine': '2026-10-18',
  archives: '2026-10-18',
  letters: '2026-10-18',
  fablab: '2026-10-18',
  gazette: '2026-10-18',
  'game-library': '2026-10-18',
  'on-call': '2026-10-18',
  'community-centre': '2026-10-19',
  coop: '2026-10-19',
  hive: '2026-10-19',
  audit: '2026-10-23',
  lab: '2026-10-24',
  watch: '2026-10-24',
  'junk-mail': '2026-10-30',
  fleet: '2026-10-30',
  patch: '2026-10-30',
  canteen: '2026-11-01',
  observatory: '2026-11-03',
  theatre: '2026-11-04',
  huts: '2026-11-05',
  'photo-club': '2026-11-05',
  bastion: '2026-11-16',
  'other-unix': '2026-11-16',
  'old-sun': '2026-11-16',
  'night-batch': '2026-11-17',
  'order-book': '2026-11-17',
  'mixed-fleet': '2026-11-17',
  'music-school': '2026-11-17',
  'card-catalogue': '2026-11-19',
  pantry: '2026-11-19',
  ferry: '2026-11-19',
  'bike-share': '2026-11-19',
  pool: '2026-11-19',
  'staff-room': '2026-11-21',
  airwaves: '2026-11-21',
  'tool-library': '2026-11-21',
  'health-centre': '2026-11-21',
  'blood-drive': '2026-11-22',
  choir: '2026-11-22',
  allotments: '2026-11-22',
  lifeboat: '2026-11-22',
  'climbing-wall': '2026-11-22',
  'dance-troupe': '2026-11-22',
  shelter: '2026-11-23',
  'language-cafe': '2026-11-24',
  'mapping-party': '2026-11-25',
  hostel: '2026-11-27',
};

/** The stories, newest first (the same day: the later in the game's order first). */
export function newestFirst(ids: readonly string[], releases: Readonly<Record<string, string>> = RELEASES): string[] {
  return ids
    .map((id, i) => ({ id, i }))
    .sort((a, b) => (releases[b.id] ?? '').localeCompare(releases[a.id] ?? '') || b.i - a.i)
    .map((x) => x.id);
}

// ——— What's new since the last visit ———

/**
 * What the browser remembers (KEY-whats-new, a setting of this browser,
 * not progress): the newest release date it has seen, and the stories
 * still marked "New" with the day they were first shown as such.
 */
export interface Seen {
  until?: string;
  fresh?: Record<string, string>;
}

// A story stays "New" this many days at most, opened or not.
export const FRESH_DAYS = 30;

const days = (a: string, b: string) => (Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000;

/**
 * The state at a visit on `today` (YYYY-MM-DD, given by the interface): a
 * first visit marks nothing (everything is new to a new player); later, the
 * stories released after the last date seen become "New" until opened, or
 * for FRESH_DAYS. Compares release dates with release dates, so a wrong
 * clock can only shorten or lengthen how long a badge stays.
 */
export function whatsNew(seen: Seen, today: string, releases: Readonly<Record<string, string>> = RELEASES): Required<Seen> {
  const dates = Object.values(releases);
  const newest = dates.reduce((a, b) => (b > a ? b : a), '');
  if (!seen.until) return { until: newest, fresh: {} };
  const fresh: Record<string, string> = {};
  for (const [id, since] of Object.entries(seen.fresh ?? {})) if (id in releases && !(days(since, today) > FRESH_DAYS)) fresh[id] = since;
  for (const [id, date] of Object.entries(releases)) if (date > seen.until && !(id in fresh)) fresh[id] = today;
  return { until: newest > seen.until ? newest : seen.until, fresh };
}

/** The state once a story was opened: no longer "New". */
export function markSeen(seen: Required<Seen>, id: string): Required<Seen> {
  if (!(id in seen.fresh)) return seen;
  const { [id]: _, ...fresh } = seen.fresh;
  return { ...seen, fresh };
}

/** What the browser kept, cleaned. */
export function readSeen(x: unknown): Seen {
  if (!x || typeof x !== 'object' || Array.isArray(x)) return {};
  const o = x as Record<string, unknown>;
  const day = (v: unknown): v is string => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);
  const fresh = o.fresh && typeof o.fresh === 'object' && !Array.isArray(o.fresh) ? Object.fromEntries(Object.entries(o.fresh).filter(([, v]) => day(v))) : {};
  return day(o.until) ? { until: o.until, fresh: fresh as Record<string, string> } : {};
}
