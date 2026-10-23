// Les succès : obtenus sur ce qui s'est vraiment passé, chacun avec ses
// textes dans chaque langue ; les clins d'œil ; le grade.
import { describe, expect, it } from 'vitest';
import { Shell } from '../src/moteur/shell';
import { HISTOIRES } from '../src/moteur/chapitres';
import { grade, nouveauxSucces, SUCCES } from '../src/moteur/succes';
import { lireFichier, fichierDeSauvegarde } from '../src/moteur/progression';
import { LANGUES, traducteur } from '../src/textes';

const eveil = HISTOIRES[0].chapitres[0];
const TOUS = HISTOIRES.flatMap((h) => h.chapitres.map((c) => c.id));

describe('Les succès', () => {
  it('ont un nom et une description dans chaque langue', () => {
    for (const langue of LANGUES) {
      const t = traducteur(langue);
      for (const s of SUCCES) {
        expect(t.existe(`succes-${s.id}`), `${langue} : ${s.id}`).toBe(true);
        expect(t(`succes-${s.id}.description`), `${langue} : ${s.id}`).not.toBe(`succes-${s.id}.description`);
      }
    }
  });

  it('se gagnent sur la ligne tapée : ls -a, un tube, une redirection', () => {
    const s = new Shell(eveil, 'fr');
    const ctx = { sh: s, termines: [], carnet: {}, records: {} };
    s.executer('ls');
    expect(nouveauxSucces(ctx, {})).toEqual([]);
    s.executer('ls -a');
    expect(nouveauxSucces(ctx, {})).toEqual(['cache-ls']);
    s.executer('ls | grep txt');
    expect(nouveauxSucces(ctx, {})).toEqual(['tube']);
    s.executer('ls > liste');
    expect(nouveauxSucces(ctx, {})).toEqual(['redirection']);
    // Déjà obtenu : pas une deuxième fois.
    expect(nouveauxSucces(ctx, { redirection: '2027-01-01' })).toEqual([]);
  });

  it('se gagnent sur la progression : chapitres, histoires, examen', () => {
    const ctx = { sh: null, termines: ['eveil', 'bourg', 'racine', 'sauvegarde'], carnet: { man: { ligne: 'man ls', chapitre: 'eveil' } }, records: { eveil: 4 * 60_000 } };
    expect(nouveauxSucces(ctx, {})).toEqual(['premiere-commande', 'manuel', 'premier-chapitre', 'effaceur', 'restauration', 'examen', 'examen-eclair']);
  });

  it('les clins d’œil répondent, et donnent leur succès caché', () => {
    const s = new Shell(eveil, 'fr');
    expect(s.executer('xyzzy')).toBe('Nothing happens.');
    expect(s.executer('make me a sandwich')).toBe('What? Make it yourself.');
    expect(s.executer('sudo   make me a sandwich')).toBe('Okay.');
    expect(s.executer('sl')).toContain('_D _|');
    expect(nouveauxSucces({ sh: s, termines: [], carnet: {}, records: {} }, {})).toEqual(['xyzzy', 'sandwich', 'sl']);
    expect(SUCCES.filter((x) => x.cache).map((x) => x.id)).toEqual(['xyzzy', 'sandwich', 'sl']);
  });

  it('le grade suit les chapitres terminés', () => {
    expect(grade([])).toBe('stagiaire');
    expect(grade(['eveil'])).toBe('apprenti');
    expect(grade(TOUS.slice(0, 4))).toBe('junior');
    expect(grade(TOUS.slice(0, 15))).toBe('admin');
    expect(grade(TOUS)).toBe('sre');
  });

  it('voyagent avec le fichier de sauvegarde, sans succès inconnu', () => {
    const lu = lireFichier(fichierDeSauvegarde({ succes: { tube: '2027-01-15T10:00:00.000Z', invente: 'x' } as Record<string, string> }, new Date()));
    expect('sauvegarde' in lu && lu.sauvegarde.succes).toEqual({ tube: '2027-01-15T10:00:00.000Z' });
  });
});
