// Accounts and groups: id, groups (coreutils), chgrp, chown (coreutils),
// usermod, userdel, gpasswd, chage, useradd, passwd (shadow-utils), adduser
// (Debian), getent (glibc), w (procps-ng), lastlog2 (util-linux). Sources: https://man7.org/linux/man-pages/man1/id.1.html,
// https://man7.org/linux/man-pages/man1/chown.1.html,
// https://man7.org/linux/man-pages/man8/usermod.8.html,
// https://man7.org/linux/man-pages/man8/userdel.8.html, https://man7.org/linux/man-pages/man1/gpasswd.1.html,
// https://man7.org/linux/man-pages/man1/chage.1.html
// Real rules: only root changes the owner; a file's owner can change its
// group to a group they are a member of; usermod -G replaces the
// supplementary groups, usermod -aG adds to them.

import { isRhel, LOGIN_CONTEXT } from '../rhel';
import { squashed } from '../nfs';
import type { Node } from '../world';
import type { Shell } from '../shell';
import { options } from '../tools';
import type { Command } from './index';
import { systemd } from '../systemd';
import { machineIdOf } from '../debian';
import { resolve } from '../ipv6';
import { uptimeLine } from './cpu';

// "1000(you)"
const withNumber = (name: string, number: number | undefined) => `${number ?? '?'}(${name})`;

// Applies a change to a target, and to all its contents with -R.
function forEach(n: Node, recursive: boolean, run: (n: Node) => void) {
  run(n);
  if (recursive && n.type === 'directory') for (const e of Object.values(n.children)) forEach(e, true, run);
}

// The targets of chown and chgrp: checks access, then applies `run`.
function change(game: Shell, command: string, targets: string[], recursive: boolean, allowed: (n: Node) => boolean, run: (n: Node) => void) {
  for (const target of targets) {
    const n = game.find(target);
    if (!n) game.error(game.t('error-access-missing', { command: command, target: target }));
    else if (!game.traverses(target)) game.error(game.t('error-access-permission', { command: command, target: target }));
    else if (!allowed(n)) game.error(game.t(`${command}-not-allowed`, { target: target }));
    else forEach(n, recursive, run);
  }
  return '';
}

// ——— Passwords ———
// The game keeps an account's password in clear (state.passwords: it is
// never shown; /etc/shadow would hold its hash): the player's is the
// chapter's (sudo's) until changed with passwd. Locked accounts (usermod -L,
// passwd -l) are in state.lockedAccounts; accounts created by useradd have no
// password yet (state.unsetPasswords: "!" in /etc/shadow). root has none
// (Debian installed with sudo), unless one is set (sudo passwd root).

/** The account's password, if the game knows it. */
export function passwordOf(game: Shell, user: string): string | undefined {
  return (game.state.passwords as Record<string, string> | undefined)?.[user] ?? (user === game.player ? game.playerPassword() : undefined);
}
const locked = (game: Shell, user: string) => ((game.state.lockedAccounts ?? []) as string[]).includes(user);
const unset = (game: Shell, user: string) => ((game.state.unsetPasswords ?? []) as string[]).includes(user);
/** Can this password open this account (su, login)? */
export const opens = (game: Shell, user: string, typed: string) => !locked(game, user) && !unset(game, user) && passwordOf(game, user) !== undefined && passwordOf(game, user) === typed;

function setPassword(game: Shell, user: string, value: string) {
  (game.state.passwords ??= {})[user] = value;
  game.state.unsetPasswords = ((game.state.unsetPasswords ?? []) as string[]).filter((u) => u !== user);
  (game.state.passwordChanged ??= {})[user] = day(game);
}
// Today's date on the machine (YYYY-MM-DD).
const day = (game: Shell) => new Date(systemd(game)?.clock ?? Date.UTC(2027, 0, 1)).toISOString().slice(0, 10);

// The new password, typed twice (PAM's pam_unix, as passwd asks it): `done` gets it, or the reason it failed.
function askNew(game: Shell, user: string, before: string | undefined, checkQuality: boolean, done: (ok: boolean, lines: string[]) => string) {
  const fail = (reason: string[]) => {
    game.status = 10;
    game.lastStatus = 10;
    return done(false, [...reason, game.t('passwd-token-error')]);
  };
  game.ask(
    game.t('passwd-new'),
    (first) => {
      if (first === '') return fail([game.t('passwd-none-supplied')]);
      if (checkQuality && first === before) return fail([game.t('passwd-unchanged-same')]);
      if (checkQuality && first.length < 6) return fail([game.t('passwd-too-short')]);
      game.ask(
        game.t('passwd-retype'),
        (second) => {
          if (second !== first) return fail([game.t('passwd-mismatch')]);
          setPassword(game, user, first);
          return done(true, [game.t('passwd-updated')]);
        },
        true,
      );
      return '';
    },
    true,
  );
}

