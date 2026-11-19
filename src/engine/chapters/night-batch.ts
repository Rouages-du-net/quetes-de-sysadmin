// Story "The Night Batch": what its chapters share. For thirty years, the
// Mutual (a small mutual-aid fund) collected its members' contributions
// with a COBOL batch that ran every night on a mainframe at a service
// bureau. The bureau is closing its computer room: the batch moves to a
// Debian server, abacus, compiled with GnuCOBOL. The bureau still sends
// the day's contributions every night: a file in EBCDIC, fixed-width
// records of 40 bytes (RECFM=FB, LRECL=40), described by a copybook, with
// the amounts in packed decimal (COMP-3). Ramón, who wrote the programs in
// 1994 and retires this month, left his notes, the copybooks and a
// converter; Ayesha, who runs the Mutual's IT, takes over with you.
// The lesson of the story: the program is fine, it ran for thirty years;
// what breaks is the plumbing around it (bytes, compilation, schedule,
// return codes).
// Sources: GnuCOBOL's manual (https://gnucobol.sourceforge.io/doc/gnucobol.html),
// glibc's iconv(1) and EBCDIC charmaps, GNU dd's conv=ascii
// (https://www.gnu.org/software/coreutils/manual/html_node/dd-invocation.html),
// IBM's description of packed decimal (see ../ebcdic.ts).

import { accountsFiles, d, f, type Accounts, type Directory, type File, type Node } from '../world';
import type { Translate } from '../../texts';
import { byteString, encodeEbcdic, packDecimal } from '../ebcdic';
import type { Program } from '../cobol';
import { machineName } from '../machines';

export const HOME = '/home/you';
// registre-2029 in French (passwords.ftl).
export const PASSWORD = 'ledger-2029';
export const ADDRESS = '192.0.2.37';
export const BATCH = '/opt/batch';
export const DROP = '/srv/drop';
export const EBC = `${DROP}/contrib.ebc`;
export const DONE = `${EBC}.done`;
export const IN = '/srv/batch/in';
export const OUT = '/srv/batch/out';
export const ARCHIVE = '/srv/batch/archive';
export const DAT = `${IN}/contrib.dat`;
export const RPT = `${OUT}/contrib.rpt`;
export const WRAPPER = `${BATCH}/run-night.sh`;
export const MINUTE = 60_000;
export const DAY = 86_400_000;

// ——— The contributions: twelve members, amounts in cents ———

export interface Detail {
  member: string;
  name: string;
  cents: number;
}
export const MEMBERS: Detail[] = [
  { member: '004170', name: 'OKAFOR NGOZI', cents: 4250 },
  { member: '004233', name: 'LEFEBVRE ANNE', cents: 3800 },
  { member: '004391', name: 'NGUYEN THI MAI', cents: 6125 },
  { member: '004402', name: 'BENALI KARIM', cents: 4250 },
  { member: '004518', name: 'SILVA JOAO', cents: 2975 },
  { member: '004607', name: 'KOWALSKA EWA', cents: 5100 },
  { member: '004733', name: 'TRAORE AWA', cents: 3800 },
  { member: '004890', name: 'HAMDI LEILA', cents: 4510 },
  { member: '004921', name: 'MARTIN PAUL', cents: 2975 },
  { member: '005012', name: 'ROSSI GIULIA', cents: 6125 },
  { member: '005146', name: 'OYELARAN TUNDE', cents: 4250 },
  { member: '005288', name: 'PETIT CLAIRE', cents: 3360 },
];
export const PERIOD = '202911';

/** One night's file, as fields: header, details, trailer (count and control total of the details it should hold). */
export interface Night {
  runDate: string;
  details: Detail[];
  trailer: { count: number; cents: number };
}

export const night = (runDate: string, details: Detail[], trailer?: Night['trailer']): Night => ({
  runDate,
  details,
  trailer: trailer ?? { count: details.length, cents: details.reduce((t, x) => t + x.cents, 0) },
});

/** A night of the story: its details change with the day (YYMMDD). */
export function nightOf(runDate: string): Night {
  const day = Number(runDate.slice(4, 6));
  return night(
    runDate,
    MEMBERS.filter((_, i) => (i + day) % 4 !== 0),
  );
}

