// The sheets for teachers: for each chapter, what it requires beforehand
// (the previous chapter; for the stories that require them, the keys given
// at the end of the Eraser), the commands it introduces (absent from the
// chapters before it in the game's order), and an indicative duration,
// derived from the number of steps the game checks.

import { STORIES } from './chapters';
import type { Chapter, Story } from './world';

export interface Sheet {
  story: Story;
  chapter: Chapter;
  // The chapter to finish before (null: none in the story).
  before: Chapter | null;
  fresh: string[];
  // Minutes, rounded to 5.
  duration: number;
}

// Everyday commands, no longer introduced after the Eraser.
const CURRENT = ['ls', 'cd', 'pwd', 'cat', 'less', 'id', 'whoami', 'clear', 'exit', 'help', 'man'];

/** The sheets of all the stories, in the game's order. */
export function allSheets(): Sheet[] {
  const views = new Set<string>();
  return STORIES.flatMap((story) =>
    story.chapters.map((chapter, i) => {
      const fresh = chapter.commands.filter((c) => !views.has(c) && (story.id === 'eraser' || !CURRENT.includes(c)));
      chapter.commands.forEach((c) => views.add(c));
      // About ten minutes to read and settle in, then about three per checked step.
      const duration = Math.max(15, Math.round((10 + 3 * chapter.events.length) / 5) * 5);
      return { story, chapter, before: i > 0 ? story.chapters[i - 1] : null, fresh, duration };
    }),
  );
}
