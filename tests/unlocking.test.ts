// Le déverrouillage graduel : les histoires s'ouvrent par vagues, chacune
// après les chapitres qu'elle déclare (apres), sans cycle, et toutes finissent
// par s'ouvrir.
import { describe, expect, it } from 'vitest';
import { STORIES } from '../src/engine/chapters';
import { missing, isOpen, prerequisites, FIRST } from '../src/engine/unlocking';
import { Console } from '../src/engine/console';
import { MACHINES, machineName } from '../src/engine/machines';
import { translator } from '../src/texts';
import { dayIncident, INCIDENTS, placeFor } from '../src/engine/on-call';

const storyFor = (chapter: string) => STORIES.find((h) => h.chapters.some((c) => c.id === chapter));

describe('Déverrouillage graduel', () => {
  it('chaque histoire, sauf la première, dit après quels chapitres elle s’ouvre', () => {
    for (const h of STORIES) {
      if (h.id === FIRST) {
        expect(h.after).toBeUndefined();
        continue;
      }
      expect(h.after?.length, h.id).toBeGreaterThan(0);
      // Des chapitres qui existent, dans d'autres histoires.
      for (const c of h.after!) expect([h.id, storyFor(c)?.id]).not.toEqual([h.id, h.id]);
      for (const c of h.after!) expect(storyFor(c), c).toBeDefined();
    }
  });

  it('en jouant tout ce qui est ouvert, toutes les histoires finissent par s’ouvrir (pas de cycle)', () => {
    const finished: string[] = [];
    const waves: string[][] = [];
    for (;;) {
      const openOnes = STORIES.filter((h) => isOpen(h.id, finished) && !h.chapters.every((c) => finished.includes(c.id)));
      if (!openOnes.length) break;
      waves.push(openOnes.map((h) => h.id));
      finished.push(...openOnes.flatMap((h) => h.chapters.map((c) => c.id)));
    }
    expect(STORIES.every((h) => isOpen(h.id, finished))).toBe(true);
    // Une seule histoire au départ, puis plusieurs vagues : tout n'est pas ouvert d'un coup.
    expect(waves[0]).toEqual([FIRST]);
    expect(waves.length).toBeGreaterThan(3);
  });

  it('prerequis : de quoi ouvrir une histoire, sans rien d’elle', () => {
    for (const h of STORIES) {
      const before = prerequisites(h.id);
      expect(isOpen(h.id, before), h.id).toBe(true);
      expect(before.some((c) => h.chapters.some((x) => x.id === c))).toBe(false);
      expect(new Set(before).size).toBe(before.length);
    }
    expect(missing('audit', ['sentinel'])).toEqual(['shared-rights']);
    expect(prerequisites('eraser')).toEqual([]);
  });

  it('le poste reçoit les clés vague par vague', () => {
    const keys = (finished: string[]) => new Console({ language: 'fr', finished }).workstation.execute('ls ~/.ssh') ?? '';
    const name = (h: string) => `id_${machineName(translator('fr'), MACHINES.find((m) => m.story === h)!.name)}`;
    const root = keys(['lighthouse', 'village', 'root']);
    expect(root).toContain(name('datacenter'));
    expect(root).not.toContain(name('fablab'));
    expect(root).not.toContain(name('audit'));
    expect(keys(prerequisites('fablab'))).toContain(name('fablab'));
  });

  it("l'incident du jour : parmi les histoires ouvertes", () => {
    expect(dayIncident('2027-01-19', () => false)).toBeNull();
    const only = (h: string) => (id: string) => id === h;
    const id = dayIncident('2027-01-19', only('datacenter'));
    expect(id && STORIES[placeFor(id).h].id).toBe('datacenter');
    // Toutes ouvertes : le tirage de toujours.
    expect(INCIDENTS).toContain(dayIncident('2027-01-19'));
  });
});
