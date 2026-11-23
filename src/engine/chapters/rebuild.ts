// Story "The Shelter", chapter "Rebuild on the Spare": on the night of 13
// November the cellar of Hillside's barn flooded; paddock is under water
// (the site's checks fail from 2:50). Wiremu brought a donated machine,
// haven, with a fresh Debian 13 and restic. You follow the plan's restore
// order on it, with nothing but the backups and Rahel's envelope: the
// packages (apt update, nginx, postgresql), the latest snapshot restored
// BESIDE the new system, what belongs back copied into place (the site, the
// app, vetlink's records, nginx's site, the units), the database recreated
// from the dump and checked against the job's checksum and row counts, the
// services started in their order (PostgreSQL, the app, nginx), and the
// site tested locally before anyone switches anything.
// Objective checked on the state: on haven, nginx serves www's home page
// and /adopt/animals (the app, on its database); the database holds every
// row of the night's dump; the dump was checked (sha256sum -c, or the row
// counts asked of psql); vetlink's records are back; the site was tested
// from haven with curl.
// False leads: restic restore --target / (it overwrites haven's own
// /etc/fstab, machine-id, hostname and SSH host keys with paddock's:
// Wiremu puts them back), starting the app before its database exists,
// the nightly job's password (it drowned with paddock).
// Sources: https://restic.readthedocs.io/en/stable/050_restore.html,
// https://www.postgresql.org/docs/current/backup-dump.html#BACKUP-DUMP-RESTORE,
// https://www.freedesktop.org/software/systemd/man/latest/systemd.unit.html (After=, Requires=),
// NIST SP 800-34 Rev. 1, 4.5 (recovery phase: restore in order of priority and dependency).

import { f, password, type Chapter } from '../world';
import type { Game } from '../shell';
import { systemd } from '../systemd';
import { hex } from '../commands/restic';
import { ENVELOPE, HOME, PASSWORD, VETLINK, clobbered, havenHost, havenServes, inner, meadowAccounts, meadowState, meadowWorld, passTime, putBackMachineFiles, repoUrl, restoredDb as restoredHere, seen, storyCurl, vetRecords, initialiseMeadow
} from './shelter';
import { MEADOW_COMMANDS } from './what-we-have';

const hv = (j: Game) => inner(j, 'haven');
const onHaven = (j: Game, text: string | RegExp) => {
  const h = hv(j);
  return !!h && seen(h, text);
};
const restoredDb = (j: Game) => {
  const h = hv(j);
  return !!h && restoredHere(h);
};
const service = (j: Game, n: string) => {
  const h = hv(j);
  return h ? systemd(h)?.services[n] : undefined;
};
const installed = (j: Game) => !!service(j, 'nginx') && !!service(j, 'postgresql');
const vetlinkBack = (j: Game) => {
  const h = hv(j);
  return !!h && Object.entries(vetRecords(j.t)).every(([n, c]) => (h.read(`${VETLINK}/records/${n}`) ?? '').trim() === c.trim());
};
const serves = (j: Game) => {
  const h = hv(j);
  return h ? havenServes(h) : { home: false, app: false };
};
const flagged = (j: Game, key: string) => !!hv(j)?.state[key];

