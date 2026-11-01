// Story "The Neighbourhood Letters" — chapter "Concert night": read the
// access logs with awk, and limit the request rate with nginx. Tonight, the
// café announces a concert; the events calendar (an app that serves 20
// requests per second) no longer answers: a bot is scraping its pages from
// three addresses, 24 requests per second in total. Visitors get 504s.
// After each nginx reload, the game makes a minute of traffic pass
// (visitors: a page and its four files at once, then another page; bot: 8
// requests per second per address); the access log shows it.
// Objective checked on the state: during the last minute, all the visitors'
// requests were served, and rate limiting refused at least 60 % of the
// bot's requests (429 or 503).
// Sources: https://nginx.org/en/docs/http/ngx_http_limit_req_module.html,
// https://blog.nginx.org/blog/rate-limiting-nginx, https://pubs.opengroup.org/onlinepubs/9799919799/utilities/awk.html

import { d, f, accountsFiles, name, type Chapter, type Accounts, type Rights } from '../world';
import type { Game } from '../shell';
import { newSystemd, systemd } from '../systemd';
import { loadNginx, httpRequest, checkNginx, type App, type Client } from '../nginx';
import { MIME, NGINX_CONF, SITE_BY_DEFAULT } from '../commands/apt';
import { agendaDescription, agendaPages, agendaProgram } from './sharing';

const M = '/home/you';
const LETTERS = 'letters.example';
const ROBOTS = ['198.51.100.23', '198.51.100.24', '198.51.100.25'];
const HUMANS = ['203.0.113.41', '203.0.113.57', '192.0.2.77', '203.0.113.83', '192.0.2.140', '203.0.113.201'];
const BROWSER = 'Mozilla/5.0 (X11; Linux x86_64; rv:128.0) Gecko/20100101 Firefox/128.0';
const SCRAPER = 'AgendaScraper/2.1 (+http://scraper.example/bot)';
const FILES = ['/agenda/style.css', '/agenda/app.js', '/agenda/logo.png', '/agenda/plan.png'];

const accounts = (): Accounts => ({
  users: {
    root: { uid: 0, group: 'root', home: '/root' },
    'www-data': { uid: 33, group: 'www-data', home: '/var/www', shell: '/usr/sbin/nologin' },
    agenda: { uid: 998, group: 'agenda', home: '/opt/agenda', shell: '/usr/sbin/nologin' },
    you: { uid: 1000, group: 'you' },
    rania: { uid: 1001, group: 'rania' },
  },
  groups: {
    root: { gid: 0, members: [] },
    adm: { gid: 4, members: ['you'] },
    sudo: { gid: 27, members: ['you', 'rania'] },
    'www-data': { gid: 33, members: [] },
    agenda: { gid: 998, members: [] },
    you: { gid: 1000, members: [] },
    rania: { gid: 1001, members: [] },
  },
});

// The Letters' site at the end of "Sharing a home".
const LETTERS_CONF = `server {
    listen 80 default_server;
    listen [::]:80 default_server;
    server_name ${LETTERS} www.${LETTERS};

    root /var/www/letters;
    index index.html;

    location /agenda/ {
        proxy_pass http://127.0.0.1:3000/;
    }

    location / {
        try_files $uri $uri/ =404;
    }
}`;

interface Summary {
  humans: number;
  servedHumans: number;
  robot: number;
  limitRobot: number;
  forbiddenRobot: number;
  exceeded: number;
  limitsHumans: number;
}

/**
 * One minute of traffic from `start` (local time): each request goes
 * through the simulated nginx, and is written to access.log.
 */
