// Story "The Old Sun" — chapter "Trust, Then Switch": the lending desk
// reopens tomorrow. Point the catalogue at greenhouse, start it again, and
// keep the old box — frozen, not erased — until the new one has proved
// itself:
//   - check: the same counts on both sides (SELECT count(*));
//   - catalogue.ini: db_host = greenhouse.internal, then svcadm enable (the
//     application reads its configuration when it starts);
//   - freeze the old database: ALTER DATABASE seeds SET
//     default_transaction_read_only = on (it can still be read), or stop it
//     (svcadm disable postgresql_84); keep its data and the ZFS snapshot.
// Objective checked on the state: the catalogue online and writing to
// greenhouse, the old database read-only or stopped, its data directory and
// the snapshot still there.
// Sources: https://www.postgresql.org/docs/16/runtime-config-client.html
// (default_transaction_read_only), https://docs.oracle.com/cd/E26505_01/
// (svcadm).

import { f, type Chapter } from '../world';
import type { Game } from '../shell';
import { smf, zfs } from '../solaris';
import type { PostgresState } from '../postgres';
import { APP_FMRI, DATASET, DATA_DIR, GREENHOUSE_COMMANDS, HOME, PASSWORD, PG_FMRI, catalogue, greenhouse, greenhouseHost, herbariumAccounts, herbariumState, herbariumWorld, lendingsGoOn, seedsOn } from './seed-bank';
import { COMMANDS_MOVE } from './byte-order';

const appOnline = (j: Game) => smf(j).services[APP_FMRI]?.state === 'online';
const toGreenhouse = (j: Game) => /^greenhouse(\.internal)?$|^192\.0\.2\.36$/.test(String(j.state.catalogueDb ?? ''));
const oldFrozen = (j: Game) => !!(j.state.postgres as PostgresState).bases.seeds?.readOnly || smf(j).services[PG_FMRI]?.state !== 'online';
const kept = (j: Game) => j.exists(`${DATA_DIR}/PG_VERSION`) && Object.keys(zfs(j).snapshots).some((s) => s.startsWith(`${DATASET}@`));
const countedThere = (j: Game) => {
  const s = greenhouse(j);
  return !!s && s.last.commands.some((c) => c.includes('psql')) && /count/.test(s.last.output);
};

export const switchOver: Chapter = {
  id: 'switch-over',
  number: 3,
  commands: [...COMMANDS_MOVE],
  home: HOME,
  welcome: 'email_inaya.txt',
  names: true,
  final: 'end',
  steps: ['counted', 'online', 'frozen', 'end'],
  password: PASSWORD,
  accounts: herbariumAccounts,
  hosts: { greenhouse: greenhouseHost({ seeds: catalogue, commands: GREENHOUSE_COMMANDS }) },
  state: () => herbariumState({ snapshot: true, appOnline: false }),
  afterCommand: lendingsGoOn,
  createWorld: (t) =>
    herbariumWorld(t, {
      home: { 'email_inaya.txt': f(t('switch-over-email-inaya')), 'migration.md': f(t('switch-over-migration'), { lines: true }) },
    }),
  events: [
    { id: 'counted', condition: countedThere, message: (j) => j.t('switch-over-event-counted') },
    { id: 'still-old', condition: (j) => appOnline(j) && !toGreenhouse(j), message: (j) => j.t('switch-over-event-still-old') },
    { id: 'online', condition: (j) => appOnline(j) && toGreenhouse(j), message: (j) => j.t('switch-over-event-online') },
    { id: 'frozen', condition: oldFrozen, message: (j) => j.t('switch-over-event-frozen') },
    { id: 'not-kept', condition: (j) => !kept(j), message: (j) => j.t('switch-over-event-not-kept') },
    {
      id: 'end',
      condition: (j) => appOnline(j) && toGreenhouse(j) && oldFrozen(j) && kept(j) && (seedsOn(greenhouse(j))?.tables.lendings.lines.length ?? 0) >= 14,
      message: (j) => j.t('switch-over-event-end'),
    },
  ],
};
