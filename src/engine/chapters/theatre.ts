// What the chapters of "The Theatre" share: a neighbourhood theatre and its
// server, theatre. Its ticket office (boxoffice, Node.js, on 127.0.0.1:3000)
// keeps the shows, seats and bookings in PostgreSQL 16 (database boxoffice,
// role boxoffice). Camille runs the theatre and the website. The server is
// modelled by ../pg-server.ts: settings read from postgresql.conf (and
// postgresql.auto.conf), sessions, the connection limit, indexes.
// Simplifications: the app's code is not modelled; its connections and its
// response times are computed by the chapter.
// Sources: https://www.postgresql.org/docs/16/runtime-config-connection.html,
// https://www.postgresql.org/docs/16/monitoring-stats.html

import { accountsFiles, d, f, type Accounts, type Directory, type Rights } from '../world';
import type { Translate } from '../../texts';
import type { Game } from '../shell';
import type { Process } from '../commands/system';
import { newSystemd, systemd, type DefinitionService } from '../systemd';
import { applySettings, AUTO_CONF, CONF, enforceTimeouts, LOG, readSettings, type Backend, type PgServer } from '../pg-server';
import type { PostgresState, Table } from '../postgres';
import { loadOverrides } from '../commands/systemd';
import type { Shell } from '../shell';

export const HOME = '/home/you';
export const PASSWORD = 'curtain-2028';
export const APP = 914;
export const PG = 702;

export const accounts = (): Accounts => ({
  users: {
    root: { uid: 0, group: 'root', home: '/root' },
    postgres: { uid: 105, group: 'postgres', home: '/var/lib/postgresql', shell: '/bin/bash' },
    boxoffice: { uid: 998, group: 'boxoffice', home: '/srv/boxoffice', shell: '/usr/sbin/nologin' },
    'ticket-stats': { uid: 997, group: 'ticket-stats', home: '/var/lib/ticket-stats', shell: '/usr/sbin/nologin' },
    you: { uid: 1000, group: 'you' },
    camille: { uid: 1001, group: 'camille' },
  },
  groups: {
    root: { gid: 0, members: [] },
    adm: { gid: 4, members: ['you', 'camille'] },
    sudo: { gid: 27, members: ['you', 'camille'] },
    postgres: { gid: 105, members: [] },
    boxoffice: { gid: 998, members: [] },
    'ticket-stats': { gid: 997, members: [] },
    you: { gid: 1000, members: [] },
    camille: { gid: 1001, members: [] },
  },
});

export const proc = (pid: number, user: string, command: string, more: Partial<Process> = {}): Process => ({ pid, user, cpu: 0, mem: 0.1, command, ...more });
export const sd = (j: Game) => systemd(j)!;
export const seen = (j: Game, text: string) => j.last.output.includes(text) || j.last.errors.some((e) => e.includes(text));
export const running = (j: Game, n: string) => sd(j).services[n]?.state === 'active';
export const srv = (j: Game) => (j.state.postgres as PostgresState).server as PgServer;

/** Debian's postgresql.conf, reduced to what matters here, with this theatre's values. */
export const pgConf = (o: { maxConnections: number; idleTimeout?: string; logSlow?: boolean }) => `# PostgreSQL configuration file (Debian: /etc/postgresql/16/main/postgresql.conf)
# After a change: "systemctl reload postgresql" for most settings,
# "systemctl restart postgresql" for those marked (change requires restart).

#------------------------------------------------------------------------------
# CONNECTIONS AND AUTHENTICATION
#------------------------------------------------------------------------------

listen_addresses = 'localhost'		# (change requires restart)
port = 5432				# (change requires restart)
max_connections = ${o.maxConnections}			# (change requires restart)
						# lowered from 100 when we moved to the small VPS
#superuser_reserved_connections = 3	# (change requires restart)

#------------------------------------------------------------------------------
# RESOURCE USAGE
#------------------------------------------------------------------------------

shared_buffers = 128MB			# (change requires restart)
#work_mem = 4MB

#------------------------------------------------------------------------------
# REPORTING AND LOGGING
#------------------------------------------------------------------------------

${o.logSlow ? 'log_min_duration_statement = 1000	# log statements slower than 1 s' : '#log_min_duration_statement = -1	# -1 is disabled'}

#------------------------------------------------------------------------------
# CLIENT CONNECTION DEFAULTS
#------------------------------------------------------------------------------

#statement_timeout = 0			# in milliseconds, 0 is disabled
${o.idleTimeout ? `idle_in_transaction_session_timeout = '${o.idleTimeout}'` : '#idle_in_transaction_session_timeout = 0	# in milliseconds, 0 is disabled'}
`;

export const APP_UNIT = (t: Translate) => `[Unit]
Description=${t('theatre-boxoffice-description')}
After=postgresql.service
Requires=postgresql.service

[Service]
User=boxoffice
WorkingDirectory=/srv/boxoffice
EnvironmentFile=/srv/boxoffice/.env
ExecStart=/usr/bin/node server.js
Restart=on-failure

[Install]
WantedBy=multi-user.target`;

