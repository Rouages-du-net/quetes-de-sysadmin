// MariaDB 11.8's client programs (Debian 13's mariadb-client): mariadb (and
// its old name mysql), mariadb-dump (mysqldump), mariadb-admin (mysqladmin),
// mariadb-check (mysqlcheck) and mariadb-secure-installation. The server is
// simulated in mariadb.ts, its SQL in mariadb-sql.ts.
// After https://mariadb.com/kb/en/mariadb-command-line-client/,
// https://mariadb.com/kb/en/mariadb-dump/, https://mariadb.com/kb/en/mariadb-admin/,
// https://mariadb.com/kb/en/mariadb-check/ and
// https://mariadb.com/kb/en/mariadb-secure-installation/.
// The client prints tables on a terminal, tab-separated rows when its output
// goes to a pipe or a file (or with -B), vertical rows with -E or \G; an error
// with -e or a script says the statement's line ("ERROR 1146 (42S02) at line
// 1: …") and stops, unless -f. Without -e and without input, it opens its
// interactive monitor (MariaDB [db]> ).
// Differences: no ~/.my.cnf for the client, no pager, no history; the old
// names (mysql, mysqldump…) work without the deprecation warning; a dump's
// consistency is decided from the server's state (see mariadb.ts), not
// from the rows of a real moment.

import type { Game, Shell } from './shell';
import type { Context } from './commands/index';
import {
  SOCKET, VERSION, addressOf, checksum, connect, disconnect, fileValue, findAccount, hasMaria, isOn, kill, linkOf, machineAt, maria, now, reachable, sourceFor, sums, allowed, binlogName, positionOf, gtid,
  socketAuth, clientConns,
  type Cell, type Conn, type SqlError, type Table, type DumpMeta,
} from './mariadb';
import { run, statements, clean, createText, literal, numericType, type Result, type Session, type Rows } from './mariadb-sql';
import { crc32 } from './compression';

// ——— Options ———

interface Parsed {
  options: Record<string, string>;
  positional: string[];
  // -p given without a value: ask for the password.
  askPassword: boolean;
  unknown?: string;
}

// Short options that take a value, glued (-uroot) or not (-u root); -p only glued.
const WITH_VALUE = new Set(['u', 'h', 'P', 'D', 'e', 'S', 'r']);
const SHORT_FLAGS = new Set(['B', 'N', 't', 'E', 's', 'f', 'V', 'v', 'A', 'x', 'l', 'R', 'q', 'n', 'd', 'c', 'a', 'o', 'F', 'C', 'X', 'i', 'b']);
const LONG_TO_SHORT: Record<string, string> = {
  user: 'u', host: 'h', port: 'P', database: 'D', execute: 'e', socket: 'S', batch: 'B', 'skip-column-names': 'N', table: 't', vertical: 'E', silent: 's', force: 'f', version: 'V',
  verbose: 'v', 'all-databases': 'A', 'lock-all-tables': 'x', 'lock-tables': 'l', routines: 'R', quick: 'q', 'no-create-info': 't', 'no-data': 'd', 'result-file': 'r',
  check: 'c', analyze: 'a', optimize: 'o', 'flush-logs': 'F', databases: 'B',
};

function parse(program: string, args: string[], longOnly: string[]): Parsed {
  const options: Record<string, string> = {};
  const positional: string[] = [];
  let askPassword = false;
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--') {
      positional.push(...args.slice(i + 1));
      break;
    }
    if (a.startsWith('--')) {
      const [k, ...v] = a.slice(2).split('=');
      const key = k.replace(/_/g, '-');
      if (key === 'password') {
        if (v.length) options.p = v.join('=');
        else askPassword = true;
        continue;
      }
      if (longOnly.includes(key) || key.startsWith('skip-') || key.startsWith('ssl') || key === 'protocol' || key === 'no-auto-rehash' || key === 'default-character-set') {
        options[key] = v.length ? v.join('=') : '1';
        continue;
      }
      const short = LONG_TO_SHORT[key];
      if (!short) return { options, positional, askPassword, unknown: a };
      if (WITH_VALUE.has(short)) options[short] = v.length ? v.join('=') : (args[++i] ?? '');
      else options[short] = (options[short] ? options[short] + 'x' : '') + '1';
      if (key === 'databases') options.databases = '1';
      continue;
    }
    if (a.startsWith('-') && a.length > 1) {
      for (let k = 1; k < a.length; k++) {
        const c = a[k];
        if (c === 'p') {
          const rest = a.slice(k + 1);
          if (rest) options.p = rest;
          else askPassword = true;
          break;
        }
        if (WITH_VALUE.has(c)) {
          const rest = a.slice(k + 1);
          options[c] = rest || (args[++i] ?? '');
          break;
        }
        if (c === '?') {
          options.help = '1';
          continue;
        }
        if (!SHORT_FLAGS.has(c)) return { options, positional, askPassword, unknown: `-${c}` };
        options[c] = (options[c] ? options[c] + 'x' : '') + '1';
      }
      continue;
    }
    positional.push(a);
  }
  void program;
  return { options, positional, askPassword };
}

const unknownOption = (game: Shell, program: string, o: string) => game.error(`${program}: unknown option '${o}'`, 7);

// ——— Connecting ———

interface Target {
  server: Shell;
  // The client as the server sees it.
  host: string;
  // What the client says (Connection: Localhost via UNIX socket / host via TCP/IP).
  via: string;
}

