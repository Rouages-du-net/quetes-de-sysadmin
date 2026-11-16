// Story "The Old Sun" — chapter "Bytes in the Wrong Order": move the
// catalogue's database to greenhouse. Odette's advice on the phone: "copy the
// weekly tar of the data directory, and start it over there". It won't start:
// another version (8.4 vs 16), and SPARC writes its numbers in the other byte
// order (big-endian) — data files don't travel, a dump does.
//   - stop what writes (svcadm disable seed-catalogue): a dump is consistent
//     with itself, but lendings recorded after it would be lost;
//   - pg_dump seeds > seeds.sql (as postgres): SQL, in the database's
//     character set (LATIN1, with SET client_encoding = 'LATIN1');
//   - scp to greenhouse, createdb, psql -f: PostgreSQL converts LATIN1 to
//     UTF8 by itself. On greenhouse's UTF-8 terminal the dump shows � for
//     each accent (file says ISO-8859): that's expected. Converting it with
//     iconv but leaving SET client_encoding = 'LATIN1' double-converts
//     (Crimee becomes CrimAe).
// Objective checked on the state: the catalogue stopped, and greenhouse's
// seeds database holds exactly herbarium's rows, with their accents.
// Sources: https://www.postgresql.org/docs/16/upgrading.html,
// https://www.postgresql.org/docs/16/app-pgdump.html,
// https://www.postgresql.org/docs/16/multibyte.html

import { f, type Chapter } from '../world';
import type { Game } from '../shell';
import { smf } from '../solaris';
import type { PostgresState, Table } from '../postgres';
import { APP_FMRI, GREENHOUSE_COMMANDS, HOME, PASSWORD, greenhouse, greenhouseHost, herbariumAccounts, herbariumState, herbariumWorld, lendingsGoOn, seedsOn } from './seed-bank';
import { COMMANDS_READ } from './read-first';

const appStopped = (j: Game) => smf(j).services[APP_FMRI]?.state !== 'online';
const here = (j: Game) => (j.state.postgres as PostgresState).bases.seeds;
const same = (a: Record<string, Table>, b: Record<string, Table>) =>
  Object.keys(a).length === Object.keys(b).length && Object.entries(a).every(([n, t]) => JSON.stringify(t.lines) === JSON.stringify(b[n]?.lines));
const there = (j: Game) => seedsOn(greenhouse(j));
const mojibake = (j: Game) => JSON.stringify(there(j)?.tables ?? {}).includes('\u00c3');
const onGreenhouse = (j: Game, text: string) => {
  const s = greenhouse(j);
  return !!s && (s.last.output.includes(text) || s.last.errors.some((e) => e.includes(text)));
};

export const COMMANDS_MOVE = [...COMMANDS_READ, 'svcadm', 'pg_dump', 'scp', 'ssh', 'tar', 'iconv'];

export const byteOrder: Chapter = {
  id: 'byte-order',
  number: 2,
  commands: COMMANDS_MOVE,
  home: HOME,
  welcome: 'email_inaya.txt',
  names: true,
  final: 'end',
  steps: ['stopped', 'restored', 'end'],
  password: PASSWORD,
  accounts: herbariumAccounts,
  hosts: { greenhouse: greenhouseHost({ commands: GREENHOUSE_COMMANDS }) },
  state: () => herbariumState({ snapshot: true }),
  afterCommand: lendingsGoOn,
  createWorld: (t) =>
    herbariumWorld(t, {
      home: {
        'email_inaya.txt': f(t('byte-order-email-inaya')),
        'odette-notes.txt': f(t('read-first-notes-odette'), { lines: true }),
        'migration.md': f(t('byte-order-migration'), { lines: true }),
      },
    }),
  events: [
    { id: 'incompatible', condition: (j) => !!greenhouse(j)?.state.foreignCluster, message: (j) => j.t('byte-order-event-incompatible') },
    { id: 'stopped', condition: appStopped, message: (j) => j.t('byte-order-event-stopped') },
    { id: 'replacement', condition: (j) => onGreenhouse(j, '�') || onGreenhouse(j, 'ISO-8859 text'), message: (j) => j.t('byte-order-event-replacement') },
    { id: 'invalid', condition: (j) => onGreenhouse(j, 'invalid byte sequence for encoding'), message: (j) => j.t('byte-order-event-invalid') },
    { id: 'mojibake', condition: mojibake, message: (j) => j.t('byte-order-event-mojibake') },
    { id: 'missing-rows', condition: (j) => !!there(j) && !mojibake(j) && !same(here(j).tables, there(j)!.tables) && Object.keys(there(j)!.tables).length === 3, message: (j) => j.t('byte-order-event-missing-rows') },
    { id: 'restored', condition: (j) => !!there(j) && Object.keys(there(j)!.tables).length === 3, message: (j) => j.t('byte-order-event-restored') },
    { id: 'end', condition: (j) => appStopped(j) && !!there(j) && !mojibake(j) && same(here(j).tables, there(j)!.tables), message: (j) => j.t('byte-order-event-end') },
  ],
};
