// Le tableau de classe : les fichiers et les codes des élèves, lus sans
// serveur ; le CSV, sans formule injectable.
import { describe, expect, it } from 'vitest';
import { avancee, eleveDeFichier, elevesDeCodes, enCSV, gradeDe, meilleurTemps, type Eleve } from '../src/engine/classroom';
import { codeDeProgression, fichierDeSauvegarde } from '../src/engine/progress';

describe('Le tableau de classe', () => {
  it('lit un fichier de sauvegarde : nom, chapitres, succès, records, date', () => {
    const texte = fichierDeSauvegarde(
      { termines: ['eveil', 'bourg', 'racine', 'sauvegarde', 'cles'], nom: 'Lina', succes: { tube: 'x', manuel: 'y' }, records: { eveil: 90_000, bourg: 61_000 } },
      new Date('2027-01-15T10:00:00Z'),
    );
    const e = eleveDeFichier('lina.json', texte) as Eleve;
    expect(e).toMatchObject({ nom: 'Lina', source: 'lina.json', succes: 2, date: '2027-01-15T10:00:00.000Z' });
    expect(gradeDe(e)).toBe('junior');
    expect(meilleurTemps(e)).toBe(61_000);
    expect(avancee(e, 'effaceur')).toEqual({ faits: 4, total: 4 });
    expect(avancee(e, 'maison')).toEqual({ faits: 1, total: 5 });
  });

  it('sans nom dans le fichier, celui du fichier ; un fichier étranger est signalé', () => {
    expect((eleveDeFichier('sacha.json', fichierDeSauvegarde({ termines: [] }, new Date())) as Eleve).nom).toBe('sacha');
    expect(eleveDeFichier('photo.json', '{"a":1}')).toEqual({ source: 'photo.json', erreur: 'fichier-autre' });
  });

  it('lit des codes, un par ligne, avec ou sans nom', () => {
    const code = codeDeProgression(['eveil', 'bourg']);
    const [lina, anonyme, faux] = elevesDeCodes(`Lina B. : ${code}\n\n${code.toLowerCase()}\nNour QDS-ZZZZ-ZZZZ`);
    expect(lina).toMatchObject({ nom: 'Lina B.', termines: ['eveil', 'bourg'] });
    expect(anonyme).toMatchObject({ nom: code.toLowerCase(), termines: ['eveil', 'bourg'] });
    expect(faux).toMatchObject({ erreur: expect.stringMatching(/^code-/) });
  });

  it('le CSV neutralise les formules et les séparateurs', () => {
    const e = { nom: '=HYPERLINK("x";"y")', source: 'f', termines: [], succes: 0, records: {}, date: null };
    const csv = enCSV([e, { ...e, nom: 'Ana;Bé' }], ['Nom', 'Chapitres'], (x) => [x.nom, x.termines.length]);
    expect(csv).toBe(`Nom;Chapitres\n"'=HYPERLINK(""x"";""y"")";0\n"Ana;Bé";0`);
  });
});
