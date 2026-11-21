// Story "The Tool Library": what its chapters share. Shared Shed, a
// nonprofit network of community tool libraries, maintains Lendshed, the
// open-source lending software some forty tool libraries run (a Flask app
// with its documentation site). Its code lives on anvil (enclume in French,
// 192.0.2.80), a small Debian server running Forgejo at
// https://forge.lendshed.example (behind nginx, on 127.0.0.1:3000) and a
// Forgejo Actions runner (forgejo-runner, docker label), which also
// publishes the documentation to /srv/www/docs as the deploy account
// (rsync over ssh, deploy@anvil.internal: the runner connects from anvil
// itself, 192.0.2.80).
// The forge's accounts: wanjiru (lead maintainer, administrator), rosa
// (maintainer), you (administrator, the new volunteer sysadmin), tomasz
// (maintainer until March, still a direct collaborator with an old token),
// kwame (a contributor, with his fork kwame/lendshed and pull request #57,
// a Swahili translation). Aroha, at a tool library in Wellington, installs
// the releases.
// Addresses: RFC 5737; public names in .example (RFC 6761), the internal
// ones in .internal.
// Sources: https://forgejo.org/docs/latest/, https://git-scm.com/docs/git-config
// (gpg.format, user.signingKey, gpg.ssh.allowedSignersFile),
// https://man.openbsd.org/ssh-keygen#Y, https://slsa.dev/spec/v1.0/,
// https://securitylab.github.com/resources/github-actions-preventing-pwn-requests/.

import { accountsFiles, d, f, password, path, player, type Accounts, type Directory, type Node, type Rights } from '../world';
import type { Translate } from '../../texts';
import type { Game, Shell } from '../shell';
import { newSystemd, type DefinitionService } from '../systemd';
import type { Process } from '../commands/system';
import { fingerprint, newCommit, type Commit, type Repo } from '../commands/git';
import { generateKey, publicFor } from '../access';
import { machineName } from '../machines';
import { authorizedEntries, forge, protectionFor, runWorkflows, verified, workflowFiles, type ForgeRepo, type ForgeState, type ForgeUser, type Protection, type Pull, type Run } from '../forge';
import { bareKey } from '../sshsig';

export const HOME = '/home/you';
export const PASSWORD = 'pegboard-47';
export const ANVIL = '192.0.2.80';
export const DOMAIN = 'forge.lendshed.example';
export const REPO = 'lendshed/lendshed';
export const REPOS_ROOT = '/var/lib/forgejo/data/forgejo-repositories';
export const BARE = `${REPOS_ROOT}/lendshed/lendshed.git`;
export const FORK_BARE = `${REPOS_ROOT}/kwame/lendshed.git`;
export const ORIGIN = `git@${DOMAIN}:${REPO}.git`;
export const AUTHORIZED = '/home/deploy/.ssh/authorized_keys';
export const DOWNLOADS = '/srv/www/downloads';
export const VERSION = '2.4.0';
export const TARBALL = `lendshed-${VERSION}.tar.gz`;
export const ATTACKER = '203.0.113.66';

export type ChapterNo = 1 | 2 | 3;

