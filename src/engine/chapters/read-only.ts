// Story "The Theatre", chapter 3 — "Read Only": Inès, a volunteer, makes the
// theatre's statistics with a small tool (ticket-stats, a weekly report)
// that connects with the app's own account, boxoffice: the tables' owner.
// Last week, exploring with the same account, she renamed every show by
// mistake (Camille restored the backup). Camille asks for an account that
// can read everything and change nothing, for the tool and for Inès.
// Halfway through, Camille's migration creates a new table (donations), as
// boxoffice: the new role must be able to read it too, and the next ones.
// Commands: psql: \du, \dp, CREATE ROLE … LOGIN PASSWORD, GRANT SELECT ON
// ALL TABLES IN SCHEMA public, ALTER DEFAULT PRIVILEGES FOR ROLE boxoffice,
// SET ROLE to try; the tool's configuration and its restart.
// Objective checked on the state: a role that can log in, isn't a superuser
// nor a member of boxoffice, can SELECT every table (donations included)
// and nothing else, with default privileges for boxoffice's future tables,
// and the tool running with it.
// Sources: https://www.postgresql.org/docs/16/ddl-priv.html,
// https://www.postgresql.org/docs/16/sql-grant.html,
// https://www.postgresql.org/docs/16/sql-alterdefaultprivileges.html

import type { Chapter } from '../world';
import type { Game } from '../shell';
import { writeLog, type DefinitionService } from '../systemd';
import { postgres } from '../postgres';
import { allowed, isSuperuser, rolesOf, tableCreated, type Acl } from '../pg-roles';
import { HOME, PASSWORD, accounts, passTime, pgConf, preparePostgres, proc, running, sd, seen, srv, theatreState, theatreWorld } from './theatre';
import { tables as baseTables } from './too-many-clients';

const BOOT = Date.UTC(2028, 1, 20, 6, 3, 0);
const NOW = Date.UTC(2028, 2, 13, 9, 40, 0);
export const CONFIG = '/etc/ticket-stats/config.env';
const STATS = 1260;
const APP_PASSWORD = 'Kh7-pR2v-boxoffice';
const WRITES = ['INSERT', 'UPDATE', 'DELETE', 'TRUNCATE'] as const;

const acl = (j: Game) => srv(j).acl as Acl;
const tablesOf = (j: Game) => Object.keys(postgres(j)!.bases.boxoffice.tables);
/** The role and password the tool's configuration names. */
export function configured(j: Game): { role: string; password: string } | null {
  const m = /^DATABASE_URL=postgres(?:ql)?:\/\/(\w+):([^@\s]*)@[\w.-]+(?::\d+)?\/boxoffice\s*$/m.exec(j.read(CONFIG) ?? '');
  return m ? { role: m[1], password: m[2] } : null;
}
/** A role fit for reading: logs in, not a superuser, not a member of boxoffice, reads everything, writes nothing. */
export function readOnly(j: Game, role: string): boolean {
  const a = acl(j);
  if (!a.roles[role]?.login || isSuperuser(a, role) || rolesOf(a, role).includes('boxoffice')) return false;
  return tablesOf(j).every((t) => allowed(j, 'boxoffice', t, 'SELECT', role) && WRITES.every((w) => !allowed(j, 'boxoffice', t, w, role)));
}
/** The candidate role: a login role other than postgres and boxoffice that can read the shows. */
const candidate = (j: Game) => Object.keys(acl(j).roles).find((r) => !['postgres', 'boxoffice'].includes(r) && acl(j).roles[r].login && allowed(j, 'boxoffice', 'shows', 'SELECT', r));
const defaults = (j: Game, role: string) => acl(j).defaults.some((d) => d.creator === 'boxoffice' && d.grantee === role && d.privileges.includes('SELECT'));
const migrated = (j: Game) => !!postgres(j)!.bases.boxoffice.tables.donations;

