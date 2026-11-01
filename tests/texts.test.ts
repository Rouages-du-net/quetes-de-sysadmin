// Texts are separate from the code (src/texts/<language>/*.ftl, Fluent
// format): valid files, unique identifiers, translations aligned with
// English (the reference language), and no hard-coded text in the engine or the interface.

import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { parse, Message, Junk } from '@fluent/syntax';
import { LANGUAGES, REFERENCE_LANGUAGE, translator } from '../src/texts';

const TEXTS = 'src/texts';
const files = (language: string) => readdirSync(join(TEXTS, language)).filter((f) => f.endsWith('.ftl'));
const keys = (language: string) =>
  files(language).flatMap((f) =>
    parse(readFileSync(join(TEXTS, language, f), 'utf8'), {}).body.flatMap((e) => (e instanceof Message ? [e.id.name] : [])),
  );

describe('Text files', () => {
  for (const language of LANGUAGES)
    it(`${language}: valid Fluent, unique identifiers`, () => {
      for (const f of files(language)) {
        const junk = parse(readFileSync(join(TEXTS, language, f), 'utf8'), {}).body.filter((e) => e instanceof Junk);
        expect(junk.map((j) => `${f} : ${(j as Junk).content.slice(0, 80)}`)).toEqual([]);
      }
      const ids = keys(language);
      expect(ids.filter((id, i) => ids.indexOf(id) !== i)).toEqual([]);
    });

  // English is the reference: every text exists in English first.
  for (const language of LANGUAGES.filter((l) => l !== REFERENCE_LANGUAGE))
    it(`${language}: no text unknown in ${REFERENCE_LANGUAGE}, none missing`, () => {
      const reference = new Set(keys(REFERENCE_LANGUAGE));
      const translated = new Set(keys(language));
      expect([...translated].filter((id) => !reference.has(id))).toEqual([]);
      expect([...reference].filter((id) => !translated.has(id))).toEqual([]);
    });

  it('a missing text is an error, not a silent gap', () => {
    expect(() => translator()('ce-texte-n-existe-pas')).toThrow('Texte manquant');
  });
});

describe('No hard-coded text', () => {
  // Accented letters, French quotation marks or a typographic apostrophe
  // outside comments: French left in the code.
  const FRENCH = /[À-ÿœŒ«»’]/;
  const withoutComments = (code: string) => code.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`\\])\/\/.*$/gm, '$1');
  const sources = (directory: string): string[] =>
    readdirSync(directory, { withFileTypes: true }).flatMap((e) =>
      e.isDirectory() ? sources(join(directory, e.name)) : e.name.endsWith('.ts') ? [join(directory, e.name)] : [],
    );
  for (const f of [...sources('src/engine'), ...sources('src/interface'), 'src/element.ts'])
    it(f, () => {
      const lines = withoutComments(readFileSync(f, 'utf8'))
        .split('\n')
        .map((l, i) => `${i + 1}: ${l.trim()}`)
        .filter((l) => FRENCH.test(l));
      expect(lines).toEqual([]);
    });
});
