// A Debian machine's default state: what every Debian 13 ("trixie") server
// has although a chapter didn't model it. A world without state.mounts,
// processes or memory would give an empty `df -h`, `ps aux` and `mount`, and
// `free` would fail; this fills in what is missing, never what a chapter
// describes (a chapter's mounts, processes, memory or network keep theirs):
//   - the mounts of a small virtual machine (root on /dev/vda1, the EFI
//     partition, the tmpfs of /run, /dev/shm, /run/lock, the session's
//     /run/user/UID, and the pseudo file systems `mount` and `findmnt` list);
//   - the base processes (systemd, journald, udevd, timesyncd, dbus,
//     logind, cron, agetty, sshd's listener and the player's session, its
//     bash), plus the services the chapter's systemd model runs;
//   - memory for free and top (2 GiB, no swap);
//   - a network for ip and hostname -I: lo, and eth0 with the machine's
//     documentation address (machines.ts), its gateway the network's .1
//     (state.baseLan, created on first use: ping and the firewalls keep
//     following state.lan, the routers' model);
//   - /etc/os-release (a link to /usr/lib/os-release, as base-files installs
//     it) and /etc/debian_version, for cat, hostnamectl and the like.
// Debian 13 no longer installs rsyslog (the journal is persistent) nor
// lsb-release by default: `lsb_release` is "command not found", as on a
// fresh server. Sources: https://www.debian.org/releases/trixie/release-notes/,
// https://manpages.debian.org/trixie/systemd/os-release.5.en.html,
// https://manpages.debian.org/trixie/systemd/hostnamectl.1.en.html

import type { Shell } from './shell';
import type { Process } from './commands/system';
import type { Lan } from './lan';
import type { File } from './world';
import { MACHINES, WORKSTATION } from './machines';
import { systemd } from './systemd';

const GiB = 1024 ** 3;
const MiB = 1024 ** 2;

export const OS_RELEASE = `PRETTY_NAME="Debian GNU/Linux 13 (trixie)"
NAME="Debian GNU/Linux"
VERSION_ID="13"
VERSION="13 (trixie)"
VERSION_CODENAME=trixie
DEBIAN_VERSION_FULL=13.2
ID=debian
HOME_URL="https://www.debian.org/"
SUPPORT_URL="https://www.debian.org/support"
BUG_REPORT_URL="https://bugs.debian.org/"`;
export const DEBIAN_VERSION = '13.2';
export const PRETTY_NAME = 'Debian GNU/Linux 13 (trixie)';

/** Is this session's machine a Debian (not FreeBSD, Solaris, IBM i or Windows)? */
// (state.os, like availability.ts's platformOf, which this module can't import: chapters load it.)
export const isDebian = (game: Shell) => (game.state.os ?? 'linux') === 'linux';

