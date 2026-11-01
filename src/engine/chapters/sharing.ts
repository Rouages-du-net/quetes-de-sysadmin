// Histoire « Les Lettres du quartier » — chapitre « La colocation » : hôtes
// virtuels et reverse proxy avec nginx. Le café associatif veut son site,
// cafe.example, sur le serveur des Lettres ; et l'agenda des ateliers de
// Rania (un petit programme Node.js qui écoute sur 127.0.0.1:3000) doit
// être publié sous http://letters.example/agenda/.
// Commandes : cp, nano, ln -s (sites-available → sites-enabled, comme
// Debian), nginx -t, systemctl reload, curl -H "Host: …", proxy_pass,
// /var/log/nginx/error.log, systemctl enable --now.
// Objectif vérifié sur l'état : nginx sert le site du café pour son nom, le
// site des Lettres reste intact, l'agenda répond sous /agenda/ (y compris
// ses sous-pages), et le service agenda démarrera avec la machine.
// Sources : https://nginx.org/en/docs/http/request_processing.html,
// https://nginx.org/en/docs/http/server_names.html,
// https://nginx.org/en/docs/http/ngx_http_proxy_module.html#proxy_pass

import { d, f, accountsFiles, type Chapter, type Accounts, type Rights } from '../world';
import type { Game } from '../shell';
import { newSystemd, systemd } from '../systemd';
import { loadNginx, httpRequest, checkNginx, type App } from '../nginx';
import { WELCOME, MIME, NGINX_CONF, SITE_BY_DEFAULT } from '../commands/apt';

const M = '/home/vous';
const LETTERS = 'letters.example';
const CAFE = 'cafe.example';

const accounts = (): Accounts => ({
  users: {
    root: { uid: 0, group: 'root', home: '/root' },
    'www-data': { uid: 33, group: 'www-data', home: '/var/www', shell: '/usr/sbin/nologin' },
    agenda: { uid: 998, group: 'agenda', home: '/opt/agenda', shell: '/usr/sbin/nologin' },
    vous: { uid: 1000, group: 'vous' },
    rania: { uid: 1001, group: 'rania' },
  },
  groups: {
    root: { gid: 0, members: [] },
    adm: { gid: 4, members: ['vous'] },
    sudo: { gid: 27, members: ['vous', 'rania'] },
    'www-data': { gid: 33, members: [] },
    agenda: { gid: 998, members: [] },
    vous: { gid: 1000, members: [] },
    rania: { gid: 1001, members: [] },
  },
});

// Le site des Lettres, tel que Rania l'a installé (site par défaut du port 80).
const LETTERS_CONF = `server {
    listen 80 default_server;
    listen [::]:80 default_server;
    server_name ${LETTERS} www.${LETTERS};

    root /var/www/letters;
    index index.html;

    location / {
        try_files $uri $uri/ =404;
    }
}`;

const sd = (j: Game) => systemd(j)!;
const page = (j: Game, host: string, path = '/') => httpRequest(j, host, path, 80, false);
const serves = (j: Game, host: string, path: string, text: string) => {
  const r = page(j, host, path);
  return r?.code === 200 && r.body === text;
};
const servedCafe = (j: Game) => serves(j, CAFE, '/', j.t('sharing-site-cafe'));
const servedLetters = (j: Game) => serves(j, LETTERS, '/', j.t('sharing-site-lettres'));
const servedAgenda = (j: Game) =>
  serves(j, LETTERS, '/agenda/', j.t('sharing-agenda-accueil')) && serves(j, LETTERS, '/agenda/semaine', j.t('sharing-agenda-semaine'));
const lastCurl = (j: Game) => j.last.commands.some((c) => c[0] === 'curl');

