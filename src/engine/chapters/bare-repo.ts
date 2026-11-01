// Story "The Gazette" — chapter "The bare repository": deploying with git.
// The neighbourhood paper's site is served by nginx from /var/www/gazette,
// where everyone copied their files by hand. The code is already tracked by
// git in ~/gazette. The server needs a bare repository (/srv/git/gazette.git)
// and a post-receive hook that checks out each push into /var/www/gazette.
// Trap: Théo fixed a typo directly on the server; it is not in git, and the
// first deployment erases it.
// Objective checked on the state: the site is exactly the last commit of the
// server's repository, checked out by its hook; it contains Samia's article,
// Théo's fix, then the corrected date in the events page.
// Sources: https://git-scm.com/book/en/v2/Git-on-the-Server-Setting-Up-the-Server,
// https://git-scm.com/docs/githooks#post-receive, https://git-scm.com/docs/git#Documentation/git.txt---work-treeltpathgt

import { path, name, d, f, accountsFiles, player, type Chapter, type Accounts, type Rights } from '../world';
import type { Game } from '../shell';
import { newSystemd } from '../systemd';
import { loadNginx, httpRequest, checkNginx } from '../nginx';
import { newCommit, type Commit, type Repo } from '../commands/git';
import { content } from '../tools';
import { MIME, NGINX_CONF } from '../commands/apt';

const M = '/home/you';
const LOCAL = `${M}/gazette`;
export const REPO = '/srv/git/gazette.git';
export const SITE = '/var/www/gazette';
const GAZETTE = 'gazette.example';
export const AUTHOR = 'Samia Haddad <samia@gazette.example>';

export const gazetteAccounts = (): Accounts => ({
  users: {
    root: { uid: 0, group: 'root', home: '/root' },
    'www-data': { uid: 33, group: 'www-data', home: '/var/www', shell: '/usr/sbin/nologin' },
    you: { uid: 1000, group: 'you' },
    samia: { uid: 1001, group: 'samia' },
    theo: { uid: 1002, group: 'theo' },
  },
  groups: {
    root: { gid: 0, members: [] },
    sudo: { gid: 27, members: ['you', 'samia'] },
    'www-data': { gid: 33, members: [] },
    you: { gid: 1000, members: [] },
    samia: { gid: 1001, members: [] },
    theo: { gid: 1002, members: [] },
    newsroom: { gid: 1100, members: ['you', 'samia', 'theo'] },
  },
});

export const CONF_GAZETTE = `server {
    listen 80 default_server;
    listen [::]:80 default_server;
    server_name ${GAZETTE} www.${GAZETTE};

    root ${SITE};
    index index.html;

    location / {
        try_files $uri $uri/ =404;
    }
}`;

export const STYLE = `body { font-family: Georgia, serif; max-width: 40em; margin: auto; }
h1 { border-bottom: 3px double; }
time { font-weight: bold; }`;

// The events page, with the date of the jumble sale (in the text and in datetime).
export const agenda = (t: Game['t'], day: number) =>
  t('bare-repo-site-agenda', { date: `2027-06-${String(day).padStart(2, '0')}`, day: String(day) });

// The site's history in ~/gazette: the first version (with the typo in the
// title), then Samia's article, not yet online.
export function history(t: Game['t']): Commit[] {
  const v1 = { 'index.html': t('bare-repo-site-index-v1'), 'style.css': STYLE, 'agenda.html': agenda(t, 21) };
  const c1 = newCommit(null, t('bare-repo-commit-1'), AUTHOR, 'Mon Apr 12 10:02:41 2027 +0200', v1);
  const c2 = newCommit(c1, t('bare-repo-commit-2'), AUTHOR, 'Fri May 7 18:30:12 2027 +0200', {
    ...v1,
    'index.html': t('bare-repo-site-index-v2'),
    [name(t, 'street-party.html')]: t('bare-repo-site-article'),
  });
  return [c1, c2];
}

