// Histoire « Le Datacenter » — chapitre « La nuit du redémarrage » :
// services systemd. Après les mises à jour automatiques, le serveur a
// redémarré cette nuit et le site est tombé : nginx avait été désactivé
// (disable), et le catalogue (php-fpm) ne peut plus écrire son journal car
// /var/log/catalogue appartient à root. Commandes : systemctl (status,
// --failed, start, restart, enable --now), journalctl -u / -xeu, chown,
// reboot. Objectif vérifié sur l'état : après un redémarrage lancé par le
// joueur ou la joueuse, les deux services tournent, et on l'a vérifié.
// Sources : https://www.freedesktop.org/software/systemd/man/latest/systemctl.html,
// https://www.freedesktop.org/software/systemd/man/latest/journalctl.html

import { d, f, accountsFiles, type Chapter } from '../world';
import type { Game } from '../shell';
import { newSystemd, systemd, type Systemd } from '../systemd';
import { datacenterAccounts, NGINX_LOG } from './first-day';

const M = '/home/you';
const LOGS = '/var/log/catalogue';

const NGINX = 'A high performance web server and a reverse proxy server';
const nginx = [
  { pid: 801, user: 'root', cpu: 0, mem: 0.3, command: 'nginx: master process /usr/sbin/nginx' },
  { pid: 802, user: 'www-data', cpu: 0.4, mem: 0.6, command: 'nginx: worker process' },
];
const catalogue = [{ pid: 835, user: 'root', cpu: 0.2, mem: 1.1, command: 'php-fpm: master process (/etc/php/8.2/fpm/php-fpm.conf)' }];

// L'heure au format de php-fpm : « [19-Oct-2026 03:12:05] » (toujours en anglais).
const MONTH = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const phpTime = (ms: number) => {
  const t = new Date(ms);
  return `[${String(t.getUTCDate()).padStart(2, '0')}-${MONTH[t.getUTCMonth()]}-${t.getUTCFullYear()} ${t.toISOString().slice(11, 19)}]`;
};

// php-fpm refuse de démarrer s'il ne peut pas écrire dans son dossier de journaux.
function checkCatalogue(j: Game): string[] | null {
  const n = j.find(LOGS);
  if (n && j.can(n, 'w', 'www-data') && j.can(n, 'x', 'www-data')) return null;
  const h = phpTime(systemd(j)!.clock + 1000);
  return [
    `${h} ERROR: failed to open error_log (${LOGS}/error.log): Permission denied (13)`,
    `${h} ERROR: failed to post process the configuration`,
    `${h} ERROR: FPM initialization failed`,
  ];
}

// Vendredi : nginx tourne, Awa l'arrête et le désactive pour un test ;
// nuit de lundi : redémarrage après les mises à jour, le catalogue échoue.
function serverStory(description: string): Systemd {
  const sd = newSystemd('datacenter', Date.UTC(2026, 9, 16, 8, 0, 0), Date.UTC(2026, 9, 16, 17, 42, 0), {
    nginx: { description: NGINX, active: true, executable: 'nginx', process: nginx },
    catalogue: { description, active: true, executable: 'php-fpm', process: catalogue, check: checkCatalogue },
  });
  const write = (time: number, boot: number, unit: string, ident: string, pid: number, message: string, priority = 6) =>
    sd.log.push({ time, boot, unit, ident, pid, message, priority });
  const friday = (h: number, m: number, s: number) => Date.UTC(2026, 9, 16, h, m, s);
  write(friday(17, 42, 0), 1, 'nginx.service', 'systemd', 1, `Stopping nginx.service - ${NGINX}...`);
  write(friday(17, 42, 1), 1, 'nginx.service', 'systemd', 1, `Stopped nginx.service - ${NGINX}.`);
  write(friday(17, 42, 9), 1, '', 'systemd', 1, 'Reloading finished in 212 ms.');
  write(friday(17, 43, 30), 1, '', 'sudo', 4121, '     awa : TTY=pts/0 ; PWD=/home/awa ; USER=root ; COMMAND=/usr/bin/chown -R root: /var/log/catalogue');
  const night = (s: number) => Date.UTC(2026, 9, 19, 3, 12, s);
  write(night(0), 1, 'unattended-upgrades.service', 'unattended-upgrade', 3310, 'Rebooting since a package requires it (linux-image-6.12.0-quetes).');
  write(night(40), 2, '', 'kernel', 0, 'Linux version 6.12.0-quetes (datacenter)');
  write(night(44), 2, 'catalogue.service', 'systemd', 1, `Starting catalogue.service - ${description}...`);
  const h = phpTime(night(45));
  write(night(45), 2, 'catalogue.service', 'php-fpm', 734, `${h} ERROR: failed to open error_log (${LOGS}/error.log): Permission denied (13)`, 3);
  write(night(45), 2, 'catalogue.service', 'php-fpm', 734, `${h} ERROR: failed to post process the configuration`, 3);
  write(night(45), 2, 'catalogue.service', 'php-fpm', 734, `${h} ERROR: FPM initialization failed`, 3);
  write(night(45), 2, 'catalogue.service', 'systemd', 1, 'catalogue.service: Main process exited, code=exited, status=78/CONFIG', 4);
  write(night(45), 2, 'catalogue.service', 'systemd', 1, "catalogue.service: Failed with result 'exit-code'.", 4);
  write(night(45), 2, 'catalogue.service', 'systemd', 1, `Failed to start catalogue.service - ${description}.`, 3);
  sd.boot = 2;
  sd.services.nginx = { ...sd.services.nginx, state: 'inactive', active: false, since: night(40) };
  sd.services.catalogue = { ...sd.services.catalogue, state: 'failed', since: night(45) };
  sd.clock = Date.UTC(2026, 9, 19, 8, 30, 0);
  return sd;
}

