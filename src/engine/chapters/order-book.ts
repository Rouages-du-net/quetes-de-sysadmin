// Story "The Order Book": what its chapters share. Since 1996, a flour mill
// has taken its bakeries' orders on an IBM i (an AS/400 when it was
// bought): mill, in the office behind the silos. Margit wrote its RPG
// programs and set up its nights (the import of the web's orders, the
// picking lists, the invoices, the save); she has retired, and comes on
// Thursdays. Kwame, who runs the mill, asks you to look after it; Soraya
// takes the orders on the green screen. A world where everything is an
// object in a library, driven by CL commands, with PASE (a Unix shell, ssh
// lands there) on the same machine; sieve, a Debian server for the new
// reports, is behind it.
// Sources: IBM Documentation for IBM i 7.5 (https://www.ibm.com/docs/en/i/7.5):
// "Work management" (jobs, subsystems, job queues), "Message handling"
// (inquiry messages, QSYSOPR), "Printing" (spooled files, output queues),
// "Backup and recovery" (SAVLIB, save files, save-while-active), "PASE".

import { accountsFiles, d, f, type Accounts, type Directory, type File, type InternalHost, type Node } from '../world';
import type { Translate } from '../../texts';
import type { Game, Shell } from '../shell';
import { generateKey } from '../access';
import { machineName, publicKey, storyMachine } from '../machines';
import { byteString, encodeEbcdic } from '../ebcdic';
import { newSystemd } from '../systemd';
import { endJob, ibmi, qualifiedJob, runQueues, send, type Column, type DbTable, type Ibmi, type IbmiJob, type IbmiObject, type Spool, type Subsystem } from '../ibmi';
import { player } from '../world';

export const HOME = '/home/you';
// meule-2029 in French (passwords.ftl).
export const PASSWORD = 'millstone-2029';
export const ADDRESS = '192.0.2.38';
export const SIEVE = '192.0.2.39';
export const INBOX = '/srv/reports/inbox';
export const DATE = '11/20/29';

/** Your key on mill (PASE), authorised on sieve. */
export const KEY = generateKey('order-book-mill', 'you@mill');

// ——— The order book: bakeries with accents (CCSID 37 holds Latin-1's letters) ———

export const CUSTOMERS: [number, string, string][] = [
  [101, 'Boulangerie \u00c9lo\u00efse', 'Li\u00e8ge'],
  [102, 'P\u00e2tisserie M\u00fcller', 'Strasbourg'],
  [103, "Fournil d'Ana\u00efs", 'N\u00eemes'],
  [104, 'Panader\u00eda N\u00fa\u00f1ez', 'Perpignan'],
  [105, 'B\u00e4ckerei Gr\u00f6\u00dfer', 'Colmar'],
  [106, 'Le Pain de Zo\u00e9', 'Besan\u00e7on'],
  [107, 'Fourn\u00e9e \u00c7elik', 'Mulhouse'],
  [108, 'Boulangerie Okafor', 'Lille'],
  [109, 'Br\u00f8d & S\u00f8n', 'Dunkerque'],
  [110, 'Banh Mi L\u00ea', 'Lyon'],
  [111, 'Moulin \u00e0 Paroles', 'Orl\u00e9ans'],
  [112, "La Mie d'In\u00e8s", 'Cr\u00e9teil'],
];

export const COLUMNS: Column[] = [
  { name: 'ORDNO', type: 'DECIMAL', length: 7 },
  { name: 'ORDDATE', type: 'DATE', length: 10 },
  { name: 'CUSTNO', type: 'DECIMAL', length: 5 },
  { name: 'CUSTNAME', type: 'VARCHAR', length: 30 },
  { name: 'CITY', type: 'VARCHAR', length: 20 },
  { name: 'FLOURKG', type: 'DECIMAL', length: 7 },
  { name: 'STATUS', type: 'CHAR', length: 1 },
];

/** An order: its number gives its bakery, its day and its quantity. */
export function order(no: number, kg?: number): (string | number)[] {
  const [custno, name, city] = CUSTOMERS[no % CUSTOMERS.length];
  return [no, `2029-11-${String(14 + (no % 6)).padStart(2, '0')}`, custno, name, city, kg ?? 200 + ((no * 37) % 9) * 100, 'O'];
}

