// PostgreSQL simulé : des bases, leurs tables (colonnes et lignes), et ce
// qu'il faut pour les sauvegarder et les restaurer comme le font pg_dump,
// pg_restore et psql (PostgreSQL 16 : https://www.postgresql.org/docs/16/).
//
//   etat.postgres = { bases: { nom: Base }, archives: { id: Instantane } }
//
// On se connecte par le socket local avec l'authentification « peer » : le
// compte du système est le rôle de la base (sudo -u postgres pour le
// superutilisateur). Écarts : du SQL très réduit (voir commands/postgres.ts),
// une seule clé primaire (la première colonne), pas de transactions ni de
// droits par table ; un fichier « custom » (pg_dump -Fc) ne contient qu'une
// référence à l'instantané gardé par le jeu.

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
  // Les rôles (comptes de la base) ; postgres est superutilisateur.
  roles: string[];
  // Le mot de passe des rôles qui se connectent par le réseau (ALTER ROLE … PASSWORD) : role → mot de passe.
  passwords?: Record<string, string>;
  // Les archives au format custom, par identifiant (écrit dans le fichier).
  archives: Record<string, { base: string; tables: Record<string, Table>; time: number }>;
}

export const SOCKET = '/var/run/postgresql/.s.PGSQL.5432';
export const postgres = (j: Game): PostgresState | undefined => j.state.postgres;

/** Le serveur tourne-t-il ? Sinon, le message de connexion de libpq. */
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

/** Un tableau au format de psql (colonnes alignées, « (3 rows) »). */
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

/** Le contenu d'un dump au format texte (SQL) : ce qu'écrit pg_dump sans -Fc. */
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

/** Relit un dump texte (le nôtre) : ses tables, ou null si ce n'en est pas un. */
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
