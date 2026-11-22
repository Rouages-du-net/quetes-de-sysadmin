// Story "The Blood Drive": what its chapters share. The Lindenvale Blood
// Service books donors' appointments online (donate.lindenvale.example).
// Bastien, who built it in 2029, left; Zainab runs the donor service, Teodor
// writes the booking app, Kirsi runs the network.
// Two load balancers share a virtual address with keepalived (VRRP):
// lb1 (the story's main machine, 192.0.2.104) and lb2 (an internal host,
// 192.0.2.105), the virtual address 192.0.2.108 on their eth0 (the service
// network 192.0.2.0/24, RFC 5737, its gateway 192.0.2.254). Each runs
// HAProxy in front of three web servers on the back network
// 198.51.100.0/24 (RFC 5737, eth1): web1, web2, web3 (internal hosts,
// 198.51.100.21-23), where the booking app (gunicorn) answers on 8080.
// Donors (203.0.113.0/24, RFC 5737) book every two seconds; each command
// lets five seconds pass, second by second (keepalived's election,
// HAProxy's checks, the donors' requests).
// Sources: https://www.keepalived.org/manpage.html,
// https://docs.haproxy.org/3.0/configuration.html,
// https://docs.haproxy.org/3.0/management.html.

import { accountsFiles, d, f, type Accounts, type Directory, type File, type InternalHost, type Node, type Rights } from '../world';
import type { Game, Shell } from '../shell';
import type { Translate } from '../../texts';
import { newSystemd, systemd, writeLog, type DefinitionService } from '../systemd';
import { generateKey } from '../access';
import { machineName } from '../machines';
import { attachKeepalived, masters, startKeepalived, tick, vrrp, shellOf, type Run, type Vrrp, type Packet } from '../keepalived';
import { CFG, haproxy, parseCfg, request, runChecks, settle, startHaproxy, startProblem, stopHaproxy, type Answer } from '../haproxy';
import { readConf } from '../nftables';
import type { Process } from '../commands/system';

export const HOME = '/home/you';
export const PASSWORD = 'donor-chair-12';
export const LB1 = '192.0.2.104';
export const LB2 = '192.0.2.105';
export const VIP = '192.0.2.108';
export const GATEWAY = '192.0.2.254';
export const EDGE_A = '192.0.2.252';
export const SITE = 'donate.lindenvale.example';
export const WEB: Record<string, string> = { web1: '198.51.100.21', web2: '198.51.100.22', web3: '198.51.100.23' };
export const BACK = { lb1: '198.51.100.4', lb2: '198.51.100.5' };
export const MAC = { lb1: '52:54:00:6c:01:04', lb2: '52:54:00:6c:01:05', edgeA: '3c:fd:fe:52:0a:01', gateway: '00:00:5e:00:01:33' };
export type ChapterNo = 1 | 2 | 3;

// Monday 13 May 2030, 7:40 (haproxy died on lb1 at 6:58); Wednesday 22 May,
// 10:05; Wednesday 5 June, 9:20 (the network work was on Tuesday night).
export const NOW: Record<ChapterNo, number> = { 1: Date.UTC(2030, 4, 13, 7, 40, 0), 2: Date.UTC(2030, 4, 22, 10, 5, 0), 3: Date.UTC(2030, 5, 5, 9, 20, 0) };
const BOOT: Record<ChapterNo, number> = { 1: Date.UTC(2030, 3, 2, 6, 12, 0), 2: Date.UTC(2030, 4, 13, 9, 1, 0), 3: Date.UTC(2030, 4, 13, 9, 1, 0) };

// ——— Story state ———

export interface Story {
  chapter: ChapterNo;
  // The donors' last requests: an HTTP code, or 'refused', 'timeout', 'reset'.
  outcomes: (number | string)[];
  donors: number;
  // Chapter 1: lb2 held the address and served while haproxy was down on lb1.
  failedOver?: boolean;
  // Chapter 1: the longest time lb1 stayed master with its haproxy down after tracking was loaded.
  stuck?: number;
  stuckMax?: number;
  // Chapter 2: the technician's visit to web2 (waiting, working until `techUntil`, done).
  tech?: 'waiting' | 'working' | 'done';
  techUntil?: number;
  // Chapter 2: web2's app stopped while it still had donors' sessions.
  cut?: boolean;
  // Chapter 3: how many seconds both nodes held the address.
  split?: number;
}
export const story = (j: Game): Story => (j as Shell).principal.state.blood as Story;

// ——— Accounts ———

const lbAccounts = (): Accounts => ({
  users: {
    root: { uid: 0, group: 'root', home: '/root' },
    you: { uid: 1000, group: 'you' },
    haproxy: { uid: 108, group: 'haproxy', home: '/var/lib/haproxy', shell: '/usr/sbin/nologin' },
  },
  groups: { root: { gid: 0, members: [] }, adm: { gid: 4, members: ['you'] }, sudo: { gid: 27, members: ['you'] }, haproxy: { gid: 113, members: [] }, you: { gid: 1000, members: [] } },
});
export const lb1Accounts = lbAccounts;
const webAccounts = (): Accounts => ({
  users: { root: { uid: 0, group: 'root', home: '/root' }, you: { uid: 1000, group: 'you' }, booking: { uid: 998, group: 'booking', home: '/srv/booking', shell: '/usr/sbin/nologin' } },
  groups: { root: { gid: 0, members: [] }, adm: { gid: 4, members: ['you'] }, sudo: { gid: 27, members: ['you'] }, booking: { gid: 998, members: [] }, you: { gid: 1000, members: [] } },
});

// ——— Helpers ———

