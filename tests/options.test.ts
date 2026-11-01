// Les options longues : celles que le jeu comprend se lisent comme leur forme
// courte (--all = -a) ; les autres donnent le message de getopt, comme les
// vrais outils (au lieu d'être prises pour un nom de fichier).

import { describe, expect, it } from 'vitest';
import { Console } from '../src/engine/console';
import { LANGUAGES } from '../src/texts';

for (const language of LANGUAGES)
  describe(`Options longues — ${language}`, () => {
    const workstation = () => new Console({ language });
    it('une option longue inconnue : le vrai message, rien ne se passe', () => {
      const c = workstation();
      const output = c.execute('ls --frobnicate') ?? '';
      if (language === 'en') expect(output).toBe("ls: unrecognized option '--frobnicate'\nTry 'ls --help' for more information.");
      else expect(output).toContain('--frobnicate');
      expect(output).not.toContain('No such file');
      expect(c.execute('mkdir --nope essai-option')).toContain('--nope');
      expect(c.execute('ls')).not.toContain('essai-option');
    });
    it('une option longue connue se lit comme la courte', () => {
      const c = workstation();
      expect(c.execute('ls --all')).toBe(c.execute('ls -a'));
      expect(c.execute('mkdir --parents a/b/c')).toBe('');
      expect(c.execute('ls a/b')).toContain('c');
    });
    it('après --, plus aucune option', () => {
      const c = workstation();
      expect(c.execute('ls -- --frobnicate')).not.toContain('unrecognized');
    });
  });
