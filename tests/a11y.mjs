// Accessibility in Chromium (see docs/ACCESSIBILITY.md): axe-core on every
// kind of page and state of the game (home pages, a chapter in play, its
// dialogs, nano, the manual, the error explainer, the teachers' pages, 404,
// the root's language choice), light and dark, at 1000 and 375 px; then the
// checks axe cannot make (focus, live regions, ligatures, reflow, text
// spacing, forced colours, reduced motion). Fails on a serious or critical
// axe violation, or on a failed check. axe-core is a devDependency: it is
// injected by the test, never shipped.
// Run after "npm run build", with the preview server up:
//   npm run preview &   then   node tests/a11y.mjs   (also run by npm run test:browser)
// A11Y_SHOTS=dir saves a screenshot of some states.

import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { chromium } from 'playwright';

const BASE = process.env.BASE ?? 'http://localhost:4340';
const CHROMIUM = process.env.CHROMIUM ?? '/opt/pw-browsers/chromium';
const SHOTS = process.env.A11Y_SHOTS;
const AXE = createRequire(import.meta.url).resolve('axe-core/axe.min.js');
const browser = await chromium.launch({ executablePath: existsSync(CHROMIUM) ? CHROMIUM : undefined, args: ['--headless=new'] });

let failures = 0;
const check = (cond, msg) => {
  console.log(`${cond ? '✓' : '✗'} ${msg}`);
  if (!cond) failures++;
};

// The game is ready once its first output is there and no story is loading.
const READY = () => {
  const host = document.querySelector('quetes-de-sysadmin');
  if (!host) return true;
  const root = host.shadowRoot;
  return !host.hasAttribute('aria-busy') && !!root?.querySelector('.qds .output pre') && !root.querySelector('.qds[aria-busy]');
};
const waitReady = async (page) => {
  for (let i = 0; i < 300 && !(await page.evaluate(READY).catch(() => true)); i++) await new Promise((r) => setTimeout(r, 100));
};
const open = async ({ width = 1000, scheme = 'dark', save, motion, forced, extra } = {}) => {
  const context = await browser.newContext({ viewport: { width, height: 900 }, colorScheme: scheme, serviceWorkers: 'block', reducedMotion: motion, forcedColors: forced });
  // The intro tour marked as seen; a save given by the test.
  await context.addInitScript((s) => {
    try {
      localStorage.setItem('quetes-de-sysadmin-display', JSON.stringify({ tour: 'done', startOffer: 'done' }));
      if (s.save) localStorage.setItem('quetes-de-sysadmin', JSON.stringify(s.save));
      // Other keys (on-call results, runs…), written once.
      for (const [k, v] of Object.entries(s.extra ?? {})) if (localStorage.getItem(k) === null) localStorage.setItem(k, JSON.stringify(v));
    } catch {}
  }, { save, extra });
  const page = await context.newPage();
  page.errors = [];
  page.on('pageerror', (e) => page.errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && page.errors.push(m.text()));
  page.go = async (path) => {
    await page.goto(`${BASE}${path}`);
    await waitReady(page);
  };
  return page;
};

// axe-core, on the whole page (the game's open shadow root included).
const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'];
const counts = { serious: 0, critical: 0, moderate: 0, minor: 0 };
const seen = new Map();
async function audit(page, label) {
  if (!(await page.evaluate(() => 'axe' in window))) await page.addScriptTag({ path: AXE });
  const result = await page.evaluate(
    (tags) => window.axe.run(document, { runOnly: { type: 'tag', values: tags }, resultTypes: ['violations'] }),
    TAGS,
  );
  const bad = [];
  for (const v of result.violations) {
    counts[v.impact] = (counts[v.impact] ?? 0) + v.nodes.length;
    const key = `${v.id}`;
    if (!seen.has(key)) seen.set(key, { impact: v.impact, help: v.help, where: new Set() });
    seen.get(key).where.add(label);
    if (v.impact === 'serious' || v.impact === 'critical')
      bad.push(`${v.id} (${v.impact}): ${v.help}\n      ${v.nodes.slice(0, 4).map((n) => `${n.target.join(' >>> ')} ${n.failureSummary?.split('\n')[1]?.trim() ?? ''}`).join('\n      ')}`);
  }
  check(bad.length === 0, `axe ${label}${bad.length ? `:\n    ${bad.join('\n    ')}` : ''}`);
}