export const colocation: Chapter = {
  id: 'sharing',
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
    'cp',
    'mv',
    'rm',
    'mkdir',
    'ln',
    'chmod',
    'chown',
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
  welcome: 'courriel_kofi.txt',
  names: true,
  final: 'fin',
  password: 'fourmis-2026',
  accounts,
  state: (t) => ({
    systemd: newSystemd('letters', Date.UTC(2027, 2, 1, 6, 12, 0), Date.UTC(2027, 2, 13, 10, 0, 0), {
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
          { pid: 802, user: 'www-data', cpu: 0.1, mem: 0.6, command: 'nginx: worker process' },
        ],
        check: checkNginx,
        load: loadNginx,
        checkToReload: true,
      },
      // Rania l'a installé, mais ne l'a jamais démarré.
      agenda: {
        description: 'Agenda des ateliers (Node.js)',
        state: 'inactive',
        active: false,
        executable: 'node',
        process: [{ pid: 1450, user: 'agenda', cpu: 0.4, mem: 2.3, command: 'node /opt/agenda/serveur.js' }],
      },
    }),
    processus: [
      { pid: 1, user: 'root', cpu: 0, mem: 0.1, command: '/sbin/init' },
      { pid: 612, user: 'root', cpu: 0, mem: 0.2, command: 'sshd: /usr/sbin/sshd -D [listener] 0 of 10-100 startups' },
      { pid: 801, user: 'root', cpu: 0, mem: 0.3, command: 'nginx: master process /usr/sbin/nginx -g daemon on; master_process on;' },
      { pid: 802, user: 'www-data', cpu: 0.1, mem: 0.6, command: 'nginx: worker process' },
    ],
    // Le DNS de cafe.example pointe déjà ici (Kofi s'en est occupé).
    nginx: { load: null, names: ['letters', LETTERS, `www.${LETTERS}`, CAFE, `www.${CAFE}`, '203.0.113.10'] },
    applis: {
      '127.0.0.1:3000': {
        service: 'agenda',
        pages: { '/': t('sharing-agenda-accueil'), '/semaine': t('sharing-agenda-semaine'), '/ateliers': t('sharing-agenda-ateliers') },
      } satisfies App,
    },
  }),
  initialise: (j) => loadNginx(j),
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
          // Comme sur Debian : un site activé est un lien vers sites-available.
          'sites-enabled': place({ letters: f('', { owner: 'root', link: '/etc/nginx/sites-available/letters' }) }),
        }),
      }),
      home: place({
        vous: d({ 'courriel_kofi.txt': f(t('sharing-courriel-kofi')), 'note_de_rania.txt': f(t('sharing-note-de-rania')) }),
        rania: place({}, { owner: 'rania', mode: 'rwx------' }),
      }),
      opt: place({
        agenda: place(
          {
            'serveur.js': file(t('sharing-agenda-code'), { owner: 'agenda' }),
            'LISEZMOI.txt': file(t('sharing-agenda-lisezmoi'), { owner: 'agenda' }),
          },
          { owner: 'agenda' },
        ),
      }),
      usr: place({ sbin: place({ nginx: f('', { owner: 'root', mode: 'rwxr-xr-x', size: 1_342_520 }) }) }),
      var: place({
        www: place({
          html: place({ 'index.nginx-debian.html': file(WELCOME) }),
          letters: place({ 'index.html': file(t('sharing-site-lettres')) }),
          // Rania a déjà déposé les pages du café.
          cafe: place({ 'index.html': file(t('sharing-site-cafe'), { owner: 'rania' }) }, { owner: 'rania' }),
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
      id: 'lien-casse',
      condition: (j) =>
        /open\(\) "\/etc\/nginx\/sites-enabled\/[^"]+" failed/.test(j.state.nginxErreur ?? '') ||
        sd(j).log.some((e) => /open\(\) "\/etc\/nginx\/sites-enabled\//.test(e.message)),
      message: (j) => j.t('sharing-evenement-lien-casse'),
    },
    {
      id: 'conflit',
      condition: (j) =>
        j.last.output.includes('conflicting server name') || j.last.errors.some((e) => e.includes('conflicting server name')),
      message: (j) => j.t('sharing-evenement-conflit'),
    },
    {
      id: 'mauvais-site',
      condition: (j) => lastCurl(j) && j.last.line.includes(CAFE) && j.last.output === j.t('sharing-site-lettres'),
      message: (j) => j.t('sharing-evenement-mauvais-site'),
    },
    {
      id: 'cafe',
      condition: servedCafe,
      message: (j) => j.t('sharing-evenement-cafe'),
    },
    {
      id: 'passerelle',
      condition: (j) => lastCurl(j) && j.last.output.includes('502 Bad Gateway'),
      message: (j) => j.t('sharing-evenement-passerelle'),
    },
    {
      id: 'cannot-get',
      condition: (j) => lastCurl(j) && j.last.output.includes('Cannot GET /agenda'),
      message: (j) => j.t('sharing-evenement-cannot-get'),
    },
    {
      id: 'agenda-sans-enable',
      condition: (j) => servedAgenda(j) && !sd(j).services.agenda.active,
      message: (j) => j.t('sharing-evenement-agenda-sans-enable'),
    },
    {
      id: 'fin',
      condition: (j) => servedCafe(j) && servedLetters(j) && servedAgenda(j) && sd(j).services.agenda.active,
      message: (j) => j.t('sharing-evenement-fin'),
    },
  ],
};
