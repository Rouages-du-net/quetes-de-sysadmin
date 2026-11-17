// Story "The Order Book" — chapter "Waiting for a Reply": at 07:40 the
// picking lists aren't printed. The night's import (job ORDIMPORT, in
// QBATCH) has been in MSGW since 02:14: it asked the operator a question,
// and nobody answered; behind it, QBATCH's job queue waits (ORDPICK,
// ACCTEXP: one batch job at a time).
//   - WRKACTJOB: ORDIMPORT in MSGW; WRKJOBQ QBATCH: the jobs behind it;
//   - DSPMSG QSYSOPR: the inquiry RNQ1218 "Unable to allocate a record in
//     file ORDHDR (R C G D F)"; its help (F1, here ?): another job holds the
//     record; the job log (DSPJOBLOG) names it: CPF5027, Soraya's session
//     QPADEV0004, left last evening on order 1847 (DSPRCDLCK, WRKOBJLCK);
//   - release the record (ENDJOB on Soraya's session: she had changed
//     nothing), then reply R: the import goes on, ends normally, and the
//     queue runs.
// False leads: R while the record is still held (the same question comes
// back), ENDJOB on the import or C (the night's run is lost: resubmit it
// with SBMJOB), G (order 1847's change is skipped).
// Objective checked on the state: every incoming order in ORDHDR, 1847
// changed, no job waiting for a reply, the job queue empty, the web
// receiver still running.
// Sources: https://www.ibm.com/docs/en/i/7.5?topic=messages-inquiry,
// https://www.ibm.com/docs/en/i/7.5?topic=ssw_ibm_i_75/cl/dspmsg.html,
// https://www.ibm.com/docs/en/i/7.5?topic=ssw_ibm_i_75/cl/endjob.html,
// https://www.ibm.com/docs/en/i/7.5?topic=ssw_ibm_i_75/cl/dsprcdlck.html

import { f, type Chapter } from '../world';
import type { Game } from '../shell';
import { ibmi, send, type IbmiJob } from '../ibmi';
import { CHANGED, CHANGED_RRN, HOME, IMPORT_NUMBER, OPEN, PASE_COMMANDS, PASSWORD, SORAYA_JOB, imported, importState, millAccounts, millState, millWorld, order, runImport, sieveHost, clInPase } from './order-book';

const said = (j: Game, text: string) => j.last.output.includes(text) || j.last.errors.some((e) => e.includes(text));
const importJobs = (j: Game) => ibmi(j).jobs.filter((x) => x.name === 'ORDIMPORT');
const sorayaGone = (j: Game) => !ibmi(j).jobs.some((x) => x.name === SORAYA_JOB.name);
const ended = (j: Game, name: string) => ((j.state.ibmiEnded as string[] | undefined) ?? []).some((x) => x.endsWith(`/${name}`));
const replied = (j: Game, r: string) => ((j.state.ibmiReplies as string[] | undefined) ?? []).includes(`RNQ1218:${r}`);
const done = (j: Game) =>
  imported(j) && !importJobs(j).some((x) => x.status === 'MSGW') && !ibmi(j).jobq.length && ibmi(j).jobs.some((x) => x.name === 'ORDWEB');