const game = (page) => page.locator('quetes-de-sysadmin');
const type = async (page, line) => {
  const input = game(page).locator('form input');
  await input.fill(line);
  await input.press('Enter');
  await waitReady(page);
};
const closeDialog = async (page) => {
  await page.keyboard.press('Escape');
  await page.waitForTimeout(50);
};
const shot = async (page, name) => SHOTS && page.screenshot({ path: `${SHOTS}/a11y-${name}.png` });

// ——— axe on every state, light and dark, wide and narrow ———
// (A11Y_SKIP_AXE=1 runs only the other checks, while working on them.)
for (const scheme of process.env.A11Y_SKIP_AXE ? [] : ['dark', 'light'])
  for (const width of [1000, 375]) {
    const tag = `${scheme} ${width}px`;
    const page = await open({ width, scheme });
    await page.go('/');
    await audit(page, `${tag} root language choice`);
    await page.go('/404.html');
    await audit(page, `${tag} 404`);
    await page.go('/en/teachers/');
    await audit(page, `${tag} teachers' sheets (en)`);
    await page.go('/fr/enseignants/classe/');
    await audit(page, `${tag} class table (fr)`);
    await page.go('/en/');
    await audit(page, `${tag} home en (menu)`);
    await page.go('/fr/');
    await audit(page, `${tag} home fr (menu)`);
    const g = game(page);
    await g.locator('.start-here-button').click();
    await g.locator('dialog.start-window[open] input[type="radio"]').first().waitFor();
    for (const q of await g.locator('dialog.start-window fieldset').all()) await q.locator('input').first().check();
    await audit(page, `${tag} "Where do I start?" dialog`);
    await closeDialog(page);
    await g.locator('.stories .feedback-button').click();
    await g.locator('dialog.feedback-window[open] textarea').first().waitFor();
    await audit(page, `${tag} feedback dialog`);
    await shot(page, `feedback-${scheme}-${width}`);
    await closeDialog(page);
    await g.locator('.reminder-button').click();
    await g.locator('dialog.reminder-window[open] h2').filter({ hasText: /\S/ }).waitFor();
    await audit(page, `${tag} daily reminder dialog`);
    await closeDialog(page);
    // A chapter in play.
    await type(page, 'ssh royaume');
    await type(page, 'yes');
    await type(page, 'man ls');
    await type(page, 'cat nulle-part.txt');
    await g.locator('.output .explainer-button').last().click();
    await audit(page, `${tag} chapter in play, man page, error explainer open`);
    await shot(page, `chapter-${scheme}-${width}`);
    for (const [button, name] of [
      ['.mission-button', 'mission'],
      ['.map-button', 'map'],
      ['.notebook-button', 'notebook'],
    ]) {
      await g.locator(button).click();
      await audit(page, `${tag} ${name} dialog`);
      await closeDialog(page);
    }
    for (const [text, name] of [
      ['progression', 'my progress'],
      ['Succès', 'achievements'],
    ]) {
      await g.locator('.chapter-actions .pill', { hasText: text }).first().click();
      await audit(page, `${tag} ${name} dialog`);
      await closeDialog(page);
    }
    // The other terminal themes (settings).
    for (const theme of ['amber', 'contrast', 'paper']) {
      await g.locator('.settings select').selectOption(theme);
      await audit(page, `${tag} terminal theme ${theme}`);
    }
    await g.locator('.settings select').selectOption('phosphor');
    await type(page, 'exit');
    await type(page, 'nano notes.txt');
    await g.locator('.nano-text').fill('Bonjour\n');
    await audit(page, `${tag} nano`);
    await shot(page, `nano-${scheme}-${width}`);
    check(page.errors.length === 0, `${tag}: no console error ${page.errors.join(' ')}`);
    await page.context().close();
    // The network plan (La Ruche).
    const hive = await open({
      width,
      scheme,
      save: { finished: ['lighthouse', 'village', 'root', 'backup', 'first-day', 'second-day', 'reboot-night', 'lost-packet', 'shut-the-door', 'firewall', 'keys', 'jump'], story: 'hive' },
    });
    await hive.go('/fr/');
    await game(hive).locator('.map-button').click();
    await game(hive).locator('[role="tab"]', { hasText: 'Réseau' }).click();
    await audit(hive, `${tag} map, Network tab`);
    await hive.context().close();
    // The on-call streak under the menu's entry (streak.ts): two days solved, up to yesterday.
    const day = (n) => {
      const d = new Date();
      d.setDate(d.getDate() - n);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    };
    const result = { chapter: 'first-day', remaining: 900000, time: 600000, hints: 0, errors: 0 };
    const onCall = await open({ width, scheme, save: { finished: ['lighthouse', 'village', 'root', 'backup'] }, extra: { 'quetes-de-sysadmin-on-call': { [day(2)]: result, [day(1)]: result }, 'quetes-de-sysadmin-whats-new': { until: '2026-11-01', fresh: {} } } });
    await onCall.go('/fr/');
    await game(onCall).locator('.stories .streak').waitFor();
    await game(onCall).locator('.new-badge:not([hidden])').first().waitFor({ state: 'attached' });
    await audit(onCall, `${tag} menu with the on-call streak and "New" badges`);
    await onCall.context().close();
    // Replay and compare (runs.ts): a run kept, the chapter finished again, the summary's comparison.
    const earlier = { chapter: 'lighthouse', date: '2026-11-20T10:00:00.000Z', time: 400000, commands: 3, errors: 1, hints: 0, distinct: 2, exam: false, lines: ['ls', 'cd Port', 'ls -a'] };
    const replay = await open({ width, scheme, extra: { 'quetes-de-sysadmin-runs': { lighthouse: [earlier] } } });
    await replay.go('/fr/');
    await game(replay).locator('button[data-story="0"]').click();
    await waitReady(replay);
    await type(replay, 'mv Jetee/filet Port/Hangar');
    await type(replay, 'mv Port/Remise/.ampoule_de_secours Jetee/Phare/Escalier/Lanterne/ampoule');
    await audit(replay, `${tag} chapter finished, summary with replay`);
    await game(replay).locator('.output .summary-button').click();
    await game(replay).locator('dialog.summary-window .compare h3').first().waitFor();
    await audit(replay, `${tag} summary dialog with the comparison`);
    await shot(replay, `compare-${scheme}-${width}`);
    check(replay.errors.length === 0, `${tag}: no console error (replay) ${replay.errors.join(' ')}`);
    await replay.context().close();
  }

