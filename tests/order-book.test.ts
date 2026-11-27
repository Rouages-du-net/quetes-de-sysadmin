// The Order Book: an IBM i (CL, jobs, messages, spooled files, save files,
// PASE). Replayed with the console, in every language.

import { describe, expect, it } from 'vitest';
import { Console } from '../src/engine/console';
import { STORIES } from '../src/engine/chapters';
import { prerequisites } from '../src/engine/unlocking';
import { translator } from '../src/texts';
import { inLanguage, machinesInLanguage, languagesFor } from './names';
import { parseCl, bind, isError } from '../src/engine/cl';
import { CL } from '../src/engine/commands/ibmi';
import { COMMANDS } from '../src/engine/commands';
import { name, password } from '../src/engine/world';
import { machineName } from '../src/engine/machines';

const ERASER = [...new Set([...STORIES.find((h) => h.id === 'eraser')!.chapters.map((c) => c.id), ...prerequisites('order-book')])];

describe('CL, the command analyser', () => {
  it('keywords, positional values, quotes, nested parentheses', () => {
    const c = parseCl("SBMJOB CMD(CALL PGM(ORDERS/ORDIMP)) job(ordimport) TOSTMF('/home/you/a b.csv')");
    expect(isError(c)).toBe(false);
    if (isError(c)) return;
    expect(c.name).toBe('SBMJOB');
    expect(c.keywords.CMD).toBe('CALL PGM(ORDERS/ORDIMP)');
    expect(c.keywords.JOB).toBe('ordimport');
    expect(c.keywords.TOSTMF).toBe("'/home/you/a b.csv'");
    const d = parseCl('DSPLIB ORDERS');
    if (!isError(d)) expect(bind(d, { params: ['LIB', 'OUTPUT'] })).toEqual({ LIB: 'ORDERS' });
  });
  it('the analyser\'s errors', () => {
    expect(parseCl("DSPLIB LIB('ORDERS")).toMatchObject({ id: 'CPD0018' });
    expect(parseCl('DSPLIB LIB(ORDERS')).toMatchObject({ id: 'CPD0013' });
    const d = parseCl('DSPLIB ORDERS *PRINT X');
    if (!isError(d)) expect(bind(d, { params: ['LIB', 'OUTPUT'], maxPos: 2 })).toMatchObject({ id: 'CPD0065' });
    const e = parseCl('WRKOBJLCK OBJ(ORDERS/ORDHDR)');
    if (!isError(e)) expect(bind(e, CL.WRKOBJLCK)).toMatchObject({ id: 'CPD0071', text: 'Parameter OBJTYPE required.' });
  });
  it('every CL command has its manual page, found in any case', () => {
    for (const name of Object.keys(CL)) expect(COMMANDS[name]?.cl, name).toBe(true);
  });
});