// The mounts of a 20 GB virtual machine with 2 GiB of memory. `pseudo`: a
// virtual file system (proc, sysfs…), listed by mount and findmnt, not by df.
export interface BaseMount {
  path: string;
  capacity: number;
  name: string;
  system: string;
  options: string;
  // The system's own files, which the world doesn't describe (bytes).
  bytesBase?: number;
  inodes?: number;
  inodesBase?: number;
  pseudo?: boolean;
  base: true;
}
const baseMounts = (uid: number): BaseMount[] => [
  { path: '/sys', capacity: 0, name: 'sysfs', system: 'sysfs', options: 'nosuid,nodev,noexec,relatime', pseudo: true, base: true },
  { path: '/proc', capacity: 0, name: 'proc', system: 'proc', options: 'nosuid,nodev,noexec,relatime', pseudo: true, base: true },
  { path: '/dev', capacity: 963 * MiB, name: 'udev', system: 'devtmpfs', options: 'nosuid,relatime,size=986112k,nr_inodes=246528,mode=755,inode64', base: true },
  { path: '/dev/pts', capacity: 0, name: 'devpts', system: 'devpts', options: 'nosuid,noexec,relatime,gid=5,mode=620,ptmxmode=000', pseudo: true, base: true },
  { path: '/run', capacity: 197 * MiB, name: 'tmpfs', system: 'tmpfs', options: 'nosuid,nodev,noexec,relatime,size=201628k,mode=755,inode64', bytesBase: 580 * 1024, base: true },
  { path: '/', capacity: 19.5 * GiB, name: '/dev/vda1', system: 'ext4', options: 'relatime,errors=remount-ro', bytesBase: 1.6 * GiB, inodes: 1_277_952, inodesBase: 41_337, base: true },
  { path: '/dev/shm', capacity: 984 * MiB, name: 'tmpfs', system: 'tmpfs', options: 'nosuid,nodev,inode64', base: true },
  { path: '/run/lock', capacity: 5 * MiB, name: 'tmpfs', system: 'tmpfs', options: 'nosuid,nodev,noexec,relatime,size=5120k,inode64', base: true },
  { path: '/sys/fs/cgroup', capacity: 0, name: 'cgroup2', system: 'cgroup2', options: 'nosuid,nodev,noexec,relatime,nsdelegate,memory_recursiveprot', pseudo: true, base: true },
  { path: '/boot/efi', capacity: 124 * MiB, name: '/dev/vda15', system: 'vfat', options: 'relatime,fmask=0022,dmask=0022,codepage=437,iocharset=ascii,shortname=mixed,utf8,errors=remount-ro', bytesBase: 12 * MiB, base: true },
  { path: `/run/user/${uid}`, capacity: 197 * MiB, name: 'tmpfs', system: 'tmpfs', options: `nosuid,nodev,relatime,size=201624k,nr_inodes=50406,mode=700,uid=${uid},gid=${uid},inode64`, base: true },
];

// The base processes (PIDs below the login shell's, see Shell.shellPid).
// `base`: they come back after a reboot.
function baseProcesses(game: Shell): Process[] {
  const you = game.player;
  const bash = game.shellPid;
  const p = (pid: number, user: string, command: string, mem: number, extra: Partial<Process> = {}): Process & { base: true } => ({ pid, user, cpu: 0, mem, command, base: true, ...extra });
  return [
    // PID 1: the kernel ignores the signals it doesn't handle.
    p(1, 'root', '/sbin/init', 0.6, { ignores: ['HUP', 'INT', 'TERM', 'USR1', 'USR2', 'PIPE', 'QUIT'] }),
    p(2, 'root', '[kthreadd]', 0, { ppid: 0 }),
    p(3, 'root', '[pool_workqueue_release]', 0, { ppid: 2 }),
    p(14, 'root', '[ksoftirqd/0]', 0, { ppid: 2 }),
    p(16, 'root', '[rcu_preempt]', 0, { ppid: 2 }),
    p(242, 'root', '/usr/lib/systemd/systemd-journald', 0.9),
    p(281, 'root', '/usr/lib/systemd/systemd-udevd', 0.6),
    p(402, 'systemd-timesync', '/usr/lib/systemd/systemd-timesyncd', 0.3),
    p(489, 'root', '/usr/sbin/cron -f', 0.1),
    p(491, 'messagebus', '/usr/bin/dbus-daemon --system --address=systemd: --nofork --nopidfile --systemd-activation --syslog-only', 0.2),
    p(497, 'root', '/usr/lib/systemd/systemd-logind', 0.4),
    p(530, 'root', '/sbin/agetty -o -- \\u --noreset --noclear - linux', 0.1),
    p(538, 'root', 'sshd: /usr/sbin/sshd -D [listener] 0 of 10-100 startups', 0.4),
    p(bash - 9, 'root', `sshd-session: ${you} [priv]`, 0.5, { ppid: 538 }),
    p(bash - 6, you, '/usr/lib/systemd/systemd --user', 0.5),
    p(bash - 5, you, '(sd-pam)', 0.2, { ppid: bash - 6 }),
    p(bash - 1, you, `sshd-session: ${you}@pts/0`, 0.3, { ppid: bash - 9 }),
    p(bash, you, '-bash', 0.2, { ppid: bash - 1 }),
  ];
}