// ——— What axe cannot check ———
// The element's active element, through the shadow root.
const activeInfo = (page) =>
  page.evaluate(() => {
    let a = document.activeElement;
    while (a?.shadowRoot?.activeElement) a = a.shadowRoot.activeElement;
    if (!a || a === document.body) return null;
    const s = getComputedStyle(a);
    // The colour behind it: the first opaque background up the tree (through the shadow root).
    let bg = 'rgb(255, 255, 255)';
    for (let n = a; n; n = n.parentElement ?? n.getRootNode().host) {
      const c = getComputedStyle(n).backgroundColor;
      if (c && c !== 'transparent' && !/rgba\(.*, 0\)$/.test(c)) {
        bg = c;
        break;
      }
    }
    const r = a.getBoundingClientRect();
    return {
      tag: a.tagName.toLowerCase(),
      cls: a.className?.baseVal ?? a.className,
      text: (a.textContent ?? '').trim().slice(0, 30),
      inGame: a.getRootNode() !== document,
      outline: { style: s.outlineStyle, width: parseFloat(s.outlineWidth), color: s.outlineColor },
      shadow: getComputedStyle(a.closest('.field') ?? a).boxShadow,
      bg,
      visible: r.width > 0 && r.height > 0,
    };
  });
const rgb = (c) => (c.match(/[\d.]+/g) ?? []).slice(0, 3).map(Number);
// color-mix() and oklab come back as "oklab(…)" or "color(srgb …)": the test uses only rgb() colours.
const contrast = (a, b) => {
  const lum = ([r, g, bl]) =>
    [r, g, bl].map((v) => v / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)).reduce((s, v, i) => s + v * [0.2126, 0.7152, 0.0722][i], 0);
  const [x, y] = [lum(rgb(a)), lum(rgb(b))].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};

