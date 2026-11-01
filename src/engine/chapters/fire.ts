// Story "Le Datacenter" — chapter "The great fire": rebuilding a server from
// the backups. The hosting provider's datacenter burned last night; a new
// machine (same name, same address, new SSH host key) waits, empty. Each
// night's backups are elsewhere, mounted on /mnt/backup, with Awa's
// recovery plan. Commands: ssh-keygen -R (on the workstation), apt
// update/install, tar -tzf / -xzf -C, nginx -t, systemctl reload, curl.
// Traps: apt install before apt update, the last archive cut off by the
// fire, an extraction into ~, the two "default_server" sites (Debian's and
// the restored one).
// Objective checked on the state: nginx runs, starts with the machine, and
// serves the last intact backup for medialibrary.example.
// Sources: https://manpages.debian.org/trixie/apt/apt.8.en.html,
// https://nginx.org/en/docs/switches.html, https://nginx.org/en/docs/http/request_processing.html,
// https://www.gnu.org/software/tar/manual/, https://man.openbsd.org/ssh-keygen

import { path, name, d, f, accountsFiles, type Chapter, type Accounts, type File } from '../world';
import type { Game } from '../shell';
import type { Translate } from '../../texts';
import { newSystemd, systemd } from '../systemd';
import { httpRequest } from '../nginx';

const M = '/home/you';
const BACKUPS = '/mnt/backup';
const SITE = 'medialibrary.example';
const ROBOT = '198.51.100.77';
// The backups of each night (0:30); last night's was cut off by the fire
// (0:47).
const ARCHIVES = ['2026-10-21', '2026-10-22', '2026-10-23'];
const archive = (day: string) => `${BACKUPS}/medialibrary-${day}.tar.gz`;

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

// The site's configuration, as Awa had written it (without comments: the
// file is the same in every language).
const CONF_SITE = `server {
    listen 80 default_server;
    listen [::]:80 default_server;
    server_name ${SITE} www.${SITE};

    root /var/www/medialibrary;
    index index.html;

    include /etc/nginx/blocked.conf;

    location / {
        try_files $uri $uri/ =404;
    }
}`;

const blocked = (t: Translate) => `# ${t('first-day-blocked-comment')}
deny 203.0.113.5;
deny 192.0.2.99;
deny ${ROBOT};`;

// The home page in each backup: 1 (Wednesday), 2 (Thursday), 3 (Friday, lost).
const welcome = (t: Translate, version: number) => t(`fire-site-index-${version}`);

function archiveContent(t: Translate, version: number): Record<string, File> {
  const file = (text: string): File => ({ type: 'file', content: text, lines: true, owner: 'root', group: 'root' });
  return {
    'etc/nginx/blocked.conf': file(blocked(t)),
    'etc/nginx/sites-available/medialibrary': file(CONF_SITE),
    'etc/nginx/sites-enabled/medialibrary': file(CONF_SITE),
    'var/www/medialibrary/index.html': file(welcome(t, version)),
    [`var/www/medialibrary/${name(t, 'opening-hours.html')}`]: file(t('fire-site-hours')),
  };
}

const backup = (t: Translate, version: number, size: number, truncated?: number) =>
  f('', { owner: 'root', size, archive: { files: archiveContent(t, version), compressed: true, truncated } });

const sd = (j: Game) => systemd(j)!;
const page = (j: Game) => httpRequest(j, SITE, '/', 80, false);
const serves = (j: Game, version: number) => {
  const r = page(j);
  return r?.code === 200 && r.body === welcome(j.t, version);
};

