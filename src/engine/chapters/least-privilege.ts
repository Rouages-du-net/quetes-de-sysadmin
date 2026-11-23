// Story "The Allotments", chapter "Least Privilege": Plotline moved to a new
// server, barrow (198.51.100.134). Its account plotline@198.51.100.133 no
// longer matched; in a hurry, Lwazi created root@'%' with a password, put it
// in the app's .env, and made MariaDB listen on every address (0.0.0.0). Selin's
// scan from outside found port 3306 open on trowel's office uplink. The
// server also keeps an old installation's leftovers: anonymous accounts, the
// test database open to everyone, the old app account.
// The fix: an account for the app alone, 'app'@'198.51.100.134' (or the back
// network's pattern), with SELECT, INSERT, UPDATE, DELETE on plots.* and
// nothing else; the app's .env changed and the app restarted; root only on
// localhost, through unix_socket (Debian's default); the anonymous accounts,
// the test database and the old account removed (by hand or with
// mariadb-secure-installation); port 3306 closed to the internet
// (bind-address on the back network's address and a restart, or ufw allowing
// 3306 from the back network only).
// Objective checked on the state: the app works, with an account that isn't
// root, whose host doesn't match the internet, with no global privilege and
// nothing beyond what it needs on plots; no root account but on localhost,
// root@localhost with unix_socket; no anonymous account, no test database
// nor its grants, no plotline@198.51.100.133; mariadb.sys kept; 3306
// unreachable from 203.0.113.77 and reachable from barrow.
// False leads: GRANT ALL ON *.*, 'app'@'%', the .env changed but the app not
// restarted, a password that doesn't match, bind-address 0.0.0.0 left
// without a firewall, bind-address 127.0.0.1 (the app cut off), root@localhost
// or mariadb.sys dropped.
// Sources: https://mariadb.com/kb/en/create-user/, https://mariadb.com/kb/en/grant/,
// https://mariadb.com/kb/en/authentication-plugin-unix-socket/,
// https://mariadb.com/kb/en/mariadb-secure-installation/,
// https://mariadb.com/kb/en/configuring-mariadb-for-remote-client-access/,
// https://mariadb.com/kb/en/mariadbsys-user/ (mariadb.sys).

import type { Chapter } from '../world';
import { f } from '../world';
import type { Game } from '../shell';
import { allowed, findAccount, hostMatches, maria } from '../mariadb';
import { APP_NEEDS, BARROW, ENV, HOME, PASSWORD, SHED, appAccount, barrowHost, exposed, initialiseStory, leastPrivilege, machine, openToOutside, passTime, readEnv, seen, story, trowelAccounts, trowelState, trowelWorld } from './allotments';

const srv = (j: Game) => maria(j);
const looked = (j: Game, what: string) => srv(j).looked?.[what] ?? 0;
const SYSTEM = ['root', 'mysql', 'mariadb.sys', ''];
const created = (j: Game) => srv(j).accounts.filter((a) => !SYSTEM.includes(a.user) && !(a.user === 'plotline' && a.host === SHED));
const needsMet = (j: Game, a: { user: string; host: string }) => APP_NEEDS.every(([p, t]) => allowed(srv(j), a, p, 'plots', t));
const goodAccount = (j: Game) => created(j).some((a) => hostMatches(a.host, BARROW) && !openToOutside(a) && leastPrivilege(srv(j), a) && needsMet(j, a));
const appOk = (j: Game) => !!story(j).app?.ok;
const appGood = (j: Game) => {
  const a = appAccount(j);
  return appOk(j) && !!a && a.user !== 'root' && !SYSTEM.includes(a.user) && !openToOutside(a) && leastPrivilege(srv(j), a) && needsMet(j, a);
};
const rootLocal = (j: Game) =>
  !srv(j).accounts.some((a) => a.user === 'root' && !['localhost', '127.0.0.1', '::1'].includes(a.host)) && !!findAccount(srv(j), 'root', 'localhost')?.auth.some((x) => x.plugin === 'unix_socket');
const socketRoot = (j: Game) => !!findAccount(srv(j), 'root', 'localhost')?.auth.some((x) => x.plugin === 'unix_socket');
const cleaned = (j: Game) =>
  !srv(j).accounts.some((a) => a.user === '') && !srv(j).databases.test && !srv(j).dbGrants.some((g) => /^test(\\_%)?$/.test(g.db)) && !findAccount(srv(j), 'plotline', SHED);
