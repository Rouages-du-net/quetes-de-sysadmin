// Histoire « Le Datacenter » — chapitre « Le certificat a expiré » : TLS et
// Let's Encrypt. Trois mois après l'incendie, le certificat HTTPS de la
// médiathèque a expiré ce matin. Le jour de l'incendie, Awa l'avait demandé
// avec certbot avant que le site soit restauré : certbot a noté le dossier
// du site par défaut de Debian (/var/www/html). Depuis un mois, chaque
// tentative de renouvellement automatique échoue (le défi est déposé là où
// nginx ne le sert pas), sans que personne ne le voie.
// Commandes : curl https, openssl x509 / s_client, certbot certificates,
// renew --dry-run, --webroot -w, --deploy-hook, journalctl -u certbot.
// Objectif vérifié sur l'état : nginx présente un certificat valide pour les
// deux noms du site, le prochain renouvellement automatique réussirait, et
// nginx sera rechargé tout seul après (deploy hook, ou module nginx).
// Sources : https://eff-certbot.readthedocs.io/en/stable/using.html,
// https://letsencrypt.org/docs/challenge-types/, https://docs.openssl.org/3.5/man1/openssl-x509/

import { d, f, accountsFiles, type Chapter, type Accounts, type Rights } from '../world';
import type { Game, Shell } from '../shell';
import type { Translate } from '../../texts';
import { newSystemd, systemd, toUtc, type Systemd } from '../systemd';
import { loadNginx, checkNginx } from '../nginx';
import { read, ISSUER, type Certificate } from '../tls';
import { WELCOME, MIME, NGINX_CONF, SITE_BY_DEFAULT } from '../commands/apt';
import {
  goodServedCertificate,
  writeRenewal,
  certificateFiles,
  FOR,
  automaticReload,
  possibleRenewal,
  serviceCertbot,
} from '../commands/certbot';

const M = '/home/vous';
const SITE = 'medialibrary.example';
const NAMES = [SITE, `www.${SITE}`];
const ROBOT = '198.51.100.77';

// Le certificat demandé le jour de l'incendie, valable 90 jours.
const OLD: Certificate = {
  cn: SITE,
  names: NAMES,
  issuer: ISSUER,
  serial: '04a1f3c9e27b58d6103fa9c7e2b4d85f61c0',
  start: Date.UTC(2026, 9, 23, 6, 40, 0),
  end: Date.UTC(2027, 0, 21, 6, 39, 59),
};

const accounts = (): Accounts => ({
  users: {
    root: { uid: 0, group: 'root', home: '/root' },
    'www-data': { uid: 33, group: 'www-data', home: '/var/www', shell: '/usr/sbin/nologin' },
    vous: { uid: 1000, group: 'vous' },
  },
  groups: {
    root: { gid: 0, members: [] },
    adm: { gid: 4, members: ['vous'] },
    sudo: { gid: 27, members: ['vous'] },
    'www-data': { gid: 33, members: [] },
    vous: { gid: 1000, members: [] },
  },
});

// Le site : en HTTP sur le port 80 (et pour les défis de Let's Encrypt), en HTTPS sur le 443.
const CONF_SITE = `server {
    listen 80 default_server;
    listen [::]:80 default_server;
    server_name ${NAMES.join(' ')};

    root /var/www/medialibrary;
    index index.html;

    include /etc/nginx/blocked.conf;
}

server {
    listen 443 ssl default_server;
    listen [::]:443 ssl default_server;
    server_name ${NAMES.join(' ')};

    ssl_certificate /etc/letsencrypt/live/${SITE}/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/${SITE}/privkey.pem;

    root /var/www/medialibrary;
    index index.html;

    include /etc/nginx/blocked.conf;
}`;

const blocked = (t: Translate) => `# ${t('premier-jour-bloques-commentaire')}
deny 203.0.113.5;
deny 192.0.2.99;
deny ${ROBOT};`;

