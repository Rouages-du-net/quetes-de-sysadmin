// Story "The Other Unix" — chapter "The Script That Broke": Yanis wrote the
// nightly backup of the club's site on his Debian laptop, and copied it to
// the FreeBSD server. It has never worked there. Run it, read each error,
// and fix it for THIS system, with ITS manual:
//   - #!/bin/bash: bash is not part of FreeBSD's base system (it would be
//     /usr/local/bin/bash, from a package); sh says "./nightly-backup.sh: not
//     found", about a file that is right there. #!/bin/sh is enough;
//   - date -d yesterday: GNU only; BSD date says "illegal option -- d"
//     and adjusts with -v-1d;
//   - stat -c %s: GNU only; BSD stat's format is -f %z;
//   - sed -i "s/…/…/" file: BSD sed requires the backup suffix as the next
//     word (-i '' for none), and otherwise reads the file name as the script
//     (here, /var/ is an address and b a branch: "undefined label").
// Objective checked on the state: yesterday's archive in /var/backups, and
// state.conf updated with yesterday's date, by a run of nightly-backup.sh
// itself that reached its last line ("Backup of … done"): an archive made
// by hand and state.conf edited with nano don't fix the script. Several
// solutions pass (the base system's tools, or GNU's from a package:
// gdate…), as long as the script ran to the end.
// Sources: https://man.freebsd.org/cgi/man.cgi?query=date,
// https://man.freebsd.org/cgi/man.cgi?query=sed,
// https://man.freebsd.org/cgi/man.cgi?query=stat,
// https://docs.freebsd.org/en/books/handbook/basics/#shells

import { d, f, type Chapter } from '../world';
import type { Game } from '../shell';
import { M, PASSWORD, YESTERDAY, filmAccounts, filmState, filmWorld } from './film-club';

export const SCRIPT = `#!/bin/bash
# Nightly backup of the club's site (written on my Debian laptop - Yanis).
set -e
DAY=$(date -d yesterday +%F)
tar -czf /var/backups/site-$DAY.tar.gz /usr/local/www/club
SIZE=$(stat -c %s /var/backups/site-$DAY.tar.gz)
[ "$SIZE" -gt 0 ]
sed -i "s/^last=.*/last=$DAY/" /var/backups/state.conf
echo "Backup of $DAY done ($SIZE bytes)."`;

const SCRIPT_NAME = 'nightly-backup.sh';

const STATE_CONF = `# Written by nightly-backup.sh: the last good backup.
last=2029-09-01`;

const archive = (j: Game) => j.exists(`/var/backups/site-${YESTERDAY}.tar.gz`);
const recorded = (j: Game) => new RegExp(`^last=${YESTERDAY}$`, 'm').test(j.read('/var/backups/state.conf') ?? '');
// The script run (./nightly-backup.sh, sh nightly-backup.sh, sudo…), not a command that only names it.
const RUNNERS = ['sh', 'bash', 'dash', 'sudo', 'env', 'nohup', 'time'];
const runsScript = (c: string[]) => (RUNNERS.includes(c[0]) || c[0].endsWith(SCRIPT_NAME)) && c.some((a) => a.endsWith(SCRIPT_NAME));
const ranToTheEnd = (j: Game) => j.last.commands.some(runsScript) && new RegExp(`Backup of ${YESTERDAY} done \\(\\d+ bytes\\)`).test(j.last.output);
const said = (j: Game, text: string) => j.last.errors.some((e) => e.includes(text)) || j.last.output.includes(text);

export const portableScript: Chapter = {
  id: 'portable-script',
  number: 1,
  commands: ['ls', 'cd', 'pwd', 'cat', 'less', 'head', 'tail', 'grep', 'nano', 'sudo', 'id', 'whoami', 'uname', 'freebsd-version', 'sh', 'date', 'sed', 'stat', 'tar', 'which', 'pkg', 'test', 'echo', 'find', 'du', 'ps'],
  home: M,
  welcome: 'message_from_yanis.txt',
  names: true,
  final: 'end',
  steps: ['not-found', 'date', 'stat', 'sed', 'end'],
  password: PASSWORD,
  accounts: filmAccounts,
  state: () => filmState({}),
  createWorld: (t) =>
    filmWorld(t, {
      home: {
        'message_from_yanis.txt': f(t('portable-script-message-yanis')),
        'nightly-backup.sh': f(SCRIPT, { lines: true, mode: 'rwxr-xr-x' }),
      },
      more: {
        var: d({ backups: d({ 'state.conf': f(STATE_CONF, { lines: true, owner: 'you', group: 'you' }) }, undefined, { owner: 'you', group: 'you' }) }, undefined, { owner: 'root', group: 'wheel' }),
      },
    }),
  events: [
    { id: 'not-found', condition: (j) => said(j, 'nightly-backup.sh: not found'), message: (j) => j.t('portable-script-event-not-found') },
    { id: 'date', condition: (j) => said(j, 'date: illegal option -- d'), message: (j) => j.t('portable-script-event-date') },
    { id: 'stat', condition: (j) => said(j, 'stat: illegal option -- c'), message: (j) => j.t('portable-script-event-stat') },
    // BSD sed reads the file's name as its script: the error varies with the name.
    { id: 'sed', condition: (j) => said(j, 'sed: 1: "/var/backups/state.conf"'), message: (j) => j.t('portable-script-event-sed') },
    { id: 'end', condition: (j) => ranToTheEnd(j) && archive(j) && recorded(j), message: (j) => j.t('portable-script-event-end') },
  ],
};