// Monday 4 November 2030 (chapter 1), Wednesday 13 November (chapter 2), Monday 25 November (chapter 3).
export const NOW = [Date.UTC(2030, 10, 4, 9, 0, 0), Date.UTC(2030, 10, 13, 14, 0, 0), Date.UTC(2030, 10, 25, 10, 0, 0)];
const BOOT = Date.UTC(2030, 9, 20, 6, 12, 0);
const GiB = 1024 ** 3;

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export function gitDate(ms: number): string {
  const x = new Date(ms);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${DAYS[x.getUTCDay()]} ${MONTHS[x.getUTCMonth()]} ${x.getUTCDate()} ${p(x.getUTCHours())}:${p(x.getUTCMinutes())}:${p(x.getUTCSeconds())} ${x.getUTCFullYear()} +0000`;
}

// ——— Keys (derived, never random) ———

export const KEYS = {
  you: generateKey('lendshed-you-anvil', 'you@anvil'),
  old: generateKey('lendshed-you-laptop-2027', 'you@old-laptop'),
  wanjiru: generateKey('lendshed-wanjiru', 'wanjiru@lendshed.example'),
  rosa: generateKey('lendshed-rosa', 'rosa@lendshed.example'),
  tomasz: generateKey('lendshed-tomasz', 'tomasz@laptop'),
  kwame: generateKey('lendshed-kwame', 'kwame@lendshed.example'),
  deploy: generateKey('lendshed-deploy-2029', 'ci-deploy@lendshed'),
};
export const OLD_DEPLOY_PUBLIC = publicFor(KEYS.deploy.isPrivate);
export const TOKENS = {
  you: fingerprint('lendshed-token-you-admin'),
  tomasz: fingerprint('lendshed-token-tomasz-release-script'),
  wanjiru: fingerprint('lendshed-token-wanjiru-cli'),
};
export const email = (t: Translate) => `${player(t)}@lendshed.example`;

export const anvilAccounts = (): Accounts => ({
  users: {
    root: { uid: 0, group: 'root', home: '/root' },
    'www-data': { uid: 33, group: 'www-data', home: '/var/www', shell: '/usr/sbin/nologin' },
    forgejo: { uid: 111, group: 'forgejo', home: '/var/lib/forgejo', shell: '/bin/bash' },
    'forgejo-runner': { uid: 112, group: 'forgejo-runner', home: '/var/lib/forgejo-runner', shell: '/usr/sbin/nologin' },
    you: { uid: 1000, group: 'you' },
    deploy: { uid: 1001, group: 'deploy', home: '/home/deploy' },
  },
  groups: {
    root: { gid: 0, members: [] },
    adm: { gid: 4, members: ['you'] },
    sudo: { gid: 27, members: ['you'] },
    'www-data': { gid: 33, members: [] },
    forgejo: { gid: 111, members: [] },
    'forgejo-runner': { gid: 112, members: [] },
    you: { gid: 1000, members: [] },
    deploy: { gid: 1001, members: [] },
  },
});

// ——— The project's history ———

const at = (y: number, mo: number, day: number, h: number, mi: number) => gitDate(Date.UTC(y, mo - 1, day, h, mi, 0));
const W = 'Wanjiru Kamau <wanjiru@lendshed.example>';
const R = 'Rosa Delgado <rosa@lendshed.example>';
const T = 'Tomasz Nowak <tomasz@lendshed.example>';
const K = 'Kwame Asante <kwame@lendshed.example>';

const README = `# Lendshed

Lending software for community tool libraries: a catalogue of tools, members,
loans and their calendar, late-return reminders.

    pip install -r requirements.txt
    flask --app lendshed run

Documentation: https://docs.lendshed.example/
Releases: https://downloads.lendshed.example/ (see VERIFYING.md once it exists)

Licence: AGPL-3.0-or-later.`;

const PY_APP = `from flask import Flask, render_template

from . import catalogue, loans

app = Flask(__name__)
app.register_blueprint(catalogue.bp)
app.register_blueprint(loans.bp)


@app.get("/")
def home():
    return render_template("home.html")`;
const PY_LOANS = `from datetime import date, timedelta

from flask import Blueprint

bp = Blueprint("loans", __name__, url_prefix="/loans")

LOAN_DAYS = 14


def due_date(start: date) -> date:
    return start + timedelta(days=LOAN_DAYS)`;
const PY_REMINDERS = `from datetime import date

from .loans import due_date


def late(loans, today: date):
    """The loans whose tool should be back by now."""
    return [l for l in loans if due_date(l.start) < today and not l.returned]`;
const PY_CATALOGUE = `from flask import Blueprint

bp = Blueprint("catalogue", __name__, url_prefix="/catalogue")`;
const TEST_LOANS = `from datetime import date

from lendshed.loans import due_date


def test_due_in_two_weeks():
    assert due_date(date(2030, 1, 1)) == date(2030, 1, 15)`;
const TEST_CATALOGUE = `def test_catalogue_blueprint():
    from lendshed.catalogue import bp
    assert bp.url_prefix == "/catalogue"`;
const MKDOCS = `site_name: Lendshed
site_url: https://docs.lendshed.example/
nav:
  - Home: index.md
  - Installing: install.md`;

/** The vulnerable workflow Tomasz wrote in February: pull_request_target, the fork's code, the key everywhere, printed in base64. */
export const OLD_WORKFLOW = `name: ci

on:
  push:
    branches: [main]
  pull_request_target:

# The deploy key, for every job (the tests of scripts/deploy.sh need it).
env:
  DEPLOY_KEY: \${{ secrets.DEPLOY_KEY }}

jobs:
  test:
    runs-on: docker
    steps:
      - uses: actions/checkout@v4
        with:
          ref: \${{ github.event.pull_request.head.sha }}
      - name: Show deploy configuration
        run: echo "$DEPLOY_KEY" | base64 -w0
      - run: pip install -r requirements.txt
      - run: python -m pytest

  deploy:
    if: github.ref == 'refs/heads/main'
    needs: test
    runs-on: docker
    steps:
      - uses: actions/checkout@v4
      - run: pip install -r requirements.txt
      - run: mkdocs build
      - name: Publish the documentation
        run: |
          mkdir -p ~/.ssh
          echo "$DEPLOY_KEY" > ~/.ssh/deploy_key
          chmod 600 ~/.ssh/deploy_key
          rsync -a --delete -e "ssh -i ~/.ssh/deploy_key -o StrictHostKeyChecking=accept-new" site/ deploy@anvil.internal:/srv/www/docs/`;

/** A safe workflow, as chapter 2's solution writes it (and chapter 3 starts with). */
export const SAFE_WORKFLOW = `name: ci

on:
  push:
    branches: [main]
  pull_request:

jobs:
  test:
    runs-on: docker
    steps:
      - uses: actions/checkout@v4
      - run: pip install -r requirements.txt
      - run: python -m pytest

  deploy:
    if: github.event_name == 'push' && github.ref == 'refs/heads/main'
    needs: test
    runs-on: docker
    steps:
      - uses: actions/checkout@v4
      - run: pip install -r requirements.txt
      - run: mkdocs build
      - name: Publish the documentation
        env:
          DEPLOY_KEY: \${{ secrets.DEPLOY_KEY }}
        run: |
          mkdir -p ~/.ssh
          echo "$DEPLOY_KEY" > ~/.ssh/deploy_key
          chmod 600 ~/.ssh/deploy_key
          rsync -a --delete -e "ssh -i ~/.ssh/deploy_key -o StrictHostKeyChecking=accept-new" site/ deploy@anvil.internal:/srv/www/docs/`;

const base = (version: string, extra: Record<string, string> = {}): Record<string, string> => ({
  'README.md': README,
  LICENSE: 'GNU AFFERO GENERAL PUBLIC LICENSE\n                       Version 3, 19 November 2007',
  'requirements.txt': 'flask==3.1.0\nmkdocs==1.6.1\npytest==8.3.4',
  'mkdocs.yml': MKDOCS,
  'docs/index.md': '# Lendshed\n\nLending software for community tool libraries.',
  'docs/install.md': '# Installing\n\nDownload a release, check it, unpack it.',
  'lendshed/__init__.py': `__version__ = "${version}"`,
  'lendshed/app.py': PY_APP,
  'lendshed/loans.py': PY_LOANS,
  'lendshed/catalogue.py': PY_CATALOGUE,
  'tests/test_loans.py': TEST_LOANS,
  'tests/test_catalogue.py': TEST_CATALOGUE,
  'MAINTAINERS.md': '# Maintainers\n\n- Wanjiru Kamau (wanjiru)\n- Rosa Delgado (rosa)\n\nEmeritus: Tomasz Nowak (tomasz), until March 2030.',
  'CHANGELOG.md': `# Changelog\n\n## ${version}\n\n- See the commits.`,
  ...extra,
});

