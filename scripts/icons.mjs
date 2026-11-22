// Draws the installed game's icons (public/icons/*.png) from the favicon's
// design (public/favicon.svg: an amber "$_" on the console's dark green),
// with the site's font, in Chromium. Not part of the build: run it again
// only when the design changes, and commit the PNG files.
//   node scripts/icons.mjs
// CHROMIUM variable: path to the browser (by default /opt/pw-browsers/chromium,
// otherwise Playwright's).

import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { chromium } from 'playwright';

const CHROMIUM = process.env.CHROMIUM ?? '/opt/pw-browsers/chromium';
const bold = readFileSync('node_modules/@fontsource/jetbrains-mono/files/jetbrains-mono-latin-700-normal.woff2').toString('base64');
const BACKGROUND = '#111611';
const AMBER = '#f4b860';

// size: the PNG's side; corner: rounded corners (none for the maskable and
// Apple icons, which the system masks itself); text: the glyphs' size, a
// share of the side (smaller for the maskable icon, whose safe zone is the
// central circle of 80 %).
const ICONS = [
  { file: 'icon-192.png', size: 192, corner: 0.1875, text: 0.5 },
  { file: 'icon-512.png', size: 512, corner: 0.1875, text: 0.5 },
  { file: 'icon-maskable-512.png', size: 512, corner: 0, text: 0.36 },
  { file: 'apple-touch-icon.png', size: 180, corner: 0, text: 0.46 },
];

const browser = await chromium.launch({ executablePath: existsSync(CHROMIUM) ? CHROMIUM : undefined, args: ['--headless=new'] });
mkdirSync('public/icons', { recursive: true });
for (const { file, size, corner, text } of ICONS) {
  const page = await browser.newPage({ viewport: { width: size, height: size } });
  await page.setContent(`<!doctype html><html><head><style>
    @font-face { font-family: 'JetBrains Mono'; font-weight: 700; src: url(data:font/woff2;base64,${bold}) format('woff2'); }
    html, body { margin: 0; background: transparent; }
    div { width: ${size}px; height: ${size}px; border-radius: ${corner * size}px; background: ${BACKGROUND};
      display: flex; align-items: center; justify-content: center;
      font: 700 ${text * size}px/1 'JetBrains Mono', monospace; color: ${AMBER}; letter-spacing: -0.02em; }
  </style></head><body><div>$_</div></body></html>`);
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: `public/icons/${file}`, omitBackground: corner > 0 });
  await page.close();
  console.log(`public/icons/${file}`);
}
await browser.close();