const repo = (j: Game, path: string): Repo | undefined => j.state.git?.[path];
const head = (j: Game) => repo(j, REPO)?.commits.at(-1);
const readSite = (j: Game, name: string) => {
  const n = j.find(`${SITE}/${name}`);
  return n?.type === 'file' ? content(n, j) : null;
};
// Is the site exactly the server's last commit, checked out by its hook?
const deployed = (j: Game) => {
  const c = head(j);
  return !!c && j.state.gitDeployments?.[SITE] === c.id && Object.entries(c.files).every(([name, text]) => readSite(j, name) === text);
};
const withMistake = (j: Game) => (readSite(j, 'index.html') ?? '').includes(j.t('bare-repo-title-mistake'));
const withArticle = (j: Game) => {
  const article = name(j.t, 'street-party.html');
  return (readSite(j, 'index.html') ?? '').includes(`href="${article}"`) && readSite(j, article) !== null;
};
const fixedAgenda = (j: Game) => {
  const a = readSite(j, 'agenda.html') ?? '';
  return a.includes('2027-06-12') && !a.includes('2027-06-21');
};
const inLine = (j: Game) => deployed(j) && withArticle(j) && !withMistake(j);
const output = (j: Game) => [j.last.output, ...j.last.errors].join('\n');

export const bareRepo: Chapter = {
  id: 'bare-repo',
  number: 1,
  commands: [
    'ls',
    'cd',
    'pwd',
    'cat',
    'less',
    'head',
    'tail',
    'grep',
    'diff',
    'cp',
    'mv',
    'rm',
    'mkdir',
    'touch',
    'chmod',
    'chown',
    'chgrp',
    'echo',
    'tee',
    'id',
    'whoami',
    'sudo',
    'nano',
    'git',
    'curl',
    'systemctl',
  ],
  home: M,
  welcome: 'message_from_samia.txt',
  names: true,
  final: 'end',
  password: 'gazette-2027',
  accounts: gazetteAccounts,
  state: (t) => ({
    systemd: newSystemd('gazette', Date.UTC(2027, 4, 2, 6, 40, 0), Date.UTC(2027, 4, 10, 9, 15, 0), {
      ssh: {
        description: 'OpenBSD Secure Shell server',
        active: true,
        executable: 'sshd',
        process: [{ pid: 604, user: 'root', cpu: 0, mem: 0.2, command: 'sshd: /usr/sbin/sshd -D [listener] 0 of 10-100 startups' }],
      },
      nginx: {
        description: 'A high performance web server and a reverse proxy server',
        active: true,
        executable: 'nginx',
        process: [
          { pid: 801, user: 'root', cpu: 0, mem: 0.3, command: 'nginx: master process /usr/sbin/nginx -g daemon on; master_process on;' },
          { pid: 802, user: 'www-data', cpu: 0.1, mem: 0.6, command: 'nginx: worker process' },
        ],
        check: checkNginx,
        load: loadNginx,
        checkToReload: true,
      },
    }),
    nginx: { load: null, names: ['gazette', GAZETTE, `www.${GAZETTE}`, '192.0.2.16'] },
    git: { [path(t, LOCAL)]: { commits: history(t), index: history(t).at(-1)!.files } },
    author: `${player(t)} <${player(t)}@gazette.example>`,
    date: 'Mon May 10 09:20:00 2027 +0200',
  }),
  initialise: (j) => loadNginx(j),
  createWorld: (t) => {
    const root: Rights = { owner: 'root' };
    const place = (children: Parameters<typeof d>[0], rights: Rights = root) => d(children, undefined, rights);
    const file = (text: string, rights: Rights = root) => f(text, { lines: true, ...rights });
    const newsroom = (text: string, owner = 'you') => file(text, { owner, group: 'newsroom', mode: 'rw-rw-r--' });
    const last = history(t).at(-1)!.files;
    return place({
      etc: place({
        ...accountsFiles(),
        hostname: file('gazette'),
        nginx: place({
          'nginx.conf': file(NGINX_CONF),
          'mime.types': file(MIME),
          'conf.d': place({}),
          'modules-enabled': place({}),
          'sites-available': place({ gazette: file(CONF_GAZETTE) }),
          'sites-enabled': place({ gazette: f('', { owner: 'root', link: '/etc/nginx/sites-available/gazette' }) }),
        }),
      }),
      home: place({
        you: d({
          'message_from_samia.txt': f(t('bare-repo-message-samia')),
          'note_from_theo.txt': f(t('bare-repo-word-theo')),
          gazette: d({
            '.git': d({ HEAD: f('ref: refs/heads/main', { lines: true }) }),
            ...Object.fromEntries(Object.entries(last).map(([name, text]) => [name, f(text, { lines: true })])),
          }),
        }),
        samia: place({}, { owner: 'samia', mode: 'rwx------' }),
        theo: place({}, { owner: 'theo', mode: 'rwx------' }),
      }),
      srv: place({ git: place({}) }),
      usr: place({ sbin: place({ nginx: f('', { owner: 'root', mode: 'rwxr-xr-x', size: 1_342_520 }) }) }),
      var: place({
        www: place({
          // The first version, put there by hand… and the typo in the title fixed in place by Théo.
          gazette: place(
            {
              'index.html': newsroom(t('bare-repo-site-index-theo'), 'theo'),
              'style.css': newsroom(STYLE),
              'agenda.html': newsroom(agenda(t, 21)),
            },
            { owner: 'you', group: 'newsroom', mode: 'rwxrwxr-x' },
          ),
        }),
        log: place({
          nginx: place(
            {
              'access.log': f('', { lines: true, owner: 'www-data', group: 'adm', mode: 'rw-r-----' }),
              'error.log': f('', { lines: true, owner: 'www-data', group: 'adm', mode: 'rw-r-----' }),
            },
            { owner: 'root', group: 'adm' },
          ),
        }),
      }),
    });
  },
  events: [
    {
      id: 'drift',
      condition: (j) => j.last.commands.some((c) => c[0] === 'diff') && output(j).includes(j.t('bare-repo-title-mistake')),
      message: (j) => j.t('bare-repo-event-drift'),
    },
    { id: 'rights', condition: (j) => output(j).includes(j.t('git-push-rights').split('\n')[0]), message: (j) => j.t('bare-repo-event-rights') },
    {
      id: 'without-hook',
      condition: (j) =>
        j.last.commands.some((c) => c[0] === 'git' && c.includes('push')) &&
        !!head(j) &&
        !j.exists(`${REPO}/hooks/post-receive`) &&
        !j.state.gitDeployments?.[SITE],
      message: (j) => j.t('bare-repo-event-without-hook'),
    },
    {
      id: 'hook-ignore',
      condition: (j) => output(j).includes('hooks/post-receive') && output(j).includes('advice.ignoredHook'),
      message: (j) => j.t('bare-repo-event-hook-ignore'),
    },
    {
      id: 'not-tracked',
      condition: (j) => output(j).includes(j.t('git-checkout-not-tracked', { files: '' }).split('\n')[0]),
      message: (j) => j.t('bare-repo-event-not-tracked'),
    },
    {
      id: 'correction-lost',
      condition: (j) => !!j.state.gitDeployments?.[SITE] && withMistake(j),
      message: (j) => j.t('bare-repo-event-correction-lost'),
    },
    { id: 'in-line', condition: (j) => inLine(j), message: (j) => j.t('bare-repo-event-in-line') },
    { id: 'by-hand', condition: (j) => fixedAgenda(j) && !deployed(j), message: (j) => j.t('bare-repo-event-by-hand') },
    {
      id: 'end',
      condition: (j) => inLine(j) && fixedAgenda(j) && httpRequest(j, GAZETTE, '/agenda.html', 80, false)?.code === 200,
      message: (j) => j.t('bare-repo-event-end'),
    },
  ],
};
