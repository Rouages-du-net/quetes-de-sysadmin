// Story "The Shelter", chapter "What Do We Have?": the shelters' disaster
// recovery plan (/srv/drp/plan.md on meadow) was written by Dariusz in
// 2029, who has since moved away. Teuila asks for it to be true again.
// You inventory paddock (systemctl's units and timers, ss's sockets, the
// backup job), and compare: phpList is gone since 2030, vetlink (Mirela's
// hourly pull of the vet records, 2031) is in neither the plan nor the
// backups, and the plan promises an RPO of one hour for a database backed
// up once a night. You rewrite the table (service, RPO, RTO, backup,
// owner), add /srv/vetlink to the nightly job, and make sure every service
// has a snapshot within its RPO.
// Objective checked on the state: the plan's table has a row for the site,
// the app and its database, and vetlink, each with an RPO and an RTO the
// game can read, a backup and an owner who is still here, and no row for
// phpList; every RPO is at least the interval of the job's timer; the
// latest snapshot holding each service's data is younger than its RPO; the
// nightly job backs up /srv/vetlink.
// False leads: keeping the old plan's rows (phpList, Dariusz), an RPO the
// nightly schedule can't meet.
// Sources: NIST SP 800-34 Rev. 1, 3.2 (business impact analysis: RPO, RTO),
// https://csrc.nist.gov/pubs/sp/800/34/r1/upd1/final;
// https://restic.readthedocs.io/en/stable/045_working_with_repos.html#listing-all-snapshots.

import { f, type Chapter } from '../world';
import type { Game, Shell } from '../shell';
import type { Repo } from '../commands/restic';
import {
  BACKUP_SCRIPT,
  HOME,
  PASSWORD,
  PLAN,
  REPO,
  VETLINK,
  DAY,
  holding,
  inner,
  interval,
  duration,
  meadowAccounts,
  meadowState,
  meadowWorld,
  paddockHost,
  passTime,
  planRows,
  sd,
  seen,
  serviceOf,
  storyCurl,
  type PlanRow,
  type ServiceId,
  initialiseMeadow,
} from './shelter';

export const MEADOW_COMMANDS = ['ls', 'cd', 'pwd', 'cat', 'less', 'head', 'tail', 'grep', 'echo', 'tee', 'nano', 'cp', 'mv', 'mkdir', 'diff', 'sudo', 'ssh', 'date', 'restic', 'exit'];

const SERVICES: Exclude<ServiceId, 'newsletter'>[] = ['website', 'adoptions', 'vetlink'];

const planText = (j: Game) => j.read(PLAN) ?? '';
const rows = (j: Game) => planRows(j.t, planText(j));
const original = (j: Game) => planText(j).trim() === j.t('shelter-plan-2029').replace(/^\n+|\s+$/g, '').trim();
const rowFor = (j: Game, id: ServiceId): PlanRow | undefined => rows(j).find((r) => serviceOf(r) === id);
const repo = (j: Game): Repo | undefined => ((j as Shell).principal.state.restic as Record<string, Repo> | undefined)?.[REPO];
const pd = (j: Game) => inner(j, 'paddock');
const onPaddock = (j: Game, text: string | RegExp) => {
  const p = pd(j);
  return !!p && seen(p, text);
};
const LEFT = /dariusz/i;

/** The interval of the nightly job's timer on paddock (its OnCalendar=, as written now): 24 hours unless changed. */
function backupInterval(j: Game): number {
  const p = pd(j);
  const text = p?.read('/etc/systemd/system/shelter-backup.timer') ?? 'OnCalendar=*-*-* 02:00:00';
  const now = sd(j).clock;
  const all = [...text.matchAll(/^\s*OnCalendar\s*=\s*(.+)$/gm)].map((m) => interval(m[1].trim(), now)).filter((x): x is number => x !== null);
  return all.length ? Math.min(...all) : DAY;
}

const complete = (r: PlanRow | undefined) => !!r && duration(r.rpo) !== null && duration(r.rto) !== null && r.backup.trim() !== '' && r.owner.trim() !== '' && !LEFT.test(r.owner);
const allRows = (j: Game) => SERVICES.every((id) => complete(rowFor(j, id)));
const unmeetable = (j: Game) => rows(j).some((r) => serviceOf(r) && serviceOf(r) !== 'newsletter' && (duration(r.rpo) ?? Infinity) < backupInterval(j));
const meetable = (j: Game) => SERVICES.every((id) => (duration(rowFor(j, id)?.rpo ?? '') ?? 0) >= backupInterval(j));
const stale = (j: Game) => !!rowFor(j, 'newsletter');