/** The same night, with a detail lost on the bureau's side: the trailer still counts it. */
export function withLostRecord(n: Night): Night {
  return { ...n, details: n.details.filter((_, i) => i !== 3) };
}

const text = (s: string, width: number) => s.padEnd(width).slice(0, width);
const records = (n: Night) => [
  { type: 'H', member: '000000', name: 'MUTUAL CONTRIBUTIONS', period: n.runDate, cents: 0 },
  ...n.details.map((x) => ({ type: 'D', member: x.member, name: x.name, period: PERIOD, cents: x.cents })),
  { type: 'T', member: String(n.trailer.count).padStart(6, '0'), name: 'END OF FILE', period: n.runDate, cents: n.trailer.cents },
];

/** The bureau's file: EBCDIC (IBM-037), 40 bytes per record, the amount packed (S9(7)V99 COMP-3), no newline. */
export function ebcdicFile(n: Night, keep = Infinity): string {
  const bytes = records(n)
    .slice(0, keep)
    .flatMap((r) => [...encodeEbcdic(`${r.type}${r.member}${text(r.name, 20)}${r.period}`), ...packDecimal(r.cents, 9), 0x40, 0x40]);
  return byteString(bytes);
}

/** The same records once converted field by field (EBC2ASC): 43 ASCII characters per line. */
export const asciiFile = (n: Night) =>
  records(n)
    .map((r) => `${r.type}${r.member}${text(r.name, 20)}${r.period}+${String(r.cents).padStart(9, '0')}`)
    .join('\n');

// ——— Ramón's sources: reference (fixed) format, sequence numbers in columns 1-6 ———

/** Lines in reference format: [indicator + text from column 8], numbered 000100, 000200…; a [number, line] pair keeps its number. */
const numbered = (lines: (string | [number, string])[]) => {
  let n = 0;
  return lines.map((l) => (Array.isArray(l) ? `${String(l[0]).padStart(6, '0')}${l[1]}` : `${String((n += 100)).padStart(6, '0')}${l}`)).join('\n');
};

export const CONTRIB_CPY = numbered([
  '*----------------------------------------------------------------',
  '* CONTRIB - THE BUREAU\'S NIGHTLY CONTRIBUTIONS FILE',
  '* RECFM=FB LRECL=40: FIXED RECORDS OF 40 BYTES, EBCDIC, NO NEWLINE.',
  '* HEADER : CR-NAME = "MUTUAL CONTRIBUTIONS", CR-PERIOD = RUN DATE',
  '*          (YYMMDD).',
  '* TRAILER: CR-MEMBER = NUMBER OF DETAIL RECORDS, CR-AMOUNT =',
  '*          CONTROL TOTAL OF THEIR AMOUNTS.',
  '* R. ORTIZ 1994',
  '*----------------------------------------------------------------',
  ' 01  CONTRIB-REC.',
  '     05  CR-TYPE             PIC X.',
  '         88  CR-HEADER       VALUE "H".',
  '         88  CR-DETAIL       VALUE "D".',
  '         88  CR-TRAILER      VALUE "T".',
  '     05  CR-MEMBER           PIC 9(6).',
  '     05  CR-NAME             PIC X(20).',
  '     05  CR-PERIOD           PIC 9(6).',
  '     05  CR-AMOUNT           PIC S9(7)V99 COMP-3.',
  '     05  FILLER              PIC X(2).',
]);

export const CONTRIBA_CPY = numbered([
  '*----------------------------------------------------------------',
  '* CONTRIBA - THE SAME RECORD ONCE CONVERTED BY EBC2ASC: ASCII,',
  '* LINE SEQUENTIAL (ONE RECORD PER LINE), 43 CHARACTERS, THE AMOUNT',
  '* UNPACKED WITH ITS SIGN IN FRONT (+000004250 = 42.50).',
  '*----------------------------------------------------------------',
  ' 01  CONTRIBA-REC.',
  '     05  CA-TYPE             PIC X.',
  '         88  CA-HEADER       VALUE "H".',
  '         88  CA-DETAIL       VALUE "D".',
  '         88  CA-TRAILER      VALUE "T".',
  '     05  CA-MEMBER           PIC 9(6).',
  '     05  CA-NAME             PIC X(20).',
  '     05  CA-PERIOD           PIC 9(6).',
  '     05  CA-AMOUNT           PIC S9(7)V99',
  '                             SIGN LEADING SEPARATE.',
]);