/** main's history, and the commit pushed with Tomasz's token on 14 October. */
export function history() {
  const c1 = newCommit(null, 'Import Lendshed 1.0', W, at(2028, 3, 2, 10, 4), base('1.0.0'));
  const c2 = newCommit(c1, 'Add the loans calendar', T, at(2029, 5, 17, 21, 40), base('2.0.0'));
  const c3 = newCommit(c2, 'Add a CI workflow: tests, and the documentation published from main', T, at(2030, 2, 11, 19, 2), base('2.2.0', { '.forgejo/workflows/ci.yml': OLD_WORKFLOW }));
  const c4 = newCommit(c3, 'Release 2.3.0', W, at(2030, 9, 20, 18, 30), base('2.3.0', { '.forgejo/workflows/ci.yml': OLD_WORKFLOW }));
  const c5 = newCommit(c4, 'Add late-return reminders', R, at(2030, 10, 9, 20, 12), base('2.3.0', { '.forgejo/workflows/ci.yml': OLD_WORKFLOW, 'lendshed/reminders.py': PY_REMINDERS }));
  const c6 = newCommit(c5, 'Fix the barcode scanner on Firefox', R, at(2030, 10, 11, 17, 45), base('2.3.0', { '.forgejo/workflows/ci.yml': OLD_WORKFLOW, 'lendshed/reminders.py': PY_REMINDERS, 'lendshed/static/scanner.js': '// barcode scanner (QuaggaJS): facingMode environment, Firefox fallback' }));
  // The intruder's commit: on top of 2.3.0, without Rosa's two commits, a typosquatted dependency.
  const bad = newCommit(c4, 'Update dependencies', T, at(2030, 10, 14, 2, 13), base('2.3.0', { '.forgejo/workflows/ci.yml': OLD_WORKFLOW, 'requirements.txt': 'flask==3.1.0\nmkdocs==1.6.1\npytest==8.3.4\nrequets==2.32.3' }));
  const c7 = newCommit(c6, 'Document the opening hours widget', R, at(2030, 10, 28, 19, 20), { ...c6.files, 'docs/opening-hours.md': '# Opening hours\n\nThe widget reads the library\'s hours from the settings page.' });
  return { c1, c2, c3, c4, c5, c6, bad, c7 };
}

// Chapter 2 starts once the history is clean: main is c7. Chapter 3: chapter 2's fix is in.
export function fixCommit(t: Translate) {
  const h = history();
  return newCommit(h.c7, 'CI: test pull requests without secrets, deploy from main only', `${player(t)} <${email(t)}>`, at(2030, 11, 14, 10, 2), { ...h.c7.files, '.forgejo/workflows/ci.yml': SAFE_WORKFLOW });
}
// Kwame's pull request: his Swahili translation on top of main.
export const KWAME_FILE = 'lendshed/locale/sw/LC_MESSAGES/messages.po';
export const kwameCommit = (on: Commit, date = at(2030, 11, 1, 16, 30)) =>
  newCommit(on, 'Translate the catalogue to Swahili', K, date, { ...on.files, [KWAME_FILE]: 'msgid "Borrow"\nmsgstr "Azima"\n\nmsgid "Return"\nmsgstr "Rudisha"' });

const reflog = (entries: [Commit, string][]) => entries.map(([c, date]) => ({ id: c.id, message: 'push', date }));

// ——— The forge ———

const user = (id: number, login: string, fullName: string, mail: string, created: number, o: Partial<ForgeUser> = {}): ForgeUser => ({
  id,
  login,
  fullName,
  email: mail,
  admin: false,
  active: true,
  prohibitLogin: false,
  password: fingerprint(`password-${login}`),
  created,
  lastLogin: created,
  keys: [],
  ...o,
});

export function protection(o: Partial<Protection>, when: number): Protection {
  return { rule: 'main', enablePush: false, enablePushWhitelist: false, pushWhitelist: [], requiredApprovals: 0, enableStatusCheck: false, statusCheckContexts: [], requireSigned: false, blockOnRejected: false, dismissStale: false, applyToAdmins: false, created: when, updated: when, ...o };
}

