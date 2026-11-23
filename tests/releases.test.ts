// Reminders and new-content notices, static only: the stories' release
// dates (releases.ts), what's new since the last visit, the Atom feed
// (feed.ts), the calendar file (reminder.ts) and the app badge (badge.ts).

import { describe, it, expect } from 'vitest';
import { CATALOGUE as STORIES } from '../src/engine/catalogue';
import { FRESH_DAYS, RELEASES, markSeen, newestFirst, readSeen, whatsNew } from '../src/engine/releases';
import { atomFeed, xmlText } from '../src/engine/feed';
import { fold, icsText, readTime, reminderIcs } from '../src/engine/reminder';
import { badgeFor, wireBadge } from '../src/pwa/badge';
import { dayNumber } from '../src/engine/streak';

describe('release dates', () => {
  it('every story has one, a real date, and nothing else is listed', () => {
    for (const s of STORIES) expect(dayNumber(RELEASES[s.id] ?? ''), `release date of ${s.id}`).not.toBeNull();
    expect(Object.keys(RELEASES).sort()).toEqual(STORIES.map((s) => s.id).sort());
  });
  it('a story never comes out before a story it comes after (its prerequisites)', () => {
    const storyOf = (chapter: string) => STORIES.find((s) => s.chapters.some((c) => c.id === chapter))!.id;
    for (const s of STORIES) for (const c of s.after ?? []) expect(RELEASES[storyOf(c)] <= RELEASES[s.id], `${s.id} after ${c}`).toBe(true);
  });
  it('sorts newest first, the game order breaking ties', () => {
    expect(newestFirst(['a', 'b', 'c'], { a: '2026-01-01', b: '2026-02-01', c: '2026-02-01' })).toEqual(['c', 'b', 'a']);
  });
});

describe("what's new", () => {
  const releases = { old: '2026-10-18', mid: '2026-11-01', recent: '2026-11-20', latest: '2026-11-22' };
  it('marks nothing on a first visit', () => {
    expect(whatsNew({}, '2026-11-23', releases)).toEqual({ until: '2026-11-22', fresh: {} });
  });
  it('marks the stories released since the last date seen', () => {
    const s = whatsNew({ until: '2026-11-01' }, '2026-11-23', releases);
    expect(s).toEqual({ until: '2026-11-22', fresh: { recent: '2026-11-23', latest: '2026-11-23' } });
    // The next visit keeps them, with the day they were first shown.
    expect(whatsNew(s, '2026-11-25', releases)).toEqual(s);
  });
  it('forgets a story once opened, or after a while', () => {
    const s = whatsNew({ until: '2026-11-01' }, '2026-11-23', releases);
    expect(markSeen(s, 'recent').fresh).toEqual({ latest: '2026-11-23' });
    expect(markSeen(s, 'nope')).toBe(s);
    const later = new Date(Date.UTC(2026, 10, 23 + FRESH_DAYS + 1)).toISOString().slice(0, 10);
    expect(whatsNew(s, later, releases).fresh).toEqual({});
  });
  it('a clock set back keeps the badges', () => {
    const s = whatsNew({ until: '2026-11-01' }, '2026-11-23', releases);
    expect(whatsNew(s, '2026-01-01', releases).fresh).toEqual(s.fresh);
  });
  it('reads what the browser kept, carefully', () => {
    expect(readSeen({ until: '2026-11-01', fresh: { a: '2026-11-02', b: 3 } })).toEqual({ until: '2026-11-01', fresh: { a: '2026-11-02' } });
    expect(readSeen('x')).toEqual({});
    expect(readSeen({ until: 'yesterday' })).toEqual({});
  });
});

