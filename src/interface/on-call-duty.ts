// On-call duty (see on-call.ts in the engine): the incident of the day, the
// same chapter for everyone, replayed against a budget of time; its dialog,
// the gauge, the score card at the end, and the streak (see streak.ts):
// kind words, never a reproach.

import type { Shell } from '../engine/shell';
import { CATALOGUE as STORIES } from '../engine/catalogue';
import { remainingBudget, dayIncident, gauge, placeFor, percent } from '../engine/on-call';
import { localDate, streak } from '../engine/streak';
import type { OnCallResult } from '../engine/progress';
import type { Context } from './context';
import { el, minutes, quiet, refocusOnClose, uid } from './dom';

export function onCallPart(ctx: Context, examOff: () => void) {
  const { t, typo, terminal: gameTerminal, results, today, storyTitle } = ctx;
  // The incident of the day: the same chapter for everyone, to replay on call.
  const incidentButton = el('button', { type: 'button', class: 'incident-button', 'aria-haspopup': 'dialog' }, ...quiet(t('on-call-button')));
  const incidentText = el('span', { class: 'incident-text' });
  const incidentBlock = el('p', { class: 'incident' }, incidentButton, ' ', incidentText);
  // The on-call streak (see streak.ts), under the incident: kind words, never a reproach.
  const streakLine = el('p', { class: 'streak', hidden: '' });
  const onCallGauge = el('span', { class: 'on-call-gauge', role: 'timer', hidden: '' });
  // On-call duty: the dialog that offers it, and the score card's at the end.
  const onCallId = uid('qds-on-call');
  const titleOnCall = el('h2', { id: onCallId });
  const chapterOnCall = el('p', { class: 'on-call-chapter' });
  const takeOnCall = el('button', { type: 'button', class: 'button' }, t('on-call-take'));
  const cancelOnCall = el('button', { type: 'button', class: 'button button-secondary' }, t('on-call-cancel'));
  const onCallWindow = el(
    'dialog',
    { class: 'on-call-window', 'aria-labelledby': onCallId },
    titleOnCall,
    el('p', { class: 'map-legend' }, typo(t('on-call-intro'))),
    chapterOnCall,
    el('p', { class: 'map-legend' }, typo(t('on-call-rules'))),
    el('p', { class: 'map-actions' }, cancelOnCall, ' ', takeOnCall),
  ) as HTMLDialogElement;
  const streakEnd = el('p', { class: 'streak' });
  const onCallEndId = uid('qds-on-call-end');
  const scoreMap = el('pre', { class: 'score-card' });
  const copyMap = el('button', { type: 'button', class: 'button' }, t('on-call-copy'));
  const mapState = el('p', { class: 'map-legend', role: 'status' });
  const closeOnCallEnd = el('button', { type: 'button', class: 'button button-secondary' }, t('map-close'));
  const onCallEndWindow = el(
    'dialog',
    { class: 'on-call-window', 'aria-labelledby': onCallEndId },
    el('h2', { id: onCallEndId }, t('on-call-end-title')),
    el('p', { class: 'map-legend' }, typo(t('on-call-end-intro'))),
    scoreMap,
    streakEnd,
    mapState,
    el('p', { class: 'map-actions' }, closeOnCallEnd, ' ', copyMap),
  ) as HTMLDialogElement;

  // The results of past days, in this browser (the best of each day).
  const ON_CALL_KEY = `${ctx.KEY}-on-call`;
  // The streak's words: the menu's line and the end of on-call's.
  const streakWords = () => {
    const s = streak(Object.keys(results), today());
    if (s.best === 0) return '';
    if (s.current === 0) return t('streak-best', { best: s.best });
    if (s.today) return t('streak-today', { days: s.current, best: s.best });
    const yesterday = s.rests.at(-1) === dayBefore(today());
    return [t('streak-going', { days: s.current, best: s.best }), yesterday ? t('streak-rest-used') : s.restReady ? t('streak-rest-ready') : ''].filter(Boolean).join(' ');
  };
  const dayBefore = (iso: string) => {
    const d = new Date(`${iso}T12:00:00`);
    d.setDate(d.getDate() - 1);
    return localDate(d);
  };
  const streakUpdate = () => {
    const words = streakWords();
    streakLine.replaceChildren(...quiet(words ? typo(words) : ''));
    streakLine.hidden = !words || incidentBlock.hidden;
  };
  const longDate = (iso: string) => new Intl.DateTimeFormat(t.language, { dateStyle: 'long' }).format(new Date(`${iso}T12:00:00`));
  let onCall: { date: string; chapter: string; start: number; sh: Shell | null; epuise: boolean } | null = null;
  // The incident of the day is drawn among the chapters the player can
  // already open: an open story, and the chapter before it finished (null:
  // none yet, and the button stays hidden).
  const incident = (date = today()) =>
    dayIncident(date, (id) => {
      const { h, c } = placeFor(id);
      return gameTerminal.isOpen(STORIES[h].id) && ctx.open(h, c);
    });
  const incidentUpdate = () => {
    const id = incident();
    incidentBlock.hidden = !id && onCall === null;
    incidentButton.disabled = !id || onCall !== null;
    const done = results[today()];
    incidentText.textContent = !id
      ? ''
      : done
        ? t('on-call-already', { percent: percent(done.remaining) })
        : t('on-call-today', { chapter: t(`chapter-${id}`), story: storyTitle(placeFor(id).h) });
    streakUpdate();
    ctx.badgeUpdate();
  };
  incidentButton.addEventListener('click', () => {
    const id = incident();
    if (!id) return;
    titleOnCall.textContent = t('on-call-title', { date: longDate(today()) });
    chapterOnCall.textContent = t('on-call-today', { chapter: t(`chapter-${id}`), story: storyTitle(placeFor(id).h) });
    onCallWindow.showModal();
  });
  cancelOnCall.addEventListener('click', () => onCallWindow.close());
  refocusOnClose(onCallWindow, () => ctx.input);
  takeOnCall.addEventListener('click', () => {
    onCallWindow.close();
    const date = today();
    const chapter = incident(date);
    if (!chapter) return;
    // On call, hints are allowed (they cost points): no exam mode.
    examOff();
    const { h, c } = placeFor(chapter);
    // During on-call duty, no second on-call: the button comes back at the end (or on giving up).
    incidentButton.disabled = true;
    onCall = { date, chapter, start: Date.now(), sh: null, epuise: false };
    // The story may load first: the budget starts once the incident is on screen.
    ctx.launch(h, c).then(() => {
      if (!onCall || gameTerminal.remote?.story.id !== STORIES[h].id) {
        onCall = null;
        incidentUpdate();
        return;
      }
      onCall.start = Date.now();
      onCall.sh = gameTerminal.remote?.shell ?? null;
      ctx.show(t('on-call-start'), 'achievements');
      onCallUpdate();
      ctx.input.focus();
    });
  });
  // Every second and after each command: the gauge, giving up, the end.
  const onCallUpdate = () => {
    if (!onCall) {
      onCallGauge.hidden = true;
      incidentUpdate();
      return;
    }
    const here = gameTerminal.remote?.shell;
    // Another chapter opened: on-call duty is abandoned (going through the workstation is not).
    if (here && here.chapter.id !== onCall.chapter) {
      onCall = null;
      ctx.show(t('on-call-abandon'));
      return onCallUpdate();
    }
    if (here) onCall.sh = here;
    const sh = onCall.sh;
    if (!sh) return;
    const elapsed = Date.now() - onCall.start;
    const remaining = remainingBudget(elapsed, sh.requestsHints.size, sh.commandsInError);
    onCallGauge.hidden = false;
    onCallGauge.textContent = t('on-call-gauge', { time: minutes(remaining), percent: percent(remaining) });
    onCallGauge.classList.toggle('low', remaining < 5 * 60 * 1000);
    if (remaining === 0 && !onCall.epuise) {
      onCall.epuise = true;
      ctx.show(t('on-call-exhausted'), 'exam-result');
    }
    if (!sh.finished) return;
    // The incident is solved: the result (the day's best is kept), then the score card.
    const r: OnCallResult = { chapter: onCall.chapter, remaining, time: elapsed, hints: sh.requestsHints.size, errors: sh.commandsInError };
    const before = results[onCall.date];
    if (!before || r.remaining > before.remaining) results[onCall.date] = r;
    try {
      localStorage.setItem(ON_CALL_KEY, JSON.stringify(results));
    } catch {}
    scoreMap.textContent = t('on-call-map', {
      date: onCall.date,
      chapter: t(`chapter-${r.chapter}`),
      time: minutes(r.time),
      gauge: gauge(r.remaining),
      percent: percent(r.remaining),
      hints: r.hints,
      errors: r.errors,
      address: 'https://sysadmin.rouages.net',
    });
    mapState.textContent = '';
    streakEnd.replaceChildren(...quiet(typo(streakWords())));
    onCall = null;
    onCallUpdate();
    onCallEndWindow.showModal();
  };
  copyMap.addEventListener('click', () => {
    navigator.clipboard
      ?.writeText(scoreMap.textContent ?? '')
      .then(() => (mapState.textContent = t('on-call-copied')))
      .catch(() => {});
  });
  closeOnCallEnd.addEventListener('click', () => onCallEndWindow.close());
  refocusOnClose(onCallEndWindow, () => ctx.input);

  return { incidentBlock, streakLine, onCallGauge, onCallWindow, onCallEndWindow, incident: () => incident(), onCallUpdate, active: () => onCall !== null };
}
