// Story "The Data Centre", chapter "Second day": accounts and
// groups. Malo must read nginx's logs without sudo (adm group, as
// on Debian: https://wiki.debian.org/SystemGroups), and the web team
// needs a shared directory. Commands: id, groups, ls -l, usermod -aG,
// chgrp, chown, chmod.
// Real traps: usermod -G without -a replaces the supplementary groups;
// chmod o+r opens the logs (IP addresses: personal data) to everyone.
// The objectives are checked on the system's state, not on the command.

import { path, d, f, accountsFiles, type Chapter, type File } from '../world';
import type { Game } from '../shell';
import type { Translate } from '../../texts';
import { datacenterAccounts, nginxLog, route } from './first-day';

const M = '/home/you';
const LOGS = '/var/log/nginx';
const SHARE = '/srv/team';

const errors = (t: Translate) => `2026/10/13 20:31:02 [error] 613#613: *1842 connect() to unix:/run/php/php-fpm.sock failed (11: Resource temporarily unavailable) while connecting to upstream, client: 198.51.100.77, server: medialibrary.example, request: "GET ${route(t, '/catalogue/search?q=a')} HTTP/1.1"
2026/10/13 20:31:09 [error] 613#613: *1857 upstream timed out (110: Connection timed out) while reading response header from upstream, client: 192.0.2.31, server: medialibrary.example, request: "GET ${route(t, '/events')} HTTP/1.1"
2026/10/13 21:02:44 [notice] 612#612: signal process started`;

// On Debian, nginx's logs belong to www-data, group adm, mode 640.
const log = (text: string): File => f(text, { lines: true, owner: 'www-data', group: 'adm', mode: 'rw-r-----' });
const files = (j: Game) => [`${LOGS}/access.log`, `${LOGS}/error.log`].map((c) => j.find(c)!);

const malo = {
  // Malo reads both logs, as a member of adm, and is still a member of web-team.
  lit: (j: Game) => files(j).every((n) => j.can(n, 'r', 'malo')) && j.groupsFor('malo').includes('web-team'),
};
const openLogs = (j: Game) => files(j).some((n) => j.can(n, 'r', 'nobody'));
const share = (j: Game) => j.find(path(j.t, SHARE))!;

export const secondDay: Chapter = {
  id: 'second-day',
  number: 2,
  commands: ['ls', 'cd', 'pwd', 'cat', 'less', 'head', 'tail', 'grep', 'id', 'groups', 'whoami', 'usermod', 'chgrp', 'chown', 'chmod', 'touch', 'nano', 'sudo'],
  home: M,
  welcome: 'email_awa.txt',
  names: true,
  final: 'end',
  password: 'welcome-2026',
  accounts: datacenterAccounts,
  createWorld: (t) => {
    const root = { owner: 'root' };
    const home = (name: string) => d({}, undefined, { owner: name, mode: 'rwxr-x---' });
    return d(
      {
        etc: d(accountsFiles(), undefined, root),
        home: d(
          {
            you: d({ 'email_awa.txt': f(t('second-day-email-awa')), 'notes_awa.txt': f(t('second-day-notes-awa')) }),
            awa: home('awa'),
            malo: home('malo'),
          },
          undefined,
          root,
        ),
        srv: d({ team: d({}, undefined, root) }, undefined, root),
        var: d(
          {
            log: d(
              { nginx: d({ 'access.log': log(nginxLog(t)), 'error.log': log(errors(t)) }, undefined, { owner: 'root', group: 'adm' }) },
              undefined,
              root,
            ),
            www: d({}, undefined, root),
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
      id: 'replaced',
      condition: (j) => !j.groupsFor('malo').includes('web-team'),
      message: (j) => j.t('second-day-event-replaced'),
    },
    {
      id: 'logs-open',
      condition: openLogs,
      message: (j) => j.t('second-day-event-logs-open', { logs: LOGS }),
    },
    {
      id: 'malo-reads',
      condition: (j) => malo.lit(j) && !openLogs(j),
      message: (j) => j.t('second-day-event-malo-reads'),
    },
    {
      id: 'share-open',
      condition: (j) => j.can(share(j), 'w', 'nobody'),
      message: (j) => j.t('second-day-event-share-open', { share: path(j.t, SHARE) }),
    },
    {
      id: 'share',
      condition: (j) => {
        const n = share(j);
        const team = [j.player, 'awa', 'malo'].every((u) => j.can(n, 'w', u) && j.can(n, 'x', u));
        return team && !j.can(n, 'r', 'www-data') && !j.can(n, 'w', 'www-data');
      },
      message: (j) => j.t('second-day-event-share', { share: path(j.t, SHARE) }),
    },
    {
      id: 'end',
      condition: (j) => j.flags.has('malo-reads') && j.flags.has('share') && malo.lit(j) && !openLogs(j),
      message: (j) => j.t('second-day-event-end'),
    },
  ],
};
