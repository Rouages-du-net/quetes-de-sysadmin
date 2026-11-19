// Story "The Ferry": what its chapters share. An island's ferry
// cooperative (Le Bac in French) runs its timetable site, its booking app
// and its own DNS zone (ferry.example) on a small Debian server, quay
// (quai in French), at the harbour office. Last month the island's fibre
// cooperative (islenet), where Rangi works, turned IPv6 on: the server
// got a prefix from the router's advertisements, and Tevita, the
// volunteer who had set it up, added AAAA records. The same services now
// travel two roads.
// Chapter 1: the network card was replaced; the SLAAC address followed
// the new MAC, the AAAA records still name the old one. Chapter 2: the
// firewall is a "table ip": IPv6 goes through untouched (PostgreSQL and
// the admin pages are open). Chapter 3: nginx only listens in IPv4, and
// the booking app, updated, now listens on ::1 while nginx asks 127.0.0.1.
// lookout (vigie in French) is islenet's monitoring box on the internet,
// an internal host reached with ssh from quay: the outside view, over both
// families (state.vantage, see ipv6.ts).
// Addresses: RFC 5737 (192.0.2.52, 198.51.100.61, 198.51.100.40,
// 203.0.113.53) and RFC 3849 (2001:db8::/32); MACs: RFC 7042 (00:00:5e:00:53:xx).

import { d, f, accountsFiles, type Accounts, type Directory, type Node, type Rights, type InternalHost } from '../world';
import { machineName, WORKSTATION } from '../machines';
import type { Game, Shell } from '../shell';
import type { Translate } from '../../texts';
import { newSystemd, systemd, writeLog, type DefinitionService } from '../systemd';
import { create, lan, startNetwork, type Lan } from '../lan';
import { applySysctl, sysctlToBoot } from '../commands/nftables';
import { readConf, toBoot, traverse, nft, type Package, type Ruleset } from '../nftables';
import { checkNginx, loadNginx, nginxSockets, httpRequest, test as testNginx, nginxTime, type App, type Configuration } from '../nginx';
import { reloadZones, query, type DnsState } from '../dns';
import { MIME, NGINX_CONF } from '../commands/apt';
import { generateKey } from '../access';
import { addresses6, boot6, disabled6, linkLocalFor, listens, normalise6, slaacFor, sync6, type Family } from '../ipv6';
import type { Listening } from '../commands/ss';

export const M = '/home/you';
export const PASSWORD = 'tide-2029';

// Tuesday 10 April 2029, 9:10 (chapter 1); Thursday 12 April, 14:05 (chapter 2); Saturday 14 April, 8:35 (chapter 3).
export const NOW_1 = Date.UTC(2029, 3, 10, 9, 10, 0);
export const NOW_2 = Date.UTC(2029, 3, 12, 14, 5, 0);
export const NOW_3 = Date.UTC(2029, 3, 14, 8, 35, 0);
const BOOT = Date.UTC(2029, 3, 3, 16, 42, 0);

export const QUAY4 = '192.0.2.52';
export const GATEWAY4 = '192.0.2.1';
export const PREFIX = '2001:db8:4e1:20::/64';
export const ROUTER_MAC = '00:00:5e:00:53:01';
export const ROUTER_LL = linkLocalFor(ROUTER_MAC);
export const ROUTER_GLOBAL = '2001:db8:4e1:20::1';
// The network card replaced last week, and the new one.
export const OLD_MAC = '00:00:5e:00:53:2a';
export const NEW_MAC = '00:00:5e:00:53:7c';
export const OLD_SLAAC = slaacFor(PREFIX, OLD_MAC);
export const NEW_SLAAC = slaacFor(PREFIX, NEW_MAC);
// The address islenet reserves for servers (Rangi's email).
export const STATIC = '2001:db8:4e1:20::80';
export const LOOKOUT4 = '198.51.100.61';
export const LOOKOUT6 = '2001:db8:c0:61::10';
// The booking desk at the harbour office, which reads the database.
export const OFFICE = '198.51.100.40';
export const SECONDARY = '203.0.113.53';
export const DOMAIN = 'ferry.example';
export const ZONE_FILE = '/etc/bind/zones/db.ferry.example';
export const SITE = '/etc/nginx/sites-available/ferry';
export const BOOKING_ENV = '/etc/default/booking';
export const INTERFACES = '/etc/network/interfaces';

