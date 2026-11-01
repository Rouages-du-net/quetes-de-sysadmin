// Story "The Co-op", chapter "The departure": Marc, the volunteer
// who ran the server, is moving far away. All his access must be
// removed, cleanly, without breaking anything:
//   - his account: usermod -L only locks the password (his SSH key
//     still works, as man usermod says); it must be expired
//     (usermod -e 1, chage -E 0), have its shell removed, or be deleted;
//   - his key is ALSO in the shared deploy account (the classic trap):
//     remove that line, without touching the others;
//   - sudo: remove him from the sudo group;
//   - his session is still open (who, ps -u marc): close it;
//   - his crontab runs the till's backup from his directory: hand it
//     over to an account that stays (root, or deploy) before deleting
//     anything (userdel -r would erase the script; cron ignores the crontab
//     of a deleted account).
// Objective checked on the state: marc can no longer get in (no password,
// no key, not through deploy), no longer has sudo nor any process, and the backup
// still runs (the same script, outside /home/marc, in the crontab of
// root or deploy, or in /etc/cron.d).
// Sources: https://man7.org/linux/man-pages/man8/usermod.8.html,
// https://man7.org/linux/man-pages/man8/userdel.8.html,
// https://man7.org/linux/man-pages/man1/chage.1.html

import { path, d, f, player, name, type Chapter } from '../world';
import { translator, type Translate } from '../../texts';
import type { Game, Shell } from '../shell';
import { parse } from '../cron';
import { TODAY, keysIn, cooperativeAccounts, M, cooperativeWorld, PASSWORD } from './coop';

// Marc's script, with the backups directory in the language (/srv/backups…).
const script = (t: Translate) => {
  const backups = path(t, '/srv/backups');
  return `#!/bin/sh
# Nightly backup of the till and homes (Marc, 2024)
set -e
DAY=$(date +%F)
mkdir -p ${backups}/$DAY
tar -czf ${backups}/$DAY/till.tar.gz /srv/till
tar -czf ${backups}/$DAY/home.tar.gz /home`;
};
const SCRIPT = 'till-backup.sh';
const crontabMarc = (t: Translate) => `# m h  dom mon dow   command
30 2 * * * /home/marc/bin/${name(t, SCRIPT)}`;
const DEPLOY = '/home/deploy/.ssh/authorized_keys';
const file = (content: string, owner: string, mode?: string) => f(content, { lines: true, owner, ...(mode ? { mode } : {}) });
const sh = (j: Game) => j as Shell;
const key = (line: string) => line.trim().split(/\s+/).slice(0, 2).join(' ');
// The keys without their comment (which is the language's).
const KEYS = keysIn(translator('en'));
const MARC = key(KEYS.marc);

// An account's authorised keys.
const allowed = (j: Game, account: string, home: string) =>
  (j.read(`${home}/.ssh/authorized_keys`) ?? '')
    .split('\n')
    .filter((l) => l.trim().startsWith('ssh-'))
    .map(key);

const openAccount = (j: Game, name: string) => {
  const u = j.accounts.users[name];
  if (!u) return false;
  if (u.expires && u.expires <= TODAY) return false;
  return !/(nologin|false)$/.test(u.shell ?? '/bin/bash');
};

// Can Marc still get in? Through his account (password, or his key: -L does nothing about it), or through deploy.
const byItsAccount = (j: Game) => {
  if (!openAccount(j, 'marc')) return false;
  const locked = ((j.state.lockedAccounts ?? []) as string[]).includes('marc');
  return !locked || allowed(j, 'marc', '/home/marc').includes(MARC);
};
const byDeploy = (j: Game) => openAccount(j, 'deploy') && allowed(j, 'deploy', '/home/deploy').includes(MARC);
const deployIntact = (j: Game) => [KEYS.ci, KEYS.lina].map(key).every((c) => allowed(j, 'deploy', '/home/deploy').includes(c));
const sudoForMarc = (j: Game) => !!j.accounts.users.marc && sh(j).groupsFor('marc').includes('sudo');
const marcProcess = (j: Game) => ((j.state.process ?? []) as { user: string }[]).some((p) => p.user === 'marc');

// The cron jobs (command and account): crontabs of the accounts that exist, and /etc/cron.d (with the account column).
function tasks(j: Game): { account: string; command: string }[] {
  const res: { account: string; command: string }[] = [];
  for (const [account, text] of Object.entries((j.state.crontabs ?? {}) as Record<string, string>))
    if (j.accounts.users[account]) for (const t of parse(text, account).tasks) res.push({ account, command: t.command });
  const cronD = j.find('/etc/cron.d');
  if (cronD?.type === 'directory')
    for (const name of Object.keys(cronD.children))
      for (const l of (j.read(`/etc/cron.d/${name}`) ?? '').split('\n')) {
        const words = l.trim().split(/\s+/);
        if (words.length >= 7 && !l.trim().startsWith('#') && !/=/.test(words[0])) res.push({ account: words[5], command: words.slice(6).join(' ') });
      }
  return res;
}

