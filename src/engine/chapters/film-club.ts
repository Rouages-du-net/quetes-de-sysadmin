// Story "The Other Unix": what its chapters share. The neighbourhood film
// club's server (projector, 192.0.2.34) runs FreeBSD: Lucien, who set it up
// years ago, has moved away. Yanis, the new volunteer, knows Debian; Romy
// chairs the club. A Debian habit breaks in each chapter: a backup script
// (bash, GNU date, sed, stat), services without systemd (pkg, rc.conf,
// service), and a firewall where the last matching rule wins (pf).
// The machine's flavour is in state.os (see ../freebsd.ts).
// Sources: FreeBSD Handbook (https://docs.freebsd.org/en/books/handbook/),
// FreeBSD manual pages (https://man.freebsd.org/).

import { accountsFiles, d, f, type Accounts, type Directory, type Node } from '../world';
import type { Translate } from '../../texts';
import type { Game } from '../shell';
import { publicKey, storyMachine, machineName } from '../machines';
import { newSystemd } from '../systemd';
import type { Process } from '../commands/system';
import type { Listening } from '../commands/ss';
import type { Package, RcService } from '../freebsd';
import { pfService } from '../commands/freebsd';

export const M = '/home/you';
// bobine-2029 in French (passwords.ftl).
export const PASSWORD = 'film-reel-2029';
export const ADDRESS = '192.0.2.34';
// Saturday 6 October 2029, 10:15: the club's monthly screening is tonight.
export const NOW = Date.UTC(2029, 9, 6, 10, 15, 0);
export const YESTERDAY = '2029-10-05';
const BOOT = Date.UTC(2029, 8, 2, 7, 40, 0);
export const SITE = '/usr/local/www/club';

const root = { owner: 'root', group: 'wheel' };

export const filmAccounts = (): Accounts => ({
  users: {
    root: { uid: 0, group: 'wheel', home: '/root', shell: '/bin/sh' },
    you: { uid: 1001, group: 'you', shell: '/bin/sh' },
    www: { uid: 80, group: 'www', home: '/nonexistent', shell: '/usr/sbin/nologin' },
    mysql: { uid: 88, group: 'mysql', home: '/var/db/mysql', shell: '/usr/sbin/nologin' },
  },
  groups: {
    wheel: { gid: 0, members: ['root', 'you'] },
    www: { gid: 80, members: [] },
    mysql: { gid: 88, members: [] },
    you: { gid: 1001, members: [] },
  },
});

// ——— packages: what pkg can install ———

const NGINX_CONF = `# nginx, as installed by pkg, pointed at the club's site by Lucien's notes.
worker_processes  1;

events {
    worker_connections  1024;
}

http {
    include       mime.types;
    default_type  application/octet-stream;
    sendfile        on;
    keepalive_timeout  65;

    server {
        listen       80;
        server_name  projector.internal;
        root   /usr/local/www/club;
        index  index.html;
    }
}`;

const RC_NGINX = `#!/bin/sh
# PROVIDE: nginx
# REQUIRE: LOGIN cleanvar
# KEYWORD: shutdown
#
# Add the following lines to /etc/rc.conf to enable nginx:
# nginx_enable (bool):		Set to "NO" by default.
#				Set it to "YES" to enable nginx

. /etc/rc.subr

name="nginx"
rcvar=nginx_enable
command="/usr/local/sbin/nginx"
load_rc_config $name
run_rc_command "$1"`;

