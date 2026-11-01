// Les outils de PostgreSQL 16 : psql (une requête avec -c, un fichier avec
// -f, la liste des bases avec -l), pg_dump (texte ou -Fc), pg_restore,
// createdb et dropdb. Le serveur est simulé dans postgres.ts.
// D'après https://www.postgresql.org/docs/16/app-pgdump.html,
// https://www.postgresql.org/docs/16/app-pgrestore.html et
// https://www.postgresql.org/docs/16/app-psql.html.
// Écarts : SQL réduit à SELECT count(*), SELECT … [WHERE col = v] [ORDER BY]
// [LIMIT], DELETE [WHERE col = v], TRUNCATE, DROP TABLE, ALTER ROLE … PASSWORD
// (le mot de passe d'un rôle, par le compte postgres), et aux méta-commandes
// \l, \dt, \d, \du ; psql sans -c ni -f ne s'ouvre pas en mode interactif.

import type { Shell } from '../shell';
import { connection, copyOf, dumpSql, readDumpSql, postgres, grid, type Table } from '../postgres';
import { hex } from './restic';
import { systemd } from '../systemd';
import type { Command } from './index';

// Les options d'une commande : -x valeur, --long=valeur, -Fc.
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

/** Exécute une instruction SQL (ou une méta-commande) ; renvoie la sortie de psql. */
function sql(game: Shell, base: string, httpRequest: string): string {
  const pg = postgres(game)!;
  const b = pg.bases[base];
  const r = httpRequest.trim().replace(/;\s*$/, '');
  const table = (name: string): Table | string => b.tables[name.toLowerCase()] ?? `ERROR:  relation "${name}" does not exist`;
  if (/^\\l(ist)?\+?$/.test(r))
    return grid(
      ['Name', 'Owner', 'Encoding'],
      Object.entries(pg.bases)
        .sort(([a], [z]) => a.localeCompare(z))
        .map(([name, x]) => [name, x.owner, 'UTF8']),
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
    return grid(
      ['Column', 'Type'],
      t.columns.map((c, i) => [c, i === 0 ? 'integer' : 'text']),
      `Table "public.${d[1]}"`,
    );
  }
  // Les rôles : \du, et ALTER ROLE … PASSWORD (le mot de passe d'un compte de la base).
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
  // WHERE col = valeur (une seule condition).
  const filter = (t: Table, or?: string): string[][] | string => {
    if (!or) return t.lines;
    const m = /^(\w+)\s*=\s*('?[^']*'?|\d+)$/.exec(or.trim());
    if (!m) return `ERROR:  syntax error at or near "${or.trim().split(/\s+/)[1] ?? or}"`;
    const i = t.columns.indexOf(m[1]);
    if (i < 0) return `ERROR:  column "${m[1]}" does not exist`;
    return t.lines.filter((l) => l[i] === value(m[2]));
  };
  const account = /^select\s+count\(\*\)\s+from\s+(\w+)(?:\s+where\s+(.+))?$/i.exec(r);
  if (account) {
    const t = table(account[1]);
    if (typeof t === 'string') return game.error(t);
    const lines = filter(t, account[2]);
    if (typeof lines === 'string') return game.error(lines);
    return grid(['count'], [[String(lines.length)]]);
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
    return grid(
      columns,
      lines.map((l) => columns.map((c) => l[t.columns.indexOf(c)])),
    );
  }
  const deletion = /^delete\s+from\s+(\w+)(?:\s+where\s+(.+))?$/i.exec(r);
  if (deletion) {
    const t = table(deletion[1]);
    if (typeof t === 'string') return game.error(t);
    const targeted = filter(t, deletion[2]);
    if (typeof targeted === 'string') return game.error(targeted);
    t.lines = t.lines.filter((l) => !targeted.includes(l));
    return `DELETE ${targeted.length}`;
  }
  const empty = /^truncate\s+(?:table\s+)?(\w+)$/i.exec(r);
  if (empty) {
    const t = table(empty[1]);
    if (typeof t === 'string') return game.error(t);
    t.lines = [];
    return 'TRUNCATE TABLE';
  }
  const erase = /^drop\s+table\s+(\w+)$/i.exec(r);
  if (erase) {
    const t = table(erase[1]);
    if (typeof t === 'string') return game.error(t);
    delete b.tables[erase[1].toLowerCase()];
    return 'DROP TABLE';
  }
  return game.error(`ERROR:  syntax error at or near "${r.split(/\s+/)[0]}"\nLINE 1: ${r}\n        ^`);
}