for (const scheme of ['dark', 'light']) {
  // The keyboard alone, from the top of the page: a skip link first, then
  // every stop with a visible focus ring of at least 3:1.
  const page = await open({ scheme });
  await page.go('/fr/');
  await page.keyboard.press('Tab');
  const skip = await activeInfo(page);
  check(skip?.cls === 'skip-link' && skip.visible, `${scheme}: the first Tab reaches the skip link, visible`);
  await page.keyboard.press('Enter');
  check((await page.evaluate(() => document.activeElement?.id)) === 'content', `${scheme}: the skip link moves the focus to the content`);
  const weak = [];
  let reachedInput = false;
  for (let i = 0; i < 60; i++) {
    await page.keyboard.press('Tab');
    const a = await activeInfo(page);
    if (!a) continue;
    if (a.tag === 'input' && a.inGame && a.cls === '') {
      reachedInput = true;
      // The command line: the caret and a line under the field.
      if (a.shadow === 'none') weak.push('command line without its focus line');
      break;
    }
    const ring = a.outline.style !== 'none' && a.outline.width >= 2;
    const ratio = /^rgb/.test(a.outline.color) && /^rgb/.test(a.bg) ? contrast(a.outline.color, a.bg) : 3;
    if (!ring || ratio < 3) weak.push(`${a.tag}.${a.cls} "${a.text}" (${a.outline.style} ${a.outline.width}px, ${ratio.toFixed(2)}:1)`);
  }
  check(reachedInput, `${scheme}: Tab reaches the command line`);
  check(weak.length === 0, `${scheme}: every keyboard stop shows a focus ring of 3:1 or more ${weak.join('; ')}`);
  await page.context().close();
}

