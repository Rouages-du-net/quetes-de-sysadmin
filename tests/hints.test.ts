// Les indices gradués : chaque chapitre en a, chacun vise une vraie étape
// (un événement du chapitre) et a sa piste et sa solution, dans chaque
// langue ; ils suivent la partie (l'étape suivante une fois la précédente
// franchie). Pour une seule histoire : npx vitest run tests/hints.test.ts -t effaceur
import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { STORIES } from '../src/engine/chapters';
import { Shell } from '../src/engine/shell';
import { hint } from '../src/engine/hints';
import { LANGUAGES } from '../src/texts';

// Les messages d'indice d'une langue, avec leurs attributs.
const messages = (language: string) => {
  const all: Record<string, string[]> = {};
  for (const f of readdirSync(`src/texts/${language}`).filter((n) => n.startsWith('indices-'))) {
    let active = '';
    for (const l of readFileSync(`src/texts/${language}/${f}`, 'utf8').split('\n')) {
      const m = /^(indice-[a-z0-9-]+) =/.exec(l);
      if (m) all[(active = m[1])] = [];
      const a = /^\s+\.([a-z]+) =/.exec(l);
      if (a && active) all[active].push(a[1]);
    }
  }
  return all;
};

for (const h of STORIES)
  describe(`Indices : ${h.id}`, () => {
    for (const language of LANGUAGES) {
      const all = messages(language);
      it(`${language} : chaque chapitre a des indices, sur ses vraies étapes, avec piste et solution`, () => {
        for (const c of h.chapters) {
          const valid = new Set(c.events.map((e) => `indice-${c.id}-${e.id}`));
          const itsOwn = Object.keys(all).filter((id) => valid.has(id));
          expect(itsOwn.length, `${language} : ${c.id} n'a aucun indice`).toBeGreaterThan(0);
          for (const id of itsOwn) expect(all[id].sort(), `${language} : ${id}`).toEqual(['piste', 'solution']);
          for (const e of c.steps ?? []) expect(c.events.some((x) => x.id === e), `${c.id} : étape ${e}`).toBe(true);
          // Au début du chapitre, un indice est là.
          expect(hint(new Shell(c, language)).step, `${language} : ${c.id}`).not.toBeNull();
        }
      });
    }
  });

describe('Indices : messages sans chapitre', () => {
  it('tout message d’indice vise un événement qui existe', () => {
    const valid = new Set(STORIES.flatMap((h) => h.chapters.flatMap((c) => c.events.map((e) => `indice-${c.id}-${e.id}`))));
    for (const language of LANGUAGES) for (const id of Object.keys(messages(language))) expect(valid.has(id), `${language} : ${id}`).toBe(true);
  });

  it('l’indice suit la partie (effaceur, chapitre 1)', () => {
    const s = new Shell(STORIES[0].chapters[0], 'fr');
    expect(hint(s).step).toBe('crabe');
    s.execute('mv Colline/EcoleDesSignaux/SalleDExercice/crabe Colline/EcoleDesSignaux/SalleDExercice/Seau');
    expect(hint(s).step).toBe('filet');
    s.execute('mv Jetee/filet Port/Hangar');
    expect(hint(s)).toMatchObject({ step: 'lumiere', manual: ['ls', 'cd', 'pwd', 'cat', 'less', 'mv'] });
    s.execute('mv Port/Remise/.ampoule_de_secours Jetee/Phare/Escalier/Lanterne/ampoule');
    expect(hint(s).step).toBeNull();
  });
});
