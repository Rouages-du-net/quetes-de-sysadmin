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
  new output is read once, never the whole history. A command's echo is
  read as the command alone: the prompt before it is hidden from screen
  readers, the line's name says it. The command line is
  named with its prompt ("Command me@box:~$", or the question asked, or
  the password prompt) and describes its keys; a question (ssh's "continue
  connecting?", a password, the secondary prompt `>`) is also announced,
  since the focus does not move. Box-drawing (`├─`, `└─`), status marks
  (`●`, `✔`), rules (`------`) and pictographs (the achievement's trophy,
  the menu's padlock) stay on the screen but are hidden from screen
  readers, in the output, in Alt+R and in the menus. The terminal has a
  heading ("Terminal") for heading navigation; the menus are navigation
  landmarks, the current story and chapter `aria-current`. **Alt+R** (or the "Read the
  last output again" button, shown when it has the focus) reads the last
  output again; a long one is read from its last 60 lines. While a command
  follows a file, the log goes quiet and a digest comes every ten seconds
  (how many lines arrived, and the last one; `watch`: that the screen
  changed). A chapter's end and the achievements are announced politely,
  without moving the focus. A hint is announced when its level opens, and
  the focus moves to the next level's button. nano's field is described by
  its shortcuts and its status line is announced; its "Save modified
  buffer?" is read with the focus, on the buttons' group. Difficulty stars, the menu's LEDs and the
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
- What a screen reader is given to say: `tests/a11y.mjs` records every
  text added to a live region (`recordSpoken`) while the first chapter is
  played, and checks the order (echo, output, then the question or the
  chapter's end), that nothing is announced twice, that no prompt, no
  box-drawing, rule nor trophy is announced, Alt+R, the hints, nano's
  question. The whole sequence, with the focus at each step, is written
  out in [screen-reader-walkthrough.md](screen-reader-walkthrough.md).
- Unit tests: `tests/announce.test.ts` (what is read again, the follow's
  digest, the decorations left out), `tests/terminal-contrast.test.ts`.

The first audit (November 2026) found two serious axe rules over 62
states: the text size buttons' names did not contain their visible "A−"
and "A+" (2.5.3), and wide outputs, the mission's text and the network
diagram scrolled without being reachable by the keyboard (2.1.1). Checks
by hand found a keyboard trap (Tab and Shift+Tab both completed on the
command line), `tail -f` read line by line, no focus indicator on the
command line, no skip link, ligatures in the terminal's font, and the
summary's narrow-screen labels reading a misspelt attribute.

A second pass the same month recorded what a screen reader is given while
a chapter is played (see the walkthrough): the prompt read before every
output, questions (ssh, sudo, `>`) never announced, box-drawing and
pictographs spelt out, the focus lost after a hint, nano's yes key shown
as French `O` in English, and the command line's labels read twice in
browse mode. All are fixed and checked by `tests/a11y.mjs`.

## Known limitations

- **Not yet tried with a real screen reader.** The project's test machines
  are Linux containers: NVDA, JAWS, VoiceOver and TalkBack cannot run
  there, and Orca needs a desktop session it does not have. What is
  checked is what Chromium gives a screen reader (its accessibility tree,
  the live regions' texts and their order), not what a screen reader says.
  NVDA, JAWS, VoiceOver and TalkBack may differ, especially on how they
  read a log and a polite status in quick succession: the checklist below
  is for the people who can try.
- Tables in the output are read as text, line by line, not as tables.
- The network diagram is a drawing; its text version (just under it) is
  the one to read.
- Drag and drop on the class table has a file field as its keyboard
  alternative.
- A host page that embeds the game sets its own colours (`--qds-*`): their
  contrast is the host's responsibility (see `docs/EMBEDDING.md`).

## Testing with a real screen reader

A checklist for a human, about twenty minutes per pair. Compare what you
hear with [screen-reader-walkthrough.md](screen-reader-walkthrough.md),
which lists, step by step, what the game gives the screen reader.

Pairs, in this order of priority: **NVDA + Firefox** (Windows), **VoiceOver
+ Safari** (macOS, then iOS), **TalkBack + Chrome** (Android), JAWS +
Chrome if you have it. Use a private window (no progress), the English or
the French game.

1. **Reach the terminal.** From the top of the page: the skip link, then
   the "Stories" navigation (landmarks: NVDA D, VoiceOver rotor), then the
   heading "Terminal" (H). Expected: the command line is announced as an
   edit field named "Command you@desk:~$", with its keys as description.
2. **Type `ssh kingdom`, Enter.** Expected, in this order: "ssh kingdom"
   (not "you at desk…"), the host key's lines, "Achievement: First step"
   (no "trophy"), then "Are you sure you want to continue connecting
   (yes/no/[fingerprint])?". Note it if the question is read twice, or
   not at all.
3. **Type `yes`, Enter.** Expected: "yes", then the chapter's welcome,
   read once. Check that you can stop it (Ctrl) and read it again with
   Alt+R.
4. **Play the chapter** (`cat message.txt`, then the hints in Mission if
   you are stuck). After each command: its echo, then its output, nothing
   twice. A refused `cd` says why. After `ls -l` or `systemctl status`
   nothing like "box drawings" or "black circle" is spoken.
5. **The hints.** Open Mission, press "The manual": its text is announced,
   the focus lands on "A lead"; after the last level, on "Close". Escape
   brings the focus back to the command line.
6. **Finish the chapter.** Expected: the debrief, the summary line, the
   achievements, then "Chapter finished: Lighthouse Island…". Escape then
   Tab reaches "Next chapter" (no "right arrow"); Enter opens chapter 2,
   the focus back on the command line.
7. **nano.** `exit`, then `nano notes.txt`: the field is announced with
   its shortcuts. Type a word, Ctrl-X: the focus lands on "Y Yes" in a
   group "Save modified buffer?", said once. Y saves and closes.
8. **A follow.** After The Root, `ssh datacenter`, `yes`, then
   `tail -f /var/log/nginx/access.log`: one sentence says it keeps running;
   then a summary every ten seconds, not each line. Escape stops it.
9. **Browse mode** (NVDA's, VoiceOver's VO+arrows): read the log back.
   Each command appears without its prompt, before its output.

To report what differs, use **Report a problem or an idea** (below).
Give the pair (reader and version, browser and version, system), the step
number, and what was said, word for word if you can, against what the
walkthrough expects.

## Report a problem

Use **Report a problem or an idea** (under the menu, among a chapter's
actions, or in the site's footer): choose "Something else", say which
assistive technology and browser you use, and send the report yourself as a GitHub issue or by copying its text. Nothing is sent
without you.
