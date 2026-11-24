// Story "The Zine Library": what its chapters share. The Zine Library (la
// Fanzinothèque in French, la Fanzinoteca in Spanish), a volunteer-run
// library of self-published zines, keeps its catalogue on stapler
// (agrafeuse, grapadora), a small Debian 13 server: nginx, the PHP
// catalogue app "zinecat" under php8.4-fpm, the scans of the zines, and
// AppArmor, whose php-fpm profile (Debian's apparmor-profiles package)
// confines the app. Nomvula coordinates the volunteers, Bartek set the
// server up in 2031 (he wrote the site's rules in local/php-fpm) before
// moving away, Rahim moved the scans to the new disk this afternoon,
// Hinewai wrote the nightly backup script.
// Machine: stapler, 192.0.2.190 (RFC 5737); the site is zines.example; the
// volunteers' laptops are on 198.51.100.0/24 behind the library's router.
// Chapter 1: the scans moved to /srv/scans, and php-fpm's profile denies
// them; chapter 2: a profile for the backup script, observed in complain
// mode, then enforced.
// Each command lets a minute pass (chapter 1: a visitor looks at the
// catalogue and a volunteer uploads a scan).
// Sources: https://gitlab.com/apparmor/apparmor/-/raw/apparmor-4.1/profiles/apparmor.d/php-fpm
// (the profile, as Debian trixie's apparmor-profiles 4.1.0-1 installs it),
// https://wiki.debian.org/AppArmor/HowToUse (logs, auditd for the profile
// tools, aa-disable), apparmor.d(5) (local/ files), the PHP manual for
// scandir() and move_uploaded_file()'s warnings, nginx's error log format.

import { accountsFiles, d, f, type Accounts, type Directory, type File, type Node, type Rights } from '../world';
import type { Game, Shell } from '../shell';
import type { Translate } from '../../texts';
import { newSystemd, systemd, writeLog, type DefinitionService } from '../systemd';
import { generateKey } from '../access';
import { machineName } from '../machines';
import { kernel } from '../memory';
import {
  AUDIT_LOG, DIR, apparmor, attachFor, check, endTask, execTask, fileFor, loadAll, modeOf, parseFile, permits, readerOf, withFlags, type Loaded, type Profile,
} from '../apparmor';
import { capNumber } from '../commands/apparmor';
import { content } from '../tools';

export const HOME = '/home/you';
export const PASSWORD = 'riso-ink-33';
export type ChapterNo = 1 | 2;
export const ADDRESS = '192.0.2.190';
export const SITE = 'zines.example';
export const SCANS = '/srv/scans';
export const OLD_SCANS = '/var/www/zinecat/scans';
export const SCRIPT = '/usr/local/sbin/zine-backup';
export const CONF = '/etc/zine-backup.conf';
export const PHP_FPM = `${DIR}/php-fpm`;
export const LOCAL = `${DIR}/local/php-fpm`;
export const FPM = '/usr/sbin/php-fpm8.4';
const MINUTE = 60_000;
const WWW = 33;
// Friday 11 March 2033, 17:40 (the zine fair is tomorrow); Tuesday 22 March 2033, 19:10.
export const NOW: Record<ChapterNo, number> = { 1: Date.UTC(2033, 2, 11, 17, 40, 0), 2: Date.UTC(2033, 2, 22, 19, 10, 0) };
const BOOT: Record<ChapterNo, number> = { 1: Date.UTC(2033, 2, 7, 8, 12, 0), 2: Date.UTC(2033, 2, 18, 9, 3, 0) };
// Rahim moved the scans at 15:12.
const MOVED = Date.UTC(2033, 2, 11, 15, 12, 0);
const VOLUNTEERS = ['198.51.100.23', '198.51.100.31', '198.51.100.47'];
const VISITORS = ['203.0.113.18', '203.0.113.54', '203.0.113.77', '203.0.113.102'];
const UA = 'Mozilla/5.0 (X11; Linux x86_64; rv:140.0) Gecko/20100101 Firefox/140.0';
// The zines scanned before the fair, uploaded one by one.
const NEW_SCANS = ['riso-dreams-04.pdf', 'bus-stop-poems-02.pdf', 'tenants-union-07.pdf', 'grandmas-recipes-01.pdf', 'skate-park-12.pdf', 'night-shift-03.pdf', 'garden-swap-05.pdf', 'radio-free-attic-09.pdf'];
const OLD_ZINES = ['bike-kitchen-01.pdf', 'bike-kitchen-02.pdf', 'queer-ceilidh-03.pdf', 'migrant-voices-11.pdf', 'punk-library-06.pdf', 'tide-pool-02.pdf'];

// ——— Story state (on stapler) ———

export interface Upload {
  at: number;
  name: string;
  ok: boolean;
}
export interface Run {
  at: number;
  code: number;
  // The profile the script ran under (null: unconfined), and its mode.
  label: string | null;
  mode: string | null;
  // What was refused (paths, capabilities), and the sources archived.
  denied: string[];
  archived: string[];
  shadowTried: boolean;
}
export interface Story {
  chapter: ChapterNo;
  ticks: number;
  uploads: Upload[];
  visits: { at: number; ok: boolean }[];
  runs: Run[];
  // The profile file as Debian ships it (chapter 1).
  vendor: string;
  // nginx's connection counter (its error log's *N).
  connection: number;
}
export const story = (j: Game): Story => (j as Shell).principal.state.zines as Story;
export const typed = (j: Game) => (j as Shell).last?.line ?? '';
/** The last command's output contains this; reading the manual doesn't count. */
export const seen = (j: Game, text: string | RegExp) => {
  if (/^\s*(man|apropos|whatis|help)\b|--help\b/.test(typed(j))) return false;
  const last = (j as Shell).last;
  if (!last) return false;
  const all = `${last.output}\n${last.errors.join('\n')}`;
  return typeof text === 'string' ? all.includes(text) : text.test(all);
};

// ——— Files ———

const root: Rights = { owner: 'root' };
const dir = (children: Record<string, Node>, rights: Rights = root) => d(children, undefined, rights);
const file = (text: string, rights: Rights = root): File => f(text, { lines: true, ...rights });
const www: Rights = { owner: 'www-data', group: 'www-data' };

// The php-fpm profile, as apparmor-profiles 4.1.0-1 installs it in /etc/apparmor.d (upstream's file, unchanged).
export const PHP_FPM_PROFILE = `# vim: ft=apparmor

abi <abi/4.0>,

include <tunables/global>

profile php-fpm /usr/{bin,sbin}/php-fpm* flags=(attach_disconnected) {
  # load common libraries and their support files
  include <abstractions/base>
  # resolve hostnames/usernames
  include <abstractions/nameservice>
  # common php files and support files that php needs
  include <abstractions/php>
  # read the system certificates
  include <abstractions/ssl_certs>

  capability net_admin,
  # change user/group of a pool
  capability setuid,
  capability setgid,
  # change ownership of the socket so that we can launch with a different user/group as the socket will be owned by
  capability chown,
  # we want to be able to kill our child processes
  capability kill,
  # to provide sockets with acls different than root
  capability dac_override,

  # we need write access here to move it into a different apparmor sub profile
  @{PROC}/@{pid}/attr/{apparmor/,}current rw,

  # the main log file
  /var/log/php*-fpm.log rw,

  # we need to be able to create all sockets
  @{run}/php{,-fpm,-fpm-legacy}/php*-fpm.pid rw,
  @{run}/php*-fpm.pid rw,
  @{run}/php{,-fpm,-fpm-legacy}/*.sock{,et} rwlk,

  # LP: #2061113
  owner @{run}/systemd/notify w,
  /systemd/notify w,  # disconnected path

  # to reload
  /usr/{bin,sbin}/php-fpm* rix,

  # no idea why php tries to open / read/write
  deny / rw,

  # allow sending signals to our subprocesses
  signal (send) peer=php-fpm//*,

  # allow switching processes to those subprofiles
  change_profile -> php-fpm//*,

  # load all files from this directory
  # store your configurations per pool in this dir
  include if exists <php-fpm.d>

  # Site-specific additions and overrides. See local/README for details.
  include if exists <local/php-fpm>
}`;