const RENEWAL = writeRenewal({
  header: {
    version: '4.0.0',
    archive_dir: `${FOR}/archive/${SITE}`,
    cert: `${FOR}/live/${SITE}/cert.pem`,
    privkey: `${FOR}/live/${SITE}/privkey.pem`,
    chain: `${FOR}/live/${SITE}/chain.pem`,
    fullchain: `${FOR}/live/${SITE}/fullchain.pem`,
  },
  params: {
    account: '6f2a8c41d7e94b0a9c3e15b27d0f8a61',
    authenticator: 'webroot',
    webroot_path: '/var/www/html,',
    server: 'https://acme-v02.api.letsencrypt.org/directory',
    key_type: 'ecdsa',
  },
  map: { [SITE]: '/var/www/html', [`www.${SITE}`]: '/var/www/html' },
});

// Le journal de certbot : la dernière tentative a échoué, comme toutes depuis un mois.
const CERTBOT_LOG = `2027-01-21 03:24:11,307:DEBUG:certbot._internal.main:certbot version: 4.0.0
2027-01-21 03:24:11,308:DEBUG:certbot._internal.main:Arguments: ['-q', '--no-random-sleep-on-renew']
2027-01-21 03:24:11,512:INFO:certbot._internal.renewal:Renewing an existing certificate for ${NAMES.join(' and ')}
2027-01-21 03:24:13,904:INFO:certbot._internal.auth_handler:Waiting for verification...
2027-01-21 03:24:15,118:INFO:certbot._internal.auth_handler:Challenge failed for domain ${SITE}
2027-01-21 03:24:15,118:INFO:certbot._internal.auth_handler:Challenge failed for domain www.${SITE}
2027-01-21 03:24:15,120:DEBUG:certbot._internal.display.obj:Notifying user: Certbot failed to authenticate some domains (authenticator: webroot). The Certificate Authority reported these problems:
  Domain: ${SITE}
  Type:   unauthorized
  Detail: 192.0.2.11: Invalid response from http://${SITE}/.well-known/acme-challenge/Wk3pZ0aXq7cN2sR8vL1yT6eH4bG9dF5mJ0uK3oP7iQ: 404
2027-01-21 03:24:15,121:ERROR:certbot._internal.renewal:Failed to renew certificate ${SITE} with error: Some challenges have failed.
2027-01-21 03:24:15,122:ERROR:certbot._internal.renewal:All renewals failed. The following certificates could not be renewed:
2027-01-21 03:24:15,122:ERROR:certbot._internal.renewal:  ${FOR}/live/${SITE}/fullchain.pem (failure)`;

