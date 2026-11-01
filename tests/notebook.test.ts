// Le carnet du sysadmin : les commandes lancées une première fois, leur ligne
// du manuel, la première ligne tapée, et l'export en Markdown.

import { describe, expect, it } from 'vitest';
import { machinesInLanguage } from './names';
import { prerequisites } from '../src/engine/unlocking';
import { Console } from '../src/engine/console';
import { inMarkdown, note, description, type Notebook } from '../src/engine/notebook';
import { translator, LANGUAGES } from '../src/texts';
import { allSheets } from '../src/engine/sheets';
import { STORIES } from '../src/engine/chapters';

for (const language of LANGUAGES)
  describe(`Le carnet — ${language}`, () => {
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

    it('note chaque commande une seule fois, avec sa première ligne et son chapitre', () => {
      const { notebook, jouer: play } = part();
      play('ls -a | cat');
      play('ls');
      play('head -n 2 bienvenue.txt');
      play('ssh royaume');
      play('yes');
      play('pwd');
      expect(Object.keys(notebook).sort()).toEqual(['cat', 'ls', 'pwd', 'ssh']);
      expect(notebook.ls).toEqual({ line: 'ls -a | cat', chapter: '' });
      expect(notebook.cat.line).toBe('ls -a | cat');
      // head n'existe pas encore sur le poste : il n'entre pas au carnet.
      expect(notebook.head).toBeUndefined();
      expect(notebook.pwd.chapter).toBe('eveil');
    });

    it("ignore ce qui n'est pas une commande du jeu, mais garde man", () => {
      const { notebook, jouer: play } = part();
      play('frobnicate --now');
      play('man ls');
      play('sshd_config');
      expect(Object.keys(notebook)).toEqual(['man']);
    });

    it('exporte en Markdown, trié, avec la ligne du manuel', () => {
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

describe('Le carnet et la progression', () => {
  const t = translator('fr');
  it('le Markdown commence par les chapitres terminés, histoire par histoire', () => {
    const md = inMarkdown({}, t, ['eveil', 'bourg', 'fermer-la-porte']);
    expect(md).toContain('## Progression');
    expect(md).toMatch(/- L.Effaceur : 2 chapitres terminés sur 4/);
    expect(md).toMatch(/- Les Lettres du quartier : 1 chapitre terminé sur 9/);
    expect(md).toContain('Fermer la porte');
    expect(inMarkdown({}, t, [])).toContain('Aucun chapitre terminé');
  });
});

describe('Les fiches pour les enseignant·es', () => {
  it('chaque chapitre a sa fiche, ses commandes nouvelles une seule fois, une durée', () => {
    const all = allSheets();
    expect(all.length).toBe(STORIES.flatMap((h) => h.chapters).length);
    const views = all.flatMap((f) => f.fresh);
    expect(new Set(views).size).toBe(views.length);
    expect(all.find((f) => f.chapter.id === 'eveil')!.fresh).toContain('ls');
    expect(all.find((f) => f.chapter.id === 'goulot')!.fresh).toContain('iostat');
    expect(all.find((f) => f.chapter.id === 'bourg')!.before?.id).toBe('eveil');
    expect(all.every((f) => f.duration >= 15 && f.duration % 5 === 0)).toBe(true);
  });
});

describe('Le mode examen', () => {
  it("sans indice, mais l'étape finale et son débrief s'affichent", () => {
    const c = new Console({ language: 'fr', finished: ['eveil', 'bourg', 'racine', 'sauvegarde', ...prerequisites('lettres')] });
    c.exam = true;
    const play = (lines: string[]) => lines.map((l) => c.execute(machinesInLanguage(c.t, l)) ?? '').join('\n');
    // La Porte, avec la configuration de sshd : la faute de frappe ne donne plus d'indice.
    let all = play(['ssh lettres', 'yes']);
    c.execute('sudo nano /etc/ssh/sshd_config');
    c.execute(machinesInLanguage(c.t, 'fourmis-2026'));
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
    all = play(['sudo systemctl reload ssh', 'exit', 'ssh lettres']);
    expect(all).toContain('https://man.openbsd.org/sshd_config');
    expect(c.finished).toContain('fermer-la-porte');
  });
});
