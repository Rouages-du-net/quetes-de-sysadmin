// Story "The Night Batch" — chapter "The Late File": the batch runs on
// abacus every night at 02:00 (a systemd timer, the wrapper run-night.sh).
// Last night, the bureau's file arrived at 02:41: at 02:00, the batch
// processed the previous night's file a second time, and said nothing (the
// wrapper's last line is an echo: exit code 0). Ayesha caught it at 08:00.
// The program did what it was told; the plumbing around it must change:
//   - wait for the file to be complete: the bureau writes contrib.ebc.done
//     once its upload is over. The wrapper starts only if it is there
//     (test -f … || exit 0), and takes it away once the file is processed,
//     so that the same file isn't processed twice;
//   - try again: the timer every 10 minutes during the night
//     (OnCalendar=*-*-* 02..06:00/10, then daemon-reload), or a cron job;
//   - make a failure visible: set -e (or exit with the program's code), so
//     that systemd marks the service failed, or a mail.
// Every change to the wrapper, the units or a crontab is tried on the next
// two nights (a rehearsal agreed with the bureau): the file arrives at 02:41,
// then at 03:26 with a record lost on the bureau's side (return code 8).
// Objective checked on the state, after a rehearsal: the first night's file
// processed once, after it was complete, with return code 0; the second
// night's file processed, its return code 8 seen (the unit failed, or a
// mail); never an old file again.
// Sources: https://www.freedesktop.org/software/systemd/man/latest/systemd.timer.html,
// https://www.freedesktop.org/software/systemd/man/latest/systemd.time.html,
// https://manpages.debian.org/bookworm/dash/sh.1.en.html (set -e, exit),
// https://manpages.debian.org/bookworm/cron/crontab.5.en.html

import { f, type Chapter, type Directory } from '../world';
import type { Game, Shell } from '../shell';
import { newSystemd, systemd, writeLog } from '../systemd';
import { loadUnits, passTime } from '../timers';
import { runs, type Run } from '../cobol';
import { mails } from '../commands/monitoring';
import { content } from '../tools';
import {
  BATCH, DAT, DAY, DROP, EBC, HOME, MINUTE, PASSWORD, RPT,
  asciiFile, batchAccounts, batchWorld, contribCob, doneFlag, dropped, ebcdicFile, executable, nightOf, withLostRecord, type Night,
} from './night-batch';
import { COMMANDS_COMPILE } from './return-code';

const HOUR = 60 * MINUTE;
// Wednesday 21 November 2029, 18:00: Ayesha installs the timer.
const SETUP = Date.UTC(2029, 10, 21, 18, 0, 0);
// Friday 23 November 2029, 8:30.
const NOW = Date.UTC(2029, 10, 23, 8, 30, 0);

type Arrival = 'normal' | 'late' | 'later-bad';
// When the bureau's upload starts (part of the file), ends, and when it writes the .done (minutes after midnight).
const ARRIVALS: Record<Arrival, { partial?: number; complete: number; done: number }> = {
  normal: { complete: 112, done: 113 },
  late: { partial: 156, complete: 159, done: 161 },
  'later-bad': { partial: 202, complete: 205, done: 206 },
};

const yymmdd = (ms: number) => new Date(ms).toISOString().slice(2, 10).replace(/-/g, '');
const clock = (ms: number) => new Date(ms).toISOString().slice(11, 16);
const isoDate = (runDate: string) => `20${runDate.slice(0, 2)}-${runDate.slice(2, 4)}-${runDate.slice(4, 6)}`;

/** The bureau's uploads (sftp into /srv/drop), minute by minute. */
function bureau(j: Shell, nights: { midnight: number; arrival: Arrival; night: Night }[]) {
  return (t: number) => {
    const drop = j.find(DROP);
    if (drop?.type !== 'directory') return;
    for (const n of nights) {
      const a = ARRIVALS[n.arrival];
      const minute = (t - n.midnight) / MINUTE;
      if (minute === a.partial) drop.children['contrib.ebc'] = dropped(ebcdicFile(n.night, 5), t);
      if (minute === a.complete) drop.children['contrib.ebc'] = dropped(ebcdicFile(n.night), t);
      if (minute === a.done) drop.children['contrib.ebc.done'] = doneFlag(t);
    }
  };
}

const sd = (j: Game) => systemd(j)!;
const shell = (j: Game) => j as Shell;

