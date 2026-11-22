// The PostgreSQL 16 tools: psql (a query with -c, a file with
// -f, the list of databases with -l), pg_dump (text or -Fc), pg_restore,
// createdb and dropdb. The server is simulated in postgres.ts.
// After https://www.postgresql.org/docs/16/app-pgdump.html,
// https://www.postgresql.org/docs/16/app-pgrestore.html and
// https://www.postgresql.org/docs/16/app-psql.html.
// Differences: SQL reduced to SELECT count(*), SELECT … [WHERE …] [ORDER BY]
// [LIMIT], DELETE [WHERE …], INSERT INTO … VALUES, TRUNCATE, DROP TABLE,
// ALTER ROLE … PASSWORD (a role's password, by the postgres account), and to
// the meta-commands \l, \dt, \d, \du; WHERE as sql-where.ts reads it;
// psql's output: aligned, --csv, -A (unaligned, -F separator), -t (rows
// only); psql without -c or -f doesn't open in interactive mode.

import type { Shell } from '../shell';
import { connection, copyOf, dumpEncoding, dumpSql, readDumpSql, postgres, grid, versionLine, type Table } from '../postgres';
import { bytes, decode, hexBytes } from '../charset';
import { hex } from './restic';
import { adminSql } from './pg-admin';
import { roleSql } from './pg-roles';
import { allowed, type Privilege } from '../pg-roles';
import { server } from '../pg-server';
import { systemd } from '../systemd';
import { SqlError, values as sqlValues, where } from '../sql-where';
import type { Command } from './index';

// psql's output format for the rows of a SELECT (-A, -F, -t, --csv), set by the command line.
interface Format {
  csv?: boolean;
  unaligned?: boolean;
  separator?: string;
  tuplesOnly?: boolean;
}
let format: Format = {};

/** The rows of a query in psql's chosen format. */
function rows(columns: string[], lines: string[][]): string {
  const quote = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  if (format.csv) return [...(format.tuplesOnly ? [] : [columns.join(',')]), ...lines.map((l) => l.map(quote).join(','))].join('\n');
  if (format.unaligned) {
    const sep = format.separator ?? '|';
    const out = [...(format.tuplesOnly ? [] : [columns.join(sep)]), ...lines.map((l) => l.join(sep))];
    if (!format.tuplesOnly) out.push(`(${lines.length} ${lines.length === 1 ? 'row' : 'rows'})`);
    return out.join('\n');
  }
  if (format.tuplesOnly) {
    const widths = columns.map((c, i) => Math.max(0, ...lines.map((l) => (l[i] ?? '').length)));
    return [...lines.map((l) => ` ${l.map((v, i) => v.padEnd(widths[i])).join(' | ')}`.trimEnd()), ''].join('\n');
  }
  return grid(columns, lines);
}

// A command's options: -x value, --long=value, -Fc.
function readOptions(args: string[], withValue: string[]) {
  const options: Record<string, string> = {};
  const lists: Record<string, string[]> = {};
  const positional: string[] = [];
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a.startsWith('--') && a.includes('=')) {
      const [k, v] = [a.slice(0, a.indexOf('=')), a.slice(a.indexOf('=') + 1)];
      options[k] = v;
      (lists[k] ??= []).push(v);
    } else if (withValue.includes(a)) {
      options[a] = args[++i] ?? '';
      (lists[a] ??= []).push(options[a]);
    } else if (/^-[A-Za-z]./.test(a) && withValue.includes(a.slice(0, 2))) {
      options[a.slice(0, 2)] = a.slice(2);
      (lists[a.slice(0, 2)] ??= []).push(a.slice(2));
    } else if (a.startsWith('-')) options[a] = 'yes';
    else positional.push(a);
  }
  return { options, lists, positionnels: positional };
}

const value = (v: string) => v.replace(/^'(.*)'$/, '$1');

