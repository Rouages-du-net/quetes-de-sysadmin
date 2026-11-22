// The web app manifest of each language (/en/manifest.webmanifest,
// /fr/manifest.webmanifest): what a browser needs to install the game.
// The texts come from the language's page (src/pages/<language>/), as the
// rest of the site's texts; the colours are those of src/styles/site.css.
// Reference: https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Manifest

export const THEME_COLOUR = '#0e1319';

export interface ManifestTexts {
  lang: string;
  name: string;
  shortName: string;
  description: string;
}

export function manifest({ lang, name, shortName, description }: ManifestTexts) {
  const home = `/${lang}/`;
  return {
    id: home,
    lang: lang,
    dir: 'ltr',
    name: name,
    short_name: shortName,
    description: description,
    start_url: home,
    scope: home,
    display: 'standalone',
    background_color: THEME_COLOUR,
    theme_color: THEME_COLOUR,
    categories: ['education', 'games'],
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}

// The endpoint's answer, with the manifest's media type.
export const manifestResponse = (texts: ManifestTexts) =>
  new Response(JSON.stringify(manifest(texts), null, 2), { headers: { 'Content-Type': 'application/manifest+json' } });
