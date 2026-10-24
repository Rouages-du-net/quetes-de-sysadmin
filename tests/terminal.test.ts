// Le terminal : ce qui dépend de l'écran et de la langue. ls range ses
// colonnes dans la largeur du terminal ($COLUMNS, mesurée par l'interface),
// le double Tab montre les possibilités (comme bash), la commande qui
// liste les autres porte le nom de la langue (aide, help), et l'anglais est
// la langue par défaut et de repli.
import { describe, expect, it } from 'vitest';
import { Shell } from '../src/moteur/shell';
import { Console } from '../src/moteur/console';
import { HISTOIRES } from '../src/moteur/chapitres';
import { enColonnes } from '../src/moteur/commandes/fichiers';
import { langueDuJeu, traducteur } from '../src/textes';

const chapitre = (id: string) => HISTOIRES.flatMap((h) => h.chapitres).find((c) => c.id === id)!;

describe('Le terminal', () => {
  it('ls range ses colonnes dans la largeur du terminal, comme GNU ls', () => {
    const noms = ['alpha', 'beta', 'gamma', 'delta', 'epsilon', 'zeta', 'eta', 'theta'];
    // Assez large : une seule ligne, deux espaces entre les colonnes.
    expect(enColonnes(noms, 80)).toBe('alpha  beta  gamma  delta  epsilon  zeta  eta  theta');
    // Un téléphone : aucune ligne ne dépasse, les colonnes se remplissent de haut en bas.
    const etroit = enColonnes(noms, 24);
    expect(etroit.split('\n').every((l) => l.length <= 24)).toBe(true);
    expect(etroit.split('\n')[0].startsWith('alpha')).toBe(true);
    expect(enColonnes(noms, 3).split('\n')).toEqual(noms);
    const s = new Shell(chapitre('eveil'), 'fr');
    s.colonnes = 30;
    const sortie = s.executer('ls') ?? '';
    expect(sortie.split('\n').every((l) => l.length <= 30)).toBe(true);
  });

  it('double Tab : les possibilités, avec un / pour les lieux', () => {
    const s = new Shell(chapitre('eveil'), 'fr');
    const lieux = s.suggestions('cd ');
    expect(lieux.length).toBeGreaterThan(1);
    expect(lieux).toEqual(expect.arrayContaining(['Colline/', 'Port/', 'message.txt']));
    // Une seule possibilité : Tab la complète, rien à montrer.
    expect(s.suggestions('cd Col')).toEqual([]);
    expect(s.completer('cd Col')).toBe('cd Colline/');
    // Les commandes, au début de la ligne.
    expect(s.suggestions('c')).toEqual(expect.arrayContaining(['cat', 'cd', 'clear']));
    const c = new Console({ langue: 'fr' });
    c.colonnes = 40;
    expect(c.suggestions('ss').length).toBeGreaterThan(0);
  });

  it('la commande d’aide porte le nom de la langue, et help marche partout', () => {
    const fr = new Shell(chapitre('eveil'), 'fr');
    const en = new Shell(chapitre('eveil'), 'en');
    expect(fr.connues()).toContain('aide');
    expect(en.connues()).toContain('help');
    expect(en.connues()).not.toContain('aide');
    expect(en.executer('help')).toContain('Known commands');
    expect(fr.executer('help')).toBe(fr.executer('aide'));
    en.executer('aide');
    expect(en.recupererErreurs().join('')).toContain('aide');
    en.executer('lss');
    expect(en.recupererErreurs().join('')).toContain('Type "help" for the list.');
  });

  it('l’anglais est la langue par défaut et de repli', () => {
    expect(langueDuJeu()).toBe('en');
    expect(langueDuJeu('')).toBe('en');
    expect(langueDuJeu('fr')).toBe('fr');
    expect(langueDuJeu('fr-CA')).toBe('fr');
    expect(langueDuJeu('EN-gb')).toBe('en');
    expect(langueDuJeu('xx')).toBe('en');
    expect(traducteur().langue).toBe('en');
    expect(traducteur('de').langue).toBe('en');
    expect(new Console({}).t.langue).toBe('en');
  });
});
