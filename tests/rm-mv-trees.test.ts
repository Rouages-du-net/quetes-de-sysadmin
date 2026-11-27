// rm -r, -R, -f, -i, -v on whole places and mv of a place, as GNU
// coreutils 9.7 (Debian 13) gives them; and what the game keeps whole: the
// system's places, the story's (a place with a lock), protected objects,
// immutable files, other accounts' places, mount points.

import { describe, expect, it } from 'vitest';
import { Shell } from '../src/engine/shell';
import { d, f, password, type Chapter } from '../src/engine/world';
import { STORIES } from '../src/engine/chapters';

const mine = { owner: 'you' };
const chapter = (): Chapter => ({
  id: 'rm-mv-trees-test',
  number: 1,
  commands: ['ls', 'cd', 'cp', 'mv', 'rm', 'mkdir', 'cat', 'echo', 'sudo', 'chattr', 'ln'],
  home: '/home/you',
  welcome: 'notes.txt',
  final: '',
  password: 'sunflower',
  events: [],
  state: () => ({ mounts: [{ path: '/', capacity: 10 ** 9, name: '/dev/sda1' }, { path: '/mnt/usb', capacity: 10 ** 8, name: '/dev/sdb1' }, { path: '/home/you/outer/stick', capacity: 10 ** 8, name: '/dev/sdc1' }] }),
  createWorld: () =>
    d({
      etc: d({ app: d({ 'app.conf': f('port=80', { owner: 'root' }) }, undefined, { owner: 'root' }) }, undefined, { owner: 'root' }),
      var: d({ log: d({ syslog: f('x', { owner: 'root' }) }, undefined, { owner: 'root' }) }, undefined, { owner: 'root' }),
      mnt: d({ usb: d({ 'photo.jpg': f('jpg', mine) }, undefined, mine) }, undefined, { owner: 'root' }),
      proc: d({ sys: d({ net: d({ forwarding: f('0', { owner: 'root' }) }, undefined, { owner: 'root' }) }, undefined, { owner: 'root' }) }, undefined, { owner: 'root' }),
      home: d({
        you: d(
          {
            'notes.txt': f('alpha', mine),
            tree: d({ 'one.txt': f('1', mine), sub: d({ 'two.txt': f('2', mine), deep: d({}, undefined, mine) }, undefined, mine) }, undefined, mine),
            box: d({}, undefined, mine),
            full: d({ 'x.txt': f('x', mine) }, undefined, mine),
            shared: d({ 'theirs.txt': f('t', { owner: 'root' }), 'mine.txt': f('m', mine) }, undefined, { owner: 'root', mode: 'rwxr-xr-x' }),
            keep: d({ 'cheese': f('c', { ...mine, isProtected: { rm: 'Not my cheese!', mv: 'Too heavy!' } }), 'bread': f('b', mine) }, undefined, mine),
            outer: d({ stick: d({ 'f.txt': f('f', mine) }, undefined, mine) }, undefined, mine),
            town: d({ gate: d({ 'inside.txt': f('i', mine) }, () => null, mine), 'sign.txt': f('s', mine) }, undefined, mine),
          },
          undefined,
          mine,
        ),
      }),
    }),
});

const shell = (language = 'en') => {
  const s = new Shell(chapter(), language);
  s.colours = false;
  return s;
};

