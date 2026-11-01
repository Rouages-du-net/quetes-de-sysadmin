// Histoire « La Gazette » — chapitre « Le dépôt nu » : déployer par git.
// Le site du journal du quartier est servi par nginx depuis /var/www/gazette,
// où chacun·e copiait ses fichiers à la main. Le code est déjà suivi par git
// dans ~/gazette. Il faut un dépôt nu sur le serveur (/srv/git/gazette.git)
// et un crochet post-receive qui extrait chaque push dans /var/www/gazette.
// Piège : Théo a corrigé une faute directement sur le serveur ; elle n'est
// pas dans git, et le premier déploiement l'efface.
// Objectif vérifié sur l'état : le site est exactement le dernier commit du
// dépôt du serveur, extrait par son crochet ; il contient l'article de Samia,
// la correction de Théo, puis la date corrigée de l'agenda.
// Sources : https://git-scm.com/book/fr/v2/Git-sur-le-serveur-Mise-en-place-du-serveur,
// https://git-scm.com/docs/githooks#post-receive, https://git-scm.com/docs/git#Documentation/git.txt---work-treeltpathgt

import { path, d, f, accountsFiles, player, type Chapter, type Accounts, type Rights } from '../world';
import type { Game } from '../shell';
import { newSystemd } from '../systemd';
import { loadNginx, httpRequest, checkNginx } from '../nginx';
import { newCommit, type Commit, type Repo } from '../commands/git';
import { content } from '../tools';
import { MIME, NGINX_CONF } from '../commands/apt';

const M = '/home/vous';
const LOCAL = `${M}/gazette`;
export const REPO = '/srv/git/gazette.git';
export const SITE = '/var/www/gazette';
const GAZETTE = 'gazette.example';
export const AUTHOR = 'Samia Haddad <samia@gazette.example>';

