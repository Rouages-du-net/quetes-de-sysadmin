# Adding a simulated command (a "tool")

The shape to deliver so a new tool plugs into the game's network. This is
**form only** — the mechanics of wiring a command in; the behaviour and the
commands themselves are yours. The same contract is used by every tool in the
game, from `ls` to `nginx`.

## The contract in one sentence

A tool is one or more `Command` objects, **registered** in
`commands/index.ts`, that read and change the simulated machine **only through
the `game`** (a `Shell`); its **manual** lives in the texts (not in the code);
and a **test replays it**.

---

## 1. Where the files go

| File | What you put there | Required |
|---|---|---|
| `src/engine/commands/<tool>.ts` | the command(s): a `Record<string, Command>` export | yes |
| `src/engine/<tool>.ts` | the model/state, if the tool has its own little world (like `nginx.ts`, `nfs.ts`) — pure logic, **no DOM** | only if stateful |
| `src/engine/commands/index.ts` | `import` + spread into the commands table | yes |
| `src/engine/commands/pages.ts` | the manual's technical part (options, examples, cross-refs, section) | yes |
| `src/texts/en/manual.ftl`, then `…/fr/manual.ftl` | the man-page text (**English first**) | yes |
| `src/texts/en/*.ftl` (+ `fr`) | every **other** string the tool prints (never a sentence in code) | if it prints text |
| `tests/…` | a test that replays the tool / checks the model | yes |

---

## 2. The command module (shape)

```ts
// Header comment: what this models, the real tool it imitates, the URL of the
// official doc it is based on, and the deliberate differences from the real
// tool (those also go in the differences table of docs/SCENARIOS.md).
import type { Command } from './index';
import type { Shell } from '../shell';

function foo(game: Shell, args: string[]): string {
  // 1. read args
  // 2. read and/or change the simulated machine, through `game` only
  // 3. return the text to print (stdout); report problems with game.error(...)
  return '';
}

export const FOO: Record<string, Command> = {
  foo: { section: 1, ownOptions: true, launch: ({ args, game }) => foo(game, args) },
  // several related commands can live in the same module and the same export
  // bar: { launch: ({ args, game }) => bar(game, args) },
};
```

## 3. The `Command` fields

| Field | Meaning |
|---|---|
| `launch(c)` | **required.** Returns the output string, or `null` to clear the screen. |
| `section` | man section: `1` commands (default), `5` config files, `8` administration. |
| `options` | short flags the generic checker accepts (e.g. `['l','a']`); an unknown one gives the real `Try 'foo --help'…` message. |
| `long` | GNU long options → their short equivalent (`{ all: 'a' }`), or `''` to read as-is (`--max-depth=1`). |
| `ownOptions` | `true` when the command parses its own flags (skip the generic check). |
| `examples` | example command lines; their explanations are `.example-N` in `manual.ftl`. |
| `see` | cross-references for the SEE ALSO line. |
| `directory` | set only for a tool **outside the PATH** (a monitoring plugin), runnable by full path. |

## 4. The `game` (a `Shell`) — the only way to touch the machine

The `launch` context gives you `{ args, input, game, last }`. Everything the
tool does to the world goes through `game`:

| Call | What it does |
|---|---|
| `game.args` | the arguments (same as `args`). |
| `game.who` / `game.player` | the effective user (root under `sudo`) / the human's account. |
| `game.find(path)` | the node (file/dir) at a path, or `undefined`. |
| `game.read(path)` | a file's text content, or `null`. |
| `game.resolve(path)` | absolute, `~`- and `.`-expanded path. |
| `game.exists(path)` | does the path exist. |
| `game.can(node, 'r'\|'w'\|'x')` | permission check for the current user. |
| `game.place(cmd, path, node)` | create / move / write a node **with all the rights and disk checks**; returns an error string or `''`. |
| `game.erase(path)` | delete a node. |
| `game.state` | the machine's story state (`game.state.<tool>`, English keys) — see §6. |
| `game.error(msg, code?)` | print an error line and set the exit code (default 1). |
| `game.status` | set the exit code directly (`0` ok). |
| `game.t('id', { var })` | a **translated** string (see §8). |
| `game.last` | is this the on-screen command (vs. inside a pipe)? |
| `game.hostName` | the machine's display name. |