// Depuis le 22 décembre (30 jours avant l'expiration), le timer lance certbot
// deux fois par jour ; chaque fois, le renouvellement échoue.
function serverLog(): Systemd {
  const sd = newSystemd('datacenter', Date.UTC(2027, 0, 4, 9, 2, 0), Date.UTC(2027, 0, 21, 9, 20, 0), {
    ssh: {
      description: 'OpenBSD Secure Shell server',
      active: true,
      executable: 'sshd',
      process: [{ pid: 612, user: 'root', cpu: 0, mem: 0.2, command: 'sshd: /usr/sbin/sshd -D [listener] 0 of 10-100 startups' }],
    },
    cron: {
      description: 'Regular background program processing daemon',
      active: true,
      executable: 'cron',
      process: [{ pid: 598, user: 'root', cpu: 0, mem: 0.1, command: '/usr/sbin/cron -f' }],
    },
    nginx: {
      description: 'A high performance web server and a reverse proxy server',
      active: true,
      executable: 'nginx',
      process: [
        { pid: 801, user: 'root', cpu: 0, mem: 0.3, command: 'nginx: master process /usr/sbin/nginx -g daemon on; master_process on;' },
        { pid: 802, user: 'www-data', cpu: 0.2, mem: 0.6, command: 'nginx: worker process' },
      ],
      check: checkNginx,
      load: loadNginx,
      checkToReload: true,
    },
    certbot: {
      description: 'Certbot',
      state: 'inactive',
      active: false,
      executable: 'certbot',
      oneshot: true,
      check: (j) => serviceCertbot(shell(j)),
    },
  });
  const tentatives = [
    [2026, 11, 22, 4, 2],
    [2026, 11, 22, 16, 37],
    [2027, 0, 19, 15, 48],
    [2027, 0, 20, 3, 51],
    [2027, 0, 20, 15, 12],
    [2027, 0, 21, 3, 24],
  ];
  const write = (time: number, ident: string, pid: number, message: string, priority = 6) =>
    sd.log.push({ time, boot: 1, unit: 'certbot.service', ident, pid, message, priority });
  tentatives.forEach(([a, mo, j, h, mi], i) => {
    const t = Date.UTC(a, mo, j, h, mi, 0);
    const pid = 41200 + i * 317;
    write(t, 'systemd', 1, 'Starting certbot.service - Certbot...');
    write(t + 4000, 'certbot', pid, `Failed to renew certificate ${SITE} with error: Some challenges have failed.`, 3);
    write(t + 4000, 'certbot', pid, 'All renewals failed. The following certificates could not be renewed:', 3);
    write(t + 4000, 'certbot', pid, `  ${FOR}/live/${SITE}/fullchain.pem (failure)`, 3);
    write(t + 4000, 'certbot', pid, '1 renew failure(s), 0 parse failure(s)', 3);
    write(t + 5000, 'systemd', 1, 'certbot.service: Main process exited, code=exited, status=1/FAILURE', 4);
    write(t + 5000, 'systemd', 1, "certbot.service: Failed with result 'exit-code'.", 4);
    write(t + 5000, 'systemd', 1, 'Failed to start certbot.service - Certbot.', 3);
  });
  // Le journal est dans l'ordre du temps (le démarrage du 4 janvier en premier).
  sd.log.sort((a, b) => a.time - b.time);
  sd.services.certbot = { ...sd.services.certbot, state: 'failed', since: Date.UTC(2027, 0, 21, 3, 24, 5) };
  return sd;
}

// Les paquets installés sur la machine reconstruite.
const VERSIONS: Record<string, string> = {
  curl: '8.14.1-2',
  rsync: '3.4.1+ds1-5',
  tar: '1.35+dfsg-3.1',
  'openssh-server': '1:10.0p1-7',
  nginx: '1.26.3-3',
  'nginx-common': '1.26.3-3',
  certbot: '4.0.0-2',
};

const sd = (j: Game) => systemd(j)!;
const onDisk = (j: Game) => read(j.read(`${FOR}/live/${SITE}/fullchain.pem`));
// Les événements reçoivent le shell de la machine.
const shell = (j: Game) => j as Shell;
const served = (j: Game) => NAMES.every((n) => goodServedCertificate(shell(j), n));

