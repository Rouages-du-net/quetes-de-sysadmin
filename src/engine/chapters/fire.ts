// Histoire « Le Datacenter » — chapitre « Le grand incendie » : reconstruire
// un serveur à partir des sauvegardes. Le datacenter de l'hébergeur a brûlé
// cette nuit ; une machine neuve (même nom, même adresse, nouvelle clé
// d'hôte SSH) attend, vide. Les sauvegardes de chaque nuit sont ailleurs,
// montées sur /mnt/sauvegarde, avec le plan de reprise d'Awa. Commandes :
// ssh-keygen -R (sur le poste), apt update/install, tar -tzf / -xzf -C,
// nginx -t, systemctl reload, curl. Pièges : apt install avant apt update,
// la dernière archive coupée par l'incendie, une extraction dans ~, les deux
// sites « default_server » (celui de Debian et celui restauré).
// Objectif vérifié sur l'état : nginx tourne, démarre avec la machine, et
// sert pour medialibrary.example la dernière sauvegarde intacte.
// Sources : https://manpages.debian.org/trixie/apt/apt.8.en.html,
// https://nginx.org/en/docs/switches.html, https://nginx.org/en/docs/http/request_processing.html,
// https://www.gnu.org/software/tar/manual/, https://man.openbsd.org/ssh-keygen

import { path, d, f, accountsFiles, type Chapter, type Accounts, type File } from '../world';
import type { Game } from '../shell';
import type { Translate } from '../../texts';
import { newSystemd, systemd } from '../systemd';
import { httpRequest } from '../nginx';

const M = '/home/vous';
const BACKUPS = '/mnt/sauvegarde';
const SITE = 'medialibrary.example';
const ROBOT = '198.51.100.77';
// Les sauvegardes de chaque nuit (0 h 30) ; celle de cette nuit a été coupée
// par l'incendie (0 h 47).
const ARCHIVES = ['2026-10-21', '2026-10-22', '2026-10-23'];
const archive = (day: string) => `${BACKUPS}/medialibrary-${day}.tar.gz`;

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

// La configuration du site, telle qu'Awa l'avait écrite (sans commentaire :
// le fichier est le même dans toutes les langues).
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

const blocked = (t: Translate) => `# ${t('premier-jour-bloques-commentaire')}
deny 203.0.113.5;
deny 192.0.2.99;
deny ${ROBOT};`;

// La page d'accueil dans chaque sauvegarde : 1 (mercredi), 2 (jeudi), 3 (vendredi, perdue).
const welcome = (t: Translate, version: number) => t(`incendie-site-index-${version}`);

function archiveContent(t: Translate, version: number): Record<string, File> {
  const file = (text: string): File => ({ type: 'fichier', content: text, lines: true, owner: 'root', group: 'root' });
  return {
    'etc/nginx/blocked.conf': file(blocked(t)),
    'etc/nginx/sites-available/medialibrary': file(CONF_SITE),
    'etc/nginx/sites-enabled/medialibrary': file(CONF_SITE),
    'var/www/medialibrary/index.html': file(welcome(t, version)),
    'var/www/medialibrary/horaires.html': file(t('incendie-site-horaires')),
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
  id: 'incendie',
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
  welcome: 'courriel_awa.txt',
  names: true,
  final: 'fin',
  password: 'bienvenue-2026',
  // Une machine neuve : la clé d'hôte n'est plus celle que le poste connaît.
  hostKey: '-apres-incendie',
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
      processus: [
        { pid: 1, user: 'root', cpu: 0, mem: 0.1, command: '/sbin/init' },
        { pid: 598, user: 'root', cpu: 0, mem: 0.1, command: '/usr/sbin/cron -f' },
        { pid: 612, user: 'root', cpu: 0, mem: 0.2, command: 'sshd: /usr/sbin/sshd -D [listener] 0 of 10-100 startups' },
      ],
      // curl joint la machine elle-même sous ces noms (nginx.ts).
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
      home: place({ vous: d({ 'courriel_awa.txt': f(t('incendie-courriel-awa')) }) }),
      mnt: place({
        sauvegarde: place({
          'PRA.txt': f(t('incendie-pra'), { owner: 'root' }),
          [`medialibrary-${ARCHIVES[0]}.tar.gz`]: backup(t, 1, 48_213),
          [`medialibrary-${ARCHIVES[1]}.tar.gz`]: backup(t, 2, 48_390),
          // Coupée après les trois fichiers de configuration.
          [`medialibrary-${ARCHIVES[2]}.tar.gz`]: backup(t, 3, 20_480, 3),
        }),
      }),
      usr: place({ sbin: place({}), bin: place({}) }),
      var: place({ lib: place({ apt: place({ lists: place({}) }) }), log: place({}) }),
    });
  },
  events: [
    {
      id: 'liste-vide',
      condition: (j) => j.state.aptIntrouvable === true,
      message: (j) => j.t('incendie-evenement-liste-vide'),
    },
    {
      id: 'nginx',
      condition: (j) => sd(j).services.nginx?.state === 'active',
      message: (j) => j.t('incendie-evenement-nginx'),
    },
    {
      id: 'tronquee',
      condition: (j) => j.state.archiveTronquee === path(j.t, archive(ARCHIVES[2])),
      message: (j) => j.t('incendie-evenement-tronquee'),
    },
    {
      id: 'mauvais-lieu',
      condition: (j) => j.exists(path(j.t, `${M}/etc`)) || j.exists(path(j.t, `${M}/var`)),
      message: (j) => j.t('incendie-evenement-mauvais-lieu'),
    },
    {
      id: 'doublon',
      condition: (j) =>
        (j.state.nginxErreur ?? '').includes('duplicate default server') || sd(j).log.some((e) => e.message.includes('duplicate default server')),
      message: (j) => j.t('incendie-evenement-doublon'),
    },
    {
      id: 'mercredi',
      condition: (j) => serves(j, 1),
      message: (j) => j.t('incendie-evenement-mercredi'),
    },
    {
      id: 'fin',
      condition: (j) => serves(j, 2) && sd(j).services.nginx?.active === true,
      message: (j) => j.t('incendie-evenement-fin'),
    },
  ],
};
