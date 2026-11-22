// Story "The Allotments": what its chapters share. The Greenholme Allotments
// Association (les Jardins de Greenholme in French) runs Plotline, the app
// of www.greenholme.example: its members, their plots, the waiting list and
// the bookings of the shared tools and watering slots, in the MariaDB
// database `plots`. Halima chairs the association, Lwazi wrote Plotline,
// Moana is the secretary (she keeps the waiting list), Selin volunteers on
// the computers.
// Machines: trowel (truelle in French, the story's main machine), the
// database server, 192.0.2.131 on the office uplink (RFC 5737) and
// 198.51.100.131 on the back network 198.51.100.0/24; the app ran on shed
// (198.51.100.133) until May 2031, then on barrow (198.51.100.134, an
// internal host in chapter 2); rake (198.51.100.132, an internal host in
// chapter 3) is the replica Moana's reports read. The office PC is
// 198.51.100.150; the internet is 203.0.113.0/24.
// Chapter 1: the connections pile up (wait_timeout) and a slow query without
// index; chapter 2: least privilege and network exposure; chapter 3: a
// stopped replica and a consistent backup.
// Each command lets thirty seconds pass: the app's visits, its connections
// and writes, the replica's threads.
// Sources: https://mariadb.com/kb/en/server-system-variables/,
// https://mariadb.com/kb/en/create-user/, https://mariadb.com/kb/en/grant/,
// https://mariadb.com/kb/en/show-replica-status/, https://mariadb.com/kb/en/mariadb-dump/.

import { accountsFiles, d, f, type Accounts, type Directory, type File, type InternalHost, type Node, type Rights } from '../world';
import type { Game, Shell } from '../shell';
import type { Translate } from '../../texts';
import { newSystemd, systemd, writeLog, type DefinitionService } from '../systemd';
import { generateKey } from '../access';
import { machineName } from '../machines';
import { newFirewall } from '../firewall';
import {
  attachService, authenticate, allowed, connect, disconnect, fileValue, gtid, hasMaria, healthy, isOn, keyIndex, linkOf, maria, newServer, now, positionOf, binlogName, reapIdle, reachable, replicate, socketAuth,
  passwordAuth, startServer, sums, writeRow, machineAt, sourceFor, addressOf, hostMatches,
  type Account, type BinlogEvent, type Cell, type Database, type DbGrant, type MariaState, type Table, type TableGrant, type Column, type Index,
} from '../mariadb';
import { cost, slowLog } from '../mariadb-sql';

export const HOME = '/home/you';
export const PASSWORD = 'compost-heap-17';
export type ChapterNo = 1 | 2 | 3;
export const TROWEL = { office: '192.0.2.131', back: '198.51.100.131' };
export const RAKE = '198.51.100.132';
export const SHED = '198.51.100.133';
export const BARROW = '198.51.100.134';
export const OFFICE_PC = '198.51.100.150';
export const OUTSIDE = '203.0.113.77';
export const SITE = 'www.greenholme.example';
export const DAY = 86_400_000;

// Saturday 10 May 2031, 9:20; Tuesday 20 May, 18:10; Monday 2 June, 8:45.
export const NOW: Record<ChapterNo, number> = { 1: Date.UTC(2031, 4, 10, 9, 20, 0), 2: Date.UTC(2031, 4, 20, 18, 10, 0), 3: Date.UTC(2031, 5, 2, 8, 45, 0) };
const BOOT: Record<ChapterNo, number> = { 1: Date.UTC(2031, 3, 26, 6, 2, 0), 2: Date.UTC(2031, 4, 18, 7, 31, 0), 3: Date.UTC(2031, 4, 18, 7, 31, 0) };

// The database accounts' passwords (the same in every language: they are in configuration files).
export const PLOTLINE_PASSWORD = 'Pl0tline-shed-2027';
export const ROOT_PASSWORD = 'Greenholme!2031';
export const APP_PASSWORD = 'Barrow-app-7rq2';
export const REPL_PASSWORD = 'Rake-repl-4kz9';
export const MOANA_PASSWORD = 'Moana-office-31';
export const ENV = '/srv/plotline/.env';
export const BACKUP_SCRIPT = '/usr/local/sbin/plots-backup';
export const BACKUPS = '/var/backups/mariadb';

// ——— Story state (on trowel) ———

export interface Story {
  chapter: ChapterNo;
  ticks: number;
  // Chapter 1: the app's connections refused (too many), the plot pages served.
  refused: number;
  // When wait_timeout was first brought down at runtime.
  timeoutSetAt?: number;
  // Chapter 2: what the app on barrow got at its last try (ok, or the MariaDB error).
  app?: { ok: boolean; user: string; error?: string; code?: number };
  // Chapter 3: dumps taken while rake was healthy and identical to trowel, restores checked.
  goodDumps: string[];
  checkedDumps: string[];
  restoreOk?: boolean;
}
export const story = (j: Game): Story => (j as Shell).principal.state.allotments as Story;
const principal = (j: Game) => (j as Shell).principal;
/** A machine of the story by name (trowel, barrow, rake). */
export const machine = (j: Game, name: string): Shell => (name === 'trowel' ? principal(j) : (principal(j).internal(name) as Shell));
export const active = (j: Game): Shell => (principal(j).state.lastShell as Shell | undefined) ?? principal(j);
export const typed = (j: Game) => active(j).last.line ?? '';
/** The last command's output contains this (on any machine of the story); reading the manual doesn't count. */
export const seen = (j: Game, text: string | RegExp) => {
  if (/^\s*(man|apropos|whatis|help)\b|--help\b/.test(typed(j))) return false;
  const last = active(j).last;
  const all = `${last.output}\n${last.errors.join('\n')}`;
  return typeof text === 'string' ? all.includes(text) : text.test(all);
};

// ——— The data: invented members, plots, the waiting list, bookings ———

const FIRST = ['Amina', 'Bilal', 'Chen', 'Dagny', 'Emeka', 'Farah', 'Gustavo', 'Hana', 'Ifeoma', 'Jonas', 'Kalani', 'Lena', 'Mateus', 'Nadia', 'Oluwaseun', 'Pita', 'Qiu', 'Rosa', 'Sanjay', 'Tove', 'Umar', 'Valentina', 'Wiremu', 'Ximena', 'Yusuf', 'Zofia', 'Arjun', 'Beatriz', 'Cormac', 'Dilnoza'];
const LAST = ['Diallo', 'Haddad', 'Li', 'Eriksen', 'Okonkwo', 'Rahman', 'Pereira', 'Sato', 'Nwosu', 'Becker', 'Kahale', 'Novak', 'Silva', 'Benali', 'Adeyemi', 'Tane', 'Wang', 'Romero', 'Iyer', 'Lindqvist', 'Farouk', 'Rossi', 'Parata', 'Quispe', 'Demir', 'Kowalski', 'Menon', 'Costa', 'Byrne', 'Yusupova'];
const ITEMS = ['water slot', 'rotavator', 'greenhouse bench', 'shredder', 'trailer', 'water slot', 'water slot'];