// The tunables the game's profiles read (Debian's, the variables they define).
const TUNABLES: Record<string, string> = {
  global: `# ------------------------------------------------------------------
#
#    Copyright (C) 2006-2009 Novell/SUSE
#    Copyright (C) 2010-2014 Canonical Ltd.
#
#    This program is free software; you can redistribute it and/or
#    modify it under the terms of version 2 of the GNU General Public
#    License published by the Free Software Foundation.
#
# ------------------------------------------------------------------

# All the tunables definitions that should be available to every profile
# should be included here

include <tunables/home>
include <tunables/multiarch>
include <tunables/proc>
include <tunables/alias>
include <tunables/kernelvars>
include <tunables/xdg-user-dirs>
include <tunables/share>
include <tunables/etc>
include <tunables/run>
include <tunables/sys>`,
  home: `# @{HOMEDIRS} is a space-separated list of where user home directories
# are stored, for programs that must enumerate all home directories on a
# system.
@{HOMEDIRS}=/home/

# @{HOME} is a space-separated list of all user home directories.
@{HOME}=@{HOMEDIRS}/*/ /root/

include if exists <tunables/home.d>`,
  multiarch: `# @{multiarch} is a glob for the multiarch triplets (x86_64-linux-gnu…).
@{multiarch}=*-linux-gnu*

include if exists <tunables/multiarch.d>`,
  proc: `# @{PROC} is the location where procfs is mounted.
@{PROC}=/proc/`,
  alias: `# Alias rules can be used to rewrite paths and are done after variable
# resolution. For example, if '/usr' is on removable media:
# alias /usr/ -> /mnt/usr/,

include if exists <tunables/alias.d>`,
  kernelvars: `# @{pid} and @{tid}: a process or thread number.
@{pid}={[1-9],[1-9][0-9],[1-9][0-9][0-9],[1-9][0-9][0-9][0-9],[1-9][0-9][0-9][0-9][0-9],[1-9][0-9][0-9][0-9][0-9][0-9],[1-4][0-9][0-9][0-9][0-9][0-9][0-9]}
@{tid}=@{pid}
@{pids}=@{pid}`,
  'xdg-user-dirs': `@{XDG_DESKTOP_DIR}="Desktop"
@{XDG_DOWNLOAD_DIR}="Downloads"

include if exists <tunables/xdg-user-dirs.d>`,
  share: `@{flatpak_exports_root}={flatpak/exports,flatpak/(app|runtime)/*/*/*/*/export}

include if exists <tunables/share.d>`,
  etc: `@{etc_ro}=/{usr/,}etc/
@{etc_rw}=/etc/`,
  run: `# @{run} is the location of the run directory.
@{run}=/run/ /var/run/`,
  sys: `# @{sys} is the location of sysfs.
@{sys}=/sys/`,
};

// The abstractions the story's profiles include, trimmed to what the game reads (Debian's carry many more rules).
const ABSTRACTIONS: Record<string, string> = {
  base: `# vim:syntax=apparmor
# ------------------------------------------------------------------
#    abstractions/base: what most programs need (the game keeps its main
#    lines: the dynamic linker and libraries, locales, /dev's harmless
#    nodes, the process's own /proc entries).
# ------------------------------------------------------------------

  abi <abi/4.0>,

  /etc/ld.so.cache               mr,
  /etc/ld.so.conf                r,
  /etc/ld.so.conf.d/{,*.conf}    r,
  /etc/ld.so.preload             r,
  /{usr/,}lib{,32,64}/**          mr,
  /{usr/,}lib/@{multiarch}/**     mr,
  /etc/locale.alias              r,
  /etc/localtime                 r,
  /usr/share/locale/**           r,
  /usr/share/zoneinfo/{,**}      r,
  /dev/log                       w,
  /dev/null                      rw,
  /dev/zero                      rw,
  /dev/random                    r,
  /dev/urandom                   r,
  /dev/tty                       rw,
  /dev/pts/[0-9]*                rw,
  @{PROC}/sys/kernel/ngroups_max r,
  @{PROC}/sys/kernel/random/uuid r,
  @{PROC}/@{pid}/{maps,stat,status} r,
  owner @{PROC}/@{pid}/fd/       r,
  /sys/devices/system/cpu/online r,

  include if exists <abstractions/base.d>`,
  bash: `# vim:syntax=apparmor
# ------------------------------------------------------------------
#    abstractions/bash: what a shell reads (trimmed in the game).
# ------------------------------------------------------------------

  abi <abi/4.0>,

  /etc/bash.bashrc               r,
  /etc/bash_completion           r,
  /etc/inputrc                   r,
  /etc/profile                   r,
  /etc/profile.d/                r,
  /etc/profile.d/*               r,
  /usr/share/terminfo/**         r,
  @{PROC}/@{pid}/mounts          r,

  include if exists <abstractions/bash.d>`,
  nameservice: `# vim:syntax=apparmor
# ------------------------------------------------------------------
#    abstractions/nameservice: user and host names (trimmed in the game).
# ------------------------------------------------------------------

  abi <abi/4.0>,

  /etc/group                     r,
  /etc/host.conf                 r,
  /etc/hosts                     r,
  /etc/nsswitch.conf             r,
  /etc/gai.conf                  r,
  /etc/passwd                    r,
  /etc/protocols                 r,
  /etc/resolv.conf               r,
  /etc/services                  r,
  @{run}/systemd/resolve/stub-resolv.conf r,
  network inet dgram,
  network inet6 dgram,
  network inet stream,
  network inet6 stream,

  include if exists <abstractions/nameservice.d>`,
  php: `# vim:syntax=apparmor
# ------------------------------------------------------------------
#    abstractions/php: what PHP itself reads (trimmed in the game).
# ------------------------------------------------------------------

  abi <abi/4.0>,

  # shared snippets
  /usr/share/php/                r,
  /usr/share/php/**              mr,
  # Xlibs
  /usr/{lib,lib64,lib32,libx32}/php/**/*.so mr,
  # php extensions
  /usr/lib/php/*/*.so            mr,
  # php5/php7/php8 configuration
  /etc/php{,5,7,8}*/**           r,
  /etc/php/**                    r,
  /usr/share/php*/**             r,
  # sessions
  /var/lib/php/sessions/*        rwk,

  include if exists <abstractions/php.d>`,
  ssl_certs: `# vim:syntax=apparmor
# ------------------------------------------------------------------
#    abstractions/ssl_certs: the system's certificates (trimmed in the game).
# ------------------------------------------------------------------

  abi <abi/4.0>,

  /etc/ssl/                      r,
  /etc/ssl/certs/                r,
  /etc/ssl/certs/*               r,
  /usr/share/ca-certificates/    r,
  /usr/share/ca-certificates/**  r,
  /usr/local/share/ca-certificates/ r,
  /usr/local/share/ca-certificates/** r,

  include if exists <abstractions/ssl_certs.d>`,
};

