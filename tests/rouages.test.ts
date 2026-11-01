// Les liens vers Les rouages du net : chaque chapitre cité existe, chaque page
// a son adresse et le texte de son lien, dans chaque langue.

import { describe, expect, it } from 'vitest';
import { CHAPTERS } from '../src/engine/chapters';
import { ROUAGES_LINKS, ROUAGES_PAGES, rouagesLinks } from '../src/engine/rouages';
import { LANGUAGES, translator } from '../src/texts';

describe('Liens vers Les rouages du net', () => {
  it('chaque chapitre cité existe, et chaque page citée a son adresse', () => {
    const ids = CHAPTERS.map((c) => c.id);
    for (const [chapter, pages] of Object.entries(ROUAGES_LINKS)) {
      expect(ids).toContain(chapter);
      for (const p of pages) expect(ROUAGES_PAGES[p]).toMatch(/^\/(modules\/[a-z-]+\/#[a-z-]+|glossaire\/#[a-z-]+)$/);
    }
  });
  it('chaque page a le texte de son lien', () => {
    for (const language of LANGUAGES) {
      const t = translator(language);
      for (const id of Object.keys(ROUAGES_PAGES)) expect(t.exists(`rouages-lien-${id}`)).toBe(true);
    }
  });
  it('un chapitre donne des adresses complètes vers rouages.net', () => {
    expect(rouagesLinks('certificate')[0].address).toBe('https://rouages.net/modules/entree-a-la-page/#cadenas');
    expect(rouagesLinks('lighthouse')).toEqual([]);
  });
});
