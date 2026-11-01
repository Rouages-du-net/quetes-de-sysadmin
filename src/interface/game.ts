// The game's interface: the simulated terminal (a console that starts from the
// workstation and connects with ssh to the stories' machines), the menu of
// stories and chapters (shortcuts), the progress kept in the browser.
// mount() builds everything inside a container (an element or a component's
// shadow root), assuming nothing about the page that hosts it.

import { difficulty, stars, storyDifficulty, type Level } from '../engine/difficulty';
import { Console } from '../engine/console';
import type { Shell } from '../engine/shell';
import { STORIES } from '../engine/chapters';
import { machineDomain, storyMachine, WORKSTATION, type Machine } from '../engine/machines';
import { description, inMarkdown, note, type Notebook } from '../engine/notebook';
import { rouagesLinks } from '../engine/rouages';
import { map, type Place } from '../engine/map';
import { layOut, landmarks as planLandmarks, type ElementPlan } from '../engine/plan';
import { grade, GRADES, newAchievements, ACHIEVEMENTS } from '../engine/achievements';
import { hint, HINT_LEVELS, type HintLevel } from '../engine/hints';
import { summary } from '../engine/summary';
import { pathSteps, PATH } from '../engine/paths';
import { missing } from '../engine/unlocking';
import { remainingBudget, dayIncident, gauge, placeFor, percent } from '../engine/on-call';
import { progressCode, backupFile, readCode, readFile, cleanName, type Backup } from '../engine/progress';
import { colourise, type Token } from '../engine/highlighting';
import { chunks, withoutColours } from '../engine/colours';
import { editor } from './editor';
import { translator, typography, type Language } from '../texts';

export interface Options {
  language?: Language;
  /** Story to open at start (identifier, e.g. "datacenter"), even without its key. */
  story?: string;
  /** Save key in localStorage (change it if several games share a site). */
  saveKey?: string;
}


function el<K extends keyof HTMLElementTagNameMap>(name: K, attrs: Record<string, string> = {}, ...children: (Node | string)[]) {
  const e = document.createElement(name);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  e.append(...children);
  return e;
}

// The lines kept on screen for a single output.
const LINES_MAX = 2000;
// During a follow (tail -f), the seconds that pass on the machine for each real second.
const SECONDS_FOLLOW = 3;

