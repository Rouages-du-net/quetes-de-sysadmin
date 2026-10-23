// Emporter sa progression : le code court (chapitres terminés) et le fichier
// (toute la sauvegarde). Un code donné un jour doit rester valable ensuite :
// l'ordre des chapitres dans le code ne fait que s'allonger.
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { HISTOIRES } from '../src/moteur/chapitres';
import { codeDeProgression, fichierDeSauvegarde, lireCode, lireFichier, ORDRE_DU_CODE } from '../src/moteur/progression';

const TOUS = HISTOIRES.flatMap((h) => h.chapitres.map((c) => c.id));

describe('Le code court', () => {
  it('connaît chaque chapitre, une seule fois', () => {
    expect(new Set(ORDRE_DU_CODE).size).toBe(ORDRE_DU_CODE.length);
    expect([...TOUS].sort()).toEqual([...ORDRE_DU_CODE].sort());
  });

  it('n’a fait que s’allonger depuis les codes déjà donnés (tests/progression/ordre.txt)', () => {
    // Ajouter un chapitre : l'ajouter à la fin d'ORDRE_DU_CODE, puis à la fin de ce fichier.
    const donne = readFileSync('tests/progression/ordre.txt', 'utf8').trim().split('\n');
    expect(ORDRE_DU_CODE.slice(0, donne.length)).toEqual(donne);
    expect(ORDRE_DU_CODE.length).toBe(donne.length);
  });

  it('aller et retour, du début à la fin du jeu', () => {
    for (const termines of [[], ['eveil'], ['eveil', 'bourg', 'racine', 'sauvegarde', 'vlan', 'wifi'], TOUS]) {
      const code = codeDeProgression(termines);
      expect(code).toMatch(/^QDS(-[0-9A-HJKMNP-TV-Z]{1,4})+$/);
      expect(lireCode(code)).toEqual({ termines: ORDRE_DU_CODE.filter((id) => termines.includes(id)) });
    }
    // Court au début, une vingtaine de caractères à la fin.
    expect(codeDeProgression(['eveil']).length).toBeLessThanOrEqual(12);
    expect(codeDeProgression(TOUS).length).toBeLessThanOrEqual(24);
  });

  it('se recopie sans souci : minuscules, espaces, O pour 0, I ou L pour 1', () => {
    const code = codeDeProgression(['eveil', 'bourg', 'racine', 'cles']);
    const recopie = code.toLowerCase().replace(/-/g, ' ').replace(/0/g, 'o').replace(/1/g, 'l');
    expect(lireCode(recopie)).toEqual(lireCode(code));
  });

  it('une faute de frappe est repérée, pas chargée', () => {
    const code = codeDeProgression(['eveil', 'bourg', 'racine', 'sauvegarde', 'premier-jour']);
    const corps = code.slice(4).replace(/-/g, '');
    let reperees = 0;
    for (let i = 0; i < corps.length; i++) {
      const autre = corps[i] === 'A' ? 'B' : 'A';
      const faux = lireCode(corps.slice(0, i) + autre + corps.slice(i + 1));
      if ('erreur' in faux) reperees++;
    }
    expect(reperees).toBe(corps.length);
    expect(lireCode('QDS-ZZ')).toEqual({ erreur: 'code-illisible' });
    expect(lireCode('n’importe quoi')).toEqual({ erreur: 'code-illisible' });
  });
});

describe('Le fichier', () => {
  const sauvegarde = {
    termines: ['eveil', 'bourg'],
    histoire: 'effaceur',
    connus: 'royaume.example ssh-ed25519 AAAA',
    ssh: { fichiers: { config: 'Host wiki\n    ProxyJump maison' } },
    carnet: { ls: { ligne: 'ls -a', chapitre: 'eveil' } },
    examen: false,
    records: { eveil: 61000 },
    nom: 'Lina',
  };

  it('aller et retour', () => {
    expect(lireFichier(fichierDeSauvegarde(sauvegarde, new Date('2027-01-15T10:00:00Z')))).toEqual({ sauvegarde });
  });

  it('ne garde que ce que le jeu connaît', () => {
    const lu = lireFichier(
      JSON.stringify({
        format: 'quetes-de-sysadmin',
        version: 1,
        sauvegarde: { termines: ['eveil', 'inconnu', 42], histoire: 'nulle-part', carnet: { ls: 'pas un objet' }, records: { eveil: -1 }, nom: '  Lina\n\tB.  ' },
      }),
    );
    expect(lu).toEqual({ sauvegarde: { termines: ['eveil'], histoire: null, carnet: {}, examen: false, records: {}, nom: 'Lina B.' } });
  });

  it('refuse ce qui n’est pas une sauvegarde du jeu', () => {
    expect(lireFichier('pas du JSON')).toEqual({ erreur: 'fichier-illisible' });
    expect(lireFichier('{"format":"autre"}')).toEqual({ erreur: 'fichier-autre' });
    expect(lireFichier('{"format":"quetes-de-sysadmin","version":9,"sauvegarde":{}}')).toEqual({ erreur: 'fichier-trop-recent' });
  });
});
