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
  // Le bilan : une ligne dans le terminal, le détail dans une fenêtre.
  verifier(/Bilan : \d+:\d\d · \d+ commandes/.test(await jeu.locator('.sortie .bilan').textContent()), `${largeur} px : le bilan du chapitre s’affiche`);
  await jeu.locator('.bouton-bilan').click();
  const fenetreBilan = jeu.locator('dialog.fenetre-bilan');
  verifier(
    (await fenetreBilan.evaluate((d) => d.open)) && (await fenetreBilan.locator('tbody code', { hasText: 'mv .ampoule_de_secours' }).count()) === 1,
    `${largeur} px : le détail du bilan montre la commande de l’étape`,
  );
  const boiteBilan = await fenetreBilan.boundingBox();
  verifier(boiteBilan.x >= 0 && boiteBilan.x + boiteBilan.width <= largeur, `${largeur} px : la fenêtre du bilan tient dans l’écran`);
  await page.keyboard.press('Escape');
  await jeu.locator('.fin button').click();
  verifier((await jeu.locator('.sortie').textContent()).includes('chapitre 2'), `${largeur} px : chapitre 2 ouvert`);
  await page.reload();
  verifier((await jeu.locator('.sortie').textContent()).includes('chapitre 2'), `${largeur} px : reprise après rechargement`);
  await tape('exit');
  verifier((await jeu.locator('.sortie').textContent()).includes('Connection to royaume.internal closed.'), `${largeur} px : exit ramène au poste`);
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
  // La carte : un bouton ouvre la fenêtre, avec l'endroit où l'on est ; Échap la ferme.
  await jeu.locator('.bouton-carte').click();
  const fenetre = jeu.locator('dialog.fenetre-carte');
  verifier(await fenetre.evaluate((d) => d.open), `${largeur} px : la carte s’ouvre`);
  verifier((await fenetre.locator('[aria-current="location"]').count()) === 1 && (await fenetre.textContent()).includes('tu es ici'), `${largeur} px : la carte montre où l’on est`);
  const boite = await fenetre.boundingBox();
  verifier(boite.x >= 0 && boite.x + boite.width <= largeur, `${largeur} px : la carte tient dans l’écran`);
  if (process.env.CAPTURES) await page.screenshot({ path: `${process.env.CAPTURES}/carte-${largeur}.png` });
  await page.keyboard.press('Escape');
  verifier(!(await fenetre.evaluate((d) => d.open)), `${largeur} px : Échap ferme la carte`);
  // Le navigateur rend d'abord le focus au bouton, puis le jeu à la saisie : on attend jusqu'à une seconde.
  const reprise = await saisie.evaluate(
    (i) =>
      new Promise((ok) => {
        const fin = Date.now() + 1000;
        const voir = () => (i.getRootNode().activeElement === i ? ok(true) : Date.now() > fin ? ok(false) : setTimeout(voir, 20));
        voir();
      }),
  );
  verifier(reprise, `${largeur} px : la saisie reprend après la carte`);
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

// Le plan du réseau : dans La Ruche, l'onglet « Réseau » de la carte montre le
// schéma (avec « tu es ici » sur le routeur) et sa version en liste.
for (const largeur of [1000, 375]) {
  const page = await navigateur.newPage({ viewport: { width: largeur, height: 900 } });
  const erreurs = [];
  page.on('pageerror', (e) => erreurs.push(e.message));
  page.on('console', (m) => m.type() === 'error' && erreurs.push(m.text()));
  await avecCsp(page);
  await page.addInitScript(() =>
    localStorage.setItem('quetes-de-sysadmin', JSON.stringify({ termines: ['eveil', 'bourg', 'racine', 'sauvegarde'], histoire: 'ruche' })),
  );
  await page.goto(`${BASE}/`);
  const jeu = page.locator('quetes-de-sysadmin');
  await jeu.locator('.bouton-carte').click();
  const reseau = jeu.locator('[role="tab"]', { hasText: 'Réseau' });
  verifier(await reseau.isVisible(), `réseau ${largeur} px : l’onglet Réseau est là`);
  await reseau.click();
  const schema = jeu.locator('.plan-schema svg');
  verifier((await schema.count()) === 1 && (await jeu.locator('.plan-schema .ici').textContent()).includes('ruche'), `réseau ${largeur} px : le schéma, avec le routeur où l’on est`);
  await jeu.locator('.plan-texte').evaluate((d) => (d.open = true));
  verifier((await jeu.locator('.plan-texte [aria-current="location"]').textContent()).includes('tu es ici'), `réseau ${largeur} px : la version en liste`);
  verifier(!(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)), `réseau ${largeur} px : pas de défilement horizontal de la page`);
  if (process.env.CAPTURES) await page.screenshot({ path: `${process.env.CAPTURES}/reseau-${largeur}.png` });
  verifier(erreurs.length === 0, `réseau ${largeur} px : aucune erreur console ${erreurs.join(' ')}`);
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
  verifier((await jeu.locator('.invite').textContent()) === 'you@poste:~$', `en ${largeur} px : le compte du joueur s’appelle you`);
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

