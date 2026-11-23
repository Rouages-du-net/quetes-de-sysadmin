// Story "The Climbing Wall": what its chapters share. Overhang, a community
// climbing hall run by its members (le Dévers in French), keeps its
// bookings, memberships and the door's badges on belay (relais in French),
// a small server in the office rack behind an APC Back-UPS. Nkechi chairs
// the association, Haruto set up the UPS's software in 2028 before moving
// away, Ikaika is the volunteer electrician, Akosua looks after the photo
// archive and the signed waivers on the NAS, Thandiwe runs the front desk.
// Machines: belay, 192.0.2.141 on the uplink (RFC 5737) and 198.51.100.141
// on the office network 198.51.100.0/24; harness, the NAS, 198.51.100.142 (an internal host from chapter 2); the front desk PC
// 198.51.100.150; the internet is 203.0.113.0/24.
// Chapter 1: upsmon watched a UPS that no longer existed (the power cut of
// 16 November ended in a crash), and the server's power restore policy;
// chapter 2: the NAS as a secondary, upsd on the network, shutting down in
// order; chapter 3: a worn battery, its test, upssched's timers, a new
// battery's date.
// Each command lets fifteen seconds pass (nut.ts's world, second by second);
// upsmon -c fsd plays the whole drill until the machines are back.
// Sources: https://networkupstools.org/docs/man/upsmon.html,
// https://networkupstools.org/docs/man/upsmon.conf.html,
// https://networkupstools.org/docs/man/upsd.conf.html,
// https://networkupstools.org/docs/man/upssched.html,
// https://networkupstools.org/docs/user-manual.chunked/Advanced_usage_scheduling_notes.html,
// https://networkupstools.org/docs/man/usbhid-ups.html.

import { accountsFiles, d, f, type Accounts, type Directory, type File, type InternalHost, type Node, type Rights } from '../world';
import type { Game, Shell } from '../shell';
import type { Translate } from '../../texts';
import { newSystemd, systemd, type DefinitionService } from '../systemd';
import { generateKey } from '../access';
import { machineName } from '../machines';
import { mails } from '../commands/monitoring';
import {
  NUT_UNITS, attachNut, boot, busy, exposed, nut, power, pressButton, readMonConf, readSched, readUpsConf, readUsers, second, shellOf, takeWall, trialNotify, trialTimers, ETC, PORT,
  type NutState, type PowerWorld, type Powered,
} from '../nut';
import { verdict, type Firewall } from '../firewall';

export const HOME = '/home/you';
export const PASSWORD = 'quickdraw-42';
export type ChapterNo = 1 | 2 | 3;
export const BELAY = { uplink: '192.0.2.141', office: '198.51.100.141' };
export const HARNESS = '198.51.100.142';
export const DESK_PC = '198.51.100.150';
export const OUTSIDE = '203.0.113.88';
export const SITE = 'www.overhang.example';
export const UPSMON_PASSWORD = 'Rope-Bag-2028';
export const ADMIN_PASSWORD = 'Crimp-Admin-2031';
const MINUTE = 60_000;

// Thursday 18 November 2032, 21:40 (the hall closed at 21:30); Friday 26
// November, 21:45; Monday 17 January 2033, 10:20 (the hall opens at 10:00).
export const NOW: Record<ChapterNo, number> = { 1: Date.UTC(2032, 10, 18, 21, 40, 0), 2: Date.UTC(2032, 10, 26, 21, 45, 0), 3: Date.UTC(2033, 0, 17, 10, 20, 0) };
// The power cut of Tuesday 16 November: the mains went at 19:42:10, belay died at 20:31:37, the mains came back at 21:04:50.
export const CUT = { from: Date.UTC(2032, 10, 16, 19, 42, 10), crash: Date.UTC(2032, 10, 16, 20, 31, 37), back: Date.UTC(2032, 10, 16, 21, 4, 50) };

// ——— Story state (on belay) ———

export interface Drill {
  at: number;
  // Where it was started, and whether belay's upsmon was watching the real UPS then.
  from: string;
  watching: boolean;
  // Per machine: halted cleanly, crashed (running or halting), came back by itself, needed the button.
  hosts: Record<string, { halted: boolean; crashed: boolean; alone: boolean; button: boolean }>;
  // The secondaries' upsmon logged in again afterwards.
  secondaryBack: boolean;
}

export interface Story {
  chapter: ChapterNo;
  ticks: number;
  drills: Drill[];
  // Chapter 3: when Ikaika swapped the battery, the mails at the start.
  swappedAt?: number;
  mailsAtStart: number;
}
export const story = (j: Game): Story => (j as Shell).principal.state.climbing as Story;
const principal = (j: Game) => (j as Shell).principal;
export const machine = (j: Game, name: string): Shell | null => (name === 'belay' ? principal(j) : principal(j).internal(name));
export const active = (j: Game): Shell => (principal(j).state.lastShell as Shell | undefined) ?? principal(j);
export const typed = (j: Game) => active(j).last.line ?? '';
/** The last command's output contains this (on any machine of the story); reading the manual doesn't count. */
export const seen = (j: Game, text: string | RegExp) => {
  if (/^\s*(man|apropos|whatis|help)\b|--help\b/.test(typed(j))) return false;
  const last = active(j).last;
  const all = `${last.output}\n${last.errors.join('\n')}`;
  return typeof text === 'string' ? all.includes(text) : text.test(all);
};

