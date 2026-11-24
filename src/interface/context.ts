// What the interface's modules share (src/interface/game.ts builds it in
// mount()): the game's options, its texts, the console, the progress kept in
// this browser, the display settings, and the few functions one part of the
// interface calls in another. Each module receives it instead of reaching
// for the others: no module imports another's state, so there is no cycle.

import type { Console } from '../engine/console';
import type { Shell } from '../engine/shell';
import type { Notebook } from '../engine/notebook';
import type { Answers } from '../engine/start-here';
import type { Step } from '../engine/feedback';
import type { Backup, OnCallResult } from '../engine/progress';
import type { Level } from '../engine/difficulty';
import type { CatalogueStory } from '../engine/catalogue';
import type { Language, Translate } from '../texts';

export interface Options {
  language?: Language;
  /** Story to open at start (identifier, e.g. "datacenter"), even without its key. */
  story?: string;
  /** Save key in localStorage (change it if several games share a site). */
  saveKey?: string;
  /** The host page shows its own exam-mode checkbox: the game's is hidden. */
  examOutside?: boolean;
  /** Called when exam mode is turned on or off (to keep the page's checkbox in step). */
  onExam?: (exam: boolean) => void;
}

// Display (theme, size, menu view, colours): a setting of this browser only.
// startHere: the answers to "Where do I start?" (see start-here.ts); startOffer: 'done' once its first-visit card is answered or dismissed.
export const DISPLAY = { theme: 'phosphor', size: 2, view: 'network', colours: true, path: '', tips: true, tour: '', autosave: true, explainer: true, startHere: {} as Partial<Answers>, startOffer: '', reminder: '' };
export type Display = typeof DISPLAY;
export const SIZES = [0.8, 0.9, 1, 1.15, 1.3, 1.5];
export const THEMES = ['phosphor', 'amber', 'contrast', 'paper'];
// Two views of the menu: the network map and the learning paths.
export const VIEWS = ['network', 'paths'] as const;

export interface Context {
  root: HTMLElement | ShadowRoot;
  options: Options;
  t: Translate;
  /** A text with the typography of the game's language. */
  typo: (text: string) => string;
  /** A dialog's fixed text, filled when its group of texts has loaded (withTexts). */
  lazy: (group: string, id: string, typographic?: boolean) => Text;
  /** Runs `then` once the group of texts is there (loading it first if needed). */
  withTexts: (group: string, then: () => void) => void;
  /** The save's key in localStorage, and its neighbours' prefix. */
  KEY: string;
  display: Display;
  /** Writes the display settings (a setting of this browser). */
  storeDisplay: () => void;

  // ——— The game and the progress kept in this browser ———
  terminal: Console;
  finished: string[];
  notebook: Notebook;
  /** Best times in exam mode (ms). */
  records: Record<string, number>;
  achievements: Record<string, string>;
  shownTips: string[];
  /** The on-call days solved (the best of each day). */
  results: Record<string, OnCallResult>;
  playerName: string;
  /** The start of the current chapter, in exam mode (null: no timer). */
  examStart: number | null;
  /** The last commands typed in the current chapter and their outputs (the feedback dialog offers them). */
  recentSteps: Step[];
  stepsChapter: string;
  /** The lines typed in the current chapter (an answer to a question is not one), and that chapter. */
  runLines: string[];
  runChapter: string;

  // ——— Places in the game ———
  storyTitle: (h: number) => string;
  chapters: (h: number) => CatalogueStory['chapters'];
  /** Current story and chapter (-1: on the workstation). */
  story: () => number;
  active: () => number;
  /** A chapter is open: the first, or the one before it finished. */
  open: (h: number, c: number) => boolean;
  /** The story has its key (or the host page opens it). */
  accessible: (h: number) => boolean;
  /** Today's date (YYYY-MM-DD, the player's local time). */
  today: () => string;
  /** The difficulty: stars for the eye, the level in words for screen readers. */
  level: (min: Level, max?: Level) => HTMLElement;

  // ——— Elements every part reaches ———
  game: HTMLDivElement;
  input: HTMLInputElement;
  output: HTMLDivElement;

  // ——— What one part asks of another (set by mount() once each part is built) ———
  show: (text: string, cls?: string) => void;
  echo: (promptText: string, ...line: (Node | string)[]) => void;
  /** Empties the terminal's output. */
  clearOutput: () => void;
  announce: (text: string) => void;
  /** Everything to refresh after a line, a launch or a change. */
  after: (sh?: Shell | null) => void;
  launch: (h: number, c?: number) => Promise<void>;
  launchNow: (h: number, c?: number) => void;
  goWorkstation: () => void;
  save: () => void;
  backupState: () => Backup;
  waitFor: (p: Promise<unknown>) => Promise<boolean>;
  prefetch: (h: number) => void;
  applyDisplay: () => void;
  startUpdate: () => void;
  notebookUpdate: () => void;
  timerUpdate: () => void;
  autosave: () => void;
  onCallActive: () => boolean;
  badgeUpdate: () => void;
  followEnd: () => void;
  openFollow: () => void;
  openEditor: () => void;
  colourInput: () => void;
  /** A history search (Ctrl-R) is going on. */
  searching: () => boolean;
  startTour: () => void;
}