// Une partie commencée en français et reprise en anglais (la même sauvegarde) :
// ssh royaume se connecte avec le compte anglais (you), pas avec « vous ».
{
  const page = await navigateur.newPage();
  await avecCsp(page);
  await page.goto(`${BASE}/`);
  const jeuFr = page.locator('quetes-de-sysadmin');
  await jeuFr.locator('form input').fill('ls');
  await jeuFr.locator('form input').press('Enter');
  await page.goto(`${BASE}/en/`);
  const jeu = page.locator('quetes-de-sysadmin');
  for (const l of ['ssh royaume', 'yes']) {
    await jeu.locator('form input').fill(l);
    await jeu.locator('form input').press('Enter');
  }
  verifier((await jeu.locator('.invite').textContent()) === 'you@royaume:~$', 'reprise en anglais d’une partie française : ssh royaume se connecte');
  await page.close();
}

// Ma progression : le nom en tête du carnet, le code court recopié sur une
// autre machine (un autre navigateur), le fichier qui remporte tout.
for (const largeur of [1000, 375]) {
  const ici = await navigateur.newContext({ viewport: { width: largeur, height: 900 } });
  const page = await ici.newPage();
  const erreurs = [];
  page.on('pageerror', (e) => erreurs.push(e.message));
  page.on('console', (m) => m.type() === 'error' && erreurs.push(m.text()));
  await avecCsp(page);
  await page.addInitScript(() => {
    if (!localStorage.getItem('quetes-de-sysadmin'))
      localStorage.setItem('quetes-de-sysadmin', JSON.stringify({ termines: ['eveil', 'bourg', 'racine', 'sauvegarde', 'cles'], carnet: { ls: { ligne: 'ls -a', chapitre: 'eveil' } } }));
  });
  await page.goto(`${BASE}/`);
  let jeu = page.locator('quetes-de-sysadmin');
  await jeu.locator('button', { hasText: 'Ma progression' }).click();
  const fenetre = jeu.locator('dialog.fenetre-progression');
  verifier(await fenetre.evaluate((d) => d.open), `progression ${largeur} px : la fenêtre s’ouvre`);
  const code = await fenetre.locator('.code-progression').textContent();
  verifier(/^QDS(-[0-9A-Z]{1,4})+$/.test(code), `progression ${largeur} px : le code ${code}`);
  await fenetre.locator('input[type="text"]').first().fill('Lina');
  await fenetre.locator('input[type="text"]').first().press('Tab');
  const boite = await fenetre.boundingBox();
  verifier(boite.x >= 0 && boite.x + boite.width <= largeur, `progression ${largeur} px : la fenêtre tient dans l’écran`);
  if (process.env.CAPTURES) await page.screenshot({ path: `${process.env.CAPTURES}/progression-${largeur}.png` });
  const [telechargement] = await Promise.all([page.waitForEvent('download'), fenetre.locator('button', { hasText: 'Télécharger ma sauvegarde' }).click()]);
  const fichier = await telechargement.path();
  await page.keyboard.press('Escape');
  verifier((await jeu.locator('.carnet summary').textContent()).includes('Le carnet de Lina'), `progression ${largeur} px : le nom en tête du carnet`);

  // Une autre machine : un navigateur neuf.
  const ailleurs = await navigateur.newContext({ viewport: { width: largeur, height: 900 } });
  const autre = await ailleurs.newPage();
  await avecCsp(autre);
  await autre.goto(`${BASE}/`);
  jeu = autre.locator('quetes-de-sysadmin');
  await jeu.locator('button', { hasText: 'Ma progression' }).click();
  const saisieCode = jeu.locator('dialog.fenetre-progression input[type="text"]').nth(1);
  const reprendreCode = jeu.locator('dialog.fenetre-progression button', { hasText: 'Reprendre' });
  // D'abord une faute de frappe : refusée, rien ne change.
  await saisieCode.fill(code.slice(0, -1) + (code.endsWith('A') ? 'B' : 'A'));
  await reprendreCode.click();
  verifier((await jeu.locator('.progression-etat').textContent()).length > 0 && (await autre.evaluate(() => localStorage.getItem('quetes-de-sysadmin'))) !== null, `progression ${largeur} px : un code faux est refusé, avec un message`);
  // Puis le bon code, recopié en minuscules avec un O pour un 0 : le jeu repart avec ces chapitres.
  await saisieCode.fill(code.toLowerCase().replace(/0/g, 'o'));
  await reprendreCode.click();
  await autre.waitForFunction(() => !document.querySelector('quetes-de-sysadmin')?.shadowRoot?.querySelector('dialog.fenetre-progression')?.open);
  const histoires = await autre.evaluate(() => JSON.parse(localStorage.getItem('quetes-de-sysadmin')).termines);
  verifier(['eveil', 'bourg', 'racine', 'sauvegarde', 'cles'].every((id) => histoires.includes(id)), `progression ${largeur} px : le code reprend les chapitres terminés`);
  // Le fichier, dans un troisième navigateur : tout revient, nom et carnet compris.
  const troisieme = await (await navigateur.newContext({ viewport: { width: largeur, height: 900 } })).newPage();
  await avecCsp(troisieme);
  troisieme.on('dialog', (d) => d.accept());
  await troisieme.goto(`${BASE}/`);
  jeu = troisieme.locator('quetes-de-sysadmin');
  await jeu.locator('button', { hasText: 'Ma progression' }).click();
  await jeu.locator('dialog.fenetre-progression input[type="file"]').setInputFiles(fichier);
  await troisieme.waitForFunction(() => document.querySelector('quetes-de-sysadmin')?.shadowRoot?.querySelector('.carnet summary')?.textContent?.includes('Lina'));
  verifier((await jeu.locator('.carnet summary').textContent()).includes('Le carnet de Lina'), `progression ${largeur} px : le fichier reprend tout, nom et carnet compris`);
  verifier(erreurs.length === 0, `progression ${largeur} px : aucune erreur console ${erreurs.join(' ')}`);
  await ici.close();
  await ailleurs.close();
}

