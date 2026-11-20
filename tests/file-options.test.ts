// Everyday options of ls (-t, -r, -S, -R, -1, -A, --sort, several operands),
// cp (-a, -p, -i, -n, -v, several sources), mv (-i, -n, -v), rm (-f, -i,
// -v, -d) and rmdir (-p, -v), as GNU coreutils 9.4 gives them.

import { describe, expect, it } from 'vitest';
import { Shell } from '../src/engine/shell';
import { d, f, type Chapter } from '../src/engine/world';

const DAY = 86_400_000;
const mine = { owner: 'you' };
const chapter = (): Chapter => ({
  id: 'file-options-test',
  number: 1,
  commands: ['ls', 'cd', 'cp', 'mv', 'rm', 'mkdir', 'cat', 'echo', 'sudo'],
  home: '/home/you',
  welcome: 'notes.txt',
  final: '',
  password: 'sunflower',
  events: [],
  createWorld: () =>
    d({
      var: d({
        log: d({
          'syslog': f('x'.repeat(300), { mtime: 10 * DAY }),
          'auth.log': f('x'.repeat(100), { mtime: 12 * DAY }),
          'dpkg.log': f('x'.repeat(2000), { mtime: 2 * DAY }),
        }),
      }),
      etc: d({ app: d({ 'app.conf': f('port=80', { owner: 'root', mtime: DAY }), 'conf.d': d({ 'a.conf': f('x', { owner: 'root' }) }, undefined, { owner: 'root' }) }, undefined, { owner: 'root' }) }, undefined, { owner: 'root' }),
      home: d({
        you: d(
          {
            'notes.txt': f('alpha', { lines: true, ...mine }),
            'b.txt': f('beta', { lines: true, ...mine }),
            '.hidden': f('', mine),
            box: d({}, undefined, mine),
            tree: d({ 'one.txt': f('1', mine), sub: d({ 'two.txt': f('2', mine), deep: d({}, undefined, mine) }, undefined, mine) }, undefined, mine),
          },
          undefined,
          mine,
        ),
      }),
    }),
});

const shell = () => {
  const s = new Shell(chapter(), 'en');
  s.colours = false;
  return s;
};

describe('ls', () => {
  it('sorts by time (-t), size (-S), in reverse (-r), with --sort', () => {
    const s = shell();
    expect(s.execute('ls -t /var/log')).toBe('auth.log  syslog  dpkg.log');
    expect(s.execute('ls -tr /var/log')).toBe('dpkg.log  syslog  auth.log');
    expect(s.execute('ls -S /var/log')).toBe('dpkg.log  syslog  auth.log');
    expect(s.execute('ls --sort=size -r /var/log')).toBe('auth.log  syslog  dpkg.log');
    expect(s.execute('ls -r /var/log')).toBe('syslog  dpkg.log  auth.log');
    expect((s.execute('ls -ltr /var/log') ?? '').split('\n').slice(1).map((l) => l.split(/\s+/).at(-1))).toEqual(['dpkg.log', 'syslog', 'auth.log']);
    expect(s.execute('ls --sort=foo')).toContain("ls: invalid argument 'foo' for '--sort'");
  });

  it('-1, -A, -R', () => {
    const s = shell();
    expect(s.execute('ls -1')).toBe('b.txt\nbox/\nnotes.txt\ntree/');
    expect(s.execute('ls -A')).toBe('.hidden  b.txt  box/  notes.txt  tree/');
    expect(s.execute('ls -R tree')).toBe('tree:\none.txt  sub/\n\ntree/sub:\ndeep/  two.txt\n\ntree/sub/deep:');
    expect(s.execute('ls -l1 tree')).toContain('one.txt');
  });

  it('lists several files together, then each place, and -d keeps places as names', () => {
    const s = shell();
    expect(s.execute('ls notes.txt b.txt tree')).toBe('b.txt  notes.txt\n\ntree:\none.txt  sub/');
    expect(s.execute('ls -d */')).toBe('box/  tree/');
    expect(s.execute('ls -d tree box')).toBe('box  tree');
  });
});

