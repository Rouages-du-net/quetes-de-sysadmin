// The game's texts, in Fluent format (https://projectfluent.org): one
// directory per language (src/texts/en/, src/texts/fr/…), several .ftl
// files per directory (interface, manual, commands, one story per file).
// English is the reference language (texts are written in English first,
// every key exists in English) and the default and fallback language:
// without a requested language, or in a language the game doesn't know, the
// game speaks English, and a text missing from a translation shows in
// English. The code only uses identifiers:
//
//   t('lighthouse-message')                       a message
//   t('story-eraser.resume')             an attribute
//   t('ls-access-missing', { cible })         with named variables
//
// Plurals, numbers and dates go through Fluent, which relies on Intl. A
// number passed as a variable is formatted for the language ("1,234"):
// pass as text (String(pid)) what must stay as is.
//
// The texts load in groups (see plugin.mjs): a language's core texts first
// (interface, commands, chapter titles), its manual's pages and each story's
// texts when they are needed. loadTexts() fetches a group; translator() is
// synchronous and reads what has been loaded. Tests and the build load
// everything (loadAllTexts(), tests/setup.ts).

import { FluentBundle, FluentResource, type FluentVariable } from '@fluent/bundle';
import { GROUPS, LANGUAGES as KNOWN } from 'virtual:qds-texts';
import { NeedsLoading } from '../engine/loading';

export const REFERENCE_LANGUAGE = 'en';
export const LANGUAGE_BY_DEFAULT = 'en';
export const LANGUAGES: string[] = [...KNOWN];
export type Language = string;
export type Variables = Record<string, FluentVariable>;
export type Translate = ((id: string, variables?: Variables) => string) & {
  language: Language;
  /** Vrai si le texte existe (dans la langue ou dans une langue de repli). */
  exists: (id: string) => boolean;
};

const packages = new Map<Language, FluentBundle>();
// The groups loaded ("en/core", "fr/story-eraser"…), and those on their way.
const loaded = new Set<string>();
const loading = new Map<string, Promise<void>>();

function pkg(language: Language): FluentBundle {
  let b = packages.get(language);
  if (!b) {
    // useIsolating : pas de caractères d'isolement Unicode autour des
    // variables (ils s'afficheraient dans le terminal).
    b = new FluentBundle(language, { useIsolating: false });
    packages.set(language, b);
  }
  return b;
}

// A group's files, added to its language's bundle. A chapter's title is in
// its language's core group and again in its story's: the same text.
function add(key: string, files: [string, string][]) {
  const b = pkg(key.split('/')[0]);
  for (const [file, source] of files) {
    const errors = b.addResource(new FluentResource(source), { allowOverrides: true });
    if (errors.length) throw new Error(`${key}, ${file} : ${errors.join(' ; ')}`);
  }
  loaded.add(key);
}

function loadGroup(key: string): Promise<void> {
  if (loaded.has(key) || !GROUPS[key]) return Promise.resolve();
  let p = loading.get(key);
  if (!p) {
    p = GROUPS[key]().then((files) => add(key, files));
    // A failed download (offline) can be tried again.
    p.catch(() => loading.delete(key));
    loading.set(key, p);
  }
  return p;
}

/** The languages a translator reads, in order (English after every other one). */
const fallbacks = (language: Language) => [...new Set([language, LANGUAGE_BY_DEFAULT, REFERENCE_LANGUAGE])];

/**
 * Loads a group of texts (core, manual, story-<id>) in this language. The
 * core group also loads English's (the fallback of a text a translation
 * lacks); the other groups are whole in every language, file by file
 * (tests/texts.test.ts). Load a language's core before anything else.
 */
export function loadTexts(language: Language | undefined, group: string): Promise<void> {
  const chosen = gameLanguage(language);
  const keys =
    group === 'core'
      ? // …and every language's shared texts: a save from another language is translated (console.ts).
        [...fallbacks(chosen).map((l) => `${l}/core`), ...LANGUAGES.map((l) => `${l}/shared`)]
      : [`${chosen}/${group}`];
  return Promise.all(keys.map(loadGroup)).then(() => undefined);
}

/** Is this group loaded in this language? */
export const textsLoaded = (language: Language | undefined, group: string) => {
  const key = `${gameLanguage(language)}/${group}`;
  return loaded.has(key) || !GROUPS[key];
};

/** Every text of every language (tests, the build's pages). */
export const loadAllTexts = () => Promise.all(Object.keys(GROUPS).map(loadGroup)).then(() => undefined);

// Typographie propre à chaque langue, appliquée aux textes du jeu au moment
// de l'affichage. En français : espaces insécables avant : ; ! ? » et après «,
// pour qu'un signe ne se retrouve jamais seul en début de ligne.
const TYPOGRAPHY: Record<Language, (text: string) => string> = {
  fr: (text) => text.replace(/« /g, '« ').replace(/ ([:;!?»])/g, ' $1'),
};
export const typography = (text: string, language: Language) => TYPOGRAPHY[language]?.(text) ?? text;

// La langue demandée (« fr », « en-GB »…) si le jeu la connaît, sinon l'anglais.
// Les codes BCP 47 ne tiennent pas compte de la casse (zh-hans = zh-Hans).
export function gameLanguage(language?: string | null): Language {
  const known = (l: string) => LANGUAGES.find((x) => x.toLowerCase() === l.toLowerCase());
  const l = language?.trim() ?? '';
  return (l && (known(l) ?? known(l.split('-')[0]))) || LANGUAGE_BY_DEFAULT;
}

export function translator(language?: Language): Translate {
  const chosen = gameLanguage(language);
  const order = fallbacks(chosen).map(pkg);
  const find = (id: string) => {
    const [name, attribute] = id.split('.');
    for (const b of order) {
      const m = b.getMessage(name);
      const pattern = attribute ? m?.attributes[attribute] : m?.value;
      if (pattern) return { b, pattern };
    }
    return null;
  };
  const t = (id: string, variables?: Variables) => {
    const found = find(id);
    if (!found) {
      // A text of a group not loaded yet: the manual's pages first, otherwise the rest.
      const missing = Object.keys(GROUPS).filter((k) => fallbacks(chosen).includes(k.split('/')[0]) && !loaded.has(k));
      if (missing.length) {
        const manual = missing.filter((k) => k.endsWith('/manual'));
        throw new NeedsLoading(`text ${id}`, () => Promise.all((manual.length ? manual : missing).map(loadGroup)));
      }
      throw new Error(`Texte manquant : « ${id} »`);
    }
    const errors: Error[] = [];
    const text = found.b.formatPattern(found.pattern, variables, errors);
    if (errors.length) throw new Error(`Texte « ${id} » : ${errors.join(' ; ')}`);
    return text;
  };
  return Object.assign(t, { language: chosen, exists: (id: string) => find(id) !== null });
}