export const ferryAccounts = (): Accounts => ({
  users: {
    root: { uid: 0, group: 'root', home: '/root' },
    'www-data': { uid: 33, group: 'www-data', home: '/var/www', shell: '/usr/sbin/nologin' },
    bind: { uid: 106, group: 'bind', home: '/var/cache/bind', shell: '/usr/sbin/nologin' },
    postgres: { uid: 108, group: 'postgres', home: '/var/lib/postgresql', shell: '/bin/bash' },
    booking: { uid: 998, group: 'booking', home: '/srv/booking', shell: '/usr/sbin/nologin' },
    you: { uid: 1000, group: 'you' },
    amaru: { uid: 1001, group: 'amaru' },
  },
  groups: {
    root: { gid: 0, members: [] },
    adm: { gid: 4, members: ['you'] },
    sudo: { gid: 27, members: ['you'] },
    'www-data': { gid: 33, members: [] },
    bind: { gid: 110, members: [] },
    postgres: { gid: 113, members: [] },
    booking: { gid: 998, members: [] },
    you: { gid: 1000, members: [] },
    amaru: { gid: 1001, members: [] },
  },
});

export type ChapterNo = 1 | 2 | 3;

// ——— The network ———

/** quay's link: lo and eth0 (the new card), the islenet router advertising its prefix. */
export function ferryLan(): Lan {
  const l: Lan = {
    interfaces: {},
    gateway: null,
    trunk: '',
    vlans: [],
    devices: [],
    order: [],
    ra: { dev: 'eth0', prefix: PREFIX, router: ROUTER_LL, mac: ROUTER_MAC, global: ROUTER_GLOBAL },
    gateway6: null,
  };
  create(l, 'lo');
  create(l, 'eth0').mac = NEW_MAC;
  return l;
}

/** /etc/network/interfaces: IPv4 static; from chapter 2, the static IPv6 address chosen in chapter 1. */
export const interfacesFile = (chapter: ChapterNo) =>
  [
    '# This file describes the network interfaces available on your system',
    '# and how to activate them. For more information, see interfaces(5).',
    '',
    'source /etc/network/interfaces.d/*',
    '',
    '# The loopback network interface',
    'auto lo',
    'iface lo inet loopback',
    '',
    '# The primary network interface',
    'auto eth0',
    'iface eth0 inet static',
    `\taddress ${QUAY4}/24`,
    `\tgateway ${GATEWAY4}`,
    ...(chapter === 1 ? [] : ['', 'iface eth0 inet6 static', `\taddress ${STATIC}/64`, `\tgateway ${ROUTER_LL}`]),
  ].join('\n');

// The kernel's settings (/proc/sys), as at boot.
export const DEFAULTS_SYSCTL: Record<string, string> = {
  'kernel.hostname': 'quay',
  'net.ipv4.ip_forward': '0',
  'net.ipv4.conf.all.forwarding': '0',
  'net.ipv6.bindv6only': '0',
  ...Object.fromEntries(
    ['all', 'default', 'lo', 'eth0'].flatMap((i) => [
      [`net.ipv6.conf.${i}.accept_ra`, '1'],
      [`net.ipv6.conf.${i}.autoconf`, '1'],
      [`net.ipv6.conf.${i}.disable_ipv6`, '0'],
      [`net.ipv6.conf.${i}.forwarding`, '0'],
    ]),
  ),
};

function procSys(): Directory {
  const sysRoot: Directory = d({}, undefined, { owner: 'root' });
  for (const [key, v] of Object.entries(DEFAULTS_SYSCTL)) {
    const chunks = key.split('.');
    let directory = sysRoot;
    for (const m of chunks.slice(0, -1)) directory = (directory.children[m] ??= d({}, undefined, { owner: 'root' })) as Directory;
    directory.children[chunks.at(-1)!] = f(v, { owner: 'root', mode: 'rw-r--r--' });
  }
  return sysRoot;
}

// ——— The firewall ———

/** Tevita's firewall: a "table ip", so for IPv4 only. */
export const NFTABLES_IP = `#!/usr/sbin/nft -f
# quay's firewall (Tevita, 2027)

flush ruleset

table ip filter {
	chain input {
		type filter hook input priority filter; policy drop;
		ct state established,related accept
		iif "lo" accept
		icmp type echo-request accept
		# ssh, DNS (our zone), the site
		tcp dport { 22, 53, 80 } accept
		udp dport 53 accept
		# the booking desk at the harbour office reads the database
		ip saddr ${OFFICE} tcp dport 5432 accept
	}
	chain forward {
		type filter hook forward priority filter; policy drop;
	}
	chain output {
		type filter hook output priority filter; policy accept;
	}
}`;

