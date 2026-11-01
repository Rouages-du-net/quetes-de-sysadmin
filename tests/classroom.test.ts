// Le tableau de classe : les fichiers et les codes des élèves, lus sans
// serveur ; le CSV, sans formule injectable.
import { describe, expect, it } from 'vitest';
import { progress, fileStudent, codesStudents, inCsv, gradeFor, bestTime, type Student } from '../src/engine/classroom';
import { progressCode, backupFile } from '../src/engine/progress';

describe('Le tableau de classe', () => {
  it('lit un fichier de sauvegarde : nom, chapitres, succès, records, date', () => {
    const text = backupFile(
      { finished: ['lighthouse', 'village', 'root', 'backup', 'keys'], name: 'Lina', achievements: { pipe: 'x', manual: 'y' }, records: { lighthouse: 90_000, village: 61_000 } },
      new Date('2027-01-15T10:00:00Z'),
    );
    const e = fileStudent('lina.json', text) as Student;
    expect(e).toMatchObject({ name: 'Lina', source: 'lina.json', achievements: 2, date: '2027-01-15T10:00:00.000Z' });
    expect(gradeFor(e)).toBe('junior');
    expect(bestTime(e)).toBe(61_000);
    expect(progress(e, 'eraser')).toEqual({ done: 4, total: 4 });
    expect(progress(e, 'community-centre')).toEqual({ done: 1, total: 5 });
  });

  it('sans nom dans le fichier, celui du fichier ; un fichier étranger est signalé', () => {
    expect((fileStudent('sacha.json', backupFile({ finished: [] }, new Date())) as Student).name).toBe('sacha');
    expect(fileStudent('photo.json', '{"a":1}')).toEqual({ source: 'photo.json', error: 'file-other' });
  });

  it('lit des codes, un par ligne, avec ou sans nom', () => {
    const code = progressCode(['lighthouse', 'village']);
    const [lina, anonymous, no] = codesStudents(`Lina B. : ${code}\n\n${code.toLowerCase()}\nNour QDS-ZZZZ-ZZZZ`);
    expect(lina).toMatchObject({ name: 'Lina B.', finished: ['lighthouse', 'village'] });
    expect(anonymous).toMatchObject({ name: code.toLowerCase(), finished: ['lighthouse', 'village'] });
    expect(no).toMatchObject({ error: expect.stringMatching(/^code-/) });
  });

  it('le CSV neutralise les formules et les séparateurs', () => {
    const e = { name: '=HYPERLINK("x";"y")', source: 'f', finished: [], achievements: 0, records: {}, date: null };
    const csv = inCsv([e, { ...e, name: 'Ana;Bé' }], ['Nom', 'Chapitres'], (x) => [x.name, x.finished.length]);
    expect(csv).toBe(`Nom;Chapitres\n"'=HYPERLINK(""x"";""y"")";0\n"Ana;Bé";0`);
  });
});
