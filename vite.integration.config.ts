import { defineConfig } from 'vite';
import { qdsTexts } from './src/texts/plugin.mjs';

// The game to embed in other sites: quetes-de-sysadmin.js, without
// dependencies, defines the <quetes-de-sysadmin> element; the rest of the
// game (interface and engine, each story, each group of texts) is in
// chunks/, files with a hash in their name that the element imports
// relative to its own address (so from the game's site, whatever page embeds
// it). Published with the site in dist/integration/.
export default defineConfig({
  publicDir: false,
  plugins: [qdsTexts()],
  build: {
    outDir: 'dist/integration',
    emptyOutDir: true,
    lib: {
      entry: 'src/element.ts',
      formats: ['es'],
      fileName: () => 'quetes-de-sysadmin.js',
    },
    rollupOptions: { output: { chunkFileNames: 'chunks/[name]-[hash].js' } },
  },
});