{
  const page = await open({ width: 1000 });
  await page.go('/fr/');
  const g = game(page);
  const input = g.locator('form input');
  check((await page.evaluate(() => document.documentElement.lang)) === 'fr' && (await g.locator('.qds').first().getAttribute('lang')) === 'fr', 'lang: the page and the game say fr');
  // The command line's name has the prompt; its description, the keys.
  await type(page, 'ssh royaume');
  await type(page, 'yes');
  check((await g.getByRole('textbox', { name: /^Commande vous@royaume:~\$$/ }).count()) === 1, 'the command line is named with its prompt ("Commande vous@royaume:~$")');
  check((await input.getAttribute('aria-describedby')) && (await g.locator(`#${await input.getAttribute('aria-describedby')}`).textContent()).includes('Alt+R'), 'the command line describes its keys');
  check((await g.locator('.output').getAttribute('role')) === 'log' && (await g.locator('.output').getAttribute('aria-live')) === 'polite', 'the output is a polite log');
  // Tab completes and keeps the focus; Shift+Tab leaves backwards; Escape then Tab forwards.
  await input.fill('ca');
  await input.press('Tab');
  const inInput = () => input.evaluate((i) => i.getRootNode().activeElement === i);
  check((await input.inputValue()) === 'cat ' && (await inInput()), 'Tab completes and the focus stays on the line');
  await input.fill('');
  await input.press('Shift+Tab');
  check(!(await inInput()), 'Shift+Tab leaves the command line (no keyboard trap)');
  await input.focus();
  await input.press('Escape');
  await input.press('Tab');
  const after = await activeInfo(page);
  check(!(await inInput()) && after?.inGame, `Escape then Tab leaves the command line forward (${after?.tag}.${after?.cls})`);
  await input.focus();
  // Alt+R: the last output, read again in the polite status region.
  await type(page, 'ls');
  const listing = (await g.locator('.output pre').last().textContent()).trim();
  await input.press('Alt+r');
  await page.waitForTimeout(150);
  const status = g.locator('.qds > p[role="status"]').last();
  check((await status.textContent()).trim() === listing, `Alt+R reads the last output again ("${listing.slice(0, 40)}")`);
  check(await inInput(), 'Alt+R keeps the focus on the line');
  await type(page, 'cd Port');
  await input.press('Alt+r');
  await page.waitForTimeout(150);
  check((await status.textContent()).includes('rien affiché'), 'Alt+R after a silent command says so');
  // The button that does the same, shown when focused.
  const reread = g.locator('.reread-button');
  await reread.focus();
  const box = await reread.boundingBox();
  check(box && box.width > 24 && box.height >= 24, 'the "read again" button shows when it has the focus');
  // Ligatures: none in the terminal, the command line, nano, the notebook's code.
  const ligatures = await page.evaluate(() => {
    const root = document.querySelector('quetes-de-sysadmin').shadowRoot;
    const out = [];
    for (const sel of ['.terminal', '.output pre', 'form input', '.prompt', '.notebook code', '.shortcuts kbd', '.title']) {
      const e = root.querySelector(sel);
      if (!e) continue;
      const s = getComputedStyle(e);
      out.push([sel, s.fontVariantLigatures, s.fontFeatureSettings]);
    }
    return out;
  });
  check(ligatures.length >= 6 && ligatures.every(([, v, f]) => v === 'none' && /"calt" 0/.test(f) && /"liga" 0/.test(f)), `no ligatures in monospace text ${JSON.stringify(ligatures.filter(([, v]) => v !== 'none'))}`);
  // The first chapter to its end with the keyboard alone: its end is
  // announced (politely, the focus stays), and Escape then Tab reaches "Next chapter".
  await type(page, 'cd');
  for (const line of ['mv Jetee/filet Port/Hangar', 'mv Port/Hangar/filet Port', 'cd Port/Remise', 'mv .ampoule_de_secours ~/Jetee/Phare/Escalier/Lanterne/ampoule']) {
    await input.focus();
    await page.keyboard.type(line);
    await page.keyboard.press('Enter');
    await waitReady(page);
  }
  await page.waitForTimeout(150);
  check((await status.textContent()).includes('Chapitre terminé') && (await inInput()), 'chapter 1 played with the keyboard: its end announced, the focus kept on the line');
  await page.keyboard.press('Escape');
  await page.keyboard.press('Tab');
  const next = await activeInfo(page);
  check(next?.text.startsWith('Chapitre suivant'), `Escape then Tab reaches "Next chapter" (${next?.tag} "${next?.text}")`);
  await page.keyboard.press('Enter');
  await waitReady(page);
  check((await g.locator('.output').textContent()).includes('chapitre 2') && (await inInput()), 'Enter opens chapter 2, the focus back on the line');
  // nano (on the workstation)
  await type(page, 'exit');
  // its field is described by its shortcuts; the status is announced.
  await type(page, 'nano essai.txt');
  const zone = g.locator('.nano-text');
  const described = (await zone.getAttribute('aria-describedby')).split(' ');
  check((await g.locator(`#${described[0]}`).textContent()).includes('^X') && (await g.locator('.nano-status').getAttribute('role')) === 'status', 'nano: shortcuts read with the field, status line announced');
  const nanoStyle = await zone.evaluate((z) => getComputedStyle(z).fontVariantLigatures);
  check(nanoStyle === 'none', 'nano: no ligatures');
  await zone.press('Control+x');
  // Every dialog: Escape closes it and the focus lands on a visible control of the game (the line, or the button that opened it).
  for (const [opener, name] of [
    ['.mission-button', 'mission'],
    ['.map-button', 'map'],
    ['.notebook-button', 'notebook'],
    ['.chapter-actions .pill >> nth=1', 'my progress'],
    ['.chapter-actions .pill >> nth=2', 'achievements'],
    ['.chapter-actions .pill >> nth=3', 'feedback'],
    ['.reminder-button', 'daily reminder'],
  ]) {
    await g.locator(opener).focus();
    await page.keyboard.press('Enter');
    await page.waitForTimeout(150);
    const inside = await page.evaluate(() => {
      const root = document.querySelector('quetes-de-sysadmin').shadowRoot;
      return !!root.querySelector('dialog[open]')?.contains(root.activeElement);
    });
    await page.keyboard.press('Escape');
    await page.waitForTimeout(150);
    const a = await activeInfo(page);
    check(inside && a?.inGame && a.visible, `${name}: the focus goes into the dialog, and back to the game after Escape (${a?.tag}.${a?.cls})`);
  }
  check(page.errors.length === 0, `keyboard and screen reader checks: no console error ${page.errors.join(' ')}`);
  await page.context().close();
}

// A follow (tail -f): the log goes quiet, a digest comes instead (every ten
// seconds, how many lines and the last one), Escape stops it.
{
  const page = await open({ save: { finished: ['lighthouse', 'village', 'root', 'backup'] } });
  await page.go('/fr/');
  const g = game(page);
  const status = g.locator('.qds > p[role="status"]').last();
  for (const l of ['ssh datacenter', 'yes', 'tail -f /var/log/nginx/access.log']) await type(page, l);
  const following = (await g.locator('.stop-follow').isVisible()) && (await g.locator('.output').getAttribute('aria-live')) === 'off';
  await page.waitForTimeout(300);
  check(following && (await status.textContent()).includes('résumé'), 'tail -f: the log goes quiet, the start is announced');
  await page.waitForTimeout(10_500);
  const digest = await status.textContent();
  check(/nouvelles? lignes?/i.test(digest) && digest.includes('198.51.100.77'), `tail -f: a digest after ten seconds ("${digest.slice(0, 80)}…")`);
  await page.keyboard.press('Escape');
  const input = g.locator('form input');
  check(
    (await g.locator('.output').getAttribute('aria-live')) === 'polite' && (await input.evaluate((i) => i.getRootNode().activeElement === i)),
    'tail -f: Escape stops it, the log speaks again, the focus is back on the line',
  );
  check(page.errors.length === 0, `tail -f: no console error ${page.errors.join(' ')}`);
  await page.context().close();
}

