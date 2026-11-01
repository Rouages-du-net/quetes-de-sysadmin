// Achievements: earned on what really happened, each with its
// texts in each language; the easter eggs; the rank.
import { describe, expect, it } from 'vitest';
import { Shell } from '../src/engine/shell';
import { STORIES } from '../src/engine/chapters';
import { grade, newAchievements, ACHIEVEMENTS } from '../src/engine/achievements';
import { readFile, backupFile } from '../src/engine/progress';
import { LANGUAGES, translator } from '../src/texts';

const awakening = STORIES[0].chapters[0];
const ALL = STORIES.flatMap((h) => h.chapters.map((c) => c.id));

describe('Achievements', () => {
  it('have a name and a description in each language', () => {
    for (const language of LANGUAGES) {
      const t = translator(language);
      for (const s of ACHIEVEMENTS) {
        expect(t.exists(`achievements-${s.id}`), `${language} : ${s.id}`).toBe(true);
        expect(t(`achievements-${s.id}.description`), `${language} : ${s.id}`).not.toBe(`achievements-${s.id}.description`);
      }
    }
  });

  it('are earned on the typed line: ls -a, a pipe, a redirection', () => {
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
    // Already earned: not a second time.
    expect(newAchievements(ctx, { redirection: '2027-01-01' })).toEqual([]);
  });

  it('are earned on progress: chapters, stories, exam', () => {
    const ctx = { sh: null, finished: ['lighthouse', 'village', 'root', 'backup'], notebook: { man: { line: 'man ls', chapter: 'lighthouse' } }, records: { lighthouse: 4 * 60_000 } };
    expect(newAchievements(ctx, {})).toEqual(['first-command', 'manual', 'first-chapter', 'eraser', 'restore', 'exam', 'exam-lightning']);
  });

  it('the easter eggs answer, and give their hidden achievement', () => {
    const s = new Shell(awakening, 'fr');
    expect(s.execute('xyzzy')).toBe('Nothing happens.');
    expect(s.execute('make me a sandwich')).toBe('What? Make it yourself.');
    expect(s.execute('sudo   make me a sandwich')).toBe('Okay.');
    expect(s.execute('sl')).toContain('_D _|');
    expect(newAchievements({ sh: s, finished: [], notebook: {}, records: {} }, {})).toEqual(['xyzzy', 'sandwich', 'sl']);
    expect(ACHIEVEMENTS.filter((x) => x.cache).map((x) => x.id)).toEqual(['xyzzy', 'sandwich', 'sl']);
  });

  it('the rank follows the finished chapters', () => {
    expect(grade([])).toBe('intern');
    expect(grade(['lighthouse'])).toBe('apprentice');
    expect(grade(ALL.slice(0, 4))).toBe('junior');
    expect(grade(ALL.slice(0, 15))).toBe('admin');
    expect(grade(ALL)).toBe('sre');
  });

  it('travel with the save file, without unknown achievements', () => {
    const read = readFile(backupFile({ achievements: { pipe: '2027-01-15T10:00:00.000Z', invente: 'x' } as Record<string, string> }, new Date()));
    expect('backup' in read && read.backup.achievements).toEqual({ pipe: '2027-01-15T10:00:00.000Z' });
  });
});
