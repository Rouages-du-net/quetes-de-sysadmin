// The map: the places visited, the path leading to them, the places glimpsed
// from them; nothing else (neither what is further away, nor hidden places
// not yet visited, nor files).
import { describe, expect, it } from 'vitest';
import { Shell } from '../src/engine/shell';
import { STORIES } from '../src/engine/chapters';
import { map, type Place } from '../src/engine/map';
import { LANGUAGES, translator } from '../src/texts';
import { inLanguage } from './names';
import { workstation } from '../src/engine/workstation';

const chapter = (id: string) => STORIES.flatMap((h) => h.chapters).find((c) => c.id === id)!;
// All the places on the map, by path.
const places = (l: Place): Record<string, Place> => Object.assign({ [l.path]: l }, ...l.children.map(places));

for (const language of LANGUAGES)
  describe(`Map in ${language}`, () => {
    const L = (text: string) => inLanguage(translator(language), text);

    it('at the start: home, what can be glimpsed from it, and the root', () => {
      const s = new Shell(chapter('lighthouse'), language);
      const c = places(map(s));
      expect(c['/'].visit).toBe(true);
      expect(c[L('/Hut')]).toMatchObject({ here: true, home: true, visit: true });
      expect(c[L('/Hut/Hill')]).toMatchObject({ visit: false, here: false });
      expect(c[L('/Hut/Pier')].visit).toBe(false);
      // Further than what can be glimpsed: nothing.
      expect(c[L('/Hut/Pier/Lighthouse')]).toBeUndefined();
      expect(c[L('/Hut/Hill/SignalSchool')]).toBeUndefined();
      // No files.
      expect(Object.keys(c).some((k) => k.endsWith('.txt'))).toBe(false);
    });

    it('moving on: the place visited, then what can be glimpsed from it; a closed place', () => {
      const s = new Shell(chapter('lighthouse'), language);
      s.execute(L('cd Pier'));
      let c = places(map(s));
      expect(c[L('/Hut/Pier')]).toMatchObject({ here: true, visit: true });
      expect(c[L('/Hut')]).toMatchObject({ here: false, home: true });
      // The Lighthouse is blocked by the net.
      expect(c[L('/Hut/Pier/Lighthouse')]).toMatchObject({ visit: false, closed: true });
      s.execute(L('cd ~/Hill/SignalSchool'));
      c = places(map(s));
      expect(c[L('/Hut/Hill')].visit).toBe(true);
      expect(c[L('/Hut/Hill/SignalSchool/PracticeRoom')].visit).toBe(false);
      expect(c[L('/Hut/Pier')]).toMatchObject({ visit: true, here: false });
    });

    it('a hidden place only appears once visited', () => {
      const s = new Shell(workstation([]), language);
      const ssh = `${s.home}/.ssh`;
      expect(places(map(s))[ssh]).toBeUndefined();
      s.execute('cd .ssh');
      expect(places(map(s))[ssh]).toMatchObject({ here: true, visit: true });
    });

    it('on a server: the real tree from /, other people\'s homes glimpsed in passing', () => {
      const c = places(map(new Shell(chapter('root'), language)));
      expect(c['/home'].visit).toBe(true);
      expect(c['/etc']).toMatchObject({ visit: false });
      expect(c['/home/nour']).toMatchObject({ visit: false });
    });
  });
