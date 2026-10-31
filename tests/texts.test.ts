// Les textes sont séparés du code (src/texts/<langue>/*.ftl, format Fluent) :
// fichiers valides, identifiants uniques, traductions alignées sur
// l'anglais (la langue de référence), et aucun texte en dur dans le moteur ni dans l'interface.

import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { parse, Message, Junk } from '@fluent/syntax';
import { LANGUES, LANGUE_DE_REFERENCE, traducteur } from '../src/texts';

const TEXTES = 'src/texts';
const fichiers = (langue: string) => readdirSync(join(TEXTES, langue)).filter((f) => f.endsWith('.ftl'));
const identifiants = (langue: string) =>
  fichiers(langue).flatMap((f) =>
    parse(readFileSync(join(TEXTES, langue, f), 'utf8'), {}).body.flatMap((e) => (e instanceof Message ? [e.id.name] : [])),
  );

describe('Fichiers de textes', () => {
  for (const langue of LANGUES)
    it(`${langue} : Fluent valide, identifiants uniques`, () => {
      for (const f of fichiers(langue)) {
        const junk = parse(readFileSync(join(TEXTES, langue, f), 'utf8'), {}).body.filter((e) => e instanceof Junk);
        expect(junk.map((j) => `${f} : ${(j as Junk).content.slice(0, 80)}`)).toEqual([]);
      }
      const ids = identifiants(langue);
      expect(ids.filter((id, i) => ids.indexOf(id) !== i)).toEqual([]);
    });

  // English is the reference: every text exists in English first.
  for (const langue of LANGUES.filter((l) => l !== LANGUE_DE_REFERENCE))
    it(`${langue}: no text unknown in ${LANGUE_DE_REFERENCE}, none missing`, () => {
      const reference = new Set(identifiants(LANGUE_DE_REFERENCE));
      const traduits = new Set(identifiants(langue));
      expect([...traduits].filter((id) => !reference.has(id))).toEqual([]);
      expect([...reference].filter((id) => !traduits.has(id))).toEqual([]);
    });

  it('un texte absent est une erreur, pas un trou silencieux', () => {
    expect(() => traducteur()('ce-texte-n-existe-pas')).toThrow('Texte manquant');
  });
});

describe('Aucun texte en dur', () => {
  // Des lettres accentuées, des guillemets français ou une apostrophe
  // typographique hors des commentaires : du français resté dans le code.
  const FRANCAIS = /[À-ÿœŒ«»’]/;
  const sansCommentaires = (code: string) => code.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`\\])\/\/.*$/gm, '$1');
  const sources = (dossier: string): string[] =>
    readdirSync(dossier, { withFileTypes: true }).flatMap((e) =>
      e.isDirectory() ? sources(join(dossier, e.name)) : e.name.endsWith('.ts') ? [join(dossier, e.name)] : [],
    );
  for (const f of [...sources('src/engine'), ...sources('src/interface'), 'src/element.ts'])
    it(f, () => {
      const lignes = sansCommentaires(readFileSync(f, 'utf8'))
        .split('\n')
        .map((l, i) => `${i + 1}: ${l.trim()}`)
        .filter((l) => FRANCAIS.test(l));
      expect(lignes).toEqual([]);
    });
});