// A number from a text, always the same (FNV-1a).
const hash = (s: string) => {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 0x01000193) >>> 0;
  return h;
};
const pad = (n: number) => String(n).padStart(2, '0');
const isoDate = (ms: number) => new Date(ms).toISOString().slice(0, 10);
const isoTime = (ms: number) => `${isoDate(ms)} ${new Date(ms).toISOString().slice(11, 19)}`;
const person = (i: number) => {
  const first = FIRST[i % FIRST.length];
  const last = LAST[(i * 7 + Math.floor(i / FIRST.length)) % LAST.length];
  return { name: `${first} ${last}`, email: `${first.toLowerCase()}.${last.toLowerCase()}@mail.example` };
};

const col = (name: string, type: string, notNull = true, autoIncrement = false): Column => ({ name, type, ...(notNull ? { notNull } : {}), ...(autoIncrement ? { autoIncrement } : {}) });
const pk: Index = { name: 'PRIMARY', columns: ['id'], unique: true };

export const MEMBERS = 140;
export const WAITLIST_FIRST = 1001;
/** The waiting list's rows before the weekend of chapter 3 (ids 1001-1042). */
const WAITING = 42;
export const ESI = { name: 'Esi Boateng', email: 'esi.boateng@mail.example' };
export const WAIRIMU = { name: 'Wairimu Njoroge', email: 'wairimu.njoroge@mail.example' };

/** The database plots at a chapter's start, before chapter 3's weekend (base tables). */
export function plotsDatabase(n: ChapterNo): Database {
  const members: Cell[][] = [];
  for (let i = 0; i < MEMBERS; i++) {
    const p = person(i);
    members.push([String(i + 1), p.name, p.email, isoDate(Date.UTC(2015 + (i % 16), hash(`m${i}`) % 12, 1 + (hash(`d${i}`) % 27)))]);
  }
  const plots: Cell[][] = [];
  for (let i = 0; i < 120; i++) plots.push([String(i + 1), `${'ABCDEF'[Math.floor(i / 20)]}${(i % 20) + 1}`, hash(`s${i}`) % 3 === 0 ? '125' : '250', String(1 + (hash(`h${i}`) % MEMBERS))]);
  const waitlist: Cell[][] = [];
  const waiting = n === 1 ? 30 : n === 2 ? 36 : WAITING;
  for (let i = 0; i < waiting; i++) {
    const p = person(200 + i * 3);
    waitlist.push([String(WAITLIST_FIRST + i), p.name, p.email, hash(`w${i}`) % 2 ? 'half' : 'full', isoDate(Date.UTC(2029, 0, 10) + i * 13 * DAY)]);
  }
  const bookings: Cell[][] = [];
  const start = n === 3 ? Date.UTC(2031, 4, 1, 6, 0, 0) : Date.UTC(2031, 3, 1, 6, 0, 0);
  for (let i = 0; i < 320; i++) {
    const plot = 1 + (i % 40);
    bookings.push([String((n === 3 ? 1_840_000 : 1_833_000) + i), String(plot), String(1 + (hash(`b${i}`) % MEMBERS)), ITEMS[hash(`i${i}`) % ITEMS.length], isoTime(start + Math.floor(i / 2) * 3 * 3_600_000)]);
  }
  const bookingsIndexes: Index[] = n === 1 ? [pk] : [pk, { name: 'idx_plot', columns: ['plot_id'] }];
  return {
    tables: {
      members: { columns: [col('id', 'int(11)', true, true), col('name', 'varchar(80)'), col('email', 'varchar(120)'), col('joined_on', 'date')], rows: members, indexes: [pk], autoIncrement: MEMBERS + 1 },
      plots: { columns: [col('id', 'int(11)', true, true), col('label', 'varchar(8)'), col('size_m2', 'int(11)'), col('member_id', 'int(11)', false)], rows: plots, indexes: [pk], autoIncrement: 121 },
      waitlist: { columns: [col('id', 'int(11)', true, true), col('name', 'varchar(80)'), col('email', 'varchar(120)'), col('wants', 'varchar(8)'), col('added_on', 'date')], rows: waitlist, indexes: [pk], autoIncrement: WAITLIST_FIRST + waiting },
      bookings: {
        columns: [col('id', 'int(11)', true, true), col('plot_id', 'int(11)'), col('member_id', 'int(11)'), col('item', 'varchar(40)'), col('starts_on', 'datetime')],
        rows: bookings,
        indexes: bookingsIndexes,
        autoIncrement: Number(bookings.at(-1)![0]) + 1,
        ...(n === 3 ? {} : { declared: 1_834_212 }),
      },
    },
  };
}

