// L'astreinte : l'incident du jour (le même pour tout le monde un même jour),
// le budget d'erreur et sa jauge.
import { describe, expect, it } from 'vitest';
import { STORIES } from '../src/engine/chapters';
import { BUDGET_MS, remainingBudget, MS_ERROR_COST, MS_HINT_COST, dayIncident, INCIDENTS, gauge, placeFor, percent } from '../src/engine/on-call';

const ALL = STORIES.flatMap((h) => h.chapters.map((c) => c.id));

describe('Astreinte', () => {
  it('l’incident du jour : un chapitre existant, toujours le même pour une date, et qui change d’un jour à l’autre', () => {
    expect(INCIDENTS.every((id) => ALL.includes(id))).toBe(true);
    expect(INCIDENTS).not.toContain('lighthouse');
    // Pas de chapitre qui dépend de ce que les précédents ont laissé sur le poste.
    const chapter = (id: string) => STORIES.flatMap((h) => h.chapters).find((c) => c.id === id)!;
    expect(INCIDENTS.filter((id) => chapter(id).watchesWorkstation || chapter(id).playerKeys)).toEqual([]);
    expect(INCIDENTS).not.toContain('jump');
    expect(dayIncident('2026-10-24')).toBe(dayIncident('2026-10-24'));
    const month = Array.from({ length: 31 }, (_, i) => dayIncident(`2026-10-${String(i + 1).padStart(2, '0')}`));
    expect(new Set(month).size).toBeGreaterThan(10);
    const { h, c } = placeFor(dayIncident('2026-10-24')!);
    expect(STORIES[h].chapters[c].id).toBe(dayIncident('2026-10-24'));
  });

  it('le budget fond avec le temps, les indices et les erreurs, sans passer sous zéro', () => {
    expect(remainingBudget(0, 0, 0)).toBe(BUDGET_MS);
    expect(remainingBudget(60_000, 1, 3)).toBe(BUDGET_MS - 60_000 - MS_HINT_COST - 3 * MS_ERROR_COST);
    expect(remainingBudget(BUDGET_MS * 2, 0, 0)).toBe(0);
    expect(percent(BUDGET_MS / 2)).toBe(50);
  });

  it('la jauge en cinq cases', () => {
    expect(gauge(BUDGET_MS)).toBe('🟩🟩🟩🟩🟩');
    expect(gauge(BUDGET_MS * 0.5)).toBe('🟩🟩🟨⬜⬜');
    expect(gauge(0)).toBe('⬜⬜⬜⬜⬜');
  });
});