const root: Rights = { owner: 'root' };
const dir = (children: Record<string, Node>, rights: Rights = root) => d(children, undefined, rights);
const file = (text: string, rights: Rights = root): File => f(text, { lines: true, ...rights });
const proc = (pid: number, user: string, command: string): Process => ({ pid, user, cpu: 0, mem: 0.4, command });
/** The machine of the story where the last command was typed (events are checked on the main machine). */
export const active = (j: Game): Shell => ((j as Shell).principal.state.lastShell as Shell | undefined) ?? (j as Shell).principal;
/** Its name as the story knows it (lb1, lb2, web1…). */
export const activeName = (j: Game) => {
  const a = active(j);
  return a === a.principal ? 'lb1' : a.host;
};
export const typed = (j: Game) => active(j).last.line ?? '';
export const seen = (j: Game, text: string | RegExp, on?: string) => {
  if (on && activeName(j) !== on) return false;
  // The manual quotes the tools' messages: reading it is not meeting them.
  if (/^\s*(man|apropos|whatis|help)\b|--help\b/.test(typed(j))) return false;
  const last = active(j).last;
  const all = `${last.output}\n${last.errors.join('\n')}`;
  return typeof text === 'string' ? all.includes(text) : text.test(all);
};
/** The shell of a machine of the story by name (lb1, lb2, web1…). */
export const machine = (j: Game, name: string): Shell => shellOf(j, name === 'lb1' ? vrrp(j).main : name);
/** The haproxy run of a load balancer. */
export const ha = (j: Game, name: 'lb1' | 'lb2') => haproxy(machine(j, name));
export const holders = (j: Game) => masters(j).map((m) => (m === vrrp(j).main ? 'lb1' : m));
/** A load balancer's running keepalived (its loaded configuration), by story name. */
export const runOf = (j: Game, name: 'lb1' | 'lb2'): Run | undefined => vrrp(j).runs[name === 'lb1' ? vrrp(j).main : name];
/** The service's state on a machine of the story. */
export const serviceState = (j: Game, host: string, unit: string) => systemd(machine(j, host === 'lb1' ? vrrp(j).main : host))?.services[unit]?.state;

/** The run tracks haproxy with a script that is not disabled. */
export function tracks(r: Run | undefined): boolean {
  if (!r?.inst) return false;
  return r.inst.track.some((t) => !r.scripts[t.name]?.disabled && /haproxy/.test(r.conf.scripts[t.name]?.script ?? ''));
}

/**
 * Whether, with the configurations keepalived has loaded, haproxy dying on
 * `x` moves the address to `y` (whose haproxy runs): x goes FAULT (weight
 * 0), or its priority falls below y's and y may preempt.
 */
export function wouldFailOver(j: Game, x: 'lb1' | 'lb2', y: 'lb1' | 'lb2'): boolean {
  const a = runOf(j, x);
  const b = runOf(j, y);
  if (!a?.inst || !b?.inst || !tracks(a) || a.inst.vrid !== b.inst.vrid) return false;
  const haproxyScripts = (r: Run) => r.inst!.track.filter((t) => !r.scripts[t.name]?.disabled && /haproxy/.test(r.conf.scripts[t.name]?.script ?? ''));
  const weight = (r: Run, t: { name: string; weight?: number }) => t.weight ?? r.conf.scripts[t.name].weight;
  if (haproxyScripts(a).some((t) => weight(a, t) === 0)) return true;
  let failing = a.inst.priority;
  for (const t of haproxyScripts(a)) if (weight(a, t) < 0) failing += weight(a, t);
  let healthy = b.inst.priority;
  for (const t of b.inst.track) if (!b.scripts[t.name]?.disabled && weight(b, t) > 0) healthy += weight(b, t);
  failing = Math.max(1, Math.min(254, failing));
  healthy = Math.max(1, Math.min(254, healthy));
  const address = (n: string) => (n === 'lb1' ? LB1 : LB2);
  const wins = healthy > failing || (healthy === failing && address(y).split('.').map(Number)[3] > address(x).split('.').map(Number)[3]);
  return wins && !b.inst.nopreempt;
}

// ——— Configuration files ———

export function keepalivedConf(name: 'lb1' | 'lb2', n: ChapterNo): string {
  const master = name === 'lb1';
  const tracked = n >= 2;
  return `! Configuration File for keepalived
! ${name}: Bastien, 2029${tracked ? ' — tracking haproxy since May 2030' : ''}

global_defs {
    router_id ${name}${tracked ? '\n    enable_script_security\n    script_user root' : ''}
}
${
  tracked
    ? `
vrrp_script chk_haproxy {
    script "/usr/bin/killall -0 haproxy"
    interval 2
    weight -20
    fall 2
    rise 2
}
`
    : ''
}
vrrp_instance VI_1 {
    state ${master ? 'MASTER' : 'BACKUP'}
    interface eth0
    virtual_router_id 51
    priority ${master ? 101 : 100}
    advert_int 1
    virtual_ipaddress {
        ${VIP}/24
    }${
      tracked
        ? `
    track_script {
        chk_haproxy
    }`
        : ''
    }
}`;
}

export function haproxyCfg(n: ChapterNo): string {
  const checked = n === 3;
  return `global
	log /dev/log	local0
	log /dev/log	local1 notice
	chroot /var/lib/haproxy
	stats socket /run/haproxy/admin.sock mode 660 level admin
	stats timeout 30s
	user haproxy
	group haproxy
	daemon

defaults
	log	global
	mode	http
	option	httplog
	option	dontlognull
	timeout connect 5000
	timeout client  50000
	timeout server  50000
	errorfile 400 /etc/haproxy/errors/400.http
	errorfile 403 /etc/haproxy/errors/403.http
	errorfile 408 /etc/haproxy/errors/408.http
	errorfile 500 /etc/haproxy/errors/500.http
	errorfile 502 /etc/haproxy/errors/502.http
	errorfile 503 /etc/haproxy/errors/503.http
	errorfile 504 /etc/haproxy/errors/504.http

# The donors' booking site (Bastien, 2029).
frontend fe_booking
	bind *:80
	default_backend be_booking

backend be_booking
	balance roundrobin${checked ? '\n\toption httpchk GET /health\n\thttp-check expect status 200' : ''}
	server web1 ${WEB.web1}:8080${checked ? ' check inter 2s fall 3 rise 2' : ''}
	server web2 ${WEB.web2}:8080${checked ? ' check inter 2s fall 3 rise 2' : ''}
	server web3 ${WEB.web3}:8080${checked ? ' check inter 2s fall 3 rise 2' : ''}`;
}

