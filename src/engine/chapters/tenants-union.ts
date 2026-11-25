// Story "The Tenants' Union": what its chapters share. The Larkspur
// Tenants' Union (the same name in every language) helps the tenants of an
// estate get repairs done: Repairline, its small web app, takes their
// requests (a leak, a boiler, damp) and the union chases the landlord.
// latch (pestillo in Spanish, loquet in French; 192.0.2.196, RFC 5737)
// runs it: the app's code in /srv/repairline, a git working copy shared by
// the volunteers (group union) and pushed to /srv/git/repairline.git, the
// copy the volunteers clone; the app reads /etc/repairline/env at start,
// written by deploy.sh; its database is PostgreSQL's repairline role.
// Taslima is the union's secretary, Makoa the volunteer who wrote most of
// the code (he leaves in chapter 2), Ikenna the new volunteer.
// Chapter 1: the .env, with the database password, was committed in clear
// and the repository spent three days on a public forge by mistake:
// encrypt it with sops and age (the server's deploy key and your own),
// a .sops.yaml rule for the next files, the password rotated, deploy.sh
// decrypting at deploy time, commit and push. Chapter 2: Ikenna's key in,
// Makoa's out (updatekeys), a new data key (rotate) and a new password.
// Sources: https://getsops.io/docs/, https://age-encryption.org/v1,
// https://github.com/FiloSottile/age (age-keygen(1)),
// https://www.postgresql.org/docs/current/sql-alterrole.html,
// https://git-scm.com/docs/gitignore.

import { accountsFiles, d, f, player, type Accounts, type Directory, type Node, type Rights } from '../world';
import type { Game, Shell } from '../shell';
import type { Translate } from '../../texts';
import { newSystemd, systemd, type DefinitionService } from '../systemd';
import { machineName } from '../machines';
import { newCommit, type Commit, type Repo } from '../commands/git';
import type { PostgresState } from '../postgres';
import { ageKey, decryptFile, emitDotenv, encryptFile, identityFile, isSopsFile, openFile, parseIdentities, readDotenv, readSopsConfig, ruleFor, type AgeKey, type Item } from '../sops';

export const HOME = '/home/you';
export const PASSWORD = 'mind-the-damp-24';
export const IP = '192.0.2.196';
export const REPO = '/srv/repairline';
export const ORIGIN = '/srv/git/repairline.git';
export const ENV_FILE = '/etc/repairline/env';
export const DEPLOY_KEY = '/etc/repairline/age.key';
export const DOMAIN = 'larkspur-tenants.example';

export type ChapterNo = 1 | 2;
// Local time read as UTC: Tuesday 8 March 2033, 19:05; Tuesday 26 April 2033, 18:40.
export const NOW: Record<ChapterNo, number> = { 1: Date.UTC(2033, 2, 8, 19, 5, 0), 2: Date.UTC(2033, 3, 26, 18, 40, 0) };
const BOOT: Record<ChapterNo, number> = { 1: Date.UTC(2033, 1, 20, 6, 58, 0), 2: Date.UTC(2033, 3, 2, 7, 3, 0) };

// The age keys: the server's (its deploy key), Makoa's, Ikenna's, and the
// player's own in chapter 2 (made in chapter 1).
export const LATCH: AgeKey = ageKey('latch:deploy');
export const MAKOA: AgeKey = ageKey('makoa:laptop');
export const IKENNA: AgeKey = ageKey('ikenna:laptop');
export const YOURS: AgeKey = ageKey('you:latch:chapter-1');

// The database passwords: the one that leaked (chapter 1), and the one
// you set in chapter 1, which Makoa knew (chapter 2).
export const OLD_DB: Record<ChapterNo, string> = { 1: 'Rp7-mould-Kx29qWv', 2: 'tq4F-boiler-83hLzN' };
// Chapter 2's mail relay password, in mail.env.
export const SMTP_PASSWORD = 'Hn3v-relay-61pXbe';

// ——— Helpers for the chapters ———