describe('cp, mv, rm, rmdir', () => {
  it('cp -v, several sources into a place, and the target errors', () => {
    const s = shell();
    expect(s.execute('cp -v notes.txt b.txt box')).toBe("'notes.txt' -> 'box/notes.txt'\n'b.txt' -> 'box/b.txt'");
    expect(s.execute('cp notes.txt b.txt c')).toBe("cp: target 'c': No such file or directory");
    expect(s.execute('cp notes.txt b.txt box/b.txt')).toBe("cp: target 'box/b.txt': Not a directory");
  });

  it('cp -a keeps the place, the dates and, for root, the owner', () => {
    const s = shell();
    s.execute('sudo cp -a /etc/app /etc/app.bak');
    s.execute('sunflower');
    expect(s.execute('ls -l /etc/app.bak')).toMatch(/root +root +7 .* app\.conf\n/);
    expect(s.find('/etc/app.bak/app.conf')).toMatchObject({ mtime: DAY });
    expect(s.execute('ls /etc/app.bak/conf.d')).toBe('a.conf');
    // Without -p, a copy is new and yours.
    s.execute('cp /etc/app/app.conf .');
    expect(s.find('app.conf')).not.toHaveProperty('mtime');
    expect(s.execute('ls -l app.conf')).toMatch(/ 1 you you /);
  });

  it('cp -i asks, cp -n never replaces', () => {
    const s = shell();
    s.execute('cp notes.txt box');
    expect(s.execute('cp -n b.txt box/notes.txt')).toBe('');
    expect(s.execute('cat box/notes.txt')).toBe('alpha');
    s.execute('cp -i b.txt box/notes.txt');
    expect(s.prompt()).toBe("cp: overwrite 'box/notes.txt'? ");
    s.execute('n');
    expect(s.execute('cat box/notes.txt')).toBe('alpha');
    s.execute('cp -i b.txt box/notes.txt');
    s.execute('y');
    expect(s.execute('cat box/notes.txt')).toBe('beta');
  });

  it('mv -v, -n, -i and several sources', () => {
    const s = shell();
    expect(s.execute('mv -v notes.txt box')).toBe("renamed 'notes.txt' -> 'box/notes.txt'");
    s.execute('echo x > a');
    s.execute('echo y > b');
    expect(s.execute('mv -n a b')).toBe('');
    expect(s.execute('cat b')).toBe('y');
    s.execute('mv -i a b');
    expect(s.prompt()).toBe("mv: overwrite 'b'? ");
    s.execute('yes');
    expect(s.execute('cat b')).toBe('x');
    expect(s.execute('mv b b.txt box')).toBe('');
    expect(s.execute('ls box')).toBe('b  b.txt  notes.txt');
  });

  it('rm -f, -v, -i, -d', () => {
    const s = shell();
    expect(s.execute('rm -f nothere')).toBe('');
    expect(s.execute('echo $?')).toBe('0');
    expect(s.execute('rm nothere')).toBe("rm: cannot remove 'nothere': No such file or directory");
    expect(s.execute('rm -v b.txt')).toBe("removed 'b.txt'");
    s.execute('rm -i notes.txt');
    expect(s.prompt()).toBe("rm: remove regular file 'notes.txt'? ");
    s.execute('n');
    expect(s.execute('ls notes.txt')).toBe('notes.txt');
    s.execute('rm -i .hidden');
    expect(s.prompt()).toBe("rm: remove regular empty file '.hidden'? ");
    s.execute('y');
    expect(s.execute('ls -A')).not.toContain('.hidden');
    expect(s.execute('rm -dv box')).toBe("removed directory 'box'");
    expect(s.execute('rm -d tree')).toContain("rm: cannot remove 'tree'");
  });

  it('rmdir, -p, -v and its errors', () => {
    const s = shell();
    expect(s.execute('rmdir tree')).toBe("rmdir: failed to remove 'tree': Directory not empty");
    expect(s.execute('rmdir notes.txt')).toBe("rmdir: failed to remove 'notes.txt': Not a directory");
    expect(s.execute('rmdir nothere')).toBe("rmdir: failed to remove 'nothere': No such file or directory");
    expect(s.execute('rmdir')).toBe("rmdir: missing operand\nTry 'rmdir --help' for more information.");
    s.execute('mkdir -p p/q/r');
    expect(s.execute('rmdir -pv p/q/r')).toBe("rmdir: removing directory, 'p/q/r'\nrmdir: removing directory, 'p/q'\nrmdir: removing directory, 'p'");
    expect(s.execute('ls -d p')).toContain('cannot access');
    expect(s.execute('rmdir /etc/app/conf.d')).toBe("rmdir: failed to remove '/etc/app/conf.d': Directory not empty");
  });

  it('in French, coreutils speaks French and o says yes', () => {
    const s = new Shell(chapter(), 'fr');
    s.colours = false;
    s.execute('cp notes.txt box');
    s.execute('cp -i b.txt box/notes.txt');
    expect(s.prompt()).toBe("cp : voulez-vous écraser 'box/notes.txt' ? ");
    s.execute('o');
    expect(s.execute('cat box/notes.txt')).toBe('beta');
  });
});
