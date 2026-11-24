// Check in Chromium: the standalone page and the game embedded in another
// page, at 1000 and 375 px wide, with no console error or overflow,
// no third-party resource, under the security policy (CSP) of public/.htaccess.
// Run after "npm run build":
//   npm run preview &   then   npm run test:browser
// CHROMIUM variable: path to the browser (by default the development
// environment's, /opt/pw-browsers/chromium, otherwise Playwright's).

import { existsSync, readFileSync } from 'node:fs';
import { chromium } from 'playwright';

const BASE = process.env.BASE ?? 'http://localhost:4340';
const CHROMIUM = process.env.CHROMIUM ?? '/opt/pw-browsers/chromium';
const browser = await chromium.launch({
  executablePath: existsSync(CHROMIUM) ? CHROMIUM : undefined,
  args: ['--headless=new'],
});
// The site registers a service worker (src/pwa/): requests it answers would
// escape page.route, and so the CSP added below. Pages and contexts block it,
// except in the tests about it (serviceWorkers: 'allow').
const newContext = browser.newContext.bind(browser);
const newPage = browser.newPage.bind(browser);
// The element shows an empty frame, then the game once it has fetched its
// chunks (src/element.ts), and waits for a story's while it loads: after a
// navigation, the page's game is waited for, ready to type in.
const READY = () => {
  const host = document.querySelector('quetes-de-sysadmin');
  if (!host) return true;
  const root = host.shadowRoot;
  return !host.hasAttribute('aria-busy') && !!root?.querySelector('.qds .output pre') && !root.querySelector('.qds[aria-busy]');
};
// Polled from Node: works under page.clock too.
const waitReady = async (page) => {
  for (let i = 0; i < 300 && !(await page.evaluate(READY).catch(() => true)); i++) await new Promise((r) => setTimeout(r, 100));
};
const settled = (page) => {
  for (const name of ['goto', 'reload']) {
    const original = page[name].bind(page);
    page[name] = async (...args) => {
      const response = await original(...args);
      await waitReady(page);
      return response;
    };
  }
  return page;
};
browser.newContext = async (options = {}) => {
  const context = await newContext({ serviceWorkers: 'block', ...options });
  const contextPage = context.newPage.bind(context);
  context.newPage = async () => settled(await contextPage());
  return context;
};
browser.newPage = async (options = {}) => settled(await newPage({ serviceWorkers: 'block', ...options }));

// The preview server doesn't read .htaccess: we add ourselves the CSP
// header Apache will send, so that a violation fails the test.
const CSP = readFileSync('public/.htaccess', 'utf8').match(/Content-Security-Policy "([^"]+)"/)[1];
// Every page gets the site's CSP; the intro tour (a first visit's bubbles) is
// marked as seen, except where the test is about it (tour: true).
const withCsp = async (page, { tour = false } = {}) => {
  if (!tour)
    await page.addInitScript(() => {
      try {
        const key = 'quetes-de-sysadmin-display';
        localStorage.setItem(key, JSON.stringify({ ...JSON.parse(localStorage.getItem(key) ?? '{}'), tour: 'done' }));
      } catch {}
    });
  await page.route(`${BASE}/**`, async (route) => {
    // A chunk still loading in the background (the manual's pages) when the page closes: nothing to answer.
    try {
      const response = await route.fetch();
      await route.fulfill({ response: response, headers: { ...response.headers(), 'content-security-policy': CSP } });
    } catch {}
  });
};
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
  await withCsp(page, { tour: true });
  await page.goto(`${BASE}/fr/`);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  const game = page.locator('quetes-de-sysadmin');
  const input = game.locator('form input');
  const tape = async (c) => {
    await input.fill(c);
    await input.press('Enter');
  };
  check((await game.locator('.output').textContent()).includes('Bienvenue sur ton poste'), `${width} px: starting from the workstation`);
  // A first visit: the intro tour points at the real interface, one bubble at a time, then goes away for good.
  const tour = game.locator('.tour');
  await tour.waitFor({ state: 'visible', timeout: 3000 }).catch(() => {});
  check(await tour.isVisible(), `${width} px: the intro tour starts on a first visit`);
  const tourBox = await tour.boundingBox();
  check(tourBox && tourBox.x >= 0 && tourBox.x + tourBox.width <= width, `${width} px: the tour's bubble fits on the screen`);
  check((await game.locator('.tour-target').count()) === 1, `${width} px: the tour outlines what it points at`);
  for (let i = 0; i < 4; i++) await tour.locator('.button').click();
  check((await tour.textContent()).includes('Tab'), `${width} px: the tour's fifth step is about Tab`);
  await tour.locator('.button').click();
  // Its last step points at "Where do I start?": the first visit's card (see start-here.ts).
  check((await tour.textContent()).includes('par où commencer') && (await game.locator('.start-offer .tour-target').count()) === 1, `${width} px: the tour's last step points at the first visit's offer`);
  await tour.locator('.button').click();
  check(await tour.isHidden(), `${width} px: the tour ends`);
  // The toolbar: Mission, Map, Notebook, as icons with labels (hidden on a narrow screen, still named).
  check((await game.locator('.notebook-button').getAttribute('aria-haspopup')) === 'dialog' && (await game.locator('.notebook-button').textContent()).includes('Carnet'), `${width} px: the notebook has its button`);
  check(await game.locator('button[data-story="1"]').isDisabled(), `${width} px: without its key, the Datacenter is locked`);
  check(await game.locator('.incident').isHidden(), `${width} px: no chapter open for an incident yet, the button is hidden`);
  await input.fill('ssh roy');
  await input.press('Tab');
  check((await input.inputValue()) === 'ssh royaume ', `${width} px: Tab completes the machine name`);
  await input.press('Enter');
  check((await game.locator('.prompt').textContent()).startsWith('Are you sure'), `${width} px: ssh asks to confirm the fingerprint`);
  await tape('yes');
  check((await game.locator('.prompt').textContent()) === 'vous@royaume:~$', `${width} px: connected to kingdom`);
  check((await game.locator('.output').textContent()).includes('L’Effaceur — chapitre 1'), `${width} px: chapter 1 opens`);
  await tape('man ls');
  check((await game.locator('.output').textContent()).includes('VOIR AUSSI'), `${width} px: man ls is displayed`);
  // Regression: the up arrow browses THIS machine's history (like the
  // `history` command), not every line typed in the game. 'ssh royaume' was
  // typed on the workstation, so pressing Up here must never bring it back.
  await input.focus();
  const recalled = [];
  for (let i = 0; i < 6; i++) {
    await input.press('ArrowUp');
    recalled.push(await input.inputValue());
  }
  check(recalled[0] === 'man ls', `${width} px: the up arrow recalls this machine's last command`);
  check(!recalled.includes('ssh royaume'), `${width} px: the up arrow ignores the workstation's history`);
  await input.fill('');
  // Every group of commands is in the bundle (a module loaded too early used to leave some out).
  for (const c of ['mount', 'unattended-upgrade', 'exportfs', 'smbclient', 'gpg', 'netstat', 'killall', 'iptables', 'sed', 'stat', 'pkg', 'pfctl', 'sockstat', 'svcs', 'zfs', 'iconv', 'file', 'cobc', 'dd', 'xxd', 'od', 'hexdump', 'tn5250', 'system', 'db2', 'DSPMSG', 'SAVLIB', 'dos2unix', 'tr', 'Get-Help', 'promtool', 'amtool', 'jq', 'lpstat', 'lpadmin', 'forgejo', 'virsh', 'qemu-img', 'haproxy', 'socat', 'tcpdump', 'openssl', 'kubectl', 'k3s', 'base64', 'garage', 'aws', 'rclone', 'tofu']) {
    await tape(`man ${c}`);
    check((await game.locator('.output').textContent()).includes(`${c.toUpperCase()}(`), `${width} px: man ${c} is displayed (the command is in the bundle)`);
  }
  // The error explainer: a button under a failed command, which unfolds a short explanation (see explainer.ts).
  const explainers = game.locator('.output .explainer');
  await tape('cat nulle-part.txt');
  const explainerButton = explainers.last().locator('button');
  check((await explainers.count()) === 1 && (await explainerButton.textContent()) === 'Que veut dire cette erreur ?', `${width} px: a failed cat offers its explanation`);
  check((await explainerButton.getAttribute('aria-expanded')) === 'false' && (await explainers.last().locator('.explanation').isHidden()), `${width} px: the explanation starts folded`);
  await explainerButton.focus();
  check(await explainerButton.evaluate((b) => b.getRootNode().activeElement === b), `${width} px: the explainer's button takes the focus`);
  await explainerButton.press('Enter');
  const explanation = explainers.last().locator('.explanation');
  check(
    (await explainerButton.getAttribute('aria-expanded')) === 'true' && (await explanation.isVisible()) && (await explanation.textContent()).includes('pwd') && (await explanation.getAttribute('aria-live')) === 'polite',
    `${width} px: Enter unfolds the explanation, announced politely`,
  );
  check(await explainerButton.evaluate((b) => b.getRootNode().activeElement === b), `${width} px: the focus stays on the button after Enter`);
  const explained = await explanation.boundingBox();
  check(explained && explained.x >= 0 && explained.x + explained.width <= width, `${width} px: the explanation fits on the screen`);
  if (process.env.CAPTURES) await game.locator('.terminal').screenshot({ path: `${process.env.CAPTURES}/explainer-${width}.png` });
  await explainerButton.press('Enter');
  check((await explanation.isHidden()) && (await explanation.textContent()) === '', `${width} px: Enter folds it again`);
  await input.focus();
  await tape('ls');
  check((await explainers.count()) === 1, `${width} px: no explanation offered after a command that succeeds`);
  const explainerSetting = game.locator('.setting-button', { hasText: 'Aide aux erreurs' });
  await explainerSetting.click();
  await tape('cat nulle-part.txt');
  check((await explainerSetting.getAttribute('aria-pressed')) === 'false' && (await explainers.count()) === 1, `${width} px: the explainer turned off offers nothing`);
  await explainerSetting.click();
  await tape('mv Jetee/filet Port/Hangar');
  check((await game.locator('.output .tip').count()) === 0, `${width} px: no tip when the story already answers`);
  await tape('mv Port/Hangar/filet Port');
  check((await game.locator('.output .tip').last().textContent()).includes('ne dit en général rien'), `${width} px: a silent mv earns the "silence means success" tip`);
  check(await game.locator('.notebook-button.fresh').count() === 1, `${width} px: the notebook button shows new commands`);
  await tape('cd Port/Remise');
  await input.fill('mv .a');
  await input.press('Tab');
  check((await input.inputValue()) === 'mv .ampoule_de_secours ', `${width} px: Tab completes`);
  await input.fill('mv .ampoule_de_secours ~/Jetee/Phare/Escalier/Lanterne/ampoule');
  await input.press('Enter');
  check(await game.locator('.end').isVisible(), `${width} px: end of chapter 1, "Next chapter" button`);
  // The summary: one line in the terminal, the details in a dialog.
  check(/Bilan : \d+:\d\d · \d+ commandes/.test(await game.locator('.output .summary').textContent()), `${width} px: the chapter summary is displayed`);
  await game.locator('.summary-button').click();
  const summaryWindow = game.locator('dialog.summary-window');
  check(
    (await summaryWindow.evaluate((d) => d.open)) && (await summaryWindow.locator('tbody code', { hasText: 'mv .ampoule_de_secours' }).count()) === 1,
    `${width} px: the summary details show the step's command`,
  );
  const summaryBox = await summaryWindow.boundingBox();
  check(summaryBox.x >= 0 && summaryBox.x + summaryBox.width <= width, `${width} px: the summary dialog fits on the screen`);
  await page.keyboard.press('Escape');
  await game.locator('.end button').click();
  check((await game.locator('.output').textContent()).includes('chapitre 2'), `${width} px: chapter 2 open`);
  await page.reload();
  check((await game.locator('.output').textContent()).includes('chapitre 2'), `${width} px: resumed after reload`);
  await tape('exit');
  check((await game.locator('.output').textContent()).includes('Connection to royaume.internal closed.'), `${width} px: exit goes back to the workstation`);
  await tape('ssh royaume');
  check((await game.locator('.prompt').textContent()) === 'vous@royaume:~$', `${width} px: known host kept, no new question`);
  // nano: keyboard (Ctrl+O, Ctrl+X) on a wide screen, buttons on mobile.
  await tape('exit');
  await tape('nano notes.txt');
  const nano = game.locator('.nano');
  check(await nano.isVisible(), `${width} px: nano opens`);
  check(await game.locator('form').isHidden(), `${width} px: the command line makes room for nano`);
  await game.locator('.nano-text').fill('Bonjour depuis nano\n');
  if (width > 500) await game.locator('.nano-text').press('Control+o');
  else await game.locator('.nano-key', { hasText: '^O' }).click();
  check((await game.locator('.nano-status').textContent()) === '[ 1 ligne écrite ]', `${width} px: ^O writes the file`);
  await game.locator('.nano-text').fill('Bonjour depuis nano\nencore\n');
  if (width > 500) await game.locator('.nano-text').press('Control+x');
  else await game.locator('.nano-key', { hasText: '^X' }).click();
  check((await game.locator('.nano-status').textContent()).includes('Sauver le tampon modifié'), `${width} px: ^X asks whether to save`);
  if (width > 500) await page.keyboard.press('o');
  else await game.locator('.nano-key', { hasText: 'Oui' }).click();
  check(!(await nano.isVisible()) && (await input.isVisible()), `${width} px: nano closes`);
  await tape('cat notes.txt');
  check((await game.locator('.output').textContent()).includes('Bonjour depuis nano\nencore'), `${width} px: the file is written`);
  // The sysadmin's notebook: the commands run, with their manual line; it survives a reload.
  const notebook = game.locator('dialog.notebook');
  await game.locator('.notebook-button').click();
  check(await notebook.evaluate((d) => d.open), `${width} px: the notebook opens from its button`);
  check((await notebook.locator('dt').allTextContents()).includes('nano'), `${width} px: nano is in the notebook`);
  check((await notebook.locator('h2').textContent()).match(/\(\d+ commandes\)/), `${width} px: the notebook counts its commands`);
  check((await notebook.locator('.shortcuts kbd').allTextContents()).includes('Tab'), `${width} px: the notebook starts with the shortcuts`);
  const notebookBox = await notebook.boundingBox();
  check(notebookBox.x >= 0 && notebookBox.x + notebookBox.width <= width, `${width} px: the notebook fits on the screen`);
  const [download] = await Promise.all([page.waitForEvent('download'), notebook.locator('.notebook-actions button').first().click()]);
  check(download.suggestedFilename() === 'carnet-du-sysadmin.md', `${width} px: the notebook downloads as Markdown`);
  await page.keyboard.press('Escape');
  await page.reload();
  await game.locator('.notebook-button').click();
  check((await game.locator('dialog.notebook dt').allTextContents()).includes('nano'), `${width} px: the notebook is kept in the browser`);
  check(await game.locator('.tour').isHidden(), `${width} px: the tour doesn't come back after a reload`);
  await page.keyboard.press('Escape');
  // The map: a button opens the dialog, with where you are; Escape closes it.
  await game.locator('.map-button').click();
  const window = game.locator('dialog.map-window');
  check(await window.evaluate((d) => d.open), `${width} px: the map opens`);
  check((await window.locator('[aria-current="location"]').count()) === 1 && (await window.textContent()).includes('tu es ici'), `${width} px: the map shows where you are`);
  const box = await window.boundingBox();
  check(box.x >= 0 && box.x + box.width <= width, `${width} px: the map fits on the screen`);
  if (process.env.CAPTURES) await page.screenshot({ path: `${process.env.CAPTURES}/carte-${width}.png` });
  await page.keyboard.press('Escape');
  check(!(await window.evaluate((d) => d.open)), `${width} px: Escape closes the map`);
  // The browser first gives focus back to the button, then the game to the input: wait up to one second.
  const reprise = await input.evaluate(
    (i) =>
      new Promise((ok) => {
        const end = Date.now() + 1000;
        const see = () => (i.getRootNode().activeElement === i ? ok(true) : Date.now() > end ? ok(false) : setTimeout(see, 20));
        see();
      }),
  );
  check(reprise, `${width} px: input resumes after the map`);
  // Exam mode: the checkbox under "For teachers" (the game's own is hidden
  // on the site) restarts the current chapter, the timer starts.
  check(!(await game.locator('.exam-choice').isVisible()), `${width} px: the game's exam checkbox is hidden on the site`);
  await tape('ssh royaume');
  // The questions under the game are folded: "For teachers" opened first.
  await page.locator('details:has(#exam-mode)').evaluate((d) => (d.open = true));
  await page.locator('#exam-mode').check();
  check((await game.locator('.output').textContent()).includes('Mode examen'), `${width} px: exam mode is announced`);
  await page.waitForTimeout(1100);
  check(/⏱ 00:0\d/.test(await game.locator('.timer').textContent()), `${width} px: the timer is running`);
  // The questions under the game are folded: "For teachers" opened first.
  await page.locator('details:has(#exam-mode)').evaluate((d) => (d.open = true));
  await page.locator('#exam-mode').uncheck();
  check((await game.locator('.timer').textContent()) === '', `${width} px: without exam, no more timer`);
  // A chapter in progress: exam mode would restart it, so we ask first.
  await tape('ls');
  // The questions under the game are folded: "For teachers" opened first.
  await page.locator('details:has(#exam-mode)').evaluate((d) => (d.open = true));
  await page.locator('#exam-mode').click();
  const confirmation = game.locator('dialog.exam-window');
  // The questions under the game are folded: "For teachers" opened first.
  await page.locator('details:has(#exam-mode)').evaluate((d) => (d.open = true));
  check((await confirmation.evaluate((d) => d.open)) && !(await page.locator('#exam-mode').isChecked()), `${width} px: exam mode asks for confirmation`);
  await confirmation.locator('button', { hasText: 'Annuler' }).click();
  // The questions under the game are folded: "For teachers" opened first.
  await page.locator('details:has(#exam-mode)').evaluate((d) => (d.open = true));
  check(!(await confirmation.evaluate((d) => d.open)) && !(await page.locator('#exam-mode').isChecked()) && (await game.locator('.timer').textContent()) === '', `${width} px: cancel changes nothing`);
  // The questions under the game are folded: "For teachers" opened first.
  await page.locator('details:has(#exam-mode)').evaluate((d) => (d.open = true));
  await page.locator('#exam-mode').click();
  await confirmation.locator('button', { hasText: 'mode examen' }).click();
  // The questions under the game are folded: "For teachers" opened first.
  await page.locator('details:has(#exam-mode)').evaluate((d) => (d.open = true));
  check((await page.locator('#exam-mode').isChecked()) && /⏱/.test(await game.locator('.timer').textContent()), `${width} px: confirmed, exam mode starts`);
  // The questions under the game are folded: "For teachers" opened first.
  await page.locator('details:has(#exam-mode)').evaluate((d) => (d.open = true));
  await page.locator('#exam-mode').uncheck();
  check(!(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)), `${width} px: no horizontal scrolling`);
  check(errors.length === 0, `${width} px: no console error ${errors.join(' ')}`);
  check(externes.length === 0, `${width} px: no third-party resource ${externes.join(' ')}`);
  if (process.env.CAPTURES) await page.screenshot({ path: `${process.env.CAPTURES}/jeu-${width}.png`, fullPage: true });
  // The sheets for teachers: a static page, generated at build time.
  await page.goto(`${BASE}/fr/enseignants/`);
  check((await page.locator('.sheet').count()) > 50, `${width} px: the teachers' sheets are there`);
  check((await page.locator('#c-bottleneck').textContent()).includes('iostat'), `${width} px: a sheet gives its new commands`);
  check(!(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)), `${width} px: sheets without horizontal scrolling`);
  check(errors.length === 0, `${width} px: sheets without console error ${errors.join(' ')}`);
  if (process.env.CAPTURES) await page.screenshot({ path: `${process.env.CAPTURES}/enseignants-${width}.png` });
  await page.close();
}

