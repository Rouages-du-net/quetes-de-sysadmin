// The difficulty of the chapters (src/engine/difficulty.ts): every chapter has
// a level from 1 to 5, on an absolute scale. Adding a story changes no level
// but its own chapters'; a chapter is never easier than the one before it in
// its story, nor more than one level easier than what its story opens after;
// and a few anchors keep the scale where it feels right.

import { describe, expect, it } from 'vitest';
import { STORIES } from '../src/engine/chapters';
import { difficulty, levelsOf, stars, storyDifficulty } from '../src/engine/difficulty';
import type { Chapter, Story } from '../src/engine/world';
import { LANGUAGES, translator } from '../src/texts';

const chapters = STORIES.flatMap((h) => h.chapters);

// A made-up chapter: `size` steps and commands nobody else knows.
const fake = (id: string, size: number): Chapter =>
  ({ id, number: 1, commands: Array.from({ length: size }, (_, i) => `${id}-command-${i}`), events: [], final: '', home: '/', welcome: '' }) as unknown as Chapter;

describe('Difficulty', () => {
  it('every chapter has a level from 1 to 5, and each level is used', () => {
    const levels = chapters.map((c) => difficulty(c.id));
    for (const l of levels) expect([1, 2, 3, 4, 5]).toContain(l);
    for (const l of [1, 2, 3, 4, 5]) expect(levels.filter((x) => x === l).length, `level ${l}`).toBeGreaterThan(0);
  });

  it('adding a story, with prerequisites from all over the game, changes no other chapter', () => {
    const before = levelsOf();
    const ends = STORIES.map((h) => h.chapters[h.chapters.length - 1].id);
    for (const after of [['root'], ['heavy-load', 'zones', 'ssh-alerts'], ends]) {
      const added: Story = { id: 'made-up', after, chapters: [fake('made-up-1', 40), fake('made-up-2', 2)] };
      const now = levelsOf([...STORIES, added]);
      for (const c of chapters) expect(now.get(c.id), c.id).toBe(before.get(c.id));
      // And a story that opens after everything is as hard as can be.
      if (after === ends) expect(now.get('made-up-1')).toBe(5);
    }
  });

  it('within a story, a chapter is never easier than the one before', () => {
    for (const h of STORIES) h.chapters.slice(1).forEach((c, i) => expect(difficulty(c.id), c.id).toBeGreaterThanOrEqual(difficulty(h.chapters[i].id)));
  });

  it('a story starts at most one level below the hardest chapter it opens after', () => {
    for (const h of STORIES) for (const c of h.after ?? []) expect(difficulty(h.chapters[0].id), `${h.id} after ${c}`).toBeGreaterThanOrEqual(difficulty(c) - 1);
  });

  it('anchors: the first steps are easy, the stories that assume most of the game are hard', () => {
    expect(storyDifficulty('eraser')).toEqual({ min: 1, max: 1 });
    for (const h of ['packet', 'time-machine', 'archives']) expect(storyDifficulty(h).max, h).toBe(1);
    expect(storyDifficulty('datacenter').max).toBeLessThanOrEqual(2);
    for (const h of ['watch', 'bastion', 'theatre']) expect(storyDifficulty(h).min, h).toBeGreaterThanOrEqual(4);
    expect(storyDifficulty('music-school').max).toBe(5);
    // A bigger chapter weighs more than a small one in the same place.
    const two = levelsOf([...STORIES, { id: 'made-up', after: ['works-for-me'], chapters: [fake('small', 1)] }, { id: 'made-up-big', after: ['works-for-me'], chapters: [fake('big', 30)] }]);
    expect(two.get('big')!).toBeGreaterThan(two.get('small')!);
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