const NFT_OPEN = `#!/usr/sbin/nft -f

flush ruleset

table inet filter {
	chain input {
		type filter hook input priority filter;
	}
	chain forward {
		type filter hook forward priority filter;
	}
	chain output {
		type filter hook output priority filter;
	}
}`;

// Chapter 3: the network team's baseline, applied to lb2 on Tuesday night.
export const NFT_BASELINE = `#!/usr/sbin/nft -f
# Baseline hardening v3 - network team (Kirsi), applied 2030-06-04.
# Default deny inbound; allow what the role needs.

flush ruleset

table inet filter {
	chain input {
		type filter hook input priority filter; policy drop;
		ct state established,related accept
		iifname "lo" accept
		ip protocol icmp accept
		tcp dport 22 accept
		tcp dport { 80, 443 } accept
		iifname "eth1" ip saddr 198.51.100.0/24 accept
	}
	chain forward {
		type filter hook forward priority filter; policy drop;
	}
	chain output {
		type filter hook output priority filter; policy accept;
	}
}`;

const hostsFile = () =>
  [
    '127.0.0.1\tlocalhost',
    `${LB1}\tlb1.internal lb1`,
    `${LB2}\tlb2.internal lb2`,
    `${WEB.web1}\tweb1.internal web1`,
    `${WEB.web2}\tweb2.internal web2`,
    `${WEB.web3}\tweb3.internal web3`,
    `${VIP}\t${SITE}`,
  ].join('\n');

const ERRORS = Object.fromEntries(
  ['400', '403', '408', '500', '502', '503', '504'].map((c) => [`${c}.http`, file(`HTTP/1.0 ${c} ${c === '503' ? 'Service Unavailable' : 'Error'}\r\nCache-Control: no-cache\r\nConnection: close\r\nContent-Type: text/html\r\n\r\n<html><body><h1>${c}</h1></body></html>`)]),
);

// ——— The load balancers ———

const lbKey = (t: Translate) => generateKey('lindenvale-lb1', `you@${machineName(t, 'lb1')}`);

function lbServices(name: 'lb1' | 'lb2', n: ChapterNo): Record<string, DefinitionService> {
  const base = name === 'lb1' ? 700 : 720;
  const crashed = name === 'lb1' && n === 1;
  return {
    ssh: { description: 'OpenBSD Secure Shell server', active: true, executable: 'sshd', process: [proc(base - 90, 'root', 'sshd: /usr/sbin/sshd -D [listener] 0 of 10-100 startups')] },
    rsyslog: { description: 'System Logging Service', active: true, executable: 'rsyslogd', process: [proc(base - 80, 'root', '/usr/sbin/rsyslogd -n -iNONE')] },
    nftables: {
      description: 'nftables',
      active: true,
      activeRest: true,
      executable: 'nft',
      process: [],
      check: (j) => {
        const { error } = readConf(j);
        return error ? error.split('\n') : null;
      },
      checkToReload: true,
      load: (j) => {
        const { ruleset } = readConf(j);
        if (ruleset) j.state.nft = ruleset;
      },
      stop: (j) => {
        j.state.nft = { tables: [] };
      },
    },
    keepalived: { description: 'Keepalive Daemon (LVS and VRRP)', active: true, executable: 'keepalived', process: [proc(base + 1, 'root', '/usr/sbin/keepalived --dont-fork'), proc(base + 2, 'root', '/usr/sbin/keepalived --dont-fork')] },
    haproxy: {
      description: 'HAProxy Load Balancer',
      active: true,
      state: crashed ? 'failed' : 'active',
      executable: 'haproxy',
      checkToReload: true,
      process: [proc(base + 112, 'root', '/usr/sbin/haproxy -Ws -f /etc/haproxy/haproxy.cfg -p /run/haproxy.pid -S /run/haproxy-master.sock'), proc(base + 115, 'haproxy', '/usr/sbin/haproxy -Ws -f /etc/haproxy/haproxy.cfg -p /run/haproxy.pid -S /run/haproxy-master.sock')],
    },
  };
}

export function lbState(t: Translate, name: 'lb1' | 'lb2', n: ChapterNo) {
  const services = lbServices(name, n);
  const sd = newSystemd(machineName(t, name), BOOT[n], NOW[n], services);
  if (services.haproxy.state === 'failed') sd.services.haproxy.result = 'exit-code';
  return {
    systemd: sd,
    process: [proc(1, 'root', '/sbin/init'), ...Object.entries(services).filter(([, s]) => s.state !== 'failed').flatMap(([, s]) => s.process ?? [])],
    listening: [
      { proto: 'tcp', address: '0.0.0.0', port: 22, process: 'sshd', pid: services.ssh.process![0].pid },
      ...(services.haproxy.state === 'failed' ? [] : [{ proto: 'tcp', address: '0.0.0.0', port: 80, process: 'haproxy', pid: services.haproxy.process![1].pid }]),
    ],
    baseLan: {
      interfaces: {
        lo: { name: 'lo', up: true, addresses: ['127.0.0.1/8'], mac: '00:00:00:00:00:00', addresses6: ['::1/128'] },
        eth0: { name: 'eth0', up: true, addresses: [`${name === 'lb1' ? LB1 : LB2}/24`], mac: MAC[name] },
        eth1: { name: 'eth1', up: true, addresses: [`${BACK[name]}/24`], mac: name === 'lb1' ? '52:54:00:6c:02:04' : '52:54:00:6c:02:05' },
      },
      gateway: { via: GATEWAY, dev: 'eth0' },
      trunk: '',
      vlans: [],
      devices: [],
      order: ['lo', 'eth0', 'eth1'],
    },
    nft: { tables: [] },
    passwords: {},
    language: t.language,
    haNet: true,
  };
}

