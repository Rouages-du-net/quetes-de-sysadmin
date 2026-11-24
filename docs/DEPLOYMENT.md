# Deploying to sysadmin.rouages.net

The site is **100 % static**: `npm run build` produces `dist/`, which GitHub
Actions uploads over **FTPS** to rouages.net's cPanel (Apache) hosting on
every push to `main`, as for rouages.net.

## What happens on each push

Workflow `.github/workflows/deploy.yml`:

1. **test** (every PR and every push): `npm test` (quests replayed),
   `npm run build`, then `npm run test:browser` in Chromium (1000 and
   375 px, no console error, with the CSP of `.htaccess`, the root's
   language choice, the 404 page, embedding in another page, the installable
   game: manifests, service worker, offline play, the footer's button).
2. **deploy** (`main` only): upload of `dist/` over FTPS, then a check of
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
  resource; the browser test fails if you do.
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
    MariaDB), modules of `families/` that load with the stories whose
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
  (`/fr/`: 6.2 s, then 4.0 s); the first visit went from 892 to 549 KiB
  gzip on `/en/`, 999 to 553 on `/fr/`, 960 to 588 for the embeddable
  file.
- **Rolling back**: revert the faulty commit (`git revert`) and push to
  `main`; the workflow uploads the previous version again.