// ——— Files ———

const root: Rights = { owner: 'root' };
const nutFile: Rights = { owner: 'root', group: 'nut', mode: 'rw-r-----' };
const dir = (children: Record<string, Node>, rights: Rights = root) => d(children, undefined, rights);
const file = (text: string, rights: Rights = root): File => f(text, { lines: true, ...rights });
const script = (text: string): File => f(text, { lines: true, owner: 'root', mode: 'rwxr-xr-x' });

export const NUT_CONF = (mode: string) => `# Network UPS Tools: example nut.conf
#
# This file tries to standardize the various files being found in the field,
# like /etc/default/nut on Debian based systems, /etc/sysconfig/ups on RedHat
# based systems, ... Distribution's init script should source this file to
# see which component(s) has to be started.
#
# IMPORTANT NOTE:
#  This file is intended to be sourced by standard POSIX shell scripts
#  (and by some tools that look like shell scripts), so there must be
#  no spaces around the equal sign!
#
# Possible values for MODE: none, standalone, netserver, netclient.
#  - none: NUT is not configured, or use the Integrated Power Management, or
#    use some external system to startup NUT components.
#  - standalone: a local only configuration, with 1 UPS protecting the
#    local system. This implies to start the 3 NUT layers (driver, upsd and
#    upsmon) and the matching configuration files.
#  - netserver: same as for the standalone configuration, but also need some
#    more network access controls (LISTEN in upsd.conf).
#  - netclient: this mode only requires upsmon.

MODE=${mode}`;

export const upsConfText = (extra = '') => `# Network UPS Tools: ups.conf (Haruto, 2028; the sample's comments are in
# /usr/share/doc/nut/examples/ups.conf.gz and in man 5 ups.conf)
#
# One section per UPS: [name], then its driver and where it is plugged.
# The section's name is the UPS's name for upsd, upsc and upsmon.
# 2030: the old Eaton was replaced by the APC; its section renamed hallups.

maxretry = 3

[hallups]
	driver = usbhid-ups
	port = auto
	desc = "APC Back-UPS RS 1500 - office rack"${extra}`;

const UPSD_CONF = (listen: string) => `# Network UPS Tools: upsd.conf
#
# LISTEN <address> [<port>]
# Where upsd listens for its clients. Without any LISTEN line, upsd listens
# on 127.0.0.1 (and ::1) only. This parameter is only read at startup:
# restart (rather than reload) upsd to apply any change.
#
# LISTEN 127.0.0.1 3493
# LISTEN ::1 3493
${listen}
# MAXAGE 15`;

const USERS = (extra = '') => `# Network UPS Tools: upsd.users
#
# Who may talk to upsd, and what they may do:
#   [username]
#       password = ...
#       actions = SET FSD          (change variables, set the forced shutdown)
#       instcmds = ALL             (instant commands: test.battery.start.quick...)
#       upsmon primary|secondary   (for upsmon: what it may do on the UPS)
# Before NUT 2.8.0, primary was called master and secondary slave.

[upsmon]
	password = ${UPSMON_PASSWORD}
	upsmon master${extra}`;

export const UPSMON_HEAD = `# Network UPS Tools: upsmon.conf (Haruto, 2028: the sample's comments are in
# /usr/share/doc/nut/examples/upsmon.conf.gz and in man 5 upsmon.conf)
#
# MONITOR <system> <powervalue> <username> <password> ("primary"|"secondary")
#   <system>: <upsname>[@<hostname>[:<port>]], the UPS as upsd names it.

RUN_AS_USER nut
`;

export const UPSMON_REST = `MINSUPPLIES 1
SHUTDOWNCMD "/sbin/shutdown -h +0"
POLLFREQ 5
POLLFREQALERT 5
HOSTSYNC 15
DEADTIME 15
POWERDOWNFLAG /etc/killpower
RBWARNTIME 43200
NOCOMMWARNTIME 300
FINALDELAY 5`;

const upsmonBelay = (n: ChapterNo) =>
  n === 1
    ? `${UPSMON_HEAD}MONITOR eaton@localhost 1 upsmon ${UPSMON_PASSWORD} master

${UPSMON_REST}
# Too many "Poll UPS failed" lines in the journal (Haruto, 2030):
POLLFAIL_LOG_THROTTLE_MAX 100`
    : n === 2
      ? `${UPSMON_HEAD}MONITOR hallups@localhost 1 upsmon ${UPSMON_PASSWORD} primary

${UPSMON_REST}`
      : `${UPSMON_HEAD}MONITOR hallups@localhost 1 upsmon ${UPSMON_PASSWORD} primary

${UPSMON_REST}

# Mail the volunteers about the UPS (Haruto, 2028).
NOTIFYCMD /usr/local/bin/ups-mail
NOTIFYFLAG ONBATT SYSLOG+WALL+EXEC
NOTIFYFLAG ONLINE SYSLOG+WALL+EXEC
NOTIFYFLAG LOWBATT SYSLOG+WALL+EXEC
NOTIFYFLAG REPLBATT SYSLOG+WALL+EXEC`;