export function forgeState(t: Translate, n: ChapterNo): ForgeState {
  const me = player(t);
  const created = Date.UTC(2028, 2, 1, 9, 0, 0);
  const users: Record<string, ForgeUser> = {
    wanjiru: user(1, 'wanjiru', 'Wanjiru Kamau', 'wanjiru@lendshed.example', created, { admin: true, keys: [KEYS.wanjiru.isPublic], lastLogin: NOW[n - 1] - 86_400_000 }),
    rosa: user(2, 'rosa', 'Rosa Delgado', 'rosa@lendshed.example', created + 3_000_000_000, { keys: [KEYS.rosa.isPublic], lastLogin: NOW[n - 1] - 3 * 86_400_000 }),
    tomasz: user(3, 'tomasz', 'Tomasz Nowak', 'tomasz@lendshed.example', created + 40_000_000_000, { keys: [KEYS.tomasz.isPublic], lastLogin: Date.UTC(2030, 2, 28, 18, 0, 0) }),
    kwame: user(5, 'kwame', 'Kwame Asante', 'kwame@lendshed.example', Date.UTC(2030, 8, 2, 12, 0, 0), { keys: [KEYS.kwame.isPublic] }),
    [me]: user(6, me, '', email(t), Date.UTC(2030, 9, 30, 9, 0, 0), { admin: true, password: password(t, PASSWORD), keys: [KEYS.you.isPublic.replace('you@anvil', email(t))], lastLogin: NOW[n - 1] - 3_600_000 }),
  };
  const repo: ForgeRepo = {
    id: 1,
    owner: 'lendshed',
    name: 'lendshed',
    path: BARE,
    private: false,
    description: 'Lending software for community tool libraries',
    collaborators: n === 1 ? { tomasz: 'write' } : {},
    team: ['wanjiru', 'rosa', me],
    protections:
      n === 1
        ? []
        : [
            protection(
              { enablePush: true, enablePushWhitelist: true, pushWhitelist: ['wanjiru', 'rosa', me], requiredApprovals: 1, enableStatusCheck: true, statusCheckContexts: [n === 2 ? 'ci / test (pull_request_target)' : 'ci / test (pull_request)'] },
              Date.UTC(2030, 10, 4, 10, 30, 0),
            ),
          ],
    secrets: { DEPLOY_KEY: { value: `${KEYS.deploy.isPrivate}\n`, created: Date.UTC(2030, 1, 11, 19, 0, 0) } },
    runs: [],
    pulls: [],
    statuses: {},
  };
  const fork: ForgeRepo = { id: 2, owner: 'kwame', name: 'lendshed', path: FORK_BARE, private: false, description: 'Lending software for community tool libraries', fork: REPO, collaborators: {}, team: [], protections: [], secrets: {}, runs: [], pulls: [], statuses: {} };
  if (n === 3) {
    const newKey = generateKey('lendshed-deploy-2030-11', 'ci-deploy@lendshed');
    repo.secrets.DEPLOY_KEY = { value: `${newKey.isPrivate}\n`, created: Date.UTC(2030, 1, 11, 19, 0, 0) };
  }
  return {
    domain: DOMAIN,
    users,
    orgs: ['lendshed'],
    tokens: [
      { id: 1, name: 'cli', owner: 'wanjiru', value: TOKENS.wanjiru, scopes: ['write:repository', 'read:user'], created: created + 100_000_000 },
      ...(n === 1 ? [{ id: 3, name: 'release-script', owner: 'tomasz', value: TOKENS.tomasz, scopes: ['all'], created: Date.UTC(2029, 4, 2, 20, 0, 0) }] : []),
      { id: 7, name: 'admin', owner: me, value: TOKENS.you, scopes: ['write:admin', 'write:repository', 'write:user'], created: Date.UTC(2030, 9, 30, 9, 5, 0) },
    ],
    repos: {
      [REPO]: repo,
      'kwame/lendshed': fork,
      // Tomasz's own repository: his release scripts (why Forgejo won't delete his account without --purge).
      'tomasz/release-tools': { id: 3, owner: 'tomasz', name: 'release-tools', path: `${REPOS_ROOT}/tomasz/release-tools.git`, private: false, description: 'Scripts I use to cut Lendshed releases', collaborators: {}, team: [], protections: [], secrets: {}, runs: [], pulls: [], statuses: {} },
    },
    pusher: me,
    nextId: 400,
    rejections: [],
    purged: [],
    runnerService: 'forgejo-runner',
    deploy: { hosts: ['anvil.internal', ANVIL, 'anvil', `${machineName(t, 'anvil')}.internal`], user: 'deploy', authorizedKeys: AUTHORIZED, dir: '/srv/www/docs', from: ANVIL },
  };
}

/** The repositories git knows on anvil (the forge's bare ones, and your working copy). */
export function gitRepos(t: Translate, n: ChapterNo): Record<string, Repo> {
  const h = history();
  const fix = fixCommit(t);
  const head = n === 3 ? fix : h.c7;
  const main = [h.c1, h.c2, h.c3, h.c4, h.c5, h.c6, h.c7, ...(n === 3 ? [fix] : [])];
  const kwame = kwameCommit(h.c7);
  const reflogBare = reflog([
    [h.c4, at(2030, 9, 20, 18, 31)],
    [h.c5, at(2030, 10, 9, 20, 13)],
    [h.c6, at(2030, 10, 11, 17, 46)],
    [h.bad, at(2030, 10, 14, 2, 13)],
    [h.c6, at(2030, 10, 16, 8, 57)],
    [h.c7, at(2030, 10, 28, 19, 21)],
    ...(n === 3 ? ([[fix, at(2030, 11, 14, 10, 3)]] as [Commit, string][]) : []),
  ]);
  const work = path(t, `${HOME}/lendshed`);
  return {
    [BARE]: { commits: [...main], index: {}, bare: true, deep: true, logAllRefUpdates: true, reflog: reflogBare, objects: [h.bad], tags: { 'v2.3.0': { commit: h.c4.id, annotated: true, message: 'Lendshed 2.3.0', tagger: W, date: at(2030, 9, 20, 18, 30) } } },
    [FORK_BARE]: { commits: [...main.slice(0, 7), kwame], index: {}, bare: true, deep: true },
    [work]: {
      commits: [...main],
      index: { ...head.files },
      deep: true,
      remotes: { origin: ORIGIN },
      reflog: [{ id: head.id, message: `clone: from ${ORIGIN}`, date: gitDate(NOW[n - 1] - 3_600_000) }],
      tags: { 'v2.3.0': { commit: h.c4.id, annotated: true, message: 'Lendshed 2.3.0', tagger: W, date: at(2030, 9, 20, 18, 30) } },
    },
  };
}

