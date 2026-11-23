// The SQL a MariaDB 11.8 server understands in the game, one statement at a
// time, on a session (its connection, account and current database). The
// statements and their messages follow https://mariadb.com/kb/en/sql-statements/
// and the error list https://mariadb.com/kb/en/mariadb-error-code-reference/.
// What exists: SHOW (DATABASES, TABLES, [FULL] PROCESSLIST, VARIABLES,
// STATUS, GRANTS, CREATE TABLE, CREATE USER, INDEX, SLAVE|REPLICA STATUS,
// MASTER|BINLOG STATUS, BINARY LOGS, WARNINGS), USE, SELECT (columns,
// count(*), WHERE as sql-where.ts reads it, GROUP BY one column, ORDER BY,
// LIMIT; @@variables and a few functions; information_schema.PROCESSLIST,
// mysql.user, mysql.db), INSERT, UPDATE, DELETE, TRUNCATE, CREATE/DROP
// DATABASE and TABLE, CREATE/DROP INDEX, ALTER TABLE ADD/DROP INDEX, EXPLAIN,
// CHECKSUM TABLE, KILL, SET (GLOBAL, SESSION, PASSWORD), CREATE/DROP/ALTER/
// RENAME USER, GRANT, REVOKE, FLUSH, the replication statements (CHANGE
// MASTER TO, START/STOP/RESET SLAVE|REPLICA), and what a dump's file holds.
// Differences (docs/SCENARIOS.md): no joins, subqueries or expressions in
// the columns; transactions accepted but writes apply at once; LIKE and =
// compare as sql-where.ts does (LIKE without case).

import type { Game } from './shell';
import { where, SqlError as WhereError } from './sql-where';
import {
  ALL, DB_PRIVILEGES, GLOBAL_PRIVILEGES, TABLE_PRIVILEGES, SYSTEM_DATABASES, VERSION, accountName, allowed, anyOn, binlogName, canonical, checksum, findAccount, gtid, isOn, keyIndex,
  kill, linkOf, look, maria, nativeHash, now, passwordAuth, positionOf, replicate, secondsBehind, size, sqlError, writeRow, DEFAULTS, DYNAMIC, logNote,
  type Account, type Auth, type Cell, type Column, type Conn, type Index, type SqlError, type Table, type MariaState,
} from './mariadb';

export interface Session {
  server: Game;
  conn: Conn;
  db: string | null;
  vars: Record<string, string>;
  // The account (privileges) and the user name the client gave.
  account: { user: string; host: string };
  user: string;
  host: string;
}

export interface Rows {
  columns: string[];
  data: Cell[][];
  // Right-aligned columns (numbers).
  numeric?: boolean[];
}
export type Result = ({ rows: Rows } | { ok: { affected: number; info?: string; warnings?: number } } | { error: SqlError } | { use: string }) & { time?: number; vertical?: boolean };

const err = (code: number, state: string, message: string): Result => ({ error: sqlError(code, state, message) });
const ok = (affected = 0, info?: string, time?: number): Result => ({ ok: { affected, ...(info ? { info } : {}) }, ...(time !== undefined ? { time } : {}) });
const rows = (columns: string[], data: Cell[][], numeric?: boolean[]): Result => ({ rows: { columns, data, ...(numeric ? { numeric } : {}) } });
const syntax = (near: string): Result => err(1064, '42000', `You have an error in your SQL syntax; check the manual that corresponds to your MariaDB server version for the right syntax to use near '${near.slice(0, 80)}' at line 1`);
const denied = (s: Session, priv: string, db: string, table: string) => err(1142, '42000', `${priv} command denied to user '${s.account.user}'@'${s.account.host}' for table \`${db}\`.\`${table}\``);
const needs = (privs: string) => err(1227, '42000', `Access denied; you need (at least one of) the ${privs} privilege(s) for this operation`);

/** A statement without comments, conditional comments opened, backticks removed. */
export function clean(sql: string): string {
  return sql
    .replace(/\/\*M?!\d*\\?-?\s*enable the sandbox mode\s*\*\//gi, '')
    .replace(/\/\*M?!\d*\s?([\s\S]*?)\*\//g, '$1')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .filter((l) => !/^\s*(--(\s|$)|#)/.test(l))
    .join('\n')
    .replace(/`([^`]*)`/g, '$1')
    .trim()
    .replace(/;\s*$/, '')
    .trim();
}

/** Splits a script into statements (semicolons outside quotes), with the line each starts on. */
export function statements(text: string): { sql: string; line: number }[] {
  const out: { sql: string; line: number }[] = [];
  let cur = '';
  let quote: string | null = null;
  let line = 1;
  let start = 1;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '\n') line++;
    if (!cur.trim() && /\s/.test(ch)) {
      start = line;
      continue;
    }
    if (!quote && (ch === '-' && text[i + 1] === '-' && /\s/.test(text[i + 2] ?? ' ')) && !cur.trim()) {
      while (i < text.length && text[i] !== '\n') i++;
      line++;
      start = line;
      continue;
    }
    if (!quote && ch === '#' && !cur.trim()) {
      while (i < text.length && text[i] !== '\n') i++;
      line++;
      start = line;
      continue;
    }
    if (quote) {
      if (ch === '\\') {
        cur += ch + (text[++i] ?? '');
        continue;
      }
      if (ch === quote) quote = null;
    } else if (ch === "'" || ch === '"' || ch === '`') quote = ch;
    else if (ch === ';') {
      if (cur.trim()) out.push({ sql: cur.trim(), line: start });
      cur = '';
      start = line;
      continue;
    }
    cur += ch;
  }
  if (cur.trim()) out.push({ sql: cur.trim(), line: start });
  return out;
}

// ——— Values ———

/** Reads a list of SQL values: 12, 'text' (with \' and ''), NULL, NOW(); returns the cells, or null if it isn't one. */
export function readValues(text: string, clock: number): Cell[] | null {
  const out: Cell[] = [];
  let i = 0;
  const skip = () => {
    while (/\s/.test(text[i] ?? '')) i++;
  };
  for (;;) {
    skip();
    if (text[i] === "'" || text[i] === '"') {
      const q = text[i++];
      let v = '';
      for (; i < text.length; i++) {
        if (text[i] === '\\') {
          const n = text[++i];
          v += n === 'n' ? '\n' : n === 't' ? '\t' : n === '0' ? '\0' : n;
        } else if (text[i] === q && text[i + 1] === q) {
          v += q;
          i++;
        } else if (text[i] === q) break;
        else v += text[i];
      }
      if (text[i] !== q) return null;
      i++;
      out.push(v);
    } else {
      const m = /^(-?\d+(?:\.\d+)?|NULL|NOW\(\)|CURRENT_TIMESTAMP(?:\(\))?|CURDATE\(\)|CURRENT_DATE(?:\(\))?|TRUE|FALSE|DEFAULT)/i.exec(text.slice(i));
      if (!m) return null;
      const w = m[1].toUpperCase();
      i += m[1].length;
      const iso = new Date(clock).toISOString();
      out.push(
        w === 'NULL' || w === 'DEFAULT'
          ? null
          : w.startsWith('NOW') || w.startsWith('CURRENT_TIMESTAMP')
            ? `${iso.slice(0, 10)} ${iso.slice(11, 19)}`
            : w.startsWith('CURDATE') || w.startsWith('CURRENT_DATE')
              ? iso.slice(0, 10)
              : w === 'TRUE'
                ? '1'
                : w === 'FALSE'
                  ? '0'
                  : m[1],
      );
    }
    skip();
    if (text[i] === ',') {
      i++;
      continue;
    }
    break;
  }
  skip();
  return i >= text.length ? out : null;
}

/** The groups of an INSERT's VALUES: (…), (…). */
function groups(text: string): string[] | null {
  const out: string[] = [];
  let i = 0;
  while (i < text.length) {
    while (/[\s,]/.test(text[i] ?? '')) i++;
    if (i >= text.length) break;
    if (text[i] !== '(') return null;
    let depth = 0;
    let quote: string | null = null;
    const start = i + 1;
    for (; i < text.length; i++) {
      const ch = text[i];
      if (quote) {
        if (ch === '\\') i++;
        else if (ch === quote) quote = null;
      } else if (ch === "'" || ch === '"') quote = ch;
      else if (ch === '(') depth++;
      else if (ch === ')' && --depth === 0) break;
    }
    if (text[i] !== ')') return null;
    out.push(text.slice(start, i));
    i++;
  }
  return out;
}

/** An SQL literal for a dump: numbers bare, NULL, strings quoted with backslashes. */
export const literal = (v: Cell, numeric: boolean) =>
  v === null ? 'NULL' : numeric && /^-?\d+(\.\d+)?$/.test(v) ? v : `'${v.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '\\n')}'`;
export const numericType = (type: string) => /^(tiny|small|medium|big)?int|^decimal|^float|^double/i.test(type);

// ——— Names ———