// Other profiles of the machine (apparmor's, man-db's, apparmor-profiles'), short: their rules trimmed in the game.
const OTHER_PROFILES: Record<string, string> = {
  lsb_release: 'profile lsb_release /usr/bin/lsb_release {\n  include <abstractions/base>\n  include <abstractions/python>\n\n  /usr/bin/lsb_release r,\n  /usr/bin/ r,\n  /usr/bin/python3* ixr,\n  /etc/debian_version r,\n  /etc/lsb-release r,\n  /etc/os-release r,\n\n  include if exists <local/lsb_release>\n}',
  nvidia_modprobe: 'profile nvidia_modprobe /usr/bin/nvidia-modprobe flags=(attach_disconnected) {\n  include <abstractions/base>\n\n  capability chown,\n  capability mknod,\n  capability setuid,\n  capability sys_admin,\n\n  /usr/bin/nvidia-modprobe mr,\n  /usr/bin/kmod Cx -> kmod,\n\n  profile kmod flags=(attach_disconnected) {\n    include <abstractions/base>\n    /usr/bin/kmod mr,\n  }\n\n  include if exists <local/nvidia_modprobe>\n}',
  'unix-chkpwd': 'profile unix-chkpwd /{,usr/}{,s}bin/unix_chkpwd {\n  include <abstractions/base>\n  include <abstractions/nameservice>\n\n  capability dac_read_search,\n  /{,usr/}{,s}bin/unix_chkpwd mr,\n  /etc/shadow r,\n\n  include if exists <local/unix-chkpwd>\n}',
  'usr.bin.man': 'profile man /usr/bin/man {\n  include <abstractions/base>\n\n  /usr/bin/man mr,\n  /usr/share/man/** r,\n  /usr/bin/preconv rmCx -> man_filter,\n  /usr/bin/groff rmPx -> man_groff,\n\n  include if exists <local/usr.bin.man>\n}\n\nprofile man_filter {\n  include <abstractions/base>\n  /usr/share/man/** r,\n  include if exists <local/man_filter>\n}\n\nprofile man_groff {\n  include <abstractions/base>\n  /usr/share/groff/** r,\n  include if exists <local/man_groff>\n}',
  'bin.ping': 'profile ping /{usr/,}bin/{,iputils-}ping flags=(complain) {\n  include <abstractions/base>\n  include <abstractions/consoles>\n  include <abstractions/nameservice>\n\n  capability net_raw,\n  capability setuid,\n  network inet raw,\n  network inet6 raw,\n\n  /{,usr/}bin/{,iputils-}ping mixr,\n  /etc/modules.conf r,\n\n  include if exists <local/bin.ping>\n}',
  'usr.sbin.traceroute': 'profile traceroute /usr/sbin/traceroute {\n  include <abstractions/base>\n  include <abstractions/consoles>\n  include <abstractions/nameservice>\n\n  capability net_raw,\n  network inet raw,\n\n  /usr/sbin/traceroute rmix,\n\n  include if exists <local/usr.sbin.traceroute>\n}',
  busybox: 'profile busybox /usr/bin/busybox flags=(unconfined) {\n  userns,\n\n  # Site-specific additions and overrides. See local/README for details.\n  include if exists <local/busybox>\n}',
  crun: 'profile crun /usr/bin/crun flags=(unconfined) {\n  userns,\n\n  # Site-specific additions and overrides. See local/README for details.\n  include if exists <local/crun>\n}',
  runc: 'profile runc /usr/sbin/runc flags=(unconfined) {\n  userns,\n\n  # Site-specific additions and overrides. See local/README for details.\n  include if exists <local/runc>\n}',
  toybox: 'profile toybox /usr/bin/toybox flags=(unconfined) {\n  userns,\n\n  # Site-specific additions and overrides. See local/README for details.\n  include if exists <local/toybox>\n}',
  'unprivileged_userns': 'profile unprivileged_userns flags=(unconfined) {\n  userns,\n\n  # Site-specific additions and overrides. See local/README for details.\n  include if exists <local/unprivileged_userns>\n}',
};
const withHead = (body: string) => `abi <abi/4.0>,\n\ninclude <tunables/global>\n\n${body}`;

/** Bartek's local additions for php-fpm (and, from chapter 2, the scans' new place). */
export const localPhpFpm = (t: Translate, n: ChapterNo) =>
  [
    t('zine-library-local-comment'),
    '/var/www/zinecat/ r,',
    '/var/www/zinecat/** r,',
    `${OLD_SCANS}/ r,`,
    `${OLD_SCANS}/** rw,`,
    ...(n === 2 ? ['', t('zine-library-local-comment-scans'), `${SCANS}/ r,`, `${SCANS}/** rw,`] : []),
  ].join('\n');

function apparmorTree(t: Translate, n: ChapterNo): Directory {
  const profiles = Object.fromEntries(Object.entries(OTHER_PROFILES).map(([k, v]) => [k, file(withHead(v))]));
  return dir({
    abi: dir({ '4.0': file('# The kernel features this policy is written for (AppArmor 4.0 ABI).\n# Written by apparmor_parser --features-file; the game does not read it.') }),
    abstractions: dir({ ...Object.fromEntries(Object.entries(ABSTRACTIONS).map(([k, v]) => [k, file(v)])), consoles: file('  abi <abi/4.0>,\n\n  /dev/console rw,\n  /dev/tty rw,\n  /dev/pts/[0-9]* rw,'), python: file('  abi <abi/4.0>,\n\n  /usr/lib/python3*/** mr,\n  /usr/lib/python3/dist-packages/** mr,') }),
    tunables: dir(Object.fromEntries(Object.entries(TUNABLES).map(([k, v]) => [k, file(v)]))),
    local: dir({ README: file(t('zine-library-local-readme')), 'php-fpm': file(localPhpFpm(t, n)) }),
    disable: dir({}),
    'force-complain': dir({}),
    'php-fpm': file(PHP_FPM_PROFILE),
    ...profiles,
  });
}

const hostsFile = (t: Translate) => {
  const host = machineName(t, 'stapler');
  return `127.0.0.1\tlocalhost\n127.0.1.1\t${host}.internal ${host}\n${ADDRESS}\t${SITE}\n\n::1\tlocalhost ip6-localhost ip6-loopback`;
};

const NGINX_SITE = `server {
    listen 80;
    listen [::]:80;
    server_name ${SITE};
    root /var/www/zinecat;
    index index.php;
    client_max_body_size 64m;

    location /scans/ {
        alias ${SCANS}/;
    }

    location ~ \\.php$ {
        include snippets/fastcgi-php.conf;
        fastcgi_pass unix:/run/php/php8.4-fpm.sock;
    }
}`;

const configPhp = (t: Translate, scans: string) => `<?php
${t('zine-library-config-comment')}
return [
    'title' => 'The Zine Library',
    'scans_dir' => '${scans}',
    'max_upload' => '64M',
];`;

const INDEX_PHP = `<?php
$config = require __DIR__ . '/config.php';
$dir = $config['scans_dir'];
?>
<!doctype html>
<title><?= htmlspecialchars($config['title']) ?></title>
<h1><?= htmlspecialchars($config['title']) ?></h1>
<ul>
<?php
$files = scandir($dir);
if ($files === false) {
    http_response_code(500);
    exit('Could not read the scans.');
}
foreach ($files as $f) {
    if ($f[0] === '.') continue;
    echo '<li><a href="/scans/' . rawurlencode($f) . '">' . htmlspecialchars($f) . "</a></li>\\n";
}
?>
</ul>`;