// "Where do I start?" (see start-here.ts): a first visit is offered the
// questions by a card (not a window); answered with the keyboard, they give a
// suggestion (no shortcut into a chapter: the first steps stay first); the menu's button opens them again
// with the answers kept; a returning player sees no card, and exam mode hides it all.
for (const width of [1000, 375]) {
  const page = await browser.newPage({ viewport: { width: width, height: 900 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  await withCsp(page);
  await page.goto(`${BASE}/fr/`);
  const game = page.locator('quetes-de-sysadmin');
  const offer = game.locator('.start-offer');
  check(await offer.isVisible(), `start ${width} px: a first visit is offered "Par où commencer ?"`);
  check((await game.locator('dialog[open]').count()) === 0, `start ${width} px: the offer is a card, not a window`);
  const answer = offer.locator('.button').first();
  await answer.focus();
  await page.keyboard.press('Enter');
  const window = game.locator('dialog.start-window');
  await game.locator('dialog.start-window[open]').waitFor({ timeout: 3000 }).catch(() => {});
  check(await window.evaluate((d) => d.open), `start ${width} px: the questions open from the keyboard`);
  check((await window.locator('fieldset legend').count()) === 4 && (await window.locator('.start-result').textContent()).includes('Réponds aux quatre questions'), `start ${width} px: four groups of choices, no suggestion before the answers`);
  // Every day, a job, security, about 10 minutes: Space on a group's first choice, the arrows for the others.
  await window.locator('input[type="radio"]').nth(2).focus();
  await page.keyboard.press('Space');
  await page.keyboard.press('Tab');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Tab');
  for (let i = 0; i < 4; i++) await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Tab');
  await page.keyboard.press('Space');
  const result = window.locator('.start-result');
  const text = await result.textContent();
  check(text.includes('Protéger un serveur') && text.includes('L’Île du Phare') && text.includes("Autres portes d'entrée"), `start ${width} px: the answers give a path, a chapter that opens now, and other ways in`);
  check(text.includes("s'ouvre après encore") && (await result.locator('.main .difficulty').count()) === 1, `start ${width} px: what opens the path's chapter, and the difficulty stars`);
  check((await window.locator('[role="status"]').textContent()).includes('Suggestion'), `start ${width} px: the suggestion is announced`);
  const box = await window.boundingBox();
  check(box.x >= 0 && box.x + box.width <= width, `start ${width} px: the questions fit on the screen`);
  if (width === 375) {
    await window.locator('input[type="radio"]').nth(6).focus();
    await page.keyboard.press('Space');
    check((await result.locator('.start-teachers a').getAttribute('href')).endsWith('/fr/enseignants/'), `start ${width} px: a teacher is pointed to the quest sheets`);
    await window.locator('input[type="radio"]').nth(5).focus();
    await page.keyboard.press('Space');
  }
  if (process.env.CAPTURES) await window.screenshot({ path: `${process.env.CAPTURES}/start-${width}.png` });
  check((await result.locator('button').count()) === 0, `start ${width} px: a suggestion, no shortcut into a chapter`);
  await page.keyboard.press('Escape');
  check(!(await window.evaluate((d) => d.open)), `start ${width} px: Escape closes the questions`);
  check(await offer.isHidden(), `start ${width} px: the card goes once answered`);
  check(!(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)), `start ${width} px: no horizontal scrolling`);
  // Back later: no card, the menu's button, the answers kept (a setting of this browser, not of the progress).
  await page.reload();
  check(await offer.isHidden(), `start ${width} px: no card after a reload`);
  await game.locator('.start-here-button').click();
  // Its texts load when it first opens (dialog-start-here.ftl).
  await window.locator('.start-result h3').waitFor({ timeout: 3000 }).catch(() => {});
  check((await window.locator('input[type="radio"]:checked').count()) === 4 && (await window.locator('.start-result').textContent()).includes('Protéger un serveur'), `start ${width} px: the menu's button opens the questions, answers kept`);
  await page.keyboard.press('Escape');
  check(!(await page.evaluate(() => JSON.parse(localStorage.getItem('quetes-de-sysadmin') ?? '{}').startHere)), `start ${width} px: the answers are not in the progress`);
  check(errors.length === 0, `start ${width} px: no console error ${errors.join(' ')}`);
  await page.close();
}
// A returning player (chapters finished) is not interrupted; exam mode hides the questions.
{
  const page = await browser.newPage({ viewport: { width: 375, height: 900 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  await withCsp(page, { tour: true });
  await page.addInitScript(() => localStorage.setItem('quetes-de-sysadmin', JSON.stringify({ finished: ['lighthouse'] })));
  await page.goto(`${BASE}/fr/`);
  const game = page.locator('quetes-de-sysadmin');
  await page.waitForTimeout(500);
  check(await game.locator('.start-offer').isHidden(), 'start returning: no card for a player who has played');
  check(await game.locator('.tour').isHidden(), 'start returning: no tour either');
  check(await game.locator('.start-here-button').isVisible(), 'start returning: the menu still has "Par où commencer ?"');
  await page.locator('details:has(#exam-mode)').evaluate((d) => (d.open = true));
  await page.locator('#exam-mode').check();
  check(await game.locator('.start-here-entry').isHidden(), 'start exam: the button is hidden in exam mode');
  check(errors.length === 0, `start returning: no console error ${errors.join(' ')}`);
  await page.close();
}

// "Signaler un problème ou une idée" (see feedback.ts): opened from a chapter
// and from the menu, a context part ticked changes the exact text, the GitHub
// link carries the title, copying works (or selects the text), Esc closes and
// gives the focus back, and the dialog makes no request at all.
for (const width of [1000, 375]) {
  const page = await browser.newPage({ viewport: { width: width, height: 900 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  await withCsp(page);
  await page.goto(`${BASE}/fr/`);
  const game = page.locator('quetes-de-sysadmin');
  const input = game.locator('form input');
  await game.locator('button[data-story="0"]').click();
  await page.waitForFunction(() => document.querySelector('quetes-de-sysadmin').shadowRoot.querySelector('.output').textContent.includes('chapitre 1'));
  for (const c of ['ls', 'pwd']) {
    await input.fill(c);
    await input.press('Enter');
  }
  // From here on, nothing may go out: the dialog only builds a text.
  const requests = [];
  // The dialog's own code and texts load from the site when it first opens
  // (src/interface/lazy-dialog.ts, dialog-*.ftl): nothing else.
  page.on('request', (r) => !(r.method() === 'GET' && /^\/_astro\/(feedback-dialog|texts-fr--dialog-feedback)\./.test(r.url().slice(BASE.length))) && requests.push(r.url()));
  const opener = game.locator('.chapter-actions .pill').last();
  await opener.focus();
  await page.keyboard.press('Enter');
  const dialog = game.locator('dialog.feedback-window');
  await game.locator('dialog.feedback-window[open]').waitFor({ timeout: 3000 }).catch(() => {});
  check(await dialog.evaluate((d) => d.open), `feedback ${width} px: opens from the chapter's actions`);
  check((await game.locator('dialog.feedback-window textarea:focus').count()) === 1, `feedback ${width} px: the focus goes to the message`);
  const preview = dialog.locator('.feedback-preview');
  await dialog.locator('textarea').first().fill('La commande ls oublie un fichier QDS-ABCD-EFGH');
  let text = await preview.inputValue();
  check(text.startsWith('[bug] La commande ls oublie un fichier') && text.includes('- chapter: lighthouse (1, ') && text.includes('- language: fr') && text.includes('### Contexte'), `feedback ${width} px: the exact text, with the parts ticked by default`);
  check(!text.includes('QDS-ABCD') && text.includes('[code de progression retiré]'), `feedback ${width} px: a progress code is removed`);
  check(text.includes('<!-- sysadmin-quests feedback v1 -->') && !text.includes('→'), `feedback ${width} px: the report's marker closes with a literal -->`);
  check((await preview.evaluate((e) => getComputedStyle(e).fontVariantLigatures)) === 'none', `feedback ${width} px: the preview shows no ligature (--> stays three characters)`);
  check(!text.includes('vous@royaume:~$ ls') && !text.includes('user-agent'), `feedback ${width} px: commands and browser stay out until ticked`);
  check((await dialog.locator('li[data-part="commands"] textarea').inputValue()).includes('vous@royaume:~$ pwd'), `feedback ${width} px: the chapter's last commands are shown, to edit`);
  await dialog.locator('li[data-part="commands"] input[type="checkbox"]').check();
  await dialog.locator('li[data-part="commands"] textarea').fill('vous@royaume:~$ ls\nlettre.txt');
  text = await preview.inputValue();
  check(text.includes('### Dernières commandes') && text.includes('vous@royaume:~$ ls\nlettre.txt') && !text.includes('pwd'), `feedback ${width} px: ticking the commands adds them to the text, as edited`);
  await dialog.locator('li[data-part="commands"] textarea').fill('vous@royaume:~$ echo "a : b ?"\na : b ?');
  text = await preview.inputValue();
  check(text.includes('vous@royaume:~$ echo "a : b ?"\na : b ?') && !/[\u00a0\u202f]/.test(text.split('### Dernières commandes')[1]), `feedback ${width} px: commands keep their own spaces (no French typography)`);
  check(new URL(await dialog.locator('a.feedback-github').getAttribute('href')).searchParams.get('body').includes('<!-- sysadmin-quests feedback v1 -->'), `feedback ${width} px: the link's body has the closed marker`);
  await dialog.locator('li[data-part="commands"] textarea').fill('vous@royaume:~$ ls\nlettre.txt');
  const href = await dialog.locator('a.feedback-github').getAttribute('href');
  const url = new URL(href);
  check(url.origin + url.pathname === 'https://github.com/Rouages-du-net/quetes-de-sysadmin/issues/new' && url.searchParams.get('title').startsWith('[bug] La commande ls oublie') && url.searchParams.get('body').includes('lettre.txt'), `feedback ${width} px: the GitHub link carries the title and the text`);
  check((await dialog.locator('a.feedback-github').getAttribute('target')) === '_blank' && (await dialog.locator('a.feedback-github').getAttribute('rel')).includes('noopener'), `feedback ${width} px: the link opens a new tab, without opener`);
  // Copy: the Clipboard API where it is allowed, otherwise the text selected.
  await page.context().grantPermissions(['clipboard-read', 'clipboard-write'], { origin: BASE });
  await dialog.locator('.feedback-actions button').click();
  await page.waitForFunction(() => document.querySelector('quetes-de-sysadmin').shadowRoot.querySelector('.feedback-window [role="status"]').textContent !== '');
  const status = await dialog.locator('[role="status"]').textContent();
  const copied = status.includes('copié') ? await page.evaluate(() => navigator.clipboard.readText()) : '';
  check((status.includes('copié') && copied.startsWith('[bug] La commande ls')) || status.includes('sélectionné'), `feedback ${width} px: copy works or selects the text (${status})`);
  const box = await dialog.boundingBox();
  check(box.x >= 0 && box.x + box.width <= width, `feedback ${width} px: the dialog fits on the screen`);
  if (process.env.CAPTURES) await dialog.screenshot({ path: `${process.env.CAPTURES}/feedback-${width}.png` });
  await page.keyboard.press('Escape');
  check(!(await dialog.evaluate((d) => d.open)), `feedback ${width} px: Esc closes it`);
  await page.waitForTimeout(100);
  check(await opener.evaluate((b) => b.getRootNode().activeElement === b), `feedback ${width} px: the focus goes back to its button`);
  // From the menu: the draft is kept.
  await game.locator('.feedback-entry button').click();
  check(await dialog.evaluate((d) => d.open) && (await preview.inputValue()).includes('La commande ls oublie'), `feedback ${width} px: opens from the menu, the draft kept`);
  await dialog.locator('.map-actions .button').click();
  check(requests.length === 0, `feedback ${width} px: the dialog makes no request ${requests.join(' ')}`);
  check(!(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)), `feedback ${width} px: no horizontal scrolling`);
  check(errors.length === 0, `feedback ${width} px: no console error ${errors.join(' ')}`);
  await page.close();
}
// The site's footer opens the game's dialog; on another page, it leads to the game with #report; exam mode leaves out the commands.
{
  const page = await browser.newPage({ viewport: { width: 375, height: 900 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  await withCsp(page);
  await page.goto(`${BASE}/fr/`);
  const dialog = page.locator('quetes-de-sysadmin dialog.feedback-window');
  await page.locator('footer a[data-report]').click();
  await page.locator('quetes-de-sysadmin dialog.feedback-window[open]').waitFor({ timeout: 3000 }).catch(() => {});
  check(await dialog.evaluate((d) => d.open), 'feedback footer: the footer\'s link opens the game\'s dialog');
  await page.keyboard.press('Escape');
  await page.goto(`${BASE}/fr/enseignants/`);
  await page.locator('footer a[data-report]').click();
  await page.waitForURL(`${BASE}/fr/`);
  await page.waitForFunction(() => document.querySelector('quetes-de-sysadmin')?.shadowRoot?.querySelector('dialog.feedback-window')?.open);
  check(await dialog.evaluate((d) => d.open), 'feedback footer: from a page without the game, the game\'s page opens the dialog');
  await page.keyboard.press('Escape');
  await page.locator('details:has(#exam-mode)').evaluate((d) => (d.open = true));
  await page.locator('#exam-mode').check();
  await page.locator('quetes-de-sysadmin .feedback-entry button').click();
  check(await dialog.locator('li[data-part="commands"] input').isDisabled() && (await dialog.textContent()).includes('Pas en mode examen'), 'feedback exam: available, without the commands');
  check(errors.length === 0, `feedback footer: no console error ${errors.join(' ')}`);
  await page.close();
}

// The network plan: in La Ruche, the map's "Network" tab shows the
// diagram (with "you are here" on the router) and its list version.
for (const width of [1000, 375]) {
  const page = await browser.newPage({ viewport: { width: width, height: 900 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  await withCsp(page);
  // L'Effaceur, and what must be finished to receive La Ruche's key (prerequisites('hive')).
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
  check(await network.isVisible(), `network ${width} px: the Network tab is there`);
  await network.click();
  const schema = game.locator('.plan-diagram svg');
  check((await schema.count()) === 1 && (await game.locator('.plan-diagram .here').textContent()).includes('ruche'), `network ${width} px: the diagram, with the router you are on`);
  await game.locator('.plan-text').evaluate((d) => (d.open = true));
  check((await game.locator('.plan-text [aria-current="location"]').textContent()).includes('tu es ici'), `network ${width} px: the list version`);
  check(!(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)), `network ${width} px: no horizontal scrolling of the page`);
  if (process.env.CAPTURES) await page.screenshot({ path: `${process.env.CAPTURES}/reseau-${width}.png` });
  check(errors.length === 0, `network ${width} px: no console error ${errors.join(' ')}`);
  await page.close();
}

// The English page: the game in English, the link to the French page.
for (const width of [1000, 375]) {
  const page = await browser.newPage({ viewport: { width: width, height: 900 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  await withCsp(page);
  await page.goto(`${BASE}/en/`);
  const game = page.locator('quetes-de-sysadmin');
  check((await page.locator('html').getAttribute('lang')) === 'en', `en ${width} px: the page is in English`);
  check((await game.locator('.output').textContent()).includes('Welcome to your workstation'), `en ${width} px: the game speaks English`);
  check((await game.locator('.prompt').textContent()) === 'you@desk:~$', `en ${width} px: the player's account is called you, the workstation desk`);
  const input = game.locator('form input');
  await input.fill('ls -y');
  await input.press('Enter');
  check((await game.locator('.output').textContent()).includes("Try 'ls --help' for more information."), `en ${width} px: command messages are those of LANG=C`);
  check((await page.locator('.language a').getAttribute('href')) === '/fr/', `en ${width} px: link to the French page`);
  check(!(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)), `en ${width} px: no horizontal scrolling`);
  check(errors.length === 0, `en ${width} px: no console error ${errors.join(' ')}`);
  if (process.env.CAPTURES) await page.screenshot({ path: `${process.env.CAPTURES}/en-${width}.png` });
  // The teachers' page in English.
  await page.locator('details:has(a[href="/en/teachers/"]) > summary').click();
  await page.locator('a[href="/en/teachers/"]').click();
  await page.waitForURL(/\/en\/teachers\//);
  check((await page.locator('h1').textContent()).includes('For teachers'), `en ${width} px: the teachers' page in English`);
  check((await page.locator('#c-bottleneck dt').first().textContent()) === 'Goal', `en ${width} px: sheets in English`);
  check((await page.locator('.language a').getAttribute('href')) === '/fr/enseignants/', `en ${width} px: link to the sheets in French`);
  check(!(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)), `en ${width} px: sheets without horizontal scrolling`);
  check(errors.length === 0, `en ${width} px: sheets without console error ${errors.join(' ')}`);
  await page.close();
}

// The Spanish page, a draft (src/texts/languages.json): built and playable,
// marked as a translation in progress, kept out of search engines, offered by
// no other page; The Eraser in Spanish, with the tools' Spanish messages.
for (const width of [1000, 375]) {
  const page = await browser.newPage({ viewport: { width: width, height: 900 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  await withCsp(page);
  await page.goto(`${BASE}/es/`);
  const game = page.locator('quetes-de-sysadmin');
  check((await page.locator('html').getAttribute('lang')) === 'es', `es ${width} px: the page is in Spanish`);
  check((await page.locator('meta[name="robots"]').getAttribute('content')) === 'noindex', `es ${width} px: a draft is not indexed`);
  check((await page.locator('.draft-banner').textContent()).includes('Traducción en curso'), `es ${width} px: the banner says the translation is in progress`);
  check((await page.locator('.language a').evaluateAll((as) => as.map((a) => a.getAttribute('href')))).join(' ') === '/en/ /fr/', `es ${width} px: links to the complete languages`);
  check((await game.locator('.output').textContent()).includes('Te damos la bienvenida a tu puesto'), `es ${width} px: the game speaks Spanish`);
  check((await game.locator('.prompt').textContent()) === 'tu@puesto:~$', `es ${width} px: the player's account is tu, the workstation puesto`);
  const input = game.locator('form input');
  await input.fill('ls -y');
  await input.press('Enter');
  check((await game.locator('.output').textContent()).includes("Pruebe 'ls --help' para más información."), `es ${width} px: coreutils' Spanish messages`);
  await input.fill('ssh reino');
  await input.press('Enter');
  await input.fill('yes');
  await input.press('Enter');
  await page.waitForFunction(() => document.querySelector('quetes-de-sysadmin')?.shadowRoot?.querySelector('.prompt')?.textContent?.startsWith('tu@reino'));
  check((await game.locator('.output').textContent()).includes('Te despiertas en la Cabana'), `es ${width} px: The Eraser in Spanish`);
  check(!(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)), `es ${width} px: no horizontal scrolling`);
  // Longer words than English's: each visible button's text fits in it, on a
  // wide screen (at 375 px the tool buttons keep only their icon, the menu's
  // texts wrap; the reread button is only shown with the focus).
  const overflowing = await game.locator('button:visible').evaluateAll((bs) =>
    bs
      .filter((b) => !b.classList.contains('reread-button'))
      .filter((b) => {
        const range = document.createRange();
        range.selectNodeContents(b);
        return range.getBoundingClientRect().width > b.getBoundingClientRect().width + 1;
      })
      .map((b) => b.textContent),
  );
  if (width === 1000) check(overflowing.length === 0, `es ${width} px: no button's text overflows ${overflowing.join(', ')}`);
  if (process.env.CAPTURES) await page.screenshot({ path: `${process.env.CAPTURES}/es-${width}.png` });
  check(errors.length === 0, `es ${width} px: no console error ${errors.join(' ')}`);
  // The teachers' page in Spanish.
  await page.goto(`${BASE}/es/docentes/`);
  check((await page.locator('h1').textContent()).includes('Para docentes'), `es ${width} px: the teachers' page in Spanish`);
  check((await page.locator('#c-lighthouse dt').first().textContent()) === 'Objetivo', `es ${width} px: sheets in Spanish`);
  check(!(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)), `es ${width} px: sheets without horizontal scrolling`);
  if (process.env.CAPTURES) await page.screenshot({ path: `${process.env.CAPTURES}/es-teachers-${width}.png` });
  check(errors.length === 0, `es ${width} px: sheets without console error ${errors.join(' ')}`);
  await page.close();
}
{
  // No page of a complete language offers the draft.
  const page = await browser.newPage();
  await page.goto(`${BASE}/en/`);
  check((await page.locator('a[href^="/es/"], link[hreflang="es"]').count()) === 0, 'es: the English page offers no draft');
  const feed = await page.request.get(`${BASE}/es/feed.xml`);
  const manifest = await (await page.request.get(`${BASE}/es/manifest.webmanifest`)).json();
  check(feed.ok() && (await feed.text()).includes('Misiones de Sysadmin'), 'es: the Spanish feed');
  check(manifest.lang === 'es' && manifest.start_url === '/es/', 'es: the Spanish manifest');
  await page.close();
}

// A game started in French and resumed in English (the same save):
// ssh kingdom (royaume in French) connects with the English account (you), not with "vous".
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
  check((await game.locator('.prompt').textContent()) === 'you@kingdom:~$', 'French game resumed in English: ssh kingdom connects');
  await page.close();
}

// My progress: the name at the top of the notebook, the short code copied to
// another machine (another browser), the file that brings back everything.
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
  check(await window.evaluate((d) => d.open), `progress ${width} px: the dialog opens`);
  const code = await window.locator('.progress-code').textContent();
  check(/^QDS(-[0-9A-Z]{1,4})+$/.test(code), `progress ${width} px: the code ${code}`);
  await window.locator('input[type="text"]').first().fill('Lina');
  await window.locator('input[type="text"]').first().press('Tab');
  const box = await window.boundingBox();
  check(box.x >= 0 && box.x + box.width <= width, `progress ${width} px: the dialog fits on the screen`);
  if (process.env.CAPTURES) await page.screenshot({ path: `${process.env.CAPTURES}/progression-${width}.png` });
  const [download] = await Promise.all([page.waitForEvent('download'), window.locator('button', { hasText: 'Télécharger ma sauvegarde' }).click()]);
  const file = await download.path();
  await page.keyboard.press('Escape');
  check((await game.locator('.notebook h2').textContent()).includes('Le carnet de Lina'), `progress ${width} px: the name at the top of the notebook`);

  // Another machine: a fresh browser.
  const elsewhere = await browser.newContext({ viewport: { width: width, height: 900 } });
  const other = await elsewhere.newPage();
  await withCsp(other);
  await other.goto(`${BASE}/fr/`);
  game = other.locator('quetes-de-sysadmin');
  await game.locator('button', { hasText: 'Ma progression' }).click();
  const codeInput = game.locator('dialog.progress-window input[type="text"]').nth(1);
  const resumeCode = game.locator('dialog.progress-window button', { hasText: 'Reprendre' });
  // First a typo: refused, nothing changes.
  await codeInput.fill(code.slice(0, -1) + (code.endsWith('A') ? 'B' : 'A'));
  await resumeCode.click();
  check((await game.locator('.progress-state').textContent()).length > 0 && (await other.evaluate(() => localStorage.getItem('quetes-de-sysadmin'))) !== null, `progress ${width} px: a wrong code is refused, with a message`);
  // Then the right code, copied in lower case with an O for a 0: the game resumes with these chapters.
  await codeInput.fill(code.toLowerCase().replace(/0/g, 'o'));
  await resumeCode.click();
  await other.waitForFunction(() => !document.querySelector('quetes-de-sysadmin')?.shadowRoot?.querySelector('dialog.progress-window')?.open);
  const stories = await other.evaluate(() => JSON.parse(localStorage.getItem('quetes-de-sysadmin')).finished);
  check(['lighthouse', 'village', 'root', 'backup', 'keys'].every((id) => stories.includes(id)), `progress ${width} px: the code restores the finished chapters`);
  // The file, in a third browser: everything comes back, name and notebook included.
  const third = await (await browser.newContext({ viewport: { width: width, height: 900 } })).newPage();
  await withCsp(third);
  third.on('dialog', (d) => d.accept());
  await third.goto(`${BASE}/fr/`);
  game = third.locator('quetes-de-sysadmin');
  await game.locator('button', { hasText: 'Ma progression' }).click();
  await game.locator('dialog.progress-window input[type="file"]').setInputFiles(file);
  await third.waitForFunction(() => document.querySelector('quetes-de-sysadmin')?.shadowRoot?.querySelector('.notebook h2')?.textContent?.includes('Lina'));
  check((await game.locator('.notebook h2').textContent()).includes('Le carnet de Lina'), `progress ${width} px: the file restores everything, name and notebook included`);
  check(errors.length === 0, `progress ${width} px: no console error ${errors.join(' ')}`);
  await here.close();
  await elsewhere.close();
}

// The mission, Ctrl-R and Ctrl-C (desktop), then the key bar (phone).
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
  check(!(await game.locator('.keys').isVisible()), 'desktop: no key bar');
  // Ctrl-R: search for "Jet", Enter runs "cd Jetee" again.
  await input.press('Control+r');
  await input.pressSequentially('Jet');
  check((await game.locator('.search').textContent()).includes('cd Jetee'), 'Ctrl-R finds the command in the history');
  await input.press('Enter');
  check((await game.locator('.prompt').textContent()).includes('Jetee'), 'Ctrl-R then Enter runs it again');
  // Ctrl-C: the line is abandoned.
  await input.fill('rm -r tout');
  await input.press('Control+c');
  check((await input.inputValue()) === '' && (await game.locator('.output').textContent()).includes('rm -r tout^C'), 'Ctrl-C abandons the line');
  // The mission: objective, instructions, and the net moved into "what happened".
  await game.locator('.mission-button').click();
  const mission = game.locator('dialog.mission-window');
  check((await mission.locator('h2').textContent()).includes('Chapitre 1'), 'the mission gives the chapter');
  check((await mission.locator('.mission-log li').count()) >= 1, 'the mission rereads what happened');
  await page.keyboard.press('Escape');
  check(errors.length === 0, `mission: no console error ${errors.join(' ')}`);
  await page.close();

  const telephone = await browser.newContext({ viewport: { width: 375, height: 800 }, isMobile: true, hasTouch: true });
  const mobile = await telephone.newPage();
  await withCsp(mobile);
  await mobile.goto(`${BASE}/fr/`);
  const mobileGame = mobile.locator('quetes-de-sysadmin');
  check(await mobileGame.locator('.keys').isVisible(), 'phone: the key bar is there');
  const line = mobileGame.locator('form input');
  await line.fill('ls -a ~/.s');
  await mobileGame.locator('.keys button[data-key="Tab"]').tap();
  check((await line.inputValue()) === 'ls -a ~/.ssh/', 'phone: Tab completes');
  await mobileGame.locator('.keys button[data-key="|"]').tap();
  check((await line.inputValue()).endsWith('|'), 'phone: | is inserted in the line');
  check((await mobileGame.locator('.highlighting').textContent()).endsWith('|'), 'phone: the character from the bar shows at once');
  // _ is in many names (id_royaume, authorized_keys) and far away on phone keyboards.
  await mobileGame.locator('.keys button[data-key="_"]').tap();
  check((await line.inputValue()).endsWith('|_'), 'phone: the bar has the _ key');
  // Double Tab: the possibilities, laid out in columns within the phone's width.
  await line.fill('ls ~/.ssh/');
  await mobileGame.locator('.keys button[data-key="Tab"]').tap();
  await mobileGame.locator('.keys button[data-key="Tab"]').tap();
  check((await mobileGame.locator('.output .suggestions').count()) === 1, 'phone: double Tab shows the possibilities');
  await line.fill('ls -a /etc');
  await line.press('Enter');
  check(
    await mobileGame.locator('.output').evaluate((s) => [...s.querySelectorAll('pre')].every((p) => p.scrollWidth <= p.clientWidth + 1)),
    'phone: ls fits in the width, with no hidden scrolling',
  );
  check(!(await mobile.evaluate(() => document.documentElement.scrollWidth > innerWidth)), 'phone: no horizontal scrolling');
  // A long press (contextmenu with a finger) keeps the phone's selection and menu;
  // with the mouse, right-click pastes, as in a Linux terminal.
  const cancelled = (type) =>
    mobileGame.locator('.output').evaluate((s, type) => {
      s.dispatchEvent(new PointerEvent('pointerdown', { pointerType: type, bubbles: true, composed: true }));
      return !s.dispatchEvent(new PointerEvent('contextmenu', { pointerType: type, bubbles: true, cancelable: true, composed: true }));
    }, type);
  check(!(await cancelled('touch')), 'phone: a long press selects the text (phone menu)');
  check(await cancelled('mouse'), 'mouse: right-click pastes');
  // nano without a Ctrl key: the bar gives ^O and ^X, always on screen.
  await line.fill('nano notes.txt');
  await line.press('Enter');
  const nanoBar = mobileGame.locator('.keys button[data-key="ctrl-x"]');
  check((await nanoBar.isVisible()) && !(await mobileGame.locator('.keys button[data-key="Tab"]').isVisible()), 'phone: in nano, the bar gives ^O and ^X');
  const box = await nanoBar.boundingBox();
  check(box !== null && box.y + box.height <= 800, 'phone: ^X is on screen');
  await mobileGame.locator('.nano-text').fill('Bonjour du téléphone\n');
  await mobileGame.locator('.keys button[data-key="ctrl-o"]').tap();
  check((await mobileGame.locator('.nano-status').textContent()).includes('1 ligne'), 'phone: ^O from the bar writes the file');
  await mobileGame.locator('.nano-text').fill('Bonjour du téléphone\nencore\n');
  await nanoBar.tap();
  check(await mobileGame.locator('.nano-key', { hasText: 'Oui' }).isVisible(), 'phone: ^X asks whether to save');
  await mobileGame.locator('.nano-key', { hasText: 'Oui' }).tap();
  check(
    !(await mobileGame.locator('.nano').count()) && (await mobileGame.locator('.keys button[data-key="Tab"]').isVisible()) && !(await nanoBar.isVisible()),
    'phone: nano closed, the bar comes back',
  );
  await telephone.close();
}

// Achievements: announced in the terminal, counted on the link, listed with the rank.
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
  check(output.includes('Succès : Ce qui est caché') && output.includes('Succès : Mot magique'), 'achievements: announced in the terminal');
  const link = game.locator('.chapter-actions button', { hasText: 'Succès' });
  check(/Succès \(\d+\/\d+\)/.test(await link.textContent()), `achievements: the count on the button (${await link.textContent()})`);
  check((await link.locator('.icon').count()) === 1, 'achievements: the button has its icon');
  await link.click();
  const window = game.locator('dialog.achievements-window');
  check((await window.locator('.achievement-rank').textContent()).includes('Stagiaire'), 'achievements: the rank');
  check((await window.locator('.earned').count()) === 3 && (await window.textContent()).includes('Succès caché'), 'achievements: earned and hidden in the list');
  if (process.env.CAPTURES) await page.screenshot({ path: `${process.env.CAPTURES}/succes-1000.png` });
  await page.keyboard.press('Escape');
  check(errors.length === 0, `achievements: no console error ${errors.join(' ')}`);
  await page.close();
}

// Graduated hints: the manual, then a lead, then almost the answer;
// the debrief counts them; nothing in exam mode.
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
  check((await button('manual').isVisible()) && !(await button('lead').isVisible()), 'hints: the manual first');
  await button('manual').click();
  check((await mission.locator('.hint-text').textContent()).includes('man mv'), 'hints: the manual pages');
  await button('lead').click();
  await button('solution').click();
  check((await mission.locator('.hint-text').textContent()).includes('mv crabe Seau'), 'hints: almost the answer, for the current step');
  await page.keyboard.press('Escape');
  // The rescue snapshot: taken after the net, then the bulb put in the wrong place, and we go back.
  await taper('mv Jetee/filet Port/Hangar');
  await game.locator('.mission-button').click();
  await mission.locator('.rescue-button', { hasText: 'Prendre un instantané' }).click();
  check((await mission.locator('.rescue-state').textContent()).includes('après une saisie'), 'snapshot: taken');
  await page.keyboard.press('Escape');
  await taper('mv Port/Remise/.ampoule_de_secours Port/Hangar');
  await game.locator('.mission-button').click();
  await mission.locator('.rescue-button', { hasText: 'Revenir' }).click();
  check(!(await mission.evaluate((d) => d.open)) && (await game.locator('.output').textContent()).includes('Machine remise comme après la première saisie'), 'snapshot: the machine is restored');
  await taper('ls -a Port/Remise');
  check((await game.locator('.output').textContent()).split('ls -a Port/Remise')[1]?.includes('.ampoule_de_secours'), 'snapshot: the bulb is back in its place');
  await taper('mv Port/Remise/.ampoule_de_secours Jetee/Phare/Escalier/Lanterne/ampoule');
  check((await game.locator('.output .summary').textContent()).includes('3 indices'), 'hints: the summary counts them (even after a snapshot)');
  // In exam mode: no help.
  // The questions under the game are folded: "For teachers" opened first.
  await page.locator('details:has(#exam-mode)').evaluate((d) => (d.open = true));
  await page.locator('#exam-mode').check();
  await game.locator('.mission-button').click();
  check(!(await mission.locator('.help').isVisible()), 'hints: nothing in exam mode');
  await page.keyboard.press('Escape');
  check(errors.length === 0, `hints: no console error ${errors.join(' ')}`);
  await page.close();
}

// Autosave inside a chapter: the page reloaded (a tab closed, a phone that
// killed it), the game offers to resume; resuming replays the inputs and
// gives back the machine; "start again" forgets them.
for (const width of [1000, 375]) {
  const page = await browser.newPage({ viewport: { width: width, height: 900 }, colorScheme: width < 500 ? 'dark' : 'light' });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  await withCsp(page);
  await page.goto(`${BASE}/fr/`);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  const game = page.locator('quetes-de-sysadmin');
  const taper = async (l) => {
    await game.locator('form input').fill(l);
    await game.locator('form input').press('Enter');
  };
  const kept = () => page.evaluate(() => JSON.parse(localStorage.getItem('quetes-de-sysadmin-autosave-fr') ?? 'null'));
  for (const l of ['ssh royaume', 'yes', 'mv Jetee/filet Port/Hangar', 'cd Port']) await taper(l);
  check((await kept())?.n === 2 && (await kept())?.chapter === 'lighthouse', `autosave ${width} px: the chapter's inputs are kept in the browser`);
  await page.reload();
  const offer = game.locator('.resume-offer');
  check((await offer.isVisible()) && (await offer.textContent()).includes('après 2 saisies'), `autosave ${width} px: reloaded, the game offers to resume`);
  check((await game.locator('[role="status"]').first().textContent()).includes('Chapitre en cours'), `autosave ${width} px: the offer is announced`);
  const box = await offer.boundingBox();
  check(box.x >= 0 && box.x + box.width <= width, `autosave ${width} px: the offer fits on the screen`);
  if (process.env.SHOTS) await page.screenshot({ path: `${process.env.SHOTS}/autosave-${width}.png`, fullPage: false });
  await offer.locator('.button', { hasText: 'Reprendre' }).click();
  check(await offer.isHidden(), `autosave ${width} px: the offer goes away`);
  check((await game.locator('.output').textContent()).includes('Chapitre repris là où tu en étais : 2 saisies rejouées'), `autosave ${width} px: the chapter is resumed`);
  check((await game.locator('.output').textContent()).includes('mv Jetee/filet Port/Hangar'), `autosave ${width} px: the end of the terminal is shown again`);
  check((await game.locator('.prompt').textContent()).includes('~/Port'), `autosave ${width} px: back in the same directory`);
  await taper('ls Hangar');
  check((await game.locator('.output pre').last().textContent()).includes('filet'), `autosave ${width} px: the net is still in the boathouse`);
  check((await kept())?.n === 3, `autosave ${width} px: the autosave goes on after a resume`);
  if (process.env.SHOTS) await page.screenshot({ path: `${process.env.SHOTS}/autosave-resumed-${width}.png` });
  // The story's chunk and texts slow to come (story-registry.ts): "Resume"
  // pressed before they are there waits for them, then replays.
  const slow = async (route) => {
    await new Promise((r) => setTimeout(r, 1500));
    await route.fallback().catch(() => {});
  };
  await page.route(/\/_astro\/(eraser\.|texts-fr--story-eraser)/, slow);
  await page.evaluate(() => location.reload());
  await offer.waitFor({ state: 'visible', timeout: 30000 });
  check(await page.evaluate(() => document.querySelector('quetes-de-sysadmin').shadowRoot.querySelector('.qds[aria-busy]') !== null), `autosave ${width} px: the story is still loading when the offer shows`);
  await offer.locator('.button', { hasText: 'Reprendre' }).click();
  await waitReady(page);
  check((await game.locator('.output').textContent()).includes('3 saisies rejouées') && (await game.locator('.prompt').textContent()).includes('~/Port'), `autosave ${width} px: resumed while the story was loading, once it has loaded`);
  await page.unroute(/\/_astro\/(eraser\.|texts-fr--story-eraser)/, slow);
  await page.reload();
  await offer.locator('.button', { hasText: 'Recommencer' }).click();
  check((await offer.isHidden()) && (await kept()) === null, `autosave ${width} px: "start again" forgets the inputs`);
  await taper('ls Port/Hangar');
  check(!(await game.locator('.output pre').last().textContent()).includes('filet'), `autosave ${width} px: the chapter starts again from the beginning`);
  check((await kept())?.n === 1, `autosave ${width} px: the new start is kept`);
  // The setting: off, nothing is kept.
  await game.locator('.setting-button', { hasText: 'Sauvegarde auto' }).click();
  check((await game.locator('.setting-button', { hasText: 'Sauvegarde auto' }).getAttribute('aria-pressed')) === 'false' && (await kept()) === null, `autosave ${width} px: turned off, nothing is kept`);
  await taper('ls');
  check((await kept()) === null, `autosave ${width} px: turned off, nothing is written`);
  await game.locator('.setting-button', { hasText: 'Sauvegarde auto' }).click();
  check(!(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)), `autosave ${width} px: no horizontal scrolling`);
  check(errors.length === 0, `autosave ${width} px: no console error ${errors.join(' ')}`);
  await page.evaluate(() => localStorage.clear());
  await page.close();
}

// The class table: two students' files and a code, read in the
// browser; the downloaded CSV neutralises a booby-trapped name.
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
  check(lines === 3, `class ${width} px: one line per student (${lines})`);
  check((await page.locator('#class tbody').textContent()).includes('Lina') && (await page.locator('#class tbody').textContent()).includes('Admin junior'), `class ${width} px: chapters and rank`);
  const [download] = await Promise.all([page.waitForEvent('download'), page.locator('#class button', { hasText: 'CSV' }).click()]);
  const csv = readFileSync(await download.path(), 'utf8');
  check(csv.includes("'=1+1") && csv.includes('\r\nLina;5;'), `class ${width} px: the CSV, without formulas, ; in French`);
  check(csv.startsWith('\uFEFFÉlève;Chapitres terminés (sur ') && csv.includes("Série d'astreinte"), `class ${width} px: the CSV starts with a BOM, accents kept`);
  const csvLines = csv.split('\r\n');
  check(csvLines.length === 4 && csvLines.every((l) => l.split(';').length === csvLines[0].split(';').length), `class ${width} px: the CSV, one line per student, one column per chapter`);
  check((await page.locator('#class .class-actions').textContent()).includes("rien n'est envoyé"), `class ${width} px: the page says nothing is sent`);
  // The separator can be changed: a comma, as in English.
  await page.locator('#class select').selectOption(',');
  const [download2] = await Promise.all([page.waitForEvent('download'), page.locator('#class button', { hasText: 'CSV' }).click()]);
  check(readFileSync(await download2.path(), 'utf8').includes('\r\nLina,5,'), `class ${width} px: the CSV with commas`);
  check(!(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)), `class ${width} px: no horizontal scrolling of the page`);
  if (process.env.CAPTURES) await page.screenshot({ path: `${process.env.CAPTURES}/classe-${width}.png` });
  // Printed: only the title and the table, without the site's header and footer.
  await page.emulateMedia({ media: 'print' });
  const shown = (selector) => page.locator(selector).first().evaluate((e) => getComputedStyle(e).display !== 'none');
  check(!(await shown('header')) && !(await shown('footer')) && !(await shown('.class-zone')) && !(await shown('.class-actions')), `class ${width} px: printed without the header, footer, fields and buttons`);
  check((await shown('#class table')) && (await shown('h1')), `class ${width} px: printed, the title and the table`);
  await page.emulateMedia({ media: null });
  check(errors.length === 0, `class ${width} px: no console error ${errors.join(' ')}`);
  await page.close();
}

// The printable story sheets: a page per story, linked from the quest
// sheets; printed without the site around them, the links written out,
// the teacher's version only once opened; the quest sheets one story per page.
for (const width of [1000, 375]) {
  const page = await browser.newPage({ viewport: { width: width, height: 900 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  await withCsp(page);
  await page.goto(`${BASE}/en/teachers/`);
  check(await page.locator('.print-button').isVisible(), `story sheet ${width} px: the quest sheets' Print button`);
  await page.emulateMedia({ media: 'print' });
  check((await page.locator('.sheet-story').nth(1).evaluate((e) => getComputedStyle(e).breakBefore)) === 'page', `story sheet ${width} px: the quest sheets print one story per page`);
  await page.emulateMedia({ media: null });
  await page.locator('a[href="/en/teachers/sheets/letters/"]').click();
  await page.waitForURL(/\/en\/teachers\/sheets\/letters\/$/);
  check((await page.locator('.sheet').count()) >= 3 && (await page.locator('.question-block').count()) === (await page.locator('.sheet').count()), `story sheet ${width} px: chapters and questions`);
  check((await page.locator('#c-firewall').textContent()).includes('man ufw'), `story sheet ${width} px: the manual pages to read`);
  check(!(await page.locator('.teacher-route').evaluate((d) => d.open)) && (await page.locator('.print-button').isVisible()), `story sheet ${width} px: the teacher's version folded, a Print button`);
  check(!(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)), `story sheet ${width} px: no horizontal scrolling`);
  if (process.env.CAPTURES) await page.screenshot({ path: `${process.env.CAPTURES}/story-sheet-${width}.png` });
  await page.emulateMedia({ media: 'print' });
  const display = (selector) => page.locator(selector).first().evaluate((e) => getComputedStyle(e).display);
  check((await display('header')) === 'none' && (await display('footer')) === 'none' && (await display('.print-actions')) === 'none', `story sheet ${width} px: printed without header, footer or buttons`);
  check((await display('.teacher-route')) === 'none', `story sheet ${width} px: the closed teacher's version is not printed`);
  check((await display('.handout-name')) !== 'none', `story sheet ${width} px: a line for the student's name on paper`);
  check((await page.locator('.documentation a').first().evaluate((a) => getComputedStyle(a, '::after').content)).includes('https://'), `story sheet ${width} px: printed links show their address`);
  check((await page.locator('.questions').evaluate((e) => getComputedStyle(e).breakBefore)) === 'page', `story sheet ${width} px: the questions start a new page`);
  await page.locator('.teacher-route').evaluate((d) => (d.open = true));
  check((await display('.teacher-route')) !== 'none' && (await page.locator('.route pre').count()) > 0, `story sheet ${width} px: the teacher's version opened, printed`);
  await page.emulateMedia({ media: null });
  await page.locator('.language a').click();
  await page.waitForURL(/\/fr\/enseignants\/fiches\/letters\/$/);
  check((await page.locator('h2#questions').textContent()).includes('Vérifier'), `story sheet ${width} px: the sheet in French`);
  check(errors.length === 0, `story sheet ${width} px: no console error ${errors.join(' ')}`);
  await page.close();
}

// Display: terminal theme, size, full screen, kept in the
// browser; the staging of a connection.
for (const width of [1000, 375]) {
  const page = await browser.newPage({ viewport: { width: width, height: 800 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  await withCsp(page);
  await page.goto(`${BASE}/fr/`);
  const game = page.locator('quetes-de-sysadmin');
  const terminal = game.locator('.terminal');
  // The menu: the network map first, one branch per machine.
  const menu = game.locator('nav.stories');
  check((await menu.getAttribute('data-view')) === 'network' && (await game.locator('.host', { hasText: 'royaume.internal 192.0.2.10' }).isVisible()), `display ${width} px: the network map serves as the menu`);
  // The locked stories wait, folded, under the map.
  const locked = game.locator('details.locked-stories');
  check(
    (await game.locator('.view-choice button').count()) === 2 &&
      !(await locked.evaluate((e) => e.open)) &&
      (await locked.locator('summary').textContent()).includes('histoires encore verrouillées') &&
      !(await game.locator('button[data-story="1"]').isVisible()),
    `display ${width} px: two views, the locked stories folded`,
  );
  await locked.locator('summary').click();
  check((await game.locator('button[data-story="1"]').isVisible()) && !(await game.locator('button[data-story="1"] .host').isVisible()), `display ${width} px: unfolded, a locked story in one short row`);
  await game.locator('.view-choice button', { hasText: 'Parcours' }).click();
  await game.locator('.settings select').selectOption('amber');
  const size = () => terminal.evaluate((e) => parseFloat(getComputedStyle(e).fontSize));
  const before = await size();
  await game.locator('.settings button', { hasText: 'A+' }).click();
  check((await terminal.getAttribute('data-theme')) === 'amber' && (await size()) > before, `display ${width} px: theme and size`);
  // Command-line highlighting: a typo shows before Enter; the coloured copy is under the field.
  await game.locator('form input').pressSequentially('lss');
  check((await game.locator('.highlighting .c-unknown').textContent()) === 'lss', `display ${width} px: an unknown command is coloured`);
  await game.locator('form input').fill('');
  await game.locator('form input').pressSequentially('ls -a');
  const [field, copyOf] = await Promise.all([game.locator('form input').boundingBox(), game.locator('.highlighting').boundingBox()]);
  check(
    (await game.locator('.highlighting .c-command').textContent()) === 'ls' && (await game.locator('.highlighting .c-option').textContent()) === '-a' && Math.abs(field.x - copyOf.x) < 1 && Math.abs(field.y - copyOf.y) < 1,
    `display ${width} px: command and option coloured, under the field`,
  );
  // The spaces between coloured words stay (the copy has the width of the field's text).
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
  check(Math.abs(widths[0] - widths[1]) < 2, `display ${width} px: the coloured copy keeps the spaces (${widths})`);
  await game.locator('form input').press('Enter');
  // ls colours places on screen (.ssh), and keeps the /; in the pipe to cat, nothing.
  await game.locator('form input').fill('ls -a');
  await game.locator('form input').press('Enter');
  check((await game.locator('.output pre:not(.cmd)').last().locator('.a-34', { hasText: '.ssh' }).count()) === 1 && (await game.locator('.output pre:not(.cmd)').last().textContent()).includes('.ssh/'), `display ${width} px: ls colours places`);
  check((await game.locator('.output .cmd .c-command').nth(-2).textContent()) === 'cat', `display ${width} px: the command stays coloured above its output`);
  await game.locator('form input').fill('ssh royaume');
  await game.locator('form input').press('Enter');
  await game.locator('form input').pressSequentially('yes');
  check(!(await game.locator('.field').evaluate((e) => e.classList.contains('coloured'))), `display ${width} px: an answer (yes/no) is not coloured`);
  await game.locator('form input').fill('yes');
  await game.locator('form input').press('Enter');
  check(await terminal.evaluate((e) => e.classList.contains('scene-connection')), `display ${width} px: the connection is staged`);
  check((await game.locator('li:has(> button[data-story="0"])').getAttribute('data-state')) === 'in-progress', `display ${width} px: the machine being played lights up on the map`);
  await game.locator('.settings button', { hasText: 'Couleurs' }).click();
  await game.locator('form input').pressSequentially('ls -a');
  check(!(await game.locator('.field').evaluate((e) => e.classList.contains('coloured'))) && (await game.locator('form input').evaluate((e) => getComputedStyle(e).color)) !== 'rgba(0, 0, 0, 0)', `display ${width} px: highlighting can be turned off`);
  await game.locator('form input').press('Enter');
  check((await game.locator('.output pre:not(.cmd)').last().locator('[class^="a-"]').count()) === 0, `display ${width} px: outputs too, without colour`);
  await game.locator('.settings button', { hasText: 'Plein écran' }).click();
  const box = await terminal.boundingBox();
  check(box.width > width - 40 && box.height > 600, `display ${width} px: full screen`);
  await game.locator('form input').press('Escape');
  check(!(await game.locator('.screen').evaluate((e) => e.classList.contains('focus'))), `display ${width} px: Escape leaves full screen`);
  await page.reload();
  check((await game.locator('.terminal').getAttribute('data-theme')) === 'amber' && (await menu.getAttribute('data-view')) === 'paths', `display ${width} px: the settings are kept`);
  check(!(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)), `display ${width} px: no horizontal scrolling`);
  if (process.env.CAPTURES) await page.screenshot({ path: `${process.env.CAPTURES}/affichage-${width}.png` });
  check(errors.length === 0, `display ${width} px: no console error ${errors.join(' ')}`);
  await page.close();
}

// Learning paths: a third view of the menu; a theme, its chapters, the next one to do.
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
  check((await maps.count()) === 38 && (await game.locator('.paths-progress').textContent()).includes('1 sur 38'), `paths ${width} px: the path and its progress`);
  const next = game.locator('.paths-list button[data-next]');
  check((await next.textContent()).includes('Le pare-feu') && (await game.locator('.paths-list button[data-state="locked"]').first().textContent()).includes('D\'abord'), `paths ${width} px: the next one, and what is waiting`);
  await next.click();
  // Its story loads first (story-registry.ts).
  await waitReady(page);
  check((await game.locator('.prompt').textContent()).startsWith('vous@lettres'), `paths ${width} px: the next chapter opens`);
  await page.reload();
  check((await game.locator('nav.stories').getAttribute('data-view')) === 'paths' && (await game.locator('.paths select').inputValue()) === 'security', `paths ${width} px: the view and the path are kept`);
  check(!(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)), `paths ${width} px: no horizontal scrolling`);
  check(errors.length === 0, `paths ${width} px: no console error ${errors.join(' ')}`);
  await page.evaluate(() => localStorage.clear());
  await page.close();
}

// The Datacenter live: tail -f keeps control, visits arrive, Ctrl-C gives it back
// (the keyboard on a wide screen, the key bar on a phone).
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
  check((await game.locator('form').isHidden()) && (await stop.isVisible()), `follow ${width} px: tail -f keeps control, the Ctrl-C button is there`);
  const before = (await game.locator('.output').textContent()).split('198.51.100.77').length;
  await page.waitForTimeout(2500);
  check((await game.locator('.output').textContent()).split('198.51.100.77').length > before, `follow ${width} px: the robot's visits arrive live`);
  if (width < 500) {
    check(!(await game.locator('.keys button[data-key="Tab"]').isVisible()), `follow ${width} px: the bar keeps only Ctrl-C`);
    await game.locator('.keys button[data-key="ctrl-c"]').tap();
  } else await stop.press('Control+c');
  check((await game.locator('.output').textContent()).includes('^C') && (await game.locator('form input').isVisible()) && !(await stop.isVisible()), `follow ${width} px: Ctrl-C gives back the command line`);
  const frozen = (await game.locator('.output').textContent()).length;
  await page.waitForTimeout(1500);
  check((await game.locator('.output').textContent()).length === frozen, `follow ${width} px: after Ctrl-C, nothing more arrives`);
  check(!(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)), `follow ${width} px: no horizontal scrolling`);
  check(errors.length === 0, `follow ${width} px: no console error ${errors.join(' ')}`);
  await context.close();
}

// Replay and compare (see runs.ts): a previous run of the first chapter kept
// in the browser, the chapter finished again, the comparison in the
// summary's dialog (a table of measures, the commands diff-like), then
// "Replay this chapter" starts it afresh, both runs kept.
const SHOTS = process.env.SHOTS;
for (const width of [1000, 375]) {
  const page = await browser.newPage({ viewport: { width: width, height: 900 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  await withCsp(page);
  await page.goto(`${BASE}/fr/`);
  await page.evaluate(() => {
    const lines = ['ls', 'cd Port', 'ls -a', 'cat nulle-part', 'cd Remise', 'ls -a'];
    const run = { chapter: 'lighthouse', date: '2026-11-20T10:00:00.000Z', time: 400000, commands: 6, errors: 1, hints: 1, distinct: 3, exam: false, lines };
    localStorage.setItem('quetes-de-sysadmin-runs', JSON.stringify({ lighthouse: [run] }));
  });
  await page.reload();
  const game = page.locator('quetes-de-sysadmin');
  const tape = async (l) => {
    await game.locator('form input').fill(l);
    await game.locator('form input').press('Enter');
  };
  await game.locator('button[data-story="0"]').click();
  await waitReady(page);
  await tape('ls');
  await tape('mv Jetee/filet Port/Hangar');
  await tape('mv Port/Remise/.ampoule_de_secours Jetee/Phare/Escalier/Lanterne/ampoule');
  const line = (await game.locator('.output .summary').textContent()).replace(/\s/g, ' ');
  check(line.includes('La dernière fois : 6 commandes') && line.includes('Rejouer ce chapitre'), `compare ${width} px: the summary recalls the previous run and offers a replay (${line})`);
  await game.locator('.output .summary-button').click();
  const dialog = game.locator('dialog.summary-window');
  await dialog.locator('.compare h3').first().waitFor();
  const heads = await dialog.locator('.compare-table thead th').allTextContents();
  check(heads.length === 3 && heads[2] === 'Cette partie' && heads[1].includes('20 nov'), `compare ${width} px: a column per run (${heads.join(' | ')})`);
  const rows = await dialog.locator('.compare-table tbody tr').allTextContents();
  check(rows.length === 5 && /Commandes tapées\s*6\s*\d\s/.test(rows[0]) && rows[0].includes('en baisse') && /Indices demandés\s*1\s*0/.test(rows[3]), `compare ${width} px: the measures, with the trend (${rows[0]})`);
  const added = await dialog.locator('.compare-diff li.compare-after').allTextContents();
  const removed = await dialog.locator('.compare-diff li.compare-before').count();
  check(added.some((l) => l.includes('Seulement cette fois') && l.includes('mv Port/Remise')) && removed === 5, `compare ${width} px: the commands, diff-like, with words for screen readers`);
  const box = await dialog.boundingBox();
  check(box.x >= 0 && box.x + box.width <= width, `compare ${width} px: the dialog fits on the screen`);
  check(!(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)), `compare ${width} px: no horizontal scrolling`);
  if (SHOTS) await dialog.locator('.compare').screenshot({ path: `${SHOTS}/engagement-compare-${width}.png` });
  await dialog.locator('button', { hasText: 'Rejouer ce chapitre' }).click();
  await waitReady(page);
  check(!(await dialog.evaluate((d) => d.open)) && !(await game.locator('.output .summary').count()) && (await game.locator('.output').textContent()).includes('chapitre 1'), `compare ${width} px: the replay starts the chapter afresh`);
  const kept = await page.evaluate(() => JSON.parse(localStorage.getItem('quetes-de-sysadmin-runs')).lighthouse.map((r) => r.commands));
  check(kept.length === 2 && kept[0] === 6, `compare ${width} px: both runs are kept (${kept.join()})`);
  check(errors.length === 0, `compare ${width} px: no console error ${errors.join(' ')}`);
  await page.evaluate(() => localStorage.clear());
  await page.close();
}

// Reminders and new-content notices, static only: the Atom feeds and their
// links, the daily reminder's calendar file, the "New" badges since the last
// visit and, in the installed app only, the app badge (stubbed here: the
// headless browser is never "installed").
for (const width of [1000, 375]) {
  const page = await browser.newPage({ viewport: { width: width, height: 900 }, acceptDownloads: true });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  await page.addInitScript(() => {
    // An installed app with the Badging API, and a visibility the test controls.
    window.__badge = { events: [], app: null };
    document.addEventListener('qds-badge', (e) => window.__badge.events.push(e.detail.count));
    const media = window.matchMedia.bind(window);
    window.matchMedia = (q) => (q === '(display-mode: standalone)' ? { matches: true, media: q, addEventListener() {}, removeEventListener() {} } : media(q));
    navigator.setAppBadge = (n) => ((window.__badge.app = n), Promise.resolve());
    navigator.clearAppBadge = () => ((window.__badge.app = 0), Promise.resolve());
    Object.defineProperty(document, 'visibilityState', { get: () => window.__hidden ? 'hidden' : 'visible', configurable: true });
    if (!localStorage.getItem('quetes-de-sysadmin-whats-new')) localStorage.setItem('quetes-de-sysadmin-whats-new', JSON.stringify({ until: '2026-10-17', fresh: {} }));
  });
  await withCsp(page);
  await page.goto(`${BASE}/fr/`);
  const game = page.locator('quetes-de-sysadmin');
  // The feed: announced in <head>, linked in the footer, well-formed Atom with one entry per story.
  const alternate = await page.locator('head link[rel="alternate"][type="application/atom+xml"]').getAttribute('href');
  const footer = page.locator('footer a[href="/fr/feed.xml"]');
  check(alternate === '/fr/feed.xml' && (await footer.isVisible()) && (await footer.textContent()).includes('Suivre les nouvelles histoires'), `feed ${width} px: the page announces its feed and the footer links to it`);
  const stories = await game.locator('button[data-story]').count();
  for (const lang of ['en', 'fr']) {
    const feed = await page.evaluate(async (url) => {
      const text = await (await fetch(url)).text();
      const xml = new DOMParser().parseFromString(text, 'application/xml');
      return { ok: !xml.querySelector('parsererror'), root: xml.documentElement.namespaceURI, entries: xml.querySelectorAll('entry').length, first: xml.querySelector('entry title')?.textContent, ids: [...xml.querySelectorAll('entry id')].map((e) => e.textContent) };
    }, `${BASE}/${lang}/feed.xml`);
    check(feed.ok && feed.root === 'http://www.w3.org/2005/Atom' && feed.entries === stories && new Set(feed.ids).size === stories, `feed ${width} px: /${lang}/feed.xml, Atom, one entry per story (${feed.entries}/${stories}, newest: ${feed.first})`);
  }
  // "New": every story was released after the date seen; the badge event counts them (and today's incident, none yet).
  const badge = game.locator('button[data-story="0"] .new-badge');
  check((await badge.isVisible()) && (await badge.textContent()).includes('Nouveau') && (await game.locator('button[data-story="0"]').textContent()).includes('Nouveau'), `whats-new ${width} px: a story released since the last visit shows "New", in its button's name`);
  const sent = await page.evaluate(() => window.__badge.events.at(-1));
  check(sent === stories, `whats-new ${width} px: the game tells how many things are new (${sent})`);
  await page.evaluate(() => {
    window.__hidden = true;
    document.dispatchEvent(new Event('visibilitychange'));
  });
  check((await page.evaluate(() => window.__badge.app)) === stories, `whats-new ${width} px: the installed app shows the count on its icon once hidden`);
  await page.evaluate(() => {
    window.__hidden = false;
    document.dispatchEvent(new Event('visibilitychange'));
  });
  check((await page.evaluate(() => window.__badge.app)) === 0, `whats-new ${width} px: the app badge clears when the game is seen`);
  if (SHOTS) await game.locator('.stories').screenshot({ path: `${SHOTS}/engagement-new-${width}.png` });
  await game.locator('button[data-story="0"]').click();
  await waitReady(page);
  check(await badge.isHidden(), `whats-new ${width} px: opened, the story is no longer new`);
  check((await page.evaluate(() => window.__badge.events.at(-1))) === stories - 1, `whats-new ${width} px: the count goes down`);
  await page.reload();
  check((await badge.isHidden()) && !(await game.locator('button[data-story="1"] .new-badge').evaluate((b) => b.hidden)), `whats-new ${width} px: kept across visits`);
  // The daily reminder: a time, then a calendar file made in the browser.
  await game.locator('.reminder-button').click();
  const dialog = game.locator('dialog.reminder-window');
  await dialog.locator('h2').filter({ hasText: 'Un rappel' }).waitFor();
  check((await dialog.evaluate((d) => d.open)) && (await dialog.textContent()).includes('Rien n’est envoyé') || (await dialog.textContent()).includes("Rien n'est envoyé"), `reminder ${width} px: the dialog says nothing is sent`);
  await dialog.locator('input[type="time"]').fill('07:30');
  const [download] = await Promise.all([page.waitForEvent('download'), dialog.locator('button', { hasText: 'Télécharger' }).click()]);
  const ics = readFileSync(await download.path(), 'utf8');
  check(download.suggestedFilename() === 'rappel-quetes-de-sysadmin.ics' && /^BEGIN:VCALENDAR\r\n/.test(ics) && /\r\nDTSTART:\d{8}T073000\r\n/.test(ics) && ics.includes('RRULE:FREQ=DAILY') && ics.includes('BEGIN:VALARM') && ics.includes('https://sysadmin.rouages.net/fr/'), `reminder ${width} px: the .ics file, daily at 07:30 local time, with an alarm`);
  check((await dialog.locator('[role="status"]').textContent()).includes('ouvre-le'), `reminder ${width} px: the dialog says what to do with the file`);
  const box = await dialog.boundingBox();
  check(box.x >= 0 && box.x + box.width <= width, `reminder ${width} px: the dialog fits on the screen`);
  if (SHOTS) await dialog.screenshot({ path: `${SHOTS}/engagement-reminder-${width}.png` });
  await page.keyboard.press('Escape');
  await game.locator('.reminder-button').click();
  check((await dialog.locator('input[type="time"]').inputValue()) === '07:30', `reminder ${width} px: the time chosen is offered again`);
  await page.keyboard.press('Escape');
  check(!(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)), `reminder ${width} px: no horizontal scrolling`);
  check(errors.length === 0, `notices ${width} px: no console error ${errors.join(' ')}`);
  await page.evaluate(() => localStorage.clear());
  await page.close();
}

// On-call duty: the incident of the day, drawn among the chapters open after
// L'Effaceur (fixed date: 10 January 2027, "First day"),
// the budget that melts, the score card at the end, the result kept.
for (const width of [1000, 375]) {
  const page = await browser.newPage({ viewport: { width: width, height: 900 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  await page.clock.install({ time: new Date('2027-01-10T10:00:00') });
  await withCsp(page);
  await page.goto(`${BASE}/fr/`);
  await page.evaluate(() => {
    localStorage.setItem('quetes-de-sysadmin', JSON.stringify({ finished: ['lighthouse', 'village', 'root', 'backup'] }));
    // Two days on call already (the 8th and 9th): a streak going (see streak.ts).
    const day = { chapter: 'first-day', remaining: 900000, time: 600000, hints: 0, errors: 0 };
    localStorage.setItem('quetes-de-sysadmin-on-call', JSON.stringify({ '2027-01-08': day, '2027-01-09': day }));
  });
  await page.reload();
  const game = page.locator('quetes-de-sysadmin');
  check((await game.locator('.incident-text').textContent()).includes('Premier jour'), `on-call ${width} px: the incident of the day is announced`);
  const streakLine = (await game.locator('.stories .streak').textContent()).replace(/\s/g, ' ');
  check(/2 jours d.astreinte d.affilée/.test(streakLine) && streakLine.includes('repos'), `on-call ${width} px: the streak and the rest day, kindly (${streakLine})`);
  // The clock is stopped: time only moves with runFor (otherwise a second may pass before the gauge is read).
  await page.clock.pauseAt(new Date('2027-01-10T10:00:10'));
  await game.locator('.incident-button').click();
  const window = game.locator('dialog.on-call-window').first();
  check((await window.evaluate((d) => d.open)) && (await window.textContent()).includes('10 janvier 2027'), `on-call ${width} px: the on-call dialog`);
  await window.locator('button', { hasText: 'Prendre l' }).click();
  await waitReady(page);
  check((await game.locator('.prompt').textContent()).startsWith('vous@datacenter'), `on-call ${width} px: the incident opens`);
  check((await game.locator('.on-call-gauge').textContent()).includes('30:00 (100 %)') && (await game.locator('.incident-button').isDisabled()), `on-call ${width} px: the budget is full, no second on-call`);
  await page.clock.runFor(60_000);
  check((await game.locator('.on-call-gauge').textContent()).includes('29:00'), `on-call ${width} px: the budget melts over time`);
  const L = '/var/log/nginx/access.log';
  for (const l of ['commande-inconnue', 'sudo kill 4242', 'bienvenue-2026', 'echo "deny 198.51.100.77;" | sudo tee -a /etc/nginx/blocked.conf', 'sudo systemctl reload nginx', 'sudo kill 4244', `grep " 503 " ${L} | wc -l > ~/rapport.txt`, 'echo "Coupable : 198.51.100.77" >> rapport.txt']) {
    await game.locator('form input').fill(l);
    await game.locator('form input').press('Enter');
  }
  const end = game.locator('dialog.on-call-window').last();
  check(await end.evaluate((d) => d.open), `on-call ${width} px: the score card opens at the end`);
  const map = await end.locator('.score-card').textContent();
  check(map.includes('astreinte du 2027-01-10') && map.includes('« Premier jour »') && /[🟩🟨⬜]{5} \d+ % du budget/.test(map) && map.includes('une erreur'), `on-call ${width} px: the score card`);
  const box = await end.boundingBox();
  check(box.x >= 0 && box.x + box.width <= width, `on-call ${width} px: the dialog fits on the screen`);
  check((await end.locator('.streak').textContent()).includes('3 jours'), `on-call ${width} px: the streak grows to three days`);
  check(/Trois nuits d.astreinte/.test(await game.locator('.output').textContent()), `on-call ${width} px: the three-day achievement`);
  const file = await page.evaluate(() => JSON.parse(localStorage.getItem('quetes-de-sysadmin-on-call')));
  check(Object.keys(file).sort().join() === '2027-01-08,2027-01-09,2027-01-10', `on-call ${width} px: today's result joins the days kept`);
  await page.keyboard.press('Escape');
  check((await game.locator('.on-call-gauge').isHidden()) && (await game.locator('.incident-text').textContent()).includes('Fait aujourd’hui') || (await game.locator('.incident-text').textContent()).includes("Fait aujourd'hui"), `on-call ${width} px: the day's result is kept`);
  check(!(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)), `on-call ${width} px: no horizontal scrolling`);
  check(errors.length === 0, `on-call ${width} px: no console error ${errors.join(' ')}`);
  await page.evaluate(() => localStorage.clear());
  await page.close();
}

// The root: a choice of language (Apache redirects according to the browser,
// the preview server shows the page), English first.
{
  const page = await browser.newPage();
  await page.goto(`${BASE}/`);
  const links = await page.locator('.languages a').evaluateAll((as) => as.map((a) => a.getAttribute('href')));
  check(links.join(' ') === '/en/ /fr/', 'root: language choice, English first');
  check((await page.locator('html').getAttribute('lang')) === 'en', 'root: page in English');
  await page.close();
}

// Page not found
{
  const page = await browser.newPage();
  await page.goto(`${BASE}/n-existe-pas/`);
  check((await page.locator('h1').textContent()).includes('404'), '404: "not found" page served');
  await page.close();
}

// The installable game (src/pwa/): the manifest and its icons, the service
// worker that takes the page and lets it play offline, the footer's
// "Install the game" (only when the browser offers it).
{
  const context = await browser.newContext({ viewport: { width: 1000, height: 900 }, serviceWorkers: 'allow' });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  await withCsp(page);
  await page.goto(`${BASE}/en/`);
  const href = await page.locator('link[rel="manifest"]').getAttribute('href');
  check(href === '/en/manifest.webmanifest', 'pwa: the English page links its manifest');
  const answer = await page.request.get(`${BASE}${href}`);
  let manifest = {};
  try {
    manifest = JSON.parse(await answer.text());
  } catch {}
  check(manifest.start_url === '/en/' && manifest.lang === 'en' && manifest.display === 'standalone', 'pwa: the manifest is valid JSON, in English, standalone');
  let icons = 0;
  for (const icon of manifest.icons ?? []) {
    const r = await page.request.get(`${BASE}${icon.src}`);
    if (r.ok() && r.headers()['content-type'] === 'image/png') icons++;
  }
  check(icons === 3 && manifest.icons.some((i) => i.purpose === 'maskable'), 'pwa: the manifest\'s icons exist (192, 512, maskable)');
  check((await page.request.get(`${BASE}/icons/apple-touch-icon.png`)).ok(), 'pwa: the Apple touch icon exists');
  const frManifest = await (await page.request.get(`${BASE}/fr/manifest.webmanifest`)).json();
  check(frManifest.name === 'Quêtes de Sysadmin' && frManifest.start_url === '/fr/', 'pwa: the French manifest');
  const script = await page.evaluate(() => navigator.serviceWorker.ready.then((r) => r.active?.scriptURL));
  check(script === `${BASE}/sw.js`, 'pwa: the service worker is registered and active');
  await page.reload();
  check(await page.evaluate(() => navigator.serviceWorker.controller !== null), 'pwa: after a reload, the service worker controls the page');
  const keys = await page.evaluate(() => caches.keys());
  // The build's cache, and the runtime one (stories, texts and the manual, kept once loaded).
  check(keys.filter((k) => /^qds-[0-9a-f]{12}$/.test(k)).length === 1 && keys.every((k) => /^qds-([0-9a-f]{12}|runtime)$/.test(k)), `pwa: one cache named after the build (and the runtime one) ${keys.join(' ')}`);
  const precached = await page.evaluate(async () => (await (await caches.open((await caches.keys()).find((k) => k !== 'qds-runtime'))).keys()).map((r) => new URL(r.url).pathname));
  check(precached.some((p) => /\/game\./.test(p)) && !precached.some((p) => /\/(eraser|datacenter)\.|--manual|--story-/.test(p)), 'pwa: the game\'s shell is precached, not the stories nor the manual');
  // Offline: the game still opens, in each language.
  await context.setOffline(true);
  await page.reload();
  await page.waitForFunction(() => document.querySelector('quetes-de-sysadmin')?.shadowRoot?.querySelector('.output pre'));
  check((await page.locator('quetes-de-sysadmin .output').textContent()).includes('Welcome to your workstation'), 'pwa: offline, /en/ reloads and the game starts');
  await page.goto(`${BASE}/fr/`);
  await page.waitForFunction(() => document.querySelector('quetes-de-sysadmin')?.shadowRoot?.querySelector('.output pre'));
  check((await page.locator('quetes-de-sysadmin .output').textContent()).includes('Bienvenue sur ton poste'), 'pwa: offline, /fr/ opens too');
  await page.goto(`${BASE}/en/teachers/`);
  check((await page.locator('html').getAttribute('lang')) === 'en' && (await page.locator('quetes-de-sysadmin').count()) === 1, 'pwa: offline, a page never visited falls back to the game');
  await context.setOffline(false);
  // A story opened online plays offline afterwards (its chunk and texts kept at runtime).
  await page.goto(`${BASE}/en/`);
  await page.waitForFunction(() => document.querySelector('quetes-de-sysadmin')?.shadowRoot?.querySelector('.output pre'));
  await page.locator('quetes-de-sysadmin button[data-story="0"]').click();
  await page.waitForFunction(() => document.querySelector('quetes-de-sysadmin').shadowRoot.querySelector('.output').textContent.includes('Lighthouse Island'));
  await page.waitForTimeout(500);
  await context.setOffline(true);
  await page.reload();
  await page.waitForFunction(() => document.querySelector('quetes-de-sysadmin')?.shadowRoot?.querySelector('.output pre'));
  await page.waitForTimeout(500);
  check((await page.locator('quetes-de-sysadmin .output').textContent()).includes('Lighthouse Island'), 'pwa: a story opened online opens again offline');
  await page.locator('quetes-de-sysadmin form input').fill('ls');
  await page.locator('quetes-de-sysadmin form input').press('Enter');
  await page.waitForTimeout(300);
  check((await page.locator('quetes-de-sysadmin .output').textContent()).includes('Beach'), 'pwa: offline, the story plays (ls)');
  await context.setOffline(false);
  await page.goto(`${BASE}/en/`);
  // The footer: nothing until the browser offers to install.
  const install = page.locator('.install');
  const button = page.locator('.install-button');
  check(!(await install.isVisible()), 'pwa: no "Install the game" while the browser does not offer it');
  const offer = (outcome) =>
    page.evaluate((outcome) => {
      const e = new Event('beforeinstallprompt', { cancelable: true });
      e.prompt = async () => {
        window.prompted = true;
      };
      e.userChoice = Promise.resolve({ outcome: outcome });
      dispatchEvent(e);
    }, outcome);
  await offer('accepted');
  check(await button.isVisible() && (await button.textContent()) === 'Install the game', 'pwa: the browser offers to install, the footer shows the button');
  for (const width of [1000, 375]) {
    await page.setViewportSize({ width: width, height: 900 });
    check(!(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)), `pwa ${width} px: the footer's button without horizontal scrolling`);
    if (process.env.CAPTURES)
      for (const scheme of ['light', 'dark']) {
        await page.emulateMedia({ colorScheme: scheme });
        await page.locator('footer').screenshot({ path: `${process.env.CAPTURES}/install-${width}-${scheme}.png` });
      }
  }
  await button.focus();
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => document.querySelector('.install-status')?.textContent);
  check(await page.evaluate(() => window.prompted === true), 'pwa: the button, with the keyboard, asks the browser\'s question');
  check(!(await button.isVisible()) && (await page.locator('.install-status').textContent()).includes('being installed'), 'pwa: accepted, the button goes and a message says so');
  check(await page.evaluate(() => document.activeElement?.classList.contains('install-status')), 'pwa: the focus goes to the message');
  await page.evaluate(() => dispatchEvent(new Event('appinstalled')));
  check((await page.locator('.install-status').textContent()) === 'The game is installed.', 'pwa: installed, announced');
  check(errors.length === 0, `pwa: no console error ${errors.join(' ')}`);
  await context.close();
}

// On an iPhone (no beforeinstallprompt): the footer explains Safari's way, in French on /fr/.
{
  const context = await browser.newContext({
    viewport: { width: 375, height: 800 },
    isMobile: true,
    hasTouch: true,
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
  });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  await withCsp(page);
  await page.goto(`${BASE}/fr/`);
  const help = page.locator('.install-ios');
  check(await help.isVisible() && !(await page.locator('.install-button').isVisible()), 'pwa iOS: the instructions instead of the button');
  await help.locator('summary').focus();
  await page.keyboard.press('Enter');
  check((await help.locator('p').textContent()).includes("Sur l'écran d'accueil") && (await help.locator('p').isVisible()), 'pwa iOS: opened with the keyboard, "Add to Home Screen" in French');
  check(!(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)), 'pwa iOS: no horizontal scrolling');
  if (process.env.CAPTURES) await page.locator('footer').screenshot({ path: `${process.env.CAPTURES}/install-ios-375.png` });
  check(errors.length === 0, `pwa iOS: no console error ${errors.join(' ')}`);
  await context.close();
}

// Embedding in any page, with only the embeddable file (which never
// registers a service worker in its host page).
const page = await (await browser.newContext({ serviceWorkers: 'allow' })).newPage();
await page.route(`${BASE}/autre-site.html`, (r) => r.fulfill({ contentType: 'text/html', body: `<!doctype html><html lang="en"><body style="font-family:serif">
  <h1>Another site</h1>
  <quetes-de-sysadmin histoire="paquet" cle="test" theme="sombre"></quetes-de-sysadmin>
  <script type="module" src="${BASE}/integration/quetes-de-sysadmin.js"></script></body></html>` }));
await page.goto(`${BASE}/autre-site.html`);
await page.waitForFunction(() => document.querySelector('quetes-de-sysadmin')?.shadowRoot?.querySelector('.output pre'));
// With no language attribute, the game takes the page's language (here lang="en").
check((await page.locator('quetes-de-sysadmin .output').textContent()).includes('The Lost Packet'), 'embedding: the requested story opens, in the page language');
check(await page.locator('quetes-de-sysadmin .exam-choice').isVisible(), 'embedding: the exam checkbox is in the game');
check((await page.evaluate(() => getComputedStyle(document.querySelector('h1')).fontFamily)).includes('serif'), 'embedding: the page styles are not touched');
await page.addStyleTag({ content: 'quetes-de-sysadmin { --qds-accent: rgb(1, 2, 3); }' });
check(
  (await page.evaluate(() => getComputedStyle(document.querySelector('quetes-de-sysadmin').shadowRoot.querySelector('a')).color)) === 'rgb(1, 2, 3)',
  'embedding: colours are set from the page (--qds-accent)',
);

await page.waitForLoadState('load');
await page.waitForTimeout(500);
check((await page.evaluate(() => navigator.serviceWorker.getRegistrations())).length === 0, 'embedding: no service worker registered in the host page');

// From another origin: the element fetches its chunks (the game, its texts,
// the story) relative to its own address, with the CORS header that
// .htaccess gives /integration/ (the preview server doesn't read it).
{
  const other = await browser.newPage();
  const errors = [];
  other.on('pageerror', (e) => errors.push(e.message));
  other.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  await other.route(`${BASE}/integration/**`, async (route) => {
    const response = await route.fetch();
    await route.fulfill({ response, headers: { ...response.headers(), 'access-control-allow-origin': '*' } });
  });
  await other.route('http://other-site.example/', (r) => r.fulfill({ contentType: 'text/html', body: `<!doctype html><html lang="fr"><body>
  <quetes-de-sysadmin story="packet" save-key="cross"></quetes-de-sysadmin>
  <script type="module" src="${BASE}/integration/quetes-de-sysadmin.js"></script></body></html>` }));
  await other.goto('http://other-site.example/');
  await other.waitForFunction(() => document.querySelector('quetes-de-sysadmin')?.shadowRoot?.querySelector('.output pre'), null, { timeout: 30000 });
  await other.waitForTimeout(300);
  check((await other.locator('quetes-de-sysadmin .output').textContent()).includes('Le Paquet perdu'), 'embedding from another origin: the chunks load from the game\'s site, the story opens in French');
  check(errors.length === 0, `embedding from another origin: no console error ${errors.join(' ')}`);
  await other.close();
}

await browser.close();
console.log(failures ? `${failures} échec(s)` : 'Tout est bon.');
process.exit(failures ? 1 : 0);
