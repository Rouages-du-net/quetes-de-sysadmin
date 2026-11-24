// The end-of-chapter summary (see summary.ts in the engine): a line in the
// terminal once a chapter seen in progress finishes, with its details
// (summary-dialog.ts, a chunk of its own) and a replay; each run kept to
// compare a replay with (see runs.ts).

import type { Shell } from '../engine/shell';
import { summary } from '../engine/summary';
import { addRun, compare, makeRun, readRuns, type Comparison, type Runs } from '../engine/runs';
import { placeFor } from '../engine/on-call';
import type { Context } from './context';
import { el, minutes } from './dom';
import { lazyDialog } from './lazy-dialog';

export function summaryPart(ctx: Context) {
  const { t, terminal: gameTerminal } = ctx;
  // Kept in this browser only (not in the save file: a log of commands, not progress).
  const RUNS_KEY = `${ctx.KEY}-runs`;
  let runs: Runs = {};
  try {
    runs = readRuns(JSON.parse(localStorage.getItem(RUNS_KEY) ?? '{}'));
  } catch {}

  // Replay: the same chapter from the start, on a fresh machine (the run just finished is kept for the comparison).
  const replay = (id: string) => {
    if (dialog.built()?.window.open) dialog.built()!.window.close();
    const { h, c } = placeFor(id);
    ctx.launch(h, c).then(() => ctx.input.focus());
  };
  const dialog = lazyDialog(ctx, null, () => import('./summary-dialog').then((m) => (c: Context) => m.default(c, replay)));

  // The summary: time spent counts from the first time the current chapter is seen.
  const debuts = new WeakMap<Shell, number>();
  const inCourse = new WeakSet<Shell>();
  const doneSummary = new WeakSet<Shell>();
  const summaryText = (sh: Shell) => {
    const b = summary(sh);
    return t('summary-summary', { time: minutes(Date.now() - (debuts.get(sh) ?? Date.now())), commands: b.commands, errors: b.errors, hints: b.hints });
  };
  // Each finished run's comparison with the runs before it (null: a first run).
  const comparisons = new WeakMap<Shell, Comparison | null>();
  const noteSummary = () => {
    const sh = gameTerminal.remote?.shell;
    if (!sh) return;
    if (!debuts.has(sh)) debuts.set(sh, Date.now());
    if (!sh.finished) inCourse.add(sh);
    // A chapter seen in progress that has just finished: its summary, once.
    if (!sh.finished || !inCourse.has(sh) || doneSummary.has(sh)) return;
    doneSummary.add(sh);
    const recap = summaryText(sh);
    // This run, kept with the chapter's last ones; compared with them (see runs.ts).
    const b = summary(sh);
    const id = sh.chapter.id;
    const run = makeRun({
      chapter: id,
      date: new Date().toISOString(),
      time: debuts.has(sh) ? Date.now() - debuts.get(sh)! : null,
      commands: b.commands,
      errors: b.errors,
      hints: b.hints,
      exam: gameTerminal.exam,
      lines: ctx.runChapter === id ? ctx.runLines : [],
    });
    const earlier = runs[id] ?? [];
    comparisons.set(sh, compare(earlier, run));
    runs = addRun(runs, run);
    try {
      localStorage.setItem(RUNS_KEY, JSON.stringify(runs));
    } catch {}
    const detail = el('button', { type: 'button', class: 'link summary-button', 'aria-haspopup': 'dialog' }, t('summary-button'));
    detail.addEventListener('click', () => dialog.use((d) => d.show(sh, recap, comparisons.get(sh) ?? null)));
    const again = el('button', { type: 'button', class: 'link replay-button' }, t('replay-button'));
    again.addEventListener('click', () => replay(id));
    const before = earlier.at(-1);
    ctx.output.appendChild(el('p', { class: 'summary' }, recap, ' ', ...(before ? ['· ', t('summary-compare', { before: before.commands }), ' '] : []), detail, ' · ', again));
    ctx.announce(t('chapter-done-announce', { chapter: t(`chapter-${sh.chapter.id}`) }));
  };

  /** A machine restored from a snapshot (see Console.restore) keeps the summary's time and state. */
  const carryOver = (old: Shell, fresh: Shell) => {
    if (debuts.has(old)) debuts.set(fresh, debuts.get(old)!);
    if (inCourse.has(old)) inCourse.add(fresh);
    if (doneSummary.has(old) && fresh.finished) doneSummary.add(fresh);
  };

  return { summarySlot: dialog.slot, noteSummary, carryOver };
}
