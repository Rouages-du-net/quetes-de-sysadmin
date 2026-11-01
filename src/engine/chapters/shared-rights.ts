// Story "La Coopérative" — chapter "Shared rights": Lina and
// Karim (group till) keep the till's statements in
// /srv/till/statements, but neither can modify the other's
// files (created -rw-r--r--, with their own group). And when the till
// freezes, they need someone with sudo to restart it.
//   - the directory: group till, group write, setgid bit (what
//     is created in it takes the directory's group); the existing files:
//     chgrp -R, chmod -R g+w;
//   - the mask: umask 002 for Lina and Karim (~/.profile, or
//     /etc/profile.d);
//   - sudo: a rule in /etc/sudoers.d (with visudo) that allows the
//     till group ONLY to restart the till.
// Real traps: a sudoers.d file whose name contains a dot
// (ignored), a command without a full path (refused by visudo), a mistake
// written with nano (sudo refuses everything), a rule too broad (ALL, or
// systemctl without arguments).
// Objective checked on the state: the directory, the files, Lina's and
// Karim's mask, and sudo's policy (what it allows and refuses).
// Sources: https://www.sudo.ws/docs/man/sudoers.man/,
// https://man7.org/linux/man-pages/man2/umask.2.html,
// https://www.gnu.org/software/coreutils/manual/html_node/Directory-Setuid-and-Setgid.html

import { path, d, f, type Chapter, type Node } from '../world';
import type { Game, Shell } from '../shell';
import { newSystemd } from '../systemd';
import { includedFiles, read, permitted } from '../sudoers';
import { cooperativeAccounts, M, NOW, cooperativeWorld, PASSWORD } from './coop';

const STATEMENTS = '/srv/till/statements';
const RESTART = '/usr/bin/systemctl restart till';
const TEAM = ['lina', 'karim'];
const sh = (j: Game) => j as Shell;

// Debian's ~/.profile (/etc/skel/.profile).
const PROFILE = `# ~/.profile: executed by the command interpreter for login shells.
# This file is not read by bash(1), if ~/.bash_profile or ~/.bash_login
# exists.
# see /usr/share/doc/bash/examples/startup-files for examples.
# the files are located in the bash-doc package.

# the default umask is set in /etc/profile; for setting the umask
# for ssh logins, install and configure the libpam-umask package.
#umask 022

# if running bash
if [ -n "$BASH_VERSION" ]; then
    # include .bashrc if it exists
    if [ -f "$HOME/.bashrc" ]; then
	. "$HOME/.bashrc"
    fi
fi

# set PATH so it includes user's private bin if it exists
if [ -d "$HOME/bin" ] ; then
    PATH="$HOME/bin:$PATH"
fi`;

const ETC_PROFILE = `# /etc/profile: system-wide .profile file for the Bourne shell (sh(1))
# and Bourne compatible shells (bash(1), ksh(1), ash(1), ...).

if [ "$(id -u)" -eq 0 ]; then
  PATH="/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"
else
  PATH="/usr/local/bin:/usr/bin:/bin:/usr/local/games:/usr/games"
fi
export PATH

if [ -d /etc/profile.d ]; then
  for i in /etc/profile.d/*.sh; do
    if [ -r $i ]; then
      . $i
    fi
  done
  unset i
fi`;

const file = (content: string, owner: string, group?: string, mode?: string) =>
  f(content, { lines: true, owner, ...(group ? { group } : {}), ...(mode ? { mode } : {}) });

// The mask of a session of this account: the last "umask NNN" line read at
// login (/etc/profile, /etc/profile.d/*.sh, ~/.bashrc, ~/.profile), otherwise 022.
export function maskFor(j: Game, account: string): number {
  const home = j.accounts.users[account]?.home ?? `/home/${account}`;
  const profileD = j.find('/etc/profile.d');
  const sources = [
    '/etc/profile',
    ...(profileD?.type === 'directory'
      ? Object.keys(profileD.children)
          .filter((n) => n.endsWith('.sh'))
          .sort()
          .map((n) => `/etc/profile.d/${n}`)
      : []),
    `${home}/.bashrc`,
    `${home}/.profile`,
  ];
  let mask = 0o022;
  for (const s of sources)
    for (const l of (j.read(s) ?? '').split('\n')) {
      const m = /^\s*umask\s+([0-7]{1,4})\s*$/.exec(l);
      if (m) mask = parseInt(m[1], 8);
    }
  return mask;
}

const okDirectory = (j: Game) => {
  const n = j.find(path(j.t, STATEMENTS));
  return n?.type === 'directory' && (n.group ?? n.owner) === 'till' && n.mode?.[4] === 'w' && n.mode?.[5] === 's';
};
const okFiles = (j: Game) => {
  const n = j.find(path(j.t, STATEMENTS));
  if (n?.type !== 'directory') return false;
  const all = (x: Node): Node[] => (x.type === 'directory' ? Object.values(x.children).flatMap(all) : [x]);
  return all(n).every((x) => (x.group ?? x.owner) === 'till' && (x.mode ?? 'rw-r--r--')[4] === 'w');
};
const okMask = (j: Game) => TEAM.every((c) => (maskFor(j, c) & 0o020) === 0);