export const CATALOGUE: Record<string, Package> = {
  nginx: {
    version: '1.26.3_1,3',
    comment: 'Robust and small WWW server',
    size: '1.4MiB',
    service: 'nginx',
    files: {
      '/usr/local/etc/rc.d/nginx': RC_NGINX,
      '/usr/local/etc/nginx/nginx.conf': NGINX_CONF,
      '/usr/local/etc/nginx/mime.types': 'types {\n    text/html  html htm;\n    text/css   css;\n    image/jpeg jpeg jpg;\n}',
      '/usr/local/sbin/nginx': '(binary)',
    },
    message: "Recent version of the NGINX introduces dynamic modules support. In\nFreeBSD ports tree this feature was enabled by default with the DSO\nknob. Several vendor's and third-party modules have been converted\nto dynamic modules.",
  },
  bash: {
    version: '5.2.37',
    comment: 'GNU Project\'s Bourne Again SHell',
    size: '9.5MiB',
    files: { '/usr/local/bin/bash': '(binary)' },
    message: "bash requires fdescfs(5) mounted on /dev/fd\n\nIf you have not done it yet, please do the following:\n\n\tmount -t fdescfs fdesc /dev/fd\n\nTo make it permanent, you need the following lines in /etc/fstab:\n\n\tfdesc\t/dev/fd\t\tfdescfs\trw\t0\t0",
  },
};

// ——— rc services ———

const nginxService = (): RcService => ({
  program: 'nginx',
  listening: [{ proto: 'tcp', address: '0.0.0.0', port: 80, process: 'nginx' }],
  check: (game) => (game.exists('/usr/local/etc/nginx/nginx.conf') ? null : ['nginx: [emerg] open() "/usr/local/etc/nginx/nginx.conf" failed (2: No such file or directory)']),
  start: [
    'Performing sanity check on nginx configuration:',
    'nginx: the configuration file /usr/local/etc/nginx/nginx.conf syntax is ok',
    'nginx: configuration file /usr/local/etc/nginx/nginx.conf test is successful',
    'Starting nginx.',
  ],
});

export const services = (): Record<string, RcService> => ({
  sshd: { program: 'sshd', listening: [] },
  cron: { program: 'cron', listening: [] },
  nginx: nginxService(),
  'mysql-server': { program: 'mysqld', listening: [], rcvar: 'mysql_enable' },
  pf: pfService(),
});

// ——— processes and sockets ———

export const proc = (pid: number, user: string, command: string, more: Partial<Process> = {}): Process => ({ pid, user, cpu: 0, mem: 0.1, command, ...more });

export const baseProcesses = (): Process[] => [
  proc(1, 'root', '/sbin/init'),
  proc(512, 'root', '/usr/sbin/syslogd -s'),
  proc(598, 'root', '/usr/sbin/sshd', { mem: 0.2 }),
  proc(611, 'root', '/usr/sbin/cron -s'),
];

export const sshListening = (): Listening[] => [{ proto: 'tcp', address: '0.0.0.0', port: 22, process: 'sshd', pid: 598 }];

/** The state of a FreeBSD chapter: the flavour, a clock, packages, rc services. */
export function filmState(o: { installed?: string[]; running?: Record<string, number>; listening?: Listening[]; process?: Process[]; pf?: unknown }) {
  return {
    os: 'freebsd',
    // No systemd on FreeBSD: this one only keeps the machine's clock (date, ls -l).
    systemd: newSystemd('projector', BOOT, NOW, {}),
    sshd: { load: {}, connectionsToLoad: 1, reloads: 0 },
    listening: [...sshListening(), ...(o.listening ?? [])],
    process: [...baseProcesses(), ...(o.process ?? [])],
    pkg: { installed: o.installed ?? [], catalogue: CATALOGUE },
    rc: { services: services(), running: { sshd: 598, cron: 611, ...(o.running ?? {}) }, nextPid: 900 },
    ...(o.pf ? { pf: o.pf } : {}),
  };
}

// ——— the world ———

const rcConfText = (t: Translate) => `hostname="${hostName(t)}"
ifconfig_vtnet0="inet 192.0.2.34 netmask 255.255.255.0"
defaultrouter="192.0.2.1"
sshd_enable="YES"
ntpd_enable="YES"
# Set dumpdev to "AUTO" to enable crash dumps, "NO" to disable
dumpdev="NO"`;

const SUDOERS = `## sudoers file (the sudo package's, /usr/local/etc/sudoers).
## See the man page for the details on how to write a sudoers file.
root ALL=(ALL:ALL) ALL
## Uncomment to allow members of group wheel to execute any command
%wheel ALL=(ALL:ALL) ALL`;

const INDEX = `<!doctype html>
<title>The Film Club</title>
<h1>Tonight: "The Lighthouse Keeper" (1958), 8 pm</h1>`;