/** The tool starts: it logs in with its configuration and reads every table for its report. */
function checkStats(j: Game): string[] | null {
  const c = configured(j);
  const pg = postgres(j)!;
  if (!c) return ['Error: DATABASE_URL is missing or invalid in /etc/ticket-stats/config.env'];
  const fatal = (m: string) => [`psycopg.OperationalError: connection failed: FATAL:  ${m}`];
  if (!pg.roles.includes(c.role)) return fatal(`password authentication failed for user "${c.role}"`);
  if (!acl(j).roles[c.role]?.login) return fatal(`role "${c.role}" is not permitted to log in`);
  if ((pg.passwords?.[c.role] ?? '') !== c.password) return fatal(`password authentication failed for user "${c.role}"`);
  const refused = tablesOf(j).find((t) => !allowed(j, 'boxoffice', t, 'SELECT', c.role));
  if (refused) return [`psycopg.errors.InsufficientPrivilege: permission denied for table ${refused}`];
  return null;
}

export const readOnlyChapter: Chapter = {
  id: 'read-only',
  number: 3,
  commands: [
    'ls', 'cd', 'pwd', 'cat', 'less', 'head', 'tail', 'grep', 'nano', 'sudo', 'id', 'whoami', 'ps',
    'systemctl', 'journalctl', 'psql',
  ],
  home: HOME,
  welcome: 'message_from_camille.txt',
  names: true,
  final: 'end',
  steps: ['account', 'role', 'end'],
  password: PASSWORD,
  accounts,
  state: (t) => {
    const base = baseTables(t);
    const stats: DefinitionService = {
      description: t('read-only-stats-description'),
      active: true,
      executable: 'python3',
      file: '/etc/systemd/system/ticket-stats.service',
      modelled: true,
      process: [proc(STATS, 'ticket-stats', '/usr/bin/python3 /opt/ticket-stats/report.py --serve')],
      check: checkStats,
    };
    const s = theatreState(t, {
      boot: BOOT,
      now: NOW,
      tables: { shows: base.shows, seats: base.seats, bookings: { columns: ['id', 'show_id', 'seat', 'status'], lines: base.seats.lines.map((l) => [String(Number(l[0]) + 900_000), l[1], l[2], l[3]]) } },
      backends: [],
    });
    s.systemd.services['ticket-stats'] = { ...stats, state: 'active', process: stats.process!, since: s.systemd.clock };
    s.process.push(...stats.process!);
    s.postgres.server.acl = {
      roles: { postgres: { login: true, superuser: true, memberOf: [] }, boxoffice: { login: true, superuser: false, memberOf: [] } },
      grants: {},
      owners: {},
      defaults: [],
    };
    (s.postgres as { passwords?: Record<string, string> }).passwords = { boxoffice: APP_PASSWORD };
    return s;
  },
  initialise: (j) => {
    preparePostgres(j);
    const s = sd(j);
    const now = s.clock;
    s.clock = Date.UTC(2028, 2, 6, 21, 14, 0);
    writeLog(s, 'postgresql.service', 'postgres', 30_877, "LOG:  statement: UPDATE shows SET title = 'test'", 6);
    s.clock = now;
  },
  afterCommand: passTime,
  createWorld: (t) => {
    const world = theatreWorld(t, {
      welcome: { 'message_from_camille.txt': t('read-only-message-camille') },
      conf: pgConf({ maxConnections: 20, idleTimeout: '1min', logSlow: true }),
      log: '',
      app: { '.env': `PORT=3000\nDATABASE_URL=postgres://boxoffice:${APP_PASSWORD}@localhost/boxoffice\nPG_POOL_MAX=10`, 'server.js': t('theatre-server-js') },
    });
    const etc = world.children.etc as import('../world').Directory;
    etc.children['ticket-stats'] = {
      type: 'directory',
      children: {
        'config.env': { type: 'file', content: `# ticket-stats: the weekly report of ticket sales\nDATABASE_URL=postgres://boxoffice:${APP_PASSWORD}@localhost/boxoffice\nREPORT_DIR=/var/lib/ticket-stats`, owner: 'root', group: 'adm', mode: 'rw-r-----', lines: true },
      },
      owner: 'root',
    };
    ((etc.children.systemd as import('../world').Directory).children.system as import('../world').Directory).children['ticket-stats.service'] = {
      type: 'file',
      content: `[Unit]\nDescription=${t('read-only-stats-description')}\nAfter=postgresql.service\n\n[Service]\nUser=ticket-stats\nEnvironmentFile=${CONFIG}\nExecStart=/usr/bin/python3 /opt/ticket-stats/report.py --serve\n\n[Install]\nWantedBy=multi-user.target`,
      owner: 'root',
      lines: true,
    };
    return world;
  },
  events: [
    {
      id: 'account',
      condition: (j) => seen(j, 'postgres://boxoffice:'),
      message: (j) => j.t('read-only-event-account'),
    },
    {
      id: 'role',
      condition: (j) => candidate(j) !== undefined,
      message: (j) => j.t('read-only-event-role'),
    },
    {
      id: 'too-much',
      condition: (j) => {
        const r = candidate(j);
        return !!r && tablesOf(j).some((t) => WRITES.some((w) => allowed(j, 'boxoffice', t, w, r)));
      },
      message: (j) => j.t('read-only-event-too-much'),
    },
    {
      id: 'superuser',
      condition: (j) => Object.keys(acl(j).roles).some((r) => !['postgres'].includes(r) && acl(j).roles[r].superuser),
      message: (j) => j.t('read-only-event-superuser'),
    },
    {
      id: 'member',
      condition: (j) => Object.entries(acl(j).roles).some(([r, x]) => r !== 'boxoffice' && x.memberOf.includes('boxoffice')),
      message: (j) => j.t('read-only-event-member'),
    },
    {
      // Camille's migration, once a reading role exists: a new table, created by boxoffice.
      id: 'migration',
      condition: (j) => {
        const r = candidate(j);
        return !!r && ['shows', 'seats', 'bookings'].every((t) => allowed(j, 'boxoffice', t, 'SELECT', r));
      },
      action: (j) => {
        postgres(j)!.bases.boxoffice.tables.donations = { columns: ['id', 'show_id', 'amount'], lines: [['1', '42', '20'], ['2', '42', '50'], ['3', '43', '10']] };
        tableCreated(j, 'donations', 'boxoffice');
        writeLog(sd(j), 'boxoffice.service', 'node', 914, 'migration 0012_donations: CREATE TABLE donations', 6);
      },
      message: (j) => j.t('read-only-event-migration'),
    },
    {
      id: 'donations-denied',
      condition: (j) => migrated(j) && !!candidate(j) && !allowed(j, 'boxoffice', 'donations', 'SELECT', candidate(j)!),
      message: (j) => j.t('read-only-event-donations-denied'),
    },
    {
      id: 'wrong-creator',
      condition: (j) => acl(j).defaults.some((d) => d.creator !== 'boxoffice' && d.privileges.includes('SELECT')),
      message: (j) => j.t('read-only-event-wrong-creator'),
    },
    {
      id: 'no-defaults',
      condition: (j) => {
        const r = candidate(j);
        return migrated(j) && !!r && readOnly(j, r) && !defaults(j, r);
      },
      message: (j) => j.t('read-only-event-no-defaults'),
    },
    {
      id: 'tool',
      condition: (j) => {
        const r = candidate(j);
        return migrated(j) && !!r && readOnly(j, r) && defaults(j, r) && configured(j)?.role === 'boxoffice';
      },
      message: (j) => j.t('read-only-event-tool'),
    },
    {
      id: 'tool-failed',
      condition: (j) => sd(j).services['ticket-stats'].state === 'failed',
      message: (j) => j.t('read-only-event-tool-failed'),
    },
    {
      id: 'end',
      condition: (j) => {
        const c = configured(j);
        return migrated(j) && !!c && c.role !== 'boxoffice' && readOnly(j, c.role) && defaults(j, c.role) && running(j, 'ticket-stats') && sd(j).services['ticket-stats'].since > NOW && checkStats(j) === null;
      },
      message: (j) => j.t('read-only-event-end', { role: configured(j)!.role }),
    },
  ],
};