export function lbWorld(t: Translate, name: 'lb1' | 'lb2', n: ChapterNo, welcome: Record<string, string> = {}): Directory {
  const key = lbKey(t);
  const own = machineName(t, name);
  return dir({
    etc: dir({
      ...accountsFiles(),
      hostname: file(own),
      hosts: file(hostsFile()),
      'resolv.conf': file(`search internal\nnameserver ${GATEWAY}`),
      keepalived: dir({ 'keepalived.conf': file(keepalivedConf(name, n), { owner: 'root', mode: 'rw-r--r--' }) }),
      haproxy: dir({ 'haproxy.cfg': file(haproxyCfg(n), { owner: 'root', mode: 'rw-r--r--' }), errors: dir(ERRORS) }),
      'nftables.conf': file(name === 'lb2' && n === 3 ? NFT_BASELINE : NFT_OPEN, { owner: 'root', mode: 'rwxr-xr-x' }),
      default: dir({ keepalived: file('# Options to pass to keepalived\n\n# DAEMON_ARGS are appended to the keepalived command-line\nDAEMON_ARGS=""') }),
      rsyslog: dir({ 'rsyslog.d': dir({ '49-haproxy.conf': file('# Create an additional socket in haproxy\'s chroot in order to allow logging via\n# /dev/log to chroot\'ed HAProxy processes\n$AddUnixListenSocket /var/lib/haproxy/dev/log\n\n# Send HAProxy messages to a dedicated logfile\n:programname, startswith, "haproxy" {\n  /var/log/haproxy.log\n  stop\n}') }) }),
    }),
    run: dir({ haproxy: dir({ 'admin.sock': f('', { owner: 'root', group: 'haproxy', mode: 'rw-rw----' }) }, { owner: 'haproxy', group: 'haproxy', mode: 'rwxr-xr-x' }) }),
    var: dir({
      lib: dir({ haproxy: dir({}, { owner: 'haproxy', mode: 'rwxr-xr-x' }) }),
      log: dir({ 'haproxy.log': file('', { owner: 'root', group: 'adm', mode: 'rw-r-----' }) }),
    }),
    proc: dir({ sys: dir({ net: dir({ ipv4: dir({ ip_nonlocal_bind: file('0') }) }) }) }),
    home: dir({
      you: d({
        ...Object.fromEntries(Object.entries(welcome).map(([k, v]) => [k, f(v)])),
        '.ssh': d(
          name === 'lb1'
            ? { id_ed25519: f(key.isPrivate, { lines: true, mode: 'rw-------' }), 'id_ed25519.pub': f(key.isPublic, { lines: true }), authorized_keys: f(key.isPublic, { lines: true, mode: 'rw-------' }) }
            : { authorized_keys: f(key.isPublic, { lines: true, mode: 'rw-------' }) },
          undefined,
          { mode: 'rwx------' },
        ),
      }),
    }),
    root: dir({}, { owner: 'root', mode: 'rwx------' }),
    tmp: dir({}, { owner: 'root', mode: 'rwxrwxrwt' }),
  });
}

// The commands of the machines behind lb1 (an internal host's commands are its own).
export const LB2_COMMANDS = [
  'ls', 'cd', 'pwd', 'cat', 'less', 'head', 'tail', 'grep', 'cut', 'diff', 'cp', 'mv', 'nano', 'sudo', 'echo', 'exit', 'man', 'ssh', 'ps', 'kill', 'killall', 'pidof',
  'systemctl', 'journalctl', 'ip', 'ping', 'curl', 'sleep', 'keepalived', 'haproxy', 'socat', 'tcpdump', 'nft', 'ss',
];
export const WEB_COMMANDS = ['ls', 'cd', 'pwd', 'cat', 'less', 'head', 'tail', 'grep', 'nano', 'sudo', 'echo', 'exit', 'man', 'ssh', 'ps', 'systemctl', 'journalctl', 'ip', 'ping', 'curl', 'ss', 'reboot'];

export function lb2Host(n: ChapterNo): InternalHost {
  return {
    address: LB2,
    domain: 'lb2.internal',
    accounts: lbAccounts,
    commands: LB2_COMMANDS,
    state: (t) => lbState(t, 'lb2', n),
    createWorld: (t) => lbWorld(t, 'lb2', n),
    afterCommand: (s) => passTime(s),
  };
}

// ——— The web servers ———

