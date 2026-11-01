// Histoire « Les Lettres du quartier » — chapitre « Le soir du concert » :
// lire les journaux d'accès avec awk, et limiter le débit avec nginx. Ce
// soir, le café annonce un concert ; l'agenda (une appli qui sert 20
// requêtes par seconde) ne répond plus : un robot aspire ses pages depuis
// trois adresses, 24 requêtes par seconde en tout. Les visiteur·ses
// reçoivent des 504.
// Après chaque rechargement de nginx, le jeu fait passer une minute de
// trafic (visiteur·ses : une page et ses quatre fichiers d'un coup, puis une
// autre page ; robot : 8 requêtes par seconde et par adresse) ; le journal
// d'accès la montre.
// Objectif vérifié sur l'état : pendant la dernière minute, toutes les
// requêtes des visiteur·ses ont été servies, et la limitation de débit a
// refusé au moins 60 % des requêtes du robot (429 ou 503).
// Sources : https://nginx.org/en/docs/http/ngx_http_limit_req_module.html,
// https://blog.nginx.org/blog/rate-limiting-nginx, https://pubs.opengroup.org/onlinepubs/9799919799/utilities/awk.html

import { d, f, accountsFiles, type Chapter, type Accounts, type Rights } from '../world';
import type { Game } from '../shell';
import { newSystemd, systemd } from '../systemd';
import { loadNginx, httpRequest, checkNginx, type App, type Client } from '../nginx';
import { MIME, NGINX_CONF, SITE_BY_DEFAULT } from '../commands/apt';

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

// Le site des Lettres à la fin de « La colocation ».
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
 * Une minute de trafic à partir de `debut` (heure locale) : chaque requête
 * passe par le nginx simulé, et s'écrit dans access.log.
 */
function minute(j: Game, start: number): Summary {
  const requests: { time: number; address: string; path: string; human: boolean }[] = [];
  HUMANS.forEach((address, i) => {
    const t = start + 5_000 + i * 9_000;
    requests.push({ time: t, address, path: '/agenda/', human: true });
    FILES.forEach((path, k) => requests.push({ time: t + 40 + k * 30, address, path, human: true }));
    requests.push({ time: t + 21_000, address, path: i % 2 ? '/agenda/ateliers' : '/agenda/semaine', human: true });
  });
  ROBOTS.forEach((address, r) => {
    for (let k = 0; k < 480; k++)
      requests.push({ time: start + r * 41 + k * 125, address, path: `/agenda/ateliers?page=${((k * 3 + r) % 240) + 1}`, human: false });
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

const summary = (j: Game): Summary | undefined => j.state.concertBilan;
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
  final: 'fin',
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
        description: 'Agenda des ateliers (Node.js)',
        active: true,
        executable: 'node',
        process: [{ pid: 1450, user: 'agenda', cpu: 99.2, mem: 6.8, command: 'node /opt/agenda/serveur.js' }],
      },
    }),
    processus: [
      { pid: 1, user: 'root', cpu: 0, mem: 0.1, command: '/sbin/init' },
      { pid: 612, user: 'root', cpu: 0, mem: 0.2, command: 'sshd: /usr/sbin/sshd -D [listener] 0 of 10-100 startups' },
      { pid: 801, user: 'root', cpu: 0, mem: 0.3, command: 'nginx: master process /usr/sbin/nginx -g daemon on; master_process on;' },
      { pid: 802, user: 'www-data', cpu: 12.4, mem: 0.9, command: 'nginx: worker process' },
      { pid: 1450, user: 'agenda', cpu: 99.2, mem: 6.8, command: 'node /opt/agenda/serveur.js' },
    ],
    nginx: { load: null, names: ['letters', LETTERS, `www.${LETTERS}`, '203.0.113.10'], journalAcces: true },
    applis: {
      '127.0.0.1:3000': {
        service: 'agenda',
        capacity: 20,
        pages: {
          '/': t('sharing-agenda-accueil'),
          '/semaine': t('sharing-agenda-semaine'),
          '/ateliers': t('sharing-agenda-ateliers'),
          '/style.css': '(CSS)',
          '/app.js': '(JavaScript)',
          '/logo.png': '(PNG)',
          '/plan.png': '(PNG)',
        },
      } satisfies App,
    },
  }),
  // Les deux dernières minutes de trafic, avant l'arrivée de la joueuse ou du joueur.
  initialise: (j) => {
    loadNginx(j);
    minute(j, Date.UTC(2027, 2, 27, 20, 3, 0));
    j.state.concertBilan = minute(j, Date.UTC(2027, 2, 27, 20, 4, 0));
    j.state.concertCharge = j.state.nginx.load;
  },
  // Après chaque rechargement réussi de nginx, une minute de trafic passe.
  afterCommand: (j) => {
    if (j.state.nginx.load === j.state.concertCharge || systemd(j)!.services.nginx.state !== 'active') return;
    j.state.concertCharge = j.state.nginx.load;
    const b = minute(j, Math.ceil(systemd(j)!.clock / 60_000) * 60_000);
    j.state.concertBilan = b;
    return j.t('concert-minute', {
      humains: b.humans,
      servis: b.servedHumans,
      robot: b.robot,
      refuses: b.limitRobot + b.forbiddenRobot,
      depasses: b.exceeded,
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
      home: place({ you: d({ 'message_from_kofi.txt': f(t('concert-message-de-kofi')), 'help_logs.txt': f(t('concert-aide-journaux')) }) }),
      usr: place({ sbin: place({ nginx: f('', { owner: 'root', mode: 'rwxr-xr-x', size: 1_342_520 }) }) }),
      var: place({
        www: place({ letters: place({ 'index.html': file(t('sharing-site-lettres')) }) }),
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
      message: (j) => j.t('concert-evenement-robot'),
    },
    {
      id: 'interdit',
      condition: (j) => (summary(j)?.forbiddenRobot ?? 0) > 0,
      message: (j) => j.t('concert-evenement-interdit'),
    },
    {
      id: 'humains-limites',
      condition: (j) => (summary(j)?.limitsHumans ?? 0) > 0,
      message: (j) => j.t('concert-evenement-humains-limites'),
    },
    {
      id: 'encore-trop',
      condition: (j) => {
        const b = summary(j);
        return !!b && b.limitRobot > 0 && b.limitsHumans === 0 && !succeeded(b);
      },
      message: (j) => j.t('concert-evenement-encore-trop'),
    },
    {
      id: 'fin',
      condition: (j) => succeeded(summary(j)),
      message: (j) => j.t('concert-evenement-fin'),
    },
  ],
};