for (const language of languagesFor('order-book'))
  describe(`The Order Book — ${language}`, () => {
    const fr = language === 'fr';
    const t = translator(language);
    const PASSWORD = password(t, 'millstone-2029');
    const PROFILE = name(t, 'you');
    const SIEVE = machineName(t, 'sieve');
    const L = (line: string) => inLanguage(translator(language), line);
    const contains = (all: string, text: string) => fr && expect(all).toContain(text);
    const part = (finished: string[] = []) => {
      const c = new Console({ language, finished: [...ERASER, ...finished] });
      const one = (l: string) => c.execute(machinesInLanguage(c.t, L(l))) ?? '';
      const play = (lines: string[]) => lines.map(one).join('\n');
      const flag = (id: string) => ((c.shell as unknown as { principal: typeof c.shell }).principal ?? c.shell).flags.has(id);
      const green = () => play(['tn5250 mill', PROFILE, PASSWORD]);
      const pase = () => play(['ssh mill', 'yes']);
      return { c, play, flag, green, pase };
    };
    const width = (out: string) => Math.max(...out.split('\n').filter((l) => !/^[A-Z]/.test(l) || l.startsWith(' ')).map((l) => l.length));

    // ——— Chapter 1: "Waiting for a Reply" ———
    it('chapter 1 — solution: MSGW, the inquiry, its help, the lock, then R', () => {
      const { c, play, flag, green } = part();
      expect(green()).toContain('IBM i Main Menu');
      const jobs = play(['WRKACTJOB']);
      expect(jobs).toMatch(/ORDIMPORT\s+ORDBATCH\s+BCH.*MSGW/);
      // Two green screens in order entry: the email names neither.
      expect(jobs).toMatch(/QPADEV0002\s+DIEGO/);
      expect(jobs).toMatch(/QPADEV0004\s+SORAYA/);
      expect(width(jobs.split('\n\n')[0])).toBeLessThanOrEqual(80);
      expect(play(['WRKJOBQ QBATCH'])).toContain('ORDPICK');
      const msg = play(['DSPMSG QSYSOPR']);
      expect(msg).toContain('Unable to allocate a record in file ORDHDR (R C G D F).');
      expect(flag('inquiry')).toBe(true);
      expect(play(['?'])).toContain('Possible choices for replying to message');
      // A whole command at the reply prompt leaves it.
      expect(play(['DSPJOBLOG JOB(412907/ORDBATCH/ORDIMPORT)'])).toContain('Record 28 in use by job 412655/SORAYA/QPADEV0004.');
      expect(flag('cause')).toBe(true);
      const records = play(['DSPRCDLCK FILE(ORDERS/ORDHDR)']);
      expect(records).toMatch(/28\s+QPADEV0004\s+SORAYA\s+412655\s+HELD/);
      expect(records).not.toContain('DIEGO');
      const ended = play(['ENDJOB JOB(412655/SORAYA/QPADEV0004) OPTION(*IMMED)']);
      contains(ended, 'libre');
      expect(c.finished).not.toContain('inquiry');
      play(['DSPMSG QSYSOPR']);
      const end = play(['R']);
      contains(end, 'Bravo');
      expect(c.finished).toContain('inquiry');
      expect(play(['WRKJOBQ QBATCH'])).toContain('(No jobs in queue)');
      play(['SIGNOFF']);
      expect(c.remote).toBeNull();
    });

    it("chapter 1 — false lead: ending the wrong green screen (Diego's, taking orders)", () => {
      const { c, play, flag, green } = part();
      green();
      contains(play(['ENDJOB JOB(412961/DIEGO/QPADEV0002) OPTION(*IMMED)']), 'Diego');
      expect(flag('wrong-session')).toBe(true);
      // The record is still held: R brings the question back.
      play(['DSPMSG QSYSOPR', 'R']);
      expect(flag('retry-locked')).toBe(true);
      play(['', 'ENDJOB JOB(QPADEV0004) OPTION(*IMMED)', 'DSPMSG QSYSOPR', 'R']);
      // The night ran, but Diego's order is lost: no end.
      expect(play(['WRKJOBQ QBATCH'])).toContain('(No jobs in queue)');
      expect(c.finished).not.toContain('inquiry');
    });

    it('chapter 1 — false leads: R while locked, ENDJOB on the import, then SBMJOB', () => {
      const { c, play, flag, green } = part();
      green();
      play(['DSPMSG QSYSOPR', 'R']);
      expect(flag('retry-locked')).toBe(true);
      play(['', 'ENDJOB JOB(412907/ORDBATCH/ORDIMPORT)']);
      expect(flag('killed')).toBe(true);
      // The queue moved on without the night's orders.
      expect(play(['WRKACTJOB SBS(QBATCH)'])).not.toContain('ORDIMPORT');
      play(['ENDJOB JOB(QPADEV0004) OPTION(*IMMED)']);
      expect(c.finished).not.toContain('inquiry');
      expect(play(['CALL PGM(ORDERS/ORDIMP)'])).toContain('ORD0001');
      const out = play(['SBMJOB CMD(CALL PGM(ORDERS/ORDIMP)) JOB(ORDIMPORT)']);
      expect(out).toContain('CPC1221');
      expect(c.finished).toContain('inquiry');
    });

    it('chapter 1 — false lead: G skips order 1847, the analyser\'s messages, PASE', () => {
      const { c, play, flag, pase } = part();
      pase();
      expect(play(['top'])).toContain('-bash: top: command not found');
      expect(play(['WRKACTJOB'])).toContain('-bash: WRKACTJOB: command not found');
      expect(flag('cl-in-pase')).toBe(true);
      expect(play(['uname'])).toBe('OS400');
      expect(play(['system "WRKACTJOB"'])).toContain('MSGW');
      expect(play(['system WRKXYZ'])).toContain('CPD0030: Command WRKXYZ in library *LIBL not found.');
      expect(play(['system "DSPLIB LIB(ORDERS) FOO(1)"'])).toContain('CPD0043: Keyword FOO not valid for this command.');
      expect(play(['system SIGNOFF'])).toContain('CPD0031');
      expect(play(['man wrkactjob'])).toMatch(/^WRKACTJOB\(CL\)/);
      play(['exit', 'tn5250 mill', PROFILE, 'wrong', PROFILE, PASSWORD, 'DSPMSG QSYSOPR', 'X']);
      expect(c.shell.prompt()).toContain('Reply');
      play(['G']);
      expect(flag('skipped')).toBe(true);
      expect(c.finished).not.toContain('inquiry');
      play(['ENDJOB QPADEV0004', 'SBMJOB CMD(CALL PGM(ORDERS/ORDIMP)) JOB(ORDIMPORT)']);
      expect(c.finished).toContain('inquiry');
    });

    // ——— Chapter 2: "Paper Nobody Prints" ———
    it('chapter 2 — solution: the ASP, the debug listings, the switch', () => {
      const { c, play, flag, pase } = part(['inquiry']);
      pase();
      expect(play(['system WRKSYSSTS'])).toContain('91.');
      expect(play(['system WRKOUTQ'])).toMatch(/QPRINT\s+QGPL\s+18031/);
      const splf = play(['system "WRKSPLF SELECT(ORDBATCH)"']);
      expect(splf).toContain('ORDPICKDBG');
      expect(splf).toContain('INVOICE');
      expect(flag('culprit')).toBe(true);
      expect(play(['system "DSPDTAARA ORDERS/ORDDEBUG"'])).toContain("'Y'");
      expect(play(['system "DLTSPLF FILE(*SELECT) SELECT(ORDBATCH *ALL *ALL ORDPICKDBG)"'])).toContain('CPC3301: 18000 spooled files deleted.');
      expect(c.finished).not.toContain('spooled');
      const end = play(["system \"CHGDTAARA DTAARA(ORDERS/ORDDEBUG (1 1)) VALUE('N')\""]);
      contains(end, 'Bravo');
      expect(c.finished).toContain('spooled');
      expect(play(['system WRKSYSSTS'])).toMatch(/% system ASP used {2}\. \. : +8\d\./);
    });

    it('chapter 2 — false lead: CLROUTQ on the shared queue, then the invoices printed again', () => {
      const { c, play, flag, green } = part(['inquiry']);
      green();
      expect(play(['CLROUTQ QPRINT'])).toContain('CPC3308');
      expect(flag('invoices-lost')).toBe(true);
      play(["CHGDTAARA DTAARA(ORDERS/ORDDEBUG) VALUE('N')"]);
      expect(c.finished).not.toContain('spooled');
      play(['SBMJOB CMD(CALL PGM(ORDERS/ORDINV)) JOB(ORDINV)']);
      expect(play(['WRKSPLF SELECT(*ALL *ALL *ALL INVOICE)'])).toContain('INVOICE');
      expect(c.finished).toContain('spooled');
    });

    // ——— Chapter 3: "Saved, Except One" ———
    it('chapter 3 — solution: save while active, CPYTOIMPF in UTF-8, scp to sieve', () => {
      const { c, play, flag, pase } = part(['inquiry', 'spooled']);
      pase();
      expect(play(['system "DSPLOG JOB(NIGHTSAV)"'])).toContain('CPF3771: 15 objects saved from ORDERS. 1 not saved.');
      expect(flag('not-saved')).toBe(true);
      expect(play(['system "WRKOBJLCK OBJ(ORDERS/ORDHDR) OBJTYPE(*FILE)"'])).toContain('ORDWEB');
      expect(play(['system "SAVLIB LIB(ORDERS) DEV(*SAVF) SAVF(BACKUP/ORDERS)"'])).toContain('CPA4067');
      // Message texts from the CL pages of IBM i 7.5's documentation (SAVLIB, RSTLIB).
      expect(c.shell.last.errors.join('\n')).toContain('CPF3794: Save or restore operation ended unsuccessfully.');
      expect(play(['system "SAVLIB LIB(ORDERS QGPL) DEV(*SAVF) SAVF(BACKUP/ORDERS)"'])).toContain('CPF3789: Only one library allowed with specified parameters.');
      play(['system "CRTSAVF FILE(QGPL/EMPTY)"']);
      expect(play(['system "DSPSAVF QGPL/EMPTY"'])).toContain('CPF3707: Save file EMPTY in QGPL contains no data.');
      expect(play(['system "SAVLIB LIB(ORDERS) DEV(*SAVF) SAVF(BACKUP/ORDERS) CLEAR(*ALL)"'])).toContain('CPF3741');
      expect(flag('saved')).toBe(false);
      expect(play(['system "SAVLIB LIB(ORDERS) DEV(*SAVF) SAVF(BACKUP/ORDERS) SAVACT(*LIB) CLEAR(*ALL)"'])).toContain('CPC3722: 16 objects saved from library ORDERS.');
      expect(play(['system "DSPSAVF BACKUP/ORDERS"'])).toContain('ORDHDR');
      expect(play(['db2 "SELECT COUNT(*) FROM ORDERS.ORDHDR"'])).toContain('53');
      play([`system "CPYTOIMPF FROMFILE(ORDERS/ORDHDR) TOSTMF('/home/you/orders.csv') MBROPT(*REPLACE) STMFCCSID(1208) RCDDLM(*LF)"`]);
      expect(play(['file orders.csv'])).toContain('UTF-8');
      expect(play(['grep 1847 orders.csv'])).toContain("\"La Mie d'Inès\"");
      expect(c.finished).not.toContain('save-file');
      const end = play([`scp orders.csv ${SIEVE}:/srv/reports/inbox/`, 'yes']);
      contains(end, 'Bravo');
      expect(c.finished).toContain('save-file');
    });

    it('chapter 3 — false leads: EBCDIC by default, *ADD twice; ENDSBS then STRSBS', () => {
      const { c, play, flag, green } = part(['inquiry', 'spooled']);
      green();
      play(['ENDSBS SBS(ORDSBS) OPTION(*IMMED)']);
      expect(flag('web-down')).toBe(true);
      play(['SAVLIB LIB(ORDERS) DEV(*SAVF) SAVF(BACKUP/ORDERS)', 'G']);
      expect(flag('saved')).toBe(true);
      play(["CPYTOIMPF FROMFILE(ORDERS/ORDHDR) TOSTMF('/home/you/raw.csv')"]);
      expect(flag('ebcdic')).toBe(true);
      play(["CPYTOIMPF FROMFILE(ORDERS/ORDHDR) TOSTMF('/home/you/twice.csv') STMFCCSID(1208)", "CPYTOIMPF FROMFILE(ORDERS/ORDHDR) TOSTMF('/home/you/twice.csv') STMFCCSID(1208)", 'SIGNOFF']);
      play(['ssh mill', 'yes']);
      expect(play(['file raw.csv'])).toContain('data');
      play([`scp twice.csv ${SIEVE}:/srv/reports/inbox/`, 'yes']);
      expect(flag('duplicates')).toBe(true);
      play([`scp raw.csv ${SIEVE}:`, `ssh ${SIEVE}`]);
      expect(play(['file raw.csv'])).toContain('data');
      // Converted on the way: EBCDIC (IBM037) to UTF-8 also gives a good file.
      play(['iconv -f IBM037 -t UTF-8 raw.csv -o /srv/reports/inbox/orders.csv']);
      expect(c.finished).not.toContain('save-file');
      play(['exit', 'system "STRSBS ORDERS/ORDSBS"']);
      expect(c.finished).toContain('save-file');
    });
  });
