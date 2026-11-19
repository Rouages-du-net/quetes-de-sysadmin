// grep's context (-A, -B, -C, -NUM), its separators and the options it goes
// with (-n, -H, -v, -m, -c, -o). Every expected output was produced by GNU
// grep 3.11 on the same files.

import { describe, expect, it } from 'vitest';
import { Shell } from '../src/engine/shell';
import { d, f, type Chapter } from '../src/engine/world';
import { ESC } from '../src/engine/colours';

const F = ['a1', 'b2', 'match3', 'c4', 'd5', 'e6', 'f7', 'match8', 'match9', 'g10', 'h11'].join('\n');
const H = ['x', 'match', 'y'].join('\n');

const chapter: Chapter = {
  id: 'attempt-grep-context',
  number: 1,
  commands: ['grep', 'cat', 'echo'],
  home: '/home/you',
  welcome: 'f',
  final: '',
  events: [],
  createWorld: () => d({ home: d({ you: d({ f: f(F, { lines: true }), h: f(H, { lines: true }) }) }) }),
};

function shell(os?: 'freebsd' | 'solaris') {
  const s = new Shell(chapter, 'en');
  s.colours = false;
  if (os) s.state.os = os;
  return s;
}
const status = (s: Shell) => s.execute('echo $?');

// [command, exit code, output], as GNU grep 3.11 gives them.
const GNU: [string, number, string][] = [
  ["grep -A1 match f", 0, "match3\nc4\n--\nmatch8\nmatch9\ng10"],
  ["grep -B2 match9 f", 0, "f7\nmatch8\nmatch9"],
  ["grep -C1 match f", 0, "b2\nmatch3\nc4\n--\nf7\nmatch8\nmatch9\ng10"],
  ["grep -1 match f", 0, "b2\nmatch3\nc4\n--\nf7\nmatch8\nmatch9\ng10"],
  ["grep -2A0 match3 f", 0, "a1\nb2\nmatch3"],
  ["grep -C1 -A0 match3 f", 0, "b2\nmatch3"],
  ["grep -A 1 -B 3 match9 f", 0, "e6\nf7\nmatch8\nmatch9\ng10"],
  ["grep --context=1 match3 f", 0, "b2\nmatch3\nc4"],
  ["grep --after-context 1 match3 f", 0, "match3\nc4"],
  ["grep --before-context=1 match8 f", 0, "f7\nmatch8"],
  ["grep -n -C1 match f", 0, "2-b2\n3:match3\n4-c4\n--\n7-f7\n8:match8\n9:match9\n10-g10"],
  ["grep -nA1 match3 f", 0, "3:match3\n4-c4"],
  ["grep -A1 match f h", 0, "f:match3\nf-c4\n--\nf:match8\nf:match9\nf-g10\n--\nh:match\nh-y"],
  ["grep -h -A1 match f h", 0, "match3\nc4\n--\nmatch8\nmatch9\ng10\n--\nmatch\ny"],
  ["grep -H -C1 match h", 0, "h-x\nh:match\nh-y"],
  ["grep -A0 match f h", 0, "f:match3\n--\nf:match8\nf:match9\n--\nh:match"],
  ["grep -v -A1 '[a-f]' f", 0, "g10\nh11"],
  ["grep -vn -B1 match f", 0, "1:a1\n2:b2\n3-match3\n4:c4\n5:d5\n6:e6\n7:f7\n--\n9-match9\n10:g10\n11:h11"],
  ["grep -m1 -A6 match f", 0, "match3\nc4\nd5\ne6\nf7\nmatch8\nmatch9"],
  ["grep -n -m2 -C1 match f", 0, "2-b2\n3:match3\n4-c4\n--\n7-f7\n8:match8\n9-match9"],
  ["grep -c -A1 match f h", 0, "f:3\nh:1"],
  ["grep -o -A1 atch f", 0, "atch\n--\natch\natch"],
  ["grep -on -C1 atch f h", 0, "f:3:atch\n--\nf:8:atch\nf:9:atch\n--\nh:2:atch"],
  ["grep --group-separator=XX -A1 match f", 0, "match3\nc4\nXX\nmatch8\nmatch9\ng10"],
  ["grep --no-group-separator -A1 match f", 0, "match3\nc4\nmatch8\nmatch9\ng10"],
  ["grep --group-separator= -A1 match f", 0, "match3\nc4\n\nmatch8\nmatch9\ng10"],
  ["grep -A 99999999999999999999 match9 f", 0, "match9\ng10\nh11"],
  ["grep -A ' 1' match3 f", 0, "match3\nc4"],
  ["grep -A +1 match3 f", 0, "match3\nc4"],
  ["grep -A1 nomatch f", 1, ""],
];

