// Story "The Theatre", chapter 1 — "Opening Night": ticket sales for the
// season's opening night started at 10 am; since then the ticket office
// answers 500. PostgreSQL refuses new connections: max_connections = 20 (3
// kept for superusers), and the app holds all the others. Most of its
// sessions are "idle in transaction": when a visitor picks a seat, the app
// opens a transaction (SELECT … FOR UPDATE) and keeps it open until the
// payment, which many never finish. Each new visitor leaks one more.
// Commands: journalctl -u boxoffice, the server's log, sudo -u postgres psql
// (the superuser keeps reserved slots): pg_stat_activity, SHOW,
// pg_terminate_backend, ALTER SYSTEM or postgresql.conf, reload.
// Objective checked on the state: idle_in_transaction_session_timeout in
// force (between 1 s and 5 min), PostgreSQL running, and the ticket office
// can connect again. Traps: pg_terminate_backend alone (they come back),
// max_connections raised (needs a restart, and fills up again), the file
// changed without a reload.
// Sources: https://www.postgresql.org/docs/16/runtime-config-client.html#GUC-IDLE-IN-TRANSACTION-SESSION-TIMEOUT,
// https://www.postgresql.org/docs/16/monitoring-stats.html#MONITORING-PG-STAT-ACTIVITY-VIEW,
// https://www.postgresql.org/docs/16/functions-admin.html#FUNCTIONS-ADMIN-SIGNAL

import type { Chapter } from '../world';
import type { Translate } from '../../texts';
import type { Game } from '../shell';
import { writeLog } from '../systemd';
import { connect, freeSlots, readDuration, readSettings, setting, type Backend } from '../pg-server';
import { APP, HOME, PASSWORD, accounts, passTime, pgConf, preparePostgres, running, sd, seen, theatreState, theatreWorld } from './theatre';

const BOOT = Date.UTC(2028, 1, 20, 6, 3, 0);
const NOW = Date.UTC(2028, 1, 21, 10, 7, 0);
const HOLD = "SELECT seat FROM seats WHERE show_id = 42 AND status = 'free' FOR UPDATE";
const leak = (pid: number, since: number): Backend => ({
  pid, usename: 'boxoffice', datname: 'boxoffice', application_name: 'boxoffice', client_addr: '127.0.0.1', state: 'idle in transaction', since, query: HOLD,
});

const timeout = (j: Game) => readDuration(setting(j, 'idle_in_transaction_session_timeout')) ?? 0;
const timeoutSet = (j: Game) => timeout(j) > 0 && timeout(j) <= 300_000;
// The site works when the app can open one more connection.
const works = (j: Game) => running(j, 'postgresql') && freeSlots(j) > 0;

/** A visit to the ticket office: it needs a connection; if it gets one, it holds it (the leak). */
function visit(j: Game): { code: number; body: string } {
  if (!running(j, 'postgresql') || !connect(j, { usename: 'boxoffice', datname: 'boxoffice', application_name: 'boxoffice', client_addr: '127.0.0.1', state: 'idle in transaction', query: HOLD })) {
    const message = !running(j, 'postgresql')
      ? 'Error: connect ECONNREFUSED 127.0.0.1:5432'
      : 'error: remaining connection slots are reserved for roles with the SUPERUSER attribute';
    writeLog(sd(j), 'boxoffice.service', 'node', APP, message, 3);
    return { code: 500, body: j.t('theatre-error-page') };
  }
  return { code: 200, body: j.t('too-many-clients-page') };
}

