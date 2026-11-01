// Histoire « Les Lettres du quartier » — chapitre « L'atelier de réparation » :
// Apache, pour comparer avec nginx. Le site de l'atelier de réparation quitte
// son ancien hébergeur ; il tournait sous Apache, avec un .htaccess qui
// réécrit les adresses courtes des fiches (/guide/42, imprimées sur les
// affiches). Rania a installé apache2 sur le serveur des Lettres, mais il ne
// démarre pas : nginx tient déjà le port 80. On le met derrière nginx, sur
// 127.0.0.1:8080, comme l'agenda.
// Commandes : systemctl status, journalctl -u apache2, ss -tlnp, ports.conf
// (Listen), <VirtualHost>, a2ensite (un lien fait à la main sans .conf est
// ignoré), apache2ctl configtest et -S, AllowOverride, a2enmod rewrite,
// le journal d'erreurs du site, nginx devant (ln -s, proxy_pass, Host).
// Objectif vérifié sur l'état : Apache tourne et démarrera avec la machine,
// n'écoute que sur la boucle locale ; par nginx, repair.example sert
// l'accueil de l'atelier et /guide/42 la fiche 42 ; letters.example reste
// intact.
// Sources : https://httpd.apache.org/docs/2.4/bind.html,
// https://httpd.apache.org/docs/2.4/vhosts/name-based.html,
// https://httpd.apache.org/docs/2.4/howto/htaccess.html,
// https://httpd.apache.org/docs/2.4/mod/mod_rewrite.html,
// https://nginx.org/en/docs/http/ngx_http_proxy_module.html#proxy_set_header

import { d, f, accountsFiles, type Chapter, type Accounts, type Rights } from '../world';
import type { Game } from '../shell';
import { start, newSystemd, systemd } from '../systemd';
import { loadNginx, httpRequest, checkNginx, type Response } from '../nginx';
import { stopApache, loadApache, ask, apacheListeners, PID, onlyLocal, checkApache } from '../apache';
import { APACHE_WELCOME, etcApache2, modulesApache2 } from '../apache-debian';
import { WELCOME, MIME, NGINX_CONF, SITE_BY_DEFAULT } from '../commands/apt';
import type { Firewall } from '../firewall';
import type { Listening } from '../commands/ss';

const M = '/home/you';
const LETTERS = 'letters.example';
const CAFE = 'cafe.example';
const WORKSHOP = 'repair.example';

const accounts = (): Accounts => ({
  users: {
    root: { uid: 0, group: 'root', home: '/root' },
    'www-data': { uid: 33, group: 'www-data', home: '/var/www', shell: '/usr/sbin/nologin' },
    you: { uid: 1000, group: 'you' },
    rania: { uid: 1001, group: 'rania' },
  },
  groups: {
    root: { gid: 0, members: [] },
    adm: { gid: 4, members: ['you'] },
    sudo: { gid: 27, members: ['you', 'rania'] },
    'www-data': { gid: 33, members: [] },
    you: { gid: 1000, members: [] },
    rania: { gid: 1001, members: [] },
  },
});

const site = (name: string, root: string, fallback = false) => `server {
    listen 80${fallback ? ' default_server' : ''};
    listen [::]:80${fallback ? ' default_server' : ''};
    server_name ${name} www.${name};

    root ${root};
    index index.html;

    location / {
        try_files $uri $uri/ =404;
    }
}`;

// Le site nginx de l'atelier, préparé par Rania : nginx passe tout à Apache.
const WORKSHOP_NGINX = `server {
    listen 80;
    listen [::]:80;
    server_name ${WORKSHOP} www.${WORKSHOP};

    location / {
        proxy_pass http://127.0.0.1:8080;
    }
}`;

// Le site Apache de l'atelier, recopié de l'ancien hébergeur (où Apache écoutait sur le port 80).
export const WORKSHOP_APACHE = `<VirtualHost *:80>
    ServerName ${WORKSHOP}
    ServerAlias www.${WORKSHOP}
    ServerAdmin webmaster@${WORKSHOP}
    DocumentRoot /var/www/repair

    ErrorLog \${APACHE_LOG_DIR}/repair-error.log
    CustomLog \${APACHE_LOG_DIR}/repair-access.log combined
</VirtualHost>`;

