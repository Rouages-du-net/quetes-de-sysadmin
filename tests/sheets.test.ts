// The teachers' sheets and the printable story sheets: what they draw from
// the stories (manual pages, the debriefs' documentation, the solution
// route of the teacher's version), in every language.
import { describe, expect, it } from 'vitest';
import { STORIES } from '../src/engine/chapters';
import { allSheets, storySheets, manualPages, documentation, solutionRoute, hours } from '../src/engine/sheets';
import { LANGUAGES, translator } from '../src/texts';

const chapter = (id: string) => STORIES.flatMap((h) => h.chapters).find((c) => c.id === id)!;

describe('The printable story sheets', () => {
  it('one sheet per chapter of the story, in order', () => {
    expect(storySheets('eraser').map((s) => s.chapter.id)).toEqual(STORIES[0].chapters.map((c) => c.id));
    expect(STORIES.flatMap((h) => storySheets(h.id))).toHaveLength(allSheets().length);
  });

  it('the manual pages to read: the new commands, with their summary', () => {
    const sheet = allSheets().find((s) => s.chapter.id === 'firewall')!;
    const pages = manualPages(sheet, translator('en'));
    expect(pages.map((p) => p.name)).toEqual(sheet.fresh.filter((c) => pages.some((p) => p.name === c)));
    const ufw = pages.find((p) => p.name === 'ufw');
    expect(ufw?.whatis).toMatch(/firewall/);
    expect(ufw?.whatis).not.toMatch(/\.$/);
    expect(manualPages(sheet, translator('fr')).find((p) => p.name === 'ufw')?.whatis).toMatch(/pare-feu/);
  });

  it("the documentation of the debrief, in each language", () => {
    expect(documentation(chapter('firewall'), translator('en'))).toEqual([
      { label: 'ufw', url: 'https://manpages.ubuntu.com/manpages/noble/man8/ufw.8.html' },
      { label: 'ss', url: 'https://man7.org/linux/man-pages/man8/ss.8.html' },
    ]);
    expect(documentation(chapter('firewall'), translator('fr')).map((d) => d.label)).toEqual(['ufw', 'ss']);
  });

  it('the solution route: each step\'s lead and solution, in the game\'s order', () => {
    const route = solutionRoute(chapter('expiry-date'), translator('en'));
    expect(route.length).toBeGreaterThan(3);
    expect(route[0].solution).toMatch(/openssl s_client/);
    expect(route.at(-1)!.solution).toMatch(/curl --cacert/);
  });

  it('every chapter, in every language: debriefs read without a game, addresses only https', () => {
    for (const language of LANGUAGES) {
      const t = translator(language);
      for (const s of allSheets()) {
        for (const d of documentation(s.chapter, t)) expect(d.url).toMatch(/^https:\/\/[^\s<>"]+$/);
        expect(() => solutionRoute(s.chapter, t)).not.toThrow();
        expect(() => manualPages(s, t)).not.toThrow();
      }
    }
    // Most chapters point to their documentation.
    const t = translator('en');
    expect(allSheets().filter((s) => documentation(s.chapter, t).length).length).toBeGreaterThan(allSheets().length / 2);
  });

  it('durations, written for each language', () => {
    expect(hours(45, 'en')).toBe('45 min');
    expect(hours(60, 'en')).toBe('1 h');
    expect(hours(65, 'en')).toBe('1 h 05 min');
    expect(hours(65, 'fr')).toBe('1 h 05');
  });
});
