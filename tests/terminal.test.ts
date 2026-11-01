// The terminal: what depends on the screen and the language. ls fits its
// columns into the terminal's width ($COLUMNS, measured by the interface),
// double Tab shows the possibilities (like bash), the command that lists the
// others has the language's name (aide, help), and English is the default
// and fallback language.
import { describe, expect, it } from 'vitest';
import { Shell } from '../src/engine/shell';
import { Console } from '../src/engine/console';
import { STORIES } from '../src/engine/chapters';
import { inColumns } from '../src/engine/commands/files';
import { gameLanguage, translator } from '../src/texts';

const chapter = (id: string) => STORIES.flatMap((h) => h.chapters).find((c) => c.id === id)!;

describe('The terminal', () => {
  it('ls fits its columns into the terminal width, like GNU ls', () => {
    const names = ['alpha', 'beta', 'gamma', 'delta', 'epsilon', 'zeta', 'eta', 'theta'];
    // Wide enough: a single line, two spaces between columns.
    expect(inColumns(names, 80)).toBe('alpha  beta  gamma  delta  epsilon  zeta  eta  theta');
    // A phone: no line overflows, the columns fill from top to bottom.
    const narrow = inColumns(names, 24);
    expect(narrow.split('\n').every((l) => l.length <= 24)).toBe(true);
    expect(narrow.split('\n')[0].startsWith('alpha')).toBe(true);
    expect(inColumns(names, 3).split('\n')).toEqual(names);
    const s = new Shell(chapter('lighthouse'), 'fr');
    s.columns = 30;
    const output = s.execute('ls') ?? '';
    expect(output.split('\n').every((l) => l.length <= 30)).toBe(true);
  });

  it('double Tab: the possibilities, with a / for places', () => {
    const s = new Shell(chapter('lighthouse'), 'fr');
    const places = s.suggestions('cd ');
    expect(places.length).toBeGreaterThan(1);
    expect(places).toEqual(expect.arrayContaining(['Colline/', 'Port/', 'message.txt']));
    // A single possibility: Tab completes it, nothing to show.
    expect(s.suggestions('cd Col')).toEqual([]);
    expect(s.complete('cd Col')).toBe('cd Colline/');
    // The commands, at the start of the line.
    expect(s.suggestions('c')).toEqual(expect.arrayContaining(['cat', 'cd', 'clear']));
    const c = new Console({ language: 'fr' });
    c.columns = 40;
    expect(c.suggestions('ss').length).toBeGreaterThan(0);
  });

  it('the help command has the language\'s name, and help works everywhere', () => {
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

  it('cd -: back to the previous directory, like bash', () => {
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

  it('the password noted in the log is translated with the names (sunflower → tournesol)', () => {
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

  it('history and !!: like bash (sudo !!, !n, !-n, !prefix, event not found)', () => {
    const s = new Shell(chapter('root'), 'fr');
    s.execute('ls');
    s.execute('cat /etc/effaceur.conf');
    s.execute(' whoami');
    s.execute('cat /etc/effaceur.conf');
    // Consecutive duplicates and lines starting with a space are not kept.
    expect(s.execute('history')).toBe('    1  ls\n    2  cat /etc/effaceur.conf\n    3  history');
    expect(s.execute('history 1')).toBe('    4  history 1');
    // !! reruns the last one, and shows it first.
    expect((s.execute('!!') ?? '').split('\n')[0]).toBe('history 1');
    expect((s.execute('!1') ?? '').split('\n')[0]).toBe('ls');
    expect((s.execute('!ca') ?? '').split('\n')[0]).toBe('cat /etc/effaceur.conf');
    expect((s.execute('!-2') ?? '').split('\n')[0]).toBe('ls');
    expect(s.execute('!zut')).toBe('-bash: !zut: event not found');
    // sudo !!: the forgotten command rerun with sudo (the password is asked for).
    s.execute('ls /root');
    s.execute('sudo !!');
    expect(s.waiting?.line).toBe('sudo ls /root');
    s.execute('tournesol');
    expect(s.history.at(-1)).toBe('sudo ls /root');
    // Inside single quotes, ! stays a character.
    s.execute("cat '!!'");
    expect(s.recoverErrors().join('')).toContain('cat : !! :');
    s.execute('history -c');
    expect(s.execute('history')).toBe('    1  history');
  });

  it('English is the default and fallback language', () => {
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