// What a screen reader is given to say (docs/screen-reader-walkthrough.md):
// every text added to a live region (log, status, aria-live), in order,
// without what is aria-hidden, recorded by a MutationObserver on the page
// and the game's shadow root. Not a real screen reader: the order and the
// texts it receives, not how it speaks them.
function recordSpoken() {
  window.__spoken = [];
  const hidden = (e) => e.nodeType === 1 && (e.hasAttribute('hidden') || e.getAttribute('aria-hidden') === 'true' || getComputedStyle(e).display === 'none');
  const text = (n) => {
    if (n.nodeType === 3) return n.data;
    if (n.nodeType !== 1 || hidden(n)) return '';
    return [...n.childNodes].map(text).join('') + (/^(P|DIV|PRE|LI)$/.test(n.tagName) ? '\n' : '');
  };
  const region = (n) => {
    for (let e = n.nodeType === 1 ? n : n.parentNode; e?.nodeType === 1; e = e.parentNode) {
      if (hidden(e)) return null;
      const live = e.getAttribute('aria-live') ?? { log: 'polite', status: 'polite', alert: 'assertive' }[e.getAttribute('role')];
      if (!live) continue;
      for (let a = e.parentNode; a?.nodeType === 1; a = a.parentNode) if (hidden(a)) return null;
      if (live === 'off') return null;
      const atomic = e.getAttribute('aria-atomic') ? e.getAttribute('aria-atomic') === 'true' : /^(status|alert)$/.test(e.getAttribute('role'));
      return { e, atomic, role: e.getAttribute('role') ?? live };
    }
    return null;
  };
  const watch = (root) =>
    new MutationObserver((ms) => {
      const done = new Set();
      for (const m of ms)
        for (const n of m.type === 'characterData' ? [m.target] : m.addedNodes) {
          const r = region(n);
          if (!r || (r.atomic && done.has(r.e))) continue;
          done.add(r.e);
          const s = text(r.atomic ? r.e : n).replace(/\s*\n\s*/g, '\n').trim();
          if (s) window.__spoken.push({ role: r.role, text: s });
        }
    }).observe(root, { childList: true, subtree: true, characterData: true });
  const attach = Element.prototype.attachShadow;
  Element.prototype.attachShadow = function (o) {
    const r = attach.call(this, o);
    watch(r);
    return r;
  };
}
{
  // Chapter 1 still to play; The Root finished, so the datacenter's key is there.
  const page = await open({ save: { finished: ['village', 'root', 'backup'] } });
  await page.context().addInitScript(recordSpoken);
  await page.go('/fr/');
  const g = game(page);
  const input = g.locator('form input');
  const heard = () => page.evaluate(() => window.__spoken.splice(0));
  const say = async (line) => {
    await input.focus();
    await page.keyboard.type(line);
    await page.keyboard.press('Enter');
    await waitReady(page);
    await page.waitForTimeout(200);
    return heard();
  };
  const show = (said) => said.map((a) => `${a.role}: ${a.text.slice(0, 60)}`).join(' | ');
  await heard();
  // The echo: the command, never the prompt ("vous@poste:~$"), which the line's name already says.
  const all = [];
  let said = await say('ssh royaume');
  all.push(...said);
  check(said[0]?.role === 'log' && said[0].text === 'ssh royaume', `echo: the command alone, without the prompt (${show(said.slice(0, 1))})`);
  // A question changes the line's name without moving the focus: it is announced, once.
  const question = said.filter((a) => a.role === 'status' && /continue connecting/.test(a.text));
  check(question.length === 1 && said.at(-1) === question[0], `ssh's question announced once, after the output (${show(said)})`);
  said = await say('yes');
  check(said[0]?.text === 'yes' && !said.some((a) => /continue connecting/.test(a.text)), `the answer read alone, the question not again (${show(said.slice(0, 2))})`);
  check(said.some((a) => a.text.includes('chapitre 1')), 'the chapter opens: its welcome is in the log');
  // Every command: no text announced twice, no prompt, no decoration.
  const DECOR = /[─-▟●○✔✓\u{1F3C6}]|(?<!\S)-{4,}(?!\S)/u;
  for (const line of ['ls', 'cd Port/Remise', 'ls -a', 'cat absent.txt', 'cd', 'for i in 1 2']) {
    said = await say(line);
    all.push(...said);
    const texts = said.map((a) => a.text);
    check(new Set(texts).size === texts.length, `${line}: nothing announced twice (${show(said)})`);
    check(said[0]?.text === line && !texts.some((x) => /vous@royaume/.test(x)), `${line}: the echo is the command alone`);
  }
  check(all.some((a) => a.role === 'log' && /no such file|aucun fichier/i.test(a.text)), 'an error is announced in the log');
  check(all.at(-1)?.role === 'status' && /pas finie/.test(all.at(-1).text), `the secondary prompt (>) is announced (${show(all.slice(-1))})`);
  said = await say('do pwd; done');
  check(said[0]?.text === 'do pwd; done' && said.length === 2 && said[1].text.split('\n').length === 2, `the loop's end: its line, then its output (${show(said)})`);
  // The chapter's end: its debrief in the log, then the polite status, each once.
  for (const line of ['mv Jetee/filet Port/Hangar', 'cd Port/Remise']) await say(line);
  said = await say('mv .ampoule_de_secours ~/Jetee/Phare/Escalier/Lanterne/ampoule');
  const done = said.filter((a) => a.text.includes('Chapitre terminé'));
  check(done.length === 1 && done[0].role === 'status' && said.indexOf(done[0]) === said.length - 1, `chapter's end: announced once, after the log (${show(said)})`);
  all.push(...said);
  const trophies = all.filter((a) => /Succès/.test(a.text));
  check(trophies.length > 0 && !trophies.some((a) => DECOR.test(a.text)), `an achievement is read without its trophy (${show(trophies)})`);
  // Decorations: systemctl's bullet stays on the screen, not in what is read.
  for (const line of ['exit', 'ssh datacenter', 'yes']) await say(line);
  said = await say('systemctl status nginx');
  const screen = await g.locator('.output pre').last().textContent();
  check(screen.includes('●') && said.some((a) => a.text.startsWith('nginx.service')) && !said.some((a) => DECOR.test(a.text)), `systemctl status: "●" shown, not read (${show(said.slice(1, 2))})`);
  all.push(...said);
  check(!all.some((a) => DECOR.test(a.text)), 'no box-drawing, status mark, rule nor trophy in any announcement');
  // Alt+R reads the output again, without its decorations.
  await input.press('Alt+r');
  await page.waitForTimeout(200);
  said = await heard();
  check(said.length === 1 && said[0].text.startsWith('nginx.service') && !DECOR.test(said[0].text), `Alt+R: the output again, without "●" (${show(said)})`);
  // The hints: the level opened is announced, the focus moves on (the button pressed disappears).
  await g.locator('.mission-button').click();
  await page.waitForTimeout(150);
  await heard();
  for (const expected of [/man /, /./, /./]) {
    const button = g.locator('.hint-button:not([hidden])').first();
    if (!(await button.count())) break;
    await button.focus();
    await page.keyboard.press('Enter');
    await page.waitForTimeout(150);
    said = await heard();
    const a = await activeInfo(page);
    check(said.length === 1 && said[0].role === 'status' && expected.test(said[0].text) && a?.tag === 'button' && a.visible, `a hint: announced once, the focus on "${a?.text}" (${show(said)})`);
  }
  await closeDialog(page);
  // The landmarks and the heading that lead to the terminal.
  check((await g.getByRole('heading', { name: 'Terminal', level: 2 }).count()) === 1, 'the terminal has a heading (H)');
  check((await g.getByRole('navigation', { name: /Histoires/ }).count()) === 1, 'the stories menu is a named navigation landmark');
  // Pictographs in the menu: "🔒 Terminez…" read without the padlock.
  const lockNames = await g.locator('nav button[data-chapter]').evaluateAll((bs) => bs.map((b) => b.textContent));
  check(lockNames.length > 0 && (await g.getByRole('button', { name: /🔒|✓/ }).count()) === 0, 'menu: chapter states read without their pictograph');
  check(page.errors.length === 0, `what is announced: no console error ${page.errors.join(' ')}`);
  await page.context().close();
}

