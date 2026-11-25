// "Where do I start?": four short questions (experience with a terminal,
// goal, systems of interest, time per session) and a suggestion computed
// from them: a learning path (paths.ts), the chapter to play first in it,
// and one or two other ways in, each with its reason.
//
// The rules of the game don't change: a suggested chapter is always one the
// player can open now (its story open, the chapter before it finished). When
// the path's first chapter still to do is locked, the suggestion says which
// chapter opens the way and how many chapters remain before it (`before`).
//
// A pure function, deterministic: the same answers and the same progress
// give the same suggestion. The answers are a setting of this browser (the
// interface keeps them with the display settings), never part of the
// progress code or the save file. Texts: start-here-* (start-here.ftl).

import { CATALOGUE as STORIES } from './catalogue';
import { PATH } from './paths';
import { isOpen, prerequisites } from './unlocking';

export const QUESTIONS = {
  experience: ['never', 'little', 'daily'],
  goal: ['curiosity', 'studies', 'job', 'teacher'],
  systems: ['linux', 'windows', 'both', 'network', 'security', 'vintage'],
  time: ['short', 'medium', 'long'],
} as const;

export type Question = keyof typeof QUESTIONS;
export type Answers = { [Q in Question]: (typeof QUESTIONS)[Q][number] };

export interface Suggestion {
  /** The learning path (an id of PATH). */
  path: string;
  /** The path's first chapter not finished yet. */
  target: string;
  /** The chapter to play now: the target itself, or the first one on the way to it. */
  chapter: string;
  /** The chapters still to finish before the target opens (0: it is open). */
  before: number;
  /** The Fluent key of its reason (one whole sentence). */
  reason: string;
}

export interface Recommendation {
  main: Suggestion;
  /** One or two other ways in, on other paths. */
  alternatives: Suggestion[];
  /** A teacher: the interface points to the teachers' page too. */
  teacher: boolean;
  /** The Fluent key of a sentence about the time per session. */
  note: string;
}

// The teachers' page of each language of the site (English otherwise).
export const TEACHERS_PAGE: Record<string, string> = { en: '/en/teachers/', fr: '/fr/enseignants/', es: '/es/docentes/', de: '/de/lehrkraefte/' };

// The path of each system of interest. Linux alone depends on the goal: the
// web for curiosity, backups for studies (the basics every exam asks for),
// deployment for a job.
const SYSTEMS_PATH: Record<Exclude<Answers['systems'], 'linux'>, string> = {
  windows: 'identities',
  both: 'identities',
  network: 'network',
  security: 'security',
  vintage: 'production',
};
const LINUX_PATH: Record<Answers['goal'], string> = { curiosity: 'web', studies: 'backups', job: 'deployment', teacher: 'start' };
// The path of each goal, offered as another way in.
const GOAL_PATH: Record<Answers['goal'], string> = { curiosity: 'web', studies: 'backups', job: 'production', teacher: 'start' };
// A second path near each system of interest.
const NEAR_PATH: Record<Answers['systems'], string> = {
  linux: 'security',
  windows: 'production',
  both: 'production',
  network: 'security',
  security: 'network',
  vintage: 'deployment',
};

const storyOf = (chapter: string) => STORIES.find((s) => s.chapters.some((c) => c.id === chapter))!;

/** Can this chapter be played now: not finished, its story open, the chapter before it finished? */
export function playable(chapter: string, finished: readonly string[], open: (story: string) => boolean = (s) => isOpen(s, finished)): boolean {
  const story = storyOf(chapter);
  if (!story || finished.includes(chapter) || !open(story.id)) return false;
  const index = story.chapters.findIndex((c) => c.id === chapter);
  return index === 0 || finished.includes(story.chapters[index - 1].id);
}

