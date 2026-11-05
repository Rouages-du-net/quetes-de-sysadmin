// What the chapters of "The Huts" share: a federation of mountain huts.
// Each hut has a small machine (198.51.100.11 to .13) that sends its logs
// over UDP to the valley's server, valley (192.0.2.30), where Lou, the
// federation's volunteer, wants to read them all. The valley's rsyslog is
// modelled by ../rsyslog.ts (configuration, inputs, rules, the files it
// writes); the huts' messages are sent one each per command.
// Sources: https://www.rsyslog.com/doc/configuration/modules/imudp.html,
// https://www.rsyslog.com/doc/configuration/templates.html

import { accountsFiles, d, f, name, type Accounts, type Directory, type Rights } from '../world';
import type { Translate } from '../../texts';
import type { Game } from '../shell';
import type { Process } from '../commands/system';
import { newSystemd, systemd, type DefinitionService } from '../systemd';
import { deliver, startRsyslog, type Sender } from '../rsyslog';
import { newFirewall, type Firewall } from '../firewall';

export const HOME = '/home/you';
export const PASSWORD = 'summit-2028';
export const HUTS = ['hut-lake', 'hut-pass', 'hut-ridge'];
export const ADDRESSES = ['198.51.100.11', '198.51.100.12', '198.51.100.13'];

export const accounts = (): Accounts => ({
  users: {
    root: { uid: 0, group: 'root', home: '/root' },
    syslog: { uid: 104, group: 'syslog', home: '/home/syslog', shell: '/usr/sbin/nologin' },
    you: { uid: 1000, group: 'you' },
    lou: { uid: 1001, group: 'lou' },
  },
  groups: {
    root: { gid: 0, members: [] },
    adm: { gid: 4, members: ['you', 'lou', 'syslog'] },
    sudo: { gid: 27, members: ['you', 'lou'] },
    syslog: { gid: 104, members: [] },
    'systemd-journal': { gid: 101, members: [] },
    you: { gid: 1000, members: [] },
    lou: { gid: 1001, members: [] },
  },
});

export const proc = (pid: number, user: string, command: string): Process => ({ pid, user, cpu: 0, mem: 0.1, command });
export const sd = (j: Game) => systemd(j)!;
export const seen = (j: Game, text: string) => j.last.output.includes(text) || j.last.errors.some((e) => e.includes(text));
export const running = (j: Game, n: string) => sd(j).services[n]?.state === 'active';

/** What each hut sends, in turn: its sensors, cron, ssh (sometimes a failed login). */
export function senders(t: Translate): Sender[] {
  return HUTS.map((hut, i) => ({
    host: name(t, hut),
    address: ADDRESSES[i],
    proto: 'udp',
    port: 514,
    messages: [
      { program: 'hutmon', pid: 640 + i, facility: 'local0', severity: 'info', text: `fridge ${(3.6 + i * 0.3).toFixed(1)}C, battery ${(12.2 + i * 0.1).toFixed(1)}V, solar ${48 - i * 7}W` },
      { program: 'CRON', pid: 2210 + i, facility: 'cron', severity: 'info', text: '(root) CMD (/usr/local/bin/hut-backup)' },
      { program: 'sshd', pid: 3100 + i, facility: 'auth', severity: 'info', text: `Failed password for invalid user admin from 203.0.113.${57 + i} port ${40112 + i * 7} ssh2` },
      { program: 'hutmon', pid: 640 + i, facility: 'local0', severity: 'warning', text: `water tank ${70 - i * 20}%` },
      { program: 'sshd', pid: 3180 + i, facility: 'auth', severity: 'info', text: `Accepted publickey for warden from 198.51.100.${200 + i} port 51022 ssh2: ED25519 SHA256:q3Hk2v` },
    ],
  }));
}

/** Debian's /etc/rsyslog.conf (rsyslog 8.2302), as the package installs it. */
export const RSYSLOG_CONF = `# /etc/rsyslog.conf configuration file for rsyslog
#
# For more information install rsyslog-doc and see
# /usr/share/doc/rsyslog-doc/html/configuration/index.html


#################
#### MODULES ####
#################

module(load="imuxsock") # provides support for local system logging
module(load="imklog")   # provides kernel logging support
#module(load="immark")  # provides --MARK-- message capability

# provides UDP syslog reception
#module(load="imudp")
#input(type="imudp" port="514")

# provides TCP syslog reception
#module(load="imtcp")
#input(type="imtcp" port="514")


###########################
#### GLOBAL DIRECTIVES ####
###########################

#
# Set the default permissions for all log files.
#
$FileOwner root
$FileGroup adm
$FileCreateMode 0640
$DirCreateMode 0755
$Umask 0022

#
# Where to place spool and state files
#
$WorkDirectory /var/spool/rsyslog

#
# Include all config files in /etc/rsyslog.d/
#
$IncludeConfig /etc/rsyslog.d/*.conf


###############
#### RULES ####
###############

#
# Log anything besides private authentication messages to a single log file
#
*.*;auth,authpriv.none		-/var/log/syslog

#
# Log commonly used facilities to their own log file
#
auth,authpriv.*			/var/log/auth.log
cron.*				-/var/log/cron.log
kern.*				-/var/log/kern.log
mail.*				-/var/log/mail.log
user.*				-/var/log/user.log

#
# Emergencies are sent to everybody logged in.
#
*.emerg				:omusrmsg:*`;

/** The UDP input enabled: rsyslog.conf after chapter 1. */
export const RSYSLOG_CONF_UDP = RSYSLOG_CONF.replace('#module(load="imudp")\n#input(type="imudp" port="514")', 'module(load="imudp")\ninput(type="imudp" port="514")');