/** The app's tables and what it does on each (the checks of chapter 2). */
export const APP_NEEDS: [string, string][] = [
  ['SELECT', 'members'], ['SELECT', 'plots'], ['SELECT', 'waitlist'], ['SELECT', 'bookings'],
  ['INSERT', 'bookings'], ['DELETE', 'bookings'], ['INSERT', 'waitlist'], ['UPDATE', 'waitlist'], ['DELETE', 'waitlist'], ['UPDATE', 'members'], ['UPDATE', 'plots'],
];
/** What an app account may have on plots, at most (least privilege). */
export const APP_ALLOWED = ['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'EXECUTE', 'CREATE TEMPORARY TABLES', 'LOCK TABLES', 'SHOW VIEW'];

// ——— Accounts ———

const sysAccounts = (): Account[] => [
  { user: 'mariadb.sys', host: 'localhost', auth: [{ plugin: 'mysql_native_password', hash: '' }], global: [], locked: true },
  { user: 'root', host: 'localhost', auth: socketAuth(), global: ['ALL PRIVILEGES'], grantOption: true },
  { user: 'mysql', host: 'localhost', auth: socketAuth(), global: ['ALL PRIVILEGES'], grantOption: true },
];
const APP_PRIVS = ['SELECT', 'INSERT', 'UPDATE', 'DELETE'];

function accountsOf(n: ChapterNo, host: 'trowel' | 'rake'): { accounts: Account[]; dbGrants: DbGrant[]; tableGrants: TableGrant[] } {
  const accounts = sysAccounts();
  const dbGrants: DbGrant[] = [];
  const tableGrants: TableGrant[] = [];
  if (n === 1) {
    accounts.push({ user: 'plotline', host: SHED, auth: passwordAuth(PLOTLINE_PASSWORD), global: [] });
    dbGrants.push({ user: 'plotline', host: SHED, db: 'plots', privs: [...APP_PRIVS] });
  } else if (n === 2) {
    accounts.push(
      { user: 'plotline', host: SHED, auth: passwordAuth(PLOTLINE_PASSWORD), global: [] },
      { user: 'root', host: '%', auth: passwordAuth(ROOT_PASSWORD), global: ['ALL PRIVILEGES'], grantOption: true },
      { user: '', host: 'localhost', auth: [{ plugin: 'mysql_native_password', hash: '' }], global: [] },
      { user: '', host: 'trowel', auth: [{ plugin: 'mysql_native_password', hash: '' }], global: [] },
    );
    dbGrants.push(
      { user: 'plotline', host: SHED, db: 'plots', privs: [...APP_PRIVS] },
      { user: '', host: '%', db: 'test', privs: ['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'CREATE', 'DROP', 'INDEX', 'ALTER', 'CREATE TEMPORARY TABLES', 'LOCK TABLES'] },
      { user: '', host: '%', db: 'test\\_%', privs: ['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'CREATE', 'DROP', 'INDEX', 'ALTER', 'CREATE TEMPORARY TABLES', 'LOCK TABLES'] },
    );
  } else {
    accounts.push(
      { user: 'app', host: BARROW, auth: passwordAuth(APP_PASSWORD), global: [] },
      { user: 'repl', host: RAKE, auth: passwordAuth(REPL_PASSWORD), global: ['REPLICATION SLAVE'] },
      { user: 'moana', host: OFFICE_PC, auth: passwordAuth(MOANA_PASSWORD), global: [] },
    );
    dbGrants.push({ user: 'app', host: BARROW, db: 'plots', privs: [...APP_PRIVS] }, { user: 'moana', host: OFFICE_PC, db: 'plots', privs: ['SELECT'] });
    tableGrants.push({ user: 'moana', host: OFFICE_PC, db: 'plots', table: 'waitlist', privs: ['INSERT', 'UPDATE'] });
  }
  void host;
  return { accounts, dbGrants, tableGrants };
}

// ——— Configuration files ———

export const MY_CNF_TEXT = `# The MariaDB configuration file
#
# The MariaDB/MySQL tools read configuration files in the following order:
# 0. "/etc/mysql/my.cnf" symlinks to this file, reason why all the rest is read.
# 1. "/etc/mysql/mariadb.cnf" (this file) to set global defaults,
# 2. "/etc/mysql/conf.d/*.cnf" to set global options.
# 3. "/etc/mysql/mariadb.conf.d/*.cnf" to set MariaDB-only options.
# 4. "~/.my.cnf" to set user-specific options.
#
# If the same option is defined multiple times, the last one will apply.
#
# One can use all long options that the program supports.
# Run program with --help to get a list of available options and with
# --print-defaults to see which it would actually understand and use.
#
# If you are new to MariaDB, check out https://mariadb.com/kb/en/basic-mariadb-articles/

#
# This group is read both by the client and the server
# use it for options that affect everything
#
[client-server]
# Port or socket location where to connect
# port = 3306
socket = /run/mysqld/mysqld.sock

# Import all .cnf files from configuration directory
!includedir /etc/mysql/conf.d/
!includedir /etc/mysql/mariadb.conf.d/`;

const CLIENT_CNF = `#
# This group is read by the client library
# Use it for options that affect all clients, but not the server
#

[client]
# Example of client certificate usage
#ssl-cert = /etc/mysql/client-cert.pem
#ssl-key  = /etc/mysql/client-key.pem
#
# Allow only TLS encrypted connections
#ssl-verify-server-cert = on

# This group is *never* read by mysql client library, though this
# /etc/mysql/mariadb.cnf.d/client.cnf file is not read by Oracle MySQL
# client anyway.
# If you use the same .cnf file for MySQL and MariaDB,
# use it for MariaDB-only client options
[client-mariadb]`;

interface ServerCnf {
  bind: string;
  skipNameResolve?: boolean;
  extra?: string[];
}

/** Debian's 50-server.cnf, with the story's changes. */
export function serverCnf(o: ServerCnf): string {
  return `#
# These groups are read by MariaDB server.
# Use it for options that only the server (but not clients) should see

# this is read by the standalone daemon and embedded servers
[server]

# this is only for the mariadbd daemon
[mariadbd]

#
# * Basic Settings
#

#user                    = mysql
pid-file                = /run/mysqld/mysqld.pid
basedir                 = /usr
#datadir                 = /var/lib/mysql
#tmpdir                  = /tmp

# Broken reverse DNS slows down connections considerably and name resolve is
# safe to skip if there are no "host by domain name" access grants
${o.skipNameResolve ? '' : '#'}skip-name-resolve

# Instead of skip-networking the default is now to listen only on
# localhost which is more compatible and is not less secure.
bind-address            = ${o.bind}

#
# * Fine Tuning
#

#key_buffer_size        = 128M
#max_allowed_packet     = 1G
#thread_stack           = 192K
#thread_cache_size      = 8
# This replaces the startup script and checks MyISAM tables if needed
# the first time they are touched
#myisam_recover_options = BACKUP
#max_connections        = 100
#table_cache            = 64

#
# * Logging and Replication
#

# Note: The configured log file or its directory need to be created
# and be writable by the mysql user, e.g.:
# $ sudo mkdir -m 2750 /var/log/mysql
# $ sudo chown mysql /var/log/mysql

# Both location gets rotated by the cronjob.
# Be aware that this log type is a performance killer.
# Recommend only changing this at runtime for short testing periods if needed!
#general_log_file       = /var/log/mysql/mysql.log
#general_log            = 1

# When running under systemd, error logging goes via stdout/stderr to journald
# and when running legacy init error logging goes to syslog due to
# /etc/mysql/conf.d/mariadb.conf.d/50-mysqld_safe.cnf
# Enable this if you want to have error logging into a separate file
#log_error = /var/log/mysql/error.log
# Enable the slow query log to see queries with especially long duration
#log_slow_query_file    = /var/log/mysql/mariadb-slow.log
#log_slow_query_time    = 10
#log_slow_verbosity     = query_plan,explain
#log-queries-not-using-indexes
#log_slow_min_examined_row_limit = 1000

# The following can be used as easy to replay backup logs or for replication.
# note: if you are setting up a replica, see README.Debian about other
#       settings you may need to change.
#server-id              = 1
#log_bin                = /var/log/mysql/mysql-bin.log
expire_logs_days        = 10
#max_binlog_size        = 100M

#
# * SSL/TLS
#

# For documentation, please read
# https://mariadb.com/kb/en/securing-connections-for-client-and-server/
#ssl-ca = /etc/mysql/cacert.pem
#ssl-cert = /etc/mysql/server-cert.pem
#ssl-key = /etc/mysql/server-key.pem
#require-secure-transport = on

#
# * Character sets
#

# MySQL/MariaDB default is Latin1, but in Debian we rather default to the full
# utf8 4-byte character set. See also client.cnf
character-set-server     = utf8mb4
character-set-collations = utf8mb4=uca1400_ai_ci

#
# * InnoDB
#

# InnoDB is enabled by default with a 10MB datafile in /var/lib/mysql/.
# Read the manual for more InnoDB related options. There are many!
# Most important is to give InnoDB 80 % of the system RAM for buffer use:
# https://mariadb.com/kb/en/innodb-system-variables/#innodb_buffer_pool_size
#innodb_buffer_pool_size = 8G
${(o.extra ?? []).length ? `\n${o.extra!.join('\n')}\n` : ''}
# this is only for embedded server
[embedded]

# This group is only read by MariaDB servers, not by MySQL.
# If you use the same .cnf file for MySQL and MariaDB,
# you can put MariaDB-only options here
[mariadb]

# This group is only read by MariaDB-11.8 servers.
# If you use the same .cnf file for MariaDB of different versions,
# use this group for options that older servers don't understand
[mariadb-11.8]`;
}

const trowelCnf = (n: ChapterNo) =>
  serverCnf(
    n === 1
      ? { bind: TROWEL.back, skipNameResolve: true, extra: ['# Plotline (Lwazi, 2027): the app runs on shed.', 'innodb_buffer_pool_size = 2G'] }
      : n === 2
        ? { bind: '0.0.0.0', skipNameResolve: true, extra: ['# Plotline (Lwazi, 2027)', 'innodb_buffer_pool_size = 2G', 'wait_timeout            = 600', '', '# Lwazi, 18 May: "barrow couldn\'t connect", listen everywhere for now', '# bind-address was 198.51.100.131'] }
        : {
            bind: TROWEL.back,
            skipNameResolve: true,
            extra: ['# Plotline (Lwazi, 2027)', 'innodb_buffer_pool_size = 2G', 'wait_timeout            = 600', '', '# Replication: trowel is the primary, rake the replica (Lwazi, April 2031)', 'server-id               = 1', 'log_bin                 = /var/log/mysql/mariadb-bin', 'binlog_format           = ROW'],
          },
  );

const RAKE_CNF = serverCnf({
  bind: RAKE,
  skipNameResolve: true,
  extra: ['innodb_buffer_pool_size = 1G', 'wait_timeout            = 600', '', "# Replication: rake is trowel's replica, for Moana's reports (Lwazi, April 2031)", 'server-id               = 2', 'relay_log               = /var/log/mysql/rake-relay-bin', '#read_only               = ON'],
});

// ——— The machines ———

const root: Rights = { owner: 'root' };
const dir = (children: Record<string, Node>, rights: Rights = root) => d(children, undefined, rights);
const file = (text: string, rights: Rights = root): File => f(text, { lines: true, ...rights });
const proc = (pid: number, user: string, command: string) => ({ pid, user, cpu: 0, mem: 0.4, command });

const mariadbService = (): DefinitionService => ({
  description: 'MariaDB 11.8.9 database server',
  active: true,
  executable: 'mariadbd',
  aliases: ['mysql', 'mysqld'],
  process: [proc(4137, 'mysql', '/usr/sbin/mariadbd')],
});

const dbAccounts = (extra: Accounts['users'] = {}, groups: Accounts['groups'] = {}): Accounts => ({
  users: { root: { uid: 0, group: 'root', home: '/root' }, mysql: { uid: 104, group: 'mysql', home: '/nonexistent', shell: '/bin/false' }, you: { uid: 1000, group: 'you' }, ...extra },
  groups: { root: { gid: 0, members: [] }, adm: { gid: 4, members: ['you'] }, sudo: { gid: 27, members: ['you'] }, mysql: { gid: 109, members: [] }, you: { gid: 1000, members: [] }, ...groups },
});
export const trowelAccounts = () => dbAccounts();

const lan = (addresses: Record<string, string>) => ({
  interfaces: {
    lo: { name: 'lo', up: true, addresses: ['127.0.0.1/8'], mac: '00:00:00:00:00:00', addresses6: ['::1/128'] },
    ...Object.fromEntries(Object.entries(addresses).map(([n, a], k) => [n, { name: n, up: true, addresses: [`${a}/24`], mac: `52:54:00:3a:${pad(k)}:${a.split('.')[3].slice(-2).padStart(2, '0')}` }])),
  },
  gateway: null,
  trunk: '',
  vlans: [],
  devices: [],
  order: ['lo', ...Object.keys(addresses)],
});

const hostsFile = (own: string, ownAddress: string) =>
  `127.0.0.1\tlocalhost\n${ownAddress}\t${own}.internal ${own}\n${TROWEL.back}\ttrowel.internal trowel\n${RAKE}\trake.internal rake\n${BARROW}\tbarrow.internal barrow\n${SHED}\tshed.internal shed\n\n::1\tlocalhost ip6-localhost ip6-loopback`;

const mysqlDirs = (n: ChapterNo, slow: Record<string, Node> = {}): Record<string, Node> => ({
  log: dir({ mysql: dir({ ...slow }, { owner: 'mysql', group: 'adm', mode: 'rwxr-s---' }) }),
});

/** The server model at a chapter's start (running: started by initialise). */
function serverState(n: ChapterNo, host: 'trowel' | 'rake'): MariaState {
  const acc = accountsOf(n, host);
  return newServer({ databases: { plots: plotsDatabase(n), ...(n === 2 && host === 'trowel' ? { test: { tables: {} } } : {}) }, ...acc, binlogFile: 127 });
}

export function trowelState(t: Translate, n: ChapterNo) {
  const services: Record<string, DefinitionService> = {
    ssh: { description: 'OpenBSD Secure Shell server', active: true, executable: 'sshd', process: [proc(611, 'root', 'sshd: /usr/sbin/sshd -D [listener] 0 of 10-100 startups')] },
    cron: { description: 'Regular background program processing daemon', active: true, executable: 'cron', process: [proc(598, 'root', '/usr/sbin/cron -f')] },
    mariadb: mariadbService(),
  };
  return {
    systemd: newSystemd(machineName(t, 'trowel'), BOOT[n], NOW[n], services),
    mariadb: serverState(n, 'trowel'),
    ufw: newFirewall(),
    baseLan: lan({ eth0: TROWEL.office, eth1: TROWEL.back }),
    listening: [{ proto: 'tcp', address: '0.0.0.0', port: 22, process: 'sshd', pid: 611 }],
    apt: { installed: { 'mariadb-server': '1:11.8.9+ds-0+deb13u1', 'mariadb-client': '1:11.8.9+ds-0+deb13u1', 'mariadb-client-compat': '1:11.8.9+ds-0+deb13u1', 'mariadb-common': '1:11.8.9+ds-0+deb13u1' } },
    mounts: [{ path: '/', capacity: 120 * 1024 ** 3, name: '/dev/vda1', system: 'ext4' }],
  };
}

export function trowelWorld(t: Translate, n: ChapterNo, home: Record<string, Node>): Directory {
  const host = machineName(t, 'trowel');
  const key = generateKey('allotments-trowel', `you@${host}`);
  return dir({
    etc: dir({
      ...accountsFiles(),
      hostname: file(host),
      hosts: file(hostsFile(host, TROWEL.back)),
      mysql: dir({
        'my.cnf': file(MY_CNF_TEXT),
        'mariadb.cnf': file(MY_CNF_TEXT),
        'conf.d': dir({}),
        'mariadb.conf.d': dir({ '50-client.cnf': file(CLIENT_CNF), '50-server.cnf': file(trowelCnf(n)) }),
        'debian-start': file('#!/bin/bash\n# Checks the tables after a start (Debian).', { owner: 'root', mode: 'rwxr-xr-x' }),
      }),
    }),
    home: dir({
      you: d({
        ...home,
        '.ssh': d({ id_ed25519: f(key.isPrivate, { lines: true, mode: 'rw-------' }), 'id_ed25519.pub': f(key.isPublic, { lines: true }) }, undefined, { mode: 'rwx------' }),
      }),
    }),
    root: dir({}, { owner: 'root', mode: 'rwx------' }),
    run: dir({ mysqld: dir({ 'mysqld.sock': f('', { owner: 'mysql', group: 'mysql', mode: 'rwxrwxrwx' }) }, { owner: 'mysql', group: 'root', mode: 'rwxr-xr-x' }) }),
    tmp: dir({}, { owner: 'root', mode: 'rwxrwxrwt' }),
    var: dir({ lib: dir({ mysql: dir({ plots: dir({}, { owner: 'mysql', mode: 'rwx------' }) }, { owner: 'mysql', group: 'mysql', mode: 'rwxr-xr-x' }) }), ...mysqlDirs(n) }),
  });
}

// ——— barrow, the app's server (chapter 2) ———

export const ENV_TEXT = `# Plotline settings (Lwazi). Read when the plotline service starts.
APP_ENV=production
SITE=${SITE}
DB_HOST=${TROWEL.back}
DB_PORT=3306
DB_NAME=plots
DB_USER=root
DB_PASSWORD=${ROOT_PASSWORD}`;

/** The settings of a .env file (KEY=value). */
export const readEnv = (text: string | null): Record<string, string> =>
  Object.fromEntries((text ?? '').split('\n').map((l) => /^\s*([A-Z_]+)\s*=\s*(.*?)\s*$/.exec(l)).filter((m): m is RegExpExecArray => !!m).map((m) => [m[1], m[2].replace(/^(['"])(.*)\1$/, '$2')]));

const APP_COMMANDS_BARROW = ['ls', 'cd', 'pwd', 'cat', 'less', 'head', 'tail', 'grep', 'nano', 'sudo', 'echo', 'exit', 'man', 'ssh', 'ps', 'systemctl', 'journalctl', 'ss', 'ip', 'chmod', 'chown', 'mariadb', 'mysql', 'mariadb-admin', 'mysqladmin'];

export function barrowHost(): InternalHost {
  return {
    address: BARROW,
    domain: 'barrow.internal',
    accounts: () => dbAccounts({ plotline: { uid: 998, group: 'plotline', home: '/srv/plotline', shell: '/usr/sbin/nologin' } }, { plotline: { gid: 998, members: [] } }),
    commands: APP_COMMANDS_BARROW,
    state: (t) => ({
      systemd: newSystemd('barrow', BOOT[2], NOW[2], {
        ssh: { description: 'OpenBSD Secure Shell server', active: true, executable: 'sshd', process: [proc(588, 'root', 'sshd: /usr/sbin/sshd -D')] },
        plotline: { description: 'Plotline, the allotments booking app (gunicorn)', active: true, executable: 'gunicorn', process: [proc(902, 'plotline', '/srv/plotline/venv/bin/python3 /srv/plotline/venv/bin/gunicorn -b 0.0.0.0:8000 plotline.wsgi')] },
      }),
      baseLan: lan({ eth0: BARROW }),
      listening: [{ proto: 'tcp', address: '0.0.0.0', port: 22, process: 'sshd', pid: 588 }, { proto: 'tcp', address: '0.0.0.0', port: 8000, process: 'gunicorn', pid: 902 }],
      apt: { installed: { 'mariadb-client': '1:11.8.9+ds-0+deb13u1', 'mariadb-common': '1:11.8.9+ds-0+deb13u1' } },
      language: t.language,
    }),
    createWorld: (t) => {
      const key = generateKey('allotments-trowel', `you@${machineName(t, 'trowel')}`);
      return dir({
        etc: dir({ ...accountsFiles(), hostname: file('barrow'), hosts: file(hostsFile('barrow', BARROW)), mysql: dir({ 'my.cnf': file(MY_CNF_TEXT), 'conf.d': dir({}), 'mariadb.conf.d': dir({ '50-client.cnf': file(CLIENT_CNF) }) }) }),
        srv: dir({ plotline: dir({ '.env': file(ENV_TEXT, { owner: 'plotline', group: 'plotline', mode: 'rw-r--r--' }), 'README.txt': file(t('allotments-plotline-readme'), { owner: 'plotline', group: 'plotline' }) }, { owner: 'plotline', group: 'plotline', mode: 'rwxr-xr-x' }) }),
        var: dir({ log: dir({ plotline: dir({ 'app.log': file(`2031-05-18 07:40:02 INFO plotline: started, 4 workers\n2031-05-18 07:40:03 ERROR plotline.db: (1130, "Host '${BARROW}' is not allowed to connect to this MariaDB server")\n2031-05-18 08:02:41 INFO plotline: started, 4 workers\n2031-05-18 08:02:42 INFO plotline.db: connected to ${TROWEL.back}:3306 as root`, { owner: 'plotline', group: 'adm', mode: 'rw-r-----' }) }, { owner: 'plotline', group: 'adm', mode: 'rwxr-x---' }) }) }),
        home: dir({ you: d({ '.ssh': d({ authorized_keys: f(key.isPublic, { lines: true, mode: 'rw-------' }) }, undefined, { mode: 'rwx------' }) }) }),
        root: dir({}, { owner: 'root', mode: 'rwx------' }),
        tmp: dir({}, { owner: 'root', mode: 'rwxrwxrwt' }),
      });
    },
    initialise: (s) => {
      const svc = systemd(s)!.services.plotline;
      const load = (g: Game) => {
        g.state.plotlineEnv = readEnv(g.read(ENV));
      };
      svc.check = (g) => (g.read(ENV) === null ? [`FileNotFoundError: [Errno 2] No such file or directory: '${ENV}'`] : null);
      svc.load = load;
      svc.stop = (g) => {
        g.state.plotlineEnv = null;
      };
      load(s);
    },
    beforeCommand: (s) => {
      principal(s).state.lastShell = s;
    },
    afterCommand: (s) => passTime(s),
  };
}

// ——— rake, the replica (chapter 3) ———

const RAKE_COMMANDS = [
  'ls', 'cd', 'pwd', 'cat', 'less', 'head', 'tail', 'grep', 'wc', 'diff', 'nano', 'sudo', 'echo', 'exit', 'man', 'ssh', 'ps', 'systemctl', 'journalctl', 'ss', 'sh', 'date', 'find', 'cp', 'rm', 'mv', 'mkdir',
  'mariadb', 'mysql', 'mariadb-admin', 'mysqladmin', 'mariadb-dump', 'mysqldump', 'mariadb-check', 'mysqlcheck', 'sha256sum',
];

export const BACKUP_SCRIPT_TEXT = `#!/bin/sh
# Nightly dump of the plots database, taken on the replica so that the site
# never waits for it (Lwazi, April 2031). Run by /etc/cron.d/plots-backup.
# --skip-lock-tables: the default locks stopped replication for the whole dump.
set -e
DEST=${BACKUPS}
mariadb-dump --skip-lock-tables plots > "$DEST/plots-$(date +%F).sql"
find "$DEST" -name 'plots-*.sql' -mtime +14 -delete`;

export function rakeHost(): InternalHost {
  return {
    address: RAKE,
    domain: 'rake.internal',
    accounts: () => dbAccounts(),
    commands: RAKE_COMMANDS,
    state: (t) => ({
      systemd: newSystemd('rake', BOOT[3], NOW[3], {
        ssh: { description: 'OpenBSD Secure Shell server', active: true, executable: 'sshd', process: [proc(588, 'root', 'sshd: /usr/sbin/sshd -D')] },
        cron: { description: 'Regular background program processing daemon', active: true, executable: 'cron', process: [proc(571, 'root', '/usr/sbin/cron -f')] },
        mariadb: mariadbService(),
      }),
      mariadb: serverState(3, 'rake'),
      baseLan: lan({ eth0: RAKE }),
      listening: [{ proto: 'tcp', address: '0.0.0.0', port: 22, process: 'sshd', pid: 588 }],
      apt: { installed: { 'mariadb-server': '1:11.8.9+ds-0+deb13u1', 'mariadb-client': '1:11.8.9+ds-0+deb13u1', 'mariadb-client-compat': '1:11.8.9+ds-0+deb13u1', 'mariadb-common': '1:11.8.9+ds-0+deb13u1' } },
      language: t.language,
    }),
    createWorld: (t) => {
      const key = generateKey('allotments-trowel', `you@${machineName(t, 'trowel')}`);
      return dir({
        etc: dir({
          ...accountsFiles(),
          hostname: file('rake'),
          hosts: file(hostsFile('rake', RAKE)),
          mysql: dir({ 'my.cnf': file(MY_CNF_TEXT), 'mariadb.cnf': file(MY_CNF_TEXT), 'conf.d': dir({}), 'mariadb.conf.d': dir({ '50-client.cnf': file(CLIENT_CNF), '50-server.cnf': file(RAKE_CNF) }) }),
          'cron.d': dir({ 'plots-backup': file(`# The plots database's nightly dump (Lwazi)\nSHELL=/bin/sh\nPATH=/usr/local/sbin:/usr/local/bin:/sbin:/bin:/usr/sbin:/usr/bin\n30 2 * * * root ${BACKUP_SCRIPT}`) }),
        }),
        usr: dir({ local: dir({ sbin: dir({ 'plots-backup': file(BACKUP_SCRIPT_TEXT, { owner: 'root', mode: 'rwxr-xr-x' }) }) }) }),
        var: dir({
          backups: dir({ mariadb: dir({}, { owner: 'root', mode: 'rwx------' }) }),
          lib: dir({ mysql: dir({ plots: dir({}, { owner: 'mysql', mode: 'rwx------' }) }, { owner: 'mysql', group: 'mysql', mode: 'rwxr-xr-x' }) }),
          log: dir({ mysql: dir({}, { owner: 'mysql', group: 'adm', mode: 'rwxr-s---' }) }),
        }),
        run: dir({ mysqld: dir({ 'mysqld.sock': f('', { owner: 'mysql', group: 'mysql', mode: 'rwxrwxrwx' }) }, { owner: 'mysql', group: 'root', mode: 'rwxr-xr-x' }) }),
        home: dir({ you: d({ '.ssh': d({ authorized_keys: f(key.isPublic, { lines: true, mode: 'rw-------' }) }, undefined, { mode: 'rwx------' }) }) }),
        root: dir({}, { owner: 'root', mode: 'rwx------' }),
        tmp: dir({}, { owner: 'root', mode: 'rwxrwxrwt' }),
      });
    },
    beforeCommand: (s) => {
      principal(s).state.lastShell = s;
    },
    afterCommand: (s) => passTime(s),
  };
}

// ——— Starting a chapter ———

/** The story's network for the MariaDB clients (names and addresses). */
const mariaNet = (t: Translate) => ({
  main: 'trowel',
  hosts: {
    trowel: { addresses: [TROWEL.back, TROWEL.office, '127.0.0.1'], names: ['trowel', 'trowel.internal', machineName(t, 'trowel'), `${machineName(t, 'trowel')}.internal`] },
    rake: { addresses: [RAKE], names: ['rake', 'rake.internal'] },
    barrow: { addresses: [BARROW], names: ['barrow', 'barrow.internal'] },
  },
});

/** The app's connections on shed in chapter 1: sleeping for hours, never closed (the leak). */
function leakedConnections(j: Game, count: number) {
  const s = maria(j);
  const t = now(j);
  for (let k = 0; k < count; k++) {
    const c = connect(j, { host: SHED, user: 'plotline', password: PLOTLINE_PASSWORD, osUser: '' }, 'app', 'plots');
    if ('code' in c) break;
    c.since = t - (count - k) * 47_000 - 90_000;
  }
  void s;
}

/** The weekend of chapter 3: what trowel received since Saturday 18:00, what rake applied, Moana's row on rake. */
function weekend(p: Shell, rake: Shell) {
  const ps = maria(p);
  const rs = maria(rake);
  ps.seq = 48_210;
  rs.seq = 0;
  const events: Omit<BinlogEvent, 'seq'>[] = [];
  const sat = Date.UTC(2031, 4, 31, 18, 0, 0);
  const booking = (k: number, at: number): Omit<BinlogEvent, 'seq'> => {
    const id = String(1_840_320 + k);
    return { time: at, db: 'plots', table: 'bookings', op: 'insert', row: [id, String(1 + (hash(`wb${k}`) % 40)), String(1 + (hash(`wm${k}`) % MEMBERS)), ITEMS[hash(`wi${k}`) % ITEMS.length], isoTime(at + 2 * DAY)], key: id };
  };
  for (let k = 0; k < 6; k++) events.push(booking(k, sat + k * 110_000));
  // Saturday 18:12, Wairimu on the site's form: waiting list id 1043 (Moana wrote 1043 on rake at 17:46).
  events.push({ time: Date.UTC(2031, 4, 31, 18, 12, 9), db: 'plots', table: 'waitlist', op: 'insert', row: ['1043', WAIRIMU.name, WAIRIMU.email, 'full', '2031-05-31'], key: '1043' });
  for (let k = 6; k < 70; k++) events.push(booking(k, sat + 13 * 60_000 + (k - 6) * 37 * 60_000));
  events.push({ time: Date.UTC(2031, 5, 1, 10, 31, 0), db: 'plots', table: 'waitlist', op: 'insert', row: ['1044', 'Mele Tupou', 'mele.tupou@mail.example', 'half', '2031-06-01'], key: '1044' });
  const m = plotsDatabase(3).tables.members.rows[16];
  events.push({ time: Date.UTC(2031, 5, 1, 15, 2, 0), db: 'plots', table: 'members', op: 'update', row: [m[0], m[1], 'q.rossi@mail.example', m[3]], key: String(m[0]) });
  for (let k = 70; k < 96; k++) events.push(booking(k, Date.UTC(2031, 5, 1, 16, 0, 0) + (k - 70) * 34 * 60_000));
  events.push({ time: Date.UTC(2031, 5, 2, 7, 58, 0), db: 'plots', table: 'waitlist', op: 'insert', row: ['1045', 'Ines Okafor-Brandt', 'ines.ob@mail.example', 'half', '2031-06-02'], key: '1045' });
  const first = ps.seq + 1;
  const failing = first + 6;
  for (const e of events) {
    ps.seq++;
    const ev = { ...e, seq: ps.seq };
    ps.events.push(ev);
    applyTo(ps.databases.plots.tables[e.table], ev);
    if (ev.seq < failing) applyTo(rs.databases.plots.tables[e.table], ev);
  }
  // Moana's row, written on rake at 17:46 on Saturday (read_only was off).
  const jun: Cell[] = ['1043', ESI.name, ESI.email, 'half', '2031-05-31'];
  rs.databases.plots.tables.waitlist.rows.push(jun);
  rs.databases.plots.tables.waitlist.autoIncrement = 1044;
  rs.localWrites = 1;
  rs.replica = {
    host: TROWEL.back,
    port: 3306,
    user: 'repl',
    password: REPL_PASSWORD,
    useGtid: 'Slave_Pos',
    io: true,
    sql: false,
    lastIoErrno: 0,
    lastIoError: '',
    lastSqlErrno: 1062,
    lastSqlError: `Could not execute Write_rows_v1 event on table plots.waitlist; Duplicate entry '1043' for key 'PRIMARY', Error_code: 1062; handler error HA_ERR_FOUND_DUPP_KEY; the event's master log ${binlogName(ps)}, end_log_pos ${positionOf(ps, failing)}`,
    read: ps.seq,
    applied: failing - 1,
    skip: 0,
    connectRetry: 60,
  };
  rs.gtidSlavePos = gtid(ps, failing - 1);
  // rake's journal: the error, on Saturday at 18:12.
  const sd = systemd(rake)!;
  const keep = sd.clock;
  sd.clock = Date.UTC(2031, 4, 31, 18, 12, 9);
  const stamp = '2031-05-31 18:12:09';
  const r = rs.replica;
  writeLog(sd, 'mariadb.service', 'mariadbd', 4137, `${stamp} 9 [ERROR] Slave SQL: ${r.lastSqlError}, Gtid ${gtid(ps, failing)}, Internal MariaDB error code: 1062`, 3, false);
  writeLog(sd, 'mariadb.service', 'mariadbd', 4137, `${stamp} 9 [Warning] Slave: Duplicate entry '1043' for key 'PRIMARY' Error_code: 1062`, 4, false);
  writeLog(sd, 'mariadb.service', 'mariadbd', 4137, `${stamp} 9 [ERROR] Error running query, slave SQL thread aborted. Fix the problem, and restart the slave SQL thread with "SLAVE START". We stopped at log '${binlogName(ps)}' position ${positionOf(ps, failing - 1)}; GTID position '${gtid(ps, failing - 1)}'`, 3, false);
  sd.clock = keep;
  // Last night's dumps (made with --skip-lock-tables while the SQL thread was stopped: stale since Saturday).
  const backups = rake.find(BACKUPS);
  if (backups?.type === 'directory')
    for (const day of [30, 31, 1, 2]) {
      const date = day > 20 ? `2031-05-${day}` : `2031-06-0${day}`;
      backups.children[`plots-${date}.sql`] = f(`-- MariaDB dump 10.19-11.8.9-MariaDB, for debian-linux-gnu (x86_64)\n--\n-- Host: localhost    Database: plots\n-- (${date}, 02:30: see the file's size)`, { lines: true, owner: 'root', mode: 'rw-r--r--', size: 61_204 + day * 13, mtime: Date.parse(`${date}T02:30:41Z`) });
    }
}

const applyTo = (t: Table, ev: BinlogEvent) => {
  const k = keyIndex(t);
  const at = t.rows.findIndex((r) => r[k] === ev.key);
  if (ev.op === 'insert') {
    if (at < 0) t.rows.push([...ev.row]);
    if (Number(ev.key) >= t.autoIncrement) t.autoIncrement = Number(ev.key) + 1;
  } else if (ev.op === 'update' && at >= 0) t.rows[at] = [...ev.row];
  else if (ev.op === 'delete' && at >= 0) t.rows.splice(at, 1);
};

/** The server started with the machine (its journal says so at boot time), the clock back to the chapter's. */
function startAt(s: Shell, boot: number) {
  const sd = systemd(s)!;
  const keep = sd.clock;
  sd.clock = boot + 9_000;
  startServer(s);
  maria(s).started = boot + 9_000;
  sd.clock = keep;
}

export function initialiseStory(j: Game, n: ChapterNo) {
  const p = j as Shell;
  p.state.allotments = { chapter: n, ticks: 0, refused: 0, goodDumps: [], checkedDumps: [] } satisfies Story;
  p.state.mariaNet = mariaNet(p.t);
  attachService(p);
  startAt(p, BOOT[n]);
  maria(p).restarts = 0;
  if (n === 1) {
    leakedConnections(p, 148);
    p.state.mariadbWrites = true;
  }
  if (n === 2) {
    const b = p.internal('barrow')!;
    void b;
    tick2(p);
  }
  if (n === 3) {
    p.state.mariadbWrites = true;
    const rake = p.internal('rake')!;
    attachService(rake);
    startAt(rake, BOOT[3]);
    maria(rake).restarts = 0;
    // rake's server came back on Sunday: its SQL thread failed again on the same event (it was restarted at boot).
    weekend(p, rake);
    // Moana's account connects from the office for her reports: a sleeping connection on rake.
    const c = connect(rake, { host: OFFICE_PC, user: 'moana', password: MOANA_PASSWORD, osUser: '' }, 'client', 'plots');
    if (!('code' in c)) c.since = now(rake) - 180_000;
    replicate(linkOf(rake));
  }
}

// ——— Time passing ———

/** Each command: thirty seconds on every machine of the story. */
export function passTime(j: Game) {
  const p = principal(j);
  p.state.lastShell = j;
  const st = story(p);
  const all = [p, ...p.internals.values()];
  const t = Math.max(...all.map((s) => systemd(s)?.clock ?? 0)) + 30_000;
  for (const s of all) {
    const sd = systemd(s);
    if (sd) sd.clock = t;
  }
  st.ticks++;
  if (st.chapter === 1) tick1(p);
  else if (st.chapter === 2) tick2(p);
  else tick3(p);
  for (const s of all) if (hasMaria(s)) reapIdle(s);
}

const PLOT_QUERY = (plot: number) => `SELECT * FROM bookings WHERE plot_id = ${plot} ORDER BY starts_on DESC`;

/** Chapter 1: visitors open plot pages; the app opens three connections and never closes them; each page runs the bookings query. */
function tick1(p: Shell) {
  const s = maria(p);
  const st = story(p);
  if (!s.running) return;
  if (st.timeoutSetAt === undefined && Number(s.vars.wait_timeout) <= 900) st.timeoutSetAt = now(p);
  for (let k = 0; k < 3; k++) {
    const c = connect(p, { host: SHED, user: 'plotline', password: PLOTLINE_PASSWORD, osUser: '' }, 'app', 'plots');
    if ('code' in c) {
      st.refused++;
      continue;
    }
    if (k === 0) {
      const plot = 1 + (hash(`plot${st.ticks}`) % 40);
      const q = PLOT_QUERY(plot);
      const c2 = cost(s.databases.plots.tables.bookings, `plot_id = ${plot}`);
      if (c2.time > 1) {
        c.command = 'Query';
        c.state = 'Sending data';
        c.info = q;
        c.busyUntil = now(p) + c2.time * 1000;
      }
      slowLog(p, { user: 'plotline', host: SHED, ip: SHED, id: c.id, db: 'plots', time: c2.time, examined: c2.examined, sent: Math.min(c2.examined, 412), query: q });
    }
  }
}

/** Chapter 2: the app on barrow connects with what its .env said when it started, and does its work. */
function tick2(p: Shell) {
  const st = story(p);
  const b = p.internal('barrow')!;
  const env = b.state.plotlineEnv as Record<string, string> | null;
  const log = (line: string) => {
    const n = b.find('/var/log/plotline/app.log');
    if (n?.type === 'file') n.content = `${n.content}\n${isoTime(now(b))} ${line}`;
  };
  if (!env || systemd(b)?.services.plotline?.state !== 'active') {
    st.app = { ok: false, user: '', error: 'stopped' };
    return;
  }
  const user = env.DB_USER ?? '';
  const host = env.DB_HOST ?? '';
  const server = machineAt(b, host);
  const address = addressOf(b, host);
  const fail = (code: number, message: string) => {
    if (st.app?.code !== code || st.app?.user !== user) log(`ERROR plotline.db: (${code}, "${message}")`);
    st.app = { ok: false, user, code, error: message };
  };
  if (!server || !address || !hasMaria(server)) return fail(2005, `Unknown server host '${host}' (-2)`);
  const reach = reachable(server, sourceFor(b, address), address);
  if (reach !== 'ok') return fail(2002, `Can't connect to server on '${host}' (${reach === 'timeout' ? 110 : 115})`);
  const c = connect(server, { host: BARROW, user, password: env.DB_PASSWORD ?? '', osUser: '' }, 'app', null);
  if ('code' in c) return fail(c.code, c.message);
  const srv = maria(server);
  const db = env.DB_NAME ?? 'plots';
  for (const [priv, table] of APP_NEEDS) {
    if (!allowed(srv, c.account, priv, db, table)) {
      disconnect(server, c.id);
      return fail(1142, `${priv} command denied to user '${c.account!.user}'@'${c.account!.host}' for table \`${db}\`.\`${table}\``);
    }
  }
  disconnect(server, c.id);
  if (!st.app?.ok || st.app.user !== user) log(`INFO plotline.db: connected to ${host}:3306 as ${user}`);
  st.app = { ok: true, user };
}

/** Chapter 3: the app writes on trowel (a booking each minute), rake's threads follow; dumps and restores are checked. */
function tick3(p: Shell) {
  const st = story(p);
  const rake = p.internal('rake')!;
  // A dump just taken on rake: was rake healthy and identical to trowel then?
  const rs = maria(rake);
  for (const id of Object.keys(rs.dumps)) {
    if (st.checkedDumps.includes(id)) continue;
    st.checkedDumps.push(id);
    if (healthy(linkOf(rake)) && identical(p)) st.goodDumps.push(id);
  }
  for (const r of rs.restores) {
    if (r.db !== 'plots' && r.dump && st.goodDumps.includes(r.dump) && restoredMatches(rake, r.db, r.dump)) st.restoreOk = true;
  }
  const ps = maria(p);
  if (ps.running && st.ticks % 2 === 0) {
    const t = ps.databases.plots.tables.bookings;
    const id = String(t.autoIncrement);
    const at = now(p);
    writeRow(p, 'plots', 'bookings', 'insert', [id, String(1 + (hash(`n${id}`) % 40)), String(1 + (hash(`nm${id}`) % MEMBERS)), ITEMS[hash(`ni${id}`) % ITEMS.length], isoTime(at + 3 * DAY)]);
  }
  replicate(linkOf(rake));
}

// ——— What the chapters check ———

/** Are the plots tables the same on trowel and rake (CHECKSUM TABLE of each)? */
export function identical(j: Game): boolean {
  const p = principal(j);
  const rake = p.internals.get('rake');
  if (!rake) return false;
  const a = sums(maria(p), 'plots');
  const b = sums(maria(rake), 'plots');
  return Object.keys(a).length === Object.keys(b).length && Object.entries(a).every(([k, v]) => b[k] === v);
}

/** The restored database holds the dump's tables, row for row (their checksums). */
function restoredMatches(server: Shell, db: string, dump: string): boolean {
  const d = maria(server).dumps[dump];
  const got = sums(maria(server), db);
  if (!d) return false;
  return Object.entries(d.sums).every(([k, v]) => got[`${db}.${k.split('.')[1]}`] === v);
}

/** Is the app's account limited to what it needs? (no global privilege, nothing beyond APP_ALLOWED, nothing elsewhere). */
export function leastPrivilege(s: MariaState, a: Account): boolean {
  if (a.global.length || a.grantOption) return false;
  const dbs = s.dbGrants.filter((g) => g.user === a.user && g.host === a.host);
  const tables = s.tableGrants.filter((g) => g.user === a.user && g.host === a.host);
  return [...dbs, ...tables].every((g) => g.db === 'plots' && !g.privs.includes('ALL PRIVILEGES') && g.privs.every((x) => APP_ALLOWED.includes(x)) && !('grantOption' in g && g.grantOption));
}

/** The account the app uses on trowel now (its .env loaded, and the server's choice for barrow). */
export function appAccount(j: Game): Account | null {
  const p = principal(j);
  const b = p.internals.get('barrow');
  const env = b?.state.plotlineEnv as Record<string, string> | null | undefined;
  if (!env) return null;
  const r = authenticate(maria(p), { host: BARROW, user: env.DB_USER ?? '', password: env.DB_PASSWORD ?? '', osUser: '' });
  return 'account' in r ? r.account : null;
}

/** Does an account's host match an address outside the back network (the internet)? */
export const openToOutside = (a: Account) => hostMatches(a.host, OUTSIDE);

/** Is port 3306 open from the internet (on the office uplink address)? */
export const exposed = (j: Game) => reachable(principal(j), OUTSIDE, TROWEL.office) === 'ok';

export { fileValue, isOn };