/** The same rules for both families: chapter 2's fix (chapter 3 starts with it). */
export const NFTABLES_INET = `#!/usr/sbin/nft -f
# quay's firewall: one table for IPv4 and IPv6

flush ruleset

table inet filter {
	chain input {
		type filter hook input priority filter; policy drop;
		ct state invalid drop
		ct state established,related accept
		iif "lo" accept
		icmp type echo-request accept
		# IPv6 needs ICMPv6: neighbour discovery, router advertisements, too-big packets (RFC 4890)
		icmpv6 type { nd-neighbor-solicit, nd-neighbor-advert, nd-router-advert, packet-too-big, destination-unreachable, time-exceeded, parameter-problem, echo-request } accept
		tcp dport { 22, 53, 80 } accept
		udp dport 53 accept
		ip saddr ${OFFICE} tcp dport 5432 accept
	}
	chain forward {
		type filter hook forward priority filter; policy drop;
	}
	chain output {
		type filter hook output priority filter; policy accept;
	}
}`;

// ——— DNS ———

export const zoneFile = (t: Translate, aaaa: string, serial: string) => {
  const quay = machineName(t, 'quay');
  const lookout = machineName(t, 'lookout');
  return `$TTL 3600
@       IN SOA  ns1.${DOMAIN}. hostmaster.${DOMAIN}. (
                ${serial} ; serial
                3600       ; refresh
                900        ; retry
                1209600    ; expire
                300 )      ; negative cache TTL
        IN NS   ns1.${DOMAIN}.
        IN NS   ns2.islenet.example.
        IN A    ${QUAY4}
        IN AAAA ${aaaa}
ns1     IN A    ${QUAY4}
${quay.padEnd(8)}IN A    ${QUAY4}
${quay.padEnd(8)}IN AAAA ${aaaa}
www     IN CNAME ${quay}
; ${t('ferry-zone-lookout-comment')}
${lookout.padEnd(8)}IN A    ${LOOKOUT4}
${lookout.padEnd(8)}IN AAAA ${LOOKOUT6}`;
};

const NAMED_CONF_LOCAL = `//
// Do any local configuration here
//

zone "${DOMAIN}" {
    type primary;
    file "${ZONE_FILE}";
    notify yes;
    also-notify { ${SECONDARY}; };
};`;

const NAMED_OPTIONS = `options {
    directory "/var/cache/bind";
    recursion no;
    allow-transfer { ${SECONDARY}; };
    listen-on { any; };
    listen-on-v6 { any; };
};`;

const dnsState = (t: Translate): DnsState => ({
  conf: '/etc/bind/named.conf.local',
  primary: {},
  secondary: {},
  cache: {},
  servers: {
    primary: ['localhost', '127.0.0.1', '::1', machineName(t, 'quay'), `${machineName(t, 'quay')}.${DOMAIN}`, `ns1.${DOMAIN}`, QUAY4],
    secondary: ['ns2.islenet.example', SECONDARY],
    resolver: ['9.9.9.9', 'dns.quad9.net'],
  },
  charges: {},
});

/** The AAAA records the zone's public servers give (the secondary copies the primary only when the serial goes up). */
export const publicAaaa = (j: Game, name: string) =>
  query(j, 'secondary', name, 'AAAA', 0)
    .responses.filter((r) => r.type === 'AAAA')
    .map((r) => normalise6(r.data) ?? r.data);
export const primaryAaaa = (j: Game, name: string) =>
  query(j, 'primary', name, 'AAAA', 0)
    .responses.filter((r) => r.type === 'AAAA')
    .map((r) => normalise6(r.data) ?? r.data);
/** The three names that must lead to quay over IPv6. */
export const publicNames = (t: Translate) => [DOMAIN, `www.${DOMAIN}`, `${machineName(t, 'quay')}.${DOMAIN}`];

// ——— The services ———

/** The booking app's listening address, from HOST in /etc/default/booking (Node.js: "localhost" gives ::1 first). */
export function bookingBind(host: string | undefined): string {
  const h = (host ?? '').trim();
  if (h === 'localhost' || h === '::1' || h === '[::1]') return '[::1]';
  if (h === '127.0.0.1') return '127.0.0.1';
  if (h === '0.0.0.0') return '0.0.0.0';
  return '*';
}

