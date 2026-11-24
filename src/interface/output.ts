// The terminal's output (a log, each new output read once by a screen
// reader, quiet during a follow) and what the game says to screen readers
// outside it (announce.ts): the last output read again, a follow's digests,
// a chapter's end.

import { lastOutput, type Block } from '../engine/announce';
import { chunks, withoutColours } from '../engine/colours';
import type { Translate } from '../texts';
import { el, quiet } from './dom';

// The lines kept on screen for a single output.
const LINES_MAX = 2000;

// Tables of at least three columns (ls -l, ufw status, ss, ps…) don't
// wrap: on a small screen, the block scrolls sideways. The rest,
// paragraphs and instructions ("type:   ls"), wraps. The rules
// that underline a table (------, ======) also stay in one piece.
// A tab also separates columns (dig).
const inColumns = (line: string) => (line.match(/\S(?: {2,}|\t)(?=\S)/g) ?? []).length >= 2 || /^[-=]{20,}$/.test(line);

export function outputPart(t: Translate) {
  const output = el('div', { class: 'output', role: 'log', 'aria-live': 'polite', 'aria-label': t('output-label') });
  // What the game says to screen readers outside the log (announce.ts): the
  // last output read again, a follow's digests, a chapter's end. Polite: it never takes the focus.
  const announcer = el('p', { class: 'visually-hidden', role: 'status', 'aria-live': 'polite' });
  let announceTimer = 0;
  let announcing: string[] = [];
  function announce(text: string) {
    // Emptied first: the same text twice is still read twice. Texts given
    // together (a chapter's end, then the question that follows) are read
    // one after the other, none replaces another.
    if (!announcing.includes(text)) announcing.push(text);
    announcer.textContent = '';
    clearTimeout(announceTimer);
    announceTimer = window.setTimeout(() => {
      announcer.textContent = announcing.join('\n');
      announcing = [];
    }, 60);
  }
  // Read the last output again (also Alt+R on the command line): shown when it has the focus.
  const rereadButton = el('button', { type: 'button', class: 'reread-button' }, t('reread-button'));

  // The terminal's width in characters ($COLUMNS): ls fits its columns in it,
  // so that a phone screen doesn't have to scroll sideways.
  const measure = el('span', { class: 'measure', 'aria-hidden': 'true' }, '0'.repeat(20));
  output.appendChild(measure);
  const clear = () => output.replaceChildren(measure);
  // A table wider than the terminal scrolls sideways (pre .columns): the
  // keyboard must reach it too, so a block that overflows takes a tab stop.
  const scrollables = () => {
    for (const pre of [...output.querySelectorAll('pre')].slice(-200)) {
      if (pre.scrollWidth > pre.clientWidth + 1) pre.setAttribute('tabindex', '0');
      else pre.removeAttribute('tabindex');
    }
  };
  /** The width in characters, or null while the output isn't laid out. */
  const columns = (): number | null => {
    scrollables();
    const character = measure.getBoundingClientRect().width / 20;
    const width = output.clientWidth - parseFloat(getComputedStyle(output).paddingLeft) - parseFloat(getComputedStyle(output).paddingRight);
    return character > 0 && width > 0 ? Math.max(20, Math.floor(width / character)) : null;
  };

  const show = (text: string, cls?: string) => {
    if (!text) return;
    const pre = document.createElement('pre');
    let lines = text.split('\n');
    // A huge output (ls of a place with 60,000 files): like a terminal's
    // scrollback, only the end is kept, so the page stays smooth.
    if (lines.length > LINES_MAX) {
      const coupees = lines.length - LINES_MAX;
      lines = lines.slice(-LINES_MAX);
      output.appendChild(el('p', { class: 'cut' }, t('output-cut', { lines: coupees })));
    }
    // A line underlined by ^~~~ (sudo, compilers): the line and its underline don't wrap.
    const underlined = (i: number) => /^\s*\^~*\s*$/.test(lines[i] ?? '');
    // The tools' colours (ANSI sequences, see colours.ts) become spans.
    // Box-drawing, status marks and rules stay on the screen, hidden from screen readers (announce.ts).
    const inColours = (line: string): (Node | string)[] =>
      line.includes('\x1b')
        ? chunks(line).flatMap((m) => {
            const classes = [m.bold ? 'a-bold' : '', m.before !== null ? `a-${m.before}` : '', m.background !== null ? `a-${m.background}` : ''].filter(Boolean);
            return classes.length ? [el('span', { class: classes.join(' ') }, ...quiet(m.text))] : quiet(m.text);
          })
        : quiet(line);
    lines.forEach((line, i) => {
      const end = i < lines.length - 1 ? '\n' : '';
      const visible = withoutColours(line);
      if (inColumns(visible) || /^\s*\^~*\s*$/.test(visible) || underlined(i + 1)) pre.append(el('span', { class: 'columns' }, ...inColours(line), end));
      else pre.append(...inColours(line), end);
    });
    if (cls) pre.className = cls;
    output.appendChild(pre);
  };
  // The command copied above its output, coloured as while typing.
  // The prompt is hidden from screen readers: they already heard it as the
  // line's name, and "you@kingdom:~/Pier/Lighthouse$" before every output
  // is noise. The command stays, so the log still says which command each
  // output belongs to (after a completion or a recalled line, it confirms
  // what ran); a question's answer is read alone, after the question.
  const echo = (promptText: string, ...line: (Node | string)[]) =>
    output.appendChild(el('pre', { class: 'cmd' }, el('span', { 'aria-hidden': 'true' }, line.length ? `${promptText} ` : promptText), ...line));

  // Read the last output again (announce.ts): the blocks since the last command line.
  const reread = () => {
    const blocks: Block[] = [...output.children]
      .filter((c) => !c.matches('.measure, .explainer'))
      .map((c) => ({ command: c.matches('pre.cmd'), text: (c as HTMLElement).innerText ?? c.textContent ?? '' }));
    const last = lastOutput(blocks);
    if (!last.text) return announce(t('reread-empty'));
    announce(last.cut ? `${t('reread-cut', { lines: last.lines, shown: last.lines - last.cut })}\n${last.text}` : last.text);
  };
  rereadButton.addEventListener('click', (e) => {
    e.stopPropagation();
    reread();
  });

  return { output, announcer, rereadButton, announce, show, echo, clear, scrollables, columns, reread };
}
