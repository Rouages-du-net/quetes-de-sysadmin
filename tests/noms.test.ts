// Les noms des lieux et des objets, dans chaque langue : faciles à taper
// (lettres sans accent, chiffres, point, tiret, soulignés), sans deux noms
// pareils dans un même dossier, et la complétion par Tab les trouve.
import { describe, expect, it } from 'vitest';
import { Shell } from '../src/moteur/shell';
import { HISTOIRES } from '../src/moteur/chapitres';
import { poste } from '../src/moteur/poste';
import { nom, type Dossier } from '../src/moteur/monde';
import { LANGUES, traducteur } from '../src/textes';

const traduits = [...HISTOIRES.flatMap((h) => h.chapitres), poste([])].filter((c) => c.noms);

// Tous les noms d'un monde, avec leur chemin.
const parcourir = (dossier: Dossier, ici = ''): string[] =>
  Object.entries(dossier.enfants).flatMap(([n, e]) => [`${ici}/${n}`, ...(e.type === 'dossier' ? parcourir(e, `${ici}/${n}`) : [])]);

for (const langue of LANGUES)
  describe(`Noms en ${langue}`, () => {
    const t = traducteur(langue);

    it('chaque histoire qui traduit ses noms garde tous ses lieux et objets, sous des noms faciles à taper', () => {
      expect(traduits.length).toBeGreaterThanOrEqual(5);
      for (const c of traduits) {
        const s = new Shell(c, langue);
        const chemins = parcourir(s.racine);
        // Deux noms français devenus pareils écraseraient un lieu.
        expect(chemins.length, c.id).toBe(parcourir(c.creerMonde(t)).length);
        for (const ch of chemins) expect(ch.split('/').at(-1), `${c.id} : ${ch}`).toMatch(/^[A-Za-z0-9._-]+$/);
        expect(s.trouver(s.maison)?.type, c.id).toBe('dossier');
        expect(s.existe(`${s.maison}/${s.accueil}`), c.id).toBe(true);
      }
    });

    it('Tab complète les noms traduits', () => {
      const s = new Shell(HISTOIRES[0].chapitres[0], langue);
      const colline = nom(t, 'Colline');
      expect(s.completer(`cd ${colline.slice(0, 2)}`)).toBe(`cd ${colline}/`);
      const ecole = nom(t, 'EcoleDesSignaux');
      expect(s.completer(`cd ${colline}/${ecole.slice(0, 3)}`)).toBe(`cd ${colline}/${ecole}/`);
      expect(s.completer(`cat ${nom(t, 'message.txt').slice(0, 3)}`)).toBe(`cat ${nom(t, 'message.txt')} `);
    });
  });
