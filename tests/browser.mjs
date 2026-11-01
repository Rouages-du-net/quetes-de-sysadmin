// Vérification dans Chromium : la page autonome et le jeu intégré dans une
// autre page, à 1000 et 375 px de large, sans erreur console ni débordement,
// sans ressource tierce, avec la politique de sécurité (CSP) de public/.htaccess.
// À lancer après « npm run build » :
//   npm run preview &   puis   npm run test:browser
// Variable CHROMIUM : chemin du navigateur (par défaut celui de l'environnement
// de développement, /opt/pw-browsers/chromium, sinon celui de Playwright).

import { existsSync, readFileSync } from 'node:fs';
import { chromium } from 'playwright';

const BASE = process.env.BASE ?? 'http://localhost:4340';
const CHROMIUM = process.env.CHROMIUM ?? '/opt/pw-browsers/chromium';
const browser = await chromium.launch({
  executablePath: existsSync(CHROMIUM) ? CHROMIUM : undefined,
  args: ['--headless=new'],
});

// Le serveur de prévisualisation ne lit pas .htaccess : on ajoute nous-mêmes
// l'en-tête CSP qu'Apache enverra, pour qu'une violation fasse échouer le test.
const CSP = readFileSync('public/.htaccess', 'utf8').match(/Content-Security-Policy "([^"]+)"/)[1];
const withCsp = (page) =>
  page.route(`${BASE}/**`, async (route) => {
    const response = await route.fetch();
    await route.fulfill({ response: response, headers: { ...response.headers(), 'content-security-policy': CSP } });
  });
let failures = 0;
const check = (cond, msg) => {
  console.log(`${cond ? '✓' : '✗'} ${msg}`);
  if (!cond) failures++;
};