export const E2ATAB_CPY = numbered([
  '*----------------------------------------------------------------',
  '* E2ATAB - IBM-037 TO ASCII, FOR INSPECT ... CONVERTING: THE',
  '* SPACE, THE DIGITS, THE CAPITAL LETTERS AND THE SIGNS WE USE.',
  '*----------------------------------------------------------------',
  ' 01  EBCDIC-CHARS            PIC X(42) VALUE',
  '     X"40F0F1F2F3F4F5F6F7F8F9C1C2C3C4C5C6C7C8C9" &',
  '     X"D1D2D3D4D5D6D7D8D9E2E3E4E5E6E7E8E9" &',
  '     X"4B606B7D7A".',
  ' 01  ASCII-CHARS             PIC X(42) VALUE',
  '     " 0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ.-,\':".',
]);

export const EBC2ASC_COB = numbered([
  ' IDENTIFICATION DIVISION.',
  ' PROGRAM-ID. EBC2ASC.',
  '*----------------------------------------------------------------',
  '* CONVERTS THE BUREAU\'S FILE (EBCDIC, LRECL=40) INTO THE LINE',
  '* SEQUENTIAL ASCII FILE CONTRIB READS (CONTRIBA).',
  '* FIELD BY FIELD: THE TEXT AND ZONED FIELDS GO THROUGH THE TABLE,',
  '* THE PACKED AMOUNT IS UNPACKED BY COBOL ITSELF (MOVE). NEVER PUT',
  '* THE WHOLE FILE THROUGH A TABLE: COMP-3 IS NOT TEXT.',
  '* R. ORTIZ 2029, FOR THE MOVE OFF THE MAINFRAME.',
  '*----------------------------------------------------------------',
  ' ENVIRONMENT DIVISION.',
  ' INPUT-OUTPUT SECTION.',
  ' FILE-CONTROL.',
  '     SELECT EBC-IN ASSIGN USING WS-IN-NAME',
  '         ORGANIZATION IS SEQUENTIAL',
  '         FILE STATUS IS WS-IN-STATUS.',
  '     SELECT ASC-OUT ASSIGN USING WS-OUT-NAME',
  '         ORGANIZATION IS LINE SEQUENTIAL',
  '         FILE STATUS IS WS-OUT-STATUS.',
  ' DATA DIVISION.',
  ' FILE SECTION.',
  ' FD  EBC-IN RECORD CONTAINS 40 CHARACTERS.',
  '     COPY CONTRIB.',
  ' FD  ASC-OUT.',
  '     COPY CONTRIBA.',
  ' WORKING-STORAGE SECTION.',
  '     COPY E2ATAB.',
  ' 01  WS-IN-NAME              PIC X(200).',
  ' 01  WS-OUT-NAME             PIC X(200).',
  ' 01  WS-IN-STATUS            PIC XX.',
  ' 01  WS-OUT-STATUS           PIC XX.',
  ' 01  WS-COUNT                PIC 9(6) VALUE 0.',
  ' 01  WS-TEXT                 PIC X(33).',
  ' PROCEDURE DIVISION.',
  ' MAIN-PARA.',
  '     ACCEPT WS-IN-NAME FROM ARGUMENT-VALUE',
  '     ACCEPT WS-OUT-NAME FROM ARGUMENT-VALUE',
  '     OPEN INPUT EBC-IN OUTPUT ASC-OUT',
  '     PERFORM UNTIL WS-IN-STATUS NOT = "00"',
  '         READ EBC-IN',
  '             NOT AT END PERFORM CONVERT-RECORD',
  '         END-READ',
  '     END-PERFORM',
  '     DISPLAY "EBC2ASC: " WS-COUNT " RECORDS CONVERTED"',
  '     CLOSE EBC-IN ASC-OUT',
  '     STOP RUN.',
  ' CONVERT-RECORD.',
  '     MOVE CONTRIB-REC(1:33) TO WS-TEXT',
  '     INSPECT WS-TEXT CONVERTING EBCDIC-CHARS TO ASCII-CHARS',
  '     MOVE WS-TEXT TO CONTRIBA-REC(1:33)',
  '     MOVE CR-AMOUNT TO CA-AMOUNT',
  '     WRITE CONTRIBA-REC',
  '     ADD 1 TO WS-COUNT.',
]);