// The texts that decide what the night does: the units, the batch's scripts, the crontabs, what systemd has loaded.
function texts(j: Game, place: string): string[] {
  const n = j.find(place);
  if (n?.type !== 'directory') return [];
  return Object.entries((n as Directory).children).flatMap(([name, c]) => (c.type === 'directory' ? texts(j, `${place}/${name}`) : c.program || c.charset ? [] : [`${place}/${name}:${content(c, j)}`]));
}
function fingerprint(j: Game): string {
  const timers = Object.entries(sd(j).timers ?? {}).map(([n, m]) => [n, m.state, m.unit, m.calendar, m.afterBoot, m.afterLast]);
  const services = Object.entries(sd(j).services).filter(([, s]) => s.file).map(([n, s]) => [n, s.file]);
  return JSON.stringify([texts(j, '/etc/systemd/system'), texts(j, BATCH), texts(j, '/usr/local/bin'), j.state.crontabs ?? {}, timers, services]);
}
const scheduled = (j: Game) =>
  Object.values(sd(j).timers ?? {}).some((m) => m.state === 'active' && m.file.startsWith('/etc/')) ||
  Object.values((j.state.crontabs ?? {}) as Record<string, string>).some((t) => t.split('\n').some((l) => l.trim() && !l.trim().startsWith('#')));

/** What happened to one night's file, from the runs of CONTRIB. */
function verdict(j: Shell, n: Night, list: Run[], opts: { deadline: number; expected: number; alertsFrom?: { mails: number; log: number } }): { ok: boolean; lines: string[] } {
  const t = j.t;
  const lines: string[] = [];
  for (const r of list) lines.push(t('late-file-run', { time: clock(r.time), date: isoDate(r.runDate ?? '000000'), rc: String(r.rc) }));
  if (!list.length) lines.push(t('late-file-no-run'));
  const stale = list.filter((r) => r.runDate !== n.runDate);
  const own = list.filter((r) => r.runDate === n.runDate);
  const partial = own.filter((r) => r.rc === 12);
  const done = own.filter((r) => r.rc === opts.expected);
  let ok = false;
  if (stale.length) lines.push(t('late-file-verdict-stale'));
  else if (partial.length) lines.push(t('late-file-verdict-partial'));
  else if (!done.length) lines.push(t('late-file-verdict-none'));
  else if (done.length > 1) lines.push(t('late-file-verdict-twice', { count: done.length }));
  else if (done[0].time > opts.deadline) lines.push(t('late-file-verdict-too-late', { time: clock(done[0].time) }));
  else if (opts.alertsFrom) {
    const from = done[0].time;
    const mail = mails(j).slice(opts.alertsFrom.mails).find((m) => m.time >= from);
    const failed = sd(j).log.slice(opts.alertsFrom.log).find((e) => e.time >= from && /Failed with result/.test(e.message));
    if (mail) lines.push(t('late-file-verdict-mailed', { who: mail.a, time: clock(mail.time) }));
    else if (failed) lines.push(t('late-file-verdict-failed', { unit: failed.unit, time: clock(failed.time) }));
    else lines.push(t('late-file-verdict-silent'));
    ok = !!(mail || failed);
  } else {
    lines.push(t('late-file-verdict-ok'));
    ok = true;
  }
  return { ok, lines };
}

/** The rehearsal: the next two nights, the first file late, the second later and incomplete. */
function rehearsal(j: Shell): string {
  const s = sd(j);
  const start = s.clock;
  const a = Math.floor(start / DAY) * DAY + DAY;
  const b = a + DAY;
  const end = b + 7 * HOUR;
  const first = nightOf(yymmdd(a));
  const second = withLostRecord(nightOf(yymmdd(b)));
  const before = runs(j).length;
  const alertsFrom = { mails: mails(j).length, log: s.log.length };
  passTime(j, start, end, bureau(j, [
    { midnight: a, arrival: 'late', night: first },
    { midnight: b, arrival: 'later-bad', night: second },
  ]));
  s.clock = end + HOUR;
  const fresh = runs(j).slice(before).filter((r) => r.program === 'CONTRIB');
  const one = verdict(j, first, fresh.filter((r) => r.time < b), { deadline: a + 7 * HOUR, expected: 0 });
  const two = verdict(j, second, fresh.filter((r) => r.time >= b), { deadline: end, expected: 8, alertsFrom });
  j.state.rehearsals = ((j.state.rehearsals as number | undefined) ?? 0) + 1;
  if (one.ok) j.state.firstNightOk = true;
  if (two.ok) j.state.secondNightOk = true;
  if (one.ok && two.ok) j.state.rehearsalOk = true;
  return [
    j.t('late-file-rehearsal'),
    j.t('late-file-night-first', { date: isoDate(first.runDate), done: clock(a + ARRIVALS.late.done * MINUTE) }),
    ...one.lines.map((l) => `  ${l}`),
    j.t('late-file-night-second', { date: isoDate(second.runDate), done: clock(b + ARRIVALS['later-bad'].done * MINUTE) }),
    ...two.lines.map((l) => `  ${l}`),
    one.ok && two.ok ? '' : j.t('late-file-rehearsal-again'),
  ]
    .filter(Boolean)
    .join('\n');
}