/** The open orders before the night: 1820 to 1859 (order 1847, the 28th, is Soraya's). */
export const OPEN = Array.from({ length: 40 }, (_, i) => 1820 + i);
export const CHANGED = 1847;
export const CHANGED_RRN = OPEN.indexOf(CHANGED) + 1;
export const NEW_KG = 1500;
/** The night's incoming orders (ORDIN): seven new ones, a change to 1847, six new ones. */
export const INCOMING: { no: number; change?: boolean }[] = [
  ...[1860, 1861, 1862, 1863, 1864, 1865, 1866].map((no) => ({ no })),
  { no: CHANGED, change: true },
  ...[1867, 1868, 1869, 1870, 1871, 1872].map((no) => ({ no })),
];
/** All the orders once the night's import is complete (chapters 2 and 3). */
export const ALL_ORDERS = () => [...OPEN.map((no) => order(no, no === CHANGED ? NEW_KG : undefined)), ...INCOMING.filter((x) => !x.change).map((x) => order(x.no))];

const table = (library: string, name: string, text: string, rows: (string | number)[][], columns = COLUMNS): DbTable => ({ library, name, text, columns, rows });

// ——— The libraries ———

const obj = (name: string, type: string, attribute: string, size: number, text: string): IbmiObject => ({ name, type, attribute, size, text });

export const ordersObjects = (): IbmiObject[] => [
  obj('CUSTOMER', '*FILE', 'PF', 65_536, 'Bakeries (customers)'),
  obj('ORDHDR', '*FILE', 'PF', 1_310_720, 'Order headers'),
  obj('ORDDTL', '*FILE', 'PF', 2_621_440, 'Order lines'),
  obj('ORDIN', '*FILE', 'PF', 98_304, 'Incoming orders (web, imported at night)'),
  obj('ORDHIST', '*FILE', 'PF', 41_943_040, 'Delivered orders since 1996'),
  obj('INVOICE', '*FILE', 'PRTF', 8_192, 'Invoice'),
  obj('DBGLIST', '*FILE', 'PRTF', 8_192, 'ORDPICK debug listing'),
  obj('ORDIMP', '*PGM', 'RPGLE', 409_600, 'Night import of incoming orders'),
  obj('ORDPICK', '*PGM', 'RPGLE', 352_256, 'Picking lists for the morning shift'),
  obj('ORDINV', '*PGM', 'RPGLE', 315_392, 'Invoices'),
  obj('ORDENT', '*PGM', 'RPGLE', 798_720, 'Order entry (green screen)'),
  obj('ORDRCV', '*PGM', 'RPGLE', 286_720, 'Web order receiver'),
  obj('ORDNIGHT', '*PGM', 'CLLE', 61_440, 'Night chain'),
  obj('ORDDEBUG', '*DTAARA', '', 8_192, 'ORDPICK debug listing (Y/N)'),
  obj('ORDJOBD', '*JOBD', '', 4_096, 'Order batch jobs'),
  obj('ORDSBS', '*SBSD', '', 49_152, 'Orders subsystem (web receiver)'),
];

// ——— Jobs ———

export const IMPORT_NUMBER = '412907';
export const SORAYA_JOB = { number: '412655', user: 'SORAYA', name: 'QPADEV0004' };
const job = (number: string, user: string, name: string, type: IbmiJob['type'], subsystem: string, status: string, fn: string, more: Partial<IbmiJob> = {}): IbmiJob => ({
  number, user, name, type, subsystem, status, function: fn, cpu: '.0', log: [], ...more,
});

/** The web order receiver: it keeps ORDHDR open all day and all night. */
export const webJob = (): IbmiJob => job('398121', 'ORDWEB', 'ORDWEB', 'BCH', 'ORDSBS', 'DEQW', 'PGM-ORDRCV', { locks: [{ object: 'ORDERS/ORDHDR', type: '*FILE', state: '*SHRUPD' }] });

