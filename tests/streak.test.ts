// The on-call streak (src/engine/streak.ts): consecutive days, a rest day a
// week, the local calendar day (daylight saving time), a clock set back.

import { describe, it, expect, afterEach } from 'vitest';
import { dayNumber, localDate, streak } from '../src/engine/streak';
import { newAchievements } from '../src/engine/achievements';
import { cleanOnCall, mergeOnCall, readFile, backupFile } from '../src/engine/progress';

const run = (from: string, n: number) => {
  const start = dayNumber(from)!;
  return Array.from({ length: n }, (_, i) => new Date((start + i) * 86_400_000).toISOString().slice(0, 10));
};

describe('localDate and dayNumber', () => {
  const tz = process.env.TZ;
  afterEach(() => {
    process.env.TZ = tz;
  });

  it('gives the day in the local time zone, not in UTC', () => {
    process.env.TZ = 'America/Los_Angeles';
    // 2026-11-24 at 05:30 UTC is still the 23rd in California.
    expect(localDate(new Date('2026-11-24T05:30:00Z'))).toBe('2026-11-23');
    process.env.TZ = 'Asia/Tokyo';
    expect(localDate(new Date('2026-11-23T20:00:00Z'))).toBe('2026-11-24');
  });

  it('counts a 23-hour or a 25-hour day as one day (daylight saving time)', () => {
    process.env.TZ = 'Europe/Paris';
    // The clocks go forward on 2026-03-29, back on 2026-10-25.
    const before = localDate(new Date(2026, 2, 28, 23, 59));
    const after = localDate(new Date(2026, 2, 29, 23, 59));
    expect([before, after]).toEqual(['2026-03-28', '2026-03-29']);
    expect(dayNumber(after)! - dayNumber(before)!).toBe(1);
    expect(localDate(new Date(2026, 9, 25, 0, 30))).toBe('2026-10-25');
    expect(localDate(new Date(2026, 9, 25, 23, 30))).toBe('2026-10-25');
    expect(streak(['2026-03-28', '2026-03-29', '2026-10-24', '2026-10-25', '2026-10-26'], '2026-10-26').current).toBe(3);
  });

  it('refuses what is not a calendar date', () => {
    expect(dayNumber('2026-02-30')).toBeNull();
    expect(dayNumber('yesterday')).toBeNull();
    expect(dayNumber('2028-02-29')).not.toBeNull();
  });
});

describe('streak', () => {
  it('is zero with nothing solved', () => {
    expect(streak([], '2026-11-23')).toEqual({ current: 0, best: 0, today: false, rests: [], restReady: true });
  });

  it('counts consecutive days, across months and years', () => {
    const s = streak(run('2026-12-29', 5), '2027-01-02');
    expect(s).toMatchObject({ current: 5, best: 5, today: true, rests: [] });
  });

  it('keeps the streak while today is not solved yet', () => {
    const s = streak(run('2026-11-20', 3), '2026-11-23');
    expect(s).toMatchObject({ current: 3, today: false, restReady: true });
  });

  it('forgives one missed day a week (a rest day)', () => {
    // Solved the 16th to the 19th, rested the 20th, solved the 21st and 22nd.
    const days = [...run('2026-11-16', 4), '2026-11-21', '2026-11-22'];
    const s = streak(days, '2026-11-22');
    expect(s).toMatchObject({ current: 6, best: 6, today: true, rests: ['2026-11-20'], restReady: false });
  });

  it('forgives yesterday as the rest day, and says so', () => {
    const s = streak(run('2026-11-18', 4), '2026-11-23');
    expect(s).toMatchObject({ current: 4, today: false, rests: ['2026-11-22'], restReady: false });
  });

  it('breaks on a second missed day in the same week', () => {
    // Rested the 18th, then missed the 21st: the streak restarts on the 22nd.
    const days = ['2026-11-16', '2026-11-17', '2026-11-19', '2026-11-20', '2026-11-22'];
    const s = streak(days, '2026-11-22');
    expect(s).toMatchObject({ current: 1, best: 4 });
  });

  it('allows another rest day seven days after the last one', () => {
    const days = run('2026-11-01', 30).filter((d) => d !== '2026-11-05' && d !== '2026-11-12' && d !== '2026-11-19');
    expect(streak(days, '2026-11-30')).toMatchObject({ current: 27, rests: ['2026-11-05', '2026-11-12', '2026-11-19'] });
  });

  it('breaks after two missed days in a row, keeping the best', () => {
    const s = streak(run('2026-11-10', 7), '2026-11-19');
    expect(s).toMatchObject({ current: 0, best: 7, today: false, rests: [] });
  });

  it('ignores days after today (the clock was set back), until they come', () => {
    const days = [...run('2026-11-20', 3), '2026-12-25'];
    expect(streak(days, '2026-11-22')).toMatchObject({ current: 3, best: 3, today: true });
    // The clock set back a whole day: yesterday's result is "tomorrow", today is still fine.
    expect(streak(run('2026-11-20', 4), '2026-11-22')).toMatchObject({ current: 3, today: true });
  });

  it('ignores duplicates and malformed dates', () => {
    expect(streak(['2026-11-22', '2026-11-22', 'nope', '2026-11-23'], '2026-11-23').current).toBe(2);
    expect(streak(['2026-11-23'], 'not a day').current).toBe(0);
  });
});

describe('streak achievements', () => {
  it('earns 3, 7 and 30 days from the best streak', () => {
    const c = (streak: number) => ({ sh: null, finished: [], notebook: {}, records: {}, streak });
    expect(newAchievements(c(2), {})).toEqual([]);
    expect(newAchievements(c(3), {})).toEqual(['streak-3']);
    expect(newAchievements(c(30), {})).toEqual(['streak-3', 'streak-7', 'streak-30']);
  });
});

describe('on-call days in the save file', () => {
  const day = { chapter: 'full-disk', remaining: 1000, time: 5000, hints: 1, errors: 0 };

  it('cleans what it reads', () => {
    expect(cleanOnCall({ '2026-11-22': day, 'nope': day, '2026-11-23': { ...day, chapter: 'unknown' }, '2026-11-24': { ...day, hints: -1 } })).toEqual({ '2026-11-22': day });
    expect(cleanOnCall(null)).toEqual({});
  });

  it('keeps the best result of each day when merging', () => {
    const better = { ...day, remaining: 2000 };
    expect(mergeOnCall({ '2026-11-22': day }, { '2026-11-22': better, '2026-11-23': day })).toEqual({ '2026-11-22': better, '2026-11-23': day });
  });

  it('travels in the file, and an older file without it still reads', () => {
    const read = readFile(backupFile({ finished: ['lighthouse'], onCall: { '2026-11-22': day } }, new Date('2026-11-23T10:00:00Z')));
    expect('backup' in read && read.backup.onCall).toEqual({ '2026-11-22': day });
    const old = readFile(backupFile({ finished: ['lighthouse'] }, new Date('2026-11-23T10:00:00Z')));
    expect('backup' in old && old.backup.onCall).toBeUndefined();
  });
});
