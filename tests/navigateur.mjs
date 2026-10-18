// Vérification dans Chromium : la page autonome et le jeu intégré dans une
// autre page, à 1000 et 375 px de large, sans erreur console ni débordement,
// sans ressource tierce. À lancer après « npm run build » :
//   npx vite preview --port 4340 &   puis   npm run test:navigateur
// Variable CHROMIUM : chemin du navigateur (par défaut celui de l'environnement
// de développement, /opt/pw-browsers/chromium).

import { chromium } from 'playwright';

const BASE = process.env.BASE ?? 'http://localhost:4340';
const navigateur = await chromium.launch({
  executablePath: process.env.CHROMIUM ?? '/opt/pw-browsers/chromium',
  args: ['--headless=new'],
});
let echecs = 0;
const verifier = (cond, msg) => {
  console.log(`${cond ? '✓' : '✗'} ${msg}`);
  if (!cond) echecs++;
};

for (const largeur of [1000, 375]) {
  const page = await navigateur.newPage({ viewport: { width: largeur, height: 900 } });
  const erreurs = [];
  const externes = [];
  page.on('pageerror', (e) => erreurs.push(e.message));
  page.on('console', (m) => m.type() === 'error' && erreurs.push(m.text()));
  page.on('request', (r) => !r.url().startsWith(BASE) && !r.url().startsWith('data:') && externes.push(r.url()));
  await page.goto(`${BASE}/`);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  const jeu = page.locator('quetes-de-sysadmin');
  const saisie = jeu.locator('input');
  const tape = async (c) => {
    await saisie.fill(c);
    await saisie.press('Enter');
  };
  verifier((await jeu.locator('.sortie').textContent()).includes('L’Effaceur — chapitre 1'), `${largeur} px : le chapitre 1 s’ouvre`);
  await tape('man ls');
  verifier((await jeu.locator('.sortie').textContent()).includes('VOIR AUSSI'), `${largeur} px : man ls s’affiche`);
  for (const c of ['mv Jetee/filet Port/Hangar', 'cd Port/Remise']) await tape(c);
  await saisie.fill('mv .a');
  await saisie.press('Tab');
  verifier((await saisie.inputValue()) === 'mv .ampoule_de_secours ', `${largeur} px : Tab complète`);
  await saisie.fill('mv .ampoule_de_secours ~/Jetee/Phare/Escalier/Lanterne/ampoule');
  await saisie.press('Enter');
  verifier(await jeu.locator('.fin').isVisible(), `${largeur} px : fin du chapitre 1, bouton « Chapitre suivant »`);
  await jeu.locator('.fin button').click();
  verifier((await jeu.locator('.sortie').textContent()).includes('chapitre 2'), `${largeur} px : chapitre 2 ouvert`);
  await page.reload();
  verifier((await jeu.locator('.sortie').textContent()).includes('chapitre 2'), `${largeur} px : reprise après rechargement`);
  verifier(!(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)), `${largeur} px : pas de défilement horizontal`);
  verifier(erreurs.length === 0, `${largeur} px : aucune erreur console ${erreurs.join(' ')}`);
  verifier(externes.length === 0, `${largeur} px : aucune ressource tierce ${externes.join(' ')}`);
  if (process.env.CAPTURES) await page.screenshot({ path: `${process.env.CAPTURES}/jeu-${largeur}.png`, fullPage: true });
  await page.close();
}

// Intégration dans une page quelconque, avec le seul fichier d'intégration.
const page = await navigateur.newPage();
await page.route(`${BASE}/autre-site.html`, (r) => r.fulfill({ contentType: 'text/html', body: `<!doctype html><html lang="en"><body style="font-family:serif">
  <h1>Another site</h1>
  <quetes-de-sysadmin histoire="paquet" cle="test" theme="sombre"></quetes-de-sysadmin>
  <script type="module" src="${BASE}/integration/quetes-de-sysadmin.js"></script></body></html>` }));
await page.goto(`${BASE}/autre-site.html`);
await page.waitForFunction(() => document.querySelector('quetes-de-sysadmin')?.shadowRoot?.querySelector('.sortie pre'));
verifier((await page.locator('quetes-de-sysadmin .sortie').textContent()).includes('Le Paquet perdu'), 'intégration : l’histoire demandée s’ouvre');
verifier((await page.evaluate(() => getComputedStyle(document.querySelector('h1')).fontFamily)).includes('serif'), 'intégration : les styles de la page ne sont pas touchés');

await navigateur.close();
console.log(echecs ? `${echecs} échec(s)` : 'Tout est bon.');
process.exit(echecs ? 1 : 0);
