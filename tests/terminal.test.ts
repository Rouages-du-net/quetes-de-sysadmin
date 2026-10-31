// Le terminal : ce qui dépend de l'écran et de la langue. ls range ses
// colonnes dans la largeur du terminal ($COLUMNS, mesurée par l'interface),
// le double Tab montre les possibilités (comme bash), la commande qui
// liste les autres porte le nom de la langue (aide, help), et l'anglais est
// la langue par défaut et de repli.
import { describe, expect, it } from 'vitest';
import { Shell } from '../src/engine/shell';
import { Console } from '../src/engine/console';
import { HISTOIRES } from '../src/engine/chapters';
import { enColonnes } from '../src/engine/commands/files';
import { langueDuJeu, traducteur } from '../src/texts';

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

  it('cd - : retour au dossier d’avant, comme bash', () => {
    let s = new Shell(chapitre('eveil'), 'en');
    s.executer('cd -');
    expect(s.recupererErreurs().join('')).toContain('cd: OLDPWD not set');
    const fr = new Shell(chapitre('eveil'), 'fr');
    fr.executer('cd -');
    expect(fr.recupererErreurs().join('')).toContain('OLDPWD non défini');
    s = fr;
    const maison = s.cwd;
    s.executer('cd Port');
    expect(s.executer('cd -')).toBe(maison);
    expect(s.cwd).toBe(maison);
    expect(s.executer('cd -')).toBe(`${maison}/Port`);
    expect(s.executer('pwd')).toBe(`${maison}/Port`);
  });

  it('le mot de passe noté dans le journal se traduit avec les noms (tournesol → sunflower)', () => {
    const en = new Shell(chapitre('racine'), 'en');
    expect(en.executer('cat journal.txt')).toContain('sunflower');
    expect(en.executer('cat journal.txt')).not.toContain('tournesol');
    en.executer('sudo ls /root');
    expect(en.executer('tournesol')).toContain('Sorry, try again.');
    expect(en.executer('sunflower')).not.toContain('Sorry');
    expect(en.executer('sudo ls /root')).not.toContain('password');
    const fr = new Shell(chapitre('racine'), 'fr');
    fr.executer('sudo ls /root');
    expect(fr.executer('tournesol')).not.toContain('Désolé');
  });

  it('history et !! : comme bash (sudo !!, !n, !-n, !début, event not found)', () => {
    const s = new Shell(chapitre('racine'), 'fr');
    s.executer('ls');
    s.executer('cat /etc/effaceur.conf');
    s.executer(' whoami');
    s.executer('cat /etc/effaceur.conf');
    // Les doublons qui se suivent et les lignes qui commencent par une espace ne sont pas gardés.
    expect(s.executer('history')).toBe('    1  ls\n    2  cat /etc/effaceur.conf\n    3  history');
    expect(s.executer('history 1')).toBe('    4  history 1');
    // !! relance la dernière, et l'affiche d'abord.
    expect((s.executer('!!') ?? '').split('\n')[0]).toBe('history 1');
    expect((s.executer('!1') ?? '').split('\n')[0]).toBe('ls');
    expect((s.executer('!ca') ?? '').split('\n')[0]).toBe('cat /etc/effaceur.conf');
    expect((s.executer('!-2') ?? '').split('\n')[0]).toBe('ls');
    expect(s.executer('!zut')).toBe('-bash: !zut: event not found');
    // sudo !! : la commande oubliée relancée avec sudo (le mot de passe est demandé).
    s.executer('ls /root');
    s.executer('sudo !!');
    expect(s.attente?.ligne).toBe('sudo ls /root');
    s.executer('tournesol');
    expect(s.historique.at(-1)).toBe('sudo ls /root');
    // Entre apostrophes, ! reste un caractère.
    s.executer("cat '!!'");
    expect(s.recupererErreurs().join('')).toContain('cat : !! :');
    s.executer('history -c');
    expect(s.executer('history')).toBe('    1  history');
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