export const typed = (j: Game) => (j as Shell).last.line ?? '';
/** The last command's output or errors contain this; reading the manual doesn't count. */
export const seen = (j: Game, text: string | RegExp) => {
  if (/^\s*(man|apropos|whatis|help)\b|--help\b/.test(typed(j))) return false;
  const last = (j as Shell).last;
  const all = `${last.output}\n${last.errors.join('\n')}`;
  return typeof text === 'string' ? all.includes(text) : text.test(all);
};

export const repo = (j: Game): Repo | undefined => j.state.git?.[REPO];
export const origin = (j: Game): Repo | undefined => j.state.git?.[ORIGIN];
export const head = (r: Repo | undefined) => r?.commits.at(-1)?.files ?? {};
export const dbPassword = (j: Game) => (j.state.postgres as PostgresState | undefined)?.passwords?.repairline ?? '';

/** The value of KEY in a plain dotenv text. */
export const dotenvValue = (text: string | null | undefined, key: string) => {
  const items = readDotenv(text ?? '');
  return 'error' in items ? undefined : items.find((i) => !i.comment && i.key === key)?.value;
};

/** A SOPS file's recipients (from its metadata). */
export const recipientsOf = (text: string | null | undefined): string[] => {
  const o = text ? openFile(text) : null;
  return o && !('error' in o) ? o.metadata.recipients.map((r) => r.recipient) : [];
};

/** A SOPS file decrypted with these keys' identities: its items and data key, or null. */
export const openWith = (text: string | null | undefined, ...keys: AgeKey[]) => {
  if (!text) return null;
  const r = decryptFile(text, { recipients: keys.map((k) => k.public) });
  return 'error' in r ? null : r;
};
export const dataKeyHex = (text: string | null | undefined) => {
  const r = openWith(text, LATCH);
  return r ? [...r.dataKey].map((b) => b.toString(16).padStart(2, '0')).join('') : null;
};

/** The player's age public keys (from ~/.config/sops/age/keys.txt), none if there is no such file. */
export const playerRecipients = (j: Game): string[] => {
  const text = j.read(`${(j as Shell).home}/.config/sops/age/keys.txt`);
  const ids = text ? parseIdentities(text) : null;
  return ids && !('error' in ids) ? ids.recipients : [];
};

/** The creation rule that .sops.yaml (this text) gives a file of the repository. */
export const ruleOf = (config: string | null | undefined, file: string) => {
  const rules = config ? readSopsConfig(config) : null;
  if (!rules || 'error' in rules) return null;
  return ruleFor(rules, `${REPO}/.sops.yaml`, `${REPO}/${file}`);
};

/** Does any commit (after the story's first ones) or any file of HEAD hold this secret in clear? */
export const inHistory = (r: Repo | undefined, secret: string, after = 0) =>
  !!secret && !!r && [...r.commits.slice(after), ...(r.objects ?? [])].some((c) => Object.values(c.files).some((text) => text.includes(secret)));

// ——— The app's files ———

const README = (t: Translate) => t('tenants-union-readme', { key: LATCH.public });

const APP_PY = `"""Repairline: the tenants of Larkspur report repairs, the union follows them up."""
import os

from flask import Flask, render_template, request
import psycopg

app = Flask(__name__)
app.config["MAX_CONTENT_LENGTH"] = 8 * 1024 * 1024  # photos of the damage


def db():
    return psycopg.connect(
        host=os.environ["DB_HOST"],
        dbname=os.environ["DB_NAME"],
        user=os.environ["DB_USER"],
        password=os.environ["DB_PASSWORD"],
    )


@app.route("/", methods=["GET", "POST"])
def report():
    if request.method == "POST":
        with db() as conn:
            conn.execute(
                "INSERT INTO requests (flat, kind, details) VALUES (%s, %s, %s)",
                (request.form["flat"], request.form["kind"], request.form["details"]),
            )
        return render_template("thanks.html")
    return render_template("report.html")`;

const REQUIREMENTS = `flask==3.1.1
psycopg==3.2.9
gunicorn==23.0.0`;