function webHost(name: string, n: ChapterNo): InternalHost {
  const sick = n === 2 && name === 'web3';
  return {
    address: WEB[name],
    domain: `${name}.internal`,
    accounts: webAccounts,
    commands: WEB_COMMANDS,
    state: (t) => {
      const sd = newSystemd(name, BOOT[n], NOW[n], {
        ssh: { description: 'OpenBSD Secure Shell server', active: true, executable: 'sshd', process: [proc(588, 'root', 'sshd: /usr/sbin/sshd -D')] },
        booking: {
          description: 'Donor booking app (gunicorn)',
          active: true,
          executable: 'gunicorn',
          process: [proc(901, 'booking', '/srv/booking/venv/bin/python3 /srv/booking/venv/bin/gunicorn --bind 0.0.0.0:8080 --workers 4 booking.wsgi'), proc(912, 'booking', '/srv/booking/venv/bin/python3 /srv/booking/venv/bin/gunicorn --bind 0.0.0.0:8080 --workers 4 booking.wsgi')],
        },
      });
      if (sick) {
        for (let k = 0; k < 4; k++) writeLog(sd, 'booking.service', 'gunicorn', 912, 'ERROR booking.db: OperationalError: connection to server at "db.internal" (198.51.100.40), port 5432 failed: FATAL:  sorry, too many clients already', 3, false);
      }
      return {
        systemd: sd,
        process: [proc(1, 'root', '/sbin/init'), proc(588, 'root', 'sshd: /usr/sbin/sshd -D'), ...sd.services.booking.process],
        listening: [{ proto: 'tcp', address: '0.0.0.0', port: 22, process: 'sshd', pid: 588 }, { proto: 'tcp', address: '0.0.0.0', port: 8080, process: 'gunicorn', pid: 901 }],
        baseLan: {
          interfaces: {
            lo: { name: 'lo', up: true, addresses: ['127.0.0.1/8'], mac: '00:00:00:00:00:00', addresses6: ['::1/128'] },
            eth0: { name: 'eth0', up: true, addresses: [`${WEB[name]}/24`], mac: `52:54:00:6c:03:${name.slice(-1).padStart(2, '0')}` },
          },
          gateway: null,
          trunk: '',
          vlans: [],
          devices: [],
          order: ['lo', 'eth0'],
        },
        passwords: {},
        sick,
        haNet: true,
        language: t.language,
      };
    },
    createWorld: (t) => {
      const key = lbKey(t);
      const log = sick
        ? Array.from({ length: 6 }, (_, k) => `2030-05-22 09:${String(48 + k * 3).padStart(2, '0')}:1${k} ERROR booking.db: OperationalError: connection to server at "db.internal" (198.51.100.40), port 5432 failed: FATAL:  sorry, too many clients already\n2030-05-22 09:${String(48 + k * 3).padStart(2, '0')}:1${k} ERROR booking.views: 500 GET /slots`).join('\n')
        : '2030-05-13 09:02:11 INFO booking: started, 4 workers';
      return dir({
        etc: dir({ ...accountsFiles(), hostname: file(name), hosts: file(hostsFile()), 'resolv.conf': file(`search internal\nnameserver ${GATEWAY}`) }),
        srv: dir({ booking: dir({ 'README.txt': file('Donor booking app (Teodor). gunicorn on 0.0.0.0:8080.\nGET /health answers 200 when the app and its database are fine, 500 otherwise.') }, { owner: 'booking', mode: 'rwxr-xr-x' }) }),
        var: dir({ log: dir({ booking: dir({ 'app.log': file(log, { owner: 'booking', mode: 'rw-r--r--' }) }) }) }),
        home: dir({ you: d({ '.ssh': d({ authorized_keys: f(key.isPublic, { lines: true, mode: 'rw-------' }) }, undefined, { mode: 'rwx------' }) }) }),
        root: dir({}, { owner: 'root', mode: 'rwx------' }),
        tmp: dir({}, { owner: 'root', mode: 'rwxrwxrwt' }),
      });
    },
    afterCommand: (s) => passTime(s),
  };
}

export function storyHosts(n: ChapterNo): Record<string, InternalHost> {
  return { lb2: lb2Host(n), web1: webHost('web1', n), web2: webHost('web2', n), web3: webHost('web3', n) };
}

// ——— What answers on the back network (the booking app) ———

const page = (name: string) =>
  `<!DOCTYPE html>\n<html><head><title>Give blood - Lindenvale Blood Service</title></head>\n<body><h1>Book a blood donation</h1>\n<p>Next sessions: Riverside centre, Old Mill hall, the university's mobile unit.</p>\n<!-- served by ${name} -->\n</body></html>`;

function webAnswer(j: Game, name: string, port: number, path: string): Answer | null {
  const w = machine(j, name);
  if (port !== 8080 || w.state.poweredOff || systemd(w)?.services.booking?.state !== 'active') return null;
  const date = `Date: ${new Date(systemd(w)!.clock).toUTCString()}`;
  const headers = (type: string, body: string) => ['server: gunicorn', date.replace('Date', 'date'), `content-type: ${type}`, `content-length: ${body.length}`, `x-served-by: ${name}`];
  if (w.state.sick) {
    const body = path === '/health' ? '{"status": "error", "database": "too many clients already"}' : '<!doctype html>\n<html><head><title>Server Error (500)</title></head><body><h1>Server Error (500)</h1><p></p></body></html>';
    return { code: 500, reason: 'Internal Server Error', headers: headers(path === '/health' ? 'application/json' : 'text/html; charset=utf-8', body), body };
  }
  if (path === '/health') {
    const body = '{"status": "ok", "database": "ok"}';
    return { code: 200, reason: 'OK', headers: headers('application/json', body), body };
  }
  const body = page(name);
  return { code: 200, reason: 'OK', headers: headers('text/html; charset=utf-8', body), body };
}

const backendsOf = (j: Game) => (address: string, port: number, path: string) => {
  const name = Object.keys(WEB).find((n) => WEB[n] === address);
  return name ? webAnswer(j, name, port, path) : null;
};

// ——— Services hooked to the models ———

function attachHaproxy(sh: Shell, name: 'lb1' | 'lb2') {
  const s = systemd(sh)?.services.haproxy;
  if (!s) return;
  const local = (addr: string) => [name === 'lb1' ? LB1 : LB2, BACK[name], '127.0.0.1', ...(masters(sh).includes(name) ? [VIP] : [])].includes(addr);
  s.check = (g) => startProblem(g, parseCfgOf(g), local);
  s.load = (g) => {
    startHaproxy(g, s.process[0].pid);
    g.state.listening = ((g.state.listening ?? []) as { port: number }[]).filter((l) => l.port !== 80).concat([{ proto: 'tcp', address: '0.0.0.0', port: 80, process: 'haproxy', pid: s.process[1].pid } as never]);
  };
  s.stop = (g) => {
    stopHaproxy(g);
    g.state.listening = ((g.state.listening ?? []) as { port: number }[]).filter((l) => l.port !== 80);
  };
}
const parseCfgOf = (g: Game) => parseCfg(g.read(CFG) ?? '');