describe('the Atom feed', () => {
  const feed = atomFeed({
    lang: 'en',
    id: 'tag:sysadmin.rouages.net,2026:en/stories',
    title: 'Sysadmin Quests: new stories',
    subtitle: 'New <stories> & more',
    self: 'https://sysadmin.rouages.net/en/feed.xml',
    home: 'https://sysadmin.rouages.net/en/',
    author: 'Les rouages du net',
    rights: 'CC BY-SA 4.0',
    entries: [
      { id: 'tag:x,2026:a', title: 'Old', summary: 'First "one"', link: 'https://sysadmin.rouages.net/en/', date: '2026-10-18' },
      { id: 'tag:x,2026:b', title: 'New', summary: "It's here", link: 'https://sysadmin.rouages.net/en/', date: '2026-11-23' },
    ],
  });
  it('is well-formed Atom, escaped, newest first, dated by its newest entry', () => {
    expect(feed.startsWith('<?xml version="1.0" encoding="utf-8"?>\n<feed xmlns="http://www.w3.org/2005/Atom" xml:lang="en">')).toBe(true);
    expect(feed).toContain('<subtitle>New &lt;stories&gt; &amp; more</subtitle>');
    expect(feed).toContain('<summary>First &quot;one&quot;</summary>');
    expect(feed).toContain('<updated>2026-11-23T00:00:00Z</updated>');
    expect(feed.indexOf('<title>New</title>')).toBeLessThan(feed.indexOf('<title>Old</title>'));
    expect(feed.match(/<entry>/g)).toHaveLength(2);
  });
  it('is the same at every build (deterministic)', () => {
    expect(xmlText('a\u0001b')).toBe('ab');
    expect(feed).toBe(feed.replace(/\r/g, ''));
  });
});

describe('the calendar file', () => {
  const options = {
    time: '07:05',
    start: '2026-11-23',
    now: new Date('2026-11-23T18:00:00.123Z'),
    language: 'fr',
    url: 'https://sysadmin.rouages.net/fr/',
    title: "Quêtes de Sysadmin : l'incident du jour",
    description: 'Une ligne, une virgule; et un \\ et\nune autre',
    alarm: "C'est l'heure",
  };
  const ics = reminderIcs(options)!;
  const lines = ics.split('\r\n');
  it('is an RFC 5545 calendar with a daily event and an alarm', () => {
    expect(ics.endsWith('\r\n')).toBe(true);
    expect(lines[0]).toBe('BEGIN:VCALENDAR');
    expect(lines).toContain('VERSION:2.0');
    expect(lines).toContain('RRULE:FREQ=DAILY');
    expect(lines).toContain('BEGIN:VALARM');
    expect(lines).toContain('ACTION:DISPLAY');
    expect(lines.filter((l) => l.startsWith('BEGIN:')).length).toBe(lines.filter((l) => l.startsWith('END:')).length);
  });
  it('starts at a floating local time, stamped in UTC, with a stable UID', () => {
    expect(lines).toContain('DTSTART:20261123T070500');
    expect(lines).toContain('DTSTAMP:20261123T180000Z');
    expect(ics).not.toContain('TZID');
    expect(lines).toContain('UID:daily-reminder-fr@sysadmin.rouages.net');
    expect(reminderIcs({ ...options, now: new Date('2027-01-01T00:00:00Z'), time: '21:00' })).toContain('UID:daily-reminder-fr@sysadmin.rouages.net');
  });
  it('escapes text and folds long lines at 75 octets, never inside a character', () => {
    expect(icsText('a,b;c\\d\ne')).toBe('a\\,b\\;c\\\\d\\ne');
    const long = fold(`DESCRIPTION:${'é'.repeat(80)}`);
    for (const part of long.split('\r\n')) expect(new TextEncoder().encode(part).length).toBeLessThanOrEqual(75);
    expect(long.split('\r\n').slice(1).every((p) => p.startsWith(' '))).toBe(true);
    expect(long.replace(/\r\n /g, '')).toBe(`DESCRIPTION:${'é'.repeat(80)}`);
  });
  it('refuses a time that is not one', () => {
    expect(readTime('7:5')).toBeNull();
    expect(readTime('24:00')).toBeNull();
    expect(readTime('23:59')).toEqual({ hours: 23, minutes: 59 });
    expect(reminderIcs({ ...options, time: '' })).toBeNull();
  });
});

describe('the app badge', () => {
  it('shows the count only once the app is in the background', () => {
    expect(badgeFor(3, true)).toBe(0);
    expect(badgeFor(3, false)).toBe(3);
    expect(badgeFor(-1, false)).toBe(0);
  });
  it('does nothing where the browser has no badge', () => {
    expect(() => wireBadge({} as Document, {})).not.toThrow();
  });
});