/** deploy.sh as Makoa wrote it (chapter 1), or as it decrypts the settings (chapter 2). */
export const deployScript = (n: ChapterNo) =>
  n === 1
    ? `#!/bin/sh
# Deploys Repairline on latch: its settings, then a restart.
# Run it from anywhere, as root: sudo /srv/repairline/deploy.sh
set -e
cd ${REPO}
install -m 600 .env ${ENV_FILE}
systemctl restart repairline
echo "Repairline deployed."`
    : `#!/bin/sh
# Deploys Repairline on latch: its settings, decrypted with the server's
# own age key, then a restart. Run it as root: sudo /srv/repairline/deploy.sh
set -e
cd ${REPO}
export SOPS_AGE_KEY_FILE=${DEPLOY_KEY}
sops --decrypt .env > ${ENV_FILE}
chmod 600 ${ENV_FILE}
systemctl restart repairline
echo "Repairline deployed."`;

const envItems = (dbPass: string): Item[] => [
  { key: '', value: " Repairline's settings on latch (read by deploy.sh).", comment: true },
  { key: 'DB_HOST', value: 'localhost' },
  { key: 'DB_NAME', value: 'repairline' },
  { key: 'DB_USER', value: 'repairline' },
  { key: 'DB_PASSWORD', value: dbPass },
  { key: 'MAIL_FROM', value: `repairs@${DOMAIN}` },
];
/** The plain .env (as the world stores a file: without its last newline). */
export const plainEnv = (dbPass: string) => emitDotenv(envItems(dbPass)).replace(/\n$/, '');

const mailItems = (): Item[] => [
  { key: 'SMTP_HOST', value: `relay.${DOMAIN}` },
  { key: 'SMTP_USER', value: 'repairline' },
  { key: 'SMTP_PASSWORD', value: SMTP_PASSWORD },
];

// Chapter 2's encrypted files, made by "you" in March (fixed data keys).
const RECIPIENTS_2 = [LATCH.public, YOURS.public, MAKOA.public];
const MARCH = '2033-03-08T18:52:41Z';
const APRIL = '2033-04-05T20:14:07Z';
const dataKey = (seed: string) => Uint8Array.from({ length: 32 }, (_, i) => (seed.charCodeAt(i % seed.length) * 31 + i * 17) & 0xff);
export const START_KEYS = { env: dataKey('latch:env:march'), mail: dataKey('latch:mail:april') };
export const encryptedEnv = () => encryptFile(envItems(OLD_DB[2]), START_KEYS.env, RECIPIENTS_2, {}, MARCH, 'story:env').replace(/\n$/, '');
export const encryptedMail = () => encryptFile(mailItems(), START_KEYS.mail, RECIPIENTS_2, {}, APRIL, 'story:mail').replace(/\n$/, '');

export const sopsYaml = (recipients: string[]) => `creation_rules:
  # Every .env file of the repository: Repairline's settings, the mail relay.
  - path_regex: \\.env$
    age: >-
      ${recipients.join(',\n      ')}`;

// ——— The history ———

const TASLIMA = `Taslima Haque <taslima@${DOMAIN}>`;
const MAKOA_ID = `Makoa Kealoha <makoa@${DOMAIN}>`;
const YOU = (t: Translate) => `${player(t)} <${player(t)}@${DOMAIN}>`;

