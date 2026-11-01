// The end-of-chapter summary: how many commands (and errors), how many
// hints, and, step by step, the command that cleared it next to the
// reference solution (the hints', see hints.ts).
// Objectives are checked on the machine's state: the player's command can
// be different and just as good. The time spent is measured by the
// interface (the engine stays deterministic).

import type { Shell } from './shell';

export interface SummaryStep {
  step: string;
  // The command that cleared the step; null: the step was passed another way.
  line: string | null;
  solution: string;
}

export interface Summary {
  commands: number;
  errors: number;
  hints: number;
  steps: SummaryStep[];
}

/** A chapter's summary (on its main session). */
export function summary(sh: Shell): Summary {
  const c = sh.chapter;
  const order = c.steps ?? c.events.map((e) => e.id);
  return {
    commands: sh.typedCommands,
    errors: sh.commandsInError,
    hints: sh.requestsHints.size,
    steps: order
      .filter((e) => sh.t.exists(`hint-${c.id}-${e}.solution`))
      .map((e) => ({ step: e, line: sh.passed[e] ?? null, solution: sh.t(`hint-${c.id}-${e}.solution`) })),
  };
}