export const fire: Chapter = {
  id: 'fire',
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
    'id',
    'ps',
    'du',
    'df',
    'cp',
    'mv',
    'rm',
    'mkdir',
    'nano',
    'sudo',
    'apt',
    'tar',
    'rsync',
    'nginx',
    'systemctl',
    'journalctl',
    'curl',
    'whoami',
  ],
  home: M,
  welcome: 'email_awa.txt',
  names: true,
  final: 'end',
  password: 'welcome-2026',
  // A new machine: the host key is no longer the one the workstation knows.
  hostKey: '-after-fire',
  accounts,
  state: () => {
    const friday = Date.UTC(2026, 9, 23, 7, 12, 0);
    return {
      systemd: newSystemd('datacenter', friday, Date.UTC(2026, 9, 23, 8, 5, 0), {
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
      }),
      process: [
        { pid: 1, user: 'root', cpu: 0, mem: 0.1, command: '/sbin/init' },
        { pid: 598, user: 'root', cpu: 0, mem: 0.1, command: '/usr/sbin/cron -f' },
        { pid: 612, user: 'root', cpu: 0, mem: 0.2, command: 'sshd: /usr/sbin/sshd -D [listener] 0 of 10-100 startups' },
      ],
      // curl reaches the machine itself under these names (nginx.ts).
      nginx: { load: null, names: ['datacenter', 'datacenter.internal', SITE, `www.${SITE}`, '192.0.2.11'] },
    };
  },
  createWorld: (t) => {
    const root = { owner: 'root' };
    const place = (children: Parameters<typeof d>[0]) => d(children, undefined, root);
    return place({
      etc: place({
        ...accountsFiles(),
        hostname: f('datacenter', { lines: true, owner: 'root' }),
        debian_version: f('13.1', { lines: true, owner: 'root' }),
        apt: place({
          'sources.list.d': place({
            'debian.sources': f(
              'Types: deb\nURIs: http://deb.debian.org/debian\nSuites: trixie trixie-updates\nComponents: main\nSigned-By: /usr/share/keyrings/debian-archive-keyring.gpg\n\nTypes: deb\nURIs: http://security.debian.org/debian-security\nSuites: trixie-security\nComponents: main\nSigned-By: /usr/share/keyrings/debian-archive-keyring.gpg',
              { lines: true, owner: 'root' },
            ),
          }),
        }),
      }),
      home: place({ you: d({ 'email_awa.txt': f(t('fire-email-awa')) }) }),
      mnt: place({
        backup: place({
          'DRP.txt': f(t('fire-drp'), { owner: 'root' }),
          [`medialibrary-${ARCHIVES[0]}.tar.gz`]: backup(t, 1, 48_213),
          [`medialibrary-${ARCHIVES[1]}.tar.gz`]: backup(t, 2, 48_390),
          // Cut off after the three configuration files.
          [`medialibrary-${ARCHIVES[2]}.tar.gz`]: backup(t, 3, 20_480, 3),
        }),
      }),
      usr: place({ sbin: place({}), bin: place({}) }),
      var: place({ lib: place({ apt: place({ lists: place({}) }) }), log: place({}) }),
    });
  },
  events: [
    {
      id: 'list-empty',
      condition: (j) => j.state.missingApt === true,
      message: (j) => j.t('fire-event-list-empty'),
    },
    {
      id: 'nginx',
      condition: (j) => sd(j).services.nginx?.state === 'active',
      message: (j) => j.t('fire-event-nginx'),
    },
    {
      id: 'truncated',
      condition: (j) => j.state.truncatedArchive === path(j.t, archive(ARCHIVES[2])),
      message: (j) => j.t('fire-event-truncated'),
    },
    {
      id: 'bad-place',
      condition: (j) => j.exists(path(j.t, `${M}/etc`)) || j.exists(path(j.t, `${M}/var`)),
      message: (j) => j.t('fire-event-bad-place'),
    },
    {
      id: 'duplicate',
      condition: (j) =>
        (j.state.nginxError ?? '').includes('duplicate default server') || sd(j).log.some((e) => e.message.includes('duplicate default server')),
      message: (j) => j.t('fire-event-duplicate'),
    },
    {
      id: 'wednesday',
      condition: (j) => serves(j, 1),
      message: (j) => j.t('fire-event-wednesday'),
    },
    {
      id: 'end',
      condition: (j) => serves(j, 2) && sd(j).services.nginx?.active === true,
      message: (j) => j.t('fire-event-end'),
    },
  ],
};