// La mission, Ctrl-R et Ctrl-C (bureau), puis la barre de touches (téléphone).
{
  const page = await navigateur.newPage({ viewport: { width: 1000, height: 900 } });
  const erreurs = [];
  page.on('pageerror', (e) => erreurs.push(e.message));
  page.on('console', (m) => m.type() === 'error' && erreurs.push(m.text()));
  await avecCsp(page);
  await page.goto(`${BASE}/`);
  const jeu = page.locator('quetes-de-sysadmin');
  const saisie = jeu.locator('form input');
  for (const l of ['ssh royaume', 'yes', 'cat message.txt', 'cd Jetee', 'mv filet ~/Port/Hangar', 'cd ~']) {
    await saisie.fill(l);
    await saisie.press('Enter');
  }
  verifier(!(await jeu.locator('.touches').isVisible()), 'bureau : pas de barre de touches');
  // Ctrl-R : chercher « Jet », Entrée relance « cd Jetee ».
  await saisie.press('Control+r');
  await saisie.pressSequentially('Jet');
  verifier((await jeu.locator('.recherche').textContent()).includes('cd Jetee'), 'Ctrl-R trouve la commande dans l’historique');
  await saisie.press('Enter');
  verifier((await jeu.locator('.invite').textContent()).includes('Jetee'), 'Ctrl-R puis Entrée la relance');
  // Ctrl-C : la ligne est abandonnée.
  await saisie.fill('rm -r tout');
  await saisie.press('Control+c');
  verifier((await saisie.inputValue()) === '' && (await jeu.locator('.sortie').textContent()).includes('rm -r tout^C'), 'Ctrl-C abandonne la ligne');
  // La mission : objectif, consignes, et le filet déplacé dans « ce qui s'est passé ».
  await jeu.locator('.bouton-mission').click();
  const mission = jeu.locator('dialog.fenetre-mission');
  verifier((await mission.locator('h2').textContent()).includes('Chapitre 1'), 'la mission donne le chapitre');
  verifier((await mission.locator('.mission-journal li').count()) >= 1, 'la mission relit ce qui s’est passé');
  await page.keyboard.press('Escape');
  verifier(erreurs.length === 0, `mission : aucune erreur console ${erreurs.join(' ')}`);
  await page.close();

  const telephone = await navigateur.newContext({ viewport: { width: 375, height: 800 }, isMobile: true, hasTouch: true });
  const mobile = await telephone.newPage();
  await avecCsp(mobile);
  await mobile.goto(`${BASE}/`);
  const jeuMobile = mobile.locator('quetes-de-sysadmin');
  verifier(await jeuMobile.locator('.touches').isVisible(), 'téléphone : la barre de touches est là');
  const ligne = jeuMobile.locator('form input');
  await ligne.fill('ls -a ~/.s');
  await jeuMobile.locator('.touches button[data-touche="Tab"]').tap();
  verifier((await ligne.inputValue()) === 'ls -a ~/.ssh/', 'téléphone : Tab complète');
  await jeuMobile.locator('.touches button[data-touche="|"]').tap();
  verifier((await ligne.inputValue()).endsWith('|'), 'téléphone : | s’insère dans la ligne');
  verifier(!(await mobile.evaluate(() => document.documentElement.scrollWidth > innerWidth)), 'téléphone : pas de défilement horizontal');
  await telephone.close();
}