export interface Options {
  boot: number;
  now: number;
  tables: Record<string, Table>;
  backends: Backend[];
  sizes?: Record<string, number>;
  indexes?: PgServer['indexes'];
}

/** The machine's services and PostgreSQL; the settings are read from the world when the chapter starts. */
export function theatreState(t: Translate, o: Options) {
  const services: Record<string, DefinitionService> = {
    ssh: { description: 'OpenBSD Secure Shell server', active: true, executable: 'sshd', process: [proc(612, 'root', 'sshd: /usr/sbin/sshd -D [listener] 0 of 10-100 startups')] },
    postgresql: {
      description: 'PostgreSQL RDBMS',
      active: true,
      executable: 'postgres',
      process: [proc(PG, 'postgres', '/usr/lib/postgresql/16/bin/postgres -D /var/lib/postgresql/16/main -c config_file=/etc/postgresql/16/main/postgresql.conf', { mem: 3.1 })],
    },
    boxoffice: {
      description: t('theatre-boxoffice-description'),
      active: true,
      executable: 'node',
      file: '/etc/systemd/system/boxoffice.service',
      modelled: true,
      process: [proc(APP, 'boxoffice', '/usr/bin/node server.js', { mem: 2.6 })],
    },
  };
  const s = newSystemd('theatre', o.boot, o.now, services);
  return {
    systemd: s,
    process: [proc(1, 'root', '/sbin/init'), ...Object.values(services).flatMap((x) => x.process ?? [])],
    postgres: {
      bases: { boxoffice: { owner: 'boxoffice', tables: o.tables }, postgres: { owner: 'postgres', tables: {} } },
      roles: ['postgres', 'boxoffice'],
      archives: {},
      server: { settings: {}, backends: o.backends, nextPid: 30_211, indexes: o.indexes ?? [], sizes: o.sizes } as PgServer,
    },
  };
}

/** At the start: the settings in force are those of the files; PostgreSQL rereads them on reload, all of them on restart. */
export function preparePostgres(j: Game) {
  // The unit files and their drop-ins, as systemd read them at boot.
  loadOverrides(j as Shell, sd(j));
  const s = srv(j);
  s.settings = readSettings(j);
  const pg = sd(j).services.postgresql;
  pg.load = (game: Game) => {
    applySettings(game, game.state.pgRestarting === true);
    game.state.pgRestarting = false;
  };
  pg.stop = (game: Game) => {
    game.state.pgRestarting = true;
  };
}

/** Each command, half a minute: the server ends the sessions past their timeout. */
export function passTime(j: Game) {
  sd(j).clock += 30_000;
  enforceTimeouts(j);
}

/** The theatre's machine: PostgreSQL's files, the app, its unit, the welcome message. */
export function theatreWorld(t: Translate, o: { welcome: Record<string, string>; conf: string; log: string; app: Record<string, string> }): Directory {
  const root: Rights = { owner: 'root' };
  const directory = (children: Parameters<typeof d>[0], rights: Rights = root) => d(children, undefined, rights);
  const file = (text: string, rights: Rights = root) => f(text, { lines: true, ...rights });
  const pgOwn: Rights = { owner: 'postgres', group: 'postgres' };
  return directory({
    etc: directory({
      ...accountsFiles(),
      hostname: file('theatre'),
      postgresql: directory({ '16': directory({ main: directory({ 'postgresql.conf': file(o.conf, { ...pgOwn, mode: 'rw-r--r--' }) }, pgOwn) }, pgOwn) }, pgOwn),
      systemd: directory({ system: directory({ 'boxoffice.service': file(APP_UNIT(t)) }) }),
    }),
    var: directory({
      lib: directory({ postgresql: directory({ '16': directory({ main: directory({ 'postgresql.auto.conf': file('# Do not edit this file manually!\n# It will be overwritten by the ALTER SYSTEM command.', { ...pgOwn, mode: 'rw-------' }) }, { ...pgOwn, mode: 'rwx------' }) }, pgOwn) }, pgOwn) }),
      log: directory({ postgresql: directory({ 'postgresql-16-main.log': file(o.log, { owner: 'postgres', group: 'adm', mode: 'rw-r-----' }) }, { owner: 'root', group: 'postgres', mode: 'rwxrwxr-t' }) }),
    }),
    home: directory({
      you: d(Object.fromEntries(Object.entries(o.welcome).map(([n, x]) => [n, f(x)]))),
      camille: directory({}, { owner: 'camille', mode: 'rwx------' }),
    }),
    srv: directory({ boxoffice: directory(Object.fromEntries(Object.entries(o.app).map(([n, x]) => [n, file(x, { owner: 'boxoffice' })])), { owner: 'boxoffice', group: 'boxoffice' }) }),
    root: directory({}, { owner: 'root', mode: 'rwx------' }),
    tmp: directory({}, { owner: 'root', mode: 'rwxrwxrwt' }),
  });
}

export { CONF, AUTO_CONF, LOG };
