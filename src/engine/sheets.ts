// The sheets for teachers: for each chapter, what it requires beforehand
// (the previous chapter; for the stories that require them, the keys given
// at the end of the Eraser), the commands it introduces (absent from the
// chapters before it in the game's order), and an indicative duration,
// derived from the number of steps the game checks.

import { STORIES } from './chapters';
import type { Chapter, Story } from './world';
import { freshCommands } from './catalogue';
import { page, recap } from './commands/manual';
import type { Translate, Variables } from '../texts';

export interface Sheet {
  story: Story;
  chapter: Chapter;
  // The chapter to finish before (null: none in the story).
  before: Chapter | null;
  fresh: string[];
  // Minutes, rounded to 5.
  duration: number;
}

/** The sheets of all the stories, in the game's order. */
export function allSheets(): Sheet[] {
  const fresh = freshCommands(STORIES);
  return STORIES.flatMap((story) =>
    story.chapters.map((chapter, i) => {
      // About ten minutes to read and settle in, then about three per checked step.
      const duration = Math.max(15, Math.round((10 + 3 * chapter.events.length) / 5) * 5);
      return { story, chapter, before: i > 0 ? story.chapters[i - 1] : null, fresh: fresh.get(chapter.id)!, duration };
    }),
  );
}

// ——— The printable story sheets (src/components/StorySheet.astro) ———

/** The sheets of one story, in order. */
export const storySheets = (story: string): Sheet[] => allSheets().filter((s) => s.story.id === story);

/** The game's own basics, which a sheet doesn't send to the manual. */
const BASICS = ['ls', 'cd', 'pwd', 'cat', 'less'];

/**
 * The manual pages to read for a chapter, with their one-line summary
 * (whatis): the commands it introduces, or, when it introduces none, its
 * own commands but the basics (as the hints do, see hints.ts); only those
 * the game's manual has.
 */
export function manualPages(sheet: Sheet, t: Translate): { name: string; whatis: string }[] {
  const names = sheet.fresh.length ? sheet.fresh : sheet.chapter.commands.filter((x) => !BASICS.includes(x)).slice(0, 4);
  return names.filter((n) => t.exists(page(n))).map((name) => ({ name, whatis: recap(t(page(name))) }));
}

// Any variable a text asks for, as 0: a debrief that shows numbers of the
// game (files saved, minutes lost) is read here without a game, for its
// links only.
const ANY = new Proxy({} as Variables, {
  getOwnPropertyDescriptor: () => ({ value: 0, writable: true, enumerable: true, configurable: true }),
  get: () => 0,
  has: () => true,
});

/** The debrief of a chapter (the message of its final event), or null. */
function debrief(chapter: Chapter, t: Translate): string | null {
  const id = `${chapter.id}-event-${chapter.final}`;
  if (!t.exists(id)) return null;
  try {
    return t(id, ANY);
  } catch {
    return null;
  }
}

/**
 * The official documentation a chapter's debrief points to: its lines
 * "- label: https://…" (the debrief's last part, in every language).
 */
export function documentation(chapter: Chapter, t: Translate): { label: string; url: string }[] {
  const text = debrief(chapter, t) ?? '';
  return [...text.matchAll(/^\s*- (.+?)\s?: (https:\/\/\S+)$/gm)].map((m) => ({ label: m[1], url: m[2] }));
}

/**
 * The solution route, for the teacher's version only: each step's hint in
 * the game's order, its lead and its solution (the third hint, which the
 * game itself gives a player who asks three times; see hints.ts).
 */
export function solutionRoute(chapter: Chapter, t: Translate): { lead: string; solution: string }[] {
  const order = chapter.steps ?? chapter.events.map((e) => e.id);
  return order
    .filter((e) => t.exists(`hint-${chapter.id}-${e}.lead`))
    .map((e) => ({ lead: t(`hint-${chapter.id}-${e}.lead`, ANY), solution: t(`hint-${chapter.id}-${e}.solution`, ANY) }));
}

/** A duration for the sheets: "45 min", "1 h 05 min" in English, "1 h 05" in French. */
export function hours(minutes: number, lang: string): string {
  if (minutes < 60) return `${minutes} min`;
  const h = `${Math.floor(minutes / 60)} h`;
  const m = minutes % 60 ? ` ${String(minutes % 60).padStart(2, '0')}` : '';
  return lang === 'fr' ? `${h}${m}` : `${h}${m && `${m} min`}`;
}
