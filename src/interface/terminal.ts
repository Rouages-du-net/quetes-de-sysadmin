// The simulated terminal: the command line (prompt, highlighting, history,
// Ctrl-R, Tab, Ctrl-C, Ctrl-D), the keys phones lack, copy and paste, a
// follow (tail -f, watch) and nano. The line itself runs in run-line.ts.

import { FollowDigest } from '../engine/announce';
import { colourise, type Token } from '../engine/highlighting';
import { withoutColours } from '../engine/colours';
import { NeedsLoading } from '../engine/loading';
import { editor } from './editor';
import type { Context } from './context';
import type { outputPart } from './output';
import { el } from './dom';

// During a follow (tail -f), the seconds that pass on the machine for each real second.
const SECONDS_FOLLOW = 3;

// The keys that phone keyboards lack (shown on touch screens).
const TOUCHES: [string, string][] = [
  ['Tab', 'Tab'],
  ['↑', 'ArrowUp'],
  ['↓', 'ArrowDown'],
  ['Ctrl-C', 'ctrl-c'],
  ['|', '|'],
  ['~', '~'],
  ['/', '/'],
  ['-', '-'],
  ['_', '_'],
  ['.', '.'],
  ['*', '*'],
  ['>', '>'],
];

export function terminalPart(ctx: Context, out: ReturnType<typeof outputPart>, submitLine: (line: string) => void) {
  const { t, terminal: gameTerminal, root } = ctx;
  const { output, show, echo, announce } = out;
  const id = `qds-input-${Math.random().toString(36).slice(2, 8)}`;
  // The prompt, the line's name and its keys are read with the field (its
  // name and description), not a second time as text around it.
  const prompt = el('label', { class: 'prompt', for: id, id: `${id}-prompt`, 'aria-hidden': 'true' });
  // The line's name: "Command" and the prompt ("me@box:~$", or a question, a password…).
  const inputName = el('span', { class: 'visually-hidden', id: `${id}-name`, 'aria-hidden': 'true' }, t('input-label'));
  const input = el('input', {
    id, type: 'text', spellcheck: 'false', autocapitalize: 'off', autocorrect: 'off', autocomplete: 'off',
    'aria-labelledby': `${inputName.id} ${prompt.id}`,
    'aria-describedby': `${id}-help`,
  }) as HTMLInputElement;
  const inputHelp = el('span', { class: 'visually-hidden', id: `${id}-help`, 'aria-hidden': 'true' }, t('input-help'));
  // Ctrl-R: history search, like bash; the command found is shown below the line.
  const match = el('p', { class: 'search', 'aria-live': 'polite' });
  // Highlighting of the line (see highlighting.ts): a coloured copy of the
  // text, drawn exactly under the field, which stays an ordinary field
  // (keyboard, completion, screen readers) with its text made transparent.
  const coloration = el('div', { class: 'highlighting', 'aria-hidden': 'true' });
  const field = el('span', { class: 'field' }, coloration, input);
  const form = el('form', { autocomplete: 'off' }, prompt, inputName, field, inputHelp, match);
  // tail -f, journalctl -f: the command keeps control until Ctrl-C (this button, the keyboard or the key bar).
  const followStop = el('button', { type: 'button', class: 'stop-follow', hidden: '' }, el('kbd', {}, '^C'), ` ${t('follow-stop')}`);
  // Ctrl-Z: the command stops and becomes a job (jobs, fg, bg).
  const followSuspend = el('button', { type: 'button', class: 'suspend-follow', hidden: '' }, el('kbd', {}, '^Z'), ` ${t('follow-suspend')}`);
  const terminal = el('div', { class: 'terminal' }, out.rereadButton, output, form, followStop, followSuspend);
  const touchesBar = el(
    'div',
    { class: 'keys', role: 'toolbar', 'aria-label': t('keys-title') },
    ...TOUCHES.map(([text, pressedKey]) =>
      el('button', { type: 'button', 'data-key': pressedKey, ...(pressedKey.startsWith('Arrow') ? { 'aria-label': t(`key-${pressedKey === 'ArrowUp' ? 'up' : 'down'}`) } : {}) }, text),
    ),
    // During nano: its shortcuts, which a phone cannot type (no Ctrl key).
    el('button', { type: 'button', class: 'for-nano', 'data-key': 'ctrl-o' }, `^O ${t('nano-write')}`),
    el('button', { type: 'button', class: 'for-nano', 'data-key': 'ctrl-x' }, `^X ${t('nano-quit')}`),
  );

  // The up/down arrows and Ctrl-R browse the CURRENT machine's history
  // (Shell.history — the same list the `history` command and `!!` read), not
  // every line typed in the game: each machine keeps its own, as in a real
  // shell session. The engine records it on execute (passwords and answers
  // never reach it); `position` indexes that list and `after()` resets it.
  const machineHistory = () => gameTerminal.shell.history;
  // The line after the last Tab (for bash's double Tab).
  let previousTab: string | null = null;
  let position = 0;
  // Tab was pressed while typing the current line.
  let tabUsed = false;

  // Ctrl-R: null outside a search; otherwise what the line held before, and the command found.
  let query: { before: string; match: string } | null = null;
  // A question (ssh's "continue connecting?", a password, adduser's
  // questions) or the secondary prompt (>) changes the line's name, but the
  // focus stays on it, so most screen readers say nothing: it is announced.
  let asked = '';
  const promptUpdate = () => {
    const sh = gameTerminal.shell;
    const text = gameTerminal.prompt();
    prompt.textContent = text;
    input.type = sh.maskedInput() ? 'password' : 'text';
    colourInput();
    const asking = sh.maskedInput() || sh.question !== null ? text : sh.continuation !== null ? t('continuation-announce') : '';
    if (asking && asking !== asked) announce(asking);
    asked = asking;
  };

  // The coloured tokens of a line; nothing for an answer to a question
  // (yes/no, password, sftp>) nor when highlighting is turned off.
  const tokens = (line: string): Token[] | null => {
    const sh = gameTerminal.shell;
    if (!ctx.display.colours || sh.maskedInput() || sh.question || sh.waiting) return null;
    // A here-document's body is text, not commands.
    if (sh.continuation !== null && /<<-?\s*['"]?\w/.test(sh.continuation)) return null;
    return colourise(sh, line);
  };
  const inSpans = (js: Token[]) => js.map((j) => (j.kind === 'text' ? j.text : el('span', { class: `c-${j.kind}` }, j.text)));
  const colourInput = () => {
    const js = query ? null : tokens(input.value);
    field.classList.toggle('coloured', js !== null);
    coloration.replaceChildren(...(js ? inSpans(js) : []));
    coloration.scrollLeft = input.scrollLeft;
  };
  const showCommand = (line: string, js: Token[] | null) => echo(prompt.textContent ?? '', ...(js ? inSpans(js) : [line]));

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    submitLine(input.value);
  });
  terminal.addEventListener('keydown', (e) => {
    if (!e.altKey || e.ctrlKey || e.metaKey || e.code !== 'KeyR' || (e.target as HTMLElement).matches('textarea')) return;
    e.preventDefault();
    out.reread();
  });

  // A follow (tail -f, journalctl -f): the screen makes time pass on the
  // machine (SECONDS_FOLLOW per real second) and shows what arrives. The
  // log goes quiet meanwhile: a digest every few seconds (announce.ts).
  let followTimer: number | null = null;
  let digest: FollowDigest | null = null;
  let followSeconds = 0;
  const followEnd = () => {
    if (followTimer !== null) clearInterval(followTimer);
    followTimer = null;
    digest = null;
    output.setAttribute('aria-live', 'polite');
    followStop.hidden = true;
    followSuspend.hidden = true;
    form.hidden = false;
    if (touchesBar.dataset.mode === 'follow') delete touchesBar.dataset.mode;
  };
  const stopFollow = () => {
    if (followTimer === null) return;
    followEnd();
    show(gameTerminal.interrupt());
    ctx.after();
    input.focus();
  };
  const openFollow = () => {
    if (!gameTerminal.follows) return;
    form.hidden = true;
    touchesBar.dataset.mode = 'follow';
    followStop.hidden = false;
    followSuspend.hidden = false;
    followStop.focus();
    // watch redraws its screen: the last one is replaced rather than followed by the next.
    const screen = gameTerminal.followsScreen;
    if (screen) output.lastElementChild?.classList.add('watch');
    output.setAttribute('aria-live', 'off');
    followSeconds = 0;
    digest = new FollowDigest(0, { screen, initial: screen ? (output.lastElementChild?.textContent ?? '') : '' });
    announce(t(screen ? 'follow-announce-watch' : 'follow-announce-start'));
    followTimer = window.setInterval(() => {
      const fresh = gameTerminal.follow(SECONDS_FOLLOW);
      followSeconds++;
      if (fresh) {
        if (screen) output.querySelectorAll('pre.watch').forEach((p) => p.remove());
        show(fresh, screen ? 'watch' : 'follow');
        digest?.add(withoutColours(fresh));
        ctx.after();
      }
      const due = digest?.tick(followSeconds);
      if (due) announce(due.kind === 'screen' ? t('follow-announce-screen') : t('follow-announce-lines', { count: due.count, line: due.last }));
    }, 1000);
  };
  const suspendFollow = () => {
    if (followTimer === null) return;
    followEnd();
    show(gameTerminal.suspend());
    ctx.after();
    input.focus();
  };
  followSuspend.addEventListener('click', suspendFollow);
  followStop.addEventListener('click', stopFollow);
  for (const button of [followStop, followSuspend])
    button.addEventListener('keydown', (e) => {
      if ((e.ctrlKey && e.key.toLowerCase() === 'c') || e.key === 'Escape') {
        e.preventDefault();
        stopFollow();
      } else if (e.ctrlKey && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        suspendFollow();
      }
    });

  // nano: the editor takes the place of the command line until ^X.
  const openEditor = () => {
    const edition = gameTerminal.edition;
    if (!edition) return;
    form.hidden = true;
    touchesBar.dataset.mode = 'nano';
    terminal.append(
      editor({
        t,
        path: edition.path,
        text: edition.text,
        message: edition.message,
        save: (text) => {
          const saved = gameTerminal.save(text);
          ctx.autosave();
          return saved;
        },
        close: () => {
          show(gameTerminal.quitEdition());
          form.hidden = false;
          delete touchesBar.dataset.mode;
          ctx.after();
          input.focus();
        },
      }),
    );
    terminal.scrollTop = terminal.scrollHeight;
  };

  const search = (moreOld = false) => {
    if (!query) return;
    const h = machineHistory();
    const since = moreOld ? h.lastIndexOf(query.match) - 1 : h.length - 1;
    let found = '';
    for (let i = since; i >= 0; i--)
      if (h[i].includes(input.value)) {
        found = h[i];
        break;
      }
    if (found || !moreOld) query.match = found;
    match.textContent = t('search-history', { pattern: input.value, command: query.match });
  };
  const finishSearch = (keep: boolean) => {
    if (!query) return;
    input.value = keep ? query.match || input.value : query.before;
    query = null;
    match.textContent = '';
  };
  input.addEventListener('input', () => {
    search();
    colourInput();
  });
  // After a key (Tab, ↑, Ctrl-R…), the line may have changed; the field may have scrolled.
  input.addEventListener('keydown', () => setTimeout(colourInput));
  for (const event of ['scroll', 'select', 'keyup', 'click']) input.addEventListener(event, () => (coloration.scrollLeft = input.scrollLeft));
  // Leaving the line with the keyboard (Tab completes): Shift+Tab goes back,
  // Escape then Tab goes forward, as in code editors (no keyboard trap, WCAG 2.1.2).
  let tabLeaves = false;
  input.addEventListener('keydown', (e) => {
    const leaving = tabLeaves;
    tabLeaves = e.key === 'Escape' && !query;
    if (e.key === 'Tab' && (leaving || e.shiftKey)) return;
    if (gameTerminal.shell.waiting || gameTerminal.shell.question) return;
    if (e.ctrlKey && e.key.toLowerCase() === 'r') {
      e.preventDefault();
      if (query) search(true);
      else {
        query = { before: input.value, match: '' };
        input.value = '';
        search();
      }
      return;
    }
    if (query) {
      if (e.key === 'Escape' || (e.ctrlKey && e.key.toLowerCase() === 'g')) {
        e.preventDefault();
        finishSearch(false);
        return;
      }
      if (e.key === 'Enter' || e.key.startsWith('Arrow') || e.key === 'Tab') finishSearch(true);
      if (e.key === 'Enter') return;
    }
    // Ctrl-C with nothing selected: the line is abandoned, as in bash.
    if (e.ctrlKey && e.key.toLowerCase() === 'c' && input.selectionStart === input.selectionEnd) {
      e.preventDefault();
      echo(prompt.textContent ?? '', `${input.value}^C`);
      input.value = '';
      position = machineHistory().length;
      // At the secondary prompt (>), the whole input is dropped.
      gameTerminal.interrupt();
      promptUpdate();
      return;
    }
    // Ctrl-D on an empty line: the end of the input (bash leaves the shell, or ends an input left open at >).
    if (e.ctrlKey && e.key.toLowerCase() === 'd' && !input.value) {
      e.preventDefault();
      submitLine('\u0004');
      return;
    }
    if (e.key === 'Tab') {
      e.preventDefault();
      tabUsed = true;
      const before = input.value;
      try {
        input.value = gameTerminal.complete(before);
      } catch (e) {
        if (!(e instanceof NeedsLoading)) throw e;
        e.load().catch(() => {});
        return;
      }
      // Like bash: a second Tab with nothing more to complete shows the possibilities.
      if (input.value === before && previousTab === before) {
        const listing = gameTerminal.suggestions(before);
        if (listing) {
          echo(prompt.textContent ?? '', before);
          show(listing, 'suggestions');
          terminal.scrollTop = terminal.scrollHeight;
        }
      }
      previousTab = input.value;
      return;
    }
    previousTab = null;
    if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      const h = machineHistory();
      // A switch of machine may have left `position` past the new list.
      if (position > h.length) position = h.length;
      if (e.key === 'ArrowUp' && position > 0) {
        e.preventDefault();
        input.value = h[--position];
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        position = Math.min(position + 1, h.length);
        input.value = h[position] ?? '';
      }
    }
  });

  // Copy and paste as in most Linux terminals: the selected text is
  // copied, the right click (or the middle one) pastes it.
  // Shift + right click keeps the browser's menu. With a finger (or a stylus),
  // a long press selects the text and opens the phone's menu: the game
  // leaves it alone (a long press also sends contextmenu).
  let pointer = 'mouse';
  terminal.addEventListener('pointerdown', (e) => (pointer = e.pointerType), { passive: true });
  const mouse = (e: MouseEvent) => ((e as PointerEvent).pointerType || pointer) === 'mouse';
  const selection = () => ((root as ShadowRoot & { getSelection?: () => Selection | null }).getSelection?.() ?? window.getSelection())?.toString() ?? '';
  let copyOf = '';
  terminal.addEventListener('mouseup', (e) => {
    if (!mouse(e)) return;
    const text = selection();
    if (!text) return;
    copyOf = text;
    navigator.clipboard?.writeText(text).catch(() => {});
  });
  const paste = async (e: MouseEvent) => {
    e.preventDefault();
    let text = copyOf;
    if (!text) text = (await navigator.clipboard?.readText().catch(() => '')) ?? '';
    if (!text) return;
    const nano = terminal.querySelector('textarea');
    // In nano, the text keeps its lines; on the command line, it fits on one line.
    const target = nano ?? input;
    if (!nano) text = text.replace(/\s*\n\s*/g, ' ').trim();
    const start = target.selectionStart ?? target.value.length;
    const end = target.selectionEnd ?? start;
    target.setRangeText(text, start, end, 'end');
    target.focus();
    colourInput();
  };
  terminal.addEventListener('contextmenu', (e) => {
    if (!e.shiftKey && mouse(e)) paste(e);
  });
  terminal.addEventListener('auxclick', (e) => {
    if (e.button === 1) paste(e);
  });
  terminal.addEventListener('click', () => {
    if (!form.hidden && !selection()) input.focus();
  });

  // The key bar: each button acts on the line without taking its
  // focus (the phone's keyboard stays open).
  touchesBar.addEventListener('pointerdown', (e) => {
    if ((e.target as HTMLElement).closest('button')) e.preventDefault();
  });
  touchesBar.addEventListener('click', (e) => {
    const pressedKey = (e.target as HTMLElement).closest('button')?.dataset.key;
    if (!pressedKey) return;
    // During a follow (tail -f), Ctrl-C stops it.
    if (followTimer !== null) {
      if (pressedKey === 'ctrl-c') stopFollow();
      return;
    }
    // In nano, ^O, ^X and ^C go to the editor, as if typed on the keyboard.
    const zone = terminal.querySelector<HTMLTextAreaElement>('.nano-text');
    if (form.hidden) {
      if (zone && pressedKey.startsWith('ctrl-')) zone.dispatchEvent(new KeyboardEvent('keydown', { key: pressedKey.slice(5), ctrlKey: true, bubbles: true, cancelable: true }));
      return;
    }
    if (pressedKey.length === 1) {
      // Like a keystroke: the phone's keyboard (and its ongoing input) sees it go by,
      // and the coloured line is redrawn at once (input event).
      input.focus();
      if (!document.execCommand?.('insertText', false, pressedKey)) {
        input.setRangeText(pressedKey, input.selectionStart ?? input.value.length, input.selectionEnd ?? input.value.length, 'end');
        input.dispatchEvent(new Event('input', { bubbles: true }));
      }
    }
    else {
      const [ctrl, key] = pressedKey === 'ctrl-c' ? [true, 'c'] : [false, pressedKey];
      input.dispatchEvent(new KeyboardEvent('keydown', { key, ctrlKey: ctrl, bubbles: true, cancelable: true }));
    }
    input.focus();
  });

  // The staging (unless the system asks for less motion): a connection
  // being established, a screen going dark on reboot.
  const putInScene = (what: 'connection' | 'reboot') => {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    terminal.classList.remove('scene-connection', 'scene-reboot');
    void terminal.offsetWidth;
    terminal.classList.add(`scene-${what}`);
  };
  terminal.addEventListener('animationend', () => terminal.classList.remove('scene-connection', 'scene-reboot'));

  return {
    input,
    field,
    prompt,
    terminal,
    touchesBar,
    promptUpdate,
    tokens,
    colourInput,
    showCommand,
    followEnd,
    openFollow,
    openEditor,
    putInScene,
    /** A history search (Ctrl-R) is going on. */
    searching: () => query !== null,
    /** Back to the bottom of the current machine's history. */
    historyEnd: () => (position = machineHistory().length),
    /** Tab was pressed while typing the line just run; forgotten for the next one. */
    takeTab: () => {
      const used = tabUsed;
      tabUsed = false;
      return used;
    },
  };
}