for (const width of [1000, 375]) {
  const page = await browser.newPage({ viewport: { width: width, height: 900 } });
  const errors = [];
  const externes = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  page.on('request', (r) => !r.url().startsWith(BASE) && !r.url().startsWith('data:') && externes.push(r.url()));
  await withCsp(page);
  await page.goto(`${BASE}/fr/`);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  const game = page.locator('quetes-de-sysadmin');
  const input = game.locator('form input');
  const tape = async (c) => {
    await input.fill(c);
    await input.press('Enter');
  };
  check((await game.locator('.output').textContent()).includes('Bienvenue sur ton poste'), `${width} px : on part du poste`);
  check(await game.locator('button[data-story="1"]').isDisabled(), `${width} px : sans sa clé, le Datacenter est verrouillé`);
  await input.fill('ssh roy');
  await input.press('Tab');
  check((await input.inputValue()) === 'ssh royaume ', `${width} px : Tab complète le nom de la machine`);
  await input.press('Enter');
  check((await game.locator('.prompt').textContent()).startsWith('Are you sure'), `${width} px : ssh demande de confirmer l’empreinte`);
  await tape('yes');
  check((await game.locator('.prompt').textContent()) === 'vous@royaume:~$', `${width} px : connecté·e à royaume`);
  check((await game.locator('.output').textContent()).includes('L’Effaceur — chapitre 1'), `${width} px : le chapitre 1 s’ouvre`);
  await tape('man ls');
  check((await game.locator('.output').textContent()).includes('VOIR AUSSI'), `${width} px : man ls s’affiche`);
  for (const c of ['mv Jetee/filet Port/Hangar', 'cd Port/Remise']) await tape(c);
  await input.fill('mv .a');
  await input.press('Tab');
  check((await input.inputValue()) === 'mv .ampoule_de_secours ', `${width} px : Tab complète`);
  await input.fill('mv .ampoule_de_secours ~/Jetee/Phare/Escalier/Lanterne/ampoule');
  await input.press('Enter');
  check(await game.locator('.end').isVisible(), `${width} px : fin du chapitre 1, bouton « Chapitre suivant »`);
  // Le bilan : une ligne dans le terminal, le détail dans une fenêtre.
  check(/Bilan : \d+:\d\d · \d+ commandes/.test(await game.locator('.output .summary').textContent()), `${width} px : le bilan du chapitre s’affiche`);
  await game.locator('.summary-button').click();
  const summaryWindow = game.locator('dialog.summary-window');
  check(
    (await summaryWindow.evaluate((d) => d.open)) && (await summaryWindow.locator('tbody code', { hasText: 'mv .ampoule_de_secours' }).count()) === 1,
    `${width} px : le détail du bilan montre la commande de l’étape`,
  );
  const summaryBox = await summaryWindow.boundingBox();
  check(summaryBox.x >= 0 && summaryBox.x + summaryBox.width <= width, `${width} px : la fenêtre du bilan tient dans l’écran`);
  await page.keyboard.press('Escape');
  await game.locator('.end button').click();
  check((await game.locator('.output').textContent()).includes('chapitre 2'), `${width} px : chapitre 2 ouvert`);
  await page.reload();
  check((await game.locator('.output').textContent()).includes('chapitre 2'), `${width} px : reprise après rechargement`);
  await tape('exit');
  check((await game.locator('.output').textContent()).includes('Connection to royaume.internal closed.'), `${width} px : exit ramène au poste`);
  await tape('ssh royaume');
  check((await game.locator('.prompt').textContent()) === 'vous@royaume:~$', `${width} px : hôte connu gardé, pas de nouvelle question`);
  // nano : clavier (Ctrl+O, Ctrl+X) en grand écran, boutons sur mobile.
  await tape('exit');
  await tape('nano notes.txt');
  const nano = game.locator('.nano');
  check(await nano.isVisible(), `${width} px : nano s’ouvre`);
  check(await game.locator('form').isHidden(), `${width} px : la ligne de commande laisse la place à nano`);
  await game.locator('.nano-text').fill('Bonjour depuis nano\n');
  if (width > 500) await game.locator('.nano-text').press('Control+o');
  else await game.locator('.nano-key', { hasText: '^O' }).click();
  check((await game.locator('.nano-status').textContent()) === '[ 1 ligne écrite ]', `${width} px : ^O écrit le fichier`);
  await game.locator('.nano-text').fill('Bonjour depuis nano\nencore\n');
  if (width > 500) await game.locator('.nano-text').press('Control+x');
  else await game.locator('.nano-key', { hasText: '^X' }).click();
  check((await game.locator('.nano-status').textContent()).includes('Sauver le tampon modifié'), `${width} px : ^X demande s’il faut enregistrer`);
  if (width > 500) await page.keyboard.press('o');
  else await game.locator('.nano-key', { hasText: 'Oui' }).click();
  check(!(await nano.isVisible()) && (await input.isVisible()), `${width} px : nano se ferme`);
  await tape('cat notes.txt');
  check((await game.locator('.output').textContent()).includes('Bonjour depuis nano\nencore'), `${width} px : le fichier est bien écrit`);
  // Le carnet du sysadmin : les commandes lancées, avec leur ligne du manuel ; il survit au rechargement.
  const notebook = game.locator('details.notebook');
  await notebook.locator('summary').click();
  check((await notebook.locator('dt').allTextContents()).includes('nano'), `${width} px : nano est entré au carnet`);
  check((await notebook.locator('summary').textContent()).match(/\(\d+ commandes\)/), `${width} px : le carnet compte ses commandes`);
  const [download] = await Promise.all([page.waitForEvent('download'), notebook.locator('.notebook-actions button').first().click()]);
  check(download.suggestedFilename() === 'carnet-du-sysadmin.md', `${width} px : le carnet se télécharge en Markdown`);
  await page.reload();
  check((await game.locator('details.notebook dt').allTextContents()).includes('nano'), `${width} px : le carnet est gardé dans le navigateur`);
  // La carte : un bouton ouvre la fenêtre, avec l'endroit où l'on est ; Échap la ferme.
  await game.locator('.map-button').click();
  const window = game.locator('dialog.map-window');
  check(await window.evaluate((d) => d.open), `${width} px : la carte s’ouvre`);
  check((await window.locator('[aria-current="location"]').count()) === 1 && (await window.textContent()).includes('tu es ici'), `${width} px : la carte montre où l’on est`);
  const box = await window.boundingBox();
  check(box.x >= 0 && box.x + box.width <= width, `${width} px : la carte tient dans l’écran`);
  if (process.env.CAPTURES) await page.screenshot({ path: `${process.env.CAPTURES}/carte-${width}.png` });
  await page.keyboard.press('Escape');
  check(!(await window.evaluate((d) => d.open)), `${width} px : Échap ferme la carte`);
  // Le navigateur rend d'abord le focus au bouton, puis le jeu à la saisie : on attend jusqu'à une seconde.
  const reprise = await input.evaluate(
    (i) =>
      new Promise((ok) => {
        const end = Date.now() + 1000;
        const see = () => (i.getRootNode().activeElement === i ? ok(true) : Date.now() > end ? ok(false) : setTimeout(see, 20));
        see();
      }),
  );
  check(reprise, `${width} px : la saisie reprend après la carte`);
  // Le mode examen : la case recommence le chapitre en cours, le chrono démarre.
  await tape('ssh royaume');
  await game.locator('.exam input').check();
  check((await game.locator('.output').textContent()).includes('Mode examen'), `${width} px : le mode examen s’annonce`);
  await page.waitForTimeout(1100);
  check(/⏱ 00:0\d/.test(await game.locator('.timer').textContent()), `${width} px : le chrono tourne`);
  await game.locator('.exam input').uncheck();
  check((await game.locator('.timer').textContent()) === '', `${width} px : sans examen, plus de chrono`);
  // Un chapitre en cours : le mode examen le ferait recommencer, on demande d'abord.
  await tape('ls');
  await game.locator('.exam input').click();
  const confirmation = game.locator('dialog.exam-window');
  check((await confirmation.evaluate((d) => d.open)) && !(await game.locator('.exam input').isChecked()), `${width} px : le mode examen demande confirmation`);
  await confirmation.locator('button', { hasText: 'Annuler' }).click();
  check(!(await confirmation.evaluate((d) => d.open)) && !(await game.locator('.exam input').isChecked()) && (await game.locator('.timer').textContent()) === '', `${width} px : annuler ne change rien`);
  await game.locator('.exam input').click();
  await confirmation.locator('button', { hasText: 'mode examen' }).click();
  check((await game.locator('.exam input').isChecked()) && /⏱/.test(await game.locator('.timer').textContent()), `${width} px : confirmé, le mode examen commence`);
  await game.locator('.exam input').uncheck();
  check(!(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)), `${width} px : pas de défilement horizontal`);
  check(errors.length === 0, `${width} px : aucune erreur console ${errors.join(' ')}`);
  check(externes.length === 0, `${width} px : aucune ressource tierce ${externes.join(' ')}`);
  if (process.env.CAPTURES) await page.screenshot({ path: `${process.env.CAPTURES}/jeu-${width}.png`, fullPage: true });
  // Les fiches pour les enseignant·es : une page statique, générée à la construction.
  await page.goto(`${BASE}/fr/enseignants/`);
  check((await page.locator('.sheet').count()) > 50, `${width} px : les fiches des enseignant·es sont là`);
  check((await page.locator('#c-bottleneck').textContent()).includes('iostat'), `${width} px : une fiche donne ses commandes nouvelles`);
  check(!(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)), `${width} px : fiches sans défilement horizontal`);
  check(errors.length === 0, `${width} px : fiches sans erreur console ${errors.join(' ')}`);
  if (process.env.CAPTURES) await page.screenshot({ path: `${process.env.CAPTURES}/enseignants-${width}.png` });
  await page.close();
}

