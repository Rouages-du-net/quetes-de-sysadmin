// Histoire « La Gazette » — chapitre « Le retour arrière » : chaque push est
// publié dans son propre dossier (releases/), et un lien current désigne la
// version en ligne. Hier soir, Théo a poussé une nouvelle mise en page… sans
// index.html : le site répond 403. Revenir à la version précédente, c'est
// basculer le lien (ln -sfn), instantanément. Puis faire lancer tests.sh par
// le crochet avant de basculer, pour qu'une version cassée ne soit jamais
// mise en ligne ; Théo repousse pour vérifier. Enfin, réparer pour de bon
// (git pull, le bon nom de fichier, git push).
// Objectif vérifié sur l'état : le site sert la nouvelle mise en page,
// publiée par le crochet après ses tests, et le push cassé de Théo n'a pas
// été mis en ligne.
// Sources : https://git-scm.com/docs/githooks#post-receive,
// https://www.gnu.org/software/coreutils/manual/html_node/ln-invocation.html,
// https://nginx.org/en/docs/http/ngx_http_core_module.html#root

import { path, d, f, accountsFiles, player, type Chapter, type Rights, type Node } from '../world';
import type { Game, Shell } from '../shell';
import { newSystemd } from '../systemd';
import { loadNginx, httpRequest, checkNginx } from '../nginx';
import { newCommit, type Commit, type Repo } from '../commands/git';
import { MIME, NGINX_CONF } from '../commands/apt';
import { AUTHOR, CONF_GAZETTE, SITE, agenda, gazetteAccounts, history } from './bare-repo';

const M = '/home/you';
const LOCAL = `${M}/gazette`;
const REPO = '/srv/git/gazette.git';
const BASE = '/srv/gazette';
const RELEASES = `${BASE}/releases`;
const CURRENT = `${BASE}/current`;
const BONNE = '20270514101502';
const BROKEN = '20270517203012';
const THEO = '/home/theo/gazette';
const THEO_AUTHOR = 'Theo Martin <theo@gazette.example>';
const GAZETTE = 'gazette.example';

// L'historique : celui du chapitre 1 (titre corrigé, agenda), les tests de
// Samia, puis la nouvelle mise en page de Théo (accueil.html au lieu d'index.html).
function commits(t: Game['t']): Commit[] {
  const [c1, c2] = history(t);
  const c3 = newCommit(c2, t('rollback-commit-3'), `${player(t)} <${player(t)}@gazette.example>`, 'Mon May 10 09:31:00 2027 +0200', {
    ...c2.files,
    'index.html': t('rollback-site-index'),
  });
  const c4 = newCommit(c3, t('rollback-commit-4'), `${player(t)} <${player(t)}@gazette.example>`, 'Mon May 10 09:40:00 2027 +0200', {
    ...c3.files,
    'agenda.html': agenda(t, 12),
  });
  const c5 = newCommit(c4, t('rollback-commit-5'), AUTHOR, 'Fri May 14 10:14:51 2027 +0200', {
    ...c4.files,
    'tests.sh': t('rollback-tests'),
  });
  const { 'index.html': _index, ...withoutIndex } = c5.files;
  const c6 = newCommit(c5, t('rollback-commit-6'), THEO_AUTHOR, 'Mon May 17 20:29:40 2027 +0200', {
    ...withoutIndex,
    'accueil.html': t('rollback-site-welcome'),
  });
  return [c1, c2, c3, c4, c5, c6];
}

// Le crochet de déploiement : une version par push, puis le lien current.
const HOOK = (t: Game['t']) => `#!/bin/sh
# ${t('rollback-hook-comment')}
set -e
VERSION=$(date +%Y%m%d%H%M%S)
mkdir -p ${RELEASES}/$VERSION
git --work-tree=${RELEASES}/$VERSION checkout -f main
ln -sfn ${RELEASES}/$VERSION ${CURRENT}
echo "${t('rollback-hook-echo')}"`;

