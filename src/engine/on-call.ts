// On-call duty and the incident of the day. Each day, a chapter is drawn from
// the date (the same for everyone, with no server) among those that look like
// a real outage: it is replayed "on call", with an error budget, like a
// service's availability objective (SLA). The budget melts with time, each
// hint and each failing command. At the end, a score card to share, as text
// (like sharing a word-game grid).
// The engine doesn't read the time: the interface gives the date and the elapsed time.

import { STORIES } from './chapters';
import { PATH } from './paths';

// 30 minutes of downtime tolerated for the incident.
export const BUDGET_MS = 30 * 60 * 1000;
export const MS_HINT_COST = 3 * 60 * 1000;
export const MS_ERROR_COST = 20 * 1000;

// The possible incidents: the chapters of the paths that deal with outages,
// without the first steps' ones (you must already know how to use the
// terminal), nor those relying on the workstation as earlier chapters left
// it (keys, ~/.ssh/config: watchesWorkstation, playerKeys): opened
// directly, they could be impossible to finish.
const THEMES = ['production', 'web', 'security', 'network', 'backups', 'deployment'];
const standalone = (id: string) => {
  const c = STORIES.flatMap((h) => h.chapters).find((x) => x.id === id)!;
  return !c.watchesWorkstation && !c.playerKeys;
};
export const INCIDENTS: string[] = [...new Set(PATH.filter((p) => THEMES.includes(p.id)).flatMap((p) => p.chapters))].filter(standalone);

// FNV-1a: a stable number drawn from a text.
function condensed(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 0x01000193) >>> 0;
  return h;
}

/**
 * The chapter of the incident of the day, for a date YYYY-MM-DD, among those
 * of the stories already open (stories open little by little); null
 * if there is none yet.
 */
export function dayIncident(date: string, isOpen: (story: string) => boolean = () => true): string | null {
  const possible = INCIDENTS.filter((id) => isOpen(STORIES[placeFor(id).h].id));
  return possible.length ? possible[condensed(`incident-${date}`) % possible.length] : null;
}

/** Where to find this chapter: its story and its rank (to open it). */
export function placeFor(chapter: string): { h: number; c: number } {
  const h = STORIES.findIndex((x) => x.chapters.some((c) => c.id === chapter));
  return { h, c: STORIES[h].chapters.findIndex((c) => c.id === chapter) };
}

/** What remains of the budget (in ms, never negative). */
export function remainingBudget(elapsed: number, hints: number, errors: number): number {
  return Math.max(0, BUDGET_MS - elapsed - hints * MS_HINT_COST - errors * MS_ERROR_COST);
}

/** The gauge in five squares, like a word-game grid: 🟩 full, 🟨 partly used, ⬜ empty. */
export function gauge(remaining: number): string {
  const part = (remaining / BUDGET_MS) * 5;
  return Array.from({ length: 5 }, (_, i) => (part >= i + 1 ? '🟩' : part > i ? '🟨' : '⬜')).join('');
}

/** The percentage of the budget that remains (integer). */
export const percent = (remaining: number) => Math.round((remaining / BUDGET_MS) * 100);