const sysKept = (j: Game) => !!findAccount(srv(j), 'mariadb.sys', 'localhost');
const network = (j: Game) => !exposed(j) && appOk(j);
const envFile = (j: Game) => readEnv(machine(j, 'barrow').read(ENV));
const envLoaded = (j: Game) => (machine(j, 'barrow').state.plotlineEnv as Record<string, string> | null) ?? {};

export const leastPrivilegeChapter: Chapter = {
  id: 'least-privilege',
  number: 2,
  commands: ['ls', 'cd', 'pwd', 'cat', 'less', 'head', 'tail', 'grep', 'nano', 'sudo', 'systemctl', 'journalctl', 'ss', 'ip', 'ssh', 'ufw', 'chmod', 'chown', 'mariadb', 'mysql', 'mariadb-admin', 'mysqladmin', 'mariadb-secure-installation', 'exit'],
  home: HOME,
  welcome: 'message_from_halima.txt',
  names: true,
  final: 'end',
  steps: ['scan', 'accounts', 'app-account', 'app-switched', 'root-local', 'cleanup', 'network', 'end'],
  password: PASSWORD,
  accounts: trowelAccounts,
  hosts: { barrow: barrowHost() },
  state: (t) => trowelState(t, 2),
  initialise: (j) => initialiseStory(j, 2),
  createWorld: (t) =>
    trowelWorld(t, 2, {
      'message_from_halima.txt': f(t('least-privilege-message-halima')),
      'scan_from_selin.txt': f(t('least-privilege-scan-selin'), { lines: true }),
      'note_from_lwazi.txt': f(t('least-privilege-note-lwazi')),
    }),
  afterCommand: (j) => passTime(j),
  events: [
    { id: 'scan', condition: (j) => seen(j, '3306/tcp'), message: (j) => j.t('least-privilege-event-scan') },
    { id: 'accounts', condition: (j) => looked(j, 'grants') > 0, message: (j) => j.t('least-privilege-event-accounts') },
    { id: 'all-on-all', condition: (j) => created(j).some((a) => a.global.length > 0), message: (j) => j.t('least-privilege-event-all-on-all') },
    { id: 'any-host', condition: (j) => created(j).some((a) => openToOutside(a)), message: (j) => j.t('least-privilege-event-any-host') },
    { id: 'app-account', condition: goodAccount, message: (j) => j.t('least-privilege-event-app-account') },
    {
      id: 'env-not-loaded',
      condition: (j) => (envFile(j).DB_USER ?? '') !== (envLoaded(j).DB_USER ?? '') && (envFile(j).DB_USER ?? 'root') !== 'root',
      message: (j) => j.t('least-privilege-event-env-not-loaded'),
    },
    {
      id: 'app-denied',
      condition: (j) => !appOk(j) && [1045, 1044, 1142, 1130].includes(story(j).app?.code ?? 0) && story(j).app?.user !== 'root',
      message: (j) => j.t('least-privilege-event-app-denied', { error: story(j).app?.error ?? '' }),
    },
    { id: 'app-switched', condition: appGood, message: (j) => j.t('least-privilege-event-app-switched') },
    { id: 'locked-out', condition: (j) => !socketRoot(j), message: (j) => j.t('least-privilege-event-locked-out') },
    { id: 'sys-dropped', condition: (j) => !sysKept(j), message: (j) => j.t('least-privilege-event-sys-dropped') },
    { id: 'root-local', condition: rootLocal, message: (j) => j.t('least-privilege-event-root-local') },
    { id: 'cleanup', condition: cleaned, message: (j) => j.t('least-privilege-event-cleanup') },
    { id: 'still-open', condition: (j) => srv(j).restarts > 0 && exposed(j), message: (j) => j.t('least-privilege-event-still-open') },
    { id: 'app-cut', condition: (j) => story(j).app?.code === 2002, message: (j) => j.t('least-privilege-event-app-cut') },
    { id: 'network', condition: network, message: (j) => j.t('least-privilege-event-network') },
    {
      id: 'end',
      condition: (j) => appGood(j) && rootLocal(j) && cleaned(j) && network(j) && sysKept(j),
      message: (j) => j.t('least-privilege-event-end'),
    },
  ],
};
