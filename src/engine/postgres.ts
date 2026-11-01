// Simulated PostgreSQL: databases, their tables (columns and rows), and what
// is needed to back them up and restore them as pg_dump,
// pg_restore and psql do (PostgreSQL 16: https://www.postgresql.org/docs/16/).
//
//   etat.postgres = { bases: { nom: Base }, archives: { id: Instantane } }
//
// Connections go through the local socket with "peer" authentication: the
// system account is the database role (sudo -u postgres for the
// superuser). Differences: very reduced SQL (see commands/postgres.ts),
// a single primary key (the first column), no transactions nor
// per-table privileges; a "custom" file (pg_dump -Fc) only contains a
// reference to the snapshot kept by the game.

import type { Game } from './shell';
import { systemd } from './systemd';

export interface Table {
  columns: string[];
  lines: string[][];
}

export interface Base {
  owner: string;
  tables: Record<string, Table>;
}

export interface PostgresState {
  bases: Record<string, Base>;
  // The roles (database accounts); postgres is superuser.
  roles: string[];
  // The password of roles that connect over the network (ALTER ROLE … PASSWORD): role → password.
  passwords?: Record<string, string>;
  // The custom-format archives, by identifier (written in the file).
  archives: Record<string, { base: string; tables: Record<string, Table>; time: number }>;
}

export const SOCKET = '/var/run/postgresql/.s.PGSQL.5432';
export const postgres = (j: Game): PostgresState | undefined => j.state.postgres;

/** Is the server running? Otherwise, libpq's connection message. */
export function connection(j: Game, tool: string, base: string): string | null {
  const pg = postgres(j);
  const service = systemd(j)?.services.postgresql;
  if (!pg || (service && service.state !== 'active'))
    return `${tool}: error: connection to server on socket "${SOCKET}" failed: No such file or directory\n\tIs the server running locally and accepting connections on that socket?`;
  if (!pg.roles.includes(j.who)) return `${tool}: error: connection to server on socket "${SOCKET}" failed: FATAL:  role "${j.who}" does not exist`;
  if (!pg.bases[base]) return `${tool}: error: connection to server on socket "${SOCKET}" failed: FATAL:  database "${base}" does not exist`;
  return null;
}

export const copyOf = (tables: Record<string, Table>): Record<string, Table> =>
  Object.fromEntries(Object.entries(tables).map(([name, t]) => [name, { columns: [...t.columns], lines: t.lines.map((l) => [...l]) }]));

/** A table in psql's format (aligned columns, "(3 rows)"). */
export function grid(columns: string[], lines: string[][], title?: string): string {
  const widths = columns.map((c, i) => Math.max(c.length, ...lines.map((l) => (l[i] ?? '').length)));
  const numeric = columns.map((_, i) => lines.length > 0 && lines.every((l) => /^-?\d+$/.test(l[i] ?? '')));
  const cell = (v: string, i: number) => (numeric[i] ? v.padStart(widths[i]) : v.padEnd(widths[i]));
  const total = widths.reduce((t, l) => t + l + 3, -1);
  return [
    ...(title ? [' '.repeat(Math.max(0, Math.floor((total - title.length) / 2))) + title] : []),
    ` ${columns.map((c, i) => c.padStart(Math.floor((widths[i] + c.length) / 2)).padEnd(widths[i])).join(' | ')} `,
    widths.map((l) => '-'.repeat(l + 2)).join('+'),
    ...lines.map((l) => ` ${l.map(cell).join(' | ')} `),
    `(${lines.length} ${lines.length === 1 ? 'row' : 'rows'})`,
    '',
  ].join('\n');
}

/** The contents of a dump in text format (SQL): what pg_dump writes without -Fc. */
export function dumpSql(base: string, tables: Record<string, Table>, owner: string): string {
  const lines = [
    '--',
    '-- PostgreSQL database dump',
    '--',
    '',
    '-- Dumped from database version 16.9 (Debian 16.9-1.pgdg120+1)',
    '-- Dumped by pg_dump version 16.9 (Debian 16.9-1.pgdg120+1)',
    '',
    "SET client_encoding = 'UTF8';",
    '',
  ];
  for (const [name, t] of Object.entries(tables)) {
    lines.push(
      `CREATE TABLE public.${name} (`,
      ...t.columns.map((c, i) => `    ${c} ${i === 0 ? 'integer NOT NULL' : 'text'}${i < t.columns.length - 1 ? ',' : ''}`),
      ');',
      '',
      `ALTER TABLE public.${name} OWNER TO ${owner};`,
      '',
      `COPY public.${name} (${t.columns.join(', ')}) FROM stdin;`,
      ...t.lines.map((l) => l.join('\t')),
      '\\.',
      '',
    );
  }
  lines.push('--', `-- PostgreSQL database dump complete (${base})`, '--');
  return lines.join('\n');
}

/** Rereads a text dump (ours): its tables, or null if it isn't one. */
export function readDumpSql(text: string): Record<string, Table> | null {
  if (!text.includes('-- PostgreSQL database dump')) return null;
  const tables: Record<string, Table> = {};
  const lines = text.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const m = /^COPY public\.(\w+) \(([^)]*)\) FROM stdin;$/.exec(lines[i]);
    if (!m) continue;
    const t: Table = { columns: m[2].split(', '), lines: [] };
    for (i++; i < lines.length && lines[i] !== '\\.'; i++) t.lines.push(lines[i].split('\t'));
    tables[m[1]] = t;
  }
  return tables;
}
