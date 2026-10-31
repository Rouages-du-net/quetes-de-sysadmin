// Les options longues : celles que le jeu comprend se lisent comme leur forme
// courte (--all = -a) ; les autres donnent le message de getopt, comme les
// vrais outils (au lieu d'être prises pour un nom de fichier).

import { describe, expect, it } from 'vitest';
import { Console } from '../src/engine/console';
import { LANGUES } from '../src/texts';

for (const langue of LANGUES)
  describe(`Options longues — ${langue}`, () => {
    const poste = () => new Console({ langue });
    it('une option longue inconnue : le vrai message, rien ne se passe', () => {
      const c = poste();
      const sortie = c.executer('ls --frobnicate') ?? '';
      if (langue === 'en') expect(sortie).toBe("ls: unrecognized option '--frobnicate'\nTry 'ls --help' for more information.");
      else expect(sortie).toContain('--frobnicate');
      expect(sortie).not.toContain('No such file');
      expect(c.executer('mkdir --nope essai-option')).toContain('--nope');
      expect(c.executer('ls')).not.toContain('essai-option');
    });
    it('une option longue connue se lit comme la courte', () => {
      const c = poste();
      expect(c.executer('ls --all')).toBe(c.executer('ls -a'));
      expect(c.executer('mkdir --parents a/b/c')).toBe('');
      expect(c.executer('ls a/b')).toContain('c');
    });
    it('après --, plus aucune option', () => {
      const c = poste();
      expect(c.executer('ls -- --frobnicate')).not.toContain('unrecognized');
    });
  });
