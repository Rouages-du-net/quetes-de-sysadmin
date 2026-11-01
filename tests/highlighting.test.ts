// La coloration de la ligne de commande : ce que le shell du jeu lancerait
// (ou pas), les options, les chaînes, les opérateurs, les chemins qui
// existent ; et la ligne se recolle toujours à l'identique.
import { describe, expect, it } from 'vitest';
import { Shell } from '../src/engine/shell';
import { STORIES } from '../src/engine/chapters';
import { colourise, type Kind } from '../src/engine/highlighting';

const chapter = (id: string) => STORIES.flatMap((h) => h.chapters).find((c) => c.id === id)!;
// Les mots et leur genre, sans les espaces.
const kinds = (sh: Shell, line: string) =>
  colourise(sh, line)
    .filter((j) => j.text.trim())
    .map((j): [string, Kind] => [j.text.trim(), j.kind]);

describe('Coloration de la ligne de commande', () => {
  const sh = () => new Shell(chapter('root'), 'fr');

  it('la commande : connue, inconnue, pas encore apprise', () => {
    const s = sh();
    expect(kinds(s, 'ls')).toEqual([['ls', 'command']]);
    expect(kinds(s, 'lss')).toEqual([['lss', 'unknown']]);
    // nmap et echo existent dans le jeu, mais pas encore dans ce chapitre : le shell refuserait.
    expect(kinds(s, 'nmap')[0][1]).toBe('unknown');
    expect(kinds(s, 'echo x')[0][1]).toBe('unknown');
    expect(kinds(s, '/bin/ls')).toEqual([['/bin/ls', 'command']]);
    expect(kinds(s, 'help')).toEqual([['help', 'command']]);
  });

  it('options, chaînes, jokers, opérateurs, chemins existants', () => {
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
    // Un joker qui ne trouve rien reste du texte (le shell le passe tel quel).
    expect(kinds(s, 'ls *.rien')[1]).toEqual(['*.rien', 'text']);
    // Entre guillemets, « -x » n'est pas une option mais une chaîne.
    expect(kinds(s, 'grep "-x" journal.txt')[1]).toEqual(['"-x"', 'string']);
  });

  it('sudo : ses options, puis la commande', () => {
    expect(kinds(sh(), 'sudo -u bob rm -rf x')).toEqual([
      ['sudo', 'command'],
      ['-u', 'option'],
      ['bob', 'text'],
      ['rm', 'command'],
      ['-rf', 'option'],
      ['x', 'text'],
    ]);
  });

  it('la ligne se recolle à l’identique, espaces et guillemets compris', () => {
    const s = sh();
    for (const line of ['', '   ', '  ls   -la  ', `grep 'a'"b"c  "non fermé`, 'cat a>>b|wc', 'ls\t-a', 'sudo', 'sudo -u'])
      expect(colourise(s, line).map((j) => j.text).join('')).toBe(line);
  });

  it('dans chaque chapitre, ses commandes sont reconnues', () => {
    for (const c of STORIES.flatMap((h) => h.chapters)) {
      const s = new Shell(c, 'fr');
      for (const cmd of s.known().filter((x) => x !== 'exit' && x !== 'clear')) expect([cmd, colourise(s, cmd)[0].kind]).toEqual([cmd, 'command']);
    }
  });
});