// Les succès : annoncés dans le terminal, comptés sur le lien, listés avec le grade.
{
  const page = await navigateur.newPage({ viewport: { width: 1000, height: 900 } });
  const erreurs = [];
  page.on('pageerror', (e) => erreurs.push(e.message));
  page.on('console', (m) => m.type() === 'error' && erreurs.push(m.text()));
  await avecCsp(page);
  await page.goto(`${BASE}/`);
  const jeu = page.locator('quetes-de-sysadmin');
  for (const l of ['ls -a ~/.ssh', 'xyzzy']) {
    await jeu.locator('form input').fill(l);
    await jeu.locator('form input').press('Enter');
  }
  const sortie = await jeu.locator('.sortie').textContent();
  verifier(sortie.includes('Succès : Ce qui est caché') && sortie.includes('Succès : Mot magique'), 'succès : annoncés dans le terminal');
  const lien = jeu.locator('.astuces button', { hasText: 'Succès' });
  verifier(/Succès \(\d+\/\d+\)/.test(await lien.textContent()), `succès : le compte sur le lien (${await lien.textContent()})`);
  await lien.click();
  const fenetre = jeu.locator('dialog.fenetre-succes');
  verifier((await fenetre.locator('.succes-grade').textContent()).includes('Stagiaire'), 'succès : le grade');
  verifier((await fenetre.locator('.obtenu').count()) === 3 && (await fenetre.textContent()).includes('Succès caché'), 'succès : obtenus et cachés dans la liste');
  if (process.env.CAPTURES) await page.screenshot({ path: `${process.env.CAPTURES}/succes-1000.png` });
  await page.keyboard.press('Escape');
  verifier(erreurs.length === 0, `succès : aucune erreur console ${erreurs.join(' ')}`);
  await page.close();
}

