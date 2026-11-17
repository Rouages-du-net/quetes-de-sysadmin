// Story "The Order Book" — chapter "Saved, Except One": the new reporting
// server, sieve (Debian), wants the open orders as CSV every morning. But
// first, the night's save: job NIGHTSAV "completed normally", and yet…
//   - DSPLOG (the history log QHST), DSPSAVF BACKUP/ORDERS: CPF3771, one
//     object not saved: ORDHDR, the orders themselves, in use (CPF3202) by
//     the web receiver ORDWEB, which keeps it open day and night
//     (WRKOBJLCK);
//   - save again: SAVLIB LIB(ORDERS) DEV(*SAVF) SAVF(BACKUP/ORDERS)
//     SAVACT(*LIB) (save-while-active), CLEAR(*ALL) or reply G to CPA4067;
//     or ENDSBS ORDSBS, save, STRSBS ORDERS/ORDSBS (the bakeries can't
//     order meanwhile);
//   - export: CPYTOIMPF FROMFILE(ORDERS/ORDHDR) TOSTMF('/home/you/orders.csv')
//     STMFCCSID(1208) RCDDLM(*LF), then scp to sieve:/srv/reports/inbox/.
// False leads: CPYTOIMPF's default CCSID (*STMF: a new file takes the
// table's, 37, EBCDIC), *PCASCII (Windows-1252: accents as � on sieve);
// MBROPT(*ADD), the default, run twice: every order twice.
// Objective checked on the state: a complete save of ORDERS (ORDHDR
// included), ORDSBS active, and on sieve a CSV in UTF-8 with every order
// once, accents intact.
// Sources: https://www.ibm.com/docs/en/i/7.5?topic=ssw_ibm_i_75/cl/savlib.html,
// https://www.ibm.com/docs/en/i/7.5?topic=ssw_ibm_i_75/cl/cpytoimpf.html,
// https://www.ibm.com/docs/en/i/7.5?topic=information-save-while-active,
// https://www.ibm.com/docs/en/i/7.5?topic=ssw_ibm_i_75/cl/dsplog.html

import { f, type Chapter } from '../world';
import type { Game } from '../shell';
import { ibmi } from '../ibmi';
import { ALL_ORDERS, CUSTOMERS, HOME, INBOX, PASE_COMMANDS, PASSWORD, millAccounts, millState, millWorld, ordersObjects, sieve, sieveHost, clInPase } from './order-book';

const said = (j: Game, text: string) => j.last.output.includes(text) || j.last.errors.some((e) => e.includes(text));

/** Last night's save: everything but ORDHDR. */
const lastNight = () => ({
  library: 'ORDERS',
  objects: ordersObjects().filter((o) => o.name !== 'ORDHDR'),
  date: '11/19/29',
  time: '23:04:10',
  savact: '*NO',
});

const complete = (j: Game) =>
  Object.values(ibmi(j).savf).some((x) => !!x && x.library === 'ORDERS' && x.date === ibmi(j).date && x.objects.some((o) => o.name === 'ORDHDR') && x.objects.length === ordersObjects().length);
const webUp = (j: Game) => ibmi(j).subsystems.find((x) => x.name === 'ORDSBS')?.status === 'ACTIVE' && ibmi(j).jobs.some((x) => x.name === 'ORDWEB');

/** A received file: UTF-8, every order once, the bakeries' names intact. */
export function goodCsv(text: string, charset: string | undefined): 'ok' | 'ebcdic' | 'latin1' | 'duplicates' | 'missing' | 'not-csv' {
  if (charset === 'binary') return 'ebcdic';
  if (charset === 'latin1') return 'latin1';
  const lines = text.split(/\r?\n/).filter((l) => /^\d+,/.test(l));
  if (!lines.length) return 'not-csv';
  const numbers = lines.map((l) => Number(l.split(',')[0]));
  const orders = ALL_ORDERS().map((r) => r[0] as number);
  if (numbers.length > new Set(numbers).size) return 'duplicates';
  if (!orders.every((n) => numbers.includes(n)) || !CUSTOMERS.every(([, name]) => text.includes(name))) return 'missing';
  return 'ok';
}