// passwd(1) of shadow-utils 4.17, with PAM's prompts: https://manpages.debian.org/trixie/passwd/passwd.1.en.html
function passwd(game: Shell, args: string[]): string {
  const flags = new Set<string>();
  const names: string[] = [];
  const LONG: Record<string, string> = { '--lock': 'l', '--unlock': 'u', '--status': 'S', '--delete': 'd', '--expire': 'e', '--all': 'a', '--quiet': 'q' };
  for (const a of args) {
    if (LONG[a]) flags.add(LONG[a]);
    else if (/^-[a-zA-Z]+$/.test(a)) for (const l of a.slice(1)) flags.add(l);
    else if (a.startsWith('-')) return game.error(game.t('passwd-usage'), 2);
    else names.push(a);
  }
  const bad = [...flags].find((l) => !'luSdeaq'.includes(l));
  if (bad) return game.error(`passwd: invalid option -- '${bad}'\n${game.t('passwd-usage')}`, 2);
  const actor = game.who;
  const root = actor === 'root';
  // -S -a: every account's status.
  if (flags.has('S') && flags.has('a')) {
    if (!root) return game.error(game.t('passwd-not-allowed', { user: actor }), 1);
    return Object.keys(game.accounts.users).map((u) => statusLine(game, u)).join('\n');
  }
  const user = names[0] ?? actor;
  if (!game.accounts.users[user]) return game.error(game.t('passwd-unknown-user', { user }), 1);
  if (!root && user !== actor) return game.error(game.t('passwd-not-allowed', { user }), 1);
  if (flags.has('S')) return statusLine(game, user);
  if (flags.has('l') || flags.has('u') || flags.has('d') || flags.has('e')) {
    if (!root) return game.error(game.t('passwd-permission'), 1);
    if (flags.has('u')) {
      if (unset(game, user) || passwordOf(game, user) === undefined && user === 'root') return game.error(game.t('passwd-unlock-empty'), 3);
      game.state.lockedAccounts = ((game.state.lockedAccounts ?? []) as string[]).filter((u) => u !== user);
    }
    if (flags.has('l')) game.state.lockedAccounts = [...new Set([...((game.state.lockedAccounts ?? []) as string[]), user])];
    if (flags.has('d')) {
      (game.state.passwords ??= {})[user] = '';
      game.state.unsetPasswords = ((game.state.unsetPasswords ?? []) as string[]).filter((u) => u !== user);
    }
    if (flags.has('e')) (game.state.passwordExpired ??= []).push(user);
    return flags.has('e') && !flags.has('l') && !flags.has('u') ? game.t('passwd-expiry-changed') : game.t('passwd-changed');
  }
  // Changing a password: root sets anyone's without the current one; an account gives its own first.
  const finish = (ok: boolean, lines: string[]) => {
    if (!ok) game.status = game.lastStatus = 10;
    return lines.join('\n');
  };
  if (root) {
    askNew(game, user, undefined, false, finish);
    return '';
  }
  game.ask(
    game.t('passwd-current'),
    (typed) => {
      const current = passwordOf(game, user);
      if (unset(game, user) || current === undefined || typed !== current) {
        game.status = 10;
        game.lastStatus = 10;
        return game.t('passwd-token-error');
      }
      askNew(game, user, current, true, finish);
      return '';
    },
    true,
  );
  return game.t('passwd-changing', { user });
}

// passwd -S: NAME STATUS DATE MIN MAX WARN INACTIVE (P: usable password, L: locked, NP: none).
function statusLine(game: Shell, user: string): string {
  const p = (game.state.passwords as Record<string, string> | undefined)?.[user];
  const state = locked(game, user) || unset(game, user) || (user === 'root' && p === undefined) ? 'L' : p === '' ? 'NP' : 'P';
  const changed = (game.state.passwordChanged as Record<string, string> | undefined)?.[user] ?? '2026-11-02';
  return `${user} ${state} ${changed} 0 99999 7 -1`;
}

// ——— Creating accounts ———

// Debian's skeleton (/etc/skel), copied into a new home directory when the world has none.
const SKEL: Record<string, string> = {
  '.bash_logout': '# ~/.bash_logout: executed by bash(1) when login shell exits.\n\n# when leaving the console clear the screen to increase privacy\n\nif [ "$SHLVL" = 1 ]; then\n    [ -x /usr/bin/clear_console ] && /usr/bin/clear_console -q\nfi',
  '.bashrc': "# ~/.bashrc: executed by bash(1) for non-login shells.\n\n# If not running interactively, don't do anything\ncase $- in\n    *i*) ;;\n      *) return;;\nesac\n\nHISTCONTROL=ignoreboth\nHISTSIZE=1000\nHISTFILESIZE=2000",
  '.profile': '# ~/.profile: executed by the command interpreter for login shells.\n\n# if running bash\nif [ -n "$BASH_VERSION" ]; then\n    # include .bashrc if it exists\n    if [ -f "$HOME/.bashrc" ]; then\n\t. "$HOME/.bashrc"\n    fi\nfi',
};

/** Makes the home directory of a new account, with the files of /etc/skel. */
function makeHome(game: Shell, user: string, home: string, mode: string): void {
  const skel = game.find('/etc/skel');
  const children: Record<string, Node> = {};
  if (skel?.type === 'directory') for (const [n, c] of Object.entries(skel.children)) children[n] = { ...structuredCopy(c), owner: user, group: user };
  else for (const [n, text] of Object.entries(SKEL)) children[n] = { type: 'file', content: text, lines: true, owner: user, group: user };
  const parent = home.replace(/\/[^/]+$/, '') || '/';
  if (!game.exists(parent)) game.place('useradd', parent, { type: 'directory', children: {}, owner: 'root', group: 'root' });
  game.place('useradd', home, { type: 'directory', children, owner: user, group: user, mode });
}
const structuredCopy = (n: Node): Node => (n.type === 'directory' ? { ...n, children: Object.fromEntries(Object.entries(n.children).map(([k, v]) => [k, structuredCopy(v)])) } : { ...n });