const ident = (x: string) => x.trim().replace(/^[`"]|[`"]$/g, '');
/** db.table or table (in the session's database). */
function tableRef(s: Session, ref: string): { db: string | null; table: string } {
  const parts = ref.split('.').map(ident);
  return parts.length === 2 ? { db: parts[0], table: parts[1] } : { db: s.db, table: parts[0] };
}
const noDb = () => err(1046, '3D000', 'No database selected');

/** An account written 'user'@'host', user@host, 'user' (host %), CURRENT_USER. */
function accountRef(s: Session, text: string): { user: string; host: string } | null {
  const t = text.trim();
  if (/^current_user(\(\))?$/i.test(t)) return { ...s.account };
  const m = /^(?:'([^']*)'|"([^"]*)"|`([^`]*)`|([\w.-]+))(?:\s*@\s*(?:'([^']*)'|"([^"]*)"|`([^`]*)`|([\w.%:/-]+)))?$/.exec(t);
  if (!m) return null;
  return { user: m[1] ?? m[2] ?? m[3] ?? m[4] ?? '', host: m[5] ?? m[6] ?? m[7] ?? m[8] ?? '%' };
}
/** Several accounts separated by commas (outside quotes). */
const accountList = (s: Session, text: string) => text.split(/,(?=(?:[^']*'[^']*')*[^']*$)/).map((x) => accountRef(s, x));

// ——— The tables the game makes up from the server's state ———

const PROCESSLIST = ['Id', 'User', 'Host', 'db', 'Command', 'Time', 'State', 'Info', 'Progress'];

function processRows(s: MariaState, clock: number, full: boolean): Cell[][] {
  return s.conns.map((c) => [String(c.id), c.user, c.host, c.db, c.command, String(Math.max(0, Math.floor((clock - c.since) / 1000))), c.state, c.info === null ? null : full ? c.info : c.info.slice(0, 100), '0.000']);
}

const yn = (b: boolean) => (b ? 'Y' : 'N');
const USER_COLUMNS = ['Host', 'User', 'Password', 'Select_priv', 'Insert_priv', 'Update_priv', 'Delete_priv', 'Drop_priv', 'Grant_priv', 'Super_priv', 'plugin', 'authentication_string', 'account_locked'];
function userRows(s: MariaState): Cell[][] {
  return s.accounts.map((a) => {
    const g = a.global.includes(ALL) ? GLOBAL_PRIVILEGES : a.global;
    const native = a.auth.find((x) => x.plugin === 'mysql_native_password');
    const plugin = a.auth[0]?.plugin ?? 'mysql_native_password';
    const hash = native?.hash ?? '';
    return [a.host, a.user, hash === 'invalid' ? 'invalid' : hash, yn(g.includes('SELECT')), yn(g.includes('INSERT')), yn(g.includes('UPDATE')), yn(g.includes('DELETE')), yn(g.includes('DROP')), yn(!!a.grantOption), yn(g.includes('SUPER')), plugin, hash, yn(!!a.locked)];
  });
}
const DB_COLUMNS = ['Host', 'Db', 'User', 'Select_priv', 'Insert_priv', 'Update_priv', 'Delete_priv', 'Create_priv', 'Drop_priv', 'Grant_priv', 'Alter_priv'];
function dbRows(s: MariaState): Cell[][] {
  return s.dbGrants.map((g) => {
    const p = g.privs.includes(ALL) ? DB_PRIVILEGES : g.privs;
    return [g.host, g.db, g.user, yn(p.includes('SELECT')), yn(p.includes('INSERT')), yn(p.includes('UPDATE')), yn(p.includes('DELETE')), yn(p.includes('CREATE')), yn(p.includes('DROP')), yn(!!g.grantOption), yn(p.includes('ALTER'))];
  });
}

/** A table to read: a real one, or one the game makes up (information_schema.PROCESSLIST, mysql.user, mysql.db). */
function readable(s: Session, ref: string): { columns: string[]; data: Cell[][]; table?: Table; db: string; name: string } | Result {
  const srv = maria(s.server);
  const { db, table } = tableRef(s, ref);
  if (!db) return noDb();
  const low = `${db.toLowerCase()}.${table.toLowerCase()}`;
  const clock = now(s.server);
  if (low === 'information_schema.processlist') {
    const process = allowed(srv, s.account, 'PROCESS');
    return { columns: ['ID', 'USER', 'HOST', 'DB', 'COMMAND', 'TIME', 'STATE', 'INFO'], data: processRows(srv, clock, true).filter((r) => process || r[1] === s.account.user).map((r) => r.slice(0, 8)), db, name: table };
  }
  if (low === 'mysql.user' || low === 'mysql.db' || low === 'mysql.global_priv') {
    if (!allowed(srv, s.account, 'SELECT', 'mysql', table)) return denied(s, 'SELECT', 'mysql', table.toLowerCase());
    if (low === 'mysql.user' && !findAccount(srv, 'mariadb.sys', 'localhost')) return err(1449, 'HY000', "The user specified as a definer ('mariadb.sys'@'localhost') does not exist");
    if (low === 'mysql.db') return { columns: DB_COLUMNS, data: dbRows(srv), db, name: table };
    return { columns: USER_COLUMNS, data: userRows(srv), db, name: table };
  }
  const d = srv.databases[db];
  const t = d?.tables[table];
  if (!t) {
    if (!d && !SYSTEM_DATABASES.includes(db)) return err(1146, '42S02', `Table '${db}.${table}' doesn't exist`);
    return err(1146, '42S02', `Table '${db}.${table}' doesn't exist`);
  }
  if (!allowed(srv, s.account, 'SELECT', db, table)) return denied(s, 'SELECT', db, table);
  return { columns: t.columns.map((c) => c.name), data: t.rows, table: t, db, name: table };
}

/** WHERE over cells, as sql-where.ts reads it (columns without case; double quotes are strings, LIKE without case). */
function filter(columns: string[], data: Cell[][], clause: string | undefined, clock: number): Cell[][] | Result {
  if (!clause?.trim()) return data;
  const text = clause
    .replace(/"([^"]*)"/g, "'$1'")
    .replace(/\bLIKE\b/gi, 'ILIKE')
    .replace(/(^|[^\w'])([A-Za-z_][\w]*)\.([A-Za-z_]\w*)/g, '$1$3');
  try {
    const lower = columns.map((c) => c.toLowerCase());
    const cells = data.map((r) => r.map((c) => (c === null ? '\\N' : c)));
    const kept = new Set(where(lower, cells, text, clock));
    return data.filter((_, i) => kept.has(cells[i]));
  } catch (e) {
    if (e instanceof WhereError) {
      const col = /column "([^"]+)" does not exist/.exec(e.message);
      if (col) return err(1054, '42S22', `Unknown column '${col[1]}' in 'WHERE'`);
      const near = /near "([^"]*)"/.exec(e.message);
      return syntax(near ? clause.slice(Math.max(0, clause.indexOf(near[1]))) : '');
    }
    throw e;
  }
}

// ——— The query's cost, for the slow query log and the client's timing ———

/** The index EXPLAIN chooses for a WHERE clause (its first equality on an indexed first column), or null. */
function chosenIndex(t: Table, clause: string | undefined): Index | null {
  if (!clause) return null;
  const eq = [...clause.matchAll(/(?:^|[\s(])(?:\w+\.)?(\w+)\s*=\s*('?[\w.@-]+'?)/g)].map((m) => m[1].toLowerCase());
  return t.indexes.find((i) => eq.includes(i.columns[0].toLowerCase())) ?? null;
}
/** Rows an index finds for one value (the table's size divided by its distinct values, estimated). */
const perValue = (t: Table, i: Index) => (i.name === 'PRIMARY' || i.unique ? 1 : Math.max(1, Math.round((t.declared ?? t.rows.length) / 4450)));
/** How long a SELECT takes (s): a full scan of a big table reads every row. */
export function cost(t: Table, clause: string | undefined): { time: number; examined: number; index: Index | null } {
  const total = t.declared ?? t.rows.length;
  const index = chosenIndex(t, clause);
  if (index) return { time: 0.002 + perValue(t, index) / 1_000_000, examined: perValue(t, index), index };
  return { time: Math.max(0.0005, total / 48_000), examined: total, index: null };
}

/** The slow query log: a query that took longer than long_query_time, written as MariaDB writes it. */
export function slowLog(j: Game, o: { user: string; host: string; ip: string; id: number; db: string | null; time: number; examined: number; sent: number; query: string }) {
  const s = maria(j);
  if (!isOn(s.vars.slow_query_log) || o.time < Number(s.vars.long_query_time)) return;
  s.slowQueries++;
  const path = s.vars.slow_query_log_file.startsWith('/') ? s.vars.slow_query_log_file : `/var/lib/mysql/${s.vars.slow_query_log_file}`;
  const t = new Date(now(j));
  const stamp = `${String(t.getUTCFullYear()).slice(2)}${String(t.getUTCMonth() + 1).padStart(2, '0')}${String(t.getUTCDate()).padStart(2, '0')} ${String(t.getUTCHours()).padStart(2, ' ')}:${String(t.getUTCMinutes()).padStart(2, '0')}:${String(t.getUTCSeconds()).padStart(2, '0')}`;
  const entry = [
    `# Time: ${stamp}`,
    `# User@Host: ${o.user}[${o.user}] @ ${o.ip === 'localhost' ? 'localhost []' : ` [${o.ip}]`}`,
    `# Thread_id: ${o.id}  Schema: ${o.db ?? ''}  QC_hit: No`,
    `# Query_time: ${o.time.toFixed(6)}  Lock_time: 0.000087  Rows_sent: ${o.sent}  Rows_examined: ${o.examined}`,
    `# Rows_affected: 0  Bytes_sent: ${o.sent * 96 + 312}`,
    `SET timestamp=${Math.floor(now(j) / 1000)};`,
    `${o.query.replace(/;?\s*$/, ';')}`,
  ].join('\n');
  const n = j.find(path);
  const header = `/usr/sbin/mariadbd, Version: ${VERSION}-log (Debian 13). started with:\nTcp port: 3306  Unix socket: /run/mysqld/mysqld.sock\nTime\t\t    Id Command\tArgument`;
  if (n?.type === 'file') {
    n.content = `${typeof n.content === 'string' && n.content ? n.content : header}\n${entry}`;
    delete n.size;
    return;
  }
  const dir = j.find(path.slice(0, path.lastIndexOf('/')));
  if (dir?.type === 'directory') dir.children[path.slice(path.lastIndexOf('/') + 1)] = { type: 'file', content: `${header}\n${entry}`, lines: true, owner: 'mysql', group: 'adm', mode: 'rw-rw----' };
}

// ——— SHOW VARIABLES and STATUS ———

function variables(s: Session, global: boolean): [string, string][] {
  const srv = maria(s.server);
  const all: Record<string, string> = { ...srv.vars, hostname: (s.server as { hostName?: string }).hostName ?? 'localhost' };
  if (!global) Object.assign(all, s.vars);
  all.gtid_slave_pos = srv.gtidSlavePos ?? '';
  all.gtid_binlog_pos = srv.seq ? gtid(srv, srv.seq) : '';
  all.gtid_current_pos = srv.replica && srv.gtidSlavePos && !srv.localWrites ? srv.gtidSlavePos : all.gtid_binlog_pos || all.gtid_slave_pos;
  all.log_bin = isOn(srv.vars.log_bin) ? 'ON' : 'OFF';
  return Object.entries(all).sort(([a], [b]) => a.localeCompare(b));
}

function status(s: Session): [string, string][] {
  const srv = maria(s.server);
  const clock = now(s.server);
  const clients = srv.conns.filter((c) => c.kind !== 'daemon');
  return [
    ['Aborted_clients', String(srv.abortedClients)],
    ['Aborted_connects', '0'],
    ['Connections', String(srv.nextId)],
    ['Max_used_connections', String(srv.maxUsed)],
    ['Questions', String(srv.questions)],
    ['Slow_queries', String(srv.slowQueries)],
    ['Threads_connected', String(clients.length)],
    ['Threads_running', String(clients.filter((c) => c.command !== 'Sleep').length)],
    ['Uptime', String(Math.max(1, Math.floor((clock - srv.started) / 1000)))],
  ];
}

/** LIKE 'pattern' on names, as SHOW … LIKE reads it. */
const likeName = (pattern: string | undefined) => {
  if (pattern === undefined) return () => true;
  const re = new RegExp(`^${pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/%/g, '.*').replace(/_/g, '.')}$`, 'i');
  return (n: string) => re.test(n);
};

// ——— SHOW GRANTS ———

const privList = (privs: string[]) => (privs.includes(ALL) ? 'ALL PRIVILEGES' : privs.length ? privs.join(', ') : 'USAGE');
function authText(a: Account): string {
  const parts = a.auth.map((x) => (x.plugin === 'unix_socket' ? 'unix_socket' : x.hash === '' ? null : `mysql_native_password USING '${x.hash}'`));
  if (a.auth.length === 1 && a.auth[0].plugin === 'mysql_native_password') return a.auth[0].hash ? ` IDENTIFIED BY PASSWORD '${a.auth[0].hash}'` : '';
  return ` IDENTIFIED VIA ${parts.filter(Boolean).join(' OR ')}`;
}
export function grantLines(srv: MariaState, a: Account): string[] {
  const name = `\`${a.user}\`@\`${a.host}\``;
  const out = [`GRANT ${privList(a.global.includes(ALL) || GLOBAL_PRIVILEGES.every((p) => a.global.includes(p)) ? [ALL] : a.global)} ON *.* TO ${name}${authText(a)}${a.grantOption ? ' WITH GRANT OPTION' : ''}`];
  for (const g of srv.dbGrants.filter((x) => x.user === a.user && x.host === a.host)) out.push(`GRANT ${privList(g.privs)} ON \`${g.db}\`.* TO ${name}${g.grantOption ? ' WITH GRANT OPTION' : ''}`);
  for (const g of srv.tableGrants.filter((x) => x.user === a.user && x.host === a.host)) out.push(`GRANT ${privList(g.privs)} ON \`${g.db}\`.\`${g.table}\` TO ${name}`);
  return out;
}

// ——— Accounts and privileges ———

/** IDENTIFIED BY 'pw' | IDENTIFIED BY PASSWORD '*hash' | IDENTIFIED VIA a [USING …] OR b; null: none given; string: syntax error. */
function readAuth(text: string): Auth[] | null | string {
  const t = text.trim();
  if (!t) return null;
  let m = /^IDENTIFIED\s+BY\s+PASSWORD\s+'([^']*)'$/i.exec(t);
  if (m) return [{ plugin: 'mysql_native_password', hash: m[1] }];
  m = /^IDENTIFIED\s+BY\s+'((?:[^'\\]|\\.|'')*)'$/i.exec(t);
  if (m) return passwordAuth(m[1].replace(/''/g, "'").replace(/\\(.)/g, '$1'));
  m = /^IDENTIFIED\s+(?:VIA|WITH)\s+(.+)$/i.exec(t);
  if (m) {
    const out: Auth[] = [];
    for (const part of m[1].split(/\s+OR\s+/i)) {
      const p = /^(\w+)(?:\s+(?:USING|AS|BY)\s+(?:PASSWORD\s*\(\s*'([^']*)'\s*\)|'([^']*)'))?$/i.exec(part.trim());
      if (!p) return part;
      const plugin = p[1].toLowerCase();
      if (plugin === 'unix_socket') out.push({ plugin: 'unix_socket' });
      else if (plugin === 'mysql_native_password') out.push({ plugin: 'mysql_native_password', hash: p[2] !== undefined ? nativeHash(p[2]) : (p[3] ?? '') });
      else return part;
    }
    return out;
  }
  return t;
}

/** A privilege list: SELECT, INSERT … | ALL [PRIVILEGES]; null if a word isn't a privilege. */
function readPrivileges(text: string): string[] | null {
  const out: string[] = [];
  for (const raw of text.split(',')) {
    const p = raw.trim().toUpperCase().replace(/\s+/g, ' ').replace(/^REPLICATION REPLICA$/, 'REPLICATION SLAVE').replace(/^REPLICA MONITOR$/, 'SLAVE MONITOR');
    if (p === 'ALL' || p === 'ALL PRIVILEGES') out.push(ALL);
    else if (p === 'USAGE') continue;
    else if (GLOBAL_PRIVILEGES.includes(p)) out.push(p);
    else return null;
  }
  return out;
}

function grant(s: Session, sql: string): Result {
  const srv = maria(s.server);
  const m = /^GRANT\s+(.+?)\s+ON\s+(?:TABLE\s+)?(\S+)\s+TO\s+(.+?)(\s+IDENTIFIED\s+.+?)?(\s+WITH\s+GRANT\s+OPTION)?$/i.exec(sql);
  if (!m) return syntax(sql.replace(/^GRANT\s+/i, ''));
  const privs = readPrivileges(m[1]);
  if (!privs) return syntax(m[1]);
  const target = m[2].replace(/`/g, '');
  const who = accountRef(s, m[3]);
  if (!who) return syntax(m[3]);
  const [dbPart, tablePart] = target.includes('.') ? target.split('.') : [s.db ?? '', target];
  const level = dbPart === '*' && tablePart === '*' ? 'global' : tablePart === '*' ? 'db' : 'table';
  if (level !== 'global' && !dbPart) return noDb();
  // Granting needs GRANT OPTION and the privileges themselves, at that level.
  const db = level === 'global' ? undefined : dbPart;
  const table = level === 'table' ? tablePart : undefined;
  const levelPrivs = level === 'global' ? GLOBAL_PRIVILEGES : level === 'db' ? DB_PRIVILEGES : TABLE_PRIVILEGES;
  const wanted = privs.includes(ALL) ? levelPrivs : privs;
  if (!allowed(srv, s.account, 'GRANT OPTION', db, table) || wanted.some((p) => !allowed(srv, s.account, p, db, table)))
    return err(1044, '42000', `Access denied for user '${s.account.user}'@'${s.account.host}' to database '${db ?? '*'}'`);
  if (level !== 'global') {
    const bad = privs.find((p) => p !== ALL && !levelPrivs.includes(p));
    if (bad) return err(1221, 'HY000', 'Incorrect usage of DB GRANT and GLOBAL PRIVILEGES');
  }
  if (level === 'table' && !srv.databases[dbPart]?.tables[tablePart]) return err(1146, '42S02', `Table '${dbPart}.${tablePart}' doesn't exist`);
  let account = findAccount(srv, who.user, who.host);
  const auth = m[4] ? readAuth(m[4]) : null;
  if (typeof auth === 'string') return syntax(auth);
  if (!account) {
    // NO_AUTO_CREATE_USER (in the default sql_mode): GRANT creates an account only with a password.
    if (!auth) return err(1133, '28000', "Can't find any matching row in the user table");
    account = { user: who.user, host: who.host, auth, global: [] };
    srv.accounts.push(account);
  } else if (auth) account.auth = auth;
  const merge = (have: string[]) => (privs.includes(ALL) ? [ALL] : [...new Set([...have.filter((p) => p !== ALL), ...privs])]);
  if (level === 'global') account.global = merge(account.global);
  else if (level === 'db') {
    const g = srv.dbGrants.find((x) => x.user === account!.user && x.host === account!.host && x.db === dbPart);
    if (g) g.privs = merge(g.privs);
    else srv.dbGrants.push({ user: account.user, host: account.host, db: dbPart, privs: merge([]) });
  } else {
    const g = srv.tableGrants.find((x) => x.user === account!.user && x.host === account!.host && x.db === dbPart && x.table === tablePart);
    if (g) g.privs = merge(g.privs);
    else srv.tableGrants.push({ user: account.user, host: account.host, db: dbPart, table: tablePart, privs: merge([]) });
  }
  if (m[5]) {
    if (level === 'global') account.grantOption = true;
    else if (level === 'db') srv.dbGrants.find((x) => x.user === account!.user && x.host === account!.host && x.db === dbPart)!.grantOption = true;
  }
  return ok(0);
}

function revoke(s: Session, sql: string): Result {
  const srv = maria(s.server);
  if (!allowed(srv, s.account, 'GRANT OPTION') && !allowed(srv, s.account, 'CREATE USER')) return needs('CREATE USER');
  const all = /^REVOKE\s+ALL(?:\s+PRIVILEGES)?\s*,\s*GRANT\s+OPTION\s+FROM\s+(.+)$/i.exec(sql);
  if (all) {
    for (const who of accountList(s, all[1])) {
      if (!who) return syntax(all[1]);
      const a = findAccount(srv, who.user, who.host);
      if (!a) return err(1269, 'HY000', 'Can\'t revoke all privileges for one or more of the requested users');
      a.global = [];
      a.grantOption = false;
      srv.dbGrants = srv.dbGrants.filter((g) => !(g.user === a.user && g.host === a.host));
      srv.tableGrants = srv.tableGrants.filter((g) => !(g.user === a.user && g.host === a.host));
    }
    return ok(0);
  }
  const m = /^REVOKE\s+(.+?)\s+ON\s+(?:TABLE\s+)?(\S+)\s+FROM\s+(.+)$/i.exec(sql);
  if (!m) return syntax(sql.replace(/^REVOKE\s+/i, ''));
  const grantOpt = /(^|,)\s*GRANT\s+OPTION\s*(,|$)/i.test(m[1]);
  const privs = readPrivileges(m[1].replace(/(^|,)\s*GRANT\s+OPTION\s*(?=,|$)/i, '').replace(/^\s*,|,\s*$/g, '') || 'USAGE');
  if (!privs) return syntax(m[1]);
  const target = m[2].replace(/`/g, '');
  const [dbPart, tablePart] = target.includes('.') ? target.split('.') : [s.db ?? '', target];
  for (const who of accountList(s, m[3])) {
    if (!who) return syntax(m[3]);
    const a = findAccount(srv, who.user, who.host);
    if (!a) return err(1147, '42000', `There is no such grant defined for user '${who.user}' on host '${who.host}'`);
    const remove = (have: string[], level: string[]) => {
      const full = have.includes(ALL) ? level : have;
      return privs.includes(ALL) ? [] : full.filter((p) => !privs.includes(p));
    };
    if (dbPart === '*' && tablePart === '*') {
      a.global = remove(a.global, GLOBAL_PRIVILEGES);
      if (grantOpt || privs.includes(ALL)) a.grantOption = false;
    } else if (tablePart === '*') {
      const g = srv.dbGrants.find((x) => x.user === a.user && x.host === a.host && x.db === dbPart);
      if (!g) return err(1141, '42000', `There is no such grant defined for user '${a.user}' on host '${a.host}'`);
      g.privs = remove(g.privs, DB_PRIVILEGES);
      if (grantOpt) g.grantOption = false;
      if (!g.privs.length && !g.grantOption) srv.dbGrants = srv.dbGrants.filter((x) => x !== g);
    } else {
      const g = srv.tableGrants.find((x) => x.user === a.user && x.host === a.host && x.db === dbPart && x.table === tablePart);
      if (!g) return err(1147, '42000', `There is no such grant defined for user '${a.user}' on host '${a.host}' on table '${tablePart}'`);
      g.privs = remove(g.privs, TABLE_PRIVILEGES);
      if (!g.privs.length) srv.tableGrants = srv.tableGrants.filter((x) => x !== g);
    }
  }
  return ok(0);
}

function userStatement(s: Session, sql: string): Result | null {
  const srv = maria(s.server);
  const lock = /\s+ACCOUNT\s+(UN)?LOCK$/i.exec(sql);
  const create = /^CREATE\s+(OR\s+REPLACE\s+)?USER\s+(IF\s+NOT\s+EXISTS\s+)?(.+?)(\s+IDENTIFIED\s+.+)?$/i.exec(lock && /^CREATE\s/i.test(sql) ? sql.slice(0, lock.index) : sql);
  if (create) {
    if (!allowed(srv, s.account, 'CREATE USER')) return needs('CREATE USER');
    const who = accountRef(s, create[3]);
    if (!who) return syntax(create[3]);
    const auth = readAuth(create[4] ?? '');
    if (typeof auth === 'string') return syntax(auth);
    const existing = findAccount(srv, who.user, who.host);
    if (existing && !create[1]) {
      if (create[2]) return { ok: { affected: 0, warnings: 1 } };
      return err(1396, 'HY000', `Operation CREATE USER failed for ${accountName(who.user, who.host)}`);
    }
    if (existing) srv.accounts = srv.accounts.filter((a) => a !== existing);
    srv.accounts.push({ user: who.user, host: who.host, auth: auth ?? [{ plugin: 'mysql_native_password', hash: '' }], global: [], ...(lock && !lock[1] ? { locked: true } : {}) });
    return ok(0);
  }
  const drop = /^DROP\s+USER\s+(IF\s+EXISTS\s+)?(.+)$/i.exec(sql);
  if (drop) {
    if (!allowed(srv, s.account, 'CREATE USER')) return needs('CREATE USER');
    const list = accountList(s, drop[2]);
    const failed: string[] = [];
    for (const who of list) {
      if (!who) return syntax(drop[2]);
      const a = findAccount(srv, who.user, who.host);
      if (!a) {
        failed.push(accountName(who.user, who.host));
        continue;
      }
      srv.accounts = srv.accounts.filter((x) => x !== a);
      srv.dbGrants = srv.dbGrants.filter((g) => !(g.user === a.user && g.host === a.host));
      srv.tableGrants = srv.tableGrants.filter((g) => !(g.user === a.user && g.host === a.host));
    }
    if (failed.length && !drop[1]) return err(1396, 'HY000', `Operation DROP USER failed for ${failed.join(',')}`);
    return failed.length ? { ok: { affected: 0, warnings: failed.length } } : ok(0);
  }
  const alter = /^ALTER\s+USER\s+(IF\s+EXISTS\s+)?(.+?)\s+((?:IDENTIFIED\s+.+)|ACCOUNT\s+(?:LOCK|UNLOCK))$/i.exec(sql);
  if (alter) {
    const who = accountRef(s, alter[2]);
    if (!who) return syntax(alter[2]);
    const self = who.user === s.account.user && who.host === s.account.host;
    if (!self && !allowed(srv, s.account, 'CREATE USER')) return needs('CREATE USER');
    const a = findAccount(srv, who.user, who.host);
    if (!a) return alter[1] ? { ok: { affected: 0, warnings: 1 } } : err(1396, 'HY000', `Operation ALTER USER failed for ${accountName(who.user, who.host)}`);
    if (/^ACCOUNT/i.test(alter[3])) {
      a.locked = /LOCK$/i.test(alter[3]) && !/UNLOCK$/i.test(alter[3]);
      return ok(0);
    }
    const auth = readAuth(alter[3]);
    if (typeof auth === 'string' || !auth) return syntax(String(auth ?? alter[3]));
    a.auth = auth;
    return ok(0);
  }
  const rename = /^RENAME\s+USER\s+(.+?)\s+TO\s+(.+)$/i.exec(sql);
  if (rename) {
    if (!allowed(srv, s.account, 'CREATE USER')) return needs('CREATE USER');
    const from = accountRef(s, rename[1]);
    const to = accountRef(s, rename[2]);
    if (!from || !to) return syntax(rename[1]);
    const a = findAccount(srv, from.user, from.host);
    if (!a || findAccount(srv, to.user, to.host)) return err(1396, 'HY000', `Operation RENAME USER failed for ${accountName(from.user, from.host)}`);
    for (const g of [...srv.dbGrants, ...srv.tableGrants]) if (g.user === a.user && g.host === a.host) Object.assign(g, to);
    a.user = to.user;
    a.host = to.host;
    return ok(0);
  }
  const pw = /^SET\s+PASSWORD(?:\s+FOR\s+(.+?))?\s*=\s*(?:PASSWORD\s*\(\s*'([^']*)'\s*\)|'([^']*)')$/i.exec(sql);
  if (pw) {
    const who = pw[1] ? accountRef(s, pw[1]) : { ...s.account };
    if (!who) return syntax(pw[1]);
    if ((who.user !== s.account.user || who.host !== s.account.host) && !allowed(srv, s.account, 'CREATE USER')) return needs('CREATE USER');
    const a = findAccount(srv, who.user, who.host);
    if (!a) return err(1133, '28000', "Can't find any matching row in the user table");
    a.auth = pw[2] !== undefined ? passwordAuth(pw[2]) : [{ plugin: 'mysql_native_password', hash: pw[3] }];
    return ok(0);
  }
  if (/^GRANT\s/i.test(sql)) return grant(s, sql);
  if (/^REVOKE\s/i.test(sql)) return revoke(s, sql);
  const show = /^SHOW\s+GRANTS(?:\s+FOR\s+(.+))?$/i.exec(sql);
  if (show) {
    const who = show[1] ? accountRef(s, show[1]) : { ...s.account };
    if (!who) return syntax(show[1]);
    const self = who.user === s.account.user && who.host === s.account.host;
    if (!self && !allowed(srv, s.account, 'SELECT', 'mysql')) return err(1044, '42000', `Access denied for user '${s.account.user}'@'${s.account.host}' to database 'mysql'`);
    const a = findAccount(srv, who.user, who.host);
    if (!a) return err(1141, '42000', `There is no such grant defined for user '${who.user}' on host '${who.host}'`);
    return rows([`Grants for ${who.user}@${who.host}`], grantLines(srv, a).map((l) => [l]));
  }
  const showCreate = /^SHOW\s+CREATE\s+USER\s+(.+)$/i.exec(sql);
  if (showCreate) {
    const who = accountRef(s, showCreate[1]);
    const a = who && findAccount(srv, who.user, who.host);
    if (!a) return err(1396, 'HY000', `Operation SHOW CREATE USER failed for ${accountName(who?.user ?? '', who?.host ?? '%')}`);
    return rows([`CREATE USER for ${a.user}@${a.host}`], [[`CREATE USER \`${a.user}\`@\`${a.host}\`${authText(a)}${a.locked ? ' ACCOUNT LOCK' : ''}`]]);
  }
  return null;
}

