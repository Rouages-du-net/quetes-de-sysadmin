// Story "The Theatre", chapter 2 — "The Slow Query": a week later, the
// seat map of each show takes five seconds. The bookings table holds every
// seat of every show since the theatre opened (480,000 rows), and the app
// asks for those of one show: without an index on show_id, PostgreSQL reads
// the whole table each time (a sequential scan, in parallel).
// Commands: the app's journal, the server's log (log_min_duration_statement),
// psql: \d bookings, EXPLAIN, EXPLAIN ANALYZE, CREATE INDEX, \di.
// Objective checked on the state: an index on bookings (show_id), and the
// seat map answers fast again. Traps: an index on another column (the plan
// doesn't change), VACUUM or ANALYZE alone, more memory (work_mem).
// Sources: https://www.postgresql.org/docs/16/using-explain.html,
// https://www.postgresql.org/docs/16/indexes-intro.html,
// https://www.postgresql.org/docs/16/sql-createindex.html

import type { Chapter } from '../world';
import type { Game } from '../shell';
import { writeLog } from '../systemd';
import { indexFor, pgLog, server } from '../pg-server';
import { APP, HOME, PASSWORD, accounts, passTime, pgConf, preparePostgres, running, sd, seen, srv, theatreState, theatreWorld } from './theatre';
import { tables as baseTables } from './too-many-clients';

const BOOT = Date.UTC(2028, 1, 20, 6, 3, 0);
const NOW = Date.UTC(2028, 1, 28, 14, 22, 0);
export const ROWS = 480_000;
export const QUERY = 'SELECT seat, status FROM bookings WHERE show_id = 42';
const indexed = (j: Game) => !!indexFor(j, 'bookings', 'show_id');
/** The seat map's time (s): the whole table read, or the index. */
export const seatMapTime = (j: Game) => (indexed(j) ? 0.012 : 4.812);

function seatMap(j: Game) {
  if (!running(j, 'postgresql')) return { code: 500, body: j.t('theatre-error-page') };
  if (!indexed(j)) {
    writeLog(sd(j), 'boxoffice.service', 'node', APP, `slow query (4812 ms): ${QUERY}`, 4);
    pgLog(j, 30_402, 'LOG', `duration: 4812.331 ms  statement: ${QUERY}`);
  }
  return { code: 200, body: j.t('slow-query-page') };
}

export const slowQuery: Chapter = {
  id: 'slow-query',
  number: 2,
  commands: [
    'ls', 'cd', 'pwd', 'cat', 'less', 'head', 'tail', 'grep', 'nano', 'sudo', 'id', 'whoami', 'ps', 'top', 'wc',
    'systemctl', 'journalctl', 'curl', 'psql',
  ],
  home: HOME,
  welcome: 'message_from_camille.txt',
  names: true,
  final: 'end',
  steps: ['slow', 'seqscan', 'end'],
  password: PASSWORD,
  accounts,
  state: (t) => {
    const base = baseTables(t);
    // A sample of the bookings: the 380 seats of show 42; the table holds 480,000.
    const bookings = {
      columns: ['id', 'show_id', 'seat', 'status'],
      lines: Array.from({ length: 380 }, (_, i) => [String(912_001 + i), '42', `${String.fromCharCode(65 + Math.floor(i / 20))}${(i % 20) + 1}`, i < 214 ? 'sold' : 'free']),
    };
    return {
      ...theatreState(t, { boot: BOOT, now: NOW, tables: { shows: base.shows, bookings }, backends: [], sizes: { bookings: ROWS } }),
      apps: {
        '127.0.0.1:3000': {
          service: 'boxoffice',
          pages: {},
          answer: (j: Game, path: string) => (/^\/shows\/42\/seats\/?$/.test(path) ? seatMap(j) : { code: 200, body: j.t('too-many-clients-page') }),
          time: (j: Game) => seatMapTime(j),
        },
      },
    };
  },
  initialise: (j) => {
    preparePostgres(j);
    const s = sd(j);
    const now = s.clock;
    for (const time of [Date.UTC(2028, 1, 28, 13, 58, 4), Date.UTC(2028, 1, 28, 14, 11, 40), Date.UTC(2028, 1, 28, 14, 20, 9)]) {
      s.clock = time;
      seatMap(j);
    }
    s.clock = now;
  },
  afterCommand: passTime,
  createWorld: (t) =>
    theatreWorld(t, {
      welcome: { 'message_from_camille.txt': t('slow-query-message-camille') },
      conf: pgConf({ maxConnections: 20, idleTimeout: '1min', logSlow: true }),
      log: '',
      app: { '.env': 'PORT=3000\nDATABASE_URL=postgres://boxoffice@localhost/boxoffice\nPG_POOL_MAX=10', 'server.js': t('theatre-server-js') },
    }),
  events: [
    {
      id: 'slow',
      condition: (j) => seen(j, 'slow query') || seen(j, 'duration: 4812'),
      message: (j) => j.t('slow-query-event-slow'),
    },
    {
      id: 'seqscan',
      condition: (j) => seen(j, 'Seq Scan on bookings'),
      message: (j) => j.t('slow-query-event-seqscan'),
    },
    {
      id: 'wrong-column',
      condition: (j) => (server(j)?.indexes ?? []).some((i) => i.table === 'bookings' && i.column !== 'show_id') && !indexed(j),
      message: (j) => j.t('slow-query-event-wrong-column'),
    },
    {
      id: 'vacuum',
      condition: (j) => /\b(vacuum|analyze)\b/i.test(j.last.line) && !/explain/i.test(j.last.line) && !indexed(j),
      message: (j) => j.t('slow-query-event-vacuum'),
    },
    {
      id: 'end',
      condition: (j) => indexed(j) && running(j, 'postgresql') && running(j, 'boxoffice'),
      message: (j) => j.t('slow-query-event-end', { index: indexFor(j, 'bookings', 'show_id')!.name }),
    },
  ],
};

export { srv };