// The next free uid (and gid) from 1000 (a system account: below 1000, from 999 down).
function nextId(game: Shell, system: boolean, kind: 'uid' | 'gid'): number {
  const taken = new Set(kind === 'uid' ? Object.values(game.accounts.users).map((u) => u.uid) : Object.values(game.accounts.groups).map((g) => g.gid));
  if (system) {
    let n = 999;
    while (taken.has(n)) n--;
    return n;
  }
  const regular = [...taken].filter((n) => n >= 1000 && n < 60000);
  let n = regular.length ? Math.max(...regular) + 1 : 1000;
  while (taken.has(n)) n++;
  return n;
}

interface NewAccount {
  name: string;
  uid?: number;
  group?: string;
  groups: string[];
  home: string;
  shell: string;
  gecos?: string;
  system: boolean;
}
// Writes the account (and its personal group) into the machine's accounts; returns its uid and gid.
function create(game: Shell, a: NewAccount): { uid: number; gid: number } {
  const uid = a.uid ?? nextId(game, a.system, 'uid');
  let group = a.group;
  let gid: number;
  if (!group) {
    gid = game.accounts.groups[a.name] ? game.accounts.groups[a.name].gid : !Object.values(game.accounts.groups).some((g) => g.gid === uid) ? uid : nextId(game, a.system, 'gid');
    game.accounts.groups[a.name] ??= { gid, members: [] };
    group = a.name;
  } else gid = game.accounts.groups[group].gid;
  game.accounts.users[a.name] = { uid, group, home: a.home, shell: a.shell, ...(a.gecos ? { gecos: a.gecos } : {}) };
  for (const g of a.groups) if (!game.accounts.groups[g].members.includes(a.name)) game.accounts.groups[g].members.push(a.name);
  game.state.unsetPasswords = [...new Set([...((game.state.unsetPasswords ?? []) as string[]), a.name])];
  return { uid, gid };
}

// useradd(8) of shadow-utils 4.17, with Debian's defaults (/etc/default/useradd:
// SHELL=/bin/sh; no home without -m; a group named after the account).
// https://manpages.debian.org/trixie/passwd/useradd.8.en.html
function useradd(game: Shell, args: string[]): string {
  const valued: Record<string, string> = { '-s': 's', '--shell': 's', '-G': 'G', '--groups': 'G', '-g': 'g', '--gid': 'g', '-d': 'd', '--home-dir': 'd', '-u': 'u', '--uid': 'u', '-c': 'c', '--comment': 'c', '-e': 'e', '--expiredate': 'e', '-p': 'p', '--password': 'p', '-k': 'k', '--skel': 'k' };
  const switches: Record<string, string> = { '-m': 'm', '--create-home': 'm', '-M': 'M', '--no-create-home': 'M', '-N': 'N', '--no-user-group': 'N', '-U': 'U', '--user-group': 'U', '-r': 'r', '--system': 'r', '--badname': 'b' };
  const o: Record<string, string> = {};
  const names: string[] = [];
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    // Grouped switches (-mU) and a valued option at the end of a group (-ms /bin/bash).
    if (/^-[a-zA-Z]{2,}$/.test(a) && [...a.slice(1)].every((l, k, all) => switches[`-${l}`] || (k === all.length - 1 && valued[`-${l}`]))) {
      for (const l of a.slice(1)) {
        if (switches[`-${l}`]) o[switches[`-${l}`]] = 'yes';
        else o[valued[`-${l}`]] = args[++i] ?? '';
      }
    } else if (valued[a]) o[valued[a]] = args[++i] ?? '';
    else if (switches[a]) o[switches[a]] = 'yes';
    else if (a.startsWith('--') && valued[a.split('=')[0]]) o[valued[a.split('=')[0]]] = a.slice(a.indexOf('=') + 1);
    else if (a.startsWith('-')) return game.error(`useradd: ${a.startsWith('--') ? `unrecognized option '${a}'` : `invalid option -- '${a.slice(1, 2)}'`}\n${game.t('useradd-usage')}`, 2);
    else names.push(a);
  }
  const name = names[0];
  if (!name || names.length > 1) return game.error(game.t('useradd-usage'), 2);
  if (game.who !== 'root') return game.error(game.t('useradd-permission'), 1);
  if (!o.b && !/^[a-z_][a-z0-9_-]*\$?$/.test(name) || name.length > 32) return game.error(game.t('useradd-bad-name', { user: name }), 3);
  if (game.accounts.users[name]) return game.error(game.t('useradd-exists', { user: name }), 9);
  const groups = (o.G ?? '').split(',').filter(Boolean);
  const missing = [...groups, ...(o.g ? [o.g] : [])].find((g) => !game.accounts.groups[g] && !Object.values(game.accounts.groups).some((x) => String(x.gid) === g));
  if (missing) return game.error(game.t('useradd-group-missing', { group: missing }), 6);
  const primary = o.g ? (game.accounts.groups[o.g] ? o.g : Object.entries(game.accounts.groups).find(([, x]) => String(x.gid) === o.g)![0]) : o.N ? 'users' : undefined;
  if (!primary && game.accounts.groups[name]) return game.error(game.t('useradd-group-exists', { group: name }), 9);
  if (o.N && !game.accounts.groups.users) game.accounts.groups.users = { gid: 100, members: [] };
  if (o.u !== undefined) {
    if (!/^\d+$/.test(o.u)) return game.error(game.t('useradd-uid-invalid', { uid: o.u }), 3);
    if (Object.values(game.accounts.users).some((u) => String(u.uid) === o.u)) return game.error(game.t('useradd-uid-exists', { uid: o.u }), 4);
  }
  const home = o.d ? game.resolve(o.d) : `/home/${name}`;
  create(game, { name, uid: o.u !== undefined ? Number(o.u) : undefined, group: primary, groups, home, shell: o.s || '/bin/sh', gecos: o.c, system: !!o.r });
  const users = game.accounts.users;
  if (o.e) users[name].expires = o.e;
  if (o.m && !o.M) {
    if (game.exists(home)) return game.error(game.t('useradd-home-exists', { home }));
    makeHome(game, name, home, 'rwxr-xr-x');
  }
  return '';
}

