// Story "L'Audit" — chapter "The report": Salomé, an auditor, noted four
// hygiene findings on Le Fournil's server. To be fixed without breaking
// anything:
//   - SSH: root can log in (PermitRootLogin yes in sshd_config); the
//     configuration is only applied on reload (sshd -t, reload);
//   - an account that should no longer exist: Lucas, the intern who left at
//     the end of February, still has his account and sudo (userdel, or lock +
//     expire + remove from sudo);
//   - sudo without a password: /etc/sudoers.d/90-cloud-init-users gives
//     "vous" NOPASSWD: ALL (sudo -l shows it);
//   - a secret readable by all: /srv/commandes/.env (the database password)
//     in rw-r--r--; chmod 600 without removing the app's access.
// Objective checked on the state: root refused by sshd (reloaded) without
// locking yourself out, no more active account for Lucas, no more NOPASSWD
// rule for "vous" (sudo still works), the file closed to others but
// readable by the app.
// Sources: https://man.openbsd.org/sshd_config, https://www.sudo.ws/docs/man/sudoers.man/,
// https://man7.org/linux/man-pages/man8/userdel.8.html, https://man7.org/linux/man-pages/man1/chmod.1.html

import { d, f, player, type Chapter } from '../world';
import type { Game, Shell } from '../shell';
import { newSystemd } from '../systemd';
import { allowed } from '../sshd';
import { read, permitted, rulesFor } from '../sudoers';
import { loadSshd, bakeryAccounts, file, M, NOW, PASSWORD, bakeryWorld, serviceSsh, sshd } from './audit';

const ENV = '/srv/commandes/.env';
const sh = (j: Game) => j as Shell;

// The hosting provider's cloud-init: the first account has sudo without a password.
const cloudInitSudo = (account: string) => `# Created by cloud-init v. 24.4 on Tue, 06 Dec 2027 15:51:43 +0000\n\n${account} ALL=(ALL) NOPASSWD:ALL`;

const CONTENT_ENV = `PORT=3000
DATABASE_URL=postgres://commandes:brioche-beurre-91@localhost:5432/commandes
REDIS_URL=redis://localhost:6379`;

const closedRoot = (j: Game) => sshd(j).load.permitrootlogin === 'no';
const between = (j: Game) => allowed(sshd(j).load, j.player);

const lucas = (j: Game) => j.accounts.users.lucas;
const lockedLucas = (j: Game) => ((j.state.lockedAccounts ?? []) as string[]).includes('lucas');
const lucasSudo = (j: Game) => !!j.accounts.groups.sudo?.members.includes('lucas');
const okAccount = (j: Game) => !lucas(j) || (lockedLucas(j) && !!lucas(j).expires && !lucasSudo(j));
// Locked or expired, but still in sudo: the finding is only half dealt with.
const incompleteAccount = (j: Game) => !!lucas(j) && !okAccount(j) && (lockedLucas(j) || !!lucas(j).expires || !lucasSudo(j));

const validPolicy = (j: Game) => !read(sh(j)).error;
const withoutPassword = (j: Game) => rulesFor(sh(j), j.player).some((r) => r.includes('NOPASSWD'));
const sudoOk = (j: Game) => validPolicy(j) && !withoutPassword(j) && permitted(sh(j), j.player, '/usr/bin/bash');

const env = (j: Game) => j.find(ENV);
const closedToOther = (j: Game) => {
  const n = env(j);
  return n?.type === 'file' && (n.mode ?? 'rw-r--r--').slice(6) === '---';
};
// The app (commandes account) must be able to read its file: owner, or group.
const readableByApp = (j: Game) => {
  const n = env(j);
  if (n?.type !== 'file') return false;
  const mode = n.mode ?? 'rw-r--r--';
  return ((n.owner ?? 'you') === 'commandes' && mode[0] === 'r') || ((n.group ?? n.owner) === 'commandes' && mode[3] === 'r');
};
const secretOk = (j: Game) => closedToOther(j) && readableByApp(j);

export const report: Chapter = {
  id: 'report',
  number: 2,
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
    'rm',
    'nano',
    'sudo',
    'visudo',
    'id',
    'groups',
    'whoami',
    'chmod',
    'chown',
    'chage',
    'usermod',
    'userdel',
    'gpasswd',
    'systemctl',
    'journalctl',
    'sshd',
    'last',
  ],
  home: M,
  welcome: 'email_nadia.txt',
  names: true,
  final: 'end',
  // In the order of Salomé's report.
  steps: ['ssh', 'account', 'sudo', 'secret', 'end'],
  password: PASSWORD,
  accounts: () => bakeryAccounts(true),
  state: () => ({
    sshd: { load: {}, connectionsToLoad: 1, reloads: 0 },
    systemd: newSystemd('bakery', NOW - 5 * 86_400_000, NOW, {
      ssh: serviceSsh(),
      commandes: {
        description: 'Fournil orders (commandes)',
        active: true,
        executable: 'node',
        process: [{ pid: 731, user: 'commandes', cpu: 0.8, mem: 3.1, command: '/usr/bin/node /srv/commandes/app/server.js' }],
      },
    }),
  }),
  initialise: (j) => loadSshd(j),
  createWorld: (t) =>
    bakeryWorld(t, {
      home: { 'email_nadia.txt': f(t('report-email-nadia')), 'audit_report.txt': f(t('report-report-audit'), { lines: true }) },
      sudoersD: { '90-cloud-init-users': file(cloudInitSudo(player(t)), 'root', 'r--r-----') },
      more: {
        srv: d(
          {
            commandes: d(
              {
                '.env': f(CONTENT_ENV, { lines: true, owner: 'commandes', group: 'commandes', mode: 'rw-r--r--' }),
                app: d({ 'server.js': file('// orders application (excerpt)', 'commandes') }, undefined, { owner: 'commandes' }),
              },
              undefined,
              { owner: 'commandes' },
            ),
          },
          undefined,
          { owner: 'root' },
        ),
      },
    }),
  events: [
    { id: 'sudoers-broken', condition: (j) => !validPolicy(j), message: (j) => j.t('report-event-sudoers-broken') },
    { id: 'locked-out', condition: (j) => !between(j), message: (j) => j.t('report-event-locked-out') },
    {
      id: 'without-effect',
      condition: (j) => sshd(j).reloads === 0 && /^\s*PermitRootLogin\s+no\b/im.test(j.read('/etc/ssh/sshd_config') ?? ''),
      message: (j) => j.t('report-event-without-effect'),
    },
    { id: 'account-incomplete', condition: incompleteAccount, message: (j) => j.t('report-event-account-incomplete') },
    { id: 'app-blind', condition: (j) => closedToOther(j) && !readableByApp(j), message: (j) => j.t('report-event-app-blind') },
    { id: 'ssh', condition: (j) => closedRoot(j) && between(j), message: (j) => j.t('report-event-ssh') },
    { id: 'account', condition: okAccount, message: (j) => j.t('report-event-account') },
    { id: 'sudo', condition: sudoOk, message: (j) => j.t('report-event-sudo') },
    { id: 'secret', condition: secretOk, message: (j) => j.t('report-event-secret') },
    {
      id: 'end',
      condition: (j) => closedRoot(j) && between(j) && okAccount(j) && sudoOk(j) && secretOk(j),
      message: (j) => j.t('report-event-end'),
    },
  ],
};
