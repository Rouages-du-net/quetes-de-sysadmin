// Les parcours thématiques : des chapitres qui existent, chacun dans au moins
// un parcours, des textes dans chaque langue, et l'état de chaque étape.
import { describe, expect, it } from 'vitest';
import { STORIES } from '../src/engine/chapters';
import { pathSteps, PATH } from '../src/engine/paths';
import { LANGUAGES, translator } from '../src/texts';

const ALL = STORIES.flatMap((h) => h.chapters.map((c) => c.id));

describe('Parcours thématiques', () => {
  it('des chapitres qui existent, sans doublon, et chaque chapitre dans au moins un parcours', () => {
    for (const p of PATH) {
      expect(p.chapters.filter((id) => !ALL.includes(id))).toEqual([]);
      expect(new Set(p.chapters).size).toBe(p.chapters.length);
    }
    const covered = new Set(PATH.flatMap((p) => p.chapters));
    expect(ALL.filter((id) => !covered.has(id))).toEqual([]);
  });

  it('dans un parcours, les chapitres d’une même histoire gardent l’ordre de l’histoire', () => {
    for (const p of PATH) {
      const rank = (id: string) => ALL.indexOf(id);
      for (const h of STORIES) {
        const here = p.chapters.filter((id) => h.chapters.some((c) => c.id === id)).map(rank);
        expect(here).toEqual([...here].sort((a, b) => a - b));
      }
    }
  });

  for (const language of LANGUAGES)
    it(`un titre et une description en ${language}`, () => {
      const t = translator(language);
      for (const p of PATH) {
        expect(t.exists(`path-${p.id}`)).toBe(true);
        expect(t.exists(`path-${p.id}.description`)).toBe(true);
      }
    });

  it('l’état des étapes : fait, ouvert, verrouillé (avec le chapitre à finir d’abord), sans clé', () => {
    const security = PATH.find((p) => p.id === 'security')!;
    const { steps, next } = pathSteps(security, ['shut-the-door'], (h) => h !== 'coop');
    expect(steps[0].state).toBe('done');
    expect(steps[1]).toMatchObject({ chapter: 'firewall', state: 'open' });
    expect(steps[2]).toMatchObject({ chapter: 'sentinel', state: 'locked', before: 'firewall' });
    expect(steps.find((e) => e.chapter === 'departure')!.state).toBe('no-key');
    expect(next).toBe(1);
  });
});
