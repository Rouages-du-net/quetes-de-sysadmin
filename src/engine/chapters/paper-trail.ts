// Story "The Staff Room", chapter "The Paper Trail": in November Darius,
// the previous admin, debugged the MFP with LogLevel debug2 and MaxLogSize 0
// and never put them back; he also removed logrotate's cups-daemon file
// (its prerotate stops cupsd at midnight). The error_log has grown to
// 3.9 GB and /var is almost full. Worse, at debug2 cupsd writes every job's
// name, and the school's job names hold pupils' names (reports, support
// plans, medical forms); CUPS keeps every job's history (PreserveJobHistory
// Yes) and here every document too (PreserveJobFiles Yes); JobPrivateValues
// none shows the titles to anyone who asks; anyone may cancel anyone's job
// (no Require in the Cancel-Job limit); and the admin pages answer from the
// whole school (Allow @LOCAL in /admin). The school's data protection
// officer asks for a week of history at most and no documents kept.
// Objective checked on the state, with the configuration running: LogLevel
// warn (or error, notice, info), a rotation (MaxLogSize between 1 byte and
// 100m, or a logrotate file for /var/log/cups), the logs under 50 MB, a job
// history of at most 7 days and documents at most a day, the old jobs and
// files forgotten, JobPrivateValues hiding names and titles, Cancel-Job for
// the owner and administrators only, /admin from localhost only, and the
// staff still printing (and the pupils on the library's printer).
// Several ways: cupsctl (--no-debug-logging, --no-remote-admin,
// --no-user-cancel-any, MaxLogSize=1m, PreserveJobHistory=1w,
// PreserveJobFiles=No, JobPrivateValues=default) or nano and a restart;
// the old log removed or truncated, or logrotate.
// False leads: LogLevel lowered without a restart, the big error_log
// rotated into error_log.O (it still takes the space), rm in the spool,
// cancel -a -x (everyone's current jobs), a broken cupsd.conf (cupsd won't
// start), the whole server closed (the staff can't print).
// Sources: https://www.cups.org/doc/man-cupsd.conf.html (LogLevel, MaxLogSize,
// PreserveJobHistory, PreserveJobFiles, JobPrivateValues, Policy),
// https://www.cups.org/doc/man-cupsctl.html, https://www.cups.org/doc/policies.html,
// https://www.cups.org/doc/man-cupsd-logs.html.

import type { Chapter } from '../world';
import type { Game } from '../shell';
import { FINISHED, LOG_DIR, access, appendLog, confApplied, cups, directive, isAdmin, logDate, mayCancel, privateValues, reaches, running, sizeValue, timeValue, verdict, type Job } from '../cups';
import { CHROMEBOOK, HOME, PASSWORD, STAFF_PC, chalkAccounts, chalkState, chalkWorld, initialiseChalk, now, passTime, seen, typed, type Traffic } from './staff-room';

const DAY = 86_400_000;
const MB = 1024 * 1024;
const conf = (j: Game) => cups(j).conf;
const logLevelOk = (j: Game) => ['warn', 'error', 'notice', 'info'].includes(directive(conf(j), 'LogLevel').toLowerCase());
const rotation = (j: Game) => {
  const max = sizeValue(directive(conf(j), 'MaxLogSize'));
  const logrotate = j.find('/etc/logrotate.d');
  const byLogrotate = logrotate?.type === 'directory' && Object.keys(logrotate.children).some((n) => /\/var\/log\/cups/.test(j.read(`/etc/logrotate.d/${n}`) ?? ''));
  return (max > 0 && max <= 100 * MB) || byLogrotate;
};
const logBytes = (j: Game) => {
  const d = j.find(LOG_DIR);
  return d?.type === 'directory' ? Object.values(d.children).reduce((t, n) => t + (n.type === 'file' ? (n.size ?? (typeof n.content === 'string' ? n.content.length : 0)) : 0), 0) : 0;
};
const keepsOk = (j: Game) => timeValue(directive(conf(j), 'PreserveJobHistory')) <= 7 * DAY && timeValue(directive(conf(j), 'PreserveJobFiles')) <= DAY;
const forgotten = (j: Game) =>
  cups(j).jobs.every((x) => x.completed === undefined || now(j) - x.completed < 7 * DAY + 60_000) &&
  cups(j).jobs.every((x) => x.completed === undefined || x.noFile || now(j) - x.completed <= DAY + 60_000);
const privateOk = (j: Game) => ['job-name', 'job-originating-user-name'].every((v) => privateValues(conf(j)).includes(v));
const someone = (user: string): Job => ({ id: 0, printer: 'staffroom', user, title: '', size: 0, pages: 1, printed: 0, state: 'pending', host: STAFF_PC, created: 0 });
const cancelOk = (j: Game) => !mayCancel(j, 'sven', someone('amara')) && mayCancel(j, 'amara', someone('amara')) && isAdmin(j, 'root') && mayCancel(j, 'root', someone('amara'));
const adminClosed = (j: Game) => !reaches(j, STAFF_PC, '/admin') && !reaches(j, CHROMEBOOK, '/admin');
const printing = (j: Game) => running(j) && verdict(j, { from: STAFF_PC, user: 'amara', printer: 'staffroom' }) === null && verdict(j, { from: CHROMEBOOK, user: 'pupil', printer: 'library' }) === null;