function subsystems(): Subsystem[] {
  return [
    { name: 'QBATCH', library: 'QSYS', status: 'ACTIVE', jobq: 'QBATCH', maxActive: 1 },
    { name: 'QCTL', library: 'QSYS', status: 'ACTIVE' },
    { name: 'QINTER', library: 'QSYS', status: 'ACTIVE' },
    { name: 'QSPL', library: 'QSYS', status: 'ACTIVE' },
    { name: 'QUSRWRK', library: 'QSYS', status: 'ACTIVE' },
    { name: 'ORDSBS', library: 'ORDERS', status: 'ACTIVE', autostart: () => [webJob()] },
  ];
}

// ——— Spooled files ———

/** One night's debug listings of ORDPICK (one per order, held and saved: they never go). */
const listing = (night: number, number: number): Spool => {
  const day = new Date(Date.UTC(2029, 9, 21 + night));
  const date = `${String(day.getUTCMonth() + 1).padStart(2, '0')}/${String(day.getUTCDate()).padStart(2, '0')}/29`;
  return { file: 'DBGLIST', user: 'ORDBATCH', job: `${number}/ORDBATCH/ORDPICK`, first: 1, count: 600, userData: 'ORDPICKDBG', status: 'HLD', pages: 40, outq: 'QPRINT', date, mb: 0.36 };
};
export const listings = (): Spool[] => Array.from({ length: 30 }, (_, i) => listing(i, 398400 + i * 487));
export const INVOICES = 31;
export const invoices = (): Spool => ({ file: 'INVOICE', user: 'ORDBATCH', job: '412911/ORDBATCH/ORDINV', first: 1, count: INVOICES, userData: 'INVOICE', status: 'RDY', pages: 1, outq: 'QPRINT', date: DATE, mb: 0.02 });
const jobLogs = (): Spool => ({ file: 'QPJOBLOG', user: 'ORDBATCH', job: '412907/ORDBATCH/ORDIMPORT', first: 1, count: 34, userData: '', status: 'RDY', pages: 2, outq: 'QEZJOBLOG', date: DATE, mb: 0.01 });

// ——— The machine ———

export interface MillOptions {
  time: string;
  orders: (string | number)[][];
  jobs?: IbmiJob[];
  jobq?: Ibmi['jobq'];
  spool?: Spool[];
  debug?: 'Y' | 'N';
  savf?: Ibmi['savf'];
  history?: Ibmi['history'];
  aspBase?: number;
  programs?: Ibmi['programs'];
}

export function millState(t: Translate, o: MillOptions) {
  const profile = player(t).toUpperCase();
  const s: Ibmi = {
    system: machineName(t, 'mill').toUpperCase(),
    date: DATE,
    time: o.time,
    profile,
    jobs: [
      job('000000', 'QSYS', 'QSPLMAINT', 'SYS', 'QCTL', 'EVTW', ''),
      job('398007', 'QSYS', 'QSYSARB', 'SYS', 'QCTL', 'EVTW', ''),
      job('398050', 'QSPL', 'PRT01', 'BCH', 'QSPL', 'EVTW', '', { type: 'BCH' }),
      webJob(),
      ...(o.jobs ?? []),
    ],
    jobq: o.jobq ?? [],
    subsystems: subsystems(),
    msgq: { QSYSOPR: [], [profile]: [] },
    spool: o.spool ?? [invoices(), jobLogs()],
    outq: [
      { name: 'QPRINT', library: 'QGPL', writer: 'PRT01', status: 'RLS' },
      { name: 'QEZJOBLOG', library: 'QUSRSYS', writer: '', status: 'RLS' },
    ],
    libraries: {
      ORDERS: { text: 'Order book - the mill (1996)', objects: ordersObjects() },
      BACKUP: { text: 'Nightly save files', objects: [obj('ORDERS', '*FILE', 'SAVF', 9_437_184, 'Nightly save of ORDERS')] },
      QGPL: { text: 'General Purpose Library', objects: [obj('QBATCH', '*JOBQ', '', 4_096, 'Batch job queue'), obj('QPRINT', '*OUTQ', '', 4_096, 'Default printer output queue')] },
      QSYS: { text: 'System Library', objects: [] },
    },
    tables: {
      'ORDERS/ORDHDR': table('ORDERS', 'ORDHDR', 'Order headers', o.orders),
      'ORDERS/CUSTOMER': table('ORDERS', 'CUSTOMER', 'Bakeries (customers)', CUSTOMERS.map((c) => [...c]), [
        { name: 'CUSTNO', type: 'DECIMAL', length: 5 },
        { name: 'CUSTNAME', type: 'VARCHAR', length: 30 },
        { name: 'CITY', type: 'VARCHAR', length: 20 },
      ]),
    },
    dataAreas: { 'ORDERS/ORDDEBUG': { value: o.debug ?? 'Y', length: 1, text: 'ORDPICK debug listing (Y/N)' } },
    savf: o.savf ?? { 'BACKUP/ORDERS': null },
    history: o.history ?? [],
    asp: { capacity: 70.5, base: o.aspBase ?? 57.9, threshold: 90 },
    programs: { 'ORDERS/ORDPICK': (g, j) => endJob(g, j, 0), 'ORDERS/ACCTEXP': (g, j) => endJob(g, j, 0), ...(o.programs ?? {}) },
    stmf: {},
    nextJob: 412940,
  };
  return {
    os: 'ibmi',
    // No systemd on IBM i: this one only keeps the machine's clock.
    systemd: newSystemd('mill', Date.UTC(2029, 10, 4, 6, 0, 0), Date.UTC(2029, 10, 20, 7, 42, 0), {}),
    ibmi: s,
  };
}

