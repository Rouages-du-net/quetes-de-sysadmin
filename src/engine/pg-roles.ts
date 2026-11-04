// PostgreSQL's roles and privileges, when a chapter models them
// (state.postgres.server.acl): each role's attributes (LOGIN, SUPERUSER) and
// memberships, the privileges granted on each table, the default privileges
// (ALTER DEFAULT PRIVILEGES) given to the tables a role will create, and the
// role a psql session acts as (SET ROLE). A table's owner and the superusers
// may do anything; the others only what was granted to them, or to a role
// they are a member of.
// Sources: https://www.postgresql.org/docs/16/ddl-priv.html,
// https://www.postgresql.org/docs/16/sql-grant.html,
// https://www.postgresql.org/docs/16/sql-alterdefaultprivileges.html,
// https://www.postgresql.org/docs/16/sql-createrole.html
// Simplifications: one schema (public), whose USAGE and the database's
// CONNECT stay granted to PUBLIC (PostgreSQL 15's defaults); table
// privileges only (no columns, sequences nor functions); no WITH GRANT
// OPTION; a role always inherits its memberships (INHERIT).

import type { Game } from './shell';
import { postgres } from './postgres';

export type Privilege = 'SELECT' | 'INSERT' | 'UPDATE' | 'DELETE' | 'TRUNCATE' | 'REFERENCES' | 'TRIGGER';
export const PRIVILEGES: Privilege[] = ['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER'];
// The letters of an ACL (\dp): r SELECT, a INSERT, w UPDATE, d DELETE, D TRUNCATE, x REFERENCES, t TRIGGER.
const LETTERS: Record<Privilege, string> = { SELECT: 'r', INSERT: 'a', UPDATE: 'w', DELETE: 'd', TRUNCATE: 'D', REFERENCES: 'x', TRIGGER: 't' };

export interface RoleAttributes {
  login: boolean;
  superuser: boolean;
  memberOf: string[];
}

export interface Acl {
  roles: Record<string, RoleAttributes>;
  // table → role → privileges.
  grants: Record<string, Record<string, Privilege[]>>;
  // Who owns each table (the database's owner by default).
  owners: Record<string, string>;
  // ALTER DEFAULT PRIVILEGES: for the tables that `creator` will create, `grantee` receives `privileges`.
  defaults: { creator: string; grantee: string; privileges: Privilege[] }[];
}

export const acl = (j: Game): Acl | undefined => postgres(j)?.server?.acl;

/** The role a statement runs as: the one SET ROLE chose, otherwise the connected account. */
export const sessionRole = (j: Game): string => j.state.pgRole ?? j.who;

/** The roles whose rights this role has: itself and, recursively, those it is a member of. */
export function rolesOf(a: Acl, role: string, seen = new Set<string>()): string[] {
  if (seen.has(role)) return [];
  seen.add(role);
  return [role, ...(a.roles[role]?.memberOf ?? []).flatMap((r) => rolesOf(a, r, seen))];
}

export const isSuperuser = (a: Acl, role: string) => rolesOf(a, role).some((r) => a.roles[r]?.superuser);
export const owner = (j: Game, a: Acl, base: string, table: string) => a.owners[table] ?? postgres(j)!.bases[base].owner;

/** May this role do this on this table? */
export function allowed(j: Game, base: string, table: string, privilege: Privilege, role = sessionRole(j)): boolean {
  const a = acl(j);
  if (!a) return true;
  if (isSuperuser(a, role)) return true;
  const roles = rolesOf(a, role);
  if (roles.includes(owner(j, a, base, table))) return true;
  return roles.some((r) => a.grants[table]?.[r]?.includes(privilege));
}

/** A new table, created by `creator`: it gets the default privileges that apply to it. */
export function tableCreated(j: Game, table: string, creator: string) {
  const a = acl(j);
  if (!a) return;
  a.owners[table] = creator;
  for (const d of a.defaults.filter((x) => x.creator === creator)) {
    const g = ((a.grants[table] ??= {})[d.grantee] ??= []);
    for (const p of d.privileges) if (!g.includes(p)) g.push(p);
  }
}

/** A table's ACL as \dp writes it: owner=arwdDxt/owner, then each grantee. */
export function aclText(j: Game, base: string, table: string): string {
  const a = acl(j)!;
  const own = owner(j, a, base, table);
  const grants = Object.entries(a.grants[table] ?? {}).filter(([, ps]) => ps.length);
  if (!grants.length) return '';
  const letters = (ps: Privilege[]) => PRIVILEGES.filter((p) => ps.includes(p)).map((p) => LETTERS[p]).join('');
  return [`${own}=arwdDxt/${own}`, ...grants.map(([r, ps]) => `${r}=${letters(ps)}/${own}`)].join('\n');
}

export const lettersOf = (ps: Privilege[]) => PRIVILEGES.filter((p) => ps.includes(p)).map((p) => LETTERS[p]).join('');
