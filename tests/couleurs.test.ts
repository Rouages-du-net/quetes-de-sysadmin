// Les couleurs des sorties : comme les vrais outils, seulement à l'écran
// (--color=auto), jamais dans un tube ni un fichier, sauf --color=always ;
// les événements lisent la sortie sans les codes.
import { describe, expect, it } from 'vitest';
import { Shell } from '../src/moteur/shell';
import { HISTOIRES } from '../src/moteur/chapitres';
import { morceaux, sansCouleurs } from '../src/moteur/couleurs';

const chapitre = (id: string) => HISTOIRES.flatMap((h) => h.chapitres).find((c) => c.id === id)!;
const ESC = '\x1b';
const shell = (id: string) => {
  const s = new Shell(chapitre(id), 'fr');
  s.couleurs = true;
  return s;
};

describe('Couleurs des sorties', () => {
  it('ls : les lieux en bleu gras, le / hors de la couleur ; rien dans un tube ni un fichier', () => {
    const s = shell('racine');
    const ecran = s.executer('ls')!;
    expect(ecran).toContain(`${ESC}[01;34msouvenirs${ESC}[0m/`);
    expect(sansCouleurs(ecran)).toContain('souvenirs/');
    expect(s.executer('ls | cat')).not.toContain(ESC);
    expect(s.executer('ls | cat')).toContain('souvenirs');
    expect(s.executer('ls --color=never')).not.toContain(ESC);
    // --color=always : les codes partent aussi dans le tube, comme sur un vrai système.
    expect(s.executer('ls --color=always | grep -c souvenirs')).toBe('1');
    expect(s.executer('ls --color=always | grep souvenirs')).toContain(`${ESC}[01;34m`);
    // Sans couleurs à l'écran (réglage coupé), rien non plus.
    s.couleurs = false;
    expect(s.executer('ls')).not.toContain(ESC);
  });

  it('ls -l : seul le nom est coloré ; --color=n’importe-quoi donne le message de coreutils', () => {
    const s = shell('racine');
    const long = s.executer('ls -l')!;
    expect(long.split('\n').find((l) => l.includes('souvenirs'))).toMatch(new RegExp(`^drwx.* ${ESC}\\[01;34msouvenirs${ESC}\\[0m/$`));
    expect(s.executer('ls --color=parfois')).toContain('argument « parfois » incorrect pour « --color »');
  });

  it('grep : le motif surligné, pas avec -v ; la sortie des événements reste sans codes', () => {
    const s = shell('racine');
    const trouve = s.executer('grep -i effaceur journal.txt')!;
    expect(trouve).toMatch(new RegExp(`${ESC}\\[01;31m[Ee]ffaceur${ESC}\\[0m`));
    expect(s.derniere.sortie).not.toContain(ESC);
    expect(s.derniere.sortie).toBe(sansCouleurs(trouve));
    expect(s.executer('grep -v effaceur journal.txt')).not.toContain(`${ESC}[01;31m`);
    expect(s.executer('grep --color=never -i effaceur journal.txt')).not.toContain(ESC);
  });

  it('morceaux : les séquences lues comme un terminal', () => {
    expect(morceaux(`a${ESC}[01;34mb${ESC}[0mc${ESC}[36m${ESC}[Kd`)).toEqual([
      { texte: 'a', gras: false, avant: null, fond: null },
      { texte: 'b', gras: true, avant: 34, fond: null },
      { texte: 'c', gras: false, avant: null, fond: null },
      { texte: 'd', gras: false, avant: 36, fond: null },
    ]);
    expect(morceaux(`${ESC}[30;42mtmp${ESC}[0m`)).toEqual([{ texte: 'tmp', gras: false, avant: 30, fond: 42 }]);
  });
});

describe('Couleurs de systemctl et de diff', () => {
  it('systemctl status : le point vert d’un service actif, la croix rouge d’un échec', () => {
    const s = shell('redemarrage');
    const echec = s.executer('systemctl status catalogue')!;
    expect(echec).toContain(`${ESC}[0;1;31m×${ESC}[0m catalogue.service`);
    expect(echec).toContain(`${ESC}[0;1;31mfailed${ESC}[0m (Result:`);
    expect(s.executer('systemctl --failed')).toContain(`${ESC}[0;1;31m●${ESC}[0m`);
    // Dans un tube : rien.
    expect(s.executer('systemctl status catalogue | head -n 1')).not.toContain(ESC);
  });

  it('diff : sans couleur par défaut ; --color à l’écran : rouge et vert', () => {
    const s = shell('depot-nu');
    s.executer('echo un > a.txt');
    s.executer('echo deux > b.txt');
    expect(s.executer('diff a.txt b.txt')).not.toContain(ESC);
    const colore = s.executer('diff --color a.txt b.txt')!;
    expect(colore).toContain(`${ESC}[31m< un${ESC}[0m`);
    expect(colore).toContain(`${ESC}[32m> deux${ESC}[0m`);
    expect(s.executer('diff --color -u a.txt b.txt')).toContain(`${ESC}[36m@@ -1 +1 @@${ESC}[0m`);
  });
});
