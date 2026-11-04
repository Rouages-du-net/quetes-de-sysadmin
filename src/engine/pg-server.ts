// A PostgreSQL server's life: its settings (postgresql.conf, then
// postgresql.auto.conf written by ALTER SYSTEM; some apply on reload, others
// only on restart), its sessions (one backend process per connection, seen in
// pg_stat_activity), the connection limit, and the indexes of a table (what
// EXPLAIN chooses). It complements postgres.ts (databases, tables, roles).
//
//   state.postgres.server = { settings, backends, nextPid, indexes, log }
//
// Sources: https://www.postgresql.org/docs/16/runtime-config-connection.html,
// https://www.postgresql.org/docs/16/runtime-config-client.html#GUC-IDLE-IN-TRANSACTION-SESSION-TIMEOUT,
// https://www.postgresql.org/docs/16/monitoring-stats.html#MONITORING-PG-STAT-ACTIVITY-VIEW,
// https://www.postgresql.org/docs/16/sql-altersystem.html,
// https://www.postgresql.org/docs/16/using-explain.html
// Simplifications: a few settings only; costs and row estimates of EXPLAIN
// come from the table's declared size, not from statistics.

import type { Game } from './shell';
import { postgres } from './postgres';
import { systemd } from './systemd';

export interface Backend {
  pid: number;
  usename: string;
  datname: string;
  application_name: string;
  client_addr: string;
  state: 'active' | 'idle' | 'idle in transaction';
  // When the backend entered its state (systemd clock, ms).
  since: number;
  query: string;
}

export interface Index {
  name: string;
  table: string;
  column: string;
}

export interface PgServer {
  // The settings in force (read at the last start, or reload for those that allow it).
  settings: Record<string, string>;
  backends: Backend[];
  nextPid: number;
  indexes: Index[];
  // The rows of each table, when the table is bigger than its sample (EXPLAIN, count(*)).
  sizes?: Record<string, number>;
  // Roles and privileges, when the chapter models them (pg-roles.ts).
  acl?: import('./pg-roles').Acl;
  // A standby in recovery: read-only, it replays what its primary sends (see the failover chapter).
  recovery?: boolean;
  // A standby's replication: its primary (unreachable or not), the last transaction replayed (ms).
  standby?: { primary: string; address: string; reachable: boolean; replayed: number; timeline: number };
}

export const STANDBY_SIGNAL = '/var/lib/postgresql/16/main/standby.signal';

/** Promotes a standby: it leaves recovery, takes a new timeline, accepts writes. False if it wasn't one. */
export function promote(j: Game): boolean {
  const srv = server(j);
  if (!srv?.recovery) return false;
  srv.recovery = false;
  if (srv.standby) srv.standby.timeline += 1;
  const parent = j.find('/var/lib/postgresql/16/main');
  if (parent?.type === 'directory') delete parent.children['standby.signal'];
  pgLog(j, 702, 'LOG', 'received promote request');
  pgLog(j, 702, 'LOG', 'redo done at 0/3A0001B8 system usage: CPU: user: 0.00 s, system: 0.00 s, elapsed: 0.00 s');
  pgLog(j, 702, 'LOG', `selected new timeline ID: ${srv.standby?.timeline ?? 2}`);
  pgLog(j, 702, 'LOG', 'archive recovery complete');
  pgLog(j, 702, 'LOG', 'database system is ready to accept connections');
  return true;
}

export const CONF = '/etc/postgresql/16/main/postgresql.conf';
export const AUTO_CONF = '/var/lib/postgresql/16/main/postgresql.auto.conf';
export const LOG = '/var/log/postgresql/postgresql-16-main.log';

// Settings that only change with a restart (context "postmaster").
const RESTART_ONLY = ['max_connections', 'superuser_reserved_connections', 'shared_buffers', 'listen_addresses', 'port'];
export const DEFAULTS: Record<string, string> = {
  max_connections: '100',
  superuser_reserved_connections: '3',
  idle_in_transaction_session_timeout: '0',
  statement_timeout: '0',
  shared_buffers: '128MB',
  work_mem: '4MB',
  log_min_duration_statement: '-1',
};

export const server = (j: Game): PgServer | undefined => postgres(j)?.server;

/** The settings written in postgresql.conf, then postgresql.auto.conf (the last one wins). */
export function readSettings(j: Game): Record<string, string> {
  const s: Record<string, string> = { ...DEFAULTS };
  for (const file of [CONF, AUTO_CONF])
    for (const line of (j.read(file) ?? '').split('\n')) {
      const m = /^\s*(\w+)\s*=\s*('([^']*)'|[^#\s]+)/.exec(line);
      if (m) s[m[1].toLowerCase()] = m[3] ?? m[2];
    }
  return s;
}

