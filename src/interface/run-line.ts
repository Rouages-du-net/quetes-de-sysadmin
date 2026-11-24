// A line typed (Enter), or Ctrl-D: what it needs is loaded first, then it
// runs on the console, and the interface follows (notebook, the feedback
// dialog's last steps, the run's lines, tips, the error explainer, the
// staging, nano, a follow).

import { CATALOGUE as STORIES } from '../engine/catalogue';
import { loadedStory, loadStory } from '../engine/story-registry';
import { NeedsLoading } from '../engine/loading';
import { machineName, MACHINES } from '../engine/machines';
import { note } from '../engine/notebook';
import { STEPS_KEPT } from '../engine/feedback';
import { withoutColours } from '../engine/colours';
import { familiesNamed, loadFamily } from '../engine/families';
import { examplesLoaded, loadExamples } from '../engine/commands/manual';
import { loadTexts, textsLoaded } from '../texts';
import type { Context } from './context';
import type { outputPart } from './output';
import type { terminalPart } from './terminal';
import type { notesPart } from './notes';

// The manual's pages: man, apropos, whatis, --help, Get-Help, help, /?.
const MANUAL = /(^|[\s;&|(`])(man|apropos|whatis|help|get-help)(\s|$)|--help|\s-\?|\/\?/i;

export function runLinePart(ctx: Context, out: ReturnType<typeof outputPart>, term: ReturnType<typeof terminalPart>, notes: ReturnType<typeof notesPart>) {
  const { t, terminal: gameTerminal } = ctx;
  const { input, prompt } = term;

  // ——— Loading the parts of the game a line needs ———
  // Waiting for a part to load: the line stays as typed, read-only. Resolves to false if it failed (offline).
  let loadingNow = false;
  const waitFor = (p: Promise<unknown>): Promise<boolean> => {
    loadingNow = true;
    input.readOnly = true;
    ctx.game.setAttribute('aria-busy', 'true');
    const done = (ok: boolean) => {
      loadingNow = false;
      input.readOnly = false;
      ctx.game.removeAttribute('aria-busy');
      return ok;
    };
    return p.then(
      () => done(true),
      () => done(false),
    );
  };
  // The stories whose machine the line names (name, domain or address), not loaded yet.
  const named = (line: string) =>
    MACHINES.filter((m) => m.story && !loadedStory(m.story))
      .filter((m) => [machineName(t, m.name), m.name, m.address].some((n) => new RegExp(`(^|[^\\w.-])${n.replace(/\./g, '\\.')}(?![\\w-])`).test(line)))
      .map((m) => m.story!);
  const needs = (line: string): Promise<unknown> | null => {
    const parts: Promise<unknown>[] = [...new Set(named(line))].map((id) => loadStory(id, t.language));
    // A command of an engine family not loaded yet (its stories bring it; see families.ts).
    parts.push(...familiesNamed(line).map(loadFamily));
    if (MANUAL.test(line)) {
      if (!textsLoaded(t.language, 'manual')) parts.push(loadTexts(t.language, 'manual'));
      if (!examplesLoaded()) parts.push(loadExamples());
    }
    return parts.length ? Promise.all(parts) : null;
  };
  // Prefetch: a story's chunk while the pointer is on its button (or the button has the focus).
  const prefetch = (h: number) => {
    if (navigator.onLine === false) return;
    if (h >= 0 && h < STORIES.length && ctx.accessible(h)) loadStory(STORIES[h].id, t.language).catch(() => {});
  };

  // A line typed (Enter), or Ctrl-D (sent as the end-of-transmission character, shown as nothing).
  // What it may need is loaded first (needs()); the terminal waits meanwhile.
  const submitLine = (line: string) => {
    if (loadingNow) return;
    const pending = needs(line);
    if (!pending) return submitNow(line);
    waitFor(pending).then((ok) => (ok ? submitNow(line) : out.show(t('loading-failed'), 'error')));
  };
  let retried = false;
  const submitNow = (line: string) => {
    // A password is not displayed and doesn't go into the history.
    const secret = gameTerminal.shell.maskedInput();
    const response = secret || gameTerminal.shell.question !== null;
    // For the feedback dialog (see feedback.ts): the prompt as shown, before the line runs.
    const promptBefore = prompt.textContent ?? '';
    const chapterBefore = gameTerminal.remote?.shell.chapter.id;
    if (secret || line === '\u0004') out.echo(prompt.textContent ?? '');
    else term.showCommand(line, response ? null : term.tokens(line));
    const shell = gameTerminal.shell;
    const hostBefore = shell.host;
    // To tell whether the line failed, and its own error messages (see explainer.ts).
    const inErrorBefore = shell.commandsInError;
    const lastBefore = shell.last;
    const cwdBefore = shell.cwd;
    // The text size may have changed (A+, A−): so has the width in characters.
    const columns = out.columns();
    if (columns !== null) gameTerminal.columns = columns;
    let result: string | null;
    try {
      result = gameTerminal.execute(line);
    } catch (e) {
      // Something was still missing (a story reached in an unexpected way, a
      // manual page): loaded, then the line runs again.
      if (!(e instanceof NeedsLoading) || retried) throw e;
      waitFor(e.load()).then((ok) => {
        retried = ok;
        if (ok) submitNow(line);
        else out.show(t('loading-failed'), 'error');
        retried = false;
      });
      return;
    }
    // An answer to a question (a password…) is not a command for the notebook.
    if (!response) note(ctx.notebook, shell);
    // The chapter's last steps, for the feedback dialog: a password never kept (masked), "clear" keeps its line.
    if (chapterBefore) {
      if (chapterBefore !== ctx.stepsChapter) ctx.recentSteps = [];
      ctx.stepsChapter = chapterBefore;
      ctx.recentSteps = [...ctx.recentSteps, { prompt: promptBefore, line: secret || line === '\u0004' ? '' : line, masked: secret, output: withoutColours(result ?? '') }].slice(-STEPS_KEPT);
    }
    // The lines of this run of the chapter, for the comparison after a replay.
    if (chapterBefore && !response && line.trim() && line !== '\u0004') {
      if (chapterBefore !== ctx.runChapter) ctx.runLines = [];
      ctx.runChapter = chapterBefore;
      ctx.runLines.push(line);
    }
    const lineFor = response ? null : shell;
    if (result === null) out.clear();
    else out.show(result);
    const tab = term.takeTab();
    if (!response) notes.showTips(shell, cwdBefore, !!result, tab);
    // A password answered: sudo still asking (a wrong one), or the command that ran failed.
    const failed = shell.commandsInError > inErrorBefore || (secret && (shell.waiting !== null || shell.lastStatus !== 0));
    if (result) notes.offerExplanation(shell, result, failed, shell.last !== lastBefore);
    // The staging: connecting to another machine, rebooting.
    if (gameTerminal.shell.host !== hostBefore) term.putInScene(shell.last.commands.some((c) => c.includes('reboot')) ? 'reboot' : 'connection');
    input.value = '';
    ctx.after(lineFor);
    term.openEditor();
    term.openFollow();
  };

  return { submitLine, waitFor, prefetch };
}