export const rebuild: Chapter = {
  id: 'rebuild',
  number: 2,
  commands: MEADOW_COMMANDS,
  home: HOME,
  welcome: 'message_from_teuila.txt',
  names: true,
  final: 'end',
  steps: ['haven', 'packages', 'snapshots', 'restored', 'copied', 'database', 'verified', 'adopt', 'nginx', 'tested', 'end'],
  password: PASSWORD,
  accounts: meadowAccounts,
  state: (t) => ({ ...meadowState(t, 2), storyCurl }),
  hosts: { haven: havenHost(2) },
  initialise: (j) => initialiseMeadow(j),
  createWorld: (t) =>
    meadowWorld(t, 2, {
      'message_from_teuila.txt': f(t('rebuild-message-teuila')),
      'envelope.txt': f(t('rebuild-envelope', { password: password(t, ENVELOPE), repo: repoUrl(t) }), { lines: true, mode: 'rw-------' }),
    }),
  afterCommand: (j) => passTime(j),
  events: [
    { id: 'down', condition: (j) => seen(j, 'timeout after 10s'), message: (j) => j.t('rebuild-event-down') },
    { id: 'paddock-gone', condition: (j) => /\bssh\b/.test(j.last.line ?? '') && j.last.errors.some((e) => /No route to host|Could not resolve|timed out/.test(e)), message: (j) => j.t('rebuild-event-paddock-gone') },
    { id: 'haven', condition: (j) => !!hv(j), message: (j) => j.t('rebuild-event-haven') },
    { id: 'no-lists', condition: (j) => !!hv(j)?.state.missingApt && !installed(j), message: (j) => j.t('rebuild-event-no-lists') },
    { id: 'packages', condition: installed, message: (j) => j.t('rebuild-event-packages') },
    { id: 'wrong-password', condition: (j) => !!hv(j)?.state.resticWrongPassword, message: (j) => j.t('rebuild-event-wrong-password') },
    { id: 'snapshots', condition: (j) => ((hv(j)?.state.resticKeysUsed as string[] | undefined) ?? []).includes(hex('shelter-key-envelope')), message: (j) => j.t('rebuild-event-snapshots') },
    {
      id: 'over-etc',
      condition: (j) => {
        const h = hv(j);
        return !!h && clobbered(h).length > 0;
      },
      action: (j) => {
        const h = hv(j)!;
        h.state.clobbered = clobbered(h);
        putBackMachineFiles(h);
      },
      message: (j) => j.t('rebuild-event-over-etc', { files: ((hv(j)?.state.clobbered as string[] | undefined) ?? []).join(', ') }),
    },
    { id: 'restored', condition: (j) => !!hv(j)?.state.resticRestoredTo && (hv(j)?.state.resticRestoredTo as string) !== '', message: (j) => j.t('rebuild-event-restored') },
    { id: 'copied', condition: (j) => !!hv(j)?.find('/srv/adopt/.env') && !!hv(j)?.find('/var/www/shelter/index.html'), message: (j) => j.t('rebuild-event-copied') },
    {
      id: 'too-early',
      condition: (j) => service(j, 'adopt')?.state === 'failed',
      message: (j) => j.t('rebuild-event-too-early'),
    },
    { id: 'database', condition: restoredDb, message: (j) => j.t('rebuild-event-database') },
    { id: 'verified', condition: (j) => flagged(j, 'dumpChecked') || ((hv(j)?.state.countsChecked as number) ?? 0) >= 2, message: (j) => j.t('rebuild-event-verified') },
    { id: 'adopt', condition: (j) => service(j, 'adopt')?.state === 'active' && restoredDb(j), message: (j) => j.t('rebuild-event-adopt') },
    { id: 'default-site', condition: (j) => onHaven(j, 'Welcome to nginx!'), message: (j) => j.t('rebuild-event-default-site') },
    { id: 'nginx', condition: (j) => serves(j).home, message: (j) => j.t('rebuild-event-nginx') },
    { id: 'vetlink', condition: vetlinkBack, message: (j) => j.t('rebuild-event-vetlink') },
    { id: 'tested', condition: (j) => flagged(j, 'testedLocally'), message: (j) => j.t('rebuild-event-tested') },
    {
      id: 'end',
      condition: (j) => serves(j).home && serves(j).app && restoredDb(j) && (flagged(j, 'dumpChecked') || ((hv(j)?.state.countsChecked as number) ?? 0) >= 2) && vetlinkBack(j) && flagged(j, 'testedLocally') && !!hv(j) && clobbered(hv(j)!).length === 0,
      message: (j) => j.t('rebuild-event-end'),
    },
  ],
};
