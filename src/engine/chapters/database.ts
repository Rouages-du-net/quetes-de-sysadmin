// Story "The Game Library" — chapter "The database": the game loans
// live in a PostgreSQL database. Malo "backs it up" by copying its
// files (/var/lib/postgresql) with rsnapshot, while it runs:
// nothing guarantees the copy is consistent. A real backup is needed
// (pg_dump), every night, and checking that it restores (into a test
// database, never over the real one). Then, early in the afternoon, a
// volunteer empties the loans table by mistake: we restore only that table.
// Objective checked on the state: a cron job runs the pg_dump of gamelib
// under a role allowed to do it, an archive exists, a test restore
// gave back the same row counts, and the loans table is back.
// The database, its role, its tables and columns take the names of the
// language (ludo, jeux, membres, prets… in French).
// Sources: https://www.postgresql.org/docs/16/backup-dump.html,
// https://www.postgresql.org/docs/16/backup-file.html,
// https://www.postgresql.org/docs/16/app-pgrestore.html

import { d, f, name, account, accountsFiles, type Chapter, type Accounts, type Rights } from '../world';
import type { Game } from '../shell';
import { newSystemd, systemd } from '../systemd';
import { postgres, type PostgresState, type Table } from '../postgres';

const M = '/home/you';
const BACKUPS = '/var/backups/postgresql';
const Go = 1_000_000_000;
const NUMBERS = { boardgames: 412, members: 230, loans: 1873 };
type T = Game['t'];
// The database (and its role) in the language.
const db = (t: T) => name(t, 'gamelib');

const accounts = (): Accounts => ({
  users: {
    root: { uid: 0, group: 'root', home: '/root' },
    postgres: { uid: 115, group: 'postgres', home: '/var/lib/postgresql', shell: '/bin/bash' },
    you: { uid: 1000, group: 'you' },
    frontdesk: { uid: 1001, group: 'frontdesk' },
    berenice: { uid: 1002, group: 'berenice' },
  },
  groups: {
    root: { gid: 0, members: [] },
    sudo: { gid: 27, members: ['you', 'berenice'] },
    postgres: { gid: 122, members: [] },
    you: { gid: 1000, members: [] },
    frontdesk: { gid: 1001, members: [] },
    berenice: { gid: 1002, members: [] },
    gamelib: { gid: 1100, members: ['you', 'frontdesk', 'berenice'] },
  },
});

// Deterministic data: games, members (by card number, no name) and their loans.
function tables(t: T): Record<string, Table> {
  const names = t('database-names-games').split(',');
  const neighbourhoods = t('database-districts').split(',');
  const day = (n: number) => new Date(Date.UTC(2025, 8, 1) + n * 86_400_000).toISOString().slice(0, 10);
  return {
    [name(t, 'boardgames')]: {
      columns: t('database-columns-boardgames').split(','),
      lines: Array.from({ length: NUMBERS.boardgames }, (_, i) => [
        String(i + 1),
        `${names[i % names.length]}${i >= names.length ? ` (${Math.floor(i / names.length) + 1})` : ''}`,
        String((i % 4) + 1),
      ]),
    },
    [name(t, 'members')]: {
      columns: t('database-columns-members').split(','),
      lines: Array.from({ length: NUMBERS.members }, (_, i) => [String(i + 1), `L-${String(1000 + i * 7)}`, neighbourhoods[i % 5]]),
    },
    [name(t, 'loans')]: {
      columns: t('database-columns-loans').split(','),
      lines: Array.from({ length: NUMBERS.loans }, (_, i) => [
        String(i + 1),
        String(((i * 37) % NUMBERS.boardgames) + 1),
        String(((i * 11) % NUMBERS.members) + 1),
        day(Math.floor(i / 6.5)),
        i > NUMBERS.loans - 40 ? '' : day(Math.floor(i / 6.5) + 14),
      ]),
    },
  };
}

const pg = (j: Game): PostgresState => postgres(j)!;
const lines = (j: Game, base: string, table: string) => pg(j).bases[base]?.tables[name(j.t, table)]?.lines.length ?? -1;
const crontabs = (j: Game): Record<string, string> => j.state.crontabs ?? {};
// The backup job: pg_dump of gamelib, as postgres (its crontab, or sudo -u postgres).
const dumpTask = (j: Game) => {
  const c = crontabs(j);
  const base = new RegExp(`\\b${db(j.t)}\\b`);
  const line = (text: string) => text.split('\n').some((l) => !l.trim().startsWith('#') && /pg_dump/.test(l) && base.test(l));
  return (
    (c.postgres !== undefined && line(c.postgres)) ||
    (c.root !== undefined && c.root.split('\n').some((l) => /pg_dump/.test(l) && base.test(l) && /-u postgres/.test(l)))
  );
};
const dumpRoot = (j: Game) =>
  (crontabs(j).root ?? '').split('\n').some((l) => !l.trim().startsWith('#') && /pg_dump/.test(l) && !/-u postgres/.test(l));
const archive = (j: Game) => {
  const n = j.find(BACKUPS);
  return (
    n?.type === 'directory' &&
    Object.values(n.children).some(
      (e) => e.type === 'file' && /^(PGDMP|--\n-- PostgreSQL database dump)/.test(typeof e.content === 'string' ? e.content : ''),
    )
  );
};
// A database other than gamelib (a test database) where the same row counts are found.
const succeededTest = (j: Game) =>
  Object.keys(pg(j).bases).some((b) => b !== db(j.t) && b !== 'postgres' && Object.entries(NUMBERS).every(([table, n]) => lines(j, b, table) === n));