// Les indices gradués : le manuel, puis une piste, puis presque la réponse ;
// le débrief les compte ; rien en mode examen.
{
  const page = await navigateur.newPage({ viewport: { width: 1000, height: 900 } });
  const erreurs = [];
  page.on('pageerror', (e) => erreurs.push(e.message));
  page.on('console', (m) => m.type() === 'error' && erreurs.push(m.text()));
  await avecCsp(page);
  await page.goto(`${BASE}/`);
  const jeu = page.locator('quetes-de-sysadmin');
  const taper = async (l) => {
    await jeu.locator('form input').fill(l);
    await jeu.locator('form input').press('Enter');
  };
  for (const l of ['ssh royaume', 'yes']) await taper(l);
  const mission = jeu.locator('dialog.fenetre-mission');
  await jeu.locator('.bouton-mission').click();
  const bouton = (n) => mission.locator(`[data-niveau="${n}"]`);
  verifier((await bouton('manuel').isVisible()) && !(await bouton('piste').isVisible()), 'indices : le manuel d’abord');
  await bouton('manuel').click();
  verifier((await mission.locator('.indice-texte').textContent()).includes('man mv'), 'indices : les pages du manuel');
  await bouton('piste').click();
  await bouton('solution').click();
  verifier((await mission.locator('.indice-texte').textContent()).includes('mv crabe Seau'), 'indices : presque la réponse, pour l’étape en cours');
  await page.keyboard.press('Escape');
  // L'instantané de secours : pris après le filet, puis l'ampoule mal rangée, et on revient.
  await taper('mv Jetee/filet Port/Hangar');
  await jeu.locator('.bouton-mission').click();
  await mission.locator('.bouton-secours', { hasText: 'Prendre un instantané' }).click();
  verifier((await mission.locator('.secours-etat').textContent()).includes('après une saisie'), 'instantané : pris');
  await page.keyboard.press('Escape');
  await taper('mv Port/Remise/.ampoule_de_secours Port/Hangar');
  await jeu.locator('.bouton-mission').click();
  await mission.locator('.bouton-secours', { hasText: 'Revenir' }).click();
  verifier(!(await mission.evaluate((d) => d.open)) && (await jeu.locator('.sortie').textContent()).includes('Machine remise comme après la première saisie'), 'instantané : la machine est remise');
  await taper('ls -a Port/Remise');
  verifier((await jeu.locator('.sortie').textContent()).split('ls -a Port/Remise')[1]?.includes('.ampoule_de_secours'), 'instantané : l’ampoule est revenue à sa place');
  await taper('mv Port/Remise/.ampoule_de_secours Jetee/Phare/Escalier/Lanterne/ampoule');
  verifier((await jeu.locator('.sortie .bilan').textContent()).includes('3 indices'), 'indices : le bilan les compte (même après un instantané)');
  // En mode examen : pas d'aide.
  await jeu.locator('.examen input').check();
  await jeu.locator('.bouton-mission').click();
  verifier(!(await mission.locator('.aide').isVisible()), 'indices : rien en mode examen');
  await page.keyboard.press('Escape');
  verifier(erreurs.length === 0, `indices : aucune erreur console ${erreurs.join(' ')}`);
  await page.close();
}

// Le tableau de classe : deux fichiers d'élèves et un code, lus dans le
// navigateur ; le CSV téléchargé neutralise un nom piégé.
for (const largeur of [1000, 375]) {
  const page = await navigateur.newPage({ viewport: { width: largeur, height: 900 } });
  const erreurs = [];
  page.on('pageerror', (e) => erreurs.push(e.message));
  page.on('console', (m) => m.type() === 'error' && erreurs.push(m.text()));
  await avecCsp(page);
  await page.goto(`${BASE}/enseignants/`);
  await page.locator('a[href="/enseignants/classe/"]').click();
  await page.waitForURL(/\/enseignants\/classe\//);
  const fichier = (nom, sauvegarde) => ({
    name: nom,
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify({ format: 'quetes-de-sysadmin', version: 1, date: '2027-01-15T10:00:00Z', sauvegarde })),
  });
  await page.locator('#classe input[type="file"]').setInputFiles([
    fichier('lina.json', { termines: ['eveil', 'bourg', 'racine', 'sauvegarde', 'cles'], nom: 'Lina', succes: { tube: 'x' }, records: { eveil: 61000 } }),
    fichier('piege.json', { termines: ['eveil'], nom: '=1+1' }),
  ]);
  await page.locator('#classe textarea').fill('Nour QDS-041H-R');
  await page.locator('#classe button', { hasText: 'Ajouter les codes' }).click();
  await page.waitForFunction(() => document.querySelectorAll('#classe tbody tr').length >= 3);
  const lignes = await page.locator('#classe tbody tr').count();
  verifier(lignes === 3, `classe ${largeur} px : une ligne par élève (${lignes})`);
  verifier((await page.locator('#classe tbody').textContent()).includes('Lina') && (await page.locator('#classe tbody').textContent()).includes('Admin junior'), `classe ${largeur} px : chapitres et grade`);
  const [telechargement] = await Promise.all([page.waitForEvent('download'), page.locator('#classe button', { hasText: 'CSV' }).click()]);
  const csv = readFileSync(await telechargement.path(), 'utf8');
  verifier(csv.includes("'=1+1") && csv.includes('Lina;5/'), `classe ${largeur} px : le CSV, sans formule`);
  verifier(!(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)), `classe ${largeur} px : pas de défilement horizontal de la page`);
  if (process.env.CAPTURES) await page.screenshot({ path: `${process.env.CAPTURES}/classe-${largeur}.png` });
  verifier(erreurs.length === 0, `classe ${largeur} px : aucune erreur console ${erreurs.join(' ')}`);
  await page.close();
}

