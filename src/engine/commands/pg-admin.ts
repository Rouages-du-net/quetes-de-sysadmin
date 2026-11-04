// The server-administration side of psql, on the model of ../pg-server.ts:
// pg_stat_activity (SELECT columns or count(*), WHERE col = 'value' [AND …]),
// pg_terminate_backend(pid), SHOW, ALTER SYSTEM SET/RESET, pg_reload_conf(),
// EXPLAIN [ANALYZE] of a SELECT … WHERE col = value, CREATE INDEX, DROP
// INDEX, \di, and ANALYZE/VACUUM (accepted, without effect on the plans).
// Outputs after PostgreSQL 16: https://www.postgresql.org/docs/16/sql-explain.html,
// https://www.postgresql.org/docs/16/sql-createindex.html,
// https://www.postgresql.org/docs/16/functions-admin.html
// Differences: one table per query, conditions joined by AND only, costs
// computed from the table's declared size (see pg-server.ts).

import type { Shell } from '../shell';
import { grid, postgres, type Table } from '../postgres';
import { AUTO_CONF, applySettings, DEFAULTS, indexFor, server, setting, terminate, type Backend } from '../pg-server';
import { systemd } from '../systemd';

const COLUMNS = ['datid', 'datname', 'pid', 'usename', 'application_name', 'client_addr', 'backend_start', 'state_change', 'state', 'query'] as const;
const unquote = (v: string) => v.trim().replace(/^'(.*)'$/, '$1');
const superuser = (game: Shell) => game.who === 'postgres';
const time = (ms: number) => `${new Date(ms).toISOString().slice(0, 19).replace('T', ' ')}.${String(ms % 1000).padStart(3, '0')}412+00`;

/** pg_stat_activity as psql sees it: the server's backends, plus the psql session itself. */
function activity(game: Shell, base: string, query: string): Record<string, string>[] {
  const srv = server(game)!;
  const now = systemd(game)?.clock ?? 0;
  const own: Backend = { pid: srv.nextPid + 1000, usename: game.who, datname: base, application_name: 'psql', client_addr: '', state: 'active', since: now, query };
  return [...srv.backends, own].map((b) => ({
    datid: '16384',
    datname: b.datname,
    pid: String(b.pid),
    usename: b.usename,
    application_name: b.application_name,
    client_addr: b.client_addr,
    backend_start: time(b.since - 60_000),
    state_change: time(b.since),
    state: b.state,
    query: b.query,
  }));
}