/** What arrived in sieve's inbox: the verdict on each file. */
const received = (j: Game) => {
  const s = sieve(j);
  const inbox = s?.find(INBOX);
  if (!s || inbox?.type !== 'directory') return [];
  return Object.values(inbox.children).flatMap((n) => (n.type === 'file' ? [goodCsv(typeof n.content === 'string' ? n.content : '', n.charset)] : []));
};
const exportedIn = (j: Game, ccsids: number[]) => Object.values(ibmi(j).stmf).some((c) => ccsids.includes(c));

export const saveFile: Chapter = {
  id: 'save-file',
  number: 3,
  commands: [...PASE_COMMANDS, 'scp', 'ssh'],
  home: HOME,
  welcome: 'email_kwame.txt',
  names: true,
  final: 'end',
  steps: ['not-saved', 'in-use', 'saved', 'exported', 'end'],
  password: PASSWORD,
  accounts: millAccounts,
  hosts: { sieve: sieveHost() },
  state: (t) =>
    millState(t, {
      time: '09:12:48',
      orders: ALL_ORDERS(),
      debug: 'N',
      aspBase: 57.9,
      savf: { 'BACKUP/ORDERS': lastNight() },
      history: [
        { id: 'CPF1124', text: 'Job 412602/QSECOFR/NIGHTSAV started on 11/19/29 at 23:00:00 in subsystem QBATCH in QSYS.', date: '11/19/29', time: '23:00:00', job: '412602/QSECOFR/NIGHTSAV' },
        { id: 'CPF3202', text: 'File ORDHDR in library ORDERS in use.', date: '11/19/29', time: '23:04:09', job: '412602/QSECOFR/NIGHTSAV' },
        { id: 'CPF3741', text: 'FILE ORDHDR in ORDERS not saved.', date: '11/19/29', time: '23:04:09', job: '412602/QSECOFR/NIGHTSAV' },
        { id: 'CPF3771', text: '15 objects saved from ORDERS. 1 not saved.', date: '11/19/29', time: '23:04:10', job: '412602/QSECOFR/NIGHTSAV' },
        { id: 'CPF1241', text: 'Job 412602/QSECOFR/NIGHTSAV completed normally on 11/19/29 at 23:04:11.', date: '11/19/29', time: '23:04:11', job: '412602/QSECOFR/NIGHTSAV' },
      ],
    }),
  createWorld: (t) =>
    millWorld(t, {
      'email_kwame.txt': f(t('save-file-email-kwame')),
      'notes-margit.txt': f(t('order-book-notes-margit'), { lines: true }),
    }),
  events: [
    { id: 'cl-in-pase', condition: clInPase, message: (j) => j.t('order-book-event-cl-in-pase') },
    { id: 'not-saved', condition: (j) => said(j, '1 not saved') || (said(j, 'Display Saved Objects') && !said(j, 'ORDHDR')), message: (j) => j.t('save-file-event-not-saved') },
    { id: 'in-use', condition: (j) => said(j, 'Work with Object Locks') && said(j, 'ORDWEB'), message: (j) => j.t('save-file-event-in-use') },
    { id: 'still-in-use', condition: (j) => said(j, 'CPF3202') && j.last.line.toUpperCase().includes('SAVLIB'), message: (j) => j.t('save-file-event-still-in-use') },
    { id: 'web-down', condition: (j) => !webUp(j), message: (j) => j.t('save-file-event-web-down') },
    { id: 'saved', condition: complete, message: (j) => j.t('save-file-event-saved') },
    { id: 'ebcdic', condition: (j) => exportedIn(j, [37]) || received(j).includes('ebcdic'), message: (j) => j.t('save-file-event-ebcdic') },
    { id: 'latin1', condition: (j) => exportedIn(j, [819, 1252]) || received(j).includes('latin1'), message: (j) => j.t('save-file-event-latin1') },
    { id: 'exported', condition: (j) => exportedIn(j, [1208]), message: (j) => j.t('save-file-event-exported') },
    { id: 'duplicates', condition: (j) => received(j).includes('duplicates'), message: (j) => j.t('save-file-event-duplicates') },
    { id: 'end', condition: (j) => complete(j) && webUp(j) && received(j).includes('ok'), message: (j) => j.t('save-file-event-end') },
  ],
};
