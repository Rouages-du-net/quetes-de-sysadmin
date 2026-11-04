// Roles and privileges in psql, on the model of ../pg-roles.ts: CREATE
// ROLE/USER, ALTER ROLE (attributes), DROP ROLE, GRANT/REVOKE on tables (or
// ALL TABLES IN SCHEMA public), GRANT/REVOKE a role (membership), ALTER
// DEFAULT PRIVILEGES, SET ROLE/RESET ROLE, \du, \dp (\z), \ddp, and
// INSERT/UPDATE (to try a privilege). Messages after PostgreSQL 16:
// https://www.postgresql.org/docs/16/sql-grant.html,
// https://www.postgresql.org/docs/16/app-psql.html (\dp, \ddp, \du)
// Differences: see ../pg-roles.ts; GRANT CONNECT ON DATABASE and GRANT USAGE
// ON SCHEMA are accepted (they are already granted to PUBLIC).

import type { Shell } from '../shell';
import { grid, postgres } from '../postgres';
import { acl, aclText, allowed, isSuperuser, lettersOf, PRIVILEGES, sessionRole, type Privilege } from '../pg-roles';

const unquote = (v: string) => v.trim().replace(/^'(.*)'$/, '$1').replace(/^"(.*)"$/, '$1');

/** "SELECT, INSERT" or "ALL [PRIVILEGES]" → the privileges; null if one is unknown. */
function readPrivileges(text: string): Privilege[] | null {
  if (/^all(\s+privileges)?$/i.test(text.trim())) return [...PRIVILEGES];
  const ps = text.split(',').map((p) => p.trim().toUpperCase());
  return ps.every((p) => (PRIVILEGES as string[]).includes(p)) ? (ps as Privilege[]) : null;
}

