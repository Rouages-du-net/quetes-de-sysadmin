// What the chapters of "The Canteen" share: the neighbourhood's solidarity
// canteen and its server, canteen. Its menu and bookings app (menu, Node.js)
// keeps its data in PostgreSQL, behind nginx. Ibrahim, the coordinator,
// wrote its unit file himself (/etc/systemd/system/menu.service); the other
// units are the packages' (/usr/lib/systemd/system). The machine boots with
// dependencies (units.ts): the order of the services, Restart=, the start
// limit and the timing of the boot are those of its unit files.
// Simplifications: PostgreSQL is a single service (Debian runs it as
// postgresql@17-main.service, behind a postgresql.service that waits for it);
// nginx's configuration is not modelled, nor the app's code.
// Sources: https://www.freedesktop.org/software/systemd/man/latest/systemd.unit.html,
// https://www.freedesktop.org/software/systemd/man/latest/systemd.service.html,
// https://systemd.io/NETWORK_ONLINE/

import { accountsFiles, d, f, name, type Accounts, type Directory, type Rights } from '../world';
import type { Translate } from '../../texts';
import type { Game } from '../shell';
import { newSystemd, readyAt, systemd, type DefinitionService, type Systemd } from '../systemd';
import { bootUnits, crash, loadDependencies } from '../units';
import { loadOverrides, linkConfig, type Link } from '../commands/systemd';
import type { Shell } from '../shell';

export const HOME = '/home/you';
export const PASSWORD = 'lentils-2028';
export const MENU_UNIT = '/etc/systemd/system/menu.service';
export const ENV = '/etc/menu/menu.env';

export const accounts = (): Accounts => ({
  users: {
    root: { uid: 0, group: 'root', home: '/root' },
    'www-data': { uid: 33, group: 'www-data', home: '/var/www', shell: '/usr/sbin/nologin' },
    postgres: { uid: 105, group: 'postgres', home: '/var/lib/postgresql', shell: '/bin/bash' },
    menu: { uid: 999, group: 'menu', home: '/srv/menu', shell: '/usr/sbin/nologin' },
    you: { uid: 1000, group: 'you' },
    ibrahim: { uid: 1001, group: 'ibrahim' },
  },
  groups: {
    root: { gid: 0, members: [] },
    adm: { gid: 4, members: ['you', 'ibrahim'] },
    sudo: { gid: 27, members: ['you', 'ibrahim'] },
    'www-data': { gid: 33, members: [] },
    postgres: { gid: 105, members: [] },
    menu: { gid: 999, members: [] },
    you: { gid: 1000, members: [] },
    ibrahim: { gid: 1001, members: [] },
  },
});

// ——— Unit files ———

export const POSTGRESQL_UNIT = `[Unit]
Description=PostgreSQL database server
After=network.target

[Service]
Type=notify
User=postgres
ExecStart=/usr/lib/postgresql/17/bin/postgres -D /var/lib/postgresql/17/main -c config_file=/etc/postgresql/17/main/postgresql.conf
ExecReload=/bin/kill -HUP $MAINPID
TimeoutStartSec=infinity

[Install]
WantedBy=multi-user.target`;

// Debian's nginx.service: it waits for the network to be "online".
export const NGINX_UNIT = `[Unit]
Description=A high performance web server and a reverse proxy server
Documentation=man:nginx(8)
After=network-online.target remote-fs.target nss-lookup.target
Wants=network-online.target
ConditionFileIsExecutable=/usr/sbin/nginx

[Service]
Type=forking
PIDFile=/run/nginx.pid
ExecStartPre=/usr/sbin/nginx -t -q -g 'daemon on; master_process on;'
ExecStart=/usr/sbin/nginx -g 'daemon on; master_process on;'
ExecReload=/usr/sbin/nginx -g 'daemon on; master_process on;' -s reload
TimeoutStopSec=5
KillMode=mixed

[Install]
WantedBy=multi-user.target`;

export const NETWORKD_UNIT = `[Unit]
Description=Network Configuration
Documentation=man:systemd-networkd.service(8)
Before=network.target

[Service]
Type=notify
ExecStart=/usr/lib/systemd/systemd-networkd
User=systemd-network

[Install]
WantedBy=multi-user.target`;

export const WAIT_ONLINE_UNIT = `[Unit]
Description=Wait for Network to be Configured
Documentation=man:systemd-networkd-wait-online.service(8)
Requires=systemd-networkd.service
After=systemd-networkd.service
Before=network-online.target

[Service]
Type=oneshot
ExecStart=/usr/lib/systemd/systemd-networkd-wait-online
RemainAfterExit=yes

[Install]
WantedBy=network-online.target`;