/** The server a client reaches (socket, or TCP to a machine of the story), or the client's error. */
function reach(game: Shell, host: string | undefined, port: string | undefined, protocol: string | undefined): Target | SqlError {
  const socket = (!host || host === 'localhost') && protocol?.toLowerCase() !== 'tcp';
  if (socket) {
    if (!hasMaria(game) || !maria(game).running) return { code: 2002, state: 'HY000', message: `Can't connect to local server through socket '${SOCKET}' (2)` };
    return { server: game, host: 'localhost', via: 'Localhost via UNIX socket' };
  }
  const name = !host || host === 'localhost' ? '127.0.0.1' : host;
  const server = name === '127.0.0.1' ? game : (machineAt(game, name) as Shell | null);
  const address = name === '127.0.0.1' ? '127.0.0.1' : addressOf(game, name);
  if (!server || !address) return { code: 2005, state: 'HY000', message: `Unknown server host '${name}' (-2)` };
  if (!hasMaria(server)) return { code: 2002, state: 'HY000', message: `Can't connect to server on '${name}' (115)` };
  const from = server === game ? (address === '127.0.0.1' ? '127.0.0.1' : address) : sourceFor(game, address);
  const r = reachable(server, from, address);
  if (r !== 'ok' || (port && port !== maria(server).vars.port)) return { code: 2002, state: 'HY000', message: `Can't connect to server on '${name}' (${r === 'timeout' ? 110 : 115})` };
  return { server, host: from, via: `${name} via TCP/IP` };
}

/** The client's first lines on an error: ERROR code (state): message. */
const errorLine = (e: SqlError, line?: number) => `ERROR ${e.code} (${e.state})${line !== undefined ? ` at line ${line}` : ''}: ${e.message}`;

/** Opens a session for a client program; the session, or an error already reported. */
function open(game: Shell, o: Parsed, kind: Conn['kind'] = 'client', interactive = false, password?: string | null): Session | SqlError {
  const t = reach(game, o.options.h, o.options.P, o.options.protocol);
  if ('code' in t) return t;
  const user = o.options.u ?? game.who;
  const pw = password !== undefined ? password : (o.options.p ?? null);
  const db = o.options.D ?? (o.positional[0] && kind === 'client' && !o.options.databases ? o.positional[0] : null);
  const c = connect(t.server, { host: t.host, user, password: pw, osUser: game.who }, kind, null, interactive);
  if ('code' in c) return c;
  const session: Session = { server: t.server, conn: c, db: null, vars: {}, account: c.account!, user, host: t.host };
  if (db) {
    const r = run(session, `USE ${db}`);
    if ('error' in r) {
      disconnect(t.server, c.id);
      return r.error;
    }
  }
  (session as Session & { via?: string }).via = t.via;
  return session;
}

// ——— Printing results ———

const display = (v: Cell) => (v === null ? 'NULL' : v);
/** The width of a text on the terminal (wide characters count twice). */
const width = (s: string) => [...s].reduce((n, ch) => n + (/[\u1100-\u115f\u2e80-\ua4cf\uac00-\ud7a3\uf900-\ufaff\ufe30-\ufe4f\uff00-\uff60\uffe0-\uffe6]/.test(ch) ? 2 : 1), 0);
const pad = (s: string, n: number, right: boolean) => (right ? ' '.repeat(Math.max(0, n - width(s))) + s : s + ' '.repeat(Math.max(0, n - width(s))));

/** A result as the client's table (+----+). */
export function table(r: Rows, headers = true): string {
  const cells = r.data.map((row) => row.map(display));
  const widths = r.columns.map((c, i) => Math.max(headers ? width(c) : 0, ...cells.map((row) => width(row[i] ?? ''))));
  const line = `+${widths.map((w) => '-'.repeat(w + 2)).join('+')}+`;
  const out = [line];
  if (headers) out.push(`| ${r.columns.map((c, i) => pad(c, widths[i], false)).join(' | ')} |`, line);
  for (const row of cells) out.push(`| ${row.map((v, i) => pad(v, widths[i], !!r.numeric?.[i] && r.data.some((x) => x[i] !== null))).join(' | ')} |`);
  out.push(line);
  return out.join('\n');
}
/** Tab-separated rows (batch): special characters escaped, NULL written NULL. */
const batch = (r: Rows, headers: boolean) =>
  [...(headers ? [r.columns.join('\t')] : []), ...r.data.map((row) => row.map((v) => (v === null ? 'NULL' : v.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/\t/g, '\\t'))).join('\t'))].join('\n');
/** Vertical rows (\G, -E). */
const vertical = (r: Rows) => {
  const w = Math.max(...r.columns.map(width));
  return r.data.map((row, k) => [`${'*'.repeat(27)} ${k + 1}. row ${'*'.repeat(27)}`, ...r.columns.map((c, i) => `${pad(c, w, true)}: ${display(row[i])}`)].join('\n')).join('\n');
};

const secs = (t: number | undefined) => `(${(t ?? 0.0005).toFixed(3)} sec)`;

interface Mode {
  table: boolean;
  headers: boolean;
  vertical: boolean;
  interactive: boolean;
}

/** What the client prints for a result (without the errors). */
function print(r: Result, m: Mode): string {
  if ('use' in r) return m.interactive ? 'Database changed' : '';
  if ('ok' in r) {
    if (!m.interactive) return '';
    const n = r.ok.affected;
    const w = r.ok.warnings ? `, ${r.ok.warnings} warning${r.ok.warnings > 1 ? 's' : ''}` : '';
    return [`Query OK, ${n} row${n === 1 ? '' : 's'} affected${w} ${secs(r.time)}`, ...(r.ok.info ? [r.ok.info] : [])].join('\n');
  }
  if ('rows' in r) {
    const rr = r.rows;
    if (!rr.columns.length) return m.interactive ? `Empty set ${secs(r.time)}` : '';
    const vert = m.vertical || r.vertical;
    let body = '';
    if (rr.data.length || !m.interactive) body = vert ? vertical(rr) : m.table ? (rr.data.length ? table(rr, m.headers) : '') : batch(rr, m.headers && rr.data.length > 0);
    if (!m.interactive) return body;
    if (!rr.data.length) return `Empty set ${secs(r.time)}`;
    return `${body}\n${rr.data.length} row${rr.data.length === 1 ? '' : 's'} in set ${secs(r.time)}`;
  }
  return '';
}

