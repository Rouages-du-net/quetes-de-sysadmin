// Everyday odds and ends: tar's old style (tar czf, tar xvf) and -v on
// extraction, df -T, du -a and -c, and another editor than nano (vim, vi…).

import { describe, expect, it } from 'vitest';
import { Shell } from '../src/engine/shell';
import { d, f, type Chapter } from '../src/engine/world';

const mine = { owner: 'you' };
const chapter = (commands = ['tar', 'ls', 'df', 'du', 'nano', 'cat', 'echo']): Chapter => ({
  id: 'everyday-misc-test',
  number: 1,
  commands,
  home: '/home/you',
  welcome: 'd',
  final: '',
  events: [],
  state: () => ({
    mounts: [
      { path: '/', capacity: 20 * 1024 ** 3, name: '/dev/vda1', system: 'ext4' },
      { path: '/srv', capacity: 10 * 1024 ** 3, name: '/dev/vdb1', system: 'xfs' },
    ],
  }),
  createWorld: () =>
    d({
      srv: d({}),
      tmp: d({}),
      home: d({ you: d({ d: d({ a: f('hi', mine), b: f('yo', mine) }, undefined, mine), out: d({}, undefined, mine) }, undefined, mine) }),
    }),
});

const shell = (commands?: string[]) => {
  const s = new Shell(chapter(commands), 'en');
  s.colours = false;
  return s;
};

describe('tar', () => {
  it('reads the old style without a dash, and -v lists what it extracts', () => {
    const s = shell();
    expect(s.execute('tar czf x.tgz d')).toBe('');
    expect(s.execute('tar tf x.tgz')).toBe('d/a\nd/b');
    expect(s.execute('tar xvzf x.tgz -C out')).toBe('d/a\nd/b');
    expect(s.execute('cat out/d/b')).toBe('yo');
    expect(s.execute('tar cvf y.tar d')).toBe('d/a\nd/b');
  });
});

describe('df -T, du -a and -c', () => {
  it('df -T adds the type after the name', () => {
    const s = shell();
    const lines = (s.execute('df -hT') ?? '').split('\n');
    expect(lines[0]).toBe('Filesystem         Type      Size    Used  Avail Use% Mounted on');
    expect(lines[1]).toMatch(/^\/dev\/vda1 +ext4 +20G +\S+ +\S+ +\d+% \/$/);
    expect(lines[2]).toMatch(/^\/dev\/vdb1 +xfs +10G/);
  });

  it('du -a lists the files, -c adds a total', () => {
    const s = shell();
    expect(s.execute('du -ab d')).toBe('2\td/a\n2\td/b\n4\td');
    expect(s.execute('du -sbc d out')).toBe('4\td\n0\tout\n4\ttotal');
  });
});

describe('Another editor than nano', () => {
  it('vim, vi, emacs: not found, and nano is shown', () => {
    const s = shell();
    expect(s.execute('vim /etc/hosts')).toBe("vim: command not found. This game's editor is nano: nano /etc/hosts (Ctrl-O to save, Ctrl-X to quit).");
    expect(s.execute('echo $?')).toBe('127');
    expect(s.execute('vi')).toContain('nano file');
    const fr = new Shell(chapter(), 'fr');
    expect(fr.execute('emacs notes.txt')).toBe("emacs : commande introuvable. L'éditeur de ce jeu est nano : nano notes.txt (Ctrl-O pour enregistrer, Ctrl-X pour quitter).");
  });

  it('without nano in the chapter, the usual message', () => {
    expect(shell(['ls']).execute('vim x')).toBe('vim: command not found. Type "help" for the list.');
  });
});