/** The rc.conf Lucien left (the chapters add to it). */
export const baseRcConf = (t: Translate) => rcConfText(t);

export function filmWorld(
  t: Translate,
  o: { home: Record<string, Node>; rcConf?: string; etc?: Record<string, Node>; local?: Record<string, Node>; more?: Record<string, Node>; installed?: string[] },
): Directory {
  const projector = storyMachine('other-unix')!;
  // What the installed packages bring (their files, at the start of the chapter).
  const pkgFiles: Record<string, string> = Object.assign({}, ...(o.installed ?? []).map((p) => CATALOGUE[p].files));
  const local = (prefix: string) => Object.fromEntries(Object.entries(pkgFiles).filter(([p]) => p.startsWith(prefix)).map(([p, c]) => [p.slice(prefix.length), c]));
  const files = (entries: Record<string, string>, mode: string) => Object.fromEntries(Object.entries(entries).map(([n, c]) => [n, f(c, { lines: true, owner: 'root', group: 'wheel', mode })]));
  const nginxConf = local('/usr/local/etc/nginx/');
  return d(
    {
      bin: d({ sh: f('(binary)', { owner: 'root', group: 'wheel', mode: 'r-xr-xr-x' }) }, undefined, root),
      etc: d(
        {
          ...accountsFiles(),
          'rc.conf': f(o.rcConf ?? rcConfText(t), { lines: true, owner: 'root', group: 'wheel' }),
          'rc.d': d({ sshd: f('#!/bin/sh\n# PROVIDE: sshd', { owner: 'root', mode: 'r-xr-xr-x' }), cron: f('#!/bin/sh\n# PROVIDE: cron', { owner: 'root', mode: 'r-xr-xr-x' }), pf: f('#!/bin/sh\n# PROVIDE: pf', { owner: 'root', mode: 'r-xr-xr-x' }) }, undefined, root),
          ssh: d({ sshd_config: f('# FreeBSD: sshd_config(5)\nPermitRootLogin no\nPasswordAuthentication no', { lines: true, owner: 'root' }) }, undefined, root),
          ...(o.etc ?? {}),
        },
        undefined,
        root,
      ),
      home: d(
        {
          you: d({
            ...o.home,
            '.ssh': d({ authorized_keys: f(publicKey(projector, 'you'), { lines: true, mode: 'rw-------' }) }, undefined, { mode: 'rwx------' }),
          }),
        },
        undefined,
        root,
      ),
      usr: d(
        {
          // env, for #!/usr/bin/env bash (it finds bash in the PATH, /usr/local/bin included).
          bin: d({ env: f('(binary)', { owner: 'root', group: 'wheel', mode: 'r-xr-xr-x' }) }, undefined, root),
          local: d(
            {
              etc: d(
                {
                  sudoers: f(SUDOERS, { lines: true, owner: 'root', group: 'wheel', mode: 'r--r-----' }),
                  'rc.d': d(files(local('/usr/local/etc/rc.d/'), 'r-xr-xr-x'), undefined, root),
                  ...(Object.keys(nginxConf).length ? { nginx: d(files(nginxConf, 'rw-r--r--'), undefined, root) } : {}),
                },
                undefined,
                root,
              ),
              bin: d(files(local('/usr/local/bin/'), 'r-xr-xr-x'), undefined, root),
              sbin: d(files(local('/usr/local/sbin/'), 'r-xr-xr-x'), undefined, root),
              www: d({ club: d({ 'index.html': f(INDEX, { lines: true, owner: 'www', group: 'www' }) }, undefined, { owner: 'www', group: 'www' }) }, undefined, root),
              ...(o.local ?? {}),
            },
            undefined,
            root,
          ),
        },
        undefined,
        root,
      ),
      tmp: d({}, undefined, { owner: 'root', mode: 'rwxrwxrwt' }),
      ...(o.more ?? {}),
    },
    undefined,
    root,
  );
}

/** The machine's name in the language (projector → projecteur). */
export const hostName = (t: Translate) => machineName(t, 'projector');
export type { Game };