/** Runs an SQL statement (or a meta-command); returns psql's output. */
function sql(game: Shell, base: string, httpRequest: string): string {
  const pg = postgres(game)!;
  const b = pg.bases[base];
  const r = httpRequest.trim().replace(/;\s*$/, '');
  // A modelled server: sessions, settings, plans and indexes (pg-admin.ts).
  const admin = adminSql(game, base, r);
  if (admin !== null) return admin;
  // A standby in recovery refuses every write.
  const write = /^(insert|update|delete|truncate|drop|create|alter\s+(table|role|user|default)|grant|revoke)\b/i.exec(r);
  if (write && (server(game)?.recovery || b.readOnly)) return game.error(`ERROR:  cannot execute ${write[1].toUpperCase()} in a read-only transaction`);
  if (/^select\s+version\(\)$/i.test(r)) return grid(['version'], [[versionLine(pg)]]);
  // ALTER DATABASE … SET default_transaction_read_only = on: the old database kept, but frozen.
  const readOnly = /^alter\s+database\s+"?(\w+)"?\s+set\s+default_transaction_read_only\s*(?:=|to)\s*'?(on|off|true|false)'?$/i.exec(r);
  if (readOnly) {
    if (game.who !== 'postgres' && pg.bases[readOnly[1]]?.owner !== game.who) return game.error(`ERROR:  must be owner of database ${readOnly[1]}`);
    if (!pg.bases[readOnly[1]]) return game.error(`ERROR:  database "${readOnly[1]}" does not exist`);
    pg.bases[readOnly[1]].readOnly = /on|true/i.test(readOnly[2]);
    return 'ALTER DATABASE';
  }
  const roles = roleSql(game, base, r);
  if (roles !== null) return roles;
  // Privileges (when the chapter models them): the role must be allowed on the table.
  const table = (name: string, privilege: Privilege = 'SELECT'): Table | string => {
    const t = b.tables[name.toLowerCase()];
    if (!t) return `ERROR:  relation "${name}" does not exist`;
    return allowed(game, base, name.toLowerCase(), privilege) ? t : `ERROR:  permission denied for table ${name.toLowerCase()}`;
  };
  if (/^\\l(ist)?\+?$/.test(r))
    return grid(
      ['Name', 'Owner', 'Encoding'],
      Object.entries(pg.bases)
        .sort(([a], [z]) => a.localeCompare(z))
        .map(([name, x]) => [name, x.owner, x.encoding ?? 'UTF8']),
      'List of databases',
    );
  if (/^\\dt\+?$/.test(r)) {
    const names = Object.keys(b.tables).sort();
    if (!names.length) return 'Did not find any relations.';
    return grid(
      ['Schema', 'Name', 'Type', 'Owner'],
      names.map((n) => ['public', n, 'table', b.owner]),
      'List of relations',
    );
  }
  const d = /^\\d\s+(\w+)$/.exec(r);
  if (d) {
    const t = table(d[1]);
    if (typeof t === 'string') return game.error(`Did not find any relation named "${d[1]}".`);
    const name = d[1].toLowerCase();
    const indexes = [`    "${name}_pkey" PRIMARY KEY, btree (${t.columns[0]})`, ...(server(game)?.indexes ?? []).filter((i) => i.table === name).map((i) => `    "${i.name}" btree (${i.column})`)];
    return `${grid(
      ['Column', 'Type'],
      t.columns.map((c, i) => [c, i === 0 || /_id$|^id$/.test(c) ? 'integer' : 'text']),
      `Table "public.${d[1]}"`,
    ).replace(/\n\(\d+ rows?\)\n$/, '')}\nIndexes:\n${indexes.join('\n')}`;
  }
  // Roles: \du, and ALTER ROLE … PASSWORD (the password of a database account).
  if (/^\\du\+?$/.test(r))
    return grid(
      ['Role name', 'Attributes'],
      [...pg.roles].sort().map((n) => [n, n === 'postgres' ? 'Superuser, Create role, Create DB, Replication, Bypass RLS' : '']),
      'List of roles',
    );
  const alter = /^ALTER\s+(?:USER|ROLE)\s+"?(\w+)"?\s+(?:WITH\s+)?(?:ENCRYPTED\s+)?PASSWORD\s+'([^']*)'$/i.exec(r);
  if (alter) {
    if (game.who !== 'postgres') return game.error('ERROR:  permission denied to alter role\nDETAIL:  Only roles with the CREATEROLE attribute may alter roles.');
    if (!pg.roles.includes(alter[1])) return game.error(`ERROR:  role "${alter[1]}" does not exist`);
    (pg.passwords ??= {})[alter[1]] = alter[2];
    return 'ALTER ROLE';
  }
  // WHERE: comparisons, AND, OR, dates and intervals (sql-where.ts).
  const filter = (t: Table, or?: string): string[][] | string => {
    try {
      return where(t.columns, t.lines, or, systemd(game)?.clock ?? 0);
    } catch (e) {
      if (e instanceof SqlError) return `ERROR:  ${e.message}`;
      throw e;
    }
  };
  // INSERT INTO table [(columns)] VALUES (…)[, (…)]
  const insert = /^insert\s+into\s+(\w+)\s*(?:\(([^)]*)\))?\s*values\s*(.+)$/is.exec(r);
  if (insert) {
    const t = table(insert[1], 'INSERT');
    if (typeof t === 'string') return game.error(t);
    const named = insert[2] ? insert[2].split(',').map((c) => c.trim().toLowerCase()) : t.columns;
    const unknown = named.find((c) => !t.columns.includes(c));
    if (unknown) return game.error(`ERROR:  column "${unknown}" of relation "${insert[1].toLowerCase()}" does not exist`);
    const groups = [...insert[3].matchAll(/\(((?:[^()']|'(?:[^']|'')*'|\([^()]*\))*)\)/g)].map((m) => m[1]);
    if (!groups.length) return game.error(`ERROR:  syntax error at or near "${insert[3].trim().split(/\s+/)[0]}"`);
    const added: string[][] = [];
    for (const g of groups) {
      let cells: string[];
      try {
        cells = sqlValues(g, systemd(game)?.clock ?? 0);
      } catch (e) {
        if (e instanceof SqlError) return game.error(`ERROR:  ${e.message}`);
        throw e;
      }
      if (cells.length > named.length) return game.error('ERROR:  INSERT has more expressions than target columns');
      if (cells.length < named.length) return game.error('ERROR:  INSERT has more target columns than expressions');
      const row = t.columns.map((c) => (named.includes(c) ? cells[named.indexOf(c)] : ''));
      if (row[0] === '') return game.error(`ERROR:  null value in column "${t.columns[0]}" of relation "${insert[1].toLowerCase()}" violates not-null constraint`);
      if ([...t.lines, ...added].some((l) => l[0] === row[0]))
        return game.error(`ERROR:  duplicate key value violates unique constraint "${insert[1].toLowerCase()}_pkey"\nDETAIL:  Key (${t.columns[0]})=(${row[0]}) already exists.`);
      added.push(row);
    }
    t.lines.push(...added);
    return `INSERT 0 ${added.length}`;
  }
  const account = /^select\s+count\(\*\)\s+from\s+(\w+)(?:\s+where\s+(.+))?$/i.exec(r);
  if (account) {
    const t = table(account[1]);
    if (typeof t === 'string') return game.error(t);
    const lines = filter(t, account[2]);
    if (typeof lines === 'string') return game.error(lines);
    // A big table holds only a sample: its declared size counts.
    const size = account[2] ? undefined : server(game)?.sizes?.[account[1].toLowerCase()];
    return grid(['count'], [[String(size ?? lines.length)]]);
  }
  const selection = /^select\s+(.+?)\s+from\s+(\w+)(?:\s+where\s+(.+?))?(?:\s+order\s+by\s+(\w+)(\s+desc)?)?(?:\s+limit\s+(\d+))?$/i.exec(r);
  if (selection) {
    const t = table(selection[2]);
    if (typeof t === 'string') return game.error(t);
    const columns = selection[1].trim() === '*' ? t.columns : selection[1].split(',').map((c) => c.trim());
    const unknown = columns.find((c) => !t.columns.includes(c));
    if (unknown) return game.error(`ERROR:  column "${unknown}" does not exist`);
    let lines = filter(t, selection[3]);
    if (typeof lines === 'string') return game.error(lines);
    if (selection[4]) {
      const i = t.columns.indexOf(selection[4]);
      if (i < 0) return game.error(`ERROR:  column "${selection[4]}" does not exist`);
      lines = [...lines].sort((a, z) => (/^\d+$/.test(a[i]) ? Number(a[i]) - Number(z[i]) : a[i].localeCompare(z[i])) * (selection[5] ? -1 : 1));
    }
    if (selection[6]) lines = lines.slice(0, Number(selection[6]));
    return rows(
      columns,
      lines.map((l) => columns.map((c) => l[t.columns.indexOf(c)])),
    );
  }
  const deletion = /^delete\s+from\s+(\w+)(?:\s+where\s+(.+))?$/i.exec(r);
  if (deletion) {
    const t = table(deletion[1], 'DELETE');
    if (typeof t === 'string') return game.error(t);
    const targeted = filter(t, deletion[2]);
    if (typeof targeted === 'string') return game.error(targeted);
    t.lines = t.lines.filter((l) => !targeted.includes(l));
    return `DELETE ${targeted.length}`;
  }
  const empty = /^truncate\s+(?:table\s+)?(\w+)$/i.exec(r);
  if (empty) {
    const t = table(empty[1], 'TRUNCATE');
    if (typeof t === 'string') return game.error(t);
    t.lines = [];
    return 'TRUNCATE TABLE';
  }
  const erase = /^drop\s+table\s+(\w+)$/i.exec(r);
  if (erase) {
    const t = table(erase[1]);
    if (typeof t === 'string') return game.error(t);
    if (!allowed(game, base, erase[1].toLowerCase(), 'TRIGGER' as Privilege) || !allowed(game, base, erase[1].toLowerCase(), 'TRUNCATE')) return game.error(`ERROR:  must be owner of table ${erase[1].toLowerCase()}`);
    delete b.tables[erase[1].toLowerCase()];
    return 'DROP TABLE';
  }
  return game.error(`ERROR:  syntax error at or near "${r.split(/\s+/)[0]}"\nLINE 1: ${r}\n        ^`);
}

/** Restores tables into a database, like pg_restore (or psql -f); returns the errors. */
function restore(game: Shell, base: string, tables: Record<string, Table>, onlyData: boolean, clean: boolean): string[] {
  const b = postgres(game)!.bases[base];
  const errors: string[] = [];
  for (const [name, t] of Object.entries(copyOf(tables))) {
    if (!onlyData) {
      if (b.tables[name] && !clean) {
        errors.push(
          `pg_restore: error: could not execute query: ERROR:  relation "${name}" already exists`,
          `Command was: CREATE TABLE public.${name} (\n${t.columns.map((c, i) => `    ${c} ${i === 0 ? 'integer NOT NULL' : 'text'}`).join(',\n')}\n);`,
        );
      } else b.tables[name] = { columns: t.columns, lines: [] };
    }
    const target = b.tables[name];
    if (!target) {
      errors.push(`pg_restore: error: could not execute query: ERROR:  relation "public.${name}" does not exist`);
      continue;
    }
    // The primary key (the first column): a duplicate makes the table's whole COPY fail.
    const keys = new Set(target.lines.map((l) => l[0]));
    const duplicate = t.lines.find((l) => keys.has(l[0]));
    if (duplicate) {
      errors.push(
        `pg_restore: error: COPY failed for table "${name}": ERROR:  duplicate key value violates unique constraint "${name}_pkey"`,
        `DETAIL:  Key (${t.columns[0]})=(${duplicate[0]}) already exists.`,
      );
      continue;
    }
    target.lines.push(...t.lines);
  }
  return errors;
}

const CUSTOM = /^PGDMP ([0-9a-f]{16})$/;

export const POSTGRES: Record<string, Command> = {
  psql: {
    ownOptions: true,
    launch: ({ args, game }) => {
      const { options, positionnels: positional } = readOptions(args, ['-d', '--dbname', '-c', '--command', '-f', '--file', '-U', '--username', '-F', '--field-separator']);
      format = {
        csv: !!options['--csv'],
        unaligned: !!(options['-A'] || options['--no-align']),
        separator: options['-F'] ?? options['--field-separator'],
        tuplesOnly: !!(options['-t'] || options['--tuples-only']),
      };
      // Bundled short options: -At, -tA.
      for (const a of args.filter((x) => /^-[At]{2,}$/.test(x))) {
        if (a.includes('A')) format.unaligned = true;
        if (a.includes('t')) format.tuplesOnly = true;
      }
      if (options['-l'] || options['--list']) {
        const e = connection(game, 'psql', 'postgres');
        return e ? game.error(e) : sql(game, 'postgres', '\\l');
      }
      const base = options['-d'] ?? options['--dbname'] ?? positional[0] ?? game.who;
      const e = connection(game, 'psql', base);
      if (e) return game.error(e);
      const httpRequest = options['-c'] ?? options['--command'];
      if (httpRequest) {
        // Several statements separated by ";" (outside quotes) run one after the other, in the same session.
        const statements = httpRequest.split(/;(?=(?:[^']*'[^']*')*[^']*$)/).map((x) => x.trim()).filter(Boolean);
        try {
          const outputs: string[] = [];
          for (const statement of statements) {
            const before = game.errorCount();
            outputs.push(sql(game, base, statement));
            // psql -c stops at the first error.
            if (game.errorCount() > before) break;
          }
          return outputs.filter((o) => o !== '').join('\n');
        } finally {
          game.state.pgRole = undefined;
        }
      }
      const file = options['-f'] ?? options['--file'];
      if (file) {
        const raw = game.readFor('psql', file);
        if (raw === null) return '';
        // The script's bytes, read with the encoding it declares (SET client_encoding).
        const node = game.find(file);
        const declared = dumpEncoding(raw).toUpperCase().replace(/[^A-Z0-9]/g, '');
        const decoded = decode(bytes(raw, node?.type === 'file' && node.charset === 'latin1' ? 'latin1' : 'utf8'), declared === 'LATIN1' ? 'latin1' : 'utf8');
        if ('invalid' in decoded) {
          const line = raw.split('\n').findIndex((l) => /[\u0080-\u00ff]/.test(l)) + 1;
          return game.error(`psql:${file}:${line}: ERROR:  invalid byte sequence for encoding "UTF8": ${hexBytes(decoded.invalid)}\nCONTEXT:  COPY failed`);
        }
        const text = decoded.text;
        const tables = readDumpSql(text);
        if (!tables) return game.error(`psql:${file}:1: ERROR:  syntax error at or near "${text.split(/\s+/)[0] ?? ''}"`);
        const errors = restore(game, base, tables, false, false).map((l) =>
          l.replace(/^pg_restore: error: (could not execute query: |COPY failed for table "\w+": )?/, `psql:${file}: `),
        );
        if (errors.length) game.error(errors.join('\n'));
        return ['SET', ...Object.keys(tables).flatMap((n) => ['CREATE TABLE', 'ALTER TABLE', `COPY ${tables[n].lines.length}`])].join('\n');
      }
      return game.error(game.t('psql-interactive'));
    },
  },

  pg_dump: {
    ownOptions: true,
    launch: ({ args, game }) => {
      const { options, lists, positionnels: positional } = readOptions(args, [
        '-f',
        '--file',
        '-F',
        '--format',
        '-t',
        '--table',
        '-d',
        '--dbname',
        '-U',
        '--username',
        '-E',
        '--encoding',
      ]);
      const base = options['-d'] ?? options['--dbname'] ?? positional[0] ?? game.who;
      const e = connection(game, 'pg_dump', base);
      if (e) return game.error(e);
      const b = postgres(game)!.bases[base];
      const chosen = [...(lists['-t'] ?? []), ...(lists['--table'] ?? [])];
      const unknown = chosen.find((t) => !b.tables[t]);
      if (unknown) return game.error(`pg_dump: error: no matching tables were found for pattern "${unknown}"`);
      const tables = copyOf(Object.fromEntries(Object.entries(b.tables).filter(([n]) => !chosen.length || chosen.includes(n))));
      const format = (options['-F'] ?? options['--format'] ?? 'p').toLowerCase()[0];
      const encoding = (options['-E'] ?? options['--encoding'] ?? b.encoding ?? 'UTF8').toUpperCase().replace(/^UTF-8$/, 'UTF8');
      const latin1 = format !== 'c' && /^(LATIN1|ISO88591|ISO-8859-1)$/.test(encoding.replace(/_/g, ''));
      let text: string;
      if (format === 'c') {
        const time = systemd(game)?.clock ?? 0;
        const id = hex(
          `pgdump-${base}-${time}-${JSON.stringify(Object.keys(tables))}-${Object.values(tables).reduce((t, x) => t + x.lines.length, 0)}`,
          16,
        );
        postgres(game)!.archives[id] = { base, tables, time };
        text = `PGDMP ${id}`;
      } else text = dumpSql(base, tables, b.owner, { encoding: encoding, version: postgres(game)!.version });
      const file = options['-f'] ?? options['--file'];
      // Written in the client encoding: the database's own unless -E says otherwise.
      if (!file) {
        if (latin1) game.outputCharset = 'latin1';
        return text;
      }
      const n = game.find(file);
      if (n?.type === 'file') {
        if (!game.can(n, 'w')) return game.error(`pg_dump: error: could not open output file "${file}": Permission denied`);
        n.content = text;
        delete n.size;
        if (latin1) n.charset = 'latin1';
        else delete n.charset;
        return '';
      }
      const error = game.place('pg_dump', file, { type: 'file', content: text, lines: true, owner: game.who, mode: 'rw-r--r--', ...(latin1 ? { charset: 'latin1' as const } : {}) });
      return error
        ? game.error(
            `pg_dump: error: could not open output file "${file}": ${game.find(file + '/..') ? 'Permission denied' : 'No such file or directory'}`,
          )
        : '';
    },
  },

  pg_restore: {
    ownOptions: true,
    launch: ({ args, game }) => {
      const { options, lists, positionnels: positional } = readOptions(args, ['-d', '--dbname', '-t', '--table', '-f', '--file', '-U', '--username']);
      const file = positional[0];
      if (!file) return game.error(game.t('pg-restore-input'));
      const text = game.readFor('pg_restore', file);
      if (text === null) return '';
      const m = CUSTOM.exec(text.trim());
      if (!m) {
        if (readDumpSql(text)) return game.error('pg_restore: error: input file appears to be a text format dump. Please use psql.');
        return game.error('pg_restore: error: input file does not appear to be a valid archive');
      }
      const archive = postgres(game)?.archives[m[1]];
      if (!archive) return game.error('pg_restore: error: input file does not appear to be a valid archive');
      const chosen = [...(lists['-t'] ?? []), ...(lists['--table'] ?? [])];
      const tables = Object.fromEntries(Object.entries(archive.tables).filter(([n]) => !chosen.length || chosen.includes(n)));
      // The archive's owner: the base's, as pg_dump saw it.
      const owner = postgres(game)?.bases[archive.base]?.owner ?? 'postgres';
      if (options['-l'] || options['--list'])
        return [
          ';',
          `; Archive created at ${new Date(archive.time).toISOString().slice(0, 19).replace('T', ' ')} CEST`,
          `;     dbname: ${archive.base}`,
          `;     TOC Entries: ${Object.keys(archive.tables).length * 2}`,
          ';     Format: CUSTOM',
          ';',
          ...Object.keys(archive.tables).flatMap((n, i) => [
            `${210 + i}; 1259 ${16400 + i} TABLE public ${n} ${owner}`,
            `${3360 + i}; 0 ${16400 + i} TABLE DATA public ${n} ${owner}`,
          ]),
        ].join('\n');
      const base = options['-d'] ?? options['--dbname'];
      // Without -d, pg_restore writes the SQL (like a text dump).
      if (!base) return dumpSql(archive.base, tables, owner);
      const e = connection(game, 'pg_restore', base);
      if (e) return game.error(e);
      const errors = restore(game, base, tables, !!(options['-a'] || options['--data-only']), !!(options['-c'] || options['--clean']));
      if (errors.length)
        return game.error(
          [...errors, `pg_restore: warning: errors ignored on restore: ${errors.filter((x) => x.startsWith('pg_restore: error')).length}`].join(
            '\n',
          ),
        );
      game.state.pgRestores = [...(game.state.pgRestores ?? []), { base, archive: m[1], tables: Object.keys(tables) }];
      return '';
    },
  },

  createdb: {
    ownOptions: true,
    launch: ({ args, game }) => {
      const { options, positionnels: positional } = readOptions(args, ['-O', '--owner', '-U', '--username', '-E', '--encoding', '-T', '--template', '-l', '--locale']);
      const name = positional[0] ?? game.who;
      const e = connection(game, 'createdb', 'postgres');
      if (e) return game.error(e);
      const pg = postgres(game)!;
      if (game.who !== 'postgres') return game.error('createdb: error: database creation failed: ERROR:  permission denied to create database');
      if (pg.bases[name]) return game.error(`createdb: error: database creation failed: ERROR:  database "${name}" already exists`);
      const encoding = (options['-E'] ?? options['--encoding'] ?? 'UTF8').toUpperCase().replace(/^UTF-8$/, 'UTF8');
      pg.bases[name] = { owner: options['-O'] ?? options['--owner'] ?? game.who, tables: {}, ...(encoding !== 'UTF8' ? { encoding } : {}) };
      return '';
    },
  },

  // pg_ctl: starts a server on a data directory by hand. On Debian it lives in
  // /usr/lib/postgresql/16/bin, outside the PATH (pg_ctlcluster drives the
  // clusters). A data directory from another version (or another processor's
  // byte order) won't start: the files are not portable, a dump is.
  // https://www.postgresql.org/docs/16/app-pg-ctl.html
  pg_ctl: {
    ownOptions: true,
    directory: '/usr/lib/postgresql/16/bin',
    launch: ({ args, game }) => {
      const i = args.indexOf('-D');
      const dir = i >= 0 ? args[i + 1] : undefined;
      const action = args.find((a, k) => !a.startsWith('-') && (i < 0 || k !== i + 1));
      if (game.who === 'root')
        return game.error('pg_ctl: cannot be run as root\nPlease log in (using, e.g., "su") as the (unprivileged) user that will\nown the server process.', 1);
      if (!action) return game.error('pg_ctl: no operation specified\nTry "pg_ctl --help" for more information.', 1);
      if (!dir) return game.error('pg_ctl: no database directory specified and environment variable PGDATA unset\nTry "pg_ctl --help" for more information.', 1);
      const n = game.find(dir);
      if (!n || n.type !== 'directory') return game.error(`pg_ctl: directory "${dir}" does not exist`, 1);
      const version = game.read(`${dir.replace(/\/$/, '')}/PG_VERSION`)?.trim();
      if (!version) return game.error(`pg_ctl: directory "${dir}" is not a database cluster directory`, 1);
      if (action === 'status') return game.error('pg_ctl: no server running', 3);
      if (action !== 'start') return game.error(`pg_ctl: unrecognized operation mode "${action}"\nTry "pg_ctl --help" for more information.`, 1);
      if (version !== '16') {
        game.state.foreignCluster = version;
        return game.error(
          [
            'waiting for server to start....',
            '2029-11-20 14:02:11.315 CET [4182] FATAL:  database files are incompatible with server',
            `2029-11-20 14:02:11.315 CET [4182] DETAIL:  The data directory was initialized by PostgreSQL version ${version}, which is not compatible with this version 16.9 (Debian 16.9-1.pgdg120+1).`,
            ' stopped waiting',
            'pg_ctl: could not start server',
            'Examine the log output.',
          ].join('\n'),
          1,
        );
      }
      return game.error('pg_ctl: another server might be running; trying to start server anyway', 1);
    },
  },

  dropdb: {
    ownOptions: true,
    launch: ({ args, game }) => {
      const { positionnels: positional } = readOptions(args, ['-U', '--username']);
      const name = positional[0];
      if (!name) return game.error('dropdb: error: missing required argument database name');
      const e = connection(game, 'dropdb', 'postgres');
      if (e) return game.error(e);
      const pg = postgres(game)!;
      if (!pg.bases[name]) return game.error(`dropdb: error: database removal failed: ERROR:  database "${name}" does not exist`);
      if (game.who !== 'postgres' && pg.bases[name].owner !== game.who)
        return game.error(`dropdb: error: database removal failed: ERROR:  must be owner of database ${name}`);
      delete pg.bases[name];
      return '';
    },
  },
};