const UPLOAD_PHP = `<?php
// Volunteers only (the router lets 198.51.100.0/24 in).
$config = require __DIR__ . '/config.php';
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    readfile(__DIR__ . '/upload.html');
    exit;
}
$name = basename($_FILES['scan']['name']);
if (!preg_match('/^[a-z0-9-]+\\.pdf$/', $name)) {
    http_response_code(400);
    exit('A PDF, please: lowercase letters, digits and dashes.');
}
$target = $config['scans_dir'] . '/' . $name;

// move_uploaded_file() writes the scan where config.php says.
if (!move_uploaded_file($_FILES['scan']['tmp_name'], $target)) {
    http_response_code(500);
    exit('Upload failed.');
}
header('Location: /');`;

const WWW_CONF = `; Debian's pool, its comments trimmed.
[www]
user = www-data
group = www-data
listen = /run/php/php8.4-fpm.sock
listen.owner = www-data
listen.group = www-data
pm = dynamic
pm.max_children = 5
pm.start_servers = 2
pm.min_spare_servers = 1
pm.max_spare_servers = 3`;

const backupScript = (t: Translate) => `#!/bin/sh
${t('zine-library-script-comment')}
set -e

. ${CONF}

STAMP=$(date +%Y%m%d-%H%M)
tar -czf "$DEST/zine-$STAMP.tar.gz" $SOURCES
echo "zine-backup: $DEST/zine-$STAMP.tar.gz written"`;

const backupConf = (t: Translate) => `${t('zine-library-conf-comment')}
SOURCES="${SCANS} /var/lib/zinecat"
DEST=/srv/backup`;

const SHADOW = `root:$y$j9T$Lm0qVb7mVQxD3a9mGm3pE/$Zr8.fake.hash.for.the.game.only.0000000000:20120:0:99999:7:::
daemon:*:20120:0:99999:7:::
www-data:*:20120:0:99999:7:::
you:$y$j9T$5HnTq2fK0aWc1Lr8YpZs0/$Bq1.fake.hash.for.the.game.only.1111111111:20120:0:99999:7:::
nomvula:$y$j9T$e3Wd8sR1nCq0b9LtYvX2u.$Kp4.fake.hash.for.the.game.only.2222222222:20145:0:99999:7:::
rahim:$y$j9T$hT6pQ0vZ9mB2r7NsLcWq1/$Dj7.fake.hash.for.the.game.only.3333333333:20151:0:99999:7:::
hinewai:$y$j9T$uR2kL7cX4pF8w1QeGbZm0.$Tn2.fake.hash.for.the.game.only.4444444444:20152:0:99999:7:::`;

export const zineAccounts = (): Accounts => ({
  users: {
    root: { uid: 0, group: 'root', home: '/root' },
    'www-data': { uid: 33, group: 'www-data', home: '/var/www', shell: '/usr/sbin/nologin' },
    you: { uid: 1000, group: 'you' },
    nomvula: { uid: 1001, group: 'nomvula' },
    rahim: { uid: 1002, group: 'rahim' },
    hinewai: { uid: 1003, group: 'hinewai' },
  },
  groups: {
    root: { gid: 0, members: [] },
    adm: { gid: 4, members: ['you'] },
    shadow: { gid: 42, members: [] },
    sudo: { gid: 27, members: ['you', 'rahim'] },
    'www-data': { gid: 33, members: [] },
    you: { gid: 1000, members: [] },
    nomvula: { gid: 1001, members: [] },
    rahim: { gid: 1002, members: [] },
    hinewai: { gid: 1003, members: [] },
  },
});

const pdf = (name: string, k: number): File => ({ type: 'file', content: `%PDF-1.7\n% ${name}`, size: 2_400_000 + k * 731_113, ...www, mode: 'rw-r--r--' });

export function zineWorld(t: Translate, n: ChapterNo, home: Record<string, Node>): Directory {
  const host = machineName(t, 'stapler');
  const key = generateKey('zine-stapler', `you@${host}`);
  const scans = Object.fromEntries(OLD_ZINES.map((z, k) => [z, pdf(z, k)]));
  // Chapter 2: the scans uploaded since the fair are there too.
  if (n === 2) for (const [k, z] of NEW_SCANS.slice(0, 5).entries()) scans[z] = pdf(z, k + 6);
  return dir({
    etc: dir({
      ...accountsFiles(),
      shadow: file(SHADOW, { owner: 'root', group: 'shadow', mode: 'rw-r-----' }),
      hostname: file(host),
      hosts: file(hostsFile(t)),
      'apparmor.d': apparmorTree(t, n),
      apparmor: dir({ 'logprof.conf': file('[settings]\n  profiledir = /etc/apparmor.d /etc/subdomain.d\n  inactive_profiledir = /usr/share/apparmor/extra-profiles\n  logfiles = /var/log/audit/audit.log /var/log/syslog /var/log/messages\n\n  parser = /sbin/apparmor_parser /sbin/subdomain_parser\n  ldd = /usr/bin/ldd\n  logger = /bin/logger /usr/bin/logger\n\n  default_owner_prompt = 1') }),
      nginx: dir({
        'sites-available': dir({ zinecat: file(NGINX_SITE) }),
        'sites-enabled': dir({ zinecat: { type: 'file', content: '', link: '/etc/nginx/sites-available/zinecat', owner: 'root' } }),
      }),
      php: dir({ '8.4': dir({ fpm: dir({ 'php-fpm.conf': file('[global]\npid = /run/php/php8.4-fpm.pid\nerror_log = /var/log/php8.4-fpm.log\ninclude=/etc/php/8.4/fpm/pool.d/*.conf'), 'pool.d': dir({ 'www.conf': file(WWW_CONF) }) }) }) }),
      ...(n === 2
        ? {
            'zine-backup.conf': file(backupConf(t), { owner: 'root', group: 'root', mode: 'rw-r--r--' }),
            systemd: dir({ system: dir({ 'zine-backup.service': file(`[Unit]\nDescription=Nightly backup of the zine catalogue\n\n[Service]\nType=oneshot\nExecStart=${SCRIPT}`) }) }),
            'cron.d': dir({ 'zine-backup': file(`${t('zine-library-cron-comment')}\n30 2 * * * root ${SCRIPT}`) }),
            audit: dir({ 'auditd.conf': file('log_file = /var/log/audit/audit.log\nlog_format = RAW\nmax_log_file = 8\nnum_logs = 5') }, { owner: 'root', mode: 'rwxr-x---' }),
          }
        : {}),
    }),
    usr: dir({
      sbin: dir({ 'php-fpm8.4': { type: 'file', content: '', size: 5_177_896, owner: 'root', mode: 'rwxr-xr-x' } }),
      local: dir({ sbin: dir(n === 2 ? { 'zine-backup': file(backupScript(t), { owner: 'root', mode: 'rwxr-xr-x' }) } : {}) }),
    }),
    srv: dir({
      scans: dir(scans, { ...www, mode: 'rwxr-xr-x' }),
      ...(n === 2 ? { backup: dir({}, { owner: 'root', mode: 'rwx------' }) } : {}),
    }),
    var: dir({
      www: dir({
        zinecat: dir(
          {
            'index.php': file(INDEX_PHP, www),
            'upload.php': file(UPLOAD_PHP, www),
            'upload.html': file('<!doctype html>\n<form method="post" enctype="multipart/form-data">\n  <input type="file" name="scan" accept="application/pdf">\n  <button>Upload</button>\n</form>', www),
            'config.php': file(configPhp(t, SCANS), www),
          },
          www,
        ),
      }),
      lib: dir({ ...(n === 2 ? { zinecat: dir({ 'catalogue.sqlite': { type: 'file', content: 'SQLite format 3', size: 3_211_264, ...www, mode: 'rw-r-----' } }, { ...www, mode: 'rwxr-x---' }) } : {}) }),
      log: dir({
        nginx: dir({ 'access.log': file('', { owner: 'www-data', group: 'adm', mode: 'rw-r-----' }), 'error.log': file('', { owner: 'www-data', group: 'adm', mode: 'rw-r-----' }) }),
        ...(n === 2 ? { audit: dir({ 'audit.log': file('', { owner: 'root', mode: 'rw-------' }) }, { owner: 'root', mode: 'rwx------' }) } : {}),
      }),
    }),
    home: dir({
      you: d({
        ...home,
        '.ssh': d({ id_ed25519: f(key.isPrivate, { lines: true, mode: 'rw-------' }), 'id_ed25519.pub': f(key.isPublic, { lines: true }) }, undefined, { mode: 'rwx------' }),
      }),
    }),
    root: dir({ '.ssh': dir({ id_ed25519: file('-----BEGIN OPENSSH PRIVATE KEY-----\n(root\'s key to the offsite backup host)\n-----END OPENSSH PRIVATE KEY-----', { owner: 'root', mode: 'rw-------' }) }, { owner: 'root', mode: 'rwx------' }) }, { owner: 'root', mode: 'rwx------' }),
    tmp: dir({}, { owner: 'root', mode: 'rwxrwxrwt' }),
  });
}