// Les règles de l'ancien hébergeur : /guide/42 sert guides/42.html (le commentaire vient des textes).
const HTACCESS = `RewriteEngine On
RewriteCond %{REQUEST_FILENAME} !-f
RewriteRule ^guide/([0-9]+)/?$ guides/$1.html [L]`;

// Les machines du chapitre : SSH sur 2222 (« Le port »), nginx sur 80 et 443.
const LISTENING: Listening[] = [
  { proto: 'tcp', address: '0.0.0.0', port: 2222, process: 'sshd', pid: 612 },
  { proto: 'tcp', address: '[::]', port: 2222, process: 'sshd', pid: 612 },
  { proto: 'tcp', address: '0.0.0.0', port: 80, process: 'nginx', pid: 701 },
  { proto: 'tcp', address: '[::]', port: 80, process: 'nginx', pid: 701 },
];

const APACHE_PROCESS = [
  { pid: PID, user: 'root', cpu: 0, mem: 0.4, command: '/usr/sbin/apache2 -k start' },
  { pid: PID + 1, user: 'www-data', cpu: 0, mem: 0.3, command: '/usr/sbin/apache2 -k start' },
  { pid: PID + 2, user: 'www-data', cpu: 0, mem: 0.3, command: '/usr/sbin/apache2 -k start' },
];

// Hier, apt install apache2 : le paquet a voulu démarrer Apache, qui n'a pas pu (le port 80 est à nginx).
const INSTALLATION = Date.UTC(2026, 10, 19, 18, 42, 0);
const NOW = Date.UTC(2026, 10, 20, 9, 30, 0);

const sd = (j: Game) => systemd(j)!;
const serves = (r: Response | { code: number; body: string } | null, text: string) => r?.code === 200 && r.body === text;
const welcome = (j: Game) => j.t('repair-cafe-site-welcome');
const sheet = (j: Game) => j.t('repair-cafe-sheet-42');
// Par nginx (sans trace dans les journaux), comme un visiteur.
const byNginx = (j: Game, path: string) => httpRequest(j, WORKSHOP, path, 80, false);
// Apache lui-même, sur l'un de ses ports.
const byApache = (j: Game, path: string, text: string) => apacheListeners(j).some((e) => serves(ask(j, e.port, path, WORKSHOP), text));
const runningApache = (j: Game) => sd(j).services.apache2.state === 'active';
const servedSite = (j: Game) => serves(byNginx(j, '/'), welcome(j));
const servedSheet = (j: Game) => serves(byNginx(j, '/guide/42'), sheet(j));
const servedLetters = (j: Game) => serves(httpRequest(j, LETTERS, '/', 80, false), j.t('sharing-site-letters'));
const curl = (j: Game) => j.last.commands.some((c) => c[0] === 'curl');
const seen = (j: Game, text: string) => j.last.output.includes(text) || j.last.errors.some((e) => e.includes(text));

