// Story "The Audit": what its chapters share. The server of
// The Bakery (machine bakery), Nadia's bakery, which takes its orders
// online: an nginx, an orders app (a service account), a PostgreSQL
// database and a Redis. Salomé, an independent auditor, went through the
// server with a fine-tooth comb and left a report: each chapter handles one
// part. The examples stay defensive: read the report, check, repair.

import { d, f, path, accountsFiles, player, account, name, type Accounts, type Directory, type Node } from '../world';
import { generateKey } from '../access';
import { publicKey, storyMachine, machineName } from '../machines';
import { writeLog, systemd, type DefinitionService } from '../systemd';
import { readConfig } from '../sshd';
import type { Game } from '../shell';
import type { Translate } from '../../texts';
import type { ScanState, ScanHost, ServiceScan } from '../scan';
import type { Listening } from '../commands/ss';
import { BASE_INSTALLED, PACKAGES, type AptState } from '../commands/apt';
import { SUDOERS } from './coop';

export const M = '/home/you';
export const PASSWORD = 'flour-2028';
// Tuesday 14 March 2028, 9:30 am.
export const NOW = Date.UTC(2028, 2, 14, 9, 30, 0);
// Some address on the internet (RFC 5737).
export const INTERNET = '198.51.100.23';

// The public keys (fake, with the right form); their comment names a
// machine, in the language (nadia@shop, nadia@boutique).
export const bakeryKeys = (t: Translate) => ({
  nadia: generateKey('audit-nadia', `nadia@${name(t, 'shop')}`).isPublic,
  // A key passing itself off as one of Nadia's: only its fingerprint gives it away.
  unknown: generateKey('audit-unknown', `nadia@${name(t, 'laptop')}`).isPublic,
});

// The orders app: its service account, its systemd service, its PostgreSQL
// role and database, and its folder (/srv/orders) share one name, in the
// language (commandes in French).
export const orders = (t: Translate) => account(t, 'orders');
/** The app's .env (/srv/orders/.env): the database address, with its password. */
export const ordersEnv = (t: Translate, secret: string) =>
  `PORT=3000\nDATABASE_URL=postgres://${orders(t)}:${secret}@localhost:5432/${orders(t)}\nREDIS_URL=redis://localhost:6379`;
/** The orders app's systemd service (run by its account, with node). */
export const ordersService = (t: Translate): DefinitionService => ({
  description: t('audit-orders-description'),
  active: true,
  executable: 'node',
  process: [{ pid: 731, user: orders(t), cpu: 0.8, mem: 3.1, command: `/usr/bin/node ${path(t, '/srv/orders/app/server.js')}` }],
});

// The accounts: Nadia (the manager), Lucas (the intern, gone at the end of February) and
// orders, the app's service account.
export const bakeryAccounts = (withLucas = true): Accounts => {
  const c: Accounts = {
    users: {
      root: { uid: 0, group: 'root', home: '/root' },
      orders: { uid: 997, group: 'orders', home: '/var/lib/orders', shell: '/usr/sbin/nologin' },
      you: { uid: 1000, group: 'you' },
      nadia: { uid: 1001, group: 'nadia' },
      lucas: { uid: 1002, group: 'lucas' },
    },
    groups: {
      root: { gid: 0, members: [] },
      adm: { gid: 4, members: ['you'] },
      sudo: { gid: 27, members: ['you', 'lucas'] },
      orders: { gid: 997, members: ['nadia'] },
      you: { gid: 1000, members: [] },
      nadia: { gid: 1001, members: [] },
      lucas: { gid: 1002, members: [] },
    },
  };
  if (!withLucas) {
    delete c.users.lucas;
    delete c.groups.lucas;
    for (const g of Object.values(c.groups)) g.members = g.members.filter((m) => m !== 'lucas');
  }
  return c;
};

const root = { owner: 'root' };
export const file = (content: string, owner = 'root', mode?: string) => f(content, { lines: true, owner, ...(mode ? { mode } : {}) });

