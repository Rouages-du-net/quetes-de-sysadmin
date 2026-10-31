// Les indices gradués : chaque chapitre en a, chacun vise une vraie étape
// (un événement du chapitre) et a sa piste et sa solution, dans chaque
// langue ; ils suivent la partie (l'étape suivante une fois la précédente
// franchie). Pour une seule histoire : npx vitest run tests/hints.test.ts -t effaceur
import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { HISTOIRES } from '../src/engine/chapters';
import { Shell } from '../src/engine/shell';
import { indice } from '../src/engine/hints';
import { LANGUES } from '../src/texts';

// Les messages d'indice d'une langue, avec leurs attributs.
const messages = (langue: string) => {
  const tous: Record<string, string[]> = {};
  for (const f of readdirSync(`src/texts/${langue}`).filter((n) => n.startsWith('indices-'))) {
    let courant = '';
    for (const l of readFileSync(`src/texts/${langue}/${f}`, 'utf8').split('\n')) {
      const m = /^(indice-[a-z0-9-]+) =/.exec(l);
      if (m) tous[(courant = m[1])] = [];
      const a = /^\s+\.([a-z]+) =/.exec(l);
      if (a && courant) tous[courant].push(a[1]);
    }
  }
  return tous;
};

for (const h of HISTOIRES)
  describe(`Indices : ${h.id}`, () => {
    for (const langue of LANGUES) {
      const tous = messages(langue);
      it(`${langue} : chaque chapitre a des indices, sur ses vraies étapes, avec piste et solution`, () => {
        for (const c of h.chapitres) {
          const valides = new Set(c.evenements.map((e) => `indice-${c.id}-${e.id}`));
          const siens = Object.keys(tous).filter((id) => valides.has(id));
          expect(siens.length, `${langue} : ${c.id} n'a aucun indice`).toBeGreaterThan(0);
          for (const id of siens) expect(tous[id].sort(), `${langue} : ${id}`).toEqual(['piste', 'solution']);
          for (const e of c.etapes ?? []) expect(c.evenements.some((x) => x.id === e), `${c.id} : étape ${e}`).toBe(true);
          // Au début du chapitre, un indice est là.
          expect(indice(new Shell(c, langue)).etape, `${langue} : ${c.id}`).not.toBeNull();
        }
      });
    }
  });

describe('Indices : messages sans chapitre', () => {
  it('tout message d’indice vise un événement qui existe', () => {
    const valides = new Set(HISTOIRES.flatMap((h) => h.chapitres.flatMap((c) => c.evenements.map((e) => `indice-${c.id}-${e.id}`))));
    for (const langue of LANGUES) for (const id of Object.keys(messages(langue))) expect(valides.has(id), `${langue} : ${id}`).toBe(true);
  });

  it('l’indice suit la partie (effaceur, chapitre 1)', () => {
    const s = new Shell(HISTOIRES[0].chapitres[0], 'fr');
    expect(indice(s).etape).toBe('crabe');
    s.executer('mv Colline/EcoleDesSignaux/SalleDExercice/crabe Colline/EcoleDesSignaux/SalleDExercice/Seau');
    expect(indice(s).etape).toBe('filet');
    s.executer('mv Jetee/filet Port/Hangar');
    expect(indice(s)).toMatchObject({ etape: 'lumiere', manuel: ['ls', 'cd', 'pwd', 'cat', 'less', 'mv'] });
    s.executer('mv Port/Remise/.ampoule_de_secours Jetee/Phare/Escalier/Lanterne/ampoule');
    expect(indice(s).etape).toBeNull();
  });
});