export const UPSMON_HARNESS = (monitor: string) => `# Network UPS Tools: upsmon.conf (Debian's, its comments trimmed: see
# /usr/share/doc/nut/examples/upsmon.conf.gz and man 5 upsmon.conf)
#
# MONITOR <system> <powervalue> <username> <password> ("primary"|"secondary")
#
# <system> is a UPS, as <upsname>[@<hostname>[:<port>]]: the UPS's name in
# ups.conf on the machine that runs its driver and upsd.
#
# Examples:
#  MONITOR myups@bigserver 1 upswired mypassword primary
#  MONITOR su700@server.example.com 1 monuser secretpass secondary
${monitor}
RUN_AS_USER nut
MINSUPPLIES 1
SHUTDOWNCMD "/sbin/shutdown -h +0"
POLLFREQ 5
POLLFREQALERT 5
HOSTSYNC 15
DEADTIME 15
POWERDOWNFLAG /etc/killpower
FINALDELAY 5`;

// Debian's upssched.conf and its sample upssched-cmd.
const UPSSCHED_CONF = `# Network UPS Tools - upssched.conf sample file
#
# ============================================================================
#
# CMDSCRIPT <scriptname>
#
# This script gets called to invoke commands for timers that trigger.
# It is given a single argument - the <timername> in your
# AT ... START-TIMER defines.
#
# *** This must be defined *before* your first AT line. ***

CMDSCRIPT /usr/bin/upssched-cmd

# ============================================================================
#
# PIPEFN <filename>
#
# This sets the file name of the FIFO that will pass communications between
# processes to start and stop timers.  This should be set to some path where
# normal users can't create the file, due to the possibility of symlinking
# and other evil.
#
# Note: if you are running Solaris or similar, the permissions that
# upssched sets on this file *are not enough* to keep you safe.  If
# your OS ignores the permissions on a FIFO, then you MUST put this in
# a protected directory!
#
# Note 2: by default, upsmon will run upssched as whatever user you have
# defined with RUN_AS_USER in upsmon.conf.  Make sure that user can
# create files and write to files in the path you use for PIPEFN and
# LOCKFN.
#
# My recommendation: create a special directory for upssched, make it
# owned by your upsmon user, then use it for both.
#
# This is commented out by default to make you visit this file and think
# about how your system works before potentially opening a hole.
#
# PIPEFN /run/nut/upssched/upssched.pipe

# ============================================================================
#
# LOCKFN <filename>
#
# REQUIRED.  This was added after version 1.2.1.
#
# upssched needs to be able to create this filename in order to avoid
# a race condition when two events are dispatched from upsmon at nearly
# the same time.  This file will only exist briefly.  It must not be
# created by any other process.
#
# You should put this in the same directory as PIPEFN.
#
# LOCKFN /run/nut/upssched/upssched.lock

# ============================================================================
#
# AT <notifytype> <upsname> <command>
#
# Define a handler for a specific event on UPS <upsname>.
#
# <upsname> can be the special value * to apply this handler to every
# possible value of <upsname>.
#
# Run the command via your CMDSCRIPT when it happens.
#
# Note that any AT that matches both the <notifytype> and the <upsname>
# for the current event will be used.

# ============================================================================
#
# Possible AT commands
#
# - START-TIMER <timername> <interval>
#
#   Start a timer of <interval> seconds.  When it triggers, it will pass
#   the argument <timername> to your CMDSCRIPT.
#
#   Example:
#
#   Start a timer that'll execute when any UPS (*) has been gone 10 seconds
#
#   AT COMMBAD * START-TIMER upsgone 10
#
#   -----------------------------------------------------------------------
#
# - CANCEL-TIMER <timername> [cmd]
#
#   Cancel a running timer called <timername>, if possible. If the timer
#   has passed then pass the optional argument <cmd> to CMDSCRIPT.
#
#   Example:
#
#   If a specific UPS (myups@localhost) comes back online, then stop the
#   timer before it triggers
#
#   AT COMMOK myups@localhost CANCEL-TIMER upsgone
#
#   -----------------------------------------------------------------------
#
# - EXECUTE <command>
#
#   Immediately pass <command> as an argument to CMDSCRIPT.
#
#   Example:
#
#   If any UPS (*) reverts to utility power, then execute
#   'ups-back-on-line' via CMDSCRIPT.
#
#   AT ONLINE * EXECUTE ups-back-on-line`;

const UPSSCHED_CMD = `#! /bin/sh
#
# This script should be called by upssched via the CMDSCRIPT directive.
#
# Here is a quick example to show how to handle a bunch of possible
# timer names with the help of the case structure.
#
# This script may be replaced with another program without harm.
#
# The first argument passed to your CMDSCRIPT is the name of the timer
# from your AT lines.

case $1 in
	upsgone)
		logger -t upssched-cmd "The UPS has been gone for awhile"
		;;
	*)
		logger -t upssched-cmd "Unrecognized command: $1"
		;;
esac`;

const UPS_MAIL = `#!/bin/sh
# NOTIFYCMD for upsmon (Haruto, 2028): every UPS event, mailed to the
# volunteers. upsmon gives the message as $1, NOTIFYTYPE and UPSNAME in
# the environment.
echo "$1" | mail -s "UPS: $NOTIFYTYPE" volunteers`;

const UPS_ALERT = `#!/bin/sh
# For upssched's CMDSCRIPT (Haruto, 2028, never wired in): called with the
# name of the timer (or of the EXECUTE command) that fired.
case "$1" in
	onbatt)
		echo "The hall's UPS has been on battery for a while: the mains is out. Check the office rack." | mail -s "UPS: on battery" volunteers
		;;
	online)
		echo "Mains power is back in the hall." | mail -s "UPS: mains back" volunteers
		;;
	replbatt)
		echo "The hall's UPS says its battery needs replacing." | mail -s "UPS: replace the battery" volunteers
		;;
	*)
		logger -t ups-alert "Unrecognized command: $1"
		;;
esac`;