/** WHERE a = 'x' AND b = 'y' → the matching rows, or an error. */
function where(rows: Record<string, string>[], condition: string | undefined): Record<string, string>[] | string {
  if (!condition) return rows;
  const parts = condition.split(/\s+and\s+/i).map((c) => /^(\w+)\s*(=|<>|!=)\s*('[^']*'|\d+)$/.exec(c.trim()));
  if (parts.some((p) => !p)) return `ERROR:  syntax error at or near "${condition.trim().split(/\s+/)[1] ?? condition}"`;
  const unknown = parts.find((p) => !(COLUMNS as readonly string[]).includes(p![1]));
  if (unknown) return `ERROR:  column "${unknown[1]}" does not exist`;
  return rows.filter((r) => parts.every((p) => (p![2] === '=' ? r[p![1]] === unquote(p![3]) : r[p![1]] !== unquote(p![3]))));
}

/** EXPLAIN of a SELECT on one table: an index scan if an index covers the condition, otherwise a sequential scan. */
function explain(game: Shell, base: string, statement: string, analyze: boolean): string {
  const m = /^select\s+(.+?)\s+from\s+(\w+)(?:\s+where\s+(\w+)\s*=\s*('?[^']*'?|\d+))?(?:\s+order\s+by\s+\w+(?:\s+desc)?)?(?:\s+limit\s+\d+)?$/i.exec(statement);
  if (!m) return game.error(`ERROR:  syntax error at or near "${statement.split(/\s+/)[0]}"`);
  const table = m[2].toLowerCase();
  const t: Table | undefined = postgres(game)!.bases[base].tables[table];
  if (!t) return game.error(`ERROR:  relation "${m[2]}" does not exist\nLINE 1: EXPLAIN ${statement}\n${' '.repeat(9 + statement.toLowerCase().indexOf(table))}^`);
  if (m[3] && !t.columns.includes(m[3])) return game.error(`ERROR:  column "${m[3]}" does not exist`);
  const total = server(game)?.sizes?.[table] ?? t.lines.length;
  const i = m[3] ? t.columns.indexOf(m[3]) : -1;
  const found = m[3] ? t.lines.filter((l) => l[i] === unquote(m[4])).length : total;
  const width = 12 + 4 * t.columns.length;
  const pages = Math.max(1, Math.round(total / 120));
  const index = m[3] ? indexFor(game, table, m[3]) : undefined;
  const lines: string[] = [];
  let ms: number;
  if (index) {
    const cost = (4.3 + found * 0.04).toFixed(2);
    lines.push(`Index Scan using ${index.name} on ${table}  (cost=0.42..${cost} rows=${found} width=${width})${analyze ? ` (actual time=0.031..${(0.2 + found * 0.0011).toFixed(3)} rows=${found} loops=1)` : ''}`);
    lines.push(`  Index Cond: (${m[3]} = ${/^\d+$/.test(unquote(m[4])) ? unquote(m[4]) : `'${unquote(m[4])}'::text`})`);
    ms = 0.2 + found * 0.0012;
  } else {
    const cost = (pages + total * 0.0125).toFixed(2);
    // Large tables: PostgreSQL reads them with two parallel workers.
    if (total > 100_000) {
      lines.push(`Gather  (cost=1000.00..${(Number(cost) * 0.7).toFixed(2)} rows=${found} width=${width})${analyze ? ` (actual time=2.114..${(total * 0.010025).toFixed(3)} rows=${found} loops=1)` : ''}`);
      lines.push('  Workers Planned: 2');
      if (analyze) lines.push('  Workers Launched: 2');
      lines.push(`  ->  Parallel Seq Scan on ${table}  (cost=0.00..${(Number(cost) * 0.6).toFixed(2)} rows=${Math.round(found / 2.4)} width=${width})${analyze ? ` (actual time=1.032..${(total * 0.0097).toFixed(3)} rows=${Math.round(found / 3)} loops=3)` : ''}`);
      if (m[3]) lines.push(`        Filter: (${m[3]} = ${/^\d+$/.test(unquote(m[4])) ? unquote(m[4]) : `'${unquote(m[4])}'::text`})`);
      if (m[3] && analyze) lines.push(`        Rows Removed by Filter: ${Math.round((total - found) / 3)}`);
    } else {
      lines.push(`Seq Scan on ${table}  (cost=0.00..${cost} rows=${found} width=${width})${analyze ? ` (actual time=0.012..${(total * 0.0004).toFixed(3)} rows=${found} loops=1)` : ''}`);
      if (m[3]) lines.push(`  Filter: (${m[3]} = ${/^\d+$/.test(unquote(m[4])) ? unquote(m[4]) : `'${unquote(m[4])}'::text`})`);
      if (m[3] && analyze) lines.push(`  Rows Removed by Filter: ${total - found}`);
    }
    ms = total > 100_000 ? total * 0.010025 : total * 0.0004;
  }
  if (analyze) lines.push('Planning Time: 0.118 ms', `Execution Time: ${ms.toFixed(3)} ms`);
  return grid(['QUERY PLAN'], lines.map((l) => [l]));
}

/**
 * The administration statements; null if the statement is not one of them
 * (psql then tries the ordinary SQL of commands/postgres.ts).
 */
export function adminSql(game: Shell, base: string, r: string): string | null {
  const srv = server(game);
  if (!srv) return null;
  const pg = postgres(game)!;

  // SHOW name
  const show = /^show\s+(\w+)$/i.exec(r);
  if (show) {
    const name = show[1].toLowerCase();
    if (!(name in srv.settings) && !(name in DEFAULTS)) return game.error(`ERROR:  unrecognized configuration parameter "${show[1]}"`);
    return grid([name], [[setting(game, name)]]);
  }
  // ALTER SYSTEM SET name = value / TO value; ALTER SYSTEM RESET name
  const alter = /^alter\s+system\s+(?:set\s+(\w+)\s*(?:=|to)\s*('[^']*'|[\w.-]+)|reset\s+(\w+))$/i.exec(r);
  if (alter) {
    if (!superuser(game)) return game.error('ERROR:  permission denied to set parameter "' + (alter[1] ?? alter[3]) + '"');
    const name = (alter[1] ?? alter[3]).toLowerCase();
    if (!(name in DEFAULTS)) return game.error(`ERROR:  unrecognized configuration parameter "${name}"`);
    const lines = (game.read(AUTO_CONF) ?? '# Do not edit this file manually!\n# It will be overwritten by the ALTER SYSTEM command.').split('\n').filter((l) => !new RegExp(`^\\s*${name}\\s*=`).test(l));
    if (alter[1]) lines.push(`${name} = '${unquote(alter[2])}'`);
    const n = game.find(AUTO_CONF);
    if (n?.type === 'file') n.content = lines.join('\n');
    else game.place('postgres', AUTO_CONF, { type: 'file', content: lines.join('\n'), owner: 'postgres', mode: 'rw-------' });
    return 'ALTER SYSTEM';
  }
  // SELECT pg_reload_conf()
  if (/^select\s+pg_reload_conf\(\)$/i.test(r)) {
    if (!superuser(game)) return game.error('ERROR:  permission denied for function pg_reload_conf');
    applySettings(game, false);
    return grid(['pg_reload_conf'], [['t']]);
  }
  // SELECT pg_terminate_backend(1234)
  const one = /^select\s+pg_terminate_backend\((\d+)\)$/i.exec(r);
  if (one) {
    const b = srv.backends.find((x) => x.pid === Number(one[1]));
    if (b && !superuser(game) && b.usename !== game.who)
      return game.error(`ERROR:  permission denied to terminate process\nDETAIL:  Only roles with privileges of the role whose process is being terminated or with privileges of the "pg_signal_backend" role may terminate this process.`);
    if (!b) game.error(`WARNING:  PID ${one[1]} is not a PostgreSQL backend process`);
    return grid(['pg_terminate_backend'], [[b && terminate(game, b.pid) ? 't' : 'f']]);
  }
  // Queries on pg_stat_activity (count(*), columns, pg_terminate_backend(pid)).
  const act = /^select\s+(.+?)\s+from\s+pg_stat_activity(?:\s+where\s+(.+?))?(?:\s+order\s+by\s+(\w+)(\s+desc)?)?(?:\s+limit\s+(\d+))?$/i.exec(r);
  if (act) {
    let rows = where(activity(game, base, r), act[2]);
    if (typeof rows === 'string') return game.error(rows);
    if (act[3]) {
      const k = act[3];
      if (!(COLUMNS as readonly string[]).includes(k)) return game.error(`ERROR:  column "${k}" does not exist`);
      rows = [...rows].sort((a, z) => (/^\d+$/.test(a[k]) ? Number(a[k]) - Number(z[k]) : a[k].localeCompare(z[k])) * (act[4] ? -1 : 1));
    }
    if (act[5]) rows = rows.slice(0, Number(act[5]));
    const what = act[1].trim();
    if (/^count\(\*\)$/i.test(what)) return grid(['count'], [[String(rows.length)]]);
    if (/^pg_terminate_backend\(pid\)$/i.test(what)) {
      const results = rows.map((row) => {
        const b = srv.backends.find((x) => String(x.pid) === row.pid);
        if (!b) return 'f';
        if (!superuser(game) && b.usename !== game.who) return 'f';
        return terminate(game, b.pid) ? 't' : 'f';
      });
      return grid(['pg_terminate_backend'], results.map((x) => [x]));
    }
    const columns = what === '*' ? [...COLUMNS] : what.split(',').map((c) => c.trim());
    const unknown = columns.find((c) => !(COLUMNS as readonly string[]).includes(c));
    if (unknown) return game.error(`ERROR:  column "${unknown}" does not exist`);
    return grid(columns, rows.map((row) => columns.map((c) => row[c])));
  }
  // EXPLAIN [ANALYZE] SELECT …
  const ex = /^explain\s+(analyze\s+)?(select\s+.+)$/i.exec(r);
  if (ex) return explain(game, base, ex[2], !!ex[1]);
  // CREATE INDEX [CONCURRENTLY] [name] ON table [USING btree] (column)
  const create = /^create\s+index\s+(?:concurrently\s+)?(?:(\w+)\s+)?on\s+(\w+)\s*(?:using\s+btree\s*)?\(\s*(\w+)\s*\)$/i.exec(r);
  if (create) {
    const table = create[2].toLowerCase();
    const t = pg.bases[base].tables[table];
    if (!t) return game.error(`ERROR:  relation "${create[2]}" does not exist`);
    if (!t.columns.includes(create[3])) return game.error(`ERROR:  column "${create[3]}" does not exist`);
    if (!superuser(game) && pg.bases[base].owner !== game.who) return game.error(`ERROR:  must be owner of table ${table}`);
    const name = (create[1] ?? `${table}_${create[3]}_idx`).toLowerCase();
    if (srv.indexes.some((i) => i.name === name)) return game.error(`ERROR:  relation "${name}" already exists`);
    srv.indexes.push({ name, table, column: create[3] });
    return 'CREATE INDEX';
  }
  const drop = /^drop\s+index\s+(?:concurrently\s+)?(?:if\s+exists\s+)?(\w+)$/i.exec(r);
  if (drop) {
    const name = drop[1].toLowerCase();
    if (!srv.indexes.some((i) => i.name === name)) return game.error(`ERROR:  index "${name}" does not exist`);
    srv.indexes = srv.indexes.filter((i) => i.name !== name);
    return 'DROP INDEX';
  }
  // \di: the indexes (the primary keys too).
  if (/^\\di\+?$/.test(r)) {
    const own = pg.bases[base].owner;
    const all = [...Object.keys(pg.bases[base].tables).map((t) => ({ name: `${t}_pkey`, table: t })), ...srv.indexes].sort((a, z) => a.name.localeCompare(z.name));
    return grid(['Schema', 'Name', 'Type', 'Owner', 'Table'], all.map((i) => ['public', i.name, 'index', own, i.table]), 'List of relations');
  }
  if (/^(vacuum|analyze)(\s+(analyze|verbose))?(\s+\w+)?$/i.test(r)) return /^analyze/i.test(r) ? 'ANALYZE' : 'VACUUM';
  return null;
}
