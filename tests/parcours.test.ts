// Les parcours thématiques : des chapitres qui existent, chacun dans au moins
// un parcours, des textes dans chaque langue, et l'état de chaque étape.
import { describe, expect, it } from 'vitest';
import { HISTOIRES } from '../src/moteur/chapitres';
import { etapesParcours, PARCOURS } from '../src/moteur/parcours';
import { LANGUES, traducteur } from '../src/textes';

const TOUS = HISTOIRES.flatMap((h) => h.chapitres.map((c) => c.id));

describe('Parcours thématiques', () => {
  it('des chapitres qui existent, sans doublon, et chaque chapitre dans au moins un parcours', () => {
    for (const p of PARCOURS) {
      expect(p.chapitres.filter((id) => !TOUS.includes(id))).toEqual([]);
      expect(new Set(p.chapitres).size).toBe(p.chapitres.length);
    }
    const couverts = new Set(PARCOURS.flatMap((p) => p.chapitres));
    expect(TOUS.filter((id) => !couverts.has(id))).toEqual([]);
  });

  it('dans un parcours, les chapitres d’une même histoire gardent l’ordre de l’histoire', () => {
    for (const p of PARCOURS) {
      const rang = (id: string) => TOUS.indexOf(id);
      for (const h of HISTOIRES) {
        const ici = p.chapitres.filter((id) => h.chapitres.some((c) => c.id === id)).map(rang);
        expect(ici).toEqual([...ici].sort((a, b) => a - b));
      }
    }
  });

  for (const langue of LANGUES)
    it(`un titre et une description en ${langue}`, () => {
      const t = traducteur(langue);
      for (const p of PARCOURS) {
        expect(t.existe(`parcours-${p.id}`)).toBe(true);
        expect(t.existe(`parcours-${p.id}.description`)).toBe(true);
      }
    });

  it('l’état des étapes : fait, ouvert, verrouillé (avec le chapitre à finir d’abord), sans clé', () => {
    const securite = PARCOURS.find((p) => p.id === 'securite')!;
    const { etapes, prochain } = etapesParcours(securite, ['fermer-la-porte'], (h) => h !== 'cooperative');
    expect(etapes[0].etat).toBe('fait');
    expect(etapes[1]).toMatchObject({ chapitre: 'pare-feu', etat: 'ouvert' });
    expect(etapes[2]).toMatchObject({ chapitre: 'sentinelle', etat: 'verrouille', avant: 'pare-feu' });
    expect(etapes.find((e) => e.chapitre === 'depart')!.etat).toBe('sans-cle');
    expect(prochain).toBe(1);
  });
});