// L'affichage : thème du terminal, taille, plein écran, gardés dans le
// navigateur ; la mise en scène d'une connexion.
for (const largeur of [1000, 375]) {
  const page = await navigateur.newPage({ viewport: { width: largeur, height: 800 } });
  const erreurs = [];
  page.on('pageerror', (e) => erreurs.push(e.message));
  page.on('console', (m) => m.type() === 'error' && erreurs.push(m.text()));
  await avecCsp(page);
  await page.goto(`${BASE}/`);
  const jeu = page.locator('quetes-de-sysadmin');
  const terminal = jeu.locator('.terminal');
  // Le menu : la carte du réseau d'abord, une branche par machine.
  const menu = jeu.locator('nav.histoires');
  verifier((await menu.getAttribute('data-vue')) === 'reseau' && (await jeu.locator('.hote', { hasText: 'royaume.internal 192.0.2.10' }).isVisible()), `affichage ${largeur} px : la carte du réseau sert de menu`);
  await jeu.locator('.choix-vue button', { hasText: 'Baies' }).click();
  verifier((await menu.getAttribute('data-vue')) === 'baies' && !(await jeu.locator('.hote').first().isVisible()), `affichage ${largeur} px : la vue en baies`);
  await jeu.locator('.choix-vue button', { hasText: 'Carte du réseau' }).click();
  await jeu.locator('.choix-vue button', { hasText: 'Baies' }).click();
  await jeu.locator('.reglages select').selectOption('ambre');
  const taille = () => terminal.evaluate((e) => parseFloat(getComputedStyle(e).fontSize));
  const avant = await taille();
  await jeu.locator('.reglages button', { hasText: 'A+' }).click();
  verifier((await terminal.getAttribute('data-theme')) === 'ambre' && (await taille()) > avant, `affichage ${largeur} px : thème et taille`);
  // La coloration de la ligne : la faute de frappe se voit avant Entrée ; la copie colorée est sous le champ.
  await jeu.locator('form input').pressSequentially('lss');
  verifier((await jeu.locator('.coloration .c-inconnue').textContent()) === 'lss', `affichage ${largeur} px : une commande inconnue est colorée`);
  await jeu.locator('form input').fill('');
  await jeu.locator('form input').pressSequentially('ls -a');
  const [champ, copie] = await Promise.all([jeu.locator('form input').boundingBox(), jeu.locator('.coloration').boundingBox()]);
  verifier(
    (await jeu.locator('.coloration .c-commande').textContent()) === 'ls' && (await jeu.locator('.coloration .c-option').textContent()) === '-a' && Math.abs(champ.x - copie.x) < 1 && Math.abs(champ.y - copie.y) < 1,
    `affichage ${largeur} px : commande et option colorées, sous le champ`,
  );
  // Les espaces entre les mots colorés restent (la copie a la largeur du texte du champ).
  await jeu.locator('form input').pressSequentially(' | cat');
  const largeurs = await jeu.locator('.champ').evaluate((c) => {
    const i = c.querySelector('input');
    const mesure = document.createElement('span');
    mesure.style.cssText = 'position:absolute;white-space:pre;font:inherit;visibility:hidden';
    mesure.textContent = i.value;
    c.append(mesure);
    const r = document.createRange();
    r.selectNodeContents(c.querySelector('.coloration'));
    const l = [mesure.getBoundingClientRect().width, r.getBoundingClientRect().width];
    mesure.remove();
    return l;
  });
  verifier(Math.abs(largeurs[0] - largeurs[1]) < 2, `affichage ${largeur} px : la copie colorée garde les espaces (${largeurs})`);
  await jeu.locator('form input').press('Enter');
  // ls colore les lieux à l'écran (.ssh), et garde le / ; dans le tube vers cat, rien.
  await jeu.locator('form input').fill('ls -a');
  await jeu.locator('form input').press('Enter');
  verifier((await jeu.locator('.sortie pre:not(.cmd)').last().locator('.a-34', { hasText: '.ssh' }).count()) === 1 && (await jeu.locator('.sortie pre:not(.cmd)').last().textContent()).includes('.ssh/'), `affichage ${largeur} px : ls colore les lieux`);
  verifier((await jeu.locator('.sortie .cmd .c-commande').nth(-2).textContent()) === 'cat', `affichage ${largeur} px : la commande reste colorée au-dessus de sa sortie`);
  await jeu.locator('form input').fill('ssh royaume');
  await jeu.locator('form input').press('Enter');
  await jeu.locator('form input').pressSequentially('yes');
  verifier(!(await jeu.locator('.champ').evaluate((e) => e.classList.contains('colore'))), `affichage ${largeur} px : une réponse (yes/no) n'est pas colorée`);
  await jeu.locator('form input').fill('yes');
  await jeu.locator('form input').press('Enter');
  verifier(await terminal.evaluate((e) => e.classList.contains('scene-connexion')), `affichage ${largeur} px : la connexion est mise en scène`);
  verifier((await jeu.locator('li:has(> button[data-histoire="0"])').getAttribute('data-etat')) === 'en-cours', `affichage ${largeur} px : la machine où l'on joue s'allume sur la carte`);
  await jeu.locator('.reglages button', { hasText: 'Couleurs' }).click();
  await jeu.locator('form input').pressSequentially('ls -a');
  verifier(!(await jeu.locator('.champ').evaluate((e) => e.classList.contains('colore'))) && (await jeu.locator('form input').evaluate((e) => getComputedStyle(e).color)) !== 'rgba(0, 0, 0, 0)', `affichage ${largeur} px : la coloration se coupe`);
  await jeu.locator('form input').press('Enter');
  verifier((await jeu.locator('.sortie pre:not(.cmd)').last().locator('[class^="a-"]').count()) === 0, `affichage ${largeur} px : les sorties aussi, sans couleur`);
  await jeu.locator('.reglages button', { hasText: 'Plein écran' }).click();
  const boite = await terminal.boundingBox();
  verifier(boite.width > largeur - 40 && boite.height > 600, `affichage ${largeur} px : plein écran`);
  await jeu.locator('form input').press('Escape');
  verifier(!(await jeu.locator('.ecran').evaluate((e) => e.classList.contains('focus'))), `affichage ${largeur} px : Échap quitte le plein écran`);
  await page.reload();
  verifier((await jeu.locator('.terminal').getAttribute('data-theme')) === 'ambre' && (await menu.getAttribute('data-vue')) === 'baies', `affichage ${largeur} px : les réglages sont gardés`);
  verifier(!(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)), `affichage ${largeur} px : pas de défilement horizontal`);
  if (process.env.CAPTURES) await page.screenshot({ path: `${process.env.CAPTURES}/affichage-${largeur}.png` });
  verifier(erreurs.length === 0, `affichage ${largeur} px : aucune erreur console ${erreurs.join(' ')}`);
  await page.close();
}

