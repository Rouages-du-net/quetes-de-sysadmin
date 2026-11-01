// Histoire « La Gazette » — chapitre « Le canari » : la 1.6.0 du Kiosque
// change beaucoup de choses ; cette fois, pas de bascule d'un coup. On
// l'installe sur blue (green sert la 1.5.0), puis un upstream nginx envoie
// une visite sur dix à blue (weight). Après une heure de lecteur·rices
// (simulée à chaque rechargement de nginx), access.log montre des 500 sur
// /kiosk/archives : un bogue que /health ne voit pas. On arrête le
// canari ; les développeur·ses publient la 1.6.1 ; nouveau canari, sans
// erreur ; puis tout le trafic va à blue, green restant allumé.
// Objectif vérifié sur l'état : nginx envoie tout /kiosk/ à une instance
// en 1.6.1 en bonne santé, après un canari de la 1.6.1 sans erreur, et
// l'autre instance tourne toujours.
// Sources : https://nginx.org/en/docs/http/ngx_http_upstream_module.html,
// https://martinfowler.com/bliki/CanaryRelease.html,
// https://sre.google/workbook/canarying-releases/

import { d, f, accountsFiles, type Chapter, type Accounts, type Rights } from '../world';
import type { Game } from '../shell';
import { newSystemd, systemd } from '../systemd';
import { loadNginx, httpRequest, checkNginx } from '../nginx';
import { MIME, NGINX_CONF } from '../commands/apt';
import { gazetteAccounts } from './bare-repo';
import { KIOSK, kioskApp, versionDirectory, readers, distribution, health, kioskService, kioskUnit, type Batch } from './kiosk';

const M = '/home/you';
const GAZETTE = 'gazette.example';
const SITE = '/etc/nginx/sites-available/gazette';

const accounts = (): Accounts => {
  const c = gazetteAccounts();
  c.users.kiosk = { uid: 997, group: 'kiosk', home: KIOSK, shell: '/usr/sbin/nologin' };
  c.groups.kiosk = { gid: 997, members: [] };
  c.groups.adm = { gid: 4, members: ['you'] };
  return c;
};

// La configuration de la fin du chapitre 3 : green sert le Kiosque.
const conf = (t: Game['t']) => `server {
    listen 80 default_server;
    listen [::]:80 default_server;
    server_name ${GAZETTE} www.${GAZETTE};

    root /srv/gazette/current;
    index index.html;

    location / {
        try_files $uri $uri/ =404;
    }

    # ${t('blue-green-conf-comment')}
    location /kiosk/ {
        proxy_pass http://127.0.0.1:3002/;
    }
}`;

const sd = (j: Game) => systemd(j)!;
const enabled = (j: Game, colour: string) => sd(j).services[`kiosk-${colour}`]?.state === 'active';
const lastBatch = (j: Game): Batch | undefined => j.state.dernierLot;
const output = (j: Game) => [j.last.output, ...j.last.errors].join('\n');