/** kill or killall on a node's daemons: systemd restarts haproxy (Restart=always), keepalived's death is a failure. */
function onKill(sh: Shell, name: 'lb1' | 'lb2') {
  sh.state.onKill = (g: Game, p: Process, signal: string) => {
    const sd = systemd(g)!;
    const h = sd.services.haproxy;
    const k = sd.services.keepalived;
    if (h.state === 'active' && h.process.some((x) => x.pid === p.pid)) {
      const code = signal === 'KILL' ? 'code=killed, status=9/KILL' : 'code=exited, status=143';
      g.state.process = ((g.state.process ?? []) as Process[]).filter((x) => !h.process.some((y) => y.pid === x.pid));
      stopHaproxy(g);
      writeLog(sd, 'haproxy.service', 'systemd', 1, `haproxy.service: Main process exited, ${code}`);
      writeLog(sd, 'haproxy.service', 'systemd', 1, `haproxy.service: Scheduled restart job, restart counter is at 1.`, 6, false);
      writeLog(sd, 'haproxy.service', 'systemd', 1, `Started haproxy.service - HAProxy Load Balancer.`, 6, false);
      startHaproxy(g, h.process[0].pid);
      (g.state.process as Process[]).push(...h.process);
    } else if (k.state === 'active' && k.process.some((x) => x.pid === p.pid)) {
      g.state.process = ((g.state.process ?? []) as Process[]).filter((x) => !k.process.some((y) => y.pid === x.pid));
      vrrp(g).runs[name] = undefined;
      k.state = 'failed';
      k.result = 'signal';
      writeLog(sd, 'keepalived.service', 'systemd', 1, `keepalived.service: Main process exited, code=killed, status=${signal === 'KILL' ? '9/KILL' : '15/TERM'}`);
      writeLog(sd, 'keepalived.service', 'systemd', 1, `keepalived.service: Failed with result 'signal'.`, 4, false);
    }
    return undefined;
  };
}

function prepareLb(sh: Shell, name: 'lb1' | 'lb2') {
  attachKeepalived(sh, name);
  attachHaproxy(sh, name);
  onKill(sh, name);
  const sd = systemd(sh)!;
  if (sd.services.nftables) {
    const { ruleset } = readConf(sh);
    if (ruleset) sh.state.nft = ruleset;
  }
  if (sd.services.haproxy.state === 'active') startHaproxy(sh, sd.services.haproxy.process[0].pid);
}

// ——— The beginning of a chapter ———

function seedJournal(j: Game, n: ChapterNo) {
  const lb1 = machine(j, 'lb1');
  const sd = systemd(lb1)!;
  if (n === 1) {
    // haproxy's worker aborted at 6:58; systemd restarted it until its start limit.
    sd.services.haproxy.since = Date.UTC(2030, 4, 13, 6, 58, 9);
    const at = (s: number) => Date.UTC(2030, 4, 13, 6, 58, s);
    const lines: [number, string, number, string][] = [];
    for (let k = 0; k < 5; k++) {
      const s = 1 + k * 2;
      lines.push(
        [at(s), 'haproxy', 812, `[ALERT]    (812) : Current worker (815) exited with code 134 (Aborted)`],
        [at(s), 'haproxy', 812, `[ALERT]    (812) : exit-on-failure: killing every processes with SIGTERM`],
        [at(s), 'haproxy', 812, `[WARNING]  (812) : All workers exited. Exiting... (134)`],
        [at(s), 'systemd', 1, `haproxy.service: Main process exited, code=exited, status=134/n/a`],
        [at(s), 'systemd', 1, `haproxy.service: Failed with result 'exit-code'.`],
      );
      if (k < 4) lines.push([at(s + 1), 'systemd', 1, `haproxy.service: Scheduled restart job, restart counter is at ${k + 1}.`], [at(s + 1), 'systemd', 1, `Started haproxy.service - HAProxy Load Balancer.`]);
    }
    lines.push([at(10), 'systemd', 1, 'haproxy.service: Start request repeated too quickly.'], [at(10), 'systemd', 1, "haproxy.service: Failed with result 'exit-code'."], [at(10), 'systemd', 1, 'Failed to start haproxy.service - HAProxy Load Balancer.']);
    for (const [time, ident, pid, message] of lines) sd.log.push({ time, boot: sd.boot, unit: 'haproxy.service', ident, pid, message, priority: message.includes('ALERT') || message.startsWith('Failed') ? 3 : 6 });
    sd.log.sort((a, b) => a.time - b.time);
  }
}

