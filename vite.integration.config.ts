import { defineConfig } from 'vite';

// Le jeu à intégrer dans d'autres sites : un seul fichier JavaScript, sans
// dépendance, qui définit l'élément <quetes-de-sysadmin>. Publié avec le site
// dans dist/integration/.
export default defineConfig({
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
