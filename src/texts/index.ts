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
import { GROUPS, LANGUAGES as KNOWN, TRANSLATED } from 'virtual:qds-texts';
import { NeedsLoading } from '../engine/loading';
import INFO from './languages.json';

export const REFERENCE_LANGUAGE = 'en';
export const LANGUAGE_BY_DEFAULT = 'en';
export const LANGUAGES: string[] = [...KNOWN];

// A language is complete (every file, every story) or a draft (languages.json):
// a translation in progress, file by file. A draft's missing text shows in
// English; a story it doesn't translate yet is played with the English world
// (see translator()). The site builds a draft's pages but neither indexes nor
// offers them (src/site-languages.ts).
const LANGUAGE_INFO: Record<string, { name: string; status: 'complete' | 'draft' }> = INFO.languages as never;
/** Is this language complete? (A language languages.json doesn't list is a draft.) */
export const isComplete = (language: Language) => LANGUAGE_INFO[language]?.status === 'complete';
/** The complete languages: those the site offers, those every quest is replayed in. */
export const COMPLETE_LANGUAGES: string[] = LANGUAGES.filter(isComplete);
/** A language's own name (Español). */
export const languageName = (language: Language) => LANGUAGE_INFO[language]?.name ?? language;
/** Does this language translate this story (a complete one: all of them; a draft: those whose every file it has)? */
export const storyTranslated = (language: Language, story: string) => isComplete(language) || (TRANSLATED[language] ?? []).includes(story);
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
// its language's core group (the title alone), in its summaries group and in
// its story's (the whole message, with .summary): those replace the core's,
// which never replaces theirs, whatever order the groups arrive in.
function add(key: string, files: [string, string][]) {
  const b = pkg(key.split('/')[0]);
  const core = key.endsWith('/core');
  for (const [file, source] of files) {
    const errors = b.addResource(new FluentResource(source), { allowOverrides: !core }).filter((e) => !(core && /override/.test(String(e))));
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
 * Loads a group of texts (core, summaries, manual, story-<id>) in this
 * language. The core group also loads every language's shared texts; the
 * groups are whole in every language, file by file (tests/texts.test.ts), so
 * a translation's core doesn't wait for English's: `fallbacks` loads it
 * afterwards (the interface asks once the terminal is ready), for the
 * explainer's English markers and a text a translation would lack. Load a
 * language's core before anything else.
 */
export function loadTexts(language: Language | undefined, group: string): Promise<void> {
  const chosen = gameLanguage(language);
  const keys =
    group === 'core'
      ? // …and every language's shared texts: a save from another language is translated (console.ts).
        [`${chosen}/core`, ...LANGUAGES.map((l) => `${l}/shared`)]
      : group === 'fallbacks'
        ? fallbacks(chosen).map((l) => `${l}/core`)
        : [`${chosen}/${group}`];
  return Promise.all(withEnglish(chosen, keys).map(loadGroup)).then(() => undefined);
}

// A draft lacks texts English has: each of its groups comes with English's.
const withEnglish = (language: Language, keys: string[]) =>
  isComplete(language) ? keys : [...new Set([...keys, ...keys.map((k) => `${REFERENCE_LANGUAGE}/${k.split('/')[1]}`)])];

/** Is this group loaded in this language? */
export const textsLoaded = (language: Language | undefined, group: string) => {
  const chosen = gameLanguage(language);
  const keys = withEnglish(chosen, group === 'fallbacks' ? fallbacks(chosen).map((l) => `${l}/core`) : [`${chosen}/${group}`]);
  return keys.every((key) => loaded.has(key) || !GROUPS[key]);
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

// The texts that make a story's world: the names of its places and objects,
// its machines and its passwords (not the player's account, which the
// workstation shares with every story).
const WORLD = /^(name|machine|password)-/;

/**
 * The texts of a language. With a story (a machine's chapter, see Shell): in
 * a draft language that doesn't translate that story yet, its world keeps its
 * English names (the story's texts, in English, name them so), while the
 * commands answer in the language.
 */
export function translator(language?: Language, story?: string): Translate {
  const chosen = gameLanguage(language);
  const order = fallbacks(chosen).map(pkg);
  const english = story && !storyTranslated(chosen, story) ? [pkg(REFERENCE_LANGUAGE)] : null;
  const find = (id: string) => {
    const [name, attribute] = id.split('.');
    for (const b of english && WORLD.test(name) && name !== 'name-you' ? english : order) {
      const m = b.getMessage(name);
      const pattern = attribute ? m?.attributes[attribute] : m?.value;
      if (pattern) return { b, pattern };
    }
    return null;
  };
  const t = (id: string, variables?: Variables) => {
    const found = find(id);
    if (!found) {
      // A text of a group not loaded yet: a chapter's summary in the
      // summaries, otherwise the manual's pages first, otherwise the rest.
      const missing = Object.keys(GROUPS).filter((k) => fallbacks(chosen).includes(k.split('/')[0]) && !loaded.has(k));
      if (missing.length) {
        const first = (g: string) => missing.filter((k) => k.endsWith(`/${g}`));
        const likely = [id.endsWith('.summary') ? first('summaries') : [], first('manual')].find((l) => l.length);
        throw new NeedsLoading(`text ${id}`, () => Promise.all((likely ?? missing).map(loadGroup)));
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
