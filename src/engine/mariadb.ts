// A machine's MariaDB server, as Debian 13 ("trixie") ships it: the
// mariadb-server package, 11.8 LTS (1:11.8.9+ds-0+deb13u1,
// https://packages.debian.org/trixie/mariadb-server).
//
//   state.mariadb = { running, file, vars, databases, accounts, grants,
//                     conns, binlog, replica, dumps, restores… }
//
// - The configuration: /etc/mysql/my.cnf and the files it includes
//   (!includedir /etc/mysql/conf.d/, /etc/mysql/mariadb.conf.d/), the groups
//   the server reads ([server], [mysqld], [mariadb], [mariadbd],
//   [mariadb-11.8]), read when the server starts; an unknown variable stops
//   it ("unknown variable", "Aborting"), so does a bind-address the machine
//   doesn't have. https://mariadb.com/kb/en/configuring-mariadb-with-option-files/
// - The variables: their value at start, SET GLOBAL for the dynamic ones
//   (and only for new connections, for a session's wait_timeout),
//   https://mariadb.com/kb/en/server-system-variables/
// - The accounts, 'user'@'host': the most specific host first, then the
//   named user before the anonymous one (https://mariadb.com/kb/en/create-user/),
//   their authentication (unix_socket, Debian's default for root, and
//   mysql_native_password: https://mariadb.com/kb/en/authentication-plugin-unix-socket/),
//   the privileges at each level (https://mariadb.com/kb/en/grant/).
// - The connections (SHOW PROCESSLIST), max_connections and the extra one
//   kept for an account with the CONNECTION ADMIN (SUPER) privilege
//   (https://mariadb.com/kb/en/server-system-variables/#max_connections),
//   wait_timeout closing idle ones ("Aborted connection … Got timeout
//   reading communication packets").
// - The tables, their indexes (what EXPLAIN chooses), the slow query log
//   (https://mariadb.com/kb/en/slow-query-log-overview/).
// - The binary log and GTIDs (domain-server-sequence), a replica's IO and
//   SQL threads, its errors, sql_slave_skip_counter, read_only
//   (https://mariadb.com/kb/en/gtid/, https://mariadb.com/kb/en/show-replica-status/).
// Simplifications: see docs/SCENARIOS.md (MariaDB): only row changes
// replicate (no DDL, no account statements); one binary log file; values are
// text; reverse DNS is never done (as with skip-name-resolve).

import type { Game, Shell } from './shell';
import { systemd, writeLog, type Systemd } from './systemd';
import { sha1 } from './commands/checksums';
import { crc32 } from './compression';
import { verdict, inNetwork, type Firewall } from './firewall';

export const VERSION = '11.8.9-MariaDB-0+deb13u1';
export const SOCKET = '/run/mysqld/mysqld.sock';
export const MY_CNF = '/etc/mysql/my.cnf';
export const SERVER_CNF = '/etc/mysql/mariadb.conf.d/50-server.cnf';
export const DATADIR = '/var/lib/mysql';

export type Cell = string | null;

export interface Auth {
  plugin: 'mysql_native_password' | 'unix_socket';
  // mysql_native_password's hash ('*' and 40 hex digits), '' (no password) or 'invalid' (none can match).
  hash?: string;
}
export interface Account {
  user: string;
  host: string;
  // Tried in order: IDENTIFIED VIA a OR b.
  auth: Auth[];
  // Global privileges (*.*).
  global: string[];
  grantOption?: boolean;
  locked?: boolean;
}
export interface DbGrant {
  user: string;
  host: string;
  // A database name or a pattern (test\_%).
  db: string;
  privs: string[];
  grantOption?: boolean;
}
export interface TableGrant {
  user: string;
  host: string;
  db: string;
  table: string;
  privs: string[];
}
export interface Column {
  name: string;
  type: string;
  notNull?: boolean;
  autoIncrement?: boolean;
}
export interface Index {
  name: string;
  columns: string[];
  unique?: boolean;
}
export interface Table {
  columns: Column[];
  rows: Cell[][];
  // PRIMARY first (its first column is the key the game uses).
  indexes: Index[];
  autoIncrement: number;
  // A big table holds only a sample of its rows: its real size (EXPLAIN, count(*)).
  declared?: number;
}
export interface Database {
  tables: Record<string, Table>;
}

export type ConnKind = 'client' | 'app' | 'binlog-dump' | 'repl-io' | 'repl-sql' | 'daemon';
export interface Conn {
  id: number;
  user: string;
  // As SHOW PROCESSLIST writes it: localhost, or address:port.
  host: string;
  ip: string;
  db: string | null;
  command: string;
  state: string;
  info: string | null;
  // When it entered its current command (ms).
  since: number;
  // The session's wait_timeout (s), copied from the global one when it connected.
  timeout: number;
  kind: ConnKind;
  // The account it authenticated as (its privileges).
  account?: { user: string; host: string };
  // A query that runs until this moment (ms), then the connection sleeps.
  busyUntil?: number;
}

/** One change written to the binary log (row-based). */
export interface BinlogEvent {
  seq: number;
  time: number;
  db: string;
  table: string;
  op: 'insert' | 'update' | 'delete';
  // The row after (insert, update) or before (delete): all columns.
  row: Cell[];
  // The primary key's value of the row it changes.
  key: string;
}

export interface Replica {
  host: string;
  port: number;
  user: string;
  password: string;
  useGtid: 'Slave_Pos' | 'Current_Pos' | 'No';
  io: boolean;
  sql: boolean;
  lastIoErrno: number;
  lastIoError: string;
  lastSqlErrno: number;
  lastSqlError: string;
  // The last event the IO thread copied, and the last the SQL thread applied (GTID sequence numbers).
  read: number;
  applied: number;
  skip: number;
  // The primary's time of the event being applied, for Seconds_Behind_Master.
  connectRetry: number;
}

export interface DumpMeta {
  id: string;
  time: number;
  host: string;
  databases: string[];
  singleTransaction: boolean;
  lockTables: boolean;
  lockAll: boolean;
  // The rows are from one moment (a snapshot, or locks while writes arrived).
  consistent: boolean;
  // How long the tables were locked against writes (ms): the replica's SQL thread waited.
  blocked: number;
  // The tables' checksums when dumped (db.table → checksum).
  sums: Record<string, number>;
}

