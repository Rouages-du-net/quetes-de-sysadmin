# Screen reader walkthrough

What the game gives a screen reader, step by step, while a first chapter
is played with the keyboard alone: where the focus is, and every text that
reaches a live region (the terminal's log, `role="status"`,
`aria-live`), in order. It is the reference a human tester compares with a
real screen reader (see "Testing with a real screen reader" in
[ACCESSIBILITY.md](ACCESSIBILITY.md)).

## How it was recorded, and what it is not

**No real screen reader ran.** NVDA and JAWS need Windows, VoiceOver
macOS or iOS, TalkBack Android; the project's machines are Linux
containers without a desktop. Orca, the Linux screen reader, is packaged,
but it needs a graphical session, the AT-SPI bus and a speech server to say
anything, and was not tried. What follows is the closest faithful
substitute:

- Chromium (headless, through Playwright), the built site, English, 1000 px;
  keys typed with the keyboard, nothing clicked.
- **Focus**: Chromium's own accessibility tree (DevTools protocol,
  `Accessibility.getFullAXTree`, which goes through the game's shadow
  root): the focused node's role and accessible name. The command line's
  description is always the same ("Tab completes; Escape then Tab leaves
  the line forward, Shift+Tab backward; Alt+R reads the last output
  again.") and is left out below.
- **Announced**: a `MutationObserver` on the page and the shadow root
  records each text added to a live region, without what is `aria-hidden`
  or not displayed; a `status` is read whole (it is atomic), a log only
  what was added. The same recorder is in `tests/a11y.mjs`
  (`recordSpoken`), which checks part of this sequence on every run.

So this says **what** a screen reader receives and in **which order**, not
how it speaks it: a real one may drop a polite announcement when another
comes quickly, read a long output in pieces, say punctuation differently,
or (NVDA) also say the line's new name when it changes under the focus.
Long texts are cut here at 170 characters (…); "/" stands for a line break.

## The Eraser, chapter 1: Lighthouse Island

From the workstation, as a first visit (the tour already seen). The
solution of `tests/quests.test.ts`, plus `ls -l` and a refused `cd`.

| Keys | Focus afterwards (role "name") | Announced (live region: text) |
| --- | --- | --- |
| focus the command line | textbox "Command you@desk:~$" | |
| `ssh kingdom` Enter | textbox "Command Are you sure you want to continue connecting (yes/no/[fingerprint])?" | |
| | | log: ssh kingdom |
| | | log: The authenticity of host 'kingdom.internal (192.0.2.10)' can't be established. / ED25519 key fingerprint is SHA256:0yYx1Kg+RtuPjDczVZWWuxrSqi/tszZnq/L5sOwl9GY. / This key… |
| | | log: Achievement: First step |
| | | status: Are you sure you want to continue connecting (yes/no/[fingerprint])? |
| `yes` Enter | textbox "Command you@kingdom:~$" | |
| | | log: yes |
| | | log: Warning: Permanently added 'kingdom.internal' (ED25519) to the list of known hosts. / Linux kingdom 6.12.0-quetes #1 SMP x86_64 GNU/Linux / Kingdom — server of the lighth… |
| `cat message.txt` Enter | textbox "Command you@kingdom:~$" | |
| | | log: cat message.txt |
| | | log: "If you are reading this, the Eraser has come to the island. / A creature roams the kingdom and erases everything it touches. Last night, it erased the bulb of the Lighth… |
| `cd Hill/SignalSchool/PracticeRoom` Enter | textbox "Command you@kingdom:~/Hill/SignalSchool/PracticeRoom$" | |
| | | log: cd Hill/SignalSchool/PracticeRoom |
| `mv crab Bucket` Enter | textbox "Command you@kingdom:~/Hill/SignalSchool/PracticeRoom$" | |
| | | log: mv crab Bucket |
| | | log: The crab is back in its bucket. The head of the school applauds: you know how to move an object with mv. |
| `cd ../Lessons` Enter | textbox "Command you@kingdom:~/Hill/SignalSchool/Lessons$" | |
| | | log: cd ../Lessons |
| `ls -a` Enter | textbox "Command you@kingdom:~/Hill/SignalSchool/Lessons$" | |
| | | log: ls -a |
| | | log: .   .secret_note         lesson_2_paths.txt   lesson_4_rename.txt / ..  lesson_1_manual.txt  lesson_3_hidden.txt |
| | | log: Achievement: What is hidden |
| `cat .secret_note` Enter | textbox "Command you@kingdom:~/Hill/SignalSchool/Lessons$" | |
| | | log: cat .secret_note |
| | | log: Well spotted! You found a hidden file. / Remember this: on an island, precious things are stored safely out of sight. And things stored out of sight often get a name that… |
| | | log: Tip. Long names to type? Press Tab: it completes the name for you. Pressed twice, it lists the possible choices. |
| `cd ~/Pier/Lighthouse` Enter | textbox "Command you@kingdom:~/Hill/SignalSchool/Lessons$" | |
| | | log: cd ~/Pier/Lighthouse |
| | | log: A huge tangled net blocks the door of the Lighthouse. It should be moved (mv) somewhere else… |
| `cd ~/Pier` Enter | textbox "Command you@kingdom:~/Pier$" | |
| | | log: cd ~/Pier |
| `mv net ~/Harbour/Boathouse` Enter | textbox "Command you@kingdom:~/Pier$" | |
| | | log: mv net ~/Harbour/Boathouse |
| | | log: The net is put away. The door of the Lighthouse is clear. |
| `cd Lighthouse` Enter | textbox "Command you@kingdom:~/Pier/Lighthouse$" | |
| | | log: cd Lighthouse |
| `cd ~/Harbour/Storeroom` Enter | textbox "Command you@kingdom:~/Harbour/Storeroom$" | |
| | | log: cd ~/Harbour/Storeroom |
| `ls -a` Enter | textbox "Command you@kingdom:~/Harbour/Storeroom$" | |
| | | log: ls -a |
| | | log: .  ..  .spare_bulb  label.txt |
| `ls -l` Enter | textbox "Command you@kingdom:~/Harbour/Storeroom$" | |
| | | log: ls -l |
| | | log: total 4 / -rw-r--r-- 1 you you 91 Jan  1 00:00 label.txt |
| `mv .spare_bulb ~/Pier/Lighthouse/Stairs/Lantern` Enter | textbox "Command you@kingdom:~/Harbour/Storeroom$" | |
| | | log: mv .spare_bulb ~/Pier/Lighthouse/Stairs/Lantern |
| | | log: The bulb is in the Lantern all right… but the holder refuses any object that isn't called exactly bulb. Rename it with mv. |
| `cd ~/Pier/Lighthouse/Stairs/Lantern` Enter | textbox "Command you@kingdom:~/Pier/Lighthouse/Stairs/Lantern$" | |
| | | log: cd ~/Pier/Lighthouse/Stairs/Lantern |
| `mv .spare_bulb bulb` Enter | textbox "Command you@kingdom:~/Pier/Lighthouse/Stairs/Lantern$" | |
| | | log: mv .spare_bulb bulb |
| | | log: The Lighthouse lights up! A beam sweeps across the sea, and at the Harbour, Captain Ana hoists the sail. / Well done! You have finished chapter 1. / You now know how to m… |
| | | log: Summary: 00:11 · 17 commands (1 with an error) · no hints See the details / · Replay this chapter |
| | | log: Achievement: First chapter |
| | | log: Achievement: No safety net |
| | | status: Chapter finished: Lighthouse Island. Its summary is at the end of the terminal; Escape then Tab reaches the buttons that follow it. |
| wait 2 s | textbox "Command you@kingdom:~/Pier/Lighthouse/Stairs/Lantern$" | |
| Escape then Tab | button "Next chapter" | |

## nano

On the workstation: open a file, write, save with Ctrl-O, write again,
leave with Ctrl-X and answer the question.

| Keys | Focus afterwards (role "name") | Announced (live region: text) |
| --- | --- | --- |
| focus the command line | textbox "Command you@desk:~$" | |
| `nano notes.txt` Enter | textbox "Contents of /home/you/notes.txt" (described: ^O Write Out ^X Exit) | |
| | | log: nano notes.txt |
| | | log: Achievement: First step |
| type text | textbox "Contents of /home/you/notes.txt" (described: ^O Write Out ^X Exit Modified) | |
| Ctrl-O | textbox "Contents of /home/you/notes.txt" (described: ^O Write Out ^X Exit) | |
| | | status: [ Wrote 1 line ] |
| type more | textbox "Contents of /home/you/notes.txt" (described: ^O Write Out ^X Exit Modified) | |
| Ctrl-X | button "Y Yes" | |
| y | textbox "Command you@desk:~$" | |
| | | status: [ Wrote 1 line ] |
| `cat notes.txt` Enter | textbox "Command you@desk:~$" | |
| | | log: cat notes.txt |
| | | log: Hello world |

## A follow (`tail -f`), then errors, a loop, a password

The Data Centre, chapter 1 (after The Eraser's four chapters).

| Keys | Focus afterwards (role "name") | Announced (live region: text) |
| --- | --- | --- |
| focus the command line | textbox "Command you@desk:~$" | |
| `ssh datacenter` Enter | textbox "Command Are you sure you want to continue connecting (yes/no/[fingerprint])?" | |
| | | log: ssh datacenter |
| | | log: The authenticity of host 'datacenter.internal (192.0.2.11)' can't be established. / ED25519 key fingerprint is SHA256:vY98T4yYX7kNJhiNrn/yhuza+2jZwH1jeDPFDY5cHIe. / This … |
| | | log: Achievement: First step |
| | | status: Are you sure you want to continue connecting (yes/no/[fingerprint])? |
| `yes` Enter | textbox "Command you@datacenter:~$" | |
| | | log: yes |
| | | log: Warning: Permanently added 'datacenter.internal' (ED25519) to the list of known hosts. / Linux datacenter 6.12.0-quetes #1 SMP x86_64 GNU/Linux / Data centre — web server… |
| `tail -f /var/log/nginx/access.log` Enter | button "^C Stop (Ctrl-C)" | |
| | | status: The command keeps running and shows new lines: a summary every ten seconds. Ctrl-C or Escape stops it. |
| wait 11 s | button "^C Stop (Ctrl-C)" | |
| | | status: 20 new lines; the last one: 198.51.100.77 - - [13/Oct/2026:20:42:40 +0200] "GET /catalogue/search?q=c960 HTTP/1.1" 503 197 |
| Escape | textbox "Command you@datacenter:~$" | |
| | | log: ^C |
| `systemctl status nginx` Enter | textbox "Command you@datacenter:~$" | |
| | | log: systemctl status nginx |
| | | log: nginx.service - A high performance web server and a reverse proxy server / Loaded: loaded (/usr/lib/systemd/system/nginx.service; enabled; preset: enabled) / Active: acti… |
| `cat nothing` Enter | textbox "Command you@datacenter:~$" | |
| | | log: cat nothing |
| | | log: cat: nothing: No such file or directory |
| `for i in 1 2` Enter | textbox "Command >" | |
| | | log: for i in 1 2 |
| | | status: The command is not finished: type its next line, or Ctrl-C to drop it. |
| `do echo $i; done` Enter | textbox "Command you@datacenter:~$" | |
| | | log: do echo $i; done |
| | | log: 1 / 2 |
| `sudo ls /root` Enter | textbox "Command [sudo] password for you:" | |
| | | log: sudo ls /root |
| | | log: We trust you have received the usual lecture from the local System Administrator. It usually boils down to these three things: / #1) Respect the privacy of others. / #2) … |
| | | status: [sudo] password for you: |
| `wrong-password` Enter | textbox "Command [sudo] password for you:" | |
| | | log: Sorry, try again. |
| `welcome-2026` Enter | textbox "Command you@datacenter:~$" | |
| | | log: ls: cannot access '/root': No such file or directory |

## Hints

Back in The Eraser, chapter 1: the Mission window and its three levels of
hints.

| Keys | Focus afterwards (role "name") | Announced (live region: text) |
| --- | --- | --- |
| "Mission" button, Enter | region "The instructions" | |
| | | status: No snapshot yet in this chapter. |
| hint button "The manual": Enter | button "A lead" | |
| | | status: Pages to read: man ls, man cd, man pwd, man cat, man less, man mv. Also search with man -k and a keyword. |
| hint button "A lead": Enter | button "Almost the answer" | |
| | | status: The exercise in the PracticeRoom (at the SignalSchool, on the Hill) asks you to put the crab away. Putting away is moving: which command moves an object into a place? |
| hint button "Almost the answer": Enter | button "Close" | |
| | | status: From the PracticeRoom: mv crab Bucket (then ls Bucket to check). |
| Escape (close the dialog) | textbox "Command you@kingdom:~$" | |

## What this pass found, and what changed

Before this pass, the same recording gave the following; each is fixed,
and checked by `tests/a11y.mjs`, unless said otherwise.

- **The prompt read before every output.** Each command's echo was
  announced as `you@kingdom:~/Hill/SignalSchool/PracticeRoom$ mv crab Bucket`.
  The prompt is now hidden from assistive technology in the echo (the
  line's name already says it); the command itself stays, so the log still
  tells which command an output belongs to, and confirms what ran after a
  completion or a recalled line.
- **Questions never announced.** ssh's "Are you sure you want to continue
  connecting", sudo's password prompt, the secondary prompt `>`: they
  became the line's name, but the focus stays on the line, so most screen
  readers said nothing and the player heard an output that ended without
  a question. They are now announced (`status`) after the output; the
  same question asked again (a wrong password) is not repeated, "Sorry,
  try again." says it.
- **Decoration spelt out.** systemctl's `●`, lsblk's and systemctl's trees
  (`├─`, `└─`), docker's `✔`, rules (`--------`, `^~~~~`), the trophy of
  achievements, the padlock and check mark of the menu's states, the arrow
  of "Next chapter →": all stay on the screen and are hidden from assistive
  technology (`aria-hidden` spans, `DECORATION` in `src/engine/announce.ts`).
  Alt+R and a follow's digest leave them out too. `-rw-------` is left
  alone: a run of dashes counts only standing alone.
- **Focus lost after a hint.** The hint button pressed disappears (the next
  level replaces it): the focus fell on the page. It now goes to the next
  level's button, or to the window's Close button. The hint's text was
  also announced again with every level above it; only the new level is
  now, from a status inside the window (what is outside a modal window is
  not read).
- **nano's question.** The yes button showed `O` (French nano) in every
  language; it is now `Y` in English. The question is the name of the
  buttons' group, read with the focus on "Yes", and no longer a second
  time by the status line.
- **The command line's text read twice in browse mode.** The prompt, the
  word "Command" and the keys were text around the field and also its name
  and description; they are now only its name and description.
- **No heading for the terminal.** The menus are named navigation
  landmarks, but nothing led to the terminal with heading navigation; it
  now has a heading "Terminal" (visually hidden).
- **Small things.** "Tip" ran into its sentence (now a pause after it);
  the Mission window opened on an unnamed block, now a region named "The
  instructions"; the rescue snapshot's status was set again each time the
  window opened.

Kept as they were, on purpose:

- **Language.** Outputs are not marked `lang="en"` in the French game:
  they mix the tool's English with the story's French; a voice switching
  language every line would be harder to follow (see ACCESSIBILITY.md).
- **The chapter's end is said twice in substance**: its debrief in the log,
  then a short status ("Chapter finished: … Escape then Tab reaches the
  buttons that follow it."), which says where the focus can go next.
- **`^C`** after Ctrl-C stays in the log, as a terminal shows it.
- **Tables** are read as lines of text (see ACCESSIBILITY.md, "Known
  limitations").

## For a human to check with a real screen reader

- Whether a polite status that follows a log addition in the same instant
  (the ssh question, the chapter's end) is read after it, or drops it.
- Whether NVDA also reads the line's new name (the question) when it
  changes under the focus: then the question would be heard twice.
- How a long output (the chapter's welcome, `cat` of a long file) is read,
  and whether reading stops when the next command is typed.
- Whether the `aria-hidden` decorations are really silent in browse mode
  with each reader.
- VoiceOver on iOS and TalkBack: whether the log is read at all while the
  on-screen keyboard is open.
