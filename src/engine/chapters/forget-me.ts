// Story "The Choir", chapter "Forget Me": Tomas Novak, a tenor, left the
// choir on Saturday and asks to be erased (GDPR article 17). Kenji, the
// treasurer, reminds you that the subscriptions are accounting records the
// choir must keep for ten years (the policy says so). Then the retention
// the policy promises must happen on its own: Ruben's nightly purge
// (choir-purge.timer) was never enabled and runs as www-data, which has no
// database role, and it forgets the attendance; the weekly restic backup
// never forgets anything (84 snapshots since September 2029), so erased and
// expired data lives on in the backups forever.
// The fix: Tomas's member row, attendance and newsletter subscription
// deleted, his uploads removed, his payments kept; the purge job fixed
// (User=postgres, the attendance line, daemon-reload, the timer enabled
// and started; or a crontab of postgres); a forget policy of about three
// months of weekly snapshots with --prune in the backup script, and run
// once now.
// Objective checked on the state: Tomas gone from members, attendance,
// newsletter and uploads, his three payments still there; the scheduled
// purge, run as it will run (as its account, on a copy of the database
// with the expired rows), deletes the members who left more than two years
// ago and the attendance older than two years, and nothing else; the
// repository's oldest snapshot between six weeks and about three months old, pruned;
// the backup script's forget policy keeping that much, with --prune.
// False leads: deleting the payments too; a purge that fails (www-data),
// that isn't scheduled, that deletes too much or forgets the attendance;
// forget without prune; keeping too few snapshots; trimming the repository
// by hand without changing the script.
// Sources: https://eur-lex.europa.eu/eli/reg/2016/679/oj (art. 5(1)(e), 17),
// https://www.freedesktop.org/software/systemd/man/latest/systemd.timer.html,
// https://restic.readthedocs.io/en/stable/060_forget.html.

import type { Chapter, Directory } from '../world';
import type { Game, Shell } from '../shell';
import { f } from '../world';
import { parse } from '../cron';
import type { Repo } from '../commands/restic';
import type { Table } from '../postgres';
import {
  BACKUP, DAY, HOME, PASSWORD, PURGE, REPO, TOMAS, UPLOADS, choirAccounts, choirState, choirWorld, clock, forgetPolicy, initialiseChoir, member, passTime, policyOutcome, referenceTables, rowsOf, sd, seen, typed, writeChoirRepo,
} from './choir';

// ——— Tomas's erasure ———

const tomas = (j: Game) => member(j.t, TOMAS, 3);
const erasedDb = (j: Game) =>
  !rowsOf(j, 'members').some((l) => l[0] === TOMAS) && !rowsOf(j, 'attendance').some((l) => l[1] === TOMAS) && !rowsOf(j, 'newsletter').some((l) => l[1] === tomas(j).email);
const uploadsErased = (j: Game) => {
  const n = j.find(`${UPLOADS}/${TOMAS}`);
  return !n || (n.type === 'directory' && Object.keys((n as Directory).children).length === 0);
};
const hisPayments = (j: Game) => referenceTables(j.t, 3).payments.lines.filter((l) => l[1] === TOMAS);
const paymentsKept = (j: Game) => hisPayments(j).every((p) => rowsOf(j, 'payments').some((l) => l[6] === p[6] && l[1] === TOMAS));

// ——— The scheduled purge, run as it will run ———

interface Job {
  account: string;
  command?: string;
  service?: string;
}

/** The purge jobs that will run on their own: crontabs, and the active timers (but the backup's). */
function jobs(j: Game): Job[] {
  const out: Job[] = [];
  for (const [account, text] of Object.entries((j.state.crontabs ?? {}) as Record<string, string>)) for (const t of parse(text, '').tasks) out.push({ account, command: t.command });
  for (const m of Object.values(sd(j).timers ?? {})) if (m.state === 'active' && m.unit !== 'choir-backup') out.push({ account: '', service: m.unit });
  return out;
}

// Each loaded service gets a number: a daemon-reload replaces it, and the verdict must be computed again.
const identities = new WeakMap<object, number>();
let next = 0;
const identity = (o: object | undefined) => {
  if (!o) return 0;
  if (!identities.has(o)) identities.set(o, ++next);
  return identities.get(o)!;
};