export const inquiry: Chapter = {
  id: 'inquiry',
  number: 1,
  commands: PASE_COMMANDS,
  home: HOME,
  welcome: 'email_kwame.txt',
  names: true,
  final: 'end',
  steps: ['msgw', 'inquiry', 'cause', 'released', 'end'],
  password: PASSWORD,
  accounts: millAccounts,
  hosts: { sieve: sieveHost() },
  state: (t) =>
    millState(t, {
      time: '02:14:07',
      orders: OPEN.map((no) => order(no)),
      jobs: [
        {
          ...SORAYA_JOB,
          type: 'INT',
          subsystem: 'QINTER',
          status: 'DSPW',
          function: 'PGM-ORDENT',
          cpu: '.0',
          log: [],
          locks: [
            { object: 'ORDERS/ORDHDR', type: '*FILE', state: '*SHRUPD' },
            { object: 'ORDERS/ORDHDR', type: '*FILE', state: '*SHRUPD', record: CHANGED_RRN },
          ],
        },
      ],
      jobq: [
        { number: '412908', user: 'ORDBATCH', name: 'ORDPICK', status: 'RLS', jobq: 'QBATCH', program: 'ORDERS/ORDPICK' },
        { number: '412909', user: 'ACCOUNTS', name: 'ACCTEXP', status: 'RLS', jobq: 'QBATCH', program: 'ORDERS/ACCTEXP' },
        { number: '412911', user: 'ORDBATCH', name: 'ORDINV', status: 'RLS', jobq: 'QBATCH', program: 'ORDERS/ORDINV' },
      ],
      programs: { 'ORDERS/ORDIMP': (g, j) => runImport(g, j, true) },
    }),
  // The night: the import started at 02:00 and stopped at 02:14 on order 1847.
  initialise: (game) => {
    const s = ibmi(game);
    send(game, 'QSYSOPR', { id: 'CPF1124', type: 'Information', severity: 0, text: `Job ${IMPORT_NUMBER}/ORDBATCH/ORDIMPORT started on ${s.date} at 02:00:01 in subsystem QBATCH in QSYS.`, from: `${IMPORT_NUMBER}/ORDBATCH/ORDIMPORT`, sent: `${s.date}  02:00:01` });
    const job: IbmiJob = { number: IMPORT_NUMBER, user: 'ORDBATCH', name: 'ORDIMPORT', type: 'BCH', subsystem: 'QBATCH', status: 'RUN', function: 'PGM-ORDIMP', cpu: '.0', log: [] };
    job.log.push({ id: 'CPF1124', type: 'Information', severity: 0, text: `Job ${IMPORT_NUMBER}/ORDBATCH/ORDIMPORT started on ${s.date} at 02:00:01 in subsystem QBATCH in QSYS.`, from: `${IMPORT_NUMBER}/ORDBATCH/ORDIMPORT`, sent: `${s.date}  02:00:01` });
    s.jobs.push(job);
    importState(game).applied = 0;
    runImport(game, job);
    s.time = '07:42:10';
  },
  createWorld: (t) =>
    millWorld(t, {
      'email_kwame.txt': f(t('inquiry-email-kwame')),
      'notes-margit.txt': f(t('order-book-notes-margit'), { lines: true }),
    }),
  events: [
    { id: 'cl-in-pase', condition: clInPase, message: (j) => j.t('order-book-event-cl-in-pase') },
    { id: 'linux-habit', condition: (j) => ['systemctl: command not found', 'top: command not found', 'journalctl: command not found'].some((x) => said(j, x)), message: (j) => j.t('inquiry-event-linux-habit') },
    { id: 'msgw', condition: (j) => said(j, 'ORDIMPORT') && said(j, 'MSGW'), message: (j) => j.t('inquiry-event-msgw') },
    { id: 'queue', condition: (j) => said(j, 'ORDPICK') && said(j, 'Work with Job Queue'), message: (j) => j.t('inquiry-event-queue') },
    { id: 'inquiry', condition: (j) => said(j, 'Unable to allocate a record in file ORDHDR'), message: (j) => j.t('inquiry-event-inquiry') },
    { id: 'cause', condition: (j) => said(j, `in use by job ${SORAYA_JOB.number}`) || (said(j, 'QPADEV0004') && said(j, 'HELD')), message: (j) => j.t('inquiry-event-cause') },
    { id: 'retry-locked', condition: (j) => !!importState(j).retriedLocked, message: (j) => j.t('inquiry-event-retry-locked') },
    { id: 'killed', condition: (j) => ended(j, 'ORDIMPORT'), message: (j) => j.t('inquiry-event-killed') },
    { id: 'cancelled', condition: (j) => ['C', 'D', 'F'].some((r) => replied(j, r)), message: (j) => j.t('inquiry-event-cancelled') },
    { id: 'skipped', condition: (j) => replied(j, 'G'), message: (j) => j.t('inquiry-event-skipped') },
    { id: 'web-ended', condition: (j) => ended(j, 'ORDWEB'), message: (j) => j.t('inquiry-event-web-ended') },
    { id: 'released', condition: sorayaGone, message: (j) => j.t('inquiry-event-released') },
    { id: 'end', condition: done, message: (j) => j.t('inquiry-event-end') },
  ],
};

export { CHANGED };