**Two hard rules**

- **No text in the code.** Every printed sentence is `game.t('id', …)`, defined
  in the `.ftl` texts. Tool output that imitates a real tool in English stays in
  English; the game's own messages are translated.
- **Deterministic.** No `Date.now()`, no `Math.random()`. Time comes from the
  machine's clock (`systemd(game)?.clock`, `state`), so a replay is exact.

## 5. Registration

In `src/engine/commands/index.ts`:

```ts
import { FOO } from './foo';
// …inside the commands table:
  ...FOO,
```

(The table is assembled on first use, so import order doesn't matter.)

## 6. The model / state module (only if the tool is stateful)

A tool with its own world (a server, a device, a database) keeps its logic in
`src/engine/<tool>.ts` — pure functions, no DOM, no commands imported back
(keep the dependency one-way: `commands/<tool>.ts` → `<tool>.ts`).

- State lives on `game.state.<tool>` with **English keys**
  (`state.foo = { … }`), created lazily: `const foo = (j) => (j.state.foo ??= { … })`.
- The chapter sets the initial state (`Chapter.state`) and wires any
  load/initialise hook (`Chapter.initialise`, or a service `load` hook if a
  daemon re-reads its config on restart).

## 7. The manual — mandatory ("the manual first")

Two places, and both are needed for `man`, `--help`, `man -k`/`apropos` to work.

`src/engine/commands/pages.ts`:

```ts
foo: { section: 1, options: ['x'], long: { extra: 'x' },
  examples: ['foo -x bar'], see: ['bar', 'baz'] },
```

`src/texts/en/manual.ftl` (then the same keys in `…/fr/manual.ftl`):

```
man-foo = one paragraph: what foo does and the one idea to remember.
    .synopsis = foo [-x] ARG
    .option-x = what -x does.
    .example-1 = what the first example shows
    .command-1 = foo -x bar      # ONLY if the command line itself differs per language
```

- `man-<name>` carries NAME + DESCRIPTION; `.synopsis` is SYNOPSIS; `.option-<x>`
  are OPTIONS; `.example-N` pair with `examples[N-1]`; `see` gives SEE ALSO.
- A config-file page (section 5) uses `man-<name>` with a `launch: () => ''`
  stub registered in the module, and the dotted name is underscored:
  `foo.conf` → `man-foo_conf`.
- `--help`, `apropos`/`man -k` and an unknown-option message all come for free
  once these two entries exist (unless you set `ownOptions`, in which case the
  tool prints its own usage/`--help`).

## 8. Texts

Every displayed string is a Fluent key: English in `src/texts/en/…`, then the
same key in `src/texts/fr/…`. `tests/texts.test.ts` fails if an accented French
string is left in `src/engine/` or if a key is missing in a language. Pass
technical numbers as text: `String(pid)`.

## 9. Tests

- A model/behaviour test for the tool (both languages for anything user-facing).
- If a chapter uses the tool, its quest-replay test (`tests/quests.test.ts`
  plus the story's own test) exercises it end to end, in each language, with at
  least one false lead.

## 10. Definition of done

- [ ] `npx tsc --noEmit -p .` clean, `npm test`, `npm run build`, `npm run test:browser`.
- [ ] man page in **en + fr**; `--help`; shows up in `apropos`.
- [ ] an unknown option gives the real `Try 'foo --help' for more information` message.
- [ ] deterministic (no `Date.now` / `Math.random`).
- [ ] a test replays it; deliberate differences noted in `docs/SCENARIOS.md`.

---

## Minimal end-to-end skeleton

```
src/engine/commands/foo.ts     export const FOO = { foo: { launch } }
src/engine/commands/index.ts   import { FOO } … ; ...FOO,
src/engine/commands/pages.ts   foo: { examples: […], see: […] }
src/texts/en/manual.ftl        man-foo = … .synopsis = … .example-1 = …
src/texts/fr/manual.ftl        (same keys, translated)
tests/foo.test.ts              replays foo, checks the state it changed
```

That is the whole contract. Anything that follows it drops into the network
like any other tool.