export type Verdict = 'none' | 'idle' | 'partial' | 'too-much' | 'ok';

const twoYearsAgo = (j: Game) => {
  const d = new Date(Math.floor(clock(j) / DAY) * DAY);
  d.setUTCFullYear(d.getUTCFullYear() - 2);
  return d.toISOString().slice(0, 10);
};

/**
 * Runs the purge jobs once, on a copy of the database where the rows the
 * policy says to purge are present (put back if a hand already deleted
 * them), then compares and puts everything back.
 */
export function purgeVerdict(j: Game): Verdict {
  const list = jobs(j);
  if (!list.length) return 'none';
  const s = j as Shell;
  const system = sd(j);
  const files = [PURGE, ...list.flatMap((x) => x.command?.match(/\/[\w./-]+/g) ?? []), ...list.filter((x) => x.service).map((x) => system.services[x.service!]?.file ?? '')].map((p) => `${p}=${s.read(p) ?? ''}`);
  const live = j.state.postgres.bases.choir.tables as Record<string, Table>;
  const key = JSON.stringify([list, files, Object.values(live).map((x) => x.lines.length), list.map((x) => (x.service ? identity(system.services[x.service]) : 0))]);
  const cache = j.state.purgeVerdict as { key: string; verdict: Verdict } | undefined;
  if (cache?.key === key) return cache.verdict;
  const cutoff = twoYearsAgo(j);
  const reference = referenceTables(j.t, 3);
  const before = structuredClone(j.state.postgres);
  // The copy: what is there, plus the expired rows of the start if they are gone.
  const trial = structuredClone(live) as Record<string, Table>;
  const expiredMembers = reference.members.lines.filter((l) => l[7] && l[7] < cutoff);
  const oldAttendance = reference.attendance.lines.filter((l) => l[2] < cutoff);
  for (const [table, rows] of [
    ['members', expiredMembers],
    ['attendance', oldAttendance],
  ] as const)
    for (const r of rows) if (!trial[table].lines.some((l) => l[0] === r[0])) trial[table].lines.push([...r]);
  j.state.postgres.bases.choir.tables = trial;
  const start = structuredClone(trial);
  const logged = system.log.length;
  const time = system.clock;
  const who = s.who;
  try {
    for (const job of list) {
      if (job.command) {
        s.who = job.account;
        s.runTask(job.command);
        s.who = who;
      } else system.services[job.service!]?.execute?.(j);
    }
  } finally {
    s.who = who;
  }
  const after = j.state.postgres.bases.choir.tables as Record<string, Table>;
  j.state.postgres = before;
  system.log.length = logged;
  system.clock = time;
  const has = (t: Table, id: string) => t.lines.some((l) => l[0] === id);
  const keep = (table: string, expired: (l: string[]) => boolean) => start[table].lines.filter((l) => !expired(l)).every((l) => has(after[table], l[0]));
  const tooMuch =
    !keep('members', (l) => !!l[7] && l[7] < cutoff) ||
    !keep('attendance', (l) => l[2] < cutoff) ||
    !keep('payments', () => false) ||
    !keep('newsletter', () => false);
  const membersDone = !expiredMembers.some((r) => has(after.members, r[0]));
  const attendanceDone = !oldAttendance.some((r) => has(after.attendance, r[0]));
  const verdict: Verdict = tooMuch ? 'too-much' : membersDone && attendanceDone ? 'ok' : membersDone || attendanceDone ? 'partial' : 'idle';
  j.state.purgeVerdict = { key, verdict };
  return verdict;
}

// ——— The backups ———

