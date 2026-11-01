// The difficulty of the chapters (src/engine/difficulty.ts): every chapter has
// a level from 1 to 5, the levels are spread out, the first steps are easy,
// and a chapter is never easier than the one before it in its story.

import { describe, expect, it } from 'vitest';
import { STORIES } from '../src/engine/chapters';
import { difficulty, stars, storyDifficulty } from '../src/engine/difficulty';
import { LANGUAGES, translator } from '../src/texts';

const chapters = STORIES.flatMap((h) => h.chapters);

describe('Difficulty', () => {
  it('every chapter has a level from 1 to 5, and each level is used', () => {
    const levels = chapters.map((c) => difficulty(c.id));
    for (const l of levels) expect([1, 2, 3, 4, 5]).toContain(l);
    for (const l of [1, 2, 3, 4, 5]) expect(levels.filter((x) => x === l).length).toBeGreaterThan(chapters.length / 10);
  });

  it('the first story is the easiest, and stories that assume most of the game are hard', () => {
    expect(storyDifficulty('eraser')).toEqual({ min: 1, max: 1 });
    expect(storyDifficulty('watch').min).toBeGreaterThanOrEqual(4);
  });

  it('within a story, a chapter is never easier than the one before', () => {
    for (const h of STORIES) h.chapters.slice(1).forEach((c, i) => expect(difficulty(c.id), c.id).toBeGreaterThanOrEqual(difficulty(h.chapters[i].id)));
  });

  it('stars, and the level in words in every language', () => {
    expect(stars(3)).toBe('★★★☆☆');
    expect(() => difficulty('no-such-chapter')).toThrow('Unknown chapter');
    for (const language of LANGUAGES) {
      const t = translator(language);
      expect(t('difficulty', { level: 3 })).toMatch(/3/);
      expect(t('difficulty-tidy', { min: 2, max: 4 })).toMatch(/2.*4/);
    }
  });
});