export interface Restore {
  dump: string | null;
  db: string;
  time: number;
  tables: string[];
}

export interface MariaState {
  running: boolean;
  pid: number;
  started: number;
  // The variables read from the files at the last start.
  file: Record<string, string>;
  // The global variables in force (file, then SET GLOBAL).
  vars: Record<string, string>;
  databases: Record<string, Database>;
  accounts: Account[];
  dbGrants: DbGrant[];
  tableGrants: TableGrant[];
  conns: Conn[];
  nextId: number;
  // The binary log (when log_bin is on): its file number and events.
  binlogFile: number;
  events: BinlogEvent[];
  // The last GTID sequence number this server wrote (its own domain 0, server_id).
  seq: number;
  replica?: Replica;
  // The GTID position the replica has applied (gtid_slave_pos), as text.
  gtidSlavePos?: string;
  // Counters (SHOW STATUS).
  questions: number;
  slowQueries: number;
  abortedClients: number;
  maxUsed: number;
  // Events the SQL thread skipped (sql_slave_skip_counter): their sequence numbers.
  skipped: number[];
  dumps: Record<string, DumpMeta>;
  restores: Restore[];
  // When the server was restarted (the chapters notice).
  restarts: number;
  // Changes a client made on this server while it is a replica (someone wrote on it).
  localWrites: number;
  // A dump holds read locks until then (ms): the replica's SQL thread waits.
  blockedUntil?: number;
  // What an administrator last looked at, and when (processlist, explain:table, replica-status, grants…): the chapters notice.
  looked: Record<string, number>;
}

/** Notes that an administrator looked at something on this server (a chapter's step). */
export const look = (j: Game, what: string) => {
  const s = maria(j);
  (s.looked ??= {})[what] = now(j) + 1;
};

// ——— Defaults and the variables the server knows ———

/** The defaults of MariaDB 11.8 (for the variables the game shows), https://mariadb.com/kb/en/server-system-variables/. */
export const DEFAULTS: Record<string, string> = {
  port: '3306',
  bind_address: '',
  socket: SOCKET,
  datadir: `${DATADIR}/`,
  basedir: '/usr',
  pid_file: '/run/mysqld/mysqld.pid',
  max_connections: '151',
  extra_max_connections: '1',
  wait_timeout: '28800',
  interactive_timeout: '28800',
  innodb_buffer_pool_size: '134217728',
  slow_query_log: 'OFF',
  slow_query_log_file: '',
  long_query_time: '10.000000',
  log_queries_not_using_indexes: 'OFF',
  log_bin: 'OFF',
  log_bin_basename: '',
  server_id: '1',
  read_only: 'OFF',
  skip_name_resolve: 'OFF',
  skip_networking: 'OFF',
  log_slave_updates: 'OFF',
  relay_log: '',
  gtid_domain_id: '0',
  binlog_format: 'MIXED',
  expire_logs_days: '0',
  max_allowed_packet: '16777216',
  character_set_server: 'utf8mb4',
  collation_server: 'utf8mb4_uca1400_ai_ci',
  sql_slave_skip_counter: '0',
  log_error: '',
  general_log: 'OFF',
  version: VERSION,
  version_comment: 'Debian 13',
};

// Options that may appear in a file but that the game doesn't show (accepted, ignored).
const ACCEPTED = new Set([
  'skip_slave_start', 'character_set_collations', 'user', 'tmpdir', 'lc_messages_dir', 'lc_messages', 'key_buffer_size', 'thread_stack', 'thread_cache_size', 'myisam_recover_options', 'query_cache_size', 'query_cache_limit',
  'general_log_file', 'log_slow_verbosity', 'log_slow_min_examined_row_limit', 'max_binlog_size', 'binlog_expire_logs_seconds', 'ssl_ca', 'ssl_cert', 'ssl_key', 'require_secure_transport',
  'innodb_log_file_size', 'innodb_flush_log_at_trx_commit', 'innodb_file_per_table', 'innodb_flush_method', 'table_open_cache', 'tmp_table_size', 'max_heap_table_size', 'sort_buffer_size',
  'log_warnings', 'log_basename', 'binlog_row_image', 'slave_parallel_threads', 'default_storage_engine', 'nice', 'skip_log_error', 'syslog', 'open_files_limit',
]);
// Aliases: the old names of the slow log's variables (renamed in 10.11), log-bin's path.
const ALIASES: Record<string, string> = {
  log_slow_query: 'slow_query_log',
  log_slow_query_file: 'slow_query_log_file',
  log_slow_query_time: 'long_query_time',
  log_slave_updates: 'log_slave_updates',
  log_replica_updates: 'log_slave_updates',
  sql_replica_skip_counter: 'sql_slave_skip_counter',
};
// The variables SET GLOBAL may change (the others: ERROR 1238, read only).
export const DYNAMIC = new Set([
  'max_connections', 'wait_timeout', 'interactive_timeout', 'slow_query_log', 'slow_query_log_file', 'long_query_time', 'log_queries_not_using_indexes', 'read_only', 'sql_slave_skip_counter',
  'innodb_buffer_pool_size', 'server_id', 'gtid_slave_pos', 'expire_logs_days', 'max_allowed_packet', 'general_log', 'gtid_domain_id', 'binlog_format', 'extra_max_connections',
]);
const BOOLEANS = new Set(['slow_query_log', 'log_queries_not_using_indexes', 'read_only', 'skip_name_resolve', 'skip_networking', 'log_slave_updates', 'general_log']);

export const isOn = (v: string | undefined) => /^(1|on|true|yes)$/i.test(v ?? '');
const onOff = (v: string) => (isOn(v) ? 'ON' : /^(0|off|false|no)$/i.test(v) ? 'OFF' : v);

/** A size written like the server reads it (128M, 8G, 1048576). */
export function size(v: string): number | null {
  const m = /^(\d+)([kmgt]?)$/i.exec(v.trim());
  if (!m) return null;
  return Number(m[1]) * 1024 ** ' kmgt'.indexOf((m[2] || ' ').toLowerCase());
}

/** A variable's name as the server knows it (dashes become underscores, aliases). */
export const canonical = (n: string) => {
  const x = n.trim().toLowerCase().replace(/-/g, '_');
  return ALIASES[x] ?? x;
};
export const knownVariable = (n: string) => n in DEFAULTS || ACCEPTED.has(n) || n === 'gtid_slave_pos';

