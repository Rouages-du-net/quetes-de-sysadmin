// Small DOM helpers shared by the interface's modules (no state, no texts).

import { decorations } from '../engine/announce';

export function el<K extends keyof HTMLElementTagNameMap>(name: K, attrs: Record<string, string> = {}, ...children: (Node | string)[]) {
  const e = document.createElement(name);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  e.append(...children);
  return e;
}

// What a screen reader should not spell out (box-drawing, status marks,
// rules, a pictograph opening a text: see announce.ts): kept on the screen,
// hidden from assistive technology. "🔒 Locked" is read "Locked".
export function quiet(text: string): (Node | string)[] {
  return decorations(text).map((p) => (p.decoration ? el('span', { 'aria-hidden': 'true' }, p.text) : p.text));
}

// A small inline line-icon (stroke follows the text colour, so it works in
// every theme and needs no third-party resource). Decorative: aria-hidden,
// the button keeps its text label for screen readers.
const SVG_NS = 'http://www.w3.org/2000/svg';
export function icon(...paths: string[]): SVGElement {
  const svg = document.createElementNS(SVG_NS, 'svg');
  for (const [k, v] of Object.entries({ viewBox: '0 0 24 24', class: 'icon', 'aria-hidden': 'true', focusable: 'false' })) svg.setAttribute(k, v);
  for (const d of paths) {
    const path = document.createElementNS(SVG_NS, 'path');
    path.setAttribute('d', d);
    svg.appendChild(path);
  }
  return svg;
}

/** An SVG element with its attributes and children. */
export function svg(name: string, attrs: Record<string, string>, ...children: (Node | string)[]) {
  const e = document.createElementNS(SVG_NS, name);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  e.append(...children);
  return e;
}

// Restart (a counter-clockwise arrow), progress (a floppy disk, for "save"),
// achievements (a trophy).
export const ICON_RESTART = ['M3 12a9 9 0 1 0 2.6-6.3L3 8', 'M3 3v5h5'];
export const ICON_PROGRESS = ['M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z', 'M17 21v-8H7v8', 'M7 3v5h8'];
export const ICON_MISSION = ['M4 22V4', 'M4 4h13l-2.5 4 2.5 4H4'];
export const ICON_MAP = ['M9 3 3 6v15l6-3 6 3 6-3V3l-6 3z', 'M9 3v15', 'M15 6v15'];
export const ICON_NOTEBOOK = ['M4 19.5A2.5 2.5 0 0 1 6.5 17H20V2H6.5A2.5 2.5 0 0 0 4 4.5z', 'M4 19.5A2.5 2.5 0 0 0 6.5 22H20v-5', 'M8 7h8', 'M8 11h6'];
// Feedback (a speech bubble).
export const ICON_FEEDBACK = ['M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z', 'M8 9h8', 'M8 13h5'];
export const ICON_TROPHY = ['M7 4h10v5a5 5 0 0 1-10 0z', 'M7 6H4v1a4 4 0 0 0 4 4', 'M17 6h3v1a4 4 0 0 0-4 4', 'M9 21h6', 'M12 17v4'];

/** An id for an element of this game, unique on the page (several games may share it). */
export const uid = (prefix: string) => `${prefix}-${Math.random().toString(36).slice(2, 8)}`;

/** mm:ss (or h:mm:ss): digits, like a stopwatch. */
export const minutes = (ms: number) => {
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const mmss = `${String(Math.floor((s % 3600) / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
  return h ? `${h}:${mmss}` : mmss;
};

/** Offers a file made here to the player (a download, nothing sent anywhere). */
export function downloadFile(content: BlobPart, type: string, name: string) {
  const link = el('a', { href: URL.createObjectURL(new Blob([content], { type })), download: name });
  link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 1000);
}

/** After a dialog closes (button or Escape), once the browser has given the focus back to its opener. */
export const refocusOnClose = (dialog: HTMLDialogElement, target: () => HTMLElement) =>
  dialog.addEventListener('close', () => setTimeout(() => target().focus()));
