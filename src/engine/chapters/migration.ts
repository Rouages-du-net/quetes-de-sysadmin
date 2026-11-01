// Histoire « La Gazette » — chapitre « La migration » : hier soir, Théo a
// mis la 2.0.0 du Kiosque sur green et basculé nginx. Au démarrage, la 2.0.0
// a migré la base (schéma 3 → 4 : la colonne courriel est devenue email).
// Elle ne marche pas (une variable de configuration a changé de nom), et le
// retour arrière vers blue (1.6.1) ne marche pas non plus : la 1.6.1 ne sait
// pas lire une base migrée. Il faut réparer en avant (la configuration
// annoncée dans les notes de version), puis mettre blue en 2.0.0 pour qu'il
// redevienne un vrai filet de sécurité.
// Objectif vérifié sur l'état : nginx sert une instance 2.x en bonne santé,
// l'autre instance tourne aussi en 2.x, en bonne santé.
// Sources : https://martinfowler.com/bliki/ParallelChange.html (étendre puis
// contracter), https://www.postgresql.org/docs/current/app-pgdump.html,
// https://www.freedesktop.org/software/systemd/man/latest/journalctl.html

import { d, f, accountsFiles, type Chapter, type Accounts, type Rights } from '../world';
import type { Game } from '../shell';
import { newSystemd, systemd } from '../systemd';
import { loadNginx, httpRequest, checkNginx } from '../nginx';
import { MIME, NGINX_CONF } from '../commands/apt';
import { gazetteAccounts } from './bare-repo';
import { KIOSK, kioskApp, base, versionDirectory, distribution, health, kioskService, kioskUnit } from './kiosk';

const M = '/home/vous';
const GAZETTE = 'gazette.example';
const SITE = '/etc/nginx/sites-available/gazette';

const accounts = (): Accounts => {
  const c = gazetteAccounts();
  c.users.kiosk = { uid: 997, group: 'kiosk', home: KIOSK, shell: '/usr/sbin/nologin' };
  c.groups.kiosk = { gid: 997, members: [] };
  c.groups.adm = { gid: 4, members: ['vous'] };
  return c;
};

// Théo a basculé nginx vers green, en 2.0.0.
const conf = (t: Game['t']) => `server {
    listen 80 default_server;
    listen [::]:80 default_server;
    server_name ${GAZETTE} www.${GAZETTE};

    root /srv/gazette/current;
    index index.html;

    location / {
        try_files $uri $uri/ =404;
    }

    # ${t('blue-green-conf-commentaire')}
    location /kiosk/ {
        proxy_pass http://127.0.0.1:3002/;
    }
}`;

const sd = (j: Game) => systemd(j)!;
const enabled = (j: Game, colour: string) => sd(j).services[`kiosk-${colour}`]?.state === 'active';
const inTwo = (j: Game, colour: string) => {
  const s = health(j, colour);
  return s?.status === 'ok' && s.version.startsWith('2.');
};
const okReaders = (j: Game) => httpRequest(j, GAZETTE, '/kiosk/', 80, false)?.code === 200;
const served = (j: Game) => Object.entries(distribution(j)).find(([, part]) => part === 1)?.[0] ?? null;
const output = (j: Game) => [j.last.output, ...j.last.errors].join('\n');

export const migration: Chapter = {
  id: 'migration',
  number: 5,
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
  welcome: 'message_de_samia.txt',
  names: true,
  final: 'fin',
  password: 'gazette-2027',
  accounts,
  state: () => ({
    systemd: newSystemd('gazette', Date.UTC(2027, 4, 2, 6, 40, 0), Date.UTC(2027, 5, 15, 8, 30, 0), {
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
    nginx: { load: null, names: ['gazette', GAZETTE, `www.${GAZETTE}`, '192.0.2.16'] },
    applis: { '127.0.0.1:3001': kioskApp('blue'), '127.0.0.1:3002': kioskApp('green') },
  }),
  initialise: (j) => {
    loadNginx(j);
    // Hier soir, 23 h : blue tourne en 1.6.1 ; Théo démarre green en 2.0.0, qui migre la base.
    const now = sd(j).clock;
    sd(j).clock = Date.UTC(2027, 5, 14, 23, 4, 0);
    base(j).schema = 3;
    sd(j).services['kiosk-blue'].load!(j);
    sd(j).services['kiosk-green'].load!(j);
    sd(j).clock = now;
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
        vous: d({ 'message_de_samia.txt': f(t('migration-message-de-samia')), 'mot_de_theo.txt': f(t('migration-mot-de-theo')) }),
        samia: place({}, { owner: 'samia', mode: 'rwx------' }),
        theo: place({}, { owner: 'theo', mode: 'rwx------' }),
      }),
      srv: place({
        gazette: place({
          releases: place({ '20270524090000': place({ 'index.html': file(t('rollback-site-accueil'), { owner: 'vous' }) }) }),
          current: f('', { owner: 'vous', link: '/srv/gazette/releases/20270524090000' }),
        }),
        kiosk: place(
          {
            versions: place(
              {
                '1.4.2': versionDirectory(t, '1.4.2'),
                '1.5.0': versionDirectory(t, '1.5.0', 'blue-green-notes-150'),
                '1.6.0': versionDirectory(t, '1.6.0', 'canary-notes-160'),
                '1.6.1': versionDirectory(t, '1.6.1', 'canary-notes-161'),
                '2.0.0': versionDirectory(t, '2.0.0', 'migration-notes-200'),
              },
              kiosk,
            ),
            blue: f('', { ...kiosk, link: `${KIOSK}/versions/1.6.1` }),
            green: f('', { ...kiosk, link: `${KIOSK}/versions/2.0.0` }),
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
      id: 'vert-malade',
      condition: (j) => output(j).includes('KIOSK_SMTP_URL is not set'),
      message: (j) => j.t('migration-evenement-vert-malade'),
    },
    { id: 'schema', condition: (j) => output(j).includes('is newer than supported'), message: (j) => j.t('migration-evenement-schema') },
    {
      id: 'migration-vue',
      condition: (j) => output(j).includes('rename_abonnes_courriel_to_email'),
      message: (j) => j.t('migration-evenement-migration-vue'),
    },
    {
      id: 'retour-impossible',
      condition: (j) => served(j) === 'blue' && !inTwo(j, 'blue') && !okReaders(j),
      message: (j) => j.t('migration-evenement-retour-impossible'),
    },
    {
      id: 'repare',
      condition: (j) => {
        const c = served(j);
        return !!c && inTwo(j, c) && okReaders(j);
      },
      message: (j) => j.t('migration-evenement-repare'),
    },
    {
      id: 'fin',
      condition: (j) => {
        const c = served(j);
        const other = c === 'blue' ? 'green' : 'blue';
        return !!c && inTwo(j, c) && okReaders(j) && enabled(j, other) && inTwo(j, other);
      },
      message: (j) => j.t('migration-evenement-fin'),
    },
  ],
};