// nano's question: its own letter for yes (French: O), read with the focus.
{
  const page = await open();
  await page.go('/fr/');
  const g = game(page);
  await type(page, 'nano essai.txt');
  await g.locator('.nano-text').press('a');
  await g.locator('.nano-text').press('Control+x');
  await page.waitForTimeout(100);
  const a = await activeInfo(page);
  const group = await g.locator('.nano [role="group"][aria-label]:not([hidden])').last().getAttribute('aria-label');
  check(a?.text === 'O Oui' && /Sauver/.test(group) && (await g.locator('.nano-status').getAttribute('aria-hidden')) === 'true', `nano: "Save modified buffer?" read with the focus on "${a?.text}", not twice`);
  await page.keyboard.press('n');
  await page.context().close();
}

// Reflow and text spacing (WCAG 1.4.10, 1.4.12): at 320 px, with the
// spacing a reader may force, no horizontal page scroll (the terminal's
// wide tables scroll inside their own block).
{
  const SPACING = '* { line-height: 1.5 !important; letter-spacing: 0.12em !important; word-spacing: 0.16em !important; } p { margin-bottom: 2em !important; }';
  for (const path of ['/fr/', '/en/teachers/', '/fr/enseignants/classe/', '/']) {
    const page = await open({ width: 320 });
    await page.go(path);
    await page.addStyleTag({ content: SPACING });
    await page.evaluate((css) => {
      const root = document.querySelector('quetes-de-sysadmin')?.shadowRoot;
      if (root) root.append(Object.assign(document.createElement('style'), { textContent: css }));
    }, SPACING);
    if (path === '/fr/') {
      await type(page, 'ssh royaume');
      await type(page, 'yes');
      await type(page, 'ls -la');
    }
    await page.waitForTimeout(100);
    const wide = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
    check(wide <= 0, `320 px with text spacing, ${path}: no horizontal page scroll (${wide} px over)`);
    if (path === '/fr/') await shot(page, 'reflow-320');
    await page.context().close();
  }
}

