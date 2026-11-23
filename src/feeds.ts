// The Atom feeds of new stories (/en/feed.xml, /fr/feed.xml), written when
// the site is built (see src/engine/feed.ts and releases.ts), by
// src/pages/<language>/feed.xml.ts. Runs at build time only.
import { atomFeed } from './engine/feed';
import { RELEASES } from './engine/releases';
import { CATALOGUE as STORIES } from './engine/catalogue';
import { loadAllTexts, translator, typography, type Language } from './texts';

export const SITE = 'https://sysadmin.rouages.net';

export interface FeedTexts {
  lang: Language;
  title: string;
  subtitle: string;
  author: string;
  rights: string;
}

export async function feedResponse({ lang, title, subtitle, author, rights }: FeedTexts): Promise<Response> {
  await loadAllTexts();
  const t = translator(lang);
  const home = `${SITE}/${lang}/`;
  const xml = atomFeed({
    lang,
    id: `tag:sysadmin.rouages.net,2026:${lang}/stories`,
    title,
    subtitle,
    self: `${home}feed.xml`,
    home,
    author,
    rights,
    entries: STORIES.map((s) => ({
      id: `tag:sysadmin.rouages.net,2026:${lang}/story/${s.id}`,
      title: typography(t(`story-${s.id}`), lang),
      summary: typography(t(`story-${s.id}.summary`), lang),
      link: home,
      date: RELEASES[s.id],
    })),
  });
  return new Response(xml, { headers: { 'Content-Type': 'application/atom+xml; charset=utf-8' } });
}