// Debian's sshd_config, as the host left it: root can log in.
export const SSHD_CONFIG = `
# This is the sshd server system-wide configuration file.  See
# sshd_config(5) for more information.

Include /etc/ssh/sshd_config.d/*.conf

#Port 22
PermitRootLogin yes
PasswordAuthentication no
KbdInteractiveAuthentication no

UsePAM yes

X11Forwarding yes
PrintMotd no

# Allow client to pass locale environment variables
AcceptEnv LANG LC_*

# override default of no subsystems
Subsystem	sftp	/usr/lib/openssh/sftp-server
`.trim();

type SshdState = { load: Record<string, string>; connectionsToLoad: number; reloads: number };
export const sshd = (j: Game) => j.state.sshd as SshdState;

/** The ssh service: like Debian's, it checks sshd_config before reloading. */
export const serviceSsh = (): DefinitionService => ({
  description: 'OpenBSD Secure Shell server',
  active: true,
  executable: 'sshd',
  process: [{ pid: 612, user: 'root', cpu: 0, mem: 0.2, command: 'sshd: /usr/sbin/sshd -D [listener] 0 of 10-100 startups' }],
  check: (j) => {
    const e = readConfig(j).errors;
    return e.length ? e : null;
  },
  checkToReload: true,
  load: (j) => {
    const c = sshd(j);
    if (!c) return;
    c.load = readConfig(j).values;
    c.connectionsToLoad = j.state.connections ?? 1;
    c.reloads++;
  },
});

/** At the start of the chapter, sshd runs with the configuration on disk. */
export const loadSshd = (j: Game) => {
  sshd(j).load = readConfig(j).values;
};

/** A line in ssh's log, at the given time (local time read as UTC). */
export const sshLog = (j: Game, timeOfDay: number, pid: number, message: string) => {
  const sd = systemd(j)!;
  const before = sd.clock;
  sd.clock = timeOfDay;
  writeLog(sd, 'ssh.service', 'sshd', pid, message, 6, false);
  sd.clock = before;
};