// ——— CREATE TABLE (as a dump writes it, or by hand) ———

function createTable(s: Session, sql: string): Result {
  const srv = maria(s.server);
  const m = /^CREATE\s+TABLE\s+(IF\s+NOT\s+EXISTS\s+)?(\S+)\s*\(([\s\S]*)\)([^)]*)$/i.exec(sql);
  if (!m) return syntax(sql.replace(/^CREATE\s+TABLE\s+/i, ''));
  const { db, table } = tableRef(s, m[2]);
  if (!db) return noDb();
  const d = srv.databases[db];
  if (!d) return err(1049, '42000', `Unknown database '${db}'`);
  if (!allowed(srv, s.account, 'CREATE', db, table)) return denied(s, 'CREATE', db, table);
  if (readOnlyRefused(s)) return readOnlyError();
  if (d.tables[table]) return m[1] ? { ok: { affected: 0, warnings: 1 } } : err(1050, '42S01', `Table '${table}' already exists`);
  const columns: Column[] = [];
  const indexes: Index[] = [];
  const parts = m[3].split(/,(?![^(]*\))/).map((x) => x.trim()).filter(Boolean);
  for (const p of parts) {
    const pk = /^PRIMARY\s+KEY\s*\(([^)]*)\)/i.exec(p);
    const key = /^(UNIQUE\s+)?(?:KEY|INDEX)\s+(\w+)\s*\(([^)]*)\)/i.exec(p);
    if (pk) indexes.unshift({ name: 'PRIMARY', columns: pk[1].split(',').map((c) => ident(c.replace(/\(\d+\)$/, ''))), unique: true });
    else if (key) indexes.push({ name: key[2], columns: key[3].split(',').map((c) => ident(c.replace(/\(\d+\)$/, ''))), ...(key[1] ? { unique: true } : {}) });
    else if (/^(CONSTRAINT|FOREIGN|CHECK|FULLTEXT)/i.test(p)) continue;
    else {
      const c = /^(\w+)\s+(\w+(?:\([^)]*\))?(?:\s+unsigned)?)(.*)$/i.exec(p);
      if (!c) return syntax(p);
      columns.push({ name: c[1], type: c[2], ...(/NOT\s+NULL/i.test(c[3]) ? { notNull: true } : {}), ...(/AUTO_INCREMENT/i.test(c[3]) ? { autoIncrement: true } : {}) });
      if (/PRIMARY\s+KEY/i.test(c[3])) indexes.unshift({ name: 'PRIMARY', columns: [c[1]], unique: true });
    }
  }
  const auto = /AUTO_INCREMENT=(\d+)/i.exec(m[4]);
  d.tables[table] = { columns, rows: [], indexes, autoIncrement: auto ? Number(auto[1]) : 1 };
  return ok(0);
}

