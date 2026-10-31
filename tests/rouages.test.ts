// Les liens vers Les rouages du net : chaque chapitre cité existe, chaque page
// a son adresse et le texte de son lien, dans chaque langue.

import { describe, expect, it } from 'vitest';
import { CHAPITRES } from '../src/engine/chapters';
import { LIENS_ROUAGES, PAGES_ROUAGES, liensRouages } from '../src/engine/rouages';
import { LANGUES, traducteur } from '../src/texts';

describe('Liens vers Les rouages du net', () => {
  it('chaque chapitre cité existe, et chaque page citée a son adresse', () => {
    const ids = CHAPITRES.map((c) => c.id);
    for (const [chapitre, pages] of Object.entries(LIENS_ROUAGES)) {
      expect(ids).toContain(chapitre);
      for (const p of pages) expect(PAGES_ROUAGES[p]).toMatch(/^\/(modules\/[a-z-]+\/#[a-z-]+|glossaire\/#[a-z-]+)$/);
    }
  });
  it('chaque page a le texte de son lien', () => {
    for (const langue of LANGUES) {
      const t = traducteur(langue);
      for (const id of Object.keys(PAGES_ROUAGES)) expect(t.existe(`rouages-lien-${id}`)).toBe(true);
    }
  });
  it('un chapitre donne des adresses complètes vers rouages.net', () => {
    expect(liensRouages('certificat')[0].adresse).toBe('https://rouages.net/modules/entree-a-la-page/#cadenas');
    expect(liensRouages('eveil')).toEqual([]);
  });
});