describe('rm on places', () => {
  it('without -r: Is a directory, as GNU says it', () => {
    const s = shell();
    expect(s.execute('rm tree')).toBe("rm: cannot remove 'tree': Is a directory");
    expect(s.execute('rm -f tree')).toBe("rm: cannot remove 'tree': Is a directory");
    expect(s.lastStatus).toBe(1);
    expect(s.execute('ls -d tree')).toBe('tree');
  });

  it('-r, -R and -v: depth first, files then their place', () => {
    const s = shell();
    expect(s.execute('rm -rv tree')).toBe(
      ["removed 'tree/one.txt'", "removed directory 'tree/sub/deep'", "removed 'tree/sub/two.txt'", "removed directory 'tree/sub'", "removed directory 'tree'"].join('\n'),
    );
    expect(s.find('/home/you/tree')).toBeNull();
    expect(s.execute('rm -R box')).toBe('');
    expect(s.find('/home/you/box')).toBeNull();
    // -f: nothing said of what is missing.
    expect(s.execute('rm -rf tree nothing')).toBe('');
    expect(s.lastStatus).toBe(0);
    expect(s.execute('rm -r nothing')).toBe("rm: cannot remove 'nothing': No such file or directory");
    // Long options.
    expect(s.execute('rm --recursive --force full')).toBe('');
    expect(s.find('/home/you/full')).toBeNull();
  });

  it('-i asks to descend, for each file, then for the place', () => {
    const s = shell();
    s.execute('rm -ri full');
    expect(s.prompt()).toBe("rm: descend into directory 'full'? ");
    s.execute('y');
    expect(s.prompt()).toBe("rm: remove regular file 'full/x.txt'? ");
    s.execute('y');
    expect(s.prompt()).toBe("rm: remove directory 'full'? ");
    s.execute('n');
    expect(s.execute('ls full')).toBe('');
    // Declining a file: the places that hold it are not asked about.
    s.execute('rm -ri tree');
    s.execute('y');
    expect(s.prompt()).toBe("rm: remove regular file 'tree/one.txt'? ");
    s.execute('n');
    expect(s.prompt()).toBe("rm: descend into directory 'tree/sub'? ");
    s.execute('n');
    expect(s.question).toBeNull();
    expect(s.execute('ls tree')).toBe('one.txt  sub/');
    // An empty place: one question.
    s.execute('rm -ri box');
    expect(s.prompt()).toBe("rm: remove directory 'box'? ");
    s.execute('y');
    expect(s.find('/home/you/box')).toBeNull();
  });

  it('what can’t go stays, with only its own error', () => {
    const s = shell();
    // Another account's file in a place you can't write: Permission denied, nothing else.
    expect(s.execute('rm -r shared')).toBe("rm: cannot remove 'shared/mine.txt': Permission denied\nrm: cannot remove 'shared/theirs.txt': Permission denied");
    expect(s.lastStatus).toBe(1);
    // A story's protected object stays; the rest goes.
    expect(s.execute('rm -r keep')).toBe('Not my cheese!');
    expect(s.execute('ls keep')).toBe('cheese');
    // chattr +i: even root may not.
    s.execute('sudo chattr +i tree/sub/two.txt');
    s.execute('sunflower');
    expect(s.execute('sudo rm -rf tree')).toBe("rm: cannot remove 'tree/sub/two.txt': Operation not permitted");
    expect(s.execute('ls -R tree')).toBe('tree:\nsub/\n\ntree/sub:\ntwo.txt');
  });

  it('the failsafes: /, . and .., mount points, other media, the kernel’s files', () => {
    const s = shell();
    expect(s.execute('rm -rf /')).toBe("rm: it is dangerous to operate recursively on '/'\nrm: use --no-preserve-root to override this failsafe");
    expect(s.lastStatus).toBe(1);
    expect(s.execute('rm -rf --no-preserve-root /')).toContain("the game keeps the system's own places");
    expect(s.execute('rm -r .')).toBe("rm: refusing to remove '.' or '..' directory: skipping '.'");
    expect(s.execute('rm -r tree/..')).toBe("rm: refusing to remove '.' or '..' directory: skipping 'tree/..'");
    expect(s.execute('ls -d tree')).toBe('tree');
    // A mount point: what it holds goes, the point itself is busy.
    expect(s.execute('rm -r /mnt/usb')).toBe("rm: cannot remove '/mnt/usb': Device or resource busy");
    expect(s.execute('ls /mnt/usb')).toBe('');
    s.execute('sudo rm -rf /proc/sys/net');
    s.execute('sunflower');
    expect(s.execute('sudo rm -rf /proc/sys/net')).toBe("rm: cannot remove '/proc/sys/net/forwarding': Operation not permitted");
  });

  it('--one-file-system skips another medium', () => {
    const s = shell();
    expect(s.execute('rm -r --one-file-system outer')).toBe("rm: skipping 'outer/stick', since it's on a different device");
    expect(s.execute('cat outer/stick/f.txt')).toBe('f');
    expect(s.execute('rm -r outer')).toBe("rm: cannot remove 'outer/stick': Device or resource busy");
    expect(s.execute('ls -A outer/stick')).toBe('');
  });

  it('the game keeps the system’s places and the story’s', () => {
    const s = shell();
    s.execute('sudo rm -rf /etc');
    s.execute('sunflower');
    expect(s.execute('sudo rm -rf /etc')).toMatch(/^rm: cannot remove '\/etc': the game keeps the system's own places/);
    expect(s.execute('sudo rm -rf /var/log')).toMatch(/^rm: cannot remove '\/var\/log': the game keeps/);
    expect(s.execute('cat /var/log/syslog')).toBe('x');
    // A place deeper down is an ordinary place.
    expect(s.execute('sudo rm -r /etc/app')).toBe('');
    // A place with a lock, open or not, and the places that hold it.
    expect(s.execute('rm -r town')).toBe("rm: cannot remove 'town': a place of the story is inside, and the game keeps the story's places");
    expect(s.execute('rm -r town/gate')).toContain('a place of the story is inside');
    expect(s.execute('ls town')).toBe('gate/  sign.txt');
    expect(s.execute('rm town/sign.txt')).toBe('');
  });

  it('speaks the system’s language', () => {
    const s = shell('fr');
    expect(s.execute('rm tree')).toBe("rm : impossible de supprimer 'tree' : est un dossier");
    expect(s.execute('rm -rf /')).toContain("rm : il est dangereux d'opérer récursivement sur '/'");
    s.execute('rm -ri box');
    expect(s.prompt()).toBe("rm : supprimer 'box' du type répertoire ? ");
  });
});

describe('mv on places', () => {
  it('renames a place, or moves it into another, with all it holds', () => {
    const s = shell();
    expect(s.execute('mv -v tree forest')).toBe("renamed 'tree' -> 'forest'");
    expect(s.execute('cat forest/sub/two.txt')).toBe('2');
    expect(s.execute('mv forest box')).toBe('');
    expect(s.execute('ls box')).toBe('forest/');
    expect(s.execute('mv -v box/forest/ .')).toBe("renamed 'box/forest/' -> './forest'");
    // An empty place at the destination is replaced.
    expect(s.execute('mkdir -p a/forest')).toBe('');
    expect(s.execute('mv forest a')).toBe('');
    expect(s.execute('cat a/forest/one.txt')).toBe('1');
  });

  it('GNU’s refusals', () => {
    const s = shell();
    expect(s.execute('mv tree tree/sub')).toBe("mv: cannot move 'tree' to a subdirectory of itself, 'tree/sub/tree'");
    expect(s.execute('mkdir -p other/tree && echo x > other/tree/x && mv tree other')).toBe("mv: cannot move 'tree' to 'other/tree': Directory not empty");
    expect(s.execute('echo x > box2 && mkdir dir2 && mv dir2 box2')).toBe("mv: cannot overwrite non-directory 'box2' with directory 'dir2'");
    expect(s.execute('mkdir -p d3/notes.txt && mv notes.txt d3')).toBe("mv: cannot overwrite directory 'd3/notes.txt' with non-directory");
    expect(s.execute('cat notes.txt')).toBe('alpha');
    expect(s.execute('mv /mnt/usb /home/you/usb')).toBe("mv: cannot move '/mnt/usb' to '/home/you/usb': Device or resource busy");
    // Into another place, a place you can't write can't change its "..".
    expect(s.execute('mv shared box')).toBe("mv: cannot move 'shared' to 'box/shared': Permission denied");
  });

  it('the game keeps the system’s places, the story’s and protected objects', () => {
    const s = shell();
    s.execute('sudo mv /etc /old-etc');
    s.execute('sunflower');
    expect(s.execute('sudo mv /etc /old-etc')).toMatch(/^mv: cannot move '\/etc': the game keeps the system's own places/);
    expect(s.execute('mv town village')).toBe("mv: cannot move 'town': a place of the story is inside, and the game keeps the story's places where they are");
    expect(s.execute('mv keep box')).toBe('Too heavy!');
    expect(s.execute('ls keep')).toBe('bread  cheese');
  });
});

describe('ls -l counts hard links', () => {
  it('each name of the same file, until one is removed', () => {
    const s = shell();
    const links = (path: string) => (s.execute(`ls -l ${path}`) ?? '').split(/\s+/)[1];
    expect(links('notes.txt')).toBe('1');
    s.execute('ln notes.txt again.txt');
    expect(links('notes.txt')).toBe('2');
    s.execute('ln notes.txt tree/third.txt');
    expect(links('again.txt')).toBe('3');
    // A copy is another file; a symbolic link is a name of its own.
    s.execute('cp notes.txt copy.txt');
    s.execute('ln -s notes.txt soft.txt');
    expect(links('copy.txt')).toBe('1');
    s.execute('rm -r tree');
    expect(links('notes.txt')).toBe('2');
    s.execute('rm again.txt');
    expect(links('notes.txt')).toBe('1');
  });
});

describe('No chapter is won, nor broken, by wiping whole trees', () => {
  // Everything rm -r or mv may reach, as the player and as root: the
  // chapter must not end, and nothing may throw.
  const WIPE = 'rm -rf /home/* /srv/* /opt/* /tmp/* /var/*/* /etc/* /root/* /usr/local/* /usr/*/* /mnt/* /media/* /data/* /backup/* /boot/*';
  const MOVE = 'mkdir -p /home/you/x; mv /home/* /srv/* /opt/* /var/*/* /etc/* /mnt/* /tmp/x 2>/dev/null';
  it('every Unix-like chapter', () => {
    for (const story of STORIES)
      for (const c of story.chapters)
        for (const line of [WIPE, MOVE]) {
          const s = new Shell(c, 'en');
          if (s.state.os === 'windows' || s.state.os === 'ibmi') continue;
          expect(() => {
            s.execute(`cd /; ${line}`);
            s.execute(`sudo ${line}`);
            if (s.maskedInput()) s.execute(c.password ? password(s.t, c.password) : 'x');
            for (let k = 0; k < 3; k++) s.execute('ls');
          }, `${c.id}: ${line}`).not.toThrow();
          expect(s.finished, `${c.id}: ${line}`).toBe(false);
        }
  }, 600_000);
});