export const ETH0_NETWORK = `[Match]
Name=eth0

[Network]
Address=192.0.2.26/24
Gateway=192.0.2.1
DNS=192.0.2.1`;

// ——— The services ———

const KERNEL = 'Linux version 6.12.0-quetes (canteen)';
export const START = Date.UTC(2027, 10, 8, 6, 40, 0);

const sd = (j: Game) => systemd(j)!;

/** The app checks its database when it starts: refused if PostgreSQL isn't ready yet. */
function checkMenu(j: Game): string[] | null {
  const port = /^PORT=(.*)$/m.exec(j.read(ENV) ?? '')?.[1]?.trim() ?? '';
  if (!/^\d+$/.test(port) || Number(port) > 65535)
    return [
      `RangeError [ERR_SOCKET_BAD_PORT]: options.port should be >= 0 and < 65536. Received type string ('${port}').`,
      '    at Server.listen (node:net:2048:5)',
    ];
  if (!readyAt(sd(j), 'postgresql', sd(j).clock))
    return ['Error: connect ECONNREFUSED 127.0.0.1:5432', '    at TCPConnectWrap.afterConnect [as oncomplete] (node:net:1611:16)'];
  return null;
}

/** When PostgreSQL stops under the app, the app loses its connection and exits. */
const pgStops = (j: Game) => {
  if (!sd(j).shuttingDown) j.state.pgStoppedAt = sd(j).clock;
  crash(sd(j), 'menu', ['Error: Connection terminated unexpectedly', '    at Connection.<anonymous> (/srv/menu/node_modules/pg/lib/client.js:132:73)']);
};

/** systemd-networkd-wait-online: how long it waits, and whether it gives up (2 min). */
export function waitOnline(j: Game): { ms: number; timeout: boolean } {
  const links = (j.state.links ?? {}) as Record<string, Link>;
  const exec = sd(j).services['systemd-networkd-wait-online']?.execStart ?? '';
  const any = /(^|\s)--any(\s|$)/.test(exec);
  const only = [...exec.matchAll(/(?:--interface=|-i\s+)([\w:]+)/g)].map((m) => m[1].split(':')[0]);
  const waited = Object.entries(links).filter(([n, l]) => l.type !== 'loopback' && (only.length ? only.includes(n) : linkConfig(j as Shell, n)?.required));
  const up = (n: string) => links[n].carrier && !!linkConfig(j as Shell, n);
  const ok = !waited.length || (any ? waited.some(([n]) => up(n)) : waited.every(([n]) => up(n)));
  return ok ? { ms: 1203, timeout: false } : { ms: 120_008, timeout: true };
}

export interface Options {
  // How long PostgreSQL takes to be ready (ms).
  postgres: number;
  // When the machine booted for the last time before the chapter.
  boot: number;
}

/**
 * The machine's services, in this order: the app comes before PostgreSQL,
 * so that when nothing orders them, it starts first (and loses the race).
 */
export function canteenSystemd(t: Translate, o: Options): Systemd {
  const services: Record<string, DefinitionService> = {
    ssh: { description: 'OpenBSD Secure Shell server', active: true, executable: 'sshd', modelled: true, startDuration: 85 },
    'systemd-networkd': {
      description: 'Network Configuration',
      active: true,
      executable: 'systemd-networkd',
      modelled: true,
      startDuration: 104,
      process: [{ pid: 412, user: 'systemd-network', cpu: 0, mem: 0.2, command: '/usr/lib/systemd/systemd-networkd' }],
    },
    'systemd-networkd-wait-online': {
      description: 'Wait for Network to be Configured',
      active: true,
      executable: 'systemd-networkd-wait-online',
      modelled: true,
      activeRest: true,
      startDuration: (j) => waitOnline(j).ms,
      check: (j) => (waitOnline(j).timeout ? ['Timeout occurred while waiting for network connectivity.'] : null),
    },
    menu: {
      description: t('canteen-menu-description'),
      active: true,
      executable: 'node',
      modelled: true,
      startDuration: 512,
      process: [{ pid: 914, user: 'menu', cpu: 0.4, mem: 2.1, command: '/usr/bin/node server.js' }],
      check: checkMenu,
    },
    postgresql: {
      description: 'PostgreSQL database server',
      active: true,
      executable: 'postgres',
      modelled: true,
      startDuration: o.postgres,
      process: [{ pid: 702, user: 'postgres', cpu: 0.1, mem: 1.6, command: '/usr/lib/postgresql/17/bin/postgres -D /var/lib/postgresql/17/main' }],
      stop: pgStops,
    },
    nginx: {
      description: 'A high performance web server and a reverse proxy server',
      active: true,
      executable: 'nginx',
      modelled: true,
      startDuration: 397,
      process: [
        { pid: 801, user: 'root', cpu: 0, mem: 0.3, command: 'nginx: master process /usr/sbin/nginx -g daemon on; master_process on;' },
        { pid: 802, user: 'www-data', cpu: 0.1, mem: 0.5, command: 'nginx: worker process' },
      ],
    },
  };
  const s = newSystemd('canteen', o.boot, o.boot, Object.fromEntries(Object.entries(services).map(([n, x]) => [n, { ...x, state: 'inactive' as const }])));
  s.log = [];
  s.ordered = true;
  s.targets = {
    'network-online.target': { description: 'Network is Online', wants: [], after: ['systemd-networkd-wait-online.service'] },
  };
  return s;
}