export function history(t: Translate, n: ChapterNo): Commit[] {
  const base = { 'README.md': README(t), 'app.py': APP_PY, 'requirements.txt': REQUIREMENTS, 'deploy.sh': deployScript(1) };
  // The first version, before the photos' size limit.
  const appV1 = APP_PY.replace(/\napp\.config\["MAX_CONTENT_LENGTH"\].*\n/, '\n');
  const c1 = newCommit(null, t('tenants-union-commit-1'), TASLIMA, 'Sat Jan 15 14:22:09 2033 +0000', { ...base, 'app.py': appV1 });
  const c2 = newCommit(c1, t('tenants-union-commit-2'), MAKOA_ID, 'Wed Jan 26 21:47:33 2033 +0000', { ...base, 'app.py': appV1, '.env': plainEnv(OLD_DB[1]) });
  const c3 = newCommit(c2, t('tenants-union-commit-3'), TASLIMA, 'Sun Feb 27 11:05:52 2033 +0000', { ...base, '.env': plainEnv(OLD_DB[1]), 'app.py': APP_PY });
  if (n === 1) return [c1, c2, c3];
  const files = { ...base, '.env': encryptedEnv(), '.sops.yaml': sopsYaml([LATCH.public, YOURS.public]), 'deploy.sh': deployScript(2) };
  const c4 = newCommit(c3, t('tenants-union-commit-4'), YOU(t), 'Tue Mar 8 19:31:12 2033 +0000', files);
  const c5 = newCommit(c4, t('tenants-union-commit-5'), MAKOA_ID, 'Sat Mar 19 10:12:40 2033 +0000', { ...files, '.sops.yaml': sopsYaml(RECIPIENTS_2) });
  const c6 = newCommit(c5, t('tenants-union-commit-6'), MAKOA_ID, 'Tue Apr 5 20:15:02 2033 +0000', { ...c5.files, 'mail.env': encryptedMail() });
  return [c1, c2, c3, c4, c5, c6];
}
/** How many commits the story's history has before the chapter starts. */
export const STARTING_COMMITS: Record<ChapterNo, number> = { 1: 3, 2: 6 };

// ——— Accounts and files ———

export const accounts = (n: ChapterNo) => (): Accounts => ({
  users: {
    root: { uid: 0, group: 'root', home: '/root' },
    postgres: { uid: 110, group: 'postgres', home: '/var/lib/postgresql', shell: '/bin/bash' },
    repairline: { uid: 998, group: 'repairline', home: '/nonexistent', shell: '/usr/sbin/nologin' },
    you: { uid: 1000, group: 'you' },
    taslima: { uid: 1001, group: 'taslima' },
    makoa: { uid: 1002, group: 'makoa' },
    ...(n === 2 ? { ikenna: { uid: 1003, group: 'ikenna' } } : {}),
  },
  groups: {
    root: { gid: 0, members: [] },
    adm: { gid: 4, members: ['you'] },
    sudo: { gid: 27, members: ['you', 'taslima'] },
    postgres: { gid: 110, members: [] },
    repairline: { gid: 998, members: [] },
    you: { gid: 1000, members: [] },
    taslima: { gid: 1001, members: [] },
    makoa: { gid: 1002, members: [] },
    ...(n === 2 ? { ikenna: { gid: 1003, members: [] } } : {}),
    union: { gid: 1100, members: ['you', 'taslima', 'makoa', ...(n === 2 ? ['ikenna'] : [])] },
  },
});

const root: Rights = { owner: 'root' };
const dir = (children: Record<string, Node>, rights: Rights = root) => d(children, undefined, rights);
const file = (text: string, rights: Rights = root) => f(text, { lines: true, ...rights });
const shared = (text: string, owner = 'taslima', mode = 'rw-rw-r--') => f(text, { lines: true, owner, group: 'union', mode });

function working(t: Translate, n: ChapterNo): Directory {
  const files = history(t, n).at(-1)!.files;
  const children: Record<string, Node> = {
    '.git': d({}, undefined, { owner: 'taslima', group: 'union', mode: 'rwxrwsr-x' }),
  };
  for (const [name, text] of Object.entries(files)) children[name] = shared(text, name === '.env' || name === 'mail.env' ? 'makoa' : 'taslima', name === 'deploy.sh' ? 'rwxrwxr-x' : 'rw-rw-r--');
  return d(children, undefined, { owner: 'taslima', group: 'union', mode: 'rwxrwsr-x' });
}

export interface WorldOptions {
  home: Record<string, Node>;
}