/** Gives a Debian machine what the chapter didn't model (see the top of this file). */
export function debianDefaults(game: Shell): void {
  if (!isDebian(game)) return;
  const state = game.state;
  const uid = game.accounts.users[game.player]?.uid ?? 1000;
  if (state.mounts === undefined) state.mounts = baseMounts(uid);
  if (state.process === undefined) {
    const listing = baseProcesses(game);
    // The services the chapter's systemd model runs.
    const sd = systemd(game);
    for (const s of Object.values(sd?.services ?? {}))
      if (s.state === 'active') for (const q of s.process) if (!listing.some((x) => x.pid === q.pid)) listing.push({ ...q });
    state.process = listing.sort((a, b) => a.pid - b.pid);
    state.baseProcesses = true;
  }
  if (state.memory === undefined) {
    const rss: Record<number, number> = {};
    for (const q of state.process as Process[]) if (!q.command.startsWith('[')) rss[q.pid] = Math.round((q.mem / 100) * 2 * GiB) || 4 * MiB;
    state.memory = { total: 2 * GiB - 85 * MiB, kernel: 410 * MiB, rss };
  }
  osFiles(game);
}

// /etc/os-release (a link to ../usr/lib/os-release when the world has /usr),
// /etc/debian_version: only in a world that has an /etc.
function osFiles(game: Shell): void {
  const etc = game.find('/etc');
  if (etc?.type !== 'directory') return;
  const file = (content: string): File => ({ type: 'file', content, lines: true, owner: 'root', group: 'root' });
  const lib = game.find('/usr/lib');
  if (!etc.children['os-release']) {
    if (lib?.type === 'directory' && !lib.children['os-release']) {
      lib.children['os-release'] = file(OS_RELEASE);
      etc.children['os-release'] = { ...file(''), link: '../usr/lib/os-release', mode: 'rwxrwxrwx' };
    } else etc.children['os-release'] = file(OS_RELEASE);
  }
  if (!etc.children.debian_version) etc.children.debian_version = file(DEBIAN_VERSION);
}

/** The machine's address on the story's network: machines.ts, or the internal host's. */
export function machineAddress(game: Shell): string {
  const p = game.principal;
  if (game.parent) {
    const h = p.chapter.hosts?.[game.host];
    if (h) return h.address;
  }
  if (game.host === WORKSTATION.name) return WORKSTATION.address;
  return MACHINES.find((m) => m.name === game.host)?.address ?? '192.0.2.100';
}

// A documentation MAC address (52:54:00, QEMU's prefix) from the machine's name.
function macOf(name: string): string {
  let h = 7;
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return `52:54:00:${[16, 8, 0].map((d) => ((h >>> d) & 255).toString(16).padStart(2, '0')).join(':')}`;
}

/** The network ip shows on a machine whose chapter has no state.lan: lo and eth0 (state.baseLan). */
export function baseLan(game: Shell): Lan {
  if (state(game).baseLan) return game.state.baseLan as Lan;
  const address = machineAddress(game);
  const gateway = address.split('.').slice(0, 3).concat('1').join('.');
  const l: Lan = {
    interfaces: {
      lo: { name: 'lo', up: true, addresses: ['127.0.0.1/8'], mac: '00:00:00:00:00:00', addresses6: ['::1/128'] },
      eth0: { name: 'eth0', up: true, addresses: [`${address}/24`], mac: macOf(game.host) },
    },
    gateway: { via: gateway, dev: 'eth0' },
    trunk: '',
    vlans: [],
    devices: [],
    order: ['lo', 'eth0'],
  };
  game.state.baseLan = l;
  return l;
}
const state = (game: Shell) => game.state as { baseLan?: Lan };

/** A 32-hex id (/etc/machine-id, a boot id) from a seed (the machine's name): deterministic. */
export function machineIdOf(seed: string): string {
  let a = 0x811c9dc5;
  let b = 0x01000193;
  let out = '';
  for (let round = 0; round < 4; round++) {
    for (const c of `${seed}:${round}`) {
      a = Math.imul(a ^ c.charCodeAt(0), 16777619) >>> 0;
      b = Math.imul(b + c.charCodeAt(0), 2246822519) >>> 0;
    }
    out += ((a ^ b) >>> 0).toString(16).padStart(8, '0');
  }
  return out;
}