const repo = (j: Game) => j.state.restic?.[REPO] as Repo | undefined;
const ages = (j: Game) => (repo(j)?.snapshotList ?? []).map((x) => (clock(j) - x.time) / DAY);
const tooMany = (j: Game) => ages(j).some((a) => a > 100);
const tooFew = (j: Game) => ages(j).length < 3 || Math.max(0, ...ages(j)) < 40;
const repoOk = (j: Game) => !tooMany(j) && !tooFew(j) && !repo(j)?.pruneNeeded;
const script = (j: Game) => j.read(BACKUP) ?? '';
const scriptPolicy = (j: Game) => {
  const p = forgetPolicy(script(j));
  if (!p) return null;
  return { ...p, ...policyOutcome(p) };
};
const scriptOk = (j: Game) => {
  const p = scriptPolicy(j);
  return !!p && p.prune && p.kept >= 3 && p.oldest >= 40 && p.oldest <= 100 && /^\s*[^#]*\brestic\b.*\bbackup\b/m.test(script(j)) && sd(j).timers?.['choir-backup']?.state === 'active';
};

export const forgetMe: Chapter = {
  id: 'forget-me',
  number: 3,
  commands: ['ls', 'cd', 'pwd', 'cat', 'less', 'head', 'tail', 'grep', 'find', 'rm', 'rmdir', 'cp', 'mv', 'nano', 'chmod', 'sudo', 'psql', 'systemctl', 'journalctl', 'crontab', 'restic', 'date', 'sh', 'exit'],
  home: HOME,
  welcome: 'message_from_kenji.txt',
  names: true,
  final: 'end',
  steps: ['found', 'erased', 'uploads', 'purge-broken', 'purge', 'snapshots', 'trimmed', 'script', 'end'],
  password: PASSWORD,
  accounts: choirAccounts,
  state: (t) => choirState(t, 3),
  initialise: (j) => {
    initialiseChoir(j, 3);
    writeChoirRepo(j);
  },
  createWorld: (t) =>
    choirWorld(t, 3, {
      'message_from_kenji.txt': f(t('forget-me-message-kenji')),
      'message_from_tomas.txt': f(t('forget-me-message-tomas')),
    }),
  afterCommand: (j) => passTime(j),
  events: [
    { id: 'found', condition: (j) => seen(j, tomas(j).email) && seen(j, tomas(j).phone), message: (j) => j.t('forget-me-event-found') },
    { id: 'payments-deleted', condition: (j) => !paymentsKept(j), message: (j) => j.t('forget-me-event-payments-deleted') },
    { id: 'erased', condition: (j) => erasedDb(j) && paymentsKept(j), message: (j) => j.t('forget-me-event-erased') },
    { id: 'uploads', condition: uploadsErased, message: (j) => j.t('forget-me-event-uploads') },
    {
      id: 'purge-broken',
      condition: (j) => seen(j, 'role "www-data" does not exist') || (seen(j, /choir-purge/) && /list-timers|status|is-enabled|cat/.test(typed(j))),
      message: (j) => j.t('forget-me-event-purge-broken'),
    },
    { id: 'purge-too-much', condition: (j) => purgeVerdict(j) === 'too-much', message: (j) => j.t('forget-me-event-purge-too-much') },
    { id: 'purge-partial', condition: (j) => purgeVerdict(j) === 'partial', message: (j) => j.t('forget-me-event-purge-partial') },
    {
      id: 'purge-idle',
      condition: (j) => purgeVerdict(j) === 'idle' && /systemctl|crontab/.test(typed(j)) && jobs(j).length > 0,
      message: (j) => j.t('forget-me-event-purge-idle'),
    },
    { id: 'purge', condition: (j) => purgeVerdict(j) === 'ok', message: (j) => j.t('forget-me-event-purge') },
    { id: 'snapshots', condition: (j) => seen(j, /^\d+ snapshots$/m) && (repo(j)?.snapshotList.length ?? 0) > 20, message: (j) => j.t('forget-me-event-snapshots', { count: repo(j)?.snapshotList.length ?? 0 }) },
    { id: 'too-few', condition: (j) => tooFew(j), message: (j) => j.t('forget-me-event-too-few') },
    { id: 'no-prune', condition: (j) => !tooMany(j) && !!repo(j)?.pruneNeeded, message: (j) => j.t('forget-me-event-no-prune') },
    { id: 'trimmed', condition: repoOk, message: (j) => j.t('forget-me-event-trimmed') },
    { id: 'script-unchanged', condition: (j) => repoOk(j) && !scriptOk(j) && !forgetPolicy(script(j)), message: (j) => j.t('forget-me-event-script-unchanged') },
    { id: 'script', condition: scriptOk, message: (j) => j.t('forget-me-event-script') },
    {
      id: 'end',
      condition: (j) => erasedDb(j) && paymentsKept(j) && uploadsErased(j) && purgeVerdict(j) === 'ok' && repoOk(j) && scriptOk(j),
      message: (j) => j.t('forget-me-event-end'),
    },
  ],
};
