// Vérification dans Chromium : la page autonome et le jeu intégré dans une
// autre page, à 1000 et 375 px de large, sans erreur console ni débordement,
// sans ressource tierce, avec la politique de sécurité (CSP) de public/.htaccess.
// À lancer après « npm run build » :
//   npm run preview &   puis   npm run test:navigateur
// Variable CHROMIUM : chemin du navigateur (par défaut celui de l'environnement
// de développement, /opt/pw-browsers/chromium, sinon celui de Playwright).

import { existsSync, readFileSync } from 'node:fs';
import { chromium } from 'playwright';

const BASE = process.env.BASE ?? 'http://localhost:4340';
const CHROMIUM = process.env.CHROMIUM ?? '/opt/pw-browsers/chromium';
const navigateur = await chromium.launch({
  executablePath: existsSync(CHROMIUM) ? CHROMIUM : undefined,
  args: ['--headless=new'],
});

// Le serveur de prévisualisation ne lit pas .htaccess : on ajoute nous-mêmes
// l'en-tête CSP qu'Apache enverra, pour qu'une violation fasse échouer le test.
const CSP = readFileSync('public/.htaccess', 'utf8').match(/Content-Security-Policy "([^"]+)"/)[1];
const avecCsp = (page) =>
  page.route(`${BASE}/**`, async (route) => {
    const reponse = await route.fetch();
    await route.fulfill({ response: reponse, headers: { ...reponse.headers(), 'content-security-policy': CSP } });
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
  await avecCsp(page);
  await page.goto(`${BASE}/`);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  const jeu = page.locator('quetes-de-sysadmin');
  const saisie = jeu.locator('form input');
  const tape = async (c) => {
    await saisie.fill(c);
    await saisie.press('Enter');
  };
  verifier((await jeu.locator('.sortie').textContent()).includes('Bienvenue sur ton poste'), `${largeur} px : on part du poste`);
  verifier(await jeu.locator('button[data-histoire="1"]').isDisabled(), `${largeur} px : sans sa clé, le Datacenter est verrouillé`);
  await saisie.fill('ssh roy');
  await saisie.press('Tab');
  verifier((await saisie.inputValue()) === 'ssh royaume ', `${largeur} px : Tab complète le nom de la machine`);
  await saisie.press('Enter');
  verifier((await jeu.locator('.invite').textContent()).startsWith('Are you sure'), `${largeur} px : ssh demande de confirmer l’empreinte`);
  await tape('yes');
  verifier((await jeu.locator('.invite').textContent()) === 'vous@royaume:~$', `${largeur} px : connecté·e à royaume`);
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
  await tape('exit');
  verifier((await jeu.locator('.sortie').textContent()).includes('Connection to royaume.example closed.'), `${largeur} px : exit ramène au poste`);
  await tape('ssh royaume');
  verifier((await jeu.locator('.invite').textContent()) === 'vous@royaume:~$', `${largeur} px : hôte connu gardé, pas de nouvelle question`);
  // nano : clavier (Ctrl+O, Ctrl+X) en grand écran, boutons sur mobile.
  await tape('exit');
  await tape('nano notes.txt');
  const nano = jeu.locator('.nano');
  verifier(await nano.isVisible(), `${largeur} px : nano s’ouvre`);
  verifier(await jeu.locator('form').isHidden(), `${largeur} px : la ligne de commande laisse la place à nano`);
  await jeu.locator('.nano-texte').fill('Bonjour depuis nano\n');
  if (largeur > 500) await jeu.locator('.nano-texte').press('Control+o');
  else await jeu.locator('.nano-touche', { hasText: '^O' }).click();
  verifier((await jeu.locator('.nano-etat').textContent()) === '[ 1 ligne écrite ]', `${largeur} px : ^O écrit le fichier`);
  await jeu.locator('.nano-texte').fill('Bonjour depuis nano\nencore\n');
  if (largeur > 500) await jeu.locator('.nano-texte').press('Control+x');
  else await jeu.locator('.nano-touche', { hasText: '^X' }).click();
  verifier((await jeu.locator('.nano-etat').textContent()).includes('Sauver le tampon modifié'), `${largeur} px : ^X demande s’il faut enregistrer`);
  if (largeur > 500) await page.keyboard.press('o');
  else await jeu.locator('.nano-touche', { hasText: 'Oui' }).click();
  verifier(!(await nano.isVisible()) && (await saisie.isVisible()), `${largeur} px : nano se ferme`);
  await tape('cat notes.txt');
  verifier((await jeu.locator('.sortie').textContent()).includes('Bonjour depuis nano\nencore'), `${largeur} px : le fichier est bien écrit`);
  // Le carnet du sysadmin : les commandes lancées, avec leur ligne du manuel ; il survit au rechargement.
  const carnet = jeu.locator('details.carnet');
  await carnet.locator('summary').click();
  verifier((await carnet.locator('dt').allTextContents()).includes('nano'), `${largeur} px : nano est entré au carnet`);
  verifier((await carnet.locator('summary').textContent()).match(/\(\d+ commandes\)/), `${largeur} px : le carnet compte ses commandes`);
  const [telechargement] = await Promise.all([page.waitForEvent('download'), carnet.locator('.carnet-actions button').first().click()]);
  verifier(telechargement.suggestedFilename() === 'carnet-du-sysadmin.md', `${largeur} px : le carnet se télécharge en Markdown`);
  await page.reload();
  verifier((await jeu.locator('details.carnet dt').allTextContents()).includes('nano'), `${largeur} px : le carnet est gardé dans le navigateur`);
  // Le mode examen : la case recommence le chapitre en cours, le chrono démarre.
  await tape('ssh royaume');
  await jeu.locator('.examen input').check();
  verifier((await jeu.locator('.sortie').textContent()).includes('Mode examen'), `${largeur} px : le mode examen s’annonce`);
  await page.waitForTimeout(1100);
  verifier(/⏱ 00:0\d/.test(await jeu.locator('.chrono').textContent()), `${largeur} px : le chrono tourne`);
  await jeu.locator('.examen input').uncheck();
  verifier((await jeu.locator('.chrono').textContent()) === '', `${largeur} px : sans examen, plus de chrono`);
  verifier(!(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)), `${largeur} px : pas de défilement horizontal`);
  verifier(erreurs.length === 0, `${largeur} px : aucune erreur console ${erreurs.join(' ')}`);
  verifier(externes.length === 0, `${largeur} px : aucune ressource tierce ${externes.join(' ')}`);
  if (process.env.CAPTURES) await page.screenshot({ path: `${process.env.CAPTURES}/jeu-${largeur}.png`, fullPage: true });
  // Les fiches pour les enseignant·es : une page statique, générée à la construction.
  await page.goto(`${BASE}/enseignants/`);
  verifier((await page.locator('.fiche').count()) > 50, `${largeur} px : les fiches des enseignant·es sont là`);
  verifier((await page.locator('#c-goulot').textContent()).includes('iostat'), `${largeur} px : une fiche donne ses commandes nouvelles`);
  verifier(!(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)), `${largeur} px : fiches sans défilement horizontal`);
  verifier(erreurs.length === 0, `${largeur} px : fiches sans erreur console ${erreurs.join(' ')}`);
  if (process.env.CAPTURES) await page.screenshot({ path: `${process.env.CAPTURES}/enseignants-${largeur}.png` });
  await page.close();
}

