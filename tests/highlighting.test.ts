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
  const sh = () => new Shell(chapter('racine'), 'fr');

  it('la commande : connue, inconnue, pas encore apprise', () => {
    const s = sh();
    expect(kinds(s, 'ls')).toEqual([['ls', 'commande']]);
    expect(kinds(s, 'lss')).toEqual([['lss', 'inconnue']]);
    // nmap et echo existent dans le jeu, mais pas encore dans ce chapitre : le shell refuserait.
    expect(kinds(s, 'nmap')[0][1]).toBe('inconnue');
    expect(kinds(s, 'echo x')[0][1]).toBe('inconnue');
    expect(kinds(s, '/bin/ls')).toEqual([['/bin/ls', 'commande']]);
    expect(kinds(s, 'help')).toEqual([['help', 'commande']]);
  });

  it('options, chaînes, jokers, opérateurs, chemins existants', () => {
    const s = sh();
    expect(kinds(s, 'grep -i "un mot" *.txt | grep -v x > copie')).toEqual([
      ['grep', 'commande'],
      ['-i', 'option'],
      ['"un mot"', 'chaine'],
      ['*.txt', 'joker'],
      ['|', 'operateur'],
      ['grep', 'commande'],
      ['-v', 'option'],
      ['x', 'texte'],
      ['>', 'operateur'],
      ['copie', 'texte'],
    ]);
    expect(kinds(s, 'cat journal.txt absent.txt')).toEqual([
      ['cat', 'commande'],
      ['journal.txt', 'chemin'],
      ['absent.txt', 'texte'],
    ]);
    // Un joker qui ne trouve rien reste du texte (le shell le passe tel quel).
    expect(kinds(s, 'ls *.rien')[1]).toEqual(['*.rien', 'texte']);
    // Entre guillemets, « -x » n'est pas une option mais une chaîne.
    expect(kinds(s, 'grep "-x" journal.txt')[1]).toEqual(['"-x"', 'chaine']);
  });

  it('sudo : ses options, puis la commande', () => {
    expect(kinds(sh(), 'sudo -u bob rm -rf x')).toEqual([
      ['sudo', 'commande'],
      ['-u', 'option'],
      ['bob', 'texte'],
      ['rm', 'commande'],
      ['-rf', 'option'],
      ['x', 'texte'],
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
      for (const cmd of s.known().filter((x) => x !== 'exit' && x !== 'clear')) expect([cmd, colourise(s, cmd)[0].kind]).toEqual([cmd, 'commande']);
    }
  });
});
