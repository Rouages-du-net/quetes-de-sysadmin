// Le carnet du sysadmin : les commandes lancées une première fois, leur ligne
// du manuel, la première ligne tapée, et l'export en Markdown.

import { describe, expect, it } from 'vitest';
import { Console } from '../src/moteur/console';
import { enMarkdown, noter, description, type Carnet } from '../src/moteur/carnet';
import { traducteur, LANGUES } from '../src/textes';

for (const langue of LANGUES)
  describe(`Le carnet — ${langue}`, () => {
    const t = traducteur(langue);
    const partie = () => {
      const c = new Console({ langue });
      const carnet: Carnet = {};
      const jouer = (ligne: string) => {
        const sh = c.shell;
        const sortie = c.executer(ligne);
        noter(carnet, sh);
        return sortie;
      };
      return { c, carnet, jouer };
    };

    it('note chaque commande une seule fois, avec sa première ligne et son chapitre', () => {
      const { carnet, jouer } = partie();
      jouer('ls -a | cat');
      jouer('ls');
      jouer('head -n 2 bienvenue.txt');
      jouer('ssh royaume');
      jouer('yes');
      jouer('pwd');
      expect(Object.keys(carnet).sort()).toEqual(['cat', 'ls', 'pwd', 'ssh']);
      expect(carnet.ls).toEqual({ ligne: 'ls -a | cat', chapitre: '' });
      expect(carnet.cat.ligne).toBe('ls -a | cat');
      // head n'existe pas encore sur le poste : il n'entre pas au carnet.
      expect(carnet.head).toBeUndefined();
      expect(carnet.pwd.chapitre).toBe('eveil');
    });

    it("ignore ce qui n'est pas une commande du jeu, mais garde man", () => {
      const { carnet, jouer } = partie();
      jouer('frobnicate --now');
      jouer('man ls');
      jouer('sshd_config');
      expect(Object.keys(carnet)).toEqual(['man']);
    });

    it('exporte en Markdown, trié, avec la ligne du manuel', () => {
      const { carnet, jouer } = partie();
      jouer('pwd');
      jouer('ls');
      const md = enMarkdown(carnet, t);
      expect(md.indexOf('## ls')).toBeLessThan(md.indexOf('## pwd'));
      expect(md).toContain('```\nls\n```');
      expect(md).toContain(`${description('ls', t)}.`);
      expect(md).toContain('man ls');
    });
  });