/** At the start: the nodes' daemons run, the election settles, the donors' traffic begins. */
export function initialiseStory(j: Game, n: ChapterNo) {
  const p = j as Shell;
  p.state.blood = { chapter: n, outcomes: [], donors: 0, ...(n === 2 ? { tech: 'waiting' } : {}) } satisfies Story;
  p.state.vrrp = {
    main: p.host,
    nodes: { [p.host]: { name: p.host, address: LB1, mac: MAC.lb1, iface: 'eth0' }, lb2: { name: 'lb2', address: LB2, mac: MAC.lb2, iface: 'eth0' } },
    runs: {},
    speakers: [],
    packets: [],
    now: 0,
    nextPid: 4000,
  } satisfies Vrrp;
  p.state.haBackends = backendsOf(p);
  p.state.network = networkView(p);
  p.state.reach = (from: Shell, address: string) => reach(from, address);
  p.state.haHttp = (from: Shell, address: string, port: number, path: string) => httpFrom(from, address, port, path);
  p.state.haAdvance = (seconds: number) => advance(p, seconds);
  for (const name of ['lb2', 'web1', 'web2', 'web3']) {
    const s = p.internal(name)!;
    s.state.network = networkView(s);
  }
  // The past: the nodes booted, lb1 won the election; in chapter 3, the routers' VRRP group came at 21:30 on
  // Tuesday, and lb2's new firewall at 22:04.
  jump(p, BOOT[n] + 9000);
  prepareLb(p, 'lb1');
  prepareLb(machine(p, 'lb2'), 'lb2');
  // Chapter 3: before Tuesday night, lb2 ran the old, open ruleset.
  if (n === 3) machine(p, 'lb2').state.nft = { tables: [] };
  startKeepalived(p, p.host);
  advance(p, 2, false);
  startKeepalived(machine(p, 'lb2'), 'lb2');
  advance(p, 20, false);
  if (n === 3) {
    jump(p, Date.UTC(2030, 5, 4, 21, 30, 0));
    vrrp(p).speakers.push({ address: EDGE_A, mac: MAC.edgeA, vrid: 51, priority: 120, vips: [`${GATEWAY}/24`], advertInt: 1 });
    advance(p, 3, false);
    jump(p, Date.UTC(2030, 5, 4, 22, 4, 0));
    const lb2 = machine(p, 'lb2');
    const sd = systemd(lb2)!;
    writeLog(sd, 'nftables.service', 'systemd', 1, 'Starting nftables.service - nftables...', 6, false);
    writeLog(sd, 'nftables.service', 'systemd', 1, 'Finished nftables.service - nftables.', 6, false);
    const { ruleset } = readConf(lb2);
    if (ruleset) lb2.state.nft = ruleset;
    advance(p, 8, false);
  }
  seedJournal(p, n);
  jump(p, NOW[n] - 30_000);
  advance(p, 30);
}

/** The story's clocks set to a moment (a jump over days where nothing happened). */
function jump(p: Shell, t: number) {
  for (const s of shells(p)) systemd(s)!.clock = t;
  vrrp(p).now = t;
}

// ——— Time ———

/** The story's machines that exist (the main one and its internal machines). */
export const shells = (j: Game): Shell[] => {
  const p = (j as Shell).principal;
  return [p, ...p.internals.values()];
};

/** A command passes on any machine of the story: five seconds (and what sleep asked for). */
export function passTime(j: Game) {
  const p = (j as Shell).principal;
  p.state.lastShell = j;
  let slept = 0;
  for (const s of shells(p)) {
    slept += (s.state.slept as number | undefined) ?? 0;
    s.state.slept = 0;
  }
  advance(p, 5 + Math.min(Math.floor(slept / 1000), 600));
}

/** Seconds of the story's life. */
export function advance(j: Game, seconds: number, donors = true) {
  const p = (j as Shell).principal;
  const all = shells(p);
  let t = Math.max(...all.map((s) => systemd(s)?.clock ?? 0), vrrp(p).now);
  for (let k = 0; k < seconds; k++) {
    t += 1000;
    for (const s of all) {
      const sd = systemd(s);
      if (sd) sd.clock = t;
    }
    second(p, t, donors);
  }
}

const LBS = ['lb1', 'lb2'] as const;

function second(p: Shell, t: number, donors: boolean) {
  const st = story(p);
  tick(p, t);
  const held = masters(p);
  for (const name of LBS) {
    const sh = machine(p, name === 'lb1' ? vrrp(p).main : name);
    const r = haproxy(sh);
    if (!r) continue;
    runChecks(sh, t);
    for (const s of r.servers) if (!s.up && s.conf.check) s.downtime += 1000;
    const receiving = held.includes(name === 'lb1' ? vrrp(p).main : name);
    if (t % 4000 === 0) settle(sh, () => receiving);
  }
  if (split(p)) st.split = (st.split ?? 0) + 1;
  if (st.chapter === 1) {
    const down = serviceState(p, 'lb1', 'haproxy') !== 'active';
    const h = holders(p);
    if (down && tracks(runOf(p, 'lb1')) && h.length === 1 && h[0] === 'lb2' && serviceState(p, 'lb2', 'haproxy') === 'active') st.failedOver = true;
    st.stuck = down && tracks(runOf(p, 'lb1')) && h.includes('lb1') ? (st.stuck ?? 0) + 1 : 0;
    if ((st.stuck ?? 0) > (st.stuckMax ?? 0)) st.stuckMax = st.stuck;
  }
  // The gateway asks who has the virtual address, every ten seconds; every master answers.
  if (t % 10_000 === 0) {
    vrrp(p).packets.push({ time: t, kind: 'arp-request', src: GATEWAY, dst: 'ff:ff:ff:ff:ff:ff', srcMac: MAC.gateway, target: VIP });
    for (const h of held) vrrp(p).packets.push({ time: t, kind: 'arp-reply', src: VIP, dst: GATEWAY, srcMac: vrrp(p).nodes[h].mac, target: VIP });
  }
  maintenance(p, t);
  if (donors && t % 2000 === 0) donor(p, t);
}

/** Both nodes hold the virtual address. */
export const split = (j: Game) => masters(j).length > 1;

const PATHS = ['/', '/slots?centre=riverside', '/slots?centre=old-mill', '/book', '/static/app.css', '/slots?centre=university'];

/** A donor's request to the site: through the gateway, to whoever holds the virtual address. */
function donor(p: Shell, t: number) {
  const st = story(p);
  const k = st.donors++;
  const client = `203.0.113.${(k * 37) % 250 + 2}:${40000 + ((k * 131) % 20000)}`;
  const path = PATHS[k % PATHS.length];
  const held = masters(p);
  let outcome: number | string;
  if (!held.length) outcome = 'timeout';
  else {
    // Two masters: the gateway's ARP entry swings between them; a connection that moves is reset.
    const target = held[k % held.length];
    const cut = held.length > 1 && k % 2 === 1;
    const res = request(machine(p, target), 80, path, client, t, cut);
    outcome = res === null ? 'refused' : res.answer === null ? 'reset' : res.answer.code;
  }
  st.outcomes = [...st.outcomes, outcome].slice(-12);
}