const hostsFile = (own: string, ownAddress: string, t: Translate) =>
  `127.0.0.1\tlocalhost\n${ownAddress}\t${own}.internal ${own}\n${BELAY.office}\tbelay.internal belay ${machineName(t, 'belay')}.internal ${machineName(t, 'belay')}\n${HARNESS}\tharness.internal harness\n\n::1\tlocalhost ip6-localhost ip6-loopback`;

const climbAccounts = (extra: Accounts['users'] = {}): Accounts => ({
  users: {
    root: { uid: 0, group: 'root', home: '/root' },
    nut: { uid: 108, group: 'nut', home: '/var/lib/nut', shell: '/usr/sbin/nologin' },
    you: { uid: 1000, group: 'you' },
    ...extra,
  },
  groups: { root: { gid: 0, members: [] }, adm: { gid: 4, members: ['you'] }, sudo: { gid: 27, members: ['you'] }, mail: { gid: 8, members: [] }, nut: { gid: 114, members: [] }, you: { gid: 1000, members: [] } },
});
export const belayAccounts = () => climbAccounts({ thandiwe: { uid: 1001, group: 'you' }, nkechi: { uid: 1002, group: 'you' } });

const proc = (pid: number, user: string, command: string) => ({ pid, user, cpu: 0, mem: 0.4, command });
const lan = (addresses: Record<string, string>) => ({
  interfaces: {
    lo: { name: 'lo', up: true, addresses: ['127.0.0.1/8'], mac: '00:00:00:00:00:00', addresses6: ['::1/128'] },
    ...Object.fromEntries(Object.entries(addresses).map(([n, a], k) => [n, { name: n, up: true, addresses: [`${a}/24`], mac: `52:54:00:6b:0${k}:${a.split('.')[3].slice(-2).padStart(2, '0')}` }])),
  },
  gateway: null,
  trunk: '',
  vlans: [],
  devices: [],
  order: ['lo', ...Object.keys(addresses)],
});

const nutServices = (server: boolean, monitor = server): Record<string, DefinitionService> => ({
  ...(server
    ? {
        'nut-driver@hallups': { ...NUT_UNITS.driver('hallups'), active: true, state: 'inactive' },
        'nut-server': { ...NUT_UNITS.server(), active: true, state: 'inactive' },
      }
    : {}),
  'nut-monitor': { ...NUT_UNITS.monitor(), active: monitor, state: 'inactive' },
});

const ufw = (n: ChapterNo): Firewall => ({
  enabled: true,
  incoming: 'deny',
  outgoing: 'allow',
  rules: [
    { action: 'allow', to: '22/tcp', ports: [22], forEachOf: null },
    { action: 'allow', to: '443/tcp', ports: [443], forEachOf: null },
    ...(n === 3 ? [{ action: 'allow' as const, to: '3493/tcp', ports: [PORT], forEachOf: HARNESS }] : []),
  ],
});

export function belayState(t: Translate, n: ChapterNo) {
  return {
    systemd: newSystemd(machineName(t, 'belay'), Date.UTC(2032, 9, 4, 7, 2, 0), NOW[n], {
      ssh: { description: 'OpenBSD Secure Shell server', active: true, executable: 'sshd', process: [proc(611, 'root', 'sshd: /usr/sbin/sshd -D [listener] 0 of 10-100 startups')] },
      cron: { description: 'Regular background program processing daemon', active: true, executable: 'cron', process: [proc(598, 'root', '/usr/sbin/cron -f')] },
      ufw: { description: 'Uncomplicated firewall', active: true, executable: 'ufw' },
      ...nutServices(true),
    }),
    ufw: ufw(n),
    baseLan: lan({ eth0: BELAY.uplink, eth1: BELAY.office }),
    listening: [{ proto: 'tcp', address: '0.0.0.0', port: 22, process: 'sshd', pid: 611 }, { proto: 'tcp', address: '0.0.0.0', port: 443, process: 'nginx', pid: 702 }],
    apt: { installed: { 'nut-server': '2.8.1-5+deb13u1', 'nut-client': '2.8.1-5+deb13u1', ipmitool: '1.8.19-9' } },
    mounts: [{ path: '/', capacity: 240 * 1024 ** 3, name: '/dev/vda1', system: 'ext4' }],
  };
}

