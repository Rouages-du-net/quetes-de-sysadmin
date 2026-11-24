// The terminal's display, settings of this browser only (not of the
// progress): theme, text size, colours, tips, the error explainer, the
// autosave, the tour to see again, and full screen (the terminal and its
// key bar take the whole window; Escape leaves it).

import { SIZES, THEMES, type Context } from './context';
import { el } from './dom';

export function settingsPart(ctx: Context, parts: {
  terminal: HTMLElement;
  touchesBar: HTMLElement;
  /** The menu as the settings want it (view, path), then its buttons. */
  applyView: () => void;
  pressViews: () => void;
  /** The autosave turned on (keep the current chapter from now on) or off (forget it). */
  autosaveTurned: (on: boolean) => void;
}) {
  const { t, display, terminal: gameTerminal } = ctx;
  const { terminal } = parts;
  const themeChoice = el(
    'select',
    { 'aria-label': t('display-theme') },
    ...THEMES.map((x) => el('option', { value: x }, t(`display-theme-${x}`))),
  ) as HTMLSelectElement;
  const moreSmall = el('button', { type: 'button', class: 'setting-button', 'aria-label': t('display-more-small') }, 'A−');
  const moreGrand = el('button', { type: 'button', class: 'setting-button', 'aria-label': t('display-more-big') }, 'A+');
  const focusButton = el('button', { type: 'button', class: 'setting-button', 'aria-pressed': 'false' }, t('display-focus'));
  const coloursButton = el('button', { type: 'button', class: 'setting-button', 'aria-pressed': 'true' }, t('display-colours'));
  // Tips (see tips.ts) on or off, and the intro tour, to see again.
  const tipsButton = el('button', { type: 'button', class: 'setting-button', 'aria-pressed': 'true' }, t('display-tips'));
  const tourButton = el('button', { type: 'button', class: 'setting-button' }, t('display-tour'));
  // The error explainer (see explainer.ts) on or off.
  const explainerButton = el('button', { type: 'button', class: 'setting-button', 'aria-pressed': 'true', title: t('display-explainer-title') }, t('display-explainer'));
  // The autosave inside a chapter (see autosave.ts), on or off.
  const autosaveButton = el('button', { type: 'button', class: 'setting-button', 'aria-pressed': 'true', title: t('display-autosave-title') }, t('display-autosave'));
  const settings = el('span', { class: 'settings' }, themeChoice, moreSmall, moreGrand, coloursButton, tipsButton, explainerButton, autosaveButton, tourButton, focusButton);
  const quitFocus = el('button', { type: 'button', class: 'leave-focus' }, t('display-quit-focus'));
  // The terminal and its key bar: together in full screen.
  // A heading for screen readers' heading navigation (H): the menus are landmarks, the terminal has this.
  const terminalHeading = el('h2', { class: 'visually-hidden' }, t('terminal-heading'));
  const screen = el('div', { class: 'screen' }, terminalHeading, quitFocus, terminal, parts.touchesBar);

  const applyDisplay = () => {
    if (!THEMES.includes(display.theme)) display.theme = 'phosphor';
    display.size = Math.max(0, Math.min(SIZES.length - 1, Math.round(display.size) || 0));
    terminal.dataset.theme = display.theme;
    terminal.style.setProperty('--qds-terminal-size', `${SIZES[display.size]}rem`);
    themeChoice.value = display.theme;
    parts.applyView();
    display.colours = display.colours !== false;
    gameTerminal.colours = display.colours;
    coloursButton.setAttribute('aria-pressed', String(display.colours));
    display.tips = display.tips !== false;
    tipsButton.setAttribute('aria-pressed', String(display.tips));
    display.explainer = display.explainer !== false;
    explainerButton.setAttribute('aria-pressed', String(display.explainer));
    display.autosave = display.autosave !== false;
    autosaveButton.setAttribute('aria-pressed', String(display.autosave));
    ctx.colourInput();
    parts.pressViews();
    moreSmall.disabled = display.size === 0;
    moreGrand.disabled = display.size === SIZES.length - 1;
    ctx.storeDisplay();
  };
  themeChoice.addEventListener('change', () => {
    display.theme = themeChoice.value;
    applyDisplay();
  });
  const toggle = (button: HTMLElement, setting: 'colours' | 'tips' | 'explainer') =>
    button.addEventListener('click', () => {
      display[setting] = !display[setting];
      applyDisplay();
    });
  toggle(coloursButton, 'colours');
  toggle(tipsButton, 'tips');
  toggle(explainerButton, 'explainer');
  tourButton.addEventListener('click', () => ctx.startTour());
  // Turned off: what was kept goes; turned on: the current chapter is kept from now on.
  autosaveButton.addEventListener('click', () => {
    display.autosave = !display.autosave;
    applyDisplay();
    parts.autosaveTurned(display.autosave);
  });
  moreSmall.addEventListener('click', () => {
    display.size--;
    applyDisplay();
  });
  moreGrand.addEventListener('click', () => {
    display.size++;
    applyDisplay();
  });
  // Full screen: the terminal (and its key bar) takes the whole window; Escape leaves it.
  const toggleFocus = (enabled: boolean) => {
    screen.classList.toggle('focus', enabled);
    focusButton.setAttribute('aria-pressed', String(enabled));
    ctx.input.focus();
  };
  focusButton.addEventListener('click', () => toggleFocus(!screen.classList.contains('focus')));
  quitFocus.addEventListener('click', () => toggleFocus(false));
  screen.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && screen.classList.contains('focus') && !ctx.searching()) toggleFocus(false);
  });

  return { settings, screen, applyDisplay };
}