const said = (j: Game, text: string) => j.last.output.includes(text) || j.last.errors.some((e) => e.includes(text));
const ran = (j: Game, command: string) => j.last.commands.some((c) => c.includes(command));

export const lateFile: Chapter = {
  id: 'late-file',
  number: 3,
  commands: [...COMMANDS_COMPILE, 'systemctl', 'journalctl', 'systemd-analyze', 'crontab', 'mail', 'date', 'chmod', 'sh', 'test', 'logger'],
  home: HOME,
  welcome: 'email_ayesha.txt',
  names: true,
  final: 'end',
  steps: ['diagnosed', 'first-night', 'second-night', 'end'],
  password: PASSWORD,
  accounts: batchAccounts,
  state: () => ({
    systemd: newSystemd('abacus', Date.UTC(2029, 10, 12, 8, 0, 0), SETUP, {
      ssh: { description: 'OpenBSD Secure Shell server', active: true, executable: 'sshd' },
      cron: { description: 'Regular background program processing daemon', active: true, executable: 'cron' },
    }),
    crontabs: {},
  }),
  // The two nights before the chapter: the timer at 02:00, the old wrapper; then Ayesha's morning.
  initialise: (game) => {
    const j = shell(game);
    const s = sd(j);
    loadUnits(j, s);
    const timer = s.timers!['night-batch'];
    Object.assign(timer, { state: 'active', active: true, since: SETUP });
    writeLog(s, 'night-batch.timer', 'systemd', 1, 'Started night-batch.timer - Run the nightly contributions batch at 02:00.');
    const thursday = Date.UTC(2029, 10, 22);
    const friday = Date.UTC(2029, 10, 23);
    passTime(j, s.clock, friday + 8 * HOUR + 10 * MINUTE, bureau(j, [
      { midnight: thursday, arrival: 'normal', night: nightOf('291122') },
      { midnight: friday, arrival: 'late', night: nightOf('291123') },
    ]));
    // 8:10: Ayesha runs the batch by hand on the right file, and takes the .done away.
    const who = j.who;
    j.who = 'batch';
    try {
      j.underCommand(`${BATCH}/bin/ebc2asc ${EBC} ${DAT}`, '/');
      j.underCommand(`${BATCH}/bin/contrib ${DAT} ${RPT}`, '/');
    } finally {
      j.who = who;
    }
    const drop = j.find(DROP) as Directory;
    delete drop.children['contrib.ebc.done'];
    s.clock = NOW;
    j.state.rehearsalFingerprint = fingerprint(j);
  },
  afterCommand: (game) => {
    const j = shell(game);
    sd(j).clock += 20_000;
    if (j.state.rehearsalOk || !scheduled(j) || j.state.rehearsalFingerprint === fingerprint(j)) return;
    j.state.rehearsalFingerprint = fingerprint(j);
    return rehearsal(j);
  },
  createWorld: (t) =>
    batchWorld(t, {
      home: { 'email_ayesha.txt': f(t('late-file-email-ayesha')) },
      drop: { 'contrib.ebc': dropped(ebcdicFile(nightOf('291121')), Date.UTC(2029, 10, 21, 1, 48, 0)) },
      in: { 'contrib.dat': f(asciiFile(nightOf('291121')), { lines: true, owner: 'batch', group: 'batch', mode: 'rw-rw-r--' }) },
      bin: { contrib: executable('CONTRIB') },
      src: { 'contrib.cob': f(contribCob(true), { lines: true, owner: 'batch', group: 'batch', mode: 'rw-rw-r--' }) },
      units: true,
    }),
  events: [
    {
      id: 'diagnosed',
      condition: (j) => (ran(j, 'journalctl') && said(j, 'RUN DATE 291122')) || (ran(j, 'stat') && j.last.line.includes('contrib.ebc') && said(j, '02:39')),
      message: (j) => j.t('late-file-event-diagnosed'),
    },
    { id: 'unscheduled', condition: (j) => !scheduled(j), message: (j) => j.t('late-file-event-unscheduled') },
    { id: 'first-night', condition: (j) => !!j.state.firstNightOk, message: (j) => j.t('late-file-event-first-night') },
    { id: 'second-night', condition: (j) => !!j.state.secondNightOk, message: (j) => j.t('late-file-event-second-night') },
    { id: 'end', condition: (j) => !!j.state.rehearsalOk, message: (j) => j.t('late-file-event-end') },
  ],
};

