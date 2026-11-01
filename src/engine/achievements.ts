// Achievements and rank: small rewards, checked against what really
// happened (the line typed, the state of the game), never declared by the
// player. The texts (name, description) are in
// src/texts/<language>/interface.ftl: succes-<id> and
// succes-<id>.description. A "hidden" achievement only shows its name once
// earned (the easter eggs).

import { STORIES } from './chapters';
import type { Shell } from './shell';
import type { Notebook } from './notebook';

export interface Context {
  // The session where the line was typed (null: check made outside a line).
  sh: Shell | null;
  finished: string[];
  notebook: Notebook;
  // Best times in exam mode, per chapter (ms).
  records: Record<string, number>;
}

export interface Achievements {
  id: string;
  cache?: boolean;
  obtained: (c: Context) => boolean;
}

const finishedStories = (finished: string[]) => STORIES.filter((h) => h.chapters.every((c) => finished.includes(c.id)));
const commands = (c: Context) => c.sh?.last.commands ?? [];

export const ACHIEVEMENTS: Achievements[] = [
  { id: 'first-command', obtained: (c) => Object.keys(c.notebook).length > 0 },
  { id: 'manual', obtained: (c) => 'man' in c.notebook || 'apropos' in c.notebook },
  { id: 'cache-ls', obtained: (c) => commands(c).some((a) => a[0] === 'ls' && a.slice(1).some((o) => /^-[a-zA-Z]*a/.test(o) || o === '--all')) },
  { id: 'pipe', obtained: (c) => commands(c).length >= 2 },
  { id: 'redirection', obtained: (c) => !!c.sh?.last.redirection },
  { id: 'first-chapter', obtained: (c) => c.finished.length >= 1 },
  { id: 'eraser', obtained: (c) => finishedStories(c.finished).some((h) => h.id === 'eraser') },
  { id: 'restore', obtained: (c) => ['backup', 'versions', 'snapshots', 'database'].some((id) => c.finished.includes(id)) },
  { id: 'network', obtained: (c) => finishedStories(c.finished).some((h) => h.id === 'hive') },
  { id: 'three-stories', obtained: (c) => finishedStories(c.finished).length >= 3 },
  { id: 'all-stories', obtained: (c) => finishedStories(c.finished).length === STORIES.length },
  { id: 'fifty-commands', obtained: (c) => Object.keys(c.notebook).length >= 50 },
  { id: 'without-hint', obtained: (c) => !!c.sh?.finished && c.sh.chapter.id !== 'desk' && c.sh.requestsHints.size === 0 },
  { id: 'exam', obtained: (c) => Object.keys(c.records).length > 0 },
  { id: 'exam-lightning', obtained: (c) => Object.values(c.records).some((ms) => ms < 5 * 60_000) },
  // The easter eggs: one very precise line (see EGGS in shell.ts).
  { id: 'xyzzy', cache: true, obtained: (c) => !!c.sh?.eggs.has('xyzzy') },
  { id: 'sandwich', cache: true, obtained: (c) => !!c.sh?.eggs.has('sandwich') },
  { id: 'sl', cache: true, obtained: (c) => !!c.sh?.eggs.has('sl') },
];

/** The achievements earned now and not yet recorded (in the order of the list). */
export const newAchievements = (c: Context, already: Record<string, string>) => ACHIEVEMENTS.filter((s) => !already[s.id] && s.obtained(c)).map((s) => s.id);

// The ranks, from first to last: the number of finished chapters needed to reach each.
export const GRADES: { id: string; chapters: number }[] = [
  { id: 'intern', chapters: 0 },
  { id: 'apprentice', chapters: 1 },
  { id: 'junior', chapters: 4 },
  { id: 'admin', chapters: 15 },
  { id: 'confirmed', chapters: 30 },
  { id: 'senior', chapters: 45 },
];
const ALL = () => STORIES.reduce((n, h) => n + h.chapters.length, 0);

/** The rank from the finished chapters: "SRE" for the whole game. */
export function grade(finished: string[]): string {
  const n = finished.length;
  if (n >= ALL()) return 'sre';
  return GRADES.filter((g) => n >= g.chapters).at(-1)!.id;
}
