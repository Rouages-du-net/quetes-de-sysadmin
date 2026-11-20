// find's tests, operators and actions (-iname, -path, -size, -perm, -newer,
// -user, -group, -empty, -mmin, -mindepth, !, -o, ( ), -print0, -exec … ;
// and +), xargs (-0, -n, -I, -L, -r, -t, exit codes), env and printenv.
// Expected results from GNU findutils 4.9 and coreutils 9.4 on the same
// tree (find's own order is the directory's; the game's is by name, so the
// lists are compared sorted where it matters).

import { describe, expect, it } from 'vitest';
import { Shell } from '../src/engine/shell';
import { d, f, type Chapter } from '../src/engine/world';

const DAY = 86_400_000;
const mine = { owner: 'you' };
const chapter = (commands = ['find', 'grep', 'echo', 'ls', 'cat', 'rm', 'export', 'wc', 'date']): Chapter => ({
  id: 'find-xargs-test',
  number: 1,
  commands,
  home: '/home/you',
  welcome: 't',
  final: '',
  events: [],
  accounts: () => ({
    users: { root: { uid: 0, group: 'root', home: '/root' }, you: { uid: 1000, group: 'you' }, ana: { uid: 1001, group: 'ana' } },
    groups: { root: { gid: 0, members: [] }, you: { gid: 1000, members: [] }, ana: { gid: 1001, members: [] } },
  }),
  createWorld: () =>
    d({
      home: d({
        ana: d({ 'notes.md': f('x', { owner: 'ana' }) }, undefined, { owner: 'ana' }),
        you: d(
          {
            t: d(
              {
                logs: d(
                  {
                    'a.log': f('error one\nok', { lines: true, ...mine, mtime: 5 * DAY }),
                    'b.log': f('fine', { lines: true, ...mine, mode: 'rw-rw-rw-' }),
                    'c.log': f('', { ...mine, mtime: DAY }),
                  },
                  undefined,
                  mine,
                ),
                empty: d({}, undefined, mine),
                conf: d({ 'app.conf': f('x', { ...mine, mode: 'rw-------', mtime: 3 * DAY }) }, undefined, mine),
                'big.bin': f('', { ...mine, size: 3000 }),
                'my file.tmp': f('', mine),
              },
              undefined,
              mine,
            ),
          },
          undefined,
          mine,
        ),
      }),
    }),
});

const shell = (commands?: string[]) => {
  const s = new Shell(chapter(commands), 'en');
  s.colours = false;
  s.cwd = '/home/you/t';
  return s;
};
const sorted = (out: string | null) => (out ?? '').split('\n').sort().join('\n');

describe('find', () => {
  it('-name, -iname, -path, -type', () => {
    const s = shell();
    expect(s.execute("find . -name '*.log'")).toBe('./logs/a.log\n./logs/b.log\n./logs/c.log');
    expect(s.execute("find . -iname 'A.LOG'")).toBe('./logs/a.log');
    expect(sorted(s.execute("find . -path '*conf*'"))).toBe('./conf\n./conf/app.conf');
    expect(s.execute("find . -name '[ab].log'")).toBe('./logs/a.log\n./logs/b.log');
    expect(s.execute('find . -type q')).toBe('find: Unknown argument to -type: q');
  });

  it('-size, rounded up to its unit', () => {
    const s = shell();
    expect(sorted(s.execute('find . -size +2k'))).toBe(sorted('.\n./logs\n./empty\n./conf\n./big.bin'));
    // The famous trap: -size -1k is "0 units", only empty files.
    expect(sorted(s.execute('find . -type f -size -1k'))).toBe(sorted('./logs/c.log\n./my file.tmp'));
    expect(s.execute('find . -size 3X')).toBe("find: invalid -size type `X'");
  });

  it('-perm exact, -perm -bits, -perm /bits', () => {
    const s = shell();
    expect(s.execute('find . -type f -perm 600')).toBe('./conf/app.conf');
    expect(s.execute('find . -type f -perm -002')).toBe('./logs/b.log');
    expect(s.execute('find . -type f -perm /022')).toBe('./logs/b.log');
    expect(s.execute('find . -perm abc')).toBe("find: invalid mode 'abc'");
  });

  it('-empty, -newer, -mtime, -user, -group', () => {
    const s = shell();
    expect(sorted(s.execute('find . -empty'))).toBe(sorted('./empty\n./logs/c.log\n./my file.tmp'));
    expect(s.execute('find logs -type f -newer conf/app.conf')).toBe('logs/a.log\nlogs/b.log');
    expect(s.execute('find /home -user ana -type f')).toBe('/home/ana/notes.md');
    expect(s.execute('find . -user nobodyx')).toBe("find: 'nobodyx' is not the name of a known user");
    expect(s.execute('find . -group nobodyx')).toBe("find: 'nobodyx' is not the name of an existing group");
  });

  it('operators: implicit and, -o, !, ( )', () => {
    const s = shell();
    expect(sorted(s.execute("find . -type d -o -name '*.conf'"))).toBe(sorted('.\n./conf\n./conf/app.conf\n./empty\n./logs'));
    expect(sorted(s.execute("find . ! -name '*.log' -type f"))).toBe(sorted('./big.bin\n./conf/app.conf\n./my file.tmp'));
    expect(sorted(s.execute('find . \\( -name a.log -o -name b.log \\) -print'))).toBe('./logs/a.log\n./logs/b.log');
    expect(s.execute('find . -not -type d -name "c*"')).toBe('./logs/c.log');
    expect(s.execute("find logs -mindepth 1 -maxdepth 1 -name 'c*'")).toBe('logs/c.log');
    expect(s.execute('find . \\( -name a')).toBe("find: invalid expression; I was expecting to find a ')' somewhere but did not see one.");
    expect(s.execute('find . -name a -o')).toBe("find: expected an expression after '-o'");
    expect(s.execute('find . -foo')).toBe("find: unknown predicate `-foo'");
  });

  it('-exec … \\; once per file, -exec … + once for all', () => {
    const s = shell();
    expect(s.execute("find . -name '*.log' -exec grep -l error {} +")).toBe('./logs/a.log');
    expect(s.execute("find . -name '*.log' -exec grep -c o {} \\;")).toBe('2\n0\n0');
    expect(s.execute("find . -name '*.log' -exec grep -q fine {} ';' -print")).toBe('./logs/b.log');
    expect(s.execute('find . -exec echo {}')).toBe("find: missing argument to `-exec'");
    s.execute("find . -name '*.tmp' -exec rm {} \\;");
    expect(s.execute('ls')).toBe('big.bin  conf/  empty/  logs/');
  });

  it('several starting places, and one missing', () => {
    const s = shell();
    expect(s.execute("find logs conf -name '*.c*'")).toBe('conf/app.conf');
    expect(s.execute('find nothere logs -name a.log')).toBe("find: 'nothere': No such file or directory\nlogs/a.log");
  });
});