export function latchWorld(t: Translate, n: ChapterNo, o: WorldOptions): Directory {
  const host = machineName(t, 'latch');
  const you: Rights = { owner: 'you', group: 'you' };
  const home: Record<string, Node> = { ...o.home };
  if (n === 2) {
    // The key you made in March, where SOPS looks for it.
    home['.config'] = d({ sops: d({ age: d({ 'keys.txt': f(identityFile(YOURS, '2033-03-08T19:12:44Z'), { lines: true, owner: 'you', group: 'you', mode: 'rw-------' }) }, undefined, { ...you, mode: 'rwx------' }) }, undefined, you) }, undefined, you);
  }
  return dir({
    etc: dir({
      ...accountsFiles(),
      hostname: file(host),
      hosts: file(`127.0.0.1\tlocalhost\n${IP}\trepairs.${DOMAIN} ${host}.internal ${host}\n\n::1\tlocalhost ip6-localhost ip6-loopback`),
      repairline: dir(
        {
          env: f(plainEnv(OLD_DB[n]), { lines: true, owner: 'root', group: 'root', mode: 'rw-------' }),
          'age.key': f(identityFile(LATCH, '2033-02-20T07:41:02Z'), { lines: true, owner: 'root', group: 'root', mode: 'rw-------' }),
          'age.pub': file(LATCH.public),
        },
        { owner: 'root', group: 'root', mode: 'rwxr-xr-x' },
      ),
      systemd: dir({
        system: dir({
          'repairline.service': file(`[Unit]
Description=Repairline (the tenants' repair requests)
After=network.target postgresql.service

[Service]
User=repairline
EnvironmentFile=${ENV_FILE}
ExecStart=/usr/bin/gunicorn --chdir ${REPO} --bind 127.0.0.1:8000 app:app
Restart=on-failure

[Install]
WantedBy=multi-user.target`),
        }),
      }),
    }),
    home: dir({
      you: d(home, undefined, you),
      taslima: dir({}, { owner: 'taslima', group: 'taslima', mode: 'rwx------' }),
      makoa: dir({}, { owner: 'makoa', group: 'makoa', mode: 'rwx------' }),
      ...(n === 2 ? { ikenna: dir({}, { owner: 'ikenna', group: 'ikenna', mode: 'rwxr-x---' }) } : {}),
    }),
    root: dir({}, { owner: 'root', mode: 'rwx------' }),
    tmp: dir({}, { owner: 'root', mode: 'rwxrwxrwt' }),
    srv: dir({
      repairline: working(t, n),
      git: dir({ 'repairline.git': d({ HEAD: file('ref: refs/heads/main', { owner: 'taslima', group: 'union' }) }, undefined, { owner: 'taslima', group: 'union', mode: 'rwxrwsr-x' }) }, { owner: 'root', group: 'union', mode: 'rwxrwsr-x' }),
    }),
    usr: dir({
      bin: dir({
        sops: f('', { owner: 'root', mode: 'rwxr-xr-x', size: 47_311_032, charset: 'binary' }),
        'age-keygen': f('', { owner: 'root', mode: 'rwxr-xr-x', size: 3_473_408, charset: 'binary' }),
        age: f('', { owner: 'root', mode: 'rwxr-xr-x', size: 4_087_808, charset: 'binary' }),
        gunicorn: f('', { owner: 'root', mode: 'rwxr-xr-x', size: 987, charset: 'binary' }),
      }),
    }),
    var: dir({ log: dir({}), lib: dir({ postgresql: dir({}, { owner: 'postgres', group: 'postgres', mode: 'rwx------' }) }) }),
  });
}

// ——— The machine's state ———

const proc = (pid: number, user: string, command: string, mem = 0.8) => ({ pid, user, cpu: 0, mem, command });

/** The password the app reads at start, from the deployed file. */
const deployedPassword = (j: Game) => dotenvValue(j.read(ENV_FILE), 'DB_PASSWORD') ?? '';

function repairlineService(): DefinitionService {
  return {
    description: "Repairline (the tenants' repair requests)",
    active: true,
    executable: 'gunicorn',
    file: '/etc/systemd/system/repairline.service',
    modelled: true,
    process: [proc(812, 'repairline', `/usr/bin/python3 /usr/bin/gunicorn --chdir ${REPO} --bind 127.0.0.1:8000 app:app`, 2.4)],
    // The app connects to the database with the password of its settings.
    check: (j) =>
      deployedPassword(j) === dbPassword(j)
        ? null
        : [
            `psycopg.OperationalError: connection failed: connection to server at "127.0.0.1", port 5432 failed: FATAL:  password authentication failed for user "repairline"`,
            '[ERROR] Worker (pid:812) exited with code 3',
            "gunicorn.errors.HaltServer: <HaltServer 'Worker failed to boot.' 3>",
          ],
    load: (j) => {
      j.state.appPassword = deployedPassword(j);
    },
  };
}

