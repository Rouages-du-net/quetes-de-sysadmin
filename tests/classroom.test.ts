// The class table: the students' files and codes, read without a server;
// the CSV, with no injectable formula.
import { describe, expect, it } from 'vitest';
import {
  progress,
  fileStudent,
  codesStudents,
  inCsv,
  gradeFor,
  bestTime,
  streakFor,
  csvSeparator,
  csvCell,
  csvTable,
  csvFile,
  exportTable,
  BOM,
  type Student,
  type ExportLabels,
} from '../src/engine/classroom';
import { CATALOGUE } from '../src/engine/catalogue';
import { progressCode, backupFile, type OnCallResult } from '../src/engine/progress';

describe('The class table', () => {
  it('reads a save file: name, chapters, achievements, records, date', () => {
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

  it('with no name in the file, the file\'s name; a foreign file is reported', () => {
    expect((fileStudent('sacha.json', backupFile({ finished: [] }, new Date())) as Student).name).toBe('sacha');
    expect(fileStudent('photo.json', '{"a":1}')).toEqual({ source: 'photo.json', error: 'file-other' });
  });

  it('reads codes, one per line, with or without a name', () => {
    const code = progressCode(['lighthouse', 'village']);
    const [lina, anonymous, no] = codesStudents(`Lina B. : ${code}\n\n${code.toLowerCase()}\nNour QDS-ZZZZ-ZZZZ`);
    expect(lina).toMatchObject({ name: 'Lina B.', finished: ['lighthouse', 'village'] });
    expect(anonymous).toMatchObject({ name: code.toLowerCase(), finished: ['lighthouse', 'village'] });
    expect(no).toMatchObject({ error: expect.stringMatching(/^code-/) });
  });

  it('the CSV neutralises formulas and separators', () => {
    const e: Student = { name: '=HYPERLINK("x";"y")', source: 'f', finished: [], achievements: 0, records: {}, date: null, onCall: null };
    const csv = inCsv([e, { ...e, name: 'Ana;Bé' }], ['Nom', 'Chapitres'], (x) => [x.name, x.finished.length]);
    expect(csv).toBe(`Nom;Chapitres\r\n"'=HYPERLINK(""x"";""y"")";0\r\n"Ana;Bé";0`);
  });

  it('a cell: quotes, separators, line breaks, formulas, accents', () => {
    expect(csvCell('Zoé Lefèvre', ',')).toBe('Zoé Lefèvre');
    expect(csvCell('Lefèvre, Zoé', ',')).toBe('"Lefèvre, Zoé"');
    // The other separator needs no quotes.
    expect(csvCell('Lefèvre, Zoé', ';')).toBe('Lefèvre, Zoé');
    expect(csvCell('Ana;Bé', ';')).toBe('"Ana;Bé"');
    expect(csvCell('Le "chef"', ',')).toBe('"Le ""chef"""');
    expect(csvCell('two\nlines', ',')).toBe('"two\nlines"');
    expect(csvCell('cr\rhere', ',')).toBe('"cr\rhere"');
    for (const f of ['=1+1', '+33 6', '-2+3', '@SUM(A1)', '\tx', '\rx']) expect(csvCell(f, ',').replace(/^"/, '')).toMatch(/^'/);
    expect(csvCell('=A1,B1', ',')).toBe(`"'=A1,B1"`);
    // A number stays a number, even negative; a text with = inside is no formula.
    expect(csvCell(-3, ',')).toBe('-3');
    expect(csvCell(12, ';')).toBe('12');
    expect(csvCell('a=b', ',')).toBe('a=b');
    expect(csvTable([['a', 'b'], [1, 'c,d']], ',')).toBe('a,b\r\n1,"c,d"');
    expect(csvFile([['é']], ',')).toBe('﻿é');
    expect(BOM).toBe('﻿');
  });

  it('the separator a spreadsheet expects: a comma in English, a semicolon in French', () => {
    expect(csvSeparator('en')).toBe(',');
    expect(csvSeparator('fr')).toBe(';');
    expect(csvSeparator('de')).toBe(';');
  });

  const solved: OnCallResult = { chapter: 'lighthouse', remaining: 10, time: 60_000, hints: 0, errors: 0 };

  it('the on-call streak travels with a file, not with a code', () => {
    const text = backupFile({ finished: [], onCall: { '2027-03-01': solved, '2027-03-02': solved, '2027-03-03': solved } }, new Date('2027-03-03T18:00:00Z'));
    const e = fileStudent('mei.json', text) as Student;
    expect(e.onCall).toEqual(['2027-03-01', '2027-03-02', '2027-03-03']);
    expect(streakFor(e, '2027-03-03')).toEqual({ current: 3, best: 3 });
    expect(streakFor(e, '2027-03-20')).toEqual({ current: 0, best: 3 });
    const [code] = codesStudents(`Mei ${progressCode(['lighthouse'])}`) as Student[];
    expect(streakFor(code, '2027-03-03')).toBeNull();
  });

  it('the export: headers, numbers rather than fractions, one column per chapter', () => {
    const labels: ExportLabels = {
      student: 'Élève',
      chapters: 'Chapitres terminés',
      grade: 'Grade',
      achievements: 'Succès',
      exam: 'Examen',
      date: 'Sauvegarde',
      streak: 'Série',
      bestStreak: 'Meilleure série',
      story: (s, n) => `${s} (sur ${n})`,
      chapter: (s, c, n) => `${s} ${n} : ${c}`,
      gradeName: (g) => `grade:${g}`,
      when: (iso) => iso.slice(0, 10),
      time: (ms) => `${ms / 1000} s`,
    };
    const lina = fileStudent(
      'lina.json',
      backupFile({ finished: ['lighthouse', 'village', 'root', 'backup', 'keys'], name: 'Lina', records: { lighthouse: 90_000 }, onCall: { '2027-01-15': solved } }, new Date('2027-01-15T10:00:00Z')),
    ) as Student;
    const [nour] = codesStudents(`=Nour ${progressCode(['lighthouse'])}`) as Student[];
    const rows = exportTable([lina, nour], labels, '2027-01-15');
    const chapters = CATALOGUE.flatMap((h) => h.chapters);
    expect(rows).toHaveLength(3);
    expect(rows[0].slice(0, 8)).toEqual(['Élève', 'Chapitres terminés', 'Grade', 'Succès', 'Examen', 'Sauvegarde', 'Série', 'Meilleure série']);
    expect(rows[0]).toHaveLength(8 + CATALOGUE.length + chapters.length);
    expect(rows[0][8]).toBe(`eraser (sur ${CATALOGUE[0].chapters.length})`);
    expect(rows[0][8 + CATALOGUE.length]).toBe('eraser 1 : lighthouse');
    expect(rows[1].slice(0, 9)).toEqual(['Lina', 5, 'grade:junior', 0, '90 s', '2027-01-15', 1, 1, 4]);
    const column = (id: string) => 8 + CATALOGUE.length + chapters.findIndex((c) => c.id === id);
    expect(rows[1][column('keys')]).toBe(1);
    expect(rows[2][column('keys')]).toBe(0);
    // A code: no date, no exam time, no streak.
    expect(rows[2].slice(0, 9)).toEqual(['=Nour', 1, 'grade:apprentice', 0, '', '', '', '', 1]);
    // In the file, the formula is neutralised, the accents kept.
    const csv = csvFile(rows, ';');
    expect(csv.startsWith('﻿Élève;Chapitres terminés;')).toBe(true);
    expect(csv).toContain("\r\n'=Nour;1;");
  });
});
