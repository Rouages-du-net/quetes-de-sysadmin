// The mission: the chapter's objective, its instructions, and what has
// already happened; help in three levels, one after the other (see
// hints.ts), never in exam mode; and the rescue snapshot (see
// Console.restore), like a virtual machine's.

import type { Shell } from '../engine/shell';
import { hint, HINT_LEVELS, type HintLevel } from '../engine/hints';
import type { Context } from './context';
import { el, refocusOnClose, uid } from './dom';

export function missionPart(ctx: Context, missionButton: HTMLButtonElement, carryOver: (old: Shell, fresh: Shell) => void) {
  const { t, typo, terminal: gameTerminal } = ctx;
  const idMission = uid('qds-mission');
  const titleMission = el('h2', { id: idMission });
  const goalMission = el('p', { class: 'map-legend' });
  // It scrolls (max-height): focusable, so the keyboard can scroll it too.
  // A region named by its heading: a screen reader says "Instructions" when the window opens on it.
  const instructionsHeading = el('h3', { id: `${idMission}-instructions` }, t('mission-instructions'));
  const instructionsMission = el('pre', { class: 'mission-text', tabindex: '0', role: 'region', 'aria-labelledby': instructionsHeading.id });
  const logMission = el('ol', { class: 'mission-log' });
  const emptyMission = el('p', { class: 'map-legend' }, typo(t('mission-nothing')));
  const closeMission = el('button', { type: 'button', class: 'button' }, t('map-close'));
  // Need help? Three levels, one after the other (see hints.ts); nothing in exam mode.
  const hintBoutons = Object.fromEntries(
    HINT_LEVELS.map((n) => [n, el('button', { type: 'button', class: 'hint-button', 'data-level': n }, t(`hint-button-${n}`))]),
  ) as Record<HintLevel, HTMLButtonElement>;
  // Not a live region: only the level just opened is announced (hintSaid,
  // inside the window: what is outside a modal window is not read), not the
  // ones above it again.
  const hintText = el('div', { class: 'hint-text' });
  const hintSaid = el('p', { class: 'visually-hidden', role: 'status' });
  const help = el(
    'section',
    { class: 'help' },
    el('h3', {}, t('hint-title')),
    el('p', { class: 'map-legend' }, typo(t('hint-intro'))),
    el('p', { class: 'hint-buttons' }, ...HINT_LEVELS.map((n) => hintBoutons[n])),
    hintText,
    hintSaid,
  );
  // The rescue snapshot (see Console.restore): like a virtual machine's.
  const takeSnapshot = el('button', { type: 'button', class: 'rescue-button' }, t('rescue-take'));
  const goBackSnapshot = el('button', { type: 'button', class: 'rescue-button' }, t('rescue-go-back'));
  const cancelInput = el('button', { type: 'button', class: 'rescue-button' }, t('rescue-cancel'));
  const rescueState = el('p', { class: 'map-legend rescue-state', role: 'status' });
  const rescue = el(
    'section',
    { class: 'rescue' },
    el('h3', {}, t('rescue-title')),
    el('p', { class: 'map-legend' }, typo(t('rescue-intro'))),
    el('p', { class: 'hint-buttons' }, takeSnapshot, goBackSnapshot, cancelInput),
    rescueState,
  );
  const missionWindow = el(
    'dialog',
    { class: 'mission-window', 'aria-labelledby': idMission },
    titleMission,
    goalMission,
    instructionsHeading,
    instructionsMission,
    el('h3', {}, t('mission-journal')),
    emptyMission,
    logMission,
    help,
    rescue,
    el('p', { class: 'map-actions' }, closeMission),
  ) as HTMLDialogElement;

  // The current chapter's mission.
  missionButton.addEventListener('click', () => ctx.withTexts('summaries', showMission));
  const showMission = () => {
    const sh = gameTerminal.remote?.shell;
    const c = sh?.chapter;
    titleMission.textContent = c ? t('mission-title', { chapter: t('chapter-number', { number: c.number }), title: t(`chapter-${c.id}`) }) : t('workstation-title');
    goalMission.textContent = c ? typo(t(`chapter-${c.id}.summary`)) : '';
    instructionsMission.textContent = (sh ?? gameTerminal.workstation).read(`${(sh ?? gameTerminal.workstation).home}/${(sh ?? gameTerminal.workstation).welcome}`) ?? '';
    const log = sh?.log ?? [];
    emptyMission.hidden = log.length > 0;
    logMission.replaceChildren(...log.map((m) => el('li', {}, el('pre', { class: 'mission-text' }, m))));
    helpUpdate();
    rescueUpdate();
    missionWindow.showModal();
  };
  closeMission.addEventListener('click', () => missionWindow.close());
  // The snapshot taken: its series (the chapter's opening) and the number of inputs replayed.
  let snapshot: { serial: number; not: number } | null = null;
  const rescueUpdate = () => {
    const sh = gameTerminal.remote?.shell;
    rescue.hidden = !sh;
    if (!sh) return;
    const not = gameTerminal.not;
    if (snapshot && snapshot.serial !== gameTerminal.serial) snapshot = null;
    const possible = not !== null && !gameTerminal.exam;
    takeSnapshot.disabled = !possible;
    goBackSnapshot.disabled = !possible || !snapshot || snapshot.not > not!;
    cancelInput.disabled = !possible || not === 0;
    const state = gameTerminal.exam
      ? t('rescue-exam')
      : not === null
        ? t('rescue-impossible')
        : snapshot
          ? t('rescue-taken', { steps: snapshot.not })
          : t('rescue-none');
    // A status: announced when it changes (a snapshot taken), not each time the window opens.
    if (rescueState.textContent !== state) rescueState.textContent = state;
  };
  takeSnapshot.addEventListener('click', () => {
    const not = gameTerminal.not;
    if (not === null) return;
    snapshot = { serial: gameTerminal.serial, not };
    rescueUpdate();
  });
  // Going back: the chapter's machine is replayed up to this point; the summary's time keeps running.
  const restore = (not: number) => {
    const old = gameTerminal.remote?.shell;
    ctx.followEnd();
    if (!old || !gameTerminal.restore(not)) return;
    carryOver(old, gameTerminal.remote!.shell);
    missionWindow.close();
    ctx.clearOutput();
    ctx.show(t('rescue-restored', { steps: not }), 'achievements');
    ctx.after();
    // Back in the middle of a tail -f: it continues.
    ctx.openFollow();
  };
  goBackSnapshot.addEventListener('click', () => snapshot && restore(snapshot.not));
  cancelInput.addEventListener('click', () => {
    const not = gameTerminal.not;
    if (not) restore(not - 1);
  });
  // Help for the current chapter: the levels already opened for this step stay visible.
  const helpUpdate = () => {
    const sh = gameTerminal.remote?.shell;
    help.hidden = !sh || gameTerminal.exam || sh.finished;
    if (help.hidden || !sh) return;
    const i = hint(sh);
    const openSet = HINT_LEVELS.filter((n) => sh.requestsHints.has(`${i.step ?? ''}:${n}`) || (n === 'manual' && sh.requestsHints.has(`:${n}`)));
    const blocks: HTMLElement[] = [];
    if (openSet.includes('manual')) blocks.push(el('p', { 'data-level': 'manual' }, t('hint-manual', { pages: i.manual.map((c) => `man ${c}`).join(', ') })));
    if (openSet.includes('lead') && i.lead) blocks.push(el('p', { 'data-level': 'lead' }, typo(i.lead)));
    if (openSet.includes('solution') && i.solution) blocks.push(el('pre', { class: 'mission-text', 'data-level': 'solution' }, i.solution));
    if (!i.step && openSet.length < 3) blocks.push(el('p', { class: 'map-legend' }, typo(t('hint-more-nothing'))));
    hintText.replaceChildren(...blocks);
    // One level at a time: the next opens once the previous one has been read.
    HINT_LEVELS.forEach((n, k) => {
      const b = hintBoutons[n];
      b.hidden = openSet.includes(n) || (k > 0 && !openSet.includes(HINT_LEVELS[k - 1])) || (n !== 'manual' && !i.step);
    });
  };
  help.addEventListener('click', (e) => {
    const n = (e.target as HTMLElement).closest('button')?.dataset.level as HintLevel | undefined;
    const sh = gameTerminal.remote?.shell;
    if (!n || !sh) return;
    sh.requestsHints.add(`${n === 'manual' ? '' : (hint(sh).step ?? '')}:${n}`);
    helpUpdate();
    ctx.autosave();
    hintText.lastElementChild?.scrollIntoView({ block: 'nearest' });
    // The button pressed is now hidden: the focus goes to the next level's
    // button, or to the window's Close button, never lost on the page; the
    // hint just opened is announced.
    const opened = hintText.querySelector(`[data-level="${n}"]`);
    hintSaid.textContent = opened?.textContent ?? '';
    (HINT_LEVELS.map((l) => hintBoutons[l]).find((b) => !b.hidden) ?? closeMission).focus();
  });
  refocusOnClose(missionWindow, () => ctx.input);

  return { missionWindow };
}