/** CREATE TABLE as SHOW CREATE TABLE and mariadb-dump write it. */
export function createText(name: string, t: Table): string {
  const cols = t.columns.map((c) => `  \`${c.name}\` ${c.type}${c.notNull ? ' NOT NULL' : ' DEFAULT NULL'}${c.autoIncrement ? ' AUTO_INCREMENT' : ''}`);
  const keys = t.indexes.map((i) => (i.name === 'PRIMARY' ? `  PRIMARY KEY (${i.columns.map((c) => `\`${c}\``).join(',')})` : `  ${i.unique ? 'UNIQUE ' : ''}KEY \`${i.name}\` (${i.columns.map((c) => `\`${c}\``).join(',')})`));
  const auto = t.columns.some((c) => c.autoIncrement) ? ` AUTO_INCREMENT=${t.autoIncrement}` : '';
  return `CREATE TABLE \`${name}\` (\n${[...cols, ...keys].join(',\n')}\n) ENGINE=InnoDB${auto} DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci`;
}

// ——— read_only ———

const readOnlyRefused = (s: Session) => {
  const srv = maria(s.server);
  return isOn(srv.vars.read_only) && !allowed(srv, s.account, 'READ_ONLY ADMIN');
};
const readOnlyError = () => err(1290, 'HY000', 'The MariaDB server is running with the --read-only option so it cannot execute this statement');

// ——— Replication statements ———

