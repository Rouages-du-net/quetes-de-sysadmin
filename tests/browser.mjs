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

// The preview server doesn't read .htaccess: we add ourselves the CSP
// header Apache will send, so that a violation fails the test.
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
  check((await game.locator('.output').textContent()).includes('Bienvenue sur ton poste'), `${width} px: starting from the workstation`);
  check(await game.locator('button[data-story="1"]').isDisabled(), `${width} px: without its key, the Datacenter is locked`);
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
  for (const c of ['mv Jetee/filet Port/Hangar', 'cd Port/Remise']) await tape(c);
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
  const notebook = game.locator('details.notebook');
  await notebook.locator('summary').click();
  check((await notebook.locator('dt').allTextContents()).includes('nano'), `${width} px: nano is in the notebook`);
  check((await notebook.locator('summary').textContent()).match(/\(\d+ commandes\)/), `${width} px: the notebook counts its commands`);
  const [download] = await Promise.all([page.waitForEvent('download'), notebook.locator('.notebook-actions button').first().click()]);
  check(download.suggestedFilename() === 'carnet-du-sysadmin.md', `${width} px: the notebook downloads as Markdown`);
  await page.reload();
  check((await game.locator('details.notebook dt').allTextContents()).includes('nano'), `${width} px: the notebook is kept in the browser`);
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
  // Exam mode: the checkbox restarts the current chapter, the timer starts.
  await tape('ssh royaume');
  await game.locator('.exam input').check();
  check((await game.locator('.output').textContent()).includes('Mode examen'), `${width} px: exam mode is announced`);
  await page.waitForTimeout(1100);
  check(/⏱ 00:0\d/.test(await game.locator('.timer').textContent()), `${width} px: the timer is running`);
  await game.locator('.exam input').uncheck();
  check((await game.locator('.timer').textContent()) === '', `${width} px: without exam, no more timer`);
  // A chapter in progress: exam mode would restart it, so we ask first.
  await tape('ls');
  await game.locator('.exam input').click();
  const confirmation = game.locator('dialog.exam-window');
  check((await confirmation.evaluate((d) => d.open)) && !(await game.locator('.exam input').isChecked()), `${width} px: exam mode asks for confirmation`);
  await confirmation.locator('button', { hasText: 'Annuler' }).click();
  check(!(await confirmation.evaluate((d) => d.open)) && !(await game.locator('.exam input').isChecked()) && (await game.locator('.timer').textContent()) === '', `${width} px: cancel changes nothing`);
  await game.locator('.exam input').click();
  await confirmation.locator('button', { hasText: 'mode examen' }).click();
  check((await game.locator('.exam input').isChecked()) && /⏱/.test(await game.locator('.timer').textContent()), `${width} px: confirmed, exam mode starts`);
  await game.locator('.exam input').uncheck();
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
  await page.locator('a[href="/en/teachers/"]').click();
  await page.waitForURL(/\/en\/teachers\//);
  check((await page.locator('h1').textContent()).includes('For teachers'), `en ${width} px: the teachers' page in English`);
  check((await page.locator('#c-bottleneck dt').first().textContent()) === 'Goal', `en ${width} px: sheets in English`);
  check((await page.locator('.language a').getAttribute('href')) === '/fr/enseignants/', `en ${width} px: link to the sheets in French`);
  check(!(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)), `en ${width} px: sheets without horizontal scrolling`);
  check(errors.length === 0, `en ${width} px: sheets without console error ${errors.join(' ')}`);
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
  check((await game.locator('.notebook summary').textContent()).includes('Le carnet de Lina'), `progress ${width} px: the name at the top of the notebook`);

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
  await third.waitForFunction(() => document.querySelector('quetes-de-sysadmin')?.shadowRoot?.querySelector('.notebook summary')?.textContent?.includes('Lina'));
  check((await game.locator('.notebook summary').textContent()).includes('Le carnet de Lina'), `progress ${width} px: the file restores everything, name and notebook included`);
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
  const link = game.locator('.tips button', { hasText: 'Succès' });
  check(/Succès \(\d+\/\d+\)/.test(await link.textContent()), `achievements: the count on the link (${await link.textContent()})`);
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
  await game.locator('.exam input').check();
  await game.locator('.mission-button').click();
  check(!(await mission.locator('.help').isVisible()), 'hints: nothing in exam mode');
  await page.keyboard.press('Escape');
  check(errors.length === 0, `hints: no console error ${errors.join(' ')}`);
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
  check(csv.includes("'=1+1") && csv.includes('Lina;5/'), `class ${width} px: the CSV, without formulas`);
  check(!(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)), `class ${width} px: no horizontal scrolling of the page`);
  if (process.env.CAPTURES) await page.screenshot({ path: `${process.env.CAPTURES}/classe-${width}.png` });
  check(errors.length === 0, `class ${width} px: no console error ${errors.join(' ')}`);
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
  await game.locator('.view-choice button', { hasText: 'Baies' }).click();
  check((await menu.getAttribute('data-view')) === 'racks' && !(await game.locator('.host').first().isVisible()), `display ${width} px: the rack view`);
  await game.locator('.view-choice button', { hasText: 'Carte du réseau' }).click();
  await game.locator('.view-choice button', { hasText: 'Baies' }).click();
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
  check((await game.locator('.terminal').getAttribute('data-theme')) === 'amber' && (await menu.getAttribute('data-view')) === 'racks', `display ${width} px: the settings are kept`);
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
  check((await maps.count()) === 21 && (await game.locator('.paths-progress').textContent()).includes('1 sur 21'), `paths ${width} px: the path and its progress`);
  const next = game.locator('.paths-list button[data-next]');
  check((await next.textContent()).includes('Le pare-feu') && (await game.locator('.paths-list button[data-state="locked"]').first().textContent()).includes('D\'abord'), `paths ${width} px: the next one, and what is waiting`);
  await next.click();
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

