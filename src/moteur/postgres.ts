// PostgreSQL simulé : des bases, leurs tables (colonnes et lignes), et ce
// qu'il faut pour les sauvegarder et les restaurer comme le font pg_dump,
// pg_restore et psql (PostgreSQL 16 : https://www.postgresql.org/docs/16/).
//
//   etat.postgres = { bases: { nom: Base }, archives: { id: Instantane } }
//
// On se connecte par le socket local avec l'authentification « peer » : le
// compte du système est le rôle de la base (sudo -u postgres pour le
// superutilisateur). Écarts : du SQL très réduit (voir commandes/postgres.ts),
// une seule clé primaire (la première colonne), pas de transactions ni de
// droits par table ; un fichier « custom » (pg_dump -Fc) ne contient qu'une
// référence à l'instantané gardé par le jeu.

import type { Jeu } from './shell';
import { systemd } from './systemd';

export interface Table {
  colonnes: string[];
  lignes: string[][];
}

export interface Base {
  proprio: string;
  tables: Record<string, Table>;
}

export interface EtatPostgres {
  bases: Record<string, Base>;
  // Les rôles (comptes de la base) ; postgres est superutilisateur.
  roles: string[];
  // Les archives au format custom, par identifiant (écrit dans le fichier).
  archives: Record<string, { base: string; tables: Record<string, Table>; temps: number }>;
}

export const SOCKET = '/var/run/postgresql/.s.PGSQL.5432';
export const postgres = (j: Jeu): EtatPostgres | undefined => j.etat.postgres;

/** Le serveur tourne-t-il ? Sinon, le message de connexion de libpq. */
export function connexion(j: Jeu, outil: string, base: string): string | null {
  const pg = postgres(j);
  const service = systemd(j)?.services.postgresql;
  if (!pg || (service && service.etat !== 'active'))
    return `${outil}: error: connection to server on socket "${SOCKET}" failed: No such file or directory\n\tIs the server running locally and accepting connections on that socket?`;
  if (!pg.roles.includes(j.qui)) return `${outil}: error: connection to server on socket "${SOCKET}" failed: FATAL:  role "${j.qui}" does not exist`;
  if (!pg.bases[base]) return `${outil}: error: connection to server on socket "${SOCKET}" failed: FATAL:  database "${base}" does not exist`;
  return null;
}

export const copie = (tables: Record<string, Table>): Record<string, Table> =>
  Object.fromEntries(Object.entries(tables).map(([nom, t]) => [nom, { colonnes: [...t.colonnes], lignes: t.lignes.map((l) => [...l]) }]));

/** Un tableau au format de psql (colonnes alignées, « (3 rows) »). */
export function tableau(colonnes: string[], lignes: string[][], titre?: string): string {
  const largeurs = colonnes.map((c, i) => Math.max(c.length, ...lignes.map((l) => (l[i] ?? '').length)));
  const numerique = colonnes.map((_, i) => lignes.length > 0 && lignes.every((l) => /^-?\d+$/.test(l[i] ?? '')));
  const cellule = (v: string, i: number) => (numerique[i] ? v.padStart(largeurs[i]) : v.padEnd(largeurs[i]));
  const total = largeurs.reduce((t, l) => t + l + 3, -1);
  return [
    ...(titre ? [' '.repeat(Math.max(0, Math.floor((total - titre.length) / 2))) + titre] : []),
    ` ${colonnes.map((c, i) => c.padStart(Math.floor((largeurs[i] + c.length) / 2)).padEnd(largeurs[i])).join(' | ')} `,
    largeurs.map((l) => '-'.repeat(l + 2)).join('+'),
    ...lignes.map((l) => ` ${l.map(cellule).join(' | ')} `),
    `(${lignes.length} ${lignes.length === 1 ? 'row' : 'rows'})`,
    '',
  ].join('\n');
}

/** Le contenu d'un dump au format texte (SQL) : ce qu'écrit pg_dump sans -Fc. */
export function dumpSql(base: string, tables: Record<string, Table>, proprio: string): string {
  const lignes = [
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
  for (const [nom, t] of Object.entries(tables)) {
    lignes.push(
      `CREATE TABLE public.${nom} (`,
      ...t.colonnes.map((c, i) => `    ${c} ${i === 0 ? 'integer NOT NULL' : 'text'}${i < t.colonnes.length - 1 ? ',' : ''}`),
      ');',
      '',
      `ALTER TABLE public.${nom} OWNER TO ${proprio};`,
      '',
      `COPY public.${nom} (${t.colonnes.join(', ')}) FROM stdin;`,
      ...t.lignes.map((l) => l.join('\t')),
      '\\.',
      '',
    );
  }
  lignes.push('--', `-- PostgreSQL database dump complete (${base})`, '--');
  return lignes.join('\n');
}

/** Relit un dump texte (le nôtre) : ses tables, ou null si ce n'en est pas un. */
export function lireDumpSql(texte: string): Record<string, Table> | null {
  if (!texte.includes('-- PostgreSQL database dump')) return null;
  const tables: Record<string, Table> = {};
  const lignes = texte.split('\n');
  for (let i = 0; i < lignes.length; i++) {
    const m = /^COPY public\.(\w+) \(([^)]*)\) FROM stdin;$/.exec(lignes[i]);
    if (!m) continue;
    const t: Table = { colonnes: m[2].split(', '), lignes: [] };
    for (i++; i < lignes.length && lignes[i] !== '\\.'; i++) t.lignes.push(lignes[i].split('\t'));
    tables[m[1]] = t;
  }
  return tables;
}