describe('grep: context lines, like GNU grep', () => {
  for (const [command, code, output] of GNU)
    it(command, () => {
      const s = shell();
      // The game adds a message on screen when nothing matches (a deliberate difference): not in a pipe.
      expect(s.execute(`${command} | cat`) ?? '').toBe(output);
      s.execute(command);
      expect(status(s)).toBe(String(code));
    });

  it('invalid arguments: the messages and exit code 2 of GNU grep', () => {
    const s = shell();
    const error = (command: string) => {
      s.execute(command);
      const message = s.last.errors.join('\n');
      expect(status(s)).toBe('2');
      return message;
    };
    expect(error('grep -A abc match f')).toBe('grep: abc: invalid context length argument');
    expect(error('grep -C -1 match f')).toBe('grep: -1: invalid context length argument');
    expect(error('grep -A 1x match f')).toBe('grep: 1x: invalid context length argument');
    expect(error('grep --context x match f')).toBe('grep: x: invalid context length argument');
    expect(error('grep -m abc match f')).toBe('grep: invalid max count');
    const usage = "Usage: grep [OPTION]... PATTERNS [FILE]...\nTry 'grep --help' for more information.";
    expect(error('grep match f -A')).toBe(`grep: option requires an argument -- 'A'\n${usage}`);
    expect(error('grep match f --after-context')).toBe(`grep: option '--after-context' requires an argument\n${usage}`);
    expect(error('grep --count=3 match f')).toBe(`grep: option '--count' doesn't allow an argument\n${usage}`);
    expect(error('grep -k match f')).toBe(`grep: invalid option -- 'k'\n${usage}`);
    expect(error('grep --frob match f')).toBe(`grep: unrecognized option '--frob'\n${usage}`);
  });

  it('a pipe: (standard input) with -H', () => {
    const s = shell();
    expect(s.execute('cat h | grep -H -A1 match')).toBe('(standard input):match\n(standard input)-y');
  });

  it('in colour: the separators in cyan, the line numbers in green, the matches of -v context lines in red', () => {
    const s = shell();
    s.colours = true;
    const cyan = (t: string) => `${ESC}[36m${t}${ESC}[0m`;
    const red = (t: string) => `${ESC}[01;31m${t}${ESC}[0m`;
    const green = (t: string) => `${ESC}[32m${t}${ESC}[0m`;
    expect(s.execute('grep -n -A1 match3 f')).toBe(`${green('3')}${cyan(':')}${red('match3')}\n${green('4')}${cyan('-')}c4`);
    expect(s.execute('grep -A1 match f')!.split('\n')[2]).toBe(cyan('--'));
    // -v: the selected lines are not highlighted, the context lines (which match) are.
    expect(s.execute('grep -v -A1 match3 f')!.split('\n').slice(0, 4)).toEqual(['a1', 'b2', red('match3'), 'c4']);
    expect(s.execute('grep -H -A1 match3 f')).toBe(`${ESC}[35mf${ESC}[0m${cyan(':')}${red('match3')}\n${ESC}[35mf${ESC}[0m${cyan('-')}c4`);
  });

  it('the manual and --help describe the context', () => {
    const s = shell();
    expect(s.execute('grep --help')).toContain('-A');
    expect(s.execute('man grep')).toContain('--group-separator');
  });
});

describe('grep: context on the other Unixes', () => {
  it('FreeBSD: grep has -A, -B and -C', () => {
    const s = shell('freebsd');
    expect(s.execute('grep -n -C1 match3 f')).toBe('2-b2\n3:match3\n4-c4');
  });

  it("Solaris 10: neither /usr/bin/grep nor /usr/xpg4/bin/grep has context", () => {
    const s = shell('solaris');
    s.execute('grep -A1 match f');
    expect(s.last.errors.join('\n')).toBe('grep: illegal option -- A\nUsage: grep -hblcnsviw pattern file . . .');
    expect(status(s)).toBe('2');
    s.execute('/usr/xpg4/bin/grep -C 2 match f');
    expect(s.last.errors.join('\n')).toMatch(/^grep: illegal option -- C\nUsage:\tgrep \[-E\|-F\]/);
    expect(status(s)).toBe('2');
    expect(s.execute('/usr/xpg4/bin/grep -c match f')).toBe('3');
  });
});
