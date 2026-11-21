// The shell's redirections (man bash, "REDIRECTION"): 2>, 2>>, &>, &>>,
// 2>&1 (in order: >f 2>&1 is not 2>&1 >f), >&2, /dev/null, < and the
// here-string <<<. The expected outputs were produced by bash 5.2 on the
// same files.

import { describe, expect, it } from 'vitest';
import { Shell } from '../src/engine/shell';
import { d, f, type Chapter } from '../src/engine/world';
import { colourise } from '../src/engine/highlighting';
import { split } from '../src/engine/tools';

const chapter = (): Chapter => ({
  id: 'redirections-test',
  number: 1,
  commands: ['ls', 'cat', 'echo', 'grep', 'wc', 'sudo', 'tr', 'head'],
  home: '/home/you',
  welcome: 'notes.txt',
  final: '',
  password: 'sunflower',
  events: [],
  createWorld: () => d({ etc: d({ secret: f('x', { owner: 'root', mode: 'rw-------' }) }, undefined, { owner: 'root' }), home: d({ you: d({ 'notes.txt': f('alpha\nbeta\ngamma', { lines: true }) }) }) }),
});

const shell = () => {
  const s = new Shell(chapter(), 'en');
  s.colours = false;
  return s;
};
const MISSING = "ls: cannot access 'nothere': No such file or directory";

describe('Redirections', () => {
  it('splits the operators like bash', () => {
    const ops = (line: string) => split(line).map((w) => w.op ?? w.text);
    expect(ops('ls x 2>/dev/null')).toEqual(['ls', 'x', '2>', '/dev/null']);
    expect(ops('ls x >f 2>&1')).toEqual(['ls', 'x', '>', 'f', '2>&1']);
    expect(ops('ls x &>> f')).toEqual(['ls', 'x', '&>>', 'f']);
    expect(ops('echo oops 1>&2')).toEqual(['echo', 'oops', '>&2']);
    expect(ops('wc -l < f')).toEqual(['wc', '-l', '<', 'f']);
    expect(ops("grep a <<< 'abc'")).toEqual(['grep', 'a', '<<<', 'abc']);
    // A 2 inside a word, or quoted, is no redirection.
    expect(ops('head -n 2 f')).toEqual(['head', '-n', '2', 'f']);
    expect(ops('echo a2>f')).toEqual(['echo', 'a2', '>', 'f']);
    expect(ops("echo '2>x'")).toEqual(['echo', '2>x']);
  });

  it('2>/dev/null hides the errors, but the command still fails', () => {
    const s = shell();
    expect(s.execute('ls notes.txt nothere 2>/dev/null')).toBe('notes.txt');
    expect(s.execute('echo $?')).not.toBe('0');
    expect(s.last.errors).toEqual([]);
  });

  it('>f 2>&1 sends both into the file, errors first; 2>&1 >f keeps the errors on screen', () => {
    const s = shell();
    expect(s.execute('ls notes.txt nothere > out.txt 2>&1')).toBe('');
    expect(s.execute('cat out.txt')).toBe(`${MISSING}\nnotes.txt`);
    expect(s.execute('ls notes.txt nothere 2>&1 > out2.txt')).toBe(MISSING);
    expect(s.execute('cat out2.txt')).toBe('notes.txt');
  });

  it('2> and 2>> write the errors to a file, &> both', () => {
    const s = shell();
    expect(s.execute('ls nothere 2> err.txt')).toBe('');
    expect(s.execute('ls nothere 2>> err.txt')).toBe('');
    expect(s.execute('cat err.txt')).toBe(`${MISSING}\n${MISSING}`);
    expect(s.execute('ls notes.txt nothere &> all.txt')).toBe('');
    expect(s.execute('cat all.txt')).toBe(`${MISSING}\nnotes.txt`);
    expect(s.execute('ls notes.txt &>> all.txt')).toBe('');
    expect(s.execute('wc -l all.txt')).toBe('3 all.txt');
  });

  it('2>> and >> with nothing to write leave the file as it was (bash creates it, adds no line)', () => {
    const s = shell();
    expect(s.execute('ls nothere 2> err.txt')).toBe('');
    expect(s.execute('ls notes.txt 2>> err.txt')).toBe('notes.txt');
    expect(s.execute('wc -l err.txt')).toBe('1 err.txt');
    expect(s.execute('cat err.txt')).toBe(MISSING);
    expect(s.execute('ls notes.txt 2>> fresh.txt')).toBe('notes.txt');
    expect(s.execute('wc -c fresh.txt')).toBe('0 fresh.txt');
    expect(s.execute('true >> err.txt')).toBe('');
    expect(s.execute('wc -l err.txt')).toBe('1 err.txt');
  });

  it('2>&1 in a pipe sends the errors down the pipe', () => {
    const s = shell();
    expect(s.execute('ls nothere | wc -l')).toBe(`${MISSING}\n0`);
    expect(s.execute('ls nothere 2>&1 | wc -l')).toBe('1');
    expect(s.execute('ls nothere 2>&1 | grep -c cannot')).toBe('1');
  });

  it('>/dev/null and >&2', () => {
    const s = shell();
    expect(s.execute('cat notes.txt > /dev/null')).toBe('');
    expect(s.execute('ls notes.txt nothere >/dev/null 2>&1')).toBe('');
    expect(s.execute('echo oops >&2')).toBe('oops');
    expect(s.execute('echo oops >&2 | wc -l')).toBe('oops\n0');
  });

  it('< reads a file as input, and stops the command if it cannot', () => {
    const s = shell();
    expect(s.execute('wc -l < notes.txt')).toBe('3');
    expect(s.execute('tr a-z A-Z < notes.txt')).toBe('ALPHA\nBETA\nGAMMA');
    expect(s.execute('cat < nothere')).toBe('bash: nothere: No such file or directory');
    expect(s.execute('echo $?')).toBe('1');
    expect(s.execute('cat < /etc/secret')).toBe('bash: /etc/secret: Permission denied');
    expect(s.execute('cat < /dev/null')).toBe('');
  });

  it('<<< gives a word as input', () => {
    const s = shell();
    expect(s.execute("grep -c a <<< 'abc'")).toBe('1');
    expect(s.execute('wc -w <<< "one two three"')).toBe('3');
  });

  it('a redirection is done by your shell, not by sudo', () => {
    const s = shell();
    s.execute('sudo ls 2> /etc/err');
    const out = s.execute('sunflower') ?? '';
    expect(out).toContain('/etc/err: Permission denied');
  });

  it('the highlighting shows the new operators', () => {
    const s = shell();
    const kinds = (line: string) => colourise(s, line).filter((t) => t.kind === 'operator').map((t) => t.text);
    expect(kinds('ls x 2>/dev/null')).toEqual(['2>']);
    expect(kinds('ls x >f 2>&1 | wc -l')).toEqual(['>', '2>&1', '|']);
    expect(kinds('wc -l < notes.txt')).toEqual(['<']);
    expect(colourise(s, 'ls x 1>f 2>&1').map((t) => t.text).join('')).toBe('ls x 1>f 2>&1');
  });
});
