import { defineConfig } from 'vite';

// Le site autonome (sysadmin.rouages.net) : index.html à la racine.
export default defineConfig({
  base: './',
  build: { outDir: 'dist', emptyOutDir: true },
});