// ——— The machine ———

const proc = (pid: number, owner: string, command: string): Process => ({ pid, user: owner, cpu: 0, mem: 0.6, command });

export function anvilState(t: Translate, n: ChapterNo) {
  const services: Record<string, DefinitionService> = {
    ssh: { description: 'OpenBSD Secure Shell server', active: true, executable: 'sshd', process: [proc(702, 'root', 'sshd: /usr/sbin/sshd -D [listener] 0 of 10-100 startups')] },
    nginx: { description: 'A high performance web server and a reverse proxy server', active: true, executable: 'nginx', process: [proc(811, 'root', 'nginx: master process /usr/sbin/nginx -g daemon on; master_process on;')] },
    forgejo: { description: 'Forgejo (Beyond coding. We forge.)', active: true, executable: 'forgejo', process: [proc(880, 'forgejo', '/usr/local/bin/forgejo web --config /etc/forgejo/app.ini')] },
    'forgejo-runner': { description: 'Forgejo Runner', active: true, executable: 'forgejo-runner', process: [proc(902, 'forgejo-runner', '/usr/local/bin/forgejo-runner daemon --config /etc/forgejo-runner/config.yml')] },
    cron: { description: 'Regular background program processing daemon', active: true, executable: 'cron', process: [proc(540, 'root', '/usr/sbin/cron -f')] },
  };
  return {
    systemd: newSystemd(machineName(t, 'anvil'), BOOT, NOW[n - 1], services),
    process: [proc(1, 'root', '/sbin/init'), ...Object.values(services).flatMap((x) => x.process ?? [])],
    mounts: [{ path: '/', capacity: 39 * GiB, name: '/dev/vda1', system: 'ext4', bytesBase: 6.1 * GiB }],
    listening: [
      { proto: 'tcp', address: '0.0.0.0', port: 22, process: 'sshd', pid: 702 },
      { proto: 'tcp', address: '0.0.0.0', port: 80, process: 'nginx', pid: 811 },
      { proto: 'tcp', address: '0.0.0.0', port: 443, process: 'nginx', pid: 811 },
      { proto: 'tcp', address: '127.0.0.1', port: 3000, process: 'forgejo', pid: 880 },
    ],
    forge: forgeState(t, n),
    git: gitRepos(t, n),
    gitClock: true,
    chapter: n,
  };
}

// ——— Files ———

const root: Rights = { owner: 'root' };
const conf = (text: string, rights: Rights = root) => f(text, { lines: true, ...rights });

export const APP_INI = `APP_NAME = Lendshed forge
RUN_USER = forgejo
WORK_PATH = /var/lib/forgejo
RUN_MODE = prod

[database]
DB_TYPE = sqlite3
PATH = /var/lib/forgejo/data/forgejo.db

[repository]
ROOT = ${REPOS_ROOT}

[server]
SSH_DOMAIN = ${DOMAIN}
DOMAIN = ${DOMAIN}
HTTP_ADDR = 127.0.0.1
HTTP_PORT = 3000
ROOT_URL = https://${DOMAIN}/
DISABLE_SSH = false
SSH_PORT = 22
LFS_START_SERVER = true

[service]
DISABLE_REGISTRATION = true
REQUIRE_SIGNIN_VIEW = false

[actions]
ENABLED = true
DEFAULT_ACTIONS_URL = https://data.forgejo.org

[log]
MODE = file
LEVEL = info
ROOT_PATH = /var/lib/forgejo/log

[security]
INSTALL_LOCK = true
SECRET_KEY = ${fingerprint('lendshed-secret-key')}
INTERNAL_TOKEN = eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.${fingerprint('lendshed-internal')}`;

export const RUNNER_CONFIG = `# forgejo-runner generate-config, then:
log:
  level: info
runner:
  file: /var/lib/forgejo-runner/.runner
  capacity: 1
  timeout: 3h
  labels:
    - "docker:docker://node:20-bookworm"
container:
  network: ""
  privileged: false
  valid_volumes: []`;

const PRE_RECEIVE = `#!/usr/bin/env bash
# AUTO GENERATED BY GITEA, DO NOT MODIFY
data=$(cat)
exitcodes=""
hookname=$(basename $0)
GIT_DIR=\${GIT_DIR:-$(dirname $0)/..}

for hook in \${GIT_DIR}/hooks/\${hookname}.d/*; do
  test -x "\${hook}" && test -f "\${hook}" || continue
  echo "\${data}" | "\${hook}"
  exitcodes="\${exitcodes} $?"
done`;

