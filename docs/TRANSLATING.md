# Translating Sysadmin Quests

All the game's texts are in **`src/texts/<language>/`**, in
**[Fluent](https://projectfluent.org)** format (`.ftl`), created by Mozilla
for natural translations: plurals, named variables, long texts over several
lines. The code only contains identifiers. **English** (`src/texts/en/`) is
the reference language: texts are written in English first, and every
identifier exists in English. It is also the default and fallback language:
without a requested language (no `lang` attribute on the element or the
page), or in a language the game doesn't know, the game speaks English; a
text missing from a translation shows in English (`LANGUAGE_BY_DEFAULT` and
`gameLanguage()` in `src/texts/index.ts`). The `help` command works in every
language, like bash's builtin; each language adds its own name for it
(`commande-aide`: `aide` in French).

## The files

| File | Contents |
|---|---|
| `interface.ftl` | menus, buttons, progress |
| `histoires.ftl` | each story's title and summary |
| `chapitre-<id>.ftl` | a chapter: its title, the texts of its places and objects, its events |
| `shell.ftl` | prompt, sudo, pipes, common error messages |
| `manuel.ftl` | each command's `man` page, and `--help` |
| `commandes-*.ftl` | the commands' messages (`ls`, `tar`, `git`…) |
| `noms.ftl` | the names of places, objects and accounts that you type |
| `machines.ftl` | the names of the network's machines (`kingdom` → `royaume` in French) |
| `mots-de-passe.ftl` | the passwords the stories give (`farine-2028` → `flour-2028`) |
| `indices-<story>.ftl` | the graduated hints of a story's chapters |

## The format in short

```ftl
# A comment for translators
lighthouse-evenement-crabe = The crab finds its bucket again.

# A text over several lines: each line is indented.
lighthouse-message =
    "If you're reading this, the Eraser has been on the island.

    A creature is roaming the kingdom…"

# A variable: { $name }. Don't translate its name.
erreur-introuvable = { $commande }: { $cible }: No such file or directory

# A plural, following each language's rules (Intl.PluralRules)
etat-chapitres-faits =
    { $faits ->
        [one] { $faits } chapter
       *[other] { $faits } chapters
    } of { $total }

# An attribute: .name = …
histoire-effaceur = The Eraser
    .resume = A creature is erasing everything in the kingdom.
```

Pitfalls of the format:

- a line of text that starts with `.`, `[` or `*` is written `{"."}`,
  `{"["}`, `{"*"}` (otherwise Fluent takes it for an attribute or a variant);
- braces are written `{"{"}` and `{"}"}`;
- in a text over several lines, the common indentation is removed: a table
  aligned with spaces keeps its relative alignment;
- paragraphs can be wrapped freely: the game joins the lines of a paragraph
  and lets the terminal wrap them, except indented lines, dashes and tables
  (double spaces).

## What isn't translated

- **Technical identifiers**: names of commands and options, system paths
  (`/etc/nginx/`), addresses, `{ $… }` variables.
- **The outputs of a tool that answers in English** even on a Linux in
  another language (`ping`, `dig`, `curl`, nginx logs): they are in the code.
- The messages of a translated tool (coreutils, man-db, git, sudo) follow
  that tool's official translation in your language, when there is one: it's
  what an administrator would see with `LANG` set to your language.

### Names of places and objects

The directories and files you type (`Phare`, `crabe`, `.ampoule_de_secours`,
`souvenirs`) are translated in `noms.ftl`. The French name is the
identifier: `nom-<name>`, where a leading dot becomes `point-` and the other
dots become dashes.

```ftl
nom-Phare = Lighthouse
nom-point-ampoule_de_secours = .spare_bulb
nom-effaceur-conf-corrige = eraser.conf.fixed
```

A good name is typed effortlessly on a keyboard of your language: letters
without accents, digits, `.`, `-` or `_`, no space (`tests/names.test.ts`
checks it). A name applies to every chapter that translates its names: the
list of all renamings is kept in `tests/names/renamed.<language>.txt`, and
the test fails on any new renaming. If it is intended, review the difference
and update the list (`npx vitest run -u tests/names.test.ts`). In the same
directory, two names must stay different, and they had better differ from
their first letters, for Tab completion. The story's texts then use these
names as they are, without explanation: "mv crab Bucket".

Only the stories whose chapter declares `names: true` translate their names:
all of them do. The Eraser and the workstation translate all their places
and objects; the other stories translate the documents you read in your
home directory (emails, messages, notes, help notes, `LISEZMOI.txt`,
recovery plan…) and their servers' data: the Archives' collection (`fonds` →
`collection`) and the town hall's disk, Inès's novel, the share of the
Ludothèque and of the Maison des associations (`partage` → `share`), the
backups, the Coopérative's statements, the radio's folders… These names also
live in whatever keeps a copy or a trace of the files: restic and rsnapshot
snapshots, rsync copies, files tracked by git, scripts, crontabs, logs,
processes. The code therefore writes them in the language when it creates or
compares them (`path()`, `name()`, see below), and the English texts use
the English names. Technical names that other settings refer to stay as they
are: sites and addresses served over HTTP (`/var/www/…`, `/direct`),
databases, Docker images and projects (a Compose project's directory name
names its containers), systemd units, programs and scripts in the `PATH`
(`enregistrer`, `sonde`, `convertir.py`), and proper names (the radio's
`matinale-…` and `nuit-…` shows). A story's internal machines (the wiki and
archives of the Maison des associations) are renamed like its main machine.

