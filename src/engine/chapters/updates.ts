// Story "The Co-op", chapter "Updates": the server hasn't been updated for
// months. Before opening: apt update, apt list --upgradable, apt upgrade…
// while the co-op's Wi-Fi cuts out (the connection drops once, in the
// middle of the update).
//   - without tmux: dpkg dies with the session; apt refuses to continue
//     until dpkg --configure -a has been run;
//   - in tmux: the update runs to the end; you reattach to it (tmux attach);
//   - a new kernel: /var/run/reboot-required, uname -r; reboot;
//   - after the reboot, the till doesn't come back (its service was never
//     enabled, Marc started it by hand): systemctl enable --now.
// Objective checked on the state: no update pending, dpkg clean, the new
// kernel runs, nginx and the till active, the till enabled.
// Sources: https://manpages.debian.org/trixie/apt/apt.8.en.html,
// https://man.openbsd.org/tmux, https://www.debian.org/doc/manuals/debian-reference/ch02.en.html

import { f, type Chapter } from '../world';
import type { Game, Shell } from '../shell';
import { loadNginx } from '../nginx';
import { systemd } from '../systemd';
import { BASE_INSTALLED, PACKAGES } from '../commands/apt';
import { cooperativeAccounts, M, cooperativeWorld, PASSWORD } from './coop';
import { NEW_KEY, tillEnv, tillState, tillWorld, BINARY_NGINX, nginxCooperative, tillSystemd } from './till-web';

const OLD_KERNEL = '6.12.38+deb13-amd64';
const NEW_KERNEL = '6.12.48+deb13-amd64';

// The site, as it is after "The secret" and "The proxy".
export const SITE = `server {
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
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}`;

// The installed packages, and the security updates waiting.
const INSTALLED: Record<string, string> = {
  ...Object.fromEntries(BASE_INSTALLED.map((p) => [p, PACKAGES[p].version])),
  nginx: '1.26.3-3+deb13u1',
  libc6: '2.41-12',
  openssl: '3.5.1-1',
  'linux-image-amd64': '6.12.38-1',
  [`linux-image-${OLD_KERNEL}`]: '6.12.38-1',
};
const UPDATES: Record<string, string> = {
  nginx: '1.26.3-3+deb13u2',
  libc6: '2.41-12+deb13u1',
  openssl: '3.5.4-1~deb13u1',
  'openssh-server': '1:10.0p1-7+deb13u1',
  'linux-image-amd64': '6.12.48-1',
};

type AptState = { installed: Record<string, string>; updates: Record<string, string>; interrupted?: string[]; lists: boolean };
const apt = (j: Game) => j.state.apt as AptState;
const sd = (j: Game) => systemd(j)!;
const dayA = (j: Game) => Object.entries(UPDATES).every(([n, v]) => apt(j).installed[n] === v) && !apt(j).interrupted?.length;
const kernel = (j: Game) => j.state.kernel as { active: string; installed: string };
const restarts = (j: Game) => kernel(j).active === NEW_KERNEL;
const servicesOk = (j: Game) => sd(j).services.nginx.state === 'active' && sd(j).services.till.state === 'active' && sd(j).services.till.active;
const openTmux = (j: Game) => Object.keys(j.state.tmux ?? {}).length > 0 && !(j as Shell).tmux;

export const updates: Chapter = {
  id: 'updates',
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
    'nano',
    'sudo',
    'id',
    'whoami',
    'apt',
    'dpkg',
    'uname',
    'tmux',
    'systemctl',
    'journalctl',
    'reboot',
    'curl',
    'ps',
    'who',
  ],
  home: M,
  welcome: 'email_awa.txt',
  names: true,
  final: 'end',
  password: PASSWORD,
  accounts: () => cooperativeAccounts(false),
  state: () => {
    const e = tillState(tillEnv(NEW_KEY, 'loopback'));
    const s = tillSystemd();
    // Marc started the till by hand: it runs, but its service isn't enabled.
    s.services.till.active = false;
    return {
      ...e,
      systemd: s,
      apt: { lists: false, installed: { ...INSTALLED }, updates: { ...UPDATES }, fresh: { [`linux-image-${NEW_KERNEL}`]: '6.12.48-1' } },
      kernel: { active: OLD_KERNEL, installed: OLD_KERNEL },
      // The co-op's Wi-Fi cuts out once, in the middle of the update.
      networkCut: true,
    };
  },
  initialise: (j) => loadNginx(j),
  createWorld: (t) =>
    cooperativeWorld({
      withoutMarc: true,
      home: { 'email_awa.txt': f(t('updates-email-awa')) },
      etc: nginxCooperative(SITE),
      sbin: BINARY_NGINX,
      more: tillWorld({ env: tillEnv(NEW_KEY, 'loopback'), envMode: 'rw-------', logAccess: '', appLog: '' }),
    }),
  events: [
    { id: 'interrupted', condition: (j) => !!apt(j).interrupted?.length, message: (j) => j.t('updates-event-interrupted') },
    { id: 'in-tmux', condition: (j) => dayA(j) && openTmux(j) && !restarts(j), message: (j) => j.t('updates-event-in-tmux') },
    {
      id: 'a-day',
      condition: (j) => dayA(j) && !restarts(j),
      message: (j) => j.t('updates-event-a-day', { oldest: OLD_KERNEL, new: NEW_KERNEL }),
    },
    {
      id: 'till-down',
      condition: (j) => restarts(j) && sd(j).services.till.state !== 'active',
      message: (j) => j.t('updates-event-till-down'),
    },
    { id: 'end', condition: (j) => dayA(j) && restarts(j) && servicesOk(j), message: (j) => j.t('updates-event-end') },
  ],
};
