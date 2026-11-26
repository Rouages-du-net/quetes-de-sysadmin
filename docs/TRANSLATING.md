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
`gameLanguage()` in `src/texts/index.ts`); see "Complete and draft languages"
below. The `help` command works in every
language, like bash's builtin; each language adds its own name for it
(`command-help`: `aide` in French, `ayuda` in Spanish, `hilfe` in German).

## The files

| File | Contents |
|---|---|
| `interface.ftl` | menus, buttons, progress |
| `stories.ftl` | each story's title and summary |
| `chapter-<id>.ftl` | a chapter: its title, the texts of its places and objects, its events |
| `shell.ftl` | prompt, sudo, pipes, common error messages |
| `explainer.ftl` | the error explainer: each explanation, and in `.match` the error messages it answers, as the game prints them in this language (list only those not in English) |
| `manual.ftl` | each command's `man` page, and `--help` |
| `commands-*.ftl` | the commands' messages (`ls`, `tar`, `git`…) |
| `names.ftl` | the names of places, objects and accounts that you type |
| `machines.ftl` | the names of the network's machines (`kingdom` → `royaume` in French) |
| `passwords.ftl` | the passwords the stories give (`flour-2028` → `farine-2028` in French) |
| `hints-<story>.ftl` | the graduated hints of a story's chapters |

## The format in short

```ftl
# A comment for translators
lighthouse-event-crab = The crab finds its bucket again.

# A text over several lines: each line is indented.
lighthouse-message =
    "If you're reading this, the Eraser has been on the island.

    A creature is roaming the kingdom…"

# A variable: { $name }. Don't translate its name.
error-missing = { $command }: { $target }: No such file or directory

# A plural, following each language's rules (Intl.PluralRules)
state-chapters-done =
    { $finished ->
        [one] { $finished } chapter
       *[other] { $finished } chapters
    } of { $total }

# An attribute: .name = …
story-eraser = The Eraser
    .summary = A creature is erasing everything in the kingdom.
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

The directories and files you type (`Lighthouse`, `crab`, `.spare_bulb`,
`memories`) are translated in `names.ftl`. The English name is the
identifier: `name-<name>`, where a leading dot becomes `point-` and the other
dots become dashes. English gives each name as it is; French (and every
other language) gives its own:

```ftl
name-Lighthouse = Phare
name-point-spare_bulb = .ampoule_de_secours
name-eraser-conf-fixed = effaceur.conf.corrige
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
home directory (emails, messages, notes, help notes, `README.txt`,
recovery plan…) and their servers' data: the Archives' collection
(`collection` → `fonds` in French) and the town hall's disk, Inès's novel,
the share of the Ludothèque and of the Maison des associations (`share` →
`partage`), the
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

Two accounts are translated too, in `names.ftl`: the player's
(`name-you = vous` in French: prompt `vous@royaume:~$`, `/home/vous`, owner
of files, `whoami`, `User vous` in the workstation's `~/.ssh/config`, author
of commits…) and the Eraser's system user (`name-eraser = effaceur`). A Unix
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
databases) are translated too, in `passwords.ftl` (`password-flour-2028 =
farine-2028` in French): words of the language, no accent, no space. The
code uses the English password (`password()` in `src/engine/world.ts`); the
texts quote the language's one. `tests/machines.test.ts` checks that no text
quotes a machine name or a password of another language.

The commands in the manual's examples are in the code (`pages.ts`). When one
of them contains words (`grep "mot de passe" journal.txt`), a language can
replace it with a `.command-N` attribute of the page:

```ftl
man-grep = prints the lines that contain the pattern…
    .example-3 = search for several words: quotes keep the spaces
    .command-3 = grep "my password" journal.txt
```

The **hints** (`hints-<story>.ftl`) have one message per step, with no
value, and two attributes: `.lead` (a direction, without the command) and
`.solution` (the command, almost the answer). They use your language's names
from `names.ftl`.

The messages the game **checks** (titles and keywords of the post-mortem,
names of datasets in the database…) are translated as what the player would
write in their language: read the comment above the message.

