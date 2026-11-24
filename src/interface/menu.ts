// The menu of stories and chapters (shortcuts): the network map (the
// workstation, the internet, then one machine per open story, plugged into
// the same cable, lighting up as the player progresses), the stories still
// locked, the learning paths (see paths.ts), each story's chapters, the
// "Next chapter" button and, after a chapter, the Les rouages du net pages
// that explain its concept.

import { difficulty, storyDifficulty } from '../engine/difficulty';
import { CATALOGUE as STORIES } from '../engine/catalogue';
import { machineDomain, storyMachine, WORKSTATION, type Machine } from '../engine/machines';
import { rouagesLinks } from '../engine/rouages';
import { pathSteps, PATH } from '../engine/paths';
import { missing } from '../engine/unlocking';
import { VIEWS, type Context } from './context';
import { el, quiet } from './dom';

export function menuPart(ctx: Context, extras: { startHereEntry: HTMLElement; incidentBlock: HTMLElement; streakLine: HTMLElement; reminderEntry: HTMLElement; feedbackEntry: HTMLElement }) {
  const { t, typo, finished, storyTitle, chapters, level, story, active, accessible, open, terminal: gameTerminal } = ctx;
  // The machine's name and address, shown on the network map (technical identifiers, never translated).
  const host = (m: Machine | undefined) => el('span', { class: 'host' }, m ? `${machineDomain(t, m)} ${m.address}` : '');
  const storiesBoutons = STORIES.map((h, i) =>
    el('button', { type: 'button', 'data-story': String(i) },
      el('span', { class: 'title' }, storyTitle(i), el('span', { class: 'new-badge', hidden: '' }, ' ', el('span', {}, t('story-new')))),
      host(storyMachine(h.id)),
      el('span', { class: 'abstract' }, typo(t(`story-${h.id}.summary`))),
      level(storyDifficulty(h.id).min, storyDifficulty(h.id).max),
      el('span', { class: 'state' }),
      // One LED per chapter, as on a server rack (the state in plain words is in .etat).
      el('span', { class: 'diodes', 'aria-hidden': 'true' }, ...h.chapters.map(() => el('span', { class: 'diode' })))),
  );
  const workstationButton = el('button', { type: 'button', 'data-workstation': '' }, el('span', { class: 'title' }, t('workstation-title')), host(WORKSTATION));
  const keyHelp = el('p', { class: 'key-help' }, ...quiet(typo(t('key-help'))));
  // Two views of the menu: the network map and the learning paths. The
  // stories still locked wait in a folded list under the map, so that the
  // map shows only what can be played.
  const viewBoutons = Object.fromEntries(
    VIEWS.map((v) => [v, el('button', { type: 'button', class: 'view-button', 'aria-pressed': 'false', 'data-view': v }, t(`view-${v}`))]),
  ) as Record<(typeof VIEWS)[number], HTMLButtonElement>;
  const viewChoice = el('p', { class: 'view-choice', role: 'group', 'aria-label': t('view-title') }, ...VIEWS.map((v) => viewBoutons[v]));
  const storyItems = storiesBoutons.map((b) => el('li', { class: 'node' }, b));
  const storiesList = el(
    'ol',
    {},
    el('li', { class: 'node-workstation' }, workstationButton),
    // The internet, between the workstation and the machines: a landmark, not a button.
    el('li', { class: 'node-internet', 'aria-hidden': 'true' }, el('span', {}, t('view-internet'))),
    ...storyItems,
  );
  // The locked stories, folded: their name and the chapters that open them.
  const lockedSummary = el('summary', {});
  const lockedList = el('ol', {});
  const lockedBlock = el('details', { class: 'locked-stories' }, lockedSummary, keyHelp, lockedList);
  // The "Paths" view: a theme, and its chapters taken from several stories (see paths.ts).
  const pathId = `qds-paths-${Math.random().toString(36).slice(2, 8)}`;
  const pathChoice = el(
    'select',
    { id: pathId },
    ...PATH.map((p) => el('option', { value: p.id }, t(`path-${p.id}`))),
  ) as HTMLSelectElement;
  const descriptionPath = el('p', { class: 'paths-description' });
  const progressPath = el('p', { class: 'paths-progress' });
  const pathList = el('ol', { class: 'paths-list' });
  const pathBlock = el(
    'div',
    { class: 'paths', hidden: '' },
    el('p', { class: 'paths-choice' }, el('label', { for: pathId }, t('path-choice')), ' ', pathChoice),
    descriptionPath,
    progressPath,
    pathList,
  );
  const { startHereEntry, incidentBlock, streakLine, reminderEntry, feedbackEntry } = extras;
  const storiesNav = el('nav', { class: 'stories', 'aria-label': t('stories-title') }, viewChoice, startHereEntry, incidentBlock, streakLine, reminderEntry, storiesList, lockedBlock, pathBlock, feedbackEntry);

  const chaptersNavs = STORIES.map((h, i) =>
    el('nav', { class: 'chapters', 'aria-label': t('chapters-title', { story: storyTitle(i) }), 'data-chapters': String(i) },
      el('ol', {}, ...h.chapters.map((c, j) =>
        el('li', {}, el('button', { type: 'button', 'data-chapter': String(j) },
          el('span', { class: 'num' }, t('chapter-number', { number: c.number })),
          el('span', { class: 'title' }, t(`chapter-${c.id}`)),
          // Its summary comes with the summaries' texts, once the terminal is ready (see the end of mount).
          el('span', { class: 'abstract' }, ctx.lazy('summaries', `chapter-${c.id}.summary`, true)),
          level(difficulty(c.id)),
          el('span', { class: 'state' })))))),
  );
  const following = el('button', { type: 'button', class: 'button primary' }, ...quiet(t('button-next')));
  const end = el('div', { class: 'end', hidden: '' }, following);
  // After a chapter: the Les rouages du net page that explains its concept.
  const rouagesList = el('ul', {});
  const forUnderstand = el('aside', { class: 'to-understand', hidden: '' }, el('p', {}, typo(t('rouages-intro'))), rouagesList);

  // The chosen path: each chapter, its story, its state; the next one to do is highlighted.
  const pathUpdate = () => {
    const p = PATH.find((x) => x.id === ctx.display.path) ?? PATH[0];
    const { steps, next } = pathSteps(p, finished, (id) => accessible(STORIES.findIndex((x) => x.id === id)));
    const done = steps.filter((e) => e.state === 'done').length;
    descriptionPath.textContent = typo(t(`path-${p.id}.description`));
    progressPath.replaceChildren(...quiet(done === steps.length ? t('path-finished') : t('path-progress', { finished: done, total: steps.length })));
    pathList.replaceChildren(
      ...steps.map((e, i) => {
        const state =
          e.state === 'done'
            ? t('path-done')
            : e.state === 'no-key'
              ? t('path-without-key')
              : e.state === 'locked'
                ? t('path-locked', { chapter: t(`chapter-${e.before}`) })
                : i === next
                  ? t('path-next')
                  : t('path-open');
        const b = el(
          'button',
          { type: 'button', 'data-h': String(e.h), 'data-c': String(e.c), 'data-state': e.state },
          el('span', { class: 'title' }, t(`chapter-${e.chapter}`)),
          el('span', { class: 'abstract' }, t('path-in', { story: storyTitle(e.h) })),
          level(difficulty(e.chapter)),
          el('span', { class: 'state' }, ...quiet(state)),
        );
        b.disabled = e.state === 'locked' || e.state === 'no-key';
        b.toggleAttribute('data-next', i === next);
        b.setAttribute('aria-current', String(e.h === story() && e.c === active()));
        return el('li', {}, b);
      }),
    );
  };

  const navUpdate = () => {
    workstationButton.setAttribute('aria-current', String(story() === -1));
    storiesBoutons.forEach((b, h) => {
      b.setAttribute('aria-current', String(h === story()));
      b.disabled = !accessible(h);
      // Stories without their key are greyed out: the player moves from one to the next.
      b.toggleAttribute('data-locked', !accessible(h));
      const done = chapters(h).filter((c) => finished.includes(c.id)).length;
      const next = chapters(h).findIndex((c) => !finished.includes(c.id));
      b.querySelectorAll('.diode').forEach((d, c) => {
        d.classList.toggle('lit', finished.includes(chapters(h)[c].id));
        d.classList.toggle('in-progress', accessible(h) && c === next);
      });
      const total = chapters(h).length;
      // The machine's state on the map: its cable and frame light up.
      b.parentElement!.dataset.state = !accessible(h) ? 'locked' : done === chapters(h).length ? 'finished' : done > 0 || h === story() ? 'in-progress' : 'open';
      // Locked: the chapters still missing to receive its key.
      const rest = missing(STORIES[h].id, finished);
      b.querySelector('.state')!.replaceChildren(...quiet(!accessible(h)
        ? rest.length
          ? t('state-key-after', { chapters: new Intl.ListFormat(t.language, { type: 'conjunction' }).format(rest.map((c) => t('state-key-chapter', { title: t(`chapter-${c}`) }))) })
          : t('state-key-missing')
        : done === total
          ? t('state-story-finished')
          : total > 1
            ? t('state-chapters-done', { finished: done, total })
            : ''));
    });
    // Open stories on the map (alternating sides of the cable), locked ones in the folded list.
    const locked = storyItems.filter((li) => li.dataset.state === 'locked');
    storyItems.filter((li) => li.dataset.state !== 'locked').forEach((li, i) => {
      li.dataset.side = i % 2 ? 'right' : 'left';
      storiesList.append(li);
    });
    lockedList.replaceChildren(...locked);
    lockedSummary.replaceChildren(...quiet(t('stories-locked', { count: locked.length })));
    lockedBlock.hidden = locked.length === 0 || ctx.display.view === 'paths';
    pathUpdate();
    ctx.startUpdate();
    chaptersNavs.forEach((nav, h) => {
      nav.hidden = h !== story() || chapters(h).length < 2;
      nav.querySelectorAll<HTMLButtonElement>('[data-chapter]').forEach((b, c) => {
        b.disabled = !open(h, c);
        b.setAttribute('aria-current', String(h === story() && c === active()));
        b.querySelector('.state')!.replaceChildren(...quiet(finished.includes(chapters(h)[c].id)
          ? t('state-chapter-finished')
          : open(h, c)
            ? ''
            : t('state-locked')));
      });
    });
    // "Next chapter": after a finished chapter, if one remains.
    const h = story();
    end.hidden = !(h >= 0 && gameTerminal.remote!.shell.finished && active() < chapters(h).length - 1);
    const links = h >= 0 && gameTerminal.remote!.shell.finished ? rouagesLinks(gameTerminal.remote!.shell.chapter.id) : [];
    forUnderstand.hidden = links.length === 0;
    rouagesList.replaceChildren(
      ...links.map((l) => el('li', {}, el('a', { href: l.address, hreflang: 'fr', target: '_blank', rel: 'noopener' }, typo(t(`rouages-link-${l.id}`))))),
    );
  };

  // The menu's shortcuts: a fresh screen, straight on the right machine.
  const go = (f: () => unknown) => {
    f();
    ctx.input.focus();
  };
  pathList.addEventListener('pointerover', (e) => {
    const b = (e.target as HTMLElement).closest<HTMLButtonElement>('button[data-h]');
    if (b && !b.disabled) ctx.prefetch(Number(b.dataset.h));
  });
  pathList.addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest<HTMLButtonElement>('button[data-h]');
    if (!b || b.disabled) return;
    go(() => ctx.launch(Number(b.dataset.h), Number(b.dataset.c)));
  });
  pathChoice.addEventListener('change', () => {
    ctx.display.path = pathChoice.value;
    ctx.applyDisplay();
  });
  workstationButton.addEventListener('click', () => go(ctx.goWorkstation));
  storiesBoutons.forEach((b, h) => {
    b.addEventListener('click', () => go(() => ctx.launch(h)));
    b.addEventListener('pointerenter', () => ctx.prefetch(h));
    b.addEventListener('focus', () => ctx.prefetch(h));
  });
  chaptersNavs.forEach((nav, h) =>
    nav.querySelectorAll<HTMLButtonElement>('[data-chapter]').forEach((b, c) => b.addEventListener('click', () => go(() => ctx.launch(h, c)))),
  );
  following.addEventListener('click', () => go(() => ctx.launch(story(), active() + 1)));
  VIEWS.forEach((v) =>
    viewBoutons[v].addEventListener('click', () => {
      ctx.display.view = v;
      ctx.applyDisplay();
    }),
  );

  /** The menu as the display settings want it (view, path). */
  const applyView = () => {
    if (!(VIEWS as readonly string[]).includes(ctx.display.view)) ctx.display.view = 'network';
    storiesNav.dataset.view = ctx.display.view;
    storiesList.hidden = ctx.display.view === 'paths';
    pathBlock.hidden = ctx.display.view !== 'paths';
    if (!PATH.some((p) => p.id === ctx.display.path)) ctx.display.path = PATH[0].id;
    pathChoice.value = ctx.display.path;
    navUpdate();
  };
  const pressViews = () => VIEWS.forEach((v) => viewBoutons[v].setAttribute('aria-pressed', String(v === ctx.display.view)));

  return { storiesNav, chaptersNavs, storiesBoutons, end, forUnderstand, navUpdate, applyView, pressViews };
}
