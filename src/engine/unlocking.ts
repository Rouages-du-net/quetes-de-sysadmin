// Stories open little by little. The first one (L'Effaceur) is open
// from the start; each of the others declares in `after` (chapters/index.ts) the
// chapters to finish before receiving its key: what it assumes is already known.
// A player thus moves forward in waves, instead of seeing everything
// open after La Racine.

import { STORIES } from './chapters';
import type { Story } from './world';

export const FIRST = 'eraser';

const story = (id: string): Story | undefined => STORIES.find((h) => h.id === id);
const storyFor = (chapter: string): Story | undefined => STORIES.find((h) => h.chapters.some((c) => c.id === chapter));

/** The chapters still missing to open this story (empty: it is open). */
export function missing(id: string, finished: readonly string[]): string[] {
  return (story(id)?.after ?? []).filter((c) => !finished.includes(c));
}

/** A story is open when its "after" chapters are all finished. */
export const isOpen = (id: string, finished: readonly string[]): boolean => missing(id, finished).length === 0;

/**
 * All the chapters to finish, in order, to open this story (and
 * those it depends on): a story's chapters follow one another, so
 * finishing one assumes the earlier ones are finished.
 */
export function prerequisites(id: string): string[] {
  const seen: string[] = [];
  const add = (h: string) => {
    for (const c of story(h)?.after ?? []) {
      const source = storyFor(c)!;
      add(source.id);
      for (const x of source.chapters.slice(0, source.chapters.findIndex((y) => y.id === c) + 1)) if (!seen.includes(x.id)) seen.push(x.id);
    }
  };
  add(id);
  return seen;
}
