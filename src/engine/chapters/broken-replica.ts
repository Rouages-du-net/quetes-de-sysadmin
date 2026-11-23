// Story "The Allotments", chapter "Broken Replica": rake, the replica Moana's
// reports read, stopped on Saturday evening. Moana added her neighbour Esi
// to the waiting list straight on rake (read_only was off): he took id 1043.
// Twenty-six minutes later, Wairimu signed up on the site, on trowel, and got
// 1043 too; when the row came to rake, its SQL thread stopped on a duplicate
// key (1062). Since then rake is two days behind, and its nightly dump, made
// with --skip-lock-tables, copies a stale database.
// The fix: read_only on rake (SET GLOBAL and the configuration file); Esi's
// row removed from rake and Esi added on trowel, where writes belong; the
// SQL thread started again, caught up, the tables compared (CHECKSUM TABLE
// on both); or rake re-seeded from a consistent dump of trowel (with its
// GTID position). Then a consistent backup taken on rake (mariadb-dump
// --single-transaction, in the nightly script too) and checked by restoring
// it into a scratch database.
// Objective checked on the state: read_only on rake now and in its file;
// both replication threads running, no error, no delay; the same rows on
// both servers; Esi on trowel's waiting list; the backup script with
// --single-transaction; a dump taken on rake with --single-transaction while
// it was in step with trowel; that dump restored into another database, with
// the same rows.
// False leads: sql_slave_skip_counter (the replica runs again, but its 1043
// is still Esi: the servers differ), repeated; a dump that locks the tables
// (replication waits behind it) or one without locks while writes arrive
// (not consistent).
// Sources: https://mariadb.com/kb/en/show-replica-status/,
// https://mariadb.com/kb/en/sql_slave_skip_counter/ (replication and binary log
// system variables), https://mariadb.com/kb/en/server-system-variables/#read_only,
// https://mariadb.com/kb/en/gtid/, https://mariadb.com/kb/en/checksum-table/,
// https://mariadb.com/kb/en/mariadb-dump/ (--single-transaction, --master-data).

import type { Chapter } from '../world';
import { f } from '../world';
import type { Game } from '../shell';
import { fileValue, healthy, isOn, linkOf, maria } from '../mariadb';
import { BACKUP_SCRIPT, HOME, ESI, PASSWORD, identical, initialiseStory, machine, passTime, rakeHost, seen, story, trowelAccounts, trowelState, trowelWorld } from './allotments';

const rake = (j: Game) => machine(j, 'rake');
const rs = (j: Game) => maria(rake(j));
const readOnlyNow = (j: Game) => isOn(rs(j).vars.read_only);
const readOnlyFile = (j: Game) => isOn(fileValue(rake(j), 'read_only'));
const repaired = (j: Game) => healthy(linkOf(rake(j)));
const same = (j: Game) => repaired(j) && identical(j);
const junOnTrowel = (j: Game) => maria(j).databases.plots.tables.waitlist.rows.filter((r) => r[2] === ESI.email).length === 1;
const scriptOk = (j: Game) =>
  (rake(j).read(BACKUP_SCRIPT) ?? '')
    .split('\n')
    .filter((l) => !/^\s*#/.test(l))
    .some((l) => /\b(mariadb-dump|mysqldump)\b/.test(l) && /--single-transaction\b/.test(l));
const dumps = (j: Game) => Object.values(rs(j).dumps);
const backupOk = (j: Game) => story(j).goodDumps.some((id) => rs(j).dumps[id]?.singleTransaction);

export const brokenReplica: Chapter = {
  id: 'broken-replica',
  number: 3,
  commands: ['ls', 'cd', 'pwd', 'cat', 'less', 'head', 'tail', 'grep', 'wc', 'diff', 'nano', 'sudo', 'systemctl', 'journalctl', 'ssh', 'sh', 'find', 'date', 'mariadb', 'mysql', 'mariadb-admin', 'mysqladmin', 'mariadb-dump', 'mysqldump', 'mariadb-check', 'mysqlcheck', 'exit'],
  home: HOME,
  welcome: 'message_from_moana.txt',
  names: true,
  final: 'end',
  steps: ['stopped', 'cause', 'read-only', 'read-only-kept', 'repaired', 'identical', 'jun', 'script', 'backup', 'restored', 'end'],
  password: PASSWORD,
  accounts: trowelAccounts,
  hosts: { rake: rakeHost() },
  state: (t) => trowelState(t, 3),
  initialise: (j) => initialiseStory(j, 3),
  createWorld: (t) =>
    trowelWorld(t, 3, {
      'message_from_moana.txt': f(t('broken-replica-message-moana')),
      'note_from_lwazi.txt': f(t('broken-replica-note-lwazi')),
    }),
  afterCommand: (j) => passTime(j),
  events: [
    { id: 'stopped', condition: (j) => (rs(j).looked?.['replica-status'] ?? 0) > 0, message: (j) => j.t('broken-replica-event-stopped') },
    { id: 'cause', condition: (j) => seen(j, ESI.email), message: (j) => j.t('broken-replica-event-cause') },
    { id: 'skipped', condition: (j) => rs(j).skipped.length > 0, message: (j) => j.t('broken-replica-event-skipped') },
    { id: 'skip-again', condition: (j) => rs(j).skipped.length > 1, message: (j) => j.t('broken-replica-event-skip-again', { count: rs(j).skipped.length }) },
    { id: 'read-only', condition: readOnlyNow, message: (j) => j.t('broken-replica-event-read-only') },
    { id: 'read-only-kept', condition: readOnlyFile, message: (j) => j.t('broken-replica-event-read-only-kept') },
    { id: 'repaired', condition: repaired, message: (j) => j.t('broken-replica-event-repaired') },
    { id: 'diverged', condition: (j) => repaired(j) && !identical(j) && (rs(j).looked?.checksum ?? 0) > 0, message: (j) => j.t('broken-replica-event-diverged') },
    { id: 'identical', condition: same, message: (j) => j.t('broken-replica-event-identical') },
    { id: 'jun', condition: junOnTrowel, message: (j) => j.t('broken-replica-event-jun') },
    { id: 'locking-dump', condition: (j) => dumps(j).some((d) => d.blocked > 0), message: (j) => j.t('broken-replica-event-locking-dump') },
    { id: 'inconsistent-dump', condition: (j) => dumps(j).some((d) => !d.consistent), message: (j) => j.t('broken-replica-event-inconsistent-dump') },
    { id: 'script', condition: scriptOk, message: (j) => j.t('broken-replica-event-script') },
    { id: 'backup', condition: backupOk, message: (j) => j.t('broken-replica-event-backup') },
    { id: 'restored', condition: (j) => !!story(j).restoreOk, message: (j) => j.t('broken-replica-event-restored') },
    {
      id: 'end',
      condition: (j) => readOnlyNow(j) && readOnlyFile(j) && same(j) && junOnTrowel(j) && scriptOk(j) && backupOk(j) && !!story(j).restoreOk,
      message: (j) => j.t('broken-replica-event-end'),
    },
  ],
};
