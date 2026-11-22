// What the menu, the learning paths, unlocking, difficulty and progress need
// to know about every story, without loading the stories themselves: their
// order, what opens them (`after`), their chapters' identifiers, commands
// and size, and the text files each story loads with it (src/texts/<language>/).
//
// catalogue.json is generated from chapters/index.ts by `npm run catalogue`
// (tests/catalogue.test.ts fails while it is out of date). The chapters
// themselves (their worlds, events, machines) load only when their story is
// opened: see story-registry.ts.

import data from './catalogue.json';

/** A chapter, as the menu knows it. A loaded Chapter (world.ts) is one too. */
export interface ChapterInfo {
  id: string;
  number: number;
  commands: readonly string[];
  withhold?: readonly string[];
  /** The number of its events (its size, for difficulty.ts), or the events themselves. */
  events: number | readonly unknown[];
  watchesWorkstation?: boolean;
  playerKeys?: boolean;
}

/** A story, as the menu knows it. A loaded Story (world.ts) is one too. */
export interface StoryInfo {
  id: string;
  after?: readonly string[];
  chapters: readonly ChapterInfo[];
}

export interface CatalogueStory extends StoryInfo {
  /** Its text files (chapter-*.ftl, hints-*.ftl), loaded with it. */
  texts: readonly string[];
}

export const CATALOGUE: readonly CatalogueStory[] = data.stories;

/** A chapter's number of events. */
export const eventCount = (c: ChapterInfo): number => (typeof c.events === 'number' ? c.events : c.events.length);

// Everyday commands, no longer introduced after the Eraser.
const CURRENT = ['ls', 'cd', 'pwd', 'cat', 'less', 'id', 'whoami', 'clear', 'exit', 'help', 'man'];

/**
 * The commands each chapter introduces: absent from the chapters before it in
 * the game's order (the teachers' sheets, sheets.ts; the hints' manual pages, hints.ts).
 */
export function freshCommands(stories: readonly StoryInfo[] = CATALOGUE): Map<string, string[]> {
  const seen = new Set<string>();
  const out = new Map<string, string[]>();
  for (const story of stories)
    for (const chapter of story.chapters) {
      out.set(chapter.id, chapter.commands.filter((c) => !seen.has(c) && (story.id === 'eraser' || !CURRENT.includes(c))));
      chapter.commands.forEach((c) => seen.add(c));
    }
  return out;
}
