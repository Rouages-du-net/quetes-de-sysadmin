// The difficulty of the chapters (src/moteur/difficulty.ts): every chapter has
// a level from 1 to 5, the levels are spread out, the first steps are easy,
// and a chapter is never easier than the one before it in its story.

import { describe, expect, it } from 'vitest';
import { HISTOIRES } from '../src/moteur/chapitres';
import { difficulty, stars, storyDifficulty } from '../src/moteur/difficulty';
import { LANGUES, traducteur } from '../src/textes';

const chapters = HISTOIRES.flatMap((h) => h.chapitres);

describe('Difficulty', () => {
  it('every chapter has a level from 1 to 5, and each level is used', () => {
    const levels = chapters.map((c) => difficulty(c.id));
    for (const l of levels) expect([1, 2, 3, 4, 5]).toContain(l);
    for (const l of [1, 2, 3, 4, 5]) expect(levels.filter((x) => x === l).length).toBeGreaterThan(chapters.length / 10);
  });

  it('the first story is the easiest, and stories that assume most of the game are hard', () => {
    expect(storyDifficulty('effaceur')).toEqual({ min: 1, max: 1 });
    expect(storyDifficulty('veille').min).toBeGreaterThanOrEqual(4);
  });

  it('within a story, a chapter is never easier than the one before', () => {
    for (const h of HISTOIRES) h.chapitres.slice(1).forEach((c, i) => expect(difficulty(c.id), c.id).toBeGreaterThanOrEqual(difficulty(h.chapitres[i].id)));
  });

  it('stars, and the level in words in every language', () => {
    expect(stars(3)).toBe('★★★☆☆');
    expect(() => difficulty('no-such-chapter')).toThrow('Unknown chapter');
    for (const langue of LANGUES) {
      const t = traducteur(langue);
      expect(t('difficulty', { level: 3 })).toMatch(/3/);
      expect(t('difficulty-range', { min: 2, max: 4 })).toMatch(/2.*4/);
    }
  });
});