const readEnv = (text: string) => Object.fromEntries([...text.matchAll(/^\s*([A-Z_]+)\s*=\s*"?([^"\n#]*)"?/gm)].map((m) => [m[1], m[2].trim()]));

/** The booking app: its page, served on the loopback address it was told. */
export const bookingApp = (t: Translate): App => ({
  service: 'booking',
  pages: { '/': t('ferry-booking-page'), '/health': 'ok' },
});
export const adminApp = (t: Translate): App => ({ service: 'booking', pages: { '/': t('ferry-admin-page') } });

/** The sockets of quay that don't depend on the chapter's configuration. */
const fixedSockets = (): Listening[] => [
  { proto: 'tcp', address: '0.0.0.0', port: 22, process: 'sshd', pid: 611 },
  { proto: 'tcp', address: '[::]', port: 22, process: 'sshd', pid: 611, v6only: true },
  { proto: 'tcp', address: '0.0.0.0', port: 53, process: 'named', pid: 733 },
  { proto: 'tcp', address: '[::]', port: 53, process: 'named', pid: 733, v6only: true },
  { proto: 'udp', address: '0.0.0.0', port: 53, process: 'named', pid: 733 },
  { proto: 'udp', address: '[::]', port: 53, process: 'named', pid: 733, v6only: true },
  { proto: 'tcp', address: '0.0.0.0', port: 5432, process: 'postgres', pid: 742 },
  { proto: 'tcp', address: '[::]', port: 5432, process: 'postgres', pid: 742, v6only: true },
];

/** state.listening and state.apps, from what nginx and the booking app have loaded. */
export function syncSockets(j: Game) {
  const sd = systemd(j);
  const list: Listening[] = [...fixedSockets()];
  const config: Configuration | null = j.state.nginx?.load ?? null;
  if (config && sd?.services.nginx?.state === 'active')
    for (const s of nginxSockets(config)) list.push({ proto: 'tcp', address: s.address, port: s.port, process: 'nginx', pid: 801, ...(s.address === '[::]' ? { v6only: true } : {}) });
  const apps: Record<string, App> = {};
  if (sd?.services.booking?.state === 'active') {
    const env = (j.state.bookingEnv ?? {}) as Record<string, string>;
    const at = bookingBind(env.HOST);
    const port = Number(env.PORT ?? 3000);
    list.push({ proto: 'tcp', address: at, port, process: 'node', pid: 951 });
    // The admin pages: no ADMIN_HOST, so Node.js listens on :: (both families).
    const adminAt = bookingBind(env.ADMIN_HOST);
    const adminPort = Number(env.ADMIN_PORT ?? 8080);
    list.push({ proto: 'tcp', address: adminAt, port: adminPort, process: 'node', pid: 951 });
    for (const [where, p, app] of [
      [at, port, bookingApp(j.t)],
      [adminAt, adminPort, adminApp(j.t)],
    ] as [string, number, App][]) {
      if (where !== '[::1]') apps[`127.0.0.1:${p}`] = app;
      if (where === '[::1]' || where === '*') apps[`[::1]:${p}`] = app;
    }
  }
  j.state.listening = list;
  j.state.apps = apps;
}

function services(): Record<string, DefinitionService> {
  return {
    networking: { description: 'Raise network interfaces', active: true, activeRest: true, executable: 'ifup', process: [], load: (j) => startNetwork(j) },
    'systemd-sysctl': { description: 'Apply Kernel Variables', active: true, activeRest: true, executable: 'systemd-sysctl', process: [], load: (j) => applySysctl(j, DEFAULTS_SYSCTL) },
    ssh: { description: 'OpenBSD Secure Shell server', active: true, executable: 'sshd', process: [{ pid: 611, user: 'root', cpu: 0, mem: 0.2, command: 'sshd: /usr/sbin/sshd -D [listener] 0 of 10-100 startups' }] },
    named: {
      description: 'BIND Domain Name Server',
      active: true,
      executable: 'named',
      process: [{ pid: 733, user: 'bind', cpu: 0.1, mem: 1.4, command: '/usr/sbin/named -f -u bind' }],
      load: (j) => void reloadZones(j),
    },
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
    nginx: {
      description: 'A high performance web server and a reverse proxy server',
      active: true,
      executable: 'nginx',
      process: [
        { pid: 801, user: 'root', cpu: 0, mem: 0.3, command: 'nginx: master process /usr/sbin/nginx -g daemon on; master_process on;' },
        { pid: 802, user: 'www-data', cpu: 0.1, mem: 0.6, command: 'nginx: worker process' },
      ],
      // nginx -t doesn't bind: "listen 80" next to "listen [::]:80 ipv6only=off" only fails when nginx opens its sockets.
      check: (j) => {
        const e = checkNginx(j);
        if (e) return e;
        const c = testNginx(j).config;
        const v4 = new Set(c?.servers.flatMap((x) => x.listening.filter((a) => a.startsWith('0.0.0.0:')).map((a) => a.slice(8))) ?? []);
        const clash = c?.servers.flatMap((x) => x.dual ?? []).find((a) => v4.has(a.slice(5)));
        return clash ? [`${nginxTime((systemd(j)?.clock ?? 0) + 1000)} [emerg] 2411#2411: bind() to ${clash} failed (98: Address already in use)`] : null;
      },
      checkToReload: true,
      load: (j) => {
        loadNginx(j);
        syncSockets(j);
      },
      stop: (j) => syncSockets(j),
    },
    booking: {
      description: 'Ferry booking app',
      active: true,
      executable: 'node',
      process: [{ pid: 951, user: 'booking', cpu: 0.6, mem: 2.8, command: '/usr/bin/node /srv/booking/server.js' }],
      load: (j) => {
        j.state.bookingEnv = readEnv(j.read(BOOKING_ENV) ?? '');
        syncSockets(j);
        const env = j.state.bookingEnv as Record<string, string>;
        const sd = systemd(j);
        const show = (b: string) => (b === '*' ? '[::]' : b);
        if (sd) writeLog(sd, 'booking.service', 'node', 951, `booking listening on http://${show(bookingBind(env.HOST))}:${env.PORT ?? 3000} (admin on http://${show(bookingBind(env.ADMIN_HOST))}:${env.ADMIN_PORT ?? 8080})`);
      },
      stop: (j) => syncSockets(j),
    },
    'postgresql@15-main': {
      description: 'PostgreSQL Cluster 15-main',
      active: true,
      executable: 'postgres',
      process: [{ pid: 742, user: 'postgres', cpu: 0, mem: 1.4, command: '/usr/lib/postgresql/15/bin/postgres -D /var/lib/postgresql/15/main' }],
    },
  };
}

/** quay's state at the start of a chapter. */
export function ferryState(t: Translate, chapter: ChapterNo) {
  const now = chapter === 1 ? NOW_1 : chapter === 2 ? NOW_2 : NOW_3;
  return {
    systemd: newSystemd(machineName(t, 'quay'), BOOT, now, services()),
    lan: ferryLan(),
    dns: dnsState(t),
    nginx: { load: null, names: ['localhost', '127.0.0.1', DOMAIN, `www.${DOMAIN}`], accessLog: true },
    nft: { tables: [] },
    mounts: [{ path: '/', capacity: 64 * 1024 ** 3, name: '/dev/vda1', system: 'ext4' }],
  };
}

/** At the start: the kernel's settings, the network, the firewall, the zone, nginx and the app. */
export function initialiseFerry(j: Game) {
  const s = j as Shell;
  const who = s.who;
  s.who = 'root';
  try {
    applySysctl(j, DEFAULTS_SYSCTL);
    startNetwork(j);
    const { ruleset } = readConf(j);
    if (ruleset) j.state.nft = ruleset;
    reloadZones(j);
    loadNginx(j);
    j.state.bookingEnv = readEnv(j.read(BOOKING_ENV) ?? '');
    syncSockets(j);
    bookingJournal(j);
  } finally {
    s.who = who;
  }
}

/** The app's journal: started at boot; in chapter 3, Lucía's restart the night before (HOST=localhost). */
function bookingJournal(j: Game) {
  const sd = systemd(j);
  if (!sd) return;
  const env = (j.state.bookingEnv ?? {}) as Record<string, string>;
  const show = (b: string) => (b === '*' ? '[::]' : b);
  const line = `booking listening on http://${show(bookingBind(env.HOST))}:${env.PORT ?? 3000} (admin on http://${show(bookingBind(env.ADMIN_HOST))}:${env.ADMIN_PORT ?? 8080})`;
  const entry = (time: number, ident: string, pid: number, message: string) => sd.log.push({ time, boot: sd.boot, unit: 'booking.service', ident, pid, message, priority: 6 });
  if (env.HOST === 'localhost') {
    const at = Date.UTC(2029, 3, 13, 23, 41, 7);
    entry(at, 'systemd', 1, 'Stopping booking.service - Ferry booking app...');
    entry(at + 400, 'systemd', 1, 'Stopped booking.service - Ferry booking app.');
    entry(at + 900, 'systemd', 1, 'Started booking.service - Ferry booking app.');
    entry(at + 1700, 'node', 951, line);
  } else entry(BOOT + 16_000, 'node', 951, line);
  sd.log.sort((a, b) => a.time - b.time);
}

// ——— The world ———

const SITE_V4 = `server {
	listen 80 default_server;
	server_name ${DOMAIN} www.${DOMAIN};

	root /srv/ferry/www;
	index index.html;

	location /booking/ {
		proxy_pass http://127.0.0.1:3000/;
		proxy_set_header Host $host;
		proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
	}
}`;

const bookingEnv = (chapter: ChapterNo) =>
  [
    '# Environment of booking.service (Lucia)',
    chapter === 3 ? '# 2029-04-13: Node.js 22, listen on localhost instead of 127.0.0.1' : '',
    `HOST=${chapter === 3 ? 'localhost' : '127.0.0.1'}`,
    'PORT=3000',
    'ADMIN_PORT=8080',
    'DATABASE_URL=postgres://booking@localhost/ferry',
  ]
    .filter(Boolean)
    .join('\n');

const HOSTS = (t: Translate) =>
  [
    '127.0.0.1\tlocalhost',
    `${QUAY4}\t${machineName(t, 'quay')}.${DOMAIN} ${machineName(t, 'quay')}`,
    `${LOOKOUT4}\t${machineName(t, 'lookout')}.${DOMAIN} ${machineName(t, 'lookout')}`,
    '',
    '# The following lines are desirable for IPv6 capable hosts',
    '::1     localhost ip6-localhost ip6-loopback',
    'ff02::1 ip6-allnodes',
    'ff02::2 ip6-allrouters',
  ].join('\n');

/** quay's world: the system, the site, the app, the zone, and what the chapter adds in the home directory. */
export function ferryWorld(t: Translate, chapter: ChapterNo, home: Record<string, Node>): Directory {
  const root: Rights = { owner: 'root' };
  const place = (children: Parameters<typeof d>[0], rights: Rights = root) => d(children, undefined, rights);
  const file = (text: string, rights: Rights = root) => f(text, { lines: true, ...rights });
  const key = generateKey('ferry-quay', `you@${machineName(t, 'quay')}`);
  const serial = chapter === 1 ? '2029031501' : '2029041001';
  const aaaa = chapter === 1 ? OLD_SLAAC : STATIC;
  return place({
    etc: place({
      ...accountsFiles(),
      hostname: file(machineName(t, 'quay')),
      hosts: file(HOSTS(t)),
      'resolv.conf': file(`search ${DOMAIN}\nnameserver 127.0.0.1`),
      network: place({ interfaces: file(interfacesFile(chapter)), 'interfaces.d': place({}) }),
      'nftables.conf': f(chapter === 3 ? NFTABLES_INET : NFTABLES_IP, { lines: true, owner: 'root', mode: 'rwxr-xr-x' }),
      'sysctl.conf': file('#\n# /etc/sysctl.conf - Configuration file for setting system variables\n# See /etc/sysctl.d/ for additional system variables.\n# See sysctl.conf (5) for information.\n#'),
      'sysctl.d': place({ 'README.sysctl': file('Files in /etc/sysctl.d/ are read by systemd-sysctl and by sysctl --system.\nSee sysctl.d(5).') }),
      default: place({ booking: file(bookingEnv(chapter), { owner: 'root', group: 'booking', mode: 'rw-r-----' }) }),
      bind: place(
        {
          'named.conf': file('include "/etc/bind/named.conf.options";\ninclude "/etc/bind/named.conf.local";\ninclude "/etc/bind/named.conf.default-zones";', { owner: 'root', group: 'bind' }),
          'named.conf.options': file(NAMED_OPTIONS, { owner: 'root', group: 'bind' }),
          'named.conf.local': file(NAMED_CONF_LOCAL, { owner: 'root', group: 'bind' }),
          zones: place({ 'db.ferry.example': file(zoneFile(t, aaaa, serial), { owner: 'root', group: 'bind', mode: 'rw-r--r--' }) }, { owner: 'root', group: 'bind', mode: 'rwxr-sr-x' }),
        },
        { owner: 'root', group: 'bind', mode: 'rwxr-sr-x' },
      ),
      nginx: place({
        'nginx.conf': file(NGINX_CONF),
        'mime.types': file(MIME),
        'conf.d': place({}),
        'modules-enabled': place({}),
        'sites-available': place({ ferry: file(SITE_V4) }),
        'sites-enabled': place({ ferry: f('', { owner: 'root', link: SITE }) }),
      }),
    }),
    home: place({
      you: d({ ...home, '.ssh': d({ id_ed25519: f(key.isPrivate, { lines: true, mode: 'rw-------' }), 'id_ed25519.pub': f(key.isPublic, { lines: true }) }, undefined, { mode: 'rwx------' }) }),
      amaru: place({}, { owner: 'amaru', mode: 'rwx------' }),
    }),
    proc: place({ sys: procSys() }),
    root: place({}, { owner: 'root', mode: 'rwx------' }),
    srv: place({
      ferry: place({ www: place({ 'index.html': file(t('ferry-timetable-page'), { owner: 'www-data', group: 'www-data' }) }) }),
      booking: place({ 'server.js': file("const app = require('express')();\nconst admin = require('./admin');\napp.listen(process.env.PORT, process.env.HOST);\nadmin.listen(process.env.ADMIN_PORT, process.env.ADMIN_HOST);", { owner: 'booking', group: 'booking' }) }, { owner: 'booking', group: 'booking', mode: 'rwxr-x---' }),
    }),
    tmp: place({}, { owner: 'root', mode: 'rwxrwxrwt' }),
    usr: place({ sbin: place({ nginx: f('', { owner: 'root', mode: 'rwxr-xr-x', size: 1_342_520 }) }) }),
    var: place({
      log: place({
        nginx: place(
          {
            'access.log': f('', { lines: true, owner: 'www-data', group: 'adm', mode: 'rw-r-----' }),
            'error.log': f('', { lines: true, owner: 'www-data', group: 'adm', mode: 'rw-r-----' }),
          },
          { owner: 'root', group: 'adm', mode: 'rwxr-xr-x' },
        ),
      }),
    }),
  });
}

// ——— lookout, islenet's monitoring box on the internet ———

export const lookoutAccounts = (): Accounts => ({
  users: { root: { uid: 0, group: 'root', home: '/root' }, you: { uid: 1000, group: 'you' } },
  groups: { root: { gid: 0, members: [] }, sudo: { gid: 27, members: ['you'] }, you: { gid: 1000, members: [] } },
});

export const LOOKOUT_COMMANDS = ['ls', 'cd', 'pwd', 'cat', 'less', 'grep', 'ping', 'ping6', 'curl', 'nc', 'nmap', 'exit'];

export function lookoutHost(now: number, readme: (t: Translate) => string): InternalHost {
  return {
    address: LOOKOUT4,
    domain: `lookout.${DOMAIN}`,
    accounts: lookoutAccounts,
    commands: LOOKOUT_COMMANDS,
    state: (t) => ({
      vantage: { v4: LOOKOUT4, v6: LOOKOUT6 },
      systemd: newSystemd(machineName(t, 'lookout'), now - 30 * 86_400_000, now, {
        ssh: { description: 'OpenBSD Secure Shell server', active: true, executable: 'sshd', process: [{ pid: 588, user: 'root', cpu: 0, mem: 0.2, command: 'sshd: /usr/sbin/sshd -D' }] },
      }),
    }),
    createWorld: (t) => {
      const key = generateKey('ferry-quay', `you@${machineName(t, 'quay')}`);
      const root: Rights = { owner: 'root' };
      const place = (children: Parameters<typeof d>[0], rights: Rights = root) => d(children, undefined, rights);
      return place({
        etc: place({
          ...accountsFiles(),
          hostname: f(machineName(t, 'lookout'), { lines: true, owner: 'root' }),
          hosts: f(`127.0.0.1\tlocalhost\n::1\tlocalhost ip6-localhost ip6-loopback`, { lines: true, owner: 'root' }),
          'resolv.conf': f('nameserver 9.9.9.9\nnameserver 2620:fe::fe', { lines: true, owner: 'root' }),
        }),
        home: place({ you: d({ 'README.txt': f(readme(t)), '.ssh': d({ authorized_keys: f(key.isPublic, { lines: true, mode: 'rw-------' }) }, undefined, { mode: 'rwx------' }) }) }),
        tmp: place({}, { owner: 'root', mode: 'rwxrwxrwt' }),
      });
    },
  };
}

/** lookout, once the player has connected to it (null before). */
export const lookout = (j: Game): Shell | null => (j as Shell).principal.internal('lookout');
/** What lookout last printed (its output and errors). */
export const lookoutSaw = (j: Game) => {
  const l = lookout(j);
  return l ? `${l.last.output}\n${l.last.errors.join('\n')}` : '';
};

// ——— What the chapters check ———

/** quay's global IPv6 addresses now. */
export function globals6(j: Game): string[] {
  sync6(j);
  const l = lan(j)!;
  return addresses6(j, l, l.interfaces.eth0).filter((a) => a.scope === 'global').map((a) => a.cidr.split('/')[0]);
}

/** quay's static (not SLAAC) global addresses now. */
export const statics6 = (j: Game) => (lan(j)!.interfaces.eth0.addresses6 ?? []).filter((a) => !a.startsWith('fe80')).map((a) => a.split('/')[0]);

/** The IPv6 that would come back at boot. */
export const atBoot6 = (j: Game) => boot6(j);

/** IPv6 is off now, or would be at boot (disable_ipv6). */
export const v6Off = (j: Game) =>
  disabled6(j, 'eth0') || sysctlToBoot(j, 'net.ipv6.conf.all.disable_ipv6', '0') === '1' || sysctlToBoot(j, 'net.ipv6.conf.eth0.disable_ipv6', '0') === '1' || sysctlToBoot(j, 'net.ipv6.conf.default.disable_ipv6', '0') === '1';

/** A packet's verdict with a given ruleset (no ruleset loaded: everything passes). */
export function passes(r: Ruleset, p: Package): boolean {
  return traverse(r, 'input', 'filter', p).pass;
}

const tcp = (family: Family, saddr: string, daddr: string, port: number): Package => ({ family: family === 6 ? 'ip6' : 'ip', iif: 'eth0', oif: '', saddr, daddr, proto: 'tcp', sport: 43120, dport: port, ct: 'new', size: 60 });
const nd: Package = { family: 'ip6', iif: 'eth0', oif: '', saddr: ROUTER_LL, daddr: 'ff02::1:ff00:80', proto: 'icmpv6', icmpType: 'nd-neighbor-solicit', sport: 0, dport: 0, ct: 'new', size: 72 };

export interface Audit {
  // Neighbour discovery gets through (IPv6 alive).
  nd: boolean;
  // From the internet, in each family: the ports that pass, and those that would be open (firewall and listener).
  passes: Record<Family, Record<number, boolean>>;
  open: Record<Family, Record<number, boolean>>;
  // The harbour office still reads the database, the workstation still reaches ssh (IPv4).
  office: boolean;
  workstation: boolean;
}

export const PUBLIC_PORTS = [22, 53, 80];
export const PRIVATE_PORTS = [5432, 8080];

/** What the world sees of quay with this ruleset. */
export function audit(j: Game, r: Ruleset): Audit {
  const passesOf = (family: Family) => Object.fromEntries([...PUBLIC_PORTS, ...PRIVATE_PORTS].map((p) => [p, passes(r, tcp(family, family === 6 ? LOOKOUT6 : LOOKOUT4, family === 6 ? STATIC : QUAY4, p))]));
  const p4 = passesOf(4);
  const p6 = passesOf(6);
  const ndOk = passes(r, nd);
  const openOf = (family: Family, pass: Record<number, boolean>) =>
    Object.fromEntries([...PUBLIC_PORTS, ...PRIVATE_PORTS].map((p) => [p, (family === 4 || ndOk) && pass[p] && listens(j, family, family === 6 ? STATIC : QUAY4, p)]));
  return {
    nd: ndOk,
    passes: { 4: p4, 6: p6 },
    open: { 4: openOf(4, p4), 6: openOf(6, p6) },
    office: passes(r, tcp(4, OFFICE, QUAY4, 5432)),
    workstation: passes(r, tcp(4, WORKSTATION.address, QUAY4, 22)),
  };
}

/** The policy Tevita wrote for IPv4, held in both families. */
export function auditOk(a: Audit): boolean {
  return (
    a.nd &&
    a.office &&
    a.workstation &&
    ([4, 6] as Family[]).every((f) => PUBLIC_PORTS.every((p) => a.passes[f][p]) && PRIVATE_PORTS.every((p) => !a.open[f][p]))
  );
}

export const loadedRuleset = (j: Game) => nft(j);
export const bootRuleset = (j: Game) => toBoot(j) ?? { tables: [] };

/** A visit from the internet (lookout's address), without a trace in the logs: the HTTP code, or null if no connection. */
export function visit(j: Game, family: Family, path: string): number | null {
  const client = family === 6 ? LOOKOUT6 : LOOKOUT4;
  const to = family === 6 ? STATIC : QUAY4;
  const a = audit(j, nft(j));
  if (!(family === 4 || a.nd) || !a.passes[family][80] || !listens(j, family, to, 80)) return null;
  return httpRequest(j, `www.${DOMAIN}`, path, 80, false, { address: client, time: systemd(j)?.clock ?? 0, agent: 'curl/8.14.1' })?.code ?? null;
}
