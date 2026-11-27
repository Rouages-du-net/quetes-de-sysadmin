// The game's interface: the simulated terminal (a console that starts from the
// workstation and connects with ssh to the stories' machines), the menu of
// stories and chapters (shortcuts), the progress kept in the browser.
// mount() builds everything inside a container (an element or a component's
// shadow root), assuming nothing about the page that hosts it.
//
// Each part of the interface is a module of this directory, given the
// shared context (context.ts); mount() builds them, lays them out, and
// starts the game:
//   output.ts            the terminal's output and what is announced
//   terminal.ts          the command line, its keys, a follow, nano
//   run-line.ts          a line run: what it needs loaded, then the console
//   notes.ts             tips and the error explainer under an output
//   menu.ts              stories, chapters, learning paths
//   whats-new.ts         "New" badges and the installed app's badge
//   settings.ts          the display settings and full screen
//   exam.ts              exam mode and its timer
//   on-call-duty.ts      the incident of the day and the streak
//   autosave-banner.ts   the autosave and the offer to resume
//   tour.ts              the intro tour
//   *-dialog.ts          the dialogs: mission (hints, rescue), map, notebook,
//                        progress, achievements, summary (compare), start
//                        here, feedback, reminder

import type { Level } from '../engine/difficulty';
import { Console } from '../engine/console';
import type { Shell } from '../engine/shell';
// The menu reads the catalogue; a story's chapters load when it is opened (story-registry.ts).
import { CATALOGUE as STORIES } from '../engine/catalogue';
import { loadedStory, loadStory } from '../engine/story-registry';
import { storyMachine } from '../engine/machines';
import type { Notebook } from '../engine/notebook';
import { PATH } from '../engine/paths';
import { localDate } from '../engine/streak';
import { cleanName, cleanOnCall, type Backup, type OnCallResult } from '../engine/progress';
import { loadTexts, textsLoaded, translator, typography } from '../texts';
import { loadExamples } from '../engine/commands/manual';
import { DISPLAY, type Context, type Display, type Options } from './context';
import { el, icon, ICON_FEEDBACK, ICON_MAP, ICON_MISSION, ICON_NOTEBOOK, ICON_RESTART, quiet } from './dom';
import { outputPart } from './output';
import { terminalPart } from './terminal';
import { runLinePart } from './run-line';
import { notesPart } from './notes';
import { menuPart } from './menu';
import { whatsNewPart } from './whats-new';
import { settingsPart } from './settings';
import { examPart } from './exam';
import { onCallPart } from './on-call-duty';
import { autosavePart } from './autosave-banner';
import { tourPart } from './tour';
import { missionPart } from './mission-window';
import { mapPart } from './map-window';
import { notebookPart } from './notebook-window';
import { progressPart } from './progress-window';
import { achievementsPart } from './achievements-window';
import { summaryPart } from './summary';
import { startHerePart } from './start-here';
import { lazyDialog } from './lazy-dialog';

export type { Options } from './context';