export const ORDHDR = (j: Game) => ibmi(j).tables['ORDERS/ORDHDR'];

// ——— The night's import (ORDERS/ORDIMP): chapter 1 ———

/** How far the import has gone (ORDIN's records applied), and what it skipped. */
export interface ImportState {
  applied: number;
  skipped: number[];
  // Replied R while the record was still locked.
  retriedLocked?: boolean;
  // The runs that ended abnormally (cancelled, ended).
  broken?: boolean;
}
export const importState = (j: Game): ImportState => (j.state.orderImport ??= { applied: 0, skipped: [] });

const MSG_RNQ = 'Unable to allocate a record in file ORDHDR (R C G D F).';

/** Runs (or resumes) ORDIMP in its job: one incoming order after the other, until a locked record. */
export function runImport(game: Game, j: IbmiJob, fresh = false): void {
  const s = ibmi(game);
  const st = importState(game);
  // A new run starts from ORDIN's first record (Margit's program skips the orders already there).
  if (fresh) st.applied = 0;
  j.locks = [{ object: 'ORDERS/ORDHDR', type: '*FILE', state: '*SHRUPD' }];
  const table = ORDHDR(game);
  for (; st.applied < INCOMING.length; st.applied++) {
    const x = INCOMING[st.applied];
    if (!x.change) {
      if (!table.rows.some((r) => r[0] === x.no)) table.rows.push(order(x.no));
      continue;
    }
    // The change to order 1847: its record must be locked for update.
    const holder = s.jobs.find((h) => h !== j && h.locks?.some((l) => l.object === 'ORDERS/ORDHDR' && l.record === CHANGED_RRN && !l.waiting));
    if (holder) {
      j.status = 'MSGW';
      j.locks.push({ object: 'ORDERS/ORDHDR', type: '*FILE', state: '*SHRUPD', record: CHANGED_RRN, waiting: true });
      const sent = `${s.date}  ${s.time}`;
      const from = qualifiedJob(j);
      j.log.push({ id: 'CPF5027', type: 'Diagnostic', severity: 30, text: `Record ${CHANGED_RRN} in use by job ${qualifiedJob(holder)}.`, from, program: 'ORDIMP', sent });
      const inquiry = {
        id: 'RNQ1218',
        type: 'Inquiry' as const,
        severity: 99,
        text: MSG_RNQ,
        cause:
          `RPG procedure ORDIMP in program ORDERS/ORDIMP at statement 004200 was unable to allocate a record in file ORDHDR: another job holds a lock on it, and the wait time of the file (WAITRCD) has ended. See the previous messages in the job log for the job holding the lock.`,
        recovery: 'Check the job log for the job that holds the record. Release the record (for example, end the job holding it or ask its user to leave the record), then reply R to retry, or reply with one of the other choices.',
        choices: [
          'R -- Retry the operation, reading or allocating the record again.',
          'C -- Cancel the program: the job ends abnormally.',
          'G -- Continue processing at *GETIN: the record is skipped.',
          'D -- Obtain an RPG formatted dump, then cancel.',
          'F -- Obtain a full formatted dump, then cancel.',
        ],
        from,
        program: 'ORDIMP',
        sent,
        replies: ['R', 'C', 'G', 'D', 'F'],
        onReply: (g: Game, reply: string) => answerImport(g, j, reply),
      };
      j.log.push(inquiry);
      send(game, 'QSYSOPR', inquiry);
      return;
    }
    const row = table.rows.find((r) => r[0] === CHANGED);
    if (row) row[5] = NEW_KG;
  }
  j.log.push({ id: 'ORD0010', type: 'Completion', severity: 0, text: `${INCOMING.length} incoming orders processed.`, from: qualifiedJob(j), program: 'ORDIMP', sent: `${s.date}  ${s.time}` });
  endJob(game, j, 0);
}

