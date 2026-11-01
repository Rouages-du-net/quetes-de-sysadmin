// Les succès : obtenus sur ce qui s'est vraiment passé, chacun avec ses
// textes dans chaque langue ; les clins d'œil ; le grade.
import { describe, expect, it } from 'vitest';
import { Shell } from '../src/engine/shell';
import { STORIES } from '../src/engine/chapters';
import { grade, newAchievements, ACHIEVEMENTS } from '../src/engine/achievements';
import { readFile, backupFile } from '../src/engine/progress';
import { LANGUAGES, translator } from '../src/texts';

const awakening = STORIES[0].chapters[0];
const ALL = STORIES.flatMap((h) => h.chapters.map((c) => c.id));

describe('Les succès', () => {
  it('ont un nom et une description dans chaque langue', () => {
    for (const language of LANGUAGES) {
      const t = translator(language);
      for (const s of ACHIEVEMENTS) {
        expect(t.exists(`achievements-${s.id}`), `${language} : ${s.id}`).toBe(true);
        expect(t(`achievements-${s.id}.description`), `${language} : ${s.id}`).not.toBe(`achievements-${s.id}.description`);
      }
    }
  });

  it('se gagnent sur la ligne tapée : ls -a, un tube, une redirection', () => {
    const s = new Shell(awakening, 'fr');
    const ctx = { sh: s, finished: [], notebook: {}, records: {} };
    s.execute('ls');
    expect(newAchievements(ctx, {})).toEqual([]);
    s.execute('ls -a');
    expect(newAchievements(ctx, {})).toEqual(['cache-ls']);
    s.execute('ls | grep txt');
    expect(newAchievements(ctx, {})).toEqual(['pipe']);
    s.execute('ls > liste');
    expect(newAchievements(ctx, {})).toEqual(['redirection']);
    // Déjà obtenu : pas une deuxième fois.
    expect(newAchievements(ctx, { redirection: '2027-01-01' })).toEqual([]);
  });

  it('se gagnent sur la progression : chapitres, histoires, examen', () => {
    const ctx = { sh: null, finished: ['lighthouse', 'village', 'root', 'backup'], notebook: { man: { line: 'man ls', chapter: 'lighthouse' } }, records: { lighthouse: 4 * 60_000 } };
    expect(newAchievements(ctx, {})).toEqual(['first-command', 'manual', 'first-chapter', 'eraser', 'restore', 'exam', 'exam-lightning']);
  });

  it('les clins d’œil répondent, et donnent leur succès caché', () => {
    const s = new Shell(awakening, 'fr');
    expect(s.execute('xyzzy')).toBe('Nothing happens.');
    expect(s.execute('make me a sandwich')).toBe('What? Make it yourself.');
    expect(s.execute('sudo   make me a sandwich')).toBe('Okay.');
    expect(s.execute('sl')).toContain('_D _|');
    expect(newAchievements({ sh: s, finished: [], notebook: {}, records: {} }, {})).toEqual(['xyzzy', 'sandwich', 'sl']);
    expect(ACHIEVEMENTS.filter((x) => x.cache).map((x) => x.id)).toEqual(['xyzzy', 'sandwich', 'sl']);
  });

  it('le grade suit les chapitres terminés', () => {
    expect(grade([])).toBe('intern');
    expect(grade(['lighthouse'])).toBe('apprentice');
    expect(grade(ALL.slice(0, 4))).toBe('junior');
    expect(grade(ALL.slice(0, 15))).toBe('admin');
    expect(grade(ALL)).toBe('sre');
  });

  it('voyagent avec le fichier de sauvegarde, sans succès inconnu', () => {
    const read = readFile(backupFile({ achievements: { pipe: '2027-01-15T10:00:00.000Z', invente: 'x' } as Record<string, string> }, new Date()));
    expect('backup' in read && read.backup.achievements).toEqual({ pipe: '2027-01-15T10:00:00.000Z' });
  });
});