export const canary: Chapter = {
  id: 'canary',
  number: 4,
  commands: [
    'ls',
    'cd',
    'pwd',
    'cat',
    'less',
    'head',
    'tail',
    'grep',
    'awk',
    'sort',
    'uniq',
    'wc',
    'cut',
    'diff',
    'cp',
    'mv',
    'ln',
    'readlink',
    'echo',
    'id',
    'whoami',
    'date',
    'sudo',
    'nano',
    'curl',
    'nginx',
    'systemctl',
    'journalctl',
    'ps',
  ],
  home: M,
  welcome: 'message_from_samia.txt',
  names: true,
  final: 'end',
  password: 'gazette-2027',
  accounts,
  state: () => ({
    systemd: newSystemd('gazette', Date.UTC(2027, 4, 2, 6, 40, 0), Date.UTC(2027, 5, 7, 9, 0, 0), {
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
      'kiosk-blue': kioskService('blue', 1501),
      'kiosk-green': kioskService('green', 1502),
    }),
    processus: [
      { pid: 1, user: 'root', cpu: 0, mem: 0.1, command: '/sbin/init' },
      { pid: 604, user: 'root', cpu: 0, mem: 0.2, command: 'sshd: /usr/sbin/sshd -D [listener] 0 of 10-100 startups' },
      { pid: 801, user: 'root', cpu: 0, mem: 0.3, command: 'nginx: master process /usr/sbin/nginx -g daemon on; master_process on;' },
      { pid: 802, user: 'www-data', cpu: 0.1, mem: 0.6, command: 'nginx: worker process' },
      { pid: 1501, user: 'kiosk', cpu: 0.6, mem: 3.1, command: `node ${KIOSK}/blue/serveur.js` },
      { pid: 1502, user: 'kiosk', cpu: 0.6, mem: 3.1, command: `node ${KIOSK}/green/serveur.js` },
    ],
    nginx: { load: null, names: ['gazette', GAZETTE, `www.${GAZETTE}`, '192.0.2.16'], journalAcces: true },
    applis: { '127.0.0.1:3001': kioskApp('blue'), '127.0.0.1:3002': kioskApp('green') },
  }),
  initialise: (j) => {
    loadNginx(j);
    sd(j).services['kiosk-blue'].load!(j);
    sd(j).services['kiosk-green'].load!(j);
    j.state.configVue = JSON.stringify(j.state.nginx.load);
  },
  // À chaque nouvelle configuration de nginx, une heure de lecteur·rices passe.
  afterCommand: (j) => {
    const view = JSON.stringify(j.state.nginx.load);
    if (view === j.state.configVue) return;
    j.state.configVue = view;
    const batch = readers(j);
    j.state.dernierLot = batch;
    j.state.lots = [...(j.state.lots ?? []), batch];
    if (batch.byVersion['1.6.1']?.visits && !batch.byVersion['1.6.1'].errors && (distribution(j).blue ?? 0) < 1) j.state.canariPropre = true;
    return j.t('canary-one-time', { visites: batch.total });
  },
  createWorld: (t) => {
    const root: Rights = { owner: 'root' };
    const place = (children: Parameters<typeof d>[0], rights: Rights = root) => d(children, undefined, rights);
    const file = (text: string, rights: Rights = root) => f(text, { lines: true, ...rights });
    const kiosk: Rights = { owner: 'kiosk', group: 'kiosk' };
    return place({
      etc: place({
        ...accountsFiles(),
        hostname: file('gazette'),
        kiosk: place({
          'kiosk.env': file(
            'KIOSK_BASE=postgres://kiosk@localhost/kiosk\nKIOSK_LIST=lettre@gazette.example\nKIOSK_SMTP=smtp.gazette.example',
            { owner: 'root', group: 'kiosk', mode: 'rw-r-----' },
          ),
        }),
        nginx: place({
          'nginx.conf': file(NGINX_CONF),
          'mime.types': file(MIME),
          'conf.d': place({}),
          'modules-enabled': place({}),
          'sites-available': place({ gazette: file(conf(t)) }),
          'sites-enabled': place({ gazette: f('', { owner: 'root', link: SITE }) }),
        }),
        systemd: place({
          system: place({ 'kiosk-blue.service': file(kioskUnit('blue')), 'kiosk-green.service': file(kioskUnit('green')) }),
        }),
      }),
      home: place({
        you: d({ 'message_from_samia.txt': f(t('canary-message-samia')) }),
        samia: place({}, { owner: 'samia', mode: 'rwx------' }),
        theo: place({}, { owner: 'theo', mode: 'rwx------' }),
      }),
      srv: place({
        gazette: place({
          releases: place({ '20270524090000': place({ 'index.html': file(t('rollback-site-welcome'), { owner: 'you' }) }) }),
          current: f('', { owner: 'you', link: '/srv/gazette/releases/20270524090000' }),
        }),
        kiosk: place(
          {
            versions: place(
              {
                '1.4.2': versionDirectory(t, '1.4.2'),
                '1.5.0': versionDirectory(t, '1.5.0', 'blue-green-notes-150'),
                '1.6.0': versionDirectory(t, '1.6.0', 'canary-notes-160'),
              },
              kiosk,
            ),
            blue: f('', { ...kiosk, link: `${KIOSK}/versions/1.4.2` }),
            green: f('', { ...kiosk, link: `${KIOSK}/versions/1.5.0` }),
          },
          { ...kiosk, group: 'redaction', mode: 'rwxrwxr-x' },
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
      id: 'all-one-coup',
      condition: (j) => (distribution(j).blue ?? 0) === 1 && !!lastBatch(j)?.byVersion['1.6.0']?.errors && !j.state.canari160,
      message: (j) => j.t('canary-event-all-one-coup', { erreurs: lastBatch(j)!.errors }),
    },
    {
      id: 'canary-160',
      condition: (j) => {
        const parts = distribution(j);
        const ok = (parts.blue ?? 0) > 0 && (parts.blue ?? 0) <= 0.25 && !!lastBatch(j)?.byVersion['1.6.0'];
        if (ok) j.state.canari160 = true;
        return ok;
      },
      message: (j) => j.t('canary-event-canary-160'),
    },
    {
      id: 'too-big',
      condition: (j) => (distribution(j).blue ?? 0) > 0.25 && (distribution(j).blue ?? 0) < 1,
      message: (j) => j.t('canary-event-too-big'),
    },
    {
      id: 'found',
      condition: (j) => !!j.state.canari160 && /" 500 \d+ /.test(output(j)) && output(j).includes('/kiosk/archives'),
      message: (j) => j.t('canary-event-found'),
    },
    {
      id: 'stopped',
      condition: (j) => !!j.state.canari160 && (distribution(j).blue ?? 0) === 0 && (distribution(j).green ?? 0) > 0,
      message: (j) => j.t('canary-event-stopped'),
      // Les développeur·ses publient le correctif.
      action: (j) => {
        const versions = j.find(`${KIOSK}/versions`);
        if (versions?.type === 'dossier') versions.children['1.6.1'] = versionDirectory(j.t, '1.6.1', 'canary-notes-161');
      },
    },
    { id: 'canary-161', condition: (j) => !!j.state.canariPropre, message: (j) => j.t('canary-event-canary-161') },
    {
      id: 'end',
      condition: (j) => {
        const s = health(j, 'blue');
        return (
          !!j.state.canariPropre &&
          (distribution(j).blue ?? 0) === 1 &&
          s?.status === 'ok' &&
          s.version === '1.6.1' &&
          enabled(j, 'green') &&
          httpRequest(j, GAZETTE, '/kiosk/archives', 80, false)?.code === 200
        );
      },
      message: (j) => j.t('canary-event-end'),
    },
  ],
};