// Forced colours (Windows High Contrast): buttons keep a border, the focus a ring.
{
  const page = await open({ forced: 'active' });
  await page.go('/fr/');
  const g = game(page);
  const pill = await g.locator('.chapter-actions .pill').first().evaluate((b) => getComputedStyle(b).borderTopStyle);
  await g.locator('.mission-button').focus();
  const ring = await activeInfo(page);
  check(pill !== 'none' && ring?.outline.style !== 'none' && ring.outline.width >= 2, `forced colours: buttons keep a border (${pill}), the focus a ring (${ring?.outline.style} ${ring?.outline.width}px)`);
  check(!(await g.locator('.field').evaluate((f) => getComputedStyle(f.querySelector('.highlighting')).display !== 'none' && f.classList.contains('coloured'))), 'forced colours: the command line shows its own text, not the coloured copy');
  await shot(page, 'forced-colors');
  await page.context().close();
}

// Reduced motion: nothing moves, in the game nor on the page.
{
  const page = await open({ motion: 'reduce', save: { finished: ['lighthouse'], story: 'eraser' } });
  await page.go('/fr/');
  const moving = await page.evaluate(() => {
    const root = document.querySelector('quetes-de-sysadmin').shadowRoot;
    const all = [...document.querySelectorAll('*'), ...root.querySelectorAll('*')];
    return all
      .flatMap((e) => [getComputedStyle(e), getComputedStyle(e, '::before'), getComputedStyle(e, '::after')])
      .filter((s) => s.animationName !== 'none' || (s.transitionDuration && s.transitionDuration.split(',').some((d) => parseFloat(d) > 0))).length;
  });
  check(moving === 0, `reduced motion: no animation nor transition (${moving} found)`);
  await page.context().close();
}

console.log('\naxe, every state together (serious and critical fail the test):');
for (const [id, v] of seen) console.log(`  ${v.impact.padEnd(8)} ${id}: ${v.help} — ${[...v.where].slice(0, 3).join('; ')}${v.where.size > 3 ? '…' : ''}`);
console.log(`  nodes: ${JSON.stringify(counts)}`);

await browser.close();
if (failures) {
  console.error(`\n${failures} accessibility check(s) failed`);
  process.exit(1);
}
console.log('\nAccessibility: every check passed');