export const tooManyClients: Chapter = {
  id: 'too-many-clients',
  number: 1,
  commands: [
    'ls', 'cd', 'pwd', 'cat', 'less', 'head', 'tail', 'grep', 'nano', 'sudo', 'id', 'whoami', 'ps', 'wc',
    'systemctl', 'journalctl', 'curl', 'psql',
  ],
  home: HOME,
  welcome: 'message_from_camille.txt',
  names: true,
  final: 'end',
  steps: ['full', 'idle', 'end'],
  password: PASSWORD,
  accounts,
  state: (t) => {
    // Two requests at work, and fifteen seats held since this morning.
    const backends: Backend[] = [
      { pid: 30_102, usename: 'boxoffice', datname: 'boxoffice', application_name: 'boxoffice', client_addr: '127.0.0.1', state: 'active', since: NOW - 2_000, query: 'SELECT id, title, starts_at FROM shows ORDER BY starts_at' },
      { pid: 30_118, usename: 'boxoffice', datname: 'boxoffice', application_name: 'boxoffice', client_addr: '127.0.0.1', state: 'idle', since: NOW - 9_000, query: 'COMMIT' },
      ...Array.from({ length: 15 }, (_, i) => leak(30_140 + i * 3, Date.UTC(2028, 1, 21, 10, 0, 12) + i * 23_000)),
    ];
    return {
      ...theatreState(t, { boot: BOOT, now: NOW, tables: tables(t), backends }),
      apps: { '127.0.0.1:3000': { service: 'boxoffice', pages: {}, answer: (j: Game) => visit(j) } },
    };
  },
  initialise: (j) => {
    preparePostgres(j);
    const s = sd(j);
    const now = s.clock;
    for (const [time, message] of [
      [Date.UTC(2028, 1, 21, 10, 0, 0), 'boxoffice 3.2.1: sales open for "The Lighthouse Keeper" (opening night, show 42)'],
      [Date.UTC(2028, 1, 21, 10, 5, 47), 'error: remaining connection slots are reserved for roles with the SUPERUSER attribute'],
      [Date.UTC(2028, 1, 21, 10, 6, 31), 'error: remaining connection slots are reserved for roles with the SUPERUSER attribute'],
    ] as [number, string][]) {
      s.clock = time;
      writeLog(s, 'boxoffice.service', 'node', APP, message, message.startsWith('error') ? 3 : 6);
    }
    s.clock = now;
  },
  // Each command, half a minute: the server applies its timeout, and a visitor picks a seat (one more held, if there is room).
  afterCommand: (j) => {
    passTime(j);
    if (running(j, 'postgresql')) connect(j, leak(0, 0));
  },
  createWorld: (t) =>
    theatreWorld(t, {
      welcome: { 'message_from_camille.txt': t('too-many-clients-message-camille') },
      conf: pgConf({ maxConnections: 20 }),
      log: [
        '2028-02-21 10:05:47.112 UTC [30188] boxoffice@boxoffice FATAL:  remaining connection slots are reserved for roles with the SUPERUSER attribute',
        '2028-02-21 10:06:31.540 UTC [30191] boxoffice@boxoffice FATAL:  remaining connection slots are reserved for roles with the SUPERUSER attribute',
      ].join('\n'),
      app: { '.env': 'PORT=3000\nDATABASE_URL=postgres://boxoffice@localhost/boxoffice\nPG_POOL_MAX=40', 'server.js': t('theatre-server-js') },
    }),
  events: [
    {
      id: 'full',
      condition: (j) => seen(j, 'reserved for roles with the SUPERUSER attribute') || seen(j, 'too many clients'),
      message: (j) => j.t('too-many-clients-event-full'),
    },
    {
      id: 'idle',
      condition: (j) => seen(j, 'idle in transaction'),
      message: (j) => j.t('too-many-clients-event-idle'),
    },
    {
      id: 'terminated',
      condition: (j) => (j.state.pgTerminated ?? 0) > 0 && !timeoutSet(j),
      message: (j) => j.t('too-many-clients-event-terminated'),
    },
    {
      id: 'restart-needed',
      condition: (j) => readSettings(j).max_connections !== setting(j, 'max_connections'),
      message: (j) => j.t('too-many-clients-event-restart-needed'),
    },
    {
      id: 'more-room',
      condition: (j) => Number(setting(j, 'max_connections')) > 20 && !timeoutSet(j),
      message: (j) => j.t('too-many-clients-event-more-room'),
    },
    {
      id: 'reload-needed',
      condition: (j) => {
        const written = readDuration(readSettings(j).idle_in_transaction_session_timeout) ?? 0;
        return written > 0 && !timeoutSet(j);
      },
      message: (j) => j.t('too-many-clients-event-reload-needed'),
    },
    {
      id: 'too-long',
      condition: (j) => timeout(j) > 300_000,
      message: (j) => j.t('too-many-clients-event-too-long'),
    },
    {
      id: 'stopped',
      condition: (j) => !running(j, 'postgresql') || !running(j, 'boxoffice'),
      message: (j) => j.t('too-many-clients-event-stopped'),
    },
    {
      id: 'end',
      condition: (j) => timeoutSet(j) && works(j) && running(j, 'boxoffice'),
      message: (j) => j.t('too-many-clients-event-end'),
    },
  ],
};

/** The theatre's tables (a sample: the opening night's show and a few seats). */
export function tables(t: Translate) {
  return {
    shows: { columns: ['id', 'title', 'starts_at'], lines: [['41', t('theatre-show-41'), '2028-02-14 20:00'], ['42', t('theatre-show-42'), '2028-02-28 20:00'], ['43', t('theatre-show-43'), '2028-03-06 20:00']] },
    seats: {
      columns: ['id', 'show_id', 'seat', 'status'],
      lines: Array.from({ length: 12 }, (_, i) => [String(4201 + i), '42', `${'ABC'[Math.floor(i / 4)]}${(i % 4) + 1}`, i < 5 ? 'sold' : 'free']),
    },
  };
}
