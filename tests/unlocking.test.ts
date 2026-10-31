// Le déverrouillage graduel : les histoires s'ouvrent par vagues, chacune
// après les chapitres qu'elle déclare (apres), sans cycle, et toutes finissent
// par s'ouvrir.
import { describe, expect, it } from 'vitest';
import { HISTOIRES } from '../src/engine/chapters';
import { manquants, ouverte, prerequis, PREMIERE } from '../src/engine/unlocking';
import { Console } from '../src/engine/console';
import { MACHINES } from '../src/engine/machines';
import { incidentDuJour, INCIDENTS, placeDe } from '../src/engine/on-call';

const histoireDe = (chapitre: string) => HISTOIRES.find((h) => h.chapitres.some((c) => c.id === chapitre));

describe('Déverrouillage graduel', () => {
  it('chaque histoire, sauf la première, dit après quels chapitres elle s’ouvre', () => {
    for (const h of HISTOIRES) {
      if (h.id === PREMIERE) {
        expect(h.apres).toBeUndefined();
        continue;
      }
      expect(h.apres?.length, h.id).toBeGreaterThan(0);
      // Des chapitres qui existent, dans d'autres histoires.
      for (const c of h.apres!) expect([h.id, histoireDe(c)?.id]).not.toEqual([h.id, h.id]);
      for (const c of h.apres!) expect(histoireDe(c), c).toBeDefined();
    }
  });

  it('en jouant tout ce qui est ouvert, toutes les histoires finissent par s’ouvrir (pas de cycle)', () => {
    const termines: string[] = [];
    const vagues: string[][] = [];
    for (;;) {
      const ouvertes = HISTOIRES.filter((h) => ouverte(h.id, termines) && !h.chapitres.every((c) => termines.includes(c.id)));
      if (!ouvertes.length) break;
      vagues.push(ouvertes.map((h) => h.id));
      termines.push(...ouvertes.flatMap((h) => h.chapitres.map((c) => c.id)));
    }
    expect(HISTOIRES.every((h) => ouverte(h.id, termines))).toBe(true);
    // Une seule histoire au départ, puis plusieurs vagues : tout n'est pas ouvert d'un coup.
    expect(vagues[0]).toEqual([PREMIERE]);
    expect(vagues.length).toBeGreaterThan(3);
  });

  it('prerequis : de quoi ouvrir une histoire, sans rien d’elle', () => {
    for (const h of HISTOIRES) {
      const avant = prerequis(h.id);
      expect(ouverte(h.id, avant), h.id).toBe(true);
      expect(avant.some((c) => h.chapitres.some((x) => x.id === c))).toBe(false);
      expect(new Set(avant).size).toBe(avant.length);
    }
    expect(manquants('audit', ['sentinelle'])).toEqual(['droits']);
    expect(prerequis('effaceur')).toEqual([]);
  });

  it('le poste reçoit les clés vague par vague', () => {
    const cles = (termines: string[]) => new Console({ langue: 'fr', termines }).poste.executer('ls ~/.ssh') ?? '';
    const nom = (h: string) => `id_${MACHINES.find((m) => m.histoire === h)!.nom}`;
    const racine = cles(['eveil', 'bourg', 'racine']);
    expect(racine).toContain(nom('datacenter'));
    expect(racine).not.toContain(nom('fabrique'));
    expect(racine).not.toContain(nom('audit'));
    expect(cles(prerequis('fabrique'))).toContain(nom('fabrique'));
  });

  it("l'incident du jour : parmi les histoires ouvertes", () => {
    expect(incidentDuJour('2027-01-19', () => false)).toBeNull();
    const seule = (h: string) => (id: string) => id === h;
    const id = incidentDuJour('2027-01-19', seule('datacenter'));
    expect(id && HISTOIRES[placeDe(id).h].id).toBe('datacenter');
    // Toutes ouvertes : le tirage de toujours.
    expect(INCIDENTS).toContain(incidentDuJour('2027-01-19'));
  });
});
