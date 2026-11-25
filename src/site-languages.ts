// The site's languages: every language of the game has its pages (/en/,
// /fr/, /es/, /de/…), each page's address in each language, and what the site
// offers. A complete language (src/texts/languages.json) is offered: the
// root sends browsers to it (public/.htaccess), the other pages link to it
// (the header's language links, hreflang). A draft is built and reachable at
// its address, but marked as a translation in progress (a banner), kept out
// of search engines (noindex) and offered nowhere, so that nobody lands by
// chance on a game half in English (tests/languages.test.ts).

import { COMPLETE_LANGUAGES, LANGUAGES, isComplete, languageName, type Language } from './texts';

export { COMPLETE_LANGUAGES, isComplete, languageName };
/** Every language with pages, the complete ones first. */
export const SITE_LANGUAGES: Language[] = [...COMPLETE_LANGUAGES, ...LANGUAGES.filter((l) => !isComplete(l))];

/** A page in each language: language → its address. */
export type Alternates = Record<Language, string>;

// The address of each page, by language: English first, the others with
// their own words (enseignants, docentes, lehrkraefte), the stories' identifiers as they are.
export const PAGES = {
  home: { en: '/en/', fr: '/fr/', es: '/es/', de: '/de/' },
  teachers: { en: '/en/teachers/', fr: '/fr/enseignants/', es: '/es/docentes/', de: '/de/lehrkraefte/' },
  classTable: { en: '/en/teachers/class/', fr: '/fr/enseignants/classe/', es: '/es/docentes/clase/', de: '/de/lehrkraefte/klasse/' },
  sheet: (story: string): Alternates => ({
    en: `/en/teachers/sheets/${story}/`,
    fr: `/fr/enseignants/fiches/${story}/`,
    es: `/es/docentes/fichas/${story}/`,
    de: `/de/lehrkraefte/boegen/${story}/`,
  }),
} satisfies Record<string, Alternates | ((story: string) => Alternates)>;

/** The other languages a page links to: the complete ones it exists in. */
export const offered = (lang: Language, alternates: Alternates = {}) =>
  COMPLETE_LANGUAGES.filter((l) => l !== lang && alternates[l]).map((l) => ({ lang: l, href: alternates[l], name: languageName(l) }));
