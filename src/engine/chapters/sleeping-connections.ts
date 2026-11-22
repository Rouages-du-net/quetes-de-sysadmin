// Story "The Allotments", chapter "Sleeping Connections": on a spring
// Saturday morning, www.greenholme.example answers "Too many connections".
// Plotline, on shed, opens connections to MariaDB on trowel and never closes
// them; with wait_timeout at its default (28800 s, eight hours), the server
// keeps them all, asleep, until max_connections (151) is reached. Each plot
// page also runs a query on bookings (1.8 million rows) without an index:
// 38 seconds of full scan.
// The fix: wait_timeout brought down (SET GLOBAL, for new connections, and in
// 50-server.cnf, for the next start), the sleeping connections already there
// ended (KILL, mariadb-admin kill, or a restart once the file is right),
// the slow query found (slow query log, or SHOW PROCESSLIST) and explained
// (EXPLAIN: type ALL), an index on bookings(plot_id).
// Objective checked on the state: the global wait_timeout and the file's at
// most 900 s, no app connection left with a longer session timeout, an index
// whose first column is plot_id, max_connections at most 1000 (at runtime
// and in the file), the server running.
// False leads: a restart alone (the connections come back), max_connections
// raised to 10000, SET GLOBAL alone (the sleeping sessions keep their eight
// hours), an index on another column.
// Sources: https://mariadb.com/kb/en/server-system-variables/#wait_timeout,
// https://mariadb.com/kb/en/server-system-variables/#max_connections,
// https://mariadb.com/kb/en/slow-query-log-overview/,
// https://mariadb.com/kb/en/explain/, https://mariadb.com/kb/en/create-index/.

import type { Chapter } from '../world';
import { f } from '../world';
import type { Game } from '../shell';
import { fileValue, isOn, maria } from '../mariadb';
import { HOME, PASSWORD, initialiseStory, passTime, story, trowelAccounts, trowelState, trowelWorld, seen } from './allotments';

const srv = (j: Game) => maria(j);
const bookings = (j: Game) => srv(j).databases.plots?.tables.bookings;
const indexed = (j: Game) => !!bookings(j)?.indexes.some((i) => i.columns[0]?.toLowerCase() === 'plot_id');
const otherIndex = (j: Game) => !!bookings(j)?.indexes.some((i) => i.name !== 'PRIMARY' && i.columns[0]?.toLowerCase() !== 'plot_id');
const runtimeTimeout = (j: Game) => Number(srv(j).vars.wait_timeout) <= 900;
const fileTimeout = (j: Game) => Number(fileValue(j, 'wait_timeout') ?? 28800) <= 900;
const oldSessions = (j: Game) => srv(j).conns.filter((c) => c.kind === 'app' && c.timeout > 900).length;
const maxTooBig = (j: Game) => Number(srv(j).vars.max_connections) > 1000 || Number(fileValue(j, 'max_connections') ?? 151) > 1000;
const running = (j: Game) => srv(j).running;
const looked = (j: Game, what: string) => srv(j).looked?.[what] ?? 0;
const cleared = (j: Game) => running(j) && runtimeTimeout(j) && oldSessions(j) === 0;

export const sleepingConnections: Chapter = {
  id: 'sleeping-connections',
  number: 1,
  commands: ['ls', 'cd', 'pwd', 'cat', 'less', 'head', 'tail', 'grep', 'wc', 'sort', 'uniq', 'cut', 'nano', 'sudo', 'systemctl', 'journalctl', 'ss', 'xargs', 'mariadb', 'mysql', 'mariadb-admin', 'mysqladmin', 'exit'],
  home: HOME,
  welcome: 'message_from_halima.txt',
  names: true,
  final: 'end',
  steps: ['crowd', 'timeout', 'cleared', 'persisted', 'slow-log', 'explain', 'index', 'end'],
  password: PASSWORD,
  accounts: trowelAccounts,
  state: (t) => trowelState(t, 1),
  initialise: (j) => initialiseStory(j, 1),
  createWorld: (t) =>
    trowelWorld(t, 1, {
      'message_from_halima.txt': f(t('sleeping-connections-message-halima')),
      'note_from_lwazi.txt': f(t('sleeping-connections-note-lwazi')),
    }),
  afterCommand: (j) => passTime(j),
  events: [
    { id: 'crowd', condition: (j) => looked(j, 'processlist') > 0, message: (j) => j.t('sleeping-connections-event-crowd') },
    { id: 'too-big', condition: maxTooBig, message: (j) => j.t('sleeping-connections-event-too-big') },
    { id: 'restart-only', condition: (j) => srv(j).restarts > 0 && running(j) && !fileTimeout(j), message: (j) => j.t('sleeping-connections-event-restart-only') },
    { id: 'timeout', condition: runtimeTimeout, message: (j) => j.t('sleeping-connections-event-timeout') },
    {
      id: 'old-sessions',
      condition: (j) => runtimeTimeout(j) && oldSessions(j) > 0 && looked(j, 'processlist') > (story(j).timeoutSetAt ?? Infinity),
      message: (j) => j.t('sleeping-connections-event-old-sessions', { count: oldSessions(j) }),
    },
    { id: 'cleared', condition: cleared, message: (j) => j.t('sleeping-connections-event-cleared') },
    { id: 'persisted', condition: fileTimeout, message: (j) => j.t('sleeping-connections-event-persisted') },
    { id: 'slow-log', condition: (j) => isOn(srv(j).vars.slow_query_log) || seen(j, 'Rows_examined: 1834212'), message: (j) => j.t('sleeping-connections-event-slow-log') },
    { id: 'explain', condition: (j) => looked(j, 'explain:bookings') > 0, message: (j) => j.t('sleeping-connections-event-explain') },
    { id: 'wrong-index', condition: (j) => otherIndex(j) && !indexed(j), message: (j) => j.t('sleeping-connections-event-wrong-index') },
    { id: 'index', condition: indexed, message: (j) => j.t('sleeping-connections-event-index') },
    {
      id: 'end',
      condition: (j) => indexed(j) && cleared(j) && fileTimeout(j) && !maxTooBig(j),
      message: (j) => j.t('sleeping-connections-event-end'),
    },
  ],
};

