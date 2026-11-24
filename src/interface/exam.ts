// Exam mode: no hints, a timer, the best time of each chapter in this
// browser. The checkbox (or the host page's, see src/exam-control.ts)
// restarts the current chapter, after a confirmation if it is in progress.

import type { Context } from './context';
import { el, minutes, refocusOnClose, uid } from './dom';

export function examPart(ctx: Context) {
  const { t, typo, terminal: gameTerminal, options } = ctx;
  const examCase = el('input', { type: 'checkbox' }) as HTMLInputElement;
  const stopwatch = el('span', { class: 'timer', role: 'timer' });
  // The exam-mode checkbox, at the bottom of the game (a choice for a class
  // test, not an everyday tool); the host page may show its own instead.
  const examChoice = el('p', { class: 'exam-choice' }, el('label', {}, examCase, el('span', {}, t('exam-case'))));
  if (options.examOutside) examChoice.hidden = true;
  // Confirmation of exam mode: it restarts the current chapter.
  const examId = uid('qds-exam');
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

  const timerUpdate = () => {
    stopwatch.textContent = ctx.examStart === null ? '' : t('exam-timer', { time: minutes(Date.now() - ctx.examStart) });
  };
  // End of the chapter in exam mode: the time, and this browser's record.
  const examEnd = () => {
    if (ctx.examStart === null || !gameTerminal.remote?.shell.finished) return;
    const id = gameTerminal.remote.shell.chapter.id;
    const time = Date.now() - ctx.examStart;
    const old = ctx.records[id];
    if (old === undefined || time < old) ctx.records[id] = time;
    ctx.show(t(old === undefined || time < old ? 'exam-finished-record' : 'exam-finished', { time: minutes(time), record: minutes(ctx.records[id]) }), 'exam-result');
    ctx.examStart = null;
    timerUpdate();
  };

  // The checkbox and the game's mode, in step (on-call duty turns it off: hints are allowed there).
  const setExam = (yes: boolean) => {
    examCase.checked = yes;
    gameTerminal.exam = yes;
    options.onExam?.(yes);
  };
  const applyExam = (yes: boolean) => {
    setExam(yes);
    // The current chapter restarts: in exam mode, on a fresh machine with the timer at zero.
    if (ctx.story() >= 0) ctx.launch(ctx.story(), ctx.active());
    else ctx.after();
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
  refocusOnClose(examWindow, () => ctx.input);

  /** Asks for exam mode, as the checkbox does (a chapter in progress asks for confirmation first). */
  const askExam = (yes: boolean) => {
    if (yes === gameTerminal.exam) return;
    examCase.checked = yes;
    examCase.dispatchEvent(new Event('change'));
  };

  return { examCase, stopwatch, examChoice, examWindow, timerUpdate, examEnd, setExam, askExam };
}