## Available languages

Each language is **complete** or a **draft**, in `src/texts/languages.json`.

| Code | Language | Status |
|---|---|---|
| `en` | English | reference, default and fallback language; complete (texts, manual, tool messages as with `LANG=C`, names of the Eraser's and the workstation's places and objects, documents and data on the other stories' servers, `you` and `eraser` accounts) |
| `fr` | French | complete; the project's original language: translation of the English names of places, machines, accounts and passwords |
| `es` | Spanish | draft: the interface, the dialogs, the shell's and the commands' messages (from the Spanish catalogues of the [Translation Project](https://translationproject.org/team/es.html) and of git: `ls: no se puede acceder a…`, `No existe el fichero o el directorio`), the names of places, objects, machines and passwords, the workstation, The Eraser, the stories' titles and summaries, the whole manual (every page; command names, options, paths and quoted tool messages stay as the tools write them). `npm run coverage:texts -- es` says what is left |
| `de` | German | draft: the interface, the dialogs, the shell's and the commands' messages (from the German catalogues of the [Translation Project](https://translationproject.org/team/de.html) and of git: `ls: Zugriff auf '…' nicht möglich`, `Datei oder Verzeichnis nicht gefunden`), the names of places, objects, machines and passwords of every story, the workstation, The Eraser (`Der Radierer`) and its manual pages, the stories' titles and summaries. The term choices are in [glossary-de.md](glossary-de.md). `npm run coverage:texts -- de` says what is left |

Spanish is neutral international Spanish, usable in Spain and in Latin
America, with the informal "tú", like the French "tu"; inclusive where it is
natural, through neutral phrasing ("el alumnado", "quien juega") rather than
heavy forms. In prose, a file is an *archivo* and a directory a *carpeta*
(*directorio* in the manual); the tools' own messages keep their official
translation (*fichero*). Names you type have no accent and no ñ
(`EscuelaDeSenales`, `contrasena`).

German is standard German with the informal "du" (capitalised only at the
start of a sentence), using the terms German admins really use: English
where they say it (Server, Log, Backup, Deployment, Repository), German
where they do (Datei, Verzeichnis, Benutzer, Passwort, Rechte). Inclusive
through neutral phrasing first (Lehrkräfte, Lernende, die Person, Admins),
the middle dot only where nothing neutral exists. Prose quotes are „…“.
Names you type have no umlaut and no ß (`Huegel`, `Baeckerei`,
`koenigreich`). The choices are listed in [glossary-de.md](glossary-de.md),
for the next translators and a native reviewer.

## Complete and draft languages

A **complete** language has every file of `src/texts/en/`, each with exactly
the same texts. It is offered: the root sends browsers to it
(`public/.htaccess`), the other pages link to it, every quest is replayed in
it.

A **draft** is a translation in progress, file by file:

- each file it has holds exactly the texts of its English counterpart
  (`tests/texts.test.ts`); a missing file shows in English (the draft loads
  English's group with each of its own, `withEnglish` in
  `src/texts/index.ts`);
- the manual (`manual.ftl`, one file of more than 600 pages) goes page by
  page: a page is whole (its summary and every attribute of English's) or
  absent, and the manual's own messages (headers, option errors) are all
  there;
- a story is translated once every one of its files is: its
  `chapter-*.ftl` and `hints-*.ftl` (listed in `src/engine/catalogue.json`)
  and its own file when it has one (`<story>.ftl`, or the ones `storyFiles`
  of `languages.json` names). A story the draft doesn't translate yet is
  played with its **English world**: its places, files, machine and
  passwords keep their English names, as its English texts quote them,
  while the interface and the commands' messages are in the language (the
  story's translator, `translator(language, story)`; `machineName()` for its
  machine on the workstation). The player's account stays the language's
  everywhere;
- the tests replay, in a draft, the stories it translates
  (`languagesFor()` in `tests/names.ts`), and check that it translates The
  Eraser and the core files first;
- the site builds its pages (`/es/`, `/es/docentes/`, `/de/`,
  `/de/lehrkraefte/`…, see
  `src/site-languages.ts`) with a banner ("translation in progress"),
  `noindex`, and no link from the other languages nor redirection from the
  root: nobody lands there by chance on a game half in English. The
  installed app doesn't precache it.

`npm run coverage:texts` lists, for each draft, the files and the manual's
pages still in English, story by story.

## Adding a language

1. Add it to `src/texts/languages.json` as a `draft`, and create
   `src/texts/<code>/` (a BCP 47 code: `de`, `zh-Hans`, `ko`…).
2. Translate the core first, in this order: `interface.ftl`, the
   `dialog-*.ftl`, `start-here.ftl`, `feedback.ftl`, `shell.ftl` and the
   `commands-*.ftl` (the tools' messages, from their official translation),
   `explainer.ftl` (its `.match` lists the messages as your language prints
   them), `machines.ftl`, `names.ftl` and `passwords.ftl` (all of them: a
   name applies to every story), `desk.ftl`, `stories.ftl`, the manual's own
   messages and its everyday pages, then The Eraser.
3. Add the site's pages: `src/pages/<code>/` mirroring `src/pages/en/`, the
   addresses in `PAGES` of `src/site-languages.ts`, the layout's texts in
   `src/layouts/Base.astro` and the components (`Sheets.astro`,
   `StorySheet.astro`, `Classroom.astro`), the teachers' page in
   `TEACHERS_PAGE` of `src/engine/start-here.ts`, and the first visit's
   budget in `tests/budget.mjs`.
4. If the language needs them, add its typographic rules in `typography()`
   (`src/texts/index.ts`), its "yes" in the tools' questions (`YES` in
   `src/engine/commands/files.ts`, ufw's in `commands/ufw.ts`).
5. `npm test`, then `npm run coverage:texts`.

When every file and every page is translated, switch the language to
`complete` in `languages.json`: the tests then require every file, the site
offers it, and the root's redirection in `public/.htaccess` must name it
(`tests/languages.test.ts` checks it).

## Translating one story

A story is a unit of work that several translators can share, each one a
story:

1. `npm run coverage:texts -- es` lists the story's files still in English.
2. Translate each of them whole: the chapters (`chapter-<id>.ftl`), the
   hints (`hints-<story>.ftl`) and the story's own file if it has one. Use
   the names, machines and passwords already in `names.ftl`,
   `machines.ftl` and `passwords.ftl`: they are shared by every story (if a
   name must change, change it there, and update
   `tests/names/renamed.<language>.txt`). The files the texts describe
   (configurations, logs, sudoers) are written with the language's names
   and accounts.
3. Once its last file is there, the story is played in the language: its
   tests run in it (`npx vitest run tests/<story>.test.ts`), and the game
   switches its world to the language's names.
4. The manual's pages of the commands the story introduces are welcome
   too (`man-<command>` in `manual.ftl`, whole pages).

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
- A chapter with translated names (`names: true`) is written with the English
  names; the world is renamed when it is created. Every path in the code
  then goes through `path(j.t, '/Hut/Pier/net')`, and a single name
  through `name(j.t, 'sourdough')` (see `src/engine/world.ts`). A few real
  system directories that share a name with the world keep theirs
  (`/usr/share`, `/var/backups`…: `systemDirectory()`). In tests, the
  commands are written in English too and go through `inLanguage()`
  (`tests/names.ts`): in a command every word can be a name; in an expected
  output, only what looks like one (a path, next to `@`…). Whatever the game builds from a path (snapshots,
  crontab, script, log line, a process's command, a unit's contents) also
  takes the path in the language: `path(t, '/srv/share')` in `state(t)`
  or `createWorld(t)`, `path(j.t, …)` in events. A web address that looks
  like a translated name (`-u /direct`) is typed in tests without `L()`.
- The player's account is `game.player` (`you`, `vous`…), or `player(t)`
  before the game exists (a chapter's state); never a hard-coded `'you'`.
  Chapters declare their accounts (`accounts()`) and owners
  (`owner: 'you'`) in English: they are renamed on creation, like places
  (`translateAccounts`, `translateNames`).
