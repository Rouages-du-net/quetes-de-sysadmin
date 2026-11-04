// Story "The Theatre", chapter 4 — "The Failover": since last month, the
// database's primary runs on a second server (stage.internal), and theatre
// keeps a hot standby, a streaming replica, next to the app. This morning
// the host lost stage (a dead disk, not coming back before tomorrow). The
// app points at stage: every page fails. The standby holds the data up to
// the last second, but it is read-only, in recovery.
// Commands: journalctl, pg_lsclusters (online,recovery), pg_isready -h,
// the server's log (could not connect to the primary), psql:
// pg_is_in_recovery(), pg_last_xact_replay_timestamp(), pg_stat_wal_receiver;
// then promotion (pg_ctlcluster 16 main promote, or SELECT pg_promote()),
// the app's .env pointed at localhost, and its restart.
// Objective checked on the state: the local server out of recovery, the app
// restarted with a DATABASE_URL on this machine, and the ticket office
// answering. Traps: restarting PostgreSQL (still a standby: standby.signal),
// pointing the app at the standby before promoting it (read-only), the .env
// changed without restarting the app. Other accepted solution: removing
// standby.signal and restarting PostgreSQL.
// Sources: https://www.postgresql.org/docs/16/warm-standby-failover.html,
// https://www.postgresql.org/docs/16/functions-admin.html#FUNCTIONS-RECOVERY-CONTROL,
// https://www.postgresql.org/docs/16/monitoring-stats.html#MONITORING-PG-STAT-WAL-RECEIVER-VIEW

import type { Chapter, Directory } from '../world';
import { f } from '../world';
import type { Game } from '../shell';
import { writeLog } from '../systemd';
import { pgLog, server } from '../pg-server';
import { APP, HOME, PASSWORD, accounts, passTime, pgConf, preparePostgres, running, sd, seen, srv, theatreState, theatreWorld } from './theatre';
import { tables as baseTables } from './too-many-clients';

const BOOT = Date.UTC(2028, 2, 20, 6, 3, 0);
const NOW = Date.UTC(2028, 3, 2, 8, 31, 0);
// stage died at 06:47:15; the standby had replayed everything up to 06:47:14.
const FAILED = Date.UTC(2028, 3, 2, 6, 47, 15);
const REPLAYED = Date.UTC(2028, 3, 2, 6, 47, 14, 382);
export const ENV = '/srv/boxoffice/.env';
const PRIMARY = 'stage.internal';
const PRIMARY_ADDRESS = '192.0.2.29';

/** The host the app reads in its .env (now, on disk). */
export const envHost = (j: Game) => /^DATABASE_URL=postgres(?:ql)?:\/\/[^@\s]*@([\w.-]+)/m.exec(j.read(ENV) ?? '')?.[1] ?? '';
const isLocal = (host: string) => ['localhost', '127.0.0.1', '::1', 'theatre', 'theatre.internal'].includes(host);
const recovery = (j: Game) => !!server(j)?.recovery;
/** The host the app read when it last started. */
const appHost = (j: Game) => (j.state.appHost as string | undefined) ?? PRIMARY;

/** A visit: the app opens a session (a write) in the database it was started with. */
function visit(j: Game): { code: number; body: string } {
  const host = appHost(j);
  let error: string | null = null;
  if (!isLocal(host)) error = `Error: connect EHOSTUNREACH ${PRIMARY_ADDRESS}:5432`;
  else if (!running(j, 'postgresql')) error = 'Error: connect ECONNREFUSED 127.0.0.1:5432';
  else if (recovery(j)) error = 'error: cannot execute INSERT in a read-only transaction';
  if (error) {
    writeLog(sd(j), 'boxoffice.service', 'node', APP, error, 3);
    return { code: 500, body: j.t('theatre-error-page') };
  }
  return { code: 200, body: j.t('failover-page') };
}

