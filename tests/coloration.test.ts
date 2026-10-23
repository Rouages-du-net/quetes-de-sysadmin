// La coloration de la ligne de commande : ce que le shell du jeu lancerait
// (ou pas), les options, les chaînes, les opérateurs, les chemins qui
// existent ; et la ligne se recolle toujours à l'identique.
import { describe, expect, it } from 'vitest';
import { Shell } from '../src/moteur/shell';
import { HISTOIRES } from '../src/moteur/chapitres';
import { colorer, type Genre } from '../src/moteur/coloration';

const chapitre = (id: string) => HISTOIRES.flatMap((h) => h.chapitres).find((c) => c.id === id)!;
// Les mots et leur genre, sans les espaces.
const genres = (sh: Shell, ligne: string) =>
  colorer(sh, ligne)
    .filter((j) => j.texte.trim())
    .map((j): [string, Genre] => [j.texte.trim(), j.genre]);

describe('Coloration de la ligne de commande', () => {
  const sh = () => new Shell(chapitre('racine'), 'fr');

  it('la commande : connue, inconnue, pas encore apprise', () => {
    const s = sh();
    expect(genres(s, 'ls')).toEqual([['ls', 'commande']]);
    expect(genres(s, 'lss')).toEqual([['lss', 'inconnue']]);
    // nmap n'existe pas dans le jeu ; echo existe, mais pas encore dans ce chapitre : le shell refuserait.
    expect(genres(s, 'nmap')[0][1]).toBe('inconnue');
    expect(genres(s, 'echo x')[0][1]).toBe('inconnue');
    expect(genres(s, '/bin/ls')).toEqual([['/bin/ls', 'commande']]);
  });

  it('options, chaînes, jokers, opérateurs, chemins existants', () => {
    const s = sh();
    expect(genres(s, 'grep -i "un mot" *.txt | grep -v x > copie')).toEqual([
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
    expect(genres(s, 'cat journal.txt absent.txt')).toEqual([
      ['cat', 'commande'],
      ['journal.txt', 'chemin'],
      ['absent.txt', 'texte'],
    ]);
    // Un joker qui ne trouve rien reste du texte (le shell le passe tel quel).
    expect(genres(s, 'ls *.rien')[1]).toEqual(['*.rien', 'texte']);
    // Entre guillemets, « -x » n'est pas une option mais une chaîne.
    expect(genres(s, 'grep "-x" journal.txt')[1]).toEqual(['"-x"', 'chaine']);
  });

  it('sudo : ses options, puis la commande', () => {
    expect(genres(sh(), 'sudo -u bob rm -rf x')).toEqual([
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
    for (const ligne of ['', '   ', '  ls   -la  ', `grep 'a'"b"c  "non fermé`, 'cat a>>b|wc', 'ls\t-a', 'sudo', 'sudo -u'])
      expect(colorer(s, ligne).map((j) => j.texte).join('')).toBe(ligne);
  });

  it('dans chaque chapitre, ses commandes sont reconnues', () => {
    for (const c of HISTOIRES.flatMap((h) => h.chapitres)) {
      const s = new Shell(c, 'fr');
      for (const cmd of s.connues().filter((x) => x !== 'exit' && x !== 'clear')) expect([cmd, colorer(s, cmd)[0].genre]).toEqual([cmd, 'commande']);
    }
  });
});