// ——— Services ———

const proc = (pid: number, user: string, command: string) => ({ pid, user, cpu: 0, mem: 0.6, command });
const FPM_PIDS = [812, 813, 814];

/** php-fpm (re)started: its processes are executed again, and take the profile that attaches to them now. */
function execFpm(j: Game) {
  execTask(j, 812, FPM, 'php-fpm8.4');
  execTask(j, 813, FPM, 'php-fpm8.4');
  execTask(j, 814, FPM, 'php-fpm8.4');
}

function services(n: ChapterNo): Record<string, DefinitionService> {
  return {
    apparmor: {
      description: 'Load AppArmor profiles',
      active: true,
      executable: 'apparmor.systemd',
      oneshot: true,
      activeRest: true,
      // At boot the kernel has no policy yet; apparmor.service loads every profile.
      check: (j) => {
        apparmor(j).profiles = {};
        return null;
      },
      load: (j) => {
        const errors = loadAll(j as Shell);
        const sd = systemd(j);
        if (sd) for (const e of errors) writeLog(sd, 'apparmor.service', 'apparmor.systemd', 0, e, 3, false);
      },
    },
    ...(n === 2 ? { auditd: { description: 'Security Audit Logging Service', active: true, executable: 'auditd', process: [proc(455, 'root', '/sbin/auditd')] } } : {}),
    ssh: { description: 'OpenBSD Secure Shell server', active: true, executable: 'sshd', process: [proc(610, 'root', 'sshd: /usr/sbin/sshd -D [listener] 0 of 10-100 startups')] },
    cron: { description: 'Regular background program processing daemon', active: true, executable: 'cron', process: [proc(598, 'root', '/usr/sbin/cron -f')] },
    nginx: { description: 'A high performance web server and a reverse proxy server', active: true, executable: 'nginx', process: [proc(701, 'root', 'nginx: master process /usr/sbin/nginx -g daemon on; master_process on;'), proc(702, 'www-data', 'nginx: worker process')] },
    'php8.4-fpm': {
      description: 'The PHP 8.4 FastCGI Process Manager',
      active: true,
      executable: 'php-fpm8.4',
      process: [proc(812, 'root', 'php-fpm: master process (/etc/php/8.4/fpm/php-fpm.conf)'), proc(813, 'www-data', 'php-fpm: pool www'), proc(814, 'www-data', 'php-fpm: pool www')],
      load: (j) => execFpm(j),
      stop: (j) => FPM_PIDS.forEach((p) => endTask(j, p)),
    },
    ...(n === 2
      ? {
          'zine-backup': {
            description: 'Nightly backup of the zine catalogue',
            active: false,
            state: 'inactive' as const,
            executable: 'zine-backup',
            oneshot: true,
            unitFile: '/etc/systemd/system/zine-backup.service',
            execute: (j: Game) => {
              const r = runBackup(j as Shell);
              const sd = systemd(j)!;
              for (const l of [...r.err, ...r.out]) writeLog(sd, 'zine-backup.service', 'zine-backup', r.pid, l, r.code ? 3 : 6, false);
              return r.code;
            },
          },
        }
      : {}),
  };
}

export function zineState(t: Translate, n: ChapterNo) {
  return {
    systemd: newSystemd(machineName(t, 'stapler'), BOOT[n], NOW[n], services(n)),
    ufw: {
      enabled: true,
      incoming: 'deny',
      outgoing: 'allow',
      rules: [
        { action: 'allow', to: '22/tcp', ports: [22], forEachOf: null },
        { action: 'allow', to: '80/tcp', ports: [80], forEachOf: null },
      ],
    },
    listening: [
      { proto: 'tcp', address: '0.0.0.0', port: 22, process: 'sshd', pid: 610 },
      { proto: 'tcp', address: '0.0.0.0', port: 80, process: 'nginx', pid: 701 },
    ],
    apt: { installed: { apparmor: '4.1.0-1', 'apparmor-utils': '4.1.0-1', 'apparmor-profiles': '4.1.0-1', nginx: '1.26.3-3+deb13u1', 'php8.4-fpm': '8.4.11-1', ...(n === 2 ? { auditd: '1:4.0.2-2+b2' } : {}) } },
    mounts: [
      { path: '/', capacity: 30 * 1024 ** 3, name: '/dev/vda1', system: 'ext4' },
      { path: '/srv', capacity: 500 * 1024 ** 3, name: '/dev/vdb1', system: 'ext4' },
    ],
    storyCurl,
  };
}

// ——— Logs ———

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const p2 = (x: number) => String(x).padStart(2, '0');
const accessDate = (ms: number) => {
  const d = new Date(ms);
  return `${p2(d.getUTCDate())}/${MONTHS[d.getUTCMonth()]}/${d.getUTCFullYear()}:${p2(d.getUTCHours())}:${p2(d.getUTCMinutes())}:${p2(d.getUTCSeconds())} +0000`;
};
const errorDate = (ms: number) => new Date(ms).toISOString().slice(0, 19).replace(/-/g, '/').replace('T', ' ');

function append(game: Shell, path: string, line: string) {
  const n = game.find(path);
  if (n?.type !== 'file') return;
  const before = content(n, game);
  n.content = before ? `${before}\n${line}` : line;
  n.lines = true;
  delete n.size;
}

const scansDir = (game: Shell) => /'scans_dir'\s*=>\s*'([^']+)'/.exec(game.read('/var/www/zinecat/config.php') ?? '')?.[1]?.replace(/\/+$/, '') ?? SCANS;
const clock = (game: Shell) => systemd(game)!.clock;
const uidOf = (game: Shell, owner: string | undefined) => game.accounts.users[owner ?? 'root']?.uid ?? 0;

