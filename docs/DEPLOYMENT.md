# Deploying to sysadmin.rouages.net

The site is **100 % static**: `npm run build` produces `dist/`, which GitHub
Actions uploads over **FTPS** to rouages.net's cPanel (Apache) hosting on
every push to `main`, as for rouages.net.

## What happens on each push

Workflow `.github/workflows/deploy.yml`:

1. **test** (every PR and every push): `npm test` (quests replayed),
   `npm run build`, then `npm run test:browser` in Chromium (1000 and
   375 px, no console error, with the CSP of `.htaccess`, the root's
   language choice, the 404 page, embedding in another page).
2. **deploy** (`main` only): upload of `dist/` over FTPS, then a check of
   the live site (the `/en/` and `/fr/` pages, the root's redirection to
   each language, the redirect of the old `/enseignants/` address, the CORS
   header of the embeddable file, the CSP, the 404, the FTP state file
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
  change from one version to the next).
- **Language at the root**: `/` redirects (302, `Vary: Accept-Language`) to
  `/fr/` when the browser's first language is French, to `/en/` otherwise.
  The old French addresses (`/enseignants/`, `/enseignants/classe/`) redirect
  permanently (301) to `/fr/…`.
- **Rolling back**: revert the faulty commit (`git revert`) and push to
  `main`; the workflow uploads the previous version again.
