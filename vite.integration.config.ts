import { defineConfig } from 'vite';

// The game to embed in other sites: a single JavaScript file, without
// dependencies, that defines the <quetes-de-sysadmin> element. Published
// with the site in dist/integration/.
export default defineConfig({
  publicDir: false,
  build: {
    outDir: 'dist/integration',
    emptyOutDir: true,
    lib: {
      entry: 'src/element.ts',
      formats: ['es'],
      fileName: () => 'quetes-de-sysadmin.js',
    },
  },
});