export const gazetteAccounts = (): Accounts => ({
  users: {
    root: { uid: 0, group: 'root', home: '/root' },
    'www-data': { uid: 33, group: 'www-data', home: '/var/www', shell: '/usr/sbin/nologin' },
    vous: { uid: 1000, group: 'vous' },
    samia: { uid: 1001, group: 'samia' },
    theo: { uid: 1002, group: 'theo' },
  },
  groups: {
    root: { gid: 0, members: [] },
    sudo: { gid: 27, members: ['vous', 'samia'] },
    'www-data': { gid: 33, members: [] },
    vous: { gid: 1000, members: [] },
    samia: { gid: 1001, members: [] },
    theo: { gid: 1002, members: [] },
    redaction: { gid: 1100, members: ['vous', 'samia', 'theo'] },
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

// L'agenda, avec la date du vide-grenier (dans le texte et dans datetime).
export const agenda = (t: Game['t'], day: number) =>
  t('depot-nu-site-agenda', { date: `2027-06-${String(day).padStart(2, '0')}`, jour: String(day) });

// L'historique du site dans ~/gazette : la première version (avec la faute
// du titre), puis l'article de Samia, pas encore en ligne.
export function history(t: Game['t']): Commit[] {
  const v1 = { 'index.html': t('depot-nu-site-index-v1'), 'style.css': STYLE, 'agenda.html': agenda(t, 21) };
  const c1 = newCommit(null, t('depot-nu-commit-1'), AUTHOR, 'Mon Apr 12 10:02:41 2027 +0200', v1);
  const c2 = newCommit(c1, t('depot-nu-commit-2'), AUTHOR, 'Fri May 7 18:30:12 2027 +0200', {
    ...v1,
    'index.html': t('depot-nu-site-index-v2'),
    'fete-des-voisins.html': t('depot-nu-site-article'),
  });
  return [c1, c2];
}

const repo = (j: Game, path: string): Repo | undefined => j.state.git?.[path];
const head = (j: Game) => repo(j, REPO)?.commits.at(-1);
const readSite = (j: Game, name: string) => {
  const n = j.find(`${SITE}/${name}`);
  return n?.type === 'fichier' ? content(n, j) : null;
};
// Le site est-il exactement le dernier commit du serveur, extrait par son crochet ?
const deployed = (j: Game) => {
  const c = head(j);
  return !!c && j.state.gitDeploiements?.[SITE] === c.id && Object.entries(c.files).every(([name, text]) => readSite(j, name) === text);
};
const withMistake = (j: Game) => (readSite(j, 'index.html') ?? '').includes(j.t('depot-nu-titre-faute'));
const withArticle = (j: Game) =>
  (readSite(j, 'index.html') ?? '').includes('href="fete-des-voisins.html"') && readSite(j, 'fete-des-voisins.html') !== null;
const fixedAgenda = (j: Game) => {
  const a = readSite(j, 'agenda.html') ?? '';
  return a.includes('2027-06-12') && !a.includes('2027-06-21');
};
const inLine = (j: Game) => deployed(j) && withArticle(j) && !withMistake(j);
const output = (j: Game) => [j.last.output, ...j.last.errors].join('\n');

export const bareRepo: Chapter = {
  id: 'depot-nu',
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
  welcome: 'message_de_samia.txt',
  names: true,
  final: 'fin',
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
    auteur: `${player(t)} <${player(t)}@gazette.example>`,
    date: 'Mon May 10 09:20:00 2027 +0200',
  }),
  initialise: (j) => loadNginx(j),
  createWorld: (t) => {
    const root: Rights = { owner: 'root' };
    const place = (children: Parameters<typeof d>[0], rights: Rights = root) => d(children, undefined, rights);
    const file = (text: string, rights: Rights = root) => f(text, { lines: true, ...rights });
    const redaction = (text: string, owner = 'vous') => file(text, { owner, group: 'redaction', mode: 'rw-rw-r--' });
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
        vous: d({
          'message_de_samia.txt': f(t('depot-nu-message-de-samia')),
          'mot_de_theo.txt': f(t('depot-nu-mot-de-theo')),
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
          // La première version, posée à la main… et la faute du titre corrigée sur place par Théo.
          gazette: place(
            {
              'index.html': redaction(t('depot-nu-site-index-theo'), 'theo'),
              'style.css': redaction(STYLE),
              'agenda.html': redaction(agenda(t, 21)),
            },
            { owner: 'vous', group: 'redaction', mode: 'rwxrwxr-x' },
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
      id: 'derive',
      condition: (j) => j.last.commands.some((c) => c[0] === 'diff') && output(j).includes(j.t('depot-nu-titre-faute')),
      message: (j) => j.t('depot-nu-evenement-derive'),
    },
    { id: 'droits', condition: (j) => output(j).includes(j.t('git-push-droits').split('\n')[0]), message: (j) => j.t('depot-nu-evenement-droits') },
    {
      id: 'sans-crochet',
      condition: (j) =>
        j.last.commands.some((c) => c[0] === 'git' && c.includes('push')) &&
        !!head(j) &&
        !j.exists(`${REPO}/hooks/post-receive`) &&
        !j.state.gitDeploiements?.[SITE],
      message: (j) => j.t('depot-nu-evenement-sans-crochet'),
    },
    {
      id: 'crochet-ignore',
      condition: (j) => output(j).includes('hooks/post-receive') && output(j).includes('advice.ignoredHook'),
      message: (j) => j.t('depot-nu-evenement-crochet-ignore'),
    },
    {
      id: 'non-suivis',
      condition: (j) => output(j).includes(j.t('git-checkout-non-suivis', { fichiers: '' }).split('\n')[0]),
      message: (j) => j.t('depot-nu-evenement-non-suivis'),
    },
    {
      id: 'correction-perdue',
      condition: (j) => !!j.state.gitDeploiements?.[SITE] && withMistake(j),
      message: (j) => j.t('depot-nu-evenement-correction-perdue'),
    },
    { id: 'en-ligne', condition: (j) => inLine(j), message: (j) => j.t('depot-nu-evenement-en-ligne') },
    { id: 'a-la-main', condition: (j) => fixedAgenda(j) && !deployed(j), message: (j) => j.t('depot-nu-evenement-a-la-main') },
    {
      id: 'fin',
      condition: (j) => inLine(j) && fixedAgenda(j) && httpRequest(j, GAZETTE, '/agenda.html', 80, false)?.code === 200,
      message: (j) => j.t('depot-nu-evenement-fin'),
    },
  ],
};