const repo = (j: Game, path: string): Repo | undefined => j.state.git?.[path];
const link = (j: Game) => (j.find(CURRENT, false) as { link?: string } | null)?.link ?? null;
// La version en ligne : le dossier de releases/ que vise current.
const inLine = (j: Game) => {
  const l = link(j);
  return l ? (l.startsWith('/') ? l : `${BASE}/${l}`).replace(/\/$/, '').split('/').at(-1)! : null;
};
const page = (j: Game) => httpRequest(j, GAZETTE, '/', 80, false);
const works = (j: Game) => page(j)?.code === 200;
const newUpdateInPage = (j: Game) => works(j) && (page(j)?.body ?? '').includes('class="une"');
const hook = (j: Game) => j.read(`${REPO}/hooks/post-receive`) ?? '';
// Un lien créé DANS la version cassée (ln -sf sans -n : ln est entré dans le lieu visé).
const insideLink = (j: Game) => {
  const n = j.find(`${RELEASES}/${BROKEN}`);
  return n?.type === 'dossier' && Object.values(n.children).some((e) => e.type === 'fichier' && e.link !== undefined);
};
// La version de releases/ où le crochet a extrait le dernier commit du serveur.
const deployedByHook = (j: Game) => {
  const head = repo(j, REPO)?.commits.at(-1);
  const here = Object.entries(j.state.gitDeployments ?? {}).find(([, id]) => id === head?.id)?.[0];
  return !!here && here.replace(/\/$/, '').split('/').at(-1) === inLine(j);
};

/** Théo repousse une mise en page sans index.html, comme s'il le faisait de chez lui. */
function theoRepousse(j: Game): string {
  const game = j as Shell;
  const server = repo(j, REPO)!;
  const head = server.commits.at(-1)!;
  const number = (j.state.theoAttempts = (j.state.theoAttempts ?? 0) + 1);
  const { 'index.html': _index, ...withoutIndex } = head.files;
  const c = newCommit(head, j.t('rollback-commit-theo', { numero: number }), THEO_AUTHOR, 'Mon May 17 21:05:00 2027 +0200', {
    ...withoutIndex,
    'accueil.html': `${j.t('rollback-site-welcome')}\n<!-- ${number} -->`,
  });
  j.state.git[THEO] = { commits: [...server.commits, c], index: { ...c.files }, remotes: { prod: REPO } };
  const before = game.who;
  game.who = 'theo';
  try {
    const r = game.underCommand('git push prod main', THEO);
    j.state.theoPushed = c.id;
    return j.t('rollback-theo-push', { sortie: r.output.replace(/^/gm, '  ') });
  } finally {
    game.who = before;
  }
}

