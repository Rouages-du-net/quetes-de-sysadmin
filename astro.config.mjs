import { defineConfig } from 'astro/config';
import { qdsTexts } from './src/texts/plugin.mjs';

// The sysadmin.rouages.net site: static pages served by Apache (cPanel).
// The game itself is the <quetes-de-sysadmin> element (src/element.ts), inserted
// in the pages; its version to embed elsewhere is built separately
// (vite.integration.config.ts).
export default defineConfig({
  site: 'https://sysadmin.rouages.net',
  output: 'static',
  // As on rouages.net: Astro's HTML compression glues words to tags placed
  // at the start of a line. Apache compresses with gzip (.htaccess).
  compressHTML: false,
  // Apache serves /page/index.html for /page/
  build: { format: 'directory' },
  // No file inlined as data: (Vite does it under 4 KB, for the font's small
  // pieces): the CSP only allows the site's files.
  // The texts come in groups (src/texts/plugin.mjs), each a chunk loaded when
  // needed, like each story (src/engine/story-registry.ts).
  vite: { plugins: [qdsTexts()], build: { assetsInlineLimit: 0 } },
});