export function belayWorld(t: Translate, n: ChapterNo, home: Record<string, Node>): Directory {
  const host = machineName(t, 'belay');
  const key = generateKey('climbing-belay', `you@${host}`);
  const users =
    n === 3
      ? USERS(`

[admin]
	password = ${ADMIN_PASSWORD}
	actions = SET`)
      : USERS();
  const thandiweMail: Record<string, Node> = n === 3 ? { thandiwe: file(flappingMailbox(), { owner: 'thandiwe', group: 'mail', mode: 'rw-rw----' }) } : {};
  return dir({
    etc: dir({
      ...accountsFiles(),
      hostname: file(host),
      hosts: file(hostsFile(host, BELAY.office, t)),
      aliases: file('# See man 5 aliases for format\npostmaster: root\nvolunteers: thandiwe'),
      nut: dir(
        {
          'nut.conf': file(NUT_CONF(n === 1 ? 'standalone' : n === 2 ? 'standalone' : 'netserver'), nutFile),
          'ups.conf': file(upsConfText(n === 3 ? '\n\toffdelay = 180\n\tondelay = 240' : ''), nutFile),
          'upsd.conf': file(UPSD_CONF(n === 3 ? `LISTEN 127.0.0.1 3493\nLISTEN ${BELAY.office} 3493` : ''), nutFile),
          'upsd.users': file(n === 3 ? users.replace('upsmon master', 'upsmon primary') + `\n\n[harness]\n\tpassword = Harness-Mon-2032\n\tupsmon secondary` : users, nutFile),
          'upsmon.conf': file(upsmonBelay(n), nutFile),
          'upssched.conf': file(UPSSCHED_CONF, nutFile),
        },
        { owner: 'root', group: 'nut', mode: 'rwxr-x---' },
      ),
    }),
    usr: dir({
      bin: dir({ 'upssched-cmd': script(UPSSCHED_CMD) }),
      local: dir({ bin: dir(n === 3 ? { 'ups-mail': script(UPS_MAIL), 'ups-alert': script(UPS_ALERT) } : {}) }),
    }),
    home: dir({
      you: d({
        ...home,
        '.ssh': d({ id_ed25519: f(key.isPrivate, { lines: true, mode: 'rw-------' }), 'id_ed25519.pub': f(key.isPublic, { lines: true }) }, undefined, { mode: 'rwx------' }),
      }),
    }),
    root: dir({}, { owner: 'root', mode: 'rwx------' }),
    run: dir({ nut: dir({ upssched: dir({}, { owner: 'nut', group: 'nut', mode: 'rwxr-x---' }) }, { owner: 'root', group: 'nut', mode: 'rwxrwx---' }) }),
    tmp: dir({}, { owner: 'root', mode: 'rwxrwxrwt' }),
    var: dir({ mail: dir({ ...thandiweMail }, { owner: 'root', group: 'mail', mode: 'rwxrwsr-x' }), lib: dir({ nut: dir({}, { owner: 'nut', group: 'nut', mode: 'rwxr-x---' }) }) }),
  });
}

/** Chapter 3: last weekend's mails, one for each blip of the hall's mains (ONBATT, then ONLINE). */
function flappingMailbox(): string {
  const out: string[] = [];
  const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const stamp = (ms: number) => {
    const x = new Date(ms);
    return `${DAYS[x.getUTCDay()]} ${MONTHS[x.getUTCMonth()]} ${String(x.getUTCDate()).padStart(2)} ${x.toISOString().slice(11, 19)} ${x.getUTCFullYear()}`;
  };
  let at = Date.UTC(2033, 0, 15, 10, 4, 12);
  for (let k = 0; k < 19; k++) {
    for (const [type, text] of [['ONBATT', 'UPS hallups@localhost on battery'], ['ONLINE', 'UPS hallups@localhost on line power']]) {
      out.push(`From nut@belay ${stamp(at)}`, 'To: volunteers', `Subject: UPS: ${type}`, 'From: nut <nut@belay>', '', text, '');
      at += 7_000;
    }
    at += (17 + ((k * 7) % 23)) * MINUTE;
  }
  return out.join('\n');
}

// ——— harness, the NAS (chapters 2 and 3) ———

const HARNESS_COMMANDS = ['ls', 'cd', 'pwd', 'cat', 'less', 'head', 'tail', 'grep', 'nano', 'sudo', 'echo', 'exit', 'man', 'ssh', 'ps', 'systemctl', 'journalctl', 'ss', 'ip', 'ping', 'upsc', 'upsmon', 'ipmitool', 'logger', 'mail', 'date'];

export function harnessHost(n: ChapterNo): InternalHost {
  return {
    address: HARNESS,
    domain: 'harness.internal',
    accounts: () => climbAccounts({ akosua: { uid: 1001, group: 'you' } }),
    commands: HARNESS_COMMANDS,
    state: (t) => ({
      systemd: newSystemd('harness', Date.UTC(2032, 9, 4, 7, 3, 0), NOW[n], {
        ssh: { description: 'OpenBSD Secure Shell server', active: true, executable: 'sshd', process: [proc(588, 'root', 'sshd: /usr/sbin/sshd -D')] },
        smbd: { description: 'Samba SMB Daemon', active: true, executable: 'smbd', process: [proc(744, 'root', '/usr/sbin/smbd --foreground --no-process-group')] },
        ...nutServices(false, n === 3),
      }),
      baseLan: lan({ eth0: HARNESS }),
      listening: [{ proto: 'tcp', address: '0.0.0.0', port: 22, process: 'sshd', pid: 588 }, { proto: 'tcp', address: '0.0.0.0', port: 445, process: 'smbd', pid: 744 }],
      apt: { installed: { 'nut-client': '2.8.1-5+deb13u1', samba: '2:4.22.3+dfsg-4', ipmitool: '1.8.19-9' } },
      language: t.language,
    }),
    createWorld: (t) => {
      const key = generateKey('climbing-belay', `you@${machineName(t, 'belay')}`);
      const monitor = n === 3 ? `MONITOR hallups@belay 1 harness Harness-Mon-2032 secondary\n` : '';
      return dir({
        etc: dir({
          ...accountsFiles(),
          hostname: file('harness'),
          hosts: file(hostsFile('harness', HARNESS, t)),
          nut: dir({ 'nut.conf': file(NUT_CONF(n === 3 ? 'netclient' : 'none'), nutFile), 'upsmon.conf': file(UPSMON_HARNESS(monitor), nutFile), 'upssched.conf': file(UPSSCHED_CONF, nutFile) }, { owner: 'root', group: 'nut', mode: 'rwxr-x---' }),
        }),
        srv: dir({ archive: dir({ 'README.txt': file(t('climbing-wall-archive-readme'), { owner: 'akosua', group: 'you' }), waivers: dir({}, { owner: 'akosua', group: 'you' }), photos: dir({}, { owner: 'akosua', group: 'you' }) }, { owner: 'akosua', group: 'you', mode: 'rwxr-x---' }) }),
        home: dir({ you: d({ '.ssh': d({ authorized_keys: f(key.isPublic, { lines: true, mode: 'rw-------' }) }, undefined, { mode: 'rwx------' }) }) }),
        root: dir({}, { owner: 'root', mode: 'rwx------' }),
        run: dir({ nut: dir({}, { owner: 'root', group: 'nut', mode: 'rwxrwx---' }) }),
        tmp: dir({}, { owner: 'root', mode: 'rwxrwxrwt' }),
      });
    },
    initialise: (s) => {
      attachNut(s);
    },
    beforeCommand: (s) => {
      principal(s).state.lastShell = s;
    },
    afterCommand: (s) => passTime(s),
  };
}