const TRAFFIC: Traffic[] = [
  { from: STAFF_PC, user: 'amara', printer: () => 'staffroom', title: 'report-autumn-Rosa-P.pdf', pages: 3 },
  { from: CHROMEBOOK, user: 'pupil', printer: () => 'library', title: 'poster-rainforest.pdf', pages: 1 },
  { from: '198.51.100.29', user: 'leila', printer: () => 'office', title: 'support-plan-Omar-H.pdf', pages: 5 },
];

/** A minute passes; at debug2 the error_log grows by megabytes; a Chromebook looks at /admin. */
function afterCommand(j: Game) {
  passTime(j, TRAFFIC);
  if (running(j) && directive(conf(j), 'LogLevel').toLowerCase() === 'debug2') appendLog(j, 'error_log', [`d ${logDate(now(j))} cupsdDoSelect: polling 12 fds for 1 seconds...`], 3 * MB);
  if (running(j) && (j.state.minutes as number) % 2 === 0) access(j, CHROMEBOOK, 'GET', '/admin', reaches(j, CHROMEBOOK, '/admin') ? 200 : 403, '-', '-');
}

export const paperTrail: Chapter = {
  id: 'paper-trail',
  number: 3,
  commands: ['ls', 'cd', 'pwd', 'cat', 'less', 'head', 'tail', 'grep', 'nano', 'sudo', 'rm', 'truncate', 'df', 'du', 'logrotate', 'systemctl', 'journalctl', 'lpstat', 'cancel', 'cupsctl', 'cupsd', 'curl', 'exit'],
  home: HOME,
  welcome: 'message_from_ines.txt',
  names: true,
  final: 'end',
  steps: ['big-log', 'names', 'history', 'loglevel', 'rotation', 'small', 'kept', 'private', 'cancel-policy', 'admin-closed', 'end'],
  password: PASSWORD,
  accounts: chalkAccounts,
  state: () => chalkState(3),
  initialise: initialiseChalk,
  createWorld: (t) =>
    chalkWorld(3, {
      'message_from_ines.txt': t('paper-trail-message-ines'),
      'dpo_request.txt': t('paper-trail-dpo-request'),
    }),
  afterCommand,
  events: [
    { id: 'big-log', condition: (j) => seen(j, /\b3[.,]9G\b/) || seen(j, /\/dev\/vda3 .* [89]\d% \/var/), message: (j) => j.t('paper-trail-event-big-log') },
    { id: 'names', condition: (j) => seen(j, 'job-name="'), message: (j) => j.t('paper-trail-event-names') },
    { id: 'history', condition: (j) => seen(j, /staffroom-1188 /) || seen(j, /d01188-001/), message: (j) => j.t('paper-trail-event-history') },
    { id: 'not-applied', condition: (j) => running(j) && !confApplied(j) && /cupsd\.conf/.test(typed(j)), message: (j) => j.t('paper-trail-event-not-applied') },
    { id: 'stopped', condition: (j) => !running(j), message: (j) => j.t('paper-trail-event-stopped') },
    { id: 'loglevel', condition: (j) => confApplied(j) && logLevelOk(j), message: (j) => j.t('paper-trail-event-loglevel') },
    { id: 'rotation', condition: (j) => confApplied(j) && rotation(j), message: (j) => j.t('paper-trail-event-rotation') },
    { id: 'rotated-o', condition: (j) => (j.find(`${LOG_DIR}/error_log.O`)?.type === 'file' && logBytes(j) > 1000 * MB) || false, message: (j) => j.t('paper-trail-event-rotated-o') },
    { id: 'small', condition: (j) => logBytes(j) < 50 * MB, message: (j) => j.t('paper-trail-event-small') },
    { id: 'kept', condition: (j) => confApplied(j) && keepsOk(j) && forgotten(j), message: (j) => j.t('paper-trail-event-kept') },
    { id: 'private', condition: (j) => confApplied(j) && privateOk(j), message: (j) => j.t('paper-trail-event-private') },
    { id: 'cancel-policy', condition: (j) => confApplied(j) && cancelOk(j), message: (j) => j.t('paper-trail-event-cancel-policy') },
    { id: 'admin-closed', condition: (j) => confApplied(j) && adminClosed(j) && printing(j), message: (j) => j.t('paper-trail-event-admin-closed') },
    { id: 'cancel-all', condition: (j) => cups(j).jobs.some((x) => x.id >= 1222 && x.state === 'canceled' && FINISHED.includes(x.state)), message: (j) => j.t('paper-trail-event-cancel-all') },
    { id: 'broke-printing', condition: (j) => running(j) && !printing(j), message: (j) => j.t('paper-trail-event-broke-printing') },
    {
      id: 'end',
      condition: (j) => confApplied(j) && logLevelOk(j) && rotation(j) && logBytes(j) < 50 * MB && keepsOk(j) && forgotten(j) && privateOk(j) && cancelOk(j) && adminClosed(j) && printing(j),
      message: (j) => j.t('paper-trail-event-end'),
    },
  ],
};