/** The suggestion for one path, or null when the path is complete. */
export function suggestion(path: string, reason: string, finished: readonly string[], open: (story: string) => boolean = (s) => isOpen(s, finished)): Suggestion | null {
  const p = PATH.find((x) => x.id === path);
  const target = p?.chapters.find((c) => !finished.includes(c));
  if (!target) return null;
  // What has to be finished before the target opens, in an order that can be
  // played: what opens its story (prerequisites, dependencies before what
  // needs them), then the chapters before it in its story.
  const story = storyOf(target);
  const index = story.chapters.findIndex((c) => c.id === target);
  const needed = [...(open(story.id) ? [] : prerequisites(story.id)), ...story.chapters.slice(0, index).map((c) => c.id)].filter(
    (c, i, all) => !finished.includes(c) && all.indexOf(c) === i,
  );
  const now = playable(target, finished, open);
  const chapter = now ? target : needed.find((c) => playable(c, finished, open));
  if (!chapter) return null;
  return { path, target, chapter, before: now ? 0 : needed.length, reason };
}

/** What the answers suggest, from where the player stands (null: every path is complete). */
export function recommend(answers: Answers, finished: readonly string[] = [], open: (story: string) => boolean = (s) => isOpen(s, finished)): Recommendation | null {
  const teacher = answers.goal === 'teacher';
  const systemsPath = answers.systems === 'linux' ? LINUX_PATH[answers.goal] : SYSTEMS_PATH[answers.systems];
  // Who has never used a terminal, and teachers (to see what their students
  // will see), start with the first steps; the others with what interests them.
  const firstSteps = answers.experience === 'never' || teacher;
  const candidates: [string, string][] = [
    ...(firstSteps ? [['start', teacher ? 'start-here-reason-teacher' : 'start-here-reason-beginner'] as [string, string]] : []),
    [systemsPath, `start-here-why-${systemsPath}`],
    ...(answers.experience !== 'daily' ? [['start', 'start-here-why-start'] as [string, string]] : []),
    [GOAL_PATH[answers.goal], `start-here-why-${GOAL_PATH[answers.goal]}`],
    [NEAR_PATH[answers.systems], `start-here-why-${NEAR_PATH[answers.systems]}`],
    // The others, in the menu's order: something remains as long as a path does.
    ...PATH.map((p) => [p.id, `start-here-why-${p.id}`] as [string, string]),
  ];
  const seen = new Set<string>();
  const found: Suggestion[] = [];
  for (const [path, reason] of candidates) {
    if (seen.has(path)) continue;
    seen.add(path);
    const s = suggestion(path, reason, finished, open);
    if (s) found.push(s);
  }
  if (!found.length) return null;
  const [main, ...others] = found;
  // The other ways in: the near ones first (the first three candidates after
  // the main one); with little time, the one that opens soonest, with a lot,
  // the longest path (more to do in one sitting).
  const near = others.slice(0, 3);
  const remaining = (s: Suggestion) => PATH.find((p) => p.id === s.path)!.chapters.filter((c) => !finished.includes(c)).length;
  const order = answers.time === 'short' ? (a: Suggestion, b: Suggestion) => a.before - b.before : answers.time === 'long' ? (a: Suggestion, b: Suggestion) => remaining(b) - remaining(a) : () => 0;
  const alternatives = [...near].sort(order).slice(0, 2);
  return { main, alternatives, teacher, note: `start-here-note-${answers.time}` };
}

/** Every combination of answers (for tests, and to check the texts exist). */
export function allAnswers(): Answers[] {
  const out: Answers[] = [];
  for (const experience of QUESTIONS.experience)
    for (const goal of QUESTIONS.goal)
      for (const systems of QUESTIONS.systems) for (const time of QUESTIONS.time) out.push({ experience, goal, systems, time });
  return out;
}

/** Answers read back from storage: only known values are kept (a partial set is fine). */
export function readAnswers(value: unknown): Partial<Answers> {
  const out: Partial<Record<Question, string>> = {};
  if (!value || typeof value !== 'object') return {};
  for (const q of Object.keys(QUESTIONS) as Question[]) {
    const v = (value as Record<string, unknown>)[q];
    if (typeof v === 'string' && (QUESTIONS[q] as readonly string[]).includes(v)) out[q] = v;
  }
  return out as unknown as Partial<Answers>;
}

/** Are all four questions answered? */
export const complete = (a: Partial<Answers>): a is Answers => (Object.keys(QUESTIONS) as Question[]).every((q) => a[q] !== undefined);
