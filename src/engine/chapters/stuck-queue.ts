// Story "The Staff Room", chapter "The Stuck Queue": Monday morning,
// nothing prints. On Friday at 16:00 the office laser jammed and Joe the
// caretaker switched it off; at 16:05 Sven sent the yearbook proofs at full
// resolution, 900 pages and 3.6 GB. The ipp backend could not reach the
// printer, gave up, and with ErrorPolicy stop-printer (the default) cupsd
// stopped the queue: Monday's jobs pile up behind the yearbook, and the
// spool fills /var. You read the queue (lpstat -t, lpq), the error_log
// (the failed job's debug history), find the runaway job, cancel it and
// only it, purge its file (cancel -x: PreserveJobFiles keeps a day of
// documents), and enable the queue again (cupsenable).
// Objective checked on the state: the office queue enabled and accepting,
// job 117 cancelled (or aborted) and its document gone from the spool,
// every colleague's document still to print or printed, at least one
// printed. Several ways: cancel -x 117, or cancel 117 then cancel -x 117,
// lprm then cancel -x; cupsenable, or cupsd stopped, printers.conf edited,
// cupsd started.
// False leads: cancel -a (everyone's jobs: they send them again, grumbling),
// restarting cups (the queue stays stopped: cupsd remembers it in
// printers.conf), rm in /var/spool/cups (cupsd still counts on the job),
// printers.conf edited while cupsd runs (cupsd writes over it), cupsenable
// before cancelling (900 pages come out).
// Sources: https://www.cups.org/doc/man-lpstat.html, https://www.cups.org/doc/man-cancel.html,
// https://www.cups.org/doc/man-cupsenable.html, https://www.cups.org/doc/man-cupsd.conf.html
// (ErrorPolicy, PreserveJobFiles, LogDebugHistory), https://www.cups.org/doc/man-printers.conf.html.

import type { Chapter } from '../world';
import type { Game } from '../shell';
import { FINISHED, active, cups, editedByHand, hasDocument, running, submit } from '../cups';
import { COLLEAGUES, HOME, PASSWORD, YEARBOOK, chalkAccounts, chalkState, chalkWorld, enabled, initialiseChalk, passTime, seen, typed } from './staff-room';

const yearbook = (j: Game) => cups(j).jobs.find((x) => x.id === YEARBOOK);
const office = (j: Game) => cups(j).printers.office;
const lost = (j: Game) => cups(j).jobs.some((x) => x.lost);
// The colleagues' documents: each still queued or printed.
const kept = (j: Game) =>
  COLLEAGUES.every((title) => cups(j).jobs.some((x) => x.title === title && x.id !== YEARBOOK && ['pending', 'processing', 'completed'].includes(x.state) && !x.lost));
const printedOne = (j: Game) => cups(j).jobs.some((x) => x.id !== YEARBOOK && x.state === 'completed' && COLLEAGUES.includes(x.title));
const yearbookGone = (j: Game) => {
  const y = yearbook(j);
  return !y || (['canceled', 'aborted'].includes(y.state) && !hasDocument(j, y));
};

/** A colleague whose job someone else cancelled sends it again (once). */
function resend(j: Game) {
  const done: number[] = (j.state.resent ??= []);
  for (const x of [...cups(j).jobs])
    if (x.id !== YEARBOOK && x.id < 125 && x.state === 'canceled' && !done.includes(x.id)) {
      done.push(x.id);
      if (!active(cups(j)).some((y) => y.title === x.title && y.user === x.user)) submit(j, { from: x.host, user: x.user, printer: 'office', title: x.title, pages: x.pages, size: x.size });
    }
}

export const stuckQueue: Chapter = {
  id: 'stuck-queue',
  number: 1,
  commands: ['ls', 'cd', 'pwd', 'cat', 'less', 'head', 'tail', 'grep', 'nano', 'sudo', 'rm', 'df', 'du', 'systemctl', 'journalctl', 'lpstat', 'lpq', 'lp', 'lpr', 'cancel', 'lprm', 'cupsenable', 'cupsdisable', 'cupsaccept', 'cupsreject', 'exit'],
  home: HOME,
  welcome: 'message_from_ines.txt',
  names: true,
  final: 'end',
  steps: ['queue', 'error-log', 'jobs', 'canceled', 'purged', 'enabled', 'end'],
  password: PASSWORD,
  accounts: chalkAccounts,
  state: () => chalkState(1),
  initialise: initialiseChalk,
  createWorld: (t) =>
    chalkWorld(1, {
      'message_from_ines.txt': t('stuck-queue-message-ines'),
      'note_from_joe.txt': t('stuck-queue-note-joe'),
    }),
  afterCommand: (j) => {
    passTime(j);
    resend(j);
  },
  events: [
    { id: 'queue', condition: (j) => seen(j, /printer office disabled since/) || seen(j, 'office is not ready'), message: (j) => j.t('stuck-queue-event-queue') },
    { id: 'error-log', condition: (j) => seen(j, 'Unable to connect to printer; will retry in 30 seconds'), message: (j) => j.t('stuck-queue-event-error-log') },
    { id: 'jobs', condition: (j) => seen(j, /office-117 +sven +3650000896/) || seen(j, /117 +yearbook-2029-proofs\.pdf/), message: (j) => j.t('stuck-queue-event-jobs') },
    { id: 'disk', condition: (j) => seen(j, /\/dev\/vda3 .* (8|9)\d% \/var/), message: (j) => j.t('stuck-queue-event-disk') },
    { id: 'cancel-all', condition: (j) => cups(j).jobs.some((x) => x.id !== YEARBOOK && x.id < 125 && x.state === 'canceled'), message: (j) => j.t('stuck-queue-event-cancel-all') },
    { id: 'hand-rm', condition: lost, message: (j) => j.t('stuck-queue-event-hand-rm') },
    { id: 'edited', condition: (j) => running(j) && editedByHand(j), message: (j) => j.t('stuck-queue-event-edited') },
    { id: 'edit-lost', condition: (j) => j.flags.has('edited') && !editedByHand(j) && office(j)?.state === 'stopped', message: (j) => j.t('stuck-queue-event-edit-lost') },
    { id: 'restart-only', condition: (j) => /systemctl\s+(re)?start\s+cups\b/.test(typed(j)) && running(j) && office(j)?.state === 'stopped', message: (j) => j.t('stuck-queue-event-restart-only') },
    { id: 'yearbook-printing', condition: (j) => yearbook(j)?.state === 'processing', message: (j) => j.t('stuck-queue-event-yearbook-printing', { pages: String(Math.round(yearbook(j)!.printed)) }) },
    { id: 'canceled', condition: (j) => FINISHED.includes(yearbook(j)?.state ?? 'pending') && hasDocument(j, yearbook(j)!), message: (j) => j.t('stuck-queue-event-canceled') },
    { id: 'purged', condition: (j) => yearbookGone(j), message: (j) => j.t('stuck-queue-event-purged') },
    { id: 'enabled', condition: (j) => enabled(office(j)) && kept(j), message: (j) => j.t('stuck-queue-event-enabled') },
    {
      id: 'end',
      condition: (j) => running(j) && enabled(office(j)) && yearbookGone(j) && kept(j) && printedOne(j),
      message: (j) => j.t('stuck-queue-event-end'),
    },
  ],
};