export const rollback: Chapter = {
  id: 'rollback',
  number: 2,
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
    'ln',
    'readlink',
    'chmod',
    'echo',
    'tee',
    'id',
    'whoami',
    'date',
    'test',
    'sh',
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
  state: (t) => {
    const all = commits(t);
    return {
      systemd: newSystemd('gazette', Date.UTC(2027, 4, 2, 6, 40, 0), Date.UTC(2027, 4, 17, 21, 2, 0), {
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
      git: {
        [REPO]: { commits: all, index: {}, bare: true },
        // Ta copie s'est arrêtée aux tests de Samia : la mise en page de Théo est sur le serveur.
        [path(t, LOCAL)]: { commits: all.slice(0, 5), index: { ...all[4].files }, remotes: { prod: REPO } },
      },
      author: `${player(t)} <${player(t)}@gazette.example>`,
      date: 'Mon May 17 21:10:00 2027 +0200',
    };
  },
  initialise: (j) => loadNginx(j),
  afterCommand: (j) => {
    // Une fois le site rétabli et les tests ajoutés au crochet, Théo repousse
    // sa mise en page (cassée) : à chaque nouvelle version du crochet.
    const c = hook(j);
    if (!j.state.restored || !c.includes('tests.sh') || c === j.state.hookTested) return;
    j.state.hookTested = c;
    j.state.versionBeforeTheo = inLine(j);
    return theoRepousse(j);
  },
  createWorld: (t) => {
    const root: Rights = { owner: 'root' };
    const place = (children: Parameters<typeof d>[0], rights: Rights = root) => d(children, undefined, rights);
    const file = (text: string, rights: Rights = root) => f(text, { lines: true, ...rights });
    const share: Rights = { owner: 'you', group: 'redaction', mode: 'rwxrwxr-x' };
    const all = commits(t);
    const version = (c: Commit): Node =>
      place(
        Object.fromEntries(
          Object.entries(c.files).map(([name, text]) => [name, file(text, { owner: 'you', group: 'redaction', mode: 'rw-rw-r--' })]),
        ),
        share,
      );
    const conf = CONF_GAZETTE.replace(`root ${SITE};`, `root ${CURRENT};`);
    return place({
      etc: place({
        ...accountsFiles(),
        hostname: file('gazette'),
        nginx: place({
          'nginx.conf': file(NGINX_CONF),
          'mime.types': file(MIME),
          'conf.d': place({}),
          'modules-enabled': place({}),
          'sites-available': place({ gazette: file(conf) }),
          'sites-enabled': place({ gazette: f('', { owner: 'root', link: '/etc/nginx/sites-available/gazette' }) }),
        }),
      }),
      home: place({
        you: d({
          'message_from_samia.txt': f(t('rollback-message-samia')),
          gazette: d({
            '.git': d({ HEAD: f('ref: refs/heads/main', { lines: true }) }),
            ...Object.fromEntries(Object.entries(all[4].files).map(([name, text]) => [name, f(text, { lines: true })])),
          }),
        }),
        samia: place({}, { owner: 'samia', mode: 'rwx------' }),
        theo: place({ gazette: place({ '.git': place({}, { owner: 'theo' }) }, { owner: 'theo' }) }, { owner: 'theo', mode: 'rwx------' }),
      }),
      srv: place({
        // Le dépôt partagé par la rédaction (git init --bare --shared=group).
        git: place({
          'gazette.git': place(
            {
              HEAD: file('ref: refs/heads/main', share),
              config: file('[core]\n\trepositoryformatversion = 0\n\tfilemode = true\n\tbare = true\n\tsharedrepository = 1', share),
              hooks: place({ 'post-receive': file(HOOK(t), { ...share, mode: 'rwxrwxr-x' }) }, share),
              objects: place({}, share),
              refs: place({ heads: place({ main: file(all[5].id, share) }, share) }, share),
            },
            share,
          ),
        }),
        gazette: place(
          {
            releases: place({ [BONNE]: version(all[4]), [BROKEN]: version(all[5]) }, share),
            current: f('', { owner: 'you', group: 'redaction', link: `${RELEASES}/${BROKEN}` }),
          },
          share,
        ),
      }),
      usr: place({ sbin: place({ nginx: f('', { owner: 'root', mode: 'rwxr-xr-x', size: 1_342_520 }) }) }),
      var: place({
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
      id: 'failure',
      condition: (j) => j.last.commands.some((c) => c[0] === 'curl') && page(j)?.code === 403,
      message: (j) => j.t('rollback-event-failure'),
    },
    { id: 'without-n', condition: (j) => insideLink(j), message: (j) => j.t('rollback-event-without-n') },
    {
      id: 'restored',
      condition: (j) => {
        const ok = works(j);
        if (ok) j.state.restored = true;
        return ok;
      },
      message: (j) => j.t('rollback-event-restored'),
    },
    {
      id: 'kept-fou',
      condition: (j) => {
        const ok = !!j.state.theoPushed && works(j) && inLine(j) === j.state.versionBeforeTheo;
        if (ok) j.state.safeguard = true;
        return ok;
      },
      message: (j) => j.t('rollback-event-kept-fou'),
    },
    { id: 'kept-fou-pierced', condition: (j) => !!j.state.theoPushed && !works(j), message: (j) => j.t('rollback-event-kept-fou-pierced') },
    {
      id: 'tests-elsewhere',
      condition: (j) =>
        j.last.commands.some((c) => c[0] === 'git' && c.includes('push')) &&
        'index.html' in (repo(j, REPO)?.commits.at(-1)?.files ?? {}) &&
        !deployedByHook(j),
      message: (j) => j.t('rollback-event-tests-elsewhere'),
    },
    {
      id: 'end',
      condition: (j) => !!j.state.safeguard && newUpdateInPage(j) && deployedByHook(j) && hook(j).includes('tests.sh'),
      message: (j) => j.t('rollback-event-end'),
    },
  ],
};