function answerImport(game: Game, j: IbmiJob, reply: string): string {
  const st = importState(game);
  j.locks = (j.locks ?? []).filter((l) => !l.waiting);
  if (reply === 'R') {
    j.status = 'RUN';
    const before = ibmi(game).msgq.QSYSOPR.length;
    runImport(game, j);
    if (ibmi(game).msgq.QSYSOPR.length > before) st.retriedLocked = true;
    runQueues(game);
    return '';
  }
  if (reply === 'G') {
    // *GETIN: the change is skipped, the import goes on without it.
    st.skipped.push(st.applied);
    st.applied++;
    j.status = 'RUN';
    runImport(game, j);
    runQueues(game);
    return '';
  }
  // C, D, F: the program is cancelled, the job ends abnormally.
  st.broken = true;
  endJob(game, j, 20);
  runQueues(game);
  return '';
}

/** The import complete: every incoming order applied, 1847 changed. */
export const imported = (j: Game) => {
  const rows = ORDHDR(j).rows;
  return INCOMING.every((x) => rows.some((r) => r[0] === x.no)) && rows.find((r) => r[0] === CHANGED)?.[5] === NEW_KG;
};

// ——— The IFS and PASE ———

export const millAccounts = (): Accounts => ({
  users: {
    qsecofr: { uid: 0, group: '0', home: '/home/QSECOFR', shell: '/QOpenSys/pkgs/bin/bash' },
    you: { uid: 1107, group: '0', shell: '/QOpenSys/pkgs/bin/bash' },
    margit: { uid: 1101, group: '0', home: '/home/margit' },
    qsys: { uid: 2, group: '0', home: '/' },
  },
  groups: { '0': { gid: 0, members: [] } },
});

/** ORDHDR's member as PASE sees it through /QSYS.LIB: fixed records in EBCDIC, no newline. */
const member = (): File => ({
  type: 'file',
  content: (game: Game) =>
    byteString(
      ORDHDR(game).rows.flatMap((r) =>
        encodeEbcdic(`${String(r[0]).padStart(7, '0')}${r[1]}${String(r[2]).padStart(5, '0')}${String(r[3]).padEnd(30)}${String(r[4]).padEnd(20)}${String(r[5]).padStart(7, '0')}${r[6]}`),
      ),
    ),
  charset: 'binary',
  owner: 'qsys',
  mode: 'rw-r-----',
});

