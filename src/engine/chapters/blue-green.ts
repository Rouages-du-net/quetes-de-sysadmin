// Story "The Gazette" — chapter "Blue and green": updating the Kiosk (the
// subscriptions app) without downtime. 1.4.2 runs on the blue slot (port
// 3001), which nginx serves under /kiosk/. You install 1.5.0 on the green
// slot (port 3002) and check its health (/health): it lacks a configuration
// variable, which its release notes announce. Once green is healthy, nginx
// switches to it (proxy_pass, nginx -t, reload); blue stays up for an
// instant rollback.
// Objective checked on the state: nginx (configuration loaded) sends
// /kiosk/ to a healthy 1.5.0 instance, and the other instance is still
// running.
// Sources: https://martinfowler.com/bliki/BlueGreenDeployment.html,
// https://nginx.org/en/docs/http/ngx_http_proxy_module.html#proxy_pass,
// https://nginx.org/en/docs/beginners_guide.html#control

import { d, f, name, accountsFiles, type Chapter, type Accounts, type Rights } from '../world';
import type { Game } from '../shell';
import { newSystemd, systemd } from '../systemd';
import { loadNginx, httpRequest, checkNginx, type Configuration } from '../nginx';
import { MIME, NGINX_CONF } from '../commands/apt';
import { gazetteAccounts } from './bare-repo';
import { KIOSK, PORTS, kioskApp, versionDirectory, instances, health, kioskService, kioskUnit, linkVersion } from './kiosk';

const M = '/home/you';
const GAZETTE = 'gazette.example';
const SITE = '/etc/nginx/sites-available/gazette';

const accounts = (): Accounts => {
  const c = gazetteAccounts();
  c.users.kiosk = { uid: 997, group: 'kiosk', home: KIOSK, shell: '/usr/sbin/nologin' };
  c.groups.kiosk = { gid: 997, members: [] };
  return c;
};

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
        proxy_pass http://127.0.0.1:3001/;
    }
}`;

const sd = (j: Game) => systemd(j)!;
const enabled = (j: Game, colour: string) => sd(j).services[`kiosk-${colour}`]?.state === 'active';
// The colour nginx sends /kiosk/ to (configuration loaded).
const served = (j: Game): string | null => {
  const config: Configuration | null = j.state.nginx?.load ?? null;
  const proxy = config?.servers.flatMap((s) => s.locations).find((l) => l.path === '/kiosk/')?.proxy ?? '';
  return Object.keys(PORTS).find((c) => proxy.includes(`:${PORTS[c]}`)) ?? null;
};
const okReaders = (j: Game) => httpRequest(j, GAZETTE, '/kiosk/', 80, false)?.code === 200;
const output = (j: Game) => [j.last.output, ...j.last.errors].join('\n');

export const greenBlue: Chapter = {
  id: 'blue-green',
  number: 3,
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
    'ln',
    'readlink',
    'chmod',
    'echo',
    'tee',
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
    systemd: newSystemd('gazette', Date.UTC(2027, 4, 2, 6, 40, 0), Date.UTC(2027, 4, 24, 14, 0, 0), {
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
      'kiosk-green': kioskService('green', 1502, 'inactive'),
    }),
    process: [
      { pid: 1, user: 'root', cpu: 0, mem: 0.1, command: '/sbin/init' },
      { pid: 604, user: 'root', cpu: 0, mem: 0.2, command: 'sshd: /usr/sbin/sshd -D [listener] 0 of 10-100 startups' },
      { pid: 801, user: 'root', cpu: 0, mem: 0.3, command: 'nginx: master process /usr/sbin/nginx -g daemon on; master_process on;' },
      { pid: 802, user: 'www-data', cpu: 0.1, mem: 0.6, command: 'nginx: worker process' },
      { pid: 1501, user: 'kiosk', cpu: 0.6, mem: 3.1, command: `node ${KIOSK}/blue/server.js` },
    ],
    nginx: { load: null, names: ['gazette', GAZETTE, `www.${GAZETTE}`, '192.0.2.16'] },
    apps: { '127.0.0.1:3001': kioskApp('blue'), '127.0.0.1:3002': kioskApp('green') },
  }),
  initialise: (j) => {
    loadNginx(j);
    // blue has been running since the machine booted: its version and configuration from back then.
    sd(j).services['kiosk-blue'].load!(j);
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
          'kiosk.env': file(`KIOSK_BASE=postgres://kiosk@localhost/kiosk\nKIOSK_LIST=${name(t, 'newsletter')}@gazette.example`, {
            owner: 'root',
            group: 'kiosk',
            mode: 'rw-r-----',
          }),
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
        you: d({ 'message_from_samia.txt': f(t('blue-green-message-samia')) }),
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
            versions: place({ '1.4.2': versionDirectory(t, '1.4.2'), '1.5.0': versionDirectory(t, '1.5.0', 'blue-green-notes-150') }, kiosk),
            blue: f('', { ...kiosk, link: `${KIOSK}/versions/1.4.2` }),
            green: f('', { ...kiosk, link: `${KIOSK}/versions/1.4.2` }),
          },
          { ...kiosk, group: 'newsroom', mode: 'rwxrwxr-x' },
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
      id: 'health-ko',
      condition: (j) => output(j).includes('"status":"error"') && output(j).includes('is not set'),
      message: (j) => j.t('blue-green-event-health-ko'),
    },
    {
      id: 'not-restarts',
      condition: (j) =>
        enabled(j, 'green') &&
        !!instances(j).green &&
        linkVersion(j, 'green') !== instances(j).green.version &&
        output(j).includes(`"version":"${instances(j).green.version}"`),
      message: (j) => j.t('blue-green-event-not-restarts'),
    },
    { id: 'too-early', condition: (j) => !okReaders(j), message: (j) => j.t('blue-green-event-too-early') },
    {
      id: 'not-reload',
      condition: (j) => (j.read(SITE) ?? '').includes('127.0.0.1:3002') && served(j) === 'blue' && j.last.commands.some((c) => c[0] === 'curl'),
      message: (j) => j.t('blue-green-event-not-reload'),
    },
    { id: 'more-net', condition: (j) => served(j) === 'green' && !enabled(j, 'blue'), message: (j) => j.t('blue-green-event-more-net') },
    {
      id: 'end',
      condition: (j) => {
        const c = served(j);
        const other = c === 'blue' ? 'green' : 'blue';
        const s = c ? health(j, c) : null;
        return !!c && s?.status === 'ok' && s.version === '1.5.0' && okReaders(j) && enabled(j, other);
      },
      message: (j) => j.t('blue-green-event-end'),
    },
  ],
};
