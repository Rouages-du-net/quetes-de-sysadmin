// The sysadmin's notebook: the commands run for the first time, their
// manual line, the first line typed, and the Markdown export.

import { describe, expect, it } from 'vitest';
import { machinesInLanguage } from './names';
import { prerequisites } from '../src/engine/unlocking';
import { Console } from '../src/engine/console';
import { inMarkdown, note, description, type Notebook } from '../src/engine/notebook';
import { translator, LANGUAGES } from '../src/texts';
import { allSheets } from '../src/engine/sheets';
import { STORIES } from '../src/engine/chapters';

for (const language of LANGUAGES)
  describe(`The notebook — ${language}`, () => {
    const t = translator(language);
    const part = () => {
      const c = new Console({ language });
      const notebook: Notebook = {};
      const play = (line: string) => {
        const sh = c.shell;
        const output = c.execute(machinesInLanguage(c.t, line));
        note(notebook, sh);
        return output;
      };
      return { c, notebook, jouer: play };
    };

    it('notes each command only once, with its first line and its chapter', () => {
      const { notebook, jouer: play } = part();
      play('ls -a | cat');
      play('ls');
      play('head -n 2 welcome.txt');
      play('ssh kingdom');
      play('yes');
      play('pwd');
      expect(Object.keys(notebook).sort()).toEqual(['cat', 'ls', 'pwd', 'ssh']);
      expect(notebook.ls).toEqual({ line: 'ls -a | cat', chapter: '' });
      expect(notebook.cat.line).toBe('ls -a | cat');
      // head does not exist yet on the workstation: it does not go into the notebook.
      expect(notebook.head).toBeUndefined();
      expect(notebook.pwd.chapter).toBe('lighthouse');
    });

    it("ignores what is not a command of the game, but keeps man", () => {
      const { notebook, jouer: play } = part();
      play('frobnicate --now');
      play('man ls');
      play('sshd_config');
      expect(Object.keys(notebook)).toEqual(['man']);
    });

    it('exports to Markdown, sorted, with the manual line', () => {
      const { notebook, jouer: play } = part();
      play('pwd');
      play('ls');
      const md = inMarkdown(notebook, t);
      expect(md.indexOf('## ls')).toBeLessThan(md.indexOf('## pwd'));
      expect(md).toContain('```\nls\n```');
      expect(md).toContain(`${description('ls', t)}.`);
      expect(md).toContain('man ls');
    });
  });

describe('The notebook and progress', () => {
  const t = translator('fr');
  it('the Markdown starts with the finished chapters, story by story', () => {
    const md = inMarkdown({}, t, ['lighthouse', 'village', 'shut-the-door']);
    expect(md).toContain('## Progression');
    expect(md).toMatch(/- L.Effaceur : 2 chapitres terminés sur 4/);
    expect(md).toMatch(/- Les Lettres du quartier : 1 chapitre terminé sur 9/);
    expect(md).toContain('Fermer la porte');
    expect(inMarkdown({}, t, [])).toContain('Aucun chapitre terminé');
  });
});

describe('The sheets for teachers', () => {
  it('each chapter has its sheet, its new commands only once, a duration', () => {
    const all = allSheets();
    expect(all.length).toBe(STORIES.flatMap((h) => h.chapters).length);
    const views = all.flatMap((f) => f.fresh);
    expect(new Set(views).size).toBe(views.length);
    expect(all.find((f) => f.chapter.id === 'lighthouse')!.fresh).toContain('ls');
    expect(all.find((f) => f.chapter.id === 'bottleneck')!.fresh).toContain('iostat');
    expect(all.find((f) => f.chapter.id === 'village')!.before?.id).toBe('lighthouse');
    expect(all.every((f) => f.duration >= 15 && f.duration % 5 === 0)).toBe(true);
  });
});

describe('Exam mode', () => {
  it("without hints, but the final step and its debrief are shown", () => {
    const c = new Console({ language: 'fr', finished: ['lighthouse', 'village', 'root', 'backup', ...prerequisites('letters')] });
    c.exam = true;
    const play = (lines: string[]) => lines.map((l) => c.execute(machinesInLanguage(c.t, l)) ?? '').join('\n');
    // The Door, with sshd's configuration: the typo no longer gives a hint.
    let all = play(['ssh letters', 'yes']);
    c.execute('sudo nano /etc/ssh/sshd_config');
    c.execute(machinesInLanguage(c.t, 'ants-2026'));
    c.save(c.edition!.text.replace('PermitRootLogin yes', 'PermitRootLogin non'));
    all += c.quitEdition();
    all += play(['sudo sshd -t']);
    expect(all).toContain('unsupported option "non"');
    expect(all).not.toContain('Il y a une erreur dans la configuration de SSH');
    c.execute('sudo nano /etc/ssh/sshd_config.d/00-hardening.conf');
    c.save('PermitRootLogin no\nPasswordAuthentication no\n');
    c.quitEdition();
    c.execute('sudo nano /etc/ssh/sshd_config');
    c.save(c.edition!.text.replace('PermitRootLogin non', 'PermitRootLogin no'));
    c.quitEdition();
    all = play(['sudo systemctl reload ssh', 'exit', 'ssh letters']);
    expect(all).toContain('https://man.openbsd.org/sshd_config');
    expect(c.finished).toContain('shut-the-door');
  });
});