export function millWorld(t: Translate, home: Record<string, Node>): Directory {
  const mill = storyMachine('order-book')!;
  const sys = { owner: 'qsys' };
  const lib = (children: Record<string, Node>) => d(children, undefined, sys);
  return d(
    {
      'QSYS.LIB': lib({
        'ORDERS.LIB': lib({
          'ORDHDR.FILE': lib({ 'ORDHDR.MBR': member() }),
          'CUSTOMER.FILE': lib({ 'CUSTOMER.MBR': f('', { owner: 'qsys', charset: 'binary', size: 65_536 }) }),
          'ORDIMP.PGM': f('', { owner: 'qsys', size: 409_600 }),
          'ORDDEBUG.DTAARA': f('', { owner: 'qsys', size: 8_192 }),
        }),
        'BACKUP.LIB': lib({ 'ORDERS.FILE': f('', { owner: 'qsys', size: 9_437_184 }) }),
      }),
      QOpenSys: d({ pkgs: d({ bin: d({ bash: f('(binary)', { owner: 'qsys', mode: 'r-xr-xr-x' }) }, undefined, sys) }, undefined, sys) }, undefined, sys),
      etc: d(
        {
          ...accountsFiles(),
          hosts: f(`127.0.0.1\tlocalhost\n${ADDRESS}\t${machineName(t, 'mill')} ${machineName(t, 'mill')}.internal\n${SIEVE}\t${machineName(t, 'sieve')} ${machineName(t, 'sieve')}.internal`, { lines: true, owner: 'qsys' }),
        },
        undefined,
        sys,
      ),
      home: d(
        {
          you: d({
            ...home,
            '.ssh': d(
              {
                authorized_keys: f(publicKey(mill, 'you'), { lines: true, mode: 'rw-------' }),
                id_ed25519: f(KEY.isPrivate, { lines: true, mode: 'rw-------' }),
                'id_ed25519.pub': f(KEY.isPublic, { lines: true }),
              },
              undefined,
              { mode: 'rwx------' },
            ),
          }),
          margit: d({}, undefined, { owner: 'margit', mode: 'rwx------' }),
        },
        undefined,
        sys,
      ),
      tmp: d({}, undefined, { owner: 'qsys', mode: 'rwxrwxrwt' }),
    },
    undefined,
    sys,
  );
}

// The commands of PASE: Unix utilities, OpenSSH, and system and db2 to reach IBM i.
export const PASE_COMMANDS = [
  'ls', 'cd', 'pwd', 'cat', 'less', 'head', 'tail', 'grep', 'wc', 'id', 'whoami', 'uname', 'file', 'iconv', 'od', 'cp', 'mv', 'rm', 'mkdir', 'system', 'db2',
];

// ——— sieve: Debian, the new reporting server ———

const sieveAccounts = (): Accounts => ({
  users: { root: { uid: 0, group: 'root', home: '/root' }, you: { uid: 1000, group: 'you' }, reports: { uid: 997, group: 'reports', home: '/srv/reports', shell: '/usr/sbin/nologin' } },
  groups: { root: { gid: 0, members: [] }, sudo: { gid: 27, members: ['you'] }, you: { gid: 1000, members: [] }, reports: { gid: 997, members: ['you'] } },
});

export const SIEVE_COMMANDS = ['ls', 'cd', 'pwd', 'cat', 'less', 'head', 'tail', 'grep', 'wc', 'file', 'iconv', 'od', 'xxd', 'cp', 'mv', 'rm', 'id', 'whoami', 'uname'];

export function sieveHost(): InternalHost {
  return {
    address: SIEVE,
    domain: 'sieve.internal',
    accounts: sieveAccounts,
    commands: SIEVE_COMMANDS,
    state: () => ({
      systemd: newSystemd('sieve', Date.UTC(2029, 10, 12, 9, 0, 0), Date.UTC(2029, 10, 20, 7, 42, 0), {
        ssh: { description: 'OpenBSD Secure Shell server', active: true, executable: 'sshd' },
      }),
    }),
    createWorld: () =>
      d(
        {
          etc: d({ ...accountsFiles(), hostname: f('sieve', { lines: true }) }, undefined, { owner: 'root' }),
          home: d({ you: d({ '.ssh': d({ authorized_keys: f(KEY.isPublic, { lines: true, mode: 'rw-------' }) }, undefined, { mode: 'rwx------' }) }) }, undefined, { owner: 'root' }),
          srv: d(
            { reports: d({ inbox: d({}, undefined, { owner: 'reports', group: 'reports', mode: 'rwxrwsr-x' }) }, undefined, { owner: 'reports', group: 'reports' }) },
            undefined,
            { owner: 'root' },
          ),
          tmp: d({}, undefined, { owner: 'root', mode: 'rwxrwxrwt' }),
        },
        undefined,
        { owner: 'root' },
      ),
  };
}

/** A CL command (or tn5250) typed in PASE, as if it were a program. */
export const clInPase = (j: Game) => j.last.errors.some((e) => /^-bash: ([A-Z][A-Z0-9]+|tn5250): command not found/.test(e));

export const sieve = (j: Game): Shell | null => (j as Shell).internal('sieve');
export type { Translate };
