// The links to Les rouages du net: each chapter cited exists, each page has
// its address and its link text, in each language.

import { describe, expect, it } from 'vitest';
import { CHAPTERS } from '../src/engine/chapters';
import { ROUAGES_LINKS, ROUAGES_PAGES, rouagesLinks } from '../src/engine/rouages';
import { LANGUAGES, translator } from '../src/texts';

describe('Links to Les rouages du net', () => {
  it('each chapter cited exists, and each page cited has its address', () => {
    const ids = CHAPTERS.map((c) => c.id);
    for (const [chapter, pages] of Object.entries(ROUAGES_LINKS)) {
      expect(ids).toContain(chapter);
      for (const p of pages) expect(ROUAGES_PAGES[p]).toMatch(/^\/(modules\/[a-z-]+\/#[a-z-]+|glossaire\/#[a-z-]+)$/);
    }
  });
  it('each page has its link text', () => {
    for (const language of LANGUAGES) {
      const t = translator(language);
      for (const id of Object.keys(ROUAGES_PAGES)) expect(t.exists(`rouages-link-${id}`)).toBe(true);
    }
  });
  it('a chapter gives full addresses to rouages.net', () => {
    expect(rouagesLinks('certificate')[0].address).toBe('https://rouages.net/modules/entree-a-la-page/#cadenas');
    expect(rouagesLinks('lighthouse')).toEqual([]);
  });
});