// La page en anglais : le jeu en anglais, le lien vers la page française.
for (const largeur of [1000, 375]) {
  const page = await navigateur.newPage({ viewport: { width: largeur, height: 900 } });
  const erreurs = [];
  page.on('pageerror', (e) => erreurs.push(e.message));
  page.on('console', (m) => m.type() === 'error' && erreurs.push(m.text()));
  await avecCsp(page);
  await page.goto(`${BASE}/en/`);
  const jeu = page.locator('quetes-de-sysadmin');
  verifier((await page.locator('html').getAttribute('lang')) === 'en', `en ${largeur} px : la page est en anglais`);
  verifier((await jeu.locator('.sortie').textContent()).includes('Welcome to your workstation'), `en ${largeur} px : le jeu parle anglais`);
  const saisie = jeu.locator('form input');
  await saisie.fill('ls -y');
  await saisie.press('Enter');
  verifier((await jeu.locator('.sortie').textContent()).includes("Try 'ls --help' for more information."), `en ${largeur} px : les messages des commandes sont ceux de LANG=C`);
  verifier((await page.locator('.langue a').getAttribute('href')) === '/', `en ${largeur} px : lien vers la page française`);
  verifier(!(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)), `en ${largeur} px : pas de défilement horizontal`);
  verifier(erreurs.length === 0, `en ${largeur} px : aucune erreur console ${erreurs.join(' ')}`);
  if (process.env.CAPTURES) await page.screenshot({ path: `${process.env.CAPTURES}/en-${largeur}.png` });
  // The teachers' page in English.
  await page.locator('a[href="/en/teachers/"]').click();
  await page.waitForURL(/\/en\/teachers\//);
  verifier((await page.locator('h1').textContent()).includes('For teachers'), `en ${largeur} px : la page des enseignant·es en anglais`);
  verifier((await page.locator('#c-goulot dt').first().textContent()) === 'Goal', `en ${largeur} px : fiches en anglais`);
  verifier((await page.locator('.langue a').getAttribute('href')) === '/enseignants/', `en ${largeur} px : lien vers les fiches en français`);
  verifier(!(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)), `en ${largeur} px : fiches sans défilement horizontal`);
  verifier(erreurs.length === 0, `en ${largeur} px : fiches sans erreur console ${erreurs.join(' ')}`);
  await page.close();
}

// Page introuvable
{
  const page = await navigateur.newPage();
  await page.goto(`${BASE}/n-existe-pas/`);
  verifier((await page.locator('h1').textContent()).includes('404'), '404 : page « introuvable » servie');
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
await page.addStyleTag({ content: 'quetes-de-sysadmin { --qds-accent: rgb(1, 2, 3); }' });
verifier(
  (await page.evaluate(() => getComputedStyle(document.querySelector('quetes-de-sysadmin').shadowRoot.querySelector('a')).color)) === 'rgb(1, 2, 3)',
  'intégration : les couleurs se règlent depuis la page (--qds-accent)',
);

await navigateur.close();
console.log(echecs ? `${echecs} échec(s)` : 'Tout est bon.');
process.exit(echecs ? 1 : 0);