// ——— A dump being restored: remembered for the checks ———

/** The dump a script is (its header, then the metadata kept for its content), or null. */
const dumpOf = (game: Shell, text: string): DumpMeta | null => {
  if (!text.includes('-- MariaDB dump')) return null;
  const id = String(crc32([...new TextEncoder().encode(text)]));
  for (const m of [game, game.principal, ...game.principal.internals.values()]) {
    const d = hasMaria(m) ? maria(m).dumps[id] : undefined;
    if (d) return d;
  }
  return null;
};

/** Runs a script (input or source file) on a session; returns the output and the errors (stops at the first, unless force). */
function runScript(game: Shell, s: Session, text: string, m: Mode, force: boolean): string {
  const out: string[] = [];
  const touched = new Set<string>();
  const dbs = new Set<string>();
  for (const st of statements(text)) {
    const r = run(s, st.sql);
    if ('error' in r) {
      game.error(errorLine(r.error, st.line));
      if (!force) break;
      continue;
    }
    const sql = clean(st.sql);
    const t = /^(?:INSERT\s+INTO|CREATE\s+TABLE)\s+(?:IF\s+NOT\s+EXISTS\s+)?(\S+?)[\s(]/i.exec(sql);
    if (t && s.db) {
      touched.add(`${s.db}.${t[1]}`);
      dbs.add(s.db);
    }
    const p = print(r, m);
    if (p) out.push(p);
  }
  if (touched.size) {
    const meta = dumpOf(game, text);
    const srv = maria(s.server);
    for (const db of dbs) srv.restores.push({ dump: meta?.id ?? null, db, time: now(s.server), tables: [...touched].filter((x) => x.startsWith(`${db}.`)).map((x) => x.slice(db.length + 1)) });
  }
  return out.join('\n');
}

// ——— The interactive monitor ———

const BANNER = (s: Session) =>
  [
    'Welcome to the MariaDB monitor.  Commands end with ; or \\g.',
    `Your MariaDB connection id is ${s.conn.id}`,
    `Server version: ${VERSION}${isOn(maria(s.server).vars.log_bin) ? '-log' : ''} Debian 13`,
    '',
    'Copyright (c) 2000, 2018, Oracle, MariaDB Corporation Ab and others.',
    '',
    "Type 'help;' or '\\h' for help. Type '\\c' to clear the current input statement.",
  ].join('\n');

const prompt = (s: Session) => `MariaDB [${s.db ?? '(none)'}]> `;

function monitor(game: Shell, s: Session, o: Parsed) {
  let buffer = '';
  const mode: Mode = { table: true, headers: !o.options.N, vertical: !!o.options.E, interactive: true };
  const who = game.who;
  const ask = () => game.ask(buffer ? (/^[^']*'([^']*'[^']*')*[^']*$/.test(buffer) && (buffer.match(/'/g)?.length ?? 0) % 2 === 1 ? "    '> " : '    -> ') : prompt(s), answer);
  const ensure = (): string => {
    const srv = maria(s.server);
    if (srv.running && srv.conns.some((c) => c.id === s.conn.id)) return '';
    const lines = ['ERROR 2006 (HY000): Server has gone away', 'No connection. Trying to reconnect...'];
    if (!srv.running) return [...lines, `ERROR 2002 (HY000): Can't connect to local server through socket '${SOCKET}' (2)`, 'ERROR: Can\'t connect to the server', ''].join('\n');
    const c = connect(s.server, { host: s.host, user: s.user, password: o.options.p ?? null, osUser: who }, 'client', s.db, true);
    if ('code' in c) return [...lines, errorLine(c), "ERROR: Can't connect to the server", ''].join('\n');
    s.conn = c;
    return [...lines, `Connection id:    ${c.id}`, `Current database: ${s.db ?? '*** NONE ***'}`, ''].join('\n');
  };
  function answer(line: string): string {
    const before = game.who;
    game.who = who;
    try {
      const out: string[] = [];
      const l = line.trim();
      if (!buffer) {
        if (/^(exit|quit|\\q)\s*;?$/i.test(l)) {
          disconnect(s.server, s.conn.id);
          return 'Bye';
        }
        if (/^(help|\\h|\?)\s*;?$/i.test(l)) {
          out.push(game.t('mariadb-monitor-help'));
          ask();
          return out.join('\n');
        }
        const use = /^(?:use|\\u)\s+`?(\w+)`?\s*;?$/i.exec(l);
        if (use) {
          const lost = ensure();
          if (lost) out.push(lost);
          const r = run(s, `USE ${use[1]}`);
          out.push('error' in r ? errorLine(r.error) : 'Database changed');
          ask();
          return out.join('\n');
        }
        if (/^(status|\\s)\s*;?$/i.test(l)) {
          const srv = maria(s.server);
          out.push(
            [
              '--------------',
              `mariadb from ${VERSION.replace(/-0\+deb13u1$/, '')}, client 15.2 for debian-linux-gnu (x86_64) using  EditLine wrapper`,
              '',
              `Connection id:\t\t${s.conn.id}`,
              `Current database:\t${s.db ?? ''}`,
              `Current user:\t\t${s.user}@${s.host}`,
              `Server version:\t\t${VERSION} Debian 13`,
              `Connection:\t\t${(s as Session & { via?: string }).via ?? 'Localhost via UNIX socket'}`,
              `Uptime:\t\t\t${Math.floor((now(s.server) - srv.started) / 86_400_000)} days`,
              '--------------',
            ].join('\n'),
          );
          ask();
          return out.join('\n');
        }
        const source = /^(?:source|\\\.)\s+(\S+?)\s*;?$/i.exec(l);
        if (source) {
          const text = game.readFor('mariadb', source[1]);
          if (text !== null) out.push(runScript(game, s, text, mode, true), ...game.recoverErrors());
          ask();
          return out.filter(Boolean).join('\n');
        }
      }
      if (/\\c\s*$/.test(l)) {
        buffer = '';
        ask();
        return '';
      }
      buffer = buffer ? `${buffer}\n${line}` : line;
      const parts = statements(buffer.replace(/\\G\s*$/, ';'));
      const complete = /(;|\\G|\\g)\s*$/.test(buffer.trim()) && !((buffer.match(/'/g)?.length ?? 0) % 2);
      if (!complete) {
        ask();
        return '';
      }
      const vert = /\\G\s*$/.test(buffer.trim());
      buffer = '';
      const lost = ensure();
      if (lost) out.push(lost);
      if (!lost.includes("Can't connect"))
        for (const p of parts) {
          s.conn.command = 'Query';
          s.conn.info = clean(p.sql);
          const r = run(s, p.sql.replace(/\\[gG]\s*$/, ''));
          s.conn.command = 'Sleep';
          s.conn.info = null;
          s.conn.since = now(s.server);
          out.push('error' in r ? errorLine(r.error) : print(r, { ...mode, vertical: mode.vertical || vert }));
        }
      ask();
      return out.filter(Boolean).join('\n');
    } finally {
      game.who = before;
    }
  }
  ask();
}

// ——— mariadb (mysql) ———

function client(game: Shell, program: string, args: string[], input: string | null, last: boolean): string {
  const o = parse(program, args, ['protocol', 'no-defaults', 'connect-timeout']);
  if (o.unknown) return unknownOption(game, program, o.unknown);
  if (o.options.V) return `${program} from ${VERSION.replace(/-0\+deb13u1$/, '')}, client 15.2 for debian-linux-gnu (x86_64) using  EditLine wrapper`;
  const go = (password?: string | null): string => {
    const interactive = !o.options.e && input === null;
    const s = open(game, o, 'client', interactive, password);
    if ('code' in s) return game.error(errorLine(s), 1);
    const mode: Mode = {
      table: !!o.options.t || (last && !o.options.B && !o.options.s),
      headers: !o.options.N && !(o.options.s ?? '').includes('x'),
      vertical: !!o.options.E,
      interactive: false,
    };
    if (o.options.e !== undefined) {
      const out: string[] = [];
      s.conn.command = 'Query';
      for (const st of statements(o.options.e)) {
        s.conn.info = clean(st.sql);
        const r = run(s, st.sql.replace(/\\G\s*$/, ''));
        if ('error' in r) {
          game.error(errorLine(r.error, st.line));
          if (!o.options.f) break;
          continue;
        }
        const p = print(r, { ...mode, vertical: mode.vertical || /\\G\s*$/.test(st.sql) });
        if (p) out.push(p);
      }
      disconnect(s.server, s.conn.id);
      return out.join('\n');
    }
    if (input !== null) {
      const out = runScript(game, s, input, mode, !!o.options.f);
      disconnect(s.server, s.conn.id);
      return out;
    }
    monitor(game, s, o);
    return BANNER(s);
  };
  if (o.askPassword) {
    game.ask('Enter password: ', (pw) => {
      const out = go(pw);
      return [...game.recoverErrors(), out].filter(Boolean).join('\n');
    }, true);
    return '';
  }
  return go();
}

// ——— mariadb-dump (mysqldump) ———

const pad2 = (n: number) => String(n).padStart(2, '0');
const dumpDate = (ms: number) => {
  const d = new Date(ms);
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())} ${String(d.getUTCHours()).padStart(2, ' ')}:${pad2(d.getUTCMinutes())}:${pad2(d.getUTCSeconds())}`;
};

function dumpTable(name: string, t: Table, o: { noData: boolean; noCreate: boolean; lock: boolean }): string[] {
  const out: string[] = [];
  if (!o.noCreate)
    out.push(
      '--',
      `-- Table structure for table \`${name}\``,
      '--',
      '',
      `DROP TABLE IF EXISTS \`${name}\`;`,
      '/*!40101 SET @saved_cs_client     = @@character_set_client */;',
      '/*!40101 SET character_set_client = utf8mb4 */;',
      `${createText(name, t)};`,
      '/*!40101 SET character_set_client = @saved_cs_client */;',
      '',
    );
  if (o.noData) return out;
  out.push('--', `-- Dumping data for table \`${name}\``, '--', '');
  if (o.lock) out.push(`LOCK TABLES \`${name}\` WRITE;`);
  out.push(`/*!40000 ALTER TABLE \`${name}\` DISABLE KEYS */;`);
  if (t.rows.length) {
    const numeric = t.columns.map((c) => numericType(c.type));
    out.push(`INSERT INTO \`${name}\` VALUES\n${t.rows.map((r) => `(${r.map((v, i) => literal(v, numeric[i])).join(',')})`).join(',\n')};`);
  }
  out.push(`/*!40000 ALTER TABLE \`${name}\` ENABLE KEYS */;`);
  if (o.lock) out.push('UNLOCK TABLES;');
  out.push('');
  return out;
}

/** Is someone writing to this server while a dump reads it (the story's app, or a replica's SQL thread applying)? */
const writesArriving = (server: Game) => !!server.state.mariadbWrites || (!!maria(server).replica?.sql && !!maria(server).replica?.io);

function dump(game: Shell, program: string, args: string[]): string {
  const o = parse(program, args, ['single-transaction', 'master-data', 'source-data', 'dump-slave', 'dump-replica', 'gtid', 'add-drop-database', 'triggers', 'events', 'hex-blob', 'opt', 'compact', 'skip-lock-tables', 'skip-opt', 'apply-slave-statements', 'include-master-host-port', 'routines', 'flush-privileges', 'skip-add-locks', 'add-locks']);
  if (o.unknown) return unknownOption(game, program, o.unknown);
  if (o.options.V) return `${program}  Ver 10.19 Distrib ${VERSION.replace(/-0\+deb13u1$/, '')}, for debian-linux-gnu (x86_64)`;
  const all = !!o.options.A;
  const several = !!o.options.databases || all;
  if (!all && !o.positional.length) return game.error(`Usage: ${program} [OPTIONS] database [tables]\nOR     ${program} [OPTIONS] --databases DB1 [DB2 DB3...]\nOR     ${program} [OPTIONS] --all-databases\nFor more options, use ${program} --help`, 1);
  const go = (password?: string | null): string => {
    const s = open(game, { ...o, positional: [], options: { ...o.options, D: undefined as unknown as string } }, 'client', false, password);
    if ('code' in s) return game.error(`${program}: Got error: ${s.code}: "${s.message}" when trying to connect`, 2);
    const srv = maria(s.server);
    const fail = (msg: string, code = 2) => {
      disconnect(s.server, s.conn.id);
      return game.error(msg, code);
    };
    const databases = all ? Object.keys(srv.databases).sort() : several ? o.positional : [o.positional[0]];
    const tablesWanted = several ? [] : o.positional.slice(1);
    for (const db of databases) {
      if (!srv.databases[db]) return fail(`${program}: Got error: 1049: "Unknown database '${db}'" when selecting the database`);
      if (!s.account || !allowed(srv, s.account, 'SELECT', db) && !Object.keys(srv.databases[db].tables).every((t) => allowed(srv, s.account, 'SELECT', db, t)))
        return fail(`${program}: Got error: 1044: "Access denied for user '${s.account.user}'@'${s.account.host}' to database '${db}'" when selecting the database`);
    }
    for (const t of tablesWanted) if (!srv.databases[databases[0]].tables[t]) return fail(`${program}: Couldn't find table: "${t}"`);
    const single = !!o.options['single-transaction'];
    const lockAll = !!o.options.x;
    const skipLocks = !!o.options['skip-lock-tables'] || !!o.options['skip-opt'];
    const lockTables = !single && !lockAll && !skipLocks;
    if (lockTables && !databases.every((db) => allowed(srv, s.account, 'LOCK TABLES', db)))
      return fail(`${program}: Got error: 1044: "Access denied for user '${s.account.user}'@'${s.account.host}' to database '${databases[0]}'" when using LOCK TABLES`);
    const masterData = o.options['master-data'] ?? o.options['source-data'];
    const dumpSlave = o.options['dump-slave'] ?? o.options['dump-replica'];
    if ((masterData || lockAll) && !allowed(srv, s.account, 'RELOAD')) return fail(`${program}: Couldn't execute 'FLUSH /*!40101 LOCAL */ TABLES': Access denied; you need (at least one of) the RELOAD privilege(s) for this operation (1227)`);
    if (masterData && !isOn(srv.vars.log_bin)) return fail(`${program}: Error: Binlogging on server not active`);
    if (dumpSlave && !srv.replica) return fail(`${program}: Error: Slave not set up`);
    const writes = writesArriving(s.server);
    const rowsCount = databases.reduce((n, db) => n + Object.values(srv.databases[db].tables).reduce((m, t) => m + t.rows.length, 0), 0);
    const duration = 8_000 + rowsCount * 40;
    const consistent = single || lockAll || (lockTables && databases.length === 1) || !writes;
    const blocked = single ? 0 : lockAll || lockTables ? duration : 0;
    const clock = now(s.server);
    const out: string[] = [
      '/*M!999999\\- enable the sandbox mode */ ',
      `-- MariaDB dump 10.19-${VERSION.replace(/-0\+deb13u1$/, '')}, for debian-linux-gnu (x86_64)`,
      '--',
      `-- Host: ${o.options.h ?? 'localhost'}    Database: ${several ? '' : databases[0]}`,
      '-- ------------------------------------------------------',
      `-- Server version\t${VERSION}${isOn(srv.vars.log_bin) ? '-log' : ''}`,
      '',
      '/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;',
      '/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;',
      '/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;',
      '/*!40101 SET NAMES utf8mb4 */;',
      '/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;',
      "/*!40103 SET TIME_ZONE='+00:00' */;",
      '/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;',
      '/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;',
      "/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;",
      '/*M!100616 SET @OLD_NOTE_VERBOSITY=@@NOTE_VERBOSITY, NOTE_VERBOSITY=0 */;',
      '',
    ];
    const position = (n: string, primary: { file: string; pos: number; gtid: string }) => {
      const c = n === '2' ? '-- ' : '';
      out.push('--', '-- Position to start replication or point-in-time recovery from', '--', '');
      if (o.options.gtid) out.push(`${c}SET GLOBAL gtid_slave_pos='${primary.gtid}';`, `${c}CHANGE MASTER TO MASTER_USE_GTID=slave_pos;`, '');
      else out.push(`${c}CHANGE MASTER TO MASTER_LOG_FILE='${primary.file}', MASTER_LOG_POS=${primary.pos};`, '');
    };
    if (masterData) position(masterData === '1' ? '1' : masterData, { file: binlogName(srv), pos: positionOf(srv, srv.seq), gtid: srv.seq ? gtid(srv, srv.seq) : '' });
    else if (dumpSlave) {
      const link = linkOf(s.server);
      const ps = link.primary ? maria(link.primary) : null;
      const applied = srv.replica!.applied;
      position(dumpSlave === '1' ? '1' : dumpSlave, { file: ps ? binlogName(ps) : 'mariadb-bin.000001', pos: ps ? positionOf(ps, applied) : 4, gtid: srv.gtidSlavePos ?? '' });
    }
    for (const db of databases) {
      if (several) out.push('--', `-- Current Database: \`${db}\``, '--', '', `CREATE DATABASE /*!32312 IF NOT EXISTS*/ \`${db}\` /*!40100 DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_uca1400_ai_ci */;`, '', `USE \`${db}\`;`, '');
      for (const [name, t] of Object.entries(srv.databases[db].tables).sort(([a], [b]) => a.localeCompare(b))) {
        if (tablesWanted.length && !tablesWanted.includes(name)) continue;
        out.push(...dumpTable(name, t, { noData: !!o.options.d, noCreate: !!o.options.t, lock: !o.options['skip-add-locks'] && !o.options['skip-opt'] }));
      }
    }
    out.push(
      '/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;',
      '',
      '/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;',
      '/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;',
      '/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;',
      '/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;',
      '/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;',
      '/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;',
      '/*M!100616 SET NOTE_VERBOSITY=@OLD_NOTE_VERBOSITY */;',
      '',
      `-- Dump completed on ${dumpDate(clock + duration)}`,
    );
    const text = out.join('\n');
    const id = String(crc32([...new TextEncoder().encode(text)]));
    const tableSums: Record<string, number> = {};
    for (const db of databases) Object.assign(tableSums, Object.fromEntries(Object.entries(sums(srv, db)).filter(([k]) => !tablesWanted.length || tablesWanted.includes(k.split('.')[1]))));
    srv.dumps[id] = { id, time: clock, host: s.server.host, databases, singleTransaction: single, lockTables, lockAll, consistent, blocked, sums: tableSums };
    // The tables locked against writes: a replica's SQL thread waits behind the dump.
    if (blocked && srv.replica) srv.blockedUntil = clock + blocked;
    disconnect(s.server, s.conn.id);
    const file = o.options.r;
    if (file) {
      const error = game.place(program, file, { type: 'file', content: text, lines: true, owner: game.who, mode: 'rw-r--r--' });
      if (error) return game.error(`${program}: Can't create/write to file '${file}' (Errcode: 13 "Permission denied")`, 2);
      return '';
    }
    return text;
  };
  if (o.askPassword) {
    game.ask('Enter password: ', (pw) => {
      const out = go(pw);
      return [...game.recoverErrors(), out].filter(Boolean).join('\n');
    }, true);
    return '';
  }
  return go();
}

// ——— mariadb-admin (mysqladmin) ———

function admin(game: Shell, program: string, args: string[]): string {
  const o = parse(program, args, []);
  if (o.unknown) return unknownOption(game, program, o.unknown);
  if (!o.positional.length) return game.error(game.t('mariadb-admin-usage', { program }), 1);
  const go = (password?: string | null): string => {
    const t = reach(game, o.options.h, o.options.P, o.options.protocol);
    const where = o.options.h ?? 'localhost';
    const down = (e: SqlError) => game.error(`${program}: connect to server at '${where}' failed\nerror: '${e.message}'${e.code === 2002 && where === 'localhost' ? `\nCheck that mariadbd is running and that the socket: '${SOCKET}' exists!` : ''}`, 1);
    if ('code' in t) return down(t);
    const user = o.options.u ?? game.who;
    const c = connect(t.server, { host: t.host, user, password: password !== undefined ? password : (o.options.p ?? null), osUser: game.who });
    if ('code' in c) return down(c);
    const s: Session = { server: t.server, conn: c, db: null, vars: {}, account: c.account!, user, host: t.host };
    const srv = maria(t.server);
    const out: string[] = [];
    const statusLine = () => {
      const up = Math.max(1, Math.floor((now(t.server) - srv.started) / 1000));
      return `Uptime: ${up}  Threads: ${clientConns(srv).length}  Questions: ${srv.questions}  Slow queries: ${srv.slowQueries}  Opens: 33  Open tables: 26  Queries per second avg: ${(srv.questions / up).toFixed(3)}`;
    };
    try {
      for (let i = 0; i < o.positional.length; i++) {
        const cmd = o.positional[i].toLowerCase();
        if (cmd === 'ping') out.push('mysqld is alive');
        else if (cmd === 'status') out.push(statusLine());
        else if (cmd === 'version') {
          const up = Math.floor((now(t.server) - srv.started) / 1000);
          out.push(
            [
              `${program}  Ver 10.0 Distrib ${VERSION.replace(/-0\+deb13u1$/, '')}, for debian-linux-gnu on x86_64`,
              'Copyright (c) 2000, 2018, Oracle, MariaDB Corporation Ab and others.',
              '',
              `Server version\t\t${VERSION}${isOn(srv.vars.log_bin) ? '-log' : ''}`,
              'Protocol version\t10',
              `Connection\t\t${t.host === 'localhost' ? 'Localhost via UNIX socket' : `${where} via TCP/IP`}`,
              ...(t.host === 'localhost' ? [`UNIX socket\t\t${SOCKET}`] : [`TCP port\t\t${srv.vars.port}`]),
              `Uptime:\t\t\t${Math.floor(up / 86400)} days ${Math.floor((up % 86400) / 3600)} hours ${Math.floor((up % 3600) / 60)} min ${up % 60} sec`,
              '',
              statusLine().replace(/^Uptime: \d+  /, ''),
            ].join('\n'),
          );
        } else if (cmd === 'processlist') {
          const r = run(s, 'SHOW PROCESSLIST');
          if ('rows' in r) out.push(table(r.rows));
        } else if (cmd === 'variables' || cmd === 'extended-status') {
          const r = run(s, cmd === 'variables' ? 'SHOW GLOBAL VARIABLES' : 'SHOW GLOBAL STATUS');
          if ('rows' in r) out.push(table(r.rows));
        } else if (cmd === 'kill') {
          const ids = (o.positional[++i] ?? '').split(',').filter(Boolean);
          if (!ids.length) return game.error(`${program}: Too few arguments to 'kill'`, 1);
          for (const id of ids) {
            const r = run(s, `KILL ${id}`);
            if ('error' in r) game.error(`${program}: kill failed on ${id}; error: '${r.error.message}'`, 1);
          }
        } else if (cmd === 'flush-privileges' || cmd === 'reload' || cmd === 'flush-logs' || cmd === 'refresh' || cmd === 'flush-tables' || cmd === 'flush-status') {
          if (!allowed(srv, s.account, 'RELOAD')) return game.error(`${program}: refresh failed; error: 'Access denied; you need (at least one of) the RELOAD privilege(s) for this operation'`, 1);
        } else if (cmd === 'shutdown') {
          if (!allowed(srv, s.account, 'SHUTDOWN')) return game.error(`${program}: shutdown failed; error: 'Access denied; you need (at least one of) the SHUTDOWN privilege(s) for this operation'`, 1);
          const sv = t.server.state.systemd as { services: Record<string, { state: string; stop?: (g: Shell) => void }> } | undefined;
          srv.running = false;
          srv.conns = [];
          if (sv?.services.mariadb) sv.services.mariadb.state = 'inactive';
          return '';
        } else if (cmd === 'start-slave' || cmd === 'stop-slave' || cmd === 'start-replica' || cmd === 'stop-replica') {
          const r = run(s, `${cmd.startsWith('start') ? 'START' : 'STOP'} SLAVE`);
          if ('error' in r) return game.error(`${program}: Error: ${r.error.message}`, 1);
          out.push(cmd.startsWith('start') ? 'Slave started' : 'Slave stopped');
        } else if (cmd === 'create' || cmd === 'drop') {
          const db = o.positional[++i];
          if (!db) return game.error(`${program}: Too few arguments to ${cmd}`, 1);
          const r = run(s, `${cmd.toUpperCase()} DATABASE ${db}`);
          if ('error' in r) return game.error(`${program}: ${cmd.toUpperCase()} DATABASE failed; error: '${r.error.message}'`, 1);
          if (cmd === 'drop') out.push(`Database "${db}" dropped`);
        } else return game.error(`${program}: Unknown command: '${o.positional[i]}'`, 1);
      }
    } finally {
      disconnect(t.server, c.id);
    }
    return out.join('\n');
  };
  if (o.askPassword) {
    game.ask('Enter password: ', (pw) => [...game.recoverErrors(), go(pw)].filter(Boolean).join('\n'), true);
    return '';
  }
  return go();
}

// ——— mariadb-check (mysqlcheck) ———

function check(game: Shell, program: string, args: string[]): string {
  const o = parse(program, args, ['auto-repair', 'check-upgrade', 'extended', 'medium-check', 'fast', 'repair']);
  if (o.unknown) return unknownOption(game, program, o.unknown);
  if (!o.options.A && !o.positional.length) return game.error(`Usage: ${program} [OPTIONS] database [tables]\nOR     ${program} [OPTIONS] --databases DB1 [DB2 DB3...]\nOR     ${program} [OPTIONS] --all-databases\nFor more options, use ${program} --help`, 1);
  const s = open(game, { ...o, positional: [], options: { ...o.options, D: undefined as unknown as string } });
  if ('code' in s) return game.error(`${program}: Got error: ${s.code}: ${s.message} when trying to connect`, 2);
  const srv = maria(s.server);
  const dbs = o.options.A ? Object.keys(srv.databases).sort() : o.options.databases ? o.positional : [o.positional[0]];
  const out: string[] = [];
  try {
    for (const db of dbs) {
      if (!srv.databases[db]) return game.error(`${program}: Got error: 1049: Unknown database '${db}' when selecting the database`, 2);
      const names = !o.options.A && !o.options.databases && o.positional.length > 1 ? o.positional.slice(1) : Object.keys(srv.databases[db].tables).sort();
      for (const n of names) {
        const t = srv.databases[db].tables[n];
        if (!t) {
          out.push(`${db}.${n}`, `Error    : Table '${db}.${n}' doesn't exist`, 'status   : Operation failed');
          continue;
        }
        if (!allowed(srv, s.account, 'SELECT', db, n)) {
          out.push(`${db}.${n}`, `Error    : SELECT command denied to user '${s.account.user}'@'${s.account.host}' for table \`${db}\`.\`${n}\``, 'error    : Corrupt');
          continue;
        }
        if (o.options.o) out.push(`${db}.${n}`, 'note     : Table does not support optimize, doing recreate + analyze instead', 'status   : OK');
        else out.push(`${`${db}.${n}`.padEnd(50)} ${o.options.a ? 'OK' : 'OK'}`);
      }
    }
  } finally {
    disconnect(s.server, s.conn.id);
  }
  return out.join('\n');
}

// ——— mariadb-secure-installation ———

function secure(game: Shell): string {
  const intro = [
    '',
    'NOTE: RUNNING ALL PARTS OF THIS SCRIPT IS RECOMMENDED FOR ALL MariaDB',
    '      SERVERS IN PRODUCTION USE!  PLEASE READ EACH STEP CAREFULLY!',
    '',
    'In order to log into MariaDB to secure it, we\'ll need the current',
    'password for the root user. If you\'ve just installed MariaDB, and',
    'haven\'t set the root password yet, you should just press enter here.',
    '',
  ].join('\n');
  const who = game.who;
  const yes = (a: string) => a === '' || /^y(es)?$/i.test(a);
  game.ask('Enter current password for root (enter for none): ', (pw) => {
    const t = reach(game, undefined, undefined, undefined);
    if ('code' in t) return game.error(`ERROR ${t.code} (${t.state}): ${t.message}`, 1);
    const c = connect(t.server, { host: 'localhost', user: 'root', password: pw === '' ? null : pw, osUser: who });
    if ('code' in c) return game.error(`${errorLine(c)}\nUnable to connect to the server as root user, giving up.\nCleaning up...`, 1);
    disconnect(t.server, c.id);
    const srv = maria(t.server);
    const s: Session = { server: t.server, conn: c, db: null, vars: {}, account: c.account!, user: 'root', host: 'localhost' };
    const exec = (sql: string) => run(s, sql);
    const steps: { text: string; question: string; act: (y: boolean) => string }[] = [
      {
        text: 'Setting the root password or using the unix_socket ensures that nobody\ncan log into the MariaDB root user without the proper authorisation.\n\nYou already have your root account protected, so you can safely answer \'n\'.\n',
        question: 'Switch to unix_socket authentication [Y/n] ',
        act: (y) => {
          if (!y) return ' ... skipping.\n';
          const root = findAccount(srv, 'root', 'localhost');
          if (root) root.auth = socketAuth();
          return 'Enabled successfully!\nReloading privilege tables..\n ... Success!\n\n';
        },
      },
      {
        text: 'You already have your root account protected, so you can safely answer \'n\'.\n',
        question: 'Change the root password? [Y/n] ',
        act: (y) => (y ? ' ... skipping (the game keeps root on unix_socket).\n' : ' ... skipping.\n'),
      },
      {
        text: 'By default, a MariaDB installation has an anonymous user, allowing anyone\nto log into MariaDB without having to have a user account created for\nthem.  This is intended only for testing, and to make the installation\ngo a bit smoother.  You should remove them before moving into a\nproduction environment.\n',
        question: 'Remove anonymous users? [Y/n] ',
        act: (y) => {
          if (!y) return ' ... skipping.\n';
          for (const a of srv.accounts.filter((x) => x.user === '')) exec(`DROP USER ''@'${a.host}'`);
          return ' ... Success!\n';
        },
      },
      {
        text: "Normally, root should only be allowed to connect from 'localhost'.  This\nensures that someone cannot guess at the root password from the network.\n",
        question: 'Disallow root login remotely? [Y/n] ',
        act: (y) => {
          if (!y) return ' ... skipping.\n';
          for (const a of srv.accounts.filter((x) => x.user === 'root' && !['localhost', '127.0.0.1', '::1'].includes(x.host))) exec(`DROP USER 'root'@'${a.host}'`);
          return ' ... Success!\n';
        },
      },
      {
        text: "By default, MariaDB comes with a database named 'test' that anyone can\naccess.  This is also intended only for testing, and should be removed\nbefore moving into a production environment.\n",
        question: 'Remove test database and access to it? [Y/n] ',
        act: (y) => {
          if (!y) return ' ... skipping.\n';
          const had = !!srv.databases.test;
          delete srv.databases.test;
          srv.dbGrants = srv.dbGrants.filter((g) => g.db !== 'test' && g.db !== 'test\\_%');
          return ` - Dropping test database...\n${had ? ' ... Success!' : 'ERROR 1008 (HY000) at line 1: Can\'t drop database \'test\'; database doesn\'t exist\n ... Failed!  Not critical, keep moving...'}\n - Removing privileges on test database...\n ... Success!\n`;
        },
      },
      {
        text: 'Reloading the privilege tables will ensure that all changes made so far\nwill take effect immediately.\n',
        question: 'Reload privilege tables now? [Y/n] ',
        act: () => ' ... Success!\n\nCleaning up...\n\nAll done!  If you\'ve completed all of the above steps, your MariaDB\ninstallation should now be secure.\n\nThanks for using MariaDB!',
      },
    ];
    const step = (k: number) => {
      game.ask(steps[k].question, (a) => {
        const out = steps[k].act(yes(a.trim()));
        if (k + 1 < steps.length) {
          step(k + 1);
          return `${out}\n${steps[k + 1].text}`;
        }
        return out;
      });
    };
    step(0);
    return `OK, successfully used password, moving on...\n\n${steps[0].text}`;
  }, true);
  return intro;
}

// ——— The programs (registered by the story's module: see commands/mariadb.ts) ———

type Launch = (c: Context) => string;
const launch = (f: (game: Shell, program: string, args: string[], input: string | null, last: boolean) => string, program: string): Launch => ({ args, game, input, last }) => f(game, program, args, input, last);

export const MARIADB_PROGRAMS: Record<string, Launch> = {
  mariadb: launch(client, 'mariadb'),
  mysql: launch(client, 'mysql'),
  'mariadb-dump': launch((g, p, a) => dump(g, p, a), 'mariadb-dump'),
  mysqldump: launch((g, p, a) => dump(g, p, a), 'mysqldump'),
  'mariadb-admin': launch((g, p, a) => admin(g, p, a), 'mariadb-admin'),
  mysqladmin: launch((g, p, a) => admin(g, p, a), 'mysqladmin'),
  'mariadb-check': launch((g, p, a) => check(g, p, a), 'mariadb-check'),
  mysqlcheck: launch((g, p, a) => check(g, p, a), 'mysqlcheck'),
  'mariadb-secure-installation': ({ game }) => secure(game),
};
