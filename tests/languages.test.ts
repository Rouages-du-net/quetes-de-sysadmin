// The languages of the game and of the site: complete or draft
// (src/texts/languages.json). A draft is built but not offered (the root's
// redirection, the pages' language links), and plays a story it doesn't
// translate yet with that story's English world, while the commands answer
// in the language.
import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { COMPLETE_LANGUAGES, LANGUAGES, isComplete, storyTranslated, translator } from '../src/texts';
import { PAGES, offered, SITE_LANGUAGES } from '../src/site-languages';
import { Shell } from '../src/engine/shell';
import { Console } from '../src/engine/console';
import { STORIES } from '../src/engine/chapters';
import { MACHINES, machineName } from '../src/engine/machines';
import { name, password } from '../src/engine/world';
import { config } from '../src/engine/workstation';
import INFO from '../src/texts/languages.json';

const chapter = (id: string) => STORIES.flatMap((h) => h.chapters).find((c) => c.id === id)!;
const drafts = LANGUAGES.filter((l) => !isComplete(l));

describe('Languages', () => {
  it('every language with texts is listed in languages.json, English and French complete', () => {
    expect(LANGUAGES.filter((l) => !(l in INFO.languages))).toEqual([]);
    expect(COMPLETE_LANGUAGES).toEqual(expect.arrayContaining(['en', 'fr']));
  });

  it('the root sends browsers only to the complete languages (public/.htaccess)', () => {
    const rules = readFileSync('public/.htaccess', 'utf8')
      .split('\n')
      .filter((l) => !l.trim().startsWith('#'))
      .flatMap((l) => [.../Accept-Language\}\s+\^([a-z-]+)/i.exec(l)?.slice(1) ?? []]);
    expect(rules.sort()).toEqual(COMPLETE_LANGUAGES.filter((l) => l !== 'en').sort());
  });

  it('each page exists in every language of the site, and links only to complete languages', () => {
    for (const page of [PAGES.home, PAGES.teachers, PAGES.classTable, PAGES.sheet('eraser')])
      for (const l of SITE_LANGUAGES) expect(page[l as keyof typeof page], `${l}`).toMatch(new RegExp(`^/${l}/`));
    for (const l of SITE_LANGUAGES) expect(offered(l, PAGES.home).every((o) => isComplete(o.lang))).toBe(true);
    for (const l of drafts) expect(offered('en', PAGES.home).map((o) => o.lang)).not.toContain(l);
    // The pages of a language are where PAGES says (src/pages/<language>/).
    for (const l of SITE_LANGUAGES) expect(readdirSync(`src/pages/${l}`)).toEqual(expect.arrayContaining(['index.astro', 'feed.xml.ts', 'manifest.webmanifest.ts']));
  });

  it('a complete language translates every story', () => {
    for (const l of COMPLETE_LANGUAGES) for (const h of STORIES) expect(storyTranslated(l, h.id)).toBe(true);
  });
});

for (const language of drafts)
  describe(`A draft: ${language}`, () => {
    const t = translator(language);
    // A story the draft doesn't translate yet (none once every story is in the language).
    const untranslated = STORIES.find((h) => !storyTranslated(language, h.id) && h.chapters[0].names);
    // The machine of a story the draft doesn't translate yet, whose name the language does translate.
    const untranslatedMachine = MACHINES.find(
      (m) => m.story && !storyTranslated(language, m.story) && t.exists(`machine-${m.name}`) && t(`machine-${m.name}`) !== m.name,
    )?.name;

    it('a translated story has its world in the language', () => {
      expect(storyTranslated(language, 'eraser')).toBe(true);
      const s = new Shell(chapter('lighthouse'), language);
      expect(s.home).toBe(`/${name(t, 'Hut')}`);
      expect(name(t, 'Hut')).not.toBe('Hut');
      expect(machineName(t, 'kingdom')).not.toBe('kingdom');
    });

    it.skipIf(!untranslated || !untranslatedMachine)("a story it doesn't translate yet keeps its English world, and the commands answer in the language", () => {
      const s = new Shell(untranslated!.chapters[0], language);
      expect(s.t.language).toBe(language);
      expect(name(s.t, 'message.txt')).toBe('message.txt');
      expect(password(s.t, 'flour-2028')).toBe('flour-2028');
      // The machine keeps its English name, on the workstation too.
      expect(machineName(t, untranslatedMachine!)).toBe(untranslatedMachine);
      // The player's account is the language's everywhere: the workstation's ssh config logs in with it.
      expect(name(s.t, 'you')).toBe(name(t, 'you'));
      expect(s.execute('cat nothing-here')).toBe(t('error-missing', { command: 'cat', target: 'nothing-here' }));
    });

    it("the workstation names each machine as its story does", () => {
      const c = new Console({ language });
      const ssh = config(c.t);
      expect(ssh).toContain(`Host ${machineName(t, 'kingdom')}\n`);
      if (untranslatedMachine) expect(ssh).toContain(`Host ${untranslatedMachine}\n`);
    });
  });