// ——— Starting a chapter ———

const powered = (load: number, policy: Powered['policy'], haltSeconds: number, bootSeconds: number): Powered => ({
  fed: true,
  load,
  state: 'on',
  until: 0,
  haltSeconds,
  bootSeconds,
  policy,
  wasOn: true,
  lastEvent: 'command',
  sel: [],
});

function newWorld(p: Shell, n: ChapterNo): PowerWorld {
  const w: PowerWorld = {
    clock: NOW[n],
    mains: true,
    voltage: 231,
    ups: {
      output: true,
      charge: 100,
      health: n === 3 ? 0.2 : 0.62,
      capacity: 980,
      realpower: 900,
      chargeLow: 10,
      runtimeLow: 120,
      mfrDate: '2028/08/21',
      replace: false,
      test: null,
      testResult: n === 3 ? 'Done and passed' : 'No test initiated',
      tests: [],
      offAt: null,
      onAt: null,
      beeper: 'enabled',
      sensitivity: 'medium',
      transferLow: 176,
      transferHigh: 294,
    },
    hosts: { belay: powered(150, n === 1 ? 'previous' : 'always-on', 30, 60) },
    extra: 65,
    cuts: [],
    history: [],
    shells: { belay: () => p },
  };
  if (n > 1) {
    // Since the cut, the NAS is on the UPS too. It takes long to stop: Samba, then its disks' write cache.
    w.hosts.harness = powered(115, 'always-on', 150, 90);
    w.shells!.harness = () => p.internal('harness');
  }
  return w;
}

/** The story's network for NUT's clients. */
const nutNet = (t: Translate) => ({
  hosts: {
    belay: { addresses: [BELAY.office, BELAY.uplink], names: ['belay', 'belay.internal', machineName(t, 'belay'), `${machineName(t, 'belay')}.internal`] },
    harness: { addresses: [HARNESS], names: ['harness', 'harness.internal'] },
  },
});

/** A line in a machine's journal at a given time (the past). */
function past(s: Shell, time: number, unit: string, ident: string, pid: number, message: string, priority = 6) {
  const sd = systemd(s)!;
  sd.log.push({ time, boot: sd.boot, unit, ident, pid, message, priority });
}

/** Lets the world run for a while from a given time (the machines' past), then comes back to the chapter's time. */
function runFrom(p: Shell, from: number, seconds: number, now: number) {
  const w = power(p);
  w.clock = from;
  for (const name of Object.keys(w.hosts)) {
    const s = shellOf(p, name);
    if (s) systemd(s)!.clock = from;
  }
  for (let k = 0; k < seconds; k++) second(p);
  w.clock = now;
  for (const name of Object.keys(w.hosts)) {
    const s = shellOf(p, name);
    if (s) systemd(s)!.clock = Math.max(systemd(s)!.clock, now);
  }
  w.history = [];
  w.wall = [];
}

/** Boots a machine at a time of its past (its services started then). */
function bootAt(p: Shell, name: string, at: number, crashed = false) {
  const w = power(p);
  const s = shellOf(p, name)!;
  w.clock = at;
  systemd(s)!.clock = at;
  w.hosts[name].lastEvent = crashed ? 'ac-failed' : 'command';
  boot(s);
}

