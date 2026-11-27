// The site's languages: every language of the game has its pages (/en/,
// /fr/, /es/, /de/…), each page's address in each language, and what the site
// offers. A complete language (src/texts/languages.json) is offered
// everywhere: the root sends browsers to it (public/.htaccess), the other
// pages link to it (the header's language links, hreflang). A draft (a
// translation waiting for a native speaker's review) is in the header's
// language links with a "beta" label, and its pages carry a banner; it stays
// out of search engines (noindex, no hreflang) and the root never sends a
// browser to it (tests/languages.test.ts).

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

/** The other languages a page links to (the header's links): the complete ones it exists in, then the drafts, marked beta. */
export const offered = (lang: Language, alternates: Alternates = {}) =>
  SITE_LANGUAGES.filter((l) => l !== lang && alternates[l]).map((l) => ({ lang: l, href: alternates[l], name: languageName(l), beta: !isComplete(l) }));