Two accounts are translated too, in `noms.ftl`: the player's
(`nom-vous = you`: prompt `you@kingdom:~$`, `/home/you`, owner of files,
`whoami`, `User you` in the workstation's `~/.ssh/config`, author of
commits…) and the Eraser's system user (`nom-effaceur = eraser`). A Unix
account name: lower case, no accent, no space. The other accounts (`root`,
`www-data`, the characters: `malo`, `yasmine`…) stay as they are. In the
files the texts describe (sudoers, configurations, logs), write the
account's name in the language (`you    ALL=(ALL:ALL) ALL`).

**Machine names** are translated in `machines.ftl`
(`machine-kingdom = royaume`, `machine-desk = poste` in French): it is the name you
type (`ssh kingdom`), the one in the prompt, in `/etc/hosts`, in the
workstation's `~/.ssh/config` and keys (`~/.ssh/id_kingdom`), in
`/etc/hostname` and in the logs. A valid host name (RFC 1123): lower case,
digits and dashes. The engine's identifier is the English name (`machineName()`
and `hostInLanguage()` in `src/engine/machines.ts`); a save made in
another language (`known_hosts`, `~/.ssh/config`) follows the game's
language. In texts, write the language's name (`ssh kingdom`,
`kingdom.internal`); public sites (`letters.example`) and configuration
files (`/etc/nginx/sites-available/letters`) keep theirs.

The **passwords** the stories give (sudo, ssh, restic repositories,
databases) are translated too, in `mots-de-passe.ftl` (`mdp-farine-2028 =
flour-2028`): words of the language, no accent, no space. The code keeps the
French password (`password()` in `src/engine/world.ts`); the texts quote
the language's one. `tests/machines.test.ts` checks that no translated text
quotes a French machine name or password.

The commands in the manual's examples are in the code (`pages.ts`). When one
of them contains words (`grep "mot de passe" journal.txt`), a language can
replace it with a `.commande-N` attribute of the page:

```ftl
man-grep = prints the lines that contain the pattern…
    .exemple-3 = search for several words: quotes keep the spaces
    .commande-3 = grep "my password" journal.txt
```

The **hints** (`indices-<story>.ftl`) have one message per step, with no
value, and two attributes: `.piste` (a direction, without the command) and
`.solution` (the command, almost the answer). They use your language's names
from `noms.ftl`.

The messages the game **checks** (titles and keywords of the post-mortem,
names of datasets in the database…) are translated as what the player would
write in their language: read the comment above the message.

## Available languages

| Code | Language | Status |
|---|---|---|
| `en` | English | reference, default and fallback language; complete (texts, manual, tool messages as with `LANG=C`, names of the Eraser's and the workstation's places and objects, documents and data on the other stories' servers, `you` and `eraser` accounts) |
| `fr` | French | complete; the project's original language: internal names (identifiers of places and machines) are French |

## Adding a language

1. Copy `src/texts/en/` to `src/texts/<code>/` (a BCP 47 code: `de`,
   `es`, `zh-Hans`, `ko`…) and translate. A missing text shows in English:
   you can go file by file.
2. `npm test`: checks that the files are valid, with no duplicate
   identifier, none unknown in English, none missing, and replays every quest
   in every language.
3. If the language needs them, add its typographic rules in `typography()`
   (`src/texts/index.ts`): French non-breaking spaces are an example.

The Fluent format is supported by free translation platforms
([Weblate](https://weblate.org), [Pontoon](https://pontoon.mozilla.org)),
which let you translate without touching Git.

## For developers

- In the code: `t('identifier', { variable })` (interface) or `game.t(...)`
  (engine, commands, chapters). `t.exists(id)` tests whether an optional
  text exists.
- A number passed as a variable is formatted for the language ("1,234"):
  pass as text (`String(pid)`) what must stay as is.
- One whole sentence per message, never a sentence assembled from pieces.
- `tests/texts.test.ts` fails if accented French text remains in
  `src/engine/` or `src/interface/`, or if a key is missing in a language.
- A chapter with translated names (`names: true`) is written with the French
  names; the world is renamed when it is created. Every path in the code
  then goes through `path(j.t, '/Cabane/Jetee/filet')`, and a single name
  through `name(j.t, 'levain')` (see `src/engine/world.ts`). In tests, the
  commands are written in French too and go through `inLanguage()`
  (`tests/names.ts`). Whatever the game builds from a path (snapshots,
  crontab, script, log line, a process's command, a unit's contents) also
  takes the path in the language: `path(t, '/srv/partage')` in `state(t)`
  or `createWorld(t)`, `path(j.t, …)` in events. A web address that looks
  like a translated name (`-u /direct`) is typed in tests without `L()`.
- The player's account is `game.player` (`vous`, `you`…), or `player(t)`
  before the game exists (a chapter's state); never a hard-coded `'vous'`.
  Chapters declare their accounts (`accounts()`) and owners
  (`owner: 'vous'`) in French: they are renamed on creation, like places
  (`translateAccounts`, `translateNames`).
