// Story "The Data Centre", chapter "The certificate has expired": TLS and
// Let's Encrypt. Three months after the fire, the media library's HTTPS
// certificate expired this morning. On the day of the fire, Awa requested it
// with certbot before the site was restored: certbot recorded the directory
// of Debian's default site (/var/www/html). For a month, every
// automatic renewal attempt has failed (the challenge is put where
// nginx doesn't serve it), without anyone noticing.
// Commands: curl https, openssl x509 / s_client, certbot certificates,
// renew --dry-run, --webroot -w, --deploy-hook, journalctl -u certbot.
// Objective checked on the state: nginx presents a valid certificate for the
// site's two names, the next automatic renewal would succeed, and
// nginx will be reloaded by itself afterwards (deploy hook, or nginx plugin).
// Sources: https://eff-certbot.readthedocs.io/en/stable/using.html,
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

const M = '/home/you';
const SITE = 'medialibrary.example';
const NAMES = [SITE, `www.${SITE}`];
const ROBOT = '198.51.100.77';

// The certificate requested on the day of the fire, valid for 90 days.
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
    you: { uid: 1000, group: 'you' },
  },
  groups: {
    root: { gid: 0, members: [] },
    adm: { gid: 4, members: ['you'] },
    sudo: { gid: 27, members: ['you'] },
    'www-data': { gid: 33, members: [] },
    you: { gid: 1000, members: [] },
  },
});

// The site: over HTTP on port 80 (and for Let's Encrypt's challenges), over HTTPS on 443.
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

const blocked = (t: Translate) => `# ${t('first-day-blocked-comment')}
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

// certbot's log: the last attempt failed, like all of them for a month.
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

// Since 22 December (30 days before expiry), the timer runs certbot
// twice a day; each time, the renewal fails.
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
  const attempts = [
    [2026, 11, 22, 4, 2],
    [2026, 11, 22, 16, 37],
    [2027, 0, 19, 15, 48],
    [2027, 0, 20, 3, 51],
    [2027, 0, 20, 15, 12],
    [2027, 0, 21, 3, 24],
  ];
  const write = (time: number, ident: string, pid: number, message: string, priority = 6) =>
    sd.log.push({ time, boot: 1, unit: 'certbot.service', ident, pid, message, priority });
  attempts.forEach(([a, mo, j, h, mi], i) => {
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
  // The journal is in time order (the 4 January boot first).
  sd.log.sort((a, b) => a.time - b.time);
  sd.services.certbot = { ...sd.services.certbot, state: 'failed', since: Date.UTC(2027, 0, 21, 3, 24, 5) };
  return sd;
}

// The packages installed on the rebuilt machine.
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
// Events receive the machine's shell.
const shell = (j: Game) => j as Shell;
const served = (j: Game) => NAMES.every((n) => goodServedCertificate(shell(j), n));

export const certificate: Chapter = {
  id: 'certificate',
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
  welcome: 'email_awa.txt',
  names: true,
  final: 'end',
  password: 'welcome-2026',
  // The machine rebuilt after the fire: same host key as in chapter 4.
  hostKey: '-after-fire',
  accounts,
  state: () => ({
    systemd: serverLog(),
    process: [
      { pid: 1, user: 'root', cpu: 0, mem: 0.1, command: '/sbin/init' },
      { pid: 598, user: 'root', cpu: 0, mem: 0.1, command: '/usr/sbin/cron -f' },
      { pid: 612, user: 'root', cpu: 0, mem: 0.2, command: 'sshd: /usr/sbin/sshd -D [listener] 0 of 10-100 startups' },
      { pid: 801, user: 'root', cpu: 0, mem: 0.3, command: 'nginx: master process /usr/sbin/nginx -g daemon on; master_process on;' },
      { pid: 802, user: 'www-data', cpu: 0.2, mem: 0.6, command: 'nginx: worker process' },
    ],
    apt: { lists: true, installed: { ...VERSIONS } },
    nginx: { load: null, names: ['datacenter', 'datacenter.internal', ...NAMES, '192.0.2.11'] },
  }),
  // nginx has been running since boot: it loaded October's certificate.
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
                README: file(t('certificate-readme-live')),
              }),
            },
            { owner: 'root', mode: 'rwx------' },
          ),
          renewal: place({ [`${SITE}.conf`]: file(RENEWAL) }),
          'renewal-hooks': place({ deploy: place({}), pre: place({}), post: place({}) }),
        }),
      }),
      home: place({ you: d({ 'email_awa.txt': f(t('certificate-email-awa')), 'message_from_lea.txt': f(t('certificate-message-lea')) }) }),
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
          medialibrary: place({ 'index.html': file(t('certificate-site-index')) }),
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
      id: 'expires',
      condition: (j) => j.last.errors.some((e) => e.includes('certificate has expired')) || j.last.output.includes('INVALID: EXPIRED'),
      message: (j) => j.t('certificate-event-expires'),
    },
    {
      id: 'challenge',
      condition: (j) => j.state.certbotChallengeFailed === true,
      message: (j) => j.t('certificate-event-challenge'),
    },
    {
      id: 'not-reload',
      condition: (j) => {
        const c = onDisk(j);
        return !!c && c.end > toUtc(sd(j).clock) && !served(j);
      },
      message: (j) => j.t('certificate-event-not-reload'),
    },
    {
      id: 'without-hook',
      condition: (j) => served(j) && possibleRenewal(shell(j)) && !automaticReload(shell(j)),
      message: (j) => j.t('certificate-event-without-hook'),
    },
    {
      id: 'end',
      condition: (j) => served(j) && possibleRenewal(shell(j)) && automaticReload(shell(j)),
      message: (j) => j.t('certificate-event-end'),
    },
  ],
};