/** Chapter 1's past: two boots of belay where upsmon polled "eaton", the cut, the crash, the return. */
function lastCutPast(p: Shell) {
  const sd = systemd(p)!;
  const w = power(p);
  const h = w.hosts.belay;
  // Sunday 14 November: a kernel update's reboot.
  bootAt(p, 'belay', Date.UTC(2032, 10, 14, 6, 12, 0));
  const pid = nut(p).pids.upsmon + 1;
  const failing = (from: number, to: number) => {
    past(p, from + 6_000, 'nut-monitor.service', 'nut-monitor', pid, "Can't login to UPS [eaton@localhost]: Unknown UPS", 3);
    for (let t = from + 6_000, k = 0; t < to; t += 500_000, k++) {
      if (k === 0) past(p, t, 'nut-monitor.service', 'nut-monitor', pid, 'Poll UPS [eaton@localhost] failure state code changed from 0 to 4; report below will only be repeated to syslog every 100 polling loop cycles:', 3);
      past(p, t, 'nut-monitor.service', 'nut-monitor', pid, 'Poll UPS [eaton@localhost] failed - [eaton] does not exist on server localhost', 3);
    }
  };
  failing(Date.UTC(2032, 10, 14, 6, 12, 10), CUT.crash);
  // The cut: nothing in NUT's logs (upsmon never saw the UPS); the BMC saw the power go.
  h.sel.push({ time: CUT.crash, sensor: 'Power Unit #0x01', event: 'AC lost | Asserted' });
  h.lastEvent = 'ac-failed';
  h.wasOn = true;
  // The journal stops dead at 20:31:37 (no shutdown); the machine comes back at 21:05 (policy "previous").
  past(p, CUT.crash - 2_000, '', 'kernel', 0, 'usb 1-1: USB disconnect, device number 2', 6);
  bootAt(p, 'belay', CUT.back + 12_000, true);
  failing(CUT.back + 22_000, NOW[1]);
  // The UPS's battery is still recharging a little since the cut.
  w.ups.charge = 100;
  nut(p).upsmon!.mons.forEach((m) => {
    m.failState = 4;
    m.loginError = 'Unknown UPS';
    m.failCount = 37;
  });
  sd.clock = NOW[1];
  w.clock = NOW[1];
  w.history = [];
}

export function initialiseStory(j: Game, n: ChapterNo) {
  const p = j as Shell;
  p.state.climbing = { chapter: n, ticks: 0, drills: [], mailsAtStart: 0 } satisfies Story;
  p.state.nutNet = nutNet(p.t);
  p.state.power = newWorld(p, n);
  p.state.reach = (_from: Shell, address: string) => (address === HARNESS && power(p).hosts.harness && power(p).hosts.harness.state !== 'on' ? 'timeout' : null);
  attachNut(p);
  if (n === 1) return lastCutPast(p);
  const harness = p.internal('harness')!;
  // belay since the drill of 18 November; harness since the cut (it was not on the UPS then).
  bootAt(p, 'harness', CUT.from + 210_000, true);
  power(p).hosts.harness.sel.push({ time: CUT.from, sensor: 'Power Unit #0x01', event: 'AC lost | Asserted' });
  bootAt(p, 'belay', Date.UTC(2032, 10, 18, 22, 6, 40));
  void harness;
  if (n === 3) {
    bootAt(p, 'belay', Date.UTC(2033, 0, 9, 7, 30, 0));
    bootAt(p, 'harness', Date.UTC(2033, 0, 9, 7, 30, 30));
  }
  // Let the daemons find each other, then come back to now.
  const last = n === 3 ? Date.UTC(2033, 0, 9, 7, 30, 30) : Date.UTC(2032, 10, 18, 22, 6, 40);
  runFrom(p, last, 200, NOW[n]);
  if (n === 3) {
    story(p).mailsAtStart = mailCount(p);
    // The hall's line flickers when the bouldering room's big fans start: a few seconds on battery, every few minutes.
    scheduleBlips(p);
  }
}

/** Chapter 3: blips of the mains (8 seconds) every few minutes, for the hour to come. */
function scheduleBlips(p: Shell) {
  const w = power(p);
  for (let k = 0; k < 40; k++) {
    const from = NOW[3] + 70_000 + k * (150_000 + ((k * 37) % 5) * 30_000);
    w.cuts.push({ from, to: from + 8_000 });
  }
}

/** The mails in Thandiwe's mailbox (the volunteers' alias). */
export const mailCount = (j: Game) => ((principal(j).read('/var/mail/thandiwe') ?? '').match(/^From /gm) ?? []).length;

// ——— Time passing ———

const STEP = 15;

/** Each command: fifteen seconds; after upsmon -c fsd, the whole drill, until the machines are back. */
export function passTime(j: Game): string {
  const p = principal(j);
  const s = j as Shell;
  p.state.lastShell = j;
  const st = story(p);
  const w = power(p);
  st.ticks++;
  const before = w.history.length;
  const here = Object.keys(w.hosts).find((n) => shellOf(p, n) === s) ?? 'belay';
  const fsd = Object.keys(w.hosts).find((n) => (shellOf(p, n)?.state.nut as NutState | undefined)?.upsmon?.fsdRequested);
  if (fsd) drill(p, fsd);
  else for (let k = 0; k < STEP; k++) second(p);
  const events = w.history.slice(before);
  const wall = takeWall(w, here, systemd(s)!.host, wallDate);
  for (const n of Object.keys(w.hosts)) if (n !== here) takeWall(w, n, '', wallDate);
  // The session drops if this machine went down (even if it is back by now).
  if (events.some((e) => e.host === here && e.what !== 'kill') || w.hosts[here].state !== 'on') s.reboot = true;
  return wall;
}

