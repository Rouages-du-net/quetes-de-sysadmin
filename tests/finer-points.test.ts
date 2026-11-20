// Finer points of everyday commands: ls -l with links, dates (the six
// months rule) and total, ls -F, du counting 4 KiB blocks, cp -u, touch
// on an existing file, find -prune, -xdev and -ls.
import { describe, expect, it } from 'vitest';
import { Shell } from '../src/engine/shell';
import { d, f, type Chapter } from '../src/engine/world';
import { nowOf } from '../src/engine/time';

const mine = { owner: 'you' };
const YEAR = 365 * 86_400_000;
const chapter = (): Chapter => ({
  id: 'finer-points-test',
  number: 1,
  commands: ['ls', 'cat', 'cp', 'touch', 'find', 'du', 'echo'],
  home: '/home/you',
  welcome: 'new',
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
      srv: d({ data: f('x'.repeat(5000), { owner: 'root' }) }, undefined, { owner: 'root' }),
      home: d(
        {
          you: d(
            {
              new: f('hello', mine),
              old: f('older', { ...mine, mtime: Date.UTC(2025, 2, 3, 8, 15) }),
              'run.sh': f('#!/bin/sh', { ...mine, mode: 'rwxr-xr-x' }),
              lk: f('', { ...mine, link: 'new' }),
              proj: d({ '.git': d({ HEAD: f('ref', mine) }, undefined, mine), 'main.c': f('int main;', mine) }, undefined, mine),
            },
            undefined,
            mine,
          ),
        },
        undefined,
        { owner: 'root' },
      ),
    }),
});
const shell = (language: 'en' | 'fr' = 'en') => {
  const s = new Shell(chapter(), language);
  s.colours = false;
  return s;
};

describe('ls -l', () => {
  it('links, owner, group, size, date and a total, aligned', () => {
    const s = shell();
    const lines = s.execute('ls -l')!.split('\n');
    expect(lines[0]).toBe('total 16');
    expect(lines[1]).toMatch(/^lrwxrwxrwx 1 you you {4}3 \w{3} [ \d]\d \d\d:\d\d lk -> new$/);
    expect(lines.find((l) => l.endsWith(' old'))).toBe('-rw-r--r-- 1 you you    5 Mar  3  2025 old');
    expect(lines.find((l) => l.endsWith('proj/'))).toMatch(/^drwxr-xr-x 3 you you 4096 \w{3} [ \d]\d \d\d:\d\d proj\/$/);
    expect(s.execute('ls -lh /srv')).toMatch(/^total 8\.0K\n-rw-r--r-- 1 root root 4\.9K /);
  });

  it('the date in French, and a file from the future shows its year', () => {
    const s = shell('fr');
    expect(s.execute('ls -l old')).toMatch(/^-rw-r--r-- 1 you you 5 +3 mars +2025 old$/);
    const n = s.find('/home/you/new')!;
    if (n.type === 'file') n.mtime = nowOf(s) + YEAR;
    expect(s.execute('ls -l new')).toMatch(/ 2028 new$/);
  });

  it('-F marks places, links and programs', () => {
    const s = shell();
    expect(s.execute('ls -F | cat')).toBe('lk@\nnew\nold\nproj/\nrun.sh*');
  });
});

describe('du counts blocks', () => {
  it('a small file takes 4 KiB, a directory its own block; -b and --apparent-size the bytes', () => {
    const s = shell();
    expect(s.execute('du -s /srv')).toBe('12\t/srv');
    expect(s.execute('du -sb /srv')).toBe('9096\t/srv');
    expect(s.execute('du -s --apparent-size /srv')).toBe('9\t/srv');
  });
});

describe('cp -u and touch', () => {
  it('cp -u copies only what is newer; touch makes a file recent', () => {
    const s = shell();
    s.execute('cp new copy');
    s.execute('echo changed > new');
    s.find('/home/you/copy')!.type === 'file' && ((s.find('/home/you/copy') as { mtime?: number }).mtime = Date.UTC(2026, 0, 1));
    (s.find('/home/you/new') as { mtime?: number }).mtime = Date.UTC(2025, 0, 1);
    s.execute('cp -u new copy');
    expect(s.execute('cat copy')).toBe('hello');
    s.execute('touch new');
    s.execute('cp -u new copy');
    expect(s.execute('cat copy')).toBe('changed');
    expect(s.execute('ls -l old')).toContain(' 2025 ');
    s.execute('touch old');
    expect(s.execute('ls -l old')).not.toContain(' 2025 ');
  });
});

describe('find', () => {
  it('-prune skips a directory, -xdev stays on its file system, -ls lists', () => {
    const s = shell();
    expect(s.execute('find proj -name .git -prune -o -type f -print')).toBe('proj/main.c');
    expect(s.execute('find / -xdev -name data')).toBe('');
    expect(s.execute('find / -name data')).toBe('/srv/data');
    expect(s.execute('find proj -name main.c -ls')).toMatch(/^ +\d+ +4 -rw-r--r-- +1 you +you +9 \w{3} [ \d]\d \d\d:\d\d proj\/main\.c$/);
  });
});