// ——— The configuration files ———

export interface Option {
  name: string;
  // As written in the file (max-connections).
  raw: string;
  value: string;
  file: string;
  line: number;
  loose: boolean;
}

/** The option files as the server reads them (my.cnf and the directories it includes), the server's groups only. */
export function readOptions(j: Game, groups = ['server', 'mysqld', 'mariadb', 'mariadbd', 'mariadb-11.8']): Option[] {
  const out: Option[] = [];
  const seen = new Set<string>();
  const readFile = (path: string, depth: number) => {
    if (seen.has(path) || depth > 4) return;
    seen.add(path);
    const text = j.read(path);
    if (text === null) return;
    let group = '';
    text.split('\n').forEach((raw, i) => {
      const l = raw.replace(/\s+#.*$/, '').trim();
      if (!l || l.startsWith('#') || l.startsWith(';')) return;
      const inc = /^!includedir\s+(\S+)/.exec(l);
      if (inc) {
        const dir = inc[1].replace(/\/$/, '');
        const n = j.find(dir);
        if (n?.type === 'directory') for (const name of Object.keys(n.children).filter((x) => x.endsWith('.cnf')).sort()) readFile(`${dir}/${name}`, depth + 1);
        return;
      }
      const one = /^!include\s+(\S+)/.exec(l);
      if (one) return readFile(one[1], depth + 1);
      const g = /^\[([^\]]+)\]$/.exec(l);
      if (g) {
        group = g[1].trim().toLowerCase();
        return;
      }
      if (!groups.includes(group)) return;
      const eq = l.indexOf('=');
      let name = eq < 0 ? l : l.slice(0, eq).trim();
      let value = eq < 0 ? '1' : l.slice(eq + 1).trim().replace(/^(['"])(.*)\1$/, '$2');
      let loose = false;
      if (/^loose[-_]/i.test(name)) {
        loose = true;
        name = name.slice(6);
      }
      // skip-name-resolve, skip_networking: the variable is ON; skip-log-bin: off.
      if (/^skip[-_]/i.test(name) && eq < 0) {
        const rest = canonical(name.slice(5));
        if (rest === 'log_bin' || rest === 'slave_start') {
          name = rest;
          value = rest === 'log_bin' ? 'OFF' : '1';
        }
      }
      out.push({ name: canonical(name), raw: name, value, file: path, line: i + 1, loose });
    });
  };
  readFile(MY_CNF, 0);
  return out;
}

/** The value a variable will have at the next start (the last line wins), or undefined. */
export function fileValue(j: Game, name: string): string | undefined {
  return readOptions(j).filter((o) => o.name === canonical(name)).at(-1)?.value;
}

// ——— The state ———

export const maria = (j: Game): MariaState => j.state.mariadb as MariaState;
export const hasMaria = (j: Game) => !!j.state.mariadb;
const sd = (j: Game): Systemd => systemd(j)!;
export const now = (j: Game) => systemd(j)?.clock ?? 0;

/** A table's key (its primary key's first column; the first column without one). */
export const keyIndex = (t: Table) => {
  const pk = t.indexes.find((i) => i.name === 'PRIMARY');
  return pk ? Math.max(0, t.columns.findIndex((c) => c.name === pk.columns[0])) : 0;
};

export function newServer(o: Partial<MariaState> & { databases: Record<string, Database>; accounts: Account[] }): MariaState {
  return {
    running: false,
    pid: 0,
    started: 0,
    file: {},
    vars: { ...DEFAULTS },
    dbGrants: [],
    tableGrants: [],
    conns: [],
    nextId: 30,
    binlogFile: 1,
    events: [],
    seq: 0,
    questions: 0,
    slowQueries: 0,
    abortedClients: 0,
    maxUsed: 0,
    skipped: [],
    dumps: {},
    restores: [],
    restarts: 0,
    localWrites: 0,
    looked: {},
    ...o,
  };
}

/** The system tables every server has (the game shows them, never changes them). */
export const SYSTEM_DATABASES = ['information_schema', 'mysql', 'performance_schema', 'sys'];

// ——— Passwords ———

const hexBytes = (h: string) => Uint8Array.from(h.match(/../g)!.map((x) => parseInt(x, 16)));
/** mysql_native_password's hash of a password: '*' and SHA1(SHA1(password)) in capitals; '' for none. */
export function nativeHash(password: string): string {
  if (password === '') return '';
  return `*${sha1(hexBytes(sha1(new TextEncoder().encode(password)))).toUpperCase()}`;
}

/** Debian's root: IDENTIFIED VIA mysql_native_password USING 'invalid' OR unix_socket. */
export const socketAuth = (): Auth[] => [{ plugin: 'mysql_native_password', hash: 'invalid' }, { plugin: 'unix_socket' }];
export const passwordAuth = (password: string): Auth[] => [{ plugin: 'mysql_native_password', hash: nativeHash(password) }];

// ——— Host patterns ———

const likeRe = (pattern: string) =>
  new RegExp(
    `^${pattern
      .split(/(\\.|%|_)/)
      .map((p) => (p === '%' ? '.*' : p === '_' ? '.' : p.startsWith('\\') && p.length === 2 ? p[1].replace(/[.*+?^${}()|[\]\\]/g, '\\$&') : p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
      .join('')}$`,
    'i',
  );

/** Does an account's host match the client ('localhost' for the socket, else its address)? */
export function hostMatches(pattern: string, client: string): boolean {
  if (pattern === 'localhost') return client === 'localhost';
  if (client === 'localhost') return pattern === 'localhost';
  // address/netmask: 198.51.100.0/255.255.255.0
  const nm = /^(\d+\.\d+\.\d+\.\d+)\/(\d+\.\d+\.\d+\.\d+)$/.exec(pattern);
  if (nm) {
    const n = (ip: string) => ip.split('.').reduce((t, x) => t * 256 + Number(x), 0);
    const mask = n(nm[2]);
    return /^\d+\.\d+\.\d+\.\d+$/.test(client) && ((n(client) & mask) >>> 0) === ((n(nm[1]) & mask) >>> 0);
  }
  return likeRe(pattern).test(client);
}

// How specific a host is: a literal beats a pattern, a longer literal start beats a shorter one, '%' comes last.
const specificity = (host: string) => {
  if (host === '%') return 0;
  const wild = host.search(/[%_]/);
  if (wild < 0 || host.includes('/')) return 1000 + host.length;
  return 1 + wild;
};

/** The accounts, in the order the server tries them (https://mariadb.com/kb/en/create-user/#account-names). */
export const sortedAccounts = (s: MariaState) =>
  [...s.accounts].sort((a, b) => specificity(b.host) - specificity(a.host) || (a.user === '' ? 1 : 0) - (b.user === '' ? 1 : 0));

export const findAccount = (s: MariaState, user: string, host: string) => s.accounts.find((a) => a.user === user && a.host.toLowerCase() === host.toLowerCase());
export const accountName = (user: string, host: string) => `'${user}'@'${host}'`;

// ——— Privileges ———

/** The privileges ALL PRIVILEGES gives at each level (https://mariadb.com/kb/en/grant/#privilege-levels). */
export const DB_PRIVILEGES = ['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'CREATE', 'DROP', 'REFERENCES', 'INDEX', 'ALTER', 'CREATE TEMPORARY TABLES', 'LOCK TABLES', 'EXECUTE', 'CREATE VIEW', 'SHOW VIEW', 'CREATE ROUTINE', 'ALTER ROUTINE', 'EVENT', 'TRIGGER', 'DELETE HISTORY'];
export const TABLE_PRIVILEGES = ['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'CREATE', 'DROP', 'REFERENCES', 'INDEX', 'ALTER', 'CREATE VIEW', 'SHOW VIEW', 'TRIGGER', 'DELETE HISTORY'];
export const GLOBAL_PRIVILEGES = [
  ...DB_PRIVILEGES.slice(0, 6), 'RELOAD', 'SHUTDOWN', 'PROCESS', 'FILE', ...DB_PRIVILEGES.slice(6, 8), 'SHOW DATABASES', 'SUPER', 'CREATE TEMPORARY TABLES', 'LOCK TABLES', 'EXECUTE',
  'REPLICATION SLAVE', 'BINLOG MONITOR', 'CREATE VIEW', 'SHOW VIEW', 'CREATE ROUTINE', 'ALTER ROUTINE', 'CREATE USER', 'EVENT', 'TRIGGER', 'CREATE TABLESPACE', 'DELETE HISTORY',
  'SET USER', 'FEDERATED ADMIN', 'CONNECTION ADMIN', 'READ_ONLY ADMIN', 'REPLICATION SLAVE ADMIN', 'REPLICATION MASTER ADMIN', 'BINLOG ADMIN', 'BINLOG REPLAY', 'SLAVE MONITOR', 'SHOW CREATE ROUTINE',
].filter((p, i, all) => all.indexOf(p) === i);
export const ALL = 'ALL PRIVILEGES';

const expand = (privs: string[], level: string[]) => (privs.includes(ALL) ? level : privs);
const dbMatches = (pattern: string, db: string) => likeRe(pattern).test(db);

/** Does the account have this privilege (globally, on the database, or on the table)? */
export function allowed(s: MariaState, who: { user: string; host: string } | undefined, priv: string, db?: string, table?: string): boolean {
  if (!who) return false;
  const a = findAccount(s, who.user, who.host);
  if (!a) return false;
  const global = expand(a.global, GLOBAL_PRIVILEGES);
  if (global.includes(priv) || (priv !== 'GRANT OPTION' && global.includes('SUPER') && /ADMIN$|^REPLICATION|MONITOR$|^SET USER$/.test(priv))) return true;
  if (priv === 'GRANT OPTION' && a.grantOption) return true;
  if (db === undefined) return false;
  for (const g of s.dbGrants) if (g.user === a.user && (g.host === a.host || (a.user === '' && g.host === '%')) && dbMatches(g.db, db) && (expand(g.privs, DB_PRIVILEGES).includes(priv) || (priv === 'GRANT OPTION' && g.grantOption))) return true;
  if (table === undefined) return false;
  return s.tableGrants.some((g) => g.user === a.user && g.host === a.host && g.db === db && g.table.toLowerCase() === table.toLowerCase() && expand(g.privs, TABLE_PRIVILEGES).includes(priv));
}

/** Has the account any privilege on this database (USE, SHOW DATABASES)? */
export function anyOn(s: MariaState, who: { user: string; host: string } | undefined, db: string): boolean {
  if (!who) return false;
  const a = findAccount(s, who.user, who.host);
  if (!a) return false;
  if (db === 'information_schema') return true;
  if (expand(a.global, GLOBAL_PRIVILEGES).some((p) => DB_PRIVILEGES.includes(p) || p === 'SHOW DATABASES')) return true;
  return s.dbGrants.some((g) => g.user === a.user && (g.host === a.host || (a.user === '' && g.host === '%')) && dbMatches(g.db, db) && g.privs.length > 0) || s.tableGrants.some((g) => g.user === a.user && g.host === a.host && g.db === db);
}

/** The privileges an account effectively has on a database's table (for checks): global, database and table levels. */
export function effective(s: MariaState, user: string, host: string, db: string, table: string): string[] {
  return GLOBAL_PRIVILEGES.filter((p) => allowed(s, { user, host }, p, db, table));
}

// ——— Authentication ———

export interface Client {
  // The client's address, or 'localhost' for the socket.
  host: string;
  user: string;
  // The password given (-p), or null for none.
  password: string | null;
  // The operating system's account (unix_socket compares it).
  osUser: string;
}

export interface SqlError {
  code: number;
  state: string;
  message: string;
}
export const sqlError = (code: number, state: string, message: string): SqlError => ({ code, state, message });

/** The account the server authenticates the client as, or the error it answers. */
export function authenticate(s: MariaState, c: Client): { account: Account } | SqlError {
  const usingPassword = c.password !== null && c.password !== '' ? 'YES' : 'NO';
  const candidates = sortedAccounts(s).filter((a) => hostMatches(a.host, c.host));
  if (!candidates.length && c.host !== 'localhost') return sqlError(1130, 'HY000', `Host '${c.host}' is not allowed to connect to this MariaDB server`);
  // The first account whose host matches and whose user is the client's (or the anonymous user).
  const a = candidates.find((x) => x.user === c.user || x.user === '');
  const denied = () => sqlError(1045, '28000', `Access denied for user '${c.user}'@'${c.host}' (using password: ${usingPassword})`);
  if (!a) return denied();
  if (a.locked) return sqlError(4151, 'HY000', `Access denied, this account is locked`);
  for (const auth of a.auth) {
    if (auth.plugin === 'unix_socket') {
      if (c.host === 'localhost' && c.osUser === a.user) return { account: a };
      continue;
    }
    if (auth.hash === 'invalid') continue;
    if ((auth.hash ?? '') === nativeHash(c.password ?? '')) return { account: a };
  }
  // unix_socket alone, refused: no password was asked (https://mariadb.com/kb/en/authentication-plugin-unix-socket/).
  if (a.auth.some((x) => x.plugin === 'unix_socket') && c.password === null) return sqlError(1698, '28000', `Access denied for user '${c.user}'@'${c.host}'`);
  return denied();
}

// ——— Connections ———

export const clientConns = (s: MariaState) => s.conns.filter((c) => c.kind !== 'daemon' && c.kind !== 'repl-sql' && c.kind !== 'repl-io');
const varNum = (s: MariaState, n: string) => Number(s.vars[n] ?? DEFAULTS[n]);

/**
 * Opens a connection (the server running, a slot left, the account
 * authenticated); returns it or the error the client prints.
 */
export function connect(j: Game, c: Client, kind: ConnKind = 'client', db: string | null = null, interactive = false): Conn | SqlError {
  const s = maria(j);
  const auth = authenticate(s, c);
  if ('code' in auth) {
    if (auth.code === 1045 || auth.code === 1698) logNote(j, 'Warning', `Access denied for user '${c.user}'@'${c.host}' (using password: ${c.password ? 'YES' : 'NO'})`, false);
    return auth;
  }
  const a = auth.account;
  const used = clientConns(s).length;
  const max = varNum(s, 'max_connections');
  const admin = allowed(s, a, 'CONNECTION ADMIN');
  if (used >= max + (admin ? varNum(s, 'extra_max_connections') : 0)) return sqlError(1040, 'HY000', 'Too many connections');
  if (db !== null && !s.databases[db] && !SYSTEM_DATABASES.includes(db)) return sqlError(1049, '42000', `Unknown database '${db}'`);
  if (db !== null && !anyOn(s, a, db)) return sqlError(1044, '42000', `Access denied for user '${a.user}'@'${a.host}' to database '${db}'`);
  const conn: Conn = {
    id: s.nextId++,
    user: c.user || (a.user === '' ? '' : a.user),
    host: c.host === 'localhost' ? 'localhost' : `${c.host}:${40000 + ((s.nextId * 7919) % 20000)}`,
    ip: c.host,
    db,
    command: 'Sleep',
    state: '',
    info: null,
    since: now(j),
    timeout: varNum(s, interactive ? 'interactive_timeout' : 'wait_timeout'),
    kind,
    account: { user: a.user, host: a.host },
  };
  s.conns.push(conn);
  s.maxUsed = Math.max(s.maxUsed, clientConns(s).length);
  return conn;
}

export const disconnect = (j: Game, id: number) => {
  const s = maria(j);
  s.conns = s.conns.filter((c) => c.id !== id);
};

/** KILL id: the connection ends (its client sees "server has gone away"); false if there is none. */
export function kill(j: Game, id: number): boolean {
  const s = maria(j);
  const c = s.conns.find((x) => x.id === id);
  if (!c) return false;
  if (c.kind === 'repl-io' || c.kind === 'repl-sql') {
    if (s.replica) {
      if (c.kind === 'repl-io') s.replica.io = false;
      else s.replica.sql = false;
    }
  }
  disconnect(j, id);
  return true;
}

/** The server's log (journal of mariadb.service, like mariadbd's stderr under systemd). */
export function logNote(j: Game, level: 'Note' | 'Warning' | 'ERROR', message: string, advance = true) {
  const s = maria(j);
  const d = sd(j);
  if (!d) return;
  const t = new Date(d.clock + (advance ? 1000 : 0));
  const stamp = `${t.getUTCFullYear()}-${String(t.getUTCMonth() + 1).padStart(2, '0')}-${String(t.getUTCDate()).padStart(2, '0')} ${String(t.getUTCHours()).padStart(2, ' ')}:${String(t.getUTCMinutes()).padStart(2, '0')}:${String(t.getUTCSeconds()).padStart(2, '0')}`;
  writeLog(d, 'mariadb.service', 'mariadbd', s.pid || 1, `${stamp} 0 [${level}] ${message}`, level === 'ERROR' ? 3 : level === 'Warning' ? 4 : 6, advance);
}

/** Closes the connections idle longer than their wait_timeout ("Got timeout reading communication packets"). */
export function reapIdle(j: Game) {
  const s = maria(j);
  if (!s.running) return;
  const t = now(j);
  for (const c of [...s.conns]) {
    if (c.busyUntil !== undefined && c.busyUntil <= t) {
      c.busyUntil = undefined;
      c.command = 'Sleep';
      c.state = '';
      c.info = null;
      c.since = Math.max(c.since, t - 1000);
    }
    if ((c.kind === 'client' || c.kind === 'app') && c.command === 'Sleep' && (t - c.since) / 1000 > c.timeout) {
      disconnect(j, c.id);
      s.abortedClients++;
      logNote(j, 'Warning', `Aborted connection ${c.id} to db: '${c.db ?? 'unconnected'}' user: '${c.user}' host: '${c.ip}' real ip: '${c.ip}' (Got timeout reading communication packets)`, false);
    }
  }
}

// ——— Starting and stopping ———

/** The machine's IPv4 addresses (for bind-address). */
export function machineAddresses(j: Game): string[] {
  const lan = (j.state.baseLan ?? j.state.lan) as { interfaces?: Record<string, { addresses?: string[] }> } | undefined;
  return Object.values(lan?.interfaces ?? {}).flatMap((i) => (i.addresses ?? []).map((a) => a.split('/')[0]));
}

/** The errors mariadbd writes before giving up, or null: unknown variables, a bind-address it can't use. */
export function startErrors(j: Game): string[] | null {
  const options = readOptions(j);
  for (const o of options) {
    if (o.loose || knownVariable(o.name)) continue;
    return [`[ERROR] /usr/sbin/mariadbd: unknown variable '${o.raw}=${o.value}'`, '[ERROR] Aborting'];
  }
  const values = Object.fromEntries(options.map((o) => [o.name, o.value]));
  for (const n of ['max_connections', 'wait_timeout', 'port', 'server_id']) {
    if (values[n] !== undefined && !/^\d+$/.test(values[n])) return [`[ERROR] /usr/sbin/mariadbd: Error while setting value '${values[n]}' to '${n}'`, '[ERROR] Aborting'];
  }
  if (values.innodb_buffer_pool_size !== undefined && size(values.innodb_buffer_pool_size) === null)
    return [`[ERROR] /usr/sbin/mariadbd: Error while setting value '${values.innodb_buffer_pool_size}' to 'innodb_buffer_pool_size'`, '[ERROR] Aborting'];
  const bind = values.bind_address;
  if (bind && !isOn(values.skip_networking)) {
    const mine = ['127.0.0.1', '0.0.0.0', '::', '*', ...machineAddresses(j)];
    const wrong = bind.split(',').map((x) => x.trim()).find((a) => !mine.includes(a) && !/^localhost$/i.test(a));
    if (wrong)
      return [
        `[ERROR] Can't start server: Bind on TCP/IP port. Got error: 99: Cannot assign requested address`,
        `[ERROR] Do you already have another server running on port: ${values.port ?? 3306} ?`,
        '[ERROR] Aborting',
      ];
  }
  return null;
}

/** mariadbd starts: it reads its files, listens, and the replica's threads start (unless skip-slave-start). */
export function startServer(j: Game) {
  const s = maria(j);
  const options = readOptions(j);
  const file: Record<string, string> = {};
  for (const o of options) if (knownVariable(o.name) && !ACCEPTED.has(o.name)) file[o.name] = o.value;
  s.file = file;
  const vars: Record<string, string> = { ...DEFAULTS };
  for (const [k, v] of Object.entries(file)) {
    if (k === 'gtid_slave_pos') continue;
    if (k === 'log_bin') {
      vars.log_bin = v === 'OFF' ? 'OFF' : 'ON';
      vars.log_bin_basename = v === 'OFF' ? '' : v === '1' ? `${DATADIR}/${hostOf(j)}-bin` : v.replace(/\.log$/, '').replace(/\.\d+$/, '');
      continue;
    }
    if (k === 'innodb_buffer_pool_size' || k === 'max_allowed_packet') vars[k] = String(size(v) ?? v);
    else if (k === 'long_query_time') vars[k] = Number(v).toFixed(6);
    else vars[k] = BOOLEANS.has(k) ? onOff(v) : v;
  }
  if (!vars.slow_query_log_file) vars.slow_query_log_file = `${hostOf(j)}-slow.log`;
  if (!vars.bind_address) vars.bind_address = '';
  s.vars = vars;
  s.running = true;
  s.started = now(j);
  s.pid = (s.pid || 4100) + 37;
  s.conns = s.conns.filter((c) => c.kind === 'daemon');
  s.restarts++;
  const proc = sd(j).services.mariadb?.process[0];
  if (proc) proc.pid = s.pid;
  logNote(j, 'Note', `Starting MariaDB ${VERSION}${vars.log_bin === 'ON' ? '-log' : ''} source revision 3c1b4bb2 server_uid 9xHj2Kq0rT8mN3pZvW1yB5cD6eF= as process ${s.pid}`);
  logNote(j, 'Note', `InnoDB: Initializing buffer pool, total size = ${(Number(vars.innodb_buffer_pool_size) / 1048576).toFixed(3)}MiB, chunk size = 2.000MiB`, false);
  logNote(j, 'Note', 'InnoDB: Completed initialization of buffer pool', false);
  logNote(j, 'Note', 'Plugin \'FEEDBACK\' is disabled.', false);
  for (const a of listenAddresses(s)) logNote(j, 'Note', `Server socket created on IP: '${a}', port: '${vars.port}'.`, false);
  // The replica's threads start with the server (CHANGE MASTER TO is kept in master.info).
  if (s.replica && !isOn(fileValue(j, 'skip_slave_start'))) {
    s.replica.io = true;
    s.replica.sql = true;
    s.replica.lastSqlErrno = 0;
    s.replica.lastSqlError = '';
  }
  logNote(j, 'Note', '/usr/sbin/mariadbd: ready for connections.', false);
  logNote(j, 'Note', `Version: '${VERSION}${vars.log_bin === 'ON' ? '-log' : ''}'  socket: '${SOCKET}'  port: ${vars.port}  Debian 13`, false);
  syncListening(j);
}

export function stopServer(j: Game) {
  const s = maria(j);
  if (!s.running) return;
  logNote(j, 'Note', '/usr/sbin/mariadbd (initiated by: unknown): Normal shutdown');
  logNote(j, 'Note', 'InnoDB: Shutdown completed; log sequence number 48213377; transaction id 1820432', false);
  logNote(j, 'Note', '/usr/sbin/mariadbd: Shutdown complete', false);
  s.running = false;
  s.conns = [];
  syncListening(j);
}

const hostOf = (j: Game) => (j as Shell).hostName ?? 'localhost';

/** Where the server listens (bind-address, possibly several separated by commas; empty: every address). */
export function listenAddresses(s: MariaState): string[] {
  if (!s.running || isOn(s.vars.skip_networking)) return [];
  const b = s.vars.bind_address;
  if (!b || b === '*' || b === '::') return ['::'];
  return b.split(',').map((x) => (/^localhost$/i.test(x.trim()) ? '127.0.0.1' : x.trim()));
}

/** state.listening (ss): the server's TCP sockets. */
export function syncListening(j: Game) {
  const s = maria(j);
  type L = { proto: string; address: string; port: number; process: string; pid: number };
  const rest = ((j.state.listening ?? []) as L[]).filter((l) => l.process !== 'mariadbd');
  const mine = listenAddresses(s).map((a) => ({ proto: 'tcp', address: a === '::' ? '*' : a, port: Number(s.vars.port), process: 'mariadbd', pid: s.pid }));
  j.state.listening = [...rest, ...mine];
}

/** Hooks the mariadb service to the model (call from the chapter's initialise). */
export function attachService(j: Game) {
  const svc = sd(j).services.mariadb;
  if (!svc) return;
  svc.check = (g) => startErrors(g);
  svc.load = (g) => startServer(g);
  svc.stop = (g) => stopServer(g);
}

/** Does a TCP connection from this address reach the server at this address (it listens there, the firewall lets it in)? */
export function reachable(j: Game, from: string, to: string): 'ok' | 'refused' | 'timeout' {
  const s = maria(j);
  if (!s.running) return 'refused';
  const addresses = listenAddresses(s);
  const listens = addresses.some((a) => a === '0.0.0.0' || a === '::' || a === to);
  if (!listens) return 'refused';
  const ufw = j.state.ufw as Firewall | undefined;
  if (ufw && to !== '127.0.0.1' && from !== to) {
    const v = verdict(ufw, Number(s.vars.port), from);
    if (v === 'blocked') return 'timeout';
    if (v === 'refused') return 'refused';
  }
  return 'ok';
}
export { inNetwork };

// ——— Tables ———

/** A table's rows as text for a checksum (NULL as \N). */
const rowText = (r: Cell[]) => r.map((c) => (c === null ? '\\N' : c)).join('\u0001');

/** CHECKSUM TABLE: a number from every row's values (the same rows, in any order, give the same number). */
export function checksum(t: Table): number {
  let sum = 0;
  for (const r of t.rows) sum = (sum + crc32([...new TextEncoder().encode(rowText(r))])) % 4294967296;
  return sum;
}

/** The checksums of a database's tables. */
export const sums = (s: MariaState, db: string): Record<string, number> =>
  Object.fromEntries(Object.entries(s.databases[db]?.tables ?? {}).map(([n, t]) => [`${db}.${n}`, checksum(t)]));

export const copyTable = (t: Table): Table => ({ columns: t.columns.map((c) => ({ ...c })), rows: t.rows.map((r) => [...r]), indexes: t.indexes.map((i) => ({ ...i, columns: [...i.columns] })), autoIncrement: t.autoIncrement, ...(t.declared ? { declared: t.declared } : {}) });
export const copyDatabase = (d: Database): Database => ({ tables: Object.fromEntries(Object.entries(d.tables).map(([n, t]) => [n, copyTable(t)])) });

/** Writes a row change on a server: applies it, and logs it in the binary log (log_bin). Returns an error if the key exists or misses. */
export function writeRow(j: Game, db: string, table: string, op: BinlogEvent['op'], row: Cell[], o: { replicated?: boolean } = {}): SqlError | null {
  const s = maria(j);
  const t = s.databases[db]?.tables[table];
  if (!t) return sqlError(1146, '42S02', `Table '${db}.${table}' doesn't exist`);
  const k = keyIndex(t);
  const key = row[k] ?? '';
  const at = t.rows.findIndex((r) => r[k] === key);
  if (op === 'insert') {
    if (at >= 0) return sqlError(1062, '23000', `Duplicate entry '${key}' for key 'PRIMARY'`);
    t.rows.push([...row]);
    if (/^\d+$/.test(key ?? '') && Number(key) >= t.autoIncrement) t.autoIncrement = Number(key) + 1;
  } else if (op === 'update') {
    if (at < 0) return sqlError(1032, 'HY000', `Can't find record in '${table}'`);
    t.rows[at] = [...row];
  } else {
    if (at < 0) return sqlError(1032, 'HY000', `Can't find record in '${table}'`);
    t.rows.splice(at, 1);
  }
  if (isOn(s.vars.log_bin) && (!o.replicated || isOn(s.vars.log_slave_updates))) {
    s.seq++;
    s.events.push({ seq: s.seq, time: now(j), db, table, op, row: [...row], key: key ?? '' });
  }
  if (s.replica && !o.replicated) s.localWrites++;
  return null;
}

// ——— Binary log positions ———

/** The binary log's file name. */
export const binlogName = (s: MariaState, file = s.binlogFile) => `${(s.vars.log_bin_basename || 'mariadb-bin').split('/').at(-1)}.${String(file).padStart(6, '0')}`;
/** The byte position after an event (each event takes about 330 bytes: GTID, table map, rows, Xid). */
export const positionOf = (s: MariaState, seq: number) => {
  const first = s.events[0]?.seq ?? seq;
  return 385 + Math.max(0, seq - first + 1) * 331;
};
/** The GTID of a sequence number on this server. */
export const gtid = (s: MariaState, seq: number) => `${s.vars.gtid_domain_id ?? '0'}-${s.vars.server_id ?? '1'}-${seq}`;

// ——— Replication ———

export interface ReplicationLink {
  replica: Game;
  primary: Game | null;
  // The replica's address on the primary's network (its connection's host there).
  from: string;
}

/** The replica's IO thread: connected to its primary? Returns the error, or null. */
function ioConnect(link: ReplicationLink): { errno: number; message: string } | null {
  const r = maria(link.replica).replica!;
  const p = link.primary;
  if (!p) return { errno: 2005, message: `error connecting to master '${r.user}@${r.host}:${r.port}' - retry-time: ${r.connectRetry}  maximum-retries: 100000  message: Unknown server host '${r.host}' (-2)` };
  const reach = reachable(p, link.from, r.host);
  if (reach !== 'ok')
    return { errno: 2003, message: `error connecting to master '${r.user}@${r.host}:${r.port}' - retry-time: ${r.connectRetry}  maximum-retries: 100000  message: Can't connect to server on '${r.host}' (${reach === 'timeout' ? 110 : 111})` };
  const auth = authenticate(maria(p), { host: link.from, user: r.user, password: r.password, osUser: '' });
  if ('code' in auth) return { errno: auth.code, message: `error connecting to master '${r.user}@${r.host}:${r.port}' - retry-time: ${r.connectRetry}  maximum-retries: 100000  message: ${auth.message}` };
  if (!allowed(maria(p), auth.account, 'REPLICATION SLAVE')) return { errno: 1045, message: `Got fatal error 1236 from master when reading data from binary log: 'Access denied; you need (at least one of) the REPLICATION SLAVE privilege(s) for this operation'` };
  return null;
}

/** The replica's threads, at each moment: the IO thread copies the primary's events, the SQL thread applies them (stopping at the first error). */
export function replicate(link: ReplicationLink) {
  const rs = maria(link.replica);
  const r = rs.replica;
  if (!r || !rs.running) return;
  const p = link.primary;
  const ps = p ? maria(p) : null;
  if (r.io) {
    const e = ioConnect(link);
    if (e) {
      if (r.lastIoErrno !== e.errno) logNote(link.replica, 'ERROR', `Slave I/O: ${e.message}, Internal MariaDB error code: ${e.errno}`, false);
      r.lastIoErrno = e.errno;
      r.lastIoError = e.message;
    } else {
      r.lastIoErrno = 0;
      r.lastIoError = '';
      r.read = ps!.seq;
    }
  }
  if (!r.sql || !ps) return;
  if (rs.blockedUntil !== undefined && now(link.replica) < rs.blockedUntil) return;
  while (r.applied < r.read) {
    const ev = ps.events.find((x) => x.seq === r.applied + 1);
    if (!ev) {
      r.applied++;
      continue;
    }
    if (r.skip > 0) {
      r.skip--;
      rs.skipped.push(ev.seq);
      r.applied = ev.seq;
      rs.gtidSlavePos = gtid(ps, ev.seq);
      continue;
    }
    const err = writeRow(link.replica, ev.db, ev.table, ev.op, ev.row, { replicated: true });
    if (err) {
      const kind = ev.op === 'insert' ? 'Write_rows_v1' : ev.op === 'update' ? 'Update_rows_v1' : 'Delete_rows_v1';
      const handler = err.code === 1062 ? 'HA_ERR_FOUND_DUPP_KEY' : 'HA_ERR_KEY_NOT_FOUND';
      r.sql = false;
      r.lastSqlErrno = err.code;
      r.lastSqlError = `Could not execute ${kind} event on table ${ev.db}.${ev.table}; ${err.message}, Error_code: ${err.code}; handler error ${handler}; the event's master log ${binlogName(ps)}, end_log_pos ${positionOf(ps, ev.seq)}`;
      logNote(link.replica, 'ERROR', `Slave SQL: ${r.lastSqlError}, Gtid ${gtid(ps, ev.seq)}, Internal MariaDB error code: ${err.code}`, false);
      logNote(link.replica, 'Warning', `Slave: ${err.message} Error_code: ${err.code}`, false);
      logNote(link.replica, 'ERROR', `Error running query, slave SQL thread aborted. Fix the problem, and restart the slave SQL thread with "SLAVE START". We stopped at log '${binlogName(ps)}' position ${positionOf(ps, ev.seq - 1)}; GTID position '${gtid(ps, ev.seq - 1)}'`, false);
      return;
    }
    r.applied = ev.seq;
    rs.gtidSlavePos = gtid(ps, ev.seq);
  }
}

/** Seconds_Behind_Master: NULL when a thread is stopped, otherwise the age of the oldest event not applied yet. */
export function secondsBehind(link: ReplicationLink): number | null {
  const rs = maria(link.replica);
  const r = rs.replica;
  if (!r || !r.sql || !r.io || r.lastIoErrno || !rs.running) return null;
  if (r.applied >= r.read || !link.primary) return 0;
  const ev = maria(link.primary).events.find((x) => x.seq === r.applied + 1);
  return ev ? Math.max(0, Math.round((now(link.replica) - ev.time) / 1000)) : 0;
}

/** Is the replica healthy: both threads running, no error, caught up? */
export function healthy(link: ReplicationLink): boolean {
  const r = maria(link.replica).replica;
  return !!r && r.io && r.sql && !r.lastIoErrno && !r.lastSqlErrno && secondsBehind(link) === 0 && !!link.primary && r.applied >= maria(link.primary).seq;
}

// ——— The story's network: which machine answers at an address ———

/** The machines of a story that run MariaDB or its clients: their addresses and names (on the main machine's state). */
export interface MariaNet {
  main: string;
  hosts: Record<string, { addresses: string[]; names: string[] }>;
}

const principalOf = (j: Game) => (j as Shell).principal ?? (j as Shell);
const netOf = (j: Game) => principalOf(j).state.mariaNet as MariaNet | undefined;
/** The name of the machine this shell is, in the story's network. */
export const machineId = (j: Game) => {
  const n = netOf(j);
  const sh = j as Shell;
  return !n ? null : sh === principalOf(j) ? n.main : (sh.host ?? null);
};
/** The machine a host name or address designates (null: unknown). */
export function machineAt(j: Game, host: string): Game | null {
  const n = netOf(j);
  if (!n) return null;
  const h = host.toLowerCase().replace(/\.$/, '');
  for (const [id, m] of Object.entries(n.hosts)) {
    if (!m.addresses.includes(h) && !m.names.some((x) => x.toLowerCase() === h)) continue;
    return id === n.main ? principalOf(j) : (principalOf(j).internal(id) as Game | null);
  }
  return null;
}
/** The address a client on this machine connects from, towards that address. */
export function sourceFor(j: Game, to: string): string {
  const n = netOf(j);
  const id = machineId(j);
  const mine = (id && n?.hosts[id]?.addresses) || machineAddresses(j);
  if (mine.includes(to) || to === '127.0.0.1') return to;
  const net = to.split('.').slice(0, 3).join('.');
  return mine.find((a) => a.startsWith(`${net}.`)) ?? mine.find((a) => a !== '127.0.0.1') ?? '127.0.0.1';
}
/** An address of a machine of the story for a name (the name itself if it is an address). */
export function addressOf(j: Game, host: string): string | null {
  if (/^\d+\.\d+\.\d+\.\d+$/.test(host)) return host;
  const n = netOf(j);
  const h = host.toLowerCase();
  for (const m of Object.values(n?.hosts ?? {})) if (m.names.some((x) => x.toLowerCase() === h)) return m.addresses.find((a) => a !== '127.0.0.1' && !a.startsWith('192.0.2.')) ?? m.addresses[0];
  return null;
}
/** The replication link of a replica: its primary's machine (by its CHANGE MASTER TO host), its own address there. */
export function linkOf(replica: Game): ReplicationLink {
  const r = maria(replica).replica;
  const primary = r ? machineAt(replica, r.host) : null;
  const to = r ? addressOf(replica, r.host) : null;
  return { replica, primary: primary && hasMaria(primary) ? primary : null, from: to ? sourceFor(replica, to) : '' };
}