function minute(j: Game, start: number): Summary {
  const requests: { time: number; address: string; path: string; human: boolean }[] = [];
  HUMANS.forEach((address, i) => {
    const t = start + 5_000 + i * 9_000;
    requests.push({ time: t, address, path: '/agenda/', human: true });
    FILES.forEach((path, k) => requests.push({ time: t + 40 + k * 30, address, path, human: true }));
    requests.push({ time: t + 21_000, address, path: `/agenda/${name(j.t, i % 2 ? 'workshops' : 'week')}`, human: true });
  });
  ROBOTS.forEach((address, r) => {
    for (let k = 0; k < 480; k++)
      requests.push({ time: start + r * 41 + k * 125, address, path: `/agenda/${name(j.t, 'workshops')}?page=${((k * 3 + r) % 240) + 1}`, human: false });
  });
  requests.sort((a, b) => a.time - b.time);
  const summary: Summary = { humans: 0, servedHumans: 0, robot: 0, limitRobot: 0, forbiddenRobot: 0, exceeded: 0, limitsHumans: 0 };
  for (const q of requests) {
    const client: Client = { address: q.address, time: q.time, agent: q.human ? BROWSER : SCRAPER };
    const code = httpRequest(j, LETTERS, q.path, 80, true, client)?.code ?? 0;
    if (code === 504) summary.exceeded++;
    if (q.human) {
      summary.humans++;
      if (code === 200) summary.servedHumans++;
      if (code === 429 || code === 503) summary.limitsHumans++;
    } else {
      summary.robot++;
      if (code === 429 || code === 503) summary.limitRobot++;
      if (code === 403) summary.forbiddenRobot++;
    }
  }
  systemd(j)!.clock = Math.max(start + 60_000, requests.at(-1)!.time + 1_000);
  return summary;
}

const summary = (j: Game): Summary | undefined => j.state.concertSummary;
const succeeded = (b?: Summary) => !!b && b.servedHumans === b.humans && b.limitRobot >= b.robot * 0.6;