function replicaRows(s: Session): Result {
  const srv = maria(s.server);
  const r = srv.replica;
  if (!r) return rows([], []);
  const link = linkOf(s.server);
  const ps = link.primary ? maria(link.primary) : null;
  const file = ps ? binlogName(ps) : 'mariadb-bin.000001';
  const behind = secondsBehind(link);
  const pos = (seq: number) => (ps ? positionOf(ps, seq) : 4);
  const ioState = !r.io ? '' : r.lastIoErrno ? 'Reconnecting after a failed master event read' : 'Waiting for master to send event';
  const fields: [string, string | null][] = [
    ['Slave_IO_State', ioState],
    ['Master_Host', r.host],
    ['Master_User', r.user],
    ['Master_Port', String(r.port)],
    ['Connect_Retry', String(r.connectRetry)],
    ['Master_Log_File', file],
    ['Read_Master_Log_Pos', String(pos(r.read))],
    ['Relay_Log_File', `${(s.server as { host?: string }).host ?? 'replica'}-relay-bin.000004`],
    ['Relay_Log_Pos', String(pos(r.applied) - 260)],
    ['Relay_Master_Log_File', file],
    ['Slave_IO_Running', r.io ? (r.lastIoErrno ? 'Connecting' : 'Yes') : 'No'],
    ['Slave_SQL_Running', r.sql ? 'Yes' : 'No'],
    ['Replicate_Rewrite_DB', ''],
    ['Replicate_Do_DB', ''],
    ['Replicate_Ignore_DB', ''],
    ['Replicate_Do_Table', ''],
    ['Replicate_Ignore_Table', ''],
    ['Replicate_Wild_Do_Table', ''],
    ['Replicate_Wild_Ignore_Table', ''],
    ['Last_Errno', String(r.lastSqlErrno)],
    ['Last_Error', r.lastSqlError],
    ['Skip_Counter', String(r.skip)],
    ['Exec_Master_Log_Pos', String(pos(r.applied))],
    ['Relay_Log_Space', String(Math.max(0, pos(r.read) - pos(r.applied)) + 1120)],
    ['Until_Condition', 'None'],
    ['Until_Log_File', ''],
    ['Until_Log_Pos', '0'],
    ['Master_SSL_Allowed', 'Yes'],
    ['Master_SSL_CA_File', ''],
    ['Master_SSL_CA_Path', ''],
    ['Master_SSL_Cert', ''],
    ['Master_SSL_Cipher', ''],
    ['Master_SSL_Key', ''],
    ['Seconds_Behind_Master', behind === null ? null : String(behind)],
    ['Master_SSL_Verify_Server_Cert', 'No'],
    ['Last_IO_Errno', String(r.lastIoErrno)],
    ['Last_IO_Error', r.lastIoError],
    ['Last_SQL_Errno', String(r.lastSqlErrno)],
    ['Last_SQL_Error', r.lastSqlError],
    ['Replicate_Ignore_Server_Ids', ''],
    ['Master_Server_Id', ps?.vars.server_id ?? '1'],
    ['Master_SSL_Crl', ''],
    ['Master_SSL_Crlpath', ''],
    ['Using_Gtid', r.useGtid],
    ['Gtid_IO_Pos', ps && r.read ? gtid(ps, r.read) : ''],
    ['Replicate_Do_Domain_Ids', ''],
    ['Replicate_Ignore_Domain_Ids', ''],
    ['Parallel_Mode', 'optimistic'],
    ['SQL_Delay', '0'],
    ['SQL_Remaining_Delay', null],
    ['Slave_SQL_Running_State', r.sql ? 'Slave has read all relay log; waiting for more updates' : ''],
    ['Slave_DDL_Groups', '14'],
    ['Slave_Non_Transactional_Groups', '0'],
    ['Slave_Transactional_Groups', String(r.applied)],
  ];
  return { rows: { columns: fields.map((f) => f[0]), data: [fields.map((f) => f[1])] }, vertical: false };
}