/** The statements about roles and privileges; null if it is not one of them. */
export function roleSql(game: Shell, base: string, r: string): string | null {
  const a = acl(game);
  if (!a) return null;
  const pg = postgres(game)!;
  const me = sessionRole(game);
  const admin = isSuperuser(a, me);
  const denied = (what: string) => game.error(`ERROR:  permission denied to ${what}`);
  const exists = (role: string) => pg.roles.includes(role);
  const tables = Object.keys(pg.bases[base].tables);

  // SET ROLE name / RESET ROLE: act as another role for the rest of the session.
  const set = /^set\s+role\s+(?:to\s+)?("?\w+"?|none)$/i.exec(r);
  if (set || /^reset\s+role$/i.test(r)) {
    const target = set && !/^none$/i.test(set[1]) ? unquote(set[1]) : null;
    if (target && !exists(target)) return game.error(`ERROR:  role "${target}" does not exist`);
    // Only a superuser, or a member of the role, may become it.
    if (target && !isSuperuser(a, game.who) && !(a.roles[game.who]?.memberOf ?? []).includes(target)) return game.error(`ERROR:  permission denied to set role "${target}"`);
    game.state.pgRole = target ?? undefined;
    return set ? 'SET' : 'RESET';
  }

  // CREATE ROLE / CREATE USER name [WITH] [LOGIN] [SUPERUSER] [PASSWORD '…']
  const create = /^create\s+(role|user)\s+("?\w+"?)\s*(.*)$/i.exec(r);
  if (create) {
    if (!admin) return denied('create role');
    const name = unquote(create[2]);
    if (exists(name)) return game.error(`ERROR:  role "${name}" already exists`);
    const options = create[3].replace(/^with\s+/i, '');
    pg.roles.push(name);
    a.roles[name] = { login: /^user$/i.test(create[1]) || /\blogin\b/i.test(options) && !/\bnologin\b/i.test(options), superuser: /\bsuperuser\b/i.test(options) && !/\bnosuperuser\b/i.test(options), memberOf: [] };
    const password = /password\s+'([^']*)'/i.exec(options);
    if (password) (pg.passwords ??= {})[name] = password[1];
    return 'CREATE ROLE';
  }

  // ALTER ROLE name [WITH] LOGIN | NOLOGIN | SUPERUSER | NOSUPERUSER | PASSWORD '…'
  const alter = /^alter\s+(?:role|user)\s+("?\w+"?)\s+(?:with\s+)?(.+)$/i.exec(r);
  if (alter && !/^rename\b/i.test(alter[2])) {
    const name = unquote(alter[1]);
    if (!exists(name)) return game.error(`ERROR:  role "${name}" does not exist`);
    if (!admin) return game.error('ERROR:  permission denied to alter role\nDETAIL:  Only roles with the CREATEROLE attribute may alter roles.');
    const o = alter[2];
    const attrs = (a.roles[name] ??= { login: false, superuser: false, memberOf: [] });
    if (/\bnologin\b/i.test(o)) attrs.login = false;
    else if (/\blogin\b/i.test(o)) attrs.login = true;
    if (/\bnosuperuser\b/i.test(o)) attrs.superuser = false;
    else if (/\bsuperuser\b/i.test(o)) attrs.superuser = true;
    const password = /password\s+'([^']*)'/i.exec(o);
    if (password) (pg.passwords ??= {})[name] = password[1];
    return 'ALTER ROLE';
  }

  // DROP ROLE name
  const drop = /^drop\s+(?:role|user)\s+(?:if\s+exists\s+)?("?\w+"?)$/i.exec(r);
  if (drop) {
    const name = unquote(drop[1]);
    if (!exists(name)) return game.error(`ERROR:  role "${name}" does not exist`);
    if (!admin) return denied('drop role');
    const holds = Object.entries(a.grants).filter(([, g]) => g[name]?.length).map(([t]) => t);
    if (holds.length) return game.error(`ERROR:  role "${name}" cannot be dropped because some objects depend on it\nDETAIL:  ${holds.map((t) => `privileges for table ${t}`).join('\n')}`);
    pg.roles = pg.roles.filter((x) => x !== name);
    delete a.roles[name];
    a.defaults = a.defaults.filter((d) => d.grantee !== name);
    for (const x of Object.values(a.roles)) x.memberOf = x.memberOf.filter((m) => m !== name);
    return 'DROP ROLE';
  }

  // GRANT CONNECT ON DATABASE … / GRANT USAGE ON SCHEMA public …: already PUBLIC's, accepted.
  if (/^(grant|revoke)\s+(connect|usage|create|temp|temporary|all)(\s+privileges)?\s+on\s+(database|schema)\s+\w+\s+(to|from)\s+"?\w+"?$/i.test(r)) {
    const role = unquote(r.split(/\s+/).at(-1)!);
    if (!exists(role)) return game.error(`ERROR:  role "${role}" does not exist`);
    return /^grant/i.test(r) ? 'GRANT' : 'REVOKE';
  }

  // GRANT privileges ON [TABLE] t[, t] | ALL TABLES IN SCHEMA public TO role; REVOKE … FROM role
  const g = /^(grant|revoke)\s+(.+?)\s+on\s+(?:table\s+)?(all\s+tables\s+in\s+schema\s+public|[\w,\s]+?)\s+(to|from)\s+("?\w+"?)$/i.exec(r);
  if (g) {
    const grant = /^grant$/i.test(g[1]);
    const privileges = readPrivileges(g[2]);
    if (!privileges) return game.error(`ERROR:  unrecognized privilege type "${g[2].split(',')[0].trim().toLowerCase()}"`);
    const role = unquote(g[5]);
    if (!exists(role)) return game.error(`ERROR:  role "${role}" does not exist`);
    const targets = /^all\s+tables/i.test(g[3]) ? tables : g[3].split(',').map((t) => t.trim().toLowerCase());
    const unknown = targets.find((t) => !tables.includes(t));
    if (unknown) return game.error(`ERROR:  relation "${unknown}" does not exist`);
    for (const t of targets) {
      const own = a.owners[t] ?? pg.bases[base].owner;
      if (!admin && me !== own) return game.error(`ERROR:  permission denied for table ${t}`);
      const list = ((a.grants[t] ??= {})[role] ??= []);
      a.grants[t][role] = grant ? [...new Set([...list, ...privileges])] : list.filter((p) => !privileges.includes(p));
    }
    return grant ? 'GRANT' : 'REVOKE';
  }

  // GRANT role TO role (membership); REVOKE role FROM role
  const member = /^(grant|revoke)\s+("?\w+"?)\s+(to|from)\s+("?\w+"?)$/i.exec(r);
  if (member) {
    const [group, role] = [unquote(member[2]), unquote(member[4])];
    for (const x of [group, role]) if (!exists(x)) return game.error(`ERROR:  role "${x}" does not exist`);
    if (!admin) return denied(`grant role "${group}"`);
    const attrs = (a.roles[role] ??= { login: false, superuser: false, memberOf: [] });
    attrs.memberOf = /^grant$/i.test(member[1]) ? [...new Set([...attrs.memberOf, group])] : attrs.memberOf.filter((m) => m !== group);
    return /^grant$/i.test(member[1]) ? 'GRANT ROLE' : 'REVOKE ROLE';
  }

  // ALTER DEFAULT PRIVILEGES [FOR ROLE r] [IN SCHEMA public] GRANT privileges ON TABLES TO role (or REVOKE … FROM)
  const def = /^alter\s+default\s+privileges\s+(?:for\s+(?:role|user)\s+("?\w+"?)\s+)?(?:in\s+schema\s+public\s+)?(grant|revoke)\s+(.+?)\s+on\s+tables\s+(to|from)\s+("?\w+"?)$/i.exec(r);
  if (def) {
    const creator = def[1] ? unquote(def[1]) : me;
    const role = unquote(def[5]);
    for (const x of [creator, role]) if (!exists(x)) return game.error(`ERROR:  role "${x}" does not exist`);
    if (!admin && creator !== me) return game.error('ERROR:  permission denied to change default privileges');
    const privileges = readPrivileges(def[3]);
    if (!privileges) return game.error(`ERROR:  unrecognized privilege type "${def[3].trim().toLowerCase()}"`);
    let d = a.defaults.find((x) => x.creator === creator && x.grantee === role);
    if (!d) a.defaults.push((d = { creator, grantee: role, privileges: [] }));
    d.privileges = /^grant$/i.test(def[2]) ? [...new Set([...d.privileges, ...privileges])] : d.privileges.filter((p) => !privileges.includes(p));
    return 'ALTER DEFAULT PRIVILEGES';
  }

  // \du: the roles and their attributes.
  if (/^\\du\+?$/.test(r))
    return grid(
      ['Role name', 'Attributes'],
      [...pg.roles].sort().map((n) => {
        const x = a.roles[n];
        const attrs = [x?.superuser ? 'Superuser, Create role, Create DB, Replication, Bypass RLS' : '', x && !x.login ? 'Cannot login' : ''].filter(Boolean).join(', ');
        return [n, attrs];
      }),
      'List of roles',
    );
  // \dp, \z: each table's access privileges.
  if (/^\\(dp|z)(\s+\w+)?$/.test(r)) {
    const only = r.split(/\s+/)[1]?.toLowerCase();
    const chosen = tables.filter((t) => !only || t === only).sort();
    // A cell of several lines: psql ends each line but the last with "+".
    const rows = chosen.flatMap((t) => {
      const entries = aclText(game, base, t).split('\n');
      return entries.map((e, i) => [i ? '' : 'public', i ? '' : t, i ? '' : 'table', `${e}${i < entries.length - 1 ? '+' : ''}`, '', '']);
    });
    return grid(['Schema', 'Name', 'Type', 'Access privileges', 'Column privileges', 'Policies'], rows, 'Access privileges').replace(/\(\d+ rows?\)/, `(${chosen.length} ${chosen.length === 1 ? 'row' : 'rows'})`);
  }
  // \ddp: the default privileges.
  if (/^\\ddp$/.test(r))
    return grid(
      ['Owner', 'Schema', 'Type', 'Access privileges'],
      a.defaults.filter((d) => d.privileges.length).map((d) => [d.creator, 'public', 'table', `${d.grantee}=${lettersOf(d.privileges)}/${d.creator}`]),
      'Default access privileges',
    );

  // INSERT INTO t [(cols)] VALUES (…); UPDATE t SET c = v [WHERE c = v]: checked, then applied to the sample.
  const insert = /^insert\s+into\s+(\w+)\s*(?:\(([^)]*)\))?\s*values\s*\((.*)\)$/i.exec(r);
  if (insert) {
    const name = insert[1].toLowerCase();
    const t = pg.bases[base].tables[name];
    if (!t) return game.error(`ERROR:  relation "${insert[1]}" does not exist`);
    if (!allowed(game, base, name, 'INSERT')) return game.error(`ERROR:  permission denied for table ${name}`);
    const values = insert[3].split(',').map(unquote);
    const cols = insert[2] ? insert[2].split(',').map((c) => c.trim()) : t.columns.slice(0, values.length);
    t.lines.push(t.columns.map((c) => values[cols.indexOf(c)] ?? ''));
    return 'INSERT 0 1';
  }
  const update = /^update\s+(\w+)\s+set\s+(\w+)\s*=\s*('[^']*'|\d+)(?:\s+where\s+(\w+)\s*=\s*('[^']*'|\d+))?$/i.exec(r);
  if (update) {
    const name = update[1].toLowerCase();
    const t = pg.bases[base].tables[name];
    if (!t) return game.error(`ERROR:  relation "${update[1]}" does not exist`);
    if (!allowed(game, base, name, 'UPDATE')) return game.error(`ERROR:  permission denied for table ${name}`);
    const i = t.columns.indexOf(update[2]);
    if (i < 0) return game.error(`ERROR:  column "${update[2]}" of relation "${name}" does not exist`);
    const w = update[4] ? t.columns.indexOf(update[4]) : -1;
    const rows = t.lines.filter((l) => w < 0 || l[w] === unquote(update[5]));
    for (const l of rows) l[i] = unquote(update[3]);
    return `UPDATE ${rows.length}`;
  }
  return null;
}