export function mount(root: HTMLElement | ShadowRoot, options: Options = {}) {
  const t = translator(options.language);
  const typo = (text: string) => typography(text, t.language);
  // A dialog's texts (dialog-*.ftl, see src/texts/plugin.mjs) load when it
  // first opens: its fixed parts are empty text nodes until then, filled by
  // withTexts() before the dialog shows.
  const lazyNodes = new Map<string, [Text, string, boolean][]>();
  const lazy = (group: string, id: string, typographic = false) => {
    const node = document.createTextNode('');
    if (!lazyNodes.has(group)) lazyNodes.set(group, []);
    lazyNodes.get(group)!.push([node, id, typographic]);
    return node;
  };
  const withTexts = (group: string, then: () => void) => {
    const fill = () => {
      for (const [node, id, typographic] of lazyNodes.get(group) ?? []) node.textContent = typographic ? typo(t(id)) : t(id);
      lazyNodes.delete(group);
      then();
    };
    if (textsLoaded(t.language, group)) return fill();
    loadTexts(t.language, group).then(fill, () => ctx.announce(t('loading-failed')));
  };
  const KEY = options.saveKey ?? 'quetes-de-sysadmin';
  // Display (theme, size, menu view, colours): a setting of this browser only.
  const DISPLAY_KEY = `${KEY}-display`;
  let display: Display = { ...DISPLAY, path: PATH[0].id, startHere: {} };
  try {
    display = { ...display, ...JSON.parse(localStorage.getItem(DISPLAY_KEY) ?? '{}') };
  } catch {}

  // ——— Progress kept in this browser ———
  // Best times in exam mode (records, in ms); name shown at the top of the notebook (see progress.ts).
  let saved: Backup = {};
  try {
    saved = JSON.parse(localStorage.getItem(KEY) ?? '{}');
  } catch {}
  const gameTerminal = new Console({ language: t.language, finished: saved.finished, knownHosts: saved.known, ssh: saved.ssh });
  const finished = gameTerminal.finished;
  // The results of past on-call days, in this browser (the best of each day).
  let results: Record<string, OnCallResult> = {};
  try {
    results = cleanOnCall(JSON.parse(localStorage.getItem(`${KEY}-on-call`) ?? '{}'));
  } catch {}
  gameTerminal.exam = saved.exam === true;
  const chapters = (h: number) => STORIES[h].chapters;
  const open = (h: number, c: number) => c === 0 || finished.includes(chapters(h)[c - 1].id);

  // The rest of the context (elements, what one part asks of another) is set as the parts are built.
  const shared: Partial<Context> = {
    root,
    options,
    t,
    typo,
    lazy,
    withTexts,
    KEY,
    display,
    storeDisplay: () => {
      try {
        localStorage.setItem(DISPLAY_KEY, JSON.stringify(display));
      } catch {}
    },
    terminal: gameTerminal,
    finished,
    notebook: (saved.notebook && typeof saved.notebook === 'object' ? saved.notebook : {}) as Notebook,
    records: (saved.records && typeof saved.records === 'object' ? saved.records : {}) as Record<string, number>,
    achievements: saved.achievements && typeof saved.achievements === 'object' ? { ...saved.achievements } : {},
    // The tips already shown (see tips.ts).
    shownTips: Array.isArray(saved.tips) ? saved.tips.filter((x): x is string => typeof x === 'string') : [],
    results,
    playerName: typeof saved.name === 'string' ? cleanName(saved.name) : '',
    examStart: null,
    recentSteps: [],
    stepsChapter: '',
    runLines: [],
    runChapter: '',
    storyTitle: (h: number) => t(`story-${STORIES[h].id}`),
    chapters,
    story: () => (gameTerminal.remote ? STORIES.findIndex((s) => s.id === gameTerminal.remote!.story.id) : -1),
    active: () => (gameTerminal.remote ? gameTerminal.remote.story.chapters.indexOf(gameTerminal.remote.shell.chapter) : -1),
    open,
    // The story attribute opens its story even without the key (embedding in a course).
    accessible: (h: number) => gameTerminal.isOpen(STORIES[h].id) || STORIES[h].id === options.story,
    // Today's date (YYYY-MM-DD, the player's local time): the same everywhere on the same day.
    today: () => localDate(new Date()),
    // The difficulty: stars for the eye, the level in words for screen readers (see difficulty.ts).
    level: (min: Level, max: Level = min) =>
      el(
        'span',
        { class: 'difficulty', title: t('difficulty-title') },
        el(
          'span',
          { 'aria-hidden': 'true' },
          // Full stars only: the missing ones greyed, so they don't read like a score.
          ...(min === max ? ['★'.repeat(min), el('span', { class: 'difficulty-rest' }, '★'.repeat(5 - min))] : [`${'★'.repeat(min)} – ${'★'.repeat(max)}`]),
        ),
        el('span', { class: 'visually-hidden' }, min === max ? t('difficulty', { level: min }) : t('difficulty-tidy', { min, max })),
      ),
  };
  const ctx = shared as Context;
  const { story, active, storyTitle, accessible } = ctx;

  // ——— Building ———
  const out = outputPart(t);
  ctx.output = out.output;
  ctx.show = out.show;
  ctx.echo = out.echo;
  ctx.clearOutput = out.clear;
  ctx.announce = out.announce;
  const notes = notesPart(ctx);
  let submitLine = (_line: string) => {};
  const term = terminalPart(ctx, out, (line) => submitLine(line));
  ctx.input = term.input;
  ctx.colourInput = term.colourInput;
  ctx.searching = term.searching;
  ctx.followEnd = term.followEnd;
  ctx.openFollow = term.openFollow;
  ctx.openEditor = term.openEditor;
  const lines = runLinePart(ctx, out, term, notes);
  submitLine = lines.submitLine;
  ctx.waitFor = lines.waitFor;
  ctx.prefetch = lines.prefetch;

  const exam = examPart(ctx);
  exam.examCase.checked = gameTerminal.exam;
  ctx.timerUpdate = exam.timerUpdate;
  const onCall = onCallPart(ctx, () => exam.setExam(false));
  ctx.onCallActive = onCall.active;
  // The daily reminder (see reminder-dialog.ts): a calendar file the player adds to their own calendar app.
  const reminderButton = el('button', { type: 'button', class: 'reminder-button', 'aria-haspopup': 'dialog' }, ...quiet(t('reminder-button'))) as HTMLButtonElement;
  const reminder = lazyDialog(ctx, 'dialog-reminder', () => import('./reminder-dialog').then((m) => (c: Context) => m.default(c, reminderButton)));
  reminderButton.addEventListener('click', () => reminder.use((d) => d.show()));
  const startHere = startHerePart(ctx);
  ctx.startUpdate = startHere.startUpdate;
  // "Report a problem or an idea" (see feedback-dialog.ts): a button under the menu, and one among the chapter's actions.
  const feedbackMenuButton = el('button', { type: 'button', class: 'feedback-button', 'aria-haspopup': 'dialog' }, icon(...ICON_FEEDBACK), el('span', {}, t('feedback-button')));
  const feedbackButton = el('button', { type: 'button', class: 'pill', 'aria-haspopup': 'dialog' }, icon(...ICON_FEEDBACK), el('span', {}, t('feedback-button')));
  const feedback = lazyDialog(ctx, 'dialog-feedback', () => import('./feedback-dialog').then((m) => m.default));
  const openFeedback = (opener: HTMLElement | null) => feedback.use((d) => d.show(opener));
  feedbackMenuButton.addEventListener('click', () => openFeedback(feedbackMenuButton));
  feedbackButton.addEventListener('click', () => openFeedback(feedbackButton));
  const menu = menuPart(ctx, {
    startHereEntry: startHere.startHereEntry,
    incidentBlock: onCall.incidentBlock,
    streakLine: onCall.streakLine,
    reminderEntry: el('p', { class: 'reminder-entry' }, reminderButton),
    feedbackEntry: el('p', { class: 'feedback-entry' }, feedbackMenuButton),
  });
  const fresh = whatsNewPart(ctx, menu.storiesBoutons, onCall.incident);
  ctx.badgeUpdate = fresh.badgeUpdate;
  const autosave = autosavePart(ctx);
  ctx.autosave = autosave.autosave;
  // "Next chapter" inside the terminal, right under the prompt: the player looks there, not
  // under the terminal; Escape then Tab from the command line reaches it.
  term.form.after(menu.end);
  const settings = settingsPart(ctx, { terminal: term.terminal, touchesBar: term.touchesBar, applyView: menu.applyView, pressViews: menu.pressViews, autosaveTurned: autosave.turned });
  ctx.applyDisplay = settings.applyDisplay;

  // The bar's tools: an icon and a label (the label is hidden on a narrow screen, still read aloud).
  const toolButton = (cls: string, paths: string[], label: string) =>
    el('button', { type: 'button', class: `${cls} tool-button`, 'aria-haspopup': 'dialog' }, icon(...paths), el('span', { class: 'tool-label' }, label)) as HTMLButtonElement;
  // The mission: the chapter's objective, its instructions, and what has already happened.
  const missionButton = toolButton('mission-button', ICON_MISSION, t('mission-button'));
  // The map: the known places of the machine the player is on (see map.ts).
  const mapButton = toolButton('map-button', ICON_MAP, t('map-button'));
  // The notebook: the commands already run (see notebook.ts).
  const notebookButton = toolButton('notebook-button', ICON_NOTEBOOK, t('notebook-button'));
  const examBar = el(
    'p',
    { class: 'exam' },
    exam.stopwatch,
    onCall.onCallGauge,
    el('span', { class: 'tools' }, missionButton, mapButton, notebookButton, settings.settings),
  );
  const chapterSummary = summaryPart(ctx);
  const mission = missionPart(ctx, missionButton, chapterSummary.carryOver);
  const mapWindow = mapPart(ctx, mapButton);
  const notebook = notebookPart(ctx, notebookButton);
  ctx.notebookUpdate = notebook.notebookUpdate;
  // A restored save: the game starts again from it.
  const remount = () => {
    clearInterval(timer);
    root.replaceChildren();
    mount(root, options);
  };
  const progress = progressPart(ctx, remount);
  const achievements = achievementsPart(ctx);
  const restart = el('button', { type: 'button', class: 'pill' }, icon(...ICON_RESTART), el('span', {}, t('button-restart')));
  const tips = el('p', { class: 'tips' }, typo(t('tips')));
  // The chapter's actions, as a row of buttons under the tip.
  const chapterActions = el('p', { class: 'chapter-actions' }, restart, progress.progressButton, achievements.achievementsButton, feedbackButton);
  const credit = el('p', { class: 'credit' }, typo(t('credit')), ' ',
    el('a', { href: 'https://github.com/Rouages-du-net/quetes-de-sysadmin' }, t('credit-link-project')), ' · ',
    el('a', { href: 'https://web.mit.edu/mprat/Public/web/Terminus/Web/main.html', hreflang: 'en' }, t('credit-link-original')));

  const game = el('div', { class: 'qds', lang: t.language },
    startHere.startOffer, menu.storiesNav, ...menu.chaptersNavs, examBar, autosave.resumeBanner, autosave.resumeStatus, settings.screen, menu.forUnderstand, tips, chapterActions, exam.examChoice, credit,
    mapWindow.mapWindow, notebook.notebookWindow, progress.progressWindow, mission.missionWindow, achievements.achievementsWindow, chapterSummary.summarySlot, onCall.onCallWindow, onCall.onCallEndWindow, reminder.slot, exam.examWindow, startHere.startSlot, feedback.slot, out.announcer);
  ctx.game = game;
  root.append(game);

  // The terminal's width in characters ($COLUMNS): ls fits its columns in it.
  const columnsUpdate = () => {
    const columns = out.columns();
    if (columns !== null) gameTerminal.columns = columns;
  };
  if (typeof ResizeObserver !== 'undefined') new ResizeObserver(columnsUpdate).observe(out.output);

  // ——— Saving ———
  ctx.backupState = (): Backup => ({
    finished,
    story: gameTerminal.remote?.story.id ?? null,
    known: gameTerminal.knownHosts(),
    ssh: gameTerminal.ssh(),
    notebook: ctx.notebook,
    exam: gameTerminal.exam,
    records: ctx.records,
    ...(ctx.playerName ? { name: ctx.playerName } : {}),
    achievements: ctx.achievements,
    tips: ctx.shownTips,
  });
  ctx.save = () => {
    try {
      localStorage.setItem(KEY, JSON.stringify(ctx.backupState()));
    } catch {}
  };

  // Every second: the exam's timer and the on-call gauge.
  const timer = setInterval(() => {
    if (ctx.examStart !== null) exam.timerUpdate();
    if (onCall.active()) onCall.onCallUpdate();
  }, 1000);

  // Visit statistics (options.track, src/stats.ts): the story opened, the
  // chapter finished, with the game's language; nothing in exam mode, and
  // never what is typed, the save or the progress codes.
  const track = (name: string, data: Record<string, string>) => {
    if (!gameTerminal.exam) options.track?.(name, { ...data, language: t.language });
  };
  // The chapters' sessions already counted as finished.
  const counted = new WeakSet<Shell>();

  ctx.after = (sh: Shell | null = null) => {
    const current = gameTerminal.remote;
    if (current?.shell.finished && !counted.has(current.shell)) {
      counted.add(current.shell);
      track('chapter-finished', { story: current.story.id, chapter: current.shell.chapter.id });
    }
    chapterSummary.noteSummary();
    onCall.onCallUpdate();
    exam.examEnd();
    achievements.checkAchievements(sh);
    notebook.notebookUpdate();
    term.promptUpdate();
    menu.navUpdate();
    ctx.save();
    autosave.autosave();
    // Back to the bottom of the current machine's history (it may have
    // changed: a new command, or a switch of machine through ssh/exit/menu).
    term.historyEnd();
    out.scrollables();
    term.terminal.scrollTop = term.terminal.scrollHeight;
  };

  // The menu's shortcuts: a fresh screen, straight on the right machine.
  ctx.goWorkstation = () => {
    term.followEnd();
    ctx.recentSteps = [];
    ctx.examStart = null;
    exam.timerUpdate();
    out.clear();
    if (gameTerminal.remote) gameTerminal.disconnect();
    out.show(`— ${t('workstation-title')} —`);
    out.show(gameTerminal.resetWorkstation());
    ctx.after();
  };
  // A story's chapters and texts load the first time it is opened (story-registry.ts):
  // meanwhile the terminal says so and waits. Only the last story asked for opens.
  let launching = 0;
  ctx.launch = (h: number, c?: number): Promise<void> => {
    const id = STORIES[h].id;
    const ticket = ++launching;
    if (loadedStory(id) && textsLoaded(t.language, `story-${id}`)) {
      ctx.launchNow(h, c);
      return Promise.resolve();
    }
    term.followEnd();
    out.clear();
    out.show(t('loading-story', { story: storyTitle(h) }));
    return ctx.waitFor(loadStory(id, t.language)).then((ok) => {
      if (ticket !== launching) return;
      if (ok) ctx.launchNow(h, c);
      else out.show(t('loading-failed'), 'error');
    });
  };
  ctx.launchNow = (h: number, c?: number) => {
    term.followEnd();
    ctx.recentSteps = [];
    ctx.runLines = [];
    ctx.runChapter = '';
    out.clear();
    const loaded = loadedStory(STORIES[h].id)!;
    const chapter = c === undefined ? undefined : loaded.chapters[c];
    fresh.storySeen(h);
    const sameStory = gameTerminal.remote?.story === loaded;
    if (sameStory && chapter) out.show(gameTerminal.open(chapter));
    else out.show(gameTerminal.connect(storyMachine(STORIES[h].id)!.name, chapter));
    if (!sameStory) track('story-opened', { story: STORIES[h].id });
    // In exam mode, a chapter that (re)starts starts the timer; an already finished chapter doesn't.
    ctx.examStart = gameTerminal.exam && !gameTerminal.remote?.shell.finished ? Date.now() : null;
    if (ctx.examStart !== null) out.show(t('exam-start'), 'exam-result');
    exam.timerUpdate();
    ctx.after();
  };
  restart.addEventListener('click', () => {
    if (story() === -1) ctx.goWorkstation();
    else ctx.launch(story(), active());
    ctx.input.focus();
  });

  fresh.freshUpdate();
  settings.applyDisplay();
  const tour = tourPart(ctx, [
    [() => term.field, 'tour-input'],
    [() => missionButton, 'tour-mission'],
    [() => mapButton, 'tour-map'],
    [() => notebookButton, 'tour-notebook'],
    [() => term.field, 'tour-tab'],
    // Last, where to start (see start-here.ts): the first visit's card, or the menu's button.
    [startHere.tourTarget, 'tour-start-here'],
  ]);
  ctx.startTour = tour.startTour;

  // At start: the story requested by the attribute, otherwise the one where the
  // player stopped, otherwise the workstation.
  const departure = STORIES.findIndex((h) => h.id === (options.story ?? saved.story));
  // A chapter left in progress (the tab closed, the phone that killed it): read before anything is written.
  const left = autosave.pending();
  if (departure >= 0 && accessible(departure)) ctx.launch(departure);
  else ctx.goWorkstation();
  if (left) autosave.offerResume(left);
  // In the background, once the game is shown: the chapters' summaries and
  // English's core texts (the fallback; both precached for offline play),
  // the manual's pages, and on the workstation the first open story not
  // finished (where `ssh` leads next).
  const idle = (f: () => void) => ('requestIdleCallback' in window ? requestIdleCallback(f, { timeout: 3000 }) : setTimeout(f, 1500));
  idle(() => {
    loadTexts(t.language, 'summaries').then(() => withTexts('summaries', () => {}), () => {});
    loadTexts(t.language, 'fallbacks').catch(() => {});
    if (navigator.onLine === false) return;
    loadTexts(t.language, 'manual').catch(() => {});
    loadExamples().catch(() => {});
    if (departure < 0 || !accessible(departure)) ctx.prefetch(STORIES.findIndex((s, h) => accessible(h) && s.chapters.some((c) => !finished.includes(c.id))));
  });
  // A first visit (nothing played yet): the tour, once the page is laid out.
  if (display.tour !== 'done' && !finished.length && !Object.keys(ctx.notebook).length && !gameTerminal.exam) setTimeout(tour.startTour, 300);
  return {
    root: game,
    /** The game's language (the visit statistics of an embedded game, src/element.ts). */
    language: t.language,
    /** Exam mode, on or off. */
    exam: () => gameTerminal.exam,
    /** Opens "Report a problem or an idea" (the site's footer asks for it, see src/pwa/site.ts). */
    openFeedback: () => openFeedback(null),
    /** Asks for exam mode, as the checkbox does (a chapter in progress asks for confirmation first). */
    askExam: exam.askExam,
  };
}
