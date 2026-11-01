// Command-line highlighting: what the game's shell would run
// (or not), options, strings, operators, paths that
// exist; and the line always joins back identically.
import { describe, expect, it } from 'vitest';
import { Shell } from '../src/engine/shell';
import { STORIES } from '../src/engine/chapters';
import { colourise, type Kind } from '../src/engine/highlighting';

const chapter = (id: string) => STORIES.flatMap((h) => h.chapters).find((c) => c.id === id)!;
// The words and their kind, without the spaces.
const kinds = (sh: Shell, line: string) =>
  colourise(sh, line)
    .filter((j) => j.text.trim())
    .map((j): [string, Kind] => [j.text.trim(), j.kind]);

describe('Command-line highlighting', () => {
  const sh = () => new Shell(chapter('root'), 'fr');

  it('the command: known, unknown, not learnt yet', () => {
    const s = sh();
    expect(kinds(s, 'ls')).toEqual([['ls', 'command']]);
    expect(kinds(s, 'lss')).toEqual([['lss', 'unknown']]);
    // nmap and echo exist in the game, but not yet in this chapter: the shell would refuse them.
    expect(kinds(s, 'nmap')[0][1]).toBe('unknown');
    expect(kinds(s, 'echo x')[0][1]).toBe('unknown');
    expect(kinds(s, '/bin/ls')).toEqual([['/bin/ls', 'command']]);
    expect(kinds(s, 'help')).toEqual([['help', 'command']]);
  });

  it('options, strings, wildcards, operators, existing paths', () => {
    const s = sh();
    expect(kinds(s, 'grep -i "un mot" *.txt | grep -v x > copie')).toEqual([
      ['grep', 'command'],
      ['-i', 'option'],
      ['"un mot"', 'string'],
      ['*.txt', 'glob'],
      ['|', 'operator'],
      ['grep', 'command'],
      ['-v', 'option'],
      ['x', 'text'],
      ['>', 'operator'],
      ['copie', 'text'],
    ]);
    expect(kinds(s, 'cat journal.txt absent.txt')).toEqual([
      ['cat', 'command'],
      ['journal.txt', 'path'],
      ['absent.txt', 'text'],
    ]);
    // A wildcard that matches nothing stays text (the shell passes it as is).
    expect(kinds(s, 'ls *.rien')[1]).toEqual(['*.rien', 'text']);
    // Inside quotes, "-x" is not an option but a string.
    expect(kinds(s, 'grep "-x" journal.txt')[1]).toEqual(['"-x"', 'string']);
  });

  it('sudo: its options, then the command', () => {
    expect(kinds(sh(), 'sudo -u bob rm -rf x')).toEqual([
      ['sudo', 'command'],
      ['-u', 'option'],
      ['bob', 'text'],
      ['rm', 'command'],
      ['-rf', 'option'],
      ['x', 'text'],
    ]);
  });

  it('the line joins back identically, spaces and quotes included', () => {
    const s = sh();
    for (const line of ['', '   ', '  ls   -la  ', `grep 'a'"b"c  "non fermé`, 'cat a>>b|wc', 'ls\t-a', 'sudo', 'sudo -u'])
      expect(colourise(s, line).map((j) => j.text).join('')).toBe(line);
  });

  it('in each chapter, its commands are recognised', () => {
    for (const c of STORIES.flatMap((h) => h.chapters)) {
      const s = new Shell(c, 'fr');
      for (const cmd of s.known().filter((x) => x !== 'exit' && x !== 'clear')) expect([cmd, colourise(s, cmd)[0].kind]).toEqual([cmd, 'command']);
    }
  });
});