export const certificate: Chapter = {
  id: 'certificat',
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
    'echo',
    'tee',
    'id',
    'ps',
    'cp',
    'mv',
    'rm',
    'mkdir',
    'chmod',
    'nano',
    'sudo',
    'apt',
    'nginx',
    'systemctl',
    'journalctl',
    'curl',
    'certbot',
    'openssl',
    'whoami',
  ],
  home: M,
  welcome: 'courriel_awa.txt',
  names: true,
  final: 'fin',
  password: 'bienvenue-2026',
  // La machine reconstruite après l'incendie : même clé d'hôte qu'au chapitre 4.
  hostKey: '-apres-incendie',
  accounts,
  state: () => ({
    systemd: serverLog(),
    processus: [
      { pid: 1, user: 'root', cpu: 0, mem: 0.1, command: '/sbin/init' },
      { pid: 598, user: 'root', cpu: 0, mem: 0.1, command: '/usr/sbin/cron -f' },
      { pid: 612, user: 'root', cpu: 0, mem: 0.2, command: 'sshd: /usr/sbin/sshd -D [listener] 0 of 10-100 startups' },
      { pid: 801, user: 'root', cpu: 0, mem: 0.3, command: 'nginx: master process /usr/sbin/nginx -g daemon on; master_process on;' },
      { pid: 802, user: 'www-data', cpu: 0.2, mem: 0.6, command: 'nginx: worker process' },
    ],
    apt: { lists: true, installed: { ...VERSIONS } },
    nginx: { load: null, names: ['datacenter', 'datacenter.internal', ...NAMES, '192.0.2.11'] },
  }),
  // nginx tourne depuis le démarrage : il a chargé le certificat d'octobre.
  initialise: (j) => loadNginx(j),
  createWorld: (t) => {
    const root = { owner: 'root' };
    const place = (children: Parameters<typeof d>[0], rights: Rights = root) => d(children, undefined, rights);
    const file = (text: string, mode?: string) => f(text, { lines: true, owner: 'root', mode });
    const cert = certificateFiles(OLD);
    return place({
      etc: place({
        ...accountsFiles(),
        hostname: file('datacenter'),
        nginx: place({
          'nginx.conf': file(NGINX_CONF),
          'mime.types': file(MIME),
          'blocked.conf': file(blocked(t)),
          'conf.d': place({}),
          'modules-enabled': place({}),
          'sites-available': place({ default: file(SITE_BY_DEFAULT), medialibrary: file(CONF_SITE) }),
          'sites-enabled': place({ medialibrary: file(CONF_SITE) }),
        }),
        letsencrypt: place({
          live: place(
            {
              [SITE]: place({
                'cert.pem': file(cert['cert.pem']),
                'chain.pem': file(cert['chain.pem']),
                'fullchain.pem': file(cert['fullchain.pem']),
                'privkey.pem': file(cert['privkey.pem'], 'rw-------'),
                README: file(t('certificat-lisezmoi-live')),
              }),
            },
            { owner: 'root', mode: 'rwx------' },
          ),
          renewal: place({ [`${SITE}.conf`]: file(RENEWAL) }),
          'renewal-hooks': place({ deploy: place({}), pre: place({}), post: place({}) }),
        }),
      }),
      home: place({ vous: d({ 'courriel_awa.txt': f(t('certificat-courriel-awa')), 'message_de_lea.txt': f(t('certificat-message-de-lea')) }) }),
      usr: place({
        bin: place({
          certbot: f('', { owner: 'root', mode: 'rwxr-xr-x', size: 966 }),
          openssl: f('', { owner: 'root', mode: 'rwxr-xr-x', size: 1_014_808 }),
        }),
        sbin: place({ nginx: f('', { owner: 'root', mode: 'rwxr-xr-x', size: 1_342_520 }) }),
        lib: place({ python3: place({ 'dist-packages': place({}) }) }),
      }),
      var: place({
        www: place({
          html: place({ 'index.nginx-debian.html': file(WELCOME) }),
          medialibrary: place({ 'index.html': file(t('certificat-site-index')) }),
        }),
        log: place({
          letsencrypt: place({ 'letsencrypt.log': file(CERTBOT_LOG) }, { owner: 'root', mode: 'rwx------' }),
          nginx: place(
            { 'access.log': f('', { lines: true, owner: 'www-data', group: 'adm', mode: 'rw-r-----' }) },
            { owner: 'root', group: 'adm' },
          ),
        }),
      }),
    });
  },
  events: [
    {
      id: 'expire',
      condition: (j) => j.last.errors.some((e) => e.includes('certificate has expired')) || j.last.output.includes('INVALID: EXPIRED'),
      message: (j) => j.t('certificat-evenement-expire'),
    },
    {
      id: 'defi',
      condition: (j) => j.state.certbotDefiEchoue === true,
      message: (j) => j.t('certificat-evenement-defi'),
    },
    {
      id: 'pas-recharge',
      condition: (j) => {
        const c = onDisk(j);
        return !!c && c.end > toUtc(sd(j).clock) && !served(j);
      },
      message: (j) => j.t('certificat-evenement-pas-recharge'),
    },
    {
      id: 'sans-hook',
      condition: (j) => served(j) && possibleRenewal(shell(j)) && !automaticReload(shell(j)),
      message: (j) => j.t('certificat-evenement-sans-hook'),
    },
    {
      id: 'fin',
      condition: (j) => served(j) && possibleRenewal(shell(j)) && automaticReload(shell(j)),
      message: (j) => j.t('certificat-evenement-fin'),
    },
  ],
};