/** The last donors' requests all succeeded. */
export const servedLately = (j: Game, count = 4) => {
  const o = story(j).outcomes;
  return o.length >= count && o.slice(-count).every((x) => typeof x === 'number' && x < 400);
};

// ——— Chapter 2: the technician's visit to web2 ———

/** Whether a server still gets new requests, or has sessions, on the load balancers that hold the address. */
export function web2Busy(j: Game): { traffic: boolean; sessions: number } {
  let traffic = false;
  let sessions = 0;
  for (const name of masters(j)) {
    const r = haproxy(machine(j, name));
    if (!r) continue;
    const s = r.servers.find((x) => x.name === 'web2');
    if (!s) continue;
    if (s.up && s.admin === 'ready' && s.weight > 0) traffic = true;
    sessions += s.scur;
  }
  return { traffic, sessions };
}

function maintenance(p: Shell, t: number) {
  const st = story(p);
  if (st.chapter !== 2) return;
  const w2 = machine(p, 'web2');
  const busy = web2Busy(p);
  if (busy.sessions > 0 && !webAnswer(p, 'web2', 8080, '/') && st.tech !== 'working') st.cut = true;
  if (st.tech === 'waiting' && !busy.traffic && busy.sessions === 0 && masters(p).length > 0) {
    st.tech = 'working';
    st.techUntil = t + 60_000;
    w2.state.poweredOff = true;
  }
  if (st.tech === 'working' && t >= (st.techUntil ?? 0)) {
    st.tech = 'done';
    w2.state.poweredOff = false;
    const sd = systemd(w2)!;
    writeLog(sd, '', 'kernel', 0, 'Linux version 6.12.48+deb13-amd64 (debian-kernel@lists.debian.org)', 6, false);
    writeLog(sd, 'booking.service', 'systemd', 1, 'Started booking.service - Donor booking app (gunicorn).', 6, false);
  }
}

// ——— The network as each machine sees it ———

/** Who answers at an address on port 80 or 8080 from a machine: a load balancer's HAProxy or a web server's app. */
export function httpFrom(s: Shell, address: string, port: number, path: string): { answer: Answer | null; reset?: boolean } | 'no-route' | 'refused' {
  const p = s.principal;
  const here = (vrrp(p).main === s.host || s === p ? 'lb1' : s.host) as string;
  const node = (n: string) => machine(p, n === 'lb1' ? vrrp(p).main : n);
  const local = ['127.0.0.1', 'localhost'];
  const lbAt = (a: string) => (a === LB1 || a === BACK.lb1 ? 'lb1' : a === LB2 || a === BACK.lb2 ? 'lb2' : null);
  let target: string | null = null;
  let cut = false;
  if (local.includes(address)) target = here;
  else if (address === VIP) {
    const held = masters(p).map((m) => (m === vrrp(p).main ? 'lb1' : m));
    if (held.includes(here)) target = here;
    else if (!held.length) return 'no-route';
    else {
      const k = (p.state.curlFlip = ((p.state.curlFlip as number | undefined) ?? 0) + 1);
      target = held[k % held.length];
      cut = held.length > 1 && k % 2 === 1;
    }
  } else target = lbAt(address);
  if (target === 'lb1' || target === 'lb2') {
    if (local.includes(address) && port === 8080) return 'refused';
    const sh = node(target);
    const client = `${here === 'lb1' ? LB1 : here === 'lb2' ? LB2 : WEB[here] ?? '127.0.0.1'}:${50000 + (((p.state.curlFlip as number | undefined) ?? 0) % 9000)}`;
    const res = request(sh, port, path, client, systemd(sh)!.clock, cut);
    if (!res) return 'refused';
    return res.answer ? { answer: res.answer } : { answer: null, reset: true };
  }
  const web = Object.keys(WEB).find((n) => WEB[n] === address) ?? (local.includes(address) && WEB[here] ? here : null);
  if (web) {
    if (machine(p, web).state.poweredOff) return 'no-route';
    const a = webAnswer(p, web, port, path);
    return a ? { answer: a } : 'refused';
  }
  return 'no-route';
}

/** ssh's route: web2 while the technician has it switched off doesn't answer. */
function reach(_from: Shell, address: string): { host: string } | 'unreachable' | 'timeout' | null {
  const p = _from.principal;
  const web = Object.keys(WEB).find((n) => WEB[n] === address);
  if (web && machine(p, web).state.poweredOff) return 'timeout';
  return null;
}

/** ping's view (network.ts's model, computed on demand). */
export function networkView(s: Shell) {
  const resolveIp = (k: string) => (/^\d+\.\d+\.\d+\.\d+$/.test(k) ? k : null);
  const known = (a: string) => {
    const p = s.principal;
    if ([LB1, LB2, GATEWAY, EDGE_A, BACK.lb1, BACK.lb2].includes(a)) return true;
    if (a === VIP) return masters(p).length > 0;
    const web = Object.keys(WEB).find((n) => WEB[n] === a);
    return !!web && !machine(p, web).state.poweredOff;
  };
  return {
    resolvers: [GATEWAY],
    routes: {},
    names: { [SITE]: VIP, lb1: LB1, lb2: LB2, web1: WEB.web1, web2: WEB.web2, web3: WEB.web3 },
    machines: new Proxy({} as Record<string, { ping: boolean; ms: number }>, {
      get: (_, k) => {
        const a = typeof k === 'string' ? resolveIp(k) : null;
        return a && known(a) ? { ping: true, ms: 0.28 } : undefined;
      },
    }),
    web: {},
  };
}

export type { Packet };