/** Ayesha's check of the control totals, pasted from her editor at column 1 (chapter 2's bug). */
export const AYESHA_LINES = [
  'CHECK-TOTALS.',
  '  IF WS-COUNT NOT = TR-COUNT OR WS-TOTAL NOT = TR-TOTAL',
  '    DISPLAY "CONTRIB: CONTROL TOTALS DO NOT MATCH"',
  '    MOVE 8 TO RETURN-CODE.',
];
/** The same, in the reference format (what compiles). */
export const AYESHA_FIXED = [
  '       CHECK-TOTALS.',
  '           IF WS-COUNT NOT = TR-COUNT OR WS-TOTAL NOT = TR-TOTAL',
  '               DISPLAY "CONTRIB: CONTROL TOTALS DO NOT MATCH"',
  '               MOVE 8 TO RETURN-CODE.',
];

export function contribCob(fixed: boolean): string {
  return [
    numbered([
      ' IDENTIFICATION DIVISION.',
      ' PROGRAM-ID. CONTRIB.',
      '*----------------------------------------------------------------',
      '* NIGHTLY CONTRIBUTIONS: READS THE CONVERTED FILE (CONTRIBA) AND',
      '* WRITES THE COLLECTION REPORT THAT ACCOUNTS SENDS TO THE BANK.',
      '* R. ORTIZ 1994 - RAN ON THE BUREAU\'S MAINFRAME UNTIL 2029.',
      '*----------------------------------------------------------------',
      ' ENVIRONMENT DIVISION.',
      ' INPUT-OUTPUT SECTION.',
      ' FILE-CONTROL.',
      '     SELECT CONTRIB-IN ASSIGN USING WS-IN-NAME',
      '         ORGANIZATION IS LINE SEQUENTIAL',
      '         FILE STATUS IS WS-IN-STATUS.',
      '     SELECT REPORT-OUT ASSIGN USING WS-OUT-NAME',
      '         ORGANIZATION IS LINE SEQUENTIAL',
      '         FILE STATUS IS WS-OUT-STATUS.',
      ' DATA DIVISION.',
      ' FILE SECTION.',
      ' FD  CONTRIB-IN.',
      '     COPY CONTRIBA.',
      ' FD  REPORT-OUT.',
      ' 01  REPORT-LINE             PIC X(60).',
      ' WORKING-STORAGE SECTION.',
      ' 01  WS-IN-NAME              PIC X(200).',
      ' 01  WS-OUT-NAME             PIC X(200).',
      ' 01  WS-IN-STATUS            PIC XX.',
      ' 01  WS-OUT-STATUS           PIC XX.',
      ' 01  WS-EOF                  PIC X VALUE "N".',
      ' 01  WS-SEEN-TRAILER         PIC X VALUE "N".',
      ' 01  WS-COUNT                PIC 9(6) VALUE 0.',
      ' 01  WS-TOTAL                PIC S9(9)V99 VALUE 0.',
      ' 01  WS-TOTAL-ED             PIC Z,ZZZ,ZZ9.99.',
      ' 01  TR-COUNT                PIC 9(6) VALUE 0.',
      ' 01  TR-TOTAL                PIC S9(9)V99 VALUE 0.',
      ' PROCEDURE DIVISION.',
      ' MAIN-PARA.',
      '     ACCEPT WS-IN-NAME FROM ARGUMENT-VALUE',
      '     ACCEPT WS-OUT-NAME FROM ARGUMENT-VALUE',
      '     OPEN INPUT CONTRIB-IN',
      '     IF WS-IN-STATUS NOT = "00"',
      // Within column 72: real cobc ignores what follows (checked with GnuCOBOL 3.1.2).
      '         DISPLAY "CONTRIB: INPUT NOT OPENED, STATUS " WS-IN-STATUS',
      '         MOVE 12 TO RETURN-CODE',
      '         STOP RUN',
      '     END-IF',
      '     OPEN OUTPUT REPORT-OUT',
      '     PERFORM READ-RECORD UNTIL WS-EOF = "Y"',
      '     IF WS-SEEN-TRAILER = "N"',
      '         DISPLAY "CONTRIB: NO TRAILER RECORD, FILE INCOMPLETE?"',
      '         MOVE 12 TO RETURN-CODE',
      '         STOP RUN',
      '     END-IF',
      '     PERFORM WRITE-TOTALS',
      [5250, '     PERFORM CHECK-TOTALS'],
      '     CLOSE CONTRIB-IN REPORT-OUT',
      '     STOP RUN.',
      ' READ-RECORD.',
      '     READ CONTRIB-IN',
      '         AT END MOVE "Y" TO WS-EOF',
      '         NOT AT END PERFORM PROCESS-RECORD',
      '     END-READ.',
      ' PROCESS-RECORD.',
      '     EVALUATE TRUE',
      '         WHEN CA-HEADER',
      '             DISPLAY "CONTRIB: RUN DATE " CA-PERIOD',
      '             PERFORM WRITE-HEADER',
      '         WHEN CA-DETAIL',
      '             ADD 1 TO WS-COUNT',
      '             ADD CA-AMOUNT TO WS-TOTAL',
      '             PERFORM WRITE-DETAIL',
      '         WHEN CA-TRAILER',
      '             MOVE CA-MEMBER TO TR-COUNT',
      '             MOVE CA-AMOUNT TO TR-TOTAL',
      '             MOVE "Y" TO WS-SEEN-TRAILER WS-EOF',
      '         WHEN OTHER',
      '             DISPLAY "CONTRIB: UNKNOWN RECORD TYPE"',
      '             MOVE 12 TO RETURN-CODE',
      '             STOP RUN',
      '     END-EVALUATE.',
      ' WRITE-HEADER.',
      '     MOVE SPACES TO REPORT-LINE',
      '     STRING "THE MUTUAL - NIGHTLY CONTRIBUTIONS  RUN DATE "',
      '         CA-PERIOD DELIMITED BY SIZE INTO REPORT-LINE',
      '     WRITE REPORT-LINE.',
      ' WRITE-DETAIL.',
      '     MOVE SPACES TO REPORT-LINE',
      '     STRING CA-MEMBER "  " CA-NAME "  " CA-PERIOD',
      '         DELIMITED BY SIZE INTO REPORT-LINE',
      '     WRITE REPORT-LINE.',
      ' WRITE-TOTALS.',
      '     MOVE WS-TOTAL TO WS-TOTAL-ED',
      '     DISPLAY "CONTRIB: " WS-COUNT " CONTRIBUTIONS, TOTAL "',
      '         WS-TOTAL-ED',
      '     MOVE SPACES TO REPORT-LINE',
      '     STRING "TOTAL " WS-COUNT " CONTROL " TR-COUNT',
      '         DELIMITED BY SIZE INTO REPORT-LINE',
      '     WRITE REPORT-LINE.',
    ]),
    ...(fixed ? AYESHA_FIXED : AYESHA_LINES),
  ].join('\n');
}

