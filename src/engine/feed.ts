// The Atom feed of new stories (RFC 4287), one per language, written at
// build time by src/pages/<language>/feed.xml.ts: one entry per story,
// dated by RELEASES (releases.ts), newest first. A feed reader polls the
// static file; the site sends nothing and knows nothing of its readers.
// Reference: https://www.rfc-editor.org/rfc/rfc4287

export interface FeedEntry {
  /** A stable identifier (a tag: URI, RFC 4151): a reader shows an entry once. */
  id: string;
  title: string;
  summary: string;
  link: string;
  /** YYYY-MM-DD: published and updated at midnight UTC that day. */
  date: string;
}

export interface Feed {
  lang: string;
  id: string;
  title: string;
  subtitle: string;
  /** The feed's own address, and the page it belongs to. */
  self: string;
  home: string;
  author: string;
  rights: string;
  entries: FeedEntry[];
}

/** Text for XML: the five characters that must be escaped, and no control characters. */
export const xmlText = (s: string) =>
  s
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');

const stamp = (date: string) => `${date}T00:00:00Z`;

/** The feed as XML. Its `updated` is the newest entry's date: the file only changes when a story comes out. */
export function atomFeed(f: Feed): string {
  const entries = [...f.entries].sort((a, b) => b.date.localeCompare(a.date));
  const updated = entries[0]?.date ?? '1970-01-01';
  const lines = [
    '<?xml version="1.0" encoding="utf-8"?>',
    `<feed xmlns="http://www.w3.org/2005/Atom" xml:lang="${xmlText(f.lang)}">`,
    `  <id>${xmlText(f.id)}</id>`,
    `  <title>${xmlText(f.title)}</title>`,
    `  <subtitle>${xmlText(f.subtitle)}</subtitle>`,
    `  <link rel="self" type="application/atom+xml" href="${xmlText(f.self)}"/>`,
    `  <link rel="alternate" type="text/html" href="${xmlText(f.home)}"/>`,
    `  <updated>${stamp(updated)}</updated>`,
    `  <author><name>${xmlText(f.author)}</name></author>`,
    `  <rights>${xmlText(f.rights)}</rights>`,
    `  <icon>${xmlText(new URL('/favicon.svg', f.home).href)}</icon>`,
    ...entries.flatMap((e) => [
      '  <entry>',
      `    <id>${xmlText(e.id)}</id>`,
      `    <title>${xmlText(e.title)}</title>`,
      `    <link rel="alternate" type="text/html" href="${xmlText(e.link)}"/>`,
      `    <published>${stamp(e.date)}</published>`,
      `    <updated>${stamp(e.date)}</updated>`,
      `    <summary>${xmlText(e.summary)}</summary>`,
      '  </entry>',
    ]),
    '</feed>',
    '',
  ];
  return lines.join('\n');
}
