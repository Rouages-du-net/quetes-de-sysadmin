// Emporter sa progression : le code court (chapitres terminés) et le fichier
// (toute la sauvegarde). Un code donné un jour doit rester valable ensuite :
// l'ordre des chapitres dans le code ne fait que s'allonger.
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { STORIES } from '../src/engine/chapters';
import { progressCode, backupFile, readCode, readFile, CODE_ORDER } from '../src/engine/progress';

const ALL = STORIES.flatMap((h) => h.chapters.map((c) => c.id));

describe('Le code court', () => {
  it('connaît chaque chapitre, une seule fois', () => {
    expect(new Set(CODE_ORDER).size).toBe(CODE_ORDER.length);
    expect([...ALL].sort()).toEqual([...CODE_ORDER].sort());
  });

  it('n’a fait que s’allonger depuis les codes déjà donnés (tests/progress/order.txt)', () => {
    // Ajouter un chapitre : l'ajouter à la fin d'ORDRE_DU_CODE, puis à la fin de ce fichier.
    const gives = readFileSync('tests/progress/order.txt', 'utf8').trim().split('\n');
    expect(CODE_ORDER.slice(0, gives.length)).toEqual(gives);
    expect(CODE_ORDER.length).toBe(gives.length);
  });

  it('aller et retour, du début à la fin du jeu', () => {
    for (const finished of [[], ['lighthouse'], ['lighthouse', 'village', 'root', 'backup', 'vlan', 'wifi'], ALL]) {
      const code = progressCode(finished);
      expect(code).toMatch(/^QDS(-[0-9A-HJKMNP-TV-Z]{1,4})+$/);
      expect(readCode(code)).toEqual({ finished: CODE_ORDER.filter((id) => finished.includes(id)) });
    }
    // Court au début, une petite trentaine de caractères à la fin.
    expect(progressCode(['lighthouse']).length).toBeLessThanOrEqual(12);
    expect(progressCode(ALL).length).toBeLessThanOrEqual(31);
  });

  it('se recopie sans souci : minuscules, espaces, O pour 0, I ou L pour 1', () => {
    const code = progressCode(['lighthouse', 'village', 'root', 'keys']);
    const copy = code.toLowerCase().replace(/-/g, ' ').replace(/0/g, 'o').replace(/1/g, 'l');
    expect(readCode(copy)).toEqual(readCode(code));
  });

  it('une faute de frappe est repérée, pas chargée', () => {
    const code = progressCode(['lighthouse', 'village', 'root', 'backup', 'first-day']);
    const body = code.slice(4).replace(/-/g, '');
    let spotted = 0;
    for (let i = 0; i < body.length; i++) {
      const other = body[i] === 'A' ? 'B' : 'A';
      const no = readCode(body.slice(0, i) + other + body.slice(i + 1));
      if ('error' in no) spotted++;
    }
    expect(spotted).toBe(body.length);
    expect(readCode('QDS-ZZ')).toEqual({ error: 'code-illisible' });
    expect(readCode('n’importe quoi')).toEqual({ error: 'code-illisible' });
  });
});

describe('Le fichier', () => {
  const backup = {
    finished: ['lighthouse', 'village'],
    story: 'eraser',
    known: 'royaume.internal ssh-ed25519 AAAA',
    ssh: { files: { config: 'Host wiki\n    ProxyJump maison' } },
    notebook: { ls: { line: 'ls -a', chapter: 'lighthouse' } },
    exam: false,
    records: { lighthouse: 61000 },
    name: 'Lina',
  };

  it('aller et retour', () => {
    expect(readFile(backupFile(backup, new Date('2027-01-15T10:00:00Z')))).toEqual({ backup });
  });

  it('ne garde que ce que le jeu connaît', () => {
    const read = readFile(
      JSON.stringify({
        format: 'quetes-de-sysadmin',
        version: 1,
        backup: { finished: ['lighthouse', 'inconnu', 42], story: 'nulle-part', notebook: { ls: 'pas un objet' }, records: { lighthouse: -1 }, name: '  Lina\n\tB.  ' },
      }),
    );
    expect(read).toEqual({ backup: { finished: ['lighthouse'], story: null, notebook: {}, exam: false, records: {}, name: 'Lina B.' } });
  });

  it('refuse ce qui n’est pas une sauvegarde du jeu', () => {
    expect(readFile('pas du JSON')).toEqual({ error: 'fichier-illisible' });
    expect(readFile('{"format":"autre"}')).toEqual({ error: 'fichier-autre' });
    expect(readFile('{"format":"quetes-de-sysadmin","version":9,"backup":{}}')).toEqual({ error: 'fichier-trop-recent' });
  });
});