/** The latest snapshot holding the service's data is younger than its RPO. */
const within = (j: Game, id: Exclude<ServiceId, 'newsletter'>) => {
  const r = repo(j);
  const rpo = duration(rowFor(j, id)?.rpo ?? '');
  if (!r || rpo === null) return false;
  const last = holding(r, id).at(-1);
  return !!last && sd(j).clock - last.time <= rpo;
};
const vetlinkSaved = (j: Game) => {
  const r = repo(j);
  return !!r && holding(r, 'vetlink').length > 0;
};

/** The nightly job backs up vetlink's data (its own path, or the whole of /srv). */
const fixed = (j: Game) => {
  const text = pd(j)?.read(BACKUP_SCRIPT) ?? '';
  return text.split('\n').some((l) => !/^\s*#/.test(l) && /\brestic\b.*\bbackup\b/.test(l) && new RegExp(`\\s(${VETLINK}|/srv)/?(\\s|$)`).test(l));
};

export const whatWeHave: Chapter = {
  id: 'what-we-have',
  number: 1,
  commands: MEADOW_COMMANDS,
  home: HOME,
  welcome: 'message_from_teuila.txt',
  names: true,
  final: 'end',
  steps: ['paddock', 'units', 'timers', 'sockets', 'script', 'snapshots', 'rows', 'fixed', 'saved', 'end'],
  password: PASSWORD,
  accounts: meadowAccounts,
  state: (t) => ({ ...meadowState(t, 1), storyCurl }),
  hosts: { paddock: paddockHost() },
  initialise: (j) => initialiseMeadow(j),
  createWorld: (t) => meadowWorld(t, 1, { 'message_from_teuila.txt': f(t('what-we-have-message-teuila')) }),
  afterCommand: (j) => passTime(j),
  events: [
    { id: 'plan', condition: (j) => seen(j, '| RPO |') || seen(j, /\|\s*RPO\s*\|/), message: (j) => j.t('what-we-have-event-plan') },
    { id: 'paddock', condition: (j) => !!pd(j), message: (j) => j.t('what-we-have-event-paddock') },
    { id: 'units', condition: (j) => onPaddock(j, /adopt\.service/) && onPaddock(j, /nginx\.service|postgresql/), message: (j) => j.t('what-we-have-event-units') },
    { id: 'timers', condition: (j) => onPaddock(j, 'vetlink-sync.timer'), message: (j) => j.t('what-we-have-event-timers') },
    { id: 'sockets', condition: (j) => onPaddock(j, /127\.0\.0\.1:8000/) && onPaddock(j, /:5432/), message: (j) => j.t('what-we-have-event-sockets') },
    { id: 'no-phplist', condition: (j) => /phplist/i.test(pd(j)?.last.line ?? '') && !/phplist/i.test(pd(j)?.last.output ?? ''), message: (j) => j.t('what-we-have-event-no-phplist') },
    { id: 'script', condition: (j) => onPaddock(j, /restic backup \/etc/), message: (j) => j.t('what-we-have-event-script', { path: VETLINK }) },
    {
      id: 'snapshots',
      condition: (j) => [pd(j), (j as Shell).principal].some((s) => ((s?.state.resticDone as string[] | undefined) ?? []).includes('snapshots')),
      message: (j) => j.t('what-we-have-event-snapshots'),
    },
    { id: 'rpo-unmet', condition: (j) => !original(j) && unmeetable(j), message: (j) => j.t('what-we-have-event-rpo-unmet') },
    { id: 'old-owner', condition: (j) => !original(j) && rows(j).some((r) => serviceOf(r) !== 'newsletter' && LEFT.test(r.owner)), message: (j) => j.t('what-we-have-event-old-owner') },
    { id: 'stale-row', condition: (j) => !original(j) && rowFor(j, 'vetlink') !== undefined && stale(j), message: (j) => j.t('what-we-have-event-stale-row') },
    { id: 'rows', condition: (j) => allRows(j) && meetable(j) && !stale(j), message: (j) => j.t('what-we-have-event-rows') },
    { id: 'unsaved', condition: (j) => !!rowFor(j, 'vetlink') && !vetlinkSaved(j) && !original(j), message: (j) => j.t('what-we-have-event-unsaved') },
    { id: 'fixed', condition: fixed, message: (j) => j.t('what-we-have-event-fixed') },
    { id: 'saved', condition: vetlinkSaved, message: (j) => j.t('what-we-have-event-saved') },
    {
      id: 'end',
      condition: (j) => allRows(j) && meetable(j) && !stale(j) && fixed(j) && SERVICES.every((id) => within(j, id)),
      message: (j) => j.t('what-we-have-event-end'),
    },
  ],
};