const validPolicy = (j: Game) => !read(sh(j)).error;
const restart = (j: Game) => validPolicy(j) && TEAM.every((c) => permitted(sh(j), c, RESTART));
// What the till team must NOT be able to do.
const tropLarge = (j: Game) => validPolicy(j) && TEAM.some((c) => permitted(sh(j), c, '/usr/bin/bash') || permitted(sh(j), c, '/usr/bin/su'));
const wholeSystemctl = (j: Game) =>
  validPolicy(j) && TEAM.some((c) => permitted(sh(j), c, '/usr/bin/systemctl stop ssh') || permitted(sh(j), c, '/usr/bin/systemctl restart ssh'));
const sudoOk = (j: Game) => restart(j) && !tropLarge(j) && !wholeSystemctl(j) && permitted(sh(j), j.player, '/usr/bin/bash');

// A file in /etc/sudoers.d about the till, but that sudo doesn't read (a dot, or ~ at the end).
const ignoreFile = (j: Game) => {
  const directory = j.find('/etc/sudoers.d');
  if (directory?.type !== 'directory') return null;
  const read = includedFiles(sh(j), '/etc/sudoers.d');
  return (
    Object.keys(directory.children)
      .map((n) => `/etc/sudoers.d/${n}`)
      .find((c) => !read.includes(c) && /till/.test(j.read(c) ?? '') && !c.endsWith('.tmp')) ?? null
  );
};

export const rights: Chapter = {
  id: 'shared-rights',
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
    'touch',
    'cp',
    'mv',
    'mkdir',
    'rm',
    'nano',
    'sudo',
    'id',
    'groups',
    'whoami',
    'chmod',
    'chgrp',
    'chown',
    'umask',
    'which',
    'visudo',
    'systemctl',
    'journalctl',
  ],
  home: M,
  welcome: 'email_awa.txt',
  names: true,
  final: 'end',
  // In the order of Awa's email: the directory, the mask, then sudo.
  steps: ['directory', 'mask', 'sudo', 'end'],
  password: PASSWORD,
  accounts: () => cooperativeAccounts(false),
  state: () => ({
    systemd: newSystemd('coop', NOW - 6 * 86_400_000, NOW, {
      till: {
        description: 'Cooperative till',
        active: true,
        executable: 'node',
        process: [{ pid: 731, user: 'till', cpu: 1.2, mem: 3.4, command: '/usr/bin/node /srv/till/app/server.js' }],
      },
    }),
  }),
  createWorld: (t) =>
    cooperativeWorld({
      withoutMarc: true,
      home: { 'email_awa.txt': f(t('shared-rights-email-awa')) },
      homes: {
        lina: d({ '.profile': file(PROFILE, 'lina') }, undefined, { owner: 'lina', mode: 'rwxr-x---' }),
        karim: d({ '.profile': file(PROFILE, 'karim') }, undefined, { owner: 'karim', mode: 'rwxr-x---' }),
      },
      etc: {
        profile: file(ETC_PROFILE, 'root'),
        'profile.d': d({}, undefined, { owner: 'root' }),
        'login.defs': file('# excerpt\nUMASK\t\t022\nUSERGROUPS_ENAB no', 'root'),
      },
      more: {
        srv: d(
          {
            till: d(
              {
                statements: d(
                  {
                    '2027-10-17.txt': file(t('shared-rights-statement-17'), 'lina', 'lina'),
                    '2027-10-18.txt': file(t('shared-rights-statement-18'), 'karim', 'karim'),
                  },
                  undefined,
                  { owner: 'root', group: 'root', mode: 'rwxr-xr-x' },
                ),
              },
              undefined,
              { owner: 'till', group: 'till' },
            ),
          },
          undefined,
          { owner: 'root' },
        ),
      },
    }),
  events: [
    { id: 'sudoers-broken', condition: (j) => !validPolicy(j), message: (j) => j.t('shared-rights-event-sudoers-broken') },
    {
      id: 'file-ignore',
      condition: (j) => !!ignoreFile(j) && !restart(j),
      message: (j) => j.t('shared-rights-event-file-ignore', { file: ignoreFile(j) ?? '' }),
    },
    { id: 'too-large', condition: tropLarge, message: (j) => j.t('shared-rights-event-too-large') },
    { id: 'systemctl-whole', condition: (j) => wholeSystemctl(j) && !tropLarge(j), message: (j) => j.t('shared-rights-event-systemctl-whole') },
    { id: 'sudo', condition: sudoOk, message: (j) => j.t('shared-rights-event-sudo') },
    { id: 'directory', condition: okDirectory, message: (j) => j.t('shared-rights-event-directory', { directory: path(j.t, STATEMENTS) }) },
    { id: 'mask', condition: okMask, message: (j) => j.t('shared-rights-event-mask') },
    { id: 'end', condition: (j) => okDirectory(j) && okFiles(j) && okMask(j) && sudoOk(j), message: (j) => j.t('shared-rights-event-end') },
  ],
};