export function latchState(t: Translate, n: ChapterNo) {
  const commits = history(t, n);
  return {
    systemd: newSystemd(machineName(t, 'latch'), BOOT[n], NOW[n], {
      ssh: { description: 'OpenBSD Secure Shell server', active: true, executable: 'sshd', process: [proc(604, 'root', 'sshd: /usr/sbin/sshd -D [listener] 0 of 10-100 startups')] },
      postgresql: { description: 'PostgreSQL RDBMS', active: true, executable: 'postgres', process: [proc(701, 'postgres', '/usr/lib/postgresql/17/bin/postgres -D /var/lib/postgresql/17/main', 1.6)] },
      repairline: repairlineService(),
    }),
    postgres: {
      bases: { postgres: { owner: 'postgres', tables: {} }, repairline: { owner: 'repairline', tables: {} } },
      roles: ['postgres', 'repairline'],
      archives: {},
      passwords: { repairline: OLD_DB[n] },
    } satisfies PostgresState,
    appPassword: OLD_DB[n],
    git: {
      [REPO]: { commits, index: { ...commits.at(-1)!.files }, remotes: { origin: ORIGIN }, deep: true },
      [ORIGIN]: { commits: [...commits], index: {}, bare: true, deep: true },
    } satisfies Record<string, Repo>,
    gitClock: true,
    listening: [
      { proto: 'tcp', address: '0.0.0.0', port: 22, process: 'sshd', pid: 604 },
      { proto: 'tcp', address: '127.0.0.1', port: 5432, process: 'postgres', pid: 701 },
      { proto: 'tcp', address: '127.0.0.1', port: 8000, process: 'gunicorn', pid: 812 },
    ],
    apt: { installed: { age: '1.2.1-1', sops: '3.10.2' } },
  };
}

/** Starting a chapter: the author git writes, the starting data keys kept for the checks. */
export function initialiseStory(j: Game, n: ChapterNo) {
  const s = j as Shell;
  s.state.author = `${s.player} <${s.player}@${DOMAIN}>`;
  // The unit file is the one systemd loaded at boot (no daemon-reload needed).
  const unit = '/etc/systemd/system/repairline.service';
  systemd(s)!.services.repairline.overridesFingerprint = `${unit}\n${s.read(unit) ?? ''}`;
  s.state.startKeys = n === 2 ? { env: dataKeyHex(encryptedEnv()), mail: dataKeyHex(encryptedMail()) } : {};
}

/** Each command: half a minute passes. */
export function passTime(j: Game) {
  systemd(j)!.clock += 30_000;
}

// ——— Checks shared by both chapters ———

/** The app runs with the database's current password, from the deployed file (readable by root only). */
export const appRunning = (j: Game) => systemd(j)?.services.repairline?.state === 'active' && j.state.appPassword === dbPassword(j);
export const envPrivate = (j: Game) => {
  const n = j.find(ENV_FILE);
  return !!n && !/r/.test((n.mode ?? 'rw-r--r--').slice(6, 9));
};
/** A new, long enough database password. */
export const rotated = (j: Game, n: ChapterNo) => dbPassword(j) !== OLD_DB[n] && dbPassword(j).length >= 12 && dbPassword(j) !== OLD_DB[1];

/** deploy.sh decrypts with sops (in this text). */
export const deployDecrypts = (text: string | undefined | null) => !!text && /\bsops\b[^\n]*(\s-d\b|--decrypt\b|\sdecrypt\b)/.test(text);

/** Was this file encrypted for the server (its deploy key)? */
export const forServer = (text: string | null | undefined) => isSopsFile(text ?? null) && recipientsOf(text).includes(LATCH.public);