// adduser(8), Debian's friendlier front end (adduser 3.152, Debian 13): it
// creates the group and the home directory (mode 0700), copies /etc/skel,
// asks the password then the GECOS fields (chfn's questions), and adds the
// account to the "users" group; "adduser ACCOUNT GROUP" adds an existing
// account to a group. https://manpages.debian.org/trixie/adduser/adduser.8.en.html
function adduser(game: Shell, args: string[]): string {
  const o: Record<string, string> = {};
  const names: string[] = [];
  const valued = ['--gecos', '--comment', '--shell', '--home', '--uid', '--ingroup', '--gid'];
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    const [k, v] = a.includes('=') ? [a.slice(0, a.indexOf('=')), a.slice(a.indexOf('=') + 1)] : [a, undefined];
    if (valued.includes(k)) o[k.slice(2)] = v ?? args[++i] ?? '';
    else if (['--disabled-password', '--disabled-login', '--system', '--no-create-home', '--quiet', '-q', '--allow-bad-names', '--allow-all-names'].includes(a)) o[a.replace(/^-+/, '')] = 'yes';
    else if (a.startsWith('-')) return game.error(game.t('adduser-usage'), 1);
    else names.push(a);
  }
  if (!names.length || names.length > 2) return game.error(game.t('adduser-usage'), 1);
  if (game.who !== 'root') return game.error(game.t('adduser-only-root'), 1);
  const [name, toGroup] = names;
  // (Read again after creating the account: TypeScript narrowed it to absent.)
  const accounts = () => game.accounts;
  const info = (key: string, vars: Record<string, string> = {}) => (o.quiet || o.q ? [] : [game.t(key, vars)]);
  // adduser ACCOUNT GROUP: an existing account joins a group.
  if (toGroup) {
    if (!game.accounts.users[name]) return game.error(game.t('adduser-user-missing', { user: name }), 1);
    const g = game.accounts.groups[toGroup];
    if (!g) return game.error(game.t('adduser-group-missing', { group: toGroup }), 1);
    if (g.members.includes(name) || game.accounts.users[name].group === toGroup) return info('adduser-already-member', { user: name, group: toGroup }).join('\n');
    g.members.push(name);
    return info('adduser-adding-to-group', { user: name, group: toGroup }).join('\n');
  }
  if (!o['allow-bad-names'] && !o['allow-all-names'] && !/^[a-z][-a-z0-9_]*$/.test(name)) return game.error(game.t('adduser-bad-name'), 1);
  if (game.accounts.users[name]) return game.error(game.t('adduser-exists', { user: name }), 1);
  const group = o.ingroup;
  if (group && !game.accounts.groups[group]) return game.error(game.t('adduser-group-missing', { group }), 1);
  const home = o.home ?? `/home/${name}`;
  const system = !!o.system;
  if (!game.accounts.groups.users) game.accounts.groups.users = { gid: 100, members: [] };
  const lines = [...info('adduser-adding-user', { user: name }), ...info('adduser-selecting', { from: system ? '100' : '1000', to: system ? '999' : '59999' })];
  const { uid, gid } = create(game, { name, uid: o.uid ? Number(o.uid) : undefined, group, groups: [], home, shell: o.shell ?? (system ? '/usr/sbin/nologin' : '/bin/bash'), gecos: o.gecos ?? o.comment, system });
  if (!group) lines.push(...info('adduser-adding-group', { group: name, gid: String(gid) }));
  lines.push(...info('adduser-adding-new-user', { user: name, uid: String(uid), group: group ?? name, gid: String(gid) }));
  if (!o['no-create-home'] && !system) {
    lines.push(...info('adduser-creating-home', { home }));
    if (!game.exists(home)) {
      makeHome(game, name, home, 'rwx------');
      lines.push(...info('adduser-copying'));
    }
  }
  if (system) return lines.join('\n');
  const extra = () => {
    game.accounts.groups.users.members = [...new Set([...game.accounts.groups.users.members, name])];
    return [...info('adduser-extra-groups', { user: name }), ...info('adduser-adding-to-group', { user: name, group: 'users' })].join('\n');
  };
  // The GECOS fields, as chfn asks them; Y (or Enter) keeps them, n asks again.
  const fields = ['adduser-full-name', 'adduser-room', 'adduser-work-phone', 'adduser-home-phone', 'adduser-other'];
  const askInfo = (intro: string[]): string => {
    const values: string[] = [];
    const next = (k: number): void => {
      game.ask(`\t${game.t(fields[k])} []: `, (v) => {
        values.push(v);
        if (k + 1 < fields.length) {
          next(k + 1);
          return '';
        }
        game.ask(game.t('adduser-correct'), (yes) => {
          if (/^n/i.test(yes)) return askInfo([]);
          // chfn's GECOS: full name, room, work phone, home phone (and other, only if given).
          accounts().users[name].gecos = [...values.slice(0, 4), ...(values[4] ? [values[4]] : [])].join(',');
          return extra();
        });
        return '';
      });
    };
    next(0);
    return [...intro, game.t('adduser-changing-info', { user: name }), game.t('adduser-enter-value')].join('\n');
  };
  const afterPassword = (passwordLines: string[]) => (o.gecos !== undefined || o.comment !== undefined ? [...passwordLines, extra()].join('\n') : askInfo(passwordLines));
  if (o['disabled-password'] || o['disabled-login']) {
    accounts().users[name].gecos ??= '';
    const intro = lines;
    if (o.gecos !== undefined || o.comment !== undefined) return [...intro, extra()].join('\n');
    return `${intro.join('\n')}\n${askInfo([])}`;
  }
  const askPassword = (): void => {
    askNew(game, name, undefined, false, (ok, out) => {
      if (ok) return afterPassword(out);
      game.ask(game.t('adduser-try-again'), (again) => {
        if (/^y/i.test(again)) {
          askPassword();
          return '';
        }
        game.status = 0;
        return afterPassword([]);
      });
      return out.join('\n');
    });
  };
  askPassword();
  return lines.join('\n');
}

