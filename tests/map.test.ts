// La carte : les lieux visités, le chemin qui y mène, les lieux aperçus
// depuis eux ; rien d'autre (ni ce qui est plus loin, ni les lieux cachés
// pas encore visités, ni les fichiers).
import { describe, expect, it } from 'vitest';
import { Shell } from '../src/engine/shell';
import { STORIES } from '../src/engine/chapters';
import { map, type Place } from '../src/engine/map';
import { LANGUAGES, translator } from '../src/texts';
import { inLanguage } from './names';
import { workstation } from '../src/engine/workstation';

const chapter = (id: string) => STORIES.flatMap((h) => h.chapters).find((c) => c.id === id)!;
// Tous les lieux de la carte, par chemin.
const places = (l: Place): Record<string, Place> => Object.assign({ [l.path]: l }, ...l.children.map(places));

for (const language of LANGUAGES)
  describe(`Carte en ${language}`, () => {
    const L = (text: string) => inLanguage(translator(language), text);

    it('au départ : la maison, ce qu’on y aperçoit, et la racine', () => {
      const s = new Shell(chapter('lighthouse'), language);
      const c = places(map(s));
      expect(c['/'].visit).toBe(true);
      expect(c[L('/Hut')]).toMatchObject({ here: true, home: true, visit: true });
      expect(c[L('/Hut/Hill')]).toMatchObject({ visit: false, here: false });
      expect(c[L('/Hut/Pier')].visit).toBe(false);
      // Plus loin que ce qu'on aperçoit : rien.
      expect(c[L('/Hut/Pier/Lighthouse')]).toBeUndefined();
      expect(c[L('/Hut/Hill/SignalSchool')]).toBeUndefined();
      // Pas de fichiers.
      expect(Object.keys(c).some((k) => k.endsWith('.txt'))).toBe(false);
    });

    it('en avançant : le lieu visité, puis ce qu’on y aperçoit ; un lieu fermé', () => {
      const s = new Shell(chapter('lighthouse'), language);
      s.execute(L('cd Pier'));
      let c = places(map(s));
      expect(c[L('/Hut/Pier')]).toMatchObject({ here: true, visit: true });
      expect(c[L('/Hut')]).toMatchObject({ here: false, home: true });
      // Le Phare est bloqué par le filet.
      expect(c[L('/Hut/Pier/Lighthouse')]).toMatchObject({ visit: false, closed: true });
      s.execute(L('cd ~/Hill/SignalSchool'));
      c = places(map(s));
      expect(c[L('/Hut/Hill')].visit).toBe(true);
      expect(c[L('/Hut/Hill/SignalSchool/PracticeRoom')].visit).toBe(false);
      expect(c[L('/Hut/Pier')]).toMatchObject({ visit: true, here: false });
    });

    it('un lieu caché n’y paraît qu’une fois visité', () => {
      const s = new Shell(workstation([]), language);
      const ssh = `${s.home}/.ssh`;
      expect(places(map(s))[ssh]).toBeUndefined();
      s.execute('cd .ssh');
      expect(places(map(s))[ssh]).toMatchObject({ here: true, visit: true });
    });

    it('sur un serveur : la vraie arborescence depuis /, les maisons des autres aperçues en passant', () => {
      const c = places(map(new Shell(chapter('root'), language)));
      expect(c['/home'].visit).toBe(true);
      expect(c['/etc']).toMatchObject({ visit: false });
      expect(c['/home/nour']).toMatchObject({ visit: false });
    });
  });
