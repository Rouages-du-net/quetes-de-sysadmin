// Everyday options of the text tools, as GNU coreutils 9.4 and GNU sed 4.9
// give them: head/tail -n -N, -n +N, -c, -n5; sort -k, -t, -u, -h, -V, -f,
// -c, -o; uniq -d, -u, -i, -f; cut ranges, -c, -s, --complement; sed's
// address ranges.

import { describe, expect, it } from 'vitest';
import { Shell } from '../src/engine/shell';
import { d, f, type Chapter } from '../src/engine/world';

const PW = 'root:x:0:0\nana:x:1001:1001\nbob:x:1000:1000\nsys:x:3:3';
const mine = { owner: 'you', lines: true };
const chapter = (): Chapter => ({
  id: 'text-options-test',
  number: 1,
  commands: ['head', 'tail', 'sort', 'uniq', 'cut', 'sed', 'cat', 'echo', 'du'],
  home: '/home/you',
  welcome: 'pw',
  final: '',
  events: [],
  createWorld: () =>
    d({
      home: d({
        you: d(
          {
            pw: f(PW, mine),
            l: f('a\nb\nc\nd\ne', mine),
            sizes: f('4.0K\t/var/log/a\n1.2G\t/var/log/b\n512M\t/var/log/c\n12K\t/var/log/d', mine),
            versions: f('v1.10\nv1.9\nv1.2', mine),
            visits: f('10.0.0.1 a\n10.0.0.2 b\n10.0.0.1 c', mine),
            u: f('a\nA\na\nb\nb\nc', mine),
          },
          undefined,
          { owner: 'you' },
        ),
      }),
    }),
});

const shell = () => {
  const s = new Shell(chapter(), 'en');
  s.colours = false;
  return s;
};

describe('head and tail', () => {
  it('-n N, -nN, -N, -n -N, -n +N, -c', () => {
    const s = shell();
    expect(s.execute('head -n1 pw')).toBe('root:x:0:0');
    expect(s.execute('tail -n1 pw')).toBe('sys:x:3:3');
    expect(s.execute('head -n -1 pw')).toBe('root:x:0:0\nana:x:1001:1001\nbob:x:1000:1000');
    expect(s.execute('tail -n +3 pw')).toBe('bob:x:1000:1000\nsys:x:3:3');
    expect(s.execute('head -c 6 pw')).toBe('root:x');
    expect(s.execute('tail -c 6 l')).toBe('c\nd\ne');
    expect(s.execute('head -n x pw')).toBe('head: invalid number of lines: ‘x’');
  });
});

describe('sort', () => {
  it('-t and -k, with their own flags', () => {
    const s = shell();
    expect(s.execute('sort -t: -k3,3n pw')).toBe('root:x:0:0\nsys:x:3:3\nbob:x:1000:1000\nana:x:1001:1001');
    expect(s.execute('sort -t: -k3 -n -r pw')).toBe('ana:x:1001:1001\nbob:x:1000:1000\nsys:x:3:3\nroot:x:0:0');
    expect(s.execute("echo -e 'x 3\\ny 1\\nz 2' | sort -k2")).toBe('y 1\nz 2\nx 3');
    expect(s.execute('sort -t:: pw')).toBe('sort: multi-character tab ‘::’');
  });

  it('-h, -V, -u, -f, -c, -o', () => {
    const s = shell();
    expect(s.execute('sort -h sizes')).toBe('4.0K\t/var/log/a\n12K\t/var/log/d\n512M\t/var/log/c\n1.2G\t/var/log/b');
    expect(s.execute('sort -rh sizes | head -n 1')).toBe('1.2G\t/var/log/b');
    expect(s.execute('sort -V versions')).toBe('v1.2\nv1.9\nv1.10');
    expect(s.execute('sort -u u')).toBe('a\nA\nb\nc');
    expect(s.execute('sort -fu u')).toBe('a\nb\nc');
    expect(s.execute('sort -c l')).toBe('');
    expect(s.execute('sort -c versions')).toBe('sort: versions:3: disorder: v1.2');
    expect(s.execute('echo $?')).toBe('1');
    expect(s.execute('sort -o versions -V versions')).toBe('');
    expect(s.execute('cat versions')).toBe('v1.2\nv1.9\nv1.10');
  });

  it('the classic count of visitors', () => {
    const s = shell();
    expect(s.execute('cut -d" " -f1 visits | sort | uniq -c | sort -rn')).toBe('      2 10.0.0.1\n      1 10.0.0.2');
  });
});

describe('uniq', () => {
  it('-d, -u, -i, -c, -f', () => {
    const s = shell();
    expect(s.execute('uniq -d u')).toBe('b');
    expect(s.execute('uniq -u u')).toBe('a\nA\na\nc');
    expect(s.execute('uniq -ci u')).toBe('      3 a\n      2 b\n      1 c');
    expect(s.execute("echo -e 'x a\\ny a\\nz b' | uniq -f1")).toBe('x a\nz b');
  });
});

describe('cut', () => {
  it('ranges, -c, -s, --complement, --output-delimiter', () => {
    const s = shell();
    expect(s.execute('cut -d: -f1,3 pw | head -n 2')).toBe('root:0\nana:1001');
    expect(s.execute('cut -c1-3 pw | head -n 2')).toBe('roo\nana');
    expect(s.execute("echo 'abcdef:gh:ij' | cut -d: -f2-")).toBe('gh:ij');
    expect(s.execute("echo 'abcdef:gh:ij' | cut -d: -f-2")).toBe('abcdef:gh');
    expect(s.execute("echo 'abcdef:gh:ij' | cut -d: --complement -f2")).toBe('abcdef:ij');
    expect(s.execute("echo 'nodelim' | cut -d: -s -f1")).toBe('');
    expect(s.execute("echo 'a:b' | cut -d: -f1,2 --output-delimiter=' '")).toBe('a b');
    expect(s.execute('echo x | cut -c0')).toBe("cut: byte/character positions are numbered from 1\nTry 'cut --help' for more information.");
    expect(s.execute('echo x | cut -f3-1')).toBe("cut: invalid decreasing range\nTry 'cut --help' for more information.");
  });
});

describe('sed: address ranges', () => {
  it('N,M, /a/,/b/, N,$, /re/,+N, a backwards range, ! on a range', () => {
    const s = shell();
    expect(s.execute("sed -n '2,4p' l")).toBe('b\nc\nd');
    expect(s.execute("sed '2,3d' l")).toBe('a\nd\ne');
    expect(s.execute("sed -n '/b/,/d/p' l")).toBe('b\nc\nd');
    expect(s.execute("sed -n '3,$p' l")).toBe('c\nd\ne');
    expect(s.execute("sed -n '/c/,+1p' l")).toBe('c\nd');
    expect(s.execute("sed -n '4,2p' l")).toBe('d');
    expect(s.execute("sed '2,4!d' l")).toBe('b\nc\nd');
    expect(s.execute("sed -n '1,/a/p' l")).toBe('a\nb\nc\nd\ne');
  });
});