const sd = (j: Game) => systemd(j)!;
const running = (j: Game, name: string) => sd(j).services[name].state === 'active';
const openLogs = (j: Game) => j.can(j.find(LOGS)!, 'w', 'nobody');

export const reboot: Chapter = {
  id: 'reboot-night',
  number: 3,
  commands: ['ls', 'cd', 'pwd', 'cat', 'less', 'head', 'tail', 'grep', 'id', 'ps', 'systemctl', 'journalctl', 'chown', 'chmod', 'nano', 'sudo', 'reboot', 'whoami'],
  home: M,
  welcome: 'email_awa.txt',
  names: true,
  final: 'end',
  password: 'welcome-2026',
  accounts: () => {
    const c = datacenterAccounts();
    c.groups.adm.members.push('malo');
    return c;
  },
  state: (t) => ({ systemd: serverStory(t('first-day-service-catalogue')), processus: [{ pid: 1, user: 'root', cpu: 0, mem: 0.1, command: '/sbin/init' }] }),
  createWorld: (t) => {
    const root = { owner: 'root' };
    return d(
      {
        etc: d(accountsFiles(), undefined, root),
        home: d({ you: d({ 'email_awa.txt': f(t('reboot-night-email-awa')), 'notes_awa.txt': f(t('reboot-night-notes-awa')) }) }, undefined, root),
        var: d(
          {
            log: d(
              {
                // Après le « chown -R root: » de vendredi : php-fpm (www-data) ne peut plus y écrire.
                catalogue: d({ 'error.log': f('', { lines: true, owner: 'root' }) }, undefined, root),
                nginx: d(
                  { 'access.log': f(NGINX_LOG, { lines: true, owner: 'www-data', group: 'adm', mode: 'rw-r-----' }) },
                  undefined,
                  { owner: 'root', group: 'adm' },
                ),
              },
              undefined,
              root,
            ),
          },
          undefined,
          root,
        ),
      },
      undefined,
      root,
    );
  },
  events: [
    {
      id: 'logs-open',
      condition: openLogs,
      message: (j) => j.t('reboot-night-event-logs-open', { logs: LOGS }),
    },
    {
      id: 'nginx',
      condition: (j) => running(j, 'nginx'),
      message: (j) => j.t(sd(j).services.nginx.active ? 'reboot-night-event-nginx-active' : 'reboot-night-event-nginx'),
    },
    {
      id: 'catalogue',
      condition: (j) => running(j, 'catalogue'),
      message: (j) => j.t('reboot-night-event-catalogue'),
    },
    {
      id: 'forgotten',
      condition: (j) => sd(j).boot > 2 && !running(j, 'nginx'),
      message: (j) => j.t('reboot-night-event-forgotten'),
    },
    {
      id: 'end',
      condition: (j) =>
        sd(j).boot > 2 &&
        sd(j).checkedAfterBoot === true &&
        !sd(j).mainAStarted &&
        running(j, 'nginx') &&
        running(j, 'catalogue') &&
        !openLogs(j),
      message: (j) => j.t('reboot-night-event-end'),
    },
  ],
};
