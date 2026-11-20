// Everyday odds and ends: tar's old style (tar czf, tar xvf) and -v on
// extraction, df -T, du -a and -c, and another editor than nano (vim, vi…).

import { describe, expect, it } from 'vitest';
import { Shell } from '../src/engine/shell';
import { d, f, type Chapter } from '../src/engine/world';
import { CHAPTERS } from '../src/engine/chapters';

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
    expect(s.execute('tar tf x.tgz')).toBe('d/\nd/a\nd/b');
    expect(s.execute('tar xvzf x.tgz -C out')).toBe('d/\nd/a\nd/b');
    expect(s.execute('cat out/d/b')).toBe('yo');
    expect(s.execute('tar cvf y.tar d')).toBe('d/\nd/a\nd/b');
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
    // -b: the apparent sizes (a directory counts its own 4096 bytes).
    expect(s.execute('du -ab d')).toBe('2\td/a\n2\td/b\n4100\td');
    expect(s.execute('du -sbc d out')).toBe('4100\td\n4096\tout\n8196\ttotal');
    // Without it, like GNU du on ext4: whole 4 KiB blocks, counted in KiB.
    expect(s.execute('du -a d')).toBe('4\td/a\n4\td/b\n12\td');
    expect(s.execute('du -sh d')).toBe('12K\td');
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

describe('alias and unalias', () => {
  it('lists Debian\'s, defines, expands and forgets', () => {
    const s = shell();
    expect(s.execute('alias')).toBe("alias egrep='egrep --color=auto'\nalias fgrep='fgrep --color=auto'\nalias grep='grep --color=auto'\nalias ls='ls --color=auto'");
    expect(s.execute("alias ll='ls -d'")).toBe('');
    expect(s.execute('ll d')).toBe('d');
    expect(s.execute('ll d | cat')).toBe('d');
    expect(s.execute('type ll')).toBe("ll is aliased to `ls -d'");
    expect(s.execute('alias ll')).toBe("alias ll='ls -d'");
    expect(s.execute("'ll' d")).toContain('command not found');
    expect(s.execute('unalias ll')).toBe('');
    expect(s.execute('ll')).toContain('ll: command not found');
    expect(s.execute('unalias ll')).toBe('-bash: unalias: ll: not found');
    expect(s.execute('alias nope')).toBe('-bash: alias: nope: not found');
  });
});

describe('curl -o, -O and ping -cN', () => {
  const story = (id: string) => {
    const c = CHAPTERS.find((x) => x.id === id)!;
    const s = new Shell({ ...c, commands: [...c.commands, 'curl', 'cat', 'ls', 'ping', 'echo'], events: [] }, 'en');
    s.colours = false;
    return s;
  };

  it('curl -o writes the page into a file, -O under the URL\'s last name', () => {
    const s = story('fix');
    const page = s.execute('curl -s http://localhost/') ?? '';
    expect(page).toContain('<title>');
    // Into a file: the progress meter on the error output; -s silences it.
    expect(s.execute('curl -o page.html http://localhost/')).toMatch(/^ {2}% Total {4}% Received % Xferd {2}Average Speed {3}Time {4}Time {5}Time {2}Current\n {33}Dload {2}Upload {3}Total {3}Spent {4}Left {2}Speed\n100 +\d+ {2}100 +\d+ {4}0 {5}0 +\S+ {6}0 --:--:-- --:--:-- --:--:-- +\S+$/);
    expect(s.execute('curl -so page.html http://localhost/')).toBe('');
    expect(s.execute('cat page.html')).toBe(page);
    expect(s.execute('curl -O http://localhost/')).toBe('curl: Remote file name has no length\ncurl: (23) Failure writing output to destination');
    expect(s.execute('echo $?')).toBe('23');
    expect(s.execute('curl -so /etc/page.html http://localhost/')).toBe('Warning: Failed to open the file /etc/page.html: Permission denied\ncurl: (23) Failure writing output to destination');
    expect(s.execute("curl -s -o /dev/null -w '%{http_code}\\n' http://localhost/")).toBe('200');
  });

  it('ping -c1 is ping -c 1', () => {
    const s = story('lost-packet');
    const out = s.execute('ping -c1 192.168.1.1') ?? '';
    expect(out).toContain('1 packets transmitted');
  });
});

describe('Robustness on a machine without every model', () => {
  it('iostat and ping by address do not break', () => {
    const c = CHAPTERS.find((x) => x.id === 'fix')!;
    const s = new Shell({ ...c, commands: [...c.commands, 'iostat', 'ping'], events: [] }, 'en');
    expect(s.execute('iostat')).toMatch(/^Linux 6\.12\.0-quetes \(kneader\) \t09\/15\/2028 \t_x86_64_\t\(2 CPU\)$/);
    expect(s.execute('ping -c 2 192.0.2.1')).toContain('2 packets transmitted, 0 received, 100% packet loss');
  });
});
