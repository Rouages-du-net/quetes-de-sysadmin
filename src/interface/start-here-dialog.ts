// The questions of "Where do I start?" (see start-here.ts in the engine and
// in this directory): one group of choices each, in a dialog like the
// map's, and a suggestion from where the player stands. This module is a
// chunk of its own (lazy-dialog.ts); its texts are dialog-start-here.ftl.

import { difficulty } from '../engine/difficulty';
import { CATALOGUE as STORIES } from '../engine/catalogue';
import { complete, QUESTIONS, readAnswers, recommend, TEACHERS_PAGE, type Question, type Suggestion } from '../engine/start-here';
import type { Context } from './context';
import { el, refocusOnClose, uid } from './dom';

export default function startHereDialog(ctx: Context) {
  const { t, typo, lazy, display, finished } = ctx;
  const startId = uid('qds-start');
  const startQuestions = Object.keys(QUESTIONS) as Question[];
  // Not a <form>: the terminal's form styles stay its own; radio buttons group by name.
  const startForm = el(
    'div',
    { class: 'start-form' },
    ...startQuestions.map((q) =>
      el(
        'fieldset',
        { class: 'start-question' },
        el('legend', {}, lazy('dialog-start-here', `start-here-${q}`)),
        ...QUESTIONS[q].map((v) => el('label', {}, el('input', { type: 'radio', name: `${startId}-${q}`, value: v }), ' ', el('span', {}, lazy('dialog-start-here', `start-here-${q}-${v}`)))),
      ),
    ),
  );
  const startResult = el('section', { class: 'start-result', 'aria-labelledby': `${startId}-result` });
  // Announced when the suggestion changes: one sentence, not the whole block.
  const startStatus = el('p', { class: 'visually-hidden', role: 'status' });
  const closeStart = el('button', { type: 'button', class: 'button' }, lazy('dialog-start-here', 'start-here-close'));
  const startWindow = el(
    'dialog',
    { class: 'start-window', 'aria-labelledby': startId },
    el('h2', { id: startId }, lazy('dialog-start-here', 'start-here-title')),
    el('p', { class: 'map-legend' }, lazy('dialog-start-here', 'start-here-intro', true)),
    startForm,
    startResult,
    startStatus,
    el('p', { class: 'map-actions' }, closeStart),
  ) as HTMLDialogElement;

  const startStory = (id: string) => STORIES.findIndex((x) => x.id === id);
  const startSuggestion = (s: Suggestion, main: boolean) => {
    const h = STORIES.findIndex((x) => x.chapters.some((c) => c.id === s.chapter));
    const title = t(`chapter-${s.chapter}`);
    return el(
      main ? 'div' : 'li',
      { class: main ? 'start-suggestion main' : 'start-suggestion' },
      el('p', { class: 'start-path' }, typo(t('start-here-path', { path: t(`path-${s.path}`) }))),
      el('p', { class: 'start-chapter' }, el('strong', {}, typo(t('start-here-chapter', { chapter: title, story: ctx.storyTitle(h) }))), ' ', ctx.level(difficulty(s.chapter))),
      el('p', {}, typo(t(s.reason))),
      ...(s.before ? [el('p', { class: 'map-legend' }, typo(t('start-here-locked', { chapter: t(`chapter-${s.target}`), count: s.before })))] : []),
    );
  };
  // The answers checked in the form, kept, and the suggestion they give from where the player stands.
  const renderStart = () => {
    const answers: Partial<Record<Question, string>> = {};
    for (const q of startQuestions) {
      const checked = startForm.querySelector<HTMLInputElement>(`input[name="${startId}-${q}"]:checked`);
      if (checked) answers[q] = checked.value;
    }
    display.startHere = readAnswers(answers);
    ctx.applyDisplay();
    const heading = el('h3', { id: `${startId}-result` }, t('start-here-result'));
    if (!complete(display.startHere)) {
      startResult.replaceChildren(el('p', { class: 'map-legend' }, typo(t('start-here-incomplete'))));
      startStatus.textContent = '';
      return;
    }
    const r = recommend(display.startHere, finished, (id) => ctx.accessible(startStory(id)));
    // A suggestion, not a shortcut: the player goes on from the menu (the
    // first steps stay first). Its path becomes the one the "Paths" view
    // shows, and the first visit's card has done its job.
    if (r) {
      display.path = r.main.path;
      display.startOffer = 'done';
      ctx.applyDisplay();
    }
    if (!r) {
      startResult.replaceChildren(heading, el('p', {}, typo(t('start-here-all-done'))));
      startStatus.textContent = typo(t('start-here-all-done'));
      return;
    }
    startResult.replaceChildren(
      heading,
      startSuggestion(r.main, true),
      el('p', { class: 'map-legend' }, typo(t(r.note))),
      ...(r.teacher
        ? [
            el(
              'p',
              { class: 'start-teachers' },
              typo(t('start-here-teachers')),
              ' ',
              el('a', { href: `https://sysadmin.rouages.net${TEACHERS_PAGE[t.language] ?? TEACHERS_PAGE.en}`, target: '_blank', rel: 'noopener' }, t('start-here-teachers-link')),
            ),
          ]
        : []),
      ...(r.alternatives.length ? [el('h3', {}, t('start-here-alternatives')), el('ul', { class: 'start-alternatives' }, ...r.alternatives.map((s) => startSuggestion(s, false)))] : []),
    );
    startStatus.textContent = typo(t('start-here-announce', { chapter: t(`chapter-${r.main.chapter}`), path: t(`path-${r.main.path}`) }));
  };
  const showStart = () => {
    if (startWindow.open) return;
    const answers = readAnswers(display.startHere);
    startForm.querySelectorAll<HTMLInputElement>('input[type="radio"]').forEach((i) => {
      i.checked = answers[i.name.slice(startId.length + 1) as Question] === i.value;
    });
    startStatus.textContent = '';
    renderStart();
    startWindow.showModal();
  };
  startForm.addEventListener('change', renderStart);
  closeStart.addEventListener('click', () => startWindow.close());
  refocusOnClose(startWindow, () => ctx.input);

  return { window: startWindow, show: showStart };
}
