// The game's texts, in Fluent format (https://projectfluent.org): one
// directory per language (src/texts/en/, src/texts/fr/…), several .ftl
// files per directory (interface, manual, commands, one story per file).
// English is the reference language (texts are written in English first,
// every key exists in English) and the default and fallback language:
// without a requested language, or in a language the game doesn't know, the
// game speaks English, and a text missing from a translation shows in
// English. The code only uses identifiers:
//
//   t('eveil-message')                       a message
//   t('histoire-effaceur.resume')            an attribute
//   t('ls-acces-impossible', { cible })      with named variables
//
// Plurals, numbers and dates go through Fluent, which relies on Intl. A
// number passed as a variable is formatted for the language ("1,234"):
// pass as text (String(pid)) what must stay as is.

import { FluentBundle, FluentResource, type FluentVariable } from '@fluent/bundle';

const SOURCES = import.meta.glob('./*/*.ftl', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;

export const REFERENCE_LANGUAGE = 'en';
export const LANGUAGE_BY_DEFAULT = 'en';
export const LANGUAGES = [...new Set(Object.keys(SOURCES).map((f) => f.split('/')[1]))].sort();
export type Language = string;
export type Variables = Record<string, FluentVariable>;
export type Translate = ((id: string, variables?: Variables) => string) & {
  language: Language;
  /** Vrai si le texte existe (dans la langue ou dans une langue de repli). */
  exists: (id: string) => boolean;
};

const packages = new Map<Language, FluentBundle>();

function pkg(language: Language): FluentBundle {
  let b = packages.get(language);
  if (!b) {
    // useIsolating : pas de caractères d'isolement Unicode autour des
    // variables (ils s'afficheraient dans le terminal).
    b = new FluentBundle(language, { useIsolating: false });
    for (const [file, source] of Object.entries(SOURCES).sort())
      if (file.startsWith(`./${language}/`)) {
        const errors = b.addResource(new FluentResource(source));
        if (errors.length) throw new Error(`${file} : ${errors.join(' ; ')}`);
      }
    packages.set(language, b);
  }
  return b;
}

// Typographie propre à chaque langue, appliquée aux textes du jeu au moment
// de l'affichage. En français : espaces insécables avant : ; ! ? » et après «,
// pour qu'un signe ne se retrouve jamais seul en début de ligne.
const TYPOGRAPHY: Record<Language, (text: string) => string> = {
  fr: (text) => text.replace(/« /g, '«\u00a0').replace(/ ([:;!?»])/g, '\u00a0$1'),
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
  const order = [...new Set([chosen, LANGUAGE_BY_DEFAULT, REFERENCE_LANGUAGE])].map(pkg);
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
    if (!found) throw new Error(`Texte manquant : « ${id} »`);
    const errors: Error[] = [];
    const text = found.b.formatPattern(found.pattern, variables, errors);
    if (errors.length) throw new Error(`Texte « ${id} » : ${errors.join(' ; ')}`);
    return text;
  };
  return Object.assign(t, { language: chosen, exists: (id: string) => find(id) !== null });
}