export const failover: Chapter = {
  id: 'failover',
  number: 4,
  commands: [
    'ls', 'cd', 'pwd', 'cat', 'less', 'head', 'tail', 'grep', 'nano', 'sudo', 'id', 'whoami', 'ps', 'rm',
    'systemctl', 'journalctl', 'curl', 'psql', 'pg_lsclusters', 'pg_ctlcluster', 'pg_isready',
  ],
  home: HOME,
  welcome: 'message_from_camille.txt',
  names: true,
  final: 'end',
  steps: ['down', 'standby', 'end'],
  password: PASSWORD,
  accounts,
  state: (t) => {
    const base = baseTables(t);
    const s = theatreState(t, { boot: BOOT, now: NOW, tables: { shows: base.shows, seats: base.seats }, backends: [] });
    s.postgres.server.recovery = true;
    s.postgres.server.standby = { primary: PRIMARY, address: PRIMARY_ADDRESS, reachable: false, replayed: REPLAYED, timeline: 1 };
    return { ...s, apps: { '127.0.0.1:3000': { service: 'boxoffice', pages: {}, answer: (j: Game) => visit(j) } } };
  },
  initialise: (j) => {
    preparePostgres(j);
    // The app reads its .env when it starts.
    const app = sd(j).services.boxoffice;
    app.load = (game: Game) => {
      game.state.appHost = envHost(game);
    };
    j.state.appHost = PRIMARY;
    const s = sd(j);
    const now = s.clock;
    for (const [time, line] of [
      [FAILED + 2_000, `Error: Connection terminated unexpectedly`],
      [FAILED + 64_000, `Error: connect EHOSTUNREACH ${PRIMARY_ADDRESS}:5432`],
      [NOW - 120_000, `Error: connect EHOSTUNREACH ${PRIMARY_ADDRESS}:5432`],
    ] as [number, string][]) {
      s.clock = time;
      writeLog(s, 'boxoffice.service', 'node', APP, line, 3);
    }
    for (const time of [FAILED + 5_000, NOW - 300_000, NOW - 5_000]) {
      s.clock = time;
      pgLog(j, 30_011, 'FATAL', `could not connect to the primary server: connection to server at "${PRIMARY}" (${PRIMARY_ADDRESS}), port 5432 failed: No route to host`);
      pgLog(j, 702, 'LOG', 'waiting for WAL to become available at 0/3A0001B8');
    }
    s.clock = now;
  },
  afterCommand: passTime,
  createWorld: (t) => {
    const world = theatreWorld(t, {
      welcome: { 'message_from_camille.txt': t('failover-message-camille') },
      conf: pgConf({ maxConnections: 20, idleTimeout: '1min', logSlow: true }),
      log: '',
      app: { '.env': `PORT=3000\nDATABASE_URL=postgres://boxoffice:Kh7-pR2v-boxoffice@${PRIMARY}/boxoffice\nPG_POOL_MAX=10`, 'server.js': t('theatre-server-js') },
    });
    const main = ((((world.children.var as Directory).children.lib as Directory).children.postgresql as Directory).children['16'] as Directory).children.main as Directory;
    main.children['standby.signal'] = f('', { owner: 'postgres', mode: 'rw-------' });
    main.children['postgresql.auto.conf'] = f(
      `# Do not edit this file manually!\n# It will be overwritten by the ALTER SYSTEM command.\nprimary_conninfo = 'host=${PRIMARY} port=5432 user=replicator application_name=theatre'\nprimary_slot_name = 'theatre'`,
      { lines: true, owner: 'postgres', mode: 'rw-------' },
    );
    return world;
  },
  events: [
    {
      id: 'down',
      condition: (j) => seen(j, 'EHOSTUNREACH') || seen(j, `${PRIMARY}:5432 - no response`) || seen(j, 'No route to host'),
      message: (j) => j.t('failover-event-down'),
    },
    {
      id: 'standby',
      condition: (j) => seen(j, 'online,recovery') || (seen(j, 'pg_is_in_recovery') && recovery(j)),
      message: (j) => j.t('failover-event-standby'),
    },
    {
      id: 'lag',
      condition: (j) => seen(j, '2028-04-02 06:47:14'),
      message: (j) => j.t('failover-event-lag'),
    },
    {
      id: 'restarted-standby',
      condition: (j) => recovery(j) && j.state.pgRestarting === false && /restart/.test(j.last.line) && /postgres/.test(j.last.line),
      message: (j) => j.t('failover-event-restarted-standby'),
    },
    {
      id: 'read-only',
      condition: (j) => isLocal(appHost(j)) && recovery(j) && running(j, 'boxoffice'),
      message: (j) => j.t('failover-event-read-only'),
    },
    {
      id: 'promoted',
      condition: (j) => !recovery(j) && running(j, 'postgresql'),
      message: (j) => j.t('failover-event-promoted'),
    },
    {
      id: 'restart-app',
      condition: (j) => isLocal(envHost(j)) && !isLocal(appHost(j)),
      message: (j) => j.t('failover-event-restart-app'),
    },
    {
      id: 'end',
      condition: (j) => !recovery(j) && running(j, 'postgresql') && running(j, 'boxoffice') && isLocal(appHost(j)),
      message: (j) => j.t('failover-event-end'),
    },
  ],
};

export { srv };
