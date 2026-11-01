// Gradual unlocking: stories open in waves, each one after the chapters
// it declares (after), with no cycle, and all of them eventually open.
import { describe, expect, it } from 'vitest';
import { STORIES } from '../src/engine/chapters';
import { missing, isOpen, prerequisites, FIRST } from '../src/engine/unlocking';
import { Console } from '../src/engine/console';
import { MACHINES, machineName } from '../src/engine/machines';
import { translator } from '../src/texts';
import { dayIncident, INCIDENTS, placeFor } from '../src/engine/on-call';

const storyFor = (chapter: string) => STORIES.find((h) => h.chapters.some((c) => c.id === chapter));

describe('Gradual unlocking', () => {
  it('every story, except the first, says after which chapters it opens', () => {
    for (const h of STORIES) {
      if (h.id === FIRST) {
        expect(h.after).toBeUndefined();
        continue;
      }
      expect(h.after?.length, h.id).toBeGreaterThan(0);
      // Chapters that exist, in other stories.
      for (const c of h.after!) expect([h.id, storyFor(c)?.id]).not.toEqual([h.id, h.id]);
      for (const c of h.after!) expect(storyFor(c), c).toBeDefined();
    }
  });

  it('playing everything open, all stories eventually open (no cycle)', () => {
    const finished: string[] = [];
    const waves: string[][] = [];
    for (;;) {
      const openOnes = STORIES.filter((h) => isOpen(h.id, finished) && !h.chapters.every((c) => finished.includes(c.id)));
      if (!openOnes.length) break;
      waves.push(openOnes.map((h) => h.id));
      finished.push(...openOnes.flatMap((h) => h.chapters.map((c) => c.id)));
    }
    expect(STORIES.every((h) => isOpen(h.id, finished))).toBe(true);
    // A single story at start, then several waves: not everything opens at once.
    expect(waves[0]).toEqual([FIRST]);
    expect(waves.length).toBeGreaterThan(3);
  });

  it('prerequisites: what opens a story, with nothing of its own', () => {
    for (const h of STORIES) {
      const before = prerequisites(h.id);
      expect(isOpen(h.id, before), h.id).toBe(true);
      expect(before.some((c) => h.chapters.some((x) => x.id === c))).toBe(false);
      expect(new Set(before).size).toBe(before.length);
    }
    expect(missing('audit', ['sentinel'])).toEqual(['shared-rights']);
    expect(prerequisites('eraser')).toEqual([]);
  });

  it('the workstation receives the keys wave by wave', () => {
    const keys = (finished: string[]) => new Console({ language: 'fr', finished }).workstation.execute('ls ~/.ssh') ?? '';
    const name = (h: string) => `id_${machineName(translator('fr'), MACHINES.find((m) => m.story === h)!.name)}`;
    const root = keys(['lighthouse', 'village', 'root']);
    expect(root).toContain(name('datacenter'));
    expect(root).not.toContain(name('fablab'));
    expect(root).not.toContain(name('audit'));
    expect(keys(prerequisites('fablab'))).toContain(name('fablab'));
  });

  it("the incident of the day: among the open stories", () => {
    expect(dayIncident('2027-01-19', () => false)).toBeNull();
    const only = (h: string) => (id: string) => id === h;
    const id = dayIncident('2027-01-19', only('datacenter'));
    expect(id && STORIES[placeFor(id).h].id).toBe('datacenter');
    // All open: the usual draw.
    expect(INCIDENTS).toContain(dayIncident('2027-01-19'));
  });
});
