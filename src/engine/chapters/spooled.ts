// Story "The Order Book" — chapter "Paper Nobody Prints": QSYSOPR warns
// that the system ASP has passed its threshold (CPF0907, 91 %). No big file
// to delete as on Linux: what fills the disk is printed output nobody
// prints. For two years, ORDPICK has written a debug listing for each
// order (Margit turned it on to chase a bug, data area ORDERS/ORDDEBUG),
// into the printer file DBGLIST, held and saved: 18,000 spooled files in
// the shared output queue QPRINT, next to this morning's invoices.
//   - WRKSYSSTS: % system ASP used; WRKOUTQ: QPRINT and its files;
//     WRKSPLF SELECT(ORDBATCH): DBGLIST, user data ORDPICKDBG, status HLD;
//   - delete only those: DLTSPLF FILE(*SELECT) SELECT(ORDBATCH *ALL *ALL
//     ORDPICKDBG) (or job by job);
//   - stop the cause: CHGDTAARA DTAARA(ORDERS/ORDDEBUG) VALUE('N').
// False leads: CLROUTQ QPRINT, or DLTSPLF of all ORDBATCH's files, delete
// the invoices still to print (recreated by resubmitting ORDINV, as
// Margit's notes say); deleting without turning the debug off fills it
// again.
// Objective checked on the state: no DBGLIST left, the 31 invoices in
// QPRINT, ORDDEBUG off, the ASP under its threshold.
// Sources: https://www.ibm.com/docs/en/i/7.5?topic=ssw_ibm_i_75/cl/dltsplf.html,
// https://www.ibm.com/docs/en/i/7.5?topic=ssw_ibm_i_75/cl/clroutq.html,
// https://www.ibm.com/docs/en/i/7.5?topic=ssw_ibm_i_75/cl/wrksyssts.html,
// https://www.ibm.com/docs/en/i/7.5?topic=ssw_ibm_i_75/cl/chgdtaara.html

import { f, type Chapter } from '../world';
import type { Game } from '../shell';
import { aspUsed, endJob, ibmi, send } from '../ibmi';
import { ALL_ORDERS, HOME, INVOICES, PASE_COMMANDS, PASSWORD, invoices, listings, millAccounts, millState, millWorld, sieveHost, clInPase } from './order-book';

const said = (j: Game, text: string) => j.last.output.includes(text) || j.last.errors.some((e) => e.includes(text));
const debugLeft = (j: Game) => ibmi(j).spool.some((g) => g.file === 'DBGLIST');
const invoicesLeft = (j: Game) => ibmi(j).spool.filter((g) => g.file === 'INVOICE').reduce((t, g) => t + g.count, 0);
const switchedOff = (j: Game) => ibmi(j).dataAreas['ORDERS/ORDDEBUG'].value !== 'Y';

export const spooled: Chapter = {
  id: 'spooled',
  number: 2,
  commands: PASE_COMMANDS,
  home: HOME,
  welcome: 'email_kwame.txt',
  names: true,
  final: 'end',
  steps: ['storage', 'culprit', 'cleaned', 'switched-off', 'end'],
  password: PASSWORD,
  accounts: millAccounts,
  hosts: { sieve: sieveHost() },
  state: (t) =>
    millState(t, {
      time: '08:05:31',
      orders: ALL_ORDERS(),
      spool: [...listings(), invoices()],
      programs: {
        // ORDINV prints the invoices of the open orders again (Margit's notes).
        'ORDERS/ORDINV': (g, j) => {
          const s = ibmi(g);
          if (!s.spool.some((x) => x.file === 'INVOICE')) s.spool.push({ ...invoices(), job: `${j.number}/${j.user}/${j.name}`, user: j.user });
          endJob(g, j, 0);
        },
      },
    }),
  initialise: (game) => {
    const s = ibmi(game);
    send(game, 'QSYSOPR', {
      id: 'CPF0907',
      type: 'Information',
      severity: 80,
      text: 'Serious storage condition may exist. Press HELP.',
      cause: `The amount of storage used in the system auxiliary storage pool (ASP 1) has reached the threshold value of ${s.asp.threshold} percent. If the system ASP is filled, the system may end abnormally.`,
      recovery: 'Reduce the amount of storage used: delete objects that are no longer needed (old spooled files, journal receivers, save files…), or add storage. Use WRKSYSSTS to see the percentage used.',
      from: '000000/QSYS/QSYSARB',
      sent: `${s.date}  05:12:40`,
    });
  },
  createWorld: (t) =>
    millWorld(t, {
      'email_kwame.txt': f(t('spooled-email-kwame')),
      'notes-margit.txt': f(t('order-book-notes-margit'), { lines: true }),
    }),
  events: [
    { id: 'cl-in-pase', condition: clInPase, message: (j) => j.t('order-book-event-cl-in-pase') },
    { id: 'storage', condition: (j) => said(j, '% system ASP used') || said(j, 'Serious storage condition'), message: (j) => j.t('spooled-event-storage') },
    { id: 'culprit', condition: (j) => said(j, 'ORDPICKDBG'), message: (j) => j.t('spooled-event-culprit') },
    { id: 'flag', condition: (j) => said(j, 'ORDDEBUG') && said(j, 'Display Data Area'), message: (j) => j.t('spooled-event-flag') },
    { id: 'invoices-lost', condition: (j) => invoicesLeft(j) < INVOICES, message: (j) => j.t('spooled-event-invoices-lost') },
    { id: 'cleaned', condition: (j) => !debugLeft(j), message: (j) => j.t('spooled-event-cleaned') },
    { id: 'switched-off', condition: switchedOff, message: (j) => j.t('spooled-event-switched-off') },
    {
      id: 'end',
      condition: (j) => !debugLeft(j) && switchedOff(j) && invoicesLeft(j) >= INVOICES && aspUsed(j) < ibmi(j).asp.threshold,
      message: (j) => j.t('spooled-event-end'),
    },
  ],
};