// ——— Reading the accounts: getent, w, lastlog2 ———

const passwdLine = (game: Shell, name: string) => {
  const u = game.accounts.users[name];
  return [name, 'x', u.uid, game.accounts.groups[u.group]?.gid ?? u.uid, u.gecos ?? '', u.home ?? `/home/${name}`, u.shell ?? '/bin/bash'].join(':');
};

// getent(1) (glibc): the name service's databases, here the local files.
function getent(game: Shell, args: string[]): string {
  const [db, ...keys] = args.filter((a) => !a.startsWith('-'));
  if (!db) return game.error("getent: wrong number of arguments\nTry `getent --help' or `getent --usage' for more information.", 1);
  const found: string[] = [];
  let missing = false;
  const pick = (all: [string, string, string][]) => {
    if (!keys.length) return all.map(([, , l]) => l);
    return keys.flatMap((k) => {
      const hit = all.find(([n, id]) => n === k || id === k);
      if (!hit) missing = true;
      return hit ? [hit[2]] : [];
    });
  };
  if (db === 'passwd') found.push(...pick(Object.entries(game.accounts.users).map(([n, u]) => [n, String(u.uid), passwdLine(game, n)])));
  else if (db === 'group') found.push(...pick(Object.entries(game.accounts.groups).map(([n, g]) => [n, String(g.gid), `${n}:x:${g.gid}:${g.members.join(',')}`])));
  else if (db === 'shadow') {
    // Only root reads /etc/shadow.
    if (game.who !== 'root') {
      game.status = 2;
      return '';
    }
    found.push(...pick(Object.keys(game.accounts.users).map((n) => [n, '', shadowLine(game, n)])));
  } else if (db === 'hosts' || db === 'ahosts') {
    const lines = (game.read('/etc/hosts') ?? '').split('\n').map((l) => l.replace(/#.*/, '').trim()).filter(Boolean).map((l) => l.split(/\s+/));
    if (!keys.length) found.push(...lines.map(([a, ...n]) => `${a.padEnd(15)} ${n.join(' ')}`));
    for (const k of keys) {
      const line = lines.find(([a, ...n]) => a === k || n.includes(k));
      if (line) found.push(`${line[0].padEnd(15)} ${line.slice(1).join(' ')}`);
      else {
        const address = resolve(game, k, 4)[0] ?? resolve(game, k, 6)[0];
        if (address) found.push(`${address.padEnd(15)} ${k}`);
        else missing = true;
      }
    }
  } else return game.error(`Unknown database: ${db}\nTry \`getent --help' or \`getent --usage' for more information.`, 1);
  if (missing || (keys.length && !found.length)) game.status = 2;
  return found.join('\n');
}

// A line of /etc/shadow: a yescrypt hash ($y$…) for a password, ! for a locked or new account, * for root.
function shadowLine(game: Shell, user: string): string {
  const p = (game.state.passwords as Record<string, string> | undefined)?.[user] ?? (user === game.player ? game.playerPassword() : undefined);
  const hash = p === '' ? '' : p !== undefined && !unset(game, user) ? `$y$j9T$${machineIdOf(`${user}:salt`).slice(0, 22)}$${machineIdOf(`${user}:${p}`)}${machineIdOf(p).slice(0, 11)}` : user === 'root' ? '*' : '!';
  const days = Math.floor(Date.parse(((game.state.passwordChanged as Record<string, string> | undefined)?.[user] ?? '2026-11-02')) / 86_400_000);
  return `${user}:${locked(game, user) && hash !== '!' ? `!${hash}` : hash}:${days}:0:99999:7:::`;
}

// w (procps-ng 4): uptime's line, then who is logged in and what they run.
function w(game: Shell, args: string[]): string {
  const sessions: { user: string; tty: string; since: string; forEachOf: string; pid?: number }[] = game.state.sessions ?? [];
  const live = ((game.state.process ?? []) as { pid: number }[]).map((p) => p.pid);
  const users = args.filter((a) => !a.startsWith('-'));
  const shown = sessions.filter((x) => (x.pid === undefined || live.includes(x.pid)) && (!users.length || users.includes(x.user)));
  const header = args.some((a) => a === '-h' || a === '--no-header');
  const short = args.some((a) => a === '-s' || a === '--short');
  const rows = shown.map((x) => {
    const mine = x.user === game.player && x.tty === 'pts/0';
    const what = mine ? ['w', ...args].join(' ') : '-bash';
    const from = x.forEachOf.slice(0, 16).padEnd(16);
    return short
      ? `${x.user.slice(0, 8).padEnd(8)} ${x.tty.padEnd(8)} ${from} ${mine ? ' 0.00s' : ' 2:41m'} ${what}`
      : `${x.user.slice(0, 8).padEnd(8)} ${x.tty.padEnd(8)} ${from} ${x.since.slice(11, 16).padEnd(7)} ${mine ? ' 0.00s' : ' 2:41m'}  0.03s  0.00s ${what}`;
  });
  if (header) return rows.join('\n');
  return [uptimeLine(game, []), short ? 'USER     TTY      FROM              IDLE WHAT' : 'USER     TTY      FROM             LOGIN@   IDLE   JCPU   PCPU  WHAT', ...rows].join('\n');
}

// lastlog2 (util-linux 2.41): each account's last login, from what the
// machine remembers (last's connections, the open sessions). Debian 13 no
// longer has lastlog (not year-2038 safe): lastlog2 replaces it.
function lastlog2(game: Shell, args: string[]): string {
  const i = args.findIndex((a) => a === '-u' || a === '--user');
  const only = i >= 0 ? args[i + 1] : null;
  if (only && !game.accounts.users[only]) return game.error(`lastlog2: Unknown user or range: ${only}`, 1);
  const past = (game.state.pastConnections ?? []) as { account: string; tty: string; since: string; start: number }[];
  const sessions: { user: string; tty: string; since: string; forEachOf: string }[] = game.state.sessions ?? [];
  const lines = ['Username         Port     From                                       Latest'];
  const fmt = (ms: number) => {
    const d = new Date(ms);
    const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${DAYS[d.getUTCDay()]} ${MONTHS[d.getUTCMonth()]} ${String(d.getUTCDate()).padStart(2)} ${d.toISOString().slice(11, 19)} +0100 ${d.getUTCFullYear()}`;
  };
  for (const name of Object.keys(game.accounts.users).sort((a, b) => game.accounts.users[a].uid - game.accounts.users[b].uid)) {
    if (only && name !== only) continue;
    const s = sessions.find((x) => x.user === name);
    const p = past.filter((x) => x.account === name).sort((a, b) => b.start - a.start)[0];
    const at = s ? Date.parse(`${s.since.replace(' ', 'T')}:00Z`) : p?.start;
    const tty = s?.tty ?? p?.tty ?? '';
    const from = s?.forEachOf ?? p?.since ?? '';
    if (at === undefined || Number.isNaN(at)) {
      if (!only && !args.includes('-a') && !args.includes('--active')) lines.push(`${name.padEnd(16)} ${''.padEnd(8)} ${''.padEnd(42)} **Never logged in**`);
      else if (only) lines.push(`${name.padEnd(16)} ${''.padEnd(8)} ${''.padEnd(42)} **Never logged in**`);
      continue;
    }
    lines.push(`${name.padEnd(16)} ${tty.padEnd(8)} ${from.padEnd(42)} ${fmt(at)}`);
  }
  return lines.join('\n');
}

export const ACCOUNTS: Record<string, Command> = {
  useradd: { section: 8, ownOptions: true, launch: ({ args, game }) => useradd(game, args) },
  adduser: { section: 8, ownOptions: true, launch: ({ args, game }) => adduser(game, args) },
  passwd: { ownOptions: true, launch: ({ args, game }) => passwd(game, args) },
  getent: { ownOptions: true, launch: ({ args, game }) => getent(game, args) },
  w: { ownOptions: true, launch: ({ args, game }) => w(game, args) },
  lastlog2: { section: 8, ownOptions: true, launch: ({ args, game }) => lastlog2(game, args) },
  id: {
    launch: ({ args, game }) => {
      // -u, -g, -G: only the uid, the main gid, every gid; -n: their names instead.
      const { letters, rest } = options(args);
      const name = rest[0] ?? game.who;
      const u = game.accounts.users[name];
      if (!u) return game.error(game.t('id-missing', { user: name }));
      const gid = (g: string) => game.accounts.groups[g]?.gid;
      // -Z: the process's SELinux context (only on a kernel with SELinux, rhel.ts).
      if (letters.has('Z')) {
        if (!isRhel(game)) return game.error('id: --context (-Z) works only on an SELinux-enabled kernel');
        if (rest.length) return game.error("id: cannot print security context when user specified");
        return LOGIN_CONTEXT;
      }
      const only = ['u', 'g', 'G'].filter((l) => letters.has(l));
      if (only.length > 1) return game.error('id: cannot print "only" of more than one choice');
      if (!only.length && letters.has('n')) return game.error('id: cannot print only names or real IDs in default format');
      const names = letters.has('n');
      if (only[0] === 'u') return names ? name : String(u.uid);
      if (only[0] === 'g') return names ? u.group : String(gid(u.group) ?? u.group);
      if (only[0] === 'G') return game.groupsFor(name).map((g) => (names ? g : String(gid(g) ?? g))).join(' ');
      const line = game.t('id-line', {
        uid: withNumber(name, u.uid),
        gid: withNumber(u.group, gid(u.group)),
        groups: game.groupsFor(name).map((g) => withNumber(g, gid(g))).join(','),
      });
      // With SELinux, id of the current process adds its context (coreutils' id.c).
      return isRhel(game) && !rest.length ? `${line} context=${LOGIN_CONTEXT}` : line;
    },
  },

  groups: {
    launch: ({ args, game }) => {
      if (!args.length) return game.groupsFor(game.who).join(' ');
      return args
        .map((name) =>
          game.accounts.users[name] ? `${name} : ${game.groupsFor(name).join(' ')}` : game.error(game.t('groups-missing', { user: name })),
        )
        .filter(Boolean)
        .join('\n');
    },
  },

  chgrp: {
    launch: ({ args, game }) => {
      const { letters, rest } = options(args);
      const [group, ...targets] = rest;
      if (!group || !targets.length) return game.error(game.t('chgrp-usage'));
      if (!game.accounts.groups[group]) return game.error(game.t('chgrp-group-incorrect', { group: group }));
      const allowed = (n: Node) => game.who === 'root' || ((n.owner ?? game.player) === game.who && game.groupsFor(game.who).includes(group));
      return change(game, 'chgrp', targets, letters.has('R'), allowed, (n) => (n.group = group));
    },
  },

  chown: {
    launch: ({ args, game }) => {
      const { letters, rest } = options(args);
      const [owner, ...targets] = rest;
      if (!owner || !targets.length) return game.error(game.t('chown-usage'));
      // A number (uid, gid) is accepted even with no account holding it: ls -l then shows it as is.
      const byUid = (x: string) => Object.entries(game.accounts.users).find(([, u]) => String(u.uid) === x)?.[0] ?? x;
      const byGid = (x: string) => Object.entries(game.accounts.groups).find(([, g]) => String(g.gid) === x)?.[0] ?? x;
      const [nameRaw, groupRaw] = owner.split(':');
      const name = nameRaw && /^\d+$/.test(nameRaw) ? byUid(nameRaw) : nameRaw;
      const group = groupRaw && /^\d+$/.test(groupRaw) ? byGid(groupRaw) : groupRaw;
      if (name && !/^\d+$/.test(name) && !game.accounts.users[name]) return game.error(game.t('chown-user-incorrect', { owner: owner }));
      if (group && !/^\d+$/.test(group) && !game.accounts.groups[group]) return game.error(game.t('chown-group-incorrect', { owner: owner }));
      // "chown malo: f": malo's primary group.
      const newGroup = group || (owner.endsWith(':') && name ? (game.accounts.users[name]?.group ?? name) : undefined);
      // Through an NFS mount with root_squash, root is nobody on the server.
      return change(game, 'chown', targets, letters.has('R'), (n) => game.who === 'root' && !squashed(game, n), (n) => {
        if (name) n.owner = name;
        if (newGroup) n.group = newGroup;
      });
    },
  },

  usermod: {
    launch: ({ args, game }) => {
      let addition = false;
      let listing: string | null = null;
      let lock: boolean | null = null;
      let expires: string | null = null;
      let shell: string | null = null;
      let uid: string | null = null;
      const rest: string[] = [];
      for (let i = 0; i < args.length; i++) {
        const a = args[i];
        if (/^-[a-zA-Z]+$/.test(a)) {
          if (a.includes('a')) addition = true;
          // -L locks the password (a "!" in front of its hash in /etc/shadow), -U unlocks it.
          if (a.includes('L')) lock = true;
          if (a.includes('U')) lock = false;
          if (a.includes('G')) listing = args[++i] ?? '';
          // -e: the account's expiry date (YYYY-MM-DD, or 1: 2 January 1970); -s: the login shell.
          if (a.includes('e')) expires = args[++i] ?? '';
          if (a.includes('s')) shell = args[++i] ?? '';
          // -u: a new uid (the files of the home directory follow: here, files belong to a name).
          if (a.includes('u')) uid = args[++i] ?? '';
        } else rest.push(a);
      }
      const name = rest[0];
      if (!name || (listing === null && lock === null && expires === null && shell === null && uid === null))
        return game.error(game.t(addition && listing === null ? 'usermod-a-without-G' : 'usermod-usage'));
      if (addition && listing === null) return game.error(game.t('usermod-a-without-G'));
      if (game.who !== 'root') return game.error(game.t('usermod-permission'));
      const u = game.accounts.users[name];
      if (!u) return game.error(game.t('usermod-user-missing', { user: name }));
      if (uid !== null) {
        if (!/^\d+$/.test(uid)) return game.error(game.t('usermod-uid-invalid', { uid }));
        const taken = Object.entries(game.accounts.users).find(([n, x]) => n !== name && String(x.uid) === uid);
        if (taken) return game.error(game.t('usermod-uid-exists', { uid }), 4);
        // An account with running processes keeps its uid.
        const p = ((game.state.process ?? []) as { pid: number; user: string }[]).find((x) => x.user === name);
        if (p) return game.error(game.t('usermod-used', { user: name, pid: String(p.pid) }), 8);
      }
      let date: string | undefined;
      if (expires !== null && expires !== '') {
        date = dateExpiration(expires) ?? undefined;
        if (!date) return game.error(game.t('usermod-date-invalid', { date: expires }));
      }
      if (listing !== null) {
        const groups = listing.split(',').filter(Boolean);
        const unknown = groups.find((g) => !game.accounts.groups[g]);
        if (unknown) return game.error(game.t('usermod-group-missing', { group: unknown }));
        // Without -a, the supplementary groups are REPLACED by the list.
        if (!addition) for (const g of Object.values(game.accounts.groups)) g.members = g.members.filter((m) => m !== name);
        for (const g of groups) if (!game.accounts.groups[g].members.includes(name)) game.accounts.groups[g].members.push(name);
      }
      if (lock !== null) {
        const locks: string[] = (game.state.lockedAccounts ??= []);
        game.state.lockedAccounts = lock ? [...new Set([...locks, name])] : locks.filter((v) => v !== name);
      }
      if (expires !== null) {
        if (date) u.expires = date;
        else delete u.expires;
      }
      if (shell !== null) u.shell = shell;
      if (uid !== null) u.uid = Number(uid);
      return '';
    },
  },

  // userdel: deletes an account (and, with -r, its home directory and mailbox).
  userdel: {
    launch: ({ args, game }) => {
      const { letters, rest } = options(args);
      const name = rest[0];
      if (!name) return game.error(game.t('userdel-usage'));
      if (game.who !== 'root') return game.error(game.t('userdel-permission'));
      const u = game.accounts.users[name];
      if (!u) return game.error(game.t('userdel-missing', { user: name }), 6);
      // An account still used by a process is not deleted (unless -f).
      const p = ((game.state.process ?? []) as { pid: number; user: string }[]).find((x) => x.user === name);
      if (p && !letters.has('f')) return game.error(game.t('userdel-used', { user: name, pid: String(p.pid) }), 8);
      delete game.accounts.users[name];
      for (const g of Object.values(game.accounts.groups)) g.members = g.members.filter((m) => m !== name);
      // Its personal group (same name) goes too, if it has no other member.
      if (game.accounts.groups[u.group] && u.group === name && !game.accounts.groups[name].members.length) delete game.accounts.groups[name];
      if (letters.has('r')) {
        const home = u.home ?? `/home/${name}`;
        const output: string[] = [];
        if (game.exists(home)) game.erase(home);
        if (game.exists(`/var/mail/${name}`)) game.erase(`/var/mail/${name}`);
        else output.push(game.t('userdel-without-mail', { user: name }));
        return output.join('\n');
      }
      return '';
    },
  },

  // gpasswd -a / -d: adds an account to a group or removes it.
  gpasswd: {
    launch: ({ args, game }) => {
      const i = args.findIndex((a) => a === '-a' || a === '-d');
      const name = args[i + 1];
      const group = args.filter((_, k) => k !== i && k !== i + 1)[0];
      if (i < 0 || !name || !group) return game.error(game.t('gpasswd-usage'), 2);
      if (game.who !== 'root') return game.error(game.t('gpasswd-permission'), 1);
      const g = game.accounts.groups[group];
      if (!g) return game.error(game.t('gpasswd-group-missing', { group: group }), 3);
      if (!game.accounts.users[name]) return game.error(game.t('gpasswd-user-missing', { user: name }), 3);
      if (args[i] === '-a') {
        if (!g.members.includes(name)) g.members.push(name);
        return game.t('gpasswd-addition', { user: name, group: group });
      }
      if (!g.members.includes(name)) return game.error(game.t('gpasswd-not-member', { user: name, group: group }), 3);
      g.members = g.members.filter((m) => m !== name);
      return game.t('gpasswd-indent', { user: name, group: group });
    },
  },

  // chage -l (the account's dates) and -E (its expiry date).
  chage: {
    launch: ({ args, game }) => {
      const i = args.indexOf('-E');
      const listing = args.includes('-l');
      const name = args.filter((a, k) => !a.startsWith('-') && (i < 0 || k !== i + 1)).at(-1);
      if (!name || (i < 0 && !listing)) return game.error(game.t('chage-usage'), 2);
      const u = game.accounts.users[name];
      if (!u) return game.error(game.t('chage-missing', { user: name }), 1);
      if (listing && i < 0) {
        if (game.who !== 'root' && game.who !== name) return game.error(game.t('chage-permission'), 1);
        return game.t('chage-list', { expire: u.expires ?? 'never' });
      }
      if (game.who !== 'root') return game.error(game.t('chage-permission'), 1);
      const value = args[i + 1] ?? '';
      if (value === '-1') delete u.expires;
      else {
        const date = value === '0' ? '1970-01-01' : dateExpiration(value);
        if (!date) return game.error(game.t('chage-date-invalid', { date: value }), 2);
        u.expires = date;
      }
      return '';
    },
  },
};

// An expiry date: YYYY-MM-DD, or a number of days since 1 January 1970.
function dateExpiration(text: string): string | null {
  if (/^\d{4}-\d{2}-\d{2}$/.test(text) && !Number.isNaN(Date.parse(text))) return text;
  if (/^\d+$/.test(text)) return new Date(Number(text) * 86_400_000).toISOString().slice(0, 10);
  return null;
}
