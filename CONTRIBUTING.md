# Contributing to Sysadmin Quests

Thank you for wanting to write a quest, fix a bug or translate the game!
This page says what we expect from a contribution, and above all the
**format of a quest**. — [Version française](CONTRIBUTING.fr.md)

The full rules are in [`CLAUDE.md`](CLAUDE.md): it is written for AI coding
agents, but its rules apply to everyone.

## Ways to help

- **Report a bug**: open an issue with what you typed, what the game
  answered, and what a real Linux would have answered (with a link to the
  tool's documentation if you can).
- **Fix a command's behaviour**: a wrong option, message or exit code is a
  bug; see "A new simulated tool" below for where commands live.
- **Write a quest**: see "The format of a quest". Propose the idea in an
  issue first (the story, the commands it teaches, the traps), so we can
  agree on where it fits.
- **Translate**: every text lives in `src/texts/<language>/*.ftl`
  (Fluent format). Copy the `en/` directory and translate; see
  [`docs/TRANSLATING.md`](docs/TRANSLATING.md) for names,
  passwords and machine names, which are translated too.

## Principles

- **Real commands, real behaviours.** Names, common options, exit codes and
  error messages faithful to the real tool (on Debian), based on its
  official documentation, cited in a comment and in the debrief. Anything
  simplified goes in the **table of differences** in `docs/SCENARIOS.md`.
- **The manual first.** Every simulated command has its `man` page, answers
  `--help` and shows up in `man -k`. Hints point to the manual rather than
  giving the answer.
- **Objectives checked on the state of the simulated system**, never on the
  command typed: several correct solutions must pass.
- **100 % static and deterministic**: no real machine, no real network,
  nothing random without a seed (no `Date.now`, no `Math.random` in the
  engine).
- **Safe examples**: documentation addresses (RFC 5737: 192.0.2.0/24,
  198.51.100.0/24, 203.0.113.0/24; RFC 1918 for internal networks; RFC 3849
  for IPv6), documentation MAC addresses (RFC 7042), `.example` domains for
  anything public and `.internal` for internal machines. No real personal
  data. Security quests stay defensive: protect, detect, repair.
- **Accessible**: playable with the keyboard and on a 375 px screen,
  readable by screen readers, AA contrast, `prefers-reduced-motion`
  respected.
- **No trackers, no third-party resources**, and nothing that breaks the
  Content Security Policy in `public/.htaccess` (no inline scripts).

## Languages

- **English first.** English is the reference language of the game's texts:
  every text is written in English first (`src/texts/en/`), then
  translated (`src/texts/fr/`…). A missing translation shows in English.
- **The repository is in English**: documentation, code comments, commit
  messages and pull requests. French versions of the README, of this page
  and of the embedding guide are kept up to date; the other documents are in
  English only.
- **Code in English.** The project started in French. Files and
  identifiers (variables, functions, types, components) are now in
  English; some data identifiers are still French (the ids of places
  and machines, `.ftl` keys, CSS classes) and some
  comments, and are being moved to English. Write **new** code in
  English, and don't mix a large rename with a feature in the same pull
  request. Public names get an English alias
  first, with the French one kept for compatibility (the embeddable element
  takes `lang`, `story`, `save-key` and `theme="light|dark"`, and still
  accepts `langue`, `histoire`, `cle` and `theme="clair|sombre"`).
- **No text in the code.** Everything shown to the player (story, dialogue,
  debrief, message, `man` page) goes in the `.ftl` files; the code only
  calls `t('id', { variable })`. Whole sentences per key, named variables,
  plurals and numbers through Fluent: word order changes between languages.
- **Simulated outputs** imitate the real tool in the system's language:
  most tools answer in English whatever the game's language.

## The format of a quest

A **story** is a series of **chapters** (quests), on a machine of the
simulated network. A chapter is:

| File | Contents |
|---|---|
| `src/engine/chapitres/<id>.ts` | the chapter: its commands, starting world, state and events |
| `src/texts/en/chapitre-<id>.ftl` (and `fr/`) | all its texts: the starting email, files, events, debrief |
| `src/texts/en/indices-<story>.ftl` (and `fr/`) | its graduated hints: a lead, then almost the answer, for each step |
| `tests/<story>.test.ts` | the replayed game: the expected solution, another solution, the false leads |
| `docs/SCENARIOS.md` | its sheet: the story, the commands learnt, the goal, the traps |

A new chapter also goes at the end of `CODE_ORDER` in
`src/engine/progress.ts` and of `tests/progress/order.txt`, and in at
least one learning path (`src/engine/paths.ts`). A new story declares in
`src/engine/chapters/index.ts` which chapters unlock it (`after`), and gets
a machine in `src/engine/machines.ts`.

### The chapter (`Chapter`, in `src/engine/world.ts`)

- `id`, `number`, and the story that holds it.
- `commands`: the commands the chapter knows (others answer "command not
  found", as on a machine missing the package); their manual stays readable
  with `man`.
- `createWorld(t)`: the starting file system; texts come from `t('…')`,
  never from the code.
- `state()` and `initialise(jeu)`: the state of the simulated tools
  (services, firewall, directory…) at the start.
- `welcome`: the file read on arrival (often an email); `password` for
  sudo.
- `events`: conditions on the state, checked after each command and
  when the editor closes. Each shows its message only once. The `final`
  event ends the chapter: it is the debrief.

### Events: hints and false leads

A good chapter expects the common mistakes and answers them with an event
that **explains without giving the solution**: what happened, and where to
look (a `man` page, a file, a command to observe). For example: the
configuration changed without reloading the service, the rule that doesn't
survive a reboot, the password stored in clear text.

### The debrief

The final message always has three parts, and a fourth when another tool
does the same job:

```
WHAT HAPPENED
GOOD PRACTICE
ANOTHER WAY           (optional: the other tool, and the trade-off)
DOCUMENTATION
```

In exam mode, it is the only message of the chapter that shows: it must make
sense without the hints that came before. The documentation links point to
the tool's **official** documentation (manual pages, project site, RFCs).

### Difficulty

Each chapter shows a difficulty from 1 to 5 stars, computed by
`src/engine/difficulty.ts` from how much of the game comes before it and
from its size: there is nothing to set by hand.

### Tests

Each chapter has at least:

- a test that **replays the expected solution** to the end
  (`expect(c.finished).toContain('<id>')`);
- a test of **another correct solution**, when there is one;
- a test of the **false leads**: each hint event is triggered, and the
  chapter isn't finished while the mistake remains.

The tests replay every quest in every available language. The scenarios in
the tests are written with the French names of places and files (the
`inLanguage()` helper translates them), and texts are checked in French.

## A new simulated tool

A tool (nginx, nftables, slapd…) has its engine in `src/engine/<tool>.ts`
(no DOM, no displayed text) and its commands in
`src/engine/commandes/<tool>.ts`. For each command:

- its entry in `src/engine/commands/index.ts`;
- its options and examples in `src/engine/commands/pages.ts`;
- its page in `src/texts/en/manuel.ftl` and `fr/manuel.ftl`
  (`man-<command>`, `.synopsis`, `.option-X`, `.exemple-N`);
- a row in the table of differences in `docs/SCENARIOS.md`;
- a line in the structure section of `CLAUDE.md`.

## Before opening a pull request

```bash
npm test                    # every quest replayed
npm run build               # the site, the embeddable file, tsc
npm run preview &           # then:
npm run test:browser     # Chromium, 1000 and 375 px, CSP
```

For a visible change, play the chapter in a browser at 375 and 1000 px wide:
no console error, no horizontal scrolling.

Pull requests go to `main`. Describe what changes for the player, how you
checked it, and any difference from the real tool you introduced.

## Licences

The code is under the **GPL v3 or later** (`LICENSE`), the texts under
**CC BY-SA 4.0** (`LICENSE-CONTENUS.txt`). By contributing, you agree that
your contribution is published under these licences.

The game is **inspired by Terminus, created at MIT by Shawn Conrad and
Michele Pratusevich**: we keep this credit, but reuse neither its places,
its texts nor its puzzles.
