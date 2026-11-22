// How hard a chapter is, from 1 to 5, to help players and teachers choose.
// It is computed from what the game already knows, not rated by hand, and
// on an absolute scale: a chapter's level depends only on the chapter itself
// and on the chapters it assumes, never on the rest of the game. Adding a
// story (or prerequisites to a new story) thus changes no other chapter's
// level, except the chapters that come after it.
//
// - Knowledge: the chapters it assumes, `assumed`: those that unlock its
//   story (prerequisites() of unlocking.ts) and the earlier chapters of its
//   own story.
// - Size: the steps the game checks (`events`) and the commands it
//   introduces (known here, in none of the assumed chapters). A chapter of
//   up to 12 counts as ordinary; a bigger one weighs as if it assumed more,
//   up to twice as much (from 24).
//
//   weight = (assumed + 1) × min(2, max(1, (steps + new commands) / 12))
//
// The weight is cut by fixed thresholds (LEVELS): an ordinary chapter is
// level 2 from 5 assumed chapters, 3 from 12, 4 from 18, 5 from 44. Each
// doubling of what a chapter assumes is about one more level, which is how
// learning feels: the twentieth chapter of background matters less than the
// fifth.
//
// Then two floors, so the levels read as a progression:
// - within a story, a chapter is never easier than the one before it;
// - a story's first chapter is at most one level easier than the hardest
//   chapter its story opens after (`after`), which it builds on.

import { CATALOGUE as STORIES, eventCount } from './catalogue';
import { assumed } from './unlocking';
import type { StoryInfo as Story } from './catalogue';

export type Level = 1 | 2 | 3 | 4 | 5;

// The weight from which each level starts (level 1 below the first).
const LEVELS = [6, 13, 19, 45] as const;
// Steps and new commands of an ordinary chapter, and the most size can multiply the weight by.
const ORDINARY_SIZE = 12;
const MAX_SIZE_FACTOR = 2;

/** The level of every chapter of these stories (the game's by default; tests pass others). */
export function levelsOf(stories: readonly Story[] = STORIES): Map<string, Level> {
  const levels = new Map<string, Level>();
  const storyOf = new Map(stories.flatMap((s) => s.chapters.map((c) => [c.id, s] as const)));
  const commands = new Map(stories.flatMap((s) => s.chapters.map((c) => [c.id, c.commands] as const)));
  const level = (id: string): Level => {
    const known = levels.get(id);
    if (known) return known;
    const story = storyOf.get(id)!;
    const index = story.chapters.findIndex((c) => c.id === id);
    const chapter = story.chapters[index];
    const assumedHere = new Set(assumed(id, stories));
    const seen = new Set([...assumedHere].flatMap((c) => commands.get(c) ?? []));
    const fresh = chapter.commands.filter((c) => !seen.has(c)).length;
    const factor = Math.min(MAX_SIZE_FACTOR, Math.max(1, (eventCount(chapter) + fresh) / ORDINARY_SIZE));
    const weight = (assumedHere.size + 1) * factor;
    let result = 1 + LEVELS.filter((t) => weight >= t).length;
    if (index > 0) result = Math.max(result, level(story.chapters[index - 1].id));
    else for (const c of story.after ?? []) result = Math.max(result, level(c) - 1);
    levels.set(id, result as Level);
    return result as Level;
  };
  for (const s of stories) for (const c of s.chapters) level(c.id);
  return levels;
}

let levels: Map<string, Level> | null = null;

/** A chapter's difficulty, from 1 (a first step) to 5 (assumes most of the game). */
export function difficulty(chapter: string): Level {
  levels ??= levelsOf();
  const level = levels.get(chapter);
  if (!level) throw new Error(`Unknown chapter: ${chapter}`);
  return level;
}

/** The easiest and hardest chapters of a story. */
export function storyDifficulty(story: string): { min: Level; max: Level } {
  const all = STORIES.find((h) => h.id === story)!.chapters.map((c) => difficulty(c.id));
  return { min: Math.min(...all) as Level, max: Math.max(...all) as Level };
}

/** Five stars, the first `level` of them filled (for display; the level is also given in words). */
export const stars = (level: Level) => '★'.repeat(level) + '☆'.repeat(5 - level);
