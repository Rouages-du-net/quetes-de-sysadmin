# Accessibility

Sysadmin Quests aims at **WCAG 2.2 level AA**, on the site
(sysadmin.rouages.net) and in the embeddable `<quetes-de-sysadmin>`
element. This page says what is supported, how it is tested, and what is
known not to work yet.

## What is supported

- **Keyboard only.** Every control is reachable with Tab and shows a focus
  ring of at least 3:1. On the command line, **Tab completes** (as in
  bash); to leave the line, **Shift+Tab** goes back and **Escape then Tab**
  goes forward (as in code editors). Dialogs (Mission, Map, Notebook, My
  progress, Achievements, Where do I start?, Report a problem) keep the
  focus inside while open and close with **Escape**; the focus then goes
  back to the command line (for "Report a problem", to the button that
  opened it). A command that keeps running (`tail -f`,
  `watch`) is stopped with **Ctrl-C**, **Escape** or its button. Every
  site page starts with a "Skip to content" link.
- **Screen readers.** The terminal's output is a log (`role="log"`): each
  new output is read once, never the whole history. The command line is
  named with its prompt ("Command me@box:~$", or the question asked, or
  the password prompt) and describes its keys. **Alt+R** (or the "Read the
  last output again" button, shown when it has the focus) reads the last
  output again; a long one is read from its last 60 lines. While a command
  follows a file, the log goes quiet and a digest comes every ten seconds
  (how many lines arrived, and the last one; `watch`: that the screen
  changed). A chapter's end and the achievements are announced politely,
  without moving the focus. nano's field is described by its shortcuts and
  its status line is announced. Difficulty stars, the menu's LEDs and the
  map's colours all have their meaning in text too.
- **Language.** Every page has its `lang`; the game sets its own on its
  root, from the element's `lang` attribute or the page's. Command outputs
  are not marked as English, even in French: they mix the tool's English
  with the story's names and texts, and a voice switching language on
  every line would be harder to follow than a French voice reading
  `drwxr-xr-x`.
- **Contrast.** AA for text and controls in both themes, and for the
  terminal's four themes (phosphor, amber, high contrast, paper), the
  command line's highlighting and the output colours of `ls`, `grep`,
  `diff`, `systemctl` (`tests/terminal-contrast.test.ts`). Colour is never
  the only sign: an unknown command is also underlined with a wave, an
  existing path with a line.
- **Monospace text has no ligatures**: `->`, `!=` or `-->` stay the
  characters one types, in the terminal, nano, the notebook and the site's
  code blocks.
- **Reflow and spacing.** Usable at 320 px wide and at 200 % zoom with no
  horizontal page scroll, also with the text spacing of WCAG 1.4.12.
  Ordinary output wraps; tables (`ls -l`, `ps`, `ss`…) keep their columns
  and scroll sideways inside their own block, which then takes a tab stop
  so the keyboard can scroll it too.
- **Motion.** With `prefers-reduced-motion`, nothing moves: no animation
  nor transition, in the game or on the site.
- **Forced colours** (Windows High Contrast): buttons keep their borders,
  the focus a ring in the system's Highlight colour, pressed and current
  buttons a thicker border; the command line shows its own text instead of
  the coloured copy drawn under it.
- **Touch.** Targets are at least 24×24 CSS px (WCAG 2.5.8); phones get a
  bar for the keys they lack (Tab, arrows, Ctrl-C, `|`, `~`…).

## How it is tested

- `tests/a11y.mjs`, run by `npm run test:browser` after a build, in
  Chromium with Playwright: **axe-core** (a devDependency, injected by the
  test, never shipped) on the root's language choice, the home pages in
  English and French, the menu, "Where do I start?", "Report a problem", a
  chapter in play with a manual page and the error explainer open, the
  Mission, Map (places and Network tab), Notebook, My progress and
  Achievements dialogs, the four terminal themes, nano, the teachers'
  sheets, the class table and the 404 page; light and dark, at 1000 and
  375 px. A serious or critical violation fails the test.
- The same file checks what axe cannot: the skip link, a visible focus
  ring of 3:1 at every keyboard stop, the command line's name and keys,
  the first chapter played to its end with the keyboard alone, Alt+R, a
  `tail -f` digest, focus in and out of each dialog, nano, ligatures,
  reflow at 320 px with text spacing, forced colours, reduced motion.
- Unit tests: `tests/announce.test.ts` (what is read again, the follow's
  digest), `tests/terminal-contrast.test.ts`.

The first audit (November 2026) found two serious axe rules over 62
states: the text size buttons' names did not contain their visible "A−"
and "A+" (2.5.3), and wide outputs, the mission's text and the network
diagram scrolled without being reachable by the keyboard (2.1.1). Checks
by hand found a keyboard trap (Tab and Shift+Tab both completed on the
command line), `tail -f` read line by line, no focus indicator on the
command line, no skip link, ligatures in the terminal's font, and the
summary's narrow-screen labels reading a misspelt attribute.

## Known limitations

- Not yet tried with real screen readers beyond Chromium's accessibility
  tree: NVDA, JAWS, VoiceOver and TalkBack may differ, especially on how
  they read a log.
- Tables in the output are read as text, line by line, not as tables.
- The network diagram is a drawing; its text version (just under it) is
  the one to read.
- Drag and drop on the class table has a file field as its keyboard
  alternative.
- A host page that embeds the game sets its own colours (`--qds-*`): their
  contrast is the host's responsibility (see `docs/EMBEDDING.md`).

## Report a problem

Use **Report a problem or an idea** (under the menu, among a chapter's
actions, or in the site's footer): choose "Something else", say which
assistive technology and browser you use, and send the report yourself as a GitHub issue or by copying its text. Nothing is sent
without you.