/** Restaure des tables dans une base, comme pg_restore (ou psql -f) ; renvoie les erreurs. */
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
    // La clé primaire (la première colonne) : un doublon fait échouer tout le COPY de la table.
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
      const { options, positionnels: positional } = readOptions(args, ['-d', '--dbname', '-c', '--command', '-f', '--file', '-U', '--username']);
      if (options['-l'] || options['--list']) {
        const e = connection(game, 'psql', 'postgres');
        return e ? game.error(e) : sql(game, 'postgres', '\\l');
      }
      const base = options['-d'] ?? options['--dbname'] ?? positional[0] ?? game.who;
      const e = connection(game, 'psql', base);
      if (e) return game.error(e);
      const httpRequest = options['-c'] ?? options['--command'];
      if (httpRequest) return sql(game, base, httpRequest);
      const file = options['-f'] ?? options['--file'];
      if (file) {
        const text = game.readFor('psql', file);
        if (text === null) return '';
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
      let text: string;
      if (format === 'c') {
        const time = systemd(game)?.clock ?? 0;
        const id = hex(
          `pgdump-${base}-${time}-${JSON.stringify(Object.keys(tables))}-${Object.values(tables).reduce((t, x) => t + x.lines.length, 0)}`,
          16,
        );
        postgres(game)!.archives[id] = { base, tables, time };
        text = `PGDMP ${id}`;
      } else text = dumpSql(base, tables, b.owner);
      const file = options['-f'] ?? options['--file'];
      if (!file) return text;
      const n = game.find(file);
      if (n?.type === 'file') {
        if (!game.can(n, 'w')) return game.error(`pg_dump: error: could not open output file "${file}": Permission denied`);
        n.content = text;
        delete n.size;
        return '';
      }
      const error = game.place('pg_dump', file, { type: 'file', content: text, lines: true, owner: game.who, mode: 'rw-r--r--' });
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
      if (options['-l'] || options['--list'])
        return [
          ';',
          `; Archive created at ${new Date(archive.time).toISOString().slice(0, 19).replace('T', ' ')} CEST`,
          `;     dbname: ${archive.base}`,
          `;     TOC Entries: ${Object.keys(archive.tables).length * 2}`,
          ';     Format: CUSTOM',
          ';',
          ...Object.keys(archive.tables).flatMap((n, i) => [
            `${210 + i}; 1259 ${16400 + i} TABLE public ${n} ludo`,
            `${3360 + i}; 0 ${16400 + i} TABLE DATA public ${n} ludo`,
          ]),
        ].join('\n');
      const base = options['-d'] ?? options['--dbname'];
      // Sans -d, pg_restore écrit le SQL (comme un dump texte).
      if (!base) return dumpSql(archive.base, tables, 'ludo');
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
      const { options, positionnels: positional } = readOptions(args, ['-O', '--owner', '-U', '--username']);
      const name = positional[0] ?? game.who;
      const e = connection(game, 'createdb', 'postgres');
      if (e) return game.error(e);
      const pg = postgres(game)!;
      if (game.who !== 'postgres') return game.error('createdb: error: database creation failed: ERROR:  permission denied to create database');
      if (pg.bases[name]) return game.error(`createdb: error: database creation failed: ERROR:  database "${name}" already exists`);
      pg.bases[name] = { owner: options['-O'] ?? options['--owner'] ?? game.who, tables: {} };
      return '';
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
