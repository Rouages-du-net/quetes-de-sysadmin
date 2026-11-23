// The on-call streak: the consecutive days on which the player solved the
// incident of the day (see on-call.ts). Kind on purpose: one missed day a
// week is a rest day and doesn't break it, and an unsolved today never does
// (the day isn't over). No guilt: the interface only ever says "keep it
// going", never "you lost it".
// Days are calendar dates (YYYY-MM-DD) in the player's local time zone,
// computed by the interface from its clock (localDate): the engine never
// reads the time. Counting on calendar dates, not on milliseconds, makes a
// 23- or 25-hour day (daylight saving time) one day like any other.

/** A date's day in the player's time zone: YYYY-MM-DD (the interface passes its Date). */
export function localDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const ISO = /^(\d{4})-(\d{2})-(\d{2})$/;

/** A calendar date's day number (days since 1970-01-01), or null if it isn't one. */
export function dayNumber(date: string): number | null {
  const m = ISO.exec(date);
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const ms = Date.UTC(y, mo - 1, d);
  const back = new Date(ms);
  // 2026-02-30 is not a date.
  if (back.getUTCFullYear() !== y || back.getUTCMonth() !== mo - 1 || back.getUTCDate() !== d) return null;
  return ms / 86_400_000;
}

const dateOf = (n: number) => new Date(n * 86_400_000).toISOString().slice(0, 10);

// At most one rest day in any seven consecutive days.
export const REST_EVERY = 7;

export interface Streak {
  /** Solved days in the current streak (0: none going). */
  current: number;
  /** The longest streak ever, in solved days. */
  best: number;
  /** Today's incident is solved. */
  today: boolean;
  /** The rest days the current streak has used (missed days that didn't break it). */
  rests: string[];
  /** Missing today would still be forgiven (a rest day is available). */
  restReady: boolean;
}

/**
 * The streak from the days whose incident was solved, on `today`. A date
 * after today (the clock was set back since) is ignored until its day
 * comes; dates that aren't calendar dates are ignored.
 */
export function streak(solved: Iterable<string>, today: string): Streak {
  const now = dayNumber(today);
  const none: Streak = { current: 0, best: 0, today: false, rests: [], restReady: true };
  if (now === null) return none;
  const days = [...new Set([...solved].map(dayNumber).filter((n): n is number => n !== null && n <= now))].sort((a, b) => a - b);
  let run = 0;
  let best = 0;
  let lastRest = -Infinity;
  let rests: number[] = [];
  let previous: number | null = null;
  for (const d of days) {
    const gap = previous === null ? Infinity : d - previous;
    if (gap === 1) run++;
    else if (gap === 2 && previous! + 1 - lastRest >= REST_EVERY) {
      lastRest = previous! + 1;
      rests.push(lastRest);
      run++;
    } else {
      run = 1;
      lastRest = -Infinity;
      rests = [];
    }
    best = Math.max(best, run);
    previous = d;
  }
  if (previous === null) return none;
  const gap = now - previous;
  // Yesterday missed: forgiven as a rest day if one is available.
  const yesterdayRest = gap === 2 && now - 1 - lastRest >= REST_EVERY;
  if (yesterdayRest) {
    lastRest = now - 1;
    rests.push(lastRest);
  }
  const alive = gap <= 1 || yesterdayRest;
  return {
    current: alive ? run : 0,
    best,
    today: gap === 0,
    rests: alive ? rests.map(dateOf) : [],
    restReady: !alive || now - lastRest >= REST_EVERY,
  };
}
