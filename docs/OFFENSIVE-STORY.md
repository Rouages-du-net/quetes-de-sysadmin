# An offensive story — a guide for whoever wants to write it

This document is not a quest of the game: it is a guide for the (human)
person who will want to build a more offensive story than what the rest of
the game does — understanding an attack by replaying it, not just reading
its outcome. Understanding an attack helps defend against it, but the game
otherwise stays strictly defensive (see "Game rules" in `CLAUDE.md`): this
choice only concerns this story, and is for its author to own and document.
A Claude agent won't build this story on its own; this guide prepares the
work for when you take it on, and possibly for having it built afterwards.

## 1. A place, not yet taken

- **A name**: neither "Le Labo" (the disks story) nor "La Veille" (the
  `petrin` server story). Something on the offensive-audit side — for
  example *The Penetration Test*, *The Other Side*, *Red Team*. Check when
  you start: `grep "^## Story" docs/SCENARIOS.md` gives the current list and
  the next free number.
- **A machine and an address**, in `src/engine/machines.ts` (see the
  existing entries for the form).
- **A story identifier** (`id`), used in `src/engine/chapters/index.ts`,
  `src/engine/progress.ts` and `tests/progress/order.txt`.

## 2. The decisions that are yours

This is the part I didn't make for you:

- **How far "offensive" goes**: a deeper scan (already done by `nmap`)? a
  read-only tool that looks up advisories by version (like `searchsploit`,
  running nothing)? or a real proof of concept that "works" in the simulated
  world? The closer you get to the third option, the heavier section 4 below
  weighs.
- **Real or fictitious CVEs.** The rest of the game uses fictitious CVEs
  (`CVE-2099-NNNNN`, see `src/engine/chapters/watch.ts`) precisely so as
  never to document a real exploitable flaw. Starting from real ones is a
  choice to own and to explain in the debrief.
- **The safeguards told in the story itself**: written authorisation, legal
  framework, the difference between a commissioned penetration test and an
  intrusion — as `src/engine/chapters/scope.ts` ("L'Audit") already
  does for reading a scope. An offensive story without this explicit
  reminder would be an attack manual, not a quest.

## 3. The format of a quest (reminder)

The full format, with examples, is in `CONTRIBUTING.md`. In short, per
chapter:

| File | Contents |
|---|---|
| `src/engine/chapitres/<id>.ts` | known commands, starting world, the tools' state, events |
| `src/texts/en/chapitre-<id>.ftl` + `fr/...` | every text: arrival, events, debrief |
| `src/texts/en/indices-<story>.ftl` + `fr/...` | one graduated hint per step |
| `tests/<story>.test.ts` | each chapter replayed (solution, another way if possible, false leads), in every language |
| `docs/SCENARIOS.md` | the story's sheet |

And the wiring once the chapters are written: `src/engine/chapters/index.ts`
(register the story), `src/engine/paths.ts` (each chapter in at least one
learning path, otherwise `tests/paths.test.ts` fails),
`src/texts/en/histoires.ftl` + `fr/...` (title, summary),
`src/texts/en/noms.ftl` + `fr/...` (if `names: true`).

## 4. The real sticking point: a new simulated tool

This is where human development time becomes significant, and it is
predictable: every tool already in the game (`nmap`, `lynis`, `ufw`,
`fail2ban`…) took an engine, a command, a manual page, texts in both
languages and a row in the table of differences of `docs/SCENARIOS.md`.
Some reference points, taken from `nmap` and `lynis` (the tools added for
"L'Audit"):

| Piece | Example | Size |
|---|---|---|
| The engine (the simulated state) | `src/engine/scan.ts` | ~250 lines |
| The command (reads arguments, writes output) | `src/engine/commands/nmap.ts` | ~70 lines |
| A simpler tool (state read directly) | `src/engine/lynis.ts` + `commands/lynis.ts` | ~235 + ~30 lines |
| The manual page (`man`, `--help`), in `manuel.ftl` | `man-nmap`, `man-lynis` | a few dozen lines per tool, ×2 languages |

On top of that: the entry in `src/engine/commands/index.ts`, the options
and examples in `src/engine/commands/pages.ts`, a row in the table of
differences of `docs/SCENARIOS.md` (what the tool simplifies compared with
the real one), and a line in the structure section of `CLAUDE.md`. For an
offensive tool that models a real exploitation (not just reading), you also
need to represent a service's "compromised" state and what changes in the
simulated world once the proof of concept has run — the kind of addition
that justified an agent not doing it without you.

**To reduce this work**, three options, from the cheapest to the most
expensive:

1. **Add nothing: replay the existing tools in an offensive direction.**
   `nmap` (reconnaissance), `curl` (requests against an already simulated
   service, for example nginx or a Docker app), `ss`, `grep` in logs:
   everything already exists. An "exploitation" can be modelled as a series
   of these commands against a service **already misconfigured** by the
   chapter (a bit like "L'exposition" in "L'Audit" leaves Redis open),
   with no new tool at all.
2. **A small read-only tool.** A tool that only consults an already
   simulated state (like `lynis`, ~265 lines in both parts) costs much less
   than a tool that changes the state of the world.
3. **A tool that changes the state of the world** (a real proof of concept
   that "succeeds"). This is the version closest to a real offensive tool,
   and the longest: for each targeted service, it requires describing what
   "before" and "after" the exploitation mean in the simulated world (files,
   accounts, processes), on top of the engine and the command themselves.

## 5. Before pushing

```bash
npm test                    # every quest replayed, texts, hints, progress…
npm run build               # Astro + tsc
npm run preview &           # then:
npm run test:browser     # Chromium, 1000 and 375 px
```

## What an agent can do, on request

The mechanical, neutral part can still be delegated: wiring a story once its
chapters are written (`index.ts`, `machines.ts`, `paths.ts`,
`progress.ts`), or reviewing an already written chapter for consistency
with the existing engine, without changing its offensive substance.