export function mount(root: HTMLElement | ShadowRoot, options: Options = {}) {
  const t = translator(options.language);
  const typo = (text: string) => typography(text, t.language);
  const storyTitle = (h: number) => t(`story-${STORIES[h].id}`);
  const KEY = options.saveKey ?? 'quetes-de-sysadmin';
  const chapters = (h: number) => STORIES[h].chapters;
  // Display (theme, size, menu view, colours): a setting of this browser only.
  const DISPLAY_KEY = `${KEY}-display`;
  const SIZES = [0.8, 0.9, 1, 1.15, 1.3, 1.5];
  let display = { theme: 'phosphor', size: 2, view: 'network', colours: true, path: PATH[0].id };
  try {
    display = { ...display, ...JSON.parse(localStorage.getItem(DISPLAY_KEY) ?? '{}') };
  } catch {}

  // ——— Building ———
  // The machine's name and address, shown on the network map (technical identifiers, never translated).
  const host = (m: Machine | undefined) => el('span', { class: 'host' }, m ? `${machineDomain(t, m)} ${m.address}` : '');
  // The difficulty: stars for the eye, the level in words for screen readers (see difficulty.ts).
  const level = (min: Level, max: Level = min) =>
    el(
      'span',
      { class: 'difficulty' },
      el('span', { 'aria-hidden': 'true' }, min === max ? stars(min) : `${'★'.repeat(min)} – ${'★'.repeat(max)}`),
      el('span', { class: 'visually-hidden' }, min === max ? t('difficulty', { level: min }) : t('difficulty-tidy', { min, max })),
    );
  const storiesBoutons = STORIES.map((h, i) =>
    el('button', { type: 'button', 'data-story': String(i) },
      el('span', { class: 'title' }, storyTitle(i)),
      host(storyMachine(h.id)),
      el('span', { class: 'abstract' }, typo(t(`story-${h.id}.summary`))),
      level(storyDifficulty(h.id).min, storyDifficulty(h.id).max),
      el('span', { class: 'state' }),
      // One LED per chapter, as on a server rack (the state in plain words is in .etat).
      el('span', { class: 'diodes', 'aria-hidden': 'true' }, ...h.chapters.map(() => el('span', { class: 'diode' })))),
  );
  const workstationButton = el('button', { type: 'button', 'data-workstation': '' }, el('span', { class: 'title' }, t('workstation-title')), host(WORKSTATION));
  const keyHelp = el('p', { class: 'key-help' }, typo(t('key-help')));
  // Two views of the menu: the network map (the workstation, the internet, then
  // one machine per story, plugged into the same cable, lighting up as the
  // player progresses) and the racks (the same buttons, in a grid, with their
  // summary). They are the same buttons in the same list: only the layout
  // changes, and screen readers read the same thing.
  const VIEWS = ['network', 'racks', 'paths'] as const;
  const viewBoutons = Object.fromEntries(
    VIEWS.map((v) => [v, el('button', { type: 'button', class: 'view-button', 'aria-pressed': 'false', 'data-view': v }, t(`view-${v}`))]),
  ) as Record<(typeof VIEWS)[number], HTMLButtonElement>;
  const viewChoice = el('p', { class: 'view-choice', role: 'group', 'aria-label': t('view-title') }, ...VIEWS.map((v) => viewBoutons[v]));
  const storiesList = el(
    'ol',
    {},
    el('li', { class: 'node-workstation' }, workstationButton),
    // The internet, between the workstation and the machines: a landmark, not a button.
    el('li', { class: 'node-internet', 'aria-hidden': 'true' }, el('span', {}, t('view-internet'))),
    ...storiesBoutons.map((b, i) => el('li', { class: 'node', 'data-side': i % 2 ? 'right' : 'left' }, b)),
  );
  // The "Paths" view: a theme, and its chapters taken from several stories (see paths.ts).
  const pathId = `qds-paths-${Math.random().toString(36).slice(2, 8)}`;
  const pathChoice = el(
    'select',
    { id: pathId },
    ...PATH.map((p) => el('option', { value: p.id }, t(`path-${p.id}`))),
  ) as HTMLSelectElement;
  const descriptionPath = el('p', { class: 'paths-description' });
  const progressPath = el('p', { class: 'paths-progress' });
  const pathList = el('ol', { class: 'paths-list' });
  const pathBlock = el(
    'div',
    { class: 'paths', hidden: '' },
    el('p', { class: 'paths-choice' }, el('label', { for: pathId }, t('path-choice')), ' ', pathChoice),
    descriptionPath,
    progressPath,
    pathList,
  );
  // The incident of the day (see on-call.ts): the same chapter for everyone, to replay on call.
  const incidentButton = el('button', { type: 'button', class: 'incident-button', 'aria-haspopup': 'dialog' }, t('on-call-button'));
  const incidentText = el('span', { class: 'incident-text' });
  const incidentBlock = el('p', { class: 'incident' }, incidentButton, ' ', incidentText);
  const storiesNav = el('nav', { class: 'stories', 'aria-label': t('stories-title') }, viewChoice, incidentBlock, storiesList, pathBlock, keyHelp);

  const chaptersNavs = STORIES.map((h, i) =>
    el('nav', { class: 'chapters', 'aria-label': t('chapters-title', { story: storyTitle(i) }), 'data-chapters': String(i) },
      el('ol', {}, ...h.chapters.map((c, j) =>
        el('li', {}, el('button', { type: 'button', 'data-chapter': String(j) },
          el('span', { class: 'num' }, t('chapter-number', { number: c.number })),
          el('span', { class: 'title' }, t(`chapter-${c.id}`)),
          el('span', { class: 'abstract' }, typo(t(`chapter-${c.id}.summary`))),
          level(difficulty(c.id)),
          el('span', { class: 'state' })))))),
  );

  // Exam mode: no hints, a timer; the checkbox restarts the current chapter.
  const examCase = el('input', { type: 'checkbox' }) as HTMLInputElement;
  const stopwatch = el('span', { class: 'timer', role: 'timer' });
  // The map: a button next to the terminal opens, in a dialog, the known
  // places of the machine the player is on (see map.ts).
  const mapButton = el('button', { type: 'button', class: 'map-button', 'aria-haspopup': 'dialog' }, t('map-button'));
  // The terminal's display: theme, text size, full screen (settings of this browser).
  const THEMES = ['phosphor', 'amber', 'contrast', 'paper'];
  const themeChoice = el(
    'select',
    { 'aria-label': t('display-theme') },
    ...THEMES.map((x) => el('option', { value: x }, t(`display-theme-${x}`))),
  ) as HTMLSelectElement;
  const moreSmall = el('button', { type: 'button', class: 'setting-button', 'aria-label': t('display-more-small') }, 'A−');
  const moreGrand = el('button', { type: 'button', class: 'setting-button', 'aria-label': t('display-more-big') }, 'A+');
  const focusButton = el('button', { type: 'button', class: 'setting-button', 'aria-pressed': 'false' }, t('display-focus'));
  const coloursButton = el('button', { type: 'button', class: 'setting-button', 'aria-pressed': 'true' }, t('display-colours'));
  const settings = el('span', { class: 'settings' }, themeChoice, moreSmall, moreGrand, coloursButton, focusButton);
  // The mission: the chapter's objective, its instructions, and what has already happened.
  const missionButton = el('button', { type: 'button', class: 'mission-button', 'aria-haspopup': 'dialog' }, t('mission-button'));
  const onCallGauge = el('span', { class: 'on-call-gauge', role: 'timer', hidden: '' });
  const examBar = el(
    'p',
    { class: 'exam' },
    el('label', {}, examCase, el('span', {}, t('exam-case'))),
    stopwatch,
    onCallGauge,
    el('span', { class: 'tools' }, missionButton, mapButton, settings),
  );
  const idMission = `qds-mission-${Math.random().toString(36).slice(2, 8)}`;
  const titleMission = el('h2', { id: idMission });
  const goalMission = el('p', { class: 'map-legend' });
  const instructionsMission = el('pre', { class: 'mission-text' });
  const logMission = el('ol', { class: 'mission-log' });
  const emptyMission = el('p', { class: 'map-legend' }, typo(t('mission-nothing')));
  const closeMission = el('button', { type: 'button', class: 'button' }, t('map-close'));
  // Need help? Three levels, one after the other (see hints.ts); nothing in exam mode.
  const hintBoutons = Object.fromEntries(
    HINT_LEVELS.map((n) => [n, el('button', { type: 'button', class: 'hint-button', 'data-level': n }, t(`hint-button-${n}`))]),
  ) as Record<HintLevel, HTMLButtonElement>;
  const hintText = el('div', { class: 'hint-text', 'aria-live': 'polite' });
  const help = el(
    'section',
    { class: 'help' },
    el('h3', {}, t('hint-title')),
    el('p', { class: 'map-legend' }, typo(t('hint-intro'))),
    el('p', { class: 'hint-buttons' }, ...HINT_LEVELS.map((n) => hintBoutons[n])),
    hintText,
  );
  // The rescue snapshot (see Console.restore): like a virtual machine's.
  const takeSnapshot = el('button', { type: 'button', class: 'rescue-button' }, t('rescue-take'));
  const goBackSnapshot = el('button', { type: 'button', class: 'rescue-button' }, t('rescue-go-back'));
  const cancelInput = el('button', { type: 'button', class: 'rescue-button' }, t('rescue-cancel'));
  const rescueState = el('p', { class: 'map-legend rescue-state', role: 'status' });
  const rescue = el(
    'section',
    { class: 'rescue' },
    el('h3', {}, t('rescue-title')),
    el('p', { class: 'map-legend' }, typo(t('rescue-intro'))),
    el('p', { class: 'hint-buttons' }, takeSnapshot, goBackSnapshot, cancelInput),
    rescueState,
  );
  const missionWindow = el(
    'dialog',
    { class: 'mission-window', 'aria-labelledby': idMission },
    titleMission,
    goalMission,
    el('h3', {}, t('mission-instructions')),
    instructionsMission,
    el('h3', {}, t('mission-journal')),
    emptyMission,
    logMission,
    help,
    rescue,
    el('p', { class: 'map-actions' }, closeMission),
  ) as HTMLDialogElement;
  const mapId = `qds-map-${Math.random().toString(36).slice(2, 8)}`;
  const titleMap = el('h2', { id: mapId });
  const treeMap = el('div', { class: 'map-tree' });
  const closeMap = el('button', { type: 'button', class: 'button' }, t('map-close'));
  // Two tabs when the story has a network: the machine's places, and the network plan (see plan.ts).
  const tab = (suffix: string, text: string) =>
    el('button', { type: 'button', role: 'tab', id: `${mapId}-tab-${suffix}`, 'aria-controls': `${mapId}-${suffix}` }, text);
  const placesTab = tab('places', t('map-tab-places'));
  const networkTab = tab('network', t('map-tab-network'));
  const tabs = el('div', { role: 'tablist', class: 'map-tabs' }, placesTab, networkTab);
  const placesPanel = el(
    'div',
    { role: 'tabpanel', id: `${mapId}-places`, 'aria-labelledby': placesTab.id },
    el('p', { class: 'map-legend' }, typo(t('map-caption'))),
    treeMap,
  );
  const planSchema = el('div', { class: 'plan-diagram' });
  const listPlan = el('div', { class: 'map-tree' });
  const textPlan = el('details', { class: 'plan-text' }, el('summary', {}, t('plan-version-text')), listPlan);
  const networkPanel = el(
    'div',
    { role: 'tabpanel', id: `${mapId}-network`, 'aria-labelledby': networkTab.id },
    el('p', { class: 'map-legend' }, typo(t('plan-caption'))),
    planSchema,
    textPlan,
  );
  const mapWindow = el(
    'dialog',
    { class: 'map-window', 'aria-labelledby': mapId },
    titleMap,
    tabs,
    placesPanel,
    networkPanel,
    el('p', { class: 'map-actions' }, closeMap),
  ) as HTMLDialogElement;
  const output = el('div', { class: 'output', role: 'log', 'aria-live': 'polite' });
  const id = `qds-input-${Math.random().toString(36).slice(2, 8)}`;
  const prompt = el('label', { class: 'prompt', for: id });
  const input = el('input', {
    id, type: 'text', spellcheck: 'false', autocapitalize: 'off', autocorrect: 'off', autocomplete: 'off',
    'aria-label': t('input-label'),
  }) as HTMLInputElement;
  // Ctrl-R: history search, like bash; the command found is shown below the line.
  const match = el('p', { class: 'search', 'aria-live': 'polite' });
  // Highlighting of the line (see highlighting.ts): a coloured copy of the
  // text, drawn exactly under the field, which stays an ordinary field
  // (keyboard, completion, screen readers) with its text made transparent.
  const coloration = el('div', { class: 'highlighting', 'aria-hidden': 'true' });
  const field = el('span', { class: 'field' }, coloration, input);
  const form = el('form', { autocomplete: 'off' }, prompt, field, match);
  // tail -f, journalctl -f: the command keeps control until Ctrl-C (this button, the keyboard or the key bar).
  const followStop = el('button', { type: 'button', class: 'stop-follow', hidden: '' }, el('kbd', {}, '^C'), ` ${t('follow-stop')}`);
  const terminal = el('div', { class: 'terminal' }, output, form, followStop);
  const quitFocus = el('button', { type: 'button', class: 'leave-focus' }, t('display-quit-focus'));
  // The keys that phone keyboards lack (shown on touch screens).
  const TOUCHES: [string, string][] = [
    ['Tab', 'Tab'],
    ['↑', 'ArrowUp'],
    ['↓', 'ArrowDown'],
    ['Ctrl-C', 'ctrl-c'],
    ['|', '|'],
    ['~', '~'],
    ['/', '/'],
    ['-', '-'],
    ['_', '_'],
    ['.', '.'],
    ['*', '*'],
    ['>', '>'],
  ];
  const touchesBar = el(
    'div',
    { class: 'keys', role: 'toolbar', 'aria-label': t('keys-title') },
    ...TOUCHES.map(([text, pressedKey]) =>
      el('button', { type: 'button', 'data-key': pressedKey, ...(pressedKey.startsWith('Arrow') ? { 'aria-label': t(`key-${pressedKey === 'ArrowUp' ? 'up' : 'down'}`) } : {}) }, text),
    ),
    // During nano: its shortcuts, which a phone cannot type (no Ctrl key).
    el('button', { type: 'button', class: 'for-nano', 'data-key': 'ctrl-o' }, `^O ${t('nano-write')}`),
    el('button', { type: 'button', class: 'for-nano', 'data-key': 'ctrl-x' }, `^X ${t('nano-quit')}`),
  );
  const following = el('button', { type: 'button', class: 'button primary' }, t('button-next'));
  const end = el('div', { class: 'end', hidden: '' }, following);
  // After a chapter: the Les rouages du net page that explains its concept.
  const rouagesList = el('ul', {});
  const forUnderstand = el('aside', { class: 'to-understand', hidden: '' }, el('p', {}, typo(t('rouages-intro'))), rouagesList);
  // The sysadmin's notebook: the commands already run, with their line from the manual.
  const accountNotebook = el('span', { class: 'account' });
  const titleNotebook = el('span', {});
  const listNotebook = el('dl', {});
  const emptyNotebook = el('p', {}, typo(t('notebook-empty')));
  const exported = el('button', { type: 'button', class: 'link' }, t('notebook-export'));
  const copyNotebook = el('button', { type: 'button', class: 'link' }, t('notebook-copy-button'));
  const stateNotebook = el('span', { class: 'notebook-state', role: 'status' });
  const actionsNotebook = el('p', { class: 'notebook-actions' }, exported, ' · ', copyNotebook, ' ', stateNotebook);
  const notebookPanel = el(
    'details',
    { class: 'notebook' },
    el('summary', {}, titleNotebook, ' ', accountNotebook),
    el('p', { class: 'notebook-help' }, typo(t('notebook-help'))),
    emptyNotebook,
    listNotebook,
    actionsNotebook,
  );
  const restart = el('button', { type: 'button', class: 'link' }, t('button-restart'));
  // My progress: a name for the notebook, and a way to continue on another
  // device (the short code, or the file; see progress.ts).
  const progressButton = el('button', { type: 'button', class: 'link', 'aria-haspopup': 'dialog' }, t('progress-button'));
  // Achievements and rank: a dialog (see achievements.ts).
  const achievementsButton = el('button', { type: 'button', class: 'link', 'aria-haspopup': 'dialog' });
  const tips = el('p', { class: 'tips' }, typo(t('tips')), ' ', restart, ' · ', progressButton, ' · ', achievementsButton);
  const achievementsId = `qds-achievements-${Math.random().toString(36).slice(2, 8)}`;
  const gradeAchievements = el('p', { class: 'achievement-rank' });
  const listAchievements = el('ul', { class: 'achievement-list' });
  const closeAchievements = el('button', { type: 'button', class: 'button' }, t('map-close'));
  const achievementsWindow = el(
    'dialog',
    { class: 'achievements-window', 'aria-labelledby': achievementsId },
    el('h2', { id: achievementsId }, t('achievements-title')),
    gradeAchievements,
    listAchievements,
    el('p', { class: 'map-actions' }, closeAchievements),
  ) as HTMLDialogElement;
  // On-call duty: the dialog that offers it, and the score card's at the end.
  const onCallId = `qds-on-call-${Math.random().toString(36).slice(2, 8)}`;
  const titleOnCall = el('h2', { id: onCallId });
  const chapterOnCall = el('p', { class: 'on-call-chapter' });
  const takeOnCall = el('button', { type: 'button', class: 'button' }, t('on-call-take'));
  const cancelOnCall = el('button', { type: 'button', class: 'button button-secondary' }, t('on-call-cancel'));
  const onCallWindow = el(
    'dialog',
    { class: 'on-call-window', 'aria-labelledby': onCallId },
    titleOnCall,
    el('p', { class: 'map-legend' }, typo(t('on-call-intro'))),
    chapterOnCall,
    el('p', { class: 'map-legend' }, typo(t('on-call-rules'))),
    el('p', { class: 'map-actions' }, cancelOnCall, ' ', takeOnCall),
  ) as HTMLDialogElement;
  const onCallEndId = `qds-on-call-end-${Math.random().toString(36).slice(2, 8)}`;
  const scoreMap = el('pre', { class: 'score-card' });
  const copyMap = el('button', { type: 'button', class: 'button' }, t('on-call-copy'));
  const mapState = el('p', { class: 'map-legend', role: 'status' });
  const closeOnCallEnd = el('button', { type: 'button', class: 'button button-secondary' }, t('map-close'));
  const onCallEndWindow = el(
    'dialog',
    { class: 'on-call-window', 'aria-labelledby': onCallEndId },
    el('h2', { id: onCallEndId }, t('on-call-end-title')),
    el('p', { class: 'map-legend' }, typo(t('on-call-end-intro'))),
    scoreMap,
    mapState,
    el('p', { class: 'map-actions' }, closeOnCallEnd, ' ', copyMap),
  ) as HTMLDialogElement;
  // The end-of-chapter summary: the details, step by step (see summary.ts).
  const summaryId = `qds-summary-${Math.random().toString(36).slice(2, 8)}`;
  const titleSummary = el('h2', { id: summaryId });
  const mapCaption = el('p', { class: 'map-legend' });
  const tableSummary = el('div', { class: 'summary-table', tabindex: '0', role: 'region', 'aria-labelledby': summaryId });
  const encourageSummary = el('p', { class: 'map-legend' });
  const closeSummary = el('button', { type: 'button', class: 'button' }, t('map-close'));
  const summaryWindow = el(
    'dialog',
    { class: 'summary-window', 'aria-labelledby': summaryId },
    titleSummary,
    mapCaption,
    el('p', { class: 'map-legend' }, typo(t('summary-intro'))),
    tableSummary,
    encourageSummary,
    el('p', { class: 'map-actions' }, closeSummary),
  ) as HTMLDialogElement;
  const progressId = `qds-progress-${Math.random().toString(36).slice(2, 8)}`;
  const nameField = el('input', { type: 'text', id: `${progressId}-name`, maxlength: '60', autocomplete: 'name', spellcheck: 'false' }) as HTMLInputElement;
  const currentCode = el('code', { class: 'progress-code' });
  const copyCode = el('button', { type: 'button', class: 'link' }, t('progress-copy'));
  const codeField = el('input', { type: 'text', id: `${progressId}-code`, autocomplete: 'off', spellcheck: 'false', autocapitalize: 'characters', placeholder: 'QDS-…' }) as HTMLInputElement;
  const resumeCode = el('button', { type: 'button', class: 'button' }, t('progress-resume'));
  const download = el('button', { type: 'button', class: 'button' }, t('progress-download'));
  const fileField = el('input', { type: 'file', id: `${progressId}-file`, accept: '.json,application/json' }) as HTMLInputElement;
  const progressState = el('p', { class: 'progress-state', role: 'status' });
  const closeProgress = el('button', { type: 'button', class: 'button' }, t('map-close'));
  const progressWindow = el(
    'dialog',
    { class: 'progress-window', 'aria-labelledby': progressId },
    el('h2', { id: progressId }, t('progress-title')),
    el('p', { class: 'map-legend' }, typo(t('progress-intro'))),
    el('h3', {}, el('label', { for: nameField.id }, t('progress-name'))),
    el('p', {}, nameField),
    el('p', { class: 'map-legend' }, typo(t('progress-name-help'))),
    el('h3', {}, t('progress-code-title')),
    el('p', { class: 'map-legend' }, typo(t('progress-code-help'))),
    el('p', {}, currentCode, ' ', copyCode),
    el('p', { class: 'progress-input' }, el('label', { for: codeField.id }, t('progress-code-input')), ' ', codeField, ' ', resumeCode),
    el('h3', {}, t('progress-file-title')),
    el('p', { class: 'map-legend' }, typo(t('progress-file-help'))),
    el('p', {}, download),
    el('p', { class: 'progress-input' }, el('label', { for: fileField.id }, t('progress-file-input')), ' ', fileField),
    progressState,
    el('p', { class: 'map-actions' }, closeProgress),
  ) as HTMLDialogElement;
  const credit = el('p', { class: 'credit' }, typo(t('credit')), ' ',
    el('a', { href: 'https://github.com/Rouages-du-net/quetes-de-sysadmin' }, t('credit-link-project')), ' · ',
    el('a', { href: 'https://web.mit.edu/mprat/Public/web/Terminus/Web/main.html', hreflang: 'en' }, t('credit-link-original')));

  // The terminal and its key bar: together in full screen.
  const screen = el('div', { class: 'screen' }, quitFocus, terminal, touchesBar);
  // Confirmation of exam mode: it restarts the current chapter.
  const examId = `qds-exam-${Math.random().toString(36).slice(2, 8)}`;
  const titleExam = el('h2', { id: examId });
  const textExam = el('p', { class: 'map-legend' });
  const yesExam = el('button', { type: 'button', class: 'button' });
  const notExam = el('button', { type: 'button', class: 'button button-secondary' }, t('exam-cancel'));
  const examWindow = el(
    'dialog',
    { class: 'exam-window', 'aria-labelledby': examId },
    titleExam,
    textExam,
    el('p', { class: 'map-actions' }, notExam, ' ', yesExam),
  ) as HTMLDialogElement;
  const game = el('div', { class: 'qds', lang: t.language }, storiesNav, ...chaptersNavs, examBar, screen, end, forUnderstand, notebookPanel, tips, credit, mapWindow, progressWindow, missionWindow, achievementsWindow, summaryWindow, onCallWindow, onCallEndWindow, examWindow);
  root.append(game);

  // ——— Progress kept in this browser ———
  // Best times in exam mode (records, in ms); name shown at the top of the notebook (see progress.ts).
  let saved: Backup = {};
  try {
    saved = JSON.parse(localStorage.getItem(KEY) ?? '{}');
  } catch {}
  const gameTerminal = new Console({ language: t.language, finished: saved.finished, knownHosts: saved.known, ssh: saved.ssh });
  // The terminal's width in characters ($COLUMNS): ls fits its columns in it,
  // so that a phone screen doesn't have to scroll sideways.
  const measure = el('span', { class: 'measure', 'aria-hidden': 'true' }, '0'.repeat(20));
  output.appendChild(measure);
  const columnsUpdate = () => {
    const character = measure.getBoundingClientRect().width / 20;
    const width = output.clientWidth - parseFloat(getComputedStyle(output).paddingLeft) - parseFloat(getComputedStyle(output).paddingRight);
    if (character > 0 && width > 0) gameTerminal.columns = Math.max(20, Math.floor(width / character));
  };
  if (typeof ResizeObserver !== 'undefined') new ResizeObserver(columnsUpdate).observe(output);
  const finished = gameTerminal.finished;
  const notebook: Notebook = saved.notebook && typeof saved.notebook === 'object' ? saved.notebook : {};
  const records: Record<string, number> = saved.records && typeof saved.records === 'object' ? saved.records : {};
  let playerName = typeof saved.name === 'string' ? cleanName(saved.name) : '';
  const achievements: Record<string, string> = saved.achievements && typeof saved.achievements === 'object' ? { ...saved.achievements } : {};
  gameTerminal.exam = saved.exam === true;
  examCase.checked = gameTerminal.exam;
  // The start of the current chapter, in exam mode (null: no timer).
  let examStart: number | null = null;
  // Current story and chapter (-1: on the workstation).
  const story = () => (gameTerminal.remote ? STORIES.indexOf(gameTerminal.remote.story) : -1);
  const active = () => (gameTerminal.remote ? gameTerminal.remote.story.chapters.indexOf(gameTerminal.remote.shell.chapter) : -1);
  const backupState = (): Backup => ({
    finished,
    story: gameTerminal.remote?.story.id ?? null,
    known: gameTerminal.knownHosts(),
    ssh: gameTerminal.ssh(),
    notebook,
    exam: gameTerminal.exam,
    records,
    ...(playerName ? { name: playerName } : {}),
    achievements,
  });
  const save = () => {
    try {
      localStorage.setItem(KEY, JSON.stringify(backupState()));
    } catch {}
  };
  const open = (h: number, c: number) => c === 0 || finished.includes(chapters(h)[c - 1].id);
  // The story attribute opens its story even without the key (embedding in a course).
  const accessible = (h: number) => gameTerminal.isOpen(STORIES[h].id) || STORIES[h].id === options.story;

  const history: string[] = [];
  // The line after the last Tab (for bash's double Tab).
  let previousTab: string | null = null;
  let position = 0;

  // Tables of at least three columns (ls -l, ufw status, ss, ps…) don't
  // wrap: on a small screen, the block scrolls sideways. The rest,
  // paragraphs and instructions ("type:   ls"), wraps. The rules
  // that underline a table (------, ======) also stay in one piece.
  // A tab also separates columns (dig).
  const inColumns = (line: string) => (line.match(/\S(?: {2,}|\t)(?=\S)/g) ?? []).length >= 2 || /^[-=]{20,}$/.test(line);
  const show = (text: string, cls?: string) => {
    if (!text) return;
    const pre = document.createElement('pre');
    let lines = text.split('\n');
    // A huge output (ls of a place with 60,000 files): like a terminal's
    // scrollback, only the end is kept, so the page stays smooth.
    if (lines.length > LINES_MAX) {
      const coupees = lines.length - LINES_MAX;
      lines = lines.slice(-LINES_MAX);
      output.appendChild(el('p', { class: 'cut' }, t('output-cut', { lines: coupees })));
    }
    // A line underlined by ^~~~ (sudo, compilers): the line and its underline don't wrap.
    const underlined = (i: number) => /^\s*\^~*\s*$/.test(lines[i] ?? '');
    // The tools' colours (ANSI sequences, see colours.ts) become spans.
    const inColours = (line: string): (Node | string)[] =>
      line.includes('\x1b')
        ? chunks(line).map((m) => {
            const classes = [m.bold ? 'a-bold' : '', m.before !== null ? `a-${m.before}` : '', m.background !== null ? `a-${m.background}` : ''].filter(Boolean);
            return classes.length ? el('span', { class: classes.join(' ') }, m.text) : m.text;
          })
        : [line];
    lines.forEach((line, i) => {
      const end = i < lines.length - 1 ? '\n' : '';
      const visible = withoutColours(line);
      if (inColumns(visible) || /^\s*\^~*\s*$/.test(visible) || underlined(i + 1)) pre.append(el('span', { class: 'columns' }, ...inColours(line), end));
      else pre.append(...inColours(line), end);
    });
    if (cls) pre.className = cls;
    output.appendChild(pre);
  };

  // Ctrl-R: null outside a search; otherwise what the line held before, and the command found.
  let query: { before: string; match: string } | null = null;
  const promptUpdate = () => {
    prompt.textContent = gameTerminal.prompt();
    input.type = gameTerminal.shell.maskedInput() ? 'password' : 'text';
    colourInput();
  };

  // The coloured tokens of a line; nothing for an answer to a question
  // (yes/no, password, sftp>) nor when highlighting is turned off.
  const tokens = (line: string): Token[] | null => {
    const sh = gameTerminal.shell;
    if (!display.colours || sh.maskedInput() || sh.question || sh.waiting) return null;
    return colourise(sh, line);
  };
  const inSpans = (js: Token[]) => js.map((j) => (j.kind === 'text' ? j.text : el('span', { class: `c-${j.kind}` }, j.text)));
  const colourInput = () => {
    const js = query ? null : tokens(input.value);
    field.classList.toggle('coloured', js !== null);
    coloration.replaceChildren(...(js ? inSpans(js) : []));
    coloration.scrollLeft = input.scrollLeft;
  };
  // The command copied above its output, coloured as while typing.
  const showCommand = (line: string, js: Token[] | null) => {
    if (!js) return show(`${prompt.textContent} ${line}`, 'cmd');
    output.appendChild(el('pre', { class: 'cmd' }, `${prompt.textContent} `, ...inSpans(js)));
  };

  // The chosen path: each chapter, its story, its state; the next one to do is highlighted.
  const pathUpdate = () => {
    const p = PATH.find((x) => x.id === display.path) ?? PATH[0];
    const { steps, next } = pathSteps(p, finished, (id) => accessible(STORIES.findIndex((x) => x.id === id)));
    const done = steps.filter((e) => e.state === 'done').length;
    descriptionPath.textContent = typo(t(`path-${p.id}.description`));
    progressPath.textContent = done === steps.length ? t('path-finished') : t('path-progress', { finished: done, total: steps.length });
    pathList.replaceChildren(
      ...steps.map((e, i) => {
        const state =
          e.state === 'done'
            ? t('path-done')
            : e.state === 'no-key'
              ? t('path-without-key')
              : e.state === 'locked'
                ? t('path-locked', { chapter: t(`chapter-${e.before}`) })
                : i === next
                  ? t('path-next')
                  : t('path-open');
        const b = el(
          'button',
          { type: 'button', 'data-h': String(e.h), 'data-c': String(e.c), 'data-state': e.state },
          el('span', { class: 'title' }, t(`chapter-${e.chapter}`)),
          el('span', { class: 'abstract' }, t('path-in', { story: storyTitle(e.h) })),
          level(difficulty(e.chapter)),
          el('span', { class: 'state' }, state),
        );
        b.disabled = e.state === 'locked' || e.state === 'no-key';
        b.toggleAttribute('data-next', i === next);
        b.setAttribute('aria-current', String(e.h === story() && e.c === active()));
        return el('li', {}, b);
      }),
    );
  };

  const navUpdate = () => {
    workstationButton.setAttribute('aria-current', String(story() === -1));
    storiesBoutons.forEach((b, h) => {
      b.setAttribute('aria-current', String(h === story()));
      b.disabled = !accessible(h);
      // Stories without their key are greyed out: the player moves from one to the next.
      b.toggleAttribute('data-locked', !accessible(h));
      const done = chapters(h).filter((c) => finished.includes(c.id)).length;
      const next = chapters(h).findIndex((c) => !finished.includes(c.id));
      b.querySelectorAll('.diode').forEach((d, c) => {
        d.classList.toggle('lit', finished.includes(chapters(h)[c].id));
        d.classList.toggle('in-progress', accessible(h) && c === next);
      });
      const total = chapters(h).length;
      // The machine's state on the map: its cable and frame light up.
      b.parentElement!.dataset.state = !accessible(h) ? 'locked' : done === chapters(h).length ? 'finished' : done > 0 || h === story() ? 'in-progress' : 'open';
      // Locked: the chapters still missing to receive its key.
      const rest = missing(STORIES[h].id, finished);
      b.querySelector('.state')!.textContent = !accessible(h)
        ? rest.length
          ? t('state-key-after', { chapters: new Intl.ListFormat(t.language, { type: 'conjunction' }).format(rest.map((c) => t('state-key-chapter', { title: t(`chapter-${c}`) }))) })
          : t('state-key-missing')
        : done === total
          ? t('state-story-finished')
          : total > 1
            ? t('state-chapters-done', { finished: done, total })
            : '';
    });
    keyHelp.hidden = storiesBoutons.every((b) => !b.disabled) || display.view === 'paths';
    pathUpdate();
    chaptersNavs.forEach((nav, h) => {
      nav.hidden = h !== story() || chapters(h).length < 2;
      nav.querySelectorAll<HTMLButtonElement>('[data-chapter]').forEach((b, c) => {
        b.disabled = !open(h, c);
        b.setAttribute('aria-current', String(h === story() && c === active()));
        b.querySelector('.state')!.textContent = finished.includes(chapters(h)[c].id)
          ? t('state-chapter-finished')
          : open(h, c)
            ? ''
            : t('state-locked');
      });
    });
    // "Next chapter": after a finished chapter, if one remains.
    const h = story();
    end.hidden = !(h >= 0 && gameTerminal.remote!.shell.finished && active() < chapters(h).length - 1);
    const links = h >= 0 && gameTerminal.remote!.shell.finished ? rouagesLinks(gameTerminal.remote!.shell.chapter.id) : [];
    forUnderstand.hidden = links.length === 0;
    rouagesList.replaceChildren(
      ...links.map((l) => el('li', {}, el('a', { href: l.address, hreflang: 'fr', target: '_blank', rel: 'noopener' }, typo(t(`rouages-link-${l.id}`))))),
    );
  };

  const notebookUpdate = () => {
    const names = Object.keys(notebook).sort((a, b) => a.localeCompare(b));
    titleNotebook.textContent = playerName ? t('notebook-title-of', { name: playerName }) : t('notebook-title');
    accountNotebook.textContent = t('notebook-account', { count: names.length });
    emptyNotebook.hidden = names.length > 0;
    actionsNotebook.hidden = names.length === 0;
    listNotebook.replaceChildren(
      ...names.flatMap((name) => [
        el('dt', {}, el('code', {}, name)),
        el('dd', {}, typo(description(name, t)), ' ', el('code', { class: 'example' }, notebook[name].line)),
      ]),
    );
  };

  // mm:ss (or h:mm:ss): digits, like a stopwatch.
  const minutes = (ms: number) => {
    const s = Math.floor(ms / 1000);
    const h = Math.floor(s / 3600);
    const mmss = `${String(Math.floor((s % 3600) / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
    return h ? `${h}:${mmss}` : mmss;
  };
  const timerUpdate = () => {
    stopwatch.textContent = examStart === null ? '' : t('exam-timer', { time: minutes(Date.now() - examStart) });
  };
  const timer = setInterval(() => {
    if (examStart !== null) timerUpdate();
    if (onCall) onCallUpdate();
  }, 1000);
  // End of the chapter in exam mode: the time, and this browser's record.
  const examEnd = () => {
    if (examStart === null || !gameTerminal.remote?.shell.finished) return;
    const id = gameTerminal.remote.shell.chapter.id;
    const time = Date.now() - examStart;
    const old = records[id];
    if (old === undefined || time < old) records[id] = time;
    show(t(old === undefined || time < old ? 'exam-finished-record' : 'exam-finished', { time: minutes(time), record: minutes(records[id]) }), 'exam-result');
    examStart = null;
    timerUpdate();
  };

  // The achievements earned by the last line (sh: its session; null: outside a line).
  const checkAchievements = (sh: Shell | null) => {
    for (const id of newAchievements({ sh, finished, notebook, records }, achievements)) {
      achievements[id] = new Date().toISOString();
      show(t('achievements-obtained', { name: t(`achievements-${id}`) }), 'achievements');
    }
    achievementsUpdate();
  };
  const achievementsUpdate = () => {
    achievementsButton.textContent = t('achievements-button', { earned: Object.keys(achievements).length, total: ACHIEVEMENTS.length });
  };
  // The summary: time spent counts from the first time the current chapter is seen.
  const debuts = new WeakMap<Shell, number>();
  const inCourse = new WeakSet<Shell>();
  const doneSummary = new WeakSet<Shell>();
  const summaryText = (sh: Shell) => {
    const b = summary(sh);
    return t('summary-summary', { time: minutes(Date.now() - (debuts.get(sh) ?? Date.now())), commands: b.commands, errors: b.errors, hints: b.hints });
  };
  const openSummary = (sh: Shell, recap: string) => {
    const b = summary(sh);
    titleSummary.textContent = t('summary-title', { chapter: t(`chapter-${sh.chapter.id}`) });
    mapCaption.textContent = recap;
    encourageSummary.textContent = t('summary-encourage', { hints: b.hints });
    tableSummary.replaceChildren(
      el(
        'table',
        {},
        el('thead', {}, el('tr', {}, ...['summary-col-step', 'summary-col-you', 'summary-col-reference'].map((k) => el('th', { scope: 'col' }, t(k))))),
        el(
          'tbody',
          {},
          ...b.steps.map((e, i) =>
            el(
              'tr',
              {},
              el('th', { scope: 'row' }, String(i + 1)),
              el('td', { 'data-title': t('summary-col-you') }, e.line === null ? el('span', { class: 'summary-other' }, t('summary-otherwise')) : el('code', {}, e.line)),
              el('td', { 'data-title': t('summary-col-reference') }, typo(e.solution)),
            ),
          ),
        ),
      ),
    );
    summaryWindow.showModal();
  };
  const noteSummary = () => {
    const sh = gameTerminal.remote?.shell;
    if (!sh) return;
    if (!debuts.has(sh)) debuts.set(sh, Date.now());
    if (!sh.finished) inCourse.add(sh);
    // A chapter seen in progress that has just finished: its summary, once.
    if (!sh.finished || !inCourse.has(sh) || doneSummary.has(sh)) return;
    doneSummary.add(sh);
    const recap = summaryText(sh);
    const detail = el('button', { type: 'button', class: 'link summary-button', 'aria-haspopup': 'dialog' }, t('summary-button'));
    detail.addEventListener('click', () => openSummary(sh, recap));
    output.appendChild(el('p', { class: 'summary' }, recap, ' ', detail));
  };
  closeSummary.addEventListener('click', () => summaryWindow.close());
  summaryWindow.addEventListener('close', () => setTimeout(() => input.focus()));

  const after = (sh: Shell | null = null) => {
    noteSummary();
    onCallUpdate();
    examEnd();
    checkAchievements(sh);
    notebookUpdate();
    promptUpdate();
    navUpdate();
    save();
    terminal.scrollTop = terminal.scrollHeight;
  };

  // The menu's shortcuts: a fresh screen, straight on the right machine.
  const goWorkstation = () => {
    followEnd();
    examStart = null;
    timerUpdate();
    output.replaceChildren(measure);
    if (gameTerminal.remote) gameTerminal.disconnect();
    show(`— ${t('workstation-title')} —`);
    show(gameTerminal.resetWorkstation());
    after();
  };
  const launch = (h: number, c?: number) => {
    followEnd();
    output.replaceChildren(measure);
    const chapter = c === undefined ? undefined : chapters(h)[c];
    if (gameTerminal.remote?.story === STORIES[h] && chapter) show(gameTerminal.open(chapter));
    else show(gameTerminal.connect(storyMachine(STORIES[h].id)!.name, chapter));
    // In exam mode, a chapter that (re)starts starts the timer; an already finished chapter doesn't.
    examStart = gameTerminal.exam && !gameTerminal.remote?.shell.finished ? Date.now() : null;
    if (examStart !== null) show(t('exam-start'), 'exam-result');
    timerUpdate();
    after();
  };

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const line = input.value;
    // A password is not displayed and doesn't go into the history.
    const secret = gameTerminal.shell.maskedInput();
    const response = secret || gameTerminal.shell.question !== null;
    if (secret) show(prompt.textContent ?? '', 'cmd');
    else showCommand(line, response ? null : tokens(line));
    if (line.trim() && !response) history.push(line);
    position = history.length;
    const shell = gameTerminal.shell;
    const hostBefore = shell.host;
    // The text size may have changed (A+, A−): so has the width in characters.
    columnsUpdate();
    const result = gameTerminal.execute(line);
    // An answer to a question (a password…) is not a command for the notebook.
    if (!response) note(notebook, shell);
    const lineFor = response ? null : shell;
    if (result === null) output.replaceChildren(measure);
    else show(result);
    // The staging: connecting to another machine, rebooting.
    if (gameTerminal.shell.host !== hostBefore) putInScene(shell.last.commands.some((c) => c.includes('reboot')) ? 'reboot' : 'connection');
    input.value = '';
    after(lineFor);
    openEditor();
    openFollow();
  });

  // A follow (tail -f, journalctl -f): the screen makes time pass on the
  // machine (SECONDS_FOLLOW per real second) and shows what arrives.
  let followTimer: number | null = null;
  const followEnd = () => {
    if (followTimer !== null) clearInterval(followTimer);
    followTimer = null;
    followStop.hidden = true;
    form.hidden = false;
    if (touchesBar.dataset.mode === 'follow') delete touchesBar.dataset.mode;
  };
  const stopFollow = () => {
    if (followTimer === null) return;
    followEnd();
    show(gameTerminal.interrupt());
    after();
    input.focus();
  };
  const openFollow = () => {
    if (!gameTerminal.follows) return;
    form.hidden = true;
    touchesBar.dataset.mode = 'follow';
    followStop.hidden = false;
    followStop.focus();
    followTimer = window.setInterval(() => {
      const fresh = gameTerminal.follow(SECONDS_FOLLOW);
      if (!fresh) return;
      show(fresh, 'follow');
      after();
    }, 1000);
  };
  followStop.addEventListener('click', stopFollow);
  followStop.addEventListener('keydown', (e) => {
    if ((e.ctrlKey && e.key.toLowerCase() === 'c') || e.key === 'Escape') {
      e.preventDefault();
      stopFollow();
    }
  });

  // nano: the editor takes the place of the command line until ^X.
  const openEditor = () => {
    const edition = gameTerminal.edition;
    if (!edition) return;
    form.hidden = true;
    touchesBar.dataset.mode = 'nano';
    terminal.append(
      editor({
        t,
        path: edition.path,
        text: edition.text,
        message: edition.message,
        save: (text) => gameTerminal.save(text),
        close: () => {
          show(gameTerminal.quitEdition());
          form.hidden = false;
          delete touchesBar.dataset.mode;
          after();
          input.focus();
        },
      }),
    );
    terminal.scrollTop = terminal.scrollHeight;
  };

  const search = (moreOld = false) => {
    if (!query) return;
    const since = moreOld ? history.lastIndexOf(query.match) - 1 : history.length - 1;
    let found = '';
    for (let i = since; i >= 0; i--)
      if (history[i].includes(input.value)) {
        found = history[i];
        break;
      }
    if (found || !moreOld) query.match = found;
    match.textContent = t('search-history', { pattern: input.value, command: query.match });
  };
  const finishSearch = (keep: boolean) => {
    if (!query) return;
    input.value = keep ? query.match || input.value : query.before;
    query = null;
    match.textContent = '';
  };
  input.addEventListener('input', () => {
    search();
    colourInput();
  });
  // After a key (Tab, ↑, Ctrl-R…), the line may have changed; the field may have scrolled.
  input.addEventListener('keydown', () => setTimeout(colourInput));
  for (const event of ['scroll', 'select', 'keyup', 'click']) input.addEventListener(event, () => (coloration.scrollLeft = input.scrollLeft));
  input.addEventListener('keydown', (e) => {
    if (gameTerminal.shell.waiting || gameTerminal.shell.question) return;
    if (e.ctrlKey && e.key.toLowerCase() === 'r') {
      e.preventDefault();
      if (query) search(true);
      else {
        query = { before: input.value, match: '' };
        input.value = '';
        search();
      }
      return;
    }
    if (query) {
      if (e.key === 'Escape' || (e.ctrlKey && e.key.toLowerCase() === 'g')) {
        e.preventDefault();
        finishSearch(false);
        return;
      }
      if (e.key === 'Enter' || e.key.startsWith('Arrow') || e.key === 'Tab') finishSearch(true);
      if (e.key === 'Enter') return;
    }
    // Ctrl-C with nothing selected: the line is abandoned, as in bash.
    if (e.ctrlKey && e.key.toLowerCase() === 'c' && input.selectionStart === input.selectionEnd) {
      e.preventDefault();
      show(`${prompt.textContent} ${input.value}^C`, 'cmd');
      input.value = '';
      position = history.length;
      return;
    }
    if (e.key === 'Tab') {
      e.preventDefault();
      const before = input.value;
      input.value = gameTerminal.complete(before);
      // Like bash: a second Tab with nothing more to complete shows the possibilities.
      if (input.value === before && previousTab === before) {
        const listing = gameTerminal.suggestions(before);
        if (listing) {
          show(`${prompt.textContent} ${before}`, 'cmd');
          show(listing, 'suggestions');
          terminal.scrollTop = terminal.scrollHeight;
        }
      }
      previousTab = input.value;
      return;
    }
    previousTab = null;
    if (e.key === 'ArrowUp' && position > 0) {
      e.preventDefault();
      input.value = history[--position];
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      position = Math.min(position + 1, history.length);
      input.value = history[position] ?? '';
    }
  });

  // Copy and paste as in most Linux terminals: the selected text is
  // copied, the right click (or the middle one) pastes it.
  // Shift + right click keeps the browser's menu. With a finger (or a stylus),
  // a long press selects the text and opens the phone's menu: the game
  // leaves it alone (a long press also sends contextmenu).
  let pointer = 'mouse';
  terminal.addEventListener('pointerdown', (e) => (pointer = e.pointerType), { passive: true });
  const mouse = (e: MouseEvent) => ((e as PointerEvent).pointerType || pointer) === 'mouse';
  const selection = () => ((root as ShadowRoot & { getSelection?: () => Selection | null }).getSelection?.() ?? window.getSelection())?.toString() ?? '';
  let copyOf = '';
  terminal.addEventListener('mouseup', (e) => {
    if (!mouse(e)) return;
    const text = selection();
    if (!text) return;
    copyOf = text;
    navigator.clipboard?.writeText(text).catch(() => {});
  });
  const paste = async (e: MouseEvent) => {
    e.preventDefault();
    let text = copyOf;
    if (!text) text = (await navigator.clipboard?.readText().catch(() => '')) ?? '';
    if (!text) return;
    const nano = terminal.querySelector('textarea');
    // In nano, the text keeps its lines; on the command line, it fits on one line.
    const target = nano ?? input;
    if (!nano) text = text.replace(/\s*\n\s*/g, ' ').trim();
    const start = target.selectionStart ?? target.value.length;
    const end = target.selectionEnd ?? start;
    target.setRangeText(text, start, end, 'end');
    target.focus();
    colourInput();
  };
  terminal.addEventListener('contextmenu', (e) => {
    if (!e.shiftKey && mouse(e)) paste(e);
  });
  terminal.addEventListener('auxclick', (e) => {
    if (e.button === 1) paste(e);
  });
  terminal.addEventListener('click', () => {
    if (!form.hidden && !selection()) input.focus();
  });
  pathList.addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest<HTMLButtonElement>('button[data-h]');
    if (!b || b.disabled) return;
    launch(Number(b.dataset.h), Number(b.dataset.c));
    input.focus();
  });
  pathChoice.addEventListener('change', () => {
    display.path = pathChoice.value;
    applyDisplay();
  });
  workstationButton.addEventListener('click', () => {
    goWorkstation();
    input.focus();
  });
  storiesBoutons.forEach((b, h) =>
    b.addEventListener('click', () => {
      launch(h);
      input.focus();
    }),
  );
  chaptersNavs.forEach((nav, h) =>
    nav.querySelectorAll<HTMLButtonElement>('[data-chapter]').forEach((b, c) =>
      b.addEventListener('click', () => {
        launch(h, c);
        input.focus();
      }),
    ),
  );
  following.addEventListener('click', () => {
    launch(story(), active() + 1);
    input.focus();
  });
  // The notebook can be taken away: a Markdown file, or the clipboard.
  const markdown = () => inMarkdown(notebook, t, finished, playerName);
  exported.addEventListener('click', () => {
    const link = el('a', { href: URL.createObjectURL(new Blob([markdown()], { type: 'text/markdown' })), download: t('notebook-file') });
    link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 1000);
  });
  copyNotebook.addEventListener('click', () => {
    navigator.clipboard
      ?.writeText(markdown())
      .then(() => (stateNotebook.textContent = t('notebook-copy')))
      .catch(() => (stateNotebook.textContent = t('notebook-copy-impossible')));
  });
  // ——— On-call duty ———
  // The results of past days, in this browser (the best of each day).
  const ON_CALL_KEY = `${KEY}-on-call`;
  type Result = { chapter: string; remaining: number; time: number; hints: number; errors: number };
  let results: Record<string, Result> = {};
  try {
    results = JSON.parse(localStorage.getItem(ON_CALL_KEY) ?? '{}') ?? {};
  } catch {}
  // Today's date (YYYY-MM-DD, local time): the same everywhere on the same day.
  const today = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };
  const longDate = (iso: string) => new Intl.DateTimeFormat(t.language, { dateStyle: 'long' }).format(new Date(`${iso}T12:00:00`));
  let onCall: { date: string; chapter: string; start: number; sh: Shell | null; epuise: boolean } | null = null;
  // The incident of the day is drawn among the stories already open (null: none yet).
  const incident = (date = today()) => dayIncident(date, (h) => gameTerminal.isOpen(h));
  const incidentUpdate = () => {
    const id = incident();
    incidentButton.disabled = !id || onCall !== null;
    const done = results[today()];
    incidentText.textContent = !id
      ? t('on-call-locked')
      : done
        ? t('on-call-already', { percent: percent(done.remaining) })
        : t('on-call-today', { chapter: t(`chapter-${id}`), story: storyTitle(placeFor(id).h) });
  };
  incidentButton.addEventListener('click', () => {
    const id = incident();
    if (!id) return;
    titleOnCall.textContent = t('on-call-title', { date: longDate(today()) });
    chapterOnCall.textContent = t('on-call-today', { chapter: t(`chapter-${id}`), story: storyTitle(placeFor(id).h) });
    onCallWindow.showModal();
  });
  cancelOnCall.addEventListener('click', () => onCallWindow.close());
  onCallWindow.addEventListener('close', () => setTimeout(() => input.focus()));
  takeOnCall.addEventListener('click', () => {
    onCallWindow.close();
    const date = today();
    const chapter = incident(date);
    if (!chapter) return;
    // On call, hints are allowed (they cost points): no exam mode.
    examCase.checked = false;
    gameTerminal.exam = false;
    const { h, c } = placeFor(chapter);
    launch(h, c);
    onCall = { date, chapter, start: Date.now(), sh: gameTerminal.remote?.shell ?? null, epuise: false };
    // During on-call duty, no second on-call: the button comes back at the end (or on giving up).
    incidentButton.disabled = true;
    show(t('on-call-start'), 'achievements');
    onCallUpdate();
    input.focus();
  });
  // Every second and after each command: the gauge, giving up, the end.
  const onCallUpdate = () => {
    if (!onCall) {
      onCallGauge.hidden = true;
      incidentUpdate();
      return;
    }
    const here = gameTerminal.remote?.shell;
    // Another chapter opened: on-call duty is abandoned (going through the workstation is not).
    if (here && here.chapter.id !== onCall.chapter) {
      onCall = null;
      show(t('on-call-abandon'));
      return onCallUpdate();
    }
    if (here) onCall.sh = here;
    const sh = onCall.sh;
    if (!sh) return;
    const elapsed = Date.now() - onCall.start;
    const remaining = remainingBudget(elapsed, sh.requestsHints.size, sh.commandsInError);
    onCallGauge.hidden = false;
    onCallGauge.textContent = t('on-call-gauge', { time: minutes(remaining), percent: percent(remaining) });
    onCallGauge.classList.toggle('low', remaining < 5 * 60 * 1000);
    if (remaining === 0 && !onCall.epuise) {
      onCall.epuise = true;
      show(t('on-call-exhausted'), 'exam-result');
    }
    if (!sh.finished) return;
    // The incident is solved: the result (the day's best is kept), then the score card.
    const r: Result = { chapter: onCall.chapter, remaining, time: elapsed, hints: sh.requestsHints.size, errors: sh.commandsInError };
    const before = results[onCall.date];
    if (!before || r.remaining > before.remaining) results[onCall.date] = r;
    try {
      localStorage.setItem(ON_CALL_KEY, JSON.stringify(results));
    } catch {}
    scoreMap.textContent = t('on-call-map', {
      date: onCall.date,
      chapter: t(`chapter-${r.chapter}`),
      time: minutes(r.time),
      gauge: gauge(r.remaining),
      percent: percent(r.remaining),
      hints: r.hints,
      errors: r.errors,
      address: 'https://sysadmin.rouages.net',
    });
    mapState.textContent = '';
    onCall = null;
    onCallUpdate();
    onCallEndWindow.showModal();
  };
  copyMap.addEventListener('click', () => {
    navigator.clipboard
      ?.writeText(scoreMap.textContent ?? '')
      .then(() => (mapState.textContent = t('on-call-copied')))
      .catch(() => {});
  });
  closeOnCallEnd.addEventListener('click', () => onCallEndWindow.close());
  onCallEndWindow.addEventListener('close', () => setTimeout(() => input.focus()));

  const applyExam = (yes: boolean) => {
    examCase.checked = yes;
    gameTerminal.exam = yes;
    // The current chapter restarts: in exam mode, on a fresh machine with the timer at zero.
    if (story() >= 0) launch(story(), active());
    else after();
  };
  let wantedExam = false;
  examCase.addEventListener('change', () => {
    const wanted = examCase.checked;
    const sh = gameTerminal.remote?.shell;
    // A chapter started and not finished: ask before restarting it.
    const inCourse = !!sh && !sh.finished && (gameTerminal.not ?? 1) > 0;
    if (!inCourse) return applyExam(wanted);
    examCase.checked = !wanted;
    wantedExam = wanted;
    titleExam.textContent = t(wanted ? 'exam-confirm-title' : 'exam-quit-title');
    textExam.textContent = typo(t(wanted ? 'exam-confirm-text' : 'exam-quit-text'));
    yesExam.textContent = t(wanted ? 'exam-confirm' : 'exam-quit');
    examWindow.showModal();
    notExam.focus();
  });
  yesExam.addEventListener('click', () => {
    examWindow.close();
    applyExam(wantedExam);
  });
  notExam.addEventListener('click', () => examWindow.close());
  examWindow.addEventListener('close', () => setTimeout(() => input.focus()));
  // A place on the map: its name, its markers in plain words (also read
  // by screen readers), then the places it contains.
  const drawPlace = (l: Place): HTMLElement => {
    const landmarks = [l.home && t('map-home'), l.closed && t('map-closed'), !l.visit && t('map-preview')].filter(Boolean).join(', ');
    return el(
      'li',
      { class: [l.visit ? 'visited' : 'preview', l.here ? 'here' : ''].join(' ').trim(), ...(l.here ? { 'aria-current': 'location' } : {}) },
      el('span', { class: 'name' }, l.name === '/' ? '/' : `${l.name}/`),
      ...(landmarks ? [' ', el('span', { class: 'markers' }, `(${landmarks})`)] : []),
      ...(l.here ? [' ', el('strong', { class: 'you-are-here' }, t('map-here'))] : []),
      ...(l.children.length ? [el('ul', {}, ...l.children.map(drawPlace))] : []),
    );
  };
  // The network plan: a diagram (a sideways tree, one column per level) and the same thing as a list.
  const SVG = 'http://www.w3.org/2000/svg';
  const svg = (name: string, attrs: Record<string, string>, ...children: (Node | string)[]) => {
    const e = document.createElementNS(SVG, name);
    for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
    e.append(...children);
    return e;
  };
  const WIDTH = 176;
  const HEIGHT = 54;
  const X_DIFFERENCE = 36;
  const Y_DIFFERENCE = 22;
  const classesPlan = (e: ElementPlan, here: string, visited: Set<string>) => {
    const r = planLandmarks(e, here, visited);
    return [e.role, r.here ? 'here' : '', e.host && !r.visit ? 'not-visited' : ''].filter(Boolean).join(' ');
  };
  const drawPlan = (root: ElementPlan, here: string, visited: Set<string>) => {
    const { places, columns, lines } = layOut(root);
    const x = (c: number) => 2 + c * (WIDTH + X_DIFFERENCE);
    const y = (l: number) => Y_DIFFERENCE + l * (HEIGHT + Y_DIFFERENCE);
    const width = x(columns) - X_DIFFERENCE + 2;
    const height = y(lines);
    const links = places
      .filter((p) => p.parent)
      .map((p) => {
        const forEachOf = p.parent!;
        const middle = x(forEachOf.column) + WIDTH + X_DIFFERENCE / 2;
        return svg('path', {
          class: p.element.tunnel ? 'link tunnel' : 'link',
          d: `M${x(forEachOf.column) + WIDTH} ${y(forEachOf.line) + HEIGHT / 2} H${middle} V${y(p.line) + HEIGHT / 2} H${x(p.column)}`,
        });
      });
    const boites = places.map((p) => {
      const e = p.element;
      const bx = x(p.column);
      const by = y(p.line);
      return svg(
        'g',
        { class: `box ${classesPlan(e, here, visited)}` },
        svg('rect', { x: String(bx), y: String(by), width: String(WIDTH), height: String(HEIGHT), rx: e.role === 'internet' ? '27' : '6' }),
        // A name alone (Internet) is centred in its box.
        svg('text', { x: String(bx + 10), y: String(by + (e.address || e.note ? 19 : HEIGHT / 2 + 5)), class: 'name' }, e.name),
        ...(e.address ? [svg('text', { x: String(bx + 10), y: String(by + 34), class: 'address' }, e.address)] : []),
        ...(e.note ? [svg('text', { x: String(bx + 10), y: String(by + 48), class: 'note' }, e.note)] : []),
        ...(planLandmarks(e, here, visited).here ? [svg('text', { x: String(bx), y: String(by - 6), class: 'marker-here' }, `▼ ${t('plan-here')}`)] : []),
      );
    });
    return svg('svg', { viewBox: `0 0 ${width} ${height}`, width: String(width), height: String(height), 'aria-hidden': 'true', focusable: 'false' }, ...links, ...boites);
  };
  const drawElement = (e: ElementPlan, here: string, visited: Set<string>): HTMLElement => {
    const r = planLandmarks(e, here, visited);
    const notes = [e.note, e.tunnel && t('plan-tunnel'), e.host && (r.visit ? t('plan-visit') : t('plan-not-visit'))].filter(Boolean).join(', ');
    return el(
      'li',
      { class: classesPlan(e, here, visited), ...(r.here ? { 'aria-current': 'location' } : {}) },
      el('span', { class: 'name' }, e.name),
      ...(e.address ? [' ', el('code', {}, e.address)] : []),
      ...(notes ? [' ', el('span', { class: 'markers' }, `(${notes})`)] : []),
      ...(r.here ? [' ', el('strong', { class: 'you-are-here' }, `← ${t('plan-here')}`)] : []),
      ...(e.children?.length ? [el('ul', {}, ...e.children.map((x) => drawElement(x, here, visited)))] : []),
    );
  };
  const chooseTab = (network: boolean) => {
    placesTab.setAttribute('aria-selected', String(!network));
    networkTab.setAttribute('aria-selected', String(network));
    placesTab.tabIndex = network ? -1 : 0;
    networkTab.tabIndex = network ? 0 : -1;
    placesPanel.hidden = network;
    networkPanel.hidden = !network;
  };
  placesTab.addEventListener('click', () => chooseTab(false));
  networkTab.addEventListener('click', () => chooseTab(true));
  // The arrow keys move from one tab to another (as in any tab list).
  tabs.addEventListener('keydown', (e) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    const network = placesTab.getAttribute('aria-selected') === 'true';
    chooseTab(network);
    (network ? networkTab : placesTab).focus();
    e.preventDefault();
  });
  mapButton.addEventListener('click', () => {
    const sh = gameTerminal.shell;
    titleMap.textContent = t('map-title', { machine: sh.host });
    treeMap.replaceChildren(el('ul', { class: 'tree' }, drawPlace(map(sh))));
    const plan = gameTerminal.remote?.shell.chapter.plan?.(t);
    tabs.hidden = !plan;
    if (plan) {
      planSchema.replaceChildren(drawPlan(plan, sh.host, gameTerminal.visited));
      listPlan.replaceChildren(el('ul', { class: 'tree' }, drawElement(plan, sh.host, gameTerminal.visited)));
      // On a small screen, the diagram scrolls in its box: the list opens by default.
      textPlan.open = matchMedia('(max-width: 40rem)').matches;
    }
    chooseTab(false);
    mapWindow.showModal();
    mapWindow.querySelector('.here')?.scrollIntoView({ block: 'center' });
  });
  // Once the dialog is closed (button or Escape), the command line gets focus back:
  // after the browser has returned focus to the button that opened it.
  closeMap.addEventListener('click', () => mapWindow.close());
  mapWindow.addEventListener('close', () => setTimeout(() => input.focus()));
  // The key bar: each button acts on the line without taking its
  // focus (the phone's keyboard stays open).
  touchesBar.addEventListener('pointerdown', (e) => {
    if ((e.target as HTMLElement).closest('button')) e.preventDefault();
  });
  touchesBar.addEventListener('click', (e) => {
    const pressedKey = (e.target as HTMLElement).closest('button')?.dataset.key;
    if (!pressedKey) return;
    // During a follow (tail -f), Ctrl-C stops it.
    if (followTimer !== null) {
      if (pressedKey === 'ctrl-c') stopFollow();
      return;
    }
    // In nano, ^O, ^X and ^C go to the editor, as if typed on the keyboard.
    const zone = terminal.querySelector<HTMLTextAreaElement>('.nano-text');
    if (form.hidden) {
      if (zone && pressedKey.startsWith('ctrl-')) zone.dispatchEvent(new KeyboardEvent('keydown', { key: pressedKey.slice(5), ctrlKey: true, bubbles: true, cancelable: true }));
      return;
    }
    if (pressedKey.length === 1) {
      // Like a keystroke: the phone's keyboard (and its ongoing input) sees it go by,
      // and the coloured line is redrawn at once (input event).
      input.focus();
      if (!document.execCommand?.('insertText', false, pressedKey)) {
        input.setRangeText(pressedKey, input.selectionStart ?? input.value.length, input.selectionEnd ?? input.value.length, 'end');
        input.dispatchEvent(new Event('input', { bubbles: true }));
      }
    }
    else {
      const [ctrl, key] = pressedKey === 'ctrl-c' ? [true, 'c'] : [false, pressedKey];
      input.dispatchEvent(new KeyboardEvent('keydown', { key, ctrlKey: ctrl, bubbles: true, cancelable: true }));
    }
    input.focus();
  });
  // The current chapter's mission.
  missionButton.addEventListener('click', () => {
    const sh = gameTerminal.remote?.shell;
    const c = sh?.chapter;
    titleMission.textContent = c ? t('mission-title', { chapter: t('chapter-number', { number: c.number }), title: t(`chapter-${c.id}`) }) : t('workstation-title');
    goalMission.textContent = c ? typo(t(`chapter-${c.id}.summary`)) : '';
    instructionsMission.textContent = (sh ?? gameTerminal.workstation).read(`${(sh ?? gameTerminal.workstation).home}/${(sh ?? gameTerminal.workstation).welcome}`) ?? '';
    const log = sh?.log ?? [];
    emptyMission.hidden = log.length > 0;
    logMission.replaceChildren(...log.map((m) => el('li', {}, el('pre', { class: 'mission-text' }, m))));
    helpUpdate();
    rescueUpdate();
    missionWindow.showModal();
  });
  closeMission.addEventListener('click', () => missionWindow.close());
  // The snapshot taken: its series (the chapter's opening) and the number of inputs replayed.
  let snapshot: { serial: number; not: number } | null = null;
  const rescueUpdate = () => {
    const sh = gameTerminal.remote?.shell;
    rescue.hidden = !sh;
    if (!sh) return;
    const not = gameTerminal.not;
    if (snapshot && snapshot.serial !== gameTerminal.serial) snapshot = null;
    const possible = not !== null && !gameTerminal.exam;
    takeSnapshot.disabled = !possible;
    goBackSnapshot.disabled = !possible || !snapshot || snapshot.not > not!;
    cancelInput.disabled = !possible || not === 0;
    rescueState.textContent = gameTerminal.exam
      ? t('rescue-exam')
      : not === null
        ? t('rescue-impossible')
        : snapshot
          ? t('rescue-taken', { steps: snapshot.not })
          : t('rescue-none');
  };
  takeSnapshot.addEventListener('click', () => {
    const not = gameTerminal.not;
    if (not === null) return;
    snapshot = { serial: gameTerminal.serial, not };
    rescueUpdate();
  });
  // Going back: the chapter's machine is replayed up to this point; the summary's time keeps running.
  const restore = (not: number) => {
    const old = gameTerminal.remote?.shell;
    followEnd();
    if (!old || !gameTerminal.restore(not)) return;
    const fresh = gameTerminal.remote!.shell;
    if (debuts.has(old)) debuts.set(fresh, debuts.get(old)!);
    if (inCourse.has(old)) inCourse.add(fresh);
    if (doneSummary.has(old) && fresh.finished) doneSummary.add(fresh);
    missionWindow.close();
    output.replaceChildren(measure);
    show(t('rescue-restored', { steps: not }), 'achievements');
    after();
    // Back in the middle of a tail -f: it continues.
    openFollow();
  };
  goBackSnapshot.addEventListener('click', () => snapshot && restore(snapshot.not));
  cancelInput.addEventListener('click', () => {
    const not = gameTerminal.not;
    if (not) restore(not - 1);
  });
  // Help for the current chapter: the levels already opened for this step stay visible.
  const helpUpdate = () => {
    const sh = gameTerminal.remote?.shell;
    help.hidden = !sh || gameTerminal.exam || sh.finished;
    if (help.hidden || !sh) return;
    const i = hint(sh);
    const openSet = HINT_LEVELS.filter((n) => sh.requestsHints.has(`${i.step ?? ''}:${n}`) || (n === 'manual' && sh.requestsHints.has(`:${n}`)));
    const blocks: HTMLElement[] = [];
    if (openSet.includes('manual')) blocks.push(el('p', {}, t('hint-manual', { pages: i.manual.map((c) => `man ${c}`).join(', ') })));
    if (openSet.includes('lead') && i.lead) blocks.push(el('p', {}, typo(i.lead)));
    if (openSet.includes('solution') && i.solution) blocks.push(el('pre', { class: 'mission-text' }, i.solution));
    if (!i.step && openSet.length < 3) blocks.push(el('p', { class: 'map-legend' }, typo(t('hint-more-nothing'))));
    hintText.replaceChildren(...blocks);
    // One level at a time: the next opens once the previous one has been read.
    HINT_LEVELS.forEach((n, k) => {
      const b = hintBoutons[n];
      b.hidden = openSet.includes(n) || (k > 0 && !openSet.includes(HINT_LEVELS[k - 1])) || (n !== 'manual' && !i.step);
    });
  };
  help.addEventListener('click', (e) => {
    const n = (e.target as HTMLElement).closest('button')?.dataset.level as HintLevel | undefined;
    const sh = gameTerminal.remote?.shell;
    if (!n || !sh) return;
    sh.requestsHints.add(`${n === 'manual' ? '' : (hint(sh).step ?? '')}:${n}`);
    helpUpdate();
    hintText.lastElementChild?.scrollIntoView({ block: 'nearest' });
  });
  missionWindow.addEventListener('close', () => setTimeout(() => input.focus()));
  // ——— The terminal's display ———
  // A setting of this browser only (not of the progress).
  const applyDisplay = () => {
    if (!THEMES.includes(display.theme)) display.theme = 'phosphor';
    display.size = Math.max(0, Math.min(SIZES.length - 1, Math.round(display.size) || 0));
    terminal.dataset.theme = display.theme;
    terminal.style.setProperty('--qds-terminal-size', `${SIZES[display.size]}rem`);
    themeChoice.value = display.theme;
    if (!(VIEWS as readonly string[]).includes(display.view)) display.view = 'network';
    storiesNav.dataset.view = display.view;
    storiesList.hidden = display.view === 'paths';
    pathBlock.hidden = display.view !== 'paths';
    if (!PATH.some((p) => p.id === display.path)) display.path = PATH[0].id;
    pathChoice.value = display.path;
    navUpdate();
    display.colours = display.colours !== false;
    gameTerminal.colours = display.colours;
    coloursButton.setAttribute('aria-pressed', String(display.colours));
    colourInput();
    VIEWS.forEach((v) => viewBoutons[v].setAttribute('aria-pressed', String(v === display.view)));
    moreSmall.disabled = display.size === 0;
    moreGrand.disabled = display.size === SIZES.length - 1;
    try {
      localStorage.setItem(DISPLAY_KEY, JSON.stringify(display));
    } catch {}
  };
  VIEWS.forEach((v) =>
    viewBoutons[v].addEventListener('click', () => {
      display.view = v;
      applyDisplay();
    }),
  );
  themeChoice.addEventListener('change', () => {
    display.theme = themeChoice.value;
    applyDisplay();
  });
  coloursButton.addEventListener('click', () => {
    display.colours = !display.colours;
    applyDisplay();
  });
  moreSmall.addEventListener('click', () => {
    display.size--;
    applyDisplay();
  });
  moreGrand.addEventListener('click', () => {
    display.size++;
    applyDisplay();
  });
  // Full screen: the terminal (and its key bar) takes the whole window; Escape leaves it.
  const toggleFocus = (enabled: boolean) => {
    screen.classList.toggle('focus', enabled);
    focusButton.setAttribute('aria-pressed', String(enabled));
    input.focus();
  };
  focusButton.addEventListener('click', () => toggleFocus(!screen.classList.contains('focus')));
  quitFocus.addEventListener('click', () => toggleFocus(false));
  screen.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && screen.classList.contains('focus') && !query) toggleFocus(false);
  });
  applyDisplay();
  // The staging (unless the system asks for less motion): a connection
  // being established, a screen going dark on reboot.
  const putInScene = (what: 'connection' | 'reboot') => {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    terminal.classList.remove('scene-connection', 'scene-reboot');
    void terminal.offsetWidth;
    terminal.classList.add(`scene-${what}`);
  };
  terminal.addEventListener('animationend', () => terminal.classList.remove('scene-connection', 'scene-reboot'));
  // ——— Achievements and rank ———
  achievementsButton.addEventListener('click', () => {
    const current = grade(finished);
    const following = GRADES.find((g) => g.chapters > finished.length);
    gradeAchievements.replaceChildren(
      el('strong', {}, t('achievements-grade', { grade: t(`grade-${current}`) })),
      ...(current === 'sre' ? [] : [' ', t('achievements-grade-next', { grade: t(`grade-${following?.id ?? 'sre'}`), chapters: following?.chapters ?? finished.length })]),
    );
    const date = (iso: string) => new Intl.DateTimeFormat(t.language, { dateStyle: 'medium' }).format(new Date(iso));
    listAchievements.replaceChildren(
      ...ACHIEVEMENTS.map((x) => {
        const obtained = achievements[x.id];
        const visible = obtained || !x.cache;
        return el(
          'li',
          { class: obtained ? 'earned' : 'to-earn' },
          el('span', { class: 'achievement-name' }, `${obtained ? '🏆' : '·'} ${visible ? t(`achievements-${x.id}`) : t('achievements-cache')}`),
          ' ',
          el('span', { class: 'achievement-description' }, visible ? typo(t(`achievements-${x.id}.description`)) : typo(t('achievements-cache.description'))),
          ...(obtained ? [' ', el('span', { class: 'achievement-date' }, t('achievements', { date: date(obtained) }))] : []),
        );
      }),
    );
    achievementsWindow.showModal();
  });
  closeAchievements.addEventListener('click', () => achievementsWindow.close());
  achievementsWindow.addEventListener('close', () => setTimeout(() => input.focus()));
  // ——— My progress ———
  // A restored save (code or file): it is written, then the game restarts from it.
  const resume = (s: Backup) => {
    try {
      localStorage.setItem(KEY, JSON.stringify(s));
    } catch {}
    progressWindow.close();
    clearInterval(timer);
    root.replaceChildren();
    mount(root, options);
  };
  const progressUpdate = () => {
    nameField.value = playerName;
    currentCode.textContent = progressCode(finished);
    progressState.textContent = '';
  };
  progressButton.addEventListener('click', () => {
    progressUpdate();
    progressWindow.showModal();
  });
  closeProgress.addEventListener('click', () => progressWindow.close());
  progressWindow.addEventListener('close', () => setTimeout(() => input.focus()));
  nameField.addEventListener('change', () => {
    playerName = cleanName(nameField.value);
    nameField.value = playerName;
    notebookUpdate();
    save();
  });
  copyCode.addEventListener('click', () => {
    navigator.clipboard
      ?.writeText(currentCode.textContent ?? '')
      .then(() => (progressState.textContent = t('notebook-copy')))
      .catch(() => (progressState.textContent = t('notebook-copy-impossible')));
  });
  // The code only gives finished chapters: they are added, losing nothing from here.
  const tryCode = () => {
    const read = readCode(codeField.value);
    if ('error' in read) {
      progressState.textContent = t(`progress-${read.error}`);
      codeField.focus();
      return;
    }
    const fresh = read.finished.filter((id) => !finished.includes(id));
    if (!fresh.length) {
      progressState.textContent = t('progress-nothing-new');
      return;
    }
    resume({ ...backupState(), finished: [...finished, ...fresh] });
  };
  resumeCode.addEventListener('click', tryCode);
  codeField.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') tryCode();
  });
  download.addEventListener('click', () => {
    const link = el('a', {
      href: URL.createObjectURL(new Blob([backupFile(backupState(), new Date())], { type: 'application/json' })),
      download: t('progress-name-file'),
    });
    link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 1000);
    progressState.textContent = t('progress-downloaded');
  });
  // The file replaces everything kept here: ask first.
  fileField.addEventListener('change', async () => {
    const file = fileField.files?.[0];
    if (!file) return;
    const read = readFile(await file.text());
    fileField.value = '';
    if ('error' in read) {
      progressState.textContent = t(`progress-${read.error}`);
      return;
    }
    if (!confirm(t('progress-confirm', { count: read.backup.finished?.length ?? 0 }))) return;
    resume(read.backup);
  });
  restart.addEventListener('click', () => {
    if (story() === -1) goWorkstation();
    else launch(story(), active());
    input.focus();
  });

  // At start: the story requested by the attribute, otherwise the one where the
  // player stopped, otherwise the workstation.
  const departure = STORIES.findIndex((h) => h.id === (options.story ?? saved.story));
  if (departure >= 0 && accessible(departure)) launch(departure);
  else goWorkstation();
  return { root: game };
}
