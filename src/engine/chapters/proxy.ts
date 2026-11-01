// Story "The Co-op" — chapter "The proxy": since this morning, nobody can
// log in to the till any more ("Too many attempts"). A bot is trying
// passwords; the app locks the address that fails five times… but behind
// nginx, every request reaches it from 127.0.0.1: it has locked everyone out.
//   - nginx must tell the app who the real client is:
//     proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for (or $remote_addr);
//   - the app must only trust that header if it comes from nginx:
//     TRUST_PROXY=loopback (and not true: the bot writes its own fake
//     X-Forwarded-For on each attempt, which nginx merely appends to);
//   - reload nginx, restart the app (which forgets its locks).
// On each nginx reload or app start, the game replays five minutes of
// traffic: the bot (198.51.100.66, a different fake X-Forwarded-For on each
// attempt), then Lina logging in.
// Objective checked on that traffic: Lina gets in, and it is indeed the
// bot's address that is locked.
// Sources: https://nginx.org/en/docs/http/ngx_http_proxy_module.html#proxy_set_header,
// https://expressjs.com/en/guide/behind-proxies.html

import { f, type Chapter } from '../world';
import type { Game } from '../shell';
import { loadNginx } from '../nginx';
import { cooperativeAccounts, M, cooperativeWorld, PASSWORD } from './coop';
import { till, NEW_KEY, tillEnv, tillState, tillWorld, BINARY_NGINX, nginxCooperative, tillSystemd, visit, loginPath } from './till-web';
import type { Translate } from '../../texts';

const ROBOT = '198.51.100.66';
const LINA = '192.0.2.44';

// The site, with the previous chapter's fix.
const SITE = `server {
    listen 80 default_server;
    listen [::]:80 default_server;

    server_name coop.example www.coop.example;

    root /srv/till/app;
    index index.html;

    deny 203.0.113.77;

    location ~ /\\. {
        deny all;
    }

    location /till/ {
        proxy_pass http://127.0.0.1:3000/;
    }
}`;

// nginx's access log: the login page's path is the language's (/till/login…).
const access = (t: Translate) => {
  const login = `/till${loginPath(t)}`;
  const robot = (n: number) =>
    `${ROBOT} - - [19/Oct/2027:07:5${Math.floor(n / 10)}:${String((n % 10) * 6).padStart(2, '0')} +0200] "POST ${login} HTTP/1.1" ${n < 5 ? 401 : 429} 41 "-" "python-requests/2.32.3"`;
  return [
    ...Array.from({ length: 12 }, (_, n) => robot(n)),
    `${LINA} - - [19/Oct/2027:08:58:30 +0200] "GET /till/ HTTP/1.1" 200 95 "-" "Mozilla/5.0 (X11; Linux x86_64)"`,
    `${LINA} - - [19/Oct/2027:08:58:44 +0200] "POST ${login} HTTP/1.1" 429 52 "-" "Mozilla/5.0 (X11; Linux x86_64)"`,
    `192.0.2.51 - - [19/Oct/2027:09:12:03 +0200] "POST ${login} HTTP/1.1" 429 52 "-" "Mozilla/5.0 (Android 14)"`,
  ].join('\n');
};

const APP_LOG = [
  '2027-10-19 05:00:02 till listening on 127.0.0.1:3000',
  ...Array.from({ length: 5 }, (_, n) => `2027-10-19 05:5${n}:0${n} login failed for admin from 127.0.0.1`),
  '2027-10-19 05:54:04 locked 127.0.0.1 for 15 minutes',
  '2027-10-19 06:58:44 rejected login for lina from 127.0.0.1 (locked)',
  '2027-10-19 07:12:03 rejected login for karim from 127.0.0.1 (locked)',
].join('\n');

// Five minutes of traffic: the bot (a fake X-Forwarded-For on each attempt), then Lina.
function simulate(j: Game) {
  const c = till(j);
  if (!c || !j.state.nginx?.load) return;
  const login = `/till${loginPath(j.t)}`;
  for (let n = 0; n < 8; n++)
    visit(j, login, {
      address: ROBOT,
      method: 'POST',
      agent: 'python-requests/2.32.3',
      headers: { 'x-forwarded-for': `10.${n + 1}.${n * 7}.${n + 3}`, 'x-account': 'admin', 'x-password': `attempt${n}` },
    });
  const r = visit(j, login, { address: LINA, method: 'POST', headers: { 'x-account': 'lina', 'x-password': 'good' } });
  j.state.simulation = { lina: r?.code === 200, lockedRobot: c.banned.includes(ROBOT), banned: [...c.banned] };
}

type Simulation = { lina: boolean; lockedRobot: boolean; banned: string[] } | undefined;
const sim = (j: Game) => j.state.simulation as Simulation;

export const proxy: Chapter = {
  id: 'proxy',
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
    'nano',
    'sudo',
    'id',
    'whoami',
    'systemctl',
    'journalctl',
    'nginx',
    'curl',
  ],
  home: M,
  welcome: 'email_awa.txt',
  names: true,
  final: 'end',
  password: PASSWORD,
  accounts: () => cooperativeAccounts(false),
  state: (t) => ({ ...tillState(tillEnv(t, NEW_KEY)), systemd: tillSystemd(simulate, simulate) }),
  initialise: (j) => {
    loadNginx(j);
    // This morning: the bot got 127.0.0.1 locked, that is, everyone.
    till(j).banned = ['127.0.0.1'];
  },
  createWorld: (t) =>
    cooperativeWorld({
      t,
      withoutMarc: true,
      home: { 'email_awa.txt': f(t('proxy-email-awa')) },
      etc: nginxCooperative(SITE),
      sbin: BINARY_NGINX,
      more: tillWorld(t, { env: tillEnv(t, NEW_KEY), envMode: 'rw-------', logAccess: access(t), appLog: APP_LOG }),
    }),
  events: [
    {
      id: 'all-world',
      condition: (j) => !!sim(j) && !sim(j)!.lina && sim(j)!.banned.some((b) => b.startsWith('127.')),
      message: (j) => j.t('proxy-event-all-world'),
    },
    {
      id: 'spoofed',
      condition: (j) => !!sim(j) && sim(j)!.lina && !sim(j)!.lockedRobot,
      message: (j) => j.t('proxy-event-spoofed', { robot: ROBOT }),
    },
    {
      id: 'end',
      condition: (j) => !!sim(j) && sim(j)!.lina && sim(j)!.lockedRobot,
      message: (j) => j.t('proxy-event-end', { robot: ROBOT }),
    },
  ],
};