/** The first boot of the chapter (this morning's): the units start in the order their files give. */
export function firstBoot(j: Game, now: number) {
  const s = sd(j);
  s.log.push({ time: s.clock, boot: s.boot, unit: '', ident: 'kernel', pid: 0, message: KERNEL, priority: 6 });
  loadOverrides(j as Shell, s);
  loadDependencies(j, s);
  bootUnits(j, s);
  s.checkedAfterBoot = false;
  s.mainAStarted = false;
  s.clock = Math.max(s.clock, now);
}

export const running = (j: Game, n: string) => sd(j).services[n]?.state === 'active';
export const seen = (j: Game, text: string) => j.last.output.includes(text) || j.last.errors.some((e) => e.includes(text));

export function canteenState(t: Translate, o: Options, links: Record<string, Link>) {
  return {
    systemd: canteenSystemd(t, o),
    links,
    process: [{ pid: 1, user: 'root', cpu: 0, mem: 0.1, command: '/sbin/init' }],
    // The app answers on 127.0.0.1:3000 (nginx passes the requests on).
    apps: { '127.0.0.1:3000': { service: 'menu', pages: { '/': t('canteen-menu-page') } } },
  };
}

/** The canteen's machine: the packages' units, Ibrahim's unit and its configuration, the app. */
export function canteenWorld(t: Translate, o: { menuUnit: string; welcome: Record<string, string>; network: Record<string, string>; dropIns?: Record<string, Record<string, string>> }): Directory {
  const root: Rights = { owner: 'root' };
  const directory = (children: Parameters<typeof d>[0], rights: Rights = root) => d(children, undefined, rights);
  const file = (text: string, rights: Rights = root) => f(text, { lines: true, ...rights });
  const units: Record<string, ReturnType<typeof file>> = {
    'postgresql.service': file(POSTGRESQL_UNIT),
    'nginx.service': file(NGINX_UNIT),
    'systemd-networkd.service': file(NETWORKD_UNIT),
    'systemd-networkd-wait-online.service': file(WAIT_ONLINE_UNIT),
  };
  const dropIns = Object.fromEntries(
    Object.entries(o.dropIns ?? {}).map(([u, files]) => [`${u}.d`, directory(Object.fromEntries(Object.entries(files).map(([n, x]) => [n, file(x)])))]),
  );
  return directory({
    etc: directory({
      ...accountsFiles(),
      hostname: file('canteen'),
      menu: directory({ 'menu.env': file(`PORT=3000\nDATABASE_URL=postgres://menu@localhost/${name(t, 'canteen')}`, { owner: 'root', group: 'menu', mode: 'rw-r-----' }) }),
      systemd: directory({
        system: directory({ 'menu.service': file(o.menuUnit), ...dropIns }),
        network: directory(Object.fromEntries(Object.entries(o.network).map(([n, x]) => [n, file(x)]))),
      }),
    }),
    home: directory({
      you: d(Object.fromEntries(Object.entries(o.welcome).map(([n, x]) => [n, f(x)]))),
      ibrahim: directory({}, { owner: 'ibrahim', mode: 'rwx------' }),
    }),
    srv: directory({
      menu: directory(
        { 'server.js': file(t('canteen-server-js'), { owner: 'menu' }), 'package.json': file('{\n  "name": "menu",\n  "version": "2.3.0",\n  "main": "server.js"\n}', { owner: 'menu' }) },
        { owner: 'menu', group: 'menu' },
      ),
    }),
    usr: directory({ lib: directory({ systemd: directory({ system: directory(units) }) }) }),
  });
}