function replication(s: Session, sql: string): Result | null {
  const srv = maria(s.server);
  const admin = () => allowed(srv, s.account, 'REPLICATION SLAVE ADMIN') || allowed(srv, s.account, 'SUPER');
  if (/^SHOW\s+(ALL\s+)?(SLAVE|REPLICA)S?\s+STATUS$/i.test(sql)) {
    if (!allowed(srv, s.account, 'SLAVE MONITOR') && !allowed(srv, s.account, 'SUPER')) return needs('SUPER, SLAVE MONITOR');
    replicate(linkOf(s.server));
    return replicaRows(s);
  }
  if (/^SHOW\s+(MASTER|BINLOG)\s+STATUS$/i.test(sql)) {
    if (!isOn(srv.vars.log_bin)) return rows(['File', 'Position', 'Binlog_Do_DB', 'Binlog_Ignore_DB'], []);
    return rows(['File', 'Position', 'Binlog_Do_DB', 'Binlog_Ignore_DB'], [[binlogName(srv), String(positionOf(srv, srv.seq)), '', '']], [false, true, false, false]);
  }
  if (/^SHOW\s+(BINARY|MASTER)\s+LOGS$/i.test(sql)) {
    if (!isOn(srv.vars.log_bin)) return err(1381, 'HY000', 'You are not using binary logging');
    return rows(['Log_name', 'File_size'], [[binlogName(srv), String(positionOf(srv, srv.seq))]], [false, true]);
  }
  const startStop = /^(START|STOP)\s+(?:SLAVE|REPLICA)(?:\s+(IO_THREAD|SQL_THREAD))?$/i.exec(sql);
  if (startStop) {
    if (!admin()) return needs('SUPER, REPLICATION SLAVE ADMIN');
    const r = srv.replica;
    if (!r) return err(1200, 'HY000', 'Misconfigured slave: MASTER_HOST was not set; Fix in config file or with CHANGE MASTER TO');
    const start = startStop[1].toUpperCase() === 'START';
    const io = !startStop[2] || /^IO/i.test(startStop[2]);
    const sqlThread = !startStop[2] || /^SQL/i.test(startStop[2]);
    const warn = (start && (!io || r.io) && (!sqlThread || r.sql)) || (!start && (!io || !r.io) && (!sqlThread || !r.sql));
    if (io) r.io = start;
    if (sqlThread) {
      if (start && !r.sql) {
        r.lastSqlErrno = 0;
        r.lastSqlError = '';
        logNote(s.server, 'Note', `Slave SQL thread initialized, starting replication in log '${linkOf(s.server).primary ? binlogName(maria(linkOf(s.server).primary!)) : 'FIRST'}' at position ${r.applied}, GTID position '${srv.gtidSlavePos ?? ''}'`, false);
      }
      r.sql = start;
    }
    if (start) replicate(linkOf(s.server));
    return warn ? { ok: { affected: 0, warnings: 1 } } : ok(0);
  }
  const reset = /^RESET\s+(?:SLAVE|REPLICA)(\s+ALL)?$/i.exec(sql);
  if (reset) {
    if (!admin()) return needs('SUPER, REPLICATION SLAVE ADMIN');
    if (srv.replica?.io || srv.replica?.sql) return err(1198, 'HY000', "This operation cannot be performed as you have a running slave ''; run STOP SLAVE '' first");
    if (reset[1]) srv.replica = undefined;
    else if (srv.replica) Object.assign(srv.replica, { lastIoErrno: 0, lastIoError: '', lastSqlErrno: 0, lastSqlError: '', skip: 0 });
    return ok(0);
  }
  const change = /^CHANGE\s+(?:MASTER|REPLICATION\s+SOURCE)\s+TO\s+(.+)$/is.exec(sql);
  if (change) {
    if (!admin()) return needs('SUPER, REPLICATION SLAVE ADMIN');
    if (srv.replica?.io || srv.replica?.sql) return err(1198, 'HY000', "This operation cannot be performed as you have a running slave ''; run STOP SLAVE '' first");
    const r = srv.replica ?? { host: '', port: 3306, user: '', password: '', useGtid: 'Slave_Pos' as const, io: false, sql: false, lastIoErrno: 0, lastIoError: '', lastSqlErrno: 0, lastSqlError: '', read: 0, applied: 0, skip: 0, connectRetry: 60 };
    for (const part of change[1].split(/,(?=(?:[^']*'[^']*')*[^']*$)/)) {
      const kv = /^\s*(\w+)\s*=\s*(?:'([^']*)'|(\S+))\s*$/.exec(part);
      if (!kv) return syntax(part.trim());
      const k = kv[1].toUpperCase();
      const v = kv[2] ?? kv[3];
      if (k === 'MASTER_HOST') r.host = v;
      else if (k === 'MASTER_PORT') r.port = Number(v);
      else if (k === 'MASTER_USER') r.user = v;
      else if (k === 'MASTER_PASSWORD') r.password = v;
      else if (k === 'MASTER_USE_GTID') r.useGtid = /slave_pos/i.test(v) ? 'Slave_Pos' : /current_pos/i.test(v) ? 'Current_Pos' : 'No';
      else if (k === 'MASTER_CONNECT_RETRY') r.connectRetry = Number(v);
      else if (k === 'MASTER_LOG_FILE' || k === 'MASTER_LOG_POS' || k === 'MASTER_SSL' || k === 'MASTER_DELAY') {
        if (k === 'MASTER_LOG_POS') {
          // A file/position (non-GTID) start: the event after that position.
          const p = linkOf(s.server).primary;
          if (p) {
            const ps = maria(p);
            const seq = ps.events.find((e) => positionOf(ps, e.seq) >= Number(v))?.seq;
            r.applied = r.read = seq !== undefined ? (positionOf(ps, seq) === Number(v) ? seq : seq - 1) : ps.seq;
            r.useGtid = 'No';
          }
        }
      } else return syntax(part.trim());
    }
    srv.replica = r;
    return ok(0);
  }
  return null;
}

// ——— SET ———

function set(s: Session, sql: string): Result | null {
  const srv = maria(s.server);
  // User variables (SET @x = …), SET NAMES: a session's own business (a dump's preamble).
  if (/^SET\s+(@[^@]|NAMES\b|CHARACTER\s+SET\b)/i.test(sql)) return ok(0);
  const m = /^SET\s+(?:(GLOBAL|SESSION|LOCAL|PERSIST)\s+|@@(global|session|local)\.|@@)?([\w.]+)\s*(?:=|:=|TO)\s*(.+)$/i.exec(sql);
  if (!m) return null;
  const scopeWord = (m[1] ?? m[2] ?? '').toUpperCase();
  if (scopeWord === 'PERSIST') return syntax(sql.slice(4));
  const name = canonical(m[3]);
  let value = m[4].trim().replace(/^'(.*)'$/, '$1').replace(/^"(.*)"$/, '$1');
  // SET @var, SET NAMES …, SET sql_mode/time_zone/foreign_key_checks: a session's own settings (a dump's preamble).
  if (m[3].startsWith('@') || /^(names|character_set_client|character_set_results|collation_connection|sql_mode|time_zone|foreign_key_checks|unique_checks|sql_notes|autocommit|sql_log_bin|transaction_isolation|tx_isolation|sql_quote_show_create|character_set_connection|note_verbosity|sql_notes|names)$/i.test(m[3]))
    return ok(0);
  if (/^NAMES\b/i.test(m[3])) return ok(0);
  const global = scopeWord === 'GLOBAL';
  const known = name in DEFAULTS || name === 'gtid_slave_pos';
  if (!known) return err(1193, 'HY000', `Unknown system variable '${m[3]}'`);
  if (!global && !['wait_timeout', 'interactive_timeout', 'long_query_time', 'sql_slave_skip_counter', 'max_allowed_packet'].includes(name)) {
    if (name in DEFAULTS) return err(1229, 'HY000', `Variable '${name}' is a GLOBAL variable and should be set with SET GLOBAL`);
  }
  if (!global) {
    s.vars[name] = value;
    if (name === 'wait_timeout' || name === 'interactive_timeout') s.conn.timeout = Number(value);
    return ok(0);
  }
  if (!DYNAMIC.has(name)) return err(1238, 'HY000', `Variable '${name}' is a read only variable`);
  if (!allowed(srv, s.account, 'SUPER') && !allowed(srv, s.account, 'CONNECTION ADMIN') && !allowed(srv, s.account, 'REPLICATION SLAVE ADMIN')) return needs('SUPER');
  if (name === 'gtid_slave_pos') {
    if (srv.replica?.io || srv.replica?.sql) return err(1198, 'HY000', "This operation cannot be performed as you have a running slave ''; run STOP SLAVE '' first");
    const g = /^(\d+)-(\d+)-(\d+)$/.exec(value);
    if (value && !g) return err(1941, 'HY000', 'Could not parse GTID list');
    srv.gtidSlavePos = value;
    if (srv.replica && g) srv.replica.applied = srv.replica.read = Number(g[3]);
    return ok(0);
  }
  if (name === 'sql_slave_skip_counter') {
    if (srv.replica?.sql) return err(1198, 'HY000', "This operation cannot be performed as you have a running slave ''; run STOP SLAVE '' first");
    if (srv.replica) srv.replica.skip = Number(value);
    return ok(0);
  }
  if (['slow_query_log', 'read_only', 'log_queries_not_using_indexes', 'general_log'].includes(name)) {
    if (!/^(0|1|on|off|true|false)$/i.test(value)) return err(1231, '42000', `Variable '${name}' can't be set to the value of '${value}'`);
    value = isOn(value) ? 'ON' : 'OFF';
  } else if (name === 'long_query_time') value = Number(value).toFixed(6);
  else if (name === 'innodb_buffer_pool_size') value = String(size(value) ?? value);
  else if (!/^\d+$/.test(value) && name !== 'slow_query_log_file' && name !== 'binlog_format') return err(1232, '42000', `Incorrect argument type to variable '${name}'`);
  if (name === 'max_connections') value = String(Math.min(100000, Math.max(10, Number(value))));
  srv.vars[name] = value;
  return ok(0);
}

// ——— SELECT ———

const FUNCTIONS: Record<string, (s: Session) => Cell> = {
  'version()': (s) => `${VERSION}${isOn(maria(s.server).vars.log_bin) ? '-log' : ''}`,
  'user()': (s) => `${s.user}@${s.host}`,
  'current_user()': (s) => `${s.account.user}@${s.account.host}`,
  current_user: (s) => `${s.account.user}@${s.account.host}`,
  'database()': (s) => s.db,
  'schema()': (s) => s.db,
  'connection_id()': (s) => String(s.conn.id),
  'now()': (s) => new Date(now(s.server)).toISOString().slice(0, 19).replace('T', ' '),
  'curdate()': (s) => new Date(now(s.server)).toISOString().slice(0, 10),
};

function selectNoTable(s: Session, list: string): Result {
  const srv = maria(s.server);
  const cols: string[] = [];
  const vals: Cell[] = [];
  for (const raw of list.split(/,(?![^(]*\))/)) {
    const [expr, alias] = raw.split(/\s+AS\s+/i).map((x) => x.trim());
    const e = expr.toLowerCase();
    let v: Cell;
    const at = /^@@(?:(global|session|local)\.)?([\w]+)$/i.exec(expr);
    if (at) {
      const name = canonical(at[2]);
      const all = Object.fromEntries(variables(s, at[1]?.toLowerCase() === 'global'));
      if (!(name in all)) return err(1193, 'HY000', `Unknown system variable '${at[2]}'`);
      v = all[name];
      if (v === 'ON' || v === 'OFF') v = v === 'ON' ? '1' : '0';
    } else if (FUNCTIONS[e.replace(/\s+/g, '')]) v = FUNCTIONS[e.replace(/\s+/g, '')](s);
    else if (/^-?\d+(\.\d+)?$/.test(expr)) v = expr;
    else if (/^'[^']*'$/.test(expr)) v = expr.slice(1, -1);
    else if (/^\w+$/.test(expr)) return err(1054, '42S22', `Unknown column '${expr}' in 'SELECT'`);
    else return syntax(expr);
    cols.push(alias ?? expr);
    vals.push(v);
  }
  void srv;
  return rows(cols, [vals], vals.map((v) => v !== null && /^-?\d+(\.\d+)?$/.test(v)));
}

function select(s: Session, sql: string): Result {
  const srv = maria(s.server);
  const m = /^SELECT\s+(.+?)(?:\s+FROM\s+(\S+)(?:\s+(?:AS\s+)?\w+)??(?:\s+WHERE\s+(.+?))?(?:\s+GROUP\s+BY\s+(\w+))?(?:\s+ORDER\s+BY\s+(\w+)(?:\s+(ASC|DESC))?)?(?:\s+LIMIT\s+(\d+)(?:\s*(?:,|OFFSET)\s*(\d+))?)?)?$/is.exec(sql);
  if (!m) return syntax(sql.replace(/^SELECT\s+/i, ''));
  if (!m[2]) return selectNoTable(s, m[1]);
  const src = readable(s, m[2]);
  if ('error' in src) return src;
  if (!('columns' in src)) return src as Result;
  const clock = now(s.server);
  let data = filter(src.columns, src.data, m[3], clock);
  if (!Array.isArray(data)) return data;
  const lower = src.columns.map((c) => c.toLowerCase());
  const index = (c: string) => lower.indexOf(c.toLowerCase());
  let time = 0.0005;
  if (src.table) {
    const c = cost(src.table, m[3]);
    time = c.time;
    slowLog(s.server, { user: s.user, host: s.host, ip: s.conn.ip, id: s.conn.id, db: s.db, time, examined: c.examined, sent: data.length, query: sql });
  }
  // The columns asked for.
  const list = m[1].split(/,(?![^(]*\))/).map((x) => x.trim());
  type Pick = { label: string; at: number | 'count' };
  const picks: Pick[] = [];
  for (const raw of list) {
    const [expr, alias] = raw.split(/\s+AS\s+/i).map((x) => x.trim());
    if (expr === '*') src.columns.forEach((c, i) => picks.push({ label: c, at: i }));
    else if (/^count\(\s*(\*|1|\w+)\s*\)$/i.test(expr)) picks.push({ label: alias ?? expr, at: 'count' });
    else {
      const name = expr.replace(/^\w+\./, '');
      const i = index(name);
      if (i < 0) return err(1054, '42S22', `Unknown column '${name}' in 'SELECT'`);
      picks.push({ label: alias ?? src.columns[i], at: i });
    }
  }
  if (m[5]) {
    const i = index(m[5]);
    if (i < 0) return err(1054, '42S22', `Unknown column '${m[5]}' in 'ORDER BY'`);
    const desc = m[6]?.toUpperCase() === 'DESC';
    data = [...data].sort((a, b) => {
      const x = a[i] ?? '';
      const y = b[i] ?? '';
      const r = /^-?\d+(\.\d+)?$/.test(x) && /^-?\d+(\.\d+)?$/.test(y) ? Number(x) - Number(y) : x.localeCompare(y);
      return desc ? -r : r;
    });
  }
  let out: Cell[][];
  if (m[4]) {
    const g = index(m[4]);
    if (g < 0) return err(1054, '42S22', `Unknown column '${m[4]}' in 'GROUP BY'`);
    const groupsOf = new Map<string, Cell[][]>();
    for (const r of data) {
      const k = r[g] ?? '\\N';
      groupsOf.set(k, [...(groupsOf.get(k) ?? []), r]);
    }
    out = [...groupsOf.values()].map((rs) => picks.map((p) => (p.at === 'count' ? String(rs.length) : rs[0][p.at])));
    if (!m[5]) out.sort((a, b) => String(a[picks.findIndex((p) => p.at === g)] ?? '').localeCompare(String(b[picks.findIndex((p) => p.at === g)] ?? '')));
  } else if (picks.some((p) => p.at === 'count')) {
    const n = src.table && !m[3] && src.table.declared ? src.table.declared : data.length;
    out = [picks.map((p) => (p.at === 'count' ? String(n) : (data[0]?.[p.at] ?? null)))];
  } else out = data.map((r) => picks.map((p) => r[p.at as number]));
  if (m[7]) out = out.slice(Number(m[8] ?? 0), Number(m[8] ?? 0) + Number(m[7]));
  const numeric = picks.map((p, k) => p.at === 'count' || (src.table ? numericType(src.table.columns[p.at as number]?.type ?? '') : out.length > 0 && out.every((r) => r[k] !== null && /^-?\d+$/.test(r[k] ?? ''))));
  return { rows: { columns: picks.map((p) => p.label), data: out, numeric }, time };
}

function explain(s: Session, sql: string): Result {
  const m = /^SELECT\s+.+?\s+FROM\s+(\S+)(?:\s+WHERE\s+(.+?))?(?:\s+ORDER\s+BY\s+(\w+)(?:\s+(?:ASC|DESC))?)?(?:\s+LIMIT\s+\d+)?$/is.exec(sql);
  if (!m) return syntax(sql);
  const src = readable(s, m[1]);
  if ('error' in src) return src;
  if (!('columns' in src) || !src.table) return rows(['id', 'select_type', 'table', 'type', 'possible_keys', 'key', 'key_len', 'ref', 'rows', 'Extra'], [['1', 'SIMPLE', src && 'name' in src ? (src as { name: string }).name : null, 'ALL', null, null, null, null, '1', '']], [true, false, false, false, false, false, false, false, true, false]);
  const t = src.table;
  const c = cost(t, m[2]);
  const order = m[3]?.toLowerCase();
  const sortedByIndex = c.index && order && c.index.columns[1]?.toLowerCase() === order;
  const extra = [m[2] && !c.index ? 'Using where' : '', order && !sortedByIndex ? 'Using filesort' : ''].filter(Boolean).join('; ');
  const row: Cell[] = c.index
    ? ['1', 'SIMPLE', src.name, c.index.name === 'PRIMARY' ? 'const' : 'ref', c.index.name, c.index.name, '4', 'const', String(c.examined), extra || null]
    : ['1', 'SIMPLE', src.name, 'ALL', null, null, null, null, String(c.examined), extra || null];
  return rows(['id', 'select_type', 'table', 'type', 'possible_keys', 'key', 'key_len', 'ref', 'rows', 'Extra'], [row], [true, false, false, false, false, false, false, false, true, false]);
}

// ——— Writes ———

function writable(s: Session, ref: string, priv: string): { db: string; table: string; t: Table } | Result {
  const srv = maria(s.server);
  const { db, table } = tableRef(s, ref);
  if (!db) return noDb();
  // mysql.user is a view over mysql.global_priv since 10.4: not writable (accounts change with CREATE USER, GRANT…).
  if (db.toLowerCase() === 'mysql' && /^(user|global_priv)$/i.test(table)) {
    if (!allowed(srv, s.account, priv, 'mysql', table)) return denied(s, priv, 'mysql', table.toLowerCase());
    return priv === 'INSERT' ? err(1471, 'HY000', `The target table ${table} of the INSERT is not insertable-into`) : err(1288, 'HY000', `The target table ${table} of the ${priv} is not updatable`);
  }
  const t = srv.databases[db]?.tables[table];
  if (!t) return err(1146, '42S02', `Table '${db}.${table}' doesn't exist`);
  if (!allowed(srv, s.account, priv, db, table)) return denied(s, priv, db, table);
  if (readOnlyRefused(s)) return readOnlyError();
  return { db, table, t };
}

function insert(s: Session, sql: string): Result {
  const m = /^INSERT\s+(?:IGNORE\s+)?INTO\s+(\S+?)\s*(?:\(([^)]*)\))?\s*VALUES\s*([\s\S]+)$/i.exec(sql);
  if (!m) return syntax(sql.replace(/^INSERT\s+/i, ''));
  const w = writable(s, m[1], 'INSERT');
  if ('error' in w) return w;
  if (!('t' in w)) return w as Result;
  const { db, table, t } = w;
  const names = m[2] ? m[2].split(',').map((c) => ident(c)) : t.columns.map((c) => c.name);
  const unknown = names.find((n) => !t.columns.some((c) => c.name.toLowerCase() === n.toLowerCase()));
  if (unknown) return err(1054, '42S22', `Unknown column '${unknown}' in 'INSERT INTO'`);
  const gs = groups(m[3].trim());
  if (!gs) return syntax(m[3]);
  const k = keyIndex(t);
  let n = 0;
  for (const [g, text] of gs.entries()) {
    const values = readValues(text, now(s.server));
    if (!values) return syntax(text);
    if (values.length !== names.length) return err(1136, '21S01', `Column count doesn't match value count at row ${g + 1}`);
    const row: Cell[] = t.columns.map((c) => {
      const i = names.findIndex((x) => x.toLowerCase() === c.name.toLowerCase());
      return i < 0 ? null : values[i];
    });
    if (row[k] === null && t.columns[k]?.autoIncrement) row[k] = String(t.autoIncrement);
    const missing = t.columns.find((c, i) => c.notNull && row[i] === null && !c.autoIncrement);
    if (missing) return err(1364, 'HY000', `Field '${missing.name}' doesn't have a default value`);
    const e = writeRow(s.server, db, table, 'insert', row);
    if (e) return { error: e };
    n++;
  }
  return n > 1 ? ok(n, `Records: ${n}  Duplicates: 0  Warnings: 0`) : ok(n);
}

function update(s: Session, sql: string): Result {
  const m = /^UPDATE\s+(\S+)\s+SET\s+(.+?)(?:\s+WHERE\s+(.+))?$/is.exec(sql);
  if (!m) return syntax(sql.replace(/^UPDATE\s+/i, ''));
  const w = writable(s, m[1], 'UPDATE');
  if ('error' in w) return w;
  if (!('t' in w)) return w as Result;
  const { db, table, t } = w;
  const sets: [number, Cell][] = [];
  for (const part of m[2].split(/,(?=(?:[^']*'[^']*')*[^']*$)/)) {
    const kv = /^\s*(\w+)\s*=\s*(.+?)\s*$/s.exec(part);
    if (!kv) return syntax(part);
    const i = t.columns.findIndex((c) => c.name.toLowerCase() === kv[1].toLowerCase());
    if (i < 0) return err(1054, '42S22', `Unknown column '${kv[1]}' in 'SET'`);
    const v = readValues(kv[2], now(s.server));
    if (!v || v.length !== 1) return syntax(kv[2]);
    sets.push([i, v[0]]);
  }
  const target = filter(t.columns.map((c) => c.name), t.rows, m[3], now(s.server));
  if (!Array.isArray(target)) return target;
  let changed = 0;
  for (const r of target) {
    const next = [...r];
    for (const [i, v] of sets) next[i] = v;
    if (next.every((x, i) => x === r[i])) continue;
    const e = writeRow(s.server, db, table, 'update', next);
    if (e) return { error: e };
    changed++;
  }
  return ok(changed, `Rows matched: ${target.length}  Changed: ${changed}  Warnings: 0`);
}

function remove(s: Session, sql: string): Result {
  const m = /^DELETE\s+FROM\s+(\S+)(?:\s+WHERE\s+(.+?))?(?:\s+LIMIT\s+(\d+))?$/is.exec(sql);
  if (!m) return syntax(sql.replace(/^DELETE\s+/i, ''));
  // mysql.db: database-level grants, removed by hand as mariadb-secure-installation does (then FLUSH PRIVILEGES).
  if (/^mysql\.db$/i.test(m[1]) || (s.db === 'mysql' && /^db$/i.test(m[1]))) {
    const srv = maria(s.server);
    if (!allowed(srv, s.account, 'DELETE', 'mysql', 'db')) return denied(s, 'DELETE', 'mysql', 'db');
    const all = dbRows(srv);
    const kept = filter(DB_COLUMNS, all, m[2], now(s.server));
    if (!Array.isArray(kept)) return kept;
    const gone = new Set(kept.map((r) => all.indexOf(r)));
    const before = srv.dbGrants.length;
    srv.dbGrants = srv.dbGrants.filter((_, i) => !gone.has(i));
    return ok(before - srv.dbGrants.length);
  }
  const w = writable(s, m[1], 'DELETE');
  if ('error' in w) return w;
  if (!('t' in w)) return w as Result;
  const { db, table, t } = w;
  let target = filter(t.columns.map((c) => c.name), t.rows, m[2], now(s.server));
  if (!Array.isArray(target)) return target;
  if (m[3]) target = target.slice(0, Number(m[3]));
  for (const r of [...target]) writeRow(s.server, db, table, 'delete', r);
  return ok(target.length);
}

// ——— DDL ———

function ddl(s: Session, sql: string): Result | null {
  const srv = maria(s.server);
  const createDb = /^CREATE\s+(?:DATABASE|SCHEMA)\s+(IF\s+NOT\s+EXISTS\s+)?(\w+)(?:\s+.*)?$/i.exec(sql);
  if (createDb) {
    const name = createDb[2];
    if (!allowed(srv, s.account, 'CREATE', name)) return err(1044, '42000', `Access denied for user '${s.account.user}'@'${s.account.host}' to database '${name}'`);
    if (srv.databases[name] || SYSTEM_DATABASES.includes(name)) return createDb[1] ? { ok: { affected: 0, warnings: 1 } } : err(1007, 'HY000', `Can't create database '${name}'; database exists`);
    if (readOnlyRefused(s)) return readOnlyError();
    srv.databases[name] = { tables: {} };
    return ok(1);
  }
  const dropDb = /^DROP\s+(?:DATABASE|SCHEMA)\s+(IF\s+EXISTS\s+)?(\w+)$/i.exec(sql);
  if (dropDb) {
    const name = dropDb[2];
    if (!allowed(srv, s.account, 'DROP', name)) return err(1044, '42000', `Access denied for user '${s.account.user}'@'${s.account.host}' to database '${name}'`);
    if (!srv.databases[name]) return dropDb[1] ? { ok: { affected: 0, warnings: 1 } } : err(1008, 'HY000', `Can't drop database '${name}'; database doesn't exist`);
    if (readOnlyRefused(s)) return readOnlyError();
    const n = Object.keys(srv.databases[name].tables).length;
    delete srv.databases[name];
    if (s.db === name) s.db = null;
    return ok(n);
  }
  if (/^CREATE\s+TABLE\s/i.test(sql)) return createTable(s, sql);
  const dropTable = /^DROP\s+TABLE\s+(IF\s+EXISTS\s+)?(.+)$/i.exec(sql);
  if (dropTable) {
    for (const ref of dropTable[2].split(',')) {
      const { db, table } = tableRef(s, ref);
      if (!db) return noDb();
      const d = srv.databases[db];
      if (!d?.tables[table]) {
        if (dropTable[1]) continue;
        return err(1051, '42S02', `Unknown table '${db}.${table}'`);
      }
      if (!allowed(srv, s.account, 'DROP', db, table)) return denied(s, 'DROP', db, table);
      if (readOnlyRefused(s)) return readOnlyError();
      delete d.tables[table];
    }
    return ok(0);
  }
  const truncate = /^TRUNCATE\s+(?:TABLE\s+)?(\S+)$/i.exec(sql);
  if (truncate) {
    const w = writable(s, truncate[1], 'DROP');
    if ('error' in w) return w;
    if (!('t' in w)) return w as Result;
    for (const r of [...w.t.rows]) writeRow(s.server, w.db, w.table, 'delete', r);
    return ok(0);
  }
  const createIndex = /^CREATE\s+(UNIQUE\s+)?INDEX\s+(\w+)\s+ON\s+(\S+?)\s*\(([^)]*)\)$/i.exec(sql);
  const alterAdd = /^ALTER\s+TABLE\s+(\S+)\s+ADD\s+(UNIQUE\s+)?(?:INDEX|KEY)\s+(\w+)?\s*\(([^)]*)\)$/i.exec(sql);
  if (createIndex || alterAdd) {
    const ref = createIndex ? createIndex[3] : alterAdd![1];
    const unique = !!(createIndex ? createIndex[1] : alterAdd![2]);
    const cols = (createIndex ? createIndex[4] : alterAdd![4]).split(',').map((c) => ident(c.replace(/\(\d+\)$/, '')));
    const name = (createIndex ? createIndex[2] : alterAdd![3]) ?? cols[0];
    const w = writable(s, ref, 'INDEX');
    if ('error' in w) return w;
    if (!('t' in w)) return w as Result;
    const missing = cols.find((c) => !w.t.columns.some((x) => x.name.toLowerCase() === c.toLowerCase()));
    if (missing) return err(1072, '42000', `Key column '${missing}' doesn't exist in table`);
    if (w.t.indexes.some((i) => i.name.toLowerCase() === name.toLowerCase())) return err(1061, '42000', `Duplicate key name '${name}'`);
    w.t.indexes.push({ name, columns: cols.map((c) => w.t.columns.find((x) => x.name.toLowerCase() === c.toLowerCase())!.name), ...(unique ? { unique: true } : {}) });
    const rowsCount = w.t.declared ?? w.t.rows.length;
    return { ok: { affected: 0, info: 'Records: 0  Duplicates: 0  Warnings: 0' }, time: Math.max(0.01, rowsCount / 160_000) };
  }
  const dropA = /^DROP\s+INDEX\s+(\w+)\s+ON\s+(\S+)$/i.exec(sql);
  const dropB = /^ALTER\s+TABLE\s+(\S+)\s+DROP\s+(?:INDEX|KEY)\s+(\w+)$/i.exec(sql);
  if (dropA || dropB) {
    const [indexName, ref] = dropA ? [dropA[1], dropA[2]] : [dropB![2], dropB![1]];
    const w = writable(s, ref, 'INDEX');
    if ('error' in w) return w;
    if (!('t' in w)) return w as Result;
    const at = w.t.indexes.findIndex((i) => i.name.toLowerCase() === indexName.toLowerCase());
    if (at < 0) return err(1091, '42000', `Can't DROP INDEX \`${indexName}\`; check that it exists`);
    w.t.indexes.splice(at, 1);
    return { ok: { affected: 0, info: 'Records: 0  Duplicates: 0  Warnings: 0' } };
  }
  return null;
}

// ——— SHOW ———

function show(s: Session, sql: string): Result | null {
  const srv = maria(s.server);
  if (/^SHOW\s+(DATABASES|SCHEMAS)(\s+LIKE\s+'([^']*)')?$/i.test(sql)) {
    const like = likeName(/LIKE\s+'([^']*)'/i.exec(sql)?.[1]);
    const all = [...new Set([...Object.keys(srv.databases), ...SYSTEM_DATABASES])].sort();
    const seeAll = allowed(srv, s.account, 'SHOW DATABASES');
    return rows(['Database'], all.filter((d) => like(d) && (seeAll || anyOn(srv, s.account, d))).map((d) => [d]));
  }
  const tables = /^SHOW\s+(FULL\s+)?TABLES(?:\s+(?:FROM|IN)\s+(\w+))?(?:\s+LIKE\s+'([^']*)')?$/i.exec(sql);
  if (tables) {
    const db = tables[2] ?? s.db;
    if (!db) return noDb();
    if (!srv.databases[db] && !SYSTEM_DATABASES.includes(db)) return err(1049, '42000', `Unknown database '${db}'`);
    if (!anyOn(srv, s.account, db)) return err(1044, '42000', `Access denied for user '${s.account.user}'@'${s.account.host}' to database '${db}'`);
    const like = likeName(tables[3]);
    const names = Object.keys(srv.databases[db]?.tables ?? {}).filter((t) => like(t) && (allowed(srv, s.account, 'SELECT', db, t) || anyOn(srv, s.account, db))).sort();
    return tables[1] ? rows([`Tables_in_${db}`, 'Table_type'], names.map((n) => [n, 'BASE TABLE'])) : rows([`Tables_in_${db}`], names.map((n) => [n]));
  }
  const proc = /^SHOW\s+(FULL\s+)?PROCESSLIST$/i.exec(sql);
  if (proc) {
    const all = allowed(srv, s.account, 'PROCESS');
    const data = processRows(srv, now(s.server), !!proc[1]).filter((r) => all || r[1] === s.account.user);
    return rows(PROCESSLIST, data, PROCESSLIST.map((c) => c === 'Id' || c === 'Time' || c === 'Progress'));
  }
  const vars = /^SHOW\s+(GLOBAL\s+|SESSION\s+|LOCAL\s+)?VARIABLES(?:\s+LIKE\s+(?:'([^']*)'|"([^"]*)")|\s+WHERE\s+(.+))?$/i.exec(sql);
  if (vars) {
    const like = likeName(vars[2] ?? vars[3]);
    let data: Cell[][] = variables(s, /GLOBAL/i.test(vars[1] ?? '')).filter(([n]) => like(n));
    if (vars[4]) {
      const f = filter(['variable_name', 'value'], data, vars[4], now(s.server));
      if (!Array.isArray(f)) return f;
      data = f;
    }
    return rows(['Variable_name', 'Value'], data);
  }
  const stat = /^SHOW\s+(GLOBAL\s+|SESSION\s+)?STATUS(?:\s+LIKE\s+'([^']*)')?$/i.exec(sql);
  if (stat) {
    const like = likeName(stat[2]);
    return rows(['Variable_name', 'Value'], status(s).filter(([n]) => like(n)));
  }
  const create = /^SHOW\s+CREATE\s+TABLE\s+(\S+)$/i.exec(sql);
  if (create) {
    const src = readable(s, create[1]);
    if ('error' in src) return src;
    if (!('table' in src) || !src.table) return syntax(create[1]);
    return rows(['Table', 'Create Table'], [[src.name, createText(src.name, src.table)]]);
  }
  const idx = /^SHOW\s+(?:INDEX|INDEXES|KEYS)\s+(?:FROM|IN)\s+(\S+)(?:\s+(?:FROM|IN)\s+(\w+))?$/i.exec(sql);
  if (idx) {
    const src = readable(s, idx[2] ? `${idx[2]}.${idx[1]}` : idx[1]);
    if ('error' in src) return src;
    if (!('table' in src) || !src.table) return syntax(idx[1]);
    const t = src.table;
    const data: Cell[][] = t.indexes.flatMap((i) => i.columns.map((c, k) => [src.name, i.unique ? '0' : '1', i.name, String(k + 1), c, 'A', String(i.unique ? (t.declared ?? t.rows.length) : Math.round((t.declared ?? t.rows.length) / perValue(t, i))), null, null, '', 'BTREE', '', '', 'NO']));
    return rows(['Table', 'Non_unique', 'Key_name', 'Seq_in_index', 'Column_name', 'Collation', 'Cardinality', 'Sub_part', 'Packed', 'Null', 'Index_type', 'Comment', 'Index_comment', 'Ignored'], data, [false, true, false, true, false, false, true]);
  }
  if (/^SHOW\s+WARNINGS$/i.test(sql)) return rows(['Level', 'Code', 'Message'], []);
  return null;
}

// ——— The statement ———

/** Runs one statement on a session; the result for the client to print. */
export function run(s: Session, raw: string): Result {
  const r = runOne(s, raw);
  if (!('error' in r)) {
    const sql = clean(raw);
    const marks: [RegExp, string][] = [
      [/^SHOW\s+(FULL\s+)?PROCESSLIST|information_schema\.processlist/i, 'processlist'],
      [/^SHOW\s+(ALL\s+)?(SLAVE|REPLICA)S?\s+STATUS/i, 'replica-status'],
      [/^SHOW\s+GRANTS|FROM\s+mysql\.(user|global_priv|db)\b/i, 'grants'],
      [/^CHECKSUM\s+TABLE/i, 'checksum'],
      [/^SHOW\s+.*VARIABLES|^SELECT\s+@@/i, 'variables'],
      [/^SHOW\s+DATABASES/i, 'databases'],
    ];
    for (const [re, what] of marks) if (re.test(sql)) look(s.server, what);
    const e = /^EXPLAIN\s+(?:EXTENDED\s+)?SELECT\s.+?\sFROM\s+(\S+)/is.exec(sql);
    if (e) look(s.server, `explain:${e[1].split('.').at(-1)!.toLowerCase()}`);
  }
  return r;
}

function runOne(s: Session, raw: string): Result {
  const srv = maria(s.server);
  const sql = clean(raw);
  if (!sql) return err(1065, '42000', 'Query was empty');
  srv.questions++;
  if (/^(BEGIN|START\s+TRANSACTION(\s+WITH\s+CONSISTENT\s+SNAPSHOT)?|COMMIT|ROLLBACK|UNLOCK\s+TABLES|LOCK\s+TABLES\s+.+|ALTER\s+TABLE\s+\S+\s+(DISABLE|ENABLE)\s+KEYS|FLUSH\s+(PRIVILEGES|LOGS|TABLES|TABLES\s+WITH\s+READ\s+LOCK|BINARY\s+LOGS|STATUS))$/i.test(sql)) {
    if (/^FLUSH\s/i.test(sql) && !allowed(srv, s.account, 'RELOAD')) return needs('RELOAD');
    return ok(0);
  }
  const use = /^USE\s+(\w+)$/i.exec(sql);
  if (use) {
    const db = use[1];
    if (!srv.databases[db] && !SYSTEM_DATABASES.includes(db)) return err(1049, '42000', `Unknown database '${db}'`);
    if (!anyOn(srv, s.account, db)) return err(1044, '42000', `Access denied for user '${s.account.user}'@'${s.account.host}' to database '${db}'`);
    s.db = db;
    s.conn.db = db;
    return { use: db };
  }
  const k = /^KILL\s+(?:(CONNECTION|QUERY)\s+)?(\d+)$/i.exec(sql);
  if (k) {
    const id = Number(k[2]);
    const target = srv.conns.find((c) => c.id === id);
    if (!target) return err(1094, 'HY000', `Unknown thread id: ${id}`);
    if (target.user !== s.account.user && !allowed(srv, s.account, 'CONNECTION ADMIN')) return err(1095, 'HY000', `You are not owner of thread ${id}`);
    if (k[1]?.toUpperCase() === 'QUERY') {
      target.busyUntil = undefined;
      target.command = 'Sleep';
      target.info = null;
      target.state = '';
      return ok(0);
    }
    kill(s.server, id);
    return ok(0);
  }
  const checksumTable = /^CHECKSUM\s+TABLES?\s+(.+?)(\s+(QUICK|EXTENDED))?$/i.exec(sql);
  if (checksumTable) {
    const data: Cell[][] = [];
    for (const ref of checksumTable[1].split(',')) {
      const { db, table } = tableRef(s, ref.trim());
      if (!db) return noDb();
      const t = srv.databases[db]?.tables[table];
      if (t && !allowed(srv, s.account, 'SELECT', db, table)) return denied(s, 'SELECT', db, table);
      data.push([`${db}.${table}`, t ? String(checksum(t)) : null]);
    }
    return rows(['Table', 'Checksum'], data, [false, true]);
  }
  if (/^EXPLAIN\s+(EXTENDED\s+)?SELECT\s/i.test(sql)) return explain(s, sql.replace(/^EXPLAIN\s+(EXTENDED\s+)?/i, ''));
  if (/^SELECT\s/i.test(sql)) return select(s, sql);
  if (/^INSERT\s/i.test(sql)) return insert(s, sql);
  if (/^UPDATE\s/i.test(sql)) return update(s, sql);
  if (/^DELETE\s/i.test(sql)) return remove(s, sql);
  const r = replication(s, sql) ?? userStatement(s, sql) ?? ddl(s, sql) ?? show(s, sql) ?? set(s, sql);
  if (r) return r;
  return syntax(sql);
}
