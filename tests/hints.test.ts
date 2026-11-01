// Graduated hints: every chapter has some, each targets a real step
// (an event of the chapter) and has its clue and its solution, in each
// language; they follow the game (the next step once the previous one is
// cleared). For a single story: npx vitest run tests/hints.test.ts -t eraser
import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { STORIES } from '../src/engine/chapters';
import { Shell } from '../src/engine/shell';
import { hint } from '../src/engine/hints';
import { LANGUAGES } from '../src/texts';

// A language's hint messages, with their attributes.
const messages = (language: string) => {
  const all: Record<string, string[]> = {};
  for (const f of readdirSync(`src/texts/${language}`).filter((n) => n.startsWith('hints-'))) {
    let active = '';
    for (const l of readFileSync(`src/texts/${language}/${f}`, 'utf8').split('\n')) {
      const m = /^(hint-[a-z0-9-]+) =/.exec(l);
      if (m) all[(active = m[1])] = [];
      const a = /^\s+\.([a-z]+) =/.exec(l);
      if (a && active) all[active].push(a[1]);
    }
  }
  return all;
};

for (const h of STORIES)
  describe(`Hints: ${h.id}`, () => {
    for (const language of LANGUAGES) {
      const all = messages(language);
      it(`${language}: each chapter has hints, on its real steps, with clue and solution`, () => {
        for (const c of h.chapters) {
          const valid = new Set(c.events.map((e) => `hint-${c.id}-${e.id}`));
          const itsOwn = Object.keys(all).filter((id) => valid.has(id));
          expect(itsOwn.length, `${language} : ${c.id} n'a aucun indice`).toBeGreaterThan(0);
          for (const id of itsOwn) expect(all[id].sort(), `${language} : ${id}`).toEqual(['lead', 'solution']);
          for (const e of c.steps ?? []) expect(c.events.some((x) => x.id === e), `${c.id} : étape ${e}`).toBe(true);
          // At the start of the chapter, a hint is there.
          expect(hint(new Shell(c, language)).step, `${language} : ${c.id}`).not.toBeNull();
        }
      });
    }
  });

describe('Hints: messages without a chapter', () => {
  it('every hint message targets an event that exists', () => {
    const valid = new Set(STORIES.flatMap((h) => h.chapters.flatMap((c) => c.events.map((e) => `hint-${c.id}-${e.id}`))));
    for (const language of LANGUAGES) for (const id of Object.keys(messages(language))) expect(valid.has(id), `${language} : ${id}`).toBe(true);
  });

  it('the hint follows the game (eraser, chapter 1)', () => {
    const s = new Shell(STORIES[0].chapters[0], 'fr');
    expect(hint(s).step).toBe('crab');
    s.execute('mv Colline/EcoleDesSignaux/SalleDExercice/crabe Colline/EcoleDesSignaux/SalleDExercice/Seau');
    expect(hint(s).step).toBe('net');
    s.execute('mv Jetee/filet Port/Hangar');
    expect(hint(s)).toMatchObject({ step: 'light', manual: ['ls', 'cd', 'pwd', 'cat', 'less', 'mv'] });
    s.execute('mv Port/Remise/.ampoule_de_secours Jetee/Phare/Escalier/Lanterne/ampoule');
    expect(hint(s).step).toBeNull();
  });
});