export const concert: Chapter = {
  id: 'concert',
  number: 6,
  commands: [
    'ls',
    'cd',
    'pwd',
    'cat',
    'less',
    'head',
    'tail',
    'grep',
    'wc',
    'sort',
    'uniq',
    'cut',
    'awk',
    'echo',
    'tee',
    'cp',
    'nano',
    'sudo',
    'nginx',
    'systemctl',
    'journalctl',
    'curl',
    'ps',
    'id',
    'whoami',
  ],
  home: M,
  welcome: 'message_from_kofi.txt',
  names: true,
  final: 'end',
  password: 'ants-2026',
  accounts,
  state: (t) => ({
    systemd: newSystemd('letters', Date.UTC(2027, 2, 1, 6, 12, 0), Date.UTC(2027, 2, 27, 20, 3, 0), {
      ssh: {
        description: 'OpenBSD Secure Shell server',
        active: true,
        executable: 'sshd',
        process: [{ pid: 612, user: 'root', cpu: 0, mem: 0.2, command: 'sshd: /usr/sbin/sshd -D [listener] 0 of 10-100 startups' }],
      },
      nginx: {
        description: 'A high performance web server and a reverse proxy server',
        active: true,
        executable: 'nginx',
        process: [
          { pid: 801, user: 'root', cpu: 0, mem: 0.3, command: 'nginx: master process /usr/sbin/nginx -g daemon on; master_process on;' },
          { pid: 802, user: 'www-data', cpu: 12.4, mem: 0.9, command: 'nginx: worker process' },
        ],
        check: checkNginx,
        load: loadNginx,
        checkToReload: true,
      },
      agenda: {
        description: agendaDescription(t),
        active: true,
        executable: 'node',
        process: [{ pid: 1450, user: 'agenda', cpu: 99.2, mem: 6.8, command: agendaProgram(t) }],
      },
    }),
    process: [
      { pid: 1, user: 'root', cpu: 0, mem: 0.1, command: '/sbin/init' },
      { pid: 612, user: 'root', cpu: 0, mem: 0.2, command: 'sshd: /usr/sbin/sshd -D [listener] 0 of 10-100 startups' },
      { pid: 801, user: 'root', cpu: 0, mem: 0.3, command: 'nginx: master process /usr/sbin/nginx -g daemon on; master_process on;' },
      { pid: 802, user: 'www-data', cpu: 12.4, mem: 0.9, command: 'nginx: worker process' },
      { pid: 1450, user: 'agenda', cpu: 99.2, mem: 6.8, command: agendaProgram(t) },
    ],
    nginx: { load: null, names: ['letters', LETTERS, `www.${LETTERS}`, '203.0.113.10'], accessLog: true },
    apps: {
      '127.0.0.1:3000': {
        service: 'agenda',
        capacity: 20,
        pages: {
          ...agendaPages(t),
          '/style.css': '(CSS)',
          '/app.js': '(JavaScript)',
          '/logo.png': '(PNG)',
          '/plan.png': '(PNG)',
        },
      } satisfies App,
    },
  }),
  // The last two minutes of traffic, before the player arrives.
  initialise: (j) => {
    loadNginx(j);
    minute(j, Date.UTC(2027, 2, 27, 20, 3, 0));
    j.state.concertSummary = minute(j, Date.UTC(2027, 2, 27, 20, 4, 0));
    j.state.concertLoaded = j.state.nginx.load;
  },
  // After each successful nginx reload, one minute of traffic passes.
  afterCommand: (j) => {
    if (j.state.nginx.load === j.state.concertLoaded || systemd(j)!.services.nginx.state !== 'active') return;
    j.state.concertLoaded = j.state.nginx.load;
    const b = minute(j, Math.ceil(systemd(j)!.clock / 60_000) * 60_000);
    j.state.concertSummary = b;
    return j.t('concert-minute', {
      humans: b.humans,
      served: b.servedHumans,
      robot: b.robot,
      refused: b.limitRobot + b.forbiddenRobot,
      exceeded: b.exceeded,
    });
  },
  createWorld: (t) => {
    const root = { owner: 'root' };
    const place = (children: Parameters<typeof d>[0], rights: Rights = root) => d(children, undefined, rights);
    const file = (text: string, rights: Rights = root) => f(text, { lines: true, ...rights });
    return place({
      etc: place({
        ...accountsFiles(),
        hostname: file('letters'),
        nginx: place({
          'nginx.conf': file(NGINX_CONF),
          'mime.types': file(MIME),
          'conf.d': place({}),
          'modules-enabled': place({}),
          'sites-available': place({ default: file(SITE_BY_DEFAULT), letters: file(LETTERS_CONF) }),
          'sites-enabled': place({ letters: f('', { owner: 'root', link: '/etc/nginx/sites-available/letters' }) }),
        }),
      }),
      home: place({ you: d({ 'message_from_kofi.txt': f(t('concert-message-kofi')), 'help_logs.txt': f(t('concert-help-logs')) }) }),
      usr: place({ sbin: place({ nginx: f('', { owner: 'root', mode: 'rwxr-xr-x', size: 1_342_520 }) }) }),
      var: place({
        www: place({ letters: place({ 'index.html': file(t('sharing-site-letters')) }) }),
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
      id: 'robot',
      condition: (j) => j.last.commands.some((c) => ['awk', 'cut', 'uniq'].includes(c[0])) && ROBOTS.some((r) => j.last.output.includes(r)),
      message: (j) => j.t('concert-event-robot'),
    },
    {
      id: 'forbidden',
      condition: (j) => (summary(j)?.forbiddenRobot ?? 0) > 0,
      message: (j) => j.t('concert-event-forbidden'),
    },
    {
      id: 'humans-limits',
      condition: (j) => (summary(j)?.limitsHumans ?? 0) > 0,
      message: (j) => j.t('concert-event-humans-limits'),
    },
    {
      id: 'still-too',
      condition: (j) => {
        const b = summary(j);
        return !!b && b.limitRobot > 0 && b.limitsHumans === 0 && !succeeded(b);
      },
      message: (j) => j.t('concert-event-still-too'),
    },
    {
      id: 'end',
      condition: (j) => succeeded(summary(j)),
      message: (j) => j.t('concert-event-end'),
    },
  ],
};
