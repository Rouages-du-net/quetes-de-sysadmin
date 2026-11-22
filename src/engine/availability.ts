// The commands a chapter's machine lets you run. A chapter lists the
// commands it teaches (`Chapter.commands`); it also keeps those of every
// chapter it assumes, the same "assumed" chapters as difficulty.ts: the
// chapters that unlock its story (prerequisites() of unlocking.ts) and the
// earlier chapters of its own story. A player who learned grep three
// stories ago still has it. This depends only on the chapter, never on the
// player's save. Commands of chapters it does not assume stay "not learned
// yet".
//
// Three limits keep the inherited commands honest:
// - the machine's system: an inherited command must exist on it. A command
//   belongs to the systems of the chapters that list it (their story's
//   machine, `Machine.os` in machines.ts; Debian otherwise), POSIX's
//   utilities to every Unix-like system, cmdlets and Windows programs only to
//   Windows, CL commands only to IBM i. On a Solaris box, kubectl (listed
//   only by Debian chapters) is not inherited: it answers as Solaris does,
//   "not found".
// - the machine's software: a tool the game simulates with a model of the
//   machine (docker and state.docker, kubectl and state.k8s, psql and
//   state.postgres…) is inherited only where that model or its configuration
//   exists; elsewhere it is not installed: "command not found", as on a real
//   server.
// - `Chapter.withhold`: commands a chapter keeps gated although it assumes
//   them, when one would do the lesson for the player.

import { CATALOGUE as STORIES } from './catalogue';
import { assumed } from './unlocking';
import { MACHINES } from './machines';
import { COMMANDS } from './commands';
import type { Chapter } from './world';
import type { StoryInfo as Story } from './catalogue';
import type { Game } from './shell';

export type Platform = 'linux' | 'freebsd' | 'solaris' | 'ibmi' | 'windows';

/** The system of a story's machine (Debian unless machines.ts says otherwise). */
export const storyPlatform = (story: string): Platform => MACHINES.find((m) => m.story === story)?.os ?? 'linux';

/** The system a session runs (its state.os). */
export const platformOf = (game: Game): Platform => (game.state.os as Platform | undefined) ?? 'linux';

// POSIX's utilities that the game simulates (The Open Group Base
// Specifications, Issue 8, "Utilities":
// https://pubs.opengroup.org/onlinepubs/9799919799/idx/utilities.html): every
// Unix-like system has them, FreeBSD, Solaris and IBM i's PASE included, unless
// its own list says otherwise (LINUX_ONLY, NOT_ON_SOLARIS, NOT_ON_IBMI, which
// the shell checks first).
const POSIX = [
  'alias', 'awk', 'basename', 'cat', 'cd', 'chgrp', 'chmod', 'chown', 'cmp', 'comm', 'command', 'cp', 'crontab', 'cut', 'date', 'df',
  'diff', 'dirname', 'du', 'echo', 'env', 'expr', 'false', 'file', 'find', 'getconf', 'grep', 'head', 'iconv', 'id', 'kill', 'ln',
  'logger', 'ls', 'man', 'mkdir', 'more', 'mv', 'nice', 'nohup', 'od', 'printf', 'ps', 'pwd', 'renice', 'rm', 'rmdir', 'sed', 'sh',
  'sleep', 'sort', 'tail', 'tee', 'test', 'touch', 'tr', 'true', 'type', 'ulimit', 'umask', 'unalias', 'uname', 'uniq', 'wc', 'who',
  'xargs',
];
const UNIX_LIKE: Platform[] = ['linux', 'freebsd', 'solaris', 'ibmi'];

// The systems on which each command exists in the game (computed once).
let platforms: Map<string, Set<Platform>> | null = null;
function commandPlatforms(command: string): Set<Platform> {
  if (!platforms) {
    platforms = new Map();
    for (const s of STORIES)
      for (const c of s.chapters)
        for (const name of c.commands) {
          const set = platforms.get(name) ?? new Set<Platform>();
          set.add(storyPlatform(s.id));
          platforms.set(name, set);
        }
  }
  const c = COMMANDS[command];
  if (c?.cmdlet || c?.winexe) return new Set(['windows']);
  if (c?.cl) return new Set(['ibmi']);
  if (POSIX.includes(command)) return new Set(UNIX_LIKE);
  return platforms.get(command) ?? new Set();
}