// Le plan du réseau : dans La Ruche, l'onglet « Réseau » de la carte montre le
// schéma (avec « tu es ici » sur le routeur) et sa version en liste.
for (const width of [1000, 375]) {
  const page = await browser.newPage({ viewport: { width: width, height: 900 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  await withCsp(page);
  // L'Effaceur, et ce qu'il faut avoir fini pour recevoir la clé de La Ruche (prerequisites('hive')).
  await page.addInitScript(() =>
    localStorage.setItem(
      'quetes-de-sysadmin',
      JSON.stringify({ finished: ['lighthouse', 'village', 'root', 'backup', 'first-day', 'second-day', 'reboot-night', 'lost-packet', 'shut-the-door', 'firewall', 'keys', 'jump'], story: 'hive' }),
    ),
  );
  await page.goto(`${BASE}/fr/`);
  const game = page.locator('quetes-de-sysadmin');
  await game.locator('.map-button').click();
  const network = game.locator('[role="tab"]', { hasText: 'Réseau' });
  check(await network.isVisible(), `réseau ${width} px : l’onglet Réseau est là`);
  await network.click();
  const schema = game.locator('.plan-diagram svg');
  check((await schema.count()) === 1 && (await game.locator('.plan-diagram .here').textContent()).includes('ruche'), `réseau ${width} px : le schéma, avec le routeur où l’on est`);
  await game.locator('.plan-text').evaluate((d) => (d.open = true));
  check((await game.locator('.plan-text [aria-current="location"]').textContent()).includes('tu es ici'), `réseau ${width} px : la version en liste`);
  check(!(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)), `réseau ${width} px : pas de défilement horizontal de la page`);
  if (process.env.CAPTURES) await page.screenshot({ path: `${process.env.CAPTURES}/reseau-${width}.png` });
  check(errors.length === 0, `réseau ${width} px : aucune erreur console ${errors.join(' ')}`);
  await page.close();
}

// La page en anglais : le jeu en anglais, le lien vers la page française.
for (const width of [1000, 375]) {
  const page = await browser.newPage({ viewport: { width: width, height: 900 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  await withCsp(page);
  await page.goto(`${BASE}/en/`);
  const game = page.locator('quetes-de-sysadmin');
  check((await page.locator('html').getAttribute('lang')) === 'en', `en ${width} px : la page est en anglais`);
  check((await game.locator('.output').textContent()).includes('Welcome to your workstation'), `en ${width} px : le jeu parle anglais`);
  check((await game.locator('.prompt').textContent()) === 'you@desk:~$', `en ${width} px : le compte du joueur s’appelle you, le poste desk`);
  const input = game.locator('form input');
  await input.fill('ls -y');
  await input.press('Enter');
  check((await game.locator('.output').textContent()).includes("Try 'ls --help' for more information."), `en ${width} px : les messages des commandes sont ceux de LANG=C`);
  check((await page.locator('.language a').getAttribute('href')) === '/fr/', `en ${width} px : lien vers la page française`);
  check(!(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)), `en ${width} px : pas de défilement horizontal`);
  check(errors.length === 0, `en ${width} px : aucune erreur console ${errors.join(' ')}`);
  if (process.env.CAPTURES) await page.screenshot({ path: `${process.env.CAPTURES}/en-${width}.png` });
  // The teachers' page in English.
  await page.locator('a[href="/en/teachers/"]').click();
  await page.waitForURL(/\/en\/teachers\//);
  check((await page.locator('h1').textContent()).includes('For teachers'), `en ${width} px : la page des enseignant·es en anglais`);
  check((await page.locator('#c-bottleneck dt').first().textContent()) === 'Goal', `en ${width} px : fiches en anglais`);
  check((await page.locator('.language a').getAttribute('href')) === '/fr/enseignants/', `en ${width} px : lien vers les fiches en français`);
  check(!(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)), `en ${width} px : fiches sans défilement horizontal`);
  check(errors.length === 0, `en ${width} px : fiches sans erreur console ${errors.join(' ')}`);
  await page.close();
}

// Une partie commencée en français et reprise en anglais (la même sauvegarde) :
// ssh kingdom (royaume, en anglais) se connecte avec le compte anglais (you), pas avec « vous ».
{
  const page = await browser.newPage();
  await withCsp(page);
  await page.goto(`${BASE}/fr/`);
  const frGame = page.locator('quetes-de-sysadmin');
  await frGame.locator('form input').fill('ls');
  await frGame.locator('form input').press('Enter');
  await page.goto(`${BASE}/en/`);
  const game = page.locator('quetes-de-sysadmin');
  for (const l of ['ssh kingdom', 'yes']) {
    await game.locator('form input').fill(l);
    await game.locator('form input').press('Enter');
  }
  check((await game.locator('.prompt').textContent()) === 'you@kingdom:~$', 'reprise en anglais d’une partie française : ssh kingdom se connecte');
  await page.close();
}

// Ma progression : le nom en tête du carnet, le code court recopié sur une
// autre machine (un autre navigateur), le fichier qui remporte tout.
for (const width of [1000, 375]) {
  const here = await browser.newContext({ viewport: { width: width, height: 900 } });
  const page = await here.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  await withCsp(page);
  await page.addInitScript(() => {
    if (!localStorage.getItem('quetes-de-sysadmin'))
      localStorage.setItem('quetes-de-sysadmin', JSON.stringify({ finished: ['lighthouse', 'village', 'root', 'backup', 'keys'], notebook: { ls: { line: 'ls -a', chapter: 'lighthouse' } } }));
  });
  await page.goto(`${BASE}/fr/`);
  let game = page.locator('quetes-de-sysadmin');
  await game.locator('button', { hasText: 'Ma progression' }).click();
  const window = game.locator('dialog.progress-window');
  check(await window.evaluate((d) => d.open), `progression ${width} px : la fenêtre s’ouvre`);
  const code = await window.locator('.progress-code').textContent();
  check(/^QDS(-[0-9A-Z]{1,4})+$/.test(code), `progression ${width} px : le code ${code}`);
  await window.locator('input[type="text"]').first().fill('Lina');
  await window.locator('input[type="text"]').first().press('Tab');
  const box = await window.boundingBox();
  check(box.x >= 0 && box.x + box.width <= width, `progression ${width} px : la fenêtre tient dans l’écran`);
  if (process.env.CAPTURES) await page.screenshot({ path: `${process.env.CAPTURES}/progression-${width}.png` });
  const [download] = await Promise.all([page.waitForEvent('download'), window.locator('button', { hasText: 'Télécharger ma sauvegarde' }).click()]);
  const file = await download.path();
  await page.keyboard.press('Escape');
  check((await game.locator('.notebook summary').textContent()).includes('Le carnet de Lina'), `progression ${width} px : le nom en tête du carnet`);

  // Une autre machine : un navigateur neuf.
  const elsewhere = await browser.newContext({ viewport: { width: width, height: 900 } });
  const other = await elsewhere.newPage();
  await withCsp(other);
  await other.goto(`${BASE}/fr/`);
  game = other.locator('quetes-de-sysadmin');
  await game.locator('button', { hasText: 'Ma progression' }).click();
  const codeInput = game.locator('dialog.progress-window input[type="text"]').nth(1);
  const resumeCode = game.locator('dialog.progress-window button', { hasText: 'Reprendre' });
  // D'abord une faute de frappe : refusée, rien ne change.
  await codeInput.fill(code.slice(0, -1) + (code.endsWith('A') ? 'B' : 'A'));
  await resumeCode.click();
  check((await game.locator('.progress-state').textContent()).length > 0 && (await other.evaluate(() => localStorage.getItem('quetes-de-sysadmin'))) !== null, `progression ${width} px : un code faux est refusé, avec un message`);
  // Puis le bon code, recopié en minuscules avec un O pour un 0 : le jeu repart avec ces chapitres.
  await codeInput.fill(code.toLowerCase().replace(/0/g, 'o'));
  await resumeCode.click();
  await other.waitForFunction(() => !document.querySelector('quetes-de-sysadmin')?.shadowRoot?.querySelector('dialog.progress-window')?.open);
  const stories = await other.evaluate(() => JSON.parse(localStorage.getItem('quetes-de-sysadmin')).finished);
  check(['lighthouse', 'village', 'root', 'backup', 'keys'].every((id) => stories.includes(id)), `progression ${width} px : le code reprend les chapitres terminés`);
  // Le fichier, dans un troisième navigateur : tout revient, nom et carnet compris.
  const third = await (await browser.newContext({ viewport: { width: width, height: 900 } })).newPage();
  await withCsp(third);
  third.on('dialog', (d) => d.accept());
  await third.goto(`${BASE}/fr/`);
  game = third.locator('quetes-de-sysadmin');
  await game.locator('button', { hasText: 'Ma progression' }).click();
  await game.locator('dialog.progress-window input[type="file"]').setInputFiles(file);
  await third.waitForFunction(() => document.querySelector('quetes-de-sysadmin')?.shadowRoot?.querySelector('.notebook summary')?.textContent?.includes('Lina'));
  check((await game.locator('.notebook summary').textContent()).includes('Le carnet de Lina'), `progression ${width} px : le fichier reprend tout, nom et carnet compris`);
  check(errors.length === 0, `progression ${width} px : aucune erreur console ${errors.join(' ')}`);
  await here.close();
  await elsewhere.close();
}

// La mission, Ctrl-R et Ctrl-C (bureau), puis la barre de touches (téléphone).
{
  const page = await browser.newPage({ viewport: { width: 1000, height: 900 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  await withCsp(page);
  await page.goto(`${BASE}/fr/`);
  const game = page.locator('quetes-de-sysadmin');
  const input = game.locator('form input');
  for (const l of ['ssh royaume', 'yes', 'cat message.txt', 'cd Jetee', 'mv filet ~/Port/Hangar', 'cd ~']) {
    await input.fill(l);
    await input.press('Enter');
  }
  check(!(await game.locator('.keys').isVisible()), 'bureau : pas de barre de touches');
  // Ctrl-R : chercher « Jet », Entrée relance « cd Jetee ».
  await input.press('Control+r');
  await input.pressSequentially('Jet');
  check((await game.locator('.search').textContent()).includes('cd Jetee'), 'Ctrl-R trouve la commande dans l’historique');
  await input.press('Enter');
  check((await game.locator('.prompt').textContent()).includes('Jetee'), 'Ctrl-R puis Entrée la relance');
  // Ctrl-C : la ligne est abandonnée.
  await input.fill('rm -r tout');
  await input.press('Control+c');
  check((await input.inputValue()) === '' && (await game.locator('.output').textContent()).includes('rm -r tout^C'), 'Ctrl-C abandonne la ligne');
  // La mission : objectif, consignes, et le filet déplacé dans « ce qui s'est passé ».
  await game.locator('.mission-button').click();
  const mission = game.locator('dialog.mission-window');
  check((await mission.locator('h2').textContent()).includes('Chapitre 1'), 'la mission donne le chapitre');
  check((await mission.locator('.mission-log li').count()) >= 1, 'la mission relit ce qui s’est passé');
  await page.keyboard.press('Escape');
  check(errors.length === 0, `mission : aucune erreur console ${errors.join(' ')}`);
  await page.close();

  const telephone = await browser.newContext({ viewport: { width: 375, height: 800 }, isMobile: true, hasTouch: true });
  const mobile = await telephone.newPage();
  await withCsp(mobile);
  await mobile.goto(`${BASE}/fr/`);
  const mobileGame = mobile.locator('quetes-de-sysadmin');
  check(await mobileGame.locator('.keys').isVisible(), 'téléphone : la barre de touches est là');
  const line = mobileGame.locator('form input');
  await line.fill('ls -a ~/.s');
  await mobileGame.locator('.keys button[data-key="Tab"]').tap();
  check((await line.inputValue()) === 'ls -a ~/.ssh/', 'téléphone : Tab complète');
  await mobileGame.locator('.keys button[data-key="|"]').tap();
  check((await line.inputValue()).endsWith('|'), 'téléphone : | s’insère dans la ligne');
  check((await mobileGame.locator('.highlighting').textContent()).endsWith('|'), 'téléphone : le caractère de la barre se voit tout de suite');
  // _ est dans bien des noms (id_royaume, authorized_keys) et loin sur les claviers des téléphones.
  await mobileGame.locator('.keys button[data-key="_"]').tap();
  check((await line.inputValue()).endsWith('|_'), 'téléphone : la barre a la touche _');
  // Double Tab : les possibilités, rangées en colonnes dans la largeur du téléphone.
  await line.fill('ls ~/.ssh/');
  await mobileGame.locator('.keys button[data-key="Tab"]').tap();
  await mobileGame.locator('.keys button[data-key="Tab"]').tap();
  check((await mobileGame.locator('.output .suggestions').count()) === 1, 'téléphone : le double Tab montre les possibilités');
  await line.fill('ls -a /etc');
  await line.press('Enter');
  check(
    await mobileGame.locator('.output').evaluate((s) => [...s.querySelectorAll('pre')].every((p) => p.scrollWidth <= p.clientWidth + 1)),
    'téléphone : ls tient dans la largeur, sans défilement caché',
  );
  check(!(await mobile.evaluate(() => document.documentElement.scrollWidth > innerWidth)), 'téléphone : pas de défilement horizontal');
  // L'appui long (contextmenu au doigt) garde la sélection et le menu du téléphone ;
  // à la souris, le clic droit colle, comme dans un terminal Linux.
  const cancelled = (type) =>
    mobileGame.locator('.output').evaluate((s, type) => {
      s.dispatchEvent(new PointerEvent('pointerdown', { pointerType: type, bubbles: true, composed: true }));
      return !s.dispatchEvent(new PointerEvent('contextmenu', { pointerType: type, bubbles: true, cancelable: true, composed: true }));
    }, type);
  check(!(await cancelled('touch')), 'téléphone : l’appui long sélectionne le texte (menu du téléphone)');
  check(await cancelled('mouse'), 'souris : le clic droit colle');
  // nano sans touche Ctrl : la barre donne ^O et ^X, toujours à l'écran.
  await line.fill('nano notes.txt');
  await line.press('Enter');
  const nanoBar = mobileGame.locator('.keys button[data-key="ctrl-x"]');
  check((await nanoBar.isVisible()) && !(await mobileGame.locator('.keys button[data-key="Tab"]').isVisible()), 'téléphone : dans nano, la barre donne ^O et ^X');
  const box = await nanoBar.boundingBox();
  check(box !== null && box.y + box.height <= 800, 'téléphone : ^X est à l’écran');
  await mobileGame.locator('.nano-text').fill('Bonjour du téléphone\n');
  await mobileGame.locator('.keys button[data-key="ctrl-o"]').tap();
  check((await mobileGame.locator('.nano-status').textContent()).includes('1 ligne'), 'téléphone : ^O de la barre écrit le fichier');
  await mobileGame.locator('.nano-text').fill('Bonjour du téléphone\nencore\n');
  await nanoBar.tap();
  check(await mobileGame.locator('.nano-key', { hasText: 'Oui' }).isVisible(), 'téléphone : ^X demande s’il faut enregistrer');
  await mobileGame.locator('.nano-key', { hasText: 'Oui' }).tap();
  check(
    !(await mobileGame.locator('.nano').count()) && (await mobileGame.locator('.keys button[data-key="Tab"]').isVisible()) && !(await nanoBar.isVisible()),
    'téléphone : nano fermé, la barre revient',
  );
  await telephone.close();
}

// Les succès : annoncés dans le terminal, comptés sur le lien, listés avec le grade.
{
  const page = await browser.newPage({ viewport: { width: 1000, height: 900 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  await withCsp(page);
  await page.goto(`${BASE}/fr/`);
  const game = page.locator('quetes-de-sysadmin');
  for (const l of ['ls -a ~/.ssh', 'xyzzy']) {
    await game.locator('form input').fill(l);
    await game.locator('form input').press('Enter');
  }
  const output = await game.locator('.output').textContent();
  check(output.includes('Succès : Ce qui est caché') && output.includes('Succès : Mot magique'), 'succès : annoncés dans le terminal');
  const link = game.locator('.tips button', { hasText: 'Succès' });
  check(/Succès \(\d+\/\d+\)/.test(await link.textContent()), `succès : le compte sur le lien (${await link.textContent()})`);
  await link.click();
  const window = game.locator('dialog.achievements-window');
  check((await window.locator('.achievement-rank').textContent()).includes('Stagiaire'), 'succès : le grade');
  check((await window.locator('.earned').count()) === 3 && (await window.textContent()).includes('Succès caché'), 'succès : obtenus et cachés dans la liste');
  if (process.env.CAPTURES) await page.screenshot({ path: `${process.env.CAPTURES}/succes-1000.png` });
  await page.keyboard.press('Escape');
  check(errors.length === 0, `succès : aucune erreur console ${errors.join(' ')}`);
  await page.close();
}

// Les indices gradués : le manuel, puis une piste, puis presque la réponse ;
// le débrief les compte ; rien en mode examen.
{
  const page = await browser.newPage({ viewport: { width: 1000, height: 900 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  await withCsp(page);
  await page.goto(`${BASE}/fr/`);
  const game = page.locator('quetes-de-sysadmin');
  const taper = async (l) => {
    await game.locator('form input').fill(l);
    await game.locator('form input').press('Enter');
  };
  for (const l of ['ssh royaume', 'yes']) await taper(l);
  const mission = game.locator('dialog.mission-window');
  await game.locator('.mission-button').click();
  const button = (n) => mission.locator(`[data-level="${n}"]`);
  check((await button('manual').isVisible()) && !(await button('lead').isVisible()), 'indices : le manuel d’abord');
  await button('manual').click();
  check((await mission.locator('.hint-text').textContent()).includes('man mv'), 'indices : les pages du manuel');
  await button('lead').click();
  await button('solution').click();
  check((await mission.locator('.hint-text').textContent()).includes('mv crabe Seau'), 'indices : presque la réponse, pour l’étape en cours');
  await page.keyboard.press('Escape');
  // L'instantané de secours : pris après le filet, puis l'ampoule mal rangée, et on revient.
  await taper('mv Jetee/filet Port/Hangar');
  await game.locator('.mission-button').click();
  await mission.locator('.rescue-button', { hasText: 'Prendre un instantané' }).click();
  check((await mission.locator('.rescue-state').textContent()).includes('après une saisie'), 'instantané : pris');
  await page.keyboard.press('Escape');
  await taper('mv Port/Remise/.ampoule_de_secours Port/Hangar');
  await game.locator('.mission-button').click();
  await mission.locator('.rescue-button', { hasText: 'Revenir' }).click();
  check(!(await mission.evaluate((d) => d.open)) && (await game.locator('.output').textContent()).includes('Machine remise comme après la première saisie'), 'instantané : la machine est remise');
  await taper('ls -a Port/Remise');
  check((await game.locator('.output').textContent()).split('ls -a Port/Remise')[1]?.includes('.ampoule_de_secours'), 'instantané : l’ampoule est revenue à sa place');
  await taper('mv Port/Remise/.ampoule_de_secours Jetee/Phare/Escalier/Lanterne/ampoule');
  check((await game.locator('.output .summary').textContent()).includes('3 indices'), 'indices : le bilan les compte (même après un instantané)');
  // En mode examen : pas d'aide.
  await game.locator('.exam input').check();
  await game.locator('.mission-button').click();
  check(!(await mission.locator('.help').isVisible()), 'indices : rien en mode examen');
  await page.keyboard.press('Escape');
  check(errors.length === 0, `indices : aucune erreur console ${errors.join(' ')}`);
  await page.close();
}

// Le tableau de classe : deux fichiers d'élèves et un code, lus dans le
// navigateur ; le CSV téléchargé neutralise un nom piégé.
for (const width of [1000, 375]) {
  const page = await browser.newPage({ viewport: { width: width, height: 900 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  await withCsp(page);
  await page.goto(`${BASE}/fr/enseignants/`);
  await page.locator('a[href="/fr/enseignants/classe/"]').click();
  await page.waitForURL(/\/fr\/enseignants\/classe\//);
  const file = (name, backup) => ({
    name: name,
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify({ format: 'quetes-de-sysadmin', version: 1, date: '2027-01-15T10:00:00Z', backup })),
  });
  await page.locator('#class input[type="file"]').setInputFiles([
    file('lina.json', { finished: ['lighthouse', 'village', 'root', 'backup', 'keys'], name: 'Lina', achievements: { tube: 'x' }, records: { lighthouse: 61000 } }),
    file('piege.json', { finished: ['lighthouse'], name: '=1+1' }),
  ]);
  await page.locator('#class textarea').fill('Nour QDS-041H-R');
  await page.locator('#class button', { hasText: 'Ajouter les codes' }).click();
  await page.waitForFunction(() => document.querySelectorAll('#class tbody tr').length >= 3);
  const lines = await page.locator('#class tbody tr').count();
  check(lines === 3, `classe ${width} px : une ligne par élève (${lines})`);
  check((await page.locator('#class tbody').textContent()).includes('Lina') && (await page.locator('#class tbody').textContent()).includes('Admin junior'), `classe ${width} px : chapitres et grade`);
  const [download] = await Promise.all([page.waitForEvent('download'), page.locator('#class button', { hasText: 'CSV' }).click()]);
  const csv = readFileSync(await download.path(), 'utf8');
  check(csv.includes("'=1+1") && csv.includes('Lina;5/'), `classe ${width} px : le CSV, sans formule`);
  check(!(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)), `classe ${width} px : pas de défilement horizontal de la page`);
  if (process.env.CAPTURES) await page.screenshot({ path: `${process.env.CAPTURES}/classe-${width}.png` });
  check(errors.length === 0, `classe ${width} px : aucune erreur console ${errors.join(' ')}`);
  await page.close();
}

// L'affichage : thème du terminal, taille, plein écran, gardés dans le
// navigateur ; la mise en scène d'une connexion.
for (const width of [1000, 375]) {
  const page = await browser.newPage({ viewport: { width: width, height: 800 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  await withCsp(page);
  await page.goto(`${BASE}/fr/`);
  const game = page.locator('quetes-de-sysadmin');
  const terminal = game.locator('.terminal');
  // Le menu : la carte du réseau d'abord, une branche par machine.
  const menu = game.locator('nav.stories');
  check((await menu.getAttribute('data-view')) === 'network' && (await game.locator('.host', { hasText: 'royaume.internal 192.0.2.10' }).isVisible()), `affichage ${width} px : la carte du réseau sert de menu`);
  await game.locator('.view-choice button', { hasText: 'Baies' }).click();
  check((await menu.getAttribute('data-view')) === 'racks' && !(await game.locator('.host').first().isVisible()), `affichage ${width} px : la vue en baies`);
  await game.locator('.view-choice button', { hasText: 'Carte du réseau' }).click();
  await game.locator('.view-choice button', { hasText: 'Baies' }).click();
  await game.locator('.settings select').selectOption('amber');
  const size = () => terminal.evaluate((e) => parseFloat(getComputedStyle(e).fontSize));
  const before = await size();
  await game.locator('.settings button', { hasText: 'A+' }).click();
  check((await terminal.getAttribute('data-theme')) === 'amber' && (await size()) > before, `affichage ${width} px : thème et taille`);
  // La coloration de la ligne : la faute de frappe se voit avant Entrée ; la copie colorée est sous le champ.
  await game.locator('form input').pressSequentially('lss');
  check((await game.locator('.highlighting .c-unknown').textContent()) === 'lss', `affichage ${width} px : une commande inconnue est colorée`);
  await game.locator('form input').fill('');
  await game.locator('form input').pressSequentially('ls -a');
  const [field, copyOf] = await Promise.all([game.locator('form input').boundingBox(), game.locator('.highlighting').boundingBox()]);
  check(
    (await game.locator('.highlighting .c-command').textContent()) === 'ls' && (await game.locator('.highlighting .c-option').textContent()) === '-a' && Math.abs(field.x - copyOf.x) < 1 && Math.abs(field.y - copyOf.y) < 1,
    `affichage ${width} px : commande et option colorées, sous le champ`,
  );
  // Les espaces entre les mots colorés restent (la copie a la largeur du texte du champ).
  await game.locator('form input').pressSequentially(' | cat');
  const widths = await game.locator('.field').evaluate((c) => {
    const i = c.querySelector('input');
    const measure = document.createElement('span');
    measure.style.cssText = 'position:absolute;white-space:pre;font:inherit;visibility:hidden';
    measure.textContent = i.value;
    c.append(measure);
    const r = document.createRange();
    r.selectNodeContents(c.querySelector('.highlighting'));
    const l = [measure.getBoundingClientRect().width, r.getBoundingClientRect().width];
    measure.remove();
    return l;
  });
  check(Math.abs(widths[0] - widths[1]) < 2, `affichage ${width} px : la copie colorée garde les espaces (${widths})`);
  await game.locator('form input').press('Enter');
  // ls colore les lieux à l'écran (.ssh), et garde le / ; dans le tube vers cat, rien.
  await game.locator('form input').fill('ls -a');
  await game.locator('form input').press('Enter');
  check((await game.locator('.output pre:not(.cmd)').last().locator('.a-34', { hasText: '.ssh' }).count()) === 1 && (await game.locator('.output pre:not(.cmd)').last().textContent()).includes('.ssh/'), `affichage ${width} px : ls colore les lieux`);
  check((await game.locator('.output .cmd .c-command').nth(-2).textContent()) === 'cat', `affichage ${width} px : la commande reste colorée au-dessus de sa sortie`);
  await game.locator('form input').fill('ssh royaume');
  await game.locator('form input').press('Enter');
  await game.locator('form input').pressSequentially('yes');
  check(!(await game.locator('.field').evaluate((e) => e.classList.contains('coloured'))), `affichage ${width} px : une réponse (yes/no) n'est pas colorée`);
  await game.locator('form input').fill('yes');
  await game.locator('form input').press('Enter');
  check(await terminal.evaluate((e) => e.classList.contains('scene-connection')), `affichage ${width} px : la connexion est mise en scène`);
  check((await game.locator('li:has(> button[data-story="0"])').getAttribute('data-state')) === 'in-progress', `affichage ${width} px : la machine où l'on joue s'allume sur la carte`);
  await game.locator('.settings button', { hasText: 'Couleurs' }).click();
  await game.locator('form input').pressSequentially('ls -a');
  check(!(await game.locator('.field').evaluate((e) => e.classList.contains('coloured'))) && (await game.locator('form input').evaluate((e) => getComputedStyle(e).color)) !== 'rgba(0, 0, 0, 0)', `affichage ${width} px : la coloration se coupe`);
  await game.locator('form input').press('Enter');
  check((await game.locator('.output pre:not(.cmd)').last().locator('[class^="a-"]').count()) === 0, `affichage ${width} px : les sorties aussi, sans couleur`);
  await game.locator('.settings button', { hasText: 'Plein écran' }).click();
  const box = await terminal.boundingBox();
  check(box.width > width - 40 && box.height > 600, `affichage ${width} px : plein écran`);
  await game.locator('form input').press('Escape');
  check(!(await game.locator('.screen').evaluate((e) => e.classList.contains('focus'))), `affichage ${width} px : Échap quitte le plein écran`);
  await page.reload();
  check((await game.locator('.terminal').getAttribute('data-theme')) === 'amber' && (await menu.getAttribute('data-view')) === 'racks', `affichage ${width} px : les réglages sont gardés`);
  check(!(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)), `affichage ${width} px : pas de défilement horizontal`);
  if (process.env.CAPTURES) await page.screenshot({ path: `${process.env.CAPTURES}/affichage-${width}.png` });
  check(errors.length === 0, `affichage ${width} px : aucune erreur console ${errors.join(' ')}`);
  await page.close();
}

// Les parcours : une troisième vue du menu ; un thème, ses chapitres, le prochain à faire.
for (const width of [1000, 375]) {
  const page = await browser.newPage({ viewport: { width: width, height: 900 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  await withCsp(page);
  await page.goto(`${BASE}/fr/`);
  await page.evaluate(() => localStorage.setItem('quetes-de-sysadmin', JSON.stringify({ finished: ['lighthouse', 'village', 'root', 'backup', 'first-day', 'second-day', 'reboot-night', 'lost-packet', 'shut-the-door'] })));
  await page.reload();
  const game = page.locator('quetes-de-sysadmin');
  await game.locator('.view-choice button', { hasText: 'Parcours' }).click();
  await game.locator('.paths select').selectOption('security');
  const maps = game.locator('.paths-list button');
  check((await maps.count()) === 21 && (await game.locator('.paths-progress').textContent()).includes('1 sur 21'), `parcours ${width} px : le parcours et son avancée`);
  const next = game.locator('.paths-list button[data-next]');
  check((await next.textContent()).includes('Le pare-feu') && (await game.locator('.paths-list button[data-state="locked"]').first().textContent()).includes('D\'abord'), `parcours ${width} px : le prochain, et ce qui attend`);
  await next.click();
  check((await game.locator('.prompt').textContent()).startsWith('vous@lettres'), `parcours ${width} px : le prochain chapitre s’ouvre`);
  await page.reload();
  check((await game.locator('nav.stories').getAttribute('data-view')) === 'paths' && (await game.locator('.paths select').inputValue()) === 'security', `parcours ${width} px : la vue et le parcours sont gardés`);
  check(!(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)), `parcours ${width} px : pas de défilement horizontal`);
  check(errors.length === 0, `parcours ${width} px : aucune erreur console ${errors.join(' ')}`);
  await page.evaluate(() => localStorage.clear());
  await page.close();
}

// Le Datacenter en direct : tail -f garde la main, les visites arrivent, Ctrl-C la rend
// (le clavier sur un écran large, la barre de touches sur un téléphone).
for (const width of [1000, 375]) {
  const context = await browser.newContext({ viewport: { width: width, height: 900 }, ...(width < 500 ? { isMobile: true, hasTouch: true } : {}) });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  await withCsp(page);
  await page.goto(`${BASE}/fr/`);
  await page.evaluate(() => localStorage.setItem('quetes-de-sysadmin', JSON.stringify({ finished: ['lighthouse', 'village', 'root', 'backup'] })));
  await page.reload();
  const game = page.locator('quetes-de-sysadmin');
  for (const l of ['ssh datacenter', 'yes', 'tail -f /var/log/nginx/access.log']) {
    await game.locator('form input').fill(l);
    await game.locator('form input').press('Enter');
  }
  const stop = game.locator('.stop-follow');
  check((await game.locator('form').isHidden()) && (await stop.isVisible()), `suivi ${width} px : tail -f garde la main, le bouton Ctrl-C est là`);
  const before = (await game.locator('.output').textContent()).split('198.51.100.77').length;
  await page.waitForTimeout(2500);
  check((await game.locator('.output').textContent()).split('198.51.100.77').length > before, `suivi ${width} px : les visites du robot arrivent en direct`);
  if (width < 500) {
    check(!(await game.locator('.keys button[data-key="Tab"]').isVisible()), `suivi ${width} px : la barre ne garde que Ctrl-C`);
    await game.locator('.keys button[data-key="ctrl-c"]').tap();
  } else await stop.press('Control+c');
  check((await game.locator('.output').textContent()).includes('^C') && (await game.locator('form input').isVisible()) && !(await stop.isVisible()), `suivi ${width} px : Ctrl-C rend la ligne de commande`);
  const frozen = (await game.locator('.output').textContent()).length;
  await page.waitForTimeout(1500);
  check((await game.locator('.output').textContent()).length === frozen, `suivi ${width} px : après Ctrl-C, plus rien n’arrive`);
  check(!(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)), `suivi ${width} px : pas de défilement horizontal`);
  check(errors.length === 0, `suivi ${width} px : aucune erreur console ${errors.join(' ')}`);
  await context.close();
}

// L'astreinte : l'incident du jour, tiré parmi les histoires ouvertes après
// L'Effaceur (date fixée : le 14 janvier 2027, « Premier jour »),
// le budget qui fond, la carte de score à la fin, le résultat gardé.
for (const width of [1000, 375]) {
  const page = await browser.newPage({ viewport: { width: width, height: 900 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  await page.clock.install({ time: new Date('2027-01-14T10:00:00') });
  await withCsp(page);
  await page.goto(`${BASE}/fr/`);
  await page.evaluate(() => localStorage.setItem('quetes-de-sysadmin', JSON.stringify({ finished: ['lighthouse', 'village', 'root', 'backup'] })));
  await page.reload();
  const game = page.locator('quetes-de-sysadmin');
  check((await game.locator('.incident-text').textContent()).includes('Premier jour'), `astreinte ${width} px : l’incident du jour est annoncé`);
  // L'horloge arrêtée : le temps n'avance que par runFor (sinon, une seconde peut passer avant la lecture de la jauge).
  await page.clock.pauseAt(new Date('2027-01-14T10:00:10'));
  await game.locator('.incident-button').click();
  const window = game.locator('dialog.on-call-window').first();
  check((await window.evaluate((d) => d.open)) && (await window.textContent()).includes('14 janvier 2027'), `astreinte ${width} px : la fenêtre de l’astreinte`);
  await window.locator('button', { hasText: 'Prendre l' }).click();
  check((await game.locator('.prompt').textContent()).startsWith('vous@datacenter'), `astreinte ${width} px : l’incident s’ouvre`);
  check((await game.locator('.on-call-gauge').textContent()).includes('30:00 (100 %)') && (await game.locator('.incident-button').isDisabled()), `astreinte ${width} px : le budget est plein, pas de seconde astreinte`);
  await page.clock.runFor(60_000);
  check((await game.locator('.on-call-gauge').textContent()).includes('29:00'), `astreinte ${width} px : le budget fond avec le temps`);
  const L = '/var/log/nginx/access.log';
  for (const l of ['commande-inconnue', 'sudo kill 4242', 'bienvenue-2026', 'echo "deny 198.51.100.77;" | sudo tee -a /etc/nginx/blocked.conf', 'sudo systemctl reload nginx', 'sudo kill 4244', `grep " 503 " ${L} | wc -l > ~/rapport.txt`, 'echo "Coupable : 198.51.100.77" >> rapport.txt']) {
    await game.locator('form input').fill(l);
    await game.locator('form input').press('Enter');
  }
  const end = game.locator('dialog.on-call-window').last();
  check(await end.evaluate((d) => d.open), `astreinte ${width} px : la carte de score s’ouvre à la fin`);
  const map = await end.locator('.score-card').textContent();
  check(map.includes('astreinte du 2027-01-14') && map.includes('« Premier jour »') && /[🟩🟨⬜]{5} \d+ % du budget/.test(map) && map.includes('une erreur'), `astreinte ${width} px : la carte de score`);
  const box = await end.boundingBox();
  check(box.x >= 0 && box.x + box.width <= width, `astreinte ${width} px : la fenêtre tient dans l’écran`);
  await page.keyboard.press('Escape');
  check((await game.locator('.on-call-gauge').isHidden()) && (await game.locator('.incident-text').textContent()).includes('Fait aujourd’hui') || (await game.locator('.incident-text').textContent()).includes("Fait aujourd'hui"), `astreinte ${width} px : le résultat du jour est gardé`);
  check(!(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)), `astreinte ${width} px : pas de défilement horizontal`);
  check(errors.length === 0, `astreinte ${width} px : aucune erreur console ${errors.join(' ')}`);
  await page.evaluate(() => localStorage.clear());
  await page.close();
}

// The root: a choice of language (Apache redirects according to the browser,
// the preview server shows the page), English first.
{
  const page = await browser.newPage();
  await page.goto(`${BASE}/`);
  const links = await page.locator('.languages a').evaluateAll((as) => as.map((a) => a.getAttribute('href')));
  check(links.join(' ') === '/en/ /fr/', 'racine : choix de la langue, l’anglais d’abord');
  check((await page.locator('html').getAttribute('lang')) === 'en', 'racine : page en anglais');
  await page.close();
}

// Page introuvable
{
  const page = await browser.newPage();
  await page.goto(`${BASE}/n-existe-pas/`);
  check((await page.locator('h1').textContent()).includes('404'), '404 : page « introuvable » servie');
  await page.close();
}

// Intégration dans une page quelconque, avec le seul fichier d'intégration.
const page = await browser.newPage();
await page.route(`${BASE}/autre-site.html`, (r) => r.fulfill({ contentType: 'text/html', body: `<!doctype html><html lang="en"><body style="font-family:serif">
  <h1>Another site</h1>
  <quetes-de-sysadmin histoire="paquet" cle="test" theme="sombre"></quetes-de-sysadmin>
  <script type="module" src="${BASE}/integration/quetes-de-sysadmin.js"></script></body></html>` }));
await page.goto(`${BASE}/autre-site.html`);
await page.waitForFunction(() => document.querySelector('quetes-de-sysadmin')?.shadowRoot?.querySelector('.output pre'));
// Sans attribut langue, le jeu prend la langue de la page (ici lang="en").
check((await page.locator('quetes-de-sysadmin .output').textContent()).includes('The Lost Packet'), 'intégration : l’histoire demandée s’ouvre, dans la langue de la page');
check((await page.evaluate(() => getComputedStyle(document.querySelector('h1')).fontFamily)).includes('serif'), 'intégration : les styles de la page ne sont pas touchés');
await page.addStyleTag({ content: 'quetes-de-sysadmin { --qds-accent: rgb(1, 2, 3); }' });
check(
  (await page.evaluate(() => getComputedStyle(document.querySelector('quetes-de-sysadmin').shadowRoot.querySelector('a')).color)) === 'rgb(1, 2, 3)',
  'intégration : les couleurs se règlent depuis la page (--qds-accent)',
);

await browser.close();
console.log(failures ? `${failures} échec(s)` : 'Tout est bon.');
process.exit(failures ? 1 : 0);
