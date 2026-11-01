// The network plan: each chapter that has one shows its story's
// machine and its internal machines there; the diagram overlaps nothing; the
// markers (you are here, already connected) follow the game.
import { describe, expect, it } from 'vitest';
import { STORIES } from '../src/engine/chapters';
import { storyMachine } from '../src/engine/machines';
import { layOut, landmarks, type ElementPlan } from '../src/engine/plan';
import { Console } from '../src/engine/console';
import { LANGUAGES, translator } from '../src/texts';

const all = (e: ElementPlan): ElementPlan[] => [e, ...(e.children ?? []).flatMap(all)];
const ERASER = ['lighthouse', 'village', 'root', 'backup'];

for (const language of LANGUAGES)
  describe(`Network plan in ${language}`, () => {
    const t = translator(language);

    it('stories with a network have a plan at every chapter, with their machines', () => {
      for (const id of ['community-centre', 'hive']) {
        const h = STORIES.find((x) => x.id === id)!;
        for (const c of h.chapters) {
          expect(c.plan, c.id).toBeDefined();
          const elements = all(c.plan!(t));
          const hosts = elements.map((e) => e.host).filter(Boolean);
          expect(hosts, c.id).toContain('desk');
          expect(hosts, c.id).toContain(storyMachine(id)!.name);
          for (const internal of Object.keys(c.hosts ?? {})) expect(hosts, `${c.id} : ${internal}`).toContain(internal);
          // Nothing empty, and documentation or private addresses.
          for (const e of elements) {
            expect(e.name, c.id).not.toBe('');
            if (e.address && /^\d/.test(e.address)) expect(e.address, `${c.id} : ${e.name}`).toMatch(/^(192\.0\.2|198\.51\.100|203\.0\.113|10)\./);
          }
        }
      }
    });

    it('the plan grows through The Hive: remote work, DMZ, Annex, Wi-Fi access point', () => {
      const plan = (id: string) => all(STORIES.find((h) => h.id === 'hive')!.chapters.find((c) => c.id === id)!.plan!(t)).map((e) => e.name);
      expect(plan('vlan')).not.toContain('web');
      expect(plan('dmz')).toContain('web');
      expect(plan('dmz')).not.toContain('borne-wifi');
      expect(plan('wifi')).toEqual(expect.arrayContaining(['web', 'borne-wifi', 'malik-laptop', t('plan-annex')]));
    });

    it('the diagram overlaps no box, and each parent sits between its children', () => {
      for (const c of STORIES.flatMap((h) => h.chapters).filter((x) => x.plan)) {
        const { places } = layOut(c.plan!(t));
        const keys = places.map((p) => `${p.column}:${p.line}`);
        expect(new Set(keys).size, c.id).toBe(keys.length);
        for (const p of places.filter((x) => x.parent)) expect(p.column, c.id).toBe(p.parent!.column + 1);
      }
    });

    it('you are here, and the machines you have connected to', () => {
      const c = new Console({ language, finished: ERASER });
      const plan = STORIES.find((h) => h.id === 'hive')!.chapters[0].plan!(t);
      const hive = all(plan).find((e) => e.host === 'hive')!;
      expect(landmarks(hive, c.shell.host, c.visited)).toEqual({ here: false, visit: false });
      c.connect('hive');
      expect(landmarks(hive, c.shell.host, c.visited)).toEqual({ here: true, visit: true });
      c.execute('exit');
      expect(landmarks(hive, c.shell.host, c.visited)).toEqual({ here: false, visit: true });
    });
  });