// The tools that need a model of the machine: inherited only where they are
// installed (otherwise "command not found"); a chapter that lists one itself
// keeps it as it is.
// A tool counts as installed when its model is in the machine's state, or
// its configuration is in the machine's files.
const MODELS: [string[], string[], string[]][] = [
  [['docker'], ['docker'], ['/etc/docker']],
  [['kubectl', 'k3s'], ['k8s'], ['/etc/rancher']],
  [['psql', 'pg_dump', 'pg_restore', 'createdb', 'dropdb', 'pg_lsclusters', 'pg_ctlcluster', 'pg_isready', 'pg_ctl'], ['postgres'], ['/etc/postgresql']],
  [['ansible', 'ansible-playbook', 'ansible-inventory', 'ansible-doc'], ['ansible'], ['/etc/ansible']],
  [['caddy'], ['caddy'], ['/etc/caddy']],
  [['nginx'], ['nginx'], ['/etc/nginx']],
  [['apache2ctl', 'a2ensite', 'a2dissite', 'a2enmod', 'a2dismod'], ['apache'], ['/etc/apache2']],
  [['postconf', 'postfix', 'postqueue', 'mailq', 'postsuper'], ['mail'], ['/etc/postfix']],
  [['opendkim-genkey', 'opendkim-testkey'], [], ['/etc/opendkim.conf', '/etc/opendkim']],
  [['named-checkzone', 'rndc'], ['dns'], ['/etc/bind']],
  [['fail2ban-client'], ['fail2ban'], ['/etc/fail2ban']],
  [['restic'], ['restic'], []],
  [['rsnapshot'], [], ['/etc/rsnapshot.conf']],
  [['certbot'], [], ['/etc/letsencrypt']],
  [['update-ca-certificates'], [], ['/etc/ca-certificates.conf']],
  [['smartctl', 'mdadm', 'sfdisk', 'grub-install'], ['storage'], []],
  [['pvs', 'vgs', 'lvs', 'pvcreate', 'pvremove', 'vgextend', 'vgreduce', 'pvmove', 'lvextend'], ['storage.lvm'], ['/etc/lvm']],
  [['cryptsetup', 'cryptdisks_start', 'cryptdisks_stop'], ['storage.luks'], ['/etc/crypttab']],
  [['ldapsearch', 'ldapadd', 'ldapmodify', 'ldapdelete', 'ldappasswd', 'ldapwhoami', 'slappasswd', 'slapcat'], ['ldap'], ['/etc/ldap']],
  [['freeradius', 'radtest'], ['radius'], ['/etc/freeradius']],
  [['wg', 'wg-quick'], ['wg'], ['/etc/wireguard']],
  [['dnsmasq'], [], ['/etc/dnsmasq.conf', '/etc/dnsmasq.d']],
  [['exportfs'], ['nfs'], ['/etc/exports']],
  [['testparm', 'smbpasswd', 'pdbedit'], ['samba'], ['/etc/samba']],
  [['lpstat', 'lp', 'lpr', 'lpq', 'cancel', 'lprm', 'cupsenable', 'cupsdisable', 'cupsaccept', 'cupsreject', 'lpadmin', 'lpoptions', 'lpinfo', 'cupsctl', 'cupsd', 'driverless'], ['cups'], ['/etc/cups']],
  [['lynis'], ['lynis'], ['/etc/lynis']],
  [['virsh', 'qemu-img', 'virt-install', 'virt-clone'], ['libvirt'], ['/etc/libvirt']],
  [['keepalived'], ['vrrp'], ['/etc/keepalived']],
  [['haproxy'], ['haproxy'], ['/etc/haproxy']],
  [['promtool', 'prometheus'], ['prometheus'], ['/etc/prometheus']],
  [['amtool', 'alertmanager'], ['alertmanager'], ['/etc/alertmanager']],
];
const inState = (game: Game, key: string): boolean => {
  let v: unknown = game.state;
  for (const k of key.split('.')) v = (v as Record<string, unknown> | undefined)?.[k];
  return v !== undefined && v !== null;
};
const MODEL: Record<string, (g: Game) => boolean> = Object.fromEntries(
  MODELS.flatMap(([names, keys, paths]) => names.map((n) => [n, (g: Game) => keys.some((k) => inState(g, k)) || paths.some((p) => !!g.find(p))] as const)),
);

/** Is this tool installed on this machine (as far as the game's model goes)? */
export const installed = (game: Game, command: string): boolean => !MODEL[command] || MODEL[command](game);

/** The commands a chapter receives from the chapters it assumes (whatever the machine), minus its own and those it withholds. */
export function inherited(chapter: Chapter, stories: readonly Story[] = STORIES): string[] {
  const own = new Set(chapter.commands);
  // sudo comes with the chapter's password (Chapter.password): without one, it isn't learned yet.
  const withheld = new Set([...(chapter.withhold ?? []), ...(chapter.password ? [] : ['sudo', 'visudo'])]);
  const byId = new Map(stories.flatMap((s) => s.chapters.map((c) => [c.id, c] as const)));
  const out = new Set<string>();
  for (const id of assumed(chapter.id, stories))
    for (const c of byId.get(id)?.commands ?? []) if (!own.has(c) && !withheld.has(c)) out.add(c);
  return [...out];
}

// Per chapter, computed once.
const cache = new WeakMap<Chapter, string[]>();

/** The inherited commands that exist on this session's machine: its system, its installed tools. */
export function inheritedHere(game: Game, chapter: Chapter): string[] {
  let all = cache.get(chapter);
  if (!all) {
    all = inherited(chapter);
    cache.set(chapter, all);
  }
  const platform = platformOf(game);
  return all.filter((c) => commandPlatforms(c).has(platform) && installed(game, c));
}