const wallDate = (ms: number) => {
  const x = new Date(ms);
  const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${DAYS[x.getUTCDay()]} ${MONTHS[x.getUTCMonth()]} ${String(x.getUTCDate()).padStart(2)} ${x.toISOString().slice(11, 19)} ${x.getUTCFullYear()}`;
};

/** Whether belay's upsmon watches the real UPS, as a primary that may set FSD. */
export function watching(j: Game): boolean {
  const mon = nut(principal(j)).upsmon;
  return !!mon?.mons.some((m) => m.upsname === 'hallups' && m.pv >= 1 && m.primary && m.granted && m.loggedIn && m.comm === 1);
}

/** upsmon -c fsd: the drill runs until everything has settled; Ikaika presses the buttons of what stays off. */
function drill(p: Shell, from: string) {
  const w = power(p);
  const st = story(p);
  const start = w.history.length;
  const at = w.clock;
  const wasWatching = watching(p);
  const settle = (max: number) => {
    let quiet = 0;
    for (let k = 0; k < max && quiet < 60; k++) {
      second(p);
      quiet = busy(w, p) ? 0 : quiet + 1;
    }
  };
  settle(3600);
  const off = Object.entries(w.hosts).filter(([, h]) => h.state === 'off').map(([n]) => n);
  if (off.length) {
    for (let k = 0; k < 240; k++) second(p);
    for (const n of off) pressButton(w, n);
    settle(3600);
  }
  const events = w.history.slice(start);
  const hosts: Drill['hosts'] = {};
  for (const name of Object.keys(w.hosts)) {
    const mine = events.filter((e) => e.host === name);
    hosts[name] = {
      halted: mine.some((e) => e.what === 'halted'),
      crashed: mine.some((e) => e.what === 'crash-halting' || e.what === 'crash-running'),
      alone: mine.some((e) => e.what === 'booted') && !mine.some((e) => e.what === 'button'),
      button: mine.some((e) => e.what === 'button'),
    };
  }
  const harness = w.hosts.harness ? shellOf(p, 'harness') : null;
  const secondaryBack = !!(harness?.state.nut as NutState | undefined)?.upsmon?.mons.some((m) => !m.primary && m.loggedIn && m.comm === 1);
  st.drills.push({ at, from, watching: wasWatching, hosts, secondaryBack });
}

/** The last drill started after a given time. */
export const lastDrill = (j: Game, after = 0): Drill | undefined => story(j).drills.filter((d) => d.at >= after).at(-1);

// ——— Checks ———

/** upsmon.conf on belay as the running upsmon loaded it. */
export const belayMon = (j: Game) => nut(principal(j)).upsmon?.conf ?? null;
export const fileMon = (j: Game, host = 'belay') => readMonConf(machine(j, host)?.read(`${ETC}/upsmon.conf`) ?? null);
export const fileUps = (j: Game) => readUpsConf(principal(j).read(`${ETC}/ups.conf`));
export const fileUsers = (j: Game) => readUsers(principal(j).read(`${ETC}/upsd.users`)).users;

/** Could the internet reach belay's upsd? */
export const upsdExposed = (j: Game) => exposed(principal(j), OUTSIDE, BELAY.uplink);
/** Does belay's firewall let harness reach port 3493? */
export const harnessAllowed = (j: Game) => {
  const pf = principal(j).state.ufw as Firewall;
  return !pf.enabled || verdict(pf, PORT, HARNESS) === 'accepted';
};

/** harness's upsmon: logged into belay's hallups as a secondary. */
export function secondaryOk(j: Game): boolean {
  const h = machine(j, 'harness');
  const mon = (h?.state.nut as NutState | undefined)?.upsmon;
  return !!mon?.mons.some((m) => m.upsname === 'hallups' && !m.primary && m.pv >= 1 && m.loggedIn && m.comm === 1);
}

/** Chapter 3: what upssched would mail for a blip of 8 seconds, and for an outage of five minutes (tried, then undone). */
export function alertTrial(j: Game): { blip: number; outage: number } | null {
  const p = principal(j);
  const n = nut(p);
  if (!n.upsmon) return null;
  const w = power(p);
  const sd = systemd(p)!;
  const keep = { clock: w.clock, sd: sd.clock, log: sd.log.length, timers: [...n.timers], mails: mails(p).length, box: p.read('/var/mail/thandiwe'), wall: [...(w.wall ?? [])] };
  const restore = () => {
    w.clock = keep.clock;
    sd.clock = keep.sd;
    sd.log.length = keep.log;
    n.timers = keep.timers;
    mails(p).length = keep.mails;
    const box = p.find('/var/mail/thandiwe');
    if (box?.type === 'file') box.content = keep.box ?? '';
    w.wall = keep.wall;
  };
  const sys = n.upsmon.mons.find((m) => m.upsname === 'hallups')?.sys ?? 'hallups@localhost';
  const wait = (seconds: number) => {
    for (let k = 0; k < seconds; k++) {
      w.clock += 1000;
      trialTimers(p);
    }
  };
  try {
    n.timers = [];
    const base = mailCount(p);
    trialNotify(p, 'ONBATT', sys);
    wait(8);
    trialNotify(p, 'ONLINE', sys);
    wait(600);
    const blip = mailCount(p) - base;
    n.timers = [];
    const base2 = mailCount(p);
    trialNotify(p, 'ONBATT', sys);
    wait(300);
    const outage = mailCount(p) - base2;
    return { blip, outage };
  } finally {
    restore();
  }
}

/** Is upsmon's NOTIFYCMD upssched, with a valid upssched.conf? */
export function schedWired(j: Game): boolean {
  const conf = belayMon(j);
  return !!conf?.notifycmd && /(^|\/)upssched$/.test(conf.notifycmd) && !readSched(principal(j).read(`${ETC}/upssched.conf`)).error;
}

export const ups = (j: Game) => power(j).ups;
export { nut, power, readUsers, PORT };