const allIsFor = (j: Game) => Object.entries(NUMBERS).every(([table, n]) => lines(j, db(j.t), table) === n);
const output = (j: Game) => [j.last.output, ...j.last.errors].join('\n');

export const base: Chapter = {
  id: 'database',
  number: 3,
  commands: [
    'ls',
    'cd',
    'pwd',
    'cat',
    'less',
    'head',
    'tail',
    'grep',
    'wc',
    'du',
    'df',
    'cp',
    'mv',
    'rm',
    'mkdir',
    'id',
    'whoami',
    'crontab',
    'systemctl',
    'journalctl',
    'psql',
    'pg_dump',
    'pg_restore',
    'createdb',
    'dropdb',
    'sudo',
    'nano',
  ],
  home: M,
  welcome: 'message_from_berenice.txt',
  names: true,
  final: 'end',
  password: 'dice-2027',
  accounts,
  state: (t) => ({
    systemd: newSystemd('games', Date.UTC(2027, 6, 1, 7, 0, 0), Date.UTC(2027, 6, 14, 10, 30, 0), {
      ssh: {
        description: 'OpenBSD Secure Shell server',
        active: true,
        executable: 'sshd',
        process: [{ pid: 611, user: 'root', cpu: 0, mem: 0.2, command: 'sshd: /usr/sbin/sshd -D [listener] 0 of 10-100 startups' }],
      },
      postgresql: {
        description: 'PostgreSQL RDBMS',
        active: true,
        executable: 'postgres',
        process: [
          {
            pid: 702,
            user: 'postgres',
            cpu: 0.2,
            mem: 2.4,
            command: '/usr/lib/postgresql/16/bin/postgres -D /var/lib/postgresql/16/main -c config_file=/etc/postgresql/16/main/postgresql.conf',
          },
        ],
      },
      cron: { description: 'Regular background program processing daemon', active: true, executable: 'cron' },
    }),
    postgres: {
      bases: { postgres: { owner: 'postgres', tables: {} }, [db(t)]: { owner: db(t), tables: tables(t) } },
      roles: ['postgres', db(t)],
      archives: {},
    } satisfies PostgresState,
    crontabs: { root: `# ${t('database-crontab-root')}\n30 3 * * * /usr/bin/rsnapshot daily\n0 3 * * 1 /usr/bin/rsnapshot weekly` },
    mounts: [{ path: '/', capacity: 40 * Go, name: '/dev/vda1', system: 'ext4' }],
    lockedAccounts: [account(t, 'frontdesk')],
  }),
  // After the successful test restore: the 2:02 pm incident.
  afterCommand: (j) => {
    if (j.state.incident || !j.state.testPassed) return;
    j.state.incident = true;
    pg(j).bases[db(j.t)].tables[name(j.t, 'loans')].lines = [];
    const s = systemd(j)!;
    s.clock = Date.UTC(2027, 6, 14, 14, 5, 0);
    return j.t('database-incident');
  },
  createWorld: (t) => {
    const root: Rights = { owner: 'root' };
    const place = (children: Parameters<typeof d>[0], rights: Rights = root) => d(children, undefined, rights);
    const file = (text: string, rights: Rights = root) => f(text, { lines: true, ...rights });
    const pgd: Rights = { owner: 'postgres', group: 'postgres' };
    return place({
      etc: place({
        ...accountsFiles(),
        hostname: file('games'),
        postgresql: place(
          {
            '16': place({ main: place({ 'postgresql.conf': file("data_directory = '/var/lib/postgresql/16/main'\nport = 5432", pgd) }, pgd) }, pgd),
          },
          pgd,
        ),
      }),
      home: place({
        you: d({ 'message_from_berenice.txt': f(t('database-message-berenice')), 'note_from_malo.txt': f(t('database-word-malo')) }),
        berenice: place({}, { owner: 'berenice', mode: 'rwx------' }),
      }),
      tmp: place({}, { owner: 'root', mode: 'rwxrwxrwt' }),
      var: place({
        backups: place({ postgresql: place({}, { ...pgd, mode: 'rwxr-x---' }) }),
        lib: place({
          postgresql: place(
            {
              '16': place(
                {
                  main: place(
                    { base: place({}, pgd), global: place({}, pgd), pg_wal: place({}, pgd), PG_VERSION: file('16', pgd) },
                    { ...pgd, mode: 'rwx------' },
                  ),
                },
                pgd,
              ),
            },
            pgd,
          ),
        }),
      }),
    });
  },
  events: [
    { id: 'role', condition: (j) => new RegExp(`role "(${j.player}|root)" does not exist`).test(output(j)), message: (j) => j.t('database-event-role') },
    {
      id: 'on-true',
      condition: (j) =>
        output(j).includes('already exists') && j.last.commands.some((c) => c.includes('pg_restore') && c.includes(db(j.t))) && !j.state.incident,
      message: (j) => j.t('database-event-on-true'),
    },
    {
      id: 'test-succeeded',
      condition: (j) => succeededTest(j),
      // The incident comes with the next command.
      action: (j) => (j.state.testPassed = true),
      message: (j) => j.t('database-event-test-succeeded'),
    },
    {
      id: 'duplicates',
      condition: (j) => !!j.state.incident && output(j).includes('duplicate key value'),
      message: (j) => j.t('database-event-duplicates'),
    },
    { id: 'cron-root', condition: (j) => dumpRoot(j), message: (j) => j.t('database-event-cron-root') },
    { id: 'loans-returned', condition: (j) => !!j.state.incident && allIsFor(j), message: (j) => j.t('database-event-loans-returned') },
    { id: 'end', condition: (j) => !!j.state.incident && allIsFor(j) && dumpTask(j) && archive(j), message: (j) => j.t('database-event-end') },
  ],
};
