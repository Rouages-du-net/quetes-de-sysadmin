// The autosave inside a chapter (see autosave.ts): the inputs kept as the
// player goes, and at start the offer to resume a chapter left in progress:
// a banner above the terminal, not a modal window (the game may be embedded
// in a page the player is reading); its text is announced when it appears.

import { CATALOGUE as STORIES } from '../engine/catalogue';
import { NeedsLoading } from '../engine/loading';
import { withoutColours } from '../engine/colours';
import { STEPS_KEPT } from '../engine/feedback';
import { loadExamples } from '../engine/commands/manual';
import { autosaveKey, clearAutosave, readAutosave, recordOf, resume as resumeAutosave, writeAutosave, type AutosaveRecord } from '../engine/autosave';
import { loadTexts } from '../texts';
import type { Context } from './context';
import { el, uid } from './dom';

// The lines of the terminal shown again after a resume.
const RESUME_SHOWN = 40;

// localStorage itself can throw (storage blocked in a sandboxed frame).
const store = (): Storage | null => {
  try {
    return localStorage;
  } catch {
    return null;
  }
};

export function autosavePart(ctx: Context) {
  const { t, typo, display, terminal: gameTerminal, chapters, storyTitle } = ctx;
  const resumeId = uid('qds-resume');
  const resumeTitle = el('h2', { id: resumeId });
  const resumeText = el('p', {});
  const resumeYes = el('button', { type: 'button', class: 'button' });
  const resumeNo = el('button', { type: 'button', class: 'button button-secondary' }, t('autosave-restart'));
  const resumeBanner = el(
    'section',
    { class: 'resume-offer', 'aria-labelledby': resumeId, hidden: '' },
    resumeTitle,
    resumeText,
    el('p', { class: 'resume-actions' }, resumeYes, ' ', resumeNo),
  );
  const resumeStatus = el('p', { class: 'visually-hidden', role: 'status' });

  // One per language: the inputs hold names and passwords typed in it.
  const AUTOSAVE_KEY = autosaveKey(ctx.KEY, t.language);
  // What was last written (the chapter's series, the inputs, the hints): written again only when it changes.
  let autosaved = '';
  // The chapter whose inputs are kept (null: none).
  let kept: string | null = null;
  {
    const s = store();
    kept = s ? (readAutosave(s, AUTOSAVE_KEY)?.chapter ?? null) : null;
  }
  const forget = () => {
    const s = store();
    if (s) clearAutosave(s, AUTOSAVE_KEY);
    kept = null;
    autosaved = '';
  };
  // A chapter left in progress, offered at start: nothing is written until the player chooses.
  let pendingResume: AutosaveRecord | null = null;
  function autosave() {
    const s = store();
    if (!s || !display.autosave || pendingResume || ctx.onCallActive()) return;
    const sh = gameTerminal.remote?.shell;
    // On the workstation: the last point kept stays.
    if (!sh) return;
    const record = recordOf(gameTerminal, { exam: gameTerminal.exam, examStart: ctx.examStart });
    // Finished, or (re)started: nothing to resume in this chapter.
    if (sh.finished || record?.n === 0) {
      if (kept === sh.chapter.id) forget();
      return;
    }
    // No longer replayable (a passage through the workstation, a resumed session): the last point kept stays.
    if (!record) return;
    const mark = `${gameTerminal.serial}:${record.n}:${record.hints.length}`;
    if (mark !== autosaved && writeAutosave(s, AUTOSAVE_KEY, record)) {
      autosaved = mark;
      kept = record.chapter;
    }
  }
  // The chapter kept, if it can be offered: its story open, the chapter not finished, the same exam mode.
  const leftInProgress = (): AutosaveRecord | null => {
    const s = store();
    if (!s || !display.autosave) return null;
    const r = readAutosave(s, AUTOSAVE_KEY);
    if (!r || r.n === 0) return null;
    const h = STORIES.findIndex((x) => x.id === r.story);
    const c = h >= 0 ? chapters(h).findIndex((x) => x.id === r.chapter) : -1;
    if (c < 0 || ctx.finished.includes(r.chapter)) {
      forget();
      return null;
    }
    if (!ctx.accessible(h) || !ctx.open(h, c) || r.exam !== gameTerminal.exam || (ctx.options.story && ctx.options.story !== r.story)) return null;
    return r;
  };
  const placeOf = (r: AutosaveRecord) => {
    const h = STORIES.findIndex((x) => x.id === r.story);
    return { h, c: chapters(h).findIndex((x) => x.id === r.chapter) };
  };
  const offerResume = (r: AutosaveRecord) => {
    const { h } = placeOf(r);
    resumeTitle.textContent = t('autosave-title');
    resumeText.textContent = typo(t('autosave-text', { chapter: t(`chapter-${r.chapter}`), story: storyTitle(h), steps: r.n }));
    resumeYes.textContent = t('autosave-resume', { steps: r.n });
    resumeBanner.hidden = false;
    // Announced to screen readers, once.
    resumeStatus.textContent = `${resumeTitle.textContent}. ${resumeText.textContent}`;
  };
  function hideResume() {
    pendingResume = null;
    resumeBanner.hidden = true;
    resumeStatus.textContent = '';
  }
  resumeYes.addEventListener('click', () => {
    const r = pendingResume;
    if (!r) return hideResume();
    const { h, c } = placeOf(r);
    hideResume();
    // The chapter reopened fresh (nothing written meanwhile), then replayed,
    // once its story and the manual's pages and examples (a `man` among the inputs) have loaded.
    const manual = navigator.onLine === false ? Promise.resolve() : Promise.all([loadTexts(t.language, 'manual'), loadExamples()]).catch(() => {});
    pendingResume = r;
    Promise.all([ctx.launch(h, c), manual]).then(() => {
      pendingResume = null;
      if (gameTerminal.remote?.story.id !== STORIES[h].id) return;
      replayLeft(r, h, c);
    });
  });
  // The replay itself (resumeYes), the story loaded.
  const replayLeft = (r: AutosaveRecord, h: number, c: number, retried = false): void => {
    let result: ReturnType<typeof resumeAutosave>;
    try {
      result = resumeAutosave(gameTerminal, r);
    } catch (e) {
      // A part still missing (a text group): loaded, then the chapter reopened and replayed again.
      if (!(e instanceof NeedsLoading) || retried) throw e;
      pendingResume = r;
      ctx.waitFor(e.load()).then((ok) => {
        pendingResume = null;
        if (!ok) return ctx.show(t('loading-failed'), 'error');
        ctx.launchNow(h, c);
        replayLeft(r, h, c, true);
      });
      return;
    }
    if (!result.ok) {
      forget();
      ctx.launch(h, c);
      ctx.show(t(result.reason === 'changed' ? 'autosave-changed' : 'autosave-failed'), 'exam-result');
    } else {
      ctx.followEnd();
      ctx.clearOutput();
      // The end of the terminal as it was: the last lines typed and their outputs.
      const shown = result.transcript.slice(-RESUME_SHOWN);
      const hidden = result.transcript.filter((x) => x.prompt).length - shown.filter((x) => x.prompt).length;
      if (hidden > 0) ctx.output.appendChild(el('p', { class: 'cut' }, t('autosave-earlier', { steps: hidden })));
      for (const step of shown) {
        if (step.prompt) ctx.echo(step.prompt, ...(step.masked ? [] : [step.line]));
        ctx.show(step.output);
      }
      // The feedback dialog's commands (see feedback.ts): those of the chapter so far.
      ctx.recentSteps = result.transcript.map((x) => ({ ...x, output: withoutColours(x.output) })).slice(-STEPS_KEPT);
      ctx.stepsChapter = r.chapter;
      ctx.runLines = result.transcript.filter((x) => x.prompt && !x.masked && x.line.trim()).map((x) => x.line);
      ctx.runChapter = r.chapter;
      ctx.show(t('autosave-resumed', { steps: r.n }), 'achievements');
      // In exam mode, the timer goes on from the chapter's start (closing the page doesn't stop it).
      if (gameTerminal.exam && r.examStart !== undefined) ctx.examStart = r.examStart;
      ctx.timerUpdate();
    }
    ctx.after();
    ctx.openEditor();
    ctx.openFollow();
    if (!gameTerminal.edition && !gameTerminal.follows) ctx.input.focus();
  };
  resumeNo.addEventListener('click', () => {
    const r = pendingResume;
    hideResume();
    forget();
    if (r && gameTerminal.remote?.shell.chapter.id !== r.chapter) {
      const { h, c } = placeOf(r);
      ctx.launch(h, c);
    } else ctx.after();
    ctx.input.focus();
  });

  /** At start: a chapter left in progress (the tab closed, the phone that killed it), read before anything is written. */
  const pending = () => {
    const left = leftInProgress();
    if (left) pendingResume = left;
    return left;
  };
  /** The autosave turned on (the current chapter is kept from now on) or off (what was kept goes). */
  const turned = (on: boolean) => {
    if (on) {
      autosaved = '';
      autosave();
    } else {
      forget();
      hideResume();
    }
  };

  return { resumeBanner, resumeStatus, autosave, hideResume, forget, pending, offerResume, turned };
}