// On-call duty: the incident of the day, drawn among the stories open after
// L'Effaceur (fixed date: 14 January 2027, "First day"),
// the budget that melts, the score card at the end, the result kept.
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
  check((await game.locator('.incident-text').textContent()).includes('Premier jour'), `on-call ${width} px: the incident of the day is announced`);
  // The clock is stopped: time only moves with runFor (otherwise a second may pass before the gauge is read).
  await page.clock.pauseAt(new Date('2027-01-14T10:00:10'));
  await game.locator('.incident-button').click();
  const window = game.locator('dialog.on-call-window').first();
  check((await window.evaluate((d) => d.open)) && (await window.textContent()).includes('14 janvier 2027'), `on-call ${width} px: the on-call dialog`);
  await window.locator('button', { hasText: 'Prendre l' }).click();
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
  check(map.includes('astreinte du 2027-01-14') && map.includes('« Premier jour »') && /[🟩🟨⬜]{5} \d+ % du budget/.test(map) && map.includes('une erreur'), `on-call ${width} px: the score card`);
  const box = await end.boundingBox();
  check(box.x >= 0 && box.x + box.width <= width, `on-call ${width} px: the dialog fits on the screen`);
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

// Embedding in any page, with only the embeddable file.
const page = await browser.newPage();
await page.route(`${BASE}/autre-site.html`, (r) => r.fulfill({ contentType: 'text/html', body: `<!doctype html><html lang="en"><body style="font-family:serif">
  <h1>Another site</h1>
  <quetes-de-sysadmin histoire="paquet" cle="test" theme="sombre"></quetes-de-sysadmin>
  <script type="module" src="${BASE}/integration/quetes-de-sysadmin.js"></script></body></html>` }));
await page.goto(`${BASE}/autre-site.html`);
await page.waitForFunction(() => document.querySelector('quetes-de-sysadmin')?.shadowRoot?.querySelector('.output pre'));
// With no language attribute, the game takes the page's language (here lang="en").
check((await page.locator('quetes-de-sysadmin .output').textContent()).includes('The Lost Packet'), 'embedding: the requested story opens, in the page language');
check((await page.evaluate(() => getComputedStyle(document.querySelector('h1')).fontFamily)).includes('serif'), 'embedding: the page styles are not touched');
await page.addStyleTag({ content: 'quetes-de-sysadmin { --qds-accent: rgb(1, 2, 3); }' });
check(
  (await page.evaluate(() => getComputedStyle(document.querySelector('quetes-de-sysadmin').shadowRoot.querySelector('a')).color)) === 'rgb(1, 2, 3)',
  'embedding: colours are set from the page (--qds-accent)',
);

await browser.close();
console.log(failures ? `${failures} échec(s)` : 'Tout est bon.');
process.exit(failures ? 1 : 0);
