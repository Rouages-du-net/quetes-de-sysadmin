// On call: the incident of the day (the same for everyone on a given day),
// the error budget and its gauge.
import { describe, expect, it } from 'vitest';
import { STORIES } from '../src/engine/chapters';
import { BUDGET_MS, remainingBudget, MS_ERROR_COST, MS_HINT_COST, dayIncident, INCIDENTS, gauge, placeFor, percent } from '../src/engine/on-call';

const ALL = STORIES.flatMap((h) => h.chapters.map((c) => c.id));

describe('On call', () => {
  it('the incident of the day: an existing chapter, always the same for a date, and one that changes from one day to the next', () => {
    expect(INCIDENTS.every((id) => ALL.includes(id))).toBe(true);
    expect(INCIDENTS).not.toContain('lighthouse');
    // No chapter that depends on what the previous ones left on the workstation.
    const chapter = (id: string) => STORIES.flatMap((h) => h.chapters).find((c) => c.id === id)!;
    expect(INCIDENTS.filter((id) => chapter(id).watchesWorkstation || chapter(id).playerKeys)).toEqual([]);
    expect(INCIDENTS).not.toContain('jump');
    expect(dayIncident('2026-10-24')).toBe(dayIncident('2026-10-24'));
    const month = Array.from({ length: 31 }, (_, i) => dayIncident(`2026-10-${String(i + 1).padStart(2, '0')}`));
    expect(new Set(month).size).toBeGreaterThan(10);
    const { h, c } = placeFor(dayIncident('2026-10-24')!);
    expect(STORIES[h].chapters[c].id).toBe(dayIncident('2026-10-24'));
  });

  it('the budget melts with time, hints and errors, without going below zero', () => {
    expect(remainingBudget(0, 0, 0)).toBe(BUDGET_MS);
    expect(remainingBudget(60_000, 1, 3)).toBe(BUDGET_MS - 60_000 - MS_HINT_COST - 3 * MS_ERROR_COST);
    expect(remainingBudget(BUDGET_MS * 2, 0, 0)).toBe(0);
    expect(percent(BUDGET_MS / 2)).toBe(50);
  });

  it('the gauge in five boxes', () => {
    expect(gauge(BUDGET_MS)).toBe('🟩🟩🟩🟩🟩');
    expect(gauge(BUDGET_MS * 0.5)).toBe('🟩🟩🟨⬜⬜');
    expect(gauge(0)).toBe('⬜⬜⬜⬜⬜');
  });
});