/** Forgejo's log: the requests of the night of 14 October, then routine. */
function forgejoLog(n: ChapterNo): string {
  const lines = [
    `2030/10/11 17:46:02 ...eb/routing/logger.go:102:func1() [I] router: completed POST /lendshed/lendshed.git/git-receive-pack for 198.51.100.41:52110, 200 OK in 388.2ms @ repo/githttp.go:532(repo.ServiceReceivePack)`,
    `2030/10/14 02:12:51 ...eb/routing/logger.go:102:func1() [I] router: completed GET /api/v1/user for ${ATTACKER}:48120, 200 OK in 6.1ms @ user/user.go:139(user.GetAuthenticatedUser)`,
    `2030/10/14 02:12:58 ...eb/routing/logger.go:102:func1() [I] router: completed GET /lendshed/lendshed.git/info/refs?service=git-upload-pack for ${ATTACKER}:48122, 200 OK in 31.0ms @ repo/githttp.go:532(repo.GetInfoRefs)`,
    `2030/10/14 02:13:44 ...eb/routing/logger.go:102:func1() [I] router: completed POST /lendshed/lendshed.git/git-receive-pack for ${ATTACKER}:48131, 200 OK in 412.3ms @ repo/githttp.go:532(repo.ServiceReceivePack)`,
    `2030/10/14 02:13:45 ...ces/repository/push.go:117:pushUpdates() [I] Force push to lendshed/lendshed:main by tomasz`,
    `2030/10/16 08:57:30 ...eb/routing/logger.go:102:func1() [I] router: completed POST /lendshed/lendshed.git/git-receive-pack for 198.51.100.41:50117, 200 OK in 402.0ms @ repo/githttp.go:532(repo.ServiceReceivePack)`,
    `2030/10/16 08:57:31 ...ces/repository/push.go:117:pushUpdates() [I] Force push to lendshed/lendshed:main by rosa`,
    `2030/10/28 19:21:12 ...eb/routing/logger.go:102:func1() [I] router: completed POST /lendshed/lendshed.git/git-receive-pack for 198.51.100.41:51871, 200 OK in 377.9ms @ repo/githttp.go:532(repo.ServiceReceivePack)`,
  ];
  if (n === 1) lines.push(`2030/11/03 23:40:07 ...eb/routing/logger.go:102:func1() [I] router: completed GET /api/v1/repos/lendshed/lendshed for ${ATTACKER}:40017, 200 OK in 4.8ms @ repo/repo.go:574(repo.Get)`);
  return lines.join('\n');
}

/** A directory tree from a map of paths (the repository's files, as git checks them out). */
export function tree(files: Record<string, string>, rights: Rights): Directory {
  const top = d({}, undefined, rights);
  for (const [p, text] of Object.entries(files)) {
    const parts = p.split('/');
    let dir = top;
    for (const part of parts.slice(0, -1)) dir = (dir.children[part] ??= d({}, undefined, rights)) as Directory;
    dir.children[parts.at(-1)!] = f(text, { lines: true, ...rights });
  }
  return top;
}

function bareDir(rights: Rights, extra: Record<string, Node> = {}): Directory {
  return d(
    {
      HEAD: f('ref: refs/heads/main', { lines: true, ...rights }),
      config: f('[core]\n\trepositoryformatversion = 0\n\tfilemode = true\n\tbare = true\n\tlogallrefupdates = true', { lines: true, ...rights }),
      description: f("Unnamed repository; edit this file 'description' to name the repository.", { lines: true, ...rights }),
      hooks: d({ 'pre-receive': f(PRE_RECEIVE, { lines: true, ...rights, mode: 'rwxr-xr-x' }), 'pre-receive.d': d({ gitea: f('#!/usr/bin/env bash\n/usr/local/bin/forgejo hook --config=/etc/forgejo/app.ini pre-receive', { lines: true, ...rights, mode: 'rwxr-xr-x' }) }, undefined, rights) }, undefined, rights),
      objects: d({ info: d({}, undefined, rights), pack: d({}, undefined, rights) }, undefined, rights),
      refs: d({ heads: d({ main: f('', rights) }, undefined, rights), tags: d({}, undefined, rights) }, undefined, rights),
      logs: d({ HEAD: f('', rights), refs: d({ heads: d({ main: f('', rights) }, undefined, rights) }, undefined, rights) }, undefined, rights),
      ...extra,
    },
    undefined,
    rights,
  );
}