/** A request to the catalogue: nginx's logs, php-fpm's work under its profile. */
function request(game: Shell, kind: 'visit' | 'upload', from: string, name = ''): { ok: boolean; status: number; body: string } {
  const st = story(game);
  const pid = st.ticks % 2 ? 813 : 814;
  const at = clock(game);
  const where = scansDir(game);
  const fail = (warning: string) => {
    const request = kind === 'visit' ? 'GET / HTTP/1.1' : 'POST /upload.php HTTP/1.1';
    append(
      game,
      '/var/log/nginx/error.log',
      `${errorDate(at)} [error] 702#702: *${++st.connection} FastCGI sent in stderr: "${warning}" while reading response header from upstream, client: ${from}, server: ${SITE}, request: "${request}", upstream: "fastcgi://unix:/run/php/php8.4-fpm.sock:", host: "${SITE}"`,
    );
    return { ok: false, status: 500, body: kind === 'visit' ? 'Could not read the scans.' : 'Upload failed.' };
  };
  const inIndex = 'in /var/www/zinecat/index.php on line 11';
  const inUpload = 'in /var/www/zinecat/upload.php on line 15';
  const result = (() => {
    const d = game.find(where);
    if (d?.type !== 'directory')
      return fail(
        kind === 'visit'
          ? `PHP message: PHP Warning:  scandir(${where}): Failed to open directory: No such file or directory ${inIndex}; PHP message: PHP Warning:  scandir(): (errno 2): No such file or directory ${inIndex}`
          : `PHP message: PHP Warning:  move_uploaded_file(${where}/${name}): Failed to open stream: No such file or directory ${inUpload}`,
      );
    if (kind === 'visit') {
      const dac = game.can(d, 'r', 'www-data');
      const aa = check(game, { pid, operation: 'open', path: `${where}/`, mask: 'r', fsuid: WWW, ouid: uidOf(game, d.owner) });
      if (!dac || !aa) return fail(`PHP message: PHP Warning:  scandir(${where}): Failed to open directory: Permission denied ${inIndex}; PHP message: PHP Warning:  scandir(): (errno 13): Permission denied ${inIndex}`);
      const list = Object.keys(d.children).filter((x) => !x.startsWith('.')).sort();
      const body = `<!doctype html>\n<title>The Zine Library</title>\n<h1>The Zine Library</h1>\n<ul>\n${list.map((x) => `<li><a href="/scans/${x}">${x}</a></li>`).join('\n')}\n</ul>`;
      return { ok: true, status: 200, body };
    }
    const target = `${where}/${name}`;
    const dac = game.can(d, 'w', 'www-data') && game.can(d, 'x', 'www-data');
    const aa = check(game, { pid, operation: 'mknod', path: target, mask: 'c', fsuid: WWW, ouid: WWW });
    if (!dac || !aa)
      return fail(`PHP message: PHP Warning:  move_uploaded_file(${target}): Failed to open stream: Permission denied ${inUpload}; PHP message: PHP Warning:  move_uploaded_file(): Unable to move "/tmp/php${(at / 1000).toString(36).slice(-6)}" to "${target}" ${inUpload}`);
    d.children[name] = { type: 'file', content: `%PDF-1.7\n% ${name}`, size: 1_800_000 + (name.length % 7) * 412_337, ...www, mode: 'rw-r--r--', mtime: at };
    return { ok: true, status: 302, body: '' };
  })();
  append(game, '/var/log/nginx/access.log', `${from} - - [${accessDate(at)}] "${kind === 'visit' ? 'GET / HTTP/1.1' : 'POST /upload.php HTTP/1.1'}" ${result.status} ${result.body.length} "${kind === 'visit' ? '-' : `http://${SITE}/upload.php`}" "${UA}"`);
  if (kind === 'visit') st.visits.push({ at, ok: result.ok });
  else st.uploads.push({ at, name, ok: result.ok });
  return result;
}

/** curl towards the catalogue (stapler, zines.example, localhost): the page, or an upload with -F. */
export function storyCurl(from: Shell, args: string[]): string | null {
  const url = args.find((a) => /^(https?:\/\/)?(localhost|127\.0\.0\.1|zines\.example|192\.0\.2\.190|stapler)(:80)?(\/|$)/.test(a));
  if (!url || from.principal !== from) return null;
  const head = args.includes('-I') || args.includes('--head');
  const include = args.includes('-i') || args.includes('--include');
  const form = args.indexOf('-F') >= 0 ? args[args.indexOf('-F') + 1] : null;
  const path = /^(?:https?:\/\/)?[^/]+(\/[^\s?]*)?/.exec(url)?.[1] ?? '/';
  let status = 200;
  let body = '';
  if (path === '/' || path === '/index.php') {
    const r = request(from, 'visit', '127.0.0.1');
    status = r.status;
    body = r.body;
  } else if (path === '/upload.php' && form) {
    const name = /@([^;]+)/.exec(form)?.[1]?.split('/').pop() ?? 'scan.pdf';
    const r = request(from, 'upload', '127.0.0.1', name);
    status = r.status;
    body = r.body;
  } else if (path.startsWith('/scans/')) {
    const n = from.find(`${scansDir(from)}/${decodeURIComponent(path.slice(7))}`);
    status = n ? 200 : 404;
    body = n ? '' : '<html>\r\n<head><title>404 Not Found</title></head>\r\n<body>\r\n<center><h1>404 Not Found</h1></center>\r\n<hr><center>nginx/1.26.3</center>\r\n</body>\r\n</html>';
  } else {
    status = 404;
    body = '<html>\r\n<head><title>404 Not Found</title></head>\r\n<body>\r\n<center><h1>404 Not Found</h1></center>\r\n<hr><center>nginx/1.26.3</center>\r\n</body>\r\n</html>';
  }
  const reason: Record<number, string> = { 200: 'OK', 302: 'Found', 404: 'Not Found', 500: 'Internal Server Error' };
  const headers = `HTTP/1.1 ${status} ${reason[status]}\r\nServer: nginx/1.26.3\r\nContent-Type: text/html; charset=UTF-8\r\n${status === 302 ? 'Location: /\r\n' : ''}`;
  if (head) return headers;
  return include ? `${headers}\r\n${body}` : body;
}

// ——— The backup script, run by the story (as the kernel would confine it) ———

/** The confinement a program executed from a profile gets (ix: the same; ux: none; px: its own profile). */
function childLabel(game: Shell, p: Loaded | null, exe: string): string | null {
  if (!p) return null;
  const rule = p.files.filter((r) => !r.deny && r.exec && r.re.test(exe)).at(-1);
  if (!rule) return p.name;
  if (/^[uU]x$/.test(rule.exec!)) return null;
  if (/^[pP]/.test(rule.exec!)) return attachFor(game, exe)?.name ?? p.name;
  return p.name;
}

/** The files under a source, as tar walks it (the directory first). */
function walk(game: Shell, path: string): { path: string; node: Node }[] {
  const n = game.find(path);
  if (!n) return [];
  if (n.type === 'file') return [{ path, node: n }];
  return [{ path, node: n }, ...Object.keys(n.children).sort().flatMap((c) => walk(game, `${path}/${c}`))];
}

/** zine-backup run by root (by hand, by sudo, or by its service): what the kernel lets it do. */
export function runBackup(game: Shell): { code: number; out: string[]; err: string[]; pid: number } {
  const st = story(game);
  const pid = game.nextPid();
  const at = clock(game);
  const task = execTask(game, pid, SCRIPT, 'zine-backup');
  const loaded = task.label ? apparmor(game).profiles[task.label] : null;
  const run: Run = { at, code: 0, label: task.label, mode: loaded?.mode ?? null, denied: [], archived: [], shadowTried: false };
  const out: string[] = [];
  const err: string[] = [];
  const finish = (code: number) => {
    run.code = code;
    st.runs.push(run);
    endTask(game, pid);
    return { code, out, err, pid };
  };
  const ok = (x: Parameters<typeof check>[1], what: string) => {
    const r = check(game, x);
    if (!r) run.denied.push(what);
    return r;
  };
  if (!ok({ pid, operation: 'exec', path: '/usr/bin/dash', mask: 'x', fsuid: 0, ouid: 0 }, '/usr/bin/dash')) {
    err.push(`-bash: ${SCRIPT}: /bin/sh: bad interpreter: Permission denied`);
    return finish(126);
  }
  if (!ok({ pid, operation: 'open', path: SCRIPT, mask: 'r', fsuid: 0, ouid: 0 }, SCRIPT)) {
    err.push(`/bin/sh: 0: cannot open ${SCRIPT}: Permission denied`);
    return finish(2);
  }
  const conf = game.find(CONF);
  if (!conf || conf.type !== 'file') {
    err.push(`${SCRIPT}: 5: .: cannot open ${CONF}: No such file`);
    return finish(2);
  }
  if (!ok({ pid, operation: 'open', path: CONF, mask: 'r', fsuid: 0, ouid: uidOf(game, conf.owner) }, CONF)) {
    err.push(`${SCRIPT}: 5: .: cannot open ${CONF}: Permission denied`);
    return finish(2);
  }
  const text = content(conf, game);
  const value = (k: string) => {
    const m = new RegExp(`^\\s*${k}=("([^"]*)"|'([^']*)'|(\\S*))`, 'm').exec(text);
    return m ? (m[2] ?? m[3] ?? m[4] ?? '') : '';
  };
  const sources = value('SOURCES').split(/\s+/).filter(Boolean);
  const dest = value('DEST') || '/srv/backup';
  if (!ok({ pid, operation: 'exec', path: '/usr/bin/date', mask: 'x', fsuid: 0, ouid: 0 }, '/usr/bin/date')) {
    err.push(`${SCRIPT}: 7: date: Permission denied`);
    return finish(126);
  }
  const d = new Date(at);
  const stamp = `${d.getUTCFullYear()}${p2(d.getUTCMonth() + 1)}${p2(d.getUTCDate())}-${p2(d.getUTCHours())}${p2(d.getUTCMinutes())}`;
  const archive = `${dest}/zine-${stamp}.tar.gz`;
  if (!ok({ pid, operation: 'exec', path: '/usr/bin/tar', mask: 'x', fsuid: 0, ouid: 0 }, '/usr/bin/tar')) {
    err.push(`${SCRIPT}: 8: tar: Permission denied`);
    return finish(126);
  }
  // tar runs in its own process, under what the profile's exec rule gives it.
  const tarPid = game.nextPid();
  apparmor(game).tasks[tarPid] = { exe: '/usr/bin/tar', comm: 'tar', label: childLabel(game, loaded, '/usr/bin/tar') };
  const tar = (x: Omit<Parameters<typeof check>[1], 'pid' | 'comm'>, what: string) => ok({ ...x, pid: tarPid, comm: 'tar' }, what);
  const done = (code: number) => {
    endTask(game, tarPid);
    return finish(code);
  };
  // The user and group names of the members (nameservice): numbers when it can't read them.
  for (const f of ['/etc/nsswitch.conf', '/etc/passwd', '/etc/group']) tar({ operation: 'open', path: f, mask: 'r', fsuid: 0, ouid: 0 }, f);
  // tar's child opens the archive, then becomes gzip.
  const destDir = game.find(dest);
  if (destDir?.type !== 'directory') {
    err.push(`tar (child): ${archive}: Cannot open: No such file or directory`, 'tar (child): Error is not recoverable: exiting now', 'tar: Child returned status 2', 'tar: Error is not recoverable: exiting now');
    return done(2);
  }
  if (!tar({ operation: 'mknod', path: archive, mask: 'c', fsuid: 0, ouid: 0 }, archive) || !tar({ operation: 'open', path: archive, mask: 'w', fsuid: 0, ouid: 0 }, archive)) {
    err.push(`tar (child): ${archive}: Cannot open: Permission denied`, 'tar (child): Error is not recoverable: exiting now', 'tar: Child returned status 2', 'tar: Error is not recoverable: exiting now');
    return done(2);
  }
  if (!tar({ operation: 'exec', path: '/usr/bin/gzip', mask: 'x', fsuid: 0, ouid: 0 }, '/usr/bin/gzip')) {
    err.push('tar (child): gzip: Cannot exec: Permission denied', 'tar (child): Error is not recoverable: exiting now', 'tar: Child returned status 2', 'tar: Error is not recoverable: exiting now');
    return done(2);
  }
  let errors = false;
  const files: Record<string, File> = {};
  if (sources.length) err.push("tar: Removing leading `/' from member names");
  for (const src of sources) {
    if (src === '/etc/shadow' || src === '/etc' || src === '/etc/') run.shadowTried = true;
    const entries = walk(game, src.replace(/\/+$/, '') || '/');
    if (!entries.length) {
      err.push(`tar: ${src}: Cannot stat: No such file or directory`);
      errors = true;
      continue;
    }
    let whole = true;
    const skipped: string[] = [];
    for (const { path, node } of entries) {
      if (skipped.some((s) => path.startsWith(`${s}/`))) continue;
      if (path === '/etc/shadow') run.shadowTried = true;
      // Root reads what others may not only through CAP_DAC_READ_SEARCH (the kernel asks AppArmor).
      const others = node.mode ? node.mode[6] === 'r' : true;
      const mine = (node.owner ?? 'root') === 'root';
      if (!others && !mine && !tar({ operation: 'capable', cap: 'dac_read_search', capnum: capNumber('dac_read_search'), fsuid: 0 }, 'capability dac_read_search')) {
        err.push(`tar: ${path}: Cannot open: Permission denied`);
        errors = true;
        whole = false;
        if (node.type === 'directory') skipped.push(path);
        continue;
      }
      const ouid = uidOf(game, node.owner);
      if (!tar({ operation: 'open', path: node.type === 'directory' ? `${path}/` : path, mask: 'r', fsuid: 0, ouid }, path)) {
        err.push(`tar: ${path}: Cannot open: Permission denied`);
        errors = true;
        whole = false;
        if (node.type === 'directory') skipped.push(path);
        continue;
      }
      if (node.type === 'file') files[path.slice(1)] = { ...node };
    }
    if (whole) run.archived.push(src.replace(/\/+$/, ''));
  }
  const size = Object.values(files).reduce((s, x) => s + (x.size ?? 200), 0);
  const parent = destDir as Directory;
  parent.children[archive.split('/').pop()!] = { type: 'file', content: '', size: Math.round(size * 0.93) + 512, owner: 'root', mode: 'rw-r--r--', mtime: at, archive: { files, compressed: true } };
  if (errors) {
    err.push('tar: Exiting with failure status due to previous errors');
    return done(2);
  }
  endTask(game, tarPid);
  out.push(`zine-backup: ${archive} written`);
  return finish(0);
}

/** The script typed by its path or its name (state.programs, see shell.ts). */
function backupProgram(game: Shell, args: string[]): string {
  void args;
  if (game.who !== 'root') {
    // As you: the script runs, but tar may not create the archive in /srv/backup (root's, rwx------).
    const d = new Date(clock(game));
    const archive = `/srv/backup/zine-${d.getUTCFullYear()}${p2(d.getUTCMonth() + 1)}${p2(d.getUTCDate())}-${p2(d.getUTCHours())}${p2(d.getUTCMinutes())}.tar.gz`;
    for (const e of [`tar (child): ${archive}: Cannot open: Permission denied`, 'tar (child): Error is not recoverable: exiting now', 'tar: Child returned status 2', 'tar: Error is not recoverable: exiting now']) game.error(e);
    game.status = 2;
    return '';
  }
  const r = runBackup(game);
  for (const e of r.err) game.error(e);
  if (r.code) game.status = r.code;
  return r.out.join('\n');
}

// ——— The story's start ———

/** The profiles the machine boots with, then each chapter's past. */
export function initialiseZines(j: Game, n: ChapterNo) {
  const p = j as Shell;
  const sd = systemd(p)!;
  p.state.zines = { chapter: n, ticks: 0, uploads: [], visits: [], runs: [], vendor: PHP_FPM_PROFILE, connection: 117 } satisfies Story;
  if (n === 2) p.state.programs = { [SCRIPT]: backupProgram };
  const a = apparmor(p);
  a.auditd = false;
  // The boot: AppArmor's kernel lines, the profiles loaded by apparmor.service, then php-fpm started.
  const now = sd.clock;
  sd.clock = BOOT[n] + 1200;
  kernel(p, 'AppArmor: AppArmor initialized');
  kernel(p, 'AppArmor: AppArmor Filesystem Enabled');
  sd.clock = BOOT[n] + 4300;
  loadAll(p);
  sd.clock = BOOT[n] + 6100;
  execFpm(p);
  if (n === 2) a.auditd = true;
  if (n === 1) {
    // The day: visitors and uploads fine, until the scans moved at 15:12.
    const set = (scans: string) => {
      const c = p.find('/var/www/zinecat/config.php') as File;
      c.content = configPhp(p.t, scans);
    };
    const moved = p.find(SCANS) as Directory;
    const app = p.find('/var/www/zinecat') as Directory;
    // Before 15:12, the scans were in the app's directory.
    app.children.scans = moved;
    delete (p.find('/srv') as Directory).children.scans;
    set(OLD_SCANS);
    for (let t = Date.UTC(2033, 2, 11, 9, 4, 0), k = 0; t < NOW[1]; t += 17 * MINUTE, k++) {
      if (t >= MOVED && !(p.find('/srv') as Directory).children.scans) {
        (p.find('/srv') as Directory).children.scans = app.children.scans;
        delete app.children.scans;
        set(SCANS);
      }
      sd.clock = t;
      request(p, 'visit', VISITORS[k % VISITORS.length]);
    }
    // The volunteers' attempts since 16:30.
    for (const [k, t] of [Date.UTC(2033, 2, 11, 16, 31, 0), Date.UTC(2033, 2, 11, 16, 48, 0), Date.UTC(2033, 2, 11, 17, 22, 0)].entries()) {
      sd.clock = t;
      request(p, 'upload', VOLUNTEERS[k % VOLUNTEERS.length], NEW_SCANS[0]);
    }
    story(p).uploads = [];
    story(p).visits = [];
  }
  if (n === 2) {
    // auditd started at boot; Rahim's test of last week left a few lines.
    sd.clock = BOOT[n] + 9000;
    append(p, AUDIT_LOG, `type=DAEMON_START msg=audit(${Math.floor((BOOT[n] + 9000) / 1000)}.512:6471): op=start ver=4.0.2 format=raw kernel=6.12.48+deb13-amd64 auid=4294967295 pid=455 uid=0 ses=4294967295 res=success`);
    for (let t = BOOT[n] + 3_600_000, k = 0; t < NOW[2]; t += 47 * MINUTE, k++) {
      sd.clock = t;
      request(p, 'visit', VISITORS[k % VISITORS.length]);
    }
    story(p).visits = [];
  }
  sd.clock = now;
}

/** A minute passes: a visitor looks at the catalogue; in chapter 1, a volunteer uploads a scan. */
export function passTime(j: Game): void {
  const p = (j as Shell).principal;
  const st = story(p);
  const sd = systemd(p);
  if (!sd) return;
  st.ticks++;
  sd.clock += MINUTE;
  request(p, 'visit', VISITORS[st.ticks % VISITORS.length]);
  if (st.chapter === 1) {
    const next = NEW_SCANS[st.uploads.filter((u) => u.ok).length % NEW_SCANS.length];
    request(p, 'upload', VOLUNTEERS[st.ticks % VOLUNTEERS.length], next);
  }
}

// ——— What the chapters check ———

export const loaded = (j: Game, name: string): Loaded | undefined => apparmor(j).profiles[name];
export const fpm = (j: Game) => loaded(j, 'php-fpm');
/** php-fpm's workers are confined by the profile loaded now. */
export const workersConfined = (j: Game) => [813, 814].every((pid) => apparmor(j).tasks[pid]?.label === 'php-fpm');
/** The vendor's file as shipped (its flags aside: aa-complain and aa-enforce rewrite them). */
export const vendorIntact = (j: Game) => {
  const text = (j as Shell).read(PHP_FPM);
  if (text === null) return false;
  const norm = (s: string) => withFlags(s, () => ['attach_disconnected']);
  return norm(text) === norm(story(j).vendor);
};
export const disabledLink = (j: Game, name: string) => !!(j as Shell).find(`${DIR}/disable`) && Object.hasOwn(((j as Shell).find(`${DIR}/disable`) as Directory).children ?? {}, name);
export const worldWritable = (j: Game, path: string) => {
  const n = (j as Shell).find(path);
  return !!n && (n.mode ?? (n.type === 'directory' ? 'rwxr-xr-x' : 'rw-r--r--'))[7] === 'w';
};
/** The loaded php-fpm profile lets the app list and write the directory config.php names. */
export const fpmServes = (j: Game, p: Profile | undefined = fpm(j)) => {
  if (!p) return false;
  const where = scansDir(j as Shell);
  return permits(p, `${where}/`, 'r', true) && permits(p, `${where}/new-scan.pdf`, 'w', true);
};
export const fpmReads = (j: Game, p: Profile | undefined = fpm(j)) => !!p && permits(p, `${scansDir(j as Shell)}/`, 'r', true);
/** What php-fpm's profile on disk would give once reloaded. */
export const fpmOnDisk = (j: Game): Profile | undefined => {
  const r = parseFile(PHP_FPM, readerOf(j as Shell));
  return r.profiles.find((x) => x.name === 'php-fpm');
};
export const lastUpload = (j: Game) => story(j).uploads.at(-1);
export const lastVisit = (j: Game) => story(j).visits.at(-1);
export { scansDir };

// Chapter 2.
/** The profile that would confine the script if it ran now. */
export const scriptProfile = (j: Game) => attachFor(j, SCRIPT);
export const scriptFile = (j: Game) => fileFor(j as Shell, SCRIPT);
/** What the profile still lets the script (and its tar) reach that a backup never needs: the first one found. */
export function tooWide(j: Game, p: Loaded | null = scriptProfile(j)): string | null {
  if (!p || p.mode === 'unconfined') return null;
  const g = j as Shell;
  const tarLabel = childLabel(g, p, '/usr/bin/tar');
  if (tarLabel === null) return '/usr/bin/tar ux';
  const tarProfile = apparmor(j).profiles[tarLabel] ?? p;
  const probes: [Profile, string, string, boolean][] = [
    [tarProfile, '/etc/shadow', 'r', true],
    [tarProfile, '/root/.ssh/id_ed25519', 'r', true],
    [tarProfile, '/home/you/.ssh/id_ed25519', 'r', false],
    [tarProfile, '/etc/sudoers', 'r', true],
    [p, '/etc/cron.d/zine', 'w', true],
    [p, '/etc/passwd', 'w', true],
    [tarProfile, '/etc/passwd', 'w', true],
  ];
  return probes.find(([q, path, mask, owner]) => permits(q, path, mask, owner))?.[1] ?? null;
}
/** The script's last run: confined in enforce mode, everything archived. */
export const goodRun = (r: Run | undefined, name: string) => !!r && r.code === 0 && r.label === name && r.mode === 'enforce' && r.archived.includes(SCANS) && r.archived.includes('/var/lib/zinecat');
export { modeOf };
