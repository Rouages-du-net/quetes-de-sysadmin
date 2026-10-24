// L'astreinte : l'incident du jour (le même pour tout le monde un même jour),
// le budget d'erreur et sa jauge.
import { describe, expect, it } from 'vitest';
import { HISTOIRES } from '../src/moteur/chapitres';
import { BUDGET_MS, budgetRestant, COUT_ERREUR_MS, COUT_INDICE_MS, incidentDuJour, INCIDENTS, jauge, placeDe, pourcent } from '../src/moteur/astreinte';

const TOUS = HISTOIRES.flatMap((h) => h.chapitres.map((c) => c.id));

describe('Astreinte', () => {
  it('l’incident du jour : un chapitre existant, toujours le même pour une date, et qui change d’un jour à l’autre', () => {
    expect(INCIDENTS.every((id) => TOUS.includes(id))).toBe(true);
    expect(INCIDENTS).not.toContain('eveil');
    // Pas de chapitre qui dépend de ce que les précédents ont laissé sur le poste.
    const chapitre = (id: string) => HISTOIRES.flatMap((h) => h.chapitres).find((c) => c.id === id)!;
    expect(INCIDENTS.filter((id) => chapitre(id).surveillePoste || chapitre(id).clesDuJoueur)).toEqual([]);
    expect(INCIDENTS).not.toContain('rebond');
    expect(incidentDuJour('2026-10-24')).toBe(incidentDuJour('2026-10-24'));
    const mois = Array.from({ length: 31 }, (_, i) => incidentDuJour(`2026-10-${String(i + 1).padStart(2, '0')}`));
    expect(new Set(mois).size).toBeGreaterThan(10);
    const { h, c } = placeDe(incidentDuJour('2026-10-24'));
    expect(HISTOIRES[h].chapitres[c].id).toBe(incidentDuJour('2026-10-24'));
  });

  it('le budget fond avec le temps, les indices et les erreurs, sans passer sous zéro', () => {
    expect(budgetRestant(0, 0, 0)).toBe(BUDGET_MS);
    expect(budgetRestant(60_000, 1, 3)).toBe(BUDGET_MS - 60_000 - COUT_INDICE_MS - 3 * COUT_ERREUR_MS);
    expect(budgetRestant(BUDGET_MS * 2, 0, 0)).toBe(0);
    expect(pourcent(BUDGET_MS / 2)).toBe(50);
  });

  it('la jauge en cinq cases', () => {
    expect(jauge(BUDGET_MS)).toBe('🟩🟩🟩🟩🟩');
    expect(jauge(BUDGET_MS * 0.5)).toBe('🟩🟩🟨⬜⬜');
    expect(jauge(0)).toBe('⬜⬜⬜⬜⬜');
  });
});