export function anvilWorld(t: Translate, n: ChapterNo, welcome: Record<string, string>): Directory {
  const me: Rights = { owner: 'you' };
  const fj: Rights = { owner: 'forgejo', group: 'forgejo', mode: 'rwxr-x---' };
  const h = history();
  const head = n === 3 ? fixCommit(t) : h.c7;
  const authorized = n === 3 ? `restrict,from="${ANVIL}",command="rrsync /srv/www/docs" ${publicFor(generateKey('lendshed-deploy-2030-11', 'ci-deploy@lendshed').isPrivate)} ci-deploy@lendshed` : `${OLD_DEPLOY_PUBLIC} ci-deploy@lendshed`;
  const work = tree(head.files, me);
  work.children['.git'] = d(
    {
      HEAD: f('ref: refs/heads/main', { lines: true, ...me }),
      config: f(`[core]\n\trepositoryformatversion = 0\n\tfilemode = true\n\tbare = false\n\tlogallrefupdates = true\n[remote "origin"]\n\turl = ${ORIGIN}\n\tfetch = +refs/heads/*:refs/remotes/origin/*\n[branch "main"]\n\tremote = origin\n\tmerge = refs/heads/main`, { lines: true, ...me }),
    },
    undefined,
    me,
  );
  return d(
    {
      etc: d(
        {
          ...accountsFiles(),
          hostname: conf('anvil'),
          hosts: conf(`127.0.0.1\tlocalhost\n${ANVIL}\tanvil anvil.internal ${DOMAIN} docs.lendshed.example downloads.lendshed.example`),
          forgejo: d({ 'app.ini': f(APP_INI, { lines: true, owner: 'root', group: 'forgejo', mode: 'rw-r-----' }) }, undefined, { owner: 'root', group: 'forgejo', mode: 'rwxr-x---' }),
          'forgejo-runner': d({ 'config.yml': conf(RUNNER_CONFIG, { owner: 'root', group: 'forgejo-runner', mode: 'rw-r-----' }) }, undefined, { owner: 'root', group: 'forgejo-runner', mode: 'rwxr-x---' }),
          nginx: d({ 'sites-enabled': d({ forge: conf(`server {\n    listen 443 ssl;\n    server_name ${DOMAIN};\n    location / {\n        proxy_pass http://127.0.0.1:3000;\n        client_max_body_size 512M;\n    }\n}`) }, undefined, root) }, undefined, root),
        },
        undefined,
        root,
      ),
      var: d(
        {
          lib: d(
            {
              forgejo: d(
                {
                  data: d({ 'forgejo-repositories': d({ lendshed: d({ 'lendshed.git': bareDir(fj) }, undefined, fj), kwame: d({ 'lendshed.git': bareDir(fj) }, undefined, fj) }, undefined, fj), 'forgejo.db': f('', { ...fj, mode: 'rw-------', size: 9_437_184 }) }, undefined, fj),
                  log: d({ 'forgejo.log': f(forgejoLog(n), { lines: true, ...fj, mode: 'rw-r-----' }) }, undefined, fj),
                  custom: d({}, undefined, fj),
                },
                undefined,
                fj,
              ),
              'forgejo-runner': d({ '.runner': f(`{\n  "WARNING": "This file is automatically generated by act-runner. Do not edit it manually unless you know what you are doing. Removing this file will cause act runner to re-register as a new runner.",\n  "id": 1,\n  "uuid": "6f1d3a2c-1b7e-4c0e-9a51-${fingerprint('runner').slice(0, 12)}",\n  "name": "anvil",\n  "token": "${fingerprint('runner-token')}",\n  "address": "https://${DOMAIN}",\n  "labels": ["docker:docker://node:20-bookworm"]\n}`, { lines: true, owner: 'forgejo-runner', mode: 'rw-------' }) }, undefined, { owner: 'forgejo-runner', mode: 'rwx------' }),
            },
            undefined,
            root,
          ),
          log: d({}, undefined, root),
        },
        undefined,
        root,
      ),
      srv: d(
        {
          www: d(
            {
              docs: d({ 'index.html': f('<!doctype html><title>Lendshed</title>', { lines: true, owner: 'deploy' }) }, undefined, { owner: 'deploy' }),
              downloads: d(
                {
                  'lendshed-2.3.0.tar.gz': f('', { owner: 'you', size: 182_514 }),
                  'lendshed-2.3.0.tar.gz.sha256': f(`${fingerprint('lendshed-2.3.0').slice(0, 32)}${fingerprint('lendshed-2.3.0b').slice(0, 32)}  lendshed-2.3.0.tar.gz`, { lines: true, owner: 'you' }),
                },
                undefined,
                { owner: 'you', mode: 'rwxr-xr-x' },
              ),
            },
            undefined,
            root,
          ),
        },
        undefined,
        root,
      ),
      home: d(
        {
          you: d(
            {
              ...Object.fromEntries(Object.entries(welcome).map(([k, v]) => [k, f(v)])),
              '.forgejo-token': f(TOKENS.you, { lines: true, owner: 'you', mode: 'rw-------' }),
              '.gitconfig': f(`[user]\n\tname = ${player(t)}\n\temail = ${email(t)}\n[init]\n\tdefaultBranch = main`, { lines: true, owner: 'you' }),
              '.ssh': d(
                {
                  id_ed25519: f(KEYS.you.isPrivate, { lines: true, owner: 'you', mode: 'rw-------' }),
                  'id_ed25519.pub': f(KEYS.you.isPublic.replace('you@anvil', `${email(t)}`), { lines: true, owner: 'you', mode: 'rw-r--r--' }),
                  old_ed25519: f(KEYS.old.isPrivate, { lines: true, owner: 'you', mode: 'rw-------' }),
                  'old_ed25519.pub': f(KEYS.old.isPublic, { lines: true, owner: 'you', mode: 'rw-r--r--' }),
                },
                undefined,
                { owner: 'you', mode: 'rwx------' },
              ),
              lendshed: work,
            },
            undefined,
            me,
          ),
          deploy: d({ '.ssh': d({ authorized_keys: f(authorized, { lines: true, owner: 'deploy', mode: 'rw-------' }) }, undefined, { owner: 'deploy', mode: 'rwx------' }) }, undefined, { owner: 'deploy', mode: 'rwxr-x---' }),
        },
        undefined,
        root,
      ),
      root: d({}, undefined, { owner: 'root', mode: 'rwx------' }),
      tmp: d({}, undefined, { owner: 'root', mode: 'rwxrwxrwt' }),
      usr: d({ bin: d({ rrsync: f('#!/usr/bin/perl\n# rrsync: restricted rsync, for authorized_keys command=', { lines: true, owner: 'root', mode: 'rwxr-xr-x' }) }, undefined, root) }, undefined, root),
    },
    undefined,
    root,
  );
}

// ——— Helpers for the chapters ———