describe('xargs', () => {
  it('builds command lines from its input', () => {
    const s = shell();
    expect(s.execute("find . -name '*.log' | xargs grep -l fine")).toBe('./logs/b.log');
    expect(s.execute("find . -name '*.log' | xargs -n 1 echo X")).toBe('X ./logs/a.log\nX ./logs/b.log\nX ./logs/c.log');
    expect(s.execute("echo 'a b' | xargs")).toBe('a b');
    expect(s.execute("find logs -name '*.log' | xargs -I {} echo '<{}>'")).toBe('<logs/a.log>\n<logs/b.log>\n<logs/c.log>');
    expect(s.execute("find . -name 'a.*' | xargs -t echo")).toBe('echo ./logs/a.log\n./logs/a.log');
    expect(s.execute("cat logs/a.log | xargs -L 1 echo X")).toBe('X error one\nX ok');
  });

  it('-0 with find -print0 keeps names with spaces whole', () => {
    const s = shell();
    expect(s.execute("find . -name '*.tmp' | xargs rm")).toBe("rm: cannot remove './my': No such file or directory\nrm: cannot remove 'file.tmp': No such file or directory");
    expect(s.execute('echo $?')).toBe('123');
    expect(s.execute("find . -name '*.tmp' -print0 | xargs -0 rm")).toBe('');
    expect(s.execute('ls')).toBe('big.bin  conf/  empty/  logs/');
  });

  it('runs once without input, unless -r; its errors', () => {
    const s = shell();
    expect(s.execute("find . -name '*.none' | xargs echo hi")).toBe('hi');
    expect(s.execute("find . -name '*.none' | xargs -r echo hi")).toBe('');
    expect(s.execute('echo a | xargs nosuchcmd')).toBe('xargs: nosuchcmd: No such file or directory');
    expect(s.execute('echo $?')).toBe('127');
    expect(s.execute('echo a | xargs -n x echo')).toBe('xargs: invalid number "x" for -n option\nTry \'xargs --help\' for more information.');
    expect(s.execute("echo '\"a b' | xargs echo")).toBe('xargs: unmatched double quote; by default quotes are special to xargs unless you use the -0 option');
  });

  it('comes with find, not on its own', () => {
    const s = shell(['echo', 'ls']);
    expect(s.execute('echo a | xargs echo')).toContain("xargs: you don't have this command yet");
  });
});

describe('env and printenv', () => {
  it('show the environment, with what was exported', () => {
    const s = shell();
    expect(s.execute('env')).toContain('HOME=/home/you\n');
    expect(s.execute('env')).toContain('PWD=/home/you/t');
    expect(s.execute('printenv HOME USER')).toBe('/home/you\nyou');
    s.execute('FOO=bar');
    expect(s.execute('printenv FOO; echo $?')).toBe('1');
    s.execute('export FOO');
    expect(s.execute('printenv FOO')).toBe('bar');
    expect(s.execute('env -u FOO | grep -c FOO')).toBe('0');
    expect(s.execute('env -i')).toBe('');
    expect(s.execute('env A=1 printenv A')).toBe('1');
    expect(s.execute('env nosuch')).toBe("env: 'nosuch': No such file or directory");
  });
});
