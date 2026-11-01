// Les couleurs des sorties : comme les vrais outils, seulement à l'écran
// (--color=auto), jamais dans un tube ni un fichier, sauf --color=always ;
// les événements lisent la sortie sans les codes.
import { describe, expect, it } from 'vitest';
import { machinesInLanguage } from './names';
import { Shell } from '../src/engine/shell';
import { STORIES } from '../src/engine/chapters';
import { chunks, withoutColours } from '../src/engine/colours';

const chapter = (id: string) => STORIES.flatMap((h) => h.chapters).find((c) => c.id === id)!;
const ESC = '\x1b';
const shell = (id: string) => {
  const s = new Shell(chapter(id), 'fr');
  s.colours = true;
  return s;
};

describe('Couleurs des sorties', () => {
  it('ls : les lieux en bleu gras, le / hors de la couleur ; rien dans un tube ni un fichier', () => {
    const s = shell('root');
    const screen = s.execute('ls')!;
    expect(screen).toContain(`${ESC}[01;34msouvenirs${ESC}[0m/`);
    expect(withoutColours(screen)).toContain('souvenirs/');
    expect(s.execute('ls | cat')).not.toContain(ESC);
    expect(s.execute('ls | cat')).toContain('souvenirs');
    expect(s.execute('ls --color=never')).not.toContain(ESC);
    // --color=always : les codes partent aussi dans le tube, comme sur un vrai système.
    expect(s.execute('ls --color=always | grep -c souvenirs')).toBe('1');
    expect(s.execute('ls --color=always | grep souvenirs')).toContain(`${ESC}[01;34m`);
    // Sans couleurs à l'écran (réglage coupé), rien non plus.
    s.colours = false;
    expect(s.execute('ls')).not.toContain(ESC);
  });

  it('ls -l : seul le nom est coloré ; --color=n’importe-quoi donne le message de coreutils', () => {
    const s = shell('root');
    const long = s.execute('ls -l')!;
    expect(long.split('\n').find((l) => l.includes('souvenirs'))).toMatch(new RegExp(`^drwx.* ${ESC}\\[01;34msouvenirs${ESC}\\[0m/$`));
    expect(s.execute('ls --color=parfois')).toContain('argument « parfois » incorrect pour « --color »');
  });

  it('grep : le motif surligné, pas avec -v ; la sortie des événements reste sans codes', () => {
    const s = shell('root');
    const found = s.execute('grep -i effaceur journal.txt')!;
    expect(found).toMatch(new RegExp(`${ESC}\\[01;31m[Ee]ffaceur${ESC}\\[0m`));
    expect(s.last.output).not.toContain(ESC);
    expect(s.last.output).toBe(withoutColours(found));
    expect(s.execute('grep -v effaceur journal.txt')).not.toContain(`${ESC}[01;31m`);
    expect(s.execute('grep --color=never -i effaceur journal.txt')).not.toContain(ESC);
  });

  it('morceaux : les séquences lues comme un terminal', () => {
    expect(chunks(`a${ESC}[01;34mb${ESC}[0mc${ESC}[36m${ESC}[Kd`)).toEqual([
      { text: 'a', bold: false, before: null, background: null },
      { text: 'b', bold: true, before: 34, background: null },
      { text: 'c', bold: false, before: null, background: null },
      { text: 'd', bold: false, before: 36, background: null },
    ]);
    expect(chunks(`${ESC}[30;42mtmp${ESC}[0m`)).toEqual([{ text: 'tmp', bold: false, before: 30, background: 42 }]);
  });
});

describe('Couleurs de systemctl et de diff', () => {
  it('systemctl status : le point vert d’un service actif, la croix rouge d’un échec', () => {
    const s = shell('reboot-night');
    const failure = s.execute('systemctl status catalogue')!;
    expect(failure).toContain(`${ESC}[0;1;31m×${ESC}[0m catalogue.service`);
    expect(failure).toContain(`${ESC}[0;1;31mfailed${ESC}[0m (Result:`);
    expect(s.execute('systemctl --failed')).toContain(`${ESC}[0;1;31m●${ESC}[0m`);
    // Dans un tube : rien.
    expect(s.execute('systemctl status catalogue | head -n 1')).not.toContain(ESC);
  });

  it('diff : sans couleur par défaut ; --color à l’écran : rouge et vert', () => {
    const s = shell('bare-repo');
    s.execute('echo un > a.txt');
    s.execute('echo deux > b.txt');
    expect(s.execute('diff a.txt b.txt')).not.toContain(ESC);
    const coloured = s.execute('diff --color a.txt b.txt')!;
    expect(coloured).toContain(`${ESC}[31m< un${ESC}[0m`);
    expect(coloured).toContain(`${ESC}[32m> deux${ESC}[0m`);
    expect(s.execute('diff --color -u a.txt b.txt')).toContain(`${ESC}[36m@@ -1 +1 @@${ESC}[0m`);
  });
});

describe('Couleurs de journalctl, ip -c et git', () => {
  it('journalctl : les erreurs en rouge gras, à l’écran seulement', () => {
    const s = shell('reboot-night');
    s.execute('sudo -l');
    s.execute(machinesInLanguage(s.t, 'bienvenue-2026'));
    const log = s.execute('sudo journalctl -u catalogue')!;
    expect(log).toContain(`${ESC}[1;31m`);
    expect(withoutColours(log)).toContain('ERROR: FPM initialization failed');
    expect(s.execute('sudo journalctl -u catalogue | grep -c FPM')).toBe('1');
    expect(s.execute('sudo journalctl -u catalogue | head -n 3')).not.toContain(ESC);
  });

  it('ip -c : nom en cyan, UP en vert, MAC en jaune, IPv4 en magenta ; sans -c, rien', () => {
    const s = shell('vlan');
    const a = s.execute('ip -c a')!;
    expect(a).toContain(`2: ${ESC}[36meth0${ESC}[0m:`);
    expect(a).toContain(`state ${ESC}[32mUP${ESC}[0m`);
    expect(a).toContain(`link/ether ${ESC}[33m`);
    expect(a).toContain(`inet ${ESC}[35m192.0.2.21/24${ESC}[0m`);
    expect(s.execute('ip a')).not.toContain(ESC);
    expect(s.execute('ip -br -color=never a')).not.toContain(ESC);
    // -c (always) : même dans un tube, comme iproute2.
    expect(s.execute('ip -c -br a | grep eth0')).toContain(`${ESC}[36m`);
  });

  it('git : diff en rouge et vert, status (non suivi en rouge), --no-color', () => {
    const s = shell('bare-repo');
    s.execute('cd gazette');
    s.execute('echo nouveau > essai.txt');
    expect(s.execute('git status')).toContain(`\t${ESC}[31messai.txt${ESC}[0m`);
    expect(s.execute('git status --no-color')).not.toContain(ESC);
    s.execute('echo ajout >> style.css');
    const d = s.execute('git diff')!;
    expect(d).toContain(`${ESC}[32m+ajout${ESC}[0m`);
    expect(d).toContain(`${ESC}[1mdiff --git`);
    expect(s.execute('git diff | cat')).not.toContain(ESC);
    // git log : les commits en jaune.
    expect(s.execute('git log --oneline')).toMatch(new RegExp(`^${ESC}\\[33m[0-9a-f]{7}${ESC}\\[0m `));
  });
});