// Does the backup still run, handed to an account that isn't a person's?
const entrustedBackup = (j: Game, accounts = ['root', 'deploy']) =>
  tasks(j).some(({ account, command }) => {
    const path = command.split(/\s+/).find((m) => m.startsWith('/'));
    if (!path || path.startsWith('/home/marc/') || !accounts.includes(account) || !j.accounts.users[account]) return false;
    return (j.read(path) ?? '').trim() === script(j.t).trim();
  });

const closed = (j: Game) => !byItsAccount(j) && !byDeploy(j) && !sudoForMarc(j) && !marcProcess(j);

export const departure: Chapter = {
  id: 'departure',
  number: 1,
  commands: [
    'ls',
    'cd',
    'pwd',
    'cat',
    'less',
    'head',
    'tail',
    'grep',
    'cp',
    'mv',
    'mkdir',
    'rm',
    'chmod',
    'chown',
    'nano',
    'sudo',
    'id',
    'groups',
    'whoami',
    'who',
    'ps',
    'kill',
    'pkill',
    'usermod',
    'chage',
    'gpasswd',
    'userdel',
    'crontab',
  ],
  home: M,
  welcome: 'email_awa.txt',
  names: true,
  final: 'end',
  password: PASSWORD,
  accounts: () => cooperativeAccounts(),
  state: (t) => ({
    crontabs: { marc: crontabMarc(t) },
    process: [
      { pid: 612, user: 'root', cpu: 0, mem: 0.2, command: 'sshd: /usr/sbin/sshd -D [listener] 0 of 10-100 startups' },
      { pid: 731, user: 'till', cpu: 1.2, mem: 3.4, command: '/usr/bin/node /srv/till/app/server.js' },
      { pid: 2741, user: 'marc', cpu: 0, mem: 0.1, command: 'sshd: marc@pts/1' },
      { pid: 2745, user: 'marc', cpu: 0, mem: 0.1, command: '-bash', ppid: 2741 },
      { pid: 2790, user: 'marc', cpu: 0.1, mem: 0.1, command: 'tail -f /var/log/till/app.log', ppid: 2745 },
      { pid: 3102, user: player(t), cpu: 0, mem: 0.1, command: '-bash' },
    ],
    sessions: [
      { user: 'marc', tty: 'pts/1', since: '2027-10-19 08:12', forEachOf: '198.51.100.40', pid: 2741 },
      { user: player(t), tty: 'pts/0', since: '2027-10-19 09:28', forEachOf: '192.0.2.2' },
    ],
  }),
  createWorld: (t) =>
    cooperativeWorld({
      t,
      home: { 'email_awa.txt': f(t('departure-email-awa')) },
      homes: {
        marc: d(
          {
            '.ssh': d({ authorized_keys: file(keysIn(t).marc, 'marc', 'rw-------') }, undefined, { owner: 'marc', mode: 'rwx------' }),
            bin: d({ [SCRIPT]: file(script(t), 'marc', 'rwxr-xr-x') }, undefined, { owner: 'marc' }),
            'notes.txt': file(t('departure-notes-marc'), 'marc'),
          },
          undefined,
          { owner: 'marc', mode: 'rwxr-xr-x' },
        ),
      },
      more: {
        srv: d(
          {
            till: d({}, undefined, { owner: 'till', group: 'till' }),
            // Last night's backup (it contains /home: Marc's script is in it).
            backups: d(
              {
                '2027-10-18': d({ home: d({ marc: d({ bin: d({ [SCRIPT]: file(script(t), 'root', 'rwxr-xr-x') }) }) }) }, undefined, {
                  owner: 'root',
                }),
              },
              undefined,
              { owner: 'root', mode: 'rwx------' },
            ),
          },
          undefined,
          { owner: 'root' },
        ),
      },
    }),
  events: [
    {
      id: 'lock-only',
      condition: (j) => ((j.state.lockedAccounts ?? []) as string[]).includes('marc') && byItsAccount(j),
      message: (j) => j.t('departure-event-lock-only'),
    },
    { id: 'deploy-empty', condition: (j) => !deployIntact(j), message: (j) => j.t('departure-event-deploy-empty', { file: DEPLOY }) },
    {
      id: 'script-lost',
      condition: (j) => !j.exists('/home/marc/bin') && !entrustedBackup(j),
      message: (j) => j.t('departure-event-script-lost'),
    },
    {
      id: 'task-personal',
      condition: (j) => entrustedBackup(j, [j.player]) && !entrustedBackup(j),
      message: (j) => j.t('departure-event-task-personal'),
    },
    { id: 'backup', condition: (j) => entrustedBackup(j), message: (j) => j.t('departure-event-backup') },
    { id: 'closed', condition: (j) => closed(j) && deployIntact(j), message: (j) => j.t('departure-event-closed') },
    { id: 'end', condition: (j) => closed(j) && deployIntact(j) && entrustedBackup(j), message: (j) => j.t('departure-event-end') },
  ],
};