export const workshop: Chapter = {
  id: 'repair-cafe',
  number: 9,
  commands: [
    'ls',
    'cd',
    'pwd',
    'cat',
    'less',
    'head',
    'tail',
    'grep',
    'find',
    'cp',
    'mv',
    'rm',
    'mkdir',
    'ln',
    'readlink',
    'chmod',
    'chown',
    'nano',
    'sudo',
    'nginx',
    'systemctl',
    'journalctl',
    'curl',
    'ss',
    'ps',
    'id',
    'whoami',
    'apache2ctl',
    'apachectl',
    'a2ensite',
    'a2dissite',
    'a2enmod',
    'a2dismod',
    'a2enconf',
    'a2disconf',
  ],
  home: M,
  welcome: 'email_kofi.txt',
  names: true,
  final: 'end',
  steps: ['busy', 'listening', 'site', 'proxy', 'rewrite', 'end'],
  password: 'ants-2026',
  accounts,
  state: () => ({
    // SSH écoute sur 2222 depuis « Le port ».
    sshd: { load: { port: '2222' }, reloads: 0 },
    listening: LISTENING.map((e) => ({ ...e })),
    ufw: {
      enabled: true,
      incoming: 'deny',
      outgoing: 'allow',
      rules: [
        { action: 'allow', to: '2222/tcp', ports: [2222], forEachOf: null },
        { action: 'allow', to: 'Nginx Full', ports: [80, 443], forEachOf: null },
      ],
    } satisfies Firewall,
    systemd: newSystemd('letters', Date.UTC(2026, 10, 2, 7, 14, 0), INSTALLATION, {
      ssh: { description: 'OpenBSD Secure Shell server', active: true, executable: 'sshd' },
      nginx: {
        description: 'A high performance web server and a reverse proxy server',
        active: true,
        executable: 'nginx',
        process: [
          { pid: 701, user: 'root', cpu: 0, mem: 0.3, command: 'nginx: master process /usr/sbin/nginx -g daemon on; master_process on;' },
          { pid: 702, user: 'www-data', cpu: 0.1, mem: 0.6, command: 'nginx: worker process' },
        ],
        check: checkNginx,
        load: loadNginx,
        checkToReload: true,
      },
      ufw: { description: 'Uncomplicated firewall', active: true, executable: 'ufw' },
      // Installé hier : activé par le paquet, mais en échec.
      apache2: {
        description: 'The Apache HTTP Server',
        state: 'inactive',
        active: true,
        executable: 'apache2',
        process: APACHE_PROCESS,
        check: checkApache,
        load: loadApache,
        stop: stopApache,
        checkToReload: true,
      },
    }),
    process: [
      { pid: 1, user: 'root', cpu: 0, mem: 0.1, command: '/sbin/init' },
      { pid: 612, user: 'root', cpu: 0, mem: 0.2, command: 'sshd: /usr/sbin/sshd -D [listener] 0 of 10-100 startups' },
      { pid: 701, user: 'root', cpu: 0, mem: 0.3, command: 'nginx: master process /usr/sbin/nginx -g daemon on; master_process on;' },
      { pid: 702, user: 'www-data', cpu: 0.1, mem: 0.6, command: 'nginx: worker process' },
    ],
    // Le DNS de repair.example pointe déjà ici (Kofi s'en est occupé).
    nginx: { load: null, names: ['letters', LETTERS, `www.${LETTERS}`, CAFE, `www.${CAFE}`, WORKSHOP, `www.${WORKSHOP}`, '203.0.113.10'] },
    apps: {},
    apache: { load: null },
  }),
  initialise: (j) => {
    loadNginx(j);
    // Le paquet a essayé de démarrer Apache à l'installation : le journal en garde la trace.
    const s = sd(j);
    start(j, s, 'apache2', true);
    s.clock = NOW;
  },
  createWorld: (t) => {
    const root = { owner: 'root' };
    const place = (children: Parameters<typeof d>[0], rights: Rights = root) => d(children, undefined, rights);
    const file = (text: string, rights: Rights = root) => f(text, { lines: true, ...rights });
    const log = (text = '') => f(text, { lines: true, owner: 'root', group: 'adm', mode: 'rw-r-----' });
    const binary = (size: number) => f('', { owner: 'root', mode: 'rwxr-xr-x', size });
    return place({
      etc: place({
        ...accountsFiles(),
        hostname: file('letters'),
        nginx: place({
          'nginx.conf': file(NGINX_CONF),
          'mime.types': file(MIME),
          'conf.d': place({}),
          'modules-enabled': place({}),
          'sites-available': place({
            default: file(SITE_BY_DEFAULT),
            letters: file(site(LETTERS, '/var/www/letters', true)),
            cafe: file(site(CAFE, '/var/www/cafe')),
            repair: file(WORKSHOP_NGINX, { owner: 'root' }),
          }),
          'sites-enabled': place({
            letters: f('', { owner: 'root', link: '/etc/nginx/sites-available/letters' }),
            cafe: f('', { owner: 'root', link: '/etc/nginx/sites-available/cafe' }),
          }),
        }),
        // Rania a « activé » le site comme pour nginx : un lien, mais sans .conf.
        apache2: etcApache2(
          { 'repair.conf': WORKSHOP_APACHE },
          { '000-default.conf': '../sites-available/000-default.conf', repair: '/etc/apache2/sites-available/repair.conf' },
        ),
      }),
      home: place({
        you: d({ 'email_kofi.txt': f(t('repair-cafe-email-kofi')), 'note_from_rania.txt': f(t('repair-cafe-note-rania')) }),
        rania: place({}, { owner: 'rania', mode: 'rwx------' }),
      }),
      usr: place({
        sbin: place({
          nginx: binary(1_342_520),
          apache2: binary(734_216),
          apache2ctl: binary(7_442),
          apachectl: f('', { owner: 'root', link: 'apache2ctl' }),
          a2ensite: binary(15_862),
          a2dissite: f('', { owner: 'root', link: 'a2ensite' }),
          a2enmod: f('', { owner: 'root', link: 'a2ensite' }),
          a2dismod: f('', { owner: 'root', link: 'a2ensite' }),
          a2enconf: f('', { owner: 'root', link: 'a2ensite' }),
          a2disconf: f('', { owner: 'root', link: 'a2ensite' }),
        }),
        lib: place({ apache2: modulesApache2() }),
      }),
      var: place({
        www: place({
          html: place({ 'index.html': file(APACHE_WELCOME), 'index.nginx-debian.html': file(WELCOME) }),
          letters: place({ 'index.html': file(t('sharing-site-letters')) }),
          cafe: place({ 'index.html': file(t('sharing-site-cafe')) }),
          // Le site de l'atelier, tel qu'il était chez l'ancien hébergeur.
          repair: place(
            {
              'index.html': file(t('repair-cafe-site-welcome'), { owner: 'rania' }),
              '.htaccess': file(`${t('repair-cafe-htaccess-comment')}\n${HTACCESS}`, { owner: 'rania' }),
              guides: place(
                {
                  '7.html': file(t('repair-cafe-sheet-7'), { owner: 'rania' }),
                  '42.html': file(t('repair-cafe-sheet-42'), { owner: 'rania' }),
                },
                { owner: 'rania' },
              ),
            },
            { owner: 'rania' },
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
          apache2: place(
            {
              'access.log': log(),
              'error.log': log(),
              'other_vhosts_access.log': log(),
              'repair-access.log': log(),
              'repair-error.log': log(),
            },
            { owner: 'root', group: 'adm', mode: 'rwxr-x---' },
          ),
        }),
      }),
    });
  },
  events: [
    { id: 'busy', condition: (j) => seen(j, 'Address already in use'), message: (j) => j.t('repair-cafe-event-busy') },
    { id: 'ah00558', condition: (j) => seen(j, 'AH00558'), message: (j) => j.t('repair-cafe-event-ah00558') },
    { id: 'listening', condition: (j) => runningApache(j), message: (j) => j.t('repair-cafe-event-listening') },
    { id: 'everywhere', condition: (j) => runningApache(j) && !onlyLocal(j), message: (j) => j.t('repair-cafe-event-everywhere') },
    { id: 'default', condition: (j) => curl(j) && j.last.output.includes('Apache2 Debian Default Page'), message: (j) => j.t('repair-cafe-event-default') },
    { id: 'site', condition: (j) => byApache(j, '/', welcome(j)), message: (j) => j.t('repair-cafe-event-site') },
    { id: 'gateway', condition: (j) => curl(j) && j.last.output.includes('502 Bad Gateway'), message: (j) => j.t('repair-cafe-event-gateway') },
    { id: 'proxy', condition: servedSite, message: (j) => j.t('repair-cafe-event-proxy') },
    {
      id: 'ignore',
      condition: (j) => curl(j) && j.last.line.includes('guide') && j.last.output.includes('The requested URL was not found on this server'),
      message: (j) => j.t('repair-cafe-event-ignore'),
    },
    {
      id: 'internal',
      condition: (j) => curl(j) && j.last.output.includes('misconfiguration and was unable'),
      message: (j) => j.t('repair-cafe-event-internal'),
    },
    { id: 'rewrite', condition: (j) => byApache(j, '/guide/42', sheet(j)) || servedSheet(j), message: (j) => j.t('repair-cafe-event-rewrite') },
    {
      id: 'end',
      condition: (j) => runningApache(j) && sd(j).services.apache2.active && onlyLocal(j) && servedSite(j) && servedSheet(j) && servedLetters(j),
      message: (j) => j.t('repair-cafe-event-end'),
    },
  ],
};
