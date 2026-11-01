// Le terminal : ce qui dépend de l'écran et de la langue. ls range ses
// colonnes dans la largeur du terminal ($COLUMNS, mesurée par l'interface),
// le double Tab montre les possibilités (comme bash), la commande qui
// liste les autres porte le nom de la langue (aide, help), et l'anglais est
// la langue par défaut et de repli.
import { describe, expect, it } from 'vitest';
import { Shell } from '../src/engine/shell';
import { Console } from '../src/engine/console';
import { STORIES } from '../src/engine/chapters';
import { inColumns } from '../src/engine/commands/files';
import { gameLanguage, translator } from '../src/texts';

const chapter = (id: string) => STORIES.flatMap((h) => h.chapters).find((c) => c.id === id)!;

describe('Le terminal', () => {
  it('ls range ses colonnes dans la largeur du terminal, comme GNU ls', () => {
    const names = ['alpha', 'beta', 'gamma', 'delta', 'epsilon', 'zeta', 'eta', 'theta'];
    // Assez large : une seule ligne, deux espaces entre les colonnes.
    expect(inColumns(names, 80)).toBe('alpha  beta  gamma  delta  epsilon  zeta  eta  theta');
    // Un téléphone : aucune ligne ne dépasse, les colonnes se remplissent de haut en bas.
    const narrow = inColumns(names, 24);
    expect(narrow.split('\n').every((l) => l.length <= 24)).toBe(true);
    expect(narrow.split('\n')[0].startsWith('alpha')).toBe(true);
    expect(inColumns(names, 3).split('\n')).toEqual(names);
    const s = new Shell(chapter('lighthouse'), 'fr');
    s.columns = 30;
    const output = s.execute('ls') ?? '';
    expect(output.split('\n').every((l) => l.length <= 30)).toBe(true);
  });

  it('double Tab : les possibilités, avec un / pour les lieux', () => {
    const s = new Shell(chapter('lighthouse'), 'fr');
    const places = s.suggestions('cd ');
    expect(places.length).toBeGreaterThan(1);
    expect(places).toEqual(expect.arrayContaining(['Colline/', 'Port/', 'message.txt']));
    // Une seule possibilité : Tab la complète, rien à montrer.
    expect(s.suggestions('cd Col')).toEqual([]);
    expect(s.complete('cd Col')).toBe('cd Colline/');
    // Les commandes, au début de la ligne.
    expect(s.suggestions('c')).toEqual(expect.arrayContaining(['cat', 'cd', 'clear']));
    const c = new Console({ language: 'fr' });
    c.columns = 40;
    expect(c.suggestions('ss').length).toBeGreaterThan(0);
  });

  it('la commande d’aide porte le nom de la langue, et help marche partout', () => {
    const fr = new Shell(chapter('lighthouse'), 'fr');
    const inside = new Shell(chapter('lighthouse'), 'en');
    expect(fr.known()).toContain('aide');
    expect(inside.known()).toContain('help');
    expect(inside.known()).not.toContain('aide');
    expect(inside.execute('help')).toContain('Known commands');
    expect(fr.execute('help')).toBe(fr.execute('aide'));
    inside.execute('aide');
    expect(inside.recoverErrors().join('')).toContain('aide');
    inside.execute('lss');
    expect(inside.recoverErrors().join('')).toContain('Type "help" for the list.');
  });

  it('cd - : retour au dossier d’avant, comme bash', () => {
    let s = new Shell(chapter('lighthouse'), 'en');
    s.execute('cd -');
    expect(s.recoverErrors().join('')).toContain('cd: OLDPWD not set');
    const fr = new Shell(chapter('lighthouse'), 'fr');
    fr.execute('cd -');
    expect(fr.recoverErrors().join('')).toContain('OLDPWD non défini');
    s = fr;
    const home = s.cwd;
    s.execute('cd Port');
    expect(s.execute('cd -')).toBe(home);
    expect(s.cwd).toBe(home);
    expect(s.execute('cd -')).toBe(`${home}/Port`);
    expect(s.execute('pwd')).toBe(`${home}/Port`);
  });

  it('le mot de passe noté dans le journal se traduit avec les noms (tournesol → sunflower)', () => {
    const inside = new Shell(chapter('root'), 'en');
    expect(inside.execute('cat journal.txt')).toContain('sunflower');
    expect(inside.execute('cat journal.txt')).not.toContain('tournesol');
    inside.execute('sudo ls /root');
    expect(inside.execute('tournesol')).toContain('Sorry, try again.');
    expect(inside.execute('sunflower')).not.toContain('Sorry');
    expect(inside.execute('sudo ls /root')).not.toContain('password');
    const fr = new Shell(chapter('root'), 'fr');
    fr.execute('sudo ls /root');
    expect(fr.execute('tournesol')).not.toContain('Désolé');
  });

  it('history et !! : comme bash (sudo !!, !n, !-n, !début, event not found)', () => {
    const s = new Shell(chapter('root'), 'fr');
    s.execute('ls');
    s.execute('cat /etc/effaceur.conf');
    s.execute(' whoami');
    s.execute('cat /etc/effaceur.conf');
    // Les doublons qui se suivent et les lignes qui commencent par une espace ne sont pas gardés.
    expect(s.execute('history')).toBe('    1  ls\n    2  cat /etc/effaceur.conf\n    3  history');
    expect(s.execute('history 1')).toBe('    4  history 1');
    // !! relance la dernière, et l'affiche d'abord.
    expect((s.execute('!!') ?? '').split('\n')[0]).toBe('history 1');
    expect((s.execute('!1') ?? '').split('\n')[0]).toBe('ls');
    expect((s.execute('!ca') ?? '').split('\n')[0]).toBe('cat /etc/effaceur.conf');
    expect((s.execute('!-2') ?? '').split('\n')[0]).toBe('ls');
    expect(s.execute('!zut')).toBe('-bash: !zut: event not found');
    // sudo !! : la commande oubliée relancée avec sudo (le mot de passe est demandé).
    s.execute('ls /root');
    s.execute('sudo !!');
    expect(s.waiting?.line).toBe('sudo ls /root');
    s.execute('tournesol');
    expect(s.history.at(-1)).toBe('sudo ls /root');
    // Entre apostrophes, ! reste un caractère.
    s.execute("cat '!!'");
    expect(s.recoverErrors().join('')).toContain('cat : !! :');
    s.execute('history -c');
    expect(s.execute('history')).toBe('    1  history');
  });

  it('l’anglais est la langue par défaut et de repli', () => {
    expect(gameLanguage()).toBe('en');
    expect(gameLanguage('')).toBe('en');
    expect(gameLanguage('fr')).toBe('fr');
    expect(gameLanguage('fr-CA')).toBe('fr');
    expect(gameLanguage('EN-gb')).toBe('en');
    expect(gameLanguage('xx')).toBe('en');
    expect(translator().language).toBe('en');
    expect(translator('de').language).toBe('en');
    expect(new Console({}).t.language).toBe('en');
  });
});
