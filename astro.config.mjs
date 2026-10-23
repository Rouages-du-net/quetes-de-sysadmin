import { defineConfig } from 'astro/config';

// Le site sysadmin.rouages.net : pages statiques servies par Apache (cPanel).
// Le jeu lui-même est l'élément <quetes-de-sysadmin> (src/element.ts), inséré
// dans les pages ; sa version à intégrer ailleurs est construite à part
// (vite.integration.config.ts).
export default defineConfig({
  site: 'https://sysadmin.rouages.net',
  output: 'static',
  // Comme sur rouages.net : la compression HTML d'Astro colle les mots aux
  // balises placées en début de ligne. Apache compresse en gzip (.htaccess).
  compressHTML: false,
  // Apache sert /page/index.html pour /page/
  build: { format: 'directory' },
  // Aucun fichier intégré en data: (Vite le fait sous 4 Ko, pour les petits
  // morceaux de la police) : la CSP n'autorise que les fichiers du site.
  vite: { build: { assetsInlineLimit: 0 } },
});