// ——— The machine ———

export const batchAccounts = (): Accounts => ({
  users: {
    root: { uid: 0, group: 'root', home: '/root' },
    batch: { uid: 998, group: 'batch', home: BATCH, shell: '/usr/sbin/nologin' },
    you: { uid: 1000, group: 'you' },
    ayesha: { uid: 1001, group: 'ayesha' },
    bureau: { uid: 1002, group: 'bureau', home: DROP, shell: '/usr/sbin/nologin' },
  },
  groups: {
    root: { gid: 0, members: [] },
    adm: { gid: 4, members: ['you', 'ayesha'] },
    sudo: { gid: 27, members: ['you', 'ayesha'] },
    batch: { gid: 998, members: ['you', 'ayesha', 'bureau'] },
    you: { gid: 1000, members: [] },
    ayesha: { gid: 1001, members: [] },
    bureau: { gid: 1002, members: [] },
  },
});

/** A compiled program (cobc -x), already there. */
export const executable = (id: string): File => ({
  type: 'file',
  content: '',
  size: id === 'CONTRIB' ? 27_160 : 23_408,
  owner: 'batch',
  group: 'batch',
  mode: 'rwxr-xr-x',
  program: { kind: 'executable', id, ...(id === 'CONTRIB' ? { checksControl: true } : {}) } satisfies Program,
});

