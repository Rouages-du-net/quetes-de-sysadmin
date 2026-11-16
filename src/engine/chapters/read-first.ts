// Story "The Old Sun" — chapter "Read Before Touching": the Sun box in the
// cupboard has run the seed catalogue since 2009, and nobody dares touch it.
// Before moving anything, read the system and write down what you find:
//   - systemctl, top: not found. Solaris 10 has SMF: svcs (what runs, by
//     FMRI), svcs -x (what's broken: sendmail, for years, unrelated),
//     svcprop (a service's properties: where PostgreSQL keeps its data);
//     prstat instead of top;
//   - ZFS: zfs list (the dataset under /var/postgres), zpool status;
//   - uname -a, isainfo: a SPARC processor (big-endian: it will matter);
//   - psql -l: the database, its character set (LATIN1);
//   - and before anything else, a safety net: a ZFS snapshot of the
//     database's dataset, taken in an instant.
// The old /usr/bin/grep has no -q nor -E: /usr/xpg4/bin/grep does.
// Objective checked on the state: migration.md names the service, the data
// directory and the dataset, the database, its version and its character
// set; a snapshot of data/postgres exists.
// Sources: https://docs.oracle.com/cd/E26505_01/html/E37384/ (svcs, svcadm,
// svcprop), https://docs.oracle.com/cd/E26505_01/html/E37384/zfs-1m.html,
// https://www.postgresql.org/docs/8.4/app-psql.html

import { f, path, type Chapter } from '../world';
import type { Game } from '../shell';
import { zfs } from '../solaris';
import { DATASET, DATA_DIR, GREENHOUSE_COMMANDS, HOME, PASSWORD, greenhouseHost, herbariumAccounts, herbariumState, herbariumWorld } from './seed-bank';

const said = (j: Game, text: string) => j.last.output.includes(text) || j.last.errors.some((e) => e.includes(text));
const note = (j: Game) => j.read(path(j.t, `${HOME}/migration.md`)) ?? '';
const snapshot = (j: Game) => Object.keys(zfs(j).snapshots).some((s) => s.startsWith(`${DATASET}@`));
const written = (j: Game) => {
  const n = note(j);
  return n.includes('postgresql_84') && n.includes(DATA_DIR) && n.includes(DATASET) && n.includes('seeds') && /LATIN1/i.test(n) && n.includes('8.4');
};

export const COMMANDS_READ = [
  'ls', 'cd', 'pwd', 'cat', 'less', 'head', 'tail', 'grep', 'nano', 'sudo', 'id', 'whoami', 'uname', 'isainfo', 'svcs', 'svcprop', 'prstat',
  'zfs', 'zpool', 'zoneadm', 'zonename', 'pkginfo', 'psql', 'df', 'du', 'ps', 'file',
];

export const readFirst: Chapter = {
  id: 'read-first',
  number: 1,
  commands: COMMANDS_READ,
  home: HOME,
  welcome: 'email_inaya.txt',
  names: true,
  final: 'end',
  steps: ['smf', 'data-dir', 'zfs', 'encoding', 'snapshot', 'end'],
  password: PASSWORD,
  accounts: herbariumAccounts,
  hosts: { greenhouse: greenhouseHost({ commands: GREENHOUSE_COMMANDS }) },
  state: () => herbariumState(),
  createWorld: (t) =>
    herbariumWorld(t, {
      home: {
        'email_inaya.txt': f(t('read-first-email-inaya')),
        'odette-notes.txt': f(t('read-first-notes-odette'), { lines: true }),
        'migration.md': f(t('read-first-template'), { lines: true }),
      },
    }),
  events: [
    { id: 'linux-habit', condition: (j) => ['systemctl: not found', 'top: not found', 'journalctl: not found'].some((x) => said(j, x)), message: (j) => j.t('read-first-event-linux-habit') },
    { id: 'old-grep', condition: (j) => said(j, 'grep: illegal option'), message: (j) => j.t('read-first-event-old-grep') },
    { id: 'smf', condition: (j) => j.last.commands.some((c) => c[0] === 'svcs') && said(j, 'postgresql_84'), message: (j) => j.t('read-first-event-smf') },
    { id: 'maintenance', condition: (j) => said(j, 'svc:/network/smtp:sendmail (sendmail SMTP'), message: (j) => j.t('read-first-event-maintenance') },
    { id: 'data-dir', condition: (j) => said(j, DATA_DIR) && j.last.commands.some((c) => ['svcprop', 'svcs', 'ps', 'prstat'].includes(c[0]) || (c[0] === 'sudo' && c[1] === 'svcprop')), message: (j) => j.t('read-first-event-data-dir') },
    { id: 'sparc', condition: (j) => said(j, 'sparcv9') || said(j, 'sun4u sparc'), message: (j) => j.t('read-first-event-sparc') },
    { id: 'zfs', condition: (j) => j.last.commands.some((c) => c[0] === 'zfs' || (c[0] === 'sudo' && c[1] === 'zfs')) && said(j, DATASET), message: (j) => j.t('read-first-event-zfs') },
    { id: 'encoding', condition: (j) => said(j, 'LATIN1') && j.last.commands.some((c) => c.includes('psql')), message: (j) => j.t('read-first-event-encoding') },
    { id: 'snapshot', condition: snapshot, message: (j) => j.t('read-first-event-snapshot') },
    { id: 'end', condition: (j) => written(j) && snapshot(j), message: (j) => j.t('read-first-event-end') },
  ],
};
