// The map: the known places of the machine the player is on (see map.ts),
// and, when the story has a network, its planned diagram (see plan.ts) as a
// drawing and as a list. Two tabs in one dialog.

import { map, type Place } from '../engine/map';
import { layOut, landmarks as planLandmarks, type ElementPlan } from '../engine/plan';
import type { Context } from './context';
import { el, quiet, refocusOnClose, svg, uid } from './dom';

const WIDTH = 176;
const HEIGHT = 54;
const X_DIFFERENCE = 36;
const Y_DIFFERENCE = 22;

export function mapPart(ctx: Context, mapButton: HTMLButtonElement) {
  const { t, typo, terminal: gameTerminal } = ctx;
  const mapId = uid('qds-map');
  const titleMap = el('h2', { id: mapId });
  const treeMap = el('div', { class: 'map-tree' });
  const closeMap = el('button', { type: 'button', class: 'button' }, t('map-close'));
  // Two tabs when the story has a network: the machine's places, and the network plan (see plan.ts).
  const tab = (suffix: string, text: string) =>
    el('button', { type: 'button', role: 'tab', id: `${mapId}-tab-${suffix}`, 'aria-controls': `${mapId}-${suffix}` }, text);
  const placesTab = tab('places', t('map-tab-places'));
  const networkTab = tab('network', t('map-tab-network'));
  const tabs = el('div', { role: 'tablist', class: 'map-tabs' }, placesTab, networkTab);
  const placesPanel = el(
    'div',
    { role: 'tabpanel', id: `${mapId}-places`, 'aria-labelledby': placesTab.id },
    el('p', { class: 'map-legend' }, typo(t('map-caption'))),
    treeMap,
  );
  // The drawing scrolls sideways on a narrow screen: focusable, named (its text version follows).
  const planSchema = el('div', { class: 'plan-diagram', tabindex: '0', role: 'region', 'aria-label': t('plan-diagram-label') });
  const listPlan = el('div', { class: 'map-tree' });
  const textPlan = el('details', { class: 'plan-text' }, el('summary', {}, t('plan-version-text')), listPlan);
  const networkPanel = el(
    'div',
    { role: 'tabpanel', id: `${mapId}-network`, 'aria-labelledby': networkTab.id },
    el('p', { class: 'map-legend' }, typo(t('plan-caption'))),
    planSchema,
    textPlan,
  );
  const mapWindow = el(
    'dialog',
    { class: 'map-window', 'aria-labelledby': mapId },
    titleMap,
    tabs,
    placesPanel,
    networkPanel,
    el('p', { class: 'map-actions' }, closeMap),
  ) as HTMLDialogElement;

  // A place on the map: its name, its markers in plain words (also read
  // by screen readers), then the places it contains.
  const drawPlace = (l: Place): HTMLElement => {
    const landmarks = [l.home && t('map-home'), l.closed && t('map-closed'), !l.visit && t('map-preview')].filter(Boolean).join(', ');
    return el(
      'li',
      { class: [l.visit ? 'visited' : 'preview', l.here ? 'here' : ''].join(' ').trim(), ...(l.here ? { 'aria-current': 'location' } : {}) },
      el('span', { class: 'name' }, l.name === '/' ? '/' : `${l.name}/`),
      ...(landmarks ? [' ', el('span', { class: 'markers' }, `(${landmarks})`)] : []),
      ...(l.here ? [' ', el('strong', { class: 'you-are-here' }, ...quiet(t('map-here')))] : []),
      ...(l.children.length ? [el('ul', {}, ...l.children.map(drawPlace))] : []),
    );
  };
  // The network plan: a diagram (a sideways tree, one column per level) and the same thing as a list.
  const classesPlan = (e: ElementPlan, here: string, visited: Set<string>) => {
    const r = planLandmarks(e, here, visited);
    return [e.role, r.here ? 'here' : '', e.host && !r.visit ? 'not-visited' : ''].filter(Boolean).join(' ');
  };
  const drawPlan = (root: ElementPlan, here: string, visited: Set<string>) => {
    const { places, columns, lines } = layOut(root);
    const x = (c: number) => 2 + c * (WIDTH + X_DIFFERENCE);
    const y = (l: number) => Y_DIFFERENCE + l * (HEIGHT + Y_DIFFERENCE);
    const width = x(columns) - X_DIFFERENCE + 2;
    const height = y(lines);
    const links = places
      .filter((p) => p.parent)
      .map((p) => {
        const forEachOf = p.parent!;
        const middle = x(forEachOf.column) + WIDTH + X_DIFFERENCE / 2;
        return svg('path', {
          class: p.element.tunnel ? 'link tunnel' : 'link',
          d: `M${x(forEachOf.column) + WIDTH} ${y(forEachOf.line) + HEIGHT / 2} H${middle} V${y(p.line) + HEIGHT / 2} H${x(p.column)}`,
        });
      });
    const boites = places.map((p) => {
      const e = p.element;
      const bx = x(p.column);
      const by = y(p.line);
      return svg(
        'g',
        { class: `box ${classesPlan(e, here, visited)}` },
        svg('rect', { x: String(bx), y: String(by), width: String(WIDTH), height: String(HEIGHT), rx: e.role === 'internet' ? '27' : '6' }),
        // A name alone (Internet) is centred in its box.
        svg('text', { x: String(bx + 10), y: String(by + (e.address || e.note ? 19 : HEIGHT / 2 + 5)), class: 'name' }, e.name),
        ...(e.address ? [svg('text', { x: String(bx + 10), y: String(by + 34), class: 'address' }, e.address)] : []),
        ...(e.note ? [svg('text', { x: String(bx + 10), y: String(by + 48), class: 'note' }, e.note)] : []),
        ...(planLandmarks(e, here, visited).here ? [svg('text', { x: String(bx), y: String(by - 6), class: 'marker-here' }, `▼ ${t('plan-here')}`)] : []),
      );
    });
    return svg('svg', { viewBox: `0 0 ${width} ${height}`, width: String(width), height: String(height), 'aria-hidden': 'true', focusable: 'false' }, ...links, ...boites);
  };
  const drawElement = (e: ElementPlan, here: string, visited: Set<string>): HTMLElement => {
    const r = planLandmarks(e, here, visited);
    const notes = [e.note, e.tunnel && t('plan-tunnel'), e.host && (r.visit ? t('plan-visit') : t('plan-not-visit'))].filter(Boolean).join(', ');
    return el(
      'li',
      { class: classesPlan(e, here, visited), ...(r.here ? { 'aria-current': 'location' } : {}) },
      el('span', { class: 'name' }, e.name),
      ...(e.address ? [' ', el('code', {}, e.address)] : []),
      ...(notes ? [' ', el('span', { class: 'markers' }, `(${notes})`)] : []),
      ...(r.here ? [' ', el('strong', { class: 'you-are-here' }, `← ${t('plan-here')}`)] : []),
      ...(e.children?.length ? [el('ul', {}, ...e.children.map((x) => drawElement(x, here, visited)))] : []),
    );
  };
  const chooseTab = (network: boolean) => {
    placesTab.setAttribute('aria-selected', String(!network));
    networkTab.setAttribute('aria-selected', String(network));
    placesTab.tabIndex = network ? -1 : 0;
    networkTab.tabIndex = network ? 0 : -1;
    placesPanel.hidden = network;
    networkPanel.hidden = !network;
  };
  placesTab.addEventListener('click', () => chooseTab(false));
  networkTab.addEventListener('click', () => chooseTab(true));
  // The arrow keys move from one tab to another (as in any tab list).
  tabs.addEventListener('keydown', (e) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    const network = placesTab.getAttribute('aria-selected') === 'true';
    chooseTab(network);
    (network ? networkTab : placesTab).focus();
    e.preventDefault();
  });
  mapButton.addEventListener('click', () => {
    const sh = gameTerminal.shell;
    titleMap.textContent = t('map-title', { machine: sh.host });
    treeMap.replaceChildren(el('ul', { class: 'tree' }, drawPlace(map(sh))));
    const plan = gameTerminal.remote?.shell.chapter.plan?.(t);
    tabs.hidden = !plan;
    if (plan) {
      planSchema.replaceChildren(drawPlan(plan, sh.host, gameTerminal.visited));
      listPlan.replaceChildren(el('ul', { class: 'tree' }, drawElement(plan, sh.host, gameTerminal.visited)));
      // On a small screen, the diagram scrolls in its box: the list opens by default.
      textPlan.open = matchMedia('(max-width: 40rem)').matches;
    }
    chooseTab(false);
    mapWindow.showModal();
    mapWindow.querySelector('.here')?.scrollIntoView({ block: 'center' });
  });
  // Once the dialog is closed (button or Escape), the command line gets focus back:
  // after the browser has returned focus to the button that opened it.
  closeMap.addEventListener('click', () => mapWindow.close());
  refocusOnClose(mapWindow, () => ctx.input);

  return { mapWindow };
}
