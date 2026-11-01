// The thematic learning paths: chapters that exist, each in at least
// one path, texts in every language, and each step's state.
import { describe, expect, it } from 'vitest';
import { STORIES } from '../src/engine/chapters';
import { pathSteps, PATH } from '../src/engine/paths';
import { LANGUAGES, translator } from '../src/texts';

const ALL = STORIES.flatMap((h) => h.chapters.map((c) => c.id));

describe('Learning paths', () => {
  it('chapters that exist, no duplicates, and every chapter in at least one path', () => {
    for (const p of PATH) {
      expect(p.chapters.filter((id) => !ALL.includes(id))).toEqual([]);
      expect(new Set(p.chapters).size).toBe(p.chapters.length);
    }
    const covered = new Set(PATH.flatMap((p) => p.chapters));
    expect(ALL.filter((id) => !covered.has(id))).toEqual([]);
  });

  it('within a path, the chapters of one story keep the story’s order', () => {
    for (const p of PATH) {
      const rank = (id: string) => ALL.indexOf(id);
      for (const h of STORIES) {
        const here = p.chapters.filter((id) => h.chapters.some((c) => c.id === id)).map(rank);
        expect(here).toEqual([...here].sort((a, b) => a - b));
      }
    }
  });

  for (const language of LANGUAGES)
    it(`a title and a description in ${language}`, () => {
      const t = translator(language);
      for (const p of PATH) {
        expect(t.exists(`path-${p.id}`)).toBe(true);
        expect(t.exists(`path-${p.id}.description`)).toBe(true);
      }
    });

  it('the steps’ state: done, open, locked (with the chapter to finish first), without a key', () => {
    const security = PATH.find((p) => p.id === 'security')!;
    const { steps, next } = pathSteps(security, ['shut-the-door'], (h) => h !== 'coop');
    expect(steps[0].state).toBe('done');
    expect(steps[1]).toMatchObject({ chapter: 'firewall', state: 'open' });
    expect(steps[2]).toMatchObject({ chapter: 'sentinel', state: 'locked', before: 'firewall' });
    expect(steps.find((e) => e.chapter === 'departure')!.state).toBe('no-key');
    expect(next).toBe(1);
  });
});