// Les parcours : une troisième vue du menu ; un thème, ses chapitres, le prochain à faire.
for (const largeur of [1000, 375]) {
  const page = await navigateur.newPage({ viewport: { width: largeur, height: 900 } });
  const erreurs = [];
  page.on('pageerror', (e) => erreurs.push(e.message));
  page.on('console', (m) => m.type() === 'error' && erreurs.push(m.text()));
  await avecCsp(page);
  await page.goto(`${BASE}/`);
  await page.evaluate(() => localStorage.setItem('quetes-de-sysadmin', JSON.stringify({ termines: ['eveil', 'bourg', 'racine', 'sauvegarde', 'fermer-la-porte'] })));
  await page.reload();
  const jeu = page.locator('quetes-de-sysadmin');
  await jeu.locator('.choix-vue button', { hasText: 'Parcours' }).click();
  await jeu.locator('.parcours select').selectOption('securite');
  const cartes = jeu.locator('.parcours-liste button');
  verifier((await cartes.count()) === 14 && (await jeu.locator('.parcours-avancee').textContent()).includes('1 sur 14'), `parcours ${largeur} px : le parcours et son avancée`);
  const prochain = jeu.locator('.parcours-liste button[data-prochain]');
  verifier((await prochain.textContent()).includes('Le pare-feu') && (await jeu.locator('.parcours-liste button[data-etat="verrouille"]').first().textContent()).includes('D\'abord'), `parcours ${largeur} px : le prochain, et ce qui attend`);
  await prochain.click();
  verifier((await jeu.locator('.invite').textContent()).startsWith('vous@lettres'), `parcours ${largeur} px : le prochain chapitre s’ouvre`);
  await page.reload();
  verifier((await jeu.locator('nav.histoires').getAttribute('data-vue')) === 'parcours' && (await jeu.locator('.parcours select').inputValue()) === 'securite', `parcours ${largeur} px : la vue et le parcours sont gardés`);
  verifier(!(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)), `parcours ${largeur} px : pas de défilement horizontal`);
  verifier(erreurs.length === 0, `parcours ${largeur} px : aucune erreur console ${erreurs.join(' ')}`);
  await page.evaluate(() => localStorage.clear());
  await page.close();
}

