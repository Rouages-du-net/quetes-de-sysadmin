// Long options: those the game understands read like their short form
// (--all = -a); the others give getopt's message, like the real tools
// (instead of being taken for a file name).

import { describe, expect, it } from 'vitest';
import { Console } from '../src/engine/console';
import { LANGUAGES } from '../src/texts';

for (const language of LANGUAGES)
  describe(`Long options — ${language}`, () => {
    const workstation = () => new Console({ language });
    it('an unknown long option: the real message, nothing happens', () => {
      const c = workstation();
      const output = c.execute('ls --frobnicate') ?? '';
      if (language === 'en') expect(output).toBe("ls: unrecognized option '--frobnicate'\nTry 'ls --help' for more information.");
      else expect(output).toContain('--frobnicate');
      expect(output).not.toContain('No such file');
      expect(c.execute('mkdir --nope essai-option')).toContain('--nope');
      expect(c.execute('ls')).not.toContain('essai-option');
    });
    it('a known long option reads like the short one', () => {
      const c = workstation();
      expect(c.execute('ls --all')).toBe(c.execute('ls -a'));
      expect(c.execute('mkdir --parents a/b/c')).toBe('');
      expect(c.execute('ls a/b')).toContain('c');
    });
    it('after --, no more options', () => {
      const c = workstation();
      expect(c.execute('ls -- --frobnicate')).not.toContain('unrecognized');
    });
  });