/** Applies the files' settings: all of them on a restart, only the reloadable ones on a reload. */
export function applySettings(j: Game, restart: boolean) {
  const srv = server(j);
  if (!srv) return;
  const read = readSettings(j);
  for (const [k, v] of Object.entries(read)) if (restart || !RESTART_ONLY.includes(k)) srv.settings[k] = v;
  // A restart closes every connection.
  if (restart) srv.backends = [];
  // A standby starts in recovery as long as its standby.signal file is there.
  if (restart && srv.standby) {
    const was = srv.recovery;
    srv.recovery = !!j.find(STANDBY_SIGNAL);
    if (was && !srv.recovery) {
      srv.standby.timeline += 1;
      pgLog(j, 702, 'LOG', `selected new timeline ID: ${srv.standby.timeline}`);
      pgLog(j, 702, 'LOG', 'database system is ready to accept connections');
    }
  }
}

/** "1min", "30s", "5000" (ms), "0" → milliseconds (0: disabled); null if unreadable. */
export function readDuration(text: string): number | null {
  const m = /^(\d+)\s*(ms|s|min|h|d)?$/.exec(text.trim());
  if (!m) return null;
  return Number(m[1]) * { ms: 1, s: 1000, min: 60_000, h: 3_600_000, d: 86_400_000 }[(m[2] ?? 'ms') as 'ms'];
}

export const setting = (j: Game, name: string) => server(j)?.settings[name] ?? DEFAULTS[name];
const number = (j: Game, name: string) => Number(setting(j, name));

/** How many connections an ordinary role (not a superuser) can still open. */
export const freeSlots = (j: Game) => number(j, 'max_connections') - number(j, 'superuser_reserved_connections') - (server(j)?.backends.length ?? 0);
/** A superuser may also use the reserved slots. */
export const freeForSuperuser = (j: Game) => number(j, 'max_connections') - (server(j)?.backends.length ?? 0);

/** A line of the server's log (/var/log/postgresql/…), like Debian's log_line_prefix. */
export function pgLog(j: Game, pid: number, level: string, message: string) {
  const n = j.find(LOG);
  if (n?.type !== 'file' || typeof n.content !== 'string') return;
  const clock = systemd(j)?.clock ?? 0;
  const d = new Date(clock).toISOString();
  const line = `${d.slice(0, 10)} ${d.slice(11, 23)} UTC [${pid}] ${level}:  ${message}`;
  n.content = n.content ? `${n.content}\n${line}` : line;
}

/** The time passes: idle-in-transaction sessions older than the timeout are ended by the server. */
export function enforceTimeouts(j: Game) {
  const srv = server(j);
  const now = systemd(j)?.clock ?? 0;
  const limit = readDuration(setting(j, 'idle_in_transaction_session_timeout')) ?? 0;
  if (!srv || !limit) return;
  for (const b of [...srv.backends])
    if (b.state === 'idle in transaction' && now - b.since > limit) {
      pgLog(j, b.pid, 'FATAL', 'terminating connection due to idle-in-transaction timeout');
      srv.backends = srv.backends.filter((x) => x !== b);
    }
}

/** Why a new connection would be refused (PostgreSQL 16's messages); null if there is room. */
export function refused(j: Game, superuser: boolean): string | null {
  if (freeForSuperuser(j) <= 0) return 'sorry, too many clients already';
  if (!superuser && freeSlots(j) <= 0) return 'remaining connection slots are reserved for roles with the SUPERUSER attribute';
  return null;
}

/** A new connection (an app's, a visitor's): refused when there is no slot left. */
export function connect(j: Game, b: Omit<Backend, 'pid' | 'since'>, superuser = false): Backend | null {
  const srv = server(j)!;
  const refusal = refused(j, superuser);
  if (refusal) {
    pgLog(j, srv.nextPid, 'FATAL', refusal);
    return null;
  }
  const backend = { ...b, pid: srv.nextPid++, since: systemd(j)?.clock ?? 0 };
  srv.backends.push(backend);
  return backend;
}

/** pg_terminate_backend(pid): true if there was such a backend. */
export function terminate(j: Game, pid: number): boolean {
  const srv = server(j);
  const b = srv?.backends.find((x) => x.pid === pid);
  if (!srv || !b) return false;
  pgLog(j, pid, 'FATAL', 'terminating connection due to administrator command');
  j.state.pgTerminated = (j.state.pgTerminated ?? 0) + 1;
  srv.backends = srv.backends.filter((x) => x !== b);
  return true;
}

/** The index EXPLAIN would use for "WHERE column = …" on this table, if there is one. */
export const indexFor = (j: Game, table: string, column: string) => server(j)?.indexes.find((i) => i.table === table && i.column === column);