// L'astreinte : l'incident du jour (date fixée : le 18 février 2027, « Premier jour »),
// le budget qui fond, la carte de score à la fin, le résultat gardé.
for (const largeur of [1000, 375]) {
  const page = await navigateur.newPage({ viewport: { width: largeur, height: 900 } });
  const erreurs = [];
  page.on('pageerror', (e) => erreurs.push(e.message));
  page.on('console', (m) => m.type() === 'error' && erreurs.push(m.text()));
  await page.clock.install({ time: new Date('2027-02-18T10:00:00') });
  await avecCsp(page);
  await page.goto(`${BASE}/`);
  await page.evaluate(() => localStorage.setItem('quetes-de-sysadmin', JSON.stringify({ termines: ['eveil', 'bourg', 'racine', 'sauvegarde'] })));
  await page.reload();
  const jeu = page.locator('quetes-de-sysadmin');
  verifier((await jeu.locator('.incident-texte').textContent()).includes('Premier jour'), `astreinte ${largeur} px : l’incident du jour est annoncé`);
  await jeu.locator('.bouton-incident').click();
  const fenetre = jeu.locator('dialog.fenetre-astreinte').first();
  verifier((await fenetre.evaluate((d) => d.open)) && (await fenetre.textContent()).includes('18 février 2027'), `astreinte ${largeur} px : la fenêtre de l’astreinte`);
  await fenetre.locator('button', { hasText: 'Prendre l' }).click();
  verifier((await jeu.locator('.invite').textContent()).startsWith('vous@datacenter'), `astreinte ${largeur} px : l’incident s’ouvre`);
  verifier((await jeu.locator('.jauge-astreinte').textContent()).includes('30:00 (100 %)'), `astreinte ${largeur} px : le budget est plein`);
  await page.clock.runFor(60_000);
  verifier((await jeu.locator('.jauge-astreinte').textContent()).includes('29:00'), `astreinte ${largeur} px : le budget fond avec le temps`);
  const L = '/var/log/nginx/access.log';
  for (const l of ['commande-inconnue', 'sudo kill 4242', 'bienvenue-2026', 'echo "deny 198.51.100.77;" | sudo tee -a /etc/nginx/bloques.conf', 'sudo systemctl reload nginx', 'sudo kill 4244', `grep " 503 " ${L} | wc -l > ~/rapport.txt`, 'echo "Coupable : 198.51.100.77" >> rapport.txt']) {
    await jeu.locator('form input').fill(l);
    await jeu.locator('form input').press('Enter');
  }
  const fin = jeu.locator('dialog.fenetre-astreinte').last();
  verifier(await fin.evaluate((d) => d.open), `astreinte ${largeur} px : la carte de score s’ouvre à la fin`);
  const carte = await fin.locator('.carte-score').textContent();
  verifier(carte.includes('astreinte du 2027-02-18') && carte.includes('« Premier jour »') && /[🟩🟨⬜]{5} \d+ % du budget/.test(carte) && carte.includes('une erreur'), `astreinte ${largeur} px : la carte de score`);
  const boite = await fin.boundingBox();
  verifier(boite.x >= 0 && boite.x + boite.width <= largeur, `astreinte ${largeur} px : la fenêtre tient dans l’écran`);
  await page.keyboard.press('Escape');
  verifier((await jeu.locator('.jauge-astreinte').isHidden()) && (await jeu.locator('.incident-texte').textContent()).includes('Fait aujourd’hui') || (await jeu.locator('.incident-texte').textContent()).includes("Fait aujourd'hui"), `astreinte ${largeur} px : le résultat du jour est gardé`);
  verifier(!(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)), `astreinte ${largeur} px : pas de défilement horizontal`);
  verifier(erreurs.length === 0, `astreinte ${largeur} px : aucune erreur console ${erreurs.join(' ')}`);
  await page.evaluate(() => localStorage.clear());
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
