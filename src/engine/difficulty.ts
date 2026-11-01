// How hard a chapter is, from 1 to 5, to help players and teachers choose.
// It is computed from what the game already knows, not rated by hand:
// - mostly, how far into the game the chapter sits: the chapters to finish
//   before it (those that unlock its story, then the earlier chapters of its
//   own story), which is what it takes for granted;
// - a little, its size: the steps the game checks and the commands it
//   introduces.
// Each chapter's score is ranked among all chapters, and the ranking is cut
// into five equal bands: about a fifth of the chapters have each level.
// Within a story, a chapter is never easier than the one before it.

import { STORIES } from './chapters';
import { prerequisites } from './unlocking';
import { allSheets } from './sheets';

export type Level = 1 | 2 | 3 | 4 | 5;

const WEIGHT_PLACE = 0.75;
const WEIGHT_SIZE = 0.25;

// The rank of each value among all values, from 0 (smallest) to 1 (largest); ties share a rank.
function percentiles(values: number[]): number[] {
  const sorted = [...values].sort((a, b) => a - b);
  const last = Math.max(1, values.length - 1);
  return values.map((v) => sorted.indexOf(v) / last);
}

let levels: Map<string, Level> | null = null;

function compute(): Map<string, Level> {
  const sheets = allSheets();
  const place = sheets.map((f) => {
    const story = STORIES.find((h) => h.id === f.story.id)!;
    return new Set([...prerequisites(story.id), ...story.chapters.slice(0, story.chapters.indexOf(f.chapter)).map((c) => c.id)]).size;
  });
  const size = sheets.map((f) => f.chapter.events.length + f.fresh.length);
  const p = percentiles(place);
  const s = percentiles(size);
  const scores = sheets.map((_, i) => WEIGHT_PLACE * p[i] + WEIGHT_SIZE * s[i]);
  const ranks = percentiles(scores);
  const result = new Map(sheets.map((f, i) => [f.chapter.id, Math.min(5, 1 + Math.floor(ranks[i] * 5)) as Level]));
  for (const story of STORIES)
    story.chapters.forEach((c, i) => {
      if (i > 0) result.set(c.id, Math.max(result.get(c.id)!, result.get(story.chapters[i - 1].id)!) as Level);
    });
  return result;
}

/** A chapter's difficulty, from 1 (a first step) to 5 (assumes most of the game). */
export function difficulty(chapter: string): Level {
  levels ??= compute();
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