export const fs = (j: Game) => forge(j as Shell)!;
export const repo = (j: Game) => fs(j).repos[REPO];
export const bare = (j: Game) => (j as Shell).state.git?.[BARE] as Repo;
export const mainHead = (j: Game) => bare(j)?.commits.at(-1);
export const seen = (j: Game, text: string | RegExp) => {
  const all = `${j.last.output}\n${j.last.errors.join('\n')}`;
  return typeof text === 'string' ? all.includes(text) : text.test(all);
};
export const typed = (j: Game) => (j as Shell).last.line ?? '';
export const me = (j: Game) => (j as Shell).player;
export const myEmail = (j: Game) => `${me(j)}@lendshed.example`;

/** The known status contexts (what the forge's CI reported), for checking a protection's list. */
export const contexts = (j: Game) => [...new Set(Object.values(repo(j).statuses).flat().map((s) => s.context))];
const glob = (pattern: string, value: string) => new RegExp(`^${pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\?/g, '.')}$`).test(value);
/** The contexts a pull request's run reports now (the latest runs on a pull request). */
export function pullContexts(j: Game): string[] {
  const r = repo(j);
  const latest = latestPullRuns(j);
  return latest.flatMap((run) => run.jobs.filter((x) => x.status !== 'skipped').map((x) => `${run.name} / ${x.name} (${run.event})`)).filter((c) => Object.values(r.statuses).flat().some((s) => s.context === c));
}
export const contextOk = (p: Protection | null, known: string[]) => !!p && p.enableStatusCheck && p.statusCheckContexts.length > 0 && p.statusCheckContexts.every((c) => known.some((k) => glob(c, k)));

/** The runs of the latest event on Kwame's pull request. */
export function latestPullRuns(j: Game): Run[] {
  const runs = repo(j).runs.filter((x) => x.pull);
  const last = runs.at(-1);
  return last ? runs.filter((x) => x.sha === last.sha && x.created === last.created) : [];
}

/** Kwame updates his pull request on top of main: pull_request and pull_request_target run. */
export function kwameSync(j: Game): Run[] {
  const s = j as Shell;
  const f = fs(j);
  const head = mainHead(j)!;
  const pr = repo(j).pulls.find((x) => x.number === 57);
  if (!pr) return [];
  const sd = s.state.systemd;
  const commit = kwameCommit(head, gitDate(sd.clock));
  pr.head = commit;
  const fork = s.state.git[FORK_BARE] as Repo;
  fork.commits = [...bare(j).commits, commit];
  const runs = [
    ...runWorkflows(s, REPO, { name: 'pull_request', ref: `refs/pull/57/head`, sha: commit.id, actor: 'kwame', commit, pull: pr }),
    ...runWorkflows(s, REPO, { name: 'pull_request_target', ref: 'refs/heads/main', sha: head.id, actor: 'kwame', commit: head, pull: pr }),
  ];
  f.nextId++;
  return runs;
}

/** The forge's past at the start of a chapter: the runs of main's pushes and of Kwame's pull request. */
export function initialiseAnvil(j: Game) {
  const s = j as Shell;
  const n = s.state.chapter as ChapterNo;
  const sd = s.state.systemd;
  const now = sd.clock;
  const h = history();
  const r = repo(j);
  const back = (ms: number) => (sd.clock = ms);
  back(Date.UTC(2030, 9, 28, 19, 21, 30));
  runWorkflows(s, REPO, { name: 'push', ref: 'refs/heads/main', sha: h.c7.id, actor: 'rosa', commit: h.c7 });
  const pr: Pull = { number: 57, title: 'Translate the catalogue to Swahili', user: 'kwame', headRepo: 'kwame/lendshed', headRef: 'swahili', head: kwameCommit(h.c7), base: 'main', state: 'open', created: Date.UTC(2030, 10, 1, 16, 31, 0) };
  r.pulls.push(pr);
  back(pr.created);
  runWorkflows(s, REPO, { name: 'pull_request_target', ref: 'refs/heads/main', sha: h.c7.id, actor: 'kwame', commit: h.c7, pull: pr });
  if (n === 3) {
    const fix = fixCommit(s.t);
    back(Date.UTC(2030, 10, 14, 10, 3, 30));
    runWorkflows(s, REPO, { name: 'push', ref: 'refs/heads/main', sha: fix.id, actor: player(s.t), commit: fix });
    back(Date.UTC(2030, 10, 14, 11, 0, 0));
    kwameSync(j);
  }
  back(now);
  s.state.startHead = mainHead(j)!.id;
  s.state.seenHead = mainHead(j)!.id;
}

/** Each command, half a minute passes. */
export function passTime(j: Game) {
  (j as Shell).state.systemd.clock += 30_000;
}

/** The deploy account's keys: the old one still there? a new, restricted one? */
export function deployKeys(j: Game) {
  return authorizedEntries(j.read(AUTHORIZED) ?? '');
}
export const oldKeyGone = (j: Game) => !deployKeys(j).some((e) => e.key === OLD_DEPLOY_PUBLIC);
export const restricted = (e: { restrict: boolean; command?: string; from?: string }) => e.restrict || !!e.command || !!e.from;
/** The secret's key, if it is a private key the deploy account knows (not the old one). */
export function secretKey(j: Game): string | null {
  const v = repo(j).secrets.DEPLOY_KEY?.value;
  if (!v || !v.includes('-----BEGIN OPENSSH PRIVATE KEY-----')) return null;
  const pub = publicFor(v.trim());
  return pub !== OLD_DEPLOY_PUBLIC && deployKeys(j).some((e) => e.key === pub) ? pub : null;
}

export { bareKey, protectionFor, verified, workflowFiles };
