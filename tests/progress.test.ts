// Taking your progress along: the short code (finished chapters) and the file
// (the whole save). A code given one day must stay valid afterwards:
// the order of chapters in the code only ever grows.
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { STORIES } from '../src/engine/chapters';
import { progressCode, backupFile, readCode, readFile, CODE_ORDER } from '../src/engine/progress';

const ALL = STORIES.flatMap((h) => h.chapters.map((c) => c.id));

describe('The short code', () => {
  it('knows each chapter, only once', () => {
    expect(new Set(CODE_ORDER).size).toBe(CODE_ORDER.length);
    expect([...ALL].sort()).toEqual([...CODE_ORDER].sort());
  });

  it('has only grown since the codes already given (tests/progress/order.txt)', () => {
    // Adding a chapter: add it at the end of CODE_ORDER, then at the end of this file.
    const gives = readFileSync('tests/progress/order.txt', 'utf8').trim().split('\n');
    expect(CODE_ORDER.slice(0, gives.length)).toEqual(gives);
    expect(CODE_ORDER.length).toBe(gives.length);
  });

  it('round trip, from the start to the end of the game', () => {
    for (const finished of [[], ['lighthouse'], ['lighthouse', 'village', 'root', 'backup', 'vlan', 'wifi'], ALL]) {
      const code = progressCode(finished);
      expect(code).toMatch(/^QDS(-[0-9A-HJKMNP-TV-Z]{1,4})+$/);
      expect(readCode(code)).toEqual({ finished: CODE_ORDER.filter((id) => finished.includes(id)) });
    }
    // Short at the start, just under thirty characters at the end.
    expect(progressCode(['lighthouse']).length).toBeLessThanOrEqual(12);
    expect(progressCode(ALL).length).toBeLessThanOrEqual(31);
  });

  it('copies without trouble: lower case, spaces, O for 0, I or L for 1', () => {
    const code = progressCode(['lighthouse', 'village', 'root', 'keys']);
    const copy = code.toLowerCase().replace(/-/g, ' ').replace(/0/g, 'o').replace(/1/g, 'l');
    expect(readCode(copy)).toEqual(readCode(code));
  });

  it('a typo is detected, not loaded', () => {
    const code = progressCode(['lighthouse', 'village', 'root', 'backup', 'first-day']);
    const body = code.slice(4).replace(/-/g, '');
    let spotted = 0;
    for (let i = 0; i < body.length; i++) {
      const other = body[i] === 'A' ? 'B' : 'A';
      const no = readCode(body.slice(0, i) + other + body.slice(i + 1));
      if ('error' in no) spotted++;
    }
    expect(spotted).toBe(body.length);
    expect(readCode('QDS-ZZ')).toEqual({ error: 'code-unreadable' });
    expect(readCode('n’importe quoi')).toEqual({ error: 'code-unreadable' });
  });
});

describe('The file', () => {
  const backup = {
    finished: ['lighthouse', 'village'],
    story: 'eraser',
    known: 'kingdom.internal ssh-ed25519 AAAA',
    ssh: { files: { config: 'Host wiki\n    ProxyJump community' } },
    notebook: { ls: { line: 'ls -a', chapter: 'lighthouse' } },
    exam: false,
    records: { lighthouse: 61000 },
    name: 'Lina',
  };

  it('round trip', () => {
    expect(readFile(backupFile(backup, new Date('2027-01-15T10:00:00Z')))).toEqual({ backup });
  });

  it('keeps only what the game knows', () => {
    const read = readFile(
      JSON.stringify({
        format: 'quetes-de-sysadmin',
        version: 1,
        backup: { finished: ['lighthouse', 'unknown', 42], story: 'nulle-part', notebook: { ls: 'pas un objet' }, records: { lighthouse: -1 }, name: '  Lina\n\tB.  ' },
      }),
    );
    expect(read).toEqual({ backup: { finished: ['lighthouse'], story: null, notebook: {}, exam: false, records: {}, name: 'Lina B.' } });
  });

  it('refuses what is not a save of the game', () => {
    expect(readFile('pas du JSON')).toEqual({ error: 'file-unreadable' });
    expect(readFile('{"format":"autre"}')).toEqual({ error: 'file-other' });
    expect(readFile('{"format":"quetes-de-sysadmin","version":9,"backup":{}}')).toEqual({ error: 'file-too-recent' });
  });
});
