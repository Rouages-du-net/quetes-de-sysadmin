// Graded hints, asked for by the player (the "Mission" panel): first the
// manual page to read, then a lead, then almost the answer. They follow the
// game: the hint is the one for the chapter's first step not yet passed.
// Exam mode gives none, and the debrief says how many were asked for.
// Texts: src/texts/<language>/hints-<story>.ftl, one message per step
// (hint-<chapter>-<event>) with its .lead and .solution attributes.
// A step with no message has no hint (a false lead, a warning).

import type { Shell } from './shell';
import { allSheets } from './sheets';

export type HintLevel = 'manual' | 'lead' | 'solution';
export const HINT_LEVELS: HintLevel[] = ['manual', 'lead', 'solution'];

export interface Hint {
  // The targeted step (the event's identifier), or null: nothing left to point to.
  step: string | null;
  // The manual pages useful in this chapter (the commands it introduces).
  manual: string[];
  lead: string | null;
  solution: string | null;
}

/** The current hint for this session (its chapter, its steps already passed). */
export function hint(sh: Shell): Hint {
  const c = sh.chapter;
  const sheet = allSheets().find((f) => f.chapter === c);
  const manual = sheet?.fresh.length ? sheet.fresh : c.commands.filter((x) => !['ls', 'cd', 'pwd', 'cat', 'less'].includes(x)).slice(0, 4);
  const order = c.steps ?? c.events.map((e) => e.id);
  const step = order.find((e) => !sh.flags.has(e) && sh.t.exists(`hint-${c.id}-${e}.lead`));
  if (!step) return { step: null, manual, lead: null, solution: null };
  const id = `hint-${c.id}-${step}`;
  return { step, manual, lead: sh.t(`${id}.lead`), solution: sh.t(`${id}.solution`) };
}