/** The bureau's file in the drop directory (written by its sftp account). */
export const dropped = (content: string, mtime: number): File => ({ type: 'file', content, charset: 'binary', owner: 'bureau', group: 'batch', mode: 'rw-rw----', mtime });
export const doneFlag = (mtime: number): File => ({ type: 'file', content: '', owner: 'bureau', group: 'batch', mode: 'rw-rw----', mtime });

const SERVICE = `[Unit]
Description=Nightly contributions batch (the bureau's job NIGHTLY)

[Service]
Type=oneshot
User=batch
ExecStart=${WRAPPER}`;

const TIMER = `[Unit]
Description=Run the nightly contributions batch at 02:00

[Timer]
OnCalendar=*-*-* 02:00:00

[Install]
WantedBy=timers.target`;

export const OLD_WRAPPER = `#!/bin/sh
# Nightly contributions batch: what the bureau's JCL (job NIGHTLY) did.
# Step 1 converts the bureau's file, step 2 writes the collection report.
${BATCH}/bin/ebc2asc ${EBC} ${DAT}
${BATCH}/bin/contrib ${DAT} ${RPT}
echo "night batch finished"`;

export function batchWorld(
  t: Translate,
  o: { home: Record<string, Node>; drop?: Record<string, Node>; in?: Record<string, Node>; out?: Record<string, Node>; bin?: Record<string, Node>; src?: Record<string, Node>; units?: boolean },
): Directory {
  const root = { owner: 'root' };
  const batch = { owner: 'batch', group: 'batch', mode: 'rwxrwsr-x' };
  const file = (s: string, more: Partial<File> = {}) => f(s, { lines: true, owner: 'batch', group: 'batch', mode: 'rw-rw-r--', ...more });
  return d(
    {
      etc: d(
        {
          ...accountsFiles(),
          hostname: f(machineName(t, 'abacus'), { lines: true, owner: 'root' }),
          aliases: f('# See man 5 aliases for format\npostmaster:    root\nroot: ayesha', { lines: true, owner: 'root' }),
          systemd: d(
            { system: d(o.units ? { 'night-batch.service': f(SERVICE, { lines: true, owner: 'root' }), 'night-batch.timer': f(TIMER, { lines: true, owner: 'root' }) } : {}, undefined, root) },
            undefined,
            root,
          ),
        },
        undefined,
        root,
      ),
      home: d(
        {
          you: d(o.home),
          ayesha: d({}, undefined, { owner: 'ayesha', mode: 'rwx------' }),
        },
        undefined,
        root,
      ),
      opt: d(
        {
          batch: d(
            {
              'NOTES.txt': f(t('night-batch-notes-ramon'), { owner: 'batch', group: 'batch' }),
              bin: d({ ebc2asc: executable('EBC2ASC'), ...o.bin }, undefined, batch),
              copybooks: d({ 'CONTRIB.cpy': file(CONTRIB_CPY), 'CONTRIBA.cpy': file(CONTRIBA_CPY), 'E2ATAB.cpy': file(E2ATAB_CPY) }, undefined, batch),
              src: d({ 'ebc2asc.cob': file(EBC2ASC_COB), ...o.src }, undefined, batch),
              ...(o.units ? { 'run-night.sh': file(OLD_WRAPPER, { mode: 'rwxrwxr-x' }) } : {}),
            },
            undefined,
            batch,
          ),
        },
        undefined,
        root,
      ),
      srv: d(
        {
          drop: d(o.drop ?? {}, undefined, { owner: 'bureau', group: 'batch', mode: 'rwxrws---' }),
          batch: d({ in: d(o.in ?? {}, undefined, batch), out: d(o.out ?? {}, undefined, batch), archive: d({}, undefined, batch) }, undefined, batch),
        },
        undefined,
        root,
      ),
      usr: d({ share: d({ gnucobol: d({ copy: d({}, undefined, root) }, undefined, root) }, undefined, root) }, undefined, root),
      tmp: d({}, undefined, { owner: 'root', mode: 'rwxrwxrwt' }),
    },
    undefined,
    root,
  );
}

export const COMMANDS_BYTES = [
  'ls', 'cd', 'pwd', 'cat', 'less', 'head', 'tail', 'grep', 'nano', 'sudo', 'id', 'whoami', 'echo', 'file', 'wc', 'od', 'xxd', 'hexdump', 'iconv', 'dd',
  'cp', 'mv', 'rm', 'mkdir', 'touch', 'diff', 'stat',
];