/** The shared world: /etc (accounts, sudoers, ssh), the home directories, /srv, and what the chapter adds. */
export function bakeryWorld(
  t: Translate,
  o: {
    home: Record<string, Node>;
    homes?: Record<string, Node>;
    etc?: Record<string, Node>;
    sudoersD?: Record<string, Node>;
    ssh?: Record<string, Node>;
    more?: Record<string, Node>;
    // After "The Report": Lucas's account no longer exists.
    withoutLucas?: boolean;
  },
): Directory {
  const bakery = storyMachine('audit')!;
  return d(
    {
      etc: d(
        {
          ...accountsFiles(),
          hostname: file(machineName(t, 'bakery')),
          sudoers: file(SUDOERS, 'root', 'r--r-----'),
          'sudoers.d': d(
            { README: file('# See sudoers(5): files here are read unless their name has a dot or ends in ~.', 'root', 'r--r-----'), ...(o.sudoersD ?? {}) },
            undefined,
            { owner: 'root', mode: 'rwxr-xr-x' },
          ),
          ssh: d({ sshd_config: f(SSHD_CONFIG, { lines: true, owner: 'root' }), ...(o.ssh ?? {}) }, undefined, root),
          ...(o.etc ?? {}),
        },
        undefined,
        root,
      ),
      home: d(
        {
          you: d({
            ...o.home,
            '.ssh': d({ authorized_keys: f(publicKey(bakery, player(t), machineName(t, 'desk')), { lines: true, mode: 'rw-------' }) }, undefined, { mode: 'rwx------' }),
          }),
          nadia: d({}, undefined, { owner: 'nadia', mode: 'rwx------' }),
          ...(o.withoutLucas ? {} : { lucas: d({}, undefined, { owner: 'lucas', mode: 'rwx------' }) }),
          ...(o.homes ?? {}),
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


// ——— The network seen by nmap, and the packages ———

export const SCOPE = ['192.0.2.22'];
// The neighbour's server (a pizzeria), out of scope: its name is translated (neighbour.internal).
export const NEIGHBOUR = { name: 'neighbour.internal', address: '192.0.2.24' };
// The name of an installed package, as the service tells nmap: "Debian 7" then "Debian 7+deb13u1".
const revision = (j: Game) => ((j.state.apt as AptState | undefined)?.installed['openssh-server'] ?? '1:10.0p1-7').split('-').slice(1).join('-');

const SERVICES: ServiceScan[] = [
  { port: 22, service: 'ssh', product: (j) => `OpenSSH 10.0p1 Debian ${revision(j)} (protocol 2.0)` },
  { port: 80, service: 'http', product: 'nginx 1.26.3' },
  { port: 443, service: 'http', ssl: true, product: 'nginx 1.26.3' },
  { port: 3000, service: 'http', product: 'Node.js Express framework' },
  { port: 5432, service: 'postgresql', product: 'PostgreSQL DB 17.0 - 17.2' },
  { port: 6379, service: 'redis', product: 'Redis key-value store 8.0.2' },
];

/** What nmap can probe: the Bakery (its state follows the machine) and the neighbour's server, out of scope. */
export const bakeryScan = (t: Translate): ScanState => {
  const bakery: ScanHost = { address: '192.0.2.22', names: ['bakery.internal', name(t, 'bakery.example'), 'bakery'], local: true, services: SERVICES, latency: 0.011 };
  const neighbour: ScanHost = {
    address: NEIGHBOUR.address,
    names: [name(t, NEIGHBOUR.name)],
    latency: 0.014,
    services: [
      { port: 22, service: 'ssh', product: 'OpenSSH 9.2p1 Debian 2+deb12u3 (protocol 2.0)' },
      { port: 80, service: 'http', product: 'Apache httpd 2.4.62 ((Debian))' },
      { port: 3306, service: 'mysql', product: 'MariaDB 10.11.6' },
    ],
  };
  return { hosts: [bakery, neighbour], scope: [...SCOPE] };
};

/** The listening sockets at the start: everything is open, except the orders app (local). */
export const bakeryListening = (redisLocal = false): Listening[] => [
  { proto: 'tcp', address: '0.0.0.0', port: 22, process: 'sshd', pid: 612 },
  { proto: 'tcp', address: '0.0.0.0', port: 80, process: 'nginx', pid: 701 },
  { proto: 'tcp', address: '0.0.0.0', port: 443, process: 'nginx', pid: 701 },
  { proto: 'tcp', address: '0.0.0.0', port: 5432, process: 'postgres', pid: 744 },
  { proto: 'tcp', address: redisLocal ? '127.0.0.1' : '0.0.0.0', port: 6379, process: 'redis-server', pid: 760 },
  { proto: 'tcp', address: '127.0.0.1', port: 3000, process: 'node', pid: 731 },
];

/** apt's state: the list is up to date; `updates`: the pending security updates. */
export const bakeryApt = (inWaiting: boolean): AptState => ({
  lists: true,
  installed: { ...Object.fromEntries(BASE_INSTALLED.map((p) => [p, PACKAGES[p].version])), nginx: '1.26.3-3+deb13u1', openssl: '3.5.1-1' },
  updates: inWaiting ? { 'openssh-server': '1:10.0p1-7+deb13u1', openssl: '3.5.4-1~deb13u1' } : {},
});

/** A Markdown document written by the player, section by section ("##" headings, read in the game's language: <prefix>-<name>). */
export function sectionsMd(j: Game, text: string, prefix: string, names: string[]): Record<string, string> {
  const titres = Object.fromEntries(names.map((n) => [j.t(`${prefix}-${n}`).toLowerCase(), n]));
  const r: Record<string, string> = {};
  let current = '';
  for (const line of text.split('\n')) {
    const title = /^##\s+(.*)$/.exec(line);
    if (title) {
      current = titres[title[1].trim().toLowerCase()] ?? '';
      continue;
    }
    if (current) r[current] = `${r[current] ?? ''}${line}\n`;
  }
  return r;
}
