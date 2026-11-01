// Le plan du réseau : chaque chapitre qui en a un y montre la machine de
// son histoire et ses machines internes ; le schéma ne superpose rien ; les
// repères (tu es ici, déjà connecté·e) suivent la partie.
import { describe, expect, it } from 'vitest';
import { STORIES } from '../src/engine/chapters';
import { storyMachine } from '../src/engine/machines';
import { layOut, landmarks, type ElementPlan } from '../src/engine/plan';
import { Console } from '../src/engine/console';
import { LANGUAGES, translator } from '../src/texts';

const all = (e: ElementPlan): ElementPlan[] => [e, ...(e.children ?? []).flatMap(all)];
const ERASER = ['lighthouse', 'village', 'root', 'backup'];

for (const language of LANGUAGES)
  describe(`Plan du réseau en ${language}`, () => {
    const t = translator(language);

    it('les histoires à réseau ont un plan à chaque chapitre, avec leurs machines', () => {
      for (const id of ['community-centre', 'hive']) {
        const h = STORIES.find((x) => x.id === id)!;
        for (const c of h.chapters) {
          expect(c.plan, c.id).toBeDefined();
          const elements = all(c.plan!(t));
          const hosts = elements.map((e) => e.host).filter(Boolean);
          expect(hosts, c.id).toContain('poste');
          expect(hosts, c.id).toContain(storyMachine(id)!.name);
          for (const internal of Object.keys(c.hosts ?? {})) expect(hosts, `${c.id} : ${internal}`).toContain(internal);
          // Rien de vide, et des adresses de documentation ou privées.
          for (const e of elements) {
            expect(e.name, c.id).not.toBe('');
            if (e.address && /^\d/.test(e.address)) expect(e.address, `${c.id} : ${e.name}`).toMatch(/^(192\.0\.2|198\.51\.100|203\.0\.113|10)\./);
          }
        }
      }
    });

    it('le plan grandit au fil de La Ruche : télétravail, DMZ, Annexe, borne Wi-Fi', () => {
      const plan = (id: string) => all(STORIES.find((h) => h.id === 'hive')!.chapters.find((c) => c.id === id)!.plan!(t)).map((e) => e.name);
      expect(plan('vlan')).not.toContain('web');
      expect(plan('dmz')).toContain('web');
      expect(plan('dmz')).not.toContain('borne-wifi');
      expect(plan('wifi')).toEqual(expect.arrayContaining(['web', 'borne-wifi', 'malik-laptop', t('plan-annexe')]));
    });

    it('le schéma ne superpose aucune boîte, et chaque parent est entre ses enfants', () => {
      for (const c of STORIES.flatMap((h) => h.chapters).filter((x) => x.plan)) {
        const { places } = layOut(c.plan!(t));
        const keys = places.map((p) => `${p.column}:${p.line}`);
        expect(new Set(keys).size, c.id).toBe(keys.length);
        for (const p of places.filter((x) => x.parent)) expect(p.column, c.id).toBe(p.parent!.column + 1);
      }
    });

    it('tu es ici, et les machines où l’on s’est connecté·e', () => {
      const c = new Console({ language, finished: ERASER });
      const plan = STORIES.find((h) => h.id === 'hive')!.chapters[0].plan!(t);
      const hive = all(plan).find((e) => e.host === 'ruche')!;
      expect(landmarks(hive, c.shell.host, c.visited)).toEqual({ here: false, visit: false });
      c.connect('ruche');
      expect(landmarks(hive, c.shell.host, c.visited)).toEqual({ here: true, visit: true });
      c.execute('exit');
      expect(landmarks(hive, c.shell.host, c.visited)).toEqual({ here: false, visit: true });
    });
  });
