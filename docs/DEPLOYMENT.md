# Deploying to sysadmin.rouages.net

The site is **100 % static**: `npm run build` produces `dist/`, which GitHub
Actions uploads over **FTPS** to rouages.net's cPanel (Apache) hosting on
every push to `main`, as for rouages.net.

## What happens on each push

Workflow `.github/workflows/deploy.yml`:

1. **unit** and **test**, side by side (every PR and every push): `unit`
   runs `npm test` (quests replayed); `test` runs `npm run build` (with the
   first visit's budget), then the two scripts of `npm run test:browser`
   at the same time, each with its own Chromium (kept in the Actions cache
   for the Playwright version in use): `tests/browser.mjs` (1000 and
   375 px, no console error, with the CSP of `.htaccess`, the root's
   language choice, the 404 page, embedding in another page, the installable
   game: manifests, service worker, offline play, the footer's button) and
   `tests/a11y.mjs`. This build has no statistics server (see
   "Statistics"); on `main` only, `test` then builds again with the
   statistics' variables, and that build is the one deployed.
2. **deploy** (`main` only, once both have passed): upload of `dist/` over FTPS, then a check of
   the live site (the `/en/` and `/fr/` pages, the root's redirection to
   each language, the redirect of the old `/enseignants/` address, the CORS
   header of the embeddable file, the CSP, the service worker and the
   manifest with their media type, the 404, the FTP state file
   refused, the HTTP → HTTPS redirection).

As long as the FTP secrets aren't set, the deployment step is **skipped
without failing** (a notice says so in the workflow's summary).

## Setting up (once)

### 1. On cPanel

1. **Domains** → create the `sysadmin.rouages.net` subdomain, with its own
   root directory (for example `sysadmin.rouages.net/`), **separate** from
   rouages.net's.
2. **SSL/TLS Status** → run AutoSSL for the subdomain (a Let's Encrypt or
   Sectigo certificate), otherwise the HTTPS redirection of `.htaccess` will
   lead to a certificate error.
3. **FTP Accounts** → create an account **restricted to the subdomain's
   directory** (for example `deploiement-sysadmin@rouages.net`), with a long,
   unique password. Don't reuse rouages.net's account: a failed deployment
   must not be able to touch the other site.

### 2. On GitHub

Repository → *Settings* → *Secrets and variables* → *Actions* (or the
`production` environment):

| Secret | Value |
|---|---|
| `FTP_SERVER` | the hosting's FTP server (often `ftp.rouages.net`) |
| `FTP_USERNAME` | the restricted FTP account created above |
| `FTP_PASSWORD` | its password |
| `FTP_SERVER_DIR` | optional: remote directory, ending with `/` (default `./`, the root of the restricted account) |

Then, for the visit statistics (optional, see "Statistics"), the
**Variables** tab of the same page (repository variables, not secrets: the
values end up in the public JavaScript and `.htaccess`):

| Variable | Value |
|---|---|
| `PUBLIC_UMAMI_HOST` | the Umami server, `https://` only, e.g. `https://ct.mayetco.fr` |
| `PUBLIC_UMAMI_SITE_ID` | the website id Umami gives for the site's own pages (a website whose domain is `sysadmin.rouages.net`) |
| `PUBLIC_UMAMI_EMBED_ID` | the website id for the game embedded in other sites (a second website in Umami: its views carry the host pages' names) |

Without `PUBLIC_UMAMI_HOST`, or without an id, that counter is off.

### 3. First deployment

*Actions* → "Test and deploy to sysadmin.rouages.net" → *Run workflow*
on `main`. The "Check the live site" step must pass; otherwise, its
log says which check fails.

## Good to know

- **Synchronisation**: the FTP action keeps the state of the uploaded files
  in `.ftp-deploy-sync-state.json` on the server and only uploads the
  differences; `.htaccess` forbids reading it. To upload everything again,
  delete this file on the server.
- **CSP**: `public/.htaccess` only allows the site's own scripts
  (`script-src 'self'`). Never add an inline `<script>` or a third-party
  resource; the browser test fails if you do. Its `connect-src` is
  `'self'`; a build with `PUBLIC_UMAMI_HOST` adds that server to it in
  `dist/.htaccess` (`src/stats-build.ts`), and nothing else.
- **Embeddable file**: `/integration/quetes-de-sysadmin.js` is served with
  `Access-Control-Allow-Origin: *`, which another site needs to load it as a
  `<script type="module">`, and revalidated on every visit (its name doesn't
  change from one version to the next). The rest of the game is in
  `/integration/chunks/` (see "Chunks and budget"), also with the CORS
  header, and cached for a year (`immutable`): their names carry a hash.
- **Compression**: Brotli where Apache has `mod_brotli`, gzip
  (`mod_deflate`) otherwise.
- **Language at the root**: `/` redirects (302, `Vary: Accept-Language`) to
  `/fr/` when the browser's first language is French, to `/en/` otherwise.
  The old French addresses (`/enseignants/`, `/enseignants/classe/`) redirect
  permanently (301) to `/fr/…`.
- **Feeds of new stories**: `/en/feed.xml` and `/fr/feed.xml`, Atom,
  written by the build (`src/pages/<language>/feed.xml.ts`, from the
  release dates of `src/engine/releases.ts`), served as
  `application/atom+xml` (a `ForceType` in `.htaccess`), compressed, and
  revalidated on every visit (`no-cache`) like the manifests.
- **Installable game (PWA)**: each language has its manifest
  (`/en/manifest.webmanifest`, `/fr/manifest.webmanifest`, served as
  `application/manifest+json`), and the site a service worker, `/sw.js`
  (scope `/`, so it covers `/en/` and `/fr/` without a
  `Service-Worker-Allowed` header). `/sw.js` is not in `public/`: at the
  end of `astro build`, the integration of `src/pwa/build.ts` writes it from
  the template `src/pwa/service-worker.js`, with the list of files to
  precache, the game's shell: each language's page and manifest, the
  icons, the WOFF2 fonts and the files of each page's first visit
  (`src/pwa/first-load.mjs`, the list the budget weighs), the dialogs'
  texts (`texts-*--dialog-*`, a few KB, so that a dialog opens offline), the
  rarely opened dialogs' own chunks (`*-dialog.*.js`, for the same reason) and
  the chapters' summaries (`texts-*--summaries`); about 50 files, 2.1 MB,
  0.8 MB compressed; and a **version**: a hash of these files. The
  cache is called `qds-<version>`; a new build gives a new `sw.js`, which
  precaches the new files and, once active, deletes the older `qds-<…>`
  caches. The stories (with the engine families they bring), their texts,
  the manual's pages and examples are not precached: when the game first loads one, the service worker keeps it in
  `qds-runtime`, a cache that outlives versions (`sw.js` lists every hashed
  file of the build, `ASSETS`: on activation, a kept file the build no
  longer has goes, and its new version, same name with a new hash, is
  fetched in its place). A story opened online thus plays offline.
  `sw.js` and the manifests are revalidated on every visit (`no-cache`).
  Astro's hashed files are served from the cache first, the pages from the
  network first (the cache when offline; a page never visited falls back
  to the game in its language). Nothing from another
  origin is cached, nor `/integration/`. The icons (`public/icons/`) are
  drawn by `node scripts/icons.mjs` (Chromium), not by the build. The
  embeddable element never registers a service worker in its host page.
- **Chunks and budget**: the game is not one file. The page (or the
  embeddable file) loads a small element, which shows an empty frame of the
  game's size and fetches side by side the game (interface and engine,
  `game.*.js` and the shared chunk it imports), its core texts and the
  story it will open. What only some stories, or only some screens, need
  stays out of it:
  - the **engine families** (`src/engine/families.ts`): the tools of a few
    stories (Windows' shells and cmdlets, k8s, libvirt, CUPS, Prometheus,
    keepalived/HAProxy, Forgejo, IBM i, COBOL, Ansible, Caddy, LDAP/RADIUS,
    MariaDB, Dovecot/rspamd, NUT, Garage, openssl and certbot, Docker,
    Apache, Postfix, PostgreSQL, nmap/Lynis/gpg, Samba, the disks' tools
    (smartctl, mdadm, LVM), cryptsetup, lftp, rsnapshot, jq), modules of `families/` that load with the stories whose
    module imports them; the table of commands keeps their entries
    (`families.json`) and loads a family before a line that runs one of its
    commands (`needs()` in `src/interface/run-line.ts`, `NeedsLoading`
    otherwise). A story's
    own tool goes in a family (`CONTRIBUTING.md`, "A story's own commands");
  - the manual's examples and SEE ALSO (`commands/examples.ts`), with the
    manual's pages;
  - the chapters' summaries (`texts-<language>--summaries`; the core keeps
    their titles) and, for a page in another language, English's core
    texts (the fallback): the interface fetches them, the manual and its
    examples once the terminal is ready (`idle()` at the end of `mount()`);
    the menu fills its summaries then, the mission dialog and the notebook
    wait for them;
  - the dialogs a player rarely opens ("Where do I start?", "Report a
    problem or an idea", the daily reminder, a chapter's summary): each is a
    chunk of its own, `*-dialog.*.js` (`src/interface/lazy-dialog.ts`),
    fetched with its texts when it first opens, and precached.

  A story's chapters (`src/engine/stories/<id>.ts`, with the code only they
  use), each engine family, each group of texts (`texts-<language>--core`,
  `--shared`, `--summaries`, `--manual`, `--story-<id>`, `--dialog-<name>`,
  made by `src/texts/plugin.mjs`) are chunks with a hash in their name, in `/_astro/` for the site and
  `/integration/chunks/` for the embeddable file, which imports them
  relative to its own address (`import.meta.url`), so from the game's site
  whatever page embeds it. `npm run build` ends with `tests/budget.mjs`:
  the JavaScript and CSS of a first visit (`/en/`, `/fr/`, the embeddable
  file), raw, gzip and Brotli, against a gzip budget (about 15 % over the
  size measured when it was set). Over budget, the build fails: load the
  new code lazily (a story module, an engine family, a text group), or
  raise the budget on purpose. On a phone throttled like Lighthouse's
  mobile profile (150 ms, 1.6 Mbit/s, CPU 4x; gzip as Apache sends it), the
  terminal of `/en/` answered after 12.3 s with the single file, 5.7 s
  split, 4.0 s once the families and the texts above left the first visit
  (`/fr/`: 6.2 s, then 4.0 s), 3.5 s once openssl, Docker, Apache,
  Postfix, PostgreSQL, Samba, the disks' and the auditor's tools became
  families too (`/fr/` and the embeddable file: 3.5 s); the first visit
  went from 892 to 549, then 455 KiB gzip on `/en/`, 999 to 553, then 459
  on `/fr/`, 960 to 588, then 482 for the embeddable file.
- **Rolling back**: revert the faulty commit (`git revert`) and push to
  `main`; the workflow uploads the previous version again.

## Statistics

Anonymous visit statistics, counted by the project's own
[Umami](https://umami.is) server, so we know which pages, stories and
chapters are used and where the game is embedded. No Umami script is
loaded: `src/stats.ts` posts to Umami's tracking API itself
(`POST {PUBLIC_UMAMI_HOST}/api/send`, as Umami's tracker does), with
`credentials: 'omit'` (no cookie), and keeps nothing in the browser (no
identifier: Umami recognises a visit from a hash of the request, which it
rotates). A failed request is dropped in silence; the game never waits for it.

**Configuration**: the build-time variables `PUBLIC_UMAMI_HOST`,
`PUBLIC_UMAMI_SITE_ID` and `PUBLIC_UMAMI_EMBED_ID` (see `.env.example`;
in GitHub Actions, the repository's variables, see "Setting up"). When the
host or a counter's id is missing, that counter doesn't exist and no code
path sends anything: local development, forks, the tests and the build
checked in Chromium send nothing. The host is added to `connect-src` in
`dist/.htaccess` only when it is set.

**Two counters**:

- **site** (`PUBLIC_UMAMI_SITE_ID`): the pages of sysadmin.rouages.net
  (`src/pwa/visit.ts`, every page of `Base.astro`), and the game's events on
  them;
- **embed** (`PUBLIC_UMAMI_EMBED_ID`): the game embedded in another site
  from `dist/integration/`: one view when the game loads, with the host
  page's name and path, then the game's events. On the site's own pages
  the element uses the site's counter (no double count). A host page turns
  it off with `stats="off"` (`docs/EMBEDDING.md`).

**What is sent**, in each request: the counter's website id, the page's
host name, its path (`location.pathname`, never the query string nor the
fragment), its title, the screen's size (`1280x800`), the browser's
language (`navigator.language`), and the referrer reduced to another
site's origin (`https://forum.example/`; empty from the same site). And:

| When | Name | Data |
|---|---|---|
| a page of the site is shown | (page view) | `language`: the page's |
| the installed game (PWA) is launched: display-mode standalone, not from another page of the site | `app-opened` | `language` |
| the embedded game has loaded (embed counter) | (page view) | `language`: the game's |
| a story is opened (its machine connected) | `story-opened` | `story`, `language` |
| a chapter's objective is reached | `chapter-finished` | `story`, `chapter`, `language` |

**Never sent**: commands or anything typed, the save, the progress codes,
the notebook, the player's name, answers to "Where do I start?", times,
hints. **Nothing at all** in exam mode (saved by the game, or turned on by
the page), nor when the browser sends Do Not Track
(`navigator.doNotTrack === '1'`) or Global Privacy Control
(`navigator.globalPrivacyControl`). Tests: `tests/stats.test.ts`.