/** Chapter 1's solution: one file per hut, and the huts' messages kept out of the valley's own files. */
export const REMOTE_CONF = `# The huts' logs: one file per hut, and nothing else.
template(name="PerHut" type="string" string="/var/log/remote/%HOSTNAME%.log")

if $fromhost-ip startswith '198.51.100.' then {
  action(type="omfile" dynaFile="PerHut")
  stop
}`;

export interface Options {
  boot: number;
  now: number;
  firewall: Firewall;
  more?: Record<string, DefinitionService>;
}

export function hutsState(t: Translate, o: Options) {
  const services: Record<string, DefinitionService> = {
    ssh: { description: 'OpenBSD Secure Shell server', active: true, executable: 'sshd', process: [proc(612, 'root', 'sshd: /usr/sbin/sshd -D [listener] 0 of 10-100 startups')] },
    rsyslog: { description: 'System Logging Service', active: true, executable: 'rsyslogd', modelled: true, process: [proc(611, 'root', '/usr/sbin/rsyslogd -n -iNONE')] },
    'systemd-journald': { description: 'Journal Service', active: true, executable: 'systemd-journald', modelled: true, process: [proc(301, 'root', '/lib/systemd/systemd-journald')] },
    ufw: { description: 'Uncomplicated firewall', active: true, executable: 'ufw', activeRest: true },
    ...(o.more ?? {}),
  };
  const s = newSystemd('valley', o.boot, o.now, services);
  return {
    systemd: s,
    process: [proc(1, 'root', '/sbin/init'), ...Object.values(services).flatMap((x) => x.process ?? [])],
    ufw: o.firewall,
    listening: [{ proto: 'tcp', address: '0.0.0.0', port: 22, process: 'sshd', pid: 612 }],
    rsyslog: { config: null, senders: senders(t), received: {}, lost: {} },
  };
}

/** The per-hut files as chapter 1 left them: each hut's messages, one a minute, for the last hour before `now`. */
export function remoteHistory(t: Translate, now: number): Record<string, string> {
  const out: Record<string, string> = {};
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const two = (n: number) => String(n).padStart(2, '0');
  for (const s of senders(t)) {
    const lines: string[] = [];
    for (let k = 0; k < 60; k++) {
      const d = new Date(now - (60 - k) * 60_000 + 8_000);
      const m = s.messages[k % s.messages.length];
      lines.push(`${months[d.getUTCMonth()]} ${String(d.getUTCDate()).padStart(2, ' ')} ${two(d.getUTCHours())}:${two(d.getUTCMinutes())}:${two(d.getUTCSeconds())} ${s.host} ${m.program}[${m.pid}]: ${m.text}`);
    }
    out[`${s.host}.log`] = lines.join('\n') + '\n';
  }
  return out;
}

/** The firewall Lou left: SSH only. */
export const sshOnly = (): Firewall => ({ ...newFirewall(), enabled: true, rules: [{ action: 'allow', to: '22/tcp', ports: [22], forEachOf: null }] });

/** At the start: rsyslog reads its configuration (and again each time it starts). */
export function prepareRsyslog(j: Game) {
  sd(j).services.rsyslog.load = startRsyslog;
  startRsyslog(j);
}

/** Each command, a minute: each hut sends a message. */
export function passTime(j: Game) {
  sd(j).clock += 60_000;
  deliver(j);
}

/** The valley's machine: rsyslog's configuration, the logs, the welcome message. */
export function hutsWorld(t: Translate, o: { welcome: Record<string, string>; conf: string; dropIns?: Record<string, string>; logs?: Record<string, string>; remote?: Record<string, string>; var?: Record<string, Directory> }): Directory {
  const root: Rights = { owner: 'root' };
  const directory = (children: Parameters<typeof d>[0], rights: Rights = root) => d(children, undefined, rights);
  const file = (text: string, rights: Rights = root) => f(text, { lines: true, ...rights });
  const log = (text: string) => file(text, { owner: 'root', group: 'adm', mode: 'rw-r-----' });
  return directory({
    etc: directory({
      ...accountsFiles(),
      hostname: file('valley'),
      'rsyslog.conf': file(o.conf),
      'rsyslog.d': directory(Object.fromEntries(Object.entries(o.dropIns ?? {}).map(([n, x]) => [n, file(x)]))),
      systemd: directory({ 'journald.conf': file('#  This file is part of systemd.\n#\n# See journald.conf(5) for details.\n\n[Journal]\n#Storage=auto\n#Compress=yes\n#SystemMaxUse=\n#SystemKeepFree=\n#SystemMaxFileSize=\n#MaxRetentionSec=0\n#ForwardToSyslog=yes') }),
    }),
    var: directory({
      log: directory({
        syslog: log(''),
        'auth.log': log(''),
        'cron.log': log(''),
        ...Object.fromEntries(Object.entries(o.logs ?? {}).map(([n, x]) => [n, log(x)])),
        ...(o.remote ? { remote: directory(Object.fromEntries(Object.entries(o.remote).map(([n, x]) => [n, log(x)])), { owner: 'root', group: 'adm', mode: 'rwxr-xr-x' }) } : {}),
      }, { owner: 'root', group: 'syslog', mode: 'rwxrwxr-x' }),
      ...(o.var ?? {}),
    }),
    home: directory({
      you: d(Object.fromEntries(Object.entries(o.welcome).map(([n, x]) => [n, f(x)]))),
      lou: directory({}, { owner: 'lou', mode: 'rwx------' }),
    }),
    root: directory({}, { owner: 'root', mode: 'rwx------' }),
    tmp: directory({}, { owner: 'root', mode: 'rwxrwxrwt' }),
  });
}
